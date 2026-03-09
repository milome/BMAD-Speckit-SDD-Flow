# Spec E13-S5: feedback 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.5 - feedback 子命令  
**输入**: 13-5-feedback.md, PRD §5.5/§5.12.1/§6, ARCH §3.2 FeedbackCommand

---

## 1. 概述

本 spec 定义 Story 13.5（feedback 子命令）的技术规格，覆盖：

- **FeedbackCommand**：新增 `bmad-speckit feedback`，输出用户反馈入口（问卷 URL、表单链接或明确指引）；输出或内嵌「全流程兼容 AI」清单（8 项：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli）
- **init 后 stdout 提示**：init 成功完成后，在 POST_INIT_GUIDE_MSG 输出之后、进程退出之前，追加 feedback 入口提示（问卷 URL 或「运行 `bmad-speckit feedback` 获取反馈入口」）
- **全流程兼容 AI 清单**：feedback 输出或关联文档须含 8 项 AI 清单；非 TTY 环境可正常输出

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story AC-1 #1 | feedback 子命令注册；stdout 输出反馈入口；退出码 0 | §3.1, §3.2 | ✅ |
| Story AC-1 #2 | 输出含全流程兼容 AI 清单（8 项） | §3.2, §3.4 | ✅ |
| Story AC-1 #3 | 非 TTY 可运行，正常输出 | §3.3 | ✅ |
| Story AC-2 #1 | init 成功后 stdout 输出 feedback 提示；与 POST_INIT_GUIDE_MSG 区分 | §4.1, §4.3 | ✅ |
| Story AC-2 #2 | 非交互模式 init 同样输出 feedback 提示 | §4.2 | ✅ |
| Story AC-2 #3 | 非 TTY init 仍输出 feedback 提示 | §4.3 | ✅ |
| Story AC-2 #4 | 提示位置：POST_INIT_GUIDE_MSG 之后、进程退出之前；init 失败不输出 | §4.3 | ✅ |
| Story AC-3 #1 | feedback 直接输出 8 项清单 | §3.4 | ✅ |
| Story AC-3 #2 | 关联文档含 8 项；或 feedback 同时输出清单与 URL | §3.4 | ✅ |
| Story AC-4 #1 | 用户满意度测量：init 完成后输出反馈入口 | §4, §5 | ✅ |
| PRD §5.5 | feedback 子命令、init 完成后 stdout 提示 | §3, §4 | ✅ |
| PRD US-12 | 反馈入口（feedback）验收标准：feedback 子命令、init 后 stdout 输出反馈入口 | §3, §4, §5 | ✅ |
| PRD §5.12.1 | 全流程兼容 AI 清单（8 项） | §3.4 | ✅ |
| PRD §6 | 用户满意度、init 后输出反馈入口 | §4, §5 | ✅ |
| ARCH §3.2 | FeedbackCommand 职责 | §3 | ✅ |
| Epics 13.5 | feedback：init 后 stdout、feedback 子命令、全流程兼容 AI 清单 | §1, §3, §4 | ✅ |

---

## 3. FeedbackCommand

### 3.1 子命令职责（AC-1 #1）

| 行为 | 说明 |
|------|------|
| 命令 | `bmad-speckit feedback` |
| 输出 | 反馈入口（问卷 URL、表单链接或明确指引） |
| 退出码 | 成功时 process.exit(0) |
| 注册 | bin/bmad-speckit.js 中 `program.command('feedback').description(...).action(...)`，与 version、upgrade 并列 |

### 3.2 输出内容（AC-1 #1, AC-1 #2）

| 内容 | 要求 |
|------|------|
| 反馈入口 | 问卷 URL、表单链接，或「运行 `bmad-speckit feedback` 获取反馈入口」等价说明 |
| 全流程兼容 AI 清单 | 8 项：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli |

### 3.3 非 TTY 支持（AC-1 #3）

| 场景 | 行为 |
|------|------|
| 非 TTY 环境（CI、管道） | 正常输出到 stdout，不依赖 TTY；退出码 0 |
| 实现 | 禁止使用 chalk 的 isTTY 依赖或仅 TTY 时输出的逻辑；feedback 输出为纯文本 |

