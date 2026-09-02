# Arquitectura y cómo comprobarla

Este documento existe para poder enseñar, con comandos concretos, cada pieza del
proyecto: base de datos, API con webhook, cuentas con suscripción de pago, aplicación y
un historial real en GitHub. Cada apartado dice qué mirar y qué tiene que salir.

## El mapa

```
   navegador                       Node                        fichero
  ───────────                  ───────────                   ───────────
   index.html                                                catálogo
   herramienta.html  ──HTTP──>  API :3001  ──SQL──>  SQLite   cuentas
        │                        ▲     ▲             datos/jondasiviz.db
        │                        │     │
        │      GitHub ──push──>  │     │  <──firmado── Stripe
        │      (resiembra)       │     │   (cobro de la suscripción)
        │                        │     │
        │                     Actions ──> Releases (binarios)
        │
        └── app de escritorio (Tauri) con el mismo HTML, sin servidor
```

Los dos webhooks que entran, el de GitHub y el de Stripe, van firmados y se comprueban
antes de hacer nada. Son las dos únicas puertas por las que algo de fuera cambia el
estado: una resiembra el catálogo, la otra decide quién tiene la suscripción pagada.

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

**Qué es.** SQLite, hablando con libSQL. La misma conexión vale para los dos sitios donde
puede vivir la base, y lo elige una variable de entorno:

| | Dónde | Cuándo |
|---|---|---|
| Fichero | `datos/jondasiviz.db` | Mientras se programa y en los tests. Sin cuentas ni conexión |
| Turso | `libsql://...` | Cuando la API deja de correr en el ordenador de uno |

```bash
# local: no hace falta poner nada
npm run api

# en Turso
JONDA_DB_URL=libsql://jondasiviz-tu-usuario.turso.io \
JONDA_DB_TOKEN=el-token \
npm run api
```

**Las columnas que se añaden después van en `src/db/migraciones.ts`.** `CREATE TABLE IF
NOT EXISTS` crea la tabla que falta, pero no toca la que ya está: una base que se creó con
un esquema anterior se quedaría sin la columna nueva. En local eso no se nota, porque se
borra el fichero y a correr; en Turso hay cuentas de gente dentro. Las migraciones se
aplican solas al abrir la base y volver a lanzarlas no rompe nada, porque antes se mira
qué columnas hay.

El esquema, las consultas y los tests son exactamente los mismos en los dos casos, así que
no hay una versión "de verdad" y otra de mentira que puedan separarse. Toda la capa es
asíncrona aunque en local no haga falta, porque contra Turso cada consulta es una petición
por la red.

**Por qué hace falta que esté fuera.** Un fichero en el disco no lo pueden compartir dos
servidores, no sobrevive a un despliegue y solo existe en un ordenador. En cuanto la API se
publica para que la aplicación instalada de otra persona pueda iniciar sesión, la base tiene
que estar en algún sitio al que lleguen los dos.

