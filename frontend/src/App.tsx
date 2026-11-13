import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom';

import { Logo } from './componentes';
import { Icone, type NomeIcone } from './icones';
import Atributos from './paginas/Atributos';
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

// /formulas/abc e /materiais/xyz não viram cadastro novo: mostram que a página não existe
function SoComId({ children }: { children: ReactNode }) {
  return /^[0-9]+$/.test(useParams().id ?? '') ? children : NAO_ENCONTRADA;
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

export default function App() {
  const [tema, setTema] = useState<Tema>(temaInicial);
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    try {
      localStorage.setItem('tema', tema);
    } catch {
      // modo privado: o tema só não fica salvo
    }
  }, [tema]);

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
        <button className="btn sec tema" onClick={() => setTema(tema === 'claro' ? 'escuro' : 'claro')}>
          <Icone nome={tema === 'claro' ? 'lua' : 'sol'} />
          <span className="tema-rot">{tema === 'claro' ? 'Tema escuro' : 'Tema claro'}</span>
        </button>
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
