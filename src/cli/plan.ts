// CLI para probar el motor sin interfaz.
//   npm run plan -- --modelo "Golf GTI Mk5" --gama media --presupuesto 4000 --objetivo drag
//   npm run plan -- --modelo mk5 --gama alta --presupuesto 12000 --objetivo drift,estetica
//   npm run plan -- --listar-modelos

import { cargarCatalogo } from "../engine/catalog";
import { listarModelos, piezasDeModelo } from "../engine/graph";
import { NOMBRE_CATEGORIA, NOMBRE_OBJETIVO } from "../engine/recommend";
import { crearClasificadorReglas, crearSelector } from "../agents/index";
import type { Gama, Objetivo } from "../engine/types";

const GAMAS: Gama[] = ["baja", "media", "alta"];
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

function eur(n: number): string {
  return `${n.toLocaleString("es-ES")} €`;
}

function salirConAyuda(mensaje: string): never {
  console.error(mensaje);
  console.error(
    "\nUso:\n  npm run plan -- --modelo <texto> --gama <g> --presupuesto <n> --objetivo <o>\n  npm run plan -- --listar-modelos\n",
  );
  console.error(`  gama:     ${GAMAS.join(" | ")}`);
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

const gama = args.gama as Gama;
const objetivos = (args.objetivo ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean) as Objetivo[];
const presupuesto = Number(args.presupuesto);

if (!args.modelo) salirConAyuda("Falta --modelo");
if (!GAMAS.includes(gama)) salirConAyuda(`Gama inválida: "${args.gama ?? ""}"`);
if (objetivos.length === 0 || objetivos.some((o) => !OBJETIVOS.includes(o))) {
  salirConAyuda(`Objetivo inválido: "${args.objetivo ?? ""}" (uno o varios separados por coma)`);
}
if (!Number.isFinite(presupuesto) || presupuesto <= 0) {
  salirConAyuda(`Presupuesto inválido: "${args.presupuesto ?? ""}"`);
}

const catalogo = cargarCatalogo();
const selector = crearSelector(catalogo);
const res = selector.seleccionar({ modelo: args.modelo, gama, presupuesto, objetivos });

if (!res.modelo) {
  for (const aviso of res.avisos) console.error(aviso);
  process.exit(1);
}

const modelo = res.modelo;
const clasificador = crearClasificadorReglas();
const grupos = clasificador.agrupar(piezasDeModelo(modelo, catalogo));

const etiquetaObjetivos = objetivos.map((o) => NOMBRE_OBJETIVO[o]).join(" + ");

console.log(`\n${modelo.nombre}  ·  ${modelo.motorDetalle}  ·  chasis ${modelo.chasis}`);
console.log(`gama ${gama}  ·  ${eur(presupuesto)}  ·  ${etiquetaObjetivos}`);
console.log(
  `Piezas compatibles: ${grupos.baja.length} baja / ${grupos.media.length} media / ${grupos.alta.length} alta\n`,
);

console.log(
  `Gasto mínimo recomendado (${etiquetaObjetivos} / gama ${gama}): ${eur(res.suelo)}` +
    (res.cumpleSuelo ? "  [cumple]" : "  [por debajo]"),
);
for (const aviso of res.avisos) console.log(`[aviso] ${aviso}`);
console.log("");

const plan = res.presupuesto!;
for (const grupo of plan.porCategoria) {
  console.log(`${NOMBRE_CATEGORIA[grupo.categoria].toUpperCase()}  (${eur(grupo.total)})`);
  for (const linea of grupo.lineas) {
    const etiqueta = linea.motivo === "dependencia" ? " [dependencia]" : "";
    console.log(`  ${linea.precio.toString().padStart(5)} €  ${linea.pieza.nombre}${etiqueta}`);
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
    console.log(`  ${m.pieza.nombre} — ${eur(m.precio)} (${falta})`);
  }
}
console.log("");
