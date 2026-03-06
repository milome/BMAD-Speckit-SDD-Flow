# 评分扩展

本目录为**可选**扩展，用于在审计闭环各阶段对模型实现效果按规则打分，与现有审计行为解耦。

- **可配置**：维度、权重、阈值可配置。
- **可追溯**：单次运行、单阶段得分可持久化并关联 artifact。
- **与阶段对应**：spec / plan / tasks / implement，见 §4 设计。

详见仓库根目录 `docs/BMAD/BMAD_Speckit_SDD_Flow_最优方案文档.md` §4。当前为占位，具体规则与执行逻辑在后续迭代中扩展。

## 整改轮次（iteration_count）

- `RunScoreRecord.iteration_count`：该 stage 审计未通过次数；0=一次通过。
- **历史补录 / eval**：此类场景通常无迭代信息，`iteration_count` 多为 0。
