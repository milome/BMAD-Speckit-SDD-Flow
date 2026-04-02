# SFT 生产级数据生成增强 Batch C Tool Trace + Quality Freeze

## 目标

Batch C 聚焦收敛 tool trace 与 quality gate 的主路径，让 trace 不再只是调试附属物，而是正式进入：

- canonical sample 质量字段
- training blocker 计算
- tool-calling 目标兼容性判定

## 范围

- [packages/scoring/analytics/tool-trace.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/tool-trace.ts)
- [packages/scoring/analytics/candidate-builder.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/candidate-builder.ts)
- [packages/scoring/analytics/quality-gates.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/quality-gates.ts)
- [packages/scoring/analytics/__tests__/candidate-builder-tool-trace.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/__tests__/candidate-builder-tool-trace.test.ts)
- [packages/scoring/analytics/__tests__/quality-gates.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/__tests__/quality-gates.test.ts)
- [tests/acceptance/runtime-tool-trace-capture.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/tests/acceptance/runtime-tool-trace-capture.test.ts)

## 冻结规则

- 有合法 trace 且 call/result 可配对时，`trace_completeness = complete`
- 无 trace 时，`trace_completeness = missing`
- 有 trace 但结构不完整时，`trace_completeness = partial`
- trace 因 secrets / private key 被阻断时，`trace_completeness = blocked`
- `training_blockers` 必须显式写出 trace 相关 blocker

## 验证命令

```bash
npx vitest run packages/scoring/analytics/__tests__/candidate-builder-tool-trace.test.ts
npx vitest run packages/scoring/analytics/__tests__/quality-gates.test.ts
npx vitest run tests/acceptance/runtime-tool-trace-capture.test.ts
```
