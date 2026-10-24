// Bootstrap: canvas sizing, the animation loop, HUD and keyboard controls.

import { createWorld, WORLD_W, WORLD_H, GROUND_Y } from './world.js';
import { createEntities, updateEntities } from './entities.js';
import { createRenderer, computeCamera } from './render.js';
import { WeatherSystem, WEATHERS } from './weather.js';
import { nightFactor } from './lighting.js';

const params = new URLSearchParams(location.search);
const num = (key, fallback) => {
  const v = parseFloat(params.get(key));
  return Number.isFinite(v) ? v : fallback;
};

const TARGET_VIEW_HEIGHT = 216;
const DAY_LENGTH = 200; // seconds for a full 24h cycle

const canvas = document.getElementById('town');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const seed = Math.round(num('seed', 7));
const world = createWorld(seed);
const entities = createEntities(world, seed);
const renderer = createRenderer(world);
const weather = new WeatherSystem(params.get('weather') || 'clear');

const state = {
  hour: ((num('hour', 8.5) % 24) + 24) % 24,
  autoTime: params.get('auto') !== '0',
  paused: params.get('paused') === '1',
  hud: params.get('hud') !== '0',
  speed: Math.max(0.1, num('speed', 1)),
  time: num('t', 0),
};

const view = { w: 320, h: 216, groundY: GROUND_Y };
let scale = 1;

function resize() {
  const cw = Math.max(320, window.innerWidth);
  const ch = Math.max(240, window.innerHeight);
  // Integer upscale, then grow the logical viewport until it covers the window:
  // no letterboxing, and pixels always stay square.
  // floor (not round) keeps the zoom stable and shows more of the town
  let s = Math.max(1, Math.floor(ch / TARGET_VIEW_HEIGHT));
  s = Math.max(s, Math.ceil(cw / WORLD_W), Math.ceil(ch / WORLD_H));
  scale = s;
  view.w = Math.ceil(cw / s);
  view.h = Math.ceil(ch / s);
  canvas.width = view.w;
  canvas.height = view.h;
  canvas.style.width = `${view.w * s}px`;
  canvas.style.height = `${view.h * s}px`;
  canvas.style.left = `${Math.round((cw - view.w * s) / 2)}px`;
  canvas.style.top = `${Math.round((ch - view.h * s) / 2)}px`;
  ctx.imageSmoothingEnabled = false;
}

// ------------------------------------------------------------------ HUD

const hud = document.getElementById('hud');
const clockEl = document.getElementById('clock');
const timeSlider = document.getElementById('time');
const weatherRow = document.getElementById('weather');
const weatherButtons = new Map();

for (const kind of WEATHERS) {
  const btn = document.createElement('button');
  btn.textContent = kind;
  btn.addEventListener('click', () => setWeather(kind));
  weatherRow.appendChild(btn);
  weatherButtons.set(kind, btn);
}

const autoBtn = document.createElement('button');
autoBtn.textContent = 'auto';
autoBtn.addEventListener('click', () => {
  state.autoTime = !state.autoTime;
  syncHud();
});
const pauseBtn = document.createElement('button');
pauseBtn.textContent = 'pause';
pauseBtn.addEventListener('click', () => {
  state.paused = !state.paused;
  syncHud();
});
const hideBtn = document.createElement('button');
hideBtn.textContent = 'hide';
hideBtn.title = 'Hide the panel (H)';
hideBtn.addEventListener('click', () => {
  state.hud = false;
  syncHud();
});
document.getElementById('toggles').append(autoBtn, pauseBtn, hideBtn);

timeSlider.addEventListener('input', () => {
  state.hour = parseFloat(timeSlider.value) % 24;
  state.autoTime = false;
  syncHud();
});

function setWeather(kind) {
  weather.set(kind);
  syncHud();
}

function formatHour(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

let lastHudHour = -1;

function syncHud() {
  hud.style.display = state.hud ? 'block' : 'none';
  autoBtn.classList.toggle('on', state.autoTime);
  pauseBtn.classList.toggle('on', state.paused);
  for (const [kind, btn] of weatherButtons) btn.classList.toggle('on', weather.target === kind);
  if (Math.abs(state.hour - lastHudHour) > 0.004) {
    lastHudHour = state.hour;
    clockEl.textContent = formatHour(state.hour);
    timeSlider.value = state.hour.toFixed(2);
  }
  const phase = nightFactor(state.hour) > 0.5 ? 'night' : 'day';
  clockEl.dataset.phase = phase;
}

// ------------------------------------------------------------- controls

const isTyping = (ev) => ev.target instanceof HTMLInputElement;

window.addEventListener('keydown', (ev) => {
  if (isTyping(ev) && ev.code !== 'Space') return;
  switch (ev.code) {
    case 'Space':
      ev.preventDefault();
      state.paused = !state.paused;
      break;
    case 'Digit1':
      setWeather('clear');
      break;
    case 'Digit2':
      setWeather('rain');
      break;
    case 'Digit3':
      setWeather('snow');
      break;
    case 'Digit4':
      setWeather('fog');
      break;
    case 'KeyA':
      state.autoTime = !state.autoTime;
      break;
    case 'KeyH':
      state.hud = !state.hud;
      break;
    case 'ArrowRight':
      state.hour = (state.hour + 0.5) % 24;
      state.autoTime = false;
      break;
    case 'ArrowLeft':
      state.hour = (state.hour + 23.5) % 24;
      state.autoTime = false;
      break;
    default:
      return;
  }
  syncHud();
});

// ---------------------------------------------------------------- loop

let last = performance.now();

function frame(now) {
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.06, Math.max(0, raw));

  if (!state.paused) {
    state.time += dt * state.speed;
    if (state.autoTime) state.hour = (state.hour + (24 / DAY_LENGTH) * dt * state.speed) % 24;
    updateEntities(entities, dt * state.speed, world, state.hour, state.time);
    weather.update(dt * state.speed, state.time, view);
  }

  const cam = computeCamera(world, view);
  view.groundY = GROUND_Y - cam.y;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  renderer.draw(ctx, { view, cam, hour: state.hour, time: state.time, entities, weather });

  syncHud();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  last = performance.now();
});

resize();
syncHud();

// Exposed for debugging, screenshots and manual tinkering from the console.
window.__town = { state, world, entities, renderer, weather, view, setWeather, resize };

requestAnimationFrame(frame);
