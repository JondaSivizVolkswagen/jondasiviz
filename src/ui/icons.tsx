// Familia de iconos única para la app: trazo de línea, mismo grosor, viewBox de 24.

import type { ReactNode } from "react";

const TRAZOS = {
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </>
  ),
  luna: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  drift: (
    <>
      <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z" />
      <path d="M8 15c2-4 6-5 9-3" />
    </>
  ),
  drag: (
    <>
      <path d="M5 19V9l7-5 7 5v10" />
      <path d="M9 19v-6h6v6" />
    </>
  ),
  rayo: <path d="M13 2 4 14h6l-1 8 9-12h-6z" />,
  estrella: <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6L12 17l-5.4 2.6 1-6L3.3 9.4l6-.9z" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  flechaIzquierda: <path d="M19 12H5M11 18l-6-6 6-6" />,
} satisfies Record<string, ReactNode>;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, className }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
