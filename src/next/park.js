// The park (S24, L34): the strip of grass the frame leaves to the right of the gym. The street
// composes café 192 + alley 88 + offices 302 + gym 240 = 822 art px at the frame it was measured
// at, and until now the gym's block absorbed every pixel past that, which on a wide view was bare
// pavement with nothing standing on it. This module is what stands there.
//
// The width rule is the whole design, so it is written once: parkW = viewW - 822. street.js stops
// letting the gym grow past its own 240 and hands the difference over, so the park is a strip of
// variable width and everything below is derived from that width — it grows by fitting more, never
// by stretching one arrangement.
//
// What the strip holds, in the order it survives:
//
//   hedge     14 tall, the full width minus a 3 px margin, along the back of the strip: it is the
//             park's boundary and the thing that stops the strip reading as empty pavement
//   fountain  36x35, centred, never cropped: a 2 px foot, a 36x9 stone basin (2 rows of rim, 3 of
//             water, 4 of front wall), a 4x10 pedestal, an 11x3 upper bowl and 11 rows of jet.
//             This is the one prop the strip cannot drop, which is what PARK.minW is made of
//   trees     26x46, 1 to 4: a 3 px trunk under 28 rows of canopy read off a width table, so a
//             crown is a crown and not a blob. The trees are the tallest thing here, so they set
//             the park's own height
//   bench     18x8, right of the fountain where the gap beside it allows: wood slats on iron legs,
//             its back to the strip's end so the seat looks at the water
//   lamp      7x34, an iron post with a warm head at the left end, once a tree fits behind it
//
// The number of trees comes from the two spans the fountain leaves — floor((span + gutter) /
// (tree + gutter)) on each side, capped at 4 — and the trees are spread evenly inside their span.
// The lamp's 13 px zone at the left end and the bench's 28 px zone right of the fountain are
// reserved whether or not those two are drawn, so a prop that appears never takes a slot away from
// a tree: the count is non-decreasing in w by construction, which tools/park-check.mjs checks.
//
// Ground is not painted here. The page lays the terrain catalogue's grass band over the pavement
// in the park's span (`groundBand(ctx, 'grass', ...)` in src/cafe.js), so the park stands on the
// same ground as the rest of the town and this sprite holds only what stands in it.
//
// The jet is the one moving thing: three frames on the page's fixed clock, handed over as one
// entry of the page's animation list (`parkAnimations`). Like the café's, its place is in the
// sprite's own coordinates and its `origin` is the park, so the page adds the block's offset and
// nothing here ever carries a page coordinate. `?anim=0` and a reduced-motion preference freeze it
// at frame 0.
//
// Deterministic: fixed seeds, no clock, no Math.random, no colour literal. Coordinates: a sprite
// pixel is an art pixel, y grows down, and the sprite's bottom row is the street's ground line.

import { Painter, cacheSprite, mkCanvas } from '../pixel.js';
import { C, mix, rgba } from './palette.js';
import { makeRng } from '../rng.js';

const cache = new Map();
const layouts = new Map();

export const PARK = {
  // the strip exists from the fountain's own width up: 36 of basin and a 2 px margin at each end.
  // Narrower than this the module draws nothing at all — the strip is the page's grass and no art
  minW: 40,
  pad: 2, // the strip's own margin: no prop touches the edge of the park
  hedge: { h: 14, margin: 3, tips: 3 },
  fountain: {
    w: 36,
    h: 35, // 2 foot + 9 basin + 10 pedestal + 3 bowl + 11 jet, on the ground line
    foot: 2,
    basin: 9, // of which the rim, the water and the front wall, in that order from the top
    rim: 2,
    water: 3,
    inset: 3, // the water's inset from the basin's own edge
    pedestal: { w: 4, h: 10 },
    bowl: { w: 11, h: 3 },
    // the jet: 5 wide and 11 tall, so its bottom row is the water in the upper bowl. Three frames
    // at 4 fps: the water has one height and two droplets, and what moves is where the droplets are
    jet: { w: 5, h: 11, frames: 3, fps: 4, rise: [4, 5, 4] },
  },
  // 46 tall with 18 of trunk: the hedge is 14, so four rows of trunk stand clear above it and the
  // tree reads as a tree standing in front of the hedge rather than as a crown on top of it
  tree: { w: 26, h: 46, trunk: 3, trunkH: 18, gutter: 4 },
  trees: { max: 6 },
  bench: { w: 18, h: 8, gap: 4, lead: 6 },
  // the park's bin, the one every park has: a dark green drum with a lid, standing by the bench
  bin: { w: 9, h: 13, gap: 4 },
  lamp: { w: 7, h: 34, clear: 6 },
  // The plot, and the reason the park now has depth. The pavement runs in front of it, unbroken; the
  // park is a piece of ground set BEHIND that line, so it is drawn above it: a kerb at the street, the
  // grass receding up the frame, and a low railing across its front. Further up is further away — the
  // convention the alley already uses — which is why the objects stand on the plot's back line.
  plot: { kerb: 2, grass: 8, rail: { h: 5, post: 2 } },
  seed: 5171,
};

