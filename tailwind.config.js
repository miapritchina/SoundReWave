/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep-studio palette — the app is a dark visual instrument.
        ink: '#0a0b14',
        panel: '#121424',
        haze: '#1c2036',
        glow: '#7c5cff',
        accent: '#22d3ee',
        hot: '#ff5c8a',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
