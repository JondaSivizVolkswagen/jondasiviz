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

/** Ruta de descarga de los datos personales. La respuesta ya trae la cabecera para que
 * el navegador la descargue como fichero; en la app de escritorio hay que abrirla en el
 * navegador del sistema, ver `descargarMisDatos` en `PerfilModal`. */
export const RUTA_MIS_DATOS = "/api/auth/mis-datos";

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string; codigo?: number };

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
    const respuesta = await fetch(ruta, {
      method: opciones.metodo ?? "GET",
      headers: cabeceras(),
      credentials: "include",
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
      signal: AbortSignal.timeout(opciones.espera ?? ESPERA_LECTURA),
    });

    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const error = (datos && typeof datos === "object" && "error" in datos
        ? String((datos as { error: unknown }).error)
        : null) ?? `La API respondió ${respuesta.status}.`;
      return { ok: false, error, codigo: respuesta.status };
    }
    return { ok: true, datos: datos as T };
  } catch {
    // Sin conexión, API apagada o tiempo agotado: no hay forma de distinguirlos desde
    // aquí, y para quien llama da igual el motivo.
    return { ok: false, error: "No se pudo hablar con el servidor." };
  }
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
    limites: cruda.limites,
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

export async function salirCuenta(): Promise<void> {
  await peticion("/api/auth/salir", { metodo: "POST", espera: ESPERA_ENVIO });
  guardarToken(null);
}

export async function abrirCheckout(): Promise<Resultado<{ url: string; simulado: boolean }>> {
  return peticion("/api/suscripcion/checkout", { metodo: "POST", espera: ESPERA_ENVIO });
}

/** Confirma la suscripción por la pasarela simulada. Solo existe cuando no hay Stripe. */
export async function confirmarSimulada(): Promise<Resultado<Acceso>> {
  const resultado = await peticion<Parameters<typeof normalizar>[0]>(
    "/api/suscripcion/simulada/confirmar",
    { metodo: "POST", espera: ESPERA_ENVIO },
  );
  if (!resultado.ok) return resultado;
  return { ok: true, datos: normalizar(resultado.datos) };
}

/** Cambia nombre y coche. Lo que no se manda no se toca. */
export async function actualizarPerfil(
  cambios: { nombre?: string; coche?: string },
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
 * Comprueba en el servidor si el plan que se está pidiendo cabe en los límites de la
 * cuenta. No se usa para calcular el presupuesto (eso lo hace el motor en el navegador,
 * al instante): es la comprobación de verdad, la que no se puede saltar abriendo las
 * herramientas del navegador.
 */
export async function comprobarLimite(peticionPlan: {
  modelo: string;
  presupuesto: number;
  objetivos: string[];
  elecciones: string[];
}): Promise<Resultado<unknown>> {
  return peticion("/api/plan", { metodo: "POST", cuerpo: peticionPlan, espera: ESPERA_ENVIO });
}
