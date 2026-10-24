// Layer pipeline: sky -> backdrop -> ground -> depth-sorted objects -> weather
// -> lighting -> vignette. Everything is drawn at logical resolution; the
// browser upscales by an integer factor, which is what keeps pixels square.

import { mkCanvas } from './pixel.js';
import { C, rgba, mix } from './palette.js';
import { TILE, T, GROUND_Y } from './world.js';
import { drawText, measureText } from './font.js';
import { drawSky, drawLightmap, drawGlow, drawVignette } from './lighting.js';
import { personSprite, animalSprite, shadowSprite, smokePuffSprite } from './sprites.js';

function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const terrainAt = (world, tx, ty) => {
  if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return T.BACKDROP;
  return world.terrain[ty * world.cols + tx];
};

function bakeBackdrop(world) {
  const cv = mkCanvas(world.W, GROUND_Y + 12);
  const ctx = cv.getContext('2d');
  // distant hills: two silhouette layers with a treeline ridge
  for (let layer = 0; layer < 2; layer++) {
    const baseY = 22 + layer * 8;
    const amp = 7 - layer * 3;
    const color = layer === 0 ? mix(C.grassDeep, C.ink, 0.25) : C.grassDeep;
    ctx.fillStyle = color;
    for (let x = 0; x < world.W; x++) {
      const y = Math.round(baseY + Math.sin(x * 0.021 + layer * 2.1) * amp + Math.sin(x * 0.061 + layer) * (amp * 0.4));
      ctx.fillRect(x, y, 1, GROUND_Y + 12 - y);
    }
    // little tree bumps along the ridge
    for (let x = layer * 7; x < world.W; x += 13 - layer * 4) {
      const h = hash2(x, layer);
      if (h < 0.45) continue;
      const y = Math.round(baseY + Math.sin(x * 0.021 + layer * 2.1) * amp);
      const th = 3 + Math.round(h * 4);
      ctx.fillStyle = layer === 0 ? mix(C.grassDeep, C.ink, 0.35) : mix(C.grassDark, C.ink, 0.15);
      for (let i = 0; i < th; i++) ctx.fillRect(x - (th - i), y - i, (th - i) * 2, 1);
    }
  }
  ctx.fillStyle = C.grassDeep;
  ctx.fillRect(0, 34, world.W, GROUND_Y + 12 - 34);
  return cv;
}

