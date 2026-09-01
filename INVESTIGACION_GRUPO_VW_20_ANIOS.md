# Grupo Volkswagen, 20 años (2006-2026) — investigación para ampliar JondaSiviz

Documento de trabajo previo al volcado. Aquí está el mapa completo: qué hay hoy, qué
marcas y modelos entran, qué chasis y qué motores hacen falta, qué piezas faltan por
plataforma y en qué orden se aplica todo sin romper la ingesta.

**Alcance acordado**: marcas Volkswagen, SEAT, Cupra, Škoda y Audi. Rango 2006-2026.
Modelos **y** catálogo de piezas completo. Porsche, Bentley y Lamborghini quedan fuera:
van sobre MSB, MMB y plataformas propias que no comparten nada con lo que hay montado.

**Nada de este documento toca todavía el código.** Es la revisión previa.

---

## 1. Lo que hay hoy

Punto de partida, verificado en el repo a 1 de septiembre de 2026.

| Cosa | Cuánto | Dónde |
|---|---|---|
| Modelos | 26 | `src/data/models.json`, `vault/Modelos/` |
| Piezas | 98 (catálogo v0.2.0) | `src/data/catalog.json`, `vault/Piezas/` |
| Plataformas de motor | 13 | `types.ts` + `catalog.ts` (lista blanca cerrada) |
| Chasis | 7 | `types.ts` + `catalog.ts` |
| Categorías | 11 | admisión, escape, turbo, gestión, suspensión, transmisión, frenos, dirección, seguridad, ruedas, estética |
| Grupos exclusivos | 11 | intercooler, admision-filtro, remap, turbo-principal, altura, downpipe, embrague, diferencial, frenos-delanteros, llantas, jaula |
| Marcas de proveedor | 48 | `src/data/brands.json`, `vault/Marcas/` |
| Notas del vault | 215 | 0 enlaces rotos, 0 duplicados, 0 aislados |

**Los 26 modelos actuales**: Corrado VR6, Golf Mk4 1.8T, Golf GTI Mk5, Golf GTD Mk6,
Golf GTI Mk7, Golf R Mk7, Golf Mk7 1.6 TDI, Scirocco R, Polo GTI 6C, los seis GTI del
Golf 8 (Mk8, Clubsport Mk8, Clubsport 45, Mk8.5, Clubsport Mk8.5, Edition 50), los seis
R (Mk8, Variant Mk8, 333 Limited Edition, 20 Years, Mk8.5, Variant Mk8.5), los dos GTD
(Mk8, Mk8.5) y los tres SUV/berlina R (T-Roc R, Tiguan R, Arteon R).

**Las 13 plataformas de motor**: `1.8T-20v`, `EA113`, `EA888`, `VR6`, `TDI`, `EA888-evo4`,
`EA211`, `EA211-evo`, `EA211-PHEV`, `EA288`, `EA288-evo`, `EA288-16`, `MEB`.

**Los 7 chasis**: `A2`, `PQ25`, `PQ34`, `PQ35`, `MQB`, `MQB Evo`, `MEB`.

**Dónde está flojo hoy** (medido con `npm run probar -- --matriz`): el Mk5 sobre EA113
tiene 59 piezas compatibles y un Golf 8 solo 26. Faltan seguridad, estética y dirección
para MQB Evo. `EA211`, `EA211-evo`, `EA211-PHEV` y `MEB` tienen piezas en el catálogo
pero **ningún modelo que las use**.

---

## 2. El principio que hace esto viable

Trescientos coches no son trescientos catálogos. En este modelo de datos **una pieza
cuelga de una plataforma de motor y de un chasis, nunca de un modelo**:

- Lo que va colgado del motor (admisión, escape, turbo, gestión) se define por
  `plataformas` y lleva `chasis: []`, que significa "cualquiera".
- Lo que va colgado del coche (suspensión, frenos, dirección, ruedas, estética,
  seguridad) se define por `chasis` y no depende del motor.

Un Golf 8 GTI, un León KL Cupra, un Octavia IV RS y un A3 8Y S3 son **el mismo motor
EA888 evo4 sobre el mismo chasis MQB Evo**. Comparten el 90% de las piezas. Añadir los
tres coches nuevos cuesta tres fichas de modelo, no tres catálogos.

Por eso el crecimiento real es:

| | Hoy | Tras el volcado | Crecimiento |
|---|---|---|---|
| Modelos | 26 | ~250 | ×10 |
| Plataformas de motor | 13 | 24 | +11 |
| Chasis | 7 | 16 | +9 |
| Piezas | 98 | ~250 | ×2,5 |

Las piezas crecen ×2,5 mientras los modelos crecen ×10, y eso es exactamente lo que
tiene que pasar si el modelo de datos está bien planteado.

---

## 3. Cambios en el modelo de datos

Esto va primero. La lista de plataformas es **una lista blanca cerrada que vive por
duplicado**: en el tipo `Plataforma` de `src/engine/types.ts` y en la constante
`PLATAFORMAS` de `src/engine/catalog.ts`. Si una pieza o un modelo menciona algo que no
esté en las dos, `npm run vault:ingest` falla con "plataforma desconocida". Lo mismo con
`CHASIS`, `EQUIPAMIENTOS`, `TRACCIONES` y `CATEGORIAS`.

### 3.1 Chasis: de 7 a 16

| Chasis | Años | Quién lo usa | Estado |
|---|---|---|---|
| `A2` | 1988-1995 | Corrado | ya está (legado) |
| `PQ34` | 1997-2006 | Golf IV, Bora, A3 8L, León 1M, Octavia I, TT 8N, New Beetle | ya está |
| `PQ35` | 2003-2017 | Golf V/VI, Scirocco III, A3 8P, TT 8J, León 1P, Altea, Octavia II, Eos, Beetle 5C | ya está |
| `PQ25` | 2008-2021 | Polo 6R/6C, Ibiza 6J, Fabia 5J/NJ, A1 8X | ya está |
| `MQB` | 2012-2024 | Golf VII, León 5F, Octavia III, A3 8V, Tiguan AD, Passat B8, Arteon, T-Roc, Touran, Q3 F3 | ya está |
| `MQB Evo` | 2019- | Golf VIII/8.5, León KL, Octavia IV, A3 8Y, Formentor, Tiguan Mk3, Passat B9 | ya está |
| `MEB` | 2019- | ID.3/4/5/7/Buzz, Enyaq, Elroq, Born, Tavascan, Q4 e-tron | ya está |
| **`PQ24`** | 2001-2010 | Polo 9N/9N3, Ibiza 6L, Fabia 6Y, Fox | **nuevo** |
| **`PQ46`** | 2005-2016 | Passat B6/B7, Passat CC, Superb II | **nuevo** |
| **`NSF`** | 2011-2023 | up!, Mii, Citigo | **nuevo** |
| **`MQB-A0`** | 2017- | Polo AW, Ibiza KJ, Arona, T-Cross, Taigo, Fabia NW, Scala, Kamiq, A1 GB | **nuevo** |
| **`MLB`** | 2007-2016 | A4 B8, A5 8T, Q5 8R, A6 C7, A7 4G | **nuevo** |
| **`MLB Evo`** | 2015- | A4 B9, A5 F5, A6 C8, A7 4K, A8 D5, Q5 FY, Q7 4M, Q8, Touareg CR | **nuevo** |
| **`PL71`** | 2002-2018 | Touareg 7L/7P, Q7 4L | **nuevo** |
| **`PPE`** | 2024- | Q6 e-tron, A6 e-tron | **nuevo** |
| **`J1`** | 2021- | e-tron GT, RS e-tron GT | **nuevo** |

Nota sobre `MQB-A0`: se separa de `MQB` a propósito. Comparten filosofía pero no
comparten brazos, buje ni diámetro de disco, y hoy el motor daría por compatibles unos
coilovers de Golf VII con un Polo AW. Es exactamente el fallo que se corrigió al
introducir el campo `chasis`.

### 3.2 Plataformas de motor: de 13 a 24

