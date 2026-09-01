// Exporta los mismos datos que alimentan la bóveda de Obsidian a Cypher, en dos formatos
// que crean exactamente el mismo grafo:
//
//   boveda-vw.cypher    datos incrustados en sentencias UNWIND, para cypher-shell
//   cargar-csv.cypher   + csv/, para pegar en la pestaña Query de Neo4j Desktop
//
//   node .generador/build-neo4j.mjs [carpeta de salida]
//
// Por defecto escribe en .generador/salida/. No toca la bóveda de Obsidian.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COLORES } from "./colores.mjs";
import EDICIONES from "./ediciones.mjs";
import {
  MODELOS,
  limpia,
  rango,
  trocaPlataformas,
  categoriaCarroceria,
  categoriasMecanica,
  nombreDe,
  esParalela,
  lineaPrincipalPorFamilia,
  PIEZAS,
  VENDEDORES,
  PAISES,
  MOTORES_DE,
  modelosDePieza,
  ofertasDePieza,
  homologacionDePieza,
} from "./comun.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = process.argv[2] ?? join(AQUI, "salida");

// Los CSV se copian dentro de la carpeta import de la instancia, en un subdirectorio
// propio para no mezclarlos con otras importaciones. Las URL file:/// de LOAD CSV son
// relativas a esa carpeta import.
const CARPETA_IMPORT = "boveda-vw";
const BASE_URL = `file:///${CARPETA_IMPORT}/`;

// --- serialización a Cypher ------------------------------------------------
// Ojo: en Cypher las claves de un mapa van sin comillas, así que no vale
// JSON.stringify sobre el objeto entero.

function valor(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.map(valor).join(", ")}]`;
  return JSON.stringify(String(v));
}

function mapa(obj) {
  const pares = Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${valor(v)}`);
  return `{${pares.join(", ")}}`;
}

// Las dos salidas (script único y CSV) se generan del mismo registro, para que no puedan
// divergir: nodos() y relaciones() solo apuntan qué hay que crear.
const REGISTRO_NODOS = [];
const REGISTRO_RELACIONES = [];

function nodos(etiqueta, filas) {
  if (!filas.length) return;
  REGISTRO_NODOS.push({ etiqueta, filas });
}

/**
 * `pares` son [origen, destino] o [origen, destino, propiedades]. Cuando hay
 * propiedades hace falta `clave`: la que distingue dos relaciones del mismo par, como la
 * URL de dos ofertas de la misma tienda para la misma pieza.
 */
function relaciones(etiqueta, desde, hasta, pares, clave = null) {
  if (!pares.length) return;
  const unicos = [...new Set(pares.map((p) => JSON.stringify(p)))].map((p) => JSON.parse(p));
  const props = [...new Set(unicos.flatMap(([, , p]) => Object.keys(p ?? {})))];
  REGISTRO_RELACIONES.push({ etiqueta, desde, hasta, pares: unicos, props, clave });
}

/** Sentencias UNWIND con los datos incrustados: un solo archivo, para cypher-shell. */
function bloquesEmbebidos() {
  const out = [];
  for (const { etiqueta, filas } of REGISTRO_NODOS) {
    out.push(`// ${filas.length} ${etiqueta}
UNWIND [
${filas.map((f) => `  ${mapa(f)}`).join(",\n")}
] AS fila
MERGE (n:${etiqueta} {nombre: fila.nombre})
SET n += fila;`);
  }
  for (const { etiqueta, desde, hasta, pares, props, clave } of REGISTRO_RELACIONES) {
    const cabecera = `// ${pares.length} (:${desde})-[:${etiqueta}]->(:${hasta})`;
    if (!props.length) {
      out.push(`${cabecera}
UNWIND [
${pares.map(([a, b]) => `  [${valor(a)}, ${valor(b)}]`).join(",\n")}
] AS r
MATCH (a:${desde} {nombre: r[0]})
MATCH (b:${hasta} {nombre: r[1]})
MERGE (a)-[:${etiqueta}]->(b);`);
    } else {
      out.push(`${cabecera}
UNWIND [
${pares.map(([a, b, p]) => `  ${mapa({ a, b, ...p })}`).join(",\n")}
] AS r
MATCH (a:${desde} {nombre: r.a})
MATCH (b:${hasta} {nombre: r.b})
MERGE (a)-[x:${etiqueta} {${clave}: r.${clave}}]->(b)
SET ${props.map((k) => `x.${k} = r.${k}`).join(", ")};`);
    }
  }
  return out;
}

