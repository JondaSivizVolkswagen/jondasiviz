// Lectura de la base de datos.
//
// Devuelve exactamente los mismos tipos que el motor espera (`Catalogo`,
// `CatalogoModelos`), así que `generarPresupuesto` funciona igual le llegue el catálogo
// del JSON o de aquí. Esa es la razón de que la API no tenga que repetir ni una regla
// de negocio: se le inyecta el catálogo y el motor hace el resto.
//
// Las consultas de una misma lectura se lanzan juntas con Promise.all. Contra un fichero
// da igual, pero contra Turso cada una es una petición por la red: en fila serían seis
// viajes esperando uno detrás de otro, y a la vez es uno.

import type {
  Catalogo,
  CatalogoModelos,
  Categoria,
  Chasis,
  Equipamiento,
  Gama,
  Legalidad,
  ModeloVW,
  Objetivo,
  Pieza,
  Plataforma,
  Propulsion,
  Stage,
  Traccion,
} from "../engine/types.ts";
import type { BaseDatos } from "./sqlite.ts";

const OBJETIVOS: Objetivo[] = ["drift", "drag", "mas-cv", "estetica"];

interface FilaPieza {
  id: string;
  nombre: string;
  categoria: string;
  gama: string;
  precio_min: number;
  precio_estimado: number;
  precio_max: number;
  impacto: number;
  legalidad: string;
  grupo_exclusivo: string | null;
  stage: string | null;
  nota: string | null;
  imagen: string | null;
}

interface FilaModelo {
  id: string;
  nombre: string;
  chasis: string;
  motor: string;
  motor_detalle: string;
  traccion: string;
  propulsion: string;
  anio_inicio: number;
  anio_fin: number;
}

/** true si la base ya tiene catálogo dentro. */
export async function estaSembrada(base: BaseDatos): Promise<boolean> {
  const fila = await base.uno<{ n: number }>("SELECT COUNT(*) AS n FROM pieza");
  return Number(fila?.n ?? 0) > 0;
}

/** Reconstruye el catálogo entero. */
export async function leerCatalogo(base: BaseDatos): Promise<Catalogo> {
  const [filas, plataformas, objetivos, requisitos, chasis, tracciones, equipos, version, moneda] =
    await Promise.all([
      base.todos<FilaPieza>("SELECT * FROM pieza ORDER BY id"),
      agrupar<Plataforma>(base, "SELECT pieza_id, plataforma AS valor FROM pieza_plataforma"),
      base.todos<{ pieza_id: string; objetivo: string; peso: number }>(
        "SELECT pieza_id, objetivo, peso FROM pieza_objetivo",
      ),
      agrupar<string>(base, "SELECT pieza_id, requiere_id AS valor FROM pieza_requiere"),
      agrupar<Chasis>(base, "SELECT pieza_id, chasis AS valor FROM pieza_chasis"),
      agrupar<Traccion>(base, "SELECT pieza_id, traccion AS valor FROM pieza_traccion"),
      base.todos<{ pieza_id: string; relacion: string; equipamiento: string }>(
        "SELECT pieza_id, relacion, equipamiento FROM pieza_equipamiento",
      ),
      valorMeta(base, "catalogo_version"),
      valorMeta(base, "moneda"),
    ]);

  const pesos = new Map<string, Record<Objetivo, number>>();
  for (const fila of objetivos) {
    // Se parte de los cuatro objetivos a cero: el motor espera el registro completo y
    // una pieza que no puntúa en algo simplemente no tiene fila.
    const registro = pesos.get(fila.pieza_id) ?? vacios();
    registro[fila.objetivo as Objetivo] = Number(fila.peso);
    pesos.set(fila.pieza_id, registro);
  }

  // Las tres listas de equipamiento salen de la misma tabla, separadas por `relacion`.
  const equipamiento = new Map<string, Record<string, Equipamiento[]>>();
  for (const fila of equipos) {
    const porRelacion = equipamiento.get(fila.pieza_id) ?? {};
    (porRelacion[fila.relacion] ??= []).push(fila.equipamiento as Equipamiento);
    equipamiento.set(fila.pieza_id, porRelacion);
  }

  const piezas: Pieza[] = filas.map((fila) => {
    const pieza: Pieza = {
      id: fila.id,
      nombre: fila.nombre,
      categoria: fila.categoria as Categoria,
      plataformas: plataformas.get(fila.id) ?? [],
      chasis: chasis.get(fila.id) ?? [],
      legalidad: fila.legalidad as Legalidad,
      traccion: tracciones.get(fila.id) ?? [],
      sustituye: equipamiento.get(fila.id)?.sustituye ?? [],
      exige: equipamiento.get(fila.id)?.exige ?? [],
      chocaCon: equipamiento.get(fila.id)?.chocaCon ?? [],
      gama: fila.gama as Gama,
      precio: {
        min: Number(fila.precio_min),
        estimado: Number(fila.precio_estimado),
        max: Number(fila.precio_max),
      },
      objetivos: pesos.get(fila.id) ?? vacios(),
      impacto: Number(fila.impacto),
      requiere: requisitos.get(fila.id) ?? [],
    };

    // Los opcionales se dejan sin poner en vez de a null: el tipo los declara
    // opcionales, y un null explícito se cuela en el JSON de la API como ruido.
    if (fila.grupo_exclusivo) pieza.grupoExclusivo = fila.grupo_exclusivo;
    if (fila.stage) pieza.stage = fila.stage as Stage;
    if (fila.nota) pieza.nota = fila.nota;
    if (fila.imagen) pieza.imagen = fila.imagen;
    return pieza;
  });

  return { version, moneda, piezas };
}

