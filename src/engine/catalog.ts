// Carga y validación del catálogo de piezas.

import type { Catalogo, Categoria, Gama, Objetivo, Pieza, Plataforma } from "./types";
import catalogoJson from "../data/catalog.json";

const PLATAFORMAS: readonly Plataforma[] = ["1.8T-20v", "EA113", "EA888", "VR6", "TDI"];
const GAMAS: readonly Gama[] = ["baja", "media", "alta"];
const OBJETIVOS: readonly Objetivo[] = ["drift", "drag", "mas-cv", "estetica"];
const CATEGORIAS: readonly Categoria[] = [
  "admision",
  "escape",
  "turbo",
  "gestion",
  "suspension",
  "transmision",
  "frenos",
  "direccion",
  "seguridad",
  "ruedas",
  "estetica",
];

export class CatalogoInvalidoError extends Error {
  readonly problemas: string[];

  constructor(problemas: string[]) {
    super(`Catálogo inválido:\n- ${problemas.join("\n- ")}`);
    this.name = "CatalogoInvalidoError";
    this.problemas = problemas;
  }
}

/** Revisa la coherencia del catálogo y devuelve la lista de problemas encontrados. */
export function validarCatalogo(catalogo: Catalogo): string[] {
  const problemas: string[] = [];
  const vistos = new Set<string>();

  for (const [i, pieza] of catalogo.piezas.entries()) {
    const ref = pieza.id || `#${i}`;

    if (!pieza.id) problemas.push(`Pieza ${ref}: sin id`);
    else if (vistos.has(pieza.id)) problemas.push(`Pieza ${ref}: id duplicado`);
    else vistos.add(pieza.id);

    if (!CATEGORIAS.includes(pieza.categoria)) {
      problemas.push(`Pieza ${ref}: categoría desconocida "${pieza.categoria}"`);
    }
    if (!GAMAS.includes(pieza.gama)) {
      problemas.push(`Pieza ${ref}: gama desconocida "${pieza.gama}"`);
    }
    if (!Array.isArray(pieza.plataformas) || pieza.plataformas.length === 0) {
      problemas.push(`Pieza ${ref}: sin plataformas`);
    } else {
      for (const p of pieza.plataformas) {
        if (!PLATAFORMAS.includes(p)) problemas.push(`Pieza ${ref}: plataforma desconocida "${p}"`);
      }
    }

    const { min, estimado, max } = pieza.precio ?? ({} as Pieza["precio"]);
    if ([min, estimado, max].some((n) => typeof n !== "number" || n <= 0)) {
      problemas.push(`Pieza ${ref}: precios deben ser números positivos`);
    } else if (!(min <= estimado && estimado <= max)) {
      problemas.push(`Pieza ${ref}: se espera min <= estimado <= max (${min}/${estimado}/${max})`);
    }

    for (const obj of OBJETIVOS) {
      const v = pieza.objetivos?.[obj];
      if (typeof v !== "number" || v < 0 || v > 5) {
        problemas.push(`Pieza ${ref}: objetivo "${obj}" debe estar entre 0 y 5`);
      }
    }

    if (typeof pieza.impacto !== "number" || pieza.impacto < 1 || pieza.impacto > 5) {
      problemas.push(`Pieza ${ref}: impacto debe estar entre 1 y 5`);
    }

    if (!Array.isArray(pieza.requiere)) {
      problemas.push(`Pieza ${ref}: "requiere" debe ser una lista`);
    }
  }

  // Las dependencias deben apuntar a ids que existan y no ser circulares.
  for (const pieza of catalogo.piezas) {
    for (const dep of pieza.requiere ?? []) {
      if (!vistos.has(dep)) {
        problemas.push(`Pieza ${pieza.id}: depende de "${dep}", que no existe`);
      }
    }
  }
  problemas.push(...detectarCiclos(catalogo.piezas));

  return problemas;
}

function detectarCiclos(piezas: Pieza[]): string[] {
  const porId = new Map(piezas.map((p) => [p.id, p]));
  const estado = new Map<string, "visitando" | "hecho">();
  const problemas: string[] = [];

  const visitar = (id: string, ruta: string[]): void => {
    const st = estado.get(id);
    if (st === "hecho") return;
    if (st === "visitando") {
      problemas.push(`Dependencia circular: ${[...ruta, id].join(" -> ")}`);
      return;
    }
    estado.set(id, "visitando");
    for (const dep of porId.get(id)?.requiere ?? []) {
      if (porId.has(dep)) visitar(dep, [...ruta, id]);
    }
    estado.set(id, "hecho");
  };

  for (const p of piezas) visitar(p.id, []);
  return problemas;
}

let cache: Catalogo | null = null;

/** Devuelve el catálogo incluido en la app, validado. Lanza si algo no cuadra. */
export function cargarCatalogo(): Catalogo {
  if (cache) return cache;
  const catalogo = catalogoJson as Catalogo;
  const problemas = validarCatalogo(catalogo);
  if (problemas.length > 0) throw new CatalogoInvalidoError(problemas);
  cache = catalogo;
  return catalogo;
}
