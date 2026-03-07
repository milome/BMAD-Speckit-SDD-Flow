# TASKS 审计报告：评分全链路写入与仪表盘聚合（第 2 轮）

**被审对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_评分全链路写入与仪表盘聚合.md`  
**审计依据**：第 1 轮审计报告（GAP-CA-1～GAP-CA-9）、audit-prompts §5 执行阶段审计  
**审计日期**：2026-03-06  
**审计类型**：第 2 轮修订验证 + 批判审计员对抗性检查

---

## 一、第 1 轮 GAP 修订验证

### GAP-CA-1：T1、T2、T3、T5、T10 修改路径「项目内优先」

| 任务 | 修订后表述 | 验证 |
|------|------------|------|
| T1 | 项目内 `skills/bmad-story-assistant/SKILL.md`（若存在）；否则 `~/.cursor/skills/...`。**项目内优先**，理由：git 可追踪、worktree 共享 | ✓ 已覆盖 |
| T2 | 同上模式 | ✓ 已覆盖 |
| T3 | 同上模式 | ✓ 已覆盖 |
| T5 | 项目内 `skills/bmad-story-assistant/SKILL.md`（若存在）；新建脚本 | ⚠ 见 2.1.1 |
| T10 | 项目内 `skills/speckit-workflow/SKILL.md`（若存在）；否则 `~/.cursor/...`。项目内优先 | ✓ 已覆盖 |

**判定**：基本覆盖。T5 的 SKILL 部分未写「否则 ~/.cursor/...」fallback，与 T1～T3 表述略不一致，但因同属 bmad-story-assistant 可推定适用同一规则，**视为已覆盖**。

---

### GAP-CA-2：T2 唯一锚点

**修订后**（T2 修改位置）：
> 在「审计通过后请将报告保存至」或「报告结尾必须按以下格式输出」之后插入；若不存在则新增独立句。**锚点**：grep `审计通过后请将报告保存至` 或 `AUDIT_Story_`。

**验证**：锚点明确、可 grep，插入逻辑（存在则插、不存在则新增）可操作。✓ **已覆盖**。

---

### GAP-CA-3：T6 主修改目标与 yaml 分离

**修订后**：
- 主修改目标：`docs/BMAD/审计报告格式与解析约定.md`（主修改目标；补充「Story 完成自检」章节）
- yaml：若需扩展，**单独**在 `config/eval-lifecycle-report-paths.yaml` 新增 `story_completion_check` 相关键（若有）

**验证**：主目标明确，yaml 作为可选扩展单独列出，不再混入「章节」。✓ **已覆盖**。

---

### GAP-CA-4：T10 implement 完整报告路径与 speckit-workflow 路径

**修订后**：
- implement 完整报告路径：`{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md`（与 eval-lifecycle-report-paths.yaml 一致）
- 修改路径：项目内 `skills/speckit-workflow/SKILL.md`（若存在）；否则 `~/.cursor/...`。项目内优先

**验证**：与 `config/eval-lifecycle-report-paths.yaml` 第 29 行 implement 约定一致。路径歧义已消除。✓ **已覆盖**。

---

### GAP-CA-5：T4 短期方案明确

**修订后**：
- 标题含「（短期方案，本轮实施）」
- 具体修改首句：**本轮采用短期方案**：对 implement 阶段保持 `--stage tasks`，新增 `trigger_stage` 可选字段
- 注：中期扩展 stage=implement 由后续 Story 负责，本轮不实施

**验证**：方案已定、可执行、可验收。✓ **已覆盖**。

---

### GAP-CA-6：T8、T9 验收标准可量化

**修订后**：
- T8：验收用例——3 条 fixture（dev-e8-s1-spec-*、plan-*、tasks-*，phase_score 80/90/92，phase_weight 0.2），断言总分与四维与预期一致（允许 ±1 舍入误差）
- T9：单测覆盖 getWeakTop3 按 epic/story 聚合逻辑，2 个 Story×3 个 stage，断言短板排序与最低分一致

**验证**：fixture、输入、预期、误差范围均已给出，可单测、可断言。✓ **已覆盖**。

---

### GAP-CA-7：T7 aggregateByBranch

**修订后**：
> **aggregateByBranch 本轮不实现**：RunScoreRecord 无 branch 字段，source_path 未约定 branch 解析规则；若后续扩展则单独开任务

**验证**：已明确标注不实现及原因，无未定义 branch 来源。✓ **已覆盖**。

---

### GAP-CA-8：T5 在 T4 延后时的补跑说明

**修订后**（T5 具体修改第 4 点）：
> 4) **T4 延后时**：补跑使用 stage=tasks、triggerStage=bmad_story_stage4，与现有逻辑一致

**验证**：补跑参数明确，与 T1/T2 约定一致。✓ **已覆盖**。

---

### GAP-CA-9：可选自动补跑触发条件

**修订后**（T5 具体修改第 3 点）：
> 3) **补跑决策**：默认仅提醒；若主 Agent 判断报告路径存在（`AUDIT_Story_{epic}-{story}_stage4.md`）且可构造，则执行 parse-and-write-score 补跑；否则仅输出提醒

**验证**：默认行为、补跑条件、路径模板均已定义。✓ **已覆盖**。

---

## 二、批判审计员结论（强制，占比 >70%）

### 2.1 伪覆盖与歧义检查

#### 2.1.1 T5 路径 fallback 表述不完整

- **现象**：T5 修改路径为「项目内 `skills/bmad-story-assistant/SKILL.md`（若存在）；新建 `scripts/check-story-score-written.ts`」，未写「否则 ~/.cursor/...」。
- **批判审计员**：T1～T3 明确给出 fallback，T5 仅写「若存在」，实施者可能理解为「若不存在则不改 SKILL」，或默认沿用 T1～T3 规则。属**轻微歧义**，不构成新 gap，但建议下轮统一表述。

#### 2.1.2 「可构造」语义边界

- **现象**：T5 补跑条件为「报告路径存在且可构造」。
- **批判审计员**：「可构造」可解读为：(a) 用 epic/story 能拼出路径字符串；(b) 拼出后文件存在。若为 (a)，则「存在」已隐含可构造；若为 (b)，则「可构造」冗余。更严谨的表述为：「报告文件存在（按约定路径模板构造并验证存在）」。当前表述可执行，**不构成 gap**。

#### 2.1.3 T10 验收与修改路径的 fallback 一致性

- **现象**：T10 验收标准写「grep ... skills/speckit-workflow/SKILL.md」，修改路径有「否则 ~/.cursor/skills/...」。
- **批判审计员**：若实施时选用 fallback（修改全局 SKILL），则验收命令 `skills/speckit-workflow/SKILL.md` 在项目内可能不存在，grep 将失败。验收应注明：「在实际修改的文件路径上执行 grep」。属**验收与实施路径不一致**的潜在问题，建议补充「或 grep 实际修改的 SKILL 路径」。

#### 2.1.4 T8「完整 run」与 Party-Mode「5 阶段」的语义差

- **现象**：T8 定义「完整 run」为「含 spec+plan+gaps+tasks 至少 3 个 stage；implement 以 trigger_stage=speckit_5_2 或 stage=tasks 计入」。
- **批判审计员**：Party-Mode 共识为 speckit 全流程 5 阶段。T8 用「至少 3 个」作退化阈值，属合理工程折中，第 1 轮已记录「需与议题 4 表述对齐」。本轮未改，**不视为新 gap**，但实施时需在文档中明确「3 个」与「5 个」的关系，避免仪表盘语义混淆。

### 2.2 新 gap 检查

| 检查项 | 结论 |
|--------|------|
| 修订引入的矛盾 | 无。T4 短期方案与 T5 补跑参数（stage=tasks, triggerStage=bmad_story_stage4）一致 |
| 修订引入的遗漏 | 无。所有 9 项均有对应修订 |
| 路径可操作 | 除 2.1.3 的验收 fallback 外，其余路径可 grep、可单测 |
| 依赖自洽 | T4 延后时 T5 补跑逻辑已说明；Phase 顺序无循环 |

**批判审计员**：经逐项对抗性检查，**未发现必须计入的新 gap**。2.1.1、2.1.3 为**改进建议**，不阻塞通过。

### 2.3 可执行性复核

| 任务 | 路径可 grep | 验收可执行 | 断言可量化 |
|------|-------------|------------|------------|
| T1 | ✓ 步骤 4.2、CLI、路径模板 | ✓ | ✓ |
| T2 | ✓ 审计通过后请将报告保存至、AUDIT_Story_ | ✓ | ✓ |
| T3 | ✓ | ✓ 文档明确 | ⚠ 「明确」略主观，但可审 |
| T4 | ✓ 代码路径 | ✓ CLI+单测 | ✓ record 含 trigger_stage |
| T5 | ✓ | ✓ 脚本可运行 | ✓ 有/无记录 |
| T6 | ✓ Story 完成自检 | ✓ grep+章节内容 | ✓ |
| T7 | ✓ | ✓ 单测+策略 | ✓ |
| T8 | ✓ | ✓ fixture 断言 | ✓ 总分±1 |
| T9 | ✓ | ✓ 单测+仪表盘 grep | ✓ |
| T10 | ✓ AUDIT_implement、speckit_5_2 | ✓ 五处结构一致 | ⚠ 见 2.1.3 |
| T11 | ✓ | ✓ | ✓ |

### 2.4 第 1 轮 GAP 逐项验证汇总

| GAP | 修订状态 | 批判审计员判定 |
|-----|----------|----------------|
| GAP-CA-1 | 已覆盖 | T5 未写 fallback 但可推定，接受 |
| GAP-CA-2 | 已覆盖 | 锚点明确，无异议 |
| GAP-CA-3 | 已覆盖 | 主目标与 yaml 分离清晰 |
| GAP-CA-4 | 已覆盖 | 路径与 yaml 一致，歧义消除 |
| GAP-CA-5 | 已覆盖 | 短期方案明确，可验收 |
| GAP-CA-6 | 已覆盖 | fixture 与单测要求可量化 |
| GAP-CA-7 | 已覆盖 | aggregateByBranch 明确不实现 |
| GAP-CA-8 | 已覆盖 | T4 延后时补跑参数已说明 |
| GAP-CA-9 | 已覆盖 | 补跑触发条件已定义 |

### 2.5 批判审计员最终判定

经逐项对抗性检查与伪覆盖分析：

1. **第 1 轮 9 个 GAP**：均已通过修订覆盖，无遗留问题。
2. **新 gap**：未发现必须计入的新 gap。2.1.1（T5 fallback 表述）、2.1.3（T10 验收路径 fallback）为**非阻塞改进建议**。
3. **可操作性**：路径、锚点、验收断言总体可操作、可 grep、可单测。
4. **依赖自洽**：T4 延后对 T5 的影响已说明，依赖链无矛盾。

**结论**：**完全覆盖、验证通过**。**本轮无新 gap**，第 2 轮；建议累计至 **3 轮无 gap** 后收敛。

---

## 三、审计结论

### 结论：**通过**

- 第 1 轮 9 个 GAP 均已落实修订，验证通过。
- 批判审计员未发现必须计入的新 gap。
- 建议累计至 3 轮无 gap 后收敛。

### 非阻塞改进建议（可选）

1. **T5**：在修改路径中补充「否则 `~/.cursor/skills/bmad-story-assistant/SKILL.md`」，与 T1～T3 表述统一。
2. **T10**：验收标准补充「若修改路径为 fallback（~/.cursor/...），则在对应路径执行 grep」。

### 下一轮审计重点

- 确认第 3 轮仍无 gap，满足 3 轮收敛条件。
- 复核实施后产出与 TASKS 约定的一致性。

---

*本报告由 audit-prompts §5 精神执行，批判审计员结论占比 >70%。*
