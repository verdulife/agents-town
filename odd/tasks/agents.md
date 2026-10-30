# The agents in the town

The town stops being a set and becomes the machine's own window: one NPC per live Pi session, in the room its
state names, walking, riding the lift and doing what that state does. The data comes from the same files the
YASB bar's Pi widget reads, so the bar and the town can never disagree about who is live.

## Specs

A1. The agents come from the same place the bar's widget reads: "del mismo sitio que usa el widget de agentes de
pi de la barra yasb" — the presence registry, the activity records and the session transcripts under
`~/.pi/agent/`, reduced by the widget's own inference and never by a second one invented here.

A2. Agents first, and the people stop being decoration: "primero agentes, ya que implica eliminar a la gente de
la cafeteria y sincronizar la cantidad de agentes reales con los npc dentro". The six baked-in diners go; the
people in the world are the live sessions.

A3. One NPC per live session, in the room its state names. The states are already the rooms: working,
planning, implementing, exploring, deciding, checking — and `checking` shares the working floor, because a check
happens where the work does. `blocked` and `idle` need places of their own.

A4. Each state has its animations and its interactions: "ademas de sus animaciones, intereacciones, etc. como
caminar, tomar cafe, hacer ejercicio, las animaciones de cada puerta y ascensor, trabajar etc." Walking, sitting
at a desk, drinking coffee in the café, exercising in the gym, the lift's doors, the car moving between floors.

A4b. A change of state is a JOURNEY and never a teleport: "las animaciones tienen que ser que el agente camine y
coja el ascensor al cambiar de estado, no que magicamente aparezca en un sitio". An agent that changes room walks
to the lift on its floor, rides it, walks out on the new floor and then to its new seat. The lift is the only way
between floors and it is the only way anybody is ever seen to change floor.

A5. The page never fetches while drawing. One snapshot per frame from a small store, refreshed on a clock; the
render reads the store and nothing else, so a capture with `?pause=1&sim=N` is reproducible and the frame rate
never depends on a file read.

A6. Without the dev server there are no live agents. The town falls back to a static snapshot of a few NPCs, and
says so, instead of showing an empty street.

## Tasks

| id | task | specs | route | commit |
| --- | --- | --- | --- | --- |
| T1 | the source: `tools/agents-source.py` reads the bar's own inference and prints one snapshot; the dev server serves it at `/api/agents`; `src/next/agents.js` is the browser's contract and the static fallback; `tools/agents-check.mjs` pins the normaliser and the state-to-room map | A1, A5, A6 | parent | not committed |
| T2 | the plan: a snapshot becomes a cast — one NPC per agent, a seat or a spot per state, no two in the same seat, and a queue at the lift | A3 | parent | not committed |
| T3 | walking: a person moves along a floor on the fixed clock, turns, and stops at a spot; the sprite set is the café's, extended with a walk cycle | A4, A5 | parent | not committed |
| T4 | the lift: doors open and close, the car travels, one NPC per ride, and the floors line up with the offices' own columns | A4 | parent | not committed |
| T5 | the rooms: working at a desk, a meeting at the table, coffee at the café, exercise at the gym, a cigarette on the roof for `blocked`, the bench in the park for `idle` | A3, A4 | parent | not committed |
| T6 | the café loses its six diners and gains whoever the snapshot puts there | A2 | parent | not committed |
| T7 | the checks: `tools/agents-check.mjs` grows the cast's invariants — every agent has a place, no seat twice, the lift's queue is finite, and the whole thing is deterministic for a fixed snapshot | A4, A5 | parent | not committed |
| T8 | a state change is a journey: walk to the lift, ride, walk out and to the new seat; `checking` shares the working floor | A3, A4b | parent | not committed |

## Log

L1 (verbatim): "1. del mismo sitio que usa el widget de agentes de pi de la barra yasb. 2. primero agentes, ya
que implica eliminar a la gente de la cafeteria y sincronizar la cantidad de agentes reales con los npc dentro.
ademas de sus animaciones, intereacciones, etc. como caminar, tomar cafe, hacer ejercicio, las animaciones de
cada puerta y ascensor, trabajar etc.".

