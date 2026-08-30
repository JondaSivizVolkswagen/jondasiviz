---
tipo: portada
generado: 2026-08-29
modelos: 92
familias: 56
ediciones: 198
colores: 88
---

# Volkswagen 2006-2026

Bóveda de consulta con las generaciones de turismos y comerciales ligeros de Volkswagen
en los últimos veinte años, sus acabados, sus series especiales y los colores de
carrocería asociados a cada una. Cobertura global: Europa, Norteamérica, Latinoamérica,
China, India, Sudáfrica y Australia.

- **92** fichas de modelo repartidas en **56** familias
- **198** ediciones especiales y series limitadas
- **88** colores de carrocería con sus modelos asociados
- **64** piezas de mercado, **5** oficiales y **59** no oficiales
- **33** plataformas, **9** familias de motor y **10** mercados

## Por dónde empezar

- [[Índice por familia]]
- [[Índice por año de lanzamiento]]
- [[Índice por plataforma]]
- [[Índice por mercado]]
- [[Índice de colores]]
- [[Índice de ediciones especiales]]
- [[Índice de piezas]]

## Cómo está organizada

```
Modelos/       Una nota por generación: acabados, carrocerías, mecánicas, colores y piezas.
Familias/      Una nota por nombre comercial, con todas sus generaciones en orden.
Ediciones/     Series especiales y limitadas, con año, unidades y mercado.
Colores/       Un color por nota, con los modelos que lo han ofrecido.
Piezas/        Piezas de mercado, oficiales y no oficiales, con precio y homologación.
Vendedores/    Tiendas de las que sale cada precio verificado.
Paises/        Qué es legalizable y qué no en cada país.
Motores/       Familias de motor: la bisagra entre una pieza y los modelos que la admiten.
Plataformas/   PQ35, MQB, MEB y compañía, con los modelos que las usan.
Mercados/      Qué se vendió en cada región.
Carrocerias/   Agrupación por tipo de carrocería.
Indices/       Listados transversales.
```

## Qué no cubre

- Camiones y autobuses de Volkswagen Truck & Bus (Constellation, Delivery), que son otra
  empresa dentro del grupo.
- Prototipos y concept cars que no llegaron a venderse.
- Códigos de pintura de fábrica. Los nombres comerciales cambian de un mercado a otro y
  los códigos varían por año, así que aquí solo aparecen los nombres.

## Precisión de los datos

Las gamas de color están recogidas por generación, no por año de modelo. Un color que
aparece en una ficha estuvo disponible en algún momento de la vida comercial de ese
modelo, en al menos uno de sus mercados, pero no necesariamente durante toda la
generación ni en todos los acabados. Las series especiales con cifra de producción
confirmada la llevan indicada; el resto aparecen marcadas como `detallada: no` en su
frontmatter, pendientes de completar.

Con las piezas el criterio es el mismo, y conviene tenerlo claro antes de gastarse dinero:

- **Los precios con enlace** se han abierto tienda a tienda y llevan la fecha de consulta
  en el frontmatter. Caducan: revísalos antes de comprar.
- **Los precios sin enlace** son rangos orientativos del catálogo del planner, no ofertas
  reales de ninguna tienda.
- **La homologación** solo aparece donde había fuente: lo que declara la ficha del
  producto para Alemania, y el régimen de reformas para España. Una pieza sin datos de
  homologación no es que sea legal, es que no está verificada.

Bóveda independiente de `vault/`, que es la fuente de datos del planner de preparación.
No la lee `npm run vault:ingest` ni entra en los tests del proyecto.
