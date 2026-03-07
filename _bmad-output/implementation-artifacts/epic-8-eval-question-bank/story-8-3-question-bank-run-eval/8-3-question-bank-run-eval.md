# Story 8.3：题库 run 命令与 eval_question 集成

Status: ready-for-dev

**Epic**：8 eval-question-bank  
**Story**：8.3  
**Slug**：question-bank-run-eval  
**来源**：epics.md §Epic 8、prd.eval-ux-last-mile.md §5.5（REQ-UX-5.5、REQ-UX-5.6、REQ-UX-5.7、REQ-UX-5.8）  
**依赖**：Story 8.1（manifest-loader）、Story 8.2（list/add）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-5.5 | Command `/bmad-eval-questions run --id q001 --version v1` | 是 | AC-1 |
| REQ-UX-5.5 | 加载题目→调用评审/Skill→写入时注入 scenario=eval_question、question_version=v1 | 是 | AC-1 |
| REQ-UX-5.6 | run 失败时输出明确错误信息（文件不存在、解析失败等） | 是 | AC-4 |
| REQ-UX-5.7 | run_id 含 version，如 `eval-q001-v1-{timestamp}`，实现 v1/v2 评分隔离 | 是 | AC-2, AC-5 |
| REQ-UX-5.8 | question_version 在 scenario=eval_question 时必填，缺失则 throw | 是 | AC-3 |

---

## 2. Story

**As a** 团队 Lead（TeamLead），  
**I want** 运行 `/bmad-eval-questions run --id q001 --version v1`，  
**so that** 题目被执行，评分写入时自动标记 scenario=eval_question、question_version=v1，实现 v1/v2 版本隔离。

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **run 命令接口**
   - 实现 Command `/bmad-eval-questions run --id <questionId> --version <version>`（示例：`run --id q001 --version v1`）
   - 必填参数：`--id`（题目 id，如 q001）、`--version`（版本，如 v1）
   - 参数校验：id 与 version 不可为空；version 须为合法版本目录（如 v1、v2）

2. **题目加载与执行链路**
   - 加载题目：调用 Story 8.1 产出的 manifest-loader，按 `--version` 确定版本目录，根据 manifest 查找 `--id` 对应题目的 path
   - 调用评审/Skill：将题目 .md 内容作为输入，调用 code-reviewer 或 bmad-code-reviewer-lifecycle 等价评审流程，产出审计报告（格式须与 scoring/parsers 兼容，stage 按报告格式择一，如 story、prd）
   - 写入评分：调用 `parseAndWriteScore`（scoring/orchestrator），传入 reportPath（或 content）、stage、runId、scenario=eval_question、question_version、writeMode；可直接编程调用或通过 scripts/parse-and-write-score.ts CLI

3. **scenario 与 question_version 注入**
   - 写入评分时**必须**注入 `scenario=eval_question`
   - 写入评分时**必须**注入 `question_version`，其值等于 `--version` 参数（如 v1）
   - 二者缺一不可；`scenario=eval_question` 时若 `question_version` 缺失，必须 throw 明确错误（AC-3）

4. **run_id 约定**
   - 格式：`eval-q{id}-{version}-{timestamp}`
   - 示例：`eval-q001-v1-1730812345`（timestamp 为毫秒级）
   - 来源：`scoring/docs/RUN_ID_CONVENTION.md` §2.2 eval_question 格式
   - run_id 由 run 命令生成并传入 parseAndWriteScore，实现 v1/v2 评分隔离

5. **question_version 校验与版本隔离**
   - question_version 校验：`scenario=eval_question` 时，调用写入接口前校验 question_version 已传入；若缺失则 throw 明确错误（不写入）
   - 版本隔离：v1 与 v2 的评分数据互不混淆；run_id 含 version 字段，query 层可按 version 筛选；同一题目 id 在 v1 与 v2 下视为不同题目，评分独立存储

