// Calibration card v2: the proportion contract drawn at real scale, with a
// template that checks a door against an NPC, and the guaranteed-visible rect.

import './gallery.css';

import {
  computeView,
  computeCamera,
  applyView,
  TILE,
  WORLD_W,
  WORLD_H,
  SAFE_W,
  SAFE_H,
  TARGET_H,
} from './scale.js';
import { SPEC, doorFitsNpc } from './art-spec.js';
import { buildingSprite, gallerySpecs, variantFor, STREET_TYPES } from './buildings.js';
import {
  TERRAIN,
  TERRAIN_PAGES,
  terrainKinds,
  terrainTile,
  terrainCell,
  terrainPatch,
  transitionTile,
  transitionPatch,
  transitionMask,
  transitionTreatment,
  transitionPairLabel,
  TRANSITION_MASKS,
  waterTile,
  waterFrames,
  WATER_FPS,
  cellFrame,
  reedTile,
  DECALS,
  decalSheet,
  decalTile,
  decalFrames,
  decalAt,
  decalDressing,
} from './terrain.js';
import {
  treeTopDown,
  personTopDown,
  kioskSprite,
  propTopDown,
  cableSprite,
  shadowBlob,
  TD_PALS,
} from './topdown-sprites.js';
import { floorSprite, floorFrame } from './floor.js';
import { createWalker, stepWalker, simulate, tileCenter } from './walker.js';
import { C, rgba, mix } from './palette.js';
import { drawText, lineWidth } from '../font.js';
import { makeRng } from '../rng.js';
const params = new URLSearchParams(location.search);
const targetH = Number(params.get('target')) || TARGET_H;
const zoom = Number(params.get('zoom')) || 0;
const showGrid = params.get('grid') !== '0';
// Each gallery is its own document (/gallery/buildings/, /gallery/terrain/) and says so
// on its body, so no page has to pass a mode through the query string.
const galleryKind = document.body.dataset.gallery ?? '';
const galleryMode = galleryKind === 'buildings';
const terrainMode = galleryKind === 'terrain';
const page = Number(params.get('page')) || 0;
const startPaused = params.get('pause') === '1';
const simSeconds = Number(params.get('sim')) || 0;
const showLabels = params.get('labels') !== '0';

// S7's animation driver: ?anim=0 or a reduced-motion preference freezes every
// animated cell at frame 0, and the frame otherwise comes from the same clock the
// walker runs on, so ?pause=1&sim=N reproduces a capture frame for frame. Nothing
// here multiplies a clock by a frame rate: that is frameIndex's job alone.
const reducedMotion =
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = params.get('anim') === '0' || reducedMotion;
let clock = simSeconds;

const canvas = document.getElementById('card');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const CX = WORLD_W / 2;
const CY = WORLD_H / 2;

// ------------------------------------------------------------------ scene

function buildScene() {
  const items = [];
  const add = (x, y, sprite, opts = {}) => {
    items.push({ x, y, sprite, ...opts });
    return items[items.length - 1];
  };

  // three catalogue buildings, so the street shows the variety in context
  const streetPlan = [
    [STREET_TYPES[0], 3, -190],
    [STREET_TYPES[1], 5, -40],
    [STREET_TYPES[2], 7, 120],
  ];
  for (const [type, seed, dx] of streetPlan) {
    const spec = variantFor(type, seed);
    add(CX + dx, CY - 70, buildingSprite(spec), {
      caption: `${type.toUpperCase()} ${spec.tilesW}x${spec.storeys}`,
    });
  }

  // trial: the street group stands on the square, not on the tarmac
  const STREET_DY = 46;

  // four directions + a walk frame
  const dirs = ['down', 'up', 'left', 'right'];
  dirs.forEach((dir, i) => {
    add(CX - 150 + i * 24, CY + 25 + STREET_DY, personTopDown(TD_PALS[i % TD_PALS.length], dir, i % 2));
  });
  add(CX - 150, CY + 45 + STREET_DY, { canvas: document.createElement('canvas'), w: 1, h: 1 }, { caption: 'NPC 12x20', invisible: true });

  // screens and street furniture
  add(CX - 40, CY + 30 + STREET_DY, kioskSprite('15C'), { caption: 'KIOSK 1x2' });
  add(CX - 8, CY + 30 + STREET_DY, propTopDown('vending'));
  add(CX + 22, CY + 30 + STREET_DY, propTopDown('bench'));
  add(CX + 40, CY + 28 + STREET_DY, propTopDown('barrel'));
  add(CX + 52, CY + 30 + STREET_DY, propTopDown('crate'));
  add(CX + 64, CY + 30 + STREET_DY, propTopDown('barrel', 2));
  add(CX + 92, CY + 30 + STREET_DY, propTopDown('lamp'), { shadow: false });
  add(CX + 122, CY + 30 + STREET_DY, propTopDown('lamp', 2), { shadow: false });
  add(CX + 140, CY + 30 + STREET_DY, propTopDown('planter'));
  add(CX + 166, CY + 30 + STREET_DY, treeTopDown(3), { caption: 'TREE 2x2' });
  add(CX + 210, CY + 30 + STREET_DY, treeTopDown(5, 'bush'), { caption: 'BUSH 1.5' });
  items.push({ x: CX + 107, y: CY + 7, sprite: cableSprite(32, 5), cable: true });

  // props row
  add(CX - 160, CY + 120, propTopDown('crate'));
  add(CX - 144, CY + 120, propTopDown('barrel'));
  add(CX - 128, CY + 120, propTopDown('planter'));
  add(CX - 108, CY + 120, propTopDown('vent'));
  add(CX - 80, CY + 120, treeTopDown(9), { caption: 'TREE' });
  add(CX - 160, CY + 138, { canvas: document.createElement('canvas'), w: 1, h: 1 }, { caption: '1x1 PROPS', invisible: true });

  items.sort((a, b) => a.y - b.y);
  return items;
}

