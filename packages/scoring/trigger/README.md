# trigger

写分触发判断。

## 职责

- 加载 `config/scoring-trigger-modes.yaml`
- 根据 event、stage、scenario 判断是否写分及 writeMode

## 主 API

| API | 说明 |
|-----|------|
| `shouldWriteScore` | 判断是否写分及 writeMode |
| `loadTriggerConfig` | 加载 trigger 配置 |
| `resetTriggerConfigCache` | 重置配置缓存（用于测试） |
