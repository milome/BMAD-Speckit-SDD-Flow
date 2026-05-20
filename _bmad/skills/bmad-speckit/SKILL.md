---
name: bmad-speckit
description: Root governed runtime entry for BMAD-Speckit-SDD-Flow. Use $bmad-speckit, /bmad-speckit, or bmad-speckit to let this framework take project governance control.
---

# BMAD-Speckit Governed Runtime Entry

`$bmad-speckit`, `/bmad-speckit`, and `bmad-speckit` are equivalent host-neutral entry aliases.

Short aliases `$bmads`, `/bmads`, and `bmads` load this same entry.

## User Activation

The normal consumer-project activation path is the user typing one of these aliases in the active AI host session:

```text
$bmad-speckit
/bmad-speckit
bmad-speckit
```

Do not ask the consumer user to run `npm run main-agent-orchestration` or `npx bmad-speckit main-agent-orchestration ...` as the default activation path.

CLI commands are allowed only for install validation, CI, debug, or a no-skill fallback host.

## Authority

This entry means: BMAD-Speckit-SDD-Flow takes root governed runtime authority for the current request.

Do not treat this as upstream BMAD Method `/bmad`. Do not register `$bmad` as an alias unless a user explicitly enables an upstream-compatible alias outside this default install.

## Runtime Contract

1. Inspect the project skeleton and `_bmad-output/runtime/` state.
2. Resolve the active host: Codex, Cursor, Claude, or another supported host.
3. Normalize the host entry into the `main-agent-orchestration` control plane through `main-agent-unified-ingress` or the installed equivalent runtime controller.
4. Resolve the active requirement from explicit `recordId` / `requirementSetId` / `runId`, or from `_bmad-output/runtime/requirement-records/index.json`.
5. Reload `_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json` before any global branch decision.
6. Drive the flow from `currentMentalModel` and the six user-facing mental models:
   `requirement_confirmation`, `architecture_confirmation`, `implementation_readiness`, `execution_closure`, `audit_review`, `delivery_confirmation`.
7. Treat `bmad-help` as BMAD workflow routing projection and read model only. It may explain BMAD recommended next steps, but it must not replace `requirement-record.json`, `currentMentalModel`, or controlled gate evidence.
8. For implementation work, issue bounded dispatch packets and require controlled TaskReport / evidence ingest.
9. Before claiming completion, require Delivery Closeout Gate evidence for the current closeout attempt. Quality, release, score, dashboard, SFT, hooks, and old reports are evidence or projections only.

## Agent Internal First Action

After user activation, the main Agent must internally run or emulate:

```text
main-agent-orchestration --action inspect --host <codex|cursor|claude>
```

This is an internal control action, not a consumer-user command. Use the installed local runtime controller when available. Use `npx` only as validation, CI, debug, or no-skill fallback.

## Continue Automation Entry

For users who want BMAD-Speckit to continue from existing BMAD artifacts into remaining governed stages, keep the user-facing entry as `$bmad-speckit`.

Do not route through `bmads-auto`. `bmads-auto` is quarantined as a deprecated implementation surface and may only be mined for ideas that are reimplemented under Main Agent authority.

Required internal Main Agent path:

1. Inspect the current control surface.
2. If the current control record allows dispatch and no usable packet exists, materialize a bounded dispatch plan.
3. Continue through the main-agent run loop for the active requirement.
4. Re-read inspect after every child result, host closeout, rerun, or blocking event before deciding the next global branch.
5. Treat `mainAgentNextAction`, `mainAgentReady`, and old handoff summaries as compatibility hints only.
6. Require controlled ingest for TaskReport, execution evidence, audit evidence, gate checks, requirement closures, and closeout attempts.

Expected current-stage behavior:

- If requirement confirmation is missing, stale, or hash-mismatched, route to requirements contract authoring and confirmation before implementation.
- If architecture confirmation is required or stale, block implementation until active requirement-scoped architecture confirmation exists.
- If implementation readiness is stale or missing, block implementation dispatch until the controlled readiness gate passes.
- If execution, audit, or delivery evidence is incomplete, continue through `execution_closure`, `audit_review`, and `delivery_confirmation` without downgrading the six-model chain.
