// Panel plegable con todas las piezas que encajan en el motor del modelo, repartidas por gama.

import { useMemo, useState } from "react";
import { crearClasificadorReglas } from "../agents";
import { piezasDeModelo } from "../engine/graph";
import { NOMBRE_CATEGORIA } from "../engine/recommend";
import type { Gama, ModeloVW } from "../engine/types";
import { GAMAS } from "./opciones";
import { Icono } from "./icons";
import { euros } from "./format";

export function PiezasCompatibles({ modelo }: { modelo: ModeloVW }) {
  const clasificador = useMemo(() => crearClasificadorReglas(), []);
  const compatibles = useMemo(() => piezasDeModelo(modelo), [modelo]);
  const grupos = useMemo(() => clasificador.agrupar(compatibles), [clasificador, compatibles]);
  const [gama, setGama] = useState<Gama>("baja");
  const lista = grupos[gama];

  return (
    <details className="panel">
      <summary className="panel-cab">
        <span>Catálogo compatible · {compatibles.length} piezas</span>
        <Icono nombre="chevron" className="panel-chevron" />
      </summary>
      <div className="panel-cuerpo">
        <div className="segmento" role="group" aria-label="Gama">
          {GAMAS.map((g) => (
            <button
              type="button"
              key={g.valor}
              className={"segmento-opcion" + (gama === g.valor ? " activa" : "")}
              aria-pressed={gama === g.valor}
              onClick={() => setGama(g.valor)}
            >
              {g.etiqueta}
              <span className="segmento-conteo"> {grupos[g.valor].length}</span>
            </button>
          ))}
        </div>

        {lista.length > 0 ? (
          <ul className="lineas">
            {lista.map((pieza) => (
              <li className="linea" key={pieza.id}>
                <div className="linea-texto">
                  <span className="linea-nombre">{pieza.nombre}</span>
                  <span className="linea-nota">{NOMBRE_CATEGORIA[pieza.categoria]}</span>
                </div>
                <span className="linea-precio">{euros(pieza.precio.estimado)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="vacio">No hay piezas de gama {gama} para este motor.</p>
        )}
      </div>
    </details>
  );
}