// ---------------------------------------------------------------- materials

const MAT = {
  // the plant tones, in the same three steps the offices' plant uses: the park's greens are the
  // catalogue's greens, so a tree here and a plant in a room are the same plant
  leaf: { dark: C.grassDeep, base: C.grassDark, lite: C.grass, tip: C.grassLite },
  // bark leans into the greens instead of being furniture wood: a trunk in the benches' wood would
  // read as a post
  bark: {
    base: mix(C.woodDark, C.grassDeep, 0.34),
    lite: mix(C.wood, C.woodDark, 0.4),
    dark: mix(C.woodDark, C.ink, 0.42),
  },
  // the fountain is the street's stone, a step warmer than the offices' (it is wet, and it is the
  // only thing in the strip with a light on it). Mid grey, not pale: built out of `stoneLite` it came
  // out at 172 of 255 and read as a white kitchen unit standing in the grass, so the body is the
  // `stone` the rest of the street is drawn in and only the rim climbs above it
  stone: {
    base: mix(C.stone, C.sand, 0.34),
    lite: mix(mix(C.stone, C.sand, 0.34), C.stoneLite, 0.45),
    dark: mix(C.stone, C.ink, 0.42),
  },
  iron: { base: C.metalDark, lite: C.metal, dark: mix(C.metalDark, C.ink, 0.45) },
  wood: { base: mix(C.wood, C.woodLite, 0.2), lite: mix(C.woodLite, C.white, 0.12), dark: C.woodDark },
};

// The canopies, as tables of rows read off the crown's height — the device the offices' LEAF_ROWS
// uses, because a rounded silhouette made of hand-placed rows is a blob with an accident in it. Each
// row is `[lean, width]`: the lean shifts the row a pixel or so and the width is its share of the
// tree's 26. No crown is symmetric; they all grow toward the light on their left.
//
// Three of them, one per seed, because four crowns off one table read as wallpaper however well the
// table is drawn: a round one, a pear that carries its weight low, and an open one whose rows step in
// and out again — the tree a park actually has three of. They share the 28 rows the trunk leaves.
const CANOPY_ROUND = [
  [0.36, 0.12],
  [0.26, 0.34],
  [0.18, 0.58],
  [0.1, 0.78],
  [0.06, 0.92],
  [0.02, 1],
  [0.0, 1],
  [0.02, 0.98],
  [0.06, 0.9],
  [0.12, 0.76],
  [0.2, 0.6],
  [0.28, 0.44],
  [0.36, 0.28],
];
const CANOPY_PEAR = [
  [0.5, 0.1],
  [0.42, 0.2],
  [0.32, 0.36],
  [0.24, 0.54],
  [0.16, 0.72],
  [0.1, 0.86],
  [0.06, 0.94],
  [0.02, 1],
  [0.0, 1],
  [0.04, 0.96],
  [0.12, 0.84],
  [0.24, 0.66],
  [0.34, 0.46],
];
const CANOPY_OPEN = [
  [0.28, 0.3],
  [0.16, 0.52],
  [0.08, 0.78],
  [0.02, 0.94],
  [0.0, 1],
  [0.0, 0.86],
  [0.06, 1],
  [0.02, 0.92],
  [0.08, 1],
  [0.04, 0.82],
  [0.14, 0.7],
  [0.22, 0.52],
  [0.3, 0.34],
];
const CANOPIES = [CANOPY_ROUND, CANOPY_PEAR, CANOPY_OPEN];

// ------------------------------------------------------------------- layout

// Nothing stands in a strip narrower than the fountain, so the layout says so and the callers can
// blit a transparent row: `h: 0` means the park is not there, and `w` is still the width the
// block was given, so no caller has to special-case a zero.
function emptyLayout(w) {
  return { w, h: 0, ground: -1, empty: true, hedge: null, fountain: null, trees: [], bench: null, lamp: null, jet: null };
}

export function parkLayout(w) {
  const width = Math.max(0, Math.round(w));
  const hit = layouts.get(width);
  if (hit) return hit;
  const layout = buildLayout(width);
  layouts.set(width, layout);
  return layout;
}

