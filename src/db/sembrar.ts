// Vuelca el catálogo y los modelos a la base de datos.
//
// La fuente de verdad sigue siendo el vault de Obsidian: se edita ahí, `npm run
// vault:ingest` genera src/data/*.json y esto los mete en la base. No se edita la base a
// mano, igual que no se edita el catálogo a mano.
//
// Todo va en un único lote, que la base ejecuta como una transacción: o entra el
// catálogo entero o no entra nada. A medias dejaría la API sirviendo piezas que exigen
// otras que todavía no están. Además, contra Turso cada sentencia suelta sería un viaje
// por la red; mandarlas juntas es la diferencia entre un segundo y varios minutos.

import type { Catalogo, CatalogoModelos } from "../engine/types.ts";
import type { BaseDatos } from "./sqlite.ts";
import type { InArgs } from "@libsql/client";

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
export async function sembrar(
  base: BaseDatos,
  catalogo: Catalogo,
  modelos: CatalogoModelos,
  origen = "cli",
): Promise<ResultadoSiembra> {
  const lote: { sql: string; args?: InArgs }[] = [];
  const añadir = (sql: string, args?: InArgs) => lote.push({ sql, args });

  // El orden importa: las hijas antes que la madre, o saltan las claves foráneas.
  for (const tabla of [
    "pieza_requiere",
    "pieza_objetivo",
    "pieza_plataforma",
    "pieza_chasis",
    "pieza_traccion",
    "pieza_equipamiento",
    "pieza",
    "modelo_alias",
    "modelo_equipamiento",
    "modelo",
  ]) {
    añadir(`DELETE FROM ${tabla}`);
  }

  for (const [clave, valor] of [
    ["catalogo_version", catalogo.version],
    ["moneda", catalogo.moneda],
    ["modelos_version", modelos.version],
  ]) {
    añadir("INSERT OR REPLACE INTO meta(clave, valor) VALUES (?, ?)", [clave, valor]);
  }

  for (const pieza of catalogo.piezas) {
    añadir(
      `INSERT INTO pieza (id, nombre, categoria, gama, precio_min, precio_estimado,
                          precio_max, impacto, legalidad, grupo_exclusivo, stage, nota, imagen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pieza.id,
        pieza.nombre,
        pieza.categoria,
        pieza.gama,
        pieza.precio.min,
        pieza.precio.estimado,
        pieza.precio.max,
        pieza.impacto,
        pieza.legalidad,
        pieza.grupoExclusivo ?? null,
        pieza.stage ?? null,
        pieza.nota ?? null,
        pieza.imagen ?? null,
      ],
    );

    for (const plataforma of pieza.plataformas) {
      añadir("INSERT INTO pieza_plataforma (pieza_id, plataforma) VALUES (?, ?)", [
        pieza.id,
        plataforma,
      ]);
    }
    for (const chasis of pieza.chasis) {
      añadir("INSERT INTO pieza_chasis (pieza_id, chasis) VALUES (?, ?)", [pieza.id, chasis]);
    }
    for (const traccion of pieza.traccion) {
      añadir("INSERT INTO pieza_traccion (pieza_id, traccion) VALUES (?, ?)", [
        pieza.id,
        traccion,
      ]);
    }
    for (const [relacion, lista] of [
      ["sustituye", pieza.sustituye],
      ["exige", pieza.exige],
      ["chocaCon", pieza.chocaCon],
    ] as const) {
      for (const equipo of lista) {
        añadir(
          "INSERT INTO pieza_equipamiento (pieza_id, relacion, equipamiento) VALUES (?, ?, ?)",
          [pieza.id, relacion, equipo],
        );
      }
    }
    for (const [objetivo, peso] of Object.entries(pieza.objetivos)) {
      añadir("INSERT INTO pieza_objetivo (pieza_id, objetivo, peso) VALUES (?, ?, ?)", [
        pieza.id,
        objetivo,
        peso,
      ]);
    }
    for (const requisito of pieza.requiere) {
      añadir("INSERT INTO pieza_requiere (pieza_id, requiere_id) VALUES (?, ?)", [
        pieza.id,
        requisito,
      ]);
    }
  }

  for (const modelo of modelos.modelos) {
    añadir(
      `INSERT INTO modelo (id, nombre, chasis, motor, motor_detalle, traccion, propulsion,
                           anio_inicio, anio_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        modelo.id,
        modelo.nombre,
        modelo.chasis,
        modelo.motor,
        modelo.motorDetalle,
        modelo.traccion,
        modelo.propulsion,
        modelo.anios[0],
        modelo.anios[1],
      ],
    );
    for (const alias of modelo.alias) {
      añadir("INSERT INTO modelo_alias (modelo_id, alias) VALUES (?, ?)", [modelo.id, alias]);
    }
    for (const equipo of modelo.equipamiento) {
      añadir("INSERT INTO modelo_equipamiento (modelo_id, equipamiento) VALUES (?, ?)", [
        modelo.id,
        equipo,
      ]);
    }
  }

  añadir("INSERT INTO siembra (fecha, origen, piezas, modelos) VALUES (?, ?, ?, ?)", [
    new Date().toISOString(),
    origen,
    catalogo.piezas.length,
    modelos.modelos.length,
  ]);

  await base.lote(lote);

  return { piezas: catalogo.piezas.length, modelos: modelos.modelos.length };
}
