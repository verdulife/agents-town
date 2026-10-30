// People moving in the street (A4). The cast says where each agent belongs; this module says how it gets there,
// from one clock and nothing else.
//
// A person arrives at the edge of their room and walks to their spot: from the lift on the offices' floors, from
// the door in the café, from the shutter in the gym, from the gate in the park. The walk is a straight line at a
// fixed speed — this is an elevation, so a person crosses the frame and does not walk into it — and it starts at
// a per-person stagger so a floor does not empty itself in one instant.
//
// Everything here is a pure function of (plan, when the plan was adopted, the clock): no `Date`, no randomness, so
// `?anim=0` freezes everybody at their first frame and `?pause=1&sim=N` reproduces a capture exactly (A5).

import { officesLayout } from './offices.js';
import { cafeLayout } from './cafe.js';
import { AGENTS } from './agents.js';

export const NPC = {
  speed: 18, // art px per second: a 217 px room takes twelve seconds to cross, which reads as a walk
  walkFps: 6,
  stagger: 0.35, // seconds between one person starting and the next
  seatPoses: ['seat'], // kinds that sit down; everything else stands
  // The ride: long enough to read as going somewhere and short enough not to be a wait. The doors open and close
  // inside it, and the person is out of sight in between — the lift is the only way between floors, so nobody is
  // ever seen to change floor anywhere else (A4b).
  ride: { seconds: 2.4, doorSeconds: 0.5 },
};

// A change of state is a journey (A4b): the agent walks from where it was to the lift on its floor, rides, and
// walks out on the new one to its new seat. Three legs and a hidden cabin, all measured in seconds from
// `planAt`, so nothing teleports — which is exactly what the first version of the page did when the cast changed.
//
// A journey inside one floor is a single walk. A journey between floors is walk + ride + walk. A journey between
// two buildings is a walk from the new place's own way in, because there is no street-level path in an elevation
// and inventing one would be worse than saying so.
export function journeyOf(prev, next, world) {
  const wayIn = arrivalOf(next, world);
  if (!prev) return { legs: [{ kind: 'walk', from: wayIn, to: next }] };
  if (prev.place === next.place && prev.floor === next.floor) {
    return { legs: [{ kind: 'walk', from: { x: prev.x, y: prev.y }, to: next }] };
  }
  if (prev.place === 'offices' && next.place === 'offices' && prev.floor !== next.floor) {
    return {
      legs: [
        { kind: 'walk', from: { x: prev.x, y: prev.y }, to: arrivalOf(prev, world) },
        { kind: 'ride', from: prev.floor, to: next.floor },
        { kind: 'walk', from: wayIn, to: next },
      ],
    };
  }
  return { legs: [{ kind: 'walk', from: wayIn, to: next }] };
}

// The legs in seconds: a walk at the fixed speed, a ride at the fixed length, a stagger at the front.
function timingsOf(journey) {
  let at = 0;
  return journey.legs.map((leg) => {
    const span = leg.kind === 'ride' ? NPC.ride.seconds : Math.abs(leg.to.x - leg.from.x) / NPC.speed;
    const out = { ...leg, start: at, end: at + span, span };
    at += span;
    return out;
  });
}

export function journeyTime(journey) {
  return timingsOf(journey).reduce((total, leg) => total + leg.span, 0);
}

// Where somebody enters their room, in page coordinates. The offices' floors all arrive at the lift, because the
// lift is the only circulation the building has — that is the whole point of putting it inside.
export function arrivalOf(npc, world) {
  const { street, groundY } = world;
  const block = street?.blocks.find((b) => b.kind === npc.place) ?? street?.blocks.find((b) => b.kind === 'offices');
  if (npc.place === 'offices' || npc.place === 'roof') {
    const L = officesLayout();
    const band = L.bands.find((b) => b.index === npc.floor) ?? L.bands[0];
    const x = (street?.blocks.find((b) => b.kind === 'offices')?.x ?? 0) + band.lift.x + Math.round(band.lift.w / 2);
    const top = groundY - L.h;
    const y = npc.place === 'roof' ? top + L.roof.wallBottom : top + band.row;
    return { x, y };
  }
  if (npc.place === 'cafe') {
    // the café's layout has no `doorX`: `standX` is the column the person by the door used to stand on, which is
    // the door pier, and that is the way in
    const L = cafeLayout();
    return { x: (block?.x ?? 0) + (L.standX ?? 40), y: groundY - 1 };
  }
  // the gym and the park: their own left edge, a couple of pixels in
  return { x: (block?.x ?? 0) + 12, y: groundY - 1 };
}

