// Pixel-level drawing primitives. Everything is authored on tiny offscreen
// canvases at 1 logical pixel per unit, then blitted 1:1 by the renderer.

export function mkCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w));
  cv.height = Math.max(1, Math.round(h));
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return cv;
}

export function cacheSprite(cache, key, build) {
  let hit = cache.get(key);
  if (!hit) {
    hit = build();
    cache.set(key, hit);
  }
  return hit;
}

export class Painter {
  constructor(w, h) {
    this.w = Math.round(w);
    this.h = Math.round(h);
    this.canvas = mkCanvas(this.w, this.h);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.imageSmoothingEnabled = false;
  }

  px(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, 1, 1);
    return this;
  }

  rect(x, y, w, h, color) {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    if (w <= 0 || h <= 0) return this;
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    if (x1 <= x0 || y1 <= y0) return this;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    return this;
  }

  hline(x, y, w, color) {
    return this.rect(x, y, w, 1, color);
  }

  vline(x, y, h, color) {
    return this.rect(x, y, 1, h, color);
  }

  // Two-colour 2x2 bayer patterns for the classic 8-bit texture look.
  dither(x, y, w, h, colorA, colorB, mode = 0) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const px = (x + i) | 0;
        const py = (y + j) | 0;
        let on;
        switch (mode) {
          case 1:
            on = (px + py) % 2 === 0;
            break;
          case 2:
            on = px % 2 === 0 && py % 2 === 0;
            break;
          case 3:
            on = (px % 4 === 0 && py % 2 === 0) || (px % 4 === 2 && py % 2 === 1);
            break;
          default:
            on = (px % 2 === 0) === (py % 2 === 0);
        }
        this.px(px, py, on ? colorA : colorB);
      }
    }
    return this;
  }

  // 1px border around every opaque region. Restores the painted pixels exactly,
  // so it can run safely over gradients.
  outline(color) {
    const { ctx, w, h } = this;
    const src = ctx.getImageData(0, 0, w, h);
    const data = src.data;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = data[i * 4 + 3] > 8 ? 1 : 0;
    const [r, g, b] = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        const n =
          (x > 0 && solid[i - 1]) ||
          (x < w - 1 && solid[i + 1]) ||
          (y > 0 && solid[i - w]) ||
          (y < h - 1 && solid[i + w]);
        if (!n) continue;
        const o = i * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(src, 0, 0);
    return this;
  }

  blit(source, x, y) {
    const img = source.canvas || source;
    this.ctx.drawImage(img, Math.round(x), Math.round(y));
    return this;
  }

  sprite() {
    return { canvas: this.canvas, w: this.w, h: this.h };
  }
}