const scene = buildScene();

// Buildings block the walker. Trees and props are decorative for now.
const blockers = scene
  .filter((i) => i.sprite.w > 40 && !i.cable && !i.invisible)
  .map((i) => ({
    x0: Math.floor((i.x - i.sprite.w / 2) / TILE),
    x1: Math.floor((i.x + i.sprite.w / 2) / TILE),
    y0: Math.floor((i.y - i.sprite.h) / TILE),
    y1: Math.floor(i.y / TILE),
  }));

const worldView = {
  blocked(tx, ty) {
    if (tx < 1 || ty < 1 || tx >= Math.floor(WORLD_W / TILE) - 1 || ty >= Math.floor(WORLD_H / TILE) - 1) return true;
    return blockers.some((b) => tx >= b.x0 && tx <= b.x1 && ty >= b.y0 && ty <= b.y1);
  },
};

const walker = createWalker({ x: CX - 140, y: CY + 30 + 46, seed: 4 });
if (simSeconds > 0) simulate(walker, simSeconds, worldView);

// ----------------------------------------------------------------- ground
//
// The floor is not drawn here any more: it is a tile map painted from the terrain
// catalogue (floor.js), which is where the materials, the transitions, the decals and
// the animation budget live. What stays here is the card's own composition: the world
// in tiles, handed to the map so the street is the same street at every resolution,
// and the field pattern beyond the world.
const FLOOR_TILES_W = Math.ceil(WORLD_W / TILE);
const FLOOR_TILES_H = Math.ceil(WORLD_H / TILE);

// Baked on the first card frame and never again: the galleries do not need it, and a
// static layer painted once is the whole point of the split (S7).
let floorLayer = null;
function floorOf() {
  if (!floorLayer) floorLayer = floorSprite(FLOOR_TILES_W, FLOOR_TILES_H);
  return floorLayer;
}

// The view can be larger than the world now (the field of view is fixed, not the
// crop), so everything outside the town is painted with this tileable meadow
// instead of a background colour: no letterbox bars, at any window size.
function bakeField() {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');
  const fieldRng = makeRng(4242);
  g.fillStyle = C.grass;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const x = fieldRng.int(0, size - 1);
    const y = fieldRng.int(0, size - 1);
    g.fillStyle = fieldRng.chance(0.55) ? C.grassDark : fieldRng.chance(0.5) ? C.grassLite : C.grassSun;
    g.fillRect(x, y, 1, 1);
  }
  return cv;
}

const fieldPattern = ctx.createPattern(bakeField(), 'repeat');

// ---------------------------------------------------------------- overlays

function caption(text, x, y, color = C.white) {
  const w = lineWidth(text);
  const tx = Math.round(x - w / 2);
  drawText(ctx, text, tx + 1, y + 1, C.ink);
  drawText(ctx, text, tx, y, color);
}

function dashedRect(x, y, w, h, color, dash = 5) {
  ctx.fillStyle = color;
  for (let i = 0; i < w; i += dash * 2) {
    ctx.fillRect(x + i, y, Math.min(dash, w - i), 1);
    ctx.fillRect(x + i, y + h - 1, Math.min(dash, w - i), 1);
  }
  for (let i = 0; i < h; i += dash * 2) {
    ctx.fillRect(x, y + i, 1, Math.min(dash, h - i));
    ctx.fillRect(x + w - 1, y + i, 1, Math.min(dash, h - i));
  }
}

function drawGrid() {
  if (!showGrid) return;
  for (let x = 0; x <= WORLD_W; x += TILE) {
    const major = x % (TILE * 5) === 0;
    ctx.fillStyle = major ? rgba('#ffffff', 0.13) : rgba('#ffffff', 0.045);
    ctx.fillRect(x, 0, 1, WORLD_H);
  }
  for (let y = 0; y <= WORLD_H; y += TILE) {
    const major = y % (TILE * 5) === 0;
    ctx.fillStyle = major ? rgba('#ffffff', 0.13) : rgba('#ffffff', 0.045);
    ctx.fillRect(0, y, WORLD_W, 1);
  }
}

// The proportion template: a door outline with an NPC standing next to it, so
// the rule "the door is taller than a person" is checked on screen.
function drawTemplate() {
  const baseY = CY + 132;
  const doorX = CX + 130;
  const door = SPEC.door;
  const npc = SPEC.npc;
  ctx.strokeStyle = rgba('#2ce8f5', 0.95);
  ctx.lineWidth = 1;
  ctx.strokeRect(doorX + 0.5, baseY - door.h + 0.5, door.w, door.h);
  const person = personTopDown(TD_PALS[2], 'down', 0);
  const personX = doorX + door.w + 18;
  ctx.drawImage(person.canvas, Math.round(personX - person.w / 2), Math.round(baseY - person.h));
  if (showLabels) {
    // labels on different rows: side by side they would collide at this scale
    caption(`DOOR ${door.w}x${door.h}`, doorX + door.w / 2, baseY - door.h - 10, C.neon);
    caption(`NPC ${npc.w}x${npc.h}`, personX, baseY + 4, C.neon);
  }
  // the four walk poses, at real scale, so the cycle can be judged
  const stripX = doorX + door.w + 40;
  for (let f = 0; f < 4; f++) {
    const pose = personTopDown(TD_PALS[1], 'right', f % 2);
    ctx.drawImage(pose.canvas, stripX + f * 14, baseY - pose.h - (f % 2));
  }
  if (showLabels) caption('WALK', stripX + 26, baseY + 4, C.neon);
  return doorFitsNpc();
}

