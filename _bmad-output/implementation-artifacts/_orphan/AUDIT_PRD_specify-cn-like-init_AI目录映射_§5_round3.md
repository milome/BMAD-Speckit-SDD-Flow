# PRD 审计报告：specify-cn-like-init-multi-ai-assistant（AI 目录映射 §5 专项）

**被审文档**：`_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md`  
**审计模式**：PRD 模式（AI 目录映射专项）  
**审计轮次**：round 3  
**需求依据**：DEBATE_PRD_AI目录映射_spec-kit对齐_100rounds.md、spec-kit AGENTS.md、BMAD-METHOD

---

## 1. 审计维度逐条验证

### 1.1 需求完整性

| 检查项 | 标准 | 验证结果 |
|--------|------|----------|
| 覆盖 DEBATE 结论 | 按所选 AI 写入对应目录、configTemplate 驱动、check 按 selectedAI 验证 | ✅ §5.3.1、§5.5、§5.10、§5.12 已覆盖 |
| spec-kit 按 AI 写入对应目录 | 禁止写死 .cursor/，按 configTemplate 映射 | ✅ §5.10 原则明确「禁止写死 `.cursor/` 或任何单一 AI 目录」 |
| 19+ AI configTemplate | 内置 19+ 种，完整 configTemplate 表 | ✅ §5.12 表含 22 项（含 kiro-cli、generic） |
| 无 .cursor/ 写死 | 同步步骤不硬编码 .cursor/ | ✅ §5.10 同步步骤全部使用 configTemplate 变量 |

### 1.2 可测试性

| 检查项 | 标准 | 验证结果 |
|--------|------|----------|
| init 验收可执行 | 有明确验收命令与退出码 | ✅ §5.2 错误码表、§5.5 check 退出码 0/1 |
| check 验收可执行 | check 结构验证可自动化 | ✅ §5.5 清单可脚本化，退出码 0/1 可判断 |
| US 验收链可自动化 | 各 US 验收标准可自动化 | ✅ US-5、US-9 等含「check 验证」「命令可执行」等可自动化项 |

### 1.3 一致性

| 检查项 | 标准 | 验证结果 |
|--------|------|----------|
| 与 spec-kit AGENTS.md 一致 | opencode/command、auggie/rules、bob/commands、shai/commands、codex/commands | ✅ §5.12 表已对齐 |
| 与 DEBATE 结论一致 | 4.2 必须修正条目已纳入 PRD | ✅ Appendix D.1 已列，§5.12 表已实现 |

### 1.4 可追溯性

| 检查项 | 标准 | 验证结果 |
|--------|------|----------|
| §7.0 映射完整 | 需求依据→Solution→US 可追溯 | ✅ 已补充「19+ AI configTemplate 与 spec-kit 对齐」映射 |
| Appendix C 引用 | DEBATE、spec-kit、BMAD-METHOD | ✅ 完整 |
| Appendix D 引用 | 采纳/未采纳改进点 | ✅ D.1 含 opencode、auggie、bob、shai、codex 对齐项 |

---

## 2. 专项检查（AI 目录映射）

### 2.1 §5.10 同步步骤

| 检查项 | 标准 | 验证结果 |
|--------|------|----------|
| 按 configTemplate 写入 commandsDir | 使用变量，非硬编码 | ✅ `cursor/commands` → `{configTemplate.commandsDir}` |
| 按 configTemplate 写入 rulesDir | 使用变量，非硬编码 | ✅ `cursor/rules` → `{configTemplate.rulesDir}` |
| 按 configTemplate 写入 skillsDir | 使用变量，非硬编码 | ✅ 发布到 `configTemplate.skillsDir` |
| 按 configTemplate 写入 agentsDir | 使用变量，非硬编码 | ✅ `cursor/config/...` → `{configTemplate.agentsDir}` |
| 禁止写死 .cursor/ | 无硬编码路径 | ✅ 原则明确，示例为多 AI 举例 |

