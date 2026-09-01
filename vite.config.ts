import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El sitio tiene tres páginas:
//   index.html            la landing (HTML plano, autónoma, sin React)
//   herramienta.html      el planner en React, al que lleva el botón de la landing
//   pago-simulado.html    la pasarela de pago simulada, plana como la landing
//
// Se declaran las tres como entradas para que `vite build` genere todas. La landing y la
// pasarela no cargan React, así que quien solo pasa por ahí no se descarga el bundle de
// la app.
export default defineConfig({
  plugins: [react()],
  server: {
    // La API corre aparte, en el 3001. Sin este puente el navegador tendría que llamarla
    // por su puerto y toparse con CORS; así la web pide /api/... a su propio origen y
    // Vite lo reenvía. En producción de eso se encarga el servidor que tenga delante.
    proxy: {
      '/api': {
        target: process.env.JONDA_API ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        herramienta: resolve(import.meta.dirname, 'herramienta.html'),
        pagoSimulado: resolve(import.meta.dirname, 'pago-simulado.html'),
      },
    },
  },
})
