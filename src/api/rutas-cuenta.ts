// Rutas de cuenta y suscripción.
//
// Van aparte del resto de la API para que `servidor.ts` no se convierta en un cajón.
// Devuelve true cuando ha atendido la petición, y false cuando la ruta no es suya.
//
// Sobre cómo viaja la sesión: se responde el token en el cuerpo y además se pone una
// cookie httpOnly. No es redundante, es que hay dos clientes distintos:
//
//   La web    usa la cookie. Al ser httpOnly, el JavaScript de la página no puede
//             leerla, así que un fallo de scripting inyectado no se lleva la sesión.
//   La app    de escritorio no comparte origen con la API, y ahí las cookies dan más
//             problemas que soluciones. Usa el token en la cabecera Authorization.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { BaseDatos } from "../db/sqlite.ts";
import {
  abrirSesion,
  autenticar,
  cerrarSesion,
  registrar,
  usuarioDe,
  type Usuario,
} from "../auth/cuentas.ts";
import { correoValido, problemaCon } from "../auth/contrasenas.ts";
import { accesoDe, anotarSuscripcion, usuarioPorReferencia } from "../suscripcion/estado.ts";
import { LIMITES, PRECIO } from "../suscripcion/planes.ts";
import {
  abrirCheckout,
  conStripe,
  firmaStripeValida,
  type Configuracion,
} from "../suscripcion/pasarela.ts";

const COOKIE = "jonda_sesion";

export interface Contexto {
  base: BaseDatos;
  pasarela: Configuracion;
  leerCuerpo: (p: IncomingMessage, r: ServerResponse) => Promise<Buffer | null>;
  responder: (r: ServerResponse, codigo: number, cuerpo: unknown) => void;
}

/** El usuario de una petición, o null si no viene identificada. */
export function usuarioDePeticion(peticion: IncomingMessage, base: BaseDatos): Usuario | null {
  return usuarioDe(base, tokenDe(peticion));
}

