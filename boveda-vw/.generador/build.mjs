import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COLORES } from "./colores.mjs";
import EDICIONES from "./ediciones.mjs";
import {
  MODELOS,
  limpia,
  rango,
  trocaPlataformas,
  categoriaCarroceria,
  nombreDe,
  esParalela,
  PIEZAS,
  VENDEDORES,
  PAISES,
  MOTORES_DE,
  modelosDePieza,
  piezasDeModelo,
  ofertasDePieza,
  homologacionDePieza,
} from "./comun.mjs";

const RAIZ = process.argv[2];
if (!RAIZ) { console.error("Falta la ruta de destino"); process.exit(1); }

// --- utilidades ------------------------------------------------------------

const enlace = (n) => `[[${limpia(n)}]]`;
const lista = (arr) => arr.map((x) => `- ${x}`).join("\n");

const euros = (n) =>
  `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Una línea de pieza dentro de la ficha de un modelo. */
function lineaPieza(p) {
  const ofertas = ofertasDePieza(p.id);
  const barata = ofertas.length ? ofertas.reduce((a, b) => (a.precio <= b.precio ? a : b)) : null;
  const h = homologacionDePieza(p.id);
  const trozos = [enlace(p.nombre)];
  if (p.referencia && p.referencia !== "pendiente") trozos.push(p.referencia);
  if (barata) trozos.push(`${euros(barata.precio)} en ${enlace(barata.vendedor)}`);
  else if (p.precio?.estimado) trozos.push(`${euros(p.precio.estimado)} orientativos`);
  else trozos.push("precio pendiente");
  if (h?.no_homologada.length) trozos.push(`no homologada en ${h.no_homologada.map(enlace).join(", ")}`);
  else if (h?.homologada.length) trozos.push(`homologada en ${h.homologada.map(enlace).join(", ")}`);
  return `- ${trozos.join(" · ")}`;
}

/** Piezas de un modelo agrupadas por categoría, ya en markdown. */
function bloquePiezas(piezas) {
  const porCategoria = new Map();
  for (const p of piezas) {
    if (!porCategoria.has(p.categoria)) porCategoria.set(p.categoria, []);
    porCategoria.get(p.categoria).push(p);
  }
  return [...porCategoria.keys()].sort().map((c) =>
    `**${c}**\n\n${porCategoria.get(c).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(lineaPieza).join("\n")}`,
  ).join("\n\n");
}
const listaEnlaces = (arr) => arr.map((x) => `- ${enlace(x)}`).join("\n");
const yamlLista = (arr) => arr.map((x) => `  - ${JSON.stringify(x)}`).join("\n");

function escribe(carpeta, nombre, texto) {
  const dir = join(RAIZ, carpeta);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${limpia(nombre)}.md`), texto.replace(/\n{3,}/g, "\n\n"), "utf8");
}

// --- índices en memoria ----------------------------------------------------

const familias = new Map();      // familia -> [modelos]
const plataformas = new Map();   // plataforma -> [nombres de modelo]
const mercados = new Map();
const carrocerias = new Map();
const colorUso = new Map();      // color -> [nombres de modelo]
const edicionUso = new Map();    // edición -> [nombres de modelo]
const desconocidos = new Set();

function apunta(mapa, clave, valor) {
  const k = limpia(clave);
  if (!mapa.has(k)) mapa.set(k, []);
  if (!mapa.get(k).includes(valor)) mapa.get(k).push(valor);
}

for (const m of MODELOS) {
  const n = nombreDe.get(m);
  apunta(familias, m.f, n);
  for (const p of trocaPlataformas(m.plat)) apunta(plataformas, p, n);
  for (const x of m.merc) apunta(mercados, x, n);
  for (const c of m.carr) apunta(carrocerias, categoriaCarroceria(c), n);
  for (const c of m.col) {
    apunta(colorUso, c, n);
    if (!COLORES[c]) desconocidos.add(c);
  }
  for (const e of m.ed) apunta(edicionUso, e, n);
}

const colorEdicion = new Map(); // color -> [ediciones]
for (const e of EDICIONES) {
  for (const c of e.col || []) {
    apunta(colorEdicion, c, e.n);
    if (!COLORES[c]) desconocidos.add(c);
  }
}

// --- notas de modelo -------------------------------------------------------

