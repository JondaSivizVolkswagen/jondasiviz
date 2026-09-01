// Desplegable de coche, agrupado por motor igual que en el formulario del planner. Lo
// usan el registro y el perfil, así que vive aparte para que los dos digan lo mismo.
// Elegirlo no es obligatorio en ninguno de los dos sitios: por eso la primera opción es
// dejarlo sin decidir.

import { useMemo } from "react";
import type { ModeloVW } from "../engine/types";

interface Props {
  id: string;
  modelos: ModeloVW[];
  valor: string;
  onValor: (valor: string) => void;
}

export function SelectorCoche({ id, modelos, valor, onValor }: Props) {
  const porMotor = useMemo(() => {
    const grupos = new Map<string, ModeloVW[]>();
    for (const m of modelos) {
      const suyos = grupos.get(m.motor);
      if (suyos) suyos.push(m);
      else grupos.set(m.motor, [m]);
    }
    return [...grupos].sort(([a], [b]) => a.localeCompare(b));
  }, [modelos]);

  return (
    <select id={id} className="entrada" value={valor} onChange={(e) => onValor(e.target.value)}>
      <option value="">Todavía no lo sé</option>
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
  );
}
