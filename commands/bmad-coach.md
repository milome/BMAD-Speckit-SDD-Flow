---
name: bmad-coach
description: AI Coach 诊断：基于最近一轮评分数据输出 phase_scores、weak_areas、recommendations
---

# /bmad-coach

触发 AI Coach 诊断，基于 `scoring/data/`（或 `getScoringDataPath()`）下最新评分记录，输出 Markdown 诊断报告。

## 触发方式

- Cursor Command：`/bmad-coach`
- CLI：`npx ts-node scripts/coach-diagnose.ts` 或 `npm run coach:diagnose`

## 调用流程（无参数）

1. **Discovery**：扫描 `getScoringDataPath()` 下 `*.json`（仅评分 schema）与 `scores.jsonl`，按 `timestamp` 取最新 N 条（默认 100）
2. **空数据**：若无评分记录，返回「暂无评分数据，请先完成至少一轮 Dev Story」
3. **诊断**：取最新 run_id → 调用 `coachDiagnose(runId)` → `formatToMarkdown`
4. **截断提示**：数据量超过 N 时，在报告前附加「仅展示最近 N 条」

## 输出格式

- 默认 Markdown：含 phase_scores、weak_areas、recommendations
- `--format=json` 时输出 JSON

## 可选参数

- `--run-id <id>`：指定 run_id，跳过 discovery
- `--epic N`：仅诊断 Epic N 相关数据（Story 6.2）
- `--story X.Y`：仅诊断 Story X.Y（解析为 epicId=X, storyId=Y）；与 `--epic` 互斥
- `--format json|markdown`：默认 markdown
- `--limit N`：discovery 最多考虑 N 条（默认 100）；环境变量 `COACH_DISCOVERY_LIMIT` 可覆盖

## 验收命令

```bash
npx ts-node scripts/coach-diagnose.ts
npx ts-node scripts/coach-diagnose.ts --epic 3
npx ts-node scripts/coach-diagnose.ts --story 3.3
```

有数据时输出诊断报告；空目录时输出「暂无评分数据，请先完成至少一轮 Dev Story」。`--epic`、`--story` 无匹配时输出明确反馈（如「无可筛选数据」）。
