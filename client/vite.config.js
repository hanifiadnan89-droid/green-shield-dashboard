import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Load VITE_* from repo root .env when building via `npm run build --prefix client`
  envDir: path.resolve(__dirname, '..'),

build: {
  chunkSizeWarningLimit: 1500,
},

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.js',
      '../server/services/__tests__/**/*.test.js',
    ],
    globals: false,
  },
});
