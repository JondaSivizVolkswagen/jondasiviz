// La suscripción y sus límites.
//
// El test que más importa de todo el proyecto está aquí: que no se pueda usar la
// herramienta completa sin pagar. Y el segundo, que nadie pueda darse la suscripción a
// sí mismo desde el navegador.

import { createHmac } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearServidor } from "../src/api/servidor.ts";
import { abrirSesion, registrar } from "../src/auth/cuentas.ts";
import { cargarCatalogo } from "../src/engine/catalog.ts";
import { cargarModelos } from "../src/engine/graph.ts";
import { sembrar } from "../src/db/sembrar.ts";
import { abrirBase, type BaseDatos } from "../src/db/sqlite.ts";
import { accesoDe, anotarSuscripcion, apuntarPlan } from "../src/suscripcion/estado.ts";
import { LIMITES, planDe, puedePedirPlan } from "../src/suscripcion/planes.ts";
import { firmaStripeValida } from "../src/suscripcion/pasarela.ts";

describe("planes", () => {
  it("solo la suscripción activa da el plan completo", async () => {
    expect(planDe("activa")).toBe("taller");
    expect(planDe("ninguna")).toBe("gratis");
    expect(planDe("cancelada")).toBe("gratis");
  });

  it("un impago no corta el acceso de golpe", async () => {
    // La pasarela reintenta el cobro varios días. Cortar al primer fallo echaría a gente
    // que solo ha cambiado de tarjeta.
    expect(planDe("impagada")).toBe("taller");
  });

  it("el plan gratuito no combina objetivos ni elige piezas a mano", async () => {
    const gratis = LIMITES.gratis;
    expect(puedePedirPlan(gratis, { objetivos: ["drift"] }, 0).permitido).toBe(true);
    expect(puedePedirPlan(gratis, { objetivos: ["drift", "drag"] }, 0).permitido).toBe(false);
    expect(puedePedirPlan(gratis, { objetivos: ["drift"], elecciones: ["x"] }, 0).permitido).toBe(false);
  });

  it("el plan gratuito tiene tope diario y el de pago no", async () => {
    expect(puedePedirPlan(LIMITES.gratis, { objetivos: ["drift"] }, 5).permitido).toBe(false);
    expect(puedePedirPlan(LIMITES.taller, { objetivos: ["drift"] }, 9999).permitido).toBe(true);
  });
});

describe("firma de la pasarela", () => {
  const secreto = "whsec_de_prueba";
  const cuerpo = Buffer.from('{"type":"checkout.session.completed"}');

  function cabeceraValida(momento = Math.floor(Date.now() / 1000)): string {
    const firma = createHmac("sha256", secreto)
      .update(`${momento}.${cuerpo.toString("utf8")}`)
      .digest("hex");
    return `t=${momento},v1=${firma}`;
  }

  it("acepta una firma buena", async () => {
    expect(firmaStripeValida(cuerpo, cabeceraValida(), secreto).valida).toBe(true);
  });

  it("rechaza si no hay cabecera o no hay secreto", async () => {
    expect(firmaStripeValida(cuerpo, undefined, secreto).valida).toBe(false);
    expect(firmaStripeValida(cuerpo, cabeceraValida(), "").valida).toBe(false);
  });

  it("rechaza una firma de otro cuerpo", async () => {
    const otra = firmaStripeValida(Buffer.from('{"type":"otro"}'), cabeceraValida(), secreto);
    expect(otra.valida).toBe(false);
  });

  it("rechaza una entrega vieja aunque la firma sea correcta", async () => {
    // Sin esto, capturar una entrega válida permitiría reenviarla para revivir una
    // suscripción cancelada.
    const haceUnaHora = Math.floor(Date.now() / 1000) - 3600;
    expect(firmaStripeValida(cuerpo, cabeceraValida(haceUnaHora), secreto).valida).toBe(false);
  });
});

