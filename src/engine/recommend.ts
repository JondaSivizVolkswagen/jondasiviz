// Motor de recomendación: a partir de plataforma, presupuesto y uno o más objetivos,
// arma una lista de piezas que cabe en el dinero disponible.
//
// La gama no se pide: el pool son todas las piezas compatibles con el motor, y el
// presupuesto decide hasta dónde se llega. La gama del build sale como resultado.

import { cargarCatalogo } from "./catalog";
import { euros } from "./format";
import type {
  Catalogo,
  Categoria,
  Chasis,
  Gama,
  GrupoElegible,
  LineaPresupuesto,
  MejoraSugerida,
  MotivoLinea,
  Objetivo,
  PeticionPresupuesto,
  Pieza,
  Plataforma,
  Presupuesto,
  RequisitoCategoria,
} from "./types";

const ORDEN_CATEGORIAS: Categoria[] = [
  "turbo",
  "gestion",
  "admision",
  "escape",
  "transmision",
  "suspension",
  "direccion",
  "frenos",
  "ruedas",
  "seguridad",
  "estetica",
];

/** Gama ordinal, para poder promediar la del build resultante y comparar dos gamas. */
export const NIVEL_GAMA: Record<Gama, number> = { baja: 0, media: 1, alta: 2 };

/** Orden canónico de objetivos, para que el resultado no dependa del orden de clic. */
const ORDEN_OBJETIVOS: Objetivo[] = ["drift", "drag", "mas-cv", "estetica"];

/**
 * Categorías prioritarias por objetivo, de más a menos importante. Es una matriz de
 * categorías, no de piezas ni de modelos: vale igual para cualquier coche que se meta
 * en el vault, y de cada categoría se sirve lo que ese motor tenga en el catálogo.
 *
 * `frenos` está en todos los objetivos que suben potencia o velocidad de paso por
 * curva. Un proyecto que da caballos y deja el freno de serie no es un proyecto a
 * medias, es un coche peligroso, y por eso cuenta para el mínimo.
 */
const ESENCIALES: Record<Objetivo, Categoria[]> = {
  drift: ["suspension", "direccion", "transmision", "ruedas", "frenos", "seguridad"],
  drag: ["turbo", "gestion", "transmision", "admision", "escape", "frenos", "ruedas"],
  "mas-cv": ["gestion", "admision", "escape", "turbo", "frenos"],
  estetica: ["estetica", "ruedas", "suspension"],
};

const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  admision: "admisión",
  escape: "escape",
  turbo: "turbo",
  gestion: "gestión electrónica",
  suspension: "suspensión",
  transmision: "transmisión",
  frenos: "frenos",
  direccion: "dirección y eje",
  seguridad: "seguridad",
  ruedas: "ruedas",
  estetica: "estética",
};

const NOMBRE_OBJETIVO: Record<Objetivo, string> = {
  drift: "drift",
  drag: "drag",
  "mas-cv": "ganar caballos",
  estetica: "estética",
};

/**
 * Parejas de objetivos que no se pueden pedir a la vez porque el coche se prepara al
 * revés para cada uno. Drift quiere que el eje trasero pierda tracción a voluntad
 * (eje rígido, gomas sacrificables, mucho ángulo de dirección); drag quiere justo lo
 * contrario, agarrar todo lo posible y salir recto. Mezclarlos no da un coche que
 * hace las dos cosas, da uno que no hace ninguna bien.
 *
 * Los demás objetivos sí se combinan con cualquiera: ganar caballos y estética se
 * suman igual de bien a un proyecto de drift que a uno de drag.
 */
const INCOMPATIBLES: [Objetivo, Objetivo][] = [["drift", "drag"]];

/** Objetivos que quedan descartados al elegir este. Vacío si se lleva bien con todos. */
export function enConflictoCon(objetivo: Objetivo): Objetivo[] {
  return INCOMPATIBLES.flatMap(([a, b]) =>
    a === objetivo ? [b] : b === objetivo ? [a] : [],
  );
}

/** Las parejas incompatibles presentes en una selección. Vacío si la selección vale. */
export function conflictosEn(objetivos: Objetivo[]): [Objetivo, Objetivo][] {
  return INCOMPATIBLES.filter(([a, b]) => objetivos.includes(a) && objetivos.includes(b));
}

/**
 * Aplica la elección de un objetivo sobre los ya marcados: lo quita si estaba, y si no
 * lo añade descartando los que se peleen con él. Vive en el motor para que la interfaz
 * no tenga que saberse las reglas de qué combina con qué.
 */
export function alternarObjetivo(objetivos: Objetivo[], elegido: Objetivo): Objetivo[] {
  if (objetivos.includes(elegido)) return objetivos.filter((o) => o !== elegido);
  const descartados = enConflictoCon(elegido);
  return normalizarObjetivos([...objetivos.filter((o) => !descartados.includes(o)), elegido]);
}

/** Objetivos en orden canónico y sin repetidos. */
function normalizarObjetivos(objetivos: Objetivo[]): Objetivo[] {
  return ORDEN_OBJETIVOS.filter((o) => objetivos.includes(o));
}

function nombreObjetivos(objetivos: Objetivo[]): string {
  return normalizarObjetivos(objetivos).map((o) => NOMBRE_OBJETIVO[o]).join(" + ");
}

