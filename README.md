# BMAD-Speckit-SDD-Flow

English | [绠€浣撲腑鏂嘳(README.zh-CN.md)

<p align="center">
  <img src="docs/assets/readme-slogan.final.svg" alt="BMAD-Speckit-SDD-Flow slogan banner" width="100%" />
</p>

<h3 align="center">
  Governed Spec-Driven AI Delivery for Cursor and Claude Code
</h3>

<p align="center">
  <strong>Built on <a href="https://github.com/bmad-code-org/BMAD-METHOD">BMAD-METHOD</a> and <a href="https://github.com/github/spec-kit">Spec-Kit</a>.</strong><br>
  <em>Runtime governance, mandatory audit loops, dashboard observability, and published npm installation in one flow.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node.js Version"></a>
</p>

---

## Why This Flow?

Traditional AI tooling often stops at prompt orchestration. BMAD-Speckit-SDD-Flow turns that into a governed delivery pipeline: specify, plan, audit, enter implementation through readiness gates, run runtime governance during execution, then close out into scoring, dashboard, coach, and SFT data.

<p align="center">
  <img src="docs/assets/readme-architecture-overview.final.svg" alt="BMAD-Speckit-SDD-Flow architecture overview" width="100%" />
</p>

### Key Capabilities

- **5-layer delivery architecture**: Product Def 鈫?Epic Planning 鈫?Story Dev 鈫?Technical Implementation 鈫?Finish.
- **Mandatory audit loops**: governed stages require review closure before continuing.
- **Four-Signal implementation readiness**: implementation entry is blocked unless the readiness baseline covers `P0 Journey Coverage`, `Smoke E2E Readiness`, `Evidence Proof Chain`, and `Cross-Document Traceability`.
- **Runtime gate loops and rerun gates**: governed routes can re-enter, rerun, or block with the same runtime truth path instead of silently bypassing failed close-out.
- **Packet execution and closure evidence**: pass, required-fixes, blocked, and rerun outcomes are recorded as packet execution truth instead of host-local guesswork.
- **Dashboard, coach, and SFT extraction**: runtime and scoring outputs feed the same downstream observability and optimization surfaces.

> Image strategy: README assets live in `docs/assets/` and are tracked in Git. The package `README.md` is rendered on npm as GitHub Flavored Markdown, so keeping repository assets tracked and using repository-relative paths is the most reliable cross-surface strategy for GitHub and npm. Source: [About package README files](https://docs.npmjs.com/about-package-readme-files)

---

## Runtime Governance At A Glance

- **Four-Signal readiness gate** runs before implementation entry and keeps readiness scoring separate from implementation scoring.
- **`main-agent-orchestration inspect` is the first read**: the main agent reads the repo-native authoritative surface before choosing the next global branch.
- **`dispatch-plan` is conditional**: only materialize a plan when the surface says the next branch should dispatch a packet.
- **Child agents only execute a bounded packet**: they return packet results, but they do not choose the next global branch.
- **`runAuditorHost` is post-audit close-out only**: it closes approved audits into scoring, dashboard, coach, and SFT outputs, then the main agent re-reads `inspect`.
- **Legacy worker/manual close-out playbooks are historical evidence**: keep them for auditability, but they are not the active accepted runtime path.

## Dashboard And MCP

- **Dashboard is default**: the published package supports runtime dashboard status, start/stop helpers, and runtime snapshot generation without any extra MCP setup.
- **Runtime MCP is optional**: enable it only when you want runtime data exposed as agent tools via `--with-mcp`.
- **Dashboard and runtime governance do not depend on MCP**: live dashboard, hooks, scoring projection, and runtime close-out all work without `.mcp.json`.

Quick mental model:

- `dashboard`: human-facing runtime and scoring visibility
- `runtime-mcp`: explicit agent-tool surface over the same runtime data

---

## Recommended npm Installation

Ensure you have **[Node.js](https://nodejs.org) v18+** installed.

### Recommended Off-Repo Install From npm

Use the published root package directly. This is the current recommended path when you're installing into a consumer project without cloning this repository.

This is the verified off-repo path for the published package contract.

```bash
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit version
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit-init . --agent claude-code --full --no-package-json
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit-init . --agent cursor --full --no-package-json
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit-init . --agent codex --full --no-package-json
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit check
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit dashboard-status
```

Why this is the recommended path:

- it uses the published single public root package
- it aligns both host surfaces explicitly
- it preserves the non-invasive `--no-package-json` consumer install style
- it matches the validated published package flow rather than an older bootstrap-only shortcut

### Persistent Install In A Project

If you want the package present in the consumer project's dependency tree:

```bash
npm install --save-dev bmad-speckit-sdd-flow@latest
npx bmad-speckit-init . --agent claude-code --full --no-package-json
npx bmad-speckit-init . --agent cursor --full --no-package-json
npx bmad-speckit-init . --agent codex --full --no-package-json
npx bmad-speckit check
```

### Codex no-hooks five-layer path

Codex is a first-class no-hooks host. Use `bmad-help` as the user-facing entry, then run the same main-agent five-layer flow: `layer_1_intake -> layer_2_architecture -> layer_3_story -> layer_4_speckit -> layer_5_closeout`.

Use `$bmad-speckit`, `/bmad-speckit`, or `bmad-speckit` when you want BMAD-Speckit-SDD-Flow to take root governed runtime control. Short aliases `$bmads`, `/bmads`, and `bmads` are equivalent. The project intentionally does not reserve `$bmad` to avoid upstream BMAD Method conflicts.

```bash
npx bmad-speckit-init . --agent codex --full --no-package-json
npx bmad-speckit check
npm run main-agent:run-loop -- --host codex
```

See `docs/how-to/codex-setup.md` for the Codex install and runtime contract.

### Quick Bootstrap Path

The faster bootstrap command still exists:

```bash
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit init . --ai cursor-agent --yes
```

Treat that as a quick initializer, not the highest-confidence installation path for the full runtime governance surface. If you care about the latest published hooks, runtime governance, dashboard wiring, and multi-host host-matrix alignment, use the recommended installation path above.

> Need help choosing the next governed route? Run `/bmad-help` in your AI IDE. It evaluates `flow`, `contextMaturity`, `complexity`, and `implementationReadinessStatus` before recommending or blocking routes.

### Alternative Deployments

<details>
<summary><b>Install via CI Artifact (Consumer Projects)</b></summary>
<br>
If you are installing from a release artifact instead of npm registry:

1. Download the `npm-packages-<commit-sha>` artifact from GitHub Actions.
2. Extract the `bmad-speckit-sdd-flow-<version>.tgz` tarball.
3. Install and initialize:
   ```bash
   npx --yes --package ./bmad-speckit-sdd-flow-<version>.tgz bmad-speckit version
   npx --yes --package ./bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent claude-code --full --no-package-json
   npx --yes --package ./bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent cursor --full --no-package-json
   ```
   </details>

<details>
<summary><b>One-Line Deploy Scripts</b></summary>
<br>

```powershell
# Windows
pwsh scripts/setup.ps1 -Target <project-path>
```

```bash
# WSL / Linux / macOS
bash scripts/setup.sh -Target <project-path>
```

</details>

<details>
<summary><b>Safe Uninstallation</b></summary>
<br>
To remove managed installation surfaces in the current project:

```bash
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit uninstall
```

This only removes installer-managed entries. It does not delete `.cursor`, `.claude`, or global skills, and it never deletes `_bmad-output`.

</details>

---

## Architecture And Modules

### Core Components

| Component                   | Purpose                                                                                                                                    |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **`_bmad/`**                | Canonical source of truth for workflow modules, hooks, prompts, routing, and host-facing assets.                                           |
| **`packages/scoring/`**     | Scoring engine, readiness drift evaluation, dashboard projection, coach inputs, and SFT extraction.                                        |
| **`dashboard`**             | Default runtime observability surface: live dashboard, runtime snapshots, and scoring projections.                                         |
| **`runtime-mcp`**           | Optional MCP surface for agent tools over runtime data; enabled explicitly with `--with-mcp`.                                              |
| **`speckit-workflow`**      | Specify -> Plan -> GAPS -> Tasks -> TDD with mandatory audit loops.                                                                        |
| **`bmad-story-assistant`**  | Story lifecycle entry: main agent reads `inspect`, dispatches bounded packets when needed, and closes post-audit through `runAuditorHost`. |
| **`bmad-bug-assistant`**    | Bug lifecycle path: RCA -> Party Mode -> BUGFIX -> Implement, while the main Agent still owns the global `inspect -> dispatch-plan -> closeout` chain. |
| **`bmad-standalone-tasks`** | TASKS/BUGFIX execution still follows the main-agent path: `inspect` first, `dispatch-plan` only when needed, then bounded subagent work.             |

<details>
<summary><b>View Folder Structure</b></summary>

```text
BMAD-Speckit-SDD-Flow/
鈹溾攢鈹€ _bmad/                # Core modules and configuration
鈹溾攢鈹€ packages/             # Monorepo packages (CLI, scoring)
鈹溾攢鈹€ scripts/              # Setup and deployment utilities
鈹溾攢鈹€ docs/                 # Diataxis-style documentation
鈹溾攢鈹€ tests/                # Acceptance & epic testing
鈹斺攢鈹€ specs/                # Generated story specs
```

</details>

---

## Documentation

Key entry points:

- [Getting Started](docs/tutorials/getting-started.md)
- [Main-Agent Orchestration Reference](docs/reference/main-agent-orchestration.md)
- [Consumer Installation Guide](docs/how-to/consumer-installation.md)
- [Runtime Dashboard Guide](docs/how-to/runtime-dashboard.md)
- [Runtime MCP Installation](docs/how-to/runtime-mcp-installation.md)
- [Provider Configuration](docs/how-to/provider-configuration.md)
- [Cursor Setup](docs/how-to/cursor-setup.md)
- [Claude Code Setup](docs/how-to/claude-code-setup.md)
- [WSL / Shell Scripts](docs/how-to/wsl-shell-scripts.md)

---

<p align="center">
  <a href="LICENSE">MIT License</a> 鈥?  <a href="https://github.com/bmad-code-org/BMAD-METHOD">BMAD-METHOD</a> 鈥?  <a href="https://github.com/github/spec-kit">Spec-Kit</a>
</p>
