# IMPLEMENTATION_GAPS E8-S3：题库 run 命令与 eval_question 集成

**Epic**：8 eval-question-bank  
**Story**：8.3 question-bank-run-eval  
**对照基准**：spec-E8-S3.md、plan-E8-S3.md、8-3-question-bank-run-eval.md

---

## 1. Gaps 清单

| 需求章节 | Gap ID | 需求要点 | 当前状态 | 缺失说明 |
|---------|--------|----------|----------|-----------|
| Story §5 T1 | GAP-8.3.1 | run 命令入口、--id --version 解析 | 未实现 | eval-questions-cli 无 run 子命令 |
| Story §5 T1.2 | GAP-8.3.2 | 参数校验：id、version 必填；version 对应已存在目录 | 未实现 | 无 run 即无校验 |
| Story §5 T1.3 | GAP-8.3.3 | loadManifest、按 id 找 path；题目不存在时明确错误 | 未实现 | 无 run 逻辑 |
| Story §5 T2 | GAP-8.3.4 | 读取题目、调用评审/报告、产出报告路径 | 部分 | 报告来源采用题目 path 或 --reportPath；评审由 Command 编排 |
| Story §5 T3 | GAP-8.3.5 | runId 生成、parseAndWriteScore 调用、question_version 校验 | 未实现 | 无 run 逻辑 |
| Story §5 T4 | GAP-8.3.6 | 失败路径、版本隔离测试 | 未实现 | 无测试 |

---

## 2. Gaps → 任务映射

| Gap ID | 对应任务 |
|--------|----------|
| GAP-8.3.1 | T1.1 |
| GAP-8.3.2 | T1.2 |
| GAP-8.3.3 | T1.3 |
| GAP-8.3.4 | T2.1–T2.3 |
| GAP-8.3.5 | T3.1–T3.4 |
| GAP-8.3.6 | T4.1–T4.2 |

---

## 3. 当前实现快照

| 组件 | 路径 | 状态 |
|------|------|------|
| eval-questions-cli | scripts/eval-questions-cli.ts | 有 list/add，无 run |
| loadManifest | scoring/eval-questions/manifest-loader.ts | 已存在（Story 8.1） |
| parseAndWriteScore | scoring/orchestrator/parse-and-write.ts | 已存在 |
| run 测试 | scoring/eval-questions/__tests__/ | 无 run 相关用例 |

---
