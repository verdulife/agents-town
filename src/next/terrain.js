// Terrain catalogue v2: the floor as data, never as a drawing. A material is a
// spec (base colour, detail colours, pattern name, variant count); the pixels are
// generated from that spec plus a hash of the cell, so the same seed and cell
// always give the same tile and a field never shows a rim or a seam.
//
// Transitions (T2), water (T3) and decals (T4) build on this: they read TERRAIN
// and reuse terrainTile / terrainAt / terrainPatch instead of painting their own
// ground, and the card bake (T5) paints the floor from terrainPatch.

import { Painter, cacheSprite } from '../pixel.js';
import { C, mix } from '../palette.js';
import { makeRng } from '../rng.js';
import { TILE } from './art-spec.js';

const cache = new Map();
const W = TILE;

// ---------------------------------------------------------------- determinism

// Integer hash. There is no non-deterministic input here: a cell is a pure
// function of its coordinates and of the material's salt. It is exported because the
// bake (T5) dresses a bank with the same hash the catalogue picks a variant with.
export function hash32(x, y, salt = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function saltOf(name) {
  let s = 0;
  for (let i = 0; i < name.length; i++) s = (Math.imul(s, 31) + name.charCodeAt(i)) | 0;
  return s >>> 0;
}

// A tile is painted from its material, its variant and nothing else, so a review
// capture and a runtime bake produce identical pixels.
const variantSeed = (spec, variant) => Math.imul(spec.salt, 2654435761) + variant * 7919 + 13;

// ------------------------------------------------------------------ painting

function fill(p, color) {
  p.rect(0, 0, W, W, color);
}

// Wrapped single pixel: a stone or a blade may straddle the tile seam, and it has
// to continue on the other side or the seam reads as a cut edge.
function wrapPx(p, x, y, color) {
  p.px(((x % W) + W) % W, ((y % W) + W) % W, color);
}

function wrapRect(p, x, y, w, h, color) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) wrapPx(p, x + i, y + j, color);
}

function crack(p, rng, x, y, len, color) {
  for (let i = 0; i < len; i++) {
    wrapPx(p, x, y + i, color);
    if (rng.chance(0.35)) x += rng.chance(0.5) ? 1 : -1;
  }
}

// Meadow-like ground: a base with short blades, flecks and a few soft clumps. The
// marks are scattered per variant, so two cells of the same material differ in
// where the grass sits, never in overall tone: a tone shift per variant would
// turn the field into a visible mosaic of tiles.
function paintSpeckle(p, rng, spec) {
  fill(p, spec.base);
  const [dark, lite] = spec.detail;
  const marks = spec.marks ?? 20;
  for (let i = 0; i < marks; i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, W - 1);
    const r = rng.next();
    if (r < 0.5) {
      // a shade tuft, two or three pixels tall so it reads as a blade at 1x
      wrapPx(p, x, y, dark);
      wrapPx(p, x, y + 1, dark);
      if (rng.chance(spec.tall ?? 0.2)) wrapPx(p, x, y + 2, dark);
    } else if (r < 0.9) {
      wrapPx(p, x, y, lite);
      if (rng.chance(0.3)) wrapPx(p, x, y + 1, lite);
    } else {
      wrapPx(p, x, y, spec.accent);
    }
  }
  // soft clumps of shade, so the field is not flat noise
  for (let i = 0; i < (spec.clumps ?? 3); i++) {
    wrapRect(p, rng.int(0, W - 1), rng.int(0, W - 1), 2, 2, spec.clump ?? dark);
  }
  // low bushes: a squat cluster with a lit tip, which is what makes scrub read as
  // scrub instead of as darker grass
  for (let i = 0; i < (spec.bushes ?? 0); i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, W - 1);
    wrapRect(p, x, y, 3, 2, spec.bush);
    wrapPx(p, x + rng.int(0, 2), y - 1, spec.accent);
    wrapPx(p, x + rng.int(0, 2), y + 2, spec.detail[0]);
  }
}

// Beaten earth with wheel ruts. A rut is a band of broken grit that wanders a pixel
// either way, not a solid line: a straight unbroken line across every tile of a
// field reads as planking, and a wandering one reads as wear.
function paintRuts(p, rng, spec) {
  fill(p, spec.base);
  for (let i = 0; i < (spec.marks ?? 30); i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, W - 1);
    const r = rng.next();
    if (r < 0.45) wrapPx(p, x, y, spec.detail[0]);
    else if (r < 0.85) wrapPx(p, x, y, spec.detail[1]);
    else wrapRect(p, x, y, 1, 2, spec.detail[2]);
  }
  // the groove wanders one pixel either way as it crosses the tile: a ruler-straight
  // line every eight pixels reads as corduroy, a wandering one reads as a wheel rut
  for (const y0 of spec.ruts) {
    let y = y0;
    for (let x = 0; x < W; x++) {
      if (rng.chance(0.22)) y += rng.chance(0.5) ? 1 : -1;
      y = Math.min(y0 + 1, Math.max(y0 - 1, y));
      if (rng.chance(0.6)) p.px(x, y, spec.rut);
      if (rng.chance(0.18)) p.px(x, y + 1, spec.rutLite);
    }
  }
  for (let i = 0; i < (spec.pebbles ?? 4); i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, W - 1);
    wrapPx(p, x, y, spec.accent);
  }
}

// Loose stones over a dusty bed: each stone is a lit top, a shaded bottom and one
// specular pixel, wrapped so a stone can cross the seam whole.
function paintStones(p, rng, spec) {
  fill(p, spec.base);
  for (let i = 0; i < (spec.marks ?? 10); i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, W - 1);
    const w = rng.chance(0.45) ? 3 : 2;
    const h = rng.chance(0.3) ? 3 : 2;
    wrapRect(p, x, y, w, h, spec.detail[1]);
    wrapRect(p, x, y, w - 1, h - 1, spec.detail[0]);
    wrapPx(p, x, y, spec.accent);
  }
  // dust and grit between the stones
  for (let i = 0; i < (spec.speck ?? 18); i++) {
    wrapPx(p, rng.int(0, W - 1), rng.int(0, W - 1), rng.chance(0.5) ? spec.detail[2] : spec.detail[0]);
  }
}

// Stone and clay: soft tonal blotches from a wrapped voronoi field, plus a couple of
// cracks on top. The field is wrapped, so a blotch crossing the seam continues on
// the other side instead of being cut by it.
function paintBlotch(p, rng, spec) {
  const seeds = [];
  for (let i = 0; i < (spec.seeds ?? 4); i++) {
    seeds.push({ x: rng.next() * W, y: rng.next() * W, tone: spec.tones[i % spec.tones.length] });
  }
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let best = Infinity;
      let tone = spec.base;
      for (const s of seeds) {
        let dx = Math.abs(x + 0.5 - s.x);
        let dy = Math.abs(y + 0.5 - s.y);
        if (dx > W / 2) dx = W - dx;
        if (dy > W / 2) dy = W - dy;
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          tone = s.tone;
        }
      }
      p.px(x, y, tone);
    }
  }
  for (let i = 0; i < (spec.speck ?? 10); i++) {
    wrapPx(p, rng.int(0, W - 1), rng.int(0, W - 1), rng.chance(0.5) ? spec.detail[0] : spec.detail[1]);
  }
  for (let i = 0; i < (spec.cracks ?? 2); i++) {
    crack(p, rng, rng.int(0, W - 1), rng.int(0, W - 1), rng.int(4, 7), spec.accent);
  }
}

// Asphalt: aggregate over a dark bed. Wear is a difference in how much grit shows
// and in the damage (a smear, a crack, a repair), never in the tone of the whole
// tile: a tile whose tone jumps out would be spelled out again in every block.
function paintWear(p, rng, spec, variant) {
  fill(p, spec.base);
  const grit = spec.detail[0];
  const dark = spec.detail[1];
  const count = (spec.marks ?? 14) + variant * (spec.perVariant ?? 6);
  for (let i = 0; i < count; i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, W - 1);
    const r = rng.next();
    // clustered aggregate: two-pixel bodies with a few singles read as gravel in
    // tarmac, where alternating single pixels read as noise
    if (r < 0.5) wrapRect(p, x, y, 2, 1, grit);
    else if (r < 0.86) wrapPx(p, x, y, grit);
    else if (r < 0.97) wrapPx(p, x, y, dark);
    else wrapRect(p, x, y, 2, 1, dark);
  }
  if (variant === 1) {
    // worn: the aggregate shows through in a soft patch, no hard edge anywhere
    const x = rng.int(0, W - 5);
    const y = rng.int(0, W - 4);
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 5; i++) if (rng.chance(0.22)) wrapPx(p, x + i, y + j, grit);
    }
  } else if (variant === 2) {
    // heavy wear: a longer crack and a chipped corner
    crack(p, rng, rng.int(2, 12), rng.int(0, W - 1), 9, spec.accent);
    wrapRect(p, rng.int(0, W - 3), rng.int(0, W - 2), 2, 2, dark);
  } else if (variant === 3) {
    // a repair: a small irregular smear of fresh asphalt with a lip on one side
    const x = rng.int(2, 9);
    const y = rng.int(2, 9);
    wrapRect(p, x, y, 4, 3, spec.accent);
    if (rng.chance(0.5)) wrapPx(p, x - 1, y + 1, spec.accent);
    p.hline(x, y, 4, spec.detail[2]);
    p.vline(x, y, 3, spec.detail[2]);
  }
}

// Paving: big slabs. The joint is not drawn on every seam: a variant carries
// which of its two repeating edges is a joint, so neighbouring tiles either meet
// on a joint or continue the same slab. With a corner, a left-edge and a top-edge
// variant in every block, slabs come out one or two tiles wide and tall, which is
// the 2x2-tile module the catalogue asks for, and no joint is drawn as a frame.
function paintSlabs(p, rng, spec, variant) {
  fill(p, spec.base);
  for (let i = 0; i < (spec.marks ?? 14); i++) {
    p.px(rng.int(1, W - 2), rng.int(1, W - 2), rng.chance(0.6) ? spec.detail[0] : spec.detail[1]);
  }
  const [top, left] = spec.sides[variant] ?? spec.sides[0];
  if (top !== null) {
    p.hline(0, top, W, spec.joint);
    p.hline(rng.int(1, W - 5), (top + 1) % W, rng.int(2, 4), spec.edge);
  }
  if (left !== null) {
    p.vline(left, 0, W, spec.joint);
    p.vline((left + 1) % W, rng.int(1, W - 5), rng.int(2, 4), spec.edge);
  }
  // a chip where a slab edge has crumbled, so the lattice is not machine-perfect
  for (let i = 0; i < (spec.chips ?? 2); i++) {
    p.px(rng.int(1, W - 2), rng.int(1, W - 2), spec.chip);
  }
}

// Poured concrete panels: a trowelled face with aggregate, one long panel joint
// along the seam and tool marks. Only one axis carries a joint, which is what
// tells a poured panel apart from a laid slab.
function paintPanel(p, rng, spec) {
  fill(p, spec.base);
  for (let i = 0; i < (spec.marks ?? 24); i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, W - 1);
    p.px(x, y, rng.chance(0.6) ? spec.detail[0] : spec.detail[1]);
  }
  // trowel streaks, two or three pixels at a time so they read as tool marks
  for (let i = 0; i < (spec.streaks ?? 4); i++) {
    const x = rng.int(0, W - 3);
    const y = rng.int(1, W - 2);
    p.hline(x, y, rng.int(2, 4), spec.detail[0]);
  }
  p.hline(0, W - 1, W, spec.joint);
  // the lit lip under a joint is a few pixels long, like a worn panel edge
  p.hline(rng.int(1, W - 6), 0, rng.int(3, 6), spec.edge);
}

