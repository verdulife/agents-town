// Headless smoke test: stubs just enough DOM/canvas to bootstrap the real app
// in Node, then drives it through weather, hours and viewport sizes.
//
//   node tools/smoke.mjs
//
// It cannot judge how the town *looks* (that is what the screenshots are for),
// but it does catch runtime errors, broken invariants and layout regressions.

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

// ------------------------------------------------------------------ stubs

class FakeGradient {
  addColorStop() {}
}

class FakeCtx {
  constructor(el) {
    this.el = el;
    this.canvas = el;
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.imageSmoothingEnabled = false;
    this.ops = 0;
  }
  save() {}
  restore() {}
  setTransform() {}
  translate() {}
  scale() {}
  clearRect() {}
  fillRect() { this.ops++; }
  strokeRect() {}
  drawImage() { this.ops++; }
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  fill() {}
  stroke() {}
  createLinearGradient() { return new FakeGradient(); }
  createRadialGradient() { return new FakeGradient(); }
  getImageData(x, y, w, h) {
    const width = Math.max(1, Math.round(w));
    const height = Math.max(1, Math.round(h));
    return { data: new Uint8ClampedArray(width * height * 4), width, height };
  }
  putImageData() {}
}

class FakeClassList {
  constructor() {
    this.set = new Set();
  }
  add(...names) {
    names.forEach((n) => this.set.add(n));
  }
  remove(...names) {
    names.forEach((n) => this.set.delete(n));
  }
  toggle(name, force) {
    const on = force === undefined ? !this.set.has(name) : !!force;
    if (on) this.set.add(name);
    else this.set.delete(name);
    return on;
  }
  contains(name) {
    return this.set.has(name);
  }
}

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.style = {};
    this.dataset = {};
    this.classList = new FakeClassList();
    this.children = [];
    this.listeners = new Map();
    this.textContent = '';
    this.value = '0';
    this.width = 300;
    this.height = 150;
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  append(...children) {
    this.children.push(...children);
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatch(type, event = {}) {
    for (const fn of this.listeners.get(type) || []) fn(event);
  }
  getContext() {
    if (!this._ctx) this._ctx = new FakeCtx(this);
    return this._ctx;
  }
}

const elements = new Map();
const docListeners = new Map();

const document = {
  createElement(tag) {
    return new FakeElement(tag);
  },
  getElementById(id) {
    if (!elements.has(id)) {
      const el = new FakeElement(id === 'town' ? 'canvas' : 'div');
      if (id === 'time') el.tagName = 'INPUT';
      elements.set(id, el);
    }
    return elements.get(id);
  },
  addEventListener(type, fn) {
    if (!docListeners.has(type)) docListeners.set(type, []);
    docListeners.get(type).push(fn);
  },
};

let frameQueue = [];
let fakeNow = 0;

const window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  location: { search: process.env.TOWN_QUERY || '?hour=9&weather=clear' },
};

globalThis.window = window;
globalThis.document = document;
globalThis.location = window.location;
globalThis.HTMLInputElement = FakeElement;
globalThis.requestAnimationFrame = (fn) => {
  frameQueue.push(fn);
  return frameQueue.length;
};

function runFrames(n, stepMs = 16.7) {
  for (let i = 0; i < n; i++) {
    const queue = frameQueue;
    frameQueue = [];
    fakeNow += stepMs;
    for (const fn of queue) fn(fakeNow);
  }
}

// ------------------------------------------------------------------- run

console.log('pixel-town smoke test\n');

import { createWorld } from '../src/world.js';

await import('../src/main.js');
const town = globalThis.window.__town;
const { state, world, entities, weather, view } = town;
import { ambientFor, nightFactor } from '../src/lighting.js';
if (process.env.TOWN_QUERY) {
  console.log('DEBUG hour', state.hour, 'ambient', JSON.stringify(ambientFor(state.hour)), 'night', nightFactor(state.hour).toFixed(2), 'view', view.w, view.h);
}
const WORLD_W = world.W;
const WORLD_H = world.H;

check('bootstrap creates a populated world', () => {
  assert(town, 'window.__town was not exposed');
  assert(world.statics.length > 40, `expected many static objects, got ${world.statics.length}`);
  assert(world.lights.length > 12, `expected lights, got ${world.lights.length}`);
  assert(world.panels.length === 3, `expected 3 panels, got ${world.panels.length}`);
  assert(entities.length >= 25, `expected at least 25 entities, got ${entities.length}`);
  assert(world.walkTiles.length > 100, `expected walkable tiles, got ${world.walkTiles.length}`);
  for (const p of world.panels) {
    assert(p.inner && p.inner.w > 8 && p.inner.h > 8, `${p.kind} panel has no usable inner rect`);
  }
});

