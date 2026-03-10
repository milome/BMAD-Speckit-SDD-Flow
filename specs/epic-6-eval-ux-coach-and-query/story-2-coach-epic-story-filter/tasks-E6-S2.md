# Tasks: Coach 按 Epic/Story 筛选 (E6-S2)

**Input**：`spec-E6-S2.md`、`plan-E6-S2.md`、`IMPLEMENTATION_GAPS-E6-S2.md`  
**Scope**：Story 6.2 全部（--epic、--story、inline 筛选、coachDiagnose 扩展、Command 文档）  
**执行方式**：按 T1 → T2 → T3 → T4 → T5 顺序推进，TDD 红绿灯模式

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 6.2, GAPS | §3.3–§3.6, GAP-E6-S2-3~6,8 | filter-epic-story.ts：loadAllRecordsForFilter、parseEpicStoryFromRecord、filterByEpicStory |
| T2 | Story 6.2, GAPS | §3.5, GAP-E6-S2-7 | CoachDiagnoseOptions.records；diagnose 短路 loadRunRecords |
| T3 | Story 6.2, GAPS | §3.2, §3.8, GAP-E6-S2-1,2,8,10 | 扩展 coach-diagnose.ts：--epic、--story 解析、校验、分支 |
| T4 | Story 6.2, GAPS | §3.7, GAP-E6-S2-9 | 更新 commands/bmad-coach.md |
| T5 | Story 6.2, GAPS | §7.3, GAP-E6-S2-11 | 单元测试 + 端到端验收 |

---

## 2. Phase 1：Inline 筛选逻辑（T1）

**AC**：GAP-E6-S2-3~6、AC-1、AC-2、AC-3 筛选部分  
**集成验证**：T5.2（脚本 --epic、--story 可执行）

- [x] **T1.1** 新增 `scoring/coach/filter-epic-story.ts`，实现 `loadAllRecordsForFilter(dataPath: string): RunScoreRecord[]`（与 discovery 的 loadAllRecords 逻辑等价：*.json + scores.jsonl，排除 sft-dataset.json）
- [x] **T1.2** 实现 `parseEpicStoryFromRecord(record: RunScoreRecord): { epicId: number; storyId: number } | null`：run_id 正则 `-e(\d+)-s(\d+)-`、`-e(\d+)-s(\d+)$`；无匹配则 source_path fallback：`epic-(\d+)-[^/]*/story-(\d+)-`、`story-(\d+)-(\d+)-`
- [x] **T1.3** 实现 `filterByEpicStory(dataPath, filter: { epicId?: number; storyId?: number })`：加载 → 空数组返回 `{ error: '暂无评分数据，请先完成至少一轮 Dev Story' }`；排除 `scenario === 'eval_question'`；逐条解析；无可解析返回 `{ error: '当前评分记录无可解析 Epic/Story，请确认 run_id 约定' }`；按 filter 匹配；无匹配返回 `{ error: '无可筛选数据' }`；有匹配取 timestamp 最新的 run_id，返回该 run_id 的全部 records
- [x] **T1.4** 导出 `filterByEpicStory`、`parseEpicStoryFromRecord`（后者供单测使用）

---

## 3. Phase 2：coachDiagnose 扩展（T2）

**AC**：GAP-E6-S2-7  
**集成验证**：T5.2（脚本传入 records 后 coachDiagnose 正确输出）

- [x] **T2.1** 修改 `scoring/coach/types.ts`：`CoachDiagnoseOptions` 新增 `records?: RunScoreRecord[]`
- [x] **T2.2** 修改 `scoring/coach/diagnose.ts`：若 `options.records != null && options.records.length > 0`，跳过 `loadRunRecords`，直接使用 `options.records`；runId 取 `options.records[0].run_id`（或由调用方传入）

---

## 4. Phase 3：脚本扩展（T3）

**AC**：AC-1、AC-2、AC-3、GAP-E6-S2-1、2、8、10  
**集成验证**：T5.2 端到端验收

