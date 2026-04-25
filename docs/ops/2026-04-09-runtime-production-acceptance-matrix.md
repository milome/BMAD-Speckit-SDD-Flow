# Runtime Production Acceptance Matrix

## Purpose

This matrix captures the current production-readiness evidence for governance execution, dashboard observability, provider smoke, and training-ready SFT after the Batch A-E implementation work.

It is not a marketing table. It exists to answer one question:

Which claims are already backed by real evidence, and which claims are still blocked or unverified?

## Status Summary

| Area                     | Claim                                               | Status               | Evidence                                                  |
| ------------------------ | --------------------------------------------------- | -------------------- | --------------------------------------------------------- |
| Governance execution     | Real authoritative dispatch path exists             | Passed               | Batch A tests + consumer validation                       |
| Governance execution     | Fallback execution works                            | Passed               | Batch B fallback tests                                    |
| Governance observability | Dashboard / snapshot / MCP show execution state     | Passed               | Batch C tests                                             |
| Provider readiness       | `provider-smoke` CLI exists and works for stub path | Passed               | provider-smoke CLI tests                                  |
| SFT validation           | `sft-validate` emits threshold-level output         | Passed               | Batch E tests                                             |
| SFT pilot                | Production-like bundle run completed                | Passed with findings | Batch F pilot report                                      |
| Claude host              | Real Claude host AI session evidence exists         | Passed               | prior hook/session validation                             |
| Cursor host              | Real Cursor host AI session evidence exists         | Blocked / unverified | no usable Cursor AI CLI entrypoint in current environment |

## Detailed Rows

### 1. Governance Execution

#### 1.1 Real authoritative dispatch

- Status: `passed`
- Evidence:
  - [archived-packet-dispatch-real-adapter.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/tests/acceptance/archived-packet-dispatch-real-adapter.test.ts)
  - [validate-consumer-governance.ps1](/D:/Dev/BMAD-Speckit-SDD-Flow/scripts/validate-consumer-governance.ps1)
- Notes:
  - dispatch no longer depends only on placeholder accept semantics
  - consumer validation now verifies a real external launch wrapper path and a non-placeholder `externalRunId`

#### 1.2 Fallback execution

- Status: `passed`
- Evidence:
  - [archived-packet-dispatch-fallback.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/tests/acceptance/archived-packet-dispatch-fallback.test.ts)
- Notes:
  - authoritative reject/fail now has a tested failover path

### 2. Dashboard / Snapshot / MCP

#### 2.1 Execution-state truth

- Status: `passed`
- Evidence:
  - [dashboard-execution-state.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/tests/acceptance/dashboard-execution-state.test.ts)
  - [runtime-query.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/dashboard/__tests__/runtime-query.test.ts)
  - [dashboard-runtime-snapshot.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/__tests__/integration/dashboard-runtime-snapshot.test.ts)
- Notes:
  - snapshot, UI bundle, and runtime MCP now expose execution-state truth

### 3. Provider Readiness

#### 3.1 `provider-smoke`

- Status: `passed` for stub path
- Evidence:
  - [provider-smoke.js](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/src/commands/provider-smoke.js)
  - [provider-smoke.test.js](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/provider-smoke.test.js)
  - [provider-smoke-cli.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/tests/acceptance/provider-smoke-cli.test.ts)
- Notes:
  - stub path is covered
  - real remote provider smoke still depends on external credentials and endpoint availability

### 4. SFT Validation

#### 4.1 Training-grade threshold output

- Status: `passed`
- Evidence:
  - [validation-thresholds.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/__tests__/validation-thresholds.test.ts)
  - [sft-validate.test.js](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/sft-validate.test.js)
- Notes:
  - `sft-validate` now emits threshold metrics and failures, not just structural booleans

### 5. SFT Production-Like Pilot

#### 5.1 First pilot bundle

- Status: `passed with findings`
- Evidence:
  - [2026-04-09-sft-production-pilot-report.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/ops/2026-04-09-sft-production-pilot-report.md)
- Notes:
  - pilot bundle generation completed
  - training-grade validation still fails on current repo dataset because accepted ratio, training-ready ratio, and host coverage remain below threshold

#### 5.2 Fresh-data pilot after provenance write-path update

- Status: `passed`
- Evidence:
  - [batch-f-fresh-data](/D:/Dev/BMAD-Speckit-SDD-Flow/outputs/runtime/vibe-sessions/2026-04-09-governance-dashboard-sft-production/batch-f-fresh-data)
  - [2026-04-09-sft-production-pilot-report.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/ops/2026-04-09-sft-production-pilot-report.md)
- Notes:
  - the historical fresh-data rerun used the legacy lower-level `parse-and-write-score` path; under the current path, the equivalent post-audit write step is `runAuditorHost` driving the same scoring pipeline
  - this proves the new data generation path is viable even though the old historical repo dataset still fails

### 6. Real Host Acceptance

#### 6.1 Claude host AI session

- Status: `passed`
- Evidence:
  - real Claude host `PreToolUse` packet-block validation from prior work
- Notes:
  - this evidence exists outside this specific file set but has already been captured in repo work

#### 6.2 Cursor host AI session

- Status: `blocked / unverified`
- Evidence:
  - `cursor-agent` is not available in the current environment
  - `cursor.exe` exists only as the editor CLI, not a proven AI session CLI
- Impact:
  - full cross-host production signoff is not yet allowed
  - we can claim install/runtime governance readiness for Cursor consumer setup, but not full real Cursor AI host execution equivalence

## Blockers

### B1. No usable Cursor AI CLI entrypoint

- Current environment does not expose a `cursor-agent`-style command.
- Without that entrypoint, a true “real Cursor host AI session” acceptance row cannot be completed honestly.

### B2. Historical SFT records still lack complete provenance

- Current repo dataset still shows `host_kind_coverage = 0` and `provider_fact_coverage = 0` in the Batch F pilot validation output.
- This does not block bundle generation, but it blocks a clean training-ready signoff.

### B3. Full real Cursor AI host-session evidence still missing

- Cursor consumer install/runtime validation is available.
- Real Cursor AI session evidence is not yet available in this environment because no usable Cursor AI CLI entrypoint exists.

## Current allowed completion language

Allowed:

- Batch A / B / C implementation complete
- provider-smoke stub path complete
- training-grade validation output complete
- first production-like bundle pilot complete

Not allowed:

- “full cross-host production-ready”
- “Cursor and Claude have equivalent real-host evidence”
- “current repo dataset is training-ready”
