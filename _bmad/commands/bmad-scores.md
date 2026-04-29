---
name: bmad-scores
description: 评分汇总：全部摘要、按 Epic 或 Story 筛选，输出 Markdown 表格
---

# /bmad-scores

触发评分汇总，基于 `scoring/data/`（或 `getScoringDataPath()`）下评分记录，输出 Markdown 表格格式的汇总。

## 触发方式

- Codex command：`/bmad-scores`
- CLI：`npx bmad-speckit scores`

## 调用模式

| 模式 | 命令 | 输出 |
|------|------|------|
| 全部摘要 | `npx bmad-speckit scores` | 最近 100 条评分记录（表格） |
| Epic 汇总 | `npx bmad-speckit scores --epic 3` | Epic 3 各 Story 评分 |
| Story 明细 | `npx bmad-speckit scores --story 3.3` | Story 3.3 各阶段评分明细 |

## 参数

- `--epic N`：仅展示 Epic N 各 Story 的评分（N 为正整数）
- `--story X.Y`：仅展示 Story X.Y 各阶段明细（解析为 epicId=X, storyId=Y）
- `--epic` 与 `--story` 互斥

## 输出格式

- Markdown 表格；无数据时输出「暂无评分数据，请先完成至少一轮 Dev Story」
- 无可解析 Epic/Story 时输出「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」
- 无可筛选数据时输出「无可筛选数据」

## 验收命令

```bash
npx bmad-speckit scores
npx bmad-speckit scores --epic 3
npx bmad-speckit scores --story 3.3
```
