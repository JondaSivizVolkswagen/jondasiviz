// Datos y utilidades compartidas por los dos exportadores: build.mjs (Obsidian) y
// build-neo4j.mjs (Cypher). Todo lo que decida cómo se llama una nota vive aquí, para
// que los dos destinos usen exactamente los mismos nombres.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import d1 from "./datos1.mjs";
import d2 from "./datos2.mjs";
import d3 from "./datos3.mjs";
import d4 from "./datos4.mjs";
import { MOTORES } from "./motores.mjs";
import {
  OFICIALES,
  OFERTAS,
  HOMOLOGACION,
  AMBITO,
  PLATAFORMAS_TURISMO,
  CATEGORIAS_SERVICIO,
  CATEGORIAS_VOLATILES,
} from "./piezas.mjs";

export const MODELOS = [...d1, ...d2, ...d3, ...d4];

/** Quita los caracteres que Windows no admite en un nombre de archivo. */
export const limpia = (s) => s.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();

/**
 * Nombre único de un modelo. Si la generación ya menciona la familia se usa tal cual
 * ("Fox (Brasil)"), y si no se antepone la familia ("Golf" + "Mk7").
 */
export function nombreModelo(m) {
  const palabras = m.f.split(/[\s/]+/).filter(Boolean);
  const yaEsta = palabras.some((p) => m.g.toLowerCase().includes(p.toLowerCase()));
  return limpia(yaEsta ? m.g : `${m.f} ${m.g}`);
}

export const rango = (a) =>
  a[1] === null ? `${a[0]}-presente` : a[0] === a[1] ? `${a[0]}` : `${a[0]}-${a[1]}`;

