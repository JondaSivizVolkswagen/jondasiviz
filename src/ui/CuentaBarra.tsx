// El punto de entrada a la cuenta, igual en el planner y en la portada: el avatar abre
// el perfil si hay sesión, o un botón de entrar si no la hay. Antes esto era solo el
// correo en texto, y nadie lo leía como algo pulsable; el avatar con marco y fondo al
// pasar el ratón se lee como un botón sin que haga falta buscarlo.

import { useCuenta } from "../cuenta/useCuenta";
import { Avatar } from "./Avatar";

export function CuentaBarra() {
  const { cargando, usuario, perfil, abrirAcceso, abrirPerfil } = useCuenta();

  // Mientras no se sabe si hay sesión no se enseña nada: mejor un hueco en blanco medio
  // segundo que un "Entrar" que luego se convierte en un avatar.
  if (cargando) return null;

  if (!usuario) {
    return (
      <button type="button" className="btn btn-sm" onClick={() => abrirAcceso("entrar")}>
        <span>Entrar</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="cuenta-btn"
      title="Ver tu perfil"
      aria-label={`Abrir el perfil de ${usuario.correo}`}
      onClick={() => abrirPerfil()}
    >
      <Avatar nombre={perfil?.nombre} foto={perfil?.foto} />
      <span className="cuenta-correo">{usuario.correo}</span>
    </button>
  );
}
