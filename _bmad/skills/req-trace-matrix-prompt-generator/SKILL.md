---
name: req-trace-matrix-prompt-generator
description: Generate strict execution prompts and synchronized model_packet/human_prompt/audit_receipt artifacts only from implementation source documents that contain an inline implementationConfirmation block with status=user_confirmed. Use when converting confirmed PRD/BUGFIX/TASKS source documents and traceRows into implementation prompts for Codex, Cursor, Claude, or generic branches. Block conversation-only requirements, ordinary prose, unconfirmed confirmation blocks, standalone contracts, invalid trace references, sidecars, amendments, MVP downgrades, stubs, mock-only coverage, scope reduction, or changed requirement intent.
---

# Req Trace Matrix Prompt Generator

## Overview

Generate an execution prompt only from an implementation source document:

```text
implementation source document = human-readable context + machine-readable implementationConfirmation block
```

The source document's inline `implementationConfirmation` block is the only authority. Do not generate implementation prompts from conversation-only requirements, ordinary PRD prose, standalone requirements contracts, diagrams without confirmation IDs, sidecar files, or amendments.

## Trace Closure Authority

`implementationConfirmation.traceRows` is the confirmed contract projection for execution order and source coverage. It is not the runtime PASS write target.

Generated prompts must keep runtime closure in the controlled requirement record or equivalent control store:

- Runtime PASS/MISSING_EVIDENCE/open state must be recorded through `requirement-record` evidence fields such as `executionIterations`, `requirementClosures`, `gateChecks`, `contractChecks`, `deliveryEvidence.requiredCommands`, `artifactIndex`, or project-equivalent governed fields.
- The executor must not rewrite confirmed source `traceRows[].status`, source evidence references, or source hash material to represent runtime completion.
- If implementation requires changing `must`, `notDone`, `mustNot`, `evidence`, or `traceRows` semantics, the prompt must require `reconfirm_required` and stop.
- Source document mutation is allowed only when the source schema explicitly declares a separate non-semantic bookkeeping field. Default behavior is no source traceRows mutation.

## Required Workflow

1. Identify the implementation source document path.
2. Read the source document.
3. Locate `implementationConfirmation`.
4. Require `status: user_confirmed`.
5. Require `--requirement-record <path>` and verify the latest `confirmationHistory[]` event is `confirmation_recorded`.
6. Recompute the current semantic `sourceDocumentHash` and semantic `implementationConfirmationHash`.
7. Require latest `confirmationHistory[]` hashes and top-level requirement record hashes to match the current source document.
8. Require no `openQuestions` item with `blocksImplementation: true`.
9. Validate that every `traceRows[].covers` entry references existing `must` or `notDone` IDs.
10. Reject every `OUT-*` / `mustNot` ID in `traceRows[].covers`; boundary IDs belong in `boundaryViewRefs[]` or `boundaryRefs[]` that point to `boundaryViews[].covers`.
11. Allow a boundary-only trace row to render `covers: (none)` when it has `boundaryViewRefs[]` / `boundaryRefs[]`, `evidenceRefs[]`, `taskRefs[]`, and command refs; PASS still requires evidence for the referenced evidence IDs and governed boundary proof.
12. Validate that every `traceRows[].evidenceRefs` entry references existing `evidence` IDs.
13. Validate that trace rows do not introduce new requirement semantics.
14. Preserve `traceRows` order exactly.
15. Build the required command registry from `requiredCommands[]`.
16. Require every `traceRows[].contractValidationCommandRefs[]`, `traceRows[].deliveryEvidenceCommandRefs[]`, and `closeoutReadinessPreview.requiredCommands[]` entry to resolve to `requiredCommands[]`.
17. Treat `suggestedCommands[]` as smoke/diagnostic only; never let suggested commands satisfy trace closure or final acceptance.
18. Generate implementation prompt using only confirmation IDs, trace IDs, evidence IDs, task references, command IDs, and controlled runtime closure instructions.
19. If validation fails, output a BLOCK response, not an implementation prompt.

## Script Usage

## Path And Agent Branch Portability

Treat `<skill-dir>` as the directory that contains this `SKILL.md` after installation. Do not replace it with `_bmad/skills/...`, `.codex/skills/...`, `.cursor/skills/...`, `.claude/skills/...`, a home-directory path, or a machine-specific drive path in skill instructions, generated templates, or script examples.

