// Formato de moneda. Vive en el motor para que la interfaz, el PDF y la CLI escriban
// las cifras igual, sin tres implementaciones que se van separando con el tiempo.

export function euros(valor: number): string {
  const n = Number.isFinite(valor) ? Math.round(valor) : 0;
  return `${n.toLocaleString("es-ES")} €`;
}
