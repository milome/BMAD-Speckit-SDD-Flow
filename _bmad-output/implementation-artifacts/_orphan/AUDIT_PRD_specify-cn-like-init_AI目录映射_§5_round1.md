# PRD 审计报告：specify-cn 类初始化与 AI 目录映射

**审计对象**：`_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md`  
**需求依据**：DEBATE_PRD_AI目录映射_spec-kit对齐_100rounds.md、spec-kit AGENTS.md、BMAD-METHOD  
**审计日期**：2025-03-07  
**审计轮次**：Round 1

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 需求完整性

### 1.1 DEBATE 与 spec-kit 对齐结论覆盖

| 检查项 | 验证方式 | 结果 |
|--------|----------|------|
| 按所选 AI 写入对应目录 | §5.10、§5.12、§5.3.1 多处明确「不统一写入 .cursor/」 | ✅ 通过 |
| Claude→.claude/，Cursor→.cursor/ | §5.10 原则段、§5.12 与 init 流程集成 | ✅ 通过 |
| opencode 用 command 单数 | §5.12 表：opencode commandsDir `.opencode/command` | ✅ 通过 |
| auggie 仅 rules 无 commands | §5.12 表：auggie commandsDir 为 —，rulesDir `.augment/rules` | ✅ 通过 |
| bob/shai/codex 有 commandsDir | §5.12 表：bob `.bob/commands`，shai `.shai/commands`，codex `.codex/commands` | ✅ 通过 |
| check 按 selectedAI 动态验证 | §5.5 按所选 AI 验证目标目录，含 cursor-agent/claude/gemini/windsurf/kilocode/auggie/roo 及「其他 AI」 | ✅ 通过 |
| 19+ AI configTemplate 表 | §5.12 表含 22 项（cursor-agent 至 generic） | ✅ 通过 |
| 边界与异常路径 | §5.2 边界与异常行为、错误码约定、--ai generic 等 | ✅ 通过 |

### 1.2 §5.10 同步步骤

- 明确从 `_bmad/cursor/` 按 configTemplate 映射到 `commandsDir`、`rulesDir`、`agentsDir`/`configDir`
- 无 `.cursor/` 写死；示例覆盖 `.cursor/`、`.claude/`、`.windsurf/workflows` 等
- 原则段：「Claude Code 只读 .claude/，Cursor 只读 .cursor/，选 Claude 时写入 .cursor/ 无效」

**结论**：需求完整性满足。

---

## 2. 可测试性

### 2.1 每 AI configTemplate 验收标准

| 检查项 | 验证方式 | 结果 |
|--------|----------|------|
| 动态验收机制 | US-9：init 后 `check` 验证所选 AI 目标目录结构完整 | ✅ 通过 |
| check 按 selectedAI | §5.5：读取 bmad-speckit.json 的 selectedAI，按 configTemplate 验证 | ✅ 通过 |
| 退出码可脚本判断 | §5.2、§5.5：check 成功 0、失败 1 | ✅ 通过 |

**结论**：可测试性满足；验收通过 `init --ai <id> --yes` + `check` 组合实现。

---

## 3. 一致性

### 3.1 与 spec-kit AGENTS.md 对照

| AI | spec-kit Directory | PRD §5.12 | 一致 |
|----|-------------------|-----------|------|
| opencode | .opencode/command/ | .opencode/command | ✅ |
| Auggie CLI | .augment/rules/ | .augment/rules（commandsDir —） | ✅ |
| IBM Bob | .bob/commands/ | .bob/commands | ✅ |
| SHAI | .shai/commands/ | .shai/commands | ✅ |
| Codex CLI | .codex/commands/ | .codex/commands | ✅ |
| Roo Code | .roo/rules/ | .roo/rules | ✅ |
| Kilo Code | .kilocode/rules/ | .kilocode/rules | ✅ |
| Kiro CLI | .kiro/prompts/ | .kiro/prompts | ✅ |

### 3.2 术语统一

- commandsDir、rulesDir、skillsDir、agentsDir、configDir、vscodeSettings 在 §5.3.1、§5.10、§5.12 中一致使用。

**结论**：一致性与 spec-kit 对齐。

---

## 4. 可追溯性

### 4.1 需求 ID 与章节引用

- §7.0 需求可追溯性映射表：需求依据要点 → Solution 章节 → User Story
- User Stories US-1～US-12 有唯一 ID
- Solution 章节 §5.1～§5.13 可引用

### 4.2 Appendix C/D 引用

- Appendix C：spec-kit、AGENTS.md、DEBATE 文档、BMAD-METHOD、PRD_UPDATE_SUGGESTIONS 等
- Appendix D：采纳的改进点与对应章节、未采纳项及理由

**结论**：可追溯性满足。

---

## 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、术语不一致、configTemplate 与 spec-kit 对齐、check 动态验证、无 .cursor/ 写死、可追溯性、Appendix 引用完整性。

**每维度结论**：

**遗漏需求点**：逐条对照 DEBATE 文档与 PRD_UPDATE_SUGGESTIONS，核心结论均已纳入 PRD。DEBATE 四、PRD 更新要点 4.1（spec-kit AGENTS.md 权威目录）、4.2（必须修正的 PRD 条目）中 opencode command 单数、auggie 仅 rules、bob/shai/codex 有 commands 等，在 §5.12 表中均有体现。PRD 还覆盖 spec-kit 未列的 q、agy、cody、tabnine、kiro-cli 等，并标注验证来源。未发现遗漏。

