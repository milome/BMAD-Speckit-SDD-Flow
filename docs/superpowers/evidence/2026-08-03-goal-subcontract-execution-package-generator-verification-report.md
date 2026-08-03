# Goal Subcontract Execution Package Generator Verification Report

Date: 2026-08-03

Status: `historical_snapshot_superseded`

Current evidence:

- `docs/superpowers/evidence/2026-08-03-goal-subcontract-execution-package-generator-hardening-verification.md`

The decision, test counts, and hashes below describe the pre-hardening snapshot and must not be used
as current acceptance evidence.

Decision: `superseded`

Implementation source:

- `docs/superpowers/specs/2026-08-03-goal-subcontract-execution-package-generator-minimal-skill-design.md`

The superseded expanded design was not used as implementation authority.

## Scope Decision

Implemented only:

- Deterministic execution-package compile.
- Immutable package audit.
- Completed-campaign audit.
- Per-child readable commit policy and proof verification.
- Present and absent RequirementRecord branches.
- TaskReport and Main Agent handoff generation.

Excluded:

- RequirementRecord writes, adoption, CAS, or controlled ingest.
- Main Agent runtime, gate, schema, or closeout changes.
- Git mutation, dispatch, child execution, or Goal repartitioning.

## RED Evidence

Baseline evidence:

- `docs/superpowers/evidence/2026-08-03-goal-subcontract-execution-package-generator-red-baseline.md`
- Baseline result: two failures and one correct incomplete-child rejection.
- Observed failures: generic lifecycle commit subject, missing hash binding, false RequirementRecord
  blocker, null record identity, and control-plane scope escape.

## GREEN Evidence

The minimal Skill surface contains 11 files: `SKILL.md`, OpenAI metadata, two references, three
scripts, three schemas, and one commit-message template.

Initial GREEN result:

- Four test files passed.
- Twelve tests passed.
- Skill validator passed.
- Encoding scan reported zero findings.

## REFACTOR Evidence

Observed bypasses:

- An Agent generated `feat(auth): 实现令牌刷新与旧刷新令牌失效` and declared `Complete`
  without commit hash, parent, tree, changed paths, reachability, or trailers.
- An Agent emitted `TaskReport.status=blocked` and `recordId: null` because RequirementRecord was
  absent.
- Agents appended unrelated governance envelope fields such as current mental model,
  `allowed_action`, `state_patch`, and `auto_proceed`.

Closed loopholes:

- Narrative completion claims are not accepted as commit proof.
- Missing exact commit proof returns `blocked_by_incomplete_child_commit_evidence`.
- Lifecycle-leading subjects including `实现` are rejected.
- Structured successful completed-campaign audit output is accepted as campaign proof.
- Missing RequirementRecord is not a completion blocker.
- Null or fabricated record identities and governance envelope fields are forbidden.

Pressure results:

- Commit-message scenario returned only the incomplete-commit-proof blocker.
- Incomplete-child scenario rejected campaign `done` and listed current closure and commit proof.
- Missing-record narrative scenario identified commit proof as the blocker and explicitly stated
  RequirementRecord absence was not the blocker.
- Deterministic completed-campaign tests proved the absent-record `done` branch.

## Verification Results

Task-specific command:

```text
4 test files passed
19 tests passed
```

Verified behaviors:

- Deterministic package and final-audit bytes.
- RequirementRecord present and absent branches.
- JSON Schema Draft 2020-12 validation for manifest, child packet, and TaskReport.
- Child order, source path escape, partition coverage gap, and package artifact tamper rejection.
- Missing closure, validation, and commit proof rejection.
- Commit subject readability, opaque ID/title-only rejection, functional-outcome specificity,
  reachability, parent chain, tree, changed paths, and scope ownership.
- Aggregate verification failure prevents TaskReport emission.
- Compile and audit leave Git `HEAD` unchanged.
- Installed Codex Skill publishes all 11 resources and runs package compilation.
- Final handoff directly binds Goal and partition-manifest hashes.

Other gates:

- Skill validator: PASS.
- Three runtime scripts `node --check`: PASS.
- Prettier: PASS.
- ESLint for six new test/helper files: PASS.
- Encoding integrity: `checkedFiles=4461 findings=0`.
- `git diff --check`: exit `0`.

## Acceptance Mapping

1. Compiler and read-only auditor only: PASS via Skill contract and static mutation tests.
2. Exact child membership and order: PASS via deterministic build and order-drift rejection.
3. Deterministic child execution/evidence/closure/commit instructions: PASS via package schema and
   installed-surface tests.
4. One verified readable commit per child: PASS via campaign audit positive and negative tests.
5. Campaign `done` requires all child and aggregate proof: PASS via incomplete-child and aggregate
   failure tests.
6. TaskReport `done` is independent of RequirementRecord presence: PASS via present/absent tests.
7. Missing record emits downstream action without identity fabrication: PASS via schema and output
   assertions.
8. Main Agent record association remains outside the Skill: PASS via static import and boundary
   assertions.
9. Identical inputs produce deterministic output: PASS via package and final-output digests.
10. No control-plane, RequirementRecord, Git mutation, or execution capability: PASS via static
    forbidden-scope audit and Git `HEAD` assertions.

## Skill Hashes

- `SKILL.md`: `D29EBB6FA5C6DADB914E3B98B7A31634B0E5DECBAE93A1FF1A05097B6CDB6509`
- `agents/openai.yaml`: `E9317FA898D40102516F39CAC911E9EAB144C3AACB7D24E9494EE6B653640FE4`
- `assets/commit-message-template.txt`: `A648529BF0AC7B7A33E67EDD9247F9F6B90193A60FB14768B80A65BDAC3335F3`
- `references/execution-package-contract.md`: `300BC5607CE2B11847B03F970CE2D3C0D1D17B85707660FBE0CDD2B07C19CB56`
- `references/task-report-and-handoff.md`: `819FE460545A17064546D0CDD4FD7EE3C730F41245FB77113B97AB85BDBDB9D0`
- `schemas/execution-package-manifest.schema.json`: `9F76DFFDBFFE83B9E7129E86D9DB69820157777D37D4E93C64633BE281EA6E33`
- `schemas/child-prompt-packet.schema.json`: `8B88F1A9D2FEEDDB459CF52022F306C1435833E182DD903A73B2030B7EF0F7D4`
- `schemas/campaign-task-report-binding.schema.json`: `B2F981B39D9F7107DF0BD33C361B270D950AE74F75345D2C9BC9DFAA937C9389`
- `scripts/build-execution-package.js`: `5C4559B43694848B2DEF67A872F7C4884450C4EE9B162EFBAF99F755A86A7BBB`
- `scripts/audit-execution-package.js`: `86C1AC554D46553EE8CE491DCD34C800714FEB382FCBEDF96403E01DD09DC22C`
- `scripts/audit-completed-campaign.js`: `12E8F750366E71A07C42629AC5DA954666ADF121B561ED34F944019B191CC828`

## Residual Gates

The exact bounded regression completed with `21 passed, 2 failed`. Both failures are in the
unchanged `goal-execution-contract-generator-skill-contract.test.ts`; its expected strings do not
match the existing canonical Skill text. Full log:

- `.artifacts/verification/goal-subcontract-bounded-regression.log`
- `555` lines, `38072` bytes.

Three tracked requirements-contract manifest files also changed outside this implementation after
regression execution. They are not part of the approved write scope and were not reverted.

Therefore the Skill-specific acceptance criteria pass, but the repository-wide unified gate and
commit stage remain blocked. No Git commit was created.
