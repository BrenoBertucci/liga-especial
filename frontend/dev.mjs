// npm run dev: sobe a API (FastAPI, porta 8000) e o site (Vite, porta 5181) no mesmo terminal. Ctrl+C para os dois.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const PORTA_API = 8000;
const ESPERA_MAXIMA_MS = 20000;
const raiz = fileURLToPath(new URL('.', import.meta.url));
const backend = fileURLToPath(new URL('../backend/', import.meta.url));
const python = backend + (process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');

const apiRespondendo = () => new Promise((ok) => {
  const s = createConnection({ port: PORTA_API, host: '127.0.0.1' });
  s.once('connect', () => { s.destroy(); ok(true); });
  s.once('error', () => ok(false));
});

let api = null;
if (await apiRespondendo()) {
  console.log(`API já está rodando na porta ${PORTA_API}: o site vai usar essa.`);
} else if (!existsSync(python)) {
  console.log('API não iniciada: falta o ambiente Python em backend/.venv (veja o README). Subindo só o site.');
} else {
  api = spawn(python, ['-m', 'uvicorn', 'main:app', '--port', String(PORTA_API)], { cwd: backend, stdio: 'inherit' });
  api.on('exit', (codigo) => {
    api = null;
    if (codigo) console.log(`A API parou (código ${codigo}). Confira se o PostgreSQL está ligado.`);
  });
  // O site só abre depois da API, para a primeira tela não cair em "Sem conexão"
  const limite = Date.now() + ESPERA_MAXIMA_MS;
  while (api && Date.now() < limite && !(await apiRespondendo())) await new Promise((r) => setTimeout(r, 300));
}

const site = await createServer({ root: raiz, server: { port: 5181 } });
await site.listen();
site.printUrls();

const parar = async () => {
  api?.kill();
  await site.close();
  process.exit(0);
};
process.on('SIGINT', parar);
process.on('SIGTERM', parar);
process.on('exit', () => api?.kill());
