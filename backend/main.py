"""API REST do rascunho Liga Especial. Rodar dentro de backend/: uvicorn main:app --reload"""
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

import solver
from db import Attribute, Base, Formula, FormulaAttributeLimit, FormulaItem, Material, MaterialAttributeValue, SessionLocal, engine
from schemas import (MAX_ID, AttributeIn, AttributeOut, CalculationIn, FormulaIn, FormulaOut, FormulaSummary, MaterialIn,
                     MaterialOut, ValueIn)
from seed import seed_if_empty


@asynccontextmanager
async def lifespan(_):
    # create_all só cria as tabelas que faltam; mudar a estrutura de uma tabela vai pedir migração (Alembic)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_if_empty(db)
    yield


app = FastAPI(title="Liga Especial · rascunho", lifespan=lifespan)
# Só atende pelos nomes deste PC: um site que aponte o domínio dele para 127.0.0.1 (DNS rebinding) leva 400.
# Publicando com outro endereço, inclua o domínio em ALLOWED_HOSTS (separado por vírgula).
HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
# No Render, o endereço público (nome.onrender.com) chega nesta variável
if os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])
app.add_middleware(TrustedHostMiddleware, allowed_hosts=HOSTS)


@app.middleware("http")
async def cabecalhos_de_seguranca(request, call_next):
    resposta = await call_next(request)
    # O navegador não trata o JSON como script/HTML, não abre a API dentro de frame e não manda Referer adiante
    resposta.headers.setdefault("X-Content-Type-Options", "nosniff")
    resposta.headers.setdefault("X-Frame-Options", "DENY")
    resposta.headers.setdefault("Referrer-Policy", "no-referrer")
    return resposta


def get_db():
    with SessionLocal() as db:
        yield db


def falha(status: int, code: str, message: str, details: list | None = None):
    raise HTTPException(status, {"code": code, "message": message, "details": details or []})


MENSAGEM_HTTP = {400: "Não deu para ler os dados enviados.", 404: "Endereço não encontrado.", 405: "Método não aceito neste endereço."}


@app.exception_handler(StarletteHTTPException)
async def erro_http(_, exc):
    if isinstance(exc.detail, dict):
        detail = exc.detail
    else:
        detail = {"code": "HTTP_ERROR", "message": MENSAGEM_HTTP.get(exc.status_code, str(exc.detail)), "details": []}
    return JSONResponse({"error": detail}, status_code=exc.status_code)


# Erro de validação no idioma e com o nome de campo que a pessoa vê na tela
CAMPOS = {"name": "Nome", "unit": "Unidade", "price_per_kg": "Preço por kg", "notes": "Observação", "value": "Valor",
          "attribute_id": "Atributo", "material_id": "Material", "min_pct": "Inclusão mínima", "max_pct": "Inclusão máxima",
          "min_value": "Mínimo", "max_value": "Máximo", "batch_size": "Tamanho do lote", "batch_unit": "Unidade do lote",
          "items": "Materiais", "limits": "Limites", "values": "Valores"}


def motivo(e: dict) -> str:
    ctx = {k: solver.br(v) if isinstance(v, (int, float)) else str(v).replace(" or ", " ou ") for k, v in e.get("ctx", {}).items()}
    textos = {
        "missing": "é obrigatório",
        "string_type": "precisa ser um texto",
        "string_too_short": "não pode ficar vazio",
        "string_too_long": f"passa de {ctx.get('max_length')} caracteres",
        "greater_than": f"precisa ser maior que {ctx.get('gt')}",
        "greater_than_equal": f"precisa ser {ctx.get('ge')} ou mais",
        "less_than_equal": f"precisa ser {ctx.get('le')} ou menos",
        "finite_number": "precisa ser um número finito",
        "float_parsing": "precisa ser um número, com ponto nos decimais",
        "float_type": "precisa ser um número",
        "int_parsing": "precisa ser um número inteiro",
        "int_type": "precisa ser um número inteiro",
        "literal_error": f"precisa ser {ctx.get('expected')}",
        "json_invalid": "o corpo não é um JSON válido",
        "model_attributes_type": "o corpo precisa ser um objeto JSON",
        "list_type": "precisa ser uma lista",
    }
    return textos.get(e["type"], e["msg"])


