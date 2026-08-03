# Goal Subcontract Human-Readable Identity Verification

Date: 2026-08-03

Status: `historical_snapshot_superseded`

Current evidence:

- `docs/superpowers/evidence/2026-08-03-goal-subcontract-execution-package-generator-hardening-verification.md`

The decision and hashes below describe the pre-hardening snapshot and must not be used as current
acceptance evidence.

Decision: `superseded`

Implementation source:

- `docs/superpowers/specs/2026-08-03-goal-subcontract-execution-package-generator-minimal-skill-design.md`

The superseded expanded design remains outside implementation authority.

## Implemented Contract

- `partitionId` is trace-only and cannot serve as the functional description.
- Compile rejects a missing or ID-only manifest `displayTitle`.
- Campaign and child prompts render `<displayTitle> (<partitionId>)`.
- TaskReport and Main Agent handoff templates contain ordered `childIdentities`.
- Campaign report, final TaskReport, and Main Agent handoff contain identical ordered
  `childSummaries`.
- Each summary binds manifest `displayTitle`, verified commit-trailer `functionalOutcome`, closure
  status, actual commit subject and hash, evidence and closure hashes, and validation command IDs.
- Package audit re-verifies the frozen partition manifest and reconstructs every human-facing prompt
  and template.
- Self-rehashed bare-ID projections and partition-title source drift are rejected.
- RequirementRecord present and absent branches remain unchanged.
- The Skill remains read-only and does not commit, dispatch, write RequirementRecord, or close
  delivery.

## RED-GREEN-REFACTOR Evidence

Initial RED:

- `4` expected failures proved v1 output, missing child summaries, acceptance of ID-only
  `displayTitle`, and missing Skill language.

GREEN:

- The first implementation reached `19/19 PASS`.

REFACTOR RED:

- A self-rehashed campaign, child prompt, or TaskReport template containing bare IDs was accepted.
- Partition-manifest title drift after package compilation was accepted.

REFACTOR GREEN:

- Deterministic projection reconstruction rejects
  `human_readable_identity_projection_mismatch`.
- Source hash verification rejects `partition_manifest_hash_mismatch`.

Fresh-context pressure validation rejected management instructions to omit display titles and child
summaries under deadline and token pressure.

## Fresh Verification

Task-specific suite:

```text
4 test files passed
22 tests passed
```

Other gates:

- Three runtime scripts `node --check`: PASS.
- Six test/helper files ESLint: PASS.
- Forced full-path Prettier check: PASS.
- Skill validator: `Skill is valid!`.
- Three JSON schemas parse successfully.
- Installed Codex surface publishes all `11` Skill resources and compiles a package.
- Encoding integrity: `checkedFiles=4461 findings=0`.
- Placeholder scan: no `TODO`, `FIXME`, or `TBD` findings.

The runtime scripts are intentionally CommonJS and excluded by repository ESLint. Forcing
`--no-ignore` applies the repository TypeScript `no-require-imports` rule and is not used as a pass
claim; runtime syntax is covered by `node --check` and acceptance execution.

## Bounded Regression

Result:

```text
5 test files
23 passed
2 failed
```

Both failures remain in unchanged
`tests/acceptance/goal-execution-contract-generator-skill-contract.test.ts`:

- `routes source-plan contract generation through the package CLI`
- `delegates review convergence to one hash-bound multi-view loop`

Full log:

- `.artifacts/verification/goal-subcontract-human-readable-bounded-regression.log`
- `597` lines
- `45660` bytes
- SHA-256 `94FBB19DAB0B02C6874A2144454170DEF17E9762084A1C630548086E63691524`

## Current Skill Hashes

- `SKILL.md`: `38CC5972F6E3BD8E8108B66895252BA844D426117EEAB69E9591D8DA2A391A8B`
- `build-execution-package.js`:
  `155A208AB6B303D1245F764571552E270B6B1613BF2B3B719BCDA3285AACD415`
- `audit-execution-package.js`:
  `EF88AD08A81038716E50F754051AD44869F9768D27542379ED435E97A5BC7F63`
- `audit-completed-campaign.js`:
  `93CE50145CBB5C26B129A250D4F8F649F19BE5E34C6CA627E02F22E9DAEC1332`

## Residual Conditions

- The independent code-review agent did not return within two wait windows or the requested
  interrupted summary, so it is not counted as passing evidence.
- Three pre-existing tracked requirements-contract manifest changes remain outside this task and were
  not edited or reverted.
- Repository bounded regression is not fully green because of the two unchanged adjacent test
  failures above.
- No Git commit was created.
