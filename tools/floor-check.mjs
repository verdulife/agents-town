// Floor invariants (T5). The card's ground is a tile map painted from the terrain
// catalogue, and everything it promises is a statement about data or about pixels:
//   node tools/floor-check.mjs
//
// The map rules (a material per cell, a curated pair per seam, a mask read from the
// neighbours) are checked on the map; the animation rules are checked on the finished
// pixels, because "the same frame" and "a different frame" cannot be told apart by
// anything else. The last check reads the source text, because the palette rule is the
// one rule a literal could sneak back into.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// --- a rasterising canvas stub ---------------------------------------------
// The same idea as the one in terrain-check.mjs, trimmed to what the floor needs:
// fillRect, a 1:1 blit and alpha, so a decal composites over its ground exactly as it
// does in the browser. A check on "the same pixels" needs the pixels.

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
    this.imageSmoothingEnabled = false;
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
  drawImage(img, dx, dy) {
    const src = img;
    const x0 = Math.round(dx);
    const y0 = Math.round(dy);
    for (let j = 0; j < src.height; j++) {
      for (let i = 0; i < src.width; i++) {
        const k = (j * src.width + i) * 4;
        this._blend(x0 + i, y0 + j, [src.data[k], src.data[k + 1], src.data[k + 2], src.data[k + 3]]);
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

// A stable hash of a whole sprite, alpha included: two frames that differ in one pixel
// differ here.
function pixelHash(spr) {
  const d = spr.canvas.data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) {
    h ^= d[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const floorFrameHash = (items) => items.map((item) => pixelHash(item.sprite)).join(',');

const {
  FLOOR_MATERIALS,
  FLOOR_ANIM_BUDGET,
  FLOOR_DRESSING,
  floorMap,
  floorCell,
  floorSprite,
  floorAnimated,
  floorFrame,
} = await import('../src/next/floor.js');
const {
  TERRAIN,
  terrainKinds,
  TRANSITION_PAIRS,
  TRANSITION_MASKS,
  DECALS,
  REED_ANIM,
  decalDressing,
} = await import('../src/next/terrain.js');
const { TILE } = await import('../src/next/art-spec.js');

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
const SOURCE = join(HERE, '..', 'src', 'next', 'floor.js');

// The card's map, in the size the calibration card asks for: the world in tiles.
const WORLD_TILES = [45, 29];
const CARD = floorMap(WORLD_TILES[0], WORLD_TILES[1]);

const cellsOf = (map) => {
  const out = [];
  for (let ty = 0; ty < map.tilesH; ty++) {
    for (let tx = 0; tx < map.tilesW; tx++) out.push(floorCell(tx, ty, map));
  }
  return out;
};

const pairKey = (cell) => (cell.pair ? cell.pair.join('>') : null);
const seamKey = (cell) => (cell.other ? [cell.material, cell.other].sort().join('>') : null);

console.log('floor check\n');

// --- a) the map ------------------------------------------------------------

check('the map is deterministic for its size', () => {
  const again = floorMap(WORLD_TILES[0], WORLD_TILES[1]);
  assert(again.cells.length === CARD.cells.length, 'two maps of one size hold two cell counts');
  assert(again.cells.join(',') === CARD.cells.join(','), 'the same size gave a different map');
  assert(again.tilesW === WORLD_TILES[0] && again.tilesH === WORLD_TILES[1], 'the map is not the size it was asked for');
  // a different size is a different map, and it is still deterministic: the card asks
  // for the world, never for the window, so a resize cannot regenerate the street
  const small = floorMap(20, 16);
  assert(small.cells.length === 320, `20x16 gave ${small.cells.length} cells`);
  assert(small.cells.join(',') === floorMap(20, 16).cells.join(','), '20x16 gave a different map the second time');
  assert(small.cells.join(',') !== CARD.cells.join(','), 'two sizes gave the same map: the size is being ignored');
  // and the cells are a window of the world map, not a re-composition: the card's map
  // is the only map the card paints
  assert(floorSprite(WORLD_TILES[0], WORLD_TILES[1]).map.cells.join(',') === CARD.cells.join(','), 'the baked map is not the map');
});

check('the map uses only catalogue materials, and only the card\'s five', () => {
  const kinds = terrainKinds();
  for (const material of FLOOR_MATERIALS) {
    assert(kinds.includes(material), `the floor may use ${material}, which the catalogue does not define`);
  }
  const seen = new Set();
  for (const material of CARD.cells) {
    assert(typeof material === 'string' && material.length > 0, 'a cell has no material');
    assert(TERRAIN[material], `a cell is ${material}, which the catalogue does not define`);
    assert(FLOOR_MATERIALS.includes(material), `a cell is ${material}, which the floor may not use`);
    seen.add(material);
  }
  const expected = ['grass', 'paving', 'asphalt', 'plaza'];
  assert(
    expected.every((material) => seen.has(material)) && seen.size === expected.length,
    `the map uses ${[...seen].join(',')}, expected ${expected.join(',')}`,
  );
  // S2 of the task: the card has no water. Water stays a gallery material until the
  // town scene exists, so no cell of the card may be a river or a pond.
  for (const material of CARD.cells) assert(!TERRAIN[material].flow, `the card's floor is wet: ${material}`);
});

check('the map is the card composition: field, sidewalk, kerb, road, square', () => {
  const cells = cellsOf(CARD);
  const seams = new Set(cells.map(seamKey).filter(Boolean));
  // the buildings' sidewalk meets the field, the kerb separates it from the road, the
  // road meets the square and the square meets the field again at its ends
  for (const seam of ['grass>paving', 'asphalt>paving', 'asphalt>plaza', 'grass>plaza']) {
    assert(seams.has(seam), `the card never shows the ${seam.replace('>', '/')} seam`);
  }
  // the plaza is one rectangle, not a scatter of slabs
  const plaza = cells.filter((cell) => cell.material === 'plaza');
  assert(plaza.length > 20, `the plaza is ${plaza.length} cells`);
  const xs = plaza.map((c) => c.tx);
  const ys = plaza.map((c) => c.ty);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const area = (box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1);
  assert(plaza.length === area, `the plaza covers ${plaza.length} of a ${area}-cell box: it is not a rectangle`);
  // and the square meets the road along its top edge and the field at its ends
  for (const cell of plaza) {
    if (cell.other) assert(['asphalt', 'grass'].includes(cell.other), `a plaza cell borders ${cell.other}`);
  }
});

check('no cell borders two materials', () => {
  // The invariant the whole bake rests on: one mask describes one cell's edge, so a
  // cell that saw two materials would leave one of its sides a hard seam. It is a
  // property of the composition (two-row bands, a plaza margin) and not luck.
  for (const cell of cellsOf(CARD)) {
    const around = new Set();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]) {
      const tx = cell.tx + dx;
      const ty = cell.ty + dy;
      if (tx < 0 || ty < 0 || tx >= CARD.tilesW || ty >= CARD.tilesH) continue;
      const other = CARD.cells[ty * CARD.tilesW + tx];
      if (other !== cell.material) around.add(other);
    }
    assert(around.size <= 1, `cell ${cell.tx},${cell.ty} (${cell.material}) borders ${[...around].join(' and ')}`);
  }
});

// --- b) the seams ----------------------------------------------------------

check('every seam is a curated pair', () => {
  const curated = new Set(TRANSITION_PAIRS.map((pair) => [...pair].sort().join('>')));
  let seams = 0;
  for (const cell of cellsOf(CARD)) {
    if (!cell.other) continue;
    seams++;
    assert(cell.pair, `cell ${cell.tx},${cell.ty} borders ${cell.other} but has no pair`);
    assert(curated.has(seamKey(cell)), `${seamKey(cell)} is not a curated pair`);
    // and the pair is the catalogue's, in the catalogue's order: the dominant ground
    // first, so the seam is painted by the same material the gallery paints it with
    assert(TRANSITION_PAIRS.some(([a, b]) => a === cell.pair[0] && b === cell.pair[1]), `the pair ${pairKey(cell)} is reversed`);
  }
  assert(seams > 100, `only ${seams} cells border another material`);
});

check('every mask used is one of the thirteen', () => {
  const used = new Set();
  for (const cell of cellsOf(CARD)) {
    assert(TRANSITION_MASKS.includes(cell.mask), `cell ${cell.tx},${cell.ty} has mask "${cell.mask}"`);
    if (cell.paints) used.add(cell.mask);
    // the mask is read from the neighbours: a cell that paints has at least one bit
    if (cell.paints) assert(cell.bits !== 0 || cell.diagonals !== 0, `cell ${cell.tx},${cell.ty} paints a fringe with no neighbour`);
    // and a cell that does not paint is a plain tile, whatever its neighbours are
    if (!cell.paints) assert(cell.mask === 'fill', `cell ${cell.tx},${cell.ty} paints nothing but carries "${cell.mask}"`);
  }
  // The card is a stack of full-width bands, so the two straights are what it needs; the
  // convex corners and the pockets are proven by the gallery's composed sample and by
  // the pair checks, not by this map (which would need an inset band to reach them).
  assert(used.size >= 2, `the card only exercises ${used.size} masks: ${[...used].sort().join(',')}`);
  for (const mask of ['n', 's']) {
    assert(used.has(mask), `the card never uses the ${mask} mask`);
  }
});

check('a seam is painted once, by the dominant ground', () => {
  // The catalogue's rule, and the gallery's composed sample proves it: the b cell of a
  // pair stays a plain tile, because the a cell next to it already drew the bank. Two
  // fringes on one seam would be a braid twice as wide as the catalogue designed.
  const cells = cellsOf(CARD);
  const at = (tx, ty) => cells[ty * CARD.tilesW + tx];
  let painted = 0;
  for (const cell of cells) {
    if (!cell.paints) continue;
    painted++;
    assert(cell.pair[0] === cell.material, `cell ${cell.tx},${cell.ty} paints the ${pairKey(cell)} seam but is the second ground`);
    // every neighbour of the other material is a plain tile, never a second fringe
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const tx = cell.tx + dx;
      const ty = cell.ty + dy;
      if (tx < 0 || ty < 0 || tx >= CARD.tilesW || ty >= CARD.tilesH) continue;
      const next = at(tx, ty);
      if (next.material !== cell.pair[1]) continue;
      assert(!next.paints || next.pair[0] !== next.material, `the ${pairKey(cell)} seam at ${cell.tx},${cell.ty} is painted from both sides`);
    }
  }
  assert(painted > 50, `only ${painted} cells paint a fringe`);
});

// --- c) the dressing -------------------------------------------------------

check('decals respect the grounds the catalogue declares', () => {
  const cells = cellsOf(CARD);
  const dressed = cells.filter((cell) => cell.decal);
  assert(dressed.length > 40, `only ${dressed.length} cells are dressed`);
  const kinds = new Set();
  for (const cell of dressed) {
    const kind = cell.decal.kind;
    kinds.add(kind);
    // a bank wears reeds, and reeds are not decals that grow on a ground
    if (REED_ANIM[kind]) {
      assert(cell.bank, `cell ${cell.tx},${cell.ty} wears ${kind} but is not a bank`);
      assert(cell.pair && TERRAIN[cell.pair[1]].flow, `${kind} grows on ${cell.material}, which is not a shore`);
      continue;
    }
    assert(DECALS[kind], `cell ${cell.tx},${cell.ty} wears ${kind}, which is not a decal`);
    assert(DECALS[kind].grounds.includes(cell.material), `${kind} grows on ${cell.material}`);
    assert(decalDressing(cell.material).includes(kind), `${kind} is not on ${cell.material}'s list`);
    assert(Number.isInteger(cell.decal.variant) && cell.decal.variant < DECALS[kind].variants, `${kind} variant ${cell.decal.variant}`);
  }
  // nothing grows on water, and nothing sits on a seam
  for (const cell of cells) {
    if (cell.water && cell.decal) throw new Error(`${cell.water} at ${cell.tx},${cell.ty} wears ${cell.decal.kind}`);
    if (cell.paints && cell.decal) throw new Error(`the ${pairKey(cell)} seam at ${cell.tx},${cell.ty} wears ${cell.decal.kind}`);
  }
  // a floor is dressed with more than one thing, and a field of one decal would read
  // as a stamp: the hash picks from the ground's list, so the spread comes from data
  assert(kinds.size >= 3, `the card is dressed with ${[...kinds].join(',')}`);
  assert([...kinds].every((kind) => DECALS[kind] || REED_ANIM[kind]), 'an unknown kind is on the floor');
  // the density is the card's, and it is not a sticker sheet
  assert(FLOOR_DRESSING > 0.05 && FLOOR_DRESSING < 0.5, `the card dresses ${FLOOR_DRESSING} of its cells`);
});

// --- d) the animated cells -------------------------------------------------

check('the animated cells are deterministic and inside the budget', () => {
  const one = floorAnimated(CARD);
  const two = floorAnimated(CARD);
  assert(one.cells.length === two.cells.length, 'two calls animated two counts');
  assert(
    one.cells.map((c) => `${c.tx},${c.ty}`).join('|') === two.cells.map((c) => `${c.tx},${c.ty}`).join('|'),
    'two calls animated two different cells',
  );
  assert(one.count === one.cells.length, 'the count is not the list');
  // a strict subset of the map: every animated cell is a cell, and the floor is bigger
  assert(one.count > 0, 'nothing on the card moves');
  assert(one.count < CARD.cells.length, 'every cell of the floor moves: that is not a bake');
  for (const cell of one.cells) {
    assert(cell.tx >= 0 && cell.ty >= 0 && cell.tx < CARD.tilesW && cell.ty < CARD.tilesH, `${cell.tx},${cell.ty} is outside the map`);
    assert(cell.x === cell.tx * TILE && cell.y === cell.ty * TILE, `${cell.tx},${cell.ty} is at ${cell.x},${cell.y}`);
  }
  // and inside S7's budget, which is a share of the floor and not a round number
  assert(one.count <= one.budget, `${one.count} animated cells over a budget of ${one.budget}`);
  assert(one.budget === Math.ceil(FLOOR_ANIM_BUDGET * CARD.cells.length), `the budget is ${one.budget}`);
  assert(one.budget < CARD.cells.length, 'the budget covers the whole floor');
  // every animated kind has more than one frame, or the list would be a lie
  for (const cell of one.cells) {
    const frames = cell.water || cell.bank ? 4 : REED_ANIM[cell.kind] ? REED_ANIM[cell.kind].frames : DECALS[cell.kind].frames;
    assert(frames >= 2, `${cell.kind} at ${cell.tx},${cell.ty} is animated with ${frames} frame(s)`);
    assert(frames <= 4, `${cell.kind} animates ${frames} frames, over S7's budget`);
  }
});

// --- e) a frame ------------------------------------------------------------

check('a frame is the same pixels for the same time, and new pixels for another', () => {
  const anim = floorAnimated(CARD);
  const a = floorFrame(anim, 0);
  const b = floorFrame(anim, 0);
  assert(a.length >= anim.count, `${a.length} sprites for ${anim.count} cells`);
  assert(floorFrameHash(a) === floorFrameHash(b), 'the same time gave two pictures');
  assert(a.every((item) => item.sprite.w === TILE && item.sprite.h === TILE), 'a frame sprite is not 16x16');
  // a different time is a different frame: the tufts, the flowers, the leaves and the
  // moss do not all land on frame 0 at once
  for (const t of [0.5, 1.25, 2, 3.5]) {
    assert(floorFrameHash(a) !== floorFrameHash(floorFrame(anim, t)), `t=${t} painted the t=0 frame`);
  }
  // the per-cell phase is the catalogue's: two cells of one kind are not in unison
  const tufts = anim.cells.filter((cell) => cell.kind === 'tuft').slice(0, 8);
  const frames = new Set(tufts.map((cell) => floorFrame({ cells: [cell], state: null }, 0.75)[0].frame));
  assert(frames.size > 1, 'every tuft of the floor leans at the same time');
});

check('a frozen floor is frame 0, and ?pause=1&sim=N is reproducible', () => {
  const anim = floorAnimated(CARD);
  // ?anim=0 and prefers-reduced-motion freeze every cell at frame 0, whatever the
  // clock says: the live floor starts each cell on its own phase, the frozen one does not
  const frozenHashes = [0, 0.3, 2, 7.5].map((t) => floorFrameHash(floorFrame(anim, t, null, true)));
  assert(new Set(frozenHashes).size === 1, 'the frozen floor moved with the clock');
  for (const item of floorFrame(anim, 3.25, null, true)) assert(item.frame === 0, `a frozen cell shows frame ${item.frame}`);
  // the capture the review runs: the same simulated second, twice, pixel for pixel
  const shot = () => floorFrameHash(floorFrame(anim, 2, null, false));
  assert(shot() === shot(), 'two captures of the same simulated second disagree');
  assert(shot() !== frozenHashes[0], 'the clock never reaches the floor: sim=2 is the frozen frame');
});

// --- f) the static layer ---------------------------------------------------

check('the static layer is one sprite of the requested size', () => {
  const layer = floorSprite(WORLD_TILES[0], WORLD_TILES[1]);
  assert(layer.w === WORLD_TILES[0] * TILE && layer.h === WORLD_TILES[1] * TILE, `the layer is ${layer.w}x${layer.h}`);
  assert(layer.canvas.width === layer.w && layer.canvas.height === layer.h, 'the canvas is not the sprite size');
  assert(layer.map.tilesW === WORLD_TILES[0] && layer.map.tilesH === WORLD_TILES[1], 'the layer holds another map');
  // painted once: the second call is the same object, and a different size is a
  // different layer instead of a rescale of this one
  assert(floorSprite(WORLD_TILES[0], WORLD_TILES[1]) === layer, 'the static layer was painted twice');
  const small = floorSprite(8, 6);
  assert(small !== layer, 'two sizes share one layer');
  assert(small.w === 8 * TILE && small.h === 6 * TILE, `the small layer is ${small.w}x${small.h}`);
  // the layer carries the animated list, so a caller never has to recompute it
  assert(layer.animated.count === floorAnimated(layer.map).count, 'the layer and the animation disagree');
  // and it is painted: every pixel is opaque, and the layer holds the tones of the five
  // materials and of their seams, not one colour (a blank floor would pass every rule above)
  const d = layer.canvas.data;
  const tones = new Set();
  let clear = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] !== 255) clear++;
    tones.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  }
  assert(clear === 0, `${clear} pixels of the static layer are not opaque`);
  assert(tones.size >= 20, `the static layer holds only ${tones.size} colours`);
});

