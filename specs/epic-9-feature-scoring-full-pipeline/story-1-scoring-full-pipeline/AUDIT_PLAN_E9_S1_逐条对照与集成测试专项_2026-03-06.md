# plan-E9-S1 审计报告：逐条对照与集成/端到端测试专项

**审计日期**：2026-03-06  
**待审计文件**：`specs/epic-9/story-1-scoring-full-pipeline/plan-E9-S1.md`  
**参考文档**：spec-E9-S1.md、Story 9.1（9-1-scoring-full-pipeline.md）、TASKS_评分全链路写入与仪表盘聚合.md  
**审计角色**：批判审计员（占比 ≥ 50%）  

---

## §1 逐条对照：plan.md 与原始需求文档

### 1.1 与 Story 9.1 的覆盖

| Story 章节 | 原始要点 | plan.md 对应 | 覆盖状态 |
|------------|----------|--------------|----------|
| Story 陈述 | bmad-story-assistant 阶段四、speckit-workflow 各 stage 审计通过后自动 parse-and-write-score；Story 完成自检；仪表盘按 epic/story 聚合 | Phase 1–3、§1 需求映射表 | ✅ |
| 实施范围 | T1–T9、T11（T10、T12 Phase 0） | plan §1 明确 Phase 0 排除 | ✅ |
| AC-1 | 阶段四插入 parse-and-write-score 显式步骤；含 CLI 示例、报告路径模板 | Phase 1.1 T1；含「步骤 4.2」、CLI 示例、路径模板 | ⚠️ **GAP-A** |
| AC-2 | STORY-A4-POSTAUDIT 约定报告保存路径 | Phase 1.1 T2 | ✅ |
| AC-3 | 主 Agent 解析 reportPath；reportPath 不存在记录 SCORE_WRITE_SKIP_REPORT_MISSING | Phase 1.1 T3 | ✅ |
| AC-4 | parse-and-write-score 支持 trigger_stage；record 含 speckit_5_2 | Phase 1.2 T4；§4.1 单测 record.trigger_stage | ✅ |
| AC-5 | check-story-score-written 可运行；SKILL 嵌入检查 | Phase 2 T5；§4.2 集成测试 | ✅ |
| AC-6 | 新增「Story 完成自检」章节 | Phase 2 T6 | ✅ |
| AC-7 | 聚合逻辑 aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2 | Phase 3.1 T7；§4.3 单测 | ✅ |
| AC-8 | dashboard-generate --strategy epic_story_window；fixture 断言总分与四维 | Phase 3.2 T8；§4.3 集成测试 | ⚠️ **GAP-B** |
| AC-9 | getWeakTop3 按 epic/story；仪表盘含短板 | Phase 3.3 T9；§4.3 | ✅ |
| AC-10 | run_id 共享；RUN_ID_CONVENTION 更新 | Phase 1.2 T11 | ✅ |
| Dev Notes 涉及源文件 | 各模块路径 | plan §5 模块与文件改动设计 | ✅ |
| Dev Notes 测试标准 | T4/T5/T7/T8/T9 验收 | plan §4 集成测试计划 | 部分 ⚠️ |

**GAP-A**：plan Phase 1.1 T1 要求「含完整 CLI 示例」，但未明确写出 **bmad-story-assistant 场景下应使用 `--triggerStage bmad_story_stage4`**。spec §3.1.1 与 TASKS T1 的代码块均写明 `--triggerStage bmad_story_stage4`。plan 仅在第 4.1 节示例中使用 `speckit_5_2`（implement 场景），易导致实施时 bmad-story-assistant 步骤 4.2 误用 triggerStage 值。

**GAP-B**：见 §2、§3。

---

### 1.2 与 TASKS 文档的覆盖

| TASKS 任务 | 要点 | plan 对应 | 覆盖状态 |
|------------|------|-----------|----------|
| T1 | 步骤 4.2、CLI 示例（含 --iteration-count）、报告路径模板、non_blocking | Phase 1.1 | ⚠️ plan 未显式写 --iteration-count、--triggerStage bmad_story_stage4 |
| T2 | STORY-A4-POSTAUDIT 路径约定 | Phase 1.1 T2 | ✅ |
| T3 | 主 Agent 解析 reportPath、边界 | Phase 1.1 T3 | ✅ |
| T4 | trigger_stage、schema、CLI、单测 | Phase 1.2 T4 | ✅ |
| T5 | check 脚本、嵌入、补跑参数（stage=tasks、triggerStage=bmad_story_stage4） | Phase 2 T5 | ⚠️ plan 写「补跑参数与步骤 4.2 一致」，未显式写 stage/triggerStage |
| T6 | Story 完成自检文档章节 | Phase 2 T6 | ✅ |
| T7 | aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2、aggregateByBranch 不实现 | Phase 3.1 | ✅ 明确 aggregateByBranch 本轮不实现 |
| T8 | 完整 run 定义（至少 3 stage）、implement trigger_stage=speckit_5_2、退化逻辑、fixture | Phase 3.2 | ⚠️ **GAP-C** |
| T9 | getWeakTop3 按 epic/story、单测、仪表盘含短板 | Phase 3.3 | ✅ |
| T11 | --runGroupId 或 dev-e{epic}-s{story}-{ts} 约定、RUN_ID_CONVENTION | Phase 1.2 T11 | ✅ |

