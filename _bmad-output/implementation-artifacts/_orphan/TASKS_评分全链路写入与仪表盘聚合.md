# TASKS：评分全链路写入与仪表盘聚合

**产出日期**：2026-03-06  
**议题来源**：Party-Mode 100 轮辩论（批判审计员发言占比 >61%，最后 3 轮无新 gap 收敛）  
**路径**：`_bmad-output/implementation-artifacts/_orphan/TASKS_评分全链路写入与仪表盘聚合.md`

**修订记录**：
- v1.1（2026-03-06）：按第 1 轮审计报告（AUDIT_TASKS_评分全链路写入与仪表盘聚合_第1轮.md）修订 GAP-CA-1～GAP-CA-9
- v1.2（2026-03-06）：新增 T12（audit-prompts §1/§2/§3/§5 可解析评分块强制要求），解决审计后不显示评级问题
- v1.2.1（2026-03-06）：按 GAP-T12-1 修订 T12 验收标准，增加唯一锚点【§N 可解析块要求】使验收可独立执行

---

## §1 需求追溯表

| 需求 ID | 描述 | 来源议题 | 对应任务 |
|---------|------|----------|----------|
| REQ-1 | bmad-story-assistant 阶段四审计通过后显式插入 parse-and-write-score 步骤 | 议题 1 | T1, T2 |
| REQ-2 | 主 Agent 收到审计通过结论后自动检查报告路径并执行 parse-and-write-score | 议题 2 | T3, T4 |
| REQ-3 | Story 完成时检查 scoring/data/ 是否已写入对应 run_id/Story 记录 | 议题 3 | T5, T6 |
| REQ-4 | 按时间窗口或 branch 聚合多个 stage，计算总分和四维 | 议题 4 | T7, T8, T9 |
| REQ-5 | speckit 全流程各 stage 评分写入；implement 是否需 support stage=implement | 议题 5 | T10, T11 |
| REQ-6 | 按同一 epic/story 跨 run 聚合，计算总分和短板 | 议题 6 | T8, T9 |
| REQ-7 | 各阶段审计报告包含可解析评分块，否则 parseAndWriteScore 无法解析、仪表盘无法显示评级 | 议题 5 延伸 | T12 |

---

## §2 与 6 个议题的映射

| 议题 | 核心结论 | 相关任务 |
|------|----------|----------|
| **1. bmad-story-assistant 显式步骤** | 在阶段四「审计通过后」段落中新增「步骤 4.2：运行 parse-and-write-score」强制子步骤，含完整 CLI 调用示例与报告路径模板 | T1, T2 |
| **2. 自动化调用** | 主 Agent 在收到审计子任务返回且结论含「通过」时，解析 reportPath（优先从 prompt 约定路径、次从子任务输出提取），执行 parse-and-write-score；边界：reportPath 不存在则 non_blocking 记录，不阻断流程 | T3, T4 |
| **3. 流程收尾自检** | Story 完成时检查 scoring/data/ 下是否存在与当前 epic-story 对应的记录（按 run_id 模式或 epic/story 解析）；若无则提醒或自动补跑；检查逻辑在阶段四通过后、提供完成选项前执行 | T5, T6 |
| **4. 聚合逻辑调整** | 不再仅按「最新 run」聚合；新增「按时间窗口」和「按 branch」两种聚合策略；同一 Story 的 spec+plan+gaps+tasks+implement 组合为一次「完整 run」；数据结构扩展 run_group_id 或使用 (epic, story, branch, time_window) 作为聚合键 | T7, T8, T9 |
| **5. 全链路写入与 implement stage** | 确保 speckit 全流程 5 阶段均写入；当前 implement 用 stage=tasks 写入的利弊：利为复用 tasks 解析器、避免 schema 扩展；弊为仪表盘无法区分 tasks 审计与 implement 审计。**共识**：短期保留 stage=tasks，在 record 中新增可选字段 `trigger_stage: speckit_5_2` 区分；中期可扩展 AuditStage 支持 `implement`，需配套 implement 专用解析规则。**延伸**：各阶段审计报告必须含可解析评分块，否则 parseAndWriteScore 解析失败、仪表盘不显示 | T10, T11, T12 |
| **6. 跨 run 聚合** | 与议题 4 衔接：按 epic/story 聚合该 Story 下所有 stage 记录，计算总分和短板；优先级与议题 4 并列，实施时一并完成 | T8, T9 |

---

## §3 实施顺序建议

```
Phase 1（写入链路增强）: T1 → T2 → T3 → T4 → T12 → T10 → T11
Phase 2（收尾自检）:     T5 → T6
Phase 3（聚合与仪表盘）: T7 → T8 → T9
```

