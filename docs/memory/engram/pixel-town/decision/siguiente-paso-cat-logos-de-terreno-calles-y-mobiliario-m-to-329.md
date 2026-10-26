---
id: 329
type: decision
project: pixel-town
scope: project
topic_key: pixel-town/next-catalogues
session_id: 01a17786-0605-719b-961b-701d0377f1dc
created_at: "2026-10-26 13:07:14"
updated_at: "2026-10-26 13:07:14"
revision_count: 1
tags:
  - pixel-town
  - decision
aliases:
  - "Siguiente paso: catálogos de terreno, calles y mobiliario (método de galería + checks)"
---

# Siguiente paso: catálogos de terreno, calles y mobiliario (método de galería + checks)

**What**: Cierre de la ronda de arte + escala del catálogo v2 y **siguiente paso decidido por Verdu**: hacer lo mismo (catálogos revisables en galería, con reglas duras y checks) para **terreno, calles y mobiliario**.
**Why**: La galería de edificios ya está aprobada página a página y el encuadre fijado; el pueblo necesita el resto del vocabulario visual con el mismo método.
**Where**: repo `C:/Users/verdu/agents-town` (remoto `github.com/verdulife/agents-town`, rama `main`). Catálogo de edificios en `src/next/buildings.js` + `calibration.html?gallery=1`; política de escala en `src/next/scale.js`.
**Siguiente paso (pendiente, no empezado)**:
1. **Catálogo de terreno**: variantes de suelo por bioma/uso (hierba, tierra, acera, asfalto, gravilla, parque), con transiciones/bordes entre tipos y reglas (p. ej. acera siempre junto a calzada). Debe ser tileable y determinista.
2. **Catálogo de calles**: piezas de calzada y cruces (recta, esquina, T, cruz, rotonda), aceras, pasos de cebra, bordillos; reglas de conexión (una calle no puede acabar en mitad de la nada) y anchos en tiles.
3. **Catálogo de mobiliario urbano**: farolas, bancos, papeleras, buzones, cabinas, parquímetros, señales, contenedores, paradas... con anclaje al suelo y huella en tiles, sin elementos de azotea.
4. Cada catálogo: galería paginada (`?gallery=`), checks deterministas en `tools/` y revisión visual con capturas a 1644x974 (2 px físicos por píxel de arte).
**Estado de lo cerrado** (para no repetirlo): edificios aprobados (casas con gable, townhouse, locales con placa de rótulo ajustada y cara 3x5, apartments, anexos garage/warehouse, hoteles), sin elementos de azotea en ningún tipo, `civic` descartado; escala por píxeles físicos con objetivo de 480 px lógicos (2 px/art en su monitor) y campo pintado en todo el lienzo.

---
*Session*: [[session-01a17786-0605-719b-961b-701d0377f1dc]]
*Topic*: [[topic-pixel-town]]
