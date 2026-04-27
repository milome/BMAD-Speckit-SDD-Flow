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
