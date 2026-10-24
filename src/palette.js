// Fixed palette for the whole town. Deliberately small and cohesive: every sprite
// pulls from these names, which is what keeps an 8-bit scene from looking noisy.

export const C = {
  ink: '#181425',
  ink2: '#262b44',
  ink3: '#3a4466',
  slate: '#5a6988',
  stone: '#8b9bb4',
  stoneLite: '#c0cbdc',
  white: '#ffffff',

  grassDeep: '#193c3e',
  grassDark: '#265c42',
  grass: '#3e8948',
  grassLite: '#63c74d',
  grassSun: '#9fd356',

  dirtDeep: '#4a2f2a',
  dirt: '#733e39',
  dirtMid: '#b86f50',
  dirtLite: '#e4a672',
  sand: '#ead4aa',

  waterDeep: '#124e89',
  water: '#0099db',
  waterLite: '#2ce8f5',

  woodDark: '#4a2f2a',
  wood: '#8a5a3b',
  woodLite: '#c28569',

  brick: '#be4a2f',
  brickLite: '#d77643',

  roofRed: '#a22633',
  roofRedLite: '#e43b44',
  roofRedDark: '#6d1b2a',
  roofBlue: '#124e89',
  roofBlueLite: '#0099db',
  roofBlueDark: '#0b2f57',
  roofGreen: '#265c42',
  roofGreenLite: '#3e8948',
  roofGreenDark: '#193c3e',
  roofOrange: '#be4a2f',
  roofOrangeLite: '#f77622',
  roofOrangeDark: '#7a2a1d',
  roofPurple: '#68386c',
  roofPurpleLite: '#b55088',
  roofPurpleDark: '#3d2140',
  roofSlate: '#5a6988',
  roofSlateLite: '#8b9bb4',
  roofSlateDark: '#3a4466',

  glass: '#2b5a7a',
  glassLite: '#5fa8c8',
  lamp: '#fee761',
  lampWarm: '#feae34',
  neon: '#2ce8f5',
  pink: '#f6757a',
  purple: '#b55088',

  skin1: '#e8b796',
  skin2: '#c28569',
  skin3: '#8a5a44',
  hairInk: '#3e2731',
  hairBrown: '#733e39',
  hairFair: '#e4a672',
  hairGrey: '#8b9bb4',
};

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

// t > 0 lightens toward white, t < 0 darkens toward ink.
export function shade(hex, t) {
  return t >= 0 ? mix(hex, C.white, t) : mix(hex, C.ink, -t);
}
