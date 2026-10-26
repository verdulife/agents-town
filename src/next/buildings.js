// Parametric buildings. The reference sheet is a modular kit, not a set of
// finished houses: long facades made of 1-tile segments, a roof plane seen from
// above, and props scattered on that roof. Variety comes from composing those,
// so a new building type is a preset, not a drawing.

import { Painter, cacheSprite } from '../pixel.js';
import { C, mix } from '../palette.js';
import { drawText, lineWidth, FONTS } from '../font.js';
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

// Sign colours. Warm yellow is deliberately absent: it read as a hazard sticker
// on the facade, not as a shop sign.
const ACCENTS = [C.neon, C.pink, C.purple, C.grassLite];

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

// A fascia sign is a plate that hugs its own text, not a band across the whole
// building: three pixels of padding, an ink frame, and never wider than the
// facade it hangs on.
const SIGN_PAD_X = 3;
const SIGN_PAD_Y = 2;

// Pure layout for a sign plate, so the "adapts to the text" rule is testable
// without a canvas.
export function signPlate(text, maxWidth) {
  const tw = lineWidth(text, { font: 'tiny' });
  return {
    tw,
    th: FONTS.tiny.rows,
    w: Math.min(maxWidth, tw + SIGN_PAD_X * 2),
    h: FONTS.tiny.rows + SIGN_PAD_Y * 2,
  };
}

