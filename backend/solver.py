"""Programação linear da composição. Funções puras, sem banco, para testar direto (test_solver.py).

Variáveis: x_i = fração de cada material na mistura (0 a 1).
Minimiza Σ preço_i · x_i, com Σ x_i = 1, inclusão mín ≤ x_i ≤ máx e, para cada atributo
limitado, mín ≤ Σ valor_i · x_i ≤ máx (média ponderada pela massa).
"""
from scipy.optimize import linprog

KG_POR_UNIDADE = {"kg": 1.0, "t": 1000.0}
SEM_SOLUCAO = "Não foi possível encontrar uma composição que atenda aos limites informados."
PREMISSA = (
    "Cada atributo da mistura é a média dos materiais ponderada pela massa. Vale para teores e "
    "percentuais; para densidade, resistência ou granulometria o resultado é uma aproximação."
)


def br(v: float, casas: int = 2) -> str:
    """Número no formato brasileiro, sem zeros sobrando: 1234.5 vira 1.234,5."""
    s = f"{v:,.{casas}f}".rstrip("0").rstrip(".") if casas else f"{v:,.0f}"
    return s.replace(",", "_").replace(".", ",").replace("_", ".")


def com_unidade(v: float, unidade: str) -> str:
    return f"{br(v)}%" if unidade == "%" else f"{br(v)} {unidade}".rstrip()


def _resolver(precos, faixas, linhas):
    """Frações de menor custo que somam 1, ou None se não houver. linhas: (coeficientes, mín, máx)."""
    a_ub, b_ub = [], []
    for coef, minimo, maximo in linhas:
        if maximo is not None:
            a_ub.append(coef)
            b_ub.append(maximo)
        if minimo is not None:
            a_ub.append([-c for c in coef])
            b_ub.append(-minimo)
    r = linprog(precos, A_ub=a_ub or None, b_ub=b_ub or None, A_eq=[[1.0] * len(precos)], b_eq=[1.0],
                bounds=faixas, method="highs")
    if r.status == 2:
        return None
    if r.status != 0:
        raise RuntimeError(f"O otimizador parou sem resposta: {r.message}")
    # float() tira o tipo do NumPy, que o JSON da API não serializa
    return [max(0.0, float(v)) for v in r.x]


def _no_limite(v, minimo, maximo):
    """'min' ou 'max' quando o valor encosta no limite (restrição ativa), senão None."""
    if minimo is not None and abs(v - minimo) <= 1e-6 * max(1.0, abs(minimo)):
        return "min"
    if maximo is not None and abs(v - maximo) <= 1e-6 * max(1.0, abs(maximo)):
        return "max"
    return None


def compor(materiais, limites, atributos, lote, unidade):
    """materiais: [{id, name, price, min_pct, max_pct, values: {attribute_id: valor}}]
    limites: [{attribute_id, min, max}]; atributos: {id: {name, unit}}.
    Quem chama garante que todo material tem valor para cada atributo limitado."""
    precos = [m["price"] for m in materiais]
    faixas = [(m["min_pct"] / 100, m["max_pct"] / 100) for m in materiais]
    linhas = [([m["values"][l["attribute_id"]] for m in materiais], l["min"], l["max"]) for l in limites]
    modelo = _modelo(materiais, limites, atributos, linhas)

    x = _resolver(precos, faixas, linhas)
    if x is None:
        return {"status": "no_solution", "message": SEM_SOLUCAO,
                "hints": _dicas(materiais, limites, atributos, precos, faixas, linhas), "model": modelo}

    lote_kg = lote * KG_POR_UNIDADE[unidade]
    custo_kg = sum(p * xi for p, xi in zip(precos, x))
    itens = [{
        "material_id": m["id"], "name": m["name"], "price_per_kg": m["price"],
        "pct": xi * 100, "quantity": xi * lote, "cost": m["price"] * xi * lote_kg,
        "min_pct": m["min_pct"], "max_pct": m["max_pct"],
        # inclusão 0% ou 100% não "prende" nada; só conta limite que a pessoa apertou
        "binding": _no_limite(xi * 100, m["min_pct"] if m["min_pct"] > 0 else None, m["max_pct"] if m["max_pct"] < 100 else None),
    } for m, xi in zip(materiais, x)]
    valores = [{
        "attribute_id": aid, "name": a["name"], "unit": a["unit"],
        "value": sum(m["values"][aid] * xi for m, xi in zip(materiais, x)),
    } for aid, a in atributos.items() if all(aid in m["values"] for m in materiais)]
    conferencia = []
    for l, (coef, minimo, maximo) in zip(limites, linhas):
        v = sum(c * xi for c, xi in zip(coef, x))
        a = atributos[l["attribute_id"]]
        conferencia.append({
            "attribute_id": l["attribute_id"], "name": a["name"], "unit": a["unit"], "min": minimo, "max": maximo, "value": v,
            "ok": (minimo is None or v >= minimo - 1e-6) and (maximo is None or v <= maximo + 1e-6),
            "binding": _no_limite(v, minimo, maximo),
        })
    return {
        "status": "optimal", "batch_size": lote, "batch_unit": unidade,
        "cost_per_kg": custo_kg, "cost_per_unit": custo_kg * KG_POR_UNIDADE[unidade], "total_cost": custo_kg * lote_kg,
        "items": itens, "attributes": valores, "limits": conferencia, "model": modelo,
    }


