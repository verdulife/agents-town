---
id: 327
type: decision
project: pixel-town
scope: project
topic_key: pixel-town/v2-gallery-art-passes
session_id: 01a17786-0605-719b-961b-701d0377f1dc
created_at: "2026-10-26 10:35:48"
updated_at: "2026-10-26 12:42:12"
revision_count: 5
tags:
  - pixel-town
  - decision
aliases:
  - "Catálogo v2 con tejados limpios (kit de azotea eliminado) y civic descartado"
---

# Catálogo v2 con tejados limpios (kit de azotea eliminado) y civic descartado

**What**: Catálogo v2 con **tejados limpios en todos los tipos** y **`civic` descartado**. Se eliminó por completo el kit de elementos de azotea: `roofProp`, `paintAntenna`, `roofPropSlots`, `PROP_W`, `ROOF_PROP_MARGIN`, `ROOF_PROP_SPREAD` y el bloque de props de `paintBlock`, además del campo `roofProps` en preset y spec. También se borró `paintHipRoof` y su rama (quedó muerta al irse civic, el único tipo con `roofStyle: 'hip'`). El catálogo queda en 7 tipos (house, townhouse, shop, apartment, warehouse, garage, hotel) y la galería en 21 variantes (3 páginas: 9 + 9 + 3 hoteles).
**Why**: Verdu pidió primero limpiar la página 3 y luego amplió: quitar los elementos de azotea de **todo el catálogo** y descartar los civic. Antes había aprobado la página 1 y la 2 (con placa solar y antena en apartments), así que esta ronda las revierte a propósito.
**Where**: `src/next/buildings.js` (kit de props fuera, `civic` fuera, `paintHipRoof` fuera), `tools/buildings-check.mjs` (17 checks; nueva regla "ningún edificio lleva props de azotea", `civic` ausente, `ROOF_STYLES` sin `hip`).
**Learned**:
- Al quitar civic hubo que decidir el alcance: `tank` seguía en uso solo por townhouse; se mantuvo mientras duró, y al ampliar la limpieza a todo el catálogo desapareció todo el kit. Lección: antes de borrar un painter, `grep` de su kind en los presets — un tipo aparentemente "de otra página" puede ser el único consumidor.
- La galería pagina 9 por página con `page` 0-indexado; con 21 variantes la tercera página lleva solo los 3 hoteles (leyenda `GALLERY 3/3 · 21 VARIANTS`).
- `roofStyle` sobrevive (gable/flat/shed) porque define la forma del plano de cubierta, no sus adornos.
- Verificación visual: páginas 0/1/2 de la galería y la tarjeta de calibración; capturas en `C:/Users/verdu/AppData/Local/Temp/pt-shots/final2-p{0,1,2}.png`, `final3-card.png`.
- El detector de regresiones útiles aquí es `tools/buildings-check.mjs`: 17/17 tras la limpieza, más `smoke` 12/12, `scale-check` y `walker-check`.

---
*Session*: [[session-01a17786-0605-719b-961b-701d0377f1dc]]
*Topic*: [[topic-pixel-town]]