| Plataforma | Qué es | Potencias típicas | Estado |
|---|---|---|---|
| `1.8T-20v` | 1.8 20v turbo | 150-225 CV | ya está |
| `VR6` | VR6 2.8/3.2/3.6 | 174-300 CV | ya está |
| `EA113` | 2.0 TFSI 2004-2010 | 200-271 CV | ya está |
| `EA888` | 2.0 TSI gen1/2/3 | 200-310 CV | ya está, **ver 3.3** |
| `EA888-evo4` | 2.0 TSI evo4 | 245-333 CV | ya está |
| `EA211` | 1.0/1.2/1.4 TSI | 90-150 CV | ya está |
| `EA211-evo` | 1.5 TSI evo/evo2 | 130-150 CV | ya está |
| `EA211-PHEV` | 1.4/1.5 TSI híbrido enchufable | 204-272 CV sistema | ya está |
| `TDI` | 1.9/2.0 TDI bomba-inyector (PD) | 90-170 CV | ya está |
| `EA288` | 2.0 TDI common rail 2012-2020 | 110-190 CV | ya está |
| `EA288-evo` | 2.0 TDI evo, doble SCR | 116-200 CV | ya está |
| `EA288-16` | 1.6 TDI evo | 90-116 CV | ya está |
| `MEB` | Tracción eléctrica MEB | 148-340 CV | ya está |
| **`EA111`** | 1.2/1.4 TSI, el 1.4 twincharger | 105-180 CV | **nuevo** |
| **`EA189`** | 2.0 TDI common rail 2008-2015 | 110-184 CV | **nuevo** |
| **`EA189-16`** | 1.6 TDI common rail | 90-105 CV | **nuevo** |
| **`EA855`** | 2.5 TFSI cinco cilindros | 340-407 CV | **nuevo** |
| **`EA837`** | 3.0 TFSI compresor volumétrico | 290-354 CV | **nuevo** |
| **`EA839`** | 3.0 TFSI turbo | 340-450 CV | **nuevo** |
| **`EA825`** | 4.0 TFSI V8 biturbo | 450-640 CV | **nuevo** |
| **`EA897`** | 3.0 TDI V6 | 204-347 CV | **nuevo** |
| **`EA824`** | 4.0 TDI V8 | 435 CV | **nuevo** |
| **`PPE`** | Tracción eléctrica PPE 800 V | 306-517 CV | **nuevo** |
| **`J1`** | Tracción eléctrica J1 800 V | 476-646 CV | **nuevo** |

### 3.3 Dos decisiones que hay que tomar antes de volcar

**(a) Partir `EA888`.** Hoy una sola plataforma cubre el 2.0 TSI de 2008 a 2020, y son
tres motores distintos: gen1/gen2 con cadena y problema de consumo de aceite, y gen3 con
correa, inyección mixta y culata con colector integrado. Un turbo híbrido IS38 de gen3 no
monta en un gen2, y hoy el motor los daría por compatibles.

Propuesta: `EA888-gen2` (2008-2013) y `EA888-gen3` (2012-2020), retirando `EA888`.
Es una **migración con ruptura**: hay que reasignar los cinco modelos actuales que la
usan (Golf GTI Mk7, Golf R Mk7, T-Roc R, Tiguan R, Arteon R — los cinco a `EA888-gen3`)
y todas las piezas que la mencionan. Si prefieres no romper nada ahora, la alternativa es
dejar `EA888` como está y meter solo `EA888-gen2` para lo viejo, aceptando que `EA888`
pase a significar gen3 de facto. Lo recomendable es la partición limpia.

**(b) El Golf VI R y el Scirocco R.** Su 2.0 TSI (CDLA/CDLB) es de familia discutida
según la fuente: unas lo clasifican como EA113 evolucionado y otras como EA888 gen1.
Hoy en el repo el Scirocco R está como `EA888`. **Lo dejo marcado como decisión abierta**
y no lo cambio por mi cuenta: afecta a qué turbo y qué calibraciones se le ofrecen, y
prefiero que lo confirmes con una fuente de taller antes de tocarlo.

### 3.4 Tracción: falta `trasera`

`Traccion` es hoy `"delantera" | "total"`. **Es un fallo bloqueante para MEB**: el ID.3,
el ID.4 Pro, el Born y el Enyaq de acceso son **propulsión trasera**. Sin ese valor no se
pueden fichar bien, y el campo `traccion` de las piezas (que existe para decir dónde tiene
sentido un autoblocante o un kit de ángulo) queda mintiendo.

Propuesta: `"delantera" | "trasera" | "total"`.

### 3.5 Propulsión: añadir `mhev`

`Propulsion` es hoy `"combustion" | "phev" | "bev"`. Falta la hibridación ligera de 48 V,
que en el grupo va desde el EA888 evo4 hasta los V6 y V8 de Audi. No es un detalle
estético: el sistema de 48 V condiciona la gestión y algunas conversiones.

Propuesta: `"combustion" | "mhev" | "phev" | "bev"`.

### 3.6 Equipamiento: de 7 a 15

Los valores de `Equipamiento` son los que responden a "¿esta pieza sobra, hace falta o
choca?". Con Audi dentro hacen falta ocho más.

| Valor | Qué es | Para qué sirve en el motor |
|---|---|---|
| `dcc` | suspensión adaptativa VW | ya está |
| `vaq` | diferencial delantero vectorial | ya está |
| `diferencial-trasero` | eje trasero vectorial | ya está |
| `frenos-grandes` | pinzas y discos de 357 mm o más | ya está |
| `dsg` | cambio de doble embrague | ya está |
| `gpf` | filtro de partículas de gasolina | ya está |
| `dpf` | filtro de partículas diésel | ya está |
| **`magnetic-ride`** | amortiguación magnetorreológica de Audi | equivalente Audi de `dcc`: un coilover convencional la anula |
| **`haldex`** | tracción total Haldex transversal | condiciona palieres, embrague y mapa de reparto |
| **`torsen`** | quattro longitudinal permanente | otro mundo de transmisión: nada de Haldex le vale |
| **`act`** | desactivación de cilindros | choca con calibraciones que no la contemplan |
| **`scr-adblue`** | postratamiento diésel Euro 6 con AdBlue | un downpipe sin DPF lo deja inservible y no homologable |
| **`hibridacion-48v`** | red de 48 V mild hybrid | limita qué gestiones y qué alternadores valen |
| **`suspension-neumatica`** | neumática de serie | incompatible con coilovers convencionales sin kit de conversión |
| **`frenos-ceramicos`** | discos carbono-cerámicos de fábrica | un big brake kit convencional es un downgrade |

`suspension-neumatica` y `frenos-ceramicos` existen sobre todo para que el motor pueda
decir **"esta pieza no te aporta nada, ya llevas algo mejor"** vía `sustituye`, que es
justo el aviso que hoy no sabría dar con un A6 o un RS6.

---

## 4. Mapa de motores por chasis

Qué motor aparece en qué chasis. Esta tabla es la que evita las compatibilidades falsas:
si un motor y un chasis no se cruzan aquí, no existe ese coche.

| Motor | Chasis en los que aparece |
|---|---|
| `1.8T-20v` | PQ34, PQ35 (León 1P Cupra R), PQ24 (Ibiza 6L Cupra) |
| `VR6` | A2, PQ34, PQ35, PQ46 (Passat R36) |
| `EA113` | PQ35 |
| `EA888-gen2` | PQ35, PQ46, MLB |
| `EA888-gen3` | MQB, MLB, MLB Evo |
| `EA888-evo4` | MQB Evo, MLB Evo |
| `EA111` | PQ24, PQ25, PQ35, PQ46 |
| `EA211` | PQ25, MQB, MQB-A0, NSF |
| `EA211-evo` | MQB, MQB-A0, MQB Evo |
| `EA211-PHEV` | MQB, MQB Evo |
| `TDI` | PQ34, PQ35, PQ24, PQ46 |
| `EA189` / `EA189-16` | PQ35, PQ46, MQB, PQ25 |
| `EA288` / `EA288-16` | MQB, MQB-A0, PQ25 |
| `EA288-evo` | MQB Evo, MQB |
| `EA855` | PQ35 (RS3 8P, TT RS 8J), MQB (RS3 8V, TT RS 8S), MQB Evo (RS3 8Y) |
| `EA837` | MLB |
| `EA839` | MLB Evo |
| `EA825` | MLB Evo, PL71 |
| `EA897` | MLB, MLB Evo, PL71 |
| `EA824` | MLB Evo |
| `MEB` | MEB |
| `PPE` | PPE |
| `J1` | J1 |

