---
name: multi-view-doc-review-loop
description: Use when an execution-critical contract, implementation plan, requirements document, or handoff needs multi-perspective audit and reliable convergence.
---

# Multi-View Doc Review Loop

Use this skill to audit execution-critical documents that another agent or developer must follow without ambiguity.

This is an orchestration skill. Do not duplicate the full rules from `grill-with-docs` or `docs-review`; invoke them when their specific capabilities are needed.

## Core Rule

Use one hash-bound convergence controller. Run the required independent perspectives once against a frozen target, batch fix accepted findings, and selectively revalidate only perspectives invalidated by the change. Do not stack an independent docs-review loop on top.

## Main Agent Orchestration Control

The Main Agent owns the full control loop. Subagents provide read-only findings only.

- Main Agent dispatches each review round, names the three perspectives, and records the target file set, diff, or PR under review.
- Main Agent requires every subagent to return findings to the main Agent; subagents must not patch files, stage files, commit files, run final verification, or declare completion.
- Main Agent merges findings, deduplicates overlaps, decides whether each issue is accepted, rejected, or blocked by a user decision, and updates the disposition table.
- Main Agent MUST NOT edit the target while an audit epoch is frozen or reviewing.
- Main Agent applies one batch fix in the main session only after the active epoch closes.
- Main Agent computes the changed semantic slices and revalidates only perspectives selected by the Selective Revalidation Matrix.
- Main Agent allows at most two audit epochs in one convergence cycle: one initial epoch and one repair epoch.
- Main Agent uses one wait deadline of `180000` milliseconds. If a required reviewer misses the deadline, the Main Agent performs that perspective locally against the same target hash instead of waiting again.
- After any required reviewer times out once, keep that perspective local for the remainder of the convergence run; do not redispatch it in later epochs or internal cycles.
- Existing user authorization remains valid across internal convergence cycles until convergence succeeds or a real user decision, destructive approval, missing capability, credential requirement, or directly conflicting user change blocks progress.
- A two-epoch cycle boundary is internal bookkeeping, not a user-facing stop condition. If deterministic repairs remain after epoch 2, close the cycle and immediately start the next internal cycle under the existing authorization.
- Main Agent halts only when a required user decision is unresolved, repository evidence contradicts the requested contract, an external capability is unavailable, a directly conflicting user change appears, or all required latest-hash receipts pass.
- Main Agent performs the final verification commands, checks encoding integrity when text files changed, and writes the final response with round count, fixed issues, unresolved risks, and evidence.

## Audit Snapshot Barrier

Before dispatch, create an audit binding containing:

```yaml
auditEpochId: unique_epoch_id
targetPath: repository_relative_path
targetHash: lowercase_sha256_of_exact_target_bytes
sourceHash: source_hash_or_none
repositoryIdentity: current_repository_identity
state: frozen
```

- Every reviewer request and receipt MUST carry `auditEpochId` and `targetHash`.
- Reviewers verify the target hash before reading and before returning a verdict.
- A hash mismatch sets the epoch to `superseded`; cancel or ignore outstanding work and do not wait for its verdict.
- Receipts from different epochs or target hashes MUST NOT be combined.
- Non-mutating checks may run in parallel. Any target edit requires closing or superseding the epoch first.

## Scope

Use for:

- Goal execution contracts
- Requirements contracts
- Implementation plans
- Handoff documents
- Agent task protocols
- Review checklists that drive execution

Do not use this skill for pure prose polish unless the document also controls execution.

## Review Perspectives

### 1. Goal Semantics and Boundaries

Use `grill-with-docs` behavior for domain challenge and terminology sharpening.

Check:

- The goal is explicit, stable, and not silently changing across sections.
- Scope, non-goals, assumptions, and constraints are stated.
- Terms match the repository's glossary, context docs, ADRs, rules, and existing code.
- Business decisions are not hidden inside implementation wording.
- Any ambiguous term has one canonical meaning.
- Any contradiction with project documentation or code is surfaced.

Primary question: does the contract describe the right goal with precise boundaries?

### 2. Execution Determinism and Acceptance

Treat this as the primary perspective.

Check:

- Steps are ordered and executable without asking the user again.
- Each step has clear inputs, outputs, and completion criteria.
- Required commands, checks, and evidence are concrete.
- Acceptance criteria are complete, objective, and verifiable.
- If new tests are required, the contract also lists every related existing test suite that must pass; "new tests pass" alone is not sufficient.
- Blocking conditions and decision points are explicit.
- Failure handling and residual-risk reporting are defined.
- The document avoids vague verbs such as "improve", "handle", "verify", or "ensure" unless it defines observable evidence.

Primary question: can another agent execute this contract reliably without guessing?

### 3. Change Path and Project Practice

Use `docs-review` only as a final readability and style check where wording affects execution.

Check:

