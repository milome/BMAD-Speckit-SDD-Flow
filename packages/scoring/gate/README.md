# gate

版本锁定与回滚建议。

## 职责

- specify→plan 流转时比对 source_hash
- hash 匹配 → proceed；不匹配 → block；异常 → warn_and_proceed
- 加载最新审计记录、建议回滚

## 主 API

| API | 说明 |
|-----|------|
| `checkPreconditionHash` | 校验前置阶段源文件 hash 与上一阶段记录是否一致 |
| `loadLatestRecordByStage` | 从 rollback.ts 加载最新阶段记录 |
| `suggestRollback` | 建议回滚（定义于 rollback.ts） |

## 与上下游关系

- 依赖 `writer/types` 的 `RunScoreRecord`
- 依赖 `utils/hash` 的 `computeContentHash`
