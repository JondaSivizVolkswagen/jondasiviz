// Puente entre el vault de Obsidian (la red relacional que se autoría a mano) y
// los JSON que consume el motor.
//
//   vault/Modelos/*.md      -> src/data/models.json
//   vault/Piezas/*.md       -> src/data/catalog.json
//   vault/Plataformas/*.md  -> nodos de motor, generados
//   vault/Chasis/*.md       -> nodos de chasis, generados
//   vault/Categorias/*.md   -> nodos de categoría, generados
//   vault/Grupos/*.md       -> nodos de grupo exclusivo, generados
//   vault/Marcas/*.md       -> nodos de marca, generados
//
// Los cinco últimos son nodos de contexto: no aportan datos al motor, pero son los
// que convierten el vault en una red navegable en vez de una lista de fichas.
//
// brands.json y floors.json siguen siendo configuración a mano, no salen del vault.

import { readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { validarCatalogo } from "../engine/catalog";
import { evaluar } from "../engine/compat";
import type {
  Catalogo,
  CatalogoModelos,
  Categoria,
  Chasis,
  Equipamiento,
  Gama,
  Legalidad,
  ModeloVW,
  Objetivo,
  Pieza,
  Propulsion,
  Stage,
  Traccion,
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

/** Nombre legible de cada categoría, para los nodos de contexto. */
const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  admision: "admisión",
  escape: "escape",
  turbo: "turbo",
  gestion: "gestión",
  suspension: "suspensión",
  transmision: "transmisión",
  frenos: "frenos",
  direccion: "dirección",
  seguridad: "seguridad",
  ruedas: "ruedas",
  estetica: "estética",
};

const NOMBRE_PROPULSION: Record<Propulsion, string> = {
  combustion: "combustión",
  mhev: "combustión con hibridación ligera de 48 V",
  phev: "híbrido enchufable",
  bev: "eléctrico",
};

const NOMBRE_LEGALIDAD: Record<Legalidad, string> = {
  homologable: "homologable",
  "requiere-ficha": "requiere reforma de ficha técnica",
  "solo-circuito": "solo circuito, fuera de homologación en la UE",
};

const vacio = (v: unknown): boolean => v == null || v === "";

function listarMarkdown(dir: string): string[] {
  const salida: string[] = [];
  const recorrer = (d: string): void => {
    const entradas = readdirSync(d, { withFileTypes: true });
    for (const e of entradas) {
      if (e.name.startsWith(".")) continue;
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

  const stage = vacio(data.stage) ? undefined : (String(data.stage) as Stage);
  const nota = vacio(data.nota) ? undefined : String(data.nota);
  const grupoExclusivo = vacio(data.grupoExclusivo) ? undefined : String(data.grupoExclusivo);
  const imagen = vacio(data.imagen) ? undefined : String(data.imagen);

  return {
    id: String(data.id ?? ""),
    nombre: String(data.nombre ?? data.id ?? ""),
    categoria: String(data.categoria ?? "") as Categoria,
    plataformas: comoLista(data.plataformas) as Pieza["plataformas"],
    chasis: comoLista(data.chasis) as Chasis[],
    legalidad: (vacio(data.legalidad) ? "homologable" : String(data.legalidad)) as Legalidad,
    traccion: comoLista(data.traccion) as Traccion[],
    sustituye: comoLista(data.sustituye) as Equipamiento[],
    exige: comoLista(data.exige) as Equipamiento[],
    chocaCon: comoLista(data.chocaCon) as Equipamiento[],
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
    chasis: String(data.chasis ?? "") as Chasis,
    motor: String(data.motor ?? "") as ModeloVW["motor"],
    motorDetalle: String(data.motorDetalle ?? ""),
    traccion: String(data.traccion ?? "delantera") as Traccion,
    propulsion: (vacio(data.propulsion) ? "combustion" : String(data.propulsion)) as Propulsion,
    equipamiento: comoLista(data.equipamiento) as Equipamiento[],
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
    // Los nodos de contexto (plataforma, chasis, categoria, grupo, marca) y el
    // índice no aportan datos al motor.
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

// --- Exportación: JSON -> vault (regenera la red relacional entera) ----------

const CARPETAS = ["Modelos", "Piezas", "Plataformas", "Chasis", "Categorias", "Grupos", "Marcas"];

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

const enlace = (nombre: string): string => `[[${nombreArchivo(nombre)}]]`;
const enlaces = (items: string[]): string => items.map(enlace).join(", ");

/** Nodo de chasis. Lleva prefijo porque "MEB" es a la vez motor y chasis. */
const nodoChasis = (c: string): string => `Chasis ${c}`;
const nodoCategoria = (c: Categoria): string => `Categoría ${NOMBRE_CATEGORIA[c] ?? c}`;
const nodoGrupo = (g: string): string => `Grupo ${g}`;

/** Línea de sección; se omite entera si no hay nada que enlazar. */
function seccion(titulo: string, items: string[]): string {
  return items.length === 0 ? "" : `**${titulo}** ${enlaces(items)}`;
}

export function escribirVault(
  dir: string,
  catalogo: Catalogo,
  modelos: CatalogoModelos,
  marcas: string[] = [],
): void {
  for (const sub of CARPETAS) {
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

  const porId = new Map(catalogo.piezas.map((p) => [p.id, p]));
  const marcasDe = (p: Pieza): string[] =>
    marcas.filter((m) => p.nombre.toLowerCase().includes(m.toLowerCase()));

  // Matriz de compatibilidad: se calcula una vez y alimenta los dos sentidos del grafo.
  const montaEn = new Map<string, ModeloVW[]>();
  const avisaEn = new Map<string, ModeloVW[]>();
  const piezasDe = new Map<string, Pieza[]>();
  for (const p of catalogo.piezas) {
    montaEn.set(p.id, []);
    avisaEn.set(p.id, []);
  }
  for (const m of modelos.modelos) {
    piezasDe.set(m.id, []);
    for (const p of catalogo.piezas) {
      const r = evaluar(p, m, { catalogo });
      if (r.veredicto === "incompatible") continue;
      piezasDe.get(m.id)!.push(p);
      (r.veredicto === "compatible" ? montaEn : avisaEn).get(p.id)!.push(m);
    }
  }

  // --- Piezas ---------------------------------------------------------------
  const plataformas = new Set<string>();
  const chasisUsados = new Set<string>();
  const categorias = new Set<Categoria>();
  const grupos = new Set<string>();

  for (const p of catalogo.piezas) {
    for (const plat of p.plataformas) plataformas.add(plat);
    for (const c of p.chasis) chasisUsados.add(c);
    categorias.add(p.categoria);
    if (p.grupoExclusivo) grupos.add(p.grupoExclusivo);

    const deps = p.requiere.map((id) => porId.get(id)?.nombre ?? id);
    const cuerpo = [
      `${enlace(nodoCategoria(p.categoria))} · gama ${p.gama} · ${NOMBRE_LEGALIDAD[p.legalidad]}` +
        (p.stage ? ` · ${p.stage}` : "") +
        (p.grupoExclusivo ? ` · ${enlace(nodoGrupo(p.grupoExclusivo))}` : ""),
      seccion("Motor", p.plataformas),
      seccion("Chasis", p.chasis.map(nodoChasis)),
      seccion("Marcas", marcasDe(p)),
      seccion("Requiere", deps),
      seccion(
        `Monta en (${montaEn.get(p.id)!.length})`,
        montaEn.get(p.id)!.map((m) => m.nombre),
      ),
      seccion(
        `Monta con avisos en (${avisaEn.get(p.id)!.length})`,
        avisaEn.get(p.id)!.map((m) => m.nombre),
      ),
      p.nota ? `> ${p.nota}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    writeFileSync(
      join(dir, "Piezas", `${nombreArchivo(p.nombre)}.md`),
      nota(cuerpo, {
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
        chasis: p.chasis,
        legalidad: p.legalidad,
        traccion: p.traccion,
        sustituye: p.sustituye,
        exige: p.exige,
        chocaCon: p.chocaCon,
        grupoExclusivo: p.grupoExclusivo ?? null,
        stage: p.stage ?? null,
        nota: p.nota ?? null,
        imagen: p.imagen ?? null,
      }),
    );
  }

  // --- Modelos --------------------------------------------------------------
  for (const m of modelos.modelos) {
    plataformas.add(m.motor);
    chasisUsados.add(m.chasis);

    const suyas = piezasDe.get(m.id)!;
    const porCategoria = [...categorias]
      .map((c) => ({ c, ps: suyas.filter((p) => p.categoria === c) }))
      .filter((x) => x.ps.length > 0);

    const cuerpo = [
      `${enlace(nodoChasis(m.chasis))} · ${enlace(m.motor)} · ${m.motorDetalle}`,
      `Tracción ${m.traccion} · ${NOMBRE_PROPULSION[m.propulsion]} · ${m.anios[0]}-${m.anios[1]}`,
      m.equipamiento.length > 0 ? `**De serie** ${m.equipamiento.join(", ")}` : "",
      `**Piezas que montan (${suyas.length})**`,
      ...porCategoria.map((x) => `${enlace(nodoCategoria(x.c))}: ${enlaces(x.ps.map((p) => p.nombre))}`),
    ]
      .filter(Boolean)
      .join("\n\n");

    writeFileSync(
      join(dir, "Modelos", `${nombreArchivo(m.nombre)}.md`),
      nota(cuerpo, {
        tipo: "modelo",
        id: m.id,
        nombre: m.nombre,
        alias: m.alias,
        chasis: m.chasis,
        motor: m.motor,
        motorDetalle: m.motorDetalle,
        traccion: m.traccion,
        propulsion: m.propulsion,
        equipamiento: m.equipamiento,
        anios: m.anios,
      }),
    );
  }

  // --- Nodos de contexto ----------------------------------------------------
  for (const plat of [...plataformas].sort()) {
    const suyos = modelos.modelos.filter((m) => m.motor === plat);
    const suyas = catalogo.piezas.filter((p) => p.plataformas.includes(plat as never));
    writeFileSync(
      join(dir, "Plataformas", `${nombreArchivo(plat)}.md`),
      nota(
        [
          "Plataforma de motor.",
          seccion(`Modelos (${suyos.length})`, suyos.map((m) => m.nombre)),
          seccion(`Piezas (${suyas.length})`, suyas.map((p) => p.nombre)),
        ]
          .filter(Boolean)
          .join("\n\n"),
        { tipo: "plataforma", nombre: plat },
      ),
    );
  }

  for (const ch of [...chasisUsados].sort()) {
    const suyos = modelos.modelos.filter((m) => m.chasis === ch);
    const suyas = catalogo.piezas.filter((p) => p.chasis.includes(ch as Chasis));
    writeFileSync(
      join(dir, "Chasis", `${nombreArchivo(nodoChasis(ch))}.md`),
      nota(
        [
          "Plataforma de chasis. Decide qué monta todo lo que no cuelga del motor.",
          seccion(`Modelos (${suyos.length})`, suyos.map((m) => m.nombre)),
          seccion(`Piezas (${suyas.length})`, suyas.map((p) => p.nombre)),
        ]
          .filter(Boolean)
          .join("\n\n"),
        { tipo: "chasis", nombre: ch },
      ),
    );
  }

  for (const cat of [...categorias].sort()) {
    const suyas = catalogo.piezas.filter((p) => p.categoria === cat);
    writeFileSync(
      join(dir, "Categorias", `${nombreArchivo(nodoCategoria(cat))}.md`),
      nota(seccion(`Piezas (${suyas.length})`, suyas.map((p) => p.nombre)), {
        tipo: "categoria",
        nombre: cat,
      }),
    );
  }

  for (const g of [...grupos].sort()) {
    const suyas = catalogo.piezas.filter((p) => p.grupoExclusivo === g);
    writeFileSync(
      join(dir, "Grupos", `${nombreArchivo(nodoGrupo(g))}.md`),
      nota(
        [
          "Estas piezas cumplen la misma función. No se montan juntas: el motor elige una.",
          seccion(`Piezas (${suyas.length})`, suyas.map((p) => p.nombre)),
        ].join("\n\n"),
        { tipo: "grupo", nombre: g },
      ),
    );
  }

  for (const marca of [...marcas].sort()) {
    const suyas = catalogo.piezas.filter((p) =>
      p.nombre.toLowerCase().includes(marca.toLowerCase()),
    );
    // Una marca de `brands.json` sin ninguna pieza sería un nodo suelto en el grafo.
    // Sigue valiendo para clasificar gama, pero no se le hace nota.
    if (suyas.length === 0) continue;
    writeFileSync(
      join(dir, "Marcas", `${nombreArchivo(marca)}.md`),
      nota(
        [
          "Marca de recambios.",
          seccion(`Piezas (${suyas.length})`, suyas.map((p) => p.nombre)),
        ]
          .filter(Boolean)
          .join("\n\n"),
        { tipo: "marca", nombre: marca },
      ),
    );
  }
}
