---
name: goal-execution-contract-generator
description: Compile standalone source or confirmed Requirements authorities into a frozen versioned GoalExecutionIR authority and a strict /goal projection. Use when the user asks for a /goal-ready execution contract, strict goal plan, autonomous implementation contract, or docs/plans goal execution document.
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
   - When authoring a new standalone source, start from `references/standalone-source-plan-template.md` and its machine contract `references/standalone-source-plan-profile.json`. Do not improvise a new parser-facing format for each run.
   - Run `bmad-speckit goal-contract lint-source --entry standalone_goal_contract --source <path> --json` before generation. `goal-contract generate` runs the same validator again against the exact source bytes before obligation or constraint allocation.
   - A canonical v1 source uses explicit `standalone-source-plan` metadata and `standalone-source-plan-node` fenced YAML blocks. Human heading text and section order are not parser authority.
   - Run `bmad-speckit goal-contract generate --entry standalone_goal_contract --source <path> --out <path> --json`.
   - Build one immutable `SourceSnapshot` from the exact Source Plan bytes or LF-normalized ordered conversation segments.
   - Freeze the supported `StandaloneGoalSemanticIR` version, run the internal Source Oracle and deterministic semantic validator, and require a hash-bound `StandaloneGoalInternalSemanticGate/v1` pass before execution compilation. Pure generation does not dispatch an external Judge or emit authoring Judge request, response, aggregate, or EffectivePass compatibility artifacts.
   - Require `goalJudgeDispatchCount=0` for pure generation, plus `goalExecutionIRHash`, `standaloneGoalSemanticIrRef`, `standaloneInternalSemanticGateRef`, `goalExecutionIrRef`, `closureRef`, and `activeAuthorityRef` in the JSON result. External Judge counts belong only to the post-execution Final Judge path.
   - Treat `coverageReceiptPath`, `generationReceiptPath`, `sourcePlanHash`, `goalContractHash`, `sourceObligationCount`, and `unmappedSourceObligations: 0` as compatibility generation evidence, not execution authority.
   - Require the coverage receipt before public release use.
   - The installed consumer invocation must work for Codex, Claude Code, and Cursor without host-specific lock-in and without consumer root `scripts/`.
4. Load the contract template and profile only for manual or compatibility contract authoring:
   - In this repository, the canonical assets live under `_bmad/shared/goal-contract/`.
   - In an installed skill, use the skill-local projections under `references/`.
   - Resolve `references/goal-execution-contract-template.md` and `references/goal-contract-profile.json` relative to this skill directory.
   - Resolve the Source Plan producer assets `references/standalone-source-plan-template.md` and `references/standalone-source-plan-profile.json` relative to this skill directory.
   - If the template is missing, stop with `goal_contract_template_missing`.
   - If the profile is missing, continue only for manual contract authoring, and report `goal_contract_profile_missing` as a packaging defect.
5. Run docs-review dependency adaptation only for a non-standalone compatibility workflow that explicitly retains docs-review:
   - Standalone Goal-contract generation MUST NOT install, invoke, or wait for docs-review.
   - For a retained non-standalone workflow, run `node <skill-dir>/scripts/check-docs-review-dependency.js --auto-install`, replacing `<skill-dir>` with this skill's installed directory.
   - If that retained workflow reports `blocked`, stop it with `docs_review_dependency_blocked` and include the reported reason.
6. Generate the contract from the template only when the package CLI is not applicable.
7. Run the contract completeness gate and command portability gate.
8. Do not run any Task 6 authoring Judge. Optional prose review cannot alter frozen authority. The post-execution Task 7C Execution Final Judge and execution EffectivePass remain mandatory and are outside contract generation.
9. Run encoding integrity gate after all text edits.

## Contract Generation Rules

