// The sky (S26, L37): a ramp, a horizon haze, a distant city and clouds that move, painted behind the
// street instead of as a flat gradient.
//
// What was here: `paintSky` interpolated the palette's four stops into up to fourteen flat bands and
// that was the whole sky — no stars, no moon, no clouds, no distance. It is the largest surface in
// the frame, so it was the most obvious thing wrong with the scene.
//
// The reference is `refs/background.webp` (a night street on a hill), measured rather than imitated.
// What it does, and what this module reproduces:
//
//   the ramp      12-14 steps, not 4, crowding toward the horizon, with noisy seams. Here the four
//                 palette stops are resolved into ten bands with a curve that crowds them near the
//                 horizon, and each seam is dithered two rows deep. The stops stay the palette's: the
//                 sky resolves its ramp finer, it does not invent four more colours
//   the stars     1-2 px, three brightnesses, occluded by the clouds — one sprite of the whole field,
//                 three frames, so the twinkle is a blit and not a per-star loop
//   the moon      a 3 px square, bone, with a 1 px halo: at 2 physical px per art px a disc is a smudge
//                 and the reference knows it
//   the clouds    two banks and their cirrus. The banks are cumulus puffs off a width table (the
//                 device the trees and the rooms already use), three tones, and the light is UNDER
//                 them: the underside takes the horizon tone mixed toward white, which is why the
//                 clouds are amber at dusk and cyan at night. That is the single most valuable thing
//                 the reference has to teach, and it is derived, not painted in
//   the haze      a pale band between the sky and the city. Three planes of city are separated by
//                 VALUE and not by outline: the far towers are the haze tone itself, the hillside is
//                 two steps darker with a field of 1 px warm windows, the near roofs are almost ink
//   the lights    the only saturated thing up there, and the only thing that moves slowly: window
//                 clusters that come on and go off on their own periods, two antenna beacons at 2 s
//
// What is deliberately NOT taken from the reference: its noise (35 396 unique tones in the sky region;
// that is an artifact of how the image was made, not a technique), pure white (our brightest is bone),
// and its saturation — the palette's third rule keeps the structure quiet so the lights can be loud.
//
// ONE VALUE, THREE USERS: `horizonTone(time)` is what the haze is painted with, what the cloud's
// underside is mixed from, and what the wet road in ground.js reflects. If the horizon moves, all
// three move together.
//
// The sky is painted into a still of its own, behind the street's, because the street's still is one
// opaque picture: a drifting cloud drawn with the street's moving parts would cross the offices.
// `paintSkyBackdrop` fills the sky zone of that still and `skyAnimations` hands the page the few
// elements that move, all with `origin: 'sky'`.
//
// Deterministic: fixed seed, no clock read, no Math.random, no colour literal. Times are the
// palette's four names; a real hour would only have to pick a position between two of them.

import { Painter, cacheSprite } from '../pixel.js';
import { C, SKY, mix, rgba } from './palette.js';
import { makeRng } from '../rng.js';

const cache = new Map();

export const SKYSCAPE = {
  // the sky is a gradient, not a spectrum of flat bands: twenty-eight steps of a ramp whose stops are
  // the palette's four, with the seams seeded with noise so no boundary is a line you can read
  bands: 28,
  curve: 1.18, // >1 crowds the steps toward the horizon
  seam: 3, // rows of noise on each seam
  starZone: 0.62, // the stars live in the top share of the visible sky
  stars: { count: 44, frames: 3, fps: 1.4, sizes: [1, 1, 1, 2], bright: 4 },
  // the bodies are ours and not the reference's: bigger and round, with the halo hugging the disc. The
  // phases are the gaps, not the clock — a 326 px office stands in the middle of the frame, so each
  // moment starts its body where the street leaves sky and it drifts from there
  bodies: {
    night: { kind: 'moon', phase: 0.14, size: 9, drift: 900 },
    dawn: { kind: 'sun', phase: 0.04, size: 11, drift: 900 },
    day: { kind: 'sun', phase: 0.23, size: 12, drift: 900 },
    dusk: { kind: 'sun', phase: 0.92, size: 12, drift: 900 },
  },
  clouds: {
    // big in WIDTH and not in height, varied from one bank to the next, and connected: the puffs
    // overlap with steps of a pixel or two and the tones sit one or two steps off the sky, so a cloud
    // is a shape in the air and not a rock with snow under it
    banks: 2,
    w: 260,
    h: 66,
    puffs: { min: 10, max: 15 },
    crown: { min: 7, max: 12 },
    at: [0.06, 0.3], // share of the VISIBLE band over the roofs, one under the other
    cirrus: 7, // static wisps, one px rows, above the banks
  },
  // The landscape behind the street, drawn first and reaching the street's own line so nothing floats
  // and no band of sky is left between it and our roofs: a hill on the left with a few houses on it,
  // the town in the middle, and a calm water on the right with one boat. Nothing on the water moves.
  landscape: {
    hill: { peak: 0.5, at: 0.05, width: 0.22, houses: 5, house: { w: [9, 17], h: [7, 11] } },
    // the town stands where the street leaves it a window: above the gym, between the offices and the
    // park. Behind the offices it is invisible and behind the alley there is the niche's own sprite, so
    // the middle of the frame is the gym's roof and that is where the town has to be
    // the town is seen on BOTH sides of the offices: in the slot the alley leaves between the café and
    // the tower, and above the gym to the right. The offices hide the middle and that is correct
    town: { from: 0.19, to: 0.84, h: [130, 250], windows: 0.05, w: [14, 44], gap: [2, 8] },
    // two masts on the town's tallest towers, drawn by the landscape and lit by the animation list: the
    // beacon has to blink on something, and these are the two points both sides agree on
    masts: [
      { at: 0.6, h: 252 },
      { at: 0.72, h: 236 },
    ],
    water: { from: 0.8, level: 74, rows: 16 },
    // the low mountain behind the water's horizon, in rows above the waterline
    farBank: [5, 14], // level: rows above the street line where the water sits
    near: { count: 7, h: 12 },
    haze: 0.28,
  },
  // The clouds are the one part of the sky the weather will drive: `cover` is how much of the strip they
  // take and `drop` how far the whole cloud sits below the frame's tone (a storm is dark and low). Only
  // `clear` exists today — rain and storm add an entry here and one to the page's query string — so the
  // hook is in the contract from the start instead of being retrofitted over eight call sites.
  weather: {
    clear: { cover: 1, drop: 0 },
  },
  // the boat, on the lake, with a routine as simple as the cat's is long: it crosses the water it can be
  // seen on, takes its time, is away for the rest of the cycle and comes back. Two frames, one of them a
  // pixel of swell under the hull
  boat: { frames: 2, fps: 1.2, period: 140, crossing: 90, size: 9 },
  birds: {
    flocks: 2,
    size: 3,
    frames: 2,
    fps: 6,
    // a long routine, in the cat's spirit: a flock crosses every `period` seconds, taking `crossing`
    // of them to fly the frame, with its own height and its own start
    period: [52, 97],
    crossing: [26, 38],
  },
  lights: { clusters: 6, w: 20, h: 14, periods: [26, 41, 58, 73, 34, 47] },
  beacon: { count: 2, period: 2, size: 1 },
  seed: 1201,
};

