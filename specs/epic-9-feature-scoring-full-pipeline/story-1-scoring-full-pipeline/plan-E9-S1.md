# plan-E9-S1：评分全链路写入与仪表盘聚合 实现方案

**Epic**：E9 feature-scoring-full-pipeline  
**Story ID**：9.1  
**输入**：spec-E9-S1.md、Story 9.1、TASKS_评分全链路写入与仪表盘聚合.md

<!-- AUDIT: PASSED by code-reviewer -->

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story §Story | 写入链路、自检、聚合 | Phase 1–3 | ✅ |
| AC-1 | spec §3.1.1 | Phase 1 T1 | ✅ |
| AC-2 | spec §3.1.2 | Phase 1 T2 | ✅ |
| AC-3 | spec §3.2.1 | Phase 1 T3 | ✅ |
| AC-4 | spec §3.2.2 | Phase 1 T4 | ✅ |
| AC-5 | spec §3.3.1 | Phase 2 T5 | ✅ |
| AC-6 | spec §3.3.2 | Phase 2 T6 | ✅ |
| AC-7 | spec §3.4.1 | Phase 3 T7 | ✅ |
| AC-8 | spec §3.4.2 | Phase 3 T8 | ✅ |
| AC-9 | spec §3.4.3 | Phase 3 T9 | ✅ |
| AC-10 | spec §3.2.3 | Phase 1 T11 | ✅ |
| spec §4 成功标准 | 全部 | Phase 1–3 验收 | ✅ |

---

## 2. 目标与约束

- **Phase 1**：bmad-story-assistant SKILL 修改（T1–T3）、scoring/writer trigger_stage（T4）、run_id 共享（T11）
- **Phase 2**：check-story-score-written 脚本、Story 完成自检嵌入、文档化（T5、T6）
- **Phase 3**：aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2、dashboard-generate --strategy epic_story_window、getWeakTop3 扩展（T7–T9）
- **必须包含**完整的集成测试与端到端功能测试计划：验证 parse-and-write-score、check-story-score-written、dashboard-generate 在生产入口可执行且行为符合 spec

---

## 3. 实施分期

### Phase 1：写入链路（T1、T2、T3、T4、T11）

#### Phase 1.1：bmad-story-assistant SKILL 修改（T1、T2、T3）

1. **定位 SKILL**：`skills/bmad-story-assistant/SKILL.md` 或 `~/.cursor/skills/bmad-story-assistant/SKILL.md`（项目内优先）
2. **T1**：在「审计通过后评分写入触发」段落**之前**插入「步骤 4.2：运行 parse-and-write-score（强制）」；含完整 CLI 示例（**须显式写出 `--triggerStage bmad_story_stage4`**，与 implement 的 speckit_5_2 区分）、报告路径模板、non_blocking 处理
3. **T2**：在 STORY-A4-POSTAUDIT 模板中增加「审计通过后请将报告保存至 `{project-root}/_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_Story_{epic}-{story}_stage4.md`」
4. **T3**：在「审计结论处理」增加主 Agent 解析 reportPath 逻辑；reportPath 不存在时记录 SCORE_WRITE_SKIP_REPORT_MISSING，不阻断

#### Phase 1.2：trigger_stage 与 run_id（T4、T11）

1. **T4**：
   - `scoring/writer/types.ts`：RunScoreRecord 新增 `trigger_stage?: string`
   - `scoring/schema/run-score-schema.json`：扩展 schema
   - `scoring/orchestrator/parse-and-write.ts`：options 支持 triggerStage，写入时传入
   - `scripts/parse-and-write-score.ts`：新增 `--triggerStage` 参数
2. **T11**：
   - `scripts/parse-and-write-score.ts`：新增 `--runGroupId` 参数（二选一实现；或约定 dev-e{epic}-s{story}-{ts} 复用）
   - `scoring/docs/RUN_ID_CONVENTION.md`：补充同一 Story 多 stage 共享 run_id 约定

