# Repository Contract Discovery

Use this reference at the start of any unfamiliar npm release task. Its purpose is to quickly determine the repository's real publish contract before you start bumping versions or triggering workflows.

## Goal

Answer these questions with evidence:

1. Is this a single-package repo or a monorepo?
2. Which package is actually public?
3. Which workflow is the authoritative release chain?
4. Is the real publish trigger tag, release, workflow dispatch, or something else?
5. Are release assets expected in GitHub Releases or only in CI artifacts?

Do not guess. A large share of release mistakes come from assuming the wrong contract.

## 1. Detect Single Package vs Monorepo

### Quick checks

Look for:

- root-only `package.json` with no workspaces
- `workspaces` field in root `package.json`
- package managers like `pnpm-workspace.yaml`, `turbo.json`, `lerna.json`
- a `packages/` directory containing multiple publishable manifests

Commands:

```bash
cat package.json
rg --line-number "\"workspaces\"|name|version|private" package.json packages/*/package.json
ls
```

### Interpretation

- **Single-package repo**: one public package surface, usually root-only
- **Monorepo**: multiple package manifests; may still publish only one public package

Important: monorepo does not automatically mean multi-package publish.

## 2. Identify The Public Package Surface

Check all package manifests and distinguish:

- public package(s)
- internal-only workspaces
- bundled internal dependencies
- version-locked internal packages

What to inspect:

- `name`
- `private`
- `files`
- `bundleDependencies`
- internal dependency references

Commands:

```bash
rg --line-number "\"name\"|\"private\"|\"bundleDependencies\"|\"files\"" package.json packages/*/package.json
npm pack --json
```

Questions to answer:

- what package name will users install from npm?
- is the public package root or a workspace?
- do internal workspaces need version parity with the public package?

## 3. Find The Authoritative Workflow

Repositories often contain more than one workflow with publish-like names. Do not assume the first one you see is the real one.

Inspect:

```bash
ls .github/workflows
rg --line-number "npm publish|gh release upload|workflow_dispatch|release:|push:.*tags|id-token|NODE_AUTH_TOKEN|NPM_TOKEN" .github/workflows/*.yml
```

### What to look for

- which workflow actually runs `npm publish`
- whether it uses Trusted Publishing (`id-token: write`) or a token (`NODE_AUTH_TOKEN`, `NPM_TOKEN`)
- whether it also runs pack, tests, and asset upload
- whether another workflow is obviously legacy

### Decide the authoritative chain

The authoritative workflow is the one that the team should treat as the default real publish path. It should usually be the workflow that:

- performs the real `npm publish`
- matches the intended auth model
- is referenced in release docs or recent release history

## 4. Identify The Real Publish Trigger

The workflow file name is not enough. You also need to know what event triggers the real release.

Common triggers:

- `push` to tags
- `release.published`
- `workflow_dispatch`
- custom branch pushes

Inspect:

```bash
cat .github/workflows/<workflow>.yml
```

Specifically check:

- `on.release.types`
- `on.push.tags`
- `on.workflow_dispatch`
- any conditional logic that changes behavior per event

### Why this matters

Two workflows can share the same file and still behave differently depending on event type. For example:

- `workflow_dispatch` may skip GitHub Release asset upload
- `release.published` may perform the real npm publish
- dry-run flags may only exist in dispatch mode

## 5. Determine Whether Release Assets Are Expected

Not every npm publish path should produce GitHub Release assets.

Inspect:

- whether the workflow runs `npm pack`
- whether it uploads CI artifacts
- whether it conditionally uploads `.tgz` or manifest files to GitHub Releases

Commands:

```bash
rg --line-number "npm pack|upload-artifact|gh release upload|manifest.json|\\.tgz" .github/workflows/*.yml
```

### Questions to answer

- Are `.tgz` assets uploaded only on release events?
- Are they always uploaded as CI artifacts, even on failed runs?
- Is a release asset missing actually a bug, or expected behavior for the trigger used?

## 6. Check Existing Live State

Use real registry and release history to confirm your interpretation.

### npm

```bash
npm view <package-name> version dist-tags --json --registry=https://registry.npmjs.org
```

### GitHub Actions

```bash
gh run list --workflow <workflow-file-or-name> --limit 10
```

### GitHub Releases

```bash
gh release list
```

### Trusted publisher state

```bash
npm trust list <package-name>
```

These commands tell you what the repository actually did recently, which is often more useful than stale docs.

## 7. Discovery Checklist

Before proceeding with a release, answer all of these:

- [ ] I know whether the repo is single-package or monorepo
- [ ] I know which package name is public
- [ ] I know whether internal version parity is enforced
- [ ] I know which workflow is authoritative
- [ ] I know which trigger performs the real publish
- [ ] I know whether release assets are expected for this trigger
- [ ] I know whether the repo uses Trusted Publishing or token auth
- [ ] I have checked current npm registry state
- [ ] I have checked current trust relationship if Trusted Publishing is used

If any of these are still unknown, do not proceed to version bump or release execution yet.
