import { describe, expect, it } from "vitest";
import { cargarCatalogo, validarCatalogo } from "../src/engine/catalog";
import { catalogo, pieza } from "./helpers";

describe("catálogo incluido", () => {
  it("carga sin errores", () => {
    expect(() => cargarCatalogo()).not.toThrow();
  });

  it("pasa la validación", () => {
    expect(validarCatalogo(cargarCatalogo())).toEqual([]);
  });

  it("tiene al menos una pieza de cada gama", () => {
    const gamas = new Set(cargarCatalogo().piezas.map((p) => p.gama));
    expect([...gamas].sort()).toEqual(["alta", "baja", "media"]);
  });

  it("todas las dependencias apuntan a piezas existentes", () => {
    const ids = new Set(cargarCatalogo().piezas.map((p) => p.id));
    for (const p of cargarCatalogo().piezas) {
      for (const dep of p.requiere) expect(ids.has(dep)).toBe(true);
    }
  });
});

describe("validarCatalogo", () => {
  it("detecta id duplicado", () => {
    const c = catalogo([pieza({ id: "x" }), pieza({ id: "x" })]);
    expect(validarCatalogo(c).some((p) => p.includes("duplicado"))).toBe(true);
  });

  it("detecta dependencia inexistente", () => {
    const c = catalogo([pieza({ id: "a", requiere: ["fantasma"] })]);
    expect(validarCatalogo(c).some((p) => p.includes("fantasma"))).toBe(true);
  });

  it("detecta dependencia circular", () => {
    const c = catalogo([
      pieza({ id: "a", requiere: ["b"] }),
      pieza({ id: "b", requiere: ["a"] }),
    ]);
    expect(validarCatalogo(c).some((p) => p.includes("circular"))).toBe(true);
  });

  it("detecta precios fuera de orden", () => {
    const c = catalogo([pieza({ id: "a", precio: { min: 200, estimado: 100, max: 50 } })]);
    expect(validarCatalogo(c).some((p) => p.includes("min <= estimado <= max"))).toBe(true);
  });

  it("detecta objetivo fuera de rango", () => {
    const p = pieza({ id: "a" });
    p.objetivos.drift = 9;
    expect(validarCatalogo(catalogo([p])).some((m) => m.includes("entre 0 y 5"))).toBe(true);
  });
});
