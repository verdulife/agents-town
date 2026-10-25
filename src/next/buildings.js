// Parametric buildings. The reference sheet is a modular kit, not a set of
// finished houses: long facades made of 1-tile segments, a roof plane seen from
// above, and props scattered on that roof. Variety comes from composing those,
// so a new building type is a preset, not a drawing.

import { Painter, cacheSprite } from '../pixel.js';
import { C, mix } from '../palette.js';
import { drawText, lineWidth } from '../font.js';
import { makeRng } from '../rng.js';
import { TILE } from './art-spec.js';

const cache = new Map();

export const OVERHANG = 3;
export const GROUND_H = 26; // door 22 + 2 above + 2 below
export const STOREY_H = 22;

const WALLS = {
  plaster: { base: C.sand, lite: mix(C.sand, C.white, 0.35), dark: mix(C.sand, C.ink, 0.3), style: 'plaster' },
  clay: { base: C.brickLite, lite: mix(C.brickLite, C.white, 0.28), dark: mix(C.brickLite, C.ink, 0.32), style: 'brick' },
  brick: { base: C.brick, lite: C.brickLite, dark: mix(C.brick, C.ink, 0.35), style: 'brick' },
  stone: { base: C.stone, lite: C.stoneLite, dark: C.slate, style: 'stone' },
  concrete: { base: C.stoneLite, lite: C.white, dark: C.stone, style: 'panel' },
  timber: { base: C.woodLite, lite: mix(C.woodLite, C.white, 0.25), dark: C.wood, style: 'plank' },
  teal: { base: '#3f7d78', lite: '#5aa39c', dark: '#25514f', style: 'plaster' },
};

const ROOFS = {
  red: { base: C.roofRed, lite: C.roofRedLite, dark: C.roofRedDark },
  blue: { base: C.roofBlue, lite: C.roofBlueLite, dark: C.roofBlueDark },
  green: { base: C.roofGreen, lite: C.roofGreenLite, dark: C.roofGreenDark },
  orange: { base: C.roofOrange, lite: C.roofOrangeLite, dark: C.roofOrangeDark },
  purple: { base: C.roofPurple, lite: C.roofPurpleLite, dark: C.roofPurpleDark },
  slate: { base: C.roofSlate, lite: C.roofSlateLite, dark: C.roofSlateDark },
  graphite: { base: '#3b3f52', lite: '#575d76', dark: '#24273a' },
};

const ACCENTS = [C.neon, C.pink, C.lampWarm, C.purple, C.grassLite];

// ------------------------------------------------------------ wall texture

function paintWall(p, x, y, w, h, mat) {
  p.rect(x, y, w, h, mat.base);
  if (mat.style === 'brick') {
    for (let ry = 0; ry < h; ry += 6) {
      p.hline(x, y + ry, w, mat.dark);
      const off = ((ry / 6) & 1) * 5;
      for (let i = off; i < w; i += 10) p.px(x + i, y + ry + 3, mat.dark);
    }
    p.hline(x, y + 1, w, mat.lite);
  } else if (mat.style === 'plank') {
    for (let i = 6; i < w; i += 7) p.vline(x + i, y, h, mat.dark);
    p.hline(x, y, w, mat.lite);
  } else if (mat.style === 'stone') {
    for (let ry = 0; ry < h; ry += 7) {
      p.hline(x, y + ry, w, mat.dark);
      for (let i = ((ry / 7) & 1) ? 4 : 0; i < w; i += 11) p.px(x + i, y + ry + 3, mat.dark);
    }
    p.hline(x, y, w, mat.lite);
  } else if (mat.style === 'panel') {
    p.hline(x, y, w, mat.lite);
    p.hline(x, y + h - 1, w, mat.dark);
    for (let i = 0; i < w; i += 16) p.vline(x + i, y, h, mat.dark);
  } else {
    p.hline(x, y, w, mat.lite);
    p.hline(x, y + 1, w, mix(mat.base, mat.lite, 0.45));
  }
  p.vline(x, y, h, mix(mat.lite, mat.base, 0.4));
  p.vline(x + w - 1, y, h, mat.dark);
}

// -------------------------------------------------------------- segments

