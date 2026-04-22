# BMAD-Speckit 入门教程

> 从零到生成第一个 `spec.md` 的完整路径。涵盖安装、配置与第一次使用。
> 现有项目迁移请参阅 [迁移指南](../how-to/migration.md)。

---

## 1. 前置条件

| 条件       | 要求   | 说明                                         |
| ---------- | ------ | -------------------------------------------- |
| Node.js    | ≥18    | 运行 `init-to-root.js` 和 `bmad-speckit` CLI |
| PowerShell | ≥7     | 运行 `check-prerequisites.ps1` 等脚本        |
| Cursor IDE | 最新版 | 使用 skills、commands、rules                 |
| Git        | ≥2.x   | worktree、分支管理                           |

```powershell
git clone <BMAD-Speckit-SDD-Flow-repo-url> D:\Dev\BMAD-Speckit-SDD-Flow
```

---

## 2. 安装

### 2.0 安装方式对比与选择

| 方式                    | 部署内容                     | 额外步骤               | 适用场景                                                              |
| ----------------------- | ---------------------------- | ---------------------- | --------------------------------------------------------------------- |
| **方式一 npx**          | 公开 root 包临时执行         | 无                     | 无 clone、无 PowerShell；注意：可能无本仓库最新定制（运行时治理、双语等） |
| **方式二 setup.ps1**    | 本仓库 \_bmad 全量           | 全局 Skills + 自动校验 | **首选**：有 PowerShell 7 时，一键完整安装                            |
| **方式三 npm install**  | 本仓库 \_bmad（postinstall） | 会创建 node_modules    | 需要本地 bmad-speckit 依赖的项目                                      |
| **方式四 init-to-root** | 本仓库 \_bmad 全量           | 无；Skills 已在项目内  | 无 PowerShell、CI/CD、或只需部署到单项目时                            |

**setup.ps1 与 init-to-root 的关系**：setup.ps1 内部调用 init-to-root，并额外完成「全局 Skills 安装」和「安装验证」。单独使用 init-to-root 时，项目内 `.cursor/skills` 已有完整 skills，**项目可正常工作**；仅当希望其他未安装 BMAD 的项目也能用这些 skills 时，才需要手动复制到全局。

### 2.0A 最高优先级场景：另一台没有本仓库源码的机器

如果你的最高优先级场景是：

- 在**另一台机器**
- **没有** `BMAD-Speckit-SDD-Flow` 仓库源码
- 要给一个消费项目安装本仓库的定制能力

那么文档里应优先遵循的，是**已验证的 off-repo 安装路径**：

1. 从 GitHub Actions 的 `CI` workflow 下载 `package` job 产出的 artifact：`npm-packages-<commit-sha>`
2. 解压 artifact，获取根包发布产物：`bmad-speckit-sdd-flow-<version>.tgz`
3. 在消费项目根目录通过 `npx --package <tgz>` 临时执行 CLI，而不是把 tgz 持久化安装进项目依赖
4. 先验证 `bmad-speckit version`
5. 再验证 `bmad-speckit check`
6. 最后执行 `bmad-speckit-init . --agent claude-code --full --no-package-json`
7. 再执行 `bmad-speckit-init . --agent cursor --full --no-package-json`

这组 artifact 当前会包含：

- `bmad-speckit-sdd-flow-<version>.tgz`
- `manifest.json`

默认应优先使用 **根包 tgz**，也就是 `bmad-speckit-sdd-flow-<version>.tgz`。

继续展开后，完整命令如下：

```powershell
cd D:\Dev\your-project
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit version
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit check
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent claude-code --full --no-package-json
npx --yes --package .\bmad-speckit-sdd-flow-<version>.tgz bmad-speckit-init . --agent cursor --full --no-package-json
```

这条路径是**非侵入式安装**：

