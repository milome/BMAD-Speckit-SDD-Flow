---
title: "bmad-speckit CLI 功能说明"
description: "BMAD-Speckit 规范驱动开发工具包的命令行手册，覆盖 init、check、version、upgrade、feedback、config 等命令的完整选项与退出码说明。"
publishDate: 2026-03-10
author: "BMAD-Speckit"
tags: ["bmad", "speckit", "cli", "sdd", "规范驱动开发"]
featured: false
draft: false
---

# bmad-speckit CLI 功能说明

**版本**：以 packages/bmad-speckit/package.json 为准  
**更新日期**：2026-03-10

---

## 项目概述

**BMAD-Speckit-SDD-Flow** 是融合 **BMAD Method**（多角色辩论驱动的 Agile 产品/架构/Story 开发）与 **Speckit**（规范驱动开发）的一体化工具与工作流仓库。主要功能包括：

- **五层架构**：Layer 1 产品定义（Product Brief → PRD → Architecture）→ Layer 2 Epic/Story 规划 → Layer 3 Story 开发（Create Story → Party-Mode）→ Layer 4 技术实现（**嵌套 speckit-workflow**：specify → plan → GAPS → tasks → TDD implement）→ Layer 5 收尾（Push + PR + 强制人工审核）。BMAD 的 Agile 流程与 speckit-workflow 在 Layer 4 深度融合；
- **多 Agent 角色**：Winston 架构师、Amelia 开发、John 产品经理、Mary 分析师、Quinn 测试、Bob Scrum Master、**批判审计员**（专职挑战者）、**AI 代码教练**（AI Coach，解读评分、定位短板、优化方案设计）等，通过 Party-Mode 参与关键决策，关键节点 ≥100 轮多角色辩论；
- **评分系统**：各 stage 审计报告解析写入、多阶段加权、一票否决与多次迭代阶梯式扣分、Epic 综合评分；支持 **双模式**：`real_dev`（真实开发）与 `eval_question`（评测题目），两种场景均走 Layer 1→5 完整路径，评分数据隔离；
- **SFT 微调数据**：从 phase_score≤60（C/D 级）的评分记录提取 instruction-response 对，输出 JSONL 数据集；instruction 来源于 BUGFIX §1（现象）+§4（修复方案）或审计报告（批判审计员结论、GAP、修改建议）；用户可通过「提取微调数据」或 `/bmad-sft-extract` 触发；**项目内已有示例**：`scoring/data/sft-dataset.jsonl`；
- **BMAD 集成**：Story 助手、Bug 助手、Party-Mode、AI Coach 诊断、全链路 Code Reviewer 等，与 Cursor / Claude 命令与规则协同；
- **bmad-speckit CLI**：命令行入口，用于项目初始化、环境检查、配置、升级、反馈等，支持 worktree 模式与多 AI 集成。

**推荐使用流程**：从 `bmad-speckit init` 初始化项目后，**bmad-story-assistant** 负责 Story 全阶段（Create Story → 审计 → Dev Story → 实施后审计）；**bmad-bug-assistant** 负责解耦的 Bug 修复（描述问题即自动进入 Party-Mode，产出 BUGFIX 文档与任务）；**bmad-standalone-tasks** 负责按 TASKS/BUGFIX 文档快速实施。支持离线模式、指定模板版本、共享 `_bmad` 路径（worktree），以及 `bmad-speckit check` 验证 AI 工具与配置。

---

## §1 总览

bmad-speckit 是 BMAD-Speckit 规范驱动开发工具包的命令行入口，提供初始化、检查、配置、升级、反馈等功能。

### 命令列表

| 命令 | 说明 |
|------|------|
| `init [project-name]` | 初始化 bmad-speckit 项目 |
| `check` | 验证 bmad-speckit 配置与结构 |
| `version` | 显示 CLI、模板、Node 版本 |
| `upgrade` | 升级已初始化项目的模板版本 |
| `feedback` | 显示反馈入口与全流程兼容 AI 列表 |
| `config get <key>` | 获取配置项 |
| `config set <key> <value>` | 设置配置项 |
| `config list` | 列出合并后的配置 |

### 退出码约定（PRD §5.2, ARCH §3.4）

| 退出码 | 常量 | 含义 |
|--------|------|------|
| 0 | SUCCESS | 成功 |
| 1 | GENERAL_ERROR | 一般错误（结构验证失败、未 init 等） |
| 2 | AI_INVALID | 无效的 --ai 参数 |
| 3 | NETWORK_TEMPLATE_FAILED | 网络或模板获取失败 |
| 4 | TARGET_PATH_UNAVAILABLE | 目标路径不可用（非空、不可写、不存在等） |
| 5 | OFFLINE_CACHE_MISSING | 离线模式下缓存缺失 |

