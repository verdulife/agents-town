// The cafeteria page, now the whole street's massing check (S16-S20). The cafeteria keeps the
// art it was approved with, against the left limit of the view; the alley, the offices and the
// gym are added at the same storey, so the one question is answered by eye and by numbers: does
// the whole street fit?
//
// The street is composed, in the order a street reads: the alley first (it is a recess, so what
// oversails it has to end up in front of it), then the cafeteria, the offices, the gym and the park
// — all five of them art now — and then the person in front of the cafeteria. Every width comes
// from streetLayout, which reads the view's own width, and the readout prints the layout back at the
// bottom right. The park is the strip past the gym's own 240 (S24): it appears on views wider than
// the street's 822 and it is not there on narrower ones, where the gym is clipped instead.
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
import { Painter } from './pixel.js';
import { computeView, applyView, TARGET_H } from './next/scale.js';
import { terrainPatch } from './next/terrain.js';
import { drawText, lineWidth } from './font.js';
import { CAFE, cafeSprite, cafeLayout, personSprite, cafeAnimations, wireSprite } from './next/cafe.js';
import { streetLayout, streetReadout, paintBlockLabels, streetRooms } from './next/street.js';
import { alleySprite } from './next/alley.js';
import { gymSprite } from './next/gym.js';
import { officesSprite } from './next/offices.js';
import { PARK, parkSprite, parkAnimations } from './next/park.js';
import { GROUND, groundSprite } from './next/ground.js';
import { paintSkyBase, paintSkyOver, skyAnimations } from './next/sky.js';
import { shadowSheet, glowSheet, lightFor } from './next/light.js';

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
// the lighting is the newest thing on the page and the easiest to make a mistake in, so it can be turned
// off whole with ?light=0 and the scene compared against the plain one
const lighting = params.get('light') !== '0';
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

  // the ground's own bands, measured in art px and fixed (GROUND, S25): the pavement's two courses,
  // the kerb, the gutter and the core of the road. The fade below the road takes whatever the frame
  // has left, so the street's floor keeps its measurements instead of stretching with the window,
  // and the art pixel stays the same size on every monitor
  const groundH = GROUND.contact + GROUND.pave + GROUND.kerb + GROUND.gutter + GROUND.road;
  const groundY = clamp(h - groundH, layout.h + 4, h);

  // the street, from the view's own width: the cafeteria at the left limit and the gym keeping its
  // own 240, with the alley, the offices and the park taking what is between them
  const street = streetLayout(w, h, groundY);

  // the sky, painted by sky.js into a still of its own: the ramp, the horizon haze, the city in three
  // planes and the cirrus. Its own picture because the street's still is opaque, and a drifting cloud
  // drawn with the street's moving parts would cross the offices — the sky moves behind them
    // the sky's own features are placed in the band the street leaves visible: everything above the
  // tallest roof. A cloud or a star painted where a building stands is a cloud nobody sees
  const clear = Math.max(0, groundY - Math.max(...street.blocks.map((b) => b.h)));
  // two sky pictures and not one, because the sun passes behind the clouds: the base is the ramp and the
  // cirrus, the over is the clouds and the landscape in front of them, and between the two the page
  // draws the sun, the moon and the stars
  const skyParams = { w, h: groundY, time: sky.name, clear };
  skyBase = paintSkyBase(new Painter(w, groundY), skyParams).sprite().canvas;
  skyOver = paintSkyOver(new Painter(w, groundY), skyParams).sprite().canvas;
  // the street's floor, painted by ground.js at the elevation's own scale: two courses of slabs, the
  // kerb, the wet road and the dark near edge, with every block's contact shadow and the light of
  // every lit block on it. One blit, and no terrain tile anywhere in it
  const ground = groundSprite({
    w,
    h: h - groundY,
    sky: sky.name,
    blocks: street.blocks,
    // the one drain the street has stands where the water runs: by the café's door
    doorX: layout.standX,
  });
  ctx.drawImage(ground.canvas, 0, groundY);
  // the park's ground, over the pavement and inside the park's own span: the terrain catalogue's
  // grass, laid by the same band helper the rest of the town's floors come from. park.js paints what
  // stands in the strip and nothing else, so the grass is the page's. It covers the pavement's
  // courses and their contact rows, and stops at the kerb, which is the street's and not the park's
  // the park no longer lays a grass band over the pavement: the pavement runs in front of it, unbroken,
  // and the park is a plot set back behind that line — kerb, grass receding, railing, all of it inside
  // park.js, which is what gives it the depth the alley has
  const parkBlock = street.blocks.find((b) => b.kind === 'park');

  // everything that stands on the ground is clipped to the canvas: a block too tall for
  // the frame runs off the top, and that clipped bulk is the finding, not an error
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  // 1. the alley first: it is a recess, so everything the cafeteria oversails has to end up in
  // front of it. Drawn after the cafeteria, the niche's wall cut the plinth, the string course
  // and the cornice exactly where they step past the 192, which read as three cut bands. The
  // masses that used to stand here are gone: all four blocks are art now
  const slot = street.blocks.find((b) => b.kind === 'alley');
  const niche = alleySprite({ leftH: slot.flanks.leftH, rightH: slot.flanks.rightH });
  ctx.drawImage(niche.canvas, slot.x, groundY - niche.h);

  // 2. the cafeteria's art, at x=0, its own sprite height setting the ground line. The sprite is
  // drawn wider than the 192 so the plinth, the string course and the cornice can oversail it:
  // the building's mass still starts exactly at the left limit, and its bands pass in front of
  // the alley's mouth instead of being cut by it
  ctx.drawImage(building.canvas, -layout.bleed, groundY - layout.h);
  // 2a. the clothesline's wire, over the café and over its own washing: one px, no outline, so
  // it reads as a wire at 10x instead of as a steel tube. Its box is in the layout's own art
  // coordinates, so it climbs the same ground line the building does and needs no bleed: the
  // building's canvas is padded by `bleed` and the wire's is not
  ctx.drawImage(wire.canvas, wireAt.x, groundY - layout.h + wireAt.y);

  // 2b. the offices, at their block's x with their bottom row on the same ground line, after
  // the alley and before the gym. offices.js owns their 302x326: four storeys and a lift, drawn
  // instead of massed, and the block it stands on is the width the sprite already has.
  const officesBlock = street.blocks.find((b) => b.kind === 'offices');
  const offices = officesSprite();
  ctx.drawImage(offices.canvas, officesBlock.x, groundY - offices.h);

  // 2c. the gym, at its block's x with its bottom row on the same ground line. It is art now,
  // not a mass: gym.js owns its 240x188, and the block it stands on is the width the layout
  // gives it — at the frame the street was measured at, the same 240.
  const gymBlock = street.blocks.find((b) => b.kind === 'gym');
  const gym = gymSprite();
  ctx.drawImage(gym.canvas, gymBlock.x, groundY - gym.h);

  // 2d. the park, in the strip the gym no longer absorbs, its bottom row on the same ground line,
  // so its trees, its fountain and its lamp stand on the grass band laid above. A strip too narrow
  // for the fountain has no art at all (park.h is 0) and the blit is one transparent row.
  const park = parkBlock ? parkSprite(parkBlock.w) : null;
  if (park) ctx.drawImage(park.canvas, parkBlock.x, groundY - park.h);

  // 3. the one person on the pavement, in front of the brick pier between the door and the
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

  // the lighting, composed once per resize and never per frame: the street's still multiplied by the
  // shadow sheet (white where nothing casts) and then added the pools the glass throws. The SKY is not in
  // this pass — it is already the light of its own moment and must not be darkened twice
  if (lighting) {
    // the street's still is TRANSPARENT above the buildings — the sky is its own picture — so a plain
    // multiply would turn that transparency black. The order that works: white base, multiply the street
    // onto it, multiply the shadow sheet, then destination-in with the street again to throw the white
    // away (keeping the shadows only where the street is), and add the glass on top
    const lit = document.createElement('canvas');
    lit.width = w;
    lit.height = h;
    const lctx = lit.getContext('2d');
    lctx.imageSmoothingEnabled = false;
    lctx.fillStyle = '#ffffff';
    lctx.fillRect(0, 0, w, h);
    lctx.globalCompositeOperation = 'multiply';
    lctx.drawImage(stillCanvas, 0, 0);
    lctx.drawImage(shadowSheet({ w, h, groundY, street, time: sky.name }).canvas, 0, 0);
    lctx.globalCompositeOperation = 'destination-in';
    lctx.drawImage(stillCanvas, 0, 0);
    // the lit rooms keep their own light: the unlit pixels of the street are pasted back inside each room at
    // the moment's `spare`, so a room at midnight is a lamp in a dark street and not another grey wall
    const spare = lightFor(sky.name).spare;
    const rooms = streetRooms(street, groundY);
    if (spare > 0.02) {
      lctx.globalCompositeOperation = 'source-over';
      lctx.globalAlpha = spare;
      for (const room of rooms) {
        lctx.drawImage(stillCanvas, room.x, room.y, room.w, room.h, room.x, room.y, room.w, room.h);
      }
      lctx.globalAlpha = 1;
    }
    lctx.globalCompositeOperation = 'lighter';
    lctx.drawImage(glowSheet({ w, h, groundY, street, time: sky.name, rooms }).canvas, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    still = lit;
  } else {
    still = stillCanvas;
  }
  streetGroundY = groundY;
  // where each block's animated coordinates start: the café's own bottom row, and the park's. No
  // element carries a page coordinate, so a block can move and its animations move with it.
  parkOrigin = park ? { x: parkBlock.x, y: groundY - park.h } : { x: 0, y: groundY };
  // the moving parts, in the order they are drawn: the fan on the flat, the smoke off the flue,
  // the ball that smoke rises behind, the cat on the parapet, and then the park's fountain jet.
  // They come from one list, so a frame is a loop and never a fourth copy of the fan's three lines.
  animated = park ? [...cafeAnimations(), ...parkAnimations(parkBlock.w)] : cafeAnimations();
  // what moves in the sky: the stars, the moon, the two cloud banks, the window groups and the
  // beacons. They are drawn between the two stills, so they are behind the street and can never
  // cross a facade
  skyAnimated = skyAnimations({ w, h: groundY, time: sky.name, clear });
}

