// Visor del grafo completo en una página. Lee salida/grafo.json, que escribe
// build-neo4j.mjs, y deja salida/grafo.html con los datos incrustados: se abre sin
// servidor y sin Neo4j.
//
//   node .generador/build-neo4j.mjs && node .generador/build-grafo.mjs
//
// Existe porque el visor de Neo4j tiene tope de nodos y se atraganta con 5.900 aristas.
// Aquí se dibuja sobre canvas, que aguanta el grafo entero.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = process.argv[2] ?? join(AQUI, "salida");
const grafo = JSON.parse(readFileSync(join(SALIDA, "grafo.json"), "utf8"));

// Colores por etiqueta. Se han elegido a media saturación para que el mismo valor
// funcione sobre el fondo claro y sobre el oscuro sin tener que duplicar la paleta.
// El rojo GTI del proyecto se reserva para Modelo, que es el eje del grafo.
const COLORES = {
  Modelo: "#c0322e",
  Pieza: "#3f7fbf",
  Color: "#b08a2e",
  Edicion: "#8a5cb0",
  Acabado: "#7c828c",
  Familia: "#2f8f6f",
  Plataforma: "#c2712c",
  Motor: "#8a6440",
  Mercado: "#4a9ec4",
  Carroceria: "#96905a",
  Mecanica: "#b25f8c",
  FamiliaCromatica: "#8090a8",
  Vendedor: "#2d9a8f",
  Pais: "#c94f7c",
};

// Cómo se lee cada relación en la ficha de un nodo, en las dos direcciones.
const FRASES = {
  DE_FAMILIA: ["pertenece a la familia", "generaciones"],
  USA: ["se construye sobre", "modelos que la usan"],
  VENDIDO_EN: ["se vendió en", "modelos vendidos aquí"],
  TIENE_CARROCERIA: ["se ofreció como", "modelos con esta carrocería"],
  OFRECE: ["ofrece el acabado", "modelos con este acabado"],
  MONTA: ["monta mecánica", "modelos con esta mecánica"],
  MONTA_MOTOR: ["monta motor", "modelos con este motor"],
  DISPONIBLE_EN: ["disponible en color", "quién lo ofrece"],
  SUCEDE_A: ["sucede a", "sucedido por"],
  BASADA_EN: ["parte del modelo", "series especiales"],
  VENDIDA_EN: ["se vendió en", "ediciones vendidas aquí"],
  DE_FAMILIA_CROMATICA: ["es un color", "colores de esta familia"],
  COMPATIBLE_CON: ["entra en", "piezas compatibles"],
  PARA_MOTOR: ["vale para", "piezas para este motor"],
  SE_VENDE_EN: ["se vende en", "piezas a la venta"],
  HOMOLOGADA_EN: ["homologada en", "piezas homologadas"],
  NO_HOMOLOGADA_EN: ["no homologada en", "piezas no homologadas"],
};

// El escape de "<" es lo \u00fanico imprescindible: sin \u00e9l, un "</script>" dentro de
// cualquier texto de los datos cerrar\u00eda la etiqueta antes de tiempo.
const datos = JSON.stringify({ ...grafo, colores: COLORES, frases: FRASES })
  .replace(/</g, "\\u003c");

