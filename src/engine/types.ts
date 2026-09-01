// Tipos del dominio: catálogo de piezas y motor de presupuesto.

export type Plataforma =
  | "1.8T-20v"
  | "EA113"
  | "VR6"
  | "TDI"
  // El 2.0 TSI se parte en dos: el gen2 lleva cadena y se come el aceite, el gen3
  // lleva correa y colector integrado. Un turbo de uno no monta en el otro.
  | "EA888-gen2"
  | "EA888-gen3"
  // Añadidas con los coches de vw_europa_modelos_1 y vw_europa_golf_variantes.
  | "EA888-evo4"
  | "EA211"
  | "EA211-evo"
  | "EA211-PHEV"
  | "EA288"
  | "EA288-evo"
  // El 1.6 TDI va aparte del 2.0: otro turbo, otros inyectores y otro techo de potencia.
  | "EA288-16"
  // Gasolina del grupo que no es de cuatro cilindros transversales.
  | "EA111" // 1.2/1.4 TSI, incluido el 1.4 twincharger
  | "EA855" // 2.5 TFSI cinco cilindros: RS3, TT RS, RS Q3, Formentor VZ5
  | "EA837" // 3.0 TFSI con compresor volumétrico: S4/S5 B8
  | "EA839" // 3.0 TFSI turbo y 2.9 biturbo: S4/S5 B9, RS4/RS5, SQ5
  | "EA825" // 4.0 TFSI V8 biturbo: RS6, RS7, SQ7, RS Q8, Touareg R
  | "V8-FSI" // 4.2 FSI atmosférico: RS4 B8, RS5 8T, Q7 4L
  // Diésel common rail anterior al EA288.
  | "EA189"
  | "EA189-16"
  // Diésel de seis y ocho cilindros.
  | "EA897" // 3.0 TDI V6
  | "EA824" // 4.0 TDI V8
  // Tracciones eléctricas. Cada una es una arquitectura distinta, no una variante.
  | "MEB"
  | "PPE"
  | "J1";

/**
 * Plataforma de chasis. Es ortogonal al motor: un Golf 8 GTI y un Tiguan Mk3
 * comparten motor y no comparten ni un brazo de suspensión.
 */
export type Chasis =
  | "A2"
  | "PQ24"
  | "PQ25"
  | "PQ34"
  | "PQ35"
  | "PQ46"
  | "NSF"
  | "MQB"
  | "MQB-A0"
  | "MQB Evo"
  // Longitudinales de Audi. Nada de lo transversal les vale.
  | "MLB"
  | "MLB Evo"
  | "PL71"
  // Eléctricas.
  | "MEB"
  | "PPE"
  | "J1";

/** `mhev` es la hibridación ligera de 48 V, que condiciona gestión y alternador. */
export type Propulsion = "combustion" | "mhev" | "phev" | "bev";

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
  | "dpf" // filtro de partículas diésel
  | "magnetic-ride" // amortiguación magnetorreológica de Audi, el equivalente al DCC
  | "haldex" // tracción total Haldex transversal
  | "torsen" // quattro longitudinal permanente
  | "act" // desactivación de cilindros
  | "scr-adblue" // postratamiento diésel con AdBlue
  | "hibridacion-48v" // red de 48 V
  | "suspension-neumatica" // neumática de serie
  | "frenos-ceramicos"; // discos carbono-cerámicos de fábrica

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

/** `trasera` existe por los eléctricos: el ID.3, el Born y el Enyaq de acceso lo son. */
export type Traccion = "delantera" | "trasera" | "total";

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
