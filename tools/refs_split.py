#!/usr/bin/env python
"""Split the reference folder into inspectable pieces.

  python tools/refs_split.py

Sheets (flat background, items in a grid) become one file per item, found by
row/column occupancy projection. Scenes become an overlapping grid of crops at
native resolution. Each image also gets a numbered contact sheet so the split can
be reviewed at a glance.

Output: refs/_split/<image>/... and refs/_split/<image>_sheet.png
"""

from PIL import Image, ImageChops, ImageDraw
import json
import os

REFS = 'refs'
OUT = os.path.join(REFS, '_split')
SCENE_GRID = 3  # scenes are cut into 3x3 overlapping crops
SCENE_OVERLAP = 0.12
PAD = 2
MIN_AREA = 60


def background_color(rgb):
    cols = rgb.getcolors(1 << 24) or []
    if not cols:
        return (0, 0, 0)
    return max(cols)[1]


def mask_of(im):
    """255 where there is content, 0 over the flat background."""
    if im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] < 8:
        return im.getchannel('A').point(lambda v: 255 if v >= 8 else 0)
    rgb = im.convert('RGB')
    bg = background_color(rgb)
    solid = Image.new('RGB', rgb.size, bg)
    return ImageChops.difference(rgb, solid).convert('L').point(lambda v: 255 if v > 10 else 0)


def bands(mask, axis, min_gap=2):
    """Runs of occupied rows (axis='y') or columns (axis='x')."""
    w, h = mask.size
    if axis == 'y':
        occ = mask.resize((1, h), Image.BOX)
        data = [occ.getpixel((0, y)) for y in range(h)]
    else:
        occ = mask.resize((w, 1), Image.BOX)
        data = [occ.getpixel((x, 0)) for x in range(w)]
    runs, start, gap = [], None, 0
    for i, v in enumerate(data):
        if v > 3:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap > min_gap:
                runs.append((start, i - gap + 1))
                start, gap = None, 0
    if start is not None:
        runs.append((start, len(data) - gap))
    return [(a, b) for a, b in runs if b - a > 3]


