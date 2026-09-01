import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { cargarDatos } from './data/fuente.ts'
import { CuentaProvider } from './cuenta/CuentaContext.tsx'

// Antes de pintar nada se intenta traer el catálogo de la API, que lo sirve desde la
// base de datos. Si no hay servidor (la app de escritorio, o la web a secas) se sigue
// con el catálogo empaquetado y la interfaz ni se entera. Ver src/data/fuente.ts.
const origen = await cargarDatos()
document.documentElement.dataset.origenDatos = origen

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CuentaProvider>
      <App />
    </CuentaProvider>
  </StrictMode>,
)
