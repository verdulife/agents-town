---
id: 325
type: config
project: pixel-town
scope: project
topic_key: pixel-town/engram-import
session_id: 01a17786-0605-719b-961b-701d0377f1dc
created_at: "2026-10-26 10:10:12"
updated_at: "2026-10-26 13:11:41"
revision_count: 2
tags:
  - pixel-town
  - config
aliases:
  - "Import del vault Engram: clave por contenido y limpieza de backlinks del export"
---

# Import del vault Engram: clave por contenido y limpieza de backlinks del export

**What**: `tools/engram-import.mjs` publica el vault `docs/memory/engram` en el store local. Versión final: la clave de idempotencia es el **contenido** (type + title + content), no el `id` de la nota; si el store ya tiene esa observación se reutiliza **su** `sync_id`, y si no se deriva del contenido. El bloque de backlinks del export (`---` + `*Session*:` / `*Topic*:`) se elimina con una regex, no con un match exacto. Script npm: `memory:import`; opciones `--out` y `--dry-run`.
**Why**: `engram obsidian-export` es unidireccional; el repo necesitaba una forma de rehidratar la memoria en un store nuevo sin duplicar.
**Where**: `tools/engram-import.mjs`, `docs/memory/README.md`, `package.json` (script), `docs/memory/engram/**` (proyección publicada).
**Learned** (dos defectos reales encontrados y corregidos):
1. **Derivar `sync_id` del `id` de la nota NO funciona**: al importar el vault en otro store los ids cambian (264/265 → 323/324), así que la clave no coincidía y el reimport duplicó seis observaciones (hubo que borrarlas con `engram delete <id> --hard`). Clave correcta: contenido.
2. **El formato del bloque de backlinks cambia entre versiones**: el vault viejo traía `---` + línea en blanco + `*Session*:`; el actual trae `---` seguido de `*Session*:` y `*Topic*:` sin línea en blanco. Un match exacto dejaba los wikilinks dentro del texto importado (contenido 51-95 caracteres más largo que en el store). Regex: `/\n+---\n(?:\s*\*[A-Za-z]+\*:[^\n]*\n?)+$/`.
3. Verificación de round-trip útil: exportar el store y comparar por `type|title` que el contenido es byte-idéntico al que extrae el script; y ejecutar el import dos veces esperando `0 imported, 6 skipped stale`.
4. `engram import` con un `id` ocupado no sobrescribe: inserta con id nuevo (comportamiento verificado en un store desechable con `ENGRAM_DATA_DIR`).
5. Al publicar el vault tras importar, el export deja **notas duplicadas** con los ids viejos (los ficheros `...-264.md` siguen ahí porque ese id ya no existe en el store): hay que borrarlas a mano antes de commitear.

---
*Session*: [[session-01a17786-0605-719b-961b-701d0377f1dc]]
*Topic*: [[topic-pixel-town]]
