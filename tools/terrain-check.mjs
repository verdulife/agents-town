// Terrain catalogue invariants. Spec + hash + sprite geometry + pixels:
//   node tools/terrain-check.mjs
//
// The palette rule and the "no colour literal" rule are checked from the source
// text, because that is the only place a literal could sneak back in. The animation
// rules are checked from finished pixels: a band that moved and a land row that did
// not cannot be told apart by sprite identity.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// --- a rasterising canvas stub ---------------------------------------------
// Painter only needs fillRect, drawImage and the two ImageData calls, so a small
// RGBA buffer is enough to have the real pixels in hand. Everything the catalogue
// promises about water is a statement about those pixels.

const COLOR_CACHE = new Map();

function cssColor(css) {
  const key = String(css);
  const hit = COLOR_CACHE.get(key);
  if (hit) return hit;
  let out = [0, 0, 0, 255];
  if (key[0] === '#') {
    const h = key.slice(1);
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    out = h.length === 3
      ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 255]
      : [n(0), n(2), n(4), h.length === 8 ? n(6) : 255];
  } else {
    const m = key.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(',').map((v) => Number(v.trim()));
      out = [p[0] | 0, p[1] | 0, p[2] | 0, Math.round((p[3] ?? 1) * 255)];
    }
  }
  COLOR_CACHE.set(key, out);
  return out;
}

class RasterCanvas {
  constructor() {
    this._w = 1;
    this._h = 1;
    this.data = new Uint8ClampedArray(4);
    this._ctx = null;
  }
  get width() {
    return this._w;
  }
  set width(v) {
    this._alloc(Math.max(1, Math.round(v)), this._h);
  }
  get height() {
    return this._h;
  }
  set height(v) {
    this._alloc(this._w, Math.max(1, Math.round(v)));
  }
  _alloc(w, h) {
    if (w === this._w && h === this._h) return;
    this._w = w;
    this._h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  getContext() {
    if (!this._ctx) this._ctx = new RasterContext(this);
    return this._ctx;
  }
}

class RasterContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.imageSmoothingEnabled = false;
  }
  save() {}
  restore() {}
  setTransform() {}
  translate() {}
  scale() {}
  clearRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  fill() {}
  stroke() {}
  strokeRect() {}
  createLinearGradient() {
    return { addColorStop() {} };
  }
  createRadialGradient() {
    return { addColorStop() {} };
  }
  _blend(x, y, color) {
    const cv = this.canvas;
    if (x < 0 || y < 0 || x >= cv._w || y >= cv._h) return;
    const d = cv.data;
    const i = (y * cv._w + x) * 4;
    const a = color[3] / 255;
    if (a >= 1) {
      d[i] = color[0];
      d[i + 1] = color[1];
      d[i + 2] = color[2];
      d[i + 3] = 255;
      return;
    }
    d[i] = color[0] * a + d[i] * (1 - a);
    d[i + 1] = color[1] * a + d[i + 1] * (1 - a);
    d[i + 2] = color[2] * a + d[i + 2] * (1 - a);
    d[i + 3] = Math.max(d[i + 3], color[3]);
  }
  fillRect(x, y, w, h) {
    const color = cssColor(this.fillStyle);
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = x0 + Math.round(w);
    const y1 = y0 + Math.round(h);
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) this._blend(i, j, color);
  }
  // 1:1 and scaled blits, nearest neighbour like the renderer
  drawImage(img, dx, dy, dw, dh) {
    const src = img;
    const sw = src.width;
    const sh = src.height;
    const w = Math.max(1, Math.round(dw ?? sw));
    const h = Math.max(1, Math.round(dh ?? sh));
    const x0 = Math.round(dx);
    const y0 = Math.round(dy);
    for (let j = 0; j < h; j++) {
      const sy = Math.min(sh - 1, Math.floor((j * sh) / h));
      for (let i = 0; i < w; i++) {
        const sx = Math.min(sw - 1, Math.floor((i * sw) / w));
        const k = (sy * sw + sx) * 4;
        this._blend(x0 + i, y0 + j, [src.data[k], src.data[k + 1], src.data[k + 2], src.data[k + 3]]);
      }
    }
  }
  getImageData(x, y, w, h) {
    const width = Math.max(1, Math.round(w));
    const height = Math.max(1, Math.round(h));
    const out = new Uint8ClampedArray(width * height * 4);
    const cv = this.canvas;
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const sx = Math.round(x) + i;
        const sy = Math.round(y) + j;
        if (sx < 0 || sy < 0 || sx >= cv._w || sy >= cv._h) continue;
        const s = (sy * cv._w + sx) * 4;
        const d = (j * width + i) * 4;
        out[d] = cv.data[s];
        out[d + 1] = cv.data[s + 1];
        out[d + 2] = cv.data[s + 2];
        out[d + 3] = cv.data[s + 3];
      }
    }
    return { data: out, width, height };
  }
  putImageData(img, x, y) {
    const cv = this.canvas;
    for (let j = 0; j < img.height; j++) {
      for (let i = 0; i < img.width; i++) {
        const s = (j * img.width + i) * 4;
        this._blend(Math.round(x) + i, Math.round(y) + j, [img.data[s], img.data[s + 1], img.data[s + 2], img.data[s + 3]]);
      }
    }
  }
}

globalThis.document = {
  createElement(tag) {
    if (String(tag).toLowerCase() !== 'canvas') throw new Error(`raster stub: unexpected element <${tag}>`);
    return new RasterCanvas();
  },
};

// --- pixel helpers ---------------------------------------------------------

// A stable hash of a whole sprite, alpha included: two frames that differ in one
// pixel differ here.
function pixelHash(spr) {
  const d = spr.canvas.data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) {
    h ^= d[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pixelAt(spr, x, y) {
  const d = spr.canvas.data;
  const i = (y * spr.canvas.width + x) * 4;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]].join(',');
}

const rgbaOf = (hex) => cssColor(hex);
const {
  TERRAIN,
  TERRAIN_PAGES,
  TERRAIN_PAGE_SIZE,
  terrainKinds,
  terrainTile,
  terrainAt,
  terrainCell,
  terrainPatch,
  transitionTile,
  transitionMask,
  transitionFringe,
  transitionCells,
  transitionPatch,
  transitionTreatment,
  transitionPairLabel,
  transitionWaterRegion,
  TRANSITION_MASKS,
  TRANSITION_PAIRS,
  waterTile,
  waterPatch,
  waterFrames,
  WATER_FPS,
  frameIndex,
  cellFrame,
  reedTile,
  reedKinds,
  DECALS,
  decalKinds,
  decalSheet,
  decalTile,
  decalFrames,
  decalAt,
  decalDressing,
} = await import('../src/next/terrain.js');
const { TILE } = await import('../src/next/art-spec.js');
const { C } = await import('../src/palette.js');

// Every pixel of a sprite as strings, row by row: what "the same pixels" means.
function pixelGrid(spr) {
  const out = [];
  for (let y = 0; y < spr.h; y++) {
    const row = [];
    for (let x = 0; x < spr.w; x++) row.push(pixelAt(spr, x, y));
    out.push(row);
  }
  return out;
}


let failures = 0;
let checks = 0;

function check(name, fn) {
  checks++;
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, '..', 'src', 'next', 'terrain.js');

// The catalogue, in the order it lists them: the twelve grounds of T1 and T2, then
// the two waters T3 promoted into first-class materials. Fourteen, not the thirteen
// the task text says: water and waterStill are both required grounds, so the honest
// count is 12 + 2 and the check pins it rather than rounding it.
const ORDER = [
  'grass',
  'grassDry',
  'dirt',
  'gravel',
  'clay',
  'rock',
  'scrub',
  'asphalt',
  'paving',
  'concrete',
  'cobble',
  'plaza',
  'water',
  'waterStill',
];
const GROUNDS = ORDER.length;

const FIELD_W = 24;
const FIELD_H = 16;

console.log('terrain check\n');

// --- a) the materials ------------------------------------------------------

check('fourteen materials: the twelve grounds and the two waters', () => {
  const kinds = terrainKinds();
  assert(kinds.length === GROUNDS, `${kinds.length} materials, expected ${GROUNDS}`);
  assert(kinds.join(',') === ORDER.join(','), `order is ${kinds.join(',')}`);
  assert(Object.keys(TERRAIN).length === GROUNDS, 'TERRAIN and terrainKinds() disagree');
});