// The rows of sky the street actually leaves visible. `clear` is what the page measures above its
// tallest roof; when the buildings fill the frame that is nothing, and the sky's features fall back
// to the upper half of the zone so they still show in the gaps between blocks.
function bandOf(h, clear) {
  return clear > 24 ? clear : Math.max(24, Math.round(h * 0.5));
}

// ---------------------------------------------------------------- the ramp

const times = SKY.map((entry) => entry.name);

export function skyTimes() {
  return times.slice();
}

function rampOf(time) {
  const entry = SKY.find((s) => s.name === time) ?? SKY[SKY.length - 1];
  return entry.steps.map((key) => C[key]);
}

// The horizon of a moment: the last stop of its ramp. This is the one value the haze, the cloud's
// underside and the wet road all use.
export function horizonTone(time) {
  const stops = rampOf(time);
  return stops[stops.length - 1];
}

// `u` in [0, 1] down the sky, resolved off the palette's four stops.
function rampTone(stops, u) {
  const t = Math.max(0, Math.min(1, u)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  return mix(stops[i], stops[i + 1], t - i);
}

// The lighting of one moment, derived and never written twice: the cloud's underside is the horizon
// mixed toward bone (and toward the lamp at the two warm hours), the city's haze is the horizon, and
// the far city is the haze two steps into the sky's own ink.
function lightOf(time) {
  const horizon = horizonTone(time);
  const warm = time === 'dusk' || time === 'dawn' ? (time === 'dusk' ? 0.42 : 0.3) : 0;
  const under = mix(mix(horizon, C.white, 0.55), C.lampWarm, warm);
  // which way the clouds are lit: the sun is above them by day and under their edge at the two warm
  // hours, which is the difference between a cumulus and a rock with snow on it
  const day = time === 'day';
  const topLit = day;
  return {
    horizon,
    under,
    cloud: {
      // a cloud is water, and water lit by a low sky is WHITE — the grey of the second pass was slate and
      // stone mixed in, and it is what made them read as rock. The body is bone pulled a fifth of the way
      // toward the horizon (so a night cloud is a cool white and a dusk one a warm one), the shadow on
      // its base is a stone grey and never ink, and the lit side goes almost to white
      body: mix(C.white, horizon, 0.2),
      base: mix(mix(C.white, horizon, 0.16), C.stone, 0.34),
      lite: mix(C.white, topLit ? horizon : under, 0.22),
      topLit,
    },
    haze: mix(horizon, C.white, 0.24),
    far: mix(horizon, C.ink, 0.12),
    hillside: mix(horizon, C.ink, 0.52),
    near: mix(horizon, C.ink, 0.8),
    window: mix(C.lampWarm, C.sand, 0.25),
    farWindow: mix(C.lampWarm, horizon, 0.45),
    beacon: mix(C.brand, C.lamp, 0.35),
    // the landscape: three planes by value, from the hill's haze to the near roofs. At day the water is
    // a blue of its own — made of the horizon it is warm, and a warm sea at noon reads as concrete
    // under fog. The boat is a silhouette on it
    ridge: mix(horizon, C.ink, 0.42),
    hill: mix(horizon, C.ink, 0.6),
    town: mix(horizon, C.ink, 0.68),
    roof: mix(horizon, C.ink, 0.82),
    water: day ? mix(mix(C.skyDay0, C.glassLite, 0.35), C.waterLite, 0.2) : mix(horizon, C.ink, 0.34),
    waterLine: day ? mix(C.waterLite, C.white, 0.35) : mix(horizon, C.white, 0.42),
    boat: mix(C.ink, C.slate, 0.28),
    // the sun is the palette's lamp with the horizon's warmth under it; the moon is bone and cold
    sun: mix(C.lamp, C.glassLit, 0.4),
    sunHalo: mix(C.glassLit, horizon, 0.35),
    moon: mix(C.white, C.stoneLite, 0.3),
    moonHalo: mix(C.stoneLite, C.white, 0.2),
  };
}

// The bands: a curve that crowds the steps near the horizon, each seam dithered two rows so no
// boundary is a ruled line across the whole frame.
function paintRamp(p, w, h, time) {
  const G = SKYSCAPE;
  const stops = rampOf(time);
  const edges = [];
  for (let i = 0; i <= G.bands; i++) edges.push(Math.round(h * Math.pow(i / G.bands, G.curve)));
  for (let i = 0; i < G.bands; i++) {
    const y0 = edges[i];
    const y1 = i === G.bands - 1 ? h : edges[i + 1];
    p.rect(0, y0, w, y1 - y0, rampTone(stops, i / G.bands));
  }
  // and no seam dither on top: a checkerboard or a speckle of dots reads as a dotted rule across the
  // whole frame at 3x. The reference's seams are noisy, but its noise is an artifact of how the image
  // was made; a clean step is what the rest of the scene does with its bands, and it is honest.
}

// ------------------------------------------------------------- the distance

// The landscape behind the street: a hill on the left with houses on it, the town in the middle and a
// calm water on the right with a boat. One continuous mass, and its base is the STREET'S OWN LINE —
// `h - 1`, the row our buildings stand on — so nothing floats and no band of empty sky is left between
// the distance and our roofs. Where it is tall enough it shows above them (the hill over the café, the
// town between the alley and the offices, the water over the park); where it is not, our buildings
// cover it, which is what happens when you stand in a street.
//
// Separation is by value and by haze, as everywhere else in this scene: the ridge furthest away is the
// horizon mixed toward ink, the hill in front of it two steps darker, the town darker still, and the
// near roofs almost ink. The water is one flat value with a pale line at its edge, and it does not
// reflect or move: it is a lake at rest with a boat on it.
function paintLandscape(p, w, h, time, rng) {
  const D = SKYSCAPE.landscape;
  const L = lightOf(time);
  const base = h - 1;
  const peak = Math.round(Math.min(h * D.hill.peak, h - 8));
  const waterX = Math.round(w * D.water.from);
  const waterTop = Math.max(2, base - D.water.level);

  // the ridge: one profile for the whole width, high on the left and falling away to the water, made of
  // two or three smooth bumps so the silhouette connects instead of stepping
  const ridgeAt = (x) => {
    const t = x / Math.max(1, w);
    const hill = Math.exp(-Math.pow((t - D.hill.at) / D.hill.width, 2));
    const shoulder = 0.42 * Math.exp(-Math.pow((t - 0.44) / 0.2, 2));
    const swell = 0.18 * Math.exp(-Math.pow((t - 0.52) / 0.14, 2));
    const drop = t > D.water.from ? Math.max(0, 1 - (t - D.water.from) / 0.12) : 1;
    return Math.round(peak * Math.max(0, (hill + shoulder + swell) * drop));
  };
  for (let x = 0; x < w; x++) {
    const top = base - ridgeAt(x);
    p.vline(x, top, base - top + 1, L.ridge);
  }
  // the crest: one row of haze where the mass meets the sky, because a hill against a sky is a soft
  // edge and not a cut, and a few darker bumps along it for the trees that grow there
  for (let x = 0; x < w; x++) {
    const top = base - ridgeAt(x);
    p.px(x, top, rgba(L.waterLine, 0.16));
    if (x % 3 === 0 && ridgeAt(x) > 40) p.px(x, top - 1, rgba(L.hill, 0.5));
  }
  // the hill in front of the ridge, on the left: the same profile a little lower and a step darker, so
  // the two planes read as one slope with depth
  for (let x = 0; x < Math.round(w * 0.46); x++) {
    const top = base - Math.round(ridgeAt(x) * 0.82);
    p.vline(x, top, base - top + 1, L.hill);
  }
  // the town: prisms standing on the ground, from the hill's foot to the water's edge, of many widths
  // and heights, some with a stepped roof. The tall ones own the beacons.
  const townFrom = Math.round(w * D.town.from);
  const townTo = Math.round(w * D.town.to);
  let x = townFrom;
  while (x < townTo) {
    const bw = D.town.w[0] + Math.floor(rng() * (D.town.w[1] - D.town.w[0]));
    const bh = Math.round(D.town.h[0] + rng() * (D.town.h[1] - D.town.h[0]));
    const top = base - bh;
    p.rect(x, top, bw, bh, L.town);
    // a stepped crown: a setback and, on some, a slab on top. A tower that ends in one flat row reads as
    // a post, which is what the first pass in this band looked like. Each piece is placed on the piece
    // below it — `roofTop` walks up as they are added — so the antenna always starts on a roof: left at
    // `top - 12` it hung in the air over the buildings that had no setback
    let roofTop = top;
    if (bw > 9 && rng() < 0.7) {
      p.rect(x + 2, top - 4, bw - 4, 4, L.town);
      roofTop = top - 4;
    }
    if (bw > 13 && rng() < 0.4) {
      p.rect(x + 4, roofTop - 4, Math.max(3, bw - 8), 4, L.town);
      roofTop -= 4;
    }
    if (bw > 11 && rng() < 0.35) p.rect(x + Math.round(bw / 2), roofTop - 4, 1, 4, L.town);
    for (let y = top + 3; y < base - 3; y += 3) {
      for (let px = x + 2; px < x + bw - 2; px += 3) {
        if (rng() > D.town.windows) continue;
        p.px(px, y, L.window);
      }
    }
    x += bw + D.town.gap[0] + Math.floor(rng() * (D.town.gap[1] - D.town.gap[0]));
  }
  // the two masts: a slim tower and a one px mast, so the beacon above has something to stand on
  for (const mast of D.masts) {
    const mx = Math.round(w * mast.at);
    const mTop = base - mast.h;
    p.rect(mx, mTop, 4, mast.h, L.town);
    p.vline(mx + 1, mTop - 4, 4, L.town);
  }
  // the far bank: the low mountain that sits behind the water's horizon, a run of soft humps in the
  // ridge's own tone. It is what gives the lake a far side instead of an edge of the frame, and it is
  // drawn BEFORE the water so the water cuts its foot
  const bankH = D.farBank;
  let bx = waterX;
  while (bx < w) {
    const bw = 12 + Math.floor(rng() * 26);
    const bh = Math.round(bankH[0] + rng() * (bankH[1] - bankH[0]));
    for (let i = 0; i < bw; i++) {
      const hump = Math.max(1, Math.round(bh * Math.sin((i / bw) * Math.PI)));
      const top = waterTop - hump;
      p.vline(bx + i, top, waterTop - top, L.ridge);
      p.px(bx + i, top, rgba(L.waterLine, 0.12));
    }
    bx += bw - 2;
  }
  // the water: a flat band from the shoreline to the right edge, its pale line at the top, the shore
  // curving up into the hill where the two meet
  p.rect(waterX, waterTop, w - waterX, base - waterTop + 1, L.water);
  p.hline(waterX, waterTop, w - waterX, rgba(L.waterLine, 0.4));
  p.hline(waterX, waterTop + 1, w - waterX, rgba(L.waterLine, 0.14));
  for (let i = 0; i < 14; i++) {
    const y = waterTop + 3 + Math.floor(rng() * (D.water.rows - 3));
    p.hline(waterX + 4 + Math.round(rng() * (w - waterX - 12)), y, 2 + Math.floor(rng() * 6), rgba(L.waterLine, 0.08));
  }
  // the houses on the hill: a few small masses with a pitched roof and one window each, seated on the
  // slope so they read as being on it and not floating over it
  // the ridge is a slope, so a house needs a level platform: the ground under its whole footprint is
  // sampled and the LOWEST row — the downhill edge — is the one it stands on. Seated on the ridge at a
  // single column instead, the downhill corner hangs over the slope with sky under it, which is what
  // "floating" looked like
  const groundAt = (x) => base - ridgeAt(x) + 1;
  for (let i = 0; i < D.hill.houses; i++) {
    // the houses sit on the RIDGE, which is the surface that is actually seen above our roofs: the near
    // hill plane is lower and the café covers all of it, so a house placed there is a house nobody sees
    const hx = Math.round(w * (0.02 + 0.2 * rng()));
    const hw = D.hill.house.w[0] + Math.floor(rng() * (D.hill.house.w[1] - D.hill.house.w[0]));
    const hh = D.hill.house.h[0] + Math.floor(rng() * (D.hill.house.h[1] - D.hill.house.h[0]));
    let groundRow = 0;
    for (let x = hx; x <= hx + hw; x++) groundRow = Math.max(groundRow, groundAt(x));
    // the platform: the wedge between the slope and the level the house stands on, in the hill's own
    // tone, so the uphill side is cut into the hill instead of standing on a plinth of air
    for (let x = hx; x <= hx + hw; x++) {
      const g = groundAt(x);
      if (g < groundRow) p.vline(x, g, groundRow - g, L.hill);
    }
    // the ledge it stands on, a row wider on each side and a step darker, and then the mass
    p.hline(hx - 1, groundRow, hw + 2, L.roof);
    p.rect(hx, groundRow - hh, hw, hh, L.town);
    p.hline(hx, groundRow - hh, hw, mix(L.town, L.waterLine, 0.12));
    // the pitched roof: a stepped triangle over the width, which is what reads at this size
    // a pitched roof: widest at its eaves and narrowest at its ridge. Built the other way round — which
    // is what the first pass did — a house with a 12 px roof reads as a mushroom
    const roofH = Math.max(2, Math.round(hw / 3));
    for (let r = 0; r < roofH; r++) {
      const inset = Math.round(((r + 1) / (roofH + 1)) * (hw / 2));
      p.hline(hx + inset, groundRow - hh - r - 1, Math.max(1, hw - inset * 2), L.town);
    }
    // one lit window and a door, both a pixel, so the house is lived in and not a block
    p.px(hx + Math.max(1, hw - 3), groundRow - Math.max(2, hh - 3), L.window);
    p.px(hx + 1, groundRow - 1, mix(L.town, C.ink, 0.4));
  }
  // the near roofs at the frame's edges, almost ink: they are what makes the rest read as a valley
  for (let i = 0; i < D.near.count; i++) {
    const bw = 14 + Math.floor(rng() * 34);
    const bh = 6 + Math.floor(rng() * D.near.h);
    const left = rng() < 0.5;
    const rx = left ? Math.floor(rng() * w * 0.16) : w - bw - Math.floor(rng() * w * 0.16);
    p.rect(rx, base - bh, bw, bh + 1, L.roof);
  }
}

// The cirrus: one px rows in a tone a step off the sky, in broken runs. Texture, not shape — the
// reference's high cloud is barely there and that is what makes the bank below feel solid.
function paintCirrus(p, w, clear, time, rng) {
  const L = lightOf(time);
  const tone = mix(rampTone(rampOf(time), 0.34), C.white, 0.18);
  for (let i = 0; i < SKYSCAPE.clouds.cirrus; i++) {
    const y = Math.round(Math.max(2, bandOf(clear * 2, clear)) * (0.06 + rng() * 0.62));
    let x = Math.round(rng() * (w - 30));
    const runs = 2 + Math.floor(rng() * 3);
    for (let r = 0; r < runs; r++) {
      const len = 16 + Math.floor(rng() * 34);
      p.hline(x, y + (rng() < 0.3 ? 1 : 0), len, rgba(tone, 0.3 + rng() * 0.28));
      // a second, fainter row under the run: a wisp has a soft side, not a dotted edge
      if (rng() < 0.6) p.hline(x + 3, y + 1, Math.max(2, len - 8), rgba(tone, 0.16));
      x += len + 3 + Math.floor(rng() * 10);
    }
  }
}

// ------------------------------------------------------------------ clouds

// The puffs' width profile, as a table of rows read top to bottom: `[inset, width]` as a share of the
// puff's own box. The profile is interpolated per row when it is stamped (see paintBank) — the table is
// the shape, never the step.
const PUFF_ROWS = [
  [0.42, 0.28],
  [0.3, 0.52],
  [0.2, 0.74],
  [0.12, 0.9],
  [0.06, 1],
  [0.02, 0.96],
  [0.0, 0.84],
];

// A cumulus, painted once into the sky: the puffs are stamped into a mask and the mask is shaded per
// COLUMN, so the lit underside follows the lumps. Shading each puff as it is drawn gives every puff its
// own highlight band and the union reads as a shelf; stepping the width table instead of interpolating
// it gives five-row blocks, and five-row blocks are crenellations.
//
// They do not move. What moves in this sky is the light: the sun and the moon, the birds, the sea's
// glints and the city's windows.
function paintBank(p, { x, y, w: bw, h: bh, time, seed }) {
  const G = SKYSCAPE.clouds;
  const L = lightOf(time).cloud;
  const rng = makeRng(SKYSCAPE.seed + seed * 733);
  const mask = new Uint8Array(bw * bh);
  const widthAt = (t) => {
    const rows = PUFF_ROWS;
    const pos = Math.max(0, Math.min(1, t)) * (rows.length - 1);
    const i = Math.min(rows.length - 2, Math.floor(pos));
    const f = pos - i;
    return {
      inset: rows[i][0] + (rows[i + 1][0] - rows[i][0]) * f,
      width: rows[i][1] + (rows[i + 1][1] - rows[i][1]) * f,
    };
  };
  const stamp = (cx, scale, lift) => {
    const pw = Math.round(bw * 0.3 * scale);
    // 0.7, not 0.82: the crown has to fit inside the box, or the sprite's own edge cuts it into the
    // flat top the first pass had
    const ph = Math.round(bh * 0.78 * scale);
    const bx = cx - Math.round(pw / 2);
    const by = bh - ph - lift;
    for (let row = 0; row < ph; row++) {
      const { inset, width } = widthAt(row / Math.max(1, ph - 1));
      const rw = Math.max(1, Math.round(pw * width));
      const rx = bx + Math.round(pw * inset) + Math.round((pw - rw) / 2);
      const yy = by + row;
      if (yy < 0 || yy >= bh) continue;
      for (let xx = Math.max(0, rx); xx < Math.min(bw, rx + rw); xx++) mask[yy * bw + xx] = 1;
    }
  };
  const puffs = G.puffs.min + Math.floor(rng() * (G.puffs.max - G.puffs.min + 1));
  for (let i = 0; i < puffs; i++) {
    const cx = Math.round(bw * (0.08 + 0.84 * ((i + 0.5) / puffs)));
    const share = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / puffs);
    stamp(cx, share, Math.round(rng() * 6));
  }
  const crown = G.crown.min + Math.floor(rng() * (G.crown.max - G.crown.min + 1));
  for (let i = 0; i < crown; i++) {
    const cx = Math.round(bw * (0.1 + 0.8 * ((i + 0.7) / crown)));
    stamp(cx, 0.28 + 0.26 * rng(), Math.round(bh * (0.28 + rng() * 0.3)));
  }
  for (let cx = 0; cx < bw; cx++) {
    let y0 = -1;
    let y1 = -1;
    for (let cy = 0; cy < bh; cy++) {
      if (!mask[cy * bw + cx]) continue;
      if (y0 < 0) y0 = cy;
      y1 = cy;
    }
    if (y0 < 0) continue;
    const span = y1 - y0;
    for (let cy = y0; cy <= y1; cy++) {
      if (!mask[cy * bw + cx]) continue;
      const t = span ? (cy - y0) / span : 0;
      // top-lit: bright crown, dark base. Underlit: dark mass, bright underside, which is the
      // reference's signature at dusk and what makes a night cloud read as a cloud
      const tone = L.topLit
        ? t < 0.1 ? L.lite : t < 0.2 ? mix(L.lite, L.body, 0.5) : t < 0.58 ? L.body : L.base
        : t > 0.9 ? L.lite : t > 0.8 ? mix(L.lite, L.base, 0.5) : t > 0.42 ? L.base : L.body;
      p.px(x + cx, y + cy, tone);
    }
  }
}

