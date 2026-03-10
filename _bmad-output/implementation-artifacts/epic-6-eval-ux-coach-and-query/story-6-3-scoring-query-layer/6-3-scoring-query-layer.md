# Story 6.3：评分查询层（scoring/query/）

Status: ready-for-dev

**Epic**：6 eval-ux-coach-and-query  
**Story**：6.3  
**Slug**：scoring-query-layer  
**来源**：epics.md §Epic 6、prd.eval-ux-last-mile.md §5.2（REQ-UX-2）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-2.1 | 在 `scoring/query/` 下提供 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario | 是 | AC-1, AC-3, AC-5, AC-6, AC-7 |
| REQ-UX-2.2 | epic_id/story_id 从 run_id 约定或 source_path 提取；无约定时明确反馈 | 是 | AC-1, AC-4, AC-5 |
| REQ-UX-2.3 | 同 run_id+stage 取 timestamp 最新一条去重 | 是 | AC-2 |
| REQ-UX-2.4 | Epic/Story 筛选仅针对 real_dev；eval_question 数据隔离 | 是 | AC-4 |
| REQ-UX-2.5 | 仅读取评分 schema 文件；排除非评分 json | 是 | scope 约束 |

---

## 2. User Story

**As a** 系统（Command 与 Coach 的底层）  
**I want to** 通过 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario 获取评分记录  
**so that** Coach 与 Scores Command 可以按条件筛选数据

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **scoring/query/ 索引层 API**  
   - `queryByEpic(epicId)`：返回 Epic N 的所有评分记录（仅 real_dev）  
   - `queryByStory(epicId, storyId)`：返回 Story X.Y 的评分记录（仅 real_dev）  
   - `queryLatest(n)`：按 timestamp 排序返回最新 n 条  
   - `queryByStage(runId, stage)`：按 stage 筛选指定 run 的记录  
   - `queryByScenario(scenario)`：按 scenario 筛选  

2. **epic_id/story_id 解析规则**  
   - 从 run_id 约定（`scoring/docs/RUN_ID_CONVENTION.md` §2）或 source_path（§3）提取 epic_id、story_id  
   - run_id 正则：`-e(\d+)-s(\d+)-` 或 `-e(\d+)-s(\d+)$`  
   - source_path fallback（按 RUN_ID_CONVENTION §3 顺序）：  
     - `story-{epic}-{story}-*`（如 `story-4-2-eval-ai-coach` → epic=4, story=2）  
     - `epic-{N}-*/story-{N}-*`（如 `epic-5-*/story-5-eval-analytics-advanced` → epic=5, story=5）  
   - 无匹配时，调用方得到明确反馈（返回空数组；调用方可根据空数组判断无可筛选数据，或由实现附加「无可筛选数据」说明）

3. **去重规则**  
   - 同 run_id+stage 取 timestamp 最新一条

4. **Epic/Story 筛选范围**  
   - 仅针对 scenario=real_dev；eval_question 与 real_dev 隔离，Epic/Story 查询不包含 eval_question 记录