check('every material carries a complete spec', () => {
  for (const kind of terrainKinds()) {
    const spec = TERRAIN[kind];
    assert(typeof spec.label === 'string' && spec.label.length > 0, `${kind} has no label`);
    assert(typeof spec.base === 'string' && /^#[0-9a-f]{6}$/.test(spec.base), `${kind} has no base colour`);
    assert(Array.isArray(spec.detail) && spec.detail.length >= 1, `${kind} has no detail colours`);
    for (const color of spec.detail) {
      assert(/^#[0-9a-f]{6}$/.test(color), `${kind} detail colour ${color} is not a palette hex`);
    }
    assert(typeof spec.pattern === 'string' && spec.pattern.length > 0, `${kind} has no pattern name`);
    assert(Number.isInteger(spec.variants) && spec.variants >= 2, `${kind} declares ${spec.variants} variants`);
    assert(spec.group === 'natural' || spec.group === 'urban', `${kind} has no group`);
  }
});

check('every variant is a 16x16 sprite', () => {
  for (const kind of terrainKinds()) {
    const spec = TERRAIN[kind];
    for (let v = 0; v < spec.variants; v++) {
      const spr = terrainTile(kind, v);
      assert(spr.w === TILE && spr.h === TILE, `${kind}/${v} is ${spr.w}x${spr.h}, expected ${TILE}x${TILE}`);
      assert(spr.canvas && spr.canvas.width === TILE && spr.canvas.height === TILE, `${kind}/${v} canvas is not ${TILE}px`);
    }
  }
});

check('a tile is painted once and cached', () => {
  for (const kind of terrainKinds()) {
    assert(terrainTile(kind, 0) === terrainTile(kind, 0), `${kind}: the same tile was painted twice`);
  }
});

check('out of range variants wrap instead of throwing', () => {
  for (const kind of terrainKinds()) {
    const n = TERRAIN[kind].variants;
    assert(terrainTile(kind, n) === terrainTile(kind, 0), `${kind}: variant ${n} is not variant 0`);
    assert(terrainTile(kind, -1) === terrainTile(kind, n - 1), `${kind}: variant -1 is not variant ${n - 1}`);
  }
});

check('unknown materials fail loudly', () => {
  for (const fn of [() => terrainTile('lava', 0), () => terrainAt('lava', 0, 0), () => terrainPatch('lava', 2, 2, 0)]) {
    let message = '';
    try {
      fn();
    } catch (err) {
      message = err.message;
    }
    assert(/unknown terrain material/.test(message), `unknown material gave "${message}"`);
  }
});

// --- b) the variant picker -------------------------------------------------

check('terrainAt stays in range and never moves', () => {
  for (const kind of terrainKinds()) {
    const n = TERRAIN[kind].variants;
    for (let ty = 0; ty < FIELD_H; ty++) {
      for (let tx = 0; tx < FIELD_W; tx++) {
        const v = terrainAt(kind, tx, ty);
        assert(Number.isInteger(v) && v >= 0 && v < n, `${kind} at ${tx},${ty} is variant ${v}, out of 0..${n - 1}`);
        assert(terrainAt(kind, tx, ty) === v, `${kind} at ${tx},${ty} changed between calls`);
      }
    }
  }
  // negative coordinates are part of the world too
  for (const kind of terrainKinds()) {
    const n = TERRAIN[kind].variants;
    const v = terrainAt(kind, -7, -3);
    assert(v >= 0 && v < n, `${kind} at -7,-3 is variant ${v}`);
    assert(terrainAt(kind, -7, -3) === v, `${kind} at -7,-3 changed between calls`);
  }
});

check('no 2x2 block repeats a variant in a 24x16 field', () => {
  // The variant grid has a two-cell structure: a block picks its base and hands its
  // four cells consecutive variants. So the block is the aligned 2x2 window: with
  // four variants or more its four cells are all different, which is the strongest
  // a block can be. With three variants a block holds four cells and one value has
  // to repeat (pigeonhole), so the rule the material can honour is the next one
  // down: the repeat sits on a diagonal and no two touching cells ever share a
  // variant.
  for (const kind of terrainKinds()) {
    const n = TERRAIN[kind].variants;
    for (let ty = 0; ty + 1 < FIELD_H; ty += 2) {
      for (let tx = 0; tx + 1 < FIELD_W; tx += 2) {
        const a = terrainAt(kind, tx, ty);
        const b = terrainAt(kind, tx + 1, ty);
        const c = terrainAt(kind, tx, ty + 1);
        const d = terrainAt(kind, tx + 1, ty + 1);
        const block = [a, b, c, d];
        const where = `${kind} block at ${tx},${ty} = [${block.join(',')}]`;
        assert(a !== b && a !== c && b !== d && c !== d, `${where}: two touching cells share a variant`);
        if (n >= 4) assert(new Set(block).size === 4, `${where}: a block repeats a variant`);
        else if (n === 3) assert(new Set(block).size === 3, `${where}: three of a kind`);
      }
    }
  }
});

check('no variant runs for more than two cells along a row or a column', () => {
  // A row alternates slots, so a run of three is impossible by construction; the
  // check pins that, because a run is what a repeat looks like from up close.
  for (const kind of terrainKinds()) {
    for (let ty = 0; ty < FIELD_H; ty++) {
      let run = 1;
      for (let tx = 1; tx < FIELD_W; tx++) {
        run = terrainAt(kind, tx, ty) === terrainAt(kind, tx - 1, ty) ? run + 1 : 1;
        assert(run <= 2, `${kind} row ${ty}: ${run} cells in a row share a variant`);
      }
    }
    for (let tx = 0; tx < FIELD_W; tx++) {
      let run = 1;
      for (let ty = 1; ty < FIELD_H; ty++) {
        run = terrainAt(kind, tx, ty) === terrainAt(kind, tx, ty - 1) ? run + 1 : 1;
        assert(run <= 2, `${kind} column ${tx}: ${run} cells in a column share a variant`);
      }
    }
  }
});

check('a whole 2x2 window of one tile stays rare', () => {
  // Windows off the block grid can close on one variant, because the blocks they
  // straddle pick their bases independently. A tile has no rim, so such a window
  // reads as a slightly larger version of the same texture rather than as a tile
  // repeated four times; what matters is that it is the exception, not the pattern.
  for (const kind of terrainKinds()) {
    let repeats = 0;
    let windows = 0;
    for (let ty = 0; ty + 1 < FIELD_H; ty++) {
      for (let tx = 0; tx + 1 < FIELD_W; tx++) {
        const block = [terrainAt(kind, tx, ty), terrainAt(kind, tx + 1, ty), terrainAt(kind, tx, ty + 1), terrainAt(kind, tx + 1, ty + 1)];
        windows++;
        if (new Set(block).size === 1) repeats++;
      }
    }
    assert(repeats / windows < 0.03, `${kind}: ${repeats} of ${windows} windows are four copies of one tile`);
  }
});

check('a field does not look tiled: every variant is used, and unevenly', () => {
  for (const kind of terrainKinds()) {
    const n = TERRAIN[kind].variants;
    const counts = new Array(n).fill(0);
    for (let ty = 0; ty < FIELD_H; ty++) {
      for (let tx = 0; tx < FIELD_W; tx++) counts[terrainAt(kind, tx, ty)]++;
    }
    for (let v = 0; v < n; v++) assert(counts[v] > 0, `${kind} never uses variant ${v} in a 24x16 field`);
    const cells = FIELD_W * FIELD_H;
    for (let v = 0; v < n; v++) {
      const share = counts[v] / cells;
      assert(share > 1 / (n * 2.4) && share < 2.4 / n, `${kind} variant ${v} covers ${(share * 100).toFixed(0)}% of the field`);
    }
  }
});

// --- c) patches ------------------------------------------------------------

check('a patch is the size it was asked for', () => {
  for (const kind of terrainKinds()) {
    for (const [w, h] of [
      [1, 1],
      [8, 4],
      [13, 7],
    ]) {
      const patch = terrainPatch(kind, w, h, 1);
      assert(patch.w === w * TILE && patch.h === h * TILE, `${kind} ${w}x${h} patch is ${patch.w}x${patch.h}`);
      assert(patch.canvas.width === w * TILE && patch.canvas.height === h * TILE, `${kind} ${w}x${h} canvas is wrong`);
    }
  }
});

check('a patch is painted once per size and seed', () => {
  for (const kind of terrainKinds()) {
    assert(terrainPatch(kind, 8, 4, 1) === terrainPatch(kind, 8, 4, 1), `${kind}: the same patch was painted twice`);
  }
});

check('a patch is deterministic for a seed and moves with the seed', () => {
  const field = (kind, seed) => {
    const out = [];
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 8; tx++) out.push(terrainCell(kind, tx, ty, seed));
    return out.join(',');
  };
  for (const kind of terrainKinds()) {
    assert(field(kind, 1) === field(kind, 1), `${kind}: the same seed gave two fields`);
    assert(field(kind, 0) !== field(kind, 1), `${kind}: seed 1 paints the seed 0 field`);
    assert(field(kind, 1) !== field(kind, 2), `${kind}: seed 2 paints the seed 1 field`);
    // terrainAt is the unseeded field, so the bake and the gallery agree on seed 0
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 8; tx++) {
        assert(terrainCell(kind, tx, ty, 0) === terrainAt(kind, tx, ty), `${kind} at ${tx},${ty}: seed 0 moved`);
      }
    }
  }
});