// Setts in offset rows: rounded stones of slightly different widths, mortar
// showing between them. The lit edge is one pixel on a few setts only: a lit edge
// on every stone turns a road into a tiled bathroom wall.
function paintCobble(p, rng, spec) {
  fill(p, spec.base); // mortar
  const rows = [
    { y: 0, off: 0 },
    { y: 8, off: 4 },
  ];
  for (const row of rows) {
    for (let i = -1; i < 3; i++) {
      const x0 = (((row.off + i * 8) % W) + W) % W;
      const body = spec.detail[rng.int(0, spec.detail.length - 1)];
      const wide = rng.chance(0.5) ? 7 : 6;
      // a sett is a rounded block, so its corners stay mortar
      for (let j = 0; j < 7; j++) {
        const inset = j === 0 || j === 6 ? 1 : 0;
        for (let k = inset; k < wide - inset; k++) wrapPx(p, x0 + k, row.y + j, body);
      }
      if (rng.chance(0.45)) wrapRect(p, x0 + 1, row.y + 1, 2, 1, spec.edge);
      if (rng.chance(0.6)) wrapPx(p, x0 + wide - 2, row.y + 6, spec.accent);
    }
  }
  for (let i = 0; i < (spec.speck ?? 4); i++) {
    wrapPx(p, rng.int(0, W - 1), rng.int(0, W - 1), spec.accent);
  }
}

// Large stone slabs, as on the current card plaza: a stone face, a dark joint on
// the two repeating seams and a chiselled edge. The chisel is a short stroke, not
// a full border, so a slab does not read as a framed square.
function paintPlaza(p, rng, spec) {
  fill(p, spec.base);
  for (let i = 0; i < (spec.marks ?? 14); i++) {
    p.px(rng.int(1, W - 2), rng.int(1, W - 2), rng.chance(0.5) ? spec.detail[0] : spec.detail[1]);
  }
  p.hline(0, W - 1, W, spec.joint);
  p.vline(W - 1, 0, W, spec.joint);
  p.hline(rng.int(1, W - 6), 0, rng.int(3, 6), spec.edge);
  p.vline(0, rng.int(1, W - 6), rng.int(3, 6), spec.edge);
}

// -------------------------------------------------------------------- water
//
// Water is the one ground that moves, so it is the one ground whose tile carries a
// frame. Everything that does not move is painted from the same spec, hash and seed
// as any other material, and the frame only ever reaches the highlight and the
// sparkles. That is what keeps the land beside an animated shore identical across
// frames (S4): the a layer never hears about the frame at all.

// The body of a Mediterranean stream (S2): the deep water blue taken down into the
// green of the valley and greyed with the slate of the paving, so it reads cold and
// a little turbid instead of tropical. waterLite is never part of the body; it is
// spent on the one-pixel waterline of a shore, the silt sparkle and the travelling
// highlight, and nowhere else.
const STREAM_BODY = mix(mix(C.waterDeep, C.grassDeep, 0.6), C.slate, 0.2);
const STREAM_DEEP = mix(STREAM_BODY, C.waterDeep, 0.28);
const STREAM_SHALLOW = mix(STREAM_BODY, C.water, 0.18);
const STREAM_WEED = mix(STREAM_BODY, C.grassDeep, 0.5);
// Silt is warm neutral sand on a cold bed, and it is a fleck and not a bubble: at 1x
// a pale dot has to read as sediment, so it may not be the same family as the
// highlight and it may not be so warm that it reads as a spark.
const STREAM_SILT = mix(C.sand, C.stone, 0.4);

const wrapAt = (v, n = W) => ((v % n) + n) % n;

// A low-frequency bend across the flow, periodic over the tile: the streaks lean a
// pixel or two instead of running as ruled lines, and they continue over the seam
// instead of stepping at it.
function bendField(seed) {
  const r = makeRng(seed);
  const f1 = 1 + Math.floor(r.next() * 2);
  const f2 = 2 + Math.floor(r.next() * 2);
  const p1 = r.next() * TAU;
  const p2 = r.next() * TAU;
  const out = new Int8Array(W);
  for (let i = 0; i < W; i++) {
    const t = (i + 0.5) / W;
    out[i] = Math.round(1.1 * Math.sin(TAU * f1 * t + p1) + 0.6 * Math.sin(TAU * f2 * t + p2));
  }
  return out;
}

// A stream: bands of tone across the flow, bent along it. Two pixels per band and
// eight bands per tile is a slow structure (S3): at 1x it reads as a moving surface
// even with the highlight switched off, where a flat fill reads as paint.
function currentBody(p, rng, spec, variant, dir) {
  const bend = bendField(variantSeed(spec, variant) ^ 0x3f1d);
  const n = spec.tones.length;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const along = dir === 'v' ? y : x;
      const across = dir === 'v' ? x : y;
      const band = wrapAt(Math.floor((across - bend[along]) / spec.band), n);
      p.px(x, y, spec.tones[band]);
    }
  }
  // weed and shallows: a few soft clumps that break the stripes, so the surface
  // never reads as a corduroy of bands. They are the same for every frame.
  for (let i = 0; i < (spec.clumps ?? 3); i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, W - 1);
    wrapRect(p, x, y, 3, 2, spec.tones[i % 2 === 0 ? 4 : 2]);
  }
}

// A pond: no current, so no bands. Soft blobs of tone from a wrapped voronoi field
// give the surface volume — deep hollows, a paler shelf — which is what keeps it from
// reading as a flat fill while nothing on it moves. Blobs and not rings: a rim round
// a pool at 1x reads as a bubble, not as depth.
function stillBody(p, rng, spec) {
  const palette = [spec.tones[0], spec.base, spec.tones[1], spec.base];
  const seeds = [];
  for (let i = 0; i < (spec.seeds ?? 5); i++) {
    seeds.push({ x: rng.next() * W, y: rng.next() * W, tone: palette[i % palette.length] });
  }
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let best = Infinity;
      let tone = spec.base;
      for (const s of seeds) {
        let dx = Math.abs(x + 0.5 - s.x);
        let dy = Math.abs(y + 0.5 - s.y);
        if (dx > W / 2) dx = W - dx;
        if (dy > W / 2) dy = W - dy;
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          tone = s.tone;
        }
      }
      p.px(x, y, tone);
    }
  }
}

// The travelling highlight: one crest line that steps along the flow, a quarter of
// the tile per frame, with a faint trailing edge so it reads as a crest and not as a
// rule. The crest itself is a soft lift on every pixel of the line, because a line
// broken into segments can miss the thin strip of water a transition leaves beside a
// bank; three of its pixels per frame carry the palette's brightest cyan, and which
// three steps with the frame, so the line glitters instead of glowing evenly.
function paintDrift(p, spec, variant, dir, frame, phase = 0) {
  const frames = spec.frames ?? 4;
  // The crest position comes from the clock plus the caller's phase, never from the
  // variant: a variant-dependent position put the crest at a different column in
  // every cell, and a field of them read as a 16px lattice instead of a current.
  const pos = wrapAt(phase + frame * Math.round(W / frames));
  const trail = wrapAt(pos - 1);
  const crest = mix(spec.base, C.waterLite, 0.22);
  const glow = mix(spec.base, C.waterLite, 0.12);
  for (let i = 0; i < W; i++) {
    // the line runs across the flow and travels along it
    const core = dir === 'v' ? [i, pos] : [pos, i];
    const edge = dir === 'v' ? [i, trail] : [trail, i];
    // exactly three bright pixels on the line: five is coprime with sixteen, so the
    // three land in three different places every frame and never all miss a strip
    if ((i * 5 + frame * 7) % 16 < 3) p.px(core[0], core[1], C.waterLite);
    else p.px(core[0], core[1], crest);
    if ((i * 3 + frame * 5) % 16 < 4) p.px(edge[0], edge[1], glow);
  }
}

// Sparkles that appear and fade in place: the anchors are fixed per variant, so
// nothing travels, and only the brightness of an anchor changes with the frame. That
// is what makes a pond read as still (S5) while it still lives a little. Four levels
// per anchor, one step apart, so an anchor that advances a frame always changes its
// pixel instead of sitting still for two frames.
function paintSparkles(p, spec, variant, frame) {
  const frames = spec.frames ?? 4;
  const levels = [null, mix(spec.base, C.waterLite, 0.08), mix(spec.base, C.waterLite, 0.17), C.waterLite];
  for (let i = 0; i < (spec.sparkles ?? 6); i++) {
    const h = hash32(i, variant, spec.salt ^ 0x51ed);
    const x = h % W;
    const y = (h >>> 8) % W;
    const age = (frame + ((h >>> 16) % frames)) % frames;
    if (!age) continue;
    p.px(x, y, levels[age]);
  }
}

// The part of a water tile that belongs to the frame: the one thing that moves.
function paintWaterFrame(p, spec, variant, dir = 'h', frame = 0, phase = 0) {
  if (spec.flow === 'still') paintSparkles(p, spec, variant, frame);
  else paintDrift(p, spec, variant, dir, frame, phase);
}

// The surface of one water tile: the structure that never moves, the silt, then the
// part that belongs to the frame.
function paintWater(p, rng, spec, variant, dir = 'h', frame = 0, phase = 0) {
  paintWaterBody(p, rng, spec, variant, dir);
  paintWaterFrame(p, spec, variant, dir, frame, phase);
}

// The body on its own: the same pixels for every frame, and the same pixels whether
// the water is painted on its own or as the second ground of a transition.
function paintWaterBody(p, rng, spec, variant, dir = 'h') {
  if (spec.flow === 'still') stillBody(p, rng, spec);
  else currentBody(p, rng, spec, variant, dir);
  // pale silt: a few dots that do not move, so the water reads as water with the
  // animation switched off (S3)
  for (let i = 0; i < (spec.silt ?? 2); i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, W - 1);
    wrapPx(p, x, y, spec.accent);
    if (rng.chance(0.35)) wrapPx(p, x + 1, y, spec.accent);
  }
}

// The direction a material flows in on its own: a transition tile carries no
// direction, so the bank of a pair uses the material's natural one.
const waterDir = (spec) => (spec.dir === 'v' ? 'v' : 'h');

const PATTERNS = {
  speckle: paintSpeckle,
  ruts: paintRuts,
  stones: paintStones,
  blotch: paintBlotch,
  wear: paintWear,
  slabs: paintSlabs,
  panel: paintPanel,
  cobble: paintCobble,
  plaza: paintPlaza,
  // The two waters share one painter, which branches on the spec's flow: a tile
  // pattern is a pure function of the spec and the seed, frame 0 included.
  water: (p, rng, spec, variant) => paintWater(p, rng, spec, variant, waterDir(spec), 0),
  waterStill: (p, rng, spec, variant) => paintWater(p, rng, spec, variant, waterDir(spec), 0),
};

// ----------------------------------------------------------------- catalogue

