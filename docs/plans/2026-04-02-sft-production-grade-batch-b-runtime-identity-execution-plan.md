# SFT 生产级数据生成增强 Batch B Runtime Identity Execution Plan

## 1. Plan 元信息

- Internal grade: `M`
- Requirement freeze: [2026-04-02-sft-production-grade-batch-b-runtime-identity-freeze.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/requirements/2026-04-02-sft-production-grade-batch-b-runtime-identity-freeze.md)

## 2. 执行批次

### Batch B.1 Runtime Types / Projection

- 更新 `RuntimeScopeRef`
- 更新 projection 合并逻辑
- 补 projection tests

### Batch B.2 Writer Types / Merge Logic

- 更新 `RunScoreRecord`
- 更新 `writeScoreRecordSync` 合并行为

### Batch B.3 Dashboard Snapshot 验证

- 更新 integration tests，确保 snapshot 可见 identity 字段

## 3. 所有权边界

- 只改 Batch B 范围内文件
- 不触碰 canonical sample schema/types/builder
- 不顺手接 provider 或 bundle 改动

## 4. 验证命令

```bash
npx vitest run packages/scoring/runtime/__tests__/projection.test.ts
npx vitest run packages/scoring/__tests__/integration/dashboard-runtime-snapshot.test.ts
```

## 5. 交付条件

- 上述 2 条命令真实通过
- `git diff` 仅包含 Batch B 范围文件
