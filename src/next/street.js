// The street, as a layout plus what is still massing (S16-S20). The question the prototype
// exists to answer is whether the cafeteria, the alley, the offices and the gym fit on one screen
// at the scale the cafeteria was drawn at, and every block reports its own numbers. All four of
// them are art now: they are drawn by their own modules, and this file places them and prices
// them.
//
// So every block is built out of the cafeteria's own storey (floor 64 + slab 10, the numbers in
// CAFE), and nothing here is allowed to invent a smaller floor to make the answer look better.
//
// The widths come from the view's own width, once, and never from a hardcoded street:
//
//   the cafeteria sits against the left limit at x=0 (its art, 192 wide, is its mass)
//   the alley is fixed at 88 (ALLEY.w), the niche alley.js draws. It is a place now, not a
//     sign: the layout only hands it the two flank heights, which are these buildings' own
//   the offices take their own width now, 302, the sprite's own: the tower is art, and a mass
//     narrower than its facade would let the gym's bulge take a bite out of it
//   the gym ends exactly at the view's right limit — S17 allows both ends to touch
//
// A tower should read taller than wide, so the offices keep a proportion instead of swallowing
// every spare pixel; the gym absorbs the difference, which is what makes the two of them always
// add up to the frame. On a view narrower than the street's own 822, the gym absorbs more than it
// has and is clipped by the right limit — that is the finding, not an error.
//
// A block whose computed height is taller than the view is not an error: it is the
// finding. It reports `overflow` in pixels and the page draws it clipped.
//
// Deterministic: no clock, no Math.random, no colour literal. Every block is art now, so this
// file owns the layout, the readout and the labels, and nothing else.

import { C, mix, rgba } from './palette.js';
import { drawText, lineWidth } from '../font.js';
import { CAFE, cafeLayout } from './cafe.js';
import { ALLEY } from './alley.js';
import { GYM } from './gym.js';
import { OFFICES, officesLayout } from './offices.js';

// One storey, borrowed from the cafeteria on purpose: that is the number being priced.
const FLOOR_H = CAFE.floorH; // 64
const SLAB_H = CAFE.slab; // 10
export const STOREY_H = FLOOR_H + SLAB_H; // 74

// The gym is no longer a mass (src/next/gym.js draws it), so the layout only needs the two
// numbers that make its height — its floors and the board over them — and those come from the
// sprite's own contract instead of being restated here.

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
  const officesW = OFFICES.width;
  const officesH = officesLayout().h; // 326, the sprite's own height
  const gymH = GYM.floors * STOREY_H + GYM.board; // 2 * 74 + 40 = 188, the sprite's own height
  // the slot is as tall as the taller of the two flanks that make it: it has no roof of its
  // own, so its height is the gap between the buildings beside it
  const alleyH = Math.max(cafeH, officesH);

  // what the offices and the gym share, once the cafeteria and the alley have their width
  const room = width - CAFE.width - ALLEY.w;
  // the gym ends at the right limit, so it takes whatever the offices did not. The offices are
  // art now and keep their own 302: on a view narrower than the street's 822 the gym is the one
  // that gives, and past its own 240 the page clips it.
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
      floors: OFFICES.storeys,
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
    billboard: { h: GYM.board },
  };
}

// `CAFE 192x172` · `ALLEY 88` · `OFFICES 4F 302x326` — the block's own numbers, shared
// by the label over its roof and by the readout, so the two can never word it differently.
export function blockSize(b) {
  if (b.kind === 'alley') return `${b.name} ${b.w}`;
  return `${b.name}${b.showFloors ? ` ${b.floors}F` : ''} ${b.w}x${b.h}`;
}

// `CAFE 192x172 FIT` · `ALLEY 88` · `OFFICES 4F 302x326 FIT` — the readout the page
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

// ---------------------------------------------------------------- labels

// Nothing of any block is painted here any more: all four are art now (src/next/cafe.js,
// alley.js, offices.js and gym.js). The blocks keep their widths, their heights and their
// readout lines, which is what the layout prices and the labels print.

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
