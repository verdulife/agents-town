// Park invariants (T12, S24). The park is a strip whose composition is derived from its own width,
// so most of what it promises is a statement about the layout:
//   node tools/park-check.mjs
//
// The strip's rule ("it grows by fitting more") is only worth having if the count never falls as
// the frame grows, so that is checked by sweeping widths. The geometry ("a tree never covers the
// fountain") is checked on the boxes the layout hands out, because those are what the painters use.
// The width rule is checked on the street's own layout, which is where the strip is handed to the
// park in the first place. The last two checks read the finished pixels — the sprite stands on the
// ground line, the jet changes frame — and the source text, because the palette rule is the one rule
// a literal could sneak back into.

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

// --- pixel helpers ---------------------------------------------------------

// A stable hash of a whole sprite, alpha included: two frames that differ in one pixel differ here.
function pixelHash(spr) {
  const d = spr.canvas.data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) {
    h ^= d[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The box the sprite actually painted in, alpha included, or null for a blank sprite.
function paintedBox(spr) {
  const { w, h } = spr;
  const d = spr.canvas.data;
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, count: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] < 8) continue;
      box.count++;
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x);
      box.y1 = Math.max(box.y1, y);
    }
  }
  return box.count ? box : null;
}

const boxOf = (p) => ({ x0: p.x, y0: p.y, x1: p.x + p.w - 1, y1: p.y + p.h - 1 });

const overlaps = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

const inStrip = (box, w) => box.x0 >= 0 && box.x1 <= w - 1 && box.y0 >= 0;

// --- the module ------------------------------------------------------------

const { PARK, parkLayout, parkSprite, parkAnimations } = await import('../src/next/park.js');
// A second instance of the same module, so "the same width gives the same numbers" is asked of a
// layout that was not the one already in this process's memo.
const fresh = await import('../src/next/park.js?fresh=1');
// The street's own layout, for the width rule: the park is what the gym no longer absorbs.
const { streetLayout } = await import('../src/next/street.js');
// The town's own painter stub, for the last pixel check: a strip has to build where nothing is
// rasterised, which is the minimum the page's sprite modules promise.
const { installCanvasStub } = await import('./canvas-stub.mjs');

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

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, '..', 'src', 'next', 'park.js');

// The widths the frame actually produces, plus the ones the layout has a step in: 0 (the street's
// own 822 and anything narrower), a strip below the fountain's, and both sides of every threshold.
const SAMPLE = [0, 8, 20, 39, 40, 41, 52, 62, 72, 80, 84, 100, 104, 120, 129, 130, 138, 160, 200, 240, 300, 420, 600, 900];

console.log('park check\n');

// --- a) the sprite ---------------------------------------------------------

check('the sprite is the width it was asked for, and its height is the layout\'s', () => {
  for (const w of SAMPLE) {
    const L = parkLayout(w);
    const spr = parkSprite(w);
    assert(spr.w === w, `parkSprite(${w}).w is ${spr.w}`);
    // a canvas cannot be zero wide, so an empty strip is one transparent row of the width
    assert(spr.canvas.width === Math.max(1, spr.w), `the canvas of ${w} is ${spr.canvas.width} wide`);
    assert(spr.h === L.h, `parkSprite(${w}).h is ${spr.h}, the layout says ${L.h}`);
    // the painting is the height the layout priced: a transparent sprite is 1 row, a real one is h
    assert(spr.canvas.height === Math.max(1, spr.h), `the canvas of ${w} is ${spr.canvas.height} tall`);
  }
  // painted once: a second ask is the same sprite, another width is another sprite
  assert(parkSprite(240) === parkSprite(240), 'the same strip was painted twice');
  assert(parkSprite(240) !== parkSprite(420), 'two widths share one sprite');
});

