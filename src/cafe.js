// The cafeteria page, now the whole street's massing check (S16-S20). The cafeteria keeps the
// art it was approved with, against the left limit of the view; the alley, the offices and the
// gym are added at the same storey, so the one question is answered by eye and by numbers: does
// the whole street fit?
//
// The street is composed, in the order a street reads: the masses, then the cafeteria art, then
// the alley between it and the offices, then the person in front of the cafeteria. Every width
// comes from streetLayout, which reads the view's own width, and the readout prints the layout
// back at the bottom left.
//
// The page scales itself exactly like the rest of the town: computeView gives the largest
// integer number of physical pixels per art pixel that keeps TARGET_H on screen, so on a
// 1644x974 window that is 2 physical px per art px, the same art pixel the street
// elevation uses. `?zoom=N` pins it to N physical px per art px for inspection.
//
//   ?sky=night|dawn|day|dusk   the sky ramp (default dusk)
//   ?zoom=N                    N physical pixels per art pixel
//   ?anim=0                    freeze every moving thing at frame 0 (also reduced-motion)
//   ?pause=1&sim=N             one frame from the shared animation clock, for a capture

import './cafe.css';
import { C, SKY, mix, rgba } from './next/palette.js';
import { computeView, applyView, TARGET_H } from './next/scale.js';
import { terrainPatch } from './next/terrain.js';
import { drawText, lineWidth } from './font.js';
import { CAFE, cafeSprite, cafeLayout, personSprite, cafeAnimations, wireSprite } from './next/cafe.js';
import { streetLayout, streetReadout, blockSprite, paintBlockLabels } from './next/street.js';
import { alleySprite } from './next/alley.js';
import { gymSprite } from './next/gym.js';

const TILE_PX = 16;
const canvas = document.getElementById('scene');
const params = new URLSearchParams(location.search);

const sky = SKY.find((entry) => entry.name === params.get('sky')) ?? SKY.find((entry) => entry.name === 'dusk');
const zoom = Math.max(0, Math.round(Number(params.get('zoom')) || 0));

// S19's and S22's animation budget, and it is the floor's: ?anim=0 or a reduced-motion
// preference freezes every moving thing at frame 0, and the frames otherwise come from one
// clock stepped in fixed quanta, so ?pause=1&sim=N reproduces a capture frame for frame. Which
// frame each element shows is that element's own business — cafeAnimations hands back the list
// — and nothing here multiplies a clock by a frame rate.
const startPaused = params.get('pause') === '1';
// The numbers are a tool, not scenery: hidden by default, back with ?debug=1
const showMetrics = params.get('debug') === '1';
const reducedMotion =
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = params.get('anim') === '0' || reducedMotion;
let clock = Number(params.get('sim')) || 0;

