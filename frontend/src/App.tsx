import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';

import Atributos from './paginas/Atributos';
import Formula from './paginas/Formula';
import Formulas from './paginas/Formulas';
import Inicio from './paginas/Inicio';
import MaterialForm from './paginas/MaterialForm';
import Materiais from './paginas/Materiais';

const LINKS = [
  { para: '/', rotulo: 'Início' },
  { para: '/materiais', rotulo: 'Materiais' },
  { para: '/formulas', rotulo: 'Fórmulas' },
  { para: '/atributos', rotulo: 'Atributos' },
];

type Tema = 'claro' | 'escuro';

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

  const links = LINKS.map((l) => (
    <NavLink key={l.para} to={l.para} end={l.para === '/'}>{l.rotulo}</NavLink>
  ));

  return (
    <div className="app">
      <header className="topo">
        <Link to="/" className="marca" aria-label="Liga Especial, início">
          <span className="logo" aria-hidden="true"><i /><i /><i /><i /></span>
          Liga Especial
        </Link>
        <nav className="nav-topo" aria-label="Principal">{links}</nav>
        <button className="btn sec peq" onClick={() => setTema(tema === 'claro' ? 'escuro' : 'claro')}>
          {tema === 'claro' ? 'Tema escuro' : 'Tema claro'}
        </button>
      </header>
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/materiais" element={<Materiais />} />
          <Route path="/materiais/novo" element={<MaterialForm />} />
          <Route path="/materiais/:id" element={<MaterialForm />} />
          <Route path="/atributos" element={<Atributos />} />
          <Route path="/formulas" element={<Formulas />} />
          <Route path="/formulas/nova" element={<Formula />} />
          <Route path="/formulas/:id" element={<Formula />} />
          <Route path="*" element={<p className="estado">Página não encontrada. <Link to="/">Voltar ao início</Link></p>} />
        </Routes>
      </main>
      <nav className="nav-baixo" aria-label="Principal">{links}</nav>
    </div>
  );
}
