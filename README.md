# BMAD-Speckit-SDD-Flow

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

<p align="center">
  <img src="docs/assets/readme-slogan.final.svg" alt="BMAD-Speckit-SDD-Flow slogan banner" width="100%" />
</p>

**Built on** [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) and [github/spec-kit](https://github.com/github/spec-kit).
**Extended with** audit loops, critical auditor, scoring system, AI Coach, and SFT fine-tuning data extraction.

100% free and open source. No paywalls.

---

## Why BMAD-Speckit-SDD-Flow?

Traditional AI tools do the thinking for you. BMAD-Speckit-SDD-Flow combines **BMAD Method** (agile, party-mode, multi-agent) with **Spec-Driven Development** (specify → plan → GAPS → tasks → TDD).

<p align="center">
  <img src="docs/assets/readme-architecture-overview.final.svg" alt="BMAD-Speckit-SDD-Flow architecture overview" width="100%" />
</p>

What this adds in practice:

- **Five-layer architecture** — Product Brief → PRD → Architecture → Epic/Story → speckit specify/plan/GAPS/tasks → TDD implement → PR + human review
- **Mandatory audit loops** — Each stage requires code-review pass before proceeding
- **Critical Auditor** — Dedicated challenger role, >60% share in party-mode
- **Scoring system** — Multi-stage weighted scores, one-vote veto, AI Coach diagnosis
- **SFT extraction** — Instruction-response pairs from low-score runs for fine-tuning

---

## Quick Start

**Prerequisites**: [Node.js](https://nodejs.org) v18+

```bash
# Run the published root package without persisting it
npx --yes --package bmad-speckit-sdd-flow bmad-speckit init . --ai cursor-agent --yes

# Or create a new project
npx --yes --package bmad-speckit-sdd-flow bmad-speckit init my-project --ai cursor-agent --yes

# Verify installation
npx --yes --package bmad-speckit-sdd-flow bmad-speckit check
```

**Important boundary**:

- The commands above execute the **single public root package** and expose the bundled `bmad-speckit` CLI
- They are **not** the highest-confidence installation path for BMAD-Speckit-SDD-Flow custom consumer features on another machine
- If your priority scenario is **installing into a consumer project on another machine without this repository checked out**, use the verified off-repo path in [Consumer Installation Guide](docs/how-to/consumer-installation.md)
- In this repository, the verified off-repo path is: install the **root package release artifact** (`bmad-speckit-sdd-flow-<version>.tgz` or the equivalent published package), then run `npx bmad-speckit version` / `check` / `bmad-speckit-init`

### Install From A CI Artifact

If you need to install this into a consumer project on another machine without cloning this repository, use the tarball produced by the CI `package` job:

1. Download the GitHub Actions artifact named `npm-packages-<commit-sha>`
2. Extract the artifact and locate `bmad-speckit-sdd-flow-<version>.tgz`
3. Install that root package tarball in the consumer project
4. Run the verification commands before initializing host hooks

```powershell
cd D:\Dev\your-project
npm install --save-dev .\bmad-speckit-sdd-flow-<version>.tgz
npx bmad-speckit version
npx bmad-speckit check
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

Use the root package tarball as the default install artifact. The CI artifact manifest is only there to help you verify filename, version, and checksum metadata.

> **Not sure what to do?** Run `/bmad-help` in your AI IDE. 它会先识别你的 `flow / contextMaturity / complexity / implementationReadinessStatus`，再把路径标成 `recommended / allowed but not recommended / blocked`。See [Installation & Migration Guide](docs/how-to/migration.md) and [bmad-help 路由模型参考](docs/reference/bmad-help-routing-model.md) for details.

**One-line deploy**:

```powershell
# Windows
pwsh scripts/setup.ps1 -Target <project-path>
```

```bash
# WSL / Linux / macOS
bash scripts/setup.sh -Target <project-path>
# or: npm run setup:sh -- -Target <path>
```

See [WSL / Shell scripts](docs/how-to/wsl-shell-scripts.md) for full shell script reference.

面向消费项目的完整安装入口见 [Consumer Installation Guide](docs/how-to/consumer-installation.md)。如果你需要继续配置 provider 的 `baseUrl` / `apiKeyEnv` / `model`，也从这篇开始。

如果你后续需要安全卸载当前项目中的受管安装面，使用：

```bash
npx bmad-speckit uninstall
```

边界：

- 只删除安装器受管条目
- 不整删 `.cursor`、`.claude`、全局 skills 根目录
- **禁止删除 `_bmad-output`**

如果你后续确实需要把运行时信息通过工具接口暴露给 agent，再看 [Runtime MCP Installation](docs/how-to/runtime-mcp-installation.md)。该能力不是默认安装产物，需要显式启用。

---

## Built On

| Upstream                                                    | Purpose                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | Agile workflows, Party Mode, 34+ workflows                   |
| [github/spec-kit](https://github.com/github/spec-kit)       | Spec-Driven Development (constitution, specify, plan, tasks) |

**Our extensions**: scoring, critical auditor, speckit-workflow audit loops, bmad-story-assistant, bmad-bug-assistant.

---

## Project Structure

```
BMAD-Speckit-SDD-Flow/
├── _bmad/                              # BMAD core modules (single source of truth)
│   ├── speckit/                        # Speckit module (commands, templates, workflows, scripts)
│   ├── core/                           # Core BMAD functionality
│   ├── bmm/, bmb/, cis/, tea/          # Other BMAD modules
│   ├── scoring/                        # Scoring system
│   └── _config/                        # Configuration files
├── packages/                           # Source code (monorepo)
│   ├── bmad-speckit/                   # Internal CLI workspace bundled into the root package
│   └── scoring/                        # Scoring extensions (see [packages/scoring/README.md](packages/scoring/README.md))
├── tests/                              # Test suite (acceptance/, epic-acceptance/)
├── scripts/                            # Deployment/utility scripts only
│   └── _config/                        # Project configuration (merged from former root config/)
├── specs/                              # Story specifications (generated)
├── docs/                               # Documentation (Diataxis)
│   ├── tutorials/                      # Learning-oriented
│   ├── how-to/                         # Task-oriented
│   ├── explanation/                    # Understanding-oriented
│   ├── reference/                      # Information-oriented
│   └── sample/                         # Example documents
└── package.json
```

## Modules & Components

| Component                 | Purpose                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **\_bmad/**               | BMAD core (core, bmm, bmb, cis, tea, scoring)                                                                                                                |
| **packages/scoring/**     | Scoring extensions: audit report parsing, score persistence, Coach diagnosis, Dashboard, SFT extraction                                                      |
| **scripts/**              | Deployment/utility scripts: init-to-root, setup. Scoring 已整合进 bmad-speckit CLI，目标项目使用 `npx bmad-speckit score/coach/dashboard/sft-extract/scores` |
| **speckit-workflow**      | specify → plan → GAPS → tasks → TDD with mandatory audits                                                                                                    |
| **bmad-story-assistant**  | Create Story → Party-Mode → Dev Story → implement                                                                                                            |
| **bmad-bug-assistant**    | Bug description → Party-Mode → BUGFIX doc                                                                                                                    |
| **bmad-standalone-tasks** | Execute TASKS/BUGFIX docs via subagents                                                                                                                      |

---

## Documentation

- [Getting Started](docs/tutorials/getting-started.md)
- [Consumer Installation Guide](docs/how-to/consumer-installation.md)
- [Installation & Migration Guide](docs/how-to/migration.md)
- [Cursor Setup](docs/how-to/cursor-setup.md)
- [Claude Code Setup](docs/how-to/claude-code-setup.md)
- [Provider Configuration](docs/how-to/provider-configuration.md)
- [Runtime MCP Installation](docs/how-to/runtime-mcp-installation.md)
- [WSL / Shell Scripts](docs/how-to/wsl-shell-scripts.md)

---

## License

MIT License — see [LICENSE](LICENSE) for details.
