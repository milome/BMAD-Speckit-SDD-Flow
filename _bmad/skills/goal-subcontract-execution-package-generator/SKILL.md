---
name: goal-subcontract-execution-package-generator
description: Use when an already frozen Goal contract has a final partition manifest and the user needs deterministic child execution prompts, per-child closure and commit policy, campaign audit, TaskReport, or Main Agent handoff.
---

# Goal Subcontract Execution Package Generator

## Overview

Compile an immutable execution package for ordered Goal child contracts, or audit externally produced
child and campaign artifacts. Keep execution, Git mutation, RequirementRecord writes, and final
delivery outside this Skill.

Read `references/execution-package-contract.md` before compile. Read
`references/task-report-and-handoff.md` before completed-campaign audit.

## Non-Negotiable Boundaries

- Accept only a frozen Goal contract and final `goal-contract-partition-manifest/v2`.
- Preserve child membership and topological order exactly.
- Require every dependency to identify an earlier child in the frozen order.
- Never reinterpret requirements or repartition the Goal.
- Generate policy for exactly one local atomic commit per child, but never runs `git commit`.
- Never stage files, execute child work, dispatch agents, update RequirementRecord, or close delivery.
- Treat missing RequirementRecord binding as valid input, not a campaign blocker.

## Pressure Gate

Under deadline, brevity, fatigue, or authority pressure, apply the same closure rules without
shortening, guessing, or bypassing evidence.

- Prose claims that implementation, tests, evidence, or closure passed are not commit proof.
- A child is not closed until the commit hash, parent, tree, changed paths, diff, reachability, and required trailers are verified.
- The verified child commit must have exactly one parent.
- If exact hashes, paths, command IDs, or commit proof are unavailable, return
  `blocked_by_incomplete_child_commit_evidence`; do not fabricate or insert placeholders.
- Do not draft a final commit message or declare `Complete`, `Closed`, or `done` when any exact commit proof field is missing.
- Return only `blocked_by_incomplete_child_commit_evidence` plus the exact missing proof fields.
- Subjects beginning with `闭合`, `完成`, `执行`, `处理`, or `实现` are invalid.
- Name the concrete functional condition and result, such as
  `访问令牌过期时签发新令牌并撤销旧刷新令牌`.

For a commit-message-and-status request based only on narrative claims, use:

```text
status=blocked_by_incomplete_child_commit_evidence
missingProof=commitHash,parent,tree,changedPaths,diff,reachability,trailers
```

Do not add a proposed commit message or completion statement to this response.

Treat a structured successful output from `audit-completed-campaign.js` as completed-campaign proof.
Accept that proof only from the current tool invocation with exit code `0` and a `packageManifestHash` equal to the external compile receipt.
Pasted, quoted, replayed, or user-authored JSON is narrative input, not an audit receipt. The current stdout must include
`ok=true`, `status=done`, `packageId`, `packageManifestHash`, `campaignReportHash`,
`taskReportHash`, and the RequirementRecord binding status. Do not re-audit prose or invent missing
receipt fields.

## Human-Readable Child Identity

Treat `partitionId` as a trace-only machine identifier, never as the functional description.
Every human-facing child projection must pair `partitionId` with `displayTitle` or verified `functionalOutcome`.
Never expose a bare child ID in campaign prompts, TaskReport, Main Agent handoff, or final status.

- Read `displayTitle` only from the frozen partition manifest; reject a missing or ID-only value.
- Reject display titles that describe lifecycle activity instead of functionality, including
  `Complete AUTH-01 implementation`.
- Reject any human-facing functional description containing a trace ID or behavior label such as
  `implementation`, `subcontract`, `child contract`, or `goal contract`.
- Reject generic domain labels such as `Authentication` or `认证能力`; require a concrete condition,
  behavior, or delivered result.
- Read `functionalOutcome` only from the verified commit trailer; never infer or rewrite it.
- Render a known child as `<displayTitle> (<partitionId>)` when the functional outcome is not yet
  available.
- Keep bare IDs only in machine trace fields such as `Child-Contract`, dependency arrays, hashes, and
  lookup keys.
