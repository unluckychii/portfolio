import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // the site's address prefix: "/" locally and on Netlify, "/portfolio/" on GitHub Pages
  // (set by .github/workflows/pages.yml)
  base: process.env.BASE_PATH || '/',
})
