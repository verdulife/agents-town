// Every sprite in the town is generated here from primitives: no image assets.
// Each generator returns { canvas, w, h } where the bottom edge of the canvas is
// the ground contact line and the horizontal centre is the sprite centre.

import { Painter, cacheSprite } from './pixel.js';
import { C, mix } from './palette.js';
import { makeRng } from './rng.js';
import { drawText, measureText } from './font.js';

const cache = new Map();

// ---------------------------------------------------------------- buildings

function blob(p, cx, cy, r, color, shadeColor) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r + 0.25) continue;
      const light = y < -r * 0.2 && x < r * 0.3;
      p.px(cx + x, cy + y, light ? shadeColor : color);
    }
  }
}

function drawWall(p, x, y, w, h, spec) {
  const { wall, wallLite, wallDark, style } = spec;
  p.rect(x, y, w, h, wall);
  if (style === 'brick') {
    for (let ry = 0; ry < h; ry += 6) {
      p.hline(x, y + ry, w, wallDark);
      const off = ((ry / 6) & 1) * 5;
      for (let i = off; i < w; i += 10) p.px(x + i, y + ry + 3, wallDark);
    }
    p.hline(x, y + 1, w, wallLite);
  } else if (style === 'plank') {
    for (let i = 6; i < w; i += 7) p.vline(x + i, y, h, wallDark);
    p.hline(x, y, w, wallLite);
    p.hline(x, y + 1, w, mix(wall, wallLite, 0.4));
  } else if (style === 'stone') {
    for (let ry = 0; ry < h; ry += 7) {
      p.hline(x, y + ry, w, wallDark);
      for (let i = ((ry / 7) & 1) ? 4 : 0; i < w; i += 11) p.px(x + i, y + ry + 3, wallDark);
    }
    p.hline(x, y, w, wallLite);
  } else {
    p.hline(x, y, w, wallLite);
    p.hline(x, y + 1, w, mix(wall, wallLite, 0.45));
  }

  // sparse grain so large walls are not flat, without turning into noise
  let grain = (w * 977 + h * 613) | 0;
  const rnd = () => {
    grain = (grain * 1103515245 + 12345) & 0x7fffffff;
    return grain / 0x7fffffff;
  };
  const speckles = Math.round(w * h * 0.012);
  for (let i = 0; i < speckles; i++) {
    p.px(x + 1 + Math.floor(rnd() * (w - 2)), y + 3 + Math.floor(rnd() * Math.max(1, h - 6)), mix(wall, wallDark, 0.16));
  }
  p.vline(x, y, h, wallLite);
  p.vline(x + w - 1, y, h, wallDark);
  p.rect(x, y + h - 3, w, 3, wallDark);
}

function drawGableRoof(p, W, top, roofH, spec, hip) {
  const cx = W / 2;
  const half = W / 2;
  for (let i = 0; i < roofH; i++) {
    const t = hip ? 0.55 + (0.45 * (i + 1)) / roofH : (i + 1) / roofH;
    const hw = Math.max(2, Math.round(half * t));
    const y = top + i;
    p.hline(cx - hw, y, hw * 2, spec.roof);
    if (i % 3 === 0) p.hline(cx - hw, y, hw * 2, spec.roofDark);
    if (i % 3 === 1) p.hline(cx - hw, y, hw * 2, spec.roofLite);
    p.px(cx - hw, y, spec.roofDark);
    p.px(cx + hw - 1, y, spec.roofDark);
  }
  p.hline(cx - 2, top, 4, spec.roofLite);
  p.hline(0, top + roofH - 1, W, spec.roofDark);
  p.hline(0, top + roofH, W, spec.roofDark);
}

function drawWindow(p, x, y, w, h, lit) {
  p.rect(x - 1, y - 1, w + 2, h + 2, C.ink);
  p.rect(x, y, w, h, lit ? C.lampWarm : C.glass);
  if (lit) {
    p.rect(x, y, w, 2, C.lamp);
    p.rect(x, y, 2, h, C.lamp);
  } else {
    p.rect(x, y, w - 2, 2, mix(C.glass, C.white, 0.45));
    p.rect(x, y, 2, h - 3, mix(C.glass, C.white, 0.25));
    p.rect(x + w - 3, y + 2, 2, 2, C.glassLite);
    p.rect(x + 1, y + h - 3, 3, 2, mix(C.glass, C.ink, 0.25));
  }
  p.vline(x + (w >> 1), y, h, C.ink);
  p.hline(x, y + (h >> 1), w, C.ink);
  p.rect(x - 2, y + h + 1, w + 4, 2, C.stone);
  p.hline(x - 2, y + h + 1, w + 4, C.stoneLite);
}

