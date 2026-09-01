# Copia de seguridad de la configuración de Claude Code

Copia de los archivos de `C:\Users\<usuario>\.claude\` (y del config de caveman)
necesarios para tener el mismo entorno de Claude Code en otra máquina o después de
reinstalar. Es local a la máquina, **no depende de la cuenta premium**: cambiar de
cuenta no borra el `.claude/` original, esto es solo por si además cambias de equipo.

Fecha de la copia: febrero 2026.

## Qué contiene

| Archivo aquí | Va restaurado en |
|---|---|
| `CLAUDE.md` | `~/.claude/CLAUDE.md` |
| `SKILLS_AGENTES.md` | `~/.claude/SKILLS_AGENTES.md` |
| `RTK.md` | `~/.claude/RTK.md` |
| `settings.json` | `~/.claude/settings.json` |
| `../.claude/agents/app-designer.md` | `~/.claude/agents/app-designer.md` |
| `../.claude/skills/*/SKILL.md` | `~/.claude/skills/*/SKILL.md` |
| `caveman-config.json` | `%APPDATA%\caveman\config.json` (Windows) |

El subagente `app-designer` y sus tres skills **no están duplicados aquí**: viven en
`../.claude/` del repo, que es donde Claude Code los carga solo para cualquiera que
clone el proyecto. Se restauran copiándolos desde ahí. Una única copia, para que no se
separen con el tiempo.

## Qué NO contiene (a propósito)

- **`.credentials.json`** — es el token de sesión de Claude Code. No se copia nunca.
  Al abrir Claude Code en la máquina nueva se inicia sesión y se regenera.
- **`plugins/`** — el plugin caveman se reinstala solo desde el marketplace. Con el
  `settings.json` restaurado (`enabledPlugins` + `extraKnownMarketplaces`), Claude
  Code lo vuelve a bajar; si no, ejecutar dentro de Claude Code:
  `/plugin marketplace add JuliusBrussee/caveman` y luego `/plugin install caveman@caveman`.
- **`history.jsonl`, `projects/`, `sessions/`, `cache/`, `backups/`** — historial y
  estado de sesiones, no hace falta para reproducir el entorno.
- **Binario de RTK** — descargar `rtk.exe` de `rtk-ai/rtk` y ponerlo en `~/.local/bin/`.

## Cómo restaurar en una máquina nueva

1. Instalar **Node.js 24** (nvm-windows: `nvm install 24 && nvm use 24`), **Git** y
   tener **winget**.
2. Copiar estos archivos a sus rutas de la tabla de arriba (crear las carpetas
   `~/.claude/agents/` y `~/.claude/skills/<nombre>/` si no existen).
3. Descargar `rtk.exe` (de `rtk-ai/rtk`) a `C:\Users\<usuario>\.local\bin\rtk.exe` y
   añadir esa carpeta al PATH. Comprobar con `rtk --version` y `rtk gain`.
4. Abrir Claude Code e iniciar sesión (regenera `.credentials.json`).
5. Si caveman no aparece: `/plugin marketplace add JuliusBrussee/caveman` y
   `/plugin install caveman@caveman`.
6. Comprobar: al arrancar, Claude Code carga `CLAUDE.md` y `SKILLS_AGENTES.md` solos;
   la statusline muestra `[CAVEMAN:LITE]`; `app-designer` y las tres skills de diseño
   están disponibles.

## Nota

Estos archivos son una **copia**. La fuente sigue siendo `~/.claude/` en la máquina
original. Si cambias algo allí (nuevas skills, nuevos subagentes), vuelve a copiarlo
aquí para mantener el backup al día. El detalle de qué es cada pieza está en
`../PROYECTO.md`, sección 12.
