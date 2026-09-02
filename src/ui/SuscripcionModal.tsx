// Qué incluye cada plan y el botón que abre el pago. El motivo que trae el modal (por
// ejemplo, "querías combinar objetivos") se enseña arriba para que quien llega aquí sepa
// por qué ha llegado, no como un anuncio suelto.

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useCuenta } from "../cuenta/useCuenta";
import { abrirCheckout, activarConCodigo } from "../cuenta/api";
import { LIMITES } from "../suscripcion/planes";
import { abrirEnNavegador, enEscritorio } from "./entorno";
import { Icono } from "./icons";
import { Modal } from "./Modal";

/**
 * `euros()` (en `src/engine/format.ts`) redondea al entero: hecho para precios
 * orientativos de piezas, no para un cobro con céntimos exactos como este. Aquí hace
 * falta la cifra completa, 9,99 € y no 10 €.
 */
function precioExacto(centimos: number): string {
  return (centimos / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// El número de presupuestos no se escribe aquí: es el mismo que aplica la API cuando
// corta, así que sale de `LIMITES` y no puede quedarse desfasado.
const RASGOS_GRATIS = [
  "Un objetivo por presupuesto",
  "El motor elige todas las piezas",
  `${LIMITES.gratis.planesPorDia} presupuestos al día`,
];

const RASGOS_TALLER = [
  "Combina hasta cuatro objetivos a la vez",
  "Elige tú alguna pieza y deja el resto al motor",
  "Presupuestos sin límite al día",
  "Descarga la hoja de preparación en PDF",
];

export function SuscripcionModal() {
  const { modal, cerrarModal, plan, precio, refrescar } = useCuenta();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [esperandoPago, setEsperandoPago] = useState(false);

  // El código de acceso es para pruebas y demostraciones, una segunda vía junto al
  // botón de pagar. Si el servidor no tiene ninguno configurado, un intento devuelve
  // 404 y el bloque desaparece: no tiene sentido anunciar una puerta que no existe.
  const [codigo, setCodigo] = useState("");
  const [activando, setActivando] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [codigoOculto, setCodigoOculto] = useState(false);

  // Al volver del navegador a la app de escritorio se comprueba sola, sin que haya que
  // pulsar nada: basta con devolverle el foco a la ventana.
  useEffect(() => {
    if (!esperandoPago || !enEscritorio()) return;
    const alVolverElFoco = () => void refrescar();
    window.addEventListener("focus", alVolverElFoco);
    return () => window.removeEventListener("focus", alVolverElFoco);
  }, [esperandoPago, refrescar]);

  if (modal?.tipo !== "suscripcion") return null;

  const yaSuscrito = plan === "taller";

  const suscribirse = async () => {
    setProcesando(true);
    setError(null);
    const resultado = await abrirCheckout();
    setProcesando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    if (enEscritorio()) {
      // El pago no puede abrirse dentro de la ventana de la app: no hay barra de
      // direcciones y nadie vería que sigue en un sitio de confianza.
      await abrirEnNavegador(resultado.datos.url);
      setEsperandoPago(true);
    } else {
      window.location.href = resultado.datos.url;
    }
  };

  const comprobarAhora = async () => {
    setProcesando(true);
    await refrescar();
    setProcesando(false);
  };

  const activarCodigo = async (e: FormEvent) => {
    e.preventDefault();
    setActivando(true);
    setErrorCodigo(null);
    const resultado = await activarConCodigo(codigo.trim());
    setActivando(false);

    if (!resultado.ok) {
      if (resultado.codigo === 404) {
        setCodigoOculto(true);
        return;
      }
      setErrorCodigo(resultado.error);
      return;
    }

    await refrescar();
    cerrarModal();
  };

  return (
    <Modal eyebrow="Suscripción" titulo="Taller" onCerrar={cerrarModal}>
      {modal.motivo && <p className="modal-aviso">{modal.motivo}</p>}

      <div className="suscripcion-precio">
        <b>{precioExacto(precio.centimos)} €</b>
        <span>al {precio.periodo === "mes" ? "mes" : precio.periodo}</span>
      </div>

      <ul className="suscripcion-rasgos">
        {RASGOS_TALLER.map((rasgo) => (
          <li key={rasgo}>
            <Icono nombre="rayo" />
            <span>{rasgo}</span>
          </li>
        ))}
      </ul>

      <details className="suscripcion-gratis">
        <summary>Qué tiene el plan gratuito</summary>
        <ul>
          {RASGOS_GRATIS.map((rasgo) => (
            <li key={rasgo}>{rasgo}</li>
          ))}
        </ul>
      </details>

      {yaSuscrito ? (
        <p className="suscripcion-activa">Ya tienes la suscripción activa. Gracias por el apoyo.</p>
      ) : esperandoPago ? (
        <div className="suscripcion-esperando">
          <p>
            Termina el pago en la pestaña que se ha abierto. En cuanto vuelvas aquí, comprueba
            el estado.
          </p>
          <button type="button" className="btn btn-rojo" onClick={() => void comprobarAhora()} disabled={procesando}>
            <span>{procesando ? "Comprobando…" : "Ya he pagado"}</span>
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-rojo" onClick={() => void suscribirse()} disabled={procesando}>
          <span>{procesando ? "Abriendo el pago…" : "Suscribirse"}</span>
        </button>
      )}

      {error && (
        <p className="campo-error campo-error-general" role="alert">
          {error}
        </p>
      )}

      {!yaSuscrito && !esperandoPago && !codigoOculto && (
        <details className="suscripcion-codigo">
          <summary>¿Tienes un código de acceso?</summary>
          <form className="suscripcion-codigo-form" onSubmit={(e) => void activarCodigo(e)} noValidate>
            <input
              className="entrada"
              type="text"
              autoComplete="off"
              placeholder="Código de acceso"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
            <button type="submit" className="btn btn-sm" disabled={activando || !codigo.trim()}>
              <span>{activando ? "Comprobando…" : "Activar"}</span>
            </button>
          </form>
          {errorCodigo && (
            <p className="campo-error" role="alert">
              {errorCodigo}
            </p>
          )}
        </details>
      )}
    </Modal>
  );
}