check('the park does not exist below PARK.minW', () => {
  let live = 0;
  for (let w = 0; w < PARK.minW; w++) {
    const L = parkLayout(w);
    assert(L.empty, `a ${w} px strip has a layout`);
    assert(L.h === 0, `a ${w} px strip is ${L.h} tall`);
    assert(L.trees.length === 0 && !L.fountain && !L.hedge && !L.bench && !L.lamp && !L.jet, `a ${w} px strip has props`);
    assert(parkAnimations(w).length === 0, `a ${w} px strip animates`);
    const spr = parkSprite(w);
    assert(spr.h === 0, `a ${w} px strip paints ${spr.h} rows`);
    assert(paintedBox(spr) === null, `a ${w} px strip painted ${paintedBox(spr)?.count} pixels`);
    live++;
  }
  assert(live === PARK.minW, `the sweep ran ${live} widths, expected ${PARK.minW}`);
  // and one pixel above the line it does exist, so minW is the boundary and not a wider margin
  assert(!parkLayout(PARK.minW).empty, `PARK.minW itself (${PARK.minW}) is empty`);
});

check('a real strip stands on the ground line and stays inside itself', () => {
  for (const w of SAMPLE.filter((x) => x >= PARK.minW)) {
    const L = parkLayout(w);
    const spr = parkSprite(w);
    const box = paintedBox(spr);
    assert(box, `the ${w} px strip painted nothing`);
    assert(box.x0 >= 0 && box.x1 <= w - 1, `the ${w} px strip painted columns ${box.x0}..${box.x1}`);
    assert(box.y1 === L.h - 1, `the ${w} px strip's lowest pixel is row ${box.y1}, the ground line is ${L.h - 1}`);
    // the bottom row carries paint all the way across the hedge: the strip is planted, not floating
    const d = spr.canvas.data;
    let bottom = 0;
    for (let x = 0; x < w; x++) if (d[((L.h - 1) * w + x) * 4 + 3] > 8) bottom++;
    assert(bottom >= L.hedge.w - 2, `only ${bottom} of the ${w} px strip's bottom row is painted`);
    // and it is a strip, not a slab: the grass the page lays is what shows between the props
    assert(box.count < w * L.h, `the ${w} px strip is painted solid`);
  }
});

// --- b) the layout ---------------------------------------------------------

check('the same width gives the same layout, and no width borrows another\'s numbers', () => {
  for (const w of SAMPLE) {
    const once = JSON.stringify(parkLayout(w));
    const twice = JSON.stringify(parkLayout(w));
    assert(once === twice, `w=${w} gave two layouts`);
    // the other instance of the module never saw this process's memo
    assert(JSON.stringify(fresh.parkLayout(w)) === once, `w=${w} and a fresh module disagree`);
  }
  assert(parkLayout(240) !== parkLayout(420), 'two widths share one layout object');
  // a layout read out of order is still the same layout: nothing accumulates between widths
  const before = JSON.stringify(parkLayout(240));
  parkLayout(100);
  parkLayout(420);
  assert(JSON.stringify(parkLayout(240)) === before, 'the layout of 240 changed after other widths were built');
});

check('every prop is inside the strip', () => {
  for (const w of SAMPLE.filter((x) => x >= PARK.minW)) {
    const L = parkLayout(w);
    const props = [L.hedge, L.fountain, L.bench, L.lamp, ...L.trees].filter(Boolean);
    assert(props.length >= 2, `the ${w} px strip holds ${props.length} props`);
    for (const prop of props) {
      assert(inStrip(boxOf(prop), w), `a prop of ${w} is at ${prop.x}..${prop.x + prop.w - 1}`);
      assert(prop.y + prop.h - 1 === L.ground, `a prop of ${w} has its base on row ${prop.y + prop.h - 1}, not ${L.ground}`);
    }
    // the jet is the one box that does not stand on the ground: it leaves the upper bowl, so its
    // bottom row is that bowl's water and its top is the top of the fountain it belongs to
    assert(inStrip(boxOf(L.jet), w), `the jet of ${w} is at ${L.jet.x}..${L.jet.x + L.jet.w - 1}`);
    assert(L.jet.y === L.fountain.y, `the jet of ${w} starts at row ${L.jet.y}, the fountain at ${L.fountain.y}`);
    assert(L.jet.y + L.jet.h < L.fountain.y + L.fountain.h, `the jet of ${w} runs past the fountain it comes out of`);
    // the fountain exists in every strip that exists, and it is centred
    assert(L.fountain, `the ${w} px strip has no fountain`);
    const left = L.fountain.x;
    const right = w - (L.fountain.x + L.fountain.w);
    assert(Math.abs(left - right) <= 1, `the fountain of ${w} is ${left} from the left edge and ${right} from the right`);
  }
});

