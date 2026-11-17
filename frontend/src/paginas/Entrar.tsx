// Entrar ou criar conta. Cada conta tem os próprios materiais, atributos e fórmulas.
import { useState, type FormEvent, type ReactNode } from 'react';

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
  const [repetida, setRepetida] = useState('');
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const criando = modo === 'criar';
  const diferentes = criando && repetida !== '' && repetida !== senha;

  function trocar(m: Modo) {
    setModo(m);
    setErro(null);
    setRepetida('');
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (criando && senha !== repetida) {
      setErro(new ErroApi('As duas senhas não são iguais.'));
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      entrou(await (criando ? api.criarConta(email, senha) : api.entrar(email, senha)));
    } catch (falha) {
      setErro(falha as ErroApi);
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
        <label className="campo">Senha
          <input type="password" required maxLength={128} minLength={criando ? SENHA_MINIMA : undefined}
            autoComplete={criando ? 'new-password' : 'current-password'} value={senha} onChange={(e) => setSenha(e.target.value)} />
          {criando ? <small>Pelo menos {SENHA_MINIMA} caracteres.</small> : null}
        </label>
        {criando ? (
          <label className="campo">Repita a senha
            <input type="password" required maxLength={128} autoComplete="new-password" value={repetida} aria-invalid={diferentes}
              onChange={(e) => setRepetida(e.target.value)} />
            {diferentes ? <small className="texto-ruim">As senhas não são iguais.</small> : null}
          </label>
        ) : null}
        {erro ? <Falha erro={erro} /> : null}
        <button className="btn prim bloco" disabled={ocupado}>{ocupado ? 'Aguarde…' : criando ? 'Criar conta' : 'Entrar'}</button>
        <p className="dica com-icone"><Icone nome="cadeado" tamanho={16} />Ninguém vê as fórmulas da sua conta, e a senha nunca é guardada em texto.</p>
      </form>
    </main>
  );
}
