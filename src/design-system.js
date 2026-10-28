// The design sheet: the palette drawn by the same modules the town uses, so a colour is
// judged on real material and not on a swatch. Fixed at 900x560 art pixels and painted at
// two device pixels per art pixel; its size never follows the window, because a sheet is
// something you compare against the last one.

import './design-system.css';
import { C, RAMPS, SKY, FORBIDDEN } from './next/palette.js';
import { drawText, lineWidth } from './font.js';
import { makeRng } from './rng.js';
import { buildingSprite, variantFor } from './next/buildings.js';
import { terrainPatch } from './next/terrain.js';

const W = 900;
const H = 560;
const Z = 2; // device pixels per art pixel

const canvas = document.getElementById('sheet');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
ctx.setTransform(Z, 0, 0, Z, 0, 0);
ctx.fillStyle = C.ink;
ctx.fillRect(0, 0, W, H);

const tiny = { font: 'tiny' };

function text(value, x, y, color = C.stoneLite) {
  drawText(ctx, String(value).toUpperCase(), x, y, color, tiny);
}

function header(value, x, y) {
  text(value, x, y, C.white);
  ctx.fillStyle = C.ink3;
  ctx.fillRect(x, y + 8, lineWidth(String(value).toUpperCase(), tiny), 1);
}

function swatch(x, y, size, key, h = size) {
  ctx.fillStyle = C[key] ?? C.purple;
  ctx.fillRect(x, y, size, h);
  // slate, not ink: a swatch as dark as the sheet still needs an edge to read
  ctx.strokeStyle = C.slate;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, h - 1);
}

// ------------------------------------------------------------------- the ramps

header('ramps · every family, deep shadow to highlight', 16, 20);
RAMPS.forEach((ramp, i) => {
  const y = 44 + i * 24;
  text(ramp.name, 16, y + 5, C.stoneLite);
  ramp.steps.forEach((key, j) => swatch(112 + j * 19, y, 16, key));
});

// -------------------------------------------------------------- prohibited pairs

header('pairs that must never touch', 16, 360);
FORBIDDEN.forEach((pair, i) => {
  const y = 380 + i * 24;
  swatch(16, y, 14, pair.a, 12);
  swatch(34, y, 14, pair.b, 12);
  text(`${pair.a} x ${pair.b}`, 56, y + 3, C.stoneLite);
  text(pair.why, 196, y + 3, C.slate);
});

// ------------------------------------------------------------------- the sky

header('sky · four hours', 450, 20);
SKY.forEach((sky, i) => {
  const x = 450 + i * 76;
  const y = 44;
  const w = 64;
  const h = 126;
  const band = h / sky.steps.length;
  // zenith first: the deepest step sits at the top, the lit horizon at the bottom
  sky.steps.forEach((key, j) => {
    ctx.fillStyle = C[key];
    ctx.fillRect(x, y + j * band, w, band + 1);
  });
  skyline(x, y + 18, w, h - 18, 11 + i);
  text(sky.name, x, y + h + 4, C.stoneLite);
});

// A skyline is where the sky is judged: a flat gradient says nothing about whether the
// silhouette reads. Two buildings in three get one lit window, which is the whole test.
function skyline(x, y, w, h, seed) {
  const r = makeRng(seed);
  let cx = x;
  while (cx < x + w - 2) {
    const bw = 6 + Math.floor(r.next() * 12);
    const bh = 8 + Math.floor(r.next() * (h - 10));
    const bwClamped = Math.min(bw, x + w - cx);
    ctx.fillStyle = C.ink;
    ctx.fillRect(cx, y + h - bh, bwClamped, bh);
    if (r.next() < 0.6 && bwClamped > 4) {
      ctx.fillStyle = C.lampWarm;
      ctx.fillRect(cx + 2, y + h - bh + 4, 1, 1);
    }
    cx += bwClamped + 1;
  }
}

// ---------------------------------------------------------------- a facade

