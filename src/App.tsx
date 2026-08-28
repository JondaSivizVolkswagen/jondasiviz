import { useMemo, useState } from "react";
import { buscarModelo, listarModelos } from "./engine/graph";
import { alternarObjetivo as aplicarObjetivo } from "./engine/recommend";
import { crearSelector } from "./agents";
import type { Objetivo } from "./engine/types";
import { useTema } from "./ui/theme";
import { cerrarApp, enEscritorio } from "./ui/entorno";
import { Icono } from "./ui/icons";
import { Formulario } from "./ui/Formulario";
import { Resultado } from "./ui/Resultado";
import { Requisitos } from "./ui/Requisitos";
import { PiezasCompatibles } from "./ui/PiezasCompatibles";
import "./App.css";

function App() {
  const modelos = useMemo(() => listarModelos(), []);
  const selector = useMemo(() => crearSelector(), []);
  const { oscuro, alternar } = useTema();
  // Se mira una sola vez: no cambia de entorno a mitad de sesion.
  const escritorio = useMemo(() => enEscritorio(), []);

  // El Mk5 es el modelo de referencia del catálogo, así que arranca en él si está.
  const [modeloId, setModeloId] = useState(
    () => (modelos.find((m) => m.id === "golf-gti-mk5") ?? modelos[0])?.id ?? "",
  );
  const [presupuesto, setPresupuesto] = useState(4000);
  const [objetivos, setObjetivos] = useState<Objetivo[]>(["drag"]);
  // Pieza elegida a mano, por grupo. Se guarda por grupo y no como lista suelta para que
  // volver a "que elija el motor" sea quitar la clave, y para que cambiar de coche no
  // borre lo elegido: el selector ya ignora lo que no aplique.
  const [elecciones, setElecciones] = useState<Record<string, string>>({});

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

  // Las reglas de qué objetivo descarta a cuál viven en el motor, no aquí.
  const alternarObjetivo = (o: Objetivo) => {
    setObjetivos((prev) => aplicarObjetivo(prev, o));
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
      <header className="barra">
        {/* La marca lleva a la portada, que es lo que espera cualquiera, y al lado va el
            enlace con su nombre, para el que no da por hecho esa convención. */}
        <a className="marca" href={escritorio ? "/menu.html" : "/"}>
          JondaSiviz <span>build planner</span>
        </a>

        <div className="barra-acciones">
          {/* En la app el destino no es una web, es el menú de inicio del programa, y
              además se puede cerrar. En el navegador no existe "salir". */}
          <a className="btn btn-fantasma btn-sm volver" href={escritorio ? "/menu.html" : "/"}>
            <Icono nombre="flechaIzquierda" />
            <span>{escritorio ? "Inicio" : "Volver a la web"}</span>
          </a>
          {escritorio && (
            <button
              type="button"
              className="btn btn-fantasma btn-sm volver"
              onClick={() => void cerrarApp()}
            >
              <Icono nombre="salir" />
              <span>Salir</span>
            </button>
          )}
          <button
            type="button"
            className="icono-btn"
            onClick={alternar}
            aria-label="Cambiar entre tema claro y oscuro"
          >
            <Icono nombre={oscuro ? "sol" : "luna"} />
          </button>
        </div>
      </header>

      <main className="contenido">
        <div className="intro">
          <h1>Planifica tu build sin pasarte del presupuesto</h1>
          <p>
            Elige el modelo, cuánto quieres gastar y para qué es el coche. La lista de piezas se
            arma sola mientras tocas, ordenada por lo que más pesa en ese objetivo. La gama no la
            eliges tú: la marca el dinero que pones.
          </p>
        </div>

        <div className="columna-controles">
          <Formulario
            modelos={modelos}
            modeloId={modeloId}
            modeloResuelto={modeloResuelto}
            onModeloId={setModeloId}
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
          />
        </div>

        {/* El desglose de lo que pide el proyecto se lee junto al plan, no entre los
            controles: así la columna de la izquierda cabe en pantalla y la derecha
            nunca está vacía. */}
        <div className="columna-plan" id="plan">
          {plan.presupuesto && <Requisitos plan={plan.presupuesto} />}
          <Resultado resultado={plan} onProbarPresupuesto={setPresupuesto} />
          {plan.modelo && <PiezasCompatibles modelo={plan.modelo} />}
        </div>
      </main>
    </div>
  );
}

export default App;
