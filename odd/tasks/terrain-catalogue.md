# Terrain catalogue (v2) — ground, water and street surfaces

Extra review gallery for the town floor: ground materials, the 13-tile transition
sets between them, water, and the decals that sit on top of any of them. Same
method as the building catalogue: every material is a spec, the tiles are
generated, and a deterministic check pins each rule.

## Specs

S1. A gallery dedicated to the floor, not to buildings: "una galleria solo para
terreno, calles, haceras, jardineras, rios, etc." (R1).

S2. Transitions are 13-tile sets: "13 tiles" (R1) — fill, four straight edges,
four convex corners and four concave corners per material pair. Only the pairs
that really occur get a set (adjacency matrix, S6).

S3. Water is part of this pass: "entra el agua" (R1).

S4. Dry-stone walls and height steps are explicitly out of scope for this pass:
"si los apartamos explicitamente" (R1). They belong to a later vertical gallery.

S5. Micro-animations are part of the catalogue: "tambien pensaria en micro
animaciones para el agua, hierva, florecillas o similares (tienen que dar
riqueza sin ser pesados, piensa en algunos mas)" (R1). Budget in S7.

S6. Adjacency matrix for transitions — six pairs, not all against all:
`grass↔dirt`, `grass↔paving`, `paving↔asphalt` (the curb), `asphalt↔dirt`,
`grass↔water`, `stone↔water`.

S7. Animation budget, so richness never becomes weight:
- at most 4 frames per material, 2 is the norm;
- phase per cell from a hash of (tx, ty), never global: no field pulsing in unison;
- only animated cells are redrawn per frame; the rest of the floor stays one baked canvas;
- frames come from a `(frame, seed) => pixels` function, not hand-drawn sheets;
- `prefers-reduced-motion` and `?anim=0` freeze everything, and review captures use
  `?pause=1&sim=N` so a frame is reproducible;
- the gallery reports the animated-cell count per page.

S8. Nothing new enters the palette: the floor uses the five greens, five earths,
four greys and three waters that already exist.

S9. Every material generates deterministically: same seed and cell, same pixels.
Variant selection per cell is hash-based, so a field does not show a 2x2 repeat.

S10. The gallery is reachable from the existing entry point as
`?gallery=terrain&page=N`, leaving `?gallery=1` (buildings) untouched.

## Proposed animation set (pending approval, R1 follow-up)

| # | element | frames | fps | note |
| --- | --- | --- | --- | --- |
| 1 | river / canal current | 4 | 6 | highlight band travels along the flow |
| 2 | pond / still water | 4 | 2 | deterministic sparkles, no scroll: reads as still |
| 3 | banks and reeds | 3 | 2 | leaning with the same wind as the grass |
| 4 | puddles | 3 | 4 | concentric ring, only after rain |
| 5 | drain/grate | 2 | 8 | water falling, only when `rain > 0` |
| 6 | tall grass / scrub | 3 | 3 | per-cell phase makes a wave across the field |
| 7 | short grass | 2 | 2 | only ~20% of cells, very subtle |
| 8 | wildflowers | 2 | 1.5 | petal open/closed, plus a day/night state: closed at night |
| 9 | dry leaves | 3 | 3 | orientation frames, plus particles on windy weather |
| 10 | moss / weeds in joints | 2 | 1 | barely perceptible, sampling only |
| 11 | wet asphalt glow | 3 | 3 | lamp/neon reflection, only with rain or fog |
| 12 | snow | 0 | — | state (accumulation 0-2 + footprints), not frames |
| 13 | seasonal grass tint | 0 | — | palette swap by season/hour, not frames |
| 14 | puddles drying | 0 | — | three sizes over time after rain, not frames |

Rule of thumb that came out of the discussion: the urban floor does not breathe,
it only reflects; the natural floor breathes.

## Tasks

| id | task | specs | route | commit |
| --- | --- | --- | --- | --- |
| T1 | `src/next/terrain.js`: material spec + 12 base materials with variants, tile and patch generation, hash-based variant picker, gallery page 1 | S1, S8, S9, S10 | worker | `feat(terrain): material specs and the base grounds` |
| T2 | 13-tile transition sets for the six pairs, gallery page 2 | S2, S6 | worker | `feat(terrain): thirteen-tile transitions` |
| T3 | water: current, pond, banks, reeds, 4-frame animation, gallery page 3 | S3, S7 | worker | `feat(terrain): water with current, ponds and banks` |
| T4 | decals (grass tufts, flowers, cracks, patched asphalt, manholes, moss) + animation strips page | S5, S7 | worker | `feat(terrain): ground decals and animation strips` |
| T5 | wire the card's ground bake to the terrain catalogue and drive the animations from the sim clock | S7, S9 | parent | `feat(terrain): bake the card floor from the catalogue` |
| T6 | checks: determinism, complete and seamless transitions, animation frame budget, palette-only colours | S7, S8, S9 | parent | `test(terrain): pin the terrain rules` |