---

## §2 init 命令

### 2.1 命令格式

```bash
bmad-speckit init [project-name] [options]
```

### 2.2 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `project-name` | string | 否 | 目标项目名或路径；`.` 或省略表示当前目录 |

### 2.3 选项

| 选项 | 说明 | 默认 |
|------|------|------|
| `--here` | 使用当前目录作为目标 | — |
| `--ai <name>` | 非交互式指定 AI（跳过选择器）；如 cursor-agent、claude、generic | — |
| `--ai-commands-dir <path>` | 当 --ai generic 时，指定命令目录路径 | — |
| `-y, --yes` | 跳过所有交互，使用默认值 | — |
| `--template <tag\|url>` | 模板版本（latest、v1.0.0）或 tarball URL | latest |
| `--network-timeout <ms>` | 网络超时毫秒数（覆盖 env 与 config）；未传时解析链：env > 项目 config > 全局 config > 30000 | 30000（解析链 fallback） |
| `--modules <list>` | 逗号分隔模块列表（bmm,bmb,tea,bmgd,cis,...） | — |
| `--force` | 强制覆盖非空目录 | — |
| `--no-git` | 跳过 git init | — |
| `--script <type>` | 脚本类型：sh（POSIX）或 ps（PowerShell） | 按平台：win32 用 ps，否则 sh |
| `--bmad-path <path>` | 共享 _bmad 路径（worktree 模式，不复制 _bmad） | — |
| `--ai-skills` | 发布 AI skills（默认） | 默认开启 |
| `--no-ai-skills` | 跳过发布 AI skills | — |
| `--debug` | 启用调试输出 | — |
| `--github-token <token>` | GitHub API token | — |
| `--skip-tls` | 跳过 SSL/TLS 校验（不推荐） | — |
| `--offline` | 仅使用本地缓存，不访问网络 | — |

### 2.4 环境变量

| 变量 | 说明 |
|------|------|
| `SDD_YES` | 1 或 true 时等效 --yes |
| `SDD_AI` | 等效 --ai |
| `SDD_NETWORK_TIMEOUT_MS` | 网络超时 |
| `SDD_TEMPLATE_REPO` | 模板源（如 bmad-method/bmad-method） |
| `GH_TOKEN` / `GITHUB_TOKEN` | GitHub token |

### 2.5 正常 case 示例

```bash
# 在当前目录初始化，指定 cursor-agent，跳过交互
bmad-speckit init . --ai cursor-agent --yes
# 退出码 0；输出包含 POST_INIT_GUIDE_MSG 和 feedback 提示

# 新建子目录 my-project 初始化
bmad-speckit init my-project --ai claude --yes

# 使用 worktree 模式，共享 _bmad 路径
bmad-speckit init . --ai cursor-agent --yes --bmad-path /path/to/shared/_bmad

# 离线模式（使用 ~/.bmad-speckit/templates 缓存）
bmad-speckit init . --ai cursor-agent --yes --offline

# 指定模板版本
bmad-speckit init . --ai cursor-agent --yes --template v1.0.0

# 生成 PowerShell 脚本（Windows）
bmad-speckit init . --ai cursor-agent --yes --script ps

# 跳过 git init
bmad-speckit init . --ai cursor-agent --yes --no-git
```

### 2.6 非正常退出 case

| 场景 | 退出码 | 示例 |
|------|--------|------|
| 目标路径已存在且非空，未使用 --force | 4 | `bmad-speckit init . --ai cursor-agent --yes`（当前目录已有 _bmad） |
| 目标路径不可写 | 4 | 父目录无写权限 |
| --ai 无效 | 2 | `bmad-speckit init . --ai invalid-xyz --yes` |
| --ai generic 且既未提供 --ai-commands-dir 又未在 registry 中为 generic 配置 aiCommandsDir | 2 | `bmad-speckit init . --ai generic --yes` |
| --bmad-path 指向不存在路径 | 4 | `bmad-speckit init . --ai cursor-agent --yes --bmad-path /nonexistent` |
| --bmad-path 结构不符合要求 | 4 | 缺少 core/cursor/speckit/skills 等 |
| --bmad-path 未与 --ai --yes 同时使用 | 4 | `bmad-speckit init . --bmad-path /path`（缺少非交互） |
| 无 TTY 且未指定 --ai --yes | 1 | 管道/CI 中直接运行 `bmad-speckit init` |
| 网络获取模板失败（404、超时、解压失败） | 3 | 网络不可达；stderr 含「建议 --offline 或检查网络」 |
| 离线模式且缓存缺失 | 5 | `bmad-speckit init . --ai cursor-agent --yes --offline`（从未 fetch 过） |
| --script 非法值 | 1 | `bmad-speckit init . --ai cursor-agent --yes --script xxx` |

