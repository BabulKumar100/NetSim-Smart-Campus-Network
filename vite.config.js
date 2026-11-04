import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Copies dist/index.html to dist/404.html for GitHub Pages SPA routing
function copy404Plugin() {
  return {
    name: 'copy-404',
    closeBundle() {
      const distDir = fileURLToPath(new URL('./dist', import.meta.url))
      const indexHtml = path.join(distDir, 'index.html')
      const notFoundHtml = path.join(distDir, '404.html')
      if (fs.existsSync(indexHtml)) {
        fs.copyFileSync(indexHtml, notFoundHtml)
      }
    },
  }
}

export default defineConfig({
  base: '/NetSim-Smart-Campus-Network/',
  plugins: [react(), copy404Plugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
  test: {
    environment: 'node',
  },
})
