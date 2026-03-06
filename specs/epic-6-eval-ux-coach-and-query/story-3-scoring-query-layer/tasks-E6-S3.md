# Tasks: 评分查询层（scoring/query/）(E6-S3)

**Input**：`spec-E6-S3.md`、`plan-E6-S3.md`、`IMPLEMENTATION_GAPS-E6-S3.md`  
**Scope**：Story 6.3 全部（query API、loader、parse-epic-story、测试、验收）  
**执行方式**：按 T1 → T2 → T3 → T4 → T5 顺序推进，TDD 红绿灯模式

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 6.3, GAPS | §3.4, §3.5, GAP-E6-S3-3,5,10 | loader.ts：loadAndDedupeRecords、isRunScoreRecord、EXCLUDED_JSON、(run_id, stage) 去重 |
| T2 | Story 6.3, GAPS | §3.3, GAP-E6-S3-2,9 | parse-epic-story.ts：parseEpicStoryFromRecord，run_id 正则，source_path story 优先 |
| T3 | Story 6.3, GAPS | §3.1, §3.2, GAP-E6-S3-1,4,6,7,8 | index.ts：5 个 query API |
| T4 | Story 6.3, GAPS | §3.8, GAP-E6-S3-12 | 验收脚本 scripts/query-validate.ts；单元测试中 import 并调用 query |
| T5 | Story 6.3, GAPS | §5, GAP-E6-S3-11,12 | 单元测试；集成验证；生产路径由 6.2/6.4 负责（见 IMPLEMENTATION_GAPS §2.1） |

---

## 2. Phase 1：数据加载与去重（T1）

**AC**：GAP-E6-S3-3、5、10；AC-2、AC-3 数据源部分  
**集成验证**：T5（query API 使用 loader，单元测试通过）

- [x] **T1.1** 新建 `scoring/query/loader.ts`，实现 `isRunScoreRecord(obj: unknown): obj is RunScoreRecord`（至少校验 run_id、timestamp、scenario、stage；与 discovery/filter-epic-story 一致）
- [x] **T1.2** 实现 `loadAndDedupeRecords(dataPath?: string): RunScoreRecord[]`：使用 `dataPath ?? getScoringDataPath()`；扫描 *.json（排除 EXCLUDED_JSON=['sft-dataset.json']）与 scores.jsonl；仅解析符合 isRunScoreRecord 的记录；按 (run_id, stage) 分组，每组取 timestamp 最大的一条
- [x] **T1.3** 导出 `EXCLUDED_JSON`、`isRunScoreRecord`、`loadAndDedupeRecords`

---

## 3. Phase 2：epic_id/story_id 解析（T2）

**AC**：GAP-E6-S3-2、9；AC-1、AC-4、AC-5 解析部分  
**集成验证**：T5 parse-epic-story 单测；T3 queryByEpic/queryByStory 使用解析

- [x] **T2.1** 新建 `scoring/query/parse-epic-story.ts`，实现 `parseEpicStoryFromRecord(record: RunScoreRecord): { epicId: number; storyId: number } | null`：run_id 正则 `/-e(\d+)-s(\d+)(?:-|$)/`
- [x] **T2.2** source_path fallback（run_id 无匹配时）：1) `/story-(\d+)-(\d+)-/`，2) `/epic-(\d+)-[^/]*\/story-(\d+)-/`；无匹配返回 null
- [x] **T2.3** 导出 `parseEpicStoryFromRecord`

---

## 4. Phase 3：query API（T3）

**AC**：GAP-E6-S3-1、4、6、7、8；AC-1～AC-7  
**集成验证**：T5 query 单测通过；T4 验收脚本可调用

- [x] **T3.1** 新建 `scoring/query/index.ts`，实现 `queryByEpic(epicId: number, dataPath?: string): RunScoreRecord[]`：loadAndDedupeRecords → 过滤 scenario !== 'real_dev' → parseEpicStoryFromRecord → 保留 parsedEpicId === epicId
- [x] **T3.2** 实现 `queryByStory(epicId: number, storyId: number, dataPath?: string): RunScoreRecord[]`：同上，保留 parsedEpicId === epicId && parsedStoryId === storyId
- [x] **T3.3** 实现 `queryLatest(n: number, dataPath?: string): RunScoreRecord[]`：n ≤ 0 返回 []；loadAndDedupeRecords → timestamp 降序（相同时 run_id 字典序）→ 取前 n 条
- [x] **T3.4** 实现 `queryByStage(runId: string, stage: string, dataPath?: string): RunScoreRecord[]`：loadAndDedupeRecords → 保留 run_id === runId && stage === stage
- [x] **T3.5** 实现 `queryByScenario(scenario: 'real_dev' | 'eval_question', dataPath?: string): RunScoreRecord[]`：scenario 非法返回 []；loadAndDedupeRecords → 保留 record.scenario === scenario
- [x] **T3.6** 导出 5 个 query API

