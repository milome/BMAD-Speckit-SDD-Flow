# Reverse Audit Gate

Use this gate before an implementation source document can be used for readiness or implementation. The gate consumes `confirmation-render-report.json` as the structured renderer authority, then adds reverse-audit-only checks for confirmation state, render freshness, anti-smoke evidence, report shape, and a bounded pre-render definition drilldown report.

The renderer owns structure and coverage blocking rules. Reverse audit must not maintain a second copy of renderer `blockingIssues` logic, but it must fail closed when the consumed render report is missing the minimum schema fields needed to trust that authority.

## Mandatory Verdict

The source document must include a `Reverse Audit Report` section with verdict `PASS` or `FAIL`.

- `PASS`: the render report is `confirmability=confirmable` with no `blockingIssues`, the report hashes match the current source document and current `implementationConfirmation`, `implementationConfirmation.status` is `user_confirmed`, reverse-audit-only checks pass, and deterministic definition drilldown has no unresolved blockers.
- `FAIL`: the render report is missing, stale, malformed, not confirmable, or contains renderer `blockingIssues`; the source is unconfirmed; reverse-audit-only checks fail; the optional grill/definition report has unresolved blocking findings; or readiness mode is requested while `deliveryReadiness.ready` is false.

Do not use the source document for implementation with a `FAIL` verdict. Do not use the source document for delivery/readiness claims unless either reverse audit was run with `--mode readiness` and passed, or another current delivery gate proves `deliveryReadiness.ready=true`.

## Audit Inputs

- Inline `implementationConfirmation`.
- `confirmation-render-report.json` and hashes.
- Optional grill/definition audit report.
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
2. Renderer authority:
   - Discover `confirmation-render-report.json` from `--render-report`, `--confirmation-dir`, `implementationConfirmation.confirmationRender.reportPath`, `dirname(htmlPath)`, or `_bmad-output/runtime/requirement-records/<recordId>/confirmation/confirmation-render-report.json`.
   - Verify `confirmability === "confirmable"`.
   - Verify `blockingIssues[]` is empty and preserve renderer issue codes unchanged when it is not.
   - Verify `sourceDocumentHash` and `implementationConfirmationHash` match the current source document.
   - Verify `confirmInstruction` contains `sourceDocumentHash`, `implementationConfirmationHash`, and `confirmationPageHash`.
   - Verify the render report includes the minimum integrity schema: hashes, `actualHtmlFileHash`, `generatedAt`, `deliveryReadiness`, `blockingIssues[]`, `warnings[]`, coverage objects, `confirmInstruction`, and `artifactRef`.
   - Report `deliveryReadiness` separately in implementation mode; require `deliveryReadiness.ready === true` only in readiness mode.
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
10. Definition drilldown:
   - Run `pre_render_definition_drilldown.js` before HTML render when authoring or updating the source document.
   - Check requirement semantic text against root, source-local, and `CONTEXT-MAP.md` referenced `CONTEXT.md` avoided terms without scanning report boilerplate as requirements.
   - Flag vague terms as warnings unless they prevent testability.
   - Flag unresolved evidence and trace command references as blockers.
   - Flag direct `MUST` versus `OUT` contradictions and linked `NEG`/failure-path contradictions as blockers.
   - Flag external side effects that lack timeout, failure, idempotency, recovery, or evidence assertion semantics as blockers.
   - Use `reverse_audit_contract.js --definition-only` only as a compatibility alias for the standalone pre-render drilldown gate.
   - Stop by convergence metadata, not by manually increasing drilldown rounds: stable `fingerprint`, `clusterId`, `--previous-report`, `--resolutions`, `--changed-only`, `--max-new-blockers`, and `--emit-decision-packet`.
   - Treat resolution ledger entries as suppressing only when status is `resolved`, `waived`, `converted_to_open_question`, or `converted_to_out_boundary` and the entry matches current source, implementationConfirmation, and context hashes.
   - Preserve total/new/suppressed/truncated blocker counts in `convergence` even when emitted blockers are limited.
   - Stop after deterministic checks and decision packet emission; do not run unbounded recursive questioning.
