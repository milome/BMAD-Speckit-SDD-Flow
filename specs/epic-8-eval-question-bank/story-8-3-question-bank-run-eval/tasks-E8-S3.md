# Tasks E8-S3：题库 run 命令与 eval_question 集成

**Epic**：8 eval-question-bank  
**Story**：8.3 question-bank-run-eval  
**前置**：spec-E8-S3.md、plan-E8-S3.md、IMPLEMENTATION_GAPS-E8-S3.md 已通过审计

---

## 1. 任务 ↔ 需求追溯

| 任务 ID | 需求 | 验收对应 |
|---------|------|----------|
| T1 | run 命令与参数解析 | AC-1, AC-4 |
| T2 | 报告来源与 parseAndWriteScore 输入 | AC-1 |
| T3 | runId、scenario、question_version 注入与校验 | AC-1, AC-2, AC-3 |
| T4 | 失败路径、版本隔离测试 | AC-4, AC-5 |

---

## 2. 任务明细

### T1 run 命令与参数解析（AC: #1, #4）

- [ ] **T1.1** 在 eval-questions-cli.ts 中实现 run 子命令入口
- [ ] **T1.2** 参数校验：--id、--version 必填；version ∈ {v1, v2}
- [ ] **T1.3** 调用 loadManifest(versionDir)，按 id 查找题目；题目不存在时输出「题目 {id} 在版本 {version} 中不存在」并退出

**验收**：run --id q001 --version v1 可解析；缺 id/version 或非法 version 时输出用法并退出；题目不存在时明确错误。

---

### T2 报告来源与 parseAndWriteScore 输入（AC: #1）

- [ ] **T2.1** 支持 --reportPath；未传时使用题目 path 作为报告文件
- [ ] **T2.2** 校验报告文件存在；不存在时输出明确错误
- [ ] **T2.3** 解析失败时（parseAndWriteScore 抛错）捕获并输出「题目解析失败：<原因>」

**验收**：有 --reportPath 时使用指定路径；无时使用题目 path；解析失败输出明确错误。

---

### T3 runId、scenario、question_version（AC: #1, #2, #3）

- [ ] **T3.1** 生成 runId：`eval-q{id}-{version}-{timestamp}`（timestamp 毫秒）
- [ ] **T3.2** 调用 parseAndWriteScore，传入 reportPath、stage、runId、scenario=eval_question、question_version、writeMode
- [ ] **T3.3** 写入前校验：scenario=eval_question 时 question_version 必填，缺失则 throw 明确错误
- [ ] **T3.4** 验证写入记录含 scenario=eval_question、question_version、run_id 符合约定

**验收**：runId 符合格式；写入记录正确；question_version 缺失时 throw。

---

### T4 失败路径与版本隔离测试（AC: #4, #5）

- [ ] **T4.1** 单元测试：runId 生成格式、question_version 缺失 throw
- [ ] **T4.2** 集成测试：run --id q001 --version v1 端到端；题目不存在、解析失败时明确错误；v1/v2 分别 run 后 run_id、question_version 可区分

**测试文件**：scoring/eval-questions/__tests__/run-command.test.ts 或扩展现有 cli-integration.test.ts

**验收**：npx vitest run scoring/eval-questions 全部通过；npm test 通过。

---

## 3. 验收命令

```bash
npx ts-node scripts/eval-questions-cli.ts run --id q001 --version v1
npx vitest run scoring/eval-questions
```

---
