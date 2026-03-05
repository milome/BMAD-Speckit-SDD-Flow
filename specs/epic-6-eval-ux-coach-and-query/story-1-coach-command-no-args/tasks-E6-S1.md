# Tasks: Coach Command 无参数运行 (E6-S1)

**Input**：`spec-E6-S1.md`、`plan-E6-S1.md`、`IMPLEMENTATION_GAPS-E6-S1.md`  
**Scope**：Story 6.1 全部（discovery、Command、脚本扩展）  
**执行方式**：按 T1 → T2 → T3 → T4 顺序推进，TDD 红绿灯模式

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 6.1 | §1 REQ-UX-1.2, §3.1 | discoverLatestRunId：扫描 *.json、scores.jsonl，按 timestamp 取最新 N |
| T2 | Story 6.1 | §1 REQ-UX-1.1, §3.1 | 新建 commands/bmad-coach.md |
| T3 | Story 6.1 | §3.1, §4 AC-1~AC-3 | 扩展 coach-diagnose.ts 无 --run-id 分支、空数据提示、截断提示 |
| T4 | Story 6.1 | §4, plan §6 | 单测 + 端到端验收 |

---

## 2. Phase 1：Discovery 逻辑（T1）

**AC**：REQ-UX-1.2、AC-3  
**集成验证**：T4.2（脚本无参可执行）

- [x] **T1.1** 新增 `scoring/coach/discovery.ts`：导出 `discoverLatestRunId(dataPath: string, limit?: number): { runId: string; truncated: boolean } | null`
- [x] **T1.2** 扫描 dataPath 下 `*.json`（排除 sft-dataset.json、非评分 schema）与 `scores.jsonl`（排除 sft-dataset.jsonl）
- [x] **T1.3** 评分 schema 判定：记录需含 `run_id`、`timestamp`、`scenario`、`stage` 等 required 字段（符合 RunScoreRecord）
- [x] **T1.4** 解析所有记录，按 `timestamp` 降序排序，取前 `limit`（默认 100）条；返回第一条记录的 `run_id`；若原始总数 > limit 则 `truncated: true`
- [x] **T1.5** 支持 `COACH_DISCOVERY_LIMIT` 环境变量；无记录时返回 `null`

---

## 3. Phase 2：Command 文档（T2）

**AC**：REQ-UX-1.1

- [x] **T2.1** 新建 `commands/bmad-coach.md`：触发条件（/bmad-coach）、调用流程（discovery → coachDiagnose → Markdown）、输出格式说明、验收命令 `npx ts-node scripts/coach-diagnose.ts`
- [x] **T2.2** 若项目有 `.cursor/commands/` 约定，同步到 `.cursor/commands/bmad-coach.md`

---

## 4. Phase 3：脚本扩展与集成（T3）

**AC**：AC-1、AC-2、AC-3、GAP-E6-S1-6~10

- [x] **T3.1** 扩展 `scripts/coach-diagnose.ts`：解析 `--limit N`（可选）；`limit` 取 `args['limit'] ?? env.COACH_DISCOVERY_LIMIT ?? 100`
- [x] **T3.2** 无 `--run-id` 时：① 调用 `discoverLatestRunId(getScoringDataPath(), limit)`；② 若 `null` 输出「暂无评分数据，请先完成至少一轮 Dev Story」并 exit 0；③ 否则调用 `coachDiagnose(runId, { dataPath })`；④ 若 `truncated` 在 Markdown 报告前附加「仅展示最近 N 条」；⑤ 调用 `formatToMarkdown` 输出
- [x] **T3.3** 有 `--run-id` 时：保持现有逻辑不变
- [x] **T3.4** 默认 `--format=markdown`（当前为 json，改为 markdown 以满足 AC）

---

## 5. Phase 4：测试与验收（T4）

**AC**：AC-1、AC-2、AC-3

- [x] **T4.1** 新增 `scoring/coach/__tests__/discovery.test.ts`：① 空目录 → 返回 null；② 单 *.json 含记录 → 返回 runId、truncated false；③ scores.jsonl 含记录 → 返回最新 runId；④ 多文件混合 → 按 timestamp 取最新；⑤ 记录数 > limit → truncated true；⑥ 排除 sft-dataset.jsonl、非评分 json
- [x] **T4.2** 端到端验收：`npx ts-node scripts/coach-diagnose.ts`（无 --run-id）① 有数据时输出 phase_scores、weak_areas、recommendations；② 空数据时输出「暂无评分数据...」；③ 超 N 时附加「仅展示最近 N 条」
- [x] **T4.3** 执行 `npm run test:scoring` 全量回归（若有）

---

## 6. 验收命令汇总

| 命令 | 覆盖 |
|------|------|
| `npm run test:scoring -- scoring/coach/__tests__/discovery.test.ts` | T1, T4.1 |
| `npx ts-node scripts/coach-diagnose.ts` | T3, T4.2, AC-1 |
| `SCORING_DATA_PATH=/tmp/empty npx ts-node scripts/coach-diagnose.ts` | AC-2 |
| `npx ts-node scripts/coach-diagnose.ts --limit 5`（数据>5 时） | AC-3 |

---

## 7. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §1 | GAP-E6-S1-1 | ✓ 有 | T2.1, T2.2 |
| Story §1 | GAP-E6-S1-2 | ✓ 有 | T1.1-T1.5 |
| Story §1 | GAP-E6-S1-3 | ✓ 有 | T1.2, T1.3 |
| Story §1 | GAP-E6-S1-4 | ✓ 有 | T1.5, T3.1 |
| Story §1 | GAP-E6-S1-5 | ✓ 有 | T3.2 |
| Story §3.1 | GAP-E6-S1-6 | ✓ 有 | T3.2 |
| Story §4 | GAP-E6-S1-7 | ✓ 有 | T3.2, T4.2 |
| Story §4 | GAP-E6-S1-8 | ✓ 有 | T3.2 |
| Story §4 | GAP-E6-S1-9 | ✓ 有 | T1.4, T3.2 |
| Story §5.2 | GAP-E6-S1-10 | ✓ 有 | T3.4 |

---

## 8. 完成判定标准

- T1~T4 全部任务完成并勾选。
- AC-1、AC-2、AC-3 均有可追溯任务与验收命令结果。
- 每个模块的验收须包含该模块在生产代码关键路径（scripts/coach-diagnose.ts）中被导入并调用的集成验证。
- TDD 红绿灯：每任务须记录 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]。

---

<!-- AUDIT: PASSED by code-reviewer -->
