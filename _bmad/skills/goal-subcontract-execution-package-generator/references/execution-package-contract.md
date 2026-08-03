# Execution Package Contract

## Compile Request

Require `schemaVersion=goal-subcontract-execution-package-request/v1` and:

- `repositoryRoot`
- `goalContract.path` and `goalContract.hash`
- `partitionManifest.path` and `partitionManifest.hash`
- Ordered `children[].partitionId`, `path`, and `hash`
- `evidenceSchema.path` and `hash`
- `closureSchema.path` and `hash`
- Ordered `collectionVerificationCommands[].id` and `command`
- Optional `requirementRecordBinding`

`repositoryRoot` must be an explicit canonical absolute path equal to
`git rev-parse --show-toplevel`. All source paths are repository-relative and must resolve by real
filesystem path inside `repositoryRoot`. Lexically safe paths that escape through a symlink or
junction are invalid.

## Source Gates

- Goal bytes must match the supplied SHA-256.
- Goal must contain exactly one effective `contractMode: frozen` and exactly one effective
  `rewritePolicy: forbidden` directive. Fenced code, blockquotes, indented code, and HTML comments do
  not supply effective directives.
- Partition manifest bytes must match the supplied SHA-256.
- Manifest must use `goal-contract-partition-manifest/v2` and
  `manifestAuthorityMode=final_child_membership`.
- `partitionCount`, `topologicalOrder`, `partitions`, and `orderedChildContractHashes` must agree.
- Partition IDs must be unique. Every dependency must identify a unique earlier partition in the
  frozen order; self, later, missing, duplicate, and cyclic dependencies are invalid.
- Coverage gap arrays must exist and be empty.
- `partitionManifestHash`, child contract hashes, owned paths, and command IDs must satisfy runtime
  format and uniqueness invariants. Ownership and command IDs cannot overlap between children.
- Each supplied child path and hash must match its manifest partition.
- Parse and compile both bound JSON schemas before package readiness.

## Deterministic Outputs

Write only beneath the declared package root:

```text
package-manifest.json
campaign-prompt.md
children/NN-<partitionId>.packet.json
children/NN-<partitionId>.prompt.md
templates/task-report.json
templates/main-agent-handoff.json
```

Serialize JSON with recursively sorted keys, LF, two-space indentation, and one final newline.
Hash exact UTF-8 bytes with SHA-256. Identical inputs and Git baseline must produce identical bytes.
Capture one fixed `headCommit`, derive `treeHash` from that exact commit object, and fail if `HEAD`
changes during capture. Package audit must verify the declared tree belongs to the declared commit.

The package manifest binds repository baseline, Goal, partition manifest, ordered children, generated
artifacts, collection commands, RequirementRecord branch, and its own hash projection.
Validate generated package manifests and child packets against the bundled schemas before writing
readiness output. Reject every file not declared by the exact package artifact inventory.

The compiler returns `packageManifestHash` as an external compile receipt. Persist it outside the
package root and supply it to every audit:

```powershell
node scripts/audit-execution-package.js --package package --expected-package-manifest-hash <compile-receipt-hash> --json
```

Audit compares this trusted receipt before accepting the package self-hash. Rewriting artifacts,
paths, identities, or the manifest and then recomputing internal hashes cannot establish trust.

## Human-Readable Identity Projection

- `partitionId` is a machine trace identifier, not a functional name.
- Require a non-empty `partitions[].displayTitle` that is not equal to its `partitionId`.
- Human prompts render `<displayTitle> (<partitionId>)`; machine packets retain the separate fields.
- Reject lifecycle-only titles in Chinese or English, including `Complete AUTH-01 implementation`.
- Reject any functional title containing a trace ID or behavior label such as `implementation`,
  `subcontract`, `child contract`, or `goal contract`.
- Reject generic domain labels such as `Authentication` and `认证能力`; a title must identify a
  concrete condition, behavior, or delivered result.
- Campaign order and predecessor labels never expose a bare child ID.
- TaskReport and handoff templates include the ordered `childIdentities` projection.
- Package audit re-verifies the partition manifest hash and reconstructs campaign prompt, child
  packets, child prompts, templates, artifact inventory, and package ID from frozen source bytes
  before exact byte comparison.

Each child packet binds the canonical evidence and closure schemas plus:

```text
predecessorClosureRequired=true
stageOwnedPathsOnly=true
closureStatus=closed
commitVerificationFields=hash,parentHash,treeHash,subject,changedPaths,diff,reachability,trailers
```

## Failure Classes

Use stable failures for invalid arguments, path escape, missing files, source hash mismatch,
non-frozen Goal, non-final manifest, child order or hash mismatch, coverage gap, output conflict,
generated artifact drift, package self-hash mismatch, and non-human-readable child title.

Use `human_readable_identity_projection_mismatch` when a regenerated human projection differs, even
if the modified artifact and package manifest were self-rehashed.

Use `expected_package_manifest_hash_missing` when audit has no external compile receipt.

Use `repository_baseline_mismatch` when the declared baseline commit is missing or its declared tree
does not belong to that commit.
