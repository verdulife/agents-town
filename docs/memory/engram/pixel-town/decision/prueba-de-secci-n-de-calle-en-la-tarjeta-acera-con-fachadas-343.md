---
id: 343
type: decision
project: pixel-town
scope: project
topic_key: pixel-town/street-section-trial
session_id: 01a17786-0605-719b-961b-701d0377f1dc
created_at: "2026-10-26 18:50:57"
updated_at: "2026-10-26 18:50:57"
revision_count: 1
tags:
  - pixel-town
  - decision
aliases:
  - "Prueba de sección de calle en la tarjeta: acera con fachadas, bordillo, calzada y plaza"
---

# Prueba de sección de calle en la tarjeta: acera con fachadas, bordillo, calzada y plaza

**What**: Prueba en la tarjeta de la sección de calle "correcta": acera (3 filas) con las fachadas encima, bordillo, calzada de asfalto (4 filas) y plaza de piedra (4 filas) al otro lado, con el mobiliario (NPCs, kiosco, bancos, farolas, árboles, contenedores) y el walker desplazados +46 px para que pisen la plaza y no el asfalto. Dos pares curados nuevos: `plaza>asphalt` y `plaza>grass`.
**Why**: La composición que salió de T5 estaba forzada por los pares existentes (asfalto sólo toca acera y tierra; acera sólo hierba y asfalto), así que la tarjeta leía bandas horizontales (tierra, franja de asfalto, acera) en vez de una calle con las fachadas dando a la acera. Verdu pidió probarlo antes de adoptarlo.
**Where**: `src/next/floor.js` (`SIDEWALK_ROWS/ROAD_ROWS/SQUARE_ROWS`, `top = cy - 4`), `src/next/calibration.js` (`STREET_DY = 46` aplicado al grupo de calle y al walker), `src/next/terrain.js` (pares nuevos), `tools/terrain-check.mjs` (lista PAIRS de 10).
**Learned**:
- Estado: **prueba viva, sin adoptar**. Capturas: `pt-shots/trial-street.png` (primer intento, mobiliario sobre el asfalto) y `pt-shots/trial-street2.png` (con el mobiliario en la plaza, el bueno).
- Con la prueba puesta, `floor-check` queda 11/14 y `terrain-check` 46/47: las cuatro aserciones que fallan describen la composición vieja ("field, track, plaza, kerb, sidewalk", "el mapa sólo usa los cinco materiales", "cada costura es un par curado" y "la tarjeta sólo ejercita 2 máscaras"). Si se adopta, hay que reescribirlas; si no, se revierte con `C:/Users/verdu/AppData/Local/Temp/floor.js.bak` + deshacer el `STREET_DY`.
- Lección de encuadre: en esta tarjeta el ancho del mundo (29 filas) obliga a que la sección de calle ocupe 11 filas; el grupo de calle estaba a `CY+25..30`, justo donde caía la calzada, y hubo que bajarlo +46 px para que la plaza sea el sitio donde pasa la vida.
- El ancho de la calzada sin marcas se nota: cuando entre el catálogo de calles, ahí van carriles, pasos de cebra y plazas de aparcamiento.

---
*Session*: [[session-01a17786-0605-719b-961b-701d0377f1dc]]
*Topic*: [[topic-pixel-town]]
