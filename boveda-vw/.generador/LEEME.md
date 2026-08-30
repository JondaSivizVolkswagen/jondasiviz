# Generador de la bóveda

Las notas de `boveda-vw/` no se escriben a mano una a una: salen de estos archivos de
datos. Si hay que corregir un color, añadir un modelo o detallar una edición especial,
se toca el dato y se regenera todo.

Hay dos salidas a partir de la misma fuente: las notas de Obsidian y un script Cypher
para Neo4j.

```bash
node .generador/build.mjs ..            # desde boveda-vw/, reescribe las notas
node .generador/build-neo4j.mjs         # escribe .generador/salida/*.cypher
```

O desde la raíz del repositorio:

```bash
node boveda-vw/.generador/build.mjs boveda-vw
node boveda-vw/.generador/build-neo4j.mjs
```

## Qué hay en cada archivo

- `comun.mjs` — datos unidos y utilidades que comparten las dos salidas: cómo se llama
  cada modelo, cómo se trocean las plataformas, cómo se normalizan las mecánicas. Si dos
  exportadores tienen que dar el mismo nombre a la misma cosa, la función vive aquí.
- `build.mjs` — escribe las notas de Obsidian.
- `build-neo4j.mjs` — escribe el script Cypher.
- `datos1.mjs` — Golf, Polo, Up!, Fox, Gol, Voyage y Saveiro.
- `datos2.mjs` — Jetta y derivados, berlinas chinas, Passat, CC, Arteon, Phaeton,
  Beetle, Scirocco y Eos.
- `datos3.mjs` — SUV y crossover, más Amarok y Routan.
- `datos4.mjs` — monovolúmenes, comerciales, gama ID. y rarezas (XL1, Citi Golf).
- `ediciones.mjs` — detalle de las ediciones especiales con año, unidades y mercado.
  Las que no aparecen aquí se generan como ficha pendiente, marcada con
  `detallada: no` en el frontmatter.
- `colores.mjs` — diccionario de colores: acabado, familia cromática y nombre en
  español. Si un modelo usa un color que no está en el diccionario, el build lo avisa
  por consola al terminar.
- `motores.mjs` — familia de motor de cada modelo. Es la bisagra con el catálogo de
  piezas. El build revienta si una clave no corresponde a ningún modelo o si un modelo
  se queda sin entrada, porque si no el fallo sería silencioso.
- `piezas.mjs` — piezas oficiales de Volkswagen, ofertas verificadas y homologación.

## Piezas

Las no oficiales **no se copian aquí**: se leen de `src/data/catalog.json`, el catálogo
del planner, que sigue siendo la única fuente. Si el archivo no existe, la bóveda se
genera igual y solo con las oficiales.

El cruce pieza-modelo tiene dos reglas, porque una sola daba resultados absurdos:

- **Piezas de motor** (admisión, escape, gestión, turbo, transmisión): entran en
  cualquier modelo que monte esa familia. Un downpipe de EA888 vale igual en un Golf que
  en un Tiguan.
- **Piezas de chasis** (suspensión, frenos, ruedas, dirección, estética, seguridad):
  además de compartir motor, el modelo tiene que ir sobre una plataforma de turismo. Sin
  esto salían coilovers de Golf como compatibles con el Crafter, el Touareg y el XL1,
  porque los tres llevan un TDI. Sigue sin ser fitment exacto y las fichas lo advierten.

### Precios y homologación

Los dos campos son verificados a mano, uno a uno, y nunca deducidos:

- Una entrada en `OFERTAS` es un producto concreto en una tienda concreta, con el precio
  que tenía **el día que se abrió la página**. Lleva la fecha para poder descartarla
  cuando envejezca. Las piezas sin oferta salen con el rango orientativo del planner y
  con `precio_verificado: no`.
- `HOMOLOGACION` solo se rellena donde hay fuente. Alemania sale de lo que declara la
  ficha del producto (ABE, Teilegutachten, TÜV, o la frase «nicht zugelassen im Bereich
  der StVZO»); España, del régimen de reformas del Real Decreto 866/2010, que depende del
  tipo de modificación y no del producto. Lo que no está verificado queda vacío y
  marcado, nunca supuesto: una pieza sin datos **no** es una pieza legal.

Para añadir una oferta hay que abrir la página, leer el precio y copiarlo con su fecha.
El build valida que toda oferta apunte a una pieza que existe.

## Campos de un modelo

```js
{
  f:"Golf",                    // familia
  g:"Mk7",                     // generación
  cod:"5G / AU",               // código interno de fábrica
  a:[2012, 2017],              // años; null en el segundo para "en producción"
  plat:"MQB",                  // plataforma; admite "PQ35 y MQB"
  carr:[...],                  // carrocerías
  merc:[...],                  // mercados
  prop:[...],                  // mecánicas
  sub:[...],                   // acabados y submodelos
  ed:[...],                    // ediciones especiales, generan nota propia
  col:[...],                   // colores, generan nota propia
  nota:"..."                   // párrafo de contexto
}
```

El build valida los enlaces por construcción: cada entrada de `ed`, `col`, `merc` y
`plat` crea su nota correspondiente, así que no quedan enlaces rotos mientras los
nombres se escriban igual en todas partes.

Esta bóveda es independiente de `vault/`, la fuente de datos del planner. El comando
`npm run vault:ingest` no la lee y los tests del proyecto no la recorren.

## Salida a Neo4j

`build-neo4j.mjs` deja dos archivos en `.generador/salida/`, que está en el
`.gitignore` porque se regeneran en un segundo:

- `boveda-vw.cypher` — restricciones de unicidad más 22 sentencias `UNWIND` con los datos
  incrustados. Crea el grafo entero: 1.093 nodos y 2.887 relaciones.
