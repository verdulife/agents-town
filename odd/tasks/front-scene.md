# Front scene (v3) — one street, seen from the front

The town stops being a top-down game. It becomes a single frontal cutaway of a street —
offices, cafeteria, gym, an alley and the sky — where each NPC shows what an agent is
actually doing, and the pixel displays (LCD, clock, thermometer) show real data. This
document covers the pivot: routes, the global menu and the new palette. The first
building comes after the palette is approved.

## Specs

S1. What the scene is for: "la finalidad de este pixel town es sincronizar las tareas que
estan haciendo como exploring, working, implementing, idle, etc con las de un npc dentro
de ese mundo ficticio y aprovechar para usar alguna pantalla lcd, reloj analogico o
termometro pixelart para mostrar datos del mundo real".

S2. One street, seen from the front, not a world you walk: "en lugar de hacer un pixel
town top down game, que tal si limitamos el movimiento a una vista fronta".

S3. The cast of buildings: offices in the middle ("las oficinas seran de 5 plantas, y la
quinta sera un rooftop donde podemos añadir un gato y alguien que sube a fumar
eventualmente"), the cafeteria on one side ("la cafeteria sera solo de 2 plantas, la baja
sera la cafateria y la de arriba un piso"), the gym on the other ("el edificio del gym
puede ser de 2 o 3 plantas aunque solo usaremos la planta baja, asi en las otras podemos
añadir una pantalla publicitaria enorme"), and the alley between offices and cafeteria
with "el tipico cartel grande vertical de 2 plantas de hotel para usarlo de termometro o
similar".

S4. Inside a floor: "una habitacion principal y de 1 a 2 habitaciones pequeñas (aqui es
el ncp-agente se moveria entre habtaciones y toquetearia maquinas simulando trabajar)".
Offices are cut open like a dollhouse, and the cafeteria and gym show their interior
through their large windows.

S5. The sky is part of the canvas, so day, night and weather have somewhere to happen:
"eso nos deja algo de espacio para el cielo y asi podremos mostrar dia/noche, llubia y
otros fenomenos".

S6. Web addresses are paths, not files: "en lugar de usar .html en la url usemos rutas
con /gallery y creemos un menu global para viajar a cualquier lugar". Each place answers
at one clean path and every page carries the same menu.

S7. The places are individual documents, not a single-page app: "no hace falta que sea un
spa, pueden ser paginas individuales". The build must emit every page, and no route may
depend on a server rewrite.

S8. The palette is regenerated for the new direction — "tenemos que regenerar la paleta
de colores, para que tenga es toque mas de ciudad cinematografica en pixelart" — and it
lives in its own module so the old diorama keeps the look it was approved with.

S9. The palette is reviewed before it is used: "que te parece si primero creamos un
/desing-system y me muestras ahi la paleta en pixel art con algunos ejemplos?". The page
shows the ramps, the pairs that must never touch, and real material drawn by the
renderer — not swatches alone.

S10. The architecture of S7 is chosen for what is optimal, not for fashion: "lo que sea
mas optimo". Pages share only the menu, so a menu module and Vite's own multi-page build
carry them; no router, no fallback rewrite, no new dependency.

S11. Nothing new is drawn until the design system is approved: "no apliques nada, solo
dime que me sigues y empezamos con un edificio solo".

S12. The first building built is the cafeteria alone, with a person inside and a person
outside, and its only job is to answer one question: does the scale work? "crearia la
pagina que solo tenga la cafeteria de 2 plantas + azotea con un ncp dentro de la cafeteria
y uno fuera para poder ver la escala".

S13. The cafeteria is drawn at a larger scale than the street elevation, on purpose: the
window has to show people sitting at tables without a zoom. "un edicicio con un nivel de
escala diferente, bastante mas grande para que tengan espacio suficiente como para poder
ver a los npc por la ventana sentarse e una mesa a tomar cafe".

S14. The ground floor is one large window carrying three tables for two, plus the door:
"un ventanal enorme con 3 mesas para dos personas y la puerta". The upper floor is a flat
and the roof is a terrace ("2 plantas + azotea").

S15. The prototype is judged by eye before anything else is drawn: "vamos hacer este
prototipo y te digo que tal lo veo".

S16. The street is checked on the same page, not on a new one: the cafeteria keeps its art
and the offices and the gym are added as silhouettes, so the one question is answered —
does the whole street fit? "no, reutilizamos esta misma pagina. y aprovechamos para crear
solo la silueta de los otros edificios y el callejon, asi vemos bien si entra todo".

S17. The cafeteria and the gym may sit against the edges of the view: "tanto el gym como la
cafeteria pueden estar tocando a los limites". The alley, with its two-storey vertical
sign, separates the cafeteria from the offices.

S18. Whether it fits is answered by numbers, not by squinting: every block prints its width,
its height and its floor count, and the page says FIT or OVERFLOW against the view's own
height. A building that does not fit is a finding, not an error to paper over.

S19. The flat above the café carries life of its own: its two windows are **centred in the
storey** and a little further apart, and an **air-conditioning unit with a spinning fan** sits
on the brick between them, animated under the floor's own animation budget (`?anim=0` freezes
it, `prefers-reduced-motion` freezes it, `?pause=1&sim=N` reproduces a frame exactly).

S20. The vertical sign — the thermometer placeholder — is **dropped**: "quitamos el termometro
analogico". Real data will live on the LCD screens and the clock instead. The alley is built as
a place instead: "me imagino el callejon con un muro al final, de 1 piso de altura y mas oscuro
por la no iluminacion del callejon y la sobre de los edificions que lo rodean, ademas de la
profundidad. ese muro tendria un grafiti de un mustache en color magenta ligeramente rotado. en
el lado de la cafeteria un contenedor de basura de perfil, el tipico de callejon con alguna
bolsa asomando o fuera apollada".

S21. The gym is a modern, almost-glass building: "un local de color gris y gris claro con acentos
de naranja casi rojo para lo corporativo. a la izquierda una puerta doble grande toda de cristal y
luego un ventanal enorme en lo que resta, en este caso si que llegaria casi de toda la altura de la
planta sin zocalo. la segunda planta sera todo un ventanar con el mismo estilo pero ocupando casi
todo el ancho". Inside, seen through the glass: a reception counter behind the door, the stairs up
and a couple of treadmills on the ground floor; the stair arrival — which must line up with the
flight below — plus weights and bikes above. The huge advertising screen moves to the **roof**,
on a steel structure (L22), now that both floors are glazed and in use.