Resolve bundled scripts from `<skill-dir>/scripts/...`. Resolve consumer project inputs and outputs from the current project working directory or explicit CLI paths such as `--source-document`, `--requirement-record`, and `--out-dir`.

Use `--execution-host codex|claude-code|cursor-ide|cursor-cli|generic` when compiling packet artifacts with `--out-dir`.

Compatibility aliases are accepted:

- `claude` resolves to `claude-code`.
- `cursor` resolves to `cursor-ide`.

- `codex` may emit `/goal` only when the caller passes `--goal-command-available true` and the confirmed host hints allow goal mode; otherwise it emits `continue nonstop`.
- `claude-code` may emit Claude Code `/goal` only when `--goal-command-available true` and confirmed host hints allow goal mode; otherwise it emits an autonomous prompt contract.
- Native `/goal` output must be an audited document-reference entry pointer, not a short natural-language task objective.
- When native `/goal` is available in `--out-dir` mode, the generator always writes `goal_execution.md` and emits a `/goal` command that references `goal_execution.md` and `model_packet.json`.
- The `/goal` document-reference command is length-governed against a hard 4000-character limit and a 3800-character safe limit. If it exceeds the hard limit, generation blocks.
- If native `/goal` is requested outside `--out-dir`, generation blocks because `goal_execution.md` and `model_packet.json` cannot be written and referenced.
- `cursor-ide` is the default Cursor surface. It emits a Cursor IDE Agent mode prompt and must not emit `cursor-agent -p` as the primary instruction.
- `cursor-cli` is the headless automation surface. It may emit `cursor-agent -p --force --output-format stream-json <prompt>` plus an external supervisor loop contract.
- `generic` emits a platform-neutral continue-until-final-gates directive.
- Host execution hints are not delivery or closeout proof.

Prefer the bundled Node/js-yaml generator for local source documents:

```bash
node <skill-dir>/scripts/generate_prompt.js \
  --source-document docs/prd.md \
  --requirement-record _bmad-output/runtime/requirement-records/<recordId>/requirement-record.json
```

Compile synchronized packet artifacts when the confirmed source includes AI-TDD and pre-confirmation drilldown projections:

```bash
node <skill-dir>/scripts/generate_prompt.js \
  --source-document docs/prd.md \
  --requirement-record _bmad-output/runtime/requirement-records/<recordId>/requirement-record.json \
  --out-dir _bmad-output/runtime/requirement-records/<recordId>/trace-execution \
  --execution-host codex \
  --prompt-language auto \
  --human-prompt-profile full \
  --json
```

The legacy Python path is kept only as a backward-compatible launcher. It delegates to the Node/js-yaml implementation and must not parse YAML itself:

```bash
python <skill-dir>/scripts/generate_prompt.py \
  --source-document docs/prd.md \
  --requirement-record _bmad-output/runtime/requirement-records/<recordId>/requirement-record.json
```

Compatibility aliases:

- `--contract <path>` is accepted as a deprecated alias for `--source-document`.
- `--source-file <path>` is rejected unless the file itself contains a confirmed inline `implementationConfirmation`; conversation-like plans are blocked.

Useful options:

- `--final-gate "npm run test:e2e"` to append a final gate supplied outside the source document.
- `--extra-rule "..."` to append a hard priority rule from the user.
- `--source-label "..."` to override the displayed source.
- `--out-dir <path>` to compile `model_packet.json`, `human_prompt.txt`, `audit_receipt.json`, and, when needed, `goal_execution.md`.
- `--execution-host codex|claude-code|claude|cursor-ide|cursor-cli|cursor|generic` to select host-specific continuation projection.
- `--prompt-language zh-CN|en-US|bilingual|auto` to select human prompt prose language. `auto` reads `implementationConfirmation.promptLanguage`, then `implementationConfirmation.confirmationLanguage`, then falls back to `zh-CN`.
- `--human-prompt-profile full|compact` to select human prompt density. `full` is the default for `--out-dir`.
- `--goal-command-available true|false|auto` to declare whether the active host supports a native `/goal` command. `auto` is conservative and does not emit `/goal`. When true, the generated `/goal` command must reference `goal_execution.md` and `model_packet.json`; it requires `--out-dir` and is length-checked.
- `--no-auto-commit` only when the user explicitly says not to auto-commit after PASS.

