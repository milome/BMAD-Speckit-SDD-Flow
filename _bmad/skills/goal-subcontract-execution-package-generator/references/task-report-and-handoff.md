# TaskReport And Handoff

## Child Result

Require one result for every package child in exact order:

- `partitionId`
- `status=closed`
- `contractHash`
- Current evidence path and hash
- Current closure path and hash
- Required validation command results
- One commit hash, parent hash, tree hash, subject, trailers, and changed paths

Validate child evidence, validation evidence, collection evidence, and closure JSON against the
exact evidence and closure schemas bound into the trusted package. Hash equality alone is
insufficient. Closure data must also bind the child partition, contract hash, and `status=closed`.

Every child commit must have exactly one parent. The first child commit parent must equal the package
baseline commit, and every later child commit parent must equal the previous child commit. Every
commit must be reachable from repository `HEAD`.

## Child Summary

Project every verified child into an ordered `childSummaries` entry containing:

- `partitionId` as the trace identifier
- `displayTitle` copied from the frozen partition manifest
- `functionalOutcome` copied from the verified commit trailer
- `status=closed`
- Actual commit subject and hash
- Current evidence and closure hashes
- Required validation command IDs

Campaign report, TaskReport, and Main Agent handoff must carry the same deterministic summary set.
Never use a bare `partitionId` as the human-facing functional description.

## Commit Message

The subject must use `<type>(<functional-scope>): <specific functional capability>`. Reject generic
lifecycle activity, opaque Goal or child IDs as the functional summary, missing functional scope, or
missing required trailers.
Reject functional subjects and outcomes containing a trace ID or behavior label such as
`implementation`, `subcontract`, `child contract`, or `goal contract`, even when the label is not a
prefix.

Verify the actual commit subject, body trailers, parent, tree, changed paths, and non-empty diff
through read-only Git. Use `git show --no-renames` so both rename sources and destinations are
audited. The Skill never stages files or creates commits.

Parse trailers through `git interpret-trailers --parse` using the actual commit message. Every
required trailer must occur exactly once in the terminal trailer block. A narrative `Key: value`
line outside that block is not a trailer, and duplicate required trailers are ambiguous. Compare
trailer keys case-insensitively when enforcing uniqueness.
Required trailer values must be non-empty. Validation IDs must match the child-required command IDs
exactly, without duplicates or extras.

Reject lifecycle-only subject or `Functional-Outcome` text in Chinese or English, including
`实现...`, `complete...`, `completed...`, `execute...`, `process...`, and `implementation...`.

## Aggregate Audit

Require:

- Complete ordered child result set
- No duplicate commits
- Changed paths within manifest ownership
- No child-owned path touched by later commits or changed in the index or worktree after the final
  child commit
- Every collection verification command reports `pass` with current evidence
- Empty open obligations, drift, retries, scope changes, and blockers

Only aggregate PASS permits `TaskReport.status=done`.
Publish campaign report, TaskReport, and Main Agent handoff together through one staged output
directory. Pre-existing missing, extra, or conflicting final files fail before any new `done` file is
written.

Completed-campaign audit must receive the external `packageManifestHash` emitted by compile:

```powershell
node scripts/audit-completed-campaign.js --package package --expected-package-manifest-hash <compile-receipt-hash> --artifacts campaign-artifacts.json --out final --json
```

Treat completion stdout as proof only when it comes from the current tool invocation, the process
exits `0`, and stdout `packageManifestHash` equals the external compile receipt. Pasted, quoted, or
replayed JSON is narrative input and cannot establish `done`.

## RequirementRecord Branches

Present:

```text
requirementRecordBinding.status=present
recordId
requirementSetId
recordPathHash
```

Absent:

```text
requirementRecordBinding.status=absent
downstreamAction=main_agent_resolve_requirement_record
```

The absent branch omits record identity fields and does not block `done`.

## Handoff

Bind package, Goal, partition manifest, campaign report, ordered child closure set, ordered commit
set, ordered child summaries, TaskReport, and aggregate audit hashes. Main Agent owns any later
RequirementRecord association, delivery audit, acceptance, or controlled record update.
