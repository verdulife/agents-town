// v2 scaling rule. The art pixel has a fixed size in *physical* pixels, taken
// from the window size and window.devicePixelRatio, so the browser zoom cannot
// change the framing: zooming out does not buy you more town, it only changes how
// many CSS pixels the browser hands over.
//
// TARGET_H is the logical height we want to see, in physical pixels (480 = 30
// tiles). The scale is the largest integer number of device pixels per art pixel
// that keeps at least that much on screen, and the view is allowed to be *larger*
// than the world: the renderer paints ground across the whole canvas, so there are
// no letterbox bars and the whole town fits inside the field.

export const TILE = 16;
export const WORLD_W = 720;
export const WORLD_H = 450;
export const TARGET_H = 480;
// Everything inside this rect is visible on every aspect from 16:9 to 4:3.
export const SAFE_W = 480;
export const SAFE_H = 360;

export function computeView(cssW, cssH, dpr = 1, forceScale = 0, targetH = TARGET_H) {
  const density = dpr > 0 ? dpr : 1;
  const width = Math.max(1, Math.round(cssW));
  const height = Math.max(1, Math.round(cssH));
  const physW = width * density;
  const physH = height * density;
  // round, not floor: at 720p that is 2 device px per art pixel instead of a 1:1
  // canvas that reads as tiny, and the safe rect (SAFE_H) still fits
  const preferred = Math.max(1, Math.round(physH / targetH));
  // debug: pin the device pixels per art pixel to compare 2x / 3x / 4x on one screen
  const scalePhys = forceScale ? Math.max(1, Math.round(forceScale)) : preferred;
  const viewW = Math.ceil(physW / scalePhys);
  const viewH = Math.ceil(physH / scalePhys);
  // one art pixel covers scalePhys device pixels, whatever the CSS zoom is
  const scaleCss = scalePhys / density;
  return {
    dpr: density,
    scale: scalePhys,
    scalePhys,
    scaleCss,
    w: viewW,
    h: viewH,
    cssW: viewW * scaleCss,
    cssH: viewH * scaleCss,
    tilesW: viewW / TILE,
    tilesH: viewH / TILE,
    forced: !!forceScale,
    // does the guaranteed-visible rect fit in this view?
    safeFits: viewW >= SAFE_W && viewH >= SAFE_H,
    covers: viewW * scaleCss >= width - 1e-9 && viewH * scaleCss >= height - 1e-9,
  };
}

// The world is centred in the view. When the view is larger than the world the
// offset is negative and the ground painted around it is the field beyond town.
export function computeCamera(view) {
  return {
    x: Math.round((WORLD_W - view.w) / 2),
    y: Math.round((WORLD_H - view.h) / 2),
  };
}

// The canvas backing store stays in art pixels; only its CSS box changes, and it
// is snapped to whole device pixels so scaling never lands on a fraction of one.
export function applyView(canvas, view, cssW, cssH) {
  canvas.width = view.w;
  canvas.height = view.h;
  const boxW = view.w * view.scaleCss;
  const boxH = view.h * view.scaleCss;
  const snap = (value) => Math.round(value * view.dpr) / view.dpr;
  canvas.style.width = `${boxW}px`;
  canvas.style.height = `${boxH}px`;
  canvas.style.left = `${snap((cssW - boxW) / 2)}px`;
  canvas.style.top = `${snap((cssH - boxH) / 2)}px`;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.imageSmoothingEnabled = false;
  return view;
}
