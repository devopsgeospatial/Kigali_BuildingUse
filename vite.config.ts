import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes the production build use relative asset paths, so it works
// whether served from a domain root or a GitHub Pages project subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // do not ship readable source maps
  },
});
