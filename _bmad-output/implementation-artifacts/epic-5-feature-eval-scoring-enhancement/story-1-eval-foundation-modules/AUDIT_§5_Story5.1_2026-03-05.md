# Story 5.1 eval-foundation-modules 实施后审计报告（§5）

**审计日期**：2026-03-05  
**审计依据**：audit-prompts.md §5 执行阶段审计提示词  
**审计对象**：Story 5.1 eval-foundation-modules 实施结果

---

## 1. 审计范围

| 文档/代码 | 路径 |
|-----------|------|
| Story 文档 | `_bmad-output/implementation-artifacts/5-1-eval-foundation-modules/5-1-eval-foundation-modules.md` |
| spec | `specs/epic-5/story-1-eval-foundation-modules/spec-E5-S1.md` |
| plan | `specs/epic-5/story-1-eval-foundation-modules/plan-E5-S1.md` |
| IMPLEMENTATION_GAPS | `specs/epic-5/story-1-eval-foundation-modules/IMPLEMENTATION_GAPS-E5-S1.md` |
| tasks | `specs/epic-5/story-1-eval-foundation-modules/tasks-E5-S1.md` |
| 实现代码 | `scoring/gate/`、`scoring/trigger/`、`scoring/bugfix/`、`scoring/orchestrator/`、`scoring/writer/`、`scripts/` |

---

## 2. 逐项验证

### 2.1 需求/plan/GAPS 覆盖

| 需求 | spec 章节 | plan 对应 | 实现验证 |
|------|-----------|-----------|----------|
| B02 版本锁定 | §2.1 | version-lock.ts | `scoring/gate/version-lock.ts` 实现 `checkPreconditionHash`、`loadLatestRecordByStage`；types.ts 新增 `source_hash`；schema 新增 `source_hash`；parse-and-write 支持 `sourceHashFilePath`；CLI 支持 `--sourceHashFilePath` |
| B04 触发加载器 | §2.2 | trigger-loader.ts | `scoring/trigger/trigger-loader.ts` 实现 `loadTriggerConfig`、`shouldWriteScore`、`resetTriggerConfigCache`；CLI 支持 `--event`、`--skipTriggerCheck`，调用 `shouldWriteScore` 前置检查 |
| B10 eval_question E2E | §2.3 | eval-question-flow.test.ts | fixture `sample-eval-question-report.md`、E2E `eval-question-flow.test.ts` 3 用例；CLI 支持 `--questionVersion`；`eval-question-sample.json` 存在 |
| B12 Bugfix 回写 | §2.4 | writeback.ts | `scoring/bugfix/writeback.ts` 实现 `writebackBugfixToStory`，checkbox 正则符合规格 |
| B13 Git 回退建议 | §2.5 | rollback.ts | `scoring/gate/rollback.ts` 实现 `suggestRollback`，message 含 `⚠️ 以下回退命令仅供参考...` |

**结论**：① 覆盖需求/plan/GAPS 完全满足。

---

### 2.2 架构与选型一致

- 目录结构：`scoring/gate/`、`scoring/trigger/`、`scoring/bugfix/` 与 plan §2.1 一致
- 依赖：消费 `hash.ts`、`parse-and-write.ts`、`coach/diagnose.ts`、`writer/types.ts`，无循环依赖
- 技术选型：YAML 配置、正则解析、JSON 存储，与 spec 一致

**结论**：② 架构与选型一致。

---

### 2.3 集成测试与 E2E 测试

| 验证项 | 实现 |
|--------|------|
| B10 eval_question 全链路 | `eval-question-flow.test.ts` 执行 parseAndWriteScore → write → coachDiagnose，3 个 E2E 用例 |
| content_hash、base_commit_hash | E2E 断言 `record.content_hash`、`record.base_commit_hash` 存在且正确 |
| version-lock 集成测试 | `version-lock.test.ts` 含「loadLatestRecordByStage + checkPreconditionHash 联动」集成用例 |
| 全量测试 | `npm test` 执行结果：**156 passed**（32 个测试文件） |

**结论**：③ 集成/E2E 测试已执行，验证通过。

---

### 2.4 模块在生产代码关键路径的导入与调用

| 模块 | 导入/调用路径 | 是否生产路径 |
|------|---------------|--------------|
| **trigger-loader** | `scripts/parse-and-write-score.ts` → `shouldWriteScore(event, triggerStage, scenario)` | ✅ 是 |
| **version-lock** | 仅 `version-lock.test.ts` | ❌ plan §5.3 明确「编排在后续 Skill 中集成」 |
| **writeback** | 仅 `writeback.test.ts` | ❌ 供 bmad-bug-assistant 等 Skill 调用，非 parse-and-write CLI |
| **rollback** | 仅 `rollback.test.ts` | ❌ 供 D 级熔断后 veto/审计流程调用 |

**裁定**：plan §5.3 写明「version-lock、trigger-loader 被 Skill/CLI 编排调用（本 Story 产出模块，编排在后续 Skill 中集成）」——version-lock、writeback、rollback 为**基础模块**，设计上由后续 Skill/workflow 编排，非本 Story CLI 范围。trigger-loader 已在本 Story 的 parse-and-write CLI 中集成。按 plan 设计，不判定为「孤岛模块」。

