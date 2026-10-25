// Top-down vocabulary driven by art-spec.js. Nothing here is final art: the
// point is that every size comes from the contract, so changing a proportion is
// a number, not a redraw.

import { Painter, cacheSprite } from '../pixel.js';
import { C, mix } from '../palette.js';
import { drawText, lineWidth } from '../font.js';
import { makeRng } from '../rng.js';
import { SPEC, TILE, houseGeometry } from './art-spec.js';

const cache = new Map();

function disc(p, cx, cy, r, color) {
  const rr = r * r + r * 0.6;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > rr) continue;
      p.px(cx + x, cy + y, color);
    }
  }
}

// --------------------------------------------------------------- houses

export function houseSprite(spec = {}) {
  const key = `td-house|${JSON.stringify(spec)}`;
  return cacheSprite(cache, key, () => {
    const { W, H, over, facadeH, roofH } = houseGeometry(spec);
    const p = new Painter(W, H);
    const wall = spec.wall || C.sand;
    const wallLite = mix(wall, C.white, 0.3);
    const wallDark = mix(wall, C.ink, 0.35);
    const roof = spec.roof || C.roofRed;
    const roofLite = mix(roof, C.white, 0.24);
    const roofDark = mix(roof, C.ink, 0.38);
    const ridgeY = Math.round(roofH * SPEC.house.roofRidge);
    const ridgeW = Math.round(W * SPEC.house.ridgeWidth);

    if (spec.modern) {
      p.rect(0, 0, W, roofH, mix(roof, C.stone, 0.3));
      for (let y = 2; y < roofH; y += 5) p.hline(0, y, W, mix(roof, C.ink, 0.1));
      p.rect(0, 0, W, 3, roofLite);
      p.rect(0, 0, 3, roofH, mix(roof, C.white, 0.3));
      p.rect(W - 3, 0, 3, roofH, roofDark);
      p.rect(0, roofH - 3, W, 3, roofDark);
      const px0 = 6;
      const py0 = 7;
      p.rect(px0, py0, 18, 10, C.ink3);
      p.rect(px0 + 1, py0 + 1, 16, 8, '#124e89');
      for (let i = 3; i < 17; i += 4) p.vline(px0 + i, py0 + 1, 8, '#2ce8f5');
      p.hline(px0 + 1, py0 + 4, 16, '#2ce8f5');
      const ax = W - 24;
      p.rect(ax, roofH - 18, 16, 11, C.stoneLite);
      p.rect(ax + 1, roofH - 17, 14, 9, C.stone);
      for (let i = 0; i < 7; i++) p.hline(ax + 2, roofH - 16 + i, 12, C.slate);
      p.rect(5, roofH - 14, 5, 7, C.slate);
      p.rect(4, roofH - 15, 7, 2, C.stoneLite);
    } else {
      // thin back-slope band, ridge, then a trapezoid widening to the eave
      for (let y = 0; y < roofH; y++) {
        const front = y >= ridgeY;
        const t = front ? (y - ridgeY) / Math.max(1, roofH - 1 - ridgeY) : 0;
        const rowW = Math.round(ridgeW + (W - ridgeW) * t);
        const x0 = Math.round((W - rowW) / 2);
        p.hline(x0, y, rowW, front ? roof : roofDark);
        if (y % 4 === 0) p.hline(x0, y, rowW, front ? mix(roof, C.ink, 0.14) : mix(roofDark, C.ink, 0.25));
        if (y % 4 === 2) p.hline(x0, y, rowW, front ? roofLite : mix(roofDark, roof, 0.4));
      }
      p.hline(Math.round((W - ridgeW) / 2), ridgeY, ridgeW, mix(roofLite, C.white, 0.45));
      p.hline(Math.round((W - ridgeW) / 2), ridgeY + 1, ridgeW, roofLite);
      p.rect(0, roofH - 3, W, 3, roofDark);
      p.hline(0, roofH - 4, W, roofLite);
      // chimney on the back band
      const cx0 = W - 20;
      p.rect(cx0, 2, 9, ridgeY + 6, mix(wall, C.stone, 0.35));
      p.rect(cx0 - 1, 1, 11, 3, C.ink3);
      p.rect(cx0 + 2, 2, 5, 1, C.ink);
      // dormer with its own little roof
      if (W >= 66) {
        const dx = Math.round(W / 2) - 5;
        p.rect(dx - 1, ridgeY + 5, 13, 3, roofDark);
        p.rect(dx, ridgeY + 7, 11, 8, mix(wall, C.white, 0.12));
        p.rect(dx + 2, ridgeY + 9, 7, 5, C.glass);
        p.hline(dx + 2, ridgeY + 9, 7, C.glassLite);
        p.rect(dx + 5, ridgeY + 9, 1, 5, C.ink);
      }
    }

    // facade under the overhang
    const fx = over;
    const fw = W - over * 2;
    p.rect(fx, roofH, fw, facadeH, wall);
    p.hline(fx, roofH, fw, mix(wall, C.ink, 0.3));
    p.vline(fx, roofH, facadeH, wallDark);
    p.vline(fx + fw - 1, roofH, facadeH, wallDark);
    p.rect(fx, H - 2, fw, 2, wallDark);
    p.hline(fx, H - 3, fw, wallLite);

    // door: from the contract, taller than an NPC
    const { w: doorW, h: doorH } = SPEC.door;
    const doorX = fx + Math.round((fw - doorW) / 2);
    const doorY = H - 2 - doorH;
    p.rect(doorX - 1, doorY - 1, doorW + 2, doorH + 1, C.ink);
    p.rect(doorX, doorY, doorW, doorH, C.wood);
    p.vline(doorX + 1, doorY, doorH, C.woodLite);
    p.vline(doorX + doorW - 2, doorY, doorH, C.woodDark);
    p.px(doorX + doorW - 3, doorY + Math.floor(doorH / 2), C.lamp);
    p.rect(doorX - 2, H - 2, doorW + 4, 2, C.stoneLite);

    // windows from the contract
    const { w: winW, h: winH } = SPEC.window;
    const count = spec.windows ?? 2;
    const winY = roofH + 4;
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (fw - winW - 12) / (count - 1) : 0;
      const wx = fx + 6 + Math.round(i * spread);
      if (Math.abs(wx + winW / 2 - (doorX + doorW / 2)) < doorW / 2 + winW / 2) continue;
      p.rect(wx, winY, winW, winH, C.ink);
      p.rect(wx + 1, winY + 1, winW - 2, winH - 2, C.glass);
      p.hline(wx + 1, winY + 1, winW - 2, C.glassLite);
      p.vline(wx + (winW >> 1), winY + 1, winH - 2, C.ink);
      p.hline(wx - 1, winY + winH, winW + 2, C.stoneLite);
    }

    p.outline(C.ink);
    return p.sprite();
  });
}

