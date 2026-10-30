// The street's ground (S25, L36): the pavement, the kerb and the road, painted for an elevation
// instead of tiled from the terrain catalogue.
//
// The catalogue's grounds are drawn to be seen from above — the card's floor, the gallery's
// patches — and at 16 px a tile they belong there. Laid flat across the bottom of a 480 px
// elevation they read as wallpaper: the asphalt carries fourteen marks per tile, which at 2
// physical px per art px is television static, its speckle ends up finer than the pavement's own
// joints (so the near plane looks denser than the far one and the depth inverts), and `groundBand`
// blits the patch bottom-aligned, which cuts the top course of slabs in half. This module paints
// the ground at the elevation's own scale: two courses of slabs, one kerb, one road, and no tile
// anywhere.
//
// The reference is the night street in `refs/background.webp`, and the lesson taken from it is the
// one thing the tiled version could never do: at this hour the street is dark and it is mostly a
// mirror. The road is one cold near-black with the sky lying in its first rows and the windows and
// lamps of the street lying down it in long warm streaks; the pavement is a dark violet-grey where
// only the lit blocks reach. Nothing is lit by a light that is not in the scene.
//
// What it is made of, from the buildings' line down (art px, fixed — the amount the page sizes its
// ground line from; the fade takes whatever the frame has left, so the street keeps its
// measurements instead of stretching with the window):
//
//   contact  3 rows of ink under every block, so nothing stands in the air. The alley's slot spills
//            further onto the pavement, in three bands with a stair for an edge: the one place on
//            the street where the light does not reach
//   pave     20 rows, two courses of 10: the far one in the buildings' shade, the near one
//            where the glass reaches. Slabs are 24 wide, one joint, half a slab of offset between
//            courses, and no grid of highlights — at this hour the joints are what shows, not the
//            arrises
//   kerb     3 rows: a lit granite top, two of face in shadow, one row of ink under it. The grey
//            horizontal that turns two strips into a pavement and a road
//   road     44 rows of one value, cold and wet: the sky in its first rows, the street's lit windows
//            and lamps as vertical streaks broken by the wet, a tar patch, a manhole, the grate at
//            the gutter, two dozen pixels of wear across the whole width, and the near edge falling
//            into ink in five bands with two cold dashes left in it
//
// Colour follows the palette's first rule, shadow cold and light warm: the ground is built out of
// ink and slate, and every warm thing on it is a mix of the warm ramps the buildings are lit with.
// The light follows the alley's own lighting — bands with a step, never a per-pixel gradient.
//
// Deterministic: fixed seed, no clock, no Math.random, no colour literal. A sprite pixel is an art
// pixel, y grows down, and row 0 is the line the buildings stand on.

import { Painter, cacheSprite } from '../pixel.js';
import { C, mix, rgba } from './palette.js';
import { horizonTone } from './sky.js';
import { makeRng } from '../rng.js';

const cache = new Map();

export const GROUND = {
  // the bands, in art px: contact + pave + kerb + gutter + road = 71
  contact: 3,
  pave: 20,
  course: { far: 10, near: 10 }, // two equal courses, half a slab apart: a running bond
  slab: { pitch: 24, offsets: [5, 17] }, // half a slab of offset from one course to the next
  kerb: 3,
  gutter: 1,
  road: 44,
  fade: 20, // the most the near edge may fall into ink; the page gives it whatever is left
  // the warm streaks in the road: a reflection is long, narrow, and broken by the wet
  streak: { rows: 44, wide: 16, alpha: 0.42 },
  spill: { alpha: 0.24, step: 0.07, bands: 3, reach: 12 }, // the alley's ink on the pavement
  wear: 24, // pixels of road wear across the whole width
  moss: 3,
  leaves: 4,
  seed: 9013,
};