function bakeGround(world) {
  const cv = mkCanvas(world.W, world.H);
  const ctx = cv.getContext('2d');
  const set = (color) => {
    ctx.fillStyle = color;
  };
  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const px = (x, y, color) => rect(x, y, 1, 1, color);

  // base grass everywhere below the horizon
  set(C.grass);
  ctx.fillRect(0, GROUND_Y, world.W, world.H - GROUND_Y);

  for (let ty = 0; ty < world.rows; ty++) {
    for (let tx = 0; tx < world.cols; tx++) {
      const t = terrainAt(world, tx, ty);
      if (t === T.BACKDROP) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const h = hash2(tx, ty);

      if (t === T.GRASS) {
        rect(x, y, TILE, TILE, C.grass);
        if (h < 0.22) {
          for (let j = 0; j < TILE; j += 2) for (let i = 0; i < TILE; i += 2) if ((i + j) % 4 === 0) px(x + i, y + j, C.grassDark);
        } else if (h > 0.8) {
          for (let j = 0; j < TILE; j += 2) for (let i = 0; i < TILE; i += 2) if ((i + j) % 4 === 0) px(x + i, y + j, C.grassLite);
        }
        // tufts
        const tufts = 1 + Math.floor(h * 3);
        for (let i = 0; i < tufts; i++) {
          const tx2 = x + 2 + Math.floor(hash2(tx + i * 3, ty + i) * 11);
          const ty2 = y + 3 + Math.floor(hash2(tx + i, ty + i * 5) * 10);
          const col = hash2(tx * i, ty + i) > 0.5 ? C.grassDark : C.grassSun;
          px(tx2, ty2, col);
          px(tx2 + 1, ty2 - 1, col);
          px(tx2 + 2, ty2, col);
        }
      } else if (t === T.ROAD || t === T.DIRT) {
        rect(x, y, TILE, TILE, t === T.ROAD ? C.dirtMid : C.dirt);
        for (let j = 0; j < TILE; j++) {
          for (let i = 0; i < TILE; i++) {
            const d = hash2(tx * 16 + i, ty * 16 + j);
            if (d < 0.13) px(x + i, y + j, t === T.ROAD ? C.dirt : C.dirtDeep);
            else if (d > 0.955) px(x + i, y + j, C.dirtLite);
          }
        }
        if (h < 0.4) {
          for (let i = 0; i < 3; i++) {
            const px2 = x + Math.floor(hash2(tx + i, ty * 3) * 14);
            const py2 = y + Math.floor(hash2(tx * 5, ty + i) * 14);
            px(px2, py2, C.dirtLite);
          }
        }
      } else if (t === T.PLAZA) {
        rect(x, y, TILE, TILE, C.stone);
        for (let j = 0; j < TILE; j++) {
          for (let i = 0; i < TILE; i++) {
            const d = hash2(tx * 31 + i, ty * 17 + j);
            if (d < 0.055) px(x + i, y + j, C.stoneLite);
            else if (d < 0.1) px(x + i, y + j, C.slate);
          }
        }
        rect(x, y, TILE, 1, C.slate);
        rect(x, y, 1, TILE, C.slate);
        rect(x, y + TILE - 1, TILE, 1, mix(C.stone, C.ink, 0.1));
      } else if (t === T.WATER) {
        rect(x, y, TILE, TILE, C.waterDeep);
        for (let j = 0; j < TILE; j++) {
          for (let i = 0; i < TILE; i++) {
            const d = hash2(tx * 13 + i, ty * 29 + j);
            if (d < 0.3) px(x + i, y + j, C.water);
          }
        }
      }
    }
  }

  // soft transitions: dither the land colour over the edge of paths and water
  for (let ty = 0; ty < world.rows; ty++) {
    for (let tx = 0; tx < world.cols; tx++) {
      const t = terrainAt(world, tx, ty);
      if (t === T.BACKDROP) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const up = terrainAt(world, tx, ty - 1);
      const down = terrainAt(world, tx, ty + 1);
      const left = terrainAt(world, tx - 1, ty);
      const right = terrainAt(world, tx + 1, ty);

      if ((t === T.ROAD || t === T.DIRT || t === T.PLAZA) && (up === T.GRASS || down === T.GRASS || left === T.GRASS || right === T.GRASS)) {
        const soft = t === T.PLAZA ? C.grass : mix(C.grass, C.dirtMid, 0.4);
        const edges = [
          [up, x, y, TILE, 2, 'h'],
          [down, x, y + TILE - 2, TILE, 2, 'h'],
          [left, x, y, 2, TILE, 'v'],
          [right, x + TILE - 2, y, 2, TILE, 'v'],
        ];
        for (const [neighbor, ex, ey, ew, eh] of edges) {
          if (neighbor !== T.GRASS) continue;
          for (let j = 0; j < eh; j++) {
            for (let i = 0; i < ew; i++) {
              const parity = (i + j) % 2 === 0;
              const streak = hash2(ex + i, ey + j) > 0.45;
              if (parity || streak) px(ex + i, ey + j, soft);
            }
          }
        }
      }

      if (t === T.WATER) {
        const edges = [
          [up, x, y - 3, TILE, 3],
          [down, x, y + TILE, TILE, 3],
          [left, x - 3, y, 3, TILE],
          [right, x + TILE, y, 3, TILE],
        ];
        for (const [neighbor, ex, ey, ew, eh] of edges) {
          if (neighbor === T.WATER || neighbor === T.BACKDROP) continue;
          for (let j = 0; j < eh; j++) {
            for (let i = 0; i < ew; i++) {
              if (hash2(ex + i, ey + j) > 0.35) {
                rect(ex + i, ey + j, 1, 1, hash2(ey + j, ex + i) > 0.6 ? C.sand : C.dirtLite);
              }
            }
          }
        }
        // dark waterline
        if (up !== T.WATER && up !== T.BACKDROP) rect(x, y, TILE, 1, mix(C.waterDeep, C.ink, 0.35));
        if (down !== T.WATER && down !== T.BACKDROP) rect(x, y + TILE - 1, TILE, 1, mix(C.waterDeep, C.ink, 0.35));
        if (left !== T.WATER && left !== T.BACKDROP) rect(x, y, 1, TILE, mix(C.waterDeep, C.ink, 0.35));
        if (right !== T.WATER && right !== T.BACKDROP) rect(x + TILE - 1, y, 1, TILE, mix(C.waterDeep, C.ink, 0.35));
      }
    }
  }

  // contact shadows so objects sit on the ground instead of floating
  for (const s of world.statics) {
    const w = Math.max(6, Math.round((s.sprite.w || 16) * 0.42));
    ctx.fillStyle = 'rgba(24,20,37,0.16)';
    ctx.fillRect(Math.round(s.x - w / 2), Math.round(s.y - 2), w, 3);
    ctx.fillStyle = 'rgba(24,20,37,0.1)';
    ctx.fillRect(Math.round(s.x - w / 2 + 2), Math.round(s.y + 1), w - 4, 1);
  }

  return cv;
}