If the script emits a `BLOCK:` marker, do not hide it and do not produce an implementation prompt.

## BLOCK Cases

Use explicit blocker messages:

```text
BLOCK: SOURCE_DOCUMENT_REQUIRED
Need a PRD / BUGFIX / TASKS implementation source document with inline implementationConfirmation.
```

```text
BLOCK: CONFIRMATION_REQUIRED
implementationConfirmation.status is not user_confirmed.
```

```text
BLOCK: CONFIRMATION_RECORD_REQUIRED
--requirement-record is required; source status alone is not sufficient authority.
```

```text
BLOCK: CONFIRMATION_RECORD_HASH_MISMATCH
Latest confirmationHistory[] hash does not match current source document.
```

```text
BLOCK: BLOCKING_QUESTIONS
implementationConfirmation.openQuestions contains blocksImplementation=true.
```

```text
BLOCK: TRACE_REFERENCE_INVALID
traceRows reference missing must/notDone/evidence IDs, or put mustNot boundary IDs in traceRows[].covers.
```

```text
BLOCK: TRACE_RESTATES_REQUIREMENTS
traceRows contain new requirement semantics instead of references only.
```

```text
BLOCK: COMMAND_REFERENCE_INVALID
implementationConfirmation command references are missing from requiredCommands[].
```

```text
BLOCK: COMMAND_DEFINITION_INVALID
implementationConfirmation requiredCommands[] entries must include runnable command text.
```

```text
BLOCK: FINAL_GATES_REQUIRED
Final gate commands must be derived from implementationConfirmation.requiredCommands, closeoutReadinessPreview.requiredCommands, evidence, or --final-gate before PASS.
```

```text
BLOCK: SESSION_INPUT_NEEDS_SOURCE_DOCUMENT
Conversation-only requirements must first be written into an implementation source document with implementationConfirmation.status=draft and then explicitly confirmed by the user.
```

```text
BLOCK: GOAL_DOCUMENT_REQUIRED
Native /goal requires --out-dir so goal_execution.md and model_packet.json can be written and referenced.
```

```text
BLOCK: GOAL_COMMAND_TOO_LONG
The generated /goal document-reference command still exceeds the hard length limit.
```

## Goal Length Governance

When `--goal-command-available true` is used for `codex` or `claude-code`, apply this decision order:

1. Require `--out-dir` so `goal_execution.md` and `model_packet.json` can be written and referenced.
2. Build the complete `/goal <payload>` command as a document-reference command that points to `goal_execution.md` and `model_packet.json`.
3. Record `goalCommand.mode=native_goal_document_ref` for every native `/goal` output, even when the host hint's short objective would fit under 3800 characters.
4. If the document-reference `/goal` command exceeds 4000 characters, block with `GOAL_COMMAND_TOO_LONG`.
5. If no `--out-dir` is available for native `/goal`, block with `GOAL_DOCUMENT_REQUIRED`; do not emit a short goal-only objective.

`goal_execution.md` is not execution authority. It is a `/goal`-safe execution entry document. It must reference `model_packet.json`, `human_prompt.txt`, and `audit_receipt.json`, and it must state that `model_packet.json` remains the machine-readable execution authority. `human_prompt.txt` must state that the `/goal` command is an entry pointer only, not the full task scope, and that execution scope is `goal_execution.md + model_packet.json`.

`audit_receipt.json` must record `goalCommand.mode`, `goalCommand.chars`, `goalCommand.maxChars`, `goalCommand.safeMaxChars`, and, when a goal document is written, `goalCommand.documentPath` plus `goalCommand.documentHash`. It must also record `goalDocumentRequiredFragmentsPassed` and missing fragments.

## Required Prompt Shape

Use this shape. Adapt only the source path, trace row order, task references, evidence IDs, gates, and explicit user rules.

