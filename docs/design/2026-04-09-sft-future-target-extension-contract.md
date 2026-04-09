# SFT Future Target Extension Contract

## 目标

这份契约定义 Batch H 之后 canonical SFT 数据链对 future target 的扩展边界，确保后续新增 preference / DPO / RFT 一类目标时，不需要重写现有 `candidate-builder -> validate -> bundle -> dashboard` 主链。

## 当前基线

当前生产级基线只对以下 target 提供正式导出：

- `openai_chat`
- `hf_conversational`
- `hf_tool_calling`

当前 dashboard / validate / bundle 已经额外提供三类训练视图：

- `assistant_only_ready`
- `completion_only_ready`
- `tool_calling_ready`

这些视图是 future target 扩展的 readiness facts，不等于已经支持新的训练格式。

## 术语约束

- `assistant_only_ready`: 样本存在可监督的 assistant target，可用于 assistant-supervision 视角统计
- `completion_only_ready`: 样本没有 tool-calling 依赖，可用于纯 completion / conversational 视角统计
- `tool_calling_ready`: 样本声明了 tools 或 tool messages，可用于 tool-calling 视角统计
- `source_scope`: 样本来源作用域分布，当前至少区分 `story_scoped`、`orphan_scoped`、`unknown`

## 不可破坏的主合同

新增 future target 时，以下规则必须保持不变：

1. 不得绕过 canonical sample。所有新 target 必须以 `CanonicalSftSample` 为唯一事实源。
2. 不得为单一 target 发明第二套样本 schema。target-specific 差异只能落在 exporter / validator projection。
3. 不得回退或弱化现有 `openai_chat` / `hf_conversational` / `hf_tool_calling` 的兼容性结果。
4. 不得让 future target 反向污染主链字段语义，例如重定义 `training_ready`、`dedupe_cluster_id`、`host_kind`、`provider_id`。
5. 不得把 target 扩展和数据清洗、评分、redaction、source provenance 混成同一层责任。

## 推荐扩展路径

新增 target 时只允许沿下面路径扩展：

1. 在 canonical metadata 中声明新 target 的可导出目标名
2. 在 `export_compatibility` 中增加该 target 的 compatibility decision
3. 在 exporter 中增加该 target 的 row projection
4. 在 validate / bundle / dashboard 中增加该 target 的 availability 和 readiness 汇总
5. 为该 target 增加 schema test、export test、dashboard/runtime summary test

## 验证门

任何 future target 扩展至少要提供以下证据：

1. canonical schema 兼容旧样本，不破坏现有 schema test
2. 旧 target 导出结果无回归
3. 新 target 的 incompatibility reasons 可机器消费
4. dashboard / validate / bundle 至少有一处能看见该 target 的 readiness / compatibility
5. 若 target 需要新增训练视图，必须说明与 `assistant_only_ready` / `completion_only_ready` / `tool_calling_ready` 的关系，不能语义重叠

## Batch H 交付后的意义

Batch H 完成后，系统已经具备：

- near-duplicate clustering
- host / provider / stage / split / source-scope balance analytics
- assistant-only / completion-only / tool-calling readiness views

因此后续新增 target 的主要工作应当是“增加 projection 与 compatibility decision”，而不是回头重构主数据链。
