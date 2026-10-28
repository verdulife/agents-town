// The cinematic city palette (v3), for the frontal street.
//
// The rules it encodes, so a new sprite does not have to rediscover them:
//
// 1. Shadow is cold, light is warm. Every structural shadow leans blue-violet, every
//    practical light (lamp, window, neon, sodium) leans amber. A scene reads as a
//    photograph of a city at dusk because of that split, not because of detail.
// 2. Nothing is pure. `white` is bone, `ink` is blue-black. Pure #fff and #000 appear
//    nowhere: on a pixel grid they flatten everything next to them.
// 3. Mid-tones stay desaturated. The saturation budget belongs to the lights, which is
//    why the walls, the asphalt and the sky are quiet and the signs are not.
// 4. Ramps step in hue as well as in value: a wall's highlight is warmer than its base,
//    its shadow cooler. Stepping only brightness is what makes pixel art look flat.
// 5. Four sky ramps, one per hour of the day, so the sky can change without repainting
//    anything else in the scene.
//
// v1's diorama keeps the palette it was approved with (`src/palette.js`); this file is the
// new scene's, and the catalogue modules under `src/next/` import it.

export const C = {
  // structure: cold graphite spine
  ink: '#0d0f1a',
  ink2: '#161a28',
  ink3: '#232a3d',
  slate: '#3a4460',
  stone: '#67718a',
  stoneLite: '#a4abb8',
  white: '#efeade',

  // nature, Mediterranean and dry rather than lush
  grassDeep: '#1d3030',
  grassDark: '#2e4738',
  grass: '#48663f',
  grassLite: '#6f8c50',
  grassSun: '#9ca55f',

  dirtDeep: '#382a28',
  dirt: '#5b4036',
  dirtMid: '#8a6247',
  dirtLite: '#b48d68',
  sand: '#c9b18f',

  // water is petrol, not tropical
  waterDeep: '#0f3140',
  water: '#1e5f6d',
  waterLite: '#419aa1',

  woodDark: '#372824',
  wood: '#6a4934',
  woodLite: '#98704f',

  brickDark: '#5f2f26',
  brick: '#8b4a3a',
  brickLite: '#ad6a4d',

  // plaster and stucco: the walls of the street
  plasterDark: '#9a8e77',
  plaster: '#ccbfa3',
  plasterLite: '#e6dcc4',

  // roofs
  roofRed: '#7c2e37',
  roofRedLite: '#b3444a',
  roofRedDark: '#4f1e26',
  roofBlue: '#213e5a',
  roofBlueLite: '#3d6d89',
  roofBlueDark: '#14273a',
  roofGreen: '#2b483a',
  roofGreenLite: '#486a51',
  roofGreenDark: '#1b2f28',
  roofOrange: '#87472b',
  roofOrangeLite: '#bd6f3c',
  roofOrangeDark: '#572d1d',
  roofPurple: '#483252',
  roofPurpleLite: '#77547c',
  roofPurpleDark: '#2c1f34',
  roofSlate: '#485064',
  roofSlateLite: '#767f8c',
  roofSlateDark: '#2d3341',

  // glass: cold by day, warm from inside at night
  glass: '#223f4d',
  glassLite: '#487b8a',
  glassLitSoft: '#c69a5f',
  glassLit: '#f2c877',

  // practicals: the only saturated colours the scene is allowed
  lamp: '#f6d87c',
  lampWarm: '#e79b4d',
  sodium: '#d9793d',
  neon: '#35d6d0',
  neonPink: '#e2568c',
  neonAmber: '#f0a24a',
  pink: '#cf6f74',
  purple: '#9a5c94',

  // metal: railings, shutters, drainpipes, the sign's frame
  metalDark: '#262b39',
  metal: '#55607a',
  metalLite: '#949dae',

  // the corporate accent: an orange that leans to red, and the only warm colour a building of
  // grey cladding is allowed. Small doses — a mullion cap, a door pull, a counter's stripe, a
  // logo plate, a stair stringer, a machine's frame — never a wall
  brandDark: '#a8381f',
  brand: '#d0552a',
  brandLite: '#ef7b3f',

  // people: skin keeps its warmth against the cold structure
  skin1: '#d9a684',
  skin2: '#b07a5c',
  skin3: '#7a5240',
  hairInk: '#2c2028',
  hairBrown: '#5c3a2e',
  hairFair: '#c99a63',
  hairGrey: '#99a0ab',

  // sky, one ramp per hour: deep horizon, mid, high, highlit
  skyNight0: '#0a0c18',
  skyNight1: '#131a2d',
  skyNight2: '#1e2a44',
  skyNight3: '#2b3a58',
  skyDawn0: '#262238',
  skyDawn1: '#5e4260',
  skyDawn2: '#b8735c',
  skyDawn3: '#f2c48a',
  skyDay0: '#3f6f96',
  skyDay1: '#6f9cb6',
  skyDay2: '#a8c1cd',
  skyDay3: '#e6e2d0',
  skyDusk0: '#241f3a',
  skyDusk1: '#4e2f52',
  skyDusk2: '#96414f',
  skyDusk3: '#d9733f',
};

