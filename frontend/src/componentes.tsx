// Peças repetidas: cabeçalho de página, carregando, erro, vazio, aviso de sucesso e as peças da liga
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import type { Atributo, ErroApi, Material, Valor } from './api';
import { Icone, type NomeIcone } from './icones';

export function Cabecalho({ titulo, sub, eyebrow, children }: { titulo: string; sub?: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <header className="cab">
      <div className="cab-texto">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{titulo}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {children ? <div className="acoes">{children}</div> : null}
    </header>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return <p className="estado" role="status"><span className="giro" aria-hidden="true" /> {texto}</p>;
}

export function Falha({ erro, tentar }: { erro: ErroApi; tentar?: () => void }) {
  return (
    <div className="aviso ruim" role="alert">
      <b className="com-icone"><Icone nome="alert" tamanho={18} />{erro.message}</b>
      {erro.detalhes.length > 0 ? <ul>{erro.detalhes.map((d) => <li key={d}>{d}</li>)}</ul> : null}
      {tentar ? <button className="btn sec peq" onClick={tentar}>Tentar de novo</button> : null}
    </div>
  );
}

export function Vazio({ titulo, texto, icone = 'lingote', children }: { titulo: string; texto: string; icone?: NomeIcone; children?: ReactNode }) {
  return (
    <div className="vazio">
      <span className="vazio-ic"><Icone nome={icone} tamanho={28} /></span>
      <b>{titulo}</b>
      <p>{texto}</p>
      {children}
    </div>
  );
}

// Mensagem passada pela navegação (ex.: "Material salvo.") depois de salvar ou excluir
export function AvisoDaNavegacao() {
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  return aviso ? <p className="aviso bom" role="status">{aviso}</p> : null;
}

export function Logo({ grande = false }: { grande?: boolean }) {
  return <span className={`logo${grande ? ' xl' : ''}`} aria-hidden="true"><i /><i /><i /><i /></span>;
}

// Atributo com nome de elemento ganha símbolo, número atômico e cor; os outros (umidade, densidade…) não
// chave: classe CSS da superfície e da plaquinha (.fe, .c, .si, .ni)
const ELEMENTOS: Record<string, { simbolo: string; z: number; cor: string; chave: string }> = {
  ferro: { simbolo: 'Fe', z: 26, cor: 'var(--fe)', chave: 'fe' },
  carbono: { simbolo: 'C', z: 6, cor: 'var(--c)', chave: 'c' },
  carvao: { simbolo: 'C', z: 6, cor: 'var(--c)', chave: 'c' },
  silicio: { simbolo: 'Si', z: 14, cor: 'var(--si)', chave: 'si' },
  niquel: { simbolo: 'Ni', z: 28, cor: 'var(--ni)', chave: 'ni' },
};

// Tira os acentos: "Níquel" e "niquel" caem no mesmo elemento
export function elemento(nome = '') {
  return ELEMENTOS[nome.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()];
}

// Cartão com a superfície do material (grafite, aço escovado, níquel, silício); vazio para umidade, densidade…
export const metal = (nome: string) => {
  const e = elemento(nome);
  return e ? `metal ${e.chave}` : '';
};

// Plaquinha da tabela periódica em vidro e metal; decorativa, o nome já está escrito ao lado
export function Plaquinha({ nome, tamanho }: { nome: string; tamanho?: 'peq' | 'grande' }) {
  const e = elemento(nome);
  if (!e) return null;
  return (
    <span className={`plaquinha ${e.chave} ${tamanho ?? ''}`} aria-hidden="true">
      {tamanho === 'peq' ? null : <small>{e.z}</small>}{e.simbolo}
    </span>
  );
}

// Material puro (99,5% ou mais de um elemento) usa a cor e a superfície do elemento; os misturados, as de liga
const MISTURAS = ['mr1', 'mr2', 'mr3', 'mr4'];

export function chavesDosMateriais(materiais: Material[], atributos: Atributo[]) {
  const nomes = new Map(atributos.map((a) => [a.id, a.name]));
  let misturados = 0;
  return new Map(materiais.map((m) => {
    const puro = m.values.map((v) => (v.value >= 99.5 ? elemento(nomes.get(v.attribute_id)) : undefined)).find(Boolean);
    return [m.id, puro ? puro.chave : MISTURAS[misturados++ % MISTURAS.length]];
  }));
}

export const coresDosMateriais = (materiais: Material[], atributos: Atributo[]) =>
  new Map([...chavesDosMateriais(materiais, atributos)].map(([id, chave]) => [id, `var(--${chave})`]));

// Barrinha com o teor de cada elemento do material, na cor do elemento
export function BarraComposicao({ valores, atributos, altura = 8 }: { valores: Valor[]; atributos: Atributo[]; altura?: number }) {
  const nomes = new Map(atributos.map((a) => [a.id, a.name]));
  const partes = valores
    .map((v) => ({ v: v.value, e: elemento(nomes.get(v.attribute_id)) }))
    .filter((p) => p.e && p.v > 0);
  if (partes.length === 0) return null;
  return (
    <span className="compbar" style={{ height: altura }} aria-hidden="true">
      {partes.map((p) => <i key={p.e!.simbolo} style={{ flexGrow: p.v, background: p.e!.cor }} />)}
    </span>
  );
}
