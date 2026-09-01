// Verificación de los webhooks de GitHub.
//
// GitHub firma cada entrega con HMAC SHA-256 sobre el cuerpo crudo, usando el secreto
// que se configura en el repositorio, y la manda en la cabecera X-Hub-Signature-256.
// Sin comprobar esa firma, el endpoint acepta que cualquiera con la URL dispare una
// resiembra de la base, así que esto no es opcional.
//
// Dos detalles que importan:
//
//   - La firma se calcula sobre el cuerpo TAL CUAL llegó. Si se parsea el JSON y se
//     vuelve a serializar, el orden de las claves o los espacios cambian y la firma ya
//     no cuadra. Por eso se trabaja con el Buffer original.
//
//   - La comparación va con timingSafeEqual y no con ===. Comparar cadenas se para en
//     el primer carácter distinto, y ese tiempo de más deja adivinar la firma byte a
//     byte. timingSafeEqual siempre tarda lo mismo.

import { createHmac, timingSafeEqual } from "node:crypto";

export type ResultadoFirma =
  | { valida: true }
  | { valida: false; motivo: string };

/**
 * Comprueba la firma de una entrega de GitHub.
 *
 * @param cuerpo  El cuerpo de la petición sin tocar.
 * @param firma   Contenido de la cabecera X-Hub-Signature-256 ("sha256=...").
 * @param secreto El mismo secreto configurado en el webhook del repositorio.
 */
export function verificarFirma(
  cuerpo: Buffer,
  firma: string | undefined,
  secreto: string,
): ResultadoFirma {
  if (!secreto) {
    return { valida: false, motivo: "El servidor no tiene configurado JONDA_WEBHOOK_SECRET." };
  }
  if (!firma) {
    return { valida: false, motivo: "Falta la cabecera X-Hub-Signature-256." };
  }
  if (!firma.startsWith("sha256=")) {
    return { valida: false, motivo: "La firma no viene en el formato sha256=..." };
  }

  const esperada = "sha256=" + createHmac("sha256", secreto).update(cuerpo).digest("hex");

  const recibida = Buffer.from(firma);
  const calculada = Buffer.from(esperada);

  // timingSafeEqual exige que midan lo mismo, y revienta si no. Se comprueba antes,
  // que además el largo no es un secreto.
  if (recibida.length !== calculada.length) {
    return { valida: false, motivo: "La firma no coincide." };
  }

  return timingSafeEqual(recibida, calculada)
    ? { valida: true }
    : { valida: false, motivo: "La firma no coincide." };
}

/**
 * Decide si un evento de GitHub tiene que provocar una resiembra.
 *
 * Solo interesan los push a la rama principal que tocan los datos: el catálogo, los
 * modelos o el vault. Un push que solo cambia la interfaz no tiene por qué recargar la
 * base.
 */
export function pideResiembra(evento: string, cuerpo: unknown): boolean {
  if (evento !== "push") return false;

  const datos = cuerpo as {
    ref?: string;
    commits?: { added?: string[]; modified?: string[]; removed?: string[] }[];
  };

  if (datos.ref !== "refs/heads/main") return false;

  const tocados = (datos.commits ?? []).flatMap((c) => [
    ...(c.added ?? []),
    ...(c.modified ?? []),
    ...(c.removed ?? []),
  ]);

  return tocados.some((ruta) => ruta.startsWith("src/data/") || ruta.startsWith("vault/"));
}