function drawRuler() {
  const y = CY + 168;
  const x0 = CX - 120;
  const len = 240;
  ctx.fillStyle = rgba('#0b0e1a', 0.55);
  ctx.fillRect(x0 - 8, y - 10, len + 16, 30);
  ctx.fillStyle = C.white;
  ctx.fillRect(x0, y, len, 1);
  for (let i = 0; i <= len; i += TILE) {
    const major = i % (TILE * 4) === 0;
    ctx.fillStyle = major ? C.white : rgba('#ffffff', 0.5);
    ctx.fillRect(x0 + i, y - (major ? 4 : 2), 1, major ? 4 : 2);
  }
  for (let i = 0; i <= len; i += TILE * 4) caption(`${i}px`, x0 + i, y + 4);
  caption('1 TILE = 16px', x0 + len / 2, y - 8, C.lamp);
}

// A composite wing is captioned with both names, so a page cannot show an
// unexplained box: `GARAGE/HOUSE 3x1 flat` is a garage hung on a house.
// (The tiny face has no `@`, and src/font.js is out of reach here, so `/` it is.)
function galleryLabel(spec) {
  if (spec.annex) {
    const a = spec.annex;
    return `${a.type.toUpperCase()}/${spec.type.toUpperCase()} ${a.tiles}x1 ${a.roofStyle}`;
  }
  return `${spec.type.toUpperCase()} ${spec.tilesW}x${spec.storeys} ${spec.roofStyle}`;
}

// Floor catalogue: one page of TERRAIN_PAGES. Each row shows the material's
// label, its variants side by side at 1x and an 8x4-tile patch, which is what
// tells a seamless ground apart from a grid of copies.
const PATCH_TILES = [8, 4];
const COL_W = 96; // label plus the variant strip

// Transition pages show the whole set of one pair: the thirteen masks laid out as
// the set they are, and a composed blob where every cell picks its tile from its
// own neighbourhood. The blob is the part that proves the corners close. The page
// is four pairs in a 2x2 grid on a 822x487 logical view, so the tiles are drawn at
// 2x (64 physical px each in a review capture) and the blob at 1x.
const TRANS_TILE_Z = 2;
const TRANS_PATCH_Z = 1;
const TRANS_PATCH = [10, 6];
const TRANS_SEED = 4;

const PAGE_HINT_TINY = { font: 'tiny' };

// The menu is fixed in the top-right corner of every page, so a gallery leaves that strip
// empty instead of drawing a caption underneath it.
const GALLERY_TOP_ROOM = 26;

function drawTerrainGallery(view) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#14161f';
  ctx.fillRect(0, 0, view.w, view.h);

  const pageIndex = Math.min(Math.max(0, Math.floor(page)), TERRAIN_PAGES.length - 1);
  const entry = TERRAIN_PAGES[pageIndex];
  const pairs = entry.kind === 'pairs';
  const inner = { ...view, h: view.h - GALLERY_TOP_ROOM };

  ctx.save();
  ctx.translate(0, GALLERY_TOP_ROOM);
  drawText(ctx, `TERRAIN / ${entry.title}`, 14, 2, C.lamp, PAGE_HINT_TINY);
  let animated = 0;
  if (pairs) drawTransitionPage(inner, entry);
  else if (entry.kind === 'water') animated = drawWaterPage(inner, entry);
  else if (entry.kind === 'decals') animated = drawDecalPage(inner);
  else drawMaterialPage(inner, entry);
  ctx.restore();

  const shown = pairs
    ? `${entry.items.length} PAIRS · 13 TILES EACH · COMPOSED ${TRANS_PATCH[0]}x${TRANS_PATCH[1]}`
    : entry.kind === 'water'
      ? `${animated} ANIMATED CELLS ON SCREEN · ${frozen ? 'FROZEN' : `T ${clock.toFixed(2)}S`}`
      : entry.kind === 'decals'
        ? `${entry.items.length} DECALS · ${DECAL_GROUNDS.length} GROUNDS EACH · ${animated} ANIMATED CELLS · ${frozen ? 'FROZEN' : `T ${clock.toFixed(2)}S`}`
        : `${entry.items.length} OF ${Object.keys(TERRAIN).length} MATERIALS · PATCH ${PATCH_TILES[0]}x${PATCH_TILES[1]} TILES`;
  drawText(
    ctx,
    `PAGE ${pageIndex + 1}/${TERRAIN_PAGES.length} · ${shown}`,
    14,
    view.h - 11,
    C.lamp,
    { font: 'tiny' },
  );
  return true;
}

function drawMaterialPage(view, entry) {
  const cols = 2;
  const rows = 3;
  const top = 26;
  const bottom = 20;
  const cellW = Math.floor(view.w / cols);
  const cellH = Math.floor((view.h - top - bottom) / rows);
  const patchW = PATCH_TILES[0] * TILE;
  const patchH = PATCH_TILES[1] * TILE;

  entry.items.forEach((kind, i) => {
    const spec = TERRAIN[kind];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = col * cellW;
    const cy = top + row * cellH;
    const contentW = COL_W + patchW;
    const x0 = cellX + Math.max(14, Math.round((cellW - contentW) / 2));
    const top0 = cy + Math.round((cellH - patchH) / 2);

    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(cellX + 8, cy - 5, cellW - 16, 1);

    drawText(ctx, spec.label, x0, top0 + 4, C.stoneLite, { font: 'tiny' });
    drawText(ctx, `${spec.pattern.toUpperCase()} ${spec.variants}V`, x0, top0 + 13, C.slate, { font: 'tiny' });

    // the variants, side by side, at the size they are drawn in town
    for (let v = 0; v < spec.variants; v++) {
      const spr = terrainTile(kind, v);
      ctx.drawImage(spr.canvas, x0 + v * (TILE + 2), top0 + 24);
    }

    // and the material in context: a patch, chosen per cell and not tiled by hand
    const patch = terrainPatch(kind, PATCH_TILES[0], PATCH_TILES[1], 3);
    ctx.drawImage(patch.canvas, x0 + COL_W, top0);
  });
}

