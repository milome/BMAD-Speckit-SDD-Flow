# Spec E6-S4：Scores Command（/bmad-scores）

*Story 6.4 技术规格*  
*Epic E6 eval-ux-coach-and-query*

---

## 1. 概述

本 spec 将 Story 6.4 的实现范围固化为可执行技术规格，覆盖 `/bmad-scores` Command、`scripts/scores-summary.ts` 脚本、`formatScoresToTable(records, mode)` 表格格式化，以及 coach-diagnose 的 `--epic`/`--story` 分支从 filterByEpicStory 迁移为复用 scoring/query/。

**前置假设**：本 spec 假定 **Story 6.3 已完成**，scoring/query/ 已交付 queryByEpic、queryByStory、queryLatest。6.3 未完成时的 inline fallback 逻辑不在本 spec 范围。

**输入来源**：
- `_bmad-output/implementation-artifacts/epic-6-eval-ux-coach-and-query/story-6-4-scores-command/6-4-scores-command.md`
- `prd.eval-ux-last-mile.md` §5.2（REQ-UX-2.6）
- `scoring/docs/RUN_ID_CONVENTION.md`
- Story 6.3（scoring/query/）queryByEpic、queryByStory、queryLatest API
- Story 6.2（coach-diagnose --epic/--story）迁移需求

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story §1 REQ-UX-2.6 | Command /bmad-scores：全部摘要、--epic N、--story X.Y | spec §3.1, §3.2 | ✅ |
| Story §1 REQ-UX-2.2 | epic_id/story_id 解析；无约定时明确反馈 | spec §3.4, §3.5 | ✅ |
| Story §1 REQ-UX-2.4 | Epic/Story 筛选仅 real_dev | spec §3.3（复用 query） | ✅ |
| Story §1 REQ-UX-2.3 | 同 run_id+stage 去重 | spec §3.3（复用 query） | ✅ |
| Story §3.1(1) | 新建 commands/bmad-scores.md | spec §3.1, §3.7 | ✅ |
| Story §3.1(2) | 全部摘要模式：表格、列、按 timestamp/run_id 分组 | spec §3.2.1 | ✅ |
| Story §3.1(3) | Epic 汇总模式 --epic N | spec §3.2.2 | ✅ |
| Story §3.1(4) | Story 明细模式 --story X.Y | spec §3.2.3 | ✅ |
| Story §3.1(5) | 查询层复用 queryByEpic、queryByStory、queryLatest | spec §3.3 | ✅ |
| Story §3.1(6) | 输出格式：Markdown 表格；无数据/无约定反馈 | spec §3.4, §3.5 | ✅ |
| Story §3.1(7) | 增强：coach-diagnose 迁移为 scoring/query/ | spec §3.6 | ✅ |
| Story §4 AC-1 | 全部摘要输出表格 | spec §3.2.1, §3.8 | ✅ |
| Story §4 AC-2 | Epic 汇总输出 Epic N 各 Story | spec §3.2.2, §3.8 | ✅ |
| Story §4 AC-3 | Story 明细输出 Story X.Y 各阶段 | spec §3.2.3, §3.8 | ✅ |
| Story §4 AC-4 | 无约定数据时明确反馈 | spec §3.5 | ✅ |
| Story §4 AC-5 | 无数据时「暂无评分数据...」 | spec §3.5 | ✅ |
| Story §4 AC-6 | coach-diagnose 迁移后行为不变 | spec §3.6, §3.8 | ✅ |

---

## 3. 功能规格

### 3.1 Command 与入口

| 项目 | 规格 |
|------|------|
| Command 文档 | `commands/bmad-scores.md`，定义 `/bmad-scores` 触发与参数 |
| 脚本入口 | `scripts/scores-summary.ts`（或 `scripts/bmad-scores.ts`） |
| 参数 | 无参、`--epic N`、`--story X.Y`；`--epic` 与 `--story` 互斥 |

### 3.2 三种模式行为规格

#### 3.2.1 全部摘要模式（无参）

1. 调用 `queryLatest(N)`（默认 N=100）。
2. 若返回空数组：输出「暂无评分数据，请先完成至少一轮 Dev Story」。
3. 若有数据：调用 `formatScoresToTable(records, 'all')`，输出 Markdown 表格。
4. 表格列至少含：run_id、epic、story、stage、phase_score、phase_weight、timestamp。
5. epic/story 由 `parseEpicStoryFromRecord` 解析得出（若可解析则展示，否则留空或 '-'）。
6. **分组与排序**：按 run_id 分组，组内按 stage 顺序（或 timestamp 升序）；组间按每组最新 timestamp 降序排列。若实现简化，可全表按 timestamp 降序展示，不强制多级分组。

#### 3.2.2 Epic 汇总模式（--epic N）

1. 调用 `queryByEpic(N)`。
2. 若返回空数组：需区分无数据 / 无约定，输出对应反馈（见 §3.5）。
3. 若有数据：调用 `formatScoresToTable(records, 'epic')`，输出 Markdown 表格。
4. 表格列：story、stage、phase_score、phase_weight、timestamp。
5. story 格式为 `{epicId}.{storyId}`。

#### 3.2.3 Story 明细模式（--story X.Y）

1. 解析为 epicId=X、storyId=Y，调用 `queryByStory(X, Y)`。
2. 若返回空数组：输出对应反馈（见 §3.5）。
3. 若有数据：调用 `formatScoresToTable(records, 'story')`，输出 Markdown 表格。
4. 表格列：stage、phase_score、phase_weight、check_items_summary、timestamp。
5. check_items_summary：有 check_items 时展示摘要；passed 判定规则：`check_items[].passed === true` 计数为 passed，总数为 `check_items.length`，格式为 `"{passed}/{total} passed"`（如 "3/5 passed"）；无 check_items 或空数组则为 '-'。

