# plan-E6-S3：评分查询层（scoring/query/）实现方案

**Epic**：E6 eval-ux-coach-and-query  
**Story ID**：6.3  
**输入**：`spec-E6-S3.md`、Story 6.3、`prd.eval-ux-last-mile.md` §5.2、`scoring/docs/RUN_ID_CONVENTION.md`

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story §1 REQ-UX-2.1 | spec §3.1, §3.2 | Phase 3, §4 | ✅ |
| Story §1 REQ-UX-2.2 | spec §3.3, §3.5, §3.6 | Phase 2, Phase 3 | ✅ |
| Story §1 REQ-UX-2.3 | spec §3.4 | Phase 1 | ✅ |
| Story §1 REQ-UX-2.4 | spec §3.2, §3.5 | Phase 3 | ✅ |
| Story §1 REQ-UX-2.5 | spec §3.4 | Phase 1 | ✅ |
| Story §3.1 五类 API | spec §3.2 | Phase 3, §5 | ✅ |
| Story §3.2 解析规则 | spec §3.3 | Phase 2 | ✅ |
| Story §3.3 去重 | spec §3.4 | Phase 1 | ✅ |
| Story §3.5 数据源 | spec §3.4 | Phase 1 | ✅ |
| Story §4 AC-1～AC-7 | spec §3.8 | Phase 5, §6 | ✅ |
| Story §6.2 复用 | spec §3.5 | Phase 1, Phase 2 | ✅ |
| Story §6.5 测试 | spec §5 | Phase 5 | ✅ |

---

## 2. 目标与约束

- 在 `scoring/query/` 下实现 queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario 五类查询 API。
- 数据加载复用 `getScoringDataPath()`，从 `*.json` 与 `scores.jsonl` 读取，排除 sft-dataset.json。
- 同 run_id+stage 取 timestamp 最新一条去重。
- Epic/Story 查询仅针对 real_dev；eval_question 与 real_dev 隔离。
- epic_id/story_id 由 run_id 正则或 source_path fallback 解析，不写入 RunScoreRecord。
- **必须包含**完整的集成测试与端到端功能测试计划：验证 query 模块在生产代码关键路径中被导入并调用（Story 6.2 迁移或 Story 6.4 或验收脚本调用）。

---

## 3. 实施分期

### Phase 1：数据加载与去重（scoring/query/loader.ts）

1. 新建 `scoring/query/loader.ts`：
   - 导出 `loadAndDedupeRecords(dataPath?: string): RunScoreRecord[]`。
   - 使用 `getScoringDataPath()` 获取数据路径；若传入 dataPath 则覆盖（便于测试 fixture）。
   - 扫描 `*.json`（排除 EXCLUDED_JSON=['sft-dataset.json']）与 `scores.jsonl`，解析为 RunScoreRecord[]。
   - `isRunScoreRecord(obj)`：至少校验 run_id（非空 string）、timestamp（string）、scenario（'real_dev'|'eval_question'）、stage（string）；与 discovery/filter-epic-story 一致。
   - **去重**：按 `(run_id, stage)` 分组，每组取 timestamp 最大的一条； timestamp 相同时取任意一条（或 run_id 字典序稳定）。
2. 复用或抽取 discovery.ts 的加载逻辑；EXCLUDED_JSON 与 discovery 一致。

### Phase 2：epic_id/story_id 解析（scoring/query/parse-epic-story.ts）

1. 新建 `scoring/query/parse-epic-story.ts`：
   - 导出 `parseEpicStoryFromRecord(record: RunScoreRecord): { epicId: number; storyId: number } | null`。
   - **run_id 正则**：`/-e(\d+)-s(\d+)(?:-|$)/`，匹配则返回 (epicId, storyId)。
   - **source_path fallback**（run_id 无匹配时）：按 spec §3.3.2 顺序：1) `story-(\d+)-(\d+)-`，2) `epic-(\d+)-[^/]*/story-(\d+)-`。
   - 无匹配返回 null。
2. 可与 `scoring/coach/filter-epic-story.ts` 的 `parseEpicStoryFromRecord` 抽取共用，或独立实现（顺序与 spec 一致：story 优先、epic 次之）。

### Phase 3：query API（scoring/query/index.ts）

