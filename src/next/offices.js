// The offices, the tallest building on the street, drawn instead of massed. The block that
// stood here was an ink mass with a floor cadence; this is the same 302x326, painted: four
// storeys of 64 between 10 px slabs, the glass held between two brick piers, the lift standing
// inside behind that glass at the left, and a roof parapet.
//
// The contract lives in OFFICES and nowhere else. The street's block takes its height from
// these numbers (4 * (64 + 10) + 30 = 326), every x and y in the painters is derived from
// them, and the page places the sprite by its bottom row, so the ground floor's floor is the
// street's own line.
//
//   storey       floor 64 to the underside of the slab above it, slab 10. Four of them, so
//                4 * 74 = 296 of building and 30 of roof: the block's own 326.
//   piers       the building's own brick, full height, with the coping running over both: 14 px
//                at the left (0..13) and 30 at the right (272..301). The left one is the corner
//                the alley's unlit wall meets, lit down its outer arris so the two walls never
//                read as one; the right one is the party wall to the gym, and it is the one
//                that carries the masonry detail — a downpipe and the opening bricked up in it.
//                Between them the glass, and no other wall on the facade.
//   glazing     continuous across the width between the piers, 14..271: 13 panes of 18 on a 2 px
//                dark metal bar, a 20 px pitch, still denser than the gym's 22. The bars are the
//                same columns on all four floors, which is half of why the storeys read as one
//                building; the other half is the slab band.
//   lift        one shaft, 44 wide, inside the building hard behind the left end of the glass
//                (11..54: its left 3 px stand behind the corner pier), its own masonry face and
//                the same columns on every floor: the opening 24 wide at 21..44, the steel
//                rebate round it, the indicator over it, the call plate on the brick beside it,
//                and the car standing open on the ground floor. The shaft is placed so the seam
//                the two leaves meet on falls under the first mullion — the bar reads as that
//                seam and never cuts a leaf — and the doors are behind glass on every floor,
//                which is what says the lift is inside and not bolted to the front. There is no
//                stair: an agent that moves between floors uses this and nothing else, so it is
//                one column and never four different ones.
//   slab band   the 10 rows between two storeys, in ribbed dark cladding across the glazing: the
//                heaviest horizontal in the building, the band that ties the two brick piers to
//                each other and to the glass. It is also what makes this building not the gym.
//   roof        the top slab, then 30 rows: a parapet wall in the piers' own brick — the same
//                courses, so the roof is the same mass the piers are — under a 3 px stone
//                coping that runs the whole width. Nothing rises past it now that the lift is
//                inside: the silhouette is flat, and the two piers are the building's bookends.
//   rooms       floor 0 is the entrance only. Floors 1 and 2 are split in two by a 3 px glass
//                partition with a door in it (153..155, the same column on both), and floor 3
//                is one open plan. Each room's furnishing is derived from its state, so a
//                floor is not a list of x's: `plan` says which state each room is, and
//                furnish() decides what stands in it. Ground floor 55..271 is the lobby (the
//                shaft's masonry is its own left wall), floors 1 and 2 are 98 + 3 + 116, floor
//                3 is 217 wide. The rooms are narrower than they were because the piers are
//                masonry now, so every desk run, board and plant is placed off its own room and
//                drops what no longer fits instead of being kept at a hand-written x.
//   style       modern industrial: dark metal frames and a dense mullion rhythm, ribbed dark
//                cladding at the slabs, masonry bookends and a lift shaft in the building's own
//                tocho behind the glass, warm plaster inside, a dark timber floor, wood-and-metal
//                desks, a duct and linear pendants per floor. The corporate accent appears
//                exactly once, on the plate over the lift doors.
//
// The premise is a prototype, and the priority order is the one it was asked in: the four
// floors and the lift line up and read as one building; each floor reads as a different room
// at 2 physical px per art px; the style is industrial and not the gym; the furniture is
// recognisable and will be corrected.
//
// Deterministic: fixed seeds, no clock, no Math.random, no colour literal. Coordinates: a
// sprite pixel is an art pixel, y grows down, and the sprite's bottom row is the ground line.

import { Painter, cacheSprite } from '../pixel.js';
import { drawText, lineWidth, FONTS } from '../font.js';
import { C, mix, rgba } from './palette.js';
import { makeRng } from '../rng.js';

const cache = new Map();

export const OFFICES = {
  width: 302,
  storeys: 4,
  floor: 64, // the floor line to the underside of the slab above it
  slab: 10, // the band between two storeys, and the roof's own slab
  // above the top slab: a brick parapet between the piers, under one stone coping that runs
  // the whole width. Nothing rises past it: the lift is inside now, so the silhouette is flat
  roof: { band: 30, coping: 3 },
  // the masonry the glass is held between, in the building's own brick: the corner pier the
  // alley's wall meets, and the party wall to the gym
  piers: { left: 14, right: 30 },
  // the lift: one shaft inside the building at the left, the same columns on every floor
  lift: {
    w: 44, // its face: 11..54, from the pavement to the roof, its left 3 px behind the pier
    door: 24, // the opening, centred in the 44: it never moves, so the floors line up
    doorH: 40, // a person is 30 tall and a storey 64: the door is 40 on every floor
    frame: 2, // the steel rebate round the opening
    open: 4, // on the ground floor the two leaves are retracted to 4 px at each jamb
    indicator: { w: 10, h: 4, inset: 1 }, // over the doors, one per floor, clear of a mullion
    call: { inset: 38, w: 3, h: 5 }, // on the shaft's brick, past the opening's rebate
    // the company's mark, over the ground floor's doors only: one pane wide, so the mullion
    // frames it instead of cutting the accent in two
    plate: { w: 18, h: 8, top: 60 },
  },
  // the mullion grid all four floors are cut on: 18 of glass, 2 of dark metal, 20 px pitch
  grid: { pane: 18, bar: 2, panes: 13 },
  transom: 3, // the frame under every slab, across the glazing
  // a sooty running bond, 7 x 3: the two piers and the lift's shaft, and nothing else
  brick: { w: 7, h: 3, joint: 1, bond: 4 },
  // the party wall's two details: the downpipe down its outer side, and the opening bricked up
  // low in it. Both are in px and none of the parts is under 3, so they survive 2 px per art px
  // without turning into texture noise.
  pierDetail: {
    pipe: { inset: 5, w: 2, hopper: { w: 6, h: 4 }, bracket: { w: 4, every: 30 } },
    blocked: { inset: 2, w: 14, h: 26, lintel: 2, sill: 1, lift: 6 },
  },
  // the two split floors: one partition, the same column on both, with a door in it
  split: { share: 0.46, w: 3, doorH: 38 },
  // the entrance: two panes of glass become a double door, so the lobby reads from the street
  // without the skin losing its rhythm. Panes 4 and 5 — clear of the lift's bay and of the
  // lobby's first plant — and the bar between them is the meeting stile.
  entrance: { pane: 4, panes: 2, stile: 2, foot: 3, pull: { top: 28, h: 16 } },
  // the industrial ceiling of every room: a duct with its collars, and linear pendants
  ceiling: {
    soffit: 6, // the shade under the transom, before the duct
    duct: { h: 4, gap: 1, ring: 44, inset: 6 },
    lamp: { drop: 4, housing: 3, w: 20, glow: 4 },
  },
  // The room's own name, on a plate in the band above its window. Only the states listed here are
  // labelled, so a room can be left unlabelled by deleting one line: the face is the tiny 3x5
  // stencil, the smallest one that still reads at 2 physical px per art px.
  labels: {
    entering: 'ENTRANCE',
    planning: 'PLANNING',
    implementing: 'IMPLEMENTING',
    exploring: 'EXPLORING',
    deciding: 'DECIDING',
    working: 'WORKING',
  },
  label: { padX: 3, padY: 1, spacing: 2 },
  // the rooms, bottom up. The state is the agent task the room is for, and it is the only
  // thing a floor says about itself: what stands in a room is derived from this word.
  plan: [
    { floor: 0, rooms: ['entering'] },
    { floor: 1, rooms: ['planning', 'implementing'] },
    { floor: 2, rooms: ['exploring', 'deciding'] },
    { floor: 3, rooms: ['working'] },
  ],
  furniture: {
    desk: {
      w: 24,
      gap: 8, // 32 pitch: how many desks a room holds is this number, not a hand count
      margin: 6,
      top: 14, // the desktop above the floor
      slab: 3,
      monitor: { w: 9, h: 9 },
      chair: { w: 6, h: 7 },
    },
    plant: { w: 12, h: 18 },
    tallPlant: { w: 16, h: 28 },
    whiteboard: { w: 46, h: 15, tray: 2, hang: 24 },
    pinboard: { w: 40, h: 14, tray: 2, hang: 28 },
    screen: { w: 34, h: 18, hang: 30 },
    table: { w: 34, top: 12, slab: 3, seats: 2 },
    longTable: { w: 64, seats: 4 },
    copier: { w: 20, h: 26 },
    shelf: { w: 26, h: 18 },
    cabinet: { w: 30, h: 16 },
    sofa: { w: 34, h: 14 },
    tv: { cabinet: { w: 22, h: 10 }, panel: { w: 20, h: 9 } },
    bench: { w: 26, h: 8 },
    counter: { w: 56, top: 26, monitor: { w: 12, h: 8 }, phone: 3 },
    mat: { w: 24 },
    lounge: { w: 88 }, // the working floor's corner, with the sofa and the TV in it
  },
  seed: 6047,
};

// ---------------------------------------------------------------- materials

