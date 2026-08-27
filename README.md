# JondaSiviz — Volkswagen Build Planner

Herramienta para planificar la preparación de un Volkswagen. Introduces el modelo
y la plataforma de motor, eliges gama de piezas y presupuesto, marcas el objetivo
del proyecto (drift, drag, ganar caballos o estética) y la herramienta devuelve un
presupuesto de piezas que cabe en el dinero disponible, con desglose por categoría,
total, sobrante y las siguientes mejoras si amplías el presupuesto.

Los precios son orientativos. Proyecto personal, sin relación con Volkswagen AG.

## Estado

Versión 0.1 en desarrollo.

- [x] Fase 0 — Esqueleto: Vite + React + TypeScript, tooling y build.
- [x] Fase 1 — Motor de recomendación + catálogo de datos + tests + CLI.
- [ ] Fase 2 — Interfaz: formulario y vista de resultados.
- [ ] Fase 3 — Guardar builds y exportar a PDF / CSV.
- [ ] Fase 4 — Empaquetado de escritorio (Tauri) y build web; conectar la descarga en la landing.

## Arquitectura

```
src/
  engine/          Lógica pura, sin dependencias de UI. Reutilizable en web, escritorio y CLI.
    types.ts       Tipos del dominio.
    catalog.ts     Carga y validación del catálogo.
    recommend.ts   Motor de recomendación (selección con restricción de presupuesto).
    index.ts       Punto de entrada del módulo.
  data/
    catalog.json   Catálogo de piezas (plataforma, gama, precio, peso por objetivo, dependencias).
  cli/
    plan.ts        CLI para probar el motor sin interfaz.
  ui/              (Fase 2) React.
tests/             Vitest.
```

### Motor de recomendación

Dada una petición (plataforma, gama, presupuesto, objetivo):

1. Filtra el catálogo por plataforma compatible y gama.
2. Puntúa cada pieza por aporte al objetivo (`peso × impacto`) y por aporte por euro.
3. Paso de esenciales: cubre una pieza de cada categoría prioritaria del objetivo,
   resolviendo sus dependencias, mientras quepa en el presupuesto.
4. Paso de relleno: añade el resto de piezas por mejor relación aporte/precio.
5. Devuelve las líneas elegidas agrupadas por categoría, total, sobrante,
   avisos (categorías que no han entrado) y hasta tres mejoras siguientes.

El motor es determinista: ante la misma entrada devuelve siempre el mismo resultado.

## Uso

```bash
npm install
npm test                 # 22 tests
npm run plan -- --plataforma EA113 --gama media --presupuesto 4000 --objetivo drag --modelo "Golf GTI Mk5"
npm run dev              # arranca la web (aún sin interfaz de la herramienta)
npm run build            # type-check + build de producción
```

Valores admitidos:

- `--plataforma`: `1.8T-20v` | `EA113` | `EA888` | `VR6` | `TDI`
- `--gama`: `baja` | `media` | `alta`
- `--objetivo`: `drift` | `drag` | `mas-cv` | `estetica`

## Catálogo

`src/data/catalog.json` es la fuente de datos. Cada pieza declara:

- `plataformas`: motores compatibles.
- `gama`: `baja` | `media` | `alta`.
- `precio`: `{ min, estimado, max }` en euros, orientativo.
- `objetivos`: peso 0 a 5 de lo que aporta a cada objetivo.
- `impacto`: 1 a 5, relevancia técnica.
- `requiere`: ids de piezas que deben ir antes (dependencias).

`npm test` valida que no haya ids duplicados, dependencias rotas ni ciclos, y que
los precios y pesos estén en rango.
