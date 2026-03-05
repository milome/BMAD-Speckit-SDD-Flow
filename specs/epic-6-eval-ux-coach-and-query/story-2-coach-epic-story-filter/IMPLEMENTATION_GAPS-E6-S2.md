# IMPLEMENTATION_GAPS-E6-S2：Coach 按 Epic/Story 筛选

**输入**：`spec-E6-S2.md`、`plan-E6-S2.md`、当前代码基线  
**分析范围**：Story 6.2 全部 scope（--epic、--story 参数、inline 筛选、coachDiagnose 扩展、Command 文档）

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story §1 REQ-UX-1.5 | GAP-E6-S2-1 | CLI 参数 `--epic N`，仅诊断 Epic N 相关数据 | 未实现 | coach-diagnose.ts 无 --epic 解析与分支 |
| Story §1 REQ-UX-1.6 | GAP-E6-S2-2 | CLI 参数 `--story X.Y`，解析为 epicId=X, storyId=Y | 未实现 | coach-diagnose.ts 无 --story 解析与分支 |
| Story §1 REQ-UX-2.2 | GAP-E6-S2-3 | epic_id/story_id 解析规则；无约定时明确反馈 | 未实现 | 无 run_id 正则、source_path fallback 解析逻辑 |
| Story §1 REQ-UX-2.4 | GAP-E6-S2-4 | Epic/Story 筛选仅针对 real_dev（scenario !== eval_question） | 未实现 | 无 scenario 过滤逻辑 |
| Story §3.3 | GAP-E6-S2-5 | 最小 inline 筛选：run_id 正则、source_path fallback | 未实现 | 无 filter-epic-story 或等价模块 |
| Story §3.4 | GAP-E6-S2-6 | 筛选流程：加载、scenario 过滤、解析、匹配、聚合、无匹配反馈 | 未实现 | 无 filterByEpicStory |
| Story §3.5 | GAP-E6-S2-7 | coachDiagnose 支持 options.records | 未实现 | CoachDiagnoseOptions 无 records；diagnose 未短路 loadRunRecords |
| Story §3.6 | GAP-E6-S2-8 | 无约定数据：空记录、无可解析、无匹配时的明确反馈 | 未实现 | 无对应分支与输出 |
| Story §3.7 | GAP-E6-S2-9 | Command 文档新增 --epic、--story 说明与验收命令 | 未实现 | commands/bmad-coach.md 未含 --epic、--story |
| Story §3.2 | GAP-E6-S2-10 | 参数互斥、格式校验（--epic N 为 \d+；--story X.Y 为 \d+\.\d+） | 未实现 | 无解析与校验 |
| Story §7.3 | GAP-E6-S2-11 | 单元测试：run_id 解析、source_path fallback、scenario 过滤 | 未实现 | 无 filter-epic-story 单测 |

---

## 2. 当前实现快照

- `scripts/coach-diagnose.ts`：支持 --run-id、--format、--limit；无 --run-id 时 discovery → coachDiagnose；**无** --epic、--story。
- `scoring/coach/discovery.ts`：有 discoverLatestRunId、内部 loadAllRecords（未导出）；无 filterByEpicStory。
- `scoring/coach/diagnose.ts`：coachDiagnose(runId, options)；options 无 records；始终 loadRunRecords(runId)。
- `scoring/coach/types.ts`：CoachDiagnoseOptions 无 records 字段。
- `commands/bmad-coach.md`：有 --run-id、--format、--limit；**无** --epic、--story。
- `scoring/query/`：不存在（Story 6.3 未实现），故使用最小 inline 筛选。

---

## 3. 依赖关系与实施顺序

1. **Phase 1**：新增 `scoring/coach/filter-epic-story.ts`（loadAllRecordsForFilter、parseEpicStoryFromRecord、filterByEpicStory）。
2. **Phase 2**：扩展 `CoachDiagnoseOptions.records`、`diagnose.ts` 短路逻辑。
3. **Phase 3**：扩展 `scripts/coach-diagnose.ts` 解析 --epic、--story，调用 filterByEpicStory → coachDiagnose(runId, { records })。
4. **Phase 4**：更新 `commands/bmad-coach.md`、`.cursor/commands/bmad-coach.md`。
5. **Phase 5**：新增 filter-epic-story 单测；执行端到端验收命令。

---

## 4. Gap 到任务映射总表

| Gap ID | 对应任务 | 验收命令 |
|--------|----------|----------|
| GAP-E6-S2-1 | T3 | npx ts-node scripts/coach-diagnose.ts --epic 3 有 Epic 3 数据时输出诊断 |
| GAP-E6-S2-2 | T3 | npx ts-node scripts/coach-diagnose.ts --story 3.3 有 Story 3.3 数据时输出诊断 |
| GAP-E6-S2-3 | T1 | filter-epic-story 单测覆盖 parseEpicStoryFromRecord |
| GAP-E6-S2-4 | T1 | filterByEpicStory 排除 scenario=eval_question |
| GAP-E6-S2-5 | T1 | filter-epic-story.ts 实现 run_id 正则、source_path fallback |
| GAP-E6-S2-6 | T1 | filterByEpicStory 完整流程 |
| GAP-E6-S2-7 | T2 | coachDiagnose(runId, { records }) 使用 records 跳过 loadRunRecords |
| GAP-E6-S2-8 | T1, T3 | 空记录、无可解析、无匹配时 output 明确反馈 |
| GAP-E6-S2-9 | T4 | commands/bmad-coach.md 含 --epic、--story、验收命令 |
| GAP-E6-S2-10 | T3 | --epic abc 报错；--epic 3 --story 3.3 报错互斥 |
| GAP-E6-S2-11 | T5 | scoring/coach/__tests__/filter-epic-story.test.ts 通过 |