// Every material is a spec. Colours are palette names or mixes of them: nothing
// here may hold a literal, which is what keeps the floor inside the one palette.
// A material added by a later task (water, transitions) only needs a pattern this
// module can paint and a variant count.
export const TERRAIN = {
  // --------------------------------------------------------------- natural
  grass: {
    label: 'GRASS',
    group: 'natural',
    base: C.grass,
    detail: [C.grassDark, C.grassLite],
    accent: C.grassSun,
    clump: mix(C.grass, C.grassDark, 0.55),
    pattern: 'speckle',
    variants: 4,
    marks: 22,
    tall: 0.22,
    clumps: 3,
  },
  grassDry: {
    label: 'GRASS DRY',
    group: 'natural',
    base: mix(C.grassSun, C.sand, 0.4),
    detail: [mix(C.grassSun, C.grass, 0.55), C.sand],
    accent: mix(C.sand, C.white, 0.3),
    clump: mix(C.grassSun, C.grassDark, 0.45),
    pattern: 'speckle',
    variants: 3,
    marks: 20,
    tall: 0.34,
    clumps: 3,
  },
  dirt: {
    label: 'DIRT',
    group: 'natural',
    base: mix(C.dirtMid, C.dirt, 0.42),
    detail: [C.dirt, C.dirtLite, mix(C.dirtMid, C.dirtDeep, 0.5)],
    accent: mix(C.dirtLite, C.stone, 0.45),
    pattern: 'ruts',
    variants: 4,
    marks: 34,
    ruts: [3, 11],
    // the groove is one shade darker than the earth around it, not a black line:
    // a hard line across a 16px tile reads as planking
    rut: mix(mix(C.dirtMid, C.dirt, 0.42), C.dirtDeep, 0.45),
    rutLite: mix(mix(C.dirtMid, C.dirt, 0.42), C.dirtLite, 0.35),
    pebbles: 4,
  },
  gravel: {
    label: 'GRAVEL',
    group: 'natural',
    base: mix(C.dirtLite, C.stone, 0.5),
    detail: [mix(C.stone, C.stoneLite, 0.35), mix(C.dirt, C.slate, 0.3), mix(C.dirt, C.dirtDeep, 0.5)],
    accent: C.stoneLite,
    pattern: 'stones',
    variants: 3,
    marks: 12,
    speck: 20,
  },
  clay: {
    label: 'CLAY',
    group: 'natural',
    base: mix(C.brick, C.dirt, 0.62),
    detail: [mix(C.brick, C.dirtDeep, 0.4), mix(C.brickLite, C.dirtLite, 0.4)],
    accent: mix(C.dirt, C.dirtDeep, 0.6),
    // soft tonal patches, so the earth reads as mottled clay and not as flat paint
    tones: [
      mix(C.brick, C.dirt, 0.62),
      mix(C.brick, C.dirt, 0.35),
      mix(C.brick, C.dirt, 0.85),
      mix(C.brickLite, C.dirt, 0.7),
    ],
    pattern: 'blotch',
    variants: 3,
    seeds: 5,
    speck: 14,
    cracks: 2,
  },
  rock: {
    label: 'ROCK',
    group: 'natural',
    base: C.stone,
    detail: [C.stoneLite, C.slate],
    accent: mix(C.slate, C.ink, 0.3),
    // bare stone: soft patches a shade apart and a couple of cracks. The patches
    // stay within a few percent of the base colour, so the block that chooses a
    // variant is never spelled out on the field as a mosaic.
    tones: [C.stone, mix(C.stone, C.stoneLite, 0.1), mix(C.stone, C.slate, 0.08), mix(C.stone, C.stoneLite, 0.05)],
    pattern: 'blotch',
    variants: 3,
    seeds: 4,
    speck: 6,
    cracks: 2,
  },
  scrub: {
    label: 'SCRUB',
    group: 'natural',
    base: C.grassDark,
    detail: [C.grassDeep, C.grass],
    accent: C.grassLite,
    clump: mix(C.grassDark, C.grass, 0.4),
    bush: mix(C.grass, C.grassDark, 0.45),
    pattern: 'speckle',
    variants: 3,
    marks: 16,
    tall: 0.5,
    clumps: 4,
    bushes: 3,
  },

  // ----------------------------------------------------------------- urban
  asphalt: {
    label: 'ASPHALT',
    group: 'urban',
    base: mix(C.ink2, C.slate, 0.28),
    // dark slate, not near-black: pure ink speckle shimmers at 2px per art pixel
    detail: [mix(C.ink3, C.stone, 0.5), mix(C.slate, C.ink, 0.45)],
    accent: mix(C.ink2, C.stone, 0.3),
    pattern: 'wear',
    variants: 4,
    marks: 14,
    perVariant: 6,
  },
  paving: {
    label: 'PAVING',
    group: 'urban',
    base: mix(C.stone, C.slate, 0.42),
    detail: [mix(C.stone, C.stoneLite, 0.45), mix(C.slate, C.ink, 0.2)],
    edge: mix(C.stoneLite, C.stone, 0.45),
    joint: mix(C.slate, C.ink, 0.25),
    chip: mix(C.stone, C.slate, 0.6),
    pattern: 'slabs',
    variants: 3,
    // which repeating edges carry a joint in each variant: [top, left]
    sides: [
      [0, 0],
      [null, 0],
      [0, null],
    ],
    marks: 14,
    chips: 3,
  },
  concrete: {
    label: 'CONCRETE',
    group: 'urban',
    base: mix(C.stoneLite, C.stone, 0.25),
    detail: [mix(C.stoneLite, C.white, 0.25), mix(C.stone, C.slate, 0.45)],
    edge: mix(C.stoneLite, C.white, 0.15),
    joint: mix(C.slate, C.stone, 0.55),
    pattern: 'panel',
    variants: 3,
    marks: 16,
    streaks: 3,
  },
  cobble: {
    label: 'COBBLE',
    group: 'urban',
    base: mix(C.slate, C.ink, 0.45), // mortar
    detail: [mix(C.stone, C.stoneLite, 0.25), C.stone, mix(C.stone, C.slate, 0.35)],
    edge: mix(C.stoneLite, C.stone, 0.35),
    accent: mix(C.slate, C.ink, 0.4),
    pattern: 'cobble',
    variants: 4,
    speck: 4,
  },
  plaza: {
    label: 'PLAZA',
    group: 'urban',
    base: mix(C.stone, C.sand, 0.5),
    detail: [mix(C.stoneLite, C.sand, 0.2), mix(C.stone, C.dirtMid, 0.35)],
    edge: mix(C.stoneLite, C.sand, 0.3),
    joint: C.slate,
    pattern: 'plaza',
    variants: 3,
    marks: 12,
  },

  // ----------------------------------------------------------------- water
  // A stream and a pond, first-class grounds like any other (S1). Four variants so
  // the block picker can hand a 2x2 its four surfaces; the tone set is shared by all
  // four and only the bend of the bands and the silt move, so a field of water never
  // reads as a mosaic of tiles. `flow` is what the painter branches on, and it is
  // also the rule the shore treatment follows: a rule about the material, never a
  // flag on the pair.
  water: {
    label: 'STREAM',
    group: 'natural',
    base: STREAM_BODY,
    detail: [STREAM_DEEP, STREAM_SHALLOW],
    accent: STREAM_SILT,
    // eight bands of two pixels: body, deep, shallow, body, weed, shallow, deep,
    // body. Slow and low-contrast, so the surface has structure without a pattern.
    tones: [
      STREAM_BODY,
      STREAM_DEEP,
      STREAM_SHALLOW,
      STREAM_BODY,
      STREAM_WEED,
      STREAM_SHALLOW,
      STREAM_DEEP,
      STREAM_BODY,
    ],
    pattern: 'water',
    flow: 'current',
    dir: 'h',
    band: 2,
    variants: 4,
    frames: 4,
    clumps: 3,
    silt: 2,
  },
  waterStill: {
    label: 'POND',
    group: 'natural',
    base: mix(STREAM_BODY, C.grassDeep, 0.22),
    detail: [STREAM_DEEP, STREAM_SHALLOW],
    accent: STREAM_SILT,
    // a pond is shallower and greener than the stream it feeds: a deep pool with a
    // pale shallow rim, and the sparkles carry the only motion
    tones: [mix(STREAM_BODY, STREAM_WEED, 0.5), mix(STREAM_BODY, C.water, 0.16)],
    pattern: 'waterStill',
    flow: 'still',
    dir: 'h',
    variants: 4,
    frames: 4,
    silt: 2,
    sparkles: 6,
  },
};

// The salt of a material is derived from its name, so adding, renaming or
// reordering materials never moves the pixels of the others.
for (const [name, spec] of Object.entries(TERRAIN)) spec.salt = saltOf(name);

function specOf(kind) {
  const spec = TERRAIN[kind];
  if (!spec) throw new Error(`unknown terrain material: ${kind}`);
  return spec;
}

// ---------------------------------------------------------------------- api

export function terrainKinds() {
  return Object.keys(TERRAIN);
}

// A material's own pattern onto a painter, with the seed its base tile uses. One
// path for the base tiles, the transition layers and the fringe decorations, so a
// ground painted as part of a transition is the same texture as the ground on its
// own.
function paintLayer(target, spec, variant, allow = null) {
  const paint = PATTERNS[spec.pattern];
  if (!paint) throw new Error(`no painter for pattern "${spec.pattern}"`);
  paint(allow ? clipped(target, allow) : target, makeRng(variantSeed(spec, variant)), spec, variant);
}

// One 16x16 tile, painted once and cached: a patch is snipped together from tiles,
// never repainted per cell.
export function terrainTile(kind, variant = 0) {
  const spec = specOf(kind);
  const n = spec.variants;
  const v = ((Math.round(variant) % n) + n) % n;
  return cacheSprite(cache, `tile|${kind}|${v}`, () => {
    const p = new Painter(W, W);
    paintLayer(p, spec, v);
    return p.sprite();
  });
}

// ---------------------------------------------------------------- animation
//
// S7's budget in one place: four frames per material at most, and one function that
// turns time into a frame, so a frame can be tested without a DOM. Everything that
// animates on the floor reads its frame from here; nothing else in the codebase
// multiplies a clock by a frame rate.

// The water rates are the spec's fps, and the driver reads them as data.
export const WATER_FPS = { water: 6, waterStill: 2 };

// The grounds that animate. Only the waters are here: a ground that holds still has
// no entry and reports the one frame of its spec.
const ANIM = {
  water: { fps: WATER_FPS.water, frames: 4 },
  waterStill: { fps: WATER_FPS.waterStill, frames: 4 },
};

// The shore decals lean on the same slow clock but are not grounds, and they used to
// share a name with the grass decal: the low reed was `tuft` and the clump on the
// meadow was `tuft` too. T5 wired both into one bake, so the reed became `sedge` and
// every kind on the floor now has a name of its own. The table stays apart from DECALS
// because a reed is not a decal that grows on a ground, and reedTile reads it directly.
export const REED_ANIM = {
  reeds: { fps: 2, frames: 3 },
  sedge: { fps: 2, frames: 3 },
};

// The rate of anything that animates on the floor, in one lookup: a ground, a decal
// or a shore reed. Every kind has one name now, so the lookup is the whole rule.
function rateOf(kind) {
  return ANIM[kind] ?? DECALS[kind] ?? REED_ANIM[kind] ?? null;
}

function framesOf(kind) {
  if (ANIM[kind]) return ANIM[kind].frames;
  return specOf(kind).frames ?? 1;
}

function wrapFrame(kind, frame) {
  const n = framesOf(kind);
  const f = Number.isFinite(frame) ? Math.round(frame) : 0;
  return ((f % n) + n) % n;
}

// How many frames a material animates: four for the waters, one for every ground
// that holds still, so the driver never asks a static ground for a frame and the
// budget is a property of the catalogue rather than a rule in the gallery.
export function waterFrames(kind) {
  return framesOf(kind);
}

// The frame a kind shows at a time: deterministic, it respects the fps, it wraps,
// and a frozen scene is always frame 0.
export function frameIndex(kind, timeSec, frozen = false) {
  if (frozen) return 0;
  const anim = rateOf(kind);
  if (!anim || !(anim.fps > 0) || !(anim.frames > 1)) return 0;
  const t = Number(timeSec);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.floor(t * anim.fps) % anim.frames;
}

// The frame a single cell shows: the shared clock plus a phase taken from a hash of
// (tx, ty), never a global phase, so a field of water shimmers instead of pulsing
// in unison (S7). The phase still goes through frameIndex, so this is a convenience
// and not a second clock.
export function cellFrame(kind, tx, ty, timeSec, frozen = false) {
  const anim = rateOf(kind);
  if (frozen || !anim || !(anim.fps > 0)) return 0;
  const period = anim.frames / anim.fps;
  const phase = ((hash32(Math.floor(tx), Math.floor(ty), saltOf(kind) ^ 0x2f3d) % 1024) / 1024) * period;
  return frameIndex(kind, (Number(timeSec) || 0) + phase, false);
}

