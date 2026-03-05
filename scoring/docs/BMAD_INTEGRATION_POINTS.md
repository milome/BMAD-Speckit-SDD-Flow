# BMAD 五层 workflows 集成点

与 architecture §7.3、Story 4.3 一致。各 stage 审计通过后触发「解析并写入」评分逻辑。

---

## 1. 集成点总览

| 集成点 | 触发时机 | 调用方式 |
|--------|----------|----------|
| **speckit-workflow** | clarify/checklist/analyze 嵌入各审计闭环；stage 完成 → 调用全链路 Skill 的「解析并写入」逻辑 | 各 speckit 阶段（specify/plan/gaps/tasks）审计通过后，按 config/scoring-trigger-modes.yaml 决定是否触发 parseAndWriteScore |
| **bmad-story-assistant** | 审计步骤调度 code-reviewer；各 stage 审计通过后触发评分解析与写入 | Create Story、Dev Story 等流程中，审计通过后按配置触发；与 speckit 类似 |
| **全链路 Skill** | 在上述流程的各 stage 审计通过后触发评分解析与写入 | bmad-code-reviewer-lifecycle（或等效）编排 parseAndWriteScore；与 config/scoring-trigger-modes.yaml、config/stage-mapping.yaml 衔接 |

---

## 2. 与 config/scoring-trigger-modes.yaml 衔接

config/scoring-trigger-modes.yaml（Story 3.3 产出）定义事件类型 → writeMode 映射：

| 事件 | 说明 | 默认 writeMode |
|------|------|----------------|
| stage_audit_complete | stage 审计完成 | single_file |
| story_status_change | Story 状态变更 | real_dev: single_file；eval_question: jsonl |
| mr_created | MR 创建 | 同上 |
| epic_pending_acceptance | Epic 待验收 | both |
| user_explicit_request | 用户显式请求 | single_file |

调用方根据 scenario（real_dev / eval_question）选择对应 writeMode，传入 parseAndWriteScore。eval_question 时须同时传入 question_version。

---

## 3. 可调用验证

**至少一个集成点可由脚本或 Cursor Task 调用并验证**：

- **scripts/accept-e3-s3.ts**（若存在）：调用 parseAndWriteScore，对 prd/arch/story 各测一次，校验 scoring/data 产出。
- **直接调用**：`import { parseAndWriteScore } from './scoring/orchestrator'`；传入 content、stage、runId、scenario、writeMode；eval_question 时传入 question_version。
