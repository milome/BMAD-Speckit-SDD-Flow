# Architecture: specify-cn 类初始化功能与多 AI Assistant 支持

**文档版本**: 1.1  
**创建日期**: 2025-03-07  
**更新日期**: 2025-03-07（与 PRD AI 目录映射、spec-kit 对齐同步）  
**输入**: _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md  
**状态**: Layer 1 架构设计

---

## 1. 架构概述

本架构文档定义 **bmad-speckit** CLI 的技术实现方案，对应 PRD 中 specify-cn 风格初始化与多 AI assistant 支持需求。采用 Node.js 单进程 CLI 架构，无后端服务，所有逻辑在本地执行。

### 1.1 架构目标

| 目标 | 说明 |
|------|------|
| **技术可行性** | 基于成熟 npm 生态（Commander.js、Inquirer.js），可在 Node.js 18+ 环境实现 |
| **跨平台** | Windows/macOS/Linux 统一行为，路径与编码处理一致 |
| **可扩展** | AI registry、模板源可扩展，不硬编码 |
| **可维护** | 模块化子命令，职责清晰 |

### 1.2 高层架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        bmad-speckit CLI                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Entry (bin/bmad-speckit)                                                │
│       │                                                                  │
│       ├── init      → InitCommand (解析、拉取、选择、生成、同步)          │
│       ├── check     → CheckCommand (检测、结构验证、--list-ai、--json)   │
│       ├── version   → VersionCommand (CLI/模板/Node 版本，--json)         │
│       ├── upgrade   → UpgradeCommand (拉取最新、更新 _bmad)               │
│       ├── config    → ConfigCommand (get/set/list)                       │
│       └── feedback  → FeedbackCommand (输出反馈入口)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Shared Services                                                         │
│       ├── TemplateFetcher (GitHub/cache/URL)                              │
│       ├── AIRegistry (内置 + 用户/项目 registry)                          │
│       ├── ConfigManager (~/.bmad-speckit, _bmad-output/config)          │
│       └── SkillPublisher (_bmad/skills → 各 AI 全局目录)                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术选型与 ADR

### ADR-1: CLI 框架选型 — Commander.js

| 项目 | 内容 |
|------|------|
| **决策** | 采用 Commander.js 作为 CLI 框架 |
| **背景** | 需支持 init、check、version、upgrade、config、feedback 等子命令，以及丰富的 init 参数 |
| **备选方案** | A) Commander.js；B) yargs；C) oclif |
| **方案对比** | Commander.js 生态成熟、子命令嵌套清晰、与 Inquirer 集成好；yargs 更轻量但子命令表达略繁琐；oclif 偏重但引入额外抽象 |
| **决策理由** | PRD §5.6 已决策 Commander.js；生态成熟、文档完善、与 Inquirer.js 配合良好 |
| **后果** | 正面：开发效率高、社区支持好；负面：bundle 体积略大，可接受 |

### ADR-2: 交互框架 — Inquirer.js / prompts

| 项目 | 内容 |
|------|------|
| **决策** | 采用 Inquirer.js（主选）或 prompts（备选） |
| **背景** | 需交互式选择 AI、确认路径、选择模板版本 |
| **决策理由** | Inquirer.js 成熟、TTY 检测完善；prompts 更轻量，可作为备选 |
| **后果** | 需处理非 TTY 自动降级（PRD §5.8） |

### ADR-3: 富终端 UI — chalk + boxen + ora

| 项目 | 内容 |
|------|------|
| **决策** | chalk（颜色）、boxen（边框）、ora（spinner） |
| **背景** | PRD 要求 Banner、box-drawing 风格、加载动画 |
| **决策理由** | 行业标准组合，跨平台兼容性好 |
| **后果** | Windows 控制台需考虑代码页（PRD §5.7 统一 UTF-8） |

### ADR-4: 模板拉取 — GitHub Release API + 本地 cache

| 项目 | 内容 |
|------|------|
| **决策** | 默认从 GitHub Release 拉取 tarball，缓存至 `~/.bmad-speckit/templates/` |
| **背景** | 需支持 `--offline`、版本锁定、自定义 URL |
| **备选方案** | A) GitHub Release；B) 直接 clone repo；C) 自定义 URL only |
| **决策理由** | GitHub Release 提供版本化 tarball，便于缓存与离线；支持 `--template <url>` 覆盖 |
| **后果** | 依赖 GitHub API 可用性；需处理限流（`--github-token`） |

### ADR-5: AI 配置抽象 — configTemplate + registry