---

## 5. Modelos por marca

Columnas: años de producción, chasis, plataforma de motor, detalle, tracción y el
equipamiento de serie que condiciona el montaje. Los marcados **(ya)** están en el repo.

### 5.1 Volkswagen — Golf

| Modelo | Años | Chasis | Motor | Detalle | Tracción | De serie |
|---|---|---|---|---|---|---|
| Golf IV 1.8T **(ya)** | 1997-2003 | PQ34 | `1.8T-20v` | 1.8T 150-180 CV | delantera | — |
| Golf IV R32 | 2002-2004 | PQ34 | `VR6` | 3.2 VR6 241 CV | total | haldex, dsg |
| Golf V GTI **(ya)** | 2004-2008 | PQ35 | `EA113` | 2.0 TFSI 200 CV | delantera | — |
| Golf V GTI Edition 30 | 2006-2008 | PQ35 | `EA113` | 2.0 TFSI 230 CV | delantera | — |
| Golf V GTI Pirelli | 2007-2008 | PQ35 | `EA113` | 2.0 TFSI 230 CV | delantera | — |
| Golf V R32 | 2005-2008 | PQ35 | `VR6` | 3.2 VR6 250 CV | total | haldex, dsg |
| Golf V GT Sport | 2007-2008 | PQ35 | `EA111` | 1.4 TSI twincharger 170 CV | delantera | — |
| Golf V GT TDI | 2006-2008 | PQ35 | `TDI` | 2.0 TDI PD 170 CV | delantera | dpf |
| Golf VI GTI | 2009-2013 | PQ35 | `EA888-gen2` | 2.0 TSI 210 CV | delantera | — |
| Golf VI GTI Edition 35 | 2011-2013 | PQ35 | `EA888-gen2` | 2.0 TSI 235 CV | delantera | — |
| Golf VI R | 2009-2013 | PQ35 | *ver 3.3(b)* | 2.0 TSI 270 CV | total | haldex, dsg |
| Golf VI GTD **(ya, corregir)** | 2009-2013 | PQ35 | `EA189` | 2.0 TDI CR 170 CV | delantera | dpf |
| Golf VII GTI | 2013-2017 | MQB | `EA888-gen3` | 2.0 TSI 220 / 230 Performance | delantera | vaq (Performance) |
| Golf VII GTI Clubsport | 2016-2017 | MQB | `EA888-gen3` | 2.0 TSI 265 CV, 290 overboost | delantera | vaq |
| Golf VII GTI Clubsport S | 2016 | MQB | `EA888-gen3` | 2.0 TSI 310 CV | delantera | vaq, frenos-grandes |
| Golf VII GTI **(ya)** | 2013-2020 | MQB | `EA888-gen3` | ficha actual del repo | delantera | — |
| Golf VII.5 GTI Performance | 2017-2020 | MQB | `EA888-gen3` | 2.0 TSI 245 CV | delantera | vaq |
| Golf VII.5 GTI TCR | 2019-2020 | MQB | `EA888-gen3` | 2.0 TSI 290 CV | delantera | vaq, frenos-grandes |
| Golf VII R **(ya)** | 2014-2020 | MQB | `EA888-gen3` | 2.0 TSI 300 / 310 CV | total | haldex, dsg, dcc |
| Golf VII R Variant | 2015-2020 | MQB | `EA888-gen3` | 2.0 TSI 300 CV | total | haldex, dsg |
| Golf VII GTD | 2013-2020 | MQB | `EA288` | 2.0 TDI 184 CV | delantera | dpf |
| Golf VII GTE | 2014-2020 | MQB | `EA211-PHEV` | 1.4 TSI PHEV 204 CV sistema | delantera | dsg |
| Golf VII 1.6 TDI **(ya)** | 2013-2020 | MQB | `EA288-16` | 1.6 TDI 105-115 CV | delantera | dpf |
| Golf VIII, los 14 **(ya)** | 2019-2026 | MQB Evo | `EA888-evo4` / `EA288-evo` | GTI, Clubsport, R, GTD | según ficha | gpf/dpf, dsg |
| Golf VIII GTE | 2020-2026 | MQB Evo | `EA211-PHEV` | 1.4 TSI PHEV 245 CV sistema | delantera | dsg, gpf |
| Golf VIII 1.0 / 1.5 TSI | 2019-2026 | MQB Evo | `EA211-evo` | 110-150 CV | delantera | gpf, act |
| Golf VIII 2.0 TDI | 2019-2026 | MQB Evo | `EA288-evo` | 115-150 CV | delantera | dpf, scr-adblue |

### 5.2 Volkswagen — resto de la gama

| Modelo | Años | Chasis | Motor | Detalle | Tracción | De serie |
|---|---|---|---|---|---|---|
| Polo 9N GTI | 2006-2009 | PQ24 | `1.8T-20v` | 1.8T 150, Cup Edition 180 | delantera | — |
| Polo 6R GTI | 2010-2014 | PQ25 | `EA111` | 1.4 TSI twincharger 180 CV | delantera | dsg |
| Polo 6C GTI **(ya)** | 2015-2017 | PQ25 | `EA888-gen3` | 1.8 TSI 192 CV | delantera | — |
| Polo 6R/6C R WRC | 2013-2016 | PQ25 | `EA888-gen3` | 2.0 TSI 220 CV | delantera | — |
| Polo AW GTI | 2018-2026 | MQB-A0 | `EA888-gen3` | 2.0 TSI 200 / 207 CV | delantera | dsg, gpf |
| Polo AW 1.0 TSI | 2017-2026 | MQB-A0 | `EA211` / `EA211-evo` | 95-115 CV | delantera | gpf |
| Scirocco III | 2008-2017 | PQ35 | `EA111` / `EA888-gen2` | 1.4 TSI 122-160, 2.0 TSI 200-210 | delantera | — |
| Scirocco R **(ya)** | 2009-2017 | PQ35 | *ver 3.3(b)* | 2.0 TSI 265 CV | delantera | — |
| Scirocco TDI | 2008-2017 | PQ35 | `EA189` | 2.0 TDI 140 / 170 CV | delantera | dpf |
| Passat B6 | 2005-2010 | PQ46 | `EA113` / `TDI` / `EA189` | 1.4-3.6 | delantera / total | — |
| Passat R36 | 2007-2010 | PQ46 | `VR6` | 3.6 VR6 300 CV | total | haldex, dsg |
| Passat CC | 2008-2016 | PQ46 | `EA888-gen2` / `EA189` | 1.8-3.6 | delantera / total | — |
| Passat B7 | 2010-2015 | PQ46 | `EA888-gen2` / `EA189` | 1.4-2.0 | delantera / total | dpf |
| Passat B8 | 2014-2022 | MQB | `EA888-gen3` / `EA288` | 1.4-2.0, biturbo TDI 240 | delantera / total | dsg, dpf |
| Passat B8 GTE | 2015-2022 | MQB | `EA211-PHEV` | 1.4 TSI PHEV 218 CV | delantera | dsg |
| Passat B9 | 2023-2026 | MQB Evo | `EA888-evo4` / `EA288-evo` | 150-272 | delantera / total | dsg, gpf/dpf |
| Arteon | 2017-2024 | MQB | `EA888-gen3` / `EA288` | 190-280 | delantera / total | dsg |
| Arteon R **(ya)** | 2020-2024 | MQB | `EA888-gen3` | 2.0 TSI 320 CV | total | dcc, diferencial-trasero, dsg, gpf |
| T-Roc | 2017-2026 | MQB | `EA211-evo` / `EA888-gen3` | 110-190 | delantera / total | gpf |
| T-Roc R **(ya)** | 2019-2024 | MQB | `EA888-gen3` | 2.0 TSI 300 CV | total | haldex, dsg, gpf |
| Tiguan AD | 2016-2023 | MQB | `EA888-gen3` / `EA288` | 130-245 | delantera / total | dsg |
| Tiguan R **(ya)** | 2021-2024 | MQB | `EA888-gen3` | 2.0 TSI 320 CV | total | dcc, diferencial-trasero, dsg |
| Tiguan Mk3 | 2024-2026 | MQB Evo | `EA888-evo4` / `EA288-evo` | 130-265, eHybrid | delantera / total | dsg, gpf/dpf |
| Touran | 2015-2026 | MQB | `EA211-evo` / `EA288` | 110-190 | delantera | dpf |
| Beetle 5C Turbo | 2011-2019 | PQ35 | `EA888-gen2` | 2.0 TSI 200-220 CV | delantera | — |
| up! GTI | 2018-2023 | NSF | `EA211` | 1.0 TSI 115 CV | delantera | — |
| up! | 2011-2023 | NSF | `EA211` | 60-90 CV | delantera | — |
| Touareg 7L | 2002-2010 | PL71 | `EA897` / `V8-FSI` | 3.0 TDI, 4.2 FSI, V10 TDI | total | torsen, suspension-neumatica |
| Touareg 7P | 2010-2018 | PL71 | `EA897` | 3.0 TDI, 3.0 TFSI híbrido | total | torsen, suspension-neumatica |
| Touareg CR | 2018-2026 | MLB Evo | `EA897` / `EA825` | 3.0 TDI, R eHybrid 462 | total | torsen, suspension-neumatica, dcc |
| ID.3 | 2019-2026 | MEB | `MEB` | 148-231 CV | **trasera** | — |
| ID.3 GTX | 2023-2026 | MEB | `MEB` | 286-326 CV | **trasera** | frenos-grandes |
| ID.4 / ID.5 | 2020-2026 | MEB | `MEB` | 170-286 CV | trasera / total | — |
| ID.4 / ID.5 GTX | 2021-2026 | MEB | `MEB` | 299-340 CV | total | frenos-grandes |
| ID.7 | 2023-2026 | MEB | `MEB` | 286-340 CV | trasera / total | dcc |
| ID.Buzz | 2022-2026 | MEB | `MEB` | 204-340 CV | trasera / total | — |