- 不会把 `bmad-speckit-sdd-flow` 写入消费项目的 `package.json`
- 不会重写消费项目的 `package-lock.json`
- 只会把 BMAD install surface 部署到项目目录（如 `_bmad`、`.claude`、`.cursor`、`_bmad-output`）

这条路径在仓库内有 acceptance 证据：

- `tests/acceptance/accept-root-package-bmad-speckit-bin.test.ts`
- `tests/acceptance/accept-install-consumer-cli.test.ts`

**不要**把下面的“方式一 npx 免安装”理解为这条高优先级场景的默认答案。
它只是上游 bootstrap 入口，不是本仓库定制 consumer 安装链的最高置信路径。

### 2.0B 如何识别 CI artifact 里的正确安装包

当你从 `npm-packages-<commit-sha>` 解压出多个文件时，按下面规则选：

| 文件                                  | 用途                                   | 是否默认用于消费项目安装 |
| ------------------------------------- | -------------------------------------- | ------------------------ |
| `bmad-speckit-sdd-flow-<version>.tgz` | 根包，包含 consumer 安装主路径所需骨架 | **是**                   |
| `manifest.json`                       | artifact 元数据，帮助核对版本与文件名  | 建议保留                 |

如果你是“另一台没有本仓库源码的机器”这个场景，直接选择根包 tgz 即可。

### 2.1 方式一：npx 免安装

无需克隆源仓库，直接在目标项目中运行：

```powershell
cd D:\Dev\your-project
npx --yes --package bmad-speckit-sdd-flow bmad-speckit init . --ai cursor-agent --yes
```

此方式应理解为**公开 root 包的快速初始化入口**。它是否包含本仓库当前所有定制能力，取决于 npm 上实际发布的包内容。

**本文不把它当作“另一台没有本仓库源码的机器”的最高优先级默认方案。**

这条路径的边界必须明确：

- `npx --package bmad-speckit-sdd-flow bmad-speckit init` 是“公开 root 包快速初始化”入口
- 它**不等价于**本仓库 `setup.ps1` / `init-to-root.js` 的完整定制部署
- 如果你需要本仓库新增的 runtime governance 运行链细节，例如：
  - `.claude/hooks/governance-runtime-worker.cjs`
  - `.claude/hooks/governance-remediation-runner.cjs`
  - `.cursor/hooks/governance-runtime-worker.cjs`
  - `.cursor/hooks/governance-remediation-runner.cjs`
  - 更新后的 `post-tool-use.cjs` / `stop.cjs` 可见日志
  - 最新消费项目零-`scripts/` 治理链修复
    则**不要只停留在 `npx init`**，必须改用方式二、三或四。

> **注意**：`npx --package bmad-speckit-sdd-flow bmad-speckit init` 使用的是公开 root 包里的 bundled CLI。若需本仓库未发布的最新定制能力（运行时治理 hooks、双语 i18n 等），请使用方式二或方式四从本地 \_bmad 部署。
>
> 若本仓库定制已发布到 npm（或自建 registry），`npx --package bmad-speckit-sdd-flow bmad-speckit init` 即可使用全部功能；当前建议方式二或方式四，是因为公开 npm 包可能尚未包含未发布改动。

### 2.2 方式二：PowerShell 一键安装（推荐，有 PowerShell 时）

需要 PowerShell ≥7，在 **BMAD-Speckit-SDD-Flow 源仓库根目录**执行：

```powershell
pwsh scripts/setup.ps1 -Target D:\Dev\your-project -Full
```

该脚本自动完成：核心目录部署（含运行时治理 hooks、双语 i18n）+ `.cursor/` 同步 + 项目根 `specs/`（空目录）+ **全局 Skills 安装** + **安装验证**。验证本仓库定制能力（运行时治理、双语等）时优先用此方式。

### 2.3 方式三：npm 本地安装（仅限明确接受依赖持久化）

