// CLI para probar el motor sin interfaz.
//   npm run plan -- --plataforma EA113 --gama media --presupuesto 4000 --objetivo drag --modelo "Golf GTI Mk5"

import {
  cargarCatalogo,
  generarPresupuesto,
  NOMBRE_CATEGORIA,
  NOMBRE_OBJETIVO,
  piezasCompatibles,
} from "../engine/index";
import type { Gama, Objetivo, PeticionPresupuesto, Plataforma } from "../engine/types";

const PLATAFORMAS: Plataforma[] = ["1.8T-20v", "EA113", "EA888", "VR6", "TDI"];
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
    "\nUso:\n  npm run plan -- --plataforma <p> --gama <g> --presupuesto <n> --objetivo <o> [--modelo <texto>]\n",
  );
  console.error(`  plataforma: ${PLATAFORMAS.join(" | ")}`);
  console.error(`  gama:       ${GAMAS.join(" | ")}`);
  console.error(`  objetivo:   ${OBJETIVOS.join(" | ")}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

const plataforma = args.plataforma as Plataforma;
const gama = args.gama as Gama;
const objetivo = args.objetivo as Objetivo;
const presupuesto = Number(args.presupuesto);

if (!PLATAFORMAS.includes(plataforma)) salirConAyuda(`Plataforma inválida: "${args.plataforma ?? ""}"`);
if (!GAMAS.includes(gama)) salirConAyuda(`Gama inválida: "${args.gama ?? ""}"`);
if (!OBJETIVOS.includes(objetivo)) salirConAyuda(`Objetivo inválido: "${args.objetivo ?? ""}"`);
if (!Number.isFinite(presupuesto) || presupuesto <= 0) {
  salirConAyuda(`Presupuesto inválido: "${args.presupuesto ?? ""}"`);
}

const peticion: PeticionPresupuesto = {
  plataforma,
  gama,
  presupuesto,
  objetivo,
  modelo: args.modelo,
};

const catalogo = cargarCatalogo();
const compatibles = piezasCompatibles(catalogo, peticion).length;
const res = generarPresupuesto(peticion, catalogo);

const cabecera = [peticion.modelo, peticion.plataforma, `gama ${gama}`, eur(presupuesto), NOMBRE_OBJETIVO[objetivo]]
  .filter(Boolean)
  .join("  ·  ");

console.log(`\n${cabecera}`);
console.log(`Catálogo v${catalogo.version}  ·  ${compatibles} piezas compatibles\n`);

for (const aviso of res.avisos) console.log(`[aviso] ${aviso}`);
if (res.avisos.length > 0) console.log("");

for (const grupo of res.porCategoria) {
  console.log(`${NOMBRE_CATEGORIA[grupo.categoria].toUpperCase()}  (${eur(grupo.total)})`);
  for (const linea of grupo.lineas) {
    const etiqueta = linea.motivo === "dependencia" ? " [dependencia]" : "";
    console.log(`  ${linea.precio.toString().padStart(5)} €  ${linea.pieza.nombre}${etiqueta}`);
  }
}

console.log("\n" + "-".repeat(48));
console.log(`  TOTAL       ${eur(res.total)}`);
console.log(`  Presupuesto ${eur(presupuesto)}`);
console.log(`  Sobrante    ${eur(res.restante)}`);

if (res.siguientesMejoras.length > 0) {
  console.log("\nSiguientes mejoras si subes el presupuesto:");
  for (const m of res.siguientesMejoras) {
    const falta = m.falta > 0 ? `faltan ${eur(m.falta)}` : "ya te lo puedes permitir";
    console.log(`  ${m.pieza.nombre} — ${eur(m.precio)} (${falta})`);
  }
}
console.log("");