// The clouds of one moment: one bank over the roofs and one across the middle of the sky, big enough
// to be a shape and not a smudge, placed in the visible band so a building cannot hide all of one.
function paintClouds(p, w, h, clear, time, weather = 'clear') {
  const G = SKYSCAPE.clouds;
  const spec = SKYSCAPE.weather[weather] ?? SKYSCAPE.weather.clear;
  if (spec.cover <= 0) return;
  const band = Math.max(G.h * 2, bandOf(h, clear)) + spec.drop;
  for (let i = 0; i < G.banks; i++) {
    const bw = Math.round(Math.min(w * 0.58, G.w * (i === 0 ? 1 : 1.12)));
    const bh = Math.round(G.h * (i === 0 ? 1 : 0.72));
    // one high on the right, one low on the left: the sky's left flank is where each moment puts its
    // sun or its moon, and a bank there would be a cloud in front of the light for most of the cycle
    const x = i === 0 ? Math.round(w * 0.5) : Math.round(w * 0.02);
    const y = Math.round(band * (i === 0 ? G.at[0] : 0.52));
    paintBank(p, { x, y, w: bw, h: bh, time, seed: i + 1 });
  }
}

// ------------------------------------------------------------- the moving bits

// The star field, one sprite per frame: 1-2 px stars in three brightnesses, at fixed columns, with the
// frame only changing how much of each one shows. One blit, and the twinkle is deterministic.
function starSprite(time, frame, w, h) {
  return cacheSprite(cache, `stars|${time}|${frame}|${w}|${h}`, () => {
    const G = SKYSCAPE.stars;
    const p = new Painter(w, h);
    const rng = makeRng(SKYSCAPE.seed + 41);
    const field = [];
    for (let i = 0; i < G.count; i++) {
      field.push({
        x: Math.round(rng() * (w - 1)),
        y: Math.round(rng() * (h * SKYSCAPE.starZone)),
        s: G.sizes[Math.floor(rng() * G.sizes.length)],
        bright: rng() < G.bright / G.count,
        phase: Math.floor(rng() * G.frames),
      });
    }
    const tone = mix(C.white, horizonTone(time), 0.12);
    for (const star of field) {
      // three frames: full, a step down, and two steps down, so the sky breathes instead of blinking
      const step = (frame + star.phase) % G.frames;
      const alpha = star.bright ? [0.95, 0.7, 0.5][step] : [0.6, 0.4, 0.3][step];
      p.rect(star.x, star.y, star.s, star.s, rgba(tone, alpha));
    }
    return p.sprite();
  });
}

