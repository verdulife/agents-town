// Building generator invariants. Pure spec + geometry, no canvas:
//   node tools/buildings-check.mjs

import { installCanvasStub } from './canvas-stub.mjs';
installCanvasStub();
import {
  BUILDING_TYPES,
  buildingGeometry,
  variantFor,
  annexFor,
  annexMetrics,
  gallerySpecs,
  STREET_TYPES,
  ANCHOR_HOSTS,
  GROUND_H,
  STOREY_H,
  OVERHANG,
  signPlate,
} from '../src/next/buildings.js';
import { TILE } from '../src/next/art-spec.js';
import { buildingSprite } from '../src/next/buildings.js';
import { WORLD_W } from '../src/next/scale.js';
import { FONTS, lineWidth } from '../src/font.js';

let failures = 0;
let checks = 0;

function check(name, fn) {
  checks++;
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const KINDS = new Set(['wall', 'window', 'shopfront', 'door', 'steps', 'garage', 'arch', 'balcony', 'sign', 'awning']);
const ROOF_STYLES = new Set(['gable', 'flat', 'shed']);
const types = Object.keys(BUILDING_TYPES);
// Types that can be a building of their own. warehouse and garage only exist as
// a wing on a host, so they are reached through annexFor instead of variantFor.
const hostTypes = types.filter((t) => !BUILDING_TYPES[t].attached);
const attachedTypes = types.filter((t) => BUILDING_TYPES[t].attached);

// What a gallery entry is "of": its own type, or the type it hangs off a host.
const shownType = (spec) => (spec.annex ? spec.annex.type : spec.type);

console.log('buildings check\n');

check('every type produces a spec with segments summing to its width', () => {
  for (const type of hostTypes) {
    for (let seed = 1; seed <= 6; seed++) {
      const spec = variantFor(type, seed);
      for (const floor of ['ground', 'upper']) {
        const total = spec[floor].reduce((sum, seg) => sum + seg.tiles, 0);
        assert(
          Math.abs(total - spec.tilesW) < 1e-9,
          `${type}/${seed} ${floor} covers ${total} tiles, building is ${spec.tilesW}`,
        );
        for (const seg of spec[floor]) {
          assert(KINDS.has(seg.kind), `${type}/${seed} unknown segment kind "${seg.kind}"`);
          assert(seg.tiles > 0, `${type}/${seed} segment with ${seg.tiles} tiles`);
        }
      }
    }
  }
});

check('geometry follows the contract', () => {
  for (const type of hostTypes) {
    const spec = variantFor(type, 3);
    const g = buildingGeometry(spec);
    const expectedW = spec.tilesW * TILE + OVERHANG * 2;
    const expectedH = spec.roofDepth + GROUND_H + (spec.storeys - 1) * STOREY_H;
    assert(g.W === expectedW, `${type}: width ${g.W} !== ${expectedW}`);
    assert(g.H === expectedH, `${type}: height ${g.H} !== ${expectedH}`);
    assert(ROOF_STYLES.has(spec.roofStyle), `${type}: unknown roof style ${spec.roofStyle}`);
  }
});

check('every building fits the world and the view', () => {
  for (const type of hostTypes) {
    for (let seed = 1; seed <= 8; seed++) {
      const spec = variantFor(type, seed);
      const g = buildingGeometry(spec);
      assert(g.W <= WORLD_W / 2, `${type}/${seed} is ${g.W}px wide, half the world is ${WORLD_W / 2}`);
      assert(spec.tilesW >= 3, `${type}/${seed} is only ${spec.tilesW} tiles wide`);
    }
  }
});

check('same type and seed give the same building', () => {
  for (const type of hostTypes) {
    const a = variantFor(type, 42);
    const b = variantFor(type, 42);
    assert(JSON.stringify(a) === JSON.stringify(b), `${type} is not deterministic`);
  }
});

check('different seeds give different buildings', () => {
  for (const type of hostTypes) {
    const seen = new Set();
    for (let seed = 1; seed <= 8; seed++) {
      const spec = variantFor(type, seed);
      seen.add(JSON.stringify([spec.tilesW, spec.wall, spec.roof, spec.ground, spec.canopy, spec.sign]));
    }
    assert(seen.size >= 3, `${type} only produced ${seen.size} distinct variants in 8 seeds`);
  }
});

check('the gallery covers every type three times', () => {
  const specs = gallerySpecs(1);
  assert(specs.length === types.length * 3, `gallery has ${specs.length} entries`);
  for (const type of types) {
    const count = specs.filter((s) => shownType(s) === type).length;
    assert(count === 3, `${type} appears ${count} times`);
  }
});

check('cottage and civic are gone and the new types exist', () => {
  assert(!types.includes('cottage'), 'cottage should be removed');
  assert(!types.includes('civic'), 'civic was discarded: it must not come back');
  for (const t of ['garage', 'hotel']) assert(types.includes(t), `${t} is missing`);
});

check('every gallery variant paints without throwing', () => {
  for (const spec of gallerySpecs(1)) {
    const spr = buildingSprite(spec);
    const g = buildingGeometry(spec);
    assert(spr.w === g.W && spr.h === g.H, `${spec.type}/${spec.seed}: sprite ${spr.w}x${spr.h} !== geometry ${g.W}x${g.H}`);
    assert(spr.canvas.width === g.W, `${spec.type}/${spec.seed}: canvas width mismatch`);
  }
});

// --- page-2 art rules ------------------------------------------------------

check('garage and warehouse are never standalone buildings', () => {
  for (const type of attachedTypes) {
    let message = '';
    try {
      variantFor(type, 4);
    } catch (err) {
      message = err.message;
    }
    assert(message, `variantFor('${type}') did not throw`);
    assert(/attached-only/.test(message), `variantFor('${type}') threw the wrong error: ${message}`);
    assert(/annexFor/.test(message), `the ${type} error does not say how to build it: ${message}`);
  }
  const specs = gallerySpecs(1);
  const composites = specs.filter((s) => s.annex);
  for (const type of attachedTypes) {
    assert(composites.filter((s) => s.annex.type === type).length === 3, `${type} is not shown three times as a wing`);
  }
  assert(composites.length === attachedTypes.length * 3, `gallery has ${composites.length} composites`);
  for (const spec of specs) {
    assert(!attachedTypes.includes(spec.type), `gallery draws a standalone ${spec.type}`);
    assert(hostTypes.includes(spec.type), `gallery entry has no valid host: ${spec.type}`);
    if (spec.annex) assert(hostTypes.includes(spec.type), `the ${spec.annex.type} wing has no host`);
  }
});

check('no building carries roof props: the roofs are clean', () => {
  for (const type of types) {
    const got = BUILDING_TYPES[type].roofProps;
    assert(got === undefined, `${type} still declares roofProps [${(got || []).join(', ')}]`);
  }
  // nothing on the roof anywhere in the gallery, composites included
  for (const spec of gallerySpecs(1)) {
    assert(spec.roofProps === undefined, `${spec.type}/${spec.seed} still carries roof props`);
    if (spec.annex) assert(spec.annex.roofProps === undefined, `the ${spec.annex.type} wing grew roof props`);
  }
});

check('a wing widens the sprite and keeps the host height', () => {
  for (const host of ANCHOR_HOSTS) {
    for (const wing of attachedTypes) {
      for (let seed = 1; seed <= 4; seed++) {
        const spec = annexFor(host, wing, seed);
        const hostGeo = buildingGeometry(variantFor(host, seed));
        const am = annexMetrics(spec.annex);
        const g = buildingGeometry(spec);
        const where = `${wing}@${host}/${seed}`;
        assert(spec.type === host, `${where}: the host type became ${spec.type}`);
        assert(g.W === hostGeo.W + am.W, `${where}: width ${g.W} !== ${hostGeo.W} + ${am.W}`);
        assert(g.H === hostGeo.H, `${where}: height ${g.H} !== host height ${hostGeo.H}`);
        assert(am.H < hostGeo.H, `${where}: the wing is ${am.H}px tall, the host only ${hostGeo.H}px`);
        assert(spec.annex.type === wing, `${where}: annex type is ${spec.annex.type}`);
        assert(spec.annex.tiles >= 2 && spec.annex.tiles <= 3, `${where}: ${spec.annex.tiles} wing tiles`);
        assert(spec.annex.side === 'left' || spec.annex.side === 'right', `${where}: side is ${spec.annex.side}`);
        assert(
          spec.annex.roofStyle === (wing === 'warehouse' ? 'shed' : 'flat'),
          `${where}: wing roof style is ${spec.annex.roofStyle}`,
        );
        assert(BUILDING_TYPES[wing].walls.includes(spec.annex.wall), `${where}: wall ${spec.annex.wall} is not a ${wing} material`);
        assert(BUILDING_TYPES[wing].roofs.includes(spec.annex.roof), `${where}: roof ${spec.annex.roof} is not a ${wing} material`);
      }
    }
  }
  // a wing cannot host, and a standalone building cannot be a wing
  let threw = 0;
  try {
    annexFor(attachedTypes[0], attachedTypes[0], 1);
  } catch {
    threw++;
  }
  try {
    annexFor('house', 'house', 1);
  } catch {
    threw++;
  }
  try {
    annexFor('nonsense', attachedTypes[0], 1);
  } catch {
    threw++;
  }
  assert(threw === 3, `annexFor accepted ${3 - threw} invalid host/wing pair(s)`);
});

check('the street card only asks for types that exist', () => {
  for (const t of STREET_TYPES) {
    assert(BUILDING_TYPES[t], `street card references missing type "${t}"`);
  }
});

check('no facade hangs the yellow sign', () => {
  for (const type of hostTypes) {
    for (let seed = 1; seed <= 8; seed++) {
      const spec = variantFor(type, seed);
      assert(
        !(spec.details || []).includes('hangingSign'),
        `${type}/${seed} still hangs the yellow sign on the facade`,
      );
    }
  }
});

check('sign plates hug their text instead of filling the facade', () => {
  const facade = 60; // the narrowest shop fascia: 4 tiles minus the two-pixel inset
  const short = signPlate('Bar', facade);
  const long = signPlate('Market', facade);
  assert(short.w < facade, `"Bar" plate is ${short.w}px wide, as wide as the ${facade}px facade`);
  assert(long.w > short.w, 'a longer name did not widen the plate');
  assert(long.w <= facade, `"Market" plate overflows the facade: ${long.w} > ${facade}`);
  // two pixels of padding around the text, not a fixed band
  assert(short.w === short.tw + 6, `"Bar" plate is ${short.w}px for ${short.tw}px of text: padding is not 3px per side`);
  assert(short.h === FONTS.tiny.rows + 4, `plate is ${short.h}px tall, expected the 3x5 face plus 2px per side`);
});

check('shop signs use the smallest face in the kit', () => {
  const smallest = Math.min(...Object.values(FONTS).map((f) => f.rows * f.cols));
  assert(FONTS.tiny.rows * FONTS.tiny.cols === smallest, 'there is a face smaller than the one signs use');
  const narrowest =
    Math.min(...types.filter((t) => BUILDING_TYPES[t].sign).map((t) => Math.min(...BUILDING_TYPES[t].widths))) * TILE;
  for (const word of ['Market', 'Flores', 'Ramen', 'Books']) {
    assert(signPlate(word, narrowest - 4).w <= narrowest - 4, `"${word}" does not fit a ${narrowest}px fascia`);
  }
});

check('every face folds lowercase input up to capitals', () => {
  // the sign face is caps-only by design: "Bar" must set as BAR, not fall back to "?"
  for (const font of ['big', 'tiny']) {
    assert(lineWidth('bar', { font }) === lineWidth('BAR', { font }), `${font}: lowercase changed the advance`);
    assert(FONTS[font].glyphs['B'], `${font} has no B glyph`);
  }
});


check('unknown types fail loudly', () => {
  let threw = false;
  try {
    variantFor('castle', 1);
  } catch {
    threw = true;
  }
  assert(threw, 'variantFor accepted an unknown type');
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
