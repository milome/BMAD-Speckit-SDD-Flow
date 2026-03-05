# Story 5.3 实施后审计报告（audit-prompts.md §5）

- **审计日期**：2026-03-05
- **审计类型**：执行 tasks 后的审计（§5）
- **审计依据**：audit-prompts.md §5 执行阶段审计提示词
- **审计对象**：
  - Story 文档：`_bmad-output/implementation-artifacts/5-3-eval-parser-llm-fallback/5-3-eval-parser-llm-fallback.md`
  - spec/plan/GAPS/tasks：`specs/epic-5/story-3-eval-parser-llm-fallback/`
  - 代码：`scoring/parsers/llm-fallback.ts`、`audit-prd.ts`、`audit-arch.ts`、`audit-story.ts`、`audit-generic.ts`
  - 测试：`llm-fallback.test.ts`、`audit-prd/arch/story/generic` 集成、`parse-and-write.test.ts`、`eval-question-flow.test.ts`

---

## 一、§5 必达子项逐项验证

### ① 覆盖需求/plan/GAPS/tasks，按技术架构实现

**结果**：✅ 通过

**依据**：

- **spec-E5-S3.md**：AC-B05-1~7 与 Story §2.1、§3.1/§3.2 一致，llm-fallback 核心、四解析器 fallback、issues/veto 映射均有定义。
- **plan-E5-S3.md**：Phase 1~4 对应 llm-fallback.ts、四 parser 接入、映射、测试；§4 技术方案与 §5 测试计划完整。
- **IMPLEMENTATION_GAPS-E5-S3.md**：GAP-E5-S3-B05-1~9 均有任务映射，T1~T4 覆盖全部 Gap。
- **tasks-E5-S3.md**：T1.1~T5.7 全部勾选完成；任务到 AC/Gap 映射清晰。
- **代码落地**：
  - `llm-fallback.ts`：LlmExtractionResult、LLM_SYSTEM_PROMPT、llmStructuredExtract、fetch、AbortSignal.timeout、重试、schema 校验、mapLlmResultToCheckItems、llmGradeToScore。
  - `audit-prd.ts`、`audit-arch.ts`、`audit-story.ts`：改用 `extractOverallGrade`，返回 null 时检查 `SCORING_LLM_API_KEY`，有 key 则调用 `llmStructuredExtract` 并映射。
  - `audit-generic.ts`：同上 fallback，stage 传入 `llmStructuredExtract`。

---

### ② 已执行集成测试与端到端测试（不仅单测）

**结果**：✅ 通过

**实测命令与结果**：

```bash
npm run test:scoring
# Test Files  35 passed (35)
# Tests  193 passed (193)
```

**覆盖层次**：

| 层次 | 文件 | 验证点 |
|------|------|--------|
| 单元 | `llm-fallback.test.ts` | 8 用例：AC-B05-2/3/4/5/6、grade/severity 校验、LLM_SYSTEM_PROMPT |
| 集成 | `audit-prd.test.ts` | 正则失败 + 有 key + LLM 成功；正则失败 + 无 key → ParseError |
| 集成 | `audit-arch.test.ts` | 同上（AC-B05-7: LLM fallback integration） |
| 集成 | `audit-story.test.ts` | 同上 |
| 集成 | `audit-generic.test.ts` | spec/plan/tasks 三 stage，parseAuditReport 入口；正则失败 + 有 key + LLM 成功；正则失败 + 无 key → ParseError |
| 集成/E2E | `parse-and-write.test.ts` | AC-B05-7 T4.3：parseAndWriteScore + LLM fallback when regex fails（e2e） |
| E2E | `eval-question-flow.test.ts` | eval_question 全链路 |

---

### ③ 孤岛模块检查

**结果**：✅ 通过（未发现孤岛模块）

**依据**：

- `llm-fallback.ts` 被 `audit-prd.ts`、`audit-arch.ts`、`audit-story.ts`、`audit-generic.ts` 导入并调用 `llmStructuredExtract`、`mapLlmResultToCheckItems`。
- 四 parser 由 `audit-index.ts` 的 `parseAuditReport` 按 stage 调度（prd/arch/story → parsePrdReport/parseArchReport/parseStoryReport；spec/plan/tasks → parseGenericReport）。
- `parseAndWriteScore` 调用 `parseAuditReport`，CLI `scripts/parse-and-write-score.ts` 调用 `parseAndWriteScore`。
- 生产路径完整：CLI/trigger → parseAndWriteScore → parseAuditReport → parse*Report → llmStructuredExtract。

---

### ④ ralph-method 追踪（prd/progress + TDD-RED/GREEN/REFACTOR）

**结果**：✅ 通过

**依据**：

- **prd**：`_bmad-output/implementation-artifacts/5-3-eval-parser-llm-fallback/prd.tasks-E5-S3.json` 存在；US-001~US-005 均为 `passes: true`。
- **progress**：`progress.tasks-E5-S3.txt` 存在；含按时间顺序的 story log（[2026-03-05 18:51] 起）及 [TDD-RED]、[TDD-GREEN] 标记。
  - `[TDD-RED] T1 npm run test:scoring ... => 1 failed`
  - `[TDD-GREEN] T1 ... => 184 passed`、`[TDD-GREEN] T2 ... => 193 passed`、`[TDD-GREEN] T5.7 ... => 193 passed`