// ------------------------------------------------------------------ nature

export function treeTopDown(seed = 1, kind = 'oak') {
  return cacheSprite(cache, `td-tree|${kind}|${seed}`, () => {
    const rng = makeRng(seed * 977 + 11);
    const base = kind === 'bush' ? SPEC.bush.size : SPEC.tree.size;
    const pad = kind === 'bush' ? SPEC.bush.pad : SPEC.tree.pad;
    const size = base + pad * 2;
    const p = new Painter(size, size);
    const cx = size / 2;
    const cy = size / 2;
    const r = base / 2 - 1;
    const clumps = [];
    const n = kind === 'bush' ? 5 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.35, 0.35);
      const d = i === 0 ? 0 : rng.range(r * 0.4, r * 0.72);
      clumps.push([
        Math.round(cx + Math.cos(a) * d),
        Math.round(cy + Math.sin(a) * d),
        Math.round(rng.range(r * 0.42, r * 0.6)),
      ]);
    }
    for (const [bx, by, br] of clumps) disc(p, bx, by, br + 1, C.grassDeep);
    for (const [bx, by, br] of clumps) disc(p, bx, by, br, C.grassDark);
    for (const [bx, by, br] of clumps) disc(p, bx - 1, by - 1, Math.max(2, br - 2), C.grass);
    disc(p, Math.round(cx - r * 0.28), Math.round(cy - r * 0.3), Math.max(2, Math.round(r * 0.38)), C.grassLite);
    for (let i = 0; i < 12; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(r * 0.3, r * 0.85);
      p.px(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), rng.chance(0.45) ? C.grassSun : C.grassDark);
    }
    p.outline(C.ink);
    return p.sprite();
  });
}

// ------------------------------------------------------------------ people
// 12x20 from the contract: head 7 wide, shoulders 10, legs 3+3 with a gap.

