# audit-prompts §5 执行阶段审计报告 · 第 2 轮

**被审对象**：TASKS_评分全链路写入与仪表盘聚合（T12、T10 实施完成）
**审计依据**：audit-prompts §5、TASKS 验收标准
**审计轮次**：第 2 轮（第 1 轮已通过且批判审计员结论为「本轮无新 gap」）
**产出日期**：2026-03-06

---

## §5 审计项逐项验证

### 1. 任务是否真正实现（无预留/占位/假完成）

| 任务 | 验证方式 | 结果 |
|------|----------|------|
| T12 | audit-prompts.md 中四锚点各存在且仅 1 处 | ✓ 通过 |
| T10 | SKILL.md §1.2～§5.2 五处触发段落含路径、CLI 示例、责任划分 | ✓ 通过 |

**T12 详情**：
- `【§1 可解析块要求】`：第 10 行，spec 阶段 prompt 内，唯一
- `【§2 可解析块要求】`：第 18 行，plan 阶段 prompt 内，唯一
- `【§3 可解析块要求】`：第 26 行，GAPS 阶段 prompt 内，唯一
- `【§5 可解析块要求】`：第 71 行，执行阶段 prompt 内，唯一
- 四锚点均位于「报告结尾必须包含 §4.1 规定的可解析评分块」相关表述之后，语义正确

**T10 详情**：
- §5.2 报告路径含 `AUDIT_implement-E{epic}-S{story}.md` ✓
- §5.2 triggerStage=speckit_5_2、stage=tasks ✓
- 五处均含 parse-and-write-score 完整调用示例（含 --iteration-count）✓

### 2. 生产代码是否在关键路径中被使用

T12、T10 为**文档/SKILL 修改任务**，不涉及 TypeScript/脚本等生产代码。修改对象为流程定义文档：

- `audit-prompts.md`：被 code-review 技能及 mcp_task 回退路径引用，作为各阶段审计提示词来源
- `SKILL.md`：speckit-workflow 技能主文件，执行 specify/plan/gaps/tasks/implement 时加载

二者均在 speckit-workflow **流程关键路径**中被使用：用户执行 speckit 命令时，这些文档被读取并驱动审计与评分写入行为。✓ 关键路径覆盖。

### 3. 需实现的项是否均有实现与验收覆盖

| 需求项 | 实现 | 验收覆盖 |
|--------|------|----------|
| T12 四锚点各 1 | ✓ 已实现 | prd US-001、grep 验证 |
| T12 五阶段 prompt 可解析块 | §4 已有，§1/§2/§3/§5 通过锚点落实 | ✓ |
| T10 报告路径、CLI、责任划分 | ✓ 五处一致 | prd US-002、grep 验证 |
| T10 implement 路径与 triggerStage | ✓ AUDIT_implement、speckit_5_2 | ✓ |

### 4. 验收表/验收命令是否已按实际执行并填写

- **prd**：`prd.TASKS_评分全链路写入与仪表盘聚合.json` 存在，US-001、US-002 的 `passes` 均为 `true`
- **progress**：`progress.TASKS_评分全链路写入与仪表盘聚合.txt` 存在，含 US-001、US-002 的 story log 及验收摘要
- **验收命令**：grep 已在审计过程中执行，T12 四锚点各 1、T10 三关键词各有匹配均验证通过

### 5. 是否遵守 ralph-method（prd/progress 更新、US 顺序）

- prd 已创建，userStories 与 T12、T10 一一对应，passes 已更新
- progress 含带时间戳的 story log
- US 顺序：T12（US-001）→ T10（US-002），与 TASKS §3 Phase 1 顺序一致

### 6. 是否无「将在后续迭代」等延迟表述；是否无标记完成但未调用

- 无「将在后续迭代」「待定」等延迟表述
- US-001、US-002 标记完成，对应变更已存在于 `audit-prompts.md`、`SKILL.md`，可独立验收验证

---

## 批判审计员结论

**本轮结论**：**本轮无新 gap，第 2 轮**。

### 对抗性检查清单（逐项）

#### 遗漏任务

- **T12**：TASKS 要求 §1、§2、§3、§5 四阶段。§4（tasks）已有可解析块要求（见 audit-prompts.md 第 33 行「**可解析评分块（强制）**」及 prompt 内「**无论采用标准格式或逐条对照格式，报告结尾必须包含 §4.1 规定的可解析评分块**」）。T12 明确仅覆盖 §1/§2/§3/§5，§4 不在本次修改范围。✓ 无遗漏。

