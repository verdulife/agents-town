// The alley, as a place (S20). The vertical sign is gone: what stands between the café and the
// offices is a niche you look into, and this sprite is the answer to one question by eye — does
// a slot between two buildings read as depth on a frontal grid, and is there room in it for the
// things an alley has?
//
// Three planes, in painting order:
//
//   the back wall   72x64 — one storey, the same floor height the buildings use — in cold, unlit
//                   brick, with a 4 px coping over it and sky above it inside the slot
//   the returns     8 px each. Left: the café's flank seen edge-on, the full height of the café
//                   (172), near-black and stepping a little lighter toward the mouth — this is
//                   what sells the angle. Right: the offices' flank, darker still and as tall as
//                   the offices, so the slot has a tall dark edge on that side
//   the floor       10 px of wet paving from the pavement back to the wall, a 4x3 drain, a damp
//                   sheen, and the dumpster standing on it against the left return
//
// The light: nothing in the slot is lit. The brick is the café's brick two steps toward ink, so
// it still reads as brick and not as a different material; the shade falls off from the mouth to
// the back in three bands of ink instead of a per-pixel gradient, and the offices throw a cast
// shadow across the right half of the wall with a stair for an edge. Bands read at 2 physical px
// per art px; a gradient smears into one value and costs more.
//
// The one saturated thing is the magenta moustache on the back wall: 30x9, tilted 8 degrees, an
// outline with a filled body and three drips, at an alpha that lets the courses show through it.
// Everything else in the slot stays muted, which is what lets it be the first thing you see.
//
// Coordinates: a sprite pixel is an art pixel, y grows down, and the sprite's bottom row is the
// ground line every other block stands on, so the dumpster's wheels land on the pavement's own
// row. `ALLEY` holds the alley's metrics; the two flank heights are the neighbours' and come in
// from the layout that owns them.
//
// Deterministic: fixed seeds, no clock, no Math.random, no colour literal. Nothing here is drawn
// with an outline pass: the slot is already ink, and an outline would only fatten its silhouette
// into the sky.

import { Painter, cacheSprite } from '../pixel.js';
import { C, mix, rgba } from './palette.js';
import { makeRng } from '../rng.js';
import { CAFE, BRICK } from './cafe.js';

const cache = new Map();

// The street's storey, from the café's own two numbers: the seams on the returns sit on the same
// floor lines as the buildings whose flanks they are.
const STOREY = CAFE.floorH + CAFE.slab; // 74

export const ALLEY = {
  w: 88, // the niche: the café's 192 ends where this starts
  returnW: 0, // no flank strips: the slot is the wall and the floor, seen square on
  backH: CAFE.floorH, // 64: one storey, the height the buildings' own floors use
  coping: 4, // the cap over that wall, and the slab under it on the way up
  floor: 10, // the wet paving, from the pavement back to the wall
  shade: {
    bands: 3, // three bands of ink up the wall: the falloff, not a gradient
    step: 0.1, // each band a step darker than the one under it
    cast: 0.2, // the offices' shadow, over the right half of the wall
    castShare: 0.5, // how much of the wall's width it takes
    penumbra: 3, // columns of stair in front of its edge, so it is not a cut
    contact: 2, // columns of shade where each flank meets the wall
  },
  graffiti: {
    w: 34, // the moustache's own box, out to out: wide enough for the curls
    h: 10,
    angle: 8, // degrees: the right tip lifted, the way a can in a hand comes out
    pad: 4, // room around the box for the turn, so the paint is never clipped
    drips: 3,
    // the paint is thin: the brick's courses still read through the body of the glyph
    body: 0.72,
    outline: 0.58,
    drip: 0.42,
  },
  drain: { w: 4, h: 3, inset: 2 }, // 4x3, a couple of rows up from the pavement
  dumpster: {
    w: 26,
    h: 20, // lid, body and wheels: the bags sit outside these numbers
    lidRise: 3, // how far the lid's near (café-side) end is up off its hinge
    lidThick: 3,
    wheel: { w: 3, h: 2 },
    seams: 2, // vertical seams down the body
  },
  bag: { w: 10, h: 6 }, // on the lid
  footBag: { w: 8, h: 7 }, // leaning at the bin's foot
  seed: 6023,
};

