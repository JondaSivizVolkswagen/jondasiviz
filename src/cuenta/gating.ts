// Frases de "esto es de la suscripción" para la interfaz.
//
// No se escriben aquí a mano: se sacan de `puedePedirPlan`, la misma función que usa la
// API para decidir el 402. Así el aviso que ve alguien mientras toca el formulario dice
// exactamente lo mismo que diría el servidor si se lo preguntara, sin mantener dos
// frases que un día se separan.

import { puedePedirPlan, type Limites } from "../suscripcion/planes";
import type { Objetivo } from "../engine/types";

/** Motivo por el que tener `cantidad` objetivos a la vez no cabe en el plan, o null si cabe. */
export function motivoObjetivos(limites: Limites, cantidad: number): string | null {
  if (cantidad <= limites.objetivos) return null;
  const veredicto = puedePedirPlan(
    limites,
    { objetivos: Array.from({ length: cantidad }) as Objetivo[], elecciones: [] },
    0,
  );
  return veredicto.permitido ? null : veredicto.motivo;
}

/** Motivo por el que elegir piezas a mano no cabe en el plan, o null si cabe. */
export function motivoElecciones(limites: Limites): string | null {
  if (limites.eleccionesManuales) return null;
  const veredicto = puedePedirPlan(limites, { objetivos: [], elecciones: ["x"] }, 0);
  return veredicto.permitido ? null : veredicto.motivo;
}

/**
 * Motivo por el que un presupuesto más no cabe hoy en el plan, o null si cabe.
 *
 * Es la misma frase que devuelve el 402 de `/api/plan`, porque sale de la misma
 * función. Importa cuando corta el contador del navegador y no el servidor: quien lo lee
 * no tiene por qué notar quién ha contado.
 */
export function motivoPlanesPorDia(limites: Limites, planesHoy: number): string | null {
  const veredicto = puedePedirPlan(limites, { objetivos: [], elecciones: [] }, planesHoy);
  return veredicto.permitido ? null : veredicto.motivo;
}

/** Exportar a PDF no forma parte de una petición de plan, así que no sale de puedePedirPlan. */
export const MOTIVO_PDF = "Descargar en PDF es de la suscripción.";
