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
  ciudad?: string;
  sobreMi?: string;
  /** Data URI de la foto, o cadena vacía para quitarla. */
  foto?: string;
}

export interface Perfil {
  id: string;
  correo: string;
  nombre: string;
  coche: string;
  ciudad: string;
  sobreMi: string;
  foto: string;
  alta: string;
  visto: string | null;
}

const LARGO_NOMBRE = 60;
const LARGO_CIUDAD = 60;
const LARGO_SOBRE_MI = 280;

/**
 * Tope de la foto. La reduce el navegador antes de mandarla, así que con esto sobra de
 * largo para un cuadrado de 256 píxeles. El límite está aquí igualmente porque nunca se
 * confía en lo que manda el cliente: sin él, cualquiera podría llenar la base subiendo
 * imágenes enormes.
 */
const MAXIMO_FOTO = 256 * 1024;

const FORMATOS_FOTO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** Motivo por el que una foto no vale, o null si vale. */
function problemaConFoto(foto: string): string | null {
  if (foto === "") return null; // quitarla siempre vale
  if (!FORMATOS_FOTO.test(foto)) {
    return "La foto tiene que ser PNG, JPEG o WEBP.";
  }
  if (foto.length > MAXIMO_FOTO) {
    return "La foto pesa demasiado. Prueba con una más pequeña.";
  }
  return null;
}

export async function leerPerfil(base: BaseDatos, usuarioId: string): Promise<Perfil | null> {
  return base.uno<Perfil>(
    `SELECT id, correo, nombre, coche, ciudad, sobre_mi AS sobreMi, foto, alta, visto
       FROM usuario WHERE id = ?`,
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
  const ciudad = (cambios.ciudad ?? perfil.ciudad).trim();
  const sobreMi = (cambios.sobreMi ?? perfil.sobreMi).trim();
  const foto = cambios.foto ?? perfil.foto;

  if (nombre.length > LARGO_NOMBRE) {
    return { ok: false, motivo: `El nombre no puede pasar de ${LARGO_NOMBRE} caracteres.` };
  }
  if (ciudad.length > LARGO_CIUDAD) {
    return { ok: false, motivo: `La ciudad no puede pasar de ${LARGO_CIUDAD} caracteres.` };
  }
  if (sobreMi.length > LARGO_SOBRE_MI) {
    return { ok: false, motivo: `El texto no puede pasar de ${LARGO_SOBRE_MI} caracteres.` };
  }
  const problemaFoto = problemaConFoto(foto);
  if (problemaFoto) return { ok: false, motivo: problemaFoto };

  await base.ejecutar(
    "UPDATE usuario SET nombre = ?, coche = ?, ciudad = ?, sobre_mi = ?, foto = ? WHERE id = ?",
    [nombre, coche, ciudad, sobreMi, foto, usuarioId],
  );
  return { ok: true, perfil: { ...perfil, nombre, coche, ciudad, sobreMi, foto } };
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
