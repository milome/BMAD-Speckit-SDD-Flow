# Reverse Audit Gate

Use this gate before an implementation source document can be used for readiness or implementation. It verifies that the inline `implementationConfirmation` block, mandatory HTML confirmation output, human-readable diagrams/steps, artifact automation plan, `traceRows`, E2E acceptance, and DoD form a closed source-document confirmation system.

## Mandatory Verdict

The source document must include a `Reverse Audit Report` section with verdict `PASS` or `FAIL`.

- `PASS`: `implementationConfirmation.status` is `user_confirmed`, mandatory HTML confirmation evidence matches the current source hash, every requirement-bearing diagram/step/artifact plan item references confirmation IDs, every trace row references existing IDs, and every covered behavior has a verification path.
- `FAIL`: the confirmation block is missing/unconfirmed, HTML confirmation evidence is missing or stale, reconfirmation is required but unresolved, blocking questions remain, a diagram/step introduces unconfirmed behavior, a trace row references missing IDs, or evidence is missing, untestable, or smoke-only.

Do not use the source document for implementation with a `FAIL` verdict.

## Audit Inputs

- Inline `implementationConfirmation`.
- HTML confirmation render report and hashes.
- Mermaid diagrams and business steps.
- Artifact and automation plan.
- `traceRows` and E2E acceptance evidence.
- Definition of Done.
- Completion Evidence Packet requirements.

## Required Checks

1. Confirmation block:
   - Verify `implementationConfirmation` exists.
   - Verify `status: user_confirmed` before implementation readiness.
   - Verify `contractAuthoringRequired: true`.
   - Verify no `openQuestions` item has `blocksImplementation: true`.
2. HTML confirmation:
   - Verify `confirmation.html`, `confirmation-summary.json`, and `confirmation-render-report.json` exist.
   - Verify the render report source hash matches the current source document.
   - Verify the confirmation phrase contains source and HTML hashes.
   - Verify there was no Markdown/chat fallback confirmation.
3. Reconfirmation:
   - If current hashes differ from previously confirmed hashes, verify `implementationConfirmation.status` is `reconfirm_required`.
   - Verify `reconfirmationRequest.required: true` exists with previous hashes, current hashes, diff summary, impacted IDs, and allowed user actions.
   - Verify the user is not instructed to hand-edit hashes, status, or `confirmationHistory`.
   - Verify only the authoring workflow or controlled ingest path is allowed to write `confirmationHistory[]`, current hashes, `confirmedAt`, `confirmedBy`, and `status: user_confirmed`.
4. ID reference coverage:
   - Verify every requirement-bearing Mermaid message, business step, state transition, and evidence statement references confirmation IDs.
   - Verify every `traceRows[].covers` ID exists in `must` or `notDone`.
   - Verify every `traceRows[].evidenceRefs` ID exists in `evidence`.
   - Verify every task is bound to `MUST`, `NEG`, `OUT`, `EVD`, or `TRACE`.
5. Branch, state, and invariant coverage:
   - Verify every `alt`, `else`, `opt`, `loop`, `par`, and `break` path references `must`, `notDone`, or blocking question IDs.
   - Verify every state transition references confirmation IDs.
   - Verify every invariant or "must not happen" behavior is represented by `notDone`.
6. Artifact and external call coverage:
   - Verify every write/delete/publish/status change has state/artifact assertions.
   - Verify every external command/service has timeout and failure behavior in `notDone` or blocking questions.
   - Verify every planned artifact, script, hook, report, dashboard, score, and SFT output appears in the artifact automation plan.
   - Verify read-model/evidence artifacts do not directly control workflow state.
7. Row quality:
   - Verify every evidence entry has a gate command or explicit manual proof, evidence expectation, and independent oracle where applicable.
8. E2E validity:
   - Reject E2E rows that only assert exit code, stdout success, HTTP 200, page render, or mock calls.
9. Gaps and testability:
   - Any ambiguity or missing test path must become an `openQuestions` item or `MISSING_TESTABILITY`.

## Required Report Shape

```markdown
## Reverse Audit Report

Verdict: PASS|FAIL
Mode: scripted|manual
Audit command:

### implementationConfirmation Findings

### HTML Confirmation Findings

### Reconfirmation Findings

### ID Reference Findings

### Diagram And Step Findings

### Artifact Automation Plan Findings

### traceRows Findings

### Row Quality Findings

### E2E Anti-Smoke Findings

### Open Findings
```

## Scripted Evidence

When the source document exists as a local file, run:

```bash
node <skill-dir>/scripts/reverse_audit_contract.js <source-document.md>
```

Use the script output as evidence, then fix any `failedChecks` before readiness or implementation.
