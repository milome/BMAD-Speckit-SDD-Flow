# TASKS: 安装流程改进

> **来源**：安装/迁移指南审计中发现的 4 项改进  
> **日期**：2026-03-05  
> **状态**：待实施

---

## §1 安装流程碎片化 → 统一安装脚本

### T-INSTALL-1: 扩展 `scripts/init-to-root.js`，增加完整部署模式

**文件**: `scripts/init-to-root.js`

**当前行为** (第 13 行):

```js
const DIRS = ['_bmad', '_bmad-output', 'commands', 'rules'];
```

仅复制 4 个目录，缺失 `config/`、`templates/`、`workflows/`、`.cursor/`。

**修改内容**:

1. 增加 `--full` 参数，启用完整部署模式
2. 完整部署模式下 `DIRS` 变为：

```js
const CORE_DIRS = ['_bmad', '_bmad-output', 'commands', 'rules'];
const FULL_DIRS = ['_bmad', '_bmad-output', 'commands', 'rules', 'config', 'templates', 'workflows'];
```

3. 增加 `.cursor/` 同步逻辑（将 `commands/` → `.cursor/commands/`、`rules/` → `.cursor/rules/`、`config/code-reviewer-config.yaml` → `.cursor/agents/code-reviewer-config.yaml`）
4. 输出清单，列出已复制的目录和文件数
5. 不修改默认行为（无 `--full` 时仍仅复制 4 个核心目录）

**验收**:
- `node scripts/init-to-root.js D:\Dev\test-project` 行为不变
- `node scripts/init-to-root.js --full D:\Dev\test-project` 部署全部 7 个目录 + `.cursor/` 同步

---

### T-INSTALL-2: 新建 `scripts/setup.ps1` 一键安装脚本（PowerShell）

**新文件**: `scripts/setup.ps1`

**功能**:

```
参数:
  -Target <path>          目标项目根目录（必须）
  -SkipSkills             跳过全局 Skills 安装
  -SkipScoring            跳过 scoring/ 目录复制
  -DryRun                 仅输出计划，不执行
  -Help                   显示帮助
```

**执行步骤**（按顺序）:

1. 验证前置条件（Node.js ≥18、Python ≥3.8、PowerShell ≥7、Git ≥2.x），缺失则报错退出
2. 调用 `node scripts/init-to-root.js --full $Target` 部署核心 + 扩展目录
3. 同步 `.cursor/` 配置（详见 T-SYNC-1）
4. 若未指定 `-SkipSkills`，复制 `skills/` 下 12 个 Skill 到 `$env:USERPROFILE\.cursor\skills\`（见 T-INSTALL-3 清单）
5. 若未指定 `-SkipScoring`，复制 `scoring/` 到 `$Target\scoring\`
6. 运行验证检查（调用 T-INSTALL-4 的验证逻辑）
7. 输出安装报告（通过/缺失/跳过）

**验收**:
- 新项目执行 `pwsh scripts/setup.ps1 -Target D:\Dev\new-project` 后，所有路径验证通过
- `-DryRun` 仅输出计划不执行任何文件操作

---

### T-INSTALL-3: 在 `setup.ps1` 中定义全局 Skills 安装清单

**归属文件**: `scripts/setup.ps1`（T-INSTALL-2 中创建）

**安装清单**（硬编码在脚本中）:

```powershell
$REQUIRED_SKILLS = @(
    "speckit-workflow",
    "bmad-story-assistant",
    "bmad-bug-assistant",
    "bmad-code-reviewer-lifecycle",
    "code-review"
)

