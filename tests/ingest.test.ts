import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { cargarCatalogo } from "../src/engine/catalog";
import { cargarModelos } from "../src/engine/graph";
import { escribirVault, parsearVault } from "../src/ingest/obsidian";

const dir = mkdtempSync(join(tmpdir(), "jondasiviz-vault-"));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("ida y vuelta vault <-> JSON", () => {
  const catalogo = cargarCatalogo();
  const modelos = cargarModelos();

  it("exportar y volver a leer el vault reconstruye los mismos datos", () => {
    escribirVault(dir, catalogo, modelos);
    const leido = parsearVault(dir);

    const ordenar = <T extends { id: string }>(xs: readonly T[]): T[] =>
      [...xs].sort((a, b) => a.id.localeCompare(b.id));

    expect(ordenar(leido.catalogo.piezas)).toEqual(ordenar(catalogo.piezas));
    expect(ordenar(leido.modelos.modelos)).toEqual(ordenar(modelos.modelos));
    expect(leido.catalogo.version).toBe(catalogo.version);
    expect(leido.catalogo.moneda).toBe(catalogo.moneda);
  });

  it("el vault reconstruido pasa la validación del catálogo", () => {
    escribirVault(dir, catalogo, modelos);
    expect(() => parsearVault(dir)).not.toThrow();
  });
});
