// Distingue si la herramienta corre dentro de la aplicación de escritorio o en el
// navegador. Es la misma página en los dos sitios, pero la barra de arriba no puede
// serlo: en la web se vuelve a la portada, y en la app se vuelve al menú y se puede
// cerrar el programa, que en una web no tiene sentido.

interface VentanaTauri {
  window: { getCurrentWindow: () => { close: () => Promise<void> } };
  shell?: { open: (ruta: string) => Promise<void> };
}

function apiTauri(): VentanaTauri | null {
  const g = globalThis as { __TAURI__?: VentanaTauri };
  return g.__TAURI__ ?? null;
}

/** true cuando la página se está pintando dentro de la app de escritorio. */
export function enEscritorio(): boolean {
  const g = globalThis as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return Boolean(g.__TAURI__ ?? g.__TAURI_INTERNALS__);
}

/** Cierra la aplicación. No hace nada fuera del escritorio. */
export async function cerrarApp(): Promise<void> {
  const api = apiTauri();
  if (!api) return;
  try {
    await api.window.getCurrentWindow().close();
  } catch (error) {
    // Si la API cambia de sitio en una versión futura, que al menos se vea por qué.
    console.error("No se pudo cerrar la ventana:", error);
  }
}

/**
 * Abre una URL fuera de la ventana de la aplicación. El pago no puede pasar dentro de la
 * ventana de Tauri: no hay barra de direcciones, así que nadie ve que sigue en un sitio
 * de confianza. Con el plugin de shell instalado se abre en el navegador del sistema; si
 * el paquete no lo trae (la capability no está declarada), se cae a `window.open`, que en
 * el navegador de verdad hace exactamente lo mismo.
 */
export async function abrirEnNavegador(url: string): Promise<void> {
  const api = apiTauri();
  if (api?.shell?.open) {
    try {
      await api.shell.open(url);
      return;
    } catch (error) {
      console.error("No se pudo abrir el navegador del sistema:", error);
    }
  }
  window.open(url, "_blank", "noopener");
}
