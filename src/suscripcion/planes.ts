// Qué puede hacer cada plan.
//
// Esto es regla de negocio, así que vive aquí y no repartido por la interfaz. La web lo
// pregunta para saber qué enseñar, pero quien decide es el servidor: una comprobación
// hecha solo en el navegador se salta abriendo las herramientas de desarrollo.
//
// La interfaz puede ocultar un botón, pero la API tiene que rechazar la petición igual.

import { euros } from "../engine/format.ts";

export type Plan = "gratis" | "taller";

export type EstadoSuscripcion = "ninguna" | "activa" | "impagada" | "cancelada";

export interface Limites {
  /**
   * Hasta cuánto dinero se puede planificar. Es el límite que más se nota y el que
   * mejor se entiende, y a la vez el que menos estropea la herramienta: por debajo del
   * techo la experiencia es la completa, con su lista, su desglose y sus avisos. No
   * enseña una versión capada del producto, enseña el producto entero en pequeño.
   */
  presupuestoMaximo: number;
  /** Cuántos objetivos se pueden combinar en un mismo plan. */
  objetivos: number;
  /** Si se pueden fijar piezas a mano y que el motor rellene alrededor. */
  eleccionesManuales: boolean;
  /** Si se puede descargar el presupuesto en PDF. */
  exportarPdf: boolean;
  /** Presupuestos por día. Infinity para sin tope. */
  planesPorDia: number;
}

export const LIMITES: Record<Plan, Limites> = {
  gratis: {
    presupuestoMaximo: 3000,
    objetivos: 1,
    eleccionesManuales: false,
    exportarPdf: false,
    planesPorDia: 5,
  },
  taller: {
    presupuestoMaximo: Infinity,
    objetivos: 4,
    eleccionesManuales: true,
    exportarPdf: true,
    planesPorDia: Infinity,
  },
};

/** Lo que cuesta la suscripción, en céntimos, y cada cuánto se cobra. */
export const PRECIO = {
  centimos: 499,
  moneda: "eur",
  periodo: "mes",
} as const;

/**
 * De qué plan disfruta alguien según el estado de su suscripción.
 *
 * "impagada" conserva el acceso a propósito: cuando falla un cobro, la pasarela reintenta
 * durante unos días, y cortar al primer intento fallido echa a gente que solo ha cambiado
 * de tarjeta. Cuando la pasarela se rinde manda "cancelada", y ahí sí se corta.
 */
export function planDe(estado: EstadoSuscripcion): Plan {
  return estado === "activa" || estado === "impagada" ? "taller" : "gratis";
}

export function limitesDe(estado: EstadoSuscripcion): Limites {
  return LIMITES[planDe(estado)];
}

export type Veredicto = { permitido: true } | { permitido: false; motivo: string };

/** Si una petición de plan cabe en los límites de quien la pide. */
export function puedePedirPlan(
  limites: Limites,
  peticion: { objetivos: unknown[]; elecciones?: unknown[]; presupuesto?: number },
  planesHoy: number,
): Veredicto {
  const presupuesto = peticion.presupuesto ?? 0;
  if (presupuesto > limites.presupuestoMaximo) {
    return {
      permitido: false,
      motivo:
        `Con el plan gratuito se planifica hasta ${euros(limites.presupuestoMaximo)}. ` +
        "Para proyectos más grandes hace falta la suscripción.",
    };
  }

  if (peticion.objetivos.length > limites.objetivos) {
    return {
      permitido: false,
      motivo:
        limites.objetivos === 1
          ? "Con el plan gratuito se elige un objetivo cada vez. Combinar varios es de la suscripción."
          : `Como mucho ${limites.objetivos} objetivos a la vez.`,
    };
  }

  if ((peticion.elecciones?.length ?? 0) > 0 && !limites.eleccionesManuales) {
    return {
      permitido: false,
      motivo: "Fijar piezas a mano es de la suscripción. Sin ella elige el motor.",
    };
  }

  if (planesHoy >= limites.planesPorDia) {
    return {
      permitido: false,
      motivo: `Has llegado a los ${limites.planesPorDia} presupuestos de hoy. Mañana se reinicia, o puedes suscribirte.`,
    };
  }

  return { permitido: true };
}
