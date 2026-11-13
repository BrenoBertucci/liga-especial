"""Formato do JSON que entra e sai da API."""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

# Os ids no Postgres são INTEGER: acima disso a consulta estoura em vez de responder "não existe"
MAX_ID = 2_147_483_647
Id = Annotated[int, Field(gt=0, le=MAX_ID)]
# Teto folgado para nenhuma conta virar infinito (lote em t × 1000 kg × preço)
Numero = Annotated[float, Field(ge=-1e12, le=1e12)]


class Orm(BaseModel):
    # Tira os espaços antes do min_length (nome só com espaços não passa) e recusa NaN e Infinity
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True, allow_inf_nan=False)


class AttributeIn(Orm):
    name: str = Field(min_length=1, max_length=80)
    unit: str = Field("", max_length=20)


class AttributeOut(AttributeIn):
    id: int


class ValueIn(Orm):
    attribute_id: Id
    value: Numero


class MaterialIn(Orm):
    name: str = Field(min_length=1, max_length=120)
    price_per_kg: float = Field(ge=0, le=1_000_000)
    notes: str | None = None
    values: list[ValueIn] = []


class MaterialOut(MaterialIn):
    id: int


class ItemIn(Orm):
    material_id: Id
    min_pct: float = Field(0, ge=0, le=100)
    max_pct: float = Field(100, ge=0, le=100)


class LimitIn(Orm):
    attribute_id: Id
    min_value: Numero | None = None
    max_value: Numero | None = None


class CalculationIn(Orm):
    batch_size: float = Field(1000, gt=0, le=1_000_000_000)
    batch_unit: Literal["kg", "t"] = "kg"
    items: list[ItemIn]
    limits: list[LimitIn] = []


class FormulaIn(CalculationIn):
    name: str = Field(min_length=1, max_length=120)


class FormulaOut(FormulaIn):
    id: int
    created_at: datetime
    updated_at: datetime


class FormulaSummary(Orm):
    id: int
    name: str
    batch_size: float
    batch_unit: str
    item_count: int
    limit_count: int
    updated_at: datetime
