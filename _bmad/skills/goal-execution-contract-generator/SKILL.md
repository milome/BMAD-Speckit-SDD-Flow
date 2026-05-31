---
name: goal-execution-contract-generator
description: Generate strict frozen /goal execution contract documents from conversation requirements or existing requirement documents using the shared goal-contract template projection. Use when the user asks for a /goal-ready execution contract, strict goal plan, autonomous implementation contract, or docs/plans goal execution document; includes docs-review dependency adaptation, auto-install when missing, and audit/fix iteration until 3 consecutive no-gap rounds.
---

# Goal Execution Contract Generator

Create a frozen `/goal` execution contract. This skill only generates and audits the contract document; it must not execute `/goal` or start implementation.

## Workflow

1. Resolve the source:
   - Use the requirement document path provided by the user, or
   - Use the current conversation requirements when no source file is provided.
2. Resolve the output path:
   - Default: `docs/plans/YYYY-MM-DD-<slug>-goal-execution-plan.md`.
   - Use the user-provided path if present.
3. Load the contract template and profile:
   - In this repository, the canonical assets live under `_bmad/shared/goal-contract/`.
   - In an installed skill, use the skill-local projections under `references/`.
   - Resolve `references/goal-execution-contract-template.md` and `references/goal-contract-profile.json` relative to this skill directory.
   - If the template is missing, stop with `goal_contract_template_missing`.
   - If the profile is missing, continue only for manual contract authoring, and report `goal_contract_profile_missing` as a packaging defect.
4. Run docs-review dependency adaptation before writing the contract:
   - Run `node <skill-dir>/scripts/check-docs-review-dependency.js --auto-install`, replacing `<skill-dir>` with this skill's installed directory.
   - If it reports `available` or `installed`, continue.
   - If it reports `blocked`, stop with `docs_review_dependency_blocked` and include the reported reason.
5. Generate the contract from the template.
6. Run the contract completeness gate.
7. Run docs-review audit/fix rounds.
8. Run encoding integrity gate after all text edits.

## Contract Generation Rules

- Treat Markdown as the human/model-readable canonical prose and structure.
- Treat JSON profile as a machine-readable index and compatibility contract only.
- Do not generate the contract from JSON profile alone.
- Do not rewrite the template's static prose unless the user explicitly asks to update the template itself.
- Fill or replace only the dynamic content needed for this concrete goal.
- Preserve the template contract mode:
  - `goalContractVersion: goal-execution-contract/v1`
  - `contractMode: frozen`
  - `rewritePolicy: forbidden`
  - `executionMode: execute_only`
- Do not leave placeholders such as `<...>`, `[TODO]`, `TBD`, or empty hash fields unless the field explicitly allows `none`.
- Convert source requirements into atomic `G00...GNN` tasks with exact file scopes, steps, validations, and acceptance.
- Include direct evidence expectations for every acceptance item.
- Include required commands in executable order.
- Include stop conditions that force `/goal` to stop instead of rewriting the contract.
- Include a clear authority model that separates machine-readable authority, human-facing projections, execution evidence, and completion authority.
- Instantiate `Domain-Specific Contract Addenda` only when the goal defines a classifier, state machine, schema, event payload, controlled writer, prompt/compiler output, renderer/report surface, gate, audit, score, or other domain-specific machine contract.
- When `Domain-Specific Contract Addenda` is instantiated, keep it generic to the requested domain and ensure every addendum is referenced by at least one task, one acceptance item, and one acceptance traceability matrix row.
- Do not copy classifier-specific, reconfirmation-specific, renderer-specific, or project-specific addendum content into unrelated contracts.
- Prefer scoped acceptance groups such as `Domain Behavior Acceptance`, `Integration Surface Acceptance`, or `Operational Surface Acceptance` when they make the contract clearer; do not force these group names when the goal is simple.
- If the source is underspecified, generate a contract that stops with the appropriate amendment condition instead of inventing semantic requirements.

## Deterministic Requirement Language

Generate every executable contract item with deterministic wording. The generated document must let another model parse exact obligations without inferring intent from prose.

Apply this rule to every:

- `MUST`
- `MUST NOT`
- `NOT DONE`
- `EVD`
- `ARTIFACT`
- `PATH`
- `TRACE MATRIX`
- `COMMAND`
- task step
- acceptance checklist row
- completion evidence item
- stop condition

Required wording:

- Use one obligation per sentence or bullet.
- Name exact IDs, files, directories, artifacts, schemas, fields, commands, hashes, gates, scripts, and acceptance rows.
- State who owns the action, where the output is written, what exact value or condition must be true, and which command proves it.
- Use `none` only when the template or source explicitly permits no value.
- Use `blocked_until_<specific_condition>` for unavailable work, not "future", "later", or "optional".
- For any excluded scope, write a deterministic `NOT DONE` row with the excluded action, excluded path or surface, and the reason.
- For every artifact, state the exact path, required fields, hash expectation, producer, and consuming gate.
- For every command, provide the exact command line, working directory assumption, expected pass condition, and the acceptance IDs it proves.
- For every trace matrix row, map exact task IDs to exact acceptance IDs and exact evidence commands or artifact paths.

