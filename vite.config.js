import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      '/api-abs': {
        target: 'https://api.data.abs.gov.au',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-abs/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
