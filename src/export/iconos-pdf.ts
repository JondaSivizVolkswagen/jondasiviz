// Iconos vectoriales para el PDF. Misma familia que los de la app (trazo de línea,
// viewBox de 24), pero como cadenas SVG independientes: pdfmake no entiende
// currentColor, así que el color va escrito en cada uno.

import type { Categoria } from "../engine/types";

function svg(trazos: string, color: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">` +
    `${trazos}</svg>`
  );
}

const TRAZOS: Record<Categoria, string> = {
  turbo:
    '<circle cx="10" cy="14" r="6"/><path d="M10 14a3 3 0 1 1 3-3"/><path d="M17 7h5M19.5 4.5 22 7l-2.5 2.5"/>',
  gestion:
    '<rect x="7" y="7" width="10" height="10" rx="2"/>' +
    '<path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3"/>',
  admision: '<path d="M3 5h18l-7 8v7l-4-2.5V13z"/>',
  escape:
    '<path d="M2 14h12a4 4 0 1 0 0-8"/><path d="M17 16c1.5 0 1.5-2 3-2M17 20c1.5 0 1.5-2 3-2"/>',
  suspension: '<path d="M12 2v3M12 19v3"/><path d="M8 5h8l-8 3.5h8l-8 3.5h8l-8 3.5h8"/>',
  transmision:
    '<circle cx="12" cy="12" r="3.2"/>' +
    '<path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  frenos:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>' +
    '<path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5"/>',
  direccion:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.8"/>' +
    '<path d="M12 3v6.2M20.3 16.4 14.6 13.5M3.7 16.4 9.4 13.5"/>',
  seguridad: '<path d="M12 2.8 19 6v6c0 4.2-3 7.3-7 9.2-4-1.9-7-5-7-9.2V6z"/>',
  ruedas:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.8"/>' +
    '<path d="M12 3v4.2M12 16.8V21M3 12h4.2M16.8 12H21"/>',
  estetica:
    '<path d="m11 3 2.1 5.4 5.4 2.1-5.4 2.1L11 18l-2.1-5.4L3.5 10.5l5.4-2.1z"/>' +
    '<path d="M18.5 3.5v3M17 5h3"/>',
};

/** Marca de la app para la cabecera del documento: aguja de cuentakilómetros. */
export function marcaSvg(color: string): string {
  return svg('<path d="M3 18a9 9 0 1 1 18 0"/><path d="M12 18l4.5-6.5"/><circle cx="12" cy="18" r="1.4"/>', color);
}

export function iconoCategoria(categoria: Categoria, color: string): string {
  return svg(TRAZOS[categoria], color);
}