**结论**：④ 无孤岛模块（按 plan 设计，foundation 模块编排推迟至后续 Story 合理）。

---

### 2.5 ralph-method 追踪文件

| 要求 | 路径 | 验证结果 |
|------|------|----------|
| prd.json 或 prd.{stem}.json | `_bmad-output/implementation-artifacts/5-1-eval-foundation-modules/` | ❌ **不存在** |
| progress.txt 或 progress.{stem}.txt | 同上 | ❌ **不存在** |
| 每完成一个 US 有对应更新 | — | ❌ 无 prd/progress 无法验证 |

当前目录仅含：`5-1-eval-foundation-modules.md`、`AUDIT_Story5.1_推迟闭环_再审计_2026-03-05.md`。

**结论**：⑤ **ralph-method 追踪不完整**，未创建 prd.json、progress.txt，违反 audit-prompts §5 第 (4) 项。

---

### 2.6 audit-prompts §5 专项审查 (5)–(8)

| 项 | 要求 | 验证结果 |
|----|------|----------|
| (5) branch_id 在 call_mapping、enabled=true | `config/scoring-trigger-modes.yaml` | ✅ `scoring_write_control.enabled: true`；`call_mapping` 含 speckit_*、bmad_* 等 stage 映射 |
| (6) parseAndWriteScore 参数证据 | CLI 调用 | ✅ 传递 reportPath、stage、runId、scenario、writeMode、question_version、sourceHashFilePath 等 |
| (7) scenario=eval_question 时 question_version 必填 | validateScenarioConstraints | ✅ `scoring/writer/validate.ts` 在 scenario=eval_question 时校验 question_version 非空，缺则抛错；写入前校验，不完成错误写入 |
| (8) 评分写入失败 non_blocking、resultCode | config | ✅ `fail_policy: non_blocking` 已配置；写入失败时 validateScenarioConstraints 抛错，CLI  catch 后 process.exit(1) |

**结论**：(5)–(8) 项基本满足；item (7) 中「记 SCORE_WRITE_INPUT_INVALID」无显式常量，当前通过抛错实现「缺则不完成写入」语义。

---

## 3. 实施文件清单核对

### 3.1 新增文件（Story §4.3）

| 类型 | 路径 | 存在 |
|------|------|------|
| 实现 | scoring/gate/version-lock.ts | ✅ |
| 实现 | scoring/gate/rollback.ts | ✅ |
| 实现 | scoring/trigger/trigger-loader.ts | ✅ |
| 实现 | scoring/bugfix/writeback.ts | ✅ |
| 测试 | scoring/gate/__tests__/version-lock.test.ts | ✅ |
| 测试 | scoring/gate/__tests__/rollback.test.ts | ✅ |
| 测试 | scoring/trigger/__tests__/trigger-loader.test.ts | ✅ |
| 测试 | scoring/bugfix/__tests__/writeback.test.ts | ✅ |
| 测试 | scoring/__tests__/e2e/eval-question-flow.test.ts | ✅ |
| fixture | scoring/parsers/__tests__/fixtures/sample-eval-question-report.md | ✅ |
| 示例 | scoring/data/eval-question-sample.json | ✅ |

### 3.2 修改文件（Story §4.4）

| 文件 | 变更 | 验证 |
|------|------|------|
| scoring/writer/types.ts | content_hash JSDoc、source_hash | ✅ |
| scoring/schema/run-score-schema.json | source_hash | ✅ |
| scoring/orchestrator/parse-and-write.ts | sourceHashFilePath、source_hash 写入 | ✅ |
| scripts/parse-and-write-score.ts | --sourceHashFilePath、--event、--skipTriggerCheck、--questionVersion | ✅ |

---

## 4. 测试结果

```
npm test
Test Files  32 passed (32)
Tests       156 passed (156)
```

---

## 5. 不满足项与修改建议

| 不满足项 | 修改建议 |
|----------|----------|
| **⑤ ralph-method 追踪文件缺失** | 在 `_bmad-output/implementation-artifacts/5-1-eval-foundation-modules/` 下创建 `prd.eval-foundation-modules.json`（或 `prd.E5-S1.json`）和 `progress.eval-foundation-modules.txt`（或 `progress.E5-S1.txt`），按 tasks 的 Phase 1–5 对应 US，每完成一项更新 prd 中 passes=true、progress 中带时间戳的 story log；涉及生产代码的任务须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 各至少一行。 |

---

## 6. 结论

**结论：未通过。**

| 必达子项 | 判定 |
|----------|------|
| ① 覆盖需求/plan/GAPS | ✓ 满足 |
| ② 架构与选型一致 | ✓ 满足 |
| ③ 集成/E2E 测试已执行 | ✓ 满足（156 tests passed，含 E2E 与集成用例） |
| ④ 无孤岛模块 | ✓ 满足（trigger-loader 已集成；version-lock/writeback/rollback 按 plan 设计由后续 Skill 编排） |
| ⑤ ralph-method 追踪完整 | **❌ 不满足**（缺少 prd.json、progress.txt） |

任一项不满足则结论为未通过。当前 ⑤ 不满足，需按上述修改建议补全 ralph-method 追踪文件后重新审计。
