// The cafeteria, at its own larger scale, and the only thing its page draws. S12/S13:
// the street elevation's person is 10x21 and the whole town is drawn to that; here a
// person is 14x30, and the page exists to answer one question by eye — is that enough
// room to see someone sitting at a table through a window?
//
// The contract lives in CAFE and nowhere else. The painters, the scene and the readout
// printed under the building all read those numbers, so "no cabe" or "sobra aire" is a
// number to change, not a redraw:
//
//   person 14x30 standing, 14x26 seated on a bench whose seat is 8 above the floor, so the
//   head lands 26 above the floor and 12 above the tabletop — the sitter is shorter than
//   the stander, on the same floor line · the one person on the pavement stands in front of
//   the 16 brick pier between the door and the window, never behind the glass · door leaf
//   18x40 in a 50 free wall, 16 brick | leaf | 16 brick, so it sits centred in that wall
//   instead of pressed against the glass · the interior floor line is the street line: the
//   sprite's bottom row is the pavement, the ground floor is measured up from it, and the 5
//   stone plinth is a band drawn over the bottom of the facade, not a platform the building
//   stands on · interior floor 64 to the underside of a 10 slab · window 122x48 whose glazing
//   is exactly 118 — three 38 panes and two 2 mullions — with a 10 sill, 5 of brick between
//   it and the plinth's top, and 6 between its head and the string course · one table group
//   per 38 pane at a 40 pitch: one shared
//   bench back 2 wide between two neighbouring tables, two diners leaning 4 over a 16 wide
//   table whose surface is 14 above the floor · ground floor 192 wide: the 50 free wall
//   with the door, the 122 window, a 20 pier · the flat above 192x64 with two 34x26
//   windows 56 apart, and a 24x15 air-conditioning unit on the brick between them whose
//   10 px fan turns four frames at 6 fps, over a seeded damp mark on the brick under it · the
//   terrace behind a 14 parapet is a roof someone
//   uses (S22): a 44x46 stair bulkhead standing behind that parapet with a normal 18x31 door,
//   a 4x14 flue under a 10 px ball whose seam scrolls a step per frame, four puffs of smoke
//   under it, a clothesline from the bulkhead to a slim post with a t-shirt and a pair of
//   underpants on it, and a black cat on the parapet whose 220 s routine is data in CAFE · the
//   plinth, the string course and the cornice stick
//   out past the 192, so the silhouette is not a straight rectangle.
//
// Two kinds of pixel live here, and the split is the whole animation budget: what holds still
// is painted once into the cached sprite, and what moves is a cached sprite of its own that
// the page blits per frame. There is one third case, and only one: the clothesline's wire holds
// still but is a single px wide, and the sprite's outline pass turns a single px line into a
// three px tube, so it is a still sprite of its own that the page blits after the building —
// `wireSprite()`, and the reason it is not part of the café's own canvas. `cafeAnimations()` is
// the list of the moving ones — the AC's fan,
// the smoke, the flue's ball and the cat — and every entry carries its place on the sprite and
// its own frame rule, so the page owns one loop instead of one copy of the same code per
// animated thing. Nothing in a painter reads a clock or a random: a frame index is all it
// gets, which is what lets `?pause=1&sim=N` reproduce a capture and `?anim=0` freeze frame 0.
//
// The facade is old New York brick on both floors: one texture, the same courses, a few
// darker and lighter bricks scattered by seed, chipped bricks showing the pale material
// behind them ("tochos a la vista") and soot under every sill.
//
// Deterministic: fixed seeds, no clock, no Math.random, no colour literal. Every colour
// comes from the palette module, so the building cannot drift off the street's ramp.
//
// Coordinates: a sprite pixel is an art pixel. y grows down, and `floorY` is the cafe's
// own floor line — the line the person stands on, that a bench sits on and that the door
// leaves at. It is also the sprite's bottom row and the pavement: the 5 stone plinth is
// drawn inside the 172, over the bottom of the facade, so the line the person on the
// pavement stands on is the line the diners sit on — one floor, one person, one of them
// sitting. A person sprite's bottom row is the floor under it, so the scene places one with
// `y = floorY - sprite.h`; a seated person's back column is column 1 when facing 1 and
// column w-2 when facing -1, and `cafeLayout().tables` already carries that x. A table
// group's `left` diner is flagged `behind: true`: that one is painted before the table, so
// the two of them can lean over its edges without either covering the other's seat.

import { Painter, cacheSprite, mkCanvas } from '../pixel.js';
import { C, mix, rgba } from './palette.js';
import { makeRng } from '../rng.js';

const cache = new Map();

export const CAFE = {
  // the step up from the street elevation's 10x21 person: this is the number to judge
  // seatedH is the whole figure from the head to the floor line: a person on a bench, the
  // seat 8 above the floor, so the head lands 26 above it — 12 above a 14 tabletop, and 4
  // under the 30 of the person standing on the same floor outside. Everything below the
  // seat is furniture height: the sill and the plinth hide the legs, which is the point
  person: { w: 14, h: 30, seatedH: 26, seat: 8, foot: 2 },
  door: { w: 18, h: 40, frame: 2, step: 3, stile: 3, rail: 3, kick: 4 },
  floorH: 64, // floor line to the underside of the ceiling slab
  slab: 10, // the slab between the cafe and the flat, and the flat's own ceiling
  // the stone plinth: a band over the bottom of the facade, inside the 172 rather than a
  // platform under it, so the floor line and the street line are the same line
  base: 5,
  pier: 20, // the brick at the window's right end; the free wall is on the other side
  width: 192, // ground floor width, and the flat's
  // how far the three bands stick out past `width`, on each side: this is what breaks the
  // rectangle, and the sprite is drawn wide enough to hold them
  protrude: { plinth: 3, band: 3, cornice: 4 },
  window: {
    w: 122, // 118 of glazing plus the frame's 2 on each side
    h: 48, // 44 of glazing plus the frame's 2 on each side
    sill: 10, // the frame's bottom edge sits this far above the floor: the 5 plinth, 5 of brick
    frame: 2,
    mullionBar: 2,
    panes: 3, // one table group per pane, centred
    paneW: 38, // 3 * 38 + 2 * 2 = 118
  },
  table: {
    // one group per pane: a shared bench back, two diners and the table they lean on
    groupW: 38, // the whole pane: 2 back + 14 + 16 + 14, less the 4 each diner leans over
    count: 3,
    top: 14, // the top surface above the floor: low enough that a 26 seated person's head
    // and shoulders clear it and high enough that the table still reads above the sill
    slab: 3,
    width: 16, // was 10: the pixels the two chair backs used to take, and the diners lean
    cup: 3,
    // one bench, two sitters back to back: a 2 back between two tables, 10 above the seat
    bench: { back: 2, backH: 10, seat: 3 },
  },
  // the flat: same width and height as the ground floor, two smaller windows
  // the flat's window, centred in its storey: equal brick above and below, which is what a
  // window in a plain wall does. It is derived, never a number that can drift
  upper: { winW: 34, winH: 26, gap: 56, shutters: 5 },
  // the split unit on the brick between the flat's two windows (S19). Its size and place are
  // derived in cafeLayout; only the fan moves, and it moves on the floor's own budget
  ac: {
    w: 24, // 24x15 on the 56 px of brick between the flat's two windows: 16 px clear each side
    h: 15,
    drop: 2, // its head this far under the windows' head: eye level, not under the cornice
    frame: 1, // the casing's rim, lit along the top and in shadow at the foot
    grille: 4, // the louvers on its right side, under the seam: a 10 px louvred panel
    bracket: 2, // the steel channel bolted under the casing
    lip: 2, // the drip lip: the casing's foot, a px proud of it on each side
    streak: 6, // rows of condensation down the brick from under that lip
    fan: { size: 10, frames: 4, fps: 6 }, // 10 px across, four frames at 6 fps
    // the damp mark the unit leaves on the brick under it. A moisture stain and not a shadow:
    // an irregular 16x10 patch in the brick's own darker tone, with a few thin runs below it
    stain: { w: 16, h: 10, streaks: 3, run: 5 },
  },
  // S22: the terrace is a roof somebody uses. Everything standing on the deck is measured
  // here once — its size, its place on the terrace and, where it moves, its own frame rate —
  // and cafeLayout turns those numbers into the x and y the painters and the page both read.
  roof: {
    parapet: 14, // the brick wall at the terrace's front edge, with a stone coping
    cap: 3,
    // the stair bulkhead, the "seta de tochos": brick on the facade's own courses, a flat
    // roof with a stone coping, and the steel door the internal stairs come out of. It stands
    // on the deck at the left, behind the parapet, and it is 46 tall: a stair head rising over
    // a 14 wall, not a shed on the roof. The parapet is painted after it, so the wall and its
    // stone coping cross in front of the bulkhead's lowest 14 px — that overlap is the depth
    // the elevation reads, and it is also why only the upper part of the door shows. The 6 px
    // it gained over its first 40 are brick above the door's head: 12 rows of coursing over a
    // 31 door, not 6, which is what makes the leaf read as a door in a wall and not as a slot.
    bulkhead: {
      w: 44,
      h: 46, // deck to the coping's top row: the coping and the door are inside these 46
      coping: 2, // stone over the flat roof, a pixel proud on each side
      // the door, on the terrace side of that wall: 44 = 22 brick · 18 door · 4 brick, so the
      // stairs come out onto the roof and not onto the street. 18x31 is a normal door here —
      // a person in this town is 30 tall — with a 1 px steel frame, a pull handle and one px
      // of stone under it. Twelve rows of brick over its head, and its lowest 13 px are behind
      // the parapet, so what shows of it above the wall is 18 rows of ordinary door height
      door: { w: 18, h: 31, frame: 1, inset: 4, step: 1 },
    },
    // the flue on that roof and the ball ventilator on top of it: a thin 4 px pipe, 14 tall,
    // under a 10 px ball. 4 and not 3, so the ball's centre and the pipe's centre are the same
    // column. The ball no longer turns like a fan — it carries a scrolling sinusoidal seam —
    // so five frames at 6 fps is the whole of its animation
    flue: { w: 4, h: 14, x: 13 },
    ball: { size: 10, frames: 5, fps: 6 },
    // the smoke off the flue's mouth: four puffs that drift up and sideways and fade, four
    // frames at 1.2 fps. A puff is 5 px across as it leaves the mouth and 12 by the end of its
    // life, and the four frames draw it at 5, 7, 10 and 12 — big enough to read beside the
    // ball's own column without ever being dense: it fades as it grows, so the widest puff is
    // also the faintest, and four of them on one diagonal are a wisp and never a plume. `lift`
    // is how far above the pipe's own mouth row they are born: a puff painted on the mouth row
    // straddles the pipe's top rows and reads as smoke off the side of the pipe, so the birth is
    // moved 4 up, under the ball, and the box has the height for it
    smoke: { w: 22, h: 14, frames: 4, fps: 1.2, puffs: 4, lift: 4 },
    // the clothesline: from the bulkhead's right edge to a slim post at the other end of the
    // terrace, sagging 2 px, with two garments pinned to it. Two 10 and 8 px garments on one
    // wire need a short span, so the post came in from the terrace's far end to 140 and grew
    // to 32: its head now stands clear above the washing instead of being hidden behind it and
    // the span is 95 px, not 141. A sag goes with the square of the span (3 * (95/141)^2 is
    // 1.4), so 2 keeps the dip visible without turning a short wire into a hammock. The
    // garments are still: they never move, so they are painted into the sprite, not blitted
    line: {
      sag: 2,
      post: { x: 140, w: 2, h: 32, cap: 2 },
      garments: [
        { kind: 'tee', w: 10, h: 8, at: 0.4 },
        { kind: 'pants', w: 8, h: 7, at: 0.56 },
      ],
    },
    // the black cat that lives on the parapet: 8x6 with a 3 px tail, and a routine of very
    // long stays — 40 + 60 + 40 + 80 = 220 s of data, walked and rested on the sim clock
    cat: {
      w: 8,
      h: 6,
      gaitFps: 5, // the walk's two leg frames swap ends this fast
      routine: [
        { label: 'WALK', pose: 'walk', secs: 40, from: 'left', to: 'right' },
        { label: 'SIT', pose: 'sit', secs: 60, at: 'right' },
        { label: 'BACK', pose: 'walk', secs: 40, from: 'right', to: 'left' },
        { label: 'LIE', pose: 'lie', secs: 80, at: 'left' },
      ],
    },
  },
  seed: 4181,
};

// ---------------------------------------------------------------- materials