export async function manejarCuenta(
  peticion: IncomingMessage,
  respuesta: ServerResponse,
  ruta: string,
  metodo: string,
  ctx: Contexto,
): Promise<boolean> {
  const { base, pasarela, leerCuerpo, responder } = ctx;

  // ─────────────────────────────── registro ───────────────────────────────
  if (ruta === "/api/auth/registro" && metodo === "POST") {
    const datos = await cuerpoJson(peticion, respuesta, ctx);
    if (!datos) return true;

    const correo = String(datos.correo ?? "");
    const contrasena = String(datos.contrasena ?? "");

    if (!correoValido(correo)) {
      responder(respuesta, 400, { error: "Ese correo no tiene buena pinta." });
      return true;
    }
    const problema = problemaCon(contrasena);
    if (problema) {
      responder(respuesta, 400, { error: problema });
      return true;
    }

    const alta = await registrar(base, correo, contrasena);
    if (!alta.ok) {
      responder(respuesta, 409, { error: alta.motivo });
      return true;
    }

    const sesion = abrirSesion(base, alta.usuario.id);
    ponerCookie(respuesta, sesion.token, sesion.caduca);
    responder(respuesta, 201, {
      usuario: alta.usuario,
      token: sesion.token,
      ...accesoResumido(base, alta.usuario.id),
    });
    return true;
  }

  // ───────────────────────────── inicio de sesión ─────────────────────────
  if (ruta === "/api/auth/entrar" && metodo === "POST") {
    const datos = await cuerpoJson(peticion, respuesta, ctx);
    if (!datos) return true;

    const usuario = await autenticar(base, String(datos.correo ?? ""), String(datos.contrasena ?? ""));
    if (!usuario) {
      // El mismo mensaje tanto si el correo no existe como si la contraseña falla:
      // distinguirlo diría qué correos tienen cuenta.
      responder(respuesta, 401, { error: "El correo o la contraseña no son correctos." });
      return true;
    }

    const sesion = abrirSesion(base, usuario.id);
    ponerCookie(respuesta, sesion.token, sesion.caduca);
    responder(respuesta, 200, {
      usuario,
      token: sesion.token,
      ...accesoResumido(base, usuario.id),
    });
    return true;
  }

  // ──────────────────────────────── salir ─────────────────────────────────
  if (ruta === "/api/auth/salir" && metodo === "POST") {
    const token = tokenDe(peticion);
    if (token) cerrarSesion(base, token);
    borrarCookie(respuesta);
    responder(respuesta, 200, { salido: true });
    return true;
  }

  // ─────────────────────────── quién soy y qué puedo ──────────────────────
  if (ruta === "/api/auth/yo" && metodo === "GET") {
    const usuario = usuarioDePeticion(peticion, base);
    if (!usuario) {
      // Sin sesión no es un error: es un visitante, y se le dicen los límites que tendría.
      responder(respuesta, 200, {
        usuario: null,
        plan: "gratis",
        limites: sinInfinitos(LIMITES.gratis),
        precio: PRECIO,
      });
      return true;
    }
    responder(respuesta, 200, { usuario, ...accesoResumido(base, usuario.id) });
    return true;
  }

  // ───────────────────────────── abrir el pago ────────────────────────────
  if (ruta === "/api/suscripcion/checkout" && metodo === "POST") {
    const usuario = usuarioDePeticion(peticion, base);
    if (!usuario) {
      responder(respuesta, 401, { error: "Entra en tu cuenta para suscribirte." });
      return true;
    }

    const acceso = accesoDe(base, usuario.id);
    if (acceso.plan === "taller") {
      responder(respuesta, 409, { error: "Ya tienes la suscripción activa." });
      return true;
    }

    try {
      const checkout = await abrirCheckout(pasarela, usuario.id, usuario.correo);

      // Se guarda la referencia para reconocer la suscripción cuando llegue el webhook.
      anotarSuscripcion(base, usuario.id, "ninguna", checkout.simulado ? "simulada" : "stripe", checkout.referencia);

      responder(respuesta, 200, { url: checkout.url, simulado: checkout.simulado });
    } catch (error) {
      console.error("No se pudo abrir el pago:", error);
      responder(respuesta, 502, { error: "La pasarela de pago no responde." });
    }
    return true;
  }

  // ───────────── confirmación de la pasarela simulada (sin Stripe) ────────
  if (ruta === "/api/suscripcion/simulada/confirmar" && metodo === "POST") {
    if (conStripe(pasarela)) {
      // Con Stripe configurado esta puerta no existe: si no, sería una forma de
      // suscribirse gratis saltándose el cobro.
      responder(respuesta, 404, { error: "No disponible: el cobro va por Stripe." });
      return true;
    }

    const usuario = usuarioDePeticion(peticion, base);
    if (!usuario) {
      responder(respuesta, 401, { error: "Entra en tu cuenta." });
      return true;
    }

    const renueva = new Date(Date.now() + 30 * 86400_000).toISOString();
    anotarSuscripcion(base, usuario.id, "activa", "simulada", `simulada_${usuario.id}`, renueva);
    responder(respuesta, 200, { ...accesoResumido(base, usuario.id), simulado: true });
    return true;
  }

  // ─────────────────────────── webhook de Stripe ──────────────────────────
  if (ruta === "/api/suscripcion/webhook" && metodo === "POST") {
    const cuerpo = await leerCuerpo(peticion, respuesta);
    if (cuerpo === null) return true;

    const comprobacion = firmaStripeValida(
      cuerpo,
      cabecera(peticion, "stripe-signature"),
      pasarela.secretoWebhook,
    );
    if (!comprobacion.valida) {
      console.warn("Webhook de pago rechazado:", comprobacion.motivo);
      responder(respuesta, 401, { error: "Firma no válida." });
      return true;
    }

    let evento: { type: string; data: { object: Record<string, unknown> } };
    try {
      evento = JSON.parse(cuerpo.toString("utf8"));
    } catch {
      responder(respuesta, 400, { error: "El cuerpo no es JSON válido." });
      return true;
    }

    responder(respuesta, 200, { recibido: evento.type, ...aplicarEvento(base, evento) });
    return true;
  }

  return false;
}

/**
 * Traduce un evento de Stripe a un estado de suscripción.
 *
 * Se responde 200 aunque el evento no interese: si se devuelve error, Stripe reintenta
 * la entrega una y otra vez de algo que nunca vamos a atender.
 */