$OPTIONAL_SKILLS = @(
    "bmad-standalone-tasks",
    "bmad-customization-backup",
    "bmad-orchestrator",
    "using-git-worktrees",
    "pr-template-generator",
    "auto-commit-utf8",
    "git-push-monitor"
)
```

**复制源**: `{PKG_ROOT}/skills/{skill-name}/` → `$env:USERPROFILE\.cursor\skills\{skill-name}\`

**每个 Skill 复制后验证**: `Test-Path "$env:USERPROFILE\.cursor\skills\{skill-name}\SKILL.md"` 返回 `True`

---

### T-INSTALL-4: 在 `setup.ps1` 中内置安装验证逻辑

**归属文件**: `scripts/setup.ps1`（T-INSTALL-2 中创建）

**验证检查项**（逐项输出 `[OK]` 或 `[MISSING]`）:

| # | 检查路径（相对于 `-Target`） | 说明 |
|---|------------------------------|------|
| 1 | `_bmad\core\workflows\party-mode\workflow.md` | Party-Mode 工作流 |
| 2 | `_bmad\bmm\workflows\4-implementation\create-story\workflow.yaml` | Create Story 工作流 |
| 3 | `_bmad\bmm\workflows\4-implementation\dev-story\workflow.yaml` | Dev Story 工作流 |
| 4 | `_bmad\_config\agent-manifest.csv` | Agent manifest |
| 5 | `_bmad-output\config\settings.json` | Worktree 配置 |
| 6 | `commands\speckit.specify.md` | speckit 命令 |
| 7 | `commands\bmad-bmm-create-story.md` | BMAD 命令 |
| 8 | `rules\bmad-bug-auto-party-mode.mdc` | 规则定义 |
| 9 | `.cursor\rules\bmad-bug-auto-party-mode.mdc` | Cursor 规则 |
| 10 | `.cursor\commands\speckit.specify.md` | Cursor speckit 命令 |
| 11 | `.cursor\commands\bmad-bmm-create-story.md` | Cursor BMAD 命令 |
| 12 | `.cursor\agents\code-reviewer-config.yaml` | Cursor Code Reviewer |
| 13 | `config\code-reviewer-config.yaml` | 项目 Code Reviewer 配置 |
| 14 | `templates\spec-template.md` | Spec 模板 |
| 15 | `workflows\specify.md` | Specify 工作流 |

全局 Skills 验证（逐项）:

| # | 检查路径 | 说明 |
|---|----------|------|
| 16 | `$env:USERPROFILE\.cursor\skills\speckit-workflow\SKILL.md` | speckit-workflow |
| 17 | `$env:USERPROFILE\.cursor\skills\bmad-story-assistant\SKILL.md` | bmad-story-assistant |
| 18 | `$env:USERPROFILE\.cursor\skills\bmad-bug-assistant\SKILL.md` | bmad-bug-assistant |
| 19 | `$env:USERPROFILE\.cursor\skills\bmad-code-reviewer-lifecycle\SKILL.md` | bmad-code-reviewer-lifecycle |
| 20 | `$env:USERPROFILE\.cursor\skills\code-review\SKILL.md` | code-review |

---

### T-INSTALL-5: 更新 `package.json` 的 `files` 字段和 `scripts`

**文件**: `package.json`

**修改 1** — `files` 字段（第 25–31 行），追加 3 个目录：

```json
"files": [
    "_bmad",
    "_bmad-output",
    "commands",
    "rules",
    "scripts",
    "config",
    "templates",
    "workflows"
]
```

**修改 2** — `scripts` 字段，追加 `setup` 命令：

```json
"setup": "pwsh scripts/setup.ps1",
"setup:full": "pwsh scripts/setup.ps1 --full"
```

**修改 3** — `bin` 字段，追加 `setup` 入口：

```json
"bin": {
    "bmad-speckit-init": "scripts/init-to-root.js",
    "bmad-speckit-setup": "scripts/setup.ps1"
}
```

---

## §2 commands/ 与 .cursor/ 同步

### T-SYNC-1: 修改 `scripts/init-to-root.js`，增加 `.cursor/` 自动同步

**文件**: `scripts/init-to-root.js`

**当前问题**: 脚本仅复制 `commands/` → `{TARGET}/commands/` 和 `rules/` → `{TARGET}/rules/`，不会复制到 `{TARGET}/.cursor/commands/` 和 `{TARGET}/.cursor/rules/`。

**修改内容**（在第 41 行 `console.log('Done...')` 之前插入）:

```js
// .cursor/ 同步
const CURSOR_SYNC = [
  { src: 'commands', dest: '.cursor/commands' },
  { src: 'rules', dest: '.cursor/rules' },
];

