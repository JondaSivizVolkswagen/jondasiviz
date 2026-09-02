# JondaSiviz — Dossier completo del proyecto

Este documento recoge todo el contexto del proyecto para poder retomarlo desde cero
(por ejemplo, en una cuenta o sesión nueva de Claude Code) sin haber leído las
conversaciones anteriores. Última actualización: febrero 2026.

---

## 1. Qué es

Herramienta de escritorio/web que planifica la preparación de un coche **Volkswagen**.
El usuario introduce:

- un **modelo** VW (empezando por el Golf GTI Mk5),
- un **presupuesto** en euros,
- uno o varios **objetivos**: `drift`, `drag`, `mas-cv` (ganar caballos), `estetica`.

La herramienta devuelve un **presupuesto de piezas** recomendado que cabe en el
dinero disponible, con desglose por categoría, total, sobrante, avisos y las
siguientes mejoras si se amplía el presupuesto.

**La gama no es una entrada.** Se probó como filtro exacto (`gama alta` solo veía
piezas alta) y limitaba el resultado sin motivo: dejaba fuera la pieza sensata solo
por estar en otro cajón, y un presupuesto corto en gama alta devolvía casi nada. Ahora
el presupuesto es el único techo, el pool son todas las piezas compatibles con el
motor del coche, y la gama sale como **resultado**, ponderada por el dinero que se
lleva cada pieza. `floors.json` pasa de ser un filtro a ser la escala de presupuestos
que merece la pena probar para ver si subir el dinero cambia algo.