- `bmad-speckit goal-contract generate --entry standalone_goal_contract --source <path> --out <path> --json` is the required success path for source-plan contracts.
- `.tmp/*.cjs generation scripts are failure evidence only`; they are not a success path and must not be cited as successful generation proof.
- `large-document-writer is transport only`; it must not own source-plan obligation extraction, task generation, acceptance generation, command generation, or source coverage semantics.
- Coverage receipt is source coverage evidence only; it is not implementation evidence.
- Code obligations must bind to real implementation proof through behavior tests, source seam static assertions, receipt field assertions, or CLI output assertions.
- Generated commands for code obligations must not use coverage-receipt grep as the only proof.
- Treat Markdown as a human/model-readable projection of the frozen `GoalExecutionIR` version, never semantic or execution authority.
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
- Convert implementation obligations into atomic `G00...GNN` tasks with source-grounded file scopes, steps, validations, and acceptance. Preserve acceptance, conditions and pure boundaries in their own roles; do not invent implementation tasks or commands for every source clause.
- Canonical Source Plan IDs use `REQ|NFR|NEG|OUT|TASK|AC|CMD|EVD|ART|PATH|DEP|STOP-<DOMAIN>-NNN`; only AC may add `-SNN`. `MUST|SHOULD|MAY` are modality values, `NOT DONE` is an OUT projection, and `SRC-*|SPAN-*|source-block-*|clause-*` are provenance only.
- Require explicit `ownerRef` and `requirementRefs` for typed children. A missing or ambiguous PASS/FAIL/BLOCKED/CMD/EVD/ART/PATH/DEP/STOP owner fails with `source_semantic_owner_missing`; adjacency must not create an owner or a synthetic requirement.
- Reject a source prohibition against its authorized Goal contract production as `source_plan_purpose_conflict`. Preserve legitimate business, path, validation, architecture, and conditional prohibitions.
- Standalone Source Plans do not carry `implementationConfirmation`. Six-state and req-trace confirmed-source adapters keep their native confirmation and readiness gates, then deterministically adapt the confirmed typed authority to `CanonicalRequirementGraph/v1`, pass the same canonical graph lint, and invoke the same Goal Execution IR, closure, and projection compiler. They must not parse confirmed-source prose with the standalone fence parser or maintain an entry-local semantic compiler.
- Include direct evidence expectations for every acceptance item.
- Include required commands in executable order.
- Include stop conditions that force `/goal` to stop instead of rewriting the contract.
- Include a clear authority model that separates machine-readable source bindings, machine-readable evidence indexes, human-facing projections, execution evidence, and completion authority.
- Instantiate `Domain-Specific Contract Addenda` only when the goal defines a classifier, state machine, schema, event payload, controlled writer, prompt/compiler output, renderer/report surface, gate, audit, score, or other domain-specific machine contract.
- When `Domain-Specific Contract Addenda` is instantiated, keep it generic to the requested domain and ensure every addendum is referenced by at least one task, one acceptance item, and one acceptance traceability matrix row.
- Do not copy classifier-specific, reconfirmation-specific, renderer-specific, or project-specific addendum content into unrelated contracts.
- Prefer scoped acceptance groups such as `Domain Behavior Acceptance`, `Integration Surface Acceptance`, or `Operational Surface Acceptance` when they make the contract clearer; do not force these group names when the goal is simple.
- If the source is underspecified, generate a contract that stops with the appropriate amendment condition instead of inventing semantic requirements.

## Typed Source And Version Boundary

- Preserve normative, structural, background, example, reference and metadata classifications with original byte spans, exact-text hashes, classification reasons and source relations. Normative headings and explicitly inherited child requirements remain normative; lists and code fences are not automatically commands or obligations.
- Preserve required, forbidden, permitted, preserve and descriptive roles, mixed clauses, conditions, scope, priority and expected outcomes. Do not turn SHOULD/MAY into MUST, negative expected assertion states into forbidden assertion actions, or source-declared commands/evidence into actual run results. Unknown/conflicting semantics need located diagnostics, never a fixture exemption.
- Carry typed task, acceptance, path, command, artifact, evidence, dependency, boundary and co-execution bindings through authority, IR and closure. Build distinct source-grounded `applicableMustRefs`, `applicableAtomRefs` and `premiseRefs`; no default all-to-all arrays. Broad global scope needs explicit source authority.
- `proven` requires verifiable derivation and applicable premises. Never fabricate receipts, generic RED/GREEN proof, tasks or artifacts from target filenames. Empty co-execution/CTM is legal when no co-execution requirement exists; do not add a universal must-link group to satisfy a compiler shape.
- Supported v1 authorities remain readable only where their schema does not depend on the removed standalone authoring Judge protocol. Judge-era standalone request/response/aggregate/EffectivePass artifacts are not runtime authority and have no compatibility reader. New typed v2 may be consumed only by the same-version runtime with supported typed source roles, validators, renderers and closure/partition readers; reject unsupported consumers rather than erase typed fields or relabel v2 as v1. A new encoding needs deterministic decoding, reachability, round-trip semantic equivalence and hash binding.