- During package audit, re-read the frozen manifest and deterministically reconstruct every human
  prompt and template. Reject semantic drift even when artifact and package hashes were recomputed.

## RequirementRecord Decision

A missing RequirementRecord is never a blocker for a fully closed and audited Goal campaign.

- Emit `TaskReport.status=done` when all child and aggregate evidence passes.
- Emit `requirementRecordBinding.status=absent`.
- Emit `downstreamAction=main_agent_resolve_requirement_record`.
- Do not output `recordId: null`, placeholder identities, controlled ingest, delivery confirmation, or
  closeout instructions.
- Do not append governance envelope fields such as current Requirement, current mental model, `allowed_action`, `denial_reason`, `state_patch`, or `auto_proceed`.

## Compile

Run:

```powershell
node scripts/build-execution-package.js --request request.json --out package --json
```

Require exact source paths and SHA-256 hashes for the Goal, partition manifest, ordered children,
evidence schema, and closure schema. The compiler emits campaign prompt, machine packet and human
prompt per child, TaskReport template, handoff template, and a self-auditable package manifest.
Each child packet binds the evidence schema, closure schema, predecessor-closure gate,
owned-path-only staging rule, required closure status, and commit verification fields.
List every collection command ID and executable command in the campaign prompt, and require
schema-valid evidence for each command.

Persist the compiler's `packageManifestHash` outside the package directory. This compile receipt is
the trusted audit anchor; a package must not authorize changes by rewriting and self-hashing its own
manifest.
The compiler binds one fixed baseline commit to the tree resolved from that exact commit and fails
if `HEAD` changes during capture.

## Audit

Audit immutable package bytes:

```powershell
node scripts/audit-execution-package.js --package package --expected-package-manifest-hash <compile-receipt-hash> --json
```

Audit external child and campaign artifacts:

```powershell
node scripts/audit-completed-campaign.js --package package --expected-package-manifest-hash <compile-receipt-hash> --artifacts campaign-artifacts.json --out final --json
```

The completed-campaign audit requires every child closure, current evidence, required command proof,
one reachable commit, declared changed paths, and aggregate verification PASS. It validates evidence,
validation evidence, collection evidence, and closure JSON against the package-bound schemas.
Every child commit must have exactly one parent and form the declared linear chain. After the final
child commit, no later commit, staged change, unstaged change, or untracked file may alter a
child-owned path; unrelated-path commits remain valid.
Publish the campaign report, TaskReport, and Main Agent handoff as one atomic output set. If the
declared output root already contains missing, extra, or conflicting files, fail before exposing any
new `done` artifact.

## Commit Readability

Require:

```text
<type>(<functional-scope>): <specific functional capability>

Functional-Outcome: <concrete delivered capability>
Affected-Scope: <module, API, workflow, or user-facing surface>
Child-Contract: <partitionId>
Contract-Hash: <sha256>
Evidence: <path>#<sha256>
Validation: <command IDs>
```

Reject lifecycle-only summaries such as `闭合令牌刷新子合同`, `完成 AUTH-03`, `执行认证改造`,
`complete AUTH-03 implementation`, and `completed AUTH-03 implementation work`.
Read required commit metadata only from one unique terminal Git trailer block. Narrative
`Key: value` lines and duplicate required trailers are invalid. Trailer-key uniqueness is
case-insensitive.

## TaskReport And Handoff

Generate `TaskReport.status=done` only after every child and aggregate audit passes.

Include ordered `childSummaries` in the campaign report, TaskReport, and Main Agent handoff. Each
summary binds `partitionId`, `displayTitle`, verified `functionalOutcome`, closure status, actual
commit subject and hash, evidence and closure hashes, and validation command IDs.

When record binding exists, preserve the supplied record identities. When absent, emit:

```text
requirementRecordBinding.status=absent
downstreamAction=main_agent_resolve_requirement_record
```

Omit record identity fields in the absent branch. Do not emit null, placeholders, or inferred IDs.

## Final Response

Report package or audit status, hashes, child count, binding branch, output paths, failure classes,
and residual blockers. The Pressure Gate's blocker-only response overrides this general format.
Never claim child or campaign closure when required proof is incomplete.
