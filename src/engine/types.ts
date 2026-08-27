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
  stage?: Stage;
  nota?: string;
}

export interface Catalogo {
  version: string;
  moneda: string;
  piezas: Pieza[];
}

export interface PeticionPresupuesto {
  plataforma: Plataforma;
  gama: Gama;
  presupuesto: number;
  objetivo: Objetivo;
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