// One person at one instant: where, facing which way, in which pose, on which frame.
export function walkerOf(npc, world, { clock, planAt, index = 0, journey = null }) {
  const trip = timingsOf(journey ?? journeyOf(null, npc, world));
  const start = planAt + index * NPC.stagger;
  const elapsed = Math.max(0, clock - start);
  let at = 0;
  for (const leg of trip) {
    const local = elapsed - at;
    if (leg.kind === 'ride') {
      // in the cabin: nobody is drawn, and the doors are the only thing that says where they went
      if (local < leg.span) {
        return { x: leg.from, y: 0, facing: 1, pose: 'ride', phase: 0, moving: false, seated: false, arrived: false, hidden: true, seed: hashOf(npc.id) % 7 };
      }
      at += leg.span;
      continue;
    }
    if (local < leg.span || leg === trip[trip.length - 1]) {
      const t = leg.span > 0 ? Math.min(1, Math.max(0, local / leg.span)) : 1;
      const x = Math.round(leg.from.x + (leg.to.x - leg.from.x) * t);
      const y = Math.round(leg.from.y + (leg.to.y - leg.from.y) * t);
      const moving = local < leg.span && leg.span > 0.01;
      const facing = leg.to.x >= leg.from.x ? 1 : -1;
      const seated = !moving && NPC.seatPoses.includes(npc.kind);
      const pose = moving ? 'walk' : seated ? 'seat' : 'stand';
      const phase = moving ? Math.floor(Math.max(0, local) * NPC.walkFps) % 2 : 0;
      return { x, y, facing, pose, phase, moving, seated, arrived: !moving && leg === trip[trip.length - 1], hidden: false, seed: hashOf(npc.id) % 7 };
    }
    at += leg.span;
  }
  // daylight: standing on the spot
  return { x: npc.x, y: npc.y, facing: 1, pose: NPC.seatPoses.includes(npc.kind) ? 'seat' : 'stand', phase: 0, moving: false, seated: NPC.seatPoses.includes(npc.kind), arrived: true, hidden: false, seed: hashOf(npc.id) % 7 };
}

// A stable small number per agent, so the same person always looks the same and two agents do not look alike by
// accident. FNV-1a over the id, cut to the number of looks the sprite set offers.
export function hashOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The whole cast at one instant, ready to draw. `previous` is the cast before this one: whoever kept their id and
// changed room travels, and everybody else is where they were.
export function walkers(plan, world, { clock, planAt, previous = null }) {
  if (!plan) return [];
  const before = new Map((previous?.cast ?? []).map((npc) => [npc.id, npc]));
  return plan.cast.map((npc, index) => {
    const was = before.get(npc.id) ?? null;
    const journey = journeyOf(was, npc, world);
    return { npc, journey, ...walkerOf(npc, world, { clock, planAt, index, journey }) };
  });
}

// How long until everybody in a plan has arrived: the page uses it to know when the street has settled.
export function settleTime(plan, world, previous = null) {
  if (!plan) return 0;
  const before = new Map((previous?.cast ?? []).map((npc) => [npc.id, npc]));
  let worst = 0;
  plan.cast.forEach((npc, index) => {
    const journey = journeyOf(before.get(npc.id) ?? null, npc, world);
    worst = Math.max(worst, index * NPC.stagger + journeyTime(journey));
  });
  return worst;
}

// The states that sit down, for the check and for the rooms (T5).
export function seatKinds() {
  return NPC.seatPoses.slice();
}

export const NPC_LIMITS = { max: AGENTS.maxNpc };
