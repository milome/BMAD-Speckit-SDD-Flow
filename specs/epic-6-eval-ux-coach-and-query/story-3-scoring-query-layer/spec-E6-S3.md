# Spec E6-S3：评分查询层（scoring/query/）

*Story 6.3 技术规格*  
*Epic E6 eval-ux-coach-and-query*

---

## 1. 概述

本 spec 将 Story 6.3 的实现范围固化为可执行技术规格，覆盖 `scoring/query/` 索引层 API：queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario；以及 epic_id/story_id 解析规则、同 run_id+stage 去重、Epic/Story 仅 real_dev 的隔离约束。

**输入来源**：
- `_bmad-output/implementation-artifacts/epic-6-eval-ux-coach-and-query/story-6-3-scoring-query-layer/6-3-scoring-query-layer.md`
- `prd.eval-ux-last-mile.md` §5.2（REQ-UX-2.1–2.5）
- `scoring/docs/RUN_ID_CONVENTION.md`
- `scoring/constants/path.ts`（getScoringDataPath）、`scoring/writer/types.ts`（RunScoreRecord）
- `scoring/coach/discovery.ts`、`scoring/coach/filter-epic-story.ts`（可复用逻辑）

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story §1 REQ-UX-2.1 | queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario | spec §3.1, §3.2 | ✅ |
| Story §1 REQ-UX-2.2 | epic_id/story_id 从 run_id 约定或 source_path 提取；无约定时明确反馈 | spec §3.3, §3.5, §3.6 | ✅ |
| Story §1 REQ-UX-2.3 | 同 run_id+stage 取 timestamp 最新一条去重 | spec §3.4 | ✅ |
| Story §1 REQ-UX-2.4 | Epic/Story 筛选仅针对 real_dev；eval_question 数据隔离 | spec §3.2, §3.5 | ✅ |
| Story §1 REQ-UX-2.5 | 仅读取评分 schema 文件；排除非评分 json | spec §3.4 | ✅ |
| Story §3.1 | queryByEpic(epicId) 返回 Epic N 所有评分（仅 real_dev） | spec §3.2 | ✅ |
| Story §3.1 | queryByStory(epicId, storyId) 返回 Story X.Y 评分（仅 real_dev） | spec §3.2 | ✅ |
| Story §3.1 | queryLatest(n) 按 timestamp 排序返回最新 n 条 | spec §3.2 | ✅ |
| Story §3.1 | queryByStage(runId, stage) 按 stage 筛选指定 run | spec §3.2 | ✅ |
| Story §3.1 | queryByScenario(scenario) 按 scenario 筛选 | spec §3.2 | ✅ |
| Story §3.2 | run_id 正则 `-e(\d+)-s(\d+)-` 或 `-e(\d+)-s(\d+)$` | spec §3.3 | ✅ |
| Story §3.2 | source_path fallback：story-{epic}-{story}-*、epic-{N}-*/story-{N}-* | spec §3.3 | ✅ |
| Story §3.2 | 无匹配时返回空数组；调用方可根据空数组判断 | spec §3.6 | ✅ |
| Story §3.3 | 去重：同 run_id+stage 取 timestamp 最新一条 | spec §3.4 | ✅ |
| Story §3.4 | Epic/Story 仅 real_dev；eval_question 与 real_dev 隔离 | spec §3.2, §3.5 | ✅ |
| Story §3.5 | 从 getScoringDataPath() 下 *.json 与 scores.jsonl 读取 | spec §3.4 | ✅ |
| Story §3.5 | 排除 sft-dataset.json 等非评分 schema | spec §3.4 | ✅ |
| Story §3.5 | 仅解析符合 RunScoreRecord 的记录 | spec §3.4 | ✅ |
| Story §4 AC-1 | queryByStory(3,3) 返回 Story 3.3 的所有评分记录 | spec §3.2, §3.8 | ✅ |
| Story §4 AC-2 | 同 run_id+stage 仅返回 timestamp 最新一条 | spec §3.4, §3.8 | ✅ |
| Story §4 AC-3 | queryLatest(10) 返回按 timestamp 排序的最新 10 条 | spec §3.2, §3.8 | ✅ |
| Story §4 AC-4 | Epic/Story 筛选仅 real_dev；eval_question 隔离 | spec §3.2, §3.5, §3.8 | ✅ |
| Story §4 AC-5 | queryByEpic(3) 返回 Epic 3 的 real_dev 记录 | spec §3.2, §3.8 | ✅ |
| Story §4 AC-6 | queryByStage(runId,'prd') 返回该 run 下 stage=prd 记录 | spec §3.2, §3.8 | ✅ |
| Story §4 AC-7 | queryByScenario('eval_question') 返回 scenario=eval_question | spec §3.2, §3.8 | ✅ |
| Story §6.1 | 不修改 RunScoreRecord schema；epic_id/story_id 由解析得出 | spec §3.4 | ✅ |
| Story §6.2 | 复用 getScoringDataPath、RunScoreRecord、discovery/filter-epic-story | spec §3.4, §3.5 | ✅ |
| Story §6.4 | 新增 scoring/query/index.ts、loader、parse-epic-story | spec §3.7 | ✅ |
| Story §6.5 | 单元测试：query 方法、去重、Epic/Story 解析、scenario 隔离 | spec §5 | ✅ |

