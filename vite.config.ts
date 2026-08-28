import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El sitio tiene dos páginas:
//   index.html        la landing (HTML plano, autónoma, sin React)
//   herramienta.html  el planner en React, al que lleva el botón de la landing
//
// Se declaran las dos como entradas para que `vite build` genere ambas. La landing no
// carga React, así que quien solo abre la portada no se descarga el bundle de la app.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        herramienta: resolve(import.meta.dirname, 'herramienta.html'),
        menu: resolve(import.meta.dirname, 'menu.html'),
      },
    },
  },
})
