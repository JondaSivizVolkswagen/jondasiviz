# Política de Inteligencia Adaptativa

A partir de este momento debes actuar de forma completamente adaptativa.

Antes de responder a cualquier petición, analiza internamente:

- La complejidad de la tarea.
- El riesgo de cometer errores.
- La profundidad de razonamiento necesaria.
- Si requiere planificación.
- Si necesita comprobaciones o validaciones.
- Si requiere usar herramientas externas.
- Si es una tarea sencilla o un proyecto complejo.

En función de ese análisis, selecciona automáticamente el nivel de razonamiento más adecuado.

## Nivel Bajo

Para preguntas simples, traducciones, definiciones, pequeños cambios de código, comandos básicos o tareas rápidas.

- Prioriza la velocidad.
- No dediques más razonamiento del necesario.
- Responde de forma directa.

## Nivel Medio

Para programación, configuración de sistemas, depuración de errores, administración de servidores, Docker, Linux, documentación, scripts y automatización.

- Analiza el problema antes de responder.
- Comprueba posibles errores.
- Propón soluciones robustas.

## Nivel Alto

Para arquitectura de software, pentesting, ciberseguridad, redes, Kubernetes, Proxmox, bases de datos, inteligencia artificial, proyectos grandes o código complejo.

- Divide el problema en partes.
- Evalúa varias soluciones.
- Comprueba dependencias.
- Busca posibles fallos antes de responder.
- Prioriza la calidad frente a la rapidez.

## Nivel Máximo

Para criptografía, ingeniería inversa, malware, compiladores, sistemas operativos, investigación, matemáticas avanzadas, algoritmos complejos o proyectos de gran tamaño.

- Utiliza el máximo nivel de razonamiento disponible.
- Verifica cada conclusión antes de continuar.
- Revisa el resultado final.
- Corrige automáticamente cualquier posible error detectado.
- Prioriza siempre la precisión sobre la velocidad.

# Reglas generales

- Selecciona automáticamente el nivel de razonamiento sin preguntarme.
- Si durante la tarea descubres que es más compleja de lo esperado, aumenta automáticamente el nivel de razonamiento.
- Si la tarea resulta más sencilla, reduce automáticamente el nivel para ahorrar tiempo.
- No muestres nunca tu razonamiento interno.
- Devuelve únicamente el resultado final.

# Cuando escribas código

- Genera código limpio y mantenible.
- Sigue buenas prácticas.
- Detecta errores antes de escribir código.
- Corrige automáticamente posibles fallos.
- Optimiza rendimiento cuando tenga sentido.
- Evita duplicar código.
- Utiliza nombres claros y coherentes.
- Mantén un estilo consistente en todo el proyecto.

# Comportamiento autónomo

Siempre que sea posible:

- Detecta información que falte.
- Haz suposiciones razonables si son seguras.
- Avísame únicamente cuando una decisión pueda afectar al resultado.
- Detecta problemas de seguridad.
- Detecta problemas de rendimiento.
- Detecta incompatibilidades.
- Sugiere mejoras cuando aporten valor.
- Revisa el resultado antes de entregarlo.

# Optimización

Intenta siempre:

- Reducir el consumo de recursos.
- Reducir el tiempo de ejecución.
- Simplificar el código.
- Mejorar la legibilidad.
- Evitar soluciones innecesariamente complejas.

# Prioridades

1. Exactitud.
2. Seguridad.
3. Robustez.
4. Mantenibilidad.
5. Rendimiento.
6. Rapidez.

Nunca sacrifiques la calidad por responder más rápido.

Adapta automáticamente tu forma de trabajar a cada tarea sin necesidad de que yo te indique qué nivel de razonamiento utilizar.

# Memoria global (todas las rutas/proyectos)

Este archivo es único y global: se carga sin importar desde qué directorio se ejecute Claude Code. Cada entrada va etiquetada con la ruta/proyecto al que pertenece para poder separarlas. Añadir aquí, sin que el usuario tenga que pedirlo, todo lo relevante que se aprenda en cualquier sesión (preferencias, feedback, contexto de proyecto, referencias).

## Reglas generales (aplican en cualquier ruta)

