---
name: "bmad-speckit"
description: "Root governed runtime entry for BMAD-Speckit-SDD-Flow. Use $bmad-speckit, /bmad-speckit, or bmad-speckit to let this framework take project governance control."
---

# BMAD-Speckit Governed Runtime Entry

`$bmad-speckit`, `/bmad-speckit`, and `bmad-speckit` are equivalent host-neutral entry aliases.

Short aliases `$bmads`, `/bmads`, and `bmads` load this same entry.

## Authority

This entry means: BMAD-Speckit-SDD-Flow takes root governed runtime authority for the current request.

Do not treat this as upstream BMAD Method `/bmad`. Do not register `$bmad` as an alias unless a user explicitly enables an upstream-compatible alias outside this default install.

## Runtime Contract

1. Inspect the project skeleton and `_bmad-output/runtime/` state.
2. Resolve the active host: Codex uses no-hooks `cli_ingress`; Cursor and Claude may use hooks.
3. Use `main-agent-unified-ingress` to normalize host entry into the `main-agent-orchestration` control plane.
4. Derive the current five-layer position through `bmad-help` state-aware routing when the user asks what to do next.
5. For implementation work, issue bounded dispatch packets and require TaskReport ingest.
6. Run release/delivery gates before claiming completion. If real delivery truth evidence is missing, use partial language only.

## Recommended First Action

Run or emulate:

```text
main-agent-orchestration --action inspect --host <codex|cursor|claude>
```

Then continue through the main-agent run loop for the resolved current layer/stage.