check('a patch is painted once per seed', () => {
  for (const kind of terrainKinds()) {
    assert(terrainPatch(kind, 8, 4, 1) !== terrainPatch(kind, 8, 4, 2), `${kind}: seed 1 and 2 share a cached patch`);
  }
});

// --- d) palette only -------------------------------------------------------

check('no colour literal in the terrain module', () => {
  const text = readFileSync(SOURCE, 'utf8');
  const literals = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert(literals.length === 0, `${literals.length} colour literals: ${literals.slice(0, 5).join(' ')}`);
  // and nothing that would make a tile move between two runs
  for (const banned of ['Math.random(', 'Date.now(', 'performance.now(', 'new Date(']) {
    assert(!text.includes(banned), `terrain.js calls ${banned}`);
  }
});

// --- e) the gallery --------------------------------------------------------

// A page says what it holds, so the two kinds of page are checked apart: a page of
// materials has six grounds on it, a page of pairs has a set per pair.
const pagesOf = (kind) => TERRAIN_PAGES.filter((entry) => (entry.kind ?? 'materials') === kind);

check('the pages cover every material exactly once', () => {
  const seen = [];
  for (const entry of TERRAIN_PAGES) {
    assert(typeof entry.title === 'string' && entry.title.length > 0, 'a page has no title');
    assert(Array.isArray(entry.items), `page "${entry.title}" has no items`);
    // A page of pairs holds pairs and the decal page holds decal kinds, which are not
    // materials; both are checked in their own sections. The water page holds the two
    // water grounds and counts here.
    if (entry.kind === 'pairs' || entry.kind === 'decals') continue;
    seen.push(...entry.items);
  }
  assert(seen.length === GROUNDS, `the pages hold ${seen.length} materials`);
  assert(new Set(seen).size === GROUNDS, 'a material appears on two pages');
  for (const kind of terrainKinds()) assert(seen.includes(kind), `${kind} is on no page`);
});

check('six materials per page, no page overflows', () => {
  assert(TERRAIN_PAGE_SIZE === 6, `the page size is ${TERRAIN_PAGE_SIZE}`);
  for (const entry of pagesOf('materials')) {
    assert(entry.items.length === TERRAIN_PAGE_SIZE, `page "${entry.title}" holds ${entry.items.length}`);
  }
  for (const entry of pagesOf('pairs')) {
    assert(entry.items.length > 0 && entry.items.length <= 4, `page "${entry.title}" holds ${entry.items.length} pairs`);
  }
  const water = pagesOf('water');
  assert(water.length === 1, `${water.length} water pages, expected 1`);
  assert(water[0].items.join(',') === 'water,waterStill', `the water page holds ${water[0].items.join(',')}`);
});

check('the bases take two pages, in catalogue order, and the waters a third', () => {
  const base = pagesOf('materials');
  assert(base.length === 2, `${base.length} pages for 12 materials`);
  assert(base[0].items.concat(base[1].items).join(',') === ORDER.slice(0, 12).join(','), 'the pages reorder the catalogue');
  assert(ORDER.length === 14, `the catalogue lists ${ORDER.length} grounds`);
  const water = pagesOf('water')[0];
  assert(water.items.join(',') === ORDER.slice(12).join(','), 'the water page is not the last two grounds');
});

// --- f) transitions --------------------------------------------------------

// The pairs the catalogue curates, in gallery order, dominant ground first. Nine of
// them: the eight the gallery pages show and the card's own pair (plaza on the dirt
// track, appended by T5 when the floor was baked from the catalogue).
const PAIRS = [
  'grass>dirt',
  'grass>paving',
  'paving>asphalt',
  'asphalt>dirt',
  'grass>water',
  'plaza>water',
  'rock>water',
  'dirt>gravel',
  'plaza>asphalt',
  'plaza>grass',
  'plaza>dirt',
];
// A pair page is a 2x2 block, so the gallery shows eight of the curated pairs and the
// rest are curated without a page: a third pair page would move the water and the
// decals down.
const PAGED_PAIRS = 8;

const MASK_NAMES = ['fill', 'n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw', 'inNE', 'inNW', 'inSE', 'inSW'];
const STRAIGHTS = ['n', 'e', 's', 'w'];
const BLOCK_TILES = [10, 6];

check('thirteen masks, and the set is exactly the documented one', () => {
  assert(TRANSITION_MASKS.length === 13, `${TRANSITION_MASKS.length} masks, expected 13`);
  assert(new Set(TRANSITION_MASKS).size === 13, 'a mask is listed twice');
  assert(TRANSITION_MASKS.join(',') === MASK_NAMES.join(','), `masks are ${TRANSITION_MASKS.join(',')}`);
});

check('transitionMask is total over 0-15 and lands on the thirteen names', () => {
  const hit = new Set();
  for (let bits = 0; bits < 16; bits++) {
    const name = transitionMask(bits);
    assert(typeof name === 'string', `bits ${bits} gave ${name}`);
    assert(TRANSITION_MASKS.includes(name), `bits ${bits} gave "${name}", which is not a mask`);
    hit.add(name);
  }
  assert(transitionMask(0) === 'fill', `0 is ${transitionMask(0)}, expected the fill`);
  assert(transitionMask(1) === 'n' && transitionMask(2) === 'e', 'the single bits are not n and e');
  assert(transitionMask(4) === 's' && transitionMask(8) === 'w', 'the single bits are not s and w');
  assert(transitionMask(3) === 'ne' && transitionMask(9) === 'nw', 'the corners are not the corners');
  assert(transitionMask(6) === 'se' && transitionMask(12) === 'sw', 'the corners are not the corners');
  assert(hit.size === 13, `the mapping reaches ${hit.size} of the 13 names`);
  // and an out-of-range mask is not silently accepted
  assert(transitionMask(16) === transitionMask(0), 'bits above 15 are not folded back into four bits');
});

check('a diagonal of b on a cell that a surrounds gives the pocket mask', () => {
  // The only case four side bits cannot express, and the one the concave tiles
  // exist for: a's diagonal connection stays whole.
  const pockets = [transitionMask(0, 1), transitionMask(0, 2), transitionMask(0, 4), transitionMask(0, 8)];
  assert(pockets.join(',') === 'inNE,inSE,inSW,inNW', `diagonals gave ${pockets.join(',')}`);
  assert(transitionMask(0, 0) === 'fill', 'no diagonal should still be the fill');
  // a side that carries b keeps its straight tile whatever the diagonals say
  assert(transitionMask(1, 15) === 'n', 'a side mask was overridden by a diagonal');
});

check('the curated pairs are the catalogue pairs, in order', () => {
  assert(TRANSITION_PAIRS.length === PAIRS.length, `${TRANSITION_PAIRS.length} pairs, expected ${PAIRS.length}`);
  const keys = TRANSITION_PAIRS.map((pair) => pair.join('>'));
  assert(keys.join(',') === PAIRS.join(','), `pairs are ${keys.join(',')}`);
  for (const pair of TRANSITION_PAIRS) {
    assert(pair.length === 2, `${pair.join('>')} is not a pair`);
    assert(TERRAIN[pair[0]], `${pair[0]} is not a material`);
    assert(typeof transitionPairLabel(pair) === 'string' && transitionPairLabel(pair).length > 0, 'a pair has no label');
  }
  // the treatments follow from the materials, not from a flag on the pair
  assert(transitionTreatment('paving', 'asphalt') === 'curb', 'paving against asphalt is not the curb');
  for (const pair of TRANSITION_PAIRS) {
    if (pair[1] === 'water') assert(transitionTreatment(pair[0], pair[1]) === 'shore', `${pair.join('>')} is not a shore`);
  }
  assert(transitionTreatment('grass', 'dirt') === 'ground', 'a plain pair is not plain');
});