/** Suma de pesos de la pieza para los objetivos elegidos (0..5 por objetivo). */
function peso(pieza: Pieza, objetivos: Objetivo[]): number {
  return objetivos.reduce((s, o) => s + pieza.objetivos[o], 0);
}

function valor(pieza: Pieza, objetivos: Objetivo[]): number {
  return peso(pieza, objetivos) * pieza.impacto;
}

function valorPorEuro(pieza: Pieza, objetivos: Objetivo[]): number {
  return valor(pieza, objetivos) / pieza.precio.estimado;
}

/** Categorías esenciales combinadas de todos los objetivos, sin repetir. */
function categoriasEsenciales(objetivos: Objetivo[]): Categoria[] {
  const vistas = new Set<Categoria>();
  const salida: Categoria[] = [];
  for (const o of normalizarObjetivos(objetivos)) {
    for (const c of ESENCIALES[o]) {
      if (!vistas.has(c)) {
        vistas.add(c);
        salida.push(c);
      }
    }
  }
  return salida;
}

/**
 * Piezas que puede montar un coche. Las de motor se resuelven por plataforma y las de
 * chasis por chasis, la misma regla que usa `encaja` en `compat.ts`.
 *
 * El chasis es opcional porque la petición puede venir sin modelo resuelto, pero
 * cuando falta se pierden todas las piezas que solo declaran chasis: suspensión,
 * frenos, dirección, ruedas, seguridad y estética de las plataformas modernas.
 */
export function piezasCompatibles(
  catalogo: Catalogo,
  plataforma: Plataforma,
  chasis?: Chasis,
): Pieza[] {
  return catalogo.piezas.filter((p) => {
    if (p.chasis.length > 0) return chasis !== undefined && p.chasis.includes(chasis);
    return p.plataformas.includes(plataforma);
  });
}

/** Si la pieza depende, directa o en cadena, de la otra. */
function dependeDe(pieza: Pieza, id: string, porId: Map<string, Pieza>): boolean {
  const vistos = new Set<string>([pieza.id]);
  const rec = (p: Pieza): boolean =>
    p.requiere.some((dep) => {
      if (dep === id) return true;
      if (vistos.has(dep)) return false;
      vistos.add(dep);
      const siguiente = porId.get(dep);
      return siguiente ? rec(siguiente) : false;
    });
  return rec(pieza);
}

/**
 * Si una dependencia está cubierta por el plan. Vale su propio id, y vale también otra
 * pieza del mismo grupo exclusivo: son la misma función, y el motor monta solo una.
 * Es la misma regla que usa `compat.ts` al contar lo que arrastra una pieza, y la que
 * hace legal sustituir el downpipe que exige el turbo por un turbo-back que lo incluye.
 */
export function dependenciaCubierta(
  dep: string,
  montadas: Pieza[],
  porId: Map<string, Pieza>,
): boolean {
  if (montadas.some((m) => m.id === dep)) return true;
  const pieza = porId.get(dep);
  return (
    pieza?.grupoExclusivo !== undefined &&
    montadas.some((m) => m.grupoExclusivo === pieza.grupoExclusivo)
  );
}

/**
 * Nombres bonitos para los grupos que ya existen. Lo que no esté aquí se enseña con el
 * propio slug legible ("parachoques-delantero" -> "parachoques delantero"), así que un
 * grupo nuevo del vault sale bien sin tener que tocar este mapa.
 */
const NOMBRE_GRUPO: Record<string, string> = {
  "admision-filtro": "filtro de admisión",
  altura: "altura y suspensión",
  carroceria: "carrocería",
  "frenos-delanteros": "freno delantero",
  "turbo-principal": "turbo",
};

export function nombreGrupo(grupo: string): string {
  return NOMBRE_GRUPO[grupo] ?? grupo.replace(/-/g, " ");
}

/**
 * Las partes del coche donde de verdad hay algo que elegir: grupos exclusivos con dos o
 * más piezas compatibles que aporten a los objetivos. Con una sola alternativa no se
 * enseña selector, porque no sería una elección.
 *
 * Sale del catálogo, así que en cuanto el vault tenga tres parachoques del Mk5 con el
 * mismo `grupoExclusivo`, aparecen aquí solos. No hay nada que registrar a mano.
 */
export function gruposElegibles(
  catalogo: Catalogo,
  plataforma: Plataforma,
  objetivos: Objetivo[],
  chasis?: Chasis,
): GrupoElegible[] {
  const activos = normalizarObjetivos(objetivos);
  if (activos.length === 0) return [];

  const porGrupo = new Map<string, Pieza[]>();
  for (const pieza of piezasCompatibles(catalogo, plataforma, chasis)) {
    if (!pieza.grupoExclusivo || peso(pieza, activos) <= 0) continue;
    const suyas = porGrupo.get(pieza.grupoExclusivo);
    if (suyas) suyas.push(pieza);
    else porGrupo.set(pieza.grupoExclusivo, [pieza]);
  }

  return [...porGrupo]
    .filter(([, piezas]) => piezas.length > 1)
    .map(([grupo, piezas]) => ({
      grupo,
      nombre: nombreGrupo(grupo),
      categoria: piezas[0].categoria,
      piezas: [...piezas].sort(
        (a, b) => a.precio.estimado - b.precio.estimado || a.id.localeCompare(b.id),
      ),
    }))
    .sort(
      (a, b) =>
        ORDEN_CATEGORIAS.indexOf(a.categoria) - ORDEN_CATEGORIAS.indexOf(b.categoria) ||
        a.nombre.localeCompare(b.nombre),
    );
}