const html = `<title>Grafo Volkswagen</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"><\/script>
<style>
  :root {
    --bg: #fbfbfa;
    --surface: #ffffff;
    --surface-2: #f4f4f3;
    --text: #1d1d1f;
    --text-muted: #6b6b70;
    --border: #e7e7e4;
    --accent: #c0322e;
    --accent-suave: rgba(192, 50, 46, 0.08);
    --enlace: rgba(29, 29, 31, 0.13);
    --enlace-fuerte: rgba(29, 29, 31, 0.42);
    --apagado: rgba(29, 29, 31, 0.05);
    --sombra: 0 1px 2px rgba(0, 0, 0, 0.04), 0 10px 28px rgba(0, 0, 0, 0.07);
    --r-sm: 8px;
    --r-md: 12px;
    --ui: "Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont,
      "SF Pro Text", Roboto, sans-serif;
    --mono: "Cascadia Mono", "SF Mono", ui-monospace, Consolas, monospace;
    color-scheme: light dark;
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #101012;
      --surface: #171719;
      --surface-2: #1e1e22;
      --text: #f5f5f7;
      --text-muted: #9b9ba2;
      --border: #2b2b30;
      --accent: #e0605a;
      --accent-suave: rgba(224, 96, 90, 0.12);
      --enlace: rgba(245, 245, 247, 0.11);
      --enlace-fuerte: rgba(245, 245, 247, 0.45);
      --apagado: rgba(245, 245, 247, 0.05);
      --sombra: 0 1px 2px rgba(0, 0, 0, 0.3), 0 12px 32px rgba(0, 0, 0, 0.45);
    }
  }

  :root[data-theme="dark"] {
    --bg: #101012;
    --surface: #171719;
    --surface-2: #1e1e22;
    --text: #f5f5f7;
    --text-muted: #9b9ba2;
    --border: #2b2b30;
    --accent: #e0605a;
    --accent-suave: rgba(224, 96, 90, 0.12);
    --enlace: rgba(245, 245, 247, 0.11);
    --enlace-fuerte: rgba(245, 245, 247, 0.45);
    --apagado: rgba(245, 245, 247, 0.05);
    --sombra: 0 1px 2px rgba(0, 0, 0, 0.3), 0 12px 32px rgba(0, 0, 0, 0.45);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--ui);
    font-size: 14px;
    line-height: 1.5;
    height: 100vh;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }

  #campo { position: fixed; inset: 0; }
  canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  canvas.arrastrando { cursor: grabbing; }
  canvas.sobre-nodo { cursor: pointer; }

  .panel {
    position: fixed;
    top: 16px;
    bottom: 16px;
    width: 310px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    box-shadow: var(--sombra);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  #rail { left: 16px; }

  #ficha {
    right: 16px;
    width: 340px;
    transform: translateX(calc(100% + 24px));
    transition: transform 0.22s ease;
  }
  #ficha.visible { transform: none; }

  @media (prefers-reduced-motion: reduce) {
    #ficha { transition: none; }
  }

  .panel header {
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .panel h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .cuenta {
    font-family: var(--mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .cuerpo { overflow-y: auto; padding: 12px 16px 16px; flex: 1; }

  .rotulo {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 14px 0 7px;
  }
  .rotulo:first-child { margin-top: 0; }

  input[type="search"] {
    width: 100%;
    padding: 7px 10px;
    font: inherit;
    font-size: 13px;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  input[type="search"]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .filtro {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 4px 6px;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: inherit;
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }
  .filtro:hover { background: var(--surface-2); }
  .filtro:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .filtro[aria-pressed="false"] { color: var(--text-muted); }
  .filtro[aria-pressed="false"] .punto { background: transparent !important; }

  .punto {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
    border: 1.5px solid currentColor;
  }
  .filtro .nombre { flex: 1; }
  .filtro .n {
    font-family: var(--mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }

  .acciones { display: flex; gap: 6px; margin-top: 8px; }
  .boton {
    flex: 1;
    padding: 6px 8px;
    font: inherit;
    font-size: 12px;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    cursor: pointer;
  }
  .boton:hover { border-color: var(--accent); color: var(--accent); }
  .boton:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  #ficha .etiqueta-nodo {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  #ficha h2 {
    margin: 6px 0 0;
    font-size: 17px;
    font-weight: 650;
    line-height: 1.25;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }
  #ficha .nota {
    margin: 10px 0 0;
    color: var(--text-muted);
    font-size: 13px;
  }

  .props { margin: 12px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
  .props dt {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .props dd {
    margin: 0;
    font-size: 12.5px;
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .vecino {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 6px;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: inherit;
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }
  .vecino:hover { background: var(--accent-suave); color: var(--accent); }
  .vecino:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

  a { color: var(--accent); }

  #vacio {
    color: var(--text-muted);
    font-size: 13px;
    padding: 4px 0;
  }

  #aviso {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    padding: 7px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    box-shadow: var(--sombra);
    font-size: 12.5px;
    color: var(--text-muted);
    pointer-events: none;
  }

  @media (max-width: 900px) {
    #rail { left: 8px; right: 8px; width: auto; bottom: auto; max-height: 46vh; }
    #ficha { left: 8px; right: 8px; width: auto; top: auto; height: 46vh; }
    #ficha { transform: translateY(calc(100% + 24px)); }
    #ficha.visible { transform: none; }
  }
</style>

<div id="campo"><canvas id="lienzo"></canvas></div>

<aside class="panel" id="rail">
  <header>
    <h1>Grafo Volkswagen</h1>
    <span class="cuenta" id="totales"></span>
  </header>
  <div class="cuerpo">
    <div class="rotulo">Buscar</div>
    <input type="search" id="buscar" placeholder="Golf Mk7, Milltek, Lapiz Blue…" autocomplete="off">
    <div class="rotulo">Qué se dibuja</div>
    <div id="filtros"></div>
    <div class="acciones">
      <button class="boton" id="todos" type="button">Todo</button>
      <button class="boton" id="solo-coches" type="button">Solo coches</button>
      <button class="boton" id="recentrar" type="button">Recentrar</button>
    </div>
    <div class="rotulo">Cómo se lee</div>
    <p id="vacio">
      Cada punto es un nodo y su tamaño va con el número de conexiones. Arrastra para
      mover, rueda para acercar. Pincha un nodo y se apaga todo lo que no toca.
    </p>
  </div>
</aside>

<aside class="panel" id="ficha" aria-live="polite">
  <header>
    <span class="cuenta" id="ficha-grado"></span>
    <button class="boton" id="cerrar" type="button" style="flex:none;width:auto">Cerrar</button>
  </header>
  <div class="cuerpo" id="ficha-cuerpo"></div>
</aside>

<div id="aviso"></div>

<script>
const DATOS = ${datos};
const COLORES = DATOS.colores;
const FRASES = DATOS.frases;

const nodos = DATOS.nodos.map((n) => ({ ...n }));
const porId = new Map(nodos.map((n) => [n.id, n]));
const enlaces = DATOS.enlaces
  .filter((e) => porId.has(e.desde) && porId.has(e.hasta))
  .map((e) => ({ ...e, source: e.desde, target: e.hasta }));

// Grado y vecindario, calculados una vez: se usan en el tamaño del punto, en el
// resaltado y en la ficha.
const vecinos = new Map(nodos.map((n) => [n.id, []]));
for (const e of enlaces) {
  vecinos.get(e.desde).push({ otro: e.hasta, tipo: e.tipo, saliente: true, datos: e });
  vecinos.get(e.hasta).push({ otro: e.desde, tipo: e.tipo, saliente: false, datos: e });
}
for (const n of nodos) n.grado = vecinos.get(n.id).length;

const etiquetas = [...new Set(nodos.map((n) => n.etiqueta))]
  .sort((a, b) => nodos.filter((n) => n.etiqueta === b).length - nodos.filter((n) => n.etiqueta === a).length);
const visibles = new Set(etiquetas);
const COCHES = new Set(["Modelo", "Familia", "Plataforma", "Motor", "Mercado", "Carroceria"]);

const lienzo = document.getElementById("lienzo");
const ctx = lienzo.getContext("2d");
let ancho = 0, alto = 0, dpr = 1;

function medir() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  ancho = lienzo.clientWidth;
  alto = lienzo.clientHeight;
  lienzo.width = Math.round(ancho * dpr);
  lienzo.height = Math.round(alto * dpr);
}
medir();

const radio = (n) => 2.6 + Math.min(Math.sqrt(n.grado) * 1.15, 7.4);

const sim = d3.forceSimulation(nodos)
  .force("enlace", d3.forceLink(enlaces).id((d) => d.id).distance(38).strength(0.32))
  .force("carga", d3.forceManyBody().strength(-42).distanceMax(420).theta(0.9))
  .force("colision", d3.forceCollide().radius((d) => radio(d) + 1.6))
  .force("centro", d3.forceCenter(ancho / 2, alto / 2))
  .alphaDecay(0.021)
  .stop();

let transform = d3.zoomIdentity;
let seleccionado = null;
let sobre = null;
let resaltados = null;
let coincidencias = null;

const zoom = d3.zoom()
  .scaleExtent([0.12, 8])
  .on("zoom", (ev) => { transform = ev.transform; pintar(); });

d3.select(lienzo).call(zoom);

function visible(n) { return visibles.has(n.etiqueta); }

function pintar() {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  const estiloEnlace = getComputedStyle(document.documentElement);
  const cEnlace = estiloEnlace.getPropertyValue("--enlace").trim();
  const cFuerte = estiloEnlace.getPropertyValue("--enlace-fuerte").trim();
  const cApagado = estiloEnlace.getPropertyValue("--apagado").trim();

  ctx.lineWidth = 0.7 / Math.max(transform.k, 0.5);
  for (const e of enlaces) {
    if (!visible(e.source) || !visible(e.target)) continue;
    const tocado = resaltados && (resaltados.has(e.source.id) && resaltados.has(e.target.id));
    ctx.strokeStyle = resaltados ? (tocado ? cFuerte : cApagado) : cEnlace;
    ctx.beginPath();
    ctx.moveTo(e.source.x, e.source.y);
    ctx.lineTo(e.target.x, e.target.y);
    ctx.stroke();
  }

  for (const n of nodos) {
    if (!visible(n)) continue;
    const dentro = !resaltados || resaltados.has(n.id);
    const r = radio(n);
    ctx.globalAlpha = dentro ? 1 : 0.16;
    ctx.fillStyle = COLORES[n.etiqueta] || "#888";
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (coincidencias && coincidencias.has(n.id)) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = estiloEnlace.getPropertyValue("--accent").trim();
      ctx.lineWidth = 2 / Math.max(transform.k, 0.6);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 3.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Los nombres solo aparecen cuando hay sitio: al alejarse serían una mancha.
  if (transform.k > 1.7) {
    ctx.fillStyle = estiloEnlace.getPropertyValue("--text").trim();
    ctx.font = \`\${11 / transform.k}px \${getComputedStyle(document.body).fontFamily}\`;
    ctx.textAlign = "center";
    for (const n of nodos) {
      if (!visible(n)) continue;
      if (resaltados && !resaltados.has(n.id)) continue;
      if (n.grado < (transform.k > 3 ? 1 : 8)) continue;
      ctx.globalAlpha = Math.min((transform.k - 1.7) / 0.8, 1) * 0.85;
      ctx.fillText(n.nombre, n.x, n.y - radio(n) - 3);
    }
    ctx.globalAlpha = 1;
  }

  if (sobre) {
    ctx.strokeStyle = estiloEnlace.getPropertyValue("--text").trim();
    ctx.lineWidth = 1.6 / transform.k;
    ctx.beginPath();
    ctx.arc(sobre.x, sobre.y, radio(sobre) + 2.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

let arboles = null;
function arbol() {
  arboles = d3.quadtree().x((d) => d.x).y((d) => d.y).addAll(nodos.filter(visible));
  return arboles;
}

function nodoEn(px, py) {
  const [x, y] = transform.invert([px, py]);
  const r = 12 / transform.k;
  // Mientras la simulación se mueve, el árbol de búsqueda caduca en cada tick, así que
  // se rehace. Cuando se para, se reutiliza el que ya hay.
  return (vivo || !arboles ? arbol() : arboles).find(x, y, r);
}

let vivo = true, ticks = 0;
function bucle() {
  if (vivo) {
    sim.tick();
    ticks++;
    if (ticks > 420 || sim.alpha() < 0.008) { vivo = false; arbol(); }
    pintar();
  }
  requestAnimationFrame(bucle);
}
bucle();

// --- interacción ----------------------------------------------------------

lienzo.addEventListener("mousemove", (ev) => {
  const r = lienzo.getBoundingClientRect();
  const n = nodoEn(ev.clientX - r.left, ev.clientY - r.top);
  if (n !== sobre) {
    sobre = n;
    lienzo.classList.toggle("sobre-nodo", Boolean(n));
    aviso(n ? \`\${n.nombre} · \${n.etiqueta} · \${n.grado} conexiones\` : null);
    if (!vivo) pintar();
  }
});

lienzo.addEventListener("mousedown", () => lienzo.classList.add("arrastrando"));
window.addEventListener("mouseup", () => lienzo.classList.remove("arrastrando"));

lienzo.addEventListener("click", (ev) => {
  const r = lienzo.getBoundingClientRect();
  const n = nodoEn(ev.clientX - r.left, ev.clientY - r.top);
  seleccionar(n ? n.id : null);
});

function seleccionar(id) {
  seleccionado = id ? porId.get(id) : null;
  if (!seleccionado) {
    resaltados = null;
    document.getElementById("ficha").classList.remove("visible");
  } else {
    resaltados = new Set([seleccionado.id, ...vecinos.get(seleccionado.id).map((v) => v.otro)]);
    ficha(seleccionado);
    document.getElementById("ficha").classList.add("visible");
  }
  pintar();
}

const OCULTAS = new Set(["id", "etiqueta", "nombre", "nota", "grado", "index", "x", "y", "vx", "vy", "fx", "fy"]);

function ficha(n) {
  const cuerpo = document.getElementById("ficha-cuerpo");
  document.getElementById("ficha-grado").textContent = \`\${n.grado} conexiones\`;
  cuerpo.replaceChildren();

  const eti = document.createElement("span");
  eti.className = "etiqueta-nodo";
  const punto = document.createElement("span");
  punto.className = "punto";
  punto.style.background = COLORES[n.etiqueta];
  punto.style.color = COLORES[n.etiqueta];
  eti.append(punto, document.createTextNode(n.etiqueta));
  const h2 = document.createElement("h2");
  h2.textContent = n.nombre;
  cuerpo.append(eti, h2);

  if (n.nota) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = n.nota;
    cuerpo.append(p);
  }

  const props = Object.entries(n).filter(([k, v]) =>
    !OCULTAS.has(k) && v !== null && v !== "" && typeof v !== "object");
  if (props.length) {
    const dl = document.createElement("dl");
    dl.className = "props";
    for (const [k, v] of props) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = typeof v === "boolean" ? (v ? "sí" : "no") : String(v);
      dl.append(dt, dd);
    }
    cuerpo.append(dl);
  }

  // Las ofertas llevan URL: se sacan aparte para poder pinchar en la tienda.
  const ofertas = vecinos.get(n.id).filter((v) => v.datos.tipo === "SE_VENDE_EN" && v.datos.url);
  if (ofertas.length) {
    const t = document.createElement("div");
    t.className = "rotulo";
    t.textContent = "A la venta";
    cuerpo.append(t);
    for (const o of ofertas) {
      const p = document.createElement("p");
      p.style.margin = "0 0 8px";
      p.style.fontSize = "13px";
      const a = document.createElement("a");
      a.href = o.datos.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = o.datos.producto || porId.get(o.otro).nombre;
      const precio = document.createElement("span");
      precio.style.fontFamily = "var(--mono)";
      precio.style.color = "var(--text-muted)";
      precio.textContent = \` — \${o.datos.precio} \${o.datos.moneda}, \${o.datos.fecha}\`;
      p.append(a, precio);
      cuerpo.append(p);
    }
  }

  const porTipo = new Map();
  for (const v of vecinos.get(n.id)) {
    const frase = (FRASES[v.tipo] || [v.tipo, v.tipo])[v.saliente ? 0 : 1];
    if (!porTipo.has(frase)) porTipo.set(frase, []);
    porTipo.get(frase).push(v.otro);
  }
  for (const [frase, ids] of [...porTipo].sort((a, b) => b[1].length - a[1].length)) {
    const t = document.createElement("div");
    t.className = "rotulo";
    t.textContent = \`\${frase} (\${ids.length})\`;
    cuerpo.append(t);
    for (const id of ids.slice(0, 40)) {
      const otro = porId.get(id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "vecino";
      const punto = document.createElement("span");
      punto.className = "punto";
      punto.style.background = COLORES[otro.etiqueta];
      punto.style.color = COLORES[otro.etiqueta];
      b.append(punto, document.createTextNode(otro.nombre));
      b.addEventListener("click", () => seleccionar(id));
      cuerpo.append(b);
    }
    if (ids.length > 40) {
      const p = document.createElement("p");
      p.id = "vacio";
      p.textContent = \`y \${ids.length - 40} más\`;
      cuerpo.append(p);
    }
  }
}

// --- filtros y búsqueda ---------------------------------------------------

const contenedor = document.getElementById("filtros");
for (const et of etiquetas) {
  const n = nodos.filter((x) => x.etiqueta === et).length;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "filtro";
  b.setAttribute("aria-pressed", "true");
  const punto = document.createElement("span");
  punto.className = "punto";
  punto.style.background = COLORES[et];
  punto.style.color = COLORES[et];
  const nombre = document.createElement("span");
  nombre.className = "nombre";
  nombre.textContent = et;
  const cuenta = document.createElement("span");
  cuenta.className = "n";
  cuenta.textContent = n;
  b.append(punto, nombre, cuenta);
  b.addEventListener("click", () => {
    if (visibles.has(et)) visibles.delete(et); else visibles.add(et);
    b.setAttribute("aria-pressed", String(visibles.has(et)));
    arbol();
    pintar();
  });
  contenedor.append(b);
}

function aplicarFiltro(conjunto) {
  visibles.clear();
  for (const et of conjunto) visibles.add(et);
  for (const b of contenedor.children) {
    b.setAttribute("aria-pressed", String(visibles.has(b.querySelector(".nombre").textContent)));
  }
  arbol();
  pintar();
}

document.getElementById("todos").addEventListener("click", () => aplicarFiltro(etiquetas));
document.getElementById("solo-coches").addEventListener("click", () => aplicarFiltro([...COCHES]));
document.getElementById("recentrar").addEventListener("click", () => {
  d3.select(lienzo).transition().duration(400).call(zoom.transform, d3.zoomIdentity);
});
document.getElementById("cerrar").addEventListener("click", () => seleccionar(null));

document.getElementById("buscar").addEventListener("input", (ev) => {
  const q = ev.target.value.trim().toLowerCase();
  coincidencias = q.length < 2 ? null
    : new Set(nodos.filter((n) => n.nombre.toLowerCase().includes(q)).map((n) => n.id));
  if (coincidencias && coincidencias.size === 1) seleccionar([...coincidencias][0]);
  aviso(coincidencias ? \`\${coincidencias.size} coincidencias\` : null);
  pintar();
});

window.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") seleccionar(null);
});

let temporizador = null;
function aviso(texto) {
  const el = document.getElementById("aviso");
  clearTimeout(temporizador);
  if (!texto) { el.style.opacity = "0"; return; }
  el.textContent = texto;
  el.style.opacity = "1";
  temporizador = setTimeout(() => { el.style.opacity = "0"; }, 2600);
}

document.getElementById("totales").textContent =
  \`\${nodos.length} nodos · \${enlaces.length} enlaces\`;
document.getElementById("aviso").style.opacity = "0";

window.addEventListener("resize", () => {
  medir();
  sim.force("centro", d3.forceCenter(ancho / 2, alto / 2));
  sim.alpha(0.2);
  vivo = true;
  ticks = 380;
});
<\/script>
`;

writeFileSync(join(SALIDA, "grafo.html"), html, "utf8");
console.log(`Escrito ${join(SALIDA, "grafo.html")}`);
console.log(`${grafo.nodos.length} nodos · ${grafo.enlaces.length} enlaces · ${Math.round(html.length / 1024)} KB`);