def _dicas(materiais, limites, atributos, precos, faixas, linhas):
    """Por que não fechou: primeiro o limite impossível sozinho, depois qual limite sobra."""
    dicas = []
    for l, (coef, minimo, maximo) in zip(limites, linhas):
        a = atributos[l["attribute_id"]]
        i_max = max(range(len(coef)), key=coef.__getitem__)
        i_min = min(range(len(coef)), key=coef.__getitem__)
        if minimo is not None and minimo > coef[i_max] + 1e-9:
            dicas.append(f"Nenhum material chega a {com_unidade(minimo, a['unit'])} de {a['name']}: "
                         f"o maior é {materiais[i_max]['name']}, com {com_unidade(coef[i_max], a['unit'])}.")
        if maximo is not None and maximo < coef[i_min] - 1e-9:
            dicas.append(f"Todos os materiais passam de {com_unidade(maximo, a['unit'])} de {a['name']}: "
                         f"o menor é {materiais[i_min]['name']}, com {com_unidade(coef[i_min], a['unit'])}.")
    if dicas:
        return dicas
    for k, l in enumerate(limites):
        if _resolver(precos, faixas, linhas[:k] + linhas[k + 1:]) is not None:
            dicas.append(f"Sem o limite de {atributos[l['attribute_id']]['name']}, já existe composição.")
    if _resolver(precos, [(0.0, 1.0)] * len(precos), linhas) is not None:
        dicas.append("As inclusões mínimas e máximas dos materiais estão travando: soltas, existe composição.")
    return dicas or ["Os limites não fecham juntos. Afrouxe algum limite ou inclua outro material."]


def _modelo(materiais, limites, atributos, linhas):
    """As regras do cálculo em texto, para a tela mostrar de onde veio o resultado."""
    var = [f"x{i + 1}" for i in range(len(materiais))]

    def soma(coefs):
        return " + ".join(f"{br(c, 4)}·{v}" for c, v in zip(coefs, var) if c) or "0"

    restricoes = [f"{' + '.join(var)} = 1  (a mistura fecha 100%)"]
    restricoes += [f"{br(m['min_pct'])}% ≤ {v} ≤ {br(m['max_pct'])}%  ({m['name']})" for v, m in zip(var, materiais)]
    for l, (coef, minimo, maximo) in zip(limites, linhas):
        a = atributos[l["attribute_id"]]
        lados = [f"{br(minimo, 4)} ≤" if minimo is not None else "", soma(coef), f"≤ {br(maximo, 4)}" if maximo is not None else ""]
        restricoes.append(f"{' '.join(s for s in lados if s)}  ({a['name']}{', ' + a['unit'] if a['unit'] else ''})")
    return {
        "variables": [f"{v} = fração de {m['name']} na mistura" for v, m in zip(var, materiais)],
        "objective": f"Minimizar o custo por kg = {soma([m['price'] for m in materiais])}",
        "constraints": restricoes,
        "assumption": PREMISSA,
    }
