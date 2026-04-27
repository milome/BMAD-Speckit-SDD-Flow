# Host Parity Regression Matrix

Date: 2026-04-27
Source: `docs/plans/TASKS_v1.md` T1.1

| Host Mode | Ingress | Expected Control Plane | Verification |
| --- | --- | --- | --- |
| Cursor | hook ingress | `inspect -> dispatch-plan -> packet lifecycle -> complete` | `tests/acceptance/main-agent-host-parity-e2e.test.ts` |
| Claude | hook ingress | Same orchestration state and packet semantics as Cursor | `tests/acceptance/e2e-dual-host-journey-runner.test.ts` |
| no-hooks | CLI ingress | Same inspect surface and continue semantics without hook-only truth | `npm run main-agent-orchestration -- --cwd . --action inspect` |

Failure classification:

- host bug: host adapter cannot produce the canonical inspect surface.
- orchestration drift: host-specific path changes `nextAction`, `pendingPacketStatus`, or gate semantics.
- flaky: retry passes without code/config change and no state artifact drift is observed.
