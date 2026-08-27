// Subagente 2 (offline): a partir de modelo + gama + presupuesto + objetivos,
// autoselecciona las piezas y comprueba el gasto mínimo recomendado.
//
// La matemática de selección la hace el motor determinista (engine/recommend).
// Este módulo añade la resolución del modelo y el suelo de gasto por gama/objetivos.

import { cargarCatalogo } from "../engine/catalog";
import { buscarModelo, listarModelos, piezasDeModelo } from "../engine/graph";
import { generarPresupuesto, nombreObjetivos, normalizarObjetivos } from "../engine/recommend";
import floorsJson from "../data/floors.json";
import type { Catalogo, Gama, ModeloVW, Objetivo, Presupuesto } from "../engine/types";

export interface EntradaSelector {
  /** Texto libre: id, nombre o alias del modelo. */
  modelo: string;
  gama: Gama;
  presupuesto: number;
  /** Uno o más objetivos. El suelo de gasto es la suma de los suyos. */
  objetivos: Objetivo[];
}

export interface ResultadoSelector {
  modelo: ModeloVW | null;
  presupuesto: Presupuesto | null;
  /** Gasto mínimo recomendado para esta gama y estos objetivos (suma de suelos). */
  suelo: number;
  cumpleSuelo: boolean;
  /** Gama que sí encajaría con el dinero disponible, si la pedida se queda corta. */
  gamaSugerida: Gama | null;
  avisos: string[];
}

interface ConfigSuelos {
  moneda: string;
  suelos: Record<Objetivo, Record<Gama, number>>;
}

const GAMAS: Gama[] = ["baja", "media", "alta"];

/**
 * Gasto mínimo recomendado para una combinación de objetivos en una gama.
 * Es la suma de los suelos de cada objetivo: pedir varias cosas a la vez sube
 * el mínimo. Función pura para que la interfaz pueda mostrarlo en vivo.
 */
export function sueloDe(
  objetivos: Objetivo[],
  gama: Gama,
  suelosCfg: ConfigSuelos = floorsJson as ConfigSuelos,
): number {
  return normalizarObjetivos(objetivos).reduce((s, o) => s + suelosCfg.suelos[o][gama], 0);
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
    const { gama } = entrada;
    const objetivos = normalizarObjetivos(entrada.objetivos);
    const presupuesto = Number.isFinite(entrada.presupuesto) ? entrada.presupuesto : 0;
    const suelo = sueloDe(objetivos, gama, suelosCfg);
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
        gamaSugerida: null,
        avisos,
      };
    }

    const cumpleSuelo = objetivos.length > 0 && presupuesto >= suelo;
    let gamaSugerida: Gama | null = null;
    if (objetivos.length > 0 && !cumpleSuelo) {
      // Gama más alta cuyo suelo combinado sí cabe en el presupuesto.
      for (const g of [...GAMAS].reverse()) {
        if (presupuesto >= sueloDe(objetivos, g, suelosCfg)) {
          gamaSugerida = g;
          break;
        }
      }
      const detalle =
        gamaSugerida && gamaSugerida !== gama
          ? ` Con ese dinero encaja mejor la gama ${gamaSugerida}.`
          : gamaSugerida == null
            ? " Ni siquiera llega al mínimo de gama baja para esto."
            : "";
      avisos.push(
        `Para un proyecto de ${nombreObjetivos(objetivos)} en gama ${gama} conviene gastar al menos ` +
          `${suelo} ${suelosCfg.moneda}. Tienes ${presupuesto} ${suelosCfg.moneda}.${detalle}`,
      );
    }

    const compatibles = piezasDeModelo(modelo, catalogo);
    const catalogoModelo: Catalogo = { ...catalogo, piezas: compatibles };

    const presupuestoRes = generarPresupuesto(
      { plataforma: modelo.motor, gama, presupuesto, objetivos, modelo: modelo.nombre },
      catalogoModelo,
    );

    return {
      modelo,
      presupuesto: presupuestoRes,
      suelo,
      cumpleSuelo,
      gamaSugerida,
      avisos: [...avisos, ...presupuestoRes.avisos],
    };
  };

  return { seleccionar };
}
