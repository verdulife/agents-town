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
| T9 | the offices: four floors, 302x326, with the stairs and the lift drawn inside the cut | S3, S4, S5 | worker | not started |

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