check('every curated pair yields thirteen tiles of 16x16', () => {
  for (const [a, b] of TRANSITION_PAIRS) {
    for (const mask of TRANSITION_MASKS) {
      const spr = transitionTile(a, b, mask, 0);
      assert(spr.w === TILE && spr.h === TILE, `${a}>${b} ${mask} is ${spr.w}x${spr.h}`);
      assert(spr.canvas.width === TILE && spr.canvas.height === TILE, `${a}>${b} ${mask} canvas is wrong`);
    }
    const set = new Set(TRANSITION_MASKS.map((mask) => transitionTile(a, b, mask, 0)));
    assert(set.size === 13, `${a}>${b} painted ${set.size} distinct tiles for 13 masks`);
  }
});

check('a transition tile is painted once and is deterministic', () => {
  for (const [a, b] of TRANSITION_PAIRS) {
    for (const mask of TRANSITION_MASKS) {
      const one = transitionTile(a, b, mask, 1);
      assert(one === transitionTile(a, b, mask, 1), `${a}>${b} ${mask} was painted twice`);
      assert(one !== transitionTile(a, b, mask, 2), `${a}>${b} ${mask}: variant 2 shares variant 1's tile`);
    }
  }
  // out of range variants wrap, like the base tiles do
  assert(transitionTile('grass', 'dirt', 'n', 4) === transitionTile('grass', 'dirt', 'n', 0), 'variant 4 is not variant 0');
  assert(transitionTile('grass', 'dirt', 'n', -1) === transitionTile('grass', 'dirt', 'n', 3), 'variant -1 is not variant 3');
});

check('the fringe exists on the masked sides and on no other', () => {
  for (const [a, b] of TRANSITION_PAIRS) {
    // the fill carries no fringe at all, and it is a different tile from every edge
    const fill = transitionFringe(a, b, 'fill');
    for (const side of STRAIGHTS) assert(fill.sides[side] === null, `${a}>${b} fill has a ${side} fringe`);
    assert(fill.pocket === null, `${a}>${b} fill has a pocket`);
    for (const side of STRAIGHTS) {
      const fr = transitionFringe(a, b, side);
      const reach = fr.sides[side];
      assert(reach && reach.length === TILE, `${a}>${b} ${side} has no ${side} fringe`);
      for (const other of STRAIGHTS) {
        if (other !== side) assert(fr.sides[other] === null, `${a}>${b} ${side} spills onto ${other}`);
      }
      // 1-4 px, never 0, so the fringe always lands on the border and mates with
      // the plain tile next door; and never one flat depth on the grounds that
      // paint an organic bank, so it is a bank and not a frame. The kerb is the
      // exception by design: it is machined, and its own check pins the straightness.
      let min = Infinity;
      let max = 0;
      for (const d of reach) {
        min = Math.min(min, d);
        max = Math.max(max, d);
      }
      assert(min >= 1, `${a}>${b} ${side}: the fringe pulls off the border (${min}px)`);
      assert(max <= 4, `${a}>${b} ${side}: the fringe is ${max}px deep`);
      if (transitionTreatment(a, b) === 'curb') assert(max === min, `${a}>${b} ${side}: the kerb line wanders (${min}-${max}px)`);
      else assert(max > min, `${a}>${b} ${side}: the fringe is a flat ${min}px line`);
      assert(transitionTile(a, b, side, 0) !== transitionTile(a, b, 'fill', 0), `${a}>${b} ${side} is the fill tile`);
    }
    // the concave masks are pockets and wear no side fringe
    for (const mask of TRANSITION_MASKS.filter((name) => name.startsWith('in'))) {
      const fr = transitionFringe(a, b, mask);
      assert(fr.pocket === mask.slice(2).toLowerCase(), `${a}>${b} ${mask} has pocket ${fr.pocket}`);
      for (const side of STRAIGHTS) assert(fr.sides[side] === null, `${a}>${b} ${mask} has a ${side} fringe`);
    }
  }
  // the two grounds of a pair are not interchangeable: the set of a over b is not
  // the set of b over a
  assert(transitionTile('grass', 'dirt', 'n', 0) !== transitionTile('dirt', 'grass', 'n', 0), 'the pair is symmetric');
});

check('the kerb and the shore are rules, not accidents', () => {
  for (const [a, b] of TRANSITION_PAIRS) {
    const fr = transitionFringe(a, b, 'n');
    const treatment = transitionTreatment(a, b);
    assert(fr.treatment === treatment, `${a}>${b} ${fr.treatment} is not ${treatment}`);
    if (treatment === 'curb') {
      // a kerb is machined: the asphalt band is the same depth all the way along
      assert(new Set(fr.sides.n).size === 1, `the curb line is not straight: ${Array.from(fr.sides.n).join(',')}`);
      assert(fr.sides.n[0] >= 2 && fr.sides.n[0] <= 3, `the curb keeps ${fr.sides.n[0]}px of asphalt`);
    } else {
      assert(new Set(fr.sides.n).size > 1, `${a}>${b}: a ${treatment} line is a straight line`);
    }
  }
});

check('the composed blob is deterministic and only uses the pair set', () => {
  const [w, h] = BLOCK_TILES;
  for (const [a, b] of TRANSITION_PAIRS) {
    const cells = transitionCells(a, b, w, h, 3);
    assert(cells.length === w * h, `${a}>${b} blob has ${cells.length} cells`);
    for (const cell of cells) {
      if (!cell.a) {
        assert(cell.mask === null, `${a}>${b} b cell at ${cell.tx},${cell.ty} carries ${cell.mask}`);
        continue;
      }
      assert(TRANSITION_MASKS.includes(cell.mask), `${a}>${b} uses "${cell.mask}", which is not in the set`);
      assert(Number.isInteger(cell.variant) && cell.variant >= 0 && cell.variant < 4, `${cell.mask} variant ${cell.variant}`);
    }
    const again = transitionCells(a, b, w, h, 3);
    assert(JSON.stringify(again) === JSON.stringify(cells), `${a}>${b}: the same seed gave two blobs`);
    const moved = transitionCells(a, b, w, h, 4);
    assert(JSON.stringify(moved) !== JSON.stringify(cells), `${a}>${b}: seed 4 paints the seed 3 blob`);
    const patch = transitionPatch(a, b, w, h, 3);
    assert(patch.w === w * TILE && patch.h === h * TILE, `${a}>${b} patch is ${patch.w}x${patch.h}`);
    assert(patch === transitionPatch(a, b, w, h, 3), `${a}>${b}: the same patch was painted twice`);
  }
});

check('the composed blob closes its corners: no fold, and real pockets', () => {
  // A blob of a in b may only ask the set for shapes it can draw. The masks that
  // fold are the ones a one-tile channel (b on two opposite sides), a one-tile
  // finger (b on three sides) or a one-tile island (b on four) would ask for, so a
  // cell may only carry 0, 1 or 2 adjacent sides. If one carried more, the sample
  // would be hiding a shape the set cannot draw instead of proving one it can.
  const DRAWABLE = new Set([0, 1, 2, 4, 8, 3, 6, 12, 9]);
  let pockets = 0;
  let corners = 0;
  for (const [a, b] of TRANSITION_PAIRS) {
    for (const cell of transitionCells(a, b, BLOCK_TILES[0], BLOCK_TILES[1], 3)) {
      if (!cell.a) continue;
      assert(DRAWABLE.has(cell.bits), `${a}>${b} at ${cell.tx},${cell.ty} asks for the folded mask ${cell.bits}`);
      const fr = transitionFringe(a, b, cell.mask);
      if (fr.pocket) pockets++;
      if (cell.bits === 3 || cell.bits === 6 || cell.bits === 12 || cell.bits === 9) corners++;
    }
  }
  // the gallery sample contains the convex corners and the diagonal step the
  // concave tiles exist for, so both kinds of corner are actually exercised
  assert(corners > 0, 'the gallery sample never asks for a convex corner');
  assert(pockets > 0, 'no concave mask appears in the gallery sample, so nothing proves a pocket closes');
});

