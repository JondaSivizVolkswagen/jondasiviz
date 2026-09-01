// Conexión con la base de datos.
//
// Se habla con libSQL, que es SQLite, y por eso la misma conexión sirve para los dos
// sitios donde vive la base:
//
//   Local  `file:datos/jondasiviz.db`, un fichero en el disco. Es lo que se usa mientras
//          se programa y en los tests, sin cuentas ni conexión.
//   Turso  `libsql://...`, la base en internet. Es la que hace falta en cuanto la API
//          deja de correr solo en el ordenador de uno, porque un fichero local no lo
//          pueden compartir dos servidores ni sobrevive a un despliegue.
//
// Lo elige `JONDA_DB_URL`: si no está, fichero. El esquema, las consultas y los tests
// son exactamente los mismos en los dos casos, así que no hay una versión "de verdad" y
// otra de mentira que puedan separarse.
//
// Todo es asíncrono aunque en local no haga falta: contra Turso cada consulta es una
// petición HTTP, y fingir que es instantáneo solo serviría para tener que reescribirlo
// entero el día que se enchufe.

import { createClient, type Client, type InArgs } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ESQUEMA } from "./esquema.ts";

/** Dónde vive la base por defecto, cuando no se dice otra cosa. */
export const RUTA_BD = process.env.JONDA_DB ?? resolve(process.cwd(), "datos/jondasiviz.db");

export interface BaseDatos {
  /** Una sentencia que no devuelve filas. */
  ejecutar(sql: string, args?: InArgs): Promise<void>;
  /** Todas las filas de una consulta. */
  todos<T>(sql: string, args?: InArgs): Promise<T[]>;
  /** La primera fila, o null si no hay ninguna. */
  uno<T>(sql: string, args?: InArgs): Promise<T | null>;
  /** Varias sentencias como una sola transacción: entran todas o no entra ninguna. */
  lote(sentencias: { sql: string; args?: InArgs }[]): Promise<void>;
  cerrar(): void;
  /** true si está hablando con Turso y no con un fichero. */
  readonly enLaNube: boolean;
}

/**
 * Abre la base y crea las tablas si no están.
 *
 * @param url Fuerza un destino concreto. ":memory:" para una base efímera, que es lo que
 *            usan los tests para no pisarse entre ellos.
 */
export async function abrirBase(url?: string): Promise<BaseDatos> {
  const destino = url ?? destinoPorDefecto();
  const enLaNube = destino.startsWith("libsql://") || destino.startsWith("https://");

  if (!enLaNube && destino.startsWith("file:")) {
    mkdirSync(dirname(destino.slice("file:".length)), { recursive: true });
  }

  const cliente: Client = createClient(
    enLaNube
      ? { url: destino, authToken: process.env.JONDA_DB_TOKEN ?? "" }
      : { url: destino },
  );

  const base = envolver(cliente, enLaNube);

  // Sin esto SQLite ignora las claves foráneas, que es su comportamiento por defecto por
  // compatibilidad hacia atrás. En Turso ya vienen activadas y el PRAGMA no molesta.
  if (!enLaNube) await base.ejecutar("PRAGMA foreign_keys = ON");

  // El esquema son varias sentencias; el cliente ejecuta una por llamada.
  for (const sentencia of ESQUEMA.split(";")) {
    const limpia = sentencia.trim();
    if (limpia) await base.ejecutar(limpia);
  }

  return base;
}

function destinoPorDefecto(): string {
  const remota = process.env.JONDA_DB_URL;
  if (remota) return remota;
  return `file:${RUTA_BD}`;
}

function envolver(cliente: Client, enLaNube: boolean): BaseDatos {
  return {
    enLaNube,

    async ejecutar(sql, args) {
      await cliente.execute(args === undefined ? sql : { sql, args });
    },

    async todos<T>(sql: string, args?: InArgs): Promise<T[]> {
      const resultado = await cliente.execute(args === undefined ? sql : { sql, args });
      // Las filas de libSQL son objetos con prototipo nulo y campos extra; se copian a
      // objetos normales para que comparaciones y `...` se comporten sin sorpresas.
      return resultado.rows.map((fila) => ({ ...fila }) as T);
    },

    async uno<T>(sql: string, args?: InArgs): Promise<T | null> {
      const filas = await this.todos<T>(sql, args);
      return filas[0] ?? null;
    },

    async lote(sentencias) {
      if (sentencias.length === 0) return;
      await cliente.batch(
        sentencias.map((s) => (s.args === undefined ? s.sql : { sql: s.sql, args: s.args })),
        "write",
      );
    },

    cerrar() {
      cliente.close();
    },
  };
}
