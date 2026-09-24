import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // Honor a harness-assigned port so multiple dev servers can coexist.
    port: Number(process.env.PORT) || 5173,
  },
})