---

## 3. 功能规格

### 3.1 API 概览

| API | 签名 | 行为 | scenario 约束 |
|-----|------|------|----------------|
| queryByEpic | `(epicId: number) => RunScoreRecord[]` | 返回 Epic N 的所有评分记录 | 仅 real_dev |
| queryByStory | `(epicId: number, storyId: number) => RunScoreRecord[]` | 返回 Story X.Y 的评分记录 | 仅 real_dev |
| queryLatest | `(n: number) => RunScoreRecord[]` | 按 timestamp 降序返回最新 n 条 | 全部（含 eval_question） |
| queryByStage | `(runId: string, stage: string) => RunScoreRecord[]` | 返回指定 run_id 下 stage 匹配的记录 | 全部 |
| queryByScenario | `(scenario: 'real_dev' \| 'eval_question') => RunScoreRecord[]` | 按 scenario 筛选 | 全部 |

### 3.2 各 API 行为规格

#### 3.2.1 queryByEpic(epicId)

1. 加载所有评分记录（经去重）。
2. 过滤 `scenario !== 'real_dev'` 的记录（即仅保留 real_dev）。
3. 对每条记录解析 epic_id（run_id 正则 → source_path fallback）。
4. 保留 `parsedEpicId === epicId` 的记录。
5. 无法解析的记录不保留。
6. 返回过滤后的数组；无可解析或无匹配时返回空数组 `[]`。

#### 3.2.2 queryByStory(epicId, storyId)

1. 加载所有评分记录（经去重）。
2. 过滤 `scenario !== 'real_dev'` 的记录。
3. 对每条记录解析 (epic_id, story_id)。
4. 保留 `parsedEpicId === epicId && parsedStoryId === storyId` 的记录。
5. 无解析或无匹配时返回空数组 `[]`。

#### 3.2.3 queryLatest(n)

1. **边界**：n ≤ 0 时返回空数组 `[]`。
2. 加载所有评分记录（经去重）。
3. 按 timestamp 降序排序；timestamp 相同时按 run_id 字典序作为稳定次级排序。
4. 取前 n 条返回。
5. 不限制 scenario。

#### 3.2.4 queryByStage(runId, stage)

1. 加载所有评分记录（经去重）。
2. 保留 `run_id === runId && stage === stage` 的记录。
3. 返回过滤后的数组。
4. 不限制 scenario。

#### 3.2.5 queryByScenario(scenario)

1. **边界**：scenario 非 `'real_dev'` 且非 `'eval_question'` 时返回空数组 `[]`。
2. 加载所有评分记录（经去重）。
3. 保留 `record.scenario === scenario` 的记录。
4. 返回过滤后的数组。

