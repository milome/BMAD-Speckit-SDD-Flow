# Story 5.1：eval-foundation-modules

Status: ready-for-dev

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.1  
**Slug**：eval-foundation-modules  
**包含 GAP**：B02（版本锁定）、B04（触发加载器）、B10（eval_question E2E）、B12（Bugfix 回写）、B13（回退建议）

<!-- Note: 可执行 validate-create-story 进行质量检查后再进入 dev-story。 -->

## Story

As a Scoring 系统的开发者，  
I want 跨阶段版本锁定校验、程序化触发控制、eval_question 端到端验证、Bugfix 回写、Git 回退建议，  
so that Scoring 系统具备完整的流转控制和闭环能力。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **B02 版本锁定校验**：`checkPreconditionHash`、`loadLatestRecordByStage`，specify→plan 流转时比对 `source_hash`
2. **B04 触发加载器**：`scoring-trigger-modes.yaml` 程序化加载，`shouldWriteScore` 判断是否写入评分
3. **B10 eval_question E2E**：parse → write → coach diagnose 全链路验证，fixture + 3 个 E2E 测试
4. **B12 Bugfix 回写**：`writebackBugfixToStory`，将 BUGFIX §7 已完成任务回写到 progress.txt
5. **B13 Git 回退建议**：`suggestRollback`，D 级熔断后输出回退命令列表（不自动执行）

### 1.2 本 Story 不包含

| 功能 | 负责 Story | 说明 |
|------|-----------|------|
| spec/plan/tasks 三阶段评分规则 | Story 5.2 | B03 评分规则 YAML 与 audit-generic.ts |
| 四维加权评分 | Story 5.2 | B11 dimension_scores 解析 |
| LLM 结构化提取 fallback | Story 5.3 | B05 依赖 B03 的 audit-generic.ts |
| 能力短板聚类分析 | Story 5.4 | B06 clusterWeaknesses |
| SFT 提取、Prompt 优化、规则建议 | Story 5.5 | B07/B08/B09 |

---

## 2. Acceptance Criteria（验收标准）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-B02-1 | specify 阶段审计通过且 `source_hash` 已写入记录；plan 阶段启动时调用 `checkPreconditionHash`；比对 spec.md 当前 hash 与记录中的 `source_hash`，匹配则 proceed，不匹配则 block | 单测：hash 匹配 → proceed；hash 不匹配 → block |
| AC-B02-2 | 上一阶段无记录时返回 warn_and_proceed | 单测：loadLatestRecordByStage 无匹配 → warn_and_proceed |
| AC-B04-1 | `scoring-trigger-modes.yaml` 中 `enabled=true` 且 stage 已注册时，`shouldWriteScore(event, stage, scenario)` 返回 `write=true` 和正确的 `writeMode` | 单测：enabled + 注册 stage → write=true |
| AC-B04-2 | `enabled=false` 或 stage 未注册时返回 `write=false` | 单测：enabled=false → write=false；未注册 stage → write=false |
| AC-B10-1 | eval_question 场景的审计报告执行 parse → write → coach diagnose 全链路；记录正确写入且 coach 诊断成功 | E2E 测试：eval-question-flow.test.ts |
| AC-B10-2 | eval_question 记录的 `content_hash` 和 `base_commit_hash` 正确填充 | E2E 测试断言 |
| AC-B12-1 | BUGFIX 文档 §7 已完成任务列表调用 `writebackBugfixToStory`；progress.txt 追加格式化行（时间戳 + branchId + storyId + 摘要） | 单测：writeback.test.ts |
| AC-B12-2 | 支持 `[x]`、`[X]`、`* [x]`、缩进等 Markdown checkbox 变体 | 单测：checkbox 变体解析 |
| AC-B13-1 | D 级熔断触发时 `suggestRollback` 返回包含告警前缀的回退建议和命令列表 | 单测：message 含 ⚠️，commands 正确 |
| AC-B13-2 | 不自动执行任何 git 操作 | 单测：仅返回建议，无副作用 |

---

## 3. Tasks / Subtasks

### Task 1：B02 版本锁定（AC: AC-B02-1, AC-B02-2）

- [ ] 1.1 修改 `scoring/writer/types.ts`：更新 `content_hash` JSDoc；新增 `source_hash?: string`
- [ ] 1.2 修改 `scoring/schema/run-score-schema.json`：新增 `source_hash` 属性
- [ ] 1.3 修改 `scoring/orchestrator/parse-and-write.ts`：`ParseAndWriteScoreOptions` 新增 `sourceHashFilePath?: string`；非空时计算 hash 写入 `source_hash`
- [ ] 1.4 修改 `scripts/parse-and-write-score.ts`：新增 `--sourceHashFilePath` CLI 参数
- [ ] 1.5 新增 `scoring/gate/version-lock.ts`：实现 `checkPreconditionHash`、`loadLatestRecordByStage`
- [ ] 1.6 新增 `scoring/gate/__tests__/version-lock.test.ts`：7 个测试用例

### Task 2：B04 触发加载器（AC: AC-B04-1, AC-B04-2）

- [ ] 2.1 新增 `scoring/trigger/trigger-loader.ts`：实现 `loadTriggerConfig`、`shouldWriteScore`、`resetTriggerConfigCache`
- [ ] 2.2 修改 `scripts/parse-and-write-score.ts`：新增 `--event` 参数；调用 `shouldWriteScore` 前置检查；新增 `--skipTriggerCheck` 参数
- [ ] 2.3 新增 `scoring/trigger/__tests__/trigger-loader.test.ts`：7 个测试用例

### Task 3：B10 eval_question E2E（AC: AC-B10-1, AC-B10-2）