// --- salida en CSV ---------------------------------------------------------

/** Propiedades que en el CSV llegan como texto y hay que convertir al cargar. */
const CONVERSIONES = {
  Modelo: { anioInicio: "toInteger", anioFin: "toInteger", enProduccion: "toBoolean", paralela: "toBoolean" },
  Edicion: { detallada: "toBoolean" },
};

// Las etiquetas y los tipos de relación son ASCII a propósito, así que el nombre de
// archivo sale directo del nombre del nodo sin tener que limpiar acentos.
const archivoNodo = (etiqueta) => `nodos-${etiqueta.toLowerCase()}.csv`;
const archivoRelacion = (r) =>
  `rel-${`${r.desde}-${r.etiqueta}-${r.hasta}`.toLowerCase().replace(/_/g, "-")}.csv`;

/** Un campo CSV según RFC 4180: se entrecomilla si lleva coma, comilla o salto. */
function campo(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

const csv = (cabeceras, filas) =>
  [cabeceras.join(","), ...filas.map((f) => cabeceras.map((c) => campo(f[c])).join(","))].join("\r\n") + "\r\n";

function archivosCsv() {
  const archivos = new Map();
  const sentencias = [];

  for (const { etiqueta, filas } of REGISTRO_NODOS) {
    const cabeceras = [...new Set(filas.flatMap((f) => Object.keys(f)))];
    archivos.set(archivoNodo(etiqueta), csv(cabeceras, filas));
    const conv = CONVERSIONES[etiqueta] ?? {};
    const sets = cabeceras
      .filter((c) => c !== "nombre")
      .map((c) => `    n.${c} = ${conv[c] ? `${conv[c]}(fila.${c})` : `fila.${c}`}`);
    sentencias.push(`// ${filas.length} ${etiqueta}
LOAD CSV WITH HEADERS FROM '${BASE_URL}${archivoNodo(etiqueta)}' AS fila
MERGE (n:${etiqueta} {nombre: fila.nombre})${sets.length ? `\nSET\n${sets.join(",\n")}` : ""};`);
  }

  for (const r of REGISTRO_RELACIONES) {
    const cabeceras = ["desde", "hasta", ...r.props];
    archivos.set(
      archivoRelacion(r),
      csv(cabeceras, r.pares.map(([a, b, p]) => ({ desde: a, hasta: b, ...(p ?? {}) }))),
    );
    const conversion = (k) => (k === "precio" ? `toFloat(fila.${k})` : `fila.${k}`);
    const cola = r.props.length
      ? `MERGE (a)-[x:${r.etiqueta} {${r.clave}: fila.${r.clave}}]->(b)\nSET ${r.props.map((k) => `x.${k} = ${conversion(k)}`).join(", ")};`
      : `MERGE (a)-[:${r.etiqueta}]->(b);`;
    sentencias.push(`// ${r.pares.length} (:${r.desde})-[:${r.etiqueta}]->(:${r.hasta})
LOAD CSV WITH HEADERS FROM '${BASE_URL}${archivoRelacion(r)}' AS fila
MATCH (a:${r.desde} {nombre: fila.desde})
MATCH (b:${r.hasta} {nombre: fila.hasta})
${cola}`);
  }

  return { archivos, sentencias };
}

// --- recolección -----------------------------------------------------------

const set = (xs) => [...new Set(xs)];

const familias = set(MODELOS.map((m) => limpia(m.f)));
const plataformas = set(MODELOS.flatMap((m) => trocaPlataformas(m.plat).map(limpia)));
const mercados = set(MODELOS.flatMap((m) => m.merc.map(limpia)));
const carrocerias = set(MODELOS.flatMap((m) => m.carr.map((c) => limpia(categoriaCarroceria(c)))));
const acabados = set(MODELOS.flatMap((m) => m.sub.map(limpia)));
const mecanicas = set(MODELOS.flatMap((m) => m.prop.flatMap(categoriasMecanica)));

const detalle = new Map(EDICIONES.map((e) => [e.n, e]));
const edicionBase = new Map(); // edición -> [nombres de modelo]
for (const m of MODELOS) {
  for (const e of m.ed) {
    const k = limpia(e);
    if (!edicionBase.has(k)) edicionBase.set(k, []);
    if (!edicionBase.get(k).includes(nombreDe.get(m))) edicionBase.get(k).push(nombreDe.get(m));
  }
}

const coloresUsados = set([
  ...MODELOS.flatMap((m) => m.col.map(limpia)),
  ...EDICIONES.flatMap((e) => (e.col || []).map(limpia)),
]);
const familiasCromaticas = set(
  coloresUsados.map((c) => (COLORES[c] || ["", "Sin clasificar"])[1]),
);

// --- nodos -----------------------------------------------------------------

nodos("Modelo", MODELOS.map((m) => ({
  nombre: nombreDe.get(m),
  familia: limpia(m.f),
  generacion: m.g,
  codigo: m.cod,
  anios: rango(m.a),
  anioInicio: m.a[0],
  anioFin: m.a[1],
  enProduccion: m.a[1] === null,
  paralela: esParalela(m),
  nota: m.nota,
})));

nodos("Familia", familias.map((nombre) => ({ nombre })));
nodos("Plataforma", plataformas.map((nombre) => ({ nombre })));
nodos("Mercado", mercados.map((nombre) => ({ nombre })));
nodos("Carroceria", carrocerias.map((nombre) => ({ nombre })));
nodos("Acabado", acabados.map((nombre) => ({ nombre })));
nodos("Mecanica", mecanicas.map((nombre) => ({ nombre })));
nodos("FamiliaCromatica", familiasCromaticas.map((nombre) => ({ nombre })));

nodos("Color", coloresUsados.map((nombre) => {
  const [acabado, familiaCromatica, nombreEs] = COLORES[nombre] || ["por confirmar", "Sin clasificar", ""];
  return { nombre, nombreEs: nombreEs || null, acabado, familiaCromatica };
}));

nodos("Edicion", [...edicionBase.keys()].map((nombre) => {
  const d = detalle.get(nombre);
  const base = edicionBase.get(nombre).map((n) => MODELOS.find((m) => nombreDe.get(m) === n));
  return {
    nombre,
    anio: d ? String(d.anio) : base[0] ? rango(base[0].a) : null,
    unidades: d?.uds ?? null,
    detalle: d?.det ?? null,
    detallada: Boolean(d),
  };
}));

const motores = [...new Set(MODELOS.flatMap((m) => MOTORES_DE(m)))].sort();
nodos("Motor", motores.map((nombre) => ({ nombre })));
nodos("Vendedor", VENDEDORES.map((nombre) => ({ nombre })));
nodos("Pais", PAISES.map((nombre) => ({ nombre })));

nodos("Pieza", PIEZAS.map((p) => {
  const ofertas = ofertasDePieza(p.id);
  const h = homologacionDePieza(p.id);
  return {
    nombre: limpia(p.nombre),
    id: p.id,
    categoria: p.categoria,
    ambito: p.ambito,
    precioTipo: p.precioTipo,
    oficial: p.oficial,
    gama: p.gama,
    referencia: p.referencia,
    precioOrientativo: p.precio?.estimado ?? null,
    precioMinimoVerificado: ofertas.length ? Math.min(...ofertas.map((o) => o.precio)) : null,
    precioVerificado: ofertas.length > 0,
    homologacionVerificada: Boolean(h),
    nota: p.nota,
  };
}));

// --- relaciones ------------------------------------------------------------

relaciones("MONTA_MOTOR", "Modelo", "Motor",
  MODELOS.flatMap((m) => MOTORES_DE(m).map((x) => [nombreDe.get(m), x])));

relaciones("PARA_MOTOR", "Pieza", "Motor",
  PIEZAS.flatMap((p) => p.motores.map((x) => [limpia(p.nombre), x])));

relaciones("COMPATIBLE_CON", "Pieza", "Modelo",
  PIEZAS.flatMap((p) => modelosDePieza(p).map((n) => [limpia(p.nombre), n])));

relaciones("SE_VENDE_EN", "Pieza", "Vendedor",
  PIEZAS.flatMap((p) =>
    ofertasDePieza(p.id).map((o) => [
      limpia(p.nombre),
      o.vendedor,
      {
        url: o.url,
        producto: o.producto,
        precio: o.precio,
        moneda: o.moneda,
        fecha: o.fecha,
        referencia: o.referencia ?? "",
      },
    ]),
  ),
  "url");

relaciones("HOMOLOGADA_EN", "Pieza", "Pais",
  PIEZAS.flatMap((p) => (homologacionDePieza(p.id)?.homologada ?? []).map((x) => [limpia(p.nombre), x])));

relaciones("NO_HOMOLOGADA_EN", "Pieza", "Pais",
  PIEZAS.flatMap((p) => (homologacionDePieza(p.id)?.no_homologada ?? []).map((x) => [limpia(p.nombre), x])));


relaciones("DE_FAMILIA", "Modelo", "Familia",
  MODELOS.map((m) => [nombreDe.get(m), limpia(m.f)]));

relaciones("USA", "Modelo", "Plataforma",
  MODELOS.flatMap((m) => trocaPlataformas(m.plat).map((p) => [nombreDe.get(m), limpia(p)])));

relaciones("VENDIDO_EN", "Modelo", "Mercado",
  MODELOS.flatMap((m) => m.merc.map((x) => [nombreDe.get(m), limpia(x)])));

relaciones("TIENE_CARROCERIA", "Modelo", "Carroceria",
  MODELOS.flatMap((m) => m.carr.map((c) => [nombreDe.get(m), limpia(categoriaCarroceria(c))])));

relaciones("OFRECE", "Modelo", "Acabado",
  MODELOS.flatMap((m) => m.sub.map((s) => [nombreDe.get(m), limpia(s)])));

relaciones("MONTA", "Modelo", "Mecanica",
  MODELOS.flatMap((m) => m.prop.flatMap((p) => categoriasMecanica(p).map((c) => [nombreDe.get(m), c]))));

relaciones("DISPONIBLE_EN", "Modelo", "Color",
  MODELOS.flatMap((m) => m.col.map((c) => [nombreDe.get(m), limpia(c)])));

relaciones("DE_FAMILIA_CROMATICA", "Color", "FamiliaCromatica",
  coloresUsados.map((c) => [c, (COLORES[c] || ["", "Sin clasificar"])[1]]));

relaciones("BASADA_EN", "Edicion", "Modelo",
  [...edicionBase].flatMap(([e, ms]) => ms.map((m) => [e, m])));

relaciones("DISPONIBLE_EN", "Edicion", "Color",
  EDICIONES.flatMap((e) => (e.col || []).map((c) => [limpia(e.n), limpia(c)])));

relaciones("VENDIDA_EN", "Edicion", "Mercado",
  EDICIONES.flatMap((e) => (e.merc || []).map((x) => [limpia(e.n), limpia(x)])));

// Sucesión de generaciones dentro de cada familia, encadenada por año de lanzamiento.
// Solo entra la línea principal: las generaciones marcadas como paralelas quedan fuera
// de la cadena, porque encadenarlas por año partiría la sucesión por la mitad. Siguen
// existiendo como nodos, con paralela = true.
const sucesion = [];
for (const [, gens] of lineaPrincipalPorFamilia()) {
  for (let i = 1; i < gens.length; i++) {
    sucesion.push([nombreDe.get(gens[i]), nombreDe.get(gens[i - 1])]);
  }
}
relaciones("SUCEDE_A", "Modelo", "Modelo", sucesion);

// --- escritura -------------------------------------------------------------

const ETIQUETAS = ["Modelo", "Familia", "Plataforma", "Mercado", "Carroceria", "Acabado",
  "Mecanica", "Color", "FamiliaCromatica", "Edicion", "Motor", "Pieza", "Vendedor", "Pais"];

const restricciones = ETIQUETAS.map(
  (e) => `CREATE CONSTRAINT ${e.toLowerCase()}_nombre IF NOT EXISTS
FOR (n:${e}) REQUIRE n.nombre IS UNIQUE;`,
).join("\n\n");

const HOY = new Date().toISOString().slice(0, 10);
// Comillas simples a propósito: esta consulta se pasa como argumento suelto a
// cypher-shell desde cargar.ps1, y PowerShell se come las comillas dobles por el camino.
const borrado = `// MATCH (n) WHERE any(l IN labels(n) WHERE l IN [${ETIQUETAS.map((e) => `'${e}'`).join(", ")}]) DETACH DELETE n;`;

const cabecera = `// Bóveda Volkswagen 2006-2026 -> Neo4j
// Generado por .generador/build-neo4j.mjs el ${HOY}.
// No editar a mano: se regenera desde los archivos datos*.mjs.
//
// Carga:
//   cypher-shell -u neo4j -p TU_CLAVE -f boveda-vw.cypher
//   o, en Neo4j Desktop 2:  .\\cargar.ps1
//
// Para vaciar antes lo que hubiera de una carga anterior, descomenta esta línea.
// Solo borra los nodos de esta bóveda, no toca el resto de la base de datos:
//
${borrado}

${restricciones}`;

const cabeceraCsv = `// Bóveda Volkswagen 2006-2026 -> Neo4j, variante CSV
// Generado por .generador/build-neo4j.mjs el ${HOY}.
//
// Antes de ejecutar esto, la carpeta csv/ tiene que estar copiada como
// "${CARPETA_IMPORT}" dentro del directorio import de la instancia:
//
//   .\\copiar-csv.ps1
//
// Después pega este archivo entero en la pestaña Query de Desktop. Son sentencias
// cortas: el editor las traga sin problema, al contrario que boveda-vw.cypher.
//
// Los nodos van antes que las relaciones y el orden importa: cada MATCH de relación
// espera que los dos extremos existan ya.
//
${borrado}

${restricciones}`;

const ejemplos = `// Consultas de ejemplo sobre la bóveda Volkswagen.
// Para pegar en Neo4j Browser de una en una.

// 1. Colores que solo existieron en Latinoamérica y nunca en Europa
MATCH (c:Color)<-[:DISPONIBLE_EN]-(m:Modelo)-[:VENDIDO_EN]->(:Mercado {nombre: "Latinoamérica"})
WHERE NOT EXISTS {
  MATCH (c)<-[:DISPONIBLE_EN]-(:Modelo)-[:VENDIDO_EN]->(:Mercado {nombre: "Europa"})
}
RETURN c.nombre AS color, c.acabado AS acabado, collect(DISTINCT m.nombre) AS modelos
ORDER BY size(modelos) DESC;

// 2. Modelos que comparten plataforma y paleta con el Golf Mk7
MATCH (g:Modelo {nombre: "Golf Mk7"})-[:USA]->(:Plataforma)<-[:USA]-(o:Modelo)
MATCH (g)-[:DISPONIBLE_EN]->(c:Color)<-[:DISPONIBLE_EN]-(o)
RETURN o.nombre AS modelo, count(c) AS coloresComunes, collect(c.nombre) AS colores
ORDER BY coloresComunes DESC;

// 3. La línea completa del Golf, generación a generación
MATCH camino = (nuevo:Modelo)-[:SUCEDE_A*]->(viejo:Modelo)
WHERE nuevo.familia = "Golf" AND NOT (:Modelo)-[:SUCEDE_A]->(nuevo)
RETURN [n IN nodes(camino) | n.nombre + " (" + n.anios + ")"] AS linea;

// 4. Qué acabado se repite en más modelos distintos
MATCH (m:Modelo)-[:OFRECE]->(a:Acabado)
WITH a, count(DISTINCT m) AS modelos
WHERE modelos > 3
RETURN a.nombre AS acabado, modelos ORDER BY modelos DESC;

// 5. Ediciones especiales con cifra de producción confirmada, por año
MATCH (e:Edicion)-[:BASADA_EN]->(m:Modelo)
WHERE e.detallada
RETURN e.anio AS anio, e.nombre AS edicion, e.unidades AS unidades, m.nombre AS base
ORDER BY anio;

// 6. Color más repetido de cada familia cromática
MATCH (c:Color)-[:DE_FAMILIA_CROMATICA]->(f:FamiliaCromatica)
OPTIONAL MATCH (c)<-[:DISPONIBLE_EN]-(m:Modelo)
WITH f, c, count(m) AS usos
ORDER BY usos DESC
RETURN f.nombre AS familia, collect({color: c.nombre, modelos: usos})[0] AS masUsado;

// 7. Modelos eléctricos y en qué mercados se vendieron
MATCH (m:Modelo)-[:MONTA]->(:Mecanica {nombre: "Eléctrico"})
MATCH (m)-[:VENDIDO_EN]->(mk:Mercado)
RETURN m.nombre AS modelo, m.anios AS anios, collect(mk.nombre) AS mercados
ORDER BY m.anioInicio;

// 8. Qué plataforma ha aguantado más años en producción
MATCH (m:Modelo)-[:USA]->(p:Plataforma)
RETURN p.nombre AS plataforma,
       min(m.anioInicio) AS desde,
       max(coalesce(m.anioFin, date().year)) AS hasta,
       count(m) AS modelos
ORDER BY hasta - desde DESC;

// 9. Colores exclusivos de series especiales, que nunca entraron en gama
MATCH (c:Color)<-[:DISPONIBLE_EN]-(e:Edicion)
WHERE NOT (c)<-[:DISPONIBLE_EN]-(:Modelo)
RETURN c.nombre AS color, collect(e.nombre) AS ediciones;

// 10. Todo lo vendido a la vez en China y en Latinoamérica
MATCH (m:Modelo)-[:VENDIDO_EN]->(:Mercado {nombre: "China"})
MATCH (m)-[:VENDIDO_EN]->(:Mercado {nombre: "Latinoamérica"})
RETURN m.nombre AS modelo, m.anios AS anios ORDER BY m.anioInicio;

// 11. El grafo entero de un modelo, para verlo dibujado
MATCH camino = (m:Modelo {nombre: "Golf Mk8"})-[]-()
RETURN camino;
`;

const bloques = bloquesEmbebidos();
const { archivos, sentencias } = archivosCsv();

mkdirSync(SALIDA, { recursive: true });
writeFileSync(join(SALIDA, "boveda-vw.cypher"), `${cabecera}\n\n${bloques.join("\n\n")}\n`, "utf8");
writeFileSync(join(SALIDA, "ejemplos.cypher"), ejemplos, "utf8");

// Volcado plano del mismo registro, para el visor de grafo. Neo4j no hace falta para
// mirarlo, así que este archivo es lo que consume build-grafo.mjs.
writeFileSync(join(SALIDA, "grafo.json"), JSON.stringify({
  generado: HOY,
  nodos: REGISTRO_NODOS.flatMap(({ etiqueta, filas }) =>
    filas.map((f) => ({ id: `${etiqueta}::${f.nombre}`, etiqueta, ...f })),
  ),
  enlaces: REGISTRO_RELACIONES.flatMap(({ etiqueta, desde, hasta, pares }) =>
    pares.map(([a, b, p]) => ({
      desde: `${desde}::${a}`,
      hasta: `${hasta}::${b}`,
      tipo: etiqueta,
      ...(p ?? {}),
    })),
  ),
}), "utf8");

const dirCsv = join(SALIDA, "csv");
mkdirSync(dirCsv, { recursive: true });
for (const [nombre, contenido] of archivos) writeFileSync(join(dirCsv, nombre), contenido, "utf8");
writeFileSync(join(SALIDA, "cargar-csv.cypher"), `${cabeceraCsv}\n\n${sentencias.join("\n\n")}\n`, "utf8");

const cuentaNodos = REGISTRO_NODOS.reduce((n, x) => n + x.filas.length, 0);
const cuentaRelaciones = REGISTRO_RELACIONES.reduce((n, x) => n + x.pares.length, 0);

console.log(`Escrito en ${SALIDA}`);
console.log(`Nodos: ${cuentaNodos} | Relaciones: ${cuentaRelaciones}`);
console.log(`  boveda-vw.cypher   ${bloques.length + ETIQUETAS.length} sentencias, datos incrustados`);
console.log(`  cargar-csv.cypher  ${sentencias.length + ETIQUETAS.length} sentencias + csv/ con ${archivos.size} archivos`);
console.log(`Modelos ${MODELOS.length} · Ediciones ${edicionBase.size} · Colores ${coloresUsados.length} · Acabados ${acabados.length} · Mecánicas ${mecanicas.length}`);