const MAT = {
  // the dark metal of the frames, the mullions, the returns and the ribs of the cladding.
  // The gym is steel too, but light and cold; this is nearer to iron, and warmer
  frame: {
    base: mix(C.metalDark, C.slate, 0.26),
    lite: mix(C.metal, C.metalLite, 0.42),
    dark: mix(C.metalDark, C.ink, 0.5),
  },
  // the band at every slab line and the parapet: a ribbed dark panel, not the gym's pale one
  clad: {
    base: mix(C.metalDark, C.slate, 0.34),
    lite: mix(C.metal, C.slate, 0.34),
    dark: mix(C.ink2, C.ink, 0.32),
    rib: mix(C.metalDark, C.ink, 0.3),
  },
  // exposed brick, sooty and darker than the café's: the lift spine is the one wall in this
  // building that is not metal or glass
  brick: {
    base: mix(C.brick, C.woodDark, 0.5),
    lite: mix(C.brickLite, C.wood, 0.4),
    dark: mix(C.brickDark, C.ink, 0.4),
    mortar: mix(C.slate, C.stone, 0.4),
    tocho: mix(C.stoneLite, C.sand, 0.35),
  },
  stone: {
    base: mix(C.stoneLite, C.sand, 0.3),
    lite: mix(C.stoneLite, C.white, 0.3),
    dark: mix(C.stone, C.ink, 0.28),
  },
  // the rooms: warm plaster, a dark timber floor, a dark ceiling. Everything the gym's cold
  // veiled hall is not
  room: {
    // warm plaster, not grey: a room with a warm wall behind it and one with a neutral one are
    // the same building at this scale, and this one has to read heavier and warmer than the gym
    wall: mix(C.plaster, C.plasterDark, 0.22),
    ceiling: mix(C.ink2, C.ink, 0.28),
    joint: mix(C.plasterDark, C.stone, 0.3),
    floor: mix(C.woodDark, C.ink, 0.3),
    floorLite: mix(C.wood, C.woodDark, 0.45),
  },
  wood: {
    base: mix(C.wood, C.woodLite, 0.22),
    lite: mix(C.woodLite, C.white, 0.16),
    dark: mix(C.woodDark, C.ink, 0.32),
  },
  duct: {
    base: mix(C.metal, C.stone, 0.36),
    lite: mix(C.metalLite, C.stoneLite, 0.3),
    dark: mix(C.metalDark, C.ink, 0.38),
  },
  // chairs, the sofa: dark wool, with a lit top edge so a back reads against the wall
  fabric: {
    base: mix(C.slate, C.ink, 0.36),
    lite: mix(C.slate, C.stone, 0.34),
    dark: mix(C.ink3, C.ink, 0.3),
  },
  // the light machines: a photocopier, a shelf, the reception's front
  machine: {
    base: mix(C.metalLite, C.stoneLite, 0.4),
    lite: mix(C.stoneLite, C.white, 0.2),
    dark: mix(C.metal, C.ink, 0.32),
  },
  // the lift's doors: brushed steel, lighter than the frames around them, because a door made
  // of the same value as its frame is a hole in the brick
  lift: {
    face: mix(C.metal, C.metalLite, 0.42),
    lite: mix(C.metalLite, C.stoneLite, 0.3),
    dark: mix(C.metalDark, C.slate, 0.3),
  },
  // the party wall's downpipe: cast iron gone dull, a value under the brick's so two px of it
  // read against the courses and not as another joint
  pipe: {
    base: mix(C.metalDark, C.slate, 0.16),
    lite: mix(C.metal, C.slate, 0.3),
    dark: mix(C.ink2, C.ink, 0.34),
  },
  screen: {
    bezel: mix(C.ink, C.metalDark, 0.42),
    face: mix(C.glass, C.ink, 0.4),
    lit: mix(C.glassLite, C.water, 0.35),
  },
  plant: { dark: C.grassDeep, base: C.grassDark, lite: C.grass, tip: C.grassLite },
  paper: { base: mix(C.plasterLite, C.white, 0.35), dark: mix(C.stoneLite, C.sand, 0.3) },
};

// The glass, as three numbers. Lighter than the gym's veil on purpose: these rooms are lit
// and the street has to see them, so the veil is the thinner one and the reflections do the
// work of saying "glass" instead.
const GLASS = { veil: 0.2, head: 0.04, refl: 0.055 };

// One wall tone per state, a step apart and no more: two rooms of a floor have to read as two
// spaces without either of them leaving the building.
const WALL_TONE = {
  entering: (wall) => mix(wall, C.plasterLite, 0.18),
  planning: (wall) => mix(wall, C.plaster, 0.22),
  implementing: (wall) => mix(wall, C.slate, 0.12),
  exploring: (wall) => mix(wall, C.plasterLite, 0.06),
  deciding: (wall) => mix(wall, C.wood, 0.14),
  working: (wall) => wall,
};

// ------------------------------------------------------------------- layout

let LAYOUT = null;

export function officesLayout() {
  if (LAYOUT) return LAYOUT;
  const { width, storeys, floor, slab, roof, lift, grid, piers, transom, split, entrance, plan } = OFFICES;

  const h = storeys * (floor + slab) + roof.band; // 326: the block's own height
  const pitch = grid.pane + grid.bar; // 20
  const glazedW = grid.panes * grid.pane + (grid.panes - 1) * grid.bar; // 258
  const glassX = piers.left; // 14: the glazing starts where the corner pier ends
  const glassRight = glassX + glazedW - 1; // 271
  const bars = Array.from({ length: grid.panes - 1 }, (_, i) => glassX + (i + 1) * grid.pane + i * grid.bar);
  // The shaft stands inside, hard behind the corner pier: 44 wide, its left 3 px behind the
  // brick. Its opening is centred in it, and the shaft is placed so the seam the two leaves
  // meet on falls under the first mullion — a bar then reads as that seam and never cuts a leaf.
  const inset = Math.round((lift.w - lift.door) / 2); // 10
  const half = Math.round(lift.door / 2); // 12
  const shaftX = bars[0] - (inset + half) + 1; // 11
  const openingX = shaftX + inset; // 21
  const roomsX = shaftX + lift.w; // 55: the shaft's masonry is the lobby's own left wall
  const roomsW = glassRight - roomsX + 1; // 217
  // the partition, the same column on both split floors: the room shares are the datum and
  // the x follows, so the two rooms of a floor cannot drift apart
  const leftW = Math.round((roomsW - split.w) * split.share); // 98
  const splitX = roomsX + leftW; // 153
  // the entrance: two panes of the bay, and the bar between the two leaves
  const doorX = glassX + entrance.pane * pitch; // 74
  const doorW = entrance.panes * grid.pane + (entrance.panes - 1) * grid.bar; // 38

  // the entrance, resolved once: its bay in the ground floor's glazing, which the lobby's mat
  // and the facade's door both stand on
  const doorRect = { x: doorX, w: doorW, pitch };

  const bands = plan.map(({ floor: index, rooms: states }) => {
    const top = h - index * (floor + slab) - floor; // 262, 188, 114, 40
    const row = top + floor - 1; // the row the room stands on: 325, 251, 177, 103
    const slabTop = top - slab; // the band this storey carries over itself
    const y = top + transom; // the top row of the glass
    const rects =
      states.length === 1
        ? [{ x: roomsX, w: roomsW }]
        : [
            { x: roomsX, w: leftW },
            { x: splitX + split.w, w: roomsW - leftW - split.w },
          ];
    const rooms = states.map((state, i) => {
      const rect = rects[i];
      const room = {
        state,
        x: rect.x,
        w: rect.w,
        top,
        row,
        y,
        h: row - y + 1,
        wall: (WALL_TONE[state] ?? ((w) => w))(MAT.room.wall),
        lamps: lampXs(rect),
      };
      room.props = furnish(room, index === 0 ? doorRect : null).sort((a, b) => (a.base ?? 0) - (b.base ?? 0));
      return room;
    });
    const doorTop = row - lift.doorH + 1;
    const ind = lift.indicator;
    const call = lift.call;
    return {
      index,
      states,
      top,
      row,
      y,
      slabTop,
      rooms,
      // the lift: the same numbers on every floor, which is the whole point of it
      lift: {
        x: openingX, // 21: the opening, in the shaft's masonry and behind the glass
        w: lift.door,
        top: doorTop,
        bottom: row,
        cab: index === 0, // the car stands open on the ground floor
        // the indicator sits just off the opening's left jamb, so no mullion cuts it in two
        indicator: { x: openingX + ind.inset, y: doorTop - 9, w: ind.w, h: ind.h },
        call: { x: shaftX + call.inset, y: row - 28, w: call.w, h: call.h },
        // the plate fills the glazing's first pane, over the lift's doors: the corporate accent
        // is the one saturated thing in the building and it must not be cut by a bar
        plate: index === 0 ? { x: glassX, y: row - lift.plate.top, w: lift.plate.w, h: lift.plate.h } : null,
      },
      // the entrance's two leaves, in the ground floor's glazing
      door: index === 0 ? doorRect : null,
    };
  });

  // the roof sits on the top storey's own slab, which is the highest band's
  const topSlab = bands[bands.length - 1].slabTop; // 30

  LAYOUT = {
    w: width,
    h,
    floor,
    slab,
    bands,
    glass: { x: glassX, w: glazedW, right: glassRight },
    bars,
    split: { x: splitX, w: split.w, doorH: split.doorH },
    // the shaft inside: its footprint, the brick of it that is actually seen through the glass
    // (its far left 3 px stand behind the corner pier), and the rows it runs between — under the
    // top storey's slab and down to the pavement. Its opening is the same column on every floor
    // and is carried by each band's own lift block.
    shaft: {
      x: shaftX,
      w: lift.w,
      faceX: glassX,
      faceW: shaftX + lift.w - glassX,
      top: topSlab + slab, // 40: under the top storey's slab
      bottom: h - 1,
    },
    // the masonry: two piers, full height, and the roof between them
    piers: [
      { side: 'left', x: 0, w: piers.left, seed: 3 },
      { side: 'right', x: glassRight + 1, w: piers.right, seed: 11 },
    ],
    pierBand: { top: roof.coping, bottom: h - 1 }, // 3..325: under the coping to the pavement
    parapet: { x: glassX, w: glazedW }, // 14..271, between the piers
    // the roof band above the top slab: the coping over the whole width, and the parapet's own
    // rows, which start under it — nothing rises past the coping any more
    roof: {
      copingTop: 0,
      coping: roof.coping,
      wallTop: roof.coping, // 3: the parapet's first row
      wallBottom: topSlab - 1, // 29
    },
  };
  return LAYOUT;
}

// How many pendants a room gets: one per 120 px of room, which is one for the two small rooms
// of the split floors and two for the lobby and the open plan.
function lampXs(rect) {
  const n = Math.max(1, Math.round(rect.w / 120));
  return Array.from({ length: n }, (_, i) => rect.x + Math.round((rect.w * (i + 0.5)) / n));
}

// A run of desks, centred in an area: the pitch is the contract's, so a wider room holds more
// desks and never airier ones.
function deskRun(area, tint = 0) {
  const d = OFFICES.furniture.desk;
  const pitch = d.w + d.gap;
  const n = Math.max(1, Math.floor((area.w - d.margin * 2 + d.gap) / pitch));
  const total = n * pitch - d.gap;
  const x0 = area.x + Math.round((area.w - total) / 2);
  return Array.from({ length: n }, (_, i) => ({
    kind: 'desk',
    x: x0 + i * pitch,
    w: d.w,
    base: area.base,
    tint,
  }));
}