export function personTopDown(pal, dir = 'down', frame = 0) {
  return cacheSprite(cache, `td-person|${pal.id}|${dir}|${frame}`, () => {
    const { w, h } = SPEC.npc;
    const p = new Painter(w, h);
    const skin = pal.skin;
    const hair = pal.hair;
    const shirt = pal.shirt;
    const shirtDark = mix(pal.shirt, C.ink, 0.32);
    const pants = pal.pants;
    const step = frame % 2 === 0 ? 0 : 1;
    const cx = w / 2;

    if (dir === 'down' || dir === 'up') {
      p.rect(4, 1, 4, 1, hair);
      p.rect(3, 2, 6, 2, hair);
      p.rect(3, 4, 1, 2, hair);
      p.rect(8, 4, 1, 2, hair);
      if (dir === 'down') {
        p.rect(4, 4, 4, 2, skin);
        p.px(5, 5, C.ink);
        p.px(7, 5, C.ink);
      } else {
        p.rect(4, 4, 4, 3, hair);
        p.rect(4, 6, 4, 1, mix(hair, C.ink, 0.3));
      }
      p.rect(5, 6, 2, 1, mix(skin, C.ink, 0.2));
      // torso
      p.rect(2, 7, 8, 6, shirt);
      p.rect(2, 7, 8, 1, shirtDark);
      p.rect(1, 8, 1, 4, shirtDark);
      p.rect(10, 8, 1, 4, shirtDark);
      p.px(1, 12, skin);
      p.px(10, 12, skin);
      // legs and shoes
      p.rect(3, 13, 3, 4 + step, pants);
      p.rect(6, 13, 3, 5 - step, pants);
      p.rect(3, 17 + step, 3, 2, C.ink2);
      p.rect(6, 18 - step, 3, 2, C.ink2);
    } else {
      const flip = dir === 'left';
      p.rect(4, 1, 4, 1, hair);
      p.rect(3, 2, 6, 3, hair);
      p.rect(4, 5, 4, 2, skin);
      p.px(flip ? 4 : 7, 5, C.ink);
      p.rect(3, 7, 6, 6, shirt);
      p.rect(3, 7, 6, 1, shirtDark);
      p.rect(flip ? 1 : 9, 8, 2, 4, shirtDark);
      p.px(flip ? 1 : 10, 12, skin);
      p.rect(4, 13, 2, 5 - step, pants);
      p.rect(6, 13, 2, 4 + step, pants);
      p.rect(4, 18 - step, 2, 2, C.ink2);
      p.rect(6, 17 + step, 2, 2, C.ink2);
    }
    p.outline(C.ink);
    const spr = p.sprite();
    if (dir === 'left') {
      const m = new Painter(spr.w, spr.h);
      m.ctx.save();
      m.ctx.translate(spr.w, 0);
      m.ctx.scale(-1, 1);
      m.ctx.drawImage(spr.canvas, 0, 0);
      m.ctx.restore();
      return m.sprite();
    }
    return spr;
  });
}

// ------------------------------------------------------------------ props

