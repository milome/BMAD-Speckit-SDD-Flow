---
name: req-trace-matrix-prompt-generator
description: Generate strict nonstop execution prompts only from implementation source documents that contain an inline implementationConfirmation block with status=user_confirmed. Use when converting confirmed PRD/BUGFIX/TASKS source documents and traceRows into implementation prompts. Block conversation-only requirements, ordinary prose, unconfirmed confirmation blocks, standalone contracts, invalid trace references, sidecars, amendments, MVP downgrades, stubs, mock-only coverage, scope reduction, or changed requirement intent.
---

# Req Trace Matrix Prompt Generator

## Overview

Generate an execution prompt only from an implementation source document:

```text
implementation source document = human-readable context + machine-readable implementationConfirmation block
```

The source document's inline `implementationConfirmation` block is the only authority. Do not generate implementation prompts from conversation-only requirements, ordinary PRD prose, standalone requirements contracts, diagrams without confirmation IDs, sidecar files, or amendments.

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
10. Validate that every `traceRows[].evidenceRefs` entry references existing `evidence` IDs.
11. Validate that trace rows do not introduce new requirement semantics.
12. Preserve `traceRows` order exactly.
13. Generate implementation prompt using only confirmation IDs, trace IDs, evidence IDs, and task references.
14. If validation fails, output a BLOCK response, not an implementation prompt.

## Script Usage

Prefer the bundled script for local source documents:

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
traceRows reference missing must/notDone/evidence IDs.
```

```text
BLOCK: TRACE_RESTATES_REQUIREMENTS
traceRows contain new requirement semantics instead of references only.
```

```text
BLOCK: SESSION_INPUT_NEEDS_SOURCE_DOCUMENT
Conversation-only requirements must first be written into an implementation source document with implementationConfirmation.status=draft and then explicitly confirmed by the user.
```

## Required Prompt Shape

Use this shape. Adapt only the source path, trace row order, task references, evidence IDs, gates, and explicit user rules.

```text
$executing-plans $verification-before-completion

continue nonstop

任务：严格执行 <source document path>#implementationConfirmation 的 confirmed traceRows，直到闭环验收完成。

Source of authority:
Only <source document path>#implementationConfirmation is authoritative.
Do not implement prose, diagrams, or conversation content unless it is referenced by implementationConfirmation IDs.

范围与意图锁定:
1. 只能实施 implementationConfirmation 中的 must/notDone/evidence/traceRows IDs。
2. 禁止缩减范围、替换范围、改变原始需求、把原始需求解释成更小交付。
3. 禁止 MVP downgrade、stub、mock-only、happy-path-only、representative-only coverage、later-batch coverage、seed-only coverage 或局部样例冒充完整交付。

强制执行规则:
1. 以 traceRows 为唯一主执行切片，按 <TRACE order> 顺序推进。
2. 每个 TRACE 切片只能关闭其 covers/evidenceRefs 引用的 confirmed IDs。
3. taskRefs 完成不等于 requirement PASS。
4. PASS requires evidence for covered must, notDone, and evidence IDs.
5. 没有证据时必须保持 PENDING 或改为 MISSING_EVIDENCE；严禁虚构验证结果。
6. 如果需要改变 must/notDone/mustNot/evidence/traceRows 语义，必须把源文档状态改为 reconfirm_required 并停止。
7. 每个 TRACE 切片结束必须运行对应 gate。
8. 最终必须运行并记录 final gates。
9. 全部完成后输出 Completion Evidence Packet，至少包含关闭 IDs、开放 IDs、命令结果、E2E 证据、审计证据、残留风险和 scope changes。

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
- The prompt contains `continue nonstop`.
- The prompt names the exact source document path.
- The source of authority says only `<source document path>#implementationConfirmation` is authoritative.
- `implementationConfirmation.status` is `user_confirmed`.
- `requirement-record.json.confirmationHistory[]` exists.
- Latest `confirmationHistory[]` event is `confirmation_recorded`.
- Latest confirmation hashes match the current semantic source document hash and semantic `implementationConfirmation` hash.
- Source document status alone is not trusted.
- No blocking open questions remain.
- TRACE order is explicit and comes from `implementationConfirmation.traceRows`.
- Every trace row references existing confirmation IDs.
- Scope, original intent, business semantics, user-visible outcomes, acceptance standards, and non-goal boundaries cannot be reduced or rewritten.
- The prompt rejects MVP downgrade, stub, mock-only, happy-path-only, representative-only, later-batch, seed-only, and scope reduction.
- PASS requires evidence for covered `must`, `notDone`, and `evidence` IDs.
- No-evidence rows remain `PENDING` or `MISSING_EVIDENCE`.
- Semantic changes require `reconfirm_required` and stop.
- Completion Evidence Packet includes closed IDs, open IDs, command results, E2E evidence, audit evidence, residual risks, and scope changes.

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
