---
name: consumer-governance-validation
description: Historical / forensic validation skill for pre-hard-cut consumer governance flows. Use only when you need to inspect old worker-era evidence or migrate old consumer docs. It is no longer the accepted runtime validation path.
---

# Consumer Governance Validation

## Status

This skill is now **historical / archived**.

It records how consumer governance was validated before autonomous fallback and background-worker queue draining were hard cut from the accepted runtime path.

## Current Accepted Path

Do **not** use this skill as the default proof surface for current runtime success.

The accepted path is now:

1. Consumer users activate governance in the active host session with `$bmad-speckit`, `/bmad-speckit`, or `bmad-speckit`.
2. The main Agent internally resolves the active Requirement from explicit IDs or `_bmad-output/runtime/requirement-records/index.json`.
3. The main Agent reloads `_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json`.
4. The main Agent drives only the six mental model chain: requirement confirmation, architecture confirmation, implementation readiness, execution closure, audit review, and delivery confirmation.
5. Bounded child work, TaskReport evidence, audit evidence, gate checks, requirement closures, and closeout attempts are written through controlled ingest.
6. `bmad-help`, dashboard, score, SFT, hooks, and legacy reports are projections or evidence only; none of them is a control source.
7. CLI access to `main-agent-orchestration` is install validation, CI, debug, or no-skill fallback only.

## When To Read This Skill

Read this skill only when:

- you are forensically comparing current behavior against the old worker-era design
- you are cleaning legacy docs or migration notes
- you need to explain why worker/queue auto-drain is no longer the accepted runtime proof

## Do Not Use As Success Criteria

The following are no longer current success criteria:

- `background worker started`
- queue auto-draining from `pending` to `done`
- execution record auto-advancing to `running`
- `gate_passed` reached through autonomous fallback

## Read Next

- `docs/reference/main-agent-orchestration.md`
- `docs/ops/2026-04-25-main-agent-orchestration-live-smoke.md`
- `docs/ops/2026-04-25-speckit-workflow-main-agent-smoke.md`
- `tests/acceptance/fallback-autonomous-dispatch-mode.test.ts`
- `tests/acceptance/governance-runtime-worker.test.ts`