export function computeCamera(world, view) {
  let x = world.W / 2 - view.w / 2;
  let y = 112 - view.h / 2;
  if (view.h < 172) y = Math.min(y, 8);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  x = clamp(x, 0, Math.max(0, world.W - view.w));
  y = clamp(y, 0, Math.max(0, world.H - view.h));
  return { x: Math.round(x), y: Math.round(y) };
}

function drawWaterAnim(ctx, world, cam, view, time) {
  for (const { tx, ty } of world.waterTiles) {
    const x = tx * TILE;
    const y = ty * TILE;
    if (x + TILE < cam.x || y + TILE < cam.y || x > cam.x + view.w || y > cam.y + view.h) continue;
    const seed = hash2(tx, ty);
    const phase = (time * 0.55 + seed * 3) % 2;
    if (phase < 1) {
      const yy = y + 4 + Math.floor(phase * 8);
      const len = 3 + Math.floor(seed * 5);
      const xx = x + 2 + Math.floor(hash2(tx + 3, ty) * (TILE - len - 4));
      ctx.fillStyle = rgba('#8fe8ff', 0.35);
      ctx.fillRect(xx, yy, len, 1);
      ctx.fillStyle = rgba('#c8f4ff', 0.25);
      ctx.fillRect(xx + 1, yy - 1, Math.max(1, len - 2), 1);
    }
  }
}

function drawSmoke(ctx, world, time, cam, view) {
  for (const stack of world.smokeStacks) {
    if (stack.x < cam.x - 30 || stack.x > cam.x + view.w + 30) continue;
    for (let i = 0; i < 4; i++) {
      const t = (time * 0.28 + i * 0.25) % 1;
      const size = 2 + Math.round(t * 4);
      const x = stack.x + Math.sin(t * 7 + i) * 3 + t * 7;
      const y = stack.y - t * 30;
      const puff = smokePuffSprite(size);
      ctx.globalAlpha = (1 - t) * 0.5;
      ctx.drawImage(puff.canvas, Math.round(x), Math.round(y));
      ctx.globalAlpha = 1;
    }
  }
}

function drawPanelContent(ctx, panel, time) {
  const inner = panel.inner;
  if (!inner) return;
  const x = panel.x - panel.sprite.w / 2 + inner.x;
  const y = panel.y - panel.sprite.h + inner.y;

  if (panel.kind === 'billboard') {
    const idx = Math.floor(time / 4.5 + panel.x * 0.017) % panel.msgs.length;
    const text = panel.msgs[idx];
    const local = (time / 4.5 + panel.x * 0.017) % 1;
    const fade = local > 0.9 ? (1 - local) / 0.1 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, fade);
    let scale = 1;
    let width = measureText(text, 1, 1);
    if (width > inner.w - 2) {
      width = measureText(text, 1, 0);
    }
    if (width > inner.w - 2) {
      scale = 1;
    }
    const spacing = width > inner.w - 2 ? 0 : 1;
    const tx = x + Math.round((inner.w - measureText(text, scale, spacing)) / 2);
    drawText(ctx, text, tx, y + 4, C.lamp);
    drawText(ctx, '.'.repeat(Math.min(inner.w, 20)), x + 2, y + inner.h - 9, rgba('#fee761', 0.5));
    ctx.restore();
    return;
  }

  // CRT kiosk: phosphor lines that rewrite themselves
  ctx.fillStyle = C.grassDeep;
  ctx.fillRect(x, y, inner.w, inner.h);
  const line = panel.msgs[Math.floor(time / 3 + panel.x) % panel.msgs.length];
  drawText(ctx, line.slice(0, 4), x + 1, y + 3, '#8dffb0');
  const bar = (Math.floor(time * 3) % 4) + 1;
  for (let i = 0; i < bar; i++) {
    ctx.fillStyle = i === bar - 1 ? '#8dffb0' : rgba('#8dffb0', 0.5);
    ctx.fillRect(x + 2 + i * 4, y + 12, 3, 2);
  }
  ctx.fillStyle = rgba('#0b1a12', 0.25);
  for (let j = 0; j < inner.h; j += 2) ctx.fillRect(x, y + j, inner.w, 1);
}

