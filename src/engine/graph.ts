// Capa relacional: enlaza modelo de coche -> chasis -> motor -> piezas compatibles.
// De momento es una BD en memoria cargada de JSON. Más adelante puede pasar a SQLite
// sin cambiar esta interfaz.

import { cargarCatalogo } from "./catalog";
import modelosJson from "../data/models.json";
import type { Catalogo, CatalogoModelos, ModeloVW, Pieza } from "./types";

let cacheModelos: CatalogoModelos | null = null;

export function cargarModelos(): CatalogoModelos {
  if (!cacheModelos) cacheModelos = modelosJson as CatalogoModelos;
  return cacheModelos;
}

export function listarModelos(): ModeloVW[] {
  return cargarModelos().modelos;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos y diacríticos
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca un modelo por id, nombre o alias. Tolerante a mayúsculas y acentos. */
export function buscarModelo(texto: string, modelos: ModeloVW[] = listarModelos()): ModeloVW | null {
  const q = normalizar(texto);
  if (!q) return null;

  for (const m of modelos) {
    if (m.id === q || normalizar(m.nombre) === q || m.alias.some((a) => normalizar(a) === q)) {
      return m;
    }
  }
  // Coincidencia parcial como último recurso.
  const parcial = modelos.filter(
    (m) => normalizar(m.nombre).includes(q) || m.alias.some((a) => normalizar(a).includes(q)),
  );
  return parcial.length === 1 ? parcial[0] : null;
}

/**
 * Piezas del catálogo que encajan en un modelo. Ahora mismo se resuelve por la
 * plataforma de motor del modelo; deja hueco para excepciones por modelo concreto.
 */
export function piezasDeModelo(
  modelo: ModeloVW,
  catalogo: Catalogo = cargarCatalogo(),
): Pieza[] {
  return catalogo.piezas.filter((p) => p.plataformas.includes(modelo.motor));
}
