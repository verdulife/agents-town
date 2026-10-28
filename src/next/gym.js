// The gym (S21, L22/L23), drawn instead of massed. The block that stood here was an ink mass
// with an empty frame over it; this is the same 240x188, painted: two glazed floors in grey
// cladding, the corporate accent used in doses, and the big screen moved to the roof on its own
// steel structure (L23: "al tejado, sobre estructura metálica").
//
// The contract lives in GYM and nowhere else. The street's block takes its height from these
// numbers (2 * (64 + 10) + 40 = 188), the painters derive every x and y from them, and the
// page places the sprite by its bottom row, so the ground line is the street's own line.
//
//   storey      floor 64 to the underside of the slab, slab 10, two storeys; the top slab is
//               the building's cornice, so the block is 148 of building and 40 of roof
//   board       40 above the cornice: 28 of screen, a 2 px beam and 9 px of steel legs
//   ground      the order the brief gives it — the big double glass door at the left, then the
//               huge window: 4 cladding · door bay 46 · 4 cladding · window 176 · 10 corner.
//               The door and the glazing share one head line and both start at the street: there
//               is no plinth anywhere on this building.
//   glazing     20 px panes on a 22 pitch, 2 px mullions. 8 panes in the window, 10 in the
//               upper band, and the two grids are the same grid: 11 and 55 are exactly two
//               pitches apart, so every mullion above stands on one below.
//   upper       one continuous band, 220 of the 240 wide, glazed from the head right down to
//               the slab — the whole storey is a window
//   head        a 4 px light frieze under a 2 px reveal, on both floors: that is the "light
//               transom or frieze", and it is where the logo block and the mullion caps sit
//   inside      the counter behind the door, two treadmills and the flight on the ground floor;
//               the flight's arrival, the well it comes up through with its railing, a weights
//               rack and two bikes above. The flight is one object: its top step is the upper
//               floor's slab line (114) and the well above is the same x range (150..209).
//   screen      one wide empty frame, square on, cleared so the sky shows through it: the
//               placeholder for real data later
//
// The palette is the street's greys (stone, stoneLite, slate, metal, metalLite, metalDark, ink)
// plus the three brand keys added for this building. Nothing else: the glass is a cold slate
// veil and its reflections are bone, so the interior reads cooler than the café's warm plaster
// without borrowing the café's glass or its lamps.
//
// Deterministic: fixed seeds, no clock, no Math.random, no colour literal. Coordinates: a sprite
// pixel is an art pixel, y grows down, and the sprite's bottom row is the ground line.

import { Painter, cacheSprite } from '../pixel.js';
import { C, mix, rgba } from './palette.js';
import { makeRng } from '../rng.js';

const cache = new Map();

export const GYM = {
  width: 240,
  floors: 2,
  floor: 64, // the floor line to the underside of the slab above it
  slab: 10, // the slab between the two glazed floors
  cornice: 10, // the roof slab, which is this building's cornice
  board: 40, // the steel structure above the cornice and the screen it carries
  // the mullion grid both floors are cut on: 20 of glass, 2 of steel
  grid: { pane: 20, bar: 2 },
  ground: { panes: 8, frame: 1, pierL: 4, pierMid: 4, reveal: 2, frieze: 4, channel: 1 },
  upper: { panes: 10, frame: 1, reveal: 2, frieze: 4 },
  // the double door: two 20 px leaves in a 46 bay, its own steel frame, and the pulls that are
  // the only warm accent on this floor besides the counter
  door: { w: 46, frame: 2, post: 2, stile: 2, head: 3, foot: 4, pull: { h: 16, top: 26 } },
  logo: { x: 58, w: 16, h: 4 }, // on the head frieze, where a shop puts its name
  counter: { x: 8, w: 40, top: 26, slab: 2, stripe: 2, monitor: { w: 12, h: 9, inset: 10 } },
  // the flight: 12 treads of 5, the top one exactly on the upper floor's slab
  stairs: { x: 150, tread: 5, treads: 12, rail: 12 },
  machines: {
    treadmill: { x: 62, w: 42, h: 24, gap: 4, count: 2 },
    rack: { x: 22, w: 48, h: 36, shelves: 3, step: 8 },
    bike: { x: 86, w: 28, h: 17, gap: 6, count: 2 },
  },
  screen: { w: 168, h: 28, frame: 3, legs: 3, legW: 2, legInset: 22, beam: 2 },
  seed: 7391,
};

// ---------------------------------------------------------------- materials

const MAT = {
  // the cladding: a light grey panel wall. This is what makes the building read as a modern
  // glass box rather than as a dark hole with frames in it
  panel: {
    base: mix(C.stoneLite, C.stone, 0.34),
    lite: mix(C.stoneLite, C.white, 0.3),
    dark: mix(C.stone, C.ink, 0.3),
    joint: mix(C.stone, C.slate, 0.5),
  },
  steel: { base: C.metal, lite: C.metalLite, dark: C.metalDark },
  // the window frames sit a step darker than the bands, so a mullion reads against the glass
  frame: {
    base: mix(C.metalDark, C.slate, 0.34),
    lite: mix(C.metal, C.metalLite, 0.45),
    dark: mix(C.metalDark, C.ink, 0.45),
  },
  // the inside of a gym under glass: colder and quieter than the café's plaster, and darker
  // than the cladding outside, so the machines have something to be read against
  room: {
    wall: mix(mix(C.stoneLite, C.slate, 0.5), C.ink, 0.26),
    joint: mix(C.slate, C.ink, 0.2),
    ceiling: mix(C.slate, C.ink, 0.45),
    floor: mix(C.stone, C.ink, 0.4),
    floorLite: mix(C.stone, C.ink, 0.2),
    light: mix(C.stoneLite, C.white, 0.55), // the lit face of a machine's console
    void: mix(C.ink, C.ink3, 0.45), // the stairwell: a hole, so it is darker than anything
  },
};

