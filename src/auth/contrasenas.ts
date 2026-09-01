// Guardado y comprobación de contraseñas.
//
// Nunca se guarda la contraseña, se guarda su huella con scrypt, que viene en Node y
// está pensado justo para esto: es lento y consume memoria a propósito, de forma que
// probar millones de contraseñas por fuerza bruta salga caro. Un SHA-256 pelado, que es
// el error habitual, se prueba a miles de millones por segundo en una tarjeta gráfica.
//
// Cada usuario lleva su propia sal, así dos personas con la misma contraseña tienen
// huellas distintas y no se pueden usar tablas precalculadas.

import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// scrypt tiene dos formas, con y sin opciones, y promisify se queda con la primera. Se
// tipa a mano para poder pasarle el coste, que es justo lo que hace falta aquí.
const scrypt = promisify(scryptCb) as (
  contrasena: string,
  sal: string,
  largo: number,
  opciones: ScryptOptions,
) => Promise<Buffer>;

/** Coste de scrypt. 2^16 es la recomendación actual para un inicio de sesión. */
const COSTE = 65536;

/**
 * Cuánta memoria se le deja usar. Con N=65536 y r=8, scrypt necesita 128*N*r, o sea 64
 * MB, y Node corta en 32 por defecto: sin esto revienta con "memory limit exceeded".
 * Se sube el techo en vez de bajar el coste, porque ese consumo de memoria es
 * justamente lo que encarece atacar las contraseñas por fuerza bruta.
 */
const MEMORIA_MAXIMA = 128 * 1024 * 1024;
const LARGO_HUELLA = 64;
const LARGO_SAL = 16;

/** Lo mínimo que se le exige a una contraseña. */
export const MINIMO_CONTRASENA = 8;

export interface Guardada {
  huella: string;
  sal: string;
}

export async function cifrar(contrasena: string): Promise<Guardada> {
  const sal = randomBytes(LARGO_SAL).toString("hex");
  const huella = await scrypt(contrasena, sal, LARGO_HUELLA, { N: COSTE, maxmem: MEMORIA_MAXIMA });
  return { huella: huella.toString("hex"), sal };
}

/**
 * Comprueba una contraseña contra lo guardado.
 *
 * La comparación va con timingSafeEqual y no con ===, por lo mismo que en el webhook:
 * comparar cadenas se detiene en el primer carácter distinto y ese tiempo de más filtra
 * información.
 */
export async function comprobar(contrasena: string, guardada: Guardada): Promise<boolean> {
  const calculada = (await scrypt(contrasena, guardada.sal, LARGO_HUELLA, {
    N: COSTE,
    maxmem: MEMORIA_MAXIMA,
  })) as Buffer;
  const almacenada = Buffer.from(guardada.huella, "hex");

  if (calculada.length !== almacenada.length) return false;
  return timingSafeEqual(calculada, almacenada);
}

/** Motivo por el que una contraseña no vale, o null si vale. */
export function problemaCon(contrasena: string): string | null {
  if (contrasena.length < MINIMO_CONTRASENA) {
    return `La contraseña tiene que tener al menos ${MINIMO_CONTRASENA} caracteres.`;
  }
  return null;
}

/** Comprobación de correo deliberadamente simple: la de verdad es mandar un correo. */
export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo);
}
