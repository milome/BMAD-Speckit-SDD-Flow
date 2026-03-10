# Tasks E13-S5: feedback 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.5 - feedback 子命令  
**输入**: IMPLEMENTATION_GAPS-E13-S5.md, plan-E13-S5.md, spec-E13-S5.md

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T1.4 | Story 13-5, spec §3 | AC-1, AC-3 | FeedbackCommand、feedback 子命令、8 项 AI 清单、getFeedbackHintText |
| T2–T2.3 | Story 13-5, spec §4 | AC-2, AC-4 | init 三分支追加 feedback 提示、非 TTY |
| T3 | plan §3.3、§5, Story Task 4 | GAP-3.1 | feedback 单元/集成/非 TTY、init 集成、端到端、回归测试 |

---

## 2. Gaps → 任务映射

| 章节 | Gap ID | 对应任务 |
|------|--------|----------|
| spec §3 | GAP-1.1–1.5 | T1.1–T1.4 |
| spec §4 | GAP-2.1–2.4 | T2.1–T2.3 |
| plan §3.3、§5 | GAP-3.1 | T3 |

---

## 3. Agent 执行规则

**禁止事项**：禁止占位、伪实现、跳过 TDD 红灯、标记完成但功能未调用。  
**必须事项**：集成任务修改生产路径、运行验证命令、TDD 红绿灯、实施前检索需求。

---

## 4. 任务列表

### T1: FeedbackCommand（AC-1, AC-3）

- [ ] **T1.1** 新建 `packages/bmad-speckit/src/commands/feedback.js`，实现 feedbackCommand()
  - **验收**：feedbackCommand 存在且可调用；输出反馈入口（URL 或指引）；输出或内嵌 8 项 AI 清单；成功时 process.exit(0)；**集成验证**：bin 注册后 `bmad-speckit feedback` 成功，由 T3 覆盖
  - **生产代码**：feedback.js（FEEDBACK_URL/FEEDBACK_GUIDANCE、FULL_FLOW_AI_LIST 常量；feedbackCommand 实现）
  - **单元测试**：feedbackCommand 执行后 stdout 含反馈入口与 8 项清单；可 capture console.log 或 spawn 子进程断言

- [ ] **T1.2** 定义 FULL_FLOW_AI_LIST：8 项 `['cursor-agent','claude','qwen','auggie','codebuddy','amp','qodercli','kiro-cli']`；feedback 输出中明确列出该清单
  - **验收**：stdout 含全部 8 项；顺序与 spec §3.4 一致
  - **生产代码**：feedback.js
  - **单元测试**：断言 8 项均出现在输出中

- [ ] **T1.3** 导出 getFeedbackHintText()：返回 feedback 提示文案（问卷 URL 或「运行 `bmad-speckit feedback` 获取反馈入口」），供 init.js 复用
  - **验收**：getFeedbackHintText 存在且返回非空字符串；与 feedback 输出中的反馈入口一致
  - **生产代码**：feedback.js
  - **单元测试**：getFeedbackHintText 返回值含反馈入口描述

- [ ] **T1.4** 在 bin/bmad-speckit.js 注册 `feedback` 子命令，与 version、upgrade 并列；调用 feedbackCommand
  - **验收**：bmad-speckit feedback 成功；bmad-speckit --help 列出 feedback；退出码 0
  - **生产代码**：bin/bmad-speckit.js
  - **集成测试**：CLI 执行 bmad-speckit feedback

### T2: init 完成后 stdout 提示（AC-2, AC-4）

- [ ] **T2.1** 在 init.js 中 import getFeedbackHintText from '../commands/feedback'；在 runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow 三处的 console.log(POST_INIT_GUIDE_MSG) 之后追加 console.log(chalk.gray(getFeedbackHintText()))
  - **验收**：init 成功后 stdout 含 feedback 提示；feedback 提示位于 POST_INIT_GUIDE_MSG 之后；三分支均输出
  - **生产代码**：init.js（三处修改）
  - **集成测试**：init --ai cursor --yes 后 stdout 含 feedback 提示

- [ ] **T2.2** 非 TTY 环境：feedback 提示不依赖 TTY；init 非 TTY 时仍输出 feedback 提示
  - **验收**：管道或 CI 环境下 init 成功、feedback 子命令均正常输出
  - **生产代码**：init.js、feedback.js（均不依赖 TTY 判断）
  - **集成测试**：非 TTY 环境执行 init、feedback，断言输出正常

- [ ] **T2.3** init 失败时不输出 feedback 提示
  - **验收**：init 在 catch 块退出时，stdout 无 feedback 提示
  - **生产代码**：init.js（仅成功路径追加提示）
  - **集成测试**：init 失败场景（如无效路径）验证无 feedback 输出

### T3: 单元、集成、端到端测试（GAP-3.1）

- [ ] **T3.1** 单元测试：feedbackCommand 输出含反馈入口与 8 项清单；getFeedbackHintText 返回值
  - **验收**：node --test 或 vitest 通过；assert stdout 含 8 项
  - **测试代码**：packages/bmad-speckit/tests/feedback.test.js

- [ ] **T3.2** 集成测试：bmad-speckit feedback 退出码 0、输出含反馈入口与 8 项；非 TTY 下 feedback 正常
  - **验收**：CLI 执行成功；管道/非 TTY 下输出正确
  - **测试代码**：packages/bmad-speckit/tests/feedback.test.js 或 e2e

- [ ] **T3.3** 集成测试：init --ai cursor --yes 后 stdout 含 feedback 提示；非 TTY 下 init 同样含 feedback 提示
  - **验收**：init 成功后 stdout 可 grep feedback 提示；三个 init 分支均覆盖
  - **测试代码**：packages/bmad-speckit/tests/ 或 e2e/init 相关

- [ ] **T3.4** 端到端与回归：init 成功全流程 → 验证 stdout；feedback 单独运行；init、check、version、config、upgrade 不受影响
  - **验收**：既有命令行为不变；feedback 可单独运行
  - **测试代码**：packages/bmad-speckit/tests/

---

## 5. 验收命令汇总

| 任务 | 验收命令 |
|------|----------|
| T1 | `node packages/bmad-speckit/bin/bmad-speckit.js feedback`；stdout 含 8 项 AI |
| T2 | `node packages/bmad-speckit/bin/bmad-speckit.js init --ai cursor --yes`；stdout 含 feedback 提示 |
| T3 | `cd packages/bmad-speckit && npm run test` 或 `node --test tests/`；init、check、version、config、upgrade 回归 |

<!-- AUDIT: PASSED by code-reviewer -->
