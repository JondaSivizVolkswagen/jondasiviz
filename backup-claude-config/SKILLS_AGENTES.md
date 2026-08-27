# Índice de subagentes, skills, plugins y herramientas configurados

Este archivo se carga siempre, en cualquier sesión y cualquier ruta (importado desde `CLAUDE.md`). Es el catálogo fijo de todo lo personalizado que el usuario ha configurado para que Claude Code lo use por defecto. Mantenerlo actualizado automáticamente, sin esperar a que se pida, cada vez que se cree, instale o elimine un subagente, skill, plugin o herramienta nueva.

## Subagentes

- **app-designer** — `~/.claude/agents/app-designer.md`
  Diseñador de producto senior. Se invoca siempre que se pida crear, rediseñar o mejorar una app, pantalla, componente o interfaz. Carga las tres skills de abajo antes de construir.

## Skills

- **apple-minimal-style-guide** — `~/.claude/skills/apple-minimal-style-guide/SKILL.md`
  Sistema de diseño visual fijo (color, tipografía, iconos, espaciado, movimiento) tipo Apple. Constante en todos los proyectos, solo cambia el acento por proyecto. La usa `app-designer`.

- **design-research** — `~/.claude/skills/design-research/SKILL.md`
  Investiga en internet patrones de UX y arquitectura de información según el tipo de producto, antes de construir. Nunca decide nada visual, solo estructura y flujos. La usa `app-designer`.

- **humanized-writing** — `~/.claude/skills/humanized-writing/SKILL.md`
  Reglas de redacción para que ningún texto (copy, comentarios, respuestas) suene generado por IA: sin guiones largos, sin emojis, sin frases hechas. La usa `app-designer`.

## Plugins de Claude Code

- **caveman** (`caveman@caveman`) — marketplace `JuliusBrussee/caveman`, instalado en `~/.claude/plugins/marketplaces/caveman`
  Reduce tokens de salida comprimiendo el estilo de respuesta. Modo por defecto `lite`, configurado en `%APPDATA%\caveman\config.json` (ojo: en Windows es esa ruta, no `~/.config/caveman/`). Statusline activa en `settings.json` mostrando `[CAVEMAN:LITE]`, usando el script nativo `caveman-statusline.ps1`. Cambiar de nivel con `/caveman lite|full|ultra|wenyan|off`.

## Herramientas de sistema

- **RTK (Rust Token Killer)** — binario en `~/.local/bin/rtk.exe`, de `rtk-ai/rtk`
  Proxy que comprime la salida de comandos de shell antes de que llegue al contexto del modelo. Enganchado vía hook `PreToolUse` sobre `Bash` en `settings.json` (`rtk hook claude`). Comandos útiles: `rtk gain`, `rtk gain --history`, `rtk discover`. Documentado también en `~/.claude/RTK.md` (importado en `CLAUDE.md`).

## Políticas globales de comportamiento

- **Política de Inteligencia Adaptativa** — definida al principio de `CLAUDE.md`
  Selecciona automáticamente el nivel de razonamiento (bajo/medio/alto/máximo) según la complejidad de cada tarea, sin preguntar. No aplica a este archivo en sí, pero cualquier tarea que toque subagentes o skills de aquí normalmente cae en nivel medio o alto.

## Entorno base instalado

- **Node.js 24** vía **nvm-windows** (`nvm use 24`)
- **Git** (incluye Git Bash, usado como fallback si algún script solo trae versión `.sh`)
- **winget** ya disponible en el sistema, usado para instalar lo anterior
