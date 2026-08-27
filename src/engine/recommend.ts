// Motor de recomendación: a partir de plataforma, gama, presupuesto y objetivo
// arma una lista de piezas que cabe en el dinero disponible.

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

export function piezasCompatibles(
  catalogo: Catalogo,
  peticion: Pick<PeticionPresupuesto, "plataforma" | "gama">,
): Pieza[] {
  return catalogo.piezas.filter(
    (p) => p.plataformas.includes(peticion.plataforma) && p.gama === peticion.gama,
  );
}

function valor(pieza: Pieza, objetivo: Objetivo): number {
  return pieza.objetivos[objetivo] * pieza.impacto;
}

function valorPorEuro(pieza: Pieza, objetivo: Objetivo): number {
  return valor(pieza, objetivo) / pieza.precio.estimado;
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
  const { objetivo } = peticion;
  const presupuesto = Number.isFinite(peticion.presupuesto) ? peticion.presupuesto : 0;

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
  let gastado = 0;

  // Devuelve el paquete (dependencias primero, pieza al final) y su coste,
  // contando solo lo que aún no está elegido. null si falta alguna dependencia.
  const paqueteDe = (raiz: Pieza): { orden: string[]; coste: number } | null => {
    const orden: string[] = [];
    const vistos = new Set<string>();
    let coste = 0;
    let falta = false;

    const rec = (id: string): void => {
      if (elegidas.has(id) || vistos.has(id)) return;
      const p = porId.get(id);
      if (!p) {
        falta = true;
        return;
      }
      vistos.add(id);
      for (const dep of p.requiere) rec(dep);
      orden.push(id);
      coste += p.precio.estimado;
    };

    rec(raiz.id);
    return falta ? null : { orden, coste };
  };

  const añadirPaquete = (orden: string[], motivoFinal: MotivoLinea): void => {
    orden.forEach((id, i) => {
      if (elegidas.has(id)) return;
      elegidas.set(id, i === orden.length - 1 ? motivoFinal : "dependencia");
      gastado += porId.get(id)!.precio.estimado;
    });
  };

  const cabe = (coste: number): boolean => gastado + coste <= presupuesto;

  // Paso 1: cubrir una pieza de cada categoría esencial del objetivo.
  const categoriasSinCubrir: Categoria[] = [];
  for (const categoria of ESENCIALES[objetivo]) {
    const candidatas = pool
      .filter((p) => p.categoria === categoria && p.objetivos[objetivo] > 0 && !elegidas.has(p.id))
      .sort(
        (a, b) =>
          b.objetivos[objetivo] - a.objetivos[objetivo] ||
          valorPorEuro(b, objetivo) - valorPorEuro(a, objetivo) ||
          a.precio.estimado - b.precio.estimado ||
          a.id.localeCompare(b.id),
      );

    let cubierta = false;
    for (const pieza of candidatas) {
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
    .filter((p) => !elegidas.has(p.id) && p.objetivos[objetivo] > 0)
    .sort(
      (a, b) =>
        valorPorEuro(b, objetivo) - valorPorEuro(a, objetivo) ||
        b.objetivos[objetivo] - a.objetivos[objetivo] ||
        a.precio.estimado - b.precio.estimado ||
        a.id.localeCompare(b.id),
    );

  for (const pieza of relleno) {
    if (elegidas.has(pieza.id)) continue;
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
        `${peticion.gama} orientada a ${NOMBRE_OBJETIVO[objetivo]}.`,
    );
  } else {
    for (const categoria of categoriasSinCubrir.slice(0, 3)) {
      avisos.push(
        `Con este presupuesto no entra nada de ${NOMBRE_CATEGORIA[categoria]}, ` +
          `prioritario para un proyecto de ${NOMBRE_OBJETIVO[objetivo]}.`,
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
  const { objetivo } = peticion;

  return piezasCompatibles(catalogo, peticion)
    .filter((p) => !yaElegidas.has(p.id) && p.objetivos[objetivo] > 0)
    .sort(
      (a, b) =>
        valor(b, objetivo) - valor(a, objetivo) ||
        valorPorEuro(b, objetivo) - valorPorEuro(a, objetivo) ||
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

export { NOMBRE_CATEGORIA, NOMBRE_OBJETIVO };