const MAT = {
  // the pavement at night: the street's stone mixed most of the way into ink, so the slabs read as
  // slabs by their joints and not by their value. The near course takes a little of the lamps
  pave: {
    far: mix(mix(C.stone, C.slate, 0.34), C.ink, 0.46),
    near: mix(mix(mix(C.stone, C.slate, 0.34), C.ink, 0.4), C.lampWarm, 0.06),
    joint: rgba(C.ink, 0.4),
    arris: rgba(C.white, 0.05),
    chip: mix(C.stone, C.slate, 0.4),
    broken: mix(C.stone, C.slate, 0.22),
  },
  // the kerb is the one pale horizontal on the street: granite, warm under the lamps, lit on its
  // top edge only
  kerb: {
    top: mix(C.stoneLite, C.lampWarm, 0.1),
    face: mix(C.stone, C.slate, 0.52),
    reveal: rgba(C.ink, 0.72),
  },
  // the road: one cold near-black. It is the darkest large thing in the frame, which is what lets
  // the warm streaks be the detail instead of the texture
  road: {
    base: mix(C.ink2, C.slate, 0.3),
    wear: mix(C.stone, C.slate, 0.45),
    patch: mix(C.ink, C.ink2, 0.3),
    seam: mix(C.stone, C.ink, 0.8),
  },
  grate: {
    void: mix(C.ink, C.ink2, 0.25),
    bar: mix(C.metal, C.ink, 0.6),
  },
  // the lights the street already has, as reflections: the café's two windows and its door lamp,
  // the offices' panes, the gym's brand screen
  light: {
    window: mix(C.lampWarm, C.brand, 0.28),
    door: mix(C.lamp, C.glassLit, 0.4),
    pane: mix(C.lampWarm, C.glassLitSoft, 0.4),
    brand: mix(C.brand, C.brandLite, 0.2),
  },
  moss: mix(C.grassDark, C.ink, 0.28),
  leaf: mix(C.wood, C.woodDark, 0.4),
};

// The horizon colour of the moment in use: the sky the wet road reflects. It comes from sky.js, which
// also paints the haze and mixes the cloud's underside with it — one value, three users, so the road
// and the sky above it can never drift apart.
function horizonOf(sky) {
  return horizonTone(sky);
}

// ------------------------------------------------------------------ pavement

// Two courses of slabs, dark, and the accidents a pavement has at night: a chip, one slab broken
// across its own corner, moss where the water stands by the kerb, a leaf. The joints do the
// structure and the arris is one column at 5% — a lit grid at this hour is a tiled bathroom.
function paintPavement(p, w) {
  const G = GROUND;
  // the first course starts at row 0, not under the contact band: the band is a shadow laid ON the
  // pavement, and a shadow over transparent pixels is a hole in the sprite. Every row of this ground
  // is opaque, which is what lets the page blit it and nothing else.
  const off = 0;
  const rng = makeRng(G.seed);
  const courses = [
    { y: off, h: G.contact + G.course.far, tone: MAT.pave.far, x0: G.slab.offsets[0] },
    { y: off + G.contact + G.course.far, h: G.course.near, tone: MAT.pave.near, x0: G.slab.offsets[1] },
  ];
  for (const course of courses) {
    p.rect(0, course.y, w, course.h, course.tone);
    for (let x = course.x0; x < w; x += G.slab.pitch) {
      p.vline(x, course.y, course.h, MAT.pave.joint);
      p.vline(x + 1, course.y + 1, course.h - 2, MAT.pave.arris);
    }
    p.hline(0, course.y + course.h - 1, w, rgba(C.ink, 0.3));
  }
  const chipX = [Math.round(w * 0.18), Math.round(w * 0.46), Math.round(w * 0.79)];
  for (const cx of chipX) {
    p.rect(cx + Math.round(rng() * 6), G.contact + 2 + Math.round(rng() * (G.pave - 6)), 3, 2, MAT.pave.chip);
  }
  // one slab broken across its corner: a lighter scar and the crack that made it
  const bx = Math.round(w * 0.62);
  const by = G.contact + G.course.far + 3;
  p.rect(bx, by, 8, 4, MAT.pave.broken);
  p.hline(bx, by, 8, mix(MAT.pave.broken, C.white, 0.1));
  p.vline(bx + 4, by, 4, MAT.pave.joint);
  p.px(bx + 5, by + 1, MAT.pave.joint);
  // moss where the water stands: along the joint by the kerb, in clusters and never in a line
  for (let i = 0; i < G.moss; i++) {
    const mx = Math.round(rng() * (w - 12)) + 4;
    p.hline(mx, off + G.pave - 2, 3 + Math.round(rng() * 4), MAT.moss);
    p.hline(mx + 1, off + G.pave - 1, 2 + Math.round(rng() * 3), mix(MAT.moss, C.ink, 0.3));
  }
  for (let i = 0; i < G.leaves; i++) {
    p.px(Math.round(rng() * (w - 2)) + 1, G.contact + 2 + Math.round(rng() * (G.pave - 4)), MAT.leaf);
  }
}