function segWall(p, x, y, w, h, mat) {
  paintWall(p, x, y, w, h, mat);
}

function segWindow(p, x, y, w, h, mat, opts = {}) {
  const ww = Math.min(w - 6, opts.wide ? 12 : 8);
  const wh = Math.min(h - 8, 9);
  const wx = x + Math.round((w - ww) / 2);
  const wy = y + Math.round((h - wh) / 2) - 2;
  p.rect(wx - 1, wy - 1, ww + 2, wh + 2, mat.dark);
  p.rect(wx, wy, ww, wh, C.glass);
  p.hline(wx, wy, ww, C.glassLite);
  p.rect(wx + 1, wy + 1, 2, wh - 3, mix(C.glass, C.white, 0.22));
  p.vline(wx + (ww >> 1), wy, wh, mat.dark);
  p.hline(wx, wy + (wh >> 1), ww, mat.dark);
  p.rect(wx - 2, wy + wh + 1, ww + 4, 2, C.stoneLite);
  p.hline(wx - 2, wy + wh + 1, ww + 4, C.white);
  if (opts.shutters) {
    p.rect(wx - 3, wy, 2, wh, mat.dark);
    p.rect(wx + ww + 1, wy, 2, wh, mat.dark);
  }
  if (opts.flowers) {
    p.rect(wx - 2, wy + wh + 3, ww + 4, 2, C.wood);
    for (let i = 0; i < ww + 4; i += 3) p.px(wx - 1 + i, wy + wh + 2, i % 2 ? C.pink : C.lampWarm);
  }
}

function segShopfront(p, x, y, w, h, mat) {
  const gx = x + 2;
  const gw = w - 4;
  const gy = y + 6;
  const gh = h - 10;
  p.rect(x, y, w, h, mat.dark);
  // the interior: shelves with goods and a counter, seen through the glass
  p.rect(gx, gy, gw, gh, mix(C.glass, C.ink, 0.55));
  for (let i = 0; i < gw - 4; i += 6) {
    const col = [C.lampWarm, C.pink, C.neon, C.grassLite, C.stoneLite][i % 5];
    p.rect(gx + 2 + i, gy + 3, 4, 4, col);
    p.px(gx + 2 + i, gy + 3, mix(col, C.white, 0.4));
  }
  p.hline(gx + 1, gy + 8, gw - 2, C.woodDark);
  p.rect(gx + 2, gy + gh - 4, gw - 4, 3, mix(C.wood, C.ink, 0.3));
  // glass and reflections on top of it
  p.dither(gx, gy, gw, 3, C.glass, C.glassLite, 3);
  p.rect(gx, gy, 2, gh, mix(C.glass, C.white, 0.3));
  p.dither(gx + gw - 3, gy + 2, 3, gh - 4, C.glass, C.glassLite, 1);
  for (let i = gx + 4; i < gx + gw - 2; i += 5) p.vline(i, gy, gh, mat.dark);
  p.hline(gx, gy, gw, mix(C.white, C.glassLite, 0.5));
  p.rect(gx - 1, gy + gh, gw + 2, 2, C.stoneLite);
  p.hline(x, y + 2, w, mat.lite);
}

function segSteps(p, x, y, w, h, mat, opts) {
  segDoor(p, x, y, w, h, mat, opts);
  const dw = Math.min(14, w - 6);
  const dx = x + Math.round((w - dw) / 2);
  p.rect(dx - 1, y + h - 4, dw + 2, 2, C.stoneLite);
  p.rect(dx - 2, y + h - 2, dw + 4, 2, C.stone);
  p.hline(dx - 2, y + h - 2, dw + 4, C.white);
}

function segGarage(p, x, y, w, h) {
  const dw = w - 6;
  const dh = h - 6;
  const dx = x + 3;
  const dy = y + 3;
  p.rect(dx - 1, dy - 1, dw + 2, dh + 2, C.ink3);
  p.rect(dx, dy, dw, dh, C.slate);
  for (let i = 0; i < dh; i += 3) {
    p.hline(dx, dy + i, dw, C.stone);
    p.hline(dx, dy + i + 1, dw, mix(C.slate, C.ink, 0.35));
  }
  p.vline(dx + (dw >> 1), dy, dh, mix(C.slate, C.white, 0.2));
  p.rect(dx, dy + dh, dw, 2, C.stoneLite);
}

