# Spec E12-S1: AI Registry

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.1 - AI Registry  
**输入**: 12-1-ai-registry.md, PRD §5.3/§5.3.1/§5.9/§5.12/§5.12.1, ARCH §3.2/§4.2

---

## 1. 概述

本 spec 定义 Story 12.1（AI Registry）的技术规格，覆盖：

- **Registry 存储与优先级**：全局 `~/.bmad-speckit/ai-registry.json`、项目级 `_bmad-output/config/ai-registry.json`；合并优先级：项目 > 全局 > 内置
- **19+ 内置 configTemplate**：与 PRD §5.12 表对齐，含 commandsDir、rulesDir、skillsDir、agentsDir/configDir、vscodeSettings、subagentSupport
- **configTemplate 条件约束**：commandsDir 与 rulesDir 至少其一；skillsDir 若 AI 支持 skill 则必填；agentsDir 与 configDir 二选一
- **subagentSupport**：每 AI 含 `native` | `mcp` | `limited` | `none`
- **detectCommand**：registry 条目可含，用于 check 检测是否已安装；省略时 check 跳过该 AI 安装检测
- **generic 退出码 2**：`--ai generic` 时须 `--ai-commands-dir` 或 registry 含 aiCommandsDir，否则退出码 2
- **AIRegistry 接口**：load()、getById()、listIds()

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| PRD §5.3 | Registry 文件：~/.bmad-speckit/ai-registry.json、项目级 _bmad-output/config/ai-registry.json | §3.1, §3.2 | ✅ |
| PRD §5.3 | 格式含 id、name、configTemplate、rulesPath、detectCommand、aiCommandsDir | §3.3, §4.1 | ✅ |
| PRD §5.3.1 | configTemplate 结构：commandsDir、rulesDir、skillsDir、agentsDir/configDir、vscodeSettings | §4.2 | ✅ |
| PRD §5.3.1 | 条件约束：commandsDir/rulesDir 至少其一；skillsDir 若 AI 支持 skill 则必填；agentsDir/configDir 二选一 | §4.2.1 | ✅ |
| PRD §5.9 | 配置路径：~/.bmad-speckit/ai-registry.json、_bmad-output/config/ai-registry.json | §3.1 | ✅ |
| PRD §5.12 | 19+ AI configTemplate 与 spec-kit 对齐（opencode→.opencode/command、auggie→.augment/rules、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands） | §4.3 | ✅ |
| PRD §5.12.1 | configTemplate 含 subagentSupport；generic 须 --ai-commands-dir 或 registry 含 aiCommandsDir | §4.2.2, §5 | ✅ |
| ARCH §3.2 | AIRegistry：加载内置 + 用户/项目 registry、解析 configTemplate | §6 | ✅ |
| ARCH §4.2 | configTemplate 结构、合并顺序：内置 → 用户 → 项目 | §3.2, §6.2 | ✅ |
| Story AC-1 | registry 文件路径与优先级、合并、文件缺失/无效 | §3 | ✅ |
| Story AC-2 | 19+ 内置 configTemplate、条件约束、subagentSupport | §4 | ✅ |
| Story AC-3 | registry 条目格式、configTemplate 校验、detectCommand、rulesPath | §3.3, §4.1 | ✅ |
| Story AC-4 | generic 类型与 --ai-commands-dir、退出码 2 | §5 | ✅ |
| Story AC-5 | AIRegistry load、getById、listIds、合并逻辑 | §6 | ✅ |

---

## 3. Registry 存储与优先级

### 3.1 路径定义

| 类型 | 路径 | 说明 |
|------|------|------|
| 全局 | `~/.bmad-speckit/ai-registry.json` | 用户级自定义 AI；使用 `os.homedir()` + `path.join` 跨平台 |
| 项目级 | `<cwd>/_bmad-output/config/ai-registry.json` | 项目内覆盖；cwd 由调用方传入，默认 `process.cwd()` |

### 3.2 合并优先级

同一 id 在内置、全局、项目级均存在时：**项目级 > 全局 > 内置**。configTemplate 深度合并：项目级字段覆盖同名字段。