const MAT = {
  brick: {
    base: mix(C.brick, C.woodDark, 0.28), // brown brick, not terracotta: an old wall
    lite: mix(C.brickLite, C.woodDark, 0.18),
    dark: mix(C.brick, C.ink, 0.42),
    mortar: mix(C.plaster, C.stone, 0.45),
    tocho: mix(C.plasterLite, C.sand, 0.45), // what a chipped brick shows behind it
  },
  stone: {
    // limestone, not steel: the plinth, the string course and the cornices are the only
    // warm grey in the building
    base: mix(C.stoneLite, C.sand, 0.4),
    lite: mix(C.stoneLite, C.white, 0.35),
    dark: mix(C.stone, C.sand, 0.2),
  },
  frame: { base: C.woodDark, lite: mix(C.woodDark, C.woodLite, 0.6), dark: mix(C.woodDark, C.ink, 0.45) },
  brass: {
    base: mix(C.lampWarm, C.woodLite, 0.35),
    lite: mix(C.lamp, C.woodLite, 0.4),
    dark: mix(C.lampWarm, C.woodDark, 0.5),
  },
  metal: { base: C.metal, lite: C.metalLite, dark: C.metalDark },
  wood: { base: C.wood, lite: C.woodLite, dark: C.woodDark, line: mix(C.woodDark, C.ink, 0.3) },
  interior: {
    wall: mix(C.plasterLite, C.lampWarm, 0.2),
    wallTop: mix(C.plaster, C.wood, 0.4),
    dado: mix(C.plaster, C.sand, 0.35),
    glow: C.lampWarm,
  },
};

// The brick grid, in art px: a 3 px brick under a 1 px mortar joint, 8 px long with a 1 px
// joint at its end, and every other course pushed half a brick along (running bond). The
// alley's back wall lays the same brick, so it is the street's one grid.
export const BRICK = { w: 8, h: 3, joint: 1, bond: 4 };

// ------------------------------------------------------------------ layout

let LAYOUT = null;

// Every x and y the painters and the scene need, derived once from CAFE.
export function cafeLayout() {
  if (LAYOUT) return LAYOUT;
  const { width, floorH, slab, base, pier, door, table, upper, roof, protrude, person } = CAFE;
  const win = CAFE.window;

  // the wall the door has to itself, left of the window: 50. The door is cut into the middle
  // of it, 16 brick | 18 leaf | 16 brick, so it is centred in its own wall instead of being
  // pressed against the glazing
  const freeWall = width - win.w - pier; // 50
  // the widest of the three overhanging bands decides how much canvas the sprite needs
  const bleed = Math.max(protrude.plinth, protrude.band, protrude.cornice);
  // the tallest thing standing on the deck sets how far the sprite reaches above the parapet:
  // the bulkhead's roof, then its flue, then the ball on the flue's mouth
  const stack = roof.bulkhead.h + roof.flue.h + roof.ball.size; // 40 + 14 + 10 = 64
  const propTop = Math.max(0, stack - roof.parapet); // 50
  const parapetTop = propTop;
  const deckTop = parapetTop + roof.parapet;
  const upperTop = deckTop + slab; // the flat's ceiling slab
  const upperBottom = upperTop + floorH; // the flat's floor line
  const ceilingY = upperBottom + slab; // the cafe's ceiling slab
  const floorY = ceilingY + floorH; // 172: the pavement, and the sprite's bottom row
  const h = floorY; // the plinth is drawn inside the 172, not under it

  const winX = freeWall;
  const winTop = floorY - win.sill - win.h;
  const glass = {
    x: winX + win.frame,
    y: winTop + win.frame,
    w: win.w - win.frame * 2,
    h: win.h - win.frame * 2,
  };
  // the glazing must come out as `panes` equal panes with a bar between them: 3 * 38 + 2 * 2
  const pitch = win.paneW + win.mullionBar;
  const bars = Array.from(
    { length: win.panes - 1 },
    (_, i) => glass.x + (i + 1) * win.paneW + i * win.mullionBar,
  );
  // One table bay per pane, one pitch apart and centred on the window: each group lands in
  // the middle of a pane and never on a mullion.
  const bays = Array.from(
    { length: table.count },
    (_, i) => winX + win.w / 2 + (i - (table.count - 1) / 2) * pitch,
  );

  const doorX = Math.round((freeWall - door.w) / 2); // 16: the door centred in its wall
  // the leaf stands ON the plinth: its last row is the stone band's top row, so the door is
  // fully visible and never looks sunk into the base
  const doorY = floorY - base - door.h + 1;
  // the 16 px brick pier between the door and the window, and the column the one person on
  // the pavement stands on: the middle of that pier, a pixel in from each end, so they read
  // as someone standing by the cafe door and never as a diner behind the glass
  const doorPierX = doorX + door.w;
  const doorPierW = winX - doorPierX;
  const standX = doorPierX + Math.round((doorPierW - person.w) / 2);

  const halfGroup = table.groupW / 2;
  // how far each diner leans over the table's own edge: whatever the pane has left once the
  // shared bench back, the two people and the table are in it. 2 + 14 + 16 + 14 - 2 * 4 = 38
  const lean = (person.w * 2 + table.width + table.bench.back - table.groupW) / 2;
  const seatY = floorY - person.seatedH; // the seated sprite's top row: the head
  const tables = bays.map((cx) => {
    const slotLeft = cx - halfGroup;
    // the left diner backs onto the shared bench back, the right one onto its own mullion
    const leftX = slotLeft + table.bench.back;
    const rightX = cx + halfGroup - person.w;
    const tableX = leftX + person.w - lean; // 16 wide, 4 under the diner behind it
    return {
      cx,
      tableX,
      tableW: table.width,
      bench: { backX: slotLeft, backW: table.bench.back, seatY, seatH: table.bench.seat },
      // the seated sprite's back is column 1 facing right, column w-2 facing left, so the
      // table stands between them and each of them leans over one of its edges
      left: { x: leftX, y: seatY, facing: 1, behind: true },
      right: { x: rightX, y: seatY, facing: -1, behind: false },
    };
  });

  // the flat's two windows, `gap` apart and centred on the building
  const upperWindows = Array.from(
    { length: upper.windows ?? 2 },
    (_, i) =>
      Math.round(width / 2 + (i - 0.5) * (upper.winW + upper.gap) - upper.winW / 2),
  ).map((x) => ({ x, y: upperTop + Math.round((floorH - upper.winH) / 2) }));

  // S19: the AC hangs on the brick between those two windows, centred on the building and a
  // couple of px under their head, so it sits at eye level instead of under the cornice. The
  // fan's place lives here and nowhere else: paintAc cuts the housing at it and the page blits
  // the turning fan there, so the two can never drift apart.
  const acW = CAFE.ac.w;
  const acH = CAFE.ac.h;
  const acX = Math.round(width / 2 - acW / 2); // 84: 16 px of brick clear of each window
  const acY = upperWindows[0].y + CAFE.ac.drop;
  const fanSize = CAFE.ac.fan.size;
  const fanX = acX + CAFE.ac.frame + 1; // the left compartment, one px in from the rim
  // centred in what the casing has once the rim and the drip lip are taken out, so the fan fills
  // its compartment the same way at any case height
  const fanY = acY + Math.round((acH - CAFE.ac.lip - fanSize) / 2);
  const seamX = fanX + fanSize; // the 1 px seam between the fan side and the grille side
  const ac = {
    x: acX,
    y: acY,
    w: acW,
    h: acH,
    frame: CAFE.ac.frame,
    lip: CAFE.ac.lip,
    seamX,
    fan: { x: fanX, y: fanY, size: fanSize, frames: CAFE.ac.fan.frames, fps: CAFE.ac.fan.fps },
    grille: {
      x: seamX + 1,
      y: acY + CAFE.ac.frame + 2,
      w: acX + acW - CAFE.ac.frame - (seamX + 1), // whatever the casing has left on the right
      slats: CAFE.ac.grille,
      step: 3,
    },
    // the bracket under the casing, set in from both ends, and the drip off its left corner
    bracket: { x: acX + 4, y: acY + acH, w: acW - 8, h: CAFE.ac.bracket },
    // the drip lip is the casing's own foot, a px proud on each side, so the box's silhouette
    // steps out where the water leaves it; the condensation runs from under that lip
    lipBox: { x: acX - 1, y: acY + acH - CAFE.ac.lip, w: acW + 2, h: CAFE.ac.lip },
    streak: { x: acX + 1, y: acY + acH + CAFE.ac.lip, h: CAFE.ac.streak },
    // the damp mark on the brick under the unit, centred on it and clear of the condensation:
    // 16x10 of irregular moisture, with a few thin runs below it
    stain: {
      x: acX + Math.round((acW - CAFE.ac.stain.w) / 2),
      y: acY + acH + CAFE.ac.bracket + 2,
      w: CAFE.ac.stain.w,
      h: CAFE.ac.stain.h,
      streaks: CAFE.ac.stain.streaks,
      run: CAFE.ac.stain.run,
    },
  };

  // ---------------------------------------------------------------- the terrace (S22)
  // Everything standing on the deck, in the order a street reads it: the bulkhead at the left,
  // the flue and its ball above it, the washing line crossing the roof, the cat on the parapet.
  const bh = roof.bulkhead;
  const bulk = {
    x: 0, // it rises from the building's own flank, so its left edge is the party wall
    y: deckTop - bh.h, // 24: the coping's top row
    w: bh.w,
    h: bh.h,
    coping: bh.coping,
    // the brick wall under the coping, and the stone threshold the door stands on
    wall: { y: deckTop - bh.h + bh.coping, h: bh.h - bh.coping },
  };
  const doorH = bh.door.h;
  const doorW = bh.door.w;
  const setaDoor = {
    // the door sits towards the terrace: the 22 px of brick on its street side are the bulk
    // of the wall, and the 4 px on its terrace side are the return the stairs turn behind
    x: bh.w - bh.door.inset - doorW,
    y: deckTop - bh.door.step - doorH, // its last row is the stone under it
    w: doorW,
    h: doorH,
    frame: bh.door.frame,
    // the threshold: a pixel proud towards the street and three towards the terrace, which is
    // the one cue an elevation has for which way the door opens. It sits on the deck, so the
    // parapet painted over the terrace hides it, with the door's own foot, behind the wall
    step: { x: bh.w - bh.door.inset - doorW - 1, y: deckTop - bh.door.step, w: doorW + 4, h: bh.door.step },
  };
  // the flue stands on the bulkhead's coping, and the ball on the flue's mouth: the sprite's
  // first row is that ball's top row, which is what sets the whole height of the building
  const flueTop = bulk.y - roof.flue.h;
  const ballSize = roof.ball.size;
  const ballX = roof.flue.x + Math.round((roof.flue.w - ballSize) / 2);
  const ballY = flueTop - ballSize;
  const smokeX = ballX - 7; // its box starts left of the ball, where the puffs drift
  const smokeY = ballY;
  const flue = {
    x: roof.flue.x,
    y: flueTop,
    w: roof.flue.w,
    h: roof.flue.h,
    ball: { x: ballX, y: ballY, size: ballSize, frames: roof.ball.frames, fps: roof.ball.fps },
    smoke: {
      x: smokeX,
      y: smokeY,
      w: roof.smoke.w,
      h: roof.smoke.h,
      frames: roof.smoke.frames,
      fps: roof.smoke.fps,
      puffs: roof.smoke.puffs,
      // where the puffs come out, in the smoke sprite's own coordinates: four rows above the
      // pipe's mouth, which is the row the flue's dark mouth is on at 0 of this box
      mouth: { x: roof.flue.x + 1 - smokeX, y: flueTop - smokeY - roof.smoke.lift },
    },
  };
  // the clothesline: the bulkhead's right edge to the head of a slim post, 95 px away. Both
  // ends of the wire hang on the post's own top row, so the span is level and the sag is the
  // only curve in it — a wire tied up on the coping would come down 14 px to the post and the
  // washing would slide to the low end. The wire is sampled per column off that one sag, so
  // its two ends and its dip can never disagree, and a garment is hung from the wire's own y
  // at its own x
  const post = {
    x: roof.line.post.x,
    y: deckTop - roof.line.post.h,
    w: roof.line.post.w,
    h: roof.line.post.h,
    cap: roof.line.post.cap,
  };
  const lineA = { x: bh.w, y: post.y }; // the hook on the bulkhead's side, on the post's row
  const lineB = { x: post.x - 1, y: post.y }; // the top of the post
  const lineY = (x) => {
    const t = (x - lineA.x) / (lineB.x - lineA.x);
    return Math.round(lineA.y + (lineB.y - lineA.y) * t + roof.line.sag * 4 * t * (1 - t));
  };
  const garments = roof.line.garments.map((g) => {
    const x = Math.round(lineA.x + (lineB.x - lineA.x) * g.at);
    return { ...g, x, y: lineY(x) + 1 }; // one row under the wire, so it hangs from it
  });
  // The wire's own box, in the sprite's coordinates: the span from the bulkhead's hook to the
  // top of the post, and the rows the sag and the pegs use. The wire and its pegs are painted
  // into a sprite of their own, never into the building's canvas — see paintWire.
  const wire = {
    x: lineA.x, // the hook's column is on the bulkhead's right edge
    y: lineA.y, // both ends hang on the post's top row
    w: lineB.x - lineA.x + 1, // to the top of the post, 96 columns
    h: roof.line.sag + 1, // the high end and the two rows the sag dips
  };
  // the cat: its feet are on the parapet's stone coping, and it walks the length of that wall
  // between two ends clear of the bulkhead at one side and of the building's flank at the
  // other. The post stands behind the parapet, so the cat crosses in front of it — the wall is
  // between them, which is the one thing the sprite's order already gets right
  const cat = {
    left: 50,
    right: 174,
    y: parapetTop - roof.cat.h,
    w: roof.cat.w,
    h: roof.cat.h,
  };

  LAYOUT = {
    w: width,
    h,
    bleed,
    canvasW: width + bleed * 2,
    floorY,
    // the plinth's first row: 5 rows of stone over the bottom of the facade, its last row on
    // floorY - 1, so the pavement starts on the row under the sprite
    plinthTop: floorY - base,
    plinthH: base,
    ceilingY,
    upperTop,
    upperBottom,
    deckTop,
    parapetTop,
    // the band between the two floors: the flat's floor line down to the cafe's ceiling
    bandY: upperBottom,
    bandH: ceilingY - upperBottom,
    win: { x: winX, y: winTop, w: win.w, h: win.h },
    glass,
    pitch,
    bars,
    door: {
      x: doorX,
      y: doorY,
      w: door.w,
      h: door.h,
      frame: door.frame,
      bayX: 0,
      bayW: freeWall,
      centre: doorX + door.w / 2,
    },
    doorPier: { x: doorPierX, w: doorPierW }, // 34..49: 16 px of brick between door and glass
    standX, // 35: the 14 wide person on the pavement, in front of that pier
    tables,
    upperWindows,
    ac,
    // the terrace: the bulkhead and its door, the flue with the ball and the smoke's own box,
    // the washing line with its post and garments, and the cat's box and its two ends
    bulkhead: { ...bulk, door: setaDoor },
    flue,
    clothesline: { a: lineA, b: lineB, y: lineY, post, garments, wire },
    cat,
  };
  return LAYOUT;
}

