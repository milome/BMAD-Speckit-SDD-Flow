# Requirements Skills Release Sync Task List

Date: 2026-05-10

## Scope Lock

- Goal: add `requirements-contract-authoring` and `req-trace-matrix-prompt-generator` as project-distributed skills under `_bmad/skills/`, then define the packaging, release, deployment, and global skill sync tasks required to ship them safely.
- Source of truth for this sync: `%USERPROFILE%\.codex\skills\requirements-contract-authoring` and `%USERPROFILE%\.codex\skills\req-trace-matrix-prompt-generator`.
- In scope: canonical skill files, packaged `_bmad` mirror, runtime deployment into `.cursor/.claude/.codex`, global skills install scripts, consumer installation validation, npm pack/release gates, and documentation closeout.
- Out of scope for this document: publishing to npm, pushing tags, pushing branches, changing skill behavior, or reducing either skill's scope.

## Current Sync Result

- `requirements-contract-authoring` is now present under `_bmad/skills/requirements-contract-authoring/`.
- `req-trace-matrix-prompt-generator` is now present under `_bmad/skills/req-trace-matrix-prompt-generator/`.
- The copied file sets are:
  - `_bmad/skills/requirements-contract-authoring/SKILL.md`
  - `_bmad/skills/requirements-contract-authoring/agents/openai.yaml`
  - `_bmad/skills/requirements-contract-authoring/references/contract-template.md`
  - `_bmad/skills/requirements-contract-authoring/references/e2e-dod.md`
  - `_bmad/skills/requirements-contract-authoring/references/matrix-rules.md`
  - `_bmad/skills/requirements-contract-authoring/references/reverse-audit-gate.md`
  - `_bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js`
  - `_bmad/skills/req-trace-matrix-prompt-generator/SKILL.md`
  - `_bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.py`

## Packaging And Deployment Findings

- Root package inclusion is already broad enough: `package.json` includes `_bmad` in `files`, so both skills are included in root npm tarballs after they are tracked.
- Workspace CLI package inclusion is already broad enough: `packages/bmad-speckit/package.json` includes `_bmad/`, and `scripts/prepublish-check.js` mirrors root `_bmad` to `packages/bmad-speckit/_bmad`.
- Runtime host deployment is already broad enough: `scripts/init-to-root.js` syncs `_bmad/skills` into `.cursor/skills`, `.claude/skills`, and `.codex/skills`.
- Install surface manifest discovery is already dynamic: `packages/bmad-speckit/src/services/install-surface-manifest.js` derives host/global skill paths from `_bmad/skills`, so no per-skill manifest list should be needed.
- Global setup scripts are not fully dynamic: `scripts/setup.ps1` and `scripts/setup.sh` use hardcoded skill arrays, so these two skill names must be added there if setup should install them into user-level/global skills directories.
- Acceptance tests currently assert representative skills such as `npm-public-release` and `encoding-integrity-guardian`; they should be extended to assert these two new skills in consumer runtime and global sync paths.

## Required Task List

### A. Canonical Skill Source

- [x] Copy `requirements-contract-authoring` from `%USERPROFILE%\.codex\skills` to `_bmad/skills/requirements-contract-authoring`.
- [x] Copy `req-trace-matrix-prompt-generator` from `%USERPROFILE%\.codex\skills` to `_bmad/skills/req-trace-matrix-prompt-generator`.
- [ ] Compare local vs global file hashes before commit and record any drift.
- [ ] Decide ownership direction for future changes: global-to-project import, project-to-global export, or bidirectional with explicit review.
- [ ] Add a short note in the release PR that these are full project-distributed skills, not local-only Codex runtime copies.

### B. Skill Integrity And Runtime Self-Checks