### 3.3 加载行为

| 场景 | 行为 |
|------|------|
| 文件不存在 | 对应来源为空数组，不抛错 |
| JSON 解析失败 | 抛出明确错误，含文件路径，便于用户修复 |

---

## 4. 19+ 内置 configTemplate 与结构

### 4.1 Registry 条目格式与文件结构

**文件顶层结构**（Story T3.1）：registry 文件为 JSON，支持两种格式之一：

- `{ "ais": [ { "id", "name", "configTemplate", ... } ] }` — 顶层对象含 `ais` 数组
- `[ { "id", "name", "configTemplate", ... } ]` — 顶层数组

**单条目格式**：

```json
{
  "id": "string",
  "name": "string",
  "description": "string?",
  "configTemplate": { ... },
  "rulesPath": "string?",
  "detectCommand": "string?",
  "aiCommandsDir": "string?"
}
```

- `id`、`name` 必填；`description`、`rulesPath`、`detectCommand`、`aiCommandsDir` 可选
- 用户/项目 registry 中**自定义 AI**（非覆盖内置）时，`configTemplate` 必填；缺失时 load 抛出错误，含文件路径
- `detectCommand`：用于 check 检测是否已安装；省略时 check 跳过该 AI 安装检测
- `aiCommandsDir`：generic 类型须在 registry 或通过 `--ai-commands-dir` 提供

### 4.2 configTemplate 结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| commandsDir | string | 条件 | 项目内 commands 目标目录，如 `.cursor/commands` |
| rulesDir | string | 条件 | 项目内 rules 目标目录；commandsDir 与 rulesDir 至少其一 |
| skillsDir | string | 条件 | 全局或项目内 skills 目录；若 AI 支持 skill 则必填 |
| agentsDir | string | 否 | 与 configDir 二选一；项目内 agents/config 目录 |
| configDir | string | 否 | 与 agentsDir 二选一；部分 AI 用此字段 |
| vscodeSettings | string | 否 | `.vscode/settings.json` 等，非必填 |
| subagentSupport | string | 是 | `native` \| `mcp` \| `limited` \| `none`，PRD §5.12.1 |

#### 4.2.1 条件约束（用户/项目 registry 校验）

- `commandsDir` 与 `rulesDir` 至少其一
- `skillsDir`：若 AI 支持 skill 则必填。**判定依据**：以 PRD §5.12 表及内置 configTemplate 的 skillsDir 是否非空为准；用户/项目 registry 自定义 AI 时，若意图发布 skill 则 skillsDir 必填。内置数据在代码中保证正确
- `agentsDir` 与 `configDir` 二选一（同一 AI 仅填其一）

#### 4.2.2 subagentSupport 映射（PRD §5.12.1）

| 等级 | AI id |
|------|-------|
| native | cursor-agent, claude, copilot, qwen, opencode, auggie, codebuddy, amp, q, agy, qodercli, kiro-cli |
| mcp | codex, shai, bob |
| limited | windsurf, kilocode, roo, cody |
| none | tabnine |
| 由 registry 定义 | generic |

### 4.3 19+ 内置 configTemplate 表（PRD §5.12 对齐）