// One water tile at one frame, cached by kind, direction, variant and frame: the
// key carries the frame, and four frames per family is the whole budget (S7).
// `variant` only ever picks an extra surface — the bend of the bands and the silt —
// never a different tone set, so a water patch does not read as a mosaic of squares.
export function waterTile(kind, dir = 'h', frame = 0, variant = 0, phase = 0) {
  const spec = specOf(kind);
  if (!spec.flow) throw new Error(`${kind} is not water`);
  const d = dir === 'v' ? 'v' : 'h';
  const v = ((Math.round(variant) % spec.variants) + spec.variants) % spec.variants;
  const f = wrapFrame(kind, frame);
  // phase shifts the crest along the flow so a patch can bend it row by row; it is
  // part of the cache key because it changes pixels
  const ph = spec.flow === 'still' ? 0 : wrapAt(Math.round(phase));
  return cacheSprite(cache, `water|${kind}|${d}|${v}|${f}|${ph}`, () => {
    const p = new Painter(W, W);
    paintWater(p, makeRng(variantSeed(spec, v)), spec, v, d, f, ph);
    return p.sprite();
  });
}

// A water patch for review and, later, the card bake: the variant comes from the
// same per-cell table as every other ground, and the frame is handed in by the
// caller, which is the only thing that knows the clock.
export function waterPatch(kind, dir = 'h', tilesW = 8, tilesH = 4, frame = 0, seed = 0) {
  specOf(kind);
  const w = Math.max(1, Math.round(tilesW));
  const h = Math.max(1, Math.round(tilesH));
  const field = Math.round(seed);
  const f = wrapFrame(kind, frame);
  return cacheSprite(cache, `water-patch|${kind}|${dir}|${w}x${h}|${field}|${f}`, () => {
    const p = new Painter(w * W, h * W);
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        // the phase is constant along the flow and stepped across it: the crest stays
        // continuous through a row while the rows together lean, like a real current
        const phase = wrapAt((dir === 'v' ? tx : ty) * 5);
        p.blit(waterTile(kind, dir, f, terrainCell(kind, tx, ty, field), phase), tx * W, ty * W);
      }
    }
    return p.sprite();
  });
}

// --------------------------------------------------------------------- reeds
//
// A decal, not a ground: no cell owns reeds, and nothing here paints a bank. The
// tile is transparent, so it composites over whatever shore is underneath, and the
// three frames lean with the same slow wind as the rest of the floor (S6).

// A reed is a dark stalk with one lit pixel on the sun side and a straw tip: the
// darkness is what gives the bank a silhouette, and the tip is what keeps it from
// reading as a hole in the grass.
const REED_BODY = mix(C.grassDeep, C.ink3, 0.3);
const REED_LIT = mix(C.grass, C.grassLite, 0.35);
const REED_TIP = mix(C.dirt, C.grassSun, 0.35);

const REED_DECALS = {
  // tall reeds: three stalks with a two-pixel seed head, so the shore gains a
  // silhouette instead of a line
  reeds: { stalks: 3, min: 9, max: 14, body: REED_BODY, lit: REED_LIT, tip: REED_TIP, head: true },
  // a low sedge: the same wind, a third of the height, for the waterline itself
  sedge: {
    stalks: 5,
    min: 3,
    max: 6,
    body: mix(C.grassDark, C.grass, 0.3),
    lit: mix(C.grassLite, C.grassSun, 0.5),
    tip: mix(C.grass, C.sand, 0.35),
    head: false,
  },
};

// The lean is a quadratic bend, so the tip travels two or three pixels while the
// root stays put: at 1x that is all the wind a stalk needs, and it is a different
// pattern for frame 0, 1 and 2, which is what keeps the three frames honest.
const LEAN = [-1.6, 0, 1.6];

function paintReeds(p, def, frame, rng) {
  const lean = LEAN[frame];
  for (let i = 0; i < def.stalks; i++) {
    // roots spread over the tile instead of clustering: three stalks in a clump read
    // as one blot, three in a rhythm read as a bed of reeds
    const rootX = Math.min(W - 2, Math.max(1, Math.round(((i + 0.5) * W) / def.stalks) + rng.int(-2, 2)));
    const tall = rng.int(def.min, def.max);
    const base = W - 1 - rng.int(0, 2);
    for (let j = 0; j < tall; j++) {
      const t = j / Math.max(1, tall - 1);
      const x = rootX + Math.round((lean * t * t * tall) / 6);
      const y = base - j;
      if (j === tall - 1) {
        // the tip, and above it a narrow head: one pixel wide, so it stands up from
        // the stalk instead of sitting on it like a cap
        p.px(x, y, def.tip);
        if (def.head && i === 1) p.px(x, y - 1, def.tip);
        continue;
      }
      p.px(x, y, def.body);
      if (j % 4 === 2 && rng.chance(0.5)) p.px(x + 1, y, def.lit);
    }
    // a root shadow, so the base of the stalk sits in the grass and not on it
    if (rng.chance(0.7)) p.px(rootX, base, mix(def.body, C.ink, 0.35));
  }
}

// The reed decals in catalogue order, so a caller that dresses a bank loops over data
// instead of naming the two kinds it happens to know.
export function reedKinds() {
  return Object.keys(REED_DECALS);
}

export function reedTile(kind, frame = 0, variant = 0) {
  const def = REED_DECALS[kind];
  if (!def) throw new Error(`unknown reed decal: ${kind}`);
  const n = REED_ANIM[kind].frames;
  const f = Number.isFinite(frame) ? ((Math.round(frame) % n) + n) % n : 0;
  const v = Number.isFinite(variant) ? Math.abs(Math.round(variant)) % 3 : 0;
  return cacheSprite(cache, `reed|${kind}|${f}|${v}`, () => {
    const p = new Painter(W, W);
    paintReeds(p, def, f, makeRng(hash32(saltOf(kind), 41 + v * 977, 7)));
    return p.sprite();
  });
}

// -------------------------------------------------------------------- decals
//
// A decal is not a ground: it is a transparent 16x16 overlay that stands on top of
// any material, so nothing here paints a base colour. The marks stay a pixel or two
// inside the border and thin out before they reach it, because a mark cut by the tile
// edge reads as a cut pixel and not as a drawing, and a mark that hugs the border
// reads as a square halo under the tile.
//
// Only two things come in from outside (S7): the frame, from the shared clock, and
// the state — day or night, dry or raining. A painter never reads the hour or the
// weather itself, which is what lets the gallery paint both states side by side and
// what lets the bake in T5 ask for the state of the hour it is baking.
//
// Two rules run through the colours below. Every soft mark keeps a lit pixel, because
// a decal has to read over both the meadow and the tarmac and a flat blade vanishes
// on one of them; and every metal cover keeps a pale rim, which is what makes it read
// as a cover and not as a hole.

const DECAL_BLADE = mix(C.grassDark, C.grass, 0.45);
const DECAL_BLADE_LIT = mix(C.grassLite, C.grassSun, 0.4);
const DECAL_BLADE_TIP = mix(C.grassSun, C.sand, 0.35);
const DECAL_BLADE_ROOT = mix(C.grassDeep, C.ink, 0.2);

const DECAL_STEM = mix(C.grassDark, C.grass, 0.35);
const DECAL_STEM_LIT = mix(C.grass, C.grassLite, 0.45);
const DECAL_PETAL = C.white;
const DECAL_PETAL_WARM = C.pink;
const DECAL_PETAL_CENTRE = C.lamp;
const DECAL_BUD = mix(C.pink, C.slate, 0.3);
const DECAL_BUD_DIM = mix(C.slate, C.pink, 0.25);

const DECAL_LEAF = mix(C.dirtMid, C.dirtLite, 0.45);
const DECAL_LEAF_DARK = mix(C.dirt, C.dirtDeep, 0.3);
const DECAL_LEAF_LIT = mix(C.dirtLite, C.sand, 0.4);

const DECAL_CRACK = mix(C.ink3, C.ink, 0.4);
const DECAL_CRACK_LIP = mix(C.stoneLite, C.stone, 0.6);

// Fresh tar is a shade darker than the tarmac around it and not a hole in it: a near
// black smear reads as a pothole, and a pothole is a different decal.
const DECAL_TAR = mix(C.ink2, C.slate, 0.16);
const DECAL_TAR_LIP = mix(C.slate, C.stone, 0.4);
const DECAL_GRAVEL = mix(C.stone, C.stoneLite, 0.5);

// Iron sits closer to the pavement than to the bright end of the grey ramp: a cover
// painted in stoneLite reads as a coin on the ground rather than as a casting set in it.
const DECAL_IRON = mix(C.slate, C.stone, 0.28);
const DECAL_IRON_LIT = mix(C.stoneLite, C.stone, 0.4);
const DECAL_IRON_DARK = mix(C.ink3, C.ink, 0.25);

// Moss is dark green with a yellow-green lit edge: over meadow the lit edge is the
// whole silhouette, and over paving the dark body is.
const DECAL_MOSS = mix(C.grassDeep, C.grass, 0.5);
const DECAL_MOSS_LIT = mix(C.grassLite, C.grassSun, 0.4);
const DECAL_MOSS_DARK = mix(C.grassDeep, C.ink, 0.3);

const DECAL_RAIN = mix(C.water, C.waterLite, 0.3);
const DECAL_FOAM = mix(C.waterLite, C.white, 0.45);

const decalClamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A soft blob of pixels: an ellipse whose edge wobbles per pixel, as a set of "x,y"
// keys. The tar smear and the moss mounds are the same shape in different colours,
// and the wobble is what keeps either from reading as a stamp.
function decalBlob(rng, cx, cy, rx, ry, wobble = 0.3) {
  const out = new Set();
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1 + (rng.next() - 0.5) * wobble) continue;
      out.add(`${x},${y}`);
    }
  }
  return out;
}

// A clump of grass blades. The roots sit inside five pixels, so the blades read as one
// plant and not as five scattered marks, and the clump keeps a root shadow: without it
// a tuft on the meadow is the same tone as the meadow. The roots stay put and only the
// tips travel, so the two frames are a lean and not a slide.
function paintTuft(p, rng, frame) {
  const wind = frame ? 1 : -1;
  for (let i = 0; i < 5; i++) {
    const rootX = decalClamp(6 + i + rng.int(-1, 1), 3, 12);
    const tall = 5 + (i % 3) + rng.int(0, 2);
    const rootY = decalClamp(13 + rng.int(-1, 0), 12, 14);
    const bend = wind * (1 + (i % 2));
    for (let j = 0; j < tall; j++) {
      const t = j / (tall - 1);
      // the blade is a blade, not a squiggle: it stands straight and only the tip
      // leans, so five of them read as a clump and not as a scribble
      const x = decalClamp(rootX + Math.round((bend * t * t * tall) / 10), 1, 13);
      const y = rootY - j;
      if (j === tall - 1) p.px(x, y, DECAL_BLADE_TIP);
      else if (j === 0) p.px(x, y, DECAL_BLADE_ROOT);
      else p.px(x, y, DECAL_BLADE);
      if (j === Math.floor(tall / 2) && (i + frame) % 2 === 0) {
        p.px(decalClamp(x + 1, 1, 14), y, DECAL_BLADE_LIT);
      }
    }
  }
  // the shadow the clump throws at its foot
  for (let i = 0; i < 3; i++) {
    p.px(decalClamp(7 + i * 2 + rng.int(-1, 1), 5, 12), 14, DECAL_BLADE_ROOT);
  }
}

