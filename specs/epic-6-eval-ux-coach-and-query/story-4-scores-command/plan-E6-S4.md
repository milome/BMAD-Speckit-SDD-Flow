# plan-E6-S4：Scores Command 实现方案

**Epic**：E6 eval-ux-coach-and-query  
**Story ID**：6.4  
**输入**：`spec-E6-S4.md`、Story 6.4、`prd.eval-ux-last-mile.md` §5.2、Story 6.3（scoring/query/）

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story §1 REQ-UX-2.6 | spec §3.1, §3.2 | Phase 1–3, §4 | ✅ |
| Story §1 REQ-UX-2.2 | spec §3.4, §3.5 | Phase 2, §5.4 | ✅ |
| Story §1 REQ-UX-2.4 | spec §3.3 | Phase 2（复用 query） | ✅ |
| Story §1 REQ-UX-2.3 | spec §3.3 | Phase 2（复用 query） | ✅ |
| Story §3.1 Command | spec §3.1, §3.7 | Phase 1 | ✅ |
| Story §3.1 全部摘要 | spec §3.2.1 | Phase 2 | ✅ |
| Story §3.1 Epic/Story 模式 | spec §3.2.2, §3.2.3 | Phase 2 | ✅ |
| Story §3.1 查询层复用 | spec §3.3 | Phase 2 | ✅ |
| Story §3.1 输出格式 | spec §3.4, §3.5 | Phase 2, §5.3 | ✅ |
| Story §3.1 coach 迁移 | spec §3.6 | Phase 4 | ✅ |
| Story §4 AC-1～AC-6 | spec §3.8 | Phase 5, §6 | ✅ |

---

## 2. 目标与约束

- 新建 `/bmad-scores` Command 与 `scripts/scores-summary.ts` 脚本。
- 复用 scoring/query 的 queryByEpic、queryByStory、queryLatest；实现 formatScoresToTable(records, mode)。
- 实现无数据/无约定/无可筛选三种反馈文案的区分逻辑。
- 迁移 coach-diagnose 的 --epic/--story 分支从 filterByEpicStory 改为 queryByEpic、queryByStory；保持行为不变。
- **必须包含**完整的集成测试与端到端功能测试计划：验证 scores-summary 在生产入口可执行；coach-diagnose 迁移后行为一致。

---

## 3. 实施分期

### Phase 1：Command 文档与脚本骨架

1. 新建 `commands/bmad-scores.md`：
   - 定义 `/bmad-scores` 触发、参数（无参、`--epic N`、`--story X.Y`）、验收命令。
2. 新建 `scripts/scores-summary.ts`：
   - 解析 argv（--epic、--story）；互斥校验；参数校验（epic 正整数、story X.Y 格式）。
   - 调用 getScoringDataPath() 获取 dataPath。
   - 无参数时调用 queryLatest(100)；有 --epic 调用 queryByEpic；有 --story 调用 queryByStory。
   - 空数据时输出「暂无评分数据，请先完成至少一轮 Dev Story」。

### Phase 2：查询、表格格式化与反馈逻辑

1. **导入**：`import { queryByEpic, queryByStory, queryLatest } from '../scoring/query'`；`import { parseEpicStoryFromRecord } from '../scoring/query'`（若 index 导出）或 `from '../scoring/query/parse-epic-story'`。
2. **formatScoresToTable(records, mode)**：
   - mode='all'：表头 run_id | epic | story | stage | phase_score | phase_weight | timestamp；每行一条 record；epic/story 由 parseEpicStoryFromRecord 解析。
   - mode='epic'：表头 story | stage | phase_score | phase_weight | timestamp；story = epicId.storyId。
   - mode='story'：表头 stage | phase_score | phase_weight | check_items_summary | timestamp；check_items_summary 为 `{passed}/{total} passed`（passed = check_items.filter(c=>c.passed).length），无则 '-'。
3. **无数据/无约定区分**：
   - queryLatest(1) 为空 → 无数据。
   - queryByEpic/queryByStory 返回 [] 且 queryLatest(1) 非空：可选 loadAndDedupeRecords（若 query 导出 loader）过滤 real_dev 后遍历解析；若 parsable.length===0 → 无约定；否则 → 无可筛选数据。或简化：统一「无可筛选数据」。
4. 按 spec §3.2.1(6) 排序：全表按 timestamp 降序（简化实现）。

### Phase 3：输出与验收命令

1. 有数据时调用 formatScoresToTable 并 console.log 输出。
2. 验收命令：`npx ts-node scripts/scores-summary.ts`、`--epic 3`、`--story 3.3`。
3. 若存在 `.cursor/commands/`，同步 `bmad-scores.md`。

### Phase 4：coach-diagnose 迁移

1. 移除 `import { filterByEpicStory } from '../scoring/coach/filter-epic-story'`。
2. 新增 `import { queryByEpic, queryByStory } from '../scoring/query'`；`import { loadRunRecords } from '../scoring/coach'`（或 `../scoring/coach/loader`）。
3. --epic N：`records = queryByEpic(N, dataPath)`；若 [] 则输出 feedback（无数据 / 无约定 / 无可筛选），exit 0；否则取 records 中 timestamp 最大对应的 run_id；`allRecords = loadRunRecords(runId, dataPath)`；`coachDiagnose(runId, { dataPath, records: allRecords })`。
4. --story X.Y：同上，`records = queryByStory(epicId, storyId, dataPath)`。
5. 反馈文案与 filterByEpicStory 一致：无数据 →「暂无评分数据...」；无约定 →「当前评分记录无可解析...」；无可筛选 →「无可筛选数据」。需在迁移逻辑中复现该区分（可调用 loadAndDedupeRecords + 解析遍历，或从 query 导出 helper）。

