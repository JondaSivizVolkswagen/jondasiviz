// El contexto en sí, aparte de `CuentaContext.tsx`. No exporta ningún componente, así
// que puede vivir en el mismo fichero que sus tipos sin que el refresco en caliente de
// Vite se resienta.

import { createContext } from "react";
import type { Limites, Plan, Precio, Suscripcion, Usuario } from "./api";

export type Modal =
  | null
  | { tipo: "acceso"; modo: "entrar" | "registro" }
  | { tipo: "suscripcion"; motivo: string | null };

export interface EstadoCuenta {
  cargando: boolean;
  disponibleApi: boolean;
  usuario: Usuario | null;
  plan: Plan;
  limites: Limites;
  suscripcion: Suscripcion | null;
  planesHoy: number;
  precio: Precio;
}

export interface ValorCuenta extends EstadoCuenta {
  entrar(correo: string, contrasena: string): Promise<string | null>;
  registrar(correo: string, contrasena: string): Promise<string | null>;
  salir(): Promise<void>;
  refrescar(): Promise<void>;
  modal: Modal;
  abrirAcceso(modo?: "entrar" | "registro"): void;
  abrirSuscripcion(motivo?: string | null): void;
  cerrarModal(): void;
}

export const CuentaContexto = createContext<ValorCuenta | null>(null);