---

## 5. Phase 4：验收脚本与集成验证（T4）

**AC**：GAP-E6-S3-12；spec §3.8；plan Phase 4  
**集成验证**：验收脚本可执行；query 模块可被 import

- [x] **T4.1** 新建 `scripts/query-validate.ts`：`import { queryByEpic, queryByStory, queryLatest } from '../scoring/query'`（或等价路径）；调用 queryByStory(3,3)、queryByEpic(3)、queryLatest(10)；输出结果；支持可选 SCORING_DATA_PATH 或 --data-path
- [x] **T4.2** 单元测试中显式 `import { queryByEpic } from '../query'` 或等价，证明 API 可被外部使用
- [x] **T4.3** 记录：生产路径导入验证由 Story 6.2（迁移）或 6.4（bmad-scores）负责；本 Story 产出可导入的 query 模块及验收脚本

---

## 6. Phase 5：测试与验收（T5）

**AC**：GAP-E6-S3-11、12；plan §6；AC-1～AC-7  
**集成验证**：单元测试全部通过；验收脚本可执行

- [x] **T5.1** 新增 `scoring/query/__tests__/loader.test.ts`：loadAndDedupeRecords 空目录→[]；单 json、jsonl；去重（同 run_id+stage 仅一条）；isRunScoreRecord；EXCLUDED_JSON 排除 sft-dataset.json
- [x] **T5.2** 新增 `scoring/query/__tests__/parse-epic-story.test.ts`：run_id `-e4-s2-`、`-e5-s5`；source_path story-4-2-*、(4,2)；epic-5-*/story-5-*、(5,5)；无匹配 null
- [x] **T5.3** 新增 `scoring/query/__tests__/query.test.ts`：使用临时 dataPath fixture；queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario；queryLatest(0)→[]；queryByScenario('invalid')→[]；Epic/Story 不包含 eval_question
- [x] **T5.4** 执行 `npm run test:scoring -- scoring/query` 全部通过
- [x] **T5.5** 执行验收：`npx ts-node scripts/query-validate.ts` 或等价，有/无数据时输出符合 AC

---

## 7. 验收命令汇总

| 命令 | 覆盖 |
|------|------|
| `npm run test:scoring -- scoring/query/__tests__/loader.test.ts` | T1, T5.1 |
| `npm run test:scoring -- scoring/query/__tests__/parse-epic-story.test.ts` | T2, T5.2 |
| `npm run test:scoring -- scoring/query/__tests__/query.test.ts` | T3, T5.3 |
| `npm run test:scoring -- scoring/query` | T5.4 |
| `npx ts-node scripts/query-validate.ts` | T4, T5.5, AC-1,3,5,7 |
| `SCORING_DATA_PATH=/tmp/empty npx ts-node scripts/query-validate.ts` | 空目录 |

---

## 8. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §1 | GAP-E6-S3-1 | ✓ 有 | T3 |
| Story §1 | GAP-E6-S3-2, 9 | ✓ 有 | T2 |
| Story §1 | GAP-E6-S3-3, 5, 10 | ✓ 有 | T1 |
| Story §1 | GAP-E6-S3-4, 6, 7, 8 | ✓ 有 | T3 |
| Story §4 | GAP-E6-S3-11 | ✓ 有 | T5 |
| Story §5, spec §5 | GAP-E6-S3-12 | ✓ 有 | T4, T5 |
| Story §6.4 | GAP-E6-S3-13 | ✓ 有 | T1, T2, T3 |

---

## 9. 完成判定标准

- T1～T5 全部任务完成并勾选。
- AC-1～AC-7 均有可追溯任务与验收命令结果。
- query 模块可从 `scoring/query` import 并正确返回数据；生产路径集成由 Story 6.2/6.4 负责（见 IMPLEMENTATION_GAPS §2.1）。
- TDD 红绿灯：每任务须记录 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]。
