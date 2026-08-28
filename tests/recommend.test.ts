import { describe, expect, it } from "vitest";
import {
  NOMBRE_CATEGORIA,
  alternarObjetivo,
  conflictosEn,
  enConflictoCon,
  fraseRiesgo,
  generarPresupuesto,
  gruposElegibles,
  riesgosSinCubrir,
} from "../src/engine/recommend";
import type { Objetivo, PeticionPresupuesto } from "../src/engine/types";
import { cargarCatalogo } from "../src/engine/catalog";
import { catalogo, pieza } from "./helpers";

const base: PeticionPresupuesto = {
  plataforma: "EA113",
  presupuesto: 4000,
  objetivos: ["drag"],
};

describe("generarPresupuesto con el catálogo real", () => {
  it("nunca se pasa del presupuesto", () => {
    const combos = [["drift"], ["drag"], ["mas-cv"], ["estetica"], ["drift", "estetica"]] as const;
    for (const objetivos of combos) {
      for (const presupuesto of [500, 1500, 4000, 12000]) {
        const res = generarPresupuesto({ ...base, objetivos: [...objetivos], presupuesto });
        expect(res.total).toBeLessThanOrEqual(presupuesto);
        expect(res.restante).toBe(presupuesto - res.total);
      }
    }
  });

  it("con varios objetivos entran categorías de todos ellos", () => {
    const res = generarPresupuesto({
      ...base,
      objetivos: ["drift", "estetica"],
      presupuesto: 12000,
    });
    const categorias = new Set(res.porCategoria.map((g) => g.categoria));
    expect(categorias.has("direccion")).toBe(true); // esencial de drift
    expect(categorias.has("estetica")).toBe(true); // esencial de estética
  });

  it("solo incluye piezas compatibles con la plataforma", () => {
    const res = generarPresupuesto({ ...base, presupuesto: 15000 });
    for (const linea of res.lineas) expect(linea.pieza.plataformas).toContain("EA113");
  });

  it("sin filtro de gama, un presupuesto amplio mezcla gamas y el build sale alta", () => {
    const res = generarPresupuesto({ ...base, presupuesto: 15000 });
    const gamas = new Set(res.lineas.map((l) => l.pieza.gama));
    expect(gamas.size).toBeGreaterThan(1);
    expect(res.gamaResultante).toBe("alta");
  });

  it("un presupuesto corto se queda en piezas asequibles y el build sale bajo", () => {
    const res = generarPresupuesto({ ...base, objetivos: ["estetica"], presupuesto: 700 });
    expect(res.gamaResultante).not.toBe("alta");
    expect(res.total).toBeLessThanOrEqual(700);
  });

  it("con dinero de sobra coge la mejor pieza del grupo exclusivo, no la más barata", () => {
    const res = generarPresupuesto({ ...base, presupuesto: 25000 });
    const altura = res.lineas.filter((l) => l.pieza.grupoExclusivo === "altura");
    expect(altura).toHaveLength(1);
    expect(altura[0].pieza.id).toBe("susp-coil-alta");
  });

  it("no sugiere mejoras que choquen de grupo con lo ya montado ni entre ellas", () => {
    for (const presupuesto of [800, 2000, 6000, 12000]) {
      const res = generarPresupuesto({ ...base, objetivos: ["drift"], presupuesto });
      const montados = new Set(
        res.lineas.map((l) => l.pieza.grupoExclusivo).filter(Boolean),
      );
      const sugeridos = new Set<string>();
      for (const m of res.siguientesMejoras) {
        const g = m.pieza.grupoExclusivo;
        if (!g) continue;
        expect(montados.has(g)).toBe(false);
        expect(sugeridos.has(g)).toBe(false);
        sugeridos.add(g);
      }
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
    const res = generarPresupuesto({ ...base, objetivos: ["drift"], presupuesto: 12000 });
    const categorias = new Set(res.porCategoria.map((g) => g.categoria));
    expect(categorias.has("suspension")).toBe(true);
    expect(categorias.has("direccion")).toBe(true);
  });

  it("un proyecto de drag con presupuesto amplio mete el K04 con su FMIC y downpipe", () => {
    const res = generarPresupuesto({ ...base, objetivos: ["drag"], presupuesto: 20000 });
    const ids = new Set(res.lineas.map((l) => l.pieza.id));
    expect(ids.has("turbo-k04-alta")).toBe(true);
    // dependencias de otras gamas que el motor arrastra igualmente
    expect(ids.has("adm-fmic-media")).toBe(true);
    expect(ids.has("esc-dp-media")).toBe(true);
    for (const linea of res.lineas) {
      for (const dep of linea.pieza.requiere) expect(ids.has(dep)).toBe(true);
    }
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

describe("objetivos que no se combinan", () => {
  it("drift y drag se descartan entre ellos", () => {
    expect(enConflictoCon("drift")).toEqual(["drag"]);
    expect(enConflictoCon("drag")).toEqual(["drift"]);
    expect(conflictosEn(["drift", "drag"])).toEqual([["drift", "drag"]]);
  });

  it("el resto se lleva bien con todos", () => {
    expect(enConflictoCon("mas-cv")).toEqual([]);
    expect(enConflictoCon("estetica")).toEqual([]);
    for (const combo of [
      ["drift", "mas-cv"],
      ["drift", "estetica"],
      ["drag", "mas-cv"],
      ["drag", "estetica"],
      ["drift", "mas-cv", "estetica"],
      ["drag", "mas-cv", "estetica"],
    ] as Objetivo[][]) {
      expect(conflictosEn(combo)).toEqual([]);
    }
  });

  it("elegir uno del par suelta el otro, y los demás se quedan", () => {
    expect(alternarObjetivo(["drift", "mas-cv", "estetica"], "drag")).toEqual([
      "drag",
      "mas-cv",
      "estetica",
    ]);
    expect(alternarObjetivo(["drag"], "drift")).toEqual(["drift"]);
    // Volver a pulsar el que ya está lo apaga, sin tocar a nadie más.
    expect(alternarObjetivo(["drag", "estetica"], "drag")).toEqual(["estetica"]);
    // Y los que no se pelean se acumulan.
    expect(alternarObjetivo(["drift"], "estetica")).toEqual(["drift", "estetica"]);
  });

  it("nunca se puede llegar a tener drift y drag a la vez", () => {
    const todos: Objetivo[] = ["drift", "drag", "mas-cv", "estetica"];
    // Cualquier secuencia de hasta 4 clics deja siempre una selección válida.
    const recorrer = (actual: Objetivo[], quedan: number): void => {
      expect(conflictosEn(actual)).toEqual([]);
      if (quedan === 0) return;
      for (const o of todos) recorrer(alternarObjetivo(actual, o), quedan - 1);
    };
    recorrer([], 4);
  });

  it("si aun así le llegan al motor, avisa en vez de callar", () => {
    const res = generarPresupuesto({ ...base, objetivos: ["drift", "drag"], presupuesto: 8000 });
    expect(res.avisos.join(" ")).toMatch(/preparaciones contrarias/);
  });
});

describe("elige el comprador, no el motor", () => {
  const catalogoReal = cargarCatalogo();
  const grupos = gruposElegibles(catalogoReal, "EA113", ["drift", "estetica"]);

  it("solo ofrece partes donde de verdad hay más de una opción", () => {
    expect(grupos.length).toBeGreaterThan(0);
    for (const g of grupos) {
      expect(g.piezas.length).toBeGreaterThan(1);
      // Todas del mismo grupo, compatibles, y ordenadas de barata a cara.
      for (const p of g.piezas) {
        expect(p.grupoExclusivo).toBe(g.grupo);
        expect(p.plataformas).toContain("EA113");
      }
      const precios = g.piezas.map((p) => p.precio.estimado);
      expect([...precios].sort((a, b) => a - b)).toEqual(precios);
    }
  });

  it("sin objetivos no hay nada que elegir", () => {
    expect(gruposElegibles(catalogoReal, "EA113", [])).toEqual([]);
  });

  it("la pieza elegida entra, y ninguna otra de su grupo", () => {
    const altura = grupos.find((g) => g.grupo === "altura")!;
    for (const elegida of altura.piezas) {
      const res = generarPresupuesto({
        ...base,
        objetivos: ["drift", "estetica"],
        presupuesto: 25000,
        elecciones: [elegida.id],
      });
      const delGrupo = res.lineas.filter((l) => l.pieza.grupoExclusivo === "altura");
      expect(delGrupo.map((l) => l.pieza.id)).toEqual([elegida.id]);
      expect(delGrupo[0].motivo).toBe("elegida");
    }
  });

  it("respeta la elección aunque el motor hubiera puesto otra cosa", () => {
    const solo = generarPresupuesto({ ...base, objetivos: ["drift"], presupuesto: 25000 });
    const suya = solo.lineas.find((l) => l.pieza.grupoExclusivo === "altura")!.pieza;
    const otra = gruposElegibles(catalogoReal, "EA113", ["drift"])
      .find((g) => g.grupo === "altura")!
      .piezas.find((p) => p.id !== suya.id)!;

    const conEleccion = generarPresupuesto({
      ...base,
      objetivos: ["drift"],
      presupuesto: 25000,
      elecciones: [otra.id],
    });
    expect(conEleccion.lineas.map((l) => l.pieza.id)).toContain(otra.id);
    expect(conEleccion.lineas.map((l) => l.pieza.id)).not.toContain(suya.id);
  });

  it("lo elegido cuenta para el mínimo del proyecto", () => {
    const llantas = grupos.find((g) => g.grupo === "llantas")!;
    const barata = llantas.piezas[0];
    const cara = llantas.piezas[llantas.piezas.length - 1];
    expect(cara.precio.estimado).toBeGreaterThan(barata.precio.estimado);

    const conBarata = generarPresupuesto({
      ...base,
      objetivos: ["drift", "estetica"],
      presupuesto: 25000,
      elecciones: [barata.id],
    });
    const conCara = generarPresupuesto({
      ...base,
      objetivos: ["drift", "estetica"],
      presupuesto: 25000,
      elecciones: [cara.id],
    });
    expect(conCara.minimoEsencial).toBeGreaterThan(conBarata.minimoEsencial);
  });

  it("si lo elegido no cabe, lo dice en vez de colarlo o callarse", () => {
    const caras = grupos
      .flatMap((g) => g.piezas)
      .sort((a, b) => b.precio.estimado - a.precio.estimado);
    const cara = caras[0];
    const res = generarPresupuesto({
      ...base,
      objetivos: ["drift", "estetica"],
      presupuesto: 200,
      elecciones: [cara.id],
    });
    expect(res.lineas.map((l) => l.pieza.id)).not.toContain(cara.id);
    expect(res.total).toBeLessThanOrEqual(200);
    expect(res.avisos.join(" ")).toContain(cara.nombre);
  });

  it("una pieza de otra plataforma se ignora avisando", () => {
    const vr6 = catalogoReal.piezas.find(
      (p) => !p.plataformas.includes("EA113") && p.plataformas.includes("VR6"),
    );
    if (!vr6) return;
    const res = generarPresupuesto({ ...base, presupuesto: 9000, elecciones: [vr6.id] });
    expect(res.lineas.map((l) => l.pieza.id)).not.toContain(vr6.id);
    expect(res.avisos.join(" ")).toContain("no encaja");
  });

  it("sin elecciones el resultado es el de siempre", () => {
    // `peticion` se devuelve tal cual, así que ahí sí cambia [] contra undefined. Lo
    // que tiene que ser idéntico es el plan.
    const { peticion: _a, ...a } = generarPresupuesto({ ...base, presupuesto: 6000 });
    const { peticion: _b, ...b } = generarPresupuesto({
      ...base,
      presupuesto: 6000,
      elecciones: [],
    });
    expect(a).toEqual(b);
    expect(a.lineas.every((l) => l.motivo !== "elegida")).toBe(true);
  });
});

describe("generarPresupuesto con catálogo controlado", () => {
  it("avisa cuando no hay piezas para la plataforma", () => {
    const c = catalogo([pieza({ id: "solo-vr6", plataformas: ["VR6"], gama: "baja" })]);
    const res = generarPresupuesto({ ...base, presupuesto: 5000 }, c);
    expect(res.lineas).toHaveLength(0);
    expect(res.avisos.join(" ")).toMatch(/no hay piezas/i);
  });

  it("la gama del build se pondera por dinero, no por número de piezas", () => {
    const c = catalogo([
      pieza({
        id: "cara-alta",
        categoria: "suspension",
        gama: "alta",
        objetivos: { drift: 5 },
        impacto: 5,
        precio: { min: 2000, estimado: 2400, max: 2800 },
      }),
      pieza({
        id: "chica-1",
        categoria: "seguridad",
        gama: "baja",
        objetivos: { drift: 2 },
        impacto: 2,
        precio: { min: 40, estimado: 50, max: 60 },
      }),
      pieza({
        id: "chica-2",
        categoria: "frenos",
        gama: "baja",
        objetivos: { drift: 2 },
        impacto: 2,
        precio: { min: 40, estimado: 50, max: 60 },
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivos: ["drift"], presupuesto: 3000 }, c);
    expect(res.lineas).toHaveLength(3); // dos de gama baja contra una alta
    expect(res.gamaResultante).toBe("alta"); // pero el dinero está en la alta
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
    const res = generarPresupuesto({ ...base, objetivos: ["drag"], presupuesto: 250 }, c);
    expect(res.lineas.map((l) => l.pieza.id)).toEqual(["barata-buena"]);
  });

  it("no monta dos piezas del mismo grupo exclusivo", () => {
    const c = catalogo([
      pieza({
        id: "fmic-media",
        categoria: "admision",
        grupoExclusivo: "intercooler",
        objetivos: { drag: 5 },
        impacto: 4,
        precio: { min: 380, estimado: 450, max: 520 },
      }),
      pieza({
        id: "fmic-alta",
        categoria: "admision",
        grupoExclusivo: "intercooler",
        objetivos: { drag: 5 },
        impacto: 5,
        precio: { min: 700, estimado: 800, max: 950 },
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivos: ["drag"], presupuesto: 5000 }, c);
    const ids = res.lineas.map((l) => l.pieza.id);
    expect(ids).toContain("fmic-alta");
    expect(ids).not.toContain("fmic-media");
    expect(ids.length).toBe(1);
  });

  it("una dependencia se da por cubierta si su grupo ya está ocupado", () => {
    // "mas-cv" cubre admisión antes que turbo, así que el intercooler alta entra
    // primero y la dependencia intercooler del turbo se da por satisfecha.
    const c = catalogo([
      pieza({
        id: "fmic-alta",
        categoria: "admision",
        grupoExclusivo: "intercooler",
        objetivos: { "mas-cv": 5 },
        impacto: 5,
        precio: { min: 700, estimado: 800, max: 950 },
      }),
      pieza({
        id: "fmic-media",
        categoria: "admision",
        grupoExclusivo: "intercooler",
        objetivos: { "mas-cv": 3 },
        impacto: 3,
        precio: { min: 380, estimado: 450, max: 520 },
      }),
      pieza({
        id: "turbo",
        categoria: "turbo",
        objetivos: { "mas-cv": 5 },
        impacto: 5,
        precio: { min: 1000, estimado: 1200, max: 1500 },
        requiere: ["fmic-media"],
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivos: ["mas-cv"], presupuesto: 5000 }, c);
    const ids = res.lineas.map((l) => l.pieza.id).sort();
    expect(ids).toContain("turbo");
    expect(ids).toContain("fmic-alta");
    expect(ids).not.toContain("fmic-media");
  });

  it("el paso de esenciales prefiere la pieza de más aporte técnico, no la más barata", () => {
    const c = catalogo([
      pieza({
        id: "coilovers",
        categoria: "suspension",
        objetivos: { drift: 4 },
        impacto: 5,
        precio: { min: 700, estimado: 950, max: 1200 },
      }),
      pieza({
        id: "casquillos-baratos",
        categoria: "suspension",
        objetivos: { drift: 4 },
        impacto: 3,
        precio: { min: 150, estimado: 200, max: 260 },
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivos: ["drift"], presupuesto: 1200 }, c);
    expect(res.lineas.find((l) => l.motivo === "esencial")?.pieza.id).toBe("coilovers");
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
    const res = generarPresupuesto({ ...base, objetivos: ["drag"], presupuesto: 1200 }, c);
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
    const res = generarPresupuesto({ ...base, objetivos: ["drag"], presupuesto: 1500 }, c);
    const fmic = res.lineas.find((l) => l.pieza.id === "fmic");
    expect(fmic?.motivo).toBe("dependencia");
    expect(res.lineas.map((l) => l.pieza.id).sort()).toEqual(["fmic", "turbo"]);
  });

  // El bug: escape entraba arrastrado por el turbo y aun así se avisaba de que no
  // entraba nada de escape, contradiciendo a `esenciales` en el mismo objeto.
  it("no avisa de una categoría que ya cubrió una dependencia", () => {
    const c = catalogo([
      pieza({
        id: "turbo",
        categoria: "turbo",
        objetivos: { drag: 5 },
        impacto: 5,
        precio: { min: 900, estimado: 1000, max: 1100 },
        requiere: ["downpipe"],
      }),
      pieza({
        id: "downpipe",
        categoria: "escape",
        objetivos: { drag: 4 },
        impacto: 4,
        precio: { min: 380, estimado: 400, max: 420 },
      }),
      pieza({
        id: "catback",
        categoria: "escape",
        objetivos: { drag: 2 },
        impacto: 2,
        precio: { min: 900, estimado: 900, max: 900 },
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivos: ["drag"], presupuesto: 1400 }, c);

    expect(res.lineas.map((l) => l.pieza.id).sort()).toEqual(["downpipe", "turbo"]);
    expect(res.avisos.join(" ")).not.toMatch(/escape/);
  });

  // Dos piezas del mismo grupo son dos formas de hacer lo mismo: montarlas juntas es
  // pagar dos veces. Pasaba con el big brake y las pastillas, que traen los mismos
  // latiguillos y las mismas pastillas delanteras.
  it("nunca monta dos piezas del mismo grupo exclusivo", () => {
    const combos = [["drift"], ["drag"], ["mas-cv"], ["estetica"], ["drag", "estetica"]] as const;
    for (const objetivos of combos) {
      for (const presupuesto of [900, 2500, 4000, 6000, 12000, 25000]) {
        const res = generarPresupuesto({ ...base, objetivos: [...objetivos], presupuesto });
        const vistos = new Set<string>();
        for (const linea of res.lineas) {
          const grupo = linea.pieza.grupoExclusivo;
          if (!grupo) continue;
          expect(vistos.has(grupo), `${grupo} repetido con ${objetivos} y ${presupuesto} €`).toBe(
            false,
          );
          vistos.add(grupo);
        }
      }
    }
  });

  it("el aviso de peligro nombra los frenos cuando se suben caballos sin ellos", () => {
    const res = generarPresupuesto({ ...base, objetivos: ["mas-cv"], presupuesto: 900 });
    expect(riesgosSinCubrir(res)).toContain("frenos");
    expect(fraseRiesgo(res)).toMatch(/peligroso/);
  });

  it("un proyecto solo de estética no se anuncia como peligroso", () => {
    for (const presupuesto of [300, 600, 900]) {
      const res = generarPresupuesto({ ...base, objetivos: ["estetica"], presupuesto });
      expect(riesgosSinCubrir(res)).toEqual([]);
      expect(fraseRiesgo(res)).toBeNull();
    }
  });

  it("no llama peligro a una categoría que el catálogo no puede servir", () => {
    // Catálogo sin una sola pieza de frenos: que no entren no es culpa del dinero.
    const c = catalogo([
      pieza({
        id: "remap",
        categoria: "gestion",
        objetivos: { "mas-cv": 5 },
        impacto: 4,
        precio: { min: 400, estimado: 400, max: 400 },
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivos: ["mas-cv"], presupuesto: 400 }, c);
    expect(res.esenciales.some((e) => e.categoria === "frenos" && e.pieza === null)).toBe(true);
    expect(riesgosSinCubrir(res)).toEqual([]);
    expect(fraseRiesgo(res)).toBeNull();
  });

  it("lo que dicen los avisos concuerda con lo que dice esenciales", () => {
    const combos = [["drift"], ["drag"], ["mas-cv"], ["estetica"], ["drag", "estetica"]] as const;
    for (const objetivos of combos) {
      for (const presupuesto of [500, 1500, 4000, 12000]) {
        const res = generarPresupuesto({ ...base, objetivos: [...objetivos], presupuesto });
        const cubiertas = res.esenciales.filter((e) => e.cubierta).map((e) => e.categoria);
        for (const categoria of cubiertas) {
          const nombre = NOMBRE_CATEGORIA[categoria];
          expect(res.avisos.join(" ")).not.toContain(`no entra nada de ${nombre}`);
        }
      }
    }
  });
});