---

## §3 check 命令

### 3.1 命令格式

```bash
bmad-speckit check [options]
```

### 3.2 选项

| 选项 | 说明 |
|------|------|
| `--list-ai` | 列出 AIRegistry 中可用的 AI id |
| `--json` | 以 JSON 格式输出 |
| `--ignore-agent-tools` | 跳过 AI 工具（detectCommand）检测 |

### 3.3 正常 case 示例

```bash
# 在已初始化项目根目录验证
bmad-speckit check
# 退出码 0；输出 CLI version、Template version、Selected AI、子代理支持等级；当未使用 --ignore-agent-tools 且 AIRegistry 中至少一个 AI 的 detectCommand 执行成功（退出码 0）时输出 Installed AI tools；最后输出 Check OK.

# 列出可用 AI
bmad-speckit check --list-ai
# 退出码 0；每行一个 id（cursor-agent、claude、gemini 等）

# --list-ai 与 --json 同时使用时，输出 AI id 的 JSON 数组
bmad-speckit check --list-ai --json
# 退出码 0；输出 ["cursor-agent","claude","gemini",...]

# JSON 输出（诊断对象）
bmad-speckit check --json
# 退出码 0；输出 { cliVersion, templateVersion, selectedAI, subagentSupport, envVars, aiToolsInstalled }
```

### 3.4 非正常退出 case

| 场景 | 退出码 | 示例 |
|------|--------|------|
| 无 _bmad-output 或 _bmad-output/config | 1 | 在空目录或未 init 目录运行 check |
| bmadPath 指向不存在路径 | 4 | config 中 bmadPath 指向 /nonexistent |
| bmadPath 结构不符合 | 4 | 缺少 core/cursor/speckit/skills 等 |
| selectedAI 目标目录缺失 | 1 | selectedAI=cursor-agent 但无 .cursor/commands 或 rules 或 agents |

---

## §4 version 命令

### 4.1 命令格式

```bash
bmad-speckit version [options]
```

### 4.2 选项

| 选项 | 说明 |
|------|------|
| `--json` | 以 JSON 格式输出 |

### 4.3 正常 case 示例

```bash
bmad-speckit version
# 退出码 0；输出 CLI version、Template version、Node version

bmad-speckit version --json
# 退出码 0；输出 { cliVersion, templateVersion, nodeVersion }
```

### 4.4 非正常退出

version 命令通常不产生非零退出；在无 config 时，非 JSON 模式下 templateVersion 显示 unknown，--json 模式下为 null。

---

## §5 upgrade 命令

### 5.1 命令格式

```bash
bmad-speckit upgrade [options]
```

### 5.2 选项

| 选项 | 说明 | 默认 |
|------|------|------|
| `--dry-run` | 仅检查升级信息，不写入文件 | — |
| `--template <tag>` | 目标版本（latest、v1.0.0） | latest |
| `--offline` | 仅使用本地缓存 | — |

### 5.3 正常 case 示例

```bash
# 在已初始化项目根目录升级到 latest
bmad-speckit upgrade
# 退出码 0；输出 Upgrade complete. Template version: x.x.x

# 仅查看，不写入
bmad-speckit upgrade --dry-run
# 退出码 0；输出 Current template version、Target version (dry-run - no changes)

# 指定目标版本
bmad-speckit upgrade --template v1.0.0
```

**worktree 模式**：config 含 bmadPath 时，upgrade 仅更新 config 中 templateVersion，不重新拉取模板或执行 generateSkeleton。

### 5.4 非正常退出 case

| 场景 | 退出码 | 示例 |
|------|--------|------|
| 项目未 init（无 _bmad-output/config/bmad-speckit.json） | 1 | 在空目录运行 upgrade；stderr: "Error: 项目未 init，请先执行 bmad-speckit init (Project not initialized, run bmad-speckit init first)" |
| 离线模式且缓存缺失 | 5 | `bmad-speckit upgrade --offline`（无缓存） |
| 网络获取失败 | 3 | 网络不可达；stderr 含「建议 --offline 或检查网络」 |

---

## §6 feedback 命令

### 6.1 命令格式

```bash
bmad-speckit feedback
```

无选项。

