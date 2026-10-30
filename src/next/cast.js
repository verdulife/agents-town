// The cast (A3): a snapshot of live agents becomes the people in the street.
//
// The rule the whole thing rests on is that a state is a place. The bar reports `working`, `planning`,
// `implementing`, `exploring`, `checking`, `deciding`, `blocked`, `idle`; the offices' floors are named after
// the first six, so a `planning` agent belongs in the planning room on floor 1 and nowhere else. `blocked` goes
// up to the roof to smoke and `idle` sits on the park's bench, which is what makes those two read.
//
// Seats are harvested from the furniture that is already drawn, never invented: a desk gives a spot at its
// chair, the meeting table gives four, the café's three tables give six, the gym gives its machines, the park
// gives its bench, the roof gives the parapet. If a room is full, the agent stands at the back of it — a
// person standing in a room is a room with people in it, and two people on one chair is a bug.
//
// Deterministic by construction: agents are ordered (state rank, then id), seats are ordered (the order they
// come out of the layouts), and nothing here reads a clock or a random number. The same snapshot always
// produces the same cast, which is what lets a capture be reproducible (A5).

import { officesLayout } from './offices.js';
import { cafeLayout } from './cafe.js';
import { gymLayout } from './gym.js';
import { parkLayout } from './park.js';
import { AGENTS, STATE_ROOM } from './agents.js';

export const CAST = {
  // How many people a room can hold standing, when every seat is taken. The office rooms are 98 to 217 wide
  // and a person is 10, so this is generous on purpose: the point is to avoid a crowd, not to fill a hall.
  standing: { offices: 4, cafe: 2, gym: 2, park: 2, roof: 1 },
  // The order states claim seats in, so a `working` agent gets a desk before an `idle` one drifts in.
  rank: ['blocked', 'deciding', 'planning', 'implementing', 'exploring', 'checking', 'working', 'idle'],
  // Which seat a person takes when a room offers several: a desk first, then the meeting table's chair, then a
  // machine, the park bench, and the sofa last — a `working` agent on the sofa before any desk was free is the
  // first thing this ordering was written to stop.
  kinds: ['chair', 'seat', 'machine', 'bench', 'sofa', 'smoke'],
};

// Every place the town can put somebody, harvested from the art's own layouts. `place` is what STATE_ROOM names
// and `spot` is where a person's feet go, in page coordinates.
export function spotsOf({ street, groundY } = {}) {
  const spots = [];
  const push = (place, floor, room, kind, x, y, extra = {}) =>
    spots.push({ place, floor, room, kind, x: Math.round(x), y: Math.round(y), ...extra });

  if (street) {
    const offices = street.blocks.find((b) => b.kind === 'offices');
    const cafe = street.blocks.find((b) => b.kind === 'cafe');
    const gym = street.blocks.find((b) => b.kind === 'gym');
    const park = street.blocks.find((b) => b.kind === 'park');

    if (offices) {
      const L = officesLayout();
      const top = groundY - L.h;
      for (const band of L.bands) {
        band.rooms.forEach((room, index) => {
          // a spot per seat the room's own furniture offers: a desk has a chair, a table has chairs, the sofa
          // has a seat. `row` is the room's floor line, so a seated person's feet are on it.
          for (const prop of room.props) {
            if (prop.kind === 'desk') {
              push('offices', band.index, index, 'chair', offices.x + prop.x + prop.w / 2, top + room.row);
            } else if (prop.kind === 'table') {
              const seats = prop.seats ?? 2;
              for (let s = 0; s < seats; s++) {
                push('offices', band.index, index, 'chair', offices.x + prop.x + (prop.w * (s + 0.5)) / seats, top + room.row);
              }
            } else if (prop.kind === 'sofa') {
              push('offices', band.index, index, 'sofa', offices.x + prop.x + prop.w / 2, top + room.row);
            }
          }
          // and the standing room at the back of it, clear of the furniture
          const standing = CAST.standing.offices;
          for (let s = 0; s < standing; s++) {
            push('offices', band.index, index, 'stand', offices.x + room.x + 12 + (room.w - 24) * ((s + 0.5) / standing), top + room.row);
          }
        });
      }
      // the roof: the parapet, where a blocked agent goes to smoke
      const roofY = top + L.roof.wallTop;
      for (let s = 0; s < CAST.standing.roof; s++) {
        push('roof', 3, 0, 'smoke', offices.x + offices.w - 26 - s * 12, roofY + L.roof.wallBottom - L.roof.wallTop);
      }
    }

    if (cafe) {
      const L = cafeLayout();
      const top = groundY - L.h;
      L.tables.forEach((table, index) => {
        // `behind` is which side of the table the seat is on: the café paints the people inside its window and
        // the one behind the tabletop has to be composited under the table, so the cast has to carry it
        push('cafe', 0, index, 'seat', cafe.x + table.left.x, top + table.left.y, { behind: true, facing: table.left.facing });
        push('cafe', 0, index, 'seat', cafe.x + table.right.x, top + table.right.y, { behind: false, facing: table.right.facing });
      });
      for (let s = 0; s < CAST.standing.cafe; s++) push('cafe', 0, 0, 'stand', cafe.x + 20 + s * 24, groundY - 1);
    }

    if (gym) {
      const L = gymLayout();
      const top = groundY - L.h;
      L.treadmills.forEach((x) => push('gym', 0, 0, 'machine', gym.x + x, top + L.floorY));
      L.bikes.forEach((x) => push('gym', 0, 0, 'machine', gym.x + x, top + L.floorY));
      for (let s = 0; s < CAST.standing.gym; s++) push('gym', 0, 0, 'stand', gym.x + 20 + s * 20, groundY - 1);
    }

    if (park) {
      const L = parkLayout(park.w);
      if (L.bench) push('park', 0, 0, 'bench', park.x + L.bench.x + Math.round(L.bench.w / 2), groundY - 1 - (L.plot?.kerb ?? 0) - (L.plot?.grass ?? 0));
      for (let s = 0; s < CAST.standing.park; s++) push('park', 0, 0, 'stand', park.x + Math.round(park.w * (0.3 + s * 0.3)), groundY - 1);
    }
  }
  return spots;
}