function drawEntity(ctx, e, time) {
  const spr = e.kind === 'villager' ? personSprite(e.pal, e.frame, e.view) : animalSprite(e.kind, e.frame, e.view);
  if (!spr) return;
  const bob = e.bob || 0;
  const shadowW = e.kind === 'chicken' ? 7 : e.kind === 'cat' ? 8 : e.kind === 'bird' ? 5 : 11;
  if (!(e.kind === 'bird' && e.bob)) {
    const sh = shadowSprite(shadowW, 3);
    ctx.globalAlpha = e.kind === 'duck' ? 0.18 : 1;
    ctx.drawImage(sh.canvas, Math.round(e.x - sh.w / 2), Math.round(e.y - 2));
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(Math.round(e.x), 0);
  if (e.dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(spr.canvas, -Math.floor(spr.w / 2), Math.round(e.y - spr.h + bob));
  ctx.restore();
}

export function createRenderer(world) {
  const backdrop = bakeBackdrop(world);
  const ground = bakeGround(world);
  const drawables = [];

  function draw(ctx, state) {
    const { view, cam, hour, time, entities, weather } = state;
    ctx.save();
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.translate(-cam.x, -cam.y);

    drawSky(ctx, hour, time, cam, view.w, view.h);
    ctx.drawImage(backdrop, 0, 0);
    if (cam.y > GROUND_Y) {
      // keep the void above the ground from showing on very tall viewports
      ctx.fillStyle = C.grassDeep;
      ctx.fillRect(cam.x, GROUND_Y, view.w, cam.y - GROUND_Y);
    }
    ctx.drawImage(ground, 0, 0, world.W, world.H, 0, 0, world.W, world.H);
    drawWaterAnim(ctx, world, cam, view, time);

    drawables.length = 0;
    for (const s of world.statics) {
      if (s.x + s.sprite.w < cam.x - 8 || s.x - s.sprite.w > cam.x + view.w + 8) continue;
      if (s.y - s.sprite.h > cam.y + view.h + 8 || s.y < cam.y - 8) continue;
      drawables.push(s);
    }
    for (const e of entities) {
      if (e.hidden) continue;
      if (e.x < cam.x - 16 || e.x > cam.x + view.w + 16 || e.y < cam.y - 24 || e.y > cam.y + view.h + 16) continue;
      drawables.push(e);
    }
    drawables.sort((a, b) => (a.y ?? a.sortY) - (b.y ?? b.sortY));

    for (const d of drawables) {
      if (d.kind === 'villager' || d.kind === 'cat' || d.kind === 'dog' || d.kind === 'chicken' || d.kind === 'duck' || d.kind === 'bird') {
        drawEntity(ctx, d, time);
      } else if (d.kind === 'panel') {
        ctx.drawImage(d.sprite.canvas, Math.round(d.x - d.sprite.w / 2), Math.round(d.y - d.sprite.h));
        drawPanelContent(ctx, { ...d, kind: d.panelKind, inner: d.sprite.inner }, time);
      } else {
        ctx.drawImage(d.sprite.canvas, Math.round(d.x - d.sprite.w / 2), Math.round(d.y - d.sprite.h));
      }
    }

    drawSmoke(ctx, world, time, cam, view);
    ctx.restore();

    weather.drawWash(ctx, view);
    weather.drawFog(ctx, view, time);
    const mod = weather.ambientMod();
    drawLightmap(ctx, world, cam, hour, view.w, view.h, mod);
    drawGlow(ctx, world, cam, hour, view.w, view.h);
    drawVignette(ctx, view.w, view.h);
    weather.drawFront(ctx, view, time, 1);
  }

  return { draw, backdrop, ground };
}