// The sun and the moon: ours, not the reference's. Bigger and round — a radius of five or six art px —
// with the halo hugging the disc as two faint rings instead of standing off it, and no shadow pixels on
// the moon: at this size a moon is a clean disc and every pixel of "texture" on it is dirt.
function bodySprite(time) {
  return cacheSprite(cache, `body|${time}`, () => {
    const spec = SKYSCAPE.bodies[time];
    const L = lightOf(time);
    const r = spec.size / 2;
    const size = Math.ceil(spec.size) + 10;
    const p = new Painter(size, size);
    const c = Math.floor(size / 2);
    const core = spec.kind === 'sun' ? L.sun : L.moon;
    const halo = spec.kind === 'sun' ? L.sunHalo : L.moonHalo;
    // the halo hugs the disc: two rings at a step and a half of the radius, and nothing beyond
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d <= r + 0.55) p.px(x, y, rgba(halo, 0.4));
        else if (d <= r + 1.6) p.px(x, y, rgba(halo, 0.18));
      }
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (Math.hypot(x - c, y - c) > r) continue;
        p.px(x, y, core);
      }
    }
    // one lit quarter, which is what makes it a sphere and not a sticker
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (Math.hypot(x - c + 1, y - c + 1) > r * 0.72) continue;
        p.px(x, y, mix(core, C.white, 0.4));
      }
    }
    return p.sprite();
  });
}

