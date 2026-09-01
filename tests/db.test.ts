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

function baseSembrada() {
  const base = abrirBase(":memory:");
  sembrar(base, cargarCatalogo(), cargarModelos(), "test");
  return base;
}

describe("base de datos", () => {
  it("empieza vacía y se sabe", () => {
    const base = abrirBase(":memory:");
    expect(estaSembrada(base)).toBe(false);
  });

  it("devuelve el catálogo igual que entró", () => {
    const base = baseSembrada();
    // Comparación profunda: ids, precios, plataformas, pesos por objetivo y requisitos.
    expect(leerCatalogo(base)).toEqual(cargarCatalogo());
  });

  it("devuelve los modelos igual que entraron", () => {
    const base = baseSembrada();
    const desdeBase = leerModelos(base);
    const original = cargarModelos();
    expect(desdeBase.modelos).toHaveLength(original.modelos.length);
    // El orden cambia (la consulta ordena por nombre), así que se comparan por id.
    for (const modelo of original.modelos) {
      expect(desdeBase.modelos.find((m) => m.id === modelo.id)).toEqual(modelo);
    }
  });

  it("resembrar deja la base igual, no duplica", () => {
    const base = baseSembrada();
    const primera = leerCatalogo(base);
    sembrar(base, cargarCatalogo(), cargarModelos(), "test");
    expect(leerCatalogo(base)).toEqual(primera);
  });

  it("guarda de dónde vino cada siembra", () => {
    const base = abrirBase(":memory:");
    sembrar(base, cargarCatalogo(), cargarModelos(), "webhook");
    expect(ultimaSiembra(base)?.origen).toBe("webhook");
  });

  it("la consulta por objetivo solo trae piezas de esa plataforma y que suman", () => {
    const base = baseSembrada();
    const piezas = piezasPorObjetivo(base, "EA113", "drift");
    const catalogo = cargarCatalogo();

    expect(piezas.length).toBeGreaterThan(0);
    for (const fila of piezas) {
      const pieza = catalogo.piezas.find((p) => p.id === fila.id);
      expect(pieza?.plataformas).toContain("EA113");
      expect(pieza?.objetivos.drift).toBeGreaterThan(0);
    }
  });

  it("no deja meter una pieza con una gama inventada", () => {
    const base = abrirBase(":memory:");
    expect(() =>
      base
        .prepare(
          `INSERT INTO pieza (id,nombre,categoria,gama,precio_min,precio_estimado,
                              precio_max,impacto) VALUES (?,?,?,?,?,?,?,?)`,
        )
        .run("x", "Inventada", "escape", "altisima", 1, 2, 3, 3),
    ).toThrow();
  });

  it("no deja colgar una plataforma de una pieza que no existe", () => {
    const base = abrirBase(":memory:");
    expect(() =>
      base
        .prepare("INSERT INTO pieza_plataforma (pieza_id, plataforma) VALUES (?,?)")
        .run("no-existe", "EA113"),
    ).toThrow();
  });
});