def campo(e: dict) -> str:
    # ("body", "items", 2, "max_pct") vira "Inclusão máxima (item 3)"; erro no corpo inteiro fica sem campo
    if e["type"] == "json_invalid":
        return ""
    nomes = [CAMPOS.get(p, p) for p in e["loc"][1:] if isinstance(p, str)]
    linhas = [p + 1 for p in e["loc"][1:] if isinstance(p, int)]
    return (nomes[-1] if nomes else "") + (f" (item {linhas[0]})" if linhas else "")


@app.exception_handler(RequestValidationError)
async def erro_validacao(_, exc):
    # Id fora do formato no endereço (/materials/abc) é endereço que não existe, não campo errado
    if any(e["loc"][0] == "path" for e in exc.errors()):
        return JSONResponse({"error": {"code": "NOT_FOUND", "message": MENSAGEM_HTTP[404], "details": []}}, status_code=404)
    details = [{"field": campo(e), "issue": motivo(e)} for e in exc.errors()]
    return JSONResponse({"error": {"code": "VALIDATION_ERROR", "message": "Confira os campos.", "details": details}}, status_code=422)


@app.exception_handler(DataError)
async def erro_dado(_, exc):
    # Rede de segurança: valor que o banco não guarda vira 422, nunca 500
    return JSONResponse({"error": {"code": "OUT_OF_RANGE", "message": "Há um valor fora do intervalo aceito.", "details": []}}, status_code=422)


def buscar(db: Session, modelo, id_: int, rotulo: str):
    obj = db.get(modelo, id_) if 0 < id_ <= MAX_ID else None
    if obj is None:
        falha(404, "NOT_FOUND", f"{rotulo} {id_} não existe.")
    return obj


def nome_livre(db: Session, modelo, nome: str, id_atual: int | None):
    # "ferro puro" e "Ferro puro" são o mesmo cadastro para quem usa; o UNIQUE do banco só pega a grafia exata
    outro = db.scalar(select(modelo.id).where(func.lower(modelo.name) == nome.lower(), modelo.id != (id_atual or 0)))
    if outro is not None:
        falha(409, "CONFLICT", "Já existe um cadastro com esse nome.")


@app.exception_handler(IntegrityError)
async def erro_duplicado(_, exc):
    # Os únicos UNIQUE são os nomes; a sessão é desfeita ao fechar no get_db
    return JSONResponse({"error": {"code": "CONFLICT", "message": "Já existe um cadastro com esse nome.", "details": []}}, status_code=409)


# ---------- atributos técnicos ----------

@app.get("/api/attributes", response_model=list[AttributeOut])
def listar_atributos(db: Session = Depends(get_db)):
    return db.scalars(select(Attribute).order_by(Attribute.name)).all()


@app.post("/api/attributes", response_model=AttributeOut, status_code=201)
def criar_atributo(body: AttributeIn, db: Session = Depends(get_db)):
    nome_livre(db, Attribute, body.name, None)
    a = Attribute(name=body.name.strip(), unit=body.unit.strip())
    db.add(a)
    db.commit()
    return a


@app.put("/api/attributes/{attribute_id}", response_model=AttributeOut)
def editar_atributo(attribute_id: int, body: AttributeIn, db: Session = Depends(get_db)):
    a = buscar(db, Attribute, attribute_id, "Atributo")
    nome_livre(db, Attribute, body.name, a.id)
    a.name, a.unit = body.name.strip(), body.unit.strip()
    db.commit()
    return a


@app.delete("/api/attributes/{attribute_id}", status_code=204)
def excluir_atributo(attribute_id: int, db: Session = Depends(get_db)):
    # Os valores nos materiais e os limites nas fórmulas saem junto (ON DELETE CASCADE)
    db.delete(buscar(db, Attribute, attribute_id, "Atributo"))
    db.commit()


# ---------- materiais ----------

