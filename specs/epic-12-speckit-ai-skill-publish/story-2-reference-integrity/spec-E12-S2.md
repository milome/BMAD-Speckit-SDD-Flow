# Spec E12-S2: 引用完整性

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.2 - 引用完整性  
**输入**: 12-2-reference-integrity.md, PRD §5.5/§5.10/§5.11/§5.3.1, ARCH §3.2/§3.3/§4.2

---

## 1. 概述

本 spec 定义 Story 12.2（引用完整性）的技术规格，覆盖：

- **commands/rules/config 同步**：从 `_bmad`（或 worktree 共享模式下 `bmadPath` 指向目录）的 `cursor/` 子目录，按所选 AI 的 configTemplate 映射到目标目录；目标由 configTemplate.commandsDir、rulesDir、agentsDir/configDir 决定，**禁止写死 .cursor/**
- **vscodeSettings**：若 configTemplate 含 vscodeSettings 字段，将配置内容深度合并写入 `projectRoot/.vscode/settings.json`；.vscode 不存在时创建
- **check 结构验证**：按 selectedAI 验证对应目标目录存在且含关键子目录；opencode→.opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands 显式校验；无 selectedAI 时跳过或向后兼容默认
- **--bmad-path 验证**：check 在 bmad-speckit.json 含 bmadPath 时，验证 bmadPath 指向目录存在且结构符合 §5.5 验证清单；不满足时退出码 4
- **worktree 共享模式**：init --bmad-path 时，同步源从 bmadPath 指向目录的 cursor/ 读取

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| PRD §5.10 | commands/rules/config 从 _bmad/cursor/ 按 configTemplate 映射到所选 AI 目标目录 | §3.1, §3.2, §3.3 | ✅ |
| PRD §5.10 | 禁止写死 .cursor/；按所选 AI 写入对应目录 | §3.1 | ✅ |
| PRD §5.10 | worktree 共享：bmadPath 记录，同步从 bmadPath 读取 | §3.5 | ✅ |
| PRD §5.11 | 引用完整性：commands、rules、config 引用链有效；init 后 check 验证 | §4, §5 | ✅ |
| PRD §5.5 | check 结构验证：_bmad、_bmad-output、按 selectedAI 验证目标目录 | §4.1, §4.2 | ✅ |
| PRD §5.5 | cursor-agent→.cursor/、claude→.claude/、opencode→.opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands | §4.2 | ✅ |
| PRD §5.2 | --bmad-path 当 path 不存在或结构不符合 §5.5 时退出码 4 | §4.3 | ✅ |
| PRD §5.3.1 | vscodeSettings 对应 .vscode/settings.json，合并非覆盖 | §3.4 | ✅ |
| ARCH §3.2 | InitCommand：按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录 | §3 | ✅ |
| ARCH §3.3 | init 流程：若 configTemplate 含 vscodeSettings，写入 .vscode/settings.json | §3.4 | ✅ |
| Story AC-1 | 按 configTemplate 同步，cursor-agent/claude/opencode/bob/shai/codex 映射 | §3.2 | ✅ |
| Story AC-2 | vscodeSettings 写入、合并策略、无 vscodeSettings 时跳过 | §3.4 | ✅ |
| Story AC-3 | check 按 selectedAI 验证，opencode/bob/shai/codex 显式条目 | §4.2 | ✅ |
| Story AC-4 | --bmad-path 验证：有效/路径不存在/结构不符合 | §4.3 | ✅ |
| Story AC-5 | worktree  sync 源：bmadPath vs 项目根 _bmad | §3.5 | ✅ |

---

## 3. SyncService 同步逻辑

### 3.1 模块职责与接口

| 方法 | 签名 | 说明 |
|------|------|------|
| syncCommandsRulesConfig | `syncCommandsRulesConfig(projectRoot, selectedAI, options)` | 按 configTemplate 同步 commands、rules、config 到所选 AI 目标目录；options 含 `bmadPath?: string` |

**实现位置**：`packages/bmad-speckit/src/services/sync-service.js`（新建）

### 3.2 同步映射规则（禁止写死 .cursor/）

| 源路径（_bmad 或 bmadPath 下） | configTemplate 字段 | 目标路径（projectRoot 下） |
|------------------------------|---------------------|---------------------------|
| `cursor/commands/` | commandsDir | `{projectRoot}/{commandsDir}`（如 .cursor/commands、.claude/commands、.opencode/command、.bob/commands、.shai/commands、.codex/commands） |
| `cursor/rules/` | rulesDir | `{projectRoot}/{rulesDir}` |
| `cursor/config/` | agentsDir（优先）或 configDir | `{projectRoot}/{agentsDir}` 或 `{projectRoot}/{configDir}`；agentsDir 为目录，configDir 可为文件（如 .codex/config.toml） |

**显式 AI 目标映射（PRD §5.5 对齐）**：

| selectedAI | commandsDir | rulesDir | agentsDir/configDir |
|------------|-------------|----------|---------------------|
| cursor-agent | .cursor/commands | .cursor/rules | .cursor/agents |
| claude | .claude/commands | .claude/rules | .claude/agents |
| opencode | .opencode/command | — | — |
| bob | .bob/commands | — | — |
| shai | .shai/commands | — | — |
| codex | .codex/commands | — | .codex/config.toml |
| 其他 | 从 AIRegistry.getById 的 configTemplate 读取 | 同上 | 同上 |

**约束**：目标路径均在 projectRoot 下用 path.join 解析；禁止硬编码 `.cursor/` 或其他单一 AI 目录。

### 3.3 同步行为

| 场景 | 行为 |
|------|------|
| configTemplate.commandsDir 存在 | 复制 cursor/commands → commandsDir |
| configTemplate.rulesDir 存在 | 复制 cursor/rules → rulesDir |
| configTemplate.agentsDir 存在 | 复制 cursor/config 内容 → agentsDir（目录） |
| configTemplate.configDir 存在且无 agentsDir | 将 config 内容写入 configDir（可为单文件路径）；**configDir 为单文件时**（如 .codex/config.toml）：将 cursor/config/ 下主配置文件（如 code-reviewer-config.yaml）的内容写入目标；格式不同时需按目标扩展名转换，或复制首个匹配文件（实现时由 plan 细化） |
| 源目录不存在 | 跳过该映射，不抛错 |

### 3.4 vscodeSettings 处理

| 场景 | 行为 |
|------|------|
| configTemplate.vscodeSettings 存在 | 读取 vscodeSettings 配置内容（可为 JSON 对象或路径），深度合并到 projectRoot/.vscode/settings.json |
| .vscode 不存在 | 创建 .vscode 目录 |
| .vscode/settings.json 已存在 | 深度合并：保留原有键值，同键以 configTemplate 为准 |
| configTemplate 无 vscodeSettings | 不创建或修改 .vscode/settings.json |

**合并策略**：JSON 深度合并；同键冲突时 configTemplate 优先。

### 3.5 同步源路径（worktree vs 默认）

| 场景 | 源根路径 |
|------|----------|
| options.bmadPath 存在 | `path.resolve(bmadPath)/cursor/` |
| 否则 | `path.join(projectRoot, '_bmad', 'cursor')/` |

---

## 4. CheckCommand 结构验证

### 4.1 验证流程

1. 读取 `_bmad-output/config/bmad-speckit.json` 的 selectedAI、bmadPath
2. 若 bmadPath 存在：执行 §4.3 bmadPath 验证
3. 若 selectedAI 存在：执行 §4.2 AI 目标目录验证
4. 无 selectedAI 时：跳过 AI 目标目录验证，或验证 .cursor 作为向后兼容默认（与 Story 13.1 约定一致）

### 4.2 按 selectedAI 验证目标目录（§5.5 验证清单）

从 AIRegistry.getById(selectedAI) 获取 configTemplate，按以下规则验证：

| selectedAI | 必须存在的目标 | 关键子目录 |
|------------|----------------|-----------|
| cursor-agent | .cursor | commands/、rules/ 或 agents/ 至少其一 |
| claude | .claude | commands/ 或 rules/ 至少其一 |
| opencode | .opencode | command/（单数） |
| bob | .bob | commands/ |
| shai | .shai | commands/ |
| codex | .codex | commands/ |
| 其他 AI | 按 configTemplate.commandsDir、rulesDir 解析根目录 | 对应子目录 |

**验证失败**：退出码 1，列出缺失项。**验证成功**：退出码 0。

### 4.3 bmadPath 验证（退出码 4）

| 场景 | 行为 |
|------|------|
| bmadPath 指向路径不存在 | 退出码 4（TARGET_PATH_UNAVAILABLE），输出明确错误信息 |
| bmadPath 指向目录存在但结构不符合 §5.5 | 退出码 4，列出缺失项（core/、cursor/、speckit/、skills/ 至少其二；cursor 存在时含 commands/、rules/） |
| bmadPath 有效 | 退出码 0 |

**注意**：当 bmad-speckit.json 无 bmadPath 时，check 应验证项目内 _bmad 结构（若存在），并执行 selectedAI 目标目录验证；本 Story 与 Story 10.5 衔接，check 在无 bmadPath 时行为与「标准 init」一致。

### 4.4 数据源

- bmad-speckit.json 路径：`{cwd}/_bmad-output/config/bmad-speckit.json`
- ConfigManager.get('selectedAI', { cwd })、ConfigManager.get('bmadPath', { cwd }) 或直接读取 JSON

---

## 5. InitCommand 集成

### 5.1 调用时机

在 generateSkeleton 或 createWorktreeSkeleton 完成后、writeSelectedAI 之前或之后，调用 SyncService.syncCommandsRulesConfig(projectRoot, selectedAI, { bmadPath })。

### 5.2 替换现有逻辑

- **禁止**：init-skeleton.js 中 createWorktreeSkeleton、generateWorktreeSkeleton 的硬编码 `.cursor/`、`.claude/` 复制逻辑须移除，改为调用 SyncService。
- **普通 init**：generateSkeleton 后也须调用 SyncService，将 _bmad/cursor/ 按 configTemplate 同步到所选 AI 目标目录。

---

## 6. 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| AI Registry、configTemplate 数据源 | Story 12.1 | 本 Story 消费 AIRegistry.getById |
| Skill 发布到 configTemplate.skillsDir | Story 12.3 | — |
| check 的 AI 工具检测、--list-ai、子代理等级输出 | Story 13.1 | 本 Story 仅负责结构验证 |

---

## 7. 跨平台与实现约束

- **路径**：使用 `path.join`、`path.resolve`，禁止硬编码 `/` 或 `\`
- **依赖**：AIRegistry（Story 12.1）、ConfigManager、fs、path

---

## 8. 术语

| 术语 | 定义 |
|------|------|
| configTemplate | AI 配置模板，含 commandsDir、rulesDir、agentsDir、configDir、vscodeSettings |
| 深度合并 | JSON 对象递归合并，同键时后者覆盖前者 |
| bmadPath | worktree 共享模式下指向共享 _bmad 目录的路径 |
