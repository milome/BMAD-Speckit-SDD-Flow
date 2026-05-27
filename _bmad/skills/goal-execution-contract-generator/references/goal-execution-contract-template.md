# [Feature Name] Goal Execution Contract

```yaml
goalContractVersion: goal-execution-contract/v1
contractMode: frozen
rewritePolicy: forbidden
executionMode: execute_only
sourcePlanPath: "<docs/plans/YYYY-MM-DD-feature-plan.md>"
sourcePlanHash: "sha256:<hash>"
runtimeRecordId: "<REQ-... or none>"
entryFlow: "<story|bugfix|standalone_tasks|docs_only|other>"
taskRange: "<G00-GNN or Task 1-Task N>"
acceptanceRange: "<AC-01-AC-NN or checklist sections>"
completionGate: required
repairPolicy: fix_in_place
stopPolicy: stop_only_on_success_or_true_blocker
generatedBy: "<agent|compiler|human>"
generatedAt: "<ISO-8601>"
```

> **For Codex /goal:** REQUIRED EXECUTION MODE: Use this file as the authoritative frozen `/goal` source. Execute task-by-task, keep fresh verification evidence, and do not claim completion until every strict acceptance item passes.
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** <One sentence describing the outcome.>

**Architecture:** <Two to three sentences describing the implementation approach and authority boundaries.>

**Tech Stack:** <Runtime, languages, test tools, and governed artifacts.>

---

## /goal Entry

Use this short command. The command is intentionally only a pointer so it stays below command-length limits.

```text
/goal Follow <this-file-path> exactly. Execute the frozen contract. Do not rewrite, summarize, normalize, or replace it. Stop only for the stop conditions in the document.
```

The full execution contract is this document, not the command text.

## Contract Freeze Rules

- `/goal` must not rewrite this contract.
- `/goal` must not replace this contract with a new task list, new acceptance matrix, or new completion gate.
- `/goal` must not convert prose design notes into a different execution contract.
- If this contract is incomplete, `/goal` must stop with `contract_amendment_required` and list the missing fields.
- If acceptance criteria are insufficient, `/goal` must stop with `contract_amendment_required`; it must not silently add stricter acceptance criteria while executing.
- If a task requires files outside its declared write scope, `/goal` must stop with `scope_amendment_required` unless the contract explicitly allows scope expansion.
- If a requirement semantic decision is missing, `/goal` must stop with `semantic_decision_required`.
- If a validation command is unavailable or ambiguous, `/goal` must stop with `validation_contract_required`.

## Contract Completeness Gate

Before editing files, verify this contract has all required sections:

- `/goal Entry`
- `Contract Freeze Rules`
- `Contract Completeness Gate`
- `Non-Negotiable Execution Rules`
- `Authority Model`
- `Implementation Tasks`
- `Strict Acceptance Checklist`
- `Acceptance Traceability Matrix`
- `Required Test Commands`
- `Manual Verification Scenarios`
- `Completion Evidence Packet`
- `Stop Conditions`

Before editing files, verify these front matter fields are not placeholders:

- `goalContractVersion`
- `contractMode`
- `rewritePolicy`
- `executionMode`
- `sourcePlanPath`
- `taskRange`
- `acceptanceRange`
- `completionGate`
- `repairPolicy`
- `stopPolicy`

Fail closed when any required section or field is missing.

## Non-Negotiable Execution Rules

- Use `pwsh.exe -NoLogo -NoProfile -Command "& { ... }"` for Windows shell commands.
- Do not use `powershell.exe`.
- Use `apply_patch` for manual code and documentation edits.
- Run the encoding gate before and after text edits:

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

- Inspect `git status --short` before editing and do not revert unrelated dirty worktree changes.
- If partial implementation already exists, audit it against this contract and continue. Do not restart by deleting useful work.
- Do not mark a task complete without fresh command output or direct file evidence.
- Do not mark an acceptance item complete without evidence that directly proves that item.
- Do not claim completion from summaries, TaskReport text, generated HTML, dashboards, score records, or audit prose alone.
- Do not weaken real semantic gates, controlled ingest gates, closeout gates, or authority boundaries.
- Do not ask the user to make decisions that this contract classifies as deterministic repair.

## Authority Model

Define the authority boundaries for this goal.

Required fields:

- **State owner:** <main agent / script / compiler / human>
- **Machine-readable authority:** <artifact or record>
- **Human-facing projection:** <prompt, HTML, report, or none>
- **Controlled ingest writer:** <writer or none>
- **Execution evidence:** <tests, command output, receipts, task reports>
- **Completion authority:** <gate or final acceptance command>

Non-authority artifacts:

- <List outputs that are useful evidence but cannot advance state or prove completion by themselves.>

## Root Cause To Fix

State the defect or capability gap in concrete terms.

- Current behavior: <what happens now>
- Required behavior: <what must happen>
- Failure mode to prevent: <what must never be accepted>

## Domain-Specific Contract Addenda

Use this section only when the goal needs a domain contract before implementation. Omit this section when the goal has no classifier, state machine, schema, controlled writer, prompt/compiler output, renderer/report surface, gate, audit, or other domain-specific machine contract.

Required when the goal defines one of:

- Shared classifier or state machine.
- Machine-readable schema, event payload, or typed envelope.
- Controlled ingest writer or state-write contract.
- Prompt, compiler, or model-packet output contract.
- Renderer, report, or user-facing projection surface contract.
- Gate, audit, score, or decision contract.

Every included addendum must be referenced by at least one implementation task, one acceptance item, and one acceptance traceability matrix row.

### Required <Domain> Contract

- Public API / exported function: <name and signature>
- Required constants or enum values: <exact names and values>
- Required input shape: <fields>
- Required output shape: <fields>
- Fail-closed behavior: <blocking conditions>
- Forbidden fallback behavior: <paths that must not be used>

