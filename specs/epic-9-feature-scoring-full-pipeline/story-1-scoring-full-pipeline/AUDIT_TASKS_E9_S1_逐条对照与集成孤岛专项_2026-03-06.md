# tasks-E9-S1.md 审计报告：逐条对照与集成/孤岛专项

**审计日期**：2026-03-06  
**待审计文件**：`specs/epic-9/story-1-scoring-full-pipeline/tasks-E9-S1.md`  
**参考文档**：spec-E9-S1.md、plan-E9-S1.md、IMPLEMENTATION_GAPS-E9-S1.md、Story 9.1、TASKS_评分全链路写入与仪表盘聚合.md  
**审计角色**：批判审计员（占比 ≥ 50%）  

---

## §1 任务编号与需求文档映射（批判审计员分析）

### 1.1 编号体系不一致性

**spec / plan / Story 9.1** 使用：T1–T9、T11（T10、T12 已在 Phase 0 完成）。

**tasks-E9-S1** 使用：T1–T12，且 Phase 划分与 spec 不同：

| tasks-E9-S1 | spec/plan 对应 | 说明 |
|-------------|----------------|------|
| T1–T4 | T1–T4 | 一致 |
| T5 | T11 | run_id 共享；tasks 将其置于 Phase 1 |
| T6 | T5 | check-story-score-written 脚本 |
| T7 | T5（嵌入部分） | bmad-story-assistant 嵌入检查步骤 |
| T8 | T6 | Story 完成自检文档 |
| T9 | T7 | aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2 |
| T10 | T8 | dashboard-generate --strategy |
| T11 | T8（验收 fixture） | 独立为单独任务 |
| T12 | T9 | getWeakTop3 扩展 |

**批判审计员结论**：tasks 重新编排了 Phase 与任务编号，但追溯表（§1、§2）通过章节引用建立了映射。**可接受**，但实施时需以 tasks 为主、spec/plan 为对照，避免编号混淆。

---

## §2 逐条对照：tasks ↔ spec / plan / IMPLEMENTATION_GAPS

### 2.1 spec 章节覆盖

| spec 章节 | 需求要点 | tasks 对应 | 覆盖状态 |
|-----------|----------|------------|----------|
| §3.1.1 | 步骤 4.2、CLI 含 --triggerStage bmad_story_stage4、--iteration-count、路径模板 | T1 | ✅ |
| §3.1.2 | STORY-A4-POSTAUDIT 报告保存路径 | T2 | ✅ |
| §3.2.1 | reportPath 解析、SCORE_WRITE_SKIP_REPORT_MISSING | T3 | ✅ |
| §3.2.2 | trigger_stage、schema、CLI、单测 | T4、T4b | ✅ |
| §3.2.3 | run_id 共享、--runGroupId、RUN_ID_CONVENTION | T5 | ✅ |
| §3.3.1 | check-story-score-written、嵌入、补跑参数 | T6、T7 | ✅ |
| §3.3.2 | Story 完成自检文档 | T8 | ✅ |
| §3.4.1 | aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2 | T9 | ✅ |
| §3.4.2 | dashboard-generate --strategy、完整 run、退化逻辑、fixture | T10、T11 | ✅ |
| §3.4.3 | getWeakTop3 按 epic/story、仪表盘含短板 | T12 | ✅ |

**结论**：spec 全部章节有对应任务，**完全覆盖**。

### 2.2 plan 章节覆盖

| plan 章节 | 要点 | tasks 对应 | 覆盖状态 |
|-----------|------|------------|----------|
| Phase 1.1 | T1–T3 SKILL 修改 | T1–T3 | ✅ |
| Phase 1.2 | T4 trigger_stage、T11 run_id | T4、T4b、T5 | ✅ |
| Phase 2 | T5 脚本、T6 文档 | T6、T7、T8 | ✅ |
| Phase 3 | T7 聚合、T8 仪表盘、T9 短板 | T9、T10、T11、T12 | ✅ |
| §4 集成测试计划 | parse-and-write、check-story、dashboard、生产路径验证 | §3 集成测试表、§4 验收表 | ⚠️ 见 §4 专项 |
| §4.4 | getLatestRunRecordsV2 接入验证、grep dashboard-generate | §3 仅写「grep dashboard-generate 调用 getLatestRunRecordsV2」 | ⚠️ 见 §4.2 |

**结论**：plan 实施分期与验收命令均有映射；**§4.4 生产路径验证**在 tasks 中有表述但未在验收表中逐项可执行化。

### 2.3 IMPLEMENTATION_GAPS 覆盖