### Phase 2：Story 完成自检（T5、T6）

1. **T5**：新建 `scripts/check-story-score-written.ts --epic N --story N [--dataPath path]`
   - 检查逻辑：loadAndDedupeRecords + parseEpicStoryFromRecord 或 run_id 正则 `dev-e{N}-s{N}-`
   - 输出：有/无记录
   - 嵌入 bmad-story-assistant 阶段四通过后、提供完成选项前；**补跑参数显式**：`--stage tasks --event story_status_change --triggerStage bmad_story_stage4`（与步骤 4.2 一致）
2. **T6**：在「审计报告格式与解析约定」文档新增「Story 完成自检」章节；含检查逻辑、scoring/data 路径、run_id 与 epic/story 对应关系

### Phase 3：聚合与仪表盘（T7、T8、T9）

#### Phase 3.1：聚合逻辑（T7）

1. **aggregateByEpicStoryTimeWindow(records, epic, story, windowHours)**：筛选 epic/story 匹配、timestamp 在 window 内的 record 子集
2. **getLatestRunRecordsV2(options)**：strategy=epic_story_window 时调用 aggregateByEpicStoryTimeWindow；strategy=run_id 时保持现有行为
3. **aggregateByBranch**：本轮不实现

#### Phase 3.2：仪表盘生成（T8）

1. `scripts/dashboard-generate.ts`：支持 `--strategy epic_story_window`（默认）或 `run_id`
2. 默认策略：按 epic/story 分组，时间窗口内取最新「完整 run」（至少 3 个 stage；implement 以 trigger_stage=speckit_5_2 计入）
3. 退化逻辑：若无完整 run，该 Story 行显示「数据不足」
4. **验收 fixture**：fixture 须置于 **`scoring/data/`** 下（dashboard-generate 从 getScoringDataPath() 读取）；可选用 `scoring/data/__fixtures-dashboard-epic-story/` 子目录，集成测试前复制 fixture 到该路径、测试后清理；或 dashboard-generate 新增 `--dataPath` 以便单测指定 fixture 路径。单测硬编码预期总分与四维断言（±1 舍入）

#### Phase 3.3：短板计算（T9）

1. **getWeakTop3** 扩展：支持按 epic/story 聚合后计算；同一 Story 各 stage 取最低分作为短板得分，Top 3 升序
2. 仪表盘输出含跨 run 短板信息

---

## 4. 集成测试与端到端功能测试计划（必须）

### 4.1 parse-and-write-score（T4、T11）

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 单元 | trigger_stage 写入 | scoring/orchestrator/parse-and-write.test.ts | record.trigger_stage === "speckit_5_2" |
| 集成 | CLI --triggerStage | `npx ts-node scripts/parse-and-write-score.ts --reportPath <fixture> --stage tasks --triggerStage speckit_5_2 ...` | scoring/data 下 record 含 trigger_stage |
| 集成 | --runGroupId 或 run_id 共享 | 同上，传入 --runGroupId | 多 stage 写入共享 run_id |

### 4.2 check-story-score-written（T5）

| 测试类型 | 测试内容 | 命令 | 预期 |
|----------|----------|------|------|
| 集成 | 有数据时 | `npx ts-node scripts/check-story-score-written.ts --epic 8 --story 1`（fixture 有 dev-e8-s1-*） | 输出含「有记录」 |
| 集成 | 无数据时 | `npx ts-node scripts/check-story-score-written.ts --epic 99 --story 99` | 输出含「无记录」 |

### 4.3 聚合与仪表盘（T7、T8、T9）

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 单元 | aggregateByEpicStoryTimeWindow | scoring/dashboard/__tests__/compute.test.ts | 返回预期 record 子集 |
| 单元 | getLatestRunRecordsV2(strategy: epic_story_window) | 同上 | 返回预期子集 |
| 单元 | getWeakTop3 按 epic/story 聚合 | 同上 | Top 3 升序，含跨 run 短板 |
| 集成 | dashboard-generate --strategy epic_story_window | `npx ts-node scripts/dashboard-generate.ts --strategy epic_story_window` | 对 fixture 断言总分、四维、短板；无完整 run 时显示「数据不足」 |

