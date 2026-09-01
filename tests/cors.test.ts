// Las cabeceras que dejan a la aplicación de escritorio hablar con la API.
//
// Esto se prueba porque es lo que falla en silencio. La API contesta perfectamente a
// curl aunque las cabeceras estén mal; el que se planta es el navegador, y en la app de
// escritorio no hay consola abierta donde ver el motivo. Ya pasó una vez: la cuenta
// estaba entera y escrita, y en la app no funcionaba nada porque `Authorization` no
// estaba entre las cabeceras permitidas.

import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearServidor } from "../src/api/servidor.ts";
import { cargarCatalogo } from "../src/engine/catalog.ts";
import { cargarModelos } from "../src/engine/graph.ts";
import { sembrar } from "../src/db/sembrar.ts";
import { abrirBase, type BaseDatos } from "../src/db/sqlite.ts";

describe("la API se deja llamar desde la app de escritorio", () => {
  let base: BaseDatos;
  let servidor: Server;
  let raiz = "";

  beforeAll(async () => {
    base = await abrirBase(":memory:");
    await sembrar(base, cargarCatalogo(), cargarModelos(), "test");
    servidor = crearServidor({ base, secretoWebhook: "x" });
    await new Promise<void>((listo) => servidor.listen(0, listo));
    const dir = servidor.address();
    if (typeof dir === "object" && dir) raiz = `http://127.0.0.1:${dir.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((listo) => servidor.close(() => listo()));
  });

  /** La pregunta que hace el navegador antes de una petición que no es simple. */
  function preguntar(metodo: string, cabecera: string): Promise<Response> {
    return fetch(`${raiz}/api/auth/perfil`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://tauri.localhost",
        "Access-Control-Request-Method": metodo,
        "Access-Control-Request-Headers": cabecera,
      },
    });
  }

  it("deja pasar la cabecera de sesión", async () => {
    // Sin esto el navegador tumba toda petición con sesión antes de mandarla, así que en
    // la app no se puede ni saber quién eres.
    const respuesta = await preguntar("GET", "authorization");
    expect(respuesta.status).toBe(204);
    expect(respuesta.headers.get("access-control-allow-headers")?.toLowerCase()).toContain(
      "authorization",
    );
  });

  it("deja pasar el método con el que se guarda el perfil", async () => {
    // Guardar el perfil es el único PATCH de toda la API. Si no está permitido, en la app
    // se puede entrar pero no cambiar nada.
    const respuesta = await preguntar("PATCH", "content-type,authorization");
    const permitidos = respuesta.headers.get("access-control-allow-methods")?.toUpperCase() ?? "";
    expect(permitidos).toContain("PATCH");
    expect(permitidos).toContain("POST");
    expect(permitidos).toContain("GET");
  });

  it("contesta a cualquier origen, y por eso nunca puede aceptar credenciales", async () => {
    // Las dos cosas van juntas: `*` solo es seguro mientras la sesión viaje en una
    // cabecera que otro sitio no puede leer. En cuanto se aceptaran cookies, cualquier
    // página abierta en el navegador podría pedir por ti.
    const respuesta = await fetch(`${raiz}/api/salud`, {
      headers: { Origin: "http://tauri.localhost" },
    });
    expect(respuesta.headers.get("access-control-allow-origin")).toBe("*");
    expect(respuesta.headers.get("access-control-allow-credentials")).toBeNull();
  });
});