// The glass, as three numbers: the veil, the cold at the head, and the reflections. A tint is a
// decision, not a per-pixel effect, so it is stated once and used by the window, the band and
// the two door leaves.
const GLASS = { veil: 0.3, head: 0.05, refl: 0.06 };

// ------------------------------------------------------------------- layout

let LAYOUT = null;

export function gymLayout() {
  if (LAYOUT) return LAYOUT;
  const { width, floor, slab, cornice, board, grid, ground, upper, door, stairs, machines, screen } = GYM;
  const glazingW = (panes) => panes * grid.pane + (panes - 1) * grid.bar;
  const barXs = (x, panes) =>
    Array.from({ length: panes - 1 }, (_, i) => x + (i + 1) * grid.pane + i * grid.bar);

  // vertical, from the ground line up: the two glazed floors, the slab between them, and a top
  // slab that is the cornice. The 40 above it is the board, which is the block's own 40
  const floorY = board + cornice + floor + slab + floor; // 188 = the sprite's height
  const groundTop = floorY - floor; // 124
  const midY = groundTop - slab; // 114: the slab's first row, and the upper floor's floor line
  const upperTop = midY - floor; // 50
  const corniceY = upperTop - cornice; // 40

  // horizontal, left to right: corner, door bay, the pier between, the window, the corner
  const doorX = ground.pierL; // 4
  const windowX = doorX + door.w + ground.pierMid; // 54
  const glassX = windowX + ground.frame; // 55
  const groundGlassW = glazingW(ground.panes); // 174 = 8 * 20 + 7 * 2
  const windowW = groundGlassW + ground.frame * 2; // 176
  const glassRight = glassX + groundGlassW - 1; // 228
  // the upper band ends where the window ends; its panes use the same pitch, so the two grids
  // coincide (11 and 55 are 44 apart: exactly two pitches)
  const upperGlassW = glazingW(upper.panes); // 218 = 10 * 20 + 9 * 2
  const upperGlassX = glassRight + 1 - upperGlassW; // 11
  const upperX = upperGlassX - upper.frame; // 10
  const upperW = upperGlassW + upper.frame * 2; // 220

  // the glazing rows: both bands hang from their head band, and only the ground floor has a
  // 1 px channel at the street — this building has no plinth on either floor
  const groundGlassTop = groundTop + ground.reveal + ground.frieze; // 130
  const groundGlassBottom = floorY - 1 - ground.channel; // 186
  const upperGlassTop = upperTop + upper.reveal + upper.frieze; // 56
  const upperGlassBottom = midY - 1; // 113: the glazing runs down to the slab

  // the door shares the window's head, and its bottom row is the street
  const doorY = groundGlassTop; // 130
  const doorH = floorY - doorY; // 58
  const doorInnerW = door.w - door.frame * 2; // 42
  const leafW = (doorInnerW - door.post) / 2; // 20
  const leaves = [0, 1].map((i) => ({
    x: doorX + door.frame + i * (leafW + door.post),
    w: leafW,
    // 25 and 28: on the stiles either side of the centre post, where a hand goes
    pullX: doorX + door.frame + i * (leafW + door.post) + (i === 0 ? leafW - 1 : 0),
  }));

  // the flight: one tread per riser, the last one exactly on midY, so the flight below and the
  // arrival above are the same stair. `well` is the hole the flight comes up through: the
  // flight's x range minus its top tread, which is the arrival itself
  const groundRow = floorY - 1 - ground.channel; // 186: the last visible row of the room
  const rise = groundRow - midY; // 73: the floor line to the upper floor's slab
  const treads = Array.from({ length: stairs.treads }, (_, k) => ({
    x: stairs.x + k * stairs.tread,
    w: stairs.tread,
    y: groundRow - Math.round(((k + 1) * rise) / stairs.treads),
  }));
  const well = {
    x: stairs.x,
    w: stairs.tread * (stairs.treads - 1), // 55: everything but the arrival tread
    h: 4, // the part of the opening a frontal view can see: the slot at the floor line
  };
  well.y = midY - well.h; // 110
  const rail = { x: stairs.x, y: midY - 1 - stairs.rail, w: stairs.tread * stairs.treads, h: stairs.rail };

  // the machines, on the same floor lines as everything else
  const treadmill = machines.treadmill;
  const treadmills = Array.from({ length: treadmill.count }, (_, i) => treadmill.x + i * (treadmill.w + treadmill.gap));
  const bike = machines.bike;
  const bikes = Array.from({ length: bike.count }, (_, i) => bike.x + i * (bike.w + bike.gap));

  // the screen on its structure, centred over the building
  const screenX = Math.round((width - screen.w) / 2); // 36
  const screenY = 1;
  const beamY = screenY + screen.h; // 29
  const legTop = beamY + screen.beam; // 31
  const legs = Array.from({ length: screen.legs }, (_, i) =>
    screenX +
    screen.legInset +
    Math.round((i * (screen.w - screen.legInset * 2 - screen.legW)) / (screen.legs - 1)),
  );

  LAYOUT = {
    w: width,
    h: floorY,
    floorY,
    groundTop,
    groundRow,
    midY,
    upperTop,
    corniceY,
    corniceH: cornice,
    slabY: midY,
    slabH: slab,
    doorX,
    doorY,
    doorH,
    door,
    leaves,
    // the glazing rectangles, the only places where the room shows
    groundGlass: { x: glassX, y: groundGlassTop, w: groundGlassW, h: groundGlassBottom - groundGlassTop + 1 },
    upperGlass: { x: upperGlassX, y: upperGlassTop, w: upperGlassW, h: upperGlassBottom - upperGlassTop + 1 },
    windowX,
    windowW,
    groundBars: barXs(glassX, ground.panes), // 75, 97, ... 207
    upperBars: barXs(upperGlassX, upper.panes), // 31, 53, 75, ... 207
    upperX,
    upperW,
    rightPier: width - (windowX + windowW), // 10
    headBands: [
      { y: upperTop, reveal: upper.reveal, frieze: upper.frieze },
      { y: groundTop, reveal: ground.reveal, frieze: ground.frieze },
    ],
    treads,
    well,
    rail,
    counter: { ...GYM.counter, topY: groundRow - GYM.counter.top },
    treadmills,
    bikes,
    rack: { x: machines.rack.x, y: midY - 1 - machines.rack.h, w: machines.rack.w, h: machines.rack.h },
    screen: { x: screenX, y: screenY, w: screen.w, h: screen.h, beamY, legTop, legs },
  };
  return LAYOUT;
}

