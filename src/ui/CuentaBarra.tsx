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

  // El nombre que se puso en el perfil, no el correo. El correo es con lo que entras,
  // no como te llamas, y verlo entero ahí arriba no le dice nada a nadie.
  //
  // Sin nombre no se pinta texto ninguno: queda el avatar solo, igual que ese avatar ya
  // cae al icono de persona cuando no hay ni foto ni iniciales. Antes que enseñar el
  // trozo del correo anterior a la arroba, que sigue siendo el correo y encima parece
  // que se cortó a medias. El nombre se pone en el registro o después, en el perfil.
  const nombre = perfil?.nombre?.trim();

  return (
    <button
      type="button"
      className="cuenta-btn"
      title="Ver tu perfil"
      // El correo sigue aquí siempre, se vea o no en pantalla: es el dato que distingue
      // una cuenta de otra, y quien navega a oídas lo necesita para saber en cuál está.
      aria-label={
        nombre
          ? `Abrir el perfil de ${nombre}, ${usuario.correo}`
          : `Abrir el perfil de ${usuario.correo}`
      }
      onClick={() => abrirPerfil()}
    >
      <Avatar nombre={perfil?.nombre} foto={perfil?.foto} />
      {nombre && <span className="cuenta-nombre">{nombre}</span>}
    </button>
  );
}