/**
 * Gama del build a partir de sus líneas, ponderada por el dinero que se lleva cada
 * pieza: unos coilovers de 2.500 € pesan más que cuatro detalles de 50 €, así que
 * eso es un build de gama alta y no una mezcla sin nombre.
 */
export function gamaDeLineas(lineas: LineaPresupuesto[]): Gama | null {
  const total = lineas.reduce((s, l) => s + l.precio, 0);
  if (total <= 0) return null;
  const nivel = lineas.reduce((s, l) => s + NIVEL_GAMA[l.pieza.gama] * l.precio, 0) / total;
  if (nivel < 2 / 3) return "baja";
  if (nivel < 4 / 3) return "media";
  return "alta";
}

/**
 * Mecánica de ir eligiendo piezas: qué está cogido, qué grupos están ocupados, cuánto
 * cuesta un paquete con sus dependencias y si cabe. La usan tanto el presupuesto real
 * como el cálculo de mínimos, que es el mismo juego con dinero infinito.
 */
function crearSeleccion(porId: Map<string, Pieza>, presupuesto: number) {
  const elegidas = new Map<string, MotivoLinea>();
  // Grupo exclusivo -> id de la pieza que lo ocupa. Guardar el id, y no solo que el
  // grupo está pillado, es lo que permite sustituir a esa pieza por una mejor.
  const ocupantes = new Map<string, string>();
  let gastado = 0;

  const grupoLibre = (pieza: Pieza): boolean =>
    !pieza.grupoExclusivo || !ocupantes.has(pieza.grupoExclusivo);

  /** La pieza que hoy cumple la función de esta otra, si el grupo está ocupado. */
  const ocupanteDe = (pieza: Pieza): Pieza | null => {
    const id = pieza.grupoExclusivo ? ocupantes.get(pieza.grupoExclusivo) : undefined;
    return id ? (porId.get(id) ?? null) : null;
  };

  // Devuelve el paquete (dependencias primero, pieza al final) y su coste,
  // contando solo lo que aún no está elegido. null si falta alguna dependencia.
  // Si una dependencia comparte grupo con algo ya elegido, se da por cubierta.
  const paqueteDe = (raiz: Pieza): { orden: string[]; coste: number } | null => {
    const orden: string[] = [];
    const vistos = new Set<string>();
    let coste = 0;
    let falta = false;

    const rec = (id: string, esRaiz: boolean): void => {
      if (elegidas.has(id) || vistos.has(id)) return;
      const p = porId.get(id);
      if (!p) {
        falta = true;
        return;
      }
      if (!esRaiz && p.grupoExclusivo && ocupantes.has(p.grupoExclusivo)) return;
      vistos.add(id);
      for (const dep of p.requiere) rec(dep, false);
      orden.push(id);
      coste += p.precio.estimado;
    };

    rec(raiz.id, true);
    return falta ? null : { orden, coste };
  };

  const añadirPaquete = (orden: string[], motivoFinal: MotivoLinea): void => {
    orden.forEach((id, i) => {
      if (elegidas.has(id)) return;
      const pieza = porId.get(id)!;
      elegidas.set(id, i === orden.length - 1 ? motivoFinal : "dependencia");
      if (pieza.grupoExclusivo) ocupantes.set(pieza.grupoExclusivo, id);
      gastado += pieza.precio.estimado;
    });
  };

  // Saca una pieza del plan y devuelve su dinero. Solo la usa la sustitución, que
  // mete acto seguido otra pieza del mismo grupo, así que el hueco no queda abierto.
  const quitar = (pieza: Pieza): MotivoLinea => {
    const motivo = elegidas.get(pieza.id) ?? "valor";
    elegidas.delete(pieza.id);
    if (pieza.grupoExclusivo && ocupantes.get(pieza.grupoExclusivo) === pieza.id) {
      ocupantes.delete(pieza.grupoExclusivo);
    }
    gastado -= pieza.precio.estimado;
    return motivo;
  };

  const cabe = (coste: number): boolean => gastado + coste <= presupuesto;

  /** Si cabe un paquete contando con lo que devuelve la pieza a la que sustituye. */
  const cabeSustituyendo = (coste: number, saliente: Pieza): boolean =>
    gastado - saliente.precio.estimado + coste <= presupuesto;

  return {
    elegidas,
    grupoLibre,
    ocupanteDe,
    paqueteDe,
    añadirPaquete,
    quitar,
    cabe,
    cabeSustituyendo,
    total: () => gastado,
  };
}

/**
 * Qué hace falta como mínimo para cubrir cada categoría esencial de los objetivos.
 * Recorre las categorías por orden de prioridad cogiendo siempre la opción más barata
 * que aporta algo y arrastrando sus dependencias, sin límite de dinero. El total es
 * lo que cuesta el proyecto pelado, con las dependencias compartidas contadas una vez:
 * si el turbo ya trae el downpipe, cubrir escape después sale gratis.
 */
