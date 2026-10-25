// Density table: which window sizes give which scale and how many tiles you
// actually see. Run with `node tools/scale-check.mjs`.

import { computeView, TILE, WORLD_W, WORLD_H, SAFE_W, SAFE_H } from '../src/next/scale.js';

const RESOLUTIONS = [
  ['1280x720 (16:9)', 1280, 720],
  ['1920x1080 (16:9)', 1920, 1080],
  ['2560x1440 (16:9)', 2560, 1440],
  ['3840x2160 (16:9)', 3840, 2160],
  ['1680x1050 (16:10)', 1680, 1050],
  ['1440x900 (16:10)', 1440, 900],
  ['2160x1440 (3:2)', 2160, 1440],
  ['1440x1080 (4:3)', 1440, 1080],
  ['1600x1200 (4:3)', 1600, 1200],
  ['1280x1024 (5:4)', 1280, 1024],
  ['1280x800 (16:10 laptop)', 1280, 800],
  ['1024x768 (4:3)', 1024, 768],
];

let failures = 0;

function check(cond, message) {
  if (!cond) {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}

console.log('window                  scale   logical      tiles      safe-area  css covers');
console.log('--------------------------------------------------------------------------------');

for (const [label, w, h] of RESOLUTIONS) {
  const view = computeView(w, h);
  const covers = view.cssW >= w && view.cssH >= h;
  const integer = Number.isInteger(view.scale);
  const inside = view.w <= WORLD_W && view.h <= WORLD_H;
  const overflowOk = view.cssW - w < view.scale && view.cssH - h < view.scale;

  console.log(
    `${label.padEnd(23)} ${String(view.scale).padStart(4)}x  ${String(view.w).padStart(4)}x${String(view.h).padEnd(4)}  ` +
      `${view.tilesW.toFixed(1).padStart(5)}x${view.tilesH.toFixed(1).padEnd(5)}  ` +
      `${view.safeFits ? 'full   ' : 'cropped'}    ${covers ? 'yes' : 'NO'}`,
  );

  check(integer, `${label}: scale ${view.scale} is not an integer`);
  check(covers, `${label}: canvas ${view.cssW}x${view.cssH} does not cover the window`);
  check(overflowOk, `${label}: overflow larger than one logical pixel`);
  check(inside, `${label}: view ${view.w}x${view.h} exceeds world ${WORLD_W}x${WORLD_H}`);
  check(view.w % 1 === 0 && view.h % 1 === 0, `${label}: non-integer view`);
}

console.log('\ntile size:', TILE, 'px | world:', `${WORLD_W}x${WORLD_H}`, `(${WORLD_W / TILE}x${WORLD_H / TILE} tiles)`);
console.log('guaranteed-visible rect:', `${SAFE_W}x${SAFE_H}`, `(${SAFE_W / TILE}x${SAFE_H / TILE} tiles)`);
console.log(failures === 0 ? '\nall resolutions pass' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