check('no tree or bench covers the fountain', () => {
  for (const w of SAMPLE.filter((x) => x >= PARK.minW)) {
    const L = parkLayout(w);
    const fountain = boxOf(L.fountain);
    for (const [i, tree] of L.trees.entries()) {
      assert(!overlaps(boxOf(tree), fountain), `tree ${i} of ${w} covers the fountain`);
    }
    if (L.bench) assert(!overlaps(boxOf(L.bench), fountain), `the bench of ${w} covers the fountain`);
    // and no two trees cover each other: the gutter is what makes each crown its own
    for (let i = 0; i < L.trees.length; i++) {
      for (let j = i + 1; j < L.trees.length; j++) {
        assert(!overlaps(boxOf(L.trees[i]), boxOf(L.trees[j])), `trees ${i} and ${j} of ${w} overlap`);
      }
    }
    // the bench stands beside the fountain, on one side of it
    if (L.bench) assert(L.bench.x >= L.fountain.x, `the bench of ${w} is not right of the fountain`);
  }
});

check('the tree count never falls as the strip grows, and it is capped', () => {
  let last = 0;
  let widest = 0;
  let benches = 0;
  let lamps = 0;
  for (let w = PARK.minW; w <= 900; w++) {
    const L = parkLayout(w);
    const n = L.trees.length;
    assert(n >= last, `w=${w} dropped from ${last} trees to ${n}`);
    assert(n <= PARK.trees.max, `w=${w} holds ${n} trees, over the cap of ${PARK.trees.max}`);
    if (L.bench) benches++;
    if (L.lamp) lamps++;
    last = n;
    widest = n;
  }
  // "1 to 4" from the brief, in the direction the frame actually moves
  assert(widest === PARK.trees.max, `the widest strip holds ${widest} trees, expected ${PARK.trees.max}`);
  assert(benches > 0 && benches < 900 - PARK.minW, `the bench appears on ${benches} of the widths`);
  assert(lamps > 0 && lamps < 900 - PARK.minW, `the lamp appears on ${lamps} of the widths`);
  // a narrow strip has 1-2 and a wide one 3-4, which is the sentence the log makes
  assert(parkLayout(160).trees.length >= 1 && parkLayout(160).trees.length <= 2, `w=160 holds ${parkLayout(160).trees.length}`);
  assert(parkLayout(420).trees.length >= 3, `w=420 holds ${parkLayout(420).trees.length}`);
});

check('the hedge is the boundary: inside the strip, behind everything, full width minus its margin', () => {
  for (const w of SAMPLE.filter((x) => x >= PARK.minW)) {
    const L = parkLayout(w);
    const hd = L.hedge;
    assert(hd, `the ${w} px strip has no hedge`);
    assert(hd.x === PARK.hedge.margin, `the hedge of ${w} starts at ${hd.x}`);
    assert(hd.x + hd.w === w - PARK.hedge.margin, `the hedge of ${w} ends at ${hd.x + hd.w} of ${w}`);
    assert(hd.h === PARK.hedge.h, `the hedge of ${w} is ${hd.h} tall`);
    assert(hd.y + hd.h - 1 === L.ground, `the hedge of ${w} does not stand on the ground line`);
    // it is the strip's own boundary and never taller than the park
    assert(hd.y >= 0, `the hedge of ${w} starts above the sprite`);
  }
});

// --- c) the jet ------------------------------------------------------------

check('the jet is one element, three frames, placed in the park\'s own coordinates', () => {
  for (const w of SAMPLE.filter((x) => x >= PARK.minW)) {
    const L = parkLayout(w);
    const list = parkAnimations(w);
    assert(list.length === 1, `${w} px of park produce ${list.length} animated elements`);
    const [jet] = list;
    assert(jet.key === 'parkjet', `the element is keyed "${jet.key}"`);
    assert(jet.origin === 'park', `the element's origin is "${jet.origin}"`);
    assert(jet.frames === PARK.fountain.jet.frames, `the element has ${jet.frames} frames`);
    assert(jet.fps === PARK.fountain.jet.fps, `the element runs at ${jet.fps} fps`);
    for (const t of [0, 0.01, 0.2, 1, 3.75, 60]) {
      const { sprite, x, y } = jet.place(t);
      assert(sprite.w === L.jet.w && sprite.h === L.jet.h, `a ${w} px jet frame is ${sprite.w}x${sprite.h}`);
      // the place is inside the sprite, never a page coordinate: the page adds the block's offset
      assert(x === L.jet.x && y === L.jet.y, `the jet of ${w} is placed at ${x},${y}, the layout says ${L.jet.x},${L.jet.y}`);
      assert(x >= 0 && x + sprite.w <= w && y >= 0, `the jet of ${w} is placed outside the strip`);
    }
  }
  assert(parkAnimations(PARK.minW - 1).length === 0, 'a strip with no art animates');
});