// The ramps, in painting order (deep shadow to highlight). The design-system page draws
// them from this list, so a ramp cannot drift from the sheet that documents it.
export const RAMPS = [
  {
    name: 'structure',
    family: 'structure',
    steps: ['ink', 'ink3', 'slate', 'stone', 'stoneLite', 'white'],
    note: 'shadow is blue, highlight is bone. The spine every wall is built on.',
  },
  {
    name: 'plaster',
    family: 'wall',
    steps: ['plasterDark', 'plaster', 'plasterLite'],
    note: 'stucco: the sunlit wall of the street. Never lit past plasterLite.',
  },
  {
    name: 'brick',
    family: 'wall',
    steps: ['brickDark', 'brick', 'brickLite'],
    note: 'terracotta, muted. Reads warm without competing with a lamp.',
  },
  {
    name: 'metal',
    family: 'structure',
    steps: ['metalDark', 'metal', 'metalLite'],
    note: 'shutters, railings, the sign frame. Cooler than stone, same value band.',
  },
  {
    name: 'brand',
    family: 'accent',
    steps: ['brandDark', 'brand', 'brandLite'],
    note: 'the corporate orange. A logo, a stripe, a frame — never a wall.',
  },
  {
    name: 'glass',
    family: 'window',
    steps: ['glass', 'glassLite', 'glassLitSoft', 'glassLit'],
    note: 'empty by day, inhabited by night. glassLit is the warmest thing in frame.',
  },
  {
    name: 'light',
    family: 'light',
    steps: ['sodium', 'lampWarm', 'lamp', 'neonAmber', 'neon', 'neonPink'],
    note: 'the whole saturation budget. One light family per corner of the scene.',
  },
  {
    name: 'nature',
    family: 'nature',
    steps: ['grassDeep', 'grassDark', 'grass', 'grassLite', 'grassSun'],
    note: 'dry Mediterranean green. Sunlit grass is olive, never lime.',
  },
  {
    name: 'earth',
    family: 'nature',
    steps: ['dirtDeep', 'dirt', 'dirtMid', 'dirtLite', 'sand'],
    note: 'dust, terracotta, sand. The only ramp allowed to go fully warm and desaturated.',
  },
  {
    name: 'water',
    family: 'nature',
    steps: ['waterDeep', 'water', 'waterLite'],
    note: 'petrol. Deliberately not cyan: cyan belongs to neon.',
  },
  {
    name: 'wood',
    family: 'nature',
    steps: ['woodDark', 'wood', 'woodLite'],
    note: 'cafe furniture, doors, crates.',
  },
  {
    name: 'roof',
    family: 'wall',
    steps: ['roofSlateDark', 'roofSlate', 'roofSlateLite'],
    note: 'the quiet roof. The red, blue, green, orange and purple roofs are its variants.',
  },
  {
    name: 'skin',
    family: 'people',
    steps: ['skin3', 'skin2', 'skin1'],
    note: 'warm against cold structure. It is what makes a person pop at 16px.',
  },
];

export const SKY = [
  { name: 'night', steps: ['skyNight0', 'skyNight1', 'skyNight2', 'skyNight3'] },
  { name: 'dawn', steps: ['skyDawn0', 'skyDawn1', 'skyDawn2', 'skyDawn3'] },
  { name: 'day', steps: ['skyDay0', 'skyDay1', 'skyDay2', 'skyDay3'] },
  { name: 'dusk', steps: ['skyDusk0', 'skyDusk1', 'skyDusk2', 'skyDusk3'] },
];

// Pairs that must never touch, with the reason. They are rules about readability at
// 2 physical pixels per art pixel, not taste.
export const FORBIDDEN = [
  { a: 'white', b: 'stoneLite', why: 'one value apart: the edge dissolves' },
  { a: 'lamp', b: 'white', why: 'yellow on bone loses its outline; put a lamp on ink' },
  { a: 'neon', b: 'neonPink', why: 'two saturated accents vibrate; separate with ink' },
  { a: 'grassLite', b: 'grassSun', why: 'neighbouring steps of one ramp turn to mush' },
  { a: 'glassLit', b: 'lamp', why: 'two light sources compete; one lit thing per corner' },
  { a: 'sodium', b: 'neonAmber', why: 'two warms at one hue read as a broken lamp' },
];

function parse(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(r, g, b) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

export function rgb(hex) {
  const [r, g, b] = parse(hex);
  return { r, g, b };
}

export function rgba(hex, a) {
  const { r, g, b } = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mix(a, b, t) {
  const A = parse(a);
  const B = parse(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

// t > 0 lightens toward bone, t < 0 darkens toward ink.
export function shade(hex, t) {
  return t >= 0 ? mix(hex, C.white, t) : mix(hex, C.ink, -t);
}
