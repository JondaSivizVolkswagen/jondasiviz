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
  Gama,
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

/** Gama ordinal, para poder promediar la del build resultante. */
const NIVEL_GAMA: Record<Gama, number> = { baja: 0, media: 1, alta: 2 };

/** Orden canónico de objetivos, para que el resultado no dependa del orden de clic. */
const ORDEN_OBJETIVOS: Objetivo[] = ["drift", "drag", "mas-cv", "estetica"];

/** Categorías prioritarias por objetivo, de más a menos importante. */
const ESENCIALES: Record<Objetivo, Categoria[]> = {
  drift: ["suspension", "direccion", "transmision", "ruedas", "frenos", "seguridad"],
  drag: ["turbo", "gestion", "transmision", "admision", "escape", "frenos", "ruedas"],
  "mas-cv": ["gestion", "admision", "escape", "turbo"],
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

export function piezasCompatibles(catalogo: Catalogo, plataforma: Plataforma): Pieza[] {
  return catalogo.piezas.filter((p) => p.plataformas.includes(plataforma));
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
): { categorias: RequisitoCategoria[]; total: number } {
  const sel = crearSeleccion(porId, Number.POSITIVE_INFINITY);
  const categorias: RequisitoCategoria[] = [];

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

  if (presupuesto <= 0) {
    avisos.push("Indica un presupuesto mayor que 0.");
    return armarResultado(peticion, [], catalogo, presupuesto, avisos);
  }

  const pool = piezasCompatibles(catalogo, peticion.plataforma);
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
  } = crearSeleccion(porId, presupuesto);

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

  // Una pieza de un grupo ocupado no puede sumarse al plan: haría el mismo trabajo que
  // la que ya está montada. Pero sí puede ocupar su sitio, devolviendo su dinero, si
  // aporta más a los objetivos y la diferencia cabe. Sin esto la primera pieza que pilla
  // el grupo lo bloquea para siempre, aunque sobre presupuesto: el downpipe que entra
  // como dependencia del K04 dejaba fuera al turbo-back, que lo incluye y aporta más.
  const sustituirEnGrupo = (entrante: Pieza): void => {
    const saliente = ocupanteDe(entrante);
    if (!saliente || valor(entrante, objetivos) <= valor(saliente, objetivos)) return;
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

  // Paso 1: cubrir una pieza de cada categoría esencial de los objetivos.
  const categoriasSinCubrir: Categoria[] = [];
  for (const categoria of categoriasEsenciales(objetivos)) {
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

    let cubierta = false;
    for (const pieza of candidatas) {
      if (!grupoLibre(pieza)) continue;
      const paquete = paqueteDe(pieza);
      if (paquete && cabe(paquete.coste)) {
        añadirPaquete(paquete.orden, "esencial");
        cubierta = true;
        break;
      }
    }
    if (!cubierta && candidatas.length > 0) categoriasSinCubrir.push(categoria);
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
    for (const categoria of categoriasSinCubrir.slice(0, 3)) {
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
    piezasCompatibles(catalogo, peticion.plataforma),
    porId,
    objetivos,
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

  const candidatas = piezasCompatibles(catalogo, peticion.plataforma)
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
