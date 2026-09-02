// Cliente de las rutas de cuenta y suscripción (`src/api/rutas-cuenta.ts`).
//
// Mismo criterio que `src/data/fuente.ts`: si la API no contesta, nadie se entera. La app
// de escritorio va sin servidor y tiene que seguir funcionando en modo gratuito, así que
// aquí no se lanza ningún error hacia arriba por un fallo de red, solo se devuelve `null`
// o `{ ok: false }` para que quien llama decida qué enseñar.
//
// La sesión viaja de dos formas a la vez. La cookie basta en el navegador, pero la app de
// escritorio no comparte origen con la API y ahí las cookies no llegan bien, así que
// también se guarda el token y se manda en la cabecera Authorization. Guardarlo en
// localStorage además sirve para no pedir la sesión otra vez cada vez que se abre la app.
//
// A qué servidor se le pide lo decide `src/ui/entorno.ts`, que no contesta lo mismo en la
// web que en la app de escritorio. Aquí las rutas se escriben siempre relativas y ese
// módulo les pone delante lo que haga falta.

import { apiEnOtroOrigen, urlApi } from "../ui/entorno";

const ESPERA_LECTURA = 3500;
const ESPERA_ENVIO = 8000;
const CLAVE_TOKEN = "jonda_token";

export type Plan = "gratis" | "taller";
export type EstadoSuscripcion = "ninguna" | "activa" | "impagada" | "cancelada";

export interface Usuario {
  id: string;
  correo: string;
  alta: string;
}

export interface Perfil {
  id: string;
  correo: string;
  nombre: string;
  coche: string;
  ciudad: string;
  sobreMi: string;
  /** Data URI de la foto (webp o jpeg, recortada y reducida en el navegador), o "". */
  foto: string;
  alta: string;
  visto: string | null;
}

export interface Limites {
  /** Hasta cuánto dinero se puede planificar. */
  presupuestoMaximo: number;
  objetivos: number;
  eleccionesManuales: boolean;
  exportarPdf: boolean;
  /** -1 cuando no hay tope. */
  planesPorDia: number;
}

export interface Suscripcion {
  estado: EstadoSuscripcion;
  proveedor: string;
  referencia: string | null;
  renueva: string | null;
}

export interface Precio {
  centimos: number;
  moneda: string;
  periodo: string;
}

export interface Acceso {
  usuario: Usuario | null;
  perfil: Perfil | null;
  plan: Plan;
  limites: Limites;
  suscripcion: Suscripcion | null;
  planesHoy: number;
  precio: Precio;
}

/** Lo que devuelven GET y PATCH de /api/auth/perfil: el perfil más el resto del acceso. */
export interface RespuestaPerfil {
  perfil: Perfil;
  plan: Plan;
  limites: Limites;
  suscripcion: Suscripcion | null;
  planesHoy: number;
  precio: Precio;
}

export interface CambioContrasena {
  cambiada: true;
  aviso: string;
}

export interface CancelacionSuscripcion {
  cancelada: true;
  /** Fecha ISO hasta la que sigue teniendo la herramienta completa, o null si es inmediato. */
  hasta: string | null;
}

export interface CuentaBorrada {
  borrada: true;
}

/** Lo que devuelve el código de acceso al abrir el plan completo sin pasar por el pago. */
export interface CodigoActivado {
  abierta: true;
  plan: Plan;
  limites: Limites;
  suscripcion: Suscripcion;
  planesHoy: number;
  precio: Precio;
}

/** Ruta de descarga de los datos personales. */
export const RUTA_MIS_DATOS = "/api/auth/mis-datos";

export type Resultado<T> =
  | { ok: true; datos: T }
  /** `datos` trae el cuerpo del error tal cual vino, para lo que no cabe en `error`. */
  | { ok: false; error: string; codigo?: number; datos?: unknown };