function drawTransitionPage(view, entry) {
  const cols = 2;
  const rows = 2;
  const top = 26;
  const bottom = 22;
  const cellW = Math.floor(view.w / cols);
  const cellH = Math.floor((view.h - top - bottom) / rows);
  const t = TILE * TRANS_TILE_Z;
  const step = t + 10; // tile plus its caption
  // the nine straight masks are the 3x3 block, fill, edges and convex corners; the
  // four concave ones get their own row because they are their own case
  const straight = TRANSITION_MASKS.filter((mask) => !mask.startsWith('in'));
  const concave = TRANSITION_MASKS.filter((mask) => mask.startsWith('in'));
  const patch = { w: TRANS_PATCH[0] * TILE, h: TRANS_PATCH[1] * TILE };

  entry.items.forEach((pair, i) => {
    const [a, b] = pair;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellW;
    const cy = top + row * cellH;

    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(cx + 8, cy - 5, cellW - 16, 1);

    drawText(ctx, transitionPairLabel(pair), cx + 14, cy + 2, C.stoneLite, { font: 'tiny' });
    drawText(ctx, transitionTreatment(a, b).toUpperCase(), cx + 14, cy + 11, C.slate, { font: 'tiny' });

    const mx = cx + 14;
    const my = cy + 26;
    const tile = (mask, x, y) => {
      const spr = transitionTile(a, b, mask, 0);
      ctx.drawImage(spr.canvas, x, y, t, t);
      drawText(ctx, mask, x, y + t + 2, C.slate, { font: 'tiny' });
    };

    straight.forEach((mask, k) => {
      tile(mask, mx + (k % 3) * step, my + Math.floor(k / 3) * step);
    });
    concave.forEach((mask, k) => {
      tile(mask, mx + k * step, my + 3 * step + 4);
    });

    // the composed blob: only masks, nothing hand-placed, which is what proves the
    // corners close and the fringes do not double up
    const blob = transitionPatch(a, b, TRANS_PATCH[0], TRANS_PATCH[1], TRANS_SEED);
    const px = mx + 3 * step + 16;
    ctx.drawImage(blob.canvas, px, my, patch.w * TRANS_PATCH_Z, patch.h * TRANS_PATCH_Z);
    drawText(
      ctx,
      `COMPOSED ${TRANS_PATCH[0]}x${TRANS_PATCH[1]}`,
      px,
      my + patch.h * TRANS_PATCH_Z + 4,
      C.slate,
      { font: 'tiny' },
    );
  });
}

// ------------------------------------------------------------ water gallery
//
// Page five is the animated page (S8): the frames themselves as labelled strips, a
// live patch of each water, a shore pair whose land must not move, the reeds over a
// bank, and one composed sample — a stream bending into a pond — driven by the same
// clock as everything else. The footer reports the animated-cell count, which is
// what makes S7's budget visible instead of polite.

const WATER_Z = 2;
const WATER_STEP = TILE * WATER_Z + 6;

// S = stream, P = pond, . = land. The stream enters on the left, runs east and opens
// into a pond in the bottom corner; every land cell picks its tile from its own
// neighbourhood, so the bank closes by construction instead of by hand-placing a
// bank tile.
const WATER_SAMPLE = [
  '..........',
  '.SSSS.....',
  'SSSSSSSPP.',
  '..SSSSSPP.',
  '.......PP.',
];

