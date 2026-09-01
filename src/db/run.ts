// Siembra la base de datos desde los JSON del catálogo.
//
//   npm run db:sembrar          escribe en datos/jondasiviz.db, o en Turso si hay JONDA_DB_URL
//   npm run db:sembrar -- --ver enseña lo que hay dentro sin tocar nada
//
// Es el paso que va después de `npm run vault:ingest`: el vault genera los JSON y esto
// los mete en la base que consulta la API.

import { cargarEntorno } from "../config/entorno.ts";
import { cargarCatalogo } from "../engine/catalog.ts";
import { cargarModelos } from "../engine/graph.ts";
import { leerCatalogo, leerModelos, ultimaSiembra } from "./consultas.ts";
import { sembrar } from "./sembrar.ts";
import { abrirBase, RUTA_BD } from "./sqlite.ts";

// Antes de nada: las variables del .env, que deciden a qué base se conecta.
cargarEntorno();

const soloVer = process.argv.includes("--ver");
const base = await abrirBase();
const donde = base.enLaNube ? `Turso (${process.env.JONDA_DB_URL})` : RUTA_BD;

if (soloVer) {
  const [catalogo, modelos, ultima] = await Promise.all([
    leerCatalogo(base),
    leerModelos(base),
    ultimaSiembra(base),
  ]);

  console.log(`Base: ${donde}`);
  console.log(`Catálogo ${catalogo.version || "(vacío)"} · ${catalogo.piezas.length} piezas`);
  console.log(`Modelos  ${modelos.version || "(vacío)"} · ${modelos.modelos.length} coches`);
  console.log(
    ultima
      ? `Última siembra: ${ultima.fecha} desde ${ultima.origen}`
      : "Todavía no se ha sembrado nunca.",
  );
} else {
  const resultado = await sembrar(base, cargarCatalogo(), cargarModelos(), "cli");
  console.log(`Base: ${donde}`);
  console.log(`Sembradas ${resultado.piezas} piezas y ${resultado.modelos} modelos.`);
}

base.cerrar();
