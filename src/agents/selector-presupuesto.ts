// Subagente 2 (offline): a partir de modelo + presupuesto + objetivos, autoselecciona
// las piezas y sitúa el resultado en una gama.
//
// La gama no se pide al usuario. El dinero disponible es el único techo: el motor
// mira todas las piezas compatibles con el motor del coche y coge las que caben.
// Lo que hace este módulo es resolver el modelo y traducir el presupuesto a
// expectativa de gama, usando la matriz de floors.json como escala de referencia.

import { cargarCatalogo } from "../engine/catalog";
import { buscarModelo, listarModelos, piezasDeModelo } from "../engine/graph";
import { generarPresupuesto, nombreObjetivos, normalizarObjetivos } from "../engine/recommend";
import floorsJson from "../data/floors.json";
import type { Catalogo, Gama, ModeloVW, Objetivo, Presupuesto } from "../engine/types";

export interface EntradaSelector {
  /** Texto libre: id, nombre o alias del modelo. */
  modelo: string;
  presupuesto: number;
  /** Uno o más objetivos. El suelo de gasto es la suma de los suyos. */
  objetivos: Objetivo[];
}

/** Gama a la que aspira un presupuesto, y lo que costaría llegar a ella. */
export interface EscalonGama {
  gama: Gama;
  presupuesto: number;
}

export interface ResultadoSelector {
  modelo: ModeloVW | null;
  presupuesto: Presupuesto | null;
  /** Gasto mínimo para que el proyecto tenga sentido (umbral de gama baja). */
  suelo: number;
  cumpleSuelo: boolean;
  /** Gama a la que da el dinero disponible. null si no llega ni al suelo. */
  gamaEsperada: Gama | null;
  /** Siguiente escalón de gama y lo que haría falta. null si ya se está en alta. */
  siguienteEscalon: EscalonGama | null;
  avisos: string[];
}

interface ConfigSuelos {
  moneda: string;
  suelos: Record<Objetivo, Record<Gama, number>>;
}

const GAMAS: Gama[] = ["baja", "media", "alta"];

/**
 * Dinero a partir del cual una combinación de objetivos llega a una gama. Es la
 * suma de los umbrales de cada objetivo: pedir varias cosas a la vez sube el listón.
 * Función pura para que la interfaz lo muestre en vivo.
 */
export function umbralGama(
  objetivos: Objetivo[],
  gama: Gama,
  suelosCfg: ConfigSuelos = floorsJson as ConfigSuelos,
): number {
  return normalizarObjetivos(objetivos).reduce((s, o) => s + suelosCfg.suelos[o][gama], 0);
}

/** Gasto mínimo para que el proyecto tenga sentido: el umbral de la gama más baja. */
export function sueloDe(
  objetivos: Objetivo[],
  suelosCfg: ConfigSuelos = floorsJson as ConfigSuelos,
): number {
  return umbralGama(objetivos, "baja", suelosCfg);
}

/** Gama más alta que cubre el presupuesto. null si no llega ni al suelo. */
export function gamaEsperada(
  objetivos: Objetivo[],
  presupuesto: number,
  suelosCfg: ConfigSuelos = floorsJson as ConfigSuelos,
): Gama | null {
  if (normalizarObjetivos(objetivos).length === 0) return null;
  for (const g of [...GAMAS].reverse()) {
    if (presupuesto >= umbralGama(objetivos, g, suelosCfg)) return g;
  }
  return null;
}

/** Siguiente escalón de gama y lo que costaría. null si ya se está en la más alta. */
export function siguienteEscalon(
  objetivos: Objetivo[],
  presupuesto: number,
  suelosCfg: ConfigSuelos = floorsJson as ConfigSuelos,
): EscalonGama | null {
  if (normalizarObjetivos(objetivos).length === 0) return null;
  const actual = gamaEsperada(objetivos, presupuesto, suelosCfg);
  const siguiente = actual == null ? "baja" : GAMAS[GAMAS.indexOf(actual) + 1];
  if (!siguiente) return null;
  return { gama: siguiente, presupuesto: umbralGama(objetivos, siguiente, suelosCfg) };
}

export interface SelectorPresupuesto {
  seleccionar(entrada: EntradaSelector): ResultadoSelector;
}

export function crearSelector(
  catalogo: Catalogo = cargarCatalogo(),
  suelosCfg: ConfigSuelos = floorsJson as ConfigSuelos,
  modelos: ModeloVW[] = listarModelos(),
): SelectorPresupuesto {
  const seleccionar = (entrada: EntradaSelector): ResultadoSelector => {
    const objetivos = normalizarObjetivos(entrada.objetivos);
    const presupuesto = Number.isFinite(entrada.presupuesto) ? entrada.presupuesto : 0;
    const suelo = sueloDe(objetivos, suelosCfg);
    const esperada = gamaEsperada(objetivos, presupuesto, suelosCfg);
    const escalon = siguienteEscalon(objetivos, presupuesto, suelosCfg);
    const avisos: string[] = [];

    const modelo = buscarModelo(entrada.modelo, modelos);
    if (!modelo) {
      avisos.push(
        `No reconozco el modelo "${entrada.modelo}". Modelos disponibles: ` +
          modelos.map((m) => m.nombre).join(", ") +
          ".",
      );
      return {
        modelo: null,
        presupuesto: null,
        suelo,
        cumpleSuelo: false,
        gamaEsperada: null,
        siguienteEscalon: null,
        avisos,
      };
    }

    const cumpleSuelo = objetivos.length > 0 && presupuesto >= suelo;
    if (objetivos.length > 0 && !cumpleSuelo) {
      avisos.push(
        `Para un proyecto de ${nombreObjetivos(objetivos)} conviene contar con al menos ` +
          `${suelo} ${suelosCfg.moneda}. Tienes ${presupuesto} ${suelosCfg.moneda}, así que la ` +
          `lista sale corta: te sirve para empezar, no para terminarlo.`,
      );
    }

    const compatibles = piezasDeModelo(modelo, catalogo);
    const catalogoModelo: Catalogo = { ...catalogo, piezas: compatibles };

    const presupuestoRes = generarPresupuesto(
      { plataforma: modelo.motor, chasis: modelo.chasis, presupuesto, objetivos, modelo: modelo.nombre },
      catalogoModelo,
    );

    return {
      modelo,
      presupuesto: presupuestoRes,
      suelo,
      cumpleSuelo,
      gamaEsperada: esperada,
      siguienteEscalon: escalon,
      avisos: [...avisos, ...presupuestoRes.avisos],
    };
  };

  return { seleccionar };
}
