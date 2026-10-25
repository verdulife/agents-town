// The proportion contract. Every sprite reads its sizes from here, so "make the
// NPC slimmer" or "give the facade more air" is a number change, not a redraw.
//
// The rule that matters most: a door is taller than a person. door.h is
// npc.h + ~10%, and the facade is door.h + 2px of margin above and below.

export const TILE = 16;

export const SPEC = {
  tile: TILE,

  npc: { w: 12, h: 20 },

  door: { w: 10, h: 22 },
  window: { w: 8, h: 9 },
  facade: 26, // door 22 + 2 above + 2 below

  house: {
    tilesW: 4,
    tilesH: 4, // 64x64: roof 38 + facade 26
    overhang: 3, // roof wider than the walls on each side
    roofRidge: 0.2, // ridge sits at 20% of the roof height
    ridgeWidth: 0.72, // ridge length as a fraction of the eave
  },

  tree: { size: 32, pad: 2 },
  bush: { size: 20, pad: 2 },
  prop: { max: 16 },
};

// Derived helpers used by the sprite builders.
export function houseGeometry(spec = {}) {
  const tw = spec.tilesW ?? SPEC.house.tilesW;
  const th = spec.tilesH ?? SPEC.house.tilesH;
  const over = SPEC.house.overhang;
  const W = tw * TILE + over * 2;
  const H = th * TILE;
  const facadeH = spec.facade ?? SPEC.facade;
  return { W, H, over, facadeH, roofH: H - facadeH };
}

export function doorFitsNpc(npc = SPEC.npc, door = SPEC.door) {
  return door.h >= npc.h && door.h <= npc.h * 1.35 && door.w >= npc.w - 4;
}