// ------------------------------------------------------------------ helpers

// A straight one-pixel tube between two points: the bikes' frames and their diagonals are the
// only sloped lines in the building, and a stepped line is how a pixel drawing makes one.
function tube(p, x0, y0, x1, y1, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (steps === 0) return;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    p.px(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), color);
  }
}

// The cold veil over a glazing rect. The room behind it is already painted; this is what makes
// it glass — a slate veil, a little colder at the head where the sky sits in it, and two
// reflections leaning the same way. Never called over a mullion: a tint on a frame reads as a
// dirty window.
function paintGlass(p, rect) {
  const { x, y, w, h } = rect;
  const { ctx } = p;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = rgba(C.slate, GLASS.veil);
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = rgba(C.slate, GLASS.head);
    ctx.fillRect(x, y, w, 10 - i);
  }
  for (const [off, width] of [
    [10, 3],
    [Math.round(w * 0.56), 2],
  ]) {
    for (let i = 0; i < h; i++) {
      const rx = x + off + Math.round(i * 0.7);
      if (rx + width <= x + w) {
        ctx.fillStyle = rgba(C.white, GLASS.refl);
        ctx.fillRect(rx, y + i, width, 1);
      }
    }
  }
  ctx.restore();
}

// The cladding: panels, not a fill. A panel every 8 rows and 16 columns, each one a fraction
// lighter or darker than its neighbour from a fixed seed, and a joint between them — this is
// what stops 240 px of light grey reading as a flat slab of colour.
function paintCladding(p, x, y, w, h, seed) {
  if (w <= 0 || h <= 0) return;
  const rng = makeRng(seed);
  p.rect(x, y, w, h, MAT.panel.base);
  for (let py = y; py < y + h; py += 8) {
    const ph = Math.min(8, y + h - py);
    for (let px = x; px < x + w; px += 16) {
      const pw = Math.min(16, x + w - px);
      p.rect(px, py, pw, ph, mix(MAT.panel.base, MAT.panel.lite, rng() * 0.18));
      p.vline(px, py, ph, MAT.panel.joint);
    }
    p.hline(x, py, w, MAT.panel.joint);
  }
  p.vline(x, y, h, MAT.panel.lite); // the lit arris, where the cladding turns to the light
  p.vline(x + w - 1, y, h, MAT.panel.dark);
}

// The head band both floors hang from: a 2 px reveal in the slab's shadow and a 4 px steel
// frieze. It crosses the whole building, so the door head, the window head and the band above
// are one line — the thing that makes two storeys read as one facade.
function paintHeadBand(p, L, band) {
  const { y, reveal, frieze } = band;
  p.rect(0, y, L.w, reveal, MAT.steel.dark);
  p.rect(0, y + reveal, L.w, frieze, MAT.steel.base);
  p.hline(0, y + reveal, L.w, MAT.steel.lite);
  p.hline(0, y + reveal + frieze - 1, L.w, mix(MAT.steel.dark, C.ink, 0.3));
  // seams on the same pitch as the cladding's panels, so the band is part of the wall
  for (let x = 16; x < L.w; x += 16) p.vline(x, y + reveal + 1, frieze - 2, mix(MAT.steel.base, C.ink, 0.28));
}

