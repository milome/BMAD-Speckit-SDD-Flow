# AUDIT: ARCH + epics 与 PRD 一致性审计（Round 7）

**审计日期**: 2025-03-08  
**被审文档**: ARCH_specify-cn-like-init-multi-ai-assistant.md、epics.md（E10–E13 及 Architecture 组件映射）  
**需求依据**: PRD_specify-cn-like-init-multi-ai-assistant.md  
**审计模式**: ARCH 模式 + PRD 一致性

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 审计维度与结论摘要

| 维度 | 结论 | 评分 |
|------|------|------|
| 需求完整性 | 通过（已补 gap） | 96/100 |
| 可测试性 | 通过 | 93/100 |
| 一致性 | 通过 | 95/100 |
| 可追溯性 | 通过 | 97/100 |
| 技术可行性 | 通过 | 95/100 |
| 扩展性 | 通过 | 92/100 |
| 安全性 | 通过 | 88/100 |
| 成本效益 | 通过 | 90/100 |
| 与 PRD 一致性 | 通过（已补 gap） | 96/100 |
| epics 与 ARCH 一致性 | 通过 | 94/100 |

---

## 2. 本轮发现的 Gap 及已实施修改

### GAP-1：PRD §5.2 --ai 无效时的输出要求未明确

**PRD 要求**：`--ai <name>` 当 `name` 不在内置列表或 registry 时：**报错退出，输出可用 AI 列表（`check --list-ai` 或等价），退出码非 0**。

**审计发现**：ARCH §3.2 InitCommand 与 epics 13.2 仅描述退出码 2，未明确「输出可用 AI 列表或提示运行 check --list-ai」的可操作性要求。

**已实施修改**：
- **ARCH**：§3.2 InitCommand 职责补充「**--ai 无效时**（不在内置或 registry）：输出可用 AI 列表或提示运行 `check --list-ai`，退出码 2」。
- **epics**：13.2 异常路径补充「2 --ai 无效（**须输出可用 AI 列表或提示运行 check --list-ai**）」。

### GAP-2：PRD §5.12.1 文档要求未覆盖

**PRD 要求**：实现要求第 4 点——「**文档**：README 或 `bmad-speckit feedback` 关联文档中列出「全流程兼容 AI」清单（建议优先 cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli）」。

**审计发现**：epics 13.5 仅描述「feedback 子命令输出反馈入口」，未明确 feedback 输出或关联文档须含全流程兼容 AI 清单。

**已实施修改**：
- **epics**：13.5 补充「**feedback 输出或关联文档须含全流程兼容 AI 清单**（PRD §5.12.1，建议 cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli）」。

---

## 3. 批判审计员结论

### 3.1 已检查维度列表

1. **需求完整性**：逐条对照 PRD §5.2–§5.5、§5.8–§5.12、§5.12.1、§7.0，检查 ARCH 与 epics 是否覆盖全部强制要求。  
2. **可测试性**：每项需求是否具备可验证的验收标准或可观测产出。  
3. **一致性**：ARCH 与 epics 之间、epics 与 PRD 之间的表述是否一致，无矛盾。  
4. **可追溯性**：PRD 需求 → ARCH 模块 → epics Story 的映射是否完整、无断链。  
5. **技术可行性**：ADR 决策、技术选型是否可实现，无不可行项。  
6. **扩展性**：registry、configTemplate、19+ AI 的扩展机制是否清晰。  
7. **安全性**：威胁建模、输入验证是否覆盖 PRD §9.2 风险。  
8. **成本效益**：依赖与外部服务是否合理。  
9. **与 PRD 一致性**：§5.2 边界与异常、§5.5 check 验证清单、§5.12.1 实现要求四点的逐项对照。  
10. **epics 与 ARCH 一致性**：E10–E13 各 Story 与 ARCH 模块职责、init 流程、configTemplate 结构是否一一对应。

### 3.2 每维度批判性结论

**需求完整性**：经逐条对照，发现 2 处遗漏。GAP-1（--ai 无效时输出要求）与 GAP-2（§5.12.1 文档要求）已在本轮内直接修改被审文档。修改后，PRD §5.2 边界与异常行为 8 项、§5.5 check 验证清单、§5.12.1 实现要求 4 点均已在 ARCH 或 epics 中有明确可操作表述。configTemplate 按所选 AI 写入、禁止写死 .cursor/、check 按 selectedAI 验证、opencode/bob/shai/codex 显式条目、vscodeSettings、subagentSupport、--bmad-path 与 --ai/--yes 配合、无 selectedAI 时跳过或验证 .cursor、networkTimeoutMs、--modules 与 --ai/--yes 配合等要点均已覆盖。**结论**：修改后需求完整性达标。

**可测试性**：check 结构验证的每项（_bmad、_bmad-output、bmadPath、按 selectedAI 验证目标目录）可通过 `bmad-speckit check` 及退出码 0/1 验证。init 流程每步（解析路径、拉取模板、选择 AI、同步、发布 skills、initLog）均有可观测输出或文件产出。--ai 无效时的「输出可用 AI 列表或提示 check --list-ai」可在实施后通过执行 `init --ai invalid-ai` 并检查 stdout 内容验证。feedback 全流程兼容 AI 清单可通过运行 `bmad-speckit feedback` 或查阅关联文档验证。**结论**：可测试性达标。

