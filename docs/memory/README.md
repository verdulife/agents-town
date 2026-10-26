# Project memory

Readable snapshot of this project's Engram memory:

```bash
engram obsidian-export --vault docs/memory --project pixel-town
```

Each note is one observation: the frontmatter carries its id, type, project,
scope and timestamps, and the body is the memory itself. Edit memory through
Engram, not here: the next export overwrites these files.

Why it lives in the repo: the local SQLite store is the source of truth, and this
folder is the durable, reviewable projection of it. `.engram/config.json` is what
makes sessions started in this directory file their memory under `pixel-town`
instead of the parent directory's project.

## Restoring this memory into a store

`obsidian-export` is one-way, so memory is rebuilt from the vault through
Engram's JSON import format:

```bash
npm run memory:import            # convert the vault and import it
node tools/engram-import.mjs --dry-run   # what would be imported
node tools/engram-import.mjs --out /tmp/pixel-town.json  # convert only
```

The script keys every observation on its **content**, not on the note id: when
the store already holds an observation with the same type, title and text it
reuses that observation's `sync_id`, and otherwise derives one from the content.
That makes the import a true no-op on a store that already has this memory —
Engram reports `skipped stale` — even after the note ids changed, which they do
every time the vault is imported into a different store. It also strips the
export's trailing `*Session*:` / `*Topic*:` backlinks, so they are never baked
into the memory itself.

It imports only what the vault holds: a note edited in Engram after the last
export will not carry those edits.

Not committed: Obsidian's own `.obsidian/` state, the export bookkeeping file,
and the binary chunks that `engram sync` produces.
