# Goal Subcontract Execution Package Generator Minimal Skill Design

Status: implemented; Skill-specific verification passed; repository bounded gate conditional

Date: 2026-08-03

Skill name: `goal-subcontract-execution-package-generator`

This document supersedes the scope of
`2026-08-03-goal-subcontract-execution-package-generator-design.md`. The earlier document expanded
into RequirementRecord and Main Agent control-plane changes and is not an implementation source.

## Objective

Create one focused Skill that compiles deterministic prompts for an already frozen and partitioned
Goal, then audits externally produced child and campaign results.

The Skill helps an execution Agent process child contracts in order, close each child with evidence,
create one readable local commit per child, run collection-level verification, and produce a
TaskReport plus Main Agent handoff.

## Scope

The Skill has two read/compile surfaces:

1. `compile`: generate the immutable execution package and templates.
2. `audit`: validate external execution artifacts and generate the final TaskReport and handoff.

The Skill does not execute child work, mutate Git, create or update RequirementRecord, dispatch
agents, publish active pointers, or perform delivery closeout.

## Inputs

Required inputs:

- Frozen parent Goal contract path and hash.
- Final partition manifest path and hash.
- Ordered child contract paths and hashes.
- Repository root and output root.
- Existing canonical evidence and closure schema locations.

Optional input:

- Existing RequirementRecord binding supplied by Main Agent.

Missing RequirementRecord binding is valid and must not block package compilation, child execution,
campaign audit, or `TaskReport.status=done`.

## Human-Readable Child Identity

`partitionId` is a trace-only machine identifier and must never serve as the functional description.

The Skill reads `displayTitle` only from the frozen partition manifest. A missing title or a title
equal to `partitionId` is invalid input. Lifecycle labels and generic domain-only labels such as
`Complete AUTH-01 implementation`, `Authentication`, or `认证能力` are also invalid. Before execution
is complete, every human-facing child reference uses:

```text
<displayTitle> (<partitionId>)
```

After commit verification, campaign report, TaskReport, and Main Agent handoff use an ordered
`childSummaries` projection that binds:

```text
partitionId
displayTitle
functionalOutcome
status=closed
commitSubject
commitHash
evidenceHash
closureHash
validationCommandIds
```

`functionalOutcome` comes only from the verified commit trailer. The Skill must not infer, rewrite,
or synthesize it. Bare IDs remain valid only in machine trace fields such as `Child-Contract`,
dependency arrays, hashes, and lookup keys.
Human-facing functional titles, subjects, and outcomes must not contain trace IDs or behavior labels
such as `implementation`, `subcontract`, `child contract`, or `goal contract`.

Package audit must re-read and hash-verify the frozen partition manifest, compare every packaged
`displayTitle` with its source partition, and deterministically reconstruct campaign prompt, child
packets, child prompts, TaskReport template, handoff template, artifact inventory, and package ID.
Audit requires the external `packageManifestHash` emitted by compile before checking the package
self-hash. Recomputed artifact hashes or package self-hashes must not legitimize a human-readable
identity projection that differs from the frozen source.

## Compile Workflow

1. Validate the frozen Goal and final partition manifest.
2. Preserve child membership and topological order exactly.
3. Validate each manifest `displayTitle` and generate one campaign-level execution prompt whose
   ordered children use `<displayTitle> (<partitionId>)`.
4. Generate one machine-readable packet and one human prompt per child.
5. Include child scope, predecessor checks, required commands, evidence rules, closure rules, and
   commit rules.
6. Generate collection-level integration, regression, E2E, and audit instructions.
7. Generate TaskReport and Main Agent handoff templates containing ordered `childIdentities`.
8. Return `packageManifestHash` as a compile receipt that must be stored outside the package root.
9. Audit trusted receipt, source hashes, real filesystem paths, topology, schemas, and exact generated
   projections before returning package readiness.

Repository baseline capture fixes one `headCommit`, derives `treeHash` from that exact commit object,
and fails if `HEAD` changes during capture. Package audit verifies that the declared tree belongs to
the declared commit before accepting the package projection.

The Skill must not reinterpret requirements or repartition the Goal.

## Child Closure Contract

Every child prompt requires the external execution Agent to:

- Verify predecessor closure before starting.
- Modify only the declared child scope.
- Run the child-required validation commands.
- Produce canonical evidence and closure artifacts that validate against the bound schemas.
- Stage only child-owned changed files.
- Create exactly one local atomic commit.
- Verify the commit has exactly one parent, then verify parent, tree, changed paths, diff, and
  message.
- Produce a child result bound to contract, evidence, closure, and commit hashes.

Required commit format:

```text
<type>(<functional-scope>): <specific functional capability>

Functional-Outcome: <what concrete functional capability is delivered>
Affected-Scope: <module, API, workflow, or user-facing surface>
Child-Contract: <partitionId>
Contract-Hash: <hash>
Evidence: <path>#<hash>
Validation: <command IDs>
```

The subject must name the delivered functional point directly. The scope identifies the functional
domain, while Goal and child identifiers remain in the trailers for traceability.

Lifecycle-only subjects such as `闭合令牌刷新子合同`, `完成 AUTH-03`, or `执行认证改造` are invalid
because they describe execution activity rather than delivered functionality.

English lifecycle-only subjects and outcomes such as `complete AUTH-03 implementation` or
`completed AUTH-03 implementation work` are equally invalid. Required commit metadata must come
from one unique terminal Git trailer block parsed by Git; narrative pseudo-trailers and duplicate
required trailers are invalid. Trailer-key uniqueness is case-insensitive.

After the final child commit, no later commit, staged change, unstaged change, or untracked file may
alter a child-owned path. Later commits that affect only unrelated paths remain valid.