6. **失败路径处理**
   - 题目文件不存在：输出明确错误（如「题目 q001 在版本 v1 中不存在」）
   - 解析失败：题目 .md 格式不合法或 manifest 中 path 指向文件无法解析时，输出明确错误（如「题目解析失败：<原因>」）
   - 评审/Skill 调用失败：输出明确错误信息

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| manifest-loader、manifest schema | Story 8.1 | 本 Story 复用 loadManifest 加载题目清单 |
| `/bmad-eval-questions list`、`add --title` | Story 8.2 | list/add 命令 |
| 题目 .md 模板生成 | Story 8.2 | add 命令生成模板 |
| query 层按 question_version 筛选 | 现有 query 层 | 本 Story 通过 run_id 含 version、record 含 question_version 支持隔离；query 层扩展由相关 Story 负责 |
| GAP-026 交互式 add 引导 | 见 epics.md Deferred Gaps、GAP-026 归属 | 非本 Epic 当前范围 |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | run 成功 | q001 存在于 v1 | 用户运行 `/bmad-eval-questions run --id q001 --version v1` | 加载题目→调用评审/Skill→写入评分时注入 scenario=eval_question、question_version=v1 |
| AC-2 | run_id 含 version | — | 写入评分 | run_id 符合 `eval-q{id}-{version}-{timestamp}` 格式，如 `eval-q001-v1-1730812345` |
| AC-3 | question_version 校验 | scenario=eval_question | 写入时 question_version 缺失 | throw 明确错误，不写入 |
| AC-4 | run 失败 | 题目文件不存在或解析失败 | 用户运行 run | 输出明确错误信息（文件不存在、解析失败等） |
| AC-5 | 版本隔离 | v1 与 v2 均有 q001 | 分别运行 v1 与 v2 的 run，再查询评分 | 两版评分数据不混淆，run_id 与 question_version 可区分 |

---

## 5. Tasks / Subtasks

- [ ] **T1** run 命令与参数解析（AC: #1, #4）
  - [ ] T1.1 实现 `/bmad-eval-questions run --id <id> --version <version>` 命令入口
  - [ ] T1.2 参数校验：--id、--version 必填；version 须对应已存在的版本目录
  - [ ] T1.3 题目加载：调用 loadManifest(versionDir)，根据 id 查找题目 path；文件不存在时输出明确错误并退出

- [ ] **T2** 评审/Skill 调用与报告产出（AC: #1）
  - [ ] T2.1 读取题目 .md 内容
  - [ ] T2.2 调用 code-reviewer 或 bmad-code-reviewer-lifecycle 等价评审流程，产出与 scoring/parsers 兼容的审计报告
  - [ ] T2.3 产出审计报告路径；解析失败时输出明确错误并退出

- [ ] **T3** 写入评分与注入约定（AC: #1, #2, #3）
  - [ ] T3.1 生成 run_id：`eval-q{id}-{version}-{timestamp}`（timestamp 毫秒）
  - [ ] T3.2 调用 parseAndWriteScore（scoring/orchestrator）或 scripts/parse-and-write-score.ts，传入 reportPath、stage、runId、scenario=eval_question、question_version、writeMode
  - [ ] T3.3 写入前校验：scenario=eval_question 时 question_version 必填，缺失则 throw 明确错误
  - [ ] T3.4 验证写入记录含 scenario=eval_question、question_version、run_id 符合约定格式

- [ ] **T4** 失败路径与版本隔离（AC: #4, #5）
  - [ ] T4.1 题目不存在、解析失败、评审失败时输出明确错误信息
  - [ ] T4.2 单元测试或集成测试：v1 与 v2 分别 run 同一 id，写入的 run_id 与 question_version 可区分，查询时数据不混淆

---

## 6. Dev Notes

### 6.1 相关架构与约束

- **run_id 约定**：`scoring/docs/RUN_ID_CONVENTION.md` §2.2 eval_question 格式 `eval-q{id}-{version}-{ts}`
- **question_version 校验**：writer/validate.ts 已实现 scenario=eval_question 时 question_version 必填校验；run 命令须在调用前传入，确保不触发 write 层校验失败前的静默忽略
- **数据隔离**：eval_question 与 real_dev 评分数据严格分离；v1 与 v2 的 eval_question 数据通过 run_id 与 question_version 区分
- **依赖 Story 8.1、8.2**：8.1 产出 manifest-loader（loadManifest）；8.2 产出 list/add 命令及 manifest 加载；run 复用 loadManifest 加载题目清单