```text
$executing-plans $verification-before-completion

<host continuation directive>

The /goal command is an entry pointer only, not the full task scope.
Execution scope is goal_execution.md + model_packet.json.

任务: Strictly execute confirmed traceRows from <source document path>#implementationConfirmation until governed evidence closeout or semantic gap reconfirm_required.

Source of authority:
Only <source document path>#implementationConfirmation is authoritative.
Primary authority: model_packet.json.
model_packet.json is the machine-readable execution authority.
Human prompt role: projection-only over model_packet.json. Do not introduce requirements absent from the packet.
Do not implement prose, diagrams, or conversation content unless it is referenced by implementationConfirmation IDs.

Trace closure authority:
confirmed source traceRows are contract projection only.
Runtime closure must be recorded in the requirement-record/control store through executionIterations, requirementClosures, gateChecks, contractChecks, deliveryEvidence.requiredCommands, artifactIndex, or equivalent governed evidence fields.
The executor must not rewrite confirmed source traceRows.status or source evidence fields to represent runtime PASS/MISSING_EVIDENCE.

Trace order:
<TRACE-001> -> <TRACE-002>

Atomic implementation task lineage:
<TASK-001> -> <TRACE-001>

Trace slices:
TRACE-001
covers: MUST-001, NEG-001
evidenceRefs: EVD-001, EVD-002
taskRefs: TASK-001
acceptanceRefs: ACC-001
e2eRefs: E2E-001
failurePathRefs: FAIL-001
edgeCaseRefs: EDGE-001
required command refs: CMD-CONTRACT-001
delivery command refs: CMD-DELIVERY-001, CMD-DELIVERY-002

Required commands:
CMD-CONTRACT-001:
node <skill-dir>/scripts/render-requirements-confirmation-html.ts --source <source-document.md> --out <confirmation.html> --language zh-CN --record-id <recordId> --entry-flow <entryFlow> --mode confirmation

CMD-DELIVERY-001:
npm run test:e2e -- upload

AI-TDD protocol:
Use RED -> GREEN -> REFACTOR -> CLOSEOUT per trace slice. RED proof must precede GREEN when expectedPreImplementationState is expected_red.

Runtime write policy:
Allowed runtime write targets: executionIterations, requirementClosures, gateChecks, contractChecks, deliveryEvidence.requiredCommands, artifactIndex.
Missing evidence behavior: remain_open_or_record_MISSING_EVIDENCE.

Semantic gap policy:
semantic gaps -> reconfirm_required.
non-semantic execution gaps -> repair_and_rerun_same_trace_slice.

Final gate matrix:
Stop only when all required current-attempt gates pass, including AI-TDD gate, delivery verification, closeout integrity, and post-closeout review when applicable.

范围与意图锁定:
1. 只能实施 implementationConfirmation 中的 must/notDone/evidence/traceRows IDs。
2. 禁止缩减范围、替换范围、改变原始需求、把原始需求解释成更小交付。
3. 禁止 MVP downgrade、stub、mock-only、happy-path-only、representative-only coverage、later-batch coverage、seed-only coverage 或局部样例冒充完整交付。

强制执行规则:
1. 以 traceRows 为唯一主执行切片，按 <TRACE order> 顺序推进。
2. 每个 TRACE 切片只能关闭其 covers/evidenceRefs 引用的 confirmed IDs。
3. taskRefs 完成不等于 requirement PASS。
4. PASS requires evidence for covered must, notDone, and evidence IDs.
5. 每完成一个 TRACE 切片，必须通过受控 runtime/control-store 记录 closure evidence；confirmed source traceRows.status 不得作为运行时 PASS/MISSING_EVIDENCE 回写目标。
6. 没有证据时 runtime closure 必须保持 open/PENDING 或记录 MISSING_EVIDENCE；严禁虚构验证结果。
7. 如果需要改变 must/notDone/mustNot/evidence/traceRows 语义，必须把源文档状态改为 reconfirm_required 并停止。
8. 每个 TRACE 切片结束必须运行对应 gate。
9. 最终必须运行并记录由 closeoutReadinessPreview.requiredCommands 或 requiredCommands 推导出的 final gates。
10. 全部完成后输出 Completion Evidence Packet，至少包含关闭 IDs、开放 IDs、命令结果、E2E 证据、审计证据、残留风险和 scope changes。

Proof boundary:
audit_receipt.json is generator self-audit only and not delivery or closeout proof.
Confirmed source traceRows.status must not be rewritten as runtime PASS or MISSING_EVIDENCE.

Completion Evidence Packet:
requiredFields: closedIds, openIds, commandResults, e2eEvidence, auditEvidence, residualRisks, scopeChanges

现在开始执行，不要等待中途确认，直到最终验收闭环或触发真实阻塞条件。
```