### Phase 5：测试与回归

1. **单元测试**：formatScoresToTable 三种 mode；空 records 边界；check_items_summary 格式。
2. **集成/端到端**：`npx ts-node scripts/scores-summary.ts` 及 `--epic`、`--story` 在有数据/无数据/无约定数据时输出符合 AC；`npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` 与迁移前输出一致。
3. **回归**：`npm run test:scoring` 全部通过。

---

## 4. 模块与文件改动设计

### 4.1 新增文件

| 文件 | 责任 | 对应需求 |
|------|------|----------|
| `commands/bmad-scores.md` | /bmad-scores 触发、参数、验收 | spec §3.1, §3.7 |
| `scripts/scores-summary.ts` | 入口、query 调用、formatScoresToTable、反馈 | spec §3.2–§3.5 |
| 可选：`scripts/scores/format-table.ts` | formatScoresToTable 抽取（若 scripts 内嵌则无需） | spec §3.4 |

### 4.2 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| `scripts/coach-diagnose.ts` | --epic/--story 分支改用 queryByEpic、queryByStory；移除 filterByEpicStory | spec §3.6 |
| `scoring/query/index.ts` | 可选：导出 parseEpicStoryFromRecord（若未导出） | 便于 scores-summary 导入 |

### 4.3 数据路径

- 复用 getScoringDataPath()；scripts 从项目根执行，使用 `../scoring/query` 等相对路径。

---

## 5. 详细技术方案

### 5.1 formatScoresToTable 接口

```ts
type ScoresTableMode = 'all' | 'epic' | 'story';

function formatScoresToTable(
  records: RunScoreRecord[],
  mode: ScoresTableMode
): string;
```

- 返回 Markdown 表格字符串；空 records 返回空字符串或占位（调用方负责无数据分支）。

### 5.2 无数据/无约定区分逻辑

| 条件 | 输出 |
|------|------|
| queryLatest(1) 返回 [] | 「暂无评分数据，请先完成至少一轮 Dev Story」 |
| queryByEpic/queryByStory 返回 [] 且 queryLatest(1) 非空 | 需区分：parsable.length===0 →「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」；否则 →「无可筛选数据」 |
| 有数据 | 调用 formatScoresToTable 输出 |

**实现**：scoring/query 的 loadAndDedupeRecords 未从 index 导出；可从 loader 直接导入（`import { loadAndDedupeRecords } from '../scoring/query/loader'`）或 scoring/query/index 补充导出。解析逻辑与 parseEpicStoryFromRecord 一致。

### 5.3 表格列定义（与 spec §3.4 一致）

| mode | 列 |
|------|-----|
| all | run_id, epic, story, stage, phase_score, phase_weight, timestamp |
| epic | story, stage, phase_score, phase_weight, timestamp |
| story | stage, phase_score, phase_weight, check_items_summary, timestamp |

### 5.4 coach 迁移：feedback 一致性

filterByEpicStory 返回三种 error：
- 空目录：`{ error: '暂无评分数据，请先完成至少一轮 Dev Story' }`
- 无可解析：`{ error: '当前评分记录无可解析 Epic/Story，请确认 run_id 约定' }`
- 无匹配：`{ error: '无可筛选数据' }`

迁移后需复现相同文案。实现：先 queryLatest(1)，空则「暂无评分数据...」；再 queryByEpic/queryByStory，空则需区分无约定与无可筛选——可用 loadAndDedupeRecords 遍历解析（与 filterByEpicStory 逻辑一致）。

---

## 6. 测试计划（单元 + 集成 + 端到端）

### 6.1 单元测试

| 测试文件 | 覆盖点 | 命令 |
|----------|--------|------|
| 新建 `scripts/__tests__/scores-summary-format.test.ts` 或 `scoring/__tests__/format-scores.test.ts` | formatScoresToTable：三种 mode、空 records、check_items_summary | `npm run test:scoring -- ...` |

### 6.2 集成测试

| 测试场景 | 验证目标 | 方式 |
|----------|----------|------|
| scores-summary 可执行 | scripts 入口被 CLI 调用且输出 | `npx ts-node scripts/scores-summary.ts` |
| query 集成 | scores-summary import query 并正确获取数据 | 有 fixture 数据时运行 |
| coach 迁移 | coach-diagnose --epic/--story 使用 query 非 filterByEpicStory | grep import；行为对比 |

### 6.3 端到端 / 验收命令

| 场景 | 命令 | 预期 |
|------|------|------|
| AC-1 全部摘要 | `npx ts-node scripts/scores-summary.ts` | 表格或「暂无评分数据...」 |
| AC-2 Epic 汇总 | `npx ts-node scripts/scores-summary.ts --epic 3` | Epic 3 表格或反馈 |
| AC-3 Story 明细 | `npx ts-node scripts/scores-summary.ts --story 3.3` | Story 3.3 表格或反馈 |
| AC-4 无约定 | 无可解析时 --epic/--story | 「当前评分记录无可解析...」 |
| AC-5 无数据 | 空目录 | 「暂无评分数据...」 |
| AC-6 coach 迁移 | `npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` | 与迁移前一致 |

---

## 7. 执行准入标准

- 生成 tasks-E6-S4.md 后，所有任务须具备明确文件路径与验收命令。
- 单元测试通过：formatScoresToTable 相关测试。
- 集成验证：`npx ts-node scripts/scores-summary.ts` 可执行；coach-diagnose --epic/--story 行为不变。
- `npm run test:scoring` 全部通过。
- 通过 code-review 审计后方可进入下一阶段。
