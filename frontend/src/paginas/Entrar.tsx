// Entrar ou criar conta. Cada conta tem os próprios materiais, atributos e fórmulas.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { api, ErroApi, type Conta } from '../api';
import { Falha, Logo } from '../componentes';
import { Icone } from '../icones';
import { Lingotes } from './Inicio';

type Modo = 'entrar' | 'criar';
const SENHA_MINIMA = 8;

export default function Entrar({ entrou, botaoTema }: { entrou: (c: Conta) => void; botaoTema: ReactNode }) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  // Só muda quando a pessoa aperta o botão: nada é anunciado ao abrir a tela
  const [anuncio, setAnuncio] = useState('');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const criando = modo === 'criar';

  // Voltar para a página pelo botão Voltar do navegador (cache de página) traz a senha escondida de novo
  useEffect(() => {
    const voltou = (e: PageTransitionEvent) => { if (e.persisted) setMostrar(false); };
    window.addEventListener('pageshow', voltou);
    return () => window.removeEventListener('pageshow', voltou);
  }, []);

  function trocar(m: Modo) {
    setModo(m);
    setErro(null);
    setMostrar(false);
    setAnuncio('');
  }

  function alternar() {
    setMostrar(!mostrar);
    setAnuncio(mostrar ? 'Sua senha está oculta.' : 'Sua senha está visível.');
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    // A senha vai escondida: campo de texto enviado o navegador pode guardar e sugerir em outros formulários
    flushSync(() => setMostrar(false));
    setOcupado(true);
    setErro(null);
    try {
      entrou(await (criando ? api.criarConta(email, senha) : api.entrar(email, senha)));
    } catch (falha) {
      const problema = falha as ErroApi;
      // Login recusado: o campo da senha volta vazio para a próxima tentativa
      if (!criando && problema.status === 401) setSenha('');
      setErro(problema);
      setOcupado(false);
    }
  }

  return (
    <main className="entrar">
      <div className="entrar-tema">{botaoTema}</div>
      <section className="hero inicio entrar-hero" aria-labelledby="t-entrar">
        <Lingotes />
        <Logo grande />
        <p className="eyebrow">Otimização de ligas</p>
        <h1 id="t-entrar">Liga Especial</h1>
        <p className="hero-sub">Calcule a mistura de menor custo que mantém a sua liga dentro da especificação.
          Cada conta guarda os próprios materiais e fórmulas.</p>
      </section>

      <form className="card entrar-form" onSubmit={enviar}>
        <div className="segmento" role="group" aria-label="Entrar ou criar conta">
          <button type="button" aria-pressed={!criando} onClick={() => trocar('entrar')}>Entrar</button>
          <button type="button" aria-pressed={criando} onClick={() => trocar('criar')}>Criar conta</button>
        </div>
        <div className="col2">
          <h2>{criando ? 'Criar conta' : 'Entrar na conta'}</h2>
          <p className="dica">{criando ? 'A conta nova já vem com os materiais e a Liga padrão da planilha.' : 'Use o e-mail e a senha da sua conta.'}</p>
        </div>
        <label className="campo">E-mail
          <input type="email" required maxLength={254} autoComplete={criando ? 'email' : 'username'} value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" />
        </label>
        <div className="campo">
          <label htmlFor="campo-senha">Senha</label>
          {/* Sem maxLength: o navegador cortaria a senha calado; o limite de 128 vem do servidor com mensagem */}
          <div className="senha">
            <input id="campo-senha" type={mostrar ? 'text' : 'password'} required minLength={criando ? SENHA_MINIMA : undefined}
              autoComplete={criando ? 'new-password' : 'current-password'} spellCheck={false} autoCapitalize="none" autoCorrect="off"
              aria-describedby={criando ? 'dica-senha' : undefined} value={senha} onChange={(e) => setSenha(e.target.value)} />
            <button type="button" className="btn-ver" aria-controls="campo-senha" aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
              onClick={alternar}>
              <Icone nome={mostrar ? 'olhoFechado' : 'olho'} tamanho={18} />{mostrar ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {criando ? <small id="dica-senha">Pelo menos {SENHA_MINIMA} caracteres. Use Mostrar para conferir o que digitou.</small> : null}
          <span className="oculto" role="status" aria-live="polite">{anuncio}</span>
        </div>
        {erro ? <Falha erro={erro} /> : null}
        <button className="btn prim bloco" disabled={ocupado}>{ocupado ? 'Aguarde…' : criando ? 'Criar conta' : 'Entrar'}</button>
        <p className="dica com-icone"><Icone nome="cadeado" tamanho={16} />Ninguém vê as fórmulas da sua conta, e a senha nunca é guardada em texto.</p>
      </form>
    </main>
  );
}
