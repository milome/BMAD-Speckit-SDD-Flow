# Story 10.1: 交互式 init

Status: ready-for-dev

<!-- Note: Run validate-create-story for quality check before dev-story. -->

## Story

**As a** 独立开发者，  
**I want to** 运行 `init my-project` 或 `init .` / `init --here` 并通过富终端交互式选择 AI assistant、确认路径、选择模板版本与模块，  
**so that** 我能快速获得一个配置好的 SDD 项目骨架，包含 Banner BMAD-Speckit、19+ AI 列表、路径确认、模板版本选择、--modules 选择性初始化、--force/--no-git 等能力。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | US-1 | 交互式初始化新项目：Banner、15+ AI 列表、路径确认、--modules |
| PRD | §5.2 | init 子命令设计、交互式流程、边界与异常、错误码 |
| PRD | §5.3 | 19+ AI 内置列表、configTemplate 结构 |
| PRD | §5.6 | chalk + boxen + ora 富终端 UI |
| ARCH | §3.2 | InitCommand 职责、init 流程状态机 |
| ARCH | §3.1 | 包结构、commands/init.js、services、constants/ai-builtin.js |
| Epics | 10.1 | 完整 Story 描述与验收要点 |

## 本 Story 范围

- Banner BMAD-Speckit（ASCII/box-drawing 风格，含 CLI 名称与版本号）
- 19+ AI 交互式列表（支持输入过滤、box-drawing 选择器边框）
- 路径确认：`init .`、`init --here` 表示当前目录；`init [project-name]` 表示指定目录
- 模板版本选择（latest / 指定 tag）
- `--modules <bmm|bmb|tea|bmgd|cis|...>` 选择性初始化 BMAD 模块，逗号分隔
- `--force`：非空目录覆盖，跳过确认
- `--no-git`：跳过 git init
- 目标路径已存在且非空且未传 `--force` 时：报错退出，提示使用 `--force` 或选择其他路径；退出码 4
- `--debug`、`--github-token`、`--skip-tls` 参数支持
- 交互式流程：Banner → AI 选择 → 路径确认 → 模板版本 → 执行

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 非交互式 init（--ai、--yes、TTY 检测、环境变量） | Story 10.2 | 由 Story 10.2 负责实现 |
| 跨平台脚本生成（--script sh/ps） | Story 10.3 | 由 Story 10.3 负责实现 |
| 配置持久化（~/.bmad-speckit/config.json、bmad-speckit.json） | Story 10.4 | 由 Story 10.4 负责实现 |
| --bmad-path worktree 共享 | Story 10.5 | 由 Story 10.5 负责实现 |
| 模板 cache、--offline、templateVersion 持久化 | Epic 11 | 由 Epic 11 负责；对应 Story 11.1、11.2 见 epics.md |
| AI Registry 扩展、configTemplate 与 spec-kit 对齐 | Epic 12 | 由 Epic 12 负责；对应 Story 12.1 见 epics.md |
| 按 configTemplate 同步到 AI 目标目录、Skill 发布 | Epic 12 | 由 Epic 12 负责；对应 Story 12.2、12.3 见 epics.md |
| Post-init 引导（/bmad-help 提示） | Story 12.4 | 由 Story 12.4 负责 |
| check、version、upgrade、config、feedback 子命令 | Epic 13 | 由 Epic 13 负责 |

## Acceptance Criteria

### AC-1: Banner 显示

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | Banner 内容 | 用户运行 `init` 进入交互模式 | 流程开始 | 显示 Banner「BMAD-Speckit」，采用 ASCII art 或 box-drawing 风格（如 ┌─┐│└─┘），含 CLI 名称与版本号 |
| 2 | 风格一致 | — | Banner 显示 | 选择器边框采用 box-drawing 风格，与 Banner 一致 |

### AC-2: 19+ AI 交互式列表

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | AI 列表展示 | 内置 19+ AI（claude, gemini, copilot, cursor-agent, qwen, opencode, codex, windsurf, kilocode, auggie, roo, codebuddy, amp, shai, q, agy, bob, qodercli, cody, tabnine, generic） | 用户进入 AI 选择步骤 | 显示完整列表，支持输入过滤（按名称搜索） |
| 2 | 选择器边框 | AI 列表显示 | 渲染选择器 | 使用 box-drawing 字符绘制选择器边框 |
| 3 | 选择生效 | 用户选择某 AI | 确认后 | 所选 AI 用于生成阶段，写入项目配置 |

