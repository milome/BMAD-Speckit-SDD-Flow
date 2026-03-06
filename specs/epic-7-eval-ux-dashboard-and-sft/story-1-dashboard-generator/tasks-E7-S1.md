# Tasks: 仪表盘生成器（/bmad-dashboard）(E7-S1)

**Input**：`spec-E7-S1.md`、`plan-E7-S1.md`、`IMPLEMENTATION_GAPS-E7-S1.md`  
**Scope**：Story 7.1 全部（Command、dashboard-generate、scoring/dashboard、测试）  
**执行方式**：按 T1 → T2 → T3 → T4 顺序推进，TDD 红绿灯模式

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 7.1, GAPS | §3.1, GAP-E7-S1-1, 7 | commands/bmad-dashboard.md；dashboard-generate.ts 骨架 |
| T2 | Story 7.1, GAPS | §3.2, GAP-E7-S1-2～8 | scoring/dashboard 计算与格式化；脚本输出逻辑 |
| T3 | Story 7.1, GAPS | §3.6, AC | 验收命令、.cursor/commands 可选同步 |
| T4 | spec §5, GAPS | GAP-E7-S1-10 | 单元测试、集成、E2E |

---

## 2. Phase 1：Command 文档与脚本骨架（T1）

**AC**：GAP-E7-S1-1, 7；AC-2, AC-4  
**集成验证**：无数据时运行输出「暂无数据...」且写入 dashboard.md

- [x] **T1.1** 新建 `commands/bmad-dashboard.md`：定义 `/bmad-dashboard` 触发；无参数运行；验收命令 `npx ts-node scripts/dashboard-generate.ts`
- [x] **T1.2** 新建 `scripts/dashboard-generate.ts`：调用 getScoringDataPath()；调用 queryByScenario('real_dev', dataPath) 或 loadAndDedupeRecords + filter scenario !== 'eval_question'；空数组时输出「暂无数据，请先完成至少一轮 Dev Story」，写入 `_bmad-output/dashboard.md`（确保目录存在），console.log 后 process.exit(0)

---

## 3. Phase 2：仪表盘计算与输出（T2）

**AC**：GAP-E7-S1-2～8；AC-1, AC-3  
**集成验证**：有数据时输出含总分、四维、短板、Veto、趋势的 Markdown

- [x] **T2.1** 新建 `scoring/dashboard/compute.ts`：`groupByRunId`、`getLatestRunRecords`、`getRecentRuns(records, 5)`；`computeHealthScore(records)`：`sum(phase_score * phase_weight) / sum(phase_weight)`，round 整数
- [x] **T2.2** `getDimensionScores(records)`：合并 dimension_scores，按 dimension 聚合；无 dimension_scores 的维度返回「无数据」
- [x] **T2.3** `getWeakTop3(records)`：按 phase_score 升序取前 3；含 stage、parseEpicStoryFromRecord 解析的 epic.story
- [x] **T2.4** `countVetoTriggers(records)`：`buildVetoItemIds()`；遍历 check_items，计数 passed=false 且 item_id in vetoIds
- [x] **T2.5** `getTrend(records)`：getRecentRuns(records, 5)；每 run 计算 weightedTotal；比较最近 vs 前一次 → '升'|'降'|'持平'；只有 1 run 时持平
- [x] **T2.6** 新建 `scoring/dashboard/format.ts`：`formatDashboardMarkdown(data)`：含标题、总分、四维、短板 Top 3、Veto、趋势的 Markdown
- [x] **T2.7** 新建 `scoring/dashboard/index.ts`：导出 compute、format；`scripts/dashboard-generate.ts` 有数据时：调用 compute → format → 写入 _bmad-output/dashboard.md → console.log(markdown)

---

## 4. Phase 3：验收命令与同步（T3）

**AC**：GAP-E7-S1-9  
**集成验证**：验收命令可执行且输出符合 AC

- [x] **T3.1** 验收命令：`npx ts-node scripts/dashboard-generate.ts`；有数据输出含总分、四维、短板、Veto、趋势的 Markdown；无数据输出「暂无数据...」；_bmad-output/dashboard.md 存在且内容与 stdout 一致
- [x] **T3.2** 若存在 `.cursor/commands/` 目录，同步 `commands/bmad-dashboard.md` 到 `.cursor/commands/bmad-dashboard.md`

---

## 5. Phase 4：测试与回归（T4）

**AC**：GAP-E7-S1-10  
**集成验证**：单测通过；dashboard-generate 验收命令符合 AC

- [x] **T4.1** 新增 `scoring/dashboard/__tests__/compute.test.ts`：computeHealthScore、getDimensionScores、getWeakTop3、countVetoTriggers、getTrend 单元测试；空 records、无 dimension_scores 边界
- [x] **T4.2** 新增 `scoring/dashboard/__tests__/format.test.ts`：formatDashboardMarkdown 输出格式
- [x] **T4.3** 集成/E2E：`npx ts-node scripts/dashboard-generate.ts` 在有数据/无数据时输出符合 AC；`npm run test:scoring` 全部通过（若项目有此脚本）

---

## 6. 验收命令汇总

| 命令 | 覆盖 |
|------|------|
| `npx ts-node scripts/dashboard-generate.ts` | T1, T2, T3, AC-1, AC-4 |
| 空目录或无 real_dev 时运行 | AC-2 |
| 部分 record 无 dimension_scores | AC-3 |
| `npm run test:scoring`（或 `npm test -- scoring/dashboard`） | T4 |

---

## 7. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §3.1 | GAP-E7-S1-1 | ✓ 有 | T1.1 |
| Story §3.2 | GAP-E7-S1-2～6 | ✓ 有 | T2.1～T2.6 |
| Story §3.3, §3.5 | GAP-E7-S1-7, 8 | ✓ 有 | T1.2, T2.7 |
| Story §4 | GAP-E7-S1-9 | ✓ 有 | T3 |
| spec §5 | GAP-E7-S1-10 | ✓ 有 | T4 |

---

## 8. 完成判定标准

- T1～T4 全部任务完成并勾选。
- AC-1～AC-4 均有可追溯任务与验收命令结果。
- dashboard-generate 可执行且输出符合 AC；_bmad-output/dashboard.md 产出正确。
- TDD 红绿灯：每任务须记录 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]。