**一致性**：ARCH 与 epics 在 InitCommand、CheckCommand、SkillPublisher、configTemplate 结构、退出码约定、--bmad-path 与 --ai/--yes 配合等表述上一致。epics §4 Architecture 组件映射表与 ARCH §3.2 模块职责一一对应。PRD §5.5 check 验证清单与 ARCH §3.2 CheckCommand、epics 13.1 的 AI 目录映射（cursor-agent、claude、gemini、windsurf、kilocode、auggie、roo、opencode、bob、shai、codex 等）一致。**结论**：一致性达标。

**可追溯性**：PRD §7.0 需求可追溯性映射表与 epics §3 PRD 需求→Story 映射完整。US-1 至 US-12 均映射到 E10–E13 的对应 Story。§5.12.1 子代理支持已映射至 US-9，epics 12.1、12.3、13.1 覆盖 configTemplate.subagentSupport、无子代理 AI 时 init/check 提示、check 输出子代理等级；本轮补充的文档要求已纳入 13.5。**结论**：可追溯性达标。

**技术可行性**：ARCH 五则 ADR 均有背景、备选、决策理由、后果，与 PRD §5.6–§5.7 一致。Node.js 18+、Commander.js、Inquirer.js、chalk/boxen/ora、GitHub Release、configTemplate 均为成熟技术，无不可实现项。**结论**：技术可行性达标。

**扩展性**：registry 支持用户/项目/内置三级；configTemplate 按 AI 定义，禁止写死 .cursor/；19+ AI 含 opencode、auggie、bob、shai、codex 显式条目，与 spec-kit AGENTS.md 一致。新增 AI 可通过 registry 扩展。**结论**：扩展性达标。

**安全性**：ARCH §6.1 威胁建模覆盖模板篡改、敏感信息泄露、路径遍历、任意代码执行；§6.2 输入验证覆盖 --ai、--template、--bmad-path、--ai-commands-dir。与 PRD §9.2 风险与缓解一致。**结论**：安全性达标。

**成本效益**：依赖为常见 npm 包，外部仅 GitHub API，--offline、--github-token 可缓解。**结论**：成本效益达标。

**与 PRD 一致性**：GAP-1、GAP-2 修改后，PRD §5.2 边界与异常行为、§5.12.1 实现要求四点均已在 ARCH 或 epics 中有明确对应。**结论**：修改后与 PRD 一致性达标。

**epics 与 ARCH 一致性**：E10–E13 各 Story 与 ARCH InitCommand、TemplateFetcher、AIRegistry、ConfigManager、SkillPublisher、CheckCommand、VersionCommand、UpgradeCommand、ConfigCommand、FeedbackCommand 职责一致。epics §4 Architecture 组件映射表完整。**结论**：epics 与 ARCH 一致性达标。

### 3.3 边界情况与可操作性复核

**边界情况**：PRD §5.2 边界与异常行为 8 项，经复核：（1）--ai 无效——已补充输出要求，退出码 2；（2）--yes 默认 AI——epics 10.2、ARCH ConfigManager 覆盖；（3）目标路径已存在——ARCH init 流程、epics 10.1 覆盖；（4）网络超时/模板失败——ARCH TemplateFetcher、epics 11.1、13.2 覆盖；（5）--offline cache 缺失——ARCH 退出码 5、epics 13.2 覆盖；（6）--bmad-path 路径不可用——ARCH 退出码 4、epics 10.5、13.2 覆盖；（7）--ai generic 无 aiCommandsDir——ARCH 退出码 2、epics 12.1 覆盖；（8）非 TTY 无 --ai/--yes 自动 --yes——ARCH §3.3、epics 10.2 覆盖。全部可操作、可验证。

**被模型忽略风险**：批判审计员重点关注 PRD 中易被忽略的细节。--ai 无效时的「输出可用 AI 列表」在 PRD §5.2 明确要求，但前轮审计未单独列为 gap；本轮逐字对照发现并已补全。§5.12.1 实现要求第 4 点「文档」要求同样易被忽略，本轮已纳入 epics 13.5。

**假收敛风险**：通过逐条对照、边界复核、可操作性验证、被忽略风险排查，降低假收敛概率。本轮发现 2 个实质 gap 并已修改，证明审计有效。

### 3.4 本轮结论

**本轮存在 gap**，已在本轮内**直接修改**被审文档。

| Gap | 描述 | 修改位置 |
|-----|------|----------|
| GAP-1 | PRD §5.2 --ai 无效时须「输出可用 AI 列表或 check --list-ai 等价」 | ARCH §3.2 InitCommand；epics 13.2 |
| GAP-2 | PRD §5.12.1 实现要求第 4 点：文档须含全流程兼容 AI 清单 | epics 13.5 |

**收敛说明**：本轮有 gap 并已修改，consecutive_pass_count 重置为 0。需再连续 3 轮无 gap 才收敛。

---

## 4. 可解析评分块（供 parseAndWriteScore）

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: A（已补 gap）

维度评分:
- 需求完整性: 96/100
- 可测试性: 93/100
- 一致性: 95/100
- 可追溯性: 97/100
- 技术可行性: 95/100
- 扩展性: 92/100
- 安全性: 88/100
- 成本效益: 90/100
```
