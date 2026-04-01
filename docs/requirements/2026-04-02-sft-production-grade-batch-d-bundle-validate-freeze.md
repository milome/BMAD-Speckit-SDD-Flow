# SFT 生产级数据生成增强 Batch D Bundle + Validate Freeze

## 目标

Batch D 聚焦三件事：

- bundle manifest 从最小索引文件升级为正式工件说明书
- validation report 输出分层 gate 摘要
- `sft-validate` CLI 透出新的 gate 结果

## 范围

- [packages/scoring/schema/dataset-bundle-manifest.schema.json](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/schema/dataset-bundle-manifest.schema.json)
- [packages/scoring/analytics/types.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/types.ts)
- [packages/scoring/analytics/validation-report.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/validation-report.ts)
- [packages/scoring/analytics/bundle-writer.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/bundle-writer.ts)
- [packages/bmad-speckit/src/commands/sft-validate.js](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/src/commands/sft-validate.js)
- [packages/bmad-speckit/tests/sft-validate.test.js](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/sft-validate.test.js)
- [packages/bmad-speckit/tests/sft-bundle.test.js](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/bmad-speckit/tests/sft-bundle.test.js)
- [packages/scoring/analytics/__tests__/bundle-writer.test.ts](/D:/Dev/BMAD-Speckit-SDD-Flow/packages/scoring/analytics/__tests__/bundle-writer.test.ts)

## 验证命令

```bash
npx vitest run packages/scoring/analytics/__tests__/bundle-writer.test.ts
cd packages/bmad-speckit && node --test tests/sft-validate.test.js tests/sft-bundle.test.js
```