export async function leerModelos(base: BaseDatos): Promise<CatalogoModelos> {
  const [filas, alias, equipos, version] = await Promise.all([
    base.todos<FilaModelo>("SELECT * FROM modelo ORDER BY nombre"),
    base.todos<{ modelo_id: string; alias: string }>("SELECT modelo_id, alias FROM modelo_alias"),
    base.todos<{ modelo_id: string; equipamiento: string }>(
      "SELECT modelo_id, equipamiento FROM modelo_equipamiento",
    ),
    valorMeta(base, "modelos_version"),
  ]);

  const porModelo = <T extends string>(lista: { modelo_id: string }[], campo: string) => {
    const mapa = new Map<string, T[]>();
    for (const fila of lista as Record<string, string>[]) {
      const clave = fila.modelo_id;
      const valores = mapa.get(clave) ?? [];
      valores.push(fila[campo] as T);
      mapa.set(clave, valores);
    }
    return mapa;
  };

  const alias_ = porModelo<string>(alias, "alias");
  const equipamiento = porModelo<Equipamiento>(equipos, "equipamiento");

  const modelos: ModeloVW[] = filas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    alias: alias_.get(fila.id) ?? [],
    chasis: fila.chasis as Chasis,
    motor: fila.motor as Plataforma,
    motorDetalle: fila.motor_detalle,
    traccion: fila.traccion as Traccion,
    propulsion: fila.propulsion as Propulsion,
    equipamiento: equipamiento.get(fila.id) ?? [],
    anios: [Number(fila.anio_inicio), Number(fila.anio_fin)],
  }));

  return { version, modelos };
}

/**
 * Piezas compatibles con un motor y que aportan algo a un objetivo, resuelto en SQL.
 * Es la consulta que justifica tener base de datos: cruza tres tablas y ordena por lo
 * que más aporta, sin traerse el catálogo entero a memoria.
 */
export async function piezasPorObjetivo(
  base: BaseDatos,
  plataforma: Plataforma,
  objetivo: Objetivo,
): Promise<{ id: string; nombre: string; categoria: string; peso: number; estimado: number }[]> {
  return base.todos(
    `SELECT p.id, p.nombre, p.categoria, o.peso, p.precio_estimado AS estimado
       FROM pieza p
       JOIN pieza_plataforma pl ON pl.pieza_id = p.id
       JOIN pieza_objetivo    o ON o.pieza_id  = p.id
      WHERE pl.plataforma = ? AND o.objetivo = ? AND o.peso > 0
      ORDER BY o.peso DESC, p.precio_estimado ASC`,
    [plataforma, objetivo],
  );
}

/** Última siembra registrada, para saber si el webhook hizo su trabajo. */
export async function ultimaSiembra(
  base: BaseDatos,
): Promise<{ fecha: string; origen: string; piezas: number; modelos: number } | null> {
  return base.uno("SELECT fecha, origen, piezas, modelos FROM siembra ORDER BY id DESC LIMIT 1");
}

/**
 * Junta en un mapa las filas de una tabla que cuelga de `pieza`. La consulta tiene que
 * devolver dos columnas llamadas `pieza_id` y `valor`.
 */
async function agrupar<T extends string>(
  base: BaseDatos,
  consulta: string,
): Promise<Map<string, T[]>> {
  const mapa = new Map<string, T[]>();
  for (const fila of await base.todos<{ pieza_id: string; valor: string }>(consulta)) {
    const lista = mapa.get(fila.pieza_id) ?? [];
    lista.push(fila.valor as T);
    mapa.set(fila.pieza_id, lista);
  }
  return mapa;
}

function vacios(): Record<Objetivo, number> {
  return Object.fromEntries(OBJETIVOS.map((o) => [o, 0])) as Record<Objetivo, number>;
}

async function valorMeta(base: BaseDatos, clave: string): Promise<string> {
  const fila = await base.uno<{ valor: string }>("SELECT valor FROM meta WHERE clave = ?", [clave]);
  return fila?.valor ?? "";
}