function drawWaterPage(view, entry) {
  const [flowKind, stillKind] = entry.items;
  const cols = 2;
  const rows = 3;
  const top = 26;
  const bottom = 22;
  const cellW = Math.floor(view.w / cols);
  const cellH = Math.floor((view.h - top - bottom) / rows);
  const z = TILE * WATER_Z;
  const tiny = (text, x, y, color = C.slate) => drawText(ctx, text, x, y, color, { font: 'tiny' });
  let animated = 0;

  const head = (i, title, sub) => {
    const x = (i % cols) * cellW;
    const y = top + Math.floor(i / cols) * cellH;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + 8, y - 5, cellW - 16, 1);
    drawText(ctx, title, x + 14, y + 2, C.stoneLite, { font: 'tiny' });
    tiny(sub, x + 14, y + 11);
    return { x: x + 14, y: y + 22 };
  };

  // the four frames of one water in one direction, at 2x
  const strip = (kind, dir, x, y) => {
    for (let f = 0; f < waterFrames(kind); f++) {
      ctx.drawImage(waterTile(kind, dir, f).canvas, x + f * WATER_STEP, y, z, z);
      tiny(`F${f}`, x + f * WATER_STEP + 2, y + z + 2);
    }
  };

  // a live patch: every cell takes its own frame from the clock and its own phase
  // from its coordinates, which is the rule S7 asks for
  const patch = (kind, dir, x, y, w, h, seed) => {
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const f = cellFrame(kind, tx + seed, ty, clock, frozen);
        const v = terrainCell(kind, tx, ty, seed);
        ctx.drawImage(waterTile(kind, dir, f, v).canvas, x + tx * TILE, y + ty * TILE);
        animated++;
      }
    }
  };

  // a shore strip: the land row is the pair's tile, the water row is the water
  // itself, so the land can be compared pixel for pixel across the four frames
  const shore = (kind, x, y, w, frame) => {
    for (let tx = 0; tx < w; tx++) {
      const land = terrainCell('grass', tx, 0, 2);
      ctx.drawImage(transitionTile('grass', kind, 's', land, frame).canvas, x + tx * TILE, y);
      ctx.drawImage(waterTile(kind, 'h', frame, terrainCell(kind, tx, 1, 2)).canvas, x + tx * TILE, y + TILE);
    }
  };

  // --- the stream: four frames in both directions
  {
    const o = head(0, 'STREAM · CURRENT', `FLOWING · FPS ${WATER_FPS.water} · ${waterFrames(flowKind)} FRAMES`);
    strip(flowKind, 'h', o.x, o.y);
    strip(flowKind, 'v', o.x, o.y + z + 14);
    tiny('DIR H', o.x + 4 * WATER_STEP + 6, o.y + 12, C.stoneLite);
    tiny('DIR V', o.x + 4 * WATER_STEP + 6, o.y + z + 26, C.stoneLite);
  }

  // --- and the stream in the field, live
  {
    const o = head(1, `${TERRAIN[flowKind].label} · PATCH`, 'LIVE · ONE PHASE PER CELL');
    patch(flowKind, 'h', o.x, o.y, 8, 4, 5);
    tiny('8x4 CELLS', o.x, o.y + 4 * TILE + 4);
  }

  // --- the pond: frames and a live patch
  {
    const o = head(2, `${TERRAIN[stillKind].label} · STILL`, `NO CURRENT · FPS ${WATER_FPS.waterStill} · ${waterFrames(stillKind)} FRAMES`);
    strip(stillKind, 'h', o.x, o.y);
    patch(stillKind, 'h', o.x, o.y + z + 14, 6, 3, 3);
    tiny('6x3 LIVE', o.x + 6 * TILE + 6, o.y + z + 14 + 4, C.stoneLite);
  }

  // --- one shore pair: the land row must be pixel-identical across the frames
  {
    const o = head(3, transitionPairLabel(['grass', flowKind]), 'THE LAND STAYS PUT, THE WATER MOVES');
    const w = 3;
    const stepX = w * TILE + 8;
    for (let f = 0; f < waterFrames(flowKind); f++) {
      shore(flowKind, o.x + f * stepX, o.y, w, f);
      tiny(`F${f}`, o.x + f * stepX + 2, o.y + 2 * TILE + 2);
    }
    for (let f = 0; f < waterFrames(stillKind); f++) {
      shore(stillKind, o.x + f * stepX, o.y + 2 * TILE + 16, w, f);
      tiny(`F${f}`, o.x + f * stepX + 2, o.y + 4 * TILE + 18);
    }
  }

  // --- the reeds: a decal over a bank, three frames of lean each
  {
    const o = head(4, 'REEDS OVER A BANK', 'DECALS · 3 FRAMES OF LEAN');
    const w = 5;
    const stepX = w * TILE + 10;
    for (const kind of ['reeds', 'sedge']) {
      for (let f = 0; f < 3; f++) {
        const x = o.x + f * stepX;
        const y = o.y + (kind === 'reeds' ? 0 : 2 * TILE + 16);
        for (let tx = 0; tx < w; tx++) {
          const land = terrainCell('grass', tx, 9, 2);
          ctx.drawImage(transitionTile('grass', flowKind, 's', land, 0).canvas, x + tx * TILE, y);
          ctx.drawImage(waterTile(flowKind, 'h', 0, terrainCell(flowKind, tx, 8, 2)).canvas, x + tx * TILE, y + TILE);
          // the decal stands on the land row and leans over the water
          ctx.drawImage(reedTile(kind, f, tx % 3).canvas, x + tx * TILE, y);
        }
        tiny(`${kind.toUpperCase()} F${f}`, x + 2, y + 2 * TILE + 2, C.stoneLite);
      }
    }
  }

  // --- the composed sample: a stream bending into a pond, live
  {
    const o = head(5, 'STREAM BEND INTO A POND', 'COMPOSED · LIVE');
    const grid = WATER_SAMPLE;
    const h = grid.length;
    const w = grid[0].length;
    const wetAt = (tx, ty) => {
      const ch = ty < 0 || ty >= h || tx < 0 || tx >= w ? '.' : grid[ty][tx];
      return ch === 'S' ? flowKind : ch === 'P' ? stillKind : null;
    };
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const kind = wetAt(tx, ty);
        const x = o.x + tx * TILE;
        const y = o.y + ty * TILE;
        const variant = terrainCell(kind ?? 'grass', tx, ty, 1);
        if (kind) {
          ctx.drawImage(waterTile(kind, 'h', cellFrame(kind, tx, ty, clock, frozen), variant).canvas, x, y);
          animated++;
          continue;
        }
        // the land asks its own neighbourhood which sides carry water, and the
        // bank belongs to the pair the nearest water came from
        let bits = 0;
        let diag = 0;
        let bank = null;
        const set = (water, bit) => {
          if (!water) return;
          bits |= bit;
          bank = bank ?? water;
        };
        set(wetAt(tx, ty - 1), 1);
        set(wetAt(tx + 1, ty), 2);
        set(wetAt(tx, ty + 1), 4);
        set(wetAt(tx - 1, ty), 8);
        if (wetAt(tx + 1, ty - 1)) diag |= 1;
        if (wetAt(tx + 1, ty + 1)) diag |= 2;
        if (wetAt(tx - 1, ty + 1)) diag |= 4;
        if (wetAt(tx - 1, ty - 1)) diag |= 8;
        const frame = cellFrame(bank ?? flowKind, tx, ty, clock, frozen);
        const spr = bits || diag
          ? transitionTile('grass', bank ?? flowKind, transitionMask(bits, diag), variant, frame)
          : terrainTile('grass', variant);
        ctx.drawImage(spr.canvas, x, y);
      }
    }
    tiny(`${w}x${h} CELLS · LIVE`, o.x, o.y + h * TILE + 4);
  }

  return animated;
}

