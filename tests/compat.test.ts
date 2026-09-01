import { describe, expect, it } from "vitest";
import { cargarCatalogo } from "../src/engine/catalog";
import { encaja, evaluar, evaluarCatalogo, resumir } from "../src/engine/compat";
import { buscarModelo, listarModelos } from "../src/engine/graph";
import { catalogo, modelo, pieza } from "./helpers";

describe("encaje físico", () => {
  it("las piezas de motor se resuelven por plataforma de motor", () => {
    const p = pieza({ id: "turbo", categoria: "turbo", plataformas: ["EA113"], chasis: [] });
    expect(encaja(p, modelo({ id: "mk5", motor: "EA113", chasis: "PQ35" }))).toBe(true);
    expect(encaja(p, modelo({ id: "mk8", motor: "EA888-evo4", chasis: "MQB Evo" }))).toBe(false);
  });

  it("las piezas de chasis se resuelven por chasis, ignorando el motor", () => {
    const p = pieza({
      id: "coil",
      categoria: "suspension",
      plataformas: ["EA113"],
      chasis: ["MQB Evo"],
    });
    // Mismo motor que la pieza declara, pero otro chasis: no monta.
    expect(encaja(p, modelo({ id: "mk5", motor: "EA113", chasis: "PQ35" }))).toBe(false);
    // Otro motor, chasis correcto: monta.
    expect(encaja(p, modelo({ id: "mk8", motor: "EA888-evo4", chasis: "MQB Evo" }))).toBe(true);
  });
});

describe("fallos por equipamiento de serie", () => {
  const golf8 = modelo({
    id: "golf8",
    nombre: "Golf 8",
    motor: "EA888-evo4",
    chasis: "MQB Evo",
    equipamiento: ["dcc", "vaq"],
  });

  it("un coilover que choca con el DCC no monta", () => {
    const p = pieza({
      id: "coil",
      categoria: "suspension",
      chasis: ["MQB Evo"],
      chocaCon: ["dcc"],
    });
    const r = evaluar(p, golf8, { catalogo: catalogo([p]) });
    expect(r.veredicto).toBe("incompatible");
    expect(r.hallazgos.some((h) => h.motivo === "equipamiento" && h.gravedad === "bloqueo")).toBe(true);
  });

  it("una pieza que exige DCC avisa en un coche que no lo lleva", () => {
    const p = pieza({ id: "coil-dcc", categoria: "suspension", chasis: ["MQB Evo"], exige: ["dcc"] });
    const sinDcc = modelo({ id: "gti", motor: "EA888-evo4", chasis: "MQB Evo" });
    const r = evaluar(p, sinDcc, { catalogo: catalogo([p]) });
    expect(r.veredicto).toBe("con-avisos");
    expect(r.hallazgos.some((h) => h.mensaje.includes("pagas de más"))).toBe(true);
  });

  it("una pieza que duplica equipamiento de serie avisa de redundancia", () => {
    const p = pieza({ id: "lsd", categoria: "transmision", sustituye: ["vaq"] });
    const r = evaluar(p, golf8, { catalogo: catalogo([p]) });
    expect(r.hallazgos.some((h) => h.motivo === "redundancia")).toBe(true);
  });
});

describe("propulsión", () => {
  const id3 = modelo({ id: "id3", nombre: "ID.3", chasis: "MEB", propulsion: "bev" });

  it("un eléctrico no admite admisión, escape, turbo ni gestión", () => {
    for (const categoria of ["admision", "escape", "turbo", "gestion"] as const) {
      const p = pieza({ id: `p-${categoria}`, categoria, plataformas: ["MEB"] });
      const r = evaluar(p, id3, { catalogo: catalogo([p]) });
      expect(r.veredicto).toBe("incompatible");
      expect(r.hallazgos.some((h) => h.motivo === "propulsion")).toBe(true);
    }
  });

  it("un eléctrico sí admite suspensión", () => {
    const p = pieza({ id: "muelles", categoria: "suspension", chasis: ["MEB"] });
    const r = evaluar(p, id3, { catalogo: catalogo([p]) });
    expect(r.veredicto).not.toBe("incompatible");
  });

  it("un híbrido enchufable no admite reprogramación", () => {
    const gte = modelo({ id: "gte", chasis: "MQB Evo", motor: "EA211-PHEV", propulsion: "phev" });
    const p = pieza({ id: "remap", categoria: "gestion", plataformas: ["EA211-PHEV"] });
    expect(evaluar(p, gte, { catalogo: catalogo([p]) }).veredicto).toBe("incompatible");
  });
});