| 项目 | 内容 |
|------|------|
| **决策** | 每 AI 用 configTemplate 定义写入目标（commandsDir、rulesDir、skillsDir、agentsDir）；**按所选 AI 写入对应目录**（Claude→`.claude/`，Cursor→`.cursor/`），**禁止写死 `.cursor/`** |
| **背景** | 19+ 种 AI 各有配置方式，需统一抽象；spec-kit 按所选 AI 写入对应目录，Claude Code 只读 `.claude/` |
| **决策理由** | registry 可扩展，项目级可覆盖全局；与 PRD §5.3、§5.10、spec-kit AGENTS.md 一致 |
| **后果** | 需维护 19+ 种 configTemplate（与 spec-kit 对齐）；新增 AI 需更新内置或 registry |

---

## 3. 模块架构

### 3.1 包结构（推荐）

```
bmad-speckit/
├── package.json          # bin: bin/bmad-speckit
├── bin/
│   └── bmad-speckit.js   # 入口，解析子命令
├── src/
│   ├── index.js
│   ├── commands/
│   │   ├── init.js       # init 子命令
│   │   ├── check.js
│   │   ├── version.js
│   │   ├── upgrade.js
│   │   ├── config.js
│   │   └── feedback.js
│   ├── services/
│   │   ├── template-fetcher.js
│   │   ├── ai-registry.js
│   │   ├── config-manager.js
│   │   └── skill-publisher.js
│   ├── utils/
│   │   ├── path.js       # 跨平台路径
│   │   ├── tty.js        # TTY 检测
│   │   └── encoding.js   # UTF-8 处理
│   └── constants/
│       ├── exit-codes.js
│       └── ai-builtin.js # 内置 19+ AI 列表
└── templates/            # 内置 fallback 模板（若有）
```

### 3.2 核心模块职责

| 模块 | 职责 | PRD 依据 |
|------|------|----------|
| **InitCommand** | 解析目标路径、拉取模板、选择 AI、生成骨架、**按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录**（.cursor/、.claude/、.windsurf/ 等）、发布 skills；**--ai 无效时**（不在内置或 registry）：输出可用 AI 列表或提示运行 `check --list-ai`，退出码 2 | §5.1、§5.2、§5.10、§5.12 |
| **TemplateFetcher** | GitHub Release 拉取、本地 cache 读写、`--offline` 支持；网络超时由 `networkTimeoutMs` 或 `SDD_NETWORK_TIMEOUT_MS` 控制（默认 30000ms） | §5.4 |
| **AIRegistry** | 加载内置 + 用户/项目 registry、解析 configTemplate | §5.3 |
| **ConfigManager** | 读写 `~/.bmad-speckit/config.json`、`_bmad-output/config/bmad-speckit.json`；支持 `defaultAI`、`defaultScript`、`templateSource`、`networkTimeoutMs`（默认 30000） | §5.9 |
| **SkillPublisher** | 将 `_bmad/skills/` 按 configTemplate.skillsDir 复制到所选 AI 全局目录；`--ai-skills` 默认执行，`--no-ai-skills` 跳过；initLog 记录 `skillsPublished`、`skippedReasons` | §5.12 |
| **CheckCommand** | 检测 AI 工具（`--ignore-agent-tools` 可跳过）、**按 selectedAI 验证对应目标目录**（§5.5 验证清单：cursor-agent→.cursor/、claude→.claude/、gemini→.gemini/、windsurf→.windsurf/、kilocode→.kilocode/、auggie→.augment/、roo→.roo/、opencode→.opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands 等）；**若项目未 init 或 bmad-speckit.json 无 selectedAI**：跳过 AI 目标目录验证（或验证 `.cursor` 作为向后兼容默认）；**输出子代理支持等级**（§5.12.1，subagentSupport：native|mcp|limited|none）、`--list-ai`（支持 `--json`）；结构验证失败退出码 1、成功退出码 0 | §5.5、§5.12.1 |
| **VersionCommand** | 输出 CLI 版本、模板版本、Node 版本；支持 `--json` | §5.5 |
| **UpgradeCommand** | 拉取最新模板、更新项目内 _bmad；支持 `--dry-run`、`--template <tag>` | §5.5、US-10 |
| **ConfigCommand** | get/set/list，项目级优先；`config set` 在已 init 项目目录内默认写入项目级（`_bmad-output/config/bmad-speckit.json`），否则写入全局；支持 `--global` 强制写入全局；支持 `defaultAI`、`defaultScript`、`templateSource`、`networkTimeoutMs` 等 key；支持 `--json` 输出 | §5.5、US-11 |
| **FeedbackCommand** | 输出反馈入口；**输出或关联文档须含全流程兼容 AI 清单**（PRD §5.12.1，建议 cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli） | §5.5、§5.12.1、US-12 |

### 3.3 init 流程状态机