// ------------------------------------------------------------ decal gallery
//
// The last page is the ground dressing. A decal is transparent, so the only way to
// judge one is over ground: every strip is drawn twice, on a natural material and on
// an urban one, at 1x — the size it is drawn in town, which is the only size at which
// a strip can say whether a decal reads at all. Each state a decal declares gets its
// own row (flowers by day and by night, the grate dry and in the rain), and the foot of
// the page is a mixed floor with the dressing scattered by hash: what the street looks
// like when nobody places anything by hand.

const DECAL_GROUNDS = [
  { material: 'grass', label: 'GRASS' },
  { material: 'paving', label: 'PAVING' },
];

// The label columns are fixed, so the strips of the whole page line up whatever the
// number of frames a decal has.
const DECAL_STATE_W = lineWidth('NIGHT', { font: 'tiny' }) + 8;
const DECAL_GROUND_W = Math.max(...DECAL_GROUNDS.map((g) => lineWidth(g.label, { font: 'tiny' }))) + 6;
// a row is a tile plus its frame caption plus a breath: tight enough to stack four rows
// (flowers day and night over both grounds) and loose enough that a caption never
// touches the tile below it
const DECAL_ROW = TILE + 12;

// A small mixed floor for the scatter sample: g grass, d dirt, p paving, a asphalt,
// c cobble. The zones are contiguous on purpose: a floor picked per cell at random
// would read as noise and would prove nothing about a decal on a real street.
const SAMPLE_GROUND = { g: 'grass', d: 'dirt', p: 'paving', a: 'asphalt', c: 'cobble' };
const DECAL_SAMPLE = [
  'ggggppppaa',
  'ggggppppaa',
  'gggdppppaa',
  'gdddpppaaa',
  'ddccppaaaa',
  'dcccpppaaa',
];

// What each ground can wear comes from the catalogue and not from here: a decal declares
// the grounds it grows on and how common it is, so the gallery and the bake in T5 give
// the same answer. The rate is the gallery's own taste — what share of cells carries
// anything at all — and 34% is the point where a floor reads dressed instead of stamped.
const DRESSING_RATE = 0.34;

function drawDecalPage(view) {
  const cols = 4;
  const rows = 2;
  const top = 26;
  const bottom = 22;
  const band = 118; // the dressed floor at the foot of the page
  const cellW = Math.floor(view.w / cols);
  const cellH = Math.floor((view.h - top - bottom - band) / rows);
  const tiny = (text, x, y, color = C.slate) => drawText(ctx, text, x, y, color, { font: 'tiny' });
  let animated = 0;

  const head = (i, title, sub) => {
    const x = (i % cols) * cellW;
    const y = top + Math.floor(i / cols) * cellH;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + 8, y - 5, cellW - 16, 1);
    drawText(ctx, title, x + 14, y + 2, C.stoneLite, { font: 'tiny' });
    tiny(sub, x + 14, y + 11);
    return { x: x + 14, y: y + 20 };
  };

  // One decal over one ground: the ground is a real catalogue tile, chosen by the same
  // per-cell picker the world uses, and the decal is composited on top of it. If a
  // decal carried a base colour instead of transparency, this is where it would show.
  const over = (kind, variant, frame, state, material, x, y, cell) => {
    // the ground's own variant comes from the per-cell picker, so a strip shows a real
    // tile of the material and not one hand-picked face
    const ground = terrainTile(material, terrainCell(material, cell, cell + 1, 3));
    ctx.drawImage(ground.canvas, x, y);
    ctx.drawImage(decalTile(kind, variant, frame, state).canvas, x, y);
  };

  decalSheet().forEach(([kind, variants], i) => {
    const spec = DECALS[kind];
    const rate = spec.frames > 1 ? `${spec.frames}F · ${spec.fps} FPS` : 'STATIC';
    const o = head(i, `${spec.label} · ${variants}V`, spec.states.length ? `${rate} · ${spec.states.join('/').toUpperCase()}` : rate);
    // One face per strip: the variants are the sheet's business and the frames are the
    // page's, so a cell shows one decal over both grounds in every state it declares.
    const variant = i % variants;
    const states = spec.states.length ? spec.states : [null];
    let row = 0;
    for (const state of states) {
      const frames = decalFrames(kind, state);
      for (const ground of DECAL_GROUNDS) {
        const rowY = o.y + row * DECAL_ROW;
        if (state && ground === DECAL_GROUNDS[0]) tiny(state.toUpperCase(), o.x, rowY + 5, C.lamp);
        const colX = o.x + (state ? DECAL_STATE_W : 0);
        tiny(ground.label, colX, rowY + 5, C.stoneLite);
        let pen = colX + DECAL_GROUND_W;
        for (let f = 0; f < frames; f++) {
          over(kind, variant, f, state, ground.material, pen, rowY, 3 + f);
          if (frames > 1) tiny(`F${f}`, pen + 2, rowY + TILE + 2);
          pen += TILE + 2;
          if (frames > 1) animated++;
        }
        row++;
      }
    }
  });

  // The composed sample: a mixed floor and the dressing the hash puts on it. Nothing is
  // placed by hand, and no decal repeats in a visible lattice, because the kind and the
  // variant both come from the cell.
  {
    const y = top + rows * cellH + 4;
    // the seed is picked, not tuned: this one dresses every kind on the floor at least
    // once and leaves the asphalt with a grate, a patch and a crack
    const seed = 11;
    const w = DECAL_SAMPLE[0].length;
    const h = DECAL_SAMPLE.length;
    drawText(ctx, 'DRESSED FLOOR', 14, y, C.stoneLite, { font: 'tiny' });
    tiny(`COMPOSED ${w}x${h} · HASHED · ${Math.round(DRESSING_RATE * 100)}% DRESSED · ${frozen ? 'FROZEN' : 'LIVE'}`, 14, y + 9);
    const ox = 14;
    const oy = y + 20;
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const material = SAMPLE_GROUND[DECAL_SAMPLE[ty][tx]] ?? 'grass';
        const x = ox + tx * TILE;
        const yy = oy + ty * TILE;
        ctx.drawImage(terrainTile(material, terrainCell(material, tx, ty, seed)).canvas, x, yy);
        const wear = decalAt(tx, ty, decalDressing(material), seed, DRESSING_RATE);
        if (!wear) continue;
        const frame = cellFrame(wear.kind, tx, ty, clock, frozen);
        ctx.drawImage(decalTile(wear.kind, wear.variant, frame).canvas, x, yy);
        if (DECALS[wear.kind].frames > 1) animated++;
      }
    }
    // what the sample is dressed with, and why: the ground picks the list, the cell picks
    // the decal from it, and nothing is placed by hand. The list is the catalogue's, so
    // the legend is the rule and not a copy of it.
    const legendX = ox + w * TILE + 24;
    tiny('WHAT A GROUND CAN WEAR', legendX, oy + 4, C.stoneLite);
    const dressed = terrainKinds().filter((material) => decalDressing(material).length > 0);
    // two columns, six lines each, so the legend fits under the same band as the floor
    const perCol = Math.ceil(dressed.length / 2);
    dressed.forEach((material, k) => {
      const col = Math.floor(k / perCol);
      const row = k % perCol;
      const list = [...new Set(decalDressing(material))].join(' ');
      tiny(`${TERRAIN[material].label} · ${list}`, legendX + col * 300, oy + 15 + row * 9);
    });
  }

  return animated;
}

