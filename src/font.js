// Two bitmap fonts: a 5x7 "big" one for short labels and a 3x5 "tiny" one for
// dense displays (billboards, the CRT kiosk, shop fascias). Layout helpers pick
// the largest font that fits a rect and wrap text, so a message can never spill
// out of its panel again.

import { Painter, cacheSprite } from './pixel.js';

const BIG_ROWS = [
  'A:.###.|#...#|#...#|#####|#...#|#...#|#...#',
  'B:####.|#...#|#...#|####.|#...#|#...#|####.',
  'C:.###.|#...#|#....|#....|#....|#...#|.###.',
  'D:####.|#...#|#...#|#...#|#...#|#...#|####.',
  'E:#####|#....|#....|####.|#....|#....|#####',
  'F:#####|#....|#....|####.|#....|#....|#....',
  'G:.###.|#...#|#....|#.###|#...#|#...#|.####',
  'H:#...#|#...#|#...#|#####|#...#|#...#|#...#',
  'I:.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  'J:..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  'K:#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  'L:#....|#....|#....|#....|#....|#....|#####',
  'M:#...#|##.##|#.#.#|#...#|#...#|#...#|#...#',
  'N:#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  'O:.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  'P:####.|#...#|#...#|####.|#....|#....|#....',
  'Q:.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  'R:####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  'S:.####|#....|#....|.###.|....#|....#|####.',
  'T:#####|..#..|..#..|..#..|..#..|..#..|..#..',
  'U:#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  'V:#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  'W:#...#|#...#|#...#|#...#|#.#.#|##.##|#...#',
  'X:#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  'Y:#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  'Z:#####|....#|...#.|..#..|.#...|#....|#####',
  '0:.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1:..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2:.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3:####.|....#|....#|.###.|....#|....#|####.',
  '4:#..#.|#..#.|#..#.|#####|...#.|...#.|...#.',
  '5:#####|#....|####.|....#|....#|#...#|.###.',
  '6:.###.|#....|####.|#...#|#...#|#...#|.###.',
  '7:#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8:.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9:.###.|#...#|#...#|.####|....#|....#|.###.',
  ' :.....|.....|.....|.....|.....|.....|.....',
  '!:..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '.:.....|.....|.....|.....|.....|.....|..#..',
  ',:.....|.....|.....|.....|.....|..#..|.#...',
  '-:.....|.....|.....|.###.|.....|.....|.....',
  ':.....|..#..|.....|.....|..#..|.....|.....',
  '?:.###.|#...#|....#|...#.|..#..|.....|..#..',
  "':..#..|..#..|.....|.....|.....|.....|.....",
  '/:....#|....#|...#.|..#..|.#...|#....|#....',
  '+:.....|..#..|..#..|#####|..#..|..#..|.....',
  '=:.....|.....|#####|.....|#####|.....|.....',
  '·:.....|.....|..#..|.....|.....|.....|.....',
];

const TINY_ROWS = [
  'A:.#.|#.#|###|#.#|#.#',
  'B:##.|#.#|##.|#.#|##.',
  'C:.##|#..|#..|#..|.##',
  'D:##.|#.#|#.#|#.#|##.',
  'E:###|#..|##.|#..|###',
  'F:###|#..|##.|#..|#..',
  'G:.##|#..|#.#|#.#|.##',
  'H:#.#|#.#|###|#.#|#.#',
  'I:###|.#.|.#.|.#.|###',
  'J:..#|..#|..#|#.#|.#.',
  'K:#.#|#.#|##.|#.#|#.#',
  'L:#..|#..|#..|#..|###',
  'M:#.#|###|###|#.#|#.#',
  'N:#.#|##.|#.#|#.#|#.#',
  'O:.#.|#.#|#.#|#.#|.#.',
  'P:##.|#.#|##.|#..|#..',
  'Q:.#.|#.#|#.#|##.|.##',
  'R:##.|#.#|##.|#.#|#.#',
  'S:.##|#..|.#.|..#|##.',
  'T:###|.#.|.#.|.#.|.#.',
  'U:#.#|#.#|#.#|#.#|###',
  'V:#.#|#.#|#.#|#.#|.#.',
  'W:#.#|#.#|###|###|#.#',
  'X:#.#|#.#|.#.|#.#|#.#',
  'Y:#.#|#.#|.#.|.#.|.#.',
  'Z:###|..#|.#.|#..|###',
  '0:###|#.#|#.#|#.#|###',
  '1:.#.|##.|.#.|.#.|###',
  '2:##.|..#|.#.|#..|###',
  '3:##.|..#|.#.|..#|##.',
  '4:#.#|#.#|###|..#|..#',
  '5:###|#..|##.|..#|##.',
  '6:.##|#..|##.|#.#|.#.',
  '7:###|..#|.#.|.#.|.#.',
  '8:.#.|#.#|.#.|#.#|.#.',
  '9:.#.|#.#|.##|..#|##.',
  ' :...|...|...|...|...',
  '!:.#.|.#.|.#.|...|.#.',
  '.:...|...|...|...|.#.',
  ',:...|...|...|.#.|#..',
  '-:...|...|###|...|...',
  ':...|.#.|...|.#.|...',
  '?:##.|..#|.#.|...|.#.',
  "':.#.|.#.|...|...|...",
  '/:..#|..#|.#.|#..|#..',
  '+:...|.#.|###|.#.|...',
  '=:...|###|...|###|...',
  '·:...|...|.#.|...|...',
];