// The buildings' contact shadow, and the shadow that is not a band: the alley's mouth spilling ink
// onto the pavement, in three bands with a stair at its edge, wider as the light dies.
function paintContact(p, w, blocks) {
  const G = GROUND;
  p.hline(0, 0, w, rgba(C.ink, 0.55));
  p.hline(0, 1, w, rgba(C.ink, 0.34));
  p.hline(0, 2, w, rgba(C.ink, 0.16));
  for (const block of blocks) {
    p.rect(block.x - 1, 0, block.w + 2, 1, rgba(C.ink, 0.7));
    p.rect(block.x, 1, block.w, 1, rgba(C.ink, 0.45));
    if (block.kind === 'alley') {
      const s = G.spill;
      for (let i = 0; i < s.bands; i++) {
        const reach = Math.round((s.reach * (i + 1)) / s.bands);
        p.rect(block.x - reach, 1 + i, block.w + reach * 2, G.contact - 1 - i, rgba(C.ink, s.alpha - i * s.step));
      }
      for (let i = 0; i < 3; i++) {
        p.rect(block.x + block.w + i, 1, 1, G.contact - i, rgba(C.ink, 0.18 - i * 0.05));
      }
    }
  }
}

// ----------------------------------------------------------------- kerb

// The kerb, and the gutter with it: the grate sits where the water the street sheds actually runs.
// The reveal is a row of ink because a kerb without one is a painted line.
function paintKerb(p, w, y, doorX) {
  const G = GROUND;
  const k = MAT.kerb;
  p.hline(0, y, w, k.top);
  p.rect(0, y + 1, w, G.kerb - 1, k.face);
  p.hline(0, y + 1, w, mix(k.face, k.top, 0.35));
  p.hline(0, y + G.kerb, w, k.reveal);
  p.rect(0, y + G.kerb + 1, w, G.gutter, mix(MAT.road.base, C.water, 0.18));
  const gx = Math.round(doorX ?? w * 0.24);
  if (gx > 2 && gx < w - 10) {
    p.rect(gx, y + G.kerb + 1, 9, 2, MAT.grate.void);
    for (let i = 1; i < 8; i += 2) p.px(gx + i, y + G.kerb + 1, MAT.grate.bar);
    p.hline(gx, y + G.kerb + 1, 9, mix(MAT.grate.bar, C.stone, 0.3));
  }
}

// ------------------------------------------------------------------ road

// One wet streak: vertical, narrow, broken into runs by the wet, and it fades as it goes — the
// shape a lit window makes on asphalt at this hour, and the thing the reference is mostly made of.
function paintReflection(p, cx, y0, rows, wide, tone, alpha, seed = 0) {
  const rng = makeRng(GROUND.seed + seed * 37);
  // A light on wet asphalt in a band this shallow: a stub of it where it lands, and then the light
  // broken across the water into wide flat dashes that step down and out as the road comes nearer.
  // A vertical column — the obvious way to draw a reflection — reads as something hanging off the
  // kerb in 34 rows, which is what three attempts at it proved.
  for (let r = 0; r < 4; r++) {
    p.hline(cx - 1, y0 + r, 3, rgba(tone, alpha * (0.85 - r * 0.16)));
  }
  let y = 4;
  while (y < rows - 1) {
    const near = y / rows;
    const dashW = Math.max(3, Math.round(wide * (0.45 + near * 1.15)));
    const dx = cx - Math.round(dashW / 2) + Math.round((rng() - 0.5) * 6);
    p.hline(dx, y0 + y, dashW, rgba(tone, alpha * (0.52 - near * 0.3)));
    y += 3 + Math.floor(rng() * 3);
  }
}

