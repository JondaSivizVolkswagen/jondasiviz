import { describe, expect, it } from "vitest";
import { cargarCatalogo } from "../src/engine/catalog";
import { generarPresupuesto } from "../src/engine/recommend";
import type { PeticionPresupuesto } from "../src/engine/types";
import { catalogo, pieza } from "./helpers";

const base: PeticionPresupuesto = {
  plataforma: "EA113",
  gama: "media",
  presupuesto: 4000,
  objetivo: "drag",
};

describe("generarPresupuesto con el catálogo real", () => {
  it("nunca se pasa del presupuesto", () => {
    for (const objetivo of ["drift", "drag", "mas-cv", "estetica"] as const) {
      for (const presupuesto of [500, 1500, 4000, 12000]) {
        const res = generarPresupuesto({ ...base, objetivo, presupuesto });
        expect(res.total).toBeLessThanOrEqual(presupuesto);
        expect(res.restante).toBe(presupuesto - res.total);
      }
    }
  });

  it("solo incluye piezas compatibles con la plataforma y la gama pedidas", () => {
    const res = generarPresupuesto({ ...base, presupuesto: 15000 });
    for (const linea of res.lineas) {
      expect(linea.pieza.plataformas).toContain("EA113");
      expect(linea.pieza.gama).toBe("media");
    }
  });

  it("respeta las dependencias: si entra una pieza, entran sus requisitos", () => {
    const res = generarPresupuesto({ ...base, presupuesto: 15000 });
    const ids = new Set(res.lineas.map((l) => l.pieza.id));
    for (const linea of res.lineas) {
      for (const dep of linea.pieza.requiere) expect(ids.has(dep)).toBe(true);
    }
  });

  it("un proyecto de drift con presupuesto amplio cubre suspensión y dirección", () => {
    const res = generarPresupuesto({ ...base, objetivo: "drift", presupuesto: 12000 });
    const categorias = new Set(res.porCategoria.map((g) => g.categoria));
    expect(categorias.has("suspension")).toBe(true);
    expect(categorias.has("direccion")).toBe(true);
  });

  it("un proyecto de drag con presupuesto amplio mete turbo con su FMIC y downpipe", () => {
    const res = generarPresupuesto({ ...base, objetivo: "drag", presupuesto: 12000 });
    const ids = new Set(res.lineas.map((l) => l.pieza.id));
    expect(ids.has("turbo-hibrido-media")).toBe(true);
    expect(ids.has("fmic-media")).toBe(true);
    expect(ids.has("esc-dp-media")).toBe(true);
  });

  it("con presupuesto muy bajo devuelve poco y avisa", () => {
    const res = generarPresupuesto({ ...base, presupuesto: 150 });
    expect(res.total).toBeLessThanOrEqual(150);
    expect(res.avisos.length).toBeGreaterThan(0);
  });

  it("con presupuesto 0 no elige nada y avisa", () => {
    const res = generarPresupuesto({ ...base, presupuesto: 0 });
    expect(res.lineas).toHaveLength(0);
    expect(res.avisos.join(" ")).toMatch(/mayor que 0/);
  });

  it("es determinista", () => {
    const a = generarPresupuesto({ ...base, presupuesto: 5000 });
    const b = generarPresupuesto({ ...base, presupuesto: 5000 });
    expect(a).toEqual(b);
  });

  it("sugiere hasta 3 mejoras que no están ya en el presupuesto", () => {
    const res = generarPresupuesto({ ...base, presupuesto: 2000 });
    const elegidas = new Set(res.lineas.map((l) => l.pieza.id));
    expect(res.siguientesMejoras.length).toBeLessThanOrEqual(3);
    for (const m of res.siguientesMejoras) expect(elegidas.has(m.pieza.id)).toBe(false);
  });
});

describe("generarPresupuesto con catálogo controlado", () => {
  it("avisa cuando no hay piezas para la plataforma y gama", () => {
    const c = catalogo([pieza({ id: "solo-ea113-baja", plataformas: ["EA113"], gama: "baja" })]);
    const res = generarPresupuesto({ ...base, gama: "alta", presupuesto: 5000 }, c);
    expect(res.lineas).toHaveLength(0);
    expect(res.avisos.join(" ")).toMatch(/No hay piezas/);
  });

  it("con presupuesto ajustado elige la pieza con mejor relación aporte/precio", () => {
    const c = catalogo([
      pieza({
        id: "cara-floja",
        categoria: "gestion",
        objetivos: { drag: 2 },
        impacto: 2,
        precio: { min: 380, estimado: 400, max: 420 },
      }),
      pieza({
        id: "barata-buena",
        categoria: "gestion",
        objetivos: { drag: 5 },
        impacto: 4,
        precio: { min: 190, estimado: 200, max: 220 },
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivo: "drag", presupuesto: 250 }, c);
    expect(res.lineas.map((l) => l.pieza.id)).toEqual(["barata-buena"]);
  });

  it("no mete una pieza si no cabe su dependencia", () => {
    const c = catalogo([
      pieza({
        id: "turbo",
        categoria: "turbo",
        objetivos: { drag: 5 },
        impacto: 5,
        precio: { min: 900, estimado: 1000, max: 1100 },
        requiere: ["fmic"],
      }),
      pieza({
        id: "fmic",
        categoria: "admision",
        objetivos: { drag: 5 },
        impacto: 4,
        precio: { min: 380, estimado: 400, max: 420 },
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivo: "drag", presupuesto: 1200 }, c);
    expect(res.lineas.map((l) => l.pieza.id)).not.toContain("turbo");
  });

  it("mete la dependencia marcada como tal cuando sí cabe todo", () => {
    const c = catalogo([
      pieza({
        id: "turbo",
        categoria: "turbo",
        objetivos: { drag: 5 },
        impacto: 5,
        precio: { min: 900, estimado: 1000, max: 1100 },
        requiere: ["fmic"],
      }),
      pieza({
        id: "fmic",
        categoria: "admision",
        objetivos: { drag: 5 },
        impacto: 4,
        precio: { min: 380, estimado: 400, max: 420 },
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivo: "drag", presupuesto: 1500 }, c);
    const fmic = res.lineas.find((l) => l.pieza.id === "fmic");
    expect(fmic?.motivo).toBe("dependencia");
    expect(res.lineas.map((l) => l.pieza.id).sort()).toEqual(["fmic", "turbo"]);
  });
});
