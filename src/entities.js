// Villagers and animals. Everything moves on the tile grid, so nobody walks
// through a wall or into the pond, and depth sorting stays stable.

import { makeRng } from './rng.js';
import { TILE, T, COLS, ROWS } from './world.js';
import { VILLAGER_PALS } from './sprites.js';

const DIRS8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const tileCenterX = (tx) => tx * TILE + TILE / 2;
const tileCenterY = (ty) => ty * TILE + TILE - 3;

function terrainOf(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return T.BACKDROP;
  return world.terrain[ty * COLS + tx];
}

function freeTile(world, tx, ty, allowWater = false) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  const t = terrainOf(world, tx, ty);
  if (t === T.WATER) return allowWater;
  return world.walkableAt(tileCenterX(tx), tileCenterY(ty));
}

function makeEntity(base) {
  return {
    dir: 1,
    view: 'front',
    frame: 0,
    anim: 0,
    state: 'idle',
    timer: 0,
    bob: 0,
    hidden: false,
    tx: 0,
    ty: 0,
    ...base,
  };
}

function placeAt(world, e, rng, pool) {
  const start = pool[Math.floor(rng() * pool.length)];
  e.tx = start.tx;
  e.ty = start.ty;
  e.x = tileCenterX(e.tx);
  e.y = tileCenterY(e.ty);
  return e;
}

export function createEntities(world, seed = 7) {
  const rng = makeRng(seed * 131 + 17);
  const street = world.walkTiles.filter(({ tx, ty }) => {
    const t = terrainOf(world, tx, ty);
    return t === T.ROAD || t === T.PLAZA;
  });
  const grass = world.walkTiles.filter(({ tx, ty }) => terrainOf(world, tx, ty) === T.GRASS);
  const water = world.waterTiles;
  const yard = world.walkTiles.filter(({ tx, ty }) => tx >= 20 && tx <= 26 && ty >= 12 && ty <= 14);
  const list = [];

  const villagers = 13;
  for (let i = 0; i < villagers; i++) {
    const pal = VILLAGER_PALS[i % VILLAGER_PALS.length];
    const e = makeEntity({
      kind: 'villager',
      pal,
      rng: makeRng(seed * 977 + i * 41 + 3),
      speed: rng.range(13, 20),
      scale: 1,
      active: i % 5 === 0 ? [18, 24] : [6 + (i % 3), 21 + (i % 2)],
    });
    placeAt(world, e, rng, street);
    list.push(e);
  }

  for (let i = 0; i < 3; i++) {
    const e = makeEntity({
      kind: 'cat',
      rng: makeRng(seed * 313 + i * 61),
      speed: rng.range(9, 13),
      active: [17, 26],
      idleBias: 0.55,
    });
    placeAt(world, e, rng, grass.length ? grass : street);
    list.push(e);
  }

  for (let i = 0; i < 2; i++) {
    const e = makeEntity({
      kind: 'dog',
      rng: makeRng(seed * 557 + i * 89),
      speed: rng.range(16, 22),
      active: [0, 24],
      idleBias: 0.2,
    });
    placeAt(world, e, rng, street);
    list.push(e);
  }

  for (let i = 0; i < 5; i++) {
    const e = makeEntity({
      kind: 'chicken',
      rng: makeRng(seed * 811 + i * 23),
      speed: rng.range(6, 10),
      active: [0, 24],
      idleBias: 0.7,
      home: yard.length ? yard : grass,
    });
    placeAt(world, e, rng, e.home.length ? e.home : street);
    list.push(e);
  }

  for (let i = 0; i < 4; i++) {
    const e = makeEntity({
      kind: 'duck',
      rng: makeRng(seed * 149 + i * 37),
      speed: rng.range(6, 11),
      active: [0, 24],
      idleBias: 0.3,
      water: true,
    });
    if (water.length) {
      const spot = water[Math.floor(rng() * water.length)];
      e.tx = spot.tx;
      e.ty = spot.ty;
      e.x = tileCenterX(e.tx);
      e.y = tileCenterY(e.ty) - 4;
    }
    list.push(e);
  }

  for (let i = 0; i < 5; i++) {
    const e = makeEntity({
      kind: 'bird',
      rng: makeRng(seed * 691 + i * 53),
      speed: rng.range(22, 34),
      active: [5, 20],
      idleBias: 0.35,
      fly: true,
    });
    e.x = rng.range(40, world.W - 40);
    e.y = rng.range(60, 150);
    e.tx = Math.floor(e.x / TILE);
    e.ty = Math.floor(e.y / TILE);
    list.push(e);
  }

  return list;
}

