# Project memory

Readable snapshot of this project's Engram memory. Regenerate with:

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

Not committed: Obsidian's own `.obsidian/` state, the export bookkeeping file,
and the binary chunks that `engram sync` produces.