// -------------------------------------------------------------- face pieces

// The painter clamps everything to its own box, which is right for the facade. The three
// overhanging bands are the only pieces allowed outside the 192, so they draw on the raw
// canvas: the painter itself is already translated by `bleed`.
function over(p, x, y, w, h, color) {
  p.ctx.fillStyle = color;
  p.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Old brick, one texture for both floors. The courses are keyed to the sprite's own y, so
// the ground floor, the flat and the piers all share one grid and the joints line up: the
// building reads as one wall that a window and a door were cut into, not as two panels.
function brickFace(p, x, y, w, h, { seed, mat = MAT.brick } = {}) {
  const rng = makeRng(seed);
  const courseH = BRICK.h + BRICK.joint; // 4
  const pitch = BRICK.w + BRICK.joint; // 9
  p.rect(x, y, w, h, mat.mortar);
  const first = Math.floor(y / courseH);
  const last = Math.ceil((y + h) / courseH);
  for (let c = first; c < last; c++) {
    const courseY = c * courseH;
    const bandY = Math.max(y, courseY);
    const bandH = Math.min(y + h, courseY + BRICK.h) - bandY;
    if (bandH <= 0) continue;
    const shift = c & 1 ? BRICK.bond : 0;
    for (let bx = Math.floor((x - shift) / pitch) * pitch + shift; bx < x + w; bx += pitch) {
      const x0 = Math.max(x, bx);
      const x1 = Math.min(x + w, bx + BRICK.w);
      if (x1 <= x0) continue;
      // one colour per brick: mostly the base, a few darker, a few lighter, and a couple
      // of nearly-black bricks where centuries of soot settled
      const t = rng();
      const col =
        t < 0.06
          ? mix(mat.base, mat.dark, 0.75)
          : t < 0.2
            ? mix(mat.base, mat.dark, 0.4)
            : t < 0.34
              ? mix(mat.base, mat.lite, 0.45)
              : t < 0.44
                ? mix(mat.base, mat.lite, 0.2)
                : mat.base;
      p.rect(x0, bandY, x1 - x0, bandH, col);
      // the brick's lit top edge, one pixel, only on some of them: texture, not a grid
      if (t > 0.72 && bandH > 1) p.hline(x0, bandY, x1 - x0, mix(col, mat.lite, 0.2));
      // a chipped brick: the face is gone and the pale material behind it shows, dimmed by
      // everything the wall has been through since
      if (rng() < 0.05 && x1 - x0 > 2 && bandH > 1) {
        const cw = Math.min(x1 - x0 - 1, 2 + Math.floor(rng() * 2));
        const cx = x0 + Math.floor(rng() * Math.max(1, x1 - x0 - cw));
        p.rect(cx, bandY + bandH - 1, cw, 1, mix(mat.tocho, mat.dark, 0.18));
        p.px(cx + cw, bandY + bandH - 1, mat.dark);
      }
    }
  }
}

// The soldier course: bricks standing on end over a window head, the way a brick lintel is
// really built. It fills whatever wall is left between the window and the slab above it.
function soldierCourse(p, x, y, w, h, mat = MAT.brick) {
  if (w <= 0 || h <= 0) return;
  p.rect(x, y, w, h, mat.mortar);
  const bw = BRICK.h; // on end, so as wide as a brick is tall
  for (let i = 0; i + bw <= w; i += bw + BRICK.joint) {
    const col = (i / (bw + BRICK.joint)) & 1 ? mix(mat.base, mat.lite, 0.4) : mix(mat.base, mat.lite, 0.18);
    p.rect(x + i, y + 1, bw, Math.max(1, h - 1), col);
  }
  // the shadow the header course throws down onto the window head
  p.hline(x, y + h - 1, w, mat.dark);
}

// Soot: a sill catches the street's dirt and the rain carries it down the brick. A dark band
// under the sill, then two or three thin streaks running further, all from a fixed seed.
function sootUnder(p, x, y, w, rows, seed) {
  if (w <= 0 || rows <= 0) return;
  const rng = makeRng(seed);
  for (let i = 0; i < rows; i++) {
    over(p, x, y + i, w, 1, rgba(C.ink, 0.38 - (i / rows) * 0.26));
  }
  const streaks = Math.max(2, Math.round(w / 22));
  for (let i = 0; i < streaks; i++) {
    const sx = x + Math.floor(rng() * (w - 1));
    const len = 2 + Math.floor(rng() * (rows + 3));
    over(p, sx, y, 1, Math.min(len, rows + 3), rgba(C.ink, 0.13));
  }
}

// The plinth, the string course between the floors and the roof's cornice: three bands of
// the same stone, each with a lit top and a shadow underneath, so the building has storeys —
// and each of them wider than the wall, so the silhouette steps in and out.
function stoneBand(p, x, y, w, h, mat = MAT.stone) {
  over(p, x, y, w, h, mat.base);
  over(p, x, y, w, 1, mat.lite);
  over(p, x, y + 1, w, 1, mix(mat.base, mat.lite, 0.5));
  over(p, x, y + h - 1, w, 1, mat.dark);
  over(p, x, y + h - 2, w, 1, mix(mat.base, mat.dark, 0.55));
}

// The shadow a band throws on the wall below it, cold and short.
function bandShadow(p, x, y, w, rows) {
  for (let i = 0; i < rows; i++) over(p, x, y + i, w, 1, rgba(C.ink, 0.24 - i * 0.07));
}

// ------------------------------------------------------------------ people

const SKIN = [C.skin1, C.skin2, C.skin3];
const HAIR = [C.hairInk, C.hairBrown, C.hairFair, C.hairGrey];
const SHIRT = [C.brick, C.water, C.roofPurple, C.metal, C.roofOrange, C.grassDark];
const TROUSER = [C.slate, C.ink3, C.metalDark, C.woodDark];

// 14x30, facing right: hair at the back on the left, the face and the eye on the right, so
// the facing reads at 2 physical px per art px.
function paintStanding(p, look) {
  const { skin, hair, shirt, trouser, shoe } = look;
  const mid = mix(skin, C.ink, 0.18);
  // legs, then shoes
  p.rect(4, 19, 3, 9, mix(trouser, C.ink, 0.22));
  p.rect(8, 19, 3, 9, trouser);
  p.vline(8, 19, 9, mix(trouser, C.white, 0.16));
  p.rect(3, 28, 4, 2, shoe);
  p.rect(8, 28, 4, 2, shoe);
  p.px(9, 28, mix(shoe, C.white, 0.28));
  // torso
  p.rect(3, 9, 8, 10, shirt);
  p.vline(3, 9, 10, mix(shirt, C.white, 0.22));
  p.vline(10, 9, 10, mix(shirt, C.ink, 0.3));
  p.hline(6, 9, 3, mix(shirt, C.ink, 0.45));
  // arms and hands
  p.rect(1, 10, 2, 8, mix(shirt, C.ink, 0.12));
  p.rect(11, 10, 2, 8, mix(shirt, C.ink, 0.26));
  p.rect(1, 18, 2, 2, skin);
  p.rect(11, 18, 2, 2, mid);
  // neck, head
  p.rect(6, 8, 3, 1, mid);
  p.rect(4, 0, 7, 8, skin);
  p.rect(4, 0, 7, 2, hair);
  p.rect(4, 2, 2, 5, hair);
  p.px(9, 4, C.ink2);
  p.px(10, 5, mid);
  p.hline(5, 7, 5, mix(skin, C.ink, 0.3));
}

// 14x26 in profile, facing right, on a bench: the hip is on the seat, `seat` (8) above the
// floor, and the head top is at floor+26 — 12 above a 14 tabletop, which is the head and the
// shoulders the window is there to show. The shin hangs to just above the floor, well under
// the sill, so the legs are behind the plinth and the window frame and never read: the
// bottom of the figure is furniture, not a person standing up.
function paintSeated(p, look) {
  const { skin, hair, shirt, trouser, shoe } = look;
  const { seatedH, seat, foot } = CAFE.person;
  const mid = mix(skin, C.ink, 0.18);
  const hip = seatedH - seat; // the row the bench's seat plank is on: 18
  const sole = seatedH - foot; // the row the shoe's sole is on: 24
  const hand = seatedH - CAFE.table.top; // the row the tabletop's surface is on: 12
  // the leg first, so the torso and the thigh sit in front of the shin
  p.rect(11, hip + 2, 2, sole - hip - 2, mix(trouser, C.ink, 0.22));
  p.rect(9, sole, 5, 2, shoe);
  p.px(9, sole, mix(shoe, C.white, 0.25));
  // thigh forward, over the seat, and the knee hanging off it
  p.rect(2, hip, 11, 3, trouser);
  p.hline(2, hip, 11, mix(trouser, C.white, 0.16));
  // torso: the back in shadow, the chest lit, from the shoulders down to the seat
  p.rect(1, 8, 8, hip - 8, shirt);
  p.vline(1, 8, hip - 8, mix(shirt, C.ink, 0.32));
  p.vline(8, 8, hip - 8, mix(shirt, C.white, 0.18));
  p.hline(4, 8, 4, mix(shirt, C.ink, 0.45));
  // the arm: the sleeve down the side, then the forearm rising until the hand comes down on
  // the tabletop — the one line that says the person is at the table and not behind it
  p.rect(7, 9, 2, 4, mix(shirt, C.ink, 0.16));
  p.rect(8, hand - 2, 2, 3, mid);
  p.rect(10, hand - 1, 3, 2, skin);
  // neck, head
  p.rect(5, 7, 3, 1, mid);
  p.rect(3, 0, 7, 7, skin);
  p.rect(3, 0, 7, 2, hair);
  p.rect(3, 2, 2, 4, hair);
  p.px(8, 3, C.ink2);
  p.px(9, 4, mid);
  p.hline(4, 6, 5, mix(skin, C.ink, 0.3));
}

function mirror(sprite) {
  const cv = mkCanvas(sprite.w, sprite.h);
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(sprite.w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(sprite.canvas, 0, 0);
  return { canvas: cv, w: sprite.w, h: sprite.h };
}

// The one look per (pose, facing, seed): the scene reuses these instead of redrawing a
// person, so the six people inside the window and the one on the pavement are one cast.
// The walk, two frames of it: the standing figure with the legs in stride and the arms swinging against them.
// In an elevation a person walks across the frame, so the stride is the whole animation — a bouncing torso reads
// as a limp at ten pixels. `phase` 0 has the left leg forward and 1 the right.
function paintWalking(p, look, phase) {
  const { skin, hair, shirt, trouser, shoe } = look;
  const mid = mix(skin, C.ink, 0.18);
  const lead = phase === 0 ? 1 : -1;
  // legs in stride: the forward one straight and lit, the back one shaded and half a foot shorter
  const frontX = 4 + (lead > 0 ? 0 : 3);
  const backX = 8 - (lead > 0 ? 0 : 3);
  p.rect(frontX, 19, 3, 9, mix(trouser, C.ink, 0.18));
  p.vline(frontX, 19, 9, mix(trouser, C.white, 0.14));
  p.rect(backX, 19, 3, 8, mix(trouser, C.ink, 0.34));
  p.rect(frontX - 1, 28, 4, 2, shoe);
  p.rect(backX, 27, 4, 2, mix(shoe, C.ink, 0.25));
  p.px(frontX + 2, 28, mix(shoe, C.white, 0.28));
  // torso, a pixel narrower at the waist than standing, because the figure is turning into the step
  p.rect(3, 9, 8, 10, shirt);
  p.vline(3, 9, 10, mix(shirt, C.white, 0.22));
  p.vline(10, 9, 10, mix(shirt, C.ink, 0.3));
  p.hline(6, 9, 3, mix(shirt, C.ink, 0.45));
  // arms swing against the legs: the forward leg's opposite arm is forward
  const armX = lead > 0 ? 11 : 1;
  const backArmX = lead > 0 ? 1 : 11;
  p.rect(armX, 10, 2, 8, mix(shirt, C.ink, 0.12));
  p.rect(armX, 18, 2, 2, skin);
  p.rect(backArmX, 11, 2, 7, mix(shirt, C.ink, 0.3));
  p.rect(backArmX, 18, 2, 2, mid);
  // neck, head — the head does not bob: at this size a bobbing head is a wobble
  p.rect(6, 8, 3, 1, mid);
  p.rect(4, 0, 7, 8, skin);
  p.rect(4, 0, 7, 2, hair);
  p.rect(4, 2, 2, 5, hair);
  p.px(9, 4, C.ink2);
  p.px(10, 5, mid);
  p.hline(5, 7, 5, mix(skin, C.ink, 0.3));
}

export function personSprite({ pose = 'stand', facing = 1, seed = 0, phase = 0 } = {}) {
  const dir = facing < 0 ? -1 : 1;
  const seated = pose === 'seat';
  const walking = pose === 'walk';
  const step = walking ? (phase ? 1 : 0) : 0;
  return cacheSprite(cache, `person|${seated ? 'seat' : walking ? `walk${step}` : 'stand'}|${dir}|${seed}`, () => {
    const rng = makeRng(CAFE.seed + seed * 977 + (seated ? 313 : 0) + (dir < 0 ? 61 : 0));
    const look = {
      skin: rng.pick(SKIN),
      hair: rng.pick(HAIR),
      shirt: rng.pick(SHIRT),
      trouser: rng.pick(TROUSER),
      shoe: mix(C.ink2, C.woodDark, 0.45),
    };
    const h = seated ? CAFE.person.seatedH : CAFE.person.h;
    const p = new Painter(CAFE.person.w, h);
    if (seated) paintSeated(p, look);
    else if (walking) paintWalking(p, look, step);
    else paintStanding(p, look);
    const sprite = p.sprite();
    return dir === 1 ? sprite : mirror(sprite);
  });
}

// ----------------------------------------------------------------- terrace

// The washing line: a wire from the bulkhead's right edge to a slim post, sagging a couple of
// px, with a t-shirt and a pair of underpants pegged to it. The washing and the post hold still
// and are solid shapes, so they go into the building's sprite and take its outline like the rest
// of the roof. The post stands on the deck behind the parapet and is 32 tall against a 14 wall,
// so its head and 18 rows of its shaft show above the stone and the washing hangs under it —
// which is how a clothesline reads in an elevation.
//
// The wire itself is NOT in this sprite: one px of line under the building's outline pass comes
// out three px thick, and at 10x a wire with a dark rim on each side reads as a metal tube. So
// the wire and its pegs are paintWire below, in a sprite of their own that the page blits after
// the café — the one still thing in this file that is not part of the building's canvas.
function paintClothesline(p, L) {
  const line = L.clothesline;
  const m = MAT.metal;
  const post = line.post;
  // the post: two px of steel, a cap a touch wider than the shaft, and a rail at the top the
  // wire is tied to
  p.rect(post.x, post.y, post.w, post.h, m.base);
  p.vline(post.x, post.y, post.h, m.lite);
  p.vline(post.x + post.w - 1, post.y, post.h, m.dark);
  p.rect(post.x - post.cap, post.y, post.w + post.cap * 2, 1, mix(m.lite, m.base, 0.4));
  // the bracket on the bulkhead's side, bolted to the wall the bulkhead is about to be painted
  // over: it belongs to the wall, not to the wire
  p.rect(line.a.x - 2, line.a.y, 3, 1, m.dark);
  p.px(line.a.x - 1, line.a.y - 1, m.lite);
  // the washing: two pegs a garment, on the shoulders of the t-shirt and on the waistband of the
  // pants. One peg in the middle would have to hold a neckline cut out of the
  // cloth, and a single pin on 10 px of laundry reads as a nail, not as washing
  for (const garment of line.garments) paintGarment(p, garment);
}

// The wire, on its own canvas, built without the outline pass: one px per column down the sag,
// and the two pegs of each garment. One px of a mid steel and nothing around it — no darkening on
// either side, which is the whole point of the split, because one px of line plus the outline
// pass's two rows is a tube and not a wire. The bracket that ties it to the bulkhead stays in the
// building's sprite: it is bolted to a wall, and the wall is painted over it.
//
// The tone is the wire's own contrast, since it no longer borrows the outline's: mid steel is
// darker than a day sky and lighter than a night one, so a one px line reads against both.
function paintWire(p, L, ox = 0, oy = 0) {
  const line = L.clothesline;
  const m = MAT.metal;
  const tone = mix(m.base, m.dark, 0.3);
  // one px per column, following the sag, so the line is a curve and not three straight segments.
  // The painter's own box is the wire's box, so every column is handed over in its coordinates:
  // px() clips against the box, not against the building's canvas
  for (let x = line.a.x; x <= line.b.x; x++) p.px(x - ox, line.y(x) - oy, tone);
  // the pegs sit on the wire at the shoulders of the t-shirt and the waistband of the pants, and
  // they are painted here, in the wire's own pass, for the same reason the wire is: a one px peg
  // under the building's outline would be a three px peg
  for (const garment of line.garments) {
    for (const pegX of pegColumns(garment)) {
      p.px(pegX - ox, line.y(pegX) - oy, mix(C.wood, C.woodDark, 0.35));
    }
  }
}

// The wire's sprite: the whole span at 1:1, cached once, blitted by the page after the café's own
// sprite — on top of it, because the building is behind the wire from this angle. It is placed
// from `cafeLayout().clothesline.wire`, the same box the painter is handed as its origin, so a
// blit can never drift from the columns it was drawn in.
export function wireSprite() {
  const L = cafeLayout();
  const box = L.clothesline.wire;
  return cacheSprite(cache, `wire|${box.x},${box.y},${box.w}x${box.h}`, () => {
    const p = new Painter(box.w, box.h);
    paintWire(p, L, box.x, box.y); // painted in the wire's own box, not the building's
    return p.sprite();
  });
}

// Where the two pegs go: on the shoulders of a t-shirt, either side of its neckline, and on the
// waistband of the pants, in from each end. Derived from the garment's own width, so a wider
// piece of washing gets its pegs in the same places relative to its shape.
function pegColumns(g) {
  if (g.kind === 'pants') return [g.x + 1, g.x + g.w - 2];
  return [g.x + 2, g.x + g.w - 3];
}

// Washed cloth, two tones: a pale cotton t-shirt and a warm dusty pink pair of underpants, so
// the two pieces on the wire are never one blob. Both are lit down their left side, shaded down
// their right, and closed with a darker seam at the edge that folds or ends.
const CLOTH = {
  tee: mix(C.plasterLite, C.white, 0.3),
  pants: mix(C.brickLite, C.plaster, 0.5),
};

function clothTones(base) {
  return {
    base,
    lite: mix(base, C.white, 0.4),
    dark: mix(base, C.ink, 0.3),
    seam: mix(base, C.ink, 0.45),
  };
}

// One garment on the line. A silhouette, not a rectangle: at scene scale the outline is all the
// eye gets, so the shape carries the read and the shading only stops the cloth going flat.
function paintGarment(p, g) {
  const tone = clothTones(CLOTH[g.kind] ?? CLOTH.tee);
  if (g.kind === 'pants') paintPants(p, g, tone);
  else paintTee(p, g, tone);
}

// A 10x8 t-shirt: a shoulder line with a neckline cut out of it, short sleeves a row lower than
// the shoulders and one px out past them, a body under them and a hem across its foot. The two
// shoulders are the pegging points, so the cloth hangs from them and the neckline is the sky
// showing through the gap between them.
function paintTee(p, g, { base, lite, dark, seam }) {
  const { x, y, w, h } = g;
  const mid = x + Math.floor(w / 2); // the neckline's centre, derived from the width
  // the body: one row under the shoulder line, down to the hem
  p.rect(x + 1, y + 1, w - 2, h - 1, base);
  // the shoulders, with the neckline left as a gap between them
  p.hline(x + 1, y, mid - x - 2, lite);
  p.hline(mid + 1, y, x + w - 2 - mid, lite);
  // short sleeves: one px out past each shoulder and two rows down from it, which is what
  // makes this a t-shirt and not a vest
  p.rect(x, y + 1, 1, 2, base);
  p.rect(x + w - 1, y + 1, 1, 2, base);
  p.px(x, y + 1, lite);
  p.px(x + w - 1, y + 2, dark);
  // the collar: the row under the cut-out is in shadow, and that is the whole neckline
  p.hline(mid - 1, y + 1, 2, seam);
  // lit down its left side, shaded down its right, hemmed at its foot
  p.vline(x + 1, y + 1, h - 1, lite);
  p.vline(x + w - 2, y + 1, h - 1, dark);
  p.hline(x + 1, y + h - 1, w - 2, seam);
}

// An 8x7 pair of underpants: a waistband across the top, one row of seat under it, and then two
// legs with air between them. No sleeves and nothing else — the split is the whole read, and
// the waistband is where the two pegs are.
function paintPants(p, g, { base, lite, dark, seam }) {
  const { x, y, w, h } = g;
  const legW = 3;
  const split = y + 3; // the crotch: the waistband, the seat, then the two legs
  const legH = h - 3;
  p.rect(x, y, w, 2, base); // the waistband
  p.hline(x, y, w, lite); // lit along its top edge
  p.hline(x, y + 1, w, dark); // and shadowed under it
  p.rect(x, y + 2, w, split - (y + 2), base); // the seat
  for (const side of [0, 1]) {
    p.rect(side === 0 ? x : x + w - legW, split, legW, legH, base);
  }
  // lit on the outside left, shaded on the outside right, and both sides of the crotch in
  // shadow, which is what reads as two legs instead of one bag
  p.vline(x, y + 2, h - 2, lite);
  p.vline(x + w - 1, y + 2, h - 2, dark);
  p.vline(x + legW - 1, split, legH, dark);
  p.vline(x + w - legW, split, legH, dark);
  // each leg ends in a hem, not in nothing
  p.hline(x, y + h - 1, legW, seam);
  p.hline(x + w - legW, y + h - 1, legW, seam);
}

// The bulkhead's whole palette, mixed towards ink: it stands behind the parapet, and the wall
// in front of it shades it. That 0.18 is the entire depth cue — the brick stays brick, the
// coursing stays the facade's own, and nothing else about the wall changes.
const SHADE = 0.18;
function shaded(mat, amount = SHADE) {
  const out = {};
  for (const key of Object.keys(mat)) out[key] = mix(mat[key], C.ink, amount);
  return out;
}
const SHADED = { brick: shaded(MAT.brick), stone: shaded(MAT.stone), metal: shaded(MAT.metal) };

// The stair bulkhead — the "seta de tochos" of S22. Brick on the facade's own course grid, a
// flat roof with a stone coping, and the steel door the internal stairs come out of. Painted
// before the parapet on purpose: it stands on the deck behind the front wall, 40 tall against
// a 14 parapet, so what reads is a stair head rising over the wall — and the wall and its
// stone coping crossing in front of the bottom of the bulkhead and of its door.
function paintBulkhead(p, L) {
  const b = L.bulkhead;
  const d = b.door;
  const m = SHADED.metal;
  brickFace(p, b.x, b.wall.y, b.w, b.wall.h, { seed: CAFE.seed + 7, mat: SHADED.brick });
  // the coping: stone, a pixel proud on each side, lit on top, dark at its foot, and the
  // shadow it throws down the brick under it
  stoneBand(p, b.x - 1, b.y, b.w + 2, b.coping, SHADED.stone);
  bandShadow(p, b.x, b.y + b.coping, b.w, 2);
  // the door's reveal first: the wall is cut, so the opening is one px wider and taller than
  // the frame and in shadow
  p.rect(d.x - 1, d.y - 1, d.w + 2, d.h + 1, mix(SHADED.brick.dark, C.ink, 0.45));
  // light grey steel, not the facade's brass — and mixed towards ink with the rest of it, so
  // the door is the front wall's steel seen from further back
  const steel = mix(mix(C.stoneLite, MAT.metal.base, 0.35), C.ink, SHADE);
  const steelLite = mix(steel, C.white, 0.4);
  const steelDark = mix(steel, m.dark, 0.45);
  // the frame: one px of a darker steel round the leaf
  const f = d.frame;
  p.rect(d.x, d.y, d.w, d.h, steelDark);
  const fx = d.x + f;
  const fy = d.y + f;
  const fw = d.w - f * 2;
  const fh = d.h - f * 2;
  p.rect(fx, fy, fw, fh, steel);
  p.hline(fx, fy, fw, steelLite); // the leaf is lit along its head
  p.vline(fx, fy, fh, mix(steel, C.ink, 0.12));
  p.vline(fx + fw - 1, fy, fh, steelLite); // and along its terrace edge
  p.hline(fx, fy + fh - 1, fw, steelDark); // dark at its foot, where the step's shadow is
  // the pull handle, on the terrace side and at half the door's height, with the shadow it
  // drops on the leaf
  const hy = fy + Math.round(fh / 2) - 2;
  p.rect(fx + fw - 3, hy, 2, 4, m.dark);
  p.px(fx + fw - 3, hy, m.lite);
  p.px(fx + fw - 2, hy + 4, mix(C.ink, m.dark, 0.5));
  // the stone threshold: a pixel proud towards the street, three towards the terrace
  const st = d.step;
  p.rect(st.x, st.y, st.w, st.h, mix(SHADED.stone.base, SHADED.stone.lite, 0.45));
  p.px(st.x, st.y, SHADED.stone.dark);
  p.px(st.x + st.w - 1, st.y, SHADED.stone.dark);
}

// The flue on the bulkhead's roof: a steel pipe with its mouth open, a flange bolted to the
// coping and two dark px for the socket the ball sits in. The ball itself is not painted here —
// it moves, so it is a sprite of its own that the page blits, exactly like the AC fan.
function paintFlue(p, L) {
  const f = L.flue;
  const m = MAT.metal;
  const pipe = mix(m.base, m.lite, 0.45);
  p.rect(f.x, f.y, f.w, f.h, pipe);
  p.vline(f.x, f.y, f.h, mix(pipe, C.white, 0.3));
  p.vline(f.x + f.w - 1, f.y, f.h, mix(pipe, C.ink, 0.35));
  p.hline(f.x, f.y, f.w, mix(C.ink, m.dark, 0.4)); // the mouth, dark: it is a hole
  p.px(f.x + 1, f.y + 1, mix(pipe, C.ink, 0.25));
  // the flange: wider than the pipe, lit on its top edge, dark where it meets the stone
  p.rect(f.x - 1, f.y + f.h - 3, f.w + 2, 3, mix(m.base, m.lite, 0.2));
  p.hline(f.x - 1, f.y + f.h - 3, f.w + 2, m.lite);
  p.hline(f.x - 1, f.y + f.h - 1, f.w + 2, m.dark);
  p.px(f.x, f.y + f.h - 2, m.dark);
  p.px(f.x + f.w - 1, f.y + f.h - 2, m.dark);
  // nothing is painted at row f.y - 1: the sprite's own outline darkens the pixels over the
  // mouth for the ball to sit in, and the ball's frames cover them
}

function paintRoof(p, L) {
  const { deckTop, parapetTop, upperTop } = L;
  const { roof, protrude } = CAFE;
  // behind the wall first, in the order the terrace reads: the post, the wire and the washing,
  // then the bulkhead the wire is tied to, then the flue on the bulkhead's roof. All of them
  // stand on the deck, so the parapet painted over them is the terrace's front edge and their
  // feet — and the foot of the stair door — are hidden behind it
  paintClothesline(p, L);
  paintBulkhead(p, L);
  paintFlue(p, L);
  // the parapet: the same brick as the two floors, capped with stone that oversails by one,
  // painted after those props because it is the wall at the front of the terrace, and because
  // the 14 px of it and its coping are what put the bulkhead behind the roof instead of on it
  brickFace(p, 0, parapetTop, L.w, roof.parapet, { seed: CAFE.seed + 5 });
  p.rect(0, parapetTop + roof.parapet - 2, L.w, 2, mix(MAT.brick.dark, C.ink, 0.2));
  stoneBand(p, -1, parapetTop, L.w + 2, roof.cap, MAT.stone);
  // the roof's own cornice, the widest thing in the building, standing out over the flat
  stoneBand(p, -protrude.cornice, deckTop, L.w + protrude.cornice * 2, upperTop - deckTop, MAT.stone);
}

// ------------------------------------------------------------------- flat

function paintUpperWindow(p, x, y, lit) {
  const { winW, winH, shutters } = CAFE.upper;
  const f = 2;
  const gx = x + f;
  const gy = y + f;
  const gw = winW - f * 2;
  const gh = winH - f * 2;
  // reveal, glass, a cold reflection off the sky
  p.rect(x - 1, y - 1, winW + 2, winH + 2, MAT.frame.dark);
  p.rect(x, y, winW, winH, MAT.frame.base);
  p.rect(gx, gy, gw, gh, lit ? mix(C.glass, C.glassLitSoft, 0.35) : C.glass);
  for (let i = 0; i < gh; i += 1) {
    const sx = gx + 3 + i;
    if (sx < gx + gw - 1) p.hline(sx, gy + i, 2, rgba(C.glassLite, 0.35));
  }
  if (lit) {
    // a warm room behind the glass, and a roller blind half down over it
    p.dither(gx + 1, gy + 1, gw - 2, 6, mix(C.glass, C.glassLitSoft, 0.45), C.glassLitSoft, 1);
    p.rect(gx, gy, gw, 9, mix(C.plasterLite, C.stoneLite, 0.25));
    p.hline(gx, gy + 9, gw, mix(C.stoneLite, C.stone, 0.5));
    p.hline(gx, gy + 8, gw, mix(C.plasterLite, C.white, 0.3));
  } else {
    // a curtain pulled to one side: the flat is lived in, not a hole
    p.rect(gx, gy, 4, gh, mix(C.plaster, C.ink, 0.5));
    p.vline(gx + 4, gy, gh, mix(C.plaster, C.ink, 0.62));
  }
  // mullion and transom, so a 34x26 window still reads as a window
  p.vline(gx + Math.round(gw / 2), gy, gh, MAT.frame.dark);
  p.hline(gx, gy + Math.round(gh / 2), gw, MAT.frame.dark);
  // the shutters, louvred, half open
  for (const side of [-1, 1]) {
    const sx = side < 0 ? x - shutters : x + winW;
    p.rect(sx, y, shutters, winH, C.roofGreenDark);
    for (let i = 1; i < winH - 1; i += 2) p.hline(sx, y + i, shutters, i % 4 === 1 ? C.roofGreenLite : C.roofGreen);
    p.vline(sx, y, winH, mix(C.roofGreenDark, C.ink, 0.3));
    p.vline(sx + shutters - 1, y, winH, mix(C.roofGreenDark, C.ink, 0.3));
    p.rect(sx, y, shutters, 2, MAT.metal.base);
  }
  // the stone sill, the shadow it throws, and the soot the street leaves under it
  p.rect(x - 3, y + winH, winW + 6, 3, MAT.stone.base);
  p.hline(x - 3, y + winH, winW + 6, MAT.stone.lite);
  p.hline(x - 3, y + winH + 3, winW + 6, MAT.stone.dark);
  sootUnder(p, x - 3, y + winH + 4, winW + 6, 5, CAFE.seed + 31 + x);
}

function paintFlat(p, L) {
  const { floorH, protrude } = CAFE;
  // the same brick as the ground floor, on the same course grid
  brickFace(p, 0, L.upperTop, L.w, floorH, { seed: CAFE.seed + 2 });
  // the cornice above throws a shadow on the top of this wall
  bandShadow(p, 0, L.upperTop, L.w, 3);
  L.upperWindows.forEach((win, i) => paintUpperWindow(p, win.x, win.y, i === 1));
  // the unit goes on last, on the brick between the two windows and over nothing else
  paintAc(p, L);
  // the string course: the flat's floor slab and the cafe's ceiling, standing out over the
  // wall it separates, with its shadow falling on the brick below
  stoneBand(p, -protrude.band, L.bandY, L.w + protrude.band * 2, L.bandH, MAT.stone);
}

// -------------------------------------------------------------- AC unit

// The circle the fan turns in, row by row, derived from the size so the housing and the
// blades can never disagree about how big the fan is: a disc sampled at each row's centre.
function fanRows(size) {
  const rows = [];
  for (let i = 0; i < size; i++) {
    const t = ((i + 0.5) / size) * 2 - 1;
    rows.push(Math.max(2, Math.round(size * Math.sqrt(Math.max(0, 1 - t * t)))));
  }
  return rows;
}

// Three blades, one pixel thick, out from the hub to the rim. The angles are a fixed table and
// the turn is a whole number of frames, so a frame is a pure function of its index: nothing
// here reads a clock, which is what lets `?pause=1&sim=N` reproduce a capture exactly.
const FAN_BLADES = [90, 210, 330];

// The housing — a dark recess behind a steel rim — at (ox, oy): cut into the cached sprite,
// and drawn again under every fan frame so a frame is a whole little sprite, not a patch.
function paintFanHousing(p, ox, oy, size) {
  const rows = fanRows(size);
  const m = MAT.metal;
  const recess = mix(C.ink, m.dark, 0.3);
  const rim = mix(m.base, m.lite, 0.25);
  for (let i = 0; i < size; i++) {
    const x0 = Math.round((size - rows[i]) / 2);
    p.hline(ox + x0, oy + i, rows[i], rim);
    if (i > 0 && i < size - 1) p.hline(ox + x0 + 1, oy + i, rows[i] - 2, recess);
  }
}

// The blades at one frame, plus the hub over them. A frame is a 45 degree turn, so 0 reads
// up-down, 1 as one diagonal, 2 as left-right and 3 as the other diagonal — the four poses a
// turning fan is seen in on a pixel grid. Each blade is a pixel at half the radius and a pixel
// at the rim, so one frame of turn moves every blade and no two frames share a silhouette.
function paintFanBlades(p, frame, ox, oy, size) {
  const rows = fanRows(size);
  const m = MAT.metal;
  const blade = mix(m.lite, C.white, 0.45);
  const c = (size - 1) / 2;
  const turn = (frame * 360) / (CAFE.ac.fan.frames * 2);
  for (const base of FAN_BLADES) {
    const a = ((base + turn) * Math.PI) / 180;
    for (let step = 2; step <= size / 2 - 1; step++) {
      const bx = Math.round(c + Math.cos(a) * step);
      const by = Math.round(c - Math.sin(a) * step);
      // a blade never leaves its own housing
      if (by < 0 || by >= size) continue;
      const x0 = Math.round((size - rows[by]) / 2);
      if (bx < x0 || bx >= x0 + rows[by]) continue;
      p.px(ox + bx, oy + by, blade);
    }
  }
  // the hub, last and lighter than the recess: the blades meet under it, and it is what stops
  // four frames of thin pixels reading as a smudge
  const hx = ox + Math.floor(c);
  const hy = oy + Math.floor(c);
  p.rect(hx, hy, 2, 2, mix(m.lite, m.base, 0.4));
  p.px(hx, hy, mix(m.lite, C.white, 0.25));
}

// One frame of the fan, cached by (size, frame). The page blits this at
// `cafeLayout().ac.fan` — the same pixels the baked sprite cut its housing into.
export function acFanSprite(frame = 0) {
  const { size, frames } = CAFE.ac.fan;
  const n = Number(frame);
  const f = Number.isFinite(n) ? ((Math.round(n) % frames) + frames) % frames : 0;
  return cacheSprite(cache, `acfan|${size}|${f}`, () => {
    const p = new Painter(size, size);
    paintFanHousing(p, 0, 0, size);
    paintFanBlades(p, f, 0, 0, size);
    return p.sprite();
  });
}

// The rule every moving thing follows — the floor's, verbatim: frame 0 when frozen,
// otherwise floor(t * fps) % frames. One clock, one division, and no element with a phase of
// its own, which is what lets four different frame rates share one capture.
function cycleFrame(timeSec, { frames, fps }, frozen = false) {
  if (frozen) return 0;
  const t = Number(timeSec);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.floor(t * fps) % frames;
}

// S19: the split unit on the brick between the flat's two windows. Everything that holds
// still is painted here, into the cached sprite: the casing, its seam, the bracket it hangs
// from, the louvers on its right and the condensation off its corner. Only the fan is left
// out, and the page blits it per frame over the housing cut for it.
//
// The case is 24x15 on 56 px of brick, and it is read as a split condenser the way the object is
// built: a 12 px fan compartment, a 1 px seam, a 10 px louvred side, a 2 px head over all of it
// and a 2 px lip under it. That is a different proportion from the first 20x13 — less like a
// grille with a circle in it and more like a machine that is a lid, a body and a drip edge.
function paintAc(p, L) {
  const a = L.ac;
  const m = MAT.metal;
  const { x, y, w, h, frame: f } = a;
  const lip = a.lipBox;
  const br = a.bracket;
  // the damp mark first: it belongs to the brick under the unit, not to the unit
  paintDampStain(p, a.stain);
  // the brick behind takes the unit's shadow: the casing stands proud of the wall, and it hangs
  // a bracket and a lip over the wall, so the shadow sits under the lowest of them
  p.rect(x + 1, br.y + br.h + 1, w - 2, 1, rgba(C.ink, 0.2));
  // the condensation: water off the coil running down the brick from under the lip's left
  // corner, faint because it is water and not the street's soot
  for (let i = 0; i < a.streak.h; i++) {
    p.rect(a.streak.x, a.streak.y + i, 1, 1, rgba(C.ink, 0.2 - i * 0.026));
    if (i < a.streak.h - 2) p.rect(a.streak.x + 1, a.streak.y + i, 1, 1, rgba(C.ink, 0.09));
  }
  // the bracket: a steel channel bolted under the casing, a bolt at each end
  p.rect(br.x, br.y, br.w, br.h, m.base);
  p.hline(br.x, br.y, br.w, mix(m.base, m.lite, 0.5));
  p.hline(br.x, br.y + br.h - 1, br.w, mix(m.dark, C.ink, 0.3));
  p.px(br.x, br.y + br.h - 1, mix(m.dark, C.ink, 0.55));
  p.px(br.x + br.w - 1, br.y + br.h - 1, mix(m.dark, C.ink, 0.55));
  // the casing: a steel box wider than it is tall, lit along its head, dark at its foot
  p.rect(x, y, w, h, mix(m.base, m.lite, 0.3));
  p.rect(x + f, y + f, w - f * 2, h - f * 2, mix(m.base, C.white, 0.16));
  p.hline(x, y, w, m.lite);
  // the head: one shaded row under the lit edge, so the case is a lid over a body and not one
  // flat box with a circle on it
  p.hline(x + f, y + f, w - f * 2, mix(m.base, m.lite, 0.5));
  p.vline(x, y, h, mix(m.base, m.lite, 0.55));
  p.vline(x + w - 1, y, h, m.dark);
  p.hline(x, y + h - 1, w, mix(m.dark, C.ink, 0.25));
  // the 1 px seam that splits the fan side from the grille side, then the louvers: a slot and
  // the lit lip it holds its light on
  p.vline(a.seamX, y + f, h - f * 2, mix(m.dark, C.ink, 0.2));
  const g = a.grille;
  for (let i = 0; i < g.slats; i++) {
    const gy = g.y + i * g.step;
    p.hline(g.x, gy, g.w, mix(C.ink, m.dark, 0.55));
    p.hline(g.x, gy - 1, g.w, mix(m.lite, m.base, 0.45));
  }
  // the housing the page's fan frames land in, so the sprite reads as a unit even between two
  // blitted frames and the fan can never be drawn off its own recess
  paintFanHousing(p, a.fan.x, a.fan.y, a.fan.size);
  // the drip lip: the casing's foot, a px proud on each side and darker underneath, which is
  // where the condensate leaves the machine and where the streak under it starts. It goes on
  // last because it stands in front of the casing's own last two rows
  p.rect(lip.x, lip.y, lip.w, lip.h, mix(m.base, m.lite, 0.2));
  p.hline(lip.x, lip.y, lip.w, mix(m.lite, m.base, 0.5));
  p.hline(lip.x, lip.y + lip.h - 1, lip.w, mix(m.dark, C.ink, 0.4));
  p.px(lip.x, lip.y + lip.h - 1, mix(m.dark, C.ink, 0.6));
  p.px(lip.x + lip.w - 1, lip.y + lip.h - 1, mix(m.dark, C.ink, 0.6));
}

// The damp mark the unit leaves on the brick under it. The unit drips, the wall never dries out,
// and what is left is a moisture stain: the brick's own colour gone darker, at low alpha, so the
// coursing still shows through it — the opposite of a shadow, and nothing like a hole in the
// wall, because its darkest pixel is still brick and never ink. Its edge is a seeded wobble
// around a body that is widest a third of the way down, so it hangs under the unit as a lumpy
// patch instead of an ellipse, and two or three thin runs carry on below it, the way a stain
// keeps going once it finds the mortar.
function paintDampStain(p, box, mat = MAT.brick) {
  const rng = makeRng(CAFE.seed + 911);
  const tone = mix(mat.base, mat.dark, 0.7);
  for (let row = 0; row < box.h; row++) {
    const t = (row + 0.5) / box.h;
    const body = Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.4) / 0.72, 2)));
    const w = Math.max(3, Math.round(box.w * body - rng() * 2));
    const x0 = box.x + Math.round((box.w - w) / 2 + (rng() - 0.5) * 3);
    // the top row is where the water has been longest, so it is the one row a shade stronger
    p.hline(x0, box.y + row, w, rgba(tone, row === 0 ? 0.36 : 0.24 + rng() * 0.1));
    // the two ends of every row at half strength: a soft edge, never a drawn outline
    p.px(x0, box.y + row, rgba(tone, 0.15));
    p.px(x0 + w - 1, box.y + row, rgba(tone, 0.15));
  }
  // the runs under it: one px wide, short, and fading as they go, from the same seed
  for (let i = 0; i < box.streaks; i++) {
    const sx = box.x + 2 + Math.floor(rng() * (box.w - 4));
    const len = 2 + Math.floor(rng() * box.run);
    for (let row = 0; row < len; row++) {
      p.px(sx, box.y + box.h - 1 + row, rgba(tone, 0.2 - row * 0.022));
    }
  }
}