// What stands in a room, from its state. Everything is placed from the room's own rect — and,
// on the ground floor, from where the entrance door actually is — so a room that changes width
// re-furnishes itself instead of keeping a hand-written x.
function furnish(room, door = null) {
  const { state, x, w, row } = room;
  const F = OFFICES.furniture;
  switch (state) {
    // the entrance: a counter facing the door, two tall plants, the mat the door opens onto and
    // a bench to wait on. No desks: this floor is the way in
    case 'entering': {
      const counterX = x + Math.round(w * 0.4);
      return [
        { kind: 'plant', tall: true, x: x + 10, w: F.tallPlant.w, base: row },
        { kind: 'mat', x: door ? door.x + Math.round((door.w - F.mat.w) / 2) : x + 88, w: F.mat.w, base: row },
        { kind: 'counter', x: counterX, w: F.counter.w, base: row },
        { kind: 'bench', x: counterX + F.counter.w + 10, w: F.bench.w, base: row },
        { kind: 'plant', tall: true, x: x + w - F.tallPlant.w - 4, w: F.tallPlant.w, base: row },
      ];
    }
    // planning: the wall is the room. A whiteboard with the plan on it, a table with two
    // chairs, and a plant
    case 'planning':
      return [
        { kind: 'whiteboard', x: x + 6, w: F.whiteboard.w, bottom: row - F.whiteboard.hang },
        { kind: 'table', x: x + 8, w: F.table.w, base: row, seats: F.table.seats },
        { kind: 'plant', x: x + w - F.plant.w - 6, w: F.plant.w, base: row },
      ];
    // implementing: desks with the machines on them, the photocopier and a plant at the right end
    case 'implementing': {
      const tail = F.copier.w + F.plant.w + 1; // what the machines take at the right end
      return [
        ...deskRun({ x, w: w - tail, base: row }),
        { kind: 'copier', x: x + w - tail, w: F.copier.w, base: row },
        { kind: 'plant', x: x + w - F.plant.w - 1, w: F.plant.w, base: row },
      ];
    }
    // exploring: the desks, a shelf of binders on the right, and the pinboard the findings go on
    case 'exploring': {
      const tail = F.shelf.w + F.plant.w + 2;
      return [
        { kind: 'pinboard', x: x + 6, w: F.pinboard.w, bottom: row - F.pinboard.hang },
        ...deskRun({ x, w: w - tail, base: row }),
        { kind: 'shelf', x: x + w - F.shelf.w - F.plant.w, w: F.shelf.w, base: row },
        { kind: 'plant', x: x + w - F.plant.w, w: F.plant.w, base: row },
      ];
    }
    // deciding: a long table with four chairs, the screen on the wall over it, a cabinet and the
    // plants at the ends — as many of those as the room can hold, since the rooms lost width to
    // the piers and a plant is what gets dropped, never the table
    case 'deciding': {
      const tableX = x + F.plant.w + 6;
      const tableEnd = tableX + F.longTable.w;
      const cabinetX = x + w - F.cabinet.w - 3;
      const props = [
        { kind: 'screen', x: tableX + 3, w: F.screen.w, bottom: row - F.screen.hang },
        { kind: 'plant', x: x + 2, w: F.plant.w, base: row },
        { kind: 'table', x: tableX, w: F.longTable.w, base: row, seats: F.longTable.seats },
        { kind: 'cabinet', x: cabinetX, w: F.cabinet.w, base: row },
      ];
      // the second plant, only when the gap between the table and the cabinet is a plant's own
      if (cabinetX - tableEnd >= F.plant.w + 6) {
        props.push({ kind: 'plant', x: tableEnd + 3, w: F.plant.w, base: row });
      }
      return props;
    }
    // working: one open plan, the biggest team. The lounge is the corner by the lift, then the
    // desks in front of it, and the plant at the far end. One row only: a second row behind it
    // read as desks floating in the room, because nothing at this scale says which floor they
    // stand on once the front row covers the timber.
    case 'working': {
      const lounge = x + 8;
      const desksX = x + F.lounge.w + 6;
      return [
        { kind: 'sofa', x: lounge, w: F.sofa.w, base: row },
        { kind: 'tv', x: lounge + F.sofa.w + 8, w: F.tv.cabinet.w, base: row },
        { kind: 'plant', x: lounge + F.sofa.w + F.tv.cabinet.w + 12, w: F.plant.w, base: row },
        ...deskRun({ x: desksX, w: x + w - desksX, base: row }),
        { kind: 'plant', x: x + w - F.plant.w - 2, w: F.plant.w, base: row },
      ];
    }
    default:
      throw new Error(`offices: no furnishing for room state "${state}"`);
  }
}

// ------------------------------------------------------------------ helpers

// A running bond, keyed to the sprite's own y so every panel of masonry shares one grid. `lit`
// lifts the whole face toward the brick's own light tone: that is how the shaft inside the
// building is painted, the same tocho as the piers on the street, one step closer to the room
// light that falls on it.
function brickFace(p, x, y, w, h, seed, lit = 0) {
  const { w: bw, h: bh, joint, bond } = OFFICES.brick;
  const courseH = bh + joint;
  const pitch = bw + joint;
  const mat = MAT.brick;
  const tone = (col) => (lit ? mix(col, mat.lite, lit) : col);
  const rng = makeRng(seed);
  p.rect(x, y, w, h, mat.mortar);
  const first = Math.floor(y / courseH);
  const last = Math.ceil((y + h) / courseH);
  for (let c = first; c < last; c++) {
    const courseY = c * courseH;
    const bandY = Math.max(y, courseY);
    const bandH = Math.min(y + h, courseY + bh) - bandY;
    if (bandH <= 0) continue;
    const shift = c & 1 ? bond : 0;
    for (let bx = Math.floor((x - shift) / pitch) * pitch + shift; bx < x + w; bx += pitch) {
      const x0 = Math.max(x, bx);
      const x1 = Math.min(x + w, bx + bw);
      if (x1 <= x0) continue;
      const t = rng();
      const col =
        t < 0.08
          ? mix(mat.base, mat.dark, 0.7)
          : t < 0.24
            ? mix(mat.base, mat.dark, 0.36)
            : t < 0.38
              ? mix(mat.base, mat.lite, 0.4)
              : t < 0.5
                ? mix(mat.base, mat.lite, 0.18)
                : mat.base;
      p.rect(x0, bandY, x1 - x0, bandH, tone(col));
      if (t > 0.74 && bandH > 1) p.hline(x0, bandY, x1 - x0, tone(mix(col, mat.lite, 0.22)));
      if (rng() < 0.05 && x1 - x0 > 2 && bandH > 1) {
        const cw = Math.min(x1 - x0 - 1, 2 + Math.floor(rng() * 2));
        const cx = x0 + Math.floor(rng() * Math.max(1, x1 - x0 - cw));
        p.rect(cx, bandY + bandH - 1, cw, 1, tone(mix(mat.tocho, mat.dark, 0.2)));
      }
    }
  }
}

// The ribbed metal of the slab bands and the parapet: a rib every 4 px, a lit shoulder on top
// and a shadow at the foot. The densest texture in the building, and the reason a 302 px band
// does not read as a flat stripe.
function paintRibbed(p, x, y, w, h) {
  if (w <= 0 || h <= 0) return;
  p.rect(x, y, w, h, MAT.clad.base);
  for (let rx = x; rx < x + w; rx += 4) {
    p.vline(rx, y + 2, Math.max(0, h - 4), MAT.clad.rib);
    p.vline(rx + 2, y + 2, Math.max(0, h - 4), mix(MAT.clad.base, MAT.clad.lite, 0.28));
  }
  p.hline(x, y, w, mix(MAT.clad.lite, C.stoneLite, 0.35));
  p.hline(x, y + 1, w, mix(MAT.clad.base, MAT.clad.lite, 0.5));
  p.hline(x, y + h - 2, w, mix(MAT.clad.dark, C.ink, 0.2));
  p.hline(x, y + h - 1, w, MAT.clad.dark);
}

// The glass: a slate veil thin enough to keep the room warm, a little colder at the head
// where the sky sits in it, and two reflections leaning the same way. It is painted in one
// piece across the glazing — over the rooms and over the lift's bay alike — and under the
// mullions, so a bar is never tinted and everything behind it is one pane of glass.
function paintGlass(p, rect) {
  const { x, y, w, h } = rect;
  p.rect(x, y, w, h, rgba(C.slate, GLASS.veil));
  for (let i = 0; i < 8; i++) p.hline(x, y + i, w, rgba(C.glassLite, GLASS.head));
  for (const [off, width] of [
    [9, 3],
    [Math.round(w * 0.54), 2],
  ]) {
    for (let i = 0; i < h; i++) {
      const rx = x + off + Math.round(i * 0.7);
      if (rx + width <= x + w) p.rect(rx, y + i, width, 1, rgba(C.white, GLASS.refl));
    }
  }
}

// ----------------------------------------------------------------- masonry

// The two piers: the building's own tocho, full height, with the glass held between them. The
// left one is what the alley's unlit wall meets, the right one is the party wall to the gym, so
// each gets the arris it needs to read as its own mass — the outer corner catching the light,
// the edge that turns into the glazing falling into a two px reveal.
function paintPiers(p, L) {
  const { top, bottom } = L.pierBand;
  const h = bottom - top + 1;
  for (const pier of L.piers) {
    brickFace(p, pier.x, top, pier.w, h, OFFICES.seed + pier.seed);
    const dir = pier.side === 'left' ? 1 : -1;
    const outer = pier.side === 'left' ? pier.x : pier.x + pier.w - 1;
    const inner = outer + dir * (pier.w - 1);
    p.vline(outer, top, h, mix(MAT.brick.lite, C.stoneLite, 0.26));
    p.vline(outer + dir, top, h, rgba(C.white, 0.07));
    p.vline(inner, top, h, rgba(C.ink, 0.42));
    p.vline(inner - dir, top, h, rgba(C.ink, 0.16));
    // the foot: the pier meets the pavement in its own contact shadow
    p.hline(pier.x, bottom, pier.w, rgba(C.ink, 0.34));
    p.hline(pier.x, bottom - 1, pier.w, rgba(C.ink, 0.12));
  }
}

