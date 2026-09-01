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

const SIN_SUSCRIPCION: Suscripcion = {
  estado: "ninguna",
  proveedor: "ninguno",
  referencia: null,
  renueva: null,
};

export async function leerSuscripcion(base: BaseDatos, usuarioId: string): Promise<Suscripcion> {
  const fila = await base.uno<Suscripcion>(
    "SELECT estado, proveedor, referencia, renueva FROM suscripcion WHERE usuario_id = ?",
    [usuarioId],
  );
  return fila ?? SIN_SUSCRIPCION;
}

/** Todo lo que la API necesita para decidir si deja pasar una petición. */
export async function accesoDe(base: BaseDatos, usuarioId: string): Promise<Acceso> {
  const [suscripcion, hoy] = await Promise.all([
    leerSuscripcion(base, usuarioId),
    planesHoy(base, usuarioId),
  ]);

  return {
    plan: planDe(suscripcion.estado),
    limites: limitesDe(suscripcion.estado),
    suscripcion,
    planesHoy: hoy,
  };
}

/**
 * Deja constancia del estado que manda la pasarela. Lo llama el webhook.
 *
 * @param referencia Identificador de la suscripción en la pasarela, para poder cruzarla.
 */
export async function anotarSuscripcion(
  base: BaseDatos,
  usuarioId: string,
  estado: EstadoSuscripcion,
  proveedor: string,
  referencia: string | null = null,
  renueva: string | null = null,
): Promise<void> {
  await base.ejecutar(
    `INSERT INTO suscripcion (usuario_id, estado, proveedor, referencia, renueva, actualizada)
          VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(usuario_id) DO UPDATE SET
          estado      = excluded.estado,
          proveedor   = excluded.proveedor,
          referencia  = excluded.referencia,
          renueva     = excluded.renueva,
          actualizada = excluded.actualizada`,
    [usuarioId, estado, proveedor, referencia, renueva, new Date().toISOString()],
  );
}

/** Quién tiene esta referencia de la pasarela. Lo usa el webhook para saber a quién tocar. */
export async function usuarioPorReferencia(
  base: BaseDatos,
  referencia: string,
): Promise<string | null> {
  const fila = await base.uno<{ usuario_id: string }>(
    "SELECT usuario_id FROM suscripcion WHERE referencia = ?",
    [referencia],
  );
  return fila?.usuario_id ?? null;
}

export async function planesHoy(base: BaseDatos, usuarioId: string): Promise<number> {
  const fila = await base.uno<{ planes: number }>(
    "SELECT planes FROM uso_diario WHERE usuario_id = ? AND dia = ?",
    [usuarioId, hoy()],
  );
  return Number(fila?.planes ?? 0);
}

export async function apuntarPlan(base: BaseDatos, usuarioId: string): Promise<void> {
  await base.ejecutar(
    `INSERT INTO uso_diario (usuario_id, dia, planes) VALUES (?, ?, 1)
     ON CONFLICT(usuario_id, dia) DO UPDATE SET planes = planes + 1`,
    [usuarioId, hoy()],
  );
}

/** El día en formato AAAA-MM-DD, en horario universal para que el corte sea el mismo para todos. */
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}
