// Movement invariants for the walker. Pure logic, no DOM:
//   node tools/walker-check.mjs

import { createWalker, stepWalker, simulate, tileCenter } from '../src/next/walker.js';
import { TILE, WORLD_W, WORLD_H } from '../src/next/scale.js';

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

// A world with the calibration houses blocked out, like the card.
const blockers = [
  { x0: 4, y0: 3, x1: 8, y1: 7 },
  { x0: 14, y0: 3, x1: 18, y1: 7 },
  { x0: 24, y0: 3, x1: 28, y1: 7 },
];
const cols = Math.floor(WORLD_W / TILE);
const rows = Math.floor(WORLD_H / TILE);
const world = {
  blocked(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
    return blockers.some((b) => tx >= b.x0 && tx <= b.x1 && ty >= b.y0 && ty <= b.y1);
  },
};

console.log('walker check\n');

check('starts on a walkable tile, snapped to its centre', () => {
  const c = tileCenter(20, 12);
  const w = createWalker({ seed: 3, x: c.x, y: c.y });
  assert(!world.blocked(w.tx, w.ty), `start tile ${w.tx},${w.ty} is blocked`);
  assert(w.x === c.x && w.y === c.y, `not snapped to the centre: ${w.x},${w.y}`);
});

check('never enters a blocked tile over 60 seconds', () => {
  const w = createWalker({ seed: 3, x: tileCenter(20, 12).x, y: tileCenter(20, 12).y });
  for (let i = 0; i < 60 * 60; i++) {
    stepWalker(w, 1 / 60, world);
    assert(!world.blocked(w.tx, w.ty), `entered blocked tile ${w.tx},${w.ty} at step ${i}`);
    assert(w.x >= 0 && w.x <= WORLD_W && w.y >= 0 && w.y <= WORLD_H, `left the world at ${w.x},${w.y}`);
  }
});

check('actually moves', () => {
  const w = createWalker({ seed: 5, x: tileCenter(20, 12).x, y: tileCenter(20, 12).y });
  const x0 = w.x;
  const y0 = w.y;
  simulate(w, 6, world);
  const moved = Math.hypot(w.x - x0, w.y - y0);
  assert(moved > TILE, `only moved ${moved.toFixed(1)}px in 6s`);
});

check('direction always matches the movement axis', () => {
  const w = createWalker({ seed: 8, x: tileCenter(20, 12).x, y: tileCenter(20, 12).y });
  for (let i = 0; i < 900; i++) {
    const x0 = w.x;
    const y0 = w.y;
    const wasWalking = w.state === 'walk';
    stepWalker(w, 1 / 60, world);
    if (!wasWalking || w.state !== 'walk') continue;
    const dx = w.x - x0;
    const dy = w.y - y0;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) continue;
    const expected = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    assert(w.dir === expected, `dir ${w.dir} but moved ${dx.toFixed(2)},${dy.toFixed(2)}`);
  }
});

check('stops exactly on tile centres', () => {
  const w = createWalker({ seed: 11, x: tileCenter(20, 12).x, y: tileCenter(20, 12).y });
  for (let i = 0; i < 1200; i++) {
    stepWalker(w, 1 / 60, world);
    if (w.state !== 'idle') continue;
    const c = tileCenter(w.tx, w.ty);
    assert(Math.abs(w.x - c.x) < 0.001 && Math.abs(w.y - c.y) < 0.001, `idle off-centre at ${w.x.toFixed(2)},${w.y.toFixed(2)}`);
  }
});

check('the walk cycle alternates poses while walking', () => {
  const w = createWalker({ seed: 13, x: tileCenter(20, 12).x, y: tileCenter(20, 12).y });
  const poses = new Set();
  for (let i = 0; i < 600; i++) {
    stepWalker(w, 1 / 60, world);
    if (w.state === 'walk') poses.add(w.frame);
  }
  assert(poses.size === 2, `expected 2 poses, saw ${[...poses].join(',')}`);
});

check('same seed and same steps give the same path', () => {
  const a = simulate(createWalker({ seed: 21, x: tileCenter(20, 12).x, y: tileCenter(20, 12).y }), 12, world);
  const b = simulate(createWalker({ seed: 21, x: tileCenter(20, 12).x, y: tileCenter(20, 12).y }), 12, world);
  assert(a.x === b.x && a.y === b.y && a.dir === b.dir, 'same seed diverged');
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
