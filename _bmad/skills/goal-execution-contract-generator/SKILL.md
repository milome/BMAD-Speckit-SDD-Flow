---
name: goal-execution-contract-generator
description: Compile standalone source or confirmed Requirements authorities into a frozen GoalExecutionIR/v1 authority and a strict /goal projection. Use when the user asks for a /goal-ready execution contract, strict goal plan, autonomous implementation contract, or docs/plans goal execution document.
---

# Goal Execution Contract Generator

Create a frozen `/goal` execution authority and projection. This skill compiles and audits Task 6 artifacts; it must not partition, activate, or execute `/goal`.

## Workflow

1. Resolve the source:
   - Use the requirement document path provided by the user, or
   - Use the current conversation requirements when no source file is provided.
2. Resolve the output path:
   - Default: `docs/plans/YYYY-MM-DD-<slug>-goal-execution-plan.md`.
   - Use the user-provided path if present.
3. For source-plan goal contracts, use the first-class package CLI:
   - Run `bmad-speckit goal-contract generate --entry standalone_goal_contract --source <path> --out <path> --json`.
   - Build one immutable `SourceSnapshot` from the exact Source Plan bytes or LF-normalized ordered conversation segments.
   - Freeze `StandaloneGoalSemanticIR/v1`, dispatch exactly one `goal_full` authoring Judge, and require `StandaloneGoalAuthoringEffectivePass/v1` before execution compilation.
   - Require `goalJudgeDispatchCount=1`, `goalExecutionIRHash`, `standaloneGoalSemanticIrRef`, `standaloneAuthoringEffectivePassRef`, `goalExecutionIrRef`, `closureRef`, and `activeAuthorityRef` in the JSON result.
   - Treat `coverageReceiptPath`, `generationReceiptPath`, `sourcePlanHash`, `goalContractHash`, `sourceObligationCount`, and `unmappedSourceObligations: 0` as compatibility generation evidence, not execution authority.
   - Require the coverage receipt before public release use.
   - The installed consumer invocation must work for Codex, Claude Code, and Cursor without host-specific lock-in and without consumer root `scripts/`.
4. Load the contract template and profile only for manual or compatibility contract authoring:
   - In this repository, the canonical assets live under `_bmad/shared/goal-contract/`.
   - In an installed skill, use the skill-local projections under `references/`.
   - Resolve `references/goal-execution-contract-template.md` and `references/goal-contract-profile.json` relative to this skill directory.
   - If the template is missing, stop with `goal_contract_template_missing`.
   - If the profile is missing, continue only for manual contract authoring, and report `goal_contract_profile_missing` as a packaging defect.
5. Run docs-review dependency adaptation only for a non-standalone compatibility workflow that explicitly retains docs-review:
   - Standalone Goal-contract generation MUST NOT install, invoke, or wait for docs-review.
   - For a retained non-standalone workflow, run `node <skill-dir>/scripts/check-docs-review-dependency.js --auto-install`, replacing `<skill-dir>` with this skill's installed directory.
   - If that retained workflow reports `blocked`, stop it with `docs_review_dependency_blocked` and include the reported reason.
6. Generate the contract from the template only when the package CLI is not applicable.
7. Run the contract completeness gate and command portability gate.
8. Do not run a second Task 6 authoring semantic Judge or authoring EffectivePass after the CLI succeeds; optional prose review cannot alter frozen authority. The post-execution Task 7C Execution Final Judge and execution EffectivePass remain mandatory and are not this authoring review.
9. Run encoding integrity gate after all text edits.

## Contract Generation Rules

- `bmad-speckit goal-contract generate --entry standalone_goal_contract --source <path> --out <path> --json` is the required success path for source-plan contracts.
- `.tmp/*.cjs generation scripts are failure evidence only`; they are not a success path and must not be cited as successful generation proof.
- `large-document-writer is transport only`; it must not own source-plan obligation extraction, task generation, acceptance generation, command generation, or source coverage semantics.
- Coverage receipt is source coverage evidence only; it is not implementation evidence.
- Code obligations must bind to real implementation proof through behavior tests, source seam static assertions, receipt field assertions, or CLI output assertions.
- Generated commands for code obligations must not use coverage-receipt grep as the only proof.
- Treat Markdown as a human/model-readable `GoalExecutionIR/v1` projection, never semantic or execution authority.
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
- Include a clear authority model that separates machine-readable source bindings, machine-readable evidence indexes, human-facing projections, execution evidence, and completion authority.
- Instantiate `Domain-Specific Contract Addenda` only when the goal defines a classifier, state machine, schema, event payload, controlled writer, prompt/compiler output, renderer/report surface, gate, audit, score, or other domain-specific machine contract.
- When `Domain-Specific Contract Addenda` is instantiated, keep it generic to the requested domain and ensure every addendum is referenced by at least one task, one acceptance item, and one acceptance traceability matrix row.
- Do not copy classifier-specific, reconfirmation-specific, renderer-specific, or project-specific addendum content into unrelated contracts.
- Prefer scoped acceptance groups such as `Domain Behavior Acceptance`, `Integration Surface Acceptance`, or `Operational Surface Acceptance` when they make the contract clearer; do not force these group names when the goal is simple.
- If the source is underspecified, generate a contract that stops with the appropriate amendment condition instead of inventing semantic requirements.