// The boat: a hull, a mast and a sail, with two frames — the second lifts the hull a pixel on the swell.
// It is a silhouette with one pale sail, because on this water at this size anything more is noise.
function boatSprite(time, frame) {
  return cacheSprite(cache, `boat|${time}|${frame}`, () => {
    const G = SKYSCAPE.boat;
    const L = lightOf(time);
    const p = new Painter(G.size, 10);
    const lift = frame === 0 ? 0 : 1;
    const y = 8 - lift;
    // hull, with one pixel of bow standing proud
    p.hline(1, y, 6, L.boat);
    p.hline(0, y + 1, 2, L.boat);
    p.hline(6, y + 1, 2, L.boat);
    // mast and sail
    p.vline(4, y - 5, 5, L.boat);
    p.rect(5, y - 5, 3, 4, mix(C.white, L.waterLine, 0.35));
    // the swell: one row of the water's own light under the hull
    p.hline(2, y + 2, 5, rgba(L.waterLine, 0.25));
    return p.sprite();
  });
}

// A bird: three pixels and two frames, wings up and wings down. It is a silhouette against the sky and
// nothing more — a dozen of these at a distance is enough.
function birdSprite(time, frame) {
  return cacheSprite(cache, `bird|${time}|${frame}`, () => {
    const G = SKYSCAPE.birds;
    const p = new Painter(G.size, 2);
    const ink = mix(C.ink, C.slate, 0.3);
    if (frame === 0) {
      p.px(0, 0, ink);
      p.px(2, 0, ink);
      p.px(1, 1, ink);
    } else {
      p.px(1, 0, ink);
      p.px(0, 1, ink);
      p.px(2, 1, ink);
    }
    return p.sprite();
  });
}

