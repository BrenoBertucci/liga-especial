"""Confere o cálculo sem banco. Rodar: python test_solver.py

Os dados do seed são os da planilha Liga_Especial_Solver.xlsx: o ótimo do Solver usa 7,5% de
ferro, 5% de níquel e 87,5% da sucata A (Recuperado 1), a 0,2225 por kg.
"""
from seed import ATRIBUTOS, MATERIAIS, LIMITES
from solver import compor

ATR = {i: {"name": n, "unit": u} for i, (n, u) in enumerate(ATRIBUTOS)}


def materiais(**inclusoes):
    return [{"id": i, "name": nome, "price": preco, "min_pct": inclusoes.get(nome, (0, 100))[0],
             "max_pct": inclusoes.get(nome, (0, 100))[1], "values": dict(enumerate(valores))}
            for i, (nome, preco, valores) in enumerate(MATERIAIS)]


def limites(**trocas):
    return [{"attribute_id": i, "min": trocas.get(ATRIBUTOS[i][0], (lo, hi))[0], "max": trocas.get(ATRIBUTOS[i][0], (lo, hi))[1]}
            for i, (lo, hi) in enumerate(LIMITES)]


def perto(a, b):
    assert abs(a - b) < 1e-6, f"{a} != {b}"


r = compor(materiais(), limites(), ATR, 1000, "kg")
assert r["status"] == "optimal", r
perto(r["cost_per_kg"], 0.2225)
perto(r["total_cost"], 222.5)
for item, esperado in zip(r["items"], [7.5, 0, 0, 5, 87.5, 0]):
    perto(item["pct"], esperado)
assert [c["binding"] for c in r["limits"]] == ["min", None, None, "min"], r["limits"]
assert all(c["ok"] for c in r["limits"])

r = compor(materiais(), limites(), ATR, 2, "t")
perto(r["cost_per_unit"], 222.5)
perto(r["items"][4]["quantity"], 1.75)

# Mínimo de ferro acima do que qualquer material tem: dica aponta o atributo
r = compor(materiais(), limites(Ferro=(101, None)), ATR, 1000, "kg")
assert r["status"] == "no_solution" and "Ferro" in r["hints"][0], r

# Limites possíveis um a um, mas não juntos: dica diz qual limite sobra
r = compor(materiais(), limites(Ferro=(72, 80)), ATR, 1000, "kg")
assert r["status"] == "no_solution" and any("Sem o limite" in d for d in r["hints"]), r

# Inclusão mínima obriga a usar sucata B
r = compor(materiais(**{"Sucata reciclada B": (20, 100)}), limites(), ATR, 1000, "kg")
assert r["status"] == "optimal" and r["items"][5]["binding"] == "min", r["items"][5]

print("solver ok")
