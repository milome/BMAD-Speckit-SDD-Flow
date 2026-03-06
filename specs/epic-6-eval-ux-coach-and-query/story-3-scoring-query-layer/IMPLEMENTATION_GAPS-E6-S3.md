# IMPLEMENTATION_GAPS-E6-S3：评分查询层（scoring/query/）

**输入**：`spec-E6-S3.md`、`plan-E6-S3.md`、当前代码基线  
**分析范围**：Story 6.3 全部 scope（queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario；解析规则；去重；验收）

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story §1 REQ-UX-2.1 | GAP-E6-S3-1 | 提供 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario | 未实现 | `scoring/query/` 目录不存在 |
| Story §1 REQ-UX-2.2 | GAP-E6-S3-2 | epic_id/story_id 从 run_id 或 source_path 提取；无匹配时明确反馈 | 部分实现 | filter-epic-story.ts 有解析逻辑，但 query 层需独立实现（source_path 顺序 story 优先） |
| Story §1 REQ-UX-2.3 | GAP-E6-S3-3 | 同 run_id+stage 取 timestamp 最新一条去重 | 未实现 | discovery 无 (run_id, stage) 去重 |
| Story §1 REQ-UX-2.4 | GAP-E6-S3-4 | Epic/Story 筛选仅 real_dev；eval_question 隔离 | 未实现 | 无 query 层 |
| Story §1 REQ-UX-2.5 | GAP-E6-S3-5 | 仅读取评分 schema；排除 sft-dataset.json | 部分实现 | discovery、filter-epic-story 有 EXCLUDED_JSON，query loader 需新建 |
| Story §3.1 | GAP-E6-S3-6 | queryByEpic(epicId)、queryByStory(epicId, storyId) 仅 real_dev | 未实现 | 无 query API |
| Story §3.1 | GAP-E6-S3-7 | queryLatest(n) 按 timestamp 排序最新 n 条 | 未实现 | 无 query API |
| Story §3.1 | GAP-E6-S3-8 | queryByStage(runId, stage)、queryByScenario(scenario) | 未实现 | 无 query API |
| Story §3.2 | GAP-E6-S3-9 | run_id 正则 `-e(\d+)-s(\d+)(?:-|$)`；source_path story 优先、epic 次之 | 未实现 | filter-epic-story 为 epic 优先，query 层需按 spec 顺序 |
| Story §3.4 | GAP-E6-S3-10 | loadAndDedupeRecords：getScoringDataPath、EXCLUDED_JSON、isRunScoreRecord、(run_id, stage) 去重 | 未实现 | 无 loader |
| Story §4 AC-1～AC-7 | GAP-E6-S3-11 | 7 条验收标准 | 未实现 | 无 query 实现 |
| Story §5、spec §5 | GAP-E6-S3-12 | 单元测试、集成验证、**生产路径导入** | 未实现 | 无 query 测试；生产路径由 Story 6.2/6.4 负责（见 §2） |
| Story §6.4 | GAP-E6-S3-13 | 新增 scoring/query/index.ts、loader.ts、parse-epic-story.ts | 未实现 | 目录与文件均不存在 |

---

## 2. 职责与范围说明

### 2.1 生产路径导入验证

**spec §5 要求**：验证 query 模块被生产代码关键路径导入（Story 6.2 迁移或 Story 6.4 复用）。

**plan 职责划分**：
- **本 Story 不覆盖** coach-diagnose、bmad-scores 等生产入口对 query 的调用。
- **Story 6.2**：本 Story 完成后，6.2 **可**迁移为复用 queryByEpic/queryByStory；迁移为 6.2 或后续 Story 职责。
- **Story 6.4**：`/bmad-scores` 将**复用**本 Story API，作为生产关键路径集成点。
- **本 Story 产出**：可导入的 query 模块及验收脚本；单元测试中显式 import 并调用，证明 API 可被外部使用。

**GAP-E6-S3-12** 验收：单元测试 + 验收脚本（scripts/query-validate.ts）中 import 并调用 query；生产路径验证由 6.2/6.4 实施时补齐。

---

## 3. 当前实现快照

- `scoring/query/`：**不存在**。
- `scoring/coach/discovery.ts`：loadAllRecords（内部）、discoverLatestRunId；无 (run_id, stage) 去重。
- `scoring/coach/filter-epic-story.ts`：loadAllRecordsForFilter、parseEpicStoryFromRecord、filterByEpicStory；source_path 顺序为 epic 优先。
- `scoring/constants/path.ts`：getScoringDataPath() 可用。
- `scoring/writer/types.ts`：RunScoreRecord 可用。
- `scripts/query-validate.ts`：不存在。

---

## 4. 依赖关系与实施顺序

1. **Phase 1**：新建 `scoring/query/loader.ts`（loadAndDedupeRecords、isRunScoreRecord、EXCLUDED_JSON）。
2. **Phase 2**：新建 `scoring/query/parse-epic-story.ts`（parseEpicStoryFromRecord，source_path story 优先）。
3. **Phase 3**：新建 `scoring/query/index.ts`（5 个 query API）。
4. **Phase 4**：新建 `scripts/query-validate.ts` 或等价验收脚本；单元测试中 import 并调用。
5. **Phase 5**：单元测试（loader、parse-epic-story、query）；集成验证通过。

---

## 5. Gap 到任务映射总表

| Gap ID | 对应任务 | 验收命令/方式 |
|--------|----------|---------------|
| GAP-E6-S3-1 | T3 | queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario 从 scoring/query 导出 |
| GAP-E6-S3-2 | T2 | parseEpicStoryFromRecord：run_id、source_path、无匹配 null |
| GAP-E6-S3-3 | T1 | loadAndDedupeRecords 按 (run_id, stage) 去重 |
| GAP-E6-S3-4 | T3 | queryByEpic、queryByStory 仅返回 real_dev |
| GAP-E6-S3-5 | T1 | loader 排除 sft-dataset.json，仅解析 RunScoreRecord |
| GAP-E6-S3-6 | T3 | queryByEpic、queryByStory 实现 |
| GAP-E6-S3-7 | T3 | queryLatest(n) 实现，n≤0 返回 [] |
| GAP-E6-S3-8 | T3 | queryByStage、queryByScenario 实现 |
| GAP-E6-S3-9 | T2 | source_path 顺序：story 优先、epic 次之 |
| GAP-E6-S3-10 | T1 | loader.ts 完整实现 |
| GAP-E6-S3-11 | T4、T5 | 7 条 AC 由单元测试 + 验收脚本验证 |
| GAP-E6-S3-12 | T4、T5 | 单元测试 import query；验收脚本；生产路径由 6.2/6.4 负责 |
| GAP-E6-S3-13 | T1、T2、T3 | index.ts、loader.ts、parse-epic-story.ts 新建 |
