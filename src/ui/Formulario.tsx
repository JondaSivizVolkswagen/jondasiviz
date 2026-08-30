// Formulario de entrada: modelo en un desplegable agrupado por motor, presupuesto con
// suelo en el mínimo del proyecto, y uno o varios objetivos. La gama no se pide: se
// deduce del dinero y se muestra al vuelo, igual que el mínimo.

import { useMemo } from "react";
import type { FormEvent } from "react";
import type { GrupoElegible, ModeloVW, Objetivo, Presupuesto } from "../engine/types";
import { NOMBRE_OBJETIVO, enConflictoCon, fraseRiesgo } from "../engine/recommend";
import { OBJETIVOS } from "./opciones";
import { Icono } from "./icons";
import { Elecciones } from "./Elecciones";
import { euros } from "./format";

/** Extremos de la barra mientras no hay objetivos que den un mínimo y un techo reales. */
const SUELO_LIBRE = 500;
const TECHO_LIBRE = 30000;

/**
 * Salto de la barra. Una barra `range` cuenta sus pasos desde su propio `min`, así que
 * si el mínimo del proyecto es 1.380 € los valores serían 1.380, 1.480, 1.580... y
 * arrastrando no caerías nunca en una cifra redonda. Por eso el suelo de la barra se
 * redondea hacia arriba al siguiente centenar: sigue sin bajar del mínimo (queda por
 * encima) y además cada posición es un número limpio.
 */
const PASO = 100;

/** Rayas de la escala grabada sobre la pista del presupuesto. */
const MARCAS = Array.from({ length: 21 }, (_, i) => i);

interface Props {
  modelos: ModeloVW[];
  modeloId: string;
  modeloResuelto: ModeloVW | null;
  onModeloId: (valor: string) => void;
  presupuesto: number;
  onPresupuesto: (valor: number) => void;
  objetivos: Objetivo[];
  onAlternarObjetivo: (valor: Objetivo) => void;
  /**
   * Cálculo en vivo con lo que hay puesto ahora. De aquí salen la gama y el mínimo del
   * proyecto, para que el formulario y el resultado no puedan decir cifras distintas.
   */
  vistaPrevia: Presupuesto | null;
  /** Dinero a partir del cual poner más ya no cambia la lista. 0 si no aplica. */
  techoUtil: number;
  /** Partes con varias alternativas para este coche y estos objetivos. */
  grupos: GrupoElegible[];
  /** Pieza elegida a mano por grupo. Lo que no esté aquí lo elige el motor. */
  elecciones: Record<string, string>;
  onElegir: (grupo: string, piezaId: string) => void;
  onLimpiarElecciones: () => void;
}

