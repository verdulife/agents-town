// Town layout: terrain grid, buildings, props, lights, walkability.
// Coordinates are logical pixels. An object's (x, y) is the middle of its
// ground contact line, which is also its depth-sort key.

import { C, mix } from './palette.js';
import { makeRng } from './rng.js';
import {
  buildingSprite,
  treeSprite,
  bushSprite,
  flowersSprite,
  rockSprite,
  lampSprite,
  benchSprite,
  crateSprite,
  barrelSprite,
  fenceSprite,
  fountainSprite,
  stallSprite,
  cartSprite,
  laundrySprite,
  wellSprite,
  planterSprite,
  signpostSprite,
  panelSprite,
} from './sprites.js';

export const TILE = 16;
export const COLS = 28;
export const ROWS = 16;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
export const GROUND_Y = 48; // horizon: ground plane starts here, sky lives above it

export const T = { GRASS: 0, ROAD: 1, PLAZA: 2, WATER: 3, DIRT: 4, BACKDROP: 5 };

const LEGEND = { '.': T.GRASS, '=': T.ROAD, ':': T.PLAZA, '~': T.WATER, '_': T.DIRT, H: T.BACKDROP, '^': T.BACKDROP };

// Hand-authored layout; the town reads as one square with a street running
// through it. Procedural decor fills in around this skeleton.
const MAP = [
  '^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
  '^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
  'HHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  '............................',
  '............................',
  '............................',
  '............................',
  '............................',
  '.........::::::::::.........',
  '.........::::::::::.........',
  '=========::::::::::=========',
  '=========::::::::::=========',
  '..~~~~~......==......___....',
  '..~~~~~......==......___....',
  '..~~~~~......==......___....',
  '.............==.............',
];

function paint(wall) {
  return {
    wall,
    wallLite: mix(wall, C.white, 0.32),
    wallDark: mix(wall, C.ink, 0.3),
  };
}

const WALLS = {
  cream: paint(C.sand),
  clay: paint(C.brickLite),
  blue: paint(C.stone),
  green: paint(C.grassLite),
  mauve: paint(C.roofPurpleLite),
  white: paint(C.stoneLite),
};

const ROOFS = {
  red: { roof: C.roofRed, roofLite: C.roofRedLite, roofDark: C.roofRedDark },
  blue: { roof: C.roofBlue, roofLite: C.roofBlueLite, roofDark: C.roofBlueDark },
  green: { roof: C.roofGreen, roofLite: C.roofGreenLite, roofDark: C.roofGreenDark },
  orange: { roof: C.roofOrange, roofLite: C.roofOrangeLite, roofDark: C.roofOrangeDark },
  purple: { roof: C.roofPurple, roofLite: C.roofPurpleLite, roofDark: C.roofPurpleDark },
  slate: { roof: C.roofSlate, roofLite: C.roofSlateLite, roofDark: C.roofSlateDark },
};

// Front row: the street wall the camera looks at.
const FRONT_BUILDINGS = [
  {
    x: 96, baseY: 132, w: 56, h: 58, wall: WALLS.cream, roof: ROOFS.red, style: 'plaster',
    roofStyle: 'gable', windowSlots: [10, 36], chimney: true, flowers: true,
  },
  {
    x: 160, baseY: 132, w: 62, h: 64, wall: WALLS.cream, roof: ROOFS.green, style: 'plaster',
    roofStyle: 'gable', upperWindows: true, awning: [C.roofRedLite, C.stoneLite],
    sign: ['CAFE', C.ink2, C.lamp], chimney: true,
  },
  {
    x: 232, baseY: 134, w: 78, h: 76, wall: WALLS.blue, roof: ROOFS.blue, style: 'plaster',
    roofStyle: 'gable', windowSlots: [8, 34, 60], cupola: true, sign: ['TOWN HALL', C.ink2, C.lamp],
    winW: 10, winH: 9,
  },
  {
    x: 306, baseY: 132, w: 56, h: 60, wall: WALLS.clay, roof: ROOFS.purple, style: 'brick',
    roofStyle: 'gable', windowSlots: [8, 38], flowers: true,
  },
  {
    x: 368, baseY: 130, w: 58, h: 56, wall: WALLS.blue, roof: ROOFS.orange, style: 'stone',
    roofStyle: 'hip', windowSlots: [8, 40], chimney: true,
  },
];

// Back row: only roofs peek over the front row, which sells the depth.
const BACK_BUILDINGS = [
  { x: 76, baseY: 104, w: 56, h: 46, wall: WALLS.mauve, roof: ROOFS.orange, style: 'plaster', roofStyle: 'gable' },
  { x: 200, baseY: 100, w: 62, h: 50, wall: WALLS.cream, roof: ROOFS.red, style: 'plank', roofStyle: 'gable' },
  { x: 348, baseY: 106, w: 58, h: 44, wall: WALLS.white, roof: ROOFS.slate, style: 'plaster', roofStyle: 'hip' },
];