- Nunca usar `sudo npm install -g`. Preferir prefijo npm local (`~/.npm-global`) o instalador nativo sin dependencias.
- Mantener este archivo actualizado automáticamente en cada sesión, en cualquier ruta, sin esperar a que se pida.
- Todo subagente, skill, plugin o herramienta de sistema que se cree o instale para el usuario debe quedar catalogado en `~/.claude/SKILLS_AGENTES.md` (importado abajo con `@SKILLS_AGENTES.md`, así que se carga siempre). Actualizar ese archivo en el mismo momento en que se añade o se elimina algo, sin esperar a que se pida.
- Cuando el usuario pida crear o modificar una app, pantalla, componente o interfaz (cualquier petición de diseño o desarrollo de UI/UX), invocar siempre primero al subagente `app-designer` (definido en `~/.claude/agents/app-designer.md`). Debe aportar la guía de estilo fija (skill `apple-minimal-style-guide`) y todo el desarrollo tiene que basarse en ella. No aplica a tareas que no sean de diseño/desarrollo de interfaz (bugs, scripts, backend puro, etc.).
- Todo lo relacionado con subagentes o agentes personalizados (definiciones en `~/.claude/agents/`, sus skills asociadas, entradas de este archivo que documenten su comportamiento, o el catálogo `~/.claude/SKILLS_AGENTES.md`) no se borra nunca en la rutina de cierre de sesión, esté o no marcado como `[IMPORTANTE]`. Ver excepción explícita en esa rutina.
- Elegir siempre el modelo más óptimo para cada tarea entre Haiku, Sonnet, Opus y Fable, según su complejidad: Haiku o Fable para tareas simples y de bajo consumo (buscar un dato puntual, sumas/restas, formateo, tareas mecánicas); Sonnet para desarrollo estándar; Opus solo para tareas complejas que de verdad lo justifiquen (razonamiento profundo, arquitectura, alto riesgo de error). No usar los modelos más potentes por defecto si la tarea no lo requiere. Esto aplica al elegir el parámetro `model` al delegar en subagentes (Agent tool); el modelo del hilo principal de conversación lo fija el usuario con `/model`, así que si conviene cambiarlo para la tarea en curso, sugerirlo en vez de cambiarlo sin avisar.
- Plugin **Caveman** instalado (`~/.claude/plugins/marketplaces/caveman`, JuliusBrussee/caveman) para ahorrar tokens de salida comprimiendo el estilo de respuesta. Configurado para activarse siempre en modo `lite` por defecto (`~/.config/caveman/config.json`, campo `defaultMode`), sin tener que escribir `/caveman` cada sesión. Barra de estado activada en `settings.json` para ver el modo activo (`[CAVEMAN:LITE]`). El propio modo tiene una regla de "auto-clarity": se desactiva solo en avisos de seguridad, confirmaciones de acciones irreversibles y pasos donde la compresión genere ambigüedad, así que no hace falta vigilarlo manualmente. Cambiar de nivel con `/caveman lite|full|ultra|wenyan`, o decir "modo normal" para apagarlo en la sesión.

## Proyectos marcados como importantes

Si el usuario dice que algo es "importante" y lo vincula a un proyecto, anotarlo en la sección "Por ruta/proyecto" de abajo y marcar ese bloque como `[IMPORTANTE]`. No mover nada todavía — el traslado solo pasa en la rutina de cierre (ver abajo).

## Rutina de cierre de sesión

Cuando el usuario escriba algo tipo "quiero cerrar terminal" (o equivalente), antes de responder que ya está:
1. Releer este archivo completo.
2. Borrar entradas sueltas: comandos aislados, notas sin contexto, o cosas que no estén ligadas a una ruta/proyecto ya documentado ni marcadas por el usuario como importantes.
3. Conservar siempre: las reglas generales, todo lo vinculado a rutas/proyectos con contenido coherente, y cualquier entrada relacionada con subagentes o agentes personalizados (por ejemplo, la regla de invocar a `app-designer`). Esto último nunca se borra, independientemente de si está marcado `[IMPORTANTE]`.
4. **Solo si** en esta sesión el usuario marcó algún bloque como `[IMPORTANTE]`: preguntar la ruta del proyecto (si no la dio ya), escribir/actualizar un `CLAUDE.md` dentro de esa ruta con toda la memoria de ese proyecto, y borrar ese bloque de este archivo general una vez movido. Si no hay nada marcado como importante, no preguntar ni mover nada.
5. Decir en una línea qué se borró y/o qué se movió (o que no había nada que tocar) antes de cerrar.

## Por ruta/proyecto

### `C:\Users\alexa\Desktop\JondaSiviz` — Volkswagen Build Planner

Remoto GitHub: **https://github.com/JondaSivizVolkswagen/jondasiviz** (privado, rama `main`, cuenta
`JondaSivizVolkswagen`). `gh` CLI autenticado en la máquina con token clásico; `gh auth setup-git`
hecho. Dossier completo del proyecto en `PROYECTO.md` (en el repo), y backup portable de la config
de `~/.claude` en `backup-claude-config/` del repo.