for (const m of MODELOS) {
  const n = nombreDe.get(m);
  const edic = m.ed.length ? `\n## Ediciones especiales y series limitadas\n\n${listaEnlaces(m.ed)}\n` : "";
  const piezas = piezasDeModelo(n);
  const oficiales = piezas.filter((p) => p.oficial);
  const noOficiales = piezas.filter((p) => !p.oficial);
  const bloqueMercado = `
## Piezas disponibles en el mercado

### Oficiales de Volkswagen

${oficiales.length ? bloquePiezas(oficiales) : "Sin accesorios originales recogidos todavía para esta generación."}

### No oficiales

${
  noOficiales.length
    ? `${bloquePiezas(noOficiales)}\n\n> La homologación es por país y por referencia concreta, no por tipo de pieza. Lo que no lleva indicación está sin verificar.`
    : "Ninguna. El catálogo cubre las familias de motor 1.8T-20v, EA113, EA888, VR6 y TDI, y este modelo no monta ninguna."
}
`;
  const cuerpo = `---
tipo: modelo
familia: ${JSON.stringify(limpia(m.f))}
generacion: ${JSON.stringify(m.g)}
codigo_interno: ${JSON.stringify(m.cod)}
anios: ${JSON.stringify(rango(m.a))}
anio_inicio: ${m.a[0]}
anio_fin: ${m.a[1] === null ? "presente" : m.a[1]}
linea: ${esParalela(m) ? "paralela" : "principal"}
plataforma: ${JSON.stringify(m.plat)}
mercados:
${yamlLista(m.merc)}
carrocerias:
${yamlLista(m.carr)}
propulsion:
${yamlLista(m.prop)}
motores:
${yamlLista(MOTORES_DE(m))}
piezas_oficiales: ${oficiales.length}
piezas_no_oficiales: ${noOficiales.length}
---

# ${n}

${m.nota}

Familia ${enlace(m.f)} · Plataforma ${trocaPlataformas(m.plat).map(enlace).join(" · ")} · Años ${rango(m.a)}
${esParalela(m) ? "\n> Variante regional: convivió con la línea principal de la familia en vez de sucederla.\n" : ""}

## Carrocerías

${lista(m.carr)}

Categorías: ${m.carr.map((c) => enlace(categoriaCarroceria(c))).join(" · ")}

## Acabados y submodelos

${lista(m.sub)}
${edic}
## Mecánicas

${lista(m.prop)}

Familias de motor: ${MOTORES_DE(m).length ? MOTORES_DE(m).map(enlace).join(" · ") : "ninguna del grupo Volkswagen recogida en esta bóveda"}
${bloqueMercado}
## Mercados

${listaEnlaces(m.merc)}

## Colores de carrocería

${listaEnlaces(m.col)}

> La gama de color de un mismo modelo cambia por año, mercado y acabado. Esta lista recoge los colores más habituales de la generación, no un catálogo cerrado de un año concreto.
`;
  escribe("Modelos", n, cuerpo);
}

// --- notas de familia ------------------------------------------------------

for (const [fam, hijos] of familias) {
  const orden = hijos
    .map((h) => MODELOS.find((m) => nombreDe.get(m) === h))
    .sort((a, b) => a.a[0] - b.a[0]);
  const filas = orden
    .map((m) => `- ${enlace(nombreDe.get(m))} · ${rango(m.a)} · ${m.plat}${esParalela(m) ? " · variante regional" : ""}`)
    .join("\n");
  escribe("Familias", fam, `---
tipo: familia
nombre: ${JSON.stringify(fam)}
generaciones: ${orden.length}
---

# ${fam}

Generaciones y variantes de la familia ${fam} recogidas en esta bóveda.

${filas}
`);
}

// --- notas de color --------------------------------------------------------

const todosLosColores = [...new Set([...colorUso.keys(), ...colorEdicion.keys()])].sort();

for (const color of todosLosColores) {
  const usos = colorUso.get(color) || [];
  const edics = colorEdicion.get(color) || [];
  const meta = COLORES[color] || ["por confirmar", "Sin clasificar", ""];
  const [acabado, fam, es] = meta;
  const bloqueModelos = usos.length
    ? `## Modelos que lo han ofrecido\n\n${listaEnlaces(usos.sort())}\n`
    : `## Modelos que lo han ofrecido\n\nSolo aparece en series especiales, no en la gama general de ningún modelo.\n`;
  const bloqueEdiciones = edics.length
    ? `\n## Ediciones especiales con este color\n\n${listaEnlaces(edics.sort())}\n`
    : "";
  escribe("Colores", color, `---
tipo: color
nombre: ${JSON.stringify(color)}
nombre_es: ${JSON.stringify(es || "")}
acabado: ${JSON.stringify(acabado)}
familia_cromatica: ${JSON.stringify(fam)}
modelos: ${usos.length}
ediciones: ${edics.length}
---

# ${color}${es ? ` (${es})` : ""}

Acabado ${acabado}. Familia cromática ${fam}.

${bloqueModelos}${bloqueEdiciones}`);
}