Los industriales (Caddy, Transporter, Crafter, Amarok) quedan fuera: no son coches de
preparación y meterlos ensucia el grafo sin aportar nada al presupuesto.

### 5.3 SEAT y Cupra

| Modelo | Años | Chasis | Motor | Detalle | Tracción | De serie |
|---|---|---|---|---|---|---|
| Ibiza 6L Cupra | 2004-2008 | PQ24 | `1.8T-20v` | 1.8T 180 CV | delantera | — |
| Ibiza 6L FR TDI | 2004-2008 | PQ24 | `TDI` | 1.9 TDI PD 160 CV | delantera | — |
| Ibiza 6J FR | 2008-2017 | PQ25 | `EA111` | 1.4 TSI 150 CV | delantera | dsg |
| Ibiza 6J Cupra | 2009-2015 | PQ25 | `EA111` | 1.4 TSI twincharger 180 CV | delantera | dsg |
| Ibiza 6J Cupra | 2015-2016 | PQ25 | `EA888-gen3` | 1.8 TSI 192 CV | delantera | — |
| Ibiza KJ FR | 2017-2026 | MQB-A0 | `EA211-evo` | 1.5 TSI 150 CV | delantera | gpf, act |
| León 1P FR | 2005-2012 | PQ35 | `EA113` | 2.0 TFSI 200 / 211 CV | delantera | — |
| León 1P Cupra | 2006-2012 | PQ35 | `EA113` | 2.0 TFSI 240 CV | delantera | — |
| León 1P Cupra R | 2010-2012 | PQ35 | `EA113` | 2.0 TFSI 265 CV | delantera | frenos-grandes |
| León 1P FR TDI | 2006-2012 | PQ35 | `EA189` | 2.0 TDI CR 170 CV | delantera | dpf |
| León 5F Cupra | 2014-2017 | MQB | `EA888-gen3` | 2.0 TSI 265 / 280 / 290 CV | delantera | vaq, frenos-grandes |
| León 5F Cupra 300 | 2017-2020 | MQB | `EA888-gen3` | 2.0 TSI 300 CV | delantera / total | vaq, dsg |
| León 5F Cupra R | 2017-2018 | MQB | `EA888-gen3` | 2.0 TSI 310 CV | delantera | vaq, frenos-grandes |
| León 5F ST Cupra 4Drive | 2018-2020 | MQB | `EA888-gen3` | 2.0 TSI 300 CV | total | haldex, dsg |
| Cupra León KL | 2020-2026 | MQB Evo | `EA888-evo4` | 245 / 300 / 310 CV | delantera / total | vaq, dsg, gpf |
| Cupra León eHybrid | 2020-2026 | MQB Evo | `EA211-PHEV` | 245 / 272 CV sistema | delantera | dsg |
| Cupra Formentor VZ | 2020-2026 | MQB Evo | `EA888-evo4` | 245 / 310 CV | delantera / total | dsg, gpf |
| Cupra Formentor VZ5 | 2021-2022 | MQB Evo | `EA855` | 2.5 TFSI 390 CV | total | haldex, dsg, frenos-grandes |
| Cupra Ateca | 2018-2024 | MQB | `EA888-gen3` | 2.0 TSI 300 CV | total | haldex, dsg |
| Cupra Terramar | 2024-2026 | MQB Evo | `EA888-evo4` | 204-272, eHybrid | delantera / total | dsg |
| Cupra Born | 2021-2026 | MEB | `MEB` | 204-326 CV | **trasera** | — |
| Cupra Tavascan | 2024-2026 | MEB | `MEB` | 286-340 CV | trasera / total | — |
| Arona / Altea | 2004-2026 | PQ35 / MQB-A0 | `EA211` / `EA211-evo` | gama de acceso | delantera | — |

### 5.4 Škoda

| Modelo | Años | Chasis | Motor | Detalle | Tracción | De serie |
|---|---|---|---|---|---|---|
| Fabia RS 6Y | 2003-2007 | PQ24 | `TDI` | 1.9 TDI PD 130 CV | delantera | — |
| Fabia RS 5J | 2010-2014 | PQ25 | `EA111` | 1.4 TSI twincharger 180 CV | delantera | dsg |
| Fabia NW | 2021-2026 | MQB-A0 | `EA211-evo` | 95-150 CV | delantera | gpf |
| Octavia II RS | 2005-2013 | PQ35 | `EA113` | 2.0 TFSI 200 CV | delantera | — |
| Octavia II RS TDI | 2006-2013 | PQ35 | `EA189` | 2.0 TDI CR 170 CV | delantera | dpf |
| Octavia III RS | 2013-2019 | MQB | `EA888-gen3` | 2.0 TSI 220 / 230 / 245 CV | delantera | vaq (245) |
| Octavia III RS TDI | 2013-2019 | MQB | `EA288` | 2.0 TDI 184 CV | delantera / total | dpf |
| Octavia IV RS | 2020-2026 | MQB Evo | `EA888-evo4` | 2.0 TSI 245 CV | delantera | vaq, dsg, gpf |
| Octavia IV RS iV | 2020-2023 | MQB Evo | `EA211-PHEV` | 1.4 TSI PHEV 245 CV | delantera | dsg |
| Octavia IV RS TDI | 2020-2026 | MQB Evo | `EA288-evo` | 2.0 TDI 200 CV | delantera / total | dpf, scr-adblue |
| Superb II | 2008-2015 | PQ46 | `EA888-gen2` / `EA189` | 1.4-3.6 | delantera / total | — |
| Superb III | 2015-2023 | MQB | `EA888-gen3` / `EA288` | 150-280 | delantera / total | dsg |
| Superb III iV | 2019-2023 | MQB | `EA211-PHEV` | 1.4 TSI PHEV 218 CV | delantera | dsg |
| Superb IV | 2023-2026 | MQB Evo | `EA888-evo4` / `EA288-evo` | 150-265 | delantera / total | dsg |
| Kodiaq RS | 2019-2021 | MQB | `EA288` | 2.0 BiTDI 240 CV | total | haldex, dsg, dpf |
| Kodiaq RS | 2021-2024 | MQB | `EA888-gen3` | 2.0 TSI 245 CV | total | haldex, dsg, gpf |
| Kodiaq II | 2024-2026 | MQB Evo | `EA888-evo4` / `EA288-evo` | 150-265, iV | delantera / total | dsg |
| Karoq / Kamiq / Scala | 2017-2026 | MQB / MQB-A0 | `EA211-evo` / `EA288` | gama de acceso | delantera | gpf/dpf |
| Rapid | 2012-2019 | PQ25 | `EA111` / `EA211` | 86-125 CV | delantera | — |
| Citigo | 2011-2020 | NSF | `EA211` | 60-75 CV | delantera | — |
| Enyaq | 2021-2026 | MEB | `MEB` | 179-286 CV | **trasera** / total | — |
| Enyaq RS | 2022-2026 | MEB | `MEB` | 299-340 CV | total | frenos-grandes |
| Elroq | 2024-2026 | MEB | `MEB` | 170-299 CV | **trasera** / total | — |

