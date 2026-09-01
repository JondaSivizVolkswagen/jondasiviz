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
): Promise<ResultadoAlta> {
  const limpio = correo.trim().toLowerCase();

  const yaEsta = base
    .prepare("SELECT id FROM usuario WHERE lower(correo) = ?")
    .get(limpio) as { id: string } | undefined;

  if (yaEsta) {
    // Se dice que ya existe porque el formulario de registro lo necesita para ser
    // usable. Lo que no se hace nunca es decirlo en el inicio de sesión, donde delataría
    // qué correos están dados de alta.
    return { ok: false, motivo: "Ya hay una cuenta con ese correo." };
  }

  const { huella, sal } = await cifrar(contrasena);
  const id = randomUUID();
  const alta = new Date().toISOString();

  base
    .prepare("INSERT INTO usuario (id, correo, huella, sal, alta) VALUES (?, ?, ?, ?, ?)")
    .run(id, limpio, huella, sal, alta);

  base
    .prepare(
      `INSERT INTO suscripcion (usuario_id, estado, proveedor, actualizada)
       VALUES (?, 'ninguna', 'ninguno', ?)`,
    )
    .run(id, alta);

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
  const fila = base
    .prepare("SELECT id, correo, huella, sal, alta FROM usuario WHERE lower(correo) = ?")
    .get(correo.trim().toLowerCase()) as
    | { id: string; correo: string; huella: string; sal: string; alta: string }
    | undefined;

  if (!fila) return null;
  if (!(await comprobar(contrasena, { huella: fila.huella, sal: fila.sal }))) return null;

  return { id: fila.id, correo: fila.correo, alta: fila.alta };
}

export function abrirSesion(base: BaseDatos, usuarioId: string): Sesion {
  const token = randomBytes(32).toString("hex");
  const caduca = new Date(Date.now() + DIAS_SESION * 86400_000).toISOString();

  base
    .prepare(
      "INSERT INTO sesion (huella_token, usuario_id, creada, caduca) VALUES (?, ?, ?, ?)",
    )
    .run(huellaDe(token), usuarioId, new Date().toISOString(), caduca);

  return { token, caduca };
}

/** Quién es el dueño de un token, o null si no vale o ya caducó. */
export function usuarioDe(base: BaseDatos, token: string | undefined): Usuario | null {
  if (!token) return null;

  const fila = base
    .prepare(
      `SELECT u.id, u.correo, u.alta, s.caduca
         FROM sesion s
         JOIN usuario u ON u.id = s.usuario_id
        WHERE s.huella_token = ?`,
    )
    .get(huellaDe(token)) as
    | { id: string; correo: string; alta: string; caduca: string }
    | undefined;

  if (!fila) return null;

  if (new Date(fila.caduca).getTime() < Date.now()) {
    cerrarSesion(base, token);
    return null;
  }

  return { id: fila.id, correo: fila.correo, alta: fila.alta };
}

export function cerrarSesion(base: BaseDatos, token: string): void {
  base.prepare("DELETE FROM sesion WHERE huella_token = ?").run(huellaDe(token));
}

/** Tira las sesiones caducadas. La llama la API de vez en cuando. */
export function limpiarSesiones(base: BaseDatos): number {
  const antes = base.prepare("SELECT COUNT(*) AS n FROM sesion").get() as { n: number };
  base.prepare("DELETE FROM sesion WHERE caduca < ?").run(new Date().toISOString());
  const despues = base.prepare("SELECT COUNT(*) AS n FROM sesion").get() as { n: number };
  return antes.n - despues.n;
}

function huellaDe(token: string): string {
  // SHA-256 a secas basta aquí, al revés que con las contraseñas: el token son 32 bytes
  // aleatorios, no algo que alguien pueda adivinar probando.
  return createHash("sha256").update(token).digest("hex");
}