function drawGallery(view) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#14161f';
  ctx.fillRect(0, 0, view.w, view.h);
  const specs = gallerySpecs(1);
  const perPage = GALLERY_PER_PAGE;
  const cols = 3;
  const inner = { ...view, h: view.h - GALLERY_TOP_ROOM };
  const top = 6;
  const cellW = Math.floor(inner.w / cols);
  const cellH = Math.floor((inner.h - top - 14) / 3);
  const items = specs.slice(page * perPage, page * perPage + perPage);
  ctx.save();
  ctx.translate(0, GALLERY_TOP_ROOM);
  items.forEach((spec, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellW + cellW / 2;
    const cy = top + row * cellH + cellH - 6;
    const spr = buildingSprite(spec);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(col * cellW + 6, cy + 1, cellW - 12, 1);
    ctx.drawImage(spr.canvas, Math.round(cx - spr.w / 2), Math.round(cy - spr.h));
    const label = galleryLabel(spec);
    const lw = lineWidth(label, PAGE_HINT_TINY);
    drawText(ctx, label, Math.round(cx - lw / 2), top + row * cellH + 2, C.stoneLite, PAGE_HINT_TINY);
    const dims = `${spr.w}x${spr.h}`;
    const dw = lineWidth(dims, PAGE_HINT_TINY);
    drawText(ctx, dims, Math.round(cx - dw / 2), top + row * cellH + 9, C.slate, PAGE_HINT_TINY);
  });
  ctx.restore();
  const pages = Math.ceil(specs.length / perPage);
  drawText(ctx, `GALLERY ${page + 1}/${pages} · ${specs.length} variants`, 8, view.h - 9, C.lamp, PAGE_HINT_TINY);
  return true;
}

// ------------------------------------------------------- gallery page links
// A gallery paginates on the canvas, which used to mean a line of text spelling
// out the URL of every page. The links at the foot of the page are the same
// navigation, clickable: they carry every other query parameter over, so a frozen
// capture (?anim=0) or a reproducible one (?pause=1&sim=N) survives a page change.
const GALLERY_PER_PAGE = 9;

function pageHref(index) {
  const next = new URLSearchParams(location.search);
  next.set('page', String(index));
  return `?${next.toString()}`;
}

function renderPageNav(titles) {
  const nav = document.getElementById('pages');
  if (!nav || titles.length === 0) return;
  const last = titles.length - 1;
  const at = Math.min(Math.max(0, Math.floor(page)), last);
  const add = (label, index, title, arrow = false) => {
    const link = document.createElement('a');
    link.textContent = label;
    link.title = title;
    if (arrow && index === at) {
      // the end of the list: the arrow is still there, but there is nowhere to go
      link.setAttribute('aria-disabled', 'true');
    } else {
      link.href = pageHref(index);
      if (index === at) link.setAttribute('aria-current', 'page');
    }
    nav.append(link);
  };
  if (titles.length > 1) add('‹', Math.max(0, at - 1), 'previous page', true);
  titles.forEach((title, i) => add(String(i + 1), i, `${i + 1} · ${title}`));
  if (titles.length > 1) add('›', Math.min(last, at + 1), 'next page', true);
  nav.hidden = false;
}

