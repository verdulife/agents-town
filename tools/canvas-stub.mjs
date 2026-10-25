// Minimal canvas stub so sprite painters can be exercised in Node.
// It does not rasterise anything: it exists to catch exceptions and to let the
// painters run their geometry.

class StubGradient {
  addColorStop() {}
}

class StubCtx {
  constructor(el) {
    this.canvas = el;
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.imageSmoothingEnabled = false;
    this.calls = 0;
  }
  save() {}
  restore() {}
  setTransform() {}
  translate() {}
  scale() {}
  clearRect() {}
  fillRect() {
    this.calls++;
  }
  strokeRect() {}
  drawImage() {
    this.calls++;
  }
  beginPath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  fill() {}
  stroke() {}
  createLinearGradient() {
    return new StubGradient();
  }
  createRadialGradient() {
    return new StubGradient();
  }
  getImageData(x, y, w, h) {
    const width = Math.max(1, Math.round(w));
    const height = Math.max(1, Math.round(h));
    return { data: new Uint8ClampedArray(width * height * 4), width, height };
  }
  putImageData() {}
}

class StubCanvas {
  constructor() {
    this.width = 1;
    this.height = 1;
    this._ctx = null;
  }
  getContext() {
    if (!this._ctx) this._ctx = new StubCtx(this);
    return this._ctx;
  }
}

export function installCanvasStub() {
  if (globalThis.document) return globalThis.document;
  globalThis.document = {
    createElement(tag) {
      if (String(tag).toLowerCase() === 'canvas') return new StubCanvas();
      throw new Error(`canvas stub: unexpected element <${tag}>`);
    },
  };
  return globalThis.document;
}
