// Contador de presupuestos del día llevado en el propio navegador.
//
// Es el suplente de `uso_diario` (`src/suscripcion/estado.ts`) para cuando nadie apunta
// nada en el servidor: la app de escritorio sin `npm run api`, la web con el backend
// apagado, o alguien que no ha entrado en su cuenta y por tanto no tiene a quién
// apuntárselo. Cada presupuesto se cuenta una sola vez, aquí o allí, nunca en los dos.
//
// Esto se salta borrando los datos del navegador y se sabe. No pretende ser
// infranqueable, pretende que el tope signifique algo en el uso normal; el que no se
// puede saltar es el del servidor, que sigue mandando cuando hay sesión.
//
// Cuánto es el tope y cómo se explica no se decide aquí: sale de `LIMITES` y de
// `puedePedirPlan`, igual que en la API.

import { diaDeUso } from "../suscripcion/planes";

/** Lo poco que se le pide a `localStorage`, para poder contarlo en un test. */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

const CLAVE = "jonda_planes_dia";

interface Marca {
  dia: string;
  planes: number;
}

/**
 * `localStorage` cuando se puede tocar. En modo privado, con el almacenamiento
 * bloqueado o dentro de un test de Node no existe, y ahí el contador se queda en cero:
 * antes que romper la herramienta, se cuenta de menos.
 */
function almacenNavegador(): Almacen | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function leer(almacen: Almacen, dia: string): Marca {
  try {
    const crudo = almacen.getItem(CLAVE);
    if (!crudo) return { dia, planes: 0 };
    const marca = JSON.parse(crudo) as Partial<Marca>;
    // De otro día no vale: el contador se reinicia solo al cambiar la fecha, sin tener
    // que limpiar nada por la noche.
    if (marca.dia !== dia) return { dia, planes: 0 };
    const planes = Number(marca.planes);
    return { dia, planes: Number.isFinite(planes) && planes > 0 ? Math.floor(planes) : 0 };
  } catch {
    // Alguien ha metido mano a la clave o se quedó a medias. Se empieza de cero.
    return { dia, planes: 0 };
  }
}

/** Cuántos presupuestos lleva generados hoy este navegador. */
export function planesHoyLocal(
  almacen: Almacen | null = almacenNavegador(),
  ahora: Date = new Date(),
): number {
  if (!almacen) return 0;
  return leer(almacen, diaDeUso(ahora)).planes;
}

/** Apunta uno más y devuelve el total del día. */
export function apuntarPlanLocal(
  almacen: Almacen | null = almacenNavegador(),
  ahora: Date = new Date(),
): number {
  if (!almacen) return 0;
  const dia = diaDeUso(ahora);
  const planes = leer(almacen, dia).planes + 1;
  try {
    almacen.setItem(CLAVE, JSON.stringify({ dia, planes } satisfies Marca));
  } catch {
    // Sin sitio para escribir se sigue igual, con el contador de esta sesión perdido.
  }
  return planes;
}