### 4.4 生产代码关键路径验证（必须）

- parse-and-write-score：speckit-workflow §1.2–§5.2、bmad-story-assistant 阶段四均会调用；验证方式：执行上述 CLI 命令，确认 scoring/data 写入
- check-story-score-written：bmad-story-assistant 阶段四嵌入；验证方式：SKILL 流程描述中含检查步骤；**最低可行 E2E**：模拟一次完整 Dev Story 流程，在阶段四通过后人工或脚本确认检查步骤被执行（可选自动化）
- dashboard-generate：/bmad-dashboard 或等效 Command 调用；验证方式：grep 生产代码 import 或 Command 定义
- **getLatestRunRecordsV2 / aggregateByEpicStoryTimeWindow 调用验证**：grep 或单测断言：当 `strategy=epic_story_window` 时，dashboard-generate 内部调用 `getLatestRunRecordsV2`（或等价函数），而非仅使用 `getLatestRunRecords`；验收时需验证 dashboard-generate 的 strategy 分支确实调用新聚合逻辑

---

## 5. 模块与文件改动设计

### 5.1 新增文件

| 文件 | 责任 | 对应需求 |
|------|------|----------|
| `scripts/check-story-score-written.ts` | Story 完成自检入口 | spec §3.3.1 |
| `scoring/data/__fixtures-dashboard-epic-story/` 或等效 | 验收 fixture（复制到 scoring/data 下，或 dashboard-generate --dataPath） | spec §3.4.2 验收 fixture |

### 5.2 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| `skills/bmad-story-assistant/SKILL.md` | T1–T3、T5 流程修改 | 步骤 4.2、路径约定、reportPath 解析、检查嵌入 |
| `scoring/writer/types.ts` | RunScoreRecord.trigger_stage | T4 |
| `scoring/schema/run-score-schema.json` | trigger_stage 字段 | T4 |
| `scoring/orchestrator/parse-and-write.ts` | triggerStage 透传 | T4 |
| `scripts/parse-and-write-score.ts` | --triggerStage、--runGroupId | T4、T11 |
| `scoring/dashboard/compute.ts` | aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2、getWeakTop3 扩展 | T7、T8、T9 |
| `scoring/query/loader.ts` | 可选：导出 getLatestRunRecordsV2 所需 loader | T7 |
| `scripts/dashboard-generate.ts` | --strategy epic_story_window | T8 |
| 审计报告格式与解析约定文档 | Story 完成自检章节 | T6 |
| `scoring/docs/RUN_ID_CONVENTION.md` | run_id 共享约定 | T11 |

---

## 6. 验收命令汇总

| Phase | 验收命令 | 预期 |
|-------|----------|------|
| T1–T3 | grep `步骤 4.2` skills/bmad-story-assistant/SKILL.md；grep `审计通过后请将报告保存至` | 有匹配 |
| T4 | `npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage tasks --triggerStage speckit_5_2 --epic 9 --story 1`；检查 scoring/data record.trigger_stage | speckit_5_2 |
| T5 | `npx ts-node scripts/check-story-score-written.ts --epic 8 --story 1` | 有/无记录输出 |
| T6 | grep `Story 完成自检` 审计报告格式与解析约定文档 | 有匹配 |
| T7 | 单测 aggregateByEpicStoryTimeWindow、getLatestRunRecordsV2 | 通过 |
| T8 | `npx ts-node scripts/dashboard-generate.ts --strategy epic_story_window`；对 fixture 断言 | 总分、四维与预期一致（±1） |
| T9 | 单测 getWeakTop3；仪表盘输出含短板 | 通过 |
