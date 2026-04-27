# Main Agent Capability Traceability Matrix

Date: 2026-04-27
Source: `docs/plans/TASKS_v1.md`

| Goal | Code Path | Verification |
| --- | --- | --- |
| Single orchestrator inspect/dispatch loop | `scripts/main-agent-orchestration.ts` | `tests/acceptance/main-agent-packet-lifecycle-e2e.test.ts` |
| Contract/index single source | `_bmad/_config/orchestration-governance.contract.yaml`, `_bmad-output/runtime/governance/user_story_mapping.json` | `npm run validate:single-source-whitelist`, `tests/acceptance/governance-single-source-of-truth.test.ts` |
| Rerun gate closure | `scripts/governance-execution-result-ingestor.ts`, `scripts/governance-packet-dispatch-worker.ts` | `npm run test:main-agent-rerun-gate-e2e-loop` |
| Release closeout authority | `scripts/main-agent-release-gate.ts` | `npm run main-agent:release-gate`, `tests/acceptance/main-agent-release-gate-contract.test.ts` |
| Quality and chaos hard gates | `scripts/main-agent-quality-gate.ts`, `scripts/main-agent-chaos-scenarios.ts` | `npm run main-agent:quality-gate`, `npm run test:main-agent-chaos` |
| Real PR topology closure | `scripts/main-agent-dual-host-pr-orchestrator.ts`, `scripts/parallel-mission-control.ts` | `tests/acceptance/main-agent-dual-host-pr-orchestration.test.ts`, `_bmad-output/runtime/pr/pr_topology.json` |
| Completion-intent sprint write | `scripts/sprint-status-authorized-update.ts`, `scripts/main-agent-delivery-truth-gate.ts` | `tests/acceptance/sprint-status-authorized-update.test.ts`, `tests/acceptance/sprint-status-unauthorized-write-deny.test.ts` |
| Codex no-hooks host branch | `scripts/orchestration-dispatch-contract.ts`, `scripts/main-agent-unified-ingress.ts`, `scripts/main-agent-codex-worker-adapter.ts` | `tests/acceptance/orchestration-dispatch-contract.test.ts`, `tests/acceptance/main-agent-unified-ingress-e2e.test.ts`, `tests/acceptance/main-agent-codex-worker-adapter-e2e.test.ts` |
| Long-run policy attached to run-loop | `scripts/long-run-runtime-policy.ts`, `scripts/main-agent-orchestration.ts` | `tests/acceptance/runtime-longrun-policy-contract.test.ts`, `tests/acceptance/main-agent-run-loop-e2e.test.ts` |
| Delivery truth completion language | `scripts/main-agent-delivery-truth-gate.ts` | `npm run main-agent:delivery-truth-gate`, `tests/acceptance/main-agent-delivery-truth-gate.test.ts` |
