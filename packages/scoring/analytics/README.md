# analytics

SFT 提取、规则建议、提示优化、聚类。

## 职责

- SFT 训练数据提取
- 规则建议（从短板推导）
- 提示优化建议
- 短板聚类分析

## 主 API 列表

| API | 说明 |
|-----|------|
| `sftExtract` | SFT 训练数据提取 |
| `parseAuditReport` | 解析审计报告（复用 parsers） |
| `suggestRules` | 规则建议 |
| `promptOptimizer` | 提示优化 |
| `clusterWeaknesses` | 短板聚类 |

## Canonical SFT Pipeline

- `canonical-sample.ts`：定义 legacy BUGFIX / audit artifact 到 canonical message 的映射辅助。
- `candidate-builder.ts`：从 scoring records 构建 `CanonicalSftSample`，补齐 provenance、quality、split、export compatibility。
- `quality-gates.ts` / `redaction.ts` / `split.ts`：统一执行质量门禁、脱敏与确定性切分。
- `sft-extractor.ts`：仅保留 legacy `instruction/input/output` JSONL 兼容出口；内部已委托 canonical candidate pipeline。

## 与 coach 关系

Coach 诊断使用 analytics 的聚类与规则建议能力。