// Wildflowers on thin stems. By day the petals are open — a lit centre with three or
// four petals round it, wider on the second frame — and at night the same head closes
// into a two-pixel bud, so the difference between the states is a silhouette and not a
// tint. The state is handed in; nothing here knows what time it is.
function paintFlowers(p, rng, frame, state) {
  const night = state === 'night';
  for (let i = 0; i < 3; i++) {
    const rootX = decalClamp(5 + i * 3 + rng.int(-1, 1), 3, 12);
    const tall = 6 + rng.int(0, 3);
    const sway = frame ? (i % 2 ? 1 : -1) : 0;
    for (let j = 0; j < tall; j++) {
      const t = j / (tall - 1);
      const x = rootX + Math.round(sway * t * t);
      p.px(x, 14 - j, j === tall - 1 ? DECAL_STEM_LIT : DECAL_STEM);
    }
    const topX = rootX + sway;
    const topY = 14 - tall;
    // a leaf on the stem, angled up and out, so a tall flower is not a needle and the
    // stem keeps a direction
    const leafY = 14 - Math.floor(tall / 2);
    const leafDir = i % 2 ? 1 : -1;
    p.px(decalClamp(rootX + leafDir, 2, 13), leafY, DECAL_STEM_LIT);
    p.px(decalClamp(rootX + leafDir * 2, 2, 13), leafY - 1, DECAL_STEM_LIT);
    if (night) {
      p.px(topX, topY, DECAL_BUD);
      p.px(topX, topY - 1, DECAL_BUD_DIM);
      if (frame) p.px(decalClamp(topX + 1, 2, 13), topY - 1, DECAL_BUD);
      continue;
    }
    p.px(topX, topY, DECAL_PETAL_CENTRE);
    p.px(topX - 1, topY, DECAL_PETAL);
    p.px(decalClamp(topX + 1, 2, 13), topY, DECAL_PETAL_WARM);
    p.px(topX, topY - 1, DECAL_PETAL);
    // the second frame opens the bloom one petal wider
    if (frame) {
      p.px(decalClamp(topX - 1, 2, 13), topY - 1, DECAL_PETAL);
      p.px(decalClamp(topX + 1, 2, 13), topY - 1, DECAL_PETAL_WARM);
    }
  }
}

// One dry leaf, authored once and turned to three orientations: a spine of five
// pixels with a lobe on each side and a dark tip. Five by two is the smallest a leaf
// can be and still read as a leaf instead of as a crumb, and the lobe is what gives it
// a direction.
const LEAF_TONES = [DECAL_LEAF, DECAL_LEAF_LIT, DECAL_LEAF_DARK];
const LEAF_PIXELS = [
  [0, 0, 2], // the stem end
  [1, 0, 0],
  [2, 0, 1], // the vein
  [3, 0, 0],
  [4, 0, 2], // the tip
  [1, 1, 1],
  [2, 1, 0],
  [3, 1, 0],
  [2, -1, 0],
];
const LEAF_DIRS = [
  [1, 0],
  [1, 1],
  [0, 1],
];

function paintLeaf(p, x, y, dir, flip) {
  const [dx, dy] = dir;
  const [nx, ny] = [-dy * flip, dx * flip];
  for (const [u, v, tone] of LEAF_PIXELS) {
    p.px(x + dx * u + nx * v, y + dy * u + ny * v, LEAF_TONES[tone]);
  }
}

function paintLeaves(p, rng, frame) {
  const spots = [];
  for (let i = 0; i < 3; i++) spots.push([rng.int(3, 10), rng.int(3, 10), rng.chance(0.5)]);
  spots.forEach(([x, y, flip], i) => {
    paintLeaf(p, x, y, LEAF_DIRS[(frame + i) % LEAF_DIRS.length], flip ? 1 : -1);
  });
}

// A hairline crack. It drifts a pixel every third step and takes one kink back, which
// is a line that wanders without becoming a scribble, and it carries a pale pixel every
// few steps where the broken edge catches the light: on paving the dark line reads on
// its own, on tarmac the pale pixel is what keeps the crack from vanishing into the
// aggregate. One short branch, because a single line reads as a scratch.
function paintCrack(p, rng) {
  let x = 4 + rng.int(0, 2);
  let y = 14;
  const len = 11 + rng.int(0, 2);
  const lean = rng.chance(0.5) ? 1 : -1;
  const startX = x;
  for (let i = 0; i < len; i++) {
    p.px(x, y, DECAL_CRACK);
    if (i > 1 && i < len - 2 && i % 4 === 0) p.px(decalClamp(x + 1, 2, 13), y, DECAL_CRACK_LIP);
    y -= 1;
    if (i % 3 === 1) x = decalClamp(x + lean, 2, 13);
    else if (rng.chance(0.2)) x = decalClamp(x - lean, 2, 13);
  }
  // the branch leaves from the middle and goes the other way: a crack splits
  const bx = Math.round((startX + x) / 2);
  const by = y + Math.round(len / 2);
  for (let i = 1; i <= 2; i++) {
    p.px(decalClamp(bx - lean * i, 2, 13), decalClamp(by - i, 2, 14), DECAL_CRACK);
  }
}

// A tar repair: a smear of fresh asphalt with the trowel's edge caught in the light on
// its top side, a couple of grains of aggregate still sitting in it, and one drag of
// tar pulled out to the side. The body is an ellipse with a wobbling edge and the tail
// is what makes it a smear and not a spot.
function paintPatch(p, rng) {
  const body = decalBlob(rng, 7, 8, 4, 3, 0.45);
  for (const key of body) {
    const [x, y] = key.split(',').map(Number);
    p.px(x, y, DECAL_TAR);
  }
  // the trowel drag: three pixels leaving the body on one side, thinning out, which is
  // what makes the shape a smear and not a spot
  const tailY = 8 + rng.int(-1, 1);
  const tailDir = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < 3; i++) {
    const x = decalClamp(7 + tailDir * (5 + i), 2, 13);
    if (body.has(`${x},${tailY}`)) continue;
    p.px(x, tailY + (i > 1 ? 1 : 0), i === 2 ? DECAL_TAR_LIP : DECAL_TAR);
  }
  for (const key of body) {
    const [x, y] = key.split(',').map(Number);
    // only the top edge, and only in places: a lit rim all the way round would be a
    // border again
    if (body.has(`${x},${y - 1}`) || (x + y) % 3 !== 0) continue;
    p.px(x, y, DECAL_TAR_LIP);
  }
  for (let i = 0; i < 3; i++) {
    const x = rng.int(5, 11);
    const y = rng.int(6, 10);
    if (body.has(`${x},${y}`)) p.px(x, y, DECAL_GRAVEL);
  }
}

// A cast-iron cover: a raised rim lit on top and shaded underneath, a groove inside it, a
// hub and four rivets. That is all a cover can carry at eleven pixels across: the rim is
// what makes it read as metal set in the ground, the groove is what makes it read as a
// cover, and spokes or ticks on top of that turn it into a gear.
function paintManhole(p, rng) {
  const cx = 8;
  const cy = 8;
  const R = 5.2;
  const rivetD = rng.chance(0.5) ? 2.6 : 2.9;
  const rivets = new Set();
  for (const [ux, uy] of [[1, 1], [-1, 1]]) {
    const len = Math.hypot(ux, uy);
    rivets.add(`${Math.round(cx + (ux / len) * rivetD)},${Math.round(cy + (uy / len) * rivetD)}`);
    rivets.add(`${Math.round(cx - (ux / len) * rivetD)},${Math.round(cy + (uy / len) * rivetD)}`);
  }
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      if (d > R - 1.1) {
        p.px(x, y, dy < -1.5 ? DECAL_IRON_LIT : dy > 3 ? DECAL_IRON_DARK : DECAL_IRON);
        continue;
      }
      if (d < 0.9) {
        p.px(x, y, DECAL_IRON_LIT);
        continue;
      }
      if (rivets.has(`${x},${y}`)) {
        p.px(x, y, DECAL_IRON_DARK);
        continue;
      }
      // one groove ring inside the rim, and nothing else: a second ring made the cover
      // read as a target
      if (d > 3.4 && d < 4.05) p.px(x, y, DECAL_IRON_DARK);
      else p.px(x, y, DECAL_IRON);
    }
  }
}

// A drain grate in its frame. Dry, the slots are holes; in the rain the slots carry
// water and the second frame has it lower with two drops under the tray. That is the
// whole difference between the states, and it is what makes the deck readable as a
// drain from above instead of as a patterned square.
function paintGrate(p, rng, frame, state) {
  const wet = state === 'rain';
  const x0 = 3;
  const y0 = 5;
  const w = 10;
  const h = 7;
  p.rect(x0, y0, w, h, DECAL_IRON);
  p.hline(x0, y0, w, DECAL_IRON_LIT);
  p.vline(x0, y0, h, DECAL_IRON_LIT);
  p.hline(x0, y0 + h - 1, w, DECAL_IRON_DARK);
  p.vline(x0 + w - 1, y0, h, DECAL_IRON_DARK);
  for (let x = x0 + 1; x < x0 + w - 1; x += 2) {
    const top = y0 + 1;
    const slot = h - 2;
    if (!wet) {
      p.vline(x, top, slot, DECAL_IRON_DARK);
      continue;
    }
    // the water stands in the lower half of the slot and drops away on the second
    // frame, so the two frames are a fall and not a flicker
    const level = frame ? slot - 1 : slot - 2;
    p.vline(x, top, level, DECAL_IRON_DARK);
    p.vline(x, top + level, slot - level, DECAL_RAIN);
    p.px(x, top + level - 1, DECAL_FOAM);
  }
  if (wet && frame) {
    // two drops leaving the tray, under it: the frame the drain is actually draining
    p.px(x0 + 2, y0 + h, DECAL_RAIN);
    p.px(x0 + 7, y0 + h + 1, DECAL_FOAM);
  }
  // wear on the bars themselves, never in a slot: grit drawn over a slot would read as
  // a hole closing up, and in the rain it would hide the one pixel that shows the water
  for (let i = 0; i < 2; i++) {
    const bx = x0 + 2 + 2 * rng.int(0, 3);
    const by = rng.int(y0 + 1, y0 + h - 2);
    p.px(bx, by, i ? DECAL_IRON_LIT : DECAL_IRON_DARK);
  }
}

// Moss in the joints of the slabs: two low mounds that overlap where two joints meet,
// lit along their top edge, with flecks creeping out of them. Nothing touches the
// border, and the mounds are not centred, so the tile sits on a slab as a patch of
// green instead of as a green square. The second frame shifts a mound by one pixel:
// at 1 fps that is all the motion moss needs.
function paintMoss(p, rng, frame) {
  // merged into one silhouette before they are toned: toning the two mounds apart draws
  // an edge through the middle of the patch
  const mounds = [
    decalBlob(rng, 6 + (frame ? 1 : 0), 10, 4.6, 3.2, 0.4),
    decalBlob(rng, 11, 6, 3.4, 2.6, 0.4),
  ];
  const patch = new Set([...mounds[0], ...mounds[1]]);
  for (const key of patch) {
    const [x, y] = key.split(',').map(Number);
    // Three tones: the top edge catches the light, the bottom edge sits in its own
    // shadow. On meadow the shadow is what separates the mound from the grass, and on
    // paving the lit edge is.
    const tone = !patch.has(`${x},${y - 1}`) ? DECAL_MOSS_LIT : !patch.has(`${x},${y + 1}`) ? DECAL_MOSS_DARK : DECAL_MOSS;
    p.px(x, y, tone);
  }
  for (let i = 0; i < 5; i++) {
    p.px(rng.int(3, 12), rng.int(3, 12), i % 2 ? DECAL_MOSS_LIT : DECAL_MOSS_DARK);
  }
}