- `cargar-csv.cypher` — la misma carga, pero leyendo de los CSV. Sentencias cortas.
- `csv/` — 22 archivos, uno por etiqueta y uno por tipo de relación.
- `ejemplos.cypher` — once consultas de ejemplo para pegar en Neo4j Browser.

Las dos rutas de carga salen del mismo registro interno del generador, así que no pueden
dar grafos distintos.

Todo son `MERGE`, así que cargarlo dos veces no duplica nada. La cabecera del archivo
trae comentada una línea para vaciar antes solo los nodos de esta bóveda, sin tocar el
resto de la base de datos.

### Cargarlo desde Neo4j Desktop 2

1. En Desktop, crea una instancia local y arráncala. Anota la contraseña.
2. Genera la salida y lánzala:

```powershell
node .generador\build-neo4j.mjs
.\.generador\cargar.ps1
```

`cargar.ps1` no necesita que instales nada: busca en `%USERPROFILE%\.Neo4jDesktop2\Cache`
el `cypher-shell` y el runtime de Java que Desktop ya se descargó, y ejecuta el script
contra `bolt://localhost:7687`. Sin `-Clave` la pide por teclado, que es mejor que
dejarla en el historial de la consola.

Admite `-Uri`, `-Usuario`, `-Base` y `-Archivo` si la instancia escucha en otro puerto o
quieres cargarlo en una base que no sea `neo4j`.

Un detalle de Desktop 2: su `cypher-shell` coge el primer Java del `PATH`, no el de
`JAVA_HOME`. Si en la máquina hay un Java 17 instalado, falla con *Unsupported Java
17 detected*. El script lo resuelve anteponiendo al `PATH` el JRE 21 de la propia cache
de Desktop.

Para comprobar que ha entrado, en la pestaña Query:

```cypher
MATCH (n) RETURN labels(n)[0] AS etiqueta, count(*) AS nodos ORDER BY nodos DESC;
```

### Variante con CSV, para hacerlo desde la interfaz

`boveda-vw.cypher` lleva los datos dentro y son 185 KB: pegarlo en la pestaña Query no es
buena idea. La alternativa es dejar los datos en disco y cargar solo las instrucciones.

```powershell
node .generador\build-neo4j.mjs
.\.generador\copiar-csv.ps1
```

`copiar-csv.ps1` busca la carpeta `import` de la instancia bajo
`%USERPROFILE%\.Neo4jDesktop2\Data\dbmss` y deja dentro los CSV en un subdirectorio
`boveda-vw`. Si tienes más de una instancia, las lista para que elijas con `-Import`. En
Desktop también puedes abrir esa carpeta desde las opciones de la instancia y copiarlos a
mano; da igual, mientras acaben en `import\boveda-vw`.

Después abre `salida\cargar-csv.cypher` y pega el contenido en la pestaña Query. Son 32
sentencias de cuatro líneas.

Dos avisos sobre esta ruta:

- El orden importa. Los nodos van primero, y cada relación hace `MATCH` de sus dos
  extremos: si ejecutas solo un trozo suelto del final, no crea nada y tampoco protesta.
- `LOAD CSV` solo lee de la carpeta `import` de esa instancia. Si mueves los CSV a otro
  sitio, las URL `file:///boveda-vw/...` dejan de resolver.

En el CSV todo es texto, así que el script convierte al vuelo lo que no lo es:
`toInteger` para los años y `toBoolean` para `enProduccion` y `detallada`. Un `anioFin`
vacío, que es como se marcan los modelos aún en producción, entra como `null`.

### Modelo del grafo

```
(:Modelo)-[:DE_FAMILIA]->(:Familia)
(:Modelo)-[:USA]->(:Plataforma)
(:Modelo)-[:VENDIDO_EN]->(:Mercado)
(:Modelo)-[:TIENE_CARROCERIA]->(:Carroceria)
(:Modelo)-[:OFRECE]->(:Acabado)
(:Modelo)-[:MONTA]->(:Mecanica)
(:Modelo)-[:MONTA_MOTOR]->(:Motor)
(:Modelo)-[:DISPONIBLE_EN]->(:Color)
(:Modelo)-[:SUCEDE_A]->(:Modelo)
(:Edicion)-[:BASADA_EN]->(:Modelo)
(:Edicion)-[:DISPONIBLE_EN]->(:Color)
(:Edicion)-[:VENDIDA_EN]->(:Mercado)
(:Color)-[:DE_FAMILIA_CROMATICA]->(:FamiliaCromatica)
(:Pieza)-[:COMPATIBLE_CON]->(:Modelo)
(:Pieza)-[:PARA_MOTOR]->(:Motor)
(:Pieza)-[:SE_VENDE_EN {producto, url, precio, moneda, fecha, referencia}]->(:Vendedor)
(:Pieza)-[:HOMOLOGADA_EN]->(:Pais)
(:Pieza)-[:NO_HOMOLOGADA_EN]->(:Pais)
```

`SE_VENDE_EN` es la única relación con propiedades. Su clave de `MERGE` es la URL, para
que dos ofertas distintas de la misma tienda para la misma pieza no se pisen.

Dos cosas que no son evidentes al mirar el grafo:

- `:Mecanica` no son las cadenas del campo `prop`, que están escritas a mano y no se
  pueden comparar entre modelos. Son siete categorías normalizadas por palabras clave
  (gasolina, diésel, híbrido, híbrido enchufable, eléctrico, gas natural, flex-fuel), y
  una misma mecánica puede caer en varias. El texto original sigue en las notas de
  Obsidian.
- `:SUCEDE_A` encadena las generaciones de cada familia por año de lanzamiento. Cuando
  dos variantes regionales convivieron de verdad, como el Fox europeo y el brasileño, la
  cadena las pone en fila aunque fueran paralelas.