// The mullions of one band, and the 2 px cap of brand where each meets the head: the accent
// appears where a building actually has a painted detail, not as a stripe across a wall.
function paintMullions(p, bars, rect) {
  const { y, h } = rect;
  for (const x of bars) {
    p.rect(x, y, GYM.grid.bar, h, MAT.frame.base);
    p.vline(x, y, h, MAT.frame.lite);
    p.vline(x + GYM.grid.bar - 1, y, h, MAT.frame.dark);
    p.rect(x, y, GYM.grid.bar, 2, C.brand);
    p.px(x, y + 2, C.brandDark);
  }
}

// -------------------------------------------------------------------- room

function paintRoom(p, L, top, bottom) {
  const h = bottom - top + 1;
  p.rect(0, top, L.w, h, MAT.room.wall);
  // the head of a room is in the slab's shade, the foot is where the glass lets the street in
  for (let i = 0; i < 8; i++) {
    p.hline(0, top + i, L.w, mix(MAT.room.wall, MAT.room.ceiling, 1 - i / 8));
  }
  // joints on a fixed pitch: a panelled wall reads as a room with depth, a flat fill reads as
  // the inside of a hole
  for (let x = 6; x < L.w; x += 30) p.vline(x, top + 8, h - 12, MAT.room.joint);
  // the floor, and the wall's contact shadow over it
  p.rect(0, bottom - 2, L.w, 3, MAT.room.floor);
  p.hline(0, bottom - 3, L.w, MAT.room.floorLite);
  p.hline(0, bottom - 4, L.w, rgba(C.ink, 0.18));
}

// The reception counter behind the double door: a dark front with a light top and one 2 px
// stripe of brand, and a monitor whose lit face is the only light on this floor. The front is
// darker than the wall on purpose — seen through two leaves of glass, a counter that is the same
// value as the room is not a counter, it is a shelf.
function paintCounter(p, L) {
  const c = L.counter;
  const topY = c.topY;
  const bodyY = topY + c.slab;
  const bodyH = L.groundRow - bodyY + 1;
  const front = mix(C.slate, C.ink, 0.4);
  p.rect(c.x, bodyY, c.w, bodyH, front);
  p.vline(c.x, bodyY, bodyH, mix(front, C.stoneLite, 0.2));
  p.vline(c.x + c.w - 1, bodyY, bodyH, mix(front, C.ink, 0.4));
  // the stripe, one hand above the floor of the counter's front
  p.rect(c.x + 2, bodyY + 3, c.w - 4, c.stripe, C.brand);
  p.hline(c.x + 2, bodyY + 3, c.w - 4, C.brandLite);
  p.hline(c.x + 2, bodyY + 3 + c.stripe, c.w - 4, C.brandDark);
  // the top, standing 1 px proud of the front on each side
  p.rect(c.x - 1, topY, c.w + 2, c.slab, mix(MAT.panel.lite, C.stone, 0.3));
  p.hline(c.x - 1, topY, c.w + 2, mix(C.stoneLite, C.white, 0.4));
  p.hline(c.x - 1, topY + c.slab - 1, c.w + 2, MAT.panel.dark);
  // the monitor, standing on the counter's left half: a steel casing, a lit face, a foot
  const m = c.monitor;
  const mx = c.x + m.inset;
  const my = topY - m.h;
  p.rect(mx, my, m.w, m.h, mix(MAT.steel.base, C.stoneLite, 0.35));
  p.hline(mx, my, m.w, C.stoneLite);
  p.rect(mx + 2, my + 2, m.w - 4, 4, MAT.room.light);
  p.hline(mx + 2, my + 5, m.w - 4, mix(MAT.room.light, C.slate, 0.4));
  p.rect(mx + Math.round(m.w / 2) - 1, my + m.h, 2, 1, MAT.steel.dark);
}

// ---------------------------------------------------------------- machines

// A treadmill in profile: deck, two feet, the upright and the console. The proportions are the
// ones that make it read at 2 physical px per art px — a body low and long, one mass standing
// up at the front, and a lit screen where the eye expects one.
function paintTreadmill(p, x, L) {
  const baseY = L.groundRow;
  const deckY = baseY - 8;
  const top = deckY - 16;
  const w = GYM.machines.treadmill.w;
  // the deck: a dark belt with its running surface lit, on two short legs
  p.rect(x + 2, deckY, w - 12, 4, MAT.steel.dark);
  p.hline(x + 2, deckY, w - 12, mix(MAT.steel.lite, C.white, 0.25));
  p.hline(x + 2, deckY + 1, w - 12, MAT.steel.base);
  p.hline(x + 2, deckY + 3, w - 12, mix(MAT.steel.dark, C.ink, 0.3));
  p.rect(x + 2, baseY - 2, 4, 3, MAT.steel.dark);
  p.rect(x + w - 16, baseY - 2, 4, 3, MAT.steel.dark);
  // the upright and the console it carries
  p.rect(x + w - 12, top, 3, deckY - top, MAT.steel.base);
  p.vline(x + w - 12, top, deckY - top, MAT.steel.lite);
  p.vline(x + w - 10, top, deckY - top, MAT.steel.dark);
  p.rect(x + w - 18, top, 14, 7, MAT.steel.dark);
  p.hline(x + w - 18, top, 14, MAT.steel.base);
  p.rect(x + w - 15, top + 2, 8, 3, MAT.room.light);
  p.hline(x + w - 15, top + 4, 8, mix(MAT.room.light, C.slate, 0.4));
  // the handrail, forward of the console and a little higher than the belt
  p.hline(x + 8, deckY - 9, w - 22, MAT.steel.lite);
  p.vline(x + 8, deckY - 9, 5, MAT.steel.base);
  // the frame's accent: one column of brand down the upright, and nothing else
  p.vline(x + w - 11, top + 8, 7, C.brand);
}

