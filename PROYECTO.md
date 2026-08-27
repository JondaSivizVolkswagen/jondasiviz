# JondaSiviz — Dossier completo del proyecto

Este documento recoge todo el contexto del proyecto para poder retomarlo desde cero
(por ejemplo, en una cuenta o sesión nueva de Claude Code) sin haber leído las
conversaciones anteriores. Última actualización: febrero 2026.

---

## 1. Qué es

Herramienta de escritorio/web que planifica la preparación de un coche **Volkswagen**.
El usuario introduce:

- un **modelo** VW (empezando por el Golf GTI Mk5),
- una **gama** de piezas: `baja` | `media` | `alta`,
- un **presupuesto** en euros,
- uno o varios **objetivos**: `drift`, `drag`, `mas-cv` (ganar caballos), `estetica`.

La herramienta devuelve un **presupuesto de piezas** recomendado que cabe en el
dinero disponible, con desglose por categoría, total, sobrante, avisos y las
siguientes mejoras si se amplía el presupuesto.

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
| **Stack** | Vite + React 19 + TypeScript para la interfaz. Motor en TypeScript puro y aislado, sin dependencias de UI, reutilizable en web / escritorio / CLI. |
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
    catalog.ts           Carga + validación del catálogo (ids únicos, dependencias, ciclos, rangos).
    graph.ts             Capa relacional en memoria: buscarModelo (id/nombre/alias) y piezasDeModelo.
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
    catalog.json         59 piezas. Generado por `npm run vault:ingest`.
    models.json          8 modelos VW. Generado por `npm run vault:ingest`.
    brands.json          Config a mano: niveles de marca y bandas de precio por categoría.
    floors.json          Config a mano: gasto mínimo por gama y objetivo.
  ui/                 Interfaz React (usa el motor, no lo toca).
    format.ts            euros().
    icons.tsx           Familia de iconos de línea.
    theme.ts            Hook useTema (sistema por defecto, elección en localStorage `jondasiviz-tema`, `data-theme` en <html>).
    opciones.ts         Gamas y las 4 tarjetas de objetivo con su frase.
    Formulario.tsx      Modelo con datalist, gama segmentada, presupuesto (número + slider), objetivos multi-selección, suelo en vivo.
    Resultado.tsx       Cabecera, barra de gasto, aviso de suelo con botón "probar en gama X", piezas por categoría, siguientes mejoras.
    PiezasCompatibles.tsx  Panel plegable con pestañas baja/media/alta.
  App.tsx             Orquesta el estado y llama a crearSelector().seleccionar(...).
  App.css, index.css  Sistema visual (acento rojo GTI, tokens, tema claro/oscuro, grid 8pt, prefers-reduced-motion).
  cli/plan.ts         CLI para probar el motor sin interfaz.
tests/               Vitest. 42 tests.
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

`peticion`: `{ plataforma, gama, presupuesto, objetivos: Objetivo[], modelo? }`.

Pasos:

1. Normaliza los objetivos (orden canónico `drift, drag, mas-cv, estetica`, sin repetir).
   Si no hay objetivos, o presupuesto <= 0, devuelve vacío con aviso.
2. `pool` = piezas del catálogo compatibles con la plataforma **y** la gama pedidas.
3. **Puntuación** de cada pieza:
   - `peso(pieza)` = suma de `pieza.objetivos[o]` para los objetivos elegidos (0..5 cada uno).
   - `valor(pieza)` = `peso × pieza.impacto`.
   - `valorPorEuro(pieza)` = `valor / precio.estimado`.
4. **Paso de esenciales**: para cada categoría esencial (unión de las de cada objetivo,
   en orden), coge la mejor pieza de esa categoría por `valor` (aporte técnico), luego
   `valorPorEuro`, luego precio, luego id. Resuelve sus dependencias. La añade si cabe
   en el presupuesto. Una pieza por categoría esencial.
5. **Paso de relleno**: recorre el resto de piezas por `valorPorEuro` y añade las que
   quepan, con sus dependencias.
6. **Grupo exclusivo**: piezas con el mismo `grupoExclusivo` cumplen la misma función y
   no se montan juntas (dos intercoolers, coilovers + air ride, remap + standalone,
   un solo turbo / downpipe / embrague / diferencial / juego de llantas, filtro vs
   admisión completa). Si una dependencia comparte grupo con algo ya elegido, se da
   por cubierta y el motor usa la pieza superior en vez de duplicar.
7. Devuelve: líneas agrupadas por categoría, total, sobrante, avisos (categorías
   prioritarias que no han entrado) y hasta 3 mejoras siguientes con "faltan X €".

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

`entrada`: `{ modelo: string, gama, presupuesto, objetivos: Objetivo[] }`.

