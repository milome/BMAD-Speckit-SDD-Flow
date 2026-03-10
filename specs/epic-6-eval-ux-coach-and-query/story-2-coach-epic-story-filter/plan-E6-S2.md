# plan-E6-S2：Coach 按 Epic/Story 筛选 实现方案

**Epic**：E6 eval-ux-coach-and-query  
**Story ID**：6.2  
**输入**：`spec-E6-S2.md`、Story 6.2、`prd.eval-ux-last-mile.md` §5.1–§5.2、`scoring/docs/RUN_ID_CONVENTION.md`

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story §1 REQ-UX-1.5、1.6 | spec §3.2, §3.4, §3.5 | Phase 2, §4.2 | ✅ |
| Story §1 REQ-UX-2.2、2.4 | spec §3.3, §3.4, §3.6 | Phase 1, §4.1 | ✅ |
| Story §3.1、§3.2 | spec §3.2–§3.6 | Phase 1, Phase 2, §4 | ✅ |
| Story §4 AC-1、AC-2、AC-3 | spec §3.5, §3.6, §3.8 | Phase 2, Phase 4 | ✅ |
| Story §5.1、5.2、5.3 | spec §3.5, §3.7 | Phase 1, Phase 2, Phase 3 | ✅ |
| Story §7.3 | spec §5 | Phase 5 | ✅ |

---

## 2. 目标与约束

- 扩展 `scripts/coach-diagnose.ts` 支持 `--epic N`、`--story X.Y`。
- 使用最小 inline 筛选（run_id 正则 + source_path fallback）；Story 6.3 未实现，不依赖 `scoring/query/`。
- 扩展 `coachDiagnose` 支持 `options.records`，使诊断可基于预筛选 records。
- Epic/Story 筛选仅针对 `scenario !== 'eval_question'` 的记录。
- 无匹配时输出明确反馈（「无可筛选数据」或「当前评分记录无可解析 Epic/Story」）。
- **必须包含**完整的集成测试与端到端功能测试计划，验证 `--epic`、`--story` 在生产代码关键路径中正确调用并输出。

---

## 3. 实施分期

### Phase 1：Inline 筛选逻辑（scoring/coach/）

1. 在 `scoring/coach/` 新增 `filter-epic-story.ts`：
   - 导出 `loadAllRecords(dataPath: string): RunScoreRecord[]`（从 discovery 提取或复用内部加载逻辑；若 discovery 不导出则在本模块内实现等价加载）。
   - 导出 `parseEpicStoryFromRecord(record: RunScoreRecord): { epicId: number; storyId: number } | null`：run_id 正则 `-e(\d+)-s(\d+)-`、`-e(\d+)-s(\d+)$` → 若无则 source_path fallback（`epic-{epic}-*/story-{story}-*`、`story-{epic}-{story}-*`）。
   - 导出 `filterByEpicStory(dataPath: string, filter: { epicId?: number; storyId?: number }): { records: RunScoreRecord[]; runId: string } | { error: string }`：
     - 加载所有记录；若返回空数组，则返回 `{ error: '暂无评分数据，请先完成至少一轮 Dev Story' }`；
     - 排除 `scenario === 'eval_question'`；
     - 逐条解析 epic/story；无可解析记录时返回 `{ error: '当前评分记录无可解析 Epic/Story，请确认 run_id 约定' }`；
     - 按 filter 匹配（epicId 时保留 parsedEpicId === epicId；storyId 时保留 parsedEpicId === X && parsedStoryId === Y）；
     - 无匹配时返回 `{ error: '无可筛选数据' }`；
     - 有匹配时按 run_id 分组，取「拥有最新 timestamp 的 record 的 run_id」作为诊断目标；返回该 run_id 对应的所有记录（与 loader 行为一致：同一 run_id 的多条 record）作为 `records`，`runId` 为 effective run_id。
   - **注意**：筛选后 records 可能来自同一 run_id 的多条（不同 stage），loader 原本按 runId 加载即得到该 run 的全部 record；因此「取最新 timestamp 的 run_id」后，需加载该 run_id 的全部 record。为与 coachDiagnose 对接，我们直接传入筛选后、且属于该 run_id 的 records（即匹配的 records 中，run_id 相同的全部记录，取 run_id=最新 timestamp 的那组）。简化：匹配 records 按 run_id 分组，取 timestamp 最新的 run_id，再从原始加载中取出该 run_id 的所有 record（含各 stage），作为诊断输入。

