# SFT 生产级数据生成增强 Batch B Runtime Identity Freeze

## 1. 目标

Batch B 的目标是收敛 runtime identity 的事实来源，让 runtime / writer / scoring / dashboard 对以下字段形成一致语义：

- `story_key`
- `story_id`
- `epic_id`
- `artifact_root`
- `host`
- `host_kind`

这批改动不处理 provider smoke、bundle manifest、privacy gate 或 validation gate，只解决“这些 identity 字段到底从哪里来、如何在投影与写盘层稳定保留”的问题。

## 2. 范围

纳入范围：

- [packages/scoring/runtime/types.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/runtime/types.ts)
- [packages/scoring/runtime/projection.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/runtime/projection.ts)
- [packages/scoring/writer/types.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/writer/types.ts)
- [packages/scoring/writer/write-score.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/writer/write-score.ts)
- [packages/scoring/runtime/__tests__/projection.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/runtime/__tests__/projection.test.ts)
- [packages/scoring/__tests__/integration/dashboard-runtime-snapshot.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/__tests__/integration/dashboard-runtime-snapshot.test.ts)

不纳入范围：

- canonical schema 新字段继续扩展
- candidate-builder 对 identity 字段的最终消费策略
- provider / trace / privacy / bundle / CLI 增强

## 3. 冻结的来源规则

### 3.1 runtime scope 层

`RuntimeScopeRef` 是 Batch B 的主事实源，要求稳定保留：

- `story_key`
- `story_id`
- `epic_id`
- `artifact_root`
- `host`
- `host_kind`

### 3.2 writer 层

`RunScoreRecord` 允许显式落盘：

- `story_key`
- `story_id`
- `epic_id`
- `artifact_root`
- `host`
- `host_kind`

writer 的职责不是生成这些值，而是保留与合并这些值。

### 3.3 projection 层

projection 的职责是：

- 从 event.scope 合并这些 identity 字段
- 避免后续不完整事件把已存在的 identity 冲掉

## 4. 验收标准

Batch B 完成需满足：

1. runtime types 可以表达上述字段
2. projection 可保留并输出上述字段
3. writer types 可落盘上述字段
4. write-score 合并已有记录时不会丢 identity 字段
5. projection test 通过
6. dashboard runtime snapshot integration test 通过

## 5. 验证命令

```bash
npx vitest run packages/scoring/runtime/__tests__/projection.test.ts
npx vitest run packages/scoring/__tests__/integration/dashboard-runtime-snapshot.test.ts
```