- [ ] Run `node --check _bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js`.
- [ ] Run `python -m py_compile _bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.py`.
- [ ] Run the `req-trace-matrix-prompt-generator` script against a small fixture contract to verify prompt generation and `MISSING_INPUT` behavior.
- [ ] Run the `requirements-contract-authoring` reverse audit script against a small fixture contract to verify PASS/FAIL parsing behavior.
- [ ] Confirm each `SKILL.md` frontmatter has stable `name` and `description` fields and no host-specific absolute paths.
- [ ] Confirm scripts and references use relative skill paths or documented `<skill-dir>` placeholders only.

### C. Global Skill Install Scripts

- [x] Add `requirements-contract-authoring` to `scripts/setup.ps1` skill arrays.
- [x] Add `req-trace-matrix-prompt-generator` to `scripts/setup.ps1` skill arrays.
- [x] Add `requirements-contract-authoring` to `scripts/setup.sh` skill arrays.
- [x] Add `req-trace-matrix-prompt-generator` to `scripts/setup.sh` skill arrays.
- [x] Extend `tests/acceptance/setup-global-skill-sync-contract.test.ts` to assert both new names are present in PowerShell and shell setup scripts.
- [x] Verify setup scripts still remove existing destination skill directories before copying, preventing stale nested installs.
- [x] Decide whether both skills are `OPTIONAL_SKILLS` or a separate requirements-contract bundle. Decision: `OPTIONAL_SKILLS`, because core BMAD runtime should not depend on them to start.

### D. Runtime Host Deployment

- [ ] Run `node scripts/init-to-root.js --agent cursor <temp-consumer>` and verify `.cursor/skills/requirements-contract-authoring/SKILL.md`.
- [ ] Run `node scripts/init-to-root.js --agent cursor <temp-consumer>` and verify `.cursor/skills/req-trace-matrix-prompt-generator/SKILL.md`.
- [ ] Run `node scripts/init-to-root.js --agent claude-code <temp-consumer>` and verify `.claude/skills/requirements-contract-authoring/SKILL.md`.
- [ ] Run `node scripts/init-to-root.js --agent claude-code <temp-consumer>` and verify `.claude/skills/req-trace-matrix-prompt-generator/SKILL.md`.
- [ ] Run `node scripts/init-to-root.js --agent codex <temp-consumer>` and verify `.codex/skills/requirements-contract-authoring/SKILL.md`.
- [ ] Run `node scripts/init-to-root.js --agent codex <temp-consumer>` and verify `.codex/skills/req-trace-matrix-prompt-generator/SKILL.md`.
- [ ] Confirm Codex frontmatter normalization does not rewrite or corrupt either `SKILL.md`.
- [ ] Extend `tests/acceptance/accept-install-consumer-cli.test.ts` to assert both new skills for Cursor, Claude, and Codex install paths.

### E. Install Surface Manifest And Check Command

- [ ] Run consumer init and inspect `_bmad-output/config/bmad-speckit-install-manifest.json`.
- [ ] Confirm `.cursor/skills/requirements-contract-authoring` and `.cursor/skills/req-trace-matrix-prompt-generator` appear as managed surface entries.
- [ ] Confirm `.claude/skills/requirements-contract-authoring` and `.claude/skills/req-trace-matrix-prompt-generator` appear after Claude init.
- [ ] Confirm `.codex/skills/requirements-contract-authoring` and `.codex/skills/req-trace-matrix-prompt-generator` appear after Codex init.
- [ ] Run `npx bmad-speckit check` in a temp consumer after each host init.
- [ ] Delete one deployed new skill from a temp consumer and confirm `npx bmad-speckit check` reports the missing skill when it is managed.

### F. Npm Pack And Prepublish