// ------------------------------------------------------------------ materials

const MAT = {
  // the café's own brick, two steps into the shade: mixed toward ink so the wall is still the
  // same brick as the building beside it, only unlit
  brick: {
    base: mix(mix(C.brick, C.woodDark, 0.28), C.ink, 0.5),
    lite: mix(mix(C.brickLite, C.woodDark, 0.18), C.ink, 0.56),
    dark: mix(mix(C.brick, C.woodDark, 0.28), C.ink, 0.74),
    mortar: mix(mix(C.plaster, C.stone, 0.45), C.ink, 0.62),
  },
  // street stone, in the shade: the coping is the brightest thing in the slot, and it is not
  // bright
  stone: {
    base: mix(mix(C.stoneLite, C.sand, 0.4), C.ink, 0.52),
    lite: mix(mix(C.stoneLite, C.sand, 0.4), C.ink, 0.44),
    dark: mix(C.stone, C.ink, 0.66),
  },
  // the flanks, mouth to back, left then right. The offices' side is darker still at every step:
  // the café's wall catches what light the street has, the offices' does not
  flankL: [
    mix(C.ink3, C.ink, 0.4),
    mix(C.ink3, C.ink, 0.62),
    mix(C.ink2, C.ink, 0.6),
  ],
  flankR: [
    mix(C.ink2, C.ink, 0.86),
    mix(C.ink2, C.ink, 0.72),
    mix(C.ink3, C.ink, 0.72),
  ],
  paving: {
    back: mix(C.stone, C.ink, 0.88), // at the wall's foot
    mouth: mix(C.stone, C.ink, 0.68), // on the pavement, where the street's light still lands
    seam: mix(C.stone, C.ink, 0.92), // the wall's contact shadow
    sheen: rgba(C.glassLite, 0.12), // wet: the sky, off a puddle that is only a few px wide
  },
  drain: {
    void: mix(C.ink, C.ink2, 0.5),
    lip: mix(C.stone, C.ink, 0.5),
    bar: mix(C.metal, C.ink, 0.62),
  },
  bin: {
    base: mix(C.roofGreen, C.ink, 0.42), // pressed steel, painted green, thirty years ago
    lite: mix(C.roofGreenLite, C.ink, 0.36),
    dark: mix(C.roofGreenDark, C.ink, 0.34),
    void: mix(C.ink, C.ink2, 0.3),
    wheel: mix(C.metal, C.ink, 0.3), // a castor: the one bit of the bin that has to read off the floor
  },
  bag: { // rubbish bags: the one soft, mid-valued thing at the bin's foot
    base: mix(C.ink3, C.stone, 0.3),
    lite: mix(mix(C.ink3, C.stone, 0.3), C.stoneLite, 0.4),
    dark: mix(C.ink2, C.ink, 0.2),
  },
  // the moustache: the whole saturation budget of the alley, and it is still paint, not neon
  paint: {
    body: rgba(C.neonPink, ALLEY.graffiti.body),
    outline: rgba(mix(C.neonPink, C.ink, 0.45), ALLEY.graffiti.outline),
    drip: rgba(mix(C.neonPink, C.ink, 0.12), ALLEY.graffiti.drip),
  },
};

// ------------------------------------------------------------------- layout