## Manual Generation

Manual generation follows the same rules:

- Do not generate a prompt from conversation-only requirements.
- Do not generate a prompt from ordinary prose.
- Do not generate a prompt from unconfirmed `implementationConfirmation`.
- Do not infer trace order outside `implementationConfirmation.traceRows`.
- Do not invent filenames, gate commands, status evidence, completed rows, or requirement IDs.

If the user provides only a session requirement plan, return:

```text
BLOCK: SESSION_INPUT_NEEDS_SOURCE_DOCUMENT
Conversation-only requirements must first be written into an implementation source document with implementationConfirmation.status=draft and then explicitly confirmed by the user.
```

## Audit Checklist

Before returning a prompt, verify all items:

- The first line contains `$executing-plans $verification-before-completion`.
- The prompt contains exactly one host continuation directive: `/goal`, `continue nonstop`, Cursor IDE Agent mode continuation text, Cursor CLI external supervisor loop, Claude Code continuation text, or generic continuation text.
- The prompt names the exact source document path.
- The source of authority says only `<source document path>#implementationConfirmation` is authoritative.
- The prompt states `model_packet.json` is the machine-readable execution authority.
- `implementationConfirmation.status` is `user_confirmed`.
- `requirement-record.json.confirmationHistory[]` exists.
- Latest `confirmationHistory[]` event is `confirmation_recorded`.
- Latest confirmation hashes match the current semantic source document hash and semantic `implementationConfirmation` hash.
- Source document status alone is not trusted.
- No blocking open questions remain.
- TRACE order is explicit and comes from `implementationConfirmation.traceRows`.
- Every trace row references existing confirmation IDs.
- Every trace row command ref resolves to `requiredCommands[]`; `suggestedCommands[]` cannot close acceptance.
- Scope, original intent, business semantics, user-visible outcomes, acceptance standards, and non-goal boundaries cannot be reduced or rewritten.
- The prompt rejects MVP downgrade, stub, mock-only, happy-path-only, representative-only, later-batch, seed-only, and scope reduction.
- PASS requires evidence for covered `must`, `notDone`, and `evidence` IDs.
- The prompt states confirmed source `traceRows` are contract projection only.
- The prompt states runtime closure authority is `requirement-record`/control store.
- The prompt requires closure evidence in `executionIterations`, `requirementClosures`, gates/checks, required commands, artifact index, or project-equivalent governed fields.
- The prompt forbids rewriting confirmed source `traceRows[].status` or source evidence fields as runtime PASS/MISSING_EVIDENCE.
- No-evidence runtime closure remains open/`PENDING` or records `MISSING_EVIDENCE`.
- Semantic changes require `reconfirm_required` and stop.
- Completion Evidence Packet includes closed IDs, open IDs, command results, E2E evidence, audit evidence, residual risks, and scope changes.
- `audit_receipt.json` records `executionHost`, alias if used, `humanPromptProfile`, `humanPromptLanguage`, `continuationDirective`, and `humanPromptRequiredFragmentsPassed`.
- If required human prompt fragments are missing, generation must block rather than emit a PASS receipt.
- If native `/goal` is emitted, the receipt records `goalCommand.mode=native_goal_document_ref`, character counts, limits, `goalCommand.documentPath`, `goalCommand.documentHash`, and never records `native_goal_inline`.
- If `goal_execution.md` is emitted, it contains `$executing-plans $verification-before-completion`, source authority, `model_packet.json is the machine-readable execution authority`, trace order, trace slice summary, required commands, AI-TDD protocol, runtime write policy, `reconfirm_required`, proof boundary, strict final acceptance checklist, and Completion Evidence Packet schema.
- If required goal document fragments are missing, generation must block rather than emit a PASS receipt.

## Scope Change Request

If the requested prompt would reduce or reinterpret confirmed requirements, do not generate a reduced prompt. Return this block:

```text
Scope Change Request
Original confirmed IDs:
Proposed change:
Reason:
Impact on users:
Impact on implementationConfirmation:
Alternative:
Required user decision:
```
