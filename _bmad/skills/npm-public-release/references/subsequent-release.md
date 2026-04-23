# Subsequent Release Workflow

This guide is for publishing the next npm version after the public release chain already works.

Use it for routine semver releases after the initial public release path has already been proven.

## Goal

Promote already-reviewed code to a new npm version and matching release artifact using the repository's authoritative release workflow.

## 1. Re-Discover The Repository Contract

Before every new release, re-check the repo contract instead of assuming it has not changed.

Confirm:

- source-of-truth branch (`main`, `master`, release branch, etc.)
- authoritative workflow file and trigger
- package name(s)
- whether the repo is single-package or monorepo
- whether version parity is enforced across internal packages
- whether release assets must be uploaded to GitHub Releases or another artifact store
- whether the trusted publisher relationship still points at the correct repository/workflow

Recommended trust verification command:

```bash
npm trust list <package-name>
```

If the workflow file or repository ownership changed, verify whether the existing trust relationship must be revoked and recreated before release.

## 2. Bump All Required Version Surfaces

In many repos, the visible package version is not the only place that must change.

Depending on the repo, version-bearing locations may include:

- root `package.json`
- workspace package manifests
- CLI version constants
- embedded server metadata
- lockfiles
- generated manifests or docs if they embed versions

Do not change only one version location until you confirm the repository's parity rules.

## 3. Local Release Readiness Validation

Run the same checks the real release workflow will rely on.

Typical set:

```bash
npm run lint
npm test
npm publish --dry-run --access public --registry=https://registry.npmjs.org
npm pack --json
```

Adapt to the repository:

- monorepos may require CI-equivalent test commands instead of plain `npm test`
- some repos require build steps before `npm publish --dry-run`
- some repos need workspace-specific validation

Interpretation:

- lint: repository syntax/style gate
- tests: release safety gate
- publish dry-run: package metadata, publishability, prepublish hooks
- pack: final artifact visibility and packaged files

## 4. Commit And Push The Release Bump

After validation:

1. commit the version bump and release-preparation changes
2. push the branch
3. open or update the PR into the release source-of-truth branch if the repo uses PR-based integration

## 5. Merge To The Release Source Branch

If the repository releases from `main` or `master`, merge there before the real release.

Choose merge mode based on repo expectations. When provenance or release topology matters, merge commit is often the safest default. If the repo explicitly uses squash or rebase, follow that project convention.

## 6. Optional Workflow Preflight

If the release workflow supports dry-run or manual preflight, use it before the real release when:

- the workflow recently changed
- package metadata changed
- README / asset packing changed
- auth method changed
- you want confidence before creating the real public release event

Typical pattern:

```bash
gh workflow run <workflow-file-or-name> --ref <release-branch> -f release_tag=vX.Y.Z -f npm_tag=latest -f dry_run=true
```

Then inspect and watch the run.

## 7. Trigger The Real Release

The real trigger depends on the repository contract. Common patterns include:

- create and publish a GitHub Release
- push a version tag
- run a manual workflow dispatch without dry-run
- run a custom CD pipeline

Use the trigger that the repo actually implements. Do not assume tags, releases, and dispatches are interchangeable.

## 8. Post-Release Verification

After the workflow finishes successfully, verify both npm and release outputs.

### npm registry

```bash
npm view <package-name> version dist-tags --json --registry=https://registry.npmjs.org
```

Confirm:

- package `version` matches `X.Y.Z`
- dist-tags match the intended release policy

### CI / workflow

Inspect the run and confirm:

- workflow conclusion is `success`
- publish step succeeded
- no provenance, parity, or packaging failures occurred

### Release assets

If the workflow is responsible for uploading release artifacts, verify the expected files exist.

Examples:

- packed `.tgz`
- manifest JSON
- checksums
- release note attachments

## 9. Common Subsequent-Release Failure Modes

- forgetting one of several version-bearing files
- publishing before merging to the source-of-truth branch
- using a legacy workflow that no longer matches the repo's release contract
- changing README assets without confirming package contents via `npm pack --json`
- dist-tags not updated as intended
- provenance failures after metadata changes

## 10. Subsequent Release Exit Criteria

A subsequent release is complete only when:

- all local release readiness checks passed
- the release source-of-truth branch contains the intended version bump and content
- the real release workflow completed successfully
- npm registry reflects the new version and dist-tag
- release assets are present if expected