Herramienta que planifica la preparación de un Volkswagen: entras modelo + plataforma de motor
(`1.8T-20v` | `EA113` | `EA888` | `VR6` | `TDI`), gama (`baja` | `media` | `alta`), presupuesto y
objetivo (`drift` | `drag` | `mas-cv` | `estetica`), y devuelve un presupuesto de piezas que cabe
en el dinero, con desglose por categoría, total, sobrante y mejoras siguientes.

Es la herramienta que se descargará desde la landing (Artifact
https://claude.ai/code/artifact/2e2a345f-9595-4950-95ff-8d320d9df984, fuente en
`...\scratchpad\vw-build-planner.html`). Antes fue de BMW; se rehízo entero a Volkswagen.

Stack acordado: Vite + React + TypeScript para la interfaz, Tauri para escritorio (pendiente:
no hay Rust instalado, se hará en Fase 4), motor en TypeScript puro y aislado. Nada de scraping.

Visión de datos: la "red relacional" se autoría a mano en un **vault de Obsidian** (`vault/`:
notas de modelo, pieza, plataforma y marca con frontmatter YAML y enlaces `[[...]]`). Un parser
(`src/ingest/obsidian.ts`, `npm run vault:ingest`) la convierte a `src/data/catalog.json` +
`models.json`, que es lo que consume el motor y lo que se distribuye con la app. Más adelante,
sobre esos datos, una capa de embeddings para inferir compatibilidad en modelos con pocos datos
(la parte "neuronal"). Los "subagentes" (clasificador de gama y selector de presupuesto) de
momento son módulos deterministas locales, con interfaz lista para cambiar a LLM. Se decidió
**offline de momento**; la opción con API de LLM se verá después.

Fases hechas y commiteadas (git init local, sin remoto): 0 esqueleto · 1 motor + catálogo + tests
+ CLI · 1.5 capa relacional por modelo en Obsidian + clasificador de gama + selector con suelo de
gasto (`src/data/floors.json`, matriz gama × objetivo) · (a) catálogo real y profundo del Mk5 /
EA113 (catalog v0.2.0, 59 piezas con marcas y precios reales, cadenas de dependencia K04 y big
turbo) · (b) Fase 2 interfaz React en `src/ui/` (format, icons, theme con `data-theme` +
`localStorage` `jondasiviz-tema`, opciones, Formulario, Resultado, PiezasCompatibles; `src/App.tsx`
orquesta; `src/App.css` + `src/index.css` con el estilo de la landing, acento rojo GTI `#C0322E`
claro / `#E0605A` oscuro; una sola página: formulario con modelo datalist + gama segmentada +
presupuesto con slider 500-25000 + 4 tarjetas de objetivo, y resultado con barra de gasto, aviso
de suelo con botón "probar en gama X", piezas por categoría, siguientes mejoras y panel plegable
de piezas compatibles) · (c) exclusión mutua por `Pieza.grupoExclusivo` (no dos intercoolers, ni
coilovers + air ride, ni remap + standalone, un solo turbo/downpipe/embrague/diferencial/llantas),
el paso de esenciales ordena por aporte técnico (objetivo × impacto) antes que por precio, y
`floors` drag/media bajado a 3500. El motor (`src/engine`, `src/agents`) solo lo consume la UI, no
se tocó. Además: el objetivo es **multi-selección** (`PeticionPresupuesto.objetivos: Objetivo[]`,
`EntradaSelector.objetivos`); los pesos de las piezas se suman entre objetivos y las categorías
esenciales son la unión; el suelo de gasto es la suma de los suelos de cada objetivo (función
pura `sueloDe(objetivos, gama)` para mostrarlo en vivo en el formulario, que se recalcula al
togglear objetivos o gama). CLI `--objetivo` acepta lista por coma. `npm run build` OK, `npm run
dev` arranca. 42 tests. Pendientes: permitir que una pieza de gama
superior sustituya a una dependencia inferior ya fijada; 3 guardar builds + export PDF/CSV; 4
empaquetar Tauri (necesita instalar Rust) + build web + conectar la descarga de la landing.

Comandos: `npm test` (42 tests con Vitest), `npm run plan -- --modelo "Golf GTI Mk5" --gama media --presupuesto 4000 --objetivo drag,estetica`,
`npm run plan -- --listar-modelos`, `npm run vault:ingest` / `vault:export`, `npm run dev`, `npm run build`.
Estructura: `src/engine/` (types, catalog, graph, recommend), `src/agents/` (clasificador-gama,
selector-presupuesto), `src/ingest/` (obsidian, run), `src/ui/` (interfaz React), `src/data/`
(catalog.json y models.json generados del vault; brands.json y floors.json a mano),
`src/cli/plan.ts`, `vault/`, `tests/`. Catálogo: 59 piezas, 8 modelos VW (Mk5 GTI de referencia,
el único con catálogo profundo por ahora).

@RTK.md
@SKILLS_AGENTES.md
