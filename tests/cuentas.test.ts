// Cuentas, contraseñas y sesiones.
//
// Lo que se protege aquí no es que el registro funcione, que es lo fácil, sino las
// propiedades que hacen que un fallo no se convierta en una filtración: que la
// contraseña no se guarde nunca, que dos iguales no compartan huella, y que el token de
// sesión no esté en la base tal cual.

import { describe, expect, it } from "vitest";
import { cifrar, comprobar, correoValido, problemaCon } from "../src/auth/contrasenas.ts";
import {
  abrirSesion,
  autenticar,
  cerrarSesion,
  limpiarSesiones,
  registrar,
  usuarioDe,
} from "../src/auth/cuentas.ts";
import { abrirBase } from "../src/db/sqlite.ts";

const CORREO = "taller@jondasiviz.es";
const CLAVE = "una-contrasena-larga";

describe("contraseñas", () => {
  it("no guarda la contraseña en ningún sitio", async () => {
    const guardada = await cifrar(CLAVE);
    expect(guardada.huella).not.toContain(CLAVE);
    expect(guardada.sal).not.toContain(CLAVE);
  });

  it("dos contraseñas iguales dan huellas distintas", async () => {
    const una = await cifrar(CLAVE);
    const otra = await cifrar(CLAVE);
    // Si salieran iguales, la base delataría quién comparte contraseña con quién.
    expect(una.huella).not.toBe(otra.huella);
  });

  it("reconoce la buena y rechaza la mala", async () => {
    const guardada = await cifrar(CLAVE);
    expect(await comprobar(CLAVE, guardada)).toBe(true);
    expect(await comprobar(CLAVE + "x", guardada)).toBe(false);
  });

  it("exige una longitud mínima", () => {
    expect(problemaCon("corta")).not.toBeNull();
    expect(problemaCon(CLAVE)).toBeNull();
  });

  it("filtra correos que no lo son", () => {
    expect(correoValido("alguien@taller.es")).toBe(true);
    expect(correoValido("alguien-arroba-taller")).toBe(false);
  });
});

describe("cuentas", () => {
  it("registra y deja entrar", async () => {
    const base = abrirBase(":memory:");
    const alta = await registrar(base, CORREO, CLAVE);
    expect(alta.ok).toBe(true);

    expect(await autenticar(base, CORREO, CLAVE)).not.toBeNull();
    expect(await autenticar(base, CORREO, "otra-cosa")).toBeNull();
    expect(await autenticar(base, "nadie@jondasiviz.es", CLAVE)).toBeNull();
  });

  it("no deja registrar el mismo correo dos veces, ni cambiando mayúsculas", async () => {
    const base = abrirBase(":memory:");
    await registrar(base, CORREO, CLAVE);

    const repetido = await registrar(base, CORREO, CLAVE);
    expect(repetido.ok).toBe(false);

    const conMayusculas = await registrar(base, "Taller@JondaSiviz.es", CLAVE);
    expect(conMayusculas.ok).toBe(false);
  });

  it("deja entrar aunque el correo venga con otras mayúsculas", async () => {
    const base = abrirBase(":memory:");
    await registrar(base, CORREO, CLAVE);
    expect(await autenticar(base, "TALLER@jondasiviz.es", CLAVE)).not.toBeNull();
  });

  it("empieza sin suscripción", async () => {
    const base = abrirBase(":memory:");
    const alta = await registrar(base, CORREO, CLAVE);
    if (!alta.ok) throw new Error("no se registró");

    const fila = base
      .prepare("SELECT estado FROM suscripcion WHERE usuario_id = ?")
      .get(alta.usuario.id) as { estado: string };
    expect(fila.estado).toBe("ninguna");
  });
});

describe("sesiones", () => {
  it("el token no se guarda tal cual en la base", async () => {
    const base = abrirBase(":memory:");
    const alta = await registrar(base, CORREO, CLAVE);
    if (!alta.ok) throw new Error("no se registró");

    const sesion = abrirSesion(base, alta.usuario.id);
    const guardado = base.prepare("SELECT huella_token FROM sesion").get() as {
      huella_token: string;
    };

    // Quien lea la tabla no puede suplantar a nadie con lo que hay dentro.
    expect(guardado.huella_token).not.toBe(sesion.token);
    expect(usuarioDe(base, sesion.token)?.id).toBe(alta.usuario.id);
  });

  it("un token inventado no vale", async () => {
    const base = abrirBase(":memory:");
    expect(usuarioDe(base, "me-lo-acabo-de-inventar")).toBeNull();
    expect(usuarioDe(base, undefined)).toBeNull();
  });

  it("al salir, el token deja de servir", async () => {
    const base = abrirBase(":memory:");
    const alta = await registrar(base, CORREO, CLAVE);
    if (!alta.ok) throw new Error("no se registró");

    const sesion = abrirSesion(base, alta.usuario.id);
    cerrarSesion(base, sesion.token);
    expect(usuarioDe(base, sesion.token)).toBeNull();
  });

  it("una sesión caducada no deja entrar y se limpia sola", async () => {
    const base = abrirBase(":memory:");
    const alta = await registrar(base, CORREO, CLAVE);
    if (!alta.ok) throw new Error("no se registró");

    const sesion = abrirSesion(base, alta.usuario.id);

    // Se envejece a mano en la base, que es más honesto que falsear el reloj.
    base
      .prepare("UPDATE sesion SET caduca = ?")
      .run(new Date(Date.now() - 1000).toISOString());

    expect(usuarioDe(base, sesion.token)).toBeNull();
    expect(base.prepare("SELECT COUNT(*) AS n FROM sesion").get()).toEqual({ n: 0 });
  });

  it("limpiarSesiones se lleva las caducadas y respeta las vivas", async () => {
    const base = abrirBase(":memory:");
    const alta = await registrar(base, CORREO, CLAVE);
    if (!alta.ok) throw new Error("no se registró");

    abrirSesion(base, alta.usuario.id);
    const viva = abrirSesion(base, alta.usuario.id);
    base
      .prepare("UPDATE sesion SET caduca = ? WHERE huella_token != (SELECT huella_token FROM sesion LIMIT 1)")
      .run(new Date(Date.now() + 86400_000).toISOString());

    limpiarSesiones(base);
    expect(usuarioDe(base, viva.token)).not.toBeNull();
  });

  it("al borrar el usuario se van sus sesiones", async () => {
    const base = abrirBase(":memory:");
    const alta = await registrar(base, CORREO, CLAVE);
    if (!alta.ok) throw new Error("no se registró");

    const sesion = abrirSesion(base, alta.usuario.id);
    base.prepare("DELETE FROM usuario WHERE id = ?").run(alta.usuario.id);

    // Lo hace la clave foránea con ON DELETE CASCADE, no el código.
    expect(usuarioDe(base, sesion.token)).toBeNull();
  });
});
