import { describe, expect, it } from "vitest";
import { buscarModelo, listarModelos, piezasDeModelo } from "../src/engine/graph";
import { cargarCatalogo } from "../src/engine/catalog";

describe("grafo de modelos", () => {
  it("lista los modelos incluidos", () => {
    expect(listarModelos().length).toBeGreaterThanOrEqual(5);
  });

  it("resuelve el Mk5 por id, nombre y alias", () => {
    expect(buscarModelo("golf-gti-mk5")?.id).toBe("golf-gti-mk5");
    expect(buscarModelo("Golf GTI Mk5")?.id).toBe("golf-gti-mk5");
    expect(buscarModelo("mk5")?.id).toBe("golf-gti-mk5");
    expect(buscarModelo("MK5")?.id).toBe("golf-gti-mk5");
  });

  it("devuelve null con un modelo que no conoce", () => {
    expect(buscarModelo("Ford Focus RS")).toBeNull();
    expect(buscarModelo("")).toBeNull();
  });

  it("cada modelo apunta a una plataforma de motor con piezas en el catálogo", () => {
    const catalogo = cargarCatalogo();
    for (const modelo of listarModelos()) {
      expect(piezasDeModelo(modelo, catalogo).length).toBeGreaterThan(0);
    }
  });

  it("las piezas del Mk5 son todas compatibles con EA113", () => {
    const mk5 = buscarModelo("mk5")!;
    for (const pieza of piezasDeModelo(mk5, cargarCatalogo())) {
      expect(pieza.plataformas).toContain("EA113");
    }
  });
});