// The road: one cold value, the sky in its first rows, the street's own lights lying down it, and
// the few accidents a street has. Every streak starts under the block that owns the light.
function paintRoad(p, w, y0, rows, sky, blocks) {
  const G = GROUND;
  const rng = makeRng(G.seed + 17);
  p.rect(0, y0, w, rows, MAT.road.base);
  // the sky, in bands rather than a gradient: the alley's rule, and what `?sky` changes
  const horizon = horizonOf(sky);
  for (let i = 0; i < 7; i++) {
    p.hline(0, y0 + i, w, rgba(horizon, 0.19 - i * 0.022));
  }
  // the wear: the whole width's worth, not a tile's, so the road cannot read as a pattern
  for (let i = 0; i < G.wear; i++) {
    const x = Math.round(rng() * (w - 2));
    const y = y0 + 6 + Math.round(rng() * (Math.min(rows, G.road) - 8));
    p.hline(x, y, 1 + Math.round(rng() * 2), rgba(MAT.road.wear, 0.07 + rng() * 0.08));
  }
  // the lights, block by block: the café is the warmest thing on the street, the offices have the
  // most panes, the gym is the only one whose light is its brand
  const S = G.streak;
  // the two rows under each lit block, warmer: what the wet road takes before any reflection is
  // drawn. Two rows only — a band of it reads as a brown stripe painted on the tarmac
  for (const block of blocks) {
    if (block.kind === 'alley' || block.kind === 'park') continue;
    const tone = block.kind === 'gym' ? MAT.light.brand : block.kind === 'cafe' ? MAT.light.window : MAT.light.pane;
    p.rect(block.x, y0 + 1, block.w, 1, rgba(tone, 0.13));
    p.rect(block.x, y0 + 2, block.w, 1, rgba(tone, 0.06));
  }
  for (const block of blocks) {
    if (block.kind === 'alley' || block.kind === 'park') continue;
    if (block.kind === 'cafe') {
      // the two windows and the door lamp over the entrance, which is the strongest single light
      paintReflection(p, block.x + 58, y0 + 2, S.rows, 12, MAT.light.window, S.alpha, 1);
      paintReflection(p, block.x + 132, y0 + 3, S.rows - 4, 11, MAT.light.window, S.alpha * 0.9, 2);
      paintReflection(p, block.x + 28, y0 + 1, S.rows + 6, 7, MAT.light.door, S.alpha * 1.15, 3);
      continue;
    }
    const count = block.kind === 'offices' ? 6 : 3;
    const tone = block.kind === 'gym' ? MAT.light.brand : MAT.light.pane;
    const alpha = block.kind === 'gym' ? S.alpha * 0.75 : S.alpha * 0.6;
    for (let i = 0; i < count; i++) {
      const cx = block.x + Math.round((block.w * (i + 0.5)) / count);
      paintReflection(p, cx, y0 + 2, S.rows - i, block.kind === 'offices' ? 8 : 10, tone, alpha, 10 + i);
    }
  }
  // the tar patch: a long repair, darker, with one lit edge so it reads as material and not a hole
  const px = Math.round(w * 0.62);
  p.rect(px, y0 + 15, 44, 6, MAT.road.patch);
  p.hline(px + 2, y0 + 15, 40, rgba(C.stone, 0.12));
  p.hline(px + 2, y0 + 20, 38, rgba(C.ink, 0.35));
  // the manhole: a dark plate with a lit rim and no pattern of its own
  const mx = Math.round(w * 0.4);
  p.rect(mx, y0 + 10, 11, 4, mix(C.metalDark, C.ink, 0.4));
  p.hline(mx, y0 + 10, 11, mix(C.metal, C.slate, 0.3));
  p.hline(mx + 1, y0 + 12, 9, rgba(C.stone, 0.1));
  // two cold specular dashes: the only hard highlights the road allows
  p.hline(Math.round(w * 0.13), y0 + 4, 20, rgba(C.glassLite, 0.14));
  p.hline(Math.round(w * 0.73), y0 + 5, 13, rgba(C.glassLite, 0.11));
}

// The near edge: five bands into ink and two dashes left in the dark. This is the band that takes
// whatever height the frame has left, so the measured bands above it never stretch.
function paintForeground(p, w, y0, rows) {
  const steps = [0.14, 0.24, 0.34, 0.46, 0.6];
  const bandRows = Math.max(1, Math.ceil(rows / steps.length));
  for (let i = 0; i < steps.length; i++) {
    const y = y0 + i * bandRows;
    if (y >= y0 + rows) break;
    p.rect(0, y, w, Math.min(bandRows, y0 + rows - y), rgba(C.ink, steps[i]));
  }
  p.hline(Math.round(w * 0.31), y0 + Math.max(1, Math.round(rows * 0.3)), 11, rgba(C.glassLite, 0.18));
  p.hline(Math.round(w * 0.82), y0 + Math.max(2, Math.round(rows * 0.55)), 7, rgba(C.glassLite, 0.14));
}

// ------------------------------------------------------------------ sprite

// The ground of the street, as a sprite: `h` is the rows from the building line to the bottom of the
// frame. The bands above the fade are fixed; the fade takes the rest, and on a frame too short for
// even them the road is simply clipped, which is the same finding the buildings report.
export function groundSprite({ w, h, sky = 'dusk', blocks = [], doorX = null }) {
  const width = Math.max(1, Math.round(w));
  const rows = Math.max(1, Math.round(h));
  const key = `ground|${width}|${rows}|${sky}|${doorX}|${blocks.map((b) => `${b.kind}:${b.x}:${b.w}`).join(',')}`;
  return cacheSprite(cache, key, () => {
    const p = new Painter(width, rows);
    const G = GROUND;
    const kerbY = G.contact + G.pave;
    const roadY = kerbY + G.kerb + G.gutter;
    const banded = roadY + G.road;
    paintPavement(p, width);
    paintContact(p, width, blocks);
    paintKerb(p, width, kerbY, doorX);
    const roadRows = Math.max(0, Math.min(G.road, rows - roadY));
    if (roadRows > 0) paintRoad(p, width, roadY, roadRows, sky, blocks);
    const fadeRows = Math.max(0, rows - banded);
    if (fadeRows > 0) paintForeground(p, width, banded, fadeRows);
    return p.sprite();
  });
}
