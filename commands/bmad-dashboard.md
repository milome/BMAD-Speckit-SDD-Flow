---
name: bmad-dashboard
description: 项目健康度仪表盘：总分、四维、短板 Top 3、Veto 统计、趋势
---

# /bmad-dashboard

触发项目健康度仪表盘生成，基于 `scoring/data/`（或 `getScoringDataPath()`）下 real_dev 评分记录，输出 Markdown 仪表盘到 `_bmad-output/dashboard.md` 并在对话中展示。

## 触发方式

- Cursor Command：`/bmad-dashboard`
- CLI：`npx ts-node scripts/dashboard-generate.ts`

## 调用流程（无参数）

1. **数据加载**：从 `getScoringDataPath()` 加载评分记录，仅考虑 scenario=real_dev
2. **空数据**：若无 real_dev 记录，输出「暂无数据，请先完成至少一轮 Dev Story」，仍写入 `_bmad-output/dashboard.md`
3. **有数据**：计算项目健康度总分、四维雷达图、短板 Top 3、Veto 触发统计、趋势，格式化为 Markdown
4. **输出**：写入 `_bmad-output/dashboard.md`，同时 stdout 输出便于对话展示

## 输出内容（有数据时）

- 项目健康度总分（PHASE_WEIGHTS 加权）
- 四维雷达图数据（dimension_scores；无则显示「无数据」）
- 短板 Top 3（得分最低的 3 个阶段/Story）
- Veto 触发统计
- 趋势（最近 5 run 升/降/持平）

## 验收命令

```bash
npx ts-node scripts/dashboard-generate.ts
```

有数据时输出完整仪表盘 Markdown；空目录时输出「暂无数据，请先完成至少一轮 Dev Story」。输出同时写入 `_bmad-output/dashboard.md`。
