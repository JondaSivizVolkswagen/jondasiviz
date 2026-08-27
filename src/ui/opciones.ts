// Opciones fijas del formulario: gamas y objetivos con su texto de apoyo.

import type { Gama, Objetivo } from "../engine/types";
import type { NombreIcono } from "./icons";

export const GAMAS: { valor: Gama; etiqueta: string }[] = [
  { valor: "baja", etiqueta: "Baja" },
  { valor: "media", etiqueta: "Media" },
  { valor: "alta", etiqueta: "Alta" },
];

export const OBJETIVOS: {
  valor: Objetivo;
  etiqueta: string;
  icono: NombreIcono;
  frase: string;
}[] = [
  {
    valor: "drift",
    etiqueta: "Drift",
    icono: "drift",
    frase: "Eje trasero rígido, más ángulo de dirección, freno de mano hidráulico y autoblocante.",
  },
  {
    valor: "drag",
    etiqueta: "Drag",
    icono: "drag",
    frase: "Turbo, admisión, escape, gestión electrónica y un embrague que aguante la salida.",
  },
  {
    valor: "mas-cv",
    etiqueta: "Ganar caballos",
    icono: "rayo",
    frase: "Stage 1 y bolt-ons: admisión, escape y remap sin abrir el motor.",
  },
  {
    valor: "estetica",
    etiqueta: "Estética",
    icono: "estrella",
    frase: "Llantas con el offset justo, retoques de carrocería y bajar el coche a la altura buena.",
  },
];