def conferir_valores(db: Session, valores: list[ValueIn]):
    ids = [v.attribute_id for v in valores]
    if len(set(ids)) != len(ids):
        falha(422, "DUPLICATE_ATTRIBUTE", "O mesmo atributo aparece duas vezes no material.")
    atributos = {a.id: a for a in db.scalars(select(Attribute).where(Attribute.id.in_(ids)))}
    faltando = [i for i in ids if i not in atributos]
    if faltando:
        falha(422, "UNKNOWN_ATTRIBUTE", "Atributo inexistente.", [{"field": "Atributo", "issue": str(i)} for i in faltando])
    # Teor em % é parte da massa do material: fora de 0 a 100 não existe
    fora = [atributos[v.attribute_id].name for v in valores if atributos[v.attribute_id].unit == "%" and not 0 <= v.value <= 100]
    if fora:
        falha(422, "OUT_OF_RANGE", "Teor em % vai de 0 a 100.", [{"field": n, "issue": "precisa ficar entre 0 e 100"} for n in fora])


@app.get("/api/materials", response_model=list[MaterialOut])
def listar_materiais(db: Session = Depends(get_db)):
    return db.scalars(select(Material).order_by(Material.name)).all()


@app.get("/api/materials/{material_id}", response_model=MaterialOut)
def ler_material(material_id: int, db: Session = Depends(get_db)):
    return buscar(db, Material, material_id, "Material")


def preencher_material(db: Session, m: Material, body: MaterialIn):
    # As consultas vêm antes do add: o autoflush gravaria um material novo ainda sem nome
    conferir_valores(db, body.values)
    nome_livre(db, Material, body.name, m.id)
    m.name, m.price_per_kg, m.notes = body.name.strip(), body.price_per_kg, (body.notes or "").strip() or None
    db.add(m)
    # Limpa e grava antes de inserir de novo: a chave (material, atributo) se repete
    m.values.clear()
    db.flush()
    m.values.extend(MaterialAttributeValue(attribute_id=v.attribute_id, value=v.value) for v in body.values)


@app.post("/api/materials", response_model=MaterialOut, status_code=201)
def criar_material(body: MaterialIn, db: Session = Depends(get_db)):
    m = Material()
    preencher_material(db, m, body)
    db.commit()
    return m


@app.put("/api/materials/{material_id}", response_model=MaterialOut)
def editar_material(material_id: int, body: MaterialIn, db: Session = Depends(get_db)):
    m = buscar(db, Material, material_id, "Material")
    preencher_material(db, m, body)
    db.commit()
    return m


@app.delete("/api/materials/{material_id}", status_code=204)
def excluir_material(material_id: int, db: Session = Depends(get_db)):
    m = buscar(db, Material, material_id, "Material")
    usos = db.scalars(select(Formula.name).join(FormulaItem).where(FormulaItem.material_id == material_id)).all()
    if usos:
        falha(409, "MATERIAL_IN_USE", f"Este material está nas fórmulas: {', '.join(usos)}. Tire-o delas antes de excluir.")
    db.delete(m)
    db.commit()


# ---------- fórmulas salvas ----------

def problemas_da_formula(db: Session, body: CalculationIn):
    """Confere a fórmula antes de calcular ou salvar. Devolve os materiais e atributos já carregados."""
    erros = []
    ids_m = [i.material_id for i in body.items]
    ids_a = [l.attribute_id for l in body.limits]
    materiais = {m.id: m for m in db.scalars(select(Material).where(Material.id.in_(ids_m)))}
    atributos = {a.id: a for a in db.scalars(select(Attribute).where(Attribute.id.in_(ids_a)))}

    if not body.items:
        erros.append("Escolha pelo menos um material.")
    if len(set(ids_m)) != len(ids_m):
        erros.append("Há material repetido na fórmula.")
    if len(set(ids_a)) != len(ids_a):
        erros.append("Há atributo com dois limites na fórmula.")
    erros += [f"Material {i} não existe mais." for i in ids_m if i not in materiais]
    erros += [f"Atributo {i} não existe mais." for i in ids_a if i not in atributos]
    for i in body.items:
        if i.material_id in materiais and i.min_pct > i.max_pct:
            erros.append(f"{materiais[i.material_id].name}: inclusão mínima maior que a máxima.")
    soma_min = sum(i.min_pct for i in body.items)
    soma_max = sum(i.max_pct for i in body.items)
    if soma_min > 100 + 1e-9:
        erros.append(f"As inclusões mínimas somam {solver.br(soma_min)}%: passam de 100%.")
    if body.items and soma_max < 100 - 1e-9:
        erros.append(f"As inclusões máximas somam {solver.br(soma_max)}%: não chegam a 100%.")
    for l in body.limits:
        if l.attribute_id not in atributos:
            continue
        nome = atributos[l.attribute_id].name
        if l.min_value is None and l.max_value is None:
            erros.append(f"{nome}: informe o mínimo, o máximo ou os dois.")
        elif l.min_value is not None and l.max_value is not None and l.min_value > l.max_value:
            erros.append(f"{nome}: mínimo maior que o máximo.")
        # Valor faltando não vira zero: com zero o cálculo daria uma resposta errada calada
        for m in (materiais[i] for i in ids_m if i in materiais):
            if all(v.attribute_id != l.attribute_id for v in m.values):
                erros.append(f"{m.name} não tem valor de {nome}. Preencha no cadastro do material.")
    return erros, materiais, atributos