// --- notas de edición ------------------------------------------------------

const detalle = new Map(EDICIONES.map((e) => [e.n, e]));

for (const [ed, modelos] of [...edicionUso].sort()) {
  const d = detalle.get(ed);
  const base = modelos.map((x) => MODELOS.find((m) => nombreDe.get(m) === x)).filter(Boolean);
  const anio = d?.anio ?? (base[0] ? rango(base[0].a) : "");
  const merc = d?.merc ?? [...new Set(base.flatMap((m) => m.merc))];
  const col = d?.col ?? [...new Set(base.flatMap((m) => m.col))].slice(0, 6);
  const cuerpo = d
    ? d.det
    : `Serie especial de ${base.map((m) => nombreDe.get(m)).join(" y ")}. Ficha por completar con unidades, año exacto y equipamiento diferencial.`;
  escribe("Ediciones", ed, `---
tipo: edicion
nombre: ${JSON.stringify(ed)}
anio: ${JSON.stringify(String(anio))}
unidades: ${JSON.stringify(d?.uds ?? "sin confirmar")}
detallada: ${d ? "sí" : "no"}
mercados:
${yamlLista(merc)}
---

# ${ed}

${cuerpo}

Modelo base: ${modelos.map(enlace).join(" · ")}

## Mercados

${listaEnlaces(merc)}

## Colores asociados

${listaEnlaces(col)}
`);
}

// --- motores, piezas, vendedores y países ----------------------------------

const motores = new Map();
for (const m of MODELOS) for (const x of MOTORES_DE(m)) apunta(motores, x, nombreDe.get(m));