function buildLayout(w) {
  if (w < PARK.minW) return emptyLayout(w);
  const { pad, fountain: F, tree: T, hedge: H } = PARK;
  const fx = Math.round((w - F.w) / 2); // the fountain is centred, and that is its only rule

  // The two spans the trees are spread in. The lamp's zone at the left end and the bench's zone
  // right of the fountain are reserved whether or not those two are drawn: if they were only
  // reserved when drawn, a lamp appearing at a wider frame would take a slot away from a tree and
  // the count would fall as the screen grew.
  const lampZone = PARK.lamp.w + PARK.lamp.clear; // 13
  const benchZone = PARK.bench.gap + PARK.bench.w + PARK.bench.lead; // 28
  const leftSpan = { x0: pad + lampZone, x1: fx - T.gutter };
  const rightSpan = { x0: fx + F.w + T.gutter + benchZone, x1: w - pad };
  const capacity = (span) => {
    const width = span.x1 - span.x0;
    return width < T.w ? 0 : Math.floor((width + T.gutter) / (T.w + T.gutter));
  };
  const capL = capacity(leftSpan);
  const capR = capacity(rightSpan);
  const count = Math.min(PARK.trees.max, capL + capR);
  // the cap is shared out in proportion to the room on each side, and the remainder always lands
  // somewhere: a count the spans cannot hold would be a bug, not a rounding
  let leftCount = Math.min(capL, Math.round((count * capL) / Math.max(1, capL + capR)));
  const rightCount = Math.min(capR, count - leftCount);
  leftCount = Math.min(capL, count - rightCount);

  // the plot takes the bottom rows, and the objects stand on its back line: the trees are the tallest
  // thing in the park, so they set the height of the rest of it
  const P = PARK.plot;
  const plot = P.kerb + P.grass;
  const h = (count > 0 ? T.h : F.h) + plot;
  const gy = h - 1 - plot;

  const trees = [];
  const spread = (span, n, side) => {
    if (n <= 0) return;
    const room = span.x1 - span.x0 - T.w;
    for (let i = 0; i < n; i++) {
      // one tree sits in the middle of its span; two or more share it evenly, ends included
      const x = span.x0 + (n === 1 ? Math.round(room / 2) : Math.round((i * room) / (n - 1)));
      trees.push({ x, y: gy - T.h + 1, w: T.w, h: T.h, side, seed: PARK.seed + x * 17 + side * 131 });
    }
  };
  spread(leftSpan, leftCount, 0);
  spread(rightSpan, rightCount, 1);

  const fountain = { x: fx, y: gy - F.h + 1, w: F.w, h: F.h };
  const hedge = { x: H.margin, y: gy - H.h + 1, w: w - H.margin * 2, h: H.h };
  const benchX = fx + F.w + PARK.bench.gap;
  // the bench is drawn only when it fits inside the strip with the margin left over; the zone it
  // stands in is reserved either way, so its appearance costs no tree
  const bench =
    benchX + PARK.bench.w <= w - pad
      ? { x: benchX, y: gy - PARK.bench.h + 1, w: PARK.bench.w, h: PARK.bench.h, side: 'right' }
      : null;
  // the lamp stands at the left end only once a tree fits behind its zone: the zone is what keeps
  // it clear of the trees, so room for a tree on that side is the proof that the clearance exists
  const lamp = capL > 0 ? { x: pad, y: gy - PARK.lamp.h + 1, w: PARK.lamp.w, h: PARK.lamp.h } : null;
  // the jet stands in the fountain's top rows: its bottom row is the water in the upper bowl, one
  // row above that bowl's rim
  const jet = { x: fx + Math.round((F.w - F.jet.w) / 2), y: fountain.y, w: F.jet.w, h: F.jet.h };

  // everything here has its base on the ground line, the hedge included, so there is no base to
  // the bin goes where a park puts one: by the bench, if it fits inside the strip with its margin
  // the bin goes with the bench and nowhere else: a park has one by the seat, and a 40 px strip is not a
  // park with a bin in it, it is a bin with a fountain
  const binX = bench ? bench.x + bench.w + PARK.bin.gap : 0;
  const bin =
    bench && binX + PARK.bin.w <= w - pad
      ? { x: binX, y: gy - PARK.bin.h + 1, w: PARK.bin.w, h: PARK.bin.h }
      : null;
  return {
    w,
    h,
    ground: gy,
    plot: { top: gy + 1, kerb: P.kerb, grass: P.grass, rail: P.rail },
    empty: false,
    hedge,
    fountain,
    trees,
    bench,
    bin,
    lamp,
    jet,
  };
}