export function minimosEsenciales(
  pool: Pieza[],
  porId: Map<string, Pieza>,
  objetivos: Objetivo[],
  elecciones: string[] = [],
): { categorias: RequisitoCategoria[]; total: number } {
  const sel = crearSeleccion(porId, Number.POSITIVE_INFINITY);
  const categorias: RequisitoCategoria[] = [];

  // Lo que el comprador ha elegido a mano cuenta para el mínimo: si pide unas llantas
  // de 1.900 €, el suelo de su proyecto ya no es el de las llantas más baratas. Va
  // primero, para que después cada categoría esencial se mire con eso ya puesto.
  for (const id of elecciones) {
    const pieza = porId.get(id);
    if (!pieza || sel.elegidas.has(id) || !sel.grupoLibre(pieza)) continue;
    if (!pool.some((p) => p.id === id)) continue;
    const paquete = sel.paqueteDe(pieza);
    if (paquete) sel.añadirPaquete(paquete.orden, "elegida");
  }

  for (const categoria of categoriasEsenciales(objetivos)) {
    const yaCubierta = [...sel.elegidas.keys()]
      .map((id) => porId.get(id)!)
      .find((p) => p.categoria === categoria);
    if (yaCubierta) {
      categorias.push({ categoria, pieza: yaCubierta, minimo: 0, cubierta: false });
      continue;
    }

    const candidatas = pool
      .filter((p) => p.categoria === categoria && peso(p, objetivos) > 0 && sel.grupoLibre(p))
      .map((pieza) => ({ pieza, paquete: sel.paqueteDe(pieza) }))
      .filter((c): c is { pieza: Pieza; paquete: { orden: string[]; coste: number } } =>
        c.paquete !== null,
      )
      .sort((a, b) => a.paquete.coste - b.paquete.coste || a.pieza.id.localeCompare(b.pieza.id));

    const mejor = candidatas[0];
    if (!mejor) {
      categorias.push({ categoria, pieza: null, minimo: 0, cubierta: false });
      continue;
    }
    sel.añadirPaquete(mejor.paquete.orden, "esencial");
    categorias.push({ categoria, pieza: mejor.pieza, minimo: mejor.paquete.coste, cubierta: false });
  }

  return { categorias, total: sel.total() };
}

/**
 * Genera el presupuesto recomendado. El catálogo es inyectable para poder
 * probar el motor con datos controlados.
 */
