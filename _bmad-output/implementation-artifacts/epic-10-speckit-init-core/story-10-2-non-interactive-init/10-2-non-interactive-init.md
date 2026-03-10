# Story 10.2: 非交互式 init

Status: ready-for-dev

## Story

**As a** DevOps 工程师，  
**I want to** 使用 `init --ai cursor --yes` 无阻塞完成初始化，  
**so that** 我能在 CI/CD 或 Dockerfile 中自动化执行 init，无需人工交互。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | US-2 | 非交互式初始化（CI/脚本） |
| PRD | §5.2 | --ai、--yes、边界与异常、非 TTY 自动 --yes |
| PRD | §5.8 | 非交互模式、环境变量 SDD_AI/SDD_YES、TTY 检测 |
| ARCH | §3.2 | init 流程状态机、非 TTY 且无 --ai/--yes 时自动 --yes |
| Epics | 10.2 | 非交互式 init 完整描述与验收要点 |

## 本 Story 范围

- `--ai <name>`：非交互指定 AI assistant，跳过选择器；name 不在内置或 registry 时退出码 2，输出可用 AI 列表或提示 `check --list-ai`
- `--yes` / `-y`：跳过所有交互，使用默认值；默认 AI 来源：`~/.bmad-speckit/config.json` 的 `defaultAI` > 内置列表第一项
- TTY 检测：非 TTY 且未传 `--ai` 且未传 `--yes` 时，自动视为 `--yes`，使用默认 AI
- 环境变量：`SDD_AI`、`SDD_YES`（1/true 表示非交互），优先级低于 CLI 参数
- `--modules` 非交互：须与 `--ai`、`--yes` 配合使用；`--modules bmm,tea --ai cursor --yes` 选择性初始化模块

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 交互式 init、Banner、AI 选择器 | Story 10.1 | 由 Story 10.1 负责 |
| 跨平台脚本生成（--script sh/ps） | Story 10.3 | 由 Story 10.3 负责 |
| 配置持久化（defaultAI 写入） | Story 10.4 | 由 Story 10.4 负责 |
| --bmad-path worktree 共享 | Story 10.5 | 由 Story 10.5 负责 |

## Acceptance Criteria

### AC-1: --ai 跳过选择器

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 有效 AI | 用户传 `--ai cursor-agent` | init 执行 | 跳过 AI 选择步骤，直接使用 cursor-agent |
| 2 | 无效 AI | 用户传 `--ai invalid-ai` | init 执行 | 报错退出，输出可用 AI 列表或提示 `check --list-ai`，退出码 2 |

### AC-2: --yes 使用默认值

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 有 defaultAI | ~/.bmad-speckit/config.json 含 defaultAI: "claude" | 用户传 `--yes` | 使用 claude，不等待用户输入 |
| 2 | 无 defaultAI | 全局配置无 defaultAI | 用户传 `--yes` | 使用内置列表第一项（如 copilot） |
| 3 | 全默认 | 用户传 `--yes` | init 执行 | 路径、模板版本等均使用默认，无阻塞 |

### AC-3: TTY 检测

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 非 TTY 无参数 | 管道/重定向/CI 环境（非 TTY） | 未传 --ai、--yes | 自动视为 --yes，使用默认 AI |
| 2 | 非 TTY 有 --ai | 非 TTY 环境 | 用户传 `--ai cursor-agent` | 使用 cursor-agent，不自动 --yes |

### AC-4: 环境变量

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | SDD_AI | 环境变量 SDD_AI=claude | 未传 --ai | 使用 claude |
| 2 | SDD_YES | 环境变量 SDD_YES=1 | 未传 --yes | 视为非交互，使用默认值 |
| 3 | CLI 优先 | SDD_AI=claude 且 --ai cursor-agent | init 执行 | 使用 cursor-agent（CLI 覆盖环境变量） |

### AC-5: --modules 非交互

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 配合 --ai --yes | 用户传 `--modules bmm,tea --ai cursor-agent --yes` | init 执行 | 仅初始化 bmm、tea 模块，无交互 |
| 2 | 缺 --ai/--yes | 用户仅传 `--modules bmm` 且非 TTY | init 执行 | 自动 --yes 后执行，或报错提示须配合 --ai、--yes |