def resumo(f: Formula):
    return FormulaSummary(id=f.id, name=f.name, batch_size=f.batch_size, batch_unit=f.batch_unit,
                          item_count=len(f.items), limit_count=len(f.limits), updated_at=f.updated_at)


@app.get("/api/formulas", response_model=list[FormulaSummary])
def listar_formulas(db: Session = Depends(get_db)):
    return [resumo(f) for f in db.scalars(select(Formula).order_by(Formula.updated_at.desc()))]


@app.get("/api/formulas/{formula_id}", response_model=FormulaOut)
def ler_formula(formula_id: int, db: Session = Depends(get_db)):
    return buscar(db, Formula, formula_id, "Fórmula")


def preencher_formula(db: Session, f: Formula, body: FormulaIn):
    erros, _, _ = problemas_da_formula(db, body)
    if erros:
        falha(422, "INVALID_FORMULA", "A fórmula tem problemas.", [{"field": "", "issue": e} for e in erros])
    nome_livre(db, Formula, body.name, f.id)
    f.name, f.batch_size, f.batch_unit = body.name.strip(), body.batch_size, body.batch_unit
    db.add(f)
    f.items.clear()
    f.limits.clear()
    db.flush()
    f.items.extend(FormulaItem(**i.model_dump()) for i in body.items)
    f.limits.extend(FormulaAttributeLimit(**l.model_dump()) for l in body.limits)


@app.post("/api/formulas", response_model=FormulaOut, status_code=201)
def criar_formula(body: FormulaIn, db: Session = Depends(get_db)):
    f = Formula()
    preencher_formula(db, f, body)
    db.commit()
    db.refresh(f)
    return f


@app.put("/api/formulas/{formula_id}", response_model=FormulaOut)
def editar_formula(formula_id: int, body: FormulaIn, db: Session = Depends(get_db)):
    f = buscar(db, Formula, formula_id, "Fórmula")
    preencher_formula(db, f, body)
    db.commit()
    db.refresh(f)
    return f


@app.delete("/api/formulas/{formula_id}", status_code=204)
def excluir_formula(formula_id: int, db: Session = Depends(get_db)):
    db.delete(buscar(db, Formula, formula_id, "Fórmula"))
    db.commit()


# ---------- cálculo ----------

@app.post("/api/calculations")
def calcular(body: CalculationIn, db: Session = Depends(get_db)):
    """Composição de menor custo. Sem solução também é 200: status "no_solution", mensagem e dicas."""
    erros, materiais, atributos = problemas_da_formula(db, body)
    if erros:
        falha(422, "INVALID_FORMULA", "A fórmula tem problemas.", [{"field": "", "issue": e} for e in erros])
    todos = {a.id: {"name": a.name, "unit": a.unit} for a in db.scalars(select(Attribute).order_by(Attribute.name))}
    itens = [{
        "id": m.id, "name": m.name, "price": m.price_per_kg, "min_pct": i.min_pct, "max_pct": i.max_pct,
        "values": {v.attribute_id: v.value for v in m.values},
    } for i in body.items for m in [materiais[i.material_id]]]
    limites = [{"attribute_id": l.attribute_id, "min": l.min_value, "max": l.max_value} for l in body.limits]
    return solver.compor(itens, limites, todos, body.batch_size, body.batch_unit)


@app.get("/api/health")
def saude(db: Session = Depends(get_db)):
    return {"status": "ok", "materials": db.scalar(select(func.count(Material.id)))}