### Required <Domain> Evidence Schema

- Required fields: <fields>
- Evidence refs: <ID families, artifact paths, or command refs>
- Missing-field blockers: <fields that block when absent>
- Invalid-state blockers: <states that block when present>
- Non-authority artifacts: <outputs that are evidence but not state authority>

## Implementation Tasks

Each task must be atomic enough to execute and verify independently. Prefer `G00` style IDs when the task is part of a governed runtime plan.

### G00 Baseline Audit

**Purpose:** Confirm current state, dirty worktree, prerequisites, and contract completeness.

**Files:**

- Read: `<paths>`
- Modify: none

**Steps:**

1. Run `git status --short`.
2. Run the encoding gate if text files may be edited.
3. Confirm required source files and runtime records exist.
4. Confirm this contract is complete and frozen.
5. Record unrelated dirty files and do not revert them.

**Validation:**

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

**Acceptance:**

- Contract completeness gate passes.
- Worktree status is recorded.
- Prerequisites are either satisfied or the goal stops before implementation.

### G01 <Task Name>

**Purpose:** <Specific outcome.>

**Files:**

- Create: `<exact/path>`
- Modify: `<exact/path>`
- Test: `<exact/path>`

**Steps:**

1. Write or update the failing test.
2. Run the targeted test and confirm it fails for the expected reason.
3. Implement the minimal change.
4. Run the targeted test and confirm it passes.
5. Record evidence for mapped acceptance items.

**Validation:**

```powershell
<exact command>
```

**Acceptance:**

- <Task-local acceptance item.>
- <Mapped AC IDs: AC-01, AC-02.>

### GNN Final Integration

**Purpose:** Run the full validation and produce the completion evidence packet.

**Files:**

- Modify: none unless validation reveals a contract-scoped defect.

**Steps:**

1. Run all required test commands.
2. Run the encoding gate.
3. Inspect `git diff --stat`.
4. Inspect changed files for unrelated edits.
5. Produce the completion evidence packet.

**Validation:**

```powershell
<full validation command set>
```

**Acceptance:**

- All required commands pass.
- Every strict acceptance item has direct evidence.
- No unrelated file was modified by this goal.

## Strict Acceptance Checklist

Every checkbox must have direct evidence before completion is claimed.

### Contract Acceptance

- [ ] The contract front matter exists and has no placeholder values.
- [ ] `contractMode=frozen`.
- [ ] `rewritePolicy=forbidden`.
- [ ] `/goal` did not rewrite this contract.
- [ ] All task IDs in `taskRange` exist in `Implementation Tasks`.
- [ ] All acceptance IDs in `acceptanceRange` exist in this checklist or the acceptance matrix.
- [ ] Every task has files, steps, validation, and acceptance.
- [ ] Every validation command is executable in this repository.
- [ ] If `Domain-Specific Contract Addenda` is included, each addendum is referenced by at least one task, one acceptance item, and one matrix row.

### Implementation Acceptance

- [ ] <AC-01: behavior or artifact requirement.>
- [ ] <AC-02: behavior or artifact requirement.>
- [ ] <AC-03: fail-closed or regression requirement.>

### Authority Acceptance

- [ ] The machine-readable authority is used for execution decisions.
- [ ] Human-facing projections are not treated as machine authority.
- [ ] Non-authority artifacts are not used as completion proof.
- [ ] Controlled ingest or state writes happen only through the declared writer.

### Regression Acceptance

- [ ] Existing behavior that must remain valid is covered.
- [ ] New failure modes are covered.
- [ ] No old fallback path bypasses the new authority model.

Recommended acceptance groups when applicable:

- Contract Acceptance
- Domain Behavior Acceptance
- Authority Acceptance
- Integration Surface Acceptance
- Operational Surface Acceptance
- Regression Acceptance

## Acceptance Traceability Matrix

| AC ID | Requirement | Owning Task | Evidence Command |
| --- | --- | --- | --- |
| AC-01 | <Requirement text> | G01 | `<command>` |
| AC-02 | <Requirement text> | G01 | `<command>` |
| AC-03 | <Requirement text> | GNN | `<command>` |

## Required Test Commands

Run these commands after implementation. Add any newly created test command explicitly.

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

```powershell
<targeted test command>
```

```powershell
<full validation command>
```

## Manual Verification Scenarios

Produce explicit evidence for each scenario that matters to this goal.

### Scenario A: <Name>

- Setup: <state or fixture>
- Expected: <classification or behavior>
- Forbidden: <incorrect behavior>

### Scenario B: <Name>

- Setup: <state or fixture>
- Expected: <classification or behavior>
- Forbidden: <incorrect behavior>

## Completion Evidence Packet

The final implementation response must include:

- Files changed.
- Commands run and pass/fail summary.
- Acceptance traceability summary.
- Manual verification scenario outcomes.
- Evidence that non-authority artifacts were not treated as completion proof.
- Evidence that no unrelated dirty worktree changes were reverted.
- Residual risks, if any.

## Stop Conditions

Stop and ask the user only if:

- A required semantic decision cannot be derived from current source and controlled record.
- Repair would require deleting or rewriting user-authored semantic requirement content.
- Controlled record history is internally contradictory and no safe precedence rule exists.
- A destructive Git or filesystem operation is required.
- A shared contract/schema migration is unavoidable and has multiple valid incompatible designs.
- The required write scope must expand outside this contract.
- The contract is incomplete and needs an amendment.

Do not stop merely because:

- Tests need fixtures.
- Existing implementation is partial.
- Generated artifacts are stale.
- Deterministic bookkeeping repair is needed.
- A validation command fails inside declared scope.

In those cases, repair inside the declared scope and rerun the same validation command.
