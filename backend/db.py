"""Banco: conexão, sessão e as tabelas do rascunho. Cada atributo, material e fórmula tem dono (user_id)."""
import os
import re
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint, create_engine, func, make_url
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker
from sqlalchemy.pool import NullPool

# Sem senha no código: passe DATABASE_URL completa, ou deixe o libpq ler do pgpass.conf / PGPASSWORD
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://postgres@localhost:5432/liga_especial")
# Supabase e outros provedores entregam postgresql://; o driver instalado é o psycopg 3
URL = make_url(re.sub(r"^postgres(ql)?://", "postgresql+psycopg://", DATABASE_URL))

if (URL.host or "").endswith(".pooler.supabase.com"):
    # Hospedagem sem servidor: cada instância abre conexões curtas. O pooler de transação do Supabase (6543) divide
    # poucas conexões reais entre centenas de clientes; o de sessão (5432) para no tamanho do pool.
    # Sem pool no Python (o pooler já é o pool) e sem prepared statements, que o modo transação não guarda.
    engine = create_engine(URL.set(port=6543), poolclass=NullPool, connect_args={"prepare_threshold": None})
else:
    # Uma conexão para cada uma das 40 threads que atendem pedidos: nenhuma fica esperando o pool enquanto segura
    # a vez de quem devolveria a conexão (com 5 + 10 a API travava com 100 pessoas ao mesmo tempo).
    # pre_ping descarta a conexão que o servidor fechou enquanto a API estava parada.
    engine = create_engine(URL, pool_size=10, max_overflow=30, pool_timeout=10, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as db:
        yield db


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    # Guardado em minúsculas: "Ana@x.com" e "ana@x.com" são a mesma conta
    email: Mapped[str] = mapped_column(String(254), unique=True)
    # argon2id; "!" marca conta que não entra (dono dos dados de antes das contas)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserSession(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Só o SHA-256 do token: quem lê o banco não consegue usar a sessão de ninguém
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuthAttempt(Base):
    """Senha errada (kind "login", chave = e-mail) e conta criada (kind "cadastro"), para frear abuso."""
    __tablename__ = "auth_attempts"
    __table_args__ = (Index("ix_auth_attempts_kind_key_created_at", "kind", "key", "created_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))
    key: Mapped[str] = mapped_column(String(254))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


def dono():
    return mapped_column(ForeignKey("users.id", ondelete="CASCADE"))


class Attribute(Base):
    __tablename__ = "attributes"
    # Nome único dentro da conta; outra conta pode ter um "Ferro" também
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_attributes_user_name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = dono()
    name: Mapped[str] = mapped_column(String(80))
    unit: Mapped[str] = mapped_column(String(20), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Material(Base):
    __tablename__ = "materials"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_materials_user_name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = dono()
    name: Mapped[str] = mapped_column(String(120))
    price_per_kg: Mapped[float] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    values: Mapped[list["MaterialAttributeValue"]] = relationship(cascade="all, delete-orphan", passive_deletes=True, lazy="selectin")


class MaterialAttributeValue(Base):
    __tablename__ = "material_attribute_values"
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id", ondelete="CASCADE"), primary_key=True)
    attribute_id: Mapped[int] = mapped_column(ForeignKey("attributes.id", ondelete="CASCADE"), primary_key=True, index=True)
    value: Mapped[float] = mapped_column(Float)


class Formula(Base):
    __tablename__ = "formulas"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_formulas_user_name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = dono()
    name: Mapped[str] = mapped_column(String(120))
    batch_size: Mapped[float] = mapped_column(Float)
    batch_unit: Mapped[str] = mapped_column(String(5), default="kg")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    items: Mapped[list["FormulaItem"]] = relationship(cascade="all, delete-orphan", passive_deletes=True, lazy="selectin")
    limits: Mapped[list["FormulaAttributeLimit"]] = relationship(cascade="all, delete-orphan", passive_deletes=True, lazy="selectin")


class FormulaItem(Base):
    __tablename__ = "formula_items"
    formula_id: Mapped[int] = mapped_column(ForeignKey("formulas.id", ondelete="CASCADE"), primary_key=True)
    # RESTRICT: material usado em fórmula não some sem aviso (a rota devolve 409 antes)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id", ondelete="RESTRICT"), primary_key=True, index=True)
    min_pct: Mapped[float] = mapped_column(Float, default=0)
    max_pct: Mapped[float] = mapped_column(Float, default=100)


class FormulaAttributeLimit(Base):
    __tablename__ = "formula_attribute_limits"
    formula_id: Mapped[int] = mapped_column(ForeignKey("formulas.id", ondelete="CASCADE"), primary_key=True)
    attribute_id: Mapped[int] = mapped_column(ForeignKey("attributes.id", ondelete="CASCADE"), primary_key=True, index=True)
    min_value: Mapped[float | None] = mapped_column(Float)
    max_value: Mapped[float | None] = mapped_column(Float)
