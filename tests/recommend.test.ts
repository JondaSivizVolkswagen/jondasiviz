import { describe, expect, it } from "vitest";
import { cargarCatalogo } from "../src/engine/catalog";
import { dependenciaCubierta, generarPresupuesto } from "../src/engine/recommend";
import type { PeticionPresupuesto, Presupuesto } from "../src/engine/types";
import { catalogo, pieza } from "./helpers";

const base: PeticionPresupuesto = {
  plataforma: "EA113",
  presupuesto: 4000,
  objetivos: ["drag"],
};

/**
 * Toda dependencia del plan tiene que estar cubierta: por su propia pieza o por otra
 * del mismo grupo que hace su trabajo, que es lo que deja el motor tras sustituir.
 */
function dependenciasCubiertas(plan: Presupuesto): boolean {
  const porId = new Map(cargarCatalogo().piezas.map((p) => [p.id, p] as const));
  const montadas = plan.lineas.map((l) => l.pieza);
  return montadas.every((p) =>
    p.requiere.every((dep) => dependenciaCubierta(dep, montadas, porId)),
  );
}

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

  it("las mejoras no repiten función: o el grupo está libre o es un cambio declarado", () => {
    for (const presupuesto of [800, 2000, 6000, 12000]) {
      const res = generarPresupuesto({ ...base, objetivos: ["drift"], presupuesto });
      const montadaDe = new Map(
        res.lineas
          .filter((l) => l.pieza.grupoExclusivo)
          .map((l) => [l.pieza.grupoExclusivo!, l.pieza.id] as const),
      );
      const sugeridos = new Set<string>();
      for (const m of res.siguientesMejoras) {
        const g = m.pieza.grupoExclusivo;
        if (!g) continue;
        // Si el grupo ya está ocupado, la mejora tiene que decir a quién sustituye.
        expect(m.sustituye?.id ?? null).toBe(montadaDe.get(g) ?? null);
        expect(sugeridos.has(g)).toBe(false);
        sugeridos.add(g);
      }
    }
  });

  it("respeta las dependencias: si entra una pieza, entra lo que necesita", () => {
    const res = generarPresupuesto({ ...base, presupuesto: 15000 });
    expect(dependenciasCubiertas(res)).toBe(true);
  });

  it("ninguna combinación deja una dependencia sin cubrir", () => {
    const combos = [["drag"], ["mas-cv"], ["drift"], ["drag", "mas-cv"]] as const;
    for (const objetivos of combos) {
      for (const presupuesto of [1500, 4000, 8000, 15000, 25000]) {
        const res = generarPresupuesto({ ...base, objetivos: [...objetivos], presupuesto });
        expect(dependenciasCubiertas(res)).toBe(true);
      }
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
    expect(dependenciasCubiertas(res)).toBe(true);
  });

  it("con dinero de sobra el turbo-back sustituye al downpipe que exige el K04", () => {
    const res = generarPresupuesto({ ...base, objetivos: ["drag"], presupuesto: 20000 });
    const ids = new Set(res.lineas.map((l) => l.pieza.id));
    expect(ids.has("turbo-k04-alta")).toBe(true);
    // El K04 pide esc-dp-media, pero el turbo-back lo incluye y aporta más a drag.
    expect(ids.has("esc-turboback-alta")).toBe(true);
    expect(ids.has("esc-dp-media")).toBe(false);
    expect(res.lineas.filter((l) => l.pieza.grupoExclusivo === "downpipe")).toHaveLength(1);
    expect(res.total).toBeLessThanOrEqual(20000);
  });

  it("no sustituye por una pieza que aporte lo mismo o menos a los objetivos", () => {
    // Para "mas-cv" el turbo-back no aporta más que el downpipe: se queda el barato.
    const res = generarPresupuesto({ ...base, objetivos: ["mas-cv"], presupuesto: 20000 });
    const ids = new Set(res.lineas.map((l) => l.pieza.id));
    expect(ids.has("esc-turboback-alta")).toBe(false);
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

  it("una pieza mejor sustituye a la dependencia de su grupo y recupera su dinero", () => {
    const c = catalogo([
      pieza({
        id: "turbo",
        categoria: "turbo",
        objetivos: { drag: 5 },
        impacto: 5,
        precio: { min: 1400, estimado: 1500, max: 1700 },
        requiere: ["downpipe"],
      }),
      pieza({
        id: "downpipe",
        categoria: "escape",
        grupoExclusivo: "downpipe",
        objetivos: { drag: 4 },
        impacto: 4,
        precio: { min: 380, estimado: 400, max: 450 },
      }),
      pieza({
        id: "turbo-back",
        categoria: "escape",
        grupoExclusivo: "downpipe",
        objetivos: { drag: 5 },
        impacto: 4,
        precio: { min: 900, estimado: 1000, max: 1200 },
      }),
    ]);
    // 2.500 € no dan para turbo + downpipe + turbo-back (2.900), pero sí para
    // turbo + turbo-back (2.500) en cuanto el downpipe devuelve sus 400 €.
    const res = generarPresupuesto({ ...base, objetivos: ["drag"], presupuesto: 2500 }, c);
    const ids = res.lineas.map((l) => l.pieza.id).sort();
    expect(ids).toEqual(["turbo", "turbo-back"]);
    expect(res.total).toBe(2500);
    // El sustituto hereda el papel: sigue estando ahí porque el turbo lo necesita.
    expect(res.lineas.find((l) => l.pieza.id === "turbo-back")?.motivo).toBe("dependencia");
  });

  it("no sustituye si la diferencia no cabe en el presupuesto", () => {
    const c = catalogo([
      pieza({
        id: "turbo",
        categoria: "turbo",
        objetivos: { drag: 5 },
        impacto: 5,
        precio: { min: 1400, estimado: 1500, max: 1700 },
        requiere: ["downpipe"],
      }),
      pieza({
        id: "downpipe",
        categoria: "escape",
        grupoExclusivo: "downpipe",
        objetivos: { drag: 4 },
        impacto: 4,
        precio: { min: 380, estimado: 400, max: 450 },
      }),
      pieza({
        id: "turbo-back",
        categoria: "escape",
        grupoExclusivo: "downpipe",
        objetivos: { drag: 5 },
        impacto: 4,
        precio: { min: 900, estimado: 1000, max: 1200 },
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivos: ["drag"], presupuesto: 2000 }, c);
    const ids = res.lineas.map((l) => l.pieza.id).sort();
    expect(ids).toEqual(["downpipe", "turbo"]);
    // Y lo que no cabe se ofrece como cambio, pidiendo solo la diferencia.
    const mejora = res.siguientesMejoras.find((m) => m.pieza.id === "turbo-back");
    expect(mejora?.sustituye?.id).toBe("downpipe");
    expect(mejora?.falta).toBe(500); // 1000 - 400 devueltos - 100 de sobrante
  });

  it("no sustituye a una pieza de la que depende el sustituto", () => {
    const c = catalogo([
      pieza({
        id: "turbo",
        categoria: "turbo",
        objetivos: { drag: 5 },
        impacto: 5,
        precio: { min: 1400, estimado: 1500, max: 1700 },
        requiere: ["escape-basico"],
      }),
      pieza({
        id: "escape-basico",
        categoria: "escape",
        grupoExclusivo: "downpipe",
        objetivos: { drag: 3 },
        impacto: 3,
        precio: { min: 180, estimado: 200, max: 240 },
      }),
      pieza({
        id: "escape-completo",
        categoria: "escape",
        grupoExclusivo: "downpipe",
        objetivos: { drag: 5 },
        impacto: 5,
        precio: { min: 900, estimado: 1000, max: 1200 },
        requiere: ["escape-basico"],
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivos: ["drag"], presupuesto: 5000 }, c);
    // El completo necesita al básico, así que no puede echarlo del plan aunque aporte más.
    expect(res.lineas.map((l) => l.pieza.id).sort()).toEqual(["escape-basico", "turbo"]);
    expect(res.siguientesMejoras.map((m) => m.pieza.id)).not.toContain("escape-completo");
  });

  it("no sustituye si el cambio deja sin cubrir la categoría de la pieza que sale", () => {
    const c = catalogo([
      pieza({
        id: "muelles-rebaje",
        categoria: "suspension",
        grupoExclusivo: "altura",
        objetivos: { drift: 3 },
        impacto: 3,
        precio: { min: 180, estimado: 200, max: 240 },
      }),
      pieza({
        id: "kit-estetico",
        categoria: "estetica",
        grupoExclusivo: "altura",
        objetivos: { drift: 5 },
        impacto: 4,
        precio: { min: 500, estimado: 600, max: 700 },
      }),
    ]);
    const res = generarPresupuesto({ ...base, objetivos: ["drift"], presupuesto: 5000 }, c);
    // Suspensión es esencial de drift y solo la cubre esa pieza: no se cambia.
    expect(res.lineas.map((l) => l.pieza.id)).toEqual(["muelles-rebaje"]);
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
});
