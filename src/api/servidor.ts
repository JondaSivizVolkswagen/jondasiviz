// API HTTP del planner.
//
// Sirve el catálogo desde SQLite y calcula presupuestos con el mismo motor que usa la
// web. Eso es lo que permite que no haya reglas duplicadas: `src/engine/` es TypeScript
// puro y sin dependencias de React, así que corre igual en el navegador y aquí.
//
// Va con el servidor HTTP que trae Node, sin framework. Son siete rutas: meter Express
// para esto es traerse un árbol de dependencias a cambio de nada.
//
//   GET  /api/salud                      estado, versión del catálogo y última siembra
//   GET  /api/catalogo                   catálogo entero
//   GET  /api/modelos                    los coches que hay
//   GET  /api/modelos/:id                uno, con sus piezas compatibles
//   GET  /api/piezas?plataforma=&objetivo=  consulta resuelta en SQL
//   POST /api/plan                       presupuesto a partir de modelo y dinero
//   POST /api/webhook/github             GitHub avisa de un push y se resiembra

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { cargarCatalogo } from "../engine/catalog.ts";
import { cargarModelos, piezasDeModelo } from "../engine/graph.ts";
import { generarPresupuesto } from "../engine/recommend.ts";
import type { Objetivo, PeticionPresupuesto, Plataforma } from "../engine/types.ts";
import {
  estaSembrada,
  leerCatalogo,
  leerModelos,
  piezasPorObjetivo,
  ultimaSiembra,
} from "../db/consultas.ts";
import { sembrar } from "../db/sembrar.ts";
import type { BaseDatos } from "../db/sqlite.ts";
import { pideResiembra, verificarFirma } from "./webhook.ts";

const OBJETIVOS: Objetivo[] = ["drift", "drag", "mas-cv", "estetica"];

/** Cuerpo máximo aceptado, para que nadie tumbe el proceso mandando un fichero enorme. */
const LIMITE_CUERPO = 1024 * 1024;

export interface OpcionesApi {
  base: BaseDatos;
  /** Secreto del webhook. Sin él, /api/webhook/github rechaza todo. */
  secretoWebhook?: string;
}

export function crearServidor({ base, secretoWebhook = "" }: OpcionesApi): Server {
  return createServer((peticion, respuesta) => {
    manejar(peticion, respuesta, base, secretoWebhook).catch((error: unknown) => {
      // Un fallo no previsto no puede tumbar el proceso ni dejar la petición colgada.
      console.error("Error sin controlar en la API:", error);
      if (!respuesta.headersSent) responder(respuesta, 500, { error: "Error interno." });
    });
  });
}

