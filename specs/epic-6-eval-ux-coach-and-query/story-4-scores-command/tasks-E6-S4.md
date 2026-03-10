# Tasks: Scores Command（/bmad-scores）(E6-S4)

**Input**：`spec-E6-S4.md`、`plan-E6-S4.md`、`IMPLEMENTATION_GAPS-E6-S4.md`  
**Scope**：Story 6.4 全部（Command、scores-summary、formatScoresToTable、coach 迁移、测试）  
**执行方式**：按 T1 → T2 → T3 → T4 → T5 顺序推进，TDD 红绿灯模式

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 6.4, GAPS | §3.1(1), GAP-E6-S4-1 | commands/bmad-scores.md；scores-summary.ts 骨架 |
| T2 | Story 6.4, GAPS | §3.1(2)-(6), GAP-E6-S4-2～6 | query 复用、formatScoresToTable、无数据/无约定/无可筛选反馈 |
| T3 | Story 6.4, GAPS | §3.7, §3.8, GAP-E6-S4-8～12, 15 | 验收命令、.cursor/commands 可选同步 |
| T4 | Story 6.4, GAPS | §3.1(7), §4 AC-6, GAP-E6-S4-7, 13 | coach-diagnose 迁移 |
| T5 | Story 6.4, GAPS | §7.3, spec §5, plan §6, GAP-E6-S4-14 | 单元测试、集成、E2E、coach 回归 |

---

## 2. Phase 1：Command 文档与脚本骨架（T1）

**AC**：GAP-E6-S4-1；AC-1, AC-5  
**集成验证**：T3 验收命令可执行

- [x] **T1.1** 新建 `commands/bmad-scores.md`：定义 `/bmad-scores` 触发；参数无参、`--epic N`、`--story X.Y` 互斥；验收命令 `npx ts-node scripts/scores-summary.ts`、`--epic 3`、`--story 3.3`
- [x] **T1.2** 新建 `scripts/scores-summary.ts`：parseArgs（--epic、--story）；epic/story 互斥校验；epic 正整数、story X.Y 格式校验；调用 getScoringDataPath()；无参时 queryLatest(100)、有 --epic 调用 queryByEpic、有 --story 调用 queryByStory；空数组时输出「暂无评分数据，请先完成至少一轮 Dev Story」

---

## 3. Phase 2：查询、表格格式化与反馈（T2）

**AC**：GAP-E6-S4-2～6；AC-1～AC-5  
**集成验证**：scores-summary 有数据时输出表格；无数据/无约定时输出正确反馈

- [x] **T2.1** `import { queryByEpic, queryByStory, queryLatest } from '../scoring/query'`；`parseEpicStoryFromRecord` 从 `../scoring/query/parse-epic-story` 或 query index（若导出）导入
- [x] **T2.2** 实现 `formatScoresToTable(records: RunScoreRecord[], mode: 'all'|'epic'|'story'): string`：mode='all' 表头 run_id|epic|story|stage|phase_score|phase_weight|timestamp；mode='epic' 表头 story|stage|phase_score|phase_weight|timestamp；mode='story' 表头 stage|phase_score|phase_weight|check_items_summary|timestamp；check_items_summary 为 `{passed}/{total} passed`，无则 '-'
- [x] **T2.3** 无数据/无约定/无可筛选区分：queryLatest(1) 为空 →「暂无评分数据...」；queryByEpic/queryByStory 返回 [] 且 queryLatest(1) 非空 → 需区分（loadAndDedupeRecords + 解析遍历，或统一「无可筛选数据」）；无约定 →「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」；无可筛选 →「无可筛选数据」
- [x] **T2.4** 有数据时按 mode 调用 formatScoresToTable 并 console.log；全表按 timestamp 降序排序

---

## 4. Phase 3：验收命令与同步（T3）

**AC**：GAP-E6-S4-8～12, 15  
**集成验证**：验收命令可执行且输出符合 AC