function aplicarEvento(
  base: BaseDatos,
  evento: { type: string; data: { object: Record<string, unknown> } },
): { aplicado: boolean; motivo?: string } {
  const objeto = evento.data?.object ?? {};

  switch (evento.type) {
    case "checkout.session.completed": {
      // client_reference_id lo pusimos nosotros al abrir el pago, así que es de fiar.
      const usuarioId = String(objeto.client_reference_id ?? "");
      const suscripcionId = objeto.subscription ? String(objeto.subscription) : null;
      if (!usuarioId) return { aplicado: false, motivo: "El evento no trae usuario." };

      anotarSuscripcion(base, usuarioId, "activa", "stripe", suscripcionId);
      return { aplicado: true };
    }

    case "invoice.payment_failed": {
      const usuarioId = porSuscripcion(base, objeto.subscription);
      if (!usuarioId) return { aplicado: false, motivo: "Suscripción desconocida." };
      anotarSuscripcion(base, usuarioId, "impagada", "stripe", String(objeto.subscription));
      return { aplicado: true };
    }

    case "customer.subscription.deleted": {
      const usuarioId = porSuscripcion(base, objeto.id);
      if (!usuarioId) return { aplicado: false, motivo: "Suscripción desconocida." };
      anotarSuscripcion(base, usuarioId, "cancelada", "stripe", String(objeto.id));
      return { aplicado: true };
    }

    case "customer.subscription.updated": {
      const usuarioId = porSuscripcion(base, objeto.id);
      if (!usuarioId) return { aplicado: false, motivo: "Suscripción desconocida." };

      const estadoStripe = String(objeto.status ?? "");
      const estado =
        estadoStripe === "active" || estadoStripe === "trialing"
          ? "activa"
          : estadoStripe === "past_due" || estadoStripe === "unpaid"
            ? "impagada"
            : "cancelada";

      const finPeriodo = Number(objeto.current_period_end);
      anotarSuscripcion(
        base,
        usuarioId,
        estado,
        "stripe",
        String(objeto.id),
        Number.isFinite(finPeriodo) ? new Date(finPeriodo * 1000).toISOString() : null,
      );
      return { aplicado: true };
    }

    default:
      return { aplicado: false, motivo: "Evento que no nos toca." };
  }
}

function porSuscripcion(base: BaseDatos, referencia: unknown): string | null {
  return referencia ? usuarioPorReferencia(base, String(referencia)) : null;
}

function accesoResumido(base: BaseDatos, usuarioId: string) {
  const acceso = accesoDe(base, usuarioId);
  return {
    plan: acceso.plan,
    limites: sinInfinitos(acceso.limites),
    suscripcion: acceso.suscripcion,
    planesHoy: acceso.planesHoy,
    precio: PRECIO,
  };
}

/** JSON.stringify convierte Infinity en null, que se lee fatal. Se manda -1. */
function sinInfinitos(limites: { planesPorDia: number }) {
  return {
    ...limites,
    planesPorDia: Number.isFinite(limites.planesPorDia) ? limites.planesPorDia : -1,
  };
}

async function cuerpoJson(
  peticion: IncomingMessage,
  respuesta: ServerResponse,
  ctx: Contexto,
): Promise<Record<string, unknown> | null> {
  const cuerpo = await ctx.leerCuerpo(peticion, respuesta);
  if (cuerpo === null) return null;
  try {
    return JSON.parse(cuerpo.toString("utf8")) as Record<string, unknown>;
  } catch {
    ctx.responder(respuesta, 400, { error: "El cuerpo no es JSON válido." });
    return null;
  }
}

function tokenDe(peticion: IncomingMessage): string | undefined {
  const autorizacion = cabecera(peticion, "authorization");
  if (autorizacion?.startsWith("Bearer ")) return autorizacion.slice(7).trim();

  const galletas = cabecera(peticion, "cookie");
  if (!galletas) return undefined;

  for (const trozo of galletas.split(";")) {
    const [nombre, ...resto] = trozo.trim().split("=");
    if (nombre === COOKIE) return resto.join("=");
  }
  return undefined;
}

function ponerCookie(respuesta: ServerResponse, token: string, caduca: string): void {
  // httpOnly para que no la lea el JavaScript de la página; SameSite=Lax para que no
  // viaje desde otro sitio. Sin Secure porque en desarrollo se sirve por http; en
  // producción, detrás de https, hay que añadirlo.
  respuesta.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${new Date(caduca).toUTCString()}`,
  );
}

function borrarCookie(respuesta: ServerResponse): void {
  respuesta.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function cabecera(peticion: IncomingMessage, nombre: string): string | undefined {
  const valor = peticion.headers[nombre];
  return Array.isArray(valor) ? valor[0] : valor;
}