// --------------------------------------------------------------- the hedge

// The hedge along the back of the strip. Its mass is one step darker than a tree's canopy on
// purpose: it is the park's boundary and has to read as a wall behind the trees, not as a second
// row of trees. The silhouette varies by a row, seeded, in runs and not per pixel.
function paintHedge(p, hd, seed) {
  const { x, y, w, h } = hd;
  const leaf = MAT.leaf;
  const rng = makeRng(seed);
  const gy = y + h - 1;
  const body = mix(leaf.dark, leaf.base, 0.4);
  const deep = mix(body, leaf.dark, 0.45);
  const tops = [];
  for (let i = 0; i < w; i++) tops.push(i > 0 && i < w - 1 && rng() < 0.16 ? 1 : 0);
  // the mass, in seeded runs of two tones rather than one flat green: a clipped hedge has clumps,
  // and a run of three to six columns is the smallest thing that reads as a clump at 2x. Nothing
  // here is per pixel, which at this scale would read as noise
  const tones = [];
  for (let i = 0; i < w; ) {
    const len = 3 + Math.floor(rng() * 4);
    const tone = rng() < 0.5 ? body : deep;
    for (let k = 0; k < len && i < w; k++, i++) tones.push(tone);
  }
  for (let i = 0; i < w; i++) {
    const top = y + tops[i];
    p.vline(x + i, top, gy - top + 1, tones[i]);
  }
  // the light lands on the top: a row of leaf, then runs of a second row, so the crown is lit in
  // patches the way a clipped hedge is
  for (let i = 0; i < w; i++) p.px(x + i, y + tops[i], leaf.base);
  for (let i = 1; i < w - 1; ) {
    const len = 2 + Math.floor(rng() * 5);
    p.hline(x + i, y + 1, Math.min(len, w - 1 - i), rng() < 0.6 ? leaf.lite : leaf.base);
    i += len + 1 + Math.floor(rng() * 3);
  }
  // a few leaf tips out of the crown, so the top is a hedge and not a kerb
  for (let k = 0; k < PARK.hedge.tips; k++) {
    const i = Math.min(w - 1, 2 + Math.floor(rng() * Math.max(1, w - 4)));
    p.px(x + i, y + tops[i] - 1, leaf.tip);
  }
  // its ends turn away from the light, and its foot sits in its own shade on the grass
  p.vline(x, y, h, leaf.dark);
  p.vline(x + w - 1, y, h, leaf.dark);
  p.hline(x, gy, w, rgba(C.ink, 0.26));
}

// ------------------------------------------------------------------- the plot

// The ground the park stands on, and the reason it now has depth: a granite kerb at the street, the grass
// receding up the frame in bands (further is higher, the alley's convention), and a low iron railing across
// the front. The pavement runs in front of it and is never cut by it.
//
// The grass is painted and not tiled: two bands of green a step apart, tufts in seeded clusters, a worn
// path where people walk to the fountain, and not one pixel of per-pixel noise — the terrain catalogue's
// lawn is drawn for the top-down town and at this scale its texture reads as carpet.
function paintPlot(p, L, seed) {
  const { kerb, grass, rail, top } = L.plot;
  const w = L.w;
  const grassTop = top + grass - 1;
  const rng = makeRng(seed + 991);
  const lawn = { far: mix(C.grassDark, C.ink, 0.34), near: mix(C.grassDark, C.ink, 0.2) };
  // the two bands: the back row darker (the hedge's shadow), the front one where the light lands
  p.rect(0, top, w, grass, lawn.far);
  p.rect(0, top + Math.round(grass / 2), w, grass - Math.round(grass / 2), lawn.near);
  // the tufts: three or four pixels each, in clusters and never in a row
  for (let i = 0; i < Math.max(6, Math.round(w / 9)); i++) {
    const tx = 1 + Math.round(rng() * (w - 4));
    const ty = top + 1 + Math.round(rng() * (grass - 2));
    p.hline(tx, ty, 1 + Math.round(rng() * 2), mix(C.grass, C.ink, 0.25));
    p.px(tx, ty - 1, mix(C.grassLite, C.ink, 0.35));
  }
  // the worn path to the fountain: two rows of a paler earth, from the railing back to the basin
  const fx = L.fountain ? L.fountain.x + Math.round(L.fountain.w / 2) : Math.round(w / 2);
  for (let i = 0; i < 3; i++) {
    p.hline(fx - 3 + i, grassTop - i, 6 - i * 2, rgba(C.sand, 0.16));
  }
  // the kerb, at the street: a lit top row and a face in shadow, like the street's own
  p.rect(0, top + grass, w, kerb, mix(C.stone, C.slate, 0.5));
  p.hline(0, top + grass, w, mix(C.stoneLite, C.lampWarm, 0.12));
  p.hline(0, top + grass + kerb - 1, w, rgba(C.ink, 0.5));
  // the railing across the front: posts every nine px and one rail, in iron
  const iron = mix(C.metalDark, C.ink, 0.35);
  const railY = top + grass - rail.h;
  p.hline(0, railY, w, iron);
  p.hline(0, railY + 1, w, mix(iron, C.metal, 0.3));
  for (let x = 1; x < w - 1; x += 9) {
    p.vline(x, railY, rail.h + 1, iron);
    p.px(x, railY, mix(iron, C.metal, 0.45));
  }
}

