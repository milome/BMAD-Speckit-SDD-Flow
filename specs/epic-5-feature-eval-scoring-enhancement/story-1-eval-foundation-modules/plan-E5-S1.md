# plan-E5-S1：eval-foundation-modules 实现方案

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.1  
**输入**：spec-E5-S1.md、Story 5.1、TASKS_gaps功能补充实现.md B02/B04/B10/B12/B13

---

## 1. 目标与约束

- 实现 B02 版本锁定、B04 触发加载器、B10 eval_question E2E、B12 Bugfix 回写、B13 回退建议五个独立模块。
- 与现有 scoring 模块无循环依赖；消费 hash、parse-and-write、coach 等既有能力。
- 每模块含单测，B10 含 E2E；禁止伪实现与占位。

---

## 2. 模块设计

### 2.1 实现路径

```
scoring/
  gate/
    version-lock.ts      # B02: checkPreconditionHash, loadLatestRecordByStage
    rollback.ts          # B13: suggestRollback
    __tests__/
      version-lock.test.ts
      rollback.test.ts
  trigger/
    trigger-loader.ts    # B04: loadTriggerConfig, shouldWriteScore, resetTriggerConfigCache
    __tests__/
      trigger-loader.test.ts
  bugfix/
    writeback.ts         # B12: writebackBugfixToStory
    __tests__/
      writeback.test.ts
  parsers/__tests__/fixtures/
    sample-eval-question-report.md   # B10 fixture
  __tests__/e2e/
    eval-question-flow.test.ts       # B10 E2E
  data/
    eval-question-sample.json        # B10 示例记录
```

### 2.2 修改文件

| 文件 | 变更 |
|------|------|
| scoring/writer/types.ts | content_hash JSDoc 更新；source_hash 新增 |
| scoring/schema/run-score-schema.json | source_hash 属性 |
| scoring/orchestrator/parse-and-write.ts | sourceHashFilePath、source_hash 写入 |
| scripts/parse-and-write-score.ts | --sourceHashFilePath、--event、--skipTriggerCheck、--questionVersion |

---

## 3. 核心 API 与调用流程

### 3.1 B02 版本锁定

1. plan 阶段启动时：`loadLatestRecordByStage('spec', dataPath)` 取 spec 阶段最新记录
2. 若记录含 `source_hash`：`checkPreconditionHash('plan', 'path/to/spec.md', priorRecord.source_hash)`
3. action=block → process.exit(1)；warn_and_proceed → console.warn 后继续
4. parseAndWriteScore 时传入 `sourceHashFilePath`，写入当前 spec.md 的 source_hash

### 3.2 B04 触发加载器

1. parse-and-write-score CLI 接收 `--event`（默认或由调用方传入）
2. 非 `--skipTriggerCheck` 时：`shouldWriteScore(event, stage, scenario)`
3. write=false → 跳过写入并退出（或 console 输出后退出）
4. write=true → 继续 parseAndWriteScore，writeMode 来自 TriggerDecision

### 3.3 B10 eval_question E2E

1. 读取 fixture sample-eval-question-report.md（格式与 prd 兼容）
2. 调用 parseAndWriteScore(content, stage='prd', scenario='eval_question', question_version='v1')
3. 调用 coachDiagnose(runId)
4. 断言 record.content_hash、record.base_commit_hash 存在且非空

### 3.4 B12 Bugfix 回写

1. 解析 BUGFIX 文档 ## §7 下的 checkbox 列表
2. 正则匹配 `[x]`、`[X]` 等变体，提取已完成任务文本
3. 格式化 `[{ISO timestamp}] BUGFIX({branchId}) → Story({storyId}): {摘要}`
4. 写入或追加 storyProgressPath

### 3.5 B13 回退建议

1. 纯函数，无副作用
2. 返回 RollbackSuggestion：message 含 ⚠️ 前缀，commands 数组
3. 调用方负责输出到 console 或日志，不执行 git 命令

---

## 4. 数据结构

### 4.1 RunScoreRecord 扩展

- `source_hash?: string` — 被审计源文件的 SHA-256

### 4.2 ParseAndWriteScoreOptions 扩展

- `sourceHashFilePath?: string` — 计算 source_hash 的文件路径

---

## 5. 测试策略

### 5.1 单元测试

| 模块 | 用例数 | 命令 |
|------|--------|------|
| version-lock | 7 | `npm test -- scoring/gate/__tests__/version-lock` |
| trigger-loader | 7 | `npm test -- scoring/trigger/__tests__/trigger-loader` |
| writeback | 6 | `npm test -- scoring/bugfix/__tests__/writeback` |
| rollback | 4 | `npm test -- scoring/gate/__tests__/rollback` |

### 5.2 端到端测试

| 场景 | 验证 |
|------|------|
| eval_question 全链路 | eval-question-flow.test.ts：parse→write→coach diagnose |
| content_hash、base_commit_hash | E2E 断言 |
| writeMode=jsonl | 正确追加 scores.jsonl |

### 5.3 集成验证

- parse-and-write-score CLI 支持新参数，可手动或脚本验收
- version-lock、trigger-loader 被 Skill/CLI 编排调用（本 Story 产出模块，编排在后续 Skill 中集成）

---

## 6. 需求映射清单（plan ↔ spec + Story）

| spec 章节 | plan 对应 |
|-----------|----------|
| §2.1 B02 | plan §3.1、§2.1 version-lock |
| §2.2 B04 | plan §3.2、trigger-loader |
| §2.3 B10 | plan §3.3、§5.2 E2E |
| §2.4 B12 | plan §3.4、writeback |
| §2.5 B13 | plan §3.5、rollback |

<!-- AUDIT: PASSED by code-reviewer -->