// -------------------------------------------------------- the ball (S22)

// The ball does not turn like a fan any more: three vanes on a sphere is a fan with a round
// housing, and at 10 px the eye reads blades, not a rotor. It carries a scrolling sinusoidal
// seam instead — a 1 px wavy line drawn twice inside the disc, half a period apart, its phase
// a whole step of its period per frame, so over the five frames the crests travel the width of
// the sphere and the surface reads as turning. `BALL_WAVE` is the amplitude in px: 1.5 keeps
// the line inside the disc's rows and still shows a crest, a trough and a crossing. The
// period is 1.6 balls wide, not one: a period that divided the ball exactly would make two
// frames mirror images of each other, and a seam that bounces is a seam that flickers.
const BALL_SEAMS = 2;
const BALL_WAVE = 1.5;
const BALL_PERIOD = 1.6;

// One frame of the ball ventilator, cached by (size, frame) and a pure function of the frame
// index: no clock, no random, so `?pause=1&sim=N` reproduces it exactly. The page blits it at
// `cafeLayout().flue.ball`, over the open mouth the flue's sprite left for it.
export function flueBallSprite(frame = 0) {
  const { size, frames } = CAFE.roof.ball;
  const n = Number(frame);
  const f = Number.isFinite(n) ? ((Math.round(n) % frames) + frames) % frames : 0;
  return cacheSprite(cache, `ball|${size}|${f}`, () => {
    const p = new Painter(size, size);
    const rows = fanRows(size);
    const m = MAT.metal;
    const steel = mix(m.lite, C.stoneLite, 0.5); // light grey, the same steel as the flue
    const lite = mix(steel, C.white, 0.6);
    const dark = mix(m.dark, C.ink, 0.3);
    // the sphere: a disc whose shoulders catch the light and whose foot is in shadow, with a
    // dark rim on both flanks so it separates from a day sky and a night one
    for (let i = 0; i < size; i++) {
      const x0 = Math.round((size - rows[i]) / 2);
      const w = rows[i];
      const col =
        i < 2 ? mix(steel, lite, 0.65) : i < 4 ? mix(steel, lite, 0.28) : i > 6 ? mix(steel, dark, 0.45) : steel;
      p.hline(x0, i, w, col);
      p.px(x0, i, mix(col, dark, 0.45));
      p.px(x0 + w - 1, i, mix(col, dark, 0.65));
    }
    // the seam: a sinusoid across the disc sampled column by column, its phase a whole step of
    // the period per frame, so the line scrolls round the sphere instead of flickering in
    // place. Two of them, half a period apart, read as one spiral; both are clipped to the
    // disc's own rows, so no pixel of the ball is ever drawn outside it
    const seam = mix(dark, m.dark, 0.4);
    for (let line = 0; line < BALL_SEAMS; line++) {
      const midY = Math.round(size / 2) - 2 + line * 3; // rows 3 and 6 of a 10 px ball
      const behind = line * 0.5;
      for (let x = 0; x < size; x++) {
        const theta = (x / (BALL_PERIOD * size) + f / frames + behind) * Math.PI * 2;
        const y = midY + Math.round(Math.sin(theta) * BALL_WAVE);
        if (y < 1 || y > size - 2) continue;
        const x0 = Math.round((size - rows[y]) / 2);
        if (x < x0 + 1 || x > x0 + rows[y] - 2) continue;
        p.px(x, y, seam);
      }
    }
    // the highlight, fixed because it is the light. Placed off the disc's centre, so a bigger
    // ball would still get it in the right place
    const hub = Math.floor((size - 1) / 2);
    p.px(hub - 2, hub - 2, lite);
    p.px(hub - 1, hub - 2, mix(lite, C.white, 0.45));
    p.px(hub - 2, hub - 1, lite);
    return p.sprite();
  });
}

