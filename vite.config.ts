import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// GitHub Pages serves from /<repo>/ — set base for production builds.
// Override with VITE_BASE if deploying elsewhere.
const base = process.env.VITE_BASE ?? (process.env.NODE_ENV === 'production' ? '/SoundReWave/' : '/');

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
let sha = 'local';
try {
  sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {
  /* not a git checkout */
}
const buildTime = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(sha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [react()],
  server: {
    host: true,
  },
});
