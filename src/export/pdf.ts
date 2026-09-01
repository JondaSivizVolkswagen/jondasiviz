// Genera el PDF del presupuesto: cabecera con marca, resumen del gasto, qué pide el
// proyecto y qué entra, las piezas por categoría y las siguientes mejoras.
//
// pdfmake se carga con import() dinámico. Pesa cerca de un mega con las fuentes
// embebidas, y no tiene sentido pagarlo en el arranque de la app cuando la mayoría
// de las veces no se descarga nada.

import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Gama, ModeloVW, Pieza, Presupuesto, RequisitoCategoria } from "../engine/types";
import { NOMBRE_CATEGORIA, NOMBRE_OBJETIVO, fraseMinimo } from "../engine/recommend";
import { euros } from "../engine/format";
import { iconoCategoria, marcaSvg } from "./iconos-pdf";

/** Paleta clara de la app. El documento se imprime sobre blanco, no hay tema oscuro. */
const COLOR = {
  acento: "#C0322E",
  texto: "#1D1D1F",
  suave: "#6B6B70",
  borde: "#E7E7E4",
  fondo: "#F4F4F3",
} as const;

const ANCHO_UTIL = 515;

function fecha(): string {
  return new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function trozoUrl(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * pdfmake solo pinta imágenes que ya estén en memoria como data URL. Las piezas aún
 * no traen fotos (el campo `imagen` está listo pero vacío), así que esto se queda
 * esperando: en cuanto haya rutas, las carga y las mete en el documento. Lo que falle
 * se ignora, porque un PDF sin una foto vale más que un PDF que no sale.
 */
async function cargarImagenes(piezas: Pieza[]): Promise<Record<string, string>> {
  const rutas = [...new Set(piezas.map((p) => p.imagen).filter((r): r is string => !!r))];
  const cargadas: Record<string, string> = {};

  await Promise.all(
    rutas.map(async (ruta) => {
      if (ruta.startsWith("data:")) {
        cargadas[ruta] = ruta;
        return;
      }
      try {
        const respuesta = await fetch(ruta);
        if (!respuesta.ok) return;
        const blob = await respuesta.blob();
        cargadas[ruta] = await new Promise<string>((resolver, fallar) => {
          const lector = new FileReader();
          lector.onload = () => resolver(String(lector.result));
          lector.onerror = () => fallar(lector.error);
          lector.readAsDataURL(blob);
        });
      } catch {
        // Sin foto y a seguir.
      }
    }),
  );

  return cargadas;
}

/** Barra de gasto dibujada a mano: pdfmake no trae gráficos, pero sí lienzo. */
function barraGasto(gastado: number, tope: number): Content {
  const alto = 9;
  const lleno = tope > 0 ? Math.max(0, Math.min(1, gastado / tope)) * ANCHO_UTIL : 0;

  return {
    canvas: [
      { type: "rect", x: 0, y: 0, w: ANCHO_UTIL, h: alto, r: 4.5, color: COLOR.fondo },
      ...(lleno > 0 ? [{ type: "rect" as const, x: 0, y: 0, w: lleno, h: alto, r: 4.5, color: COLOR.acento }] : []),
    ],
    margin: [0, 4, 0, 10],
  };
}

function distintivoGama(gama: Gama): Content {
  return {
    text: gama,
    fontSize: 7,
    characterSpacing: 0.4,
    color: gama === "alta" ? COLOR.acento : COLOR.suave,
    alignment: "center",
    margin: [0, 1, 0, 0],
  };
}

function seccion(titulo: string, apoyo?: string): Content {
  const stack: Content[] = [{ text: titulo, fontSize: 13, bold: true, color: COLOR.texto }];
  if (apoyo) stack.push({ text: apoyo, fontSize: 9, color: COLOR.suave, margin: [0, 2, 0, 0] });
  return { margin: [0, 18, 0, 8], stack };
}

/** Tabla sin rejilla, solo una línea fina entre filas. Como las listas de la app. */
const LAYOUT_LISTA = {
  hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
    i === 0 || i === node.table.body.length ? 0 : 0.5,
  vLineWidth: () => 0,
  hLineColor: () => COLOR.borde,
  paddingTop: () => 5,
  paddingBottom: () => 5,
  paddingLeft: () => 0,
  paddingRight: () => 0,
};

function tablaRequisitos(esenciales: RequisitoCategoria[]): Content {
  return {
    layout: LAYOUT_LISTA,
    table: {
      widths: [14, 88, "*", 72, 46],
      body: esenciales.map((e) => [
        { svg: iconoCategoria(e.categoria, e.cubierta ? COLOR.acento : COLOR.suave), width: 11 },
        {
          text: NOMBRE_CATEGORIA[e.categoria],
          fontSize: 9,
          bold: true,
          color: e.cubierta ? COLOR.texto : COLOR.suave,
        },
        {
          text: e.pieza ? e.pieza.nombre : "nada en el catálogo todavía",
          fontSize: 8.5,
          color: COLOR.suave,
        },
        {
          text: e.pieza ? (e.minimo > 0 ? `desde ${euros(e.minimo)}` : "ya incluido") : "—",
          fontSize: 8.5,
          color: COLOR.suave,
          alignment: "right",
        },
        {
          text: e.cubierta ? "entra" : "no entra",
          fontSize: 8,
          color: e.cubierta ? COLOR.acento : COLOR.suave,
          alignment: "right",
        },
      ]),
    },
  };
}

function bloquesCategorias(plan: Presupuesto, imagenes: Record<string, string>): Content[] {
  return plan.porCategoria.map((grupo): Content => ({
    unbreakable: true,
    margin: [0, 0, 0, 12],
    stack: [
      {
        margin: [0, 0, 0, 4],
        columns: [
          { svg: iconoCategoria(grupo.categoria, COLOR.acento), width: 13 },
          {
            text: NOMBRE_CATEGORIA[grupo.categoria],
            fontSize: 10.5,
            bold: true,
            color: COLOR.texto,
            margin: [6, 1, 0, 0],
          },
          { text: euros(grupo.total), fontSize: 10.5, bold: true, alignment: "right" },
        ],
      },
      {
        layout: LAYOUT_LISTA,
        table: {
          widths: ["*", 38, 34, 58],
          body: grupo.lineas.map((linea) => {
            const foto = linea.pieza.imagen ? imagenes[linea.pieza.imagen] : undefined;
            const descripcion: Content[] = [];
            if (foto) descripcion.push({ image: foto, width: 64, margin: [0, 0, 0, 3] });
            descripcion.push({ text: linea.pieza.nombre, fontSize: 9, color: COLOR.texto });
            if (linea.pieza.nota) {
              descripcion.push({ text: linea.pieza.nota, fontSize: 7.5, color: COLOR.suave });
            }
            return [
              { stack: descripcion },
              distintivoGama(linea.pieza.gama),
              {
                text: linea.motivo === "dependencia" ? "dep." : "",
                fontSize: 7,
                color: COLOR.suave,
                alignment: "center",
                margin: [0, 1, 0, 0],
              },
              { text: euros(linea.precio), fontSize: 9, bold: true, alignment: "right" },
            ];
          }),
        },
      },
    ],
  }));
}

export interface DatosPdf {
  modelo: ModeloVW;
  plan: Presupuesto;
  siguienteEscalon: { gama: Gama; presupuesto: number } | null;
  avisos: string[];
}

export function construirDocumento(
  datos: DatosPdf,
  imagenes: Record<string, string>,
): TDocumentDefinitions {
  const { modelo, plan } = datos;
  const pet = plan.peticion;
  const objetivos = pet.objetivos.map((o) => NOMBRE_OBJETIVO[o]).join(" + ");
  const sobrante = Math.max(0, plan.restante);

  const cabeceraDerecha: Content[] = [
    {
      text: euros(pet.presupuesto),
      fontSize: 13,
      bold: true,
      color: COLOR.acento,
      alignment: "right",
    },
    { text: objetivos, fontSize: 9, color: COLOR.suave, alignment: "right", margin: [0, 2, 0, 0] },
  ];
  if (plan.gamaResultante) {
    cabeceraDerecha.push({
      text: `build de gama ${plan.gamaResultante}`,
      fontSize: 9,
      color: COLOR.suave,
      alignment: "right",
    });
  }

  const contenido: Content[] = [
    {
      columns: [
        {
          stack: [
            { text: modelo.nombre, fontSize: 22, bold: true, color: COLOR.texto },
            {
              text:
                `${modelo.motorDetalle} · chasis ${modelo.chasis} · ` +
                `${modelo.anios[0]}-${modelo.anios[1]} · tracción ${modelo.traccion}`,
              fontSize: 9,
              color: COLOR.suave,
              margin: [0, 3, 0, 0],
            },
          ],
        },
        { width: 135, stack: cabeceraDerecha },
      ],
    },
    {
      margin: [0, 10, 0, 0],
      stack: [
        {
          fontSize: 10,
          columns: [
            {
              text: [
                { text: euros(plan.total), bold: true },
                { text: ` de ${euros(pet.presupuesto)}`, color: COLOR.suave },
              ],
            },
            { text: `Sobran ${euros(sobrante)}`, color: COLOR.suave, alignment: "right" },
          ],
        },
        barraGasto(plan.total, pet.presupuesto),
      ],
    },

    seccion("Qué pide este proyecto", fraseMinimo(plan)),
    tablaRequisitos(plan.esenciales),
  ];

  if (datos.avisos.length > 0) {
    contenido.push(seccion("A tener en cuenta"), {
      ul: datos.avisos.map((a) => ({ text: a, fontSize: 8.5, color: COLOR.suave })),
    });
  }

  contenido.push(
    seccion(
      "Piezas seleccionadas",
      `${plan.lineas.length} piezas. Las marcadas como "dep." entran arrastradas por otra ` +
        "que las necesita para funcionar.",
    ),
  );

  if (plan.porCategoria.length > 0) {
    contenido.push(...bloquesCategorias(plan, imagenes));
  } else {
    contenido.push({
      text: "Con este presupuesto no entra ninguna pieza.",
      fontSize: 9,
      color: COLOR.suave,
    });
  }

  if (plan.siguientesMejoras.length > 0) {
    contenido.push(
      seccion("Siguientes mejoras", "Lo próximo que entraría si subes el presupuesto."),
      {
        layout: LAYOUT_LISTA,
        table: {
          widths: ["*", 140, 92],
          body: plan.siguientesMejoras.map((m) => [
            { text: m.pieza.nombre, fontSize: 9, color: COLOR.texto },
            {
              text: m.sustituye
                ? `${NOMBRE_CATEGORIA[m.pieza.categoria]} · en lugar de ${m.sustituye.nombre}`
                : NOMBRE_CATEGORIA[m.pieza.categoria],
              fontSize: 8.5,
              color: COLOR.suave,
            },
            {
              text:
                m.falta === 0
                  ? `${euros(m.precio)} · ya cabe`
                  : `${euros(m.precio)} · faltan ${euros(m.falta)}`,
              fontSize: 8.5,
              color: m.falta === 0 ? COLOR.acento : COLOR.suave,
              alignment: "right",
            },
          ]),
        },
      },
    );
  }

  if (datos.siguienteEscalon) {
    contenido.push({
      text:
        `Con ${euros(datos.siguienteEscalon.presupuesto)} esto pasaría a ser un build de ` +
        `gama ${datos.siguienteEscalon.gama}.`,
      fontSize: 9,
      color: COLOR.suave,
      margin: [0, 14, 0, 0],
    });
  }

  return {
    pageSize: "A4",
    pageMargins: [40, 62, 40, 52],
    info: {
      title: `Presupuesto ${modelo.nombre} — ${objetivos}`,
      author: "JondaSiviz Build Planner",
    },
    defaultStyle: { font: "Roboto", fontSize: 10, color: COLOR.texto, lineHeight: 1.25 },
    header: () => ({
      margin: [40, 22, 40, 0],
      stack: [
        {
          fontSize: 9.5,
          columns: [
            { svg: marcaSvg(COLOR.acento), width: 14 },
            {
              text: [
                { text: "JondaSiviz", bold: true },
                { text: "  build planner", color: COLOR.suave },
              ],
              margin: [6, 1, 0, 0],
            },
            { text: fecha(), fontSize: 8.5, color: COLOR.suave, alignment: "right", margin: [0, 1, 0, 0] },
          ],
        },
        {
          canvas: [
            { type: "line", x1: 0, y1: 8, x2: ANCHO_UTIL, y2: 8, lineWidth: 1, lineColor: COLOR.borde },
          ],
        },
      ],
    }),
    footer: (pagina: number, total: number) => ({
      margin: [40, 12, 40, 0],
      fontSize: 7.5,
      color: COLOR.suave,
      columns: [
        { text: "Precios orientativos. Proyecto personal, sin relación con Volkswagen AG." },
        { text: `${pagina} de ${total}`, alignment: "right" },
      ],
    }),
    content: contenido,
  };
}

/** Documento listo para pdfmake. Exportado para poder probarlo sin navegador. */

/** Nombre de archivo legible: modelo, objetivos y dinero. */
export function nombreArchivo(datos: DatosPdf): string {
  const objetivos = datos.plan.peticion.objetivos.join("-");
  return `jondasiviz-${trozoUrl(datos.modelo.nombre)}-${objetivos}-${datos.plan.peticion.presupuesto}e.pdf`;
}

/** Arma el PDF y lo descarga. Todo en el navegador, sin servidor por medio. */
export async function descargarPdf(datos: DatosPdf): Promise<void> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(vfs);

  const imagenes = await cargarImagenes(datos.plan.lineas.map((l) => l.pieza));
  pdfMake.createPdf(construirDocumento(datos, imagenes)).download(nombreArchivo(datos));
}