// A bike in profile: two wheels, a frame of six thin tubes, the saddle, the bars. Drawn as a
// ring and a line drawing rather than as a mass, because at 2 physical px per art px a bicycle is
// recognised by its holes — two rims with the wall behind them — and a filled silhouette of the
// same size reads as a lump. One pixel of frame is 2 physical px, which is exactly a tube.
function ring(p, cx, cy, r, color) {
  for (let i = -r; i <= r; i++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - i * i)));
    p.px(cx - half, cy + i, color);
    p.px(cx + half, cy + i, color);
  }
  // the caps, so the ring closes at the top and at the foot instead of stopping one pixel short
  p.hline(cx - 1, cy - r, 3, color);
  p.hline(cx - 1, cy + r, 3, color);
}

// A tube with thickness: the same stepped line, repeated down a few rows, so a bicycle's frame
// and a stair's stringer can be drawn with the weight a pixel drawing gives them.
function fatTube(p, x0, y0, x1, y1, color, thickness = 2) {
  for (let i = 0; i < thickness; i++) tube(p, x0, y0 + i, x1, y1 + i, color);
}

function paintBike(p, x, L) {
  const baseY = L.midY - 1; // the upper floor's own line
  const r = 5;
  const rear = { x: x + 6, y: baseY - r - 1 };
  const front = { x: x + 20, y: baseY - r - 1 };
  const crank = { x: x + 13, y: baseY - 4 };
  const top = { x: x + 18, y: baseY - 13 };
  const seatTop = { x: x + 9, y: baseY - 14 };
  const d = MAT.steel.dark;
  // the wheels: a tyre, a rim inside it, and the wall showing through the middle
  for (const w of [rear, front]) {
    ring(p, w.x, w.y, r, d);
    for (let i = -r + 2; i < 0; i++) {
      const half = Math.round(Math.sqrt(Math.max(0, (r - 1) * (r - 1) - i * i)));
      p.px(w.x - half, w.y + i, mix(d, MAT.steel.base, 0.5));
      p.px(w.x + half, w.y + i, mix(d, MAT.steel.base, 0.5));
    }
    p.rect(w.x - 1, w.y - 1, 2, 2, MAT.steel.lite); // the hub
  }
  // the frame: chain stay, seat stay, seat tube, top tube, down tube, fork — two pixels, so it
  // is the same weight as the tyres and the bike reads as one object
  fatTube(p, rear.x, rear.y, crank.x, crank.y, d, 1);
  fatTube(p, rear.x, rear.y, seatTop.x, seatTop.y, d, 1);
  fatTube(p, crank.x, crank.y, seatTop.x, seatTop.y, d, 2);
  fatTube(p, seatTop.x, seatTop.y, top.x, top.y, d, 2);
  fatTube(p, crank.x, crank.y, top.x, top.y, d, 2);
  fatTube(p, top.x, top.y, front.x, front.y, d, 2);
  // the saddle and the bars, lit along their tops
  p.rect(x + 6, baseY - 16, 7, 2, d);
  p.hline(x + 6, baseY - 16, 7, MAT.steel.lite);
  p.rect(x + 16, baseY - 16, 7, 2, d);
  p.hline(x + 16, baseY - 16, 7, MAT.steel.lite);
  // the frame's accent: two pixels of brand on the down tube, and it is the whole of it
  p.px(crank.x + 1, crank.y - 2, C.brand);
  p.px(crank.x + 2, crank.y - 3, C.brand);
}

// The weights rack: two uprights, three shelves and nine dumbbells. It is the densest thing in
// the building, which is why it lives against the quiet end of the upper wall.
function paintRack(p, L) {
  const r = L.rack;
  const top = r.y;
  const baseY = L.midY - 1;
  const w = r.w;
  for (const x of [r.x, r.x + w - 2]) {
    p.rect(x, top, 2, baseY - top + 1, MAT.steel.base);
    p.vline(x, top, baseY - top + 1, MAT.steel.lite);
    p.vline(x + 1, top, baseY - top + 1, MAT.steel.dark);
  }
  // the shelves, then the dumbbells standing on each of them
  const step = GYM.machines.rack.step;
  for (let i = 0; i < GYM.machines.rack.shelves; i++) {
    const sy = baseY - 4 - i * step;
    p.hline(r.x + 2, sy, w - 4, MAT.steel.lite);
    p.hline(r.x + 2, sy + 1, w - 4, MAT.steel.dark);
    for (let d = 0; d < 3; d++) {
      const dx = r.x + 6 + d * 14;
      p.rect(dx, sy - 3, 2, 3, MAT.steel.dark); // the near end of the dumbbell
      p.rect(dx + 2, sy - 2, 3, 1, MAT.steel.lite); // the bar
      p.rect(dx + 5, sy - 3, 2, 3, MAT.steel.dark); // the far end
      p.px(dx, sy - 3, MAT.steel.base);
    }
  }
  // the frame's accent: one column of brand inside each upright
  p.vline(r.x + 1, top + 4, baseY - top - 12, C.brand);
  p.vline(r.x + w - 2, top + 4, baseY - top - 12, C.brand);
}

