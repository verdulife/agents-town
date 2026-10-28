// The street, as a layout plus what is still massing (S16-S20). The question the prototype
// exists to answer is whether the cafeteria, the alley, the offices and the gym fit on one screen
// at the scale the cafeteria was drawn at, and every block reports its own numbers. The
// cafeteria, the alley and the gym are art now: they are drawn by their own modules, and this file
// places them and prices them.
//
// So every block is built out of the cafeteria's own storey (floor 64 + slab 10, the numbers in
// CAFE), and nothing here is allowed to invent a smaller floor to make the answer look better.
//
// The widths come from the view's own width, once, and never from a hardcoded street:
//
//   the cafeteria sits against the left limit at x=0 (its art, 192 wide, is its mass)
//   the alley is fixed at 88 (ALLEY.w), the niche alley.js draws. It is a place now, not a
//     sign: the layout only hands it the two flank heights, which are these buildings' own
//   the offices take a sane share of the rest: their own proportion of their height
//     (326 * 0.926 = 302), never less than 240, never so wide that the gym beside them
//     stops reading as a building
//   the gym ends exactly at the view's right limit — S17 allows both ends to touch
//
// A tower should read taller than wide, so the offices have a proportion instead of
// swallowing every spare pixel; the gym absorbs the difference, which is what makes the
// two of them always add up to the frame.
//
// A block whose computed height is taller than the view is not an error: it is the
// finding. It reports `overflow` in pixels and the page draws it clipped.
//
// Deterministic: no clock, no Math.random, no colour literal. The offices are still a mass — an
// ink3 body, a slate edge and the floor cadence — so the eye reads the bulk, not a facade.

import { Painter, cacheSprite } from '../pixel.js';
import { C, mix, rgba } from './palette.js';
import { drawText, lineWidth } from '../font.js';
import { CAFE, cafeLayout } from './cafe.js';
import { ALLEY } from './alley.js';
import { GYM } from './gym.js';

const cache = new Map();

// One storey, borrowed from the cafeteria on purpose: that is the number being priced.
const FLOOR_H = CAFE.floorH; // 64
const SLAB_H = CAFE.slab; // 10
export const STOREY_H = FLOOR_H + SLAB_H; // 74

const OFFICES = {
  // four floors on purpose: the tower is wide now, and a wide + five floors did not fit the
  // frame. Its front is a little under its height, which is what a squat block looks like
  floors: 4,
  minW: 240,
  aspect: 0.926,
  roof: 30, // the set-back block on top, parapet included
  parapet: 8, // the front wall of that block
  inset: 0.09, // how far it steps back, as a share of the block's width
};

// The gym is no longer a mass (src/next/gym.js draws it), so the layout only needs the two
// numbers that make its height — its floors and the board over them — and those come from the
// sprite's own contract instead of being restated here. What is left is the width the street
// will not go below before the offices stop being a building and the gym a strip.
const GYM_MIN_W = 220;

const MASS = { body: C.ink3, line: C.ink2, edge: C.slate };

// ------------------------------------------------------------------- layout

function makeBlock({ kind, name, x, w, floors = 0, h, showFloors = false, availableH, flanks = null }) {
  // the verdict is against the room a building actually has: from the ground line up to the
  // top of the frame, never the whole view height. A building on a pavement does not get
  // to use the pavement's own pixels
  const overflow = Math.max(0, h - availableH);
  return {
    kind,
    name,
    x,
    w,
    floorH: FLOOR_H,
    slabH: SLAB_H,
    floors,
    h,
    showFloors,
    overflow,
    fit: overflow > 0 ? 'OVERFLOW' : 'FIT',
    // only the alley has these: the two walls that make the slot, whose heights are the
    // neighbours' and not its own
    flanks,
  };
}

