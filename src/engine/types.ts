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
  gama: Gama;
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
  siguientesMejoras: MejoraSugerida[];
  avisos: string[];
}