// The lift's masonry, inside: the same brick the piers are, because it is the same wall, only
// seen from within the building — so it is the one face of this tocho that the room's light
// reaches, and it is painted a step lighter than the piers out on the street. It runs the full
// interior height, and the slab bands are painted over it in front, so the shaft is cut into the
// building's own storeys by the building's own spandrels.
function paintShaftFace(p, L) {
  const s = L.shaft;
  const h = s.bottom - s.top + 1;
  brickFace(p, s.faceX, s.top, s.faceW, h, OFFICES.seed + 3, 0.8);
  // This wall is the lobby's own left wall, so the room's light falls on it: the tocho inside is
  // a step lighter and warmer than the piers out on the street, and that difference is what says
  // "inside" before the glass veil is even laid over it. Darkened instead, the shaft read as a
  // black slot with two pale doors floating in it.
  p.rect(s.faceX, s.top, s.faceW, h, rgba(C.lampWarm, 0.05));
  // the wall the lobby is measured from: the brick turns into the room's plaster here
  p.vline(s.faceX + s.faceW - 1, s.top, h, rgba(C.ink, 0.38));
  p.vline(s.faceX + s.faceW - 2, s.top, h, rgba(C.ink, 0.12));
}

// The roof: the parapet between the piers in the same brick and on the same course grid, under
// one stone coping that runs the whole width — over the parapet and over both piers. That is the
// line the building now ends on: nothing rises past it, and the two piers are its bookends.
function paintRoof(p, L) {
  const r = L.roof;
  const { x, w } = L.parapet;
  brickFace(p, x, r.wallTop, w, r.wallBottom - r.wallTop + 1, OFFICES.seed + 7);
  // the coping: three rows of stone, lit on top, and the shadow it throws down the brick
  p.rect(0, r.copingTop, L.w, r.coping, MAT.stone.base);
  p.hline(0, r.copingTop, L.w, MAT.stone.lite);
  p.hline(0, r.copingTop + 1, L.w, mix(MAT.stone.base, MAT.stone.lite, 0.45));
  p.hline(0, r.copingTop + r.coping - 1, L.w, MAT.stone.dark);
  p.hline(0, r.wallTop, L.w, rgba(C.ink, 0.28));
}

// The right pier is the wall between the offices and the gym, and a blank party wall is where a
// building shows its age. Two things only, both countable at 2 px per art px: a cast-iron
// downpipe down its outer side — hopper under the coping, a bracket every few courses, a shoe at
// the foot — and the opening that was bricked up low in it, a stone lintel and sill round an
// infill laid in a coarser bond than the wall's, which is how a later repair reads.
function paintPartyWall(p, L) {
  const d = OFFICES.pierDetail;
  const pier = L.piers.find((q) => q.side === 'right');
  const { top, bottom } = L.pierBand;
  // the blocked-up opening: its sill six rows up off the pavement, stone over and under it
  const b = d.blocked;
  const sill = bottom - b.lift;
  const infillTop = sill - b.h;
  const bx = pier.x + b.inset;
  p.rect(bx, infillTop, b.w, b.h, mix(MAT.brick.base, MAT.brick.dark, 0.34));
  // the infill is laid in a bond of its own — a 4 row course and a 10 px brick, against the
  // wall's 4 x 8 running bond, and staggered — which is how a later repair reads: the same
  // material, put back by someone in a hurry. The joints are shut with the brick's own colour
  // rather than the wall's cold mortar: at full strength they read as a grille over a dark
  // panel, which is the one thing this pier must not look like.
  const course = 4;
  const brickW = 10;
  const jointCol = mix(MAT.brick.dark, MAT.brick.mortar, 0.45);
  for (let i = 0, y = infillTop; y < sill; i++, y += course) {
    const rowH = Math.min(course - 1, sill - y);
    p.hline(bx, y + rowH, b.w, jointCol);
    const shift = (i & 1) * (brickW >> 1);
    for (let x = bx + brickW - shift; x < bx + b.w; x += brickW) p.vline(x, y, rowH, jointCol);
  }
  p.rect(bx - 1, infillTop - b.lintel, b.w + 2, b.lintel, MAT.stone.base);
  p.hline(bx - 1, infillTop - b.lintel, b.w + 2, MAT.stone.lite);
  p.hline(bx - 1, infillTop - 1, b.w + 2, MAT.stone.dark);
  p.hline(bx - 1, infillTop, b.w + 2, rgba(C.ink, 0.26));
  p.rect(bx - 2, sill, b.w + 4, b.sill, MAT.stone.base);
  p.hline(bx - 2, sill, b.w + 4, MAT.stone.lite);
  p.hline(bx - 2, sill + b.sill, b.w + 4, rgba(C.ink, 0.3));
  // the downpipe, hard inside the pier's outer arris: its own shadow first, then the stack
  const pipe = d.pipe;
  const px = pier.x + pier.w - pipe.inset - pipe.w;
  const headY = top + 1;
  const stackTop = headY + pipe.hopper.h;
  const stackBottom = bottom - 2;
  p.vline(px - 1, headY, stackBottom - headY + 1, rgba(C.ink, 0.24));
  // the hopper: a flared head under the coping, lit down its near side
  p.rect(px - 2, headY, pipe.w + 4, pipe.hopper.h, MAT.pipe.base);
  p.hline(px - 2, headY, pipe.w + 4, MAT.pipe.lite);
  p.vline(px - 2, headY, pipe.hopper.h, MAT.pipe.lite);
  p.vline(px + pipe.w + 1, headY, pipe.hopper.h, MAT.pipe.dark);
  p.hline(px - 2, headY + pipe.hopper.h - 1, pipe.w + 4, MAT.pipe.dark);
  // the stack, and the brackets the wall holds it by
  p.rect(px, stackTop, pipe.w, stackBottom - stackTop + 1, MAT.pipe.base);
  p.vline(px, stackTop, stackBottom - stackTop + 1, MAT.pipe.lite);
  p.vline(px + pipe.w - 1, stackTop, stackBottom - stackTop + 1, MAT.pipe.dark);
  for (let y = stackTop + pipe.bracket.every; y < stackBottom - 6; y += pipe.bracket.every) {
    p.hline(px - 1, y, pipe.bracket.w, MAT.pipe.dark);
    p.px(px - 1, y, MAT.pipe.lite);
  }
  // the shoe: it turns out of the wall and stands on the pavement
  p.rect(px - 2, bottom - 3, pipe.w + 3, 3, MAT.pipe.base);
  p.hline(px - 2, bottom - 3, pipe.w + 3, MAT.pipe.lite);
  p.hline(px - 2, bottom, pipe.w + 3, rgba(C.ink, 0.36));
}
// The room as a space: a warm wall under the slab's shade, joints on a 26 px pitch, a dark
// timber floor, and the contact shadow the wall throws on it.
function paintRoomShell(p, room) {
  const { x, w, y, row, wall } = room;
  const h = row - y + 1;
  p.rect(x, y, w, h, wall);
  for (let i = 0; i < 7; i++) p.hline(x, y + i, w, mix(wall, MAT.room.ceiling, 1 - i / 7));
  for (let jx = x + 13; jx < x + w - 2; jx += 26) p.vline(jx, y + 9, h - 13, MAT.room.joint);
  const floorTop = row - 2;
  p.rect(x, floorTop, w, 3, MAT.room.floor);
  p.hline(x, floorTop, w, MAT.room.floorLite);
  p.hline(x, floorTop - 1, w, rgba(C.ink, 0.18));
  for (let px = x + 5; px < x + w; px += 11) p.vline(px, floorTop + 1, 1, mix(MAT.room.floor, C.ink, 0.3));
}

// The industrial ceiling: a duct with collars, hung under the slab, and the linear pendants
// that hang from it. One duct and one or two lamps per room is the whole of the lighting.
function paintCeiling(p, room) {
  const { x, w, y } = room;
  const { soffit, duct, lamp } = OFFICES.ceiling;
  const dx = x + duct.inset;
  const dw = w - duct.inset * 2;
  const dy = y + soffit + duct.gap;
  // the hangers first, so the duct is in front of them
  for (let cx = dx + 12; cx < dx + dw - 6; cx += duct.ring) {
    p.vline(cx, y + soffit - 2, duct.gap + 2, MAT.duct.dark);
    p.hline(cx - 1, y + soffit - 2, 3, MAT.duct.base);
  }
  p.rect(dx, dy, dw, duct.h, MAT.duct.base);
  p.hline(dx, dy, dw, MAT.duct.lite);
  p.hline(dx, dy + 1, dw, mix(MAT.duct.base, MAT.duct.lite, 0.45));
  p.hline(dx, dy + duct.h - 1, dw, MAT.duct.dark);
  // the sections: a seam every ring, and a collar over the duct where a hanger holds it
  for (let sx = dx + duct.ring; sx < dx + dw; sx += duct.ring) p.vline(sx, dy, duct.h, MAT.duct.dark);
  for (let cx = dx + 12; cx < dx + dw - 6; cx += duct.ring) {
    p.hline(cx - 2, dy, 5, MAT.duct.dark);
    p.hline(cx - 2, dy + duct.h - 1, 5, MAT.duct.dark);
  }
  // the pendants: a cable off the duct, a housing, a warm tube and its glow
  const top = dy + duct.h + lamp.drop;
  for (const cx of room.lamps) {
    p.vline(cx, dy + duct.h, lamp.drop, MAT.frame.dark);
    const hx = cx - Math.round(lamp.w / 2);
    p.rect(hx, top, lamp.w, lamp.housing, MAT.frame.base);
    p.hline(hx, top, lamp.w, MAT.frame.lite);
    p.hline(hx, top + lamp.housing - 1, lamp.w, MAT.frame.dark);
    p.rect(hx + 2, top + lamp.housing, lamp.w - 4, 1, C.lamp);
    for (let i = 0; i < lamp.glow; i++) {
      const gw = lamp.w + 4 + i * 6;
      p.rect(cx - Math.round(gw / 2), top + lamp.housing + 1 + i, gw, 1, rgba(C.lampWarm, 0.12 - i * 0.026));
    }
  }
}