2. **简化实现**：`filterByEpicStory` 返回 `{ records, runId }` 时，records 为「匹配 filter 的、且 run_id 等于 effectiveRunId 的」所有 record。effectiveRunId = 匹配记录中 timestamp 最新的那条的 run_id。这样 records 即该 run 的全部 record，与 loader 按 runId 加载结果一致。

3. **复用 discovery**：`discovery.ts` 的 `loadAllRecords` 为模块内私有；提取为独立可导出函数或在本模块内复制等价逻辑。为减少改动，在 `filter-epic-story.ts` 内实现 `loadAllRecordsForFilter`（与 discovery 的 loadAllRecords 逻辑一致），避免修改 discovery 的现有接口。

### Phase 2：coachDiagnose 扩展（options.records）

1. 修改 `scoring/coach/types.ts`：`CoachDiagnoseOptions` 新增 `records?: RunScoreRecord[]`。
2. 修改 `scoring/coach/diagnose.ts`：
   - 若 `options.records` 非空且 `options.records.length > 0`，则跳过 `loadRunRecords`，直接使用 `options.records` 作为诊断输入；
   - 此时 `runId` 仍必填（用于 summary 等），取 `options.records[0].run_id` 或由调用方传入。

### Phase 3：脚本扩展（scripts/coach-diagnose.ts）

1. 解析 `--epic N`、`--story X.Y`：
   - `--epic N`：校验 N 为 `\d+`，否则报错 exit 1；
   - `--story X.Y`：校验 X.Y 为 `\d+\.\d+`，解析为 epicId=X, storyId=Y；
   - `--epic` 与 `--story` 互斥，同时传入时报错 exit 1。
2. 当存在 `--epic` 或 `--story` 时：
   - 调用 `filterByEpicStory(dataPath, { epicId, storyId })`；
   - 若返回 `{ error }`，输出 error 并 exit 0；
   - 若返回 `{ records, runId }`，调用 `coachDiagnose(runId, { dataPath, records })` → `formatToMarkdown` / JSON 输出。
3. 当无 `--epic`、`--story` 时：保持现有逻辑（discovery → coachDiagnose）。
4. 空数据（filterByEpicStory 前可先检查 loadAllRecords 为空）：与 discovery 行为一致，输出「暂无评分数据，请先完成至少一轮 Dev Story」。

### Phase 4：Command 文档更新

1. 修改 `commands/bmad-coach.md`：新增 `--epic N`、`--story X.Y` 说明；验收命令 `npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3`。
2. 同步到 `.cursor/commands/bmad-coach.md`（若存在）。

### Phase 5：测试与回归

1. **单元测试**：`scoring/coach/__tests__/filter-epic-story.test.ts`：
   - `parseEpicStoryFromRecord`：run_id 正则、source_path fallback、无匹配返回 null；
   - `filterByEpicStory`：scenario 过滤、epic 匹配、story 匹配、无匹配、无可解析。
2. **集成/端到端**：`npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` 有数据/无数据/无约定；参数互斥、格式错误报错。

---

## 4. 模块与文件改动设计

### 4.1 新增文件

| 文件 | 责任 | 对应需求 | 对应任务 |
|------|------|----------|----------|
| `scoring/coach/filter-epic-story.ts` | loadAllRecordsForFilter、parseEpicStoryFromRecord、filterByEpicStory | spec §3.3, §3.4 | T1 |
| `scoring/coach/__tests__/filter-epic-story.test.ts` | 单元测试 | spec §5 | T5 |

### 4.2 修改文件

| 文件 | 变更 | 对应需求 | 对应任务 |
|------|------|----------|----------|
| `scoring/coach/types.ts` | CoachDiagnoseOptions 新增 records | spec §3.5 | T2 |
| `scoring/coach/diagnose.ts` | options.records 时跳过 loadRunRecords | spec §3.5 | T2 |
| `scripts/coach-diagnose.ts` | --epic、--story 解析与分支 | AC-1, AC-2, AC-3 | T3 |
| `commands/bmad-coach.md` | --epic、--story 说明 | spec §3.7 | T4 |
| `.cursor/commands/bmad-coach.md` | 同步 | spec §3.7 | T4 |

### 4.3 数据路径

- 根路径：`getScoringDataPath()`（`scoring/constants/path.ts`）
- 与 Story 6.1 一致。

---

## 5. 详细技术方案

### 5.1 filterByEpicStory 接口