function token(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    // Modo privado o almacenamiento bloqueado: se sigue sin recordar la sesión entre
    // visitas, pero no rompe nada.
    return null;
  }
}

function guardarToken(valor: string | null): void {
  try {
    if (valor) localStorage.setItem(CLAVE_TOKEN, valor);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Igual que arriba: sin persistencia, pero la sesión sigue viva en esta pestaña.
  }
}

function cabeceras(): HeadersInit {
  const cabecera: Record<string, string> = { "Content-Type": "application/json" };
  const t = token();
  if (t) cabecera.Authorization = `Bearer ${t}`;
  return cabecera;
}

async function peticion<T>(
  ruta: string,
  opciones: { metodo?: string; cuerpo?: unknown; espera?: number } = {},
): Promise<Resultado<T>> {
  try {
    const respuesta = await fetch(urlApi(ruta), {
      method: opciones.metodo ?? "GET",
      headers: cabeceras(),
      // Con la API en el mismo origen la sesión va en la cookie httpOnly, que es lo más
      // seguro que hay aquí. Cuando está fuera (la app de escritorio) se pide sin
      // credenciales a propósito: la cookie no llegaría igualmente, y exigirlas obligaría
      // al servidor a dejar de contestar con `Access-Control-Allow-Origin: *`.
      credentials: apiEnOtroOrigen() ? "omit" : "include",
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
      signal: AbortSignal.timeout(opciones.espera ?? ESPERA_LECTURA),
    });

    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const error = (datos && typeof datos === "object" && "error" in datos
        ? String((datos as { error: unknown }).error)
        : null) ?? `La API respondió ${respuesta.status}.`;
      return { ok: false, error, codigo: respuesta.status, datos };
    }
    return { ok: true, datos: datos as T };
  } catch {
    // Sin conexión, API apagada o tiempo agotado: no hay forma de distinguirlos desde
    // aquí, y para quien llama da igual el motivo.
    return { ok: false, error: "No se pudo hablar con el servidor." };
  }
}

/**
 * Al revés que `sinInfinitos` del servidor: JSON no sabe escribir Infinity, así que "sin
 * tope" llega como -1 en los presupuestos por día y como null en el dinero. Se deshace
 * aquí, en el borde, para que `puedePedirPlan` se comporte igual en el navegador que en
 * la API. Sin esto, a un suscriptor con la API caída el contador de aquí le diría que ya
 * ha llegado a su tope, porque cualquier número es mayor o igual que -1.
 */
export function conInfinitos(limites: Limites): Limites {
  const sinTope = (valor: number | null | undefined) =>
    valor === null || valor === undefined || valor < 0 ? Infinity : valor;
  return {
    ...limites,
    presupuestoMaximo: sinTope(limites.presupuestoMaximo),
    planesPorDia: sinTope(limites.planesPorDia),
  };
}

function normalizar(cruda: {
  usuario: Usuario | null;
  perfil?: Perfil | null;
  plan: Plan;
  limites: Limites;
  suscripcion?: Suscripcion;
  planesHoy?: number;
  precio: Precio;
  token?: string;
}): Acceso {
  if (cruda.token) guardarToken(cruda.token);
  return {
    usuario: cruda.usuario,
    perfil: cruda.perfil ?? null,
    plan: cruda.plan,
    limites: conInfinitos(cruda.limites),
    suscripcion: cruda.suscripcion ?? null,
    planesHoy: cruda.planesHoy ?? 0,
    precio: cruda.precio,
  };
}

/** Quién hay al otro lado, si alguien. `null` cuando la API no contesta. */
export async function quienSoy(): Promise<Acceso | null> {
  const resultado = await peticion<Parameters<typeof normalizar>[0]>("/api/auth/yo");
  if (!resultado.ok) {
    // Un token que ya no vale no debería quedarse dando vueltas.
    if (resultado.codigo === 401) guardarToken(null);
    return null;
  }
  return normalizar(resultado.datos);
}

