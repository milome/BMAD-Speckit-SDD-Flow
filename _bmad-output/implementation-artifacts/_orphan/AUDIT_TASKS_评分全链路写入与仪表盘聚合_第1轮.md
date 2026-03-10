# TASKS 审计报告：评分全链路写入与仪表盘聚合（第 1 轮）

**被审对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_评分全链路写入与仪表盘聚合.md`  
**审计依据**：6 个议题、audit-prompts §5 逐项验证精神  
**审计日期**：2026-03-06  
**审计类型**：严格审计，批判审计员占比 >70%

---

## 一、逐项验证结果

### 1. 需求覆盖

| 议题 | 核心要点 | 对应任务 | 覆盖 |
|-----|----------|----------|------|
| 1. bmad-story-assistant 显式步骤 | 阶段四插入步骤 4.2、CLI 示例、报告路径模板 | T1, T2 | ✓ |
| 2. 自动化调用 | reportPath 解析、parse-and-write-score 自动执行、non_blocking | T3, T4 | ✓ |
| 3. 流程收尾自检 | scoring/data 检查、epic/story 匹配、提醒或补跑 | T5, T6 | ✓ |
| 4. 聚合逻辑调整 | 时间窗口、branch、run_group 聚合键 | T7, T8, T9 | ✓ |
| 5. 全链路写入与 implement stage | 5 阶段写入、trigger_stage/stage=implement | T10, T11 | 部分（见 GAP） |
| 6. 跨 run 聚合 | 按 epic/story 聚合、总分与短板 | T8, T9 | ✓ |

### 2. 修改路径明确性

| 任务 | 修改路径 | 判定 |
|------|----------|------|
| T1–T3 | `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md` | ⚠ 见 GAP-CA-1 |
| T4 | audit-index.ts、audit-item-mapping.ts、parse-and-write-score.ts、run-score-schema.json | ✓ 明确 |
| T5 | bmad-story-assistant SKILL、新建 scripts/check-story-score-written.ts | ⚠ 路径歧义同 T1 |
| T6 | docs/BMAD/审计报告格式与解析约定.md 或 config/eval-lifecycle-report-paths.yaml | ⚠ 见 GAP-CA-3 |
| T7–T9 | scoring/dashboard/compute.ts 等 | ✓ 明确 |
| T10 | speckit-workflow SKILL（或项目内引用路径） | ⚠ 见 GAP-CA-4 |
| T11 | parse-and-write-score.ts、RUN_ID_CONVENTION.md | ✓ 明确 |

### 3. 具体修改内容

| 任务 | 可操作性 | 备注 |
|------|----------|------|
| T1 | ✓ | 含完整 markdown 插入块 |
| T2 | ⚠ | 「审计通过结论输出格式段」无行号/锚点 |
| T3 | ✓ | 逻辑描述具体 |
| T4 | ⚠ | 短期/中期二选一未定 |
| T5 | ✓ | 脚本接口与逻辑清晰 |
| T6 | ⚠ | 二选一路径未定，yaml 不适合作「章节」 |
| T7 | ✓ | 含可选 run_group_id 代码片段 |
| T8–T9 | ✓ | 逻辑描述可落地 |
| T10 | ⚠ | implement 报告路径仅文件名，未给完整路径 |
| T11 | ✓ | 多种方案并列 |

### 4. 验收标准可执行性

| 任务 | 验收标准 | 可量化 |
|------|----------|--------|
| T1 | 含「步骤 4.2」、CLI 示例、路径模板 | ✓ grep 可验 |
| T2 | 模板含保存路径约定 | ✓ grep 可验 |
| T3 | 文档明确自动化逻辑及边界 | ⚠ 「明确」主观 |
| T4 | 短期/中期二选一验收 | ⚠ 未定方案则不可验 |
| T5 | 脚本可运行、SKILL 嵌检查 | ✓ |
| T6 | 文档含完整自检逻辑 | ⚠ 「完整」主观 |
| T7 | 单测覆盖、策略生效 | ✓ |
| T8 | 可执行、有数据时输出正确总分与四维 | ⚠ 「正确」无量化 |
| T9 | 仪表盘输出含跨 run 聚合短板 | ⚠ 「含」可 grep， correctness 无断言 |
| T10 | 5 个 stage 触发段落完整且一致 | ⚠ 「完整」「一致」无检查清单 |
| T11 | 文档更新、--runGroupId 或等效可用 | ✓ |

### 5. 依赖关系

```
Phase 1: T1 → T2 → T3 → T4 → T10 → T11
Phase 2: T5(T3,T4) → T6(T5)
Phase 3: T7 → T8(T7) → T9(T8)
```

**检查**：无循环依赖。T5 依赖 T3、T4；T4 标「可延后」，若 T4 延后则 T5 的自检逻辑（检查 scoring/data 是否有记录）仍可实施，但「补跑」时若需 trigger_stage/implement 区分则依赖 T4。**依赖链自洽**，但 T4 延后对 T5 的影响未在 T5 中说明。

### 6. 与前置文档一致性

| 检查项 | 结果 |
|--------|------|
| stage-mapping.yaml | layer_4 含 implement ✓；与 T4/T10 一致 |
| scoring-trigger-modes.yaml | call_mapping 含 speckit_5_2、bmad_story_stage4 ✓ |
| RUN_ID_CONVENTION.md | §2.1 推荐格式与 T11 扩展方向兼容；当前无 run_group_id |
| run-score-schema.json | stage 含 implement ✓；无 run_group_id、trigger_stage（T4/T11 待扩） |
| eval-lifecycle-report-paths.yaml | implement 路径已约定 ✓；与 T10 报告路径需对齐 |

### 7. 遗漏与边界

- **议题 3**：「可选自动补跑」的触发条件（何时提醒、何时补跑）未定义。
- **议题 5**：T4 标「可延后」，议题 5「短期/中期」共识未转化为「本轮必选其一」的决策，存在**议题覆盖缺口**。
- **T7 aggregateByBranch**：RunScoreRecord 当前无 `branch` 字段，需从 source_path 解析；source_path 格式是否含 branch 未在 RUN_ID_CONVENTION 或 T7 中说明。
- **T8**：「完整 run」定义为「含 spec+plan+gaps+tasks+implement 至少 3 个 stage」，与 Party-Mode 共识「5 阶段」不完全一致；若仅 3 个 stage 即算完整，边界明确，但需与议题 4 表述对齐。

### 8. 可追溯性

- §1 需求追溯表：REQ-1～REQ-6 与任务映射完整 ✓
- §2 议题映射：6 议题与任务对应 ✓

---

## 二、批判审计员结论（强制，占比 >70%）

### 2.1 对抗性逐项检查

#### GAP-CA-1：修改路径「项目内 vs 全局」歧义（高）

- **现象**：T1、T2、T3、T5 修改路径为 `C:\Users\milom\.cursor\skills\bmad-story-assistant\SKILL.md`，为**绝对路径**且指向**全局 Cursor 技能目录**。
- **问题**：项目 workspace 内存在 `skills/bmad-story-assistant/SKILL.md`。TASKS 未说明应修改项目内拷贝还是全局技能。若修改全局，则：
  - 不同 worktree、不同机器无法共享此次修改；
  - 项目 git 无法追踪变更；
  - 与 speckit-workflow、bmad-code-reviewer-lifecycle 等「项目内 skills」的协同方式不明。
- **批判审计员**：路径看似精确到文件，实为**伪明确**——实施者无法在「项目内」与「全局」间做出无歧义选择。
- **修改建议**：明确写「修改项目内 `skills/bmad-story-assistant/SKILL.md`（若存在），否则修改 `~/.cursor/skills/bmad-story-assistant/SKILL.md`」，并说明项目内优先的理由（git 可追踪、worktree 共享）。

#### GAP-CA-2：T2 插入位置无唯一锚点（中）

- **现象**：T2 修改位置为「STORY-A4-POSTAUDIT 模板内，审计通过结论输出格式段」。
- **问题**：bmad-story-assistant SKILL 中 STORY-A4-POSTAUDIT 可能为引用型模板（如「见本 skill 历史版本或 speckit-workflow references」），具体段落无行号、无唯一字符串锚点。实施时易产生「插在何处」的歧义。
- **修改建议**：补充至少一处可 grep 的唯一锚点（如「审计通过后请将报告保存至」相邻的现有句子），或给出「在 … 之后插入」的明确前后文。

#### GAP-CA-3：T6 修改路径二选一未定且 yaml 不适合作「章节」（中）

- **现象**：T6 修改路径为「`docs/BMAD/审计报告格式与解析约定.md` 或 `config/eval-lifecycle-report-paths.yaml`」，具体修改为「补充『Story 完成自检』章节」。
- **问题**：
  1. 二选一未定，实施时可产生分歧；
  2. `eval-lifecycle-report-paths.yaml` 为结构化配置，无「章节」概念，不适合作「补充章节」的目标文档；
  3. 若选 markdown 文档，则 yaml 作为备选不合理。
- **修改建议**：明确选 `docs/BMAD/审计报告格式与解析约定.md` 作为主修改目标；若需在 yaml 中增加配置项，单独列出「在 config/eval-lifecycle-report-paths.yaml 中新增 story_completion_check 相关配置」（若有），而非与「章节」混为一谈。

#### GAP-CA-4：T10 报告路径不完整、speckit-workflow 路径歧义（中）

- **现象**：T10 要求补充 implement 阶段的「报告路径 `AUDIT_implement-E{epic}-S{story}.md`」。
- **问题**：仅给出文件名，未给出完整路径。`config/eval-lifecycle-report-paths.yaml` 中 implement 约定为  
  `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md`。  
  T10 应与该约定一致，否则实施后 parse-and-write-score 无法按约定路径找到报告。
- **路径歧义**：T10 修改路径为「speckit-workflow SKILL（或项目内 speckit-workflow 引用路径）」——再次出现项目内 vs 全局歧义，同 GAP-CA-1。
- **修改建议**：在 T10 中写出 implement 阶段的**完整**报告路径（与 eval-lifecycle-report-paths 一致），并明确修改项目内 `skills/speckit-workflow/SKILL.md`（若存在）。

#### GAP-CA-5：T4 短期/中期二选一未定，议题 5 覆盖不完整（高）

- **现象**：T4 描述短期与中期两套方案，验收标准为「若采用短期」与「若采用中期」二选一，但**未指定本轮实施选哪种**。
- **问题**：实施者无法判断应实现短期（trigger_stage 字段）还是中期（stage=implement）。议题 5 共识为「短期加 trigger_stage；中期扩展 implement」，若 T4 标「可延后」且不选方案，则议题 5 的「短期」共识在本轮 TASKS 中**未被转化为可执行任务**。
- **批判审计员**：T4 的「可延后」与「短期/中期二选一」叠加，导致该任务在本轮**不可验收**。
- **修改建议**：明确「本轮采用短期方案」，并将「在 record 中写入可选 trigger_stage」拆为具体子任务；或明确「T4 本轮不实施」，并在需求追溯表中将 REQ-5 标为「延后」。

#### GAP-CA-6：T8、T9 验收标准「正确」无量化（中）

- **现象**：T8 验收「有数据时输出正确的总分与四维」；T9 验收「仪表盘输出含跨 run 聚合的短板信息」。
- **问题**：「正确」无断言规则；「含」可 grep 验证，但短板计算逻辑的正确性（如取最低分、Top 3 排序）需单测或示例数据断言，验收未要求。
- **修改建议**：T8 补充「对已知 fixture（如 3 条 record，预期总分 X）执行 dashboard-generate，断言输出总分与四维与预期一致」；T9 补充「单测覆盖 getWeakTop3 按 epic/story 聚合后的最低分逻辑」，或验收命令中给出示例输入与预期输出。

#### GAP-CA-7：T7 aggregateByBranch 的 branch 来源未定义（中）

- **现象**：T7 要求「若 record 含 branch 或可从 source_path 解析 branch，按 branch 分组」。
- **问题**：RunScoreRecord 和 run-score-schema 当前**无** branch 字段；source_path 约定（RUN_ID_CONVENTION §3）为 `epic-{N}-*/story-{N}-*`、`story-{epic}-{story}-*` 等，未说明 branch 的解析规则。
- **批判审计员**：aggregateByBranch 的「branch」从何而来？若无法从现有字段解析，则该函数在本轮**无法实现**；若可解析，须在 T7 或 RUN_ID_CONVENTION 中定义规则。
- **修改建议**：在 T7 中明确 branch 的解析规则（如从 source_path 的某段解析，或从 run_id 的某段解析），或标注「branch 策略依赖 run_id/source_path 扩展，本轮不实现 aggregateByBranch，仅实现 aggregateByEpicStoryTimeWindow」。

#### GAP-CA-8：T5 依赖 T4 延后的影响未说明（低）

- **现象**：T5 依赖 T3、T4。T4 标「可延后」。
- **问题**：T5 的「自动补跑」需调用 parse-and-write-score；若 T4 未实施，补跑时无法传入 trigger_stage，对「区分 implement 与 tasks」无影响，补跑本身可执行。但 T5 未说明「T4 延后时，补跑脚本是否需特殊处理」。
- **修改建议**：在 T5 依赖或具体修改中加一句「若 T4 未实施，补跑时使用 stage=tasks、triggerStage=bmad_story_stage4，与现有逻辑一致」。

#### GAP-CA-9：议题 3「可选自动补跑」触发条件未定义（低）

- **现象**：议题 3 共识为「若无记录则提醒或可选自动补跑」。
- **问题**：T5 复述了该共识，但未定义「可选」的决策逻辑——何时仅提醒、何时自动补跑？用户可配置？还是 Agent 根据 reportPath 是否存在决定？
- **修改建议**：在 T5 具体修改中补充「默认仅提醒；若主 Agent 判断报告路径存在且可构造，则执行补跑；否则仅输出提醒」或等效决策规则。

### 2.2 伪明确与遗漏汇总

| 类型 | 项 |
|------|-----|
| 伪明确 | GAP-CA-1 路径歧义；GAP-CA-2 锚点缺失；GAP-CA-4 路径不完整 |
| 可执行性不足 | GAP-CA-3 二选一未定；GAP-CA-5 方案未选；GAP-CA-6 验收无量化 |
| 实施前置未定义 | GAP-CA-7 branch 来源；GAP-CA-8 依赖延后说明；GAP-CA-9 补跑触发条件 |

### 2.3 批判审计员最终判定

经逐项对抗性检查，**本轮存在 gap，不计数**。

**GAP 清单**（按优先级）：

1. **GAP-CA-1**（高）：T1、T2、T3、T5、T10 修改路径存在「项目内 vs 全局」歧义，路径伪明确。
2. **GAP-CA-5**（高）：T4 短期/中期未选，议题 5 本轮覆盖不完整，任务不可验收。
3. **GAP-CA-2**（中）：T2 插入位置无唯一锚点。
4. **GAP-CA-3**（中）：T6 二选一路径未定，yaml 不适合作「章节」。
5. **GAP-CA-4**（中）：T10 implement 报告路径不完整，speckit-workflow 路径歧义。
6. **GAP-CA-6**（中）：T8、T9 验收「正确」无量化。
7. **GAP-CA-7**（中）：T7 aggregateByBranch 的 branch 来源未定义。
8. **GAP-CA-8**（低）：T5 依赖 T4 延后未说明。
9. **GAP-CA-9**（低）：议题 3 补跑触发条件未定义。

---

## 三、审计结论

### 结论：**未通过**

**本轮存在 gap，不计数**。建议累计至 **3 轮无 gap** 后收敛。

### 修改建议优先级

1. **必改**：GAP-CA-1、GAP-CA-5
2. **建议改**：GAP-CA-2、GAP-CA-3、GAP-CA-4、GAP-CA-6、GAP-CA-7
3. **可选**：GAP-CA-8、GAP-CA-9

### 下一轮审计重点

- 修改路径统一为「项目内优先」或给出明确选用规则；
- T4 明确本轮方案（短期/中期/不实施）；
- T2、T6、T10 补充锚点、路径与验收量化；
- T7 明确 branch 策略或标注延后。

---

*本报告由 audit-prompts §5 精神执行，批判审计员结论占比 >70%。*