## Log

L1 (R1, verbatim): "ok, vamos a seguir. creo que lo mejor seria hacer una
galleria solo para terreno, calles, haceras, jardineras, rios, etc. antes de
generar nada, dime que terreno crees que tendriamos que generar?"

L2 (R2, verbatim): "13 tiles. entra el agua. si los apartamos explicitamente.
tambien pensaria en micro animaciones para el agua, hierva, florecillas o
similares (tienen que dar riqueza sin ser pesados, piensa en algunos mas)"

L3: decision adopted from L2 — 13-tile transitions (S2), water in (S3), dry stone
and height out (S4), animation budget written as S7, and the 14-item animation
set proposed above, awaiting an explicit yes before T3/T4 touch animation.

L4: T1 delivered (uncommitted, awaiting the visual pass). 12 materials, 618 lines
of specs and painters, 19 checks in `tools/terrain-check.mjs`, zero colour
literals. Two deviations from the letter of the spec, both accepted as
implementable-pixel compromises:
- paving's "2x2-tile module" is a joint lattice carried by the variants (slabs
  come out 1-2 tiles wide). A literal 2-tile period needs a 32x32 authored
  module; revisit if the pavement reads too small in the scene bake (T5).
- S5's "no 2x2 block repeats a variant" is impossible with three variants, so:
  four variants means four distinct in a block, three variants means at most two
  of a kind and never two touching. Off-grid windows can still close on one
  tile (~2% of windows, bounded by the check).
L5: T2 delivered (uncommitted, pending the visual pass). 13 masks per pair, eight curated
pairs, kerb and shore treatments as rules about materials rather than pair flags, and a
composed 10x6 blob that proves corners and pockets close. Checks went 19 -> 30. The three
open aesthetic questions from L4 were closed by hand first: asphalt aggregate is now clustered
in two-pixel bodies over dark slate instead of near-black single pixels, paving went darker and
cooler, and plaza warmer, so the three slab families no longer read alike. Decisions worth
keeping:
- `water` had to exist for the shore pairs, kept in `TERRAIN_EXTRA` so the "12 base grounds"
  rule stays honest; T3 promotes it and replaces the placeholder surface (it is deliberately
  flat and too saturated today: reads tropical, not Mediterranean).
- 13 names cannot cover 16 4-bit masks; the folding is documented and pinned by a check
  (5/10 keep their straight, 7/11/13/14 fold onto the opposite pocket, 15 folds to fill).
  A one-tile channel would get the folded tile, so the samples prune those shapes out.
- The straight-edge fringe shares one profile per (pair, side), which is what removes the
  seam step between neighbouring cells at the cost of a 16px repeat along a long bank.
- The kerb lip is 3px of pale stone with a 1px riser and shadow: it reads as a white-painted
  kerb, which is what the streets here actually have.
- Pair labels use `/` because the tiny face has no `>`.

L6: T3 in flight — water as a first-class material with a 4-frame current, still pond,
reeds, and the animation plumbing (`?anim=0`, frame from the sim clock) under S7's budget.

L7: T3 delivered (uncommitted, pending the visual pass). Water and pond are grounds (the
honest count is 14 materials, not 13: 12 dry + 2 waters), the crest travels with the clock,
the pond only twinkles in place, reeds are 3-frame decals, transitions carry the water's
frame while the land stays pixel-identical, and `frameIndex`/`cellFrame` live in the
catalogue so the mapping from time to frame is testable. Checks 30 -> 38.
Parent's own fix on review: `paintDrift` placed the crest at `frame*step + variant*3`, so
every cell with a different variant showed the crest in a different column and a field of
water read as a 16px lattice (visible in the stream patch crop). The crest position is now
`phase + frame*step`, with the phase supplied by the caller and stepped across the flow
(`waterPatch` gives each row `ty*5`, so the band is continuous along a row and leans across
rows). Known limit to revisit in T5: a per-tile sprite still repeats its sheen every 16 px
along the flow; a true world-space wave needs the bake to paint water as one field instead
of a grid of tiles.
Open for the review: the stream's cyan glitter is still the brightest thing on the page
(`C.waterLite` on three pixels per frame); if it reads too electric in scene, the fix is a
softer mix, one line in `paintDrift`.

