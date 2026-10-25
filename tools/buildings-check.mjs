// Building generator invariants. Pure spec + geometry, no canvas:
//   node tools/buildings-check.mjs

import { installCanvasStub } from './canvas-stub.mjs';
installCanvasStub();
import {
  BUILDING_TYPES,
  buildingGeometry,
  variantFor,
  gallerySpecs,
  STREET_TYPES,
  GROUND_H,
  STOREY_H,
  OVERHANG,
} from '../src/next/buildings.js';
import { TILE } from '../src/next/art-spec.js';
import { buildingSprite } from '../src/next/buildings.js';
import { WORLD_W } from '../src/next/scale.js';

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
const ROOF_STYLES = new Set(['gable', 'flat', 'shed', 'hip']);
const types = Object.keys(BUILDING_TYPES);

console.log('buildings check\n');

check('every type produces a spec with segments summing to its width', () => {
  for (const type of types) {
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
  for (const type of types) {
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
  for (const type of types) {
    for (let seed = 1; seed <= 8; seed++) {
      const spec = variantFor(type, seed);
      const g = buildingGeometry(spec);
      assert(g.W <= WORLD_W / 2, `${type}/${seed} is ${g.W}px wide, half the world is ${WORLD_W / 2}`);
      assert(spec.tilesW >= 3, `${type}/${seed} is only ${spec.tilesW} tiles wide`);
    }
  }
});

check('same type and seed give the same building', () => {
  for (const type of types) {
    const a = variantFor(type, 42);
    const b = variantFor(type, 42);
    assert(JSON.stringify(a) === JSON.stringify(b), `${type} is not deterministic`);
  }
});

check('different seeds give different buildings', () => {
  for (const type of types) {
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
    const count = specs.filter((s) => s.type === type).length;
    assert(count === 3, `${type} appears ${count} times`);
  }
});

check('cottage is gone and the new types exist', () => {
  assert(!types.includes('cottage'), 'cottage should be removed');
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

check('the street card only asks for types that exist', () => {
  for (const t of STREET_TYPES) {
    assert(BUILDING_TYPES[t], `street card references missing type "${t}"`);
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
