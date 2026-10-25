// A single walker: pure logic, no DOM, so the movement can be tested in Node.
// Movement is grid based (four directions, tile centres) and deterministic for a
// given seed, which keeps screenshots reproducible.

import { TILE } from './art-spec.js';
import { makeRng } from '../rng.js';

const DIRS = {
  down: [0, 1],
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

const OPPOSITE = { down: 'up', up: 'down', left: 'right', right: 'left' };

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 4 };
}

export function createWalker(opts = {}) {
  const tx = Math.floor((opts.x ?? TILE * 4 + TILE / 2) / TILE);
  const ty = Math.floor((opts.y ?? TILE * 4 + TILE - 4) / TILE);
  const centre = tileCenter(tx, ty);
  return {
    x: centre.x,
    y: centre.y,
    tx,
    ty,
    dir: opts.dir || 'down',
    frame: 0,
    anim: 0,
    bob: 0,
    speed: opts.speed ?? 26,
    state: 'idle',
    timer: opts.startDelay ?? 0.25,
    rng: makeRng(opts.seed ?? 1),
    target: null,
  };
}

function chooseNext(w, world) {
  const options = [];
  for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
    const tx = w.tx + dx;
    const ty = w.ty + dy;
    if (world.blocked(tx, ty)) continue;
    // prefer not to turn back immediately, and prefer going straight
    const score = (dir === OPPOSITE[w.dir] ? 0.15 : dir === w.dir ? 1 : 0.5) * (0.7 + w.rng() * 0.6);
    options.push({ dir, tx, ty, score });
  }
  if (!options.length) return null;
  options.sort((a, b) => b.score - a.score);
  return options[0];
}

export function stepWalker(w, dt, world) {
  if (w.state === 'idle') {
    w.timer -= dt;
    w.anim += dt;
    w.frame = 0;
    w.bob = 0;
    if (w.timer <= 0) {
      const next = chooseNext(w, world);
      if (next) {
        w.target = next;
        w.state = 'walk';
      } else {
        w.timer = 0.4;
      }
    }
    return w;
  }

  const goal = tileCenter(w.target.tx, w.target.ty);
  const dx = goal.x - w.x;
  const dy = goal.y - w.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    w.x = goal.x;
    w.y = goal.y;
    w.tx = w.target.tx;
    w.ty = w.target.ty;
    w.state = 'idle';
    w.timer = 0.15 + w.rng() * 1.1;
    w.frame = 0;
    w.bob = 0;
    return w;
  }

  const step = Math.min(w.speed * dt, dist);
  w.x += (dx / dist) * step;
  w.y += (dy / dist) * step;
  w.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  w.anim += dt;
  const pose = Math.floor(w.anim * 7) % 4;
  w.frame = pose % 2;
  w.bob = pose % 2 === 1 ? -1 : 0;
  return w;
}

// Step a fixed number of 1/60s frames: deterministic for a given seed, which is
// what makes "capture the walk at 2.5s" reproducible.
export function simulate(w, seconds, world, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepWalker(w, dt, world);
  return w;
}