function segSign(p, x, y, w, h, text, color) {
  if (!text) return;
  const plate = signPlate(text, w);
  const bx = x + Math.round((w - plate.w) / 2);
  const by = y + 3;
  p.rect(bx, by, plate.w, plate.h, C.ink2);
  p.rect(bx + 1, by + 1, plate.w - 2, plate.h - 2, mix(color, C.ink, 0.55));
  p.hline(bx + 1, by + 1, plate.w - 2, mix(color, C.white, 0.3));
  drawText(
    p.ctx,
    text,
    bx + Math.round((plate.w - plate.tw) / 2),
    by + Math.round((plate.h - plate.th) / 2),
    mix(color, C.white, 0.6),
    { font: 'tiny' },
  );
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

// Roof depth and box metrics of a wing. Always shallower than the shallowest
// host, so the composite never grows taller than the building it hangs on.
const ANNEX_ROOF_D = { garage: 14, warehouse: 17 };

export function annexMetrics(annex) {
  const roofD = ANNEX_ROOF_D[annex.type] ?? (annex.roofStyle === 'flat' ? 14 : 17);
  return {
    W: annex.tiles * TILE + OVERHANG * 2,
    roofD,
    facadeH: GROUND_H,
    H: roofD + GROUND_H,
  };
}

// Pure geometry, so the layout can be tested without a canvas.
export function buildingGeometry(spec) {
  const tilesW = spec.tilesW ?? 4;
  const storeys = spec.storeys ?? 1;
  const roofD = spec.roofDepth ?? 34;
  const facadeH = GROUND_H + (storeys - 1) * STOREY_H;
  const annex = spec.annex ? annexMetrics(spec.annex) : null;
  return {
    // a wing widens the sprite; the host still owns the height
    W: tilesW * TILE + OVERHANG * 2 + (annex ? annex.W : 0),
    H: roofD + facadeH,
    facadeH,
    roofD,
    facadeW: tilesW * TILE,
    annexW: annex ? annex.W : 0,
    annexH: annex ? annex.H : 0,
  };
}

// ------------------------------------------------------------- assembly

// One box of building: its own roof plane, its props and its facade stack,
// painted at (ox, oy). A host and its wing are two boxes on a shared ground
// line, so the composite needs no seam drawn by hand.
function paintBlock(p, ox, oy, cfg) {
  const { tilesW, storeys, roofD, wall, roof } = cfg;
  const W = tilesW * TILE + OVERHANG * 2;
  const H = roofD + GROUND_H + (storeys - 1) * STOREY_H;
  const X = (d) => ox + d;
  const Y = (d) => oy + d;

  // roof plane; drawn off to the side so the shared painters keep their 0,0 origin
  const roofP = new Painter(W, roofD);
  const kind = cfg.roofStyle || 'gable';
  if (kind === 'flat') paintFlatRoof(roofP, W, roofD, roof);
  else if (kind === 'shed') paintShedRoof(roofP, W, roofD, roof);
  else paintGableRoof(roofP, W, roofD, roof);
  p.blit(roofP, ox, oy);

  // facade: one row of segments per storey, bottom up. The wall box can be
  // flushed to a box edge on the side where a wing meets its host, so the two
  // walls touch instead of leaving a transparent slot between the overhangs.
  const flush = cfg.flush || null;
  const wx = X(flush === 'left' ? 0 : OVERHANG);
  const ww = W - (flush === 'left' ? 0 : OVERHANG) - (flush === 'right' ? 0 : OVERHANG);
  const fx = X(OVERHANG);
  const fw = W - OVERHANG * 2;
  const floors = [];
  floors.push({ ly: H - GROUND_H, h: GROUND_H, segs: cfg.ground || [{ kind: 'wall', tiles: tilesW }] });
  for (let s = 1; s < storeys; s++) {
    floors.push({ ly: H - GROUND_H - s * STOREY_H, h: STOREY_H, segs: cfg.upper || [{ kind: 'window', tiles: tilesW }] });
  }

  for (const floor of floors) {
    const fy = oy + floor.ly;
    paintWall(p, wx, fy, ww, floor.h, wall);
    // storey separator
    if (floor.ly > roofD) p.hline(wx, fy, ww, wall.dark);
    let x = fx;
    for (const seg of floor.segs) {
      const sw = Math.round(seg.tiles * TILE);
      const w = Math.min(sw, fx + fw - x);
      if (w <= 0) break;
      switch (seg.kind) {
        case 'window':
          segWindow(p, x, fy, w, floor.h, wall, seg);
          break;
        case 'shopfront':
          segShopfront(p, x, fy, w, floor.h, wall);
          break;
        case 'door':
          segDoor(p, x, fy, w, floor.h, wall, seg);
          break;
        case 'balcony':
          segBalcony(p, x, fy, w, floor.h, wall);
          break;
        case 'sign':
          segSign(p, x, fy, w, floor.h, seg.text, seg.color || ACCENTS[0]);
          break;
        case 'awning':
          segAwning(p, x, fy, w, floor.h, seg.color);
          break;
        case 'steps':
          segSteps(p, x, fy, w, floor.h, wall, seg);
          break;
        case 'garage':
          segGarage(p, x, fy, w, floor.h);
          break;
        case 'arch':
          segArch(p, x, fy, w, floor.h);
          break;
        default:
          segWall(p, x, fy, w, floor.h, wall);
      }
      x += sw;
    }
  }

  // plinth and cornice: two bands that make a flat wall read as a building
  p.rect(wx, Y(H - 3), ww, 3, mix(wall.base, C.ink, 0.35));
  p.hline(wx, Y(H - 4), ww, wall.lite);
  p.rect(wx, Y(roofD) + 1, ww, 3, mix(wall.base, C.ink, 0.22));
  p.hline(wx, Y(roofD) + 1, ww, mix(wall.base, C.white, 0.25));
  for (let s2 = 1; s2 < storeys; s2++) {
    const yy = Y(H - GROUND_H - s2 * STOREY_H);
    p.rect(wx, yy, ww, 2, mix(wall.base, C.ink, 0.2));
    p.hline(wx, yy, ww, mix(wall.base, C.white, 0.2));
  }

  // downspouts from the eave to the ground
  if (cfg.spouts !== false) {
    for (const sx of [fx + 2, fx + fw - 4]) {
      p.rect(sx, Y(roofD) + 4, 2, H - roofD - 8, C.slate);
      p.vline(sx, Y(roofD) + 4, H - roofD - 8, mix(C.slate, C.white, 0.2));
      for (let yy = Y(roofD) + 8; yy < Y(H) - 8; yy += 14) p.rect(sx - 1, yy, 4, 1, C.ink3);
    }
  }

  // wall-mounted details from the seed: a pipe or an AC box
  for (const detail of cfg.details || []) {
    if (detail === 'ac') {
      const ax = fx + fw - 18;
      p.rect(ax, Y(roofD) + 8, 12, 8, C.stoneLite);
      p.rect(ax + 1, Y(roofD) + 9, 10, 6, C.stone);
      for (let i = 0; i < 4; i++) p.hline(ax + 2, Y(roofD) + 10 + i, 8, C.slate);
    } else if (detail === 'vent') {
      const vx = fx + Math.round(fw / 2) - 4;
      p.rect(vx, Y(roofD) + 7, 8, 6, C.slate);
      for (let i = 0; i < 3; i++) p.hline(vx + 1, Y(roofD) + 8 + i * 2, 6, C.ink3);
    }
  }

  // awnings and signs sit over the ground floor, so they draw last
  if (cfg.sign) segSign(p, fx + 2, Y(H - GROUND_H) - 2, fw - 4, GROUND_H, cfg.sign, cfg.signColor || ACCENTS[1]);
  if (cfg.canopy) segAwning(p, fx + 3, Y(H - GROUND_H) + 12, fw - 6, GROUND_H, cfg.canopy);
}

// Ground-floor segments of a wing: a door that suits its type, wall for the rest.
function annexGround(annex) {
  const tw = annex.tiles;
  if (annex.type === 'garage') {
    // one 2-tile garage door, then wall
    return tw >= 2.5
      ? [{ kind: 'wall', tiles: 0.5 }, { kind: 'garage', tiles: 2 }, { kind: 'wall', tiles: tw - 2.5 }]
      : [{ kind: 'garage', tiles: tw }];
  }
  // warehouse: a 2-tile double door, then wall
  return tw >= 2.5
    ? [{ kind: 'wall', tiles: 0.5 }, { kind: 'door', tiles: 2, double: true }, { kind: 'wall', tiles: tw - 2.5 }]
    : [{ kind: 'door', tiles: 2, double: true }];
}

export function buildingSprite(spec) {
  const key = `bld2|${JSON.stringify(spec)}`;
  return cacheSprite(cache, key, () => {
    const geo = buildingGeometry(spec);
    const annex = spec.annex || null;
    const am = annex ? annexMetrics(annex) : null;
    const p = new Painter(geo.W, geo.H);

    if (annex) {
      // the wing shares the ground line, so it starts above it by its own height
      const ax = annex.side === 'left' ? 0 : geo.W - am.W;
      paintBlock(p, ax, geo.H - am.H, {
        tilesW: annex.tiles,
        storeys: 1,
        roofD: am.roofD,
        roofStyle: annex.roofStyle,
        wall: WALLS[annex.wall] || WALLS.concrete,
        roof: ROOFS[annex.roof] || ROOFS.slate,
        ground: annexGround(annex),
        // flush on the side that meets the host, overhang on the open side
        flush: annex.side === 'left' ? 'right' : 'left',
        spouts: false,
      });
    }

    paintBlock(p, annex && annex.side === 'left' ? am.W : 0, 0, {
      tilesW: spec.tilesW ?? 4,
      storeys: spec.storeys ?? 1,
      roofD: spec.roofDepth ?? 34,
      roofStyle: spec.roofStyle,
      wall: WALLS[spec.wall] || WALLS.plaster,
      roof: ROOFS[spec.roof] || ROOFS.red,
      ground: spec.ground,
      upper: spec.upper,
      details: spec.details,
      sign: spec.sign,
      signColor: spec.signColor,
      canopy: spec.canopy,
      flush: annex ? annex.side : null,
    });

    // one outline for the whole composite: it also traces the notch above the wing
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
    // never a building on its own: only a wing on a host (annexFor)
    attached: true,
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
    attached: true,
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
  },
};

// Types the calibration street shows in context. Kept here, next to the
// catalogue, so a renamed or removed type fails in the test rather than in the
// browser.
export const STREET_TYPES = ['house', 'shop', 'apartment'];

// Shop fascia names. The sign face is caps-only, so glyphOf folds these up; they
// stay in natural case so a future face with lowercase needs no change here.
const SIGNS = ['Cafe', 'Pan', 'Books', 'Hotel', 'Bar', 'Market', 'Flores', 'Tech', 'Ramen', 'Cine'];

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
  if (type.attached) {
    throw new Error(
      `${typeName} is attached-only: it has no standalone sprite. ` +
        `Build it as a wing with annexFor(hostType, '${typeName}', seed) on one of ${ANCHOR_HOSTS.join(', ')}.`,
    );
  }
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
    canopy: type.canopy ? pick([C.roofRedLite, C.neon, C.pink, C.lampWarm]) : null,
    sign: type.sign ? pick(SIGNS) : null,
    signColor: pick(ACCENTS),
  };
  // one or two wall-mounted details, so a plain facade still has something to read
  const detailPool = ['ac', 'vent'];
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

// Hosts that can carry a wing. A shop is allowed, but the gallery leaves it out:
// a one-storey shop is only a few pixels taller than a warehouse wing.
export const ANCHOR_HOSTS = ['house', 'townhouse', 'shop', 'apartment', 'hotel'];
const GALLERY_HOSTS = ['house', 'townhouse', 'apartment', 'hotel'];

// A host with a wing attached. The host keeps its own type, materials, props and
// seed; the wing brings only what it needs to read as an annex.
export function annexFor(hostType, annexType, seed = 1) {
  const host = BUILDING_TYPES[hostType];
  if (!host) throw new Error(`unknown host type: ${hostType}`);
  if (host.attached) throw new Error(`${hostType} cannot host an annex: it only exists attached to a host`);
  const wing = BUILDING_TYPES[annexType];
  if (!wing) throw new Error(`unknown annex type: ${annexType}`);
  if (!wing.attached) throw new Error(`${annexType} is a standalone building, not an annex`);
  const rng = makeRng(seed * 6151 + hostType.length * 397 + annexType.length * 37);
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  const spec = variantFor(hostType, seed);
  spec.annex = {
    type: annexType,
    tiles: pick([2, 3]),
    side: pick(['left', 'right']),
    wall: pick(wing.walls),
    roof: pick(wing.roofs),
    roofStyle: annexType === 'warehouse' ? 'shed' : 'flat',
  };
  return spec;
}

export function gallerySpecs(seed = 1, perType = 3) {
  const out = [];
  for (const [name, type] of Object.entries(BUILDING_TYPES)) {
    for (let i = 0; i < perType; i++) {
      const s = seed + i * 13 + name.length;
      if (!type.attached) {
        out.push(variantFor(name, s));
        continue;
      }
      // a wing type never appears alone: it is shown hanging off a host
      out.push(annexFor(GALLERY_HOSTS[(i + seed + name.length) % GALLERY_HOSTS.length], name, s));
    }
  }
  return out;
}