check('the transition pages and the water page are appended in order', () => {
  const base = pagesOf('materials');
  const pairs = pagesOf('pairs');
  assert(TERRAIN_PAGES.length === 6, `${TERRAIN_PAGES.length} pages, expected 2 base, 2 transition, 1 water and 1 decals`);
  assert(TERRAIN_PAGES[0].kind === 'materials' && TERRAIN_PAGES[1].kind === 'materials', 'the bases are no longer pages 0 and 1');
  assert(pairs.length === 2, `${pairs.length} transition pages, expected 2`);
  assert(TERRAIN_PAGES.indexOf(pairs[0]) === base.length, 'the transition pages are not appended after the bases');
  assert(TERRAIN_PAGES[4].kind === 'water', 'the water page is not page 5');
  const seen = pairs.flatMap((entry) => entry.items.map((pair) => pair.join('>')));
  assert(seen.join(',') === PAIRS.slice(0, PAGED_PAIRS).join(','), `the pair pages hold ${seen.join(',')}`);
  assert(new Set(seen).size === PAGED_PAIRS, 'a pair appears on two pages');
  // the rest are curated without a page of their own, and the card bakes them anyway
  assert(PAIRS.length > PAGED_PAIRS, 'no pair is left unpaged: the pages hold every pair');
});

// --- g) water ---------------------------------------------------------------

const WATER_KINDS = ['water', 'waterStill'];
const LITE = rgbaOf(C.waterLite).join(',');

// the positions of the brightest pixels of a tile: the highlight and the sparkles
function liteAt(spr) {
  const out = [];
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) if (pixelAt(spr, x, y) === LITE) out.push([x, y]);
  return out;
}

function rowsOf(positions) {
  return Array.from(new Set(positions.map(([, y]) => y))).sort((a, b) => a - b);
}

function colsOf(positions) {
  return Array.from(new Set(positions.map(([x]) => x))).sort((a, b) => a - b);
}

function shifted(grid, dx, dy) {
  const h = grid.length;
  const w = grid[0].length;
  const out = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) row.push(grid[(((y - dy) % h) + h) % h][(((x - dx) % w) + w) % w]);
    out.push(row);
  }
  return out;
}

const diffCount = (a, b) => {
  let n = 0;
  for (let y = 0; y < a.length; y++) for (let x = 0; x < a[0].length; x++) if (a[y][x] !== b[y][x]) n++;
  return n;
};

const lum = (hex) => {
  const [r, g, b] = cssColor(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

check('water is a first-class ground: two materials, four frames, inside the budget', () => {
  for (const kind of WATER_KINDS) {
    const spec = TERRAIN[kind];
    assert(spec, `${kind} is not in the catalogue`);
    assert(spec.flow === (kind === 'water' ? 'current' : 'still'), `${kind} has flow ${spec.flow}`);
    assert(waterFrames(kind) === 4, `${kind} animates ${waterFrames(kind)} frames, expected 4`);
    for (const dir of ['h', 'v']) {
      for (let f = 0; f < 4; f++) {
        const spr = waterTile(kind, dir, f);
        assert(spr.w === TILE && spr.h === TILE, `${kind}/${dir}/F${f} is ${spr.w}x${spr.h}`);
      }
    }
  }
  assert(WATER_FPS.water === 6 && WATER_FPS.waterStill === 2, `the fps table is ${JSON.stringify(WATER_FPS)}`);
  assert(Object.keys(WATER_FPS).length === 2, 'the fps table carries more than the two waters');
  // no material anywhere may exceed the four-frame budget, and a ground that holds
  // still reports one frame instead of a fake cycle
  for (const kind of terrainKinds()) {
    const frames = waterFrames(kind);
    assert(Number.isInteger(frames) && frames >= 1 && frames <= 4, `${kind} declares ${frames} frames`);
    if (!WATER_KINDS.includes(kind)) assert(frames === 1, `${kind} animates ${frames} frames but is not water`);
  }
  // and water is not a way to ask a ground for pixels: only water has waterTile
  let message = '';
  try {
    waterTile('grass', 'h', 0);
  } catch (err) {
    message = err.message;
  }
  assert(/is not water/.test(message), `waterTile on grass gave "${message}"`);
});

check('the water palette is a muted stream, not a pool', () => {
  // S2: the body comes from a mix of the cold palette, it is darker than the raw
  // water blue, and waterLite never enters the body: it is spent on the waterline,
  // the silt and the highlight.
  for (const kind of WATER_KINDS) {
    const spec = TERRAIN[kind];
    assert(spec.base !== C.water && spec.base !== C.waterDeep, `${kind} uses a palette blue as it is`);
    assert(lum(spec.base) < lum(C.water) * 0.62, `${kind} body luminance ${lum(spec.base).toFixed(0)} is not muted`);
    const body = [spec.base, spec.accent, ...spec.detail, ...(spec.tones ?? [])];
    assert(!body.includes(C.waterLite), `${kind} puts waterLite in its body`);
    assert(!body.includes(C.water), `${kind} puts the raw water blue in its body`);
  }
  // the soil of the stream is a neutral silt, not the highlight's cyan
  assert(TERRAIN.water.accent !== C.waterLite, 'the silt is the highlight colour');
});

check('the four frames of a water are four different surfaces, and the key carries the frame', () => {
  for (const kind of WATER_KINDS) {
    for (const dir of ['h', 'v']) {
      for (let v = 0; v < TERRAIN[kind].variants; v++) {
        const hashes = [0, 1, 2, 3].map((f) => pixelHash(waterTile(kind, dir, f, v)));
        assert(new Set(hashes).size === 4, `${kind}/${dir}/v${v}: ${new Set(hashes).size} distinct frames of 4`);
      }
      // cached by frame, and the frame wraps instead of growing the cache
      assert(waterTile(kind, dir, 1) === waterTile(kind, dir, 1), `${kind}/${dir}: F1 was painted twice`);
      assert(waterTile(kind, dir, 4) === waterTile(kind, dir, 0), `${kind}/${dir}: F4 is not F0`);
      assert(waterTile(kind, dir, -1) === waterTile(kind, dir, 3), `${kind}/${dir}: F-1 is not F3`);
      assert(waterTile(kind, dir, 1) !== waterTile(kind, dir, 2), `${kind}/${dir}: F1 and F2 share a cache entry`);
    }
    // the direction is part of the key, and it changes the pixels of a current
    assert(waterTile(kind, 'h', 0) !== waterTile(kind, 'v', 0), `${kind}: H and V share a tile`);
    if (kind === 'water') {
      assert(pixelHash(waterTile(kind, 'h', 2)) !== pixelHash(waterTile(kind, 'v', 2)), `${kind}: H and V paint the same frame`);
    } else {
      // the pond ignores the direction on purpose (S5): nothing on it travels, so the
      // two keys must still paint the same surface
      assert(pixelHash(waterTile(kind, 'h', 2)) === pixelHash(waterTile(kind, 'v', 2)), `${kind}: the pond obeys the direction`);
    }
  }
});

check('frameIndex is one clock: deterministic, at the spec fps, wrapping, frozen at zero', () => {
  for (const kind of WATER_KINDS) {
    const fps = WATER_FPS[kind];
    // deterministic
    for (const t of [0, 0.1, 0.37, 1.5, 9.99]) assert(frameIndex(kind, t) === frameIndex(kind, t), `${kind} at ${t} moved`);
    // one step per frame period, the frame the spec's fps asks for
    for (let n = 0; n < 25; n++) {
      assert(frameIndex(kind, n / fps) === n % 4, `${kind} at ${n}/${fps}s is frame ${frameIndex(kind, n / fps)}, expected ${n % 4}`);
    }
    // it wraps rather than growing, and it is frozen at 0 on demand
    assert(frameIndex(kind, 10 * 4) === 0, `${kind} does not wrap at ${10 * 4} frame periods`);
    assert(frameIndex(kind, 3.7, true) === 0, `${kind} is not frozen at frame 0`);
    assert(frameIndex(kind, 0) === 0 && frameIndex(kind, -2) === 0, `${kind} is not 0 at t<=0`);
    assert(frameIndex(kind, 1, true) === 0 && frameIndex(kind, 1) !== 0, `${kind}: the frozen flag is ignored`);
  }
  // the per-cell phase is not a second clock: it delegates, and it never makes a
  // field pulse in unison
  const at = new Set();
  for (let ty = 0; ty < 6; ty++) for (let tx = 0; tx < 6; tx++) at.add(cellFrame('water', tx, ty, 0.3, false));
  assert(at.size > 1, 'every cell of a 6x6 field shows the same frame: the phase is global');
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const f = cellFrame('water', tx, ty, 0.42, false);
      assert(f === frameIndex('water', 0.42 + 0) || (f >= 0 && f < 4), `cell ${tx},${ty} shows frame ${f}`);
      assert(cellFrame('water', tx, ty, 0.42, true) === 0, `cell ${tx},${ty} is not frozen`);
    }
  }
});