### 5.5 Audi

| Modelo | Años | Chasis | Motor | Detalle | Tracción | De serie |
|---|---|---|---|---|---|---|
| A1 8X | 2010-2018 | PQ25 | `EA111` / `EA211` | 86-185 CV | delantera | dsg |
| S1 8X | 2014-2018 | PQ25 | `EA888-gen3` | 2.0 TFSI 231 CV | total | haldex, frenos-grandes |
| A1 GB | 2018-2026 | MQB-A0 | `EA211-evo` / `EA888-gen3` | 95-207 CV | delantera | gpf |
| A3 8P | 2003-2012 | PQ35 | `EA113` / `EA189` | 1.6-2.0 | delantera / total | — |
| S3 8P | 2006-2012 | PQ35 | `EA113` | 2.0 TFSI 265 CV | total | haldex, dsg |
| RS3 8P | 2011-2012 | PQ35 | `EA855` | 2.5 TFSI 340 CV | total | haldex, dsg, frenos-grandes |
| A3 8V | 2012-2020 | MQB | `EA888-gen3` / `EA288` | 1.0-2.0 | delantera / total | dsg |
| S3 8V | 2013-2020 | MQB | `EA888-gen3` | 2.0 TFSI 300 / 310 CV | total | haldex, dsg, magnetic-ride |
| RS3 8V | 2015-2020 | MQB | `EA855` | 2.5 TFSI 367 / 400 CV | total | haldex, dsg, frenos-grandes, magnetic-ride |
| A3 e-tron 8V | 2014-2020 | MQB | `EA211-PHEV` | 1.4 TFSI PHEV 204 CV | delantera | dsg |
| A3 8Y | 2020-2026 | MQB Evo | `EA888-evo4` / `EA288-evo` | 110-204 | delantera / total | dsg, gpf |
| S3 8Y | 2020-2026 | MQB Evo | `EA888-evo4` | 2.0 TFSI 310 / 333 CV | total | haldex, dsg, vaq |
| RS3 8Y | 2021-2026 | MQB Evo | `EA855` | 2.5 TFSI 400 CV | total | haldex, dsg, diferencial-trasero, frenos-grandes |
| TT 8J | 2006-2014 | PQ35 | `EA113` / `EA888-gen2` / `VR6` | 1.8-3.2 | delantera / total | haldex |
| TTS 8J | 2008-2014 | PQ35 | `EA113` | 2.0 TFSI 272 CV | total | haldex, dsg, magnetic-ride |
| TT RS 8J | 2009-2014 | PQ35 | `EA855` | 2.5 TFSI 340 / 360 CV | total | haldex, dsg, frenos-grandes |
| TT 8S | 2014-2023 | MQB | `EA888-gen3` | 180-230 | delantera / total | dsg |
| TTS 8S | 2014-2023 | MQB | `EA888-gen3` | 2.0 TFSI 310 CV | total | haldex, dsg, magnetic-ride |
| TT RS 8S | 2016-2023 | MQB | `EA855` | 2.5 TFSI 400 CV | total | haldex, dsg, frenos-grandes |
| A4 B8 / A5 8T | 2007-2016 | MLB | `EA888-gen2` / `EA897` | 1.8-3.0 | delantera / total | torsen |
| S4 B8 / S5 8T | 2008-2016 | MLB | `EA837` | 3.0 TFSI 333 CV | total | torsen, dsg |
| RS4 B8 / RS5 8T | 2012-2016 | MLB | `V8-FSI` | 4.2 FSI 450 CV | total | torsen, dsg, frenos-grandes |
| A4 B9 / A5 F5 | 2015-2026 | MLB Evo | `EA888-gen3` / `EA897` | 150-265 | delantera / total | torsen |
| S4 B9 / S5 F5 | 2016-2026 | MLB Evo | `EA839` | 3.0 TFSI 354 CV, TDI 347 | total | torsen, hibridacion-48v |
| RS4 B9 / RS5 F5 | 2017-2026 | MLB Evo | `EA839` | 2.9 TFSI biturbo 450 CV | total | torsen, frenos-grandes |
| A6 C7 / A7 4G | 2011-2018 | MLB | `EA888-gen3` / `EA897` | 190-333 | delantera / total | torsen, suspension-neumatica |
| S6 C7 / S7 4G | 2012-2018 | MLB | `EA825` | 4.0 TFSI 420 CV | total | torsen, suspension-neumatica |
| RS6 C7 / RS7 4G | 2013-2018 | MLB | `EA825` | 4.0 TFSI 560 / 605 CV | total | torsen, suspension-neumatica, frenos-ceramicos |
| A6 C8 / A7 4K | 2018-2026 | MLB Evo | `EA839` / `EA897` | 204-347 | delantera / total | torsen, hibridacion-48v |
| RS6 C8 / RS7 4K | 2019-2026 | MLB Evo | `EA825` | 4.0 TFSI 600 CV | total | torsen, suspension-neumatica, frenos-ceramicos, hibridacion-48v |
| A8 D4 / D5 | 2010-2026 | MLB / MLB Evo | `EA825` / `EA897` | 250-571 | total | torsen, suspension-neumatica |
| Q3 8U | 2011-2018 | PQ35 | `EA888-gen3` / `EA189` | 140-220 | delantera / total | haldex |
| RS Q3 8U | 2013-2018 | PQ35 | `EA855` | 2.5 TFSI 310 / 340 CV | total | haldex, dsg, frenos-grandes |
| Q3 F3 | 2018-2026 | MQB | `EA888-gen3` / `EA288` | 150-245 | delantera / total | dsg |
| RS Q3 F3 | 2019-2026 | MQB | `EA855` | 2.5 TFSI 400 CV | total | haldex, dsg, frenos-grandes |
| Q5 8R | 2008-2017 | MLB | `EA888-gen3` / `EA897` | 170-272 | total | torsen |
| SQ5 8R | 2012-2017 | MLB | `EA897` | 3.0 BiTDI 313 CV | total | torsen, dpf |
| Q5 FY | 2017-2026 | MLB Evo | `EA888-gen3` / `EA897` | 163-265 | total | torsen |
| SQ5 FY | 2017-2026 | MLB Evo | `EA839` | 3.0 TFSI 354 / TDI 341 | total | torsen, hibridacion-48v |
| Q7 4L | 2005-2015 | PL71 | `EA897` / `V8-FSI` | 3.0 TDI, 4.2 FSI, V12 TDI 500 | total | torsen, suspension-neumatica |
| Q7 4M | 2015-2026 | MLB Evo | `EA897` / `EA839` | 231-340 | total | torsen, suspension-neumatica |
| SQ7 4M | 2016-2026 | MLB Evo | `EA824` / `EA825` | 4.0 TDI 435, 4.0 TFSI 507 | total | torsen, suspension-neumatica, frenos-grandes |
| Q8 | 2018-2026 | MLB Evo | `EA839` / `EA897` | 231-340 | total | torsen, suspension-neumatica |
| SQ8 / RS Q8 | 2019-2026 | MLB Evo | `EA825` | 4.0 507 / 600 CV | total | torsen, suspension-neumatica, frenos-ceramicos |
| Q8 e-tron | 2018-2026 | MLB Evo | `MEB`* | 313-503 CV | total | suspension-neumatica |
| Q4 e-tron | 2021-2026 | MEB | `MEB` | 170-340 CV | **trasera** / total | — |
| Q6 e-tron | 2024-2026 | PPE | `PPE` | 306-517 CV | trasera / total | — |
| A6 e-tron | 2024-2026 | PPE | `PPE` | 286-503 CV | trasera / total | — |
| e-tron GT / RS | 2021-2026 | J1 | `J1` | 476 / 598 / 646 CV | total | suspension-neumatica, frenos-ceramicos |

