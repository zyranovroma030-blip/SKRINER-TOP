import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/bybit': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/api/alerts': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/api/notify': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
})