11. Optional grill report:
   - If `--grill-report` is supplied, fail only on findings where `severity` is `blocking` or `blocker` and `status` is not `resolved`.
   - Verify the report's `sourceDocumentHash` and `implementationConfirmationHash` match the current source document before trusting its result.
   - Treat warning-only grill findings as warnings in reverse audit output.

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

Supported explicit form:

```bash
node <skill-dir>/scripts/reverse_audit_contract.js \
  --source <source-document.md> \
  --render-report <confirmation-render-report.json> \
  --mode implementation \
  --json
```

Use `--mode readiness` only when the caller wants `deliveryReadiness.ready=true` to be a hard failure condition. Use `--grill-report <report.json>` to merge a separate grill/definition audit report.

Stage-specific CLI form:

```bash
node <skill-dir>/scripts/audit_contract_confirmability.js \
  --source <source-document.md> \
  --render-report <confirmation-render-report.json> \
  --json

node <skill-dir>/scripts/audit_implementation_readiness.js \
  --source <source-document.md> \
  --render-report <confirmation-render-report.json> \
  --json

node <skill-dir>/scripts/audit_delivery_verification.js \
  --source <source-document.md> \
  --render-report <confirmation-render-report.json> \
  --json

node <skill-dir>/scripts/audit_closeout_integrity.js \
  --source <source-document.md> \
  --render-report <confirmation-render-report.json> \
  --json
```

Stage-specific CLIs are the productized entry points. They share `reverse_audit_stage_common.js`, delegate core checks to `reverse_audit_contract.js`, force the appropriate stage mode, and add `stageAudit` metadata to JSON output. The compatibility wrapper may still return a generic `PASS` for contract confirmability; that verdict must not be reused as delivery verification or closeout proof.

Pre-render definition drilldown form:

Before this drilldown, large requirements should be routed by the scale assessment and semantic checkpoint runner:

```bash
node <skill-dir>/scripts/assess_contract_authoring_scale.js \
  --source <source-document.md> \
  --out <scale-assessment.json> \
  --json

node <skill-dir>/scripts/run_semantic_checkpoints.js \
  --source <source-document.md> \
  --assessment <scale-assessment.json> \
  --progress <semantic-checkpoint-progress.json> \
  --mode plan|status|run|resume \
  --until pre-render-ready \
  --json
```

When assessment returns `checkpoint_required`, every completed checkpoint must be protected by a single-file commit of the active requirements document before render.

```bash
node <skill-dir>/scripts/pre_render_definition_drilldown.js \
  --source <source-document.md> \
  --out <grill-definition-report.json> \
  --previous-report <previous-grill-definition-report.json> \
  --resolutions <grill-definition-resolutions.json> \
  --changed-only \
  --max-new-blockers 10 \
  --emit-decision-packet <grill-definition-decision-packet.json> \
  --json
```

Use the pre-render output as the deterministic automation equivalent of a grill-with-docs pass: it reviews only requirement semantic fields, emits blocker/warning findings with recommended answers, records source/implementation/context hashes, and can later be supplied back through `--grill-report`.

Convergence fields:

- `findings[].fingerprint`: stable finding identity across reruns.
- `findings[].clusterId`: blocker grouping key for one decision per theme.
- `convergence.newBlockingCount`: blockers that still require action after previous-report and resolution filtering.
- `convergence.suppressedPreviousCount`: unchanged previous findings hidden by `--changed-only`.
- `convergence.suppressedResolvedCount`: findings suppressed by a current-hash resolution ledger entry.
- `convergence.truncatedBlockingCount`: blockers not emitted because of `--max-new-blockers`.
- `convergence.stopReason`: explicit stop reason such as `no_new_blockers`, `blocking_definition_questions_found`, `warning_only`, or `no_blocking_definition_questions`.
- `definitionDrilldown.remainingBlockingClusters`: clustered unresolved blockers for decision review.
- Decision packet `recommendedActions`: `convert_to_open_question`, `add_out_boundary`, `split_requirement`, or `add_evidence_oracle`.

Compatibility form:

```bash
node <skill-dir>/scripts/reverse_audit_contract.js \
  --source <source-document.md> \
  --definition-only \
  --json
```

Use the script output as evidence, then fix any `failedChecks` before readiness or implementation.