for (const [motor, ms] of [...motores].sort()) {
  const piezasMotor = PIEZAS.filter((p) => p.motores.includes(motor));
  escribe("Motores", motor, `---
tipo: motor
nombre: ${JSON.stringify(motor)}
modelos: ${ms.length}
piezas: ${piezasMotor.length}
---

# ${motor}

Familia de motor. Las piezas no oficiales del catálogo se declaran para familias como
esta, no para modelos concretos: si un coche la monta, la pieza le entra.

## Modelos que la montan

${listaEnlaces(ms.sort())}

${piezasMotor.length ? `## Piezas para esta familia\n\n${listaEnlaces(piezasMotor.map((p) => p.nombre).sort())}` : "Sin piezas en el catálogo para esta familia."}
`);
}

for (const p of PIEZAS) {
  const ofertas = ofertasDePieza(p.id);
  const h = homologacionDePieza(p.id);
  const compatibles = modelosDePieza(p).sort();
  const bloqueOfertas = ofertas.length
    ? ofertas
        .map((o) =>
          `- [${o.producto}](${o.url}) · ${enlace(o.vendedor)} · **${euros(o.precio)}**` +
          `${o.referencia ? ` · referencia ${o.referencia}` : ""} · consultado el ${o.fecha}`,
        )
        .join("\n")
    : "Sin oferta verificada todavía. El precio orientativo de arriba viene del catálogo del planner, no de una tienda concreta.";

  const bloqueHomologacion = h
    ? `${h.homologada.length ? `**Homologada en:** ${h.homologada.map(enlace).join(", ")}\n\n` : ""}` +
      `${h.no_homologada.length ? `**No homologada en:** ${h.no_homologada.map(enlace).join(", ")}\n\n` : ""}` +
      `${h.nota}`
    : "Sin verificar. No se ha comprobado en qué países es legalizable, así que aquí no pone nada.";

  escribe("Piezas", p.nombre, `---
tipo: pieza
id: ${JSON.stringify(p.id)}
categoria: ${JSON.stringify(p.categoria)}
oficial: ${p.oficial ? "sí" : "no"}
gama: ${p.gama ? JSON.stringify(p.gama) : "null"}
referencia: ${p.referencia ? JSON.stringify(p.referencia) : "null"}
precio_orientativo: ${p.precio?.estimado ?? "null"}
ofertas: ${ofertas.length}
precio_verificado: ${ofertas.length ? "sí" : "no"}
homologacion_verificada: ${h ? "sí" : "no"}
homologada_en:
${yamlLista(h?.homologada ?? [])}
no_homologada_en:
${yamlLista(h?.no_homologada ?? [])}
ambito: ${JSON.stringify(p.ambito)}
modelos_compatibles: ${compatibles.length}
motores:
${yamlLista(p.motores)}
---

# ${p.nombre}

${p.nota ?? ""}

${p.oficial ? "Accesorio o recambio original de Volkswagen." : "Pieza de mercado no oficial."}${p.gama ? ` Gama ${p.gama}.` : ""}${p.precio?.estimado ? ` Precio orientativo del catálogo: entre ${euros(p.precio.min)} y ${euros(p.precio.max)}.` : ""}

## Dónde comprarla

${bloqueOfertas}

## Homologación

${bloqueHomologacion}

## Modelos compatibles

${
  p.oficial
    ? "Accesorio de catálogo: la compatibilidad la fija Volkswagen por modelo."
    : p.ambito === "motor"
      ? `Pieza de motor: entra en cualquier modelo que monte ${p.motores.join(", ")}.`
      : `Pieza de chasis: se limita a los modelos de turismo que montan ${p.motores.join(", ")}. Cada referencia concreta vale para una carrocería, así que esta lista dice dónde buscar, no qué comprar.`
}

${compatibles.length ? listaEnlaces(compatibles) : "Ninguno de los recogidos en esta bóveda."}
`);
}

const ofertasPorVendedor = new Map(VENDEDORES.map((v) => [v, []]));
for (const p of PIEZAS) for (const o of ofertasDePieza(p.id)) ofertasPorVendedor.get(o.vendedor).push(o);

for (const v of VENDEDORES) {
  const suyas = ofertasPorVendedor.get(v) ?? [];
  escribe("Vendedores", v, `---
tipo: vendedor
nombre: ${JSON.stringify(v)}
ofertas: ${suyas.length}
---

# ${v}

Tienda de la que sale al menos un precio verificado de esta bóveda.

## Ofertas recogidas

${suyas.map((o) => `- [${o.producto}](${o.url}) · **${euros(o.precio)}** · consultado el ${o.fecha}`).join("\n")}
`);
}

for (const pais of PAISES) {
  const si = PIEZAS.filter((p) => homologacionDePieza(p.id)?.homologada.includes(pais));
  const no = PIEZAS.filter((p) => homologacionDePieza(p.id)?.no_homologada.includes(pais));
  escribe("Paises", pais, `---
tipo: pais
nombre: ${JSON.stringify(pais)}
piezas_homologadas: ${si.length}
piezas_no_homologadas: ${no.length}
---

# ${pais}

Situación legal de las piezas de la bóveda en este país, según lo que declara cada
producto y el régimen de reformas vigente.

## Homologadas

${si.length ? listaEnlaces(si.map((p) => p.nombre).sort()) : "Ninguna verificada."}

## No homologadas

${no.length ? listaEnlaces(no.map((p) => p.nombre).sort()) : "Ninguna verificada."}

> Comprobado pieza a pieza y solo donde había fuente. Una pieza sin aparecer en ninguna
> de las dos listas no es que sea legal: es que no está verificada.
`);
}

// --- plataformas, mercados, carrocerías ------------------------------------

for (const [p, ms] of [...plataformas].sort()) {
  escribe("Plataformas", p, `---
tipo: plataforma
nombre: ${JSON.stringify(p)}
modelos: ${ms.length}
---

# ${p}

Modelos de la bóveda construidos sobre esta plataforma o derivados de ella.

${listaEnlaces(ms.sort())}
`);
}

for (const [x, ms] of [...mercados].sort()) {
  escribe("Mercados", x, `---
tipo: mercado
nombre: ${JSON.stringify(x)}
modelos: ${ms.length}
---

# ${x}

Modelos vendidos en este mercado durante el periodo cubierto.

${listaEnlaces(ms.sort())}
`);
}

for (const [x, ms] of [...carrocerias].sort()) {
  escribe("Carrocerias", x, `---
tipo: carroceria
nombre: ${JSON.stringify(x)}
modelos: ${ms.length}
---

# ${x}

${listaEnlaces(ms.sort())}
`);
}

// --- índices ---------------------------------------------------------------

const porAnio = [...MODELOS].sort((a, b) => a.a[0] - b.a[0] || nombreDe.get(a).localeCompare(nombreDe.get(b)));
escribe("Indices", "Índice por año de lanzamiento", `---
tipo: indice
---

# Índice por año de lanzamiento

${porAnio.map((m) => `- ${m.a[0]} · ${enlace(nombreDe.get(m))} · ${rango(m.a)}`).join("\n")}
`);

escribe("Indices", "Índice por familia", `---
tipo: indice
---

# Índice por familia

${[...familias.keys()].sort().map((f) => `- ${enlace(f)} (${familias.get(f).length})`).join("\n")}
`);

escribe("Indices", "Índice por plataforma", `---
tipo: indice
---

# Índice por plataforma

${[...plataformas.keys()].sort().map((p) => `- ${enlace(p)} (${plataformas.get(p).length})`).join("\n")}
`);

escribe("Indices", "Índice por mercado", `---
tipo: indice
---

# Índice por mercado

${[...mercados.keys()].sort().map((p) => `- ${enlace(p)} (${mercados.get(p).length})`).join("\n")}
`);

const porFamiliaCromatica = new Map();
for (const c of todosLosColores) {
  const fam = (COLORES[c] || ["", "Sin clasificar"])[1];
  if (!porFamiliaCromatica.has(fam)) porFamiliaCromatica.set(fam, []);
  porFamiliaCromatica.get(fam).push(c);
}
escribe("Indices", "Índice de colores", `---
tipo: indice
---

# Índice de colores

${[...porFamiliaCromatica.keys()].sort().map((fam) =>
  `## ${fam}\n\n${porFamiliaCromatica.get(fam).sort().map((c) => {
    const meta = COLORES[c] || ["por confirmar", fam, ""];
    return `- ${enlace(c)} · ${meta[0]}${meta[2] ? ` · ${meta[2]}` : ""} · ${(colorUso.get(limpia(c)) || []).length} modelos`;
  }).join("\n")}`
).join("\n\n")}
`);

const porCategoriaPieza = new Map();
for (const p of PIEZAS) {
  const k = `${p.oficial ? "Oficiales" : "No oficiales"} · ${p.categoria}`;
  if (!porCategoriaPieza.has(k)) porCategoriaPieza.set(k, []);
  porCategoriaPieza.get(k).push(p);
}

escribe("Indices", "Índice de piezas", `---
tipo: indice
piezas: ${PIEZAS.length}
con_precio_verificado: ${PIEZAS.filter((p) => ofertasDePieza(p.id).length).length}
con_homologacion_verificada: ${PIEZAS.filter((p) => homologacionDePieza(p.id)).length}
---

# Índice de piezas

${PIEZAS.filter((p) => ofertasDePieza(p.id).length).length} de ${PIEZAS.length} piezas tienen precio y enlace comprobados uno a uno.
El resto lleva el precio orientativo del catálogo del planner y ninguna tienda asociada.

${[...porCategoriaPieza.keys()].sort().map((k) =>
  `## ${k}\n\n${porCategoriaPieza.get(k)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((p) => {
      const o = ofertasDePieza(p.id);
      const h = homologacionDePieza(p.id);
      const precio = o.length
        ? `${euros(Math.min(...o.map((x) => x.precio)))} verificado`
        : p.precio?.estimado ? `${euros(p.precio.estimado)} orientativo` : "sin precio";
      const leg = h?.no_homologada.length
        ? `no homologada en ${h.no_homologada.join(", ")}`
        : h?.homologada.length ? `homologada en ${h.homologada.join(", ")}` : "homologación sin verificar";
      return `- ${enlace(p.nombre)} · ${precio} · ${leg}`;
    }).join("\n")}`,
).join("\n\n")}
`);

escribe("Indices", "Índice de ediciones especiales", `---
tipo: indice
---

# Índice de ediciones especiales

${[...edicionUso.keys()].sort().map((e) => {
  const d = detalle.get(e);
  return `- ${enlace(e)}${d ? ` · ${d.anio} · ${d.uds}` : ""}`;
}).join("\n")}
`);

// --- portada ---------------------------------------------------------------

const totalColores = todosLosColores.length;
const totalEdiciones = edicionUso.size;
writeFileSync(join(RAIZ, "_Inicio.md"), `---
tipo: portada
generado: ${new Date().toISOString().slice(0, 10)}
modelos: ${MODELOS.length}
familias: ${familias.size}
ediciones: ${totalEdiciones}
colores: ${totalColores}
---

# Volkswagen 2006-2026

Bóveda de consulta con las generaciones de turismos y comerciales ligeros de Volkswagen
en los últimos veinte años, sus acabados, sus series especiales y los colores de
carrocería asociados a cada una. Cobertura global: Europa, Norteamérica, Latinoamérica,
China, India, Sudáfrica y Australia.

- **${MODELOS.length}** fichas de modelo repartidas en **${familias.size}** familias
- **${totalEdiciones}** ediciones especiales y series limitadas
- **${totalColores}** colores de carrocería con sus modelos asociados
- **${PIEZAS.length}** piezas de mercado, **${PIEZAS.filter((p) => p.oficial).length}** oficiales y **${PIEZAS.filter((p) => !p.oficial).length}** no oficiales
- **${plataformas.size}** plataformas, **${motores.size}** familias de motor y **${mercados.size}** mercados

## Por dónde empezar

- ${enlace("Índice por familia")}
- ${enlace("Índice por año de lanzamiento")}
- ${enlace("Índice por plataforma")}
- ${enlace("Índice por mercado")}
- ${enlace("Índice de colores")}
- ${enlace("Índice de ediciones especiales")}
- ${enlace("Índice de piezas")}

## Cómo está organizada

\`\`\`
Modelos/       Una nota por generación: acabados, carrocerías, mecánicas, colores y piezas.
Familias/      Una nota por nombre comercial, con todas sus generaciones en orden.
Ediciones/     Series especiales y limitadas, con año, unidades y mercado.
Colores/       Un color por nota, con los modelos que lo han ofrecido.
Piezas/        Piezas de mercado, oficiales y no oficiales, con precio y homologación.
Vendedores/    Tiendas de las que sale cada precio verificado.
Paises/        Qué es legalizable y qué no en cada país.
Motores/       Familias de motor: la bisagra entre una pieza y los modelos que la admiten.
Plataformas/   PQ35, MQB, MEB y compañía, con los modelos que las usan.
Mercados/      Qué se vendió en cada región.
Carrocerias/   Agrupación por tipo de carrocería.
Indices/       Listados transversales.
\`\`\`

## Qué no cubre

- Camiones y autobuses de Volkswagen Truck & Bus (Constellation, Delivery), que son otra
  empresa dentro del grupo.
- Prototipos y concept cars que no llegaron a venderse.
- Códigos de pintura de fábrica. Los nombres comerciales cambian de un mercado a otro y
  los códigos varían por año, así que aquí solo aparecen los nombres.

## Precisión de los datos

Las gamas de color están recogidas por generación, no por año de modelo. Un color que
aparece en una ficha estuvo disponible en algún momento de la vida comercial de ese
modelo, en al menos uno de sus mercados, pero no necesariamente durante toda la
generación ni en todos los acabados. Las series especiales con cifra de producción
confirmada la llevan indicada; el resto aparecen marcadas como \`detallada: no\` en su
frontmatter, pendientes de completar.

Con las piezas el criterio es el mismo, y conviene tenerlo claro antes de gastarse dinero:

- **Los precios con enlace** se han abierto tienda a tienda y llevan la fecha de consulta
  en el frontmatter. Caducan: revísalos antes de comprar.
- **Los precios sin enlace** son rangos orientativos del catálogo del planner, no ofertas
  reales de ninguna tienda.
- **La homologación** solo aparece donde había fuente: lo que declara la ficha del
  producto para Alemania, y el régimen de reformas para España. Una pieza sin datos de
  homologación no es que sea legal, es que no está verificada.

Bóveda independiente de \`vault/\`, que es la fuente de datos del planner de preparación.
No la lee \`npm run vault:ingest\` ni entra en los tests del proyecto.
`, "utf8");

console.log(`Modelos: ${MODELOS.length}`);
console.log(`Familias: ${familias.size}`);
console.log(`Ediciones: ${totalEdiciones}`);
console.log(`Colores: ${totalColores}`);
console.log(`Plataformas: ${plataformas.size} | Mercados: ${mercados.size} | Carrocerias: ${carrocerias.size}`);
if (desconocidos.size) {
  console.log(`\nColores sin clasificar (${desconocidos.size}):`);
  console.log([...desconocidos].sort().join("\n"));
}