- [ ] 3.1 新增 fixture `scoring/parsers/__tests__/fixtures/sample-eval-question-report.md`
- [ ] 3.2 新增 `scoring/__tests__/e2e/eval-question-flow.test.ts`：3 个 E2E 测试
- [ ] 3.3 修改 `scripts/parse-and-write-score.ts`：新增 `--questionVersion` 参数
- [ ] 3.4 新增 `scoring/data/eval-question-sample.json` 示例记录

### Task 4：B12 Bugfix 回写（AC: AC-B12-1, AC-B12-2）

- [ ] 4.1 新增 `scoring/bugfix/writeback.ts`：实现 `writebackBugfixToStory`，支持 checkbox 变体正则 `/^\s*[-*+]?\s*\d*\.?\s*\[(x|X)\]\s+(.+)$/`
- [ ] 4.2 新增 `scoring/bugfix/__tests__/writeback.test.ts`：6 个测试用例

### Task 5：B13 Git 回退建议（AC: AC-B13-1, AC-B13-2）

- [ ] 5.1 新增 `scoring/gate/rollback.ts`：实现 `suggestRollback`，`message` 包含 `⚠️ 以下回退命令仅供参考，请确认后手动执行：`
- [ ] 5.2 新增 `scoring/gate/__tests__/rollback.test.ts`：4 个测试用例

---

## 4. Dev Notes

### 4.1 技术约束

- **B02**：`loadLatestRecordByStage` 扫描 `scoring/data/` 下所有 `*.json` 文件（排除 scores.jsonl），按 `record.timestamp` 降序取最新；`checkPreconditionHash` 校验异常 → `warn_and_proceed`，hash 不匹配 → `block`
- **B04**：首次读取 YAML 后缓存到 module-level；`resetTriggerConfigCache()` 供测试重置；config 不存在 → 抛异常
- **B10**：全链路使用现有 `parseAndWriteScore`、`coachDiagnose`，仅新增 eval_question fixture 和 E2E 测试
- **B12**：progress.txt 不存在则创建；存在则追加；BUGFIX 无 §7 标题 → 抛 ParseError
- **B13**：`lastStableCommit` 存在时 `commands = ['git stash', 'git reset --hard <commit>']`；不存在时 `commands = ['git stash']`

### 4.2 实现参考

| 项目 | 路径 |
|------|------|
| 需求与实现方案 | `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1 |
| Epic/Story 定义 | `_bmad-output/planning-artifacts/dev/epics.md` §3 Story 5.1 |
| Hash 工具 | `scoring/utils/hash.ts` 的 `computeContentHash` |
| 现有 parse-and-write | `scoring/orchestrator/parse-and-write.ts` |
| scoring-trigger 配置 | `config/scoring-trigger-modes.yaml` |
| RunScoreRecord 类型 | `scoring/writer/types.ts` |

### 4.3 新增文件一览（12 个）

| 类型 | 路径 |
|------|------|
| 实现 | `scoring/gate/version-lock.ts` |
| 实现 | `scoring/gate/rollback.ts` |
| 实现 | `scoring/trigger/trigger-loader.ts` |
| 实现 | `scoring/bugfix/writeback.ts` |
| 测试 | `scoring/gate/__tests__/version-lock.test.ts` |
| 测试 | `scoring/gate/__tests__/rollback.test.ts` |
| 测试 | `scoring/trigger/__tests__/trigger-loader.test.ts` |
| 测试 | `scoring/bugfix/__tests__/writeback.test.ts` |
| 测试 | `scoring/__tests__/e2e/eval-question-flow.test.ts` |
| fixture | `scoring/parsers/__tests__/fixtures/sample-eval-question-report.md` |
| 示例 | `scoring/data/eval-question-sample.json` |

### 4.4 修改文件一览（4 个）

| 文件 | 变更 |
|------|------|
| `scoring/writer/types.ts` | `content_hash` JSDoc 更新；`source_hash` 新增 |
| `scoring/schema/run-score-schema.json` | `source_hash` 属性新增 |
| `scoring/orchestrator/parse-and-write.ts` | `sourceHashFilePath` 参数及 `source_hash` 写入逻辑 |
| `scripts/parse-and-write-score.ts` | `--sourceHashFilePath`、`--event`、`--skipTriggerCheck`、`--questionVersion` |

### 4.5 测试用例总数

- B02：7 个（含集成测试）
- B04：7 个
- B10：3 个 E2E
- B12：6 个
- B13：4 个  
**合计**：27 个

---

## 5. Project Structure Notes

- 遵循现有 `scoring/` 目录结构：`gate/`、`trigger/`、`bugfix/` 为新增子目录
- `gate/` 与 `veto/` 职责区分：gate 负责流转门控（版本锁定、回退建议），veto 负责评分扣分与一票否决
- CLI 参数扩展在 `scripts/parse-and-write-score.ts` 中，保持与现有 `--stage`、`--runId`、`--scenario` 一致风格

---

## 6. References

- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B02] 版本锁定实现方案
- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B04] 触发加载器实现方案
- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B10] eval_question E2E 实现方案
- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B12] Bugfix 回写实现方案
- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B13] Git 回退建议实现方案
- [Source: _bmad-output/planning-artifacts/dev/epics.md#Story-5.1] Epic 5 Story 5.1 完整定义
- [Source: scoring/utils/hash.ts] computeContentHash 函数

---

## 7. Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- 2026-03-05: 完成 B02/B04/B10/B12/B13 全部实施；specs/epic-5/story-1-eval-foundation-modules 产出 spec/plan/gaps/tasks；27 个新测试全部通过；npm test 156 passed

### File List
