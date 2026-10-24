// Sky, ambient light and the night lighting pass.

import { mkCanvas, Painter, cacheSprite } from './pixel.js';
import { makeRng } from './rng.js';
import { C, mix, rgba } from './palette.js';

const AMBIENT = [
  [0, [54, 60, 104]],
  [4.5, [58, 64, 110]],
  [6, [128, 112, 152]],
  [7, [226, 182, 158]],
  [9, [252, 249, 240]],
  [13, [255, 255, 255]],
  [16.5, [255, 248, 232]],
  [18.5, [255, 192, 152]],
  [19.5, [188, 140, 164]],
  [21, [84, 88, 132]],
  [24, [54, 60, 104]],
];

const SKY = [
  [0, ['#0a1030', '#182a55']],
  [4.5, ['#0c1436', '#243a68']],
  [6, ['#3a4a90', '#d98a6a']],
  [7.5, ['#4a9ad8', '#b8e0f0']],
  [12, ['#3f8fd8', '#a8dcf2']],
  [17, ['#4a8fd0', '#e8d0a0']],
  [19, ['#5a3a78', '#f0a060']],
  [20.5, ['#22264e', '#6a4a7a']],
  [22, ['#0c1436', '#1e2c58']],
  [24, ['#0a1030', '#182a55']],
];

function wrapLerp(keys, hour, combine) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [h0, a] = keys[i];
    const [h1, b] = keys[i + 1];
    if (hour >= h0 && hour <= h1) {
      const t = (hour - h0) / (h1 - h0 || 1);
      return combine(a, b, t);
    }
  }
  return combine(keys[keys.length - 1][1], keys[keys.length - 1][1], 0);
}

export function ambientFor(hour) {
  const [r, g, b] = wrapLerp(AMBIENT, hour, (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]);
  return { r, g, b };
}

export function skyColors(hour) {
  const [top, bottom] = wrapLerp(SKY, hour, (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)]);
  return { top, bottom };
}

export function nightFactor(hour) {
  const a = ambientFor(hour);
  return Math.max(0, Math.min(1, (230 - (a.r + a.g + a.b) / 3) / 170));
}

const stars = (() => {
  const rng = makeRng(42);
  const out = [];
  for (let i = 0; i < 70; i++) out.push({ x: rng.range(0, 1), y: rng.range(2, 24), p: rng.range(0, 6), s: rng.chance(0.2) ? 2 : 1 });
  return out;
})();

const cloudCache = new Map();

function cloudSprite(seed) {
  return cacheSprite(cloudCache, `cloud|${seed}`, () => {
    const rng = makeRng(seed * 191 + 5);
    const w = rng.int(26, 44);
    const h = rng.int(9, 14);
    const p = new Painter(w, h);
    const blobs = rng.int(3, 5);
    for (let i = 0; i < blobs; i++) {
      const cx = 5 + (i * (w - 10)) / Math.max(1, blobs - 1);
      const cy = h / 2 + rng.range(-1, 1);
      const r = rng.range(3.5, 6);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (Math.hypot(x - cx, y - cy) > r) continue;
          p.px(x, y, C.white);
        }
      }
    }
    // flatten the base and shade the underside
    for (let x = 0; x < w; x++) {
      for (let y = h - 1; y >= 0; y--) {
        if (p.ctx.getImageData) break;
      }
    }
    p.dither(0, h - 3, w, 3, 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 0);
    return p.sprite();
  });
}