| Gap ID | 需求要点 | tasks 对应 | 覆盖状态 |
|--------|----------|------------|----------|
| GAP-1.1a～1.1c | 步骤 4.2、CLI、路径模板 | T1 | ✅ |
| GAP-1.2 | STORY-A4-POSTAUDIT 路径 | T2 | ✅ |
| GAP-1.3 | reportPath 解析、SCORE_WRITE_SKIP | T3 | ✅ |
| GAP-2.1～2.3 | trigger_stage 类型、schema、透传 | T4 | ✅ |
| GAP-2.3b | trigger_stage 单测 | T4b | ✅ |
| GAP-2.4 | run_id 共享、--runGroupId | T5 | ✅ |
| GAP-3.1 | check-story-score-written.ts | T6 | ✅ |
| GAP-3.2 | SKILL 嵌入检查 | T7 | ✅ |
| GAP-3.3 | Story 完成自检文档 | T8 | ✅ |
| GAP-4.1～4.2 | aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2 | T9 | ✅ |
| GAP-4.3～4.4 | dashboard --strategy、fixture | T10、T11 | ✅ |
| GAP-4.5～4.6 | getWeakTop3 扩展、跨 run 短板 | T12 | ✅ |

**结论**：IMPLEMENTATION_GAPS 全部 Gap 有对应任务，**完全覆盖**。

---

## §3 专项审查一：集成测试与 E2E 任务覆盖

### 3.1 每个 Phase 是否包含集成/E2E 测试任务

| Phase | 任务 | 集成/E2E 计划 | 批判审计员判定 |
|-------|------|---------------|----------------|
| Phase 1 | T1–T5 | T1–T3：grep 验收（文档级）；T4/T4b：CLI 执行 + 单测 | ❌ **T1–T3 无集成/E2E**：仅 grep/doc 验收，无法验证 SKILL 流程实际触发 parse-and-write-score |
| Phase 2 | T6–T8 | T6：CLI 有/无数据；T7：SKILL 含检查步骤（doc）；T8：grep | ⚠️ **T7 无运行时验证**：仅有「SKILL 流程描述中含检查步骤」，无 E2E 验证 check-story-score-written 在生产流程中被执行 |
| Phase 3 | T9–T12 | T9：单测；T10/T11：dashboard-generate 对 fixture 断言；T12：单测 | ⚠️ **T10/T11 依赖 fixture 路径**：tasks 写 `scoring/data/__fixtures-dashboard-epic-story/` 或 `--dataPath`，但未明确 dashboard-generate 是否支持 --dataPath；若未支持，集成测试无法独立执行 |

### 3.2 tasks §3 集成测试表的完整性

tasks 第 123–132 行「3. 集成测试与 E2E 任务（必须）」表：

| 任务 | 测试类型 | 验收 | 缺口 |
|------|----------|------|------|
| T4/T4b | 单元+集成 | trigger_stage 写入、单测 assert | ✅ 充分 |
| T6 | 集成 | 有/无数据时 CLI 输出正确 | ✅ 充分 |
| T9 | 单元 | aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2 单测 | ⚠️ **缺集成**：getLatestRunRecordsV2 需在 dashboard-generate 中调用，单测仅验证函数本身，未验证生产入口接入 |
| T10/T11 | 集成 | dashboard-generate 对 fixture 断言 | ⚠️ **fixture 路径未定义**：`scoring/data/__fixtures-dashboard-epic-story/` 与 dashboard-generate 默认读取 `scoring/data` 的兼容性；--dataPath 是否必须未明确 |
| T12 | 单元 | getWeakTop3 按 epic/story 单测 | ✅ 充分 |
| §4.4 生产路径 | grep | dashboard-generate 调用 getLatestRunRecordsV2；SKILL 含 check 步骤 | ⚠️ **grep 验收未列入任务**：无独立任务要求「验收时 grep scripts/dashboard-generate.ts 确认 getLatestRunRecordsV2 被调用」 |

**批判审计员结论**：tasks 的集成测试表**不完整**。存在以下缺口：
1. T1–T3、T7 无集成/E2E；
2. T9 缺「dashboard-generate 调用 getLatestRunRecordsV2」的集成验证；
3. T10/T11 fixture 路径与 --dataPath 可执行性未在任务或验收中明确；
4. 生产路径验证（grep getLatestRunRecordsV2）未作为独立验收项写入任意任务的验收标准。

---

## §4 专项审查二：生产代码关键路径集成验证

### 4.1 各模块验收标准是否包含「在生产关键路径中被导入、实例化并调用」

