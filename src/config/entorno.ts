// Carga el fichero .env, si lo hay.
//
// Lo hace Node por su cuenta desde la 20.6, así que no hace falta ninguna librería. El
// fichero no se sube nunca: ahí viven el token de la base y las claves de Stripe, y
// meterlas en el repositorio es regalárselas a cualquiera que lo clone.
//
// Que no exista es lo normal, no un error: sin él el proyecto funciona igual, con la
// base en un fichero local y el pago simulado.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

let cargado = false;

/** Mete en process.env lo que haya en .env. Solo la primera vez que se llama. */
export function cargarEntorno(): void {
  if (cargado) return;
  cargado = true;

  const ruta = resolve(process.cwd(), ".env");
  if (!existsSync(ruta)) return;

  try {
    process.loadEnvFile(ruta);
  } catch (error) {
    // Un .env con una línea mal escrita no puede tumbar el arranque sin decir por qué.
    console.warn("No se pudo leer .env:", error instanceof Error ? error.message : error);
  }
}