function segArch(p, x, y, w, h) {
  const dw = Math.min(20, w - 8);
  const dh = h - 6;
  const dx = x + Math.round((w - dw) / 2);
  const dy = y + h - dh - 2;
  p.rect(dx - 2, dy - 3, dw + 4, dh + 3, C.ink3);
  p.rect(dx, dy, dw, dh, C.wood);
  for (let i = 0; i < dw; i++) {
    const t = (i - dw / 2) / (dw / 2);
    const lift = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * 5);
    p.vline(dx + i, dy - lift, lift, C.stoneLite);
  }
  p.vline(dx + 1, dy, dh, C.woodLite);
  p.vline(dx + dw - 2, dy, dh, C.woodDark);
  p.vline(dx + (dw >> 1), dy, dh, C.woodDark);
  p.rect(dx - 2, dy + dh, dw + 4, 2, C.stoneLite);
  p.hline(dx - 2, dy + dh, dw + 4, C.white);
}

function segDoor(p, x, y, w, h, mat, opts = {}) {
  const dw = opts.double ? Math.min(18, w - 6) : Math.min(10, w - 8);
  const dh = Math.min(22, h - 4);
  const dx = x + Math.round((w - dw) / 2);
  const dy = y + h - dh - 2;
  p.rect(dx - 1, dy - 2, dw + 2, dh + 2, mat.dark);
  p.rect(dx, dy, dw, dh, opts.color || C.wood);
  p.vline(dx + 1, dy, dh, C.woodLite);
  p.vline(dx + dw - 2, dy, dh, C.woodDark);
  if (opts.double) p.vline(dx + (dw >> 1), dy, dh, C.woodDark);
  p.px(dx + dw - 3, dy + (dh >> 1), C.lamp);
  p.rect(dx - 2, dy + dh, dw + 4, 2, C.stoneLite);
  p.hline(dx - 2, dy + dh, dw + 4, C.white);
}

function segAwning(p, x, y, w, h, color) {
  const a = color || C.roofRedLite;
  const b = mix(a, C.white, 0.65);
  const ay = y + 2;
  for (let i = 0; i < w; i++) {
    const col = Math.floor(i / 4) % 2 === 0 ? a : b;
    p.vline(x + i, ay, 5, col);
    if (i % 8 < 4) p.vline(x + i, ay + 5, 1, col);
  }
  p.hline(x, ay, w, mix(a, C.white, 0.4));
  p.hline(x, ay + 4, w, C.ink);
}

function segSign(p, x, y, w, h, text, color) {
  const sh = 11;
  const sy = y + 3;
  p.rect(x + 1, sy, w - 2, sh, C.ink2);
  p.rect(x + 2, sy + 1, w - 4, sh - 2, mix(color, C.ink, 0.55));
  p.hline(x + 2, sy + 1, w - 4, mix(color, C.white, 0.3));
  if (text) {
    const big = lineWidth(text) <= w - 8;
    const tw = lineWidth(text, { font: big ? 'big' : 'tiny' });
    drawText(p.ctx, text, x + Math.round((w - tw) / 2), sy + (big ? 3 : 4), mix(color, C.white, 0.55), {
      font: big ? 'big' : 'tiny',
    });
  }
}

function segBalcony(p, x, y, w, h, mat) {
  segWindow(p, x, y, w, h, mat);
  const by = y + h - 10;
  p.rect(x + 1, by, w - 2, 2, C.stoneLite);
  for (let i = x + 2; i < x + w - 2; i += 3) p.vline(i, by - 4, 4, C.stoneLite);
  p.hline(x + 1, by - 5, w - 2, C.white);
  p.rect(x + 1, by + 2, w - 2, 2, mat.dark);
}

// ------------------------------------------------------------- roof plane

