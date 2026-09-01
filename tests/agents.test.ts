import { describe, expect, it } from "vitest";
import { cargarCatalogo } from "../src/engine/catalog";
import { buscarModelo, listarModelos, piezasDeModelo } from "../src/engine/graph";
import { crearClasificadorReglas } from "../src/agents/clasificador-gama";
import { crearSelector, umbralGama } from "../src/agents/selector-presupuesto";
import { NIVEL_GAMA, fraseRiesgo } from "../src/engine/recommend";
import type { Objetivo } from "../src/engine/types";
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

describe("escala de presupuestos de referencia", () => {
  it("el umbral de un objetivo sale de floors.json", () => {
    expect(umbralGama(["drift"], "baja")).toBe(1200);
    expect(umbralGama(["drift"], "alta")).toBe(8000);
  });

  it("con varios objetivos los umbrales se suman", () => {
    expect(umbralGama(["drift", "drag"], "baja")).toBe(1200 + 1500);
    expect(umbralGama(["drift", "drag"], "alta")).toBe(8000 + 12000);
  });

  it("sin objetivos no hay escala", () => {
    expect(umbralGama([], "baja")).toBe(0);
    expect(umbralGama([], "alta")).toBe(0);
  });
});

describe("selector de presupuesto", () => {
  const selector = crearSelector();

  it("el mínimo del proyecto lo pone el catálogo, no floors.json", () => {
    const r = selector.seleccionar({
      modelo: "Golf GTI Mk5",
      presupuesto: 800,
      objetivos: ["drift"],
    });
    expect(r.cumpleMinimo).toBe(false);
    expect(r.minimo).toBe(r.presupuesto!.minimoEsencial);
    expect(r.minimo).toBeGreaterThan(800);
  });

  it("aun por debajo del mínimo devuelve lo que entra, no una lista vacía", () => {
    const r = selector.seleccionar({
      modelo: "mk5",
      presupuesto: 800,
      objetivos: ["drift"],
    });
    expect(r.presupuesto!.lineas.length).toBeGreaterThan(0);
    expect(r.presupuesto!.total).toBeLessThanOrEqual(800);
  });

  it("marca cumpleMinimo cuando el presupuesto llega", () => {
    const r = selector.seleccionar({
      modelo: "mk5",
      presupuesto: 4000,
      objetivos: ["drift"],
    });
    expect(r.cumpleMinimo).toBe(true);
    expect(r.presupuesto!.total).toBeLessThanOrEqual(4000);
    expect(r.presupuesto!.gamaResultante).not.toBeNull();
  });

  // Lo que rompía antes: el escalón salía de floors.json sin mirar el build, así que
  // llegaba a prometer una gama que la lista de piezas ya tenía.
  it("el siguiente escalón sube de gama de verdad, o no existe", () => {
    for (const presupuesto of [800, 2000, 4000, 9000, 20000]) {
      const r = selector.seleccionar({ modelo: "mk5", presupuesto, objetivos: ["drag"] });
      const escalon = r.siguienteEscalon;
      if (!escalon) continue;

      expect(escalon.presupuesto).toBeGreaterThan(presupuesto);
      const actual = r.presupuesto!.gamaResultante;
      expect(NIVEL_GAMA[escalon.gama]).toBeGreaterThan(actual ? NIVEL_GAMA[actual] : -1);

      const probado = selector.seleccionar({
        modelo: "mk5",
        presupuesto: escalon.presupuesto,
        objetivos: ["drag"],
      });
      expect(probado.presupuesto!.gamaResultante).toBe(escalon.gama);
    }
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

  // El contrato en el que se apoya el suelo de la barra de presupuesto: si el usuario
  // pone el mínimo que le pedimos, el plan cubre de verdad todas las esenciales. Si
  // esto falla, la barra estaría prometiendo algo que el motor no cumple.
  //
  // Recorre TODOS los modelos del catálogo a propósito: cada coche que se meta en el
  // vault entra solo en esta comprobación, sin tocar el test.
  it("con el mínimo justo entran todas las esenciales, en todos los modelos", () => {
    const combos: Objetivo[][] = [
      ["drift"],
      ["drag"],
      ["mas-cv"],
      ["estetica"],
      ["drag", "estetica"],
      ["drift", "mas-cv"],
    ];

    for (const modelo of listarModelos()) {
      for (const objetivos of combos) {
        const sonda = selector.seleccionar({ modelo: modelo.id, presupuesto: 1, objetivos });
        const minimo = sonda.presupuesto!.minimoEsencial;
        if (minimo <= 0) continue; // ese motor no tiene nada que ofrecer para esos objetivos

        const r = selector.seleccionar({ modelo: modelo.id, presupuesto: minimo, objetivos });
        const fuera = r.presupuesto!.esenciales.filter((e) => !e.cubierta && e.pieza !== null);

        expect(
          fuera.map((e) => e.categoria),
          `${modelo.nombre} / ${objetivos.join("+")} con el mínimo (${minimo} €)`,
        ).toEqual([]);
        expect(r.cumpleMinimo).toBe(true);
        expect(r.presupuesto!.total).toBeLessThanOrEqual(minimo);
      }
    }
  });

  it("con el mínimo justo no queda ningún riesgo de seguridad sin cubrir", () => {
    for (const modelo of listarModelos()) {
      for (const objetivos of [["mas-cv"], ["drag"], ["drift"]] as Objetivo[][]) {
        const sonda = selector.seleccionar({ modelo: modelo.id, presupuesto: 1, objetivos });
        const minimo = sonda.presupuesto!.minimoEsencial;
        if (minimo <= 0) continue;

        const r = selector.seleccionar({ modelo: modelo.id, presupuesto: minimo, objetivos });
        expect(fraseRiesgo(r.presupuesto!)).toBeNull();
      }
    }
  });

  // El contrato del tope de la barra: por encima del techo el dinero no compra nada más.
  // Se comprueba en los 8 modelos, así que un coche nuevo entra solo en la garantía.
  it("con el techo justo ya entra todo, y por encima no cambia nada", () => {
    const combos: Objetivo[][] = [
      ["drag"],
      ["drift"],
      ["mas-cv"],
      ["estetica"],
      ["drag", "estetica"],
      ["drift", "mas-cv"],
    ];
    const lista = (modelo: string, presupuesto: number, objetivos: Objetivo[]) =>
      selector
        .seleccionar({ modelo, presupuesto, objetivos })
        .presupuesto!.lineas.map((l) => l.pieza.id)
        .sort()
        .join(",");

    for (const modelo of listarModelos()) {
      for (const objetivos of combos) {
        const techo = selector.seleccionar({ modelo: modelo.id, presupuesto: 999999, objetivos })
          .techoUtil;
        if (techo <= 0) continue;
        const etiqueta = `${modelo.nombre} / ${objetivos.join("+")}`;

        // Con el techo justo sale lo mismo que con dinero de sobra, y se gasta entero.
        expect(lista(modelo.id, techo, objetivos), etiqueta).toBe(
          lista(modelo.id, 999999, objetivos),
        );
        expect(
          selector.seleccionar({ modelo: modelo.id, presupuesto: techo, objetivos }).presupuesto!
            .total,
          etiqueta,
        ).toBe(techo);

        // Y el techo está ajustado: con 100 € menos ya no sale la misma lista.
        expect(lista(modelo.id, techo - 100, objetivos), etiqueta).not.toBe(
          lista(modelo.id, techo, objetivos),
        );

        // El tramo de la barra tiene sentido: el techo nunca queda por debajo del
        // mínimo. Se permite que coincidan porque en un coche con catálogo mínimo
        // -un A6 e-tron para drag no tiene más que neumáticos- son la misma cifra.
        expect(techo, etiqueta).toBeGreaterThanOrEqual(
          selector.seleccionar({ modelo: modelo.id, presupuesto: techo, objetivos }).minimo,
        );
      }
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
