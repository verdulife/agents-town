---
id: 328
type: architecture
project: pixel-town
scope: project
topic_key: pixel-town/v2-scale-policy
session_id: 01a17786-0605-719b-961b-701d0377f1dc
created_at: "2026-10-26 13:06:16"
updated_at: "2026-10-26 13:06:16"
revision_count: 1
tags:
  - pixel-town
  - architecture
aliases:
  - "Escala v2 por píxeles físicos: encuadre fijo ante el zoom del navegador y sin bandas"
---

# Escala v2 por píxeles físicos: encuadre fijo ante el zoom del navegador y sin bandas

**What**: Nueva política de escala v2 (modelo "campo de visión constante"): el píxel de arte tiene tamaño fijo en **píxeles físicos**, no CSS. `computeView(cssW, cssH, dpr, forceScale, targetH)` calcula `physH = round(cssH) * dpr`, elige `scalePhys = max(1, round(physH / TARGET_H))` con `TARGET_H = 480` (≈30 tiles de alto), deriva `scaleCss = scalePhys / dpr` y deja `w = ceil(physW / scalePhys)`, `h = ceil(physH / scalePhys)`. `applyView` pone el backing store en píxeles de arte y la caja CSS en `w * scaleCss`, con el offset ajustado a píxeles físicos enteros. `computeCamera` ya no recorta a ≥0: centra el mundo aunque la vista sea mayor (offset negativo) y `calibration.js` pinta un **patrón de campo repetible** en todo el lienzo antes del mundo, así no hay bandas negras de ningún tipo.
**Why**: Verdu descubrió que con dos zoom-out del navegador (2855x1218 CSS) le gustaba mucho más el encuadre y pidió fijarlo manteniendo "sin bandas negras". Con la regla anterior la escala se derivaba de px CSS, así que el zoom del navegador cambiaba el encuadre (3x a 100%, 4x al 57,5%) y los `ceil(w/720)`/`ceil(h/450)` forzaban recorte del mundo.
**Where**: `src/next/scale.js` (política completa), `src/next/calibration.js` (computeView con dpr, `bakeField()` + patrón, readout con px físicos/dpr/target), `calibration.html` (leyenda de targets 400/480/560), `tools/scale-check.mjs` (124 checks).
**Learned**:
- En su monitor (1644x974, dpr 1) el resultado es **2 px físicos por píxel de arte → 822x487 lógicos → 51,4x30,4 tiles**, con el pueblo entero (45x28,1 tiles) dentro y ~3 tiles de campo a los lados: exactamente el encuadre que le gustaba (44,6x19,1 a 2,3 px/art) pero con píxeles algo más pequeños.
- `round` en vez de `floor` para elegir la escala: con floor, 1280x720 caía a 1 px/art (canvas 1:1, se ve diminuto). Con round: 720p→2, 1080p→2, 1440p→3, 4K→5, y el rect seguro 480x360 sigue cabiendo.
- Escala fraccionaria (2,3 CSS) descartada: píxeles de 2 y 3 px mezclados. El truco correcto es entero en **device** px y CSS fraccionario (`scaleCss = scalePhys/dpr`), con el offset snap a device px: 0 shimmer y el zoom del navegador deja de importar.
- Al emular el zoom con Chrome headless (`--force-device-scale-factor=0.575`) la ventana interior no es exactamente la pedida, así que la vista sale ±1-2 px lógicos: es redondeo del viewport CSS, no de la política. Los checks lo toleran a propósito (±1).
- El mundo puede ser **menor que la vista**: hace falta (a) patrón de campo cubriendo el lienzo y (b) cámara con offset negativo para centrar. Si no, aparece una franja del color de fondo a la derecha/abajo (era lo que se veía con `?zoom=2` antes del cambio).
- `?zoom=` ahora significa píxeles físicos por píxel de arte (a dpr 1 es lo mismo que antes); `?target=` es el alto lógico objetivo.
- Pendiente cosmético: el camino de tierra del mundo termina en seco en el borde del mundo (corte vertical contra el campo) cuando la vista es mayor; habría que prolongarlo o difuminarlo en el futuro render de pueblo.
- v1 (`index.html`, `src/render.js`) sigue con su propia escala, sin tocar.

---
*Session*: [[session-01a17786-0605-719b-961b-701d0377f1dc]]
*Topic*: [[topic-pixel-town]]