S22. The café's terrace gets its stair bulkhead — "en el tejado de la cafeteria falta la tipica seta de
tochos con puerta metalica que es donde darian las escaleras internas" — on the **left**, and the old
chimney and the potted plant go (the plant is the thing that "no distingo que es"). On top of the
bulkhead stands a flue with a **rotating ball** ("una de esas que son como un tubo y una bola arriba
que da vuelta, esa que es la salida de humos"), animated, with "un humo sutil y disperso que salga de
ahi". From the bulkhead runs a **clothesline to a post with two small garments hanging**. And a
**black cat** lives on the roof: "que pasee por el muro, descanse, vuelva a pasear, una rutina con
tiempos muy largos".

S23. Rooms carry their purpose as a label — "me gustaria probar de etiquetar cada habitacion con su
proposito, pero en lugar de hacerlas todas probamos solo con 1 para ver que tal. quiero algo lo mas
pequeño posible para que se lea pero sin que rompa la estetica". The trial is one room, chosen in
`OFFICES.labels` and nowhere else, and it must survive the glass in front of it: the mullions are
the facade's and a label behind them has to be placed so a bar falls in the air between two glyphs,
never across one.

S24 (verbatim): "ahora vamos a crear un pequeño parque con arboles y una fuente a la derecha del
gym". The park is the strip the frame leaves to the right of the gym — `viewW - 822`, the leftover
past café 192 + alley 88 + offices 302 + gym 240 — so it appears on wide views and does not exist on
narrow ones. The gym stops absorbing that leftover and keeps its own 240. The fountain's jet is
3 frames on the page's fixed clock, so `?anim=0` and `?pause=1&sim=N` stay reproducible.

S25. The street's floor is painted, not tiled: "la acera y el asfalto se ven fatal, cumplen con la
logica pero no me gustan nada". Direction A + C of the proposal — a ground with its own contract and a
wet road that carries the street's light: "quiero quede bien integrado, con las sombras y la
iluminacion bien hecha como pasa en el callejon", with the night street of `refs/background.webp` as
the reference. The pavement, the kerb and the road are drawn at the elevation's own scale with fixed
art-pixel bands (the fade below the road absorbs whatever height the frame has left), every block
casts its own contact shadow, the alley spills ink where the light does not reach, and the wet road
takes the horizon colour of the current sky ramp plus the reflections of the street's own lit windows
and lamps. No terrain tile is used on this page.

S26. The sky is rebuilt from nothing: "no me gusta nada el cielo que tenemos ... quiero que identifiques
todo y que me propongas una version que use edificios lejanos con iluminacion animada y sobretodo el
tipo de cielo con nubes". Decisions taken with the proposal: the four moments stay fixed and the
contract is ready for a real hour later; the distant city is a decorative layer of the sky and not a
block of the street (the layout is untouched); everything moves, subtly — "todo animado sin ser
exagerado, solo feeling de algo vivo"; and all four moments are drawn with the same care. The
reference is `refs/background.webp`, measured rather than imitated: its ramp's steps, its underlit
clouds, its three hazy planes of city and its 1 px lights are taken; its noise (35 396 tones in the
sky region), its pure white and its saturation are not.

S27. The scene's light is one contract and two maps: "iluminacion global para que todo gane profundidad y
se vea afectado por la hora del dia, incluye sombras y iluminacion de ventanas, interiores etc y como
afecta a su entorno". It is done in phases and `?light=0` is the way back to the plain scene: the first
phase is the ambient of each moment, the cast shadows and the pools the glass throws on its own pavement;
the second gives every module a way to DECLARE its lit regions so the ambient can spare the interiors.

## Tasks

| id | task | specs | route | commit |
| --- | --- | --- | --- | --- |
| T1 | paths and pages: `/`, `/gallery/card/`, `/gallery/buildings/`, `/gallery/terrain/`, `/design-system/`, `/archive/`, the shared menu and the multi-page build | S6, S7, S10 | parent | `feat(shell): paths, pages and the global menu` |
| T2 | `src/next/palette.js`: the cinematic palette, its ramps, the forbidden pairs and the brand accent; v1's diorama keeps `src/palette.js` | S8 | parent | `feat(palette): the cinematic city palette` |
| T3 | `/design-system/`: ramps, forbidden pairs and real material drawn by the renderer | S9 | parent | `feat(design-system): show the palette on real material` |
| T4 | `/cafe/`: the cafeteria at its own scale — window, three tables for two and six diners, the door, the flat above, the terrace | S12, S13, S14, S15 | worker | `feat(cafe): the cafeteria at its own scale` |
| T5 | the same page as the whole street: cafeteria at the left limit, alley, offices and gym, with FIT/OVERFLOW verdicts behind `?debug=1` | S16, S17, S18 | worker | `feat(street): does the whole street fit` |
| T6 | the alley: one-storey back wall behind the street, shade, moustache, dumpster, drain (the vertical thermometer sign dropped) | S20 | worker | `feat(alley): the passage behind the street` |
| T7 | the gym: two glazed floors, grey structure, corporate accent, counter, stairs that line up, treadmills, weights, bikes, roof screen | S21 | worker | `feat(gym): glass, machines and a roof screen` |
| T8 | the café's terrace: stair bulkhead behind the wall, flue with a turning ball, smoke, clothesline with two garments, black cat on a 220 s routine | S19, S22 | worker | `feat(cafe): a lived-in roof` |
| T9 | the offices: four floors, 302x326 — entrance only on the ground floor, one lift inside on every floor and no stairs, working as a whole open-plan floor, the other four states in two split floors | S3, S4, S5 | worker | `feat(offices): four floors, the lift inside and the brick bookends` |
| T10 | the offices' furniture pass: the duct collars at 2x, the 1 px desk props, planning vs implementing telling apart, the sofa against the TV, and leave detail on the lift | S3 | worker | not started |
| T11 | the offices' room labels: all six on the tiny 3x5 face, each on a plate that hugs it in the cladding band above its own window; the working floor's second desk row removed (it read as floating) | S23 | parent | not committed |
| T15 | the scene's light, phase 1: `src/next/light.js` — the ambient of each moment, the cast shadows (away from the sun or the moon), the pools of the glass on the pavement, composed over the street only and switchable with `?light=0`; `tools/light-check.mjs` | S27 | worker | not committed |
| T14 | the sky: `src/next/sky.js` — the ramp resolved into ten bands, the stars in three frames, a 3 px moon, the cirrus, two drifting cloud banks lit from underneath, the horizon haze and the distant city in three planes with window groups and beacons coming on and off; plus `tools/sky-check.mjs` and the page's second still so the sky can move behind the street | S26 | worker | not committed |
| T13 | the street's ground: `src/next/ground.js` — contact shadows per block, the alley's ink spill, two courses of slabs, the kerb and gutter with their grate, a wet road with the sky and the street's lights in it, and a foreground that falls into ink; `tools/ground-check.mjs` | S25 | worker | not committed |
| T12 | the park to the right of the gym: grass, hedge, 1-4 seeded trees, a stone fountain with a 3-frame jet, a bench, a lamp when it fits; the strip is derived from the view's leftover width | S24 | worker | not committed |

## Log

L1 (verbatim): "usando la estetica que ya hemos creado y adaptado algunos elementos, en
lugar de hacer un pixel town top down game, que tal si limitamos el movimiento a una vista
fronta? lo unico que necesitariamos representar seria una calle, donde de forma
protagonosta tendriamos un edificio que serian las oficinas, y a cada lado una cafeteria y
un gym. la cafeteria y el gym solo mostrarian el interior atraves de un gran ventanal, pero
el edificio estaria abierto como hacian en rue 13 del percebe, y aqui tendriamos varias
plantas, cada una para una tarea diferente y dentro de cada planta una habitacion principal
y de 1 a 2 habitaciones pequeñas (aqui es el ncp-agente se moveria entre habtaciones y
toquetearia maquinas simulando trabajar). luego tendriamos la calle donde pensaremos que
detalles podemos añadir, un callejon entre las oficinas y la cafeteria donde podemos
aprovechar para añadir el tipico cartel grande vertical de 2 plantas de hotel para usarlo de
termometro o similar. el edificio del gym puede ser de 2 o 3 plantas aunque solo usaremos
la planta baja, asi en las otras podemos añadir una pantalla publicitaria enorme. las
oficinas seran de 5 plantas, y la quinta sera un rooftop donde podemos añadir un gato y
alguien que sube a fumar eventualmente. la cafeteria sera solo de 2 plantas, la baja sera
la cafateria y la de arriba un piso. eso nos deja algo de espacio para el cielo y asi
podremos mostrar dia/noche, llubia y otros fenomenos. no apliques nada, solo dime que me
sigues y empezamos con un edificio solo"

L2 (verbatim): "vale, en lugar de usar .html en la url usemos rutas con /gallery y
creemos un menu global para viajar a cualquier lugar. creo que para que nos encaje bien
este cambio de rumbo tenemos que regenerar la paleta de colores, para que tenga es toque
mas de ciudad cinematografica en pixelart. que te parece si primero creamos un
/desing-system y me muestras ahi la paleta en pixel art con algunos ejemplos?"

L3 (verbatim): "no hace falta que sea un spa, pueden ser paginas individuales"

L4 (verbatim): "lo que sea mas optimo"

L5: decisions taken from L1-L4 — the top-down scene (`floor.js`, `walker.js`,
`topdown-sprites.js`) is not deleted but stops being the product; the street catalogue is
parked (`odd/tasks/street-catalogue.md`); the buildings catalogue is the material that
survives, because it was always painted as an elevation.

L6: the one thing L1 does not mention and the cutaway cannot work without: vertical
circulation drawn inside the building. A floor-by-floor dollhouse needs a staircase or a
lift, otherwise the NPC jumps between floors and the whole point of the scene (watching
work happen) reads as a teleport. Decided: stairs and a lift are part of the offices,
drawn in the cutaway, and the NPC uses them.

L7: `/` is a hub until the street exists; when the scene lands it takes the root and the
hub disappears, because the menu already reaches every place.

L8: T1-T3 delivered and verified (47+14+17+12+124+7 checks, six-page build, menu
`aria-current` correct at every depth, palette v1 untouched for `/archive/`). Two
corrections came out of the first visual pass and are applied: both galleries reserve
`GALLERY_TOP_ROOM = 26` art px so the fixed menu never covers a caption, and the design
sheet gained a page title.

Deferred on purpose (L1: look at everything together before correcting), recorded so they
are not lost:
- `/gallery/terrain/?page=5` — in the decal legend the words MANHOLE and GRATE clump into a
  smudge at 2x. Pre-existing, not caused by the reserved strip. The fix is a separator in
  the legend join, one line.
- `/gallery/buildings/` — the top captions clear the menu by ~22 px: correct today, thin if
  the menu ever grows.
- `/design-system/` — the sheet plus its title pushes the `every key` table fully below the
  fold at 1820x1160. Scroll only, nothing clipped.

Open gate: the palette is on screen and awaits Verdu's verdict. Nothing new is drawn until
it is approved (S11), so T4 (the offices) has not started.

L9 (verbatim): "ahora crearia la pagina que solo tenga la cafeteria de 2 plantas + azotea
con un ncp dentro de la cafeteria y uno fuera para poder ver la escala. Aqui tenemos que
crear un edicicio con un nivel de escala diferente, bastante mas grande para que tengan
espacio suficiente como para poder ver a los npc por la ventana sentarse e una mesa a tomar
cafe. creo que haria que sea un ventanal enorme con 3 mesas para dos personas y la puerta.
vamos hacer este prototipo y te digo que tal lo veo"

L10: decisions from L9 — the cafeteria is built before the offices and at its own larger
scale; the palette therefore gets approved by using it, not by looking at the sheet. The
scale contract for the prototype, so the numbers can be discussed instead of felt: person
14x30 (the street elevation's is 10x21), door 14x34, interior floor height 84, window
150x62 with its sill 14 above the floor, a table group 34 wide (chair, person, table,
person, chair) at a 40 pitch, three of them, the ground floor 224 wide, the flat above 84
high, a 10 slab and a 14 parapet on the terrace. The page prints those numbers under the
building, so "no cabe" or "sobra aire" becomes a number to change.

L11 (verbatim): "no, reutilizamos esta misma pagina. y aprovechamos para crear solo la
silueta de los otros edificios y el callejon, asi vemos bien si entra todo. tanto el gym
como la cafeteria pueden estar tocando a los limites"

L12: derived from L11 — no separate scale sheet; `/cafe/` becomes the whole street at the
same scale. Order left to right: cafeteria against the left limit, the alley with the
two-storey vertical sign, the offices five floors plus rooftop, the gym against the right
limit with the billboard above its unused floors. The floor height stays at the cafeteria's
84 for this check, because the point is to see what that number costs: 5 x 94 = 470 for the
offices alone, against the 487 art px the view has at 2 physical px per art pixel. If it
overflows, the page must say so in numbers (S18) rather than hide it.

L13 (verbatim, same round): "creo que tenemo que rediseñar las puertas para que encajen en
la nueva estetica", "una textura de pared marron con algunos tochos a la vista, como un pub
clasico", las dos plantas iguales, y "el tamaño de la planta podria ser ligeramente mas
pequeño". Held until the scale verdict, per L12: the texture budget depends on how many
pixels a floor gets.

L14: massing check delivered (T5) and the verdict is numeric, measured against the room
above the ground line (406 art px of the 487 the view has; the rest is pavement and road):

| block | width | height | verdict |
| --- | --- | --- | --- |
| cafeteria | 224 | 215 | fits |
| alley (+ 188 sign) | 56 | 188 | fits |
| offices, 5 floors + roof | 280 | 500 | **overflow 94** |
| gym, 2 floors + billboard | 262 | 228 | fits, ~180 px of sky left above it |

The width is exactly 822 with nothing left over: the four blocks touch each other, and the
cafeteria and the gym touch the edges. So the horizontal question is answered — it fits,
barely — and the vertical one is not: at floor 84 the offices need 94 px they do not have.

Derived retune, held for the user's verdict: **floor 84 -> 64, slab 10**, uniformly. Offices
become 5 x 74 + 30 = 400 (6 px of margin), the cafeteria 2 x 74 + 24 + 3 = 175, and the
person at 30 goes from 36% of a storey to 46%, which is the proportion a room actually has.
The sill can then drop from 14 to ~4 with a 52-56 window, which is the other half of the
cafeteria finding: at these numbers the seated person gains about 20 art px of body above
the table.

L15: the cafeteria is closed at these numbers, and the street now fits. Applied in one pass
(T6):

- **vertical**: floor 64, slab 10, base 3; flats's floor 98, café ceiling 108, floor line 172,
  building **192x175**; parapet 14 (now brick with a stone coping).
- **horizontal**: pier 20 | door bay 30 | window 122 | pier 20 = 192; the **alley 56 -> 88**,
  which is the width the user asked for by removing the two narrow end lights.
- **glazing 118x52**, sill **4**, three 38 panes with two 2 px mullions; the table groups stay
  34 wide at a 40 pitch, **three tables, six people**, because 38 panes hold a 34 group — the
  user was right and the earlier "three groups do not fit" worry was the parent's mistake.
- **door leaf 18x40** in a 30 bay, redesigned as a café door: wood architrave, glass leaf with
  a mid rail, brass pull, brass kick plate, stone step, the wall lamp kept.
- **facade**: old New York brick on both floors, running bond ~8x3 with 1 px mortar, seeded
darker and paler bricks, chipped "tochos", soot under the flat's sills, a soldier course under
  the window head. The interior is unchanged, only re-anchored to the narrower glazing.
- **overhangs**: plinth 3, string course 3, cornice 4, each with a lit top and a 3-row shadow,
  so the silhouette is not a straight rectangle.
- the street readout now says **OFFICES 5F 240x400 FIT** against the 406 art px above the
  ground line (was OVERFLOW+94), and the gym 302x188 FIT. Width still 822 exactly.
- the readout plate moved to the **bottom right**: on the left it covered the door and the
  nearest table, which are the two things being judged.

Open on purpose: the seated figure is 14x38 against a standing 14x30, because a 22 tabletop
plus "a body you can read above it" needs the head at floor+42. The gain is real (34 art px
of visible body through the glass, against 13 before) but a strict scale reading has a sitter
taller than a stander. If that bothers the eye, seatedH 38 -> 34 costs about 4 px of body and
buys a defensible proportion.

L16: the café is closed, and the open question of L15 was answered by the user for a reason
worth keeping: **the same NPC will walk from the offices, come in through the door and sit
down**, so one body has to serve standing and seated. Verdict: realistic, not bar — table low,
sitter shorter than stander.

Final contract (all in `CAFE`, nothing written twice):

| | value |
| --- | --- |
| storey | floor 64 + slab 10 = 74 |
| building | **192 x 172**, its bottom row on the pavement (terrace 24 + 10 + 64 + 10 + 64) |
| plinth | **5 px stone band** over the bottom of the façade, continuous the full 192, 3 px proud |
| wall split | 16 brick · **door leaf 18** · 16 brick · window 122 |
| window | glazing **118 x 44**, sill **10**, head 6 under the string course, 5 px of brick over the plinth |
| panes | three 38 panes, two 2 px mullions, pitch 40 |
| table | **16 wide, surface 14** above the floor, slab 3 |
| bench | shared **2 px back** between neighbouring tables (back to back), seat 8 |
| people | stander **14x30**, sitter **14x26**, six diners at three tables |
| overhangs | plinth 3, string course 3, cornice 4, each with a shadow |

Two defects were caught by eye at zoom 4 and fixed, both of them bad briefs from the parent:

- the plinth had been turned into an **18 px podium** to make the height add up, which lifted
the whole café (and the person on the pavement) off the street. A plinth is a band over the
façade, never a base under the floor: the floor line is the street line.
- "stand clear of the door" was read as "stand far from the door" and put the standing person
**in front of the middle pane**, where he read as a diner behind the glass. Now he stands in
the 16 px brick pier between door and window (`standX` 35..48), with brick behind him.

The street check reads `CAFE 192X172 FIT · ALLEY 88 · OFFICES 5F 240X400 FIT · GYM 2F 302X188
FIT · VIEW 822X487 · ABOVE GROUND 406`, and the café is considered closed by the numbers. The
last word is the user's eye: the next pass is the offices.

L17 (verbatim): "perfecto! las separamos un poco entre ellas y añadimos un AC y que tenga las
aspas animadas?"

L18: from L17, and after the flat's windows were reported off-centre — the sill is now derived
(`upperTop + (floorH - winH) / 2`, so 19 px of brick above and below) instead of the 28 that
left them hanging 10/28. The gap goes 44 -> **56**, so the two 34-wide windows sit at 34..68 and
124..158 with **56 px of brick between them**, which is the room the AC unit needs. The unit is
20x13 on that brick with a 4-frame fan at 6 fps; the fan is painted by the page, not baked into
the cached sprite, so the frame is the only thing that changes between draws.

Delivered and measured: windows at 34..68 and 124..158 (56 of brick between), AC casing 86..105
x 55..67, fan 8 px at 88..95 x 58..65 turning 45 degrees per frame. The proof that the
animation lives is a CDP sample of the unpaused page (f0 f0 f1 f1 f1 f2 f2 f2 f3 f3 f0 f0, ~165
ms per frame) plus four paused captures of which f0 and f3 differ **only** inside the fan box;
`?anim=0` is byte-identical to f0. One readout deviation: the tiny face has no `@`, so the line
reads `AC 20X13 FAN 4F 6FPS`.

L19: the alley is built (T8) and the thermometer is gone for good — the neon sign, its frame,
its ticks and `paintSign` were deleted from `street.js`; the alley block keeps its 88 and its
readout line. Real data will live on the LCD screens and the analog clock instead.

`src/next/alley.js` is a niche in three planes: **left return 8** (the café's flank, in hard
shadow, up to its roof), **right return 8** (the offices' flank, darker and higher), **back wall
72 x 64** — exactly one storey, with a coping — in cold unlit brick, sky above it inside the
slot. Floor band 10 of wet dark paving with a 4x3 drain, the alley two steps darker than the
street, and the offices' cast shadow across the right half of the back wall. The graffiti is a
magenta moustache about 30 x 9, rotated 8 degrees, with drips and a touch of transparency. The
dumpster stands in profile against the café's side: 26 x 20, lid ajar, two wheels, one bag on
top and one leaning at its foot.

Verified after a worker timeout interrupted its own report (the files were already written):
`node --check` on the three modules, the page at 200, and 47 + 14 + 17 + 12 checks green. The
scene is clean by default; `?debug=1` still prints the numbers.

L20: the two return strips are **gone**. Drawn as 8 px flanks they did not read as depth: they
read as two black columns standing in the gap, which is what the user saw and asked to remove
("solo hay que quitar esas columnas negras que no entiendo"). `ALLEY.returnW` is 0, so the back
wall spans the whole 88, the sprite is only as tall as its own wall + coping + floor (78), and
the depth is carried by the wall's shade bands, the offices' cast shadow and the floor. The
contact shading at both ends of the wall stays: 2 columns of ink, not a strip. Verified at zoom
4 (no black column anywhere, the 88 wall with its coping, the moustache and the dumpster still
in place) and 47 + 14 + 17 + 12 checks green.

L21: the two silhouettes swapped widths and the offices lost a storey, on purpose (the user's
reason was still to come): offices **5 -> 4 floors** and **240 -> 302 wide**, gym **302 -> 240
wide**. With `FLOOR_H` 64 + `SLAB_H` 10 the offices are now 4 x 74 + 30 = **326 tall** against the
406 above the ground line, so they fit with margin, and the block reads wide and squat instead of
tall and narrow (`OFFICES.aspect` 0.56 -> 0.926, which is 302/326 by construction). Layout at
822x487: CAFE 0..192, ALLEY 192..280, OFFICES 280..582, GYM 582..822 — still exactly 822 with
nothing left over. 47 + 14 + 17 + 12 checks green.

Loose ends for the detail round the user announced:
- the **bag on the dumpster** reads as a lump: it needs a knot, a fold or a lighter top edge;
- the **alley floor** could take one more step of falloff towards the back so the mouth and the
end are not the same value;
- the alley's own **light** (a caged lamp on the back wall) is not drawn; the sign used to be
the only thing glowing there.

L22 (verbatim): "luego. ahora vamos con el gym. aqui yo me imagino un local de color gris y gris
claro con acentos de naranja casi rojo para lo corporativo. a la izquierda una puerta doble grande
toda de cristal y luego un ventanal enorme en lo que resta, en este caso si que llegaria casi de
toda la altura de la planta sin zocalo. la segunda planta sera todo un ventanar con el mismo estilo
pero ocupando casi todo el ancho. quedara un edificio moderno casi de cristal. en la planta de abajo
por la puerta se vera un mostrador, luego por el mentanal unas escalera que suben a la planta de
arriba y un par de maquinas de correr. en la planta de arriba se vera la salida de las escalera
(tiene que encajar con la planta de abajo) y mas maquinas, de pesas, bici o similar."

L23: with both gym floors glazed and in use, the screen that was going to sit on the unused upper
floors had no home. Asked and answered: "Al tejado, sobre estructura metálica" — a steel frame above
the cornice carrying it, which costs about 40 px of height (the gym stays 188, the same it already
had, so the street still fits with room to spare).

L24: the gym is built (`src/next/gym.js`, 240x188): two glazed floors, grey steel structure, the
corporate accent in doses, and the roof screen on three legs. Numbers worth keeping: building
0..39 screen / 40..49 cornice / 50..113 upper floor / 114..123 slab / 124..187 ground floor; door
bay 4..49 (46 wide, 58 tall, no plinth), window 54..229 with eight 20-pane lights at a 22 pitch,
upper band 10..229 (220 wide, 218 of glass) whose mullions land on the ground floor's own; counter
8..47; **stair 150..209 on both floors**, twelve 5 px treads, the top step's surface exactly on row
114 (the slab) and the upper floor's well + railing over the same columns; two treadmills, a 48x36
weights rack and two bicycles inside; screen frame 168x28 on a beam over three 9 px legs. The
palette gained `brandDark`/`brand`/`brandLite` (#a8381f / #d0552a / #ef7b3f) and a `brand` ramp, so
the design sheet documents the accent too — which pushed its last ramp row onto the "pairs" header,
fixed by moving that block 16 px down.

L25: the terrace is a lived-in roof. The old vent pipe and the potted plant are gone (the plant was
the thing the user could not identify). Added: a **brick stair bulkhead 44x22** at the left of the
deck with a 14x17 steel door and a stone threshold; a **flue 6x14 with a 10 px rotating ball**
(4 frames at 3 fps, quarter turn per frame) on its roof; **smoke** of 3 puffs, 4 frames at 1.2 fps,
drifting up and left as they fade, peaked at alpha 0.55 because at 0.34 it sat in the same luminance
bucket as the day sky; a **clothesline** of 1 px steel wire from the bulkhead to a 2x26 post, sagging
3 px, with a shirt and a towel pegged on (still); and a **black cat 8x6** on the coping whose routine
lives in data: walk 40 s (x 50 -> 174), sit 60 s, walk back 40 s, lie 80 s, a **220 s cycle**, x
snapped to whole art px.

The café sprite grew 172 -> **194** (46 px of roof furniture above the deck, minus the 14 of parapet
that was already there). The page's animation handling was generalised from the AC fan's one-off into
one `cafeAnimations()` list: per frame it blits the still and draws four small sprites (fan 4F@6,
ball 4F@3, smoke 4F@1.2, cat 2F@5). Proven by a pixel diff of `sim=5` against `sim=120`: 3024
differing pixels in exactly three clusters (flue+smoke, the cat in its two places, the AC fan) and
nothing else moved.

Honest caveats for the correction round: at the scene scale (2 px/art px) the cat is 16x12 physical
px — a speck — and the smoke is nearly invisible; the 1 px wire is thickened to ~3 px by the
sprite's outline pass, so the clothesline reads a little like a rail. All three are a size call, not
a bug: the cat can go to 10x7 and the smoke gain one more step of alpha if the user wants them to
read at the design scale.

L26: the roof's second pass. The bulkhead is **44x40** with an **18x31** steel door (a person is 30, so
that is a normal door), and it is now painted **before** the parapet: the wall's 14 px and its 3 px
coping cross in front of its foot, so a stair head rises behind the wall instead of a panel standing
in front of it, with its whole palette mixed **0.18 toward ink** so the depth reads. The flue went
6 -> **4 px**, and the ball dropped its vanes: two 1 px sinusoidal seams scroll one step per frame,
**5 frames at 6 fps**, which reads as rotation without looking like a fan. The smoke keeps its count,
path and fade but its puffs are now **3/5/7 px** instead of 1-4, still a wisp. The wire needed no
change: the taller bulkhead lifted its anchor 18 px on its own, so the shirt's hem sits 15 px and the
towel's 10 px above the coping. Café sprite 194 -> **212**.

Worth recording because it will come up again: the sprite's outline pass thickens any 1 px line to
about 3 px, so the clothesline reads closer to a thin rail than to a wire; the fix is a per-region
opt-out on the outline, not a thinner line.

L27: the graffiti was redrawn twice. The first attempt at "longer curved tips + the V under the
nose" went too far: the wings climbed five rows and the notch was twelve px wide, so the wall read
a bat, not a moustache. The version kept is a **34x10 box** with the curls starting at row 0 in two
thin strokes at the extremes, the wings sweeping in and down through rows 1-4, the **V closing at
row 4** between x 15 and 18, a thick body of rows 5-7 that is *shorter* than the wings (5..28) so
the tips keep their own air, and the mouth opening again at rows 8-9. The 8 degree lean stays: the
asymmetry is the hand that painted it.

L28: the moustache was redrawn a third time against a reference the user sent (a stock handlebar
icon). The silhouette now follows it: two **rounded humps** on the top edge with a **narrow V slit**
between them, **thin points** at the extremes on a single row (row 4), and below the tips the mass
narrows row by row to the **point of the V**, which is the lowest thing in the glyph (rows 5-9:
2..31, 4..29, 7..26, 11..22, 14..19). Colour, 8 degree lean and the three drips are unchanged.
Method worth keeping: the reference was fetched, read, and turned into the row table by hand; two
earlier attempts (a bat, then a blunter version) were rendered and rejected before this one.

L29: the moustache needed two more passes because the previous one read as the **Batman emblem**, not a
moustache. The diagnosis is worth keeping: the glyph had **two sharp peaks with a deep V** and, worse,
its **underside closed to a single central point** — that point is the bat's tail. A moustache's
lowest parts are the **two bellies**, with a **notch between them** (the mouth). Final table: broad
crowns at rows 0-1 with a shallow 2-row V, a thick nearly straight body at rows 2-7, the points
carried to the extremes on one row (row 4) and pulled back the next (thin tips), and rows 8-9 as
`3..15 / 18..28` then `5..13 / 20..26` so the bellies hang lower than the mouth notch.

L30: the offices are built (`src/next/offices.js`, 302x326) as a first prototype. Four storeys of 64
with 10 slabs, one **44 px lift spine** at the left edge with the same opening (x 10..33) on every
floor, dense dark-metal glazing (14 panes of 16 at an 18 pitch, against the gym's 22), ribbed
spandrels, brick spine and parapet, and the corporate accent used exactly once, on the plate over the
ground floor's lift. Rooms by state: **F0 the entrance only** (counter, bench, two tall plants, the
open cab), **F1 planning + implementing**, **F2 exploring + deciding**, **F3 working whole floor**
(seven desks in two rows, plus the sofa-and-TV corner) — the user's call: working is the longest and
most common state, so it gets the largest room.

Change of intent recorded: L6 asked for stairs *and* a lift so the NPC would not teleport. The user
decided against the stairs in L31 — the lift is the only circulation, always in the same place on
every floor, which is what makes floor-to-floor movement legible. L6 is therefore superseded on that
point.

Known first-pass weaknesses, measured rather than guessed: the duct collars every 44 px smear into a
dotted line at 2x; the 1 px desk props (cups, trays) become speckle at 2x; and the planning and
implementing rooms are the weakest pair to tell apart at scene scale, because both are desk rooms and
only the whiteboard separates them.

L31: the offices' second pass, on the user's two notes ("que el ascensor este dentro del edificio no
fuera, y añadimos mas pared de tocho por ambos lados... asi separaremos visualmente la ofi del gym").
The lift is now a **44 px shaft inside** the building: the facade is one continuous glazed plane from
pier to pier, the shaft's brick, leaves, indicators and open cab are painted **before** the glass veil
and under the mullions, and one bar lands exactly on the leaves' meeting seam — that bar is the cue
that says "inside". **Piers: 14 px left, 30 px right**, both full height in the building's own brick
with one stone coping across the whole width; the right one is the party wall to the gym and carries a
cast-iron downpipe and a bricked-up opening, so the masonry has scale.

Consequences worth keeping: the grid went from 14 panes of 16 at an 18 pitch to **13 panes of 18 at a
20 pitch**, because 258 px of glazing between the two piers divides exactly that way (still denser than
the gym's 22); the rooms are 217 wide, split 98 + 3 px partition + 116 on floors 1 and 2; the furniture
was re-derived (implementing 3 -> 2 desks, exploring 2 -> 1, working 7 -> 5), and the deciding room
loses its second plant because the gap to the cabinet is 1 px. The shaft's face is painted **lighter**
than the piers on purpose (`brickFace lit 0.8`): dark, it regressed to two pale doors in a black slot.

Open for the correction round: the lift leaves are still plain slabs — they would gain from a
floor-number panel or a dark reveal — and at 2 px/art px the interiors still speckle.


L32 (verbatim): "en la ultima planta en la zona derecha hay 5 ordenadores, 3 en el frente y 2 detras.
los 2 de detras quitalos, parece que floten. me gustaria probar de etiquetar cada habitacion con su
proposito, pero en lugar de hacerlas todas probamos solo con 1 para ver que tal. quiero algo lo mas
pequeño posible para que se lea pero sin que rompa la estetica".

The second row is gone from the working floor (`deskRun` behind the first, 2 desks, with the 0.22 tint
that was meant to sink it). It read as floating because at this scale nothing says which plane a desk
stands on once the front row covers the timber: a row *behind* a row is only legible with a floor to
stand on and a reason to be there. Floor 3 now holds 3 desks in one run, from `deskRun` and no
hand-written x, so the count still follows the room's width.

**The first label, on trial.** `paintRoomLabel` draws the room's own name on a plate inside it: the
`tiny` 3x5 face with 2 px between glyphs, 3 px of padding each side and 1 above and below, so the
plate is 39x7 and hugs its word. `OFFICES.labels` holds one entry — `{ working: 'WORKING' }` — so a
second label costs one line and never a second layout pass.

The placement that took the work is the horizontal one. A label this small cannot survive a mullion
across it, and every 2-pane-wide plate contains one, so the word is *nudged onto the glazing grid*
instead: a letter cell is `cols + spacing` = 5 px wide, the bars all stand on one shared residue of
that cell (the 20 px pitch is a multiple of 5), and the text start moves at most `cell - 1` = 4 px
onto the column where each bar lands in the 2 px of air after a glyph. The nudge is derived from
`officesLayout().bars[0]`, not tuned by hand, so any room and any label obey it. Two earlier attempts
are worth remembering: with 1 px of tracking a bar fell on a glyph (the O and the N disappeared under
the steel), and the letters were then brightened to `mix(C.white, C.lampWarm, 0.12)` — 228 against
the bar's 121 — because a 1 px stroke has to out-value the 2 px bar beside it to hold the word
together at 2x.

Placed at `hang: 24` below the room's top: clear of the duct and of the pendant glow's deepest row,
and above the lounge's screen. Seen at 2x it reads; the plate is the room's own signage at its left
margin, the same language as the lift's call plate and indicator.

L33 (verbatim): "ok, añade el resto de labels".

All six rooms are labelled — `entering: ENTRANCE`, `planning: PLANNING`, `implementing:
IMPLEMENTING`, `exploring: EXPLORING`, `deciding: DECIDING`, `working: WORKING` — and the plate
moved out of the room. The reason is measured, not stylistic: an interior label needs a 7-row free
wall, and in a room 54 rows tall the duct and the pendants take the first 22. The boards hang high
(the pinboard's top is 10 rows under the transom, the whiteboard's 15, the meeting screen's 6) and
the desks' monitors and chairs reach up to 23–24 rows under the transom, so *exploring* has no free
wall at all: between the pinboard's bottom and the monitor's top there are 4 rows, and the 14 px
left of the shelf is not a word's width. Only *deciding* had a clean slot, which is not a rule.

So the label went to the **10-row cladding band above each window** (`band.slabTop`), centred over
the room's own span, painted after `paintSlabBand` because it covers the ribs and the joints. There
it is outside the glass: no veil over it and no mullion to dodge, which also retires the residue
alignment L32 described — the layout no longer has to be consulted for a label at all. On a split
floor the two names share one band and never touch (the plates are 44 and 64 wide in 98 and 116 of
room). It reads as a plaque bolted to the facade, the same language as the lift's call plate, the
indicator and the plate over the ground floor's doors, and the reader attaches each name to the
window under it because every floor does the same thing in the same place.

Kept from the trial: the 3x5 face with 2 px between glyphs, 3 px of padding each side, 1 above and
below (so a 39x7 plate for `WORKING`, 64x7 for `IMPLEMENTING`), and the letters at
`mix(C.white, C.lampWarm, 0.12)` — the brightest value the palette has, because over cladding this
dark a 1 px stroke is all there is.

L34 (verbatim): "ahora vamos a crear un pequeño parque con arboles y una fuente a la derecha del gym".

The park is the strip the frame leaves to the right of the gym, and the width rule is measured, not
picked: café 192 + alley 88 + offices 302 + gym 240 = 822 art px is what this street was composed at,
so `parkW = viewW - 822`. The gym used to absorb every pixel past that (S17 let both ends touch the
limits), and the bare pavement this task is about was exactly that absorbed width. It now keeps its own
240 and gives only when a view cannot hold that much — still clipped by the right limit below 822,
exactly as before — and the leftover is the park's. A 1644x974 window at 2 device px per art px gives a
view of 822 and no park at all; the park is what a wider window buys, and a 3x display narrows the view
rather than widening it, so it disappears again.

**Composition, from the width, in the order it is dropped.** The fountain is the one prop the strip
cannot give up, so `PARK.minW` is its own 36 plus a 2 px margin at each end: **40**. Below that the
module draws nothing and the strip is only the page's grass band. Above it, the strip carries a 14 px
hedge along its back (full width minus 3 px at each end), the 36 px fountain centred, a bench when the
gap right of the fountain fits inside the strip, trees, and a lamp. Measured thresholds: bench from 84,
the first tree at 129, two at 160, three at 193, four from 224, and **4 is the ceiling** however wide
the frame gets. The count is `floor((span + 6) / 32)` per side of the fountain — a 26 px tree and a 6 px
gutter — and the trees are spread evenly inside their span. The lamp's 13 px zone at the left end and
the bench's 28 px zone right of the fountain are reserved whether or not those two are drawn, so a prop
that appears at a wider frame never takes a slot away from a tree: the count is non-decreasing in width
by construction, which is what `npm run park:check` sweeps from 40 to 900.

**The fountain**, 36x35 on the ground line: a 2 px foot, a 36x9 basin (two rows of rim, three of water,
four of front wall), a 4x10 pedestal, an 11x3 upper bowl and 11 rows of jet. The water's whole detail is
one ripple row of `waterLite`, a `waterDeep` far edge and one 2 px warm highlight: a gradient over 30 px
of water reads as a smudge, not as water. The trees are 26x46 with 18 of trunk, so four rows of trunk
stand above the hedge and the crown does not sit on it; the canopy is a 13-entry width table (the device
the offices' `LEAF_ROWS` uses), lit on its upper left and deepest on its lower right, plus seeded leaf
tips — a crown, not a blob. The park's own height is the trees': 46 with trees, 35 without.

**Ground and clock.** `park.js` paints no ground: the page lays
`groundBand(ctx, 'grass', PARK.seed, parkX, groundY, parkW, roadTop - groundY)` over the pavement, the
same helper the paving and the asphalt come from, so the park stands on the catalogue's grass and not on
a fourth material invented for it. The jet is the only moving thing — one element in the same list as
the café's four: `{ key: 'parkjet', origin: 'park', frames: 3, fps: 4 }`, its `place` returning a
position in the park sprite's own coordinates. The frame loop grew a two-entry `origins` map (`cafe`,
`park`) so no element carries a page coordinate and the café's four keep behaving exactly as they did;
`?anim=0`, reduced motion and `?pause=1&sim=N` reach the jet because it goes through the same
`cycleFrame` rule, frame 0 when frozen.

Left out on purpose: nothing walks in the park, the fountain has no splash and no sound of its own, the
hedge has no gate, and there is no path from the pavement into the strip — each of those is scene-scale
work, not strip work. The first thing to correct at scene scale is the top of the tree count: at 900 px
of strip the four trees stand 385 px apart in front of a 894 px hedge, and the strip reads as a long
green band with four trees in it rather than as a park. A fifth and sixth tree, or a second fountain on
the same pitch, is that correction; the count is one number in `PARK.trees.max` and the spans already
come from the width, so nothing else has to move.

L35: the park's first correction pass, before the human look. Four things changed and one is a rule:

**The sub-`PARK.minW` strip is not a park.** As built, a view of 823..861 art px got a park block of
height 0: a green strip between the gym and the frame edge with nothing in it and a readout line
calling it PARK 20. That is a defect with a label on it, not a finding, so the block is added only
from `PARK.minW` (40) up. Below it the page lays no grass, prints nothing, and the strip's pixels are
reported as `leftover` instead, which is what the number was for before the gym stopped absorbing it.

**The crowns.** One table produced four identical silhouettes at 240 — wallpaper however well the
table is drawn. There are now three (`CANOPY_ROUND`, `CANOPY_PEAR`, `CANOPY_OPEN`) and the seed picks
both the table and a `drop` of 0-3 rows, so a shorter tree is a genuinely shorter tree. At 4x the
four crowns of a 240 px strip are still close cousins: the next step, if they are judged too alike,
is one decisively different shape (a wide low crown, or a conifer) rather than more tables of the
same curve.

**The fountain's stone.** Built out of `stoneLite` the basin came out at 172 of 255 and read as a
white kitchen unit standing in the grass. The body is now the `stone` the rest of the street is drawn
in (`mix(C.stone, C.sand, 0.34)`, 136), only the rim climbs above it, the basin's two ends step in by
a column for the first two rows so 36 px read as a bowl and not a trough, and the jet is a plume
(three px where it leaves the bowl, two in the middle, one at the head) instead of a one px column
under a cloud of droplets, which read as a dotted line floating over the fountain.

**The grass.** The terrain catalogue's grass is drawn for the top-down town in daylight; under this
dusk sky, straight off the tile, it was the loudest green on the page. The page lays a 16% ink veil
over the park's band only — same grass, same catalogue, sitting in the scene.

Verified: `npm run park:check` 13/13 (including the new "no park below the fountain's width"), `npm
run build` clean, and the sprite rendered offline at 5x for 138 and 4x for 240. The crowns, the
bench's back and the fountain's silhouette are the three things left for the human eye at 2 px/art px.

L36: the ground, second reading (S25). The terrain catalogue was right and the page was wrong: those
grounds are drawn to be seen from above, and laid flat across an elevation at 16 px a tile they read
as wallpaper — the asphalt carries fourteen marks per tile, which at 2 px/art px is television
static, and it ends up *finer* than the pavement's own joints, so the near plane looks denser than
the far one and the depth inverts. `groundBand` also blitted the patch bottom-aligned, which cut the
pavement's top course in half. Nothing of that survives on this page.

`src/next/ground.js` paints the floor instead, with its own contract: contact 3, pavement 20 (two
courses of 10, half a slab apart), kerb 3, gutter 1, road 44 = **71 art px**, and the fade takes the
rest of the frame, which is why the street no longer changes proportions with the window. Every row
is opaque — the first attempt left the contact band transparent and a shadow over nothing is a hole —
and no row is a tile.

**The light is the alley's, applied to a floor.** Shadow is bands of ink with a step and never a
per-pixel gradient; every colour is a mix toward ink of the material it belongs to; three sources
reach the ground. The sky: the road's first seven rows take the horizon colour of the current ramp,
so `?sky=dawn|day|dusk|night` changes the floor and nothing in the module hardcodes a sunset. The
glass: each lit block spills onto the pavement in three steps of warm alpha and lies on the wet road
as broken light. The slot: the alley spills *ink*, three bands with a stair, because it is the one
place the light does not reach.

**The reflections took four attempts and are the honest weak point.** A vertical column — the obvious
way to draw a light on wet asphalt — reads as something hanging off the kerb in a 44-row road; the
version that ships is a short stub where the light lands plus wide flat dashes stepping down and out
as the road comes nearer, which is the language the reference uses in its middle distance. At 2 px/art
px they are still faint: the levers, if a bolder street is wanted, are the road's depth (44 today) and
`GROUND.streak.alpha` (0.42), and both are numbers in one object. What is *not* in doubt is the
structure: the kerb is the pale horizontal that turns two strips into a pavement and a road, the
contact shadows stop the buildings standing in the air, and the near edge falls into ink so a long
road cannot read as a pattern.

Verified: `npm run ground:check` 9/9 (bands fit, the kerb sits above the road, the pavement between
the two, the sky changes the road, the alley's spill reaches past its slot, the near edge is under
half the road's value, determinism, palette and no terrain import), `npm run build` clean, and the
whole street composed offline at 1x and 3x for the human eye.

L37: the sky, from nothing (S26). What was there: `paintSky` interpolated the palette's four stops into
up to fourteen flat bands. No stars, no moon, no clouds, no distance — a gradient standing in for the
largest surface in the frame.

**The reference, measured.** Twelve to fourteen steps crowding toward the horizon, with noisy seams; 1-2
px stars in three brightnesses, occluded by the clouds; a **3 px square** moon; two families of cloud —
1 px cirrus and cumulus built from rounded puffs whose **underside is the brightest thing in the sky**;
a pale haze band that separates the city from the sky; and three planes of city separated by value, the
far one being the haze's own colour, the hillside a field of 1 px warm windows at 0.9% of its area, the
near roofs almost ink. What it does *not* offer is a technique for its noise: 35 396 unique tones in
the sky region and 105 in a single row means the image was rendered with noise, not painted with it.

**What was built.** `src/next/sky.js`: the palette's four stops resolved into ten bands (a 1.55 curve
crowds them near the horizon), the four ramps untouched; `horizonTone(time)` as the ONE value that the
haze, the cloud's underside and the wet road in ground.js share; stars as one sprite with three frames;
the moon as a square with a one px halo; six static cirrus runs; two cloud banks stamped into a mask
and shaded **per column** so the lit underside follows the lumps; the city in three planes; and eleven
moving elements (stars, moon, two banks, six window groups, two beacons) handed to the page with
`origin: 'sky'`.

**Two things the first pass got wrong and the reasons are worth keeping.** Shading each puff as it was
drawn gave every puff its own highlight band and the union read as a stack of shelves; stamping a mask
and shading it per column fixed the mass in one move. And the puffs' width table has to be
*interpolated per row*: stepping it gives five-row blocks, which on a silhouette is crenellation — the
second attempt was a castle wall. The cloud's body is also a neutral slate-stone mix with only 12% of
the horizon in it; built out of the horizon itself, a dusk cloud is brown and reads as rock.

**The architecture had to change with it.** The street's still is one opaque picture, so a drifting
cloud drawn with its moving parts would cross the offices. The page now paints **two stills** — the sky
behind, the street in front — and draws the sky's elements between them. That is also why the sky's
features are placed against `clear`, the rows the tallest roof leaves visible: a cloud painted where a
building stands is a cloud nobody sees, and on a frame the buildings overflow it falls back to the upper
half of the zone so it still shows in the gaps.

**Left for the eye:** the bank's lobes are still a little pointy where crown puffs meet, the two banks'
ends are blunt, and the motion's speeds (`SKYSCAPE.clouds.speed`, the window periods) are guesses to be
tuned against the street. The seam dither was removed on purpose: a checkerboard or a speckle of dots
reads as a dotted rule across the whole frame at 3x, and the rest of the scene expresses bands as clean
steps.

Verified: `npm run sky:check` 8/8 (four distinct moments, every ramp dark to light in at least eight
steps, the haze over the city, the cloud's underside brighter than its body, every moving element in the
sky and deterministic, frozen at frame zero, and the palette rule on the source), `npm run build` clean,
`ground:check` 9/9 and `park:check` 13/13 still green. The street composed offline with the new sky for
all four moments: `sky-{night,dawn,day,dusk}-1x.png`, plus the bank alone at 5x.

L38 (verbatim): "no veo sol o luna, deberian estar y moverse segun la hora del dia. las nuves no tienen
porque estar animadas, pero tienen que ser mas grandes y frondosas como en la ref. la ciudad de fondo a
quedado solo sobre el parque, pero me imaginava algo adaptado a todo el width disponible, sin saturar, y
quias con un mar de fondo calmado pero con una leve animacion de queños brillos en el agua diferentes si
hay sol o luna. quizas añadir alguna aniacion de pajaros con rutinas largas como la del gato".

**Bodies.** Each moment now carries one, with its own arc and its own slow drift (900 s for a whole
crossing): the sun in `lamp` warmed by the horizon, the moon in bone and cold with three pixels of its
own shadow, both with a two-step halo because at 2 px/art px a hard disc is a tile. Their **phases are
the gaps and not the clock**: a 326 px office stands in the middle of the frame, so mid-arc is behind a
building — each moment starts its body where the street leaves sky (over the café on the left, over the
park on the right) and it drifts from there.

**Clouds are painted, not moved.** Bigger (260x84, seven to eleven puffs plus a crown of six to ten) and
placed clear of the body's arc: one high on the right, one low on the left. And the light had to be
given a direction per moment, which is the correction this round was really about: the sun sits **above**
the clouds by day, so a day cloud is lit on its crown; night, dawn and dusk keep the reference's
signature and light them **from under the edge**. `lightOf` carries `topLit`, `paintBank` reads it, and
`cloudTones` is exported so `sky-check` can refuse a day cloud lit from below — the failure reads as a
rock with snow beneath it.

**The distance, across the whole width.** The bay line is above the shorter roofs (`farLine`, half the
sky zone), so the sea and the city are seen down the street and not only over the park: a calm sea band
with a pale horizon line, the far city rising in front of it as prisms **spaced and stepped** — the
first pass had them shoulder to shoulder and against a day sky it read as a fence of pale sticks — the
hillside with its field of windows, and the near roofs. The sea's glints are a three-frame strip whose
colour is the sun's or the moon's, so noon water and midnight water are not the same picture.

**Birds.** Two flocks, each on its own long routine in the cat's spirit: a 52 s and a 97 s period, a
26 s and a 38 s crossing, wings beating at 6 fps and a slow sine on their height. Away for the rest of
the cycle by design — a bird that is always there is a bird nobody looks at.

Verified: `sky:check` 8/8 (the cloud rule included), `build` clean, `ground:check` 9/9 and
`park:check` 13/13 untouched. Renders: `sky-{night,dawn,day,dusk}-1x.png` and `-t10-` at the second
where a flock is crossing.

Left for the eye: the bank's silhouette is still blocky and its base too straight for the reference's
frondose lobes; the glints on the sea are subtle at 1x; and the sea band may want to be a row or two
thicker. All three are numbers in `SKYSCAPE`.

L39 (verbatim): "no es exactamente lo que me imaginaba. si te dfijas en la ref el cielo no esta cuarteado,
el degradado es sutil. las nuves to tienen tanta sobra ni contraste y ademas con mas grandes y variadas,
grandes en ancho no en alto y con conexiones sutiles. la luna y el sol si que podemos hacer algo
diferente a la ref, prefiero que se algo un poco mas grande y redondo. por ultimo tiene que ser algo que
se dibuje primero para poder dibujar nuestros edicifios encima, asi no queda un espacio entre ellos como
ahora. mi idea era una montaña/colina a la izquierda con algunos edificios/casas, algunos edificios mas
por el centro y un mar/lago en la parte derecha calmado (no hace falta que tenga reflejos ni animacion)
pero que se vea claro con algun barco o similar. y todo conectado de forma organica, tanto entre el cielo
como con lo nuestro".

**El cielo deja de estar cuarteado.** Diez bandas planas se leían como un corte; ahora son **28** con curva
1.18 y las costuras sembradas de ruido en tres filas. El paso entre dos filas se mide en `sky:check` con la
quinta parte de columnas que menos cambia —el cielo es el mismo en todo el ancho, una nube o una estrella
sólo mueven unas pocas— y no puede pasar de 7 niveles: es la regla que la primera versión rompía.

**Nubes.** Más grandes en ancho que en alto (260x66 y 292x48, dos formas distintas), diez a quince puffs
más corona, y los tonos a uno o dos pasos del cielo: el contraste que tenían las convertía en roca. La
dirección de la luz por momento (corona de día, panza al atardecer y de noche) se queda. Siguen sin
moverse.

**Sol y luna, nuestros.** Radio de 4.5 y 6 px de arte, halo de dos anillos pegados al disco, un cuarto
iluminado para que sean esferas y no pegatinas, y ningún píxel de "textura" en la luna.

**Y lo que de verdad faltaba: el paisaje.** Ya no hay una ciudad flotando a media altura con una banda de
cielo entre ella y nuestros tejados. `paintLandscape` dibuja **un solo paisaje continuo cuya base es la
línea de la calle** (`h - 1`, la fila donde se apoyan nuestros edificios), así que el tejado del café se
recorta contra la ladera y no contra un hueco: colina a la izquierda con cinco casas y sus luces, el
pueblo en el centro con bloques de 7 a 26 px, copas escalonadas y ventanas encendidas, y **agua calmada a
la derecha con su línea pálida y un barco**, sin reflejos ni animación. Los tres planos se separan por
valor y neblina, y la cresta de la colina lleva una fila de bruma para que el cielo y la tierra se toquen
en vez de cortarse.

**Dónde se ve cada cosa**, que es la parte que costó: arriba del café sólo hay 172 filas y arriba del gym
188, así que un fondo más bajo que eso es un fondo invisible — la primera versión del pueblo medía 76
filas y no se veía nada. La colina sube 200 filas (sobre el café), el pueblo 110-220 (sobre el gym) y el
agua se coloca a 74 filas (sobre el parque). Detrás de las oficinas no se ve nada y eso es correcto: es lo
que pasa cuando estás en la calle. Los brillos animados del agua se fueron, como pediste; las ventanas de
la ciudad y las bandadas se quedan.

Verified: `sky:check` **10/10** (cuatro momentos distintos, rampa de oscuro a claro en ≥8 escalones, el
cielo como degradado sin bandas, el paisaje llegando a la línea de la calle, el agua con su línea, la
regla de iluminación de nubes, elementos deterministas y dentro del cielo, y la regla de paleta),
`build` limpio, `ground:check` 9/9, `park:check` 13/13.

Left for the eye: el pueblo queda apretado (es corto en ancho), el agua es un plano muy liso —un par de
filas de tono y el barco es todo lo que tiene—, y las nubes, aunque ya son nubes, podrían ganar un puff o
dos de variedad. Los tres son números en `SKYSCAPE.landscape` y `SKYSCAPE.clouds`.

L40 (verbatim): "aunque hay algunas cosas que podrian estar mejor, como que las casas/edificios del fondo
sean mas grandes (que esten mas cerca), ademas que alguinas casas parecen flotar en la ladera. los
edificios grande se podrian ver asomar tanto por la derecha como por la izquierda de la oficina, y el mar
de dia tendria que ser mas azul intensio, no el gris de ahora".

**Más cerca y más grandes.** El pueblo crece a bloques de 14-44 px (antes 7-26) y 130-250 filas de alto,
con la rejilla de ventanas cada tres píxeles en vez de cada dos, y las casas de la colina a 9-17 px de
ancho y 7-11 de alto.

**Las casas ya no flotan, y la razón era dónde estaban sentadas.** Estaban apoyadas en el plano *cercano*
de la colina (0.82 del perfil), que queda por debajo del tejado del café: se veían sólo las que asomaban
por el borde, con aire debajo. Ahora se sientan en el **perfil de cresta**, que es la superficie que de
verdad se ve por encima de nuestras cornisas, con un poyo de un píxel a cada lado y el pie metido dos
filas en la masa. Y el tejado a dos aguas se construye con el alero ancho y la cumbrera estrecha: al revés
—lo que hizo la primera pasada— una casa de 12 px es una seta.

**El pueblo asoma por los dos lados de las oficinas.** Su franja pasa a 0.19..0.84 del ancho: por la
izquierda se ve en el hueco que el callejón deja entre el café y la torre (el sprite del callejón no pinta
cielo por encima de su tapia, así que el fondo se ve a través), y por la derecha por encima del gym. Las
oficinas se comen el centro, y eso es lo que pasa cuando estás en la calle.

**El mar de día es azul.** Construido con el horizonte de la rampa salía gris cálido —hormigón con
niebla—; ahora el agua de día tiene su propio tono, un azul de mar hecho del cielo diurno, la lámina del
cristal y una pizca de `waterLite`, con su línea de espuma del mismo origen. De noche, al alba y al
atardecer sigue saliendo del horizonte, que es lo correcto.

Verified: `sky:check` **10/10** —y hubo que arreglar el chequeo de la rampa, que muestreaba el fondo del
cuadro: ahí ahora está el paisaje, no el cielo—, `build` limpio.

Left for the eye: las casas de la colina son todavía muy simples (masa, tejado, una ventana) y el pueblo
podría tener dos o tres alturas claramente distintas en vez de una mezcla continua.

L41 (verbatim): "solo quedan algunas casas en la coluna que siguen 'flotando'. revisar tambien ya que
algunas antenas de los edificios altos estan inconexas".

**Las casas.** El problema no era el tono sino la geometría: una casa sentada en la cresta *en una sola
columna* tiene su base horizontal y la ladera es una pendiente, así que la esquina de abajo quedaba con
cielo debajo. Ahora se muestrea el suelo bajo **toda la huella** de la casa y se apoya en la fila más baja
—el borde de abajo—, y la cuña entre la pendiente y ese nivel se rellena con el tono de la colina: la casa
queda media enterrada por arriba y con poyo por abajo, que es como se apoya una casa en una ladera.

**Las antenas.** Cada pieza de la corona se colocaba a una altura fija respecto del techo (`top - 4`,
`top - 8`, `top - 12`), así que en las torres que no recibían el retranqueo la antena aparecía cuatro,
ocho o doce filas por encima del tejado. Ahora un `roofTop` va subiendo a medida que se añaden las piezas
y cada una —la antena incluida— se apoya en la anterior. Y de paso: las **balizas** parpadeaban en
coordenadas fijas que no correspondían a ninguna torre, así que flotaban en el aire; ahora el paisaje
dibuja **dos mástiles** sobre las torres más altas y la baliza late en su punta, con las dos mitades
leyendo el mismo número.

Verified: `sky:check` 10/10, `build` limpio, y los recortes a 3x de la colina y del pueblo mirados uno a
uno. Left for the eye: las casas siguen siendo muy simples y el pueblo podría tener dos o tres alturas
claramente distintas.

L42 (verbatim): "tambien me gustaria que las nueves no sean grises, si no mas bien blancas, y ademas el sol
tiene que pasar por detras suyo no por delante. las nuves son otro elemento que tendra que encajar con el
weather, para tenerlo en cuenta". Y después: "en la parte del mar, estaria bien aparecer algo de tierra,
aunque sea por detras, como un poco de tierra o un muelle pequeño".

**Nubes blancas.** El gris venía de mezclar `slate` y `stone` en el cuerpo: una nube es agua y, con una luz
baja, es blanca. Ahora el cuerpo es hueso con un quinto del horizonte dentro (así la nube nocturna es un
blanco frío y la del atardecer uno cálido), la sombra de la base es gris piedra y nunca tinta, y el lado
iluminado va casi al blanco.

**El sol pasa por detrás.** Un solo lienzo no puede estar delante de sí mismo, así que el cielo se pinta en
**dos**: `paintSkyBase` (rampa y cirros) y `paintSkyOver` (nubes y paisaje, en ese orden). La página blitea
la base, después los elementos que van **detrás** de las nubes —sol, luna y estrellas, que así quedan
ocluidos por ellas como en la referencia—, después el `over`, y por último la bandada, las ventanas y las
balizas. Cada elemento de la lista declara su `layer`: `behind` o `front`.

**La orilla y el muelle.** En el agua hay ahora un espigón de tierra con su escalón y una ventana
encendida, y un **muelle pequeño** con tarima, cuatro postes y una barca amarrada, más la barca suelta un
poco más allá. Todo se coloca donde el agua se ve de verdad (el gym tapa su primer tramo) y nada de eso se
mueve.

**El weather, como gancho y no como promesa.** `SKYSCAPE.weather` tiene hoy una sola entrada (`clear`, con
`cover` y `drop`) y `paintSkyOver` la recibe; las nubes son el único elemento que la lee. Añadir lluvia o
tormenta es una entrada en esa tabla, su tono y su cobertura, y un parámetro en la URL — sin tocar los
ocho sitios que dibujan el cielo.

Verified: `sky:check` **10/10** —hubo que arreglar tres chequeos por el camino: el de la rampa muestreaba
una columna que ahora cruza un banco de nubes (los bancos son más anchos que el cuadro), el del número de
escalones contaba luminancia en vez de color —la rampa nocturna cambia de tono más que de valor— y el de
la nube exigía un lado iluminado diez niveles por encima del cuerpo, imposible cuando el cuerpo ya es
hueso—, `build` limpio, y los recortes a 6x del agua con el muelle mirados uno a uno.

L43 (verbatim): "para la parte del mar no me referia a eso. si no a la tipica montaña bajita que esta por
detras de la linea del horizonte. quita el muelle y dale una rutina sencilla al barco".

**Fuera el muelle y el espigón.** No era eso. Con ellos se va también la barca amarrada: en el agua queda
lo que hay en un lago visto desde una calle.

**La montaña bajita del horizonte.** Detrás de la línea del agua hay ahora una **orilla lejana**: una
sucesión de lomas bajas (5 a 14 filas, 12 a 38 de ancho) en el tono de la cresta, dibujadas **antes** del
agua para que el agua les corte el pie, con una fila de bruma en su cresta. Es lo que le da al lago un lado
lejano en vez de un borde de cuadro.

**El barco tiene rutina.** Dos frames (el segundo sube el casco un píxel en la marejada), periodo de 140 s
y travesía de 90: cruza el agua que se ve, se va y vuelve, como el gato del café pero corto. Mientras no
está, el elemento se dibuja fuera del cuadro en vez de desaparecer, para que la lista de animaciones no
cambie de tamaño entre frames. La marejada es el frame y el balanceo es un seno lento, no un segundo reloj.

Verified: `sky:check` 10/10 (el barco entra en la lista de elementos con `layer: front` y pasa las mismas
reglas que el resto), `build` limpio, y el agua mirada a 6x con y sin barco. Left for the eye: las lomas
son todavía muy parecidas entre sí —el ancho y la altura varían, la forma no— y el barco podría llevar una
estela de un píxel si algún día molesta que el agua esté tan quieta.

L44 (verbatim): "ahora vamos a mejorar el parque. la fuente de agua tiene que funcionar y si ya lo hace
tiene que verse bien, ademas añadir algun arbol no estaria mal, asi como una basura tipica de parque. el
cesped se puede mejorar y ademas la acera tiene que continuar no cortaase por el parque. si hace falta le
damos un poco de profundidad como al callejon".

**La acera ya no se corta.** El parque no tumba una banda de césped sobre la acera: la acera pasa por delante
sin interrupción y el parque es **una parcela retranqueada detrás de esa línea**. El módulo pinta su propio
suelo —bordillo de granito al nivel de la calle, césped que se adentra hacia arriba en el cuadro (más arriba
es más lejos, la convención del callejón) y una barandilla baja de hierro en el frente—, y los objetos se
apoyan en la línea trasera de la parcela. Eso es la profundidad: primero la acera, luego la barandilla, luego
el césped, y la fuente, los árboles y el banco detrás.

**La fuente se ve.** El agua de la pila es ahora más clara que la piedra que la contiene, con tres
ondulaciones que se leen como anillos y un camino cálido de luz en el centro; el chorro de tres frames gana
una **onda de salpicadura** donde cae en el tazón, que era lo que faltaba para que el agua se viera conectada
al chorro y no posada encima.

**Más árboles y una papelera.** El tope sube de 4 a 6 y el canal entre árboles baja de 6 a 4 px, así que la
franja de 240 pasa de 4 a 6 árboles y la de 420 llega a 6. Y una **papelera** de parque —tambor verde oscuro,
tapa con labio, listones de sombra— junto al banco, que es donde va: sin banco no hay papelera, porque una
franja de 40 px con papelera no es un parque con papelera, es una papelera con fuente.

**El césped, pintado.** Ya no es el tile del catálogo con un velo: son dos bandas de verde a un paso, matas en
grupos sembrados, el **sendero gastado** que va de la barandilla a la pila y ni un píxel de ruido suelto — el
césped del catálogo está dibujado para el plano de arriba y a esta escala su textura es moqueta.

Verified: `park:check` **15/15** —dos comprobaciones nuevas: todo lo que hay en el parque termina en la fila
del suelo y la parcela está debajo; la papelera va junto al banco y dentro de la franja—, `sky:check` 10/10,
`ground:check` 9/9, `build` limpio, y el parque mirado a 5x con el chorro y sin él.

L45: the light, phase 1 (S27). The scene was lit three times at once — the sky by hour, the ground with fixed
palette tones, the buildings never — so `?sky=day` still reflected lit windows at noon. There is now one
contract.

**`src/next/light.js`.** Per moment: the ambient (white at noon, a cool 46% at night, warm and dark at dusk),
the sign and strength of the cast shadow, and the strength of the glass on the pavement. Two maps, both at art
resolution and both cached per resize: a **multiply sheet** (opaque white with the shadow trapezoids, three
bands each, longer for a taller block, on the side AWAY from the light — left at dusk, right at night) and a
**glow sheet** (three nested pools under each block that has glass, additive). Bands, never gradients: the
whole scene expresses a falloff as a step.

**The composition, which was the tricky part.** The street's still is TRANSPARENT above the buildings — the
sky is its own picture — so a plain multiply turns that transparency black (it did, on the first render: a
black sky). The order that works: white base, multiply the street onto it, multiply the sheet, then
`destination-in` with the street again to throw the white away, then add the glass. The sky never enters the
pass, because it is already the light of its own moment and must not be darkened twice. And the sheet's base is
pure `#ffffff` on purpose: multiplied by bone it would dim the whole street by the difference — a blend
operand, not a colour, and the palette check allows that one literal by name.

**What phase 1 does not do, and it is visible:** the ambient multiplies everything in the still, so the lit
INTERIORS darken with the street. Interiors live inside the block sprites and nothing yet tells the light which
rectangles are lit rooms. That is phase 2: each module hands over its glass as a rectangle and its rooms as
sources, the ambient spares them, and the light also lands on the façades (neighbour to neighbour: the café's
windows on the alley's wall). The wet road's reflections, still painted inside `ground.js` with fixed tones,
move into the contract in the same pass.

Verified: `light:check` **7/7** (white ambient at noon and dark at night, the sheet white away from the
buildings and dark at their feet, the shadow falling left at dusk and right at night, the glass brighter at
night than at noon, no pool under the alley or the park, determinism, palette), and `sky:check` 10/10,
`ground:check` 9/9, `park:check` 15/15 still green. The four moments rendered offline with the pass on.
