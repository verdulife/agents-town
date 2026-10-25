// Calibration card v2: the proportion contract drawn at real scale, with a
// template that checks a door against an NPC, and the guaranteed-visible rect.

import {
  computeView,
  computeCamera,
  applyView,
  TILE,
  WORLD_W,
  WORLD_H,
  SAFE_W,
  SAFE_H,
  TARGET_H,
} from './scale.js';
import { SPEC, doorFitsNpc } from './art-spec.js';
import {
  houseSprite,
  treeTopDown,
  personTopDown,
  kioskSprite,
  propTopDown,
  cableSprite,
  shadowBlob,
  TD_PALS,
} from './topdown-sprites.js';
import { C, rgba, mix } from '../palette.js';
import { drawText, lineWidth } from '../font.js';
import { makeRng } from '../rng.js';

const params = new URLSearchParams(location.search);
const targetH = Number(params.get('target')) || TARGET_H;
const zoom = Number(params.get('zoom')) || 0;
const showGrid = params.get('grid') !== '0';
const showLabels = params.get('labels') !== '0';

const canvas = document.getElementById('card');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const rng = makeRng(7);
const CX = WORLD_W / 2;
const CY = WORLD_H / 2;

// ------------------------------------------------------------------ scene

function buildScene() {
  const items = [];
  const add = (x, y, sprite, opts = {}) => {
    items.push({ x, y, sprite, ...opts });
    return items[items.length - 1];
  };

  // buildings, all from the contract (4x4 tiles unless stated)
  add(CX - 190, CY - 110, houseSprite({ wall: C.sand, roof: C.roofRed }), { caption: '4x4' });
  add(CX - 90, CY - 110, houseSprite({ wall: C.stoneLite, roof: C.roofBlue, windows: 2 }), { caption: '4x4 wide' });
  add(CX + 15, CY - 110, houseSprite({ wall: C.stone, roof: C.roofSlate, modern: true, windows: 1 }), {
    caption: 'FLAT 4x4',
  });
  add(CX + 115, CY - 110, houseSprite({ tilesW: 3, tilesH: 3, wall: C.brickLite, roof: C.roofGreen, windows: 1 }), {
    caption: '3x3',
  });

  // four directions + a walk frame
  const dirs = ['down', 'up', 'left', 'right'];
  dirs.forEach((dir, i) => {
    add(CX - 150 + i * 24, CY + 25, personTopDown(TD_PALS[i % TD_PALS.length], dir, i % 2));
  });
  add(CX - 150, CY + 45, { canvas: document.createElement('canvas'), w: 1, h: 1 }, { caption: 'NPC 12x20', invisible: true });

  // screens and street furniture
  add(CX - 40, CY + 30, kioskSprite('15C'), { caption: 'KIOSK 1x2' });
  add(CX - 8, CY + 30, propTopDown('vending'));
  add(CX + 22, CY + 30, propTopDown('bench'));
  add(CX + 40, CY + 28, propTopDown('barrel'));
  add(CX + 52, CY + 30, propTopDown('crate'));
  add(CX + 64, CY + 30, propTopDown('barrel', 2));
  add(CX + 92, CY + 30, propTopDown('lamp'), { shadow: false });
  add(CX + 122, CY + 30, propTopDown('lamp', 2), { shadow: false });
  add(CX + 140, CY + 30, propTopDown('planter'));
  add(CX + 166, CY + 30, treeTopDown(3), { caption: 'TREE 2x2' });
  add(CX + 210, CY + 30, treeTopDown(5, 'bush'), { caption: 'BUSH 1.5' });
  items.push({ x: CX + 107, y: CY + 7, sprite: cableSprite(32, 5), cable: true });

  // props row
  add(CX - 160, CY + 120, propTopDown('crate'));
  add(CX - 144, CY + 120, propTopDown('barrel'));
  add(CX - 128, CY + 120, propTopDown('planter'));
  add(CX - 108, CY + 120, propTopDown('vent'));
  add(CX - 80, CY + 120, treeTopDown(9), { caption: 'TREE' });
  add(CX - 160, CY + 138, { canvas: document.createElement('canvas'), w: 1, h: 1 }, { caption: '1x1 PROPS', invisible: true });

  items.sort((a, b) => a.y - b.y);
  return items;
}

const scene = buildScene();

// ----------------------------------------------------------------- ground

