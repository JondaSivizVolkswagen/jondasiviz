// Acceso a la cuenta: un solo sitio con dos modos, entrar y registrarse. Cambiar de uno a
// otro no recarga nada, solo cambia qué botón manda el formulario y qué frase hay debajo.

import { useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { listarModelos } from "../engine/graph";
import { useCuenta } from "../cuenta/useCuenta";
import { Modal } from "./Modal";
import { SelectorCoche } from "./SelectorCoche";

type CampoError = "correo" | "contrasena" | "general";

/**
 * La API contesta con una sola frase, no con el campo que falló. Aquí se mira de qué
 * habla la frase para ponerla junto al campo que toca; si menciona los dos a la vez (el
 * error de inicio de sesión es así a propósito, para no delatar qué correos existen) se
 * queda como aviso general.
 */
function campoDe(mensaje: string): CampoError {
  const m = mensaje.toLowerCase();
  const correo = m.includes("correo");
  const contrasena = m.includes("contraseña");
  if (correo && !contrasena) return "correo";
  if (contrasena && !correo) return "contrasena";
  return "general";
}

export function AccesoModal() {
  const { modal, cerrarModal, entrar, registrar } = useCuenta();
  const idCorreo = useId();
  const idContrasena = useId();
  const idNombre = useId();
  const idCoche = useId();
  const modelos = useMemo(() => listarModelos(), []);

  const [modo, setModo] = useState<"entrar" | "registro">(
    modal?.tipo === "acceso" ? modal.modo : "entrar",
  );
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [nombre, setNombre] = useState("");
  const [coche, setCoche] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ campo: CampoError; texto: string } | null>(null);

  if (modal?.tipo !== "acceso") return null;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);

    const fallo =
      modo === "entrar"
        ? await entrar(correo.trim(), contrasena)
        : await registrar(correo.trim(), contrasena, { nombre: nombre.trim(), coche });

    if (fallo) {
      setError({ campo: campoDe(fallo), texto: fallo });
      setEnviando(false);
    }
    // Sin fallo, el propio contexto cierra el modal y ya hay sesión.
  };

  const cambiarModo = () => {
    setModo((m) => (m === "entrar" ? "registro" : "entrar"));
    setError(null);
  };

  return (
    <Modal
      eyebrow="Cuenta"
      titulo={modo === "entrar" ? "Entra en tu cuenta" : "Date de alta"}
      onCerrar={cerrarModal}
    >
      {modal.aviso && <p className="modal-aviso">{modal.aviso}</p>}

      <form className="form-acceso" onSubmit={(e) => void enviar(e)} noValidate>
        <label className="campo-acceso" htmlFor={idCorreo}>
          <span>Correo</span>
          <input
            id={idCorreo}
            className={"entrada" + (error?.campo === "correo" ? " entrada-peligro" : "")}
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            aria-invalid={error?.campo === "correo"}
            aria-describedby={error?.campo === "correo" ? `${idCorreo}-error` : undefined}
          />
          {error?.campo === "correo" && (
            <span className="campo-error" id={`${idCorreo}-error`} role="alert">
              {error.texto}
            </span>
          )}
        </label>

        <label className="campo-acceso" htmlFor={idContrasena}>
          <span>Contraseña</span>
          <input
            id={idContrasena}
            className={"entrada" + (error?.campo === "contrasena" ? " entrada-peligro" : "")}
            type="password"
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            required
            minLength={modo === "registro" ? 8 : undefined}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            aria-invalid={error?.campo === "contrasena"}
            aria-describedby={error?.campo === "contrasena" ? `${idContrasena}-error` : undefined}
          />
          {error?.campo === "contrasena" && (
            <span className="campo-error" id={`${idContrasena}-error`} role="alert">
              {error.texto}
            </span>
          )}
          {modo === "registro" && !error && (
            <span className="campo-ayuda">Al menos 8 caracteres.</span>
          )}
        </label>

        {modo === "registro" && (
          <>
            <label className="campo-acceso" htmlFor={idNombre}>
              <span>Nombre (opcional)</span>
              <input
                id={idNombre}
                className="entrada"
                type="text"
                autoComplete="name"
                maxLength={60}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Como quieras que te llamemos"
              />
            </label>

            <label className="campo-acceso" htmlFor={idCoche}>
              <span>Tu coche (opcional)</span>
              <SelectorCoche id={idCoche} modelos={modelos} valor={coche} onValor={setCoche} />
            </label>
          </>
        )}

        {error?.campo === "general" && (
          <p className="campo-error campo-error-general" role="alert">
            {error.texto}
          </p>
        )}

        <button type="submit" className="btn btn-rojo form-acceso-enviar" disabled={enviando}>
          <span>
            {enviando
              ? "Un momento…"
              : modo === "entrar"
                ? "Entrar"
                : "Crear la cuenta"}
          </span>
        </button>

        <p className="form-acceso-cambiar">
          {modo === "entrar" ? "¿Primera vez aquí? " : "¿Ya tienes cuenta? "}
          <button type="button" className="enlace" onClick={cambiarModo}>
            {modo === "entrar" ? "Date de alta" : "Entra"}
          </button>
        </p>
      </form>
    </Modal>
  );
}
