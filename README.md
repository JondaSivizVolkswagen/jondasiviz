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
    selector-presupuesto.ts Resuelve el modelo, delega en el motor y busca el siguiente escalón.
  data/             Generado desde el vault. No editar a mano.
    catalog.json       npm run vault:ingest
    models.json        npm run vault:ingest
    brands.json        Config a mano: niveles de marca y bandas de precio.
    floors.json        Config a mano: escala de presupuestos a probar por objetivo.
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
2. Puntúa cada pieza por aporte al objetivo (`peso × impacto`) y por aporte por euro.
3. Paso de esenciales: cubre una pieza de cada categoría prioritaria del objetivo
   (la de más aporte técnico), resolviendo sus dependencias, mientras quepa. Una
   categoría que ya entró arrastrada como dependencia cuenta como cubierta y se salta:
   el downpipe que trae el turbo ya es el escape del proyecto. Antes de gastar en una
   categoría se **reserva** lo que costaría cubrir por lo mínimo las que vienen detrás,
   para que la primera de la lista no se lleve el presupuesto entero y deje sin frenos
   a un coche al que se le acaban de dar caballos.
4. Paso de relleno: añade el resto de piezas por mejor relación aporte/precio. Cuando
   la pieza pertenece a un grupo exclusivo, sube a la de más aporte del grupo que
   quepa, para que sobrar dinero no acabe en la versión barata.
5. Nunca monta dos piezas del mismo `grupoExclusivo` (dos intercoolers, coilovers
   y air ride, remap y standalone, etc.), ni las sugiere como mejora.
6. Avisa de las categorías prioritarias que se quedan fuera, mirando la selección
   final y no el paso de esenciales, para que el aviso no pueda contradecir a la lista.
7. Devuelve las líneas agrupadas por categoría, total, sobrante, la gama resultante,
   avisos y hasta tres mejoras siguientes.

Además calcula el **mínimo del proyecto**: recorre las categorías prioritarias del
objetivo cogiendo la opción más barata de cada una, con sus dependencias y contando
una sola vez lo que comparten. Es el único mínimo que se enseña, y sale del catálogo,
no de una tabla a mano. Se ve en vivo bajo el formulario, junto con qué categorías
entran y cuáles no, y encabeza el PDF.

Gracias a la reserva del punto 3, ese mínimo es una promesa que se cumple: **con ese
dinero justo, todas las categorías esenciales entran**. Hay un test que lo comprueba
contra todos los modelos del catálogo, así que cada coche nuevo del vault queda
cubierto sin tocar nada.

### Elige el comprador, elige el motor

Por defecto elige el motor entero. Pero en cada **parte del coche con más de una
alternativa compatible** el comprador puede quedarse con la que quiera, y el motor sigue
decidiendo todo lo demás con el dinero que sobre.

Las partes no están escritas en ningún sitio: son los `grupoExclusivo` del catálogo.
`gruposElegibles(catalogo, plataforma, objetivos)` devuelve los que tienen dos o más
piezas compatibles que aporten al objetivo, y con una sola opción no se enseña selector
porque no sería una elección. En cuanto el vault tenga tres parachoques del mismo coche
compartiendo grupo, su fila aparece sola: **no hay nada que registrar a mano**.

Lo elegido va en `PeticionPresupuesto.elecciones` (ids de pieza) y entra en un paso 0,
antes que las esenciales y que el relleno. Es una decisión del comprador, no una
recomendación, así que se respeta aunque el motor hubiera puesto otra cosa. Lo único que
no se salta es el presupuesto: si no cabe con sus dependencias, se dice y no entra.

Cuenta también para el **mínimo del proyecto**: si pides unas llantas de 1.900 €, el
suelo de la barra sube, porque ese ya es el coste de tu proyecto. Y al cambiar de coche
las elecciones que no apliquen se ignoran solas, sin borrarlas: si vuelves, siguen ahí.

En el resultado esas piezas salen marcadas como "la elegiste tú", y en el PDF como
"tuya".

### Objetivos que no se combinan

`drift` y `drag` piden preparaciones contrarias, así que al marcar uno se suelta el otro.
El resto (`mas-cv`, `estetica`) se suma con cualquiera. La regla vive en el motor
(`enConflictoCon`, `conflictosEn`, `alternarObjetivo`), no en la interfaz, así que la
respetan la web y la CLI por igual.

### El tramo útil de la barra

La barra de presupuesto no va de una cifra inventada a otra: va **del mínimo del proyecto
a lo que cuesta montarlo todo**, de 100 en 100. Fuera de ese tramo el dinero no cambia la
lista, así que no se puede arrastrar hasta ahí.

`techoUtil(catalogo, plataforma, objetivos, elecciones)` pasa el motor con un tope que no
puede limitar (todo el catálogo compatible sumado) y devuelve lo que acaba gastando. Ese
total es un punto fijo: con ese dinero exacto el motor toma las mismas decisiones que sin
límite, porque en cada paso lleva gastado lo mismo y todo lo que cabía sigue cabiendo. Un
euro más solo engorda el sobrante. Hay un test que lo comprueba en los 8 modelos × 6
combinaciones de objetivos, y que además verifica que el techo está **ajustado**: con 100 €
menos ya no sale la misma lista.

Los dos extremos se redondean al centenar, hacia arriba el suelo y hacia arriba el techo,
porque una barra `range` cuenta sus pasos desde su propio `min`: si el mínimo fuese
1.825 € las posiciones serían 1.825, 1.925… y arrastrando no caerías nunca en una cifra
redonda. Redondeando, el Mk5 en drag va de 1.900 € a 21.700 € en saltos limpios, sin
poder bajar del mínimo y pudiendo llegar al build completo.

En la casilla del número se puede escribir cualquier cifra exacta. El formulario lleva
`noValidate` porque el navegador rechazaba valores fuera del `step` ("los dos valores
válidos más cercanos son 9000 y 9100"); de avisar se encarga el motor, que dice por qué.
Por debajo del mínimo sale el aviso de peligro, y por encima del techo una nota gris con
un botón para ajustar.

### El mínimo como suelo, y el aviso de seguridad

La barra de presupuesto **no baja del mínimo del proyecto**. El mínimo se recalcula
solo con el catálogo del coche y los objetivos marcados, así que un modelo nuevo trae
su propio suelo sin configurar nada.

Se puede escribir a mano una cifra por debajo (para ver qué sale con lo que uno tiene),
y entonces salta un aviso. `frenos`, `ruedas`, `dirección` y `seguridad` no son acabado
del proyecto: si faltan en un build que sube potencia o paso por curva, el aviso dice
que el coche es peligroso, no que esté incompleto. En un proyecto de pura estética esa
palabra no se usa, porque ahí unas llantas que no entran no matan a nadie. Vive en el
motor (`fraseRiesgo`), así que el formulario, el resultado, el PDF y la CLI dicen lo
mismo.

Por eso `frenos` es categoría esencial también de `mas-cv`: un proyecto que da caballos
y deja el freno de serie no puede considerarse terminado.

`floors.json` ya no decide nada del resultado. Solo aporta la escala de presupuestos
que merece la pena probar: para proponer el siguiente escalón, el selector pasa esos
presupuestos por el motor y se queda con el primero que de verdad sube la gama del
build. Si ninguno la sube, no hay escalón que ofrecer.

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
npm test                 # 80 tests
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
