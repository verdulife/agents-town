---
id: 325
type: config
project: pixel-town
scope: project
topic_key: pixel-town/engram-import
session_id: 01a17786-0605-719b-961b-701d0377f1dc
created_at: "2026-10-26 10:10:12"
updated_at: "2026-10-26 10:10:12"
revision_count: 1
tags:
  - pixel-town
  - config
aliases:
  - "Import reproducible del vault Engram del proyecto (docs/memory/engram)"
---

# Import reproducible del vault Engram del proyecto (docs/memory/engram)

**What**: Añadido `tools/engram-import.mjs` + script npm `memory:import`, que convierte el vault markdown `docs/memory/engram/` al formato JSON de Engram y lo importa con `engram import`. Las dos observaciones del vault (264 architecture "pixel-town v2: contract, modules and verification" y 265 decision "pixel-town: agreed next steps") ya están en el store local como ids 323 y 324, proyecto `pixel-town`.
**Why**: `engram obsidian-export` es unidireccional; el repo traía la memoria como notas .md y el store local tenía 0 observaciones en `pixel-town`, así que la memoria no era consultable por `mem_search`/`engram search`.
**Where**: `tools/engram-import.mjs` (nuevo), `package.json` (script `memory:import`), `docs/memory/README.md` (sección "Restoring this memory into a store").
**Learned**:
- `engram import <file.json>` necesita el esquema del `engram export` (version 0.2.0: sessions[] + observations[] + prompts[]); no lee markdown.
- Import es idempotente por `sync_id`: la segunda ejecución reporta "skipped stale" en vez de duplicar. El vault no guarda `sync_id`, así que el script lo deriva con sha256(project + id) → estable entre máquinas y re-ejecuciones.
- `id` en el JSON es opcional: sin él el store asigna uno nuevo. Con un `id` ya ocupado NO sobrescribe: inserta con id nuevo (verificado en store desechable con ENGRAM_DATA_DIR).
- Los timestamps del vault se reinterpretan con la zona local: 00:40:18 (CEST) quedó como 00:40:18 en `mem_get_observation` pero `engram search` CLI mostró 01:40:18. Cosmético, sin efecto en orden.
- Engram CLI en 3.6.0 no tiene `obsidian-import`; el puente markdown→JSON hay que hacerlo a mano.

---
*Session*: [[session-01a17786-0605-719b-961b-701d0377f1dc]]
*Topic*: [[topic-pixel-town]]
