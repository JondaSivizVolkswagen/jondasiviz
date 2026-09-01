// Resultado del cálculo: cabecera, telemetría de gasto, avisos y piezas por categoría.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ResultadoSelector } from "../agents";
import {
  NOMBRE_CATEGORIA,
  NOMBRE_OBJETIVO,
  fraseMinimo,
  fraseRiesgo,
  normalizarObjetivos,
} from "../engine/recommend";
import { descargarPdf } from "../export/pdf";
import { comprobarLimite } from "../cuenta/api";
import { useCuenta } from "../cuenta/useCuenta";
import { MOTIVO_PDF } from "../cuenta/gating";
import { euros } from "./format";

interface Props {
  resultado: ResultadoSelector;
  onProbarPresupuesto: (presupuesto: number) => void;
}

/**
 * El total no salta de una cifra a otra: cuenta hasta ella. Con la lista cambiando bajo
 * la mano, el número que se mueve es lo que dice "esto que has tocado ha hecho algo".
 */
function useContador(destino: number) {
  const [valor, setValor] = useState(destino);
  const desde = useRef(destino);

  useEffect(() => {
    const inicio = performance.now();
    const origen = desde.current;
    const salto = destino - origen;
    if (salto === 0) return;

    let vivo = true;
    const paso = () => {
      if (!vivo) return;
      const t = Math.min(1, (performance.now() - inicio) / 550);
      const suave = 1 - Math.pow(1 - t, 3);
      setValor(Math.round(origen + salto * suave));
      if (t < 1) requestAnimationFrame(paso);
      else desde.current = destino;
    };
    requestAnimationFrame(paso);

    return () => {
      vivo = false;
      desde.current = destino;
    };
  }, [destino]);

  return valor;
}