// Every x and y the painters need. The slot has no flank strips any more — drawing the two
// returns as 8 px black columns read as two black columns, not as depth — so `h` is the alley's
// own: back wall, coping and floor, and the sky above it is the page's.
export function alleyGeom(leftH = 0, rightH = 0) {
  const { w, returnW, backH, coping, floor, graffiti, drain, dumpster, bag, footBag } = ALLEY;
  const backW = w - returnW * 2; // 72
  const h = floor + backH + coping;

  const backX = returnW;
  const wallTop = h - floor - backH; // the back wall's first row
  const floorTop = h - floor; // the paving's first row
  const copTop = wallTop - coping;

  return {
    w,
    h,
    backX,
    backW,
    backH,
    wallTop, // the back wall: wallTop .. floorTop - 1
    floorTop, // the paving: floorTop .. h - 1
    copTop,
    copH: coping,
    returnW,
    leftH: Math.round(leftH),
    rightH: Math.round(rightH),
    // the graffiti sits a touch above the middle of the wall, clear of the dumpster's lid
    gr: {
      x: backX + Math.round((backW - graffiti.w) / 2),
      y: wallTop + Math.round((backH - graffiti.h) / 2) - 3,
      w: graffiti.w,
      h: graffiti.h,
    },
    drain: {
      x: backX + Math.round(backW / 2 - drain.w / 2),
      y: h - drain.h - drain.inset,
      w: drain.w,
      h: drain.h,
    },
    bin: { x: backX, y: h - dumpster.h, w: dumpster.w, h: dumpster.h },
    topBag: { x: backX + 1, y: h - dumpster.h - bag.h + 1, w: bag.w, h: bag.h },
    // at the bin's foot, leaning against it: mostly clear of the body, so both wheels read
    footBag: {
      x: backX + dumpster.w - 4,
      y: h - footBag.h,
      w: footBag.w,
      h: footBag.h,
    },
  };
}

// --------------------------------------------------------------- back wall

// The café's brick grid — the same brick, the same course height, the same running bond — in the
// alley's own material. The courses are keyed to the sprite's y so both neighbours' walls and
// this one share one grid: the alley is a gap between buildings, not a fourth facade.
function coldBrick(p, x, y, w, h, seed) {
  const rng = makeRng(seed);
  const m = MAT.brick;
  const courseH = BRICK.h + BRICK.joint; // 4
  const pitch = BRICK.w + BRICK.joint; // 9
  p.rect(x, y, w, h, m.mortar);
  const first = Math.floor(y / courseH);
  const last = Math.ceil((y + h) / courseH);
  for (let c = first; c < last; c++) {
    const courseY = c * courseH;
    const y0 = Math.max(y, courseY);
    const y1 = Math.min(y + h, courseY + BRICK.h);
    if (y1 <= y0) continue;
    const shift = c & 1 ? BRICK.bond : 0;
    for (let bx = Math.floor((x - shift) / pitch) * pitch + shift; bx < x + w; bx += pitch) {
      const x0 = Math.max(x, bx);
      const x1 = Math.min(x + w, bx + BRICK.w);
      if (x1 <= x0) continue;
      // one colour per brick. The joints are what make a wall read as courses, so the bricks
      // themselves only have to be a little uneven
      const t = rng();
      const col = t < 0.22 ? m.dark : t < 0.42 ? m.lite : m.base;
      p.rect(x0, y0, x1 - x0, y1 - y0, col);
      // the lit top edge of a brick, rarely: texture, not a grid
      if (t > 0.88 && y1 - y0 > 1) p.hline(x0, y0, x1 - x0, mix(col, m.lite, 0.3));
    }
  }
}

