import { describe, expect, it } from "vitest";
import { crearSelector } from "../src/agents/index";
import { euros } from "../src/engine/format";
import { construirDocumento, nombreArchivo } from "../src/export/pdf";
import type { DatosPdf } from "../src/export/pdf";

function datosDe(presupuesto: number, objetivos: DatosPdf["plan"]["peticion"]["objetivos"]): DatosPdf {
  const r = crearSelector().seleccionar({ modelo: "mk5", presupuesto, objetivos });
  return {
    modelo: r.modelo!,
    plan: r.presupuesto!,
    siguienteEscalon: r.siguienteEscalon,
    avisos: r.avisos,
  };
}

/** Recorre el documento y junta todo el texto suelto, para poder buscar dentro. */
function textoDe(nodo: unknown): string {
  if (typeof nodo === "string") return nodo;
  if (typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoDe).join(" ");
  if (nodo && typeof nodo === "object") {
    return Object.entries(nodo as Record<string, unknown>)
      .filter(([clave]) => clave !== "svg" && clave !== "image")
      .map(([, valor]) => textoDe(valor))
      .join(" ");
  }
  return "";
}

describe("documento PDF", () => {
  const datos = datosDe(4000, ["drag"]);
  const doc = construirDocumento(datos, {});
  const texto = textoDe(doc.content);

  it("lleva la cabecera del coche y lo que se ha pedido", () => {
    expect(texto).toContain("Golf GTI Mk5");
    expect(texto).toContain("2.0 TFSI 200 CV (BWA / AXX)");
    expect(texto).toContain("drag");
    expect(texto).toContain(euros(4000));
  });

  it("explica el mínimo del proyecto y qué entra y qué no", () => {
    expect(texto).toContain("Cubrir lo esencial");
    for (const e of datos.plan.esenciales) {
      expect(texto).toContain(e.cubierta ? "entra" : "no entra");
    }
    expect(texto).toContain(euros(datos.plan.minimoEsencial));
  });

  it("lista todas las piezas elegidas", () => {
    for (const linea of datos.plan.lineas) expect(texto).toContain(linea.pieza.nombre);
  });

  it("pinta un icono por cada categoría, en los requisitos y en las piezas", () => {
    const svgs = JSON.stringify(doc.content).match(/<svg /g) ?? [];
    expect(svgs.length).toBeGreaterThanOrEqual(
      datos.plan.esenciales.length + datos.plan.porCategoria.length,
    );
  });

  it("la barra de gasto no se sale del ancho de página", () => {
    const canvas = JSON.stringify(doc.content).match(/"w":([0-9.]+)/g) ?? [];
    for (const w of canvas) expect(Number(w.split(":")[1])).toBeLessThanOrEqual(515);
  });

  it("con presupuesto de sobra el documento sigue saliendo entero", () => {
    const amplio = datosDe(25000, ["drift", "estetica"]);
    const t = textoDe(construirDocumento(amplio, {}).content);
    expect(t).toContain("Piezas seleccionadas");
    expect(t).toContain("Golf GTI Mk5");
  });

  it("el nombre del archivo sale legible y sin acentos", () => {
    expect(nombreArchivo(datos)).toBe("jondasiviz-golf-gti-mk5-drag-4000e.pdf");
    expect(nombreArchivo(datosDe(9000, ["mas-cv", "estetica"]))).toBe(
      "jondasiviz-golf-gti-mk5-mas-cv-estetica-9000e.pdf",
    );
  });
});