Forbidden wording in executable contract sections:

- "reference"
- "refer to"
- "optional"
- "as needed"
- "if possible"
- "where appropriate"
- "where applicable" unless followed by a deterministic applicability condition
- "consider"
- "may consider"
- "should consider"
- "can be"
- "exists or is referenced"
- "exists or referenced"
- "produce or reference"
- "future"
- "later"
- "follow-up" unless it appears in a `NOT DONE` row
- "TBD"
- "TODO"
- "etc."
- "and so on"
- "similar"
- "roughly"
- "generally"
- "recommended" unless a single selected recommendation is also written as a MUST

If source text contains vague wording, normalize it before writing the contract:

- Replace "produce or reference artifact" with "produce artifact at `<exact-path>` and validate `<exact-hash-field>`".
- Replace "run relevant tests" with the exact command list.
- Replace "sync surfaces" with the exact surface paths and the exact equality or allowed-difference rule.
- Replace "missing core surfaces block" with the exact missing field IDs and blocking state.
- Replace "later/future work" with a deterministic `NOT DONE` row or `blocked_until_<specific_condition>`.

If a deterministic path, command, schema, field, owner, artifact, or acceptance mapping cannot be derived from the source or conversation, do not invent it. Add a stop condition named `blocked_by_contract_ambiguity:<field>` and list the exact missing decision.

## Shared Asset Governance

Inside this repository:

- `_bmad/shared/goal-contract/goal-execution-contract-template.md` is the canonical Markdown template.
- `_bmad/shared/goal-contract/goal-contract-profile.json` is the canonical machine-readable profile.
- `_bmad/shared/goal-contract/scripts/render-goal-contract.js` is the deterministic renderer used by req-trace.
- `_bmad/shared/goal-contract/scripts/verify-goal-contract-profile.js` validates template/profile/lock/reference consistency.

Inside installed skill surfaces:

- `references/goal-execution-contract-template.md` is a projection of the shared canonical template.
- `references/goal-contract-profile.json` is a projection of the shared canonical profile.
- The skill may use these local projections when `_bmad/shared/goal-contract` is unavailable.

If the shared canonical template changes, update the skill references from the shared assets and rerun the shared verifier before packaging or installing surfaces.

## Contract Completeness Gate

Before docs-review, verify the generated document contains all sections from the template:

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

Also verify:

- Front matter has no unresolved placeholders.
- `taskRange` matches implemented task IDs.
- `acceptanceRange` matches checklist or matrix IDs.
- Every task has `Purpose`, `Files`, `Steps`, `Validation`, and `Acceptance`.
- Every acceptance ID maps to at least one task and one evidence command.
- Every command is concrete, ordered, and scoped to this repository.
- If `Domain-Specific Contract Addenda` exists, every addendum maps to a task, an acceptance item, and a traceability matrix row.
- No executable contract section contains forbidden vague wording from `Deterministic Requirement Language`.
- Every `MUST`, `MUST NOT`, `NOT DONE`, `EVD`, `ARTIFACT`, `PATH`, `TRACE MATRIX`, and `COMMAND` row has deterministic owner, path or target, proof command or artifact, and pass/block condition.
- Every unavailable or out-of-scope item is expressed as either `blocked_until_<specific_condition>` or a deterministic `NOT DONE` row.

If any check fails, fix the contract before starting docs-review rounds.

## Docs-Review Audit Loop

Use the installed `docs-review` skill in local review mode. If the current host cannot invoke `$docs-review` directly after auto-install, read the returned `SKILL.md` path from the dependency script and apply its local review workflow manually.

Loop rules:

1. Run docs-review against the generated contract.
2. If docs-review reports issues, fix them immediately.
3. After any fix, reset the consecutive no-gap counter to `0`.
4. If docs-review reports no issues, increment the consecutive no-gap counter.
5. Stop only after `3` consecutive no-gap rounds.

Treat any style, clarity, structure, command-order, or readability issue as a gap. Do not waive docs-review findings unless the finding conflicts with frozen `/goal` contract semantics; if there is a conflict, keep the contract semantics and document the waived docs-review issue in the final response.

## Required Commands

Use PowerShell 7 on Windows:

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node <skill-dir>/scripts/check-docs-review-dependency.js --auto-install }"
```

Run the project encoding gate before and after Markdown/skill edits when available:

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

## Final Response

Report:

- Generated contract path.
- Source path or conversation-derived source summary.
- docs-review dependency status.
- docs-review rounds and whether 3 consecutive no-gap rounds were achieved.
- Encoding gate result.
- Any residual risks or blocked conditions.