// The shade on the wall: three bands of ink, the top one deepest, so the light dies on its way
// into the slot. Then the offices' cast shadow across the right half, its near edge a stair of
// three columns, and a contact shadow where each flank stands against the wall.
function paintWallShade(p, g) {
  const { backX, backW, wallTop, backH } = g;
  const s = ALLEY.shade;
  const bandH = Math.ceil(backH / s.bands);
  for (let i = 0; i < s.bands; i++) {
    const y = wallTop + i * bandH;
    const h = Math.min(backH - i * bandH, bandH);
    if (h <= 0) break;
    // i counts down from the coping: the band under the coping is the darkest
    p.rect(backX, y, backW, h, rgba(C.ink, s.step * (s.bands - i)));
  }
  // the flanks' own shade, on the two columns of wall each of them stands against
  for (let i = 0; i < s.contact; i++) {
    const a = 0.16 - i * 0.06;
    p.vline(backX + i, wallTop, backH, rgba(C.ink, a));
    p.vline(backX + backW - 1 - i, wallTop, backH, rgba(C.ink, a));
  }
  // the offices' cast shadow, from the stair to the far flank
  const edge = backX + Math.round(backW * s.castShare);
  for (let i = 0; i < s.penumbra; i++) {
    const x = edge - s.penumbra + i;
    p.vline(x, wallTop, backH, rgba(C.ink, (s.cast * (i + 1)) / (s.penumbra + 1)));
  }
  p.rect(edge, wallTop, backX + backW - edge, backH, rgba(C.ink, s.cast));
}

// The coping: 4 px of street stone over the wall, a lit top edge so the slot's top reads against
// the sky, and the shadow the cap throws down onto the brick under it.
function paintCoping(p, g) {
  const { backX, backW, copTop, copH, wallTop } = g;
  const st = MAT.stone;
  p.rect(backX, copTop, backW, copH, st.base);
  p.hline(backX, copTop, backW, st.lite);
  p.hline(backX, copTop + copH - 1, backW, st.dark);
  // one course joint through the middle of the cap: 4 px of stone read as stone, not as a line
  p.vline(backX + Math.round(backW / 2), copTop + 1, copH - 2, mix(st.base, st.dark, 0.7));
  p.rect(backX, wallTop, backW, 2, rgba(C.ink, 0.22));
}

function paintBackWall(p, g) {
  coldBrick(p, g.backX, g.wallTop, g.backW, g.backH, ALLEY.seed + 3);
  paintWallShade(p, g);
  paintCoping(p, g);
}

// ------------------------------------------------------------------ floor

// The paving: four steps from the wall's foot to the pavement, the mouth the lightest, because
// the light comes in from the street. Wet, so a few short reflections of the sky lie on it and
// the rows near the mouth keep a wet lip.
function paintFloor(p, g) {
  const { backX, backW, floorTop, h } = g;
  const pave = MAT.paving;
  const rows = h - floorTop; // 10
  for (let i = 0; i < rows; i++) {
    // three bands and no more: a per-row gradient over 10 rows is a smear, a band is a plane,
    // and the mouth's band is the widest because that is the end the light comes in from
    const step = Math.min(2, Math.floor((i / rows) * 3)) / 2; // 0 at the wall, 1 at the mouth
    p.hline(backX, floorTop + i, backW, mix(pave.back, pave.mouth, step));
  }
  p.hline(backX, floorTop, backW, pave.seam); // the wall's contact shadow
  const rng = makeRng(ALLEY.seed + 7);
  for (let i = 0; i < 7; i++) {
    const sy = floorTop + 2 + Math.floor(rng() * (rows - 3));
    const sx = backX + 2 + Math.floor(rng() * (backW - 14));
    const len = 3 + Math.floor(rng() * 8);
    p.hline(sx, sy, Math.min(len, backX + backW - sx), pave.sheen);
  }
  // the wet lip on the last row, where the alley's floor meets the street's pavement
  p.hline(backX, h - 1, backW, mix(pave.mouth, C.glassLite, 0.28));
  paintDrain(p, g);
}

// A 4x3 grate, a couple of rows up from the pavement: a void, a lit lip on the mouth side and
// two bars, so three slots read at 2 physical px per art px.
function paintDrain(p, g) {
  const d = g.drain;
  const m = MAT.drain;
  p.rect(d.x - 1, d.y - 1, d.w + 2, d.h + 2, rgba(C.ink, 0.25)); // the damp ring around it
  p.rect(d.x, d.y, d.w, d.h, m.void);
  p.hline(d.x, d.y, d.w, m.lip);
  p.hline(d.x, d.y + d.h - 1, d.w, mix(m.bar, C.ink, 0.4));
  for (let i = 0; i < d.w; i += 2) p.vline(d.x + i, d.y + 1, d.h - 1, m.bar);
}