describe("la API cobra de verdad", () => {
  let servidor: Server;
  let base: BaseDatos;
  let raiz: string;
  let token: string;
  let usuarioId: string;

  beforeAll(async () => {
    base = await abrirBase(":memory:");
    await sembrar(base, cargarCatalogo(), cargarModelos(), "test");
    servidor = crearServidor({ base, secretoWebhook: "x" });
    await new Promise<void>((listo) => servidor.listen(0, listo));
    const dir = servidor.address();
    if (typeof dir === "object" && dir) raiz = `http://127.0.0.1:${dir.port}`;

    const alta = await fetch(`${raiz}/api/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: "cliente@jondasiviz.es", contrasena: "contrasena-larga" }),
    });
    const datos = await alta.json();
    token = datos.token;
    usuarioId = datos.usuario.id;
  });

  afterAll(async () => {
    await new Promise<void>((listo) => servidor.close(() => listo()));
  });

  function plan(cuerpo: Record<string, unknown>, conSesion = true) {
    return fetch(`${raiz}/api/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(conSesion ? { Authorization: `Bearer ${token}` } : {}),
      },
      // 2500 cabe en el plan gratuito: así cada test comprueba el límite que le toca y
      // no el del presupuesto, que tiene el suyo propio más abajo.
      body: JSON.stringify({ modelo: "golf-gti-mk5", presupuesto: 2500, ...cuerpo }),
    });
  }

  it("sin pagar, no deja combinar objetivos", async () => {
    const respuesta = await plan({ objetivos: ["drift", "estetica"] });
    expect(respuesta.status).toBe(402);
    const datos = await respuesta.json();
    expect(datos.necesitaSuscripcion).toBe(true);
    expect(datos.precio.centimos).toBe(499);
  });

  it("sin pagar, no deja fijar piezas a mano", async () => {
    const respuesta = await plan({ objetivos: ["drift"], elecciones: ["escape-inox"] });
    expect(respuesta.status).toBe(402);
  });

  it("sin pagar, un objetivo suelto sí pasa", async () => {
    expect((await plan({ objetivos: ["drift"] })).status).toBe(200);
  });

  it("sin pagar, un presupuesto por encima del techo se rechaza", async () => {
    const respuesta = await plan({ objetivos: ["drift"], presupuesto: 9000 });
    expect(respuesta.status).toBe(402);
    expect((await respuesta.json()).error).toContain("3000");
  });

  it("tampoco cuela sin iniciar sesión", async () => {
    // Si el límite se saltara quitando la sesión, no habría negocio que valga.
    const respuesta = await plan({ objetivos: ["drift", "estetica"] }, false);
    expect(respuesta.status).toBe(402);
  });

  it("nadie puede darse la suscripción a sí mismo por la API", async () => {
    // No existe ninguna ruta que acepte "soy de pago" viniendo del cliente. El estado lo
    // escribe solo el webhook de la pasarela.
    for (const ruta of ["/api/suscripcion/activar", "/api/suscripcion/estado"]) {
      const respuesta = await fetch(`${raiz}${ruta}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: "activa" }),
      });
      expect(respuesta.status).toBe(404);
    }
    expect((await accesoDe(base, usuarioId)).plan).toBe("gratis");
  });

  it("con la suscripción activa ya combina objetivos", async () => {
    await anotarSuscripcion(base, usuarioId, "activa", "test", "sub_prueba");
    expect((await plan({ objetivos: ["drift", "estetica"] })).status).toBe(200);
  });

  it("y si se cancela, vuelve a cortar", async () => {
    await anotarSuscripcion(base, usuarioId, "cancelada", "test", "sub_prueba");
    expect((await plan({ objetivos: ["drift", "estetica"] })).status).toBe(402);
  });

  it("cuenta los planes del día para el tope del plan gratuito", async () => {
    const otra = await registrar(base, "tope@jondasiviz.es", "contrasena-larga");
    if (!otra.ok) throw new Error("no se registró");

    expect((await accesoDe(base, otra.usuario.id)).planesHoy).toBe(0);
    await apuntarPlan(base, otra.usuario.id);
    await apuntarPlan(base, otra.usuario.id);
    expect((await accesoDe(base, otra.usuario.id)).planesHoy).toBe(2);
  });

  it("la pasarela simulada no regala la suscripción sin el código", async () => {
    // Sin esto sería un botón que abre la herramienta entera a cualquiera que pase por
    // la web. Es el agujero más caro que puede tener esto.
    const otra = await registrar(base, "gorron@jondasiviz.es", "contrasena-larga");
    if (!otra.ok) throw new Error("no se registró");
    const sesion = await abrirSesion(base, otra.usuario.id);

    const sinCodigo = await fetch(`${raiz}/api/suscripcion/simulada/confirmar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sesion.token}`,
      },
      body: JSON.stringify({}),
    });
    // 401 si hay código configurado, 404 si no lo hay. Lo que nunca puede es dar 200.
    expect(sinCodigo.status).not.toBe(200);
    expect((await accesoDe(base, otra.usuario.id)).plan).toBe("gratis");

    const inventado = await fetch(`${raiz}/api/suscripcion/codigo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sesion.token}`,
      },
      body: JSON.stringify({ codigo: "me-lo-invento" }),
    });
    expect(inventado.status).not.toBe(200);
    expect((await accesoDe(base, otra.usuario.id)).plan).toBe("gratis");
  });

  it("el webhook de pago rechaza una firma que no cuadra", async () => {
    const respuesta = await fetch(`${raiz}/api/suscripcion/webhook`, {
      method: "POST",
      headers: { "Stripe-Signature": "t=1,v1=00" },
      body: "{}",
    });
    expect(respuesta.status).toBe(401);
  });
});