function paintGableRoof(p, W, roofD, roof) {
  // A gable roof is long: the ridge runs the length of the building and only the
  // two gable ends taper. Converging to the centre would read as a tent.
  const ridgeY = Math.round(roofD * 0.26);
  const endInset = Math.min(10, Math.round(W * 0.1));
  for (let y = 0; y < roofD; y++) {
    // the back slope keeps the ridge width (a straight band); only the front
    // slope widens to the eave. Tapering both made the top corners flare.
    const inset =
      y < ridgeY
        ? endInset
        : Math.round(endInset * (1 - (y - ridgeY) / Math.max(1, roofD - 1 - ridgeY)));
    const rowW = W - inset * 2;
    const front = y >= ridgeY;
    p.hline(inset, y, rowW, front ? roof.base : roof.dark);
    if (y % 4 === 0) p.hline(inset, y, rowW, front ? mix(roof.base, C.ink, 0.09) : mix(roof.dark, C.ink, 0.16));
    if (y % 4 === 2) p.hline(inset, y, rowW, front ? mix(roof.base, roof.lite, 0.55) : mix(roof.dark, roof.base, 0.3));
  }
  p.hline(endInset, ridgeY, W - endInset * 2, mix(roof.base, C.white, 0.28));
  p.rect(0, roofD - 3, W, 3, roof.dark);
  p.hline(0, roofD - 4, W, roof.lite);
}

function paintFlatRoof(p, W, roofD, roof) {
  p.rect(0, 0, W, roofD, mix(roof.base, C.stone, 0.3));
  for (let y = 3; y < roofD - 3; y += 5) p.hline(2, y, W - 4, mix(roof.base, C.ink, 0.1));
  p.rect(0, 0, W, 3, roof.lite);
  p.rect(0, 0, 3, roofD, mix(roof.base, C.white, 0.28));
  p.rect(W - 3, 0, 3, roofD, roof.dark);
  p.rect(0, roofD - 3, W, 3, roof.dark);
  p.hline(0, roofD - 4, W, roof.lite);
}

function paintShedRoof(p, W, roofD, roof) {
  // single slope: full width all the way, the tone does the sloping
  for (let y = 0; y < roofD; y++) {
    const t = y / Math.max(1, roofD - 1);
    const tone = mix(roof.lite, roof.dark, t * 0.75);
    p.hline(0, y, W, y % 4 === 0 ? mix(tone, C.ink, 0.14) : tone);
  }
  p.hline(0, 1, W, mix(roof.lite, C.white, 0.35));
  p.rect(0, roofD - 3, W, 3, roof.dark);
}

function paintHipRoof(p, W, roofD, roof) {
  // hip: a short ridge, with the four sides sloping toward the eaves
  const ridgeW = Math.max(Math.round(W * 0.34), W - roofD * 2);
  for (let y = 0; y < roofD; y++) {
    const d = y / Math.max(1, roofD - 1);
    const rowW = Math.round(ridgeW + (W - ridgeW) * d);
    const x0 = Math.round((W - rowW) / 2);
    p.hline(x0, y, rowW, y % 4 === 0 ? mix(roof.base, C.ink, 0.14) : roof.base);
    if (y % 4 === 2) p.hline(x0, y, rowW, roof.lite);
  }
  p.hline(Math.round((W - ridgeW) / 2), 1, ridgeW, mix(roof.lite, C.white, 0.4));
  p.rect(0, roofD - 3, W, 3, roof.dark);
}

// ------------------------------------------------------------ roof props