### 3.4 全流程兼容 AI 清单（AC-3）

| AI ID | 子代理支持 | 说明 |
|-------|------------|------|
| cursor-agent | 原生 | Cursor Task、MCP 子代理 |
| claude | 原生 | Claude Code 原生子代理 |
| qwen | 原生 | 通义灵码子代理 |
| auggie | 原生 | .augment/agents/ |
| codebuddy | 原生 | .codebuddy/agents/ |
| amp | 原生 | Mini-Amp 子代理 |
| qodercli | 原生 | 内置 + 自定义子代理 |
| kiro-cli | 原生 | Plan Agent + 自定义 |

**实现要求**：feedback 输出或关联文档须含该 8 项；若反馈入口为文档链接，则文档须含清单，或 feedback 同时输出清单与 URL，二者至少满足其一。

---

## 4. init 后 stdout 提示（AC-2）

### 4.1 触发条件（AC-2 #1, #4）

| 条件 | 行为 |
|------|------|
| init 全部步骤成功完成 | 在 POST_INIT_GUIDE_MSG 输出之后、进程退出之前，追加 feedback 提示 |
| init 失败（catch 块） | 不输出 feedback 提示 |
| 与 Story 12.4 区分 | POST_INIT_GUIDE_MSG 专注下一步指引；本 Story 专注反馈入口 |

### 4.2 分支覆盖（AC-2 #2）

| 分支 | 位置 | 要求 |
|------|------|------|
| runWorktreeFlow | maybePrintSubagentHint、POST_INIT_GUIDE_MSG 之后 | 追加 feedback 提示 |
| runNonInteractiveFlow | 同上 | 追加 feedback 提示 |
| runInteractiveFlow | 同上 | 追加 feedback 提示 |

### 4.3 非 TTY 与位置（AC-2 #3, #4）

| 场景 | 行为 |
|------|------|
| 非 TTY 环境 init | 仍输出 feedback 提示 |
| 提示位置 | POST_INIT_GUIDE_MSG 之后、console.log(POST_INIT_GUIDE_MSG) 之后立即追加；进程退出之前 |

---

## 5. Success Metrics 对齐（AC-4）

| 指标 | 验证方式 |
|------|----------|
| 用户满意度测量 | init 完成后 stdout 含反馈入口；`bmad-speckit feedback` 可单独运行获取反馈入口 |
| 验收 | 输出反馈入口（子命令或 stdout 中的问卷 URL）可用 |

---

## 6. 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| check、version、upgrade 子命令 | Story 13.1、13.3 | 本 Story 仅实现 feedback |
| config 子命令 | Story 13.4 | 已由 13.4 实现 |
| POST_INIT_GUIDE_MSG、Post-init 引导模板 | Story 12.4 | 本 Story 在其之后追加 feedback 提示 |
| subagentSupport 为 none/limited 时的 init/check 提示 | Story 12.3 | maybePrintSubagentHint 与本 Story 并列输出 |
| 问卷或反馈表单本身 | 无 | 本 Story 仅提供入口，不实现问卷系统 |

---

## 7. 依赖与实现约束

- **依赖 E10.1**：init 核心流程已实现；本 Story 仅在 init 完成末尾追加 stdout 提示
- **实现位置**：`packages/bmad-speckit/src/commands/feedback.js`（新建）；bin 注册 feedback 子命令
- **反馈入口形式**：首版可采用固定 URL（如项目 Issue 模板、Google Forms）或文档路径；可由常量定义，便于维护
- **共享**：可从 feedback.js 导出 `getFeedbackHintText()` 供 init.js 复用，或内联简短文案；8 项清单使用共享常量避免重复定义

---

## 8. 术语

| 术语 | 定义 |
|------|------|
| 全流程兼容 AI | 支持 BMAD 全流程（party-mode、审计子任务等）的 8 项 AI |
| 反馈入口 | 用户可提交满意度或改进建议的入口（问卷 URL、表单链接或指引） |

<!-- AUDIT: PASSED by code-reviewer -->