\* El Q8 e-tron (antes e-tron 55) no va sobre MEB de verdad: usa una plataforma eléctrica
propia derivada de MLB Evo. Se propone ficharlo con chasis `MLB Evo` y dejar el motor
`MEB` como aproximación, **o** abrir una plataforma `MLB-e`. Lo dejo como decisión abierta
porque hoy no hay ni una pieza para él y la elección no bloquea nada.

### 5.6 Casos aparte

- **Audi R8** (2006-2024): va sobre la plataforma modular de aluminio compartida con
  Lamborghini, con V8 4.2 FSI y V10 5.2 FSI. Ni el chasis ni los motores tienen nada que
  ver con el resto. Recomiendo **dejarlo fuera del primer volcado**: mete dos chasis y dos
  motores para un solo coche sin una sola pieza en el catálogo.
- **Audi Q8 e-tron**: ver la nota de la tabla.
- **SEAT Exeo** (2008-2013): es un A4 B7 recarrozado, plataforma PL46, que no usa nadie
  más en el rango. Mismo criterio que el R8: fuera del primer volcado.
- **Industriales y monovolúmenes** (Alhambra, Sharan, Caddy, Transporter, Crafter,
  Amarok): fuera, no son coches de preparación.

---

## 6. Piezas: qué falta y qué hay que añadir

### 6.1 Diagnóstico del catálogo actual

Las 98 piezas de hoy cubren bien dos sitios y mal todo lo demás.

| Plataforma de motor | Piezas hoy | Estado |
|---|---|---|
| `EA113` | 59 | completa: admisión, escape, turbo K04 y big turbo, gestión, alimentación |
| `EA888-evo4` | ~26 | media: motor sí, chasis MQB Evo muy corto |
| `1.8T-20v`, `VR6`, `TDI` | ~15 cada una | básica, heredada del Mk5 |
| `EA288`, `EA288-evo`, `EA288-16` | 5-8 | mínima |
| `EA211`, `EA211-evo`, `EA211-PHEV`, `MEB` | 3-6 | **sin ningún modelo que las use** |
| `EA888` (gen2+gen3 juntas) | ~12 | mezcla dos motores distintos, ver 3.3(a) |

Y por chasis, contando solo lo que no cuelga del motor:

| Chasis | Suspensión | Frenos | Dirección | Ruedas | Seguridad | Estética |
|---|---|---|---|---|---|---|
| PQ35 | 6 | 4 | 2 | 3 | 3 | 5 |
| MQB Evo | 3 | 1 | 0 | 1 | 0 | 1 |
| MEB | 1 | 0 | 0 | 0 | 0 | 1 |
| El resto | 0 | 0 | 0 | 0 | 0 | 0 |

Los ceros son el trabajo real. Un Cupra Formentor VZ hoy no tiene ni una pieza de
dirección ni de seguridad que ofrecerle.

### 6.2 Piezas nuevas por familia de motor

Formato de las tablas: precio **estimado** en euros; el `min` y el `max` del catálogo se
fijan en el volcado a ±25% salvo donde el mercado esté más apretado. Todas las marcas son
proveedores europeos reales con producto para esa plataforma.

#### EA111 — 1.4 TSI twincharger (Polo 6R GTI, Ibiza Cupra 6J, Fabia RS, Golf V GT Sport)

| Pieza | Categoría | Gama | Marcas | Est. | Grupo | Legalidad |
|---|---|---|---|---|---|---|
| Reprogramación Stage 1 1.4 TSI | gestión | media | Revo, APR, Unitronic | 480 | remap | homologable |
| Reprogramación Stage 2 1.4 TSI | gestión | media | Revo, RTMG | 650 | remap | requiere-ficha |
| Kit de admisión abierta 1.4 TSI | admisión | media | Forge, RTMG | 240 | admision-filtro | homologable |
| Intercooler frontal 1.4 TSI | admisión | media | Forge, Airtec | 420 | intercooler | homologable |
| Downpipe con cat deportivo 1.4 TSI | escape | media | Milltek, Scorpion | 480 | downpipe | requiere-ficha |
| Línea cat-back inox 1.4 TSI | escape | media | Milltek, Scorpion | 700 | — | homologable |
| Polea de compresor reducida | turbo | media | Forge, VWR | 320 | polea-compresor | requiere-ficha |
| Kit de cadena de distribución reforzada | turbo | media | INA, Febi | 550 | distribucion | homologable |

Nota técnica que hay que meter en la ficha: el 1.4 twincharger tiene un fallo conocido de
cadena y tensor. Un Stage 2 sobre una cadena vieja es tirar el dinero, así que el remap de
Stage 2 debería llevar `requiere: ["dist-cadena-ea111-media"]`.

#### EA189 — 2.0 TDI common rail (Golf VI GTD, León 1P FR TDI, Octavia II RS TDI, Passat B7)

| Pieza | Categoría | Gama | Marcas | Est. | Grupo | Legalidad |
|---|---|---|---|---|---|---|
| Reprogramación Stage 1 EA189 | gestión | baja | Celtic Tuning, Superchips | 400 | remap | homologable |
| Reprogramación Stage 2 EA189 | gestión | media | Darkside, Revo | 600 | remap | requiere-ficha |
| Downpipe sin DPF EA189 | escape | media | Darkside Developments | 520 | downpipe | solo-circuito |
| Intercooler de mayor volumen EA189 | admisión | media | Wagner, Forge | 480 | intercooler | homologable |
| Turbo híbrido EA189 | turbo | alta | Darkside, BorgWarner | 1500 | turbo-principal | requiere-ficha |
| Inyectores reforzados EA189 | turbo | media | Bosch, Darkside | 700 | — | homologable |
| Embrague reforzado EA189 | transmisión | media | Sachs, Spec | 900 | embrague | homologable |

#### EA189-16 — 1.6 TDI common rail

Tres piezas, calcadas del planteamiento del `EA288-16`: Stage 1 (Celtic Tuning, 320 €),
intercooler (Wagner, 380 €) y downpipe sin DPF (Darkside, 450 €). El techo de potencia
está en 130-140 CV, así que no tiene sentido darle turbo híbrido.

#### EA888-gen2 — 2.0 TSI (Golf VI GTI, Beetle Turbo, Passat CC, A4 B8, Q3 8U)

| Pieza | Categoría | Gama | Marcas | Est. | Grupo | Legalidad |
|---|---|---|---|---|---|---|
| Reprogramación Stage 1 gen2 | gestión | media | APR, Revo, Unitronic | 550 | remap | homologable |
| Reprogramación Stage 2 gen2 | gestión | media | APR, Integrated Engineering | 750 | remap | requiere-ficha |
| Turbo híbrido K04 para gen2 | turbo | alta | MuchBoost, Loba | 1900 | turbo-principal | requiere-ficha |
| Kit de admisión cerrada gen2 | admisión | media | Forge, Neuspeed | 320 | admision-filtro | homologable |
| Intercooler frontal gen2 | admisión | media | Forge, Wagner | 520 | intercooler | homologable |
| Downpipe 3" gen2 | escape | media | Milltek, AWE | 480 | downpipe | requiere-ficha |
| Bomba de alta presión reforzada gen2 | turbo | media | Autotech, APR | 480 | — | homologable |
| Kit de cadena de distribución reforzada gen2 | turbo | media | INA, Febi | 620 | distribucion | homologable |
| Separador de aceite / catch can gen2 | admisión | baja | Forge, 034 | 180 | — | homologable |

