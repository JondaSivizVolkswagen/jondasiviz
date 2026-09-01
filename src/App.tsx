import { useEffect, useMemo, useState } from "react";
import { buscarModelo, listarModelos } from "./engine/graph";
import { alternarObjetivo as aplicarObjetivo } from "./engine/recommend";
import { crearSelector } from "./agents";
import type { Objetivo } from "./engine/types";
import { cerrarApp, enEscritorio } from "./ui/entorno";
import { Icono } from "./ui/icons";
import { Formulario } from "./ui/Formulario";
import { Resultado } from "./ui/Resultado";
import { Requisitos } from "./ui/Requisitos";
import { PiezasCompatibles } from "./ui/PiezasCompatibles";
import { useCuenta } from "./cuenta/useCuenta";
import { motivoObjetivos } from "./cuenta/gating";
import { AccesoModal } from "./ui/AccesoModal";
import { SuscripcionModal } from "./ui/SuscripcionModal";
import { PerfilModal } from "./ui/PerfilModal";
import { CuentaBarra } from "./ui/CuentaBarra";
import "./App.css";
import "./ui/cuenta.css";

function App() {
  const modelos = useMemo(() => listarModelos(), []);
  const selector = useMemo(() => crearSelector(), []);
  // Se mira una sola vez: no cambia de entorno a mitad de sesion.
  const escritorio = useMemo(() => enEscritorio(), []);

  const cuenta = useCuenta();
  const {
    modal: modalCuenta,
    usuario,
    perfil,
    plan: planCuenta,
    limites,
    cargando: cargandoCuenta,
    abrirSuscripcion,
    salir,
  } = cuenta;

  // El Mk5 es el modelo de referencia del catálogo, así que arranca en él si no hay
  // cuenta o su coche no está en el vault. Mientras se sabe si hay cuenta, mientras
  // tanto se enseña el mismo por defecto, no una casilla vacía.
  const modeloPorDefecto = useMemo(
    () => (modelos.find((m) => m.id === "golf-gti-mk5") ?? modelos[0])?.id ?? "",
    [modelos],
  );
  // null en cuanto la persona toca el desplegable: a partir de ahí manda su elección, no
  // el coche de su perfil, así que cambiarlo en el perfil no le mueve el build a medio
  // hacer.
  const [modeloElegido, setModeloElegido] = useState<string | null>(null);
  const modeloId =
    modeloElegido ??
    (!cargandoCuenta && perfil?.coche && modelos.some((m) => m.id === perfil.coche)
      ? perfil.coche
      : modeloPorDefecto);

  const [presupuesto, setPresupuesto] = useState(6500);
  const [objetivos, setObjetivos] = useState<Objetivo[]>(["drag"]);
  // Pieza elegida a mano, por grupo. Se guarda por grupo y no como lista suelta para que
  // volver a "que elija el motor" sea quitar la clave, y para que cambiar de coche no
  // borre lo elegido: el selector ya ignora lo que no aplique.
  const [elecciones, setElecciones] = useState<Record<string, string>>({});
  const [progreso, setProgreso] = useState(0);

  const idsElegidos = useMemo(
    () => Object.values(elecciones).filter(Boolean),
    [elecciones],
  );

  const modeloResuelto = useMemo(() => buscarModelo(modeloId, modelos), [modeloId, modelos]);

  // El plan se recalcula en cada cambio, no al pulsar un botón. Con los controles y la
  // lista uno al lado del otro, un resultado congelado no se lee como "todavía no has
  // calculado", se lee como que la aplicación falla. Sale en milisegundos.
  const plan = useMemo(
    () =>
      selector.seleccionar({
        modelo: modeloId,
        presupuesto,
        objetivos,
        elecciones: idsElegidos,
      }),
    [selector, modeloId, presupuesto, objetivos, idsElegidos],
  );

  // Hilo rojo de progreso de lectura, pegado al borde superior de la ventana.
  useEffect(() => {
    const alScroll = () => {
      const raiz = document.documentElement;
      const recorrido = raiz.scrollHeight - raiz.clientHeight;
      setProgreso(recorrido > 0 ? (raiz.scrollTop / recorrido) * 100 : 0);
    };
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  // Al volver del pago (simulado o de Stripe) la URL trae la respuesta. El aviso sale del
  // primer render, leyendo la URL tal cual llega; el efecto solo hace lo que no puede
  // pasar durante el render: limpiar la barra de direcciones para que un F5 no la repita,
  // y refrescar la cuenta para que la pastilla del plan ya diga "Taller".
  const [avisoPago, setAvisoPago] = useState<string | null>(() => {
    switch (new URLSearchParams(window.location.search).get("suscripcion")) {
      case "lista":
        return "Ya eres del taller. Combina objetivos y elige piezas cuando quieras.";
      case "cancelada":
        return "El pago se ha quedado a medias. Sigues en el plan gratuito.";
      default:
        return null;
    }
  });
  useEffect(() => {
    const resultado = new URLSearchParams(window.location.search).get("suscripcion");
    if (!resultado) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (resultado === "lista") void cuenta.refrescar();
  }, [cuenta]);

  // Las reglas de qué objetivo descarta a cuál viven en el motor, no aquí. Lo que sí
  // decide la interfaz es si el resultado cabe en el plan: si no cabe, no se aplica y se
  // enseña por qué, con la puerta abierta a suscribirse.
  const alternarObjetivo = (o: Objetivo) => {
    const siguiente = aplicarObjetivo(objetivos, o);
    if (siguiente.length > objetivos.length) {
      const motivo = motivoObjetivos(limites, siguiente.length);
      if (motivo) {
        abrirSuscripcion(motivo);
        return;
      }
    }
    setObjetivos(siguiente);
  };

  const elegirPieza = (grupo: string, piezaId: string) => {
    setElecciones((prev) => {
      const siguiente = { ...prev };
      if (piezaId) siguiente[grupo] = piezaId;
      else delete siguiente[grupo];
      return siguiente;
    });
  };

  return (
    <div className="app">
      <div className="progreso" style={{ width: `${progreso}%` }} />

      <header className="barra">
        {/* La marca lleva a la portada, que es lo que espera cualquiera. */}
        <a className="marca" href="/">
          <i />
          Jondasiviz <span>Build Planner</span>
        </a>

        <div className="barra-acciones">
          <div className="cuenta-barra">
            <CuentaBarra />
            {usuario && (
              <>
                <button
                  type="button"
                  className={"chip plan-pill" + (planCuenta === "taller" ? " chip-gama" : "")}
                  onClick={() => planCuenta === "gratis" && abrirSuscripcion(null)}
                >
                  {planCuenta === "taller" ? "Taller" : "Gratis"}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => void salir()}>
                  <span>Cerrar sesión</span>
                </button>
              </>
            )}
          </div>

          {/* La portada es la misma en la web y en la app, asi que el destino tambien.
              Lo unico que cambia es que en el programa se puede salir, y en una web no. */}
          <a className="btn btn-sm volver" href="/">
            <Icono nombre="flechaIzquierda" />
            <span>Portada</span>
          </a>
          {escritorio && (
            <button type="button" className="btn btn-sm volver" onClick={() => void cerrarApp()}>
              <Icono nombre="salir" />
              <span>Salir</span>
            </button>
          )}
        </div>
      </header>

      <main className="contenido">
        <div className="intro">
          <div>
            <p className="eyebrow">Configurador</p>
            <h1>Arma el build</h1>
          </div>
          <p>
            Elige el modelo, cuánto quieres gastar y para qué es el coche. La lista se arma sola
            mientras tocas. La gama no la eliges tú: la marca el dinero que pones.
          </p>
        </div>

        {avisoPago && (
          <div className={"aviso-pago" + (planCuenta === "taller" ? " ok" : "")}>
            <span>{avisoPago}</span>
            <button
              type="button"
              className="aviso-pago-cerrar"
              onClick={() => setAvisoPago(null)}
            >
              Cerrar
            </button>
          </div>
        )}

        <div className="config">
          <div className="columna-controles">
            <Formulario
              modelos={modelos}
              modeloId={modeloId}
              modeloResuelto={modeloResuelto}
              onModeloId={setModeloElegido}
              presupuesto={presupuesto}
              onPresupuesto={setPresupuesto}
              objetivos={objetivos}
              onAlternarObjetivo={alternarObjetivo}
              vistaPrevia={plan.presupuesto}
              techoUtil={plan.techoUtil}
              grupos={plan.grupos}
              elecciones={elecciones}
              onElegir={elegirPieza}
              onLimpiarElecciones={() => setElecciones({})}
              limites={limites}
            />
          </div>

          {/* El desglose de lo que pide el proyecto se lee junto al plan, no entre los
              controles: así la columna de la izquierda cabe en pantalla y la derecha
              nunca está vacía. */}
          <div className="columna-plan" id="plan">
            <Resultado resultado={plan} onProbarPresupuesto={setPresupuesto} />
            {plan.presupuesto && <Requisitos plan={plan.presupuesto} />}
            {plan.modelo && <PiezasCompatibles modelo={plan.modelo} />}
          </div>
        </div>
      </main>

      <AccesoModal />
      <SuscripcionModal />
      {/* Se monta solo mientras está abierto, para que cada apertura empiece de cero:
          sin un "Borrar la cuenta" a medias ni un "Guardado" de la vez anterior. */}
      {modalCuenta?.tipo === "perfil" && <PerfilModal />}
    </div>
  );
}

export default App;