// The eight decals of the catalogue, in gallery order. `frames` is what the shared
// clock may ask for and never more than four (S7); a decal that only moves under a
// state names that state in `animatedWhen`, and a decal that never moves declares one
// frame and no fps. `states` lists the states it distinguishes, so the gallery can
// paint them without knowing which kind it is looking at.
//
// `grounds` and `weight` are where a decal grows and how common it is. They live here and
// not in the gallery because both the gallery's dressed floor and the card bake (T5) ask
// the same question — what may this ground wear — and two answers would drift apart. A
// weight is a repeat count, so moss and cracks are everywhere and a manhole cover is one
// per street.
export const DECALS = {
  tuft: {
    label: 'TUFT',
    group: 'natural',
    frames: 2,
    fps: 2,
    states: [],
    variants: 3,
    grounds: ['grass', 'grassDry', 'dirt', 'scrub'],
    weight: 2,
  },
  flowers: {
    label: 'FLOWERS',
    group: 'natural',
    frames: 2,
    fps: 1.5,
    states: ['day', 'night'],
    variants: 3,
    grounds: ['grass', 'grassDry', 'dirt'],
    weight: 1,
  },
  leaves: {
    label: 'LEAVES',
    group: 'natural',
    frames: 3,
    fps: 3,
    states: [],
    variants: 3,
    grounds: ['grass', 'grassDry', 'dirt', 'gravel', 'paving', 'asphalt', 'cobble', 'concrete'],
    weight: 1,
  },
  crack: {
    label: 'CRACK',
    group: 'urban',
    frames: 1,
    fps: 0,
    states: [],
    variants: 3,
    grounds: ['paving', 'asphalt', 'concrete', 'cobble', 'plaza'],
    weight: 2,
  },
  patch: {
    label: 'TAR PATCH',
    group: 'urban',
    frames: 1,
    fps: 0,
    states: [],
    variants: 2,
    grounds: ['asphalt', 'concrete'],
    weight: 2,
  },
  manhole: {
    label: 'MANHOLE',
    group: 'urban',
    frames: 1,
    fps: 0,
    states: [],
    variants: 2,
    grounds: ['paving', 'asphalt', 'concrete', 'plaza'],
    weight: 1,
  },
  grate: {
    label: 'GRATE',
    group: 'urban',
    frames: 2,
    fps: 8,
    states: ['dry', 'rain'],
    animatedWhen: ['rain'],
    variants: 2,
    grounds: ['asphalt', 'paving'],
    weight: 1,
  },
  moss: {
    label: 'MOSS',
    group: 'natural',
    frames: 2,
    fps: 1,
    states: [],
    variants: 3,
    grounds: ['paving', 'cobble', 'plaza', 'concrete', 'rock'],
    weight: 2,
  },
};

// Like a ground, a decal's salt comes from its name, so the pixels never move when the
// catalogue is reordered.
for (const [name, spec] of Object.entries(DECALS)) spec.salt = saltOf(name);

const PAINTER_BY_DECAL = {
  tuft: paintTuft,
  flowers: paintFlowers,
  leaves: paintLeaves,
  crack: paintCrack,
  patch: paintPatch,
  manhole: paintManhole,
  grate: paintGrate,
  moss: paintMoss,
};

function decalSpec(kind) {
  const spec = DECALS[kind];
  if (!spec) throw new Error(`unknown decal: ${kind}`);
  return spec;
}

// A state the decal does not declare is not an error, it is the decal's dry or day
// default: a caller in a hurry may pass the weather to every decal and only the ones
// that care will change.
function decalState(kind, state) {
  const spec = decalSpec(kind);
  if (typeof state !== 'string' || !state) return null;
  return spec.states.includes(state) ? state : null;
}

// How many frames a decal shows in a given state: one when it holds still, and one for
// the grate unless it is raining. The gallery asks this so a dry grate is drawn once
// instead of as two identical frames.
export function decalFrames(kind, state = null) {
  const spec = decalSpec(kind);
  const st = decalState(kind, state);
  if (spec.frames <= 1) return 1;
  if (spec.animatedWhen && !spec.animatedWhen.includes(st)) return 1;
  return spec.frames;
}

// One decal tile, cached by kind, variant, frame and state: four of those are the
// whole budget (S7) and the state is in the key because it changes pixels.
export function decalTile(kind, variant = 0, frame = 0, state = null) {
  const spec = decalSpec(kind);
  const v = ((Math.round(variant) % spec.variants) + spec.variants) % spec.variants;
  const st = decalState(kind, state);
  const n = decalFrames(kind, st);
  const f = n <= 1 ? 0 : ((Math.round(frame) % n) + n) % n;
  return cacheSprite(cache, `decal|${kind}|${v}|${f}|${st ?? '-'}`, () => {
    const p = new Painter(W, W);
    PAINTER_BY_DECAL[kind](p, makeRng(hash32(spec.salt, 977 + v * 6151, 29)), f, st);
    return p.sprite();
  });
}

// The decals in catalogue order: what the gallery loops over, so a ninth decal needs
// no layout work in calibration.js.
export function decalKinds() {
  return Object.keys(DECALS);
}

// [[kind, variantCount], ...]: the sheet the gallery paginates and the future bake
// reads to know how many faces each decal has.
export function decalSheet() {
  return decalKinds().map((kind) => [kind, DECALS[kind].variants]);
}

// What a ground may wear, as a weighted list of kinds ready for decalAt: a ground lists
// the decals it grows and a decal says where it grows, so the answer is the catalogue's
// and not the gallery's. An empty list is a real answer — nothing grows on water.
export function decalDressing(ground) {
  const out = [];
  for (const kind of decalKinds()) {
    const spec = DECALS[kind];
    if (!spec.grounds.includes(ground)) continue;
    for (let i = 0; i < (spec.weight ?? 1); i++) out.push(kind);
  }
  return out;
}

// The dressing of one cell, from a hash of (tx, ty): which decal, if any, and which
// variant. Nothing is placed by hand and nothing is global, so a field is dressed the
// same way twice and the bake and the gallery agree (S9). `kinds` is the list the
// ground can wear — moss on the slabs, a tar patch on the tarmac — and `density` the
// share of cells that get anything at all, which is what keeps a dressed floor from
// reading as a sticker sheet.
const DRESSING_SALT = saltOf('decals');

export function decalAt(tx, ty, kinds = decalKinds(), seed = 0, density = 0.5) {
  const list = (Array.isArray(kinds) && kinds.length ? kinds : decalKinds()).filter((kind) => DECALS[kind]);
  if (!list.length) return null;
  const h = hash32(Math.floor(tx), Math.floor(ty), DRESSING_SALT + Math.round(seed) * 7919);
  const rate = Number.isFinite(density) ? Math.min(1, Math.max(0, density)) : 0.5;
  if ((h % 1024) / 1024 >= rate) return null;
  const kind = list[(h >>> 10) % list.length];
  return { kind, variant: (h >>> 20) % DECALS[kind].variants };
}

// Slot tables for the block picker. Each one is a way of handing the four cells of
// a block four different values: with four variants or more the four cells are
// always different; with three, one value has to repeat (four cells, three values),
// so the repeat is spent on a diagonal where it cannot look like a pair.
const PERM4 = (() => {
  const out = [];
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      for (let c = 0; c < 4; c++) {
        for (let d = 0; d < 4; d++) {
          if (new Set([a, b, c, d]).size === 4) out.push([a, b, c, d]);
        }
      }
    }
  }
  return out;
})();
const MAP3 = [
  [0, 1, 2, 0],
  [0, 2, 1, 0],
  [0, 1, 1, 2],
  [1, 0, 0, 2],
];
const MAP2 = [
  [0, 1, 1, 0],
  [1, 0, 0, 1],
];

// The variant of a cell comes from the 2x2 block it sits in, never from a random
// walk. Each block picks its own starting variant and its own arrangement of the
// four slots, so a 2x2 block can never repeat a tile when the material has four
// variants, and can never show three of a kind when it has three; and because the
// arrangement is reshuffled per block, the same block does not come back in the
// same shape two cells away either.
function blockVariant(spec, bx, by, slot, field) {
  const n = spec.variants;
  const h = hash32(bx, by, spec.salt + field * 7919);
  const base = h % n;
  if (n >= 4) return (base + PERM4[h % PERM4.length][slot]) % n;
  if (n === 3) return (base + MAP3[(h >>> 9) % MAP3.length][slot]) % n;
  return (base + MAP2[(h >>> 9) % MAP2.length][slot]) % n;
}

// Deterministic variant for a cell: same cell, same variant, forever.
export function terrainAt(kind, tx, ty) {
  return variantInField(kind, tx, ty, 0);
}

// The variant a patch paints in a cell, seed included. A patch shifts the field
// with its seed; the bake needs the same answer and the check needs to see it.
export function terrainCell(kind, tx, ty, seed = 0) {
  return variantInField(kind, tx, ty, Math.round(seed));
}

function variantInField(kind, tx, ty, field) {
  const spec = specOf(kind);
  const x = Math.floor(tx);
  const y = Math.floor(ty);
  const slot = ((y & 1) << 1) | (x & 1);
  return blockVariant(spec, x >> 1, y >> 1, slot, field);
}

// A patch of cells for review and for the card bake: painted once, then cached by
// size and seed.
export function terrainPatch(kind, tilesW = 8, tilesH = 4, seed = 0) {
  specOf(kind);
  const w = Math.max(1, Math.round(tilesW));
  const h = Math.max(1, Math.round(tilesH));
  const field = Math.round(seed);
  return cacheSprite(cache, `patch|${kind}|${w}x${h}|${field}`, () => {
    const p = new Painter(w * W, h * W);
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        p.blit(terrainTile(kind, terrainCell(kind, tx, ty, field)), tx * W, ty * W);
      }
    }
    return p.sprite();
  });
}

// ---------------------------------------------------------------- transitions
//
// A set of transitions is generic over the pair: `a` dominates and `b` shows
// through on the sides a mask names. `b` is painted first with its own painter, so
// the part of the tile that is b is the b tile pixel for pixel, and `a` is laid
// over it through a fringe. That is what makes two grounds meet on a line that
// wanders 1-3 px instead of butting on a border, and it also means the set costs
// one tile per mask instead of one tile per material and mask.

const SIDES = ['n', 'e', 's', 'w'];
const TAU = Math.PI * 2;

// The neighbour counts the thirteen pieces can answer without folding: no side, one
// side, or two adjacent sides. Everything else is a shape a reduced set cannot draw.
const DRAWABLE_BITS = new Set([0, 1, 2, 4, 8, 3, 6, 12, 9]);

// The 13 masks of a set, in the order the gallery lays them out: the fill, the
// four straight edges, the four convex corners and the four concave pockets.
export const TRANSITION_MASKS = [
  'fill',
  'n',
  'e',
  's',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
  'inNE',
  'inNW',
  'inSE',
  'inSW',
];

const MASK_SHAPES = {
  fill: {},
  n: { n: true },
  e: { e: true },
  s: { s: true },
  w: { w: true },
  ne: { n: true, e: true },
  nw: { n: true, w: true },
  se: { s: true, e: true },
  sw: { s: true, w: true },
  inNE: { pocket: 'ne' },
  inNW: { pocket: 'nw' },
  inSE: { pocket: 'se' },
  inSW: { pocket: 'sw' },
};

// The 4-bit neighbour mask (N=1 E=2 S=4 W=8) folded onto the 13 names. Thirteen
// pieces cannot draw all sixteen corners of the cube, so seven of them fold:
//   - b on two opposite sides (5, 10) is a one-tile channel, and a channel keeps
//     the straight it comes in through;
//   - b on three sides (7, 11, 13, 14) has no faithful tile at all. It folds onto
//     the pocket of the corner diagonally opposite the one side still carrying a,
//     which is the tile that keeps a whole instead of cutting a strip through it;
//   - b on all four sides (15) is an island: the fill, and the four banks belong
//     to the neighbours.
const MASK_BY_BITS = [
  'fill',
  'n',
  'e',
  'ne',
  's',
  'n',
  'se',
  'inNE',
  'w',
  'nw',
  'e',
  'inNW',
  'sw',
  'inSW',
  'inSE',
  'fill',
];

// Total over 0-15. `bDiagonals` (NE=1 SE=2 SW=4 NW=8, a set bit meaning that
// diagonal carries b) refines the one case four bits cannot express: a cell whose
// four sides are a but which a b cell touches on the corner. That is exactly the
// concavity the pocket masks exist for, and it is how a diagonal step closes.
export function transitionMask(bits, bDiagonals = 0) {
  const key = bits & 15;
  const d = bDiagonals & 15;
  if (key === 0 && d !== 0) {
    if (d & 1) return 'inNE';
    if (d & 2) return 'inSE';
    if (d & 4) return 'inSW';
    return 'inNW';
  }
  return MASK_BY_BITS[key];
}

// Which extra treatment a pair carries. A rule about materials, not a flag on the
// pair, so any pavement laid against asphalt gets the same kerb and any ground that
// meets water — the stream or the pond — gets the same shore.
export function transitionTreatment(a, b) {
  if (a === 'paving' && b === 'asphalt') return 'curb';
  if (TERRAIN[b] && TERRAIN[b].flow) return 'shore';
  return 'ground';
}

