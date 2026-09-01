// Resultado del cálculo: cabecera, barra de gasto, avisos y piezas por categoría.

import { useState } from "react";
import type { ResultadoSelector } from "../agents";
import { NOMBRE_CATEGORIA, NOMBRE_OBJETIVO } from "../engine/recommend";
import { descargarPdf } from "../export/pdf";
import { euros } from "./format";

interface Props {
  resultado: ResultadoSelector;
  onProbarPresupuesto: (presupuesto: number) => void;
}

export function Resultado({ resultado, onProbarPresupuesto }: Props) {
  const { modelo, presupuesto, cumpleSuelo, siguienteEscalon, avisos } = resultado;
  const [generando, setGenerando] = useState(false);
  const [falloPdf, setFalloPdf] = useState(false);

  // pdfmake llega por import() dinámico, así que la primera descarga tarda un poco.
  const bajarPdf = async () => {
    if (!modelo || !presupuesto) return;
    setGenerando(true);
    setFalloPdf(false);
    try {
      await descargarPdf({ modelo, plan: presupuesto, siguienteEscalon, avisos });
    } catch {
      setFalloPdf(true);
    } finally {
      setGenerando(false);
    }
  };

  if (!modelo || !presupuesto) {
    return (
      <section className="tarjeta resultado-vacio" aria-live="polite">
        <h2>No pudimos calcular el presupuesto</h2>
        {avisos.map((a) => (
          <p key={a} className="aviso-linea">
            {a}
          </p>
        ))}
      </section>
    );
  }

  const pet = presupuesto.peticion;
  const gastado = presupuesto.total;
  const tope = pet.presupuesto;
  const sobrante = Math.max(0, presupuesto.restante);
  const porcentaje = tope > 0 ? Math.min(100, Math.round((gastado / tope) * 100)) : 0;
  const avisosRestantes = cumpleSuelo ? avisos : avisos.slice(1);

  return (
    <section className="resultado" aria-live="polite">
      <header className="resultado-cab">
        <h2>{modelo.nombre}</h2>
        <p className="resultado-sub">
          {modelo.motorDetalle} · chasis {modelo.chasis}
        </p>
        <div className="chips">
          <span className="chip">{euros(tope)}</span>
          {presupuesto.gamaResultante && (
            <span className="chip chip-gama">Build de gama {presupuesto.gamaResultante}</span>
          )}
          <span className="chip">
            {pet.objetivos.length > 1 ? "Objetivos" : "Objetivo"}{" "}
            {pet.objetivos.map((o) => NOMBRE_OBJETIVO[o]).join(" + ")}
          </span>
        </div>

        <div className="resultado-acciones">
          <button
            type="button"
            className="btn btn-fantasma btn-sm"
            onClick={bajarPdf}
            disabled={generando}
          >
            {generando ? "Preparando el PDF…" : "Descargar en PDF"}
          </button>
          {falloPdf && (
            <span className="aviso-linea">No se pudo generar el PDF. Vuelve a intentarlo.</span>
          )}
        </div>
      </header>

      <div className="tarjeta barra-bloque">
        <div className="barra-cifras">
          <span>
            <strong>{euros(gastado)}</strong> de {euros(tope)}
          </span>
          <span className="barra-sobrante">Sobran {euros(sobrante)}</span>
        </div>
        <div className="barra-pista">
          <div className="barra-relleno" style={{ width: `${porcentaje}%` }} />
        </div>
      </div>

      {!cumpleSuelo && (
        <div className="aviso-suelo">
          <p>{avisos[0]}</p>
          {siguienteEscalon && (
            <button
              type="button"
              className="btn btn-fantasma btn-sm"
              onClick={() => onProbarPresupuesto(siguienteEscalon.presupuesto)}
            >
              Ver qué sale con {euros(siguienteEscalon.presupuesto)}
            </button>
          )}
        </div>
      )}

      {avisosRestantes.length > 0 && (
        <ul className="avisos">
          {avisosRestantes.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      {presupuesto.porCategoria.length > 0 ? (
        <div className="categorias">
          {presupuesto.porCategoria.map((grupo) => (
            <div className="categoria" key={grupo.categoria}>
              <div className="categoria-cab">
                <h3>{NOMBRE_CATEGORIA[grupo.categoria]}</h3>
                <span className="categoria-total">{euros(grupo.total)}</span>
              </div>
              <ul className="lineas">
                {grupo.lineas.map((linea) => (
                  <li className="linea" key={linea.pieza.id}>
                    <div className="linea-texto">
                      <span className="linea-nombre">
                        {linea.pieza.nombre}
                        <span className={`etiqueta etiqueta-${linea.pieza.gama}`}>
                          {linea.pieza.gama}
                        </span>
                        {linea.motivo === "dependencia" && (
                          <span className="etiqueta">dependencia</span>
                        )}
                      </span>
                      {linea.pieza.nota && <span className="linea-nota">{linea.pieza.nota}</span>}
                    </div>
                    <span className="linea-precio">{euros(linea.precio)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="aviso-linea">
          Con lo que has puesto no entra ninguna pieza de esta gama para este objetivo. Sube el
          presupuesto o baja la gama.
        </p>
      )}

      {cumpleSuelo && siguienteEscalon && (
        <div className="escalon">
          <p>
            Con {euros(siguienteEscalon.presupuesto)} esto pasaría a ser un build de gama{" "}
            {siguienteEscalon.gama}.
          </p>
          <button
            type="button"
            className="btn btn-fantasma btn-sm"
            onClick={() => onProbarPresupuesto(siguienteEscalon.presupuesto)}
          >
            Probarlo
          </button>
        </div>
      )}

      {presupuesto.siguientesMejoras.length > 0 && (
        <div className="tarjeta mejoras">
          <h3>Siguientes mejoras si subes el presupuesto</h3>
          <ul>
            {presupuesto.siguientesMejoras.map((mejora) => (
              <li key={mejora.pieza.id}>
                <div className="linea-texto">
                  <span className="linea-nombre">{mejora.pieza.nombre}</span>
                  <span className="linea-nota">
                    {NOMBRE_CATEGORIA[mejora.pieza.categoria]}
                    {mejora.sustituye && ` · en lugar de ${mejora.sustituye.nombre}`}
                  </span>
                </div>
                <div className="mejora-cifras">
                  <span className="linea-precio">{euros(mejora.precio)}</span>
                  <span className={"mejora-falta" + (mejora.falta === 0 ? " lista" : "")}>
                    {mejora.falta === 0
                      ? "ya te lo puedes permitir"
                      : `faltan ${euros(mejora.falta)}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