### AC-3: 路径确认

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 当前目录 | 用户运行 `init .` 或 `init --here` | 解析参数 | 目标路径为当前工作目录 |
| 2 | 指定目录 | 用户运行 `init my-project` | 解析参数 | 目标路径为 `./my-project` 或等效 |
| 3 | 路径确认 | 交互模式下 | 路径选择步骤 | 向用户确认目标路径，可编辑或接受默认 |

### AC-4: 模板版本选择

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 版本选项 | 交互模式 | 模板版本步骤 | 提供 latest 与指定 tag 选项 |
| 2 | 选择生效 | 用户选择版本 | 执行拉取 | 使用所选版本拉取模板 |

### AC-5: --modules 选择性初始化

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 指定模块 | 用户传 `--modules bmm,tea` | 解析参数 | 仅初始化 bmm、tea 模块的 commands、rules、workflows、skills |
| 2 | 未指定 | 用户未传 `--modules` | 执行 | 初始化完整模板 |
| 3 | 交互模式 | 用户传 `--modules bmm,tea` 且为交互模式 | 解析参数 | 使用指定模块执行初始化；未传 `--modules` 时初始化完整模板（非交互时须与 `--ai`、`--yes` 配合，由 Story 10.2 负责） |

### AC-6: --force 非空目录覆盖

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 非空目录无 force | 目标路径已存在且含文件或子目录（含 _bmad/_bmad-output） | 用户未传 `--force` | 报错退出，提示使用 `--force` 覆盖或选择其他路径，退出码 4 |
| 2 | 非空目录有 force | 目标路径已存在且非空 | 用户传 `--force` | 跳过确认，强制合并/覆盖，继续执行 |
| 3 | 空目录 | 目标路径为空目录 | 任意 | 允许 init，无需 `--force` |

### AC-7: --no-git

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 默认行为 | 用户未传 `--no-git` | init 完成 | 执行 git init，创建 .gitignore |
| 2 | 跳过 git | 用户传 `--no-git` | init 完成 | 不执行 git init，不创建 .gitignore |

### AC-8: 调试与网络参数

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | --debug | 用户传 `--debug` | 执行过程 | 输出详细调试日志 |
| 2 | --github-token | 用户传 `--github-token <token>` | 模板拉取 | 使用该 token 调用 GitHub API；或读取 GH_TOKEN/GITHUB_TOKEN 环境变量 |
| 3 | --skip-tls | 用户传 `--skip-tls` | 网络请求 | 跳过 SSL/TLS 验证（企业内网场景）；需在文档或输出中明确警告 |

### AC-9: 错误码

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 目标路径不可用 | 路径已存在且非空、无 `--force` | 校验 | 退出码 4，输出明确错误信息 |

## Tasks / Subtasks

- [ ] **T1**：搭建 InitCommand 骨架与参数解析（AC: 3, 5, 6, 7, 8）
  - [ ] T1.1 使用 Commander.js 注册 init 子命令
  - [ ] T1.2 解析 `[project-name]`、`.`、`--here`、`--modules`、`--force`、`--no-git`、`--debug`、`--github-token`、`--skip-tls`
  - [ ] T1.3 实现目标路径解析逻辑（`.`/`--here` → 当前目录）
  - [ ] T1.4 实现非空目录校验：无 `--force` 时若路径已存在且非空则退出码 4

- [ ] **T2**：实现 Banner 与富终端 UI（AC: 1, 2）
  - [ ] T2.1 使用 chalk + boxen 实现 Banner「BMAD-Speckit」，ASCII/box-drawing 风格，含 CLI 名称与版本号
  - [ ] T2.2 使用 Inquirer.js 或 prompts 实现 AI 选择步骤
  - [ ] T2.3 AI 列表支持输入过滤，选择器采用 box-drawing 边框
  - [ ] T2.4 实现路径确认、模板版本选择交互步骤

- [ ] **T3**：实现 19+ AI 内置列表（AC: 2）
  - [ ] T3.1 创建 constants/ai-builtin.js，包含 19+ AI：claude, gemini, copilot, cursor-agent, qwen, opencode, codex, windsurf, kilocode, auggie, roo, codebuddy, amp, shai, q, agy, bob, qodercli, cody, tabnine, generic
  - [ ] T3.2 每项含 id、name、description，供 Story 12.1 的 configTemplate 扩展

