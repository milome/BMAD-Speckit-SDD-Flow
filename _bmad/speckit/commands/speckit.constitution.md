---
description: Create or update the project constitution from repository governance policy, risk-tier rules, and journey-first process principles.
handoffs:
  - label: Build Specification
    agent: speckit.specify
    prompt: Implement the feature specification based on the updated constitution. I want to build...
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Purpose

You are creating or updating the project constitution at `.specify/memory/constitution.md`.

In this repository, the constitution is **not** a generic manifesto. It is the top-level governance contract
that anchors:

- risk tier policy
- owner model
- stage done standards
- exception policy
- the rule that `P0 journey runnable` is the primary flow objective

The constitution output must be rooted in `_bmad/_config/speckit-governance.yaml`, not invented from scratch.

## Mandatory Inputs

Load these files before drafting:

1. `_bmad/_config/speckit-governance.yaml`
2. `.specify/memory/constitution.md` if it exists; otherwise use `_bmad/speckit/templates/memory/constitution.md`
3. `_bmad/speckit/templates/plan-template.md`
4. `_bmad/speckit/templates/spec-template.md`
5. `_bmad/speckit/templates/tasks-template.md`
6. `_bmad/cursor/skills/speckit-workflow/references/omissions-pattern-library.md`
   - Fallback: `_bmad/claude/skills/speckit-workflow/references/omissions-pattern-library.md`

If `_bmad/_config/speckit-governance.yaml` is missing or cannot be parsed, stop and report the blocker.

## Required Execution Flow

1. **Load the governance source**
   - Parse `_bmad/_config/speckit-governance.yaml`.
   - Extract the default risk tier, risk tier matrix, owner model, stage done standards, exception policy, and health metric keys.

2. **Load the constitution base**
   - If `.specify/memory/constitution.md` exists, update it in place.
   - If it does not exist, initialize from `_bmad/speckit/templates/memory/constitution.md`.
   - Preserve valid repo-specific technical constraints that are still applicable.
   - Remove or rewrite stale principles that conflict with the governance YAML.

3. **Determine the active governance framing**
   - If the user explicitly requests a risk tier or governance change, honor it.
   - Otherwise use the default tier from `_bmad/_config/speckit-governance.yaml`.
   - If the current constitution already names a stricter tier, keep the stricter rule unless the user explicitly downgrades it.

4. **Rewrite the constitution around non-negotiable process principles**
   - The constitution MUST explicitly state these principles, even if repo-specific principles are also present:
     - `P0 journey runnable` is the primary flow objective.
     - Deep interview is evidence capture, not longer discussion for its own sake.
     - Architecture is key-path plus testability design.
     - Readiness is a blocker gate, not an approval ceremony.
     - Tasks are runnable slices, not module work queues.
     - Silent assumptions and silent scope growth are prohibited.
   - Prefer declarative, testable language: `MUST`, `MUST NOT`, `SHOULD`, `PROHIBITED`.
   - Do not leave generic placeholder values or vague wording such as "best practice", "reasonable", or "as needed" without a hard condition.

5. **Required governance sections**
   - The updated constitution MUST contain sections or explicit subsections covering:
     - Risk Tier Policy
     - Owner Model
     - Stage Done Standards
     - Exception Policy
     - Amendment Process
     - Compliance Review
   - If `docs/reference/speckit-governance.md` or `docs/reference/speckit-done-standards.md` do not yet exist, inline a concise summary sourced from the YAML instead of inventing broken references.

6. **Template consistency propagation**
   - Review `_bmad/speckit/templates/plan-template.md` and make sure the Constitution Check can align with the new governance model.
   - Review `_bmad/speckit/templates/spec-template.md` and ensure it does not silently omit completion states, failure paths, or owner/permission boundaries now mandated by the constitution.
   - Review `_bmad/speckit/templates/tasks-template.md` and ensure it can support runnable slices, evidence types, verification commands, and closure-oriented work.
   - Do not silently claim templates are aligned when they are not. If you are not updating them in the same run, list them as follow-up impact items.

7. **Sync Impact Report**
   - Prepend an HTML comment block at the top of `.specify/memory/constitution.md` containing:
     - version change: old -> new
     - active/default risk tier
     - modified principles
     - added governance sections
     - removed or superseded sections
     - downstream templates reviewed
     - follow-up items still pending

8. **Validation before write-back**
   - No unexplained bracket placeholders remain.
   - Dates use `YYYY-MM-DD`.
   - Version bump rationale matches the actual change scope.
   - The constitution explicitly mentions:
     - risk tier
     - owner model
     - done standard
     - exception policy
     - silent assumption
     - silent scope growth

9. **Write-back**
   - Overwrite `.specify/memory/constitution.md` with the final content.

10. **Final output**
   - Report:
     - new version
     - bump rationale
     - chosen/default risk tier
     - files reviewed for propagation
     - any follow-up files still pending
   - Suggest a commit message.

## Versioning Rules

- **MAJOR**: backward-incompatible governance change, principle removal, or redefinition of what blocks flow progression
- **MINOR**: new governance section, new principle, or material expansion of policy surface
- **PATCH**: wording clarification, typo fix, or non-semantic tightening

If version bump type is ambiguous, explain the reasoning before finalizing.

## Non-Negotiable Constraints

- Do **not** draft a generic constitution disconnected from `_bmad/_config/speckit-governance.yaml`.
- Do **not** weaken the governance language into optional suggestions.
- Do **not** erase repo-specific technical rules unless they are clearly obsolete or in direct conflict with the new governance model.
- Do **not** leave deferred-placeholder phrasing or any similar silent-assumption wording in the final constitution.