// One cluster of lit windows in the hillside, and its own on/off rhythm: the city breathes because
// six small groups come on and go off at six different periods, not because anything flickers.
function clusterSprite(time, seed) {
  return cacheSprite(cache, `cluster|${time}|${seed}`, () => {
    const G = SKYSCAPE.lights;
    const L = lightOf(time);
    const p = new Painter(G.w, G.h);
    const rng = makeRng(SKYSCAPE.seed + seed * 97);
    for (let y = 1; y < G.h - 1; y += 2) {
      for (let x = 1; x < G.w - 1; x += 2) {
        if (rng() > 0.34) continue;
        p.px(x, y, rng() < 0.25 ? mix(L.window, C.white, 0.3) : L.window);
      }
    }
    return p.sprite();
  });
}

// The elements the page draws between its two stills. Every one of them is inside the sky zone and
// carries `origin: 'sky'`, so the page adds no coordinates of its own and a cloud can never be drawn
// over the offices.
export function skyAnimations({ w, h, time = 'dusk', clear = h }) {
  const G = SKYSCAPE;
  const rng = makeRng(G.seed + 7);
  const list = [];
  // the street's own line: the landscape, the water and the boat are all measured from it
  const base = h - 1;
  const spec = G.bodies[time];
  // the body of the moment: it travels its own arc, slowly, and it is the one thing up there that says
  // what hour it is. Frozen, it sits where the moment says it should be
  list.push({
    key: 'body',
    origin: 'sky',
    layer: 'behind', // the sun and the moon go behind the clouds
    frames: 1,
    fps: 0,
    place: (t, frozen) => {
      const phase = (spec.phase + (frozen ? 0 : Math.max(0, t) / spec.drift)) % 1;
      const sprite = bodySprite(time);
      // the arc: rising on the left, overhead in the middle, setting on the right
      const x = Math.round(-sprite.w * 0.5 + phase * (w + sprite.w));
      const y = Math.round(h * 0.66 - Math.sin(Math.PI * phase) * h * 0.56 - sprite.h * 0.5);
      return { sprite, x: Math.max(-sprite.w, x), y: Math.max(0, y) };
    },
  });
  // the stars
  list.push({
    key: 'stars',
    origin: 'sky',
    layer: 'behind', // the clouds occlude the stars, as they do in the reference
    frames: G.stars.frames,
    fps: G.stars.fps,
    place: (t, frozen) => ({
      sprite: starSprite(time, frozen ? 0 : Math.floor(Math.max(0, t) * G.stars.fps) % G.stars.frames, w, h),
      x: 0,
      y: 0,
    }),
  });
  // the boat: it crosses the water it can be seen on, slowly, and is away for the rest of its cycle
  const waterTop = Math.max(2, base - G.landscape.water.level);
  const waterFrom = Math.round(w * G.landscape.water.from);
  list.push({
    key: 'boat',
    origin: 'sky',
    layer: 'front',
    frames: G.boat.frames,
    fps: G.boat.fps,
    place: (t, frozen) => {
      const clock = Math.max(0, t);
      const into = frozen ? 0.35 : (clock % G.boat.period) / G.boat.crossing;
      if (into > 1) return { sprite: boatSprite(time, 0), x: -40, y: -40 };
      const x = Math.round(waterFrom - G.boat.size + into * (w - waterFrom + G.boat.size * 2));
      // one pixel of swell, and the bob is the frame, not a second clock
      const y = waterTop - 7 + (frozen ? 0 : Math.round(Math.sin(clock * 0.7)));
      return { sprite: boatSprite(time, frozen ? 0 : Math.floor(clock * G.boat.fps) % G.boat.frames), x, y };
    },
  });
  // the flocks: a long routine in the cat's spirit — each crosses the frame on its own period, at its
  // own height, wings beating, and it is away for the rest of the cycle
  for (let i = 0; i < G.birds.flocks; i++) {
    const period = G.birds.period[i % G.birds.period.length];
    const crossing = G.birds.crossing[i % G.birds.crossing.length];
    const height = Math.round(Math.max(28, bandOf(h, clear)) * (0.35 + i * 0.22));
    const back = i % 2 === 1;
    const lead = i * 13;
    list.push({
      key: `flock${i}`,
      origin: 'sky',
      layer: 'front',
      frames: G.birds.frames,
      fps: G.birds.fps,
      place: (t, frozen) => {
        const clock = Math.max(0, t) + lead;
        const into = frozen ? 0.4 : (clock % period) / crossing;
        if (into > 1) return { sprite: birdSprite(time, 0), x: -50, y: -50 };
        const frame = frozen ? 0 : Math.floor(clock * G.birds.fps) % G.birds.frames;
        const x = Math.round(back ? w - into * (w + 40) : into * (w + 40) - 20);
        const y = Math.round(height + Math.sin(into * Math.PI * 2 + i) * 6);
        return { sprite: birdSprite(time, frame), x, y };
      },
    });
  }
  // the window clusters, placed in the town's own band, standing on the street's line
  for (let i = 0; i < G.lights.clusters; i++) {
    const cx = Math.round(w * (G.landscape.town.from + (G.landscape.town.to - G.landscape.town.from) * rng()));
    const cy = base - 6 - Math.round(rng() * Math.max(0, G.landscape.town.h[1] * 0.8 - G.lights.h));
    const period = G.lights.periods[i % G.lights.periods.length];
    list.push({
      key: `windows${i}`,
      origin: 'sky',
      layer: 'front',
      frames: 2,
      fps: 0,
      // a group is on for most of its period and off for the rest; the phase is its own
      place: (t, frozen) => {
        const phase = frozen ? 0 : Math.floor((Math.max(0, t) + i * 7.3) / period) % 2;
        return { sprite: phase === 0 ? clusterSprite(time, i + 1) : clusterOff(time, i + 1), x: cx, y: cy };
      },
    });
  }
  // the beacon tips, on the two masts the landscape draws, blinking at 2 s
  for (let i = 0; i < G.beacon.count; i++) {
    const mast = G.landscape.masts[i % G.landscape.masts.length];
    const bx = Math.round(w * mast.at) + 1;
    const by = Math.max(2, base - mast.h - 5);
    const period = G.beacon.period;
    list.push({
      key: `beacon${i}`,
      origin: 'sky',
      layer: 'front',
      frames: 2,
      fps: 0,
      place: (t, frozen) => {
        const on = frozen ? true : Math.floor(Math.max(0, t) / (period / 2)) % 2 === 0;
        return { sprite: beaconSprite(time, on ? 1 : 0), x: bx, y: by };
      },
    });
  }
  return list;
}

