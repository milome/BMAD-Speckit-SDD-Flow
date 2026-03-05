# Tasks: eval-foundation-modules (E5-S1)

**Input**: spec-E5-S1.md、plan-E5-S1.md、IMPLEMENTATION_GAPS-E5-S1.md  
**Prerequisites**: hash.ts、parse-and-write.ts、coach、writer 已存在

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 5.1 | §3 Task 1 | B02 版本锁定 |
| T2 | Story 5.1 | §3 Task 2 | B04 触发加载器 |
| T3 | Story 5.1 | §3 Task 3 | B10 eval_question E2E |
| T4 | Story 5.1 | §3 Task 4 | B12 Bugfix 回写 |
| T5 | Story 5.1 | §3 Task 5 | B13 Git 回退建议 |

---

## Phase 1：B02 版本锁定（T1）

**AC**: AC-B02-1, AC-B02-2

- [x] **T1.1** 修改 `scoring/writer/types.ts`：更新 `content_hash` JSDoc 为「传入 parseAndWriteScore 的审计报告内容的 SHA-256（非源文件 hash）」；新增 `source_hash?: string`，JSDoc「被审计的源文件的 SHA-256 指纹」
- [x] **T1.2** 修改 `scoring/schema/run-score-schema.json`：properties 新增 `source_hash`
- [x] **T1.3** 修改 `scoring/orchestrator/parse-and-write.ts`：ParseAndWriteScoreOptions 新增 `sourceHashFilePath?: string`；非空时 computeContentHash 写入 source_hash
- [x] **T1.4** 修改 `scripts/parse-and-write-score.ts`：新增 `--sourceHashFilePath` CLI 参数
- [x] **T1.5** 新增 `scoring/gate/version-lock.ts`：实现 `checkPreconditionHash`、`loadLatestRecordByStage`
- [x] **T1.6** 新增 `scoring/gate/__tests__/version-lock.test.ts`：7 个测试用例

**验收命令**：`npm test -- scoring/gate/__tests__/version-lock`

---

## Phase 2：B04 触发加载器（T2）

**AC**: AC-B04-1, AC-B04-2

- [x] **T2.1** 新增 `scoring/trigger/trigger-loader.ts`：实现 `loadTriggerConfig`、`shouldWriteScore`、`resetTriggerConfigCache`
- [x] **T2.2** 修改 `scripts/parse-and-write-score.ts`：新增 `--event` 参数；调用 `shouldWriteScore` 前置检查；新增 `--skipTriggerCheck` 参数
- [x] **T2.3** 新增 `scoring/trigger/__tests__/trigger-loader.test.ts`：7 个测试用例

**验收命令**：`npm test -- scoring/trigger/__tests__/trigger-loader`

---

## Phase 3：B10 eval_question E2E（T3）

**AC**: AC-B10-1, AC-B10-2

- [x] **T3.1** 新增 fixture `scoring/parsers/__tests__/fixtures/sample-eval-question-report.md`
- [x] **T3.2** 新增 `scoring/__tests__/e2e/eval-question-flow.test.ts`：3 个 E2E 测试
- [x] **T3.3** 修改 `scripts/parse-and-write-score.ts`：新增 `--questionVersion` 参数
- [x] **T3.4** 新增 `scoring/data/eval-question-sample.json` 示例记录

**验收命令**：`npm test -- scoring/__tests__/e2e/eval-question-flow`

---

## Phase 4：B12 Bugfix 回写（T4）

**AC**: AC-B12-1, AC-B12-2

- [x] **T4.1** 新增 `scoring/bugfix/writeback.ts`：实现 `writebackBugfixToStory`，checkbox 正则 `/^\s*[-*+]?\s*\d*\.?\s*\[(x|X)\]\s+(.+)$/`
- [x] **T4.2** 新增 `scoring/bugfix/__tests__/writeback.test.ts`：6 个测试用例

**验收命令**：`npm test -- scoring/bugfix/__tests__/writeback`

---

## Phase 5：B13 Git 回退建议（T5）

**AC**: AC-B13-1, AC-B13-2

- [x] **T5.1** 新增 `scoring/gate/rollback.ts`：实现 `suggestRollback`，message 含 `⚠️ 以下回退命令仅供参考，请确认后手动执行：`
- [x] **T5.2** 新增 `scoring/gate/__tests__/rollback.test.ts`：4 个测试用例

**验收命令**：`npm test -- scoring/gate/__tests__/rollback`

---

## 执行顺序（TDD 红灯→绿灯→重构）

1. Phase 1：T1.1→T1.2→T1.3→T1.4→T1.5→T1.6（先写 version-lock 测试，再实现）
2. Phase 2：T2.1→T2.2→T2.3
3. Phase 3：T3.1→T3.2→T3.3→T3.4
4. Phase 4：T4.1→T4.2
5. Phase 5：T5.1→T5.2

**全量验证**：`npm test` 或 `npm run test`

<!-- AUDIT: PASSED by code-reviewer -->
