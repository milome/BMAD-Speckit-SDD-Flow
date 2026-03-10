# Spec E10-S2: 非交互式 init

**Epic**: 10 - Speckit Init Core  
**Story**: 10.2 - 非交互式 init  
**原始需求文档**: 10-2-non-interactive-init.md

---

## 1. 概述

本 spec 定义 `bmad-speckit init` 的非交互式执行模式，使 DevOps 工程师能在 CI/CD 或 Dockerfile 中通过 `init --ai cursor --yes` 无阻塞完成初始化，无需人工交互。

---

## 2. 功能范围

### 2.1 本 Story 范围

| 功能点 | 描述 | 边界条件 |
|--------|------|----------|
| `--ai <name>` | 非交互指定 AI assistant，跳过选择器 | name 不在内置或 registry 时退出码 2，输出可用 AI 列表或提示 `check --list-ai` |
| `--yes` / `-y` | 跳过所有交互，使用默认值 | 默认 AI 来源：`~/.bmad-speckit/config.json` 的 `defaultAI` > 内置列表第一项 |
| TTY 检测 | 非 TTY 且未传 `--ai` 且未传 `--yes` 时，自动视为 `--yes` | 使用默认 AI |
| 环境变量 | `SDD_AI`、`SDD_YES`（1/true 表示非交互） | 优先级低于 CLI 参数 |
| `--modules` 非交互 | 须与 `--ai`、`--yes` 配合使用 | `--modules bmm,tea --ai cursor --yes` 选择性初始化模块 |

### 2.2 非本 Story 范围

| 功能 | 负责 Story |
|------|------------|
| 交互式 init、Banner、AI 选择器 | Story 10.1 |
| 跨平台脚本生成（--script sh/ps） | Story 10.3 |
| 配置持久化（defaultAI 写入） | Story 10.4 |
| --bmad-path worktree 共享 | Story 10.5 |

---

## 3. 验收标准（AC）技术规格

### AC-1: --ai 跳过选择器

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 有效 AI | 用户传 `--ai cursor-agent` | init 执行 | 跳过 AI 选择步骤，直接使用 cursor-agent |
| 无效 AI | 用户传 `--ai invalid-ai` | init 执行 | 报错退出，输出可用 AI 列表或提示 `check --list-ai`，退出码 2 |

**实现要点**：
- 解析 `--ai` 参数，存在时跳过 inquirer AI 选择步骤
- 校验 `--ai` 值是否在 ai-builtin 或 registry 中；若无效，输出可用 AI 列表或提示，`process.exit(exitCodes.AI_INVALID)`（2）

### AC-2: --yes 使用默认值

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 有 defaultAI | ~/.bmad-speckit/config.json 含 defaultAI: "claude" | 用户传 `--yes` | 使用 claude，不等待用户输入 |
| 无 defaultAI | 全局配置无 defaultAI | 用户传 `--yes` | 使用内置列表第一项（如 claude） |
| 全默认 | 用户传 `--yes` | init 执行 | 路径、模板版本均使用默认（路径为 targetPath，模板为 latest），无阻塞 |

**实现要点**：
- 解析 `--yes` / `-y`，存在时跳过所有 inquirer 交互
- 默认 AI 来源逻辑：ConfigManager 读取 `defaultAI`（若 10.4 未完成则跳过）> ai-builtin[0].id
- 路径使用 targetPath（当前目录或指定路径），模板版本使用 `latest`

### AC-3: TTY 检测

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 非 TTY 无参数 | 管道/重定向/CI 环境（非 TTY） | 未传 --ai、--yes | 自动视为 --yes，使用默认 AI |
| 非 TTY 有 --ai | 非 TTY 环境 | 用户传 `--ai cursor-agent` | 使用 cursor-agent，不自动 --yes |

**实现要点**：
- 使用 `utils/tty.js` 的 `isTTY()`（Story 10.1 已实现）
- InitCommand 流程入口：`!ttyUtils.isTTY() && !options.ai && !options.yes` 时设置 `internalYes=true`

### AC-4: 环境变量

| Scenario | Given | When | Then |
|----------|-------|------|------|
| SDD_AI | 环境变量 SDD_AI=claude | 未传 --ai | 使用 claude |
| SDD_YES | 环境变量 SDD_YES=1 | 未传 --yes | 视为非交互，使用默认值 |
| CLI 优先 | SDD_AI=claude 且 --ai cursor-agent | init 执行 | 使用 cursor-agent（CLI 覆盖环境变量） |

