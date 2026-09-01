# JondaSiviz — Volkswagen Build Planner

Herramienta para planificar la preparación de un Volkswagen. Introduces el modelo,
cuánto quieres gastar y el objetivo del proyecto (drift, drag, ganar caballos o
estética), y la herramienta devuelve un presupuesto de piezas que cabe en el dinero
disponible, con desglose por categoría, total, sobrante y las siguientes mejoras si
amplías el presupuesto.

La gama de las piezas no se elige: la decide el presupuesto. El motor mira todo lo
que encaja en el motor del coche y coge lo mejor que cabe, así que la lista mezcla
gamas igual que un build real. La gama sale como resultado, ponderada por el dinero
que se lleva cada pieza.

Los precios son orientativos. Proyecto personal, sin relación con Volkswagen AG.

## Estado

Versión 0.1 en desarrollo. De momento todo funciona sin conexión: los "subagentes"
son módulos deterministas locales, con la misma interfaz que tendría un agente LLM
para poder cambiarlos más adelante.

- [x] Fase 0 — Esqueleto: Vite + React + TypeScript, tooling y build.
- [x] Fase 1 — Motor de recomendación + catálogo + tests + CLI.
- [x] Fase 1.5 — Capa relacional por modelo (Obsidian), clasificador de gama y selector con suelo de gasto.
- [x] Fase 2 — Interfaz React: formulario y vista de resultados (`src/ui/`, `npm run dev`).
- [x] Fase 3a — Desglose en vivo de lo que pide el proyecto y exportación a PDF.
- [ ] Fase 3b — Guardar builds y exportar a CSV.
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
    floors.json        Config a mano: escala de gama por objetivo (su valor "baja" es el suelo).
  ingest/
    obsidian.ts        Parser vault <-> JSON.
    run.ts             CLI de ingesta.
  export/
    pdf.ts             Genera el PDF del presupuesto (pdfmake, con carga diferida).
    iconos-pdf.ts      Iconos vectoriales por categoría para el documento.
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

Dada una petición (modelo, presupuesto, objetivos):

1. Resuelve el modelo y filtra el catálogo por su plataforma de motor. Sin filtro de
   gama: el presupuesto es el único techo.
2. Comprueba el suelo del proyecto: la suma de los mínimos de cada objetivo elegido.
   Si el presupuesto no llega, avisa, pero devuelve igualmente lo que entra.
3. Puntúa cada pieza por aporte al objetivo (`peso × impacto`) y por aporte por euro.
4. Paso de esenciales: cubre una pieza de cada categoría prioritaria del objetivo
   (la de más aporte técnico), resolviendo sus dependencias, mientras quepa.
5. Paso de relleno: añade el resto de piezas por mejor relación aporte/precio. Cuando
   la pieza pertenece a un grupo exclusivo, sube a la de más aporte del grupo que
   quepa, para que sobrar dinero no acabe en la versión barata.
6. Nunca monta dos piezas del mismo `grupoExclusivo` (dos intercoolers, coilovers
   y air ride, remap y standalone, etc.). Lo que sí hace es cambiarlas: si una pieza
   aporta más que la que ocupa su grupo, la reemplaza y recupera su dinero, aunque la
   que sale hubiera entrado como dependencia de otra.
7. Devuelve las líneas agrupadas por categoría, total, sobrante, la gama resultante,
   avisos y hasta tres mejoras siguientes. Una mejora que releva a una pieza montada
   dice a cuál, y pide solo la diferencia.

Además calcula el **mínimo del proyecto**: recorre las categorías prioritarias del
objetivo cogiendo la opción más barata de cada una, con sus dependencias y contando
una sola vez lo que comparten. Eso es lo que se ve en vivo bajo el formulario, junto
con qué categorías entran y cuáles no, y lo que encabeza el PDF.

### PDF

El botón "Descargar en PDF" del resultado arma un documento A4 con la cabecera del
coche, la barra de gasto, el mínimo del proyecto con el detalle de qué entra y qué no,
las piezas agrupadas por categoría con su gama, y las siguientes mejoras. Los iconos
son vectoriales. Las piezas admiten un campo `imagen` opcional en el vault: mientras
esté vacío el documento tira solo de iconos, y en cuanto haya rutas las incrusta.

pdfmake se carga con `import()` dinámico, así que su casi mega de fuentes embebidas
no entra en el arranque de la app.

El motor es determinista: ante la misma entrada devuelve siempre el mismo resultado.

## Uso

```bash
npm install
npm test                 # 59 tests
npm run plan -- --listar-modelos
npm run plan -- --modelo "Golf GTI Mk5" --presupuesto 4000 --objetivo drag
npm run vault:ingest     # vault/ -> src/data/*.json
npm run vault:export     # src/data/*.json -> vault/
npm run dev              # arranca la web
npm run build            # type-check + build de producción
```

Valores admitidos:

- `--modelo`: id, nombre o alias (`mk5`, `Golf GTI Mk5`, `golf 5 gti`, ...). `--listar-modelos` para verlos.
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
