"""Contas: criar, entrar, sair e quem está usando.
A sessão é um token aleatório num cookie HttpOnly, Secure e SameSite=Strict; o banco guarda só o SHA-256 dele."""
import hashlib
import re
import secrets
import threading
from datetime import datetime, timedelta, timezone
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from db import AuthAttempt, User, UserSession, get_db
from seed import semear_conta

COOKIE = "liga_sessao"
DURACAO = timedelta(days=7)
ERROS_ATE_TRAVAR = 5
JANELA_ERROS = timedelta(minutes=15)
# No sistema todo, não por endereço: atrás do proxy da hospedagem o IP de quem acessa não é confiável
CADASTROS_POR_HORA = 50
SENHA_MINIMA = 8
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# argon2id no mínimo da OWASP (19 MiB, 2 passadas, 1 linha): ~35 ms por senha. Hash antigo (64 MiB) ainda confere
# e é refeito com estes parâmetros no próximo login (check_needs_rehash).
senhas = PasswordHasher(memory_cost=19456, time_cost=2, parallelism=1)
# Hash é a parte mais pesada de memória e CPU: no máximo 4 ao mesmo tempo por processo; 100 logins juntos esperam
# a vez em vez de pedir 100 × 19 MiB de uma vez
VEZ_DO_HASH = threading.BoundedSemaphore(4)
# E-mail sem conta também passa por uma verificação: o tempo de resposta não entrega quem tem conta
HASH_FALSO = senhas.hash(secrets.token_hex(16))

router = APIRouter(prefix="/api/auth")


class ContaIn(BaseModel):
    # Sem tirar espaços: na senha eles contam
    model_config = ConfigDict(str_strip_whitespace=False)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ContaOut(BaseModel):
    email: str


def agora():
    return datetime.now(timezone.utc)


def negar(status: int, code: str, message: str, headers: dict | None = None):
    raise HTTPException(status, {"code": code, "message": message, "details": []}, headers=headers)


def normalizar(email: str) -> str:
    e = email.strip().lower()
    if not EMAIL.match(e):
        negar(422, "VALIDATION_ERROR", "Digite um e-mail válido, como nome@exemplo.com.")
    return e


def confere(hash_: str, senha: str) -> bool:
    try:
        with VEZ_DO_HASH:
            return senhas.verify(hash_, senha)
    except (VerificationError, InvalidHashError):
        return False


def gerar_hash(senha: str) -> str:
    with VEZ_DO_HASH:
        return senhas.hash(senha)


def resumo(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def abrir_sessao(db: Session, u: User, resposta: Response):
    # Token novo a cada entrada (nada de reaproveitar sessão de antes: evita fixação de sessão)
    token = secrets.token_urlsafe(32)
    db.execute(delete(UserSession).where(UserSession.user_id == u.id, UserSession.expires_at <= agora()))
    db.add(UserSession(user_id=u.id, token_hash=resumo(token), expires_at=agora() + DURACAO))
    resposta.set_cookie(COOKIE, token, max_age=int(DURACAO.total_seconds()), path="/api",
                        secure=True, httponly=True, samesite="strict")


def tentativas(db: Session, kind: str, key: str, janela: timedelta) -> int:
    return db.scalar(select(func.count(AuthAttempt.id)).where(
        AuthAttempt.kind == kind, AuthAttempt.key == key, AuthAttempt.created_at > agora() - janela))


def anotar(db: Session, kind: str, key: str):
    db.execute(delete(AuthAttempt).where(AuthAttempt.created_at < agora() - timedelta(days=1)))
    db.add(AuthAttempt(kind=kind, key=key))


def usuario_atual(liga_sessao: Annotated[str | None, Cookie()] = None, db: Session = Depends(get_db)) -> User:
    u = None
    if liga_sessao and len(liga_sessao) <= 100:
        # Sessão válida e dono numa consulta só: roda em todo pedido, então cada ida ao banco conta
        u = db.scalar(select(User).join(UserSession, UserSession.user_id == User.id)
                      .where(UserSession.token_hash == resumo(liga_sessao), UserSession.expires_at > agora()))
    if u is None:
        negar(401, "UNAUTHENTICATED", "Entre na sua conta para continuar.")
    return u


@router.post("/register", response_model=ContaOut, status_code=201)
def cadastrar(body: ContaIn, resposta: Response, db: Session = Depends(get_db)):
    email = normalizar(body.email)
    if len(body.password) < SENHA_MINIMA:
        negar(422, "WEAK_PASSWORD", f"A senha precisa ter pelo menos {SENHA_MINIMA} caracteres.")
    if tentativas(db, "cadastro", "*", timedelta(hours=1)) >= CADASTROS_POR_HORA:
        negar(429, "TOO_MANY_REQUESTS", "Muitas contas criadas agora há pouco. Tente de novo mais tarde.", {"Retry-After": "3600"})
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        negar(409, "EMAIL_TAKEN", "Já existe uma conta com esse e-mail. Entre com ela.")
    u = User(email=email, password_hash=gerar_hash(body.password))
    db.add(u)
    db.flush()
    semear_conta(db, u.id)
    anotar(db, "cadastro", "*")
    abrir_sessao(db, u, resposta)
    db.commit()
    return ContaOut(email=u.email)


@router.post("/login", response_model=ContaOut)
def entrar(body: ContaIn, resposta: Response, db: Session = Depends(get_db)):
    email = normalizar(body.email)
    if tentativas(db, "login", email, JANELA_ERROS) >= ERROS_ATE_TRAVAR:
        negar(429, "TOO_MANY_ATTEMPTS", "Muitas tentativas erradas. Espere 15 minutos e tente de novo.",
              {"Retry-After": str(int(JANELA_ERROS.total_seconds()))})
    u = db.scalar(select(User).where(User.email == email))
    # Mesma mensagem para e-mail sem conta e senha errada: a tela não entrega quem tem conta
    if not confere(u.password_hash if u else HASH_FALSO, body.password) or u is None:
        anotar(db, "login", email)
        db.commit()
        negar(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.")
    db.execute(delete(AuthAttempt).where(AuthAttempt.kind == "login", AuthAttempt.key == email))
    if senhas.check_needs_rehash(u.password_hash):
        u.password_hash = gerar_hash(body.password)
    abrir_sessao(db, u, resposta)
    db.commit()
    return ContaOut(email=u.email)


@router.post("/logout", status_code=204)
def sair(resposta: Response, liga_sessao: Annotated[str | None, Cookie()] = None, db: Session = Depends(get_db)):
    if liga_sessao:
        db.execute(delete(UserSession).where(UserSession.token_hash == resumo(liga_sessao)))
        db.commit()
    resposta.delete_cookie(COOKIE, path="/api", secure=True, httponly=True, samesite="strict")


@router.get("/me", response_model=ContaOut)
def quem_sou(u: User = Depends(usuario_atual)):
    return ContaOut(email=u.email)
