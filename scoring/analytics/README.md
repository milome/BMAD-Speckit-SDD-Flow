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

## 与 coach 关系

Coach 诊断使用 analytics 的聚类与规则建议能力。