// One frame: the still, then the moving parts. Six blits and nothing else.
function draw() {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, view.w, view.h);
  // the sky in three steps: the ramp, then what belongs BEHIND the clouds (the sun, the moon, the
  // stars), then the clouds and the landscape over them. After that the street, so no cloud can ever
  // pass in front of the offices
  if (skyBase) {
    ctx.drawImage(skyBase, 0, 0);
    const behind = (element) => (element.layer ?? 'behind') === 'behind';
    for (const element of skyAnimated.filter(behind)) {
      const { sprite, x, y } = element.place(clock, frozen);
      ctx.drawImage(sprite.canvas, x, y);
    }
    ctx.drawImage(skyOver, 0, 0);
    for (const element of skyAnimated.filter((e) => !behind(e))) {
      const { sprite, x, y } = element.place(clock, frozen);
      ctx.drawImage(sprite.canvas, x, y);
    }
  }
  ctx.drawImage(still, 0, 0);
  // each element names the block its coordinates belong to, and the café is the default: its four
  // keep climbing from the building's own bottom row exactly as they did. A painted y only has to
  // climb from its origin, so the fan lands in the housing its sprite cut, the smoke on the flue's
  // mouth, the ball over it, the cat's feet on the parapet's coping and the jet in its bowl.
  const origins = {
    cafe: { x: 0, y: streetGroundY - layout.h },
    park: parkOrigin,
  };
  for (const element of animated) {
    const origin = origins[element.origin ?? 'cafe'];
    const { sprite, x, y } = element.place(clock, frozen);
    ctx.drawImage(sprite.canvas, origin.x + x, origin.y + y);
  }
}

let view = null;
let still = null;
let skyBase = null;
let skyOver = null;
let skyAnimated = [];
let streetGroundY = 0;
let animated = [];
let parkOrigin = { x: 0, y: 0 };

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
