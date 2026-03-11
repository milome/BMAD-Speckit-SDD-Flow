# 评分扩展

本目录为**可选**扩展，用于在审计闭环各阶段对模型实现效果按规则打分，与现有审计行为解耦。

- **可配置**：维度、权重、阈值可配置。
- **可追溯**：单次运行、单阶段得分可持久化并关联 artifact。
- **与阶段对应**：spec / plan / tasks / implement，见 §4 设计。

详见仓库根目录 `docs/BMAD/BMAD_Speckit_SDD_Flow_最优方案文档.md` §4。

## 架构（文字版）

```
scripts (CLI 入口)
    → orchestrator (解析+写分编排)
        → parsers (审计报告解析)
        → veto (阶梯与一票否决)
        → writer (写分持久化)
    → coach (短板诊断)
        → query, analytics, veto
    → dashboard (聚合与格式化)
        → query, core
```

## 子模块职责表

| 模块 | 职责 | 主入口 |
|------|------|--------|
| orchestrator | 解析审计报告并写入 scoring 存储 | `parseAndWriteScore` |
| parsers | 解析各阶段审计报告、维度分数 | `parseAuditReport`, `parseDimensionScores` |
| writer | 写分持久化（单文件 / jsonl / both） | `writeScoreRecord`, `writeScoreRecordSync` |
| coach | 短板诊断、改进建议 | `coachDiagnose` |
| dashboard | 聚合计算、仪表盘格式化 | `groupByRunId`, `computeHealthScore`, `formatDashboardMarkdown` |
| query | 记录查询 | `loadAndDedupeRecords`, `queryByEpic`, `queryByStory`, `queryLatest` |
| veto | 阶梯系数与 veto 判定 | `applyTierAndVeto`, `evaluateEpicVeto` |
| core | 分数计算、维度聚合 | `computeCompositeScore`, `aggregateFourDimensions`, `scoreToLevel` |

## 主入口 API 列表

| API | 模块 | 说明 |
|-----|------|------|
| `parseAndWriteScore` | orchestrator | 解析报告并写入 scoring 存储 |
| `coachDiagnose` | coach | Coach 诊断入口 |
| `writeScoreRecord` / `writeScoreRecordSync` | writer | 写分入口 |
| `loadAndDedupeRecords` | query | 加载并去重记录 |

## Schema 与配置

- **run-score-schema**：`scoring/schema/run-score-schema.json`，定义 `RunScoreRecord` 结构；writer 写入前校验。

## 整改轮次（iteration_count）

- `RunScoreRecord.iteration_count`：该 stage 审计未通过次数；0=一次通过。
- **历史补录 / eval**：此类场景通常无迭代信息，`iteration_count` 多为 0。
