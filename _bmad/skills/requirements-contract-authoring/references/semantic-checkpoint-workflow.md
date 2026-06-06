# Requirements Contract Semantic Checkpoint Workflow

## Role In This Skill

This reference is part of `requirements-contract-authoring`. It is the normative workflow for large or high-risk confirmation-ready source authoring when one full-document pass is unsafe.

The historical source was `docs/design/2026-05-24-requirements-contract-semantic-checkpoint-workflow.md`. Keep this reference synchronized when checkpoint runner behavior changes. The design document may remain as project history, but this skill reference is the workflow authority used by the skill.

The executable companion is:

```bash
node <skill-dir>/scripts/run_semantic_checkpoints.js
```

Supported runner mode summary:

```text
--mode plan|status|run|resume
```

The script should automate the manual steps in this reference where possible. Automation must not remove the core safety property:

```text
one semantic checkpoint -> one bounded source-document edit -> validation -> forced single-file commit -> receipt with diff and hash
```

`run_semantic_checkpoints.js` is not the semantic authoring engine. It must not invent requirements, fill missing `implementationConfirmation` fields, append status-only checkpoint logs, or mutate the source document to manufacture a checkpoint diff. The source edit for each checkpoint must already exist from `authoring-repair`, pre-confirmation drilldown materialization, or an explicitly reviewed manual source edit before the runner records progress.

## Purpose

This workflow converts a large requirements source document into a confirmation-ready implementation source document without timing out, losing work, or mixing unrelated changes.

Use it for large governance documents, dense `implementationConfirmation` blocks, or any source where a complete `requirements-contract-authoring` pass is too large to finish safely in one edit.

This workflow is now a semantic-layer checkpoint workflow. It does not split thinking by document chapters. The pre-confirmation atomic decomposition loop performs the complex reasoning, and checkpoints persist its outputs safely.

## Non-Goals

- Do not generate the whole confirmation-ready source document in one pass when scale assessment returns `checkpoint_required`.
- Do not stream full document bodies back into chat.
- Do not stage unrelated files.
- Do not treat a checkpoint commit as final delivery readiness.
- Do not set `implementationConfirmation.status: user_confirmed` without explicit user confirmation and controlled ingest.
- Do not render confirmation HTML until the source document is structurally ready, pre-render blockers are resolved, and the user has selected the confirmation language.

## Checkpoint Sequence

Use these semantic checkpoints in order. A later checkpoint may refine earlier text, but it must not silently reduce already authored scope.

1. cp-00 semantic kernel
2. cp-01 must_decomposition_packet
3. cp-02 atomic decomposition loop convergence
4. cp-03 packet-to-source materialization
5. cp-04 ID freeze
6. cp-05 implementationConfirmation core
7. cp-06 EVD/TRACE/ACC/E2E/failure/edge/currentTarget/AI-TDD
8. cp-07 human-readable views
9. cp-08 pre-render global reconciliation

The checkpoint runner's `--until pre-render-ready` scope covers cp-00 through cp-08 and then stops before HTML render. For compatibility with older references, this is also the replacement for the historical statement: The checkpoint runner's `--until pre-render-ready` scope covers checkpoints 1-8. HTML render, user confirmation, confirmation ingest, readiness, delivery verification, and closeout remain separate skill modes.

Checkpoint does not perform segmented reasoning. Checkpointing is only persistence, recovery, single-file commit, and receipt strategy. The atomic decomposition loop is where the author and Critical Auditor resolve semantic gaps.

The checkpoint runner does not spawn subagents. Checkpoint mode does not review, audit, reason over semantic gaps, run three-perspective analysis, or perform Critical Auditor convergence. It persists only source edits that were already materialized by `authoring-repair`, pre-confirmation drilldown materialization, or an explicitly reviewed manual source edit.