check('the jet changes frame on the clock, and freezes at frame 0', () => {
  const [jet] = parkAnimations(240);
  const hashes = [];
  for (let f = 0; f < jet.frames; f++) hashes.push(pixelHash(jet.place(f / jet.fps).sprite));
  assert(new Set(hashes).size === jet.frames, `the ${jet.frames} frames hold ${new Set(hashes).size} pictures`);
  // frame 0 is t=0, and the cycle comes back to it
  assert(pixelHash(jet.place(0).sprite) === hashes[0], 't=0 is not frame 0');
  assert(pixelHash(jet.place(jet.frames / jet.fps).sprite) === hashes[0], 'the cycle does not return to frame 0');
  // ?anim=0 and prefers-reduced-motion: the same frame whatever the clock says
  const frozen = [0, 0.3, 2, 7.5].map((t) => pixelHash(jet.place(t, true).sprite));
  assert(new Set(frozen).size === 1, 'the frozen jet moved with the clock');
  assert(frozen[0] === hashes[0], 'the frozen jet is not frame 0');
  // ?pause=1&sim=N: the same simulated second twice, pixel for pixel
  const shot = () => pixelHash(jet.place(2).sprite);
  assert(shot() === shot(), 'two captures of the same simulated second disagree');
  assert(shot() !== hashes[0], 't=2 is the frozen frame: the clock never reaches the jet');
});

check('the street hands the strip to the park, and hands it nothing below the fountain', () => {
  // The strip the whole task is about: viewW - 822, and never a pixel of the gym's own width
  const streetOf = (w) => streetLayout(w, 487, 406);
  const widths = (L) => L.blocks.reduce((total, b) => total + b.w, 0);
  for (let w = 862; w <= 1400; w += 7) {
    const L = streetOf(w);
    const gym = L.blocks.find((b) => b.kind === 'gym');
    const park = L.blocks.find((b) => b.kind === 'park');
    assert(gym.w === 240, `the gym is ${gym.w} wide at a view of ${w}`);
    assert(park, `a view of ${w} has no park`);
    assert(park.w === w - 822, `the park at ${w} is ${park.w} wide, the leftover is ${w - 822}`);
    assert(park.x === gym.x + gym.w, `the park at ${w} does not start where the gym ends`);
    assert(park.h === parkLayout(park.w).h, `the park block at ${w} is not the layout's height`);
    // the blocks are the frame: nothing is lost and nothing is invented
    assert(widths(L) === w, `the blocks of ${w} do not add up`);
    assert(L.parkW === w - 822, `the strip at ${w} is ${L.parkW}`);
    assert(L.leftover === 0, `the leftover at ${w} is ${L.leftover}, every pixel is a block`);
  }
  // at exactly 822 the street is complete and there is no strip to give
  const exact = streetOf(822);
  assert(exact.blocks.find((b) => b.kind === 'gym').w === 240, 'the gym at 822 is not 240');
  assert(!exact.blocks.some((b) => b.kind === 'park'), 'a view of 822 has a park');
  assert(exact.leftover === 0, `the leftover at 822 is ${exact.leftover}`);
  // a strip too narrow to hold the fountain is not a park: no block, no readout line, no grass band
  // to look at, and the pixels it takes are reported as leftover instead of pretending to be one
  for (const w of [830, 840, PARK.minW + 822 - 1]) {
    const L = streetOf(w);
    assert(!L.blocks.some((b) => b.kind === 'park'), `a view of ${w} has a park below PARK.minW`);
    assert(L.parkW === w - 822, `the strip at ${w} is ${L.parkW}`);
    assert(L.leftover === w - 822, `the leftover at ${w} is ${L.leftover}, not the strip`);
    assert(widths(L) + L.leftover === w, `the blocks and the leftover of ${w} do not add up`);
  }
  // narrower than the street's own width: no park, and the gym is clipped exactly as before
  const narrow = streetOf(700);
  assert(!narrow.blocks.some((b) => b.kind === 'park'), 'a narrow view has a park');
  assert(narrow.blocks.find((b) => b.kind === 'gym').w === 700 - 582, 'the gym at 700 is not the room that is left');
});

