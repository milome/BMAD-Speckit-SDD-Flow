# BUGFIX: requirements authoring draft promotion gap

## Status

Draft bugfix plan. This document is an implementation plan only. It must not be treated as a confirmed requirements source document, and it does not authorize implementation execution.

## Problem statement

The requirements authoring toolchain currently has no legal end-to-end path for a plain source document that does not already contain explicit `MUST:` rows or an inline `implementationConfirmation.must[]` block.

Required legal path:

`plain source doc -> controlled MUST candidates -> draft implementationConfirmation -> safe promotion as draft -> render/audit -> explicit user confirmation -> status: user_confirmed`

Observed illegal or blocked paths:

| Path | Current result | Why this is a bug |
|---|---|---|
| Plain source doc through `author-confirmation-ready-source` | Blocks with `controlled_must_candidates_missing` | The entry lane says authoring must generate controlled MUST candidates, but the implementation stops before generating them. |
| Plain source doc through `authoring-repair --mode preserve-existing` | Blocks with `implementation_confirmation_missing` or `controlled_must_candidates_missing` | Preserve-existing repair is correct to refuse creation, but the entry routing must not send plain authoring work into this lane. |
| Draft document through `promote-draft-large-doc.js` | Blocks unless status is `user_confirmed` | The promotion script conflates draft materialization with confirmation-ready execution readiness. |
| Agent workaround by setting `status: user_confirmed` | Must remain forbidden | User confirmation is a human authorization event, not an authoring shortcut. |

## Root cause analysis

### RC-001: `author-confirmation-ready-source` detects the missing authoring step but does not perform it

Evidence:

| Location | Current behavior |
|---|---|
| `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts:6184` | Calls `resolveSourceMustRequirements(sourcePath)`. |
| `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts:6185` | If the result is empty, execution immediately enters the blocking branch. |
| `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts:6187` | Emits issue code `controlled_must_candidates_missing`. |
| `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts:6188` | Message says authoring must generate controlled MUST candidates before packet materialization. |

Actual root cause: the implementation names the missing requirement correctly, but it has no materialization function that converts plain requirement prose into controlled candidate artifacts before the packet/source materialization path.

Required correction: `controlled_must_candidates_missing` must become a fail-closed outcome only when candidate extraction/materialization has already been attempted and produced zero usable candidates or unresolved fatal ambiguity. It must not be the first response to a plain source document with extractable requirement prose.

### RC-002: `authoring-repair preserve-existing` is correctly strict but is being used as a conceptual fallback

Evidence:

| Location | Current behavior |
|---|---|
| `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts:4891` | Forces `authoring-repair` to `--mode preserve-existing`. |
| `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts:4902` | Extracts existing inline `implementationConfirmation`. |
| `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts:4903` | Blocks when the inline block is missing. |
| `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts:4916` | Error says preserve-existing repair requires an existing inline block. |
| `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts:4923` | Extracts inline must requirements only from the existing confirmation block. |
| `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts:4936` | Emits `controlled_must_candidates_missing` and states there is no fallback to default MUST candidates. |

Actual root cause: preserve-existing repair has the correct safety model, but the product path lacks a separate create/update authoring materializer. Because of that missing lane, callers are tempted to reuse preserve-existing repair for plain source documents, which is invalid by design.

Required correction: preserve-existing repair must remain unable to create new semantic content. The fix belongs in `author-confirmation-ready-source`, not by weakening preserve-existing repair.

### RC-003: `promote-draft-large-doc.js` accepts only confirmed status and therefore blocks legal draft promotion

Evidence:

| Location | Current behavior |
|---|---|
| `_bmad/skills/requirements-contract-authoring/scripts/promote-draft-large-doc.js:13` | Defines `CONFIRMATION_READY_STATUSES = new Set(["user_confirmed"])`. |
| `_bmad/skills/requirements-contract-authoring/scripts/promote-draft-large-doc.js:328` | Allows `--preflight-only` to return before reverse audit and replacement. |
| `_bmad/skills/requirements-contract-authoring/scripts/promote-draft-large-doc.js:336` | Rejects any status not in `CONFIRMATION_READY_STATUSES`. |
| `_bmad/skills/requirements-contract-authoring/scripts/promote-draft-large-doc.js:339` | Emits `semantic_decision_required:expected_draft_gap_policy`. |

