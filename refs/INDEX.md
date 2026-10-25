# Reference index

8 images, split by `python tools/refs_split.py` (re-runnable; outputs land in
`refs/_split/`, one folder per source image plus a numbered contact sheet).

Two very different kinds of material here, and they are useful in different ways:

- **Scenes** are hand-made pixel art: ~86-95 colours, no upscale, so their pixel
  grid is real and their proportions can be measured.
- **Sheets** are generated images: 69k-122k colours and no pixel module, so they
  are useful for *what exists* and for colour/proportion ideas, not for pixel
  technique.

## Scenes (measurable pixel art)

| file | size | colours | what it shows | split |
| --- | --- | --- | --- | --- |
| `G3hGUH.png` | 634x729 | 89 | Cinema block: a "CINEMA" building with marquee, plaza, streets with cars, a park with a fountain at the top, crosswalks | 3x3 crops |
| `GHE4Qd.png` | 1045x855 | 92 | Commercial boulevard: supermarket/arcade with a long awning, shops, parking lots with cars, planted medians | 3x3 crops |
| `HEykPU.png` | 792x792 | 86 | Civic square: large classical building with steps, plaza with fountain, trees, people, cars | 3x3 crops |
| `KAJHUP.png` | 665x728 | 92 | Street corner: orange/red building block, crossing streets, cars, trees, small plaza | 3x3 crops |
| `YhwpA9.png` | 1045x855 | 95 | Shops and parking: storefronts with awnings, parking area, cars, trees, road | 3x3 crops |

## Sheets (generated, vocabulary only)

| file | size | colours | what it shows | split |
| --- | --- | --- | --- | --- |
| `SNROZF.png` | 686x1263 | 72.9k | Vehicles: the same car in four directions and several colours, arranged in columns, plus isolated cars | 145 pieces |
| `X8ZY9k.png` | 1543x1307 | 69.1k | Characters: a grid of ~288 small figures with varied clothes and colours | 288 pieces |
| `iQmkjz.png` | 1717x1092 | 122.1k | Buildings and street furniture: wide shopfronts, pitched-roof houses, flat-roof blocks, roof fills, roundabouts/plazas, road markings, a classical town hall | 93 pieces |

## How the split works, and where it is imperfect

- **Scenes** are cut into a 3x3 grid with 12% overlap, at native resolution. Exact
  and predictable: `tile-r1c1.png` ... `tile-r3c3.png`.
- **Sheets** are split by detecting detached items over the flat backdrop, then a
  second pass cuts the tall pieces that a grid column had merged (four cars
  stacked, for example). Because the generated sheets have soft edges and some
  items touch, a few pieces still group two variants, and a few tiny fragments
  survive. They are still perfectly readable for reference purposes.
- `index.json` holds the machine-readable version of the table above.

## Review files

- `refs/_split/<image>_sheet.png` - numbered contact sheet of that image's pieces.
- `refs/_contact.png` - the eight originals as thumbnails.

## Next step this material enables

The five scenes are the only *measurable* reference, so the next pass is to extract
from them: the tile module, the door/NPC/building/car/road proportions, and the
value distribution of their palettes. Those numbers go into `src/next/art-spec.js`
before any hero art is drawn.