**边界未定义**：§5.2 边界与异常行为明确列出：--ai 无效、--yes 默认来源、目标路径已存在、网络超时、--offline 无 cache、--bmad-path 无效、--ai generic 缺 --ai-commands-dir、非 TTY 自动 --yes 等。错误码 1～5 有清晰含义与典型场景。--ai generic、worktree 共享、非空目录 --force 等边界均有说明。边界条件已充分定义。

**验收不可执行**：US-9 要求 init 后 check 验证结构完整，且至少 1 个 bmad-* 命令、1 个 speckit.* 命令、1 个全局 skill 可触发。验收命令为 `bmad-speckit init --ai <id> --yes` 与 `bmad-speckit check`，可量化、可自动化。check 退出码 0/1 可供 CI 判断。各 AI 的 configTemplate 通过 check 按 selectedAI 动态验证，无需为每个 AI 单独写死用例。验收可执行。

**与前置文档矛盾**：PRD 与 DEBATE、spec-kit AGENTS.md、PRD_UPDATE_SUGGESTIONS 对照，目录映射一致。opencode 用 command 单数、auggie 仅 rules、bob/shai/codex 有 commandsDir 均与 spec-kit 一致。agy 使用 `.agent/workflows` 而非 `.agy/`，PRD 备注「用 .agent/ 非 .agy/」，与 Antigravity 官方约定一致，无矛盾。

**术语不一致**：commandsDir、rulesDir、skillsDir、agentsDir 在全文统一。§5.10 同步步骤引用 configDir，§5.3.1 已定义 configDir 为 agentsDir 等价、二选一，术语一致。

**configTemplate 与 spec-kit 对齐**：§5.12 表与 spec-kit AGENTS.md 逐项核对，opencode、auggie、bob、shai、codex、roo、kilocode、kiro-cli 等目录与 spec-kit 一致。PRD 表含 22 项，覆盖 19+ AI，满足「内置 19+ 种」要求。generic 依赖 --ai-commands-dir 或 registry，与 spec-kit 一致。

**check 动态验证**：§5.5 明确按 selectedAI 验证，并列举 cursor-agent、claude、gemini、windsurf、kilocode、auggie、roo 及「其他 AI：按 configTemplate 的 commandsDir、rulesDir 解析根目录」。无 selectedAI 时跳过或使用 .cursor 向后兼容，逻辑清晰。满足「check 按 selectedAI 动态验证对应目录」要求。

**无 .cursor/ 写死**：全文检索，.cursor/ 仅作为示例或 cursor-agent 专用目标出现，未作为统一默认写入路径。§5.10、§5.12、§5.3.1 多处强调「按所选 AI 写入对应目录」「不统一写入 .cursor/」。原则段明确「选 Claude 时写入 .cursor/ 无效」。无写死。

**可追溯性**：§7.0 需求可追溯性映射表覆盖 specify-cn、15+ AI、富终端、check/version、非交互、跨平台、配置持久化、方案 A、引用完整性、全局 Skill、Banner、错误码、upgrade/config/feedback、--modules、--bmad-path、按 AI 写目录、子代理支持等。Appendix C 引用 spec-kit、AGENTS.md、DEBATE、BMAD-METHOD。Appendix D 列出采纳与未采纳改进点及对应章节。可追溯性充分。

**Appendix 引用完整性**：Appendix C 含 spec-kit、AGENTS.md、DEBATE、BMAD-METHOD、specify-cn、OpenSpec-cn、Party-Mode 等。Appendix D 含 D.1 采纳改进点与 D.2 未采纳项。满足「Appendix C/D 引用 spec-kit 与 DEBATE 文档」要求。

**本轮结论**：本轮无新 gap。经逐维度核查，PRD 已覆盖 DEBATE 与 spec-kit 对齐结论，§5.10 同步步骤按 configTemplate 写入对应目录且无 .cursor/ 写死，§5.12 configTemplate 表覆盖 19+ AI 并与 spec-kit AGENTS.md 一致，边界与异常路径明确，验收通过 check 动态可执行，术语与可追溯性满足要求。建议进入下一阶段；若需严格收敛，可再执行 2 轮审计确认连续 3 轮无 gap。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 94/100
- 可追溯性: 93/100

---

## 结论

**完全覆盖、验证通过。**

PRD 覆盖 DEBATE 文档与 spec-kit 对齐结论的核心需求，§5.10 同步步骤按所选 AI 的 configTemplate 写入对应目录（Claude→.claude/，Cursor→.cursor/），无 .cursor/ 写死；§5.12 configTemplate 表覆盖 19+ AI，与 spec-kit AGENTS.md 一致（opencode/.opencode/command、auggie/.augment/rules、bob/.bob/commands、shai/.shai/commands、codex/.codex/commands 等）；边界条件与异常路径在 §5.2 中明确；check 按 selectedAI 动态验证；术语统一；§7.0 与 Appendix C/D 提供可追溯性。批判审计员结论：本轮无新 gap。

**报告保存路径**：`_bmad-output/implementation-artifacts/_orphan/AUDIT_PRD_specify-cn-like-init_AI目录映射_§5_round1.md`