check('static objects stay inside the world', () => {
  for (const s of world.statics) {
    assert(s.x >= 0 && s.x <= WORLD_W, `${s.kind} x=${s.x} outside world`);
    assert(s.y > 0 && s.y <= WORLD_H, `${s.kind} y=${s.y} outside world`);
    assert(s.sprite && s.sprite.canvas, `${s.kind} has no sprite`);
    assert(Number.isFinite(s.sortY), `${s.kind} has no sort key`);
  }
});

check('renders 120 frames without throwing', () => {
  runFrames(120);
  assert(view.w > 0 && view.h > 0, 'empty viewport');
});

check('entities move and stay in bounds', () => {
  const before = entities.map((e) => ({ x: e.x, y: e.y }));
  runFrames(240);
  let moved = 0;
  entities.forEach((e, i) => {
    assert(Number.isFinite(e.x) && Number.isFinite(e.y), `${e.kind} has non-finite position`);
    assert(e.x >= 0 && e.x <= WORLD_W, `${e.kind} x=${e.x} outside world`);
    assert(e.y >= 0 && e.y <= WORLD_H, `${e.kind} y=${e.y} outside world`);
    if (Math.hypot(e.x - before[i].x, e.y - before[i].y) > 0.5) moved++;
  });
  assert(moved >= 3, `expected several entities to walk, only ${moved} moved`);
});

check('land entities only stand on walkable tiles', () => {
  for (const e of entities) {
    if (e.kind === 'bird' || e.kind === 'duck') continue;
    assert(world.walkableAt(e.x, e.y), `${e.kind} at ${e.x.toFixed(1)},${e.y.toFixed(1)} is on a blocked tile`);
  }
});

check('every weather reaches full intensity', () => {
  for (const kind of ['rain', 'snow', 'fog', 'clear']) {
    town.setWeather(kind);
    runFrames(90);
    assert(weather.amounts[kind] > 0.9, `${kind} only reached ${weather.amounts[kind].toFixed(2)}`);
  }
});

check('day, night and dusk all render', () => {
  for (const hour of [1, 6.5, 12, 19.5, 22.5]) {
    state.hour = hour;
    town.setWeather('clear');
    runFrames(6);
    assert(view.w > 0, `hour ${hour} produced no view`);
  }
});

check('responsive scaling always covers the window with integer scale', () => {
  const sizes = [
    [1280, 720],
    [1920, 1080],
    [2560, 1440],
    [3440, 1440],
    [5120, 1440],
    [820, 1400],
    [1024, 468],
    [640, 480],
  ];
  const canvas = document.getElementById('town');
  for (const [w, h] of sizes) {
    window.innerWidth = w;
    window.innerHeight = h;
    town.resize();
    runFrames(2);
    const cssW = parseFloat(canvas.style.width);
    const cssH = parseFloat(canvas.style.height);
    const scale = cssW / view.w;
    assert(Number.isInteger(scale) && scale >= 1, `${w}x${h}: scale ${scale} is not a positive integer`);
    assert(Math.abs(cssH / view.h - scale) < 1e-9, `${w}x${h}: non-square pixels`);
    assert(view.w <= WORLD_W && view.h <= WORLD_H, `${w}x${h}: viewport ${view.w}x${view.h} exceeds world ${WORLD_W}x${WORLD_H}`);
    assert(cssW >= w && cssH >= h, `${w}x${h}: canvas ${cssW}x${cssH} does not cover the window (letterbox)`);
    assert(cssW - w < scale && cssH - h < scale, `${w}x${h}: overflow larger than one logical pixel`);
  }
  window.innerWidth = 1280;
  window.innerHeight = 720;
  town.resize();
  runFrames(2);
});

check('pause freezes time and simulation', () => {
  state.hour = 10;
  state.paused = true;
  const t0 = state.time;
  runFrames(30);
  assert(state.time === t0, 'time advanced while paused');
  state.paused = false;
  runFrames(10);
  assert(state.time > t0, 'time did not advance after unpausing');
});

check('deterministic seed reproduces the same layout', () => {
  const a = createWorld(11);
  const b = createWorld(11);
  assert(a.statics.length === b.statics.length, 'different object counts for the same seed');
  const same = a.statics.every((s, i) => s.x === b.statics[i].x && s.y === b.statics[i].y);
  assert(same, 'same seed produced a different layout');
});

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