Actual root cause: the script has one status policy for two different operations:

| Operation | Correct allowed status |
|---|---|
| Authoring draft persistence | `draft`, `draft_updated_not_confirmation_ready`, `reconfirm_required` when explicitly requested as draft promotion |
| Confirmation-ready execution persistence | `user_confirmed` only |

Required correction: the promotion command must become mode-aware. Draft promotion is a safe write of authoring material, not user confirmation and not implementation readiness.

### RC-004: The skill contract forbids fake confirmation but has no defined draft promotion policy

Evidence:

| Location | Current behavior |
|---|---|
| `_bmad/skills/requirements-contract-authoring/SKILL.md:26` | Forbids setting `status: user_confirmed` without explicit user confirmation. |
| `_bmad/skills/requirements-contract-authoring/SKILL.md:57` | Requires `author-confirmation-ready-source` to write the source document before deep audit. |
| `_bmad/skills/requirements-contract-authoring/SKILL.md:85` | Says a source document without inline `implementationConfirmation` must not route to preserve-existing repair. |
| `_bmad/skills/requirements-contract-authoring/SKILL.md:132` | Says syntactically valid but not confirmation-ready drafts must stop because the allowed draft-gap policy is undefined. |
| `_bmad/skills/requirements-contract-authoring/SKILL.md:482` | Says authoring leaves `status: draft` unless explicitly confirmed. |

Actual root cause: the written rules simultaneously require draft authoring and forbid fake confirmation, but the operational promotion script only persists `user_confirmed` documents. This makes compliant authoring impossible.

Required correction: define and implement an explicit draft promotion stage that records non-confirmed status and requires later render/audit/user confirmation before any execution packet can be generated.

## Non-goals

| Non-goal | Reason |
|---|---|
| Do not loosen `authoring-repair --mode preserve-existing` | It must audit or repair existing inline confirmation content only. |
| Do not allow default or synthetic MUST rows with no source trace | Controlled candidates must point to source spans and source hashes. |
| Do not set `status: user_confirmed` during authoring | Confirmation must remain a user event. |
| Do not add root `scripts/` runtime helpers | Existing project rule forbids new root runtime helpers. |
| Do not create temporary generator scripts as part of the product fix | The fix must live in package/skill runtime code and tests, not ad hoc generated scripts. |

## Required behavior after fix

| Scenario | Expected behavior |
|---|---|
| Plain source doc contains extractable requirement prose but no inline block | `author-confirmation-ready-source` creates controlled MUST candidates, materializes a draft inline `implementationConfirmation`, writes receipts, and leaves status non-confirmed. |
| Plain source doc contains no extractable requirement prose | Fails closed with `controlled_must_candidates_missing` after writing an attempt receipt that proves extraction ran. |
| Existing source doc has inline `implementationConfirmation.must[]` | Preserve-existing repair continues to audit and repair the existing block without creating new requirements. |
| Draft source document is promoted with authoring draft stage | Promotion succeeds only for allowed non-confirmed statuses and marks the receipt as not confirmation-ready. |
| Draft source document is promoted without authoring draft stage | Promotion fails closed and requires explicit stage selection. |
| Final implementation readiness path sees `draft` status | Fails closed and requires explicit user confirmation. |

## Detailed task list

