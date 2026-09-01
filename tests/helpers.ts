import type {
  Catalogo,
  Categoria,
  Gama,
  ModeloVW,
  Objetivo,
  Pieza,
  Plataforma,
} from "../src/engine/types";

const OBJETIVOS: Objetivo[] = ["drift", "drag", "mas-cv", "estetica"];

export function pieza(over: Partial<Pieza> & Pick<Pieza, "id">): Pieza {
  const objetivos = { drift: 0, drag: 0, "mas-cv": 0, estetica: 0 } as Record<Objetivo, number>;
  for (const o of OBJETIVOS) if (over.objetivos?.[o] != null) objetivos[o] = over.objetivos[o];

  return {
    id: over.id,
    nombre: over.nombre ?? over.id,
    categoria: over.categoria ?? ("suspension" as Categoria),
    plataformas: over.plataformas ?? (["EA113"] as Plataforma[]),
    chasis: over.chasis ?? [],
    legalidad: over.legalidad ?? "homologable",
    traccion: over.traccion ?? [],
    sustituye: over.sustituye ?? [],
    exige: over.exige ?? [],
    chocaCon: over.chocaCon ?? [],
    gama: over.gama ?? ("media" as Gama),
    precio: over.precio ?? { min: 80, estimado: 100, max: 120 },
    objetivos,
    impacto: over.impacto ?? 3,
    requiere: over.requiere ?? [],
    grupoExclusivo: over.grupoExclusivo,
    stage: over.stage,
    nota: over.nota,
  };
}

export function catalogo(piezas: Pieza[]): Catalogo {
  return { version: "test", moneda: "EUR", piezas };
}

export function modelo(over: Partial<ModeloVW> & Pick<ModeloVW, "id">): ModeloVW {
  return {
    id: over.id,
    nombre: over.nombre ?? over.id,
    alias: over.alias ?? [],
    chasis: over.chasis ?? "PQ35",
    motor: over.motor ?? "EA113",
    motorDetalle: over.motorDetalle ?? "",
    traccion: over.traccion ?? "delantera",
    propulsion: over.propulsion ?? "combustion",
    equipamiento: over.equipamiento ?? [],
    anios: over.anios ?? [2000, 2010],
  };
}
