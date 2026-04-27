# Release Evidence Pack

Use this reference after a publish attempt succeeds. Its purpose is to define the minimum evidence required to say a release is actually complete rather than merely "probably done".

## Goal

Produce a release evidence pack that proves:

1. the intended version is live on npm
2. the intended workflow run succeeded
3. trust / provenance state is consistent with the publish path
4. release assets exist when expected
5. the packed artifact that was released is known
6. a rollback point is recorded

This is the minimum standard for an auditable npm release close-out.

## Evidence Pack Sections

## 1. npm Version And Dist-Tag Proof

Required command:

```bash
npm view <package-name> version dist-tags --json --registry=https://registry.npmjs.org
```

Record:

- package name
- published version
- relevant dist-tags, especially `latest`
- timestamp of verification

Passing condition:

- `version` matches the intended release version
- `dist-tags` point where intended

## 2. Workflow Run Proof

Required commands:

```bash
gh run list --workflow <workflow-file-or-name> --limit 5
gh run view <run-id>
```

Record:

- workflow file or workflow name
- run ID
- run URL
- trigger type (`release`, `workflow_dispatch`, `push`, etc.)
- branch / ref used
- conclusion

Passing condition:

- the authoritative publish workflow run concluded with `success`
- the run corresponds to the intended version / tag / branch

## 3. Provenance / Trust Proof

If the repository uses Trusted Publishing, record trust and provenance evidence.

### Trust relationship

```bash
npm trust list <package-name>
```

Record:

- whether a trust relationship exists
- bound repository
- bound workflow file
- trust ID when shown

### Provenance / publish evidence

From workflow logs or npm output, capture:

- whether publish used Trusted Publishing
- whether provenance was generated or signed
- any transparency log or provenance reference emitted by npm or CI

Passing condition:

- trust relationship matches the intended repo + workflow when Trusted Publishing is the chosen path
- no provenance verification failure occurred in the successful publish run

If the repo uses token-based auth instead of Trusted Publishing, state that explicitly and record the chosen auth model as part of the evidence pack.

## 4. Release Assets Proof

If the release contract says GitHub Release assets should exist, verify them directly.

Commands:

```bash
gh release view <tag>
gh release view <tag> --json assets
```

Record:

- release tag
- release URL
- expected asset list
- actual asset list

Typical expected assets:

- packed `.tgz`
- manifest JSON
- checksums or companion metadata

Passing condition:

- every asset required by the repo's release contract is present

Important:

- if the repo intentionally skips release assets on `workflow_dispatch`, missing assets are not automatically a failure
- the evidence pack must explicitly say whether assets were expected for the trigger path used

## 5. Pack Manifest Proof

Required command:

```bash
npm pack --json
```

Record:

- produced filename
- package name
- package version
- shasum / integrity when available
- any key packaged support files required by README or runtime contract

Examples of useful confirmations:

- README companion files included
- image assets included
- manifest or config files included

Passing condition:

- the packed artifact matches the intended release version and contains required package surface files

If you already generated a manifest file in CI, include its path or contents summary in the evidence pack.

## 6. Rollback Point Proof

Every release close-out should record a rollback anchor.

Minimum rollback evidence:

- previous npm version before release
- previous `dist-tags` state if relevant
- previous Git tag or release identifier
- last known good branch head / merge commit

Suggested commands:

```bash
npm view <package-name> version dist-tags --json --registry=https://registry.npmjs.org
git rev-parse HEAD
gh release list
```

Record:

- release commit SHA
- merge commit or release branch head
- previous version that would be restored or superseded

Passing condition:

- someone else can identify what to revert to without reconstructing history from scratch

## Suggested Evidence Pack Format

Use a release close-out note with these headings:

```markdown
# Release Evidence Pack: <package-name> vX.Y.Z

## npm Version And Dist-Tag

## Workflow Run

## Provenance / Trust

## Release Assets

## Pack Manifest

## Rollback Point

## Final Status
```

## Final Status Rule

You can call the release complete only when:

- npm version/dist-tags are correct
- the authoritative workflow run is linked and green
- provenance/trust state is consistent with the auth model
- release assets are verified when expected
- pack manifest evidence exists
- rollback point is recorded

If any of the above is missing, the release may be published, but the close-out is not auditable yet.
