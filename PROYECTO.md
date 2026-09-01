# JondaSiviz — Dossier completo del proyecto

Este documento recoge todo el contexto del proyecto para poder retomarlo desde cero
(por ejemplo, en una cuenta o sesión nueva de Claude Code) sin haber leído las
conversaciones anteriores. Última actualización: agosto de 2026.

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
lleva cada pieza. `floors.json` pasa de ser un filtro a ser la escala que traduce
dinero a expectativa de gama.

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
repositorio (`C:\Users\Manuel\Desktop\proyecto\Herramienta\JondaSiviz\JondaSiviz`).

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
  Plataformas/*.md        Nodo por plataforma de motor. Generado.
  Chasis/*.md             Nodo por plataforma de chasis. Generado.
  Categorias/*.md         Nodo por categoría de pieza. Generado.
  Grupos/*.md             Nodo por grupo exclusivo. Generado.
  Marcas/*.md             Nodo por marca con al menos una pieza. Generado.

Las cinco carpetas de nodos generados no aportan datos al motor: son las que
convierten el vault en una red navegable. Las escribe `escribirVault`, así que
`npm run vault:export` las regenera y no se pueden quedar desincronizadas.

src/
  engine/              Lógica pura, sin UI.
    types.ts             Tipos del dominio.
    format.ts            euros(). Única implementación, la usan interfaz, PDF y CLI.
    catalog.ts           Carga + validación del catálogo (ids únicos, dependencias, ciclos, rangos).
    graph.ts             Capa relacional en memoria: buscarModelo (id/nombre/alias) y piezasDeModelo.
    compat.ts            Grafo de restricciones pieza <-> coche: encaje, fallos y legalidad.
    recommend.ts         Motor de recomendación (selección con restricción de presupuesto).
    index.ts             Barrel.
  agents/              Subagentes (deterministas; misma interfaz que tendría un LLM).
    clasificador-gama.ts     Reparte las piezas de un modelo en baja / media / alta.
    selector-presupuesto.ts  Resuelve el modelo, calcula el suelo de gasto y delega en el motor.
    index.ts
  ingest/
    obsidian.ts          Parser vault <-> JSON (las dos direcciones).
    run.ts               CLI de ingesta (export / ingest).
  data/               Generado desde el vault. NO editar a mano (salvo brands/floors).
    catalog.json         98 piezas. Generado por `npm run vault:ingest`.
    models.json          26 modelos VW. Generado por `npm run vault:ingest`.
    brands.json          Config a mano: niveles de marca y bandas de precio por categoría.
    floors.json          Config a mano: gasto mínimo por gama y objetivo.
  export/             Salida a documento.
    pdf.ts               Documento del presupuesto con pdfmake, cargado con import() dinámico.
    iconos-pdf.ts        Iconos vectoriales por categoría, como cadenas SVG.
    pdfmake.d.ts         Tipos prestados para los bundles de pdfmake/build.
  ui/                 Interfaz React (usa el motor, no lo toca).
    format.ts            Reexporta euros() del motor.
    icons.tsx           Familia de iconos de línea.
    theme.ts            Hook useTema (sistema por defecto, elección en localStorage `jondasiviz-tema`, `data-theme` en <html>).
    opciones.ts         Gamas y las 4 tarjetas de objetivo con su frase.
    Formulario.tsx      Modelo con datalist, presupuesto (número + slider 500-30000), objetivos multi-selección, suelo y gama esperada en vivo.
    Requisitos.tsx      Desglose en vivo: mínimo del proyecto y qué categorías entran y cuáles no. Se usa bajo los objetivos del formulario.
    Resultado.tsx       Cabecera con chip de gama resultante, barra de gasto, aviso de suelo con botón "ver qué sale con X €", piezas por categoría (cada línea con su gama), invitación al siguiente escalón, siguientes mejoras.
    PiezasCompatibles.tsx  Panel plegable con pestañas baja/media/alta.
  App.tsx             Orquesta el estado y llama a crearSelector().seleccionar(...).
  App.css, index.css  Sistema visual (acento rojo GTI, tokens, tema claro/oscuro, grid 8pt, prefers-reduced-motion).
  cli/plan.ts         CLI para probar el motor sin interfaz.
  cli/probar.ts       CLI de sondeo de compatibilidad (prueba y error).
tests/               Vitest. 79 tests.
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
7. **Sustitución** (`sustituirEnGrupo`): cuando el relleno llega a una pieza cuyo grupo
   ya está ocupado, en vez de descartarla evalúa el cambio. Entra si aporta más `valor`
   a los objetivos que la montada, no depende de ella, la categoría de la que sale
   sigue cubierta, y la diferencia cabe una vez que la saliente devuelve su dinero
   (`cabeSustituyendo`). El sustituto hereda el motivo de la saliente cuando cubre su
   misma categoría, así que un turbo-back que releva al downpipe del K04 sigue saliendo
   como `dependencia`. Sin esto, la primera pieza que pillaba el grupo lo bloqueaba para
   siempre, incluso siendo una dependencia barata fijada por el paso de esenciales.
8. Devuelve: líneas agrupadas por categoría, total, sobrante, `gamaResultante`, avisos
   (categorías prioritarias que no han entrado) y hasta 3 mejoras siguientes con
   "faltan X €". Una mejora que choca de `grupoExclusivo` con algo montado solo aparece
   si es un cambio válido, y entonces lleva `sustituye` con la pieza a la que releva y
   un `falta` que ya descuenta lo que esa pieza devuelve. No repiten grupo entre ellas:
   sería la misma mejora contada dos veces.
9. Y `esenciales` + `minimoEsencial` (`minimosEsenciales`): recorre las categorías
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

## 5b. El grafo de restricciones (`src/engine/compat.ts`)

Responde a "¿puedo montar esta pieza en este coche?" con tres respuestas a la vez:
si encaja, si va a dar algún fallo, y si el coche sigue pasando la ITV.

`evaluar(pieza, modelo, { catalogo, montadas })` devuelve un veredicto
(`compatible` | `con-avisos` | `incompatible`), si es `homologable`, la lista de
hallazgos con su motivo y gravedad, las dependencias que arrastra y el coste total.

Reglas, en orden:

| Motivo | Qué comprueba |
|---|---|
| `propulsion` | Un eléctrico no tiene admisión, escape, turbo ni gestión. Un PHEV no admite reprogramación. |
| `plataforma` | Piezas de motor y transmisión: la plataforma de motor del coche debe estar en la pieza. |
| `chasis` | El resto de piezas: el chasis del coche debe estar en la pieza. Lista vacía = va por motor. |
| `traccion` | La conversión de eje rígido para drift no tiene sentido en un 4Motion. |
| `equipamiento` | `chocaCon` da fallo (coilover convencional en un coche con DCC), `exige` avisa de gasto inútil. |
| `redundancia` | `sustituye` avisa de lo que el coche ya trae (VAQ, eje trasero vectorial, frenos de 357). |
| `legalidad` | `solo-circuito` y `requiere-ficha`, propagando lo que arrastren las dependencias. |
| `dependencia` | Resuelve `requiere` en cadena; una dependencia incompatible bloquea la pieza entera. |
| `grupo` | Choque de `grupoExclusivo` con lo que ya está montado. |
| `carga` | Turbo de impacto 5 sobre un DSG de serie sin embrague reforzado. |

`encaja(pieza, modelo)` es el predicado base y lo usa también `piezasDeModelo` en
`graph.ts`, para que la recomendación y el sondeo no puedan discrepar.

Es **determinista**, no aprende. La capa de embeddings de la sección 8 se apoyaría en
esta matriz: es el sustrato que le hace falta para entrenarse con algo.

### Campos que lo alimentan

En `Pieza`: `chasis`, `legalidad`, `traccion`, `sustituye`, `exige`, `chocaCon`.
En `ModeloVW`: `propulsion`, `equipamiento`.

`equipamiento` recoge la especificación europea más común de cada versión, no las
opciones. El DCC va marcado en Clubsport, Edition 50 y los R, donde es de serie, y no
en el GTI base, donde es opcional.

### El bucle de prueba y error

```bash
npm run probar -- --modelo "Golf R Mk8" --pieza susp-coil-mqbevo-alta   # un par
npm run probar -- --modelo "Golf GTI Mk8"        # las 98 piezas contra ese coche
npm run probar -- --pieza turbo-k04-alta         # esa pieza contra los 26 coches
npm run probar -- --matriz                       # 26 x 98, resumido
npm run probar -- --listar-piezas
```

Los barridos son la parte que descubre cosas. Un ejemplo real: sondear el kit KW V3
contra los 25 coches sacó que los kits específicos de Golf 8 aparecían también en
coches MQB, porque el chasis se dedujo de las plataformas de motor y el 1.5 TSI vive
en Golf 7 y en Golf 8. Se corrigió con un chasis explícito en esas cinco piezas.

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
- Traduce dinero a gama con cuatro funciones puras y exportadas, para que la interfaz
  las use en vivo sin calcular el presupuesto entero:
  - `umbralGama(objetivos, gama)` = **suma** de `floors.json` -> `suelos[o][gama]`.
    Pedir varias cosas a la vez sube el listón.
  - `sueloDe(objetivos)` = `umbralGama(objetivos, "baja")`, el mínimo para que el
    proyecto tenga sentido.
  - `gamaEsperada(objetivos, presupuesto)` = gama más alta que cubre el dinero, o
    `null` si no llega ni al suelo.
  - `siguienteEscalon(objetivos, presupuesto)` = `{ gama, presupuesto }` del siguiente
    escalón, o `null` si ya se está en alta. Es lo que alimenta el botón "ver qué sale
    con X €".
- `cumpleSuelo` = presupuesto >= suelo. Si no llega: aviso, **pero devuelve igualmente
  lo que entra**. Antes en ese caso la lista salía casi vacía.
- Devuelve `{ modelo, presupuesto, suelo, cumpleSuelo, gamaEsperada, siguienteEscalon, avisos }`.

---

## 7. Datos

### Modelos (`src/data/models.json`, 26)

**Los 8 originales**: Golf GTI Mk5 (EA113, PQ35) · Golf GTI Mk7 (EA888, MQB) ·
Golf R Mk7 (EA888, MQB, tracción total) · Scirocco R (EA888, PQ35) ·
Polo GTI 6C (EA888, PQ25) · Golf Mk4 1.8T (1.8T-20v, PQ34) · Corrado VR6 (VR6, A2) ·
Golf GTD Mk6 (TDI, PQ35).

**Los 17 añadidos desde los PDFs de `Datos/`**, todos MQB o MQB Evo:

- GTI sobre `EA888-evo4`: Golf GTI Mk8 (245) · Clubsport Mk8 (300) · Clubsport 45 (300) ·
  Golf GTI Mk8.5 (265) · Clubsport Mk8.5 (300) · Edition 50 (325).
- R sobre `EA888-evo4`, todos 4Motion: Golf R Mk8 (320) · R Variant Mk8 (320) ·
  R 333 Limited Edition (333) · R 20 Years (333) · Golf R Mk8.5 (333) · R Variant Mk8.5 (333).
- Diésel sobre `EA288-evo`: Golf GTD Mk8 (200) · Golf GTD Mk8.5 (200).
- Los otros tres "R" de la gama, sobre `EA888` gen3 y 4Motion: T-Roc R (300) ·
  Tiguan R (320) · Arteon R (320).
- Golf Mk7 1.6 TDI (105-115 CV, `EA288-16`, chasis MQB, 2013-2020). No sale en los dos
  PDFs, que solo desglosan el Mk8; se añadió a mano. Va en **plataforma propia**, no en
  `EA288`, porque el 1.6 tiene otro turbo, otros inyectores y un techo de 165-175 CV:
  compartir las piezas del 2.0 le habría dado presupuestos con cifras que no son suyas.

Cada modelo enlaza con una **plataforma de motor**, que es lo que conecta con las piezas.
Hay trece: las cinco originales (`1.8T-20v`, `EA113`, `EA888`, `VR6`, `TDI`), siete
añadidas con los coches de los PDFs (`EA888-evo4`, `EA211`, `EA211-evo`, `EA211-PHEV`,
`EA288`, `EA288-evo`, `MEB`) y `EA288-16` para el 1.6 TDI.

La lista es **cerrada**: vive a la vez en el tipo `Plataforma` de `src/engine/types.ts` y
en la constante `PLATAFORMAS` de `src/engine/catalog.ts`. Añadir una pieza con una
plataforma que no esté en las dos hace que `npm run vault:ingest` falle con
"plataforma desconocida".

Tienen catálogo profundo el **Mk5 / EA113** y el **Golf 8 / EA888-evo4**. `EA211`,
`EA211-evo`, `EA211-PHEV` y `MEB` tienen piezas en el catálogo pero **ningún modelo que
las use** todavía: son los 1.0 y 1.5 TSI, el GTE y los ID.*, que no se han poblado.

### Catálogo (`src/data/catalog.json`, 98 piezas, v0.2.0)

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
- **Turbo híbrido K04-064** (`turbo-k04-alta`, EA113) arrastra FMIC + admisión +
  downpipe + HPFP + calibración Stage 2+.
- **Big turbo** (`turbo-bigturbo-alta`, EA113) arrastra FMIC Stage 3 + turbo-back +
  alimentación Stage 3 + gestión standalone.
- **Turbo híbrido evo4** (`turbo-hibrido-evo4-alta`) arrastra FMIC + admisión +
  downpipe + bomba de alta y calibración Stage 2 E85.
- **Turbo híbrido EA288 evo2** (`turbo-hibrido-ea288-alta`) arrastra intercooler +
  downpipe sin DPF + Stage 2 + inyectores.

Grupos exclusivos definidos: `intercooler`, `admision-filtro`, `remap`,
`turbo-principal`, `altura`, `downpipe`, `embrague`, `diferencial`,
`frenos-delanteros`, `llantas`.

### `brands.json`

`marcas`: marca (en minúsculas, se busca dentro del nombre de la pieza) -> nivel
`baja` | `media` | `alta`. Ej. `raceland`/`fk` = baja, `bc racing`/`kw v1` = media,
`kw clubsport`/`ohlins`/`bbs` = alta.

`bandasPrecio`: por categoría, `{ baja: <=X, media: <=Y }`. Precio <= baja -> baja;
<= media -> media; si no -> alta.

### `floors.json` (escala de gama por objetivo)

```
drift:    baja 1200, media 3000, alta 8000
drag:     baja 1500, media 3500, alta 12000
mas-cv:   baja 500,  media 1500, alta 5000
estetica: baja 400,  media 1500, alta 5000
```

El umbral de una combinación de objetivos es la suma de estos valores. La columna
`baja` es además el **suelo real** del proyecto: por debajo, avisa. Las otras dos son
referencia para situar el presupuesto en una gama.

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
- **(f) Gama europea: Golf 8 y los "R"** — a partir de dos PDFs con la gama VW europea
  (`proyecto/Datos/vw_europa_modelos_1.pdf`, 28 modelos, y
  `vw_europa_golf_variantes.pdf`, 23 variantes de Golf Mk8 y Mk8.5) se amplía el
  catálogo de 59 a **93 piezas** y de 8 a **25 modelos**. Se abren siete plataformas de
  motor (`EA888-evo4`, `EA211`, `EA211-evo`, `EA211-PHEV`, `EA288`, `EA288-evo`, `MEB`)
  en `types.ts` y `catalog.ts`, con precios y marcas reales de proveedores europeos
  (Unitronic, APR, Integrated Engineering, 034Motorsport, Milltek, Wagner, do88,
  Eventuri, KW, MuchBoost, MACHGRADE, RacingLine). Se añade `vault/Piezas por coche.md`,
  el índice que relaciona los 51 coches con sus piezas para el grafo de Obsidian. La
  investigación completa, con el mapa coche -> chasis -> motor y las fichas de las 34
  piezas nuevas, está en `proyecto/INVESTIGACION_PIEZAS.md`. 59 tests.
- **(g) Grafo de restricciones y saneado de la red** — el vault pasa de ser una lista
  de fichas a una red navegable: 155 nodos con 6 enlaces rotos, 1 duplicado
  (`Ta Technix` / `Ta-Technix`, que venía de una clave repetida en `brands.json`) y 66
  nodos aislados, a **204 nodos, 0 rotos, 0 duplicados y 0 aislados**. Se añaden cuatro
  tipos de nodo de contexto (chasis, categoría, grupo exclusivo, marca) y los enlaces
  pasan de ~1.000 a ~3.900. Las notas de pieza y de modelo las escribe ahora
  `escribirVault` con la matriz de compatibilidad ya calculada, así que el grafo no
  puede desincronizarse del catálogo. En el motor entra `compat.ts` (sección 5b) con
  seis campos nuevos en `Pieza` y dos en `ModeloVW`, y el CLI `npm run probar`. 79 tests.
- **(h) Golf Mk7 1.6 TDI** — primer coche que no sale de los PDFs. Plataforma propia
  `EA288-16` y cinco piezas suyas con precios y potencias reales (Celtic Tuning,
  Superchips, Darkside Developments, Wagner, Forge, BorgWarner/KKK). Se corrige de paso
  el filtro de aire, que estaba limitado a las cinco plataformas antiguas y dejaba sin
  nada de admisión a todos los TDI y TSI modernos: pasa de 5 a 11 plataformas. Catálogo
  de 93 a **98 piezas**, modelos de 25 a **26**, marcas de 43 a **48**. El grafo sigue
  en 0 enlaces rotos, 0 duplicados y 0 nodos aislados, con 215 nodos.

- **(i) Sustitución dentro del grupo exclusivo** — cierra el pendiente 1. Hasta ahora la
  primera pieza que ocupaba un grupo lo bloqueaba para siempre: el downpipe de 420 € que
  entra como dependencia del K04 dejaba fuera al turbo-back de 1.000 €, que lo incluye y
  aporta más, aunque sobrase dinero. Ahora el paso de relleno, cuando el grupo está
  ocupado, evalúa el cambio: si la entrante aporta más `valor` a los objetivos, la
  saliente devuelve su dinero y la diferencia cabe, se hace la sustitución. En el Mk5
  drag con 20.000 € el escape pasa del downpipe al turbo-back, marcado `[dependencia]`
  porque sigue cubriendo lo que el turbo exige. Lo que no cabe se ofrece como mejora con
  `sustituye` y el `falta` ya descontado el reembolso ("faltan 515 €", no 1.000 €).
  Tres guardas impiden cambios que rompan el plan: el sustituto no puede depender de la
  pieza a la que sustituye, la categoría de la saliente no puede quedarse sin cubrir, y
  el cambio nunca se pasa del presupuesto. 86 tests.

### Pendientes

1. **Fase 3b** — Guardar builds (localStorage o archivo) y exportar a CSV. El PDF ya
   está hecho.
2. **Fase 4** — Empaquetar el escritorio con Tauri (requiere instalar Rust), build
   web, y conectar el botón de descarga de la landing.
3. **Piezas sin modelo que las use**: `EA211`, `EA211-evo` (los 1.0 y 1.5 TSI del Polo,
   T-Cross, Taigo, T-Roc y Golf 8 base), `EA211-PHEV` (GTE) y `MEB` (los ID.*) tienen
   piezas en el catálogo pero ninguna ficha de modelo. Están mapeados en
   `INVESTIGACION_PIEZAS.md`, solo falta escribir las notas de `vault/Modelos/`. Las
   reglas de `propulsion` (bev y phev) están implementadas y con tests, pero no las
   dispara ningún coche real hasta que existan esas fichas.
4. **Catálogo de chasis MQB Evo muy corto.** Con el filtro por chasis en marcha se ve
   que un Golf 8 solo tiene 26 piezas compatibles frente a las 59 de un Mk5: faltan
   entradas de seguridad, estética y dirección para MQB Evo. La matriz de
   `npm run probar -- --matriz` lo enseña de un vistazo.
5. **Llevar el filtro de chasis también a `recommend.ts`.** Hoy `generarPresupuesto`
   sigue armando el pool por plataforma de motor, mientras que `piezasDeModelo` y el
   sondeo ya usan `encaja`. Coinciden en la práctica porque el selector resuelve el
   modelo antes, pero son dos caminos distintos y conviene unificarlos.
6. **Capa de embeddings** (la parte "neuronal") sobre los datos ya poblados. Ahora tiene
   sustrato: la matriz de `compat.ts` es lo que le faltaba para entrenarse con algo.
7. **Opción con API de LLM** para los subagentes, cuando se decida salir del modo
   100% offline.
8. Afinar la matriz `floors.json` y los pesos por objetivo del catálogo con uso real.
   Los suelos actuales se calibraron con un Mk5 de 2005 y se quedan cortos para el
   Golf 8: con 8.000 € para `drag + mas-cv`, un GTI Mk8 cumple el suelo de sobra y aun
   así se queda sin transmisión, frenos ni ruedas.
9. **Starvation entre categorías esenciales**: sin filtro de gama, una categoría que
   va primero puede llevarse todo el dinero y dejar sin nada a las siguientes (drag con
   4.000 € se va entero en el paquete del K04 y no entran transmisión, escape ni
   frenos). Ahora se avisa, que es honesto, pero se podría reservar parte del
   presupuesto para las categorías esenciales que quedan por cubrir.

---

## 9. Comandos

```bash
npm install
npm test                 # 79 tests (Vitest)
npm run typecheck        # tsc -b --noEmit
npm run build            # type-check + build de producción

npm run dev              # arranca la interfaz en http://localhost:5173

npm run plan -- --listar-modelos
npm run plan -- --modelo "Golf GTI Mk5" --presupuesto 4000 --objetivo drag
npm run plan -- --modelo mk5 --presupuesto 12000 --objetivo drift,estetica
npm run plan -- --modelo "Golf GTI Mk8" --presupuesto 8000 --objetivo mas-cv,drag
npm run plan -- --modelo "gtd mk8" --presupuesto 6000 --objetivo mas-cv

npm run probar -- --modelo "Golf R Mk8" --pieza susp-coil-mqbevo-alta
npm run probar -- --modelo "Golf GTI Mk8"    # barrido de las 98 piezas
npm run probar -- --pieza turbo-k04-alta     # barrido de los 26 coches
npm run probar -- --matriz                   # la matriz 26 x 98, resumida
npm run probar -- --listar-piezas

npm run vault:ingest     # vault/ -> src/data/catalog.json + models.json
npm run vault:export     # src/data/*.json -> vault/
```

Valores: `objetivo` (CLI) = uno o varios separados por
coma, de `drift|drag|mas-cv|estetica`.

---

## 10. Estado de git

- Local: `C:\Users\Manuel\Desktop\proyecto\Herramienta\JondaSiviz\JondaSiviz`, rama `main`.
  (La ruta anterior, `C:\Users\alexa\Desktop\JondaSiviz`, era la de la máquina antigua.)
- Remoto: **https://github.com/JondaSivizVolkswagen/jondasiviz** (privado), cuenta de
  GitHub `JondaSivizVolkswagen`. `origin/main` al día.

Commits (de más nuevo a más viejo):

```
chore: backup portable de la config de Claude Code (~/.claude)
docs: PROYECTO.md, dossier completo para retomar sin contexto previo
docs: README con objetivos multiples y suelo combinado
Objetivos multiples + suelo de gasto combinado
docs: README al dia (Fase 2, 40 tests, grupoExclusivo)
(c) Exclusion mutua por grupo + afinado de pesos y suelos
(b) Fase 2: interfaz React
(a) Catalogo real y profundo del Mk5 / EA113
Fase 1.5: red relacional en Obsidian + parser de ingesta
Capa relacional por modelo + subagentes offline
Fase 0 y 1: esqueleto y motor de presupuestos
```

Trabajo normal: `git add -A && git commit -m "..." && git push`.

Autenticación de GitHub en esta máquina: `gh` (GitHub CLI, instalado por winget en
`~\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_*\bin\gh.exe`) autenticado con
un token clásico de la cuenta `JondaSivizVolkswagen`. `gh auth setup-git` dejó
configurado el credential helper de git para `https://github.com`. Si en una máquina
nueva no hay auth: `gh auth login` (interactivo) o `gh auth login --with-token`.

---

## 11. Cómo retomar en una sesión o cuenta nueva de Claude Code

1. Abrir Claude Code en `C:\Users\Manuel\Desktop\proyecto\Herramienta\JondaSiviz\JondaSiviz`.
2. Pedirle que lea este `PROYECTO.md`, el `README.md` y, si toca datos, el
   `INVESTIGACION_PIEZAS.md` de `proyecto/`.
3. `npm install` y `npm test` para confirmar que todo pasa (59 tests).
4. `npm run dev` para ver la interfaz.
5. Continuar por la lista de **Pendientes** (sección 8).

Todo el estado del proyecto está en el repositorio: no depende de ninguna
conversación anterior ni de la cuenta.

---

## 12. Entorno de Claude Code del usuario (`C:\Users\Manuel\.claude\`)

Esto es **local a la máquina**, no a la cuenta premium. Cambiar de cuenta no lo
borra ni lo modifica. Se documenta aquí como copia de seguridad portable.

### Archivos de configuración

- `~/.claude/CLAUDE.md` — instrucciones globales del usuario para todos los proyectos.
  Incluye la "Política de modelo adaptativo" (Haiku o Fable para lo simple, Sonnet para
  desarrollo estándar, Opus solo para lo complejo), reglas generales (nunca
  `sudo npm install -g`; invocar `app-designer` para cualquier trabajo de UI/UX; etc.),
  la rutina de cierre de sesión, y una sección "Por ruta/proyecto" con el bloque de
  contexto de JondaSiviz. Importa `@RTK.md`.
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

- **apple-minimal-style-guide** — sistema de diseño visual fijo tipo Apple (color,
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
