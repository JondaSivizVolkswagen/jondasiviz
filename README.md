# JondaSiviz — Volkswagen Build Planner

Herramienta para planificar la preparación de un Volkswagen. Introduces el modelo,
eliges gama de piezas y presupuesto, marcas el objetivo del proyecto (drift, drag,
ganar caballos o estética) y la herramienta devuelve un presupuesto de piezas que
cabe en el dinero disponible, con desglose por categoría, total, sobrante y las
siguientes mejoras si amplías el presupuesto.

Los precios son orientativos. Proyecto personal, sin relación con Volkswagen AG.

## Estado

Versión 0.1 en desarrollo. De momento todo funciona sin conexión: los "subagentes"
son módulos deterministas locales, con la misma interfaz que tendría un agente LLM
para poder cambiarlos más adelante.

- [x] Fase 0 — Esqueleto: Vite + React + TypeScript, tooling y build.
- [x] Fase 1 — Motor de recomendación + catálogo + tests + CLI.
- [x] Fase 1.5 — Capa relacional por modelo (Obsidian), clasificador de gama y selector con suelo de gasto.
- [x] Fase 2 — Interfaz React: formulario y vista de resultados (`src/ui/`, `npm run dev`).
- [ ] Fase 3 — Guardar builds y exportar a PDF / CSV.
- [ ] Fase 4 — Empaquetado de escritorio (Tauri) y build web; conectar la descarga en la landing.
- [ ] Más adelante — capa de embeddings para inferir compatibilidad en modelos con pocos datos.

## Arquitectura

```
vault/               Red relacional autoría en Obsidian (fuente de verdad de datos).
  Modelos/*.md         Un modelo VW por nota: chasis, motor, tracción, años.
  Piezas/*.md          Una pieza por nota: categoría, gama, precio, pesos, dependencias.
  Plataformas/*.md     Nodos de contexto para el grafo de Obsidian.
  Marcas/*.md          Nodos de contexto para el grafo de Obsidian.

src/
  engine/            Lógica pura, sin dependencias de UI. Reutilizable en web, escritorio y CLI.
    types.ts           Tipos del dominio.
    catalog.ts         Carga y validación del catálogo.
    graph.ts           Capa relacional en memoria: modelo -> motor -> piezas.
    recommend.ts       Motor de recomendación (selección con restricción de presupuesto).
  agents/            Subagentes (deterministas por ahora, interfaz lista para LLM).
    clasificador-gama.ts    Reparte las piezas de un modelo en baja / media / alta.
    selector-presupuesto.ts Resuelve el modelo, aplica el suelo de gasto y selecciona piezas.
  data/             Generado desde el vault. No editar a mano.
    catalog.json       npm run vault:ingest
    models.json        npm run vault:ingest
    brands.json        Config a mano: niveles de marca y bandas de precio.
    floors.json        Config a mano: gasto mínimo por gama y objetivo.
  ingest/
    obsidian.ts        Parser vault <-> JSON.
    run.ts             CLI de ingesta.
  cli/
    plan.ts            CLI para probar sin interfaz.
tests/               Vitest.
```

### Flujo de datos

1. La red relacional se escribe en Obsidian, en `vault/`.
2. `npm run vault:ingest` lee el vault y regenera `src/data/catalog.json` y `models.json`.
3. El motor y los subagentes consumen esos JSON. La app que se distribuye lleva los
   JSON ya generados, no el vault.

`npm run vault:export` hace el camino inverso (JSON -> vault) para arrancar el vault
ya poblado. La ida y vuelta está cubierta por tests.

### Motor de recomendación

Dada una petición (modelo, gama, presupuesto, objetivo):

1. Resuelve el modelo y filtra el catálogo por su plataforma de motor y por la gama.
2. Comprueba el suelo de gasto: la suma de los suelos de cada objetivo elegido para
   esa gama. Si el presupuesto no llega, avisa y sugiere la gama que sí encajaría.
3. Puntúa cada pieza por aporte al objetivo (`peso × impacto`) y por aporte por euro.
4. Paso de esenciales: cubre una pieza de cada categoría prioritaria del objetivo
   (la de más aporte técnico), resolviendo sus dependencias, mientras quepa.
5. Paso de relleno: añade el resto de piezas por mejor relación aporte/precio.
6. Nunca monta dos piezas del mismo `grupoExclusivo` (dos intercoolers, coilovers
   y air ride, remap y standalone, etc.).
7. Devuelve las líneas agrupadas por categoría, total, sobrante, avisos y hasta tres
   mejoras siguientes.

El motor es determinista: ante la misma entrada devuelve siempre el mismo resultado.

## Uso

```bash
npm install
npm test                 # 42 tests
npm run plan -- --listar-modelos
npm run plan -- --modelo "Golf GTI Mk5" --gama media --presupuesto 4000 --objetivo drag
npm run vault:ingest     # vault/ -> src/data/*.json
npm run vault:export     # src/data/*.json -> vault/
npm run dev              # arranca la web (aún sin interfaz de la herramienta)
npm run build            # type-check + build de producción
```

Valores admitidos:

- `--modelo`: id, nombre o alias (`mk5`, `Golf GTI Mk5`, `golf 5 gti`, ...). `--listar-modelos` para verlos.
- `--gama`: `baja` | `media` | `alta`
- `--objetivo`: `drift` | `drag` | `mas-cv` | `estetica` (uno o varios por coma: `drift,estetica`)

## Notas de una pieza en el vault

```yaml
---
tipo: pieza
id: susp-coil-media
nombre: Coilovers roscados (BC Racing BR / KW V1)
categoria: suspension
gama: media
precio: { min: 700, estimado: 900, max: 1200 }
objetivos: { drift: 4, drag: 3, mas-cv: 0, estetica: 3 }
impacto: 4
requiere: []
plataformas: [1.8T-20v, EA113, EA888, VR6, TDI]
---

Compatible con [[EA113]], [[EA888]].
```

`npm run vault:ingest` valida que no haya ids duplicados, dependencias rotas ni
ciclos, y que precios y pesos estén en rango.