// ------------------------------------------------------------------- the bin

// The park's bin, standing by the bench: a dark green drum, three slats of shadow, a lid with a lip, and
// the shadow it throws on the grass. It is the object that says "somebody looks after this place".
function paintBin(p, b) {
  const { x, w } = b;
  const base = b.y + b.h - 1;
  const gy = base;
  const top = gy - b.h;
  const drum = mix(C.roofGreen, C.ink, 0.42);
  const lid = mix(C.roofGreenLite, C.ink, 0.3);
  const iron = mix(C.metalDark, C.ink, 0.4);
  p.hline(x, gy, w, rgba(C.ink, 0.3));
  // the body: a tapered drum, its left arris lit
  p.rect(x + 1, top + 3, w - 2, b.h - 3, drum);
  p.vline(x + 1, top + 3, b.h - 3, mix(drum, C.white, 0.12));
  p.vline(x + w - 2, top + 3, b.h - 3, mix(drum, C.ink, 0.35));
  for (let i = 0; i < 3; i++) p.vline(x + 3 + i * 2, top + 5, b.h - 7, rgba(C.ink, 0.22));
  // the lid, a band a pixel proud on each side with a lip, and the opening under it
  p.rect(x, top, w, 3, lid);
  p.hline(x, top, w, mix(lid, C.white, 0.18));
  p.hline(x + 1, top + 2, w - 2, rgba(C.ink, 0.45));
  p.hline(x, top + 3, w, iron);
  // the foot
  p.hline(x + 1, gy - 1, w - 2, iron);
}

// ------------------------------------------------------------------ trees

// A tree: a 3 px trunk, its roots, the shadow at its foot and a crown built from CANOPY_ROWS. The
// canopy is the same table every time; what varies per tree is the seed, which picks how light the
// lit half is and where the leaf tips fall — a second outline would be the blob this is avoiding.
function paintTree(p, t) {
  const T = PARK.tree;
  const { x, w, seed } = t;
  const leaf = MAT.leaf;
  const bark = MAT.bark;
  const gy = t.y + t.h - 1;
  const rng = makeRng(seed);
  const cx = x + Math.round(w / 2);
  const trunkX = cx - Math.round(T.trunk / 2);
  const trunkTop = gy - T.trunkH + 1;
  const trunkH = gy - trunkTop + 1;

  // the shadow on the grass, before the trunk so the trunk stands in it
  p.hline(cx - 6, gy, 12, rgba(C.ink, 0.18));
  p.hline(cx - 3, gy - 1, 7, rgba(C.ink, 0.26));
  // the trunk: three pixels, lit on the left, dark on the right, and one root each side
  p.rect(trunkX, trunkTop, T.trunk, trunkH, bark.base);
  p.vline(trunkX, trunkTop, trunkH, bark.lite);
  p.vline(trunkX + T.trunk - 1, trunkTop, trunkH, bark.dark);
  p.px(trunkX - 1, gy, bark.dark);
  p.px(trunkX + T.trunk, gy, bark.dark);

  // one crown per seed: the table it grows from and how many rows it keeps of it. Four trees off one
  // shape and one height read as wallpaper however well that shape is drawn, so the seed picks both
  // — a crown that starts two or three rows lower is a shorter tree, and a shorter tree is a park
  // with trees in it rather than four copies of the same shrub
  const pick = Math.abs(seed);
  const table = CANOPIES[pick % CANOPIES.length];
  const drop = [0, 2, 0, 3][pick % 4]; // rows the crown leaves empty at the top of the tree's box
  const canopyH = T.h - T.trunkH - drop; // 28, or 26/25 for a shorter tree
  const rows = table.length;
  const lit = mix(leaf.base, leaf.lite, 0.35 + rng() * 0.4);
  for (let i = 0; i < canopyH; i++) {
    const [inset, share] = table[Math.min(rows - 1, Math.floor((i / canopyH) * rows))];
    const rw = Math.max(1, Math.round(w * share));
    const rx = x + Math.round((w - rw) / 2) + Math.round(inset * 5);
    const y = t.y + drop + i;
    p.hline(rx, y, rw, leaf.base);
    // the light falls from the upper left: the lit patch is the crown's left quarter, and below
    // the middle the same row keeps its depth on the right. Two bands per row and never a full
    // row of one tone, which is what would make a lollipop of a 26 px crown
    if (i < canopyH * 0.56) {
      const litW = Math.max(1, Math.round(rw * 0.46));
      p.hline(rx + 1, y, Math.min(litW, rw - 1), lit);
    } else {
      const darkW = Math.max(1, Math.round(rw * 0.44));
      p.hline(rx + Math.max(0, rw - darkW - Math.round(rng())), y, darkW, leaf.dark);
    }
    // a leaf tip out of the silhouette, seeded, most rows not
    if (i > 4 && i < canopyH - 6 && rng() < 0.07) p.px(rng() < 0.5 ? rx - 1 : rx + rw, y, leaf.tip);
  }
  // the crown's tip is the one lit pixel, and it is what makes the height readable against the sky
  p.px(cx, t.y + drop, leaf.tip);
}