function bakeGround() {
  const cv = document.createElement('canvas');
  cv.width = WORLD_W;
  cv.height = WORLD_H;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const px = (x, y, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, 1, 1);
  };
  const rect = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };

  rect(0, 0, WORLD_W, WORLD_H, C.grass);
  for (let y = 0; y < WORLD_H; y += 2) {
    for (let x = 0; x < WORLD_W; x += 2) {
      if ((x + y) % 4 === 0 && rng.chance(0.18)) px(x, y, C.grassDark);
    }
  }
  for (let i = 0; i < 150; i++) {
    px(rng.int(0, WORLD_W - 1), rng.int(0, WORLD_H - 1), rng.chance(0.5) ? C.grassLite : C.grassSun);
  }

  const roadTop = CY - 20;
  const roadBottom = CY + 55;
  rect(0, roadTop, WORLD_W, roadBottom - roadTop, C.dirtMid);
  for (let y = roadTop; y < roadBottom; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const d = rng.next();
      if (d < 0.07) px(x, y, C.dirt);
      else if (d > 0.965) px(x, y, C.dirtLite);
    }
  }
  for (let x = 0; x < WORLD_W; x++) {
    if (rng.chance(0.6)) px(x, roadTop - 1, C.grassDark);
    if (rng.chance(0.6)) px(x, roadBottom, C.grassDark);
  }

  const plaza = { x: CX - 70, y: CY - 6, w: 120, h: 76 };
  rect(plaza.x, plaza.y, plaza.w, plaza.h, C.stone);
  for (let y = plaza.y; y < plaza.y + plaza.h; y++) {
    for (let x = plaza.x; x < plaza.x + plaza.w; x++) {
      if (rng.chance(0.02)) px(x, y, C.stoneLite);
      if (rng.chance(0.02)) px(x, y, C.slate);
    }
  }
  for (let x = plaza.x; x < plaza.x + plaza.w; x += TILE) rect(x, plaza.y, 1, plaza.h, C.slate);
  for (let y = plaza.y; y < plaza.y + plaza.h; y += TILE) rect(plaza.x, y, plaza.w, 1, C.slate);

  return cv;
}

const ground = bakeGround();

// ---------------------------------------------------------------- overlays

function caption(text, x, y, color = C.white) {
  const w = lineWidth(text);
  const tx = Math.round(x - w / 2);
  drawText(ctx, text, tx + 1, y + 1, C.ink);
  drawText(ctx, text, tx, y, color);
}

function dashedRect(x, y, w, h, color, dash = 5) {
  ctx.fillStyle = color;
  for (let i = 0; i < w; i += dash * 2) {
    ctx.fillRect(x + i, y, Math.min(dash, w - i), 1);
    ctx.fillRect(x + i, y + h - 1, Math.min(dash, w - i), 1);
  }
  for (let i = 0; i < h; i += dash * 2) {
    ctx.fillRect(x, y + i, 1, Math.min(dash, h - i));
    ctx.fillRect(x + w - 1, y + i, 1, Math.min(dash, h - i));
  }
}

function drawGrid() {
  if (!showGrid) return;
  for (let x = 0; x <= WORLD_W; x += TILE) {
    const major = x % (TILE * 5) === 0;
    ctx.fillStyle = major ? rgba('#ffffff', 0.13) : rgba('#ffffff', 0.045);
    ctx.fillRect(x, 0, 1, WORLD_H);
  }
  for (let y = 0; y <= WORLD_H; y += TILE) {
    const major = y % (TILE * 5) === 0;
    ctx.fillStyle = major ? rgba('#ffffff', 0.13) : rgba('#ffffff', 0.045);
    ctx.fillRect(0, y, WORLD_W, 1);
  }
}

// The proportion template: a door outline with an NPC standing next to it, so
// the rule "the door is taller than a person" is checked on screen.
function drawTemplate() {
  const baseY = CY + 132;
  const doorX = CX + 130;
  const door = SPEC.door;
  const npc = SPEC.npc;
  ctx.strokeStyle = rgba('#2ce8f5', 0.95);
  ctx.lineWidth = 1;
  ctx.strokeRect(doorX + 0.5, baseY - door.h + 0.5, door.w, door.h);
  const person = personTopDown(TD_PALS[2], 'down', 0);
  const personX = doorX + door.w + 18;
  ctx.drawImage(person.canvas, Math.round(personX - person.w / 2), Math.round(baseY - person.h));
  if (showLabels) {
    // labels on different rows: side by side they would collide at this scale
    caption(`DOOR ${door.w}x${door.h}`, doorX + door.w / 2, baseY - door.h - 10, C.neon);
    caption(`NPC ${npc.w}x${npc.h}`, personX, baseY + 4, C.neon);
  }
  return doorFitsNpc();
}

