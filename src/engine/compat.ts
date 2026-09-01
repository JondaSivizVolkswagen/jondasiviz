// Grafo de restricciones entre piezas y modelos.
//
// Responde a tres preguntas por cada par (pieza, coche):
//   1. ¿Encaja físicamente? -> plataforma de motor, chasis, tracción, propulsión.
//   2. ¿Da algún fallo o problema? -> equipamiento de serie, dependencias, carga.
//   3. ¿Es legal en la UE? -> homologación, postratamiento de gases, carrocería.
//
// Es determinista: mismo par, mismo veredicto. Se sondea par a par desde
// `src/cli/probar.ts`, y de ese sondeo sale la matriz de compatibilidad completa.

import { cargarCatalogo } from "./catalog";
import type { Catalogo, Categoria, Equipamiento, ModeloVW, Pieza } from "./types";

/**
 * Categorías que cuelgan del motor y su transmisión. El resto cuelgan del chasis.
 * La transmisión va aquí porque un embrague o un autoblocante siguen a la caja y al
 * par del motor, no a la carrocería.
 */
const CATEGORIAS_MOTOR: readonly Categoria[] = [
  "admision",
  "escape",
  "turbo",
  "gestion",
  "transmision",
];

/** Las que no existen siquiera en un eléctrico. */
const CATEGORIAS_COMBUSTION: readonly Categoria[] = ["admision", "escape", "turbo", "gestion"];

export type Veredicto = "compatible" | "con-avisos" | "incompatible";

export type Gravedad = "bloqueo" | "aviso" | "nota";

export type MotivoHallazgo =
  | "plataforma"
  | "chasis"
  | "propulsion"
  | "traccion"
  | "legalidad"
  | "dependencia"
  | "grupo"
  | "redundancia"
  | "equipamiento"
  | "carga";

export interface Hallazgo {
  motivo: MotivoHallazgo;
  gravedad: Gravedad;
  mensaje: string;
}

export interface Compatibilidad {
  pieza: Pieza;
  modelo: ModeloVW;
  veredicto: Veredicto;
  /** Si el coche seguiría pasando la ITV con esto montado. */
  homologable: boolean;
  hallazgos: Hallazgo[];
  /** Piezas que arrastra, ya resueltas y en orden de montaje. */
  dependencias: Pieza[];
  /** Precio estimado de la pieza más todo lo que arrastra. */
  coste: number;
}

export interface OpcionesCompat {
  catalogo?: Catalogo;
  /** Piezas que ya están montadas en el coche, para detectar choques de grupo. */
  montadas?: Pieza[];
}

const esDeMotor = (p: Pieza): boolean => CATEGORIAS_MOTOR.includes(p.categoria);

const comunes = <T>(a: readonly T[], b: readonly T[]): T[] => a.filter((x) => b.includes(x));

const ETIQUETA_EQUIPO: Record<Equipamiento, string> = {
  dcc: "suspensión adaptativa DCC",
  vaq: "diferencial delantero VAQ",
  "diferencial-trasero": "eje trasero vectorial",
  "frenos-grandes": "frenos de 357 mm o más",
  dsg: "cambio DSG",
  gpf: "filtro de partículas de gasolina",
  dpf: "filtro de partículas diésel",
  "magnetic-ride": "amortiguación Magnetic Ride",
  haldex: "tracción total Haldex",
  torsen: "quattro permanente con Torsen",
  act: "desactivación de cilindros",
  "scr-adblue": "postratamiento con AdBlue",
  "hibridacion-48v": "red de 48 voltios",
  "suspension-neumatica": "suspensión neumática",
  "frenos-ceramicos": "frenos carbono-cerámicos",
};

/**
 * Predicado base de compatibilidad: ¿el catálogo lista esta pieza para este coche?
 *
 * Las piezas de motor se resuelven por plataforma de motor y las de chasis por
 * plataforma de chasis. Una pieza sin chasis declarado se considera de motor aunque
 * su categoría diga otra cosa, para no romper catálogos a medio migrar.
 */
export function encaja(pieza: Pieza, modelo: ModeloVW): boolean {
  if (pieza.chasis.length > 0) return pieza.chasis.includes(modelo.chasis);
  return pieza.plataformas.includes(modelo.motor);
}