// --------------------------------------------------------------- fountain

// The fountain, on the ground line: foot, basin, pedestal, upper bowl. The water is three rows —
// the far edge, a ripple row and the near edge — plus one warm group of two pixels for the light
// coming off it. That is the whole of the detail: three rows of water is 30 px wide and a gradient
// across 30 px reads as a smudge, not as water.
function paintFountain(p, f) {
  const F = PARK.fountain;
  const m = MAT.stone;
  const { w } = f;
  const gy = f.y + f.h - 1;
  const cx = f.x + Math.round(w / 2);
  const footTop = gy - F.foot + 1;
  const basinTop = footTop - F.basin;
  const waterTop = basinTop + F.rim;
  const wallTop = waterTop + F.water;
  const pedestalTop = basinTop - F.pedestal.h;
  const bowlTop = pedestalTop - F.bowl.h;

  // the contact shadow, one row, a pixel past the foot on each side
  p.hline(f.x + 1, gy, w - 2, rgba(C.ink, 0.22));
  // the foot: two rows, so the basin is standing on something
  p.rect(f.x + 2, footTop, w - 4, F.foot, m.dark);
  p.hline(f.x + 2, footTop, w - 4, m.base);

  // the basin: the rim is the widest row and the one the light lands on. Its two ends step in by a
  // column for the first two rows, so 36 px of stone read as a bowl seen from the front and not as a
  // trough: a rectangle of that width is a bench, which is the one thing beside it
  const bodyH = F.basin; // 9: the rim, the water and the front wall, and no row more
  p.rect(f.x, basinTop, w, bodyH, m.base);
  p.hline(f.x, basinTop, w, m.lite);
  p.hline(f.x, basinTop + 1, w, mix(m.base, m.lite, 0.45));
  p.px(f.x, basinTop + 1, m.dark);
  p.px(f.x + w - 1, basinTop + 1, m.dark);
  // the water, inside the rim
  const wx = f.x + F.inset;
  const ww = w - F.inset * 2;
  // the water: a deep body, the sky's light on its far edge, three ripples that read as rings, and one
  // warm path of light down the middle. Brighter than the stone around it, which is what makes a basin
  // look like it is holding water and not paint
  p.rect(wx, waterTop, ww, F.water, C.water);
  p.hline(wx, waterTop, ww, mix(C.waterDeep, C.glassLite, 0.3));
  for (let i = 0; i < 3; i++) {
    const rx = wx + 3 + i * 8;
    p.hline(rx, waterTop + 1, 4 - i, mix(C.waterLite, C.white, 0.15));
  }
  p.hline(wx + 4, waterTop + 1, 2, mix(C.lamp, C.waterLite, 0.4));
  p.hline(wx, waterTop + F.water - 1, ww, mix(C.water, C.ink, 0.28));
  // the front wall the water is held in, lit at its head and dark at its foot
  p.hline(f.x, wallTop, w, m.lite);
  p.hline(f.x + 1, gy - 2, w - 2, m.dark);
  // the basin's two ends turn away
  p.vline(f.x, basinTop, bodyH, m.dark);
  p.vline(f.x + w - 1, basinTop, bodyH, m.dark);

  // the pedestal: four pixels, its left arris lit, and one shadow where it leaves the basin
  const ped = F.pedestal;
  p.rect(cx - Math.round(ped.w / 2), pedestalTop, ped.w, ped.h, m.base);
  p.vline(cx - Math.round(ped.w / 2), pedestalTop, ped.h, m.lite);
  p.vline(cx - Math.round(ped.w / 2) + ped.w - 1, pedestalTop, ped.h, m.dark);
  p.hline(cx - Math.round(ped.w / 2) - 1, pedestalTop + ped.h - 1, ped.w + 2, rgba(C.ink, 0.22));

  // the upper bowl: its rim, the water in it, and its underside one pixel proud of it
  const bw = F.bowl;
  const bx = cx - Math.round(bw.w / 2);
  p.rect(bx, bowlTop, bw.w, bw.h, m.base);
  p.hline(bx, bowlTop, bw.w, m.lite);
  p.hline(bx + 1, bowlTop + 1, bw.w - 2, C.water);
  p.hline(bx + 2, bowlTop + 1, 2, C.waterLite);
  // the splash ring the jet lands in: two pixels either side of its foot and a lit row between them
  p.px(bx + 3, bowlTop + 1, mix(C.waterLite, C.white, 0.3));
  p.px(bx + 7, bowlTop + 1, mix(C.waterLite, C.white, 0.2));
  p.hline(bx - 1, bowlTop + bw.h - 1, bw.w + 2, m.dark);
}

