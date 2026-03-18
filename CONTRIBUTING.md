# Contributing to BMAD-Speckit-SDD-Flow

Thank you for your interest in contributing! This guide explains how to set up a
development environment, follow project conventions, and submit changes.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| PowerShell | 7+ (Windows); bash works on macOS/Linux |
| Git | 2.30+ |

## Getting Started

```bash
# 1. Fork & clone
git clone https://github.com/<your-fork>/BMAD-Speckit-SDD-Flow.git
cd BMAD-Speckit-SDD-Flow

# 2. Install dependencies (runs postinstall automatically)
npm install

# 3. Verify the setup
npm test
```

The `postinstall` script copies `_bmad/` artifacts into your project root so
that AI agents and skills are available immediately.

## Repository Layout

```
_bmad/              # BMAD core modules (single source of truth)
  speckit/          # Speckit commands, templates, workflows, scripts
  core/             # Core BMAD workflows & agent definitions
  _config/          # Configuration YAML files
packages/           # Monorepo workspaces
  bmad-speckit/     # CLI package (published to npm)
  scoring/          # Scoring, Coach, SFT extraction
scripts/            # Entry-point scripts & acceptance tests
docs/               # Documentation (Diataxis structure)
website/            # Astro + Starlight documentation site
tests/              # Acceptance & regression tests
```

See [`docs/explanation/architecture.md`](docs/explanation/architecture.md) for a
deeper dive into the five-layer architecture.

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feat/my-feature
```

Use the naming convention: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`,
`chore/`.

### 2. Write Code

Follow these conventions:

- **Immutability** — create new objects instead of mutating existing ones.
- **Small files** — 200–400 lines typical, 800 max.
- **Functions < 50 lines** — extract helpers when a function grows.
- **No hardcoded values** — use configuration or constants.
- **Explicit error handling** — handle errors at every level.
- **Input validation** — validate at system boundaries.

### 3. Run Tests

```bash
# All tests
npm test

# Scoring package only
npm run test:scoring

# BMAD acceptance tests
npm run test:bmad

# Lint
npm run lint

# Format check
npm run format:check
```

All tests must pass before submitting a pull request.

### 4. Commit

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

<optional body>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

Keep commits atomic — one logical change per commit.

### 5. Open a Pull Request

- Provide a clear title and description.
- Reference related issues (e.g., `Closes #42`).
- Ensure CI passes.
- Request review from at least one maintainer.

## Testing Guidelines

- **TDD Red-Green-Refactor**: write a failing test first, make it pass with
  minimal code, then improve.
- Place unit tests alongside the source in `__tests__/` directories or in
  `tests/` at the repo root for acceptance/integration tests.
- Use `vitest` for TypeScript tests and `node --test` for the `bmad-speckit`
  CLI package.

## Speckit & BMAD Workflow

When implementing stories via the BMAD workflow:

1. Each speckit phase (specify → plan → GAPS → tasks → implement) must pass
   its audit before proceeding.
2. Implementation tasks follow strict TDD (see
   [`docs/explanation/architecture.md`](docs/explanation/architecture.md)).
3. Use `TodoWrite` for task tracking inside AI-assisted sessions.

## Documentation

Documentation lives in `docs/` and follows the
[Diataxis](https://diataxis.fr/) framework:

| Category | Purpose | Path |
|----------|---------|------|
| Tutorials | Learning-oriented | `docs/tutorials/` |
| How-To Guides | Task-oriented | `docs/how-to/` |
| Explanation | Understanding-oriented | `docs/explanation/` |
| Reference | Information-oriented | `docs/reference/` |

To preview the docs site locally:

```bash
cd website
npm install
node sync-docs.js
npm run dev
```

## Reporting Issues

- Search existing issues first to avoid duplicates.
- Provide a minimal reproduction case.
- Include environment details (OS, Node version, npm version).

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By
participating you agree to abide by its terms.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