/** Evalúa un par (pieza, coche) y devuelve el veredicto con sus motivos. */
export function evaluar(
  pieza: Pieza,
  modelo: ModeloVW,
  opciones: OpcionesCompat = {},
): Compatibilidad {
  const catalogo = opciones.catalogo ?? cargarCatalogo();
  const montadas = opciones.montadas ?? [];
  const porId = new Map(catalogo.piezas.map((p) => [p.id, p]));
  const hallazgos: Hallazgo[] = [];

  const bloqueo = (motivo: MotivoHallazgo, mensaje: string): void => {
    hallazgos.push({ motivo, gravedad: "bloqueo", mensaje });
  };
  const aviso = (motivo: MotivoHallazgo, mensaje: string): void => {
    hallazgos.push({ motivo, gravedad: "aviso", mensaje });
  };
  const nota = (motivo: MotivoHallazgo, mensaje: string): void => {
    hallazgos.push({ motivo, gravedad: "nota", mensaje });
  };

  // 1. Propulsión: hay categorías que sencillamente no existen en el coche.
  if (modelo.propulsion === "bev" && CATEGORIAS_COMBUSTION.includes(pieza.categoria)) {
    bloqueo(
      "propulsion",
      `${modelo.nombre} es eléctrico: no tiene ${pieza.categoria}. Esa categoría no existe en este coche.`,
    );
  }
  if (modelo.propulsion === "phev" && pieza.categoria === "gestion") {
    bloqueo(
      "propulsion",
      `La gestión del híbrido enchufable va cerrada de fábrica: no hay reprogramación para ${modelo.nombre}.`,
    );
  }

  // 2. Encaje físico.
  if (esDeMotor(pieza) || pieza.chasis.length === 0) {
    if (!pieza.plataformas.includes(modelo.motor)) {
      bloqueo(
        "plataforma",
        `El catálogo no la lista para el motor ${modelo.motor}. Sirve a ${pieza.plataformas.join(", ") || "ninguna plataforma"}.`,
      );
    }
  } else if (!pieza.chasis.includes(modelo.chasis)) {
    bloqueo(
      "chasis",
      `No monta en un chasis ${modelo.chasis}. Está hecha para ${pieza.chasis.join(", ")}.`,
    );
  }

  // 3. Tracción.
  if (pieza.traccion.length > 0 && !pieza.traccion.includes(modelo.traccion)) {
    bloqueo(
      "traccion",
      `Solo tiene sentido en tracción ${pieza.traccion.join(" o ")}, y ${modelo.nombre} es de tracción ${modelo.traccion}.`,
    );
  }

  // 4. Choques con el equipamiento de serie: aquí es donde salen los fallos reales.
  const choques = comunes(pieza.chocaCon, modelo.equipamiento);
  for (const e of choques) {
    bloqueo(
      "equipamiento",
      `${modelo.nombre} lleva ${ETIQUETA_EQUIPO[e]} de serie y esta pieza da fallo con él.`,
    );
  }

  const faltan = pieza.exige.filter((e) => !modelo.equipamiento.includes(e));
  for (const e of faltan) {
    aviso(
      "equipamiento",
      `Está pensada para coches con ${ETIQUETA_EQUIPO[e]}, y ${modelo.nombre} no lo lleva: pagas de más por algo que no aprovechas.`,
    );
  }

  const redundantes = comunes(pieza.sustituye, modelo.equipamiento);
  for (const e of redundantes) {
    aviso(
      "redundancia",
      `${modelo.nombre} ya trae ${ETIQUETA_EQUIPO[e]} de fábrica: montarla aporta poco o nada.`,
    );
  }

  // 5. Legalidad.
  if (pieza.legalidad === "solo-circuito") {
    const filtro = modelo.equipamiento.includes("scr-adblue")
      ? " El coche lleva DPF con AdBlue: quitarlo deja el postratamiento inservible."
      : modelo.equipamiento.includes("dpf")
        ? " El coche lleva DPF de serie."
        : modelo.equipamiento.includes("gpf")
          ? " El coche lleva GPF de serie."
          : "";
    aviso("legalidad", `Deja el coche fuera de homologación en la UE.${filtro} Uso en circuito.`);
  } else if (pieza.legalidad === "requiere-ficha") {
    aviso("legalidad", "Necesita reforma de ficha técnica para pasar la ITV.");
  }

  // 6. Dependencias, resueltas en cadena.
  const dependencias: Pieza[] = [];
  const vistas = new Set<string>([pieza.id]);
  const resolver = (p: Pieza): void => {
    for (const id of p.requiere) {
      if (vistas.has(id)) continue;
      vistas.add(id);
      const dep = porId.get(id);
      if (!dep) {
        bloqueo("dependencia", `Depende de "${id}", que no está en el catálogo.`);
        continue;
      }
      // Una dependencia ya cubierta por algo del mismo grupo no se cuenta dos veces.
      const cubierta =
        dep.grupoExclusivo !== undefined &&
        montadas.some((m) => m.grupoExclusivo === dep.grupoExclusivo);
      if (!cubierta && !montadas.some((m) => m.id === dep.id)) dependencias.push(dep);
      if (!encaja(dep, modelo)) {
        bloqueo(
          "dependencia",
          `Arrastra "${dep.nombre}", que no es compatible con ${modelo.nombre}.`,
        );
      }
      if (dep.legalidad === "solo-circuito") {
        aviso("legalidad", `Su dependencia "${dep.nombre}" deja el coche fuera de homologación.`);
      }
      resolver(dep);
    }
  };
  resolver(pieza);

  if (dependencias.length > 0) {
    const extra = dependencias.reduce((s, d) => s + d.precio.estimado, 0);
    aviso(
      "dependencia",
      `Arrastra ${dependencias.length} pieza${dependencias.length === 1 ? "" : "s"} más: ${extra} € adicionales.`,
    );
  }

  // 7. Choque de grupo exclusivo con lo ya montado.
  if (pieza.grupoExclusivo !== undefined) {
    const rival = montadas.find(
      (m) => m.grupoExclusivo === pieza.grupoExclusivo && m.id !== pieza.id,
    );
    if (rival) {
      bloqueo(
        "grupo",
        `Cumple la misma función que "${rival.nombre}", que ya está montada. No van juntas.`,
      );
    }
  }

  // 8. Carga sobre la transmisión.
  const esTurboGrande = pieza.categoria === "turbo" && pieza.impacto >= 5;
  if (esTurboGrande && modelo.equipamiento.includes("dsg")) {
    const reforzado = montadas.some((m) => m.grupoExclusivo === "embrague");
    if (!reforzado) {
      aviso(
        "carga",
        "Con el DSG de serie el embrague es el eslabón débil: patina antes de llegar al par que da este turbo.",
      );
    }
  }

  const hayBloqueo = hallazgos.some((h) => h.gravedad === "bloqueo");
  const hayAviso = hallazgos.some((h) => h.gravedad === "aviso");
  const veredicto: Veredicto = hayBloqueo ? "incompatible" : hayAviso ? "con-avisos" : "compatible";

  if (veredicto === "compatible") {
    nota("legalidad", "Homologable, sin dependencias y sin choques con el equipamiento de serie.");
  }

  const homologable =
    !hayBloqueo && !hallazgos.some((h) => h.motivo === "legalidad" && h.gravedad === "aviso");

  return {
    pieza,
    modelo,
    veredicto,
    homologable,
    hallazgos,
    dependencias,
    coste: pieza.precio.estimado + dependencias.reduce((s, d) => s + d.precio.estimado, 0),
  };
}

