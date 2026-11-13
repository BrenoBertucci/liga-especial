import { Link } from 'react-router-dom';

import { api, useCarregar } from '../api';
import { Falha, Logo } from '../componentes';
import { Icone } from '../icones';

const PASSOS = [
  ['Cadastre os materiais', 'Preço por kg e o teor de cada elemento.'],
  ['Defina os limites', 'Inclusão de cada material e a faixa de cada elemento.'],
  ['Calcule a mistura', 'O otimizador encontra a receita de menor custo.'],
];

// Lingote em perspectiva: frente, topo e lateral com o degradê de metal fundido
function Lingote({ x, y }: { x: number; y: number }) {
  const p = (pontos: number[][]) => pontos.map(([a, b]) => `${x + a},${y + b}`).join(' ');
  return (
    <g>
      <polygon points={p([[0, 0], [120, 0], [108, -34], [12, -34]])} fill="url(#lg-frente)" />
      <polygon points={p([[12, -34], [108, -34], [130, -48], [34, -48]])} fill="url(#lg-topo)" />
      <polygon points={p([[120, 0], [142, -14], [130, -48], [108, -34]])} fill="url(#lg-lado)" />
    </g>
  );
}

function Lingotes() {
  return (
    <svg className="lingotes" viewBox="0 0 300 180" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lg-frente" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7c46c" /><stop offset="1" stopColor="#d9782b" /></linearGradient>
        <linearGradient id="lg-topo" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffe2a6" /><stop offset="1" stopColor="#f2a93b" /></linearGradient>
        <linearGradient id="lg-lado" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b8642a" /><stop offset="1" stopColor="#7a4a1e" /></linearGradient>
        <radialGradient id="lg-brilho"><stop offset="0" stopColor="#f2a93b" stopOpacity="0.45" /><stop offset="1" stopColor="#f2a93b" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="150" cy="168" rx="150" ry="16" fill="url(#lg-brilho)" />
      <Lingote x={8} y={164} />
      <Lingote x={140} y={164} />
      <Lingote x={74} y={118} />
    </svg>
  );
}

export default function Inicio() {
  const r = useCarregar(() => Promise.all([api.materiais(), api.atributos(), api.formulas()]), []);
  const [materiais, atributos, formulas] = r.dados ?? [[], [], []];
  const contagem = (n: number) => (r.carregando ? '…' : n);
  return (
    <div className="pagina">
      <section className="hero inicio" aria-labelledby="t-inicio">
        <Lingotes />
        <Logo grande />
        <p className="eyebrow">Otimização de ligas</p>
        <h1 id="t-inicio">Liga Especial</h1>
        <p className="hero-sub">Calcule a mistura de menor custo que mantém a sua liga dentro da especificação.</p>
        <div className="acoes">
          <Link className="btn prim" to="/formulas/nova">Nova fórmula <Icone nome="chev" tamanho={18} /></Link>
          <Link className="btn claro" to="/formulas">Fórmulas salvas</Link>
        </div>
      </section>

      <ol className="grade tres passos-inicio">
        {PASSOS.map(([titulo, texto], i) => (
          <li key={titulo} className="card"><span className="selo-n">{i + 1}</span><span className="col2"><b>{titulo}</b><span className="dica">{texto}</span></span></li>
        ))}
      </ol>

      {r.erro ? <Falha erro={r.erro} tentar={r.recarregar} /> : (
        <div className="grade kpis">
          <Link className="card kpi" to="/materiais"><span><Icone nome="layers" tamanho={18} />Materiais</span><b>{contagem(materiais.length)}</b></Link>
          <Link className="card kpi" to="/atributos"><span><Icone nome="sliders" tamanho={18} />Atributos técnicos</span><b>{contagem(atributos.length)}</b></Link>
          <Link className="card kpi" to="/formulas"><span><Icone nome="cadinho" tamanho={18} />Fórmulas salvas</span><b>{contagem(formulas.length)}</b></Link>
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
