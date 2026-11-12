import { Link } from 'react-router-dom';

import { api, useCarregar } from '../api';
import { Falha } from '../componentes';

const PASSOS = [
  ['Cadastre os materiais', 'Preço por kg e os atributos técnicos de cada um.'],
  ['Defina os limites', 'Inclusão de cada material e faixa de cada atributo.'],
  ['Calcule a composição', 'O otimizador encontra a mistura de menor custo.'],
];

export default function Inicio() {
  const r = useCarregar(() => Promise.all([api.materiais(), api.atributos(), api.formulas()]), []);
  const [materiais, atributos, formulas] = r.dados ?? [[], [], []];
  return (
    <div className="pagina">
      <section className="hero inicio">
        <p className="eyebrow">Otimização de composições</p>
        <h1>Liga Especial</h1>
        <p className="hero-sub">Monte a composição de menor custo que respeita os limites técnicos do seu produto.</p>
        <div className="acoes">
          <Link className="btn prim" to="/formulas/nova">Nova fórmula</Link>
          <Link className="btn claro" to="/formulas">Fórmulas salvas</Link>
        </div>
      </section>

      <ol className="grade tres passos-inicio">
        {PASSOS.map(([titulo, texto], i) => (
          <li key={titulo} className="card"><span className="numero">{i + 1}</span><b>{titulo}</b><p>{texto}</p></li>
        ))}
      </ol>

      {r.erro ? <Falha erro={r.erro} tentar={r.recarregar} /> : (
        <div className="grade tres">
          <Link className="card numero-grande" to="/materiais"><span>{r.carregando ? '…' : materiais.length}</span>materiais</Link>
          <Link className="card numero-grande" to="/atributos"><span>{r.carregando ? '…' : atributos.length}</span>atributos técnicos</Link>
          <Link className="card numero-grande" to="/formulas"><span>{r.carregando ? '…' : formulas.length}</span>fórmulas salvas</Link>
        </div>
      )}

      {formulas.length > 0 ? (
        <section className="card">
          <h2>Abertas recentemente</h2>
          <ul className="lista">
            {formulas.slice(0, 3).map((f) => (
              <li key={f.id}><Link to={`/formulas/${f.id}`}>{f.name}</Link><span className="dica">{f.item_count} materiais · {f.limit_count} limites</span></li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
