// Distingue si la herramienta corre dentro de la aplicación de escritorio o en el
// navegador. Es la misma página en los dos sitios, pero la barra de arriba no puede
// serlo: en la web se vuelve a la portada, y en la app se vuelve al menú y se puede
// cerrar el programa, que en una web no tiene sentido.

interface VentanaTauri {
  window: { getCurrentWindow: () => { close: () => Promise<void> } };
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