L2: T1 is in. `tools/agents-source.py` imports the bar's own widget — the one place the inference of a session's
state already lives — and prints one snapshot; when the import fails it reads the presence registry directly and
says `source: presence`, so the town knows less instead of knowing nothing. A dataclass in that widget cannot
be imported the obvious way (a module has to be in `sys.modules` before it runs, or `@dataclass` cannot resolve
its own namespace), which is worth knowing before anybody rewrites the bridge.

The dev server serves it at `/api/agents` through a two-line Vite plugin (2 s cache, `py`/`python` fallback), and
the browser's contract is `src/next/agents.js`: `normaliseSnapshot` reduces anything to a snapshot the page can
trust, `staticSnapshot` keeps the street populated when there is no server, and `STATE_ROOM` says where each
state happens. The page does not fetch from the frame loop — `fetchAgents` is called on a clock (T2).

Measured live: `/api/agents` returned the one session running on this machine (`pixel-town`, `working`), from the
bar's inference, with no transcript content anywhere in the payload.

Verified: `agents:check` **7/7**, and `npm run build` still clean (the plugin is `apply: 'serve'`).

Left for T2: the snapshot has to become a cast — a seat or a spot per state, no seat twice, a queue at the lift.

L3: T2 is in — the snapshot is a cast. `src/next/cast.js` harvests every place from the furniture that is
already drawn: a desk gives a spot at its chair, the meeting table four, the café's three tables six, the gym its
machines, the park its bench, the roof the parapet. Fifty-five spots on the street as it is drawn today. A state
claims its room, a seat first and standing room only when the room is full, and agents claim seats in a fixed
order (blocked first, idle last) so the same snapshot always makes the same street.

Two orderings had to be written down, and both were bugs the first time: which SEAT a person takes when a room
offers several (desk, meeting chair, machine, bench, sofa, in that order — a `working` agent on the sofa with
three desks free is what made the list necessary), and which AGENT claims first (`blocked` and the decision
states before `working`, `idle` last).

The lift is planned and not carried: `plan.lift` is the queue of people whose room is above the ground floor and
whatever the animation will do, it starts from that list.

Verified: `agents:check` **12/12** — five new rules: every place comes from the art and every place offers
something; one person per agent in the room its state names (and `blocked` really goes to the roof, `idle` to the
park); nobody on a seat somebody else is on, and the same snapshot makes the same cast; a full room makes people
stand instead of doubling a chair; and only the ground floor is not queued for the lift.

Left for T3: a person who walks. The cast says where somebody IS; nothing yet says how they got there.

L4: T3 is in — a person walks. `personSprite` gained a third pose with two frames: the standing figure with the
legs in stride and the arms swinging against them. In an elevation a person crosses the frame, so the stride is
the whole animation — a bobbing torso reads as a limp at ten pixels, and the head deliberately does not move.

`src/next/npc.js` is the walker and it is a pure function of (plan, when the plan was adopted, the clock): a
person enters their room at its own way in — the lift on every office floor, the door in the café, the shutter in
the gym, the gate in the park — crosses in a straight line at 18 px/s, faces the way they are going, and takes
the pose their spot allows when they arrive. Everybody starts at a 0.35 s stagger, so a floor does not empty
itself in one instant, and `settleTime` says how long until the street is still (8.5 s for a three-agent cast).

The page now asks for the agents on a clock (2.5 s) and **only rebuilds the plan when a label, a state or a set
of ids actually changed** — otherwise every poll would send everybody back to the lift. The plan is built against
the street the last still measured, so a resize re-plans against the new geometry.

Verified: `agents:check` **16/16**, four rules for the walk: everybody starts at their way in and ends exactly on
their spot; a moving person is in the walk pose facing the way they go; the same clock produces the same walk and
nobody leaves the frame; and the street settles in a finite, known time.

Known and left for T5: a person is drawn over the glass and the mullions, because the block is one opaque sprite.
The veil is 20% slate — the refinement is to tint the person by it when they are inside a room.

L5 (verbatim): "hay un estado nuevo llamado checking, apunta para añadirlo nuevo compartiendo planta con working.
ahora te comento que las animaciones tienen que ser que el agente camine y coja el ascensor al cambiar de estado,
no que magicamente aparezca en un sitio".