**GAP-C**：TASKS T8 明确「在 scoring/data 放置 3 条已知 fixture」；plan §3.2、§5.1 写「scoring/__tests__/fixtures/dashboard-epic-story-window/」。**路径不一致**。dashboard-generate 当前通过 `getScoringDataPath()` 读取 `scoring/data`（或 SCORING_DATA_PATH），无 `--dataPath` 参数。plan 未说明 integration 测试如何让 dashboard-generate 读取 `scoring/__tests__/fixtures/` 下的数据，导致「对 fixture 断言」无法执行。

---

### 1.3 与 spec-E9-S1 的覆盖

| spec 章节 | 要点 | plan 对应 | 覆盖状态 |
|-----------|------|-----------|----------|
| §3.1.1 | 步骤 4.2、CLI 含 --triggerStage bmad_story_stage4 | Phase 1.1 | ⚠️ 同 GAP-A |
| §3.1.2 | 路径约定 | Phase 1.1 T2 | ✅ |
| §3.2.1 | reportPath 解析、SCORE_WRITE_SKIP_REPORT_MISSING | Phase 1.1 T3 | ✅ |
| §3.2.2 | trigger_stage、speckit_5_2 | Phase 1.2 T4 | ✅ |
| §3.2.3 | run_id 共享 | Phase 1.2 T11 | ✅ |
| §3.3.1 | check 脚本、补跑参数 | Phase 2 T5 | ⚠️ 补跑参数未显式 |
| §3.3.2 | Story 完成自检文档 | Phase 2 T6 | ✅ |
| §3.4.1 | 聚合函数、epic_story_window | Phase 3.1 | ✅ |
| §3.4.2 | 完整 run、退化逻辑、验收 fixture | Phase 3.2 | ⚠️ 同 GAP-B、GAP-C |
| §3.4.3 | getWeakTop3 扩展 | Phase 3.3 | ✅ |
| §4 成功标准 | 写入链路、自检、聚合、trigger_stage、run_id | Phase 1–3、§4 | 部分 |

---

## §2 专项审查：集成测试与端到端测试计划

### 2.1 批判审计员：plan §4 是否包含完整的集成/E2E 测试计划

**plan §4 现有内容**：

| 测试类型 | 覆盖对象 | 验证方式 |
|----------|----------|----------|
| 单元 | trigger_stage 写入、aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2、getWeakTop3 | 单测文件 |
| 集成 | parse-and-write-score CLI（--triggerStage、--runGroupId） | 执行 CLI，检查 scoring/data |
| 集成 | check-story-score-written（有/无数据） | 执行 CLI，检查输出 |
| 集成 | dashboard-generate --strategy epic_story_window | 对 fixture 断言总分、四维、短板 |

**批判审计员结论**：

1. **parse-and-write-score**：plan 的「集成测试」仅验证 **CLI 在隔离环境下执行**，未验证 **bmad-story-assistant SKILL 流程或 speckit-workflow 实际触发该 CLI**。生产关键路径是「Agent 按 SKILL 执行 → 调用 parse-and-write-score → scoring/data 写入」。当前验证方式「执行上述 CLI 命令，确认 scoring/data 写入」是手工/脚本运行 CLI，**不构成 E2E 流程验证**。若 SKILL 文档缺步骤、或 Agent 未执行，此测试无法发现。

2. **check-story-score-written**：plan §4.4 写「验证方式：SKILL 流程描述中含检查步骤」。这是 **grep/doc 检查**，非运行时功能测试。脚本可独立通过集成测试，但若 SKILL 未嵌入或嵌入位置错误，生产流程中永远不会执行。**缺少 E2E：模拟 bmad-story-assistant 阶段四通过后，是否实际执行检查脚本**。

3. **dashboard-generate**：plan 要求「对 fixture 断言总分、四维、短板」，但 **fixture 路径与 dashboard-generate 数据源不匹配**（见 GAP-C）。dashboard-generate 读取 `getScoringDataPath()`，默认 `scoring/data`；plan 将 fixture 置于 `scoring/__tests__/fixtures/`。plan 未规定：
   - 是否新增 `--dataPath` 供测试指向 fixture 目录；
   - 或是否通过 `SCORING_DATA_PATH` 环境变量指向 fixture；
   - 或是否在集成测试前将 fixture 拷贝至 scoring/data（会污染真实数据）。

