# PRD: specify-cn 类初始化功能与多 AI Assistant 支持

**文档版本**: 1.0  
**创建日期**: 2025-03-07  
**状态**: 初稿（Party-Mode 100 轮讨论收敛后产出）  
**议题**: 如何增强功能，以实现类似 specify-cn 的初始化功能，并支持多种不同的 AI assistant

---

## 1. Executive Summary

本 PRD 定义一项 CLI 增强功能：为 Spec-Driven Development（SDD）工具链提供 **specify-cn 风格的初始化能力**，支持 **15+ 种 AI assistant（内置 19+ 种）** 的交互式/非交互式选择，具备富终端 UI、模板拉取、check/version/upgrade/config/feedback 子命令，并保证跨平台（Windows/macOS/Linux）与配置持久化。

**核心价值**：降低新项目接入 SDD 的门槛，通过一次 `init` 完成项目骨架、AI 工具配置、模板注入，使开发者可立即开始规范驱动开发。

**关键决策**（经 100 轮 Party-Mode 辩论收敛）：
- **Banner 名称**：**BMAD-Speckit**（体现本项目自身区分度）
- **根目录结构**：仅部署 `_bmad` 与 `_bmad-output`；commands、rules、config、templates、workflows 全部放入 `_bmad` 子目录，避免与项目既有目录（如 config、templates）冲突
- CLI 框架：**Commander.js** + **Inquirer.js**（交互）/ **prompts**（备选）
- AI assistant 枚举：内置 15+ 种 + 可扩展 registry（JSON/YAML）
- 模板来源：GitHub release / 本地 cache / 可配置 URL
- 非交互模式：`--ai <name>`、`--yes`、`--here` 等 flags 支持 CI/脚本

---

## 2. Problem Statement

### 2.1 经典 Problem Statement 格式

| 维度 | 描述 |
|------|------|
| **I am** | 一名希望采用 Spec-Driven Development（SDD）的开发者或团队负责人 |
| **Trying to** | 快速初始化一个新 SDD 项目，并配置好与我所用 AI assistant（如 Cursor、Claude、Copilot、Gemini 等）的集成 |
| **But** | 当前工具缺乏类似 specify-cn 的「一键 init + 交互式 AI 选择 + 富终端体验」，需要手动复制模板、修改配置、适配不同 AI 工具 |
| **Because** | 现有 CLI 要么不支持多 AI 选择，要么交互简陋、文档不足，或模板与 AI 工具版本不同步 |
| **Which makes me feel** | 挫败、效率低下，难以说服团队统一采用 SDD 流程 |

### 2.2 问题细化

- **模板分散**：模板散落在不同 repo/分支，版本管理混乱
- **AI 工具碎片化**：15+ 种 AI assistant 各有配置方式，无统一抽象
- **跨平台差异**：Windows PowerShell vs POSIX shell，路径、编码、换行符不一致
- **非交互场景缺失**：CI、脚本、Docker 构建无法无头执行 init

---

## 3. Target Users & Personas

| Persona | 角色 | 核心需求 | 使用场景 |
|---------|------|----------|----------|
| **独立开发者** | 个人/Solo Dev | 快速起手、最少配置 | 新项目、POC、学习 SDD |
| **团队 Tech Lead** | 架构/工程负责人 | 标准化、可复现、可审计 | 团队规范、模板版本锁定 |
| **DevOps/CI 工程师** | 自动化 | 非交互、幂等、可脚本化 | CI/CD、Dockerfile、自动化部署 |
| **多 AI 用户** | 同时使用多种 AI 工具 | 灵活切换、配置隔离 | 不同项目用不同 AI、A/B 测试 |

---

## 4. Strategic Context

### 4.1 市场参考

- **specify-cn**：中文 SDD CLI，init + 多 AI 选择 + 富终端 UI
- **@spec-kit/cli**：`specify init [project] --ai claude|gemini|copilot|cursor`，支持 `--script sh|ps`、`--no-git`
- **OpenSpec-cn**：中文 OpenSpec 框架，支持 20+ AI 工具

### 4.2 差异化定位

- 与 BMAD/Speckit 生态深度集成
- 支持模板版本锁定、离线 cache、可扩展 AI registry
- 严格跨平台与编码处理（UTF-8、CRLF/LF）

---

## 5. Solution Overview

### 5.0 调用方式约定

CLI 支持**双模式**调用，与 specify-cn、BMAD-METHOD 对齐：

| 模式 | 命令示例 | 适用场景 |
|------|----------|----------|
| **npx 一次性** | `npx bmad-speckit init [project-name]` | 首次试用、零安装、快速验证；需网络拉取 |
| **持久安装** | `npm install -g bmad-speckit` → `bmad-speckit init [project-name]` | 日常使用、CI/CD 镜像、离线环境；启动更快 |

**文档推荐**：
- **首次试用**：使用 `npx bmad-speckit init`，无需全局安装
- **日常使用 / CI / 离线**：持久安装后使用 `bmad-speckit init`，版本可锁定、执行更快

**实现要求**：CLI 包须正确配置 `bin` 字段，确保 `npx` 与全局安装后均可正确解析子命令（`init`、`check`、`version`、`upgrade`、`config`、`feedback`）。

### 5.1 高层架构

