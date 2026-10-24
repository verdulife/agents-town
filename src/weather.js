// Weather: rain, snow and fog, cross-faded so switching never pops.

import { makeRng } from './rng.js';
import { rgba } from './palette.js';

export const WEATHERS = ['clear', 'rain', 'snow', 'fog'];

const rng = makeRng(20240);

function makeSet(count, make) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(make());
  return out;
}

const rainDrops = makeSet(300, () => ({
  x: rng.next(),
  y: rng.next(),
  vy: rng.range(420, 760),
  len: rng.chance(0.4) ? 5 : 4,
  a: rng.range(0.35, 0.75),
}));

const snowFlakes = makeSet(240, () => ({
  x: rng.next(),
  y: rng.next(),
  vy: rng.range(24, 70),
  drift: rng.range(0.6, 1.9),
  phase: rng.range(0, 6.28),
  s: rng.chance(0.3) ? 2 : 1,
}));

const motes = makeSet(26, () => ({
  x: rng.next(),
  y: rng.next(),
  vy: rng.range(2, 8),
  phase: rng.range(0, 6.28),
}));

export class WeatherSystem {
  constructor(kind = 'clear') {
    // start fully in the requested weather: no fade-in on the first frame
    this.amounts = { clear: 0, rain: 0, snow: 0, fog: 0 };
    for (const k of WEATHERS) this.amounts[k] = k === kind ? 1 : 0;
    this.target = kind;
    this.set(kind);
    this.splashes = [];
    this.wind = 26;
    this.gust = 0;
  }

  set(kind) {
    if (!WEATHERS.includes(kind)) return;
    this.target = kind;
  }

  get kind() {
    return this.target;
  }

  update(dt, time, view) {
    for (const k of WEATHERS) {
      const goal = k === this.target ? 1 : 0;
      const a = this.amounts[k];
      this.amounts[k] = Math.abs(goal - a) < dt * 1.4 ? goal : a + Math.sign(goal - a) * dt * 1.4;
    }
    const gustWave = Math.sin(time * 0.7) + Math.sin(time * 0.23 + 1.7) * 0.6;
    this.gust = gustWave * 12;

    // splashes live in screen space, spawned from the ground band
    this.splashes = this.splashes.filter((s) => (s.life -= dt) > 0);
    if (this.amounts.rain > 0.05 && rng.next() < dt * 70 * this.amounts.rain) {
      const groundTop = Math.max(view.groundY + 8, view.h * 0.35);
      this.splashes.push({
        x: rng.range(0, view.w),
        y: rng.range(groundTop, view.h),
        life: 0.22,
        max: 0.22,
      });
    }
  }

  // Multiplier applied to the ambient light colour.
  ambientMod() {
    const rain = this.amounts.rain;
    const snow = this.amounts.snow;
    const fog = this.amounts.fog;
    return {
      r: 1 - rain * 0.22 - fog * 0.06 + snow * 0.04,
      g: 1 - rain * 0.18 - fog * 0.04 + snow * 0.06,
      b: 1 - rain * 0.1 - fog * 0.01 + snow * 0.09,
    };
  }

  // Screen-space wash drawn over the whole scene before lighting.
  drawWash(ctx, view) {
    const rain = this.amounts.rain;
    const fog = this.amounts.fog;
    if (rain > 0.01) {
      ctx.fillStyle = rgba('#1d2a44', 0.1 * rain);
      ctx.fillRect(0, 0, view.w, view.h);
    }
    if (fog > 0.01) {
      ctx.fillStyle = rgba('#cdd8e4', 0.16 * fog);
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  drawFog(ctx, view, time) {
    const fog = this.amounts.fog;
    if (fog <= 0.01) return;
    ctx.save();
    for (let band = 0; band < 4; band++) {
      const y = view.groundY - 6 + band * 16 + Math.sin(time * 0.3 + band) * 2;
      const speed = 7 + band * 5;
      const offset = (time * speed) % (view.w + 60);
      for (let i = -1; i < 4; i++) {
        const x = offset + i * (view.w / 2) - 30;
        const gradient = ctx.createLinearGradient(x, y, x + view.w / 2, y);
        gradient.addColorStop(0, rgba('#d6e2ee', 0));
        gradient.addColorStop(0.5, rgba('#d6e2ee', 0.19 * fog * (1 - band * 0.14)));
        gradient.addColorStop(1, rgba('#d6e2ee', 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, view.w / 2 + 4, 12);
      }
    }
    ctx.restore();
  }

  drawFront(ctx, view, time, dim = 1) {
    const { w, h } = view;
    const rain = this.amounts.rain;
    const snow = this.amounts.snow;
    const clear = this.amounts.clear;

    if (clear > 0.02) {
      for (const m of motes) {
        const x = (m.x * w + Math.sin(time * 0.6 + m.phase) * 8 + time * 4) % w;
        const y = (m.y * h + time * m.vy) % h;
        ctx.fillStyle = rgba('#fff3c4', 0.22 * clear * dim);
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }

    if (snow > 0.02) {
      for (const f of snowFlakes) {
        const x = (f.x * w + Math.sin(time * f.drift + f.phase) * 12 + time * 6) % w;
        const y = (f.y * h + time * f.vy) % h;
        ctx.fillStyle = rgba('#ffffff', (0.7 + 0.3 * Math.sin(time * 2 + f.phase)) * snow);
        ctx.fillRect(Math.round(x), Math.round(y), f.s, f.s);
      }
    }

    if (rain > 0.02) {
      const slant = Math.round((this.wind + this.gust) * 0.09);
      ctx.strokeStyle = rgba('#cfe6ff', 0.5 * rain);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of rainDrops) {
        const y = ((d.y * h + time * d.vy) % (h + 8)) - 4;
        const x = (d.x * w + (time * (this.wind + this.gust) * d.vy) / 700) % (w + 8);
        ctx.moveTo(Math.round(x), Math.round(y));
        ctx.lineTo(Math.round(x) + slant, Math.round(y) + d.len);
      }
      ctx.stroke();

      for (const s of this.splashes) {
        const t = 1 - s.life / s.max;
        const spread = 1 + t * 3;
        ctx.fillStyle = rgba('#e2f2ff', 0.75 * (1 - t) * rain);
        ctx.fillRect(Math.round(s.x - spread), Math.round(s.y), Math.round(spread * 2), 1);
        ctx.fillStyle = rgba('#e2f2ff', 0.45 * (1 - t) * rain);
        ctx.fillRect(Math.round(s.x), Math.round(s.y - 1), 1, 1);
      }
    }
  }

  label() {
    const names = { clear: 'Clear', rain: 'Rain', snow: 'Snow', fog: 'Fog' };
    return names[this.target] || 'Clear';
  }
}
