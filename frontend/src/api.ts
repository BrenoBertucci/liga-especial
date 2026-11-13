// Tipos e chamadas da API. O Vite repassa /api para o FastAPI (porta 8000).
import { useEffect, useState } from 'react';

export type Atributo = { id: number; name: string; unit: string };
export type Valor = { attribute_id: number; value: number };
export type Material = { id: number; name: string; price_per_kg: number; notes: string | null; values: Valor[] };
export type Item = { material_id: number; min_pct: number; max_pct: number };
export type Limite = { attribute_id: number; min_value: number | null; max_value: number | null };
export type Entrada = { batch_size: number; batch_unit: 'kg' | 't'; items: Item[]; limits: Limite[] };
export type Formula = Entrada & { id: number; name: string; created_at: string; updated_at: string };
export type ResumoFormula = { id: number; name: string; batch_size: number; batch_unit: string; item_count: number; limit_count: number; updated_at: string };
export type Modelo = { variables: string[]; objective: string; constraints: string[]; assumption: string };
export type Ativo = 'min' | 'max' | null;
export type Otimo = {
  status: 'optimal'; batch_size: number; batch_unit: 'kg' | 't';
  cost_per_kg: number; cost_per_unit: number; total_cost: number;
  items: { material_id: number; name: string; price_per_kg: number; pct: number; quantity: number; cost: number; binding: Ativo }[];
  attributes: { attribute_id: number; name: string; unit: string; value: number }[];
  limits: { attribute_id: number; name: string; unit: string; min: number | null; max: number | null; value: number; ok: boolean; binding: Ativo }[];
  model: Modelo;
};
export type SemSolucao = { status: 'no_solution'; message: string; hints: string[]; model: Modelo };
export type Resultado = Otimo | SemSolucao;

export class ErroApi extends Error {
  detalhes: string[];
  constructor(mensagem: string, detalhes: string[] = [], opcoes?: ErrorOptions) {
    super(mensagem, opcoes);
    this.detalhes = detalhes;
  }
}

async function pedir<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api${caminho}`, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch (causa) {
    // Sem detalhe de porta ou endereço na tela: quem usa só precisa saber que o servidor não respondeu
    throw new ErroApi('Sem conexão com o servidor. Tente de novo em instantes.', [], { cause: causa });
  }
  if (r.status === 204) return undefined as T;
  const dados = await r.json().catch(() => null);
  if (!r.ok) {
    const e = dados?.error;
    const detalhes = (e?.details ?? []).map((d: { field?: string; issue: string }) => (d.field ? `${d.field}: ${d.issue}` : d.issue));
    throw new ErroApi(e?.message ?? `A API respondeu ${r.status}.`, detalhes);
  }
  return dados as T;
}

const salvar = <T,>(caminho: string, corpo: unknown, id?: number) => pedir<T>(id ? 'PUT' : 'POST', id ? `${caminho}/${id}` : caminho, corpo);

export const api = {
  atributos: () => pedir<Atributo[]>('GET', '/attributes'),
  salvarAtributo: (a: Omit<Atributo, 'id'>, id?: number) => salvar<Atributo>('/attributes', a, id),
  excluirAtributo: (id: number) => pedir<void>('DELETE', `/attributes/${id}`),
  materiais: () => pedir<Material[]>('GET', '/materials'),
  material: (id: number) => pedir<Material>('GET', `/materials/${id}`),
  salvarMaterial: (m: Omit<Material, 'id'>, id?: number) => salvar<Material>('/materials', m, id),
  excluirMaterial: (id: number) => pedir<void>('DELETE', `/materials/${id}`),
  formulas: () => pedir<ResumoFormula[]>('GET', '/formulas'),
  formula: (id: number) => pedir<Formula>('GET', `/formulas/${id}`),
  salvarFormula: (f: Entrada & { name: string }, id?: number) => salvar<Formula>('/formulas', f, id),
  excluirFormula: (id: number) => pedir<void>('DELETE', `/formulas/${id}`),
  calcular: (e: Entrada) => pedir<Resultado>('POST', '/calculations', e),
};

// Carrega dados da API com carregando/erro e um jeito de recarregar
export function useCarregar<T>(carregar: () => Promise<T>, deps: unknown[]) {
  const [estado, setEstado] = useState<{ dados?: T; erro?: ErroApi; carregando: boolean }>({ carregando: true });
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true, erro: undefined }));
    carregar().then(
      (dados) => vivo && setEstado({ dados, carregando: false }),
      (erro: ErroApi) => vivo && setEstado({ erro, carregando: false }),
    );
    return () => { vivo = false; };
    // carregar muda a cada render; quem chama diz do que depende
  }, [...deps, versao]);
  return { ...estado, recarregar: () => setVersao((v) => v + 1) };
}

export const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
// Abaixo de R$ 10 mostra até 4 casas: custo por kg como 0,2225 não pode virar 0,22
export const dinheiro = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: Math.abs(v) < 10 ? 4 : 2 });
export const comUnidade = (v: number, unidade: string) => (unidade === '%' ? `${num(v)}%` : `${num(v)} ${unidade}`.trim());
// Campo vazio = sem valor; vírgula também vale
export const lerNumero = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(',', '.')));
// Campo com algo que não é número ("sessenta", "1e999"): a tela avisa e o cálculo não sai, em vez de ignorar calado
export const numeroRuim = (s: string) => s.trim() !== '' && !Number.isFinite(lerNumero(s));