For `plan`, `status`, `run`, and `resume`, the checkpoint runner must print a human-readable status page to `stderr` unless `--quiet` is set. That status page must lead with what is happening now, why the runner stopped or continues, the next safe action, and then machine fields. The human-readable page must not replace JSON `stdout`.

Checkpoint artifacts:

- cp-00 writes or validates `semantic-kernel.json`.
- cp-01 writes or validates `must_decomposition_packet.json`.
- cp-02 records Critical Auditor receipts until `consecutiveNoNewGapRounds: 3`.
- cp-03 materializes packet projections into the inline source.
- cp-04 freezes IDs after source materialization.
- cp-05 fills implementationConfirmation core and `applicability.*`.
- cp-06 materializes EVD/TRACE/ACC/E2E/failure/edge/currentTarget/AI-TDD projections.
- cp-07 renders human-readable ID-bound views.
- cp-08 runs packet/source reconciliation plus pre-render global reconciliation.

## Checkpoint Loop

Each checkpoint follows the same loop.

### 1. Before Editing

Run:

```powershell
git status --short
node <encoding-integrity-guardian-dir>/scripts/check-encoding-integrity.js
```

Record whether unrelated worktree changes exist. Unrelated changes must stay unstaged.

### 2. Edit Scope

Edit only the target requirements document for the current checkpoint unless the user explicitly approves related files.

For ignored requirement documents under `docs/requirements/`, expect to stage with `git add -f`.

This edit must be a real source-document authoring step. It may add or refine the checkpoint's semantic section, ID matrix rows, views, evidence, commands, or human-readable explanations. It must not degrade into writing only a status marker.

When automation is used, this source edit is produced before `run_semantic_checkpoints.js` records the checkpoint. If the corresponding source materialization does not exist, the runner must fail closed with a next action such as `run_authoring_repair_preserve_existing`; it must not append `Status: passed` or any other marker to create a diff.

### 3. After Editing

Run:

```powershell
node <encoding-integrity-guardian-dir>/scripts/check-encoding-integrity.js
git diff -- docs/requirements/<source-document>.md
git diff --stat -- docs/requirements/<source-document>.md
(Get-FileHash -Algorithm SHA256 docs/requirements/<source-document>.md).Hash
```

If the checkpoint modifies contract structure, also run the best available contract check for the current maturity level:

```powershell
node <skill-dir>/scripts/reverse_audit_contract.js docs/requirements/<source-document>.md
```

For early draft checkpoints, a reverse audit `FAIL` is acceptable only when the failure is expected, such as missing user confirmation or missing HTML render. Unexpected structural failures must be repaired before committing.

### 4. Stage One File

Run:

```powershell
git add -f -- docs/requirements/<source-document>.md
git diff --cached --name-status
```

The staged set must contain only the target source document. Stop if any unrelated path appears.

### 5. Commit

Use a concise Chinese commit message:

```powershell
git commit -m "docs(requirements): 补充<checkpoint名称>"
```

Then record:

```powershell
git rev-parse HEAD
git show --stat --oneline HEAD
```

### 6. Receipt

After every checkpoint, report this receipt:

```text
Checkpoint: <name>
Commit: <commitHash>
Document SHA256: <sha256>
Diff: +<added> -<removed>
Validation: encoding findings=0; reverse audit=<PASS|EXPECTED_FAIL|NOT_RUN>
Next: <next checkpoint>
```

The receipt is the human-readable progress ledger. Git is the authoritative diff ledger.

## Automation Contract

The skill should prefer script automation over manual repetition:

```bash
node <skill-dir>/scripts/assess_contract_authoring_scale.js \
  --source <source-document.md> \
  --phase initial_assessment \
  --out _bmad-output/runtime/requirement-records/<recordId>/authoring/scale-assessment-initial.json \
  --json

node <skill-dir>/scripts/run_semantic_checkpoints.js \
  --source <source-document.md> \
  --route-decision _bmad-output/runtime/requirement-records/<recordId>/authoring/scale-routing-decision.json \
  --progress _bmad-output/runtime/requirement-records/<recordId>/authoring/semantic-checkpoint-progress.json \
  --mode run \
  --until pre-render-ready \
  --json
```