- **T1, T2** 为 bmad-story-assistant 流程修改，无技术依赖。  
- **T3, T4** 依赖 T2 的步骤约定（报告路径、CLI 参数）。  
- **T12** 须在 T10 前完成：各阶段报告若无可解析块，parse-and-write-score 解析失败，T10 的调用无效。  
- **T5, T6** 依赖 T3/T4 的自动化逻辑，用于校验与补跑。  
- **T7, T8, T9** 可并行于 Phase 1 开发，但验收需 Phase 1 产出数据。

---

## §4 任务列表

### T1：bmad-story-assistant 阶段四插入「parse-and-write-score」显式步骤

| 项 | 内容 |
|----|------|
| **修改路径** | 项目内 `skills/bmad-story-assistant/SKILL.md`（若存在）；否则 `~/.cursor/skills/bmad-story-assistant/SKILL.md`。**项目内优先**，理由：git 可追踪、worktree 共享。 |
| **修改位置** | 阶段四「审计结论处理」→「通过（A/B 级）」→「审计通过后评分写入触发」段落 |
| **具体修改** | 在现有「审计通过后评分写入触发」段落**之前**插入显式步骤 4.2，使其成为可执行 checklist： |
| **修改内容** | 见下方代码块 |
| **验收标准** | 1) SKILL.md 中含「步骤 4.2：运行 parse-and-write-score」；2) 含完整 CLI 示例；3) 含报告路径模板 `AUDIT_Story_{epic}-{story}_stage4.md` |
| **依赖** | 无 |

**插入内容**：

```markdown
#### 步骤 4.2：运行 parse-and-write-score（强制）

主 Agent 在收到实施后审计通过结论后，**必须**执行以下操作（与下方「审计通过后评分写入触发」一致）：

1. 确定报告路径：`{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage4.md`
2. 若报告文件存在，执行：
   ```bash
   npx ts-node scripts/parse-and-write-score.ts --reportPath <上述路径> --stage tasks --event story_status_change --triggerStage bmad_story_stage4 --epic {epic} --story {story} --artifactDocPath <story 文档路径> --iteration-count {本 stage 累计 fail 轮数，一次通过传 0}
   ```
3. 若调用失败，记录 resultCode 到审计证据，不阻断流程（non_blocking）。
```

---

### T2：bmad-story-assistant 审计子任务 prompt 中约定报告保存路径

| 项 | 内容 |
|----|------|
| **修改路径** | 项目内 `skills/bmad-story-assistant/SKILL.md`（若存在）；否则 `~/.cursor/skills/bmad-story-assistant/SKILL.md`。项目内优先。 |
| **修改位置** | STORY-A4-POSTAUDIT 模板内，**在「审计通过后请将报告保存至」或「报告结尾必须按以下格式输出」之后**插入；若不存在则新增独立句。锚点：grep `审计通过后请将报告保存至` 或 `AUDIT_Story_`。 |
| **具体修改** | 在审计 prompt 中增加要求：「审计通过后请将报告保存至 `{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage4.md`」 |
| **验收标准** | STORY-A4-POSTAUDIT 模板中含上述保存路径约定 |
| **依赖** | 无 |

---

### T3：主 Agent 收到审计通过后自动解析 reportPath

| 项 | 内容 |
|----|------|
| **修改路径** | 项目内 `skills/bmad-story-assistant/SKILL.md`（若存在）；否则 `~/.cursor/skills/bmad-story-assistant/SKILL.md`。项目内优先。 |
| **修改位置** | 阶段四「审计结论处理」→ 主 Agent 职责说明 |
| **具体修改** | 在流程描述中增加：主 Agent 在收到审计子任务返回且结论含「通过」时，从约定路径或子任务输出中解析 reportPath，若存在则执行 parse-and-write-score；若路径不存在，记录「SCORE_WRITE_SKIP_REPORT_MISSING」不阻断 |
| **验收标准** | SKILL 文档明确上述自动化逻辑及边界条件 |
| **依赖** | T1, T2 |

---

### T4：parse-and-write-score 支持 implement 阶段区分（短期方案，本轮实施）

| 项 | 内容 |
|----|------|
| **修改路径** | `scoring/writer/types.ts`、`scoring/schema/run-score-schema.json`、`scoring/orchestrator/parse-and-write.ts`、`scripts/parse-and-write-score.ts` |
| **具体修改** | **本轮采用短期方案**：对 implement 阶段（triggerStage=speckit_5_2）保持传入 `--stage tasks`，但在 record 写入时新增可选字段 `trigger_stage: string`。1) RunScoreRecord 类型新增 `trigger_stage?: string`；2) run-score-schema.json 扩展 schema；3) parse-and-write 在 options 中支持 `triggerStage`，写入时传入；4) parse-and-write-score CLI 新增 `--triggerStage` 参数，speckit_5_2 时传入。 |
| **验收标准** | 1) `npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage tasks --triggerStage speckit_5_2 ...` 执行后，scoring/data 下 record 含 `trigger_stage: "speckit_5_2"`；2) 单测覆盖 trigger_stage 写入 |
| **依赖** | 无 |
| **注** | 中期扩展 stage=implement 由后续 Story 负责，本轮不实施 |