// Sign face: 5x6, one row shorter than "big", with real lowercase. Cap height is
// five rows and the x-height is four, so a name set in mixed case reads lighter
// and smaller than the same name in caps, which is what a shop fascia wants.
// Baseline is row 4; row 5 carries the descenders of g, j, p, q and y.
function compile(rows) {
  const glyphs = {};
  for (const entry of rows) {
    const [ch, bitmap] = [entry.slice(0, 1), entry.slice(2)];
    glyphs[ch] = bitmap.split('|');
  }
  return glyphs;
}

export const FONTS = {
  big: { cols: 5, rows: 7, glyphs: compile(BIG_ROWS) },
  tiny: { cols: 3, rows: 5, glyphs: compile(TINY_ROWS) },
};

const fontOf = (name) => FONTS[name] || FONTS.big;
// Fonts that only carry capitals still answer for lowercase text, so a caller can
// pass "Bar" to the 5x7 face and get "BAR" without pre-processing the string.
const glyphOf = (font, ch) => font.glyphs[ch] || font.glyphs[ch.toUpperCase()] || font.glyphs['?'];

export function lineWidth(text, { font = 'big', scale = 1, spacing = 1 } = {}) {
  const f = fontOf(font);
  if (!text) return 0;
  return text.length * (f.cols + spacing) * scale - spacing * scale;
}

export function measureText(text, opts = {}) {
  return lineWidth(text, opts);
}

export function drawText(ctx, text, x, y, color, opts = {}) {
  const { font = 'big', scale = 1, spacing = 1 } = opts;
  const f = fontOf(font);
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of String(text)) {
    const rows = glyphOf(f, ch);
    for (let r = 0; r < f.rows; r++) {
      const row = rows[r] || '';
      for (let c = 0; c < f.cols; c++) {
        if (row[c] === '#') ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
      }
    }
    cx += (f.cols + spacing) * scale;
  }
  return cx;
}

// Greedy word wrap; splits words that are wider than the line on their own.
export function wrapText(text, { font = 'big', maxWidth, scale = 1, spacing = 1 } = {}) {
  const opts = { font, scale, spacing };
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (let word of words) {
    while (word.length > 1 && lineWidth(word, opts) > maxWidth) {
      let cut = word.length - 1;
      while (cut > 1 && lineWidth(word.slice(0, cut), opts) > maxWidth) cut--;
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const candidate = current ? `${current} ${word}` : word;
    if (lineWidth(candidate, opts) <= maxWidth) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

// Largest font whose wrapped layout fits the rect for every given text, so a
// panel keeps one stable typography while its messages rotate.
export function fitFont(texts, rect, { gap = 1, order = ['big', 'tiny'] } = {}) {
  for (const font of order) {
    const f = fontOf(font);
    const fits = texts.every((text) => {
      const lines = wrapText(text, { font, maxWidth: rect.w });
      const totalH = lines.length * (f.rows + gap) - gap;
      const widest = Math.max(...lines.map((line) => lineWidth(line, { font })));
      return totalH <= rect.h && widest <= rect.w;
    });
    if (fits) return font;
  }
  return 'tiny';
}

// Wrapped, vertically centred layout for one text inside a rect.
export function layoutText(text, rect, { font = 'big', gap = 1 } = {}) {
  const f = fontOf(font);
  // hard ceiling: whatever the text, the block never grows past the rect
  const maxLines = Math.max(1, Math.floor((rect.h + gap) / (f.rows + gap)));
  const lines = wrapText(text, { font, maxWidth: rect.w }).slice(0, maxLines);
  const lineHeight = f.rows + gap;
  return {
    font,
    lines,
    lineHeight,
    totalH: lines.length * lineHeight - gap,
    top: Math.round((rect.h - (lines.length * lineHeight - gap)) / 2),
  };
}

const textCache = new Map();

// Cached text sprite, handy when the same string is drawn every frame.
export function textSprite(text, color, opts = {}) {
  const { font = 'big', scale = 1, spacing = 1 } = opts;
  const key = `${text}|${color}|${font}|${scale}|${spacing}`;
  return cacheSprite(textCache, key, () => {
    const w = lineWidth(text, { font, scale, spacing });
    const h = fontOf(font).rows * scale;
    const p = new Painter(w, h);
    drawText(p.ctx, text, 0, 0, color, { font, scale, spacing });
    return p.sprite();
  });
}
