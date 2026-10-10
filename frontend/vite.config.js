import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '')
  const backend = `http://127.0.0.1:${env.BACKEND_PORT || 8000}`
  return {
    plugins: [react(), tailwindcss()],
    build: { chunkSizeWarningLimit: 1500 },
    server: {
      port: 5173,
      host: true,
      proxy: { '/api': { target: backend, changeOrigin: true } },
    },
  }
})
