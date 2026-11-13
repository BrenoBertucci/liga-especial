// O que sai do cálculo: receita ótima, faixa de cada limite, calculando, sem solução e as regras usadas
import { comUnidade, dinheiro, num, type Modelo, type Otimo, type SemSolucao } from '../api';
import { elemento, metal, Plaquinha } from '../componentes';
import { Icone } from '../icones';

const ROTULO_ATIVO = { min: 'no mínimo', max: 'no máximo' };
type LimiteObtido = Otimo['limits'][number];

// Faixa permitida ocupa de 10% a 90% da trilha; lado sem limite vai até a ponta
function posicoes(l: LimiteObtido) {
  const lo = l.min ?? Math.min(l.value, l.max ?? l.value);
  const hi = l.max ?? Math.max(l.value, l.min ?? l.value);
  const pos = 10 + (80 * (l.value - lo)) / (hi - lo || 1);
  return { esquerda: l.min === null ? 0 : 10, direita: l.max === null ? 0 : 10, marca: Math.min(98, Math.max(2, pos)) };
}

function LinhaLimite({ l, unidade }: { l: LimiteObtido; unidade: string }) {
  const cor = elemento(l.name)?.cor ?? 'var(--text)';
  const p = posicoes(l);
  return (
    <div className={`rng ${metal(l.name)}`}>
      <div className="rng-top">
        {elemento(l.name) ? <Plaquinha nome={l.name} /> : <span className="dot" style={{ background: cor }} />}<b>{l.name}</b>
        <span className="val">{comUnidade(l.value, unidade)}</span>
        <span className={`chip ${l.ok ? 'bom' : 'ruim'}`}>{l.ok ? <Icone nome="check" tamanho={12} /> : null}{l.ok ? 'Atende' : 'Fora'}</span>
      </div>
      <div className="track" aria-hidden="true">
        <div className="band" style={{ left: `${p.esquerda}%`, right: `${p.direita}%` }} />
        <div className="mark" style={{ left: `${p.marca}%`, background: cor }} />
      </div>
      <div className="rng-lbl">
        <span className={l.binding === 'min' ? 'ativo' : ''}>{l.min === null ? 'sem mínimo' : `mín ${comUnidade(l.min, unidade)}`}{l.binding === 'min' ? ' · no limite' : ''}</span>
        <span className={l.binding === 'max' ? 'ativo' : ''}>{l.max === null ? 'sem máximo' : `máx ${comUnidade(l.max, unidade)}`}{l.binding === 'max' ? ' · no limite' : ''}</span>
      </div>
    </div>
  );
}

export function PainelResultado({ r, cores }: { r: Otimo; cores: Map<number, string> }) {
  const usados = r.items.filter((i) => i.pct > 1e-6).sort((a, b) => b.pct - a.pct);
  const fora = r.items.filter((i) => i.pct <= 1e-6);
  const limitados = new Set(r.limits.map((l) => l.attribute_id));
  const outros = r.attributes.filter((a) => !limitados.has(a.attribute_id));
  const atendem = r.limits.filter((l) => l.ok).length;
  return (
    <div className="resultado">
      <div className="hero">
        <div className="hero-top">
          <span className="pill"><Icone nome="check" tamanho={14} />Solução ótima</span>
          <span className="hm">Programação linear</span>
        </div>
        <p className="hero-rot">Custo mínimo</p>
        <p className="hero-valor">{dinheiro(r.cost_per_unit)}<small>/{r.batch_unit}</small></p>
        <dl className="hero-linha">
          <div><dt>Lote</dt><dd>{num(r.batch_size)} {r.batch_unit}</dd></div>
          <div><dt>Custo do lote</dt><dd>{dinheiro(r.total_cost)}</dd></div>
          <div><dt>Materiais</dt><dd>{usados.length} de {r.items.length}</dd></div>
        </dl>
      </div>

      <section className="card receita" aria-labelledby="t-receita">
        <div className="card-h"><h3 id="t-receita">Receita</h3><span className="dica">para {num(r.batch_size)} {r.batch_unit} de liga</span></div>
        <div className="lingote" aria-hidden="true">
          {usados.map((i) => <i key={i.material_id} style={{ flexGrow: i.pct, backgroundColor: cores.get(i.material_id) }} />)}
        </div>
        <ul className="lista">
          {usados.map((i) => (
            <li key={i.material_id}>
              <span className="sw" style={{ background: cores.get(i.material_id) }} />
              <span className="grow col2">
                <b>{i.name}{i.binding ? <span className="chip aviso-chip">{ROTULO_ATIVO[i.binding]}</span> : null}</b>
                <span className="dica">{dinheiro(i.price_per_kg)}/kg · custo {dinheiro(i.cost)}</span>
              </span>
              <span className="r-num"><b>{num(i.quantity, 3)} {r.batch_unit}</b><span className="dica">{num(i.pct)}%</span></span>
            </li>
          ))}
        </ul>
        {fora.length > 0 ? <p className="foot">Fora da mistura: {fora.map((i) => i.name).join(', ')}.</p> : null}
      </section>

      <section className="card" aria-labelledby="t-composicao">
        <div className="card-h"><h3 id="t-composicao">Composição da liga</h3>{r.limits.length ? <span className="dica">{atendem} de {r.limits.length} atendem</span> : null}</div>
        {r.limits.length === 0 ? <p className="dica">Esta fórmula não limita nenhum atributo.</p> : (
          <div className="pilha">{r.limits.map((l) => <LinhaLimite key={l.attribute_id} l={l} unidade={l.unit} />)}</div>
        )}
        {outros.length > 0 ? (
          <p className="foot">Outros atributos da mistura: {outros.map((a) => `${a.name} ${comUnidade(a.value, a.unit)}`).join(' · ')}.</p>
        ) : null}
      </section>
      <Regras modelo={r.model} />
    </div>
  );
}

