# Arquitectura y cómo comprobarla

Este documento existe para poder enseñar, con comandos concretos, que el proyecto tiene
las cuatro piezas que se le piden: base de datos, API con webhook, aplicación y un
historial real en GitHub. Cada apartado dice qué mirar y qué tiene que salir.

## El mapa

```
   navegador                       Node                        fichero
  ───────────                  ───────────                   ───────────
   index.html
   herramienta.html  ──HTTP──>  API :3001  ──SQL──>  SQLite  datos/jondasiviz.db
        │                           ▲
        │                           │ POST /api/webhook/github (firmado)
        │                           │
        │                        GitHub  ──push──>  Actions  ──>  Releases
        │
        └── app de escritorio (Tauri) con el mismo HTML, sin servidor
```

El motor de negocio (`src/engine/`) es TypeScript puro, sin React ni nada de navegador.
Por eso corre igual en los tres sitios: en la pestaña, en la API y en la CLI. No hay una
segunda copia de las reglas en el servidor, y hay un test que lo comprueba comparando el
presupuesto que devuelve la API con el que calcula el motor en local.

## Arrancarlo todo

Hacen falta dos terminales. La base se siembra sola la primera vez.

```bash
npm install

# terminal 1: la API y la base de datos
npm run api            # http://localhost:3001

# terminal 2: la web
npm run dev            # http://localhost:5173
```

Con `npm run db:sembrar -- --ver` se ve qué hay dentro de la base sin tocarla.

## 1. Base de datos

**Qué es.** SQLite, con el motor que Node trae de serie (`node:sqlite`). No hay que
instalar ningún servidor ni abrir cuenta en ningún sitio: la base es el fichero
`datos/jondasiviz.db`.

**Dónde mirar.** El esquema está en `src/db/esquema.ts`. Son ocho tablas relacionadas,
no un JSON metido en una columna: una pieza vale para varias plataformas y puntúa
distinto en cada objetivo, y cada una de esas cosas es su propia tabla con su clave
foránea.

**Cómo comprobarlo.**

```bash
npm run db:sembrar -- --ver
```

