// Siembra la base de datos desde los JSON del catálogo.
//
//   npm run db:sembrar          escribe en datos/jondasiviz.db
//   npm run db:sembrar -- --ver enseña lo que hay dentro sin tocar nada
//
// Es el paso que va después de `npm run vault:ingest`: el vault genera los JSON y esto
// los mete en la base que consulta la API.

import { cargarCatalogo } from "../engine/catalog.ts";
import { cargarModelos } from "../engine/graph.ts";
import { leerCatalogo, leerModelos, ultimaSiembra } from "./consultas.ts";
import { sembrar } from "./sembrar.ts";
import { abrirBase, RUTA_BD } from "./sqlite.ts";

const soloVer = process.argv.includes("--ver");
const base = abrirBase();

if (soloVer) {
  const catalogo = leerCatalogo(base);
  const modelos = leerModelos(base);
  const ultima = ultimaSiembra(base);

  console.log(`Base: ${RUTA_BD}`);
  console.log(`Catálogo ${catalogo.version || "(vacío)"} · ${catalogo.piezas.length} piezas`);
  console.log(`Modelos  ${modelos.version || "(vacío)"} · ${modelos.modelos.length} coches`);
  console.log(
    ultima
      ? `Última siembra: ${ultima.fecha} desde ${ultima.origen}`
      : "Todavía no se ha sembrado nunca.",
  );
} else {
  const resultado = sembrar(base, cargarCatalogo(), cargarModelos(), "cli");
  console.log(`Base: ${RUTA_BD}`);
  console.log(`Sembradas ${resultado.piezas} piezas y ${resultado.modelos} modelos.`);
}

base.close();
