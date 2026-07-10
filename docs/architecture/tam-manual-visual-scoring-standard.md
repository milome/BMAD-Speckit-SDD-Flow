# TAM Manual Visual Scoring Standard

Purpose: establish a human visual gate for TAM/FMC architecture diagrams before any
new redraw is accepted. Machine gates are necessary, but not sufficient: they can
prove VSDX package integrity, Visio openability, TAM master usage, label geometry,
and connector geometry; they cannot prove that the rendered diagram looks like a
successful TAM architecture model.

## Calibrated Sample Anchors

Use these local successful samples as the visual baseline:

| Anchor | File | Baseline lesson |
|---|---|---|
| S1 | `docs/architecture/tam-reference-study/understandable-slide-008.png` | Online-shop overview: actors, one dominant system area, bottom business-data band, right-side providers, short local channels. |
| S2 | `docs/architecture/tam-reference-study/modeling-slide-046.png` | First-contact overview: compact graph plus side explanation; the graph introduces main components and terms, not every detail. |
| S3 | `docs/architecture/tam-reference-study/modeling-slide-047.png` | Refinement view: more detail is allowed only when the surrounding environment and layout remain stable from the overview. |
| S4 | `docs/architecture/tam-reference-study/understandable-slide-026.png` | Grouping and shading are used to reduce access arcs/channels and untangle the diagram. |
| S5 | `docs/architecture/tam-reference-study/visualizing-slide-020.png` | Multi-domain overview: large domains connect through a few ports, not through a dense wiring harness. |
| S6 | `docs/architecture/tam-reference-study/modeling-slide-023.png` | TAM semantics: channels connect agents; access arcs connect agents and storages; channels are passive communication locations, not long cables. |

## Manual Review Workflow

1. Render the candidate from the primary Visio/TAM `.vsdx` to PNG or SVG.
2. Run the two-second test at fit-to-window zoom.
3. Inspect the silhouette at roughly 33% zoom.
4. Inspect the image at 100% zoom for TAM semantics, label attachment, storage
   access, boundary meaning, and obvious editability artifacts.
5. Score independently from machine audit results. Script `pass=true` cannot
   override a human hard fail.
6. Record the result in `diagram-generation-receipt.json` under
   `manualVisualScoring`.

The two-second test passes only if a new reader can identify all of these without
following wires:

| Item | Required read |
|---|---|
| Users | Who or what uses the system. |
| System/runtime boundary | Where the modeled system starts and ends. |
| Runtime core | The main services/containers that execute the system. |
| Data plane | The primary storages and evidence/data locations. |
| External systems | Third-party services or host/platform dependencies. |
| Trust/network boundaries | The boundary crossings that matter to this overview. |

## Hard Fail Conditions

Any hard fail blocks acceptance. Do not average it away with a numeric score.

| ID | Hard fail | Required rework |
|---|---|---|
| HF1 | The diagram reads as a wiring harness, circuit board, network topology, rail map, or router trace. | Rework model abstraction and layout archetype; do not only reroute lines. |
| HF2 | Understanding depends on following wires across the page. | Reduce relationships, use semantic grouping, and introduce a clear data band. |
| HF3 | The two-second test fails for users, boundary, runtime core, data plane, external systems, or trust boundaries. | Rebuild as a first-contact overview using S1/S2/S5. |
| HF4 | Long page-spanning rails carry primary application semantics. | Shorten/aggregate flows or move detail to refinement views. |
| HF5 | Protocol-boundary masters or dashed markers are used as decorative group/trust frames. | Use shaded backplanes for groups and reserve protocol markers for actual protocol crossings. |
| HF6 | Storage access is visually unsafe: connectors cross storage labels/glyphs, stores are detached from agents, or stores look generic. | Reposition stores into a data band and use short access arcs. |
| HF7 | The overview is an inventory dump of scripts, files, validators, receipts, or package internals. | Aggregate into semantic containers and move inventory detail to component/security views. |
| HF8 | Labels are clipped, unreadable, detached from relations, or colliding with zone/boundary labels. | Rework labels and spacing; do not shrink fonts below readable size. |
| HF9 | The candidate cannot be mapped to one named TAM overview archetype before rendering. | Pick and record an archetype, then redraw from it. |
| HF10 | Machine audit passes while visible PNG defects remain unrecorded. | Log the defect and tighten the audit before acceptance. |

## 100-Point Scorecard

For `System Architecture Overview`, acceptance requires 90/100 or higher, no hard
fails, and every category floor passing.