| Task ID | File path | Required change |
|---|---|---|
| T001 | `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts` | Add type `ControlledMustCandidate` with fields `candidateId`, `sourcePath`, `sourceHash`, `sourceSpan`, `headingPath`, `originalText`, `normalizedRequirement`, `decision`, `decisionReason`, `requiresHumanReview`. |
| T002 | `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts` | Add function `buildControlledMustCandidatesFromPlainSource(root, sourcePath, sourceText)` near the existing pre-confirmation helpers. It must read only the provided source text, derive candidates with exact source spans, and return no candidates when source evidence is absent. |
| T003 | `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts` | Change the branch after `resolveSourceMustRequirements(sourcePath)` in `author-confirmation-ready-source`: if no explicit MUST rows or inline musts exist, call `buildControlledMustCandidatesFromPlainSource` before returning `controlled_must_candidates_missing`. |
| T004 | `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts` | Add artifact writes under the current `preConfirmationPaths(...)` directory: `controlled-must-candidates.json`, `draft-implementation-confirmation.json`, and `authoring-materialization-receipt.json`. Each artifact must include `sourceDocumentHash`, `createdAt`, `recordId`, `requirementSetId`, candidate counts, and fail-closed decision. |
| T005 | `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts` | Convert accepted controlled candidates into draft `implementationConfirmation.must[]` rows with stable IDs derived from the requirement set, not from array order alone. The generated block must set `status: draft` and must not emit `user_confirmed`. |
| T006 | `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts` | Preserve the existing `authoring-repair --mode preserve-existing` behavior at lines 4883-4965. Add regression assertions or code comments only if necessary to make clear this lane must not create a missing confirmation block. |
| T007 | `_bmad/skills/requirements-contract-authoring/scripts/promote-draft-large-doc.js` | Replace `CONFIRMATION_READY_STATUSES` with a stage-aware policy map. Required stages: `confirmation-ready` allows only `user_confirmed`; `authoring-draft` allows only `draft`, `draft_updated_not_confirmation_ready`, and `reconfirm_required`. |
| T008 | `_bmad/skills/requirements-contract-authoring/scripts/promote-draft-large-doc.js` | Add CLI option `--promotion-stage <authoring-draft|confirmation-ready>`. Default must be `confirmation-ready` to preserve existing fail-closed behavior. |
| T009 | `_bmad/skills/requirements-contract-authoring/scripts/promote-draft-large-doc.js` | When `--promotion-stage authoring-draft` succeeds, skip any readiness language that implies confirmation. The receipt must include `promotionStage`, `allowedStatuses`, `statusValue`, `confirmationReady: false`, `safePromotionAsDraft: true`, and `requiresUserConfirmationBeforeExecution: true`. |
| T010 | `_bmad/skills/requirements-contract-authoring/scripts/promote-draft-large-doc.js` | When `--promotion-stage confirmation-ready` sees `draft`, keep the existing fail-closed semantics and include `promotionStage`, `allowedStatuses`, and `statusValue` in the failure receipt. |
| T011 | `_bmad/skills/requirements-contract-authoring/SKILL.md` | Replace the undefined draft-gap rule with the legal path: plain source doc, controlled MUST candidates, draft `implementationConfirmation`, safe draft promotion, render/audit, explicit user confirmation, then `status: user_confirmed`. |
| T012 | `_bmad/skills/requirements-contract-authoring/SKILL.md` | State that draft promotion is persistence only. It must not be called confirmation-ready, implementation-ready, or execution-ready. |
| T013 | `tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts` | Add a case where a plain source document with requirement prose and no inline block produces `controlled-must-candidates.json` and a draft confirmation projection instead of immediate `controlled_must_candidates_missing`. |
| T014 | `tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts` | Add a case where a plain source document with no requirement-bearing content fails with `controlled_must_candidates_missing` only after an extraction attempt receipt exists. |
| T015 | `tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts` | Add or keep a regression case proving preserve-existing still fails when the inline `implementationConfirmation` block is missing. |
| T016 | `tests/acceptance/requirements-contract-large-doc-write-flow.test.ts` | Add tests proving `--promotion-stage authoring-draft` allows `draft` and writes draft-only receipt fields. |
| T017 | `tests/acceptance/requirements-contract-large-doc-write-flow.test.ts` | Add tests proving default promotion still rejects `draft` and still accepts only `user_confirmed`. |
| T018 | `tests/acceptance/requirements-contract-authoring-skill-contract.test.ts` | Add contract assertions that the skill documents the legal draft path, forbids fake `user_confirmed`, and distinguishes draft persistence from execution readiness. |

## Controlled MUST candidate contract

`controlled-must-candidates.json` must use this minimum schema:

