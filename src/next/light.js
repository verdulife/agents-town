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
// What is deliberately not here yet: the light falling on the FACADES (it would need each module to hand
// over its glass as a rectangle and its rooms as sources, and that is the next pass, not this one) and the
// wet road's reflections, which are still painted inside ground.js with fixed tones. Those are the two
// things `L` will own when the modules declare their lights instead of painting them.
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
    night: { ambient: 0.46, cast: -0.09, pool: 1, poolTone: 'lamp' },
    dawn: { ambient: 0.8, cast: 0.16, pool: 0.5, poolTone: 'lampWarm' },
    day: { ambient: 1, cast: 0.1, pool: 0.18, poolTone: 'glassLit' },
    dusk: { ambient: 0.72, cast: 0.2, pool: 0.8, poolTone: 'lampWarm' },
  },
  bands: 3, // every shape is painted as three nested bands
  shadow: { reach: 0.34, depth: 9, alpha: 0.5 }, // reach: share of a block's height that the shadow takes
  pool: { rows: 11, spread: 0.72, alpha: 0.2 },
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

export function glowSheet({ w, h, groundY, street, time = 'dusk' }) {
  const width = Math.max(1, Math.round(w));
  const rows = Math.max(1, Math.round(h));
  const key = `glow|${width}|${rows}|${groundY}|${time}|${street.blocks.map((b) => `${b.kind}${b.x}${b.w}`).join(',')}`;
  return cacheSprite(cache, key, () => {
    const p = new Painter(width, rows);
    paintPools(p, { w: width, groundY, h: rows, street, time });
    return p.sprite();
  });
}
