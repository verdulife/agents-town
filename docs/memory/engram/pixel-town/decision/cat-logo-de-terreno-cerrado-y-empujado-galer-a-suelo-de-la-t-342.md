---
id: 342
type: decision
project: pixel-town
scope: project
topic_key: pixel-town/terrain-catalogue
session_id: 01a17786-0605-719b-961b-701d0377f1dc
created_at: "2026-10-26 15:48:51"
updated_at: "2026-10-26 18:58:53"
revision_count: 2
tags:
  - pixel-town
  - decision
aliases:
  - "Catálogo de terreno cerrado y empujado: galería, suelo de la tarjeta y sección de calle adoptada"
---

# Catálogo de terreno cerrado y empujado: galería, suelo de la tarjeta y sección de calle adoptada

**What**: Catálogo de terreno v2 cerrado, adoptado y empujado a `origin/main` en tres commits: `63245c7` feat(terrain) el catálogo (terrain.js 2.240 líneas + terrain-check 1.354), `5a79cb9` feat(terrain) la galería y el suelo de la tarjeta (floor.js 393 + calibration 647 + floor-check 509), `7d7e23b` docs(terrain) el feature doc y el vault de memoria. Sección de calle adoptada: campo → acera (3 filas, con las fachadas encima) → bordillo → calzada de asfalto (4) → plaza de piedra (4, con el mobiliario y el walker) → campo; `STREET_DY = 46` mueve el grupo de calle a la plaza; pares curados nuevos `plaza>asphalt` y `plaza>grass` (11 en total).
**Why**: Verdu pidió probar en la tarjeta cómo quedaría la calle "correcta" antes de commitear; tras verla (`street-adopted.png`) dio el ok y pidió corregir y commitear.
**Where**: `src/next/terrain.js`, `src/next/floor.js`, `src/next/calibration.js`, `tools/terrain-check.mjs`, `tools/floor-check.mjs`, `odd/tasks/terrain-catalogue.md`, `docs/memory/**`. Scripts nuevos: `npm run terrain:check`, `npm run floor:check`.
**Learned**:
- **Invariante que manda en el mapa**: cada banda debe abarcar todo el ancho. Una plaza insertada bajo una calzada de ancho completo hace que celdas de asfalto limiten con campo **y** plaza, y una máscara no puede dibujar dos pares. Al insertar la plaza, `floor-check` lo cazó al instante ("cell 4,15 (asphalt) borders grass and plaza").
- Por eso una pila de bandas sólo ejercita las máscaras `n`/`s`; las esquinas convexas y las cóncavas se demuestran en el parche compuesto de la galería, y la aserción del mapa quedó honestamente en "usa un subconjunto de las 13 y aparecen n y s".
- **Encuadre**: el grupo de calle estaba a `CY+25..30`, justo donde cae la calzada; bajarlo +46 px lo pone en la plaza. Sin ese desplazamiento el kiosco y los árboles quedaban plantados en el asfalto (captura `trial-street.png`).
- Verificación final: 233 checks verdes en seis scripts (terrain 47, floor 14, buildings 17, smoke 12, scale 124, walker 7). Nada pendiente en el árbol; `main` = `origin/main` = `7d7e23b`.
- Siguiente paso ya anotado (obs 329): catálogo de **calles** (carriles, pasos de cebra, aparcamiento — la calzada sin marcas se nota) y de **mobiliario urbano**.

---
*Session*: [[session-01a17786-0605-719b-961b-701d0377f1dc]]
*Topic*: [[topic-pixel-town]]
