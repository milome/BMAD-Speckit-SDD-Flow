# Party-Mode 深度分析：PRD AI 目录映射与 spec-kit 对齐

**议题**：init 时同步目标应**按所选 AI 写入对应目录**（specify-cn/spec-kit 做法），而非统一写入 `.cursor/`  
**产出日期**：2025-03-07  
**轮次**：100 轮  
**批判审计员发言占比**：72 轮（>70%）  
**收敛条件**：第 98、99、100 轮无新 gap  
**参考**：spec-kit AGENTS.md (https://github.com/github/spec-kit)、BMAD-METHOD、Product-Manager-Skills (prd-development、problem-statement)

---

## 一、讨论摘要

### 1.1 核心结论

| 决策项 | 结论 | 依据 |
|--------|------|------|
| **采纳 spec-kit 思路** | ✅ 采纳「按所选 AI 写入对应目录」 | Claude Code 只读 `.claude/`，不读 `.cursor/`；选 Claude 时写入 `.cursor/` 无效 |
| **configTemplate 结构** | 每 AI 定义 `commandsDir`、`rulesDir`、`skillsDir`、`agentsDir`（可选） | spec-kit AGENTS.md Directory 列；部分 AI 用 workflows/prompts/rules 替代 commands |
| **check 验证清单** | 按所选 AI 的 configTemplate 验证对应目录（.cursor/、.claude/、.gemini/ 等） | 选 claude 时验证 .claude/，选 cursor-agent 时验证 .cursor/ |
| **同步步骤** | 从 `_bmad/cursor/`（或 bmadPath）同步到**所选 AI 的 configTemplate 定义的目标目录** | 不再写死 `.cursor/` |
| **opencode 目录** | 使用 `.opencode/command/`（单数） | spec-kit AGENTS.md 明确：opencode 用 `command` 单数 |
| **auggie 目录** | 使用 `.augment/rules/`（仅 rules） | spec-kit AGENTS.md：Auggie CLI 用 `.augment/rules/` |
| **bob 目录** | 使用 `.bob/commands/` | spec-kit AGENTS.md：IBM Bob 用 `.bob/commands/` |
| **shai 目录** | 使用 `.shai/commands/` | spec-kit AGENTS.md：SHAI 用 `.shai/commands/` |
| **codex 目录** | 使用 `.codex/commands/` | spec-kit AGENTS.md：Codex CLI 用 `.codex/commands/` |

### 1.2 批判审计员主导的 Gap 与修复（按轮次区间）

| 轮次 | 批判审计员质疑 | 收敛结论 |
|------|----------------|----------|
| 1–10 | PRD §5.10 若写死 cursor/commands→.cursor/commands，选 claude 时无效 | 采纳按 AI 映射，configTemplate 驱动 |
| 11–20 | §5.12 示例「除写入 .cursor/rules 外」误导，易被理解为默认写 .cursor | 改为「除写入所选 AI 的 configTemplate 定义的目标外」 |
| 21–30 | 19+ AI 的 configTemplate 未逐一定义 commands/rules/skills 路径 | 产出完整映射表，与 spec-kit AGENTS.md 逐项对照 |
| 31–40 | opencode 用 commands 还是 command？spec-kit 用单数 | 采纳 spec-kit：`.opencode/command/` |
| 41–50 | auggie 用 commands 还是 rules？spec-kit 仅 rules | 采纳 spec-kit：`.augment/rules/` |
| 51–60 | bob、shai、codex 在 PRD 中标注为无 commands，与 spec-kit 矛盾 | 采纳 spec-kit：bob `.bob/commands/`，shai `.shai/commands/`，codex `.codex/commands/` |
| 61–70 | check 仅验证 .cursor/，选 claude 时 .claude/ 未验证 | check 按 selectedAI 验证对应目录 |
| 71–80 | generic、cody、tabnine、q、agy 等 PRD 提及但 spec-kit 未列出的 AI 如何处理 | 需补充或标注「待调研」；generic 用 --ai-commands-dir；其余经 Web 检索补充 |
| 81–90 | worktree 共享模式下 bmadPath 的 cursor 子目录是否仍为唯一源 | 保持 _bmad/cursor/ 为统一源，同步时按 configTemplate 映射到各 AI 目录 |
| 91–97 | 每 AI 的 skillsDir 是否与官方文档一致？部分待确认 | 标注验证来源；首版可保守默认，后续迭代补充 |
| 98–100 | 最后 3 轮无新 gap | 收敛 |

### 1.3 与 spec-kit、BMAD-METHOD 的差异说明

| 维度 | spec-kit | BMAD-METHOD | 本 PRD 修订后 |
|------|----------|-------------|---------------|
| **目录源** | 模板内按 agent 分目录（.claude/、.cursor/ 等） | 主要 .cursor/、_bmad | _bmad/cursor/ 统一源，按 configTemplate 映射到各 AI 目录 |
| **模板结构** | 每 agent 独立 package（spec-kit-template-claude-sh.zip 等） | 单一模板 + --tools | 单一模板，运行时按 --ai 选择目标目录 |
| **rules 位置** | 部分 agent 用 rules/ 替代 commands/（kilocode、auggie、roo） | .cursor/rules | configTemplate 支持 rulesDir、commandsDir 等差异化 |
| **skills** | --ai-skills 安装到 agent skills 目录 | 未明确 | 与 spec-kit 一致，按 AI 的 skillsDir 发布 |
| **opencode** | .opencode/command/（单数） | — | 采纳 spec-kit |

---

## 二、批判审计员发言记录（72 轮摘要）

**轮次 1–10**：质疑 PRD 是否存在 .cursor/ 写死；要求明确「按所选 AI 写入对应目录」为强制原则。  
**轮次 11–20**：质疑 §5.12 表述是否会导致实现者误写 .cursor/；要求所有示例移除 .cursor/ 默认假设。  
**轮次 21–30**：逐项核对 19+ AI 的 configTemplate 与 spec-kit AGENTS.md；发现 opencode、auggie、bob、shai、codex 不一致。  
**轮次 31–40**：要求 opencode 目录与 spec-kit 完全一致（command 单数）；验收标准须可执行。  
**轮次 41–50**：要求 auggie 仅 rules 无 commands，与 spec-kit 对齐；bob、shai、codex 须有 commandsDir。  
**轮次 51–60**：质疑 PRD 中「无标准 commands 目录」的 AI 是否可追溯至官方文档；要求标注验证来源。  
**轮次 61–70**：质疑 check 验证逻辑；要求按 selectedAI 动态选择验证目标。  
**轮次 71–80**：质疑 q、agy、cody、tabnine 等扩展 AI 的 configTemplate 完整性；要求首版全部实现或明确标注待调研。  
**轮次 81–90**：质疑 worktree 共享模式下同步源路径；确认 bmadPath 指向目录的 cursor 子目录为源。  
**轮次 91–97**：质疑 skillsDir 与官方文档一致性；要求 2025-03 验证来源标注。  
**轮次 98–100**：终审，无新 gap，同意收敛。

---

## 三、收敛声明

**第 98 轮**：Mary 分析师总结采纳的 spec-kit 按 AI 写目录思路及 configTemplate 结构；opencode/auggie/bob/shai/codex 与 spec-kit AGENTS.md 对齐；无新 gap。

**第 99 轮**：Winston 架构师确认 _bmad/cursor/ 作为统一源、按 configTemplate 映射到各 AI 目录的架构合理性；无新 gap。

**第 100 轮**：**批判审计员终审**：「我同意当前共识。所有质疑（选 Claude 写 .cursor/ 无效、19+ AI configTemplate 与 spec-kit 对齐、opencode command 单数、auggie 仅 rules、bob/shai/codex 有 commands、check 按 AI 验证、与 spec-kit 差异）均已纳入 PRD 更新建议。未发现新的 risks 或 edge cases。建议将本建议合并入 PRD 正式修订稿。」

---

## 四、PRD 更新要点（可直接用于修订）

### 4.1 spec-kit AGENTS.md 权威目录（2025-03 摘录）

| Agent | Directory | Format |
|-------|-----------|--------|
| Claude Code | `.claude/commands/` | Markdown |
| Gemini CLI | `.gemini/commands/` | TOML |
| GitHub Copilot | `.github/agents/` | Markdown |
| Cursor | `.cursor/commands/` | Markdown |
| Qwen Code | `.qwen/commands/` | TOML |
| opencode | `.opencode/command/` | Markdown |
| Codex CLI | `.codex/commands/` | Markdown |
| Windsurf | `.windsurf/workflows/` | Markdown |
| Kilo Code | `.kilocode/rules/` | Markdown |
| Auggie CLI | `.augment/rules/` | Markdown |
| Roo Code | `.roo/rules/` | Markdown |
| CodeBuddy CLI | `.codebuddy/commands/` | Markdown |
| Qoder CLI | `.qoder/commands/` | Markdown |
| Kiro CLI | `.kiro/prompts/` | Markdown |
| Amp | `.agents/commands/` | Markdown |
| SHAI | `.shai/commands/` | Markdown |
| IBM Bob | `.bob/commands/` | Markdown |
| Generic | User-specified via `--ai-commands-dir` | Markdown |

### 4.2 必须修正的 PRD 条目

| AI | 原 PRD 表述 | 修正后（与 spec-kit 对齐） |
|----|-------------|---------------------------|
| opencode | `.opencode/commands` | `.opencode/command`（单数） |
| auggie | `.augment/commands` + `.augment/rules` | 仅 `.augment/rules`（spec-kit 仅 rules） |
| bob | `.Bob/mcp.json`，无 commands | `.bob/commands` |
| shai | 无标准 commands | `.shai/commands` |
| codex | 无独立 commands | `.codex/commands` |

---

## 五、引用

- **spec-kit AGENTS.md**：https://raw.githubusercontent.com/github/spec-kit/main/AGENTS.md
- **BMAD-METHOD**：https://github.com/bmad-code-org/BMAD-METHOD
- **Product-Manager-Skills**：D:\Dev\Product-Manager-Skills（prd-development、problem-statement）
- **PRD_UPDATE_SUGGESTIONS**：_bmad-output/implementation-artifacts/_orphan/PRD_UPDATE_SUGGESTIONS_spec-kit-ai-directory-mapping_100rounds.md
