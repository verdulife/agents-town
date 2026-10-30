// The live agents, as the page sees them (A1, A5, A6).
//
// The browser cannot read `~/.pi`, so the dev server asks `tools/agents-source.py` — which asks the YASB bar's
// own widget, so the town and the bar cannot disagree — and serves one snapshot at `/api/agents`. This module
// is the contract between the two: it validates and reduces whatever arrives, and it knows the one thing the
// rest of the code needs from it, which is where each state happens.
//
// Nothing here fetches. `fetchAgents()` is the page's only door to the network and the page calls it on a clock,
// never from the frame loop: a frame reads `store.snapshot`, so a capture is reproducible and the frame rate
// never depends on a file read (A5).

export const AGENTS = {
  schema: 'pixel-town.agents/v1',
  endpoint: '/api/agents',
  pollMs: 2500, // how often the page asks; the bar itself heartbeats every 5 s
  maxNpc: 8, // more agents than this and the street is a crowd, not a scene
  // The states the town can put somebody in. `blocked` and `idle` are states the bar already reports and they
  // are not rooms of the offices: one goes to the roof to smoke, the other to the bench in the park.
  states: ['working', 'planning', 'implementing', 'exploring', 'checking', 'deciding', 'blocked', 'idle'],
};

// Where each state happens. The offices are the building whose rooms are named after the phases, so the mapping
// is a lookup and not a translation: `planning` is the planning room on floor 1, `working` the open plan on
// floor 3. `blocked` and `idle` belong to the street, and that is what makes them read.
export const STATE_ROOM = {
  working: { place: 'offices', floor: 3, room: 0 },
  planning: { place: 'offices', floor: 1, room: 0 },
  implementing: { place: 'offices', floor: 1, room: 1 },
  exploring: { place: 'offices', floor: 2, room: 0 },
  deciding: { place: 'offices', floor: 2, room: 1 },
  // `checking` shares the working floor: a check happens where the work does (L5)
  checking: { place: 'offices', floor: 3, room: 0 },
  blocked: { place: 'roof', floor: 3, room: 0 },
  idle: { place: 'park', floor: 0, room: 0 },
};

const LABEL_MAX = 22;

// A snapshot the page can trust. Anything missing, unknown or over-long is reduced instead of rejected: a town
// that stops drawing because one field is odd is worse than a town with one boring NPC.
export function normaliseSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.agents)) {
    return { schema: AGENTS.schema, source: 'none', live: 0, agents: [], stale: true };
  }
  const seen = new Set();
  const agents = [];
  for (const entry of raw.agents) {
    if (!entry || typeof entry !== 'object') continue;
    const id = String(entry.id ?? '').slice(0, 24);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const state = AGENTS.states.includes(entry.state) ? entry.state : 'idle';
    agents.push({
      id,
      label: String(entry.label ?? 'pi').slice(0, LABEL_MAX) || 'pi',
      state,
      phase: AGENTS.states.includes(entry.phase) ? entry.phase : null,
      child: entry.child ? String(entry.child).slice(0, LABEL_MAX) : null,
      heartbeat: Number.isFinite(entry.heartbeat) ? entry.heartbeat : 0,
    });
    if (agents.length >= AGENTS.maxNpc) break;
  }
  return {
    schema: AGENTS.schema,
    source: typeof raw.source === 'string' ? raw.source : 'unknown',
    live: agents.length,
    agents,
    stale: false,
  };
}

// The town keeps working without a dev server (A6): three NPCs on states the street can hold, so the scene is
// never empty and never pretends to know something it does not.
export function staticSnapshot() {
  return normaliseSnapshot({
    schema: AGENTS.schema,
    source: 'static',
    agents: [
      { id: 'static-working', label: 'pixel-town', state: 'working', heartbeat: 0 },
      { id: 'static-exploring', label: 'olivella', state: 'exploring', heartbeat: 0 },
      { id: 'static-idle', label: 'gentle-ai', state: 'idle', heartbeat: 0 },
    ],
  });
}

// The page's only door to the network. It never throws: a failed read is a stale snapshot, not a broken frame.
export async function fetchAgents(fetcher = fetch) {
  try {
    const res = await fetcher(AGENTS.endpoint, { headers: { accept: 'application/json' } });
    if (!res.ok) return { ...staticSnapshot(), source: 'none', stale: true };
    return normaliseSnapshot(await res.json());
  } catch {
    return { ...staticSnapshot(), source: 'none', stale: true };
  }
}
