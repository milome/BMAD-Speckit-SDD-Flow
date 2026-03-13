# orchestrator

解析审计报告并写入 scoring 存储的编排层。

## 职责

- 解析各阶段审计报告
- 编排 parsers → veto → writer 流程
- 对接 trigger 决定是否写分

## 主 API

| API | 说明 |
|-----|------|
| `parseAndWriteScore` | 解析报告并写入 scoring 存储（主入口） |

## 与上下游关系

- **上游**：parsers（解析）、veto（阶梯与 veto）
- **下游**：writer（写分持久化）、trigger（写分触发判断）

## CLI 调用方式

```bash
npx ts-node scripts/parse-and-write-score.ts [options]
```