## Tasks / Subtasks

- [ ] **T1**：TTY 检测与 utils/tty.js（AC: 3）
  - [ ] T1.1 使用 utils/tty.js 的 isTTY()（Story 10.1 已实现，packages/bmad-speckit/src/utils/tty.js），无需重复实现
  - [ ] T1.2 InitCommand 在流程开始时检测 TTY，非 TTY 且无 --ai/--yes 时设置 internalYes=true

- [ ] **T2**：--ai 参数处理（AC: 1）
  - [ ] T2.1 解析 --ai，存在时跳过 AI 选择步骤
  - [ ] T2.2 --ai 无效时：输出可用 AI 列表或提示 `check --list-ai`，退出码 2

- [ ] **T3**：--yes 与默认 AI（AC: 2）
  - [ ] T3.1 解析 --yes/-y，存在时跳过所有交互
  - [ ] T3.2 实现默认 AI 来源逻辑：ConfigManager 读取 defaultAI > 内置第一项
  - [ ] T3.3 --yes 时路径、模板版本使用默认（当前目录或 latest）

- [ ] **T4**：环境变量支持（AC: 4）
  - [ ] T4.1 读取 SDD_AI、SDD_YES，优先级低于 CLI
  - [ ] T4.2 SDD_YES=1 或 true 时视为非交互

- [ ] **T5**：--modules 非交互校验（AC: 5）
  - [ ] T5.1 --modules 指定且为非交互模式时，须已传 --ai 或 --yes（或自动 --yes）
  - [ ] T5.2 缺 --ai/--yes 时给出明确错误提示

## Dev Notes

### 架构约束

- 依赖 Story 10.1 的 InitCommand、ai-builtin、TemplateFetcher
- ConfigManager 读取 defaultAI 由 Story 10.4 实现；本 Story 可调用 ConfigManager 接口，若 10.4 未完成则 defaultAI 来源仅为内置第一项
- utils/tty.js 由 Story 10.1 实现最小接口（见 10-1 Dev Notes），本 Story 扩展或直接使用

### 禁止词

文档与实现中禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### Previous Story Intelligence（Story 10.1）

- **InitCommand**：位于 `packages/bmad-speckit/src/commands/init.js`，已实现交互式流程（Banner → AI 选择 → 路径确认 → 模板版本 → 执行）。本 Story 在其上增加 `--ai`、`--yes` 解析与 TTY 检测分支，禁止重写交互流程。
- **utils/tty.js**：Story 10.1 已实现 `isTTY()`（封装 `process.stdout.isTTY`），init.js 已导入。本 Story 直接使用，在流程入口处调用以决定是否自动启用非交互模式。
- **ai-builtin.js**：19+ AI 列表已存在，`--ai` 无效时须从此列表输出可用 AI 或提示 `check --list-ai`。
- **TemplateFetcher**：已实现模板拉取，`--yes` 时路径、模板版本使用默认（当前目录、latest），直接复用。
- **exit-codes.js**：退出码 0/1/2/3/4/5 已定义，`--ai` 无效时退出码 2。

### Project Structure Notes

```
packages/bmad-speckit/
├── bin/bmad-speckit.js
├── src/
│   ├── commands/init.js      # InitCommand，本 Story 扩展 --ai/--yes/TTY/环境变量
│   ├── services/
│   │   └── template-fetcher.js
│   ├── constants/
│   │   ├── ai-builtin.js     # 复用，--ai 校验时引用
│   │   └── exit-codes.js     # 复用，退出码 2
│   └── utils/
│       ├── path.js
│       └── tty.js            # Story 10.1 已实现，本 Story 使用 isTTY()
```

### References

- [PRD §5.2] --ai、--yes、边界与异常
- [PRD §5.8] 非交互模式、TTY 检测、环境变量
- [Epics] Epic 10 Story 10.2
- [Source: packages/bmad-speckit/src/utils/tty.js] isTTY() 实现
- [Source: packages/bmad-speckit/src/commands/init.js] InitCommand 现有流程

## Dev Agent Record

### Agent Model Used

实施时由 Agent 填入。

### Debug Log References

### Completion Notes List

### File List
