// Sondeo de la red relacional: prueba una pieza contra un coche y dice si monta,
// si da fallo y si pasa la ITV.
//
//   npm run probar -- --modelo "Golf GTI Mk8" --pieza susp-coil-mqbevo-alta
//   npm run probar -- --modelo "Golf GTI Mk8"          barrido: todas las piezas
//   npm run probar -- --pieza susp-coil-mqbevo-alta    barrido: todos los coches
//   npm run probar -- --matriz                          la matriz entera, resumida
//   npm run probar -- --listar-piezas

import { cargarCatalogo } from "../engine/catalog";
import { buscarModelo, listarModelos } from "../engine/graph";
import { evaluar, evaluarCatalogo, evaluarModelos, resumir } from "../engine/compat";
import type { Compatibilidad } from "../engine/compat";
import type { Pieza } from "../engine/types";

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

const eur = (n: number): string => `${n.toLocaleString("es-ES")} €`;

const MARCA = { compatible: "OK  ", "con-avisos": "AVISO", incompatible: "NO  " } as const;

function salirConAyuda(mensaje: string): never {
  console.error(`\n${mensaje}\n`);
  console.error("Uso:");
  console.error("  npm run probar -- --modelo <texto> --pieza <id>   un par concreto");
  console.error("  npm run probar -- --modelo <texto>                todas las piezas del coche");
  console.error("  npm run probar -- --pieza <id>                    todos los coches de la pieza");
  console.error("  npm run probar -- --matriz                        resumen de la matriz entera");
  console.error("  npm run probar -- --listar-piezas\n");
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const catalogo = cargarCatalogo();
const modelos = listarModelos();

if (args["listar-piezas"]) {
  console.log("");
  for (const p of catalogo.piezas) {
    console.log(`  ${p.id.padEnd(30)} ${p.categoria.padEnd(12)} ${p.nombre}`);
  }
  console.log("");
  process.exit(0);
}

function buscarPieza(texto: string): Pieza | null {
  const q = texto.toLowerCase().trim();
  return (
    catalogo.piezas.find((p) => p.id === q) ??
    catalogo.piezas.find((p) => p.nombre.toLowerCase() === q) ??
    catalogo.piezas.find((p) => p.nombre.toLowerCase().includes(q)) ??
    null
  );
}

/** Ficha detallada de un par. Es la respuesta a "¿puedo montar esto en este coche?". */
function detalle(r: Compatibilidad): void {
  console.log(`\n${r.pieza.nombre}`);
  console.log(`  en ${r.modelo.nombre} · ${r.modelo.motorDetalle} · chasis ${r.modelo.chasis}\n`);

  const titulo =
    r.veredicto === "compatible"
      ? "MONTA"
      : r.veredicto === "con-avisos"
        ? "MONTA, CON REPAROS"
        : "NO MONTA";
  console.log(`  ${titulo}   ·   ${r.homologable ? "pasa la ITV" : "no pasa la ITV tal cual"}`);
  console.log(`  Coste con lo que arrastra: ${eur(r.coste)}\n`);

  for (const h of r.hallazgos) {
    const marca = h.gravedad === "bloqueo" ? "  ✗" : h.gravedad === "aviso" ? "  !" : "  ·";
    console.log(`${marca} [${h.motivo}] ${h.mensaje}`);
  }

  if (r.dependencias.length > 0) {
    console.log("\n  Arrastra:");
    for (const d of r.dependencias) {
      console.log(`    ${d.precio.estimado.toString().padStart(5)} €  ${d.nombre}`);
    }
  }
  console.log("");
}

/** Barrido: una lista de veredictos agrupada por resultado. */
function barrido(resultados: Compatibilidad[], etiqueta: (r: Compatibilidad) => string): void {
  const r = resumir(resultados);
  console.log(
    `\n  ${r.compatibles} montan limpio · ${r.conAvisos} con reparos · ${r.incompatibles} no montan` +
      `  ·  ${r.homologables} pasan la ITV\n`,
  );

  for (const grupo of ["compatible", "con-avisos", "incompatible"] as const) {
    const items = resultados.filter((x) => x.veredicto === grupo);
    if (items.length === 0) continue;
    console.log(`${MARCA[grupo]}  (${items.length})`);
    for (const item of items) {
      const primero = item.hallazgos.find((h) => h.gravedad === "bloqueo") ??
        item.hallazgos.find((h) => h.gravedad === "aviso");
      const motivo = grupo === "compatible" ? "" : `  — ${primero?.mensaje ?? ""}`;
      console.log(`   ${etiqueta(item)}${motivo}`);
    }
    console.log("");
  }
}

// --- Matriz entera ----------------------------------------------------------
if (args.matriz) {
  console.log(`\nMatriz de compatibilidad: ${modelos.length} coches x ${catalogo.piezas.length} piezas\n`);
  console.log(`  ${"COCHE".padEnd(28)} ${"MONTA".padStart(6)} ${"REPAROS".padStart(8)} ${"NO".padStart(5)} ${"ITV".padStart(5)}`);
  console.log(`  ${"-".repeat(56)}`);
  let tot = { compatibles: 0, conAvisos: 0, incompatibles: 0, homologables: 0 };
  for (const m of modelos) {
    const r = resumir(evaluarCatalogo(m, { catalogo }));
    tot = {
      compatibles: tot.compatibles + r.compatibles,
      conAvisos: tot.conAvisos + r.conAvisos,
      incompatibles: tot.incompatibles + r.incompatibles,
      homologables: tot.homologables + r.homologables,
    };
    console.log(
      `  ${m.nombre.padEnd(28)} ${String(r.compatibles).padStart(6)} ${String(r.conAvisos).padStart(8)} ` +
        `${String(r.incompatibles).padStart(5)} ${String(r.homologables).padStart(5)}`,
    );
  }
  console.log(`  ${"-".repeat(56)}`);
  console.log(
    `  ${"TOTAL".padEnd(28)} ${String(tot.compatibles).padStart(6)} ${String(tot.conAvisos).padStart(8)} ` +
      `${String(tot.incompatibles).padStart(5)} ${String(tot.homologables).padStart(5)}\n`,
  );
  process.exit(0);
}

// --- Un par concreto --------------------------------------------------------
if (args.modelo && args.pieza) {
  const modelo = buscarModelo(args.modelo);
  if (!modelo) salirConAyuda(`No reconozco el coche "${args.modelo}".`);
  const pieza = buscarPieza(args.pieza);
  if (!pieza) salirConAyuda(`No encuentro la pieza "${args.pieza}". Prueba con --listar-piezas.`);
  detalle(evaluar(pieza, modelo, { catalogo }));
  process.exit(0);
}

// --- Barrido por coche ------------------------------------------------------
if (args.modelo) {
  const modelo = buscarModelo(args.modelo);
  if (!modelo) salirConAyuda(`No reconozco el coche "${args.modelo}".`);
  console.log(`\n${modelo.nombre} · ${modelo.motorDetalle} · chasis ${modelo.chasis}`);
  console.log(`De serie: ${modelo.equipamiento.join(", ") || "nada que condicione el montaje"}`);
  barrido(evaluarCatalogo(modelo, { catalogo }), (r) => r.pieza.nombre);
  process.exit(0);
}

// --- Barrido por pieza ------------------------------------------------------
if (args.pieza) {
  const pieza = buscarPieza(args.pieza);
  if (!pieza) salirConAyuda(`No encuentro la pieza "${args.pieza}". Prueba con --listar-piezas.`);
  console.log(`\n${pieza.nombre}`);
  console.log(
    `${pieza.categoria} · gama ${pieza.gama} · ${eur(pieza.precio.estimado)} · ${pieza.legalidad}`,
  );
  barrido(evaluarModelos(pieza, modelos, { catalogo }), (r) => r.modelo.nombre);
  process.exit(0);
}

salirConAyuda("Falta --modelo, --pieza o --matriz.");