// --------------------------------------------------------------- graffiti

// The moustache, row by row, as spans in the 34x10 box, after the reference the user sent: two
// rounded humps on the top edge with a V between them, thin points at the extremes, and below the
// tips the mass narrowing to the point of the V, which is the lowest thing in the glyph.
const MOUSTACHE = [
  // the top edge: two humps with a shallow V between them, two rows deep and a few px wide
  [[7, 13], [20, 26]],
  [[5, 15], [18, 28]],
  // the body, thick and almost straight: a moustache is a bar with weight, not a bow
  [[3, 31]],
  [[1, 32]],
  // one row carries the points to the extremes, and the next pulls them back in: thin tips
  [[0, 33]],
  [[1, 32]],
  [[2, 31]],
  [[2, 31]],
  // the bottom: the two bellies are the lowest thing, and the mouth is a notch between them
  [[3, 15], [18, 28]],
  [[5, 13], [20, 26]],
];

// The glyph on a grid one pixel larger on every side: 1 for the body, 2 for the outline, 0 for
// brick. The outline sits outside the 30x9 and not on it, so the moustache keeps its whole
// thickness and the darker edge is a halo of spray around it, not a border painted over it.
export function moustacheMask(w, h) {
  const mw = w + 2;
  const mh = h + 2;
  const grid = new Uint8Array(mw * mh);
  MOUSTACHE.forEach((spans, row) => {
    if (row >= h) return;
    for (const [a, b] of spans) {
      for (let x = Math.max(0, a); x <= b && x < w; x++) grid[(row + 1) * mw + x + 1] = 1;
    }
  });
  const at = (x, y) => (x < 0 || y < 0 || x >= mw || y >= mh ? 0 : grid[y * mw + x]);
  const out = grid.slice();
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      if (at(x, y)) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) out[y * mw + x] = 2;
    }
  }
  return out;
}

// Paint on the wall, at an angle. Each pixel of the box asks the un-turned glyph what lies under
// it, so the paint keeps its own edge one art pixel at a time instead of being smoothed by a
// rotated blit. The turn is a couple of degrees off square: someone painted it leaning.
function paintGraffiti(p, g) {
  const box = g.gr;
  const { angle, pad, drips } = ALLEY.graffiti;
  const mask = moustacheMask(box.w, box.h);
  const mw = box.w + 2;
  // the mask is one px larger on every side than the glyph's box: its halo lives outside it
  const at = (u, v) =>
    u < -1 || v < -1 || u > box.w || v > box.h ? 0 : mask[(v + 1) * mw + (u + 1)];
  const a = (-angle * Math.PI) / 180; // minus: the right tip is the one that lifts
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const cw = box.w / 2;
  const ch = box.h / 2;
  for (let y = -pad; y < box.h + pad; y++) {
    for (let x = -pad; x < box.w + pad; x++) {
      const dx = x + 0.5 - cw;
      const dy = y + 0.5 - ch;
      const u = Math.round(cw + dx * cos - dy * sin);
      const v = Math.round(ch + dx * sin + dy * cos);
      const cell = at(u, v);
      if (!cell) continue;
      p.px(box.x + x, box.y + y, cell === 2 ? MAT.paint.outline : MAT.paint.body);
    }
  }
  // the drips: paint runs down the wall, not along the glyph, so they hang square while the
  // moustache leans. Three of them, off three of its low points.
  const rng = makeRng(ALLEY.seed + 11);
  for (let i = 0; i < drips; i++) {
    const u = Math.round(4 + (i + 0.5) * ((box.w - 8) / drips));
    let v = box.h - 1;
    while (v >= 0 && at(u, v) !== 1) v--;
    if (v < 0) continue;
    const dx = u + 0.5 - cw;
    const dy = v + 0.9 - ch;
    const gx = Math.round(box.x + cw + dx * cos + dy * sin);
    const gy = Math.round(box.y + ch - dx * sin + dy * cos);
    const len = 2 + Math.floor(rng() * 3); // 2..4 rows
    for (let k = 0; k < len; k++) p.px(gx, gy + k, MAT.paint.drip);
  }
}

