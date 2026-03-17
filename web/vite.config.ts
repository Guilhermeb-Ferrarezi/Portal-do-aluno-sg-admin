import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@monaco-editor')) return 'vendor-monaco';
          if (id.includes('framer-motion') || id.includes('animate-ui')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-icons';
          return 'vendor';
        },
      },
    },
  },
})
