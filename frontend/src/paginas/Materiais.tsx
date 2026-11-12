import { Link } from 'react-router-dom';

import { api, comUnidade, dinheiro, useCarregar } from '../api';
import { AvisoDaNavegacao, Cabecalho, Carregando, Falha, Vazio } from '../componentes';

export default function Materiais() {
  const r = useCarregar(() => Promise.all([api.materiais(), api.atributos()]), []);
  const [materiais, atributos] = r.dados ?? [[], []];
  const nomeDe = new Map(atributos.map((a) => [a.id, a]));

  return (
    <div className="pagina">
      <Cabecalho titulo="Materiais" sub="Preço e atributos técnicos de cada material.">
        <Link className="btn sec" to="/atributos">Atributos</Link>
        <Link className="btn prim" to="/materiais/novo">Novo material</Link>
      </Cabecalho>
      <AvisoDaNavegacao />
      {r.carregando ? <Carregando /> : r.erro ? <Falha erro={r.erro} tentar={r.recarregar} /> : materiais.length === 0 ? (
        <Vazio titulo="Nenhum material ainda" texto="Cadastre o primeiro material para montar fórmulas.">
          <Link className="btn prim" to="/materiais/novo">Novo material</Link>
        </Vazio>
      ) : (
        <ul className="grade cards">
          {materiais.map((m) => (
            <li key={m.id}>
              <Link className="card material" to={`/materiais/${m.id}`}>
                <span className="linha"><b>{m.name}</b><span className="preco">{dinheiro(m.price_per_kg)}<small>/kg</small></span></span>
                <span className="atributos">
                  {m.values.length === 0 ? 'Sem atributos preenchidos' : m.values.slice(0, 4).map((v) => {
                    const a = nomeDe.get(v.attribute_id);
                    return a ? `${a.name} ${comUnidade(v.value, a.unit)}` : null;
                  }).filter(Boolean).join(' · ')}
                  {m.values.length > 4 ? ` · +${m.values.length - 4}` : ''}
                </span>
                {m.notes ? <span className="dica">{m.notes}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
