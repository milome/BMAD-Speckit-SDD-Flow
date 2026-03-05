# IMPLEMENTATION_GAPS-E6-S1：Coach Command 无参数运行

**输入**：`spec-E6-S1.md`、`plan-E6-S1.md`、当前代码基线  
**分析范围**：Story 6.1 全部 scope（discovery、Command、脚本扩展）

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story §1 REQ-UX-1.1 | GAP-E6-S1-1 | 新建 commands/bmad-coach.md | 未实现 | commands/bmad-coach.md 不存在 |
| Story §1 REQ-UX-1.2 | GAP-E6-S1-2 | discoverLatestRunId：扫描 getScoringDataPath 下 *.json 与 scores.jsonl，按 timestamp 取最新 N 条 | 未实现 | coach-diagnose.ts 强制要求 --run-id，无 discovery 逻辑 |
| Story §1 REQ-UX-1.2 | GAP-E6-S1-3 | 排除非评分 schema（sft-dataset.jsonl 等） | 未实现 | 无 discovery 故无排除逻辑 |
| Story §1 REQ-UX-1.2 | GAP-E6-S1-4 | limit 默认 100，可 env/CLI 配置 | 未实现 | 无 discovery 故无 limit |
| Story §1 REQ-UX-1.3 | GAP-E6-S1-5 | 空目录返回「暂无评分数据，请先完成至少一轮 Dev Story」 | 未实现 | 无 run-id 时直接 exit 1，无空数据提示 |
| Story §3.1 | GAP-E6-S1-6 | 无 --run-id 时 discovery → coachDiagnose → Markdown | 未实现 | 脚本无无参分支 |
| Story §4 AC-1 | GAP-E6-S1-7 | 有数据时输出 phase_scores、weak_areas、recommendations | 部分实现 | coachDiagnose 有该输出，但需 --run-id；无 discovery 则无法无参触发 |
| Story §4 AC-2 | GAP-E6-S1-8 | 空目录友好提示 | 未实现 | 见 GAP-E6-S1-5 |
| Story §4 AC-3 | GAP-E6-S1-9 | 超 N 条时仅取最新 N 并提示「仅展示最近 N 条」 | 未实现 | 无 discovery 故无截断逻辑 |
| Story §5.2 | GAP-E6-S1-10 | 默认 format=markdown | 部分实现 | 当前默认 format=json；AC 要求 Markdown 输出，需改为 markdown 默认 |

---

## 2. 当前实现快照

- `commands/bmad-coach.md`：不存在。
- `scripts/coach-diagnose.ts`：强制 `--run-id`，无则 `process.exit(1)`；无 discovery、空数据提示、截断提示。
- `scoring/coach/`：有 `coachDiagnose`、`loadRunRecords`、`formatToMarkdown`；无 `discovery.ts`。
- `scripts/analytics-cluster.ts`：已有 `loadRecordsFromDataPath` 加载 *.json + scores.jsonl，可复用加载模式；但 discovery 需按 timestamp 排序、取最新 run_id、返回 truncated 标志，逻辑不同，需独立实现。
- `loadRunRecords`：按 run_id 过滤；discovery 需加载全量记录，不按 run_id 过滤，与 loader 职责不同。

---

## 3. 依赖关系与实施顺序

1. 先实现 `scoring/coach/discovery.ts`（discoverLatestRunId），再扩展 `scripts/coach-diagnose.ts`。
2. 扩展 coach-diagnose.ts 时：无 run-id → discoverLatestRunId → null 时输出空数据提示 → 否则 coachDiagnose → 截断提示 → formatToMarkdown。
3. 新建 `commands/bmad-coach.md` 可与脚本扩展并行。
4. discovery 加载逻辑可参考 analytics-cluster 的 loadRecordsFromDataPath，但需：排除 sft-dataset.jsonl、按 timestamp 降序、取前 limit、返回第一条的 run_id 与 truncated。

---

## 4. Gap 到任务映射总表

| Gap ID | 对应任务 | 验收命令 |
|--------|----------|----------|
| GAP-E6-S1-1 | T2 | commands/bmad-coach.md 存在且内容符合 |
| GAP-E6-S1-2 | T1 | discoverLatestRunId 单测 + 脚本无参可执行 |
| GAP-E6-S1-3 | T1 | discovery 排除 sft-dataset.jsonl、非评分 json |
| GAP-E6-S1-4 | T1, T3 | env COACH_DISCOVERY_LIMIT、--limit N |
| GAP-E6-S1-5 | T3 | 空数据时输出「暂无评分数据...」 |
| GAP-E6-S1-6 | T3 | 无 --run-id 时 discovery → coachDiagnose |
| GAP-E6-S1-7 | T3 | npx ts-node scripts/coach-diagnose.ts 有数据时输出 Markdown |
| GAP-E6-S1-8 | T3 | 同 GAP-E6-S1-5 |
| GAP-E6-S1-9 | T1, T3 | truncated 时附加「仅展示最近 N 条」 |
| GAP-E6-S1-10 | T3 | 默认 --format=markdown |

---

<!-- AUDIT: PASSED by code-reviewer -->
