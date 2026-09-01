// De dónde salen los datos con los que trabaja la interfaz.
//
// Hay dos sitios y no compiten: mandan los mismos datos, solo cambia el camino.
//
//   API   ->  el catálogo que sirve /api/catalogo desde SQLite. Es lo que se usa cuando
//             el servidor está levantado, y permite que un cambio en la base se vea en
//             la web sin recompilar nada.
//   JSON  ->  el catálogo empaquetado en el bundle. Es el que había siempre.
//
// El JSON no es un plan B de emergencia, es el modo normal de la aplicación de
// escritorio, que va sin conexión y sin servidor. Por eso esto nunca falla hacia
// arriba: si la API no contesta en un segundo, se sigue con lo de casa y no se le dice
// nada al usuario, porque para él no ha pasado nada.

import { usarCatalogo } from "../engine/catalog.ts";
import { usarModelos } from "../engine/graph.ts";
import type { Catalogo, CatalogoModelos } from "../engine/types.ts";

/** Lo que se espera a la API antes de tirar de los JSON de casa. */
const ESPERA_MAXIMA = 1000;

export type Origen = "api" | "local";

/**
 * Intenta cargar catálogo y modelos desde la API. Devuelve de dónde salieron al final,
 * que es lo que la interfaz puede enseñar si quiere.
 */
export async function cargarDatos(): Promise<Origen> {
  try {
    const [catalogo, modelos] = await Promise.all([
      pedir<Catalogo>("/api/catalogo"),
      pedir<CatalogoModelos>("/api/modelos"),
    ]);

    // Se validan dentro: un catálogo incompleto de la API se rechaza y cae al de casa.
    usarCatalogo(catalogo);
    usarModelos(modelos);
    return "api";
  } catch {
    return "local";
  }
}

async function pedir<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(ruta, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(ESPERA_MAXIMA),
  });
  if (!respuesta.ok) throw new Error(`${ruta} respondió ${respuesta.status}`);
  return (await respuesta.json()) as T;
}
