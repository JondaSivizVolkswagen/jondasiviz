// Subagente 1 (offline): reparte las piezas de un modelo en gama baja / media / alta.
//
// Implementación determinista por reglas. Respeta la misma interfaz que tendría un
// agente LLM, para poder cambiarlo más adelante sin tocar quien lo llama.

import brandsJson from "../data/brands.json";
import type { Categoria, ClasificacionGama, Gama, GruposPorGama, Pieza } from "../engine/types";

export interface ClasificadorGama {
  clasificar(pieza: Pieza): ClasificacionGama;
  agrupar(piezas: Pieza[]): GruposPorGama;
}

interface ConfigMarcas {
  marcas: Record<string, Gama>;
  bandasPrecio: Record<string, { baja: number; media: number }>;
}

const GAMAS: Gama[] = ["baja", "media", "alta"];

function gamaPorPrecio(
  categoria: Categoria,
  precio: number,
  bandas: ConfigMarcas["bandasPrecio"],
): Gama {
  const banda = bandas[categoria];
  if (!banda) return "media";
  if (precio <= banda.baja) return "baja";
  if (precio <= banda.media) return "media";
  return "alta";
}

function gamaPorMarca(nombre: string, marcas: ConfigMarcas["marcas"]): Gama | null {
  const texto = nombre.toLowerCase();
  for (const [marca, gama] of Object.entries(marcas)) {
    if (texto.includes(marca)) return gama;
  }
  return null;
}

export function crearClasificadorReglas(
  cfg: ConfigMarcas = brandsJson as ConfigMarcas,
): ClasificadorGama {
  const clasificar = (pieza: Pieza): ClasificacionGama => {
    const porMarca = gamaPorMarca(pieza.nombre, cfg.marcas);
    const porPrecio = gamaPorPrecio(pieza.categoria, pieza.precio.estimado, cfg.bandasPrecio);

    // 1. La gama declarada en el catálogo manda, pero si choca de lleno con el
    //    precio y la marca se deja constancia con menos confianza.
    if (pieza.gama && GAMAS.includes(pieza.gama)) {
      const coincidePrecio = pieza.gama === porPrecio;
      const coincideMarca = porMarca == null || pieza.gama === porMarca;
      if (coincidePrecio && coincideMarca) {
        return { gama: pieza.gama, confianza: 0.95, motivo: "declarada en el catálogo" };
      }
      return {
        gama: pieza.gama,
        confianza: 0.6,
        motivo: `declarada como ${pieza.gama}, aunque el precio sugiere ${porPrecio}`,
      };
    }

    // 2. Sin gama declarada: marca y precio de acuerdo -> alta confianza.
    if (porMarca && porMarca === porPrecio) {
      return { gama: porMarca, confianza: 0.85, motivo: `marca y precio apuntan a ${porMarca}` };
    }
    if (porMarca) {
      return { gama: porMarca, confianza: 0.6, motivo: `nivel habitual de la marca (${porMarca})` };
    }
    return { gama: porPrecio, confianza: 0.5, motivo: `banda de precio de ${pieza.categoria}` };
  };

  const agrupar = (piezas: Pieza[]): GruposPorGama => {
    const grupos: GruposPorGama = { baja: [], media: [], alta: [] };
    for (const pieza of piezas) grupos[clasificar(pieza).gama].push(pieza);
    for (const gama of GAMAS) {
      grupos[gama].sort(
        (a, b) => a.categoria.localeCompare(b.categoria) || a.precio.estimado - b.precio.estimado,
      );
    }
    return grupos;
  };

  return { clasificar, agrupar };
}