// ----------------------------------------------------------------- bench

// The bench, right of the fountain: two rows of back rail on the far side, the seat's slats, and
// iron legs. Its back is on the strip's end so the seat looks at the water; on a frontal grid that
// is all the facing there is room for, and the position does the rest.
function paintBench(p, b) {
  const { x, w, h } = b;
  const wood = MAT.wood;
  const iron = MAT.iron;
  const gy = b.y + h - 1;
  const y = b.y;

  // the shadow on the grass
  p.hline(x + 1, gy, w - 2, rgba(C.ink, 0.2));
  // the back: a rail over two posts, the lit edge of the near slat on the left where the light is
  p.rect(x, y, w, 2, wood.base);
  p.hline(x, y, w, wood.lite);
  p.hline(x, y + 1, w, wood.dark);
  p.px(x + 1, y + 2, wood.dark);
  p.px(x + w - 2, y + 2, wood.dark);
  // the seat: two slats with a dark seam between them
  p.rect(x - 1, y + 3, w + 2, 2, wood.base);
  p.hline(x - 1, y + 3, w + 2, wood.lite);
  p.hline(x - 1, y + 5, w + 2, wood.dark);
  // the legs: iron, at the ends, standing on the ground line
  p.rect(x + 2, y + 6, 2, h - 6, iron.base);
  p.rect(x + w - 4, y + 6, 2, h - 6, iron.base);
  p.px(x + 2, gy, iron.dark);
  p.px(x + w - 3, gy, iron.dark);
}

// ------------------------------------------------------------------ lamp

// The lamp: an iron post at the strip's left end with a warm head. It is the only practical light
// in the park, so it gets the palette's lamp tone and a single halo pixel each side — the same
// language as the street's other lamps, at the scale of a park.
function paintLamp(p, l) {
  const { x, w, h } = l;
  const iron = MAT.iron;
  const gy = l.y + h - 1;
  const y = l.y;
  const headW = 5;
  const hx = x + Math.round((w - headW) / 2);
  const headH = 5;

  // the base, and its shadow
  p.hline(x + 1, gy, w - 2, rgba(C.ink, 0.2));
  p.rect(x + 2, gy - 1, w - 4, 2, iron.base);
  p.hline(x + 2, gy - 1, w - 4, iron.lite);
  // the post: two pixels, lit on the left
  p.rect(x + 3, y + headH, 2, gy - 1 - (y + headH), iron.base);
  p.vline(x + 3, y + headH, gy - 1 - (y + headH), iron.lite);
  // the head: a cap, three rows of warm glass, and the frame under it
  p.rect(hx, y, headW, headH, iron.base);
  p.hline(hx, y, headW, iron.dark);
  p.rect(hx + 1, y + 1, headW - 2, headH - 2, C.lamp);
  p.vline(hx + 1, y + 1, headH - 2, C.lampWarm);
  p.px(hx + headW - 2, y + 1, mix(C.lamp, C.white, 0.3));
  p.hline(hx, y + headH - 1, headW, iron.dark);
  // the halo, one pixel each side: at this size that is a lamp that is lit and not a bloom
  p.px(hx - 1, y + 2, rgba(C.lamp, 0.35));
  p.px(hx + headW, y + 2, rgba(C.lamp, 0.35));
}

