---
name: "npm-public-release"
description: "Prepare, validate, and publish public npm packages and GitHub Releases for repositories that ship JavaScript or TypeScript packages. Use when handling first-time npm publication, Trusted Publishing or token-based publish setup, semver version bumps, release dry-runs, GitHub Release publishing, dist-tag management, monorepo release coordination, package artifact validation, or post-release verification."
---

# NPM Public Release

## Overview

Use this skill when you need to ship a public npm package or a matching GitHub Release. It is designed to work across single-package repos and monorepos, with either npm Trusted Publishing or legacy token-based publication flows. The first step is always to identify the repository's actual release contract before you execute anything.

## Workflow Decision Tree

1. If the package has **never been published publicly**, or the repository is still setting up or migrating its release pipeline, read [references/first-public-release.md](references/first-public-release.md).
2. If the package is already live and you are shipping the **next version**, read [references/subsequent-release.md](references/subsequent-release.md).
3. If you are unsure which path applies, inspect:
   - the package name and current version in `package.json`
   - the current live registry state via `npm view <package-name> version dist-tags --json`
   - workflow files under `.github/workflows/`
   - whether the repository publishes on tag push, GitHub Release events, workflow dispatch, or a custom CI path

## Repository Contract Discovery

Before publishing, identify these repo-specific facts:

- public package name(s)
- whether the repo is single-package or monorepo
- which package is actually public versus internal-only workspaces
- authoritative workflow file and trigger
- publish auth model: Trusted Publishing, `NPM_TOKEN`, or another mechanism
- required version-parity rules across packages
- whether release assets such as `.tgz` or manifests should be uploaded to GitHub Releases

Do not assume:

- `master` vs `main`
- tag push vs GitHub Release
- single package vs workspace publish
- OIDC vs token-based auth
- that a package named in source control is already live on npm

If the repository's release contract is still unclear after this first pass, read [references/repo-contract-discovery.md](references/repo-contract-discovery.md).

## Required Validation Discipline

Before claiming a release is ready, run the repository's real release-adjacent checks and read their results.

Typical minimum set:

```bash
npm run lint
npm test
npm publish --dry-run --access public --registry=https://registry.npmjs.org
npm pack --json
```

Adapt that to the actual repo contract. For example, monorepos may require:

- `npm run test:ci`
- workspace build steps
- package-specific tests
- release workflow dry-runs

Minimum success conditions:

- the repository's lint/style gate exits `0`
- the repository's intended release test gate exits `0`
- `npm publish --dry-run` targets the expected package name and version
- `npm pack --json` produces the expected artifact and packaged files

## First Public Release Path

Use [references/first-public-release.md](references/first-public-release.md) when any of the following is true:

- the package name has not been published before
- the repo is switching from manual publish to automated publish
- Trusted Publishing has not been configured yet
- README / asset packaging still needs to be stabilized
- you need to prove the initial public release chain end-to-end

## Subsequent Release Path

Use [references/subsequent-release.md](references/subsequent-release.md) when the package is already live and you are shipping the next semver version.

That path covers:

- identifying all version-bearing files
- local release readiness checks
- branch / merge order
- workflow preflight and real publish paths
- npm dist-tag and release-asset verification after publication

## Release Operator Playbooks

If you already know the release class and need an operator-style runbook instead of discovery guidance, read [references/release-operator-playbooks.md](references/release-operator-playbooks.md).

Use that reference for:

- first public release
- normal subsequent release
- failed release rollback
- hotfix patch release

## Release Command Templates

If you already know the release scenario and mainly need copy-adapt command snippets, read [references/release-command-templates.md](references/release-command-templates.md).

Use that reference for:

- tag and GitHub Release commands
- `workflow_dispatch` preflight commands
- trusted publisher create/list/revoke commands
- npm dist-tag operations
- release asset verification commands
- rollback record templates

## Trusted Publishing Troubleshooting Path

If publication reaches the auth / provenance phase and fails, or if the repository's trust relationship is unclear, read [references/trusted-publishing-troubleshooting.md](references/trusted-publishing-troubleshooting.md).

Use that reference for problems such as:

- `package.json.repository.url` mismatch
- npm provenance `E422`
- `npm trust list <package-name>` returning no entries
- trusted publisher bound to the wrong workflow file
- npm publish succeeding while expected GitHub Release assets are missing

## Release Safety Rules

- Do not publish the same version twice.
- Do not assume pushing a git tag alone is sufficient; verify the actual workflow trigger.
- Do not assume the default workflow is the correct one when multiple publish workflows exist.
- Do not declare a release successful until npm registry state matches the intended version and dist-tag.
- If README assets, templates, or companion files changed, confirm `npm pack --json` includes them before release.
- In monorepos, do not bump only one package until you understand whether version parity is enforced.
- Treat release completion as an evidence problem, not just an execution problem. After publish, assemble the proof bundle described in [references/release-evidence-pack.md](references/release-evidence-pack.md).

## Quick Commands

Check live package state:

```bash
npm view <package-name> version dist-tags --json --registry=https://registry.npmjs.org
```

Create a GitHub Actions trusted publisher relationship via npm CLI:

```bash
npm trust github <package-name> --repo <owner/repo> --file <workflow-file.yml> --yes
```

List trusted publisher relationships for a package:

```bash
npm trust list <package-name>
```

Replace an existing trusted publisher relationship:

```bash
npm trust revoke <package-name> --id <trust-id>
npm trust github <package-name> --repo <owner/repo> --file <workflow-file.yml> --yes
```

Dry-run an authoritative workflow on a ref:

```bash
gh workflow run <workflow-file-or-name> --ref <branch> -f release_tag=vX.Y.Z -f npm_tag=latest -f dry_run=true
```

Watch a workflow run:

```bash
gh run list --workflow <workflow-file-or-name> --limit 5
gh run watch <run-id> --exit-status
```

Verify post-release npm state:

```bash
npm view <package-name> version dist-tags --json --registry=https://registry.npmjs.org
```

## References

- [references/first-public-release.md](references/first-public-release.md)
- [references/subsequent-release.md](references/subsequent-release.md)
- [references/repo-contract-discovery.md](references/repo-contract-discovery.md)
- [references/release-evidence-pack.md](references/release-evidence-pack.md)
- [references/release-command-templates.md](references/release-command-templates.md)
- [references/release-operator-playbooks.md](references/release-operator-playbooks.md)
- [references/trusted-publishing-troubleshooting.md](references/trusted-publishing-troubleshooting.md)
