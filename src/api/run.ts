// Arranca la API.
//
//   npm run api          escucha en http://localhost:3001
//
// Variables de entorno:
//   PORT                    puerto, 3001 por defecto
//   JONDA_DB                ruta de la base, datos/jondasiviz.db por defecto
//   JONDA_WEBHOOK_SECRET    secreto del webhook de GitHub, obligatorio para usarlo
//
// Si la base está vacía se siembra sola al arrancar, para no obligar a acordarse de un
// paso previo. Resembrar es idempotente: deja la base igual que los JSON.

import { cargarCatalogo } from "../engine/catalog.ts";
import { cargarModelos } from "../engine/graph.ts";
import { estaSembrada } from "../db/consultas.ts";
import { sembrar } from "../db/sembrar.ts";
import { abrirBase, RUTA_BD } from "../db/sqlite.ts";
import { crearServidor } from "./servidor.ts";

const puerto = Number(process.env.PORT ?? 3001);
const secretoWebhook = process.env.JONDA_WEBHOOK_SECRET ?? "";

const base = abrirBase();

if (!estaSembrada(base)) {
  const resultado = sembrar(base, cargarCatalogo(), cargarModelos(), "arranque");
  console.log(`Base vacía: sembradas ${resultado.piezas} piezas y ${resultado.modelos} modelos.`);
}

const servidor = crearServidor({ base, secretoWebhook });

servidor.listen(puerto, () => {
  console.log(`API escuchando en http://localhost:${puerto}`);
  console.log(`Base de datos: ${RUTA_BD}`);
  if (!secretoWebhook) {
    console.log(
      "Aviso: sin JONDA_WEBHOOK_SECRET, /api/webhook/github rechaza cualquier entrega.",
    );
  }
});

// Sin esto la base se queda con el fichero abierto y el WAL sin volcar al salir.
for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, () => {
    console.log("\nCerrando.");
    servidor.close(() => {
      base.close();
      process.exit(0);
    });
  });
}