// What a state with no room of its own does with its time. An idle (or unknown, which the normaliser already
// reduces to idle) agent CHOOSES: it drinks coffee in the café, trains in the gym or sits on the park's bench —
// and the choice is its own, so two idle agents do not follow each other around and one agent does not change
// its mind between two snapshots. `hashOf(id)` picks the first home; the rest of the list is the fallback order
// when that one is full.
export const LEISURE = [
  { place: 'cafe', floor: 0, room: null },
  { place: 'gym', floor: 0, room: null },
  { place: 'park', floor: 0, room: 0 },
];

// A stable small number per agent (FNV-1a over the id), so the same person always looks the same and always
// chooses the same leisure place.
export function hashOf(id) {
  let h = 2166136261;
  for (const ch of String(id)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// The homes a state tries, in order. A state that names a room has exactly one; a state that does not gets the
// leisure list rotated by its own hash, so the choice is personal and reproducible.
export function homesFor(state, id = '') {
  const room = STATE_ROOM[state];
  if (room) return [room];
  const at = hashOf(id) % LEISURE.length;
  return [...LEISURE.slice(at), ...LEISURE.slice(0, at)];
}

function orderOf(state) {
  const i = CAST.rank.indexOf(state);
  return i < 0 ? CAST.rank.length : i;
}

// A snapshot becomes a cast: one person per agent, in the room its state names, on a seat if there is one.
// `lift` is the queue of people whose place is on another floor than the one they are drawn on — the plan says
// who needs the lift and in what order; carrying them is the animation's job (T4).
export function planCast(snapshot, world) {
  const spots = spotsOf(world);
  const taken = new Set();
  const agents = [...(snapshot?.agents ?? [])].sort((a, b) => orderOf(a.state) - orderOf(b.state) || String(a.id).localeCompare(String(b.id)));
  const cast = [];
  const overflow = [];
  for (const agent of agents) {
    // a state tries its homes in order: one room when it names one, the leisure list — rotated by its own hash —
    // when it does not (A3: unknown and idle choose between the café, the gym and the park)
    const homes = homesFor(agent.state, agent.id);
    let room = homes[0];
    let mine = [];
    for (const home of homes) {
      const candidates = spots.filter(
        (s) => s.place === home.place && s.floor === home.floor && (home.room === null || s.room === home.room),
      );
      if (candidates.some((s) => !taken.has(keyOf(s)))) {
        room = home;
        mine = candidates;
        break;
      }
      room = home;
      mine = candidates;
    }
    // a seat first, then standing room: the order is the layouts', so which chair a given agent gets is a
    // property of the snapshot and not of the moment it is drawn
    const seat = CAST.kinds.map((kind) => mine.find((s) => s.kind === kind && !taken.has(keyOf(s)))).find(Boolean);
    const stand = seat ? null : mine.find((s) => s.kind === 'stand' && !taken.has(keyOf(s)));
    const spot = seat ?? stand;
    if (!spot) {
      overflow.push({ id: agent.id, label: agent.label, state: agent.state, place: room.place });
      continue;
    }
    taken.add(keyOf(spot));
    cast.push({
      id: agent.id,
      label: agent.label,
      state: agent.state,
      phase: agent.phase,
      place: room.place,
      floor: room.floor,
      room: room.room,
      kind: spot.kind,
      x: spot.x,
      y: spot.y,
    });
  }
  // the lift: whoever is not on the floor their state names, in the cast's own order
  const lift = cast.filter((npc) => npc.place === 'offices' && npc.floor !== 0).map((npc) => ({ id: npc.id, to: npc.floor }));
  return { cast, overflow, lift, seats: taken.size, spots: spots.length };
}

function keyOf(spot) {
  return `${spot.place}:${spot.floor}:${spot.room}:${spot.kind}:${spot.x}`;
}

// The states the town can show, for the page's readout and for the check.
export function castStates() {
  return AGENTS.states.slice();
}
