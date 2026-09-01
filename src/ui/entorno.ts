// Distingue si la herramienta corre dentro de la aplicación de escritorio o en el
// navegador. Es la misma página en los dos sitios, pero unas cuantas cosas no pueden
// serlo: la barra de arriba, el pago (que tiene que salir a un navegador con barra de
// direcciones) y, sobre todo, a qué servidor se le piden los datos.
//
// Todo lo que cambia entre los dos entornos vive aquí y en ningún otro sitio, para que
// no haya que ir buscando comprobaciones de Tauri repartidas por la interfaz.

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

// ─────────────────────────── dónde vive la API ────────────────────────────
//
// En la web la respuesta es "en el mismo sitio que la página": en desarrollo porque Vite
// hace de puente hacia el 3001 (el `proxy` de `vite.config.ts`), y en producción porque
// delante hay un servidor que reparte. Por eso las rutas se escriben `/api/...` a secas.
//
// En la aplicación de escritorio no hay ni puente ni servidor delante: la ventana carga
// los ficheros por el protocolo propio de Tauri, así que `/api/auth/yo` apunta a un sitio
// donde no hay nada. Ahí la cuenta no llegaba a existir: el botón de entrar salía y al
// pulsarlo siempre contestaba que no se pudo hablar con el servidor.
//
// Se puede fijar al compilar con `VITE_JONDA_API`, para cuando la API viva en un dominio
// de verdad, y si no se dice nada se usa el 3001 de la propia máquina, que es donde la
// levanta `npm run api`.

/** Lo que usa la app de escritorio cuando nadie ha dicho otra cosa. */
const API_LOCAL = "http://localhost:3001";

let raiz: string | null = null;

function apiConfigurada(): string {
  const entorno = (import.meta as { env?: Record<string, string | undefined> }).env;
  return (entorno?.VITE_JONDA_API ?? "").trim().replace(/\/+$/, "");
}

/**
 * La raíz de la API: cadena vacía cuando comparte origen con la página, que es el caso
 * normal en la web, y un `http://host:puerto` cuando no.
 */
export function raizApi(): string {
  // Se calcula una sola vez: ni el entorno ni el hecho de estar en la app cambian a
  // mitad de sesión.
  raiz ??= apiConfigurada() || (enEscritorio() ? API_LOCAL : "");
  return raiz;
}

/** La URL a la que hay que pedir una ruta de la API. */
export function urlApi(ruta: string): string {
  return raizApi() + ruta;
}

/**
 * true cuando la API está en otro origen, es decir, en la app de escritorio.
 *
 * Importa para las cookies: la sesión viaja en una cookie httpOnly mientras web y API
 * comparten origen, y en la cabecera `Authorization` cuando no. Pedir con
 * `credentials: "include"` a otro origen obligaría al servidor a contestar con un origen
 * concreto y `Allow-Credentials` en vez del `*` de ahora, y a cambio no ganaría nada: la
 * cookie tampoco viajaría sin `SameSite=None; Secure`, que sobre http no vale.
 */
export function apiEnOtroOrigen(): boolean {
  return raizApi() !== "";
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