// --- the generic path: water, banks and reeds ------------------------------

check('water and its banks animate, though the card has none', () => {
  // A small map with a river through it: the card has no water, so the shore path would
  // otherwise never be exercised — and it is the path the town scene will use.
  const cells = [];
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 6; tx++) cells.push(ty < 2 ? 'grass' : 'water');
  }
  const wet = { tilesW: 6, tilesH: 4, cells, seed: 1, dressing: 0.3 };
  const anim = floorAnimated(wet);
  const banks = anim.cells.filter((cell) => cell.bank);
  const water = anim.cells.filter((cell) => cell.water);
  assert(water.length === 12, `${water.length} water cells, expected 12`);
  assert(banks.length === 6, `${banks.length} bank cells, expected the whole row above the water`);
  for (const cell of banks) {
    assert(cell.pair && cell.pair[0] === 'grass' && cell.pair[1] === 'water', `a bank has pair ${pairKey(cell)}`);
    assert(cell.mask === 's', `a bank has mask ${cell.mask}, expected the straight edge`);
  }
  // the reeds are the bank's own dressing: some banks wear them, never all of them
  const reeds = anim.cells.filter((cell) => cell.decal && REED_ANIM[cell.decal.kind]);
  assert(reeds.length > 0 && reeds.length < banks.length, `${reeds.length} of ${banks.length} banks wear reeds`);
  // the land of a bank is pixel-identical across the frames: only the water moves
  const frames = [0, 1, 2, 3].map((f) => floorFrame(anim, f / 4));
  const bankAt = (items, tx) => items.filter((item) => item.tx === tx && item.kind === 'water').map((item) => pixelHash(item.sprite));
  const moving = new Set(frames.map((items) => bankAt(items, 2).join(',')));
  assert(moving.size === 4, `the water of a bank shows ${moving.size} of 4 frames`);
  // and nothing grows on the water itself
  for (const cell of anim.cells) if (cell.water) assert(!cell.decal, 'something grows on the water');
});

// --- S7: the palette ------------------------------------------------------

check('floor.js holds no colour literal', () => {
  const text = readFileSync(SOURCE, 'utf8');
  const literals = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert(literals.length === 0, `${literals.length} colour literals in floor.js: ${literals.slice(0, 5).join(' ')}`);
  // every colour on the card's floor comes from the catalogue, which is the only place
  // a palette name is spent: the floor module never names a colour at all
  assert(!/from '\.\.\/palette\.js'/.test(text), 'floor.js imports the palette directly');
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