5. **数据源**  
   - 从 `getScoringDataPath()` 下 `*.json`（仅评分 schema，排除 sft-dataset.json 等）与 `scores.jsonl` 读取  
   - 仅解析符合 RunScoreRecord schema 的记录；非评分 json 排除

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| `/bmad-coach --epic/--story` 调用 | Story 6.2 | 6.3 为底层 API，6.2 作为调用方；6.2 已实现 inline 筛选，本 Story 完成后可迁移为复用 query 层 |
| `/bmad-scores` Command | Story 6.4 | 6.4 复用本 Story API |
| 组合 queryByFilters API | GAP-024 | 已记录于 epics.md Deferred Gaps Roadmap |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 按 Story 查询 | 存在 Story 3.3 的评分记录（符合 run_id 约定） | 调用 queryByStory(3, 3) | 返回 Story 3.3 的所有评分记录 |
| AC-2 | 去重 | 同 run_id+stage 存在多条记录 | 调用任一 query 方法 | 同 run_id+stage 仅返回 timestamp 最新一条 |
| AC-3 | 数据源 | scoring/data/*.json 与 scores.jsonl 存在 | 调用 queryLatest(10) | 返回按 timestamp 排序的最新 10 条 |
| AC-4 | Epic/Story 仅 real_dev | 记录含 scenario 字段 | Epic/Story 筛选 | 仅针对 real_dev；eval_question 数据隔离 |
| AC-5 | 按 Epic 查询 | 存在 Epic 3 的 real_dev 记录 | 调用 queryByEpic(3) | 返回 Epic 3 的所有评分记录 |
| AC-6 | 按 Stage 查询 | 存在 run_id 的 prd、arch、story 等记录 | 调用 queryByStage(runId, 'prd') | 返回该 run 下 stage=prd 的记录 |
| AC-7 | 按 Scenario 查询 | 存在 real_dev 与 eval_question 记录 | 调用 queryByScenario('eval_question') | 返回 scenario=eval_question 的记录 |

---

## 5. Tasks / Subtasks

- [ ] Task 1：实现 scoring/query/ 数据加载与 schema 校验（AC: #2, #3）
  - [ ] Subtask 1.1：复用 getScoringDataPath()，加载 *.json 与 scores.jsonl，排除 sft-dataset.json 等非评分 schema
  - [ ] Subtask 1.2：实现 isRunScoreRecord 校验，仅解析符合 RunScoreRecord 的记录
  - [ ] Subtask 1.3：实现同 run_id+stage 去重（取 timestamp 最新一条）
- [ ] Task 2：实现 epic_id/story_id 解析工具（AC: #1, #4, #5）
  - [ ] Subtask 2.1：run_id 正则解析 `-e(\d+)-s(\d+)-` 或 `-e(\d+)-s(\d+)$`
  - [ ] Subtask 2.2：source_path fallback 按 RUN_ID_CONVENTION §3 实现
  - [ ] Subtask 2.3：无匹配时返回空并明确反馈
- [ ] Task 3：实现 query API（AC: #1, #3, #4, #5, #6, #7）
  - [ ] Subtask 3.1：queryByEpic(epicId)、queryByStory(epicId, storyId)，仅 real_dev
  - [ ] Subtask 3.2：queryLatest(n)
  - [ ] Subtask 3.3：queryByStage(runId, stage)、queryByScenario(scenario)
- [ ] Task 4：单元测试与验收命令（AC: 全部）
  - [ ] Subtask 4.1：覆盖 query 方法、去重、隔离逻辑的单元测试
  - [ ] Subtask 4.2：验收命令示例（如从 scripts 调用或直接 import 验证）

---

## 6. Dev Notes

### 6.1 架构约束

- 不修改 RunScoreRecord schema；epic_id/story_id 由解析得出，不写入 record
- 遵循 `scoring/docs/RUN_ID_CONVENTION.md` §2（run_id 格式）、§3（source_path fallback）
- 查询层**只读**；不写入 scoring/data/

### 6.2 现有实现可复用

| 模块 | 路径 | 说明 |
|------|------|------|
| 数据路径 | `scoring/constants/path.ts` | getScoringDataPath() |
| 类型 | `scoring/writer/types.ts` | RunScoreRecord |
| 记录加载 | `scoring/coach/discovery.ts` | loadAllRecords、parseRecords 模式 |
| 筛选逻辑 | `scoring/coach/filter-epic-story.ts` | Story 6.2 inline 实现；本 Story 抽取为 query 层，6.2 可迁移复用 |
| 排除列表 | filter-epic-story.ts | EXCLUDED_JSON = ['sft-dataset.json'] |

### 6.3 解析规则（RUN_ID_CONVENTION.md）

**run_id**：
- 正则：`-e(\d+)-s(\d+)-` 或 `-e(\d+)-s(\d+)$` → epicId、storyId
- 示例：`dev-e4-s2-story-1730812345` → (4, 2)

**source_path fallback**（run_id 无匹配时）：
- `story-{epic}-{story}-*` → `story-4-2-eval-ai-coach` → (4, 2)
- `epic-{N}-*/story-{N}-*` → `epic-5-feature-eval-scoring-enhancement/story-5-eval-analytics-advanced` → (5, 5)

### 6.4 源代码涉及

| 模块 | 路径 | 变更说明 |
|------|------|----------|
| 新增 | `scoring/query/index.ts` | 导出 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario |
| 新增 | `scoring/query/loader.ts` 或等效 | 数据加载、schema 校验、去重 |
| 新增 | `scoring/query/parse-epic-story.ts` 或等效 | epic_id/story_id 解析 |
| 测试 | `scoring/query/__tests__/*.test.ts` | 单元测试 |

### 6.5 测试要求

- 单元测试：query 方法、去重、Epic/Story 解析、scenario 隔离
- 使用临时 dataPath fixture，不污染真实 scoring/data/
- 验收：queryByStory(3, 3)、queryByEpic(3)、queryLatest(10) 在有/无数据时行为符合 AC

---

## 7. 禁止词表合规声明

本 Story 文档已避免使用禁止词表所列词汇（可选、可考虑、后续、待定、酌情、视情况、技术债、既有问题可排除等）。所有范围界定均采用明确归属（由 Story X.Y 负责或 GAP 编号）。

---

## 8. 产出物清单

| 产出 | 路径 |
|------|------|
| query 模块 | `scoring/query/` 目录及 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario 实现 |
| 解析工具 | epic_id/story_id 解析（run_id 正则 + source_path fallback） |
| 单元测试 | 覆盖上述 query 方法与去重、隔离逻辑 |

---

## 9. References

- [Source: scoring/docs/RUN_ID_CONVENTION.md]：run_id 约定、解析规则、source_path fallback
- [Source: prd.eval-ux-last-mile.md §5.2]：REQ-UX-2.1–2.5
- [Source: story-6-2-coach-epic-story-filter/6-2-coach-epic-story-filter.md]：inline 筛选实现；本 Story 完成后可迁移为复用 query 层
- [Source: story-6-1-coach-command-no-args/6-1-coach-command-no-args.md]：getScoringDataPath、discovery 模式
