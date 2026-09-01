# JondaSiviz — Volkswagen Build Planner

Herramienta que planifica la preparación de un Volkswagen: entras modelo, presupuesto y
objetivo (`drift`, `drag`, `mas-cv`, `estetica`) y devuelve una lista de piezas que cabe
en el dinero, con desglose por categoría, total, sobrante y siguientes mejoras.

Web en `/` (landing) y `/herramienta.html` (el planner). Escritorio con Tauri.

Hay además una capa de servidor: SQLite con el catálogo y una API que lo sirve y recibe
los webhooks de GitHub. **`ARQUITECTURA.md` explica cómo levantarla y cómo comprobar cada
pieza.** La web tira de la API si está viva y del JSON empaquetado si no, porque la app
de escritorio va sin servidor.

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

## La bóveda de consulta (`boveda-vw/`)

Segunda bóveda de Obsidian, **independiente del planner**: 92 generaciones de Volkswagen
de los últimos veinte años con sus acabados, ediciones especiales, colores y piezas de
mercado. Se abre en Obsidian con "Abrir carpeta como bóveda".

- **`npm run vault:ingest` no la lee y los tests no la recorren.** Añadir un coche aquí
  no toca el catálogo del planner. Son cosas distintas y conviene que sigan siéndolo.
- Las notas **no se editan a mano**: se generan desde `boveda-vw/.generador/`. Se toca el
  dato y se relanza `node boveda-vw/.generador/build.mjs boveda-vw`.
- Reutiliza el catálogo de piezas del planner (`src/data/catalog.json`) en lugar de
  copiarlo, y lo cruza con los modelos por familia de motor.
- Hay un segundo exportador, `build-neo4j.mjs`, que vuelca lo mismo a un grafo de Neo4j.

Lee `boveda-vw/.generador/LEEME.md` antes de tocar nada de ahí. Importante: los precios
con enlace y la homologación por país están verificados uno a uno contra la tienda o la
ficha del producto. **No se rellenan a ojo**; lo que no está comprobado se queda vacío y
marcado como pendiente.

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

## Diseño de interfaz

El repo trae en `.claude/` un subagente y tres skills que se cargan solos al clonar, sin
instalar nada:

- **`app-designer`** — se invoca **siempre** que se pida crear, rediseñar o mejorar una
  pantalla, componente o interfaz. Aporta la guía de estilo y sobre ella se construye.
  No aplica a bugs, scripts o trabajo de motor.
- **`racing-atelier-style-guide`** — el sistema visual fijo (color, tipografía, iconos,
  espaciado, movimiento). Es lo que hace que todo se vea igual de una pantalla a otra.
  Base oscura y un solo acento, el rojo `#E3121C`, reservado para el estado activo, el
  peligro y los índices.
- **`design-research`** — busca los patrones de UX adecuados al tipo de aplicación antes
  de construir. No decide nada visual, solo estructura y flujos.
- **`humanized-writing`** — reglas para que ningún texto suene a IA.

Los tokens de color, radios y tipografía están en `src/index.css`. Se usan esos, no
valores sueltos: es lo único que mantiene cuadradas la portada y el planner, que son dos
páginas distintas.

La interfaz es solo oscura. Hubo un conmutador de tema claro/oscuro (`src/ui/theme.ts`) y
se quitó con el rediseño: un taller con dos modos pierde carácter, y mantener la paleta
clara del sistema entero costaba más de lo que aportaba.

## Comandos

```bash
npm install
npm run dev              # web en http://localhost:5173
npm run api              # API + base de datos en http://localhost:3001
npm run db:sembrar       # JSON -> SQLite   (--ver para mirar sin tocar)
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

`src-tauri/` empaqueta la app. **No hay una segunda versión de nada**: la ventana abre
el mismo `index.html` que sirve la web, y desde ahí se entra al mismo `herramienta.html`.
Hubo un `menu.html` propio del escritorio y se quitó: era una tercera pantalla que había
que mantener a mano y que se quedaba descolgada cada vez que alguien retocaba la portada.
Lo único que cambia dentro de la app lo resuelve `src/landing/descarga.ts`, que quita el
bloque de descarga y su enlace de la barra.

**Un binario solo enseña el código con el que se compiló.** Si la app no se parece a la
web, lo primero que hay que mirar es la fecha de la release frente a la del último
commit, antes de tocar una sola línea de CSS.

Los binarios los compila GitHub Actions (`.github/workflows/escritorio.yml`), una máquina
por sistema, porque el de macOS necesita el SDK de Apple. Se disparan al empujar una
etiqueta `v*`. Para compilar en local hace falta Rust y las Build Tools de Microsoft.

## Estructura

```
vault/          Fuente de verdad de los datos (notas de Obsidian con frontmatter).
src/db/         Esquema SQLite, siembra desde los JSON y consultas.
src/api/        API HTTP y webhook de GitHub. Usa el motor, no lo reimplementa.
boveda-vw/      Bóveda de consulta de modelos Volkswagen. No es el vault del planner.
src/engine/     Motor: tipos, catálogo, grafo modelo->motor->piezas, recomendación.
src/agents/     Clasificador de gama y selector de presupuesto (deterministas).
src/ui/         Interfaz React. Usa el motor, no lo toca.
src/export/     PDF con pdfmake (carga diferida).
src/ingest/     Parser vault <-> JSON.
src/cli/        CLI para probar el motor sin interfaz.
src-tauri/      Aplicación de escritorio.
```
