// Código maestro: abre la herramienta completa sin pasar por el pago.
//
// Sirve para enseñar la aplicación sin montar una tarjeta de prueba, y para que quien
// la mantiene pueda entrar. No es una forma de saltarse el cobro a escondidas: quien lo
// usa queda anotado en su suscripción con proveedor "codigo", así que en la base se ve
// perfectamente quién entró pagando y quién con el código.
//
// **El código vive en JONDA_CODIGO_MAESTRO, nunca escrito aquí.** Este repositorio es
// público: una contraseña escrita en el fuente la lee cualquiera que lo clone, y con
// ella se daría la suscripción gratis. En el fichero .env, que no se sube, no.
//
// Si la variable no está puesta, la puerta simplemente no existe.

import { timingSafeEqual } from "node:crypto";

/** El código configurado, o cadena vacía si no hay ninguno. */
export function codigoConfigurado(): string {
  return process.env.JONDA_CODIGO_MAESTRO ?? "";
}

export function hayCodigo(): boolean {
  return codigoConfigurado().length > 0;
}

/**
 * Comprueba un código contra el configurado.
 *
 * Va con timingSafeEqual y no con ===, por lo mismo que las firmas de los webhooks:
 * comparar cadenas se detiene en el primer carácter distinto, y ese tiempo de más deja
 * ir adivinándolo letra a letra.
 */
export function codigoCorrecto(entregado: string): boolean {
  const esperado = codigoConfigurado();
  if (!esperado) return false;

  const a = Buffer.from(entregado);
  const b = Buffer.from(esperado);

  // timingSafeEqual exige que midan lo mismo. El largo no es el secreto.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