## Budget And Dispatch Recovery

- Before graph construction, measure relation density and enforce allocation budgets. Measure actual serialized UTF-8 bytes separately for source, normalized candidate, logical authoring request, coverage refs and final adapter prompt/body. Candidate and logical request byte counts are diagnostics, not semantic rejection thresholds: legitimate sparse authority may exceed 1 MiB. Reject only proven structural/resource pathologies (for example non-global full fan-out, superlinear edge growth, or configured local allocation exhaustion); never drop authority fields or summarize scope to pass.
- A clearer overflow rejection alone is not full repair. If faithful sparse content still exceeds a configured local resource budget, require supported lossless normalization with equivalence/hash proof; no unreadable local-path handoff, unsupported gzip, truncation, or external authoring Judge fallback.
- Large v2 candidates may use `GoalSemanticDictionary/v1` only with its exact versioned decoder, full expanded byte/hash verification and supported adapter instructions. Compact node encoding must be explicitly identified; unknown tags, dangling/cyclic/unreachable nodes, expansion overflow and old-reader misinterpretation must fail closed. Machine metadata compression must preserve the original source text and every authority field.
- Pure standalone compilation does not select a provider, construct a Judge transport, create dispatch intent, or write Judge request/response artifacts. Provider field, body, context, and recovery rules apply only when the separate post-execution Final Judge stage is actually invoked.
- The external `1048576` length error's unit remains `unknown` without evidence. It can constrain an active external provider only when that adapter declares or proves the limit; it is never a standalone candidate, semantic IR, coverage receipt, or GoalExecutionIR limit.
- Publish semantic IR, internal gate, GoalExecutionIR, closure, and active authority atomically and idempotently. A failed new candidate must not leave partial authority, and a stale source or hash mismatch must never reuse a prior authority as proof for the changed source.

## Compiler Repair Acceptance

These gates are mandatory when validating repairs to this compiler, not a claim that the current repair has passed:

- Default tests must use the complete frozen real fixture, strict UTF-8, byte length and SHA256, with missing/mismatched input failing rather than skipping. Keep original bytes and source authorization unchanged; resolve needed external inputs with explicit read-only path mappings and do not execute source business commands.
- Independently audit a full-source expected manifest before changing extraction/binding logic; never derive expected from the tested production output. Validate normative coverage, polarity, conditions and typed relations, including exclusions and many-to-many spans; do not rewrite expected to make a test green. Require source evidence and independent review for oracle corrections.
- Retain valid RED then GREEN evidence; reject injected all-to-all relations, missing proof, unrelated commands, flipped prohibitions, deleted dependencies and false must-link groups. Test N/2N/4N fixed-density scaling, real global/shared relations, limit-1/limit/limit+1, ASCII/Chinese/non-BMP, escaping, wrapper/coverage overhead and final-request-only overflow.
- Test zero preflight side effects, repeatable rejection, intent-before/after crash, uncertain send, persisted response without aggregate and same-candidate concurrency. New representations must reject missing/illegal cyclic refs and incompatible readers without losing semantics.
- Separately retain automated regression, actual packaged/installed production-path integration, and governed source-authority evidence. Verify CLI resolution, package/tarball/dist/code hashes and entry/host/stage/authority/run provenance. Live standalone acceptance requires hash-consistent internal gate, IR, closure, active authority, coverage/generation receipts and projection; coverage alone or exit code zero is insufficient.
- Every required route and configured host must meet its own positive, rejection, recovery, install and native audit gates. Missing legal confirmation remains BLOCKED only for confirmed-source routes that require it; standalone generation does not require provider credentials. Do not partition, run Execution Final Judge or execute generated business tasks during compiler acceptance.

