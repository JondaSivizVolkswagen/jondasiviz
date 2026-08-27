// Formulario de entrada: modelo con autocompletado, gama segmentada, presupuesto y objetivo.

import type { FormEvent } from "react";
import type { Gama, ModeloVW, Objetivo } from "../engine/types";
import { GAMAS, OBJETIVOS } from "./opciones";
import { Icono } from "./icons";
import { euros } from "./format";

interface Props {
  modelos: ModeloVW[];
  modeloTexto: string;
  modeloResuelto: ModeloVW | null;
  onModeloTexto: (valor: string) => void;
  gama: Gama;
  onGama: (valor: Gama) => void;
  presupuesto: number;
  onPresupuesto: (valor: number) => void;
  objetivo: Objetivo;
  onObjetivo: (valor: Objetivo) => void;
  onCalcular: () => void;
}

export function Formulario(p: Props) {
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    p.onCalcular();
  };

  const hayTexto = p.modeloTexto.trim() !== "";

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
        <span className="campo-titulo">Gama de piezas</span>
        <div className="segmento" role="group" aria-label="Gama de piezas">
          {GAMAS.map((g) => (
            <button
              type="button"
              key={g.valor}
              className={"segmento-opcion" + (p.gama === g.valor ? " activa" : "")}
              aria-pressed={p.gama === g.valor}
              onClick={() => p.onGama(g.valor)}
            >
              {g.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="campo">
        <label htmlFor="presupuesto">Presupuesto</label>
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
            max={25000}
            step={100}
            aria-label="Presupuesto en euros"
            value={Math.min(25000, Math.max(500, p.presupuesto))}
            onChange={(e) => p.onPresupuesto(Number(e.target.value))}
          />
          <span className="valor-euros">{euros(p.presupuesto)}</span>
        </div>
      </div>

      <div className="campo">
        <span className="campo-titulo">Objetivo</span>
        <div className="objetivos" role="group" aria-label="Objetivo de la preparación">
          {OBJETIVOS.map((o) => (
            <button
              type="button"
              key={o.valor}
              className={"objetivo" + (p.objetivo === o.valor ? " activo" : "")}
              aria-pressed={p.objetivo === o.valor}
              onClick={() => p.onObjetivo(o.valor)}
            >
              <span className="objetivo-cab">
                <Icono nombre={o.icono} className="objetivo-icono" />
                <span className="objetivo-nombre">{o.etiqueta}</span>
              </span>
              <span className="objetivo-frase">{o.frase}</span>
            </button>
          ))}
        </div>
      </div>

      <button type="submit" className="btn btn-primario">
        Calcular presupuesto
      </button>
    </form>
  );
}
