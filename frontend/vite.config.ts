import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Página não abre dentro de frame de outro site, nada é "farejado" como outro tipo e o Referer não sai do app
const cabecalhos = { 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };

// /api vai para o FastAPI: mesma origem no navegador, sem configurar CORS
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000' }, headers: cabecalhos },
  preview: { headers: cabecalhos },
});
