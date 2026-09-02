// Quién da permiso para generar un presupuesto y quién lo apunta.
//
// El plan lo calcula el motor en el navegador, como siempre. Lo que hace falta además es
// un sitio donde quede constancia de que se ha generado uno, porque sin eso el tope por
// día del plan gratuito no se puede aplicar: no hay nada que contar.
//
// Hay dos contadores y solo uno actúa en cada caso:
//
//   - Con API y con sesión manda el servidor. `/api/plan` comprueba los límites, apunta
//     el presupuesto en el uso del día y contesta 402 con el motivo cuando ya no cabe.
//     Ese es el de verdad, el que no se salta nadie desde el navegador.
//   - Sin API (la app de escritorio sin `npm run api`, o la web con el backend caído) y
//     también sin sesión, que es cuando el servidor no tiene a quién apuntárselo, cuenta
//     el navegador con el mismo tope y la misma frase.
//
// Ni el número ni el texto se escriben aquí: salen de `puedePedirPlan` y de `LIMITES`,
// las mismas que usa la API, así que el corte dice lo mismo lo cuente quien lo cuente.

import { pedirPresupuesto, type Limites, type PeticionPlan } from "./api";
import { motivoPlanesPorDia } from "./gating";
import { apuntarPlanLocal, planesHoyLocal } from "./tope-local";

/** Cuántos presupuestos van hoy y quién los lleva. */
export interface Uso {
  /** Ya contado el que se acaba de pedir. */
  planesHoy: number;
  /** true cuando el contador es el de este navegador y no el del servidor. */
  local: boolean;
}

export type Permiso =
  | { ok: true; uso: Uso }
  /** No cabe en el plan: se abre la suscripción con este motivo. */
  | { ok: false; motivo: string; suscripcion: true; uso: Uso | null }
  /** Ha fallado algo que no es el plan (un dato mal, el servidor de mal humor). */
  | { ok: false; motivo: string; suscripcion: false; uso: null };

/** El `planesHoy` que venga en una respuesta de la API, si es que viene alguno. */
function usoDelServidor(cuerpo: unknown): Uso | null {
  if (typeof cuerpo !== "object" || cuerpo === null) return null;
  const valor = (cuerpo as { planesHoy?: unknown }).planesHoy;
  return typeof valor === "number" && Number.isFinite(valor)
    ? { planesHoy: valor, local: false }
    : null;
}

interface Entorno {
  peticion: PeticionPlan;
  limites: Limites;
  /** Si la API contestó al arrancar. */
  disponibleApi: boolean;
  /** Si hay alguien dentro de su cuenta, que es cuando el servidor puede apuntar. */
  conSesion: boolean;
}

/**
 * Pide permiso para generar un presupuesto y lo deja apuntado donde toque. Devuelve
 * `ok: true` cuando se puede enseñar el plan.
 */
export async function apuntarGeneracion(entorno: Entorno): Promise<Permiso> {
  // Quién va a contar este presupuesto se decide antes de pedir nada, para no gastar una
  // petición cuando el contador de aquí ya dice que no.
  let cuentaElServidor = entorno.disponibleApi && entorno.conSesion;

  if (!cuentaElServidor) {
    const llevados = planesHoyLocal();
    const motivo = motivoPlanesPorDia(entorno.limites, llevados);
    if (motivo) {
      return { ok: false, motivo, suscripcion: true, uso: { planesHoy: llevados, local: true } };
    }
  }

  // El contador del servidor viene en su respuesta, ya subido. No se deduce aquí sumando
  // uno: el número que se enseña tiene que ser el que él tiene apuntado.
  let usoServidor: Uso | null = null;

  if (entorno.disponibleApi) {
    const respuesta = await pedirPresupuesto(entorno.peticion);
    if (respuesta.ok) {
      usoServidor = usoDelServidor(respuesta.datos);
    } else {
      if (respuesta.codigo === 402) {
        return {
          ok: false,
          motivo: respuesta.error,
          suscripcion: true,
          uso: usoDelServidor(respuesta.datos),
        };
      }
      if (respuesta.codigo !== undefined) {
        return { ok: false, motivo: respuesta.error, suscripcion: false, uso: null };
      }
      // Sin código no hubo respuesta: la API se ha caído desde que arrancó la página. Se
      // sigue con el motor de aquí, y si el apunte era suyo pasa a serlo de este
      // navegador, que si no este presupuesto no lo contaría nadie.
      if (cuentaElServidor) {
        cuentaElServidor = false;
        const llevados = planesHoyLocal();
        const motivo = motivoPlanesPorDia(entorno.limites, llevados);
        if (motivo) {
          return { ok: false, motivo, suscripcion: true, uso: { planesHoy: llevados, local: true } };
        }
      }
    }
  }

  // Si el servidor no ha dado número (no había sesión, o se cayó a mitad), lo lleva este
  // navegador y el bueno es el que devuelve al apuntar.
  if (!cuentaElServidor) return { ok: true, uso: { planesHoy: apuntarPlanLocal(), local: true } };
  return { ok: true, uso: usoServidor ?? { planesHoy: planesHoyLocal(), local: true } };
}