// Mesmo desenho do resultado, com os números em esqueleto enquanto o otimizador roda
export function HeroCalculando() {
  const esqueleto = (w: number, h = 14) => <span className="skel" style={{ width: w, height: h }} />;
  return (
    <div className="resultado" role="status">
      <div className="hero">
        <div className="hero-top">
          <span className="pill carregando"><i className="pulso" aria-hidden="true" />Calculando a mistura…</span>
          <span className="hm">Programação linear</span>
        </div>
        <p className="hero-rot">Custo mínimo</p>
        <p className="hero-valor" aria-hidden="true">{esqueleto(196, 40)}</p>
        <div className="hero-linha" aria-hidden="true">
          <div><span className="hero-rot">Lote</span>{esqueleto(56)}</div>
          <div><span className="hero-rot">Custo do lote</span>{esqueleto(70)}</div>
          <div><span className="hero-rot">Materiais</span>{esqueleto(44)}</div>
        </div>
      </div>
    </div>
  );
}

export function PainelSemSolucao({ r, minimos, revisar }: { r: SemSolucao; minimos: { nome: string; valor: number }[]; revisar: () => void }) {
  const soma = minimos.reduce((s, m) => s + m.valor, 0);
  const escala = Math.max(110, soma + 3);
  return (
    <div className="resultado">
      <div className="vazio-erro" role="alert">
        <span className="vazio-ic"><Icone nome="alert" tamanho={30} /></span>
        <h3>{r.message}</h3>
        <ul>{r.hints.map((d) => <li key={d}>{d}</li>)}</ul>
      </div>
      {/* Teores de elementos diferentes não passam de 100% juntos: aqui a conta já não fecha */}
      {soma > 100 ? (
        <section className="card" aria-labelledby="t-minimos">
          <div className="card-h"><h3 id="t-minimos">Mínimos definidos</h3><span className="chip ruim">{num(soma)}% de 100%</span></div>
          <div className="ovr" aria-hidden="true">
            <div className="ovr-bar">{minimos.map((m) => <i key={m.nome} style={{ width: `${(m.valor / escala) * 100}%`, background: elemento(m.nome)?.cor }} />)}</div>
            <div className="ovr-cap" style={{ left: `${(100 / escala) * 100}%` }}><span>100%</span></div>
          </div>
          <ul className="lista">
            {minimos.map((m) => (
              <li key={m.nome}><span className="dot" style={{ background: elemento(m.nome)?.cor }} /><span className="grow">{m.nome}</span><b>{num(m.valor)}%</b></li>
            ))}
          </ul>
          <p className="foot">Os mínimos somam mais que a liga inteira. Baixe algum deles.</p>
        </section>
      ) : null}
      <button className="btn prim bloco" onClick={revisar}><Icone nome="sliders" tamanho={18} />Revisar limites</button>
      <Regras modelo={r.model} />
    </div>
  );
}

function Regras({ modelo }: { modelo: Modelo }) {
  return (
    <details className="regras">
      <summary><Icone nome="sigma" tamanho={18} />Regras do cálculo</summary>
      <p className="math">{modelo.objective}</p>
      <p className="dica">Sujeito a:</p>
      <ul className="math">{modelo.constraints.map((c) => <li key={c}>{c}</li>)}</ul>
      <ul className="dica">{modelo.variables.map((v) => <li key={v}>{v}</li>)}</ul>
      <p className="dica">{modelo.assumption}</p>
    </details>
  );
}
