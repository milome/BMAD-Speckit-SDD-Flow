# PRD 第二轮审计报告：specify-cn 类初始化与 AI 目录映射

**被审文档**：`_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md`  
**审计轮次**：Round 2（AI 目录映射专项）  
**需求依据**：DEBATE_PRD_AI目录映射_spec-kit对齐_100rounds.md、spec-kit AGENTS.md、BMAD-METHOD  
**审计日期**：2025-03-07

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计维度验证

### 1.1 需求完整性

| 检查项 | 依据 | 验证结果 |
|--------|------|----------|
| DEBATE 结论覆盖 | DEBATE §1.1、§4.2 | ✅ 按所选 AI 写入对应目录、configTemplate 结构、check 按 selectedAI 验证、opencode command 单数、auggie 仅 rules、bob/shai/codex 有 commands 均已纳入 PRD |
| spec-kit 按 AI 写入 | DEBATE、spec-kit AGENTS.md | ✅ §5.10 明确「按 configTemplate 映射」「禁止写死 .cursor/ 或任何单一 AI 目录」 |
| 19+ AI configTemplate | 专项要求 | ✅ §5.12 表含 cursor-agent、claude、gemini、copilot、qwen、opencode、codex、windsurf、kilocode、auggie、roo、codebuddy、amp、shai、q、agy、bob、qodercli、cody、tabnine、kiro-cli、generic 共 22 项 |

### 1.2 可测试性

| 检查项 | 验证结果 |
|--------|----------|
| init 验收可执行 | ✅ US-1、US-2、US-9 含「init 后 check 验证」「至少 1 个 bmad-* 命令、1 个 speckit.* 命令可正常执行」 |
| check 验收可执行 | ✅ §5.5 结构验证清单明确、退出码 0/1 约定、US-5 含「check 结构验证失败时退出码 1」 |
| 验收命令 | ✅ `bmad-speckit init --ai X --yes`、`bmad-speckit check` 可脚本化验证 |

### 1.3 一致性

| 对照源 | 验证结果 |
|--------|----------|
| spec-kit AGENTS.md | ✅ opencode `.opencode/command`、auggie `.augment/rules`、bob `.bob/commands`、shai `.shai/commands`、codex `.codex/commands` 与 spec-kit 一致 |
| DEBATE | ✅ 所有 DEBATE §4.2 修正条目已采纳 |
| BMAD-METHOD | ✅ /bmad-help 引导、--yes、--modules 已纳入 |

### 1.4 可追溯性

| 检查项 | 验证结果 |
|--------|----------|
| §7.0 映射 | ✅ 含「按所选 AI 写入对应目录 / check 按 selectedAI 验证」→ §5.3.1、§5.5、§5.10、§5.12 |
| Appendix C | ✅ 引用 DEBATE、spec-kit AGENTS.md、BMAD-METHOD |
| Appendix D | ✅ D.1 含 opencode/auggie/bob/shai/codex 改进摘要 |

---

## 2. 专项检查（AI 目录映射）

| 专项项 | 要求 | 验证结果 |
|--------|------|----------|
| §5.10 同步步骤 | 按 configTemplate 写入 commandsDir/rulesDir/skillsDir/agentsDir，禁止写死 .cursor/ | ✅ 同步步骤明确映射到 `{configTemplate.commandsDir}` 等；原则含「禁止写死 `.cursor/` 或任何单一 AI 目录」 |
| §5.12 configTemplate 表 | opencode(.opencode/command)、auggie(.augment/rules)、bob(.bob/commands)、shai(.shai/commands)、codex(.codex/commands) 与 spec-kit 一致 | ✅ 逐项对照 spec-kit AGENTS.md，全部一致 |
| §5.5 check | 按 selectedAI 验证对应目录 | ✅ 含 cursor-agent、claude、gemini、windsurf、kilocode/auggie/roo、opencode 显式项；其他 AI 按 configTemplate 解析 |
| 19+ AI 覆盖 | 清单完整 | ✅ 22 项覆盖全部专项要求 AI |

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、行号/路径漂移、验收一致性、AI 目录映射专项（禁止写死、configTemplate 对齐、check 按 AI 验证、19+ 覆盖）。

**每维度结论**：

