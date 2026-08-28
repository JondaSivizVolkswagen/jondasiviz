// Selector de piezas concretas. Por cada parte del coche donde hay más de una
// alternativa compatible, el comprador puede quedarse con la que quiera o dejar que
// decida el motor, que es lo que viene por defecto.
//
// Las partes no están escritas aquí: salen del catálogo (`gruposElegibles`). En cuanto
// el vault tenga varios parachoques del mismo coche compartiendo `grupoExclusivo`,
// aparece su fila sola, sin tocar este archivo.

import type { GrupoElegible } from "../engine/types";
import { NOMBRE_CATEGORIA } from "../engine/recommend";
import { euros } from "./format";

interface Props {
  grupos: GrupoElegible[];
  /** Pieza elegida por grupo. Sin entrada = lo elige el motor. */
  elecciones: Record<string, string>;
  onElegir: (grupo: string, piezaId: string) => void;
  onLimpiar: () => void;
}

export function Elecciones({ grupos, elecciones, onElegir, onLimpiar }: Props) {
  if (grupos.length === 0) return null;

  const elegidas = grupos.filter((g) => elecciones[g.grupo]).length;

  return (
    <details className="elecciones">
      <summary>
        <span className="elecciones-titulo">Elegir tú alguna pieza</span>
        <span className="elecciones-estado">
          {elegidas > 0
            ? `${elegidas} de ${grupos.length} elegidas por ti`
            : `${grupos.length} partes con alternativas`}
        </span>
      </summary>

      <p className="campo-ayuda">
        Solo salen las partes con más de una opción para este coche. Lo que no toques lo
        sigue eligiendo el motor con el dinero que le quede.
      </p>

      <div className="elecciones-lista">
        {grupos.map((g) => {
          const valor = elecciones[g.grupo] ?? "";
          return (
            <label className="eleccion" key={g.grupo}>
              <span className="eleccion-nombre">
                {g.nombre}
                <span className="eleccion-categoria">{NOMBRE_CATEGORIA[g.categoria]}</span>
              </span>
              <select
                className={"entrada" + (valor ? " entrada-elegida" : "")}
                value={valor}
                onChange={(e) => onElegir(g.grupo, e.target.value)}
              >
                <option value="">Que elija el motor</option>
                {g.piezas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {euros(p.precio.estimado)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      {elegidas > 0 && (
        <button type="button" className="btn btn-fantasma btn-sm" onClick={onLimpiar}>
          Devolvérselo todo al motor
        </button>
      )}
    </details>
  );
}