## Deterministic Source Gate

Before emitting any generated task, acceptance row, command row, `NOT DONE` row, or stop condition, the generator must fail closed when a source plan contains nondeterministic executable wording.

The failure payload must use `failureClass: non_deterministic_source_obligation` and must include `sourceId`, `lineStart`, `lineEnd`, `matchedPhrase`, `sourceExcerpt`, and `repairHint`.

The source plan must be repaired to deterministic `MUST` or `MUST NOT` language before goal generation continues. The generator must not transform nondeterministic source wording into generated execution content.

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

If any check fails, fix the contract before delegating review convergence.

## Command Portability Gate

Run command portability checks before freezing the first semantic-review hash and after every command-text repair.

- On Windows, run `node <skill-dir>/scripts/check-contract-command-portability.js --target <path> --shell pwsh --json`.
- Treat any non-zero result as a generation blocker. Fix every reported occurrence in one batch before semantic review or promotion.
- Reject unquoted Git extended revision expressions such as `git rev-parse HEAD^{tree}` in PowerShell contracts. Require `git rev-parse "HEAD^{tree}"` or an equivalent quoted revision argument.
- Smoke-test read-only commands in their declared shell when repository state permits. Do not execute mutating, destructive, credentialed, release, commit, push, or deployment commands during contract generation.
- Record the target hash and portability receipt with the deterministic completeness evidence so a later docs-review cannot discover the same command defect after semantic convergence.

## Review Boundary

The CLI's single `goal_full` authoring Judge is the only standalone semantic review before shared Goal Execution IR compilation. This generator MUST NOT run an independent semantic audit/fix loop, repeat EffectivePass, or maintain a no-gap counter.

Handoff rules:

1. Complete source admission, deterministic completeness, command portability, the single authoring Judge, Goal Execution IR closure, and active-authority readback.
2. Optional prose review may inspect the Markdown projection only and must not change semantic IR, Goal Execution IR, binding, closure, or active authority.
3. Any semantic defect requires a new standalone source successor and a new single authoring Judge pass.
4. Preserve any existing final docs-review only for unrelated documentation workflows.

Treat standalone style, clarity, structure, command-order, or readability defects as deterministic or three-perspective audit findings. Do not create a second audit loop for them.

## Required Commands

For retained non-standalone docs-review workflows only, use PowerShell 7 on Windows:

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node <skill-dir>/scripts/check-docs-review-dependency.js --auto-install }"
```

Run the command portability gate before semantic review and after command-text changes:

```powershell
pwsh.exe -NoLogo -NoProfile -Command "& { node <skill-dir>/scripts/check-contract-command-portability.js --target <path> --shell pwsh --json }"
```

Run the project encoding gate before and after Markdown/skill edits when available:

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

## Final Response

Report:

- Generated contract path.
- Source path or conversation-derived source summary.
- Standalone docs-review status `not_required`, or the retained non-standalone dependency status.
- Command portability gate result.
- Audit epoch count, reviewed target hash, required perspective receipts, and selective carry-forward decisions.
- Standalone latest-hash three-perspective result, or the retained non-standalone final docs-review result.
- Encoding gate result.
- Any residual risks or blocked conditions.

## Large Document Writer Integration

- Deterministic renderer output uses `safeWriteText()` for final document persistence.
- For LLM-authored or stream-risk contract bodies that exceed the large-document threshold, use a `large-document-writer` draft session before final promotion.
- `large-document-writer` must not generate goal tasks, acceptance IDs, trace rows, commands, stop conditions, docs-review fixes, or goal contract semantic content.