export function Formulario(p: Props) {
  // No hay botón de calcular: el plan se rehace solo con cada cambio. El formulario
  // sigue siendo un <form> por semántica y por el `noValidate`, pero enviarlo con Enter
  // no tiene que recargar la página.
  const enviar = (e: FormEvent) => e.preventDefault();

  // El desplegable se agrupa por plataforma de motor. Con ocho modelos ya ayuda, y la
  // lista va a crecer: así el que busca su coche no lee ocho decenas de nombres seguidos.
  const porMotor = useMemo(() => {
    const grupos = new Map<string, ModeloVW[]>();
    for (const m of p.modelos) {
      const suyos = grupos.get(m.motor);
      if (suyos) suyos.push(m);
      else grupos.set(m.motor, [m]);
    }
    return [...grupos].sort(([a], [b]) => a.localeCompare(b));
  }, [p.modelos]);

  const sinObjetivos = p.objetivos.length === 0;
  const gama = p.vistaPrevia?.gamaResultante ?? null;

  // El mínimo lo pone el motor con el catálogo de este coche, así que la barra se
  // reajusta sola en cuanto se añada un modelo nuevo al vault. Nada cableado aquí.
  const minimo = p.vistaPrevia?.minimoEsencial ?? 0;
  const suelo = Math.ceil((minimo > 0 ? minimo : SUELO_LIBRE) / PASO) * PASO;

  // El techo tampoco es un número inventado: es lo que cuesta el build más completo que
  // admite este coche. Por encima de ahí la lista ya no cambia, solo crece el sobrante,
  // así que la barra se para y el recorrido entero sirve para algo. Se redondea hacia
  // arriba para que se pueda llegar al build completo y la rejilla siga siendo redonda.
  const techoCoche = Math.ceil(p.techoUtil / PASO) * PASO;
  const techo = techoCoche > suelo ? techoCoche : Math.max(TECHO_LIBRE, suelo + PASO);

  const llegaAlMinimo = !sinObjetivos && p.presupuesto >= minimo;
  const porDebajo = minimo > 0 && p.presupuesto < minimo;
  const porEncima = p.techoUtil > 0 && p.presupuesto > p.techoUtil;
  const riesgo = p.vistaPrevia ? fraseRiesgo(p.vistaPrevia) : null;

  return (
    // noValidate: el navegador validaba el `step` de la casilla y al escribir 9021
    // saltaba con "los dos valores válidos más cercanos son 9000 y 9100". Aquí se puede
    // escribir la cifra exacta que uno tiene; de avisar ya se encarga el motor, con
    // mensajes que dicen algo. El `step` se queda solo para las flechas del teclado.
    <form className="formulario" onSubmit={enviar} noValidate>
      <div className="bloque">
        <div className="bloque-cab">
          <h3>
            <label htmlFor="modelo">Vehículo</label>
          </h3>
          <span className="bloque-indice">01</span>
        </div>

        <select
          id="modelo"
          className="entrada"
          value={p.modeloId}
          onChange={(e) => p.onModeloId(e.target.value)}
        >
          {porMotor.map(([motor, suyos]) => (
            <optgroup key={motor} label={motor}>
              {suyos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {p.modeloResuelto && (
          <p className="ficha">
            {p.modeloResuelto.motorDetalle}
            <br />
            chasis {p.modeloResuelto.chasis} · {p.modeloResuelto.anios[0]}–
            {p.modeloResuelto.anios[1]} · tracción {p.modeloResuelto.traccion}
          </p>
        )}
      </div>

      <div className="bloque">
        <div className="bloque-cab">
          <h3>
            <label htmlFor="presupuesto">Presupuesto</label>
          </h3>
          <span className="bloque-indice">02</span>
        </div>

        <div className="medidor-cifra">
          <b>{p.presupuesto.toLocaleString("es-ES")}</b>
          <i>EUR · techo del proyecto</i>
        </div>

        <div className="pista-presupuesto">
          <div className="marcas" aria-hidden="true">
            {MARCAS.map((m) => (
              <span key={m} />
            ))}
          </div>
          <input
            type="range"
            min={suelo}
            max={techo}
            step={PASO}
            aria-label="Presupuesto en euros"
            value={Math.min(techo, Math.max(suelo, p.presupuesto))}
            onChange={(e) => p.onPresupuesto(Number(e.target.value))}
          />
        </div>

        <div className="extremos">
          <span>Mín {euros(suelo)}</span>
          <span>Todo {euros(techo)}</span>
        </div>

        <div className="fila-presupuesto">
          <input
            id="presupuesto"
            className={"entrada" + (porDebajo ? " entrada-peligro" : "")}
            type="number"
            min={0}
            step={PASO}
            inputMode="numeric"
            aria-invalid={porDebajo}
            value={p.presupuesto}
            onChange={(e) => p.onPresupuesto(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>

        <p className="campo-ayuda">
          Cuanto más pongas, mejores piezas entran en la lista.
          {minimo > 0 && p.techoUtil > 0 && (
            <>
              {" "}
              La barra va del mínimo del proyecto ({euros(minimo)}) a lo que cuesta montarlo
              todo ({euros(p.techoUtil)}). Fuera de ese tramo el dinero no cambia nada.
            </>
          )}
        </p>

        {/* Solo se llega aquí escribiendo la cifra a mano: la barra no deja bajar tanto. */}
        {porDebajo && (
          <div className="aviso aviso-rojo" role="alert">
            <p>
              {riesgo ?? `Con ${euros(p.presupuesto)} el proyecto se queda a medias.`}{" "}
              El mínimo para hacerlo entero son <strong>{euros(minimo)}</strong>.
            </p>
            <button type="button" className="btn btn-sm" onClick={() => p.onPresupuesto(minimo)}>
              <span>Subir a {euros(minimo)}</span>
            </button>
          </div>
        )}

        {/* Igual que arriba, la barra no llega aquí: solo se entra escribiendo la cifra. */}
        {porEncima && (
          <div className="aviso">
            <p>
              Con {euros(p.techoUtil)} ya entra todo lo que hay para este coche. Los{" "}
              {euros(p.presupuesto - p.techoUtil)} de más se quedan de sobrante, la lista es
              la misma.
            </p>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => p.onPresupuesto(p.techoUtil)}
            >
              <span>Ajustar a {euros(p.techoUtil)}</span>
            </button>
          </div>
        )}
      </div>

      <div className="bloque">
        <div className="bloque-cab">
          <span className="campo-titulo">Objetivo</span>
          <span className="bloque-indice">03</span>
        </div>

        <div className="objetivos" role="group" aria-label="Objetivos de la preparación">
          {OBJETIVOS.map((o) => {
            const activo = p.objetivos.includes(o.valor);
            // El que se va a soltar si pulsas este. Se marca para que el cambio no
            // pase desapercibido: pulsas drag y drift se apaga solo.
            const suelta = !activo
              ? enConflictoCon(o.valor).filter((c) => p.objetivos.includes(c))
              : [];
            const enConflicto = suelta.length > 0;

            return (
              <button
                type="button"
                key={o.valor}
                className={
                  "objetivo" + (activo ? " activo" : "") + (enConflicto ? " en-conflicto" : "")
                }
                aria-pressed={activo}
                onClick={() => p.onAlternarObjetivo(o.valor)}
              >
                <span className="objetivo-cab">
                  <Icono nombre={o.icono} className="objetivo-icono" />
                  <span className="objetivo-nombre">{o.etiqueta}</span>
                </span>
                <span className="objetivo-frase">{o.frase}</span>
                {enConflicto && (
                  <span className="objetivo-conflicto">
                    sustituye a {suelta.map((c) => NOMBRE_OBJETIVO[c]).join(", ")}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="campo-ayuda">
          Marca todos los que quieras. El mínimo sube al combinarlos. Drift y drag son la
          excepción: piden preparaciones contrarias, así que al elegir uno se suelta el otro.
        </p>

        {/* Solo la gama del build. El mínimo lo cuenta Requisitos, junto al plan. */}
        <div className={"lectura" + (sinObjetivos ? "" : llegaAlMinimo ? " ok" : " corto")}>
          {sinObjetivos ? (
            <span>Marca al menos un objetivo.</span>
          ) : gama ? (
            <span>
              Con {euros(p.presupuesto)} sale un build de gama <strong>{gama}</strong>
            </span>
          ) : (
            <span>Con {euros(p.presupuesto)} todavía no entra ninguna pieza.</span>
          )}
        </div>

        <Elecciones
          grupos={p.grupos}
          elecciones={p.elecciones}
          onElegir={p.onElegir}
          onLimpiar={p.onLimpiarElecciones}
        />
      </div>

      {/* En pantalla ancha el plan está al lado y esto sobra. En móvil queda debajo de
          todo el formulario, así que hace falta un empujón para llegar. */}
      <a className="btn btn-rojo ir-al-plan" href="#plan">
        <span>Ver el presupuesto</span>
      </a>
    </form>
  );
}
