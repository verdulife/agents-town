// The scene's light (S27, L45): one place that decides how dark the street is at each moment, where the
// shadows fall and which windows light their own pavement.
//
// Why it exists: the scene was lit three times at once. The sky already answered to the hour, the ground
// painted its own warm pools and its own reflections with fixed palette tones, and the buildings were
// painted once and never responded to anything — so at `?sky=day` the road still reflected lit windows at
// noon. This module takes those decisions away from the painters and puts them in one contract.
//
// How it lands on the picture. The street is one opaque still; the page draws the sky, then the street, and
// the lighting is applied to the STREET only — the sky is already its own light and must not be darkened
// twice. Two maps, both at art resolution and both composed once per resize:
//
//   multiply   an opaque white sheet with the cast shadows on it. Multiplying by white changes nothing, so
//              the shadows are the only thing this pass does: the ground in front of a tall building is
//              darker than the ground in front of a low one, and the darker side is the side away from the
//              sun or the moon
//   lighter    a transparent sheet with the pools of light the glass throws: additive, because light adds
//              and paint does not
//
// Both are painted in BANDS and not with gradients: three nested shapes with three alphas, quantised by
// construction. A radial gradient at this size is a smudge, and the palette's rule for the whole scene is
// that a falloff is a step.
//
// Everything the street's light does now lives here: the ambient, the shadows, the pools on the pavement, the
// ring on the wall around a lit room and the same light lying on the wet road. `ground.js` keeps the water and
// nothing else, so a window at noon cannot still be reflecting at midnight.
//
// Deterministic: fixed seed, no clock, no Math.random, no colour literal. The moment is the palette's four
// names; a real hour would only have to pick a weight between two of them.

import { Painter, cacheSprite } from '../pixel.js';
import { C, mix, rgba } from './palette.js';

const cache = new Map();

// The one white in the file, and it is not a colour of the picture: a multiply sheet has to be multiplied
// by its own identity or every pass would dim the street by the difference between bone and white. This is
// a blend operand, like a zero alpha, and the check that forbids colour literals allows this one by name.
const MULTIPLY_IDENTITY = '#ffffff';

export const LIGHT = {
  // Per moment: how much of the street's own colour survives (1 = untouched, 0.5 = half the value), the
  // direction the shadows fall in art px per row of height, and how strong the glass is on the pavement.
  moments: {
    // `spare` is how much of a lit room keeps its own light through the ambient pass: at noon the street is
    // already the colour of the sky and a room is not a lamp, so it is spared almost nothing; at night a lit
    // room is the brightest thing on the street and the ambient has no business darkening it
    night: { ambient: 0.46, cast: -0.09, pool: 1, poolTone: 'lamp', spare: 0.86 },
    dawn: { ambient: 0.8, cast: 0.16, pool: 0.5, poolTone: 'lampWarm', spare: 0.6 },
    day: { ambient: 1, cast: 0.1, pool: 0.18, poolTone: 'glassLit', spare: 0.18 },
    dusk: { ambient: 0.72, cast: 0.2, pool: 0.8, poolTone: 'lampWarm', spare: 0.7 },
  },
  bands: 3, // every shape is painted as three nested bands
  shadow: { reach: 0.34, depth: 9, alpha: 0.5 }, // reach: share of a block's height that the shadow takes
  pool: { rows: 11, spread: 0.72, alpha: 0.2 },
  // the halo a lit room throws on the wall around it: one px per band, three bands, so the light dies on the
  // brick instead of ending at a line
  room: { reach: [1, 2, 3], alpha: 0.16 },
  // the same rooms' light lying on the wet road: a stub where it lands and then wide flat dashes stepping
  // down and out, because a vertical column in a 44-row road reads as something hanging off the kerb
  reflect: { rows: 26, wide: 13, alpha: 0.42, step: 3 },
  seed: 7307,
};

// The light of one moment, resolved: the ambient is a mix toward the sky's own cool ink so a dark hour is a
// dark BLUE street and not a grey one.
export function lightFor(time) {
  const spec = LIGHT.moments[time] ?? LIGHT.moments.dusk;
  const ambient = mix(C.white, mix(C.ink3, C.slate, 0.3), 1 - spec.ambient);
  return { ...spec, ambient };
}

// The cast shadows, as a multiply sheet: opaque white, then the shadow of each block on the ground. A block
// twice as tall throws one twice as long, and `cast` decides which side: negative at night, when the moon
// stands the other way.
function paintShadows(p, { w, groundY, h, street, time }) {
  const spec = lightFor(time);
  const S = LIGHT.shadow;
  p.rect(0, 0, w, h, MULTIPLY_IDENTITY);
  for (const block of street.blocks) {
    const reach = Math.round((block.h ?? 0) * S.reach * Math.abs(spec.cast) * 6);
    const dir = Math.sign(spec.cast) || 1;
    const depth = Math.min(S.depth, Math.max(3, Math.round((block.h ?? 0) / 40)));
    for (let i = 0; i < LIGHT.bands; i++) {
      const band = i / LIGHT.bands;
      const inset = Math.round(reach * band);
      const a = S.alpha * (1 - band * 0.55);
      // a trapezoid on the ground, on the side AWAY from the light and growing as it fades: with the sun
      // on the right (a positive cast, dusk) the shadow goes left, and at night the moon stands the other
      // way and it goes right
      const x0 = dir > 0 ? block.x - inset : block.x;
      const bandW = block.w + inset;
      p.rect(Math.max(0, x0), groundY + Math.round(i * (depth / LIGHT.bands)), bandW, Math.ceil(depth / LIGHT.bands), rgba(C.ink, a));
    }
  }
}

