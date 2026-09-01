// La base de datos tiene que devolver exactamente lo mismo que entró.
//
// Es la garantía que sostiene todo lo demás: si el catálogo cambia al pasar por SQLite,
// la API serviría un catálogo distinto del que valida el motor, y los presupuestos de
// la web y los de la API dejarían de coincidir sin que nadie se entere.

import { describe, expect, it } from "vitest";
import { cargarCatalogo } from "../src/engine/catalog.ts";
import { cargarModelos } from "../src/engine/graph.ts";
import { estaSembrada, leerCatalogo, leerModelos, piezasPorObjetivo, ultimaSiembra } from "../src/db/consultas.ts";
import { sembrar } from "../src/db/sembrar.ts";
import { abrirBase } from "../src/db/sqlite.ts";

async function baseSembrada() {
  const base = await abrirBase(":memory:");
  await sembrar(base, cargarCatalogo(), cargarModelos(), "test");
  return base;
}

describe("base de datos", () => {
  it("empieza vacía y se sabe", async () => {
    const base = await abrirBase(":memory:");
    expect(await estaSembrada(base)).toBe(false);
  });

  it("devuelve el catálogo igual que entró", async () => {
    const base = await baseSembrada();
    // Comparación profunda: ids, precios, plataformas, pesos por objetivo y requisitos.
    expect(await leerCatalogo(base)).toEqual(cargarCatalogo());
  });

  it("devuelve los modelos igual que entraron", async () => {
    const base = await baseSembrada();
    const desdeBase = await leerModelos(base);
    const original = cargarModelos();
    expect(desdeBase.modelos).toHaveLength(original.modelos.length);
    // El orden cambia (la consulta ordena por nombre), así que se comparan por id.
    for (const modelo of original.modelos) {
      expect(desdeBase.modelos.find((m) => m.id === modelo.id)).toEqual(modelo);
    }
  });

  it("resembrar deja la base igual, no duplica", async () => {
    const base = await baseSembrada();
    const primera = await leerCatalogo(base);
    await sembrar(base, cargarCatalogo(), cargarModelos(), "test");
    expect(await leerCatalogo(base)).toEqual(primera);
  });

  it("guarda de dónde vino cada siembra", async () => {
    const base = await abrirBase(":memory:");
    await sembrar(base, cargarCatalogo(), cargarModelos(), "webhook");
    expect((await ultimaSiembra(base))?.origen).toBe("webhook");
  });

  it("la consulta por objetivo solo trae piezas de esa plataforma y que suman", async () => {
    const base = await baseSembrada();
    const piezas = await piezasPorObjetivo(base, "EA113", "drift");
    const catalogo = cargarCatalogo();

    expect(piezas.length).toBeGreaterThan(0);
    for (const fila of piezas) {
      const pieza = catalogo.piezas.find((p) => p.id === fila.id);
      expect(pieza?.plataformas).toContain("EA113");
      expect(pieza?.objetivos.drift).toBeGreaterThan(0);
    }
  });

  it("no deja meter una pieza con una gama inventada", async () => {
    const base = await abrirBase(":memory:");
    await expect(
      base.ejecutar(
        `INSERT INTO pieza (id,nombre,categoria,gama,precio_min,precio_estimado,
                            precio_max,impacto,legalidad) VALUES (?,?,?,?,?,?,?,?,?)`,
        ["x", "Inventada", "escape", "altisima", 1, 2, 3, 3, "homologable"],
      ),
    ).rejects.toThrow();
  });

  it("no deja colgar una plataforma de una pieza que no existe", async () => {
    const base = await abrirBase(":memory:");
    await expect(
      base.ejecutar("INSERT INTO pieza_plataforma (pieza_id, plataforma) VALUES (?,?)", [
        "no-existe",
        "EA113",
      ]),
    ).rejects.toThrow();
  });
});
