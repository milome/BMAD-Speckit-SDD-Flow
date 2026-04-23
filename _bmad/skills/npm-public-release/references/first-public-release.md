# First Public Release Checklist

This checklist is for the first time a repository is being released publicly to npm, or when a repository is migrating from an older or ad hoc publish flow to a stable public release contract.

## Goal

Get from "package exists only in source control" to "package is publicly installable from npm and reproducibly releasable through CI".

## 1. Freeze The Intended Public Package Surface

Before publishing, answer these questions explicitly:

- What is the public package name?
- Is the repository single-package or monorepo?
- If monorepo, which package is actually public?
- Are any internal workspaces version-locked to the public package?
- Which files are part of the packed publish surface?

Inspect the package metadata that will actually be published, usually the target package's `package.json`.

Verify at least:

- `name` is correct and available for publication
- `version` is set
- `repository.url` matches the real Git host/repo
- `bugs.url` and `homepage` are set when appropriate
- `files` includes everything the packed README depends on
- `dependencies`, `bundleDependencies`, and workspace references are consistent with the intended publish model

## 2. Stabilize README And Asset Packaging

Public packages often fail their first release because the README renders differently on npm than it does locally.

Before first release:

- make README paths deliberate
- ensure referenced assets are tracked in source control
- ensure `npm pack --json` includes required assets and companion files
- ensure repository metadata supports provenance and source linking

Recommended validation:

```bash
npm pack --json
```

Check the packed artifact contains what the README requires, such as:

- image assets
- secondary README files
- templates or static files referenced by docs

## 3. Choose The Publish Method

Decide whether the repository will publish via:

- npm Trusted Publishing through GitHub OIDC
- token-based publication using `NPM_TOKEN`
- another CI-integrated release mechanism

Preferred default for GitHub-hosted repos is Trusted Publishing.

If multiple workflows exist, identify which one is authoritative before publishing.

## 4. Configure npm Authentication / Trust

### Trusted Publishing path

If using Trusted Publishing, create the npm Trusted Publisher entry that matches:

- provider (for example GitHub)
- repository
- workflow file
- organization / owner as required

After configuration, package provenance and repository metadata must agree. Typical failures here are caused by:

- wrong `repository.url`
- wrong workflow file binding
- workflow path or branch mismatch

#### Current npm account-protection tip

npm's current 2FA and account-protection flows are centered on the security-key / WebAuthn flow, and npm recommends configuring that path on the website.

Practical rule:

- if the npm website requires you to configure a security key, passkey, or other WebAuthn-based factor before enabling 2FA or related account protections, do that first
- do not wait until the release workflow is ready to discover this prerequisite

Why this matters:

- package write and trust operations often assume the account's security settings are already in a releasable state
- Trusted Publishing reduces the need for long-lived tokens, but the npm account still needs the right protection setup and permissions

Useful background:

- 2FA with security-key / WebAuthn can be configured from the web
- npm publishing requires either 2FA enabled on the account or a granular token with bypass 2FA enabled
- Trusted Publishing is preferred for CI/CD when available

#### CLI equivalent for configuring trust

npm provides a CLI for managing trusted publisher relationships.

Important prerequisites from npm:

- `npm@11.10.0` or newer for `npm trust`
- write access on the package
- account-level 2FA enabled
- the package must already exist on npm

Recommended commands for GitHub Actions:

```bash
npm trust github <package-name> --repo <owner/repo> --file <workflow-file.yml> --yes
```

Examples:

```bash
npm trust github my-package --repo my-org/my-repo --file release.yml --yes
npm trust github my-package --repo my-org/my-repo --file publish.yml --yes
```

Verify the trusted publisher relationship after creation:

```bash
npm trust list <package-name>
```

If you need to replace an existing relationship, npm currently allows only one trusted publisher configuration per package. Use:

```bash
npm trust list <package-name>
npm trust revoke <package-name> --id <trust-id>
npm trust github <package-name> --repo <owner/repo> --file <workflow-file.yml> --yes
```

Operational rule:

- Do not treat \"saved in npm UI\" or \"trust command returned successfully\" as full verification.
- Always follow trust configuration with:
  - `npm trust list <package-name>`
  - a workflow dry-run or a real publish-path proof

### Token-based path

If using a token-based publish flow instead:

- create a valid npm automation token
- store it in CI secrets
- ensure the workflow uses the correct registry URL and token variable

## 5. Release Workflow Preconditions

Ensure the workflow can prove release readiness before publish.

A healthy first public release workflow should validate:

1. version/tag parity if tags or releases are involved
2. dependency installation
3. build steps if needed
4. lint / static analysis
5. test suite or release-equivalent tests
6. `npm pack`
7. `npm publish`

Your local first-release readiness checks should mirror those same gates as closely as possible.

Typical command set:

```bash
npm run lint
npm test
npm publish --dry-run --access public --registry=https://registry.npmjs.org
npm pack --json
```

Adjust to the actual repo contract. Some repos will need custom build and CI-equivalent commands.

## 6. First Publish Strategy

For the first public release, the safest sequence is:

1. complete local dry-run validation
2. push the release-ready branch
3. optionally preflight the authoritative workflow in dry-run mode
4. merge to the release source-of-truth branch if required
5. create the real release event or publish trigger
6. let CI perform the real npm publish

A workflow dry-run is especially valuable when the repo supports `workflow_dispatch` preflight parameters.

Also note that npm's trusted publisher configuration itself is not equivalent to a publish proof. The strongest verification sequence is:

1. `npm trust list <package-name>`
2. workflow dry-run on the intended workflow/ref
3. successful real publish on the intended trigger path

## 7. Create The Real Release Event

The actual trigger depends on the repo contract. Common options are:

- GitHub `release.published`
- pushing a version tag
- manual `workflow_dispatch`
- a custom release pipeline

Do not assume pushing a tag is enough. Confirm what the repo really listens to.

## 8. Post-Release Verification

After the workflow completes, verify npm registry state directly:

```bash
npm view <package-name> version dist-tags --json --registry=https://registry.npmjs.org
```

Success means:

- `version` is the new version
- `dist-tags` point where intended

Also verify release artifacts if the workflow is supposed to upload them:

- packed `.tgz`
- manifest or checksum files
- release notes or attached provenance metadata if used

## 9. Common First-Release Failure Modes

- README images 404 because the assets are not tracked or not packed
- provenance verification fails because repository metadata does not match the CI identity
- version mismatch between the published package and version-locked internal packages
- workflow preflight succeeded but the real release trigger follows a different path
- publishing from the wrong branch or wrong workflow file
- package name collision or permissions issue on npm

## 10. First-Release Exit Criteria

You can call first public release setup complete only when all of the following are true:

- local lint/test/dry-run/pack checks are green
- the chosen publish auth model is configured and proven
- npm registry shows the expected package version and dist-tag
- release assets exist if the workflow is supposed to upload them
- future maintainers can repeat the release using the documented process rather than tribal knowledge