function drawDoor(p, x, y, w, h) {
  p.rect(x - 1, y - 1, w + 2, h + 1, C.ink);
  p.rect(x, y, w, h, C.wood);
  p.vline(x + 1, y + 1, h - 2, C.woodLite);
  p.vline(x + w - 2, y + 1, h - 2, C.woodDark);
  p.px(x + w - 3, y + (h >> 1), C.lamp);
  p.rect(x - 2, y + h - 1, w + 4, 3, C.stone);
  p.hline(x - 2, y + h - 1, w + 4, C.stoneLite);
}

function drawAwning(p, x, y, w, a, b) {
  for (let i = 0; i < w; i++) {
    const col = Math.floor(i / 4) % 2 === 0 ? a : b;
    p.vline(x + i, y, 5, col);
    p.vline(x + i, y + 5, 1, col);
  }
  for (let i = 0; i < w; i += 8) {
    p.px(x + i + 7, y + 6, a);
    p.px(x + i + 6, y + 6, a);
  }
  p.hline(x, y, w, C.white);
  p.hline(x, y + 4, w, C.ink);
}

function drawSign(p, x, y, w, text, bg, fg) {
  const h = 11;
  p.rect(x, y, w, h, C.ink);
  p.rect(x + 1, y + 1, w - 2, h - 2, bg);
  p.hline(x + 1, y + 1, w - 2, mix(bg, C.white, 0.35));
  // long labels fall back to the 3x5 font instead of spilling out of the board
  const font = measureText(text) <= w - 6 ? 'big' : 'tiny';
  const rows = font === 'big' ? 7 : 5;
  const textW = measureText(text, { font });
  drawText(p.ctx, text, x + Math.round((w - textW) / 2), y + Math.round((h - rows) / 2), fg, { font });
}

export function buildingSprite(spec) {
  const key = `bld|${JSON.stringify(spec)}`;
  return cacheSprite(cache, key, () => {
    const bodyW = spec.w;
    const W = bodyW + 10;
    const extra = spec.cupola ? 14 : 0;
    const roofH = Math.max(12, Math.round((spec.h - extra) * 0.4));
    const bodyH = spec.h - extra - roofH;
    const p = new Painter(W, spec.h);
    const bx = 5;
    const bodyTop = extra + roofH;

    drawWall(p, bx, bodyTop, bodyW, bodyH, spec);

    if (spec.roofStyle === 'flat') {
      p.rect(bx - 3, bodyTop - 6, bodyW + 6, 4, spec.roof);
      p.hline(bx - 3, bodyTop - 6, bodyW + 6, spec.roofLite);
      p.hline(bx - 3, bodyTop - 3, bodyW + 6, spec.roofDark);
      p.hline(bx - 3, bodyTop - 2, bodyW + 6, C.ink);
      for (let i = 0; i < bodyW + 6; i += 5) p.rect(bx - 3 + i, bodyTop - 8, 2, 2, spec.roofDark);
    } else {
      drawGableRoof(p, W, extra, roofH, spec, spec.roofStyle === 'hip');
    }

    if (spec.cupola) {
      const cx = W / 2;
      p.rect(cx - 7, extra + 2, 14, roofH + 4, spec.wall);
      p.rect(cx - 7, extra + 2, 14, 2, spec.wallLite);
      p.rect(cx - 8, extra, 16, 4, spec.roof);
      p.hline(cx - 8, extra, 16, spec.roofLite);
      p.rect(cx - 4, extra - 6, 8, 6, spec.roof);
      p.hline(cx - 3, extra - 6, 6, spec.roofLite);
      p.vline(cx, extra - 13, 9, C.slate);
      p.rect(cx + 1, extra - 13, 4, 2, C.lampWarm);
      p.rect(cx + 1, extra - 11, 2, 2, C.lampWarm);
      p.px(cx + 1, extra - 9, C.lampWarm);
      drawWindow(p, cx - 3, extra + 6, 6, 6, false);
    }

    if (spec.chimney) {
      const chx = bx + bodyW - 16;
      const cy = extra + 2;
      p.rect(chx, cy, 7, roofH - 2, spec.wallDark);
      p.rect(chx - 1, cy - 3, 9, 3, C.ink3);
      p.hline(chx - 1, cy - 3, 9, C.slate);
      p.dither(chx, cy, 7, roofH - 2, spec.wallDark, C.ink2, 1);
    }

    // door
    const doorW = 12;
    const doorH = Math.min(17, Math.round(bodyH * 0.55));
    const doorX = bx + Math.round((bodyW - doorW) / 2) + (spec.doorShift || 0);
    const doorY = spec.h - 2 - doorH;
    drawDoor(p, doorX, doorY, doorW, doorH);

    // windows
    const winW = spec.winW || 10;
    const winH = spec.winH || 9;
    const winY = bodyTop + Math.round(bodyH * 0.22);
    const slots = spec.windowSlots || [];
    for (const slot of slots) {
      drawWindow(p, bx + slot, winY, winW, winH, false);
      if (spec.flowers) {
        p.rect(bx + slot - 2, winY + winH + 3, winW + 4, 3, C.wood);
        p.dither(bx + slot - 2, winY + winH + 2, winW + 4, 2, C.pink, C.purple, 1);
      }
    }
    if (spec.upperWindows) {
      drawWindow(p, bx + Math.round(bodyW / 2) - 5, bodyTop + 4, 10, 8, false);
    }

    if (spec.awning) drawAwning(p, bx + 2, bodyTop + 6, bodyW - 4, spec.awning[0], spec.awning[1]);
    if (spec.sign) {
      const sw = Math.min(bodyW - 8, measureText(spec.sign[0]) + 8);
      drawSign(p, bx + Math.round((bodyW - sw) / 2), bodyTop + (spec.awning ? 14 : 5), sw, spec.sign[0], spec.sign[1], spec.sign[2]);
    }

    p.outline(C.ink);
    return p.sprite();
  });
}

