---
id: 264
type: architecture
project: pixel-town
scope: project
topic_key: ""
session_id: manual-save-pixel-town
created_at: "2026-10-26 00:40:18"
updated_at: "2026-10-26 00:40:18"
revision_count: 1
tags:
  - pixel-town
  - architecture
aliases:
  - "pixel-town v2: contract, modules and verification"
---

# pixel-town v2: contract, modules and verification

**What**: Top-down town v2 beside the v1 diorama, on a measured proportion contract.
**Why**: Fixed-framing cyberpunk-cozy village that will later mirror real data (clock, weather for Olivella, gentle-shell agents). Proportions agreed before multiplying art.
**Where**: src/next/{scale,art-spec,walker,buildings,topdown-sprites,calibration}.js + calibration.html.
**Contract** (art-spec.js): tile 16 - NPC 10x21 - door 10x22 (doorFitsNpc) - facade 26 - window 8x9 - world 720x450 - safe rect 480x360 - logical height target 360.
**Scale** (scale.js): scale = max(1, floor(h/360), ceil(w/720), ceil(h/450)), crop instead of letterbox. 16:9@1080p = 40x22.5 tiles at 3x; 16:10@1440x900 = 45x28.1 at 2x. ?zoom= pins a scale; ?target= is a dud knob (the world height caps it).
**Buildings** (buildings.js): a spec, not a drawing - width 3-8 tiles, 1-3 storeys, roof style (gable/hip/shed/flat) + depth, wall/roof material, one segment row per storey (wall/window/shopfront/door/steps/garage/arch/balcony/sign/awning), roof props, per-seed wall details. 8 types: house, townhouse, shop, apartment, warehouse, garage, hotel, civic. variantFor(type, seed) is deterministic; ?gallery=1&page=N reviews 9 per page.
**Walker** (walker.js): grid movement, four directions, tile centres, blocked tiles, deterministic; ?sim=N&pause=1 for reproducible captures.
**How to verify**: npm run dev -> calibration.html; node tools/{smoke,scale-check,walker-check,buildings-check}.mjs (12/12, 12 resolutions, 7/7, 10/10).
**Lessons**: wide gable roofs need a long ridge (else a tent); hip must widen ridge->eave (else an hourglass); at 10px a character needs Painter.outlineSelective(); reference characters are 1:2.5 w:h (ours was 1:1.67 = the fat look); a removed type name once killed the page silently, STREET_TYPES + a test now catch it; painting is testable in Node with tools/canvas-stub.mjs.

---
*Session*: [[session-manual-save-pixel-town]]
