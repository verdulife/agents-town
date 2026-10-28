# Street catalogue (v2) — carriageway layout, markings and junctions

The tarmac stops being blank. This pass gives the street a layout (how wide, which way,
where it turns), paints the markings that layout implies over the asphalt the terrain
catalogue already makes, and adds the junctions the town needs. Same method as terrain
and buildings: a spec, a gallery page per idea, and a deterministic check per rule.

## Specs

S1. The catalogue exists because the empty carriageway shows: "el ancho de la calzada
sin marcas se nota: cuando entre el catálogo de calles, ahí van carriles, pasos de
cebra y plazas de aparcamiento" (carried from the terrain round, L2).

S2. A street is a layout, not a band. `src/next/streets.js` describes a road as a
segment — axis, width in whole tiles, span — and derives every anchor it paints from
that, so a marking is never guessed from painted pixels.

S3. The profile is the narrow Mediterranean street (P1, L4): **4 tiles of asphalt is
the town's carriageway**, 3 tiles is a one-way street, and **there is no centre line
anywhere**. What a street carries is its edge line, its zebras and its marked parking,
not lanes to overtake in.

S4. Markings are painted in world space, as one field over the asphalt, not as per-tile
decals. A decal is a 16x16 overlay and cannot continue into the neighbouring tile (the
two known limits in the terrain round, L7/L8); a lane line has to run. Only the cells a
marking actually touches are repainted, so the static floor stays one baked canvas.

S5. Vocabulary: edge line, zebra crossing with its stop line, parking-bay T marks, and
a hatched island for the one wide spot that needs it.

S6. Paint is pale and worn, mixed per cell with the asphalt under it, so a marking reads
as paint on tarmac and never as a sticker. Palette-only, like the floor.

S7. The card keeps its composition (field, sidewalk with the facades, kerb, asphalt,
stone square) and gains markings from the layout; every band still spans the map, so no
cell ever borders two different pairs.

S8. Junctions are part of this pass (P2, L4): corner, T and cross. Their rules — a stop
line before the zebra that crosses the entry, no paint inside the junction box, the
turning road inherits the width of the one that arrives, and the kerb mitres round the
corner with the same lip the terrain's curb treatment already paints.

S9. Diagonals are explored, not promised (P2, L4): a 45° road is a staircase of
straight runs, so its boundary steps a tile at a time and its markings follow the run
they belong to. They get their own page; if the stepped boundary or the paint reads
wrong at 2 physical px per art pixel, the finding is written down and the idea parked
rather than forced into the town.

S10. Determinism: same seed and layout, same pixels, and a marking lands where the
layout says it does. `tools/street-check.mjs` pins the width profile, the dash rhythm,
markings only over asphalt, a zebra always spanning the whole carriageway, no marking
inside the kerb's own pixels, junction rules, and palette-only colours.

S11. Review at `?gallery=streets&page=N`, with the same clickable page links the other
two galleries carry.

## Tasks

**Parked.** The pivot to a frontal scene (`odd/tasks/front-scene.md`, L1) took the street
catalogue out of the plan on 2026-10-27. Nothing of T1-T6 was implemented; the specs stay
here as reference for the street the front view will eventually need (a flat asphalt band
with markings, not transitions between materials).

| id | task | specs | route | commit |
| --- | --- | --- | --- | --- |
| T1 | `src/next/streets.js`: segment and lane model, the run/edge/box geometry, the marking painters, gallery page 1 (the vocabulary at 2x) and the `?gallery=streets` route | S2, S3, S5, S6, S11 | worker | `feat(streets): the road model and its markings` |
| T2 | gallery page 2: a composed street — a straight run with edge lines, parking bays and a zebra | S4, S5, S7, S11 | worker | `feat(streets): the composed street page` |
| T3 | gallery page 3: corner, T and cross with their stop lines and clean box | S8, S11 | worker | `feat(streets): junctions and their stop lines` |
| T4 | gallery page 4: the diagonal experiment, with the verdict written down either way | S9, S11 | parent | `feat(streets): the diagonal experiment` |
| T5 | mark the card's asphalt band from the layout, animated cells untouched | S4, S7 | parent | `feat(streets): mark the card's carriageway` |
| T6 | `tools/street-check.mjs` + `npm run street:check` | S10 | parent | `test(streets): pin the street rules` |

## Log

L1 (verbatim): "perfecto, creo que si que hay algunas correcciones pero prefiero seguir
abanzando y luego al verlo todo junto corregir"

L2: decision carried into this document — advance to the street catalogue now, and leave
the gallery's visual corrections (from the terrain and building passes) open and unnamed
until everything is looked at together (`odd/tasks/terrain-catalogue.md`, L14).

L3: L1 answers the previous turn's question ("¿arrancamos por el catálogo de calles?"),
so this pass starts now.

L4 (verbatim, the two answers that fix this pass):

- P1 — how the street reads: "Estrecha mediterránea: sin eje" (candidate: 3-4 tiles,
  kerb, zebra and marked parking, what the streets here actually have).
- P2 — junctions: "todo lo que propones y ver que tal las diagonales (si no son viables
  razonalo)", so corner, T and cross are in, and diagonals get a real attempt with the
  reasoning written down if they do not hold.

Derived: no centre line in the catalogue's default vocabulary (S3); the 4-tile
carriageway is the town profile; diagonals are an experiment with a written verdict
(S9), never a promise.

L5: T1 handed to a worker. Its gallery page is the vocabulary only; the composed street,
the junctions and the diagonal experiment are their own pages, so a bad marking is
corrected before anything composes it.

L6: parked before any code. The user pivoted to a frontal, cutaway street
(`odd/tasks/front-scene.md`), so a catalogue of road markings for a top-down map is no
longer the next thing. Nothing was implemented: the worker that was handed T1 was refused
by the harness for a malformed brief before it started, and no file was touched.
