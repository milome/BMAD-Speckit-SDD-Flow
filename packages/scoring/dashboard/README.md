# dashboard

聚合计算与仪表盘格式化。

## 职责

- 按 run_id 分组、取最新运行记录
- 计算健康分数、短板 Top3、高迭代 Top3
- 生成 Markdown 仪表盘

## 主 API 列表

| API | 说明 |
|-----|------|
| `groupByRunId` | 按 run_id 分组 |
| `getLatestRunRecords` | 获取最新运行记录 |
| `getLatestRunRecordsV2` | 增强版最新记录（带 options） |
| `getRecentRuns` | 最近运行 |
| `computeHealthScore` | 计算健康分数 |
| `getDimensionScores` | 获取维度分数 |
| `getWeakTop3` | 短板 Top3 |
| `getWeakTop3EpicStory` | 按 Epic/Story 的短板 Top3 |
| `getHighIterationTop3` | 高迭代 Top3 |
| `countVetoTriggers` | veto 触发计数 |
| `getTrend` | 趋势 |
| `aggregateByEpicStoryTimeWindow` | 按 Epic/Story 时间窗口聚合 |
| `aggregateByEpicOnly` | 仅按 Epic 聚合 |
| `getEpicAggregateRecords` | Epic 聚合记录 |
| `computeEpicHealthScore` | Epic 健康分数 |
| `getEpicDimensionScores` | Epic 维度分数 |
| `formatDashboardMarkdown` | 格式化为 Markdown 仪表盘 |

## 与 coach/query 关系

- **query**：提供 `loadAndDedupeRecords` 等加载能力
- **coach**：共用 query 与 analytics 做短板诊断
