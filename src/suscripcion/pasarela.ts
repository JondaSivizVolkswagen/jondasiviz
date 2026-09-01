// La pasarela de pago.
//
// Hay dos, y la que se usa depende de si hay claves configuradas:
//
//   Stripe    cuando existe STRIPE_SECRET_KEY. Es la de verdad, hablando con su API por
//             HTTP. No se añade su librería: son dos llamadas y una firma que comprobar,
//             y el resto del proyecto tampoco usa framework.
//   Simulada  cuando no hay claves. Marca al usuario como suscrito sin cobrar nada, para
//             poder probar el flujo en cualquier ordenador.
//
// Las dos entran por la misma puerta, así que el resto del código no sabe cuál está
// activa. La clave secreta solo vive aquí, en el servidor: nunca en el navegador ni
// dentro de la aplicación de escritorio, donde cualquiera podría sacarla del ejecutable.

import { createHmac, timingSafeEqual } from "node:crypto";
import { PRECIO } from "./planes.ts";

export interface Configuracion {
  claveSecreta: string;
  secretoWebhook: string;
  /** Id del precio ya creado en Stripe (price_...). Si falta, se manda el importe suelto. */
  precioId: string;
  /** A dónde vuelve el navegador al terminar. */
  urlVuelta: string;
}

export function configurar(): Configuracion {
  return {
    claveSecreta: process.env.STRIPE_SECRET_KEY ?? "",
    secretoWebhook: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    precioId: process.env.STRIPE_PRECIO_ID ?? "",
    urlVuelta: process.env.JONDA_URL ?? "http://localhost:5173",
  };
}

/** true cuando hay claves de Stripe y por tanto se cobra de verdad. */
export function conStripe(config: Configuracion): boolean {
  return config.claveSecreta.length > 0;
}

export interface Checkout {
  /** A dónde hay que mandar al usuario para que pague. */
  url: string;
  /** Identificador de la sesión de pago, para cruzarla después. */
  referencia: string;
  simulado: boolean;
}

/**
 * Abre un pago. Con Stripe crea una sesión de Checkout; sin claves devuelve una URL de
 * la pasarela simulada del propio proyecto.
 */
export async function abrirCheckout(
  config: Configuracion,
  usuarioId: string,
  correo: string,
): Promise<Checkout> {
  if (!conStripe(config)) {
    return {
      url: `${config.urlVuelta}/pago-simulado.html?usuario=${encodeURIComponent(usuarioId)}`,
      referencia: `simulada_${usuarioId}`,
      simulado: true,
    };
  }

  // La API de Stripe habla formularios, no JSON.
  const cuerpo = new URLSearchParams({
    mode: "subscription",
    success_url: `${config.urlVuelta}/herramienta.html?suscripcion=lista`,
    cancel_url: `${config.urlVuelta}/herramienta.html?suscripcion=cancelada`,
    customer_email: correo,
    // Vuelve dentro del webhook, y es lo que permite saber a quién apuntar el pago sin
    // fiarse de nada que venga del navegador.
    client_reference_id: usuarioId,
    "metadata[usuario_id]": usuarioId,
  });

  if (config.precioId) {
    cuerpo.set("line_items[0][price]", config.precioId);
    cuerpo.set("line_items[0][quantity]", "1");
  } else {
    cuerpo.set("line_items[0][price_data][currency]", PRECIO.moneda);
    cuerpo.set("line_items[0][price_data][unit_amount]", String(PRECIO.centimos));
    cuerpo.set("line_items[0][price_data][recurring][interval]", "month");
    cuerpo.set("line_items[0][price_data][product_data][name]", "JondaSiviz Taller");
    cuerpo.set("line_items[0][quantity]", "1");
  }

  const respuesta = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.claveSecreta}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: cuerpo,
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Stripe respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  const sesion = (await respuesta.json()) as { id: string; url: string };
  return { url: sesion.url, referencia: sesion.id, simulado: false };
}

/**
 * Comprueba la firma de un webhook de Stripe.
 *
 * Stripe firma "timestamp.cuerpo" con HMAC SHA-256 y lo manda en la cabecera
 * Stripe-Signature, con la forma "t=...,v1=...". Se comprueba también que el momento no
 * sea viejo: si no, cualquiera que capture una entrega válida podría reenviarla las
 * veces que quiera y renovar una suscripción cancelada.
 */
export function firmaStripeValida(
  cuerpo: Buffer,
  cabecera: string | undefined,
  secreto: string,
  toleranciaSegundos = 300,
): { valida: true } | { valida: false; motivo: string } {
  if (!secreto) return { valida: false, motivo: "Falta STRIPE_WEBHOOK_SECRET." };
  if (!cabecera) return { valida: false, motivo: "Falta la cabecera Stripe-Signature." };

  const partes = new Map(
    cabecera.split(",").map((trozo) => {
      const corte = trozo.indexOf("=");
      return [trozo.slice(0, corte).trim(), trozo.slice(corte + 1).trim()] as const;
    }),
  );

  const momento = partes.get("t");
  const firma = partes.get("v1");
  if (!momento || !firma) return { valida: false, motivo: "La cabecera no trae t y v1." };

  const edad = Math.abs(Date.now() / 1000 - Number(momento));
  if (!Number.isFinite(edad) || edad > toleranciaSegundos) {
    return { valida: false, motivo: "La entrega es demasiado vieja." };
  }

  const esperada = createHmac("sha256", secreto)
    .update(`${momento}.${cuerpo.toString("utf8")}`)
    .digest("hex");

  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return { valida: false, motivo: "La firma no coincide." };

  return timingSafeEqual(a, b) ? { valida: true } : { valida: false, motivo: "La firma no coincide." };
}