export function Resultado({ resultado, onProbarPresupuesto }: Props) {
  const { modelo, presupuesto, cumpleMinimo, siguienteEscalon, avisos } = resultado;
  const { limites, abrirSuscripcion } = useCuenta();
  const [generando, setGenerando] = useState(false);
  const [falloPdf, setFalloPdf] = useState(false);
  const contado = useContador(presupuesto ? presupuesto.total : 0);

  // pdfmake llega por import() dinámico, así que la primera descarga tarda un poco.
  const bajarPdf = async () => {
    if (!modelo || !presupuesto) return;

    if (!limites.exportarPdf) {
      abrirSuscripcion(MOTIVO_PDF);
      return;
    }

    setGenerando(true);
    setFalloPdf(false);
    try {
      // Antes de generar el PDF de verdad se le pregunta al servidor, que es quien manda:
      // la interfaz puede desactivar el botón, pero eso se salta abriendo las
      // herramientas del navegador. Si la API no contesta (sin conexión, escritorio sin
      // servidor) se sigue igual: la app no se rompe porque el backend esté apagado.
      const veredicto = await comprobarLimite({
        modelo: presupuesto.peticion.modelo ?? modelo.id,
        presupuesto: presupuesto.peticion.presupuesto,
        objetivos: presupuesto.peticion.objetivos,
        elecciones: presupuesto.peticion.elecciones ?? [],
      });
      if (!veredicto.ok && veredicto.codigo === 402) {
        abrirSuscripcion(veredicto.error);
        return;
      }

      await descargarPdf({ modelo, plan: presupuesto, siguienteEscalon, avisos });
    } catch {
      setFalloPdf(true);
    } finally {
      setGenerando(false);
    }
  };

  if (!modelo || !presupuesto) {
    return (
      <section className="resultado-vacio" aria-live="polite">
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
  const objetivos = normalizarObjetivos(pet.objetivos);
  const riesgo = fraseRiesgo(presupuesto);

  return (
    // Sin `aria-live` en toda la sección: el plan se rehace en cada pulsación de tecla y
    // un lector de pantalla leería la lista entera con cada dígito del presupuesto. Se
    // anuncia solo el resumen, que es lo que de verdad hay que oír.
    <>
      <header className="plan-cab">
        <p className="eyebrow">Hoja de preparación</p>
        <h2 className="plan-modelo">{modelo.nombre}</h2>
        <p className="plan-sub">
          {modelo.motorDetalle} · chasis {modelo.chasis}
        </p>

        <div className="chips">
          {presupuesto.gamaResultante && (
            <span className="chip chip-gama">Gama {presupuesto.gamaResultante}</span>
          )}
          <span className="chip">{objetivos.map((o) => NOMBRE_OBJETIVO[o]).join(" + ")}</span>
          <span className="chip">{presupuesto.lineas.length} piezas</span>
        </div>

        <div className="telemetria">
          <div className="telemetria-cifras">
            <div>
              <div className="total-grande">{euros(contado)}</div>
              <div className="total-de">Gastado de {euros(tope)}</div>
            </div>
            <div className="total-lateral">
              <b>{euros(sobrante)}</b>
              <span>Sobrante</span>
            </div>
          </div>
          <div className="riel">
            <div className="riel-relleno" style={{ width: `${porcentaje}%` }} />
          </div>
        </div>

        <p className="visualmente-oculto" role="status">
          {presupuesto.lineas.length} piezas, {euros(gastado)} de {euros(tope)}.
        </p>

        <div className="acciones-plan">
          <button
            type="button"
            className={"btn btn-sm" + (limites.exportarPdf ? "" : " btn-bloqueado")}
            onClick={() => void bajarPdf()}
            disabled={generando}
            title={limites.exportarPdf ? undefined : MOTIVO_PDF}
          >
            <span>{generando ? "Preparando el PDF…" : "Descargar en PDF"}</span>
          </button>
          {falloPdf && (
            <span className="aviso-linea">No se pudo generar el PDF. Vuelve a intentarlo.</span>
          )}
        </div>
      </header>

      {/* El mínimo lo cuenta el motor con la misma frase que el formulario y el PDF. */}
      {!cumpleMinimo && objetivos.length > 0 && (
        <div className="aviso-suelo">
          {riesgo && <p className="aviso-riesgo">{riesgo}</p>}
          <p>{fraseMinimo(presupuesto)}</p>
          {siguienteEscalon && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onProbarPresupuesto(siguienteEscalon.presupuesto)}
            >
              <span>Ver qué sale con {euros(siguienteEscalon.presupuesto)}</span>
            </button>
          )}
        </div>
      )}

      {avisos.length > 0 && (
        <ul className="avisos">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      {presupuesto.porCategoria.length > 0 ? (
        <div className="categorias">
          {presupuesto.porCategoria.map((grupo, i) => (
            <div
              className="categoria"
              key={grupo.categoria}
              style={{ "--i": i } as CSSProperties}
            >
              <div className="categoria-cab">
                <span className="categoria-indice">{String(i + 1).padStart(2, "0")}</span>
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
                        {linea.motivo === "elegida" && (
                          <span className="etiqueta etiqueta-elegida">tuya</span>
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
        <div className="resultado-vacio">
          <p className="vacio">
            Con lo que has puesto no entra ninguna pieza para este objetivo. Sube el
            presupuesto.
          </p>
        </div>
      )}

      {cumpleMinimo && siguienteEscalon && (
        <div className="escalon">
          <p>
            Con {euros(siguienteEscalon.presupuesto)} esto pasaría a ser un build de gama{" "}
            {siguienteEscalon.gama}.
          </p>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onProbarPresupuesto(siguienteEscalon.presupuesto)}
          >
            <span>Probarlo</span>
          </button>
        </div>
      )}

      {presupuesto.siguientesMejoras.length > 0 && (
        <div className="mejoras">
          <h3>Siguientes mejoras</h3>
          <ul>
            {presupuesto.siguientesMejoras.map((mejora) => (
              <li key={mejora.pieza.id}>
                <div className="linea-texto">
                  <span className="linea-nombre">{mejora.pieza.nombre}</span>
                  <span className="linea-nota">{NOMBRE_CATEGORIA[mejora.pieza.categoria]}</span>
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
    </>
  );
}