- [x] **T3.1** 验收命令：`npx ts-node scripts/scores-summary.ts`、`npx ts-node scripts/scores-summary.ts --epic 3`、`npx ts-node scripts/scores-summary.ts --story 3.3`；有数据输出表格，无数据输出「暂无评分数据...」，无约定输出「当前评分记录无可解析...」，无可筛选输出「无可筛选数据」
- [x] **T3.2** 若存在 `.cursor/commands/` 目录，同步 `commands/bmad-scores.md` 到 `.cursor/commands/bmad-scores.md`

---

## 5. Phase 4：coach-diagnose 迁移（T4）

**AC**：GAP-E6-S4-7, 13；AC-6  
**集成验证**：coach-diagnose --epic 3、--story 3.3 输出与迁移前一致；使用 query 非 filterByEpicStory

- [x] **T4.1** 移除 `import { filterByEpicStory } from '../scoring/coach/filter-epic-story'`；新增 `import { queryByEpic, queryByStory } from '../scoring/query'`；`import { loadRunRecords } from '../scoring/coach'`
- [x] **T4.2** --epic N 分支：`records = queryByEpic(N, dataPath)`；若 [] 输出 feedback（无数据/无约定/无可筛选）并 exit 0；否则取 records 中 timestamp 最大对应的 run_id；`allRecords = loadRunRecords(runId, dataPath)`；`coachDiagnose(runId, { dataPath, records: allRecords })`
- [x] **T4.3** --story X.Y 分支：同上，`records = queryByStory(epicId, storyId, dataPath)`
- [x] **T4.4** 验收：`npx ts-node scripts/coach-diagnose.ts --epic 3`、`npx ts-node scripts/coach-diagnose.ts --story 3.3` 与迁移前输出一致；`npm run test:scoring` 全部通过

---

## 6. Phase 5：测试与回归（T5）

**AC**：GAP-E6-S4-14  
**集成验证**：单测通过；scores-summary、coach 验收命令符合 AC

- [x] **T5.1** 新增 `scoring/scores/__tests__/format-table.test.ts`：formatScoresToTable 三种 mode、空 records、check_items_summary 格式；执行 `npm run test:scoring -- scripts/__tests__` 或等价
- [x] **T5.2** 集成/E2E：`npx ts-node scripts/scores-summary.ts` 及 --epic、--story 在有数据/无数据/无约定时输出符合 AC；`npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` 与迁移前一致；`npm run test:scoring` 全部通过

---

## 7. 验收命令汇总

| 命令 | 覆盖 |
|------|------|
| `npx ts-node scripts/scores-summary.ts` | T1, T2, AC-1 |
| `npx ts-node scripts/scores-summary.ts --epic 3` | AC-2 |
| `npx ts-node scripts/scores-summary.ts --story 3.3` | AC-3 |
| 空目录下运行 scores-summary | AC-5 |
| 无可解析时 --epic/--story | AC-4 |
| `npx ts-node scripts/coach-diagnose.ts --epic 3` | AC-6, T4 |
| `npx ts-node scripts/coach-diagnose.ts --story 3.3` | AC-6, T4 |
| `npm run test:scoring` | T5 |

---

## 8. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §3.1(1) | GAP-E6-S4-1 | ✓ 有 | T1.1, T1.2 |
| Story §3.1(2)-(6) | GAP-E6-S4-2～6 | ✓ 有 | T2.1～T2.4 |
| Story §3.1(7) | GAP-E6-S4-7 | ✓ 有 | T4.1～T4.4 |
| Story §4 | GAP-E6-S4-8～13 | ✓ 有 | T1～T5 |
| Story §7.3 | GAP-E6-S4-14 | ✓ 有 | T5.1, T5.2 |
| Story §5.4 | GAP-E6-S4-15 | ✓ 有 | T3.2 |

---

## 9. 完成判定标准

- T1～T5 全部任务完成并勾选。
- AC-1～AC-6 均有可追溯任务与验收命令结果。
- scores-summary 可执行且输出符合 AC；coach-diagnose 迁移后行为不变。
- TDD 红绿灯：每任务须记录 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]。