check('everything in the park stands on the plot, and the plot is under it', () => {
  for (const w of SAMPLE) {
    const L = parkLayout(w);
    if (L.empty) continue;
    // the plot is the bottom rows of the sprite: a kerb at the street and the grass behind it
    assert(L.plot, `the ${w} px layout has no plot`);
    const plotRows = L.plot.kerb + L.plot.grass;
    assert(L.h === L.ground + 1 + plotRows, `the ${w} px park is ${L.h} tall, the ground ${L.ground} and the plot ${plotRows}`);
    for (const prop of [L.hedge, L.fountain, L.bench, L.bin, L.lamp, ...L.trees].filter(Boolean)) {
      assert(prop.y + prop.h - 1 === L.ground, `a prop in the ${w} px park does not end on the ground row`);
    }
  }
});

check('the bin stands by the bench, inside the strip', () => {
  for (const w of SAMPLE) {
    const L = parkLayout(w);
    if (L.empty || !L.bin) continue;
    assert(L.bin.x >= 0 && L.bin.x + L.bin.w <= w, `the ${w} px bin is outside the strip`);
    assert(L.bench, `the ${w} px park has a bin and no bench to stand it by`);
    assert(L.bin.x >= L.bench.x + L.bench.w, `the ${w} px bin is not to the right of the bench`);
  }
});

// --- d) the palette --------------------------------------------------------

check('the strip also builds under the plain canvas stub, where nothing is rasterised', () => {
  // A width no other check asks for, so this is a fresh paint and not the memo: the raster stub above
  // is swapped out for the town's minimal one, and the painters must still run to the end.
  const raster = globalThis.document;
  globalThis.document = undefined;
  installCanvasStub();
  try {
    const w = 361;
    const spr = parkSprite(w);
    assert(spr.w === w, `the stub strip is ${spr.w} wide`);
    assert(spr.h === parkLayout(w).h, `the stub strip is ${spr.h} tall, the layout says ${parkLayout(w).h}`);
    assert(spr.canvas.width === w && spr.canvas.height === spr.h, 'the stub strip canvas is another size');
  } finally {
    globalThis.document = raster;
  }
});

check('park.js holds no colour literal and no Math.random', () => {
  const text = readFileSync(SOURCE, 'utf8');
  const literals = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert(literals.length === 0, `${literals.length} colour literals in park.js: ${literals.slice(0, 5).join(' ')}`);
  // the header spells both rules out by name, so the check has to look for a call and not a word
  assert(!/Math\.random\s*\(/.test(text), 'park.js calls Math.random');
  // and no clock: the module may not read the time, the page hands it over
  assert(!/\bDate\.now\s*\(|\bperformance\.now\s*\(/.test(text), 'park.js reads a clock');
});

// --- the numbers, for a reader without a browser ---------------------------

function describe(w) {
  const L = parkLayout(w);
  if (L.empty) return [`w=${w}  empty (below PARK.minW ${PARK.minW}): no block art, the strip is grass`];
  const line = (label, box) => `  ${label.padEnd(9)} x ${String(box.x).padStart(3)} w ${String(box.w).padStart(3)}  top ${String(box.y).padStart(2)}`;
  const out = [
    `w=${w}  h=${L.h}  trees=${L.trees.length}${L.bench ? '  bench' : ''}${L.lamp ? '  lamp' : ''}`,
    line('hedge', L.hedge),
    line('fountain', L.fountain),
    ...L.trees.map((t, i) => line(`tree[${i}]`, t)),
    line('jet', L.jet),
  ];
  if (L.bench) out.push(line('bench', L.bench));
  if (L.lamp) out.push(line('lamp', L.lamp));
  return out;
}

console.log('\n  layout, for the widths the brief asks about:');
for (const w of [0, 20, 100, 138, 240, 420]) console.log(describe(w).map((l) => `  ${l}`).join('\n'));

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
