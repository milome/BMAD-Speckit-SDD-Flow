# core

分数计算与维度聚合。

## 职责

- 六环节加权 composite 分数
- 四维度聚合
- 得分等级映射（L1–L5）

## 主 API

| API | 说明 |
|-----|------|
| `computeCompositeScore` | 计算加权 composite 分数 |
| `aggregateFourDimensions` | 四维度聚合 |
| `scoreToLevel` | 得分映射到等级（L1–L5） |

## 常量导出

- `PHASE_WEIGHTS`、`PHASE_MAX_SCORES`、`LEVEL_RANGES`（来自 constants/weights）
- `BMAD_LAYER_TO_STAGES`、`ALL_STAGES`（来自 constants/table-a）
- `STAGE_TO_PHASE`（来自 constants/table-b）
- `getScoringDataPath`（来自 constants/path）