export async function registrarCuenta(
  correo: string,
  contrasena: string,
  datos: { nombre?: string; coche?: string } = {},
): Promise<Resultado<Acceso>> {
  const resultado = await peticion<Parameters<typeof normalizar>[0]>("/api/auth/registro", {
    metodo: "POST",
    cuerpo: { correo, contrasena, ...datos },
    espera: ESPERA_ENVIO,
  });
  if (!resultado.ok) return resultado;
  return { ok: true, datos: normalizar(resultado.datos) };
}

export async function entrarCuenta(correo: string, contrasena: string): Promise<Resultado<Acceso>> {
  const resultado = await peticion<Parameters<typeof normalizar>[0]>("/api/auth/entrar", {
    metodo: "POST",
    cuerpo: { correo, contrasena },
    espera: ESPERA_ENVIO,
  });
  if (!resultado.ok) return resultado;
  return { ok: true, datos: normalizar(resultado.datos) };
}

/**
 * Los datos personales, tal cual los guarda el servidor.
 *
 * Se piden con la sesión puesta y no llevando al navegador a la ruta, que es lo que se
 * hacía antes. Una navegación normal no lleva la cabecera `Authorization`, así que solo
 * funcionaba mientras valiera la cookie: en la app de escritorio no hay cookie que valga
 * y siempre se llevaba un 401. Pidiéndolo así vale en los dos sitios, y quien llama se
 * encarga de ofrecer el fichero.
 */
export async function misDatos(): Promise<Resultado<Blob>> {
  try {
    const respuesta = await fetch(urlApi(RUTA_MIS_DATOS), {
      headers: cabeceras(),
      credentials: apiEnOtroOrigen() ? "omit" : "include",
      signal: AbortSignal.timeout(ESPERA_ENVIO),
    });
    if (!respuesta.ok) {
      return {
        ok: false,
        error: respuesta.status === 401 ? "Vuelve a entrar en tu cuenta." : "No se pudieron sacar tus datos.",
        codigo: respuesta.status,
      };
    }
    return { ok: true, datos: await respuesta.blob() };
  } catch {
    return { ok: false, error: "No se pudo hablar con el servidor." };
  }
}

export async function salirCuenta(): Promise<void> {
  await peticion("/api/auth/salir", { metodo: "POST", espera: ESPERA_ENVIO });
  guardarToken(null);
}

export async function abrirCheckout(): Promise<Resultado<{ url: string; simulado: boolean }>> {
  return peticion("/api/suscripcion/checkout", { metodo: "POST", espera: ESPERA_ENVIO });
}

/** Confirma la suscripción por la pasarela simulada. Solo existe cuando no hay Stripe. */
export interface ConfirmacionSimulada {
  plan: Plan;
  limites: Limites;
  suscripcion: Suscripcion;
  planesHoy: number;
  precio: Precio;
  simulado: true;
}

/**
 * Confirma la suscripción por la pasarela simulada. Exige el código de acceso: sin
 * cobro de por medio, sin él cualquiera que llegara a esta pantalla se llevaría la
 * herramienta completa gratis.
 */
export async function confirmarSimulada(codigo: string): Promise<Resultado<ConfirmacionSimulada>> {
  return peticion<ConfirmacionSimulada>("/api/suscripcion/simulada/confirmar", {
    metodo: "POST",
    cuerpo: { codigo },
    espera: ESPERA_ENVIO,
  });
}

/**
 * El código de acceso: abre el plan completo al instante, sin pasar por ningún pago.
 * Pensado para pruebas y demostraciones, no para saltarse el cobro a escondidas: queda
 * anotado en la suscripción con proveedor "codigo".
 *
 * 404 cuando este servidor no tiene ningún código configurado: en ese caso la opción ni
 * se enseña, ver `SuscripcionModal`.
 */
