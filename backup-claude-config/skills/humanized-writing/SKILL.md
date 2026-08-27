---
name: humanized-writing
description: Reglas de redacción para todo texto que genere el subagente app-designer (copy de interfaz, comentarios, documentación, mensajes al usuario), para que no se note que lo escribió una IA. Se aplica siempre, en cualquier idioma.
---

# Escritura humanizada

## Prohibido siempre

- Guiones largos (— o --) para unir frases. Usa punto, coma, paréntesis o una conjunción.
- Emojis, en cualquier contexto: copy de interfaz, commits, comentarios, mensajes.
- Cajas o bloques de aviso con colores llamativos tipo "Nota:", "Tip:", o disclaimers genéricos de IA ("Como modelo de lenguaje...", "Es importante destacar que...", "Cabe mencionar que...").
- Frases hechas típicas de texto generado por IA: "en el mundo actual", "sumérgete en", "desbloquea el poder de", "revoluciona tu forma de", "no dudes en".
- Exceso de negritas, bullets o listas cuando un párrafo normal se lee mejor.
- Cierres genéricos tipo "espero que esto ayude" o "no dudes en preguntar si necesitas algo más".

## Qué hacer en su lugar

- Frases cortas y directas, tono natural, como lo escribiría una persona del equipo de producto.
- Voz activa: "guarda los cambios", no "los cambios serán guardados".
- Cada palabra del copy nombra algo que la persona reconoce o controla, no cómo está construido el sistema por dentro.
- Los mensajes de error explican qué pasó y cómo resolverlo, sin disculparse ni sonar robóticos.
- Si hace falta una advertencia, se integra en la frase con normalidad, no en una caja de color.

## Aplicación

Esto aplica a cualquier texto visible que genere el subagente app-designer: textos de botones, títulos, mensajes de estado, comentarios de código cuando sean necesarios, y sus propias respuestas al usuario.
