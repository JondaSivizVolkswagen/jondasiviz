// Cuentas y sesiones.
//
// El token de sesión se genera aleatorio y se le entrega al navegador, pero en la base
// solo se guarda su huella SHA-256. Si alguien lee la tabla no puede suplantar a nadie,
// porque de una huella no se saca el token. Es el mismo criterio que con las
// contraseñas, y por eso el token se busca por su huella y no por él mismo.

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { BaseDatos } from "../db/sqlite.ts";
import { cifrar, comprobar } from "./contrasenas.ts";

/** Cuánto dura una sesión sin volver a entrar. */
const DIAS_SESION = 30;

export interface Usuario {
  id: string;
  correo: string;
  alta: string;
}

export interface Sesion {
  token: string;
  caduca: string;
}

export type ResultadoAlta =
  | { ok: true; usuario: Usuario }
  | { ok: false; motivo: string };

export async function registrar(
  base: BaseDatos,
  correo: string,
  contrasena: string,
  datos: { nombre?: string; coche?: string } = {},
): Promise<ResultadoAlta> {
  const limpio = correo.trim().toLowerCase();

  const yaEsta = await base.uno<{ id: string }>(
    "SELECT id FROM usuario WHERE lower(correo) = ?",
    [limpio],
  );

  if (yaEsta) {
    // Se dice que ya existe porque el formulario de registro lo necesita para ser
    // usable. Lo que no se hace nunca es decirlo en el inicio de sesión, donde delataría
    // qué correos están dados de alta.
    return { ok: false, motivo: "Ya hay una cuenta con ese correo." };
  }

  const { huella, sal } = await cifrar(contrasena);
  const id = randomUUID();
  const alta = new Date().toISOString();

  await base.ejecutar(
    `INSERT INTO usuario (id, correo, huella, sal, alta, nombre, coche)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, limpio, huella, sal, alta, (datos.nombre ?? "").trim(), (datos.coche ?? "").trim()],
  );

  await base.ejecutar(
    `INSERT INTO suscripcion (usuario_id, estado, proveedor, actualizada)
     VALUES (?, 'ninguna', 'ninguno', ?)`,
    [id, alta],
  );

  return { ok: true, usuario: { id, correo: limpio, alta } };
}

/**
 * Comprueba unas credenciales. Devuelve null tanto si el correo no existe como si la
 * contraseña falla: distinguirlo permitiría averiguar qué correos tienen cuenta.
 */
export async function autenticar(
  base: BaseDatos,
  correo: string,
  contrasena: string,
): Promise<Usuario | null> {
  const fila = await base.uno<{
    id: string;
    correo: string;
    huella: string;
    sal: string;
    alta: string;
  }>("SELECT id, correo, huella, sal, alta FROM usuario WHERE lower(correo) = ?", [
    correo.trim().toLowerCase(),
  ]);

  if (!fila) return null;
  if (!(await comprobar(contrasena, { huella: fila.huella, sal: fila.sal }))) return null;

  return { id: fila.id, correo: fila.correo, alta: fila.alta };
}

export async function abrirSesion(base: BaseDatos, usuarioId: string): Promise<Sesion> {
  const token = randomBytes(32).toString("hex");
  const caduca = new Date(Date.now() + DIAS_SESION * 86400_000).toISOString();

  await base.ejecutar(
    "INSERT INTO sesion (huella_token, usuario_id, creada, caduca) VALUES (?, ?, ?, ?)",
    [huellaDe(token), usuarioId, new Date().toISOString(), caduca],
  );

  return { token, caduca };
}

/** Quién es el dueño de un token, o null si no vale o ya caducó. */
export async function usuarioDe(
  base: BaseDatos,
  token: string | undefined,
): Promise<Usuario | null> {
  if (!token) return null;

  const fila = await base.uno<{ id: string; correo: string; alta: string; caduca: string }>(
    `SELECT u.id, u.correo, u.alta, s.caduca
       FROM sesion s
       JOIN usuario u ON u.id = s.usuario_id
      WHERE s.huella_token = ?`,
    [huellaDe(token)],
  );

  if (!fila) return null;

  if (new Date(fila.caduca).getTime() < Date.now()) {
    await cerrarSesion(base, token);
    return null;
  }

  return { id: fila.id, correo: fila.correo, alta: fila.alta };
}

export async function cerrarSesion(base: BaseDatos, token: string): Promise<void> {
  await base.ejecutar("DELETE FROM sesion WHERE huella_token = ?", [huellaDe(token)]);
}

/** Tira las sesiones caducadas. La llama la API de vez en cuando. */
export async function limpiarSesiones(base: BaseDatos): Promise<number> {
  const antes = await base.uno<{ n: number }>("SELECT COUNT(*) AS n FROM sesion");
  await base.ejecutar("DELETE FROM sesion WHERE caduca < ?", [new Date().toISOString()]);
  const despues = await base.uno<{ n: number }>("SELECT COUNT(*) AS n FROM sesion");
  return Number(antes?.n ?? 0) - Number(despues?.n ?? 0);
}

function huellaDe(token: string): string {
  // SHA-256 a secas basta aquí, al revés que con las contraseñas: el token son 32 bytes
  // aleatorios, no algo que alguien pueda adivinar probando.
  return createHash("sha256").update(token).digest("hex");
}
