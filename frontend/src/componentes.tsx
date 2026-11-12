// Peças repetidas: cabeçalho de página, carregando, erro, vazio e aviso de sucesso
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import type { ErroApi } from './api';

export function Cabecalho({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="cab">
      <div>
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
      <b>{erro.message}</b>
      {erro.detalhes.length > 0 ? <ul>{erro.detalhes.map((d) => <li key={d}>{d}</li>)}</ul> : null}
      {tentar ? <button className="btn sec peq" onClick={tentar}>Tentar de novo</button> : null}
    </div>
  );
}

export function Vazio({ titulo, texto, children }: { titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="vazio">
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