---

### T5：Story 完成时检查 scoring/data/ 是否已写入

| 项 | 内容 |
|----|------|
| **修改路径** | 项目内 `skills/bmad-story-assistant/SKILL.md`（若存在）；新建 `scripts/check-story-score-written.ts` |
| **具体修改** | 1) 新建脚本 `scripts/check-story-score-written.ts --epic N --story N [--dataPath path]`：检查 scoring/data 下是否存在与 epic/story 匹配的记录（parseEpicStoryFromRecord 或 run_id 正则 `dev-e{N}-s{N}-`）；2) 在 bmad-story-assistant 阶段四通过后、提供完成选项前，主 Agent 执行该检查；3) **补跑决策**：默认仅提醒；若主 Agent 判断报告路径存在（`AUDIT_Story_{epic}-{story}_stage4.md`）且可构造，则执行 parse-and-write-score 补跑；否则仅输出提醒；4) **T4 延后时**：补跑使用 stage=tasks、triggerStage=bmad_story_stage4，与现有逻辑一致 |
| **验收标准** | 1) `npx ts-node scripts/check-story-score-written.ts --epic 8 --story 1` 可运行，输出有/无记录；2) SKILL 流程中嵌入了检查步骤 |
| **依赖** | T3, T4 |

---

### T6：检查逻辑与路径约定文档化

| 项 | 内容 |
|----|------|
| **修改路径** | `docs/BMAD/审计报告格式与解析约定.md`（主修改目标；补充「Story 完成自检」章节） |
| **具体修改** | 在 `docs/BMAD/审计报告格式与解析约定.md` 中新增「Story 完成自检」章节，含：1) 检查逻辑（check-story-score-written 脚本、epic/story 匹配规则）；2) scoring/data 路径；3) run_id 与 epic/story 对应关系（正则 `dev-e{N}-s{N}-`）。若需 yaml 配置扩展，单独在 `config/eval-lifecycle-report-paths.yaml` 新增 `story_completion_check` 相关键（若有） |
| **验收标准** | 1) grep `Story 完成自检` docs/BMAD/审计报告格式与解析约定.md 有匹配；2) 该章节含上述三项内容 |
| **依赖** | T5 |

---

### T7：聚合逻辑：按时间窗口与 epic/story 聚合

| 项 | 内容 |
|----|------|
| **修改路径** | `scoring/dashboard/compute.ts`、`scoring/query/loader.ts` |
| **具体修改** | 1) 新增 `aggregateByEpicStoryTimeWindow(records, epic, story, windowHours)`：筛选 epic/story 匹配的记录（parseEpicStoryFromRecord），按 timestamp 在 windowHours 内的为一组；2) **aggregateByBranch 本轮不实现**：RunScoreRecord 无 branch 字段，source_path 未约定 branch 解析规则；若后续扩展则单独开任务；3) 新增 `getLatestRunRecordsV2(options: { strategy: 'run_id' | 'epic_story_window'; epic?: number; story?: number; windowHours?: number })`，strategy=epic_story_window 时调用 aggregateByEpicStoryTimeWindow |
| **验收标准** | 1) 单测覆盖 aggregateByEpicStoryTimeWindow；2) getLatestRunRecordsV2(strategy: 'epic_story_window', epic: 8, story: 1, windowHours: 24) 返回预期 record 子集 |
| **依赖** | 无 |

**数据结构扩展（可选）**：

```typescript
// 若需显式 run_group_id，在 RunScoreRecord 中新增可选字段
interface RunScoreRecord {
  // ...existing
  run_group_id?: string;  // 如 dev-e4-s1-1730812345，同一 Story 的多 stage 共享
}
```

---

### T8：仪表盘按 epic/story 聚合计算总分与四维

