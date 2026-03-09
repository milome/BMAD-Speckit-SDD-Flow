# IMPLEMENTATION_GAPS E13-S5: feedback 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.5 - feedback 子命令  
**输入**: plan-E13-S5.md, spec-E13-S5.md, 13-5-feedback.md (Story 13.5), 当前实现

---

## 1. 概述

本文档对照 plan、spec 与当前 bmad-speckit 实现，逐章节列出实现差距（Gap），供 tasks 拆解与执行。

**当前实现范围**：
- `feedback.js`：**不存在**；需新建
- `bin/bmad-speckit.js`：description 中已含 "feedback" 文案，**未注册 feedback 子命令**
- `init.js`：**无** getFeedbackHintText 调用；**无** feedback 提示输出；POST_INIT_GUIDE_MSG 之后未追加 feedback 文案

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3.1、AC-1 #1 | GAP-1.1 | FeedbackCommand：feedback 子命令 | 未实现 | 无 feedback.js；bin 未注册 feedback |
| spec §3.2、AC-1 #1、#2 | GAP-1.2 | 输出反馈入口 URL 或指引、8 项 AI 清单 | 未实现 | 无 feedback 模块 |
| spec §3.3、AC-1 #3 | GAP-1.3 | 非 TTY 可运行、正常输出 | 未实现 | 无 feedback 命令 |
| spec §3.4、AC-3 | GAP-1.4 | 全流程兼容 AI 清单 8 项：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli | 未实现 | 无 feedback 输出 |
| spec §4.1–§4.3、AC-2 | GAP-2.1 | init 成功后 POST_INIT_GUIDE_MSG 之后追加 feedback 提示 | 未实现 | init.js 三个分支均无 feedback 提示 |
| spec §4.2 | GAP-2.2 | runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow 三处均输出 | 未实现 | 三处均缺 |
| spec §4.3 | GAP-2.3 | 非 TTY init 仍输出 feedback 提示 | 未实现 | 无 feedback 输出逻辑 |
| spec §5、AC-4 | GAP-2.4 | Success Metrics：init 后输出反馈入口可用 | 未实现 | 依赖 GAP-1、GAP-2 |
| spec §7 | GAP-1.5 | getFeedbackHintText() 导出供 init 复用；8 项清单共享常量 | 未实现 | 无 feedback 模块 |
| plan Phase 1 | GAP-1.x | FeedbackCommand 实现与 bin 注册 | 未实现 | 见 GAP-1.1–1.5 |
| plan Phase 2 | GAP-2.x | init 三分支追加 feedback 提示 | 未实现 | 见 GAP-2.1–2.4 |
| plan §3.3、§5，Story Task 4 | GAP-3.1 | feedback 单元/集成/非 TTY 测试；init 三分支 feedback 提示集成测试；端到端与回归测试 | 未实现 | 无 feedback 相关测试 |

---

## 3. Gaps 分类汇总

| 类别 | Gap ID | 说明 |
|------|--------|------|
| **FeedbackCommand** | GAP-1.1, GAP-1.2, GAP-1.3, GAP-1.4, GAP-1.5 | 新建 feedback.js、bin 注册、输出反馈入口与 8 项清单、导出 getFeedbackHintText |
| **init 集成** | GAP-2.1, GAP-2.2, GAP-2.3, GAP-2.4 | runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow 三处追加 feedback 提示 |
| **测试与验收** | GAP-3.1 | plan §3.3、§5，Story Task 4：feedback 单元/集成/非 TTY、init 集成、端到端、回归 |

---

## 4. 与 plan 阶段对应

| plan Phase | 对应 Gap | 说明 |
|-------------|----------|------|
| Phase 1 | GAP-1.1–1.5 | FeedbackCommand、bin 注册、8 项清单、getFeedbackHintText |
| Phase 2 | GAP-2.1–2.4 | init 三分支追加 feedback 提示、非 TTY |
| plan §5 测试策略 | GAP-3.1 | feedback 单元/集成/非 TTY；init 集成；端到端；回归 init/check/version/config/upgrade |

---

## 5. 实施顺序建议

1. Phase 1：新建 feedback.js（FEEDBACK_URL/FEEDBACK_GUIDANCE、FULL_FLOW_AI_LIST、feedbackCommand、getFeedbackHintText），bin 注册 feedback
2. Phase 2：init.js 三处 import getFeedbackHintText，在 POST_INIT_GUIDE_MSG 之后追加 console.log(chalk.gray(getFeedbackHintText()));
3. Phase 3：按 plan §3.3、§5 及 Story Task 4 编写 feedback 单元/集成/非 TTY 测试、init 集成测试、端到端与回归测试

<!-- AUDIT: PASSED by code-reviewer -->