1. 新建 `scoring/query/index.ts`，导出五类 API：
   - `queryByEpic(epicId: number, dataPath?: string): RunScoreRecord[]`
   - `queryByStory(epicId: number, storyId: number, dataPath?: string): RunScoreRecord[]`
   - `queryLatest(n: number, dataPath?: string): RunScoreRecord[]`
   - `queryByStage(runId: string, stage: string, dataPath?: string): RunScoreRecord[]`
   - `queryByScenario(scenario: 'real_dev' | 'eval_question', dataPath?: string): RunScoreRecord[]`
2. 各 API 内部调用 `loadAndDedupeRecords(dataPath)` 获取去重后记录，再按 spec §3.2 规则过滤。
3. **边界**：queryLatest(n≤0) → []; queryByScenario(非法) → []。
4. **queryLatest** 排序：timestamp 降序；相同时 run_id 字典序稳定。

### Phase 4：集成与关键路径验证

1. **本 Story 范围内**（不修改 Story 6.2 / 6.4 生产代码）：
   - 新建 `scripts/query-validate.ts` 或等价验收脚本，`import { queryByEpic, queryByStory, queryLatest } from 'scoring/query'`，调用 queryByStory(3,3)、queryByEpic(3)、queryLatest(10) 并输出结果，验证有/无数据时行为符合 AC。
   - 单元测试中显式 `import` query 模块并调用，确认 API 可被外部使用。
2. **生产代码关键路径验证**（显式职责划分）：
   - **本 Story 不覆盖** coach-diagnose、bmad-scores 等生产入口对 query 的调用。
   - **Story 6.2**：已完成 inline 筛选；本 Story 完成后，6.2 **可**迁移为复用 queryByEpic/queryByStory，迁移为 6.2 或后续 Story 职责。
   - **Story 6.4**：`/bmad-scores` 将**复用**本 Story API，作为生产关键路径集成点。
   - **GAP/tasks 记录**：在 IMPLEMENTATION_GAPS 与 tasks 中明确「生产路径导入验证由 Story 6.2（迁移）或 6.4（bmad-scores）负责；本 Story 产出可导入的 query 模块及验收脚本」。
3. **孤岛模块风险缓解**：query 模块设计为可被 6.2、6.4 直接 import；验收脚本证明 import 路径正确；6.2/6.4 实施时无额外改造成本。

### Phase 5：测试与回归

1. **单元测试**：`scoring/query/__tests__/*.test.ts`
   - loader：加载、去重、isRunScoreRecord、EXCLUDED_JSON。
   - parse-epic-story：run_id 正则、source_path fallback（story 优先、epic 次之）、无匹配 null。
   - query：queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario；边界 n≤0、非法 scenario；scenario 隔离（Epic/Story 不包含 eval_question）。
2. **集成/端到端**：使用临时 dataPath fixture（不污染真实 scoring/data）；验证 query 在有/无数据时行为符合 AC；验证 query 模块被 import 并调用。

---

## 4. 模块与文件改动设计

### 4.1 新增文件

| 文件 | 责任 | 对应需求 |
|------|------|----------|
| `scoring/query/index.ts` | 导出 5 个 query API | spec §3.7 |
| `scoring/query/loader.ts` | loadAndDedupeRecords、isRunScoreRecord、EXCLUDED_JSON | spec §3.4 |
| `scoring/query/parse-epic-story.ts` | parseEpicStoryFromRecord（run_id + source_path） | spec §3.3 |
| `scoring/query/__tests__/loader.test.ts` | 加载、去重、schema 校验 | spec §5 |
| `scoring/query/__tests__/parse-epic-story.test.ts` | 解析逻辑 | spec §5 |
| `scoring/query/__tests__/query.test.ts` | 5 个 query API、边界、隔离 | spec §5 |
| `scripts/query-validate.ts`（可选） | 验收脚本，import 并调用 query | spec §3.8 |

### 4.2 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| 无 | - | 本 Story 为新增 query 层，不修改现有生产代码；可选后续修改 Story 6.2 以复用 query |

### 4.3 数据路径

- 根路径：`getScoringDataPath()`（`scoring/constants/path.ts`）
- 各 query API 支持可选 dataPath 覆盖，便于 fixture 测试。

---

## 5. 详细技术方案

### 5.1 loader.ts 接口

```ts
export const EXCLUDED_JSON = ['sft-dataset.json'];

export function isRunScoreRecord(obj: unknown): obj is RunScoreRecord;

export function loadAndDedupeRecords(dataPath?: string): RunScoreRecord[];
```

- `loadAndDedupeRecords`：加载所有符合 RunScoreRecord 的记录；按 (run_id, stage) 分组，每组保留 timestamp 最大的一条；返回去重后的数组。