function roofProp(p, kind, x, y, rng, roof) {
  if (kind === 'chimney') {
    p.rect(x, y - 12, 9, 14, C.brick);
    p.dither(x, y - 12, 9, 14, C.brick, C.brickLite, 3);
    p.rect(x - 1, y - 14, 11, 3, C.ink3);
    p.hline(x - 1, y - 14, 11, C.slate);
    p.rect(x + 2, y - 13, 5, 2, C.ink);
  } else if (kind === 'ac') {
    p.rect(x, y - 10, 14, 11, C.stoneLite);
    p.rect(x + 1, y - 9, 12, 9, C.stone);
    for (let i = 0; i < 6; i++) p.hline(x + 2, y - 8 + i, 10, C.slate);
  } else if (kind === 'vent') {
    p.rect(x, y - 7, 5, 8, C.slate);
    p.rect(x - 1, y - 8, 7, 2, C.stoneLite);
  } else if (kind === 'skylight') {
    p.rect(x, y - 6, 12, 8, C.ink3);
    p.rect(x + 1, y - 5, 10, 6, C.glass);
    p.hline(x + 1, y - 5, 10, C.glassLite);
  } else if (kind === 'tank') {
    p.rect(x, y - 12, 12, 12, mix(C.wood, C.stone, 0.5));
    p.hline(x, y - 8, 12, C.woodDark);
    p.hline(x, y - 4, 12, C.woodDark);
    p.rect(x + 2, y - 13, 8, 2, C.ink3);
  } else if (kind === 'solar') {
    p.rect(x, y - 8, 18, 9, C.ink3);
    p.rect(x + 1, y - 7, 16, 7, '#124e89');
    for (let i = 3; i < 17; i += 4) p.vline(x + i, y - 7, 7, C.neon);
    p.hline(x + 1, y - 4, 16, C.neon);
  } else if (kind === 'antenna') {
    p.vline(x, y - 16, 17, C.slate);
    p.hline(x - 3, y - 14, 7, C.slate);
    p.hline(x - 2, y - 10, 5, C.slate);
    p.px(x, y - 17, C.lampWarm);
  } else if (kind === 'hatch') {
    p.rect(x, y - 9, 13, 10, roof.dark);
    p.rect(x + 1, y - 8, 11, 8, roof.base);
    p.hline(x + 1, y - 8, 11, roof.lite);
    p.rect(x + 4, y - 5, 5, 1, C.ink3);
  }
}

// Pure geometry, so the layout can be tested without a canvas.
export function buildingGeometry(spec) {
  const tilesW = spec.tilesW ?? 4;
  const storeys = spec.storeys ?? 1;
  const roofD = spec.roofDepth ?? 34;
  const facadeH = GROUND_H + (storeys - 1) * STOREY_H;
  return {
    W: tilesW * TILE + OVERHANG * 2,
    H: roofD + facadeH,
    facadeH,
    roofD,
    facadeW: tilesW * TILE,
  };
}

// ------------------------------------------------------------- assembly

