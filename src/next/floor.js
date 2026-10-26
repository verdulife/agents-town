// Floor (T5): the card's ground as a tile map painted from the terrain catalogue.
//
// Three layers, and the split is the whole point of the module (S7):
//   - the map: a material per cell, from a rule about bands, never from a window;
//   - the static layer: one sprite with every ground tile, every transition and every
//     decal that holds still, painted once and cached;
//   - the animated cells: the short list whose pixels move, repainted per frame from
//     the shared clock of the catalogue (frameIndex / cellFrame), never from a clock
//     of its own.
//
// Nothing here reads the window size, the DOM or the time. The map is a pure function
// of the size it is asked for, a cell is a pure function of its coordinates, and a
// frame is a pure function of the time it is handed: that is what lets the check paint
// the card's floor in Node and lets `?pause=1&sim=N` reproduce a capture frame for
// frame.

import { Painter, cacheSprite } from '../pixel.js';
import { TILE } from './art-spec.js';
import {
  TERRAIN,
  REED_ANIM,
  terrainTile,
  terrainCell,
  transitionTile,
  transitionMask,
  TRANSITION_PAIRS,
  waterTile,
  reedTile,
  reedKinds,
  hash32,
  decalAt,
  decalDressing,
  decalTile,
  decalFrames,
  cellFrame,
} from './terrain.js';

const cache = new Map();

// The materials the card's map may use. Water is a gallery material until the town
// scene exists: the card has no river, so nothing here paints one. The list is the
// whitelist the check reads, so a map that reaches for a ground the card has no
// business showing fails instead of quietly baking it.
export const FLOOR_MATERIALS = ['grass', 'dirt', 'plaza', 'paving', 'asphalt'];

// The dressing of the card's floor: the share of cells that carry anything at all and
// the seed the hash reads. Low enough that the field reads dressed and not stamped —
// the gallery's own sample dresses 34%, which is a sheet, and the street is not one.
export const FLOOR_DRESSING = 0.22;
export const FLOOR_SEED = 5;

// The share of a bank that carries reeds. Reeds are the shore's own dressing and they
// are not in DECALS (they are not a decal that grows on a ground), so the rate is here.
export const SHORE_REEDS = 0.45;

// S7's budget, as a share of the floor: a frame may repaint this much of it and no
// more. The card sits well inside it — the numbers are reported by the check — and a
// map that dressed every cell would be caught here instead of on a slow machine.
export const FLOOR_ANIM_BUDGET = 0.25;

// ---------------------------------------------------------------- the composition
//
// The card's composition, in tiles, measured from the middle of the map so the same
// rule works at any size: the dirt street with the stone plaza in it, then the asphalt
// kerb strip, then the paving sidewalk on the far side. Water is deliberately absent.
//
// Every band is at least two rows deep, and that is a rule and not a taste: a one-row
// band would give a cell one material above it and another below it, two pairs at
// once, and one mask cannot draw two pairs — one of its sides would have to stay a
// hard seam. Two rows and a margin keep every cell's neighbourhood to a single other
// material, which is what lets one mask describe a whole cell's edge.
const SIDEWALK_ROWS = 3;
const ROAD_ROWS = 4;
const SQUARE_ROWS = 4;
// The plaza sits inside the street with two rows of dirt on every side a cell can see:
// no street cell may border the kerb strip and the plaza at once, not even across a
// corner, because a corner is where a pocket mask lives.
const PLAZA_MARGIN = 2;
const PLAZA_ROWS = 5;
const PLAZA_COLS = 13;

// ---------------------------------------------------------------------- the map

// The map of the card: a material id per cell, row by row. Deterministic for its size
// and independent of the window, because the card asks for the world in tiles and the
// world does not change with the resolution (S2 of the task).
export function floorMap(tilesW, tilesH, opts = {}) {
  const w = Math.max(1, Math.round(tilesW));
  const h = Math.max(1, Math.round(tilesH));
  const cells = new Array(w * h).fill('grass');

  const band = (row, rows, material) => {
    for (let ty = Math.max(0, row); ty < Math.min(h, row + rows); ty++) {
      for (let tx = 0; tx < w; tx++) cells[ty * w + tx] = material;
    }
  };

  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  // Cross-section, top to bottom: the buildings' sidewalk, the kerb, the road, and the
  // square on the far side — the order a street actually has, instead of the stacked
  // bands the forced pairs produced. Every band spans the map: an inset square under a
  // full-width road would leave road cells bordering both the field and the square, and
  // one mask cannot draw two pairs.
  const top = cy - Math.floor((SIDEWALK_ROWS + ROAD_ROWS) / 2) - 2;
  band(top, SIDEWALK_ROWS, 'paving');
  band(top + SIDEWALK_ROWS, ROAD_ROWS, 'asphalt');
  band(top + SIDEWALK_ROWS + ROAD_ROWS, SQUARE_ROWS, 'plaza');

  return {
    tilesW: w,
    tilesH: h,
    cells,
    seed: Number.isFinite(opts.seed) ? Math.round(opts.seed) : FLOOR_SEED,
    dressing: Number.isFinite(opts.dressing) ? opts.dressing : FLOOR_DRESSING,
  };
}

