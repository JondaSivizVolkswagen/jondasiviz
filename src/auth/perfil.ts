// El perfil: leerlo, cambiarlo, cambiar la contraseña, llevarse los datos y borrarse.
//
// Las tres últimas no son adorno. Desde que se guardan datos personales, el RGPD da
// derecho a acceder a ellos, llevárselos y que los borren, así que la aplicación tiene
// que poder hacerlo sin que nadie entre a la base a mano.

import { randomUUID } from "node:crypto";
import type { BaseDatos } from "../db/sqlite.ts";
import { cifrar, comprobar, problemaCon } from "./contrasenas.ts";

/** Lo que se puede cambiar del perfil. Lo que no está aquí, no se toca. */
export interface CamposEditables {
  nombre?: string;
  coche?: string;
}

export interface Perfil {
  id: string;
  correo: string;
  nombre: string;
  coche: string;
  alta: string;
  visto: string | null;
}

const LARGO_NOMBRE = 60;

export async function leerPerfil(base: BaseDatos, usuarioId: string): Promise<Perfil | null> {
  return base.uno<Perfil>(
    "SELECT id, correo, nombre, coche, alta, visto FROM usuario WHERE id = ?",
    [usuarioId],
  );
}

export type ResultadoPerfil = { ok: true; perfil: Perfil } | { ok: false; motivo: string };

export async function guardarPerfil(
  base: BaseDatos,
  usuarioId: string,
  cambios: CamposEditables,
): Promise<ResultadoPerfil> {
  const perfil = await leerPerfil(base, usuarioId);
  if (!perfil) return { ok: false, motivo: "Esa cuenta ya no existe." };

  const nombre = (cambios.nombre ?? perfil.nombre).trim();
  const coche = (cambios.coche ?? perfil.coche).trim();

  if (nombre.length > LARGO_NOMBRE) {
    return { ok: false, motivo: `El nombre no puede pasar de ${LARGO_NOMBRE} caracteres.` };
  }

  await base.ejecutar("UPDATE usuario SET nombre = ?, coche = ? WHERE id = ?", [
    nombre,
    coche,
    usuarioId,
  ]);
  return { ok: true, perfil: { ...perfil, nombre, coche } };
}

/** Deja constancia de la última vez que entró. */
export async function marcarVisto(base: BaseDatos, usuarioId: string): Promise<void> {
  await base.ejecutar("UPDATE usuario SET visto = ? WHERE id = ?", [
    new Date().toISOString(),
    usuarioId,
  ]);
}

/**
 * Cambia la contraseña. Exige la actual aunque haya sesión abierta: si alguien se
 * encuentra un ordenador desbloqueado, sin esto se queda con la cuenta.
 */
export async function cambiarContrasena(
  base: BaseDatos,
  usuarioId: string,
  actual: string,
  nueva: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const fila = await base.uno<{ huella: string; sal: string }>(
    "SELECT huella, sal FROM usuario WHERE id = ?",
    [usuarioId],
  );

  if (!fila) return { ok: false, motivo: "Esa cuenta ya no existe." };
  if (!(await comprobar(actual, fila))) {
    return { ok: false, motivo: "La contraseña actual no es correcta." };
  }

  const problema = problemaCon(nueva);
  if (problema) return { ok: false, motivo: problema };

  const { huella, sal } = await cifrar(nueva);
  await base.ejecutar("UPDATE usuario SET huella = ?, sal = ? WHERE id = ?", [
    huella,
    sal,
    usuarioId,
  ]);

  // Se tiran todas las sesiones: si la contraseña se cambia porque alguien la sabía,
  // dejarle la sesión abierta no arregla nada. Quien la cambia vuelve a entrar.
  await base.ejecutar("DELETE FROM sesion WHERE usuario_id = ?", [usuarioId]);
  return { ok: true };
}

/**
 * Todo lo que la aplicación guarda de una persona, para que pueda llevárselo. Es el
 * derecho de acceso y portabilidad del RGPD.
 *
 * No incluye la huella de la contraseña ni las de sus sesiones: no son datos suyos que
 * le sirvan de nada y publicarlos solo da material a quien quiera atacarle.
 */
export async function exportarDatos(
  base: BaseDatos,
  usuarioId: string,
): Promise<Record<string, unknown> | null> {
  const perfil = await leerPerfil(base, usuarioId);
  if (!perfil) return null;

  const [suscripcion, uso, sesiones] = await Promise.all([
    base.uno(
      "SELECT estado, proveedor, renueva, actualizada FROM suscripcion WHERE usuario_id = ?",
      [usuarioId],
    ),
    base.todos("SELECT dia, planes FROM uso_diario WHERE usuario_id = ? ORDER BY dia", [usuarioId]),
    base.todos("SELECT creada, caduca FROM sesion WHERE usuario_id = ? ORDER BY creada", [
      usuarioId,
    ]),
  ]);

  return {
    generado: new Date().toISOString(),
    perfil,
    suscripcion,
    usoPorDia: uso,
    sesionesAbiertas: sesiones,
  };
}

/**
 * Borra la cuenta y todo lo que cuelga de ella. Exige la contraseña porque no tiene
 * vuelta atrás.
 *
 * Las sesiones, la suscripción y el uso se van solos por las claves foráneas con
 * ON DELETE CASCADE: lo hace la base, no un bucle que se puede olvidar de una tabla.
 */
export async function borrarCuenta(
  base: BaseDatos,
  usuarioId: string,
  contrasena: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const fila = await base.uno<{ huella: string; sal: string }>(
    "SELECT huella, sal FROM usuario WHERE id = ?",
    [usuarioId],
  );

  if (!fila) return { ok: false, motivo: "Esa cuenta ya no existe." };
  if (!(await comprobar(contrasena, fila))) {
    return { ok: false, motivo: "La contraseña no es correcta." };
  }

  await base.ejecutar("DELETE FROM usuario WHERE id = ?", [usuarioId]);
  return { ok: true };
}

/** Identificador nuevo de usuario. Aquí para que solo haya una forma de crearlos. */
export function nuevoId(): string {
  return randomUUID();
}