export function buildingSprite(spec) {
  const key = `bld2|${JSON.stringify(spec)}`;
  return cacheSprite(cache, key, () => {
    const tilesW = spec.tilesW ?? 4;
    const storeys = spec.storeys ?? 1;
    const roofD = spec.roofDepth ?? 34;
    const wall = WALLS[spec.wall] || WALLS.plaster;
    const roof = ROOFS[spec.roof] || ROOFS.red;
    const rng = makeRng((spec.seed ?? 1) * 7919 + tilesW * 31 + storeys);
    const W = tilesW * TILE + OVERHANG * 2;
    const facadeH = GROUND_H + (storeys - 1) * STOREY_H;
    const H = roofD + facadeH;
    const p = new Painter(W, H);

    // roof plane
    const kind = spec.roofStyle || 'gable';
    if (kind === 'flat') paintFlatRoof(p, W, roofD, roof);
    else if (kind === 'shed') paintShedRoof(p, W, roofD, roof);
    else if (kind === 'hip') paintHipRoof(p, W, roofD, roof);
    else paintGableRoof(p, W, roofD, roof);

    // roof props, placed inside the plane
    const props = spec.roofProps || [];
    for (let i = 0; i < props.length; i++) {
      const px = 6 + Math.round((i + 0.5) * ((W - 24) / Math.max(1, props.length)));
      roofProp(p, props[i], px, roofD - 4, rng, roof);
    }

    // facade: one row of segments per storey, bottom up
    const fx = OVERHANG;
    const fw = W - OVERHANG * 2;
    const floors = [];
    floors.push({ y: H - GROUND_H, h: GROUND_H, segs: spec.ground || [{ kind: 'wall', tiles: tilesW }] });
    for (let s = 1; s < storeys; s++) {
      const y = H - GROUND_H - s * STOREY_H;
      floors.push({ y, h: STOREY_H, segs: spec.upper || [{ kind: 'window', tiles: tilesW }] });
    }

    for (const floor of floors) {
      paintWall(p, fx, floor.y, fw, floor.h, wall);
      // storey separator
      if (floor.y > roofD) p.hline(fx, floor.y, fw, wall.dark);
      let x = fx;
      for (const seg of floor.segs) {
        const sw = Math.round(seg.tiles * TILE);
        const w = Math.min(sw, fx + fw - x);
        if (w <= 0) break;
        switch (seg.kind) {
          case 'window':
            segWindow(p, x, floor.y, w, floor.h, wall, seg);
            break;
          case 'shopfront':
            segShopfront(p, x, floor.y, w, floor.h, wall);
            break;
          case 'door':
            segDoor(p, x, floor.y, w, floor.h, wall, seg);
            break;
          case 'balcony':
            segBalcony(p, x, floor.y, w, floor.h, wall);
            break;
          case 'sign':
            segSign(p, x, floor.y, w, floor.h, seg.text, seg.color || ACCENTS[0]);
            break;
          case 'awning':
            segAwning(p, x, floor.y, w, floor.h, seg.color);
            break;
          case 'steps':
            segSteps(p, x, floor.y, w, floor.h, wall, seg);
            break;
          case 'garage':
            segGarage(p, x, floor.y, w, floor.h);
            break;
          case 'arch':
            segArch(p, x, floor.y, w, floor.h);
            break;
          default:
            segWall(p, x, floor.y, w, floor.h, wall);
        }
        x += sw;
      }
    }

    // plinth and cornice: two bands that make a flat wall read as a building
    p.rect(fx, H - 3, fw, 3, mix(wall.base, C.ink, 0.35));
    p.hline(fx, H - 4, fw, wall.lite);
    p.rect(fx, roofD + 1, fw, 3, mix(wall.base, C.ink, 0.22));
    p.hline(fx, roofD + 1, fw, mix(wall.base, C.white, 0.25));
    for (let s2 = 1; s2 < storeys; s2++) {
      const yy = H - GROUND_H - s2 * STOREY_H;
      p.rect(fx, yy, fw, 2, mix(wall.base, C.ink, 0.2));
      p.hline(fx, yy, fw, mix(wall.base, C.white, 0.2));
    }

    // downspouts from the eave to the ground
    for (const px of [fx + 2, fx + fw - 4]) {
      p.rect(px, roofD + 4, 2, H - roofD - 8, C.slate);
      p.vline(px, roofD + 4, H - roofD - 8, mix(C.slate, C.white, 0.2));
      for (let yy = roofD + 8; yy < H - 8; yy += 14) p.rect(px - 1, yy, 4, 1, C.ink3);
    }

    // wall-mounted details from the seed: a pipe, an AC box or a hanging sign
    for (const detail of spec.details || []) {
      if (detail === 'ac') {
        const ax = fx + fw - 18;
        p.rect(ax, roofD + 8, 12, 8, C.stoneLite);
        p.rect(ax + 1, roofD + 9, 10, 6, C.stone);
        for (let i = 0; i < 4; i++) p.hline(ax + 2, roofD + 10 + i, 8, C.slate);
      } else if (detail === 'hangingSign') {
        // bracket, two hangers, then a bordered board: a sign, not a floating box
        const sx = fx + 4;
        const sy = H - GROUND_H - 20;
        p.rect(sx, sy, 12, 2, C.ink3);
        p.rect(sx + 1, sy - 1, 2, 1, C.slate);
        p.rect(sx + 4, sy + 2, 1, 3, C.ink3);
        p.rect(sx + 9, sy + 2, 1, 3, C.ink3);
        p.rect(sx + 1, sy + 5, 12, 11, C.ink);
        p.rect(sx + 2, sy + 6, 10, 9, C.lampWarm);
        p.hline(sx + 2, sy + 6, 10, mix(C.lampWarm, C.white, 0.5));
        p.rect(sx + 4, sy + 9, 6, 1, C.ink2);
        p.rect(sx + 4, sy + 12, 4, 1, C.ink2);
      } else if (detail === 'vent') {
        const vx = fx + Math.round(fw / 2) - 4;
        p.rect(vx, roofD + 7, 8, 6, C.slate);
        for (let i = 0; i < 3; i++) p.hline(vx + 1, roofD + 8 + i * 2, 6, C.ink3);
      }
    }

    // awnings and signs sit over the ground floor, so they draw last
    if (spec.sign) segSign(p, fx + 2, H - GROUND_H - 2, fw - 4, GROUND_H, spec.sign, spec.signColor || ACCENTS[1]);
    if (spec.canopy) segAwning(p, fx + 3, H - GROUND_H + 12, fw - 6, GROUND_H, spec.canopy);

    p.outline(C.ink);
    return p.sprite();
  });
}