function asMap(map) {
  if (!map || !Array.isArray(map.cells)) throw new Error('not a floor map: expected { tilesW, tilesH, cells }');
  if (!Number.isInteger(map.tilesW) || !Number.isInteger(map.tilesH)) throw new Error('a floor map needs integer tilesW and tilesH');
  if (map.cells.length !== map.tilesW * map.tilesH) {
    throw new Error(`floor map holds ${map.cells.length} cells, expected ${map.tilesW * map.tilesH}`);
  }
  return map;
}

const materialAt = (map, tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= map.tilesW || ty >= map.tilesH) return null;
  return map.cells[ty * map.tilesW + tx];
};

const isWater = (kind) => !!(TERRAIN[kind] && TERRAIN[kind].flow);
const waterDir = (kind) => (TERRAIN[kind].dir === 'v' ? 'v' : 'h');

// --------------------------------------------------------------------- a cell

// The four sides and the four diagonals, with the bit each one sets in the mask.
const SIDES = [
  ['n', 0, -1, 1],
  ['e', 1, 0, 2],
  ['s', 0, 1, 4],
  ['w', -1, 0, 8],
];
const DIAGONALS = [
  ['ne', 1, -1, 1],
  ['se', 1, 1, 2],
  ['sw', -1, 1, 4],
  ['nw', -1, -1, 8],
];

// Which material wins when a cell really does border two of them. It cannot happen on
// the card's map — the bands and the plaza margin see to that — so this is the answer
// for a future map and not a path the card takes: the material on the most sides, then
// the one on the most diagonals, then catalogue order.
function pairMaterial(counts) {
  const order = (kind) => {
    const i = FLOOR_MATERIALS.indexOf(kind);
    return i < 0 ? FLOOR_MATERIALS.length : i;
  };
  return [...counts.keys()].sort((a, b) => {
    const A = counts.get(a);
    const B = counts.get(b);
    if (B.sides !== A.sides) return B.sides - A.sides;
    if (B.diagonals !== A.diagonals) return B.diagonals - A.diagonals;
    return order(a) - order(b);
  })[0];
}

// The curated pair two materials make, in the catalogue's order: dominant first. The
// catalogue is the only place that order lives, so the seam is painted by the same
// ground the gallery paints it with, and `null` means the town has no such seam yet.
function curatedPair(a, b) {
  for (const [first, second] of TRANSITION_PAIRS) {
    if ((first === a && second === b) || (first === b && second === a)) return [first, second];
  }
  return null;
}

