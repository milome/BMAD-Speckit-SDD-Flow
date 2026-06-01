---
name: multi-view-doc-review-loop
description: Run a closed-loop multi-agent audit for goal execution contracts, requirements contracts, implementation plans, and handoff documents. Use three parallel perspectives to check goal semantics, execution determinism, acceptance completeness, modification paths, and project best-practice compliance, then centralize fixes and re-review until no material issues remain.
---

# Multi-View Doc Review Loop

Use this skill to audit execution-critical documents that another agent or developer must follow without ambiguity.

This is an orchestration skill. Do not duplicate the full rules from `grill-with-docs` or `docs-review`; invoke them when their specific capabilities are needed.

## Core Rule

Run three independent review perspectives, make all edits in the main session, then send the updated diff back for re-review. Repeat until every perspective returns `No material issues found` or the loop reaches the iteration limit.

## Main Agent Orchestration Control

The Main Agent owns the full control loop. Subagents provide read-only findings only.

- Main Agent dispatches each review round, names the three perspectives, and records the target file set, diff, or PR under review.
- Main Agent requires every subagent to return findings to the main Agent; subagents must not patch files, stage files, commit files, run final verification, or declare completion.
- Main Agent merges findings, deduplicates overlaps, decides whether each issue is accepted, rejected, or blocked by a user decision, and updates the disposition table.
- Main Agent applies all allowed fixes in the main session after merging findings.
- Main Agent resumes the loop after fixes by sending the updated diff and disposition table back to all three perspectives.
- Main Agent halts the loop when a required user decision is unresolved, repository evidence contradicts the requested contract, three full review rounds have completed with remaining material issues, or every perspective returns `No material issues found`.
- Main Agent performs the final verification commands, checks encoding integrity when text files changed, and writes the final response with round count, fixed issues, unresolved risks, and evidence.

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

## Loop Workflow

1. Identify the review target: files, diff, pasted content, or PR.
2. Determine whether the user asked for `review only` or `review and fix`.
3. If key context is missing and cannot be found by scanning the repository, ask one focused question before starting.
4. Dispatch three subagents in parallel, one per perspective.
5. Require subagents to read only and produce issues; they must not edit files.
6. Merge findings in the main session.
7. Deduplicate overlapping issues and preserve the strongest evidence.
8. Mark issues that require user decisions.
9. If a user decision is required, ask one question at a time, following `grill-with-docs`.
10. Apply fixes only from the main session when fixing is allowed.
11. Send the updated diff and disposition table back to all three perspectives.
12. Continue until all perspectives return `No material issues found` or three full review rounds have completed.

## Subagent Output Format

Require every subagent to use this format:

```markdown
## Perspective
Goal Semantics and Boundaries | Execution Determinism and Acceptance | Change Path and Project Practice

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

Stop successfully when all three perspectives return `No material issues found`.

Stop with residual risks when:

- Three full review rounds have completed and material issues remain.
- A required user decision is still unresolved.
- Repository evidence contradicts the requested contract and cannot be reconciled safely.
- The target document is missing required context and the context cannot be inferred.

In the final response, report the number of review rounds, the issues fixed, unresolved risks, and verification evidence.
