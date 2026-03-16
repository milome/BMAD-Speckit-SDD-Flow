# constants

评分常量与路径配置。

## 职责

- 六环节权重、满分、等级区间
- scoring 数据路径
- 阶段映射表（table-a、table-b）

## 常量用途

| 文件/常量 | 用途 |
|----------|------|
| `weights.ts` | PHASE_WEIGHTS、PHASE_MAX_SCORES、LEVEL_RANGES、PHASE_WEIGHTS_SPEC/PLAN/TASKS、PHASE_WEIGHT_IMPLEMENT |
| `path.ts` | getScoringDataPath |
| `table-a.ts` | BMAD_LAYER_TO_STAGES、ALL_STAGES（阶段列表） |
| `table-b.ts` | STAGE_TO_PHASE（阶段到环节映射） |
