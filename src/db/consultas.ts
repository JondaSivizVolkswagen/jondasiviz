// Lectura de la base de datos.
//
// Devuelve exactamente los mismos tipos que el motor espera (`Catalogo`,
// `CatalogoModelos`), así que `generarPresupuesto` funciona igual le llegue el catálogo
// del JSON o de aquí. Esa es la razón de que la API no tenga que repetir ni una regla
// de negocio: se le inyecta el catálogo y el motor hace el resto.

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
export function estaSembrada(base: BaseDatos): boolean {
  const fila = base.prepare("SELECT COUNT(*) AS n FROM pieza").get() as { n: number };
  return fila.n > 0;
}

/**
 * Reconstruye el catálogo entero. Hace tres consultas en vez de una por pieza: con 59
 * piezas daría igual, pero una consulta dentro de un bucle es una bomba de relojería en
 * cuanto el catálogo crece.
 */
export function leerCatalogo(base: BaseDatos): Catalogo {
  const filas = base.prepare("SELECT * FROM pieza ORDER BY id").all() as unknown as FilaPieza[];

  const plataformas = new Map<string, Plataforma[]>();
  for (const fila of base.prepare("SELECT pieza_id, plataforma FROM pieza_plataforma").all() as
    unknown as { pieza_id: string; plataforma: string }[]) {
    const lista = plataformas.get(fila.pieza_id) ?? [];
    lista.push(fila.plataforma as Plataforma);
    plataformas.set(fila.pieza_id, lista);
  }

  const objetivos = new Map<string, Record<Objetivo, number>>();
  for (const fila of base.prepare("SELECT pieza_id, objetivo, peso FROM pieza_objetivo").all() as
    unknown as { pieza_id: string; objetivo: string; peso: number }[]) {
    // Se parte de los cuatro objetivos a cero: el motor espera el registro completo y
    // una pieza que no puntúa en algo simplemente no tiene fila.
    const pesos =
      objetivos.get(fila.pieza_id) ??
      (Object.fromEntries(OBJETIVOS.map((o) => [o, 0])) as Record<Objetivo, number>);
    pesos[fila.objetivo as Objetivo] = fila.peso;
    objetivos.set(fila.pieza_id, pesos);
  }

  const requisitos = new Map<string, string[]>();
  for (const fila of base.prepare("SELECT pieza_id, requiere_id FROM pieza_requiere").all() as
    unknown as { pieza_id: string; requiere_id: string }[]) {
    const lista = requisitos.get(fila.pieza_id) ?? [];
    lista.push(fila.requiere_id);
    requisitos.set(fila.pieza_id, lista);
  }

  const chasis = agrupar<Chasis>(base, "SELECT pieza_id, chasis AS valor FROM pieza_chasis");
  const tracciones = agrupar<Traccion>(
    base,
    "SELECT pieza_id, traccion AS valor FROM pieza_traccion",
  );

  // Las tres listas de equipamiento salen de la misma tabla, separadas por `relacion`.
  const equipamiento = new Map<string, Record<string, Equipamiento[]>>();
  for (const fila of base
    .prepare("SELECT pieza_id, relacion, equipamiento FROM pieza_equipamiento")
    .all() as unknown as { pieza_id: string; relacion: string; equipamiento: string }[]) {
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
      precio: { min: fila.precio_min, estimado: fila.precio_estimado, max: fila.precio_max },
      objetivos:
        objetivos.get(fila.id) ??
        (Object.fromEntries(OBJETIVOS.map((o) => [o, 0])) as Record<Objetivo, number>),
      impacto: fila.impacto,
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

  return { version: valorMeta(base, "catalogo_version"), moneda: valorMeta(base, "moneda"), piezas };
}

export function leerModelos(base: BaseDatos): CatalogoModelos {
  const filas = base
    .prepare("SELECT * FROM modelo ORDER BY nombre")
    .all() as unknown as FilaModelo[];

  const alias = new Map<string, string[]>();
  for (const fila of base.prepare("SELECT modelo_id, alias FROM modelo_alias").all() as
    unknown as { modelo_id: string; alias: string }[]) {
    const lista = alias.get(fila.modelo_id) ?? [];
    lista.push(fila.alias);
    alias.set(fila.modelo_id, lista);
  }

  const equipamiento = new Map<string, Equipamiento[]>();
  for (const fila of base
    .prepare("SELECT modelo_id, equipamiento FROM modelo_equipamiento")
    .all() as unknown as { modelo_id: string; equipamiento: string }[]) {
    const lista = equipamiento.get(fila.modelo_id) ?? [];
    lista.push(fila.equipamiento as Equipamiento);
    equipamiento.set(fila.modelo_id, lista);
  }

  const modelos: ModeloVW[] = filas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    alias: alias.get(fila.id) ?? [],
    chasis: fila.chasis as Chasis,
    motor: fila.motor as Plataforma,
    motorDetalle: fila.motor_detalle,
    traccion: fila.traccion as Traccion,
    propulsion: fila.propulsion as Propulsion,
    equipamiento: equipamiento.get(fila.id) ?? [],
    anios: [fila.anio_inicio, fila.anio_fin],
  }));

  return { version: valorMeta(base, "modelos_version"), modelos };
}

/**
 * Piezas compatibles con un motor y que aportan algo a un objetivo, resuelto en SQL.
 * Es la consulta que justifica tener base de datos: cruza tres tablas y ordena por lo
 * que más aporta, sin traerse el catálogo entero a memoria.
 */
export function piezasPorObjetivo(
  base: BaseDatos,
  plataforma: Plataforma,
  objetivo: Objetivo,
): { id: string; nombre: string; categoria: string; peso: number; estimado: number }[] {
  return base
    .prepare(
      `SELECT p.id, p.nombre, p.categoria, o.peso, p.precio_estimado AS estimado
         FROM pieza p
         JOIN pieza_plataforma pl ON pl.pieza_id = p.id
         JOIN pieza_objetivo    o ON o.pieza_id  = p.id
        WHERE pl.plataforma = ? AND o.objetivo = ? AND o.peso > 0
        ORDER BY o.peso DESC, p.precio_estimado ASC`,
    )
    .all(plataforma, objetivo) as unknown as {
    id: string;
    nombre: string;
    categoria: string;
    peso: number;
    estimado: number;
  }[];
}

/** Última siembra registrada, para saber si el webhook hizo su trabajo. */
export function ultimaSiembra(
  base: BaseDatos,
): { fecha: string; origen: string; piezas: number; modelos: number } | null {
  const fila = base
    .prepare("SELECT fecha, origen, piezas, modelos FROM siembra ORDER BY id DESC LIMIT 1")
    .get();
  return (fila ?? null) as { fecha: string; origen: string; piezas: number; modelos: number } | null;
}

/**
 * Junta en un mapa las filas de una tabla que cuelga de `pieza`. La consulta tiene que
 * devolver dos columnas llamadas `pieza_id` y `valor`.
 */
function agrupar<T extends string>(base: BaseDatos, consulta: string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const fila of base.prepare(consulta).all() as unknown as {
    pieza_id: string;
    valor: string;
  }[]) {
    const lista = mapa.get(fila.pieza_id) ?? [];
    lista.push(fila.valor as T);
    mapa.set(fila.pieza_id, lista);
  }
  return mapa;
}

function valorMeta(base: BaseDatos, clave: string): string {
  const fila = base.prepare("SELECT valor FROM meta WHERE clave = ?").get(clave) as
    | { valor: string }
    | undefined;
  return fila?.valor ?? "";
}