## Deterministic Source Gate

Before emitting any generated task, acceptance row, command row, `NOT DONE` row, or stop condition, the generator must fail closed when executable source semantics are nondeterministic. Classify source roles first: an explicit permission, deterministic condition, background statement or example is not an ambiguous MUST and must not be strengthened into one.

The failure payload must use `failureClass: non_deterministic_source_obligation` and must include `sourceId`, `lineStart`, `lineEnd`, `matchedPhrase`, `sourceExcerpt`, and `repairHint`.

Ambiguous executable requirements need a source-authorized deterministic decision before goal generation continues; preserve already explicit permissions, prohibitions and applicability conditions. The generator must not transform nondeterministic source wording into invented execution content.

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

- Resolve "produce or reference artifact" from an explicit source decision; do not turn a source-declared existing artifact into a new production obligation. Missing production/reference authority is a blocking ambiguity.
- Replace "run relevant tests" with the exact command list.
- Replace "sync surfaces" with the exact surface paths and the exact equality or allowed-difference rule.
- Replace "missing core surfaces block" with the exact missing field IDs and blocking state.
- Replace "later/future work" with a deterministic `NOT DONE` row or `blocked_until_<specific_condition>`.

If a deterministic path, command, schema, field, owner, artifact, or acceptance mapping cannot be derived from the source or conversation, do not invent it. Add a stop condition named `blocked_by_contract_ambiguity:<field>` and list the exact missing decision.

## Shared Asset Governance

Inside this repository:

- `_bmad/shared/goal-contract/goal-execution-contract-template.md` is the canonical Markdown template.
- `_bmad/shared/goal-contract/goal-contract-profile.json` is the canonical machine-readable profile.
- `_bmad/shared/goal-contract/standalone-source-plan-template.md` is the canonical standalone Source Plan producer template.
- `_bmad/shared/goal-contract/standalone-source-plan-profile.json` is its machine-readable parser and binding profile.
- `_bmad/shared/goal-contract/scripts/render-goal-contract.js` is the deterministic renderer used by req-trace.
- `_bmad/shared/goal-contract/scripts/verify-goal-contract-profile.js` validates template/profile/lock/reference consistency.
- `_bmad/shared/goal-contract/scripts/verify-standalone-source-plan-profile.js` validates Source Plan schemas, semantic hashes, and installed projection byte equality.

Inside installed skill surfaces:

- `references/goal-execution-contract-template.md` is a projection of the shared canonical template.
- `references/goal-contract-profile.json` is a projection of the shared canonical profile.
- `references/standalone-source-plan-template.md` and `references/standalone-source-plan-profile.json` are byte-identical generated projections of their shared canonical assets.
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
- Every acceptance ID has its source-grounded task/proof bindings and required evidence commands; missing required bindings block, while a pure boundary does not manufacture a task or command.
- Every command is concrete, ordered, and scoped to this repository.
- If `Domain-Specific Contract Addenda` exists, every addendum maps to a task, an acceptance item, and a traceability matrix row.
- No executable contract section contains forbidden vague wording from `Deterministic Requirement Language`.
- Every `MUST`, `MUST NOT`, `NOT DONE`, `EVD`, `ARTIFACT`, `PATH`, `TRACE MATRIX`, and `COMMAND` row has deterministic type-appropriate scope, applicable source-grounded bindings, required proof and pass/block conditions; never fill missing fields with fabricated proof or implementation work.
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

The Source Oracle plus deterministic semantic validator is the only standalone semantic gate before shared Goal Execution IR compilation. This generator MUST NOT dispatch an authoring Judge, emit a compatibility EffectivePass, run an independent semantic audit/fix loop, or maintain a no-gap counter.

Handoff rules:

1. Complete source admission, deterministic completeness, command portability, internal semantic gate, Goal Execution IR closure, and active-authority readback.
2. Optional prose review may inspect the Markdown projection only and must not change semantic IR, Goal Execution IR, binding, closure, or active authority.
3. Any semantic defect requires a new standalone source successor and a fresh deterministic compilation against its new source hash.
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