### 2.2 §5.12 configTemplate 表与 spec-kit 对齐

| AI | spec-kit AGENTS.md | PRD §5.12 | 一致性 |
|----|---------------------|-----------|--------|
| opencode | `.opencode/command/` | `.opencode/command` | ✅ |
| auggie | `.augment/rules/` | rulesDir `.augment/rules`，commandsDir — | ✅ |
| bob | `.bob/commands/` | `.bob/commands` | ✅ |
| shai | `.shai/commands/` | `.shai/commands` | ✅ |
| codex | `.codex/commands/` | `.codex/commands` | ✅ |

### 2.3 §5.5 check 按 selectedAI 验证

| 检查项 | 标准 | 验证结果 |
|--------|------|----------|
| cursor-agent | 验证 .cursor/ | ✅ |
| claude | 验证 .claude/ | ✅ |
| gemini | 验证 .gemini/ | ✅ |
| windsurf | 验证 .windsurf/workflows/ | ✅ |
| kilocode、auggie、roo | 验证 rules/ | ✅ |
| opencode | 验证 .opencode/command/（单数） | ✅ |
| bob、shai、codex | 显式验证条目（DEBATE 要求） | ✅ 已补充（本轮修改） |

### 2.4 19+ AI 全覆盖

§5.3 内置列表 + §5.12 表覆盖：cursor-agent, claude, gemini, copilot, qwen, opencode, codex, windsurf, kilocode, auggie, roo, codebuddy, amp, shai, q, agy, bob, qodercli, cody, tabnine, kiro-cli, generic。✅ 22 项，满足 19+ 要求。

---

## 3. 本轮修改（消除 gap）

审计中发现 2 处 gap，已直接修改被审 PRD：

1. **§5.5 check 结构验证清单**：补充 bob、shai、codex 的显式验证条目，与 DEBATE 4.2「必须修正的 PRD 条目」及专项检查「bob/shai/codex 与 spec-kit 一致」呼应。
2. **§7.0 需求可追溯性映射**：补充「19+ AI configTemplate 与 spec-kit AGENTS.md 对齐」→ §5.12、Appendix D.1 → US-9 的映射行。

---

## 4. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、行号/路径漂移、验收一致性、需求完整性（DEBATE/spec-kit 覆盖）、可测试性（init/check/US 链）、一致性（AGENTS.md/DEBATE）、可追溯性（§7.0/Appendix C/D）、AI 目录映射专项（§5.10 同步、§5.12 表、§5.5 check、19+ AI）。

**每维度结论**：