export function generarPresupuesto(
  peticion: PeticionPresupuesto,
  catalogo: Catalogo = cargarCatalogo(),
): Presupuesto {
  const avisos: string[] = [];
  const objetivos = normalizarObjetivos(peticion.objetivos);
  const presupuesto = Number.isFinite(peticion.presupuesto) ? peticion.presupuesto : 0;

  if (objetivos.length === 0) {
    avisos.push("Elige al menos un objetivo para el proyecto.");
    return armarResultado(peticion, [], catalogo, presupuesto, avisos);
  }

  // La interfaz no deja llegar aquí con una pareja imposible, pero la CLI y cualquier
  // otro consumidor sí pueden. Se avisa en vez de callar y devolver un plan que suma
  // pesos contrarios y no sirve para ninguno de los dos objetivos.
  for (const [a, b] of conflictosEn(objetivos)) {
    avisos.push(
      `${NOMBRE_OBJETIVO[a]} y ${NOMBRE_OBJETIVO[b]} piden preparaciones contrarias y no ` +
        "se pueden combinar: el plan mezcla piezas que se estorban entre ellas.",
    );
  }

  if (presupuesto <= 0) {
    avisos.push("Indica un presupuesto mayor que 0.");
    return armarResultado(peticion, [], catalogo, presupuesto, avisos);
  }

  const pool = piezasCompatibles(catalogo, peticion.plataforma, peticion.chasis);
  if (pool.length === 0) {
    avisos.push(`Todavía no hay piezas en el catálogo para ${peticion.plataforma}.`);
    return armarResultado(peticion, [], catalogo, presupuesto, avisos);
  }

  const porId = new Map(catalogo.piezas.map((p) => [p.id, p] as const));
  const {
    elegidas,
    grupoLibre,
    ocupanteDe,
    paqueteDe,
    añadirPaquete,
    quitar,
    cabe,
    cabeSustituyendo,
  } = crearSeleccion(
    porId,
    presupuesto,
  );

  // Paso 0: lo que ha elegido el comprador entra antes que nada. Es una decisión suya,
  // no una recomendación, así que se respeta incluso si el motor habría puesto otra
  // cosa. Lo único que no se salta es el presupuesto: si no cabe, se dice y ya está.
  for (const id of peticion.elecciones ?? []) {
    const pieza = porId.get(id);
    if (!pieza || elegidas.has(id)) continue;
    if (!pool.some((p) => p.id === id)) {
      avisos.push(`${pieza.nombre} no encaja en un ${peticion.plataforma}, así que se ignora.`);
      continue;
    }
    if (!grupoLibre(pieza)) continue;
    const paquete = paqueteDe(pieza);
    if (paquete && cabe(paquete.coste)) {
      añadirPaquete(paquete.orden, "elegida");
    } else {
      avisos.push(
        `${pieza.nombre} cuesta ${euros(paquete?.coste ?? pieza.precio.estimado)} con lo que ` +
          "necesita para funcionar, y con este presupuesto no entra.",
      );
    }
  }

  // De un grupo exclusivo solo entra una pieza, y el relleno va por aporte por euro,
  // así que sin esto se queda con la más barata del grupo y bloquea a la buena para
  // siempre, aunque sobre dinero. Se sube a la de más aporte técnico que quepa.
  const mejorDelGrupo = (pieza: Pieza): Pieza => {
    if (!pieza.grupoExclusivo) return pieza;
    const hermanas = pool
      .filter((p) => p.grupoExclusivo === pieza.grupoExclusivo && !elegidas.has(p.id))
      .sort(
        (a, b) =>
          valor(b, objetivos) - valor(a, objetivos) ||
          a.precio.estimado - b.precio.estimado ||
          a.id.localeCompare(b.id),
      );
    for (const hermana of hermanas) {
      const paquete = paqueteDe(hermana);
      if (paquete && cabe(paquete.coste)) return hermana;
    }
    return pieza;
  };

  // Categorías esenciales que el catálogo puede servir de verdad. De las demás no se
  // avisa: no es que falte presupuesto, es que no hay ninguna pieza que ofrecer.
  const esencialesServibles = categoriasEsenciales(objetivos).filter((categoria) =>
    pool.some((p) => p.categoria === categoria && peso(p, objetivos) > 0),
  );

  const yaCubierta = (categoria: Categoria): boolean =>
    [...elegidas.keys()].some((id) => porId.get(id)!.categoria === categoria);

  /**
   * Lo más barato que cuesta cubrir una categoría ahora mismo, con sus dependencias y
   * descontando lo que ya está elegido. null si el catálogo no puede servirla.
   */
  const costeMinimoDe = (categoria: Categoria, bloqueados?: Set<string>): number | null => {
    let minimo: number | null = null;
    for (const p of pool) {
      if (p.categoria !== categoria || peso(p, objetivos) <= 0) continue;
      if (elegidas.has(p.id) || !grupoLibre(p)) continue;
      if (bloqueados && p.grupoExclusivo && bloqueados.has(p.grupoExclusivo)) continue;
      const paquete = paqueteDe(p);
      if (paquete && (minimo === null || paquete.coste < minimo)) minimo = paquete.coste;
    }
    return minimo;
  };

  // Paso 1: cubrir una pieza de cada categoría esencial de los objetivos. Una categoría
  // que ya entró arrastrada como dependencia cuenta como cubierta y se salta: el
  // downpipe que trae el turbo ya es el escape del proyecto.
  //
  // Antes de gastar en una categoría se reserva lo que costaría cubrir por lo mínimo las
  // que vienen detrás. Sin esa reserva la primera de la lista se llevaba el presupuesto
  // entero y los frenos se quedaban fuera, aun habiendo dinero de sobra para un turbo
  // más modesto y unos frenos. Es lo que hace que el mínimo del proyecto signifique algo:
  // con ese dinero justo, las esenciales entran de verdad.
  for (let i = 0; i < esencialesServibles.length; i++) {
    const categoria = esencialesServibles[i];
    if (yaCubierta(categoria)) continue;

    const candidatas = pool
      .filter(
        (p) =>
          p.categoria === categoria &&
          peso(p, objetivos) > 0 &&
          !elegidas.has(p.id) &&
          grupoLibre(p),
      )
      .sort(
        (a, b) =>
          valor(b, objetivos) - valor(a, objetivos) ||
          valorPorEuro(b, objetivos) - valorPorEuro(a, objetivos) ||
          a.precio.estimado - b.precio.estimado ||
          a.id.localeCompare(b.id),
      );

    const pendientes = esencialesServibles.slice(i + 1).filter((c) => !yaCubierta(c));

    /**
     * Lo que hay que reservar para las categorías de detrás si se coge este paquete.
     *
     * Se calcula por candidata y no una vez, porque la propia elección cambia lo que
     * queda por cubrir: si el air ride ocupa el grupo de la altura, la suspensión ya no
     * tiene nada que montar y reservarle dinero es apartarlo para nada. Ese euro de más
     * hacía que con el techo justo saliera un plan distinto al de dinero infinito.
     */
    const reservaTras = (paquete: { orden: string[] }): number => {
      const bloqueados = new Set(
        paquete.orden
          .map((id) => porId.get(id)!.grupoExclusivo)
          .filter((g): g is string => g != null),
      );
      return pendientes.reduce((s, c) => s + (costeMinimoDe(c, bloqueados) ?? 0), 0);
    };

    const elegir = (conReserva: boolean): boolean => {
      for (const pieza of candidatas) {
        if (!grupoLibre(pieza)) continue;
        const paquete = paqueteDe(pieza);
        if (!paquete) continue;
        const margen = conReserva ? reservaTras(paquete) : 0;
        if (cabe(paquete.coste + margen)) {
          añadirPaquete(paquete.orden, "esencial");
          return true;
        }
      }
      return false;
    };

    /**
     * Cuando ni respetando la reserva cabe nada, se cubre la categoría por lo más
     * barato en vez de por lo que más aporta.
     *
     * Con la reserva satisfecha manda el aporte técnico, que es lo que se quiere. Pero
     * si no cabe, seguir cogiendo la pieza de más aporte se lleva por delante a las
     * categorías que vienen detrás: un Audi Q2 con el mínimo justo para "mas-cv" se
     * gastaba el presupuesto en el Stage 2, que arrastra downpipe y admisión, y se
     * quedaba sin turbo, que es la categoría por la que existe ese objetivo.
     */
    const elegirBarata = (): boolean => {
      const porCoste = candidatas
        .map((pieza) => ({ pieza, paquete: paqueteDe(pieza) }))
        .filter((c): c is { pieza: Pieza; paquete: { orden: string[]; coste: number } } =>
          c.paquete !== null,
        )
        .sort((a, b) => a.paquete.coste - b.paquete.coste || a.pieza.id.localeCompare(b.pieza.id));
      for (const { pieza, paquete } of porCoste) {
        if (!grupoLibre(pieza) || !cabe(paquete.coste)) continue;
        añadirPaquete(paquete.orden, "esencial");
        return true;
      }
      return false;
    };

    if (!elegir(true)) elegirBarata();
  }

  // Paso 2: rellenar con lo que más aporta por euro mientras quede dinero.
  const relleno = pool
    .filter((p) => !elegidas.has(p.id) && peso(p, objetivos) > 0)
    .sort(
      (a, b) =>
        valorPorEuro(b, objetivos) - valorPorEuro(a, objetivos) ||
        peso(b, objetivos) - peso(a, objetivos) ||
        a.precio.estimado - b.precio.estimado ||
        a.id.localeCompare(b.id),
    );

  // Una pieza de un grupo ocupado no puede sumarse al plan: haría el mismo trabajo que
  // la que ya está montada. Pero sí puede ocupar su sitio, devolviendo su dinero, si
  // aporta más a los objetivos y la diferencia cabe. Sin esto la primera pieza que pilla
  // el grupo lo bloquea para siempre, aunque sobre presupuesto: el downpipe que entra
  // como dependencia del K04 dejaba fuera al turbo-back, que lo incluye y aporta más.
  const sustituirEnGrupo = (entrante: Pieza): void => {
    const saliente = ocupanteDe(entrante);
    if (!saliente || valor(entrante, objetivos) <= valor(saliente, objetivos)) return;
    // Una pieza que el comprador ha elegido a mano no se la quita el motor.
    if (elegidas.get(saliente.id) === "elegida") return;
    // El sustituto cubre por grupo lo que otras piezas exigen del saliente; lo que no
    // puede es necesitar al saliente él mismo.
    if (dependeDe(entrante, saliente.id, porId)) return;

    // Cambiar de categoría dentro del grupo (pasar de un rebaje estético a unos
    // coilovers, por ejemplo) no puede dejar sin cubrir la categoría del saliente.
    const categoriaSigueCubierta =
      entrante.categoria === saliente.categoria ||
      [...elegidas.keys()].some(
        (id) => id !== saliente.id && porId.get(id)!.categoria === saliente.categoria,
      );
    if (!categoriaSigueCubierta) return;

    const paquete = paqueteDe(entrante);
    if (!paquete || !cabeSustituyendo(paquete.coste, saliente)) return;

    // El sustituto hereda el papel del saliente cuando cubre su misma categoría: si el
    // downpipe estaba ahí por ser dependencia del turbo, el turbo-back lo sigue estando.
    const motivo = quitar(saliente);
    añadirPaquete(paquete.orden, entrante.categoria === saliente.categoria ? motivo : "valor");
  };

  for (const candidata of relleno) {
    if (elegidas.has(candidata.id)) continue;
    if (!grupoLibre(candidata)) {
      sustituirEnGrupo(candidata);
      continue;
    }
    const pieza = mejorDelGrupo(candidata);
    const paquete = paqueteDe(pieza);
    if (paquete && cabe(paquete.coste)) añadirPaquete(paquete.orden, "valor");
  }

  const lineas: LineaPresupuesto[] = [...elegidas].map(([id, motivo]) => {
    const pieza = porId.get(id)!;
    return { pieza, precio: pieza.precio.estimado, motivo };
  });

  if (lineas.length === 0) {
    avisos.push(
      `El presupuesto de ${presupuesto} ${catalogo.moneda} no llega para ninguna pieza ` +
        `orientada a ${nombreObjetivos(objetivos)}.`,
    );
  } else {
    // Los huecos se miran sobre la selección final, no sobre el paso de esenciales:
    // entre medias el relleno y las dependencias tapan categorías, y antes se avisaba
    // de un hueco que en la lista de al lado aparecía cubierto.
    for (const categoria of esencialesServibles.filter((c) => !yaCubierta(c)).slice(0, 3)) {
      avisos.push(
        `Con este presupuesto no entra nada de ${NOMBRE_CATEGORIA[categoria]}, ` +
          `prioritario para un proyecto de ${nombreObjetivos(objetivos)}.`,
      );
    }
  }

  return armarResultado(peticion, lineas, catalogo, presupuesto, avisos);
}