// ------------------------------------------------------------------- nature

function disc(p, cx, cy, r, color) {
  const rr = r * r + r * 0.6;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > rr) continue;
      p.px(cx + x, cy + y, color);
    }
  }
}

export function treeSprite(seed = 1, kind = 'oak') {
  return cacheSprite(cache, `tree|${kind}|${seed}`, () => {
    const rng = makeRng(seed * 977 + 13);

    if (kind === 'pine') {
      const W = 28;
      const H = 50;
      const p = new Painter(W, H);
      const cx = Math.round(W / 2);
      p.rect(cx - 1, H - 12, 3, 12, C.woodDark);
      p.vline(cx - 1, H - 12, 12, C.wood);
      const tiers = [
        { y: 2, base: 6, h: 15 },
        { y: 13, base: 9, h: 15 },
        { y: 24, base: 12, h: 16 },
      ];
      for (const tier of tiers) {
        for (let i = 0; i < tier.h; i++) {
          const hw = Math.max(1, Math.round(tier.base * ((i + 1) / tier.h)));
          p.hline(cx - hw, tier.y + i, hw * 2, C.grassDeep);
          p.hline(cx - hw, tier.y + i, Math.max(1, Math.round(hw * 0.6)), C.grassDark);
          p.px(cx - hw, tier.y + i, C.grass);
        }
        // ragged needle edge
        for (let x = cx - tier.base; x <= cx + tier.base; x += 3) {
          if (rng.chance(0.55)) p.px(x, tier.y + tier.h - 1, C.grassDeep);
        }
      }
      p.outline(C.ink);
      return p.sprite();
    }

    const W = 32;
    const H = 46;
    const p = new Painter(W, H);
    const cx = Math.round(W / 2);
    p.rect(cx - 2, H - 14, 4, 14, C.wood);
    p.vline(cx - 2, H - 14, 14, C.woodLite);
    p.vline(cx + 1, H - 14, 14, C.woodDark);
    p.rect(cx - 4, H - 3, 8, 3, C.woodDark);

    const blobs = [
      [cx, 15, 10],
      [cx - 7, 19, 7],
      [cx + 7, 19, 7],
      [cx - 2, 11, 7],
    ];
    for (const [bx, by, r] of blobs) disc(p, bx, by, r + 1, C.grassDeep);
    for (const [bx, by, r] of blobs) disc(p, bx, by, r, C.grassDark);
    // light comes from the upper left
    disc(p, cx - 2, 12, 8, C.grass);
    disc(p, cx - 6, 14, 5, C.grass);
    disc(p, cx + 6, 17, 4, C.grass);
    disc(p, cx - 4, 9, 4, C.grassLite);
    disc(p, cx - 7, 12, 2, C.grassLite);
    for (let i = 0; i < 14; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const rad = rng.range(2, 9);
      const px2 = Math.round(cx - 3 + Math.cos(ang) * rad);
      const py2 = Math.round(13 + Math.sin(ang) * rad * 0.8);
      p.px(px2, py2, rng.chance(0.4) ? C.grassSun : C.grassLite);
    }
    // dappled shadow under the canopy
    for (let i = 0; i < 22; i++) {
      const px2 = Math.round(cx + rng.range(-11, 11));
      const py2 = Math.round(23 + rng.range(-1, 4));
      p.px(px2, py2, C.grassDeep);
    }
    p.outline(C.ink);
    return p.sprite();
  });
}