### 3.3 epic_id / story_id 解析规则

遵循 `scoring/docs/RUN_ID_CONVENTION.md` §2、§3。

#### 3.3.1 run_id 正则

| 正则 | 提取 | 示例 |
|------|------|------|
| `-e(\d+)-s(\d+)-` | epicId, storyId | `dev-e4-s2-story-1730812345` → (4, 2) |
| `-e(\d+)-s(\d+)$` | epicId, storyId | `dev-e5-s5-1730812345` → (5, 5) |

组合为单一正则：`/-e(\d+)-s(\d+)(?:-|$)/`。

#### 3.3.2 source_path fallback（run_id 无匹配时）

按 RUN_ID_CONVENTION §3 与 Story §3.2 一致顺序尝试（story 路径优先，epic 路径次之）：

| 优先级 | 模式 | 示例 path | (epic, story) |
|--------|------|-----------|---------------|
| 1 | `story-(\d+)-(\d+)-` | `story-4-2-eval-ai-coach` | (4, 2) |
| 2 | `epic-(\d+)-[^/]*/story-(\d+)-` | `epic-5-feature-eval/story-5-eval-analytics-advanced` | (5, 5) |

无 `source_path` 或两正则均不匹配时，返回 `null`（该记录不参与 Epic/Story 筛选）。

**注意**：filter-epic-story.ts 当前为 epic 路径优先；本 Story 实现时按上表顺序（与 RUN_ID_CONVENTION、Story 一致），query 层与 filter-epic-story 可后续统一。

### 3.4 数据加载与去重

| 项目 | 规格 |
|------|------|
| 数据路径 | `getScoringDataPath()`（`scoring/constants/path.ts`） |
| 数据源 | `*.json`（排除 sft-dataset.json）与 `scores.jsonl` |
| 排除列表 | `EXCLUDED_JSON = ['sft-dataset.json']`，可扩展 |
| schema 校验 | `isRunScoreRecord(obj)`：与 discovery.ts / filter-epic-story.ts 一致，至少校验 run_id（非空 string）、timestamp（string）、scenario（'real_dev' \| 'eval_question'）、stage（string）；其他字段可选 |
| 去重规则 | 同 `(run_id, stage)` 取 `timestamp` 最新一条；其他记录丢弃 |

**去重实现建议**：按 `(run_id, stage)` 分组，每组取 timestamp 最大的一条。

### 3.5 复用与抽取

| 模块 | 复用内容 | 抽取/新建 |
|------|----------|-----------|
| `scoring/constants/path.ts` | `getScoringDataPath()` | 直接 import |
| `scoring/writer/types.ts` | `RunScoreRecord`、`isRunScoreRecord` 等价逻辑 | 直接 import；isRunScoreRecord 可在 query 层实现或从 discovery 抽取 |
| `scoring/coach/discovery.ts` | `loadAllRecords`、`parseRecords`、`EXCLUDED_JSON` | 抽取到 `scoring/query/loader.ts` 或等价，或复用（若 discovery 导出） |
| `scoring/coach/filter-epic-story.ts` | `parseEpicStoryFromRecord`、`RUN_ID_EPIC_STORY_RE`、source_path 正则 | 抽取到 `scoring/query/parse-epic-story.ts`；query 层可 import 或内联 |

**注意**：filter-epic-story.ts 的 `parseEpicStoryFromSourcePath` 使用 `SOURCE_PATH_EPIC_STORY_RE`（epic-{N}-*/story-{N}-*）与 `SOURCE_PATH_STORY_EPIC_STORY_RE`（story-{epic}-{story}-*），顺序与 RUN_ID_CONVENTION §3 一致，可直接复用。

### 3.6 无匹配反馈