export async function activarConCodigo(codigo: string): Promise<Resultado<CodigoActivado>> {
  return peticion<CodigoActivado>("/api/suscripcion/codigo", {
    metodo: "POST",
    cuerpo: { codigo },
    espera: ESPERA_ENVIO,
  });
}

/** Cambia los datos del perfil. Lo que no se manda no se toca: PATCH parcial de verdad. */
export async function actualizarPerfil(
  cambios: { nombre?: string; coche?: string; ciudad?: string; sobreMi?: string; foto?: string },
): Promise<Resultado<RespuestaPerfil>> {
  return peticion<RespuestaPerfil>("/api/auth/perfil", {
    metodo: "PATCH",
    cuerpo: cambios,
    espera: ESPERA_ENVIO,
  });
}

/**
 * Cambia la contraseña. Si sale bien, el servidor ya ha cerrado todas las sesiones, así
 * que aquí se olvida también el token guardado: seguir mandándolo solo daría un 401.
 */
export async function cambiarContrasena(
  actual: string,
  nueva: string,
): Promise<Resultado<CambioContrasena>> {
  const resultado = await peticion<CambioContrasena>("/api/auth/contrasena", {
    metodo: "POST",
    cuerpo: { actual, nueva },
    espera: ESPERA_ENVIO,
  });
  if (resultado.ok) guardarToken(null);
  return resultado;
}

/** Cancela la suscripción activa. 409 si no había ninguna. */
export async function cancelarSuscripcion(): Promise<Resultado<CancelacionSuscripcion>> {
  return peticion<CancelacionSuscripcion>("/api/suscripcion/cancelar", {
    metodo: "POST",
    espera: ESPERA_ENVIO,
  });
}

/** Borra la cuenta. Exige la contraseña porque no tiene vuelta atrás. */
export async function borrarCuenta(contrasena: string): Promise<Resultado<CuentaBorrada>> {
  const resultado = await peticion<CuentaBorrada>("/api/auth/borrar", {
    metodo: "POST",
    cuerpo: { contrasena },
    espera: ESPERA_ENVIO,
  });
  if (resultado.ok) guardarToken(null);
  return resultado;
}

/**
 * Lo único que la interfaz mira de la respuesta de `/api/plan`: el plan lo calcula el
 * motor de aquí. `planesHoy` es null cuando no hay sesión, porque entonces el servidor no
 * apunta nada y el contador lo lleva el navegador.
 */
export interface RespuestaPlan {
  planesHoy: number | null;
}

export interface PeticionPlan {
  modelo: string;
  presupuesto: number;
  objetivos: string[];
  elecciones: string[];
}

/**
 * Pide un presupuesto al servidor. Es el que cuenta: si hay sesión, el servidor lo apunta
 * en el uso del día y con el siguiente que no quepa contesta 402.
 *
 * El plan que se enseña lo sigue calculando el motor del navegador, que es el mismo
 * código con el chasis del coche puesto. Lo que se busca aquí es la comprobación y el
 * apunte, que son cosa del servidor y no se pueden saltar abriendo las herramientas del
 * navegador.
 */
export async function pedirPresupuesto(
  peticionPlan: PeticionPlan,
): Promise<Resultado<RespuestaPlan>> {
  return peticion("/api/plan", { metodo: "POST", cuerpo: peticionPlan, espera: ESPERA_ENVIO });
}

/**
 * Pregunta si el plan cabe en los límites de la cuenta, sin que cuente como un
 * presupuesto más del día. Lo usa la descarga del PDF, que no genera nada nuevo: sin el
 * `soloComprobar` cada PDF se comía uno de los presupuestos del día.
 */
export async function comprobarLimite(
  peticionPlan: PeticionPlan,
): Promise<Resultado<RespuestaPlan>> {
  return peticion("/api/plan", {
    metodo: "POST",
    cuerpo: { ...peticionPlan, soloComprobar: true },
    espera: ESPERA_ENVIO,
  });
}