// -------------------------------------------------------------- the smoke (S22)

// Four puffs walking one path: out of the flue's mouth, up and to the side, fading as they go.
// Four frames at 1.2 fps, so a puff takes over three seconds to cross the sprite — a cafe's
// kitchen, not a fire. The colour is a mid neutral kept low in alpha on purpose: it has to be
// read over the night sky and over the day sky alike, and a plume would be the wrong story.
//
// A puff is born 5 px across and is 12 across at the end of its life, and it fades as it
// grows: peak alpha is 0.65 at the mouth and a third of that by the time it has fully spread,
// so the widest, softest puff is the one furthest from the flue and the ball it rises behind
// never goes under anything solid. The path is a diagonal — 5 px up and 6 px across — and the
// four puffs are a quarter of a life apart on it, two rows of air between them all the way,
// which is a wisp and never a column.
//
// The rise is 5 and not 9 because the birth moved up 4: the puffs leave the top of the pipe now,
// not its mouth row, and the whole path has to fit the 14 rows the box has above the pipe's own
// 4. The tightest row is the top one — the widest puff, three quarters of the way along, has its
// middle on row 2 and its ragged edge on row 0 of the box — so nothing is ever clipped.
const SMOKE = { birth: 5, grown: 12, rise: 5, drift: 6, peak: 0.65 };

