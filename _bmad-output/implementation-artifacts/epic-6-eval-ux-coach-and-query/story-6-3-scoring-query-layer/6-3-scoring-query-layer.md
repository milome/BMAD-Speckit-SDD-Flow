# Story 6.3：评分查询层（scoring/query/）

**Epic**：6 eval-ux-coach-and-query  
**Story**：6.3  
**Slug**：scoring-query-layer  
**来源**：epics.md §Epic 6、prd.eval-ux-last-mile.md §5.2（REQ-UX-2）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-2.1 | 在 `scoring/query/` 下提供 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario | 是 | AC-1, AC-3 |
| REQ-UX-2.2 | epic_id/story_id 从 run_id 约定或 source_path 提取；无约定时明确反馈 | 是 | AC-1, AC-4 |
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
   - `queryByEpic(epicId)`：返回 Epic N 的所有评分记录  
   - `queryByStory(epicId, storyId)`：返回 Story X.Y 的评分记录  
   - `queryLatest(n)`：按 timestamp 排序返回最新 n 条  
   - `queryByStage(runId, stage)`：按 stage 筛选  
   - `queryByScenario(scenario)`：按 scenario 筛选  

2. **epic_id/story_id 解析规则**  
   - 从 run_id 约定（`scoring/docs/RUN_ID_CONVENTION.md`）或 source_path 提取 epic_id、story_id  
   - 正则：`-e(\d+)-s(\d+)-` 或 `-e(\d+)-s(\d+)$`  
   - source_path 作为 fallback（如 `epic-{N}-*/story-{N}-*`、`story-{epic}-{story}-*`）  
   - 无约定时，调用方得到明确反馈  

3. **去重规则**  
   - 同 run_id+stage 取 timestamp 最新一条

4. **Epic/Story 筛选范围**  
   - 仅针对 real_dev；eval_question 数据与 real_dev 隔离，Epic/Story 筛选不包含 eval_question 记录  

5. **数据源**  
   - 从 `getScoringDataPath()` 下 `*.json`（仅评分 schema）与 `scores.jsonl` 读取

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| `/bmad-coach --epic/--story` 调用 | Story 6.2 | 6.3 为底层 API，6.2 作为调用方 |
| `/bmad-scores` Command | Story 6.4 | 6.4 复用本 Story API |
| 组合 queryByFilters API | GAP-024 | 后续迭代 |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 按 Story 查询 | 存在 Story 3.3 的评分记录（符合 run_id 约定） | 调用 queryByStory(3, 3) | 返回 Story 3.3 的所有评分记录 |
| AC-2 | 去重 | 同 run_id+stage 存在多条记录 | 调用任一 query 方法 | 同 run_id+stage 仅返回 timestamp 最新一条 |
| AC-3 | 数据源 | scoring/data/*.json 与 scores.jsonl 存在 | 调用 queryLatest(10) | 返回按 timestamp 排序的最新 10 条 |
| AC-4 | Epic/Story 仅 real_dev | 记录含 scenario 字段 | Epic/Story 筛选 | 仅针对 real_dev；eval_question 数据隔离 |

---

## 5. 禁止词表合规声明

本 Story 文档已避免使用本 skill § 禁止词表所列全部词汇。所有范围界定均采用明确归属（由 Story X.Y 负责或 GAP 编号）。

---

## 6. 产出物清单

| 产出 | 路径 |
|------|------|
| query 模块 | `scoring/query/` 目录及 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario 实现 |
| 解析工具 | epic_id/story_id 解析（run_id 正则 + source_path fallback） |
| 单元测试 | 覆盖上述 query 方法与去重、隔离逻辑 |
