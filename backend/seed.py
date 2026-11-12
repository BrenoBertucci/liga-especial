"""Dados de demonstração: os mesmos preços, teores e limites da planilha Liga_Especial_Solver.xlsx."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import Attribute, Formula, FormulaAttributeLimit, FormulaItem, Material, MaterialAttributeValue

ATRIBUTOS = [("Ferro", "%"), ("Carbono", "%"), ("Silício", "%"), ("Níquel", "%")]
# nome, preço por kg, teores na ordem dos atributos
MATERIAIS = [
    ("Ferro puro", 0.30, (100, 0, 0, 0)),
    ("Carbono (grafite)", 0.20, (0, 100, 0, 0)),
    ("Silício metálico", 0.28, (0, 0, 100, 0)),
    ("Níquel eletrolítico", 0.50, (0, 0, 0, 100)),
    ("Sucata reciclada A", 0.20, (60, 20, 20, 0)),
    ("Sucata reciclada B", 0.25, (70, 20, 5, 5)),
]
LIMITES = [(60, 65), (15, 20), (15, 20), (5, 8)]


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(Attribute.id).limit(1)) is not None:
        return
    atributos = [Attribute(name=n, unit=u) for n, u in ATRIBUTOS]
    db.add_all(atributos)
    db.flush()
    materiais = [
        Material(name=nome, price_per_kg=preco, values=[
            MaterialAttributeValue(attribute_id=a.id, value=v) for a, v in zip(atributos, teores)
        ])
        for nome, preco, teores in MATERIAIS
    ]
    db.add_all(materiais)
    db.flush()
    db.add(Formula(
        name="Liga padrão", batch_size=1000, batch_unit="kg",
        items=[FormulaItem(material_id=m.id, min_pct=0, max_pct=100) for m in materiais],
        limits=[FormulaAttributeLimit(attribute_id=a.id, min_value=lo, max_value=hi) for a, (lo, hi) in zip(atributos, LIMITES)],
    ))
    db.commit()