// ------------------------------------------------------------------ stairs

// The flight, as a floating steel stair: a tread every 300 mm, nothing under them, and the
// stringer — one pixel of brand stepping up from the floor to the slab — as the member that
// carries them. The top tread is on midY, the upper floor's own slab.
function paintStairs(p, L) {
  const { treads } = L;
  const rail = GYM.stairs.rail;
  // the handrail and its posts, behind the treads
  for (const t of treads) {
    const ry = t.y - rail;
    p.hline(t.x, ry, t.w, MAT.steel.lite);
    p.hline(t.x, ry + 1, t.w, MAT.steel.dark);
    if ((t.x - GYM.stairs.x) % (GYM.stairs.tread * 4) === 0) {
      p.vline(t.x + 1, ry, t.y - ry, MAT.steel.base);
    }
  }
  // the treads, then the stringer stepping under them
  for (const t of treads) {
    p.rect(t.x, t.y, t.w, 2, MAT.steel.base);
    p.hline(t.x, t.y, t.w, mix(MAT.steel.lite, C.white, 0.2));
    p.hline(t.x, t.y + 1, t.w, MAT.steel.dark);
  }
  for (let i = 0; i < treads.length; i++) {
    const t = treads[i];
    p.hline(t.x, t.y + 3, t.w, C.brand);
    if (i + 1 < treads.length) {
      const next = treads[i + 1];
      p.vline(t.x + t.w, next.y + 3, t.y - next.y + 1, C.brand);
      p.px(t.x + t.w, next.y + 3, C.brandDark);
    }
  }
}

// ---------------------------------------------------------------- interiors

function paintGroundRoom(p, L) {
  paintRoom(p, L, L.groundTop, L.groundRow);
  paintCounter(p, L);
  for (const x of L.treadmills) paintTreadmill(p, x, L);
  paintStairs(p, L);
  // the veil goes on last, over the room and over everything in it
  paintGlass(p, L.groundGlass);
}

function paintUpperRoom(p, L) {
  paintRoom(p, L, L.upperTop, L.midY - 1);
  // a mirror behind the rack: a broad, cooler panel, the way a gym wall is built
  const mx = L.rack.x - 4;
  const mw = L.rack.w + 8;
  const my = L.upperTop + 12;
  const mh = 36;
  p.rect(mx, my, mw, mh, mix(MAT.room.wall, C.stoneLite, 0.3));
  p.hline(mx, my, mw, mix(MAT.room.wall, C.stoneLite, 0.55));
  p.hline(mx, my + mh - 1, mw, mix(MAT.room.wall, C.ink, 0.3));
  for (let i = 0; i < 5; i++) p.vline(mx + 10 + i, my + 2 + i * 5, 3, rgba(C.white, 0.06));
  paintRack(p, L);
  for (const x of L.bikes) paintBike(p, x, L);
  // the opening, then the railing over it: the flight below and the arrival above share one x
  // range (150..209) and this is what says so. A hole is a slot and a lit edge, not a box: the
  // slab's near edge catches the light, the hole below it is the darkest thing in the building,
  // and the arrival tread sits where the flight's top step lands.
  const w = L.well;
  p.rect(w.x, w.y, w.w, w.h, MAT.room.void);
  p.hline(w.x, w.y, w.w, mix(MAT.panel.lite, C.ink, 0.25));
  p.hline(w.x, w.y + 1, w.w, mix(C.ink, C.ink3, 0.3));
  const arrival = L.treads[L.treads.length - 1];
  p.rect(arrival.x, w.y, arrival.w, 2, MAT.steel.base);
  p.hline(arrival.x, w.y, arrival.w, mix(MAT.steel.lite, C.white, 0.2));
  const r = L.rail;
  p.hline(r.x, r.y, r.w, MAT.steel.lite);
  p.hline(r.x, r.y + 1, r.w, MAT.steel.dark);
  for (let x = r.x + 2; x < r.x + r.w; x += 6) p.vline(x, r.y + 1, r.h - 1, MAT.steel.base);
  p.rect(r.x, r.y - 1, 2, r.h + 1, MAT.steel.lite); // the newel at the flight's foot
  paintGlass(p, L.upperGlass);
}

// ------------------------------------------------------------------ facade

