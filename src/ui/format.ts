// Formato de moneda para toda la interfaz: entero redondeado, separador español y sufijo de euro.

export function euros(valor: number): string {
  const n = Number.isFinite(valor) ? Math.round(valor) : 0;
  return `${n.toLocaleString("es-ES")} €`;
}
