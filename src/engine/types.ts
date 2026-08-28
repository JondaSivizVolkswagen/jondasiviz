// Tipos del dominio: catálogo de piezas y motor de presupuesto.

export type Plataforma = "1.8T-20v" | "EA113" | "EA888" | "VR6" | "TDI";

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
  /** Plataforma de chasis (PQ35, MQB, ...). Informativo por ahora. */
  chasis: string;
  /** Plataforma de motor, la que enlaza con las piezas del catálogo. */
  motor: Plataforma;
  motorDetalle: string;
  traccion: Traccion;
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
  /**
   * Ids de piezas que ha elegido el comprador a mano. Entran antes que nada y bloquean
   * su grupo, así que el motor ya no decide por él en esa parte del coche. Lo que no
   * elija sigue eligiéndolo el motor.
   */
  elecciones?: string[];
}

export type MotivoLinea = "elegida" | "esencial" | "valor" | "dependencia";

/**
 * Una parte del coche con varias alternativas entre las que se puede elegir: el grupo
 * exclusivo y las piezas compatibles que caen dentro. Es lo que alimenta el selector
 * de piezas del formulario.
 */
export interface GrupoElegible {
  /** El `grupoExclusivo` que comparten. */
  grupo: string;
  /** Nombre legible del grupo, para enseñarlo. */
  nombre: string;
  categoria: Categoria;
  /** Alternativas compatibles con el coche, de más barata a más cara. */
  piezas: Pieza[];
}

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
  /** Cuánto dinero extra haría falta sobre el sobrante actual. */
  falta: number;
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
