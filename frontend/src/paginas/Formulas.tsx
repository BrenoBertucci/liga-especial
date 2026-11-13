import { useState } from 'react';
import { Link } from 'react-router-dom';

import { api, ErroApi, num, useCarregar } from '../api';
import { AvisoDaNavegacao, Cabecalho, Carregando, Falha, Vazio } from '../componentes';
import { Icone } from '../icones';

export default function Formulas() {
  const r = useCarregar(() => api.formulas(), []);
  const [erro, setErro] = useState<ErroApi>();

  async function excluir(id: number, nome: string) {
    if (!confirm(`Excluir a fórmula "${nome}"? Não dá para desfazer.`)) return;
    setErro(undefined);
    try {
      await api.excluirFormula(id);
      r.recarregar();
    } catch (e) {
      setErro(e as ErroApi);
    }
  }

  return (
    <div className="pagina">
      <Cabecalho eyebrow="Fórmulas" titulo="Fórmulas salvas" sub="Abra para ver, editar ou recalcular com os preços de hoje.">
        <Link className="btn prim" to="/formulas/nova"><Icone nome="plus" tamanho={18} />Nova fórmula</Link>
      </Cabecalho>
      <AvisoDaNavegacao />
      {erro ? <Falha erro={erro} /> : null}
      {r.carregando ? <Carregando /> : r.erro ? <Falha erro={r.erro} tentar={r.recarregar} /> : (r.dados ?? []).length === 0 ? (
        <Vazio titulo="Nenhuma fórmula salva" texto="Calcule uma mistura e salve para usar de novo." icone="cadinho">
          <Link className="btn prim" to="/formulas/nova">Nova fórmula</Link>
        </Vazio>
      ) : (
        <div className="rolar card">
          <table className="tabela">
            <thead><tr><th>Fórmula</th><th className="n">Lote</th><th className="n">Materiais</th><th className="n">Limites</th><th>Atualizada</th><th><span className="oculto">Ações</span></th></tr></thead>
            <tbody>
              {(r.dados ?? []).map((f) => (
                <tr key={f.id}>
                  <th scope="row"><Link to={`/formulas/${f.id}`}>{f.name}</Link></th>
                  <td className="n">{num(f.batch_size)} {f.batch_unit}</td>
                  <td className="n">{f.item_count}</td>
                  <td className="n">{f.limit_count}</td>
                  <td>{new Date(f.updated_at).toLocaleDateString('pt-BR')}</td>
                  <td className="acoes-linha">
                    <Link className="btn sec peq" to={`/formulas/${f.id}`}>Abrir</Link>
                    <button className="btn perigo peq" onClick={() => excluir(f.id, f.name)}><Icone nome="trash" tamanho={16} />Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