**实现要点**：
- 读取 `process.env.SDD_AI`、`process.env.SDD_YES`
- 优先级：CLI > 环境变量
- `SDD_YES=1` 或 `SDD_YES=true`（不区分大小写）时视为非交互

### AC-5: --modules 非交互校验

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 配合 --ai --yes | 用户传 `--modules bmm,tea --ai cursor-agent --yes` | init 执行 | 仅初始化 bmm、tea 模块，无交互 |
| 缺 --ai/--yes | 用户仅传 `--modules bmm` 且非 TTY | init 执行 | 自动 --yes 后执行，或报错提示须配合 --ai、--yes |

**实现要点**：
- `--modules` 指定且为非交互模式时，须已传 `--ai` 或 `--yes`（或 TTY 自动 --yes）
- 缺 --ai/--yes 且非 TTY 时：因 TTY 检测会设置 internalYes，故可执行；若为 TTY 且仅传 --modules，则进入交互流程（非本 Story 变更）

---

## 4. 架构约束与依赖

### 4.1 依赖 Story 10.1

- **InitCommand**：`packages/bmad-speckit/src/commands/init.js`，已实现交互式流程
- **utils/tty.js**：`isTTY()` 封装 `process.stdout.isTTY`
- **ai-builtin.js**：19+ AI 列表，`--ai` 无效时从此列表输出
- **TemplateFetcher**：模板拉取，`--yes` 时路径、模板版本使用默认
- **exit-codes.js**：退出码 2 为 AI_INVALID

### 4.2 ConfigManager

- 读取 `defaultAI` 由 Story 10.4 实现
- 本 Story 可调用 ConfigManager 接口；若 10.4 未完成则 defaultAI 来源仅为内置第一项

---

## 5. CLI 参数扩展

init 命令须新增以下选项（在 bin 与 init.js 中）：

| 选项 | 类型 | 描述 |
|------|------|------|
| `--ai <name>` | string | 非交互指定 AI，跳过选择器 |
| `--yes`, `-y` | boolean | 跳过所有交互，使用默认值 |

---

## 6. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story 陈述 | 非交互式 init，CI/CD 无阻塞 | §1 概述 | ✅ |
| 需求追溯 PRD US-2 | 非交互式初始化（CI/脚本） | §2.1、§3 AC-1～AC-5 | ✅ |
| 需求追溯 PRD §5.2 | --ai、--yes、边界与异常、非 TTY 自动 --yes | §2.1、§3、§5 | ✅ |
| 需求追溯 PRD §5.8 | 非交互模式、环境变量 SDD_AI/SDD_YES、TTY 检测 | §3 AC-3、AC-4 | ✅ |
| 需求追溯 ARCH §3.2 | init 流程状态机、非 TTY 且无 --ai/--yes 时自动 --yes | §3 AC-3 | ✅ |
| 需求追溯 Epics 10.2 | 非交互式 init 完整描述与验收要点 | §2.1、§3、§4 | ✅ |
| 本 Story 范围 --ai | 非交互指定 AI，无效时退出码 2 | §3 AC-1、§5 | ✅ |
| 本 Story 范围 --yes | 跳过交互，defaultAI > 内置第一项 | §3 AC-2、§4.2 | ✅ |
| 本 Story 范围 TTY 检测 | 非 TTY 无 --ai/--yes 时自动 --yes | §3 AC-3 | ✅ |
| 本 Story 范围 环境变量 | SDD_AI、SDD_YES，优先级低于 CLI | §3 AC-4 | ✅ |
| 本 Story 范围 --modules | 须与 --ai、--yes 配合 | §3 AC-5 | ✅ |
| 非本 Story 范围 | 10.1/10.3/10.4/10.5 职责 | §2.2 | ✅ |
| AC-1～AC-5 表 | 各 Scenario Given/When/Then | §3 对应 AC 节 | ✅ |
| Tasks T1～T5 | TTY、--ai、--yes、环境变量、--modules | §3 实现要点 | ✅ |
| Dev Notes 架构约束 | 依赖 10.1、ConfigManager | §4 | ✅ |