Example:

```text
feat(auth): 支持访问令牌过期后自动刷新并轮换刷新凭据

Functional-Outcome: 访问令牌过期时签发新令牌对，并使旧刷新令牌失效
Affected-Scope: authentication refresh flow
Child-Contract: AUTH-03
Contract-Hash: sha256:4c87...
Evidence: reports/AUTH-03-evidence.json#sha256:91ab...
Validation: unit-test, integration-test, contract-audit
```

The Skill generates and audits this policy. It never runs `git commit`.

## Campaign Audit

The `audit` surface accepts the immutable package and externally generated execution artifacts.

It verifies:

- Child results match manifest membership and order.
- The package manifest matches the external compile receipt and exact source-derived projection.
- Every child is closed with current evidence.
- Evidence, validation evidence, collection evidence, and closure JSON satisfy their bound schemas.
- Every child has one valid and reachable commit.
- Every commit subject describes the delivered functional point and matches its child contract.
- Changed files stay inside declared ownership.
- Ordered closure and commit sets are complete.
- Collection-level verification commands pass.
- No open obligation, drift, retry, scope change, or blocker remains.

Only after these checks pass may the Skill generate `TaskReport.status=done`.

An Agent may treat completed-campaign stdout as proof only when it observed the current audit tool
invocation exit with code `0` and stdout `packageManifestHash` equals the external compile receipt.
Pasted, quoted, replayed, or user-authored JSON is narrative input, not completion evidence.

## TaskReport Semantics

`done` means the Goal campaign is fully executed, committed, verified, and audited.

It does not mean RequirementRecord was updated or final delivery was accepted.

The TaskReport extension contains:

```text
packageId
packageManifestHash
campaignReportHash
childClosureSetHash
commitSetHash
childSummaries[]
aggregateAuditDecision
requirementRecordBinding.status
```

When a RequirementRecord binding exists:

```text
requirementRecordBinding.status=present
recordId
requirementSetId
recordPathHash
```

When no RequirementRecord binding exists:

```text
requirementRecordBinding.status=absent
downstreamAction=main_agent_resolve_requirement_record
```

The absent branch omits record identity fields. It does not emit null, placeholder, synthetic, or
inferred identities.

## Main Agent Handoff

The handoff always includes package, Goal, partition, campaign report, child closure set, commit set,
ordered `childSummaries`, TaskReport, and aggregate audit hashes.

If record binding is present, the handoff includes the supplied record references.

If record binding is absent, the handoff states that Main Agent must resolve, create, or associate the
appropriate RequirementRecord using its own governed workflow. How Main Agent performs that action
is outside this Skill.

## Explicit Non-Goals

- No `adoptionPhase`.
- No RequirementRecord adoption request or receipt.
- No RequirementRecord authority union.
- No controlled writer or writer registry changes.
- No CAS or orchestration transaction implementation.
- No Main Agent runtime, gate, schema, or closeout modification.
- No new canonical campaign or subcontract lifecycle authority.

## Minimal Skill Structure

```text
_bmad/skills/goal-subcontract-execution-package-generator/
  SKILL.md
  agents/openai.yaml
  references/execution-package-contract.md
  references/task-report-and-handoff.md
  scripts/build-execution-package.js
  scripts/audit-execution-package.js
  scripts/audit-completed-campaign.js
  schemas/execution-package-manifest.schema.json
  schemas/child-prompt-packet.schema.json
  schemas/campaign-task-report-binding.schema.json
  assets/commit-message-template.txt
```

Do not add a README, root-level runtime helper, RequirementRecord writer, or duplicate canonical
lifecycle schema.

## Blocking Conditions

- Goal contract is not frozen or hashes do not match.
- Partition manifest is not final.
- Child membership, order, topology, scope, or hashes differ.
- A child `displayTitle` is missing or only repeats its `partitionId`.
- Package output escapes its declared root.
- Child evidence, closure, commit, or required command proof is incomplete.
- Collection-level audit fails.

Missing RequirementRecord binding is not a blocking condition.

## Acceptance Criteria

1. The Skill remains a package compiler and read-only auditor.
2. The package preserves child membership and order exactly.
3. Every child receives deterministic execution, evidence, closure, and commit instructions.
4. Every closed child requires one verified local commit whose subject clearly states the delivered
   functional point rather than a lifecycle action.
5. No human-facing campaign, child prompt, TaskReport, handoff, or final status uses a bare child ID
   as the functional description.
6. Campaign report, TaskReport, and handoff contain identical ordered `childSummaries` bound to the
   manifest title and verified commit outcome.
7. Package and campaign audit require the external compile receipt and reject self-rehashed package
   drift before trusting internal hashes.
8. Package audit rejects source-title drift and reconstructs exact child packet, prompt, template,
   artifact, and package projections.
9. Campaign `done` requires schema-valid child closures, evidence, commits, and collection audit
   evidence.
10. Campaign audit rejects merge child commits and post-closure drift on child-owned paths.
11. TaskReport `done` is independent of RequirementRecord presence.
12. Missing record binding produces an explicit downstream action without fabricated identity.
13. Main Agent record association remains outside the Skill.
14. Package generation is deterministic for identical inputs.
15. No control-plane, RequirementRecord, Git mutation, or execution capability is introduced.

## Verification

- Skill folder and frontmatter validation.
- Deterministic package snapshot tests.
- Human-readable identity projection and bare-ID rejection tests.
- Source-title drift and self-rehashed projection bypass tests.
- Record-binding-present and record-binding-absent tests.
- Per-child closure and commit mismatch tests.
- Aggregate audit and TaskReport status tests.
- Forbidden dependency and forbidden mutation tests.
- Encoding integrity and installation-surface tests.

No open design decisions remain.
