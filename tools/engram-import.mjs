#!/usr/bin/env node
// Import this project's committed memory into the local Engram store.
//
// Source of truth for the notes is the markdown vault in docs/memory/engram
// (produced by `engram obsidian-export`). Engram cannot read that vault back,
// so this script converts it into Engram's JSON import format and hands it to
// `engram import`, which is idempotent through each observation's sync_id.
//
// Usage:
//   node tools/engram-import.mjs                 # convert + import
//   node tools/engram-import.mjs --out file.json # convert only
//   node tools/engram-import.mjs --dry-run       # convert + report, no import

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VAULT = "docs/memory/engram";
const SESSIONS_DIR = "_sessions";

function parseArgs(argv) {
  const args = { out: null, dryRun: false, vault: VAULT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") args.out = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--vault") args.vault = argv[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

/** Minimal frontmatter reader: scalars only, which is all the vault uses. */
function parseNote(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) throw new Error("note has no frontmatter");
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("note has unterminated frontmatter");
  const head = text.slice(4, end);
  const body = text.slice(end + 5);

  const meta = {};
  for (const line of head.split("\n")) {
    if (!line || /^\s/.test(line)) continue; // list items carry no scalar we need
    const at = line.indexOf(":");
    if (at === -1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    meta[key] = value;
  }
  return { meta, body };
}

/** Splits the note body into its title and the memory text itself. */
function splitBody(body) {
  const lines = body.split("\n");
  let titleAt = lines.findIndex((line) => line.startsWith("# "));
  if (titleAt === -1) return { title: null, content: lines.join("\n").trim() };
  const title = lines[titleAt].slice(2).trim();
  let content = lines.slice(titleAt + 1).join("\n").trim();
  // Drop the export's trailing backlink to the session hub.
  const sessionLink = content.lastIndexOf("\n---\n\n*Session*:");
  if (sessionLink !== -1) content = content.slice(0, sessionLink).trim();
  return { title, content };
}

function walkNotes(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === SESSIONS_DIR) continue;
      found.push(...walkNotes(path));
    } else if (entry.name.endsWith(".md")) {
      found.push(path);
    }
  }
  return found;
}

// The vault does not carry Engram's sync_id, so derive one from the source
// observation identity: stable across re-runs and across machines.
function stableSyncId(project, id) {
  return `obs-${createHash("sha256").update(`${project}\u0000${id}`).digest("hex").slice(0, 16)}`;
}

function buildExport(vault) {
  const notes = walkNotes(vault).sort();
  const observations = [];
  const sessions = new Map();

  for (const note of notes) {
    const { meta, body } = parseNote(readFileSync(note, "utf8"));
    if (!meta.id || !meta.project) continue; // not an observation
    const { title, content } = splitBody(body);
    if (!title || !content) throw new Error(`${note}: missing title or content`);

    const id = Number(meta.id);
    observations.push({
      sync_id: stableSyncId(meta.project, meta.id),
      session_id: meta.session_id || null,
      type: meta.type || "discovery",
      title,
      content,
      project: meta.project,
      scope: meta.scope || "project",
      topic_key: meta.topic_key || "",
      revision_count: Number(meta.revision_count || 1),
      created_at: meta.created_at,
      updated_at: meta.updated_at || meta.created_at,
    });

    if (meta.session_id && !sessions.has(meta.session_id)) {
      sessions.set(meta.session_id, {
        id: meta.session_id,
        project: meta.project,
        ownership_mode: "project_owned",
        started_at: meta.created_at,
      });
    }
  }

  observations.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    version: "0.2.0",
    exported_at: new Date().toISOString(),
    sessions: [...sessions.values()],
    observations,
    prompts: [],
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!statSync(args.vault).isDirectory()) throw new Error(`vault not found: ${args.vault}`);

  const payload = buildExport(args.vault);
  if (payload.observations.length === 0) throw new Error(`no observations found in ${args.vault}`);
  const text = `${JSON.stringify(payload, null, 2)}\n`;

  if (args.out) {
    writeFileSync(args.out, text);
    console.log(`Wrote ${args.out}`);
    console.log(`  Sessions:     ${payload.sessions.length}`);
    console.log(`  Observations: ${payload.observations.length}`);
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), "engram-import-"));
  const file = join(dir, "engram-export.json");
  try {
    writeFileSync(file, text);
    if (args.dryRun) {
      console.log(`Dry run: ${payload.observations.length} observations ready`);
      for (const obs of payload.observations) console.log(`  [${obs.project}] ${obs.title}`);
      return;
    }
    const result = execFileSync("engram", ["import", file], { encoding: "utf8" });
    process.stdout.write(result);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`engram-import: ${error.message}`);
  process.exit(1);
}
