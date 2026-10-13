import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — чтобы сборка работала из любой папки (GitHub Pages, Vercel, Netlify)
export default defineConfig({
  plugins: [react()],
  base: './',
});
