---
description: Generate an omission-first checklist for the current feature based on repository governance and requirement quality risks.
---

## Checklist Purpose: "Unit Tests for English"

Checklists created by `/speckit.checklist` are **requirements-quality gates**, not implementation QA plans.

They MUST test whether the written contract is:

- complete
- clear
- consistent
- traceable
- measurable
- resilient against omission-driven E2E failure

They MUST NOT test whether code already works.

## Default Mode

In this repository, `/speckit.checklist` defaults to **omissions and ambiguity auditing**.

If the user does not request a domain explicitly, generate an omissions-focused checklist that looks for the kinds of gaps that later produce:

- `module complete but journey not runnable`
- missing smoke proof
- missing closure note
- missing failure / rollback definition
- silent assumption drift
- missing owner or exception boundary

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Mandatory Inputs

1. Run `_bmad/speckit/scripts/powershell/check-prerequisites.ps1 -Json -IncludeTasks` from repo root and parse:
   - `FEATURE_DIR`
   - `AVAILABLE_DOCS`
2. Load `_bmad/_config/speckit-governance.yaml`
3. Load `_bmad/cursor/skills/speckit-workflow/references/omissions-pattern-library.md`
   - Fallback: `_bmad/claude/skills/speckit-workflow/references/omissions-pattern-library.md`
4. Load from `FEATURE_DIR` when present:
   - `spec.md`
   - `plan.md`
   - `tasks.md`

If the governance YAML or omissions pattern library cannot be found, stop and report the blocker.

## Clarifying Questions

Ask clarifying questions **only** when the answer materially changes checklist content.

Rules:

- Ask at most **two** questions.
- Prefer omission-focused questions such as:
  - Should this checklist stay generic omissions-first, or focus on a specific domain like security/performance/API?
  - Does this feature touch a `P0 journey`, permission boundary, or rollback-sensitive flow?
- If the user already gave enough signal, skip questions and proceed.

Defaults when no further interaction is needed:

- checklist mode: `omissions`
- audience: reviewer
- depth: standard

## Checklist Generation Flow

1. **Determine checklist type**
   - If the user explicitly names a domain, use a short descriptive filename such as `security.md`, `api.md`, or `performance.md`.
   - If the user does not specify a domain, use `omissions.md`.

2. **Load feature context selectively**
   - Read only the parts of spec/plan/tasks needed to assess:
     - completion states
     - evidence types
     - verification commands
     - failure paths
     - recovery / rollback conditions
     - owner / permission boundaries
     - exception conditions
     - readiness / smoke / closure / re-readiness
   - Do not dump full files when a focused summary is enough.

3. **Create or append checklist file**
   - Directory: `FEATURE_DIR/checklists/`
   - If the file does not exist, create it starting at `CHK001`.
   - If the file exists, append and continue numbering.
   - Never delete existing checklist content.

## Required Omission Categories

Unless the user explicitly narrows scope, the checklist MUST include questions for these categories:

### 1. Completion State

Check whether the docs define user-visible completion, not only "implementation done".

Examples:

- "Is the user-visible completion state defined for each P0 journey? [Completeness]"
- "Can the stated completion condition be objectively verified? [Measurability]"

### 2. Evidence & Verification

Check whether the contract says what proof is required.

Examples:

- "Are evidence types defined for each runnable slice and journey? [Traceability]"
- "Are verification commands specified where smoke proof or closure is required? [Gap]"

### 3. Failure / Recovery / Rollback

Check whether failure handling is explicitly written.

Examples:

- "Are failure triggers defined for the primary journey, not only the happy path? [Coverage]"
- "Are rollback or recovery requirements documented for mutation-heavy flows? [Gap]"

### 4. Owner / Permission / Responsibility

Check whether ownership and permission boundaries are explicit.

Examples:

- "Are owner roles defined for readiness, implement, and closure decisions? [Completeness]"
- "Are permission boundaries documented where user role changes affect the flow? [Gap]"

### 5. Exception Conditions

Check whether the docs say when an exception log is required.

Examples:

- "Are exception conditions defined for deferred full E2E, waived gates, or missing sign-off? [Coverage]"
- "Does the contract define the next gate or expiry for each allowed exception? [Clarity]"

### 6. Smoke / Closure / Re-Readiness

If the feature touches a `P0 journey`, the checklist MUST ask about:

- smoke runnable proof
- closure note path
- traceability from journey to task to test to closure
- re-readiness triggers when completion semantics, dependency semantics, permission boundaries, or fixture/environment assumptions change

### 7. Silent Assumption / Silent Scope Growth

The checklist MUST ask whether the docs contain or imply:

- silent assumption
- silent scope growth
- unstated fixture lifecycle
- unstated environment dependency
- module completion without runnable journey proof

## Writing Rules

Every checklist item MUST:

- be phrased as a question about the written requirements
- use a quality dimension marker such as `[Completeness]`, `[Clarity]`, `[Consistency]`, `[Traceability]`, `[Gap]`, `[Assumption]`, `[Conflict]`
- include a reference to a source section where possible
- avoid implementation verbs like `verify click`, `test API`, `confirm render`, or `check code path`

At least **80%** of checklist items MUST include a traceability reference such as:

- `[Spec §X.Y]`
- `[Plan §X.Y]`
- `[Tasks §X.Y]`
- `[Gap]`
- `[Assumption]`
- `[Conflict]`

## Prohibited Anti-Patterns

Do **not** turn the checklist into:

- an implementation test plan
- a QA execution checklist
- a code review template
- a release checklist

Bad:

- "Verify the endpoint returns 200"
- "Test the button click works"
- "Confirm the smoke test passes"

Good:

- "Is the endpoint success and failure contract fully specified? [Completeness]"
- "Is the user-visible success condition for the action explicitly defined? [Clarity]"
- "Does the contract specify what smoke proof is required before closure? [Traceability]"

## Output Format

Use `_bmad/speckit/templates/checklist-template.md` as the canonical structural reference.

Minimum structure:

- H1 title
- purpose / created / feature metadata
- `##` category headings
- checklist items in the form `- [ ] CHK### ...`

## Final Report

When complete, report:

- absolute path to the checklist file
- whether the file was created or appended
- total item count
- checklist mode (`omissions` by default unless user requested another domain)
- whether the checklist includes P0 journey / smoke / closure / re-readiness checks
- any major omission hotspots discovered while generating it
