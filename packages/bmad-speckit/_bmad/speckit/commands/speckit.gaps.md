---
description: Generate or refresh IMPLEMENTATION_GAPS.md by comparing source requirements, spec.md, plan.md, and the current implementation.
handoffs:
  - label: Create Tasks
    agent: speckit.tasks
    prompt: Generate journey-first tasks from the approved IMPLEMENTATION_GAPS.md
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Produce a chapter-by-chapter `IMPLEMENTATION_GAPS.md` that separates `Definition Gap` from `Implementation Gap`, with enough fidelity that `/speckit.tasks` can generate runnable-slice tasks without losing requirement coverage or masking E2E blockers.

## Outline

1. **Setup**: Run `_bmad/speckit/scripts/powershell/check-prerequisites.ps1 -Json` from repo root and parse `FEATURE_DIR` and `AVAILABLE_DOCS`. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g. `'I'\''m Groot'` (or double-quote if possible: `"I'm Groot"`).

2. **Load required artifacts** from `FEATURE_DIR`:
   - **Required**: `plan.md`, `spec.md`
   - **Existing target if present**: `IMPLEMENTATION_GAPS.md` (or latest versioned gaps doc)
   - **Optional supporting artifacts**: `research.md`, `data-model.md`, `quickstart.md`, `contracts/`
   - **Optional split ledgers if present**: `journey-ledger.md`, `invariant-ledger.md`, `trace-map.json`

3. **Load upstream requirement sources**:
   - Use the source requirement documents referenced by `spec.md` and `plan.md`
   - Include any user-supplied reference documents for this run
   - If the feature is a bootstrap scenario, accept `user prompt` or `bootstrap brief` as the requirement source only when that source is explicitly named
   - If no explicit requirement source can be identified, STOP with a blocker

4. **Analyze gaps chapter by chapter**:
   - Compare upstream requirements, `spec.md`, `plan.md`, and the current implementation **chapter by chapter and item by item**
   - For each requirement point, determine:
     - covered
     - partially covered
     - not implemented
     - definition unclear / contradictory
   - Classify every real gap as either:
     - `Definition Gap`
     - `Implementation Gap`
   - Explicitly inspect and record gaps for:
     - `P0 journeys`
     - user-visible completion state
     - smoke proof
     - full E2E proof or deferred reason
     - closure note readiness
     - dependency semantics
     - owner / permission boundaries
     - failure / recovery / rollback / exception boundaries
     - fixture / environment readiness
   - If code exists but the requirement still cannot form a runnable smoke path, record that as a gap
   - If there is no comparable implementation because the feature is pre-implementation bootstrap, record that explicitly instead of inventing fake code drift

5. **Generate or refresh `IMPLEMENTATION_GAPS.md`** using a structure that includes:
   - source requirement inputs
   - analysis mode: `STANDARD` or `PRE_IMPLEMENTATION_BOOTSTRAP`
   - `Gaps 清单（按需求文档章节）`
   - `P0 Journey Gap Summary`
   - `Success / Evidence Gap Summary`
   - `Failure / Recovery / Rollback / Exception Gap Summary`
   - `Fixture / Environment Readiness Gap Summary`
   - `Definition Gap vs Implementation Gap`
   - enough stable Gap IDs and chapter references for downstream task mapping

6. **Stop and report**:
   - output path to the generated gaps document
   - total gap count
   - `Definition Gap` count
   - `Implementation Gap` count
   - number of `P0 journey` blockers
   - whether the result is `STANDARD` or `PRE_IMPLEMENTATION_BOOTSTRAP`
   - next recommended command: `/speckit.tasks`

## Required Blockers

Stop with an explicit blocker if any of the following is true:

- `spec.md` is missing
- `plan.md` is missing
- the upstream requirement source cannot be identified
- the gap analysis would skip chapter-by-chapter comparison
- the output would merge `Definition Gap` and `Implementation Gap` into one generic backlog

Prefer explicit blocker messages such as:

- `Blocked: spec.md is required before IMPLEMENTATION_GAPS.md can be generated.`
- `Blocked: plan.md is required before IMPLEMENTATION_GAPS.md can be generated.`
- `Blocked: an explicit upstream requirement source is required for chapter-by-chapter gap analysis.`
- `Blocked: gap analysis must separate Definition Gap from Implementation Gap.`

## Hard Rules

- `IMPLEMENTATION_GAPS.md` is a **requirements-vs-implementation delta document**, not a generic brainstorming note.
- Every gap row MUST point back to a requirement chapter or equivalent explicit source section.
- A requirement is **not** considered covered merely because a module exists; if the user-visible journey is not runnable, the gap remains open.
- Missing smoke proof, missing closure readiness, missing failure boundaries, or missing fixture/environment assumptions are all real gaps.
- If the issue is unclear or conflicting contract, record it as `Definition Gap`.
- If the issue is missing code path, missing production wiring, missing evidence, or implementation drift, record it as `Implementation Gap`.
- In bootstrap mode, use explicit `N/A (pre-implementation bootstrap)` language instead of pretending code drift exists.

## Output Contract For `IMPLEMENTATION_GAPS.md`

The generated document MUST be strong enough that `/speckit.tasks` can:

- map each gap to concrete task work
- preserve chapter-level requirement traceability
- tell `Definition Gap` tasks from `Implementation Gap` tasks
- see which gaps block `P0 journey` smoke proof
- avoid producing module-complete tasks for a journey that still cannot run end to end

## Governance Note

If repository governance is enforcing `speckit-workflow`, the generated `IMPLEMENTATION_GAPS.md` must next pass the code-review audit gate using `audit-prompts.md` §3 before `/speckit.tasks` is considered complete-ready.

## Context

$ARGUMENTS