| 项 | 内容 |
|----|------|
| **修改路径** | `scripts/dashboard-generate.ts`、`scoring/dashboard/compute.ts` |
| **具体修改** | 1) dashboard-generate 支持 `--strategy epic_story_window`（默认）或 `--strategy run_id`；2) 默认策略：按 epic/story 分组，每组取时间窗口内（默认 24h）最新「完整 run」（含 spec+plan+gaps+tasks 至少 3 个 stage；implement 以 trigger_stage=speckit_5_2 或 stage=tasks 计入）；3) 若无完整 run，退化为按单 record 最新 timestamp 取可用的 stage 子集；4) **验收用例**：在 scoring/data 放置 3 条已知 fixture（如 dev-e8-s1-spec-*、dev-e8-s1-plan-*、dev-e8-s1-tasks-*，phase_score 分别为 80、90、92，phase_weight 各 0.2），执行 dashboard-generate，断言输出总分与四维与预期一致（加权平均可计算） |
| **验收标准** | 1) `npx ts-node scripts/dashboard-generate.ts --strategy epic_story_window` 可执行；2) 对已知 fixture 执行，断言总分与四维与预期值一致（允许 ±1 舍入误差） |
| **依赖** | T7 |

---

### T9：跨 run 聚合与短板计算

| 项 | 内容 |
|----|------|
| **修改路径** | `scoring/dashboard/compute.ts`、`scoring/dashboard/format.ts` |
| **具体修改** | 1) `getWeakTop3` 扩展为支持按 epic/story 聚合后计算：同一 Story 下各 stage 的 phase_score 取最低分作为该 Story 的短板得分，Top 3 按该得分升序；2) 仪表盘展示「按 Story 维度的短板 Top 3」；3) **验收用例**：单测覆盖 getWeakTop3 按 epic/story 聚合逻辑，给定 2 个 Story 各 3 个 stage，断言短板排序与最低分一致 |
| **验收标准** | 1) 单测覆盖 getWeakTop3 按 epic/story 聚合后的最低分逻辑；2) 仪表盘输出含跨 run 聚合的短板信息（grep 可验证） |
| **依赖** | T8 |

---

### T10：speckit-workflow 各 stage 审计通过后强制 parse-and-write-score

| 项 | 内容 |
|----|------|
| **修改路径** | 项目内 `skills/speckit-workflow/SKILL.md`（若存在）；否则 `~/.cursor/skills/speckit-workflow/SKILL.md`。项目内优先。 |
| **具体修改** | 确认 §1.2～§5.2 各「审计通过后评分写入触发」段落均含：1) 报告保存路径；2) parse-and-write-score 完整调用示例（含 --iteration-count）；3) 子代理/主 Agent 执行责任划分。**implement 阶段（§5.2）**：完整报告路径为 `{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md`（与 config/eval-lifecycle-report-paths.yaml 一致）；triggerStage=speckit_5_2；stage=tasks |
| **验收标准** | 1) grep `AUDIT_implement`、`speckit_5_2`、`parse-and-write-score` skills/speckit-workflow/SKILL.md 各有匹配；2) §1.2～§5.2 五处触发段落结构一致（含路径、CLI 示例、责任划分） |
| **依赖** | 无 |

---

### T11：run_id 共享策略（同一 Story 多 stage 聚合）

| 项 | 内容 |
|----|------|
| **修改路径** | `scripts/parse-and-write-score.ts`、`scoring/docs/RUN_ID_CONVENTION.md` |
| **具体修改** | 1) 新增 `--runGroupId` 参数：若传入，所有 stage 写入时使用同一 run_group_id 作为聚合键；2) 或约定：同一 Dev Story 流程内，runId 使用 `dev-e{epic}-s{story}-{ts}` 格式（不含 stage），由调用方在同一 session 内传入相同 ts；3) RUN_ID_CONVENTION 补充「同一 Story 多 stage 共享 run_id 的约定」 |
| **验收标准** | 1) 文档更新；2) 可选 --runGroupId 或等效机制可用 |
| **依赖** | T7（与聚合逻辑衔接） |

---

### T12：audit-prompts §1、§2、§3、§5 增加「可解析评分块」强制要求