check('the current travels along its direction; the pond never leaves its anchors', () => {
  // flowing: one line of glints, and the line is at f * (tile / frames)
  const waterH = [0, 1, 2, 3].map((f) => liteAt(waterTile('water', 'h', f)));
  const waterV = [0, 1, 2, 3].map((f) => liteAt(waterTile('water', 'v', f)));
  for (let f = 0; f < 4; f++) {
    const cols = colsOf(waterH[f]);
    assert(cols.length === 1, `the H band at F${f} spans ${cols.length} columns`);
    assert(cols[0] === f * 4, `the H band at F${f} is at column ${cols[0]}, expected ${f * 4}`);
    const rows = rowsOf(waterV[f]);
    assert(rows.length === 1, `the V band at F${f} spans ${rows.length} rows`);
    assert(rows[0] === f * 4, `the V band at F${f} is at row ${rows[0]}, expected ${f * 4}`);
    // and the crest that carries it moved with it, so the frame is a translation of
    // the highlight and not a different twinkle that happens to light three pixels
    assert(waterH[f].length >= 3, `the H crest at F${f} carries ${waterH[f].length} glints`);
  }

  // still: the sparkles sit on fixed anchors, so nothing ever crosses the tile
  const still = [0, 1, 2, 3].map((f) => liteAt(waterTile('waterStill', 'h', f)));
  const anchors = new Set();
  for (const list of still) for (const [x, y] of list) anchors.add(`${x},${y}`);
  const sparkles = TERRAIN.waterStill.sparkles ?? 6;
  assert(anchors.size <= sparkles, `the pond lights ${anchors.size} places in four frames: that is a scroll, not a sparkle`);
  for (let f = 0; f < 4; f++) assert(still[f].length > 0, `the pond is dead at F${f}`);
  // appear and fade: no frame lights exactly the same anchors as another
  const sets = still.map((list) => list.map((p) => p.join(',')).sort().join(' '));
  assert(new Set(sets).size === 4, 'the pond sparkles do not change between frames');
  // and no frame is another frame shifted
  const grids = [0, 1, 2, 3].map((f) => pixelGrid(waterTile('waterStill', 'h', f)));
  for (let f = 0; f < 3; f++) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (!dx && !dy) continue;
        assert(JSON.stringify(shifted(grids[f], dx, dy)) !== JSON.stringify(grids[f + 1]), `pond F${f} moved to F${f + 1} by ${dx},${dy}`);
      }
    }
  }
  // the still structure is untouched by the frame: only the sparkle anchors differ
  for (let f = 1; f < 4; f++) {
    const d = diffCount(grids[0], grids[f]);
    assert(d <= sparkles, `pond F0 and F${f} differ in ${d} pixels: the whole surface is moving`);
  }
  // a flowing frame changes the surface where the crest passed, not just noise
  const flowGrids = [0, 1, 2, 3].map((f) => pixelGrid(waterTile('water', 'h', f)));
  for (let f = 0; f < 3; f++) {
    let moved = 0;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        // the crest columns are 4 apart, so a frame change must touch both columns
        if (flowGrids[f][y][x] !== flowGrids[f + 1][y][x]) moved++;
      }
    }
    assert(moved >= 8, `the current barely changes between F${f} and F${f + 1} (${moved} px)`);
  }
});

check('a water transition animates the water and leaves the land alone', () => {
  // Every mask, the four corner bites included: the waterline carries the motion, and
  // a bank always has a waterline, so all four frames differ on every one of the
  // thirteen tiles.
  for (const kind of WATER_KINDS) {
    for (const mask of TRANSITION_MASKS) {
      if (mask === 'fill') continue;
      const region = transitionWaterRegion('grass', kind, mask);
      const land = [];
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (!region[y * TILE + x]) land.push([x, y]);
      assert(land.length > 0 && land.length < TILE * TILE, `grass/${kind} ${mask}: no bank to compare`);
      const frames = [0, 1, 2, 3].map((f) => transitionTile('grass', kind, mask, 0, f));
      const grids = frames.map(pixelGrid);
      const distinct = new Set(frames.map(pixelHash)).size;
      assert(distinct === 4, `grass/${kind} ${mask}: ${distinct} distinct frames of 4`);
      // the land is the same pixels in every frame, on every mask
      for (let f = 1; f < 4; f++) {
        for (const [x, y] of land) {
          assert(grids[f][y][x] === grids[0][y][x], `grass/${kind} ${mask}: the land at ${x},${y} moved on F${f}`);
        }
      }
      // and every pixel that does move is a water pixel
      for (let f = 1; f < 4; f++) {
        for (let y = 0; y < TILE; y++) {
          for (let x = 0; x < TILE; x++) {
            if (grids[f][y][x] === grids[0][y][x]) continue;
            assert(region[y * TILE + x] === 1, `grass/${kind} ${mask}: the land at ${x},${y} moved on F${f}`);
          }
        }
      }
    }
  }
  // a pair with no water has one frame whatever the caller asks for
  const dry = new Set([0, 1, 2, 3].map((f) => transitionTile('grass', 'dirt', 'n', 0, f)));
  assert(dry.size === 1, 'a dry pair multiplied its tiles by the frame');
  assert(pixelHash(transitionTile('grass', 'dirt', 'n', 0, 7)) === pixelHash(transitionTile('grass', 'dirt', 'n', 0, 0)), 'a dry pair moved on frame 7');
});

check('a water patch is per cell, per frame and inside the budget', () => {
  for (const kind of WATER_KINDS) {
    const patch = waterPatch(kind, 'h', 8, 4, 0, 3);
    assert(patch.w === 8 * TILE && patch.h === 4 * TILE, `${kind} patch is ${patch.w}x${patch.h}`);
    assert(patch === waterPatch(kind, 'h', 8, 4, 0, 3), `${kind}: the same patch was painted twice`);
    const hashes = [0, 1, 2, 3].map((f) => pixelHash(waterPatch(kind, 'h', 8, 4, f, 3)));
    assert(new Set(hashes).size === 4, `${kind}: the patch frames are not four surfaces`);
  }
});

check('the reeds are decals: three frames of lean over a transparent tile', () => {
  // the two reed kinds are `reeds` and `sedge`: the low one used to be `tuft`, which is
  // also the grass decal's name, and T5 gave it a name of its own when it wired the
  // banks and the dressing into one bake
  assert(reedKinds().join(',') === 'reeds,sedge', `the reed kinds are ${reedKinds().join(',')}`);
  for (const kind of reedKinds()) {
    const frames = [0, 1, 2].map((f) => reedTile(kind, f));
    for (const spr of frames) {
      assert(spr.w === TILE && spr.h === TILE, `${kind} is ${spr.w}x${spr.h}`);
      let clear = 0;
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (pixelAt(spr, x, y).endsWith(',0')) clear++;
      assert(clear > 40, `${kind} only clears ${clear} pixels: that is not a decal, that is a ground`);
    }
    assert(new Set(frames.map(pixelHash)).size === 3, `${kind}: the three frames are not three leans`);
    assert(reedTile(kind, 0) === reedTile(kind, 0), `${kind}: the same frame was painted twice`);
    assert(reedTile(kind, 3) === reedTile(kind, 0), `${kind}: frame 3 is not frame 0`);
    // the wind is the same stalk moved: the three frames share their pixels' extent
    const tops = frames.map((spr) => {
      const pts = [];
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (!pixelAt(spr, x, y).endsWith(',0')) pts.push(`${x},${y}`);
      return pts.length;
    });
    for (const n of tops) assert(n > 8, `${kind} draws only ${n} pixels`);
  }
  // nothing in the catalogue owns a reed, so no terrain cell can ever paint one
  for (const kind of terrainKinds()) {
    assert(!/reed|tuft/i.test(TERRAIN[kind].pattern), `${kind} paints a reed as its ground`);
    assert(!/reed|tuft/i.test(TERRAIN[kind].label), `${kind} is a reed decal`);
  }
  let message = '';
  try {
    reedTile('lilypad', 0);
  } catch (err) {
    message = err.message;
  }
  assert(/unknown reed decal/.test(message), `an unknown decal gave "${message}"`);
});