- Resuelve el modelo con `buscarModelo` (id, nombre o alias; tolerante a acentos y
  mayúsculas). Si no lo reconoce: `modelo: null` + aviso con la lista de modelos.
- **Suelo de gasto**: `sueloDe(objetivos, gama)` = **suma** de `floors.json` -> `suelos[o][gama]`
  para cada objetivo. Pedir varias cosas a la vez sube el mínimo. Es función pura y
  exportada para que la interfaz lo muestre en vivo.
- `cumpleSuelo` = presupuesto >= suelo. Si no llega: aviso + `gamaSugerida` (la gama
  más alta cuyo suelo combinado sí cabe en el presupuesto).
- Llama a `generarPresupuesto` con las piezas del modelo y devuelve
  `{ modelo, presupuesto, suelo, cumpleSuelo, gamaSugerida, avisos }`.

---

## 7. Datos

### Modelos (`src/data/models.json`, 8)

Golf GTI Mk5 (EA113, PQ35) · Golf GTI Mk7 (EA888, MQB) · Golf R Mk7 (EA888, MQB, tracción total) ·
Scirocco R (EA888, PQ35) · Polo GTI 6C (EA888, PQ25) · Golf Mk4 1.8T (1.8T-20v, PQ34) ·
Corrado VR6 (VR6, A2) · Golf GTD Mk6 (TDI, PQ35).

Cada modelo enlaza con una **plataforma de motor** (`1.8T-20v` | `EA113` | `EA888` | `VR6` | `TDI`),
que es lo que conecta con las piezas. Solo el **Mk5 / EA113** tiene catálogo profundo por ahora;
el resto se apoya en las piezas de chasis (suspensión, frenos, ruedas, seguridad, estética) que
sirven a varias plataformas.

### Catálogo (`src/data/catalog.json`, 59 piezas, v0.2.0)

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

### `floors.json` (gasto mínimo orientativo por objetivo y gama)

```
drift:    baja 1200, media 3000, alta 8000
drag:     baja 1500, media 3500, alta 12000
mas-cv:   baja 500,  media 1500, alta 5000
estetica: baja 400,  media 1500, alta 5000
```

El suelo de una combinación de objetivos es la suma de estos valores.

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

### Pendientes

1. **Sustitución de gama en dependencias fijadas**: ahora si el downpipe entra como
   dependencia del K04, el turbo-back (que lo incluye) solo aparece como "mejora
   siguiente". Permitir que una pieza de gama superior sustituya a una inferior ya
   elegida y recupere el presupuesto.
2. **Fase 3** — Guardar builds (localStorage o archivo) y exportar el presupuesto a
   PDF / CSV.
3. **Fase 4** — Empaquetar el escritorio con Tauri (requiere instalar Rust), build
   web, y conectar el botón de descarga de la landing.
4. **Poblar más modelos** en el vault (Mk7, Golf R, etc.) con piezas y compatibilidades
   reales.
5. **Capa de embeddings** (la parte "neuronal") sobre los datos ya poblados.
6. **Opción con API de LLM** para los subagentes, cuando se decida salir del modo
   100% offline.
7. Afinar más la matriz `floors.json` y los pesos por objetivo del catálogo con uso real.
8. Filtrar `siguientesMejoras` por `grupoExclusivo` (ahora puede sugerir algo que
   nunca entraría por chocar de grupo, p. ej. air ride con coilovers ya montados).

---

## 9. Comandos

```bash
npm install
npm test                 # 42 tests (Vitest)
npm run typecheck        # tsc -b --noEmit
npm run build            # type-check + build de producción

npm run dev              # arranca la interfaz en http://localhost:5173

npm run plan -- --listar-modelos
npm run plan -- --modelo "Golf GTI Mk5" --gama media --presupuesto 4000 --objetivo drag
npm run plan -- --modelo mk5 --gama alta --presupuesto 12000 --objetivo drift,estetica

npm run vault:ingest     # vault/ -> src/data/catalog.json + models.json
npm run vault:export     # src/data/*.json -> vault/
```

Valores: `gama` = `baja|media|alta`. `objetivo` (CLI) = uno o varios separados por
coma, de `drift|drag|mas-cv|estetica`.

---

## 10. Estado de git

Repositorio **local** en `C:\Users\alexa\Desktop\JondaSiviz`, sin remoto. 9 commits:

```
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

Para no perderlo al cambiar de máquina o cuenta, subir a un remoto privado:

```bash
gh repo create jondasiviz --private --source=. --push
# o
git remote add origin <url> && git push -u origin main
```

---

## 11. Cómo retomar en una sesión o cuenta nueva de Claude Code

1. Abrir Claude Code en `C:\Users\alexa\Desktop\JondaSiviz`.
2. Pedirle que lea este `PROYECTO.md` y el `README.md`.
3. `npm install` y `npm test` para confirmar que todo pasa (42 tests).
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
