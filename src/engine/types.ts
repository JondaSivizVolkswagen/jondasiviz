// Tipos del dominio: catálogo de piezas y motor de presupuesto.

export type Plataforma =
  | "1.8T-20v"
  | "EA113"
  | "EA888"
  | "VR6"
  | "TDI"
  // Añadidas con los coches de vw_europa_modelos_1 y vw_europa_golf_variantes.
  | "EA888-evo4"
  | "EA211"
  | "EA211-evo"
  | "EA211-PHEV"
  | "EA288"
  | "EA288-evo"
  // El 1.6 TDI va aparte del 2.0: otro turbo, otros inyectores y otro techo de potencia.
  | "EA288-16"
  | "MEB";

/**
 * Plataforma de chasis. Es ortogonal al motor: un Golf 8 GTI y un Tiguan Mk3
 * comparten motor y no comparten ni un brazo de suspensión.
 */
export type Chasis = "A2" | "PQ25" | "PQ34" | "PQ35" | "MQB" | "MQB Evo" | "MEB";

export type Propulsion = "combustion" | "phev" | "bev";

/** Situación de la pieza frente a la homologación europea. */
export type Legalidad = "homologable" | "requiere-ficha" | "solo-circuito";

/**
 * Equipamiento de serie del coche que condiciona el montaje. Sirve para las tres
 * preguntas que no responde la compatibilidad de plataforma: si la pieza sobra
 * porque ya viene de fábrica, si necesita algo que el coche no tiene, y si choca
 * con una centralita o un postratamiento que sí tiene.
 */
export type Equipamiento =
  | "dcc" // suspensión adaptativa de fábrica
  | "vaq" // diferencial delantero vectorial
  | "diferencial-trasero" // eje trasero vectorial del Golf R
  | "frenos-grandes" // pinzas y discos de 357 mm o más
  | "dsg" // cambio de doble embrague
  | "gpf" // filtro de partículas de gasolina
  | "dpf"; // filtro de partículas diésel

export type Gama = "baja" | "media" | "alta";

export type Objetivo = "drift" | "drag" | "mas-cv" | "estetica";

export type Categoria =
  | "admision"
  | "escape"
  | "turbo"
  | "gestion"
  | "suspension"
  | "transmision"
  | "frenos"
  | "direccion"
  | "seguridad"
  | "ruedas"
  | "estetica";

export type Stage = "stage1" | "stage2" | "stage3";

export interface Precio {
  min: number;
  estimado: number;
  max: number;
}

export interface Pieza {
  id: string;
  nombre: string;
  categoria: Categoria;
  plataformas: Plataforma[];
  /**
   * Chasis en los que monta. Lista vacía = la pieza no depende del chasis, que es
   * el caso de todo lo que va colgado del motor (admisión, escape, turbo, gestión).
   */
  chasis: Chasis[];
  /** Cómo queda el coche frente a la ITV con esta pieza montada. */
  legalidad: Legalidad;
  /** Tracciones en las que la pieza tiene sentido. Vacía = cualquiera. */
  traccion: Traccion[];
  /** Equipamiento de serie que esta pieza duplica: montarla no aporta nada. */
  sustituye: Equipamiento[];
  /** Equipamiento que el coche debe llevar para que esta pieza sea la correcta. */
  exige: Equipamiento[];
  /** Equipamiento de serie con el que esta pieza da problemas. */
  chocaCon: Equipamiento[];
  gama: Gama;
  precio: Precio;
  /** Peso 0..5 de cuánto aporta la pieza a cada objetivo. */
  objetivos: Record<Objetivo, number>;
  /** Impacto técnico 1..5, independiente del objetivo. */
  impacto: number;
  /** Ids de piezas que deben ir sí o sí antes que esta. */
  requiere: string[];
  /**
   * Piezas con el mismo grupo cumplen la misma función y no se montan juntas
   * (dos intercoolers, coilovers y air ride, remap y standalone...).
   */
  grupoExclusivo?: string;
  stage?: Stage;
  nota?: string;
  /** Ruta o URL de una foto de la pieza. Opcional: hoy el catálogo no trae fotos. */
  imagen?: string;
}

export interface Catalogo {
  version: string;
  moneda: string;
  piezas: Pieza[];
}

export type Traccion = "delantera" | "total";

export interface ModeloVW {
  id: string;
  nombre: string;
  /** Formas alternativas de escribir el modelo, en minúsculas. */
  alias: string[];
  /** Plataforma de chasis. Filtra las piezas que no cuelgan del motor. */
  chasis: Chasis;
  /** Plataforma de motor, la que enlaza con las piezas del catálogo. */
  motor: Plataforma;
  motorDetalle: string;
  traccion: Traccion;
  /** Qué mueve al coche. Decide si las categorías de motor existen siquiera. */
  propulsion: Propulsion;
  /** Lo que el coche ya trae de fábrica y condiciona el montaje. */
  equipamiento: Equipamiento[];
  /** [primer año, último año]. */
  anios: [number, number];
}

export interface CatalogoModelos {
  version: string;
  modelos: ModeloVW[];
}

export interface ClasificacionGama {
  gama: Gama;
  /** 0..1, cuánto de segura es la clasificación. */
  confianza: number;
  motivo: string;
}

export interface GruposPorGama {
  baja: Pieza[];
  media: Pieza[];
  alta: Pieza[];
}

export interface PeticionPresupuesto {
  plataforma: Plataforma;
  presupuesto: number;
  /** Uno o más objetivos del proyecto. Sus pesos se suman al puntuar las piezas. */
  objetivos: Objetivo[];
  modelo?: string;
}

export type MotivoLinea = "esencial" | "valor" | "dependencia";

export interface LineaPresupuesto {
  pieza: Pieza;
  precio: number;
  motivo: MotivoLinea;
}

export interface GrupoCategoria {
  categoria: Categoria;
  total: number;
  lineas: LineaPresupuesto[];
}

/**
 * Una categoría prioritaria del objetivo y lo que costaría cubrirla por lo mínimo.
 * Es lo que responde a "cuánto necesito y qué entra y qué no".
 */
export interface RequisitoCategoria {
  categoria: Categoria;
  /** Opción más barata que aporta algo al objetivo. null si el catálogo no tiene nada. */
  pieza: Pieza | null;
  /** Lo que suma cubrirla, ya descontado lo que arrastran otras categorías. */
  minimo: number;
  /** Si el presupuesto actual la cubre. */
  cubierta: boolean;
}

export interface MejoraSugerida {
  pieza: Pieza;
  precio: number;
  /**
   * Cuánto dinero extra haría falta sobre el sobrante actual. Si la mejora sustituye a
   * una pieza montada, ya cuenta con lo que devuelve esa pieza al salir del plan.
   */
  falta: number;
  /** Pieza del plan a la que reemplazaría, si cumple su misma función. */
  sustituye?: Pieza;
}

export interface Presupuesto {
  peticion: PeticionPresupuesto;
  lineas: LineaPresupuesto[];
  porCategoria: GrupoCategoria[];
  total: number;
  restante: number;
  /**
   * Gama del build que ha salido, ponderada por el dinero que se lleva cada pieza.
   * No es un dato de entrada: la decide el presupuesto. null si no entró nada.
   */
  gamaResultante: Gama | null;
  /** Categorías prioritarias del objetivo, con su mínimo y si entran o no. */
  esenciales: RequisitoCategoria[];
  /** Lo que cuesta cubrir todas las esenciales por lo mínimo. El proyecto pelado. */
  minimoEsencial: number;
  siguientesMejoras: MejoraSugerida[];
  avisos: string[];
}