function drawRuler() {
  const y = CY + 168;
  const x0 = CX - 120;
  const len = 240;
  ctx.fillStyle = rgba('#0b0e1a', 0.55);
  ctx.fillRect(x0 - 8, y - 10, len + 16, 30);
  ctx.fillStyle = C.white;
  ctx.fillRect(x0, y, len, 1);
  for (let i = 0; i <= len; i += TILE) {
    const major = i % (TILE * 4) === 0;
    ctx.fillStyle = major ? C.white : rgba('#ffffff', 0.5);
    ctx.fillRect(x0 + i, y - (major ? 4 : 2), 1, major ? 4 : 2);
  }
  for (let i = 0; i <= len; i += TILE * 4) caption(`${i}px`, x0 + i, y + 4);
  caption('1 TILE = 16px', x0 + len / 2, y - 8, C.lamp);
}

function draw(view) {
  const cam = computeCamera(view);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.grassDeep;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  ctx.drawImage(ground, 0, 0);

  for (const item of scene) {
    if (item.invisible) continue;
    if (item.shadow !== false && !item.cable) {
      const blob = shadowBlob(Math.max(10, Math.round(item.sprite.w * 0.7)), 5);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(blob.canvas, Math.round(item.x - blob.w / 2), Math.round(item.y - 3));
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(item.sprite.canvas, Math.round(item.x - item.sprite.w / 2), Math.round(item.y - item.sprite.h));
  }

  if (showLabels) {
    for (const item of scene) {
      if (!item.caption) continue;
      caption(item.caption, item.x, item.y + 4);
    }
  }

  ctx.strokeStyle = rgba('#2ce8f5', 0.9);
  ctx.lineWidth = 1;
  ctx.strokeRect(CX - 161.5, CY + 103.5, TILE, TILE);

  drawGrid();

  const sx = Math.round((WORLD_W - SAFE_W) / 2);
  const sy = Math.round((WORLD_H - SAFE_H) / 2);
  dashedRect(sx, sy, SAFE_W, SAFE_H, rgba('#2ce8f5', 0.85));
  if (showLabels) caption(`SAFE ${SAFE_W}x${SAFE_H}`, sx + SAFE_W / 2, sy - 8, C.neon);

  const doorOk = drawTemplate();
  drawRuler();

  drawText(ctx, `WORLD ${WORLD_W}x${WORLD_H}  TILE ${TILE}`, 13, 11, C.ink, { font: 'tiny' });
  drawText(ctx, `WORLD ${WORLD_W}x${WORLD_H}  TILE ${TILE}`, 12, 10, C.white, { font: 'tiny' });

  ctx.restore();
  return doorOk;
}

// ------------------------------------------------------------------- boot

const panel = document.getElementById('readout');

function render() {
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const view = computeView(cssW, cssH, targetH, zoom);
  applyView(canvas, view, cssW, cssH);
  const doorOk = draw(view);
  const cam = computeCamera(view);

  panel.innerHTML = [
    `<b>window</b> ${cssW}x${cssH} · ${(cssW / cssH).toFixed(2)}:1`,
    `<b>scale</b> ${view.scale}x${view.forced ? ' (forced)' : ` (target ${targetH})`}`,
    `<b>logical</b> ${view.w}x${view.h} → canvas ${view.cssW}x${view.cssH}`,
    `<b>tiles</b> ${view.tilesW.toFixed(1)} x ${view.tilesH.toFixed(1)}`,
    `<b>safe ${SAFE_W}x${SAFE_H}</b> ${view.safeFits ? 'fully visible' : 'CROPPED'}`,
    `<b>contract</b> npc ${SPEC.npc.w}x${SPEC.npc.h} · door ${SPEC.door.w}x${SPEC.door.h} · facade ${SPEC.facade}`,
    `<b>door vs npc</b> ${doorOk ? 'ok' : 'TOO SHORT'}`,
  ].join('<br>');
}

window.addEventListener('resize', render);
render();
