# Goal Subcontract Execution Package Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one repository-local Skill that deterministically compiles Goal child-execution prompts and read-only audits externally produced closure, commit, campaign, TaskReport, and Main Agent handoff evidence.

**Architecture:** Keep the Skill limited to a package compiler and evidence auditor. Three CommonJS CLI scripts operate on hash-bound JSON and Markdown files without mutating Git, RequirementRecord, Main Agent runtime, lifecycle authority, or delivery state. Acceptance tests own deterministic fixtures, real read-only Git verification, record-binding branches, commit-message readability, forbidden capability checks, and installed-surface coverage.

**Tech Stack:** Node.js 22 CommonJS, Vitest 4, JSON Schema Draft 2020-12, SHA-256, Git read-only commands, repository encoding-integrity gate.

---

## Implementation Authority

Use only:

- `docs/superpowers/specs/2026-08-03-goal-subcontract-execution-package-generator-minimal-skill-design.md`

Do not use the superseded expanded design as an implementation source.

Do not add `adoptionPhase`, RequirementRecord writers, controlled events, CAS transactions, Main Agent runtime changes, Git mutation, dispatch, active pointers, or delivery closeout.

Do not create a commit until all RED, GREEN, REFACTOR, targeted verification, encoding, and unified acceptance gates pass.

## File Map

Create the Skill:

- `_bmad/skills/goal-subcontract-execution-package-generator/SKILL.md`
- `_bmad/skills/goal-subcontract-execution-package-generator/agents/openai.yaml`
- `_bmad/skills/goal-subcontract-execution-package-generator/references/execution-package-contract.md`
- `_bmad/skills/goal-subcontract-execution-package-generator/references/task-report-and-handoff.md`
- `_bmad/skills/goal-subcontract-execution-package-generator/scripts/build-execution-package.js`
- `_bmad/skills/goal-subcontract-execution-package-generator/scripts/audit-execution-package.js`
- `_bmad/skills/goal-subcontract-execution-package-generator/scripts/audit-completed-campaign.js`
- `_bmad/skills/goal-subcontract-execution-package-generator/schemas/execution-package-manifest.schema.json`
- `_bmad/skills/goal-subcontract-execution-package-generator/schemas/child-prompt-packet.schema.json`
- `_bmad/skills/goal-subcontract-execution-package-generator/schemas/campaign-task-report-binding.schema.json`
- `_bmad/skills/goal-subcontract-execution-package-generator/assets/commit-message-template.txt`

Create tests and evidence:

- `tests/helpers/goal-subcontract-execution-package-fixture.ts`
- `tests/acceptance/goal-subcontract-execution-package-generator-skill-contract.test.ts`
- `tests/acceptance/goal-subcontract-execution-package-generator-build.test.ts`
- `tests/acceptance/goal-subcontract-execution-package-generator-campaign-audit.test.ts`
- `tests/acceptance/goal-subcontract-execution-package-generator-installed-surface.test.ts`
- `docs/superpowers/evidence/2026-08-03-goal-subcontract-execution-package-generator-red-baseline.md`

Do not modify existing dirty tests unless a new isolated test proves an actual missing install-surface connection that cannot be covered through the existing generic publisher.

## CLI Contracts

Compile:

```powershell
node _bmad/skills/goal-subcontract-execution-package-generator/scripts/build-execution-package.js --request fixtures/request.json --out artifacts/package --json
```

Audit immutable package:

```powershell
node _bmad/skills/goal-subcontract-execution-package-generator/scripts/audit-execution-package.js --package artifacts/package --expected-package-manifest-hash <compile-receipt-hash> --json
```

Audit completed campaign:

```powershell
node _bmad/skills/goal-subcontract-execution-package-generator/scripts/audit-completed-campaign.js --package artifacts/package --expected-package-manifest-hash <compile-receipt-hash> --artifacts fixtures/campaign-artifacts.json --out artifacts/final --json
```

Every CLI must emit one bounded JSON result, use non-zero exit status on failure, and expose a stable `failureClass`.

### Task 1: RED Baseline Pressure Scenarios

**Files:**

- Create: `docs/superpowers/evidence/2026-08-03-goal-subcontract-execution-package-generator-red-baseline.md`

- [ ] **Step 1: Run three independent baseline agents without the new Skill**

Use fresh agents with no conversation fork, no repository reads, and no expected answer:

