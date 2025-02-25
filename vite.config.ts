import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Log the resolved paths for debugging
console.log('Current directory:', __dirname);
console.log('Resolved index.html path:', resolve(__dirname, 'src/index.html'));

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: '../public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    watch: {
      usePolling: true
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    include: ['pdfjs-dist/legacy/build/pdf']
  },
  worker: {
    format: 'es'
  }
}); 