- **T10**：要求 §1.2～§5.2 五处。SKILL.md 中 §1.2（约 161–167 行）、§2.2（196–202）、§3.2（247–253）、§4.2（280–286）、§5.2（415–422）均含「审计通过后评分写入触发」段落，结构一致。✓ 无遗漏。

#### 行号或路径失效

- **audit-prompts.md 路径**：`skills/speckit-workflow/references/audit-prompts.md` 存在。SKILL.md 内引用为 `[references/audit-prompts.md](references/audit-prompts.md)`，相对 skill 根目录，解析正确。✓ 路径有效。

- **锚点行号**：§1 锚点约第 10 行、§2 约 18、§3 约 26、§5 约 71。当前文件行数 73，行号在有效范围内。✓ 无失效。

#### 验收命令未跑

- T12 验收要求 `grep -c '【§N 可解析块要求】' audit-prompts.md` 各为 1。审计中通过 grep 工具逐锚点验证，四个锚点均仅出现 1 次。✓ 验收已执行。

- T10 验收要求 grep `AUDIT_implement`、`speckit_5_2`、`parse-and-write-score`。三者在 SKILL.md 中均有匹配，且 §5.2 段落明确含 `AUDIT_implement`、`speckit_5_2`。✓ 验收已执行。

#### §5/验收误伤或漏网

- **误伤**：未将正确实现判为未通过。四锚点语义正确、位置正确，无过度严格判定。✓ 无误伤。

- **漏网**：未将未实现或错误实现判为通过。
  - 锚点插入位置：均位于「报告结尾必须包含 §4.1 规定的可解析评分块」表述之后或之内，与「在『报告结尾必须明确给出结论』相关表述之后」一致。✓ 无漏网。
  - §5.2 报告路径：`_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md`，与 TASKS 及 config/eval-lifecycle-report-paths.yaml 约定一致。✓ 无漏网。

#### 边界与风险

- **项目内 vs 全局技能**：TASKS 规定「项目内优先」。实施在 `skills/speckit-workflow/` 下完成，项目内路径已生效。若存在 `~/.cursor/skills/speckit-workflow/`，加载优先级依 Cursor 约定；当前审计以项目内实施为准。✓ 风险已识别，不构成本轮 gap。

- **parse-and-write-score 实际调用**：T10 确保 SKILL 文档中含完整调用示例与责任划分。实际调用依赖主 Agent 在收到审计通过结论后执行，属运行时行为。文档层面已满足 T10 要求。✓ 不构成本轮 gap。

- **standalone 流程**：§5.2 责任划分段已注明「standalone speckit 流程（无 epic/story）时，主 Agent 在 pass 时同样传入 --iteration-count」。✓ 与 TASKS 一致。

### 第 2 轮特异性复核

- 对比第 1 轮结论「本轮无新 gap」：本次审计重新执行全部验收命令，结果与第 1 轮一致，未发现新增问题。
- 文件内容未发现自第 1 轮以来的回退或篡改。
- prd/progress 与实施产物一致，无「标记完成但未实现」情况。

#### 潜在漏网复核

- **锚点重复风险**：若某锚点出现 2 次，grep -c 将 >1，验收会失败。当前四锚点各 1 次，无重复。✓
- **§5.2 与 §4.2 路径混淆**：§4.2 为 tasks 阶段，路径含 `AUDIT_tasks-E{epic}-S{story}.md`；§5.2 为 implement 阶段，路径含 `AUDIT_implement-E{epic}-S{story}.md`。两者区分明确，未混淆。✓
- **triggerStage 与 stage 区分**：TASKS 议题 5 共识为 implement 用 stage=tasks 写入、triggerStage=speckit_5_2 区分。§5.2 CLI 示例正确传参。✓

#### 模型易忽略点检查

- **锚点可见性**：锚点 `【§N 可解析块要求】` 为中文全角括号+节号，位于 prompt 末尾，模型生成审计报告时易被提示词约束覆盖。设计合理。✓
- **责任划分清晰度**：§5.2 明确「code-review 子代理产出审计报告并落盘」「主 Agent 在收到通过结论后执行 parse-and-write-score」，责任无歧义。✓

### 批判审计员总结

经对抗性检查（遗漏任务、路径失效、验收未跑、误伤漏网、边界风险、潜在漏网、模型易忽略点七维度），**T12、T10 实施完整、验收可复现、无遗漏任务、无路径失效、无验收误伤或漏网**。本轮未发现新 gap。

**建议**：累计至 3 轮无 gap 后收敛。

---

## 最终结论

- **§5 审计结论**：**完全覆盖、验证通过**
- **本轮无新 gap，第 2 轮；建议累计至 3 轮无 gap 后收敛**

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 90/100
- 一致性: 95/100
- 可追溯性: 95/100