- **遗漏需求点**：DEBATE 文档 §4.2「必须修正的 PRD 条目」明确要求 opencode、auggie、bob、shai、codex 五类 AI 与 spec-kit 对齐，且 DEBATE 轮次 51–60 批判审计员质疑「bob、shai、codex 在 PRD 中标注为无 commands，与 spec-kit 矛盾」后收敛结论为「采纳 spec-kit：bob `.bob/commands/`，shai `.shai/commands/`，codex `.codex/commands/`」。原 PRD §5.5 check 结构验证清单仅对 opencode 有显式条目（含 command 单数），对 bob、shai、codex 仅通过「其他 AI：按 configTemplate 的 commandsDir、rulesDir 解析根目录」概括。实现者若未细读 §5.12 表，可能对 bob/shai/codex 的验证逻辑产生歧义。**已补充显式条目**，消除遗漏。
- **边界未定义**：§5.2 边界与异常行为覆盖 `--ai` 无效、目标路径已存在、网络超时、`--offline` cache 缺失、`--bmad-path` 无效、`--ai generic` 缺 `--ai-commands-dir`、非 TTY 自动降级等；错误码 1–5 与 check 退出码 0/1 明确。无 gap。
- **验收不可执行**：init 后执行 `bmad-speckit check` 可验证结构；退出码 0/1 可通过 `$?` 或 `exitCode` 脚本判断；US-5「check 结构验证失败时退出码 1」、US-9「init 后 check 验证…结构完整」均可自动化。无 gap。
- **与前置文档矛盾**：PRD §5.12 表与 spec-kit AGENTS.md 的 Directory 列逐项对照，opencode→.opencode/command、auggie→.augment/rules、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands 一致；DEBATE 4.2 修正条目已全部纳入。无 gap。
- **行号/路径漂移**：Appendix C 引用 `_bmad-output/implementation-artifacts/_orphan/DEBATE_PRD_AI目录映射_spec-kit对齐_100rounds.md` 路径正确；§5.12 表路径与 spec-kit 一致，无失效引用。无 gap。
- **验收一致性**：验收命令（`check`、`init`、`bmad-help`、`speckit.constitution` 等）与 §5.11、US-9 宣称一致；「至少 1 个 bmad-* 命令、1 个 speckit.* 命令可正常执行」可验证。无 gap。
- **需求完整性**：DEBATE 结论（按所选 AI 写目录、configTemplate 驱动、check 按 selectedAI 验证）、spec-kit 按 AI 写入对应目录、19+ AI configTemplate、无 .cursor/ 写死均已覆盖。原 §7.0 需求可追溯性映射缺「19+ AI configTemplate 与 spec-kit AGENTS.md 对齐」这一需求依据的显式映射，实现者难以从 §7.0 反查该需求来源。**已补充映射行**。
- **可测试性**：init/check 验收可执行；US 验收链（US-1 至 US-12）含可自动化项（check 验证、命令执行、退出码判断）。无 gap。
- **一致性**：与 spec-kit AGENTS.md、DEBATE 结论一致；Appendix D.1 已列 opencode、auggie、bob、shai、codex 对齐项。无 gap。
- **可追溯性**：§7.0 映射已补全「19+ AI configTemplate 与 spec-kit AGENTS.md 对齐」→ §5.12、Appendix D.1 → US-9；Appendix C 引用 DEBATE、spec-kit、BMAD-METHOD；Appendix D 引用采纳/未采纳改进点。无 gap。
- **AI 目录映射专项**：§5.10 同步步骤明确「按 configTemplate 映射」「禁止写死 `.cursor/` 或任何单一 AI 目录」，commandsDir/rulesDir/skillsDir/agentsDir 均使用变量；§5.12 表 22 项 AI 的 configTemplate 与 spec-kit 对齐；§5.5 check 按 selectedAI 验证，已补充 bob、shai、codex 显式条目；19+ AI 全覆盖。原 §5.5 缺 bob/shai/codex 显式验证、§7.0 缺 configTemplate 对齐映射，**已在本轮修改消除**。

**本轮结论**：本轮存在 gap，具体项：1) §5.5 check 清单缺 bob、shai、codex 显式验证条目（DEBATE 4.2 与专项检查要求）；2) §7.0 需求可追溯性映射缺「19+ AI configTemplate 与 spec-kit AGENTS.md 对齐」映射行。**已在本轮内直接修改 PRD 消除上述 gap**。修改完成后，需求完整性、可追溯性、AI 目录映射专项均满足要求。建议主 Agent 发起下一轮审计以验证「连续 3 轮无 gap」收敛。

---

## 5. 结论

**修改后状态**：需求完整性、可测试性、一致性、可追溯性及 AI 目录映射专项检查均已满足。本轮发现 2 处 gap 并已直接修改 PRD 消除。

**报告保存路径**：`_bmad-output/implementation-artifacts/_orphan/AUDIT_PRD_specify-cn-like-init_AI目录映射_§5_round3.md`  
**iteration_count**：1（本轮发现 gap 并已修改，需下一轮验证）

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: B

维度评分:
- 需求完整性: 92/100
- 可测试性: 90/100
- 一致性: 95/100
- 可追溯性: 90/100