// Depth of material b along one side, per position, in px. Two sine octaves of
// integer frequency: smooth, and periodic, so a bank continues across the tile
// seam instead of stepping at it. The one-pixel teeth on top are what keeps the
// line hairy; the base depth underneath is continuous, so it is never a dotted
// line.
function edgeReach(salt) {
  const r = makeRng(salt);
  const f1 = 2 + Math.floor(r.next() * 3);
  const f2 = 5 + Math.floor(r.next() * 3);
  const p1 = r.next() * TAU;
  const p2 = r.next() * TAU;
  const out = new Uint8Array(W);
  for (let i = 0; i < W; i++) {
    const t = (i + 0.5) / W;
    const v = 1.7 + 1.05 * Math.sin(TAU * f1 * t + p1) + 0.6 * Math.sin(TAU * f2 * t + p2);
    let d = Math.max(1, Math.min(3, Math.round(v)));
    const h = hash32(i, 29, salt);
    if (h % 7 === 0) d = Math.min(4, d + 1);
    else if (h % 13 === 0) d = Math.max(1, d - 1);
    out[i] = d;
  }
  return out;
}

// The kerb is machined, so its line is straight while the asphalt beside it and
// the paving behind it are not.
const CURB_BAND = 2;

function fringeOf(a, b, mask) {
  const shape = MASK_SHAPES[mask];
  if (!shape) throw new Error(`unknown transition mask: ${mask}`);
  const sa = specOf(a);
  const sb = specOf(b);
  const treatment = transitionTreatment(a, b);
  const reach = { n: null, e: null, s: null, w: null };
  for (const side of SIDES) {
    if (!shape[side]) continue;
    // The profile belongs to the pair and the side, never to the mask or the
    // variant: two cells side by side continue the same bank, where a profile per
    // tile would meet on a visible step every sixteen pixels.
    reach[side] =
      treatment === 'curb'
        ? new Uint8Array(W).fill(CURB_BAND)
        : edgeReach(hash32(sa.salt, sb.salt, saltOf(side)));
  }
  return { reach, pocket: shape.pocket ?? null, treatment };
}

// The concave masks: a pocket of b bitten out of one corner. Irregular on its
// hypotenuse, so it reads as the same ground eating in and not as a cut corner.
const POCKET = 4;

function inPocket(corner, x, y) {
  const dx = corner === 'ne' || corner === 'se' ? W - 1 - x : x;
  const dy = corner === 'ne' || corner === 'nw' ? y : W - 1 - y;
  return dx + dy < POCKET + (hash32(x, y, 17) & 1);
}

function insideFringe(fr, x, y) {
  const r = fr.reach;
  if (r.n && y < r.n[x]) return false;
  if (r.s && y >= W - r.s[x]) return false;
  if (r.w && x < r.w[y]) return false;
  if (r.e && x >= W - r.e[y]) return false;
  if (fr.pocket && inPocket(fr.pocket, x, y)) return false;
  return true;
}

// Distance in px from every pixel to the other ground: fromA is 0 inside a and 1
// for a pixel of b that touches a, and so on; fromB is the same measured the other
// way. Two fields, so a treatment works on a straight bank, around a convex corner
// and inside a pocket without three cases, and so a kerb stops where the asphalt
// stops instead of running on into the pavement.
function spread(inA, seed) {
  const dist = new Uint8Array(W * W).fill(255);
  const queue = [];
  for (let j = 0; j < W * W; j++) {
    if (inA[j] !== seed) continue;
    dist[j] = 0;
    queue.push(j);
  }
  for (let i = 0; i < queue.length; i++) {
    const j = queue[i];
    const x = j % W;
    const y = (j - x) / W;
    const next = dist[j] + 1;
    const around = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of around) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
      const k = ny * W + nx;
      if (dist[k] <= next) continue;
      dist[k] = next;
      queue.push(k);
    }
  }
  return dist;
}

function distanceFields(fr) {
  const inA = new Uint8Array(W * W);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) inA[y * W + x] = insideFringe(fr, x, y) ? 1 : 0;
  }
  return { fromA: spread(inA, 1), fromB: spread(inA, 0) };
}

// A painter that only lets a pattern touch the pixels the fringe leaves it. The
// patterns paint with px/rect/hline/vline only, so a clip needs nothing more than
// those four, and a clipped pattern is painted by the same code and the same seed
// as the base tile: the a part of a transition is the a tile, never a re-shading.
function clipped(target, allow) {
  const out = {
    w: target.w,
    h: target.h,
    px(x, y, color) {
      if (allow(Math.round(x), Math.round(y))) target.px(x, y, color);
      return out;
    },
    rect(x, y, w, h, color) {
      x = Math.round(x);
      y = Math.round(y);
      w = Math.round(w);
      h = Math.round(h);
      const x1 = Math.min(target.w, x + w);
      const y1 = Math.min(target.h, y + h);
      for (let j = Math.max(0, y); j < y1; j++) {
        for (let i = Math.max(0, x); i < x1; i++) if (allow(i, j)) target.px(i, j, color);
      }
      return out;
    },
    hline(x, y, w, color) {
      return out.rect(x, y, w, 1, color);
    },
    vline(x, y, h, color) {
      return out.rect(x, y, 1, h, color);
    },
  };
  return out;
}

// The braid: a's own marks cross the line into b and b's grit shows just inside a,
// so the two grounds meet instead of butting. One pixel of overhang either way and
// a tuft two pixels in: never enough to become a rim.
function interlock(p, sa, sb, fields, salt) {
  const aMark = sa.detail[0];
  const aLite = sa.accent ?? sa.detail[sa.detail.length - 1];
  const bMark = sb.detail[0];
  const { fromA, fromB } = fields;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const j = y * W + x;
      const h = hash32(x, y, salt);
      const out = fromA[j];
      if (out === 1) {
        // a's fleck on the last pixel of b, and a lite tuft one pixel deeper
        if (h % 5 === 0) p.px(x, y, aMark);
        else if (h % 13 === 0) p.px(x, y, aLite);
      } else if (out === 2) {
        if (h % 9 === 0) p.px(x, y, aLite);
      } else if (out === 0 && fromB[j] === 1 && h % 11 === 0) {
        // b's grit just inside a, on the boundary pixels only
        p.px(x, y, bMark);
      }
    }
  }
}

// The paving/asphalt curb: the asphalt keeps two pixels up to the kerb, the kerb
// throws a shadow into them, and the paving's edge becomes a stone lip. Lit top
// over a mid face over a dark seam, with the shadow outside it, is what reads as a
// step; a change of colour alone reads as a change of colour. The lip is measured
// from the asphalt, so it mitres round a corner and stops where the asphalt does.
function paintCurb(p, sb, fr, fields) {
  const lipTop = mix(C.stoneLite, C.white, 0.32);
  const lipFace = mix(C.stoneLite, C.stone, 0.2);
  const seam = mix(C.slate, C.stone, 0.45);
  const shadow = mix(sb.base, C.ink, 0.6);
  const tone = [null, lipTop, lipFace, seam];
  const { fromA, fromB } = fields;
  // A pocket is a bite of asphalt into the paving, which in the street is a dropped
  // kerb: it gets the shadow of the kerb and no lip, because a lip there would fill
  // the bite with stone.
  const lipped = SIDES.some((side) => fr.reach[side]);
  const lip = new Uint8Array(W * W);
  if (lipped) {
    for (let j = 0; j < W * W; j++) if (fromB[j] >= 1 && fromB[j] <= 3) lip[j] = fromB[j];
  }
  const atLip = (x, y) => (x < 0 || y < 0 || x >= W || y >= W ? 0 : lip[y * W + x]);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const j = y * W + x;
      if (fromA[j] === 1) p.px(x, y, shadow);
      if (!lip[j]) continue;
      // An end of the kerb is a cut stone, not a lit face: darken the cap so the band
      // reads as a machined block and not as a painted line.
      const ends = atLip(x - 1, y) + atLip(x + 1, y) + atLip(x, y - 1) + atLip(x, y + 1);
      p.px(x, y, ends < 2 ? seam : tone[lip[j]]);
    }
  }
}

// The water bank: the water darkens where the bank hangs over it and a single pale
// pixel carries the waterline, so the shore reads wet instead of cut out. The pale
// line is the whole waterline, around the corners and inside the pockets too, and
// the dark edge falls off over two steps so the bank has depth instead of an
// outline. The wet tones come from the water's own body, so a shore never re-shades
// the surface it borders.
function paintShore(p, sb, fields) {
  const wet = mix(sb.base, C.waterDeep, 0.45);
  const wetSoft = mix(sb.base, C.waterDeep, 0.2);
  // the one pale pixel of the waterline: waterLite lifted towards white, so it reads
  // as the surface catching the sky and not as a cut paper edge
  const line = mix(C.waterLite, C.white, 0.25);
  const { fromA } = fields;
  for (let j = 0; j < W * W; j++) {
    const d = fromA[j];
    if (d === 0 || d === 255) continue;
    const x = j % W;
    const y = (j - x) / W;
    if (d === 1) p.px(x, y, line);
    else if (d === 2) p.px(x, y, wet);
    else if (d === 3) p.px(x, y, wetSoft);
  }
}

// The geometry of one mask, for the check and for the gallery. A copy, so a caller
// cannot move a tile by writing to it.
export function transitionFringe(a, b, mask) {
  const fr = fringeOf(a, b, mask);
  const sides = {};
  for (const side of SIDES) sides[side] = fr.reach[side] ? fr.reach[side].slice() : null;
  return { sides, pocket: fr.pocket, treatment: fr.treatment };
}

// Which pixels of a transition tile are the second ground, as a 16x16 map. The bank
// geometry is the same one the tile was painted from, so the check can say "the land
// did not move" about exactly the pixels that are land, and a compositor does not
// have to guess where a shore ends.
export function transitionWaterRegion(a, b, mask) {
  const fr = fringeOf(a, b, mask);
  const { fromA } = distanceFields(fr);
  const out = new Uint8Array(W * W);
  for (let i = 0; i < W * W; i++) out[i] = fromA[i] === 0 || fromA[i] === 255 ? 0 : 1;
  return out;
}

// Which way the water of a transition runs. The direction follows the bank and not
// the material: water beside a north or south bank runs east-west, so the crest is
// across it, and the crest then crosses the thin strip of water a bank leaves in
// every frame instead of running along it. A pocket is a corner bite and takes the
// horizontal crest.
function bankDir(mask) {
  const shape = MASK_SHAPES[mask];
  if (!shape) throw new Error(`unknown transition mask: ${mask}`);
  if (shape.pocket) return 'h';
  if (shape.n || shape.s) return 'h';
  if (shape.e || shape.w) return 'v';
  return 'h';
}

// The waterline is water, and on a bank it is usually the only water the tile shows:
// a glint painted underneath the pale line would never be seen at all. So the line
// carries the motion too — a travelling bright segment for a current, an in-place
// twinkle for a pond — and the crest of the surface does the rest in whatever depth
// the fringe leaves open. Every frame changes the line, which is what makes the four
// frames of a shore four different tiles on every mask, pockets included.
function paintShoreGlint(p, sb, fields, frame, dir, offset) {
  const { fromA } = fields;
  const frames = sb.frames ?? 4;
  const line = mix(C.waterLite, C.white, 0.25);
  const pour = mix(line, C.white, 0.6);
  const levels = [line, mix(line, C.white, 0.25), mix(line, C.waterLite, 0.3), pour];
  // the waterline pixels in flow order: whatever shape the bank has, a straight edge,
  // a corner or a four-pixel pocket, the glint walks along it
  const pts = [];
  for (let j = 0; j < W * W; j++) {
    if (fromA[j] !== 1) continue;
    const x = j % W;
    const y = (j - x) / W;
    pts.push(dir === 'v' ? [x, y, y, x] : [x, y, x, y]);
  }
  if (!pts.length) return;
  pts.sort((a, b) => a[2] - b[2] || a[3] - b[3]);
  if (sb.flow === 'current') {
    const n = pts.length;
    const start = Math.round((frame * n) / frames) + offset;
    const width = Math.max(2, Math.round(n / 8));
    for (let i = 0; i < n; i++) {
      if (((i - start) % n + n) % n < width) p.px(pts[i][0], pts[i][1], pour);
    }
    return;
  }
  // a pond twinkles in place: the pixel keeps its anchor and only its brightness
  // changes, and the four levels are one step apart so it never sits still
  for (const [x, y] of pts) {
    const age = (frame + (hash32(x, y, sb.salt ^ 0x7a3) % frames)) % frames;
    if (age) p.px(x, y, levels[age]);
  }
}

