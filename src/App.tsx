import { useMemo, useState } from "react";
import { buscarModelo, listarModelos } from "./engine/graph";
import { crearSelector } from "./agents";
import type { ResultadoSelector } from "./agents";
import type { Gama, Objetivo } from "./engine/types";
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
  const [gama, setGama] = useState<Gama>("media");
  const [presupuesto, setPresupuesto] = useState(4000);
  const [objetivo, setObjetivo] = useState<Objetivo>("drag");
  const [resultado, setResultado] = useState<ResultadoSelector | null>(null);

  const modeloResuelto = useMemo(
    () => buscarModelo(modeloTexto, modelos),
    [modeloTexto, modelos],
  );

  const calcular = (conGama: Gama = gama) => {
    setResultado(
      selector.seleccionar({ modelo: modeloTexto, gama: conGama, presupuesto, objetivo }),
    );
  };

  const probarGama = (nueva: Gama) => {
    setGama(nueva);
    calcular(nueva);
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
            Elige el modelo, la gama de piezas, cuánto quieres gastar y para qué es el coche. Te
            devolvemos una lista de piezas con precio estimado, ordenada por lo que más pesa en ese
            objetivo.
          </p>
        </div>

        <Formulario
          modelos={modelos}
          modeloTexto={modeloTexto}
          modeloResuelto={modeloResuelto}
          onModeloTexto={setModeloTexto}
          gama={gama}
          onGama={setGama}
          presupuesto={presupuesto}
          onPresupuesto={setPresupuesto}
          objetivo={objetivo}
          onObjetivo={setObjetivo}
          onCalcular={() => calcular()}
        />

        {resultado && <Resultado resultado={resultado} onProbarGama={probarGama} />}
        {resultado?.modelo && <PiezasCompatibles modelo={resultado.modelo} />}
      </main>
    </div>
  );
}

export default App;