- [x] **T3.1** 扩展 `scripts/coach-diagnose.ts`：解析 `--epic N`、`--story X.Y`；`--epic N` 校验 N 为 `^\d+$`，否则 `console.error` 并 exit 1；`--story X.Y` 校验 `^\d+\.\d+$`，解析为 epicId=X, storyId=Y
- [x] **T3.2** `--epic` 与 `--story` 互斥：同时传入时报错 exit 1
- [x] **T3.3** 有 `--epic` 或 `--story` 时：调用 `filterByEpicStory(dataPath, { epicId, storyId })`；若返回 `{ error }`，输出 error 并 exit 0；若返回 `{ records, runId }`，调用 `coachDiagnose(runId, { dataPath, records })` → formatToMarkdown/JSON 输出
- [x] **T3.4** 无 `--epic`、`--story` 时：保持现有逻辑（discovery → coachDiagnose），确保无回归

---

## 5. Phase 4：Command 文档（T4）

**AC**：GAP-E6-S2-9

- [x] **T4.1** 修改 `commands/bmad-coach.md`：新增 `--epic N`、`--story X.Y` 参数说明；调用逻辑；验收命令 `npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3`
- [x] **T4.2** 同步到 `.cursor/commands/bmad-coach.md`（若存在）

---

## 6. Phase 5：测试与验收（T5）

**AC**：GAP-E6-S2-11、plan §6

- [x] **T5.1** 新增 `scoring/coach/__tests__/filter-epic-story.test.ts`：① parseEpicStoryFromRecord：run_id `-e1-s2-`、`-e1-s2`；source_path `epic-3-*/story-4-*`、`story-3-4-*`；无匹配 null；② filterByEpicStory：空目录、无可解析、无匹配、epic 匹配、story 匹配、scenario 过滤
- [x] **T5.2** 端到端验收：`npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` 有数据时输出诊断；无匹配/无可解析时输出明确反馈；`--epic 3 --story 3.3` 报错；`--epic abc` 报错；空目录 `--epic 3` 输出「暂无评分数据...」；无参 `npx ts-node scripts/coach-diagnose.ts` 与 Story 6.1 一致
- [x] **T5.3** 执行 `npm run test:scoring` 全量回归（若有）

---

## 7. 验收命令汇总

| 命令 | 覆盖 |
|------|------|
| `npm run test:scoring -- scoring/coach/__tests__/filter-epic-story.test.ts` | T1, T5.1 |
| `npx ts-node scripts/coach-diagnose.ts --epic 3` | T3, AC-1 |
| `npx ts-node scripts/coach-diagnose.ts --story 3.3` | T3, AC-2 |
| `SCORING_DATA_PATH=/tmp/empty npx ts-node scripts/coach-diagnose.ts --epic 3` | AC-3 空目录 |
| `npx ts-node scripts/coach-diagnose.ts --epic 3 --story 3.3` | 参数互斥 |
| `npx ts-node scripts/coach-diagnose.ts --epic abc` | 格式错误 |
| `npx ts-node scripts/coach-diagnose.ts` | 无参回归 |

---

## 8. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §1 | GAP-E6-S2-1, 2 | ✓ 有 | T3 |
| Story §1 | GAP-E6-S2-3, 4, 5, 6 | ✓ 有 | T1 |
| Story §3.5 | GAP-E6-S2-7 | ✓ 有 | T2 |
| Story §3.6, §3.7 | GAP-E6-S2-8, 9 | ✓ 有 | T1, T3, T4 |
| Story §3.2 | GAP-E6-S2-10 | ✓ 有 | T3 |
| Story §7.3 | GAP-E6-S2-11 | ✓ 有 | T5 |

---

## 9. 完成判定标准

- T1~T5 全部任务完成并勾选。
- AC-1、AC-2、AC-3 均有可追溯任务与验收命令结果。
- 每个模块的验收须包含该模块在生产代码关键路径（scripts/coach-diagnose.ts）中被导入并调用的集成验证。
- TDD 红绿灯：每任务须记录 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]。
