// La API, probada de verdad: se levanta el servidor en un puerto libre y se le hacen
// peticiones HTTP. Nada de llamar a los manejadores por dentro, porque entonces no se
// comprueban ni los códigos de estado ni el parseo del cuerpo, que es donde falla esto.

import { createHmac } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearServidor } from "../src/api/servidor.ts";
import { cargarCatalogo } from "../src/engine/catalog.ts";
import { cargarModelos } from "../src/engine/graph.ts";
import { generarPresupuesto } from "../src/engine/recommend.ts";
import { sembrar } from "../src/db/sembrar.ts";
import { abrirBase } from "../src/db/sqlite.ts";

const SECRETO = "secreto-de-prueba";

let servidor: Server;
let raiz: string;

beforeAll(async () => {
  const base = await abrirBase(":memory:");
  await sembrar(base, cargarCatalogo(), cargarModelos(), "test");
  servidor = crearServidor({ base, secretoWebhook: SECRETO });

  // Puerto 0: que lo elija el sistema, así los tests no chocan con la API que pueda
  // estar levantada mientras se programa.
  await new Promise<void>((listo) => servidor.listen(0, listo));
  const dir = servidor.address();
  if (typeof dir === "object" && dir) raiz = `http://127.0.0.1:${dir.port}`;
});

afterAll(async () => {
  await new Promise<void>((listo) => servidor.close(() => listo()));
});

function firmar(cuerpo: string): string {
  return "sha256=" + createHmac("sha256", SECRETO).update(cuerpo).digest("hex");
}

describe("API", () => {
  it("dice que está lista y con cuántas piezas", async () => {
    const respuesta = await fetch(`${raiz}/api/salud`);
    expect(respuesta.status).toBe(200);
    const datos = await respuesta.json();
    expect(datos.estado).toBe("listo");
    expect(datos.piezas).toBe(cargarCatalogo().piezas.length);
  });

  it("sirve el catálogo entero", async () => {
    const datos = await (await fetch(`${raiz}/api/catalogo`)).json();
    expect(datos).toEqual(cargarCatalogo());
  });

  it("sirve un modelo con sus piezas compatibles", async () => {
    const modelo = cargarModelos().modelos[0];
    const respuesta = await fetch(`${raiz}/api/modelos/${modelo.id}`);
    expect(respuesta.status).toBe(200);
    const datos = await respuesta.json();
    expect(datos.modelo.id).toBe(modelo.id);
    expect(datos.piezasCompatibles).toBeGreaterThan(0);
  });

  it("da 404 con un modelo que no existe", async () => {
    expect((await fetch(`${raiz}/api/modelos/seat-panda`)).status).toBe(404);
  });

  it("filtra piezas por plataforma y objetivo", async () => {
    const datos = await (await fetch(`${raiz}/api/piezas?plataforma=EA113&objetivo=drift`)).json();
    expect(datos.piezas.length).toBeGreaterThan(0);
    expect(datos.piezas.every((p: { peso: number }) => p.peso > 0)).toBe(true);
  });

  it("rechaza un objetivo inventado", async () => {
    const respuesta = await fetch(`${raiz}/api/piezas?plataforma=EA113&objetivo=derrapar`);
    expect(respuesta.status).toBe(400);
  });

  it("calcula el mismo plan que el motor local", async () => {
    const modelo = cargarModelos().modelos.find((m) => m.id === "golf-gti-mk5")!;
    const respuesta = await fetch(`${raiz}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Por debajo del techo del plan gratuito: aquí se compara el motor, no los límites.
      body: JSON.stringify({ modelo: modelo.id, presupuesto: 2500, objetivos: ["drag"] }),
    });
    expect(respuesta.status).toBe(200);
    const porApi = await respuesta.json();

    const enCasa = generarPresupuesto({
      plataforma: modelo.motor,
      presupuesto: 2500,
      objetivos: ["drag"],
      modelo: modelo.nombre,
      elecciones: [],
    });

    // Es la garantía de que la API no reimplementa reglas: mismo motor, mismo resultado.
    expect(porApi.total).toBe(enCasa.total);
    expect(porApi.gamaResultante).toBe(enCasa.gamaResultante);
    expect(porApi.lineas.map((l: { pieza: { id: string } }) => l.pieza.id)).toEqual(
      enCasa.lineas.map((l) => l.pieza.id),
    );
  });

  it("no acepta un plan sin objetivos ni con presupuesto negativo", async () => {
    const sinObjetivos = await fetch(`${raiz}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelo: "golf-gti-mk5", presupuesto: 4000, objetivos: [] }),
    });
    expect(sinObjetivos.status).toBe(400);

    const enNumerosRojos = await fetch(`${raiz}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelo: "golf-gti-mk5", presupuesto: -100, objetivos: ["drag"] }),
    });
    expect(enNumerosRojos.status).toBe(400);
  });
});

describe("webhook de GitHub", () => {
  const cuerpo = JSON.stringify({
    ref: "refs/heads/main",
    commits: [{ modified: ["src/data/catalog.json"] }],
  });

  it("rechaza una entrega sin firma", async () => {
    const respuesta = await fetch(`${raiz}/api/webhook/github`, {
      method: "POST",
      headers: { "X-GitHub-Event": "push" },
      body: cuerpo,
    });
    expect(respuesta.status).toBe(401);
  });

  it("rechaza una firma que no cuadra", async () => {
    const respuesta = await fetch(`${raiz}/api/webhook/github`, {
      method: "POST",
      headers: { "X-GitHub-Event": "push", "X-Hub-Signature-256": firmar("otra cosa") },
      body: cuerpo,
    });
    expect(respuesta.status).toBe(401);
  });

  it("acepta la firma buena y resiembra", async () => {
    const respuesta = await fetch(`${raiz}/api/webhook/github`, {
      method: "POST",
      headers: { "X-GitHub-Event": "push", "X-Hub-Signature-256": firmar(cuerpo) },
      body: cuerpo,
    });
    expect(respuesta.status).toBe(200);
    const datos = await respuesta.json();
    expect(datos.resembrado).toBe(true);

    const salud = await (await fetch(`${raiz}/api/salud`)).json();
    expect(salud.ultimaSiembra.origen).toBe("webhook");
  });

  it("no resiembra si el push no toca los datos", async () => {
    const soloInterfaz = JSON.stringify({
      ref: "refs/heads/main",
      commits: [{ modified: ["src/App.css"] }],
    });
    const respuesta = await fetch(`${raiz}/api/webhook/github`, {
      method: "POST",
      headers: { "X-GitHub-Event": "push", "X-Hub-Signature-256": firmar(soloInterfaz) },
      body: soloInterfaz,
    });
    expect((await respuesta.json()).resembrado).toBe(false);
  });

  it("contesta al ping de GitHub", async () => {
    const ping = JSON.stringify({ zen: "Anything added dilutes everything else." });
    const respuesta = await fetch(`${raiz}/api/webhook/github`, {
      method: "POST",
      headers: { "X-GitHub-Event": "ping", "X-Hub-Signature-256": firmar(ping) },
      body: ping,
    });
    expect(respuesta.status).toBe(200);
  });
});
