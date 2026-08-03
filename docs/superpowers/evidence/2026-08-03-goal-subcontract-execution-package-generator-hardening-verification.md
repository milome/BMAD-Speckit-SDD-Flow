# Goal Subcontract Execution Package Generator Hardening Verification

Date: 2026-08-03

Decision: `skill_and_adjacent_contract_pass_ready_to_commit`

Implementation authority:

- `docs/superpowers/specs/2026-08-03-goal-subcontract-execution-package-generator-minimal-skill-design.md`

The superseded expanded design was not used.

## Scope

Implemented only the deterministic package compiler and read-only auditors:

- Frozen Goal and final partition-manifest validation.
- Human-readable child identity projection.
- One child packet and prompt per frozen partition.
- External compile-receipt package audit.
- Child closure, commit, collection, TaskReport, and handoff audit.
- RequirementRecord present and absent result branches.

No RequirementRecord writer, Main Agent runtime, Git mutation, dispatch, CAS, active pointer, or
delivery closeout was added.

## Review Findings Closed

An earlier broad review identified three Critical, seven Important, and two Minor defects. A later
focused review invalidated the resulting PASS with three Critical, two Important, and one Minor
defect. The combined hardening rounds now:

1. Audits rename sources and destinations with `git show --no-renames`.
2. Excludes fenced code, HTML comments, blockquotes, and indented code from effective Goal freeze
   directives, including same-length fence lines with an info string.
3. Publishes campaign report, TaskReport, and Main Agent handoff as one atomic output set.
4. Requires an explicit canonical Git repository root equal to `git rev-parse --show-toplevel`.
5. Parses and compiles bound evidence and closure schemas before package readiness.
6. Validates generated and audited package manifests and child packets against bundled schemas.
7. Rejects undeclared package files and symbolic or special package entries.
8. Lists collection command IDs, executable commands, and evidence requirements in the campaign
   prompt.
9. Requires actual non-empty commit diff verification in every child packet, prompt, and campaign
   audit.
10. Rejects narrative pseudo-trailers, duplicate or empty required trailers, and extra or duplicate
    Validation IDs.
11. Enforces runtime hash, ownership, command-ID, dependency, membership, and order invariants.
12. Uses only the external compile stdout receipt as the trusted package audit anchor in tests and
    runtime.
13. Supports 40- and 64-character Git object IDs without changing the Skill boundary.
14. Rejects trace IDs and `implementation`, `subcontract`, `child contract`, or `goal contract`
    behavior labels anywhere in a human-facing functional description.
15. Enforces required trailer uniqueness case-insensitively.
16. Rejects merge commits by requiring exactly one parent before diff or path audit.
17. Rejects every post-closure change to child-owned paths in later commits, the index, or the
    worktree while permitting unrelated commits.
18. Captures one stable baseline commit/tree pair and verifies during package audit that the tree
    belongs to the declared commit.

Human-readable projections continue to reject bare IDs, lifecycle-only descriptions, and generic
domain labels. `partitionId` remains trace metadata; `displayTitle` and verified
`Functional-Outcome` carry the functional meaning.

## RED-GREEN Evidence

Focused reviewer hardening RED:

```text
2 test files failed
5 failed
26 passed
31 total
```

Earlier broad hardening RED:

```text
2 test files failed
10 failed
18 passed
28 total
```

Skill-definition and fence pressure RED:

```text
2 skill-definition tests failed
1 selected fence-pressure test failed
```

Current GREEN:

```text
5 test files passed
40 tests passed
```

The suite covers deterministic bytes, present and absent RequirementRecord branches, trusted
receipt enforcement, source and package drift, real-path escape, topology, exact Goal directives,
fenced-code bypasses, schema compilation, bundled schema enforcement, strict inventory, generic and
lifecycle title rejection, evidence and closure schemas, terminal trailers, readable commit
outcomes, case-insensitive trailer uniqueness, single-parent commit chains, post-closure ownership
stability, baseline commit/tree binding, rename ownership, actual diff, self-rehashed projection
defense, atomic final publication, aggregate audit, forbidden mutation, and installed-surface
execution.

## Completion Gates

- Three runtime scripts `node --check`: PASS.
- Three CommonJS runtime scripts ESLint with the repository-incompatible
  `no-require-imports` rule disabled: PASS.
- Seven TypeScript test/helper files ESLint: PASS.
- Prettier check for all supported changed files: PASS.
- Skill validator: `Skill is valid!`.
- Encoding integrity: `checkedFiles=4461 findings=0`.
- `git diff --check`: exit `0`; warnings only concern three unrelated pre-existing tracked
  requirements-contract manifest files.
- Static forbidden-scope scan: no mutating Git command, adoption, RequirementRecord writer,
  controlled ingest, active pointer, CAS, dispatch, or delivery mutation finding.

## Bounded Regression

The five-file bounded run produced:

```text
5 files passed
40 tests passed
```

The two stale `goal-execution-contract-generator` text assertions were updated to the current
TRACE-009 contract: source-plan generation requires
`--entry standalone_goal_contract`, and standalone latest-hash three-perspective PASS replaces a
separate final docs-review.

## Independent Review Status

The focused independent review returned three Critical, two Important, and one Minor finding. Every
finding was converted into a failing test or an explicit defense-in-depth assertion and then fixed.
A fresh final code-review Agent was started against the stable worktree but did not return within
two bounded review windows totaling 480 seconds. No fresh code-review PASS is claimed, and the
timeout is not treated as acceptance evidence.

## Current Core Hashes

- `SKILL.md`: `B4915017A4FD0BDA4D9916D7DE62DEF30CFD1DC9BDEB01BBBE69A2544F2CFE90`
- `build-execution-package.js`:
  `555A564272FCF853D5EDDBBB5A5DE2BF937C3AB6D7767C2F69869CB595B0CF9C`
- `audit-execution-package.js`:
  `750EB4EDB13B276EDFD052FB12C31D5CF8D190946E4CB07503A6170F9C74F3C5`
- `audit-completed-campaign.js`:
  `AA9FA3351FA21AC6D3374E2D83712207395AD2EFDF06FCA61D71A1A043654C27`

## Residual Conditions

- Repository-wide tests beyond the five-file bounded suite were not run.
- A fresh independent final-review PASS is unavailable because the reviewer timed out; the focused
  findings are instead closed by executable attack tests and deterministic validation.
- Three pre-existing tracked requirements-contract manifest changes remain outside this task and
  were not modified or reverted.
- Git commit creation follows this evidence gate and is verified separately.