// ------------------------------------------------------------- catalogue

// Facade presets per type. Widths are in tiles and must sum to `tilesW`.
export const BUILDING_TYPES = {
  house: {
    label: 'HOUSE',
    storeys: 2,
    roofStyle: 'gable',
    roofDepth: 24,
    walls: ['plaster', 'clay', 'stone'],
    roofs: ['red', 'blue', 'slate', 'purple'],
    widths: [4, 5],
    ground: (tw) => [{ kind: 'wall', tiles: 1 }, { kind: 'steps', tiles: 1 }, { kind: 'window', tiles: 1 }, { kind: 'wall', tiles: Math.max(0.5, tw - 3) }],
    upper: (tw) => repeat([{ kind: 'window', tiles: 1 }, { kind: 'window', tiles: 1 }, { kind: 'wall', tiles: 1 }], tw),
    roofProps: ['chimney', 'vent'],
  },
  townhouse: {
    label: 'TOWNHOUSE',
    storeys: 3,
    roofStyle: 'flat',
    roofDepth: 28,
    walls: ['clay', 'concrete', 'teal'],
    roofs: ['graphite', 'slate'],
    widths: [3],
    ground: () => [{ kind: 'door', tiles: 1 }, { kind: 'shopfront', tiles: 2 }],
    upper: () => [{ kind: 'balcony', tiles: 1 }, { kind: 'window', tiles: 1 }, { kind: 'window', tiles: 1 }],
    roofProps: ['ac', 'tank'],
  },
  shop: {
    label: 'SHOP',
    storeys: 1,
    roofStyle: 'flat',
    roofDepth: 22,
    walls: ['concrete', 'plaster', 'teal'],
    roofs: ['graphite', 'slate', 'red'],
    widths: [4, 5],
    ground: (tw) => [{ kind: 'shopfront', tiles: Math.max(2, tw - 1) }, { kind: 'door', tiles: 1 }],
    canopy: true,
    sign: true,
    roofProps: ['ac', 'skylight', 'vent'],
  },
  apartment: {
    label: 'APARTMENT',
    storeys: 3,
    roofStyle: 'flat',
    roofDepth: 26,
    walls: ['concrete', 'stone', 'clay'],
    roofs: ['graphite', 'slate'],
    widths: [5, 6],
    ground: (tw) => [{ kind: 'door', tiles: 1 }, { kind: 'wall', tiles: tw - 2 }, { kind: 'shopfront', tiles: 1 }],
    upper: (tw) => repeat([{ kind: 'balcony', tiles: 1 }, { kind: 'window', tiles: 1 }, { kind: 'window', tiles: 1 }], tw),
    roofProps: ['ac', 'solar', 'antenna', 'tank'],
  },
  warehouse: {
    label: 'WAREHOUSE',
    storeys: 1,
    roofStyle: 'shed',
    roofDepth: 34,
    walls: ['concrete', 'stone'],
    roofs: ['slate', 'graphite', 'green'],
    widths: [6, 7],
    ground: (tw) => [{ kind: 'wall', tiles: 1 }, { kind: 'door', tiles: 2, double: true }, { kind: 'wall', tiles: tw - 3 }],
    roofProps: ['vent', 'skylight', 'skylight'],
  },
  garage: {
    label: 'GARAGE',
    storeys: 1,
    roofStyle: 'shed',
    roofDepth: 26,
    walls: ['concrete', 'stone'],
    roofs: ['slate', 'graphite'],
    widths: [3, 4],
    ground: (tw) => [{ kind: 'wall', tiles: 0.5 }, { kind: 'garage', tiles: 2 }, { kind: 'wall', tiles: Math.max(0.5, tw - 2.5) }],
    roofProps: ['vent'],
  },
  hotel: {
    label: 'HOTEL',
    storeys: 3,
    roofStyle: 'flat',
    roofDepth: 30,
    walls: ['clay', 'stone', 'plaster'],
    roofs: ['slate', 'graphite', 'red'],
    widths: [3, 4],
    ground: (tw) => [{ kind: 'door', tiles: 1 }, { kind: 'shopfront', tiles: 2 }, { kind: 'wall', tiles: Math.max(0.5, tw - 3) }],
    upper: (tw) => repeat([{ kind: 'window', tiles: 1 }, { kind: 'balcony', tiles: 1 }, { kind: 'window', tiles: 1 }], tw),
    sign: true,
    roofProps: ['tank', 'ac'],
  },
  civic: {
    label: 'CIVIC',
    storeys: 2,
    roofStyle: 'hip',
    roofDepth: 32,
    walls: ['stone', 'concrete'],
    roofs: ['green', 'blue', 'slate'],
    widths: [7, 8],
    ground: (tw) => [{ kind: 'wall', tiles: 1 }, { kind: 'arch', tiles: 2 }, { kind: 'window', tiles: 1 }, { kind: 'window', tiles: 1 }, { kind: 'wall', tiles: tw - 5 }],
    upper: (tw) => repeat([{ kind: 'window', tiles: 1 }, { kind: 'window', tiles: 1 }, { kind: 'wall', tiles: 1 }], tw),
    roofProps: ['hatch', 'chimney'],
  },
};