La cadena y el consumo de aceite del gen2 son el motivo de que esta familia tenga que ir
separada del gen3. Aquí `distribucion` no es un capricho: es la pieza que evita que un
Stage 2 se coma el motor.

#### EA888-gen3 — 2.0 TSI (Golf VII GTI/R, S3 8V, Cupra 5F, Octavia III RS, Polo AW GTI)

| Pieza | Categoría | Gama | Marcas | Est. | Grupo | Legalidad |
|---|---|---|---|---|---|---|
| Reprogramación Stage 1 gen3 | gestión | media | APR, Unitronic, Revo, IE | 600 | remap | homologable |
| Reprogramación Stage 2 gen3 | gestión | media | APR, Unitronic | 800 | remap | requiere-ficha |
| Calibración Stage 2 E85 gen3 | gestión | alta | Unitronic, MACHGRADE | 1000 | remap | solo-circuito |
| Turbo híbrido IS38 para IS20 | turbo | alta | MuchBoost, MACHGRADE | 1700 | turbo-principal | requiere-ficha |
| Turbo híbrido sobre IS38 | turbo | alta | MuchBoost, TTE | 2400 | turbo-principal | requiere-ficha |
| Kit de admisión cerrada gen3 | admisión | media | Eventuri, RacingLine, IE | 600 | admision-filtro | homologable |
| Intercooler frontal gen3 | admisión | media | Wagner, do88, IE | 700 | intercooler | homologable |
| Downpipe 3" con cat 400 cpsi gen3 | escape | media | Milltek, Scorpion | 750 | downpipe | requiere-ficha |
| Escape turbo-back con valvulería gen3 | escape | alta | Milltek Race, Akrapovic | 2200 | downpipe | solo-circuito |
| Bomba de alta presión gen3 | turbo | media | APR, IE | 650 | — | homologable |
| Turbo inlet y charge pipe gen3 | admisión | media | Forge, IE | 380 | — | homologable |
| Embrague DSG DQ250 reforzado + TCU | transmisión | alta | Sachs, RacingLine | 1800 | embrague | homologable |
| Autoblocante ATB gen3 (eje delantero) | transmisión | alta | Wavetrac, Quaife | 1500 | diferencial | homologable |

#### EA855 — 2.5 TFSI cinco cilindros (RS3 8P/8V/8Y, TT RS, RS Q3, Formentor VZ5)

| Pieza | Categoría | Gama | Marcas | Est. | Grupo | Legalidad |
|---|---|---|---|---|---|---|
| Reprogramación Stage 1 2.5 TFSI | gestión | alta | APR, Unitronic, MTM | 950 | remap | homologable |
| Reprogramación Stage 2 2.5 TFSI | gestión | alta | APR, MTM, ABT | 1300 | remap | requiere-ficha |
| Turbo híbrido 2.5 TFSI | turbo | alta | TTE, Loba | 3800 | turbo-principal | requiere-ficha |
| Kit de admisión de carbono 2.5 | admisión | alta | Eventuri, Wagner | 900 | admision-filtro | homologable |
| Intercooler Competition 2.5 | admisión | alta | Wagner, do88 | 1100 | intercooler | homologable |
| Downpipe sin cat 2.5 | escape | alta | Milltek, Scorpion | 1200 | downpipe | solo-circuito |
| Escape valvular cat-back 2.5 | escape | alta | Akrapovic, Milltek | 3200 | — | homologable |
| Kit de refrigeración de aceite 2.5 | turbo | media | Setrab, Forge | 700 | refrigeracion | homologable |

#### EA837 y EA839 — V6 3.0 TFSI (S4/S5 B8, S4/S5 B9, SQ5, RS4/RS5 2.9 biturbo)

| Pieza | Categoría | Gama | Marcas | Est. | Grupo | Legalidad |
|---|---|---|---|---|---|---|
| Polea de compresor reducida 3.0 TFSI | turbo | media | 034Motorsport, APR | 550 | polea-compresor | requiere-ficha |
| Reprogramación Stage 1 3.0 TFSI | gestión | alta | APR, MTM, ABT | 1100 | remap | homologable |
| Reprogramación Stage 2 3.0 TFSI | gestión | alta | APR, MTM | 1500 | remap | requiere-ficha |
| Intercooler agua-aire de alta capacidad | admisión | alta | Wagner, do88 | 1400 | intercooler | homologable |
| Downpipes con cat deportivo V6 | escape | alta | Milltek, Capristo | 1900 | downpipe | requiere-ficha |
| Admisión de carbono V6 | admisión | alta | Eventuri, 034 | 1200 | admision-filtro | homologable |

El `polea-compresor` solo aplica al `EA837` (compresor volumétrico). Al `EA839`, que es
turbo, no: en el volcado hay que separar esas dos fichas aunque compartan tabla aquí.

#### EA825 — 4.0 TFSI V8 (S6/S7, RS6, RS7, SQ7/SQ8, RS Q8, Touareg R)

| Pieza | Categoría | Gama | Marcas | Est. | Grupo | Legalidad |
|---|---|---|---|---|---|---|
| Reprogramación Stage 1 4.0 TFSI | gestión | alta | APR, MTM, ABT | 1800 | remap | homologable |
| Reprogramación Stage 2 4.0 TFSI | gestión | alta | APR, MTM | 2600 | remap | requiere-ficha |
| Downpipes deportivos V8 | escape | alta | Milltek, Capristo | 2800 | downpipe | requiere-ficha |
| Escape valvular V8 | escape | alta | Akrapovic, Capristo | 6500 | — | homologable |
| Admisión de carbono V8 | admisión | alta | Eventuri | 1900 | admision-filtro | homologable |
| Intercoolers de alta capacidad V8 | admisión | alta | Wagner, do88 | 2400 | intercooler | homologable |

#### EA897 y EA824 — diésel V6 y V8 (SQ5 TDI, Q7, Touareg, SQ7 TDI)

| Pieza | Categoría | Gama | Marcas | Est. | Grupo | Legalidad |
|---|---|---|---|---|---|---|
| Reprogramación Stage 1 3.0 TDI | gestión | media | Celtic Tuning, MTM, ABT | 900 | remap | homologable |
| Reprogramación Stage 2 3.0 TDI | gestión | alta | MTM, Darkside | 1400 | remap | requiere-ficha |
| Downpipes sin DPF 3.0 TDI | escape | alta | Darkside, Milltek | 1600 | downpipe | solo-circuito |
| Intercooler de mayor volumen V6 TDI | admisión | media | Wagner | 900 | intercooler | homologable |
| Reprogramación 4.0 TDI V8 | gestión | alta | MTM, ABT | 2000 | remap | homologable |

#### MEB, PPE y J1 — eléctricos

Aquí hay que ser honesto en las fichas: **un BEV del grupo no admite preparación de
potencia**. No hay admisión, ni escape, ni turbo, ni gestión que valga, y `compat.ts` ya
lo bloquea por `propulsion`. Lo que sí admite es todo lo demás.

| Pieza | Categoría | Gama | Marcas | Est. | Chasis | Grupo |
|---|---|---|---|---|---|---|
| Coilovers para MEB | suspensión | alta | KW V3, H&R | 2000 | MEB | altura |
| Muelles de rebaje -30 mm MEB | suspensión | media | Eibach, H&R, RacingLine | 320 | MEB | altura |
| Llantas ligeras 20" para eléctricos | ruedas | alta | OZ, BBS | 2200 | MEB, PPE, J1 | llantas |
| Neumáticos de baja resistencia deportivos | ruedas | media | Michelin, Continental | 900 | MEB, PPE, J1 | — |
| Pastillas y discos de alto rendimiento MEB | frenos | media | DBA, Brembo | 700 | MEB | frenos-delanteros |
| Kit estético MEB (difusor, faldones, vinilo) | estética | media | genérico | 900 | MEB | — |
| Barra estabilizadora trasera MEB | suspensión | media | Whiteline, H&R | 380 | MEB | — |

Para `PPE` y `J1` el catálogo se queda en ruedas, neumáticos y estética: el mercado de
recambio para el Q6 e-tron y el e-tron GT hoy es casi inexistente, y llenarlo de piezas
inventadas sería peor que dejarlo corto. Conviene que la ficha de esos coches avise.