function paintGroundFacade(p, L) {
  const band = L.headBands[1];
  paintHeadBand(p, L, band);
  const y = L.groundGlass.y; // 130
  const h = L.floorY - 1 - y + 1; // 130..187, the storey's foot is the street's own row
  // the piers: the 4 px corner at the left, the 4 px between door and window, the 10 px corner
  paintCladding(p, 0, y, GYM.ground.pierL, h, GYM.seed + 11);
  paintCladding(p, L.doorX + GYM.door.w, y, GYM.ground.pierMid, h, GYM.seed + 12);
  paintCladding(p, L.windowX + L.windowW, y, L.rightPier, h, GYM.seed + 13);
  // the window's outer frame, one pixel on each side of the glass
  p.rect(L.windowX, L.groundGlass.y, 1, L.groundGlass.h, MAT.frame.lite);
  p.rect(L.windowX + L.windowW - 1, L.groundGlass.y, 1, L.groundGlass.h, MAT.frame.dark);
  paintMullions(p, L.groundBars, L.groundGlass);
  paintDoor(p, L);
  paintLogo(p, L);
  // the channel the glass is seated in: one row across the building, on the street
  p.rect(0, L.floorY - 1, L.w, GYM.ground.channel, MAT.steel.dark);
}

function paintUpperFacade(p, L) {
  paintHeadBand(p, L, L.headBands[0]);
  const band = L.headBands[0];
  const y = L.upperGlass.y; // 56
  const h = L.upperGlass.h; // 56..113
  // the corner piers: 10 px each, the same grey as the bands below
  paintCladding(p, 0, y, L.upperX, h, GYM.seed + 21);
  paintCladding(p, L.upperX + L.upperW, y, L.w - (L.upperX + L.upperW), h, GYM.seed + 22);
  p.rect(L.upperX, y, 1, h, MAT.frame.lite);
  p.rect(L.upperX + L.upperW - 1, y, 1, h, MAT.frame.dark);
  // one horizontal transom on the upper band only, so 58 px of glazing is not a single sheet:
  // it is what a curtain wall of that height really has. Painted before the mullions, because a
  // mullion runs through a transom and never stops at it
  const ty = band.y + band.reveal + band.frieze + 26;
  p.hline(L.upperX + 1, ty, L.upperW - 2, MAT.frame.base);
  p.hline(L.upperX + 1, ty + 1, L.upperW - 2, MAT.frame.dark);
  paintMullions(p, L.upperBars, L.upperGlass);
}

function paintLogo(p, L) {
  const { x, w, h } = GYM.logo;
  const y = L.headBands[1].y + L.headBands[1].reveal; // 126: on the frieze
  p.rect(x, y, w, h, C.brand);
  p.hline(x, y, w, C.brandLite);
  p.hline(x, y + h - 1, w, C.brandDark);
  // the mark: two light blocks, so the plate reads as a sign and not as a painted patch
  p.rect(x + 3, y + 1, 3, 2, C.brandLite);
  p.rect(x + 9, y + 1, 4, 2, C.brandLite);
}

// A double glass door, no plinth, its bottom row on the street: two 20 px leaves with 2 px
// steel around them, one centre post, and the brand pulls at hand height. Nothing is filled
// behind the glass — the room and the counter painted first show through the leaves, which is
// the only way the door can say what is inside.
function paintDoor(p, L) {
  const d = GYM.door;
  const x = L.doorX;
  const y = L.doorY;
  const h = L.doorH;
  // the head rail, spanning the bay
  p.rect(x, y, d.w, d.head, MAT.frame.base);
  p.hline(x, y, d.w, MAT.frame.lite);
  p.hline(x, y + d.head - 1, d.w, MAT.frame.dark);
  // the two outer uprights and the centre post
  for (const px of [x, x + d.w - d.frame, x + d.frame + L.leaves[0].w]) {
    p.rect(px, y, d.frame, h, MAT.frame.base);
    p.vline(px, y, h, MAT.frame.lite);
    p.vline(px + d.frame - 1, y, h, MAT.frame.dark);
  }
  for (const leaf of L.leaves) {
    const gx = leaf.x + d.stile;
    const gw = leaf.w - d.stile * 2; // 16
    const gy = y + d.head; // 133
    const gh = h - d.head - d.foot; // 51
    // the room behind the leaf is already painted; the veil is what makes it glass
    paintGlass(p, { x: gx, y: gy, w: gw, h: gh });
    // the leaf's own stiles and its foot rail, around the glass
    p.rect(leaf.x, y + d.head, d.stile, h - d.head, MAT.frame.base);
    p.vline(leaf.x, y + d.head, h - d.head, MAT.frame.lite);
    p.rect(leaf.x + leaf.w - d.stile, y + d.head, d.stile, h - d.head, MAT.frame.base);
    p.vline(leaf.x + leaf.w - 1, y + d.head, h - d.head, MAT.frame.dark);
    // the foot rail, 4 px of steel a foot kicks
    p.rect(gx, gy + gh, gw, d.foot, MAT.frame.base);
    p.hline(gx, gy + gh, gw, MAT.steel.base);
    p.hline(gx, gy + gh + d.foot - 1, gw, MAT.frame.dark);
    p.hline(gx, gy - 1, gw, MAT.frame.dark);
    // the pull: 16 px of brand on the stile beside the centre post
    p.vline(leaf.pullX, y + d.pull.top, d.pull.h, C.brand);
    p.px(leaf.pullX, y + d.pull.top - 1, C.brandDark);
    p.px(leaf.pullX, y + d.pull.top + d.pull.h, C.brandDark);
  }
  // a shadow on the threshold, so the door sits in the wall instead of on it
  p.hline(x, y + h - 1, d.w, mix(C.ink, C.metalDark, 0.5));
}

// -------------------------------------------------------------------- shell

