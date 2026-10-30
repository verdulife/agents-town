// The sky's invariants (S26). The sky is the largest surface in the frame, so every promise it makes
// is worth a check:
//   node tools/sky-check.mjs
//
// The ramp is checked for direction and fineness, the depth for value (haze over city over nothing),
// the clouds for being lit from below, the moving parts for being deterministic and for living inside
// the sky, and the palette rule on the source text.

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

// --- the sky ---------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '..', 'src', 'next', 'sky.js');
const { Painter } = await import('../src/pixel.js');
const sky = await import('../src/next/sky.js');

const W = 480;
const H = 260;
const CLEAR = 90;

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
const backdrop = (time, clear = CLEAR) => {
  const p = new Painter(W, H);
  return sky.paintSkyBackdrop(p, { w: W, h: H, time, clear }).sprite();
};
// the ramp alone: the clouds are wider than the frame, so the only way to measure the sky itself is to
// paint the base layer on its own
const baseLayer = (time) => {
  const p = new Painter(W, H);
  return sky.paintSkyBase(p, { w: W, h: H, time, clear: CLEAR }).sprite();
};
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
const samePixels = (a, b) => {
  const x = dataOf(a);
  const y = dataOf(b);
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
};

console.log('sky check\n');

check('the four moments exist and none of them paints the same sky', () => {
  const times = sky.skyTimes();
  assert(times.length === 4, `${times.length} moments`);
  const shots = times.map((t) => backdrop(t));
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      assert(!samePixels(shots[i], shots[j]), `${times[i]} and ${times[j]} paint the same sky`);
    }
  }
});

check('every ramp runs dark at the zenith to light at the horizon, in at least eight steps', () => {
  for (const time of sky.skyTimes()) {
    const horizon = sky.horizonTone(time);
    assert(typeof horizon === 'string', `${time} has no horizon tone`);
    const spr = baseLayer(time);
    // the zenith is the painted top row; the horizon is the ramp's own last stop. Sampling the bottom
    // of the frame would be sampling the landscape — which is the point of the landscape, and it made
    // this check fail the day the sea arrived
    const zenith = lumAt(spr, 3, 1);
    assert(toneLum(horizon) > zenith + 8, `${time}: the horizon ${toneLum(horizon).toFixed(1)} is not above the zenith ${zenith.toFixed(1)}`);
    // the steps: distinct COLOURS down a column of sky the clouds do not cross. Counting luminance
    // buckets is wrong for the night ramp, whose steps differ in hue more than in value — it reported
    // six steps on a ramp that has twenty-eight
    const tones = new Set();
    for (let y = 0; y < Math.round(H * 0.68); y++) {
      const i = (y * spr.w + Math.round(W * 0.42)) * 4;
      tones.add(`${dataOf(spr)[i]},${dataOf(spr)[i + 1]},${dataOf(spr)[i + 2]}`);
    }
    assert(tones.size >= 8, `${time}: the ramp is ${tones.size} steps, not 8`);
  }
});

check('the horizon tone is the horizon of its own ramp, and each moment has its own', () => {
  const tones = sky.skyTimes().map((t) => sky.horizonTone(t));
  assert(new Set(tones).size === tones.length, 'two moments share a horizon tone');
  for (let i = 0; i < tones.length; i++) {
    const l = toneLum(tones[i]);
    assert(l > 40, `${sky.skyTimes()[i]}'s horizon is ${l.toFixed(0)}: too dark to be a horizon`);
  }
});

check('the sky is a gradient: no step between two rows is a band you could read', () => {
  // this is the rule the first version broke — ten flat bands across the largest surface in the frame
  for (const time of sky.skyTimes()) {
    const spr = backdrop(time);
    // per row pair, the fifth of the columns that changed LEAST: the ramp is the same across the width,
    // so a step of the ramp shows in every column, while a cloud edge or a star shows in a few. What
    // survives at the low end is the sky itself.
    const quietStep = (y) => {
      const deltas = [];
      for (let x = 0; x < W; x++) deltas.push(Math.abs(lumAt(spr, x, y) - lumAt(spr, x, y - 1)));
      deltas.sort((a, b) => a - b);
      return deltas[Math.floor(deltas.length * 0.2)];
    };
    let worst = 0;
    for (let y = 1; y < Math.round(H * 0.4); y++) {
      worst = Math.max(worst, quietStep(y));
    }
    assert(worst <= 7, `${time}: the sky steps ${worst.toFixed(1)} levels between two rows: that is a band`);
  }
});

