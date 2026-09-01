// Migraciones del esquema.
//
// `CREATE TABLE IF NOT EXISTS` crea la tabla que falta, pero no toca la que ya está: si
// se añade una columna, las bases que ya existían se quedan sin ella y todo lo que la
// use revienta. En local no se nota, porque uno borra el fichero y a correr. En la base
// de la nube no se puede borrar nada: hay cuentas de gente dentro.
//
// Por eso las columnas que se añaden después van aquí. Cada migración se aplica solo si
// hace falta, y volver a lanzarla no rompe nada: se mira qué columnas hay antes de
// intentar añadirlas.

import type { BaseDatos } from "./sqlite.ts";

/** Columnas que se añadieron después de la primera versión del esquema. */
const COLUMNAS_AÑADIDAS: { tabla: string; columna: string; definicion: string }[] = [
  { tabla: "usuario", columna: "nombre", definicion: "TEXT NOT NULL DEFAULT ''" },
  { tabla: "usuario", columna: "coche", definicion: "TEXT NOT NULL DEFAULT ''" },
  { tabla: "usuario", columna: "visto", definicion: "TEXT" },
  { tabla: "usuario", columna: "foto", definicion: "TEXT NOT NULL DEFAULT ''" },
  { tabla: "usuario", columna: "ciudad", definicion: "TEXT NOT NULL DEFAULT ''" },
  { tabla: "usuario", columna: "sobre_mi", definicion: "TEXT NOT NULL DEFAULT ''" },
];

/**
 * Pone al día una base que se creó con un esquema anterior. Devuelve lo que ha tenido
 * que añadir, que en una base recién creada es una lista vacía.
 */
export async function aplicarMigraciones(base: BaseDatos): Promise<string[]> {
  const aplicadas: string[] = [];

  // Se agrupan por tabla para no preguntar sus columnas una vez por cada columna.
  const tablas = [...new Set(COLUMNAS_AÑADIDAS.map((c) => c.tabla))];

  for (const tabla of tablas) {
    const columnas = await columnasDe(base, tabla);
    if (columnas.size === 0) continue; // la tabla no existe todavía; el esquema la creará

    for (const pendiente of COLUMNAS_AÑADIDAS.filter((c) => c.tabla === tabla)) {
      if (columnas.has(pendiente.columna)) continue;

      await base.ejecutar(
        `ALTER TABLE ${pendiente.tabla} ADD COLUMN ${pendiente.columna} ${pendiente.definicion}`,
      );
      aplicadas.push(`${pendiente.tabla}.${pendiente.columna}`);
    }
  }

  return aplicadas;
}

async function columnasDe(base: BaseDatos, tabla: string): Promise<Set<string>> {
  try {
    const filas = await base.todos<{ name: string }>(`PRAGMA table_info(${tabla})`);
    return new Set(filas.map((f) => f.name));
  } catch {
    // La tabla no existe: no hay nada que migrar.
    return new Set();
  }
}