// ------------------------------------------------------------------ jet

// The droplets, one row per frame: [columns from the jet's centre, rows above the top of the
// column]. The column's height is PARK.fountain.jet.rise because that is the water's height; these
// are the pixels the frame moves, which is the whole animation.
const DROPS = [
  [
    [-1, 2],
    [1, 4],
  ],
  [
    [-2, 3],
    [0, 5],
    [2, 2],
  ],
  [
    [1, 1],
    [-1, 5],
  ],
];

// The jet, one frame at a time: a single column of water out of the upper bowl and two or three
// droplets, which change place. The column's colour is the water's own lit tone, because a jet of
// one pixel has no room for a ramp, and the droplets are the frame.
function jetSprite(frame) {
  const J = PARK.fountain.jet;
  return cacheSprite(cache, `parkjet:${frame}`, () => {
    const p = new Painter(J.w, J.h);
    const cx = Math.round((J.w - 1) / 2);
    const gy = J.h - 1;
    const rise = J.rise[frame % J.rise.length];
    // the plume: three pixels where it leaves the bowl, two in the middle, one at the head, so the
    // water has a width where it is pushed up and a thread at the top. A single column of one pixel
    // above a five px droplet cloud read as a dotted line floating over the fountain, not as a jet
    for (let up = 0; up <= rise; up++) {
      const width = up <= 1 ? 3 : up <= rise - 3 ? 2 : 1;
      const x0 = cx - Math.floor((width - 1) / 2);
      p.hline(x0, gy - up, width, up === 0 ? mix(C.waterLite, C.water, 0.45) : C.waterLite);
    }
    for (const [dx, up] of DROPS[frame % DROPS.length]) p.px(cx + dx, gy - rise - up, C.waterLite);
    return p.sprite();
  });
}

// ----------------------------------------------------------------- sprite

// The strip, painted once per width: the hedge behind everything, then the trees, the fountain,
// the bench and the lamp. Nothing here moves, so the page blits one canvas and animates the jet.
export function parkSprite(w) {
  const width = Math.max(0, Math.round(w));
  return cacheSprite(cache, `park:${width}`, () => {
    const L = parkLayout(width);
    // a strip with no art is a transparent row of the width asked for, so a blit is harmless and
    // the caller never has to ask whether the park exists before drawing it
    if (L.empty) return { canvas: mkCanvas(Math.max(1, width), 1), w: width, h: 0 };
    const p = new Painter(L.w, L.h);
    // back to front: the plot's ground first (it is what everything stands on), then the hedge behind
    // the trees, the trees, and the furniture in front of them. The railing is inside paintPlot, under
    // the objects, which is what makes them read as standing further back
    paintPlot(p, L, PARK.seed);
    if (L.hedge) paintHedge(p, L.hedge, PARK.seed);
    for (const t of L.trees) paintTree(p, t);
    if (L.fountain) paintFountain(p, L.fountain);
    if (L.bench) paintBench(p, L.bench);
    if (L.bin) paintBin(p, L.bin);
    if (L.lamp) paintLamp(p, L.lamp);
    return p.sprite();
  });
}

// ------------------------------------------------------------- animations

// The rule every moving thing on this page follows, verbatim from the café's: frame 0 when frozen,
// otherwise floor(t * fps) % frames. One clock, one division, no phase of its own.
function cycleFrame(timeSec, { frames, fps }, frozen = false) {
  if (frozen) return 0;
  const t = Number(timeSec);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.floor(t * fps) % frames;
}

// The park's one moving element, in the shape src/cafe.js's list takes: `origin` names the block
// the coordinates belong to, so `place` hands back a position inside the park's own sprite and the
// page adds the offset — no animation on this page holds a page coordinate, which is what lets the
// strip be placed anywhere without the elements knowing where they are.
export function parkAnimations(w) {
  const L = parkLayout(w);
  if (!L.jet) return [];
  const spec = PARK.fountain.jet;
  return [
    {
      key: 'parkjet',
      origin: 'park',
      frames: spec.frames,
      fps: spec.fps,
      place: (timeSec, frozen = false) => ({
        sprite: jetSprite(cycleFrame(timeSec, spec, frozen)),
        x: L.jet.x,
        y: L.jet.y,
      }),
    },
  ];
}