function armarResultado(
  peticion: PeticionPresupuesto,
  lineas: LineaPresupuesto[],
  catalogo: Catalogo,
  presupuesto: number,
  avisos: string[],
): Presupuesto {
  const ordenadas = [...lineas].sort(
    (a, b) =>
      ORDEN_CATEGORIAS.indexOf(a.pieza.categoria) - ORDEN_CATEGORIAS.indexOf(b.pieza.categoria) ||
      b.precio - a.precio ||
      a.pieza.id.localeCompare(b.pieza.id),
  );

  const total = ordenadas.reduce((s, l) => s + l.precio, 0);
  const restante = presupuesto - total;
  const gamaResultante = gamaDeLineas(ordenadas);

  const objetivos = normalizarObjetivos(peticion.objetivos);
  const porId = new Map(catalogo.piezas.map((p) => [p.id, p] as const));
  const minimos = minimosEsenciales(
    piezasCompatibles(catalogo, peticion.plataforma, peticion.chasis),
    porId,
    objetivos,
    peticion.elecciones ?? [],
  );
  const cubiertas = new Set(ordenadas.map((l) => l.pieza.categoria));
  const esenciales = minimos.categorias.map((r) => ({ ...r, cubierta: cubiertas.has(r.categoria) }));

  const porCategoria = ORDEN_CATEGORIAS.map((categoria) => {
    const suyas = ordenadas.filter((l) => l.pieza.categoria === categoria);
    return { categoria, total: suyas.reduce((s, l) => s + l.precio, 0), lineas: suyas };
  }).filter((g) => g.lineas.length > 0);

  return {
    peticion,
    lineas: ordenadas,
    porCategoria,
    total,
    restante,
    gamaResultante,
    esenciales,
    minimoEsencial: minimos.total,
    siguientesMejoras: calcularMejoras(peticion, ordenadas, catalogo, Math.max(0, restante)),
    avisos,
  };
}

