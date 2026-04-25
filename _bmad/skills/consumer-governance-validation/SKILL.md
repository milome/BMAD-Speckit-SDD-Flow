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

1. hook writes `orchestration_state` and `pending_packet`
2. main Agent runs `npm run main-agent-orchestration -- --cwd {project-root} --action inspect`
3. main Agent runs `dispatch-plan` when packet materialization is needed
4. main Agent dispatches bounded child work
5. main Agent re-reads state and decides the next step
6. `runAuditorHost` remains post-audit close-out only
7. `fallbackAutonomousMode=false`

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