4. **生产代码关键路径验证（§4.4）** 采用「grep 生产代码 import 或 Command 定义」「SKILL 流程描述中含检查步骤」——均为 **静态/文档级验证**，非自动化功能测试。无法保证模块实际被调用、行为符合 spec。

**结论**：plan 包含集成测试计划框架，但 **存在缺口**：缺少 SKILL→CLI 的 E2E 验证、check-story-score-written 的流程嵌入验证、dashboard-generate 与 fixture 路径的可执行性。**未完全覆盖**「模块间协作、生产代码关键路径、用户可见功能流程」的端到端验证。

---

### 2.2 是否存在仅依赖单元测试而缺少集成/E2E 计划的情况

| 模块/功能 | 单元测试 | 集成/E2E 计划 | 批判审计员判定 |
|-----------|----------|---------------|----------------|
| T1–T3 bmad-story-assistant 流程修改 | 无（SKILL 文档） | 仅有 grep 验收 | ❌ **仅文档验证**：无任何自动化测试；流程是否正确执行完全依赖人工 |
| T4 trigger_stage | 有 | 有（CLI 集成） | ✅ |
| T5 check-story-score-written | 无 | 有（CLI 有/无数据） | ⚠️ 缺少「SKILL 嵌入后实际执行」的 E2E |
| T7 聚合函数 | 有 | 通过 T8 仪表盘间接 | ✅ |
| T8 仪表盘 | 无直接单测 | 有（但对 fixture 路径未定义） | ❌ **集成测试不可执行**（fixture 路径问题） |
| T9 getWeakTop3 | 有 | 通过 T8 仪表盘 | ✅ |

**结论**：**存在**仅依赖单元测试或弱验证的情况——T1–T3 无集成/E2E；T8 集成测试设计存在路径缺陷，无法独立执行。

---

### 2.3 是否存在模块内部实现完整但未被生产关键路径调用的风险

| 新增/修改模块 | 生产入口 | 调用关系 | 风险 |
|---------------|----------|----------|------|
| `aggregateByEpicStoryTimeWindow` | scoring/dashboard/compute.ts | 应由 getLatestRunRecordsV2 调用 | ⚠️ **风险存在** |
| `getLatestRunRecordsV2` | scripts/dashboard-generate.ts | 当前 dashboard-generate 使用 `getLatestRunRecords`，未使用 getLatestRunRecordsV2 | ⚠️ **高风险** |
| `getWeakTop3` 扩展 | scripts/dashboard-generate.ts | 当前已调用 getWeakTop3，扩展后需确保传入聚合后数据 | ⚠️ 中风险 |
| `check-story-score-written.ts` | bmad-story-assistant SKILL | SKILL 文档需嵌入调用；无强制校验 | ⚠️ **高风险** |

**批判审计员分析**：

1. **dashboard-generate.ts**：当前实现（读取自 grep/read）使用 `getLatestRunRecords(records)`，**未使用 getLatestRunRecordsV2**。plan 要求新增 `--strategy epic_story_window` 并在该策略下调用 getLatestRunRecordsV2/aggregateByEpicStoryTimeWindow，但 **plan 未明确要求在验收命令或测试中验证 dashboard-generate.ts 在 strategy=epic_story_window 时确实 import 并调用 getLatestRunRecordsV2**。实施时存在「compute.ts 实现完整、dashboard-generate 未接入」的孤岛风险。

2. **check-story-score-written**：新建脚本，唯一生产入口为 bmad-story-assistant 阶段四。plan §4.4 仅要求「SKILL 流程描述中含检查步骤」，不要求验证 Command/子流程实际触发该脚本。若 SKILL 描述含糊或 Agent 跳过，脚本可能永不执行——**孤岛风险高**。

3. **plan 建议补充**：在 §4.4 或 §6 验收命令中增加：
   - `grep "getLatestRunRecordsV2\|aggregateByEpicStoryTimeWindow" scripts/dashboard-generate.ts` 有匹配；
   - 或单测/集成测试断言 dashboard-generate 在 strategy=epic_story_window 时输出的数据来源为 getLatestRunRecordsV2 的返回值。

---

## §3 批判审计员段落（≥50%）

### 3.1 覆盖完整性

plan 在需求映射表（§1）中对 Story 9.1、TASKS、spec 的 AC 与任务做了逐一映射，主体覆盖完整。但存在 **3 处实质性遗漏**：