for (const { src, dest } of CURSOR_SYNC) {
  const srcPath = path.join(TARGET, src);
  const destPath = path.join(TARGET, dest);
  if (fs.existsSync(srcPath)) {
    console.log('Sync', src, '->', dest);
    copyRecursive(srcPath, destPath);
  }
}

// .cursor/agents/ — 从 config/ 复制 code-reviewer-config.yaml
const crSrc = path.join(TARGET, 'config', 'code-reviewer-config.yaml');
const crDest = path.join(TARGET, '.cursor', 'agents', 'code-reviewer-config.yaml');
if (fs.existsSync(crSrc)) {
  fs.mkdirSync(path.dirname(crDest), { recursive: true });
  fs.copyFileSync(crSrc, crDest);
  console.log('Sync config/code-reviewer-config.yaml -> .cursor/agents/');
}
```

**验收**:
- 运行 `node scripts/init-to-root.js D:\Dev\test-project` 后，`test-project/.cursor/commands/` 包含所有 `commands/` 下的文件
- `test-project/.cursor/rules/` 包含所有 `rules/` 下的文件
- `test-project/.cursor/agents/code-reviewer-config.yaml` 内容与 `config/code-reviewer-config.yaml` 一致

---

### T-SYNC-2: 补齐 `.cursor/commands/` 中缺失的 9 个 speckit 命令

**文件**: `.cursor/commands/` 目录

**当前缺失的 9 个文件**（存在于 `commands/` 但不在 `.cursor/commands/` 中）:

1. `.cursor/commands/speckit.analyze.md` ← 复制自 `commands/speckit.analyze.md`
2. `.cursor/commands/speckit.checklist.md` ← 复制自 `commands/speckit.checklist.md`
3. `.cursor/commands/speckit.clarify.md` ← 复制自 `commands/speckit.clarify.md`
4. `.cursor/commands/speckit.implement.md` ← 复制自 `commands/speckit.implement.md`
5. `.cursor/commands/speckit.plan.md` ← 复制自 `commands/speckit.plan.md`
6. `.cursor/commands/speckit.specify.md` ← 复制自 `commands/speckit.specify.md`
7. `.cursor/commands/speckit.tasks.md` ← 复制自 `commands/speckit.tasks.md`
8. `.cursor/commands/speckit.taskstoissues.md` ← 复制自 `commands/speckit.taskstoissues.md`
9. `.cursor/commands/speckit.constitution.md` ← 复制自 `commands/speckit.constitution.md`

**执行命令**:

```powershell
$speckit = @("speckit.analyze.md","speckit.checklist.md","speckit.clarify.md","speckit.implement.md","speckit.plan.md","speckit.specify.md","speckit.tasks.md","speckit.taskstoissues.md","speckit.constitution.md")
foreach ($f in $speckit) { Copy-Item "commands\$f" ".cursor\commands\$f" -Force }
```

**验收**: `.cursor/commands/` 下包含所有 `speckit.*.md` 文件

---

### T-SYNC-3: 同步 `.cursor/agents/code-reviewer-config.yaml` 为完整版本

**文件**: `.cursor/agents/code-reviewer-config.yaml`

**当前问题**: 该文件为 150 行（截断版），缺少 `items`（第 152–189 行）和 `veto_items`（第 191–210 行）两段配置。`config/code-reviewer-config.yaml` 为 211 行（完整版）。

**修改内容**: 将 `config/code-reviewer-config.yaml`（211 行完整版）覆盖到 `.cursor/agents/code-reviewer-config.yaml`

**执行命令**:

```powershell
Copy-Item "config\code-reviewer-config.yaml" ".cursor\agents\code-reviewer-config.yaml" -Force
```

**验收**: `.cursor/agents/code-reviewer-config.yaml` 行数 = 211，包含 `items:` 和 `veto_items:` 段

---

## §3 快速上手指南

### T-QUICKSTART-1: 新建 `docs/QUICKSTART.md` — 5 分钟上手指南

**新文件**: `docs/QUICKSTART.md`

**内容要求**（必须包含以下 5 节，总字数 ≤ 1500 字）:

**第 1 节: 30 秒准备**
- 前置条件一句话（Node.js ≥18、Cursor IDE、Git）
- 克隆仓库命令

**第 2 节: 2 分钟安装**
- 运行 `pwsh scripts/setup.ps1 -Target <你的项目路径>`（依赖 T-INSTALL-2）
- 若 T-INSTALL-2 未完成，则写明手动 3 步：
  1. `node scripts/init-to-root.js <项目路径>`
  2. 复制 speckit 命令到 `.cursor/commands/`
  3. 复制 5 个必须 Skill 到全局目录
- 验证命令：`pwsh _bmad\scripts\bmad-speckit\powershell\check-prerequisites.ps1 -PathsOnly`

**第 3 节: 1 分钟创建第一个 Feature**
- 创建分支：`git checkout -b 001-my-first-feature`
- 在 Cursor 中运行命令：`/speckit.specify`
- 确认 `specs/001-my-first-feature/spec.md` 生成

**第 4 节: 2 分钟完成 specify → plan → tasks 流程**
- 依次运行：`/speckit.plan` → 审计 → `/speckit.tasks`
- 确认 `plan.md`、`tasks.md` 生成

**第 5 节: 下一步**
- 链接到完整安装指南 `docs/INSTALLATION_AND_MIGRATION_GUIDE.md`
- 链接到 BMAD Story 流程 `README.md §2`
- 链接到完整方案 `docs/BMAD/bmad-speckit-integration-FINAL-COMPLETE.md`

**禁止**: 不得包含评分系统、Party-Mode 细节、Worktree 策略等高级话题

**验收**: 新用户阅读后能在 5 分钟内看到 `spec.md` 生成

---

## §4 跨平台路径统一

### T-XPLAT-1: 定义路径占位符约定，新建 `docs/PATH_CONVENTIONS.md`

**新文件**: `docs/PATH_CONVENTIONS.md`

**内容** — 定义项目内使用的 3 个路径占位符：

| 占位符 | 含义 | Windows 展开 | macOS/Linux 展开 |
|--------|------|-------------|-----------------|
| `{SKILLS_ROOT}` | Cursor 全局 Skills 目录 | `%USERPROFILE%\.cursor\skills` | `~/.cursor/skills` |
| `{project-root}` | 当前项目根目录 | Cursor 工作区路径 | Cursor 工作区路径 |
| `{HOME}` | 用户主目录 | `%USERPROFILE%` | `~` 或 `$HOME` |

**约定规则**:
1. 文档/SKILL.md/配置文件中：使用占位符 `{SKILLS_ROOT}`，不使用平台特定展开
2. PowerShell 脚本中：使用 `$HOME`（PowerShell 7 跨平台兼容）
3. Python 脚本中：使用 `Path.home()`
4. TypeScript/JS 代码中：使用 `process.env.USERPROFILE || process.env.HOME || os.homedir()`
5. YAML 配置中：使用 `{SKILLS_ROOT}` 占位符，由读取代码在运行时展开

---

### T-XPLAT-2: 修改 `config/coach-trigger.yaml`，使用 `{SKILLS_ROOT}` 占位符

**文件**: `config/coach-trigger.yaml`

**当前内容** (第 1–2 行):

```yaml
# 全局 skill 路径（Windows: %USERPROFILE%\.cursor\skills\；跨平台: ~/.cursor/skills/）
required_skill_path: "%USERPROFILE%/.cursor/skills/bmad-code-reviewer-lifecycle/SKILL.md"
```

**修改为**:

```yaml
# 全局 skill 路径（运行时由 scoring/coach/config.ts 展开为实际路径）
required_skill_path: "{SKILLS_ROOT}/bmad-code-reviewer-lifecycle/SKILL.md"
```

---

### T-XPLAT-3: 修改 `scoring/coach/config.ts`，支持 `{SKILLS_ROOT}` 占位符展开

**文件**: `scoring/coach/config.ts`

**当前代码** (第 7 行):

```ts
required_skill_path: path.join(process.env.USERPROFILE || process.env.HOME || '', '.cursor', 'skills', 'bmad-code-reviewer-lifecycle', 'SKILL.md'),
```

**修改为**:

```ts
required_skill_path: path.join(os.homedir(), '.cursor', 'skills', 'bmad-code-reviewer-lifecycle', 'SKILL.md'),
```

顶部增加 `import * as os from 'os';`

**当前代码** (第 32–34 行):

```ts
const rawPath = parsed.required_skill_path ?? DEFAULT_CONFIG.required_skill_path;
const expanded =
    typeof rawPath === 'string' && rawPath.includes('%USERPROFILE%')
      ? rawPath.replace(/%USERPROFILE%/g, process.env.USERPROFILE || process.env.HOME || '')
      : rawPath;
