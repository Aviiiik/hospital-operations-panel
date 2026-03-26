import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),        // ← This is the new way in v4
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
})