function calcularMejoras(
  peticion: PeticionPresupuesto,
  lineas: LineaPresupuesto[],
  catalogo: Catalogo,
  restante: number,
): MejoraSugerida[] {
  const yaElegidas = new Set(lineas.map((l) => l.pieza.id));
  const montadas = lineas.map((l) => l.pieza);
  const porId = new Map(catalogo.piezas.map((p) => [p.id, p] as const));
  const porGrupo = new Map(
    montadas.filter((p) => p.grupoExclusivo).map((p) => [p.grupoExclusivo!, p] as const),
  );
  const objetivos = normalizarObjetivos(peticion.objetivos);
  if (objetivos.length === 0) return [];

  // Una pieza que cumple la misma función que otra ya montada no se suma al plan: se
  // cambia por ella. Entra en la lista si aporta más, y entonces lo que hay que reunir
  // es la diferencia, porque la que sale devuelve su dinero.
  const sustituible = (p: Pieza): Pieza | null => {
    const montada = p.grupoExclusivo ? porGrupo.get(p.grupoExclusivo) : undefined;
    if (!montada) return null;
    if (valor(p, objetivos) <= valor(montada, objetivos)) return null;
    if (dependeDe(p, montada.id, porId)) return null;
    const categoriaSigueCubierta =
      p.categoria === montada.categoria ||
      montadas.some((m) => m.id !== montada.id && m.categoria === montada.categoria);
    return categoriaSigueCubierta ? montada : null;
  };

  const candidatas = piezasCompatibles(catalogo, peticion.plataforma, peticion.chasis)
    .filter(
      (p) =>
        !yaElegidas.has(p.id) &&
        peso(p, objetivos) > 0 &&
        (!p.grupoExclusivo || !porGrupo.has(p.grupoExclusivo) || sustituible(p) !== null),
    )
    .sort(
      (a, b) =>
        valor(b, objetivos) - valor(a, objetivos) ||
        valorPorEuro(b, objetivos) - valorPorEuro(a, objetivos) ||
        a.precio.estimado - b.precio.estimado ||
        a.id.localeCompare(b.id),
    );

  // Dos piezas del mismo grupo tampoco tienen sentido entre las sugerencias: son
  // la misma mejora contada dos veces. Se queda la de más aporte.
  const mejoras: MejoraSugerida[] = [];
  const gruposSugeridos = new Set<string>();
  for (const pieza of candidatas) {
    if (mejoras.length === 3) break;
    if (pieza.grupoExclusivo) {
      if (gruposSugeridos.has(pieza.grupoExclusivo)) continue;
      gruposSugeridos.add(pieza.grupoExclusivo);
    }
    const sustituye = sustituible(pieza);
    mejoras.push({
      pieza,
      precio: pieza.precio.estimado,
      falta: Math.max(0, pieza.precio.estimado - (sustituye?.precio.estimado ?? 0) - restante),
      sustituye: sustituye ?? undefined,
    });
  }
  return mejoras;
}

/**
 * Categorías que no son "acabado del proyecto" sino seguridad: frenar, agarrar, girar
 * y sujetar al que va dentro. Que falte estética deja el coche a medias; que falten
 * estas con el motor ya tocado deja un coche peligroso, y esa diferencia hay que
 * decirla con otras palabras.
 */
