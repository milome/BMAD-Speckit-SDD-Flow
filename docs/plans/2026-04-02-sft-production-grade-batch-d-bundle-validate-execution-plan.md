# SFT 生产级数据生成增强 Batch D Bundle + Validate Execution Plan

> **Current path**: `runAuditorHost`
> **Legacy path**: `bmad-speckit score` / `parse-and-write-score`

## 1. Plan 元信息

- Internal grade: `M`
- Requirement freeze: [2026-04-02-sft-production-grade-batch-d-bundle-validate-freeze.md](/D:/Dev/BMAD-Speckit-SDD-Flow/docs/requirements/2026-04-02-sft-production-grade-batch-d-bundle-validate-freeze.md)

## 2. 批次结构

### Batch D.1 Manifest Schema / Types

- `dataset-bundle-manifest.schema.json`
- `analytics/types.ts`

### Batch D.2 Validation Report / Bundle Writer

- `validation-report.ts`
- `bundle-writer.ts`
- `bundle-writer.test.ts`

### Batch D.3 Validate CLI

- `sft-validate.js`
- `sft-validate.test.js`
- `sft-bundle.test.js`

## 3. 验证命令

```bash
npx vitest run packages/scoring/analytics/__tests__/bundle-writer.test.ts
cd packages/bmad-speckit && node --test tests/sft-validate.test.js tests/sft-bundle.test.js
```
