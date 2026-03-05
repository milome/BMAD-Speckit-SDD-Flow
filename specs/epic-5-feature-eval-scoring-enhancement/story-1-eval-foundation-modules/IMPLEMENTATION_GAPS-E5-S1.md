# IMPLEMENTATION_GAPS-E5-S1：eval-foundation-modules

**输入**：spec-E5-S1.md、plan-E5-S1.md、现有代码

---

## 1. 与现有代码的差距

### 1.1 B02 版本锁定

| 差距 | 现状 | 目标 |
|------|------|------|
| 无 version-lock 模块 | scoring/gate/ 不存在 | 新增 version-lock.ts |
| RunScoreRecord 无 source_hash | types.ts 仅有 content_hash、base_commit_hash | 新增 source_hash |
| parse-and-write 不写入 source_hash | 无 sourceHashFilePath 参数 | 新增参数与写入逻辑 |
| CLI 无 sourceHashFilePath | parse-and-write-score.ts 无该参数 | 新增 --sourceHashFilePath |

### 1.2 B04 触发加载器

| 差距 | 现状 | 目标 |
|------|------|------|
| 无 trigger-loader | scoring/trigger/ 不存在 | 新增 trigger-loader.ts |
| config 存在但无代码读取 | config/scoring-trigger-modes.yaml 已有 | loadTriggerConfig、shouldWriteScore |
| CLI 无 event 与前置检查 | parse-and-write-score 直接写入 | 新增 --event、--skipTriggerCheck |

### 1.3 B10 eval_question E2E

| 差距 | 现状 | 目标 |
|------|------|------|
| 无 eval_question fixture | 仅有 sample-prd/arch/story | sample-eval-question-report.md |
| 无 E2E 测试 | scoring/__tests__/e2e/ 可能不存在 | eval-question-flow.test.ts |
| CLI 无 questionVersion | 已有 question_version 在 options 中 | 需确认 parse-and-write 已支持并暴露 CLI |

### 1.4 B12 Bugfix 回写

| 差距 | 现状 | 目标 |
|------|------|------|
| 无 writeback 模块 | scoring/bugfix/ 不存在 | 新增 writeback.ts |

### 1.5 B13 回退建议

| 差距 | 现状 | 目标 |
|------|------|------|
| 无 rollback 模块 | scoring/gate/ 不存在 | 新增 rollback.ts |

---

## 2. 依赖与前置

- hash.ts、parse-and-write.ts、coach/diagnose.ts、writer/types.ts 已存在且稳定
- run-score-schema.json 需扩展，不影响现有 required 字段
- 无阻塞性依赖，可并行实施 B02/B04/B10/B12/B13

---

## 3. Gaps 汇总

| Gap ID | 描述 | 对应任务 |
|--------|------|----------|
| GAP-E5-S1-1 | version-lock、types、schema、parse-and-write、CLI | Task 1 B02 |
| GAP-E5-S1-2 | trigger-loader、CLI event/skipTriggerCheck | Task 2 B04 |
| GAP-E5-S1-3 | eval-question fixture、E2E、CLI questionVersion、sample.json | Task 3 B10 |
| GAP-E5-S1-4 | writeback | Task 4 B12 |
| GAP-E5-S1-5 | rollback | Task 5 B13 |

<!-- AUDIT: PASSED by code-reviewer -->