def components(mask, scale=3):
    """Detached items, found on a downscaled mask and refined at full size."""
    w, h = mask.size
    small = mask.resize((max(1, w // scale), max(1, h // scale)), Image.BOX).point(lambda v: 255 if v > 40 else 0)
    sw, sh = small.size
    data = small.tobytes()
    seen = bytearray(sw * sh)
    boxes = []
    for i in range(sw * sh):
        if data[i] == 0 or seen[i]:
            continue
        stack = [i]
        seen[i] = 1
        x0 = x1 = i % sw
        y0 = y1 = i // sw
        while stack:
            j = stack.pop()
            x, y = j % sw, j // sw
            if x < x0: x0 = x
            if x > x1: x1 = x
            if y < y0: y0 = y
            if y > y1: y1 = y
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < sw and 0 <= ny < sh:
                    k = ny * sw + nx
                    if data[k] and not seen[k]:
                        seen[k] = 1
                        stack.append(k)
        boxes.append((x0 * scale, y0 * scale, min(w, (x1 + 1) * scale), min(h, (y1 + 1) * scale)))
    return boxes


def refine(mask, box, pad=PAD):
    bx = mask.crop(box).getbbox()
    if not bx:
        return None
    x0, y0, x1, y1 = box
    out = (max(0, x0 + bx[0] - pad), max(0, y0 + bx[1] - pad), x1 - (box[2] - x0 - bx[2]) + pad, y1 - (box[3] - y0 - bx[3]) + pad)
    return (out[0], out[1], min(mask.size[0], out[2]), min(mask.size[1], out[3]))


def is_sheet(im, mask, unique):
    """A sheet has a dominant flat background; a scene does not.

    Palette size is the reliable discriminator here: hand-made pixel-art scenes
    stay under a few hundred colours, while the generated asset sheets carry tens
    of thousands and sit on one flat backdrop.
    """
    w, h = im.size
    if im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] < 8:
        return True
    cols = im.convert('RGB').getcolors(1 << 24) or []
    top = max(cols)[0] / (w * h) if cols else 0
    return unique > 2000 and top > 0.35


def merge_boxes(boxes, gap=5):
    """Union boxes that are closer than `gap`: generated sheets fragment."""
    out = [list(b) for b in boxes]
    changed = True
    while changed:
        changed = False
        for i in range(len(out)):
            for j in range(i + 1, len(out)):
                a, b = out[i], out[j]
                if (a[0] - gap <= b[2] and b[0] - gap <= a[2] and a[1] - gap <= b[3] and b[1] - gap <= a[3]):
                    out[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    out.pop(j)
                    changed = True
                    break
            if changed:
                break
    return [tuple(b) for b in out]


def split_sheet(im, mask, name):
    """Detached items, then a final pass that cuts merged grid columns."""
    raw = [r for r in (refine(mask, b) for b in merge_boxes(components(mask))) if r]
    areas = sorted((r[2] - r[0]) * (r[3] - r[1]) for r in raw) or [0]
    median = areas[len(areas) // 2]
    boxes = [r for r in raw if (r[2] - r[0]) * (r[3] - r[1]) >= max(MIN_AREA, median * 0.15)]

    grid = []
    for (y0, y1) in bands(mask, 'y'):
        strip = mask.crop((0, y0, im.width, y1))
        for (x0, x1) in bands(strip, 'x'):
            box = mask.crop((x0, y0, x1, y1)).getbbox()
            if not box:
                continue
            bx = (x0 + box[0] - PAD, y0 + box[1] - PAD, x0 + box[2] + PAD, y0 + box[3] + PAD)
            bx = (max(0, bx[0]), max(0, bx[1]), min(im.width, bx[2]), min(im.height, bx[3]))
            if (bx[2] - bx[0]) * (bx[3] - bx[1]) >= MIN_AREA:
                grid.append(bx)
    if len(grid) > len(boxes):
        boxes = grid

    # a grid sheet merges a whole column of variants into one tall piece: cut it
    # at its internal empty rows, or into equal bands when the items touch
    hs = sorted(b[3] - b[1] for b in boxes) or [1]
    ws = sorted(b[2] - b[0] for b in boxes) or [1]
    base_h = max(1, hs[len(hs) // 4])
    base_w = max(1, ws[len(ws) // 4])
    final = []
    for b in boxes:
        w, h = b[2] - b[0], b[3] - b[1]
        if h > base_h * 1.8 and w < base_w * 1.6:
            rows = bands(mask.crop(b), 'y', min_gap=0)
            if len(rows) >= 2:
                for (y0, y1) in rows:
                    r = refine(mask, (b[0], b[1] + y0, b[2], b[1] + y1), pad=1)
                    if r:
                        final.append(r)
                continue
            parts = max(2, round(h / base_h))
            step = h / parts
            for k in range(parts):
                r = refine(mask, (b[0], int(b[1] + k * step), b[2], int(b[1] + (k + 1) * step)), pad=1)
                if r:
                    final.append(r)
            continue
        final.append(b)
    return [im.crop(b) for b in final]


def split_scene(im, name):
    w, h = im.size
    tiles = []
    for r in range(SCENE_GRID):
        for c in range(SCENE_GRID):
            x0 = int(max(0, (c / SCENE_GRID - SCENE_OVERLAP / 2) * w))
            x1 = int(min(w, ((c + 1) / SCENE_GRID + SCENE_OVERLAP / 2) * w))
            y0 = int(max(0, (r / SCENE_GRID - SCENE_OVERLAP / 2) * h))
            y1 = int(min(h, ((r + 1) / SCENE_GRID + SCENE_OVERLAP / 2) * h))
            tiles.append(im.crop((x0, y0, x1, y1)))
    return tiles


def contact(items, name, cols=8, cell=150):
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (cell + 6) + 6, rows * (cell + 20) + 6), (22, 22, 28))
    d = ImageDraw.Draw(sheet)
    for i, it in enumerate(items):
        thumb = it.copy()
        thumb.thumbnail((cell, cell), Image.LANCZOS)
        x = 6 + (i % cols) * (cell + 6)
        y = 6 + (i // cols) * (cell + 20)
        sheet.paste(thumb.convert('RGB'), (x + (cell - thumb.width) // 2, y + 14 + (cell - thumb.height) // 2))
        d.text((x + 2, y + 2), f'{i + 1:03d} {it.width}x{it.height}', fill=(190, 210, 235))
    path = os.path.join(OUT, f'{name}_sheet.png')
    sheet.save(path)
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    report = []
    for f in sorted(os.listdir(REFS)):
        if not f.lower().endswith('.png') or f.startswith('_'):
            continue
        path = os.path.join(REFS, f)
        im = Image.open(path).convert('RGBA')
        rgb = im.convert('RGB')
        unique = len(rgb.getcolors(1 << 24) or [])
        mask = mask_of(im)
        name = os.path.splitext(f)[0]
        sheet = is_sheet(im, mask, unique)
        items = split_sheet(im, mask, name) if sheet else split_scene(im, name)
        folder = os.path.join(OUT, name)
        os.makedirs(folder, exist_ok=True)
        prefix = 'item' if sheet else 'tile'
        for i, it in enumerate(items):
            it.save(os.path.join(folder, f'{prefix}-{i + 1:03d}.png'))
        contact(items, name, cols=8 if sheet else 3, cell=150 if sheet else 260)
        report.append({
            'file': f,
            'size': f'{im.width}x{im.height}',
            'colors': unique,
            'kind': 'sheet' if sheet else 'scene',
            'pieces': len(items),
            'folder': os.path.relpath(folder, REFS).replace('\\', '/'),
        })
        print(f"{f:12s} {report[-1]['size']:>11s} colors={unique:6d} -> {report[-1]['kind']:5s} {len(items):3d} pieces")
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=2)
    print('\nwrote', os.path.join(OUT, 'index.json'))


if __name__ == '__main__':
    main()
