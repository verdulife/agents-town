#!/usr/bin/env python3
"""Bridge between the town and the live Pi agents on this machine.

The town's page cannot read `~/.pi`: the browser is sandboxed and the agents live in files. So the dev
server asks this script, and this script asks the SAME source the YASB bar uses — `~/.config/yasb/pi_agents.py`
— so the town and the bar can never disagree about who is live or what each one is doing.

    py tools/agents-source.py            one JSON snapshot on stdout
    py tools/agents-source.py --now=...  the same at a fixed instant (tests, captures)

The snapshot is deliberately small and stable: the bar's own `Session` list, reduced to the fields the town
needs, plus `source` so the page can say where it came from. Nothing but the label — a project name — is ever
exported: no transcript content, no prompts, no paths.

If the widget cannot be imported (a fresh machine, no yasb, a broken config) the script falls back to reading
the presence registry directly with no phase inference: a session is then `working` when its counts say it has
something to do and `idle` when they do not. The town keeps working; it just knows less.
"""

from __future__ import annotations

import argparse
import glob
import importlib.util
import json
import os
import sys
import time
from pathlib import Path

WIDGET = Path(os.path.expanduser("~")) / ".config" / "yasb" / "pi_agents.py"
PRESENCE = Path(os.path.expanduser("~")) / ".pi" / "agent" / "gentle-agents" / "presence"
SESSIONS = Path(os.path.expanduser("~")) / ".pi" / "agent" / "sessions"

# What the town can draw. The bar's states already are the rooms of the offices, which is the whole point of
# the scene, so this list is the intersection of the two and not a translation table.
TOWN_STATES = {"working", "planning", "implementing", "exploring", "checking", "deciding", "blocked", "idle"}

SCHEMA = "pixel-town.agents/v1"


def load_widget():
    if not WIDGET.exists():
        return None
    try:
        spec = importlib.util.spec_from_file_location("pi_agents", WIDGET)
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        # a module has to exist in sys.modules BEFORE it runs, or the widget's dataclasses cannot resolve
        # their own namespace (`AttributeError: 'NoneType' object has no attribute '__dict__'`)
        sys.modules["pi_agents"] = module
        spec.loader.exec_module(module)
        return module
    except Exception:  # noqa: BLE001 - a broken widget must not break the town
        return None


def state_of(state: str | None) -> str:
    return state if state in TOWN_STATES else "idle"


def from_widget(widget, now_ms: int) -> list[dict]:
    sessions = widget.collect_sessions(str(PRESENCE), str(SESSIONS), now_ms)
    out = []
    for session in sessions:
        out.append(
            {
                "id": session.session_hash[:12],
                "label": session.label,
                "state": state_of(session.state),
                "phase": session.phase if session.phase in TOWN_STATES else None,
                "child": session.child,
                "heartbeat": session.heartbeat,
            }
        )
    return out


def from_presence(now_ms: int) -> list[dict]:
    """The fallback: the presence registry, no transcript, no phase."""
    out = []
    for path in sorted(glob.glob(str(PRESENCE / "*.header.json"))):
        try:
            header = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(header, dict) or header.get("schema") != 1:
            continue
        heartbeat = header.get("heartbeat")
        if not isinstance(heartbeat, (int, float)) or now_ms - heartbeat > 15_000:
            continue
        counts = header.get("counts") or {}
        busy = any(int(counts.get(key) or 0) > 0 for key in ("running", "queued", "waiting"))
        out.append(
            {
                "id": str(header.get("sessionHash", ""))[:12],
                "label": str(header.get("label") or "pi"),
                "state": "working" if busy else "idle",
                "phase": None,
                "child": None,
                "heartbeat": int(heartbeat),
            }
        )
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Live Pi agents for the pixel town")
    parser.add_argument("--now", type=int, help="current time in ms (tests, captures)")
    args = parser.parse_args(argv)
    now_ms = args.now if args.now is not None else int(time.time() * 1000)

    widget = load_widget()
    try:
        if widget is not None:
            agents, source = from_widget(widget, now_ms), "widget"
        else:
            agents, source = from_presence(now_ms), "presence"
    except Exception:  # noqa: BLE001 - the fallback is the whole point of this branch
        agents, source = from_presence(now_ms), "presence"

    agents.sort(key=lambda a: (a["state"], a["label"], a["id"]))
    print(
        json.dumps(
            {
                "schema": SCHEMA,
                "source": source,
                "generated": now_ms,
                "live": len(agents),
                "agents": agents,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