- **遗漏需求点**：已逐条对照 DEBATE §1.1、§4.2 与 PRD。DEBATE 核心结论（按所选 AI 写入、configTemplate 驱动、check 按 selectedAI 验证、opencode command 单数、auggie 仅 rules、bob/shai/codex 有 commands）均已纳入 PRD §5.3.1、§5.5、§5.10、§5.12。DEBATE §4.2 修正表五项（opencode→.opencode/command、auggie→仅 .augment/rules、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands）PRD 已全部采纳。DEBATE §1.2 批判审计员质疑（写死 .cursor/、19+ configTemplate、opencode 单数、auggie 仅 rules、check 按 AI 验证）对应 PRD 条款均已存在。无遗漏。

- **边界未定义**：§5.2 边界与异常行为、错误码约定完整；§5.5 check 验证清单含 worktree 共享、selectedAI 缺失、向后兼容等边界；§5.2 含 `--ai generic` 未提供 `--ai-commands-dir` 的退出码 2。`--ai <name>` 无效时退出码 2、网络失败退出码 3、目标路径不可用退出码 4、离线 cache 缺失退出码 5 均已定义。边界条件已明确，无模糊表述。

- **验收不可执行**：US-1～US-12 验收标准均为可执行动作（init、check、version、config、feedback 等）。US-9 明确「init 后 check 验证」「至少 1 个 bmad-* 命令、1 个 speckit.* 命令可正常执行」「至少 1 个全局 skill 可触发流程」。验收可量化、可脚本化。`bmad-speckit init --ai cursor --yes`、`bmad-speckit check`、`bmad-speckit check --list-ai` 等命令可直接用于 E2E 测试。无「建议」「宜」等不可验证表述。

- **与前置文档矛盾**：PRD 与 DEBATE、spec-kit AGENTS.md、BMAD-METHOD 无矛盾。opencode、auggie、bob、shai、codex 目录与 spec-kit AGENTS.md 表（Agent | Directory）逐项一致。DEBATE 未采纳项（uv/Python、.specify 结构）已明确记录于 Appendix D.2，无隐性冲突。§5.12 configTemplate 表中 auggie 的 commandsDir 为 —、rulesDir 为 .augment/rules，与 spec-kit「Auggie CLI | .augment/rules/」一致。

- **孤岛模块**：PRD 为需求文档，不涉及代码模块。需求层面无孤岛。各 User Story 与 §5 Solution 章节存在明确映射，无游离需求。

- **伪实现/占位**：PRD 无 TODO、占位表述。configTemplate 表、check 验证清单均为完整定义，非预留。§5.12 表中「待确认」仅用于 shai 的 skillsDir（~/.shai/skills），不影响 commandsDir/rulesDir 核心路径，且已标注验证来源。

- **行号/路径漂移**：引用路径（_bmad、_bmad-output、.cursor、.claude、.opencode/command、.augment/rules 等）与方案 A、configTemplate 表一致，无失效引用。Appendix C 引用 DEBATE 路径 `_bmad-output/implementation-artifacts/_orphan/DEBATE_PRD_AI目录映射_spec-kit对齐_100rounds.md` 与项目结构一致。

- **验收一致性**：验收命令（`bmad-speckit init`、`bmad-speckit check`）与 §5.0 调用方式、§5.5 子命令定义一致。US-5 的「check 结构验证失败时退出码 1」与 §5.5 check 退出码约定一致。US-9 的「按 §5.5 按 selectedAI 验证」与 §5.5 验证清单一致。无矛盾。

- **AI 目录映射专项**：
  - **禁止写死**：§5.10 原则已含「禁止写死 `.cursor/` 或任何单一 AI 目录」，满足审计要求。同步步骤 1、2 均使用 `{configTemplate.commandsDir}`、`{configTemplate.rulesDir}` 等占位符，无硬编码 .cursor/。
  - **configTemplate 对齐**：opencode `.opencode/command`（单数，与 spec-kit 一致）、auggie `.augment/rules`（无 commandsDir，仅 rules）、bob `.bob/commands`、shai `.shai/commands`、codex `.codex/commands` 与 spec-kit AGENTS.md 逐项一致。spec-kit 未列出的 q、agy、cody、tabnine、kiro-cli 等已通过 Web 检索补充，并标注验证来源。
  - **check 按 selectedAI 验证**：§5.5 含 cursor-agent、claude、gemini、windsurf、kilocode/auggie/roo、opencode 显式项；「其他 AI」按 configTemplate.commandsDir/rulesDir 解析，覆盖全部 19+ AI。opencode 显式验证「.opencode 存在，且含 command/（spec-kit 单数目录）」，避免实现者误用 commands 复数。
  - **19+ AI 覆盖**：§5.12 表含 22 项，覆盖 cursor-agent、claude、gemini、copilot、qwen、opencode、codex、windsurf、kilocode、auggie、roo、codebuddy、amp、shai、agy、bob、qodercli、cody、tabnine、kiro-cli、generic 及 q（Amazon Q）。满足「19+ AI」要求。§5.3 内置列表与 §5.12 表一致（含 q、agy 等扩展项）。

