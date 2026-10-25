// v2 scaling rule. The old diorama aimed at a 216px logical height; the
// top-down town aims at 360px, which maps exactly onto 720p (2x), 1080p (3x),
// 1440p (4x) and 2160p (6x), and gives integer widths for 16:9, 16:10, 3:2,
// 4:3 and 5:4.
//
// The world is 640x400. A window that cannot be covered with an integer scale
// inside that world raises the scale until it can: we crop, never letterbox.

export const TILE = 16;
export const WORLD_W = 720;
export const WORLD_H = 450;
export const TARGET_H = 360;
// Everything inside this rect is visible on every aspect from 16:9 to 4:3.
export const SAFE_W = 480;
export const SAFE_H = 360;

export function computeView(cssW, cssH, targetH = TARGET_H, forceScale = 0) {
  const w = Math.max(1, Math.round(cssW));
  const h = Math.max(1, Math.round(cssH));
  const preferred = Math.max(1, Math.floor(h / targetH));
  let scale = Math.max(preferred, Math.ceil(w / WORLD_W), Math.ceil(h / WORLD_H));
  // debug: pin a scale to compare 2x / 3x / 4x on the same screen
  if (forceScale) scale = Math.max(1, Math.round(forceScale));
  const viewW = Math.ceil(w / scale);
  const viewH = Math.ceil(h / scale);
  return {
    scale,
    w: viewW,
    h: viewH,
    cssW: viewW * scale,
    cssH: viewH * scale,
    tilesW: viewW / TILE,
    tilesH: viewH / TILE,
    forced: !!forceScale,
    // does the guaranteed-visible rect fit in this view?
    safeFits: viewW >= SAFE_W && viewH >= SAFE_H,
    covers: viewW * scale >= w && viewH * scale >= h,
  };
}

export function computeCamera(view) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    x: Math.round(clamp((WORLD_W - view.w) / 2, 0, Math.max(0, WORLD_W - view.w))),
    y: Math.round(clamp((WORLD_H - view.h) / 2, 0, Math.max(0, WORLD_H - view.h))),
  };
}

// The canvas is at least as large as the window (it overflows by less than one
// logical pixel), so centring it never shows a bar.
export function applyView(canvas, view, cssW, cssH) {
  canvas.width = view.w;
  canvas.height = view.h;
  canvas.style.width = `${view.cssW}px`;
  canvas.style.height = `${view.cssH}px`;
  canvas.style.left = `${Math.round((cssW - view.cssW) / 2)}px`;
  canvas.style.top = `${Math.round((cssH - view.cssH) / 2)}px`;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.imageSmoothingEnabled = false;
  return view;
}
