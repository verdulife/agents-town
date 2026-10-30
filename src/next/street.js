// The street, as a layout plus what is still massing (S16-S20, S24). The question the prototype
// exists to answer is whether the cafeteria, the alley, the offices, the gym and the park fit on
// one screen at the scale the cafeteria was drawn at, and every block reports its own numbers. All
// five of them are art now: they are drawn by their own modules, and this file places them and
// prices them.
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
//   the gym keeps its own 240 from now on (S24): it used to absorb the difference up to the
//     view's right limit, which is what left the bare pavement this street never drew on
//   the park takes exactly that difference — viewW - 822 — and is a block of its own, with no
//     floors and with the height its own trees give it (src/next/park.js). It does not exist on a
//     view of 822 or narrower, and on a view wider than that it is the only thing that grows
//
// A tower should read taller than wide, so the offices keep a proportion instead of swallowing
// every spare pixel; the leftover past the gym's own 240 is the park's, so the blocks still add up
// to the frame. On a view narrower than the street's own 822, the gym is clipped by the right
// limit — that is the finding, not an error.
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
import { GYM, gymLayout } from './gym.js';
import { OFFICES, officesLayout } from './offices.js';
import { PARK, parkLayout } from './park.js';

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
  // the gym is art and keeps its own 240: it gives only when the view cannot hold that much, and
  // then the page clips it exactly as before. The difference past its own 240 is the park's.
  const gymWidth = Math.max(0, Math.min(GYM.width, room - officesW));
  const parkWidth = Math.max(0, room - officesW - gymWidth);

  const cafeX = 0;
  const alleyX = cafeX + CAFE.width;
  const officesX = alleyX + ALLEY.w;
  const gymX = officesX + officesW;
  const parkX = gymX + gymWidth;
  // the park's height is its own trees' (park.js owns the number). A strip too narrow to hold the
  // fountain is not a park: no block, no grass, no readout line, and its pixels are reported as
  // leftover instead — an empty green strip between the gym and the frame edge would be a defect
  // with a label on it, not a finding
  const park = parkWidth >= PARK.minW ? parkLayout(parkWidth) : null;
  const leftover = width - CAFE.width - ALLEY.w - officesW - gymWidth - (park ? parkWidth : 0);

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

  // the fifth block, and only when there is a strip to give it: no parkW, no block, no art
  if (park) {
    blocks.push(makeBlock({ kind: 'park', name: 'PARK', x: parkX, w: parkWidth, floors: 0, h: park.h, availableH: above }));
  }

  return {
    viewW: width,
    availableH: Number.isFinite(above) ? above : null,
    viewH: Number.isFinite(height) ? height : null,
    floorH: FLOOR_H,
    slabH: SLAB_H,
    storeyH: STOREY_H,
    alleyW: ALLEY.w,
    parkW: parkWidth,
    parkMinW: PARK.minW,
    leftover,
    blocks,
    billboard: { h: GYM.board },
  };
}

// The rooms behind the glass, in PAGE coordinates, for the lighting pass: a room is a lit volume, and the
// ambient of the hour must not darken it the way it darkens the street. The layouts already own these
// rectangles — the café's window, the offices' four glazed floors, the gym's two — so they are read from
// there and never re-derived here: a room measured twice drifts apart from the art.
//
// The alley has no glass and the park's ground is painted by park.js, so neither contributes.
export function streetRooms(street, groundY) {
  const rooms = [];
  const cafe = street.blocks.find((b) => b.kind === 'cafe');
  const offices = street.blocks.find((b) => b.kind === 'offices');
  const gym = street.blocks.find((b) => b.kind === 'gym');
  if (cafe) {
    const L = cafeLayout();
    rooms.push({ kind: 'cafe', x: cafe.x + L.glass.x, y: groundY - L.h + L.glass.y, w: L.glass.w, h: L.glass.h });
  }
  if (offices) {
    const L = officesLayout();
    const top = groundY - L.h;
    for (const band of L.bands) {
      rooms.push({
        kind: 'offices',
        x: offices.x + L.glass.x,
        y: top + band.y,
        w: L.glass.w,
        h: band.row - band.y + 1,
      });
    }
  }
  if (gym) {
    const L = gymLayout();
    const top = groundY - L.h;
    for (const glass of [L.groundGlass, L.upperGlass]) {
      if (!glass) continue;
      const x = glass.x ?? L.windowX;
      const y = glass.y ?? glass.top ?? 0;
      const w = glass.w ?? L.windowW;
      const h = glass.h ?? glass.rows ?? 0;
      if (h > 0) rooms.push({ kind: 'gym', x: gym.x + x, y: top + y, w, h });
    }
  }
  return rooms;
}

// `CAFE 192x172` · `ALLEY 88` · `OFFICES 4F 302x326` · `PARK 240` — the block's own numbers,
// shared by the label over its roof and by the readout, so the two can never word it differently.
// The alley and the park have no floors to count, so they print their width alone.
export function blockSize(b) {
  if (b.kind === 'alley' || b.kind === 'park') return `${b.name} ${b.w}`;
  return `${b.name}${b.showFloors ? ` ${b.floors}F` : ''} ${b.w}x${b.h}`;
}

// `CAFE 192x172 FIT` · `ALLEY 88` · `OFFICES 4F 302x326 FIT` · `PARK 240` — the readout the page
// prints, built from the layout so it can never disagree with what was drawn. The alley and the
// park are places, not buildings: nothing to price against the room above the ground line.
export function blockSegment(b) {
  if (b.kind === 'alley' || b.kind === 'park') return blockSize(b);
  return `${blockSize(b)} ${b.overflow > 0 ? `OVERFLOW+${b.overflow}` : 'FIT'}`;
}

export function streetReadout(L) {
  const lines = L.blocks.map(blockSegment);
  lines.push(`VIEW ${L.viewW}x${L.viewH}`);
  if (Number.isFinite(L.availableH)) lines.push(`ABOVE GROUND ${L.availableH}`);
  return lines;
}

// ---------------------------------------------------------------- labels

// Nothing of any block is painted here any more: all five are art now (src/next/cafe.js,
// alley.js, offices.js, gym.js and park.js). The blocks keep their widths, their heights and their
// readout lines, which is what the layout prices and the labels print. The park's label rides on
// the height its own trees set, so it sits over the crowns and inside the frame.

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