function scheduleVisible(e, hour) {
  const [from, to] = e.active;
  if (from <= to) return hour >= from && hour < to;
  return hour >= from || hour < to;
}

function pickNext(e, world) {
  const pool = [];
  for (const [dx, dy] of DIRS8) {
    const tx = e.tx + dx;
    const ty = e.ty + dy;
    if (e.kind === 'duck') {
      if (terrainOf(world, tx, ty) === T.WATER) pool.push([tx, ty]);
      continue;
    }
    if (e.kind === 'bird') {
      if (ty * TILE < 200) pool.push([tx, ty]);
      continue;
    }
    if (e.home) {
      const inHome = e.home.some((t) => t.tx === tx && t.ty === ty);
      if (inHome) pool.push([tx, ty]);
      continue;
    }
    if (freeTile(world, tx, ty)) pool.push([tx, ty]);
  }
  if (!pool.length) return false;
  const [tx, ty] = pool[Math.floor(e.rng() * pool.length)];
  e.tx = tx;
  e.ty = ty;
  return true;
}

export function updateEntities(list, dt, world, hour, time) {
  for (const e of list) {
    e.hidden = !scheduleVisible(e, hour) && e.kind !== 'dog';
    if (e.hidden) continue;

    if (e.state === 'idle') {
      e.timer -= dt;
      e.anim += dt;
      if (e.kind === 'bird') {
        e.frame = Math.floor(time * 6 + e.x * 0.1) % 2;
      }
      if (e.timer <= 0) {
        if (!pickNext(e, world)) {
          e.timer = 0.5;
          continue;
        }
        e.state = 'walk';
        e.timer = 0;
      }
      continue;
    }

    const targetX = tileCenterX(e.tx);
    const targetY = e.kind === 'duck' ? tileCenterY(e.ty) - 4 : tileCenterY(e.ty);
    const dx = targetX - e.x;
    const dy = targetY - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5) {
      e.state = 'idle';
      e.timer = e.rng() * (e.idleBias ? 3.2 : 1.6) + 0.3;
      e.frame = 0;
      continue;
    }
    const step = e.speed * dt;
    e.x += (dx / dist) * Math.min(step, dist);
    e.y += (dy / dist) * Math.min(step, dist);
    e.anim += dt * (e.speed / 14);

    if (e.kind === 'bird' && !e.flying) {
      e.flying = e.rng() < dt * 0.35;
      e.flyUntil = time + 1.4;
    }
    if (e.kind === 'bird' && e.flying && time > e.flyUntil) e.flying = false;

    if (Math.abs(dx) > Math.abs(dy) * 1.05) {
      e.view = 'side';
      e.dir = dx >= 0 ? 1 : -1;
    } else {
      e.view = dy >= 0 ? 'front' : 'back';
      e.dir = 1;
    }
    if (e.kind === 'bird' && e.flying) {
      e.view = 'side';
      e.dir = dx >= 0 ? 1 : -1;
    }
    e.frame = Math.floor(e.anim * 6) % 4;
    e.bob = e.kind === 'bird' && e.flying ? -Math.round(Math.sin(time * 9) * 2 + 3) : e.frame % 2 === 1 ? -1 : 0;
  }
}
