import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from /<repo>/ — set base for production builds.
// Override with VITE_BASE if deploying elsewhere.
const base = process.env.VITE_BASE ?? (process.env.NODE_ENV === 'production' ? '/SoundReWave/' : '/');

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: true,
  },
});