header('facade · the catalogue, in this palette', 450, 196);
const facades = [
  ['townhouse', 5],
  ['shop', 12],
];
let fx = 450;
for (const [type, seed] of facades) {
  const spec = variantFor(type, seed);
  const spr = buildingSprite(spec);
  const bottom = 334;
  const y = bottom - spr.h;
  ctx.fillStyle = C.ink2;
  ctx.fillRect(fx, bottom, spr.w, 5);
  ctx.drawImage(spr.canvas, fx, y);
  text(`${type} ${spr.w}x${spr.h}`, fx, bottom + 8, C.slate);
  fx += spr.w + 14;
}

// ------------------------------------------------------------ a night corner

header('street · night', 450, 356);
const wallX = 450;
const wallY = 374;
const wallW = 128;
const wallH = 40;
ctx.fillStyle = C.plasterDark;
ctx.fillRect(wallX, wallY, wallW, wallH);
ctx.fillStyle = C.plaster;
ctx.fillRect(wallX, wallY, wallW, 2);

// two windows side by side, which is the test: one inhabited, one empty. glassLit is
// the warmest thing allowed in frame; glass and glassLite are what it is compared to.
const windows = [
  { key: C.glass, x: wallX + 14 },
  { key: C.glassLit, x: wallX + 38 },
];
for (const win of windows) {
  ctx.fillStyle = C.metalDark;
  ctx.fillRect(win.x, wallY + 10, 18, 15);
  ctx.fillStyle = win.key;
  ctx.fillRect(win.x + 1, wallY + 11, 16, 13);
  ctx.fillStyle = C.metal;
  ctx.fillRect(win.x + 9, wallY + 11, 1, 13);
  ctx.fillRect(win.x + 1, wallY + 17, 16, 1);
}

// the sign: neon on ink, never neon on neon
ctx.fillStyle = C.ink;
ctx.fillRect(wallX + 72, wallY + 6, 40, 20);
ctx.strokeStyle = C.neonPink;
ctx.lineWidth = 1;
ctx.strokeRect(wallX + 72.5, wallY + 6.5, 39, 19);
text('24H', wallX + 80, wallY + 13, C.neonPink);

// the road the wall sits on
const road = terrainPatch('asphalt', 8, 2, 7);
ctx.drawImage(road.canvas, wallX, wallY + wallH);
// a lamp pool over the tarmac, the only soft edge in the sheet
const pool = ctx.createRadialGradient(wallX + 40, wallY + wallH + 6, 2, wallX + 40, wallY + wallH + 6, 30);
pool.addColorStop(0, 'rgba(246,216,124,0.2)');
pool.addColorStop(1, 'rgba(246,216,124,0)');
ctx.fillStyle = pool;
ctx.fillRect(wallX, wallY + wallH, wallW, 32);
text('asphalt · lamp pool · one lit window, one not', wallX, wallY + wallH + 38, C.slate);

// ---------------------------------------------------------------------- footer

text(
  'design sheet · 900x560 art px · 2 device px per art px · src/next/palette.js',
  16,
  H - 14,
  C.ink3,
);

// ------------------------------------------------------------ the key table

const rampOf = new Map();
for (const ramp of RAMPS) for (const key of ramp.steps) if (!rampOf.has(key)) rampOf.set(key, ramp.name);
for (const sky of SKY) for (const key of sky.steps) if (!rampOf.has(key)) rampOf.set(key, `sky · ${sky.name}`);

const table = document.getElementById('key-table');
table.innerHTML = Object.entries(C)
  .map(
    ([key, hex]) =>
      `<tr><td class="chip"><span style="background:${hex}"></span></td><td>${key}</td><td class="hex">${hex}</td><td class="ramp">${rampOf.get(key) ?? '—'}</td></tr>`,
  )
  .join('');

// the ramps as text, with the rule each one carries: the sheet shows them, this says why
const rampList = document.getElementById('ramp-list');
rampList.innerHTML = RAMPS.map(
  (ramp) =>
    `<li><b>${ramp.name}</b> <span class="hex">${ramp.steps.map((k) => C[k]).join(' ')}</span><br><span class="note">${ramp.note}</span></li>`,
).join('');
