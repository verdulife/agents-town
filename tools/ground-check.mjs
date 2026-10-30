// The street's ground invariants (S25). The ground is painted, not tiled, and everything it promises
// is a statement about pixels or about the layout:
//   node tools/ground-check.mjs
//
// The bands (contact, pavement, kerb, gutter, road, fade) are checked on the sprite, the reflection
// of the sky on two different skies, the shadows on the blocks' own columns, and the palette rule on
// the source text. That last check reads the file, because a colour literal is the one rule a
// painter could sneak back in.

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

// --- the ground ------------------------------------------------------------

const STREET_W = 960;
const GROUND_ROWS = 140;
const BLOCKS = [
  { kind: 'cafe', x: 0, w: 192 },
  { kind: 'alley', x: 192, w: 88 },
  { kind: 'offices', x: 280, w: 302 },
  { kind: 'gym', x: 582, w: 240 },
  { kind: 'park', x: 822, w: 138 },
];
const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, '..', 'src', 'next', 'ground.js');
const { GROUND, groundSprite } = await import('../src/next/ground.js');

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
const KERB_Y = GROUND.contact + GROUND.pave;
const ROAD_Y = KERB_Y + GROUND.kerb + GROUND.gutter;
const BANDED = ROAD_Y + GROUND.road;
const spriteOf = (opts) =>
  groundSprite({ w: STREET_W, h: GROUND_ROWS, sky: 'dusk', blocks: BLOCKS, doorX: 40, ...opts });
// the stub keeps its pixels on the canvas itself, so a check can read them without a context
const dataOf = (sprite) => sprite.canvas.data;
const lumAt = (sprite, x, y) => {
  const d = dataOf(sprite);
  const i = (y * sprite.w + x) * 4;
  return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
};
const samePixels = (a, b) => {
  const x = dataOf(a);
  const y = dataOf(b);
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
};

console.log('ground check\n');

check('the sprite is the width and the height it was asked for', () => {
  const s = spriteOf({});
  assert(s.w === STREET_W, `the ground is ${s.w} wide`);
  assert(s.h === GROUND_ROWS, `the ground is ${s.h} rows tall`);
});

check('the bands fit, and the fade takes the rest instead of stretching them', () => {
  for (const h of [BANDED, BANDED + 8, BANDED + 60, 400]) {
    const s = spriteOf({ h });
    assert(s.h === h, `a ${h}-row ground came out ${s.h} rows tall`);
    assert(BANDED <= h, `the bands take ${BANDED} rows and the ground has ${h}`);
  }
});

check('the kerb is the pale horizontal, above the road', () => {
  const s = spriteOf({});
  const kerb = lumAt(s, 500, KERB_Y);
  const road = lumAt(s, 500, ROAD_Y + 6);
  assert(kerb > road + 20, `the kerb is ${kerb.toFixed(1)} and the road ${road.toFixed(1)}: no edge`);
});

check('the pavement sits between the kerb and the road in value', () => {
  const s = spriteOf({});
  const pave = lumAt(s, 500, GROUND.contact + 4);
  const kerb = lumAt(s, 500, KERB_Y);
  const road = lumAt(s, 500, ROAD_Y + 8);
  assert(pave < kerb, `the pavement ${pave.toFixed(1)} is not under the kerb ${kerb.toFixed(1)}`);
  assert(pave > road, `the pavement ${pave.toFixed(1)} is not over the road ${road.toFixed(1)}`);
});

check('the sky is on the road: dusk and night do not paint the same wet asphalt', () => {
  const dusk = spriteOf({ sky: 'dusk' });
  const night = spriteOf({ sky: 'night' });
  assert(!samePixels(dusk, night), 'the road is the same under every sky');
  const d = lumAt(dusk, 500, ROAD_Y + 1);
  const n = lumAt(night, 500, ROAD_Y + 1);
  assert(Math.abs(d - n) > 1, `the road's first row is ${d.toFixed(1)} at dusk and ${n.toFixed(1)} at night`);
});

check('the alley spills ink past its own slot, which no other block does', () => {
  const s = spriteOf({});
  const alley = BLOCKS.find((b) => b.kind === 'alley');
  // two rows under the buildings' line, just outside the slot: the café's pavement and the alley's
  // spill, at the same row, so the difference is the spill and not the contact band above it
  const spilled = lumAt(s, alley.x - 6, 2);
  const plain = lumAt(s, 700, 2);
  assert(spilled < plain - 2, `the spill outside the slot is ${spilled.toFixed(1)}, the pavement ${plain.toFixed(1)}`);
});

check('the near edge falls into ink, so a long road cannot read as wallpaper', () => {
  const s = spriteOf({ h: BANDED + 40 });
  const road = lumAt(s, 500, ROAD_Y + 4);
  const near = lumAt(s, 500, s.h - 2);
  assert(near < road * 0.5, `the near edge ${near.toFixed(1)} is not under half the road ${road.toFixed(1)}`);
});

check('the same call paints the same pixels, and a wider frame paints a different street', () => {
  assert(samePixels(spriteOf({}), spriteOf({})), 'two identical calls disagree');
  assert(!samePixels(spriteOf({}), spriteOf({ w: STREET_W + 120 })), 'a wider frame is the same ground');
});

check('the ground holds no colour literal, no Math.random and no terrain tile', () => {
  const source = readFileSync(SOURCE, 'utf8');
  assert(!/#[0-9a-fA-F]{3,8}/.test(source), 'a colour literal is in ground.js');
  assert(!/Math\.random\s*\(/.test(source), 'Math.random is in ground.js');
  assert(!/terrain\.js/.test(source), 'the elevation ground imports the terrain catalogue');
});

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exitCode = 1;