// The room's name, on a small plate in the band above its window: the tiny 3x5 face with 2 px
// between glyphs, 3 px of padding each side and 1 above and below, so the plate hugs its word and
// stands in the 10 rows of cladding with 2 to spare over it.
//
// The band is the only place in the building a label fits on every floor. Inside, the boards hang
// from the transom (the pinboard's top is 10 rows under it) and the desks' monitors reach to within
// 23 — in a room 54 rows tall with the duct and the pendants taking the first 22, the four narrower
// rooms have no free wall at that height at all. The band is also what a plaque on a facade is: the
// name reads over the window it belongs to, outside the glass, so no veil and no mullion touches it.
function paintRoomLabel(p, band, room) {
  const text = OFFICES.labels[room.state];
  if (!text) return;
  const { padX, padY, spacing } = OFFICES.label;
  const tw = lineWidth(text, { font: 'tiny', spacing });
  const w = tw + padX * 2;
  const h = FONTS.tiny.rows + padY * 2;
  const x = room.x + Math.round((room.w - w) / 2);
  const y = band.slabTop + Math.round((OFFICES.slab - h) / 2);
  // the plate: dark steel, one lit row along its top, one ink row under it, so it reads as a
  // plaque bolted to the cladding and not as a hole in it
  p.rect(x, y, w, h, MAT.frame.dark);
  p.hline(x, y, w, mix(MAT.frame.base, MAT.frame.lite, 0.5));
  p.hline(x, y + h - 1, w, mix(MAT.frame.dark, C.ink, 0.4));
  // the name, warm bone: over cladding this dark the letters are the only thing that has to
  // carry, so they take the brightest value the palette has
  drawText(p.ctx, text, x + padX, y + padY, mix(C.white, C.lampWarm, 0.12), { font: 'tiny', spacing });
}

// The two split floors are two rooms because of this: 3 px of frame and glass with a door in
// it, standing on the floor and reaching the transom. Cold glass against the warm wall, so it
// reads as a division and not as another mullion.
function paintPartition(p, L, band) {
  const { x, w, doorH } = L.split;
  const top = band.y;
  const bottom = band.row;
  const h = bottom - top + 1;
  p.vline(x, top, h, MAT.frame.base);
  p.vline(x + 1, top + 1, h - 2, mix(C.glass, C.glassLite, 0.5));
  p.vline(x + w - 1, top, h, MAT.frame.dark);
  // the door: its head rail, its foot rail, and the leaf of clear glass between them
  const doorTop = bottom - doorH + 1;
  p.vline(x + 1, doorTop, doorH - 3, mix(C.glassLite, C.white, 0.28));
  p.hline(x, doorTop - 1, w, MAT.frame.lite);
  p.hline(x, doorTop, w, mix(C.glassLite, C.white, 0.2));
  p.hline(x, bottom - 2, w, MAT.frame.base);
  // the pull, two pixels of light at hand height
  p.vline(x + 1, doorTop + 16, 2, MAT.stone.lite);
  // the shadow it throws on the room behind it, one column
  p.vline(x + w, top + 4, h - 8, rgba(C.ink, 0.14));
}

// -------------------------------------------------------------------- props

function tone(colour, tint) {
  return tint ? mix(colour, MAT.room.ceiling, tint) : colour;
}

// A desk with a monitor on it and a chair's back over the far edge: the smallest thing that
// reads as "someone works here" at 2 physical px per art px.
function paintDesk(p, d) {
  const F = OFFICES.furniture.desk;
  const { x, w, base } = d;
  const t = (colour) => tone(colour, d.tint);
  const topY = base - F.top;
  const rng = makeRng(OFFICES.seed + x * 7 + base);
  p.hline(x + 1, base, w - 2, rgba(C.ink, 0.3));
  // the frame: two legs and a stretcher
  for (const lx of [x + 1, x + w - 3]) {
    p.rect(lx, topY + 3, 2, base - topY - 3, t(MAT.frame.base));
    p.vline(lx, topY + 3, base - topY - 3, t(MAT.frame.lite));
    p.vline(lx + 1, topY + 3, base - topY - 3, t(MAT.frame.dark));
  }
  p.hline(x + 3, topY + F.slab + 6, w - 6, t(MAT.frame.dark));
  // the top: three rows of wood on a metal edge
  p.rect(x, topY, w, F.slab, t(MAT.wood.base));
  p.hline(x, topY, w, t(MAT.wood.lite));
  p.hline(x, topY + F.slab - 1, w, t(MAT.wood.dark));
  // the monitor: a dark case, a face that is the one lit rectangle in the room
  const m = F.monitor;
  const mx = x + Math.round((w - m.w) / 2);
  p.rect(mx, topY - m.h, m.w, m.h, t(MAT.screen.bezel));
  p.hline(mx, topY - m.h, m.w, t(mix(MAT.screen.bezel, MAT.frame.lite, 0.35)));
  p.rect(mx + 1, topY - m.h + 1, m.w - 2, m.h - 3, t(MAT.screen.lit));
  p.hline(mx + 1, topY - m.h + 1, m.w - 2, t(mix(MAT.screen.lit, C.white, 0.4)));
  p.hline(mx + 2, topY - m.h + 5, m.w - 4, t(mix(MAT.screen.lit, MAT.screen.face, 0.5)));
  p.rect(mx + 3, topY - 2, 3, 2, t(MAT.screen.bezel));
  // the chair's back, rising over the desk on the monitor's left
  const c = F.chair;
  p.rect(x + 1, topY - c.h - 1, c.w, c.h, t(MAT.fabric.base));
  p.hline(x + 1, topY - c.h - 1, c.w, t(MAT.fabric.lite));
  p.vline(x + 1, topY - c.h - 1, c.h, t(mix(MAT.fabric.base, MAT.fabric.lite, 0.4)));
  // one desk in three has a cup on it, one in three a tray of paper, and the rest a stack:
  // three pixels is all the "used" this room needs per desk
  const pick = rng();
  if (pick < 0.34) {
    p.rect(x + w - 6, topY - 3, 3, 3, MAT.paper.base);
    p.hline(x + w - 6, topY - 3, 3, C.white);
    p.px(x + w - 3, topY - 2, MAT.paper.dark);
  } else if (pick < 0.68) {
    p.rect(x + w - 8, topY - 2, 5, 2, MAT.paper.base);
    p.hline(x + w - 8, topY - 2, 5, C.white);
    p.hline(x + w - 8, topY - 1, 5, MAT.paper.dark);
  } else {
    p.rect(x + w - 7, topY - 1, 4, 1, MAT.paper.base);
    p.px(x + w - 6, topY - 2, MAT.paper.base);
  }
}

// A plant: a stone planter, a trunk when it is tall, and a leaf mass in three tones. The
// foliage is a table of widths, so it is a plant and never a blob.
const LEAF_ROWS = [
  [0.42, 0.16],
  [0.34, 0.42],
  [0.26, 0.62],
  [0.18, 0.8],
  [0.12, 0.94],
  [0.08, 1],
  [0.1, 0.98],
  [0.16, 0.9],
  [0.24, 0.78],
  [0.32, 0.62],
  [0.42, 0.44],
];

function paintPlant(p, pr) {
  const { x, w, base } = pr;
  const tall = !!pr.tall;
  const F = tall ? OFFICES.furniture.tallPlant : OFFICES.furniture.plant;
  const h = F.h;
  const potW = Math.max(6, Math.round(w * 0.62));
  const potH = Math.max(4, Math.round(w * (tall ? 0.42 : 0.34)));
  const px = x + Math.round((w - potW) / 2);
  const potTop = base - potH;
  const rng = makeRng(OFFICES.seed + x * 13 + h);
  // the planter: stone, lit on the left, with a rim and a shadow at its foot
  p.rect(px, potTop, potW, potH, MAT.stone.dark);
  p.hline(px - 1, potTop, potW + 2, MAT.stone.base);
  p.hline(px - 1, potTop + 1, potW + 2, mix(MAT.stone.base, MAT.stone.dark, 0.5));
  p.vline(px, potTop + 2, potH - 2, mix(MAT.stone.base, MAT.stone.dark, 0.45));
  p.hline(px + 1, base - 1, potW - 1, rgba(C.ink, 0.4));
  const leafTop = potTop - h + potH;
  const leafBottom = potTop - 1;
  const midX = x + Math.round(w / 2);
  if (tall) p.rect(midX - 1, leafTop + 4, 2, leafBottom - leafTop - 2, MAT.wood.dark);
  const rows = leafBottom - leafTop + 1;
  const half = Math.max(3, Math.round(w / 2));
  for (let i = 0; i < rows; i++) {
    const [inset, width] = LEAF_ROWS[Math.min(LEAF_ROWS.length - 1, Math.floor((i / rows) * LEAF_ROWS.length))];
    const rw = Math.max(1, Math.round(half * 2 * width));
    const rx = midX - Math.round(rw / 2) + Math.round((inset - 0.25) * 2);
    p.hline(rx, leafTop + i, rw, MAT.plant.base);
    // the light: the upper left of the mass, the way a plant is lit by a room
    if (i < rows * 0.62) p.hline(rx + 1, leafTop + i, Math.max(1, rw - 3), MAT.plant.dark);
    if (i > rows * 0.2 && i < rows * 0.7) p.hline(rx + Math.max(1, Math.round(rw * 0.2)), leafTop + i, Math.max(1, Math.round(rw * 0.45)), MAT.plant.lite);
  }
  // a few leaf tips out of the silhouette, seeded, so no two plants are the same outline
  for (let i = 0; i < 3; i++) {
    const ty = leafTop + 2 + Math.floor(rng() * (rows - 4));
    const side = rng() < 0.5 ? -1 : 1;
    p.px(midX + side * (half + 1), ty, MAT.plant.tip);
  }
  p.rect(midX - 1, leafTop, 2, 2, MAT.plant.tip);
}

// A whiteboard, hung: a metal surround, a face of pale board with the plan written on it in
// three muted markers, the magnet, and a tray of markers under it.
function paintWhiteboard(p, pr) {
  const { x, w, bottom } = pr;
  const F = OFFICES.furniture.whiteboard;
  const boardBottom = bottom - F.tray;
  const top = boardBottom - F.h + 1;
  const rng = makeRng(OFFICES.seed + x * 3 + 17);
  p.rect(x, top, w, F.h, MAT.frame.base);
  p.hline(x, top, w, MAT.frame.lite);
  p.hline(x, top + F.h - 1, w, MAT.frame.dark);
  p.vline(x + w - 1, top, F.h, MAT.frame.dark);
  p.rect(x + 1, top + 1, w - 2, F.h - 2, mix(C.stoneLite, C.white, 0.45));
  // the writing: three rows of it, one of them a plan with three boxes
  const inks = [mix(C.slate, C.ink, 0.2), mix(C.water, C.white, 0.25), mix(C.brick, C.woodDark, 0.3)];
  for (let row = 0; row < 3; row++) {
    const ry = top + 3 + row * 4;
    let cx = x + 3;
    while (cx < x + w - 6) {
      const len = 3 + Math.floor(rng() * 7);
      p.hline(cx, ry, Math.min(len, x + w - 4 - cx), inks[row % inks.length]);
      cx += len + 3;
    }
  }
  p.rect(x + w - 13, top + 3, 3, 3, mix(C.brick, C.woodDark, 0.2));
  p.rect(x + w - 9, top + 3, 3, 3, mix(C.stone, C.ink, 0.2));
  p.px(x + 4, top + 3, C.white);
  // the tray, and two markers lying in it
  p.rect(x + 2, boardBottom + 1, w - 4, F.tray, MAT.frame.base);
  p.hline(x + 2, boardBottom + 1, w - 4, MAT.frame.lite);
  p.rect(x + 6, boardBottom, 5, 1, mix(C.slate, C.ink, 0.15));
  p.rect(x + 13, boardBottom, 4, 1, mix(C.brick, C.woodDark, 0.25));
}

