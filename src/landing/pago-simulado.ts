// Pasarela simulada: la pantalla a la que se llega cuando no hay claves de Stripe en el
// servidor. No es HTML suelto con estilos copiados a mano: carga los mismos tokens que el
// resto de la casa, igual que hace la portada con `civic.ts` y `landing.css`.
//
// Página sin React a propósito, como la portada: es una pantalla de paso, no la
// herramienta.

import "../index.css";
import "../ui/cuenta.css";
import { confirmarSimulada } from "../cuenta/api";

const VOLVER_LISTO = "/herramienta.html?suscripcion=lista";

function arrancar() {
  const boton = document.querySelector<HTMLButtonElement>("[data-confirmar]");
  const estado = document.querySelector<HTMLElement>("[data-estado]");
  const acciones = document.querySelector<HTMLElement>("[data-acciones]");
  const codigo = document.querySelector<HTMLInputElement>("[data-codigo]");
  if (!boton || !estado || !acciones || !codigo) return;

  const ponEstado = (texto: string, clase: "" | "ok" | "error") => {
    estado.textContent = texto;
    estado.className = "pago-estado" + (clase ? ` ${clase}` : "");
  };

  boton.addEventListener("click", () => {
    void confirmar();
  });

  async function confirmar() {
    if (!boton || !estado || !acciones || !codigo) return;
    boton.disabled = true;
    const texto = boton.querySelector("span");
    const original = texto?.textContent ?? "";
    if (texto) texto.textContent = "Confirmando…";
    ponEstado("", "");

    const resultado = await confirmarSimulada(codigo.value.trim());

    if (resultado.ok) {
      ponEstado("Listo. Ya eres del taller.", "ok");
      acciones.innerHTML = "";
      const volver = document.createElement("a");
      volver.className = "btn btn-rojo";
      volver.href = VOLVER_LISTO;
      volver.innerHTML = "<span>Volver al planner</span>";
      acciones.appendChild(volver);
      // Vuelve sola a los dos segundos: quien ha llegado hasta aquí no quiere quedarse
      // mirando una pantalla de pago, quiere seguir armando el build.
      window.setTimeout(() => {
        window.location.href = VOLVER_LISTO;
      }, 2000);
      return;
    }

    // Sin sesión abierta en este navegador, el 401 aquí no distingue de un código malo:
    // se manda el mensaje de la API tal cual, ya dice cuál es el problema.
    ponEstado(
      resultado.codigo === 401 && !codigo.value.trim()
        ? "Hace falta el código de acceso, o entra en la herramienta y repite el pago si ya tenías sesión."
        : resultado.error,
      "error",
    );

    if (texto) texto.textContent = original;
    boton.disabled = false;
  }
}

arrancar();
