import { describe, expect, it } from "vitest";
import { cargarCatalogo } from "../src/engine/catalog";
import { buscarModelo, piezasDeModelo } from "../src/engine/graph";
import { crearClasificadorReglas } from "../src/agents/clasificador-gama";
import { crearSelector } from "../src/agents/selector-presupuesto";
import { pieza } from "./helpers";

describe("clasificador de gama", () => {
  const clasificador = crearClasificadorReglas();
  const mk5 = buscarModelo("mk5")!;
  const piezasMk5 = piezasDeModelo(mk5, cargarCatalogo());

  it("agrupa en las tres gamas sin dejar piezas fuera ni repetidas", () => {
    const grupos = clasificador.agrupar(piezasMk5);
    const total = grupos.baja.length + grupos.media.length + grupos.alta.length;
    expect(total).toBe(piezasMk5.length);

    const ids = [...grupos.baja, ...grupos.media, ...grupos.alta].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(grupos.baja.length).toBeGreaterThan(0);
    expect(grupos.media.length).toBeGreaterThan(0);
    expect(grupos.alta.length).toBeGreaterThan(0);
  });

  it("respeta la gama declarada cuando concuerda con el precio", () => {
    const p = pieza({
      id: "coil",
      categoria: "suspension",
      gama: "media",
      precio: { min: 700, estimado: 900, max: 1200 },
    });
    const r = clasificador.clasificar(p);
    expect(r.gama).toBe("media");
    expect(r.confianza).toBeGreaterThan(0.9);
  });

  it("infiere la gama por precio cuando no viene declarada", () => {
    const p = pieza({
      id: "sin-gama",
      categoria: "suspension",
      precio: { min: 2000, estimado: 2400, max: 3000 },
    });
    // @ts-expect-error probamos el caso de dato incompleto
    p.gama = undefined;
    expect(clasificador.clasificar(p).gama).toBe("alta");
  });

  it("usa la marca del nombre para clasificar", () => {
    const p = pieza({
      id: "kw-cs",
      nombre: "Coilovers KW Clubsport 3 vías",
      categoria: "suspension",
      precio: { min: 1900, estimado: 2400, max: 3000 },
    });
    // @ts-expect-error dato incompleto a propósito
    p.gama = undefined;
    expect(clasificador.clasificar(p).gama).toBe("alta");
  });
});

describe("selector de presupuesto", () => {
  const selector = crearSelector();

  it("avisa y sugiere gama cuando el presupuesto no llega al suelo", () => {
    const r = selector.seleccionar({
      modelo: "Golf GTI Mk5",
      gama: "alta",
      presupuesto: 3000,
      objetivos: ["drift"],
    });
    expect(r.cumpleSuelo).toBe(false);
    expect(r.suelo).toBe(8000);
    expect(r.gamaSugerida).toBe("media");
    expect(r.avisos.join(" ")).toMatch(/al menos 8000/);
  });

  it("con varios objetivos el suelo es la suma de los suyos", () => {
    const r = selector.seleccionar({
      modelo: "mk5",
      gama: "alta",
      presupuesto: 15000,
      objetivos: ["drift", "drag"],
    });
    expect(r.suelo).toBe(8000 + 12000);
    expect(r.cumpleSuelo).toBe(false);
    expect(r.gamaSugerida).toBe("media"); // 3000 + 3500 = 6500 <= 15000
  });

  it("marca cumpleSuelo cuando el presupuesto llega", () => {
    const r = selector.seleccionar({
      modelo: "mk5",
      gama: "media",
      presupuesto: 4000,
      objetivos: ["drift"],
    });
    expect(r.cumpleSuelo).toBe(true);
    expect(r.presupuesto).not.toBeNull();
    expect(r.presupuesto!.total).toBeLessThanOrEqual(4000);
  });

  it("solo propone piezas compatibles con el modelo resuelto", () => {
    const r = selector.seleccionar({
      modelo: "Golf GTI Mk5",
      gama: "media",
      presupuesto: 15000,
      objetivos: ["drag"],
    });
    for (const linea of r.presupuesto!.lineas) {
      expect(linea.pieza.plataformas).toContain("EA113");
      expect(linea.pieza.gama).toBe("media");
    }
  });

  it("devuelve modelo null y avisa cuando no reconoce el coche", () => {
    const r = selector.seleccionar({
      modelo: "Subaru WRX",
      gama: "media",
      presupuesto: 5000,
      objetivos: ["drag"],
    });
    expect(r.modelo).toBeNull();
    expect(r.presupuesto).toBeNull();
    expect(r.avisos.join(" ")).toMatch(/No reconozco/);
  });
});