// The blocks, in the order they stand, from the view's width alone. `viewH` is the frame and
// `availableH` is the room above the ground line — the caller that owns the view passes both,
// and the FIT/OVERFLOW verdict is measured against the second.
export function streetLayout(viewW, viewH = Infinity, availableH = viewH) {
  const width = Math.max(1, Math.round(viewW));
  const height = Number.isFinite(viewH) ? viewH : Infinity;
  const above = Number.isFinite(availableH) ? availableH : Infinity;

  // the cafeteria's height is its own art's: it is drawn, not massed. The numbers agree
  // because both sides use FLOOR_H and SLAB_H: 2 * 74 + terrace 24 = 172, with the floor
  // line on the pavement — the 5 px stone plinth is a band over the bottom of the facade,
  // inside the 172, not a platform the building stands on.
  const cafeH = cafeLayout().h;
  const officesH = OFFICES.floors * STOREY_H + OFFICES.roof;
  const gymH = GYM.floors * STOREY_H + GYM.board; // 2 * 74 + 40 = 188, the sprite's own height
  // the slot is as tall as the taller of the two flanks that make it: it has no roof of its
  // own, so its height is the gap between the buildings beside it
  const alleyH = Math.max(cafeH, officesH);

  // what the offices and the gym share, once the cafeteria and the alley have their width
  const room = width - CAFE.width - ALLEY.w;
  // the offices take their own proportion of their height, never less than the minimum the
  // spec asks for and never so much that the gym beside them stops reading as a building
  const officesWant = Math.round(officesH * OFFICES.aspect);
  const officesW = Math.min(
    Math.max(officesWant, OFFICES.minW),
    Math.max(OFFICES.minW, room - GYM_MIN_W),
  );
  // the gym ends at the right limit, so it takes whatever the offices did not
  const gymWidth = Math.max(0, room - officesW);
  const leftover = width - CAFE.width - ALLEY.w - officesW - gymWidth;

  const cafeX = 0;
  const alleyX = cafeX + CAFE.width;
  const officesX = alleyX + ALLEY.w;
  const gymX = officesX + officesW;

  const blocks = [
    makeBlock({ kind: 'cafe', name: 'CAFE', x: cafeX, w: CAFE.width, floors: 2, h: cafeH, availableH: above }),
    makeBlock({
      kind: 'alley',
      name: 'ALLEY',
      x: alleyX,
      w: ALLEY.w,
      floors: 0,
      h: alleyH,
      // the café's flank and the offices': alley.js paints the niche to these two heights
      flanks: { leftH: cafeH, rightH: officesH },
      availableH: above,
    }),
    makeBlock({
      kind: 'offices',
      name: 'OFFICES',
      x: officesX,
      w: officesW,
      floors: OFFICES.floors,
      h: officesH,
      showFloors: true,
      availableH: above,
    }),
    makeBlock({
      kind: 'gym',
      name: 'GYM',
      x: gymX,
      w: gymWidth,
      floors: GYM.floors,
      h: gymH,
      showFloors: true,
      availableH: above,
    }),
  ];

  return {
    viewW: width,
    availableH: Number.isFinite(above) ? above : null,
    viewH: Number.isFinite(height) ? height : null,
    floorH: FLOOR_H,
    slabH: SLAB_H,
    storeyH: STOREY_H,
    alleyW: ALLEY.w,
    leftover,
    blocks,
    officeRoof: { h: OFFICES.roof, parapet: OFFICES.parapet },
    billboard: { h: GYM.board },
  };
}

// `CAFE 192x172` · `ALLEY 88` · `OFFICES 5F 240x400` — the block's own numbers, shared
// by the label over its roof and by the readout, so the two can never word it differently.
export function blockSize(b) {
  if (b.kind === 'alley') return `${b.name} ${b.w}`;
  return `${b.name}${b.showFloors ? ` ${b.floors}F` : ''} ${b.w}x${b.h}`;
}