| 模块 | 生产入口 | tasks 验收是否包含关键路径验证 | 判定 |
|------|----------|------------------------------|------|
| parse-and-write-score | bmad-story-assistant 步骤 4.2、speckit-workflow 各 stage | T1 验收：grep 步骤 4.2、bmad_story_stage4 | ⚠️ **仅文档**：未要求验证 CLI 在实际流程中被执行 |
| check-story-score-written | bmad-story-assistant 阶段四 | T7 验收：SKILL 流程描述中含检查步骤 | ❌ **仅文档**：无「该脚本在生产流程中被调用」的集成验证 |
| aggregateByEpicStoryTimeWindow | getLatestRunRecordsV2 → dashboard-generate | T9 验收：单测覆盖 | ❌ **缺生产路径**：单测不验证 dashboard-generate 是否调用 |
| getLatestRunRecordsV2 | scripts/dashboard-generate.ts | §3 表写「grep dashboard-generate 调用 getLatestRunRecordsV2」 | ⚠️ **未写入任务验收**：该验证未出现在 T10 或 T9 的验收标准中，易被遗漏 |
| getWeakTop3 扩展 | scripts/dashboard-generate.ts | T12 验收：单测+仪表盘输出含短板 | ⚠️ **仪表盘输出**可视为间接验证，但未显式要求「dashboard-generate 传入聚合后数据」 |
| dashboard-generate | /bmad-dashboard 或 Command | T10 验收：可执行 | ⚠️ **未要求** grep Command 定义或 import |

### 4.2 当前实现验证（孤岛风险佐证）

经 grep 核查：
- `scripts/dashboard-generate.ts` 当前使用 `getLatestRunRecords`，**未**使用 `getLatestRunRecordsV2`、`aggregateByEpicStoryTimeWindow`。
- 若实施 T9 后 compute.ts 实现完整，但 dashboard-generate.ts 未接入，则 **aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2 为孤岛模块**。

**批判审计员结论**：tasks 在 §3 表中提及「grep dashboard-generate 调用 getLatestRunRecordsV2」，但**未将该验收写入 T9 或 T10 的任务验收标准**。实施时存在「模块内部实现完整但从未在生产关键路径中被导入」的**孤岛风险**。

---

## §5 专项审查三：孤岛模块任务识别

### 5.1 潜在孤岛模块

| 模块 | 风险等级 | 说明 |
|------|----------|------|
| aggregateByEpicStoryTimeWindow | **高** | 仅在 compute.ts 内部被 getLatestRunRecordsV2 调用；若 dashboard-generate 不调用 getLatestRunRecordsV2，则永不进入生产路径 |
| getLatestRunRecordsV2 | **高** | 同上；dashboard-generate 当前使用 getLatestRunRecords |
| check-story-score-written | **高** | 唯一入口为 bmad-story-assistant SKILL；若 SKILL 未嵌入或 Agent 跳过，脚本永不执行 |
| getWeakTop3 扩展 | 中 | 仪表盘已调用 getWeakTop3；扩展后需确保传入聚合后数据，否则输出仍为单 run |

### 5.2 tasks 是否包含「防止孤岛」的验收任务

- **T10** 验收：「`npx ts-node scripts/dashboard-generate.ts --strategy epic_story_window` 可执行」——可执行不代表内部调用了 getLatestRunRecordsV2；若实现错误地继续使用 getLatestRunRecords，CLI 仍可运行。
- **§3 表** 写「grep dashboard-generate 调用 getLatestRunRecordsV2」——但**未列入 T10 或任何任务的验收标准**。

**结论**：**存在孤岛风险**。tasks 未将「dashboard-generate 在 strategy=epic_story_window 时调用 getLatestRunRecordsV2」作为 T10 的**强制验收项**。

---

## §6 跨 artifact 一致性分析（tasks≥10）

### 6.1 spec ↔ tasks 一致性

| 一致性项 | 状态 |
|----------|------|
| 需求章节覆盖 | ✅ spec §3.1–§3.4 全部有任务对应 |
| 成功标准（spec §4） | ⚠️ tasks 未显式列出 spec §4 五条成功标准的逐条验收映射 |
| 涉及源文件 | ✅ 与 spec §5 一致 |

### 6.2 plan ↔ tasks 一致性

| 一致性项 | 状态 |
|----------|------|
| Phase 分期 | ✅ tasks Phase 1–3 与 plan 对应（编号重排） |
| 集成测试计划 | ⚠️ plan §4.4「getLatestRunRecordsV2 接入验证」在 tasks §3 有提及，但未写入任务验收 |
| fixture 路径 | ⚠️ plan 写「scoring/data 或 --dataPath」；tasks T11 写「scoring/data/__fixtures-dashboard-epic-story/ 或 --dataPath」——两者一致，但 --dataPath 是否实现未在 plan/tasks 中强制 |

### 6.3 IMPLEMENTATION_GAPS ↔ tasks 一致性

| 一致性项 | 状态 |
|----------|------|
| Gap 逐条映射 | ✅ 全部 Gap 有任务 |
| Gaps §3 plan §4 测试项 | ⚠️ Gaps 指出的「§4.4 生产路径验证、getLatestRunRecordsV2 调用验证」未实现——tasks 有提及但未列入强制验收 |

---

## §7 批判审计员段落（≥50%）

### 7.1 覆盖完整性批判

