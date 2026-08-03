---
name: goal-contract-partition-orchestrator
description: Use when the user asks to split an already frozen Goal Execution Contract, partition a Goal execution plan, create or inspect child-contract candidates, or assess partition readiness. Current package runtime output remains diagnostic-only until ER-GH-004 runtime placement is implemented.
---

# Goal Contract Partition Orchestrator

## Overview

Use this skill only after the parent Goal contract has been frozen. It produces or validates partition artifacts; it does not generate, amend, or reinterpret the parent Source Plan or Goal Execution Contract.

Read `references/partition-protocol.md` before starting a partition run.

## Non-Negotiable Boundaries

- Require an exact parent Source Plan path, frozen Goal Execution Contract path, and verified SHA-256 bindings.
- Stop with `blocked_by_frozen_successor_goal_contract` when the required successor contract does not exist, is not frozen, or does not bind the supplied source hash.
- Do not fall back to a predecessor contract merely because a successor is missing.
- Keep `goal-contract-partition-manifest/v2`. Do not create, request, or infer a v3 manifest.
- Treat the final v2 manifest as child-membership and topology authority only. RequirementRecord state and lifecycle records retain their own authority boundaries.
- Do not modify a frozen parent contract, `requirement-record.json`, an immutable manifest, or a legacy `contracts/` directory.
- Do not treat `--out`, `--out-root`, or `--receipts-dir` as governed authority inputs.
- Do not activate or promote a run until all required manifest, child, coverage, receipt, and path checks pass.

## Workflow

### 1. Preflight

Inspect the parent contract, referenced Source Plan, generation/coverage receipts, and current repository baseline. Verify that:

- `contractMode: frozen` and `rewritePolicy: forbidden` are present in the exact parent contract bytes.
- The parent `sourcePlanPath` exists and its SHA-256 equals `sourcePlanHash`.
- The parent contract has no unresolved placeholders and is the intended successor, not an obsolete predecessor.
- The source identity is the established `masterImplementationPlanHash`; do not derive a second source hash from output bytes.
- The input tuple can supply `templateHash`, `profileHash`, `compilerIdentityHash`, `methodologyProfileHash`, `partitionPolicyHash`, and `sourceCompositionPolicyHash`.

If any condition fails, return the blocking failure class and the missing path/hash. Do not generate child contracts.

### 2. Compile The Partition Plan

Compute one deterministic `generationKey` from the canonical serialization of:

```text
sourceHash
templateHash
profileHash
compilerIdentityHash
methodologyProfileHash
partitionPolicyHash
sourceCompositionPolicyHash
```

Compile `partition-plan.json` from the frozen source authority. The same tuple must resolve to the same generation key. A changed tuple must resolve to a distinct generation/run and must never overwrite existing bytes.

### 3. Generate Pending Children

Generate child-contract candidate bytes in declared topological order. Treat every child as pending until its exact path, SHA-256, declared obligations, dependency bindings, and compilation receipt validate.

Use `children/pNN-<partitionId>-goal-execution-plan.md` for new governed children. Read legacy `contracts/` only for compatibility; never write, rename, move, or delete it.

### 4. Finalize Manifest v2

Finalize `goal-contract-partition-manifest/v2` only after every pending child compilation receipt is available. The final manifest must bind the exact child paths/hashes, ordered child hashes, membership hashes, partition set, coverage, and topology.

Emit final child-membership receipts after finalization. Do not mutate the manifest after lifecycle activity begins.

### 5. Validate And Activate

Validate global coverage, duplicate/unmapped obligations, path containment, receipt reachability, manifest schema, topology, and all child hash bindings before activation.

For standalone authority, use the canonical bootstrap layout and replace `active-generation.json` atomically only after validation.

For RequirementRecord-scoped authority, the authorized controlled event/reduced field is the active-run authority. `active-partition-run.json` is a hash-bound projection that must match the committed record revision/event-chain head. Never directly edit the RequirementRecord or pointer.

### 6. Current Runtime Compatibility

Until ER-GH-004 runtime placement is implemented, the current package command requires `goal-contract partition --out <path>`. Treat every such output as non-authoritative diagnostic output:

- Write only to an explicitly disposable diagnostic location.
- Do not update an active pointer or RequirementRecord.
- Do not use the result as execution/release authority.
- Record the command, input hashes, output hash, and limitation in the run report.

Stop with `blocked_until_er_gh_004_runtime_implemented` before any governed activation that would require canonical resolver, immutable generation/run placement, or controlled supersession.

## Required Evidence

Report the parent contract hash, source hash, generation key, partition-plan hash, manifest hash, child hashes, coverage decision, receipt paths/hashes, active-authority state, and every blocking condition.

Never claim the Skill is validated merely because it ran. Validation requires a frozen parent input, a successful latest-hash partition flow, negative path/overwrite/authority tests, and a final independent audit.