export function kioskSprite(label = '15C') {
  return cacheSprite(cache, `td-kiosk|${label}`, () => {
    const W = SPEC.prop.max;
    const H = 30;
    const p = new Painter(W, H);
    p.rect(1, 0, W - 2, H - 2, C.ink2);
    p.rect(2, 1, W - 4, 3, C.ink3);
    p.rect(2, 5, W - 4, 12, C.ink);
    p.rect(3, 6, W - 6, 10, '#0d2b1a');
    p.hline(3, 6, W - 6, '#2ce8f5');
    const w = lineWidth(label, { font: 'tiny' });
    drawText(p.ctx, label, Math.round((W - w) / 2), 8, '#8dffb0', { font: 'tiny' });
    p.rect(2, 19, W - 4, 6, C.slate);
    for (let i = 0; i < 3; i++) p.hline(4, 20 + i * 2, W - 8, C.ink3);
    p.rect(3, H - 3, W - 6, 2, C.ink3);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function propTopDown(kind, seed = 1) {
  return cacheSprite(cache, `td-prop|${kind}|${seed}`, () => {
    const rng = makeRng(seed * 71 + 3);
    if (kind === 'barrel') {
      const p = new Painter(10, 12);
      p.rect(1, 2, 8, 9, C.wood);
      p.hline(1, 2, 8, C.woodLite);
      p.hline(1, 5, 8, C.slate);
      p.hline(1, 8, 8, C.slate);
      p.rect(2, 0, 6, 3, C.woodLite);
      p.outline(C.ink);
      return p.sprite();
    }
    if (kind === 'crate') {
      const p = new Painter(12, 12);
      p.rect(1, 2, 10, 9, C.wood);
      p.hline(1, 2, 10, C.woodLite);
      p.vline(6, 2, 9, C.woodDark);
      p.hline(1, 6, 10, C.woodDark);
      p.rect(2, 0, 4, 2, rng.pick([C.pink, C.grassSun]));
      p.outline(C.ink);
      return p.sprite();
    }
    if (kind === 'bench') {
      const p = new Painter(16, 10);
      p.rect(1, 3, 14, 3, C.wood);
      p.hline(1, 3, 14, C.woodLite);
      p.rect(1, 6, 14, 2, C.woodDark);
      p.rect(2, 8, 2, 2, C.ink3);
      p.rect(12, 8, 2, 2, C.ink3);
      p.outline(C.ink);
      return p.sprite();
    }
    if (kind === 'lamp') {
      const p = new Painter(9, 26);
      p.rect(4, 4, 1, 20, C.ink3);
      p.rect(2, 22, 5, 3, C.slate);
      p.rect(2, 1, 5, 4, C.ink2);
      p.rect(3, 2, 3, 2, C.lamp);
      p.outline(C.ink);
      return p.sprite();
    }
    if (kind === 'planter') {
      const p = new Painter(14, 12);
      p.rect(1, 6, 12, 5, C.wood);
      p.hline(1, 6, 12, C.woodLite);
      for (let i = 0; i < 5; i++) {
        p.rect(2 + i * 2, 2 + rng.int(0, 2), 2, 5, C.grassDark);
        p.px(2 + i * 2, 1 + rng.int(0, 2), rng.pick([C.pink, C.lampWarm, C.white]));
      }
      p.outline(C.ink);
      return p.sprite();
    }
    if (kind === 'vending') {
      const p = new Painter(SPEC.prop.max, 24);
      p.rect(1, 1, SPEC.prop.max - 2, 22, C.ink2);
      p.rect(2, 2, SPEC.prop.max - 4, 13, '#124e89');
      for (let i = 0; i < 3; i++) p.rect(3, 4 + i * 4, SPEC.prop.max - 6, 3, C.neon);
      p.rect(2, 16, SPEC.prop.max - 4, 5, C.ink3);
      p.rect(4, 18, 4, 2, C.lamp);
      p.outline(C.ink);
      return p.sprite();
    }
    const p = new Painter(14, 10);
    p.rect(1, 2, 12, 7, C.stoneLite);
    p.rect(2, 3, 10, 5, C.stone);
    for (let i = 0; i < 4; i++) p.hline(3, 4 + i, 8, C.slate);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function cableSprite(length, sag = 6) {
  return cacheSprite(cache, `td-cable|${length}|${sag}`, () => {
    const p = new Painter(length, sag + 2);
    for (let x = 0; x < length; x++) {
      const t = x / Math.max(1, length - 1);
      p.px(x, Math.round(Math.sin(t * Math.PI) * sag), C.ink3);
    }
    return p.sprite();
  });
}

export function shadowBlob(w, h) {
  return cacheSprite(cache, `td-shadow|${w}|${h}`, () => {
    const p = new Painter(w, h);
    for (let y = 0; y < h; y++) {
      const t = (y - h / 2 + 0.5) / (h / 2);
      const half = Math.round((w / 2) * Math.sqrt(Math.max(0, 1 - t * t)));
      p.hline(w / 2 - half, y, half * 2, 'rgba(24,20,37,0.22)');
    }
    return p.sprite();
  });
}

export const TD_PALS = [
  { id: 'a', skin: C.skin1, hair: C.hairBrown, shirt: C.roofRedLite, pants: C.ink3 },
  { id: 'b', skin: C.skin2, hair: C.hairInk, shirt: C.neon, pants: C.dirtDeep },
  { id: 'c', skin: C.skin3, hair: C.hairGrey, shirt: C.lampWarm, pants: C.ink2 },
  { id: 'd', skin: C.skin1, hair: C.hairFair, shirt: C.purple, pants: C.ink3 },
];
