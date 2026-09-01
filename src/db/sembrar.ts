// Vuelca el catálogo y los modelos a la base de datos.
//
// La fuente de verdad sigue siendo el vault de Obsidian: se edita ahí, `npm run
// vault:ingest` genera src/data/*.json y esto los mete en SQLite. No se edita la base a
// mano, igual que no se edita el catálogo a mano.
//
// Todo va dentro de una transacción: o entra el catálogo entero o no entra nada. A
// medias dejaría la API sirviendo un catálogo incoherente, con piezas que exigen otras
// que todavía no están.

import type { Catalogo, CatalogoModelos } from "../engine/types.ts";
import type { BaseDatos } from "./sqlite.ts";

export interface ResultadoSiembra {
  piezas: number;
  modelos: number;
}

/**
 * Deja la base con exactamente lo que traen el catálogo y los modelos. Lo que hubiera
 * antes se borra: es un reemplazo, no una mezcla.
 *
 * @param origen De dónde vino la orden ("cli", "webhook", "test"), para el registro.
 */
export function sembrar(
  base: BaseDatos,
  catalogo: Catalogo,
  modelos: CatalogoModelos,
  origen = "cli",
): ResultadoSiembra {
  const meta = base.prepare("INSERT OR REPLACE INTO meta(clave, valor) VALUES (?, ?)");

  const insPieza = base.prepare(`
    INSERT INTO pieza (id, nombre, categoria, gama, precio_min, precio_estimado,
                       precio_max, impacto, grupo_exclusivo, stage, nota, imagen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insPlataforma = base.prepare(
    "INSERT INTO pieza_plataforma (pieza_id, plataforma) VALUES (?, ?)",
  );
  const insObjetivo = base.prepare(
    "INSERT INTO pieza_objetivo (pieza_id, objetivo, peso) VALUES (?, ?, ?)",
  );
  const insRequiere = base.prepare(
    "INSERT INTO pieza_requiere (pieza_id, requiere_id) VALUES (?, ?)",
  );
  const insModelo = base.prepare(`
    INSERT INTO modelo (id, nombre, chasis, motor, motor_detalle, traccion,
                        anio_inicio, anio_fin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insAlias = base.prepare("INSERT INTO modelo_alias (modelo_id, alias) VALUES (?, ?)");
  const insSiembra = base.prepare(
    "INSERT INTO siembra (fecha, origen, piezas, modelos) VALUES (?, ?, ?, ?)",
  );

  base.exec("BEGIN");
  try {
    // El orden importa: las hijas antes que la madre, o saltan las claves foráneas.
    base.exec("DELETE FROM pieza_requiere");
    base.exec("DELETE FROM pieza_objetivo");
    base.exec("DELETE FROM pieza_plataforma");
    base.exec("DELETE FROM pieza");
    base.exec("DELETE FROM modelo_alias");
    base.exec("DELETE FROM modelo");

    meta.run("catalogo_version", catalogo.version);
    meta.run("moneda", catalogo.moneda);
    meta.run("modelos_version", modelos.version);

    for (const pieza of catalogo.piezas) {
      insPieza.run(
        pieza.id,
        pieza.nombre,
        pieza.categoria,
        pieza.gama,
        pieza.precio.min,
        pieza.precio.estimado,
        pieza.precio.max,
        pieza.impacto,
        pieza.grupoExclusivo ?? null,
        pieza.stage ?? null,
        pieza.nota ?? null,
        pieza.imagen ?? null,
      );

      for (const plataforma of pieza.plataformas) insPlataforma.run(pieza.id, plataforma);

      for (const [objetivo, peso] of Object.entries(pieza.objetivos)) {
        insObjetivo.run(pieza.id, objetivo, peso);
      }

      for (const requisito of pieza.requiere) insRequiere.run(pieza.id, requisito);
    }

    for (const modelo of modelos.modelos) {
      insModelo.run(
        modelo.id,
        modelo.nombre,
        modelo.chasis,
        modelo.motor,
        modelo.motorDetalle,
        modelo.traccion,
        modelo.anios[0],
        modelo.anios[1],
      );
      for (const alias of modelo.alias) insAlias.run(modelo.id, alias);
    }

    insSiembra.run(
      new Date().toISOString(),
      origen,
      catalogo.piezas.length,
      modelos.modelos.length,
    );

    base.exec("COMMIT");
  } catch (error) {
    base.exec("ROLLBACK");
    throw error;
  }

  return { piezas: catalogo.piezas.length, modelos: modelos.modelos.length };
}
