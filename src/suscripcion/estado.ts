// Lectura y escritura del estado de suscripción y del uso diario.
//
// El estado solo lo cambia el webhook de la pasarela, nunca una petición que venga del
// navegador. Es la diferencia entre cobrar y regalar: si el cliente pudiera decir "ya he
// pagado", bastaría con abrir las herramientas del navegador para suscribirse gratis.

import type { BaseDatos } from "../db/sqlite.ts";
import type { EstadoSuscripcion, Plan } from "./planes.ts";
import { limitesDe, planDe, type Limites } from "./planes.ts";

export interface Suscripcion {
  estado: EstadoSuscripcion;
  proveedor: string;
  referencia: string | null;
  renueva: string | null;
}

export interface Acceso {
  plan: Plan;
  limites: Limites;
  suscripcion: Suscripcion;
  planesHoy: number;
}

export function leerSuscripcion(base: BaseDatos, usuarioId: string): Suscripcion {
  const fila = base
    .prepare("SELECT estado, proveedor, referencia, renueva FROM suscripcion WHERE usuario_id = ?")
    .get(usuarioId) as Suscripcion | undefined;

  return fila ?? { estado: "ninguna", proveedor: "ninguno", referencia: null, renueva: null };
}

/** Todo lo que la API necesita para decidir si deja pasar una petición. */
export function accesoDe(base: BaseDatos, usuarioId: string): Acceso {
  const suscripcion = leerSuscripcion(base, usuarioId);
  return {
    plan: planDe(suscripcion.estado),
    limites: limitesDe(suscripcion.estado),
    suscripcion,
    planesHoy: planesHoy(base, usuarioId),
  };
}

/**
 * Deja constancia del estado que manda la pasarela. Lo llama el webhook.
 *
 * @param referencia Identificador de la suscripción en la pasarela, para poder cruzarla.
 */
export function anotarSuscripcion(
  base: BaseDatos,
  usuarioId: string,
  estado: EstadoSuscripcion,
  proveedor: string,
  referencia: string | null = null,
  renueva: string | null = null,
): void {
  base
    .prepare(
      `INSERT INTO suscripcion (usuario_id, estado, proveedor, referencia, renueva, actualizada)
            VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(usuario_id) DO UPDATE SET
            estado      = excluded.estado,
            proveedor   = excluded.proveedor,
            referencia  = excluded.referencia,
            renueva     = excluded.renueva,
            actualizada = excluded.actualizada`,
    )
    .run(usuarioId, estado, proveedor, referencia, renueva, new Date().toISOString());
}

/** Quién tiene esta referencia de la pasarela. Lo usa el webhook para saber a quién tocar. */
export function usuarioPorReferencia(base: BaseDatos, referencia: string): string | null {
  const fila = base
    .prepare("SELECT usuario_id FROM suscripcion WHERE referencia = ?")
    .get(referencia) as { usuario_id: string } | undefined;
  return fila?.usuario_id ?? null;
}

export function planesHoy(base: BaseDatos, usuarioId: string): number {
  const fila = base
    .prepare("SELECT planes FROM uso_diario WHERE usuario_id = ? AND dia = ?")
    .get(usuarioId, hoy()) as { planes: number } | undefined;
  return fila?.planes ?? 0;
}

export function apuntarPlan(base: BaseDatos, usuarioId: string): void {
  base
    .prepare(
      `INSERT INTO uso_diario (usuario_id, dia, planes) VALUES (?, ?, 1)
       ON CONFLICT(usuario_id, dia) DO UPDATE SET planes = planes + 1`,
    )
    .run(usuarioId, hoy());
}

/** El día en formato AAAA-MM-DD, en horario universal para que el corte sea el mismo para todos. */
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}