**Una sola gama y un solo mínimo.** Durante un tiempo convivieron dos de cada: la gama
que predecía `floors.json` y la que salía del build, el suelo de `floors.json` y el
mínimo calculado del catálogo. Se contradecían en pantalla (el formulario decía "gama
media" y el resultado "gama alta"). Ahora la verdad es siempre la que sale del motor:
`Presupuesto.gamaResultante` y `Presupuesto.minimoEsencial`.

Los precios son orientativos. Proyecto personal, sin relación con Volkswagen AG.

### Origen

Primero se pensó para BMW y se rehízo entero a Volkswagen. La landing y toda la
herramienta son de VW.

---

## 2. La landing de descarga

Página promocional de una sola página, publicada como Artifact de Claude:

- **URL del Artifact**: https://claude.ai/code/artifact/2e2a345f-9595-4950-95ff-8d320d9df984
- **Archivo fuente**: `...\scratchpad\vw-build-planner.html` (en el scratchpad de la
  sesión donde se creó; si se pierde, se puede regenerar con el subagente
  `app-designer` a partir de este dossier).
- Acento visual: **rojo GTI** (`#C0322E` claro, `#E0605A` oscuro) sobre base neutra.
- El botón de descarga está en **modo placeholder**: avisa de que la versión 0.1
  todavía no está lista. Se conectará cuando exista el binario (Fase 4).

La landing la construyó el subagente `app-designer`. La herramienta real es este
repositorio (`C:\Users\alexa\Desktop\JondaSiviz`).

---

## 3. Decisiones tomadas (y por qué)

| Decisión | Detalle |
|---|---|
| **PDF** | pdfmake, con `import()` dinámico. Maqueta tablas y saltos de página solo y lleva fuentes embebidas, así que los acentos salen bien. Pesa casi un mega, por eso no entra en el arranque. Se descartó imprimir con `window.print()` (obliga al diálogo de impresión y controla mal los saltos) y jsPDF (más ligero pero hay que maquetar a mano). |
| **Stack** | Vite + React 19 + TypeScript para la interfaz. Motor en TypeScript puro y aislado, sin dependencias de UI, reutilizable en web / escritorio / CLI. |
| **Gama** | No se pide. El presupuesto es el único techo y la gama del build se deduce del reparto del dinero. Antes era un filtro exacto sobre el catálogo, y limitaba el resultado sin aportar nada. |
| **Escritorio** | Tauri (binario pequeño, multiplataforma). Pendiente: **no hay Rust instalado** en la máquina; se instala en la Fase 4. Electron descartado por peso. |
| **Datos** | Catálogo curado. **Nada de scraping** (frágil, lento, problemas legales; además el "precios orientativos" ya es la postura honesta). |
| **Red relacional** | Se autoría a mano en un **vault de Obsidian** (`vault/`), y un parser la convierte a los JSON que consume el motor. |
| **Capa "neuronal"** | Más adelante: embeddings por modelo y por pieza (parecido de chasis/motor + texto) para inferir compatibilidad en modelos con pocos datos y detectar "piezas que suelen ir juntas". **No reemplaza a la BD**, la complementa. No se hace hasta tener varios modelos bien poblados. |
| **Subagentes** | El "clasificador de gama" y el "selector de presupuesto" son **módulos deterministas locales**, con interfaz lista para cambiar a un agente LLM sin tocar el resto. |
| **Online vs offline** | **Offline de momento** para ver la app tomar forma. La opción con API de LLM (agentes reales, más flexibles con datos sucios, pero rompe el "offline" y añade coste/latencia) se verá después. |

---

## 4. Arquitectura

```
vault/                 Red relacional autoría en Obsidian (fuente de verdad de los datos).
  _meta.md               Versión de catálogo/modelos y moneda.
  Modelos/*.md            Un modelo VW por nota (frontmatter: chasis, motor, tracción, años; enlaces [[...]]).
  Piezas/*.md             Una pieza por nota (categoría, gama, precio, pesos por objetivo, dependencias, grupo exclusivo).
  Plataformas/*.md        Nodos de contexto para el grafo de Obsidian.
  Marcas/*.md             Nodos de contexto para el grafo de Obsidian.

src/
  engine/              Lógica pura, sin UI.
    types.ts             Tipos del dominio.
    format.ts            euros(). Única implementación, la usan interfaz, PDF y CLI.
    catalog.ts           Carga + validación del catálogo (ids únicos, dependencias, ciclos, rangos).
    graph.ts             Capa relacional en memoria: buscarModelo (id/nombre/alias) y piezasDeModelo.
    recommend.ts         Motor de recomendación (selección con restricción de presupuesto).
    index.ts             Barrel.
  agents/              Subagentes (deterministas; misma interfaz que tendría un LLM).
    clasificador-gama.ts     Reparte las piezas de un modelo en baja / media / alta.
    selector-presupuesto.ts  Resuelve el modelo, delega en el motor y busca el siguiente escalón.
    index.ts
  ingest/
    obsidian.ts          Parser vault <-> JSON (las dos direcciones).
    run.ts               CLI de ingesta (export / ingest).
  data/               Generado desde el vault. NO editar a mano (salvo brands/floors).
    catalog.json         59 piezas. Generado por `npm run vault:ingest`.
    models.json          8 modelos VW. Generado por `npm run vault:ingest`.
    brands.json          Config a mano: niveles de marca y bandas de precio por categoría.
    floors.json          Config a mano: escala de presupuestos a probar por objetivo.
  export/             Salida a documento.
    pdf.ts               Documento del presupuesto con pdfmake, cargado con import() dinámico.
    iconos-pdf.ts        Iconos vectoriales por categoría, como cadenas SVG.
    pdfmake.d.ts         Tipos prestados para los bundles de pdfmake/build.
  ui/                 Interfaz React (usa el motor, no lo toca).
    format.ts            Reexporta euros() del motor.
    icons.tsx           Familia de iconos de línea.
    theme.ts            Hook useTema (sistema por defecto, elección en localStorage `jondasiviz-tema`, `data-theme` en <html>).
    opciones.ts         Gamas y las 4 tarjetas de objetivo con su frase.
    Formulario.tsx      Modelo en desplegable agrupado por motor, presupuesto (número libre + barra con suelo en el mínimo del proyecto), objetivos multi-selección, gama del build en vivo y aviso de peligro por debajo del mínimo.
    Elecciones.tsx      Selector plegable: por cada parte con varias alternativas, elige el comprador o el motor.
    Requisitos.tsx      Desglose en vivo: mínimo del proyecto y qué categorías entran y cuáles no. Se usa bajo los objetivos del formulario.
    Resultado.tsx       Cabecera con chip de gama resultante, barra de gasto, aviso de mínimo con botón "ver qué sale con X €", piezas por categoría (cada línea con su gama), invitación al siguiente escalón, siguientes mejoras.
    PiezasCompatibles.tsx  Panel plegable con pestañas baja/media/alta.
  App.tsx             Orquesta el estado y llama a crearSelector().seleccionar(...).
  App.css, index.css  Sistema visual (acento rojo GTI, tokens, tema claro/oscuro, grid 8pt, prefers-reduced-motion).
  cli/plan.ts         CLI para probar el motor sin interfaz.
tests/               Vitest. 80 tests.
```

### Flujo de datos

1. La red relacional se escribe en Obsidian, en `vault/`.
2. `npm run vault:ingest` lee el vault y regenera `src/data/catalog.json` y `models.json`.
3. El motor y los subagentes consumen esos JSON. La app que se distribuye lleva los
   JSON ya generados, no el vault.
4. `npm run vault:export` hace el camino inverso (JSON -> vault) para arrancar o
   re-sembrar el vault. La ida y vuelta está cubierta por tests (`tests/ingest.test.ts`).
5. `brands.json` y `floors.json` NO salen del vault: son configuración a mano.

---

## 5. El motor de recomendación (`src/engine/recommend.ts`)

Función principal: `generarPresupuesto(peticion, catalogo?) -> Presupuesto`.

`peticion`: `{ plataforma, presupuesto, objetivos: Objetivo[], modelo? }`.

Pasos:

1. Normaliza los objetivos (orden canónico `drift, drag, mas-cv, estetica`, sin repetir).
   Si no hay objetivos, o presupuesto <= 0, devuelve vacío con aviso.
2. `pool` = piezas del catálogo compatibles con la plataforma. Sin filtro de gama.
3. **Puntuación** de cada pieza:
   - `peso(pieza)` = suma de `pieza.objetivos[o]` para los objetivos elegidos (0..5 cada uno).
   - `valor(pieza)` = `peso × pieza.impacto`.
   - `valorPorEuro(pieza)` = `valor / precio.estimado`.
4. **Paso de esenciales**: para cada categoría esencial (unión de las de cada objetivo,
   en orden), coge la mejor pieza de esa categoría por `valor` (aporte técnico), luego
   `valorPorEuro`, luego precio, luego id. Resuelve sus dependencias. La añade si cabe
   en el presupuesto. Una pieza por categoría esencial.
5. **Paso de relleno**: recorre el resto de piezas por `valorPorEuro` y añade las que
   quepan, con sus dependencias. Si la pieza pertenece a un grupo exclusivo, sube a la
   de más `valor` del grupo que quepa (`mejorDelGrupo`): el relleno va por aporte por
   euro y sin esto se quedaba con la más barata del grupo, bloqueando a la buena para
   siempre aunque sobrase dinero (unos Raceland de 330 € en un build de 25.000 €).
6. **Grupo exclusivo**: piezas con el mismo `grupoExclusivo` cumplen la misma función y
   no se montan juntas (dos intercoolers, coilovers + air ride, remap + standalone,
   un solo turbo / downpipe / embrague / diferencial / juego de llantas, filtro vs
   admisión completa). Si una dependencia comparte grupo con algo ya elegido, se da
   por cubierta y el motor usa la pieza superior en vez de duplicar.
7. Devuelve: líneas agrupadas por categoría, total, sobrante, `gamaResultante`, avisos
   (categorías prioritarias que no han entrado) y hasta 3 mejoras siguientes con
   "faltan X €". Las mejoras descartan lo que choque de `grupoExclusivo` con algo ya
   montado, y no repiten grupo entre ellas: sería la misma mejora contada dos veces.
8. Y `esenciales` + `minimoEsencial` (`minimosEsenciales`): recorre las categorías
   prioritarias cogiendo la **más barata** de cada una con sus dependencias, sin límite
   de dinero, y marca cuáles cubre el presupuesto real. Lo compartido se cuenta una vez
   (si el turbo ya trae downpipe, cubrir escape sale a 0). La mecánica de selección
   (`crearSeleccion`) está factorizada y la usan los dos cálculos.

`fraseMinimo(presupuesto)` vive en `recommend.ts`, con los demás textos de
presentación, para que el formulario y el PDF cuenten lo mismo. Cubre el caso que
despista: puedes tener de sobra para el mínimo y aun así ver categorías fuera, porque
el motor concentra el dinero en lo que más pesa en vez de repartirlo en la opción más
barata de cada cosa.

`gamaResultante` (`gamaDeLineas`) es la media de `{ baja: 0, media: 1, alta: 2 }`
**ponderada por el precio** de cada línea, con cortes en 2/3 y 4/3. Se pondera por
dinero y no por número de piezas: unos coilovers de 2.400 € con cuatro detalles de
50 € es un build de gama alta, no una mezcla sin nombre.

El motor es **determinista**: misma entrada, mismo resultado. Todos los desempates
terminan en `id.localeCompare`.

### Categorías esenciales por objetivo

```
drift:   suspension, direccion, transmision, ruedas, frenos, seguridad
drag:    turbo, gestion, transmision, admision, escape, frenos, ruedas
mas-cv:  gestion, admision, escape, turbo
estetica: estetica, ruedas, suspension
```

Con varios objetivos se combinan sin repetir.

---

## 6. Los subagentes (`src/agents/`)

### Clasificador de gama (`clasificador-gama.ts`)

`crearClasificadorReglas(cfg?) -> { clasificar(pieza), agrupar(piezas) }`.

- `clasificar(pieza)`: devuelve `{ gama, confianza, motivo }`.
  1. Si la pieza declara `gama` y concuerda con precio y marca -> esa gama, confianza alta.
  2. Si declara `gama` pero choca con el precio -> se respeta con menos confianza y nota.
  3. Sin `gama` declarada: infiere por marca (`brands.json` -> `marcas`) y banda de
     precio de la categoría (`brands.json` -> `bandasPrecio`). Si marca y precio
     coinciden, confianza alta; si no, gana el precio.
- `agrupar(piezas)`: devuelve `{ baja: Pieza[], media: Pieza[], alta: Pieza[] }`.

### Selector de presupuesto (`selector-presupuesto.ts`)

`crearSelector(catalogo?, suelosCfg?, modelos?) -> { seleccionar(entrada) }`.

`entrada`: `{ modelo: string, presupuesto, objetivos: Objetivo[] }`.

- Resuelve el modelo con `buscarModelo` (id, nombre o alias; tolerante a acentos y
  mayúsculas). Si no lo reconoce: `modelo: null` + aviso con la lista de modelos.
- `umbralGama(objetivos, gama)` (pura, exportada) = **suma** de `floors.json` ->
  `suelos[o][gama]`. Pedir varias cosas a la vez sube el listón. Es lo único que queda
  de `floors.json`: una escala de presupuestos que probar, no una predicción.
- `siguienteEscalon`: recorre esa escala por encima del presupuesto actual, pasa cada
  candidato por el motor y devuelve el primero que de verdad da un build de gama más
  alta, con la gama **comprobada**. `null` si ninguno la sube. Alimenta el botón "ver
  qué sale con X €". Antes salía de `floors.json` sin mirar el build y llegaba a
  prometer una gama que la lista de piezas ya tenía.
- `minimo` = `Presupuesto.minimoEsencial`, calculado por el motor sobre el catálogo.
  Es el único mínimo del proyecto; ya no hay un suelo a mano compitiendo con él.
- `cumpleMinimo` = presupuesto >= minimo. Si no llega: se marca, **pero devuelve
  igualmente lo que entra**. Antes en ese caso la lista salía casi vacía.
- Devuelve `{ modelo, presupuesto, minimo, cumpleMinimo, siguienteEscalon, avisos }`.
  Los avisos son los del motor tal cual: el selector ya no antepone ninguno, así que
  la interfaz no depende de qué índice ocupa cada uno.

---

## 7. Datos

### Modelos (`src/data/models.json`, 187)

Veinte años del grupo Volkswagen, de 2006 a 2026: Volkswagen, SEAT, Cupra, Škoda y Audi.
El mapa completo, con el porqué de cada plataforma, está en
`INVESTIGACION_GRUPO_VW_20_ANIOS.md`.

Cada modelo enlaza con **dos** cosas, y esa es la clave de que 187 coches no necesiten
187 catálogos:

- una **plataforma de motor** (26), que conecta con admisión, escape, turbo y gestión;
- un **chasis** (16), que conecta con suspensión, frenos, dirección, ruedas, seguridad y
  estética.

Un Golf 8 GTI, un Cupra León, un Octavia RS y un Audi S3 8Y son el mismo `EA888-evo4`
sobre el mismo `MQB Evo`: comparten casi todo el catálogo. Por eso los modelos crecieron
×7 y las piezas solo ×2,5.

### Catálogo (`src/data/catalog.json`, 243 piezas, v0.2.0)

Cada pieza:

```json
{
  "id": "susp-coil-media",
  "nombre": "Coilovers roscados (KW V1 / ST X / BC Racing BR)",
  "categoria": "suspension",
  "plataformas": ["1.8T-20v", "EA113", "EA888", "VR6", "TDI"],
  "gama": "media",
  "precio": { "min": 700, "estimado": 950, "max": 1250 },
  "objetivos": { "drift": 4, "drag": 3, "mas-cv": 0, "estetica": 4 },
  "impacto": 4,
  "requiere": [],
  "grupoExclusivo": "altura",
  "stage": "stage2",   // opcional
  "nota": "..."         // opcional
}
```

Categorías: `admision`, `escape`, `turbo`, `gestion`, `suspension`, `transmision`,
`frenos`, `direccion`, `seguridad`, `ruedas`, `estetica`.

Cadenas de dependencia destacadas:
- **Turbo híbrido K04-064** (`turbo-k04-alta`) arrastra FMIC + admisión + downpipe +
  HPFP + calibración Stage 2+.
- **Big turbo** (`turbo-bigturbo-alta`) arrastra FMIC Stage 3 + turbo-back +
  alimentación Stage 3 + gestión standalone.

Grupos exclusivos definidos: `intercooler`, `admision-filtro`, `remap`,
`turbo-principal`, `altura`, `downpipe`, `embrague`, `diferencial`,
`frenos-delanteros`, `llantas`.

### `brands.json`

`marcas`: marca (en minúsculas, se busca dentro del nombre de la pieza) -> nivel
`baja` | `media` | `alta`. Ej. `raceland`/`fk` = baja, `bc racing`/`kw v1` = media,
`kw clubsport`/`ohlins`/`bbs` = alta.

`bandasPrecio`: por categoría, `{ baja: <=X, media: <=Y }`. Precio <= baja -> baja;
<= media -> media; si no -> alta.

### `floors.json` (escala de presupuestos a probar, por objetivo)

```
drift:    baja 1200, media 3000, alta 8000
drag:     baja 1500, media 3500, alta 12000
mas-cv:   baja 500,  media 1500, alta 5000
estetica: baja 400,  media 1500, alta 5000
```

El umbral de una combinación de objetivos es la suma de estos valores. No deciden nada
del resultado: son los presupuestos que `siguienteEscalon` prueba contra el motor para
ver si poner más dinero sube de gama. El mínimo del proyecto sale del catálogo
(`minimoEsencial`), no de aquí.

---

## 8. Fases

### Hechas (todas commiteadas; git local, sin remoto)

- **Fase 0** — Esqueleto: Vite + React + TS, Vitest, tsx, build.
- **Fase 1** — Motor de recomendación + catálogo semilla + tests + CLI.
- **Fase 1.5** — Capa relacional por modelo en Obsidian + parser de ingesta +
  clasificador de gama + selector con suelo de gasto.
- **(a)** — Catálogo real y profundo del Mk5 / EA113 (v0.2.0, 59 piezas, marcas y
  precios reales, cadenas K04 y big turbo).
- **(b)** — Fase 2, interfaz React en `src/ui/` (formulario + resultado + panel de
  piezas compatibles), estilo de la landing.
- **(c)** — Exclusión mutua por `grupoExclusivo`; el paso de esenciales prioriza
  aporte técnico sobre precio; `floors` drag/media bajado a 3500.
- **Objetivos múltiples** — el objetivo pasa de "elige uno" a "elige los que quieras";
  los pesos se suman, las categorías esenciales se unen, y el suelo de gasto es la
  suma de los suelos de cada objetivo, recalculado en vivo en el formulario.
- **(e) Desglose en vivo y PDF** — bajo los objetivos del formulario aparece, sin
  pulsar nada, cuánto cuesta cubrir lo esencial del proyecto y qué categorías entran y
  cuáles no. Sale de `minimosEsenciales` en el motor, y el formulario recalcula el plan
  entero en cada cambio (59 piezas, milisegundos). Botón "Descargar en PDF" en el
  resultado: documento A4 con pdfmake cargado por `import()` dinámico, cabecera con
  marca, barra de gasto, el desglose de mínimos, las piezas por categoría con su gama e
  iconos vectoriales, mejoras siguientes y pie con el aviso de precios orientativos.
  Se añade `Pieza.imagen` (opcional) al tipo, al parser y a todas las notas del vault:
  hoy está a null en las 59, y el PDF incrusta las fotos en cuanto haya rutas. 59 tests.
- **(d) La gama deja de ser entrada** — se quita el filtro exacto por gama y el control
  del formulario. El presupuesto es el único techo y la gama sale como resultado
  (`gamaResultante`). `floors.json` pasa de filtro a escala (`umbralGama`,
  `gamaEsperada`, `siguienteEscalon`). Se añade `mejorDelGrupo` en el relleno para que
  sobrar dinero no acabe en la pieza barata del grupo, y se cierra el pendiente 7:
  las mejoras ya no chocan de grupo ni con lo montado ni entre ellas. Datos: se agrupan
  las dos jaulas en `jaula`, y el set de llantas sacrificables entra en `llantas` con
  peso 0 de estética (se colaba en builds de estética por no tener grupo). 52 tests.

- **(e) Coherencia: una gama, un mínimo, avisos que no se contradicen** — cuatro
  arreglos sobre lo anterior:
  1. El motor avisaba de "no entra nada de escape" con el downpipe en la lista. Los
     huecos se miraban en el paso de esenciales, que no ve lo que tapan las
     dependencias ni el relleno; ahora salen de la selección final, así que un aviso
     no puede contradecir a `esenciales[].cubierta`. El paso de esenciales además
     salta una categoría ya cubierta en vez de comprarle una segunda pieza.
  2. Se elimina `gamaEsperada`: la gama del build es solo `gamaResultante`. El
     formulario y el resultado decían gamas distintas a la vez.
  3. `siguienteEscalon` pasa a comprobarse contra el motor en vez de leerse de
     `floors.json`. Antes prometía subir a una gama que el build ya tenía.
  4. Se elimina `sueloDe`: el mínimo del proyecto es solo `minimoEsencial`. El
     formulario mostraba 1500 € (floors) y el desglose de debajo 1825 € (catálogo).

  De paso: `Resultado` ya no depende de que el aviso de mínimo sea `avisos[0]` (ese
  índice se rompía sin objetivos), se quita el copy que aún pedía "baja la gama", y la
  CLI y el PDF normalizan el orden de objetivos como el motor. 80 tests.

- **(f) El mínimo como suelo real de la barra** — encargo: que la barra de presupuesto
  no deje bajar del mínimo, avisando de que por debajo puede ser fatal. Para que ese
  suelo no fuese decorativo hubo que arreglar antes el motor:
  1. **Reserva en el paso de esenciales**: antes de gastar en una categoría se reserva
     lo que cuesta cubrir por lo mínimo las que vienen detrás. Cierra el pendiente de
     starvation: drag con 4.000 € dejaba fuera transmisión, frenos y ruedas, y ahora
     con el mínimo justo (1.825 €) entran todas. Hay un test que lo comprueba con los
     8 modelos × 6 combinaciones de objetivos, así que un coche nuevo del vault entra
     solo en la garantía.
  2. **`frenos` pasa a ser esencial de `mas-cv`**. No lo era: un build de ganar
     caballos montaba el K04 y dejaba el freno de serie sin decir nada. El mínimo de
     `mas-cv` sube de 995 € a 1.175 €.
  3. **`fraseRiesgo(presupuesto)`** en el motor: distingue "el proyecto está a medias"
     de "el coche es peligroso". Solo llama peligro a `frenos`, `ruedas`, `direccion` y
     `seguridad`, solo si hay un objetivo de marcha (`drift`/`drag`/`mas-cv`) en juego,
     y solo si el catálogo puede servir esa categoría para ese motor (si no, es un
     hueco de datos, no algo que el usuario arregle con dinero). Lo usan formulario,
     resultado, PDF y CLI, así que los cuatro dicen la misma frase.
  4. **UI**: el `min` de la barra es `minimoEsencial`. Se puede escribir a mano una
     cifra menor, y entonces sale el aviso con un botón "subir a X €". No se bloquea el
     cálculo: sigue devolviendo lo que entra, que era una decisión ya tomada. 80 tests.
  5. **Datos**: las cuatro piezas de freno tenían peso `mas-cv` 0 salvo unas pastillas
     con 1, así que un build de caballos no podía llegar a un freno serio ni con dinero.
     Ahora pastillas y traseros van a 2, discos delanteros a 3 y big brake a 3, en la
     misma escala del resto (5 remaps, 4 turbo y downpipe, 3 intercooler y alimentación,
     1 embrague y diferencial). El freno escala con el presupuesto: pastillas de 180 €
     en el mínimo, discos de 400 € sobre 2.500 €, big brake de 1.350 € a partir de
     4.000 €. El mínimo de `mas-cv` no se mueve (1.175 €), porque el cálculo del mínimo
     coge la opción más barata de cada categoría.
  6. **Datos**: `fren-pastillas-baja` entra en el grupo `frenos-delanteros`, donde ya
     estaban el big brake y los discos de dos piezas. Le faltaba la etiqueta, así que
     con presupuesto amplio salía el kit big brake **y además** las pastillas y los
     latiguillos que ese kit ya incluye: 180 € pagados dos veces. Pasaba en drift y
     drag desde antes, y salió a la luz al darle peso a los frenos en `mas-cv`. Los
     traseros siguen sin grupo, que son del otro eje y sí suman. Test nuevo que barre
     objetivos y presupuestos comprobando que ningún grupo exclusivo sale repetido en
     una misma lista. 80 tests.

- **(g) Elige el comprador, elige el motor** — tres encargos del usuario:
  1. **Drift y drag dejan de combinarse.** Piden preparaciones contrarias. La regla vive
     en el motor (`INCOMPATIBLES`, `enConflictoCon`, `conflictosEn`, `alternarObjetivo`),
     la comparten web y CLI. Al marcar uno se suelta el otro; `mas-cv` y `estetica` se
     suman con cualquiera. La tarjeta que va a soltar a otra se marca antes de pulsar.
     Test que recorre todas las secuencias de hasta 4 clics: no hay camino que los junte.
  2. **El modelo pasa a `<select>`** agrupado por plataforma de motor, pensando en que la
     lista va a crecer. Los `optgroup` salen del campo `motor`, sin configurar nada. Se
     va el "no reconozco ese modelo" y sus chips, que ya no pueden pasar. El estado deja
     de ser texto libre (`modeloTexto`) y pasa a ser el id (`modeloId`).
  3. **Selector de piezas concretas.** `PeticionPresupuesto.elecciones` (ids) y un paso 0
     en el motor que las mete antes que nada, con `motivo: "elegida"`. `gruposElegibles`
     saca del catálogo las partes con dos o más alternativas compatibles; el eje son los
     `grupoExclusivo`, así que unos parachoques nuevos en el vault aparecen solos.
     `minimosEsenciales` acepta las elecciones, así que el suelo de la barra sube al
     pedir una pieza cara. El selector filtra lo que no aplica al coche actual sin
     borrarlo. UI en `src/ui/Elecciones.tsx`, plegable bajo los objetivos.

  Datos: los dos kits de carrocería (`est-widebody-alta`, `est-bodykit-media`) entran en
  el grupo `carroceria`; les faltaba y el motor los montaba los dos a la vez. 80 tests.

- **(h) La barra va del mínimo al techo útil** — la barra iba de 500 a 30.000 fijos y la
  casilla del número rechazaba cifras fuera del `step` con el mensaje del navegador
  ("los dos valores válidos más cercanos son 9000 y 9100"). Ahora:
  1. `noValidate` en el formulario: se puede escribir la cifra exacta que uno tenga. El
     `step` de 100 se queda solo para las flechas del teclado.
  2. Nuevo `techoUtil(catalogo, plataforma, objetivos, elecciones)` en el motor: pasa el
     motor con un tope que no puede limitar y devuelve lo gastado. Es un punto fijo
     (con ese dinero exacto salen las mismas decisiones que sin límite) y está ajustado
     (con 100 € menos ya cambia la lista). Test en 8 modelos × 6 objetivos.
  3. La barra va de `minimoEsencial` a `techoUtil`, ambos redondeados al centenar hacia
     arriba, porque un `range` cuenta sus pasos desde su propio `min` y con un mínimo de
     1.825 € las posiciones eran 1.825, 1.925... Mk5 drag: 1.900-21.700 en saltos de 100.
  4. Aviso gris con botón "ajustar" al escribir por encima del techo, simétrico al de
     peligro por debajo del mínimo. 80 tests.

### Rediseño visual (agosto 2026)

Cambio completo de piel, sin tocar el motor. El sistema pasa de una base clara tipo Apple
a uno oscuro, industrial: trama de carbono, hairlines en vez de sombras, radio de 2 px,
Archivo para titulares y JetBrains Mono para toda cifra o etiqueta técnica, y un solo
acento rojo (`#E3121C`) reservado al estado activo, al peligro y a los índices.

Decisiones que conviene no deshacer sin motivo:

1. **Se quitó el tema claro** (`src/ui/theme.ts` borrado). Mantener dos paletas del sistema
   entero costaba más de lo que aportaba, y un taller con dos modos pierde carácter.
2. **La escena 3D vive en `src/landing/`, no en `src/ui/`.** La portada es HTML plano sin
   React por diseño; meter el visor en el bundle de la app habría obligado a cargar React y
   `three` a quien solo mira la portada.
3. **El Civic está modelado a mano, no descargado.** Un `.glb` decente son varios megas y
   una licencia que vigilar. La carrocería es un casco lofteado por secciones (ver el
   README): la forma vive en cuatro tablas de curvas y el reparto chapa/cristal/bajos es
   una regla geométrica, no una lista de piezas. Se puede cambiar la forma del coche
   editando números, que es justo lo que no permitiría un modelo importado.

   Se probó antes con un perfil lateral extruido y se descartó: daba un coche de costados
   planos, sin caída de techo y con los pasos de rueda como arcos pintados.
4. **El mapa de entorno es un canvas pintado a mano** pasado por `PMREMGenerator`. Es lo
   que hace que la chapa refleje. Sin él, con solo luces, el metal se ve mate.
5. **Los ángulos de las vistas fijas están calculados contra `AZIMUT = 0.55`.** Si se mueve
   la cámara hay que recalcular los tres giros de `VISTAS` o las vistas se descuadran.
6. **El icono de escritorio se genera, no se dibuja.** `herramientas/generar-iconos.py`
   escribe los quince PNG, el `.ico` y el `.icns` a partir de la misma marca que lleva la
   barra superior de la web, dibujada a 4x y reducida con Lanczos. Editar el icono es
   editar ese script y volver a ejecutarlo, no abrir quince archivos.
7. **La CSP de Tauri tuvo que abrirse a Google Fonts.** Con la anterior, el navegador
   embebido bloqueaba las tipografías y la app de escritorio caía a las del sistema. Lo
   correcto a medio plazo es servirlas desde `public/` y volver a cerrar la CSP.
8. La guía de estilo de `.claude/` se reescribió (`racing-atelier-style-guide`) y la
   anterior se borró. Si se hubiera dejado, la siguiente pantalla que se le pidiese a Claude
   Code habría vuelto al estilo claro.

- **(i) a (p): sustitución dentro del grupo y el grupo VW entero** — el motor deja de
  bloquear un grupo exclusivo para siempre: si una pieza aporta más que la que lo ocupa,
  la sustituye y recupera su dinero, aunque la saliente hubiera entrado como dependencia.
  El turbo-back releva al downpipe que exige el K04. Lo que no cabe se ofrece como cambio,
  con `sustituye` y el `falta` ya descontado el reembolso.

  Con eso resuelto, los datos pasan de 26 a **187 modelos** y de 98 a **243 piezas**:
  Volkswagen, SEAT, Cupra, Škoda y Audi de 2006 a 2026, en siete fases. Chasis de 7 a 16,
  plataformas de motor de 13 a 26, `EA888` partido en gen2 y gen3, `Traccion` con
  `trasera` (el ID.3 y el Born son de propulsión trasera), `Propulsion` con `mhev` y ocho
  valores nuevos de `Equipamiento` para poder decirle a un RS6 que sus cerámicos ya son
  mejores que el big brake que se le iba a ofrecer.

  Tres arreglos de motor que salieron por el camino:

  - El catálogo exigía plataforma de motor a **toda** pieza, imposible de cumplir para
    unos coilovers, que no miran si el coche es TSI o TDI. Ahora vale motor o chasis.
  - `generarPresupuesto` armaba el pool solo por motor, así que las piezas que van por
    chasis no llegaban a ningún presupuesto: un Golf 8 pedía drift y salía sin dirección.
  - La reserva del paso de esenciales apartaba dinero para categorías que la propia pieza
    elegida dejaba sin opciones, y con el techo justo salía un plan distinto al de dinero
    infinito. Se calcula por candidata y mirando qué grupos bloquea.

  106 tests, typecheck, lint y build en verde.

- **(q) Botón de generar y tope diario de verdad** — el plan se calculaba en vivo con
  cada cambio, así que no existía ningún momento al que llamar "se ha generado un
  presupuesto" y `planesPorDia` era código muerto: el servidor sabía contar y nadie le
  pedía nada. Ahora la columna del plan no enseña nada hasta pulsar **Generar
  presupuesto**, y el desglose en vivo que había bajo los objetivos se va con ella (si se
  queda, el botón no sirve de nada).

  El motor sigue corriendo con cada cambio, pero solo para los controles: el recorrido de
  la barra (del mínimo al techo útil) y las partes que se pueden fijar a mano. Un control
  que no sabe dibujarse hasta que pulsas un botón es un fallo, no una funcionalidad.

  Al pulsar, quien cuenta es el servidor: `POST /api/plan` comprueba los límites, apunta
  el presupuesto en `uso_diario` y contesta 402 con su motivo, que abre la suscripción.
  Sin API, o sin sesión (que es cuando el servidor no tiene a quién apuntárselo), cuenta
  el navegador en `localStorage` con el mismo tope y la misma frase, sacada de
  `puedePedirPlan`, y con el mismo corte de día en horario universal (`diaDeUso`, ahora
  compartido). Eso se salta borrando los datos del navegador y se sabe: frena el uso
  normal, el que no se salta nadie es el del servidor.

  Lo generado no se borra al tocar nada, se queda marcado como de la configuración
  anterior, que era el motivo original de calcular en vivo. Y `/api/plan` acepta
  `soloComprobar`: la descarga del PDF pasa por ahí para comprobar el límite y se estaba
  comiendo uno de los cinco presupuestos del día por mirar.

  El contador del perfil ("Hoy llevas X de 5 presupuestos") se movía solo al recargar,
  porque `planesHoy` se pedía una vez al arrancar con `/api/auth/yo` y se quedaba ahí. Y
  sin sesión enseñaba cero mientras el que contaba era `localStorage`. Ahora `/api/plan`
  devuelve el `planesHoy` ya apuntado (null cuando no hay sesión, que es cuando no ha
  apuntado nada), `apuntarGeneracion` lo pasa hacia arriba junto con quién lo cuenta, y
  el contexto lo fija sin pedir la cuenta otra vez. Con la suscripción no se habla de
  números, y los límites que llegan del servidor con -1 y null (JSON no sabe escribir
  Infinity) se deshacen al entrar: si no, a un suscriptor con la API caída el contador de
  aquí le habría dicho que ya llegó a su tope.

  Por el camino salió un fallo viejo de la ruta: `/api/plan` no le pasaba el chasis al
  motor ni le filtraba el catálogo por el coche, así que armaba el pool solo por
  plataforma. Un Arteon pidiendo drift con 2.500 € salía de la API con un catch can y
  unos palieres, y del motor del navegador sale con geometría, frenos, dirección, ruedas
  y seguridad. Es el mismo fallo que se arregló dentro de `generarPresupuesto` en la
  tanda anterior y que esta ruta seguía teniendo por su cuenta. El test que compara la
  API con el motor pasa a hacerlo con un modelo MQB, que es donde se nota.

  174 tests, typecheck, lint y build en verde.

### Pendientes

1. **Fase 3b** — Guardar builds (localStorage o archivo) y exportar a CSV. El PDF ya
   está hecho.
2. **Fase 4** — Empaquetar el escritorio con Tauri, build web, y conectar el botón de
   descarga de la landing.
3. **Capa de embeddings** (la parte "neuronal") sobre los datos ya poblados. Ahora tiene
   sustrato de verdad: 187 modelos y 243 piezas con su matriz de compatibilidad.
4. **Opción con API de LLM** para los subagentes, cuando se decida salir del modo
   100% offline.
5. Afinar la matriz `floors.json` y los pesos por objetivo con uso real. Se calibró con
   un Mk5 de 2005 y se queda corta para los V8 de Audi, donde un Stage 1 son 1.800 €.
6. **Catálogo corto en las plataformas nuevas**: MLB, MLB Evo, PL71, PPE y J1 tienen
   entre cinco y siete piezas de chasis cada una. Es honesto para PPE y J1, donde el
   mercado casi no existe, pero MLB y MLB Evo suman 34 coches y merecen más.
7. **Decisiones abiertas** de `INVESTIGACION_GRUPO_VW_20_ANIOS.md`: el Audi R8, el SEAT
   Exeo y el Q8 e-tron se dejaron fuera, y el Golf VI R y el Scirocco R se asignaron a
   `EA113` a falta de confirmación de taller.

---

## 9. Comandos

```bash
npm install
npm test                 # 80 tests (Vitest)
npm run typecheck        # tsc -b --noEmit
npm run build            # type-check + build de producción

npm run dev              # arranca la interfaz en http://localhost:5173

npm run plan -- --listar-modelos
npm run plan -- --modelo "Golf GTI Mk5" --presupuesto 4000 --objetivo drag
npm run plan -- --modelo mk5 --presupuesto 12000 --objetivo drift,estetica

npm run vault:ingest     # vault/ -> src/data/catalog.json + models.json
npm run vault:export     # src/data/*.json -> vault/
```

Valores: `objetivo` (CLI) = uno o varios separados por
coma, de `drift|drag|mas-cv|estetica`.

---

## 10. Estado de git

- Local: `C:\Users\alexa\Desktop\JondaSiviz`, rama `main`.
- Remoto: **https://github.com/JondaSivizVolkswagen/jondasiviz**, cuenta de GitHub
  `JondaSivizVolkswagen`.

**El repositorio es público, y conviene que siga siéndolo.** Hay tres cosas colgando de
eso: SignPath Foundation solo firma proyectos de código abierto, las Actions son
ilimitadas en repositorios públicos (en privado, una sola release se come unos cien
minutos de la cuota porque las de macOS se cobran a diez veces), y sobre todo el botón
de descarga de la portada, que no es un enlace fijo: `src/landing/descarga.ts` pregunta a
la API pública de GitHub cuál es la última release y qué binario le toca a cada sistema.
Esa llamada va sin identificar desde el navegador de quien visita la web, así que en
privado GitHub respondería 404 a todo el mundo y no hay arreglo cómodo, porque un token
metido en el JavaScript de la web se lo lleva quien abra el inspector.

Que sea público no expone nada: `.env` está en `.gitignore` desde el primer commit y
nunca ha entrado en el histórico. El código de acceso de la suscripción vive en
`JONDA_CODIGO_MAESTRO` precisamente porque cualquiera puede leer el fuente.

Ojo con no confundir dos cosas: el techo del plan gratuito se aplica hoy en el navegador,
así que se puede saltar tenga el repositorio la visibilidad que tenga. Eso se arregla
calculando el plan en el servidor, no escondiendo el código.

La lista de commits que había aquí se quedó desfasada a los pocos días y no se vuelve a
poner: el histórico ya lo cuenta mejor `git log --oneline`, y los mensajes de este
repositorio explican el porqué de cada cambio, no solo el qué.

Trabajo normal: `git add -A && git commit -m "..." && git push`.

Autenticación de GitHub en esta máquina: `gh` (GitHub CLI, instalado por winget en
`~\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_*\bin\gh.exe`) autenticado con
un token clásico de la cuenta `JondaSivizVolkswagen`. `gh auth setup-git` dejó
configurado el credential helper de git para `https://github.com`. Si en una máquina
nueva no hay auth: `gh auth login` (interactivo) o `gh auth login --with-token`.

---

## 11. Cómo retomar en una sesión o cuenta nueva de Claude Code

1. Abrir Claude Code en `C:\Users\alexa\Desktop\JondaSiviz`.
2. Pedirle que lea este `PROYECTO.md` y el `README.md`.
3. `npm install` y `npm test` para confirmar que todo pasa (80 tests).
4. `npm run dev` para ver la interfaz.
5. Continuar por la lista de **Pendientes** (sección 8).

Todo el estado del proyecto está en el repositorio: no depende de ninguna
conversación anterior ni de la cuenta.

---

## 12. Entorno de Claude Code del usuario (`C:\Users\alexa\.claude\`)

Esto es **local a la máquina**, no a la cuenta premium. Cambiar de cuenta no lo
borra ni lo modifica. Se documenta aquí como copia de seguridad portable.

### Archivos de configuración

- `~/.claude/CLAUDE.md` — instrucciones globales del usuario para todos los proyectos.
  Incluye la "Política de Inteligencia Adaptativa" (elige nivel de razonamiento solo),
  reglas generales (nunca `sudo npm install -g`; mantener catálogos al día;
  invocar `app-designer` para cualquier trabajo de UI/UX; elegir el modelo más
  óptimo entre Haiku/Sonnet/Opus/Fable; etc.), la rutina de cierre de sesión, y una
  sección "Por ruta/proyecto" con el bloque de contexto de JondaSiviz. Importa
  `@RTK.md` y `@SKILLS_AGENTES.md`.
- `~/.claude/SKILLS_AGENTES.md` — catálogo de todo lo personalizado (ver abajo). Se
  carga siempre.
- `~/.claude/RTK.md` — referencia de RTK.
- `~/.claude/settings.json` — hooks (RTK en `PreToolUse` sobre `Bash`; statusline de
  caveman), permisos y variables de entorno.

### Subagentes (`~/.claude/agents/`)

- **app-designer** (`~/.claude/agents/app-designer.md`) — diseñador de producto senior.
  Se invoca siempre que se pide crear, rediseñar o mejorar una app, pantalla,
  componente o interfaz. Carga las tres skills de diseño antes de construir.

### Skills (`~/.claude/skills/`)

- **racing-atelier-style-guide** — sistema de diseño visual fijo del proyecto (color,
  tipografía, iconos, espaciado, movimiento). Solo cambia el acento por proyecto.
- **design-research** — investiga en internet patrones de UX y arquitectura de
  información según el tipo de producto, antes de construir. No decide nada visual.
- **humanized-writing** — reglas para que ningún texto suene generado por IA (sin
  guiones largos, sin emojis, sin frases hechas).

### Plugins de Claude Code

- **caveman** (`caveman@caveman`, marketplace `JuliusBrussee/caveman`, en
  `~/.claude/plugins/marketplaces/caveman`) — comprime el estilo de respuesta para
  ahorrar tokens de salida. Modo por defecto `lite`, en `%APPDATA%\caveman\config.json`
  (en Windows es esa ruta, no `~/.config/caveman/`). Statusline en `settings.json`
  mostrando `[CAVEMAN:LITE]` con `caveman-statusline.ps1`. Cambiar nivel con
  `/caveman lite|full|ultra|wenyan|off`. Decir "modo normal" lo apaga en la sesión.

### Herramientas de sistema

- **RTK (Rust Token Killer)** — binario en `~/.local/bin/rtk.exe` (`rtk-ai/rtk`).
  Proxy que comprime la salida de comandos de shell antes de que llegue al modelo.
  Hook `PreToolUse` sobre `Bash` en `settings.json` (`rtk hook claude`). Comandos:
  `rtk gain`, `rtk gain --history`, `rtk discover`.

### Entorno base

- **Node.js 24** vía **nvm-windows** (`nvm use 24`).
- **Git** (incluye Git Bash).
- **winget** disponible en el sistema.

### Cómo restaurar todo esto en una máquina nueva

1. Instalar Node 24 (nvm-windows), Git, y tener winget.
2. Copiar la carpeta `C:\Users\<usuario>\.claude\` completa (agents, skills, plugins,
   CLAUDE.md, SKILLS_AGENTES.md, RTK.md, settings.json).
3. Copiar `%APPDATA%\caveman\config.json`.
4. Instalar el binario `rtk.exe` en `~/.local/bin/` (de `rtk-ai/rtk`).
5. Abrir Claude Code: cargará CLAUDE.md y SKILLS_AGENTES.md solo, con todo disponible.
