import { describe, expect, it } from "vitest";
import { cargarCatalogo } from "../src/engine/catalog";
import { buscarModelo, piezasDeModelo } from "../src/engine/graph";
import { crearClasificadorReglas } from "../src/agents/clasificador-gama";
import {
  crearSelector,
  gamaEsperada,
  siguienteEscalon,
  sueloDe,
  umbralGama,
} from "../src/agents/selector-presupuesto";
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

describe("escala de gama por presupuesto", () => {
  it("el suelo de un objetivo es su umbral de gama baja", () => {
    expect(sueloDe(["drift"])).toBe(1200);
    expect(umbralGama(["drift"], "baja")).toBe(1200);
  });

  it("con varios objetivos los umbrales se suman", () => {
    expect(sueloDe(["drift", "drag"])).toBe(1200 + 1500);
    expect(umbralGama(["drift", "drag"], "alta")).toBe(8000 + 12000);
  });

  it("el dinero decide la gama a la que se aspira", () => {
    expect(gamaEsperada(["drift"], 800)).toBeNull();
    expect(gamaEsperada(["drift"], 1200)).toBe("baja");
    expect(gamaEsperada(["drift"], 3000)).toBe("media");
    expect(gamaEsperada(["drift"], 8000)).toBe("alta");
  });

  it("el siguiente escalón dice cuánto falta para subir de gama", () => {
    expect(siguienteEscalon(["drift"], 800)).toEqual({ gama: "baja", presupuesto: 1200 });
    expect(siguienteEscalon(["drift"], 3000)).toEqual({ gama: "alta", presupuesto: 8000 });
    expect(siguienteEscalon(["drift"], 20000)).toBeNull();
  });

  it("sin objetivos no hay escala", () => {
    expect(sueloDe([])).toBe(0);
    expect(gamaEsperada([], 5000)).toBeNull();
    expect(siguienteEscalon([], 5000)).toBeNull();
  });
});

describe("selector de presupuesto", () => {
  const selector = crearSelector();

  it("avisa cuando el presupuesto no llega al suelo del proyecto", () => {
    const r = selector.seleccionar({
      modelo: "Golf GTI Mk5",
      presupuesto: 800,
      objetivos: ["drift"],
    });
    expect(r.cumpleSuelo).toBe(false);
    expect(r.suelo).toBe(1200);
    expect(r.gamaEsperada).toBeNull();
    expect(r.avisos.join(" ")).toMatch(/al menos 1200/);
  });

  it("aun por debajo del suelo devuelve lo que entra, no una lista vacía", () => {
    const r = selector.seleccionar({
      modelo: "mk5",
      presupuesto: 800,
      objetivos: ["drift"],
    });
    expect(r.presupuesto!.lineas.length).toBeGreaterThan(0);
    expect(r.presupuesto!.total).toBeLessThanOrEqual(800);
  });

  it("marca cumpleSuelo y sitúa la gama cuando el presupuesto llega", () => {
    const r = selector.seleccionar({
      modelo: "mk5",
      presupuesto: 4000,
      objetivos: ["drift"],
    });
    expect(r.cumpleSuelo).toBe(true);
    expect(r.gamaEsperada).toBe("media");
    expect(r.siguienteEscalon).toEqual({ gama: "alta", presupuesto: 8000 });
    expect(r.presupuesto!.total).toBeLessThanOrEqual(4000);
    expect(r.presupuesto!.gamaResultante).not.toBeNull();
  });

  it("solo propone piezas compatibles con el modelo resuelto", () => {
    const r = selector.seleccionar({
      modelo: "Golf GTI Mk5",
      presupuesto: 15000,
      objetivos: ["drag"],
    });
    for (const linea of r.presupuesto!.lineas) {
      expect(linea.pieza.plataformas).toContain("EA113");
    }
  });

  it("devuelve modelo null y avisa cuando no reconoce el coche", () => {
    const r = selector.seleccionar({
      modelo: "Subaru WRX",
      presupuesto: 5000,
      objetivos: ["drag"],
    });
    expect(r.modelo).toBeNull();
    expect(r.presupuesto).toBeNull();
    expect(r.avisos.join(" ")).toMatch(/No reconozco/);
  });
});