### 6.3 Piezas nuevas por chasis

Lo que no cuelga del motor. Estas son las que hoy están a cero y las que hacen que un
Formentor o un A4 den un presupuesto decente.

| Chasis | Suspensión | Frenos | Dirección | Seguridad | Estética | Ruedas |
|---|---|---|---|---|---|---|
| `PQ24` | coilovers entrada (FK, TA Technix) 450; muelles (Eibach) 220 | pastillas + latiguillos 260 | brazos ajustables 320 | media jaula 900 | kit faldones 500 | llantas 17" 900 |
| `PQ46` | coilovers (KW V1, BC) 1100; neumática (Air Lift) 2600 | big brake 330 mm 1400 | casquillos subchasis 280 | — | kit estético 800 | llantas 19" 1600 |
| `NSF` | coilovers (KW V1) 950; muelles 240 | discos y pastillas 380 | — | — | kit estético 450 | llantas 16" 800 |
| `MQB-A0` | coilovers (KW V1, ST XTA) 1200; muelles -30 300 | big brake 330 mm 1500 | brazos ajustables 400 | media jaula 1000 | kit estético 700 | llantas 18" 1400 |
| `MLB` | coilovers (KW V3, Bilstein B16) 2400; barras 420 | big brake 356 mm (Brembo GT) 3200 | brazos ajustables (034) 900 | baquet + arnés 1400 | difusor y faldones 1200 | llantas 19" forjadas 2600 |
| `MLB Evo` | coilovers (KW V3, H&R) 2600; conversión de neumática a rosca 1900 | big brake 380 mm (AP Racing) 4500 | brazos y rótulas uniball 1100 | baquet + arnés 1500 | kit carrocería 1800 | llantas 20" forjadas 3200 |
| `PL71` | muelles y amortiguadores reforzados 1800 | discos y pastillas 4x4 900 | — | — | kit todoterreno 1200 | llantas 18" AT 1800 |
| `MQB Evo` (**reforzar**) | ya hay 3, añadir barras y casquillos 400 | discos 2 piezas 1900 | **kit de ángulo 700, brazos ajustables 500** | **baquet 1300, jaula atornillada 1100, corte de batería 300** | **kit carrocería 1500, ópticas 700, retapizado 1200** | llantas 19" 2000 |
| `MEB` | ver 6.2 | ver 6.2 | — | corte de batería específico BEV 400 | ver 6.2 | ver 6.2 |

Los tres bloques en negrita de `MQB Evo` son el pendiente 4 del dossier: hoy un Golf 8
tiene 26 piezas compatibles frente a las 59 de un Mk5, y el hueco está justo ahí.

### 6.4 Grupos exclusivos nuevos

| Grupo | Por qué | Piezas que lo usarían |
|---|---|---|
| `polea-compresor` | solo hay un juego de poleas; una reducida y otra más reducida no se montan a la vez | EA111, EA837 |
| `distribucion` | cadena reforzada o kit de correa: una sustituye a la otra | EA111, EA888-gen2 |
| `refrigeracion` | radiador de aceite: uno y solo uno | EA855, EA888-evo4, EA113 |

No hacen falta categorías nuevas. Las 11 actuales cubren todo lo de arriba.

### 6.5 Cadenas de dependencia nuevas

Siguiendo el patrón del K04 y del big turbo que ya están:

- **Turbo híbrido IS38 sobre IS20** (`EA888-gen3`) arrastra intercooler + admisión +
  downpipe + bomba de alta + Stage 2.
- **Turbo híbrido sobre IS38** arrastra además alimentación E85 y embrague DSG reforzado:
  el DQ250 de serie no aguanta el par.
- **Turbo híbrido 2.5 TFSI** (`EA855`) arrastra intercooler Competition + admisión +
  downpipe + Stage 2 + refrigeración de aceite.
- **Turbo híbrido EA189** arrastra intercooler + downpipe sin DPF + inyectores + Stage 2.
- **Stage 2 del 1.4 twincharger** (`EA111`) arrastra la cadena de distribución reforzada.
  Es una dependencia de fiabilidad, no de potencia, y es la primera de ese tipo en el
  catálogo. Merece la pena porque es exactamente el consejo que da un taller.

---

## 7. Plan de aplicación

El orden importa: la lista blanca cerrada hace que cualquier salto de paso rompa la
ingesta con "plataforma desconocida" o "chasis desconocido".

1. **Tipos primero.** `src/engine/types.ts`: ampliar `Plataforma`, `Chasis`,
   `Equipamiento`, `Traccion` (añadir `trasera`) y `Propulsion` (añadir `mhev`).
2. **Validación después.** `src/engine/catalog.ts`: las constantes `PLATAFORMAS`,
   `CHASIS`, `EQUIPAMIENTOS`, `TRACCIONES` tienen que quedar idénticas a los tipos.
   Si no, typecheck pasa y la ingesta falla en ejecución.
3. **Reglas de `compat.ts`.** Repasar que `trasera` y `mhev` no rompan las reglas de
   propulsión y tracción ya escritas, y añadir las de `suspension-neumatica`,
   `frenos-ceramicos` y `scr-adblue`, que son avisos nuevos.
4. **Migración de `EA888`** (decisión 3.3(a)), si se aprueba: reasignar los cinco modelos
   y las piezas que la mencionan antes de tocar nada más.
5. **Datos**: `models.json` primero, `catalog.json` después. `brands.json` con las marcas
   nuevas (MTM, ABT, Capristo, Loba, TTE, Setrab, Bosch, INA, Michelin, Continental,
   Air Lift, Bilstein, AST) y su nivel de gama.
6. **`npm run vault:export`** para regenerar el grafo entero. No editar el vault a mano:
   las notas de pieza y de modelo las escribe `escribirVault` con la matriz ya calculada.
7. **Verificación**: `npm test`, `npm run typecheck`, `npm run lint`, y
   `npm run probar -- --matriz` para ver que ningún coche se queda sin piezas.

Sugerencia de troceado, para que cada paso sea revisable y no un volcado de 300 fichas:

| Fase | Qué entra | Modelos | Piezas |
|---|---|---|---|
| **(j)** | Tipos, chasis, equipamiento, tracción trasera, migración EA888 | 0 nuevos | 0 nuevas |
| **(k)** | VW completo 2006-2026 | ~40 | ~35 |
| **(l)** | SEAT, Cupra y Škoda | ~45 | ~20 |
| **(m)** | Audi transversal (A1, A3, TT, Q3) | ~25 | ~30 |
| **(n)** | Audi longitudinal (A4-A8, Q5-Q8, MLB y MLB Evo) | ~40 | ~45 |
| **(o)** | Eléctricos: MEB, PPE, J1 | ~20 | ~15 |
| **(p)** | Refuerzo de MQB Evo en chasis (pendiente 4 del dossier) | 0 | ~20 |

---

## 8. Decisiones abiertas

Necesito tu criterio en estas cinco antes de volcar. Ninguna me bloquea para seguir
investigando, pero las cinco cambian datos que luego cuesta deshacer.

1. **Partir `EA888` en gen2 y gen3** (§3.3a). Recomiendo que sí. Rompe cinco fichas de
   modelo y unas doce piezas, todas reparables en el mismo commit.
2. **Golf VI R y Scirocco R** (§3.3b): a qué familia van. Hoy el Scirocco R está como
   `EA888` y no lo toco sin confirmación.
3. **Golf VI GTD**: en el repo está como `TDI` (bomba-inyector) y el coche real lleva
   common rail EA189. Es un error de dato que arrastra piezas equivocadas. Propongo
   corregirlo a `EA189` en la fase (j).
4. **Audi R8, SEAT Exeo y Q8 e-tron**: fuera del primer volcado, según §5.6. Si los
   quieres dentro, dilo y abro los chasis y motores que faltan.
5. **Hasta dónde llegar con los eléctricos**. Mi recomendación es ficharlos todos (son
   parte de la gama y del grafo) pero con catálogo mínimo y honesto, y que la ficha del
   coche avise de que la preparación de potencia no aplica.
