import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// /api vai para o FastAPI: mesma origem no navegador, sem configurar CORS
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000' } },
});
