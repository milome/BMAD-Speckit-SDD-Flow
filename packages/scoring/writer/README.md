# writer

写分持久化。

## 职责

- 将 `RunScoreRecord` 写入 scoring 存储
- 支持单文件（overwrite `{run_id}.json`）、jsonl（append `scores.jsonl`）、both 模式

## 主 API

| API | 说明 |
|-----|------|
| `writeScoreRecord` | 异步写入单条评分记录 |
| `writeScoreRecordSync` | 同步写入 |
| `writeSingleFile` | 单文件模式写入 |
| `appendJsonl` | jsonl 模式追加 |
| `ensureDataDir` | 确保数据目录存在 |
| `validateRunScoreRecord` | 校验记录格式 |
| `validateScenarioConstraints` | 校验 scenario 约束 |

## run-score-schema

见 `scoring/schema/run-score-schema.json`，定义 `RunScoreRecord` 结构；writer 写入前校验。