export function createWorld(seed = 7) {
  const rng = makeRng(seed);
  if (MAP.length !== ROWS) throw new Error(`map must have ${ROWS} rows`);
  MAP.forEach((row, i) => {
    if (row.length !== COLS) throw new Error(`map row ${i} has ${row.length} cols, expected ${COLS}`);
  });

  const terrain = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) terrain[y * COLS + x] = LEGEND[MAP[y][x]];
  }

  const blocked = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === T.WATER || terrain[i] === T.BACKDROP) blocked[i] = 1;
  }

  const world = {
    seed,
    W: WORLD_W,
    H: WORLD_H,
    cols: COLS,
    rows: ROWS,
    tile: TILE,
    groundY: GROUND_Y,
    terrain,
    blocked,
    statics: [],
    panels: [],
    lights: [],
    waterTiles: [],
    walkTiles: [],
    smokeStacks: [],
  };

  const tileIndex = (tx, ty) => ty * COLS + tx;
  const blockTile = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
    blocked[tileIndex(tx, ty)] = 1;
  };
  const blockRect = (x0, y0, x1, y1) => {
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) blockTile(tx, ty);
  };

  const addStatic = (entry) => {
    world.statics.push(entry);
    return entry;
  };
  const addLight = (light) => {
    world.lights.push(light);
    return light;
  };

  // ---- buildings
  const placeBuilding = (spec, back) => {
    // wall/roof palettes are nested for readability; flatten them for the painter
    const sprite = buildingSprite({ ...spec, ...spec.wall, ...spec.roof });
    const entry = addStatic({
      kind: 'building',
      x: spec.x,
      y: spec.baseY,
      sortY: spec.baseY,
      sprite,
      smoking: !!spec.chimney,
      bodyW: spec.w,
      wall: spec.wall,
    });
    if (spec.chimney) {
      world.smokeStacks.push({ x: spec.x + spec.w / 2 - 11, y: spec.baseY - spec.h + 4 });
    }
    // Ground footprint: the facade base plus the row behind it.
    const tx0 = Math.floor((spec.x - spec.w / 2 - 4) / TILE);
    const tx1 = Math.floor((spec.x + spec.w / 2 + 4) / TILE);
    const ty = Math.floor(spec.baseY / TILE);
    blockRect(tx0, ty - 1, tx1, ty);

    // Warm windows and a door light for the night pass.
    if (!back) {
      const winY = spec.baseY - Math.round(spec.h * 0.41);
      for (const slot of spec.windowSlots || []) {
        addLight({ x: spec.x - spec.w / 2 + slot + 5, y: winY, r: 20, color: '#ffcf7a', kind: 'window', pulse: rng.range(0, 6) });
      }
      addLight({ x: spec.x, y: spec.baseY - 10, r: 26, color: '#ffb85c', kind: 'door' });
    }
    return entry;
  };

  BACK_BUILDINGS.forEach((spec) => placeBuilding(spec, true));
  FRONT_BUILDINGS.forEach((spec) => placeBuilding(spec, false));

  // ---- panels (billboards and the CRT kiosk)
  const addPanel = (kind, x, baseY, msgs, opts) => {
    const sprite = panelSprite(kind, opts);
    const entry = addStatic({ kind: 'panel', x, y: baseY, sortY: baseY, sprite, panelKind: kind, msgs });
    world.panels.push({ kind, x, y: baseY, sprite, inner: sprite.inner, msgs });
    blockRect(Math.floor((x - 12) / TILE), Math.floor((baseY - 6) / TILE), Math.floor((x + 12) / TILE), Math.floor(baseY / TILE));
    addLight({
      x,
      y: baseY - sprite.h * 0.62,
      r: kind === 'crt' ? 34 : 40,
      color: kind === 'crt' ? '#2ce8f5' : '#ffe27a',
      kind: 'panel',
    });
    return entry;
  };

  addPanel('billboard', 168, 190, ['PIXEL TOWN', 'MARKET 10AM', 'WELCOME!'], { w: 56, h: 30, bg: C.ink2 });
  addPanel('billboard', 352, 200, ['FESTIVAL', 'SATURDAY', 'BRING A HAT'], { w: 56, h: 30, bg: C.roofPurpleDark });
  addPanel('crt', 278, 222, ['NEWS', 'SUNNY', 'BUS 9:20'], {});

  // ---- props
  const addProp = (kind, x, y, sprite, opts = {}) => {
    const entry = addStatic({ kind, x, y, sortY: y, sprite, ...opts });
    if (opts.block !== false) {
      const halfW = opts.blockW !== undefined ? opts.blockW : Math.max(4, sprite.w / 2 - 2);
      blockRect(
        Math.floor((x - halfW) / TILE),
        Math.floor((y - 8) / TILE),
        Math.floor((x + halfW) / TILE),
        Math.floor(y / TILE),
      );
    }
    return entry;
  };

  // the square itself: fountain in the middle, benches and planters around it
  addProp('fountain', 224, 166, fountainSprite(), { blockW: 22 });
  addLight({ x: 224, y: 150, r: 30, color: '#7fe6ff', kind: 'water' });
  addProp('bench', 206, 184, benchSprite(), { block: false });
  addProp('bench', 246, 184, benchSprite(), { block: false });
  addProp('planter', 200, 156, planterSprite(1), { block: false });
  addProp('planter', 248, 156, planterSprite(2), { block: false });

  // market on the south street
  addProp('stall', 150, 224, stallSprite(1));
  addProp('stall', 306, 218, stallSprite(2));
  addProp('crate', 128, 222, crateSprite(1), { block: false });
  addProp('crate', 134, 226, crateSprite(2), { block: false });
  addProp('barrel', 172, 226, barrelSprite(), { block: false });
  addProp('barrel', 322, 222, barrelSprite(), { block: false });

  // street furniture
  addProp('well', 76, 180, wellSprite());
  addProp('cart', 336, 196, cartSprite());
  addProp('laundry', 112, 148, laundrySprite(), { block: false });
  addProp('signpost', 118, 200, signpostSprite('POND'), { block: false });

  for (const [x, y] of [
    [134, 200],
    [318, 200],
    [190, 228],
    [248, 228],
    [60, 158],
    [392, 158],
  ]) {
    addProp('lamp', x, y, lampSprite(), { blockW: 4 });
    addLight({ x, y: y - 33, r: 60, color: '#ffd77a', kind: 'lamp' });
  }

  // ---- yard fence on the right (chickens live here)
  for (let i = 0; i < 4; i++) addProp('fence', 340 + i * 30, 208, fenceSprite(), { block: false });
  for (let i = 0; i < 3; i++) addProp('fence', 340 + i * 30, 236, fenceSprite(), { block: false });
  addProp('fence', 336, 222, fenceSprite(), { block: false });

  // ---- procedural greenery: edges and the band behind the street wall
  const isGrass = (tx, ty) => terrain[tileIndex(tx, ty)] === T.GRASS;
  const free = (tx, ty) => tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS && isGrass(tx, ty) && !blocked[tileIndex(tx, ty)];

  let treeSeed = 1;
  for (let ty = 3; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (!free(tx, ty)) continue;
      const onEdge = tx < 3 || tx > COLS - 4 || ty > ROWS - 3;
      const behindStreet = ty < 7;
      const chance = onEdge ? 0.5 : behindStreet ? 0.09 : 0.05;
      if (!rng.chance(chance)) continue;
      const px = tx * TILE + TILE / 2 + rng.int(-3, 3);
      const py = ty * TILE + TILE - 1;
      const kind = rng.chance(0.4) ? 'pine' : 'oak';
      const sprite = treeSprite(treeSeed++, kind);
      addProp('tree', px, py, sprite, { blockW: 8 });
    }
  }

  for (let ty = 3; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (!free(tx, ty)) continue;
      if (!rng.chance(0.12)) continue;
      const px = tx * TILE + rng.int(4, 12);
      const py = ty * TILE + rng.int(10, 15);
      const roll = rng.next();
      if (roll < 0.45) addProp('bush', px, py, bushSprite(treeSeed++), { block: false });
      else if (roll < 0.75) addProp('flowers', px, py, flowersSprite(treeSeed++), { block: false });
      else addProp('rock', px, py, rockSprite(treeSeed++), { block: false });
    }
  }

  // ---- derived tile lists for entities and rendering
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const i = tileIndex(tx, ty);
      const t = terrain[i];
      if (t === T.WATER) world.waterTiles.push({ tx, ty });
      if (!blocked[i] && t !== T.BACKDROP) world.walkTiles.push({ tx, ty });
    }
  }

  world.statics.sort((a, b) => a.sortY - b.sortY);

  world.tileAt = (px, py) => {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return T.BACKDROP;
    return terrain[ty * COLS + tx];
  };

  world.walkableAt = (px, py) => {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
    return blocked[ty * COLS + tx] === 0 && terrain[ty * COLS + tx] !== T.BACKDROP;
  };

  world.isWaterAt = (px, py) => world.tileAt(px, py) === T.WATER;

  return world;
}