```
[Start] → 解析路径（project-name | . | --here 当前目录）→ 校验目标（空/存在/--force）→ 拉取模板（或 cache/--offline，超时 networkTimeoutMs）
    → 选择 AI（交互/--ai/--yes；非 TTY 且无 --ai/--yes 时自动 --yes；--modules 须与 --ai、--yes 配合非交互使用）→ 选择模块（--modules/完整）
    → 生成 _bmad、_bmad-output（或 --bmad-path 仅 _bmad-output；--bmad-path 须与 --ai、--yes 配合非交互使用）
    → 按需执行 git init、.gitignore（--no-git 可跳过）
    → 按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录（禁止写死 .cursor/）；若 configTemplate 含 vscodeSettings，写入 .vscode/settings.json
    → 按 configTemplate.skillsDir 发布 skills 到 AI 全局目录（--ai-skills 默认执行，--no-ai-skills 跳过）
    → 写入 initLog（timestamp、selectedAI、templateVersion、skillsPublished、skippedReasons）
    → Post-init 引导（stdout 输出 /bmad-help 提示）
    → [End]
```

**init 相关 flags**（与 PRD §5.2 对齐）：`--ignore-agent-tools`（CheckCommand 跳过 AI 工具检测）、`--debug`（启用详细调试输出）。

### 3.4 退出码约定（constants/exit-codes.js）

与 PRD §5.2 错误码约定一致，便于脚本通过 `$?` 或 `exitCode` 判断：

| 退出码 | 含义 | 典型场景 |
|--------|------|----------|
| 0 | 成功 | 所有子命令成功完成 |
| 1 | 通用错误 | 未分类异常、配置解析失败、check 结构验证失败 |
| 2 | `--ai` 无效 | 指定 AI 不在内置列表或 registry |
| 3 | 网络/模板失败 | 超时、404、拉取失败 |
| 4 | 目标路径不可用 | 路径已存在且非空、无写权限、`--bmad-path` 指向路径不存在或结构不符合 |
| 5 | 离线 cache 缺失 | `--offline` 且本地无对应模板 |

---

## 4. 数据流与配置

### 4.1 配置优先级

| 来源 | 优先级 | 路径 |
|------|--------|------|
| CLI 参数 | 最高 | `--ai`、`--yes`、`--template` 等 |
| 环境变量 | 次高 | `SDD_AI`、`SDD_YES`、`SDD_CLI_NAME`、`SDD_NETWORK_TIMEOUT_MS` |
| 项目级配置 | 中 | `_bmad-output/config/bmad-speckit.json` |
| 全局配置 | 低 | `~/.bmad-speckit/config.json` |
| 内置默认 | 最低 | 代码内 default |

### 4.2 AI Registry 数据流

```
~/.bmad-speckit/ai-registry.json (用户)
    +
_bmad-output/config/ai-registry.json (项目，存在时覆盖)
    +
内置 19+ AI 列表 (constants/ai-builtin.js，与 spec-kit AGENTS.md 对齐)
    →
合并后供 init 选择、check --list-ai
```

**configTemplate 结构**（与 PRD §5.3.1、§5.12、§5.12.1 一致）：每 AI 含 `commandsDir`、`rulesDir`、`skillsDir`、`agentsDir`、`configDir`（**agentsDir 与 configDir 二选一**，同一 AI 只能填其一）、`vscodeSettings`（可选，`.vscode/settings.json` 等）、`subagentSupport`（`native`|`mcp`|`limited`|`none`）；**条件约束**：`commandsDir` 与 `rulesDir` 至少其一；`skillsDir` 若 AI 支持 skill 则必填。opencode 用 `.opencode/command`（单数）、auggie 仅 `.augment/rules`、bob/shai/codex 用 `.bob/commands`、`.shai/commands`、`.codex/commands`。**按所选 AI 写入对应目录**，禁止写死 `.cursor/`。

### 4.3 模板 cache 结构

```
~/.bmad-speckit/templates/
├── <template-id>/
│   ├── latest/           # 最新 tag 解压内容
│   └── v1.2.3/           # 指定 tag 解压内容
```

---

## 5. 跨平台与编码

### 5.1 路径处理