### 6.2 正常 case 示例

```bash
bmad-speckit feedback
# 退出码 0
# 输出：Feedback entry: Run `bmad-speckit feedback` to get the feedback entry, or visit: https://github.com/bmad-method/bmad-method/issues
# Full-flow compatible AI (PRD §5.12.1): 每行一个 id，带 "  - " 前缀；id 列表为 cursor-agent, claude, qwen, auggie, codebuddy, amp, qodercli, kiro-cli
```

### 6.3 非正常退出

feedback 无已知非零退出场景；成功恒为退出码 0。

---

## §7 config 子命令

### 7.1 config get \<key\>

获取配置项（项目优先，其次全局）。

| 选项 | 说明 |
|------|------|
| `--json` | 输出 JSON 对象 `{ key: value }` |

**正常**：`bmad-speckit config get selectedAI` → 退出码 0，输出值  
**非正常**：key 不存在 → 退出码 1，stderr: "Error: 配置项不存在 (Key does not exist)"

### 7.2 config set \<key\> \<value\>

设置配置项。

| 选项 | 说明 |
|------|------|
| `--global` | 强制写入全局作用域 |

**正常**：`bmad-speckit config set selectedAI cursor-agent` → 退出码 0  
**作用域**：已 init 项目写入项目 config；未 init 或 --global 写入 ~/.bmad-speckit/config.json  
**类型转换**：key 为 networkTimeoutMs 时，value 自动解析为数字

### 7.3 config list

列出合并后的配置（项目覆盖全局）。

| 选项 | 说明 |
|------|------|
| `--json` | 输出 JSON 对象 |

**正常**：`bmad-speckit config list` → 退出码 0，每行 `key: value`  
**无已知非零退出**

---

## §8 常见配置项

| key | 类型 | 说明 |
|-----|------|------|
| selectedAI | string | 选中的 AI id |
| templateVersion | string | 模板版本 |
| bmadPath | string | worktree 模式下共享 _bmad 路径 |
| networkTimeoutMs | number | 网络超时毫秒 |
| templateSource | string | 模板源仓库 |
| defaultAI | string | 默认 AI |
| defaultScript | string | 默认脚本类型 sh/ps |

---

## §9 附录：可用 AI id（check --list-ai）

内置支持（以 ai-registry-builtin 为准）：cursor-agent, claude, gemini, copilot, qwen, opencode, codex, windsurf, kilocode, auggie, roo, codebuddy, amp, shai, q, agy, bob, qodercli, cody, tabnine, kiro-cli, generic。可通过全局 ~/.bmad-speckit/ai-registry.json 或项目 _bmad-output/config/ai-registry.json 扩展。

---

## §10 附录：SFT 微调数据输出格式与示例

SFT 提取由 `npx ts-node scripts/sft-extract.ts` 或 `/bmad-sft-extract` 执行，输出 JSONL（默认 `scoring/data/sft-dataset.jsonl`）。

### 10.1 单条记录格式

| 字段 | 类型 | 说明 |
|------|------|------|
| instruction | string | 问题描述+修复方案；来自 BUGFIX §1+§4 或审计报告解析 |
| input | string | 修复前代码（git diff -行）；has_code_pair 时为非空 |
| output | string | 修复后代码（git diff +行）；has_code_pair 时为非空 |
| source_run_id | string | 来源 run_id |
| base_commit_hash | string | 基准 commit 短 hash |
| has_code_pair | boolean | 是否含 bad/good 代码对 |
| source_path | string | 源文档路径（BUGFIX 或审计报告） |

### 10.2 示例（来自 scoring/data/sft-dataset.jsonl）

```bash
# 提取（threshold 默认 60）
npx ts-node scripts/sft-extract.ts
# 或指定阈值与输出路径
npx ts-node scripts/sft-extract.ts --threshold 60 --output ./my-sft.jsonl
```

```json
{
  "instruction": "### 1.1 现象\n\n审计报告中 code-reviewer 输出对可解析块的文字描述...\n\n### 4.1 原则\n\n禁止用描述代替结构化块...",
  "input": "",
  "output": "",
  "source_run_id": "dev-e9-s2-implement-1772861663451",
  "base_commit_hash": "2870f4b9",
  "has_code_pair": false,
  "source_path": "_bmad-output/implementation-artifacts/_orphan/BUGFIX_可解析评分块禁止描述代替结构化块.md"
}
```

**项目内已有 sample**：`scoring/data/sft-dataset.jsonl` 含示例记录；需先完成至少一轮 implement 阶段低分（phase_score≤60）产出后，提取器才能产生新条目。