// One puff: a lumpy cluster, never a rectangle. Its rows are a round profile sampled by size,
// each row is staggered off the one under it, and the two end pixels of every row are painted
// at half strength — so the silhouette is ragged at every scale, and four of them merging along
// the path still leave a broken edge instead of a block. The outer rows are thinner and
// fainter than the middle one, which is what lets the smoke end in the sky and not on a line.
function paintPuff(p, grey, cx, cy, size, alpha, skew) {
  const half = Math.max(1, Math.round(size / 5)); // rows above and below the middle one
  for (let dy = -half; dy <= half; dy++) {
    const t = Math.abs(dy) / (half + 0.7);
    const outer = Math.abs(dy) === half;
    const w = Math.max(2, Math.round(size * Math.sqrt(Math.max(0, 1 - t * t))) - (outer ? 1 : 0));
    const a = alpha * (1 - t * 0.5);
    // the middle row stays on the path; the others lean with the puff, one way above and the
    // other below it, so no two rows line up into a bar
    const dx = dy === 0 ? 0 : dy > 0 === skew > 0 ? skew : -skew;
    const x0 = Math.max(0, Math.min(p.w - w, cx - Math.floor(w / 2) + dx));
    p.hline(x0 + 1, cy + dy, Math.max(1, w - 2), rgba(grey, a));
    p.px(x0, cy + dy, rgba(grey, a * 0.4));
    p.px(x0 + w - 1, cy + dy, rgba(grey, a * 0.4));
  }
}

export function smokeSprite(frame = 0) {
  const spec = CAFE.roof.smoke;
  const n = Number(frame);
  const f = Number.isFinite(n) ? ((Math.round(n) % spec.frames) + spec.frames) % spec.frames : 0;
  return cacheSprite(cache, `smoke|${spec.w}x${spec.h}|${f}`, () => {
    const { mouth, w, h } = cafeLayout().flue.smoke;
    const p = new Painter(w, h);
    const grey = mix(C.stoneLite, C.plaster, 0.4); // mid neutral: reads over a day sky and a night one
    for (let i = 0; i < spec.puffs; i++) {
      // each puff's own share of the seed: its wobble off the path, which way it skews and how
      // loud it is. Drawn fresh per frame from the same seed, so a puff's shape is stable while
      // its size and its place walk the path
      const rng = makeRng(CAFE.seed + 613 + i * 131);
      const wobble = Math.round((rng() - 0.5) * 2); // a px either way
      const skew = rng() < 0.5 ? -1 : 1;
      const loud = 0.9 + rng() * 0.2;
      // every puff runs the same path, a quarter of a life behind the one before it, so the
      // four of them read as one thin wisp and never as a cloud
      const phase = (f / spec.frames + i / spec.puffs) % 1;
      // a puff is drawn four times, and the last of those is three quarters of the way through
      // its life: the growth runs birth to grown across those drawn steps, so the widest puff
      // the eye ever gets is the full 12 and not the 10 a plain birth-to-grown lerp on 0.75
      // would leave it at. The four frames draw it at 5, 7, 10 and 12
      const drawn = 1 - 1 / spec.frames;
      const size = Math.round(
        SMOKE.birth + (SMOKE.grown - SMOKE.birth) * Math.min(1, phase / drawn),
      );
      const x = mouth.x - Math.round(phase * SMOKE.drift) + wobble;
      const y = mouth.y - Math.round(phase * SMOKE.rise);
      const core = SMOKE.peak * (1 - 0.65 * phase) * loud;
      paintPuff(p, grey, x, y, size, core, skew);
    }
    return p.sprite();
  });
}