// Types the calibration street shows in context. Kept here, next to the
// catalogue, so a renamed or removed type fails in the test rather than in the
// browser.
export const STREET_TYPES = ['house', 'shop', 'apartment'];

const SIGNS = ['CAFE', 'PAN', 'BOOKS', 'HOTEL', 'BAR', 'MARKET', 'FLORES', 'TECH', 'RAMEN', 'CINE'];

// Cycle a segment pattern until the floor is full, so wide buildings are not
// half blank wall.
function repeat(pattern, tilesW) {
  const out = [];
  let total = 0;
  let i = 0;
  while (total < tilesW) {
    const seg = pattern[i % pattern.length];
    const t = Math.min(seg.tiles, tilesW - total);
    out.push({ ...seg, tiles: t });
    total += t;
    i++;
  }
  return out;
}

// One deterministic variant per (type, seed): same seed, same building.
export function variantFor(typeName, seed = 1) {
  const type = BUILDING_TYPES[typeName];
  if (!type) throw new Error(`unknown building type: ${typeName}`);
  const rng = makeRng(seed * 104729 + typeName.length * 7919);
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  const tilesW = pick(type.widths);
  const spec = {
    type: typeName,
    seed,
    tilesW,
    storeys: type.storeys,
    roofStyle: type.roofStyle,
    roofDepth: type.roofDepth,
    wall: pick(type.walls),
    roof: pick(type.roofs),
    ground: type.ground ? type.ground(tilesW) : [{ kind: 'wall', tiles: tilesW }],
    upper: type.upper ? type.upper(tilesW) : [{ kind: 'window', tiles: tilesW }],
    roofProps: type.roofProps || [],
    canopy: type.canopy ? pick([C.roofRedLite, C.neon, C.pink, C.lampWarm]) : null,
    sign: type.sign ? pick(SIGNS) : null,
    signColor: pick(ACCENTS),
  };
  // one or two wall-mounted details, so a plain facade still has something to read
  const detailPool = ['ac', 'hangingSign', 'vent'];
  spec.details = detailPool.filter(() => rng() < 0.45).slice(0, 2);
  // trim segments that would overflow the facade
  const trim = (segs) => {
    let total = 0;
    const out = [];
    for (const seg of segs) {
      const t = Math.max(0, Math.min(seg.tiles, tilesW - total));
      if (t <= 0) continue;
      out.push({ ...seg, tiles: t });
      total += t;
    }
    if (total < tilesW) out.push({ kind: 'wall', tiles: tilesW - total });
    return out;
  };
  spec.ground = trim(spec.ground);
  spec.upper = trim(spec.upper);
  return spec;
}

export function gallerySpecs(seed = 1, perType = 3) {
  const out = [];
  for (const [name, type] of Object.entries(BUILDING_TYPES)) {
    for (let i = 0; i < perType; i++) out.push(variantFor(name, seed + i * 13 + name.length));
  }
  return out;
}