1. **T1 CLI 示例**：bmad-story-assistant 应使用 `--triggerStage bmad_story_stage4`，plan 未显式写出，易导致 implement 与 story-assistant 场景混淆。

2. **T8 验收 fixture 路径**：TASKS 写 scoring/data；plan 写 scoring/__tests__/fixtures/；dashboard-generate 默认读 scoring/data 且无 --dataPath。三者不一致，集成测试「对 fixture 断言」**无法按 plan 直接执行**。必须二选一：在 plan 中规定 dashboard-generate 支持 `--dataPath` 并指定集成测试使用该参数；或规定 fixture 放在 scoring/data 的专用子目录，并在测试后清理。

3. **T5 补跑参数**：TASKS 明确「T4 延后时：补跑使用 stage=tasks、triggerStage=bmad_story_stage4」。plan 仅写「与步骤 4.2 一致」，未列出具体参数，对实施与验收的确定性不足。

### 3.2 集成/E2E 测试充分性

plan §4 标题为「集成测试与端到端功能测试计划（必须）」，但在以下方面不足：

- **E2E 缺失**：无任何测试验证「用户/Agent 通过 bmad-story-assistant 或 speckit-workflow 完成流程后，scoring/data 中确有对应 record」。现有「执行 CLI 命令」仅为集成测试，非 E2E。

- **验证方式弱**：§4.4 生产路径验证依赖 grep、文档检查，非自动化功能测试。可接受为最低可行方案，但 plan 声称「必须包含完整的集成测试与端到端功能测试计划」，与实际内容不匹配。

- **fixture 可执行性**：dashboard-generate 集成测试的 fixture 路径与脚本数据源不兼容，属设计缺陷。

### 3.3 孤岛模块风险

plan 在设计上要求 dashboard-generate 接入 getLatestRunRecordsV2、aggregateByEpicStoryTimeWindow，但 **未在验收命令或测试计划中显式验证该接入**。历史上（如 iteration-count display）曾出现「compute 已实现、dashboard-generate 未调用」的情况，本轮存在相同风险。建议 plan 补充：验收时 grep 或单测断言 dashboard-generate 在 strategy=epic_story_window 时调用了 getLatestRunRecordsV2。

---

## §4 结论

**未完全通过。**

### 4.1 完全覆盖、验证通过项

- Story 9.1、TASKS、spec 的 AC-2、AC-3、AC-4、AC-5、AC-6、AC-7、AC-9、AC-10 在 plan 中有明确对应。
- T2、T3、T4、T6、T7、T9、T11 的实施设计与验收命令可执行。
- T4、T7、T9 的单元测试计划明确；parse-and-write-score、check-story-score-written 的 CLI 集成测试设计合理（除 fixture 路径外）。

### 4.2 未通过项（须修订 plan 后重新审计）

| 序号 | 问题 | 建议修订 |
|------|------|----------|
| 1 | T1 CLI 示例未明确 --triggerStage bmad_story_stage4 | 在 Phase 1.1 T1 或 §4.1 中显式写出 bmad-story-assistant 场景使用 bmad_story_stage4 |
| 2 | T8 验收 fixture 路径与 dashboard-generate 数据源不一致 | 明确：① 新增 --dataPath 并在集成测试中使用；或 ② fixture 置于 scoring/data 的指定子目录并规定测试后清理 |
| 3 | T5 补跑参数未显式 | 在 Phase 2 T5 或相关处补充「补跑时 stage=tasks、triggerStage=bmad_story_stage4」 |
| 4 | 生产路径未验证 getLatestRunRecordsV2 接入 | 在 §4.4 或 §6 补充：grep/getLatestRunRecordsV2 scripts/dashboard-generate.ts 或等效验收，确认 strategy=epic_story_window 时调用 |
| 5 | 无 E2E 验证 SKILL→parse-and-write-score、SKILL→check-story-score-written | 可接受为「超出 plan 范围的增强项」；若 plan 声称「完整 E2E」，则须补充最低可行的 E2E 设计（如人工验收清单或脚本化流程模拟） |

### 4.3 总体结论

plan-E9-S1.md 对原始需求文档的主体覆盖较好，集成测试框架存在，但在 **T1 triggerStage 明确性、T8 fixture 可执行性、T5 补跑参数、生产路径 getLatestRunRecordsV2 接入验证** 等方面存在缺口。**不完全满足**「完全覆盖、验证通过」标准。

**建议**：按上表 5 项修订 plan 后，重新发起审计。

---

## §5 可解析评分块（供后续流程）

总体评级: C+

维度评分:
- 需求覆盖完整性: 78/100
- 集成/E2E 测试充分性: 62/100
- 孤岛风险防控: 70/100
- 可执行性（验收可复现）: 72/100
