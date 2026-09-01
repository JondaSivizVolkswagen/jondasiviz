// Carga y validación del catálogo de piezas.

import type {
  Catalogo,
  Categoria,
  Chasis,
  Equipamiento,
  Gama,
  Legalidad,
  Objetivo,
  Pieza,
  Plataforma,
  Traccion,
} from "./types";
import catalogoJson from "../data/catalog.json";

const CHASIS: readonly Chasis[] = [
  "A2",
  "PQ24",
  "PQ25",
  "PQ34",
  "PQ35",
  "PQ46",
  "NSF",
  "MQB",
  "MQB-A0",
  "MQB Evo",
  "MLB",
  "MLB Evo",
  "PL71",
  "MEB",
  "PPE",
  "J1",
];
const LEGALIDADES: readonly Legalidad[] = ["homologable", "requiere-ficha", "solo-circuito"];
const TRACCIONES: readonly Traccion[] = ["delantera", "trasera", "total"];
const EQUIPAMIENTOS: readonly Equipamiento[] = [
  "dcc",
  "vaq",
  "diferencial-trasero",
  "frenos-grandes",
  "dsg",
  "gpf",
  "dpf",
  "magnetic-ride",
  "haldex",
  "torsen",
  "act",
  "scr-adblue",
  "hibridacion-48v",
  "suspension-neumatica",
  "frenos-ceramicos",
];

const PLATAFORMAS: readonly Plataforma[] = [
  "1.8T-20v",
  "EA113",
  "VR6",
  "TDI",
  "EA888-gen2",
  "EA888-gen3",
  "EA888-evo4",
  "EA211",
  "EA211-evo",
  "EA211-PHEV",
  "EA288",
  "EA288-evo",
  "EA288-16",
  "EA111",
  "EA855",
  "EA837",
  "EA839",
  "EA825",
  "V8-FSI",
  "EA189",
  "EA189-16",
  "EA897",
  "EA824",
  "MEB",
  "PPE",
  "J1",
];
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

    if (!Array.isArray(pieza.chasis)) {
      problemas.push(`Pieza ${ref}: "chasis" debe ser una lista`);
    } else {
      for (const c of pieza.chasis) {
        if (!CHASIS.includes(c)) problemas.push(`Pieza ${ref}: chasis desconocido "${c}"`);
      }
    }
    if (!LEGALIDADES.includes(pieza.legalidad)) {
      problemas.push(`Pieza ${ref}: legalidad desconocida "${pieza.legalidad}"`);
    }
    for (const [campo, valores, validos] of [
      ["traccion", pieza.traccion, TRACCIONES],
      ["sustituye", pieza.sustituye, EQUIPAMIENTOS],
      ["exige", pieza.exige, EQUIPAMIENTOS],
      ["chocaCon", pieza.chocaCon, EQUIPAMIENTOS],
    ] as const) {
      if (!Array.isArray(valores)) {
        problemas.push(`Pieza ${ref}: "${campo}" debe ser una lista`);
        continue;
      }
      for (const v of valores) {
        if (!(validos as readonly string[]).includes(v)) {
          problemas.push(`Pieza ${ref}: valor desconocido en "${campo}": "${v}"`);
        }
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