// ------------------------------------------------------------------ the cat (S22)

const CAT_INK = mix(C.ink, C.hairInk, 0.5); // black, warmed a little by the wall's shadow
const CAT_RIM = mix(C.ink3, C.slate, 0.35); // the cool rim that keeps it off any sky
const CAT_EYE = C.lamp; // the only light in a black cat

// A cool rim on the sprite's own top-facing pixels. A black cat on a stone coping is a hole in
// the sky at 8x6 unless its top edge catches something, and there is no room to paint an
// outline round it, so it is derived from a snapshot and never feeds on itself.
function catRim(p, color) {
  const { ctx, w, h } = p;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 8;
  const top = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (solid(x, y) && !solid(x, y - 1)) top.push([x, y]);
  }
  for (const [x, y] of top) p.px(x, y, color);
}

// Walking, facing right: the tail up over the rump, the head a row above the body, and two
// legs swapping ends — all the walk an 8x6 sprite can carry, and enough to read as moving.
function paintCatWalk(p, frame) {
  p.px(0, 3, CAT_INK);
  p.px(0, 2, CAT_INK);
  p.px(1, 1, CAT_INK); // the tail: three px, up off the rump and curled forward
  p.rect(1, 3, 6, 2, CAT_INK); // the body, rows 3 and 4
  p.rect(5, 2, 3, 2, CAT_INK); // the head, a row above it, at the front
  p.px(6, 1, CAT_INK); // the ear
  if (frame % 2 === 0) {
    p.px(2, 5, CAT_INK); // the hind leg forward
    p.px(6, 5, CAT_INK); // and the front one under the head
  } else {
    p.px(3, 5, CAT_INK);
    p.px(5, 5, CAT_INK);
  }
}

// Sitting: the haunches wide, the chest narrower, the head with two ears and the two eyes that
// are the only thing in the sprite that is not black. Fully opaque, floor row 5.
function paintCatSit(p) {
  p.px(0, 4, CAT_INK);
  p.px(0, 5, CAT_INK);
  p.px(1, 5, CAT_INK); // the tail, curled round the base
  p.rect(1, 3, 6, 3, CAT_INK); // haunches and chest, rows 3 to 5
  p.rect(2, 1, 5, 2, CAT_INK); // the head, rows 1 and 2
  p.px(2, 0, CAT_INK); // the ears
  p.px(6, 0, CAT_INK);
  p.px(3, 2, CAT_EYE); // the two eyes, a px each, 2 px apart
  p.px(5, 2, CAT_EYE);
}

// Lying down: the loaf, low and long, the head resting at the front and the tail along the
// rump. Four rows tall against the sit's six, which is what makes the two poses tell apart.
function paintCatLie(p) {
  p.rect(1, 4, 7, 2, CAT_INK); // the body, rows 4 and 5
  p.rect(5, 3, 3, 1, CAT_INK); // the head, one row above the body, at the front
  p.px(6, 2, CAT_INK); // the ear
  p.px(0, 4, CAT_INK); // the tail, curled along the rump
  p.px(0, 5, CAT_INK);
}

// One pose of one cat, cached by (pose, walk frame, facing) and mirrored for the walk back.
export function catSprite({ pose = 'walk', frame = 0, facing = 1 } = {}) {
  const dir = facing < 0 ? -1 : 1;
  const f = pose === 'walk' ? Number(frame) & 1 : 0;
  return cacheSprite(cache, `cat|${pose}|${f}|${dir}`, () => {
    const p = new Painter(CAFE.roof.cat.w, CAFE.roof.cat.h);
    if (pose === 'sit') paintCatSit(p);
    else if (pose === 'lie') paintCatLie(p);
    else paintCatWalk(p, f);
    catRim(p, CAT_RIM);
    const sprite = p.sprite();
    return dir === 1 ? sprite : mirror(sprite);
  });
}

// The cat's routine as a state: its pose, its walk frame, the way it faces and the x its box
// lands on, snapped to whole art px. One clock, the same one the fan uses, so the 220 s cycle
// of CAFE is the only thing that decides where the cat is — nothing here reads a timer.
export function catState(timeSec, frozen = false) {
  const { cat } = CAFE.roof;
  const L = cafeLayout().cat;
  const cycle = cat.routine.reduce((total, phase) => total + phase.secs, 0);
  const t = frozen ? 0 : Math.max(0, Number(timeSec) || 0) % cycle;
  let start = 0;
  let phase = cat.routine[cat.routine.length - 1];
  for (const step of cat.routine) {
    if (t < start + step.secs) {
      phase = step;
      break;
    }
    start += step.secs;
  }
  const u = Math.min(1, Math.max(0, (t - start) / phase.secs));
  const fromX = L[phase.from ?? phase.at];
  const toX = L[phase.to ?? phase.at];
  const x = Math.round(fromX + (toX - fromX) * u);
  const facing = phase.pose !== 'walk' ? -1 : toX > fromX ? 1 : -1;
  const frame = phase.pose === 'walk' ? Math.floor(t * cat.gaitFps) % 2 : 0;
  return { pose: phase.pose, frame, facing, x, y: L.y, secs: phase.secs, cycle };
}

// ----------------------------------------------------------------- the list

// Everything in the café that moves, in the order the page draws it: the fan on the flat, the
// smoke off the flue, the ball the smoke comes out around and the cat on the parapet. The
// smoke goes down before the ball on purpose — the ball is bolted on the flue's mouth, so a
// puff rises behind it, and a puff that has spread to 12 px can never cover the ventilator it
// comes out of. Each entry carries its own frame rule and its own place — `at` is in the
// painters' own coordinates, so a blit can never drift from the pixels the sprite cut for it —
// and the page owns one loop over this list instead of one copy of the same code per animation.
export function cafeAnimations() {
  const L = cafeLayout();
  const looping = (key, at, spec, sprite) => ({
    key,
    at,
    frames: spec.frames,
    fps: spec.fps,
    place: (timeSec, frozen = false) => ({
      sprite: sprite(cycleFrame(timeSec, spec, frozen)),
      x: at.x,
      y: at.y,
    }),
  });
  return [
    looping('acfan', L.ac.fan, CAFE.ac.fan, acFanSprite),
    looping('smoke', L.flue.smoke, CAFE.roof.smoke, smokeSprite),
    looping('ventball', L.flue.ball, CAFE.roof.ball, flueBallSprite),
    {
      key: 'cat',
      at: L.cat,
      frames: 2,
      fps: CAFE.roof.cat.gaitFps,
      // the cat is the one moving thing whose place comes from the clock too: its routine is
      // the data, and its x is read off it, not interpolated somewhere else
      place(timeSec, frozen = false) {
        const state = catState(timeSec, frozen);
        return { sprite: catSprite(state), x: state.x, y: state.y };
      },
    },
  ];
}

// ---------------------------------------------------------------- interior

function paintInterior(p, L) {
  const { glass, floorY } = L;
  const { interior } = MAT;
  const bottom = glass.y + glass.h;
  p.rect(glass.x, glass.y, glass.w, glass.h, interior.wall);
  // the wall is darker where the ceiling is, which is where a cafe is dimmest
  for (let i = 0; i < 7; i++) {
    p.hline(glass.x, glass.y + i, glass.w, mix(interior.wall, interior.wallTop, 1 - i / 7));
  }
  // wainscot: a pale board along the back wall, its rail at floor+34, so the dark
  // furniture and the cups in front of it have something to silhouette against
  const rail = Math.max(glass.y + 8, floorY - 34);
  p.rect(glass.x, rail, glass.w, bottom - rail, interior.dado);
  p.hline(glass.x, rail - 1, glass.w, mix(C.wood, C.woodLite, 0.5));
  p.hline(glass.x, rail + 1, glass.w, mix(interior.dado, C.ink, 0.2));
  for (let x = glass.x + 4; x < glass.x + glass.w; x += 7) {
    p.vline(x, rail + 2, bottom - rail - 2, mix(interior.dado, C.ink, 0.14));
  }
  // a menu board, hung from the head of the glass on the door side
  const bx = glass.x + 14;
  const by = glass.y + 5;
  p.rect(bx - 2, by - 2, 30, 20, MAT.frame.base);
  p.rect(bx, by, 26, 16, mix(C.ink2, C.roofGreenDark, 0.4));
  for (let i = 0; i < 5; i++) {
    const len = 6 + ((i * 5) % 12);
    p.hline(bx + 3, by + 2 + i * 3, len, i === 0 ? C.lampWarm : mix(C.plaster, C.white, 0.35));
  }
  // shelves with cups and bottles, on the window side
  const shelfX = glass.x + glass.w - 52;
  for (let shelf = 0; shelf < 2; shelf++) {
    const sy = floorY - 46 + shelf * 9;
    p.rect(shelfX, sy, 46, 2, MAT.wood.base);
    p.hline(shelfX, sy, 46, MAT.wood.lite);
    for (let i = 0; i < 6; i++) {
      const col = i % 2 ? C.stoneLite : C.brickLite;
      p.rect(shelfX + 3 + i * 7, sy - 4, 3, 4, col);
      p.px(shelfX + 3 + i * 7, sy - 4, mix(col, C.white, 0.4));
    }
  }
  // one pendant lamp over the middle bay, hung from above the window head
  const cx = L.tables[1].cx;
  p.vline(cx, glass.y, 14, MAT.metal.dark);
  p.rect(cx - 5, glass.y + 13, 10, 5, MAT.metal.base);
  p.hline(cx - 5, glass.y + 13, 10, MAT.metal.lite);
  p.rect(cx - 3, glass.y + 18, 6, 1, C.lamp);
  for (let i = 1; i <= 12; i++) {
    p.rect(cx - 5 - i, glass.y + 19, 10 + i * 2, 3, rgba(interior.glow, 0.055));
  }
}

function paintTableGroup(p, L, group) {
  const { floorY } = L;
  const { table, person } = CAFE;
  const { back: backW, backH, seat } = table.bench;
  const seatY = floorY - person.seat; // the bench's seat plank, 8 above the floor
  const topY = floorY - table.top; // the tabletop's surface, 14 above the floor
  const b = group.bench;
  // one bench back for two tables: 2 px between this group and the one behind it, rising
  // 10 above the seat, so it stands 4 over the tabletop and reads as a bench, not a chair.
  // A shade off the window's own wood, so the 2 px of bench never reads as the mullion.
  const backCol = mix(C.wood, C.woodDark, 0.45);
  p.rect(b.backX, seatY - backH, backW, backH + seat, backCol);
  p.vline(b.backX, seatY - backH, backH + seat, mix(backCol, C.woodLite, 0.35));
  p.hline(b.backX, seatY - backH, backW, mix(C.woodLite, C.white, 0.3));
  // the seat planks, one on each side of that back: a bench, so the two diners sit on it
  // back to back and neither needs a chair of their own
  for (const side of [-1, 1]) {
    const sx = side < 0 ? b.backX - 10 : b.backX + backW;
    p.rect(sx, seatY, 10, seat, mix(C.wood, C.woodLite, 0.3));
    p.hline(sx, seatY, 10, mix(C.woodLite, C.white, 0.28));
    p.vline(side < 0 ? sx : sx + 9, seatY + seat, floorY - seatY - seat, mix(C.woodDark, C.ink, 0.25));
  }
  // legs, then the top: a 16 wide table whose surface is at floor+14, so the diner behind it
  // and the one in front of it each lean a few pixels over its edge
  const tx = group.tableX;
  const tw = group.tableW;
  const legH = table.top - table.slab;
  for (const side of [-1, 1]) {
    const lx = side < 0 ? tx + 2 : tx + tw - 4;
    p.rect(lx, topY + table.slab, 2, legH, MAT.wood.base);
    p.vline(lx, topY + table.slab, legH, mix(C.wood, C.woodLite, 0.25));
  }
  p.rect(tx, topY, tw, table.slab, mix(C.wood, C.woodLite, 0.45));
  p.hline(tx, topY, tw, mix(C.woodLite, C.white, 0.3));
  p.hline(tx, topY + table.slab - 1, tw, C.woodDark);
  // two cups, one for each seat, sitting on the tabletop: three pixels wide, a lit rim
  // and a shadowed side, so a cup reads on a pale wall at 2 physical px per art px
  const cupY = topY - table.cup;
  for (const side of [-1, 1]) {
    const ux = side < 0 ? tx + 3 : tx + tw - 6;
    p.rect(ux, cupY, 3, table.cup, mix(C.plasterLite, C.white, 0.45));
    p.hline(ux, cupY, 3, C.white);
    p.vline(side < 0 ? ux : ux + 2, cupY + 1, table.cup - 1, C.stone);
    // the handle, on the side that faces the middle of the table
    p.px(side < 0 ? ux + 3 : ux - 1, cupY + 1, mix(C.stone, C.white, 0.3));
    p.hline(ux, cupY + table.cup - 1, 3, mix(C.stone, C.ink, 0.18));
    // the saucer's shadow on the wood
    p.hline(ux - 1, topY, 5, mix(C.ink3, C.wood, 0.3));
  }
  // the pendant's pool of light on the floor between the benches
  p.rect(group.cx - 6, floorY - 2, 12, 2, rgba(C.lampWarm, 0.1));
}

