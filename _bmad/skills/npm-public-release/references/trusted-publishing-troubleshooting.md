# Trusted Publishing Troubleshooting

Use this reference when npm publication is supposed to go through Trusted Publishing, but the release fails during trust verification, provenance validation, or release artifact handling.

## First Principle

Saving a trusted publisher relationship is not the same as proving it works.

npm explicitly warns that Trusted Publisher settings are **not verified when they are saved**. Errors usually surface only when the workflow actually attempts to publish. That means the real verification sequence is:

1. inspect the trust relationship
2. inspect package metadata and workflow binding
3. run the intended workflow path
4. confirm npm registry and release assets after the run

## Quick Triage Commands

### Trust relationship

```bash
npm trust list <package-name>
```

### Live package state

```bash
npm view <package-name> version dist-tags --json --registry=https://registry.npmjs.org
```

### Package metadata

```bash
cat package.json
```

Check at least:

- `name`
- `version`
- `repository.url`
- `bugs.url`
- `homepage`

### Workflow inspection

```bash
gh run list --workflow <workflow-file-or-name> --limit 5
gh run view <run-id> --log-failed
```

### Release assets

```bash
gh release view <tag>
gh release view <tag> --json assets
```

## Issue 1: `repository.url` Does Not Match

### Symptom

The publish step fails even though the trusted publisher entry looks correct, or provenance validation rejects the package.

### Why It Happens

npm compares the provenance bundle against the package's repository metadata. If `package.json.repository.url` does not match the GitHub repository used by the workflow identity, provenance validation can fail.

Common mistakes:

- empty `repository.url`
- wrong owner/repo
- stale repo after rename or transfer
- SSH-style URL while the workflow provenance expects HTTPS

### What To Check

```bash
npm trust list <package-name>
cat package.json
```

Make sure the repository in npm trust and the repository in `package.json` point to the same GitHub repo.

### Fix

Update `package.json` so repository metadata matches the actual publishing repository exactly. For GitHub-hosted packages, the most reliable form is:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/<owner>/<repo>"
  },
  "bugs": {
    "url": "https://github.com/<owner>/<repo>/issues"
  },
  "homepage": "https://github.com/<owner>/<repo>"
}
```

Then rerun the release preflight or real publish path.

## Issue 2: Provenance `E422`

### Symptom

The publish step reaches npm and then fails with an error like:

```text
npm ERR! code E422
npm ERR! 422 Unprocessable Entity
```

Often the message includes provenance or repository verification details.

### Why It Happens

`E422` in this path usually means npm accepted the publish attempt structurally but rejected the provenance bundle or package metadata during verification.

Common causes:

- `repository.url` mismatch
- workflow file bound incorrectly
- workflow path changed but trust entry still points at the old file
- repository renamed or transferred without updating trust

### What To Check

1. failed publish step logs from the workflow
2. `npm trust list <package-name>`
3. `package.json.repository.url`
4. actual workflow filename in the repo

### Fix

Treat `E422` as a metadata / identity mismatch first, not as a transient npm outage.

Recommended order:

1. correct `package.json.repository.url`
2. verify the workflow file name and location
3. confirm `npm trust list` still points at the intended repo + workflow
4. rerun dry-run or real publish

## Issue 3: `npm trust list` Is Empty

### Symptom

```bash
npm trust list <package-name>
```

returns no trusted publisher entries.

### Why It Happens

Possible reasons:

- the package has never had a trusted publisher configured
- you are querying the wrong package name
- you are authenticated as an account without package write access
- the package does not exist yet on npm

### What To Check

```bash
npm whoami
npm view <package-name> version --registry=https://registry.npmjs.org
npm trust list <package-name>
```

### Fix

If the package already exists and you have permission, add the trust entry:

```bash
npm trust github <package-name> --repo <owner/repo> --file <workflow-file.yml> --yes
```

If the package does not exist yet, publish the first version using the path supported by npm for first-time publication in your environment, then configure or re-check trust according to the chosen release model.

### Important Note

`npm trust list` empty means there is **no verified trust relationship to inspect**. Do not proceed as if Trusted Publishing is configured.

## Issue 4: Wrong Workflow File Binding

### Symptom

The repository and package metadata look correct, but Trusted Publishing still does not work.

### Why It Happens

The trusted publisher relationship is bound to a specific workflow file. If the package trust entry points to `publish.yml` but the real release runs from `release.yml`, npm will not recognize the publishing identity as the trusted one.

This is especially easy to break when:

- migrating from token-based publish to Trusted Publishing
- renaming workflow files
- keeping both old and new publish workflows in the repo

### What To Check

```bash
npm trust list <package-name>
```

Then compare the listed workflow file to the actual file that is doing the publish.

### Fix

If the workflow file is wrong, replace the trust relationship:

```bash
npm trust list <package-name>
npm trust revoke <package-name> --id <trust-id>
npm trust github <package-name> --repo <owner/repo> --file <correct-workflow-file.yml> --yes
```

Then rerun the authoritative workflow path.

### Operational Rule

If the repository contains both a legacy publish workflow and a modern Trusted Publishing workflow, explicitly mark one as authoritative in docs and release process. Otherwise this issue tends to recur.

## Issue 5: Dist-Tag Is Correct But Release Asset Is Missing

### Symptom

- npm registry shows the new version
- `dist-tags` look correct
- but the expected `.tgz`, manifest, or other release attachments are missing from GitHub Release

### Why It Happens

npm publication and GitHub Release asset upload are often separate workflow steps. It is possible for npm publish to succeed while release asset upload is skipped or misconfigured.

Common causes:

- the workflow only uploads assets on `release.published`, not on `workflow_dispatch`
- asset upload step is conditional and the condition did not match
- the build produced no file at the expected path
- release step published to npm, but no GitHub Release existed for asset upload

### What To Check

1. inspect the workflow conditions for the asset upload step
2. inspect the workflow logs around pack / artifact generation / upload
3. inspect the GitHub Release itself:

```bash
gh release view <tag> --json assets
```

### Fix

Confirm whether missing assets are actually a failure or expected behavior for the path you used.

Examples:

- if you published with `workflow_dispatch` and the workflow intentionally skips release-asset upload in that mode, missing assets are expected
- if you published through `release.published` and the workflow claims it uploads assets there, then missing assets indicate a packaging or conditional-logic bug

### Preventive Rule

Document the difference between:

- npm publish proof
- GitHub Release asset proof

Do not treat one as evidence of the other.

## Recommended Troubleshooting Order

When Trusted Publishing fails, use this order:

1. `npm trust list <package-name>`
2. check `package.json.repository.url`
3. confirm the actual publishing workflow file
4. inspect failed workflow logs
5. rerun the authoritative dry-run or real publish path
6. verify npm dist-tags
7. verify GitHub Release assets if expected

## Exit Criteria

You can treat Trusted Publishing as healthy only when:

- `npm trust list <package-name>` shows the intended trust relationship
- package metadata matches the publishing repository
- the authoritative workflow has succeeded on the intended trigger path
- npm registry reflects the expected version and dist-tag
- release assets exist when the workflow contract says they should
