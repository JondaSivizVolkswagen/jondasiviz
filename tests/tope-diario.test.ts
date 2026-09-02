// El tope de presupuestos por día del plan gratuito.
//
// Hay dos contadores, el de la tabla `uso_diario` y el del navegador, y lo que se
// comprueba aquí es que se comportan como uno solo: mismo número, mismo corte de día y
// misma frase cuando se llega al tope. El del navegador se salta borrando los datos del
// navegador y se sabe; lo que no puede es decir cosas distintas del otro.

import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearServidor } from "../src/api/servidor.ts";
import { abrirSesion, registrar } from "../src/auth/cuentas.ts";
import { cargarCatalogo } from "../src/engine/catalog.ts";
import { cargarModelos } from "../src/engine/graph.ts";
import { sembrar } from "../src/db/sembrar.ts";
import { abrirBase, type BaseDatos } from "../src/db/sqlite.ts";
import { accesoDe } from "../src/suscripcion/estado.ts";
import { LIMITES, diaDeUso } from "../src/suscripcion/planes.ts";
import { motivoPlanesPorDia } from "../src/cuenta/gating.ts";
import { conInfinitos } from "../src/cuenta/api.ts";
import { apuntarGeneracion } from "../src/cuenta/generacion.ts";
import { apuntarPlanLocal, planesHoyLocal, type Almacen } from "../src/cuenta/tope-local.ts";

/** Un localStorage de mentira, que es todo lo que el contador necesita. */
function almacen(): Almacen {
  const datos = new Map<string, string>();
  return {
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => void datos.set(clave, valor),
  };
}

describe("el contador del navegador", () => {
  it("corta al llegar al tope del plan gratuito", () => {
    const caja = almacen();
    const tope = LIMITES.gratis.planesPorDia;

    for (let i = 0; i < tope; i++) {
      // Antes de cada uno de los cinco, todavía cabe.
      expect(motivoPlanesPorDia(LIMITES.gratis, planesHoyLocal(caja))).toBeNull();
      apuntarPlanLocal(caja);
    }

    expect(planesHoyLocal(caja)).toBe(tope);
    expect(motivoPlanesPorDia(LIMITES.gratis, planesHoyLocal(caja))).not.toBeNull();
  });

  it("con la suscripción no corta nunca", () => {
    const caja = almacen();
    for (let i = 0; i < 40; i++) apuntarPlanLocal(caja);
    expect(motivoPlanesPorDia(LIMITES.taller, planesHoyLocal(caja))).toBeNull();
  });

  it("cambia de día en horario universal, no en la hora del ordenador", () => {
    // Las 22:30 UTC ya son del día siguiente en Madrid. Si el corte fuera por la hora
    // local, el navegador de aquí y la tabla del servidor contarían días distintos y el
    // tope se regalaría cada noche.
    const nocheDeAqui = new Date("2026-09-02T22:30:00Z");
    const antesDeMedianocheUtc = new Date("2026-09-02T23:59:00Z");
    const yaEsOtroDia = new Date("2026-09-03T00:00:30Z");

    expect(diaDeUso(nocheDeAqui)).toBe("2026-09-02");
    expect(diaDeUso(antesDeMedianocheUtc)).toBe("2026-09-02");
    expect(diaDeUso(yaEsOtroDia)).toBe("2026-09-03");

    const caja = almacen();
    apuntarPlanLocal(caja, nocheDeAqui);
    expect(planesHoyLocal(caja, antesDeMedianocheUtc)).toBe(1);
    expect(planesHoyLocal(caja, yaEsOtroDia)).toBe(0);
  });

  it("una clave manipulada no regala presupuestos ni rompe nada", () => {
    const roto: Almacen = { getItem: () => "{ esto no es json", setItem: () => {} };
    expect(planesHoyLocal(roto)).toBe(0);

    const negativo: Almacen = {
      getItem: () => JSON.stringify({ dia: diaDeUso(), planes: -50 }),
      setItem: () => {},
    };
    expect(planesHoyLocal(negativo)).toBe(0);
  });

  it("sin almacenamiento, la herramienta sigue funcionando", () => {
    // Modo privado o almacenamiento bloqueado. Se cuenta de menos antes que romper.
    expect(planesHoyLocal(null)).toBe(0);
    expect(apuntarPlanLocal(null)).toBe(0);
  });
});

