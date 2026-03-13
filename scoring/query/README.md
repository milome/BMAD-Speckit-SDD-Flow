# query

记录查询。

## 职责

- 加载 scoring 数据（`*.json` 与 `scores.jsonl`）
- 按 (run_id, stage) 去重取最新
- 按 Epic/Story/Latest/Stage/Scenario 查询

## 主 API

| API | 说明 |
|-----|------|
| `loadAndDedupeRecords` | 加载并去重记录 |
| `queryByEpic` | 按 Epic 查询（排除 eval_question） |
| `queryByStory` | 按 Epic+Story 查询 |
| `queryLatest` | 取最新 N 条 |
| `queryByStage` | 按 run_id+stage 查询 |
| `queryByScenario` | 按 scenario 查询 |
| `parseEpicStoryFromRecord` | 从记录解析 Epic/Story |
