---
name: apple-minimal-style-guide
description: Sistema de diseño visual fijo (color, tipografía, iconos, espaciado, movimiento) que debe usarse en todo desarrollo de UI para este usuario. Se carga siempre que el subagente app-designer construye o revisa una interfaz, para que el resultado se vea igual de un proyecto a otro.
---

# Guía de estilo: minimalismo tipo Apple

## Filosofía

Cada pantalla resuelve una sola tarea principal. Elimina cualquier elemento que no ayude a esa tarea. El espacio en blanco es un elemento de diseño, no un sobrante. La jerarquía se construye con tamaño, peso y espaciado, casi nunca con color. Nada debe llamar la atención por accidente: si algo destaca, es porque se decidió que destacara.

## Color

- Paleta base neutra: fondo casi blanco (#FAFAFA–#FDFDFC) en modo claro, casi negro cálido (#0B0B0C–#121214) en modo oscuro. Nunca blanco puro ni negro puro a pantalla completa.
- Texto principal en gris muy oscuro (#1D1D1F en claro, #F5F5F7 en oscuro), no negro puro.
- Un único color de acento por proyecto, decidido para ese proyecto y usado con moderación (menos del 10% de la superficie visible): botones primarios, enlaces activos, estados de foco. Nunca como fondo de página completo.
- Los estados (error, éxito, aviso) usan versiones desaturadas y algo oscurecidas del rojo/verde/ámbar, nunca el tono puro por defecto del framework.
- Prohibido: gradientes morado a azul genéricos, colores neón o al máximo de saturación, semáforos de color sin matizar, la paleta por defecto de Tailwind o Bootstrap sin modificar.

## Tipografía

- Una sola familia tipográfica por interfaz, dos pesos como máximo (regular y medium/semibold). Nunca mezclar más de una familia en la misma pantalla.
- Orden de preferencia: la fuente nativa del sistema cuando la app debe sentirse nativa (-apple-system / "SF Pro Text" en Apple, "Segoe UI Variable" en Windows); si hace falta una fuente propia, usar una geométrica humanista de calidad, como Inter, General Sans, Geist o Söhne.
- Prohibido: Arial, Helvetica sin variante especificada, Verdana, Times New Roman, Comic Sans, o dejar la fuente por defecto de un framework (ui-sans-serif system-ui) sin haberlo decidido de forma consciente.
- Escala tipográfica con razón 1.2–1.25, entre 5 y 7 pasos. Interlineado generoso en párrafos (1.4–1.6).

## Iconos

- Una sola familia de iconos por proyecto, todos de línea, mismo grosor de trazo. Recomendadas: Lucide, Phosphor (variante regular o light), SF Symbols si el destino es Apple nativo.
- Nunca mezclar iconos de librerías distintas ni usar emojis como iconos funcionales.
- Los iconos acompañan al texto, no lo sustituyen, salvo en barras de navegación muy reconocibles (inicio, buscar, perfil).

## Espaciado y layout

- Grid base de 8pt: márgenes, paddings y gaps son múltiplos de 8 (o 4 para ajustes finos).
- Máximo una acción primaria visible por pantalla o sección.
- Escala fija de radios de borde (por ejemplo 8 / 12 / 20px) reutilizada en toda la app, nunca radios distintos sin motivo.
- Sombras sutiles y de baja opacidad para indicar elevación, nunca sombras duras o de color.

## Movimiento

- Transiciones cortas (150–250ms), curva de easing suave (ease-out o spring suave), nunca lineal.
- La animación comunica causa y efecto (qué apareció, de dónde vino), no decora.
- Respetar siempre `prefers-reduced-motion`.

## Qué evitar siempre

- El aspecto genérico de plantilla de IA: fondo crema con serif de alto contraste y acento terracota; fondo casi negro con un único acento verde ácido o rojo vivo; layout tipo periódico con líneas finas y radio cero.
- Glassmorphism o neumorphism sin justificación funcional, solo por capricho.
- Iconos, colores o tipografías por defecto de un framework sin haber tomado una decisión consciente.
- Decoración que no aporta a la tarea: ilustraciones genéricas, patrones de fondo, ruido visual.

## Aplicación

Esta guía es constante y se aplica igual en todos los proyectos del usuario. Lo único que cambia entre proyectos es el color de acento y, si aplica, el patrón de interacción concreto que investigue la skill `design-research`.

Antes de entregar cualquier interfaz, repasa: ¿un solo acento usado con moderación? ¿una sola familia tipográfica? ¿una sola familia de iconos? ¿grid de 8pt? ¿se evitan los valores por defecto del framework? Si alguna respuesta es no, corrígelo antes de mostrarlo.
