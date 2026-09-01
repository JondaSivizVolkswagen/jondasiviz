// Foto, iniciales o un icono de persona, en ese orden. Cuadrado, no redondo: la guía de
// estilo no deja curvas, y aquí además evita la trampa de recortar mal una foto que no es
// cuadrada (eso ya lo resuelve `prepararFoto`, en `src/ui/imagen.ts`, antes de guardarla).

import { Icono } from "./icons";

interface Props {
  nombre?: string;
  foto?: string;
  className?: string;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export function Avatar({ nombre, foto, className }: Props) {
  const clase = "avatar" + (className ? ` ${className}` : "");

  if (foto) {
    return <img className={clase} src={foto} alt="" />;
  }

  const texto = nombre ? iniciales(nombre) : "";
  if (texto) {
    return (
      <span className={clase + " avatar-iniciales"} aria-hidden="true">
        {texto}
      </span>
    );
  }

  return (
    <span className={clase + " avatar-icono"} aria-hidden="true">
      <Icono nombre="persona" />
    </span>
  );
}
