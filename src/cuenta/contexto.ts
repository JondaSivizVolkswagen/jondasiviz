// El contexto en sí, aparte de `CuentaContext.tsx`. No exporta ningún componente, así
// que puede vivir en el mismo fichero que sus tipos sin que el refresco en caliente de
// Vite se resienta.

import { createContext } from "react";
import type { Limites, Perfil, Plan, Precio, Suscripcion, Usuario } from "./api";

export type Modal =
  | null
  | { tipo: "acceso"; modo: "entrar" | "registro"; aviso?: string }
  | { tipo: "suscripcion"; motivo: string | null }
  | { tipo: "perfil" };

export interface EstadoCuenta {
  cargando: boolean;
  disponibleApi: boolean;
  usuario: Usuario | null;
  perfil: Perfil | null;
  plan: Plan;
  limites: Limites;
  suscripcion: Suscripcion | null;
  planesHoy: number;
  precio: Precio;
}

export interface ValorCuenta extends EstadoCuenta {
  entrar(correo: string, contrasena: string): Promise<string | null>;
  registrar(
    correo: string,
    contrasena: string,
    datos?: { nombre?: string; coche?: string },
  ): Promise<string | null>;
  salir(): Promise<void>;
  refrescar(): Promise<void>;
  modal: Modal;
  abrirAcceso(modo?: "entrar" | "registro", aviso?: string): void;
  abrirSuscripcion(motivo?: string | null): void;
  abrirPerfil(): void;
  cerrarModal(): void;
}

export const CuentaContexto = createContext<ValorCuenta | null>(null);