- [ ] **T4**：实现模板拉取与 --modules 逻辑（AC: 4, 5）
  - [ ] T4.1 定义 TemplateFetcher 接口或最小实现：从 GitHub Release 拉取 tarball（具体 cache、--offline 由 Story 11.1 扩展）
  - [ ] T4.2 实现模板版本选择（latest / 指定 tag）与拉取调用
  - [ ] T4.3 实现 --modules 解析：逗号分隔，未指定时初始化完整模板；指定时仅部署所选模块的 commands、rules、workflows、skills
  - [ ] T4.4 集成 --github-token（参数优先，否则 GH_TOKEN/GITHUB_TOKEN 环境变量）、--skip-tls

- [ ] **T5**：实现项目骨架生成与 git init（AC: 6, 7）
  - [ ] T5.1 按模板生成 _bmad、_bmad-output 目录结构（符合 PRD §5.10 方案 A）
  - [ ] T5.2 未传 --no-git 时执行 git init，创建 .gitignore
  - [ ] T5.3 传 --no-git 时跳过 git init

- [ ] **T6**：实现 --debug 与错误处理（AC: 8, 9）
  - [ ] T6.1 --debug 时输出详细日志
  - [ ] T6.2 目标路径不可用时退出码 4，输出明确提示
  - [ ] T6.3 创建 constants/exit-codes.js，定义退出码 0/1/2/3/4/5

## Dev Notes

### 架构约束

- **InitCommand**：位于 src/commands/init.js，负责解析参数、编排交互流程、调用 TemplateFetcher、生成骨架、执行 git init（PRD §5.1–5.2，ARCH §3.2）
- **init 流程状态机**：解析路径 → 校验目标（空/存在/--force）→ 拉取模板 → 选择 AI → 选择模块 → 生成 _bmad、_bmad-output → git init（由 --no-git 控制是否执行）→ 同步 AI 配置（本 Story 不实现完整同步，由 Story 12.2 实现）
- **包结构**：bin/bmad-speckit.js → src/commands/init.js、src/services/template-fetcher.js、src/constants/ai-builtin.js、src/constants/exit-codes.js（ARCH §3.1）
- **CLI 框架**：Commander.js + Inquirer.js/prompts；富终端：chalk、boxen、ora（PRD §5.6，ARCH ADR-1～ADR-3）

### 技术要点

- **路径处理**：使用 Node.js path 模块，禁止硬编码 `/` 或 `\`（ARCH §5.1）
- **box-drawing**：Unicode 制表符 ┌ ─ ┐ │ └ ┘ 等（PRD Appendix B）
- **非空目录判定**：目录存在且（含 _bmad 或 _bmad-output 或含其他文件/子目录）则视为非空
- **TemplateFetcher**：本 Story 实现最小可用版本（GitHub Release 拉取），Story 11.1 扩展 cache、--offline

### 与 E11、E12 的集成边界

- **E11.1**：本 Story 的 TemplateFetcher 可被 Story 11.1 扩展（cache、--offline、templateVersion 持久化），需保持接口兼容
- **E12.1**：本 Story 的 ai-builtin.js 为 19+ AI 列表；Story 12.1 的 AIRegistry 将合并内置 + registry。本 Story 的 InitCommand 可直接使用 ai-builtin，Story 12.1 完成后可切换为 AIRegistry
- **E12.2**：按 configTemplate 同步 commands/rules/config 到 AI 目标目录由 Story 12.2 实现；本 Story 生成 _bmad、_bmad-output 骨架

### 禁止词

文档与实现中禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### Project Structure Notes

```
bmad-speckit/
├── bin/bmad-speckit.js
├── src/
│   ├── commands/init.js      # InitCommand
│   ├── services/
│   │   └── template-fetcher.js  # 最小实现，E11.1 扩展
│   ├── constants/
│   │   ├── ai-builtin.js     # 19+ AI 列表
│   │   └── exit-codes.js     # 0/1/2/3/4/5
│   └── utils/
│       ├── path.js
│       └── tty.js            # 本 Story 实现最小 TTY 检测接口，Story 10.2 扩展
```

### References

- [PRD §5.2] init 子命令设计、交互式流程、边界与异常、错误码
- [PRD §5.3] 19+ AI 内置列表、configTemplate 结构
- [PRD §5.6] chalk + boxen + ora
- [PRD §5.10] 项目根目录结构方案 A
- [ARCH §3.2] InitCommand、TemplateFetcher、init 流程状态机
- [ARCH §3.4] 退出码约定
- [Epics] Epic 10 Story 10.1 完整描述

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