// The glass: a cool tint over the warm room, plus two reflections of the sky. Exported so
// the scene can put a person behind the same glass instead of guessing the tint.
export function cafeGlassTint(ctx, L = cafeLayout()) {
  const { glass } = L;
  ctx.fillStyle = rgba(C.glass, 0.22);
  ctx.fillRect(glass.x, glass.y, glass.w, glass.h);
  // a little colder at the head of the glass, where the sky sits in it
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = rgba(C.glassLite, 0.035);
    ctx.fillRect(glass.x, glass.y, glass.w, 8 - i);
  }
  for (let i = 0; i < glass.h; i += 1) {
    for (const [off, alpha] of [
      [16, 0.045],
      [70, 0.03],
    ]) {
      const x = glass.x + off + i;
      if (x + 3 < glass.x + glass.w) {
        ctx.fillStyle = rgba(C.white, alpha);
        ctx.fillRect(x, glass.y + i, 3, 1);
      }
    }
  }
}

function paintWindow(p, L, people) {
  const { win, glass } = L;
  const frame = MAT.frame;
  // the brick above the window head, carried up to the slab: a soldier course, the way a
  // brick lintel is built, so no stone band is needed over a shop window
  soldierCourse(p, win.x - 3, L.ceilingY, win.w + 6, win.y - L.ceilingY);
  // the frame first, so the glazing sits in it
  p.rect(win.x, win.y, win.w, win.h, frame.base);
  p.hline(win.x, win.y, win.w, frame.lite);
  p.vline(win.x, win.y, win.h, frame.lite);
  p.vline(win.x + win.w - 1, win.y, win.h, frame.dark);
  p.hline(win.x, win.y + win.h - 1, win.w, frame.dark);
  // everything inside the glass, cut by the glazing: the lowest rows of the sill wall would
  // hide legs and table feet, exactly as they would from the pavement
  p.ctx.save();
  p.ctx.beginPath();
  p.ctx.rect(glass.x, glass.y, glass.w, glass.h);
  p.ctx.clip();
  paintInterior(p, L);
  // the diner behind each table goes down before the table, the one in front of it after:
  // that is what lets two 14 people and a 16 table share a 38 pane with each of them leaning
  // over one of the table's edges
  for (const person of people) if (person.behind) paintPerson(p, person);
  for (const group of L.tables) paintTableGroup(p, L, group);
  for (const person of people) if (!person.behind) paintPerson(p, person);
  p.ctx.restore();
  // the glass over it, then the bars: a tint never sits on top of a mullion
  cafeGlassTint(p.ctx, L);
  for (const bar of L.bars) {
    p.rect(bar, glass.y, CAFE.window.mullionBar, glass.h, frame.base);
    p.vline(bar, glass.y, glass.h, frame.lite);
    p.vline(bar + CAFE.window.mullionBar - 1, glass.y, glass.h, frame.dark);
  }
  // the stone sill: two rows over the frame's own bottom rail, standing out past the wall,
  // so the glazing keeps its whole 44 rows. Under it five rows of brick, then the 5 px
  // plinth: the window touches neither the plinth below nor the string course above
  const sillY = win.y + win.h - 2;
  p.rect(win.x - 3, sillY, win.w + 6, 2, MAT.stone.base);
  p.hline(win.x - 3, sillY, win.w + 6, MAT.stone.lite);
  p.hline(win.x - 3, sillY + 1, win.w + 6, MAT.stone.dark);
}

// One person, at the seat the layout gave them; the sprite is cached by pose and facing.
function paintPerson(p, person) {
  const sprite = personSprite({ pose: person.pose, facing: person.facing, seed: person.seed ?? 0 });
  p.ctx.drawImage(sprite.canvas, person.x, person.y);
}

// ---------------------------------------------------------- ground floor

// A cafe's door, not a house's: a wood architrave against the brick, a leaf that is mostly
// glass, a mid rail with the brass, a panelled apron over a brass kick plate, and the stone
// step it stands on. The wall lamp above it stays.
function paintDoor(p, L) {
  const { door, floorY } = L;
  const { door: d } = CAFE;
  const f = door.frame;
  const mat = MAT.wood;
  const x = door.x;
  const y = door.y;
  // the architrave: wood, lit on the outside edge and dark where it turns into the wall
  p.rect(x - f, y - f, d.w + f * 2, d.h + f, MAT.frame.base);
  p.hline(x - f, y - f, d.w + f * 2, MAT.frame.lite);
  p.vline(x - f, y - f, d.h + f, MAT.frame.lite);
  p.vline(x + d.w + f - 1, y - f, d.h + f, MAT.frame.dark);
  // the leaf: two stiles, a head rail, and the glass that is most of the door
  p.rect(x, y, d.w, d.h, mat.base);
  p.vline(x, y, d.h, mat.lite);
  p.vline(x + d.w - 1, y, d.h, mat.dark);
  p.hline(x, y, d.w, mix(mat.lite, C.white, 0.2));
  const gx = x + d.stile;
  const gw = d.w - d.stile * 2;
  const gy = y + d.rail;
  const glassH = d.h - d.rail * 2 - d.kick - 9;
  // the glazed panel: the cafe's room behind it, cold at the head where the sky sits in the
  // glass, warm at the foot where the room does, and two reflections so it reads as glass
  p.rect(gx, gy, gw, glassH, mix(C.glass, C.ink, 0.12));
  p.dither(gx, gy, gw, Math.round(glassH * 0.45), rgba(C.glassLite, 0.16), mix(C.glass, C.ink, 0.12), 1);
  p.rect(gx, gy + glassH - 8, gw, 8, rgba(C.lampWarm, 0.2));
  p.rect(gx, gy + glassH - 13, gw, 3, rgba(C.lampWarm, 0.1));
  p.rect(gx, gy, gw, 3, rgba(C.glassLitSoft, 0.14));
  for (const [off, alpha] of [
    [2, 0.18],
    [6, 0.1],
  ]) {
    for (let i = 0; i < glassH - 4; i++) {
      const sx = gx + off + Math.round(i * 0.6);
      if (sx + 1 < gx + gw) p.rect(sx, gy + 1 + i, 2, 1, rgba(C.white, alpha));
    }
  }
  p.vline(gx - 1, gy - 1, glassH + 2, mat.line);
  p.vline(gx + gw, gy - 1, glassH + 2, mat.line);
  // the mid rail, with the brass pull hanging off it
  const midY = gy + glassH;
  p.rect(x, midY, d.w, d.rail, mix(C.wood, C.woodLite, 0.3));
  p.hline(x, midY, d.w, mix(C.woodLite, C.white, 0.25));
  p.hline(x, midY + d.rail - 1, d.w, mat.line);
  const hx = x + d.w - d.stile - 2;
  p.rect(hx, midY - 6, 2, 13, MAT.brass.base);
  p.vline(hx, midY - 6, 13, MAT.brass.lite);
  p.vline(hx + 1, midY - 6, 13, MAT.brass.dark);
  p.rect(hx - 1, midY - 7, 4, 1, MAT.brass.dark);
  p.rect(hx - 1, midY + 7, 4, 1, MAT.brass.dark);
  // the panelled apron, then the brass kick plate, then the bottom rail
  const aprY = midY + d.rail;
  p.rect(x + 1, aprY, d.w - 2, d.kick + 2, mix(C.wood, C.woodDark, 0.35));
  for (let i = 0; i < 2; i++) {
    const px = x + d.stile - 1 + i * (gw - 1);
    p.vline(px, aprY + 1, d.kick, mat.line);
  }
  const kickY = aprY + d.kick + 2;
  const kickH = Math.max(2, d.h - (kickY - y) - 3);
  p.rect(x + 1, kickY, d.w - 2, kickH, MAT.brass.dark);
  p.hline(x + 1, kickY, d.w - 2, MAT.brass.base);
  p.hline(x + 1, kickY + kickH - 1, MAT.brass.dark);
  p.rect(x, floorY - 3, d.w, 3, mat.dark);
  // the step: stone, wider than the frame, sitting on top of the plinth. The leaf now ends on
  // the plinth's own top row, so the door reads as standing on the stone and not behind it
  const stepY = L.plinthTop - d.step;
  p.rect(x - f - 4, stepY, d.w + f * 2 + 8, d.step, MAT.stone.base);
  p.hline(x - f - 4, stepY, d.w + f * 2 + 8, MAT.stone.lite);
  p.hline(x - f - 4, stepY + d.step - 1, d.w + f * 2 + 8, MAT.stone.dark);
  // the wall lamp over the door: one practical, the warmest thing on the facade
  const lx = Math.round(door.centre - 5);
  const ly = y - 12;
  p.rect(lx + 4, ly + 4, 2, 6, MAT.metal.dark);
  p.rect(lx, ly, 10, 4, MAT.metal.base);
  p.hline(lx, ly, 10, MAT.metal.lite);
  p.rect(lx + 2, ly + 4, 6, 1, C.lamp);
  for (let i = 1; i <= 8; i++) p.rect(lx + 2 - i, ly + 4, 6 + i * 2, 2, rgba(C.lampWarm, 0.045));
}

function paintGround(p, L, people) {
  const { floorY, ceilingY, plinthTop } = L;
  const w = CAFE.width;
  const { protrude, base } = CAFE;
  // the whole ground floor is one brick wall; the window and the door are cut into it
  brickFace(p, 0, ceilingY, w, floorY - ceilingY, { seed: CAFE.seed + 1 });
  // the string course above throws its shadow on the top of this wall
  bandShadow(p, 0, ceilingY, w, 3);
  // a downpipe on the far pier: the one thing that keeps a 192 wide wall from being a slab.
  // It stops on the plinth, the way a downpipe does.
  const pipeTop = ceilingY + 4;
  const pipeH = plinthTop - pipeTop;
  p.rect(w - 14, pipeTop, 3, pipeH, MAT.metal.base);
  p.vline(w - 14, pipeTop, pipeH, MAT.metal.lite);
  p.vline(w - 12, pipeTop, pipeH, MAT.metal.dark);
  paintDoor(p, L);
  paintWindow(p, L, people);
  // The plinth: one 5 px band of stone over the bottom of the facade, across the full 192 and
  // 3 proud either side, drawn last so nothing cuts it — not the window (its frame starts 10
  // above the floor) and not the door (its leaf runs down behind the stone, and its step is
  // drawn on the top of the band, not through it). It sits inside the 172:
  // the pavement starts on the row under its last one, so the floor line is the street line.
  stoneBand(p, -protrude.plinth, plinthTop, w + protrude.plinth * 2, base, MAT.stone);
  // one course joint through the middle of the band and a few vertical joints, so 5 px of
  // stone still read as a course and not as a drawn line. Fixed seed: the same plinth every
  // run.
  const joints = makeRng(CAFE.seed + 29);
  const bandW = w + protrude.plinth * 2;
  over(p, -protrude.plinth, plinthTop + Math.round(base / 2), bandW, 1, mix(MAT.stone.base, MAT.stone.dark, 0.4));
  for (let jx = 14; jx < bandW - 10; jx += 18 + Math.floor(joints() * 11)) {
    over(p, -protrude.plinth + jx, plinthTop + 1, 1, base - 2, mix(MAT.stone.base, MAT.stone.dark, 0.28));
  }
}

// ------------------------------------------------------------------ sprite

// The whole building: terrace, flat, and the ground floor seen through its own glass. Any
// people handed in are composited inside the window before the tint, so a person behind
// the glass is as cool as the room behind them. The canvas is wider than the 192 by the
// widest overhang, and the facade starts `bleed` in.
export function cafeSprite({ people = [] } = {}) {
  const key = `cafe|${people
    .map((s) => `${s.pose ?? 'seat'}${s.facing ?? 1},${Math.round(s.x)},${Math.round(s.y)},${s.seed ?? 0}`)
    .join(';')}`;
  return cacheSprite(cache, key, () => {
    const L = cafeLayout();
    const p = new Painter(L.canvasW, L.h);
    p.ctx.translate(L.bleed, 0);
    paintRoof(p, L);
    paintFlat(p, L);
    paintGround(p, L, people);
    p.outlineSelective(0.42);
    return p.sprite();
  });
}
