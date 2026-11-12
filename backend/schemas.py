"""Formato do JSON que entra e sai da API."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Orm(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AttributeIn(Orm):
    name: str = Field(min_length=1, max_length=80)
    unit: str = Field("", max_length=20)


class AttributeOut(AttributeIn):
    id: int


class ValueIn(Orm):
    attribute_id: int
    value: float


class MaterialIn(Orm):
    name: str = Field(min_length=1, max_length=120)
    price_per_kg: float = Field(ge=0)
    notes: str | None = None
    values: list[ValueIn] = []


class MaterialOut(MaterialIn):
    id: int


class ItemIn(Orm):
    material_id: int
    min_pct: float = Field(0, ge=0, le=100)
    max_pct: float = Field(100, ge=0, le=100)


class LimitIn(Orm):
    attribute_id: int
    min_value: float | None = None
    max_value: float | None = None


class CalculationIn(Orm):
    batch_size: float = Field(1000, gt=0)
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
