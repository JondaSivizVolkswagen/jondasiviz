import { useMemo, useState } from "react";
import { buscarModelo, listarModelos } from "./engine/graph";
import { crearSelector, gamaEsperada, sueloDe } from "./agents";
import type { ResultadoSelector } from "./agents";
import type { Objetivo } from "./engine/types";
import { useTema } from "./ui/theme";
import { Icono } from "./ui/icons";
import { Formulario } from "./ui/Formulario";
import { Resultado } from "./ui/Resultado";
import { PiezasCompatibles } from "./ui/PiezasCompatibles";
import "./App.css";

function App() {
  const modelos = useMemo(() => listarModelos(), []);
  const selector = useMemo(() => crearSelector(), []);
  const { oscuro, alternar } = useTema();

  const [modeloTexto, setModeloTexto] = useState("Golf GTI Mk5");
  const [presupuesto, setPresupuesto] = useState(4000);
  const [objetivos, setObjetivos] = useState<Objetivo[]>(["drag"]);
  const [resultado, setResultado] = useState<ResultadoSelector | null>(null);

  const modeloResuelto = useMemo(
    () => buscarModelo(modeloTexto, modelos),
    [modeloTexto, modelos],
  );

  // El desglose del formulario se recalcula solo: es el mismo cálculo que el botón,
  // sale en milisegundos con 59 piezas y así ves qué pide el proyecto antes de pulsar.
  const vistaPrevia = useMemo(
    () => selector.seleccionar({ modelo: modeloTexto, presupuesto, objetivos }).presupuesto,
    [selector, modeloTexto, presupuesto, objetivos],
  );

  const calcular = (conPresupuesto: number = presupuesto) => {
    setResultado(
      selector.seleccionar({ modelo: modeloTexto, presupuesto: conPresupuesto, objetivos }),
    );
  };

  const alternarObjetivo = (o: Objetivo) => {
    setObjetivos((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));
  };

  // Recalcular con otro dinero: el botón de "subir a gama X" del resultado.
  const probarPresupuesto = (nuevo: number) => {
    setPresupuesto(nuevo);
    calcular(nuevo);
  };

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          JondaSiviz <span>build planner</span>
        </div>
        <button
          type="button"
          className="icono-btn"
          onClick={alternar}
          aria-label="Cambiar entre tema claro y oscuro"
        >
          <Icono nombre={oscuro ? "sol" : "luna"} />
        </button>
      </header>

      <main className="contenido">
        <div className="intro">
          <h1>Planifica tu build sin pasarte del presupuesto</h1>
          <p>
            Elige el modelo, cuánto quieres gastar y para qué es el coche. Te devolvemos una lista
            de piezas con precio estimado, ordenada por lo que más pesa en ese objetivo. La gama no
            la eliges tú: la marca el dinero que pones.
          </p>
        </div>

        <Formulario
          modelos={modelos}
          modeloTexto={modeloTexto}
          modeloResuelto={modeloResuelto}
          onModeloTexto={setModeloTexto}
          presupuesto={presupuesto}
          onPresupuesto={setPresupuesto}
          objetivos={objetivos}
          onAlternarObjetivo={alternarObjetivo}
          suelo={sueloDe(objetivos)}
          gamaEsperada={gamaEsperada(objetivos, presupuesto)}
          vistaPrevia={vistaPrevia}
          onCalcular={() => calcular()}
        />

        {resultado && <Resultado resultado={resultado} onProbarPresupuesto={probarPresupuesto} />}
        {resultado?.modelo && <PiezasCompatibles modelo={resultado.modelo} />}
      </main>
    </div>
  );
}

export default App;
