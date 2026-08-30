---
name: racing-atelier-style-guide
description: Sistema de diseño visual fijo de JondaSiviz (color, tipografía, iconos, espaciado, movimiento). Se carga siempre que el subagente app-designer construye o revisa una pantalla de este proyecto, para que el resultado se vea igual de una pantalla a otra. Sustituye a la antigua guía apple-minimal-style-guide, que era de base clara y ya no aplica aquí.
---

# Guía de estilo: racing atelier

## Filosofía

Un taller de preparación serio. Oscuro, industrial y silencioso, no una web de tuning con neones. La referencia es la documentación técnica de un fabricante y el pit wall de un equipo: fichas, escalas, referencias, cifras alineadas. Nada decorativo que no diga algo.

Cada pantalla resuelve una tarea. La jerarquía se construye con tamaño, peso, familia tipográfica y hairlines, casi nunca con color. Si algo destaca, es porque se decidió que destacara.

## Color

Los tokens viven en `src/index.css` y no se redefinen en otro sitio.

- Base: `--negro #08090b` de fondo, paneles en `--panel #0e1014` y `--panel-2 #13161b`. Nunca negro puro a pantalla completa, nunca gris medio como fondo.
- Separaciones con hairlines, no con sombras: `--linea rgba(255,255,255,.07)` y `--linea-fuerte rgba(255,255,255,.14)`. Sombras solo donde hay volumen real (la escena 3D).
- Texto en `--texto #eef0f3`, secundario `--texto-2`, terciario `--tenue`, apagado `--apagado`. Cuatro niveles, ni uno más.
- **Un solo acento: el rojo `--rojo #e3121c`.** Se reserva para el estado activo, el peligro, los índices de sección y la cuña de la marca. Debe ocupar mucho menos del 10% de la pantalla. Si aparece en todas partes deja de significar nada.
- Estados: `--verde #35d07f` solo para "esto entra / esto llega", `--ambar #f0a92b` solo para avisos que no son peligro. El peligro siempre es rojo.
- Prohibido: degradados morado-azul, neones, la paleta por defecto de Tailwind, modo claro.

## Tipografía

- Titulares: **Archivo** 800, `letter-spacing: -0.035em`, casi siempre en mayúsculas. Apretada y ancha, no elegante.
- Interfaz y prosa: Archivo 400/500.
- **JetBrains Mono para todo lo que sea una cifra, una etiqueta, una referencia o un estado.** Esa separación entre las dos familias es lo que le da el aire de documentación técnica. Un precio en la tipografía de titulares está mal puesto.
- Las etiquetas mono van en mayúsculas, entre 9 y 11 px, con `letter-spacing` de 0.14em a 0.22em.
- Los números siempre con `font-variant-numeric: tabular-nums`, para que no bailen al cambiar de cifra.

## Forma y espaciado

- `border-radius: 2px` (`--r`). Lo redondo suaviza y aquí no queremos suavidad.
- Los bloques se pegan unos a otros con `gap: 2px` y comparten borde: se leen como una pieza de chapa dividida, no como tarjetas sueltas flotando.
- Cada sección se abre con un `.eyebrow`: mono, mayúsculas, con un guion rojo delante.
- Las secciones numeradas llevan índice mono (`01`, `02`, `03`) en gris apagado, o en rojo si es el índice de una categoría del plan.

## Iconos

Trazo de línea, `viewBox` de 24, grosor 1.5, extremos redondeados, sin relleno. Todos en `src/ui/icons.tsx`; no se meten SVG sueltos en los componentes ni se instala una librería de iconos.

## Movimiento

- Curva única: `cubic-bezier(0.16, 1, 0.3, 1)` (`--curva`). Entradas de 400 a 850 ms, respuestas a un clic de 200 a 350 ms.
- Las listas entran escalonadas con `--i` como índice, 45 ms de retraso por elemento. Más que eso se nota como lentitud.
- Las cifras importantes cuentan hasta su valor, no saltan.
- Todo lo animado se apaga dentro de `prefers-reduced-motion: reduce`. Sin excepciones.

## Textos

Las reglas de escritura son las de la skill `humanized-writing`. Aquí solo dos cosas propias del proyecto:

- Las frases que explican una regla del dominio (el mínimo, el riesgo, la gama) **no se escriben en la interfaz**: salen del motor (`fraseMinimo`, `fraseRiesgo`, `NOMBRE_CATEGORIA`). Este proyecto ya arrastró bugs por tener dos versiones del mismo texto contradiciéndose.
- Ninguna etiqueta grita. "Sobrante", no "¡Te sobran 5 €!".
