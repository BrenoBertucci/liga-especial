// O que sai do cálculo: composição ótima, quadro de limites, sem solução e as regras usadas
import { comUnidade, CORES, dinheiro, num, type Modelo, type Otimo, type SemSolucao } from '../api';

const ROTULO_ATIVO = { min: 'no mínimo', max: 'no máximo' };

export function PainelResultado({ r }: { r: Otimo }) {
  const usados = r.items.filter((i) => i.pct > 1e-6);
  const fora = r.items.filter((i) => i.pct <= 1e-6);
  const limitados = new Set(r.limits.map((l) => l.attribute_id));
  const outros = r.attributes.filter((a) => !limitados.has(a.attribute_id));
  return (
    <div className="resultado">
      <div className="hero">
        <span className="selo bom">Solução ótima</span>
        <p className="hero-rot">Custo por {r.batch_unit}</p>
        <p className="hero-valor">{dinheiro(r.cost_per_unit)}</p>
        <dl className="hero-linha">
          <div><dt>Lote</dt><dd>{num(r.batch_size)} {r.batch_unit}</dd></div>
          <div><dt>Custo do lote</dt><dd>{dinheiro(r.total_cost)}</dd></div>
          <div><dt>Materiais</dt><dd>{usados.length} de {r.items.length}</dd></div>
        </dl>
      </div>

      <h3>Composição</h3>
      <div className="barra" aria-hidden="true">
        {usados.map((i, k) => <i key={i.material_id} style={{ flexGrow: i.pct, background: CORES[k % CORES.length] }} />)}
      </div>
      <div className="rolar">
        <table className="tabela">
          <thead><tr><th>Material</th><th className="n">%</th><th className="n">Quantidade</th><th className="n">Custo</th></tr></thead>
          <tbody>
            {usados.map((i, k) => (
              <tr key={i.material_id}>
                <th scope="row">
                  <span className="ponto" style={{ background: CORES[k % CORES.length] }} />{i.name}
                  {i.binding ? <span className="chip aviso-chip">{ROTULO_ATIVO[i.binding]}</span> : null}
                </th>
                <td className="n">{num(i.pct)}%</td>
                <td className="n">{num(i.quantity, 3)} {r.batch_unit}</td>
                <td className="n">{dinheiro(i.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fora.length > 0 ? <p className="dica">Fora da mistura: {fora.map((i) => i.name).join(', ')}.</p> : null}

      <h3>Limites x obtido</h3>
      {r.limits.length === 0 ? <p className="dica">Esta fórmula não limita nenhum atributo.</p> : (
        <div className="rolar">
          <table className="tabela">
            <thead><tr><th>Atributo</th><th className="n">Mínimo</th><th className="n">Obtido</th><th className="n">Máximo</th><th>Situação</th></tr></thead>
            <tbody>
              {r.limits.map((l) => (
                <tr key={l.attribute_id}>
                  <th scope="row">{l.name}</th>
                  <td className="n">{l.min === null ? '—' : comUnidade(l.min, l.unit)}</td>
                  <td className="n"><b>{comUnidade(l.value, l.unit)}</b></td>
                  <td className="n">{l.max === null ? '—' : comUnidade(l.max, l.unit)}</td>
                  <td>
                    <span className={`chip ${l.ok ? 'bom' : 'ruim'}`}>{l.ok ? 'Atende' : 'Fora'}</span>
                    {l.binding ? <span className="chip aviso-chip" title="Esse limite está segurando o custo">restritivo · {ROTULO_ATIVO[l.binding]}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {outros.length > 0 ? (
        <p className="dica">Outros atributos da mistura: {outros.map((a) => `${a.name} ${comUnidade(a.value, a.unit)}`).join(' · ')}.</p>
      ) : null}
      <Regras modelo={r.model} />
    </div>
  );
}

export function PainelSemSolucao({ r, revisar }: { r: SemSolucao; revisar: () => void }) {
  return (
    <div className="resultado">
      <div className="vazio ruim" role="alert">
        <b>{r.message}</b>
        <ul>{r.hints.map((d) => <li key={d}>{d}</li>)}</ul>
        <button className="btn prim" onClick={revisar}>Revisar limites</button>
      </div>
      <Regras modelo={r.model} />
    </div>
  );
}

function Regras({ modelo }: { modelo: Modelo }) {
  return (
    <details className="regras">
      <summary>Regras do cálculo</summary>
      <p>{modelo.objective}</p>
      <p className="dica">Sujeito a:</p>
      <ul className="mono">{modelo.constraints.map((c) => <li key={c}>{c}</li>)}</ul>
      <ul className="dica">{modelo.variables.map((v) => <li key={v}>{v}</li>)}</ul>
      <p className="dica">{modelo.assumption}</p>
    </details>
  );
}
