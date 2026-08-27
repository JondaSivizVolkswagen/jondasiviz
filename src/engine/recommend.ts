// Motor de recomendación: a partir de plataforma, gama, presupuesto y uno o más
// objetivos, arma una lista de piezas que cabe en el dinero disponible.

import { cargarCatalogo } from "./catalog";
import type {
  Catalogo,
  Categoria,
  LineaPresupuesto,
  MejoraSugerida,
  MotivoLinea,
  Objetivo,
  PeticionPresupuesto,
  Pieza,
  Presupuesto,
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

export function piezasCompatibles(
  catalogo: Catalogo,
  peticion: Pick<PeticionPresupuesto, "plataforma" | "gama">,
): Pieza[] {
  return catalogo.piezas.filter(
    (p) => p.plataformas.includes(peticion.plataforma) && p.gama === peticion.gama,
  );
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

  const pool = piezasCompatibles(catalogo, peticion);
  if (pool.length === 0) {
    avisos.push(
      `No hay piezas para ${peticion.plataforma} en gama ${peticion.gama}. Prueba con otra gama.`,
    );
    return armarResultado(peticion, [], catalogo, presupuesto, avisos);
  }

  const porId = new Map(catalogo.piezas.map((p) => [p.id, p] as const));
  const elegidas = new Map<string, MotivoLinea>();
  const gruposUsados = new Set<string>();
  let gastado = 0;

  const grupoLibre = (pieza: Pieza): boolean =>
    !pieza.grupoExclusivo || !gruposUsados.has(pieza.grupoExclusivo);

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
      if (!esRaiz && p.grupoExclusivo && gruposUsados.has(p.grupoExclusivo)) return;
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
      if (pieza.grupoExclusivo) gruposUsados.add(pieza.grupoExclusivo);
      gastado += pieza.precio.estimado;
    });
  };

  const cabe = (coste: number): boolean => gastado + coste <= presupuesto;

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

  for (const pieza of relleno) {
    if (elegidas.has(pieza.id) || !grupoLibre(pieza)) continue;
    const paquete = paqueteDe(pieza);
    if (paquete && cabe(paquete.coste)) añadirPaquete(paquete.orden, "valor");
  }

  const lineas: LineaPresupuesto[] = [...elegidas].map(([id, motivo]) => {
    const pieza = porId.get(id)!;
    return { pieza, precio: pieza.precio.estimado, motivo };
  });

  if (lineas.length === 0) {
    avisos.push(
      `El presupuesto de ${presupuesto} ${catalogo.moneda} no llega para ninguna pieza de gama ` +
        `${peticion.gama} orientada a ${nombreObjetivos(objetivos)}.`,
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
  const objetivos = normalizarObjetivos(peticion.objetivos);
  if (objetivos.length === 0) return [];

  return piezasCompatibles(catalogo, peticion)
    .filter((p) => !yaElegidas.has(p.id) && peso(p, objetivos) > 0)
    .sort(
      (a, b) =>
        valor(b, objetivos) - valor(a, objetivos) ||
        valorPorEuro(b, objetivos) - valorPorEuro(a, objetivos) ||
        a.precio.estimado - b.precio.estimado ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 3)
    .map((pieza) => ({
      pieza,
      precio: pieza.precio.estimado,
      falta: Math.max(0, pieza.precio.estimado - restante),
    }));
}

export { NOMBRE_CATEGORIA, NOMBRE_OBJETIVO, normalizarObjetivos, nombreObjetivos };
