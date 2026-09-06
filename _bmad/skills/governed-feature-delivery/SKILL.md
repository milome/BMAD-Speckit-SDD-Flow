---
name: governed-feature-delivery
description: Use when a feature spans multiple phases or pull requests, resumes after interruption, has expensive validation evidence, or risks scope drift, stale handoffs, upstream regression, or later-phase work entering the current PR.
---

# Governed Feature Delivery

## Overview

Coordinate existing engineering skills around immutable, hash-linked execution checkpoint revisions. Recover by replaying canonical evidence, not conversation memory; keep stable design separate from phase plans; keep one phase in one PR.

## Route

Use for multi-phase or multi-PR work, shared contracts or protected surfaces, interruption recovery, expensive gates, scope drift, or uncertain next actions. Use the repository's lightweight workflow for a local single-phase change with direct validation.

## Required Sub-Skills

Invoke, but do not duplicate, the applicable workflow: `superpowers:brainstorming` for ambiguity; `superpowers:writing-plans` for phase plans; `superpowers:executing-plans` for implementation; `superpowers:using-git-worktrees` for isolation; `superpowers:test-driven-development` for behavior changes; and the review, verification, and finishing skills for closeout. Delegate public npm releases to `npm-public-release`. Record an equivalent fallback when a named skill is unavailable.

## Workflow

1. **Recover.** Validate the latest checkpoint. If absent, create a recovery receipt under the authority order in [verification-tiers.md](references/verification-tiers.md), initialize from it, and replay only hash-bound receipts in state order. Conflicts halt; summaries and conversation memory have no authority.
2. **Freeze.** Hash the stable design, external successor policy, and repository authority policy, then obtain an authorized external design-freeze receipt. Read [phase-planning.md](references/phase-planning.md).
3. **Initialize.** Use the repository-approved evidence directory. If none is defined, use `.artifacts/governed-feature-delivery/<feature-id>/<phase-id>/`. Initialize with the design, freeze receipt, phase plan, scope manifest, and successor policy.
4. **Execute one phase.** Use the selected plan, worktree, and TDD workflows. Stop on unauthorized scope and apply [scope-change-control.md](references/scope-change-control.md).
5. **Close the phase.** Create gate evidence with `record-gate-evidence.mjs`; each gate may advance the checkpoint to the actual current HEAD. Before review, run `attest-scope.mjs` to prove every committed path between `baseSha` and `headSha` matches `allowedPaths` and no protected or forbidden pathspec. If a committed in-scope change occurs from `GREEN_CONFIRMED` through `PR_GREEN`, run `reset-execution-gates.mjs` from the latest checkpoint and replay RED, GREEN, stop gates, attestation, and review. Advance each state with `advance-execution-checkpoint.mjs`. Apply [verification-tiers.md](references/verification-tiers.md).
   The validator treats a scope delta as legal only from `PHASE_PLANNED`, `RED_CONFIRMED`, `GREEN_CONFIRMED`, or `STOP_GATE_GREEN`; a changed descendant HEAD after `GREEN_CONFIRMED` must be reset and replayed before the stop gate. It also verifies each revision appends exactly one history event and applies one cumulative budget with realpath caches to artifact hashing and JSON reads while replaying lineage.
6. **Advance.** Merge only the active phase. Advance from `MERGED` with an authorized exact successor signal to `NEXT_PHASE` or `RELEASED`, then follow [branch-and-pr-topology.md](references/branch-and-pr-topology.md).

## State Machine

```text
DISCOVERED
-> SPEC_FROZEN
-> PHASE_PLANNED
-> RED_CONFIRMED
-> GREEN_CONFIRMED
-> STOP_GATE_GREEN
-> REVIEWED
-> PR_GREEN
-> MERGED
-> NEXT_PHASE | RELEASED

Scope delta: PHASE_PLANNED | RED_CONFIRMED | GREEN_CONFIRMED | STOP_GATE_GREEN -> PHASE_PLANNED
Committed gate replay: GREEN_CONFIRMED | STOP_GATE_GREEN | REVIEWED | PR_GREEN -> PHASE_PLANNED
```

Move upstream only on an exact code in the frozen, hash-bound `successorPolicy.allowedCodes`. `NEXT_PHASE` targets the exact next phase id; `RELEASED` targets the literal `RELEASED`. Each phase has one generation; every write creates a new hash-linked revision. Seal a generation instead of editing or reusing it.

## Checkpoint Commands

