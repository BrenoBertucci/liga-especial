"""Banco: conexão, sessão e as seis tabelas do rascunho."""
import os
import re
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

# Sem senha no código: passe DATABASE_URL completa, ou deixe o libpq ler do pgpass.conf / PGPASSWORD
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://postgres@localhost:5432/liga_especial")
# Supabase e outros provedores entregam postgresql://; o driver instalado é o psycopg 3
DATABASE_URL = re.sub(r"^postgres(ql)?://", "postgresql+psycopg://", DATABASE_URL)
# pre_ping descarta a conexão que o servidor fechou enquanto a API estava parada
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Attribute(Base):
    __tablename__ = "attributes"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    unit: Mapped[str] = mapped_column(String(20), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Material(Base):
    __tablename__ = "materials"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
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
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
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
