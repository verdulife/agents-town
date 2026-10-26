// Density table and rules for the v2 scale policy: the art pixel has a fixed size
// in *physical* pixels, so the browser zoom cannot change the framing, and the
// view is allowed to be larger than the world (the field fills the rest).
// Run with `node tools/scale-check.mjs`.

import {
  computeView,
  computeCamera,
  TILE,
  WORLD_W,
  WORLD_H,
  SAFE_W,
  SAFE_H,
  TARGET_H,
} from '../src/next/scale.js';

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
  // the window Verdu actually uses, at 100% zoom
  ['1644x974 (his screen)', 1644, 974],
];

let failures = 0;
let checks = 0;

function check(cond, message) {
  checks++;
  if (!cond) {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}

console.log('window                  px/art  logical      tiles      field height  safe-area');
console.log('--------------------------------------------------------------------------------');

for (const [label, w, h] of RESOLUTIONS) {
  const view = computeView(w, h, 1);
  const covers = view.covers;
  // the canvas overflows the window by less than one art pixel
  const overflowOk = view.cssW - w < view.scaleCss + 1e-9 && view.cssH - h < view.scaleCss + 1e-9;
  // the CSS box is a whole number of device pixels: no fractional scaling, no shimmer
  const boxW = view.cssW * view.dpr;
  const boxH = view.cssH * view.dpr;
  const crisp = Math.abs(boxW - Math.round(boxW)) < 1e-6 && Math.abs(boxH - Math.round(boxH)) < 1e-6;

  console.log(
    `${label.padEnd(23)} ${String(view.scalePhys).padStart(4)}x  ${String(view.w).padStart(4)}x${String(view.h).padEnd(4)}  ` +
      `${view.tilesW.toFixed(1).padStart(5)}x${view.tilesH.toFixed(1).padEnd(5)}  ` +
      `${String(view.h).padStart(4)} (${view.tilesH.toFixed(0)} tiles)`.padEnd(16) +
      `${view.safeFits ? 'full   ' : 'cropped'}`,
  );

  check(covers, `${label}: canvas ${view.cssW}x${view.cssH} does not cover the window`);
  check(overflowOk, `${label}: the canvas overflows the window by a whole art pixel or more`);
  check(crisp, `${label}: the ${view.scalePhys}x box lands on a fraction of a device pixel`);
  check(Number.isInteger(view.scalePhys) && view.scalePhys >= 1, `${label}: scale ${view.scalePhys} is not a positive integer`);
  check(view.w % 1 === 0 && view.h % 1 === 0, `${label}: non-integer view`);
  // the rule: the scale is the whole number of device pixels nearest TARGET_H of field
  check(
    view.scalePhys === Math.max(1, Math.round((h * view.dpr) / TARGET_H)),
    `${label}: scale ${view.scalePhys} is not the nearest to a ${TARGET_H}px field`,
  );
  // and whatever the screen, the guaranteed-visible rect must survive
  check(view.h >= SAFE_H, `${label}: view height ${view.h} crops the ${SAFE_H}px safe rect`);
}

// ---------------------------------------------------------- the rule itself

// 1. the window Verdu likes: 2 device px per art pixel, 51.4x30.4 tiles, whole town
const his = computeView(1644, 974, 1);
check(his.scalePhys === 2, `his window: ${his.scalePhys} device px per art pixel, expected 2`);
check(his.w === 822 && his.h === 487, `his window: logical ${his.w}x${his.h}, expected 822x487`);
check(his.w >= WORLD_W && his.h >= WORLD_H, 'his window: the whole town must fit in the view');
check(his.safeFits, 'his window: the safe rect must be fully visible');

// 2. browser zoom must not change the framing: same physical window, different dpr
// (css sizes round to whole pixels in a real browser, so allow one logical pixel)
for (const zoom of [0.5, 0.575, 0.67, 0.8, 1, 1.25, 1.5, 2]) {
  const zoomed = computeView(1644 / zoom, 974 / zoom, zoom);
  check(
    zoomed.scalePhys === his.scalePhys,
    `zoom ${zoom}: ${zoomed.scalePhys} device px per art pixel, expected ${his.scalePhys}`,
  );
  check(
    Math.abs(zoomed.w - his.w) <= 1 && Math.abs(zoomed.h - his.h) <= 1,
    `zoom ${zoom}: the view changed to ${zoomed.w}x${zoomed.h} (expected ${his.w}x${his.h} ± 1)`,
  );
  check(
    Math.abs(zoomed.cssW - 1644 / zoom) <= zoomed.scaleCss + 1 &&
      Math.abs(zoomed.cssH - 974 / zoom) <= zoomed.scaleCss + 1,
    `zoom ${zoom}: the css box ${zoomed.cssW}x${zoomed.cssH} does not fill the ${1644 / zoom}x${974 / zoom} window`,
  );
}

// 3. a view larger than the world is legal now, so the camera must centre the world
const wide = computeView(1920, 1080, 1);
check(wide.w > WORLD_W && wide.h > WORLD_H, 'a 1080p view should be larger than the world at 2px/art');
const wideCam = computeCamera(wide);
check(
  Math.abs(wideCam.x * 2 + wide.w - WORLD_W) <= 1 && Math.abs(wideCam.y * 2 + wide.h - WORLD_H) <= 1,
  `camera ${wideCam.x},${wideCam.y} does not centre the world in ${wide.w}x${wide.h}`,
);
// and a view smaller than the world still crops symmetrically
const tall = computeView(1280, 720, 2);
const tallCam = computeCamera(tall);
check(
  Math.abs(tallCam.x * 2 + tall.w - WORLD_W) <= 1 && Math.abs(tallCam.y * 2 + tall.h - WORLD_H) <= 1,
  `camera ${tallCam.x},${tallCam.y} does not centre the crop in ${tall.w}x${tall.h}`,
);

// 4. the forced scale keeps working as a preview knob, in device pixels
const forced = computeView(1644, 974, 1, 3);
check(forced.scalePhys === 3, `forced scale: got ${forced.scalePhys}, expected 3`);
check(forced.w === 548 && forced.h === 325, `forced scale: logical ${forced.w}x${forced.h}, expected 548x325`);

console.log('\ntile size:', TILE, 'px | world:', `${WORLD_W}x${WORLD_H}`, `(${WORLD_W / TILE}x${WORLD_H / TILE} tiles)`);
console.log('guaranteed-visible rect:', `${SAFE_W}x${SAFE_H}`, `(${SAFE_W / TILE}x${SAFE_H / TILE} tiles)`);
console.log(failures === 0 ? `\n${checks}/${checks} checks passed · all resolutions pass` : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
