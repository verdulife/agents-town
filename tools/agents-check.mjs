// The agents' contract (A1, A5, A6). The bridge and the endpoint need Python and a dev server, so what is
// checked here is the part the page depends on and can be asked anywhere: the normaliser, the state table and
// the fallback.
//   node tools/agents-check.mjs

const here = new URL('.', import.meta.url);
const { AGENTS, STATE_ROOM, normaliseSnapshot, staticSnapshot, fetchAgents } = await import(
  new URL('../src/next/agents.js', here).href
);
// the cast is imported here, with the rest: two of the checks below (the state table and the static fallback)
// ask it where a state can be, so it has to exist before the first check runs
const { planCast, spotsOf, homesFor, LEISURE } = await import(new URL('../src/next/cast.js', here).href);

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

console.log('agents check\n');

check('every state the bar reports has somewhere to be', () => {
  for (const state of AGENTS.states) {
    // a state either names a room or falls to the leisure list — `idle` deliberately names none, because it
    // chooses (café, gym or park), and an empty place for it would make that choice impossible
    const homes = homesFor(state, 'probe');
    assert(homes.length > 0, `${state} has nowhere to be`);
    for (const home of homes) {
      assert(['offices', 'roof', 'park', 'cafe', 'gym'].includes(home.place), `${state} is in ${home.place}`);
      assert(Number.isInteger(home.floor), `${state} has no floor`);
    }
  }
  assert(!STATE_ROOM.idle, 'idle has a room again: it would never choose');
});

check('an unknown state becomes idle and the list keeps its order', () => {
  const snap = normaliseSnapshot({
    source: 'widget',
    agents: [
      { id: 'a', label: 'alpha', state: 'working' },
      { id: 'b', label: 'beta', state: 'dancing' },
      { id: 'a', label: 'alpha again', state: 'idle' },
    ],
  });
  assert(snap.agents.length === 2, `${snap.agents.length} agents: the duplicate id was not dropped`);
  assert(snap.agents[0].state === 'working', 'the order changed');
  assert(snap.agents[1].state === 'idle', `an unknown state stayed ${snap.agents[1].state}`);
  assert(snap.stale === false, 'a valid snapshot came out stale');
});

check('nonsense in is a stale snapshot out, never an exception', () => {
  for (const bad of [null, undefined, 42, 'text', [], {}, { agents: 'no' }]) {
    const snap = normaliseSnapshot(bad);
    assert(snap && Array.isArray(snap.agents), `normalising ${JSON.stringify(bad)} did not return a snapshot`);
    assert(snap.stale === true, `normalising ${JSON.stringify(bad)} did not mark it stale`);
  }
});

check('the cast is capped and the labels are short enough for the street', () => {
  const many = Array.from({ length: AGENTS.maxNpc + 6 }, (_, i) => ({ id: `a${i}`, label: 'x'.repeat(40), state: 'working' }));
  const snap = normaliseSnapshot({ source: 'widget', agents: many });
  assert(snap.agents.length === AGENTS.maxNpc, `${snap.agents.length} agents: the cap is ${AGENTS.maxNpc}`);
  for (const agent of snap.agents) assert(agent.label.length <= 22, `a label is ${agent.label.length} chars`);
});

check('the static fallback is a real cast, not an empty street', () => {
  const snap = staticSnapshot();
  assert(snap.agents.length >= 2, `${snap.agents.length} fallback agents`);
  assert(snap.source === 'static', `the fallback says it comes from ${snap.source}`);
  for (const agent of snap.agents) assert(homesFor(agent.state, agent.id).length > 0, `${agent.id} has nowhere to be`);
});

check('the same snapshot normalises to the same town, twice', () => {
  const raw = { source: 'widget', agents: [{ id: 'a', label: 'pixel-town', state: 'exploring' }] };
  const a = JSON.stringify(normaliseSnapshot(raw));
  const b = JSON.stringify(normaliseSnapshot(raw));
  assert(a === b, 'two identical snapshots normalise differently');
});