// --- h) decals --------------------------------------------------------------

const DECAL_ORDER = ['tuft', 'flowers', 'leaves', 'crack', 'patch', 'manhole', 'grate', 'moss'];
const DECAL_FRAME_CEILING = 4;

// The states a decal distinguishes, or a single nameless state for the ones that do
// not: a decal with no state is drawn once, exactly like the gallery draws it.
const statesOf = (kind) => (DECALS[kind].states.length ? DECALS[kind].states : [null]);

function clearPixels(spr) {
  let n = 0;
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) if (pixelAt(spr, x, y).endsWith(',0')) n++;
  return n;
}

function colourCount(spr, hex) {
  const key = rgbaOf(hex).join(',');
  let n = 0;
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) if (pixelAt(spr, x, y) === key) n++;
  return n;
}

function pixelLum(spr, x, y) {
  const [r, g, b] = pixelAt(spr, x, y).split(',').map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

check('eight decals, each with variants and inside the four-frame budget', () => {
  const kinds = decalKinds();
  assert(kinds.join(',') === DECAL_ORDER.join(','), `the decals are ${kinds.join(',')}`);
  assert(Object.keys(DECALS).length === 8, `${Object.keys(DECALS).length} decals in DECALS`);
  const sheet = decalSheet();
  assert(sheet.length === 8, `the sheet holds ${sheet.length} decals`);
  assert(sheet.map(([kind]) => kind).join(',') === DECAL_ORDER.join(','), 'the sheet reorders the catalogue');
  for (const [kind, variants] of sheet) {
    const spec = DECALS[kind];
    assert(typeof spec.label === 'string' && spec.label.length > 0, `${kind} has no label`);
    assert(Number.isInteger(variants) && variants === spec.variants, `${kind}: the sheet says ${variants} variants`);
    assert(Number.isInteger(variants) && variants >= 1, `${kind} declares ${variants} variants`);
    assert(spec.group === 'natural' || spec.group === 'urban', `${kind} has no group`);
    assert(Number.isInteger(spec.frames) && spec.frames >= 1, `${kind} declares ${spec.frames} frames`);
    assert(spec.frames <= DECAL_FRAME_CEILING, `${kind} animates ${spec.frames} frames, over the budget`);
    assert(typeof spec.fps === 'number' && spec.fps >= 0, `${kind} has fps ${spec.fps}`);
    // a decal that animates has a rate, and a decal that holds still has no rate to
    // multiply: the two are one rule, and the check pins both halves
    assert(spec.frames > 1 ? spec.fps > 0 : spec.fps === 0, `${kind}: ${spec.frames} frames at ${spec.fps} fps`);
    assert(Array.isArray(spec.states), `${kind} has no state list`);
    for (const state of spec.states) assert(typeof state === 'string' && state.length > 0, `${kind} has an unnamed state`);
    for (let v = 0; v < variants; v++) {
      const spr = decalTile(kind, v);
      assert(spr.w === TILE && spr.h === TILE, `${kind}/${v} is ${spr.w}x${spr.h}`);
      assert(spr.canvas.width === TILE && spr.canvas.height === TILE, `${kind}/${v} canvas is not ${TILE}px`);
    }
    // every state, and the default one, stays inside the budget too
    for (const state of [...spec.states, null]) {
      const frames = decalFrames(kind, state);
      assert(Number.isInteger(frames) && frames >= 1 && frames <= DECAL_FRAME_CEILING, `${kind}/${state}: ${frames} frames`);
    }
  }
  // the two states the catalogue names, and the frame count each of them affords
  assert(DECALS.flowers.states.join(',') === 'day,night', `flowers have states ${DECALS.flowers.states.join(',')}`);
  assert(DECALS.grate.states.join(',') === 'dry,rain', `the grate has states ${DECALS.grate.states.join(',')}`);
  assert(decalFrames('grate', 'dry') === 1, 'the dry grate still reports two frames');
  assert(decalFrames('grate', 'rain') === 2, 'the grate in the rain does not animate');
  assert(decalFrames('moss') === 2 && DECALS.moss.fps === 1, 'the moss is not the slow two-frame decal');
  assert(DECALS.tuft.frames === 2 && DECALS.leaves.frames === 3, 'the tuft and the leaves lost their frame counts');
});

check('a decal is a transparent overlay, never a block of paint', () => {
  for (const kind of DECAL_ORDER) {
    for (const state of statesOf(kind)) {
      for (let v = 0; v < DECALS[kind].variants; v++) {
        const frames = decalFrames(kind, state);
        for (let f = 0; f < frames; f++) {
          const spr = decalTile(kind, v, f, state);
          const clear = clearPixels(spr);
          assert(clear >= 40, `${kind}/${v}/F${f}/${state} clears only ${clear} pixels: that is not an overlay`);
          assert(clear < TILE * TILE, `${kind}/${v}/F${f}/${state} is a full 16x16 block of paint`);
          // And nothing touches the outermost row or column: a mark cut by the tile edge
          // reads as a cut pixel, and a mark that hugs the border reads as a halo under
          // the tile. Every decal is drawn inside a one-pixel margin.
          for (let i = 0; i < TILE; i++) {
            for (const [bx, by] of [[i, 0], [i, TILE - 1], [0, i], [TILE - 1, i]]) {
              assert(pixelAt(spr, bx, by).endsWith(',0'), `${kind}/${v}/F${f}/${state} paints the border at ${bx},${by}`);
            }
          }
        }
      }
    }
  }
});

check('every animated decal moves, and a state change reaches the pixels', () => {
  let animated = 0;
  for (const kind of DECAL_ORDER) {
    for (const state of statesOf(kind)) {
      const frames = decalFrames(kind, state);
      if (frames < 2) continue;
      animated++;
      for (let v = 0; v < DECALS[kind].variants; v++) {
        const hashes = [];
        for (let f = 0; f < frames; f++) hashes.push(pixelHash(decalTile(kind, v, f, state)));
        assert(new Set(hashes).size === frames, `${kind}/${v}/${state}: ${new Set(hashes).size} distinct frames of ${frames}`);
      }
    }
  }
  assert(animated >= 5, `only ${animated} animated decal states: tuft, flowers, leaves, the wet grate and moss`);
  // flowers: by day an open bloom, by night a bud. A silhouette change, not a tint.
  const day = decalTile('flowers', 0, 0, 'day');
  const night = decalTile('flowers', 0, 0, 'night');
  assert(pixelHash(day) !== pixelHash(night), 'the flowers look the same by day and by night');
  assert(colourCount(day, C.white) > 0, 'the open flower shows no white petals');
  assert(colourCount(night, C.white) === 0, 'the closed flower still shows open white petals');
  assert(clearPixels(night) > clearPixels(day), 'the night buds do not close the bloom');
  // the grate: holes when dry, water standing in the slots when it rains
  const dry = decalTile('grate', 0, 0, 'dry');
  const rain = decalTile('grate', 0, 0, 'rain');
  assert(pixelHash(dry) !== pixelHash(rain), 'the grate looks the same dry and in the rain');
  let lifted = 0;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) if (pixelLum(rain, x, y) > pixelLum(dry, x, y) + 30) lifted++;
  }
  assert(lifted >= 4, `the wet grate lights ${lifted} pixels more than the dry one: the water does not read`);
  // the twinkling pond of the water page is not the only place a state matters: a
  // state a decal does not declare is its default and changes nothing
  assert(pixelHash(decalTile('tuft', 0, 0, 'rain')) === pixelHash(decalTile('tuft', 0, 0)), 'a state the tuft does not declare changed it');
  assert(pixelHash(decalTile('moss', 0, 0, 'night')) === pixelHash(decalTile('moss', 0, 0)), 'a state the moss does not declare changed it');
  // and the dry grate is one tile whatever frame the driver asks for
  assert(pixelHash(decalTile('grate', 0, 1, 'dry')) === pixelHash(decalTile('grate', 0, 0, 'dry')), 'the dry grate animates');
});

