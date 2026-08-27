import type { Catalogo, Categoria, Gama, Objetivo, Pieza, Plataforma } from "../src/engine/types";

const OBJETIVOS: Objetivo[] = ["drift", "drag", "mas-cv", "estetica"];

export function pieza(over: Partial<Pieza> & Pick<Pieza, "id">): Pieza {
  const objetivos = { drift: 0, drag: 0, "mas-cv": 0, estetica: 0 } as Record<Objetivo, number>;
  for (const o of OBJETIVOS) if (over.objetivos?.[o] != null) objetivos[o] = over.objetivos[o];

  return {
    id: over.id,
    nombre: over.nombre ?? over.id,
    categoria: over.categoria ?? ("suspension" as Categoria),
    plataformas: over.plataformas ?? (["EA113"] as Plataforma[]),
    gama: over.gama ?? ("media" as Gama),
    precio: over.precio ?? { min: 80, estimado: 100, max: 120 },
    objetivos,
    impacto: over.impacto ?? 3,
    requiere: over.requiere ?? [],
    stage: over.stage,
    nota: over.nota,
  };
}

export function catalogo(piezas: Pieza[]): Catalogo {
  return { version: "test", moneda: "EUR", piezas };
}
