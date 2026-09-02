// El perfil: datos, plan, contraseña y, aparte y abajo, exportar y borrar la cuenta.
//
// Entra por la misma puerta que el acceso y la suscripción, un modal, así que no hace
// falta una ruta nueva ni un router. Lo abre el correo de la barra.
//
// A quien lo monta (App.tsx) le toca no renderizarlo mientras no está abierto: así cada
// apertura arranca de cero, sin un "Borrar la cuenta" a medias de la vez anterior.

import { useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { listarModelos } from "../engine/graph";
import { useCuenta } from "../cuenta/useCuenta";
import {
  actualizarPerfil,
  borrarCuenta,
  cambiarContrasena,
  cancelarSuscripcion,
  misDatos,
} from "../cuenta/api";
import { Avatar } from "./Avatar";
import { FotoInvalida, prepararFoto } from "./imagen";
import { Icono } from "./icons";
import { Modal } from "./Modal";
import { SelectorCoche } from "./SelectorCoche";

const CONFIRMACION_BORRADO = "BORRAR";
const LARGO_CIUDAD = 60;
const LARGO_SOBRE_MI = 280;

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
  const [ciudad, setCiudad] = useState(perfil?.ciudad ?? "");
  const [sobreMi, setSobreMi] = useState(perfil?.sobreMi ?? "");
  const [guardando, setGuardando] = useState(false);
  const [avisoDatos, setAvisoDatos] = useState<string | null>(null);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  // La foto se guarda al momento de elegirla, aparte del resto del formulario: así un
  // "Guardar cambios" en nombre o ciudad nunca manda de rebote una imagen a medio
  // preparar, y quitar la foto es un botón, no un campo que vaciar a mano.
  const idFoto = useId();
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState(perfil?.foto ?? "");
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

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
    const resultado = await actualizarPerfil({
      nombre: nombre.trim(),
      coche,
      ciudad: ciudad.trim(),
      sobreMi: sobreMi.trim(),
    });
    setGuardando(false);
    if (!resultado.ok) {
      setErrorDatos(resultado.error);
      return;
    }
    await refrescar();
    setAvisoDatos("Guardado.");
  };

  const elegirFoto = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (archivo) void subirFoto(archivo);
  };

  const subirFoto = async (archivo: File) => {
    setSubiendoFoto(true);
    setErrorFoto(null);
    try {
      const lista = await prepararFoto(archivo);
      const resultado = await actualizarPerfil({ foto: lista });
      if (!resultado.ok) {
        setErrorFoto(resultado.error);
        return;
      }
      setFoto(lista);
      await refrescar();
    } catch (error) {
      setErrorFoto(error instanceof FotoInvalida ? error.message : "No se pudo preparar la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const quitarFoto = async () => {
    setSubiendoFoto(true);
    setErrorFoto(null);
    const resultado = await actualizarPerfil({ foto: "" });
    setSubiendoFoto(false);
    if (!resultado.ok) {
      setErrorFoto(resultado.error);
      return;
    }
    setFoto("");
    await refrescar();
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

  // Se piden con la sesión puesta y se ofrecen como fichero desde aquí. Llevar el
  // navegador a la ruta, que es lo que se hacía antes, solo funcionaba mientras valiera
  // la cookie: dentro de la app de escritorio no la hay y siempre salía un 401.
  const descargarDatos = async () => {
    setErrorDescarga(null);
    setDescargando(true);
    const resultado = await misDatos();
    setDescargando(false);
    if (!resultado.ok) {
      setErrorDescarga(resultado.error);
      return;
    }

    const url = URL.createObjectURL(resultado.datos);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "mis-datos-jondasiviz.json";
    enlace.click();
    // Se suelta en cuanto el navegador ha cogido el fichero; si no, el blob se queda en
    // memoria hasta que se cierre la pestaña.
    URL.revokeObjectURL(url);
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

  // Sin tope no hay cuenta que llevar, así que no se habla de números. Quien decide es
  // el límite, no el nombre del plan: si algún día hay un plan intermedio con tope, esta
  // frase sigue diciendo la verdad sola.
  const conTopeDiario = Number.isFinite(limites.planesPorDia);
  const usoDelDia = conTopeDiario
    ? `Hoy llevas ${planesHoy} de ${limites.planesPorDia} presupuestos.`
    : "Presupuestos sin límite al día.";

  return (
    <Modal eyebrow="Cuenta" titulo="Tu perfil" onCerrar={cerrarModal} ancho="grande">
      <div className="perfil">
        <section className="perfil-seccion">
          <p className="eyebrow">Datos</p>

          <div className="perfil-foto-fila">
            <Avatar nombre={nombre} foto={foto} className="perfil-avatar" />
            <div className="perfil-foto-acciones">
              <input
                ref={inputFotoRef}
                id={idFoto}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={elegirFoto}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => inputFotoRef.current?.click()}
                disabled={subiendoFoto}
              >
                <Icono nombre="camara" />
                <span>{subiendoFoto ? "Un momento…" : foto ? "Cambiar foto" : "Subir foto"}</span>
              </button>
              {foto && (
                <button type="button" className="enlace" onClick={() => void quitarFoto()} disabled={subiendoFoto}>
                  Quitar foto
                </button>
              )}
              {errorFoto && (
                <p className="campo-error" role="alert">
                  {errorFoto}
                </p>
              )}
            </div>
          </div>

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

            <label className="campo-acceso" htmlFor="perfil-ciudad">
              <span>Ciudad</span>
              <input
                id="perfil-ciudad"
                className="entrada"
                type="text"
                autoComplete="address-level2"
                maxLength={LARGO_CIUDAD}
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Desde dónde te preparas el coche"
              />
            </label>

            <label className="campo-acceso" htmlFor="perfil-sobre-mi">
              <span>Sobre mí</span>
              <textarea
                id="perfil-sobre-mi"
                className="entrada"
                maxLength={LARGO_SOBRE_MI}
                value={sobreMi}
                onChange={(e) => setSobreMi(e.target.value)}
                placeholder="Lo que quieras contar del coche o del proyecto"
              />
              <span className="campo-contador">
                {sobreMi.length}/{LARGO_SOBRE_MI}
              </span>
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
                : usoDelDia}
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
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void descargarDatos()}
              disabled={descargando}
            >
              <span>{descargando ? "Preparando…" : "Descargar"}</span>
            </button>
          </div>

          {errorDescarga && (
            <p className="campo-error" role="alert">
              {errorDescarga}
            </p>
          )}

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