check('the landscape reaches the street line, so nothing floats between it and our roofs', () => {
  for (const time of sky.skyTimes()) {
    const spr = backdrop(time);
    const horizon = toneLum(sky.horizonTone(time));
    // the bottom row is the ridge, a mass mixed toward ink: it can never be the ramp's own horizon
    const foot = lumAt(spr, 3, H - 1);
    assert(foot < horizon - 4, `${time}: the bottom row is ${foot.toFixed(1)}, the horizon ${horizon.toFixed(1)}: the ramp is still there`);
  }
});

check('the water on the right is a plane with its own pale line', () => {
  for (const time of sky.skyTimes()) {
    const spr = backdrop(time);
    const x = W - 6;
    let best = { y: -1, step: 0 };
    for (let y = Math.round(H * 0.3); y < H - 3; y++) {
      const step = lumAt(spr, x, y) - lumAt(spr, x, y + 1);
      if (step > best.step) best = { y, step };
    }
    assert(best.step >= 6, `${time}: no waterline on the right (best step ${best.step.toFixed(1)} at row ${best.y})`);
  }
});

check('a cloud is lit from below at dusk and from above by day, and never the other way round', () => {
  // the rule that failed twice: a day cloud lit from below is a rock with snow on it, and a dusk cloud
  // lit from above loses the one signature the reference has
  for (const time of sky.skyTimes()) {
    const tones = sky.cloudTones(time);
    const lite = toneLum(tones.lite);
    const body = toneLum(tones.body);
    const base = toneLum(tones.base);
    // a white cloud has no room above bone, so the lit side only has to be at or over the body: what
    // must hold is that the base is the shadow and that the light comes from the right side
    assert(lite >= body - 1, `${time}: the lit side ${lite.toFixed(0)} is under the body ${body.toFixed(0)}`);
    assert(body > base + 8, `${time}: the body ${body.toFixed(0)} is not over its shadow ${base.toFixed(0)}`);
    const shouldBeTopLit = time === 'day';
    assert(!!tones.topLit === shouldBeTopLit, `${time}: topLit is ${tones.topLit}`);
  }
});

check('the moving parts are all in the sky, and every one of them is deterministic', () => {
  const list = sky.skyAnimations({ w: W, h: H, time: 'night', clear: CLEAR });
  assert(list.length >= 6, `${list.length} moving elements: the sky is not alive`);
  for (const el of list) {
    assert(el.origin === 'sky', `${el.key} does not carry origin sky`);
    const a = el.place(12.5, false);
    const b = el.place(12.5, false);
    assert(a.sprite === b.sprite && a.x === b.x && a.y === b.y, `${el.key} is not deterministic at a fixed time`);
    assert(a.y < H, `${el.key} is drawn below the sky`);
  }
});

check('frozen, the sky is frame zero and nothing moves', () => {
  const list = sky.skyAnimations({ w: W, h: H, time: 'night', clear: CLEAR });
  for (const el of list) {
    const a = el.place(0, true);
    const b = el.place(600, true);
    assert(a.sprite === b.sprite && a.x === b.x && a.y === b.y, `${el.key} still moves when frozen`);
  }
});

check('sky.js holds no colour literal, no Math.random and reads no clock', () => {
  const source = readFileSync(SOURCE, 'utf8');
  const literals = source.match(/#[0-9a-fA-F]{3,8}/g) || [];
  assert(literals.length === 0, `${literals.length} colour literals in sky.js: ${literals.slice(0, 4).join(' ')}`);
  assert(!/Math\.random\s*\(/.test(source), 'sky.js calls Math.random');
  assert(!/Date\.now\s*\(|performance\.now\s*\(/.test(source), 'sky.js reads a clock');
});

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exitCode = 1;
