// CLI para probar el motor sin interfaz.
//   npm run plan -- --modelo "Golf GTI Mk5" --presupuesto 4000 --objetivo drag
//   npm run plan -- --modelo mk5 --presupuesto 12000 --objetivo drift,estetica
//   npm run plan -- --listar-modelos

import { cargarCatalogo } from "../engine/catalog";
import { listarModelos, piezasDeModelo } from "../engine/graph";
import {
  NOMBRE_CATEGORIA,
  NOMBRE_OBJETIVO,
  conflictosEn,
  fraseRiesgo,
  normalizarObjetivos,
} from "../engine/recommend";
import { euros as eur } from "../engine/format";
import { crearClasificadorReglas, crearSelector } from "../agents/index";
import type { Objetivo } from "../engine/types";

const OBJETIVOS: Objetivo[] = ["drift", "drag", "mas-cv", "estetica"];

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const clave = arg.slice(2);
      const valor = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[clave] = valor;
    }
  }
  return out;
}

function salirConAyuda(mensaje: string): never {
  console.error(mensaje);
  console.error(
    "\nUso:\n  npm run plan -- --modelo <texto> --presupuesto <n> --objetivo <o>\n  npm run plan -- --listar-modelos\n",
  );
  console.error(`  objetivo: ${OBJETIVOS.join(" | ")}  (uno o varios separados por coma)`);
  console.error(`  modelos:  ${listarModelos().map((m) => m.nombre).join(", ")}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

if (args["listar-modelos"]) {
  console.log("\nModelos disponibles:\n");
  for (const m of listarModelos()) {
    console.log(`  ${m.nombre.padEnd(18)} ${m.motor.padEnd(9)} ${m.chasis.padEnd(6)} ${m.motorDetalle}`);
  }
  console.log("");
  process.exit(0);
}

const objetivos = (args.objetivo ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean) as Objetivo[];
const presupuesto = Number(args.presupuesto);

if (!args.modelo) salirConAyuda("Falta --modelo");
if (objetivos.length === 0 || objetivos.some((o) => !OBJETIVOS.includes(o))) {
  salirConAyuda(`Objetivo inválido: "${args.objetivo ?? ""}" (uno o varios separados por coma)`);
}
if (!Number.isFinite(presupuesto) || presupuesto <= 0) {
  salirConAyuda(`Presupuesto inválido: "${args.presupuesto ?? ""}"`);
}
for (const [a, b] of conflictosEn(objetivos)) {
  salirConAyuda(
    `${NOMBRE_OBJETIVO[a]} y ${NOMBRE_OBJETIVO[b]} no se combinan: piden preparaciones ` +
      "contrarias. Elige uno de los dos.",
  );
}

const catalogo = cargarCatalogo();
const selector = crearSelector(catalogo);
const res = selector.seleccionar({ modelo: args.modelo, presupuesto, objetivos });

if (!res.modelo) {
  for (const aviso of res.avisos) console.error(aviso);
  process.exit(1);
}

const modelo = res.modelo;
const clasificador = crearClasificadorReglas();
const grupos = clasificador.agrupar(piezasDeModelo(modelo, catalogo));
const plan = res.presupuesto!;

const etiquetaObjetivos = normalizarObjetivos(objetivos)
  .map((o) => NOMBRE_OBJETIVO[o])
  .join(" + ");

console.log(`\n${modelo.nombre}  ·  ${modelo.motorDetalle}  ·  chasis ${modelo.chasis}`);
console.log(`${eur(presupuesto)}  ·  ${etiquetaObjetivos}`);
console.log(
  `Piezas compatibles: ${grupos.baja.length} baja / ${grupos.media.length} media / ${grupos.alta.length} alta\n`,
);

console.log(
  `Mínimo del proyecto (${etiquetaObjetivos}): ${eur(res.minimo)}` +
    (res.cumpleMinimo ? "  [cumple]" : "  [por debajo]"),
);
console.log(`Gama del build: ${plan.gamaResultante ?? "vacío"}`);
const riesgo = fraseRiesgo(plan);
if (riesgo) console.log(`[PELIGRO] ${riesgo}`);
for (const aviso of res.avisos) console.log(`[aviso] ${aviso}`);
console.log("");

for (const grupo of plan.porCategoria) {
  console.log(`${NOMBRE_CATEGORIA[grupo.categoria].toUpperCase()}  (${eur(grupo.total)})`);
  for (const linea of grupo.lineas) {
    const etiqueta = linea.motivo === "dependencia" ? " [dependencia]" : "";
    console.log(
      `  ${linea.precio.toString().padStart(5)} €  [${linea.pieza.gama.padEnd(5)}] ${linea.pieza.nombre}${etiqueta}`,
    );
  }
}

console.log("\n" + "-".repeat(48));
console.log(`  TOTAL       ${eur(plan.total)}`);
console.log(`  Presupuesto ${eur(presupuesto)}`);
console.log(`  Sobrante    ${eur(plan.restante)}`);

if (plan.siguientesMejoras.length > 0) {
  console.log("\nSiguientes mejoras si subes el presupuesto:");
  for (const m of plan.siguientesMejoras) {
    const falta = m.falta > 0 ? `faltan ${eur(m.falta)}` : "ya te lo puedes permitir";
    const cambio = m.sustituye ? ` [en lugar de ${m.sustituye.nombre}]` : "";
    console.log(`  ${m.pieza.nombre} — ${eur(m.precio)} (${falta})${cambio}`);
  }
}

if (res.siguienteEscalon) {
  console.log(
    `\nCon ${eur(res.siguienteEscalon.presupuesto)} esto pasaría a ser un build de gama ${res.siguienteEscalon.gama}.`,
  );
}
console.log("");