tasks-E9-S1 在需求追溯表（§1）与 Gaps 映射（§2）上对 spec、plan、IMPLEMENTATION_GAPS 做了章节级映射，**主体覆盖完整**。但存在 **3 处实质缺口**：

1. **生产路径验收未任务化**：plan §4.4 与 AUDIT_PLAN 均要求验收「dashboard-generate 在 strategy=epic_story_window 时调用 getLatestRunRecordsV2」。tasks §3 表中有「grep dashboard-generate 调用 getLatestRunRecordsV2」表述，但**未写入 T9 或 T10 的验收标准**。实施与验收时易被忽略，导致孤岛模块。

2. **T1–T3、T7 无集成/E2E**：bmad-story-assistant 与 check-story-score-written 的验收仅依赖 grep/doc，无任何运行时验证。若 SKILL 描述含糊或 Agent 未执行，生产流程中永远不会触发 parse-and-write-score 或 check-story-score-written。tasks 未要求最低可行的 E2E（如人工验收清单或脚本化流程模拟）。

3. **T10/T11 fixture 可执行性未强制**：tasks 写「scoring/data/__fixtures-dashboard-epic-story/ 或 dashboard-generate 新增 --dataPath」，但未在 T10 或 T11 的验收中明确：
   - 若使用 fixture 子目录：集成测试前如何注入、测试后如何清理；
   - 若使用 --dataPath：T10 是否必须实现该参数。

### 7.2 可测试性批判

tasks 的「3. 集成测试与 E2E 任务」表**不满足**「每个功能模块/Phase 包含集成测试与端到端功能测试」的要求：
- Phase 1 的 T1–T3 无集成/E2E；
- Phase 2 的 T7 无集成/E2E；
- Phase 3 的 T9 缺「生产入口调用 getLatestRunRecordsV2」的集成验证。

### 7.3 孤岛防控批判

tasks **未**在任一任务的验收标准中显式加入「该模块在生产代码关键路径中被导入、实例化并调用」的集成验证。§3 表虽有生产路径描述，但：
- 未作为 T9、T10 的强制验收项；
- 未在 §4 验收表头「集成测试要求」列中体现。

历史上（AUDIT_PLAN 指出）dashboard-generate 曾存在「compute 已实现、dashboard-generate 未调用」的情况。tasks 未从验收设计上防止该问题复发。

---

## §8 结论

### 8.1 完全覆盖、验证通过项

- spec §3.1–§3.4 所有章节有任务对应 ✅
- IMPLEMENTATION_GAPS 全部 Gap 有任务 ✅
- plan Phase 1–3 实施分期有映射 ✅
- T4/T4b、T6、T12 的单元/集成测试设计明确 ✅
- Gaps ↔ 任务映射表（§2）完整 ✅

### 8.2 未通过项（须修订 tasks 后重新审计）

| 序号 | 问题 | 建议修订 |
|------|------|----------|
| 1 | T9/T10 缺「dashboard-generate 调用 getLatestRunRecordsV2」强制验收 | 在 T10 验收标准中增加：「grep `getLatestRunRecordsV2` scripts/dashboard-generate.ts 有匹配；或单测/集成断言 strategy=epic_story_window 时数据来源为 getLatestRunRecordsV2」 |
| 2 | T1–T3、T7 无集成/E2E | 在 §3 表或对应任务中标注：T1–T3、T7 采用 grep/doc 验收为最低可行；若需 E2E，可补充「人工验收清单：模拟 Dev Story 阶段四通过后，确认 parse-and-write-score、check-story-score-written 被执行」 |
| 3 | T10/T11 fixture 可执行性未强制 | 在 T11 验收中明确：① dashboard-generate 支持 --dataPath 且集成测试使用该参数；或 ② fixture 置于 scoring/data 指定子目录，规定测试前复制、测试后清理 |
| 4 | §4 验收表「集成测试要求」列未包含生产路径验证 | 在 GAP-4.1～4.2、GAP-4.3～4.4 的「集成测试要求」中补充「dashboard-generate 调用 getLatestRunRecordsV2」 |

### 8.3 总体结论

**未完全通过。**

tasks-E9-S1 对 spec、plan、IMPLEMENTATION_GAPS 的**需求覆盖完整**，Gaps 逐条有任务。但在**可测试性**（T1–T3、T7 无集成/E2E）、**一致性**（生产路径验收未任务化）、**可追溯性**（孤岛防控验收缺位）三方面存在缺口。**不完全满足**「完全覆盖、验证通过」标准。

**建议**：按上表 4 项修订 tasks 后，重新发起审计。

---

## §9 可解析评分块

```markdown
## 可解析评分块

总体评级: C+

维度评分:
- 需求完整性: 92/100
- 可测试性: 68/100
- 一致性: 75/100
- 可追溯性: 70/100
```
