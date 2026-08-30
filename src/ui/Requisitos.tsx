// Desglose en vivo de lo que pide el proyecto: cuánto cuesta cubrir lo esencial por
// lo mínimo, y qué categorías entran y cuáles no con el dinero de ahora.

import type { Presupuesto } from "../engine/types";
import { NOMBRE_CATEGORIA, fraseMinimo } from "../engine/recommend";
import { euros } from "./format";

export function Requisitos({ plan }: { plan: Presupuesto }) {
  const { esenciales, peticion } = plan;
  if (peticion.objetivos.length === 0 || esenciales.length === 0) return null;

  const dentro = esenciales.filter((e) => e.cubierta);
  const llega = peticion.presupuesto >= plan.minimoEsencial;

  return (
    <div className="requisitos">
      <p className={"requisitos-titulo" + (llega ? "" : " requisitos-corto")}>
        {fraseMinimo(plan)}
      </p>

      <ul className="requisitos-lista">
        {esenciales.map((e) => (
          <li key={e.categoria} className={e.cubierta ? "entra" : "no-entra"}>
            <span className="requisitos-marca" aria-hidden="true">
              {e.cubierta ? "●" : "○"}
            </span>
            <span className="requisitos-nombre">{NOMBRE_CATEGORIA[e.categoria]}</span>
            <span className="requisitos-pieza">
              {e.pieza ? e.pieza.nombre : "nada en el catálogo todavía"}
            </span>
            <span className="requisitos-precio">
              {e.pieza ? (e.minimo > 0 ? euros(e.minimo) : "incluido") : "—"}
            </span>
          </li>
        ))}
      </ul>

      <p className="requisitos-pie">
        Entran {dentro.length} de {esenciales.length} categorías
      </p>
    </div>
  );
}