check('a dead endpoint is a stale static cast, and fetchAgents never throws', async () => {
  const boom = () => Promise.reject(new Error('offline'));
  const bad = await fetchAgents(boom);
  assert(bad.stale === true, 'a failed fetch was not marked stale');
  assert(bad.agents.length >= 2, 'a failed fetch left the street empty');
  const notOk = await fetchAgents(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
  assert(notOk.stale === true, 'a 500 was not marked stale');
});

// --- the cast (T2) ----------------------------------------------------------
//
// The plan needs the real modules, which paint, so the raster stub goes in first and the street is measured
// once. What is asked here is what the page will rely on: nobody twice on a chair, everybody has a place, and
// the same snapshot always makes the same street.
const raster = await import('./ground-check.mjs?stub').catch(() => null);
void raster;
const { streetLayout } = await import('../src/next/street.js');
const STREET = streetLayout(960, 470, 399);
const WORLD = { street: STREET, groundY: 399 };
const snapshotOf = (agents) => normaliseSnapshot({ source: 'widget', agents });

// --- walking (T3) -----------------------------------------------------------
const { walkers, arrivalOf, settleTime } = await import('../src/next/npc.js');
const snapshot3 = snapshotOf([
  { id: 'a', label: 'pixel-town', state: 'working' },
  { id: 'b', label: 'olivella', state: 'planning' },
  { id: 'c', label: 'town', state: 'idle' },
]);
const plan3 = planCast(snapshot3, WORLD);

check('everybody starts where their room lets them in and ends exactly on their spot', () => {
  const atZero = walkers(plan3, WORLD, { clock: 0, planAt: 0 });
  for (const walker of atZero) {
    const from = arrivalOf(walker.npc, WORLD);
    assert(Math.abs(walker.x - from.x) <= 20, `${walker.npc.label} starts ${Math.abs(walker.x - from.x)} px from the way in`);
    assert(walker.y === from.y, `${walker.npc.label} starts on row ${walker.y}, the way in is ${from.y}`);
  }
  const settled = walkers(plan3, WORLD, { clock: settleTime(plan3, WORLD) + 1, planAt: 0 });
  for (const walker of settled) {
    assert(!walker.moving, `${walker.npc.label} is still walking after the street should have settled`);
    assert(walker.x === walker.npc.x && walker.y === walker.npc.y, `${walker.npc.label} stopped at ${walker.x},${walker.y} and not on its spot`);
  }
});

check('a person walks facing the way they are going, and stands when they arrive', () => {
  const walker = walkers(plan3, WORLD, { clock: 0.5, planAt: 0 }).find((w) => w.moving);
  assert(walker, 'nobody is moving half a second in: the stagger is too long');
  assert(walker.pose === 'walk', `a moving person is in pose ${walker.pose}`);
  assert(walker.facing === Math.sign(walker.npc.x - arrivalOf(walker.npc, WORLD).x), 'a person walks away from their spot');
  const arrived = walkers(plan3, WORLD, { clock: settleTime(plan3, WORLD) + 1, planAt: 0 })[0];
  assert(arrived.pose !== 'walk', `an arrived person is still in pose ${arrived.pose}`);
});

check('an idle or unknown agent chooses its own way to pass the time', () => {
  const ids = ['pixel-town', 'olivella', 'botanic', 'gentle-ai', 'town', 'hola', 'otro', 'mas'];
  const first = ids.map((id) => homesFor('idle', id)[0].place);
  const distinct = new Set(first);
  assert(distinct.size >= 2, `every idle agent chose the same place: ${[...distinct].join(', ')}`);
  for (const id of ids) {
    assert(homesFor('idle', id)[0].place === homesFor('idle', id)[0].place, 'the same agent changed its mind');
    assert(homesFor('unknown', id)[0].place === homesFor('idle', id)[0].place, 'unknown does not choose like idle');
    // and the fallback order still contains every leisure place, so a full café sends people to the gym
    assert(new Set(homesFor('idle', id).map((h) => h.place)).size === LEISURE.length, 'a leisure place is missing from the fallback');
  }
});

check('the cast walks the same way twice, and never off the street', () => {
  for (const clock of [0, 1, 3, 9, 20]) {
    const a = walkers(plan3, WORLD, { clock, planAt: 0 });
    const b = walkers(plan3, WORLD, { clock, planAt: 0 });
    assert(JSON.stringify(a) === JSON.stringify(b), `the walk at t=${clock} is not reproducible`);
    for (const walker of a) {
      assert(walker.x >= 0 && walker.x <= 960, `a person is at x ${walker.x}`);
      assert(walker.y > 0 && walker.y <= 470, `a person is at y ${walker.y}`);
    }
  }
});

check('the street settles in a finite time and the plan knows how long', () => {
  const settle = settleTime(plan3, WORLD);
  assert(settle > 0 && settle < 60, `the street takes ${settle.toFixed(1)} s to settle`);
});

check('every place the town offers comes from the art, and there are spots for all of them', () => {
  const spots = spotsOf(WORLD);
  assert(spots.length >= 20, `${spots.length} spots: the furniture gives more than that`);
  for (const spot of spots) {
    assert(spot.x >= 0 && spot.x <= 960, `a ${spot.place} spot is at x ${spot.x}`);
    assert(spot.y >= 0 && spot.y <= 470, `a ${spot.place} spot is at y ${spot.y}`);
    assert(AGENTS.states.includes(spot.kind) === false, 'a spot kind collides with a state name');
  }
  for (const place of ['offices', 'cafe', 'gym', 'park', 'roof']) {
    assert(spots.some((s) => s.place === place), `the ${place} offers no spot at all`);
  }
});

check('one person per agent, each in the room its state names', () => {
  const snap = snapshotOf([
    { id: 'a', label: 'pixel-town', state: 'working' },
    { id: 'b', label: 'olivella', state: 'planning' },
    { id: 'c', label: 'gentle-ai', state: 'implementing' },
    { id: 'd', label: 'botanic', state: 'exploring' },
    { id: 'e', label: 'town', state: 'deciding' },
    { id: 'f', label: 'smoker', state: 'blocked' },
    { id: 'g', label: 'idler', state: 'idle' },
  ]);
  const plan = planCast(snap, WORLD);
  assert(plan.cast.length === snap.agents.length, `${plan.cast.length} people for ${snap.agents.length} agents`);
  assert(plan.overflow.length === 0, `${plan.overflow.length} agents had nowhere to go`);
  for (const npc of plan.cast) {
    // a state may have more than one home — an idle agent drinks coffee in the café until the six seats are
    // taken and only then sits on the park's bench — so the cast has to be in one of the homes it lists
    const homes = homesFor(npc.state, npc.id);
    const fits = homes.some((home) => home.place === npc.place && home.floor === npc.floor);
    assert(fits, `${npc.label} (${npc.state}) is in ${npc.place} F${npc.floor}, which is none of its homes`);
  }
  const smoker = plan.cast.find((n) => n.state === 'blocked');
  assert(smoker.place === 'roof', `blocked went to ${smoker.place}`);
  const idlers = plan.cast.filter((n) => n.state === 'idle');
  const leisure = LEISURE.map((home) => home.place);
  assert(idlers.length > 0 && idlers.every((n) => leisure.includes(n.place)), `idle went to ${idlers.map((n) => n.place).join(',')}`);
});

check('nobody sits on a seat somebody else is already on', () => {
  const agents = ['working', 'working', 'working', 'working', 'deciding', 'deciding', 'planning', 'implementing', 'exploring', 'checking', 'idle', 'idle'];
  const snap = snapshotOf(agents.map((state, i) => ({ id: `a${i}`, label: `agent ${i}`, state })));
  const plan = planCast(snap, WORLD);
  const seats = plan.cast.map((npc) => `${npc.place}:${npc.floor}:${npc.x}:${npc.y}`);
  assert(new Set(seats).size === seats.length, 'two people share a spot');
  // and the order is the layouts', not the clock's: the same snapshot makes the same street
  const again = planCast(snap, WORLD);
  assert(JSON.stringify(plan.cast) === JSON.stringify(again.cast), 'the same snapshot made two different casts');
});

check('a full room makes people stand up rather than double a chair', () => {
  const agents = Array.from({ length: AGENTS.maxNpc }, (_, i) => ({ id: `a${i}`, label: `agent ${i}`, state: 'working' }));
  const plan = planCast(snapshotOf(agents), WORLD);
  // every seat kind counts — a desk chair, the sofa, a machine — and what is left over stands
  const standing = plan.cast.filter((n) => n.kind === 'stand').length;
  const seated = plan.cast.length - standing;
  assert(seated + standing === plan.cast.length, 'somebody is neither seated nor standing');
  assert(standing > 0, 'eight agents on the working floor all got a desk: the floor has three desks');
});

check('whoever is not on the ground floor is queued for the lift', () => {
  const plan = planCast(snapshotOf([
    { id: 'a', label: 'up', state: 'working' },
    { id: 'b', label: 'ground', state: 'idle' },
  ]), WORLD);
  assert(plan.lift.length === 1, `${plan.lift.length} people queued for the lift`);
  assert(plan.lift[0].id === 'a' && plan.lift[0].to === 3, `the queue says ${JSON.stringify(plan.lift[0])}`);
});
console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exitCode = 1;
