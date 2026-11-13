import { Link } from 'react-router-dom';

import { api, comUnidade, dinheiro, useCarregar } from '../api';
import { AvisoDaNavegacao, BarraComposicao, Cabecalho, Carregando, chavesDosMateriais, elemento, Falha, Plaquinha, Vazio } from '../componentes';
import { Icone } from '../icones';

export default function Materiais() {
  const r = useCarregar(() => Promise.all([api.materiais(), api.atributos()]), []);
  const [materiais, atributos] = r.dados ?? [[], []];
  const nomeDe = new Map(atributos.map((a) => [a.id, a]));
  const chaves = chavesDosMateriais(materiais, atributos);

  return (
    <div className="pagina">
      <Cabecalho eyebrow="Cadastro" titulo="Materiais" sub="Preço e composição de cada material. Toque em um para editar.">
        <Link className="btn sec" to="/atributos">Atributos</Link>
        <Link className="btn prim" to="/materiais/novo"><Icone nome="plus" tamanho={18} />Novo material</Link>
      </Cabecalho>
      <AvisoDaNavegacao />
      {r.carregando ? <Carregando /> : r.erro ? <Falha erro={r.erro} tentar={r.recarregar} /> : materiais.length === 0 ? (
        <Vazio titulo="Nenhum material ainda" texto="Cadastre o primeiro material para montar fórmulas." icone="layers">
          <Link className="btn prim" to="/materiais/novo">Novo material</Link>
        </Vazio>
      ) : (
        <ul className="grade cards">
          {materiais.map((m) => {
            // Teor zero não aparece no resumo; elemento vai pelo símbolo (Fe 60%)
            const resumo = m.values.filter((v) => v.value !== 0).map((v) => {
              const a = nomeDe.get(v.attribute_id);
              return a ? `${elemento(a.name)?.simbolo ?? a.name} ${comUnidade(v.value, a.unit)}` : null;
            }).filter(Boolean);
            // Puro mostra a plaquinha do elemento; mistura mostra um lingote
            const puro = m.values.map((v) => nomeDe.get(v.attribute_id)?.name).find((n, i) => m.values[i].value >= 99.5 && elemento(n));
            return (
              <li key={m.id}>
                <Link className={`material metal ${chaves.get(m.id)}`} to={`/materiais/${m.id}`}>
                  <span className="mc-top">
                    {puro ? <Plaquinha nome={puro} /> : <span className="plaquinha liga" aria-hidden="true"><Icone nome="lingote" tamanho={22} /></span>}
                    <span className="grow col2">
                      <b className="mc-nome">{m.name}</b>
                      <span className="preco">{dinheiro(m.price_per_kg)}<small>/kg</small></span>
                    </span>
                    <Icone nome="chev" tamanho={18} />
                  </span>
                  <BarraComposicao valores={m.values} atributos={atributos} />
                  <span className="atributos">{m.values.length === 0 ? 'Sem atributos preenchidos' : resumo.slice(0, 4).join(' · ')}
                    {resumo.length > 4 ? ` · +${resumo.length - 4}` : ''}
                  </span>
                  {m.notes ? <span className="dica" title={m.notes}>{m.notes}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
