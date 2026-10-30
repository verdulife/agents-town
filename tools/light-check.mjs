// The scene's lighting invariants (S27). The lighting is one contract and two maps, so what it promises can
// be asked of the maps themselves:
//   node tools/light-check.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// --- a rasterising canvas stub ---------------------------------------------
// Trimmed from the one in floor-check.mjs: fillRect with alpha, and a canvas that keeps its
// pixels, so "the bottom row is painted" and "this frame is not that frame" can be asked of the
// drawing rather than of the code that drew it.

const COLOR_CACHE = new Map();

function cssColor(css) {
  const key = String(css);
  const hit = COLOR_CACHE.get(key);
  if (hit) return hit;
  let out = [0, 0, 0, 255];
  if (key[0] === '#') {
    const h = key.slice(1);
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    out =
      h.length === 3
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

// --- the lighting ----------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '..', 'src', 'next', 'light.js');
const light = await import('../src/next/light.js');

const W = 480;
const H = 260;
const GROUNDY = 180;
const STREET = {
  blocks: [
    { kind: 'cafe', x: 0, w: 96, h: 120 },
    { kind: 'alley', x: 96, w: 44, h: 160 },
    { kind: 'offices', x: 140, w: 151, h: 200 },
    { kind: 'gym', x: 291, w: 120, h: 100 },
    { kind: 'park', x: 411, w: 69, h: 40 },
  ],
};

let failures = 0;
let checks = 0;
function check(name, fn) {
  checks++;
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${name}` + String.fromCharCode(10) + `       ${err.message}`);
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
const dataOf = (spr) => spr.canvas.data;
const lumAt = (spr, x, y) => {
  const d = dataOf(spr);
  const i = (y * spr.w + x) * 4;
  return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
};
const toneLum = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
console.log('light check' + String.fromCharCode(10));

check('the ambient is white by day and dark at night, and every moment differs', () => {
  const tones = ['night', 'dawn', 'day', 'dusk'].map((t) => light.lightFor(t).ambient);
  assert(new Set(tones).size === 4, 'two moments share an ambient tone');
  assert(toneLum(tones[2]) > 200, `day's ambient is ${toneLum(tones[2]).toFixed(0)}: not neutral`);
  assert(toneLum(tones[0]) < toneLum(tones[2]) - 40, `night's ambient ${toneLum(tones[0]).toFixed(0)} is not under day's`);
});

check('the shadow sheet is opaque white away from the buildings and dark at their feet', () => {
  const sheet = light.shadowSheet({ w: W, h: H, groundY: GROUNDY, street: STREET, time: 'dusk' });
  const away = lumAt(sheet, 470, 2);
  const foot = lumAt(sheet, 20, GROUNDY + 2);
  assert(away > 250, `the sheet's empty area is ${away.toFixed(0)}, not white`);
  assert(foot < away - 20, `the shadow at the café's foot is ${foot.toFixed(0)}: no shadow`);
});

check('the shadow falls away from the light: left at dusk, right at night', () => {
  const dusk = light.shadowSheet({ w: W, h: H, groundY: GROUNDY, street: STREET, time: 'dusk' });
  const night = light.shadowSheet({ w: W, h: H, groundY: GROUNDY, street: STREET, time: 'night' });
  // the café's block runs 0..96 at the ground line: at dusk the shade reaches past its left edge, at night
  // past its right one
  const leftDusk = lumAt(dusk, 1, GROUNDY + 1);
  const leftNight = lumAt(night, 1, GROUNDY + 1);
  const rightDusk = lumAt(dusk, 100, GROUNDY + 1);
  const rightNight = lumAt(night, 100, GROUNDY + 1);
  assert(leftDusk <= leftNight, `the left side is ${leftDusk.toFixed(0)} at dusk and ${leftNight.toFixed(0)} at night`);
  assert(rightNight <= rightDusk, `the right side is ${rightNight.toFixed(0)} at night and ${rightDusk.toFixed(0)} at dusk`);
});

check('the glass lights its own pavement, and more at night than at noon', () => {
  const night = light.glowSheet({ w: W, h: H, groundY: GROUNDY, street: STREET, time: 'night' });
  const day = light.glowSheet({ w: W, h: H, groundY: GROUNDY, street: STREET, time: 'day' });
  const at = (spr) => lumAt(spr, 48, GROUNDY + 2);
  assert(at(night) > at(day), `the pavement under the café is ${at(night).toFixed(1)} at night and ${at(day).toFixed(1)} at noon`);
});

check('no pool under the alley or the park, which have no glass of their own', () => {
  const glow = light.glowSheet({ w: W, h: H, groundY: GROUNDY, street: STREET, time: 'night' });
  assert(lumAt(glow, 118, GROUNDY + 1) === 0, 'the alley lights its pavement: it has no glass');
  assert(lumAt(glow, 445, GROUNDY + 1) === 0, 'the park lights its pavement: its lamp is not this pass');
});

check('the same call paints the same maps', () => {
  const a = light.shadowSheet({ w: W, h: H, groundY: GROUNDY, street: STREET, time: 'dusk' });
  const b = light.shadowSheet({ w: W, h: H, groundY: GROUNDY, street: STREET, time: 'dusk' });
  const x = dataOf(a);
  const y = dataOf(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) throw new Error('two identical calls differ');
});

check('light.js holds no colour literal, no Math.random and reads no clock', () => {
  const source = readFileSync(SOURCE, 'utf8');
  const literals = source.match(/#[0-9a-fA-F]{3,8}/g) || [];
  assert(literals.length === 0, `${literals.length} colour literals in light.js: ${literals.slice(0, 4).join(' ')}`);
  assert(!/Math\.random\s*\(/.test(source), 'light.js calls Math.random');
  assert(!/Date\.now\s*\(|performance\.now\s*\(/.test(source), 'light.js reads a clock');
});

console.log(String.fromCharCode(10) + `${checks - failures}/${checks} checks passed`);
if (failures) process.exitCode = 1;
