# SFT 生产级数据生成增强 Batch A Execution Plan

## 1. Plan 元信息

- Internal grade: `M`
- Runtime mode: `interactive_governed`
- Requirement freeze: [2026-04-02-sft-production-grade-batch-a-freeze.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/requirements/2026-04-02-sft-production-grade-batch-a-freeze.md)
- Scope: canonical sample schema / types / builder / Batch A tests

## 2. 目标

将 canonical sample 的生产级扩展字段先落到最小闭环：

1. schema 可表达
2. types 可约束
3. builder 可产出
4. tests 可验证

## 3. 批次结构

### Batch A.1 Schema 与 Types

文件：

- [packages/scoring/schema/canonical-sft-sample.schema.json](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/schema/canonical-sft-sample.schema.json)
- [packages/scoring/analytics/types.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/types.ts)

输出：

- 新字段进入 schema/types
- 字段层级固定

### Batch A.2 Builder 与 Legacy Compatibility

文件：

- [packages/scoring/analytics/candidate-builder.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/candidate-builder.ts)
- [packages/scoring/analytics/sft-extractor.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/sft-extractor.ts)

输出：

- builder 产出新增字段
- legacy extract 不回归

### Batch A.3 Schema / Builder 测试

文件：

- [packages/scoring/analytics/__tests__/canonical-sft-schema.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/__tests__/canonical-sft-schema.test.ts)
- [packages/scoring/__tests__/canonical-sft-schema.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/__tests__/canonical-sft-schema.test.ts)
- [packages/scoring/analytics/__tests__/candidate-builder.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/__tests__/candidate-builder.test.ts)

输出：

- 正向 schema case
- 负向 schema case
- builder 新字段断言

## 4. Ownership 边界

- 本批只允许修改 Batch A requirement freeze 指定文件
- 不修改 runtime/types、projection、quality-gates、bundle-writer、CLI help、dashboard 展示层
- 不引入 provider smoke / bundle manifest / validation report 结构改动

## 5. 实施细则

- `source.provider_id/provider_mode/tool_trace_ref` 作为可选字段进入 schema/types
- `metadata.host_kind` 作为可选字段进入 schema/types
- `quality.trace_completeness/training_ready/training_blockers` 作为可选字段进入 schema/types，但 builder 产物中应稳定写出
- `provenance.generator_version/schema_version` 作为可选字段进入 schema/types，但 builder 产物中应稳定写出
- `sft-extractor` 不主动暴露所有新字段，但不得因新字段引入 legacy 兼容回归

## 6. 验证命令

```bash
npx vitest run packages/scoring/analytics/__tests__/canonical-sft-schema.test.ts
npx vitest run packages/scoring/__tests__/canonical-sft-schema.test.ts
npx vitest run packages/scoring/analytics/__tests__/candidate-builder.test.ts
```

## 7. 交付判定

允许声明“Batch A 完成”的条件：

- 代码修改完成
- 上述 3 条验证命令真实通过
- `git diff` 仅包含 Batch A 范围内文件或与测试运行直接相关的临时可忽略产物

不允许的完成表述：

- 未跑验证即声称“已完成”
- 只改 schema/types 不改 builder/tests 就声称“已落地”

## 8. 回滚规则

- 若 builder 改动导致 legacy extract 回归，优先回退 builder 的新字段填充逻辑，不回退 schema/types 主定义
- 若 schema 负向 case 与现有 fixture 冲突，优先修测试样例，不放宽 schema 约束

## 9. Cleanup 预期

- 不新增临时计划文档之外的散落文件
- 验证完成后检查 `git status --short`
- 若测试生成临时目录，应确认未落入 git index