describe("tracción y legalidad", () => {
  it("una conversión de tracción delantera no monta en un 4Motion", () => {
    const p = pieza({ id: "eje", categoria: "direccion", chasis: ["MQB Evo"], traccion: ["delantera"] });
    const total = modelo({ id: "r", motor: "EA888-evo4", chasis: "MQB Evo", traccion: "total" });
    const r = evaluar(p, total, { catalogo: catalogo([p]) });
    expect(r.veredicto).toBe("incompatible");
    expect(r.hallazgos.some((h) => h.motivo === "traccion")).toBe(true);
  });

  it("una pieza de solo circuito monta pero no pasa la ITV", () => {
    const p = pieza({ id: "decat", categoria: "escape", legalidad: "solo-circuito" });
    const r = evaluar(p, modelo({ id: "mk5" }), { catalogo: catalogo([p]) });
    expect(r.veredicto).toBe("con-avisos");
    expect(r.homologable).toBe(false);
  });

  it("una pieza homologable y sin ataduras sale limpia", () => {
    const p = pieza({ id: "filtro", categoria: "admision" });
    const r = evaluar(p, modelo({ id: "mk5" }), { catalogo: catalogo([p]) });
    expect(r.veredicto).toBe("compatible");
    expect(r.homologable).toBe(true);
  });
});

describe("dependencias y grupos", () => {
  const base = pieza({ id: "fmic", categoria: "admision", precio: { min: 400, estimado: 500, max: 600 } });
  const turbo = pieza({
    id: "turbo",
    categoria: "turbo",
    requiere: ["fmic"],
    precio: { min: 1000, estimado: 1500, max: 2000 },
  });

  it("el coste incluye lo que arrastra la pieza", () => {
    const r = evaluar(turbo, modelo({ id: "mk5" }), { catalogo: catalogo([base, turbo]) });
    expect(r.dependencias.map((d) => d.id)).toEqual(["fmic"]);
    expect(r.coste).toBe(2000);
  });

  it("una dependencia incompatible bloquea la pieza entera", () => {
    const soloMk5 = pieza({ id: "fmic", categoria: "admision", plataformas: ["EA113"] });
    const otro = modelo({ id: "mk8", motor: "EA888-evo4", chasis: "MQB Evo" });
    const t = pieza({ id: "turbo", categoria: "turbo", plataformas: ["EA888-evo4"], requiere: ["fmic"] });
    const r = evaluar(t, otro, { catalogo: catalogo([soloMk5, t]) });
    expect(r.veredicto).toBe("incompatible");
    expect(r.hallazgos.some((h) => h.motivo === "dependencia" && h.gravedad === "bloqueo")).toBe(true);
  });

  it("no monta si ya hay otra pieza del mismo grupo exclusivo", () => {
    const a = pieza({ id: "coil-a", categoria: "suspension", grupoExclusivo: "altura" });
    const b = pieza({ id: "coil-b", categoria: "suspension", grupoExclusivo: "altura" });
    const r = evaluar(b, modelo({ id: "mk5" }), { catalogo: catalogo([a, b]), montadas: [a] });
    expect(r.veredicto).toBe("incompatible");
    expect(r.hallazgos.some((h) => h.motivo === "grupo")).toBe(true);
  });
});

describe("la red relacional real", () => {
  const cat = cargarCatalogo();

  it("todos los coches del catálogo tienen piezas que montan", () => {
    for (const m of listarModelos()) {
      const r = resumir(evaluarCatalogo(m, { catalogo: cat }));
      expect(r.compatibles + r.conAvisos).toBeGreaterThan(0);
    }
  });

  it("los coilovers KW V3 dan fallo en un Golf R Mk8, que lleva DCC de serie", () => {
    const r = evaluar(
      cat.piezas.find((p) => p.id === "susp-coil-mqbevo-alta")!,
      buscarModelo("Golf R Mk8")!,
      { catalogo: cat },
    );
    expect(r.veredicto).toBe("incompatible");
    expect(r.hallazgos.some((h) => h.mensaje.includes("DCC"))).toBe(true);
  });

  it("el kit plug and play sí monta en ese mismo Golf R Mk8", () => {
    const r = evaluar(
      cat.piezas.find((p) => p.id === "susp-coil-mqbevo-dcc-alta")!,
      buscarModelo("Golf R Mk8")!,
      { catalogo: cat },
    );
    expect(r.veredicto).not.toBe("incompatible");
  });

  it("el turbo K04 del Mk5 no monta en un Golf 8", () => {
    const r = evaluar(
      cat.piezas.find((p) => p.id === "turbo-k04-alta")!,
      buscarModelo("Golf GTI Mk8")!,
      { catalogo: cat },
    );
    expect(r.veredicto).toBe("incompatible");
  });

  it("el autoblocante del GTI sobra en un Clubsport, que ya trae VAQ", () => {
    const r = evaluar(
      cat.piezas.find((p) => p.id === "trans-lsd-evo4-alta")!,
      buscarModelo("Golf GTI Clubsport Mk8")!,
      { catalogo: cat },
    );
    expect(r.hallazgos.some((h) => h.motivo === "redundancia")).toBe(true);
  });

  it("el downpipe sin DPF nunca sale como homologable", () => {
    const p = cat.piezas.find((x) => x.id === "esc-dp-ea288-media")!;
    for (const m of listarModelos()) {
      expect(evaluar(p, m, { catalogo: cat }).homologable).toBe(false);
    }
  });
});