### 5.2 parse-epic-story.ts 接口

```ts
export function parseEpicStoryFromRecord(
  record: RunScoreRecord
): { epicId: number; storyId: number } | null;
```

- run_id：`/-e(\d+)-s(\d+)(?:-|$)/`
- source_path 顺序：1) `/story-(\d+)-(\d+)-/`，2) `/epic-(\d+)-[^/]*\/story-(\d+)-/`

### 5.3 query index 接口

```ts
export function queryByEpic(epicId: number, dataPath?: string): RunScoreRecord[];
export function queryByStory(epicId: number, storyId: number, dataPath?: string): RunScoreRecord[];
export function queryLatest(n: number, dataPath?: string): RunScoreRecord[];
export function queryByStage(runId: string, stage: string, dataPath?: string): RunScoreRecord[];
export function queryByScenario(scenario: 'real_dev' | 'eval_question', dataPath?: string): RunScoreRecord[];
```

### 5.4 生产代码关键路径验证

- **scoring/query/index.ts**：作为模块入口，被 scripts、Story 6.2（迁移后）、Story 6.4 导入。
- **验收脚本**：`scripts/query-validate.ts` 或单元测试中 `import { queryByEpic, ... } from '../../query'` 并调用，验证 API 可被外部使用。
- **集成验收**：有 fixture 数据时，queryByStory(3,3)、queryByEpic(3)、queryLatest(10) 返回符合 AC 的结果；无数据时返回空数组。

---

## 6. 测试计划（单元 + 集成 + 端到端）

### 6.1 单元测试

| 测试文件 | 覆盖点 | 命令 |
|----------|--------|------|
| `scoring/query/__tests__/loader.test.ts` | loadAndDedupeRecords：空目录、单文件、jsonl、去重（同 run_id+stage 仅一条）；isRunScoreRecord；EXCLUDED_JSON | `npm run test:scoring -- scoring/query/__tests__/loader.test.ts` |
| `scoring/query/__tests__/parse-epic-story.test.ts` | run_id 正则、source_path story 优先、epic 次之、无匹配 null | `npm run test:scoring -- scoring/query/__tests__/parse-epic-story.test.ts` |
| `scoring/query/__tests__/query.test.ts` | queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario；n≤0、非法 scenario；Epic/Story 不包含 eval_question | `npm run test:scoring -- scoring/query/__tests__/query.test.ts` |

### 6.2 集成测试

| 测试场景 | 验证目标 | 方式 |
|----------|----------|------|
| query 模块被 import | 从 `scoring/query` 导入并调用，证明 API 可被外部使用 | 单元测试或验收脚本中 `import { queryByEpic } from '../query'` |
| fixture 数据 | 临时 dataPath 下放置 2–3 条 RunScoreRecord，验证 queryByStory、queryLatest 返回正确 | query.test.ts 使用 `path.join(__dirname, 'fixtures', 'sample-data')` 或 os.tmpdir |
| 生产路径验证 | 本 Story 不实施；由 Story 6.2（迁移）或 6.4（bmad-scores）负责 | 记录于 IMPLEMENTATION_GAPS、tasks；6.2/6.4 实施时补齐 |

### 6.3 端到端 / 验收命令

| 场景 | 验证目标 | 命令 |
|------|----------|------|
| AC-1 queryByStory | 存在 Story 3.3 记录时返回该 Story 记录 | 单元测试 + 可选 `npx ts-node scripts/query-validate.ts` |
| AC-2 去重 | 同 run_id+stage 仅一条 | 单元测试 |
| AC-3 queryLatest | 返回 timestamp 排序最新 n 条 | 单元测试 |
| AC-4 Epic/Story 仅 real_dev | 不包含 eval_question | 单元测试 |
| AC-5 queryByEpic | 返回 Epic N real_dev 记录 | 单元测试 |
| AC-6 queryByStage | 返回 run_id+stage 匹配 | 单元测试 |
| AC-7 queryByScenario | 返回 scenario 匹配 | 单元测试 |

---

## 7. 执行准入标准

- 生成 `tasks-E6-S3.md` 后，所有任务须具备明确文件路径与验收命令。
- 单元测试全部通过：`npm run test:scoring -- scoring/query`
- 集成验证：query 模块可被 import 并正确返回数据（验收脚本或单元测试）。
- 生产路径集成（coach-diagnose、bmad-scores 调用 query）：由 Story 6.2/6.4 负责，记录于 tasks/GAP。
- 通过 code-review 审计后方可进入下一阶段。