// The beacon: one lit pixel and the one it lights under it, or an off pixel. That is the whole of it.
function beaconSprite(time, on) {
  return cacheSprite(cache, `beacon|${time}|${on}`, () => {
    const L = lightOf(time);
    const p = new Painter(1, 3);
    if (on) {
      p.px(0, 0, L.beacon);
      p.px(0, 1, rgba(L.beacon, 0.35));
    } else {
      p.px(0, 0, mix(L.near, C.ink, 0.2));
    }
    return p.sprite();
  });
}

// The cluster in its off phase: the same windows, unlit. Dark, but a step off the hill so the group
// reads as a row of houses rather than as a hole.
function clusterOff(time, seed) {
  return cacheSprite(cache, `clusteroff|${time}|${seed}`, () => {
    const G = SKYSCAPE.lights;
    const L = lightOf(time);
    const p = new Painter(G.w, G.h);
    const rng = makeRng(SKYSCAPE.seed + seed * 97);
    for (let y = 1; y < G.h - 1; y += 2) {
      for (let x = 1; x < G.w - 1; x += 2) {
        if (rng() > 0.34) continue;
        p.px(x, y, mix(L.hillside, C.ink, 0.25));
      }
    }
    return p.sprite();
  });
}

// The tones a cloud is painted with, and which way the light comes from. Exported because a rule this
// easy to invert — a day cloud lit from below reads as a rock with snow on it — deserves a check.
export function cloudTones(time) {
  return lightOf(time).cloud;
}