| Category | Points | Floor | Full-credit criteria |
|---|---:|---:|---|
| TAM/FMC semantic correctness | 15 | 13 | Active agents, passive storages, channels, and access arcs follow TAM semantics; relationships are not flattened into generic arrows. |
| First-glance architecture readability | 15 | 13 | The two-second test passes; title, boundary, users, runtime core, data plane, and external systems are obvious without tracing routes. |
| Overview archetype fit | 12 | 10 | The diagram visibly follows one recorded archetype from `tam-visual-patterns.md`; overview density matches S1/S2/S5, not S3 detail density. |
| Boundary, grouping, and shading discipline | 12 | 10 | One dominant boundary and a few explanatory backplanes reduce complexity; boundaries are not duplicated labels or floating dashes. |
| Channel/access quality and anti-wiring | 14 | 12 | Relations are short, attached, labeled near the relation, and avoid rails, corridor stacks, and unrelated zone crossings. |
| Visual hierarchy and label economy | 10 | 8 | Primary containers dominate, secondary labels are subordinate, text is readable, color has one meaning, and side notes carry prose. |
| Data-plane/store quality | 8 | 6 | Storages form a clear band or cluster; access arcs are short and semantic; store labels describe business meaning. |
| External/environment integration | 6 | 5 | Actors and third parties sit around the system and connect through a few clear ports without becoming disconnected islands. |
| Visio/TAM authenticity and editability | 5 | 5 | The VSDX uses real TAM masters for content and remains editable; generic shapes are limited to allowed labels/backplanes. |
| Professional presentation | 3 | 2 | Title, legend/notation, source note, margins, and visual balance look deliberate and review-ready. |

## Decision Bands

| Total | Decision | Required action |
|---:|---|---|
| 95-100 | Accept | Candidate may proceed if machine gates also pass. |
| 90-94 | Accept with scrutiny | Accept only if no category is near its floor and all visible risks are recorded. |
| 80-89 | Rework | Fix weakest categories and rescore. Do not claim final acceptance. |
| 70-79 | Restart layout | Keep model facts, but restart from archetype and abstraction level. |
| 0-69 | Reject | The diagram is not TAM/FMC-quality. Rebuild from samples. |

## Rework Rules

- For HF1, HF2, HF3, HF4, HF7, or any score below 80, rework the model
  abstraction before coordinate tuning.
- Prefer grouping, shading, semantic aggregation, and data bands over adding
  connectors.
- Do not fix overcrowding by enlarging the canvas, shrinking fonts, hiding labels,
  removing required facts without moving them to another view, or replacing TAM
  masters with generic boxes.
- If an overview needs more than 12 content nodes or 16 edges to be truthful, the
  overview is scoped incorrectly; split detail into refinement views.
- If three local reroutes do not remove wiring-harness appearance, stop rerouting
  and choose a different overview archetype.

## Required Receipt Fields

Every accepted candidate must include this object in `diagram-generation-receipt.json`:

```json
{
  "manualVisualScoring": {
    "standard": "tam-manual-visual-scoring-standard",
    "standardVersion": "2026-06-23",
    "scoredArtifact": "docs/architecture/system-architecture-overview.png",
    "sampleAnchorsUsed": ["S1", "S2", "S4", "S5", "S6"],
    "twoSecondTest": {
      "users": "PASS|FAIL",
      "systemBoundary": "PASS|FAIL",
      "runtimeCore": "PASS|FAIL",
      "dataPlane": "PASS|FAIL",
      "externalSystems": "PASS|FAIL",
      "trustBoundaries": "PASS|FAIL"
    },
    "hardFails": [],
    "categoryScores": {
      "tamSemantics": 0,
      "firstGlanceReadability": 0,
      "archetypeFit": 0,
      "boundaryGrouping": 0,
      "channelAccessAntiWiring": 0,
      "visualHierarchyLabels": 0,
      "dataPlaneStores": 0,
      "externalEnvironment": 0,
      "visioTamAuthenticity": 0,
      "professionalPresentation": 0
    },
    "totalScore": 0,
    "categoryFloorsPass": false,
    "decision": "ACCEPT|ACCEPT_WITH_SCRUTINY|REWORK|RESTART_LAYOUT|REJECT",
    "defectsLogged": [],
    "scorerNotes": ""
  }
}
```

## Current Candidate Sanity Check

`docs/architecture/system-architecture-overview.final-candidate.png` is not a
positive example. Under this standard it hard-fails on HF1/HF2/HF4/HF5 risk
because the dominant reading is still routed rails/wiring rather than a compact
TAM/FMC block diagram.
