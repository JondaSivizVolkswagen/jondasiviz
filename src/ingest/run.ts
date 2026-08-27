// CLI de ingesta.
//   npm run vault:export            JSON de src/data  -> vault/   (arranca el vault)
//   npm run vault:ingest            vault/            -> JSON de src/data
//   ... -- ./ruta/al/vault          usa otro vault (o variable de entorno VAULT_DIR)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { escribirVault, parsearVault } from "./obsidian";
import type { Catalogo, CatalogoModelos } from "../engine/types";

const RAIZ = resolve(import.meta.dirname, "../..");
const DATA = resolve(RAIZ, "src/data");

const accion = process.argv[2];
const vaultDir = resolve(process.argv[3] ?? process.env.VAULT_DIR ?? resolve(RAIZ, "vault"));

function escribirJson(ruta: string, valor: unknown): void {
  writeFileSync(ruta, `${JSON.stringify(valor, null, 2)}\n`);
}

function leerJson<T>(ruta: string): T {
  return JSON.parse(readFileSync(ruta, "utf8")) as T;
}

if (accion === "export") {
  const catalogo = leerJson<Catalogo>(resolve(DATA, "catalog.json"));
  const modelos = leerJson<CatalogoModelos>(resolve(DATA, "models.json"));
  const marcas = Object.keys(
    (leerJson<{ marcas: Record<string, string> }>(resolve(DATA, "brands.json")).marcas),
  ).map((m) => m.replace(/\b\w/g, (c) => c.toUpperCase()));

  escribirVault(vaultDir, catalogo, modelos, [...new Set(marcas)]);
  console.log(`Vault escrito en ${vaultDir}`);
  console.log(`  ${modelos.modelos.length} modelos · ${catalogo.piezas.length} piezas`);
} else if (accion === "ingest") {
  const { catalogo, modelos, meta } = parsearVault(vaultDir);
  escribirJson(resolve(DATA, "catalog.json"), catalogo);
  escribirJson(resolve(DATA, "models.json"), modelos);
  console.log(`Ingesta desde ${vaultDir}`);
  console.log(
    `  catalog.json v${meta.catalogoVersion}: ${catalogo.piezas.length} piezas` +
      `\n  models.json v${meta.modelosVersion}: ${modelos.modelos.length} modelos`,
  );
} else {
  console.error("Uso: tsx src/ingest/run.ts <export|ingest> [rutaVault]");
  process.exit(1);
}