/** "PQ34, PQ35 y MQB" -> ["PQ34", "PQ35", "MQB"] */
export const trocaPlataformas = (p) =>
  p.split(/,\s*| y (?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);

/** "Familiar campero (Alltrack)" -> "Familiar campero" */
export const categoriaCarroceria = (c) => c.split("(")[0].trim();

export const nombreDe = new Map(MODELOS.map((m) => [m, nombreModelo(m)]));

/**
 * Reduce las mecánicas escritas a mano a categorías comparables entre modelos.
 * Una misma cadena puede caer en varias ("Gasolina 1.0 y 1.6 flex").
 */
export function categoriasMecanica(texto) {
  const cats = new Set();
  if (/el[eé]ctric/i.test(texto)) cats.add("Eléctrico");
  if (/enchufable|GTE|eHybrid|PHEV/i.test(texto)) cats.add("Híbrido enchufable");
  else if (/h[ií]brid/i.test(texto)) cats.add("Híbrido");
  if (/di[eé]sel|TDI|SDI/i.test(texto)) cats.add("Diésel");
  if (/gas natural|TGI|EcoFuel|BiFuel/i.test(texto)) cats.add("Gas natural");
  if (/flex/i.test(texto)) cats.add("Flex-fuel");
  if (/gasolina|TSI|TFSI|FSI|MPI|MSI|EcoBoost|VR6|W12/i.test(texto)) cats.add("Gasolina");
  if (cats.size === 0) cats.add("Sin clasificar");
  return [...cats];
}

/**
 * Una generación marcada con `paralela: true` no continúa la línea de su familia: es una
 * versión regional que convivió con ella. El Golf Mk4 que Brasil siguió fabricando hasta
 * 2013, por ejemplo, o el Passat NMS de Norteamérica. Si se encadenan por año de
 * lanzamiento junto al resto, parten la sucesión por la mitad.
 */
export const esParalela = (m) => m.paralela === true;

/** Generaciones de una familia ordenadas por año de lanzamiento. */
export function generacionesPorFamilia() {
  const familias = new Map();
  for (const m of MODELOS) {
    const f = limpia(m.f);
    if (!familias.has(f)) familias.set(f, []);
    familias.get(f).push(m);
  }
  for (const [, ms] of familias) ms.sort((a, b) => a.a[0] - b.a[0]);
  return familias;
}

/** Lo mismo, pero solo con la línea principal: sirve para encadenar la sucesión. */
export function lineaPrincipalPorFamilia() {
  const familias = new Map();
  for (const [f, ms] of generacionesPorFamilia()) {
    const principales = ms.filter((m) => !esParalela(m));
    if (principales.length) familias.set(f, principales);
  }
  return familias;
}

// --- piezas ----------------------------------------------------------------

const AQUI = dirname(fileURLToPath(import.meta.url));
const RUTA_CATALOGO = join(AQUI, "..", "..", "src", "data", "catalog.json");

/** Catálogo del planner. Si no está, la bóveda se genera solo con las piezas oficiales. */
function leeCatalogoDelPlanner() {
  try {
    const bruto = JSON.parse(readFileSync(RUTA_CATALOGO, "utf8"));
    const lista = Array.isArray(bruto) ? bruto : bruto.piezas ?? Object.values(bruto).find(Array.isArray);
    return lista ?? [];
  } catch {
    console.warn(`Aviso: no se pudo leer ${RUTA_CATALOGO}. Solo se generan las piezas oficiales.`);
    return [];
  }
}

const nombresDeModelo = new Set(nombreDe.values());

// Las claves de MOTORES son nombres de nota: si una no existe, el fallo es silencioso y
// el modelo se queda sin piezas sin que nadie se entere. Mejor que reviente aquí.
{
  const sobran = Object.keys(MOTORES).filter((k) => !nombresDeModelo.has(k));
  const faltan = [...nombresDeModelo].filter((n) => !(n in MOTORES));
  if (sobran.length || faltan.length) {
    throw new Error(
      `motores.mjs no cuadra con los modelos.\n` +
        (sobran.length ? `  Claves que no son ningún modelo: ${sobran.join(", ")}\n` : "") +
        (faltan.length ? `  Modelos sin entrada: ${faltan.join(", ")}\n` : ""),
    );
  }
}

{
  const idsOficiales = new Set(OFICIALES.map((p) => p.id));
  const malos = OFICIALES.flatMap((p) => p.modelos.filter((m) => !nombresDeModelo.has(m)));
  if (malos.length) throw new Error(`Piezas oficiales con modelos inexistentes: ${[...new Set(malos)].join(", ")}`);

  const idsCatalogo = new Set(leeCatalogoDelPlanner().map((p) => p.id));
  const huerfanas = OFERTAS.filter((o) => !idsOficiales.has(o.pieza) && !idsCatalogo.has(o.pieza));
  if (huerfanas.length) {
    throw new Error(`Ofertas que apuntan a piezas inexistentes: ${huerfanas.map((o) => o.pieza).join(", ")}`);
  }
}

export const MOTORES_DE = (m) => MOTORES[nombreDe.get(m)] ?? [];

/**
 * Cómo hay que leer el precio de una pieza:
 *   servicio  trabajo de taller, se presupuesta, no tiene página de producto
 *   volatil   cambia semana a semana, el número solo sirve de orden de magnitud
 *   fijo      precio de catálogo, verificable en una tienda concreta
 */
const tipoDePrecio = (categoria) =>
  CATEGORIAS_SERVICIO.includes(categoria) ? "servicio"
  : CATEGORIAS_VOLATILES.includes(categoria) ? "volatil"
  : "fijo";

/**
 * Piezas en formato único, vengan del planner o de este repositorio.
 * `motores` manda en las no oficiales y `modelos` en las oficiales: un accesorio de
 * Volkswagen se pide por modelo, no por motor.
 */
export const PIEZAS = [
  ...leeCatalogoDelPlanner().map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria,
    oficial: false,
    gama: p.gama ?? null,
    precio: p.precio ?? null,
    motores: p.plataformas ?? [],
    modelos: null,
    referencia: null,
    ambito: AMBITO[p.categoria] ?? "motor",
    precioTipo: tipoDePrecio(p.categoria),
    nota: p.nota ?? null,
  })),
  ...OFICIALES.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria,
    oficial: true,
    gama: null,
    precio: null,
    motores: [],
    modelos: p.modelos,
    referencia: p.referencia,
    ambito: AMBITO[p.categoria] ?? "chasis",
    precioTipo: tipoDePrecio(p.categoria),
    nota: p.nota ?? null,
  })),
];

export const esServicio = (p) => p.precioTipo === "servicio";
export const esVolatil = (p) => p.precioTipo === "volatil";

const esTurismo = (m) => trocaPlataformas(m.plat).some((p) => PLATAFORMAS_TURISMO.includes(p));

/** Modelos a los que entra una pieza. */
export function modelosDePieza(pieza) {
  if (pieza.oficial) return [...pieza.modelos];
  return MODELOS.filter((m) => {
    if (!MOTORES_DE(m).some((x) => pieza.motores.includes(x))) return false;
    return pieza.ambito === "motor" || esTurismo(m);
  }).map((m) => nombreDe.get(m));
}

const indicePorModelo = new Map();
for (const pieza of PIEZAS) {
  for (const n of modelosDePieza(pieza)) {
    if (!indicePorModelo.has(n)) indicePorModelo.set(n, []);
    indicePorModelo.get(n).push(pieza);
  }
}

/** Piezas que entran a un modelo, por su nombre de nota. */
export const piezasDeModelo = (nombre) => indicePorModelo.get(nombre) ?? [];

export const ofertasDePieza = (id) => OFERTAS.filter((o) => o.pieza === id);
export const homologacionDePieza = (id) => HOMOLOGACION[id] ?? null;
export const VENDEDORES = [...new Set(OFERTAS.map((o) => o.vendedor))].sort();
export const PAISES = [
  ...new Set(Object.values(HOMOLOGACION).flatMap((h) => [...h.homologada, ...h.no_homologada])),
].sort();
