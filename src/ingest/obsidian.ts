// Puente entre el vault de Obsidian (la red relacional que se autoría a mano) y
// los JSON que consume el motor.
//
//   vault/Modelos/*.md      -> src/data/models.json
//   vault/Piezas/*.md       -> src/data/catalog.json
//   vault/Plataformas/*.md  -> solo contexto para el grafo de Obsidian
//   vault/Marcas/*.md       -> solo contexto para el grafo de Obsidian
//
// brands.json y floors.json siguen siendo configuración a mano, no salen del vault.

import { readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { validarCatalogo } from "../engine/catalog";
import type {
  Catalogo,
  CatalogoModelos,
  Gama,
  ModeloVW,
  Objetivo,
  Pieza,
  Stage,
} from "../engine/types";

export interface MetaVault {
  catalogoVersion: string;
  modelosVersion: string;
  moneda: string;
}

export interface VaultParseado {
  meta: MetaVault;
  catalogo: Catalogo;
  modelos: CatalogoModelos;
}

const META_POR_DEFECTO: MetaVault = {
  catalogoVersion: "0.1.0",
  modelosVersion: "0.1.0",
  moneda: "EUR",
};

const OBJETIVOS: Objetivo[] = ["drift", "drag", "mas-cv", "estetica"];

function listarMarkdown(dir: string): string[] {
  const salida: string[] = [];
  const recorrer = (d: string): void => {
    const entradas = readdirSync(d, { withFileTypes: true });
    for (const e of entradas) {
      const ruta = join(d, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) salida.push(ruta);
    }
  };
  recorrer(dir);
  return salida.sort();
}

function comoLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(String);
  if (valor == null || valor === "") return [];
  return [String(valor)];
}

function comoNumero(valor: unknown, campo: string, ref: string): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) throw new Error(`${ref}: "${campo}" no es un número (${String(valor)})`);
  return n;
}

function leerPieza(data: Record<string, unknown>, ref: string): Pieza {
  const precio = (data.precio ?? {}) as Record<string, unknown>;
  const objetivosRaw = (data.objetivos ?? {}) as Record<string, unknown>;
  const objetivos = {} as Record<Objetivo, number>;
  for (const o of OBJETIVOS) objetivos[o] = comoNumero(objetivosRaw[o] ?? 0, `objetivos.${o}`, ref);

  const vacio = (v: unknown): boolean => v == null || v === "";
  const stage = vacio(data.stage) ? undefined : (String(data.stage) as Stage);
  const nota = vacio(data.nota) ? undefined : String(data.nota);
  const grupoExclusivo = vacio(data.grupoExclusivo) ? undefined : String(data.grupoExclusivo);
  const imagen = vacio(data.imagen) ? undefined : String(data.imagen);

  return {
    id: String(data.id ?? ""),
    nombre: String(data.nombre ?? data.id ?? ""),
    categoria: String(data.categoria ?? "") as Pieza["categoria"],
    plataformas: comoLista(data.plataformas) as Pieza["plataformas"],
    gama: String(data.gama ?? "") as Gama,
    precio: {
      min: comoNumero(precio.min, "precio.min", ref),
      estimado: comoNumero(precio.estimado, "precio.estimado", ref),
      max: comoNumero(precio.max, "precio.max", ref),
    },
    objetivos,
    impacto: comoNumero(data.impacto, "impacto", ref),
    requiere: comoLista(data.requiere),
    grupoExclusivo,
    stage,
    nota,
    imagen,
  };
}

function leerModelo(data: Record<string, unknown>, ref: string): ModeloVW {
  const anios = comoLista(data.anios).map((a) => comoNumero(a, "anios", ref));
  if (anios.length !== 2) throw new Error(`${ref}: "anios" debe tener [inicio, fin]`);

  return {
    id: String(data.id ?? ""),
    nombre: String(data.nombre ?? ""),
    alias: comoLista(data.alias).map((a) => a.toLowerCase()),
    chasis: String(data.chasis ?? ""),
    motor: String(data.motor ?? "") as ModeloVW["motor"],
    motorDetalle: String(data.motorDetalle ?? ""),
    traccion: String(data.traccion ?? "delantera") as ModeloVW["traccion"],
    anios: [anios[0], anios[1]],
  };
}

