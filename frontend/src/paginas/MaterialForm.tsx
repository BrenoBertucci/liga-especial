import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api, ErroApi, lerNumero, useCarregar } from '../api';
import { Cabecalho, Carregando, Falha } from '../componentes';

export default function MaterialForm() {
  const { id } = useParams();
  const editando = id ? Number(id) : undefined;
  const navegar = useNavigate();
  const r = useCarregar(() => Promise.all([api.atributos(), editando ? api.material(editando) : Promise.resolve(null)]), [editando]);
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [obs, setObs] = useState('');
  const [valores, setValores] = useState<Record<number, string>>({});
  const [envio, setEnvio] = useState<{ ocupado?: boolean; erro?: ErroApi }>({});

  useEffect(() => {
    const m = r.dados?.[1];
    if (!m) return;
    setNome(m.name);
    setPreco(String(m.price_per_kg));
    setObs(m.notes ?? '');
    setValores(Object.fromEntries(m.values.map((v) => [v.attribute_id, String(v.value)])));
  }, [r.dados]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setEnvio({ ocupado: true });
    const values = Object.entries(valores)
      .map(([aid, s]) => ({ attribute_id: Number(aid), value: lerNumero(s) }))
      .filter((v): v is { attribute_id: number; value: number } => v.value !== null);
    try {
      await api.salvarMaterial({ name: nome, price_per_kg: lerNumero(preco) ?? 0, notes: obs || null, values }, editando);
      navegar('/materiais', { state: { aviso: editando ? 'Material atualizado.' : 'Material cadastrado.' } });
    } catch (erro) {
      setEnvio({ erro: erro as ErroApi });
    }
  }

  async function excluir() {
    if (!editando || !confirm(`Excluir "${nome}"? Não dá para desfazer.`)) return;
    setEnvio({ ocupado: true });
    try {
      await api.excluirMaterial(editando);
      navegar('/materiais', { state: { aviso: 'Material excluído.' } });
    } catch (erro) {
      setEnvio({ erro: erro as ErroApi });
    }
  }

  if (r.carregando) return <Carregando />;
  if (r.erro) return <Falha erro={r.erro} tentar={r.recarregar} />;
  const atributos = r.dados?.[0] ?? [];

  return (
    <form className="pagina estreita" onSubmit={salvar}>
      <Cabecalho titulo={editando ? 'Editar material' : 'Novo material'} />
      <section className="card form">
        <label className="campo">Nome<input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label className="campo">Preço por kg (R$)<input required type="number" min={0} step="any" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} /></label>
        <label className="campo">Observação <small>(opcional)</small><textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></label>
      </section>

      <section className="card form">
        <div className="linha"><h2>Atributos técnicos</h2><Link to="/atributos">Gerenciar</Link></div>
        {atributos.length === 0 ? <p className="dica">Nenhum atributo cadastrado. Crie em Atributos e volte aqui.</p> : (
          <div className="grade duas">
            {atributos.map((a) => (
              <label key={a.id} className="campo">
                {a.name}{a.unit ? <small> ({a.unit})</small> : null}
                <input type="number" step="any" inputMode="decimal" placeholder="sem valor" value={valores[a.id] ?? ''}
                  onChange={(e) => setValores({ ...valores, [a.id]: e.target.value })} />
              </label>
            ))}
          </div>
        )}
        <p className="dica">Deixe em branco o que não se aplica. Um material sem valor não entra em fórmula que limita esse atributo.</p>
      </section>

      {envio.erro ? <Falha erro={envio.erro} /> : null}
      <div className="acoes fim">
        {editando ? <button type="button" className="btn perigo" onClick={excluir} disabled={envio.ocupado}>Excluir</button> : null}
        <Link className="btn sec" to="/materiais">Cancelar</Link>
        <button className="btn prim" disabled={envio.ocupado}>{envio.ocupado ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>
  );
}
