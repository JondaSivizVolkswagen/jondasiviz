// Subagente 2 (offline): a partir de modelo + gama + presupuesto + objetivo,
// autoselecciona las piezas y comprueba el gasto mínimo recomendado.
//
// La matemática de selección la hace el motor determinista (engine/recommend).
// Este módulo añade la resolución del modelo y el suelo de gasto por gama/objetivo.

import { cargarCatalogo } from "../engine/catalog";
import { buscarModelo, listarModelos, piezasDeModelo } from "../engine/graph";
import { generarPresupuesto, NOMBRE_OBJETIVO } from "../engine/recommend";
import floorsJson from "../data/floors.json";
import type {
  Catalogo,
  Gama,
  ModeloVW,
  Objetivo,
  Presupuesto,
} from "../engine/types";

export interface EntradaSelector {
  /** Texto libre: id, nombre o alias del modelo. */
  modelo: string;
  gama: Gama;
  presupuesto: number;
  objetivo: Objetivo;
}

export interface ResultadoSelector {
  modelo: ModeloVW | null;
  presupuesto: Presupuesto | null;
  /** Gasto mínimo recomendado para esta gama y objetivo. */
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

export interface SelectorPresupuesto {
  seleccionar(entrada: EntradaSelector): ResultadoSelector;
}

export function crearSelector(
  catalogo: Catalogo = cargarCatalogo(),
  suelosCfg: ConfigSuelos = floorsJson as ConfigSuelos,
  modelos: ModeloVW[] = listarModelos(),
): SelectorPresupuesto {
  const seleccionar = (entrada: EntradaSelector): ResultadoSelector => {
    const { gama, objetivo } = entrada;
    const presupuesto = Number.isFinite(entrada.presupuesto) ? entrada.presupuesto : 0;
    const suelo = suelosCfg.suelos[objetivo][gama];
    const avisos: string[] = [];

    const modelo = buscarModelo(entrada.modelo, modelos);
    if (!modelo) {
      avisos.push(
        `No reconozco el modelo "${entrada.modelo}". Modelos disponibles: ` +
          modelos.map((m) => m.nombre).join(", ") +
          ".",
      );
      return { modelo: null, presupuesto: null, suelo, cumpleSuelo: false, gamaSugerida: null, avisos };
    }

    const cumpleSuelo = presupuesto >= suelo;
    let gamaSugerida: Gama | null = null;
    if (!cumpleSuelo) {
      // Gama más alta cuyo suelo sí cabe en el presupuesto.
      for (const g of [...GAMAS].reverse()) {
        if (presupuesto >= suelosCfg.suelos[objetivo][g]) {
          gamaSugerida = g;
          break;
        }
      }
      const detalle =
        gamaSugerida && gamaSugerida !== gama
          ? ` Con ese dinero encaja mejor la gama ${gamaSugerida}.`
          : gamaSugerida == null
            ? " Ni siquiera llega al mínimo de gama baja para este objetivo."
            : "";
      avisos.push(
        `Para un proyecto de ${NOMBRE_OBJETIVO[objetivo]} en gama ${gama} conviene gastar al menos ` +
          `${suelo} ${suelosCfg.moneda}. Tienes ${presupuesto} ${suelosCfg.moneda}.${detalle}`,
      );
    }

    const compatibles = piezasDeModelo(modelo, catalogo);
    const catalogoModelo: Catalogo = { ...catalogo, piezas: compatibles };

    const presupuestoRes = generarPresupuesto(
      {
        plataforma: modelo.motor,
        gama,
        presupuesto,
        objetivo,
        modelo: modelo.nombre,
      },
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