```powershell
node <skill>/scripts/hash-checkpoint-input.mjs --kind file --input <design.md> --repo <repo>
node <skill>/scripts/hash-checkpoint-input.mjs --kind policy --input <successor-policy.json> --repo <repo>
node <skill>/scripts/hash-checkpoint-input.mjs --kind authority --input <authority-policy.json> --repo <repo>
node <skill>/scripts/init-execution-checkpoint.mjs --out <checkpoint-r1.json> --feature-id <id> --phase-id <id> --spec <design.md> --freeze-receipt <freeze.json> --plan <phase-plan.md> --scope <scope.json> --successor-policy <policy.json> --authority-policy <authority.json> --repo <repo>
node <skill>/scripts/prepare-execution-checkpoint.mjs --checkpoint <discovered.json> --out <frozen.json> --to-state SPEC_FROZEN --spec <design.md> --successor-policy <policy.json> --freeze-receipt <freeze.json> --authority-policy <authority.json> --repo <repo>
node <skill>/scripts/validate-execution-checkpoint.mjs --checkpoint <checkpoint-r1.json> --repo <repo>
node <skill>/scripts/record-gate-evidence.mjs --checkpoint <checkpoint-r1.json> --out <red.json> --id <id> --kind acceptance-red --status confirmed --command "<exact command>" --receipt <receipt.log> --repo <repo>
node <skill>/scripts/advance-execution-checkpoint.mjs --checkpoint <checkpoint-r1.json> --out <checkpoint-r2.json> --to-state RED_CONFIRMED --evidence <red.json> --repo <repo>
node <skill>/scripts/attest-scope.mjs --checkpoint <stop-green.json> --out <scope-attestation.json> --repo <repo>
node <skill>/scripts/advance-execution-checkpoint.mjs --checkpoint <stop-green.json> --out <reviewed.json> --to-state REVIEWED --scope-attestation <scope-attestation.json> --reviewer <reviewer.json> --repo <repo>
node <skill>/scripts/apply-scope-delta.mjs --checkpoint <checkpoint.json> --out <next.json> --scope <scope.json> --plan <plan.md> --delta <approved-delta.json> --repo <repo>
node <skill>/scripts/reset-execution-gates.mjs --checkpoint <stale-green-or-later.json> --out <replay-planned.json> --repo <repo>
node <skill>/scripts/verify-evidence-currentness.mjs --checkpoint <checkpoint.json> --evidence <evidence-id> --repo <repo>
```

Run each script with `--help`. `assets/execution-checkpoint.schema.json` defines the portable data shape; `validate-execution-checkpoint.mjs` is the state-dependent acceptance authority and must pass before any checkpoint is consumed. Never hand-edit checkpoint JSON.

## Non-Negotiable Boundaries

- Keep one phase in one branch/PR. Authorization, reviewer agreement, small size, separate commits, or slow CI never authorize later-phase mixing.
- Record and authorize a plan delta before touching new scope. Add only the active phase's smallest prerequisite.
- The scope manifest is the sole path and gate-input authority. A phase plan references its hash but does not duplicate or override it.
- `allowedPaths`, `protectedPaths`, and `forbiddenWork` contain only positive repository-relative Git pathspecs. Exclusion magic, absolute paths, `..`, and symlink escapes are rejected.
- Every `evidenceInputs` entry is a repository-relative file path. Absolute paths, `..`, and symlink escapes are rejected before planning completes.
- Never move upstream because of reboot, elapsed time, unchecked plans, stale handoffs, or ordinary stale status.
- Restart does not stale hash-bound evidence. Search canonical evidence before rerunning; reuse current evidence and rerun only affected gates.
- Keep repository branch names, required checks, domain authorities, and release policy outside this skill.
- Repository policy names the design-freeze, recovery, scope-delta, review, successor, and release authorities. An unknown or conflicting authority halts execution.
- Authority strings are trusted-runner governance identities, not cryptographic signatures. If untrusted actors can write receipts or checkpoint files, repository policy must add signed receipts or an external identity verifier before using this skill as a security boundary.
- All CLI artifact paths are repository-relative and remain inside the real repository root. Repo-external artifacts are not supported.

## Templates

- `assets/design-spec-template.md`: stable design source.
- `assets/phase-plan-template.md`: one-phase executable plan.
- `assets/plan-delta-template.md`: authorized scope expansion.
- `assets/authorized-scope-template.json`: path and complete gate-input authority.
- `assets/authority-policy-template.json`: repository role allowlists for every signed decision.
- `assets/design-freeze-receipt-template.json`: external spec/policy freeze authority.
- `assets/gate-evidence-template.json`: gate evidence shape.
- `assets/recovery-receipt-template.json`: field-level recovery provenance.
- `assets/successor-policy-template.json`: exact successor allowlist.
- `assets/execution-checkpoint.schema.json`: portable checkpoint shape; the validator enforces state-dependent rules.
