# eval-questions

Eval 题目管理与 Agent 回答生成。

## 职责

- 题库 manifest 加载
- Agent 回答生成（LLM 调用）
- 模板生成与 run-core 执行

## 主 API

| API | 说明 |
|-----|------|
| `loadManifest` | 加载 manifest.yaml |
| `runCore` | 运行 eval 流程 |
| `generateTemplate` | 生成题目模板 |
| `agentAnswer` | Agent 回答生成 |

## CLI 入口

```bash
npx ts-node scripts/eval-questions-cli.ts
npx ts-node scripts/eval-question-generate.ts
```

## manifest 格式

见 `scoring/eval-questions/MANIFEST_SCHEMA.md`。manifest.yaml 含 `questions` 数组，每项包含 `id`、`title`、`path`、`difficulty`、`tags` 等。