// `CAFE 192x172 FIT` · `ALLEY 88` · `OFFICES 5F 240x400 FIT` — the readout the page
// prints, built from the layout so it can never disagree with what was drawn.
export function blockSegment(b) {
  if (b.kind === 'alley') return blockSize(b);
  return `${blockSize(b)} ${b.overflow > 0 ? `OVERFLOW+${b.overflow}` : 'FIT'}`;
}

export function streetReadout(L) {
  const lines = L.blocks.map(blockSegment);
  lines.push(`VIEW ${L.viewW}x${L.viewH}`);
  if (Number.isFinite(L.availableH)) lines.push(`ABOVE GROUND ${L.availableH}`);
  return lines;
}

// ---------------------------------------------------------------- painters

function frame(p, x, y, w, h, color) {
  p.hline(x, y, w, color);
  p.hline(x, y + h - 1, w, color);
  p.vline(x, y, h, color);
  p.vline(x + w - 1, y, h, color);
}

// The mass: ink3, a slate edge, and the floor cadence as a line per storey. No windows,
// no wall material — this is the bulk of the building and nothing else.
function paintMass(p, b) {
  const massH = b.floors * STOREY_H;
  const top = b.h - massH;
  p.rect(0, top, b.w, massH, MASS.body);
  for (let i = 1; i < b.floors; i++) {
    const y = b.h - i * STOREY_H;
    p.hline(0, y, b.w, MASS.line);
    // the slab's lit edge above the line, so a storey reads as a storey and not a fence
    p.hline(0, y - 1, b.w, mix(MASS.body, C.slate, 0.35));
  }
  frame(p, 0, top, b.w, massH, MASS.edge);
}

// The offices' rooftop: a block set back from the facade, and the parapet at its front.
function paintOfficeRoof(p, b) {
  const massTop = b.h - b.floors * STOREY_H; // the 30 above the fifth floor
  const inset = Math.max(6, Math.round(b.w * OFFICES.inset));
  const rw = Math.max(12, b.w - inset * 2);
  const x = Math.round((b.w - rw) / 2);
  p.rect(x, 0, rw, massTop, MASS.body);
  // the parapet, and the shadow the roof deck throws under it
  p.rect(x, 0, rw, Math.min(OFFICES.parapet, massTop), mix(MASS.body, C.slate, 0.5));
  p.hline(x, Math.min(OFFICES.parapet, massTop), rw, MASS.line);
  frame(p, x, 0, rw, massTop, MASS.edge);
}

// The gym's board is no longer painted here: it is the roof's steel structure and the screen it
// carries, and that art lives in gym.js. The block keeps its 40 and its readout line, and the
// height it reports is the sprite's own height.

// One sprite per block, cached: the cafeteria, the alley and the gym are drawn by their own
// modules, so their "mass" is their own art and this returns nothing for them.
export function blockSprite(b) {
  if (b.kind !== 'offices') return null;
  const key = `${b.kind}|${b.w}|${b.h}|${b.floors}`;
  return cacheSprite(cache, key, () => {
    const p = new Painter(Math.max(1, b.w), Math.max(1, b.h));
    paintMass(p, b);
    paintOfficeRoof(p, b);
    return p.sprite();
  });
}

// One label per block, tiny, above its roof. A block that runs off the top of the frame
// keeps its label inside it — the clipped mass above is the point being made, and a label
// nobody can see would hide it.
export function paintBlockLabels(ctx, L, groundY, view) {
  for (const b of L.blocks) {
    const text = blockSize(b);
    const tw = lineWidth(text, { font: 'tiny' });
    const roofY = groundY - b.h;
    const y = Math.max(3, Math.min(roofY - 7, view.h - 8));
    const x = Math.max(1, Math.min(b.x + 2, view.w - tw - 5));
    ctx.fillStyle = rgba(C.ink, 0.55);
    ctx.fillRect(x - 2, y - 2, tw + 4, 9);
    drawText(ctx, text, x, y, mix(C.plasterLite, C.white, 0.2), { font: 'tiny' });
  }
}
