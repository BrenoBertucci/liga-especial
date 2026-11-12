import { useState, type FormEvent } from 'react';

import { api, ErroApi, useCarregar, type Atributo } from '../api';
import { Cabecalho, Carregando, Falha, Vazio } from '../componentes';

export default function Atributos() {
  const r = useCarregar(() => api.atributos(), []);
  const [novo, setNovo] = useState({ name: '', unit: '' });
  const [erro, setErro] = useState<ErroApi>();

  async function rodar(acao: () => Promise<unknown>) {
    setErro(undefined);
    try {
      await acao();
      r.recarregar();
    } catch (e) {
      setErro(e as ErroApi);
    }
  }

  function criar(e: FormEvent) {
    e.preventDefault();
    rodar(async () => {
      await api.salvarAtributo(novo);
      setNovo({ name: '', unit: '' });
    });
  }

  return (
    <div className="pagina estreita">
      <Cabecalho titulo="Atributos técnicos" sub="Medidas que você quer controlar na composição: teores, umidade, pureza, densidade…" />
      <form className="card form linha-form" onSubmit={criar}>
        <label className="campo grow">Nome<input required maxLength={80} placeholder="Ex.: Umidade" value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} /></label>
        <label className="campo unidade">Unidade<input maxLength={20} placeholder="%" value={novo.unit} onChange={(e) => setNovo({ ...novo, unit: e.target.value })} /></label>
        <button className="btn prim">Adicionar</button>
      </form>
      <p className="dica">Só atributos numéricos. Na mistura, o valor é a média dos materiais ponderada pela massa.</p>
      {erro ? <Falha erro={erro} /> : null}
      {r.carregando ? <Carregando /> : r.erro ? <Falha erro={r.erro} tentar={r.recarregar} /> : (r.dados ?? []).length === 0 ? (
        <Vazio titulo="Nenhum atributo ainda" texto="Adicione o primeiro acima." />
      ) : (
        <ul className="card lista">
          {(r.dados ?? []).map((a) => <LinhaAtributo key={a.id} a={a} rodar={rodar} />)}
        </ul>
      )}
    </div>
  );
}

function LinhaAtributo({ a, rodar }: { a: Atributo; rodar: (acao: () => Promise<unknown>) => void }) {
  const [nome, setNome] = useState(a.name);
  const [unidade, setUnidade] = useState(a.unit);
  const mudou = nome !== a.name || unidade !== a.unit;
  const excluir = () => {
    if (confirm(`Excluir "${a.name}"? Os valores dele nos materiais e os limites nas fórmulas também serão apagados.`)) {
      rodar(() => api.excluirAtributo(a.id));
    }
  };
  return (
    <li className="linha-form">
      <input aria-label="Nome do atributo" className="grow" value={nome} onChange={(e) => setNome(e.target.value)} />
      <input aria-label={`Unidade de ${a.name}`} className="unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
      <button className="btn sec peq" disabled={!mudou || !nome.trim()} onClick={() => rodar(() => api.salvarAtributo({ name: nome, unit: unidade }, a.id))}>Salvar</button>
      <button className="btn perigo peq" onClick={excluir}>Excluir</button>
    </li>
  );
}