// One 16x16 tile: `b` underneath, `a` over it through the fringe. Four variants per
// pair; a material with fewer wraps inside that cycle, so any pair works whatever
// variant counts its materials declare. When `b` is water the b layer is painted at
// the frame the caller asks for, and only that layer hears about it: the a layer, the
// braid and the shore are frame-independent, which is what makes the land beside an
// animated shore pixel-identical across the four frames (S4).
//
// The frame part of the water is painted last, clipped to the water the fringe leaves
// open, because the shore's wet edge covers most of the one-to-four pixels a bank
// shows: a crest painted under it would be invisible on every land tile of a stream.
export function transitionTile(a, b, mask, variant = 0, frame = 0) {
  const sa = specOf(a);
  const sb = specOf(b);
  if (!MASK_SHAPES[mask]) throw new Error(`unknown transition mask: ${mask}`);
  const v = ((Math.round(variant) % 4) + 4) % 4;
  // A land pair has one frame, so a caller that passes a frame cannot multiply the
  // tile count by four; only the water side of a shore moves.
  const at = sb.flow ? wrapFrame(b, frame) : 0;
  const dir = bankDir(mask);
  return cacheSprite(cache, `transition|${a}>${b}|${mask}|${v}|${at}`, () => {
    const p = new Painter(W, W);
    if (sb.flow) paintWaterBody(p, makeRng(variantSeed(sb, v % sb.variants)), sb, v % sb.variants, dir);
    else paintLayer(p, sb, v % sb.variants);
    const fr = fringeOf(a, b, mask);
    paintLayer(p, sa, v % sa.variants, (x, y) => insideFringe(fr, x, y));
    const fields = distanceFields(fr);
    // The braid goes on top of a shore, so a blade of a overhangs the waterline;
    // it goes under a kerb, because a kerb is stone and nothing grows across it.
    if (fr.treatment === 'shore') paintShore(p, sb, fields);
    interlock(p, sa, sb, fields, hash32(sa.salt, sb.salt, 7919));
    if (fr.treatment === 'curb') paintCurb(p, sb, fr, fields);
    if (sb.flow) {
      // the surface below the wet edge: depth 0 is land and depth 1 is the pale line,
      // which the shore glint owns
      const deeper = (x, y) => fields.fromA[y * W + x] >= 2;
      paintWaterFrame(clipped(p, deeper), sb, v % sb.variants, dir, at);
      paintShoreGlint(p, sb, fields, at, dir, (v % sb.variants) * 3);
    }
    return p.sprite();
  });
}

// A blob of `a` in a field of `b`, as booleans. Lobed rather than round, and with
// one bay bitten out of its east flank: the bay is there on purpose, because a
// diagonal step is the only place a smooth blob needs an inner corner, and the
// sample patch is meant to prove those close.
function blobGrid(w, h, seed, saltA, saltB) {
  const r = makeRng(hash32(saltA, saltB, Math.round(seed) * 7919 + 11));
  const cx = (w - 1) / 2 + (r.next() - 0.5) * 1.2;
  const cy = (h - 1) / 2 + (r.next() - 0.5) * 0.8;
  const rx = Math.max(1.6, w * (0.34 + r.next() * 0.07));
  const ry = Math.max(1.4, h * (0.33 + r.next() * 0.07));
  const p1 = r.next() * TAU;
  const p2 = r.next() * TAU;
  const bayX = cx + rx * 0.85;
  const bayY = cy + (r.next() - 0.5) * ry * 0.6;
  const bayR = 1.2 + r.next() * 0.5;
  const grid = [];
  for (let ty = 0; ty < h; ty++) {
    const row = [];
    for (let tx = 0; tx < w; tx++) {
      const dx = (tx - cx) / rx;
      const dy = (ty - cy) / ry;
      const ang = Math.atan2(dy, dx);
      const lobed = 1 + 0.14 * Math.sin(3 * ang + p1) + 0.08 * Math.sin(5 * ang + p2);
      let inside = dx * dx + dy * dy <= lobed * lobed;
      if (inside && Math.hypot(tx - bayX, ty - bayY) < bayR) inside = false;
      row.push(inside);
    }
    grid.push(row);
  }
  // A shape the reduced set cannot draw (a one-tile channel, a one-tile finger, a
  // one-tile island) is pruned out of the blob instead of being folded onto a tile
  // that would lie about it: the sample only ever asks for the nine neighbour
  // counts the thirteen pieces can answer honestly.
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? false : grid[y][x]);
  const bitsAt = (x, y) =>
    (!at(x, y - 1) ? 1 : 0) | (!at(x + 1, y) ? 2 : 0) | (!at(x, y + 1) ? 4 : 0) | (!at(x - 1, y) ? 8 : 0);
  const drawable = () => {
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) if (grid[ty][tx] && !DRAWABLE_BITS.has(bitsAt(tx, ty))) return false;
    }
    return true;
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        if (!grid[ty][tx] || DRAWABLE_BITS.has(bitsAt(tx, ty))) continue;
        grid[ty][tx] = false;
        changed = true;
      }
    }
  }
  // One diagonal step, cut on purpose. A smooth blob has none, and the step is the
  // only place a pocket is needed, so without it the sample could show a set of
  // tiles that never meets the concave ones. It is cut out of the top row of the
  // blob, walking in from the top-right corner, and only taken where it leaves the
  // blob drawable: the sample proves the tiles it has, it does not invent shapes
  // they cannot answer.
  let y0 = -1;
  for (let ty = 0; ty < h && y0 < 0; ty++) if (grid[ty].includes(true)) y0 = ty;
  if (y0 >= 0) {
    let xa = -1;
    for (let tx = 0; tx < w; tx++) if (grid[y0][tx]) xa = tx;
    const stepped = y0 + 1 < h && xa + 1 < w && grid[y0 + 1][xa + 1];
    if (!stepped) {
      for (let tx = xa; tx > 0; tx--) {
        if (!grid[y0][tx]) continue;
        grid[y0][tx] = false;
        if (drawable()) break;
        grid[y0][tx] = true;
      }
    }
  }
  return grid;
}

// The mask a cell of the blob needs, from its own four sides and four diagonals.
// Outside the patch counts as b, so the blob is an island and every bank it has is
// inside the sample.
function cellMask(grid, tx, ty) {
  const w = grid[0].length;
  const h = grid.length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? false : grid[y][x]);
  let bits = 0;
  let diag = 0;
  if (!at(tx, ty - 1)) bits |= 1;
  if (!at(tx + 1, ty)) bits |= 2;
  if (!at(tx, ty + 1)) bits |= 4;
  if (!at(tx - 1, ty)) bits |= 8;
  if (!at(tx + 1, ty - 1)) diag |= 1;
  if (!at(tx + 1, ty + 1)) diag |= 2;
  if (!at(tx - 1, ty + 1)) diag |= 4;
  if (!at(tx - 1, ty - 1)) diag |= 8;
  return { mask: transitionMask(bits, diag), bits, diagonals: diag };
}

// The composed sample: every a cell picks its tile from its own neighbourhood, so
// the corners have to close by construction and the patch is the proof. A cell of
// b stays a plain b tile: the bank of a b cell is drawn by the a cell next to it,
// which is why no seam is ever drawn twice.
export function transitionCells(a, b, tilesW = 10, tilesH = 6, seed = 0) {
  const sa = specOf(a);
  const sb = specOf(b);
  const w = Math.max(1, Math.round(tilesW));
  const h = Math.max(1, Math.round(tilesH));
  const field = Math.round(seed);
  const grid = blobGrid(w, h, field, sa.salt, sb.salt);
  const cells = [];
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const isA = grid[ty][tx];
      const shape = isA ? cellMask(grid, tx, ty) : { mask: null, bits: 0, diagonals: 0 };
      cells.push({
        tx,
        ty,
        a: isA,
        mask: shape.mask,
        bits: shape.bits,
        diagonals: shape.diagonals,
        variant: terrainCell(isA ? a : b, tx, ty, field),
      });
    }
  }
  return cells;
}

export function transitionPatch(a, b, tilesW = 10, tilesH = 6, seed = 0) {
  specOf(a);
  specOf(b);
  const w = Math.max(1, Math.round(tilesW));
  const h = Math.max(1, Math.round(tilesH));
  const field = Math.round(seed);
  return cacheSprite(cache, `transition-patch|${a}>${b}|${w}x${h}|${field}`, () => {
    const p = new Painter(w * W, h * W);
    for (const cell of transitionCells(a, b, w, h, field)) {
      const spr = cell.mask ? transitionTile(a, b, cell.mask, cell.variant) : terrainTile(b, cell.variant);
      p.blit(spr, cell.tx * W, cell.ty * W);
    }
    return p.sprite();
  });
}

// The pairs the catalogue curates, in gallery order, dominant material first. The
// list says which pairs the town actually has; the system stays generic and would
// paint any two materials the same way. Nine of them, and the two gallery pages show
// the first eight: a page holds four pairs in a 2x2 block and a third pair page would
// move the water and the decals down a page, so the ninth pair (the card's plaza on
// the dirt track) is curated and baked without a page of its own.
export const TRANSITION_PAIRS = [
  ['grass', 'dirt'],
  ['grass', 'paving'],
  ['paving', 'asphalt'],
  ['asphalt', 'dirt'],
  ['grass', 'water'],
  ['plaza', 'water'],
  ['rock', 'water'],
  ['dirt', 'gravel'],
  // Trial pair: a raised stone plaza meeting the asphalt road, so the card can show the
  // buildings' sidewalk, the kerb, the road and the square in one cross-section.
  ['plaza', 'asphalt'],
  ['plaza', 'grass'],
  // The card's own pair (T5): the stone plaza sits in the dirt track, and until the
  // plaza was baked from the catalogue nothing had ever asked for that seam. It is
  // appended, not inserted, so the two gallery pages of pairs keep the eight pairs
  // they already show, pixel for pixel.
  ['plaza', 'dirt'],
];

const PAIRS_PER_PAGE = 4;

// A pair names itself, so the gallery is a loop over data and a tenth pair would
// need no layout work.
export function transitionPairLabel(pair) {
  return `${String(pair[0]).toUpperCase()} / ${String(pair[1]).toUpperCase()}`;
}

// Gallery pagination: six materials per page, the natural grounds first, then the
// transition sets two pages deep, and the water last with a page of its own. A page
// says what it holds, so a page of pairs is never laid out as a page of materials
// and a page of water is never laid out as a strip of variants.
export const TERRAIN_PAGE_SIZE = 6;

export const TERRAIN_PAGES = [
  { kind: 'materials', title: 'NATURAL GROUND', items: ['grass', 'grassDry', 'dirt', 'gravel', 'clay', 'rock'] },
  { kind: 'materials', title: 'SCRUB AND THE STREET', items: ['scrub', 'asphalt', 'paving', 'concrete', 'cobble', 'plaza'] },
  { kind: 'pairs', title: 'GROUND MEETS GROUND', items: TRANSITION_PAIRS.slice(0, PAIRS_PER_PAGE) },
  { kind: 'pairs', title: 'BANKS AND KERBS', items: TRANSITION_PAIRS.slice(PAIRS_PER_PAGE, PAIRS_PER_PAGE * 2) },
  { kind: 'water', title: 'WATER, BANKS AND REEDS', items: ['water', 'waterStill'] },
  // The decals are not grounds, so the page says so: its items are decal kinds and
  // the gallery paints them as overlays, never as a floor.
  { kind: 'decals', title: 'GROUND DRESSING', items: decalKinds() },
];