const CRITICAS: Categoria[] = ["frenos", "ruedas", "direccion", "seguridad"];

/**
 * Objetivos que cambian cómo va el coche. Lo de arriba solo es un peligro si hay uno
 * de estos en juego: en un proyecto de pura estética las llantas que no entran son un
 * acabado que falta, no un riesgo, y el coche frena igual que salió de fábrica.
 */
const OBJETIVOS_DE_MARCHA: Objetivo[] = ["drift", "drag", "mas-cv"];

/**
 * De las categorías esenciales que se quedan fuera, las que hacen el coche peligroso.
 * Vacío no significa que el proyecto esté completo, solo que lo que falta no mata.
 *
 * Se ignoran las que el catálogo no puede servir para ese motor (`pieza: null`): que
 * no haya frenos fichados para una plataforma es un hueco de datos, y avisar al
 * usuario de un peligro que no puede resolver con dinero sería mentirle.
 */
export function riesgosSinCubrir(presupuesto: Presupuesto): Categoria[] {
  const objetivos = normalizarObjetivos(presupuesto.peticion.objetivos);
  if (!objetivos.some((o) => OBJETIVOS_DE_MARCHA.includes(o))) return [];

  return presupuesto.esenciales
    .filter((e) => !e.cubierta && e.pieza !== null && CRITICAS.includes(e.categoria))
    .map((e) => e.categoria);
}

/** Los nombres de esas categorías encadenados como se dicen: "a, b ni c". */
export function nombresCategorias(categorias: Categoria[]): string {
  const nombres = categorias.map((c) => NOMBRE_CATEGORIA[c]);
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} ni ${nombres[nombres.length - 1]}`;
}

/**
 * El aviso de que lo que falta no es acabado, es seguridad. null cuando lo que se queda
 * fuera no compromete la conducción: no hay que gastar la palabra "peligroso" en un
 * build de estética al que le falta un alerón, o deja de significar nada.
 */
export function fraseRiesgo(presupuesto: Presupuesto): string | null {
  const riesgos = riesgosSinCubrir(presupuesto);
  if (riesgos.length === 0) return null;

  return (
    `Con ${euros(presupuesto.peticion.presupuesto)} el coche se queda sin ` +
    `${nombresCategorias(riesgos)}. Preparar el coche para ir más rápido y dejar como ` +
    "está lo que frena y agarra no deja un build a medias: deja un coche peligroso."
  );
}

/**
 * El presupuesto a partir del cual poner más dinero ya no cambia nada: lo que cuesta el
 * build más completo que este coche admite para estos objetivos.
 *
 * Se calcula pasando el motor con un techo que no puede limitar (todo el catálogo
 * compatible sumado) y quedándose con lo que acaba gastando. Ese total es además un
 * punto fijo: con ese dinero exacto el motor toma las mismas decisiones que sin límite,
 * porque en cada paso lleva gastado lo mismo y todo lo que cabía sigue cabiendo. Un euro
 * más solo engorda el sobrante.
 */
export function techoUtil(
  catalogo: Catalogo,
  plataforma: Plataforma,
  objetivos: Objetivo[],
  elecciones: string[] = [],
  chasis?: Chasis,
): number {
  const pool = piezasCompatibles(catalogo, plataforma, chasis);
  if (pool.length === 0 || normalizarObjetivos(objetivos).length === 0) return 0;

  const sinLimite = pool.reduce((s, p) => s + p.precio.estimado, 0);
  return generarPresupuesto(
    { plataforma, chasis, presupuesto: sinLimite, objetivos, elecciones },
    catalogo,
  ).total;
}

/**
 * La frase que explica el mínimo del proyecto. Vive aquí, con los demás textos de
 * presentación, para que el formulario y el PDF cuenten exactamente lo mismo.
 *
 * El caso raro que hay que explicar bien: puedes tener de sobra para el mínimo y aun
 * así ver categorías fuera, porque el motor prefiere concentrar el dinero en lo que
 * más pesa antes que repartirlo en la opción más barata de cada cosa.
 */
export function fraseMinimo(presupuesto: Presupuesto): string {
  const objetivos = nombreObjetivos(presupuesto.peticion.objetivos);
  const dinero = presupuesto.peticion.presupuesto;
  const fuera = presupuesto.esenciales.filter((e) => !e.cubierta);
  const base =
    `Cubrir lo esencial de ${objetivos} por lo mínimo cuesta ${euros(presupuesto.minimoEsencial)}.`;

  if (dinero < presupuesto.minimoEsencial) {
    return `${base} Con ${euros(dinero)} te faltan ${euros(presupuesto.minimoEsencial - dinero)} ` +
      "para el proyecto completo.";
  }
  if (fuera.length === 0) return `${base} Tu presupuesto lo cubre entero.`;

  const nombres = fuera.map((e) => NOMBRE_CATEGORIA[e.categoria]).join(", ");
  return (
    `${base} Te sobra para ese mínimo, pero el plan concentra el dinero en las piezas de ` +
    `más peso y deja fuera ${nombres}.`
  );
}

export { NOMBRE_CATEGORIA, NOMBRE_OBJETIVO, normalizarObjetivos, nombreObjetivos };