// -------------------------------------------------------------- the backdrop

// The sky is painted in TWO pictures, because the sun has to pass BEHIND the clouds and in front of the
// ramp, and one picture cannot be in front of itself:
//
//   base   the ramp and the cirrus — everything the weather is behind
//   over   the clouds and then the landscape, which is in front of them: a hill a cloud crosses in front
//          of is a hill further away than the cloud
//
// The page blits base, then the elements that belong behind the clouds (the sun, the moon, the stars),
// then over, then the rest of the moving parts. `weather` is threaded here and lands on the clouds only.
export function paintSkyBase(p, { w, h, time = 'dusk', clear = h }) {
  const rng = makeRng(SKYSCAPE.seed + 3);
  paintRamp(p, w, h, time);
  paintCirrus(p, w, bandOf(h, clear), time, rng);
  return p;
}

export function paintSkyOver(p, { w, h, time = 'dusk', clear = h, weather = 'clear' }) {
  const rng = makeRng(SKYSCAPE.seed + 5);
  paintClouds(p, w, h, clear, time, weather);
  paintLandscape(p, w, h, time, rng);
  return p;
}

// The whole sky in one painter, for a check or a capture that does not care about the order.
export function paintSkyBackdrop(p, { w, h, time = 'dusk', clear = h, weather = 'clear' }) {
  paintSkyBase(p, { w, h, time, clear });
  paintSkyOver(p, { w, h, time, clear, weather });
  return p;
}