// The pools the glass throws on the pavement: three nested ellipses of warm light under each lit block, the
// widest and faintest first. Nothing for the alley (it has no glass) and nothing for the park (its ground is
// painted by park.js and a park lamp is next pass).
function paintPools(p, { w, groundY, h, street, time }) {
  const spec = lightFor(time);
  const P = LIGHT.pool;
  if (spec.pool <= 0.02) return;
  for (const block of street.blocks) {
    if (block.kind === 'alley' || block.kind === 'park') continue;
    const tone = C[spec.poolTone] ?? C.lampWarm;
    const spread = Math.round(block.w * P.spread);
    const cx = block.x + Math.round(block.w / 2);
    for (let i = 0; i < LIGHT.bands; i++) {
      const band = i / LIGHT.bands;
      const halfW = Math.round((spread / 2) * (1 - band * 0.42));
      const rows = Math.round(P.rows * (1 - band * 0.4));
      const a = P.alpha * spec.pool * (1 - band * 0.5);
      p.rect(cx - halfW, groundY, halfW * 2, rows, rgba(tone, a));
    }
  }
}

// The halo a lit room throws on the wall around it: a ring, three bands deep, outside the rectangle and never
// inside it (the interior is already its own light). Additive, warm, and weaker by day — a window at noon is
// brighter than the brick for the same reason it is at midnight, only less so.
function paintRoomGlow(p, { rooms, time }) {
  const spec = lightFor(time);
  const R = LIGHT.room;
  const strength = spec.spare; // the same hour that spares the room is the hour the room is worth lighting
  if (strength <= 0.2) return;
  const tone = C[spec.poolTone] ?? C.lampWarm;
  for (const room of rooms) {
    R.reach.forEach((reach, i) => {
      const a = R.alpha * strength * (1 - i * 0.3);
      const x0 = room.x - reach;
      const y0 = room.y - reach;
      const w = room.w + reach * 2;
      const h = room.h + reach * 2;
      // the ring: four thin rects, one band each, so the inside of the room is untouched
      p.rect(x0, y0, w, 1, rgba(tone, a));
      p.rect(x0, y0 + h - 1, w, 1, rgba(tone, a));
      p.vline(x0, y0, h, rgba(tone, a));
      p.vline(x0 + w - 1, y0, h, rgba(tone, a));
    });
  }
}

// The rooms' light on the wet road. Below the street line and only below it: what a light does to asphalt is a
// reflection of the water, not a shape of its own. Weighted by `spare`, so noon is dry tarmac and midnight is a
// street of lamps.
function paintRoadReflections(p, { rooms, time, roadTop, bottom }) {
  const spec = lightFor(time);
  const R = LIGHT.reflect;
  const strength = spec.spare;
  if (strength <= 0.25 || roadTop === null) return;
  const tone = C[spec.poolTone] ?? C.lampWarm;
  for (const room of rooms) {
    const cx = room.x + Math.round(room.w / 2);
    const seed = room.x * 7 + room.y;
    // the stub where the light lands on the water
    for (let r = 0; r < 4; r++) {
      p.hline(cx - 1, roadTop + r, 3, rgba(tone, R.alpha * strength * (0.8 - r * 0.15)));
    }
    // and the light broken across the wet, wide and flat, stepping down as the road comes nearer
    let y = 4;
    while (y < R.rows && roadTop + y < bottom) {
      const near = y / R.rows;
      const dashW = Math.max(3, Math.round(R.wide * (0.45 + near * 1.1)));
      const wobble = Math.round(Math.sin((y + seed) * 0.7) * 2);
      p.hline(cx - Math.round(dashW / 2) + wobble, roadTop + y, dashW, rgba(tone, R.alpha * strength * (0.5 - near * 0.3)));
      y += R.step;
    }
  }
}

export function shadowSheet({ w, h, groundY, street, time = 'dusk' }) {
  const width = Math.max(1, Math.round(w));
  const rows = Math.max(1, Math.round(h));
  const key = `shadow|${width}|${rows}|${groundY}|${time}|${street.blocks.map((b) => `${b.kind}${b.x}${b.w}${b.h}`).join(',')}`;
  return cacheSprite(cache, key, () => {
    const p = new Painter(width, rows);
    paintShadows(p, { w: width, groundY, h: rows, street, time });
    return p.sprite();
  });
}

export function glowSheet({ w, h, groundY, street, time = 'dusk', rooms = [], roadTop = null }) {
  const width = Math.max(1, Math.round(w));
  const rows = Math.max(1, Math.round(h));
  const key = `glow|${width}|${rows}|${groundY}|${roadTop}|${time}|${street.blocks.map((b) => `${b.kind}${b.x}${b.w}`).join(',')}|${rooms.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join(';')}`;
  return cacheSprite(cache, key, () => {
    const p = new Painter(width, rows);
    paintPools(p, { w: width, groundY, h: rows, street, time });
    paintRoomGlow(p, { rooms, time });
    paintRoadReflections(p, { rooms, time, roadTop, bottom: rows });
    return p.sprite();
  });
}
