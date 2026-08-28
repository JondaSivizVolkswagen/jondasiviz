# JondaSiviz — Volkswagen Build Planner

Herramienta que planifica la preparación de un Volkswagen: entras modelo, presupuesto y
objetivo (`drift`, `drag`, `mas-cv`, `estetica`) y devuelve una lista de piezas que cabe
en el dinero, con desglose por categoría, total, sobrante y siguientes mejoras.

Web en `/` (landing) y `/herramienta.html` (el planner). Escritorio con Tauri.

**Antes de tocar nada de fondo, lee `PROYECTO.md`.** Es el dossier completo: decisiones
tomadas y por qué se descartó lo demás, arquitectura, cómo funciona el motor y qué queda
pendiente. Evita rehacer discusiones ya cerradas.

## Reglas que no se saltan

- **El catálogo no se edita a mano.** `src/data/catalog.json` y `models.json` son
  generados. La fuente de verdad es el vault de Obsidian en `vault/`. Se edita ahí y se
  lanza `npm run vault:ingest`. `brands.json` y `floors.json` sí son config a mano.
- **Las reglas de dominio viven en el motor**, no en la interfaz. Si la web, la CLI y el
  PDF tienen que decir lo mismo, la frase o la regla se escribe en `src/engine/` y se
  importa. Este proyecto ya arrastró bugs por tener dos fuentes de verdad (dos gamas y
  dos mínimos distintos en la misma pantalla); no se repite.
- **`src/engine/` es TypeScript puro.** Sin React, sin dependencias de UI. Se usa desde
  la web, la CLI y los tests.
- **Nada de scraping.** El catálogo es curado a mano y los precios son orientativos.
- **Nada de logos ni marcas de Volkswagen.** El proyecto declara no tener relación con
  Volkswagen AG y usar su identidad sería un problema legal.
- **El texto de la interfaz va en español de España** y tiene que sonar a persona: sin
  guiones largos, sin emojis, sin frases hechas de IA.

## Invariantes que protegen los tests

No los rompas sin entender qué garantizan. Están en `tests/agents.test.ts` y
`tests/recommend.test.ts`, y recorren **todos los modelos del catálogo**, así que un
coche nuevo en el vault entra solo en la comprobación.

- Con el **mínimo del proyecto** justo, entran todas las categorías esenciales.
- El **techo útil** es un punto fijo: con ese dinero sale lo mismo que con dinero
  infinito, y con 100 € menos ya cambia.
- Ningún aviso puede contradecir a `esenciales[].cubierta`.
- Nunca entran dos piezas del mismo `grupoExclusivo`.
- No hay ninguna secuencia de clics que deje `drift` y `drag` marcados a la vez.

## Comandos

```bash
npm install
npm run dev              # web en http://localhost:5173
npm test                 # Vitest
npm run typecheck        # tsc -b --noEmit
npm run lint             # oxlint
npm run build            # type-check + build de las dos páginas

npm run vault:ingest     # vault/ -> src/data/*.json   (tras editar el vault)
npm run vault:export     # src/data/*.json -> vault/

npm run plan -- --listar-modelos
npm run plan -- --modelo "Golf GTI Mk5" --presupuesto 4000 --objetivo drag
```

Antes de dar algo por terminado: `npm test`, `npm run typecheck` y `npm run lint` en
verde. La CLI (`npm run plan`) es la forma rápida de ver qué hace el motor sin abrir el
navegador.

## Escritorio

`src-tauri/` empaqueta la app. **No hay una segunda versión del planner**: la ventana
abre el mismo `herramienta.html` que sirve la web.

Los binarios los compila GitHub Actions (`.github/workflows/escritorio.yml`), una máquina
por sistema, porque el de macOS necesita el SDK de Apple. Se disparan al empujar una
etiqueta `v*`. Para compilar en local hace falta Rust y las Build Tools de Microsoft.

## Estructura

```
vault/          Fuente de verdad de los datos (notas de Obsidian con frontmatter).
src/engine/     Motor: tipos, catálogo, grafo modelo->motor->piezas, recomendación.
src/agents/     Clasificador de gama y selector de presupuesto (deterministas).
src/ui/         Interfaz React. Usa el motor, no lo toca.
src/export/     PDF con pdfmake (carga diferida).
src/ingest/     Parser vault <-> JSON.
src/cli/        CLI para probar el motor sin interfaz.
src-tauri/      Aplicación de escritorio.
```
