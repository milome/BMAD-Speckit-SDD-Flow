# Plan E13-S5: feedback 子命令实现方案

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.5 - feedback 子命令  
**输入**: spec-E13-S5.md, 13-5-feedback.md, PRD §5.5/§5.12.1/§6, ARCH §3.2

---

## 1. 概述

本 plan 定义 Story 13.5 的实现方案：新建 FeedbackCommand（`bmad-speckit feedback`）输出反馈入口与全流程兼容 AI 清单（8 项）；在 init 成功完成后、POST_INIT_GUIDE_MSG 之后追加 feedback 提示；支持非 TTY 环境。

---

## 2. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story AC-1 #1 | spec §3.1, §3.2 | Phase 1、集成测试 | ✅ |
| Story AC-1 #2 | spec §3.2, §3.4 | Phase 1、集成测试 | ✅ |
| Story AC-1 #3 | spec §3.3 | Phase 1、集成测试 | ✅ |
| Story AC-2 #1, #4 | spec §4.1, §4.3 | Phase 2、集成测试 | ✅ |
| Story AC-2 #2 | spec §4.2 | Phase 2 | ✅ |
| Story AC-2 #3 | spec §4.3 | Phase 2、集成测试 | ✅ |
| Story AC-3 #1, #2 | spec §3.4 | Phase 1 | ✅ |
| Story AC-4 #1 | spec §5 | Phase 2、端到端测试 | ✅ |
| PRD §5.5、US-12 | spec §3, §4 | Phase 1、Phase 2 | ✅ |
| PRD §5.12.1 | spec §3.4 | Phase 1 | ✅ |
| PRD §6 | spec §4, §5 | Phase 2、端到端测试 | ✅ |
| ARCH §3.2 | spec §3 | Phase 1 | ✅ |
| spec §6 非本 Story | — | 依赖说明 | ✅ |

---

## 3. 技术架构

### 3.1 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| FeedbackCommand | `src/commands/feedback.js` | feedback 子命令；输出反馈入口 URL、全流程兼容 AI 清单（8 项）；导出 getFeedbackHintText() 供 init 复用 |
| bin/bmad-speckit.js | bin 入口 | 注册 feedback 子命令，与 version、upgrade 并列 |
| init.js | `src/commands/init.js` | 在 runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow 三个分支的 POST_INIT_GUIDE_MSG 之后追加 feedback 提示 |

### 3.2 数据流

```
feedback 子命令:
  调用 feedbackCommand()
       ↓
  输出反馈入口（URL 或指引）+ 8 项 AI 清单
       ↓
  process.exit(0)

init 成功流程 (任一分支):
  ... init 步骤完成 ...
       ↓
  maybePrintSubagentHint()
       ↓
  console.log(POST_INIT_GUIDE_MSG)
       ↓
  console.log(getFeedbackHintText())  新增
       ↓
  进程退出
```

### 3.3 集成测试与端到端测试计划（必须）

| 测试类型 | 覆盖内容 | 验收方式 |
|---------|---------|---------|
| **feedback 单元** | feedbackCommand 输出含反馈入口与 8 项 AI 清单 | capture console.log 或 spawn 子进程断言 stdout |
| **feedback 集成** | `bmad-speckit feedback` 被 bin 注册；执行成功；退出码 0 | 执行 CLI，断言 stdout 含 8 项、退出码 0 |
| **feedback 非 TTY** | 非 TTY 环境执行 feedback | 管道或 CI 环境执行，断言输出正常 |
| **init 集成** | runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow 三个分支均输出 feedback 提示 | init --ai cursor --yes 后 stdout 含 feedback 提示 |
| **init 非 TTY** | 非 TTY 环境 init | init 成功后 stdout 仍含 feedback 提示 |
| **端到端** | init 成功 → stdout 含 feedback 提示；feedback 子命令可单独运行 | 覆盖 TTY/非 TTY、三个 init 分支 |
| **回归** | init、check、version、config、upgrade 不受影响 | 执行既有命令，断言行为不变 |

---

## 4. 实现阶段（Phases）

### Phase 1: FeedbackCommand（AC-1, AC-3）

**目标**：新建 `src/commands/feedback.js`，在 bin 注册 `feedback` 子命令；输出反馈入口与 8 项全流程兼容 AI 清单。

**实现要点**：
1. 新建 `packages/bmad-speckit/src/commands/feedback.js`：
   - 定义常量 `FEEDBACK_URL` 或 `FEEDBACK_GUIDANCE`（固定 URL 或「运行 `bmad-speckit feedback` 获取反馈入口」等价文案）
   - 定义常量 `FULL_FLOW_AI_LIST`：8 项数组 `['cursor-agent','claude','qwen','auggie','codebuddy','amp','qodercli','kiro-cli']`
   - 实现 `feedbackCommand()`：无 cwd 依赖时可不传 cwd；输出反馈入口（URL 或指引）+ 8 项清单；使用 console.log 逐行输出；成功时 process.exit(0)
   - 导出 `getFeedbackHintText()`：返回 feedback 提示文案（问卷 URL 或「运行 `bmad-speckit feedback` 获取反馈入口」），供 init.js 复用
2. 输出格式：纯文本；feedback 直接输出清单与反馈 URL，满足 AC-3 #2「二者至少其一」
3. 非 TTY：不依赖 TTY，纯 console.log 输出
4. 在 `bin/bmad-speckit.js` 注册：
   - 增加 `const { feedbackCommand } = require('../src/commands/feedback');`
   - `program.command('feedback').description('Show feedback entry and full-flow compatible AI list').action(() => feedbackCommand());`

**产出**：`src/commands/feedback.js`，bin 修改

### Phase 2: init 完成后 stdout 提示（AC-2, AC-4）

**目标**：在 init 三个分支的 POST_INIT_GUIDE_MSG 之后追加 feedback 提示；非 TTY 仍输出。

**实现要点**：
1. 在 `init.js` 中 import `getFeedbackHintText` from `../commands/feedback`
2. **runWorktreeFlow**（约 L277-280）：在 `console.log(chalk.gray(POST_INIT_GUIDE_MSG));` 之后追加 `console.log(chalk.gray(getFeedbackHintText()));`
3. **runNonInteractiveFlow**（约 L354-357）：同上
4. **runInteractiveFlow**（约 L533-536）：同上
5. 非 TTY：与 AC-1 #3 一致，不依赖 TTY，三个分支均无条件输出 feedback 提示
6. init 失败（catch 块）：不进入成功路径，故不输出 feedback 提示，符合 AC-2 #4

**产出**：修改 `init.js`

---

## 5. 测试策略

| 层级 | 覆盖 |
|------|------|
| 单元 | feedbackCommand 输出结构；getFeedbackHintText() 返回值 |
| 集成 | feedback 子命令 CLI；init 三个分支 stdout 含 feedback 提示；非 TTY feedback、非 TTY init |
| 端到端 | init 成功全流程 → 验证 stdout；feedback 单独运行；回归 init/check/version/config/upgrade |

---

## 6. 依赖与约束

- **依赖 E10.1**：init 核心流程已实现；本 Story 仅在成功路径末尾追加 output
- **依赖 Story 12.4**：POST_INIT_GUIDE_MSG 已存在；本 Story 在其之后追加
- **约束**：feedback 不读写文件，无 cwd 依赖；8 项清单使用共享常量，避免 feedback 与 init 重复定义；禁止使用 chalk 等仅 TTY 时输出的逻辑

<!-- AUDIT: PASSED by code-reviewer -->
