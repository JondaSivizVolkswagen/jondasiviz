// Subagente 2 (offline): a partir de modelo + presupuesto + objetivos, autoselecciona
// las piezas y sitúa el resultado.
//
// La gama no se pide al usuario ni se predice: el dinero disponible es el único techo,
// el motor coge lo que cabe y la gama del build sale de las piezas que entraron
// (`Presupuesto.gamaResultante`). Lo mismo con el mínimo del proyecto, que lo calcula
// el motor sobre el catálogo (`Presupuesto.minimoEsencial`).
//
// floors.json ya solo aporta una cosa: la escala de presupuestos que vale la pena
// probar para ver si poner más dinero cambia algo de verdad.

import { cargarCatalogo } from "../engine/catalog";
import { buscarModelo, listarModelos, piezasDeModelo } from "../engine/graph";
import {
  NIVEL_GAMA,
  generarPresupuesto,
  gruposElegibles,
  techoUtil,
  normalizarObjetivos,
} from "../engine/recommend";
import floorsJson from "../data/floors.json";
import type {
  Catalogo,
  Gama,
  GrupoElegible,
  ModeloVW,
  Objetivo,
  Presupuesto,
} from "../engine/types";

export interface EntradaSelector {
  /** Texto libre: id, nombre o alias del modelo. */
  modelo: string;
  presupuesto: number;
  /** Uno o más objetivos. Sus categorías esenciales se combinan. */
  objetivos: Objetivo[];
  /** Ids de piezas elegidas a mano por el comprador. El resto lo elige el motor. */
  elecciones?: string[];
}

/** Un presupuesto mayor y la gama que el motor saca de verdad con él. */
export interface EscalonGama {
  gama: Gama;
  presupuesto: number;
}

export interface ResultadoSelector {
  modelo: ModeloVW | null;
  presupuesto: Presupuesto | null;
  /** Lo que cuesta cubrir lo esencial del objetivo por lo mínimo, según el catálogo. */
  minimo: number;
  cumpleMinimo: boolean;
  /** Presupuesto que sube la gama del build, ya comprobado. null si ninguno lo hace. */
  siguienteEscalon: EscalonGama | null;
  /**
   * Dinero a partir del cual poner más ya no cambia la lista: con esto entra todo lo que
   * este coche admite para estos objetivos. 0 si no hay nada que montar.
   */
  techoUtil: number;
  /** Partes del coche con varias alternativas compatibles, para que elija el comprador. */
  grupos: GrupoElegible[];
  avisos: string[];
}

interface ConfigSuelos {
  moneda: string;
  suelos: Record<Objetivo, Record<Gama, number>>;
}

const GAMAS: Gama[] = ["baja", "media", "alta"];

/**
 * Escala de referencia por objetivo: presupuestos que merece la pena probar. Suma los
 * umbrales de cada objetivo elegido, porque pedir varias cosas a la vez sube el listón.
 * No predice ninguna gama, solo dice dónde mirar.
 */
export function umbralGama(
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
  /**
   * Siguiente escalón de gama, comprobado en vez de supuesto: recorre la escala de
   * presupuestos por encima del actual y devuelve el primero que, pasado por el motor,
   * da un build de gama más alta. Si ninguno lo consigue no hay escalón. Antes se
   * anunciaba el salto igualmente y a veces prometía una gama que el build ya tenía.
   */
  const buscarEscalon = (
    modelo: ModeloVW,
    objetivos: Objetivo[],
    presupuesto: number,
    gamaActual: Gama | null,
    catalogoModelo: Catalogo,
    elecciones: string[],
  ): EscalonGama | null => {
    const nivelActual = gamaActual ? NIVEL_GAMA[gamaActual] : -1;

    for (const gama of GAMAS) {
      const dinero = umbralGama(objetivos, gama, suelosCfg);
      if (dinero <= presupuesto) continue;
      const prueba = generarPresupuesto(
        {
          plataforma: modelo.motor,
          presupuesto: dinero,
          objetivos,
          modelo: modelo.nombre,
          elecciones,
        },
        catalogoModelo,
      );
      const salida = prueba.gamaResultante;
      if (salida && NIVEL_GAMA[salida] > nivelActual) return { gama: salida, presupuesto: dinero };
    }
    return null;
  };

  const seleccionar = (entrada: EntradaSelector): ResultadoSelector => {
    const objetivos = normalizarObjetivos(entrada.objetivos);
    const presupuesto = Number.isFinite(entrada.presupuesto) ? entrada.presupuesto : 0;

    const modelo = buscarModelo(entrada.modelo, modelos);
    if (!modelo) {
      return {
        modelo: null,
        presupuesto: null,
        minimo: 0,
        cumpleMinimo: false,
        siguienteEscalon: null,
        techoUtil: 0,
        grupos: [],
        avisos: [
          `No reconozco el modelo "${entrada.modelo}". Modelos disponibles: ` +
            modelos.map((m) => m.nombre).join(", ") +
            ".",
        ],
      };
    }

    const compatibles = piezasDeModelo(modelo, catalogo);
    const catalogoModelo: Catalogo = { ...catalogo, piezas: compatibles };

    // Solo se pasan al motor las elecciones que siguen valiendo para este coche y estos
    // objetivos: al cambiar de modelo, lo elegido para el anterior deja de aplicar sin
    // tener que borrarlo, y vuelve solo si se vuelve a ese coche.
    const grupos = gruposElegibles(catalogoModelo, modelo.motor, objetivos);
    const elegibles = new Set(grupos.flatMap((g) => g.piezas.map((p) => p.id)));
    const elecciones = (entrada.elecciones ?? []).filter((id) => elegibles.has(id));

    const plan = generarPresupuesto(
      { plataforma: modelo.motor, presupuesto, objetivos, modelo: modelo.nombre, elecciones },
      catalogoModelo,
    );

    return {
      modelo,
      presupuesto: plan,
      minimo: plan.minimoEsencial,
      cumpleMinimo: objetivos.length > 0 && presupuesto >= plan.minimoEsencial,
      siguienteEscalon: buscarEscalon(
        modelo,
        objetivos,
        presupuesto,
        plan.gamaResultante,
        catalogoModelo,
        elecciones,
      ),
      techoUtil: techoUtil(catalogoModelo, modelo.motor, objetivos, elecciones),
      grupos,
      avisos: plan.avisos,
    };
  };

  return { seleccionar };
}