Required automation behavior:

- Scale assessment is staged. `initial_assessment` runs before semantic artifact generation and may only produce provisional single-pass routing. `post_packet_assessment` runs after `semantic-kernel.json` and synchronized `must_decomposition_packet.json` exist. `post_materialization_assessment` runs after packet projections are materialized into inline `implementationConfirmation` and before pre-render readiness.
- `initial_assessment` is a pre-write gate for every source-document write in `author-confirmation-ready-source`. A safe-write helper, large-document replacement helper, manual rewrite, direct `apply_patch`, Node `fs.writeFileSync`, or other write path must not start until a current `scale-assessment-initial.json` exists and the active session has emitted the visible `initial_assessment` trace to `stderr`. Missing artifact or missing visible trace must return `pre_write_scale_assessment_required` before any source mutation.
- The authoring lane must write `scale-routing-decision.json`. The route decision is monotonic: a checkpoint decision cannot be downgraded by a later single-pass phase. `single_pass_final_allowed` requires all three assessments, current hashes, and packet/source reconciliation `pass`.
- Scale assessment must be visible in the active session. When `assess_contract_authoring_scale.js` starts, it must print a human-readable trace to `stderr` that includes start, source/progress paths, collected signals, score breakdown, hard-trigger breakdown, and final decision. `stdout` must remain JSON-only so existing `--json` machine callers can parse it. `--quiet` is allowed only for explicitly silent machine calls.
- `run_semantic_checkpoints.js` must print the same visible scale-assessment trace when it computes an assessment implicitly. If `--assessment <scale-assessment.json>` is supplied, it must consume that artifact instead of re-running and re-printing assessment.
- When `--route-decision <scale-routing-decision.json>` is supplied, `run_semantic_checkpoints.js` must verify that the decision is `checkpoint_required` or `checkpoint_required_with_amendment`, verify `routeDecisionHash`, return checkpoint persistence evidence JSON, and leave `scale-routing-decision.json` unchanged.
- `checkpoint-persistence` mode is evidence-only. It verifies cp-00 through cp-08 progress, current document hash, pre-render MUST decomposition gate `PASS`, pre-render global consistency gate `PASS`, packet/source reconciliation `pass`, and the route decision hash. It never emits `single_pass_final_allowed`.
- The authoring lane may rerun `assess_contract_authoring_scale.js --checkpoint-persistence-evidence <checkpoint-persistence-evidence.json>` after validating same-run output and current disk hashes. Only that rerun may write the final `single_pass_final_allowed` route decision.
- `plan` and `status` are read-only.
- `plan` and `status` must show semantic kernel status, packet status, Critical Auditor rounds, convergence counter, packet/source reconciliation, and next action.
- `run` without `--checkpoint` starts at the first incomplete checkpoint and continues until `pre-render-ready`.
- `resume` starts from the progress record's next checkpoint when the current document hash matches the progress record.
- `resume` must reload semantic kernel, must_decomposition_packet, Critical Auditor receipts, packet/source reconciliation, and checkpoint progress instead of restarting.
- Explicit `--checkpoint` records only that checkpoint after controlled manual repair or upstream source materialization has already changed the active source document.
- Every completed checkpoint creates a separate single-file commit.
- A checkpoint commit must contain a real source materialization diff. If the target document has no staged or stageable source edit for the checkpoint, the runner must fail closed before commit.
- The runner must stop before commit if staged paths contain anything other than the active target requirements document.
- The runner must not silently overwrite manual edits when the current document hash differs from the latest progress record.
- The runner must fail closed when source hash and progress hash mismatch.
- The runner must fail closed when current-hash upstream authoring evidence is missing. Required evidence includes the semantic kernel, synchronized must decomposition packet, required Critical Auditor receipts, and pre-render drilldown gate artifacts as applicable to the checkpoint.
- Progress corruption may be recovered from a backup or Git checkpoint only when the current source hash is safe to trust.
- The runner must write progress and receipts sufficient for resume and user review.
- The runner must preserve checkpoint authoring semantics: each checkpoint is a bounded document edit, not merely a progress status update.
- Completing all eight pre-render checkpoints is necessary but not sufficient for `pre_render_ready`.
- Before returning `pre_render_ready` or allowing HTML render, the runner must execute the pre-render MUST decomposition gate and the whole-document global consistency gate.
- The pre-render MUST decomposition gate is:

```bash
node <skill-dir>/scripts/pre_render_must_decomposition_gate.js \
  --source <source-document.md> \
  --authoring-dir _bmad-output/runtime/requirement-records/<recordId>/authoring \
  --json
```

- It must output `must_decomposition_receipt.json`, `must_packet_source_reconciliation_report.json`, and `pre-render-must-decomposition-gate-report.json`.
- It must block on missing semantic kernel, missing must_decomposition_packet, stale packet hash, missing Critical Auditor receipt, fewer than three no-new-gap rounds, unresolved validated gap, incomplete question coverage, under-split MUST, over-broad atomic task, missing packet projection, source row independently invented, packet projection not materialized, missing packet/source reconciliation, or stale gate hashes.
- The global consistency gate must fail closed when `implementationConfirmation` cannot be parsed, any required core array is missing, any ID is duplicated, any `MUST` or `NEG` lacks reciprocal `traceRows` coverage, any `traceRows[]` item references missing evidence, any evidence or trace command reference is undefined, any failure/edge/view reference is unresolved, or deterministic definition drilldown still has blockers.
- The gate must write `_bmad-output/runtime/requirement-records/<recordId>/authoring/pre-render-global-consistency-report.json` or the progress-local equivalent, update progress validation as `globalConsistency: pass|fail`, and block HTML render on any finding.
- The explicit command for this hard gate is:

```bash
node <skill-dir>/scripts/run_semantic_checkpoints.js \
  --source <source-document.md> \
  --progress _bmad-output/runtime/requirement-records/<recordId>/authoring/semantic-checkpoint-progress.json \
  --mode pre-render-gate \
  --json
```

This gate exists because checkpoint splitting removes the implicit whole-document pass that a single generation step used to provide. A checkpoint log, checkpoint count, or trace row count must never be accepted as equivalent to global trace/evidence consistency.

## Efficient Streaming Policy

Use chat streaming for progress and evidence, not for full document content.

Each working update should include only:

- current checkpoint name
- section range being edited
- validation command result
- commit hash
- document SHA256
- next checkpoint

Do not paste full YAML blocks, full Mermaid diagrams, or full document sections unless the user explicitly asks. The file on disk and Git commits are the source of truth.

## Resume Rules

To resume after interruption:

1. Run `git log --oneline -- docs/requirements/<source-document>.md`.
2. Read the latest checkpoint receipt, if available.
3. Run `git show --stat --oneline HEAD -- docs/requirements/<source-document>.md`.
4. Compute current document SHA256.
5. Continue from the next checkpoint.

If the file differs from the last recorded SHA256, inspect the diff before editing:

```powershell
git diff -- docs/requirements/<source-document>.md
```

Do not overwrite uncommitted user edits. If the diff conflicts with the next checkpoint, ask before proceeding.

## Final Index Cleanup

The checkpoint commits intentionally force-add ignored requirement documents to protect work from accidental deletion. At final cleanup, if the project wants the generated requirements document removed from Git index but retained locally, run:

```powershell
git rm --cached -- docs/requirements/<source-document>.md
git commit -m "chore(requirements): 移出临时需求文档索引"
```

Only do this after the user confirms the final retention strategy.
