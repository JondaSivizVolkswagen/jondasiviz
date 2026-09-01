// Arranca la API.
//
//   npm run api          escucha en http://localhost:3001
//
// Variables de entorno:
//   PORT                    puerto, 3001 por defecto
//   JONDA_DB_URL            base en Turso (libsql://...). Sin ella, fichero local
//   JONDA_DB_TOKEN          el token de Turso, obligatorio con JONDA_DB_URL
//   JONDA_DB                ruta del fichero local, datos/jondasiviz.db por defecto
//   JONDA_WEBHOOK_SECRET    secreto del webhook de GitHub
//   STRIPE_SECRET_KEY       si está, se cobra de verdad; si no, pasarela simulada
//   STRIPE_WEBHOOK_SECRET   secreto del webhook de Stripe
//
// Si la base está vacía se siembra sola al arrancar, para no obligar a acordarse de un
// paso previo. Resembrar es idempotente: deja la base igual que los JSON.

import { cargarEntorno } from "../config/entorno.ts";
import { cargarCatalogo } from "../engine/catalog.ts";
import { cargarModelos } from "../engine/graph.ts";
import { estaSembrada } from "../db/consultas.ts";
import { sembrar } from "../db/sembrar.ts";
import { abrirBase, RUTA_BD } from "../db/sqlite.ts";
import { crearServidor } from "./servidor.ts";

// Antes de nada: las variables del .env, que deciden a qué base se conecta.
cargarEntorno();

const puerto = Number(process.env.PORT ?? 3001);
const secretoWebhook = process.env.JONDA_WEBHOOK_SECRET ?? "";

const base = await abrirBase();

if (base.enLaNube && !process.env.JONDA_DB_TOKEN) {
  console.error("Hay JONDA_DB_URL pero falta JONDA_DB_TOKEN: Turso rechazará la conexión.");
  process.exit(1);
}

if (!(await estaSembrada(base))) {
  const resultado = await sembrar(base, cargarCatalogo(), cargarModelos(), "arranque");
  console.log(`Base vacía: sembradas ${resultado.piezas} piezas y ${resultado.modelos} modelos.`);
}

const servidor = crearServidor({ base, secretoWebhook });

servidor.listen(puerto, () => {
  console.log(`API escuchando en http://localhost:${puerto}`);
  console.log(`Base de datos: ${base.enLaNube ? process.env.JONDA_DB_URL : RUTA_BD}`);
  if (!secretoWebhook) {
    console.log(
      "Aviso: sin JONDA_WEBHOOK_SECRET, /api/webhook/github rechaza cualquier entrega.",
    );
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log("Aviso: sin STRIPE_SECRET_KEY, el pago va por la pasarela simulada.");
  }
});

// Sin esto la base se queda con el fichero abierto y el WAL sin volcar al salir.
for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, () => {
    console.log("\nCerrando.");
    servidor.close(() => {
      base.cerrar();
      process.exit(0);
    });
  });
}