// The pinboard the findings go on: a cork face, notes stuck on it, and a tray of paper under.
function paintPinboard(p, pr) {
  const { x, w, bottom } = pr;
  const F = OFFICES.furniture.pinboard;
  const boardBottom = bottom - F.tray;
  const top = boardBottom - F.h + 1;
  const rng = makeRng(OFFICES.seed + x * 5 + 29);
  p.rect(x, top, w, F.h, MAT.frame.base);
  p.hline(x, top, w, MAT.frame.lite);
  p.hline(x, top + F.h - 1, w, MAT.frame.dark);
  p.rect(x + 1, top + 1, w - 2, F.h - 2, mix(C.woodLite, C.sand, 0.45));
  const notes = [MAT.paper.base, mix(C.lamp, C.stoneLite, 0.35), mix(C.stoneLite, C.water, 0.28)];
  for (let i = 0; i < 7; i++) {
    const nx = x + 3 + Math.floor(rng() * (w - 10));
    const ny = top + 2 + Math.floor(rng() * (F.h - 8));
    const nw = 3 + Math.floor(rng() * 3);
    p.rect(nx, ny, nw, 3, notes[i % notes.length]);
    p.px(nx, ny - 1, MAT.frame.dark);
  }
  p.rect(x + 2, boardBottom + 1, w - 4, F.tray, MAT.frame.base);
  p.hline(x + 2, boardBottom + 1, w - 4, MAT.frame.lite);
}

// A table with chairs behind it: the tabletop, the four legs, the seat backs that show over
// it, and whatever was left on it.
function paintTable(p, pr) {
  const F = OFFICES.furniture.table;
  const { x, w, base, seats } = pr;
  const topY = base - F.top;
  const rng = makeRng(OFFICES.seed + x * 11 + base);
  // the chairs first: their backs stand behind the table, so they go down before it
  const span = Math.min(w - 8, seats * 15);
  const x0 = x + Math.round((w - span) / 2);
  const chairW = 7;
  for (let i = 0; i < seats; i++) {
    const cx = x0 + Math.round((span * (i + 0.5)) / seats) - Math.round(chairW / 2);
    const chH = 8;
    p.rect(cx, topY - chH - 1, chairW, chH, MAT.fabric.base);
    p.hline(cx, topY - chH - 1, chairW, MAT.fabric.lite);
    p.vline(cx, topY - chH - 1, chH, mix(MAT.fabric.base, MAT.fabric.lite, 0.35));
    p.vline(cx + chairW - 1, topY - chH - 1, chH, MAT.fabric.dark);
  }
  // the legs, then the top standing 1 px proud of them
  for (const lx of [x + 2, x + w - 4]) {
    p.rect(lx, topY + F.slab, 2, base - topY - F.slab, MAT.frame.base);
    p.vline(lx, topY + F.slab, base - topY - F.slab, MAT.frame.dark);
  }
  p.rect(x, topY, w, F.slab, MAT.wood.base);
  p.hline(x, topY, w, MAT.wood.lite);
  p.hline(x, topY + F.slab - 1, w, MAT.wood.dark);
  p.hline(x + 1, base, w - 2, rgba(C.ink, 0.28));
  // on the table: a laptop, two cups and a couple of sheets, seeded
  const laptop = 9;
  const lx = x + 4 + Math.floor(rng() * Math.max(1, w - laptop - 16));
  p.rect(lx, topY - 5, laptop, 5, MAT.screen.bezel);
  p.rect(lx + 1, topY - 4, laptop - 2, 3, MAT.screen.lit);
  p.hline(lx, topY - 1, laptop, MAT.frame.base);
  for (let i = 0; i < 2; i++) {
    const cx = x + w - 18 + i * 6;
    p.rect(cx, topY - 3, 2, 3, MAT.paper.base);
    p.hline(cx, topY - 3, 2, C.white);
  }
  p.rect(x + w - 8, topY - 1, 5, 1, MAT.paper.base);
}

// The photocopier: a pale machine with a dark platen, the paper tray out of its side, and one
// pixel of lit panel. It is what makes an implementing room an implementing room.
function paintCopier(p, pr) {
  const F = OFFICES.furniture.copier;
  const { x, w, base } = pr;
  const top = base - F.h;
  p.hline(x + 1, base, w - 2, rgba(C.ink, 0.32));
  p.rect(x, top + 4, w, F.h - 5, MAT.machine.base);
  p.vline(x, top + 4, F.h - 5, MAT.machine.lite);
  p.vline(x + w - 1, top + 4, F.h - 5, MAT.machine.dark);
  // the platen: a lid, and the strip of glass under it
  p.rect(x + 1, top, w - 2, 4, MAT.machine.dark);
  p.hline(x + 1, top, w - 2, MAT.machine.lite);
  p.hline(x + 3, top + 2, w - 6, mix(MAT.screen.face, C.glassLite, 0.4));
  // the tray out of the right side, and the drawer at the foot
  p.rect(x + w - 8, base - 12, 6, 2, MAT.machine.lite);
  p.hline(x + w - 8, base - 12, 6, C.white);
  p.rect(x + 3, base - 8, w - 6, 1, MAT.machine.dark);
  p.rect(x + 3, base - 4, w - 6, 1, MAT.machine.dark);
  // the control panel: two pixels of lit display and a button
  p.rect(x + 2, top + 6, 6, 2, MAT.screen.face);
  p.px(x + 3, top + 6, MAT.screen.lit);
  p.px(x + 9, top + 6, C.lamp);
}

// A steel shelf with binders and a box on it: research, in one object.
function paintShelf(p, pr) {
  const F = OFFICES.furniture.shelf;
  const { x, w, base } = pr;
  const top = base - F.h;
  const rng = makeRng(OFFICES.seed + x * 17 + 5);
  const shelves = 3;
  for (const lx of [x, x + w - 2]) {
    p.rect(lx, top, 2, F.h, MAT.frame.base);
    p.vline(lx, top, F.h, MAT.frame.lite);
  }
  p.hline(x + 2, base, w - 4, rgba(C.ink, 0.3));
  const tones = [mix(C.brick, C.woodDark, 0.3), mix(C.water, C.ink, 0.2), mix(C.woodLite, C.stone, 0.3), mix(C.slate, C.ink, 0.2)];
  for (let s = 0; s < shelves; s++) {
    const sy = base - 3 - s * 6;
    p.hline(x, sy, w, MAT.frame.lite);
    p.hline(x, sy + 1, w, MAT.frame.dark);
    if (s === 2) continue; // the top shelf is where the box goes
    let bx = x + 3;
    while (bx < x + w - 5) {
      const bw = 2 + Math.floor(rng() * 2);
      const bh = 3 + Math.floor(rng() * 2);
      p.rect(bx, sy - bh, bw, bh, tones[Math.floor(rng() * tones.length)]);
      p.vline(bx, sy - bh, bh, rgba(C.white, 0.12));
      bx += bw + 1;
    }
  }
  p.rect(x + 6, top + 3, 9, 5, mix(C.sand, C.plasterDark, 0.5));
  p.hline(x + 6, top + 3, 9, mix(C.plasterLite, C.white, 0.3));
}

// A low sideboard: two doors, two handles, a lit top, and the paper left on it.
function paintCabinet(p, pr) {
  const F = OFFICES.furniture.cabinet;
  const { x, w, base } = pr;
  const top = base - F.h;
  p.hline(x + 1, base, w - 2, rgba(C.ink, 0.3));
  p.rect(x, top, w, F.h - 1, MAT.wood.base);
  p.hline(x, top, w, MAT.wood.lite);
  p.hline(x, top + 3, w, MAT.wood.dark);
  p.hline(x, base - 1, w, MAT.wood.dark);
  p.vline(x, top, F.h - 1, MAT.wood.dark);
  p.vline(x + w - 1, top, F.h - 1, MAT.wood.dark);
  for (const hx of [x + Math.round(w / 2) - 4, x + Math.round(w / 2) + 2]) p.rect(hx, top + 6, 2, 3, MAT.frame.base);
  p.vline(x + Math.round(w / 2), top + 4, F.h - 6, MAT.wood.dark);
  p.rect(x + 5, top - 3, 6, 3, MAT.paper.base);
  p.hline(x + 5, top - 3, 6, C.white);
  p.rect(x + 14, top - 2, 4, 2, MAT.paper.dark);
}

// The lounge: a wool sofa with a cushion, and the TV on its cabinet. Two objects, one
// corner, and no rug — a rug at this scale is a stain.
function paintSofa(p, pr) {
  const F = OFFICES.furniture.sofa;
  const { x, w, base } = pr;
  const top = base - F.h;
  p.hline(x + 1, base, w - 2, rgba(C.ink, 0.32));
  // the back and its two arms
  p.rect(x, top, w, F.h - 2, MAT.fabric.base);
  p.hline(x, top, w, MAT.fabric.lite);
  p.rect(x, top - 2, 3, F.h - 2, MAT.fabric.base);
  p.rect(x + w - 3, top - 2, 3, F.h - 2, MAT.fabric.base);
  p.vline(x, top - 2, F.h - 2, MAT.fabric.lite);
  p.vline(x + w - 1, top - 2, F.h - 2, MAT.fabric.dark);
  // the seat: a cushion between the arms, lit along its front edge
  p.rect(x + 3, base - 6, w - 6, 4, mix(MAT.fabric.base, MAT.fabric.lite, 0.35));
  p.hline(x + 3, base - 6, w - 6, mix(MAT.fabric.lite, C.white, 0.18));
  p.hline(x + 3, base - 3, w - 6, MAT.fabric.dark);
  // the throw pillow, one warm rectangle in a cold corner
  p.rect(x + 5, top + 3, 6, 5, mix(C.brick, C.woodDark, 0.15));
  p.hline(x + 5, top + 3, 6, mix(C.brickLite, C.wood, 0.2));
  // two steel feet
  for (const fx of [x + 2, x + w - 4]) p.rect(fx, base - 2, 2, 2, MAT.frame.base);
}

