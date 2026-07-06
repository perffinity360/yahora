import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    // Forward /api/* to the Express backend so the frontend can use
    // relative URLs. This lets any device on the LAN reach the backend
    // via the dev server — no machine IP hardcoded anywhere.
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})