| 场景 | 行为 |
|------|------|
| 无任何评分记录 | 各 query 返回空数组 `[]` |
| 有记录但 run_id/source_path 均无法解析 Epic/Story | queryByEpic、queryByStory 返回空数组 `[]` |
| 有可解析记录但筛选后无匹配 | queryByEpic、queryByStory 返回空数组 `[]` |

调用方根据空数组判断「无可筛选数据」；实现可附加说明字段（如 `{ records: [], reason?: string }`），但本 spec 以「返回空数组」为最低要求，附加说明为可选增强。

### 3.7 模块结构

| 文件 | 职责 |
|------|------|
| `scoring/query/index.ts` | 导出 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario |
| `scoring/query/loader.ts` | 数据加载（getScoringDataPath、*.json、scores.jsonl）、isRunScoreRecord、去重 |
| `scoring/query/parse-epic-story.ts` | parseEpicStoryFromRecord（或 run_id + source_path 解析） |

可选：将 loader 与 parse 合并到 index，或拆分为更多子模块，以单一职责为宜。

### 3.8 验收命令

**执行方式**：通过单元测试（`scoring/query/__tests__/*.test.ts`）或验收脚本（如 `scripts/` 下调用 query 层）执行；可直接 `import { queryByEpic, ... } from './scoring/query'` 进行验证。

| 命令/场景 | 预期 |
|-----------|------|
| `queryByStory(3, 3)`（存在 Story 3.3 记录） | 返回 Story 3.3 的所有评分记录（经去重） |
| `queryByEpic(3)`（存在 Epic 3 real_dev 记录） | 返回 Epic 3 的 real_dev 记录 |
| `queryLatest(10)`（存在评分数据） | 返回按 timestamp 降序的最新 10 条 |
| `queryLatest(0)` 或 `queryLatest(-1)` | 返回空数组 `[]` |
| `queryByStage(runId, 'prd')`（存在该 run 的 prd 记录） | 返回 run_id=runId 且 stage=prd 的记录 |
| `queryByScenario('eval_question')`（存在 eval_question 记录） | 返回 scenario=eval_question 的记录 |
| `queryByScenario('invalid')` | 返回空数组 `[]` |
| 同 run_id+stage 存在多条 | 各 query 结果中同 run_id+stage 仅一条（timestamp 最新） |
| Epic/Story 查询 | 不包含 scenario=eval_question 的记录 |

---

## 4. 数据源与 schema

- **RunScoreRecord**：`scoring/writer/types.ts`；含 `run_id`、`scenario`、`stage`、`timestamp`、`source_path` 等。
- **RUN_ID_CONVENTION**：`scoring/docs/RUN_ID_CONVENTION.md` §2（run_id 格式）、§3（source_path fallback）。
- **不修改**：RunScoreRecord schema 不新增必填字段；epic_id/story_id 由解析得出，不写入 record。

---

## 5. 测试要求

| 类型 | 覆盖范围 | spec 对应 |
|------|----------|-----------|
| 单元测试 | queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario | §3.2 |
| 单元测试 | 去重逻辑：同 run_id+stage 仅一条 | §3.4 |
| 单元测试 | epic_id/story_id 解析：run_id 正则、source_path fallback | §3.3 |
| 单元测试 | scenario 隔离：Epic/Story 不包含 eval_question | §3.2, §3.5 |
| 集成/端到端 | 使用临时 dataPath fixture，验证 query 在有/无数据时行为符合 AC | §3.8 |
| 集成 | 验证 query 模块被生产代码关键路径导入（Story 6.2 迁移或 Story 6.4 复用） | scope 约束 |

---

## 6. 依赖与约束

- **Story 6.1**：复用 `getScoringDataPath`、`RunScoreRecord`；可复用 discovery 的加载模式。
- **Story 6.2**：filter-epic-story 的解析逻辑可抽取；6.2 完成后可迁移为复用 query 层。
- **Story 6.4**：`/bmad-scores` 将复用本 Story API。
- **禁止**：修改 RunScoreRecord schema；将 epic_id/story_id 写入 record；写入 scoring/data/（查询层只读）。