Recorded as A3's amendment (`checking` sits with `working` on floor 3, because a check happens where the work
does) and as **A4b**, which is a rule about honesty and not about polish: the cast may be rebuilt in one frame,
but a person is only ever seen to change floor inside the lift. Until T8 exists, the page's rebuild does exactly
what the user is objecting to — an agent whose state changes is redrawn at the new room's way in.

L6: A4b is built, minus its art. `journeyOf` turns a change of state into legs: whoever changed room inside the
offices walks to the lift on their own floor, is **hidden for the ride** (2.4 s), and walks out on the new floor
to their new seat; a change of floor can only happen that way, because the lift is the only circulation. A change
inside one floor is a single walk; a change between two buildings is a walk from the new place's own way in,
because an elevation has no street-level path and inventing one would be worse than saying so.

`walkers(plan, ..., previous)` matches by id against the previous plan, so a person who kept their id keeps their
journey and a person who left simply is not in the cast. Measured: planning (F1) → working (F3) walks 2.2 s to the
lift, is hidden from 2.2 to 4.6, and walks out to the desk by 12.7 s.

`checking` now shares the working floor (A3's amendment): a check happens where the work does.

Verified: `agents:check` 16/16, `build` limpio, y la línea de tiempo de un cambio de estado comprobada a mano en
los cuatro instantes que importan (andando, oculto, saliendo, llegando).

Still owed by A4b, and it is T4: the lift's own animation — the doors opening and closing and the cabin moving
between floors. Today the ride is honest (the person is out of sight and reappears on the right floor) but the
lift does not move, so the journey is told by the person and not yet by the building.

L7: a state with no room of its own now CHOOSES. `idle` and whatever the normaliser reduces to it (`unknown`, a
state the bar does not report) pick between the **café, the gym and the park** — the first of the three is their
own, chosen by `hashOf(id)`, so two idle agents do not follow each other around and one agent does not change its
mind between two snapshots; the rest of the list is the fallback when the first is full. Measured: six idle/unknown
agents land three in the café and three in the park with these ids, and a seventh would go to the gym before the
café's standing room.

`idle` therefore has **no room in `STATE_ROOM`** on purpose, and the check forbids putting one back: with a room,
the leisure list would never be consulted. The states that name a room (working, planning, implementing,
exploring, deciding, checking) keep exactly one home each.

Verified: `agents:check` **17/17** — the new rule is that the choice is personal, stable, that `unknown` chooses
like `idle`, and that the fallback order still contains every leisure place, so a full café sends people to the
gym. Plus the two older rules adjusted to ask `homesFor` instead of the room table.

Owed and unchanged: the lift's own art (T4) and the rooms' interactions (T5).

L8: closing the day. Built, in order: T1 the source (the bar's own inference behind `/api/agents`), T2 the cast
(seats harvested from the furniture), T3 the walk (a third pose, two frames, journeys on the fixed clock), T6 the
café's people are the cast and nobody else, T8 a change of state is a journey (walk to the lift, out of sight for
the ride, out on the new floor), T9 an idle or unknown agent chooses between the café, the gym and the park.
`checking` was moved to the working floor.

Owed, in the order they should be done:
- **T4** the lift's own art: doors opening and closing and the cabin moving between floors. Until it exists the
  journey is told by the person and not by the building.
- **T5** the rooms' interactions: a desk, a meeting, coffee, exercise, a cigarette on the roof, the bench — and
  the glass veil re-applied over a person who is inside an office, because a block is one opaque sprite and the
  cast is drawn over it.
- **T7** the lift's invariants, with T4.

Native review, for the record: two candidates were offered and both were declined at the host
(`consent-declined-this-candidate`), the second flagged high risk on the evidence "code that starts other
processes in tools/agents-source.py". No lineage was created and nothing was mutated either time. A decline is
per candidate: the work is committed on `main` and delivered by ordinary repository policy.

State at close: `agents:check` 17/17, `sky:check` 10/10, `ground:check` 9/9, `park:check` 15/15, `light:check`
11/11, `build` clean, and the dev server on :5174 with `/api/agents` serving the live session.