```
┌─────────────────────────────────────────────────────────────────┐
│  CLI Entry: bmad-speckit init | [可配置命令名]                   │
├─────────────────────────────────────────────────────────────────┤
│  Subcommands: init | check | version | upgrade | config | feedback  │
├─────────────────────────────────────────────────────────────────┤
│  init 流程:                                                      │
│  1. 解析目标路径 (项目名 | . | --here)                           │
│  2. 拉取/校验模板 (GitHub release / 本地 cache / 自定义 URL)      │
│  3. 交互式/非交互式选择 AI assistant                             │
│  4. 生成项目骨架 + AI 配置 + 脚本 (sh/ps)                         │
│  5. 按需执行: git init、.gitignore（--no-git 可跳过）            │
├─────────────────────────────────────────────────────────────────┤
│  配置持久化: ~/.bmad-speckit/config.json | _bmad-output/config/  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 init 子命令设计

| 用法 | 说明 |
|------|------|
| `init [project-name \| . \| --here]` | 初始化到指定目录；`.` 或 `--here` 表示当前目录 |
| `--ai <name>` | 非交互指定 AI assistant，跳过选择器 |
| `--yes` / `-y` | 跳过所有交互，使用默认值 |
| `--template <url\|tag>` | 指定模板来源或版本 tag |
| `--script sh \| ps` | 生成 shell 脚本类型：POSIX 或 PowerShell |
| `--no-git` | 不执行 git init |
| `--offline` | 仅使用本地 cache，不拉取远程 |
| `--force` | 在非空当前目录强制合并/覆盖（跳过确认）；借鉴 specify-cn，首版实现 |
| `--ignore-agent-tools` | 跳过 AI 代理工具检测（如 Claude Code、Cursor CLI），适用于 CI/企业环境；借鉴 specify-cn |
| `--ai-skills` | 将技能模板安装到代理 skills 目录；默认执行，可用 `--no-ai-skills` 跳过；借鉴 specify-cn |
| `--ai-commands-dir <path>` | 与 `--ai generic` 配合，指定未内置代理的命令目录；借鉴 specify-cn |
| `--debug` | 启用详细调试输出；借鉴 specify-cn |
| `--github-token <token>` | GitHub API 令牌（或 GH_TOKEN/GITHUB_TOKEN 环境变量）；借鉴 specify-cn |
| `--skip-tls` | 跳过 SSL/TLS 验证（不推荐，仅企业内网）；借鉴 specify-cn |
| `--modules <bmm\|bmb\|tea\|bmgd\|cis\|...>` | 选择性初始化 BMAD 模块，逗号分隔（如 `--modules bmm,tea`）；未指定时初始化完整模板；须与 `--ai`、`--yes` 配合非交互使用 |
| `--bmad-path <path>` | 指定已有 `_bmad` 路径，不复制而是通过配置关联；适用于与现有 worktree 共享 `_bmad` 的场景（OQ-5）；仅创建 `_bmad-output` 与 AI 配置，commands、rules 从该路径同步；须与 `--ai`、`--yes` 配合非交互使用；首版必须实现 |

**边界与异常行为**（必须实现）：
- `--ai <name>` 当 `name` 不在内置列表或 registry 时：报错退出，输出可用 AI 列表（`check --list-ai` 或等价），退出码非 0
- `--yes` 时默认 AI 来源：`~/.bmad-speckit/config.json` 的 `defaultAI` > 内置列表第一项（如 `copilot`）
- `init <path>` 当目标路径已存在且（包含 `_bmad` 或 `_bmad-output`，或包含其他文件/子目录）时：报错退出，提示用户使用 `--force` 覆盖或选择其他路径；`--force` 时跳过确认并强制合并；空目录允许 init
- 网络超时/模板拉取失败：明确错误信息，建议 `--offline` 或检查网络；退出码非 0
- `--offline` 且本地 cache 无对应模板时：报错退出，提示用户先在线拉取；退出码非 0
- `--bmad-path <path>` 当 path 不存在或指向目录结构不符合 §5.5 验证清单时：报错退出，退出码 4（目标路径不可用）；check 在 worktree 共享模式下验证 bmadPath 时同理
- `--ai generic` 时若未提供 `--ai-commands-dir` 且 registry 中无 `aiCommandsDir`：报错退出，退出码 2（`--ai` 无效）
- 非 TTY 且未传 `--ai` 且未传 `--yes`：自动视为 `--yes`，使用默认 AI，避免阻塞

**错误码约定**（便于脚本判断，退出码 0 表示成功）：

| 退出码 | 含义 | 典型场景 |
|--------|------|----------|
| 1 | 通用错误 | 未分类异常、配置解析失败 |
| 2 | `--ai` 无效 | 指定 AI 不在内置列表或 registry |
| 3 | 网络/模板失败 | 超时、404、拉取失败 |
| 4 | 目标路径不可用 | 路径已存在且非空、无写权限、`--bmad-path` 指向路径不存在或结构不符合 |
| 5 | 离线 cache 缺失 | `--offline` 且本地无对应模板 |

**交互式流程**（无 `--ai` 且无 `--yes` 时）：
1. 显示 Banner **BMAD-Speckit**（ASCII art / box-drawing 风格，含 CLI 名称与版本号）
2. 选择 AI assistant（列表 + 搜索/过滤）
3. 确认目标路径
4. 选择模板版本（latest / 指定 tag）
5. 确认并执行

**Post-init 引导**（借鉴 BMAD-METHOD `/bmad-help`）：
- init 完成后，在 stdout 输出简短提示：建议在 AI IDE 中运行 `/bmad-help` 或等价命令获取下一步指引
- 模板内须包含 `bmad-help`、`speckit.constitution` 等命令，用于智能引导用户（与 §5.13 一致）

**`--modules` 子命令参数**（必须实现）：`--modules <bmm|bmb|tea|bmgd|cis|...>` 选择性初始化 BMAD 模块，与 `npx bmad-method install --modules bmm --tools claude-code --yes` 对齐。支持多选，逗号分隔（如 `--modules bmm,tea`）。未指定时初始化完整模板；指定时仅拉取并部署所选模块的 commands、rules、workflows、skills。非交互模式下须与 `--ai`、`--yes` 配合使用。

### 5.3 AI Assistant 枚举与扩展机制

**内置列表**（与 specify-cn 对齐，19+ 种）：
- claude, gemini, copilot, cursor-agent, qwen, opencode, codex, windsurf, kilocode, auggie, roo, codebuddy, amp, shai, q, agy, bob, qodercli, cody, tabnine, generic（需配合 `--ai-commands-dir`）

**扩展机制**：
- **Registry 文件**：`~/.bmad-speckit/ai-registry.json` 或项目内 `_bmad-output/config/ai-registry.json`
- **格式**：`{ "id": "custom-ai", "name": "Custom AI", "configTemplate": {...}, "rulesPath": "...", "aiCommandsDir": "..." }`；`generic` 类型须在 registry 或 `--ai-commands-dir` 中指定命令目录
- **优先级**：项目内 > 用户目录 > 内置

**每项 AI 配置包含**：
- `id`、`name`、`description`
- `configTemplate`：定义 commandsDir、rulesDir、skillsDir、agentsDir、vscodeSettings；**按所选 AI 写入对应目录**（Claude→`.claude/`，Cursor→`.cursor/`），不统一写入 `.cursor/`；详见 §5.3.1
- `rulesPath`：支持，指向规则文件路径；registry 中可省略，省略时使用内置默认
- `detectCommand`：支持，用于 `check` 子命令检测是否已安装；registry 中可省略，省略时 check 跳过该 AI 的安装检测

**§5.3.1 configTemplate 结构定义**（registry 与内置共用）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `commandsDir` | string | 条件 | 项目内 commands 目标目录，如 `.cursor/commands`、`.claude/commands`；部分 AI 用 workflows/prompts 替代 |
| `rulesDir` | string | 否 | 项目内 rules 目标目录，如 `.cursor/rules`、`.claude/rules`；部分 AI 仅 rules 无 commands |
| `skillsDir` | string | 条件 | 全局或项目内 skills 目录，如 `~/.cursor/skills`、`~/.claude/skills`；不支持则省略 |
| `agentsDir` | string | 否 | 项目内 agents/config 目录，如 `.cursor/agents`、`.claude/agents` |
| `configDir` | string | 否 | 与 `agentsDir` 等价，部分 AI 用此字段表示配置目录；与 agentsDir 二选一 |
| `vscodeSettings` | string | 否 | `.vscode/settings.json` 等 VS Code 配置路径，可与多 AI 共用 |

**条件**：`commandsDir` 与 `rulesDir` 至少其一；`skillsDir` 若 AI 支持 skill 则必填。同步时 `cursor/config/` 内容写入 `agentsDir` 或 `configDir`（优先 agentsDir）。

### 5.4 模板来源与版本

| 来源 | 说明 | 版本策略 |
|------|------|----------|
| **GitHub Release** | 默认，从 `owner/repo` 的 release 拉取 tarball | `latest` / 指定 tag |
| **本地 cache** | `~/.bmad-speckit/templates/<template-id>/` | 按 tag 缓存，支持 `--offline` |
| **自定义 URL** | `--template https://...` | 用户负责版本 |

**版本锁定**：项目内 `_bmad-output/config/bmad-speckit.json` 记录 `templateVersion`，便于复现与审计。

### 5.5 check 与 version 子命令