**逐项 configTemplate 与 spec-kit 对照**（批判审计员强制逐条验证）：spec-kit AGENTS.md 表列 18 项 Agent（Claude Code、Gemini CLI、GitHub Copilot、Cursor、Qwen Code、opencode、Codex CLI、Windsurf、Kilo Code、Auggie CLI、Roo Code、CodeBuddy CLI、Qoder CLI、Kiro CLI、Amp、SHAI、IBM Bob、Generic）。PRD §5.12 逐项对应：opencode→.opencode/command（spec-kit 同）、auggie→.augment/rules（spec-kit 同，无 commands）、bob→.bob/commands（spec-kit 同）、shai→.shai/commands（spec-kit 同）、codex→.codex/commands（spec-kit 同）。PRD 额外覆盖 q、agy、cody、tabnine 等 spec-kit 未列项，已标注 Web 检索验证来源，无冲突。

**DEBATE 轮次 31–60 质疑覆盖**：DEBATE §1.2 轮次 31–40 要求 opencode 用 command 单数→PRD §5.12 opencode 行 commandsDir 为 `.opencode/command`，§5.5 check 显式验证「.opencode 存在，且含 command/」。轮次 41–50 要求 auggie 仅 rules→PRD auggie 行 commandsDir 为 —，rulesDir 为 `.augment/rules`。轮次 51–60 要求 bob/shai/codex 有 commands→PRD 三者均有 commandsDir。轮次 61–70 要求 check 按 selectedAI 验证→PRD §5.5 完整实现。无遗漏。

**可执行验收链**：init→check→命令执行 形成闭环。US-9 验收「init 后 check 验证」可执行 `bmad-speckit init --ai claude --yes && bmad-speckit check`；「至少 1 个 bmad-* 命令可正常执行」可执行 `bmad-help` 或等价；「至少 1 个 speckit.* 命令可正常执行」可执行 `speckit.constitution`；「至少 1 个全局 skill 可触发」可验证 speckit-workflow 等。验收链完整、可自动化。

**实现风险与可验证性**：批判审计员从对抗视角质疑「实现者是否可能误写 .cursor/」——PRD §5.10 同步步骤明确使用 `{configTemplate.commandsDir}` 占位符，且原则中「禁止写死」为强制约束；若实现者硬编码，则违反 PRD，code-review 可检出。质疑「opencode 单数 command 是否易被误写为 commands」——§5.5 check 显式验证「.opencode 存在，且含 command/」，实现者若写错则 check 失败，可及时修正。质疑「19+ AI 是否均有可执行验收」——§5.5「其他 AI」条款按 configTemplate 解析，覆盖全部；US-9 验收不要求逐 AI 测试，仅要求「所选 AI 目标目录结构完整」，可执行。

**§7.0 与 Appendix 追溯完整性**：§7.0 映射表含「按所选 AI 写入对应目录 / check 按 selectedAI 验证」→ §5.3.1、§5.5、§5.10、§5.12，四条 Solution 章节均有追溯。Appendix C 引用 DEBATE、spec-kit AGENTS.md、BMAD-METHOD，需求依据完整。Appendix D.1 改进摘要含 opencode、auggie、bob、shai、codex 五项，与 DEBATE §4.2 修正表一一对应。无追溯断裂。

**本轮结论**：**本轮无新 gap**。所有审计维度与专项检查项均通过。PRD 已完整覆盖 DEBATE 结论、spec-kit 按 AI 写入对应目录、19+ AI configTemplate、禁止写死 .cursor/、check 按 selectedAI 验证。无需修改。

---

## 4. 结论

**完全覆盖、验证通过。**

PRD 在需求完整性、可测试性、一致性、可追溯性四个维度均满足要求；AI 目录映射专项（§5.10 同步步骤、§5.12 configTemplate 表、§5.5 check、19+ AI 覆盖）与 DEBATE、spec-kit AGENTS.md 完全对齐。批判审计员结论：本轮无新 gap。

**报告保存路径**：`_bmad-output/implementation-artifacts/_orphan/AUDIT_PRD_specify-cn-like-init_AI目录映射_§5_round2.md`

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 90/100
- 可追溯性: 92/100