| AI id | commandsDir | rulesDir | skillsDir | agentsDir/configDir | subagentSupport |
|-------|-------------|----------|-----------|---------------------|-----------------|
| cursor-agent | .cursor/commands | .cursor/rules | ~/.cursor/skills | .cursor/agents | native |
| claude | .claude/commands | .claude/rules | ~/.claude/skills | .claude/agents | native |
| gemini | .gemini/commands | — | ~/.gemini/commands | — | limited |
| copilot | .github/agents | — | — | — | native |
| qwen | .qwen/commands | — | ~/.qwen/skills | — | native |
| opencode | **.opencode/command** | — | ~/.config/opencode/commands | — | native |
| codex | .codex/commands | — | — | .codex/config.toml | mcp |
| windsurf | .windsurf/workflows | — | ~/.codeium/windsurf/skills | — | limited |
| kilocode | — | .kilocode/rules | ~/.kilocode/rules | — | limited |
| auggie | — | **.augment/rules** | ~/.augment/commands | — | native |
| roo | — | .roo/rules | ~/.roo/rules | — | limited |
| codebuddy | .codebuddy/commands | — | .codebuddy/skills | .codebuddy/agents | native |
| amp | .agents/commands | — | — | — | native |
| shai | .shai/commands | — | ~/.shai/skills | — | mcp |
| q | ~/.aws/amazonq/prompts | — | ~/.aws/amazonq/prompts | — | native |
| agy | .agent/workflows | — | ~/.gemini/antigravity/skills | .agent/skills | native |
| bob | .bob/commands | — | — | — | mcp |
| qodercli | .qoder/commands | — | ~/.qoder/skills | — | native |
| cody | — | — | — | cody.json | limited |
| tabnine | — | — | ~/.tabnine/agent | — | none |
| kiro-cli | .kiro/prompts | — | ~/.kiro/prompts | — | native |
| generic | 由 registry 或 --ai-commands-dir | 由 registry | 由 registry | 由 registry | 由 registry |

**spec-kit 对齐要点**：
- opencode：`.opencode/command`（单数）
- auggie：仅 `.augment/rules`，无 commandsDir
- bob：`.bob/commands`
- shai：`.shai/commands`
- codex：`.codex/commands`

---

## 5. generic 类型与退出码 2

| 场景 | 行为 |
|------|------|
| `--ai generic` 且 registry 中 generic 无 aiCommandsDir、未传 --ai-commands-dir | 退出码 2，输出：须提供 --ai-commands-dir 或 registry 含 aiCommandsDir |
| `--ai generic --ai-commands-dir ./my-commands` | 通过，使用该目录 |
| registry 中 generic 含 aiCommandsDir | 使用 registry 的 aiCommandsDir，无需 --ai-commands-dir |
| init/check 任一子命令 | 上述校验逻辑适用；退出码 2 与 PRD §5.2、ARCH §3.4 一致 |

---

## 6. AIRegistry 模块接口

### 6.1 接口定义

| 方法 | 签名 | 说明 |
|------|------|------|
| load | `load({ cwd?: string })` | 返回合并后的 AI 列表；cwd 未传入时以 process.cwd() 为默认 |
| getById | `getById(id, { cwd?: string })` | 返回该 id 的完整条目，不存在返回 null |
| listIds | `listIds({ cwd?: string })` | 返回所有可用 AI 的 id 数组，供 check --list-ai、--ai 无效时提示使用 |

### 6.2 合并逻辑

- 内置 + 全局 + 项目级按 id 去重
- 同 id 时：项目覆盖全局覆盖内置
- configTemplate 深度合并：项目级字段覆盖同名字段
- 每项含 id、name、configTemplate、subagentSupport 等完整字段

### 6.3 实现位置

- 模块：`packages/bmad-speckit/src/services/ai-registry.js`
- 内置数据：扩展 `src/constants/ai-builtin.js` 或新建 `src/constants/ai-registry-builtin.js`

---

## 7. 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录 | Story 12.2 | 本 Story 仅提供 registry 与 configTemplate 数据源 |
| vscodeSettings 写入 .vscode/settings.json | Story 12.2 | — |
| Skill 发布到 configTemplate.skillsDir | Story 12.3 | — |
| check 按 selectedAI 验证目标目录、输出子代理支持等级 | Story 13.1 | 本 Story 提供 registry 及 configTemplate |
| --ai 无效时输出可用 AI 列表或提示 run check --list-ai | Story 13.1、10.1 | 本 Story 提供 getMergedRegistry() 供调用 |

---

## 8. 术语

| 术语 | 定义 |
|------|------|
| configTemplate | AI 配置模板，定义 commandsDir、rulesDir、skillsDir、agentsDir、subagentSupport 等 |
| subagentSupport | 子代理支持等级：native \| mcp \| limited \| none |
| detectCommand | 用于 check 检测该 AI 是否已安装的可执行命令 |
| aiCommandsDir | generic 类型所需的 commands 目录路径 |