Tiene que decir 59 piezas y 8 coches. Para ver que hay SQL de verdad por debajo, esta
consulta cruza tres tablas y saca las piezas que más aportan a un derrape en un motor
EA113:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('datos/jondasiviz.db');
console.table(db.prepare(\`
  SELECT p.nombre, o.peso, p.precio_estimado
    FROM pieza p
    JOIN pieza_plataforma pl ON pl.pieza_id = p.id
    JOIN pieza_objetivo    o ON o.pieza_id  = p.id
   WHERE pl.plataforma='EA113' AND o.objetivo='drift' AND o.peso > 0
   ORDER BY o.peso DESC LIMIT 5\`).all());"
```

La integridad no es decorativa. Esto falla, porque `altisima` no es una gama válida:

```bash
node -e "const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('datos/jondasiviz.db');
db.prepare('INSERT INTO pieza (id,nombre,categoria,gama,precio_min,precio_estimado,precio_max,impacto) VALUES (?,?,?,?,?,?,?,?)')
  .run('x','Inventada','escape','altisima',1,2,3,3);"
```

## 2. API

**Qué es.** Un servidor HTTP en `src/api/servidor.ts`, con el módulo que trae Node. Sin
framework: son siete rutas y no compensa arrastrar dependencias.

| Ruta | Qué hace |
|---|---|
| `GET /api/salud` | Estado, versión del catálogo y cuándo se sembró por última vez |
| `GET /api/catalogo` | El catálogo entero, leído de SQLite |
| `GET /api/modelos` | Los ocho coches |
| `GET /api/modelos/:id` | Uno, con sus piezas compatibles |
| `GET /api/piezas?plataforma=&objetivo=` | Consulta resuelta en SQL |
| `POST /api/plan` | Calcula un presupuesto con el motor |
| `POST /api/webhook/github` | Recibe los avisos de GitHub |

**Cómo comprobarlo.** Con la API levantada:

```bash
curl http://localhost:3001/api/salud
curl "http://localhost:3001/api/piezas?plataforma=EA113&objetivo=drift"

curl -X POST http://localhost:3001/api/plan \
  -H "Content-Type: application/json" \
  -d '{"modelo":"golf-gti-mk5","presupuesto":4000,"objetivos":["drag"]}'
```

El último devuelve un plan con su total, lo que sobra, la gama que ha salido y las
piezas elegidas.

**La comunicación de la web con la API.** La web pide `/api/...` a su propio origen y
Vite lo reenvía al 3001 (`vite.config.ts`, apartado `server.proxy`). Se comprueba así:

```bash
curl http://localhost:5173/api/salud
```

Responde lo mismo que el 3001, pero pasando por la web. Quien carga el catálogo desde el
navegador es `src/data/fuente.ts`, llamado desde `src/main.tsx` antes de pintar nada.

Para verlo en el navegador: abre http://localhost:5173/herramienta.html, pestaña Red, y
ahí están `/api/catalogo` y `/api/modelos`. En el inspector, el elemento `<html>` lleva
`data-origen-datos="api"` cuando los datos vinieron del servidor y `"local"` cuando no.

**Si la API está apagada, la web sigue funcionando.** No es un descuido: la aplicación de
escritorio va sin conexión y sin servidor, así que cuando la API no contesta en un
segundo se tira del catálogo empaquetado. Párala y recarga: la herramienta funciona
igual y el atributo pasa a `local`.

## 3. Webhook

**Qué es.** `POST /api/webhook/github`. GitHub avisa de cada push y, si toca los datos,
la base se resiembra sola.

**Lo importante es que está firmado.** GitHub manda un HMAC SHA-256 del cuerpo en la
cabecera `X-Hub-Signature-256`. Sin comprobarlo, cualquiera con la URL podría disparar
una resiembra. La comprobación está en `src/api/webhook.ts` y usa `timingSafeEqual`, no
`===`, porque comparar cadenas se para en el primer carácter distinto y ese tiempo de
más deja adivinar la firma byte a byte.

**Cómo comprobarlo.** Arranca la API con un secreto:

```bash
JONDA_WEBHOOK_SECRET="secreto-de-prueba" npm run api
```

Sin firma, lo rechaza:

```bash
curl -i -X POST http://localhost:3001/api/webhook/github \
  -H "X-GitHub-Event: push" -d '{}'
# HTTP/1.1 401 Unauthorized
```

Con la firma buena, resiembra:

```bash
CUERPO='{"ref":"refs/heads/main","commits":[{"modified":["src/data/catalog.json"]}]}'
FIRMA=$(node -e "const{createHmac}=require('node:crypto');
  console.log('sha256='+createHmac('sha256','secreto-de-prueba').update(process.argv[1]).digest('hex'))" "$CUERPO")

curl -X POST http://localhost:3001/api/webhook/github \
  -H "X-GitHub-Event: push" -H "X-Hub-Signature-256: $FIRMA" \
  -H "Content-Type: application/json" -d "$CUERPO"
```

Devuelve `"resembrado": true`, y después `GET /api/salud` enseña la última siembra con
origen `webhook`. Queda registrado en la tabla `siembra`, así que se puede demostrar que
pasó.

**Para conectarlo con el GitHub de verdad** hace falta que la API sea accesible desde
fuera. En Ajustes del repositorio, Webhooks, añadir la URL pública terminada en
`/api/webhook/github`, tipo `application/json` y el mismo secreto que la variable de
entorno.

## 4. Aplicación

Dos formas de la misma aplicación, con el mismo código:

- **Web**: `index.html` (portada) y `herramienta.html` (el planner en React).
- **Escritorio**: Tauri empaqueta ese mismo HTML para Windows, macOS y Linux. La ventana
  abre `index.html`, el mismo fichero que sirve la web. No hay una segunda versión.

```bash
npm run build             # compila las dos páginas
```

Los instaladores se bajan de las releases del repositorio.

## 5. GitHub

- Repositorio público con historial de varias personas.
- Etiquetas de versión y releases con los binarios de los cuatro sistemas.
- Dos flujos de trabajo en `.github/workflows/`: uno compila y publica al empujar una
  etiqueta `v*`, otro pasa las comprobaciones en cada push y cada pull request.
- Cada release publica las huellas SHA-256 de sus ficheros.

```bash
git log --oneline | head -20
gh release list
```

## Las pruebas

```bash
npm test
```

De los 101 tests, 21 son de esta capa:

- `tests/db.test.ts` comprueba que el catálogo sale de SQLite exactamente igual que
  entró, que resembrar no duplica y que las restricciones del esquema rechazan datos
  imposibles.
- `tests/api.test.ts` levanta el servidor en un puerto libre y le hace peticiones HTTP
  de verdad. El más importante compara el plan que devuelve la API con el que calcula el
  motor en local: si alguien reimplementa una regla en el servidor, ese test se cae.