// ---------------------------------------------------------------- returns

// One flank: three columns of shade from the mouth to the back of the slot, three or four px
// wide each, and a seam on every floor line the building behind it really has. Without a seam an
// 8 px column is a black bar; with one the slot has storeys you can count.
function paintFlank(p, { x, w, hh, gy, steps, seamTone, capTone }) {
  if (hh <= 0) return;
  const top = gy - hh;
  const n = steps.length;
  for (let s = 0; s < n; s++) {
    const x0 = x + Math.round((s * w) / n);
    const x1 = x + Math.round(((s + 1) * w) / n);
    if (x1 > x0) p.rect(x0, top, x1 - x0, hh, steps[s]);
  }
  for (let y = gy - STOREY; y > top; y -= STOREY) p.hline(x, y, w, seamTone);
  // the cap: the cornice of the building this flank belongs to, the one place the slot's edge
  // catches anything at all
  if (capTone) p.hline(x, top, w, capTone);
}

function paintReturns(p, g) {
  const { returnW, backX, backW, leftH, rightH, h } = g;
  // left: the café's flank, edge-on, from the pavement to its own roof
  paintFlank(p, {
    x: 0,
    w: returnW,
    hh: leftH,
    gy: h,
    steps: MAT.flankL,
    seamTone: mix(C.ink3, C.ink, 0.86), // the café's string course, one hair deeper
    capTone: mix(C.slate, C.ink, 0.5), // its cornice at the top
  });
  // right: the offices' flank, the full height of the offices and darker still
  paintFlank(p, {
    x: backX + backW,
    w: returnW,
    hh: rightH,
    gy: h,
    steps: MAT.flankR,
    seamTone: mix(C.ink2, C.stone, 0.16), // the offices' slab edges, barely there
    capTone: null,
  });
}

// --------------------------------------------------------------- dumpster

// One plastic bag: a pear that sags, a knot at the top, a lit shoulder and a dark base. It is the
// only soft thing in the alley, which is what makes it read as rubbish and not as a box.
function paintBag(p, box, tone, seed) {
  const { x, y, w, h } = box;
  const t = MAT[tone];
  const rng = makeRng(seed);
  // a pear, not a box: the rows step out from the knot to the belly and only pull back at the
  // very bottom, so it sags the way a full bag does
  const insets = [0.34, 0.16, 0.04, 0, 0, 0.08];
  for (let i = 0; i < h; i++) {
    const inset = Math.round(w * (insets[Math.min(insets.length - 1, i)] ?? 0));
    p.hline(x + inset, y + i, Math.max(1, w - inset * 2), t.base);
  }
  p.rect(x + Math.round(w * 0.36), y - 1, 2, 1, t.dark); // the knot, squeezed shut
  p.hline(x + 2, y + 1, Math.max(2, Math.round(w * 0.4)), t.lite); // the shoulder the light lands on
  p.px(x + 1 + Math.floor(rng() * (w - 2)), y + 2 + Math.floor(rng() * Math.max(1, h - 4)), t.lite);
  p.hline(x + 2, y + h - 1, Math.max(1, w - 4), t.dark); // the base, in its own shadow
}