```json
{
  "schemaVersion": "requirements-authoring-controlled-must-candidates/v1",
  "sourcePath": "docs/requirements/example.md",
  "sourceDocumentHash": "sha256:...",
  "recordId": "...",
  "requirementSetId": "...",
  "candidateCount": 1,
  "candidates": [
    {
      "candidateId": "MUST-CAND-001",
      "sourceSpan": { "startLine": 12, "endLine": 14 },
      "headingPath": ["Problem", "Acceptance"],
      "originalText": "The system must persist draft confirmation blocks without marking them confirmed.",
      "normalizedRequirement": "Persist draft implementationConfirmation blocks without changing status to user_confirmed.",
      "decision": "accepted_for_draft",
      "decisionReason": "Source text uses mandatory requirement language and has a concrete behavior.",
      "requiresHumanReview": true
    }
  ],
  "decision": "draft_materialization_allowed"
}
```

The candidate artifact must be source-bound. If `sourceSpan` or `sourceDocumentHash` is missing for any candidate, the lane must fail closed and must not materialize the draft block.

## Promotion receipt contract

For `--promotion-stage authoring-draft`, the receipt must include:

```json
{
  "promotionStage": "authoring-draft",
  "allowedStatuses": ["draft", "draft_updated_not_confirmation_ready", "reconfirm_required"],
  "statusValue": "draft",
  "confirmationReady": false,
  "safePromotionAsDraft": true,
  "requiresUserConfirmationBeforeExecution": true
}
```

For default or `--promotion-stage confirmation-ready`, the receipt must include:

```json
{
  "promotionStage": "confirmation-ready",
  "allowedStatuses": ["user_confirmed"],
  "statusValue": "draft",
  "confirmationReady": false,
  "safePromotionAsDraft": false,
  "requiresUserConfirmationBeforeExecution": true
}
```

## Validation commands

Required targeted validation after implementation:

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts
npx vitest run tests/acceptance/main-agent-authoring-repair-preserve-existing.test.ts
npx vitest run tests/acceptance/requirements-contract-large-doc-write-flow.test.ts
npx vitest run tests/acceptance/requirements-contract-authoring-skill-contract.test.ts
npm run build
```

## Acceptance criteria

| ID | Criterion |
|---|---|
| ACC-001 | A plain source document with extractable requirement prose no longer stops immediately at `controlled_must_candidates_missing`. |
| ACC-002 | The toolchain writes `controlled-must-candidates.json` before draft confirmation materialization. |
| ACC-003 | Every generated draft MUST row is traceable to source path, source hash, source span, and candidate ID. |
| ACC-004 | `authoring-repair --mode preserve-existing` still refuses to create missing confirmation content. |
| ACC-005 | `promote-draft-large-doc.js` supports explicit `--promotion-stage authoring-draft` and allows only non-confirmed draft statuses in that mode. |
| ACC-006 | Default promotion mode remains fail-closed and continues to require `status: user_confirmed`. |
| ACC-007 | No code path treats draft promotion as execution readiness. |
| ACC-008 | Skill documentation states the complete legal path and forbids fake confirmation. |
| ACC-009 | Targeted acceptance tests cover success, fail-closed, default rejection, and preserve-existing regression paths. |
| ACC-010 | Encoding gate reports zero findings after code, tests, and skill documentation changes. |

## Rollout notes

This fix changes authoring behavior but must not change implementation readiness semantics. Existing confirmed documents remain valid. Existing draft documents gain a legal safe-promotion path only when callers explicitly pass `--promotion-stage authoring-draft`. Any downstream command that generates execution prompts, goal contracts, trace prompts, or implementation packets must continue to require `status: user_confirmed`.

## Residual risks to monitor

| Risk | Mitigation |
|---|---|
| Candidate extraction over-selects explanatory prose | Require source span, decision reason, and `requiresHumanReview: true` for every draft candidate. |
| Draft promotion is misread as confirmation | Receipt fields must explicitly state `confirmationReady: false` and `requiresUserConfirmationBeforeExecution: true`. |
| Preserve-existing repair is weakened accidentally | Add acceptance coverage proving missing inline block still fails in preserve-existing mode. |
| Skill docs and script policy drift again | Add skill-contract tests for the legal path and promotion stage names. |