```

**修改为**:

```ts
const rawPath = parsed.required_skill_path ?? DEFAULT_CONFIG.required_skill_path;
let expanded = rawPath;
if (typeof rawPath === 'string') {
  const home = os.homedir();
  expanded = rawPath
    .replace(/\{SKILLS_ROOT\}/g, path.join(home, '.cursor', 'skills'))
    .replace(/%USERPROFILE%/g, home)
    .replace(/~\//g, home + '/');
}
```

**验收**:
- Windows: `{SKILLS_ROOT}/x` 展开为 `C:\Users\milom\.cursor\skills\x`
- macOS: `{SKILLS_ROOT}/x` 展开为 `/Users/milom/.cursor/skills/x`
- 旧格式 `%USERPROFILE%/x` 仍兼容

---

### T-XPLAT-4: 修改 `skills/README.md`，路径统一为 `{SKILLS_ROOT}`

**文件**: `skills/README.md`

**当前第 16 行**:

```
| **bmad-code-reviewer-lifecycle** | ... | **全局 skill（必须）**；复制至 `%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\` 或 Cursor 全局 |
```

**修改为**:

```
| **bmad-code-reviewer-lifecycle** | ... | **全局 skill（必须）**；复制至 `{SKILLS_ROOT}\bmad-code-reviewer-lifecycle\`（Windows: `%USERPROFILE%\.cursor\skills\`；macOS/Linux: `~/.cursor/skills/`） |
```

**当前第 22 行**:

```
**本目录已按文档 §3 清单 1–7、26–29 拷贝**：以下技能已从 Cursor 全局（`$HOME/.cursor/skills/`）或 `.agents/skills/` 复制至本目录同名子目录，便于克隆即用。
```

**修改为**:

```
**本目录已按文档 §3 清单 1–7、26–29 拷贝**：以下技能已从 Cursor 全局（`{SKILLS_ROOT}`，即 `$HOME/.cursor/skills/`）或 `.agents/skills/` 复制至本目录同名子目录，便于克隆即用。
```

**当前第 25 行**:

```
安装到 Cursor 全局后，也可将对应 skill 置于 `$HOME/.cursor/skills/` 与 `commands/`、`rules/` 协同使用。
```

**修改为**:

```
安装到 Cursor 全局后，也可将对应 skill 置于 `{SKILLS_ROOT}`（`$HOME/.cursor/skills/`）与 `commands/`、`rules/` 协同使用。
```

---

### T-XPLAT-5: 修改 `skills/bmad-customization-backup/SKILL.md`，路径统一

**文件**: `skills/bmad-customization-backup/SKILL.md`

**当前第 11 行**:

```
**脚本位置**：本 skill 为全局 skill，脚本位于 `~/.cursor/skills/bmad-customization-backup/scripts/`（Windows：`%USERPROFILE%\.cursor\skills\bmad-customization-backup\scripts\`）。
```

**修改为**:

```
**脚本位置**：本 skill 为全局 skill，脚本位于 `{SKILLS_ROOT}/bmad-customization-backup/scripts/`（展开：Windows `%USERPROFILE%\.cursor\skills\`、macOS/Linux `~/.cursor/skills/`）。
```

**第 27–31 行的 `python` 命令路径**:

当前:
```
python ~/.cursor/skills/bmad-customization-backup/scripts/backup_bmad.py --project-root "{project-root}"
```
```
python %USERPROFILE%\.cursor\skills\bmad-customization-backup\scripts\backup_bmad.py --project-root "{project-root}"
```

修改为统一格式:
```
# macOS/Linux
python ~/.cursor/skills/bmad-customization-backup/scripts/backup_bmad.py --project-root "{project-root}"

# Windows (PowerShell)
python "$HOME\.cursor\skills\bmad-customization-backup\scripts\backup_bmad.py" --project-root "{project-root}"
```

第 55–58 行同理修改。

---

### T-XPLAT-6: 修改 `skills/git-push-monitor/SKILL.md`，消除 `$HOME` 与 `%USERPROFILE%` 混用

**文件**: `skills/git-push-monitor/SKILL.md`

**当前第 14–16 行**:

```markdown
- **约定目录**：`<用户主目录>\.cursor\skills\git-push-monitor\scripts\`
  - Windows：用户主目录一般为 `%USERPROFILE%`（如 `C:\Users\<用户名>`）
  - Linux/macOS：用户主目录为 `$HOME` 或 `~`
```

**修改为**:

```markdown
- **约定目录**：`{SKILLS_ROOT}\git-push-monitor\scripts\`
  - Windows (PowerShell): `$HOME\.cursor\skills\git-push-monitor\scripts\`
  - Linux/macOS: `~/.cursor/skills/git-push-monitor/scripts/`
```

删除第 15 行中的 `%USERPROFILE%`（如 `C:\Users\<用户名>`）示例，改为 `$HOME` 统一。

---

### T-XPLAT-7: 修改 `scoring/coach/README.md`，路径统一

**文件**: `scoring/coach/README.md`

在文件中搜索所有 `%USERPROFILE%\.cursor\skills\` 和 `~/.cursor/skills/` 并替换为 `{SKILLS_ROOT}/`，保留一处说明展开规则即可。

**搜索替换规则**:
- `%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\SKILL.md` → `{SKILLS_ROOT}/bmad-code-reviewer-lifecycle/SKILL.md`
- `~/.cursor/skills/bmad-code-reviewer-lifecycle/SKILL.md` → `{SKILLS_ROOT}/bmad-code-reviewer-lifecycle/SKILL.md`

在文档首次出现 `{SKILLS_ROOT}` 处添加脚注：`{SKILLS_ROOT}` = Windows `%USERPROFILE%\.cursor\skills\`、macOS/Linux `~/.cursor/skills/`

---

### T-XPLAT-8: 清理 `docs/BMAD/` 文档中的硬编码 `C:\Users\milom` 路径

**影响文件清单**（仅修改可操作文件，不修改历史审计报告）:

| # | 文件 | 修改内容 |
|---|------|----------|
| 1 | `docs/BMAD/bmad-speckit-integration-TASKS.md` | 将所有 `C:\Users\milom\.cursor\skills\` 替换为 `{SKILLS_ROOT}\`（约 30 处） |
| 2 | `docs/BMAD/bmad-bug-assistant技能位置说明.md` | 将所有 `C:\Users\milom\.cursor\skills\` 替换为 `{SKILLS_ROOT}\`（约 6 处） |

**不修改的文件**（历史审计报告，保留原始记录）:
- `_bmad-output/implementation-artifacts/_orphan/AUDIT_*.md` — 审计快照，不修改
- `docs/BMAD/AUDIT_REPORT_*.md` — 审计报告，不修改
- `docs/BMAD/DEBATE_*.md` — 辩论记录，不修改

**搜索替换规则**:

```
C:\Users\milom\.cursor\skills\ → {SKILLS_ROOT}\
C:\Users\milom\.cursor\skills/ → {SKILLS_ROOT}/
```

---

## §5 init-to-root.js 中新增 `--full` 参数与 `.cursor/` 同步后的 README 更新

### T-README-1: 更新 `README.md` 安装说明

**文件**: `README.md`

**当前第 5 行**:

```
**最小复现**：克隆后可将 `commands/`、`rules/`、`_bmad`、`_bmad-output` 复制到项目根，或使用 npx 安装；
```

**在其后追加**:

```
**一键安装**：`pwsh scripts/setup.ps1 -Target <项目路径>`（自动部署全部目录、同步 `.cursor/`、安装全局 Skills）；详见 [安装与迁移指南](docs/INSTALLATION_AND_MIGRATION_GUIDE.md)。
```

---

### T-README-2: 更新 `docs/INSTALLATION_AND_MIGRATION_GUIDE.md` 引用 `setup.ps1`

**文件**: `docs/INSTALLATION_AND_MIGRATION_GUIDE.md`

**§3.2 "安装方式一"** 中，在 npm install 步骤后追加：

```markdown
#### 推荐：一键安装

```powershell
pwsh D:\Dev\BMAD-Speckit-SDD-Flow\scripts\setup.ps1 -Target D:\Dev\your-new-project
```

该脚本自动完成：核心目录部署 + `.cursor/` 同步 + 全局 Skills 安装 + 安装验证。
```

**§3.6 "安装验证"** 中，在现有验证脚本前追加：

```markdown
若使用 `setup.ps1` 安装，验证已内置。手动安装的验证步骤如下：
```

---

## 任务依赖关系

```
T-INSTALL-1 (扩展 init-to-root.js --full) ← T-SYNC-1 依赖此
T-SYNC-1 (init-to-root.js .cursor/ 同步) ← 可与 T-INSTALL-1 合并
T-SYNC-2 (补齐 .cursor/commands/ speckit) ← 立即可执行，无依赖
T-SYNC-3 (同步 code-reviewer-config.yaml) ← 立即可执行，无依赖

T-INSTALL-2 (新建 setup.ps1) ← 依赖 T-INSTALL-1
T-INSTALL-3 (Skills 安装清单) ← 归属 T-INSTALL-2
T-INSTALL-4 (验证逻辑) ← 归属 T-INSTALL-2
T-INSTALL-5 (更新 package.json) ← 依赖 T-INSTALL-2

T-XPLAT-1 (路径占位符约定文档) ← 无依赖，首先执行
T-XPLAT-2 (coach-trigger.yaml) ← 依赖 T-XPLAT-1 定义的约定
T-XPLAT-3 (scoring/coach/config.ts) ← 依赖 T-XPLAT-2
T-XPLAT-4 (skills/README.md) ← 依赖 T-XPLAT-1
T-XPLAT-5 (bmad-customization-backup SKILL.md) ← 依赖 T-XPLAT-1
T-XPLAT-6 (git-push-monitor SKILL.md) ← 依赖 T-XPLAT-1
T-XPLAT-7 (scoring/coach/README.md) ← 依赖 T-XPLAT-1
T-XPLAT-8 (docs/BMAD/ 硬编码清理) ← 依赖 T-XPLAT-1

T-QUICKSTART-1 (新建 QUICKSTART.md) ← 依赖 T-INSTALL-2（引用 setup.ps1）

T-README-1 (更新 README.md) ← 依赖 T-INSTALL-2
T-README-2 (更新安装指南) ← 依赖 T-INSTALL-2
```

## 推荐执行顺序

```
Phase 1 — 立即可执行（无依赖）
  T-SYNC-2    补齐 .cursor/commands/ 中缺失的 9 个 speckit 命令
  T-SYNC-3    同步 .cursor/agents/code-reviewer-config.yaml
  T-XPLAT-1   定义路径占位符约定文档

Phase 2 — 脚本改造
  T-INSTALL-1 扩展 init-to-root.js（含 T-SYNC-1）
  T-XPLAT-2   修改 coach-trigger.yaml
  T-XPLAT-3   修改 scoring/coach/config.ts

Phase 3 — 统一安装脚本
  T-INSTALL-2 新建 setup.ps1（含 T-INSTALL-3、T-INSTALL-4）
  T-INSTALL-5 更新 package.json

Phase 4 — 文档路径统一
  T-XPLAT-4   skills/README.md
  T-XPLAT-5   bmad-customization-backup/SKILL.md
  T-XPLAT-6   git-push-monitor/SKILL.md
  T-XPLAT-7   scoring/coach/README.md
  T-XPLAT-8   docs/BMAD/ 硬编码清理

Phase 5 — 文档收尾
  T-QUICKSTART-1  新建 5 分钟快速上手指南
  T-README-1      更新 README.md
  T-README-2      更新安装指南引用

共 18 个任务，5 个阶段
```