```powershell
cd D:\Dev\your-project

# 安装（postinstall 自动部署 _bmad、.cursor、package.json 等）
npm install --save-dev D:\Dev\BMAD-Speckit-SDD-Flow

# 若要生成 Claude Code 隔离运行时，显式执行
node D:\Dev\BMAD-Speckit-SDD-Flow\scripts\init-to-root.js D:\Dev\your-project --agent claude-code
```

这条路径的本质是“把 BMAD 当成项目本地依赖安装进当前仓库”。因此 npm 的默认行为就是：

- 写入 `package.json`
- 重写 `package-lock.json`
- 更新 `node_modules`

对业务应用仓库来说，这属于**侵入式安装**。只有在你明确希望把 BMAD 固定为项目 devDependency 时，才应使用它。

`postinstall` 脚本会**自动完成**：

- `_bmad/` → `{项目根}/_bmad/`
- `.cursor/` 同步（commands、rules、skills、agents）
- `.specify/` 模板与脚本
- `_bmad-output/config/` 空结构
- `package.json` 中 `bmad-speckit` 依赖及 `check`、`speckit` 脚本

但这里也要区分两层：

1. `npm install --save-dev D:\Dev\BMAD-Speckit-SDD-Flow`
   - 解决的是“把本仓库包安装到项目里”
   - 你会得到 `npx bmad-speckit` / `npx bmad-speckit-init`
   - 你会得到 `_bmad` 与默认 agent 的基础部署

2. **如果你要确保 Claude / Cursor 两侧运行时 hooks 都是最新、完整、可执行的**
   - 仍建议显式补跑：

```powershell
cd D:\Dev\your-project
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

原因：

- 这样可以把当前包内 `_bmad/runtime/hooks` 的共享 hook 资产，连同平台薄壳，一次性同步到项目的 `.claude/hooks` 与 `.cursor/hooks`
- 对于 runtime governance，这一步是最稳妥的“安装后对齐动作”
  - 该流程仍然满足“消费项目根目录不创建治理运行所需 `scripts/`”的约束；真正落地的是 `.claude/hooks/`、`.cursor/hooks/` 和 `_bmad/runtime/hooks/`

对于**没有本仓库源码的另一台机器**，如果你**明确接受**把根包持久化为项目依赖，才使用下面这条：

```powershell
cd D:\Dev\your-project
npm install --save-dev .\bmad-speckit-sdd-flow-0.1.0.tgz
npx bmad-speckit version
npx bmad-speckit check
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

这条 tgz 安装链属于**已验证路径**，但它是**持久化依赖模式**，不适合作为应用仓库默认方案。不要把它和上面的非侵入式 `npx --package <tgz>` 路径混为一谈。

> **提示**：对于非 Node 项目，可使用 `--no-package-json` 标志跳过 `package.json` 创建：
>
> ```powershell
> node scripts/init-to-root.js D:\Dev\your-project --no-package-json
> ```

### 2.4 方式四：init-to-root 直接调用（无 PowerShell 时）

在 **BMAD-Speckit-SDD-Flow 源仓库根目录**执行：

```powershell
git clone <BMAD-Speckit-SDD-Flow-repo-url> D:\Dev\BMAD-Speckit-SDD-Flow

cd D:\Dev\BMAD-Speckit-SDD-Flow
node scripts/init-to-root.js D:\Dev\your-project --agent cursor --full
```

**何时选用**：无法使用 PowerShell 7（如部分 CI 环境、WSL 纯 Node 脚本）、或只需部署到单个项目且不需要全局 Skills 时。

**部署内容**：与 setup.ps1 相同的核心部署（\_bmad、.cursor、.claude、hooks、i18n、项目内 skills）。**项目内已有完整 skills**，打开该目标项目即可使用。若需 Skills 对其他项目全局可用，可参考 §3 手动复制到 `$env:USERPROFILE\.cursor\skills\`。安装后建议手动运行 `pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly` 做校验。

对于 runtime governance，`init-to-root.js` / `bmad-speckit-init` 的关键结果应当是：

- `_bmad/runtime/hooks/governance-runtime-worker.cjs`
- `_bmad/runtime/hooks/governance-remediation-runner.cjs`
- `.claude/hooks/governance-runtime-worker.cjs`
- `.claude/hooks/governance-remediation-runner.cjs`
- `.cursor/hooks/governance-runtime-worker.cjs`
- `.cursor/hooks/governance-remediation-runner.cjs`

如果这些文件缺失，说明安装只做了“基础骨架”，还没有完成“最新 hooks 对齐”。此时直接补跑：

```powershell
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