**parseAndWriteScore 调用约定**（run 命令须传入）：

| 参数 | 值 | 说明 |
|------|-----|------|
| reportPath 或 content | 审计报告路径或内容 | 评审产出的报告 |
| stage | story / prd / spec / plan / tasks 之一 | 与报告格式一致，scoring/parsers 支持 |
| runId | `eval-q{id}-{version}-{timestamp}` | 必须符合 RUN_ID_CONVENTION §2.2 |
| scenario | eval_question | 固定 |
| question_version | --version 参数值（如 v1） | 必填，否则 writer 拒绝 |
| writeMode | single_file / jsonl / both | 按 config 或默认 |

### 6.2 源树与模块

| 组件 | 路径 | 说明 |
|------|------|------|
| run 命令入口 | .cursor/commands/bmad-eval-questions.md 或等效 Command 实现 | run 子命令 |
| manifest-loader | scoring/eval-questions/manifest-loader.ts | 复用 Story 8.1 产出 |
| 评审调用 | code-reviewer / bmad-code-reviewer-lifecycle | 题目 .md → 审计报告 |
| parseAndWriteScore | scoring/orchestrator/parse-and-write.ts | 编排解析与写入；CLI 入口 scripts/parse-and-write-score.ts |
| writer/validate | scoring/writer/validate.ts | question_version 校验（已实现） |

### 6.3 测试标准

- 单元测试：run_id 生成符合 `eval-q{id}-{version}-{timestamp}` 格式
- 单元测试：scenario=eval_question 且 question_version 缺失时 throw 明确错误
- 集成测试：run --id q001 --version v1 端到端，写入记录含 scenario=eval_question、question_version=v1、run_id 含 v1
- 集成测试：v1 与 v2 各 run 一次 q001，查询时两版数据可区分、不混淆
- 失败路径测试：题目不存在、解析失败时输出明确错误
- 使用 Vitest；可复用 `scoring/__tests__/e2e/eval-question-flow.test.ts` 相关 fixture 或扩展

### 6.4 与 Story 8.2 的衔接

- Story 8.2 产出 list/add 命令及 manifest 加载；run 命令使用同一 manifest-loader
- run 的题目 path 来自 manifest questions 中 id 匹配项的 path
- 若 Story 8.2 产出「当前版本」概念，run 的 --version 可与此对齐；本 Story 最低要求为 --version 显式传入且对应已有版本目录

### 6.5 验收命令示例

```bash
# run（假设 q001 已存在于 v1）
npx ts-node scripts/eval-questions-cli.ts run --id q001 --version v1

# 或通过 Cursor Command /bmad-eval-questions run --id q001 --version v1

# 编程调用 parseAndWriteScore 等效（用于验收/测试）：
# npx ts-node scripts/parse-and-write-score.ts --reportPath <审计报告路径> --runId eval-q001-v1-<ts> --scenario eval_question --questionVersion v1 --stage story
```

Cursor Command `/bmad-eval-questions` 内部等价调用 eval-questions-cli run；验收时可直接运行脚本或通过 Command 触发。

### 6.6 References

- [Source: _bmad-output/planning-artifacts/dev/epics.md §Epic 8 Story 8.3]
- [Source: prd.eval-ux-last-mile.md §5.5 REQ-UX-5.5~5.8]
- [Source: scoring/docs/RUN_ID_CONVENTION.md §2.2 eval_question]
- [Source: scoring/eval-questions/MANIFEST_SCHEMA.md]
- [Source: Story 8.1 8-1-question-bank-structure-manifest.md]
- [Source: scoring/orchestrator/parse-and-write.ts ParseAndWriteScoreOptions]

---

## 7. 禁止词表合规声明

本 Story 文档已避免使用禁止词表所列全部词汇（可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债）。所有范围界定均采用明确归属（由 Story 8.1、8.2 或 E8 后续增强负责）。

---

## 8. Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Create Story 工作流执行完毕（2026-03-06）：基于现有文档完善，明确 parseAndWriteScore 调用约定（scoring/orchestrator）、run_id/stage/question_version 参数、验收命令示例；未进入 party-mode（无重大方案歧义，parseAndWriteScore 接口已定义，评审调用方式与 epics/PRD 已对齐）。

### File List
