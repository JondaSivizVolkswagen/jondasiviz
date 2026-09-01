// Apertura de la base de datos.
//
// Usa el SQLite que trae Node desde la 22 (`node:sqlite`), así que no hay que instalar
// ni un paquete ni un servidor: la base es un fichero. Para los tests se abre en
// memoria, que además los deja aislados unos de otros.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ESQUEMA } from "./esquema.ts";

/** Dónde vive la base por defecto. Se puede cambiar con JONDA_DB. */
export const RUTA_BD = process.env.JONDA_DB ?? resolve(process.cwd(), "datos/jondasiviz.db");

export type BaseDatos = DatabaseSync;

/**
 * Abre la base y crea las tablas si no están. Pasa ":memory:" para una base efímera.
 */
export function abrirBase(ruta: string = RUTA_BD): BaseDatos {
  if (ruta !== ":memory:") mkdirSync(dirname(ruta), { recursive: true });

  const base = new DatabaseSync(ruta);

  // Sin esto SQLite ignora las claves foráneas, que es su comportamiento por defecto
  // por compatibilidad hacia atrás. Se activa por conexión, no por fichero.
  base.exec("PRAGMA foreign_keys = ON");

  // WAL deja leer mientras se escribe, que es justo lo que pasa cuando el webhook
  // resiembra con la API sirviendo peticiones. En memoria no aplica.
  if (ruta !== ":memory:") base.exec("PRAGMA journal_mode = WAL");

  base.exec(ESQUEMA);
  return base;
}