async function manejar(
  peticion: IncomingMessage,
  respuesta: ServerResponse,
  base: BaseDatos,
  secretoWebhook: string,
): Promise<void> {
  const url = new URL(peticion.url ?? "/", "http://localhost");
  const ruta = url.pathname.replace(/\/+$/, "") || "/";
  const metodo = peticion.method ?? "GET";

  // La web se sirve desde otro puerto en desarrollo, así que sin esto el navegador
  // bloquea las respuestas. Solo lectura: el webhook no se llama desde un navegador.
  respuesta.setHeader("Access-Control-Allow-Origin", "*");
  respuesta.setHeader("Access-Control-Allow-Headers", "Content-Type");
  respuesta.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (metodo === "OPTIONS") {
    respuesta.writeHead(204).end();
    return;
  }

  if (ruta === "/api/salud" && metodo === "GET") {
    const sembrada = estaSembrada(base);
    responder(respuesta, sembrada ? 200 : 503, {
      estado: sembrada ? "listo" : "sin sembrar",
      catalogo: sembrada ? leerCatalogo(base).version : null,
      piezas: sembrada ? leerCatalogo(base).piezas.length : 0,
      modelos: sembrada ? leerModelos(base).modelos.length : 0,
      ultimaSiembra: ultimaSiembra(base),
    });
    return;
  }

  if (ruta === "/api/catalogo" && metodo === "GET") {
    if (!exigirSembrada(base, respuesta)) return;
    responder(respuesta, 200, leerCatalogo(base));
    return;
  }

  if (ruta === "/api/modelos" && metodo === "GET") {
    if (!exigirSembrada(base, respuesta)) return;
    responder(respuesta, 200, leerModelos(base));
    return;
  }

  if (ruta.startsWith("/api/modelos/") && metodo === "GET") {
    if (!exigirSembrada(base, respuesta)) return;
    const id = decodeURIComponent(ruta.slice("/api/modelos/".length));
    const modelo = leerModelos(base).modelos.find((m) => m.id === id);
    if (!modelo) {
      responder(respuesta, 404, { error: `No hay ningún modelo con id "${id}".` });
      return;
    }
    const catalogo = leerCatalogo(base);
    responder(respuesta, 200, {
      modelo,
      piezasCompatibles: piezasDeModelo(modelo, catalogo).length,
      piezas: piezasDeModelo(modelo, catalogo),
    });
    return;
  }

  if (ruta === "/api/piezas" && metodo === "GET") {
    if (!exigirSembrada(base, respuesta)) return;

    const plataforma = url.searchParams.get("plataforma");
    const objetivo = url.searchParams.get("objetivo");

    if (!plataforma || !objetivo) {
      responder(respuesta, 400, {
        error: "Hacen falta los parámetros plataforma y objetivo.",
        ejemplo: "/api/piezas?plataforma=EA113&objetivo=drift",
      });
      return;
    }
    if (!OBJETIVOS.includes(objetivo as Objetivo)) {
      responder(respuesta, 400, {
        error: `Objetivo desconocido: "${objetivo}".`,
        objetivos: OBJETIVOS,
      });
      return;
    }

    responder(respuesta, 200, {
      plataforma,
      objetivo,
      piezas: piezasPorObjetivo(base, plataforma as Plataforma, objetivo as Objetivo),
    });
    return;
  }

  if (ruta === "/api/plan" && metodo === "POST") {
    if (!exigirSembrada(base, respuesta)) return;

    const cuerpo = await leerCuerpo(peticion, respuesta);
    if (cuerpo === null) return;

    let datos: { modelo?: string; presupuesto?: number; objetivos?: string[]; elecciones?: string[] };
    try {
      datos = JSON.parse(cuerpo.toString("utf8"));
    } catch {
      responder(respuesta, 400, { error: "El cuerpo no es JSON válido." });
      return;
    }

    const modelos = leerModelos(base).modelos;
    const modelo = modelos.find(
      (m) => m.id === datos.modelo || m.nombre.toLowerCase() === (datos.modelo ?? "").toLowerCase(),
    );
    if (!modelo) {
      responder(respuesta, 400, {
        error: "Modelo desconocido.",
        modelos: modelos.map((m) => ({ id: m.id, nombre: m.nombre })),
      });
      return;
    }

    const objetivos = (datos.objetivos ?? []).filter((o): o is Objetivo =>
      OBJETIVOS.includes(o as Objetivo),
    );
    if (objetivos.length === 0) {
      responder(respuesta, 400, { error: "Elige al menos un objetivo.", objetivos: OBJETIVOS });
      return;
    }

    const presupuesto = Number(datos.presupuesto);
    if (!Number.isFinite(presupuesto) || presupuesto <= 0) {
      responder(respuesta, 400, { error: "El presupuesto tiene que ser un número mayor que cero." });
      return;
    }

    const peticionPlan: PeticionPresupuesto = {
      plataforma: modelo.motor,
      presupuesto,
      objetivos,
      modelo: modelo.nombre,
      elecciones: datos.elecciones ?? [],
    };

    // El catálogo se le pasa desde la base: la regla de negocio no se toca, solo cambia
    // de dónde vienen los datos.
    responder(respuesta, 200, generarPresupuesto(peticionPlan, leerCatalogo(base)));
    return;
  }

  if (ruta === "/api/webhook/github" && metodo === "POST") {
    const cuerpo = await leerCuerpo(peticion, respuesta);
    if (cuerpo === null) return;

    const firma = cabecera(peticion, "x-hub-signature-256");
    const comprobacion = verificarFirma(cuerpo, firma, secretoWebhook);
    if (!comprobacion.valida) {
      // 401 y nada más: no se cuenta qué falló exactamente para no ayudar a quien esté
      // probando a ciegas. El motivo va al registro del servidor.
      console.warn("Webhook rechazado:", comprobacion.motivo);
      responder(respuesta, 401, { error: "Firma no válida." });
      return;
    }

    const evento = cabecera(peticion, "x-github-event") ?? "";
    let datos: unknown;
    try {
      datos = JSON.parse(cuerpo.toString("utf8"));
    } catch {
      responder(respuesta, 400, { error: "El cuerpo no es JSON válido." });
      return;
    }

    if (evento === "ping") {
      responder(respuesta, 200, { recibido: "ping" });
      return;
    }

    if (!pideResiembra(evento, datos)) {
      responder(respuesta, 200, {
        recibido: evento,
        resembrado: false,
        motivo: "El push no toca ni src/data/ ni vault/.",
      });
      return;
    }

    const resultado = sembrar(base, cargarCatalogo(), cargarModelos(), "webhook");
    responder(respuesta, 200, { recibido: evento, resembrado: true, ...resultado });
    return;
  }

  responder(respuesta, 404, {
    error: `No existe ${metodo} ${ruta}.`,
    rutas: [
      "GET  /api/salud",
      "GET  /api/catalogo",
      "GET  /api/modelos",
      "GET  /api/modelos/:id",
      "GET  /api/piezas?plataforma=&objetivo=",
      "POST /api/plan",
      "POST /api/webhook/github",
    ],
  });
}

function exigirSembrada(base: BaseDatos, respuesta: ServerResponse): boolean {
  if (estaSembrada(base)) return true;
  responder(respuesta, 503, {
    error: "La base de datos está vacía.",
    solucion: "Lanza `npm run db:sembrar`.",
  });
  return false;
}

function cabecera(peticion: IncomingMessage, nombre: string): string | undefined {
  const valor = peticion.headers[nombre];
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Junta el cuerpo de la petición. Devuelve null si ya se respondió por pasarse de
 * tamaño, para que quien llama sepa que no tiene que seguir.
 */
function leerCuerpo(peticion: IncomingMessage, respuesta: ServerResponse): Promise<Buffer | null> {
  return new Promise((resolver, rechazar) => {
    const trozos: Buffer[] = [];
    let total = 0;

    peticion.on("data", (trozo: Buffer) => {
      total += trozo.length;
      if (total > LIMITE_CUERPO) {
        responder(respuesta, 413, { error: "El cuerpo es demasiado grande." });
        peticion.destroy();
        resolver(null);
        return;
      }
      trozos.push(trozo);
    });
    peticion.on("end", () => resolver(Buffer.concat(trozos)));
    peticion.on("error", rechazar);
  });
}

function responder(respuesta: ServerResponse, codigo: number, cuerpo: unknown): void {
  const texto = JSON.stringify(cuerpo, null, 2);
  respuesta.writeHead(codigo, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(texto),
  });
  respuesta.end(texto);
}
