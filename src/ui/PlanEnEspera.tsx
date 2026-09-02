// Lo que ocupa la columna del plan antes de generar el primero.
//
// No es un hueco a la espera de contenido: dice qué va a aparecer ahí y con qué se va a
// hacer, y repite la configuración puesta para que se vea que la pantalla está viva. Lo
// que no hace es adelantar ni una cifra del resultado, que es justo de lo que va el
// botón.

import type { ModeloVW, Objetivo } from "../engine/types";
import { NOMBRE_OBJETIVO } from "../engine/recommend";
import { euros } from "./format";

/** Las cuatro cosas que se leen aquí en cuanto hay presupuesto, en el mismo orden. */
const APARTADOS = [
  ["01", "Gasto y sobrante", "cuánto se va en piezas y qué queda del techo"],
  ["02", "Piezas por categoría", "la lista completa, con la gama de cada pieza"],
  ["03", "Lo esencial", "qué categorías entran con ese dinero y cuáles se quedan fuera"],
  ["04", "Siguientes mejoras", "lo que se queda a las puertas y por cuánto"],
];

interface Props {
  modelo: ModeloVW | null;
  presupuesto: number;
  objetivos: Objetivo[];
}

export function PlanEnEspera({ modelo, presupuesto, objetivos }: Props) {
  return (
    <section className="plan-espera">
      <p className="eyebrow">Hoja de preparación</p>
      <h2>Sin generar</h2>

      <div className="chips">
        <span className="chip">{modelo ? modelo.nombre : "sin coche"}</span>
        <span className="chip">{euros(presupuesto)}</span>
        {objetivos.length > 0 && (
          <span className="chip">{objetivos.map((o) => NOMBRE_OBJETIVO[o]).join(" + ")}</span>
        )}
      </div>

      <p className="espera-texto">
        Ajusta el coche, el dinero y el objetivo, y pulsa Generar presupuesto. La lista se
        arma con el catálogo de piezas que encajan en ese coche y con lo que cabe en el
        dinero que has puesto.
      </p>

      <ul className="espera-mapa">
        {APARTADOS.map(([indice, titulo, detalle]) => (
          <li key={indice}>
            <span className="espera-indice">{indice}</span>
            <span className="espera-titulo">{titulo}</span>
            <span className="espera-detalle">{detalle}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