/** Lee un vault de Obsidian y devuelve el catálogo, los modelos y la meta. */
export function parsearVault(dir: string): VaultParseado {
  let meta = { ...META_POR_DEFECTO };
  const piezas: Pieza[] = [];
  const modelos: ModeloVW[] = [];

  for (const ruta of listarMarkdown(dir)) {
    const { data } = matter(readFileSync(ruta, "utf8"));
    const tipo = String(data.tipo ?? "").toLowerCase();
    const ref = ruta.slice(dir.length + 1);

    if (tipo === "meta") {
      meta = {
        catalogoVersion: String(data.catalogoVersion ?? meta.catalogoVersion),
        modelosVersion: String(data.modelosVersion ?? meta.modelosVersion),
        moneda: String(data.moneda ?? meta.moneda),
      };
    } else if (tipo === "pieza") {
      piezas.push(leerPieza(data, ref));
    } else if (tipo === "modelo") {
      modelos.push(leerModelo(data, ref));
    }
    // "plataforma" y "marca" son solo nodos de contexto para el grafo.
  }

  piezas.sort((a, b) => a.id.localeCompare(b.id));
  modelos.sort((a, b) => a.id.localeCompare(b.id));

  const catalogo: Catalogo = { version: meta.catalogoVersion, moneda: meta.moneda, piezas };
  const problemas = validarCatalogo(catalogo);
  if (problemas.length > 0) {
    throw new Error(`El vault genera un catálogo inválido:\n- ${problemas.join("\n- ")}`);
  }

  return { meta, catalogo, modelos: { version: meta.modelosVersion, modelos } };
}

// --- Exportación: JSON -> vault (para arrancar el vault ya poblado) ---------

function nombreArchivo(nombre: string): string {
  return nombre
    .replace(/"/g, "in")
    .replace(/\//g, "-")
    .replace(/[\\:*?<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nota(cuerpo: string, data: Record<string, unknown>): string {
  return matter.stringify(`\n${cuerpo}\n`, data);
}

function enlaces(items: string[]): string {
  return items.map((i) => `[[${i}]]`).join(", ");
}

export function escribirVault(
  dir: string,
  catalogo: Catalogo,
  modelos: CatalogoModelos,
  marcas: string[] = [],
): void {
  for (const sub of ["Modelos", "Piezas", "Plataformas", "Marcas"]) {
    rmSync(join(dir, sub), { recursive: true, force: true });
    mkdirSync(join(dir, sub), { recursive: true });
  }

  writeFileSync(
    join(dir, "_meta.md"),
    nota("Configuración del vault. No borrar.", {
      tipo: "meta",
      catalogoVersion: catalogo.version,
      modelosVersion: modelos.version,
      moneda: catalogo.moneda,
    }),
  );

  const plataformas = new Set<string>();

  for (const m of modelos.modelos) {
    plataformas.add(m.motor);
    writeFileSync(
      join(dir, "Modelos", `${nombreArchivo(m.nombre)}.md`),
      nota(`Chasis [[${m.chasis}]] · Motor [[${m.motor}]]`, {
        tipo: "modelo",
        id: m.id,
        nombre: m.nombre,
        alias: m.alias,
        chasis: m.chasis,
        motor: m.motor,
        motorDetalle: m.motorDetalle,
        traccion: m.traccion,
        anios: m.anios,
      }),
    );
  }

  for (const p of catalogo.piezas) {
    for (const plat of p.plataformas) plataformas.add(plat);
    writeFileSync(
      join(dir, "Piezas", `${nombreArchivo(p.nombre)}.md`),
      nota(`Compatible con ${enlaces(p.plataformas)}.`, {
        tipo: "pieza",
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        gama: p.gama,
        precio: p.precio,
        objetivos: p.objetivos,
        impacto: p.impacto,
        requiere: p.requiere,
        plataformas: p.plataformas,
        grupoExclusivo: p.grupoExclusivo ?? null,
        stage: p.stage ?? null,
        nota: p.nota ?? null,
        imagen: p.imagen ?? null,
      }),
    );
  }

  for (const plat of [...plataformas].sort()) {
    writeFileSync(
      join(dir, "Plataformas", `${nombreArchivo(plat)}.md`),
      nota(`Plataforma de motor.`, { tipo: "plataforma", nombre: plat }),
    );
  }

  for (const marca of marcas.sort()) {
    writeFileSync(
      join(dir, "Marcas", `${nombreArchivo(marca)}.md`),
      nota(`Marca de recambios.`, { tipo: "marca", nombre: marca }),
    );
  }
}
