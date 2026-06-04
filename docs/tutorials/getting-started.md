# BMAD-Speckit 入门教程

> 从零到生成第一个 `spec.md` 的完整路径。涵盖安装、配置与第一次使用。
> 现有项目迁移请参阅 [迁移指南](../how-to/migration.md)。

---

## 1. 前置条件

| 条件       | 要求   | 说明                                      |
| ---------- | ------ | ----------------------------------------- |
| Node.js    | ≥18    | 安装项目本地依赖并运行 `bmad-speckit` CLI |
| PowerShell | ≥7     | 运行 Windows 复验脚本，可选但推荐         |
| Cursor IDE | 最新版 | 使用 skills、commands、rules              |
| Git        | ≥2.x   | worktree、分支管理                        |

普通消费项目不需要 clone 本仓库。只有源码维护、安装器调试或本地未发布改动验证时，才需要 clone `BMAD-Speckit-SDD-Flow`。

---

## 2. 安装

### 2.0 安装方式对比与选择

普通消费项目的默认路径是“项目本地安装 + 显式 init”。这样可以把后续生成 skills 需要调用的 runtime 固定在消费项目的 `node_modules` 里。

| 方式                       | 是否推荐为长期 runtime | 会修改什么                               | 适用场景                                       |
| -------------------------- | ---------------------- | ---------------------------------------- | ---------------------------------------------- |
| registry 项目本地安装      | 是                     | `node_modules`、`package.json`、lockfile | 已发布版本的普通消费项目                       |
| tgz 项目本地安装           | 是                     | `node_modules`、`package.json`、lockfile | 验证 CI artifact、release candidate 或 PR tgz  |
| `npx --package` 临时执行   | 否                     | 不持久安装依赖                           | smoke test、一次性 bootstrap、CI artifact 快检 |
| 源码仓库 `setup.ps1`       | 否                     | 取决于目标参数                           | 源码维护、安装器调试、本地未发布改动验证       |
| 源码仓库 `init-to-root.js` | 否                     | 取决于目标参数                           | 源码维护、无 PowerShell 环境下的安装器调试     |
| 全局安装                   | 否                     | 全局 npm prefix                          | 人工便利，不用于受治理项目验收                 |

### 2.1 推荐：registry 项目本地安装

```powershell
cd <consumer-root>
npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest
npm ls bmad-speckit-sdd-flow --depth=0
node -e "const fs=require('node:fs'); const p=process.platform==='win32'?'node_modules/.bin/bmad-speckit.cmd':'node_modules/.bin/bmad-speckit'; if(!fs.existsSync(p)){console.error('missing project-local '+p); process.exit(1)} console.log('found '+p)"
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force
npx --no-install bmad-speckit check
npx --no-install bmad-speckit dashboard-status
npx --no-install bmad-speckit bmads
```

`--ignore-scripts` 会把“依赖安装”和“安装面生成”拆开：先把包固定到项目本地，再显式选择要生成的 Claude Code、Cursor 或 Codex 安装面。如果不带该参数，当前根包的 `postinstall` 可能在你显式选择宿主前先写入默认安装面。

### 2.2 推荐：tgz 项目本地安装

如果你从 GitHub Actions 的 `package` job 下载了 `npm-packages-<commit-sha>` artifact，解压后优先选择根包：

```text
bmad-speckit-sdd-flow-<version>.tgz
```

在消费项目中运行：

```powershell
cd <consumer-root>
npm install --save-dev --ignore-scripts ./bmad-speckit-sdd-flow-<version>.tgz
npm ls bmad-speckit-sdd-flow --depth=0
node -e "const fs=require('node:fs'); const p=process.platform==='win32'?'node_modules/.bin/bmad-speckit.cmd':'node_modules/.bin/bmad-speckit'; if(!fs.existsSync(p)){console.error('missing project-local '+p); process.exit(1)} console.log('found '+p)"
npx --no-install bmad-speckit version
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force
npx --no-install bmad-speckit check
npx --no-install bmad-speckit dashboard-status
npx --no-install bmad-speckit bmads
```

这条路径会写入 `node_modules`、`package.json` 和 lockfile，适合在没有 clone 本仓库的机器上验证本地 CI artifact、release candidate 或当前 PR 打出的 tgz。