check('a decal tile is deterministic and cached by frame, variant and state', () => {
  for (const kind of DECAL_ORDER) {
    const spec = DECALS[kind];
    assert(decalTile(kind, 0) === decalTile(kind, 0), `${kind}: the same tile was painted twice`);
    assert(decalTile(kind, spec.variants) === decalTile(kind, 0), `${kind}: variant ${spec.variants} is not variant 0`);
    assert(decalTile(kind, -1) === decalTile(kind, spec.variants - 1), `${kind}: variant -1 is not the last variant`);
    for (const state of statesOf(kind)) {
      const frames = decalFrames(kind, state);
      for (let f = 0; f < frames; f++) {
        assert(decalTile(kind, 0, f, state) === decalTile(kind, 0, f, state), `${kind}/F${f}/${state}: painted twice`);
      }
      assert(decalTile(kind, 0, frames, state) === decalTile(kind, 0, 0, state), `${kind}/${state}: the frame does not wrap`);
      if (frames > 1) {
        assert(decalTile(kind, 0, 1, state) !== decalTile(kind, 0, 0, state), `${kind}/${state}: F0 and F1 share a cache entry`);
        assert(decalTile(kind, 0, -1, state) === decalTile(kind, 0, frames - 1, state), `${kind}/${state}: F-1 does not wrap`);
      }
    }
    if (spec.states.length > 1) {
      assert(decalTile(kind, 0, 0, spec.states[0]) !== decalTile(kind, 0, 0, spec.states[1]), `${kind}: the two states share a cache entry`);
    }
    // the pixels, not just the object: same call, same tile
    assert(pixelHash(decalTile(kind, 0)) === pixelHash(decalTile(kind, 0)), `${kind}: two calls gave two pictures`);
  }
});

check('the dressing is hashed per cell, never hand-placed', () => {
  const list = ['tuft', 'flowers', 'leaves'];
  const seen = new Set();
  for (let ty = 0; ty < 8; ty++) {
    for (let tx = 0; tx < 8; tx++) {
      const pick = decalAt(tx, ty, list, 1, 0.6);
      assert(JSON.stringify(pick) === JSON.stringify(decalAt(tx, ty, list, 1, 0.6)), `${tx},${ty} moved between two calls`);
      if (!pick) continue;
      assert(list.includes(pick.kind), `${tx},${ty} wears ${pick.kind}, which is not on its list`);
      assert(Number.isInteger(pick.variant) && pick.variant >= 0 && pick.variant < DECALS[pick.kind].variants, `${pick.kind} variant ${pick.variant}`);
      seen.add(pick.kind);
    }
  }
  assert(seen.size === 3, `the hash only ever picks ${[...seen].join(',')}`);
  // a density dresses its share of the field, and never the whole of it
  let dressed = 0;
  let cells = 0;
  for (let ty = 0; ty < 16; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      cells++;
      if (decalAt(tx, ty, list, 2, 0.5)) dressed++;
    }
  }
  const share = dressed / cells;
  assert(dressed < cells, 'every cell got a decal: a dressed field would read as a sticker sheet');
  assert(share > 0.35 && share < 0.65, `a density of 0.5 dressed ${(share * 100).toFixed(0)}% of the field`);
  // the seed moves the dressing, so two fields are not the same field
  const field = (seed) => {
    const out = [];
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 8; tx++) out.push(JSON.stringify(decalAt(tx, ty, list, seed, 1)));
    return out.join('|');
  };
  assert(field(1) !== field(2), 'seed 2 dresses the seed 1 field');
});

check('where a decal grows is catalogue data, not gallery taste', () => {
  for (const kind of DECAL_ORDER) {
    const spec = DECALS[kind];
    assert(Array.isArray(spec.grounds) && spec.grounds.length > 0, `${kind} grows nowhere`);
    assert(Number.isInteger(spec.weight) && spec.weight >= 1, `${kind} has weight ${spec.weight}`);
    for (const ground of spec.grounds) {
      assert(TERRAIN[ground], `${kind} grows on ${ground}, which is not a material`);
      // nothing that moves or holds water wears dressing
      assert(!TERRAIN[ground].flow, `${kind} grows on ${ground}, which is water`);
    }
  }
  // every decal is reachable through some ground, and a ground's list only holds decals
  const reached = new Set();
  for (const ground of terrainKinds()) {
    const list = decalDressing(ground);
    for (const kind of list) {
      assert(DECALS[kind], `${ground} can wear ${kind}, which is not a decal`);
      reached.add(kind);
    }
    if (!TERRAIN[ground].flow) continue;
    assert(list.length === 0, `${ground} is water and wears ${list.join(',')}`);
  }
  for (const kind of DECAL_ORDER) assert(reached.has(kind), `${kind} is on no ground's list`);
  // the weights are a frequency and not decoration: moss and cracks are commoner than a
  // manhole cover, which is what keeps a dressed field from looking stamped
  assert(decalDressing('paving').length > decalDressing('paving').filter((k) => k === 'manhole').length * 3, 'the paving is all manholes');
  assert(decalDressing('water').length === 0, 'water wears dressing');
});

check('the decal page lists every decal exactly once', () => {
  const decalPages = TERRAIN_PAGES.filter((entry) => entry.kind === 'decals');
  assert(decalPages.length === 1, `${decalPages.length} decal pages, expected 1`);
  const entry = decalPages[0];
  assert(entry.items.join(',') === decalKinds().join(','), `the decal page holds ${entry.items.join(',')}`);
  assert(new Set(entry.items).size === 8, 'a decal appears twice on the page');
  assert(TERRAIN_PAGES[TERRAIN_PAGES.length - 1] === entry, 'the decal page is not the last page');
  // and no decal kind is mistaken for a ground on another page
  for (const other of TERRAIN_PAGES) {
    if (other === entry) continue;
    for (const item of other.items) {
      assert(!DECALS[item], `${item} is a decal on the "${other.title}" page`);
      if (other.kind !== 'pairs') assert(TERRAIN[item], `"${other.title}" lists ${item}, which is not a material`);
    }
  }
});

check('decals read the shared clock, and a frozen scene is frame 0', () => {
  for (const kind of DECAL_ORDER) {
    const spec = DECALS[kind];
    for (const state of statesOf(kind)) {
      const frames = decalFrames(kind, state);
      if (frames < 2) continue;
      for (let n = 0; n < frames * 3; n++) {
        // a hair inside the period, so 1/1.5s does not land on 0.9999 and floor to the
        // frame before
        const at = frameIndex(kind, n / spec.fps + 1e-6, false);
        assert(at === n % frames, `${kind}/${state} at ${n}/${spec.fps}s is frame ${at}, expected ${n % frames}`);
      }
      assert(frameIndex(kind, 4.2, true) === 0, `${kind}/${state} is not frozen at frame 0`);
      assert(cellFrame(kind, 3, 5, 2.5, true) === 0, `${kind}/${state} ignores the frozen flag per cell`);
      assert(frameIndex(kind, 0) === 0 && frameIndex(kind, -2) === 0, `${kind}/${state} is not 0 at t<=0`);
    }
    // The per-cell phase comes from the hash, so a field is never in unison. The
    // catalogue's own frame count decides here, not decalFrames: the grate can animate,
    // it just does not while it is dry, and cellFrame has no state to consult.
    const at = new Set();
    for (let ty = 0; ty < 6; ty++) for (let tx = 0; tx < 6; tx++) at.add(cellFrame(kind, tx, ty, 0.31, false));
    if (spec.frames > 1) assert(at.size > 1, `${kind}: every cell of the field shows the same frame`);
    else assert(at.size === 1 && at.has(0), `${kind} is static but reports a frame`);
  }
});

check('decal colours come from the palette, and the literal count is still zero', () => {
  const text = readFileSync(SOURCE, 'utf8');
  const literals = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert(literals.length === 0, `${literals.length} colour literals in terrain.js: ${literals.slice(0, 5).join(' ')}`);
  // every decal colour is a palette name or a mix of them, and nothing else
  const consts = text.match(/const DECAL_[A-Z_]+ = .*/g) || [];
  assert(consts.length >= 12, `only ${consts.length} decal colour constants found`);
  for (const line of consts) {
    const rhs = line.slice(line.indexOf('=') + 1).trim();
    assert(/^(C\.[a-zA-Z0-9]+|mix\()/.test(rhs), `decal colour ${line.trim()} is not palette-derived`);
  }
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);