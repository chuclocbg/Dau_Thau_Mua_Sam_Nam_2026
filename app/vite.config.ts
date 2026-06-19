import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ponytail: empty object so process.env.X returns undefined in browser → KB fallback
  define: { 'process.env': {} },
})