/** Evalúa todas las piezas del catálogo contra un coche. El barrido de prueba y error. */
export function evaluarCatalogo(
  modelo: ModeloVW,
  opciones: OpcionesCompat = {},
): Compatibilidad[] {
  const catalogo = opciones.catalogo ?? cargarCatalogo();
  return catalogo.piezas
    .map((p) => evaluar(p, modelo, { ...opciones, catalogo }))
    .sort((a, b) => a.pieza.id.localeCompare(b.pieza.id));
}

/** Evalúa una pieza contra todos los coches. El barrido en el otro sentido. */
export function evaluarModelos(
  pieza: Pieza,
  modelos: ModeloVW[],
  opciones: OpcionesCompat = {},
): Compatibilidad[] {
  const catalogo = opciones.catalogo ?? cargarCatalogo();
  return modelos
    .map((m) => evaluar(pieza, m, { ...opciones, catalogo }))
    .sort((a, b) => a.modelo.id.localeCompare(b.modelo.id));
}

export interface ResumenCompat {
  compatibles: number;
  conAvisos: number;
  incompatibles: number;
  homologables: number;
}

export function resumir(resultados: readonly Compatibilidad[]): ResumenCompat {
  return {
    compatibles: resultados.filter((r) => r.veredicto === "compatible").length,
    conAvisos: resultados.filter((r) => r.veredicto === "con-avisos").length,
    incompatibles: resultados.filter((r) => r.veredicto === "incompatible").length,
    homologables: resultados.filter((r) => r.homologable).length,
  };
}