export function drawSky(ctx, hour, time, cam, viewW, viewH) {
  const { top, bottom } = skyColors(hour);
  const grad = ctx.createLinearGradient(0, 0, 0, 30);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(cam.x - 2, 0, viewW + 4, 56);

  const night = nightFactor(hour);
  if (night > 0.05) {
    for (const s of stars) {
      const tw = 0.55 + 0.45 * Math.sin(time * 2.2 + s.p);
      ctx.fillStyle = rgba('#ffffff', Math.min(1, night * tw * 1.1));
      const sx = Math.round(s.x * 480 + cam.x * 0.6) % 520;
      ctx.fillRect(sx, Math.round(s.y), s.s, s.s);
    }
  }

  // sun / moon travelling along a shallow arc
  const isDay = hour > 6 && hour < 19;
  const t = isDay ? (hour - 6) / 13 : ((hour < 6 ? hour + 5 : hour - 19) / 11);
  const arc = Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
  const bx = 60 + arc * 380;
  const by = 30 - arc * 20;
  if (t > -0.05 && t < 1.05) {
    if (isDay) {
      ctx.fillStyle = rgba('#ffe9a0', 0.35);
      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8d8';
      ctx.fillRect(Math.round(bx - 2), Math.round(by - 2), 4, 4);
    } else {
      ctx.fillStyle = rgba('#c8d4ec', 0.18);
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8eef8';
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a8b4cc';
      ctx.fillRect(Math.round(bx), Math.round(by - 3), 2, 2);
      ctx.fillRect(Math.round(bx - 3), Math.round(by + 1), 2, 1);
    }
  }

  // drifting clouds
  const clouds = [0, 1, 2, 3, 4];
  for (const i of clouds) {
    const spr = cloudSprite(i + 1);
    const speed = 5 + i * 1.6;
    const base = (i * 97) % 460;
    const x = ((base + time * speed) % 520) - 40;
    const y = 3 + ((i * 5) % 14);
    ctx.globalAlpha = 0.55 + (i % 3) * 0.12;
    ctx.drawImage(spr.canvas, Math.round(x), y);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- lighting

const LIGHT_COLOR_CACHE = new Map();

function lightCanvas(radius, color) {
  const key = `${Math.round(radius)}|${color}`;
  return cacheSprite(LIGHT_COLOR_CACHE, key, () => {
    const size = Math.ceil(radius) * 2;
    const cv = mkCanvas(size, size);
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, rgba(color, 0.95));
    grad.addColorStop(0.35, rgba(color, 0.6));
    grad.addColorStop(0.7, rgba(color, 0.22));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return { canvas: cv, w: size, h: size };
  });
}

let lmCanvas = null;
let glowCanvas = null;

export function lightIntensity(light, hour) {
  const night = nightFactor(hour);
  switch (light.kind) {
    case 'window':
      return night > 0.12 ? 0.55 + night * 0.45 : 0;
    case 'door':
      return night > 0.2 ? night * 0.6 : 0;
    case 'lamp':
      return night > 0.1 ? 0.4 + night * 0.6 : 0;
    case 'panel':
      return 0.15 + night * 0.85;
    case 'water':
      return night * 0.5;
    default:
      return night;
  }
}

export function drawLightmap(ctx, world, cam, hour, viewW, viewH, mod = { r: 1, g: 1, b: 1 }) {
  if (!lmCanvas || lmCanvas.width !== viewW || lmCanvas.height !== viewH) {
    lmCanvas = mkCanvas(viewW, viewH);
  }
  const g = lmCanvas.getContext('2d');
  const a = ambientFor(hour);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = `rgb(${Math.round(a.r * mod.r)},${Math.round(a.g * mod.g)},${Math.round(a.b * mod.b)})`;
  g.fillRect(0, 0, viewW, viewH);

  g.globalCompositeOperation = 'lighter';
  for (const light of world.lights) {
    const sx = light.x - cam.x;
    const sy = light.y - cam.y;
    if (sx < -light.r || sy < -light.r || sx > viewW + light.r || sy > viewH + light.r) continue;
    const intensity = lightIntensity(light, hour);
    if (intensity <= 0.01) continue;
    const spr = lightCanvas(light.r, light.color);
    g.globalAlpha = Math.min(1, intensity);
    g.drawImage(spr.canvas, Math.round(sx - light.r), Math.round(sy - light.r));
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lmCanvas, 0, 0);
  ctx.restore();
}

// Additive bloom so lamp bulbs and screens still read as emitters at night.
export function drawGlow(ctx, world, cam, hour, viewW, viewH) {
  const night = nightFactor(hour);
  if (night < 0.08) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const light of world.lights) {
    if (light.kind !== 'lamp' && light.kind !== 'panel' && light.kind !== 'window') continue;
    const sx = light.x - cam.x;
    const sy = light.y - cam.y;
    if (sx < -40 || sy < -40 || sx > viewW + 40 || sy > viewH + 40) continue;
    const intensity = lightIntensity(light, hour) * night;
    if (intensity <= 0.02) continue;
    const r = light.kind === 'panel' ? 11 : light.kind === 'window' ? 6 : 9;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, rgba(light.color, 0.5 * intensity));
    grad.addColorStop(1, rgba(light.color, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  ctx.restore();
}

export function drawVignette(ctx, viewW, viewH) {
  const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.35, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.72);
  grad.addColorStop(0, 'rgba(10,8,20,0)');
  grad.addColorStop(1, 'rgba(10,8,20,0.42)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
}