### 2.3 临时执行：`npx --package`

```powershell
cd <consumer-root>
npx --yes --package bmad-speckit-sdd-flow@latest bmad-speckit init . --ai cursor-agent --yes --force
```

这条路径只适合一次性 CLI 执行、smoke test 或 CI artifact 检查。它不会把 `bmad-speckit-sdd-flow` 固定为项目本地依赖，因此生成后的 skills 如果后续调用 `npx --no-install bmad-speckit ...`，可能因为项目本地没有安装包而失败。

### 2.4 源码维护者路径

只有在你已经 clone 本仓库，并且正在维护安装器、调试本地未发布改动或做源码级验证时，才使用下面入口：

```powershell
git clone <BMAD-Speckit-SDD-Flow-repo-url> <repo-root>
cd <repo-root>
pwsh scripts/setup.ps1 -Target <consumer-root> -Full
```

或：

```powershell
cd <repo-root>
node scripts/init-to-root.js <consumer-root> --agent cursor --full
```

`setup.ps1` 和 `init-to-root.js` 是源仓库维护/调试入口，不是普通消费项目在另一台机器上的默认安装方式。

### 2.5 安装后关键结果

显式执行 `bmad-speckit init ...` 后，runtime governance 的关键结果应当是：

- `_bmad/runtime/hooks/runtime-policy-inject-core.cjs`
- `_bmad/runtime/hooks/pre-continue-check.cjs`
- `.claude/hooks/runtime-policy-inject.cjs`
- `.claude/hooks/pre-continue-check.cjs`
- `.cursor/hooks/runtime-policy-inject.cjs`
- `.cursor/hooks/pre-continue-check.cjs`

如果这些文件缺失，说明依赖安装或宿主安装面生成不完整。此时在消费项目根目录补跑：

```powershell
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force
```

`bmad-speckit-init` 仍保留为兼容别名。新文档、生成后的 skills 和集成脚本应优先使用 `bmad-speckit init ...`。

### 2.6 非交互式安装

