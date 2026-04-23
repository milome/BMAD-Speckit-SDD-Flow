# Release Command Templates

Use this reference when you already understand the release scenario and need standard command templates you can adapt to the current repository contract.

All placeholders are intentionally generic. Replace them only after you have confirmed the repo's actual package name, branch model, workflow file, trigger mode, and release asset expectations.

## Placeholder Legend

- `<package-name>`: npm package name
- `<version>`: semver without `v`, for example `1.2.3`
- `<tag>`: git/release tag, for example `v1.2.3`
- `<owner/repo>`: Git host repository slug
- `<workflow-file-or-name>`: workflow file like `release.yml` or workflow display name
- `<branch>`: release source branch, for example `main` or `master`
- `<run-id>`: GitHub Actions run ID
- `<trust-id>`: npm trust relationship ID

## 1. Tag / Release Templates

### Create and push a version tag

```bash
git tag <tag>
git push origin <tag>
```

Example:

```bash
git tag v1.2.3
git push origin v1.2.3
```

### Create a GitHub Release from the CLI

```bash
gh release create <tag> --target <branch> --title "<tag>" --notes-file <release-notes-file>
```

Example:

```bash
gh release create v1.2.3 --target master --title "v1.2.3" --notes-file release-notes.md
```

### View an existing GitHub Release

```bash
gh release view <tag>
```

## 2. `workflow_dispatch` Preflight Templates

### Trigger a dry-run release workflow

```bash
gh workflow run <workflow-file-or-name> --ref <branch> -f release_tag=<tag> -f npm_tag=latest -f dry_run=true
```

Example:

```bash
gh workflow run release.yml --ref master -f release_tag=v1.2.3 -f npm_tag=latest -f dry_run=true
```

### Trigger a real workflow-dispatch publish

Only use this if the repository contract explicitly supports real publish through `workflow_dispatch`.

```bash
gh workflow run <workflow-file-or-name> --ref <branch> -f release_tag=<tag> -f npm_tag=latest -f dry_run=false
```

### Watch the newest workflow runs

```bash
gh run list --workflow <workflow-file-or-name> --limit 5
gh run watch <run-id> --exit-status
```

### View failed logs

```bash
gh run view <run-id> --log-failed
```

## 3. Trusted Publisher Templates

### Create a GitHub trusted publisher relationship

```bash
npm trust github <package-name> --repo <owner/repo> --file <workflow-file-or-name> --yes
```

Example:

```bash
npm trust github my-package --repo my-org/my-repo --file release.yml --yes
```

### List trusted publisher relationships

```bash
npm trust list <package-name>
```

### Revoke a trusted publisher relationship

```bash
npm trust revoke <package-name> --id <trust-id>
```

### Replace a trusted publisher relationship

```bash
npm trust revoke <package-name> --id <trust-id>
npm trust github <package-name> --repo <owner/repo> --file <workflow-file-or-name> --yes
```

## 4. Dist-Tag Templates

### Inspect version and dist-tags

```bash
npm view <package-name> version dist-tags --json --registry=https://registry.npmjs.org
```

### Add or move a dist-tag

```bash
npm dist-tag add <package-name>@<version> <tag>
```

Example:

```bash
npm dist-tag add my-package@1.2.3 latest
npm dist-tag add my-package@1.2.3 next
```

### Remove a dist-tag

```bash
npm dist-tag rm <package-name> <tag>
```

### List dist-tags

```bash
npm dist-tag ls <package-name>
```

## 5. Release Asset Verification Templates

### View release assets

```bash
gh release view <tag> --json assets
```

### Download release assets

```bash
gh release download <tag> --dir <output-dir>
```

### Check whether a `.tgz` and manifest are present

```bash
gh release view <tag> --json assets --jq '.assets[].name'
```

Typical expected files:

- `<package-name>-<version>.tgz`
- `manifest.json`
- checksums, if the repository contract requires them

## 6. Local Release Validation Templates

### General release readiness

```bash
npm run lint
npm test
npm publish --dry-run --access public --registry=https://registry.npmjs.org
npm pack --json
```

### Monorepo-style CI equivalent

Replace with the repo's actual command:

```bash
npm run test:ci
```

### Verify pack output contains required files

```bash
npm pack --json
```

Then inspect:

- package filename
- package version
- required README companion files
- required static assets

## 7. Rollback Record Template

Use this as a release-close or rollback note skeleton.

```markdown
# Rollback Record: <package-name> <tag>

## Release Attempt

- Package: `<package-name>`
- Intended version: `<version>`
- Tag: `<tag>`
- Workflow: `<workflow-file-or-name>`
- Run URL: `<workflow-run-url>`

## Failure / Rollback Trigger

- Summary:
- Failure class:
- When detected:

## Registry State At Time Of Decision

- Published version:
- Dist-tags:

## Release Asset State

- Release URL:
- Expected assets:
- Actual assets:

## Rollback Decision

- Action chosen:
- Why this action:

## Rollback Point

- Last known good version:
- Last known good tag:
- Last known good commit:

## Follow-Up

- Corrective release needed: yes/no
- Owner:
- Next step:
```

## 8. Release Evidence Pack Skeleton

Use this as a post-release close-out template.

```markdown
# Release Evidence Pack: <package-name> <tag>

## npm Version And Dist-Tag

## Workflow Run

## Provenance / Trust

## Release Assets

## Pack Manifest

## Rollback Point

## Final Status
```

## Usage Rule

These are templates, not authoritative commands by themselves. Before using any command above, confirm:

- package name
- workflow file
- branch
- trigger model
- auth model
- release asset expectations

using [repo-contract-discovery.md](repo-contract-discovery.md).
