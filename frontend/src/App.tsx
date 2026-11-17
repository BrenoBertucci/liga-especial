import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';

import { api, SEM_SESSAO, type Conta, type ErroApi } from './api';
import { Carregando, Falha, Logo } from './componentes';
import { Icone, type NomeIcone } from './icones';
import Atributos from './paginas/Atributos';
import Entrar from './paginas/Entrar';
import Formula from './paginas/Formula';
import Formulas from './paginas/Formulas';
import Inicio from './paginas/Inicio';
import MaterialForm from './paginas/MaterialForm';
import Materiais from './paginas/Materiais';

const LINKS: { para: string; rotulo: string; icone: NomeIcone }[] = [
  { para: '/', rotulo: 'Início', icone: 'pie' },
  { para: '/materiais', rotulo: 'Materiais', icone: 'layers' },
  { para: '/formulas', rotulo: 'Fórmulas', icone: 'cadinho' },
  { para: '/atributos', rotulo: 'Atributos', icone: 'sliders' },
];

type Tema = 'claro' | 'escuro';

const NAO_ENCONTRADA = <p className="estado">Página não encontrada. <Link to="/">Voltar ao início</Link></p>;

// /formulas/abc, /formulas/0 e /materiais/xyz não viram cadastro novo: mostram que a página não existe
function SoComId({ children }: { children: ReactNode }) {
  return /^[1-9][0-9]*$/.test(useParams().id ?? '') ? children : NAO_ENCONTRADA;
}

function temaInicial(): Tema {
  try {
    const salvo = localStorage.getItem('tema');
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
  } catch {
    // modo privado: segue o sistema
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

// Rascunho de fórmula nova fica na aba: ao trocar de conta ele não passa de uma pessoa para outra
function limparRascunhos() {
  try {
    sessionStorage.clear();
  } catch {
    // modo privado: não há o que limpar
  }
}

export default function App() {
  const [tema, setTema] = useState<Tema>(temaInicial);
  // undefined: ainda conferindo a sessão; null: ninguém entrou
  const [conta, setConta] = useState<Conta | null | undefined>(undefined);
  const [erroConta, setErroConta] = useState<ErroApi | null>(null);
  const navegar = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    try {
      localStorage.setItem('tema', tema);
    } catch {
      // modo privado: o tema só não fica salvo
    }
  }, [tema]);

  useEffect(() => {
    const semSessao = () => setConta(null);
    window.addEventListener(SEM_SESSAO, semSessao);
    api.conta().then(setConta, (e: ErroApi) => (e.status === 401 ? setConta(null) : setErroConta(e)));
    return () => window.removeEventListener(SEM_SESSAO, semSessao);
  }, []);

  function entrou(c: Conta) {
    limparRascunhos();
    setConta(c);
  }

  async function sair() {
    await api.sair().catch(() => undefined);
    limparRascunhos();
    setConta(null);
    navegar('/');
  }

  const botaoTema = (
    <button className="btn sec tema" onClick={() => setTema(tema === 'claro' ? 'escuro' : 'claro')}>
      <Icone nome={tema === 'claro' ? 'lua' : 'sol'} />
      <span className="tema-rot">{tema === 'claro' ? 'Tema escuro' : 'Tema claro'}</span>
    </button>
  );

  if (erroConta) return <main className="conteudo"><Falha erro={erroConta} tentar={() => window.location.reload()} /></main>;
  if (conta === undefined) return <main className="conteudo"><Carregando /></main>;
  if (conta === null) return <Entrar entrou={entrou} botaoTema={botaoTema} />;

  // Computador: menu lateral. Tablet: trilho. Celular: barra de cima e abas embaixo.
  return (
    <div className="app">
      <aside className="lateral">
        <Link to="/" className="marca" aria-label="Liga Especial, início">
          <Logo />
          <span className="marca-texto"><b>Liga Especial</b><small>Otimizador de mistura</small></span>
        </Link>
        <nav className="menu" aria-label="Principal">
          {LINKS.map((l) => (
            <NavLink key={l.para} to={l.para} end={l.para === '/'}>
              <span className="menu-ic"><Icone nome={l.icone} /></span>{l.rotulo}
            </NavLink>
          ))}
        </nav>
        <p className="dica-lateral"><b>Dica</b>Abra uma fórmula, mude um limite e calcule de novo para comparar.</p>
        <div className="conta">
          <span className="conta-email" title={conta.email}>{conta.email}</span>
          <button className="btn sec sair" onClick={sair}>
            <Icone nome="sair" tamanho={18} /><span className="sair-rot">Sair</span>
          </button>
        </div>
        {botaoTema}
      </aside>
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/materiais" element={<Materiais />} />
          <Route path="/materiais/novo" element={<MaterialForm />} />
          <Route path="/materiais/:id" element={<SoComId><MaterialForm /></SoComId>} />
          <Route path="/atributos" element={<Atributos />} />
          <Route path="/formulas" element={<Formulas />} />
          <Route path="/formulas/nova" element={<Formula />} />
          <Route path="/formulas/:id" element={<SoComId><Formula /></SoComId>} />
          <Route path="*" element={NAO_ENCONTRADA} />
        </Routes>
      </main>
    </div>
  );
}