**Para enchufar Turso**, que es gratis: crear cuenta en [turso.tech](https://turso.tech),
crear una base, y de ahí salen la URL y el token que van en esas dos variables. Después,
`npm run db:sembrar` con las variables puestas llena la base de la nube con el catálogo.

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

## 4. Cuentas y suscripción

**Qué es.** Registro con correo y contraseña, sesiones, y una suscripción mensual de
9,99 € que abre la herramienta entera. Sin ella se puede usar, pero recortada.

| | Gratis | Suscrito |
|---|---|---|
| Objetivos a la vez | 1 | los 4 |
| Elegir piezas a mano | no | sí |
| Exportar a PDF | no | sí |
| Presupuestos al día | 5 | sin tope |

**Dónde mirar.** Los límites están en `src/suscripcion/planes.ts`, en un solo sitio y
como dato, no repartidos por la interfaz. Las contraseñas, en `src/auth/contrasenas.ts`.

**Lo que hay que saber defender.**

La contraseña no se guarda: se guarda su huella con **scrypt**, que viene en Node y está
pensado para esto, porque es lento y consume memoria a propósito. Un SHA-256 pelado, que
es el error habitual, se prueba a miles de millones por segundo en una tarjeta gráfica.
Cada usuario lleva su propia sal, así dos personas con la misma contraseña tienen huellas
distintas.

Del token de sesión tampoco se guarda el token, sino su huella. Quien consiga leer la
base no puede suplantar a nadie con lo que hay dentro.

**El control se hace en el servidor, no en la pantalla.** La interfaz deshabilita lo que
no toca, pero eso se salta abriendo las herramientas del navegador. Quien decide es
`POST /api/plan`, que responde **402** cuando la petición se pasa del plan. Compruébalo
saltándote la interfaz por completo:

```bash
TOKEN=... # el que devuelve /api/auth/entrar

curl -i -X POST http://localhost:3001/api/plan \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"modelo":"golf-gti-mk5","presupuesto":4000,"objetivos":["drift","estetica"]}'
# HTTP/1.1 402 Payment Required
```

**Nadie puede darse la suscripción a sí mismo.** No existe ninguna ruta que acepte un
"ya he pagado" viniendo del cliente: el estado solo lo escribe el webhook de la pasarela.
Hay un test que lo comprueba intentando justamente eso.

**Cómo se paga.** `POST /api/suscripcion/checkout` devuelve la URL a la que hay que
mandar al usuario. Hay dos pasarelas y la que se usa depende de si hay claves:

- **Stripe**, cuando existe `STRIPE_SECRET_KEY`. Se habla con su API por HTTP, sin añadir
  su librería. Su webhook llega firmado con HMAC y se comprueba, incluido que la entrega
  no sea vieja: si no, capturar una entrega válida permitiría reenviarla para revivir una
  suscripción cancelada.
- **Simulada**, cuando no hay claves. Marca al usuario como suscrito sin cobrar nada, para
  poder probar el flujo en cualquier ordenador. Con Stripe configurado, esa puerta
  devuelve 404: si no, sería la forma de suscribirse gratis.

**El código maestro.** `POST /api/suscripcion/codigo` abre el plan completo al instante,
sin pasar por ninguna pasarela. Sirve para enseñar la aplicación sin montar una tarjeta de
prueba. El código vive en `JONDA_CODIGO_MAESTRO`, nunca escrito en el fuente: este
repositorio es público. Si la variable está vacía la puerta no existe y la ruta devuelve
404, y entonces la interfaz ni enseña el campo. Quien entra así queda anotado con proveedor
`codigo`, así que en la base se distingue de quien pagó. La pasarela simulada exige el
mismo código, porque sin cobro de por medio sería un botón que regala la herramienta a
cualquiera que llegue a esa pantalla.

```bash
# el ciclo entero con la pasarela simulada
curl -X POST http://localhost:3001/api/auth/registro -H "Content-Type: application/json" \
  -d '{"correo":"prueba@jondasiviz.es","contrasena":"contrasena-larga"}'

curl -X POST http://localhost:3001/api/suscripcion/checkout -H "Authorization: Bearer $TOKEN"
# la pasarela simulada pide el código maestro, igual que /api/suscripcion/codigo
curl -X POST http://localhost:3001/api/suscripcion/simulada/confirmar   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"   -d '{"codigo":"'"$JONDA_CODIGO_MAESTRO"'"}'
```

**Para cobrar de verdad** hacen falta tres variables de entorno y nada de código:

```bash
STRIPE_SECRET_KEY=sk_test_...      # de prueba: sk_test_, real: sk_live_
STRIPE_WEBHOOK_SECRET=whsec_...
JONDA_URL=https://tu-dominio        # a dónde vuelve el navegador tras pagar
```

La clave secreta vive solo en el servidor. **Nunca en el repositorio ni dentro de la
aplicación de escritorio**, porque cualquiera puede abrir el ejecutable y sacarla.

Y antes de cobrar a personas reales hace falta lo que no es código: una cuenta de Stripe
verificada a nombre de alguien con su entidad fiscal, condiciones de uso, política de
privacidad y cumplimiento de RGPD, porque a partir de ahí se guardan datos personales.

## 5. Aplicación

Dos formas de la misma aplicación, con el mismo código:

- **Web**: `index.html` (portada) y `herramienta.html` (el planner en React).
- **Escritorio**: Tauri empaqueta ese mismo HTML para Windows, macOS y Linux. La ventana
  abre `index.html`, el mismo fichero que sirve la web. No hay una segunda versión.

```bash
npm run build             # compila las dos páginas
```

### La cuenta dentro de la aplicación

La app tiene lo mismo que la web: entrar, registrarse, salir, el perfil con su foto, la
suscripción y el código de acceso. Son los mismos componentes de React, no una segunda
versión, y para que funcionen hicieron falta tres cosas que no son obvias:

- **A qué servidor se le pide.** En la web la página y la API comparten origen: en
  desarrollo por el puente de Vite y en producción por el servidor que haya delante. En
  la app no hay ni una cosa ni la otra, porque la ventana carga los ficheros por el
  protocolo de Tauri, así que `/api/auth/yo` no lleva a ningún sitio. Lo resuelve
  `raizApi()` en `src/ui/entorno.ts`: dentro de la app apunta a `http://localhost:3001`,
  o a lo que diga `VITE_JONDA_API` al compilar.
- **CORS.** Al llamar desde otro origen el navegador pregunta antes, y esa pregunta se
  contesta en `src/api/servidor.ts`. Tiene que dejar pasar la cabecera `Authorization`, o
  no se puede mandar la sesión, y el método `PATCH`, que es con el que se guarda el
  perfil. Lo cubre `tests/cors.test.ts`, porque es un fallo que no se ve: a `curl` la API
  le contesta igual de bien con las cabeceras mal puestas.
- **La CSP de Tauri**, en `src-tauri/tauri.conf.json`. Sin `connect-src` la ventana no
  puede llamar a ningún sitio, por mucho que el código lo intente.

La sesión viaja distinto según dónde: cookie httpOnly en la web, cabecera `Authorization`
en la app. Por eso la API contesta `Access-Control-Allow-Origin: *` y **nunca** acepta
credenciales: el token está guardado en el origen de la app y otra página no puede
leerlo, así que abrir el origen no le sirve de nada a nadie. Con cookies sería al revés y
habría que ir nombrando orígenes uno a uno.

**Lo que la app necesita para que la cuenta funcione es que la API esté levantada** en
esa misma máquina (`npm run api`) o que se haya compilado con `VITE_JONDA_API` apuntando a
una API publicada. Sin ninguna de las dos, la app sigue funcionando entera en modo
gratuito con el catálogo empaquetado, que es como iba siempre.

La única parte que no cabe dentro de la app es la **pasarela simulada**: manda a
`pago-simulado.html`, que lo sirve la web, así que necesita la web levantada. El código de
acceso no tiene ese problema y se resuelve entero dentro de la ventana. Con Stripe de
verdad tampoco lo hay: el pago se abre en el navegador del sistema.

Los instaladores se bajan de las releases del repositorio.

## 6. GitHub

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
