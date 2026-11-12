// Nova fórmula / fórmula salva: 1. materiais e inclusões, 2. limites e lote, 3. resultado.
// No celular um passo por vez; a partir de 700 px os três painéis ficam lado a lado.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api, dinheiro, ErroApi, lerNumero, num, useCarregar, type Entrada, type Formula as FormulaSalva, type Resultado } from '../api';
import { AvisoDaNavegacao, Cabecalho, Carregando, Falha, Vazio } from '../componentes';
import { PainelResultado, PainelSemSolucao } from './Resultado';

type Faixa = { min: string; max: string };
type Passo = 'materiais' | 'limites' | 'resultado';
const PASSOS: [Passo, string][] = [['materiais', 'Materiais'], ['limites', 'Limites'], ['resultado', 'Resultado']];

const texto = (v: number | null) => (v === null ? '' : String(v));

function entradaDe(f: FormulaSalva): Entrada {
  return { batch_size: f.batch_size, batch_unit: f.batch_unit, items: f.items, limits: f.limits };
}

export default function Formula() {
  const { id } = useParams();
  const salva = id ? Number(id) : undefined;
  const navegar = useNavigate();
  const base = useCarregar(() => Promise.all([api.materiais(), api.atributos(), salva ? api.formula(salva) : Promise.resolve(null)]), [salva]);

  const [nome, setNome] = useState('');
  const [lote, setLote] = useState('1000');
  const [unidade, setUnidade] = useState<'kg' | 't'>('kg');
  const [itens, setItens] = useState<Record<number, Faixa>>({});
  const [limites, setLimites] = useState<Record<number, Faixa>>({});
  const [passo, setPasso] = useState<Passo>('materiais');
  const [calculo, setCalculo] = useState<{ ocupado?: boolean; resultado?: Resultado; erro?: ErroApi; de?: string }>({});
  const [envio, setEnvio] = useState<{ ocupado?: boolean; ok?: string; erro?: ErroApi }>({});

  const entrada: Entrada = {
    batch_size: lerNumero(lote) ?? 0,
    batch_unit: unidade,
    items: Object.entries(itens).map(([mid, f]) => ({ material_id: Number(mid), min_pct: lerNumero(f.min) ?? 0, max_pct: lerNumero(f.max) ?? 100 })),
    limits: Object.entries(limites)
      .filter(([, f]) => f.min.trim() !== '' || f.max.trim() !== '')
      .map(([aid, f]) => ({ attribute_id: Number(aid), min_value: lerNumero(f.min), max_value: lerNumero(f.max) })),
  };

  async function calcular(e: Entrada = entrada) {
    const de = JSON.stringify(e);
    setPasso('resultado');
    setCalculo({ ocupado: true, de });
    try {
      setCalculo({ resultado: await api.calcular(e), de });
    } catch (erro) {
      setCalculo({ erro: erro as ErroApi, de });
    }
  }

  // Fórmula salva: preenche os campos e já mostra o resultado com os preços de hoje
  useEffect(() => {
    const f = base.dados?.[2];
    if (!f) return;
    setNome(f.name);
    setLote(String(f.batch_size));
    setUnidade(f.batch_unit);
    setItens(Object.fromEntries(f.items.map((i) => [i.material_id, { min: String(i.min_pct), max: String(i.max_pct) }])));
    setLimites(Object.fromEntries(f.limits.map((l) => [l.attribute_id, { min: texto(l.min_value), max: texto(l.max_value) }])));
    calcular(entradaDe(f));
    // calcular só usa a entrada que recebe
  }, [base.dados]);

  if (base.carregando) return <Carregando />;
  if (base.erro) return <Falha erro={base.erro} tentar={base.recarregar} />;
  const [materiais, atributos] = base.dados ?? [[], []];

  const somaMin = entrada.items.reduce((s, i) => s + i.min_pct, 0);
  const somaMax = entrada.items.reduce((s, i) => s + i.max_pct, 0);
  const somaRuim = entrada.items.length > 0 && (somaMin > 100 || somaMax < 100);
  const semValor = (aid: number) => materiais.filter((m) => itens[m.id] && !m.values.some((v) => v.attribute_id === aid)).map((m) => m.name);
  const desatualizado = calculo.de !== undefined && !calculo.ocupado && calculo.de !== JSON.stringify(entrada);

  const alternar = (mid: number) => {
    const novo = { ...itens };
    if (novo[mid]) delete novo[mid];
    else novo[mid] = { min: '0', max: '100' };
    setItens(novo);
  };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setEnvio({ ocupado: true });
    try {
      const f = await api.salvarFormula({ ...entrada, name: nome }, salva);
      setEnvio({ ok: 'Fórmula salva.' });
      if (!salva) navegar(`/formulas/${f.id}`, { replace: true, state: { aviso: 'Fórmula salva.' } });
    } catch (erro) {
      setEnvio({ erro: erro as ErroApi });
    }
  }

  return (
    <div className="pagina larga">
      <Cabecalho titulo={salva ? nome || 'Fórmula' : 'Nova fórmula'} sub="Escolha os materiais, defina os limites e calcule a composição de menor custo.">
        <Link className="btn sec" to="/formulas">Fórmulas salvas</Link>
      </Cabecalho>
      <AvisoDaNavegacao />

      <ol className="passos" aria-label="Etapas">
        {PASSOS.map(([p, rotulo], i) => (
          <li key={p}>
            <button className={passo === p ? 'ativo' : ''} aria-current={passo === p ? 'step' : undefined} onClick={() => setPasso(p)}>
              <span>{i + 1}</span>{rotulo}
            </button>
          </li>
        ))}
      </ol>

      <div className="editor">
        <section className={`painel card ${passo === 'materiais' ? 'ativo' : ''}`} aria-labelledby="t-materiais">
          <h2 id="t-materiais">1. Materiais</h2>
          {materiais.length === 0 ? (
            <Vazio titulo="Nenhum material cadastrado" texto="Cadastre materiais para montar a fórmula.">
              <Link className="btn prim" to="/materiais/novo">Novo material</Link>
            </Vazio>
          ) : (
            <ul className="selecao">
              {materiais.map((m) => {
                const f = itens[m.id];
                const invertido = f && (lerNumero(f.min) ?? 0) > (lerNumero(f.max) ?? 100);
                return (
                  <li key={m.id} className={f ? 'marcado' : ''}>
                    <label className="linha">
                      <input type="checkbox" checked={!!f} onChange={() => alternar(m.id)} />
                      <span className="grow">{m.name}</span>
                      <span className="dica">{dinheiro(m.price_per_kg)}/kg</span>
                    </label>
                    {f ? (
                      <div className={`faixa ${invertido ? 'ruim' : ''}`}>
                        <label>Inclusão mín. %<input type="number" min={0} max={100} step="any" value={f.min} onChange={(e) => setItens({ ...itens, [m.id]: { ...f, min: e.target.value } })} /></label>
                        <label>máx. %<input type="number" min={0} max={100} step="any" value={f.max} onChange={(e) => setItens({ ...itens, [m.id]: { ...f, max: e.target.value } })} /></label>
                        {invertido ? <small>mínimo acima do máximo</small> : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className={`soma ${somaRuim ? 'ruim' : ''}`}>
            {entrada.items.length} selecionados · mínimos somam {num(somaMin)}% · máximos somam {num(somaMax)}%
            {somaRuim ? '. Precisa caber 100%.' : ''}
          </p>
          <button className="btn prim so-celular" onClick={() => setPasso('limites')}>Próximo: limites</button>
        </section>

        <section className={`painel card ${passo === 'limites' ? 'ativo' : ''}`} aria-labelledby="t-limites">
          <h2 id="t-limites">2. Limites</h2>
          <div className="linha-form">
            <label className="campo grow">Tamanho do lote<input type="number" min={0} step="any" value={lote} onChange={(e) => setLote(e.target.value)} /></label>
            <label className="campo unidade">Unidade
              <select value={unidade} onChange={(e) => setUnidade(e.target.value as 'kg' | 't')}><option value="kg">kg</option><option value="t">t</option></select>
            </label>
          </div>
          {atributos.length === 0 ? <p className="dica">Nenhum atributo técnico cadastrado. <Link to="/atributos">Criar atributos</Link></p> : (
            <table className="tabela limites">
              <thead><tr><th>Atributo</th><th>Mínimo</th><th>Máximo</th></tr></thead>
              <tbody>
                {atributos.map((a) => {
                  const f = limites[a.id] ?? { min: '', max: '' };
                  const usado = f.min.trim() !== '' || f.max.trim() !== '';
                  const faltam = usado ? semValor(a.id) : [];
                  const invertido = usado && f.min.trim() !== '' && f.max.trim() !== '' && (lerNumero(f.min) ?? 0) > (lerNumero(f.max) ?? 0);
                  return (
                    <tr key={a.id} className={invertido || faltam.length ? 'ruim' : ''}>
                      <th scope="row">
                        {a.name}{a.unit ? <small> ({a.unit})</small> : null}
                        {invertido ? <small className="alerta">mínimo acima do máximo</small> : null}
                        {faltam.length ? <small className="alerta">sem valor em: {faltam.join(', ')}</small> : null}
                      </th>
                      <td><input aria-label={`Mínimo de ${a.name}`} type="number" step="any" placeholder="—" value={f.min} onChange={(e) => setLimites({ ...limites, [a.id]: { ...f, min: e.target.value } })} /></td>
                      <td><input aria-label={`Máximo de ${a.name}`} type="number" step="any" placeholder="—" value={f.max} onChange={(e) => setLimites({ ...limites, [a.id]: { ...f, max: e.target.value } })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="dica">Deixe em branco o lado que não tem limite.</p>
          <button className="btn prim" onClick={() => calcular()} disabled={calculo.ocupado || entrada.items.length === 0}>
            {calculo.ocupado ? 'Calculando…' : 'Calcular composição'}
          </button>
        </section>

        <section className={`painel card ${passo === 'resultado' ? 'ativo' : ''}`} aria-labelledby="t-resultado" aria-live="polite">
          <h2 id="t-resultado">3. Resultado</h2>
          {desatualizado ? (
            <p className="aviso">Os dados mudaram depois do cálculo. <button className="btn sec peq" onClick={() => calcular()}>Calcular de novo</button></p>
          ) : null}
          {calculo.ocupado ? <Carregando texto="Calculando a composição…" />
            : calculo.erro ? <Falha erro={calculo.erro} />
            : calculo.resultado?.status === 'optimal' ? <PainelResultado r={calculo.resultado} />
            : calculo.resultado?.status === 'no_solution' ? <PainelSemSolucao r={calculo.resultado} revisar={() => setPasso('limites')} />
            : <Vazio titulo="Ainda sem cálculo" texto="Escolha os materiais e os limites e toque em Calcular composição." />}

          <form className="salvar" onSubmit={salvar}>
            <label className="campo grow">Nome da fórmula<input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Liga padrão" /></label>
            <button className="btn prim" disabled={envio.ocupado || entrada.items.length === 0}>{salva ? 'Salvar alterações' : 'Salvar fórmula'}</button>
          </form>
          {envio.ok ? <p className="aviso bom" role="status">{envio.ok}</p> : null}
          {envio.erro ? <Falha erro={envio.erro} /> : null}
        </section>
      </div>
    </div>
  );
}
