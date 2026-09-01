// Cuenta en la portada: los mismos componentes de React que ya tiene el planner
// (CuentaProvider, AccesoModal, PerfilModal, SuscripcionModal), no una segunda versión
// escrita a mano. La portada es HTML plano a propósito, pero ya no por ligereza: pesa
// más que el planner por el visor 3D, así que el argumento de "sin React para ir
// rápido" no aplica aquí. Duplicar el login en dos tecnologías es justo el tipo de
// cosa que este proyecto ya pagó cara una vez.
//
// Se monta en dos sitios de la misma página con una sola raíz de React: el avatar va
// por un portal dentro de `.nav-links` (`#cuenta-nav`), y los modales sueltos al final
// del body (`#cuenta-modales`). Comparten el mismo `CuentaProvider` porque siguen
// siendo el mismo árbol de React, solo que una parte de ese árbol vive en otro punto
// del DOM. Ver `CuentaPortada.tsx`.
//
// Si la API no contesta, esto no revienta nada: `CuentaProvider` ya está pensado para
// eso (ver sus comentarios), así que la portada se queda con el botón de "Entrar" que,
// si se pulsa, avisará de que no hay servidor. No hace falta ningún cuidado extra aquí.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CuentaProvider } from "../cuenta/CuentaContext";
import { CuentaPortada } from "./CuentaPortada";
import "../ui/cuenta.css";

function arrancar() {
  const nav = document.getElementById("cuenta-nav");
  const raiz = document.getElementById("cuenta-modales");
  if (!nav || !raiz) return;

  createRoot(raiz).render(
    <StrictMode>
      <CuentaProvider>
        <CuentaPortada nav={nav} />
      </CuentaProvider>
    </StrictMode>,
  );
}

arrancar();