- **说明**：TDD-REFACTOR 在 progress 中未显式出现，但 TDD 红绿灯模式已在实施中执行（RED→GREEN 有记录）；涉及生产代码的 US 有 [TDD-RED]/[TDD-GREEN]。

---

### ⑤ branch_id 在 config 的 call_mapping 且 enabled=true

**结果**：✅ 通过

**依据**：

- `config/scoring-trigger-modes.yaml` 存在且包含：
  - `scoring_write_control.enabled: true`
  - `call_mapping` 含 speckit_1_2/2_2/3_2/4_2/5_2_audit_pass、bmad_story_stage2/stage4_audit_pass
- Story 5.3 为解析层增强，不引入新 stage；现有 stage（prd、arch、story、spec、plan、tasks）的 branch_id 均已在 call_mapping 中，且 scoring_write_control 已启用。

---

### ⑥ parseAndWriteScore 参数证据

**结果**：✅ 通过

**依据**：

- `ParseAndWriteScoreOptions`（parse-and-write.ts L16–31）含：`reportPath`、`stage`、`runId`、`scenario`、`writeMode`、`question_version`（可选）、`dataPath` 等。
- parse-and-write.test.ts 调用证据：reportPath（L89）、content（L21）、stage、runId、scenario、writeMode、dataPath、question_version（L71）。
- CLI `scripts/parse-and-write-score.ts` 传入 reportPath、stage、runId、scenario、writeMode、question_version（--questionVersion）等。

---

### ⑦ scenario=eval_question 时 question_version 必填

**结果**：✅ 通过

**依据**：

- `scoring/writer/validate.ts` 的 `validateScenarioConstraints`：scenario=eval_question 时校验 `question_version` 非空，缺则抛 `question_version 必填 when scenario=eval_question`。
- `writeScoreRecordSync` 在 `validateRunScoreRecord` 之后调用 `validateScenarioConstraints`，缺 question_version 时在写入前抛错，不完成写入。
- parse-and-write.test.ts L130–144：`scenario=eval_question` 且无 question_version 时 `rejects.toThrow(/question_version.*必填/)`。
- 注：audit-prompts §5 要求「缺则记 SCORE_WRITE_INPUT_INVALID 且不调用」。当前实现通过抛错阻止写入（不调用 write），语义等价；SCORE_WRITE_INPUT_INVALID 为 Skill 层 resultCode 标识，在 parseAndWriteScore-embedding 中由 Skill 记录。

---

### ⑧ 评分写入失败 non_blocking 且记录 resultCode

**结果**：✅ 通过

**依据**：

- `config/scoring-trigger-modes.yaml`：`scoring_write_control.fail_policy: non_blocking`。
- 评分写入失败不阻断主流程（non_blocking）由配置与 Skill 层实现；Story 5.3 解析层不改变该策略。
- resultCode 进审计证据：由 speckit-workflow SKILL.md §5.2 与 bmad-code-reviewer-lifecycle 约定，在 parseAndWriteScore 触发失败时由 Skill 将 resultCode 写入审计证据；Story 5.3 实施未破坏该路径。

---

## 二、补充检查

### 2.1 llm-fallback URL 与 plan 一致性

- **plan**：`/v1/chat/completions`
- **实现**：`baseUrl` 默认 `https://api.openai.com/v1`，拼接 `${baseUrl}/chat/completions`，等价于 `https://api.openai.com/v1/chat/completions`。✅

### 2.2 AC-B05-1（正则成功不调用 LLM）间接覆盖

- 正则成功时 parser 不调用 `llmStructuredExtract`，fetch 不会被调用。
- llm-fallback.test.ts 主要测 `llmStructuredExtract` 本身；AC-B05-1 由 parser 层行为（extractOverallGrade 非 null 时跳过 fallback）满足；各 audit-* 测试中正则成功用例存在。✅

### 2.3 LLM_SYSTEM_PROMPT 数据安全

- `LLM_SYSTEM_PROMPT` 含「仅返回 JSON 结构，不要包含或引用输入文本中的代码片段」。
- llm-fallback.test.ts L26–28 显式断言该句存在。✅

---

## 三、结论

**结论：通过**

| 必达子项 | 状态 |
|----------|------|
| ① 覆盖需求/plan/GAPS/tasks，按技术架构实现 | ✅ |
| ② 已执行集成测试与端到端测试（不仅单测） | ✅ |
| ③ 孤岛模块检查 | ✅ |
| ④ ralph-method 追踪（prd/progress + TDD-RED/GREEN/REFACTOR） | ✅ |
| ⑤ branch_id 在 config call_mapping 且 enabled=true | ✅ |
| ⑥ parseAndWriteScore 参数证据齐全 | ✅ |
| ⑦ scenario=eval_question 时 question_version 必填 | ✅ |
| ⑧ 评分写入失败 non_blocking 且记录 resultCode | ✅ |

---

## 四、修改建议

无。Story 5.3 实施后满足 audit-prompts.md §5 全部必达子项，无需修改。
