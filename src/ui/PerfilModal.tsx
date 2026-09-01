// El perfil: datos, plan, contraseña y, aparte y abajo, exportar y borrar la cuenta.
//
// Entra por la misma puerta que el acceso y la suscripción, un modal, así que no hace
// falta una ruta nueva ni un router. Lo abre el correo de la barra.
//
// A quien lo monta (App.tsx) le toca no renderizarlo mientras no está abierto: así cada
// apertura arranca de cero, sin un "Borrar la cuenta" a medias de la vez anterior.

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { listarModelos } from "../engine/graph";
import { useCuenta } from "../cuenta/useCuenta";
import {
  actualizarPerfil,
  borrarCuenta,
  cambiarContrasena,
  cancelarSuscripcion,
  RUTA_MIS_DATOS,
} from "../cuenta/api";
import { abrirEnNavegador, enEscritorio } from "./entorno";
import { Modal } from "./Modal";
import { SelectorCoche } from "./SelectorCoche";

const CONFIRMACION_BORRADO = "BORRAR";

function fecha(iso: string | null | undefined): string {
  if (!iso) return "todavía no ha vuelto";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export function PerfilModal() {
  const cuenta = useCuenta();
  const {
    cerrarModal,
    usuario,
    perfil,
    plan,
    limites,
    suscripcion,
    planesHoy,
    abrirSuscripcion,
    abrirAcceso,
    salir,
    refrescar,
  } = cuenta;
  const modelos = useMemo(() => listarModelos(), []);

  const [nombre, setNombre] = useState(perfil?.nombre ?? "");
  const [coche, setCoche] = useState(perfil?.coche ?? "");
  const [guardando, setGuardando] = useState(false);
  const [avisoDatos, setAvisoDatos] = useState<string | null>(null);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [cambiando, setCambiando] = useState(false);
  const [errorContrasena, setErrorContrasena] = useState<string | null>(null);

  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelacion, setErrorCancelacion] = useState<string | null>(null);
  const [avisoCancelacion, setAvisoCancelacion] = useState<string | null>(null);

  const [borrarAbierto, setBorrarAbierto] = useState(false);
  const [contrasenaBorrado, setContrasenaBorrado] = useState("");
  const [confirmacionBorrado, setConfirmacionBorrado] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null);

  if (!usuario) return null;

  const guardarDatos = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setErrorDatos(null);
    setAvisoDatos(null);
    const resultado = await actualizarPerfil({ nombre: nombre.trim(), coche });
    setGuardando(false);
    if (!resultado.ok) {
      setErrorDatos(resultado.error);
      return;
    }
    await refrescar();
    setAvisoDatos("Guardado.");
  };

  const enviarContrasena = async (e: FormEvent) => {
    e.preventDefault();
    setErrorContrasena(null);
    if (nueva !== repetir) {
      setErrorContrasena("La contraseña nueva no es igual en los dos campos.");
      return;
    }
    setCambiando(true);
    const resultado = await cambiarContrasena(actual, nueva);
    setCambiando(false);
    if (!resultado.ok) {
      setErrorContrasena(resultado.error);
      return;
    }
    await salir();
    abrirAcceso("entrar", resultado.datos.aviso);
  };

  const confirmarCancelar = async () => {
    setCancelando(true);
    setErrorCancelacion(null);
    const resultado = await cancelarSuscripcion();
    setCancelando(false);
    if (!resultado.ok) {
      setErrorCancelacion(resultado.error);
      return;
    }
    setConfirmandoCancelacion(false);
    await refrescar();
    setAvisoCancelacion(
      resultado.datos.hasta
        ? `No se renueva. Sigues con la herramienta completa hasta el ${fecha(resultado.datos.hasta)}.`
        : "Cancelada. Ya estás en el plan gratuito.",
    );
  };

  const descargarDatos = async () => {
    if (enEscritorio()) {
      await abrirEnNavegador(new URL(RUTA_MIS_DATOS, window.location.origin).toString());
    } else {
      window.location.href = RUTA_MIS_DATOS;
    }
  };

  const enviarBorrado = async (e: FormEvent) => {
    e.preventDefault();
    setErrorBorrado(null);
    if (confirmacionBorrado.trim().toUpperCase() !== CONFIRMACION_BORRADO) {
      setErrorBorrado(`Escribe ${CONFIRMACION_BORRADO} para confirmar que quieres borrarla.`);
      return;
    }
    setBorrando(true);
    const resultado = await borrarCuenta(contrasenaBorrado);
    setBorrando(false);
    if (!resultado.ok) {
      setErrorBorrado(resultado.error);
      return;
    }
    window.location.href = "/";
  };

  const suscrito = plan === "taller";
  const renueva = suscripcion?.renueva ?? null;

  return (
    <Modal eyebrow="Cuenta" titulo="Tu perfil" onCerrar={cerrarModal} ancho="grande">
      <div className="perfil">
        <section className="perfil-seccion">
          <p className="eyebrow">Datos</p>

          <form className="form-acceso" onSubmit={(e) => void guardarDatos(e)} noValidate>
            <div className="campo-acceso">
              <span>Correo</span>
              <p className="perfil-dato">{usuario.correo}</p>
            </div>

            <label className="campo-acceso" htmlFor="perfil-nombre">
              <span>Nombre</span>
              <input
                id="perfil-nombre"
                className="entrada"
                type="text"
                autoComplete="name"
                maxLength={60}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Como quieras que te llamemos"
              />
            </label>

            <label className="campo-acceso" htmlFor="perfil-coche">
              <span>Tu coche</span>
              <SelectorCoche id="perfil-coche" modelos={modelos} valor={coche} onValor={setCoche} />
            </label>

            <p className="campo-ayuda">
              Usuario desde el {fecha(perfil?.alta ?? usuario.alta)}. Última entrada:{" "}
              {fecha(perfil?.visto)}.
            </p>

            {errorDatos && (
              <p className="campo-error campo-error-general" role="alert">
                {errorDatos}
              </p>
            )}
            {avisoDatos && <p className="perfil-ok">{avisoDatos}</p>}

            <button type="submit" className="btn btn-rojo" disabled={guardando}>
              <span>{guardando ? "Guardando…" : "Guardar cambios"}</span>
            </button>
          </form>
        </section>

        <section className="perfil-seccion">
          <p className="eyebrow">Plan</p>

          <div className="perfil-plan">
            <span className={"chip" + (suscrito ? " chip-gama" : "")}>
              {suscrito ? "Taller" : "Gratis"}
            </span>
            <span className="perfil-plan-texto">
              {suscrito
                ? renueva
                  ? `Se renueva el ${fecha(renueva)}.`
                  : "No se va a renovar."
                : `Hoy llevas ${planesHoy} de ${limites.planesPorDia} presupuestos.`}
            </span>
          </div>

          {suscrito ? (
            confirmandoCancelacion ? (
              <div className="perfil-confirmar">
                <p>
                  Se cancela ahora mismo y no se te vuelve a cobrar.{" "}
                  {renueva
                    ? `Sigues con la herramienta completa hasta el ${fecha(renueva)}; después pasas al plan gratuito.`
                    : "Sigues con la herramienta completa hasta que acabe el periodo ya pagado."}
                </p>
                {errorCancelacion && (
                  <p className="campo-error" role="alert">
                    {errorCancelacion}
                  </p>
                )}
                <div className="perfil-confirmar-botones">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setConfirmandoCancelacion(false)}
                  >
                    <span>Seguir suscrito</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-rojo"
                    onClick={() => void confirmarCancelar()}
                    disabled={cancelando}
                  >
                    <span>{cancelando ? "Cancelando…" : "Sí, cancelar"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => setConfirmandoCancelacion(true)}>
                <span>Cancelar la suscripción</span>
              </button>
            )
          ) : (
            <button type="button" className="btn btn-sm" onClick={() => abrirSuscripcion(null)}>
              <span>Ver el plan de pago</span>
            </button>
          )}

          {avisoCancelacion && <p className="perfil-ok">{avisoCancelacion}</p>}
        </section>

        <section className="perfil-seccion">
          <p className="eyebrow">Contraseña</p>

          <form className="form-acceso" onSubmit={(e) => void enviarContrasena(e)} noValidate>
            <label className="campo-acceso" htmlFor="perfil-actual">
              <span>Actual</span>
              <input
                id="perfil-actual"
                className="entrada"
                type="password"
                autoComplete="current-password"
                required
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </label>

            <label className="campo-acceso" htmlFor="perfil-nueva">
              <span>Nueva</span>
              <input
                id="perfil-nueva"
                className="entrada"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
              />
            </label>

            <label className="campo-acceso" htmlFor="perfil-repetir">
              <span>Repite la nueva</span>
              <input
                id="perfil-repetir"
                className="entrada"
                type="password"
                autoComplete="new-password"
                required
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
              />
            </label>

            <p className="campo-ayuda">Al guardar se cierran todas las sesiones abiertas, también esta.</p>

            {errorContrasena && (
              <p className="campo-error campo-error-general" role="alert">
                {errorContrasena}
              </p>
            )}

            <button type="submit" className="btn btn-sm" disabled={cambiando}>
              <span>{cambiando ? "Cambiando…" : "Cambiar la contraseña"}</span>
            </button>
          </form>
        </section>

        <section className="perfil-seccion perfil-riesgo">
          <p className="eyebrow eyebrow-rojo">Exportar y borrar</p>

          <div className="perfil-riesgo-fila">
            <div>
              <p className="perfil-riesgo-titulo">Descargar mis datos</p>
              <p className="campo-ayuda">
                Un JSON con el perfil, la suscripción y el uso que has hecho de la herramienta.
              </p>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => void descargarDatos()}>
              <span>Descargar</span>
            </button>
          </div>

          <div className="perfil-riesgo-fila">
            <div>
              <p className="perfil-riesgo-titulo">Borrar la cuenta</p>
              <p className="campo-ayuda">Se borra el perfil, la suscripción y todo el historial. No hay vuelta atrás.</p>
            </div>
            {!borrarAbierto && (
              <button type="button" className="btn btn-sm" onClick={() => setBorrarAbierto(true)}>
                <span>Borrar la cuenta</span>
              </button>
            )}
          </div>

          {borrarAbierto && (
            <form className="form-acceso perfil-borrar" onSubmit={(e) => void enviarBorrado(e)} noValidate>
              <label className="campo-acceso" htmlFor="perfil-borrar-contrasena">
                <span>Tu contraseña</span>
                <input
                  id="perfil-borrar-contrasena"
                  className="entrada"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={contrasenaBorrado}
                  onChange={(e) => setContrasenaBorrado(e.target.value)}
                />
              </label>

              <label className="campo-acceso" htmlFor="perfil-borrar-confirmar">
                <span>Escribe {CONFIRMACION_BORRADO} para confirmar</span>
                <input
                  id="perfil-borrar-confirmar"
                  className="entrada"
                  type="text"
                  required
                  value={confirmacionBorrado}
                  onChange={(e) => setConfirmacionBorrado(e.target.value)}
                />
              </label>

              {errorBorrado && (
                <p className="campo-error campo-error-general" role="alert">
                  {errorBorrado}
                </p>
              )}

              <div className="perfil-confirmar-botones">
                <button type="button" className="btn btn-sm" onClick={() => setBorrarAbierto(false)}>
                  <span>No, dejarlo</span>
                </button>
                <button type="submit" className="btn btn-sm btn-rojo" disabled={borrando}>
                  <span>{borrando ? "Borrando…" : "Borrar para siempre"}</span>
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </Modal>
  );
}
