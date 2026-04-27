# Release Operator Playbooks

Use this reference when you already know the repository's release contract and need a concrete operator runbook for the exact release scenario.

This file covers four common scenarios:

1. first public release
2. subsequent normal release
3. failed release rollback
4. hotfix patch release

Each playbook assumes you first completed the repository contract discovery described in [repo-contract-discovery.md](repo-contract-discovery.md).

## Playbook 1: First Public Release

Use when:

- the package has never been released publicly
- the publish pipeline is being made public for the first time
- Trusted Publishing or token-based publish setup is still being proven

### Preconditions

- package name and public surface are frozen
- README and packaged assets are stable
- auth model is configured
- release workflow is identified
- local dry-run validation is green

### Operator sequence

1. Confirm package metadata:
   - `name`
   - `version`
   - `repository.url`
   - `bugs.url`
   - `homepage`
   - `files`
2. Confirm trust/auth configuration:
   - Trusted Publishing: `npm trust list <package-name>`
   - token path: confirm secret exists in CI
3. Run local release checks:
   ```bash
   npm run lint
   npm test
   npm publish --dry-run --access public --registry=https://registry.npmjs.org
   npm pack --json
   ```
4. Push the release-ready branch
5. Optionally run workflow preflight / dry-run
6. Merge to the release source branch if required
7. Trigger the real release event
8. Verify npm state and release assets
9. Build the release evidence pack

### Success criteria

- npm registry shows the intended version and dist-tag
- authoritative workflow is green
- release assets exist if expected
- release evidence pack is complete

## Playbook 2: Subsequent Normal Release

Use when:

- the package is already live
- you are shipping the next normal semver release
- the release chain has already worked before

### Preconditions

- the target code is reviewed and ready
- all version-bearing files are identified
- the public package version to ship is known

### Operator sequence

1. Bump all required version surfaces
2. Run local release readiness checks:
   ```bash
   npm run lint
   npm test
   npm publish --dry-run --access public --registry=https://registry.npmjs.org
   npm pack --json
   ```
3. Commit and push the version bump
4. Open or update PR into the release source branch
5. Wait for checks to pass
6. Merge to the release source branch
7. Optionally run workflow preflight
8. Trigger the real release event
9. Verify npm state
10. Verify release assets
11. Build the release evidence pack

### Success criteria

- new semver is live on npm
- dist-tag policy is correct
- release workflow is green
- release evidence pack is complete

## Playbook 3: Failed Release Rollback

Use when:

- a release attempt partially succeeded
- npm publish completed but release assets or docs are broken
- the release workflow failed after a state change
- the newly released version should not remain current

### First decision

Determine which failure class applies:

1. **workflow failed before publish**
   - usually no rollback needed
   - fix and rerun
2. **npm publish succeeded but release artifacts failed**
   - may require only workflow / asset repair
3. **npm publish succeeded and the package must be superseded**
   - publish a new corrective version
4. **dist-tag points incorrectly**
   - adjust dist-tags if the repository policy allows it

### Operator sequence

1. Collect evidence first:
   - npm version / dist-tags
   - failing workflow run URL
   - current GitHub Release state
   - current rollback point from the last known good release
2. Decide rollback method:
   - rerun workflow only
   - publish a corrective patch
   - retag dist-tags
   - close out failed release and move forward
3. Document the rollback decision
4. Execute the chosen rollback method
5. Re-verify npm registry and release assets
6. Update the release evidence pack with rollback notes

### Important rule

Do not attempt to overwrite an already-published npm version. In most cases, the real rollback is:

- restore code state
- publish a newer corrective version

### Success criteria

- registry state is stable and intentional
- consumers are not pointed at a broken version unexpectedly
- rollback point and corrective action are documented

## Playbook 4: Hotfix Patch Release

Use when:

- a small urgent fix must ship quickly
- the next version is a patch release, typically `X.Y.Z -> X.Y.(Z+1)`
- the release should avoid unrelated queued work

### Preconditions

- the hotfix scope is isolated
- the base release version is known
- the repository's normal release branch policy is understood

### Operator sequence

1. Start from the release source branch or a hotfix branch based on it
2. Apply only the minimal fix
3. Bump only to the next patch version
4. Run the shortest acceptable release-safety validation set for the repo
   - never skip the actual publish dry-run
   - keep test scope consistent with risk
5. Merge or fast-track review according to the repo's hotfix policy
6. Trigger the real release event
7. Verify npm version / dist-tag
8. Verify release assets
9. Build the release evidence pack

### Hotfix-specific cautions

- do not pull unrelated release-train changes into the patch branch
- do not skip README / asset packing validation if the hotfix touches docs or package surface
- do not bypass evidence collection just because the change is small

### Success criteria

- the patch version is live
- only intended hotfix changes shipped
- release evidence pack is complete

## Cross-Playbook Verification Set

No matter which playbook you use, the release is not operationally complete until you have:

1. npm version / dist-tag proof
2. workflow run proof
3. provenance / trust proof when applicable
4. release asset proof when expected
5. pack manifest proof
6. rollback point recorded

That full close-out is defined in [release-evidence-pack.md](release-evidence-pack.md).