// The dumpster, in profile, on the café side. The lid is hinged at its far end and lifted at the
// near one, so the bin's dark inside shows through the gap it opens; the wheels sit under the
// body with their last row on the ground line, and two seams divide the body into the panels a
// pressed steel bin has. A bag lies on the lid and another leans at its foot.
function paintDumpster(p, g) {
  const b = g.bin;
  const { lidRise, lidThick, wheel, seams } = ALLEY.dumpster;
  const m = MAT.bin;
  const bodyTop = b.y + lidRise + lidThick; // the rim, and the line the lid hinges on
  const bodyBottom = b.y + b.h - wheel.h; // one row past the body's last
  const bodyH = bodyBottom - bodyTop;
  // the body: a box that tapers a couple of px at its base, the way a pressed steel bin does,
  // lit along its head and its near (café-side) end, dark at its foot and its far end
  for (let i = 0; i < bodyH; i++) {
    const inset = Math.round((i * 2) / Math.max(1, bodyH - 1)); // 0 at the rim, 2 at the rail
    const rowW = b.w - inset * 2;
    const x0 = b.x + inset;
    const col = i === 0 ? m.lite : i >= bodyH - 2 ? m.dark : m.base;
    p.hline(x0, bodyTop + i, rowW, col);
    p.px(x0, bodyTop + i, mix(m.base, m.lite, 0.4));
    p.px(x0 + rowW - 1, bodyTop + i, m.dark);
  }
  // the two seams that panel the body, and a dent where something heavy was dropped in
  for (let i = 1; i <= seams; i++) {
    const sx = b.x + Math.round((b.w * i) / (seams + 1));
    p.vline(sx, bodyTop + 1, bodyH - 3, m.dark);
    p.px(sx + 1, bodyTop + 1, mix(m.base, m.lite, 0.3));
  }
  p.hline(b.x + 4, bodyTop + 5, 3, mix(m.base, m.dark, 0.45));
  p.px(b.x + 5, bodyTop + 6, mix(m.base, m.lite, 0.35)); // the dent, and its lit lower lip
  // the lid: hinged at the far end, up at the near one, the bin's inside showing in the gap
  for (let u = 0; u < b.w; u++) {
    const top = b.y + Math.round((lidRise * u) / (b.w - 1));
    const under = top + lidThick;
    if (under < bodyTop) p.rect(b.x + u, under, 1, bodyTop - under, m.void);
    p.px(b.x + u, top, m.lite); // the lid's lit top edge
    p.rect(b.x + u, top + 1, 1, lidThick - 2, m.base);
    p.px(b.x + u, top + lidThick - 1, m.dark);
  }
  // the wheels, and the shadow the body throws between them
  p.hline(b.x, b.y + b.h - 1, b.w, rgba(C.ink, 0.4));
  const wy = b.y + b.h - wheel.h;
  for (const u of [3, b.w - 3 - wheel.w]) {
    p.rect(b.x + u, wy, wheel.w, wheel.h, m.wheel);
    p.hline(b.x + u, wy, wheel.w, mix(m.wheel, C.stoneLite, 0.4)); // the castor's lit rim
    p.px(b.x + u + wheel.w - 1, wy + wheel.h - 1, mix(m.wheel, C.ink, 0.55));
  }
  // the bag on the lid, at its lifted end, and the one leaning at the bin's foot
  paintBag(p, g.topBag, 'bag', ALLEY.seed + 13);
  paintBag(p, g.footBag, 'bag', ALLEY.seed + 17);
}

// ------------------------------------------------------------------ sprite

// The niche, one sprite, cached by the two flank heights it was built for. The page blits it at
// the alley block's own x, its bottom row on the ground line every other block stands on.
export function alleySprite({ leftH = 0, rightH = 0 } = {}) {
  const lh = Math.max(0, Math.round(Number(leftH) || 0));
  const rh = Math.max(0, Math.round(Number(rightH) || 0));
  return cacheSprite(cache, `alley|${lh}|${rh}`, () => {
    const g = alleyGeom(lh, rh);
    const p = new Painter(g.w, g.h);
    paintBackWall(p, g);
    paintGraffiti(p, g);
    paintFloor(p, g);
    paintReturns(p, g);
    // the bin's own shadow on the paving, and then the bin over it
    p.hline(g.bin.x, g.h - 1, g.footBag.x + g.footBag.w - g.bin.x, rgba(C.ink, 0.3));
    paintDumpster(p, g);
    return p.sprite();
  });
}