L8: T4 delivered (uncommitted, pending the visual pass). Eight decals as transparent 16x16
overlays with `DECALS` metadata (frames, fps, states, grounds, weight), page 6 showing every
decal at 1x over grass and paving in each state it declares, plus a hashed dressed floor with
a legend derived from data. Flowers open/closed by state, the grate dry/wet, the rest static
or 2-3 frames. Checks 38 -> 47. Two notes for later:
- Naming wart: the shore reed kind and the grass decal are both called `tuft` (different
  sprites, split rate tables). Harmless today because both animate at 2 fps, but T5 should
  call them by distinct names when it wires reeds and decals into the bake (rename the reed
  kind to `sedge`).
- Known limit for T5, same family as L7: a decal is a 16px overlay, so a crack or a moss
  patch cannot continue into the neighbouring tile. Only the bake painting them as fields
  would fix that.

L9: T5 in flight — replace the card's hand-painted `bakeGround()` with a tile map painted
from the catalogue (materials, transitions, decals, reeds), with the animated cells redrawn
from the sim clock and everything else baked once.

L10: T5 delivered (uncommitted, pending the visual pass). `src/next/floor.js` splits the
floor into a deterministic material map, one static sprite and a list of animated cells (192
of 1305 on the card, against a 25% budget); `bakeGround()` is gone from `calibration.js` and
the readout prints the floor cost. Two catalogue edits came with it: the curated pair
`plaza>dirt` was appended (the card's plaza sits in the track, and both pair pages stay
byte-identical), and the reed kind `tuft` is renamed `sedge`, which closes the L8 naming
wart. `t5-sim2-a/b.png` are pixel-identical: the frame is reproducible.
Design note for the round after: the card's cross-section is forced by the curated pairs
(asphalt only meets paving and dirt, paving only grass and asphalt), so the street reads as
horizontal bands — dirt street, tarmac strip, sidewalk — rather than a street the buildings
face. It works as a lab and proves the catalogue composes, but the town layout should not
inherit that order.

L11: T6 closed. The rules T6 was meant to pin (determinism, complete and seamless
transitions, frame budget, palette-only colours) are already enforced inside
`tools/terrain-check.mjs` (47) and `tools/floor-check.mjs` (14); both are now reachable as
`npm run terrain:check` and `npm run floor:check` alongside the four existing scripts. The
whole terrain catalogue is green: 231 checks across six scripts.

L12: the street cross-section was reordered and adopted after a live trial in the card
(approved in R3). Top to bottom: field, **paving sidewalk with the building fronts on it**,
**kerb**, **asphalt road**, **stone square** with the street life (NPCs, kiosk, benches,
lamp posts, trees, bins, the walker), field again. Changes that came with it:
- `floor.js`: `SIDEWALK_ROWS = 3`, `ROAD_ROWS = 4`, `SQUARE_ROWS = 4`, the stack starting at
  `cy - 4`. Every band spans the map: an inset square under a full-width road makes road
  cells border both field and square, and one mask cannot draw two pairs.
- `calibration.js`: `STREET_DY = 46` moves the street group and the walker down onto the
  square. Without it the kiosk and the trees stood in the middle of the tarmac, which is
  what the first trial capture showed.
- two curated pairs the section needs: `plaza>asphalt` and `plaza>grass` (11 curated now).
- `floor-check` assertions rewritten for the new composition (the four materials, the four
  seams, plaza meets road and field). The mask assertion is honest now: a stack of
  full-width bands only ever needs `n` and `s`, and the convex corners and pockets stay
  proven by the gallery's composed sample and the pair checks.
Captures: `pt-shots/trial-street.png` (wrong: furniture on the tarmac),
`trial-street2.png` and `street-adopted.png` (adopted look).

L13: gallery pagination is clickable. The canvases used to print
`?gallery=terrain&page=0 · 1 · 2 …` at the foot of the page; the same navigation is
now a row of links in `calibration.html` (`#pages`), filled by `renderPageNav()` from
the mode's own page data: terrain labels each link with its page title, buildings with
the variant range, the current page is marked `aria-current="page"`, and the arrow at
either end is present but inert. Each link re-serialises `location.search`, so
`anim=0`, `pause=1&sim=N`, `zoom` and `target` survive a page change. Verified with
headless Chrome DOM dumps (6 terrain pages, 3 building pages) and the six check
scripts still green (231).
L14: Verdu's visual pass on the galleries is **deferred on purpose** — he wants to look
at everything together before correcting. Those corrections are open and unnamed; the
next pass (street catalogue) starts without them.