export function bushSprite(seed = 1) {
  return cacheSprite(cache, `bush|${seed}`, () => {
    const rng = makeRng(seed * 331 + 7);
    const p = new Painter(20, 16);
    blob(p, 10, 9, 7, C.grassDark, C.grass);
    blob(p, 7, 8, 4, C.grass, C.grassLite);
    for (let i = 0; i < 5; i++) p.px(rng.int(4, 16), rng.int(3, 13), rng.chance(0.4) ? C.pink : C.grassSun);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function flowersSprite(seed = 1) {
  return cacheSprite(cache, `flowers|${seed}`, () => {
    const rng = makeRng(seed * 97 + 3);
    const p = new Painter(18, 10);
    for (let i = 0; i < 10; i++) {
      const x = rng.int(1, 16);
      const y = rng.int(6, 9);
      const col = rng.pick([C.pink, C.lampWarm, C.purple, C.white, C.grassSun]);
      p.px(x, y, col);
      if (rng.chance(0.6)) p.px(x + 1, y, col);
      p.px(x, y + 1, C.grassDark);
    }
    return p.sprite();
  });
}

export function rockSprite(seed = 1) {
  return cacheSprite(cache, `rock|${seed}`, () => {
    const p = new Painter(12, 9);
    p.dither(1, 3, 10, 5, C.stone, C.slate, 1);
    p.rect(2, 2, 7, 6, C.stone);
    p.hline(3, 2, 5, C.stoneLite);
    p.outline(C.ink);
    return p.sprite();
  });
}

// -------------------------------------------------------------------- props

export function lampSprite() {
  return cacheSprite(cache, 'lamp', () => {
    const p = new Painter(13, 40);
    p.rect(6, 10, 1, 28, C.ink3);
    p.rect(5, 34, 3, 6, C.ink3);
    p.rect(3, 37, 7, 3, C.slate);
    p.rect(4, 38, 5, 2, C.ink3);
    p.rect(3, 4, 7, 7, C.ink2);
    p.rect(4, 5, 5, 5, C.lamp);
    p.rect(4, 5, 5, 2, C.white);
    p.rect(2, 2, 9, 3, C.ink3);
    p.px(6, 1, C.slate);
    p.rect(3, 11, 7, 1, C.ink3);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function benchSprite() {
  return cacheSprite(cache, 'bench', () => {
    const p = new Painter(20, 14);
    p.rect(1, 2, 18, 3, C.wood);
    p.hline(1, 2, 18, C.woodLite);
    p.rect(1, 6, 18, 3, C.wood);
    p.hline(1, 6, 18, C.woodLite);
    p.rect(2, 9, 2, 4, C.ink3);
    p.rect(16, 9, 2, 4, C.ink3);
    p.rect(1, 1, 1, 6, C.ink3);
    p.rect(18, 1, 1, 6, C.ink3);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function crateSprite(seed = 1) {
  return cacheSprite(cache, `crate|${seed}`, () => {
    const rng = makeRng(seed * 71 + 5);
    const p = new Painter(14, 15);
    p.rect(1, 3, 12, 11, C.wood);
    p.dither(1, 3, 12, 11, C.wood, C.woodLite, 3);
    p.hline(1, 3, 12, C.woodLite);
    p.vline(6, 3, 11, C.woodDark);
    p.hline(1, 8, 12, C.woodDark);
    p.rect(2, 1, 4, 2, rng.pick([C.pink, C.grassSun, C.lampWarm]));
    p.rect(8, 1, 3, 2, rng.pick([C.purple, C.grassSun, C.brickLite]));
    p.outline(C.ink);
    return p.sprite();
  });
}

export function barrelSprite() {
  return cacheSprite(cache, 'barrel', () => {
    const p = new Painter(12, 16);
    p.rect(2, 3, 8, 12, C.wood);
    p.rect(1, 6, 10, 6, C.wood);
    p.dither(1, 3, 10, 12, C.wood, C.woodDark, 1);
    p.rect(1, 6, 10, 1, C.slate);
    p.rect(1, 11, 10, 1, C.slate);
    p.rect(2, 2, 8, 2, C.woodLite);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function fenceSprite() {
  return cacheSprite(cache, 'fence', () => {
    const p = new Painter(32, 14);
    for (const x of [2, 14, 26]) {
      p.rect(x, 2, 3, 11, C.woodLite);
      p.vline(x, 2, 11, C.white);
      p.px(x + 2, 2, C.wood);
    }
    p.rect(0, 4, 32, 2, C.woodLite);
    p.rect(0, 9, 32, 2, C.woodLite);
    p.hline(0, 4, 32, C.wood);
    p.hline(0, 9, 32, C.wood);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function fountainSprite() {
  return cacheSprite(cache, 'fountain', () => {
    const p = new Painter(46, 40);
    // basin
    p.rect(2, 22, 42, 10, C.stone);
    p.dither(2, 22, 42, 10, C.stone, C.stoneLite, 2);
    p.rect(0, 20, 46, 4, C.stoneLite);
    p.hline(0, 20, 46, C.white);
    p.rect(4, 24, 38, 5, C.waterDeep);
    p.dither(4, 24, 38, 5, C.waterDeep, C.water, 1);
    p.rect(6, 34, 34, 4, C.slate);
    p.rect(2, 38, 42, 2, C.ink3);
    // column + tiers
    p.rect(20, 12, 6, 14, C.stone);
    p.vline(20, 12, 14, C.stoneLite);
    p.rect(16, 8, 14, 4, C.stoneLite);
    p.hline(16, 8, 14, C.white);
    p.rect(17, 4, 12, 4, C.water);
    p.dither(17, 4, 12, 4, C.water, C.waterLite, 1);
    p.rect(21, 0, 4, 5, C.stoneLite);
    p.px(23, 0, C.waterLite);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function stallSprite(seed = 1) {
  return cacheSprite(cache, `stall|${seed}`, () => {
    const rng = makeRng(seed * 313 + 11);
    const p = new Painter(36, 30);
    // table
    p.rect(2, 20, 32, 6, C.wood);
    p.hline(2, 20, 32, C.woodLite);
    p.rect(2, 26, 3, 4, C.woodDark);
    p.rect(31, 26, 3, 4, C.woodDark);
    // produce
    for (let i = 0; i < 9; i++) {
      const col = rng.pick([C.brickLite, C.lampWarm, C.grassSun, C.pink, C.purple]);
      p.rect(4 + i * 3, 17, 2, 3, col);
    }
    // awning on poles
    for (let i = 0; i < 34; i++) {
      const col = Math.floor(i / 5) % 2 === 0 ? C.roofRedLite : C.stoneLite;
      p.vline(1 + i, 4, 6, col);
      if (i % 10 === 9) p.vline(1 + i, 10, 1, col);
    }
    p.hline(1, 4, 34, C.white);
    p.rect(3, 10, 2, 12, C.woodDark);
    p.rect(31, 10, 2, 12, C.woodDark);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function cartSprite() {
  return cacheSprite(cache, 'cart', () => {
    const p = new Painter(30, 22);
    p.rect(2, 8, 22, 8, C.wood);
    p.dither(2, 8, 22, 8, C.wood, C.woodLite, 3);
    p.rect(2, 7, 22, 2, C.woodLite);
    p.rect(6, 4, 6, 4, C.woodDark);
    p.rect(14, 3, 7, 5, C.woodDark);
    p.rect(23, 12, 8, 2, C.woodLite);
    for (const x of [6, 18]) {
      for (let a = 0; a < 8; a++) {
        p.px(x + Math.round(4 * Math.cos((a / 8) * Math.PI * 2)), 18 + Math.round(4 * Math.sin((a / 8) * Math.PI * 2)), C.ink3);
        p.px(x + Math.round(3 * Math.cos((a / 8) * Math.PI * 2)), 18 + Math.round(3 * Math.sin((a / 8) * Math.PI * 2)), C.slate);
      }
    }
    p.outline(C.ink);
    return p.sprite();
  });
}

export function laundrySprite() {
  return cacheSprite(cache, 'laundry', () => {
    const p = new Painter(34, 22);
    p.vline(1, 2, 20, C.woodDark);
    p.vline(32, 2, 20, C.woodDark);
    for (let x = 1; x < 33; x++) p.px(x, 3 + Math.round(Math.sin((x / 32) * Math.PI) * 2), C.slate);
    const cloth = [
      [4, 5, C.stoneLite],
      [11, 6, C.pink],
      [18, 5, C.neon],
      [25, 6, C.lampWarm],
    ];
    for (const [x, y, col] of cloth) {
      p.rect(x, y, 5, 8, col);
      p.dither(x, y, 5, 8, col, mix(col, C.ink, 0.25), 3);
      p.px(x + 1, y, C.white);
    }
    p.outline(C.ink);
    return p.sprite();
  });
}

export function wellSprite() {
  return cacheSprite(cache, 'well', () => {
    const p = new Painter(26, 32);
    p.rect(2, 18, 22, 12, C.stone);
    p.dither(2, 18, 22, 12, C.stone, C.stoneLite, 2);
    p.rect(4, 16, 18, 5, C.waterDeep);
    p.rect(6, 17, 14, 3, C.water);
    p.hline(2, 18, 22, C.stoneLite);
    p.rect(1, 28, 24, 4, C.ink3);
    p.vline(4, 2, 16, C.wood);
    p.vline(21, 2, 16, C.wood);
    for (let y = 0; y < 5; y++) p.hline(2 + y, 2 + y, 22 - y * 2, y === 0 ? C.roofRedLite : C.roofRed);
    p.rect(11, 6, 4, 4, C.woodDark);
    p.vline(12, 10, 6, C.slate);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function planterSprite(seed = 1) {
  return cacheSprite(cache, `planter|${seed}`, () => {
    const rng = makeRng(seed * 43 + 9);
    const p = new Painter(20, 14);
    p.rect(1, 8, 18, 6, C.wood);
    p.hline(1, 8, 18, C.woodLite);
    p.dither(1, 9, 18, 5, C.wood, C.woodDark, 2);
    for (let i = 0; i < 8; i++) {
      p.rect(3 + i * 2, 3 + rng.int(0, 2), 2, 5, C.grassDark);
      p.px(3 + i * 2, 2 + rng.int(0, 2), rng.pick([C.pink, C.lampWarm, C.white]));
    }
    p.outline(C.ink);
    return p.sprite();
  });
}

export function signpostSprite(text) {
  return cacheSprite(cache, `signpost|${text}`, () => {
    const w = Math.max(18, measureText(text) + 8);
    const p = new Painter(w, 26);
    p.rect(w / 2 - 1, 10, 3, 16, C.woodDark);
    p.rect(1, 2, w - 2, 11, C.wood);
    p.hline(1, 2, w - 2, C.woodLite);
    drawText(p.ctx, text, 4, 5, C.ink2);
    p.outline(C.ink);
    return p.sprite();
  });
}

// Panels (billboard / CRT) keep their frame in the sprite and their content
// rect in metadata, so the renderer can draw changing text inside.
export function panelSprite(kind, opts = {}) {
  return cacheSprite(cache, `panel|${kind}|${JSON.stringify(opts)}`, () => {
    if (kind === 'billboard') {
      const w = opts.w || 56;
      const h = opts.h || 30;
      const p = new Painter(w + 8, h + 24);
      p.rect(6, 2, w, h, C.ink2);
      p.rect(8, 4, w - 4, h - 4, opts.bg || C.ink3);
      p.hline(8, 4, w - 4, C.slate);
      p.rect(10, h + 2, 4, 20, C.woodDark);
      p.rect(w, h + 2, 4, 20, C.woodDark);
      p.vline(10, h + 2, 20, C.wood);
      p.vline(w, h + 2, 20, C.wood);
      for (const lx of [10, 16, 52]) p.rect(lx, h + 16, 6, 3, C.ink3);
      p.outline(C.ink);
      const spr = p.sprite();
      spr.inner = { x: 10, y: 6, w: w - 8, h: h - 8 };
      return spr;
    }
    // crt kiosk
    const w = 32;
    const h = 38;
    const p = new Painter(w, h);
    p.rect(1, 1, w - 2, h - 2, C.ink2);
    p.rect(3, 3, w - 6, 22, C.ink);
    p.rect(4, 4, w - 8, 20, C.grassDeep);
    p.rect(2, 28, w - 4, 9, C.ink3);
    p.hline(2, 28, w - 4, C.slate);
    for (let i = 0; i < 3; i++) p.rect(6 + i * 7, 30, 3, 3, i === 1 ? C.lampWarm : C.slate);
    p.vline(0, 30, 4, C.ink3);
    p.vline(w - 1, 30, 4, C.ink3);
    p.outline(C.ink);
    const spr = p.sprite();
    spr.inner = { x: 5, y: 5, w: w - 10, h: 18 };
    return spr;
  });
}

// --------------------------------------------------------------- characters

export function personSprite(pal, frame, view) {
  const key = `person|${pal.id}|${frame}|${view}`;
  return cacheSprite(cache, key, () => {
    const p = new Painter(12, 19);
    const skin = pal.skin;
    const skinShade = mix(pal.skin, C.ink, 0.18);
    const hair = pal.hair;
    const shirt = pal.shirt;
    const shirtDark = mix(pal.shirt, C.ink, 0.28);
    const pants = pal.pants;
    const shoes = pal.shoes || C.ink2;
    const step = frame === 1 ? 1 : frame === 3 ? 2 : 0;
    const side = view === 'side';
    const back = view === 'back';

    // head
    p.rect(3, 1, 6, 1, hair);
    p.rect(2, 2, 8, 2, hair);
    p.rect(3, 4, 6, 3, skin);
    if (side) {
      p.rect(4, 4, 5, 3, skin);
      p.rect(4, 4, 4, 1, hair);
    }
    if (!back) {
      if (side) p.px(7, 5, C.ink);
      else {
        p.px(4, 5, C.ink);
        p.px(7, 5, C.ink);
      }
    } else {
      p.rect(3, 4, 6, 3, hair);
    }
    p.rect(3, 7, 6, 1, skinShade);
    // hat
    if (pal.hat) {
      p.rect(2, 0, 8, 2, pal.hat);
      p.rect(0, 2, 12, 1, mix(pal.hat, C.ink, 0.2));
    }
    if (pal.apron) {
      p.rect(3, 9, 6, 5, C.white);
    }

    // torso + arms
    p.rect(3, 8, 6, 6, shirt);
    p.rect(3, 8, 6, 1, shirtDark);
    p.rect(2, 9, 1, 4, shirtDark);
    p.rect(9, 9, 1, 4, shirtDark);
    p.px(2, 13, skin);
    p.px(9, 13, skin);
    if (pal.bag) p.rect(9, 10, 2, 3, C.wood);

    // legs and shoes
    const legY = 14;
    if (side) {
      const fx = step === 1 ? 6 : step === 2 ? 2 : 4;
      p.rect(4, legY, 4, 3, pants);
      p.rect(fx, legY + 3, 3, 2, pants);
      p.rect(fx, 19 - 1, 3, 1, shoes);
    } else {
      p.rect(3, legY, 2, 3, pants);
      p.rect(7, legY, 2, 3, pants);
      if (step === 1) {
        p.rect(3, legY + 3, 3, 1, pants);
        p.rect(7, legY + 3, 2, 1, pants);
        p.rect(3, 18, 3, 1, shoes);
      } else if (step === 2) {
        p.rect(3, legY + 3, 3, 1, pants);
        p.rect(7, legY + 3, 3, 1, pants);
        p.rect(8, 18, 3, 1, shoes);
      } else {
        p.rect(3, legY + 3, 2, 1, pants);
        p.rect(7, legY + 3, 2, 1, pants);
        p.rect(3, 18, 2, 1, shoes);
        p.rect(7, 18, 2, 1, shoes);
      }
    }
    p.outline(C.ink);
    return p.sprite();
  });
}

export function animalSprite(kind, frame, view) {
  return cacheSprite(cache, `animal|${kind}|${frame}|${view}`, () => {
    if (kind === 'cat') {
      const p = new Painter(11, 9);
      const fur = '#8b9bb4';
      const furDark = C.slate;
      p.rect(2, 3, 6, 3, fur);
      p.rect(1, 4, 1, 2, fur);
      p.rect(3, 6, 1, 2, furDark);
      p.rect(6, 6, 1, 2, furDark);
      p.rect(7, 2, 3, 3, fur);
      p.px(7, 1, fur);
      p.px(9, 1, fur);
      p.px(8, 3, C.ink);
      p.px(9, 3, C.ink);
      p.rect(9, 4, 1, 2, C.pink);
      const tailUp = frame % 2 === 0;
      p.rect(0, tailUp ? 1 : 2, 1, tailUp ? 4 : 3, furDark);
      p.outline(C.ink);
      return p.sprite();
    }
    if (kind === 'dog') {
      const p = new Painter(14, 10);
      const fur = '#b86f50';
      const furDark = C.dirtDeep;
      p.rect(2, 3, 8, 4, fur);
      p.rect(1, 4, 1, 2, furDark);
      p.rect(3, 7, 1, 2, furDark);
      p.rect(6, 7, 1, 2, furDark);
      p.rect(9, 7, 1, 2, furDark);
      p.rect(9, 1, 4, 4, fur);
      p.px(9, 1, furDark);
      p.px(12, 1, furDark);
      p.px(11, 2, C.ink);
      p.rect(13, 3, 1, 2, C.ink2);
      const tail = frame % 2 === 0 ? 1 : 2;
      p.rect(0, tail, 2, 2, furDark);
      p.outline(C.ink);
      return p.sprite();
    }
    if (kind === 'chicken') {
      const p = new Painter(9, 9);
      p.rect(2, 3, 5, 4, C.white);
      p.rect(3, 2, 3, 1, C.white);
      p.rect(4, 0, 2, 2, C.roofRedLite);
      p.px(6, 2, C.lampWarm);
      p.px(5, 3, C.ink);
      p.rect(3, 7, 1, 1, C.lampWarm);
      p.rect(5, 7, 1, 1, C.lampWarm);
      p.px(1, 4, C.stoneLite);
      p.outline(C.ink);
      return p.sprite();
    }
    if (kind === 'duck') {
      const p = new Painter(10, 7);
      p.rect(2, 2, 5, 3, C.stoneLite);
      p.rect(6, 0, 2, 3, C.stoneLite);
      p.px(7, 1, C.ink);
      p.rect(8, 1, 1, 1, C.lampWarm);
      p.px(1, 2, C.white);
      p.rect(3, 5, 4, 1, C.slate);
      p.outline(C.ink);
      return p.sprite();
    }
    // bird
    const p = new Painter(7, 5);
    p.rect(1, 1, 4, 2, C.ink2);
    p.rect(5, 2, 1, 1, C.lampWarm);
    if (frame % 2 === 0) p.rect(0, 0, 3, 1, C.slate);
    p.outline(C.ink);
    return p.sprite();
  });
}

export function shadowSprite(w = 12, h = 4) {
  return cacheSprite(cache, `shadow|${w}|${h}`, () => {
    const p = new Painter(w, h);
    const cx = w / 2;
    for (let y = 0; y < h; y++) {
      const t = (y - h / 2 + 0.5) / (h / 2);
      const half = Math.round((w / 2) * Math.sqrt(Math.max(0, 1 - t * t)));
      p.hline(cx - half, y, half * 2, 'rgba(24,20,37,0.28)');
    }
    return p.sprite();
  });
}

export function smokePuffSprite(size) {
  return cacheSprite(cache, `smoke|${size}`, () => {
    const p = new Painter(size, size);
    const r = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - r + 0.5, y - r + 0.5);
        if (d < r) p.px(x, y, 'rgba(200,203,220,0.55)');
      }
    }
    return p.sprite();
  });
}

// Eight villagers with distinct colour stories; ids double as sprite cache keys.
export const VILLAGER_PALS = [
  { id: 'v0', skin: C.skin1, hair: C.hairBrown, shirt: C.roofRedLite, pants: C.ink3, shoes: C.ink2 },
  { id: 'v1', skin: C.skin2, hair: C.hairInk, shirt: C.neon, pants: C.dirtDeep, shoes: C.ink2, hat: C.white },
  { id: 'v2', skin: C.skin3, hair: C.hairInk, shirt: C.lampWarm, pants: C.ink2, shoes: C.dirtDeep },
  { id: 'v3', skin: C.skin1, hair: C.hairGrey, shirt: C.purple, pants: C.ink3, shoes: C.ink2, apron: true },
  { id: 'v4', skin: C.skin2, hair: C.hairFair, shirt: C.grassLite, pants: C.dirt, shoes: C.ink2 },
  { id: 'v5', skin: C.skin1, hair: C.hairBrown, shirt: C.stoneLite, pants: C.slate, shoes: C.ink2, bag: true },
  { id: 'v6', skin: C.skin3, hair: C.hairGrey, shirt: C.pink, pants: C.ink3, shoes: C.ink2, hat: C.roofOrangeLite },
  { id: 'v7', skin: C.skin2, hair: C.hairInk, shirt: C.white, pants: C.ink2, shoes: C.dirtDeep, apron: true },
];