### 3.3 查询层复用（Story 6.3 已完成）

- **直接 import**：`queryByEpic`、`queryByStory`、`queryLatest`、`parseEpicStoryFromRecord` 来自 `scoring/query`（或等价路径 `../scoring/query`）。parseEpicStoryFromRecord 由 `scoring/query/parse-epic-story` 导出，经 `scoring/query` index 暴露。
- 各 API 已实现同 run_id+stage 去重、epic_id/story_id 解析。
- **Epic/Story 筛选 scope**：仅 `scenario !== 'eval_question'` 的记录参与；未设 `scenario` 或 `scenario` 为 undefined 的记录视为可参与 Epic/Story 筛选（与 Story 6.3 query 层一致）。
- 无需实现 inline 查询逻辑；Story 6.3 已交付。

### 3.4 formatScoresToTable(records, mode)

| 参数 | 类型 | 说明 |
|------|------|------|
| records | RunScoreRecord[] | 评分记录数组 |
| mode | 'all' \| 'epic' \| 'story' | 输出格式模式 |

| mode | 表头示例 | 行数据映射 |
|------|----------|------------|
| all | \| run_id \| epic \| story \| stage \| phase_score \| phase_weight \| timestamp \| | 每行一条 record；epic/story 由 parseEpicStoryFromRecord 解析 |
| epic | \| story \| stage \| phase_score \| phase_weight \| timestamp \| | 每行一条；story = epicId.storyId |
| story | \| stage \| phase_score \| phase_weight \| check_items_summary \| timestamp \| | 每行一条；check_items_summary 见 §3.2.3(5) |

### 3.5 无数据与无约定反馈

| 场景 | 输出文案 |
|------|----------|
| scoring/data/ 为空或无评分记录 | 「暂无评分数据，请先完成至少一轮 Dev Story」 |
| 有记录但 run_id/source_path 均无法解析 Epic/Story | 「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」 |
| 可解析但筛选后无匹配 | 「无可筛选数据」 |

**区分逻辑**（实现时可选用其一，验收以三种反馈文案为准）：
- 调用 `queryLatest(1)` 为空 → 无数据。
- 调用 `queryByEpic`/`queryByStory` 返回空且 `queryLatest(1)` 非空：需区分「无约定」与「无可筛选数据」。可选方案：① 调用 `loadAndDedupeRecords`（若 scoring/query 导出）过滤 real_dev，遍历解析；② 或统一输出「无可筛选数据」作为简化（若无法区分则用此）。推荐方案①以保持与 coach 迁移前行为一致。

### 3.6 coach-diagnose 迁移（增强任务）

1. **移除**：`import { filterByEpicStory } from '../scoring/coach/filter-epic-story'`。
2. **新增**：`import { queryByEpic, queryByStory } from '../scoring/query'`；`import { loadRunRecords } from '../scoring/coach/loader'`（或 `scoring/coach` 若导出）。
3. **--epic N 分支**：
   - 调用 `queryByEpic(N, dataPath)`。
   - 若返回 []：按 §3.5 输出对应 feedback，`process.exit(0)`。
   - 否则：从 records 取 timestamp 最大对应的 run_id；调用 `loadRunRecords(runId, dataPath)` 加载该 run 全部记录；`coachDiagnose(runId, { dataPath, records })`。
4. **--story X.Y 分支**：
   - 调用 `queryByStory(epicId, storyId, dataPath)`。
   - 逻辑同上。
5. **保持行为不变**：输出格式、错误文案与迁移前一致。

### 3.7 产出物路径

| 产出 | 路径 |
|------|------|
| Command 文档 | `commands/bmad-scores.md` |
| 脚本 | `scripts/scores-summary.ts` |
| 可选同步 | `.cursor/commands/bmad-scores.md`（若项目有此约定） |
| 修改 | `scripts/coach-diagnose.ts`（迁移） |

### 3.8 验收用例

| 场景 | 命令 | 预期 |
|------|------|------|
| 全部摘要有数据 | `npx ts-node scripts/scores-summary.ts` | 输出 Markdown 表格 |
| Epic 汇总有数据 | `npx ts-node scripts/scores-summary.ts --epic 3` | 输出 Epic 3 各 Story 表格 |
| Story 明细有数据 | `npx ts-node scripts/scores-summary.ts --story 3.3` | 输出 Story 3.3 各阶段表格 |
| 无数据 | 空目录下运行 | 「暂无评分数据，请先完成至少一轮 Dev Story」 |
| 无约定数据 | 无可解析 run_id 时 --epic/--story | 「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」 |
| coach 迁移 | `npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` | 输出与迁移前一致；使用 scoring/query/ |

---

## 4. 非本 Story 范围

| 功能 | 负责 | 说明 |
|------|------|------|
| queryByEpic、queryByStory、queryLatest 实现 | Story 6.3 | 已交付 |
| 组合 queryByFilters API | GAP-024 | 待排期 |
| 仪表盘、四维、短板 Top 3 | Story 7.1 | /bmad-dashboard |
| bmad-eval-analytics 自然语言触发 | Story 6.5 | 本 Story 仅 Command 入口 |
| filter-epic-story.ts 移除 | 本 Story | 迁移后若无人引用可考虑删除 |

---

## 5. 测试要求

- **单元测试**：`formatScoresToTable` 三种 mode 的输出格式；空 records 边界。
- **集成/端到端**：`npx ts-node scripts/scores-summary.ts` 及 `--epic`、`--story` 在有数据/无数据/无约定数据时符合 AC。
- **coach 迁移回归**：`npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` 与迁移前输出一致；`npm run test:scoring` 全部通过。