describe("el contador que enseña la interfaz", () => {
  /** Un localStorage de mentira colgado del global, que es donde lo busca el contador. */
  function ponerAlmacen(): void {
    const datos = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (clave: string) => datos.get(clave) ?? null,
        setItem: (clave: string, valor: string) => void datos.set(clave, valor),
      },
    });
  }

  function quitarAlmacen(): void {
    Reflect.deleteProperty(globalThis, "localStorage");
  }

  const peticion = {
    modelo: "golf-gti-mk5",
    presupuesto: 2500,
    objetivos: ["drag"],
    elecciones: [],
  };

  it("sin API, cada generación devuelve cuántas van hoy y quién las cuenta", async () => {
    ponerAlmacen();
    try {
      const entorno = {
        peticion,
        limites: LIMITES.gratis,
        disponibleApi: false,
        conSesion: false,
      };

      for (let i = 1; i <= LIMITES.gratis.planesPorDia; i++) {
        const permiso = await apuntarGeneracion(entorno);
        expect(permiso).toEqual({ ok: true, uso: { planesHoy: i, local: true } });
      }

      // El siguiente ya no cabe, y el contador que se enseña se queda en el tope.
      const pasado = await apuntarGeneracion(entorno);
      expect(pasado.ok).toBe(false);
      if (pasado.ok) throw new Error("tenía que haber cortado");
      expect(pasado.suscripcion).toBe(true);
      expect(pasado.motivo).toBe(motivoPlanesPorDia(LIMITES.gratis, LIMITES.gratis.planesPorDia));
      expect(pasado.uso).toEqual({ planesHoy: LIMITES.gratis.planesPorDia, local: true });
    } finally {
      quitarAlmacen();
    }
  });

  it("con la suscripción y sin API, sigue generando y no habla de topes", async () => {
    ponerAlmacen();
    try {
      // Los límites llegan del servidor con -1 en vez de Infinity, porque JSON no sabe
      // escribirlo. Si eso no se deshace, cualquier número es mayor o igual que -1 y a
      // un suscriptor con la API caída se le cortaría al primer presupuesto.
      const comoLosManda = { ...LIMITES.taller, planesPorDia: -1, presupuestoMaximo: null };
      const limites = conInfinitos(comoLosManda as unknown as typeof LIMITES.taller);
      expect(limites.planesPorDia).toBe(Infinity);
      expect(limites.presupuestoMaximo).toBe(Infinity);

      for (let i = 0; i < 8; i++) {
        const permiso = await apuntarGeneracion({
          peticion,
          limites,
          disponibleApi: false,
          conSesion: true,
        });
        expect(permiso.ok).toBe(true);
      }
    } finally {
      quitarAlmacen();
    }
  });
});

describe("el tope del navegador y el del servidor dicen lo mismo", () => {
  let servidor: Server;
  let base: BaseDatos;
  let raiz: string;
  let token: string;

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
      body: JSON.stringify({ correo: "cinco@jondasiviz.es", contrasena: "contrasena-larga" }),
    });
    token = (await alta.json()).token;
  });

  afterAll(async () => {
    await new Promise<void>((listo) => servidor.close(() => listo()));
  });

  function plan(extra: Record<string, unknown> = {}) {
    return fetch(`${raiz}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      // 2.500 € y un objetivo caben en el plan gratuito: así lo único que puede cortar
      // es el tope del día, que es lo que se está mirando.
      body: JSON.stringify({
        modelo: "golf-gti-mk5",
        presupuesto: 2500,
        objetivos: ["drag"],
        ...extra,
      }),
    });
  }

  it("el sexto presupuesto del día se corta con la misma frase que da el contador de aquí", async () => {
    const tope = LIMITES.gratis.planesPorDia;
    for (let i = 0; i < tope; i++) expect((await plan()).status).toBe(200);

    const pasado = await plan();
    expect(pasado.status).toBe(402);
    const datos = await pasado.json();
    expect(datos.necesitaSuscripcion).toBe(true);

    // Lo que se lee cuando corta el navegador, palabra por palabra.
    expect(datos.error).toBe(motivoPlanesPorDia(LIMITES.gratis, tope));
  });

  it("cada presupuesto vuelve con el contador del día ya subido", async () => {
    // Para que el perfil no tenga que deducirlo sumando uno por su cuenta ni pedir otra
    // vez la cuenta entera solo por este número.
    const otra = await registrar(base, "contador@jondasiviz.es", "contrasena-larga");
    if (!otra.ok) throw new Error("no se registró");
    const sesion = await abrirSesion(base, otra.usuario.id);

    const generar = (conSesion: boolean) =>
      fetch(`${raiz}/api/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(conSesion ? { Authorization: `Bearer ${sesion.token}` } : {}),
        },
        body: JSON.stringify({ modelo: "golf-gti-mk5", presupuesto: 2500, objetivos: ["drag"] }),
      });

    expect((await (await generar(true)).json()).planesHoy).toBe(1);
    expect((await (await generar(true)).json()).planesHoy).toBe(2);
    expect((await accesoDe(base, otra.usuario.id)).planesHoy).toBe(2);

    // Sin sesión no hay a quién apuntárselo, así que el servidor no da número: lo lleva
    // el navegador y el suyo sería mentira.
    expect((await (await generar(false)).json()).planesHoy).toBeNull();
  });

  it("preguntar si algo cabe no gasta un presupuesto del día", async () => {
    // La descarga del PDF pasa por esta misma ruta para comprobar el límite sobre un
    // presupuesto que ya existe. Sin el `soloComprobar`, bajarse el PDF se comía uno de
    // los cinco del día.
    const otra = await registrar(base, "pdf@jondasiviz.es", "contrasena-larga");
    if (!otra.ok) throw new Error("no se registró");
    const sesion = await abrirSesion(base, otra.usuario.id);

    const preguntar = (cuerpo: Record<string, unknown>) =>
      fetch(`${raiz}/api/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sesion.token}`,
        },
        body: JSON.stringify({
          modelo: "golf-gti-mk5",
          presupuesto: 2500,
          objetivos: ["drag"],
          soloComprobar: true,
          ...cuerpo,
        }),
      });

    expect((await preguntar({})).status).toBe(200);
    expect((await preguntar({})).status).toBe(200);
    expect((await accesoDe(base, otra.usuario.id)).planesHoy).toBe(0);

    // Y sigue comprobando de verdad: 9.000 € no caben en el plan gratuito.
    expect((await preguntar({ presupuesto: 9000 })).status).toBe(402);
  });
});