| 子命令 | 功能 |
|--------|------|
| `check` | 检测已安装的 AI 工具、CLI 版本、模板版本、环境变量等，输出诊断报告；**并验证** `_bmad`、`_bmad-output`、所选 AI 目标目录（如 `.cursor/`、`.claude/`、`.gemini/` 等）结构完整（目录存在、关键子目录与文件符合方案 A 约定），用于 §5.11 引用完整性验收 |
| `check --list-ai` | 输出可用 AI 列表（内置 + registry），供 `--ai` 无效时提示用户；支持 `--json` |
| `version` | 输出 CLI 版本、模板版本、Node 版本 |
| `upgrade` | 检查并拉取模板最新版本，更新项目内 `_bmad` 与 `_bmad-output` 结构；支持 `--dry-run`（仅检查不执行）、`--template <tag>`（指定目标版本）；须在已 init 的项目目录内执行 |
| `config` | 查看/设置全局或项目级配置；支持 `config get <key>`、`config set <key> <value>`、`config list`；`config set` 在已 init 的项目目录内默认写入项目级（`_bmad-output/config/bmad-speckit.json`），否则写入全局；支持 `--global` 强制写入全局；`config get` 与 `config list` 项目级优先；全局配置写入 `~/.bmad-speckit/config.json` |
| `feedback` | 输出用户反馈入口（问卷 URL 或反馈指引）；init 完成后 stdout 可提示运行 `bmad-speckit feedback` 获取反馈入口；首版须实现（见 §6 Success Metrics） |

**check 结构验证清单**（必须全部通过，否则报错并列出缺失项）：
- `_bmad` 存在，且含子目录：`core/`、`cursor/`、`speckit/`、`skills/`（或至少其二，依模板而定）；**例外**：当 `_bmad-output/config/bmad-speckit.json` 含 `bmadPath` 时（worktree 共享模式），改为验证 `bmadPath` 指向的目录存在且结构符合本清单，不要求项目内存在 `_bmad`
- `_bmad/cursor/` 存在时，含 `commands/`、`rules/`（worktree 共享模式下验证 `bmadPath` 指向目录的 cursor 子目录）
- `_bmad-output` 存在，且含 `config/`
- **按所选 AI 验证目标目录**：读取 `_bmad-output/config/bmad-speckit.json` 的 `selectedAI`（或 init 时传入的 `--ai`），根据该 AI 的 configTemplate 验证对应目录存在且含关键子目录：
  - 若 `selectedAI` 为 `cursor-agent`：`.cursor` 存在，且含 `commands/`、`rules/` 或 `agents/` 至少其一
  - 若 `selectedAI` 为 `claude`：`.claude` 存在，且含 `commands/` 或 `rules/` 至少其一
  - 若 `selectedAI` 为 `gemini`：`.gemini` 存在，且含 `commands/`
  - 若 `selectedAI` 为 `windsurf`：`.windsurf` 存在，且含 `workflows/`
  - 若 `selectedAI` 为 `kilocode`、`auggie`、`roo`：对应 `.kilocode`、`.augment`、`.roo` 存在，且含 `rules/`
  - 若 `selectedAI` 为 `opencode`：`.opencode` 存在，且含 `command/`（spec-kit 单数目录）
  - 若 `selectedAI` 为 `bob`：`.bob` 存在，且含 `commands/`（spec-kit：IBM Bob 用 .bob/commands/）
  - 若 `selectedAI` 为 `shai`：`.shai` 存在，且含 `commands/`（spec-kit：SHAI 用 .shai/commands/）
  - 若 `selectedAI` 为 `codex`：`.codex` 存在，且含 `commands/`（spec-kit：Codex CLI 用 .codex/commands/）
  - 其他 AI：按 configTemplate 的 `commandsDir`、`rulesDir` 解析根目录，验证该目录存在
  - 若项目未 init 或 `bmad-speckit.json` 无 `selectedAI`：跳过本项验证（或验证 `.cursor` 作为向后兼容默认）

**check 退出码**：结构验证失败时，退出码 1（通用错误），并列出缺失项；成功时退出码 0。便于 CI 脚本通过 `$?` 或 `exitCode` 可靠判断。

### 5.6 CLI 框架选型

| 选项 | 选用 | 理由 |
|------|------|------|
| Commander.js | ✅ | 成熟、生态好、子命令支持完善 |
| Inquirer.js / prompts | ✅ | 交互式选择、兼容 TTY 检测 |
| chalk + boxen | ✅ | 富终端 UI（颜色、边框） |
| ora | ✅ | 加载动画，init 拉取模板、发布 skill 等耗时步骤时显示 spinner |

**备选方案**：当 Commander.js 不满足需求时，采用 `yargs` + `prompts` 替代；首版以 Commander.js 为主，备选方案在技术评审中明确触发条件（如 bundle 体积超限、子命令嵌套过深等）。

### 5.7 跨平台（Win/Mac/Linux）

- **路径**：使用 `path` 模块，避免硬编码 `/` 或 `\`
- **脚本**：`--script ps` 生成 PowerShell；`--script sh` 生成 POSIX（Windows 需 Git Bash/WSL）
- **编码**：统一 UTF-8，输出时考虑 Windows 控制台代码页
- **换行符**：生成文件时按 OS 或用户配置（LF/CRLF）

### 5.8 非交互模式

- `--ai <name>`：直接指定 AI，无选择器
- `--yes`：全部默认，不阻塞
- **环境变量**（必须支持，优先级低于 CLI 参数）：`SDD_AI`、`SDD_YES`（1/true 表示非交互）、`SDD_CLI_NAME`、`SDD_NETWORK_TIMEOUT_MS`（网络超时毫秒，默认 30000）
- **TTY 检测**：非 TTY 时自动降级为非交互，除非显式传 `--ai`

### 5.9 配置持久化

| 位置 | 用途 |
|------|------|
| `~/.bmad-speckit/config.json` | 全局默认：defaultAI、defaultScript、templateSource、cache 路径、networkTimeoutMs（支持，默认 30000） |
| `~/.bmad-speckit/ai-registry.json` | 用户自定义 AI 列表 |
| `<project>/_bmad-output/config/bmad-speckit.json` | 项目级：templateVersion、ai、script 类型、initLog（见 §5.12） |
| `<project>/_bmad-output/config/ai-registry.json` | 项目级 AI registry 覆盖（支持，项目内存在时生效，优先级高于全局） |

### 5.10 项目根目录结构（方案 A）

**原则**：init 仅在项目根部署 `_bmad` 与 `_bmad-output`，不创建 `commands`、`rules`、`config`、`templates`、`workflows` 等易冲突目录。上述资源全部纳入 `_bmad` 子目录，同步时从 `_bmad` 按所选 AI 的 configTemplate 写入对应目录（`.cursor/`、`.claude/`、`.windsurf/` 等）。

**第一级目录**（项目根）：

| 目录 | 说明 |
|------|------|
| `_bmad` | BMAD 核心框架，含 cursor/、speckit/ 等子目录 |
| `_bmad-output` | BMAD 产出（implementation-artifacts、planning-artifacts、config 等） |
| `.cursor` / `.claude` / `.windsurf` 等 | 由 sync 创建；commands、rules、agents 从 `_bmad/cursor/` 按所选 AI 的 configTemplate 同步到对应目录 |

**_bmad 子目录结构**：

```
_bmad/
├── core/                    # 核心 tasks、workflows、agents
├── bmm/                     # BMM 工作流
├── bmb/                     # BMB 工作流
├── cis/                     # CIS 工作流
├── tea/                     # TEA 工作流
├── _config/                 # agent-manifest 等
├── scripts/bmad-speckit/    # PowerShell、Python 脚本
├── cursor/                  # 【方案 A】IDE 相关，按所选 AI 的 configTemplate 同步到对应目录
│   ├── commands/            # → configTemplate.commandsDir（如 .cursor/commands、.claude/commands）
│   ├── rules/               # → configTemplate.rulesDir（如 .cursor/rules、.claude/rules）
│   └── config/              # code-reviewer-config 等 → configTemplate.agentsDir（如 .cursor/agents、.claude/agents）
├── speckit/                 # 【方案 A】speckit 阶段定义
│   ├── templates/           # spec/plan/tasks 模板
│   └── workflows/           # constitution.md, specify.md, plan.md 等
└── skills/                  # 【方案 A】全局 skill 源，init 时发布到各 AI 的全局目录
    ├── speckit-workflow/
    ├── bmad-bug-assistant/
    ├── bmad-story-assistant/
    └── …                     # 全部技能，见 §5.12