> 适用于：CI/CD 流水线、脚本化安装、批量部署、已知配置的快速安装。参考 [BMAD Method 非交互式安装](https://docs.bmad-method.org/how-to/non-interactive-installation/)。

**说明**：受治理消费项目应先完成项目本地安装，再用 `npx --no-install bmad-speckit init ...` 非交互初始化。`npx --package` 只作为临时执行入口。

#### bmad-speckit init 可用选项

通过 `npx --no-install bmad-speckit init` 初始化时，可使用以下标志跳过交互：

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
cd <consumer-root>
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force
```

**CI/CD 流水线示例**（需先安装已发布根包或其 tgz 产物）：

```powershell
npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest
npm ls bmad-speckit-sdd-flow --depth=0
node -e "const fs=require('node:fs'); const p=process.platform==='win32'?'node_modules/.bin/bmad-speckit.cmd':'node_modules/.bin/bmad-speckit'; if(!fs.existsSync(p)){console.error('missing project-local '+p); process.exit(1)} console.log('found '+p)"
npx --no-install bmad-speckit init "${GITHUB_WORKSPACE}" --ai cursor-agent --modules bmm --yes --no-git
```

#### setup.ps1 可用选项

下面选项只适用于源码维护者路径。

| 参数             | 说明                                    | 默认   |
| ---------------- | --------------------------------------- | ------ |
| `-Target <path>` | 目标项目根目录                          | 必填   |
| `-Agent <name>`  | AI 类型：cursor、claude-code 或逗号分隔 | cursor |
| `-Full`          | 完整模式                                | 否     |
| `-SkipSkills`    | 跳过全局 Skills 安装                    | 否     |
| `-DryRun`        | 仅输出计划，不执行                      | 否     |

```powershell
pwsh scripts/setup.ps1 -Target <consumer-root> -Agent cursor -Full
```

#### init-to-root.js 可用选项

下面选项只适用于源码维护者路径。

| 参数             | 说明                       |
| ---------------- | -------------------------- |
| `[targetDir]`    | 目标目录（缺省为当前目录） |
| `--agent <name>` | cursor 或 claude-code      |
| `--full`         | 完整部署                   |

```powershell
node <repo-root>\scripts\init-to-root.js <consumer-root> --agent cursor --full
```

---

## 3. Skills 安装面

普通消费项目不需要手动复制全局 Skills。推荐安装链已经通过：

```powershell
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force
```

把所选宿主需要的 project-local skills、commands、hooks 和 `_bmad` 资产同步到当前项目。

**应在项目内出现的核心 Skills**：

| #   | Skill                            | 说明                                    |
| --- | -------------------------------- | --------------------------------------- |
| 1   | **speckit-workflow**             | 核心：specify→plan→gaps→tasks→implement |
| 2   | **bmad-story-assistant**         | Epic/Story 全流程                       |
| 3   | **bmad-bug-assistant**           | BUGFIX 全流程                           |
| 4   | **bmad-code-reviewer-lifecycle** | 审计→解析→scoring 写入                  |
| 5   | **code-review**                  | 审计执行引擎                            |

如果你正在维护源码仓库，并且确实需要把 skills 安装到全局 Cursor skills 目录，可使用源码维护者路径中的 `setup.ps1`。不要把全局安装作为消费项目验收标准；消费项目验收应以项目内 `.cursor/skills`、`.claude`、`.codex/skills` 和 `_bmad` 安装面为准。

**推荐 Skills**：bmad-standalone-tasks、bmad-customization-backup、bmad-orchestrator、using-git-worktrees、ralph-method、auto-commit-utf8、git-push-monitor。注意：`bmad-standalone-tasks` 的“独立”仅表示文档作用域独立，不表示它绕过主 Agent 主链。

---

## 4. 安装验证

在**目标项目根目录**执行：

```powershell
cd <consumer-root>
npm ls bmad-speckit-sdd-flow --depth=0
node -e "const fs=require('node:fs'); const p=process.platform==='win32'?'node_modules/.bin/bmad-speckit.cmd':'node_modules/.bin/bmad-speckit'; if(!fs.existsSync(p)){console.error('missing project-local '+p); process.exit(1)} console.log('found '+p)"
```

### 4.1 最小复验命令列表

下面这组命令是当前推荐的**最小复验清单**。如果你完成安装后只想快速判断“是否真的可用”，至少跑完这组：

```powershell
cd <consumer-root>

# 1. 项目本地依赖和 CLI shim
npm ls bmad-speckit-sdd-flow --depth=0
node -e "const fs=require('node:fs'); const p=process.platform==='win32'?'node_modules/.bin/bmad-speckit.cmd':'node_modules/.bin/bmad-speckit'; if(!fs.existsSync(p)){console.error('missing project-local '+p); process.exit(1)} console.log('found '+p)"

# 2. 显式生成目标宿主安装面
npx --no-install bmad-speckit init . --ai claude,cursor-agent,codex --yes --force

# 3. 基础骨架和 CLI 检查
pwsh _bmad\speckit\scripts\powershell\check-prerequisites.ps1 -PathsOnly
npx --no-install bmad-speckit check

# 4. 运行时入口检查
npx --no-install bmad-speckit dashboard-status
npx --no-install bmad-speckit bmads
```

### 4.2 Runtime Governance 专项复验

如果你关心的是 runtime governance 是否真正安装到位，额外检查 accepted main-agent path，而不是 background worker / autonomous fallback：

```powershell
$checks = @(
  '._ignore',
  '_bmad\runtime\hooks\runtime-policy-inject-core.cjs',
  '_bmad\runtime\hooks\pre-continue-check.cjs',
  '.claude\hooks\runtime-policy-inject.cjs',
  '.claude\hooks\pre-continue-check.cjs',
  '.cursor\hooks\runtime-policy-inject.cjs',
  '.cursor\hooks\pre-continue-check.cjs',
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

然后再验证宿主主控资产已安装。普通消费用户的默认激活方式是在当前 AI 宿主会话中输入 `$bmad-speckit`、`/bmad-speckit` 或 `bmad-speckit`；下面的 CLI 只用于安装验证、CI、debug 或 no-skill fallback：

```powershell
npx --no-install bmad-speckit main-agent inspect --cwd . --json
```

必要时：

```powershell
npx --no-install bmad-speckit main-agent dispatch-plan --cwd . --json
```

其中：

- `_bmad/runtime/hooks/*` 代表项目内共享运行时资产
- `.claude/hooks/*` / `.cursor/hooks/*` 代表宿主真正执行的 hook 副本
- `.claude/settings.json` / `.cursor/hooks.json` 代表宿主事件绑定是否存在
- `$bmad-speckit` / `/bmad-speckit` / `bmad-speckit` 是 interactive 模式下的正式用户激活入口；`main-agent inspect|dispatch-plan` 是 package-local control-plane 验证入口

accepted runtime path 需要这样理解：

1. 主 Agent 先读取受控 RequirementRecord、`currentMentalModel` 和六个心智模型状态
2. 只有受控记录明确要求 materialize packet 时，才内部执行或等价消费 `dispatch-plan`
3. 子代理只执行 `bounded packet`，不替主 Agent 决定下一条全局分支
4. `runAuditorHost` 只在审计通过后做 post-audit close-out
5. close-out 完成后，主 Agent 再次回读受控 RequirementRecord、当前 hash、当前 attempt 和六个心智模型状态

### 4.3 npx 路径的明确说明

`npx` 有两种常见含义，必须区分：

1. `npx --package bmad-speckit-sdd-flow bmad-speckit init ...`
   - 适合临时执行、smoke test 和一次性 bootstrap
   - 不会把 runtime 依赖持久安装进消费项目

2. `npm install --save-dev --ignore-scripts bmad-speckit-sdd-flow@latest` 后再运行 `npx --no-install bmad-speckit init ...`
   - 这是**消费项目长期 runtime** 的推荐 npx 用法
   - 能把当前包内最新 `_bmad/runtime/hooks`、宿主 hooks 和 skills 同步到消费项目宿主目录

如果你的目标是“消费项目里真的验证主 Agent 主链能工作”，请采用第 2 种，并验证 `.claude/.cursor` 的 `runtime-policy-inject.cjs`、`pre-continue-check.cjs` 以及 `$bmad-speckit` / `/bmad-speckit` / `bmad-speckit` 宿主入口，而不是再追求 background worker 自动吃队列。

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
    - governance rerun queue 入 state / legacy compatibility wrapper skipped

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
cd <consumer-root>
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

**常用 Skills**（通过项目本地 `bmad-speckit init ...` 安装到对应宿主 surface 后可用）：

- **bmad-story-assistant**：Story 全流程（Create Story → Dev Story），对应命令 `/bmad-bmm-create-story`、`/bmad-bmm-dev-story`
- **bmad-bug-assistant**：描述问题时自动进入 Party-Mode，产出 BUGFIX 文档并生成修复任务
- **bmad-standalone-tasks**：按单份 TASKS/BUGFIX 文档执行，但当前 accepted path 仍是主 Agent 先 `inspect`，必要时 `dispatch-plan`，再派发 bounded packet；用法示例：`/bmad 按 TASKS_xxx.md 中的未完成任务实施`

**Post-audit close-out / 诊断 CLI**（用于审计后的 close-out、Coach 诊断等；不是 interactive 主控入口）：

```bash
npx --no-install bmad-speckit run-auditor-host --projectRoot <项目根目录> --stage <story|spec|plan|gaps|tasks|implement|bugfix|document> --artifactPath <被审产物> --reportPath <审计报告>
npx --no-install bmad-speckit coach
npx --no-install bmad-speckit dashboard
npx --no-install bmad-speckit sft-extract
npx --no-install bmad-speckit scores
```

> Legacy / maintenance 说明：root `scripts/run-auditor-host.ts` 只用于仓库内 close-out 调试、host-runner 验证和历史证据追溯；消费项目应使用 package-local `bmad-speckit run-auditor-host`。当前 accepted runtime path 仍然是用户通过 `$bmad-speckit` / `/bmad-speckit` / `bmad-speckit` 激活主控，主 Agent 回读受控 RequirementRecord 和六个心智模型状态，而不是把 `runAuditorHost` 当作主入口。

**更多资源**：

- [迁移指南](../how-to/migration.md) — 现有项目迁移流程
- [BMAD Story 流程](bmad-story-assistant.md) — Story 助手使用说明
- [架构概述](../explanation/architecture.md) — 五层架构与 Speckit 工作流
- [README.md](../../README.md) — 项目总览