// The slab between the floors: the same cladding, a lit line on top (it is the upper floor's
// floor), a shadowed undersides and a joint every 16 px.
function paintSlabBand(p, L) {
  const y = L.slabY;
  const h = L.slabH;
  p.rect(0, y, L.w, h, MAT.panel.base);
  for (let x = 0; x < L.w; x += 16) p.vline(x, y, h, MAT.panel.joint);
  p.hline(0, y, L.w, MAT.panel.lite); // the floor line, lit
  p.hline(0, y + 1, L.w, mix(MAT.panel.base, MAT.panel.lite, 0.5));
  p.hline(0, y + h - 2, L.w, mix(MAT.panel.dark, C.ink, 0.2));
  p.hline(0, y + h - 1, L.w, MAT.steel.dark); // the shadow the slab throws on the floor below
}

// The cornice: the roof slab, in steel, with a lit cap and a shadowed drip edge — a cornice
// drawn by value rather than by overhang, because the sprite is exactly the block's 240.
function paintCornice(p, L) {
  const y = L.corniceY;
  const h = L.corniceH;
  p.rect(0, y, L.w, h, MAT.steel.base);
  p.hline(0, y, L.w, MAT.steel.lite);
  p.hline(0, y + 1, L.w, mix(MAT.steel.base, C.metalLite, 0.5));
  for (let x = 16; x < L.w; x += 32) p.vline(x, y + 2, h - 4, mix(MAT.steel.base, C.ink, 0.3));
  p.hline(0, y + h - 2, L.w, mix(MAT.steel.dark, C.ink, 0.2));
  p.hline(0, y + h - 1, L.w, MAT.steel.dark);
}

// The screen on the roof: an empty frame, square on, cleared so the sky shows through it,
// carried by three legs and a beam that stand on the cornice. It is a placeholder for real data,
// which is why there is nothing inside it.
function paintScreen(p, L) {
  const s = L.screen;
  const f = GYM.screen.frame;
  // the screen: a steel frame with the sky inside it
  p.rect(s.x, s.y, s.w, s.h, MAT.steel.base);
  p.ctx.clearRect(s.x + f, s.y + f, s.w - f * 2, s.h - f * 2);
  p.hline(s.x, s.y, s.w, MAT.steel.lite);
  p.vline(s.x, s.y, s.h, MAT.steel.lite);
  p.hline(s.x, s.y + s.h - 1, s.w, MAT.steel.dark);
  p.vline(s.x + s.w - 1, s.y, s.h, MAT.steel.dark);
  // the inside edge of the frame, so an empty screen still reads as a frame and not as a hole
  p.hline(s.x + f, s.y + f, s.w - f * 2, mix(MAT.steel.dark, C.ink, 0.3));
  p.hline(s.x + f, s.y + s.h - f - 1, s.w - f * 2, mix(MAT.steel.dark, C.ink, 0.15));
  p.vline(s.x + f, s.y + f, s.h - f * 2, mix(MAT.steel.dark, C.ink, 0.3));
  p.vline(s.x + s.w - f - 1, s.y + f, s.h - f * 2, mix(MAT.steel.dark, C.ink, 0.15));
  // the beam it sits on, wider than the legs, and the three legs down to the cornice
  const legW = GYM.screen.legW;
  const beamX = s.legs[0] - 14;
  const beamW = s.legs[s.legs.length - 1] + legW + 14 - beamX;
  p.rect(beamX, s.beamY, beamW, GYM.screen.beam, MAT.steel.base);
  p.hline(beamX, s.beamY, beamW, MAT.steel.lite);
  p.hline(beamX, s.beamY + GYM.screen.beam - 1, beamW, MAT.steel.dark);
  const legH = L.corniceY - s.legTop;
  for (const x of s.legs) {
    p.rect(x, s.legTop, legW, legH, MAT.steel.base);
    p.vline(x, s.legTop, legH, MAT.steel.lite);
    p.vline(x + legW - 1, s.legTop, legH, MAT.steel.dark);
  }
  // the knee braces, from the outer legs' feet out to the beam's ends: a frame, read at 2x,
  // where three posts under a beam would read as a table
  const kneeY = s.beamY + GYM.screen.beam - 1;
  tube(p, s.legs[0], s.legTop + legH - 1, beamX + 1, kneeY, MAT.steel.base);
  tube(p, s.legs[s.legs.length - 1] + legW - 1, s.legTop + legH - 1, beamX + beamW - 2, kneeY, MAT.steel.base);
  // the caps on top of the legs: the smallest place the accent can appear on the roof
  for (const x of s.legs) p.rect(x, s.legTop, legW, 2, C.brand);
}

// ------------------------------------------------------------------- sprite

// The building, cached: nothing in it moves, so the page blits one canvas. Every person, every
// machine and the screen are painted once.
export function gymSprite() {
  return cacheSprite(cache, 'gym', () => {
    const L = gymLayout();
    const p = new Painter(L.w, L.h);
    paintGroundRoom(p, L);
    paintUpperRoom(p, L);
    paintGroundFacade(p, L);
    paintUpperFacade(p, L);
    paintSlabBand(p, L);
    paintCornice(p, L);
    paintScreen(p, L);
    return p.sprite();
  });
}