### 2.5 非交互式安装

> 适用于：CI/CD 流水线、脚本化安装、批量部署、已知配置的快速安装。参考 [BMAD Method 非交互式安装](https://docs.bmad-method.org/how-to/non-interactive-installation/)。

**说明**：`npx --package bmad-speckit-sdd-flow bmad-speckit init` 使用公开 root 包；`setup.ps1` 与 `init-to-root.js` 从本仓库的 `_bmad` 部署。若需 BMAD-Speckit-SDD-Flow 的最新定制内容，优先使用 setup.ps1 或 init-to-root.js。

#### bmad-speckit init 可用选项

通过 `npx --package bmad-speckit-sdd-flow bmad-speckit init` 初始化时，可使用以下标志跳过交互：

| 标志                    | 说明                              | 示例                                              |
| ----------------------- | --------------------------------- | ------------------------------------------------- |
| `--ai <name>`           | AI 选择，逗号分隔多选             | `--ai cursor-agent` 或 `--ai cursor-agent,claude` |
| `-y, --yes`             | 跳过所有提示，使用默认值          | `--yes`                                           |
| `--modules <list>`      | 逗号分隔的模块 ID                 | `--modules bmm,bmb,tea`                           |
| `--template <tag\|url>` | 模板版本或 tarball URL            | `--template latest` 或 `--template v1.0.0`        |
| `--force`               | 强制覆盖非空目录                  | `--force`                                         |
| `--no-git`              | 跳过 git init                     | `--no-git`                                        |
| `--bmad-path <path>`    | 共享 \_bmad 路径（worktree 模式） | `--bmad-path /path/to/_bmad`                      |
| `--no-ai-skills`        | 跳过发布 AI skills                | `--no-ai-skills`                                  |
| `--offline`             | 仅使用本地缓存，不联网            | `--offline`                                       |
| `--script <type>`       | 脚本类型：sh 或 ps                | `--script ps`                                     |
| `--here`                | 使用当前目录作为目标              | `--here`                                          |

**完全非交互示例**：

```powershell
cd D:\Dev\your-project
npx --yes --package bmad-speckit-sdd-flow bmad-speckit init . --ai cursor-agent --yes
```

**CI/CD 流水线示例**（需先安装已发布根包或其 tgz 产物）：

```powershell
npx --yes --package bmad-speckit-sdd-flow bmad-speckit init "${GITHUB_WORKSPACE}" --ai cursor-agent --modules bmm --yes --no-git
```

#### setup.ps1 可用选项

| 参数             | 说明                                    | 默认   |
| ---------------- | --------------------------------------- | ------ |
| `-Target <path>` | 目标项目根目录                          | 必填   |
| `-Agent <name>`  | AI 类型：cursor、claude-code 或逗号分隔 | cursor |
| `-Full`          | 完整模式                                | 否     |
| `-SkipSkills`    | 跳过全局 Skills 安装                    | 否     |
| `-DryRun`        | 仅输出计划，不执行                      | 否     |

```powershell
pwsh scripts/setup.ps1 -Target D:\Dev\your-project -Agent cursor -Full
```

#### init-to-root.js 可用选项

| 参数             | 说明                       |
| ---------------- | -------------------------- |
| `[targetDir]`    | 目标目录（缺省为当前目录） |
| `--agent <name>` | cursor 或 claude-code      |
| `--full`         | 完整部署                   |

```powershell
node D:\Dev\BMAD-Speckit-SDD-Flow\scripts\init-to-root.js D:\Dev\your-project --agent cursor --full
```

---

## 3. 全局 Skills 安装

全局 Skills 安装到 `%USERPROFILE%\.cursor\skills\`（Windows）或 `~/.cursor/skills/`（macOS/Linux）。

**必须安装的 Skills**（工作流核心依赖）：

| #   | Skill                            | 说明                                    |
| --- | -------------------------------- | --------------------------------------- |
| 1   | **speckit-workflow**             | 核心：specify→plan→gaps→tasks→implement |
| 2   | **bmad-story-assistant**         | Epic/Story 全流程                       |
| 3   | **bmad-bug-assistant**           | BUGFIX 全流程                           |
| 4   | **bmad-code-reviewer-lifecycle** | 审计→解析→scoring 写入                  |
| 5   | **code-review**                  | 审计执行引擎                            |

```powershell
$SKILLS_ROOT = "$env:USERPROFILE\.cursor\skills"
$required = @(
    "speckit-workflow",
    "bmad-story-assistant",
    "bmad-bug-assistant",
    "bmad-code-reviewer-lifecycle",
    "code-review"
)
foreach ($skill in $required) {
    $src = "D:\Dev\BMAD-Speckit-SDD-Flow\skills\$skill"
    $dest = "$SKILLS_ROOT\$skill"
    if (Test-Path $src) {
        Copy-Item -Recurse -Force $src $dest
        Write-Host "[OK] $skill -> $dest"
    }
}
```

**推荐安装的 Skills**：bmad-standalone-tasks、bmad-customization-backup、bmad-orchestrator、using-git-worktrees、ralph-method、auto-commit-utf8、git-push-monitor。

---

## 4. 安装验证

在**目标项目根目录**执行：

```powershell
cd D:\Dev\your-project
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly
```

### 4.1 最小复验命令列表

下面这组命令是当前推荐的**最小复验清单**。如果你完成安装后只想快速判断“是否真的可用”，至少跑完这组：

```powershell
cd D:\Dev\your-project

# 1. 基础骨架检查
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly

# 2. CLI 是否可解析
npx bmad-speckit check

# 3. 显式对齐 Claude / Cursor hooks（推荐）
npx bmad-speckit-init --agent claude-code
npx bmad-speckit-init --agent cursor
```

### 4.2 Runtime Governance 专项复验

如果你关心的是 runtime governance 是否真正安装到位，额外检查这 4 层：

```powershell
$checks = @(
  '._ignore',
  '_bmad\runtime\hooks\governance-runtime-worker.cjs',
  '_bmad\runtime\hooks\governance-remediation-runner.cjs',
  '.claude\hooks\governance-runtime-worker.cjs',
  '.claude\hooks\governance-remediation-runner.cjs',
  '.cursor\hooks\governance-runtime-worker.cjs',
  '.cursor\hooks\governance-remediation-runner.cjs',
  '.claude\settings.json',
  '.cursor\hooks.json'
)

foreach ($path in $checks) {
    if ($path -eq '._ignore') { continue }
    if (Test-Path $path) {
        Write-Host "[OK] $path" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $path" -ForegroundColor Red
    }
}
```

其中：

- `_bmad/runtime/hooks/*` 代表项目内共享运行时资产
- `.claude/hooks/*` / `.cursor/hooks/*` 代表宿主真正执行的 hook 副本
- `.claude/settings.json` / `.cursor/hooks.json` 代表宿主事件绑定是否存在

### 4.3 npx 路径的明确说明

`npx` 有两种常见含义，必须区分：

1. `npx --package bmad-speckit-sdd-flow bmad-speckit init ...`
   - 快速初始化
   - 不保证带上本仓库所有最新定制

2. `npm install --save-dev <本仓库>` 后再运行 `npx bmad-speckit-init --agent ...`
   - 这是**本仓库定制能力**的推荐 npx 用法
   - 能把当前包内最新 `_bmad/runtime/hooks` 同步到消费项目宿主目录

如果你的目标是“消费项目里真的看到 governance-runtime-worker / governance-remediation-runner 并能执行”，请采用第 2 种，而不是只跑第 1 种。

### 4.4 Hook 提示开关

如果你希望项目 hooks 在执行时把提示信息直接打印出来，可开启：

```json
{
  "env": {
    "BMAD_HOOKS_VERBOSE": "1"
  }
}
```

推荐位置：

- Claude Code：`<project>/.claude/settings.json`
- 其他宿主：对应的项目级环境注入位置

当前语义：

- `BMAD_HOOKS_VERBOSE=0`
  - 默认安静模式
- `BMAD_HOOKS_VERBOSE=1`
  - hook 会打印更多提示，例如：
    - `pre-continue-check passed`
    - `pre-continue-check failed`
    - `pre-continue-check skipped: artifact self write`
    - governance rerun queue 入队 / worker started / worker skipped

这个开关适合排查两类问题：

1. hook 有没有被调用
2. hook 是真的拦截了，还是因为 self-write 被主动跳过

手动验证关键路径：

```powershell
$checks = @(
    "_bmad",
    "_bmad\core\workflows\party-mode\workflow.md",
    "_bmad\_config\agent-manifest.csv",
    "_bmad-output\config\settings.json",
    "specs",
    ".cursor\rules\bmad-bug-auto-party-mode-rule.mdc",
    ".cursor\commands\bmad-bmm-create-story.md",
    "_bmad\_config\code-reviewer-config.yaml"
)
foreach ($path in $checks) {
    if (Test-Path $path) {
        Write-Host "[OK] $path" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $path" -ForegroundColor Red
    }
}
```

---

## 5. 创建第一个 Feature（1 分钟）

```powershell
cd D:\Dev\your-project
git checkout -b 001-my-first-feature
```

在 Cursor 中运行命令：`/speckit.specify`

确认 `specs/001-my-first-feature/spec.md` 已生成。

---

## 6. 完成 specify → plan → tasks 流程（2 分钟）

依次运行：`/speckit.plan` → 审计通过 → `/speckit.tasks`

确认 `plan.md`、`tasks.md` 已生成。

---

## 7. 下一步

**想体验 BMAD 全流程？** 在 Cursor 中依次运行 `/bmad-bmm-create-story`（输入 Epic 与 Story 编号）→ 审计通过 → `/bmad-bmm-dev-story`，将触发 Layer 4 嵌套 Speckit（specify → plan → tasks → implement）。

**常用 Skills**（安装时已部署到全局，直接可用）：

- **bmad-story-assistant**：Story 全流程（Create Story → Dev Story），对应命令 `/bmad-bmm-create-story`、`/bmad-bmm-dev-story`
- **bmad-bug-assistant**：描述问题时自动进入 Party-Mode，产出 BUGFIX 文档并生成修复任务
- **bmad-standalone-tasks**：按单份 TASKS/BUGFIX 文档执行，用法示例：`/bmad 按 TASKS_xxx.md 中的未完成任务实施`

**审计后自动化 / 诊断 CLI**（统一 host、Coach 诊断等）：

```bash
npx ts-node scripts/run-auditor-host.ts --projectRoot <项目根目录> --stage <story|spec|plan|gaps|tasks|implement|bugfix|document> --artifactPath <被审产物> --reportPath <审计报告>
npx bmad-speckit coach
npx bmad-speckit dashboard
npx bmad-speckit sft-extract
npx bmad-speckit scores
```

**更多资源**：

- [迁移指南](../how-to/migration.md) — 现有项目迁移流程
- [BMAD Story 流程](bmad-story-assistant.md) — Story 助手使用说明
- [架构概述](../explanation/architecture.md) — 五层架构与 Speckit 工作流
- [README.md](../../README.md) — 项目总览