```

**同步步骤**：init 完成后，根据所选 AI 的 **configTemplate** 决定目标目录，执行以下同步：

1. **commands / rules / config 同步**  
   从 `_bmad`（或 worktree 共享模式下 `bmadPath` 指向目录）的 `cursor/` 子目录，按 configTemplate 映射到所选 AI 的目标目录：
   - `cursor/commands` → `{configTemplate.commandsDir}`（如 `.cursor/commands`、`.claude/commands`、`.windsurf/workflows` 等）
   - `cursor/rules` → `{configTemplate.rulesDir}`（如 `.cursor/rules`、`.claude/rules`、`.kilocode/rules` 等；若 AI 无 rules 概念则映射到等价位置或跳过）
   - `cursor/config/code-reviewer-config.yaml` → `{configTemplate.agentsDir}` 或 `{configTemplate.configDir}`（如 `.cursor/agents/`、`.claude/agents/` 等；若 AI 不支持则跳过）

2. **skills 发布**  
   从 `_bmad/skills/`（或 bmadPath 的 skills）发布到所选 AI 的 `configTemplate.skillsDir`（如 `~/.cursor/skills/`、`~/.claude/skills/` 等）。若 AI 不支持全局 skill，则在 initLog 的 `skippedReasons` 中记录并跳过。

**原则**：**按所选 AI 写入对应目录**，**禁止写死 `.cursor/` 或任何单一 AI 目录**；不统一写入 `.cursor/`。Claude Code 只读 `.claude/`，Cursor 只读 `.cursor/`，选 Claude 时写入 `.cursor/` 无效。

**worktree 共享模式**（`--bmad-path`，首版必须实现）：当指定 `--bmad-path <path>` 时，不部署 `_bmad` 目录，而是在 `_bmad-output/config/bmad-speckit.json` 中记录 `bmadPath`（指向该路径）；commands、rules、skills 的同步均从该路径读取；`check` 子命令须验证 `bmadPath` 指向的目录存在且结构符合 §5.5 验证清单。适用于多 worktree 共享同一 `_bmad` 源码的场景。

### 5.11 引用完整性约束（强制）

**原则**：将 commands、rules、config、templates、workflows 移入 `_bmad` 子目录后，所有全局 skill、workflow、command、文档中的路径引用必须保持有效。

**引用链与校验**：

| 引用方 | 引用目标 | 约束 |
|--------|----------|------|
| **Commands**（.cursor/commands 内） | `{project-root}/_bmad/core/`、`_bmad/bmm/`、`_bmad/scripts/bmad-speckit/` 等 | 不变；commands 从 `_bmad/cursor/commands` 同步后，其内部路径仍为 `_bmad/...` |
| **Skills**（全局或项目内） | `{project-root}/_bmad/`、`_bmad-output/` | 不变；skills 引用 `_bmad`、`_bmad-output`，与方案 A 兼容 |
| **Speckit workflows** | constitution、specify、plan、tasks 等 | 从 `_bmad/speckit/workflows/` 加载；原 `workflows/` 或 `specs/000-Overview/.specify/` 引用须迁移为 `_bmad/speckit/workflows/` |
| **Audit-prompts、references** | audit-prompts.md、mapping-tables 等 | 位于 `_bmad/speckit/references/` 或 skill 内；skill 内引用使用相对路径或 `{project-root}/_bmad/speckit/` |
| **Cursor 加载** | .cursor/commands、.cursor/rules | 由 sync 从 `_bmad/cursor/` 写入；Cursor 仅读 `.cursor/`，不直接读 `_bmad/cursor/` |

**验收**：init 后执行 `check` 子命令，验证 `_bmad`、`_bmad-output`、所选 AI 目标目录（如 `.cursor/`、`.claude/`、`.gemini/` 等）结构完整；运行至少 1 个 bmad-* 命令、1 个 speckit.* 命令、1 个全局 skill 触发流程，确认路径解析正常。

### 5.12 全局 Skill 发布（强制）

**原则**：`_bmad/skills/` 目录下所有技能必须支持发布为全局 skill；支持多 AI assistant 后，每个 AI 须有对应的 skill 发布目标与格式。

**发布目标映射**（19+ AI 的 configTemplate，经 Web 检索与官方文档验证，2025-03 更新）：

| AI id | commandsDir | rulesDir | skillsDir（全局） | agentsDir/configDir | 备注 |
|-------|-------------|----------|-------------------|---------------------|------|
| **cursor-agent** | `.cursor/commands` | `.cursor/rules` | `~/.cursor/skills` | `.cursor/agents` | Cursor IDE |
| **claude** | `.claude/commands` | `.claude/rules` 或同 commands | `~/.claude/skills` | `.claude/agents` | Claude Code 只读 .claude/ |
| **gemini** | `.gemini/commands` | — | `~/.gemini/commands` | — | TOML 格式；全局命令即 skills 等价 |
| **copilot** | `.github/agents` | — | — | — | IDE-based，无独立 CLI skills；组织级 `.github/agents` |
| **qwen** | `.qwen/commands` | — | `~/.qwen/skills` | — | `--experimental-skills` 启用全局 skills |
| **opencode** | `.opencode/command` | — | `~/.config/opencode/commands` | — | spec-kit：command 单数；全局 `~/.config/opencode/commands` |
| **codex** | `.codex/commands` | — | — | `.codex/config.toml` | spec-kit：Codex CLI 用 .codex/commands/ |
| **windsurf** | `.windsurf/workflows` | — | `~/.codeium/windsurf/skills` | — | 项目 skills: `.windsurf/skills` |
| **kilocode** | — | `.kilocode/rules` | `~/.kilocode/rules` | — | 仅 rules，无 commands/skills |
| **auggie** | — | `.augment/rules` | `~/.augment/commands` | — | spec-kit：仅 rules，无 commands |
| **roo** | — | `.roo/rules` | `~/.roo/rules` | — | 仅 rules，无 commands |
| **codebuddy** | `.codebuddy/commands` | — | `.codebuddy/skills` | `.codebuddy/agents` | 项目内 skills/agents |
| **amp** | `.agents/commands` | — | — | — | 无独立 skills 目录 |
| **shai** | `.shai/commands` | — | `~/.shai/skills`（待确认） | — | spec-kit：SHAI 用 .shai/commands/ |
| **q** | `~/.aws/amazonq/prompts` | — | `~/.aws/amazonq/prompts` | — | Amazon Q Developer，CLI 名 `q` |
| **agy** | `.agent/workflows` | — | `~/.gemini/antigravity/skills` | `.agent/skills` | Antigravity，用 `.agent/` 非 `.agy/` |
| **bob** | `.bob/commands` | — | — | — | spec-kit：IBM Bob 用 .bob/commands/；IDE-based |
| **qodercli** | `.qoder/commands` | — | `~/.qoder/skills` | — | 项目 skills: `.qoder/skills` |
| **cody** | — | — | — | `cody.json` | Sourcegraph Cody，cody.json 定义命令，IDE 扩展 |
| **tabnine** | — | — | `~/.tabnine/agent` | — | 配置在 `~/.tabnine/agent`，无项目 commands |
| **kiro-cli** | `.kiro/prompts` | — | `~/.kiro/prompts` | — | prompts 替代 commands |
| **generic** | `--ai-commands-dir` 指定 | 由 registry 的 configTemplate 定义 | 由 registry 定义 | 由 registry 定义 | 须提供 --ai-commands-dir 或 registry |

**说明**：`commandsDir`、`rulesDir` 为项目内相对路径；`skillsDir` 可为 `~/.xxx/skills` 或项目内 `.xxx/skills`。部分 AI 用 `workflows`、`prompts`、`rules` 替代 `commands`。`—` 表示该 AI 无此概念或官方未提供对应目录。**验证来源**：Gemini/Qwen/OpenCode/Windsurf/Kilocode/Auggie/Roo/CodeBuddy/Amp/Qoder/Antigravity/Amazon Q 等已通过官方文档或 spec-kit 社区文档验证；Codex/Copilot/Bob/Cody/Tabnine/SHAI 等为 IDE 或配置驱动，无标准 CLI 目录结构。

**实现范围**：cursor-agent、claude、copilot、gemini 及内置 19+ 种 AI 均须具备完整 configTemplate 与 skill 发布路径；内置或通过 registry 提供，首版必须全部实现。

**发布内容**：`_bmad/skills/` 下全部子目录（如 speckit-workflow、bmad-bug-assistant、bmad-story-assistant、bmad-standalone-tasks、bmad-standalone-tasks-doc-review、bmad-customization-backup、bmad-orchestrator、code-review 等）须在 init 时根据所选 AI 同步到对应全局路径。

**与 init 流程集成**：init 选择 AI 后，根据该 AI 的 **configTemplate** 执行：
1. 将 commands、rules、config 同步到 configTemplate 定义的 `commandsDir`、`rulesDir`、`agentsDir`（**按所选 AI 写入对应目录**，不统一写入 `.cursor/`）
2. 若 configTemplate 含 `vscodeSettings`，写入 `.vscode/settings.json`（可与 Cursor、Copilot 等共用）
3. 执行 skill 发布步骤，将 `_bmad/skills/`（或模板内 skills）复制/链接到 configTemplate 的 `skillsDir`
4. 若 AI 不支持全局 skill，在 initLog 的 `skippedReasons` 中记录并跳过，但 Cursor、Claude 等主流 AI 必须支持

**initLog 结构**（`_bmad-output/config/bmad-speckit.json` 内，init 完成后写入，用于审计与排错）：
- `timestamp`：init 完成时间（ISO 8601）
- `selectedAI`：所选 AI 的 id
- `templateVersion`：使用的模板版本
- `skillsPublished`：已发布的 skill 列表（如 `["speckit-workflow","bmad-bug-assistant"]`）
- `skippedReasons`（存在时记录）：AI 不支持全局 skill 时，记录跳过原因；成功时可为空数组或省略

### 5.12.1 子代理支持与全流程兼容性（强制）

**原则**：BMAD/Speckit 全流程依赖子代理（如 party-mode、code-reviewer、mcp_task 等）执行多角色辩论、审计、并行实施。所选 AI 须支持子代理或等效能力，否则无法正常运行全流程。init 时须在 configTemplate 或 registry 中标注子代理支持情况，供用户与 check 子命令参考。

**子代理支持映射**（经 Web 检索与官方文档验证，2025-03 更新）：

| AI id | 子代理支持 | 配置位置 | 备注 |
|-------|------------|----------|------|
| **cursor-agent** | ✅ 原生 | `.cursor/agents/` | Explore/Bash/Browser 内置；自定义 `.cursor/agents/*.md` |
| **claude** | ✅ 原生 | `.claude/agents/` | 内置 general-purpose/explore/plan；自定义 `.claude/agents/*.md` |
| **gemini** | ✅ 实验性 | `.gemini/agents/`、`~/.gemini/agents/` | `enableSubagents: true`；远程 A2A 支持 |
| **copilot** | ✅ 原生 | `.github/agents` | 自定义 agent + MCP 委托；VS Code subagents |
| **qwen** | ✅ 原生 | `.qwen/agents/`、`~/.qwen/agents/` | Task 工具 `subagent_type`；`/agents create` |
| **opencode** | ✅ 内置 | 配置内 | General/Explore 内置；@ 提及调用 |
| **codex** | ⚠️ 需 MCP | MCP 桥接 | codex-subagents-mcp、codex-as-mcp 等第三方 |
| **windsurf** | ⚠️ 规划代理 | Cascade 内置 | 规划 agent 内置；无显式子代理 API |
| **kilocode** | ⚠️ Agent Manager | IDE 内 | 多 agent 并行，非 CLI 子代理 |
| **auggie** | ✅ 原生 | `.augment/agents/`、`~/.augment/agents/` | `/agents` 创建；自动/显式委托 |
| **roo** | ⚠️ Cloud Agents | 云端 | 本地扩展无子代理；Cloud 有 Planner/Coder 等 |
| **codebuddy** | ✅ 原生 | `.codebuddy/agents/`、`~/.codebuddy/agents/` | Agentic/Manual 双模式；`/agents` |
| **amp** | ✅ 原生 | 内置 | Mini-Amp 子代理；Oracle 等 |
| **shai** | ⚠️ MCP 委托 | MCP 配置 | 通过 MCP 委托，无原生子代理 |
| **q** | ✅ 委托工具 | delegate 工具 | 有 delegate 工具；权限/默认 agent 有已知问题 |
| **agy** | ✅ 内置 | 浏览器子代理 | Browser 子代理；Agent Manager 多 agent 并行 |
| **bob** | ⚠️ MCP | `.Bob/mcp.json` | MCP 扩展，无原生子代理 |
| **qodercli** | ✅ 原生 | 内置 + 自定义 | code-reviewer/design-agent/general-purpose/task-executor |
| **cody** | ⚠️ Agentic 上下文 | MCP 工具 | 小型 agent 上下文收集，非显式子代理 |
| **tabnine** | ❌ 未发现 | — | CLI 无子代理；Subagents.sh 为 Claude 生态 |
| **kiro-cli** | ✅ 原生 | Plan Agent + 自定义 | `/plan`、`availableAgents`/`trustedAgents` |
| **generic** | 由 registry 定义 | — | 须在 registry 中明确标注 |

**支持等级说明**：
- **✅ 原生**：内置子代理或标准目录配置，可直接运行 party-mode、mcp_task 等全流程
- **⚠️ 需 MCP / 规划代理 / Cloud**：需额外配置或仅部分场景支持，全流程可能受限
- **❌ 未发现**：当前无子代理能力，全流程不可用

**实现要求**：
1. **configTemplate 扩展**：每 AI 的 configTemplate 须含 `subagentSupport` 字段：`native` | `mcp` | `limited` | `none`
2. **check 子命令**：`check` 输出所选 AI 的子代理支持等级；若为 `none` 或 `limited`，提示「全流程（party-mode、审计子任务等）可能不可用」
3. **init 后引导**：选 `tabnine` 等无子代理支持的 AI 时，在 stdout 提示用户「该 AI 不支持子代理，BMAD 全流程将受限」
4. **文档**：README 或 `bmad-speckit feedback` 关联文档中列出「全流程兼容 AI」清单（建议优先 cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli）

**验证来源**：Cursor/Claude/Gemini/Qwen/Copilot/OpenCode/Auggie/CodeBuddy/Amp/Qoder/Kiro 官方文档；Codex/Amazon Q/Windsurf/Kilo/Roo/SHAI/Antigravity/Bob/Cody/Tabnine 经社区与 issue 检索验证。

### 5.13 Post-init 引导（借鉴 BMAD-METHOD）

**Post-init 引导**（必须实现）：
- init 完成后，在 stdout 输出简短提示：建议在 AI IDE 中运行 `/bmad-help` 或等价命令获取下一步指引
- 模板内须包含 `bmad-help`、`speckit.constitution` 等命令，用于智能引导用户

**`--modules` 参数**：见 §5.2，必须实现；选择性初始化 BMAD 模块（BMM、BMB、TEA、BMGD、CIS），与 `npx bmad-method install --modules` 对齐。

---

## 6. Success Metrics

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| **init 完成时间** | < 30 秒（含网络） | 端到端计时 |
| **AI 选择覆盖** | 15+ 内置 + 可扩展 | 功能清单 |
| **跨平台通过率** | Win/Mac/Linux 均通过 E2E | CI 矩阵 |
| **非交互可用性** | `init --ai X --yes` 无阻塞 | 自动化测试 |
| **用户满意度** | NPS / 反馈问卷 | init 完成后输出反馈入口（如 `bmad-speckit feedback` 子命令或 stdout 中的问卷 URL）；须实现 |

---

## 7. User Stories & Requirements

### 7.0 需求可追溯性映射

| 需求依据要点 | Solution 章节 | User Story |
|--------------|---------------|------------|
| specify-cn init 行为 | §5.1–5.2 | US-1, US-2 |
| 15+ AI 选择 | §5.3 | US-1, US-4 |
| 富终端 UI | §5.2 交互式流程、§5.6 | US-1 |
| check/version | §5.5 | US-5 |
| 非交互 | §5.2、§5.8 | US-2 |
| 跨平台 | §5.7 | US-7 |
| 配置持久化 | §5.9 | US-8 |
| 方案 A 目录结构 | §5.10 | US-9 |
| 引用完整性 | §5.11 | US-9 |
| 全局 Skill 发布 | §5.12 | US-9 |
| Banner BMAD-Speckit | §5.2 交互式流程 | US-1 |
| ~/.bmad-speckit 与 _bmad-output/config | §5.9 | US-3, US-6, US-8 |
| 边界与异常 | §5.2 边界与异常行为 | US-6 |
| §5.2 错误码（含 check 退出码） | §5.2 错误码表、§5.5 check 退出码 | US-5、US-6 |
| upgrade 子命令 | §5.5 | US-10 |
| config 子命令 | §5.5、§5.9 | US-11 |
| feedback 子命令 / 反馈入口 | §5.5、§6 | US-12 |
| --modules 选择性初始化 | §5.2、§5.13 | US-1、US-2 |
| worktree 共享 _bmad（--bmad-path） | §5.2、§5.10 | US-9 |
| 按所选 AI 写入对应目录 / check 按 selectedAI 验证 | §5.3.1、§5.5、§5.10、§5.12 | US-9、US-5 |
| 19+ AI configTemplate 与 spec-kit AGENTS.md 对齐（opencode→.opencode/command、auggie→.augment/rules、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands） | §5.5、§5.12、Appendix D | US-9 |
| 子代理支持与全流程兼容性 | §5.12.1 | US-9 |


### US-1: 交互式初始化新项目

**As a** 独立开发者  
**I want to** 运行 `init my-project` 并通过富终端选择 AI assistant  
**So that** 我能快速获得一个配置好的 SDD 项目骨架

**验收标准**：
- [ ] 显示 Banner（至少包含 CLI 名称、版本号，ASCII art 或 box-drawing 风格）与 box-drawing 风格选择器边框
- [ ] 提供 15+ 种 AI 的交互式列表（支持输入过滤）
- [ ] 选择后正确生成项目目录、模板文件、AI 配置
- [ ] 支持 `init .` 与 `init --here` 在当前目录初始化
- [ ] 支持 `--modules bmm,tea` 等选择性初始化 BMAD 模块；未指定时初始化完整模板；指定时仅拉取所选模块的 commands、rules、workflows、skills

### US-2: 非交互式初始化（CI/脚本）

**As a** DevOps 工程师  
**I want to** 使用 `init --ai cursor --yes` 无阻塞完成初始化  
**So that** 我能在 CI/CD 或 Dockerfile 中自动化执行

**验收标准**：
- [ ] `--ai <name>` 跳过选择器，直接使用指定 AI
- [ ] `--yes` 使用默认 AI 和路径，不等待用户输入
- [ ] 非 TTY 环境下自动降级为非交互
- [ ] 支持环境变量覆盖（如 `SDD_AI`）
- [ ] `--modules bmm --ai cursor --yes` 非交互模式下可选择性初始化模块

### US-3: 模板版本与离线支持

**As a** 团队 Tech Lead  
**I want to** 锁定模板版本并支持离线初始化  
**So that** 团队环境可复现，且在内网可运行

**验收标准**：
- [ ] `--template v1.2.3` 或 `--template <url>` 指定版本/来源
- [ ] `--offline` 仅使用本地 cache，不发起网络请求
- [ ] 项目 `_bmad-output/config/bmad-speckit.json` 记录 `templateVersion`
- [ ] 首次在线拉取后缓存到 `~/.bmad-speckit/templates/`

### US-4: 扩展自定义 AI Assistant

**As a** 高级用户  
**I want to** 在 registry 中注册自定义 AI  
**So that** 支持尚未内置的新 AI 工具

**验收标准**：
- [ ] 支持 `~/.bmad-speckit/ai-registry.json` 与项目内 `_bmad-output/config/ai-registry.json`
- [ ] 格式符合 §5.3，含 `id`、`name`、`configTemplate`；支持 `description`、`rulesPath`、`detectCommand`（registry 中可省略时使用默认值）
- [ ] 自定义 AI 出现在交互式列表中
- [ ] `check` 子命令能根据 `detectCommand` 检测自定义 AI

### US-5: check 与 version 子命令

**As a** 开发者  
**I want to** 运行 `check` 和 `version` 诊断环境  
**So that** 我能确认 AI 工具、CLI、模板版本是否正确

**验收标准**：
- [ ] `check` 输出：已安装 AI 工具、CLI 版本、模板版本、关键环境变量
- [ ] `check --list-ai` 输出可用 AI 列表（内置 + registry），支持 `--json`；供 `--ai` 无效时提示用户参考
- [ ] `version` 输出：CLI 版本、模板版本、Node 版本
- [ ] 输出格式清晰，支持 `--json` 便于脚本解析
- [ ] `check` 结构验证失败时退出码 1、成功时退出码 0，可通过 `$?` 或 `exitCode` 验证（便于 CI 脚本判断）

### US-6: 异常路径——网络与模板失败

**As a** 开发者  
**I want to** 在模板拉取失败或网络超时时获得明确错误提示  
**So that** 我能判断是网络问题还是配置问题，并采取对应措施

**验收标准**：
- [ ] 网络超时（可通过 `~/.bmad-speckit/config.json` 的 `networkTimeoutMs` 或环境变量 `SDD_NETWORK_TIMEOUT_MS` 配置，默认 30000ms）时输出明确错误信息，包含「网络超时」或等价表述
- [ ] 模板 URL 404/拉取失败时输出明确错误信息，建议 `--offline` 或检查 URL
- [ ] 上述情况退出码非 0，便于脚本判断
- [ ] `--offline` 且 cache 无对应模板时，报错并提示先在线拉取

### US-7: 跨平台脚本生成

**As a** Windows 用户  
**I want to** 使用 `--script ps` 生成 PowerShell 脚本  
**So that** 我能在原生 PowerShell 中运行 SDD 工作流

**验收标准**：
- [ ] `--script sh` 生成 POSIX shell 脚本
- [ ] `--script ps` 生成 PowerShell 脚本
- [ ] 脚本路径、编码、换行符符合各平台惯例
- [ ] Windows 上默认或智能选择 `ps`（可配置）

### US-8: 配置持久化与复用

**As a** 多项目用户  
**I want to** 在全局配置中设置默认 AI  
**So that** 每次 init 不必重复选择

**验收标准**：
- [ ] `~/.bmad-speckit/config.json` 支持 `defaultAI`、`defaultScript` 等
- [ ] 项目内 `_bmad-output/config/bmad-speckit.json` 覆盖全局
- [ ] init 时读取并应用，交互式选择可覆盖

### US-9: 引用完整性与全局 Skill 发布（对应 §5.10～§5.12）

**As a** 开发者  
**I want to** init 后所有 skill、workflow、command、文档引用均能正常工作，且 skills 已发布为所选 AI 的全局 skill  
**So that** 我无需手动修复路径或重复安装 skill

**验收标准**：
- [ ] init 后 `check` 验证 `_bmad`、`_bmad-output`、所选 AI 目标目录（如 `.cursor/`、`.claude/`、`.gemini/` 等，按 §5.5 按 selectedAI 验证）结构完整；使用 `--bmad-path` 时，`check` 验证 `bmadPath` 指向的目录存在且结构符合清单
- [ ] 至少 1 个 bmad-* 命令、1 个 speckit.* 命令可正常执行（路径解析无误）
- [ ] 至少 1 个全局 skill（如 speckit-workflow、bmad-story-assistant）可触发流程：执行对应命令（如 `bmad-help` 或 `speckit.constitution`）并验证输出包含该 skill 相关提示或行为（非仅检查文件存在；可通过命令输出关键词、帮助文本或 skill 文档引用判定）
- [ ] `_bmad/skills/` 下全部技能已同步到所选 AI 的全局 skill 目录（Cursor→`~/.cursor/skills/`，Claude→`~/.claude/skills/` 等，按 configTemplate 定义）
- [ ] speckit workflows（constitution、specify、plan 等）从 `_bmad/speckit/workflows/` 加载正常
- [ ] `_bmad-output/config/bmad-speckit.json` 含 `initLog` 字段，结构符合 §5.12 定义
- [ ] `init --bmad-path /path/to/shared/_bmad --ai cursor --yes` 不复制 `_bmad`，仅创建 `_bmad-output` 与 AI 配置，`bmad-speckit.json` 含 `bmadPath`；`check` 能验证关联路径有效
- [ ] 所选 AI 具备子代理支持（见 §5.12.1）时，party-mode、code-review、mcp_task 等全流程可正常运行；选「无子代理」AI 时，init 或 `check` 输出明确提示，建议使用支持子代理的 AI

### US-10: upgrade 子命令

**As a** 团队 Tech Lead  
**I want to** 在已 init 的项目目录内运行 `upgrade` 更新模板版本  
**So that** 我能获取最新模板而不破坏已有配置

**验收标准**：
- [ ] `upgrade` 须在已 init 的项目目录内执行，否则报错退出
- [ ] `upgrade --dry-run` 仅检查不执行，输出可升级版本信息
- [ ] `upgrade --template <tag>` 指定目标版本并执行更新
- [ ] 更新后 `_bmad-output/config/bmad-speckit.json` 的 `templateVersion` 正确反映新版本

### US-11: config 子命令

**As a** 多项目用户  
**I want to** 使用 `config get/set/list` 查看和设置全局或项目级配置  
**So that** 我能统一管理 defaultAI、templateSource 等

**验收标准**：
- [ ] `config get <key>` 输出指定 key 的值；支持全局与项目级（项目级优先）
- [ ] `config set <key> <value>` 写入配置；在已 init 项目目录内默认写入项目级（`_bmad-output/config/bmad-speckit.json`），否则写入全局（`~/.bmad-speckit/config.json`）；支持 `--global` 强制写入全局
- [ ] `config list` 输出全部配置项；项目级优先（与 config get 一致）
- [ ] 支持 `defaultAI`、`defaultScript`、`templateSource`、`networkTimeoutMs` 等 key

### US-12: 反馈入口（feedback）

**As a** 项目维护者  
**I want to** init 完成后用户能获取反馈入口  
**So that** 我能收集用户满意度与改进建议

**验收标准**：
- [ ] init 完成后在 stdout 输出反馈入口提示（问卷 URL 或 `bmad-speckit feedback` 子命令说明）
- [ ] `feedback` 子命令可输出或打开反馈入口（URL、表单链接等）
- [ ] 满足 §6 用户满意度指标的测量方式要求

---

## 8. Out of Scope

- **模板编辑器**：不提供可视化编辑模板，仅拉取与渲染
- **AI 运行时集成**：不实现与 AI API 的直接调用，仅配置生成
- **多语言 CLI**：仅支持中文与英文，不实现完整 i18n 框架
- **云端模板市场**：不构建模板市场或评分系统，仅支持 URL/registry
- **旧版迁移工具**：不自动迁移旧版项目结构，需手动或单独工具

---

## 9. Dependencies & Risks

### 9.1 依赖

| 依赖 | 类型 | 说明 |
|------|------|------|
| Node.js >= 18 | 运行时 | 使用现代 API（如 fetch） |
| GitHub API / Release | 外部 | 模板拉取，需考虑限流与可用性 |
| npm 包：commander, inquirer, chalk, boxen 等 | 库 | 需评估 bundle 体积与兼容性 |

### 9.2 风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 模板源不可用 | 无法 init | 支持 `--offline`、多源 fallback、本地 cache |
| AI 列表过时 | 新 AI 无法选择 | 可扩展 registry、文档说明如何添加 |
| Windows 编码问题 | 乱码、脚本执行失败 | 统一 UTF-8、测试 PowerShell 7+ |
| 网络超时 | init 卡住 | 超时设置、重试、清晰错误提示 |
| 模板版本不兼容 | 生成项目无法运行 | 版本锁定、兼容性测试、changelog |

---

## 10. Open Questions

| # | 问题 | 处理策略 | 首版决策 |
|---|------|----------|----------|
| OQ-1 | CLI 命名：最终命令是 `sdd`、`speckit`、`specify-cn` 还是可配置？ | 实现前必须决策 | 采用 `bmad-speckit`，支持 `SDD_CLI_NAME` 环境变量覆盖 |
| OQ-2 | 模板默认源：默认使用哪个 GitHub repo？是否需要组织级配置？ | 实现前必须决策 | 默认 `BMAD-Speckit-SDD-Flow` 或可配置 `owner/repo`；组织级通过 `~/.bmad-speckit/config.json` 的 `templateSource` 覆盖 |
| OQ-3 | AI 配置模板维护：谁负责维护 15+ 种 AI 的 configTemplate？社区贡献流程？ | 实现前必须决策 | 首版由项目维护者维护；须提供 PR 模板与 registry 贡献指南（文档或 CONTRIBUTING.md） |
| OQ-4 | PowerShell 版本：是否强制要求 PowerShell 7+（跨平台）？ | 实现前必须决策 | 推荐 PowerShell 7+，Windows 5.1 降级支持（部分功能可能受限） |
| OQ-5 | 与 BMAD 集成点：init 生成的项目是否自动包含 BMAD 目录结构？与现有 `_bmad` 的关系？ | 实现前必须决策 | init 在全新项目中从模板拉取并部署完整 `_bmad` 与 `_bmad-output`（符合 §5.10）；须支持与现有 worktree 共享 `_bmad` 的场景（通过配置路径关联、不自动复制），首版必须实现 |

---

## Appendix A: Party-Mode 讨论收敛摘要

**轮次**：100 轮  
**批判性审计员出场**：71+ 轮（>70%）  
**收敛条件**：第 98、99、100 轮无新 gap

**主要辩论结论**：
- **CLI 框架**：Commander.js 胜出，因生态成熟、子命令清晰
- **AI 扩展**：采用 registry 文件，避免硬编码，支持项目级覆盖
- **模板版本**：必须锁定并持久化，满足审计与复现需求
- **非交互**：`--ai`、`--yes`、TTY 检测缺一不可，否则 CI 场景不可用
- **跨平台**：PowerShell 与 POSIX 双轨，Windows 默认 ps
- **spec-kit-cn 借鉴**：--force、--ignore-agent-tools、--ai-skills、--ai-commands-dir、--debug、--github-token、--skip-tls 纳入首版
- **BMAD-METHOD 借鉴**：/bmad-help 引导、--yes 非交互、模块化扩展预留
- **Deferred Gaps**：无；所有质疑已收敛

**收敛声明**（第 98、99、100 轮无新 gap，批判审计员终审）：
- **第 98 轮**：Mary 分析师总结采纳的 spec-kit-cn 与 BMAD-METHOD 改进点；无新 gap
- **第 99 轮**：Winston 架构师确认目录结构（.specify vs _bmad）差异已妥善处理；无新 gap
- **第 100 轮**：**批判性审计员终审**：「我同意当前共识。所有质疑（--ai-skills、--force、--ignore-agent-tools、--ai-commands-dir、AI 列表对齐、/bmad-help 引导、Product-Manager-Skills 结构）均已纳入 PRD 或 Appendix D。未发现新的 risks 或 edge cases。建议进入实施阶段。」

---

## Appendix B: 术语表

| 术语 | 定义 |
|------|------|
| **SDD** | Spec-Driven Development，规范驱动开发；以 spec/plan/tasks 等文档驱动实现的开发流程 |
| **configTemplate** | AI 配置模板，定义按所选 AI 写入对应目录（如 `.cursor/`、`.claude/`、`.vscode/settings` 等）的结构化配置 |
| **rulesPath** | 规则文件路径，指向 AI 工具所需的规则或 prompt 文件 |
| **registry** | AI 扩展注册表，`~/.bmad-speckit/ai-registry.json` 或项目内 `_bmad-output/config/ai-registry.json` |
| **TTY** | 终端交互模式；非 TTY 指管道、重定向、CI 等无交互环境 |
| **box-drawing** | 使用 Unicode 制表符（如 ┌─┐│└─┘）绘制的终端边框风格 |

---

## Appendix C: 参考

- **spec-kit**：https://github.com/github/spec-kit（`specify init --ai claude|cursor|...`，按所选 AI 写入对应目录）
- **spec-kit AGENTS.md**：https://raw.githubusercontent.com/github/spec-kit/main/AGENTS.md（19+ AI 目录结构权威来源）
- **spec-kit-cn**：https://github.com/Linfee/spec-kit-cn（中文 SDD CLI，命令 `specify-cn`，包名 `specify-cn-cli`）
- **BMAD-METHOD**：https://github.com/bmad-code-org/BMAD-METHOD（`npx bmad-method install --yes`，/bmad-help 引导）
- **DEBATE_PRD_AI目录映射_spec-kit对齐_100rounds**：_bmad-output/implementation-artifacts/_orphan/DEBATE_PRD_AI目录映射_spec-kit对齐_100rounds.md（Party-Mode 100 轮深度分析，批判审计员 >70%）
- OpenSpec-cn 功能说明
- BMAD Party-Mode 与批判审计员指南
- PRD 结构参考：problem-statement、prd-development 技能（Product-Manager-Skills，D:\Dev\Product-Manager-Skills）

---

## Appendix D: 借鉴 spec-kit-cn 与 BMAD-METHOD 的改进摘要

**来源**：Party-Mode 100 轮深度分析（批判审计员 >70%，第 98–100 轮无新 gap 收敛）

### D.1 采纳的改进点与对应章节

| 改进点 | 来源 | 对应 PRD 章节 | 说明 |
|--------|------|--------------|------|
| `--force` | specify-cn | §5.2 init 子命令设计 | 在非空当前目录强制合并/覆盖，跳过确认；首版实现 |
| `--ignore-agent-tools` | specify-cn | §5.2 | 跳过 AI 代理工具检测，适用于 CI/企业环境 |
| `--ai-skills` / `--no-ai-skills` | specify-cn | §5.2、§5.12 | 将技能模板安装到代理 skills 目录；默认执行，可跳过 |
| `--ai-commands-dir` | specify-cn | §5.2、§5.3 | 与 `--ai generic` 配合，指定未内置代理的命令目录 |
| `--debug` | specify-cn | §5.2 | 启用详细调试输出 |
| `--github-token` | specify-cn | §5.2 | GitHub API 令牌，支持 GH_TOKEN/GITHUB_TOKEN 环境变量 |
| `--skip-tls` | specify-cn | §5.2 | 跳过 SSL/TLS 验证（企业内网场景，不推荐） |
| AI 列表与 specify-cn 对齐 | specify-cn | §5.3 | 内置 19+ 种：claude, gemini, copilot, cursor-agent, qwen, opencode, codex, windsurf, kilocode, auggie, roo, codebuddy, amp, shai, q, agy, bob, qodercli, cody, tabnine, generic |
| generic + aiCommandsDir | specify-cn | §5.3 registry 格式 | registry 支持 `aiCommandsDir` 字段，generic 类型须指定命令目录 |
| `--yes` 非交互模式 | BMAD-METHOD | §5.2、§5.8 | 与 `npx bmad-method install --yes` 对齐，支持 CI/CD 无头执行 |
| `/bmad-help` 引导 | BMAD-METHOD | §5.2 Post-init 引导 | init 完成后提示用户运行 `/bmad-help` 获取智能引导 |
| 模块选择（--modules） | BMAD-METHOD | §5.2、§5.13 | 必须实现：`--modules <bmm|bmb|tea|bmgd|cis|...>` 选择性初始化 BMAD 模块 |
| 目录结构 .specify vs _bmad | 对比分析 | §5.10 | 明确采用 _bmad 方案 A，与 spec-kit-cn 的 .specify 区分，避免冲突 |
| **按所选 AI 写入对应目录** | spec-kit | §5.10、§5.12、§5.3.1 | 采纳 spec-kit 思路：Claude→`.claude/`，Cursor→`.cursor/`；configTemplate 定义 commandsDir、rulesDir、skillsDir、agentsDir；check 按 selectedAI 验证对应目录 |
| **opencode 目录** | spec-kit AGENTS.md | §5.12 | `.opencode/command`（单数），与 spec-kit 一致 |
| **auggie 目录** | spec-kit AGENTS.md | §5.12 | 仅 `.augment/rules`，无 commands |
| **bob/shai/codex 目录** | spec-kit AGENTS.md | §5.12 | bob `.bob/commands`，shai `.shai/commands`，codex `.codex/commands` |
| problem-statement 五要素 | Product-Manager-Skills | §2.1 | I am / Trying to / But / Because / Which makes me feel 完整应用 |
| prd-development 10 章结构 | Product-Manager-Skills | §1–§10 | Executive Summary → Open Questions 完整应用 |

### D.2 未采纳的改进点

| 改进点 | 来源 | 决策 | 理由 |
|--------|------|------|------|
| uv / Python 运行时 | specify-cn | 不采纳 | 本项目采用 Node.js/Commander.js，保持技术栈一致 |
| .specify 目录结构 | specify-cn | 不采纳 | 与 BMAD 生态 _bmad 结构深度集成，采用方案 A |