- Modification paths are complete, accurate, and repository-relative.
- Source rules, generated surfaces, consumer surfaces, tests, fixtures, and temporary files are distinguished.
- The proposed edit locations follow project conventions and best practices.
- Required quality gates, encoding gates, associated existing tests, new tests, CI checks, and review steps are named.
- Script creation, generated-surface, install-surface, and release constraints are respected.
- Examples, commands, and paths are runnable in the target environment.
- Headings, lists, and references make the execution path easy to follow.

Primary question: does the contract point to the right files and enforce the right engineering constraints?

## Convergence Workflow

1. Identify the review target: files, diff, pasted content, or PR.
2. Determine whether the user asked for `review only` or `review and fix`.
3. If key context is missing and cannot be found by scanning the repository, ask one focused question before starting.
4. Run deterministic structure, placeholder, identifier, reference, hash, and applicable command-portability checks before model review.
5. Freeze epoch 1 and dispatch the required perspectives in parallel against one `targetHash`.
6. Wait once for at most `180000` milliseconds; perform any timed-out required perspective locally against the frozen target.
7. Merge and deduplicate findings, then close epoch 1.
8. Mark findings as accepted, rejected with evidence, or blocked by a user decision.
9. Apply one batch fix in the main session when fixing is allowed.
10. Compute changed semantic slices and select invalidated perspectives with the Selective Revalidation Matrix.
11. If no perspective is invalidated, rerun deterministic checks and continue to final docs-review.
12. Otherwise freeze epoch 2 and run only invalidated perspectives against the new hash.
13. If epoch 2 still has a deterministically repairable Blocker or Major issue, close the current internal cycle, batch all known occurrences into one repair, and start the next internal cycle without asking the user to continue.
14. Run a single final docs-review as a leaf readability and command-order check.
15. If docs-review changes governed semantics, commands, authority, scope, acceptance, or modification paths, start the next internal convergence cycle under the existing user authorization; ask the user only when the finding requires a real decision or approval. Otherwise rerun deterministic checks and finish.

## Selective Revalidation Matrix

| Changed slice | Required revalidation |
|---|---|
| Formatting, spelling, heading, table layout | Deterministic checks and single final docs-review |
| File paths, commands, tests, execution order | Execution Determinism; Change Path |
| Acceptance, evidence, traceability | Goal Semantics; Execution Determinism |
| Goal, scope, non-goal, authority | All three perspectives |
| Schema, release, installation, security boundary | Execution Determinism; Change Path; Goal Semantics when behavior or authority changes |
| Unknown or unprovable impact | All three perspectives |

An unaffected perspective may carry forward only when the receipt records the previous hash, current hash, changed slices, governed slices, and a deterministic preservation reason.

## Subagent Output Format

Require every subagent to use this format:

```markdown
## Perspective
Goal Semantics and Boundaries | Execution Determinism and Acceptance | Change Path and Project Practice

## Audit Binding
auditEpochId: ...
targetHash: ...

## Issues
**Issue 1: [Brief title]**
File: path
Line: X
Severity: Blocker | Major | Minor
Evidence: ...
Why it matters: ...
Recommended fix: ...

## Questions
- None

## Verdict
Needs changes | No material issues found
```

If there are no issues, the subagent must still output `## Verdict` with `No material issues found`.

## Severity Rules

- `Blocker`: The contract can cause the executor to pursue the wrong goal, edit the wrong files, fail acceptance, or violate a hard project rule.
- `Major`: The contract can cause guessing, rework, missed checks, incomplete implementation, or hidden decision dependencies.
- `Minor`: The contract has clarity, structure, or style problems that do not block execution but would improve reliability.

## Main Session Disposition Table

Maintain this table after merging findings:

```markdown
| ID | Perspective | Severity | File | Issue | Action | Status |
|----|-------------|----------|------|-------|--------|--------|
| G1 | Goal Semantics | Major | docs/example.md | Scope is ambiguous | Rewrote scope and non-goals | Ready for re-review |
```

Use stable IDs:

- `G*` for goal semantics and boundaries.
- `E*` for execution determinism and acceptance.
- `P*` for change path and project practice.

## Fixing Rules

- Edit only in the main session.
- Do not let subagents patch files.
- Prefer precise contract wording over broad prose.
- Replace ambiguity with observable criteria.
- Keep acceptance criteria testable.
- Keep paths repository-relative unless the user explicitly asks for absolute paths.
- Preserve existing project style unless it conflicts with execution clarity.

## Stop Conditions

Stop successfully when deterministic checks pass, every required perspective has a PASS receipt for the latest hash or a valid selective carry-forward receipt, no Blocker or Major remains, the single final docs-review is resolved, and encoding verification passes.

Stop with residual risks when:

- A required user decision is still unresolved.
- Repository evidence contradicts the requested contract and cannot be reconciled safely.
- The target document is missing required context and the context cannot be inferred.
- An audit target changes while frozen and the replacement hash cannot be established.
- The same material blocker persists across three internal cycles without a deterministic repair and cannot progress without user input or an external-state change.

In the final response, report epoch IDs, latest target hash, required and carried-forward perspectives, timeout takeovers, issues fixed, the single final docs-review result, unresolved risks, and verification evidence.