// One cell of the map, as data: its material, the pair and the mask its neighbours ask
// for, its variant from the per-cell picker, and the decal it wears if any.
export function floorCell(tx, ty, map) {
  const m = asMap(map);
  const x = Math.floor(tx);
  const y = Math.floor(ty);
  if (x < 0 || y < 0 || x >= m.tilesW || y >= m.tilesH) {
    throw new Error(`floor cell ${tx},${ty} is outside the ${m.tilesW}x${m.tilesH} map`);
  }
  const seed = Number.isFinite(m.seed) ? m.seed : FLOOR_SEED;
  const dressing = Number.isFinite(m.dressing) ? m.dressing : FLOOR_DRESSING;
  const material = m.cells[y * m.tilesW + x];

  // Which materials the neighbours carry, and on which sides: the mask is read from
  // the neighbours, never written per cell (S3 of the task).
  const counts = new Map();
  const bump = (kind, side, diagonal, bit) => {
    if (!kind || kind === material) return;
    const entry = counts.get(kind) ?? { sides: 0, diagonals: 0, bits: 0, diag: 0 };
    if (side) {
      entry.sides++;
      entry.bits |= bit;
    } else {
      entry.diagonals++;
      entry.diag |= bit;
    }
    counts.set(kind, entry);
  };
  for (const [, dx, dy, bit] of SIDES) bump(materialAt(m, x + dx, y + dy), true, false, bit);
  for (const [, dx, dy, bit] of DIAGONALS) bump(materialAt(m, x + dx, y + dy), false, true, bit);

  // A water cell is its own tile: the bank belongs to the land beside it, so a water
  // cell carries no fringe of its own (the gallery's composed sample works the same).
  const other = !isWater(material) && counts.size ? pairMaterial(counts) : null;
  const pair = other ? curatedPair(material, other) : null;
  const shape = other ? counts.get(other) : null;
  // A seam is painted once, by the dominant ground of its pair: the grass paints the
  // fringe over the dirt, the plaza over the track, the asphalt over the dirt and the
  // paving over the asphalt (the kerb). The other side stays a plain tile, which is
  // exactly the rule the gallery's composed sample proves — no seam is ever drawn twice.
  const paints = !!(pair && pair[0] === material);
  const mask = paints ? transitionMask(shape.bits, shape.diag) : 'fill';

  // What the cell wears. A seam wears nothing: a decal on a fringe would sit half on
  // the ground it does not grow on, and the fringes are the one place the floor has to
  // stay clean. A bank is the exception, because reeds are what a bank is dressed with.
  const bank = paints && pair && isWater(pair[1]) ? pair[1] : null;
  let decal = null;
  if (bank) decal = reedAt(x, y, seed);
  else if (!other) {
    // the ground's list is the catalogue's answer to "what may grow here", and an
    // empty list is a real answer: decalAt would fall back to every kind, so the guard
    // is what keeps water bare
    const dressingKinds = decalDressing(material);
    if (dressingKinds.length) decal = decalAt(x, y, dressingKinds, seed, dressing);
  }

  return {
    tx: x,
    ty: y,
    material,
    other,
    pair,
    paints,
    mask,
    bits: shape ? shape.bits : 0,
    diagonals: shape ? shape.diag : 0,
    variant: terrainCell(material, x, y, seed),
    decal,
    bank,
    water: isWater(material) ? material : null,
  };
}

// A bank wears reeds on a share of its cells, picked by the same hash the catalogue
// picks variants with: nothing is placed by hand and two bakes agree (S9).
const REEDS = reedKinds();
const REED_SALT = hash32(7, 11, 0x5eed);

function reedAt(tx, ty, seed) {
  if (!REEDS.length) return null;
  const h = hash32(tx, ty, REED_SALT + seed * 7919);
  if ((h % 1024) / 1024 >= SHORE_REEDS) return null;
  const kind = REEDS[(h >>> 10) % REEDS.length];
  return { kind, variant: (h >>> 20) % 3 };
}

// --------------------------------------------------------------- the two layers

// The tile a cell's ground is painted from: the water itself, a transition when a
// neighbour asks for one, or a plain tile. `frame` is 0 for the static layer and the
// clock's frame for the few cells a frame repaints.
function groundSprite(cell, frame = 0) {
  if (cell.water) return waterTile(cell.water, waterDir(cell.water), frame, cell.variant);
  if (cell.paints) return transitionTile(cell.pair[0], cell.pair[1], cell.mask, cell.variant, frame);
  return terrainTile(cell.material, cell.variant);
}

// How many frames a kind on the floor has: a reed reads its own table, a decal the
// catalogue's. One lookup, so nothing downstream has to know which of the two it holds.
const framesOfDecal = (kind, state) => (REED_ANIM[kind] ? REED_ANIM[kind].frames : decalFrames(kind, state));

// The cells whose pixels a frame has to repaint: the water, the land of a bank (its
// water carries the frame while the land stays pixel-identical), and the dressing that
// moves — the reeds, the tufts, the flowers, the leaves, the moss, and the grate once
// it is raining. Everything else is in the static layer and is never touched again.
export function floorAnimated(map, opts = {}) {
  const m = asMap(map);
  const state = typeof opts.state === 'string' && opts.state ? opts.state : null;
  const cells = [];
  for (let ty = 0; ty < m.tilesH; ty++) {
    for (let tx = 0; tx < m.tilesW; tx++) {
      const cell = floorCell(tx, ty, m);
      const moving = cell.water ? cell.water : cell.bank ? cell.bank : cell.decal ? cell.decal.kind : null;
      if (!moving) continue;
      if (!cell.water && !cell.bank && framesOfDecal(moving, state) < 2) continue;
      cells.push({
        tx,
        ty,
        x: tx * TILE,
        y: ty * TILE,
        kind: moving,
        material: cell.material,
        variant: cell.variant,
        pair: cell.pair,
        mask: cell.mask,
        decal: cell.decal,
        water: cell.water,
        bank: cell.bank,
      });
    }
  }
  return {
    map: m,
    state,
    cells,
    count: cells.length,
    budget: Math.ceil(FLOOR_ANIM_BUDGET * m.cells.length),
  };
}

