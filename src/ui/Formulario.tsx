// Formulario de entrada: modelo con autocompletado, presupuesto y uno o varios
// objetivos. La gama no se pide: se deduce del dinero y se muestra al vuelo, igual
// que el gasto mínimo del proyecto.

import type { FormEvent } from "react";
import type { Gama, ModeloVW, Objetivo, Presupuesto } from "../engine/types";
import { OBJETIVOS } from "./opciones";
import { Icono } from "./icons";
import { Requisitos } from "./Requisitos";
import { euros } from "./format";

interface Props {
  modelos: ModeloVW[];
  modeloTexto: string;
  modeloResuelto: ModeloVW | null;
  onModeloTexto: (valor: string) => void;
  presupuesto: number;
  onPresupuesto: (valor: number) => void;
  objetivos: Objetivo[];
  onAlternarObjetivo: (valor: Objetivo) => void;
  /** Gasto mínimo para que el proyecto tenga sentido. */
  suelo: number;
  /** Gama a la que da el presupuesto actual. null si no llega ni al suelo. */
  gamaEsperada: Gama | null;
/** Cálculo en vivo con lo que hay puesto ahora, para el desglose de abajo. */
  vistaPrevia: Presupuesto | null;
  onCalcular: () => void;
}

export function Formulario(p: Props) {
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    p.onCalcular();
  };

  const hayTexto = p.modeloTexto.trim() !== "";
  const sinObjetivos = p.objetivos.length === 0;
  const llegaAlSuelo = !sinObjetivos && p.presupuesto >= p.suelo;

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <div className="campo">
        <label htmlFor="modelo">Modelo</label>
        <input
          id="modelo"
          className="entrada"
          list="lista-modelos"
          autoComplete="off"
          placeholder="Golf GTI Mk5"
          value={p.modeloTexto}
          onChange={(e) => p.onModeloTexto(e.target.value)}
        />
        <datalist id="lista-modelos">
          {p.modelos.map((m) => (
            <option key={m.id} value={m.nombre} />
          ))}
        </datalist>

        {hayTexto &&
          (p.modeloResuelto ? (
            <p className="pista pista-ok">
              {p.modeloResuelto.nombre} · {p.modeloResuelto.motorDetalle} · chasis{" "}
              {p.modeloResuelto.chasis}
            </p>
          ) : (
            <div className="pista pista-aviso">
              <span>No reconozco ese modelo. Prueba con uno de estos:</span>
              <div className="chips-modelos">
                {p.modelos.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className="chip-modelo"
                    onClick={() => p.onModeloTexto(m.nombre)}
                  >
                    {m.nombre}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>

      <div className="campo">
        <label htmlFor="presupuesto">Presupuesto</label>
        <p className="campo-ayuda">
          Es el único techo. Cuanto más pongas, mejores piezas entran en la lista.
        </p>
        <div className="presupuesto-fila">
          <input
            id="presupuesto"
            className="entrada"
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            value={p.presupuesto}
            onChange={(e) => p.onPresupuesto(Math.max(0, Number(e.target.value) || 0))}
          />
          <input
            type="range"
            min={500}
            max={30000}
            step={100}
            aria-label="Presupuesto en euros"
            value={Math.min(30000, Math.max(500, p.presupuesto))}
            onChange={(e) => p.onPresupuesto(Number(e.target.value))}
          />
          <span className="valor-euros">{euros(p.presupuesto)}</span>
        </div>
      </div>

      <div className="campo">
        <span className="campo-titulo">Objetivo</span>
        <p className="campo-ayuda">Marca todos los que quieras. El mínimo sube al combinarlos.</p>
        <div className="objetivos" role="group" aria-label="Objetivos de la preparación">
          {OBJETIVOS.map((o) => {
            const activo = p.objetivos.includes(o.valor);
            return (
              <button
                type="button"
                key={o.valor}
                className={"objetivo" + (activo ? " activo" : "")}
                aria-pressed={activo}
                onClick={() => p.onAlternarObjetivo(o.valor)}
              >
                <span className="objetivo-cab">
                  <Icono nombre={o.icono} className="objetivo-icono" />
                  <span className="objetivo-nombre">{o.etiqueta}</span>
                </span>
                <span className="objetivo-frase">{o.frase}</span>
              </button>
            );
          })}
        </div>

        <div className={"suelo-vista" + (llegaAlSuelo ? " ok" : sinObjetivos ? "" : " corto")}>
          {sinObjetivos ? (
            <span>Elige al menos un objetivo.</span>
          ) : llegaAlSuelo ? (
            <>
              <span>
                Con {euros(p.presupuesto)} esto sale un build de gama{" "}
                <strong>{p.gamaEsperada}</strong>.
              </span>
              <span className="suelo-estado">mínimo del proyecto: {euros(p.suelo)}</span>
            </>
          ) : (
            <>
              <span>
                Un proyecto así pide al menos <strong>{euros(p.suelo)}</strong>.
              </span>
              <span className="suelo-estado">
                te faltan {euros(p.suelo - p.presupuesto)} para que cuadre
              </span>
            </>
          )}
        </div>

        {p.vistaPrevia && <Requisitos plan={p.vistaPrevia} />}
      </div>

      <button type="submit" className="btn btn-primario" disabled={sinObjetivos}>
        Calcular presupuesto
      </button>
    </form>
  );
}
