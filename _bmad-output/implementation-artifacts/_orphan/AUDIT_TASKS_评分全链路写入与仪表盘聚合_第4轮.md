# TASKS 审计报告：评分全链路写入与仪表盘聚合（第 4 轮）

**被审对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_评分全链路写入与仪表盘聚合.md`  
**审计依据**：audit-prompts §5 执行阶段审计、第 2/3 轮报告（参考、独立复验）  
**审计日期**：2026-03-06  
**审计类型**：第 4 轮——最终收敛验证 + 批判审计员对抗性终查（满足「连续 3 轮无 gap」收敛条件）

---

## 一、与前轮交叉验证及复验摘要

### 1.1 第 2、3 轮结论回顾

| 轮次 | 结论 | 批判审计员判定 |
|------|------|----------------|
| 第 2 轮 | 完全覆盖、验证通过；本轮无新 gap | GAP-CA-1～9 均已修订；2.1.1（T5 fallback）、2.1.3（T10 验收路径）为改进建议，非阻塞 |
| 第 3 轮 | 完全覆盖、验证通过；本轮无新 gap | 独立性复验 T1～T11 通过；连续 2 轮无 gap，可收敛 |

### 1.2 第 4 轮独立复验（扼要）

- **路径存在性**：`skills/bmad-story-assistant/SKILL.md`、`skills/speckit-workflow/SKILL.md`、`scripts/parse-and-write-score.ts`、`scoring/dashboard/compute.ts`、`docs/BMAD/审计报告格式与解析约定.md`、`config/eval-lifecycle-report-paths.yaml` 均存在。
- **锚点可 grep**：`审计通过后评分写入触发`（line 936）、`AUDIT_implement`、`speckit_5_2`、`parse-and-write-score` 在 speckit-workflow 中有匹配。
- **CLI 支持**：`scripts/parse-and-write-score.ts` 已支持 `--triggerStage`（line 65）、`--iteration-count`（line 67-68）。
- **路径约定**：eval-lifecycle-report-paths.yaml implement 路径与 T10 约定一致（`_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md`）。

---

## 二、批判审计员结论（强制，占比 >70%）

### 2.1 对抗视角一：T1～T11 遗漏与歧义逐项终查

#### T1
- **插入位置歧义**：T1 要求「在『审计通过后评分写入触发』**之前**插入步骤 4.2」。bmad-story-assistant line 936 为阶段四该段落。若实施者将步骤 4.2 插入为段落内首句，与「审计通过后评分写入触发」并列，语义可接受；若插入为独立小节置于该段落之前，亦符合「之前」。两种理解均可执行，**无歧义阻塞**。
- **CLI 示例完整性**：示例含 `--reportPath`、`--stage tasks`、`--event story_status_change`、`--triggerStage bmad_story_stage4`、`--epic`、`--story`、`--artifactDocPath`、`--iteration-count`。**完整**。
- **artifactDocPath 占位符**：`<story 文档路径>` 未给模板。round 3 已判：bmad-story-assistant 允许 implement 阶段留空由解析器从 reportPath 推断。**不构成 gap**。

#### T2
- **STORY-A4-POSTAUDIT 分散风险**：T2 修改路径为 bmad-story-assistant，若 STORY-A4-POSTAUDIT 实际引用自 audit-prompts 或其它文件，修改 bmad-story-assistant 可能无法直达 prompt。round 3 已判：在 stage4 段落增加「要求审计子任务 prompt 中写明」与 stage2 一致即可，可操作。**不构成 gap**。
- **锚点唯一性**：`审计通过后请将报告保存至` 在 stage2（line 592）存在；stage4 需新增。grep 可定位。**无歧义**。

#### T3
- **验收主观性**：「SKILL 文档明确上述自动化逻辑及边界条件」——「明确」略主观。实施后可由二次审计判定。前两轮均已接受。**不构成新 gap**。
- **SCORE_WRITE_SKIP_REPORT_MISSING**：边界条件已定义，可操作。**无遗漏**。

#### T4
- **短期方案边界**：本轮采用 trigger_stage 字段，中期 stage=implement 延后。与 T5、T10 的 triggerStage 取值（bmad_story_stage4、speckit_5_2）无冲突。**一致**。
- **trigger_stage 写入链**：修改路径含 types.ts、run-score-schema.json、parse-and-write.ts、parse-and-write-score.ts。scripts 已支持 `--triggerStage`，需扩展 parse-and-write 写入逻辑。任务描述清晰。**可执行**。

#### T5
- **路径 fallback**：T5 未写「否则 ~/.cursor/...」，与 T1～T3 不一致。可推定沿用同一规则。第 2 轮判为非阻塞。**不构成新 gap**。
- **补跑与 T1 顺序**：T1 步骤 4.2 在审计通过后即运行 parse-and-write-score；T5 检查在「阶段四通过后、提供完成选项前」。逻辑：T1 先写 → T5 再查 → 若无则补跑。**顺序正确**。
- **「可构造」语义**：第 2 轮判「可构造」可解读为路径可拼且文件存在，表述可执行。**不构成 gap**。

#### T6
- **主目标与 yaml 分离**：主修改目标明确为 `docs/BMAD/审计报告格式与解析约定.md`；yaml 扩展「若有」单独列出。**无歧义**。

#### T7
- **aggregateByBranch 延后**：已明确「本轮不实现」，原因充分。**无遗漏**。
- **aggregateByEpicStoryTimeWindow 参数**：`windowHours` 默认 24h，与 Party-Mode 共识一致。**可操作**。

#### T8
- **「至少 3 个 stage」与 5 阶段**：第 2 轮 2.1.4 已记录语义差，实施时文档化即可。**非新 gap**。
- **phase_weight 总和**：验收用例「phase_weight 各 0.2」、3 条 fixture → 0.6。可能为简化设计，实施时需确认 schema。第 3 轮判「实施细节可处理」。**不构成文档 gap**。

#### T9
- **getWeakTop3 扩展**：按 epic/story 聚合、取最低分、Top 3 升序。描述清晰，单测可覆盖。**可执行**。

#### T10
- **implement 路径与 yaml 一致**：已与 config/eval-lifecycle-report-paths.yaml line 29 对齐。**无歧义**。
- **验收 fallback**：若修改 ~/.cursor/skills，grep 项目内路径会失败。第 2 轮建议「在实际修改的 SKILL 路径执行 grep」。**改进建议，非阻塞**。

#### T11
- **--runGroupId 与 runId 约定二选一**：任务描述两种方案并列，验收「或等效机制」可满足。**可执行**。
- **与 T7 衔接**：T7 引入 run_group_id 可选字段；T11 约定调用方传入或 runId 共享策略。依赖自洽。**无矛盾**。

### 2.2 对抗视角二：实施后可验证性

| 任务 | 实施后验证方式 | 可断言？ |
|------|----------------|----------|
| T1 | grep 步骤 4.2、CLI、路径模板 | ✓ |
| T2 | grep 保存路径约定于 stage4 | ✓ |
| T3 | 人工或二次审计判定文档明确性 | 略主观 |
| T4 | CLI 执行 + record 含 trigger_stage + 单测 | ✓ |
| T5 | 脚本执行 + 输出有/无 + SKILL 嵌入 | ✓ |
| T6 | grep Story 完成自检 + 章节三项内容 | ✓ |
| T7 | 单测 aggregateByEpicStoryTimeWindow + getLatestRunRecordsV2 | ✓ |
| T8 | fixture + 总分/四维断言（±1） | ✓ |
| T9 | 单测 getWeakTop3 + 仪表盘 grep | ✓ |
| T10 | grep AUDIT_implement、speckit_5_2、parse-and-write-score | ✓ |
| T11 | 文档更新 + --runGroupId 或等效 | ✓ |

**批判审计员**：除 T3 外，均具备可量化或可 grep 的验收手段。T3 可由实施后审计判定。**无阻塞**。

### 2.3 对抗视角三：依赖链与 Phase 顺序

```
Phase 1: T1 → T2 → T3 → T4 → T10 → T11
Phase 2: T5(T3,T4) → T6(T5)
Phase 3: T7 → T8(T7) → T9(T8)
```

- **T4 延后对 T5**：T5 已说明「T4 延后时：补跑使用 stage=tasks、triggerStage=bmad_story_stage4」。**自洽**。
- **T7 与 T11**：T11 依赖 T7，但 T7 的 run_group_id 为可选；T11 的 --runGroupId 或 runId 约定可独立于 T7 聚合逻辑实现。**无循环**。
- **Phase 3 验收依赖 Phase 1 数据**：T8、T9 需 scoring/data 中有记录。Phase 1 产出写入链路，Phase 3 消费。**顺序正确**。

### 2.4 对抗视角四：边界与模型易忽略风险

1. **迭代次数传递**：T1 CLI 示例含 `--iteration-count`； Party-Mode 共识「一次通过传 0，连续 3 轮无 gap 不计入」。**已覆盖**。
2. **reportPath 不存在**：T3 边界「SCORE_WRITE_SKIP_REPORT_MISSING」「不阻断」。**已定义**。
3. **子任务输出非结构化**：T3 约定优先从约定路径推断，次从子任务输出提取。若子任务输出无 reportPath，fallback 为约定路径。**可操作**。
4. **epic/story 解析**：T5、T7 使用 parseEpicStoryFromRecord 或 run_id 正则 `dev-e{N}-s{N}-`，与 RUN_ID_CONVENTION §2.1 一致。**无歧义**。

### 2.5 对抗视角五：与前轮改进建议的一致性

| 前轮建议 | 本轮判定 |
|----------|----------|
| T5 补充 fallback 表述 | 不阻塞；可推定沿用 T1～T3 规则 |
| T10 验收注明 fallback 路径 | 不阻塞；实施时在实际修改路径执行 grep |

**批判审计员**：上述建议均为表述优化，非功能性 gap。**不构成本轮新 gap**。

### 2.6 新 gap 排查（第 4 轮独有）

逐一排查前轮未覆盖的潜在风险：

1. **T1 路径模板与 bmad-story-assistant 实际目录**：T1 使用 `epic-{epic}-*/story-{epic}-{story}-*/`。implementation-artifacts 实际为 `epic-{N}-{slug}/story-{epic}-{story}-{slug}/`。glob 模式 `epic-{epic}-*` 可匹配 `epic-8-eval-question-bank` 等。**无歧义**。

2. **T4 schema 扩展**：run-score-schema.json 需新增 trigger_stage 可选字段。若 schema 严格校验必填字段，需确认 optional 支持。常规 JSON Schema 支持 optional。**实施细节，非文档 gap**。

3. **T8 完整 run 与 3 stage 退化**：「至少 3 个 stage」时，phase_weight 总和可能 <1。仪表盘总分计算需处理归一化或按实际权重。任务未强制 weight 总和=1，实施时可处理。**不构成 gap**。

4. **T11 runId 与当前脚本**：当前 parse-and-write-score 默认生成 `dev-e{epic}-s{story}-{stage}-{ts}`（含 stage）。T11 约定「不含 stage」的 `dev-e{epic}-s{story}-{ts}` 需调用方传入 --runId 或扩展 --runGroupId。任务描述为「新增 --runGroupId 或约定」，未强制改默认生成逻辑。**可执行**。

**批判审计员**：经第 4 轮独有排查，**未发现必须计入的新 gap**。

### 2.7 批判审计员最终判定

经对抗性终查（2.1～2.6）：

1. **T1～T11**：修改路径、锚点、验收标准、依赖关系均明确、可执行、可验收。
2. **遗漏**：无。需求追溯表 REQ-1～6 与 6 议题均有对应任务覆盖。
3. **歧义**：无阻塞性歧义。前轮改进建议（T5 fallback、T10 验收路径）为非阻塞。
4. **不可执行项**：无。
5. **新 gap**：**未发现**。第 2、3 轮已覆盖的 9 项 GAP 均已修订落实；第 4 轮独有排查无新增阻塞点。

**结论**：**本轮无新 gap**，第 4 轮。**连续 3 轮（第 2、3、4 轮）无 gap，审计收敛**。

---

## 三、审计结论

### 结论：**完全覆盖、验证通过**

- 第 4 轮独立性复验：T1～T11 从批判审计员视角逐项终查，路径、锚点、验收、依赖均满足可执行与可验收要求。
- 批判审计员对抗性检查：遗漏、歧义、不可执行项、依赖自洽、边界条件、新 gap 排查均无阻塞发现。
- **本轮无新 gap**，第 4 轮。
- **连续 3 轮（第 2、3、4 轮）无 gap，审计收敛**。

### 非阻塞改进建议（可选，与前轮一致）

1. **T5**：修改路径补充「否则 `~/.cursor/skills/bmad-story-assistant/SKILL.md`」，与 T1～T3 表述统一。
2. **T10**：验收标准补充「若修改路径为 fallback（~/.cursor/...），则在对应路径执行 grep」。

### 收敛声明

满足「连续 3 轮无 gap」条件（第 2、3、4 轮），本 TASKS 文档**审计收敛**，可进入实施阶段。

---

*本报告由 audit-prompts §5 精神执行，批判审计员结论占比 >70%。*