// The pixels of those cells at one time: what the frame loop blits, and nothing else.
// Same time and same state give the same sprites; a different frame gives different
// pixels, because every animated kind has at least two of them (S7). A bank that wears
// reeds yields two items — the water in the bank and the reed over it — because they
// lean on two different rates and neither may borrow the other's frame.
export function floorFrame(anim, timeSec, state = null, frozen = false) {
  if (!anim || !Array.isArray(anim.cells)) throw new Error('not an animated floor: expected floorAnimated(...)');
  const st = typeof state === 'string' && state ? state : anim.state ?? null;
  const out = [];
  const push = (cell, kind, frame, sprite) =>
    out.push({ tx: cell.tx, ty: cell.ty, x: cell.x, y: cell.y, kind, frame, sprite });
  for (const cell of anim.cells) {
    if (cell.water) {
      const frame = cellFrame(cell.water, cell.tx, cell.ty, timeSec, frozen);
      push(cell, cell.water, frame, waterTile(cell.water, waterDir(cell.water), frame, cell.variant));
      continue;
    }
    if (cell.bank) {
      // the land of the bank is pixel-identical across the four frames; only the water
      // the fringe leaves open carries the frame
      const frame = cellFrame(cell.bank, cell.tx, cell.ty, timeSec, frozen);
      push(cell, cell.bank, frame, transitionTile(cell.pair[0], cell.pair[1], cell.mask, cell.variant, frame));
    }
    if (!cell.decal) continue;
    const kind = cell.decal.kind;
    const frame = cellFrame(kind, cell.tx, cell.ty, timeSec, frozen);
    const sprite = REED_ANIM[kind]
      ? reedTile(kind, frame, cell.decal.variant)
      : decalTile(kind, cell.decal.variant, frame, st);
    push(cell, kind, frame, sprite);
  }
  return out;
}

// A signature of the cells, so the cache key of a baked layer is the layer: a map built
// by hand with the same size and seed as the card's is still a different floor.
function mapSignature(map) {
  let h = 2166136261;
  for (let i = 0; i < map.cells.length; i++) {
    h ^= FLOOR_MATERIALS.indexOf(map.cells[i]) + 1;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The static layer: one sprite with the whole floor on it, painted once. The animated
// cells are left out of it on purpose — their decal is what the frame draws — so the
// two layers never paint the same pixels twice.
export function floorSprite(tilesW, tilesH, opts = {}) {
  const map = opts.map ? asMap(opts.map) : floorMap(tilesW, tilesH, opts);
  const state = typeof opts.state === 'string' && opts.state ? opts.state : null;
  const seed = Number.isFinite(map.seed) ? map.seed : FLOOR_SEED;
  const dressing = Number.isFinite(map.dressing) ? map.dressing : FLOOR_DRESSING;
  const key = `floor|${map.tilesW}x${map.tilesH}|${seed}|${dressing}|${state ?? '-'}|${mapSignature(map)}`;
  return cacheSprite(cache, key, () => {
    const p = new Painter(map.tilesW * TILE, map.tilesH * TILE);
    const still = [];
    for (let ty = 0; ty < map.tilesH; ty++) {
      for (let tx = 0; tx < map.tilesW; tx++) {
        const cell = floorCell(tx, ty, map);
        p.blit(groundSprite(cell), cell.tx * TILE, cell.ty * TILE);
        if (!cell.decal) continue;
        // the dressing that holds still is painted once; the rest belongs to the frame
        if (framesOfDecal(cell.decal.kind, state) > 1) continue;
        still.push(cell);
      }
    }
    for (const cell of still) {
      p.blit(decalTile(cell.decal.kind, cell.decal.variant, 0, state), cell.tx * TILE, cell.ty * TILE);
    }
    return { canvas: p.canvas, w: p.w, h: p.h, map, animated: floorAnimated(map, { state }) };
  });
}
