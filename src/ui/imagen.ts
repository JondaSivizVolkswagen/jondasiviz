// Prepara una foto de perfil para mandarla al servidor.
//
// El servidor solo acepta PNG, JPEG o WEBP en un data URI de como mucho 256 KB (ver
// `src/auth/perfil.ts`). Una foto de móvil sin tocar pesa varios megas, así que hace
// falta reducirla en el navegador antes de mandarla, no confiar en que el servidor la
// acepte tal cual.
//
// El proceso: se recorta al cuadrado central (para no deformar la imagen al forzarla a
// 256x256), se dibuja en un `<canvas>` de ese tamaño y se saca como WEBP a calidad 0.85.
// Si el navegador no sabe codificar WEBP (Safari viejo), `toDataURL` devuelve
// silenciosamente un PNG con esa etiqueta puesta encima, así que se detecta mirando el
// principio de la cadena y se cae a JPEG, que todos los navegadores saben hacer.

const LADO = 256;
const CALIDAD_INICIAL = 0.85;
const CALIDAD_MINIMA = 0.4;
const LIMITE_BYTES = 256 * 1024;

export class FotoInvalida extends Error {}

/** Recorta al cuadrado central, reduce a 256x256 y comprime. Lanza `FotoInvalida` si el
 * fichero no es una imagen o si no hay forma de bajarla de 256 KB. */
export async function prepararFoto(archivo: File): Promise<string> {
  if (!archivo.type.startsWith("image/")) {
    throw new FotoInvalida("Ese fichero no es una imagen.");
  }

  const bitmap = await cargarBitmap(archivo);
  try {
    const lienzo = document.createElement("canvas");
    lienzo.width = LADO;
    lienzo.height = LADO;
    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new FotoInvalida("Este navegador no puede procesar imágenes.");

    const lado = Math.min(bitmap.width, bitmap.height);
    const x = (bitmap.width - lado) / 2;
    const y = (bitmap.height - lado) / 2;
    ctx.drawImage(bitmap, x, y, lado, lado, 0, 0, LADO, LADO);

    let calidad = CALIDAD_INICIAL;
    let resultado = codificar(lienzo, calidad);
    while (tamanoDataUri(resultado) > LIMITE_BYTES && calidad > CALIDAD_MINIMA) {
      calidad -= 0.15;
      resultado = codificar(lienzo, calidad);
    }
    if (tamanoDataUri(resultado) > LIMITE_BYTES) {
      throw new FotoInvalida("La foto sigue pesando demasiado incluso reducida. Prueba con otra.");
    }
    return resultado;
  } finally {
    bitmap.close();
  }
}

function codificar(lienzo: HTMLCanvasElement, calidad: number): string {
  const webp = lienzo.toDataURL("image/webp", calidad);
  return webp.startsWith("data:image/webp") ? webp : lienzo.toDataURL("image/jpeg", calidad);
}

function tamanoDataUri(dataUri: string): number {
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

async function cargarBitmap(archivo: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(archivo);
  } catch {
    throw new FotoInvalida("No se pudo leer esa imagen.");
  }
}
