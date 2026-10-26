---
id: 342
type: decision
project: pixel-town
scope: project
topic_key: pixel-town/terrain-catalogue
session_id: 01a17786-0605-719b-961b-701d0377f1dc
created_at: "2026-10-26 15:48:51"
updated_at: "2026-10-26 15:48:51"
revision_count: 1
tags:
  - pixel-town
  - decision
aliases:
  - "Catálogo de terreno: 13 tiles de transición, agua dentro, desniveles fuera y catálogo de micro-animaciones"
---

# Catálogo de terreno: 13 tiles de transición, agua dentro, desniveles fuera y catálogo de micro-animaciones

**What**: Plan cerrado de la galería de terreno v2 en `odd/tasks/terrain-catalogue.md`. Decisiones de Verdu: transiciones de **13 tiles** (relleno + 4 lados + 4 esquinas convexas + 4 cóncavas), **el agua entra** en este pase, **piedra seca y desniveles explícitamente fuera** (galería vertical posterior), y **micro-animaciones** con presupuesto (máx. 4 frames, norma 2, fase por celda por hash, sólo se redibujan las celdas animadas, frames generados por función, `prefers-reduced-motion` y `?anim=0` congelan, capturas con `?pause=1&sim=N`).
**Why**: Antes de generar había que fijar el alcance y el coste real (las transiciones son lo caro, no los suelos).
**Where**: `odd/tasks/terrain-catalogue.md` (specs S1-S10, tareas T1-T6, log L1-L3). Futuro `src/next/terrain.js`; galería en `?gallery=terrain&page=N` sin tocar `?gallery=1`.
**Catálogo de animaciones propuesto (14 elementos, pendiente de aprobación explícita)**: 1 río/corriente (4 f, 6 fps, banda de brillo que viaja), 2 estanque (4 f, 2 fps, destellos deterministas sin scroll), 3 orillas y juncos (3 f, 2 fps), 4 charcos (3 f, 4 fps, sólo tras lluvia), 5 alcantarilla (2 f, 8 fps, sólo con `rain > 0`), 6 hierba alta/matorral (3 f, 3 fps, fase por celda → oleada), 7 hierba baja (2 f, 2 fps, sólo ~20% de celdas), 8 florecillas (2 f, y estado día/noche: cerradas de noche), 9 hojas secas (3 f + partículas con viento), 10 musgo en juntas (2 f, 1 fps, muestreo bajo), 11 asfalto mojado (3 f de reflejo de farola/neón, sólo lluvia/niebla), 12 nieve (estado 0-2 + huellas, sin frames), 13 tinte estacional de hierba (paleta, sin frames), 14 charcos que se secan (3 tamaños temporizados).
**Regla de diseño derivada**: lo urbano no respira, sólo refleja; lo natural respira.
**Suelos base acordados**: naturales (hierba 4 variantes, tierra/camino, grava, arcilla roja, roca desnuda, matorral) y urbanos (asfalto 3 desgastes, acera losa 2x2, hormigón, adoquín 2 patrones, piedra de plaza, bordillo con variante rebajada), más agua (río recta H/V, 2 curvas, orilla de hierba y de piedra, estanque) y decals (matas, flores, grietas, parches, alcantarilla, musgo, nieve/escarcha).
**Matriz de adyacencia (6 pares)**: grass↔dirt, grass↔paving, paving↔asphalt (bordillo), asphalt↔dirt, grass↔water, stone↔water.

---
*Session*: [[session-01a17786-0605-719b-961b-701d0377f1dc]]
*Topic*: [[topic-pixel-town]]