function draw(view) {
  if (terrainMode) return drawTerrainGallery(view);
  if (galleryMode) return drawGallery(view);
  const cam = computeCamera(view);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = fieldPattern || C.grass;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  const floor = floorOf();
  // the static layer, one blit, cropped to the world (the map is a whole number of
  // tiles and the world is not); then only the cells whose pixels move this frame
  ctx.drawImage(floor.canvas, 0, 0, WORLD_W, WORLD_H, 0, 0, WORLD_W, WORLD_H);
  for (const item of floorFrame(floor.animated, clock, null, frozen)) {
    ctx.drawImage(item.sprite.canvas, item.x, item.y);
  }

  const drawables = scene.filter((i) => !i.invisible);
  drawables.push({ x: walker.x, y: walker.y, walker: true });
  drawables.sort((a, b) => a.y - b.y);

  for (const item of drawables) {
    if (item.walker) {
      const spr = personTopDown(TD_PALS[1], walker.dir, walker.frame);
      const blob = shadowBlob(12, 4);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(blob.canvas, Math.round(walker.x - blob.w / 2), Math.round(walker.y - 2));
      ctx.globalAlpha = 1;
      ctx.drawImage(spr.canvas, Math.round(walker.x - spr.w / 2), Math.round(walker.y - spr.h + walker.bob));
      continue;
    }
    if (item.shadow !== false && !item.cable) {
      const blob = shadowBlob(Math.max(10, Math.round(item.sprite.w * 0.7)), 5);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(blob.canvas, Math.round(item.x - blob.w / 2), Math.round(item.y - 3));
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(item.sprite.canvas, Math.round(item.x - item.sprite.w / 2), Math.round(item.y - item.sprite.h));
  }

  if (showLabels) {
    for (const item of scene) {
      if (!item.caption) continue;
      caption(item.caption, item.x, item.y + 4);
    }
  }

  ctx.strokeStyle = rgba('#2ce8f5', 0.9);
  ctx.lineWidth = 1;
  ctx.strokeRect(CX - 161.5, CY + 103.5, TILE, TILE);

  drawGrid();

  const sx = Math.round((WORLD_W - SAFE_W) / 2);
  const sy = Math.round((WORLD_H - SAFE_H) / 2);
  dashedRect(sx, sy, SAFE_W, SAFE_H, rgba('#2ce8f5', 0.85));
  if (showLabels) caption(`SAFE ${SAFE_W}x${SAFE_H}`, sx + SAFE_W / 2, sy - 8, C.neon);

  const doorOk = drawTemplate();
  drawRuler();

  drawText(ctx, `WORLD ${WORLD_W}x${WORLD_H}  TILE ${TILE}`, 13, 11, C.ink, { font: 'tiny' });
  drawText(ctx, `WORLD ${WORLD_W}x${WORLD_H}  TILE ${TILE}`, 12, 10, C.white, { font: 'tiny' });

  ctx.restore();
  return doorOk;
}

// ------------------------------------------------------------------- boot

const panel = document.getElementById('readout');
let paused = startPaused;
let view = null;
let panelTick = 0;

function updatePanel() {
  if (!panel) return;
  const cam = computeCamera(view);
  panel.innerHTML = [
    `<b>window</b> ${window.innerWidth}x${window.innerHeight} · ${(window.innerWidth / window.innerHeight).toFixed(2)}:1`,
    `<b>scale</b> ${view.scalePhys}px físico${view.forced ? ' (forced)' : ` · ${view.scaleCss.toFixed(2)}x CSS · dpr ${view.dpr}`}`,
    `<b>field</b> target ${targetH}px · ${view.tilesH.toFixed(0)} tiles tall`,
    `<b>logical</b> ${view.w}x${view.h} → canvas ${view.cssW}x${view.cssH}`,
    `<b>tiles</b> ${view.tilesW.toFixed(1)} x ${view.tilesH.toFixed(1)}`,
    `<b>safe ${SAFE_W}x${SAFE_H}</b> ${view.safeFits ? 'fully visible' : 'CROPPED'}`,
    `<b>contract</b> npc ${SPEC.npc.w}x${SPEC.npc.h} · door ${SPEC.door.w}x${SPEC.door.h} · facade ${SPEC.facade}`,
    `<b>door vs npc</b> ${doorFitsNpc() ? 'ok' : 'TOO SHORT'}`,
    `<b>walker</b> tile ${walker.tx},${walker.ty} · ${walker.dir} · ${walker.state}${paused ? ' · PAUSED' : ''}`,
    `<b>camera</b> ${cam.x},${cam.y}`,
    // S7's cost, on the card: how much of the floor a frame actually repaints
    ...(floorLayer
      ? [
          `<b>floor</b> ${floorLayer.animated.map.cells.length} cells · ${floorLayer.animated.count} animated${frozen ? ' · FROZEN' : ''}`,
        ]
      : []),
  ].join('<br>');
}

function layout() {
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  view = computeView(cssW, cssH, window.devicePixelRatio || 1, zoom, targetH);
  applyView(canvas, view, cssW, cssH);
  draw(view);
  updatePanel();
}

const FIXED = 1 / 60;
let last = performance.now();
let acc = 0;

function tick(now) {
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) {
    acc += raw;
    while (acc >= FIXED) {
      stepWalker(walker, FIXED, worldView);
      // the floor's clock: stepped in the same fixed quanta as the walker, so a
      // frame never depends on the frame rate of the machine that drew it
      clock += FIXED;
      acc -= FIXED;
    }
  }
  draw(view);
  if (++panelTick % 10 === 0) updatePanel();
  requestAnimationFrame(tick);
}

if (galleryMode || terrainMode) {
  // a gallery page carries no panels: the canvas is the whole review
  document.getElementById('readout')?.style.setProperty('display', 'none');
  document.getElementById('legend')?.style.setProperty('display', 'none');
  if (terrainMode) {
    renderPageNav(TERRAIN_PAGES.map((entry) => entry.title));
  } else {
    // the building pages are unnamed, so each link says which variants it carries
    const specs = gallerySpecs(1);
    const pages = Math.ceil(specs.length / GALLERY_PER_PAGE);
    renderPageNav(
      Array.from({ length: pages }, (_, i) => {
        const first = i * GALLERY_PER_PAGE + 1;
        const end = Math.min(specs.length, (i + 1) * GALLERY_PER_PAGE);
        return `${specs.length} variants · ${first}-${end}`;
      }),
    );
  }
}

window.addEventListener('resize', layout);
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space') {
    ev.preventDefault();
    paused = !paused;
    updatePanel();
  }
});

layout();
requestAnimationFrame(tick);
