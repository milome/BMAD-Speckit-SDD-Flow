# SFT 生产级数据生成增强 Batch A Requirement Freeze

## 1. 背景

当前仓库已经完成 runtime dashboard / SFT baseline 稳定化，并已产出以下规划文档：

- [sft-production-grade-data-generation-enhancement.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/plans/sft-production-grade-data-generation-enhancement.md)
- [tasks-v1-sft-production-grade-data-generation-enhancement.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/plans/tasks-v1-sft-production-grade-data-generation-enhancement.md)
- [tasks-v1-sft-production-grade-data-generation-enhancement-implementation-spec.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/plans/tasks-v1-sft-production-grade-data-generation-enhancement-implementation-spec.md)

下一步不是继续补计划，而是正式开始第一批代码收敛工作：先落地 canonical sample 的生产级字段扩展与对应测试闭环。

## 2. 目标

本次 Batch A 只处理第一批最核心的契约层增强：

1. 扩展 canonical sample schema
2. 扩展 analytics types
3. 在 candidate builder 中填充新增字段
4. 更新 schema / builder 相关测试

Batch A 完成后，应能为后续 T2-T8 提供稳定基础，而不必在后续实现阶段反复回改 canonical 契约。

## 3. 范围

本次纳入范围：

- [packages/scoring/schema/canonical-sft-sample.schema.json](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/schema/canonical-sft-sample.schema.json)
- [packages/scoring/analytics/types.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/types.ts)
- [packages/scoring/analytics/candidate-builder.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/candidate-builder.ts)
- [packages/scoring/analytics/sft-extractor.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/sft-extractor.ts)
- [packages/scoring/analytics/__tests__/canonical-sft-schema.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/__tests__/canonical-sft-schema.test.ts)
- [packages/scoring/__tests__/canonical-sft-schema.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/__tests__/canonical-sft-schema.test.ts)
- [packages/scoring/analytics/__tests__/candidate-builder.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/__tests__/candidate-builder.test.ts)

本次不纳入范围：

- runtime identity 字段来源收敛
- provider adapter / provider smoke
- privacy gate 最终闭环
- bundle manifest 增强
- validation report 五层门禁
- dashboard / CLI 展示层增强

## 4. 冻结的字段目标

Batch A 冻结以下新增目标字段，并要求在 schema/types/builder/test 内形成一致闭环：

### 4.1 `source`

- `provider_id?: string`
- `provider_mode?: string`
- `tool_trace_ref?: string`

### 4.2 `metadata`

- `host_kind?: string`

### 4.3 `quality`

- `trace_completeness?: 'complete' | 'partial' | 'missing' | 'blocked'`
- `training_ready?: boolean`
- `training_blockers?: string[]`

### 4.4 `provenance`

- `generator_version?: string`
- `schema_version?: string`

## 5. 行为要求

### 5.1 builder 行为

- 无 tool trace 时，`trace_completeness` 默认为 `missing`
- 有合法 tool trace 时，`trace_completeness` 至少应为 `complete`
- `training_ready` 在 Batch A 阶段先由 builder/quality gate 产出稳定布尔值，不允许缺失
- `training_blockers` 在 Batch A 阶段必须稳定为字符串数组，即使为空数组
- `generator_version` 与 `schema_version` 必须在构建结果中可见

### 5.2 兼容性要求

- 不能破坏现有 canonical sample 的旧字段语义
- 不能破坏现有 legacy `sft-extract` 主路径
- 不能让现有 builder 测试中已覆盖的 accepted/rejected 行为回归

## 6. 验收标准

Batch A 完成需同时满足：

1. 新字段已写入 schema 与 TypeScript types
2. builder 输出样本中可见这些字段
3. analytics 侧 schema test 通过
4. root schema test 通过
5. candidate builder test 通过
6. 没有把目标字段放错层级，导致后续 T2-T8 再次搬迁

## 7. 验证命令

```bash
npx vitest run packages/scoring/analytics/__tests__/canonical-sft-schema.test.ts
npx vitest run packages/scoring/__tests__/canonical-sft-schema.test.ts
npx vitest run packages/scoring/analytics/__tests__/candidate-builder.test.ts
```

## 8. 完成语言策略

只有在上述 3 条命令真实通过后，才能声明 Batch A 完成。

若仅完成代码修改但未跑通验证，只能表述为“Batch A 已实现，尚待验证”或“部分完成”。
