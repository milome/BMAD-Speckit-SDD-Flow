# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **CONTRIBUTING.md** — Open source contributing guide with dev setup, PR process, and code style
- **CODE_OF_CONDUCT.md** — Contributor Covenant v2.1
- **CHANGELOG.md** — This file (Keep a Changelog format)
- **docs/explanation/** — New explanation docs: `architecture.md`, `scoring-system.md`, `party-mode.md`
- **docs/reference/** — New reference docs: `configuration.md`, `agents.md`, `skills.md`
- **website/** — Astro + Starlight documentation site with Diataxis sidebar
- **tests/** — Dedicated test directory: `tests/acceptance/` (32 vitest tests), `tests/epic-acceptance/` (13 ts-node scripts)
- **packages/scoring/** — Scoring system moved into monorepo workspace with independent `package.json`

### Changed

- **Phase A** — Committed prior staged changes (runtime cleanup, speckit integration, path fixes)
- **Phase B** — `.gitignore`: DC-05 root-only match (`/commands/`, `/rules/`, `/skills/`), `*.backup-*.md`; removed sensitive/temp files from git; cleaned docs/ gitignored residuals from index
- **Phase C** — docs/ restructured to Diataxis: `tutorials/`, `how-to/`, `explanation/`, `reference/`; migrated 8 root docs + 5 guide/ files via `git mv`; updated internal link references
- **Phase D** — CLAUDE.md and README.md: updated directory structure, removed runtime dir descriptions, added Diataxis doc links
- **Phase E** — `scoring/` → `packages/scoring/`; added npm workspaces; updated all import paths; gitignored scoring runtime data
- **Phase F** — Acceptance tests migrated from `scripts/` to `tests/`; updated package.json npm scripts for new paths
- **Phase G** — Speckit source files consolidated into `_bmad/speckit/`; deployed to `.specify/` with prefix stripping; `.speckit/config.yaml` → `config/speckit.yaml`
- **FU-01** — Merged migration install content into `getting-started.md`; `migration.md` retains migration-only content
- **FU-02** — Created 6 new docs (architecture, scoring-system, party-mode, configuration, agents, skills)
- **FU-03** — Merged `bmad-story-assistant-cursor.md` and `bmad-story-assistant-claude.md` into `bmad-story-assistant.md`
- **FU-04** — Website setup with Astro + Starlight, sidebar by Diataxis 4 blocks

### Removed

- **docs/guide/** — Migrated to Diataxis categories; `guide-index.md` in `how-to/`
- **docs/QUICKSTART.md**, **docs/UPSTREAM.md**, **docs/PATH_CONVENTIONS.md** — Migrated to Diataxis paths
- **scoring/** (root) — Moved to `packages/scoring/`
- **scripts/accept-*.test.ts**, **scripts/accept-*.ts** — Moved to `tests/`
- **docs/how-to/bmad-story-assistant-cursor.md**, **docs/how-to/bmad-story-assistant-claude.md** — Merged into single file
