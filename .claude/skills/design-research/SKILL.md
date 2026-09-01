---
name: design-research
description: Investiga en internet los patrones de UX y las referencias de diseño más adecuados para el tipo concreto de aplicación que se va a construir, antes de empezar el desarrollo. Se usa siempre junto con racing-atelier-style-guide, que fija el estilo visual constante.
---

# Investigación de diseño antes de construir

## Cuándo usarla

Cada vez que se vaya a diseñar o construir una aplicación, pantalla o flujo nuevo. El objetivo es que las decisiones de estructura y experiencia, no las visuales, estén basadas en lo que mejor funciona para ese tipo concreto de producto.

## Qué se investiga y qué no

- Se investiga: arquitectura de información, patrones de navegación, flujos habituales, convenciones que el usuario final ya reconoce para ese tipo de app (por ejemplo, un checkout de e-commerce, un dashboard financiero, una app de fitness).
- No se investiga ni se cambia el lenguaje visual: colores, tipografía, iconos y espaciado siempre vienen de `racing-atelier-style-guide`. La investigación nunca debe llevar a romper esa guía.

## Proceso

1. Identifica la categoría exacta del producto (por ejemplo: "app de seguimiento de gastos personales", "panel de administración B2B", "landing de producto SaaS").
2. Busca referencias recientes y de calidad con WebSearch y WebFetch: productos reconocidos de esa categoría, artículos de UX específicos sobre ese tipo de producto, casos de estudio. Prioriza fuentes de los últimos uno o dos años.
3. Extrae entre dos y cuatro patrones concretos y accionables. Por ejemplo: "las apps de gastos exitosas muestran el saldo disponible arriba del todo y agrupan por categoría con iconos", no vaguedades como "debe ser intuitivo".
4. Descarta cualquier patrón que choque con la guía de estilo fija. Si una referencia usa colores vivos o tipografía decorativa, se queda solo la lógica de estructura o interacción, no lo visual.
5. Resume en tres a cinco líneas qué se va a aplicar y por qué, antes de empezar a construir.

## Nota

No hace falta explicar al usuario todo el proceso de búsqueda, solo el resumen final de decisiones y su justificación.