- 使用 Node.js `path` 模块，禁止硬编码 `/` 或 `\`
- 模板内路径占位符按 OS 替换

### 5.2 脚本生成

- `--script sh`：生成 POSIX shell（Windows 需 Git Bash/WSL）
- `--script ps`：生成 PowerShell 7+（推荐），5.1 降级支持

### 5.3 编码与换行符

- 所有输出统一 UTF-8
- Windows 控制台：考虑 `chcp 65001` 或输出前设置
- 生成文件时按 OS 或用户配置（LF/CRLF），与 PRD §5.7 一致

---

## 6. 安全考虑

### 6.1 威胁建模

| 威胁 | 缓解措施 |
|------|----------|
| **模板来源篡改** | 仅从可信 GitHub Release 或用户显式 `--template <url>` 拉取；支持 `--skip-tls` 时需明确警告 |
| **敏感信息泄露** | `--github-token` 不写入配置文件，仅进程环境；initLog 不记录 token |
| **路径遍历** | 校验 `--bmad-path`、`--template`、目标路径，禁止 `../` 逃逸 |
| **任意代码执行** | 模板内脚本由用户自行执行，CLI 不自动执行；生成脚本需明确来源 |

### 6.2 输入验证

- `--ai`：必须在内置或 registry 中存在
- `--template`：URL 格式校验；tag 格式校验
- `--bmad-path`：路径存在且符合 §5.5 结构
- `--ai-commands-dir`：路径存在（generic 时）

---

## 7. 扩展性

### 7.1 水平扩展

- CLI 为单进程，无水平扩展需求
- 模板拉取可考虑 future：多源并发、CDN

### 7.2 功能扩展

- **新 AI**：通过 registry 添加，无需改代码
- **新模块**：`--modules` 支持扩展，模板侧需提供对应目录
- **新子命令**：Commander 注册即可

### 7.3 向后兼容

- 配置文件增加新字段时，旧版 CLI 忽略未知字段
- 模板版本在 `bmad-speckit.json` 记录，upgrade 可跨版本

---

## 8. 成本与资源

### 8.1 依赖

| 依赖 | 用途 |
|------|------|
| Node.js >= 18 | 运行时 |
| commander | 子命令解析 |
| inquirer / prompts | 交互 |
| chalk, boxen, ora | 富终端 |
| node-fetch / 内置 fetch | 模板拉取 |
| tar / 内置 zlib | tarball 解压 |

### 8.2 外部依赖

- GitHub API（模板拉取）：需考虑限流，`--github-token` 可提升限额
- 无持久化数据库，仅文件系统

---

## 9. 与 PRD 的映射

| PRD 章节 | 架构对应 |
|----------|----------|
| §5.0 调用方式 | bin 配置、npx 支持 |
| §5.1 高层架构 | §1.2 架构图 |
| §5.2 init 参数 | InitCommand 参数解析 |
| §5.3 AI 枚举 | AIRegistry、ai-builtin |
| §5.4 模板来源 | TemplateFetcher |
| §5.5 子命令 | 各 Command 模块 |
| §5.6 CLI 框架 | ADR-1～ADR-3 |
| §5.7 跨平台 | §5 |
| §5.8 非交互模式 | TTY 检测、非 TTY 且无 --ai/--yes 时自动 --yes；环境变量 SDD_AI/SDD_YES/SDD_CLI_NAME/SDD_NETWORK_TIMEOUT_MS；InitCommand 参数解析 |
| §5.9 配置持久化 | ConfigManager |
| §5.10 目录结构 | 生成逻辑、worktree 共享；**按 configTemplate 同步，禁止写死 .cursor/** |
| §5.11 引用完整性 | 同步步骤、路径约束 |
| §5.12 Skill 发布 | SkillPublisher、initLog 结构；19+ AI configTemplate 与 spec-kit AGENTS.md 对齐 |
| §5.12.1 子代理支持 | configTemplate 含 subagentSupport；check 输出子代理等级；无子代理 AI 时 init 提示 |
| §5.13 Post-init 引导 | init 完成后 stdout 输出 /bmad-help 提示 |
| §9.1 依赖 | §8.1 依赖、§8.2 外部依赖 |
| §9.2 风险与缓解 | ARCH §6 安全考虑、ADR-4（--offline、--github-token）、ADR-5（registry）、§5.7 编码、§3.2 networkTimeoutMs、§7.3 向后兼容 |

---

## 10. Tradeoff 记录

| 决策 | Tradeoff | 选择理由 |
|------|----------|----------|
| path 模块 vs 硬编码 | path 跨平台；硬编码 `/` 或 `\` 导致 Win/Mac/Linux 不一致 | 使用 Node.js path 模块，禁止硬编码 |
| Node.js vs Python | Node 与 BMAD 生态一致；Python 需 uv 等额外工具 | 选 Node.js |
| 内置 19+ AI vs 仅 registry | 内置降低上手门槛；registry 保证扩展 | 两者结合 |
| 复制 _bmad vs 链接 | 复制独立；链接省空间但跨平台复杂 | 默认复制；`--bmad-path` 支持共享 |
| ora 加载动画 | 增加依赖；提升体验 | 采用（PRD 必须） |

---

## Appendix: 可解析评分块（供审计后 parseAndWriteScore）

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: [待审计填写]

维度评分:
- 技术可行性: XX/100
- 扩展性: XX/100
- 安全性: XX/100
- 成本效益: XX/100
```