- [ ] Run `npm run check:encoding`.
- [ ] Run `npm run verify:hooks`.
- [ ] Run `npm run build:scoring`.
- [ ] Run `npm run build:runtime-context`.
- [ ] Run `npm run build:runtime-emit`.
- [ ] Run `npm run build:ralph-method`.
- [ ] Run `node scripts/prepublish-check.js` and confirm `packages/bmad-speckit/_bmad/skills/requirements-contract-authoring/SKILL.md` exists.
- [ ] Run `node scripts/prepublish-check.js` and confirm `packages/bmad-speckit/_bmad/skills/req-trace-matrix-prompt-generator/SKILL.md` exists.
- [ ] Run `npm pack --dry-run --json` and confirm both skill directories are listed in package contents.
- [ ] Run the root pack acceptance test: `npx vitest run tests/acceptance/accept-pack-bmad-speckit.test.ts`.

### G. Consumer Install Regression

- [ ] Install the packed root tarball into a clean temp consumer.
- [ ] Confirm `node_modules/bmad-speckit-sdd-flow/_bmad/skills/requirements-contract-authoring/SKILL.md` exists.
- [ ] Confirm `node_modules/bmad-speckit-sdd-flow/_bmad/skills/req-trace-matrix-prompt-generator/SKILL.md` exists.
- [ ] Confirm postinstall deployed both skills to the default Cursor runtime.
- [ ] Re-run `npx bmad-speckit-init --agent claude-code` and confirm both skills deploy to `.claude/skills`.
- [ ] Re-run `npx bmad-speckit-init --agent codex` and confirm both skills deploy to `.codex/skills`.
- [ ] Run `npx bmad-speckit version` and `npx bmad-speckit check` in the consumer.

### H. Release Documentation And Changelog

- [ ] Add a `CHANGELOG.md` entry naming both new distributed skills.
- [ ] Update setup or installation docs if they enumerate global skills.
- [ ] Update any skill inventory docs if they list `_bmad/skills` contents.
- [ ] Mention that `requirements-contract-authoring` includes a reverse audit script and reference templates.
- [ ] Mention that `req-trace-matrix-prompt-generator` includes a Python prompt generator script.

### I. Release Execution

- [ ] Verify no unrelated dirty worktree changes are included.
- [ ] Commit with repository format, for example `feat(skills): 同步需求契约技能`.
- [ ] Run the full release gate selected for the release branch.
- [ ] Only after all gates pass, run the npm release flow.
- [ ] Do not claim release readiness until pack, consumer install, runtime deployment, and encoding integrity are all evidenced.

## Recommended Minimal Verification Set For This Change

Use this set before opening a PR if time is limited:

```powershell
node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js
node --check _bmad/skills/requirements-contract-authoring/scripts/reverse_audit_contract.js
python -m py_compile _bmad/skills/req-trace-matrix-prompt-generator/scripts/generate_prompt.py
node scripts/prepublish-check.js
npm pack --dry-run --json
npx vitest run tests/acceptance/setup-global-skill-sync-contract.test.ts tests/acceptance/accept-install-consumer-cli.test.ts
```

Use the full release set before publishing:

```powershell
npm run prepublishOnly
npx vitest run tests/acceptance/accept-pack-bmad-speckit.test.ts
npm run test:ci:codex
npm run test:ci:claude-cursor
```

## Risks And Controls

- Risk: setup scripts do not install the new global skills because their skill arrays are hardcoded.
  Control: update `scripts/setup.ps1`, `scripts/setup.sh`, and their contract test.
- Risk: local project copy drifts from global skill source after future edits.
  Control: add a hash comparison or documented sync receipt during release.
- Risk: Python availability differs across consumer environments.
  Control: document that `generate_prompt.py` is an optional local helper and validate graceful fallback/manual generation in `SKILL.md`.
- Risk: npm tarball includes `_bmad`, but bundled workspace mirror is stale.
  Control: run `node scripts/prepublish-check.js` before pack and verify `packages/bmad-speckit/_bmad/skills/*`.
- Risk: deployed host skills are overwritten by platform-specific skill directories with the same name.
  Control: confirm no `_bmad/cursor/skills/*`, `_bmad/claude/skills/*`, or `_bmad/codex/skills/*` override exists for these two names unless intentionally added.