| 项 | 内容 |
|----|------|
| **修改路径** | 项目内 `skills/speckit-workflow/references/audit-prompts.md`（若存在）；否则 `~/.cursor/skills/speckit-workflow/references/audit-prompts.md`。项目内优先。 |
| **修改位置** | §1、§2、§3、§5 各阶段的 prompt 块内 |
| **具体修改** | 在 §1（spec）、§2（plan）、§3（GAPS）、§5（执行阶段）各阶段的 prompt 中，在「报告结尾必须明确给出结论」相关表述之后，增加：**「报告结尾必须包含 §4.1 规定的可解析评分块（总体评级 + 维度评分），与 tasks 阶段一致，否则 parseAndWriteScore 无法解析、仪表盘无法显示评级。」** 为便于验收，在每处插入的句首或句尾增加**唯一锚点**：`【§1 可解析块要求】`、`【§2 可解析块要求】`、`【§3 可解析块要求】`、`【§5 可解析块要求】`（分别对应 spec、plan、GAPS、执行阶段）。 |
| **验收标准** | 1) `grep -c '【§1 可解析块要求】' audit-prompts.md` 为 1；2) `grep -c '【§2 可解析块要求】' audit-prompts.md` 为 1；3) `grep -c '【§3 可解析块要求】' audit-prompts.md` 为 1；4) `grep -c '【§5 可解析块要求】' audit-prompts.md` 为 1；5) 五阶段（spec/plan/GAPS/tasks/执行）的 prompt 均要求报告结尾含可解析块（§4 已有，§1/§2/§3/§5 通过上述锚点落实） |
| **依赖** | 无 |
| **实施阶段** | Phase 1，须在 T10 前完成；否则各阶段调用 parse-and-write-score 时报告无块，解析失败 |

---

## §5 Party-Mode 辩论摘要（批判审计员主导）

**轮次分布**：总 100 轮，批判审计员发言 62 轮。

**议题 1 关键质疑与共识**：
- 批判审计员：流程中若仅写「须运行 parse-and-write-score」而无显式步骤编号，主 Agent 易忽略。→ 共识：必须插入步骤 4.2，与现有「审计通过后评分写入触发」并列，形成可执行 checklist。
- 批判审计员：CLI 示例若缺 --iteration-count，迭代因子无法传递。→ 共识：示例必须含 --iteration-count。

**议题 2 关键质疑与共识**：
- 批判审计员：自动化依赖 reportPath 从哪来？子任务输出是否结构化？→ 共识：优先从约定路径（T2）推断；子任务 prompt 要求保存至约定路径；若不存在则 non_blocking。
- 批判审计员：reportPath 推断失败时是否阻断？→ 共识：不阻断，记录 resultCode 供后续排查。

**议题 3 关键质疑与共识**：
- 批判审计员：检查逻辑的「对应 run_id/Story」如何定义？run_id 当前含 stage+ts，同 Story 多 stage 有不同 run_id。→ 共识：按 epic/story 解析（parseEpicStoryFromRecord 或 run_id 正则），存在任一条即视为已写入。
- 批判审计员：自动补跑时 reportPath 从哪来？→ 共识：从约定路径模板构造；若报告不存在则仅提醒，不自动生成报告。

**议题 4 关键质疑与共识**：
- 批判审计员：按「最新 run」聚合时，run_id 每写唯一，导致每组仅一条 record，仪表盘无法反映完整 Story 的多 stage。→ 共识：必须引入 run_group 或 (epic, story, time_window) 聚合键。
- 批判审计员：时间窗口取多大？→ 共识：默认 24h，可配置；同一 Story 的 spec→plan→gaps→tasks→implement 通常在数小时内完成。

**议题 5 关键质疑与共识**：
- 批判审计员：implement 用 stage=tasks 写入，仪表盘无法区分「tasks 审计」与「implement 审计」。→ 共识：短期加 trigger_stage 字段；中期扩展 stage=implement。
- Winston：implement 与 tasks 审计报告格式相同（audit-prompts §5），解析器复用合理。→ 共识：保留解析复用，区分通过 stage 字段或 trigger_stage。

**议题 6 关键质疑与共识**：
- 批判审计员：跨 run 聚合与议题 4 的「按 time_window 聚合」是否重复？→ 共识：不重复；议题 4 定义聚合键，议题 6 定义聚合后的计算（总分、短板）；实施合并为 T8、T9。

**最后 3 轮无新 gap**：第 98、99、100 轮均为确认与收敛陈述，无新增质疑。

---

## §6 附录：与 bmad-code-reviewer-lifecycle 的协同

本 TASKS 与 `bmad-code-reviewer-lifecycle` SKILL 的引用关系：

- bmad-code-reviewer-lifecycle 定义「stage 审计通过后调用解析并写入」的触发时机。
- 本 TASKS 的 T1～T6 细化 bmad-story-assistant 流程中的具体步骤与自检。
- 本 TASKS 的 T7～T9 扩展 dashboard 的聚合逻辑，与 bmad-code-reviewer-lifecycle 产出的数据消费端衔接。
- T10 确保 speckit-workflow 与 bmad-code-reviewer-lifecycle 的 stage 映射一致。
- T12 确保 audit-prompts 五阶段均要求可解析评分块，解决审计后不显示评级问题。