const layout = cafeLayout();
// the six people at the three tables, two per pane: the ground floor is a cafe with six
// people in it, and that is the count the window has to show without a zoom
const seated = layout.tables.flatMap((group, i) => [
  { ...group.left, pose: 'seat', seed: i * 2 },
  { ...group.right, pose: 'seat', seed: i * 2 + 1 },
]);
const building = cafeSprite({ people: seated });
// the clothesline's wire: a still thing that cannot live in the building's sprite, because the
// sprite's outline pass thickens a one px line to three. Its own one px sprite is blitted over the
// café right after it, at the box the layout hands out, so the wire is a wire and not a tube
const wire = wireSprite();
const wireAt = layout.clothesline.wire;
const standing = personSprite({ pose: 'stand', facing: 1, seed: 2 });
// the standing person's column: the middle of the 16 px brick pier between the door and the
// window, a pixel in from each end, so their 30 art px can be read against brick and the door
// and never against the glazing — someone standing by the cafe door, not a diner behind it
const STAND_CLEAR_X = layout.standX;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// One ground material as a band: tiles are baked by terrain.js, then cut to the band, so
// the pavement is the same paving the galleries document and not a flat fill.
function groundBand(ctx, kind, seed, x0, y0, w, h) {
  if (w <= 0 || h <= 0) return;
  const tilesW = Math.max(1, Math.ceil(w / TILE_PX));
  const tilesH = Math.max(1, Math.ceil(h / TILE_PX));
  const patch = terrainPatch(kind, tilesW, tilesH, seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.drawImage(patch.canvas, x0 + Math.round((w - patch.w) / 2), y0 + h - patch.h);
  ctx.restore();
}

// The sky as a vertical ramp: deep at the top, the horizon colour at the bottom. Four
// stops make four stripes, so the ramp is interpolated into enough bands that the seam
// between two of them is never a line you read instead of the sky.
function paintSky(ctx, w, h, ramp) {
  if (h <= 0) return;
  const stops = ramp.steps.map((key) => C[key]);
  const bands = Math.max(stops.length, Math.min(14, Math.round(h / 26)));
  for (let i = 0; i < bands; i++) {
    const t = (i / (bands - 1)) * (stops.length - 1);
    const from = Math.min(stops.length - 1, Math.floor(t));
    const to = Math.min(stops.length - 1, from + 1);
    const y0 = Math.round((h * i) / bands);
    const y1 = Math.round((h * (i + 1)) / bands);
    ctx.fillStyle = mix(stops[from], stops[to], t - from);
    ctx.fillRect(0, y0, w, y1 - y0);
  }
}

// The readout: the contract, read straight off CAFE, so the page can never say something
// the painters did not do.
function metricLines() {
  const { person, door, floorH, slab, window: win, table, width, roof, ac } = CAFE;
  const { bulkhead, flue, ball, smoke, cat } = roof;
  const cycle = cat.routine.reduce((total, phase) => total + phase.secs, 0);
  return [
    `PERSON ${person.w}X${person.h} STAND SEAT ${person.seatedH}`,
    `DOOR ${door.w}X${door.h} FLOOR ${floorH} SLAB ${slab}`,
    `WINDOW ${layout.glass.w}X${layout.glass.h} PANES ${win.panes} SILL ${win.sill}`,
    `TABLE ${table.width}X${table.top} SEAT ${person.seat} PITCH ${layout.pitch} X${table.count}`,
    `GROUND ${width} FLAT ${width}X${floorH}`,
    `TERRACE PARAPET ${roof.parapet} SKY ${sky.name}`,
    // frames and rate, spelled out: the tiny face has no `@` and would print a `?`
    `AC ${ac.w}X${ac.h} FAN ${ac.fan.frames}F ${ac.fan.fps}FPS`,
    // S22's roof, and the cat's routine as the data it is: "very long stays" is a number to
    // read, not a feeling to argue with
    `ROOF ${layout.h} SETA ${bulkhead.w}X${bulkhead.h} DOOR ${bulkhead.door.w}X${bulkhead.door.h}`,
    `FLUE ${flue.w}X${flue.h} BALL ${ball.size} ${ball.frames}F ${ball.fps}FPS SMOKE ${smoke.frames}F ${smoke.fps}FPS`,
    `CAT ${cat.w}X${cat.h} ${cycle}S ${cat.routine.map((phase) => `${phase.label} ${phase.secs}`).join(' ')}`,
  ];
}

// One plate of tiny lines, its last line's baseline sitting on `bottomY`; returns the y
// of the first line, so the next block can stack above it. `align` is where it hangs, and the
// plate lives on the side of the canvas with nothing to hide: the cafeteria is what is being
// judged, so the numbers never sit on top of it.
function plate(ctx, lines, bottomY, align = 'left', frameW = 0) {
  const step = 6; // tiny is 5 rows tall, so 6 keeps the lines apart
  const top = bottomY - lines.length * step;
  const width = Math.max(...lines.map((line) => lineWidth(line, { font: 'tiny' })));
  const x = align === 'right' ? frameW - width - 6 : 3;
  // a quiet plate, so the readout stays legible over the road and over a person at 4x
  ctx.fillStyle = rgba(C.ink, 0.55);
  ctx.fillRect(x, top - 3, width + 6, lines.length * step + 4);
  lines.forEach((line, i) => {
    drawText(ctx, line, x + 3, top + i * step, mix(C.plasterLite, C.white, 0.2), { font: 'tiny' });
  });
  return top;
}

function drawReadout(ctx, w, h, street) {
  // two blocks: the cafeteria's own contract, and then the street's numbers
  const metricsTop = plate(ctx, metricLines(), h - 6, 'right', w);
  plate(ctx, streetReadout(street), metricsTop - 5, 'right', w);
}

// The still: everything that does not move, painted once for a view into its own offscreen
// canvas — the sky, the ground, the masses, the cafeteria's cached sprite, the one person on
// the pavement, the block labels and the readout. What moves is a short list of small sprites
// (the AC's fan, the flue's ball, the smoke and the cat), and repainting the whole street sixty
// times a second to turn an 8 px fan is exactly what the house rule against it is about. The
// two things this hands the frame loop are the street line and that list.
function paintStill(view) {
  const stillCanvas = document.createElement('canvas');
  stillCanvas.width = view.w;
  stillCanvas.height = view.h;
  const ctx = stillCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const { w, h } = view;

  // the ground: a pavement band and the road under it, sized off the view so the building
  // keeps the frame at every zoom, with a floor under the pavement's height
  const paveH = clamp(Math.round(h * 0.055), 6, 34);
  const roadH = clamp(Math.round(h * 0.11), 10, 64);
  const groundY = clamp(h - roadH - paveH, layout.h + 4, h);
  const roadTop = Math.min(h, groundY + paveH);

  paintSky(ctx, w, groundY, sky);
  groundBand(ctx, 'paving', 3, 0, groundY, w, roadTop - groundY);
  groundBand(ctx, 'asphalt', 11, 0, roadTop, w, h - roadTop);

  // the street, from the view's own width: the cafeteria at the left limit and the gym
  // ending at the right one, with the alley and the offices taking what is between them
  const street = streetLayout(w, h, groundY);

  // everything that stands on the ground is clipped to the canvas: a block too tall for
  // the frame runs off the top, and that clipped bulk is the finding, not an error
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  // 1. the masses: offices and gym as silhouettes, between the buildings
  for (const b of street.blocks) {
    const sprite = blockSprite(b);
    if (sprite) ctx.drawImage(sprite.canvas, b.x, groundY - b.h);
  }

  // 2. the alley first: it is a recess, so everything the cafeteria oversails has to end up in
  // front of it. Drawn after the cafeteria, the niche's wall cut the plinth, the string course
  // and the cornice exactly where they step past the 192, which read as three cut bands
  const slot = street.blocks.find((b) => b.kind === 'alley');
  const niche = alleySprite({ leftH: slot.flanks.leftH, rightH: slot.flanks.rightH });
  ctx.drawImage(niche.canvas, slot.x, groundY - niche.h);

  // 3. the cafeteria's art, at x=0, its own sprite height setting the ground line. The sprite is
  // drawn wider than the 192 so the plinth, the string course and the cornice can oversail it:
  // the building's mass still starts exactly at the left limit, and its bands pass in front of
  // the alley's mouth instead of being cut by it
  ctx.fillStyle = rgba(C.ink, 0.32);
  ctx.fillRect(0, groundY, layout.w, 3);
  ctx.drawImage(building.canvas, -layout.bleed, groundY - layout.h);
  // 3a. the clothesline's wire, over the café and over its own washing: one px, no outline, so
  // it reads as a wire at 10x instead of as a steel tube. Its box is in the layout's own art
  // coordinates, so it climbs the same ground line the building does and needs no bleed: the
  // building's canvas is padded by `bleed` and the wire's is not
  ctx.drawImage(wire.canvas, wireAt.x, groundY - layout.h + wireAt.y);

  // 3b. the gym, at its block's x with its bottom row on the same ground line. It is art now,
  // not a mass: gym.js owns its 240x188, and the block it stands on is the width the layout
  // gives it — at the frame the street was measured at, the same 240.
  const gymBlock = street.blocks.find((b) => b.kind === 'gym');
  const gym = gymSprite();
  ctx.drawImage(gym.canvas, gymBlock.x, groundY - gym.h);

  // 4. the one person on the pavement, in front of the brick pier between the door and the
  // glass: their feet are on the ground line the building's own bottom row sits on, so their
  // 30 art px are measured from the same line as the six diners' 26
  const feet = groundY;
  ctx.fillStyle = rgba(C.ink, 0.38);
  ctx.fillRect(STAND_CLEAR_X - 1, feet - 1, standing.w + 2, 2);
  ctx.drawImage(standing.canvas, STAND_CLEAR_X, feet - standing.h);

  ctx.restore();

  // the numbers are a tool, not scenery: nothing is drawn unless ?debug=1 asks for it, so
  // the street is judged clean and can still be measured when the question is whether it fits
  if (showMetrics) {
    // the block labels sit above their roofs, over everything: a number is no use hidden
    // behind the mass it describes
    paintBlockLabels(ctx, street, groundY, view);
    drawReadout(ctx, w, h, street);
  }

  still = stillCanvas;
  streetGroundY = groundY;
  // the moving parts, in the order they are drawn: the fan on the flat, the smoke off the flue,
  // the ball that smoke rises behind, the cat on the parapet. They come from one list, so a
  // frame is a loop and never a fourth copy of the fan's three lines.
  animated = cafeAnimations();
}

// One frame: the still, then the moving parts. Five blits and nothing else.
function draw() {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, view.w, view.h);
  ctx.drawImage(still, 0, 0);
  // the building's own bottom row sits on the ground line, so a painted y only has to climb
  // from there: the fan lands exactly in the housing its sprite cut, the smoke on the flue's
  // mouth, the ball over it and the cat's feet on the parapet's coping
  const top = streetGroundY - layout.h;
  for (const element of animated) {
    const { sprite, x, y } = element.place(clock, frozen);
    ctx.drawImage(sprite.canvas, x, top + y);
  }
}

let view = null;
let still = null;
let streetGroundY = 0;
let animated = [];

function layoutPage() {
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  view = computeView(cssW, cssH, window.devicePixelRatio || 1, zoom, TARGET_H);
  applyView(canvas, view, cssW, cssH);
  paintStill(view);
  draw();
}

// The clock, stepped in fixed quanta like the floor's and the walker's: a frame never depends
// on how fast the machine that drew it was
const FIXED = 1 / 60;
let last = 0;
let acc = 0;

function tick(now) {
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += raw;
  while (acc >= FIXED) {
    clock += FIXED;
    acc -= FIXED;
  }
  draw();
  requestAnimationFrame(tick);
}

window.addEventListener('resize', layoutPage);
layoutPage();

// frozen or paused, the one frame is the whole page — which is what a capture wants
if (!frozen && !startPaused) {
  last = performance.now();
  requestAnimationFrame(tick);
}