```ts
export interface FilterEpicStoryResult {
  records: RunScoreRecord[];
  runId: string;
}

export interface FilterEpicStoryError {
  error: string;
}

export function filterByEpicStory(
  dataPath: string,
  filter: { epicId?: number; storyId?: number }
): FilterEpicStoryResult | FilterEpicStoryError;
```

- `epicId` 且无 `storyId`：保留 `parsedEpicId === epicId`；
- `epicId` 且 `storyId`（即 --story X.Y）：保留 `parsedEpicId === epicId && parsedStoryId === storyId`。
- 入参校验：`filter` 至少包含 epicId 或 storyId 之一（由脚本层保证）。

### 5.2 source_path 解析正则

- `epic-{epic}-*/story-{story}-*`：`/epic-(\d+)-[^/]*\/story-(\d+)-/` 或 `epic-(\d+)-[^/]*/story-(\d+)-`
- `story-{epic}-{story}-*`：`/story-(\d+)-(\d+)-/`

（与 RUN_ID_CONVENTION 保持一致）

### 5.3 coach-diagnose.ts 流程扩展

```text
parseArgs
  ├─ --epic 与 --story 同时 → 报错 exit 1
  ├─ --epic N / --story X.Y
  │    ├─ 格式无效 → 报错 exit 1
  │    └─ filterByEpicStory(dataPath, { epicId, storyId })
  │         ├─ { error } → 输出 error, exit 0
  │         └─ { records, runId } → coachDiagnose(runId, { dataPath, records }) → 输出
  ├─ --epic N 或 --story X.Y 单独
  │    └─ 同上
  └─ 无 --epic、--story
       └─ 现有逻辑（discovery → coachDiagnose）
```

### 5.4 生产代码关键路径验证

- **scripts/coach-diagnose.ts**：main() 有 --epic 或 --story 时调用 filterByEpicStory → coachDiagnose(runId, { records }) → formatToMarkdown。
- **commands/bmad-coach.md**：文档说明 --epic、--story 参数与验收命令。
- 集成验收：`npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` 可执行，有数据时输出诊断；无匹配时输出明确反馈。

---

## 6. 测试计划（单元 + 集成 + 端到端）

### 6.1 单元测试

| 测试文件 | 覆盖点 | 命令 |
|----------|--------|------|
| `scoring/coach/__tests__/filter-epic-story.test.ts` | parseEpicStoryFromRecord：run_id `-e1-s2-`、`-e1-s2`；source_path `epic-3-*/story-4-*`、`story-3-4-*`；scenario 过滤；无匹配 null | `npm run test:scoring -- scoring/coach/__tests__/filter-epic-story.test.ts` |
| 同上 | filterByEpicStory：空目录、无可解析、无匹配、epic 匹配、story 匹配、返回 records+runId | 同上 |

### 6.2 集成测试

| 测试文件 | 覆盖点 | 命令 |
|----------|--------|------|
| 脚本 E2E 或手动 | --epic 3 有数据、--story 3.3 有数据；无匹配；参数互斥；格式错误 | `npx ts-node scripts/coach-diagnose.ts --epic 3` 等 |

### 6.3 端到端 / CLI 验收

| 场景 | 验证目标 | 命令 |
|------|----------|------|
| AC-1 Epic 筛选 | 有 Epic 3 数据时仅诊断 Epic 3 | `npx ts-node scripts/coach-diagnose.ts --epic 3` |
| AC-2 Story 筛选 | 有 Story 3.3 数据时仅诊断 Story 3.3 | `npx ts-node scripts/coach-diagnose.ts --story 3.3` |
| AC-3 无约定 | 无可解析/无匹配时输出明确反馈 | 无约定数据时运行上述命令 |
| 空目录 | 无评分记录时 `--epic 3` 输出「暂无评分数据...」，exit 0 | `SCORING_DATA_PATH=/tmp/empty npx ts-node scripts/coach-diagnose.ts --epic 3` |
| 无参回归 | 无 `--epic`、`--story` 时行为与 Story 6.1 一致 | `npx ts-node scripts/coach-diagnose.ts` |
| 参数互斥 | 同时 --epic 与 --story 报错 | `npx ts-node scripts/coach-diagnose.ts --epic 3 --story 3.3` |
| 格式错误 | --epic abc 报错 | `npx ts-node scripts/coach-diagnose.ts --epic abc` |

---

## 7. 执行准入标准

- 生成 `tasks-E6-S2.md` 后，所有任务须具备明确文件路径与验收命令。
- filter-epic-story 单测 + 端到端 CLI 验收通过。
- 通过 `npm run test:scoring` 后方可进入 Story 6.2 实施收尾。