function paintTv(p, pr) {
  const F = OFFICES.furniture.tv;
  const { x, w, base } = pr;
  const cab = F.cabinet;
  const cabTop = base - cab.h;
  // the cabinet
  p.hline(x + 1, base, w - 2, rgba(C.ink, 0.3));
  p.rect(x, cabTop, w, cab.h - 1, MAT.wood.base);
  p.hline(x, cabTop, w, MAT.wood.lite);
  p.vline(x + Math.round(w / 2), cabTop + 2, cab.h - 3, MAT.wood.dark);
  p.vline(x, cabTop, cab.h - 1, MAT.wood.dark);
  p.vline(x + w - 1, cabTop, cab.h - 1, MAT.wood.dark);
  // the panel standing on it: a bezel and a dark face with one reflection, so it reads as a
  // screen and not as a black box
  const panel = F.panel;
  const px = x + Math.round((w - panel.w) / 2);
  const pTop = cabTop - panel.h;
  p.rect(px, pTop, panel.w, panel.h, MAT.screen.bezel);
  p.hline(px, pTop, panel.w, mix(MAT.screen.bezel, MAT.frame.lite, 0.3));
  p.rect(px + 1, pTop + 1, panel.w - 2, panel.h - 2, MAT.screen.face);
  for (let i = 0; i < 4; i++) p.hline(px + 3 + i, pTop + 2 + i, 4, rgba(C.glassLite, 0.18));
  p.rect(px + Math.round(panel.w / 2) - 2, cabTop - 1, 4, 1, MAT.screen.bezel);
}

// The bench in the lobby: two slats, two steel legs, nothing else.
function paintBench(p, pr) {
  const F = OFFICES.furniture.bench;
  const { x, w, base } = pr;
  const top = base - F.h;
  p.hline(x + 1, base, w - 2, rgba(C.ink, 0.3));
  p.rect(x, top, w, 2, MAT.wood.base);
  p.hline(x, top, w, MAT.wood.lite);
  p.hline(x, top + 2, w, MAT.wood.dark);
  p.rect(x + 2, top + 3, w - 4, 1, mix(MAT.wood.base, MAT.wood.dark, 0.4));
  for (const lx of [x + 2, x + w - 4]) {
    p.rect(lx, top + 3, 2, base - top - 3, MAT.frame.base);
    p.vline(lx, top + 3, base - top - 3, MAT.frame.lite);
  }
}

// The reception: a wood front with a stone top standing proud of it, the monitor on it, a
// phone, two cups, and the strip of light under the counter that a lobby is lit by.
function paintCounter(p, pr) {
  const F = OFFICES.furniture.counter;
  const { x, w, base } = pr;
  const topY = base - F.top;
  const bodyTop = topY + 2;
  const bodyH = base - bodyTop;
  p.hline(x + 1, base, w - 2, rgba(C.ink, 0.34));
  p.rect(x, bodyTop, w, bodyH, MAT.wood.base);
  for (let jx = x + 12; jx < x + w - 4; jx += 14) p.vline(jx, bodyTop + 2, bodyH - 4, MAT.wood.dark);
  p.hline(x, bodyTop, w, mix(MAT.wood.lite, MAT.wood.base, 0.4));
  // the light strip under the counter's lip
  p.hline(x + 2, bodyTop + 1, w - 4, rgba(C.lampWarm, 0.5));
  p.hline(x + 2, bodyTop + 2, w - 4, rgba(C.lampWarm, 0.22));
  // the stone top, 1 px proud on each side
  p.rect(x - 1, topY, w + 2, 2, MAT.stone.base);
  p.hline(x - 1, topY, w + 2, MAT.stone.lite);
  p.hline(x - 1, topY + 1, w + 2, MAT.stone.dark);
  // the monitor: a casing, a lit face, a stand — the only screen a visitor is meant to see
  const m = F.monitor;
  const mx = x + 8;
  const mTop = topY - m.h;
  p.rect(mx, mTop, m.w, m.h, MAT.screen.bezel);
  p.rect(mx + 1, mTop + 1, m.w - 2, m.h - 3, MAT.screen.lit);
  p.hline(mx + 1, mTop + 1, m.w - 2, mix(MAT.screen.lit, C.white, 0.45));
  p.hline(mx + 2, mTop + 4, m.w - 4, mix(MAT.screen.lit, MAT.screen.face, 0.6));
  p.rect(mx + Math.round(m.w / 2) - 1, topY - 1, 3, 1, MAT.screen.bezel);
  // the phone, a cup and two sheets on the counter
  p.rect(x + 26, topY - 2, F.phone, 2, MAT.frame.base);
  p.px(x + 26, topY - 2, MAT.frame.lite);
  p.rect(x + 33, topY - 3, 2, 3, MAT.paper.base);
  p.hline(x + 33, topY - 3, 2, C.white);
  p.rect(x + 38, topY - 1, 6, 1, MAT.paper.base);
  // the bowl of the plant that always stands on a reception counter, 5 px of it
  p.rect(x + w - 12, topY - 4, 5, 4, MAT.stone.dark);
  p.rect(x + w - 11, topY - 6, 3, 2, MAT.plant.base);
  p.px(x + w - 10, topY - 7, MAT.plant.lite);
}

// The mat the entrance door opens onto: two rows on the floor, in the lobby and not outside.
function paintMat(p, pr) {
  const { x, w, base } = pr;
  p.rect(x, base - 1, w, 2, mix(C.ink2, C.slate, 0.3));
  p.hline(x, base - 1, w, mix(C.slate, C.stone, 0.25));
  p.hline(x + 1, base, w - 2, MAT.frame.dark);
  for (let i = x + 2; i < x + w - 1; i += 3) p.px(i, base - 1, mix(C.slate, C.ink, 0.2));
}

// The screen in the deciding room: a big panel on the wall, with a chart on it. It hangs, so
// it needs no stand and does not clutter the floor.
function paintWallScreen(p, pr) {
  const F = OFFICES.furniture.screen;
  const { x, w, bottom } = pr;
  const top = bottom - F.h + 1;
  p.rect(x, top, w, F.h, MAT.screen.bezel);
  p.hline(x, top, w, mix(MAT.screen.bezel, MAT.frame.lite, 0.35));
  p.rect(x + 1, top + 1, w - 2, F.h - 2, MAT.screen.face);
  // a bar chart and a line: the smallest drawing that reads as data
  const baseY = top + F.h - 3;
  for (let i = 0; i < 5; i++) {
    const bh = 2 + ((i * 7) % 8);
    p.rect(x + 4 + i * 5, baseY - bh, 3, bh, mix(MAT.screen.lit, MAT.screen.face, i === 3 ? 0 : 0.35));
  }
  p.hline(x + 3, baseY, w - 6, mix(MAT.screen.lit, MAT.screen.face, 0.6));
  p.hline(x + 3, top + 2, w - 10, mix(MAT.screen.lit, MAT.screen.face, 0.4));
}

function paintProps(p, room) {
  for (const prop of room.props) {
    switch (prop.kind) {
      case 'desk':
        paintDesk(p, prop);
        break;
      case 'plant':
        paintPlant(p, prop);
        break;
      case 'whiteboard':
        paintWhiteboard(p, prop);
        break;
      case 'pinboard':
        paintPinboard(p, prop);
        break;
      case 'table':
        paintTable(p, prop);
        break;
      case 'copier':
        paintCopier(p, prop);
        break;
      case 'shelf':
        paintShelf(p, prop);
        break;
      case 'cabinet':
        paintCabinet(p, prop);
        break;
      case 'sofa':
        paintSofa(p, prop);
        break;
      case 'tv':
        paintTv(p, prop);
        break;
      case 'bench':
        paintBench(p, prop);
        break;
      case 'counter':
        paintCounter(p, prop);
        break;
      case 'mat':
        paintMat(p, prop);
        break;
      case 'screen':
        paintWallScreen(p, prop);
        break;
      default:
        throw new Error(`offices: no painter for prop "${prop.kind}"`);
    }
  }
}

// ------------------------------------------------------------------ the lift

