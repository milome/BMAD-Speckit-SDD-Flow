---
name: bmad-speckit
description: Root governed runtime entry for BMAD-Speckit-SDD-Flow. Use $bmad-speckit, /bmad-speckit, or bmad-speckit to let this framework take project governance control.
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

## Continue Automation Entry

For users who want BMAD-Speckit to continue from existing BMAD artifacts into the remaining governed stages, use the Main Agent control plane directly.

Do not route through `bmads-auto`. `bmads-auto` is quarantined as a deprecated implementation surface and may only be mined for ideas that are reimplemented under Main Agent authority.

Required Main Agent path:

1. Run `main-agent-orchestration --action inspect --host <codex|cursor|claude>`.
2. If `mainAgentReady=true` and `mainAgentNextAction` is dispatchable, run `main-agent-orchestration --action dispatch-plan --host <codex|cursor|claude>`.
3. Continue with `main-agent-orchestration --action run-loop --host <codex|cursor|claude>`.
4. Require TaskReport ingest through the Main Agent control plane.
5. Run `main-agent:release-gate`.
6. Run `main-agent:delivery-truth-gate`.
7. Only the authorized sprint-status path may write terminal completion.

Expected current-stage behavior:

- If product brief / PRD / architecture / epics evidence is incomplete, route to the matching BMAD Method workflow.
- If layer 3 story evidence is incomplete, route to `bmad-bmm-create-epics-and-stories`, `bmad-bmm-check-implementation-readiness`, `bmad-bmm-sprint-planning`, then `bmad-bmm-create-story`.
- If implementation-readiness is stale or missing, block `bmad-story-assistant` and any implementation dispatch.
- If readiness is fresh and ready, allow the story lifecycle path and then Speckit layer 4 dispatch.