1. A completed child under time pressure where the agent must choose the commit message and closure result.
2. A fully audited campaign with no RequirementRecord binding where the agent must choose TaskReport status.
3. A campaign with aggregate tests passing but one child missing commit/evidence proof where the agent must choose TaskReport status.

- [ ] **Step 2: Record exact baseline outputs**

Persist scenario text, raw answer, observed failure, and failure classification. Classify failures as:

```text
generic_commit_subject
requirement_record_false_blocker
premature_done
missing_hash_binding
missing_child_commit_verification
```

- [ ] **Step 3: Verify RED**

The RED phase passes only when at least one baseline output violates the approved Skill contract and every scenario has an explicit compliance decision. Do not initialize the Skill before this evidence exists.

### Task 2: GREEN Skill Runtime

**Files:**

- Create every Skill and test file listed in the File Map.

- [ ] **Step 1: Write failing acceptance tests**

Write tests that require:

- Canonical Skill files, valid frontmatter, portable paths, and OpenAI metadata.
- Deterministic package bytes for identical input and repository baseline.
- Frozen Goal markers and exact SHA-256 verification.
- Final `goal-contract-partition-manifest/v2` membership, order, child path, and child hash verification.
- Present and absent RequirementRecord binding branches.
- Explicit omission of record identity fields in the absent branch.
- Campaign and child prompt generation in exact topological order.
- One functional commit policy per child with lifecycle-only subject rejection.
- Generic domain-only display-title rejection.
- Package hash and generated-file tamper detection.
- One unique reachable commit per child in an ordered parent chain.
- Exact changed-path ownership checks.
- Collection command evidence and aggregate campaign audit.
- `TaskReport.status=done` only after every child and aggregate audit passes.
- Runtime and static rejection of Git mutation, RequirementRecord writes, adoption, dispatch, and control-plane behavior.
- Generic installation/publish surface contains every Skill resource.

- [ ] **Step 2: Run tests and verify expected failure**

Run:

```powershell
npx vitest run tests/acceptance/goal-subcontract-execution-package-generator-skill-contract.test.ts tests/acceptance/goal-subcontract-execution-package-generator-build.test.ts tests/acceptance/goal-subcontract-execution-package-generator-campaign-audit.test.ts tests/acceptance/goal-subcontract-execution-package-generator-installed-surface.test.ts
```

Expected: FAIL because the Skill directory and runtime do not yet exist.

- [ ] **Step 3: Initialize the Skill**

Run the system `init_skill.py` with:

```text
name=goal-subcontract-execution-package-generator
output=_bmad/skills
resources=scripts,references,assets
display_name=Goal Subcontract Execution Package Generator
short_description=Compile and audit Goal child execution packages
default_prompt=Use $goal-subcontract-execution-package-generator to compile or audit an ordered Goal child-contract execution package.
```

Create `schemas/` after initialization. Remove every generated placeholder before validation.

- [ ] **Step 4: Implement deterministic compile**

`build-execution-package.js` must:

- Parse `--request`, `--out`, and `--json`.
- Resolve all source paths inside the declared repository root.
- Verify the Goal bytes and frozen markers.
- Verify partition-manifest bytes, final authority mode, partition count, topological order, ordered child hashes, and zero coverage gaps.
- Verify each supplied child path and hash against the matching manifest partition.
- Capture read-only Git `HEAD` and tree hash as the campaign baseline.
- Normalize the optional RequirementRecord binding into `present` or `absent`.
- Generate one campaign prompt, one JSON packet and Markdown prompt per child, TaskReport template, Main Agent handoff template, and package manifest.
- Use canonical recursively sorted JSON with LF and a final newline.
- Derive every artifact hash and `packageId` from deterministic bytes.
- Write only beneath `--out` through atomic same-directory rename.

- [ ] **Step 5: Implement immutable package audit**

`audit-execution-package.js` must:

- Require the external `packageManifestHash` emitted by compile.
- Recompute the package-manifest self-hash.
- Resolve every generated relative path beneath the package root.
- Recompute every generated artifact hash.
- Verify child order, membership, packet projection, commit policy, binding branch, and baseline fields.
- Reject path escape, missing file, hash drift, duplicate partition, and fabricated record identity.

- [ ] **Step 6: Implement completed campaign audit**

`audit-completed-campaign.js` must:

- Audit the immutable package first using the external compile receipt.
- Verify one result per ordered child.
- Verify `closed`, contract hash, evidence hash, closure hash, validation results, commit uniqueness, commit reachability, parent chain, tree hash, changed paths, subject, and trailers.
- Reject lifecycle-only subjects including `闭合令牌刷新子合同`, `完成 AUTH-03`, and `执行认证改造`.
- Require functional scope, concrete functional subject, `Functional-Outcome`, `Affected-Scope`, `Child-Contract`, `Contract-Hash`, `Evidence`, and `Validation`.
- Verify collection-level commands all report `pass` with bound evidence.
- Reject any open obligation, drift, retry, scope change, or blocker.
- Emit deterministic `task-report.json` and `main-agent-handoff.json` only after aggregate PASS.
- Return `packageManifestHash` in completed-audit stdout so the current invocation can be matched to
  the external compile receipt.
- Emit `requirementRecordBinding.status=absent` plus `downstreamAction=main_agent_resolve_requirement_record` without record IDs when binding is absent.

- [ ] **Step 7: Run GREEN tests**

Run the four targeted Vitest files. Expected: all tests PASS with no warnings.

### Task 3: REFACTOR And Verification

**Files:**

- Modify only the newly created Skill, fixture, test, and RED evidence files.

- [ ] **Step 1: Re-run the exact RED scenarios with the Skill**

Use fresh agents and the exact baseline scenario text. Provide only the installed Skill path as new context. Record the raw outputs and compare each compliance decision with the RED evidence.

- [ ] **Step 2: Close observed loopholes**

Add the smallest necessary Skill instruction or deterministic script validation for each observed bypass. Do not introduce new lifecycle authority, additional writers, new Main Agent gates, or RequirementRecord behavior.

- [ ] **Step 3: Re-run pressure scenarios**

The REFACTOR phase passes only when:

- The child commit subject names the delivered functional capability.
- Missing RequirementRecord binding does not block `done`.
- Missing child closure, evidence, validation, or commit proof blocks `done`.
- The agent does not claim the Skill executed `git commit`.

- [ ] **Step 4: Validate Skill structure**

Run:

```powershell
python C:/Users/milome/.codex/skills/.system/skill-creator/scripts/quick_validate.py _bmad/skills/goal-subcontract-execution-package-generator
```

Expected: validation success with no frontmatter or naming errors.

- [ ] **Step 5: Run deterministic and branch verification**

Run the targeted Vitest suite and confirm:

```text
deterministic snapshot PASS
RequirementRecord present PASS
RequirementRecord absent PASS
package tamper rejection PASS
child closure mismatch rejection PASS
commit readability rejection PASS
aggregate audit PASS
forbidden mutation PASS
installed surface PASS
```

- [ ] **Step 6: Run static forbidden-scope audit**

Inspect scripts for mutating Git commands, RequirementRecord writes, adoption, CAS, dispatch, active-pointer, and Main Agent runtime imports. Inspect Skill prose to ensure those terms appear only as prohibitions or downstream boundaries.

- [ ] **Step 7: Run encoding integrity**

Run:

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
```

Expected: `findings=0`.

- [ ] **Step 8: Run bounded regression**

Run:

```powershell
npx vitest run tests/acceptance/goal-execution-contract-generator-skill-contract.test.ts tests/acceptance/goal-contract-partition-orchestrator-skill-contract.test.ts tests/acceptance/goal-subcontract-execution-package-generator-skill-contract.test.ts tests/acceptance/goal-subcontract-execution-package-generator-build.test.ts tests/acceptance/goal-subcontract-execution-package-generator-campaign-audit.test.ts tests/acceptance/goal-subcontract-execution-package-generator-installed-surface.test.ts
```

Expected: all selected tests PASS.

## Unified Acceptance Gate

- [ ] Re-read the approved design and map every acceptance criterion to one passing test or verified artifact.
- [ ] Re-read every generated Skill file and verify no placeholder, stale hash, path escape, or duplicate authority exists.
- [ ] Confirm scripts perform no Git mutation and no RequirementRecord or Main Agent write.
- [ ] Confirm the worktree diff contains only intended new files plus the already approved design/plan/evidence artifacts.
- [ ] Run `git diff --check` and report that the new Skill remains uncommitted.
- [ ] Do not create a commit until the user explicitly authorizes the commit stage after reviewing the verification evidence.

## Completion Evidence

Report:

- RED baseline scenario decisions and evidence path.
- GREEN and REFACTOR scenario decisions.
- Targeted and regression test counts.
- Skill validator result.
- Encoding scan count and findings.
- Final Skill file list and hashes.
- RequirementRecord present/absent behavior.
- Commit readability enforcement behavior.
- Residual risks or skipped checks.