// One opening per floor, in the same columns, in the shaft's own brick and behind the glass:
// the two leaves (closed above, retracted on the ground floor where the car stands open), the
// steel rebate round the opening, the indicator over it and the call plate on the brick beside
// it. The seam the leaves meet on falls under a mullion, so the bar in front of the doors reads
// as that seam — the glazing is in front of the lift, and that is the point of it.
function paintLift(p, band) {
  const L0 = OFFICES.lift;
  const { x, w, top, bottom, cab } = band.lift;
  const f = L0.frame;
  const h = bottom - top + 1;
  // the rebate: a 2 px steel frame round the opening, standing a px proud of the brick
  p.rect(x - f, top - f, w + f * 2, f, MAT.frame.base);
  p.hline(x - f, top - f, w + f * 2, MAT.frame.lite);
  p.hline(x - f, top - 1, w + f * 2, MAT.frame.dark);
  for (const jx of [x - f, x + w]) {
    p.rect(jx, top - f, f, h + f, MAT.frame.base);
    p.vline(jx, top - f, h + f, MAT.frame.lite);
    p.vline(jx + f - 1, top - f, h + f, MAT.frame.dark);
  }
  if (cab) {
    // the car, standing open on the ground floor: a lit box, its back wall, the handrail and
    // the floor it shares with the lobby
    p.rect(x, top + 1, w, h - 2, mix(C.plaster, C.lamp, 0.18));
    p.hline(x, top + 1, w, mix(C.plasterLite, C.lamp, 0.3));
    p.vline(x + 1, top + 2, h - 4, mix(C.plasterLite, C.lamp, 0.24));
    p.vline(x + w - 2, top + 2, h - 4, mix(C.plaster, C.ink, 0.14));
    // the back wall's seam, and the handrail across it
    p.vline(x + Math.round(w / 2), top + 2, h - 6, mix(C.plaster, C.ink, 0.1));
    p.hline(x + 2, bottom - 13, w - 4, MAT.frame.base);
    p.hline(x + 2, bottom - 12, w - 4, MAT.frame.lite);
    // the ceiling light of the car, the one light with nothing in front of it
    p.rect(x + 4, top + 1, w - 8, 1, C.lamp);
    for (let i = 1; i <= 4; i++) p.hline(x + 3 - i, top + 1 + i, w - 6 + i * 2, rgba(C.lampWarm, 0.06));
    // the floor of the car, and the two leaves retracted into their pockets
    p.hline(x, bottom - 1, w, MAT.frame.dark);
    p.rect(x, top + 1, L0.open, h - 2, MAT.lift.face);
    p.vline(x, top + 2, h - 3, MAT.lift.lite);
    p.vline(x + L0.open - 1, top + 1, h - 2, MAT.lift.dark);
    p.rect(x + w - L0.open, top + 1, L0.open, h - 2, MAT.lift.face);
    p.vline(x + w - L0.open, top + 2, h - 3, MAT.lift.dark);
    p.vline(x + w - 1, top + 1, h - 2, MAT.lift.lite);
    // the light spilling out of the open car onto the lobby floor and up the jamb
    p.hline(x - f, bottom, w + f * 2, rgba(C.lampWarm, 0.16));
    for (let i = 1; i <= 3; i++) p.hline(x - i, top, 1, rgba(C.lampWarm, 0.1 - i * 0.03));
  } else {
    // the leaves, closed: two brushed panels with the seam between them and a kick at the foot
    const half = Math.round(w / 2);
    for (const [lx, lit] of [
      [x, true],
      [x + half, false],
    ]) {
      p.rect(lx, top, half, h, MAT.lift.face);
      p.vline(lit ? lx : lx + half - 1, top, h, lit ? MAT.lift.lite : MAT.lift.dark);
      // the brushed face: one lit column in from the stile, and the shadow of the seam
      p.vline(lx + (lit ? 1 : half - 2), top + 1, h - 2, mix(MAT.lift.face, MAT.lift.lite, 0.3));
      // the kick plate, 3 px of darker steel at the foot
      p.rect(lx, bottom - 3, half, 3, MAT.lift.dark);
      p.hline(lx, bottom - 3, half, mix(MAT.lift.face, MAT.lift.dark, 0.5));
    }
    p.vline(x + half - 1, top, h, MAT.lift.dark);
    // the threshold, and the shadow the closed doors sit in
    p.hline(x, bottom, w, mix(C.ink, MAT.frame.dark, 0.5));
    p.hline(x, top - 1, w, MAT.frame.dark);
  }
  // the indicator over the doors: a dark plate with a lit row in it, and no digits — at 2
  // physical px per art px a digit is a smudge, a lit row is a floor
  const ind = band.lift.indicator;
  p.rect(ind.x, ind.y, ind.w, ind.h, MAT.frame.dark);
  p.hline(ind.x, ind.y, ind.w, MAT.frame.base);
  p.rect(ind.x + 2, ind.y + Math.round(ind.h / 2) - 1, ind.w - 4, 1, cab ? C.lamp : mix(C.lamp, C.lampWarm, 0.6));
  // the call plate beside the doors, on every floor: a small dark plate with one lit button
  const call = band.lift.call;
  p.rect(call.x, call.y, call.w, call.h, MAT.frame.dark);
  p.hline(call.x, call.y, call.w, MAT.frame.base);
  p.hline(call.x, call.y + call.h - 1, call.w, MAT.frame.dark);
  p.px(call.x + 1, call.y + 2, C.lamp);
  // the company's plate over the ground floor's doors: the corporate accent, used once
  if (band.lift.plate) {
    const pl = band.lift.plate;
    p.rect(pl.x, pl.y, pl.w, pl.h, C.brand);
    p.hline(pl.x, pl.y, pl.w, C.brandLite);
    p.hline(pl.x, pl.y + pl.h - 1, pl.w, C.brandDark);
    p.vline(pl.x, pl.y, pl.h, C.brandLite);
    p.vline(pl.x + pl.w - 1, pl.y, pl.h, C.brandDark);
    // the mark: three bars of diminishing width over a baseline, sized off the plate's own width
    // so a narrower plate can never spill its logo onto the brick beside it
    const mx = pl.x + Math.round(pl.w * 0.18);
    const mw = pl.w - Math.round(pl.w * 0.36);
    const my = pl.y + 2;
    p.rect(mx, my, Math.round(mw * 0.34), 2, C.brandLite);
    p.rect(mx + Math.round(mw * 0.44), my, Math.round(mw * 0.28), 2, C.brandLite);
    p.rect(mx + Math.round(mw * 0.8), my, Math.round(mw * 0.16), 2, C.brandDark);
    p.hline(mx, my + 3, mw, C.brandDark);
  }
}

// ------------------------------------------------------------------ facade

// The 3 px transom under every slab: the frame the glass hangs from, across the whole bay, so
// each storey is a frame around its room and the four of them are one facade.
function paintTransomBand(p, band, L) {
  const t = OFFICES.transom;
  p.rect(L.glass.x, band.top, L.glass.w, t, MAT.frame.base);
  p.hline(L.glass.x, band.top, L.glass.w, MAT.frame.lite);
  p.hline(L.glass.x, band.top + t - 1, L.glass.w, MAT.frame.dark);
}

// The mullions: the same columns on all four floors, which is half of why the building reads
// as one. A lit arris, a dark return, and the foot of each bar seated in the sill's shadow.
function paintMullions(p, band, L) {
  const { bar } = OFFICES.grid;
  const y = band.y;
  const h = band.row - band.y + 1;
  for (const x of L.bars) {
    p.rect(x, y, bar, h, MAT.frame.base);
    p.vline(x, y, h, MAT.frame.lite);
    p.vline(x + bar - 1, y, h, MAT.frame.dark);
    p.hline(x, y, bar, MAT.frame.base);
    p.hline(x, band.row, bar, mix(MAT.frame.dark, C.ink, 0.45));
  }
}

// The entrance: two panes of the ground floor's glazing become a double door — two leaves, a
// meeting stile that is the mullion already there, a foot rail each, a pull bar, and a
// threshold. The lobby behind it is the room, so this is the only thing added to the skin.
function paintEntrance(p, band, L) {
  const d = band.door;
  const e = OFFICES.entrance;
  const top = band.y;
  const bottom = band.row;
  const midX = d.x + Math.round(d.w / 2) - 1;
  const leaves = [
    { x: d.x, w: midX - d.x + 1, outer: 1 },
    { x: midX + 1, w: d.x + d.w - midX - 1, outer: -1 },
  ];
  for (const leaf of leaves) {
    // the stile on the outer edge of the leaf, and the two rails
    const sx = leaf.outer > 0 ? leaf.x : leaf.x + leaf.w - e.stile;
    p.rect(sx, top, e.stile, bottom - top + 1, MAT.frame.base);
    p.vline(leaf.outer > 0 ? sx : sx + e.stile - 1, top, bottom - top + 1, leaf.outer > 0 ? MAT.frame.lite : MAT.frame.dark);
    p.rect(leaf.x, bottom - e.foot, leaf.w, e.foot, MAT.frame.base);
    p.hline(leaf.x, bottom - e.foot, leaf.w, mix(MAT.frame.base, MAT.frame.lite, 0.3));
    p.hline(leaf.x, bottom - 1, leaf.w, MAT.frame.dark);
    // the pull: one column of steel on the stile side of the meeting post, at hand height
    const pullX = leaf.outer > 0 ? leaf.x + leaf.w - 3 : leaf.x + 2;
    p.vline(pullX, top + e.pull.top, e.pull.h, MAT.frame.lite);
    p.vline(pullX + leaf.outer, top + e.pull.top, e.pull.h, MAT.frame.dark);
    p.px(pullX, top + e.pull.top - 1, MAT.stone.lite);
    p.px(pullX, top + e.pull.top + e.pull.h, MAT.stone.lite);
  }
  // the meeting stile, a step darker than a mullion: it is a door, not a window bar
  p.rect(midX, top, 2, bottom - top + 1, MAT.frame.base);
  p.vline(midX, top, bottom - top + 1, MAT.frame.dark);
  // the threshold, on the street line
  p.hline(d.x, bottom, d.w, mix(C.ink, MAT.frame.dark, 0.4));
}

// The 10 rows between two storeys: ribbed dark cladding across the glazing, over the glass and
// over the lift's bay alike, between the two brick piers. It is the building's heaviest
// horizontal, the band that ties the piers to each other and to the glass, and the number the
// street's block quotes (four storeys of 64 and three of these).
function paintSlabBand(p, band, L) {
  const { x, w } = L.glass;
  paintRibbed(p, x, band.slabTop, w, OFFICES.slab);
  // the joints the cladding is bolted on: one every 16, a touch darker than a rib
  for (let jx = x + 16; jx < x + w; jx += 16) p.vline(jx, band.slabTop + 2, OFFICES.slab - 4, rgba(C.ink, 0.12));
}

// ------------------------------------------------------------------ sprite

// The building, cached: nothing in it moves, so the page blits one canvas.
export function officesSprite() {
  return cacheSprite(cache, 'offices', () => {
    const L = officesLayout();
    const p = new Painter(L.w, L.h);
    // the masonry first, because everything else stands in front of it: the two piers, the roof
    // over and between them, the lift's own shaft behind the left end of the glass, and the
    // party wall's pipe and its bricked-up opening
    paintPiers(p, L);
    paintShaftFace(p, L);
    paintRoof(p, L);
    paintPartyWall(p, L);
    for (const band of L.bands) {
      for (const room of band.rooms) {
        paintRoomShell(p, room);
        paintCeiling(p, room);
        paintProps(p, room);
      }
      // the lift: one opening, in the same columns, on every floor — painted before the glass,
      // so the street sees it through the glazing and not stuck on the facade
      paintLift(p, band);
      // the glazing in one piece across the bay: the rooms and the shaft are behind it, which is
      // the whole of why the lift now reads as inside
      paintGlass(p, { x: L.glass.x, y: band.y, w: L.glass.w, h: band.row - band.y + 1 });
      // the partition after the veil: it is interior glass, and it has to stay legible
      if (band.rooms.length > 1) paintPartition(p, L, band);
      paintMullions(p, band, L);
      if (band.door) paintEntrance(p, band, L);
      paintTransomBand(p, band, L);
      paintSlabBand(p, band, L);
      // the names last, in the cladding above each window: on the building, not in the room
      for (const room of band.rooms) paintRoomLabel(p, band, room);
    }
    return p.sprite();
  });
}
