# Story 13.5: feedback 子命令

Status: ready-for-dev

<!-- 验证：运行 validate-create-story 进行质量检查后再执行 dev-story。 -->

## Story

**作为** 项目维护者，  
**我期望** init 完成后能通过 stdout 提示和 `feedback` 子命令获取反馈入口，  
**以便** 收集用户满意度与改进建议，并让用户了解全流程兼容的 AI 清单。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | §5.5 | feedback 子命令、init 完成后 stdout 可提示运行 `bmad-speckit feedback` 获取反馈入口 |
| PRD | §5.12.1 | 文档或 `bmad-speckit feedback` 关联文档中列出「全流程兼容 AI」清单（cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli） |
| PRD | §6 Success Metrics | 用户满意度测量：init 完成后输出反馈入口 |
| PRD | US-12 | 反馈入口（feedback）验收标准 |
| ARCH | §3.2 FeedbackCommand | 输出反馈入口；输出或关联文档须含全流程兼容 AI 清单 |
| Epics | 13.5 | feedback：init 后 stdout 提示、feedback 子命令输出反馈入口；feedback 输出或关联文档须含全流程兼容 AI 清单 |
| Story 12.4 | 非本 Story | Post-init 引导（/bmad-help 提示、bmad-help、speckit.constitution）由 Story 12.4 负责；本 Story 在 init 末尾追加反馈入口提示 |

## 本 Story 范围

1. **feedback 子命令**：新增 `bmad-speckit feedback`，输出用户反馈入口（问卷 URL 或反馈指引）。
2. **init 后 stdout 提示**：init 成功完成后，在 stdout 输出反馈入口提示（问卷 URL 或「运行 `bmad-speckit feedback` 获取反馈入口」说明）；与 Story 12.4 的 /bmad-help 提示区分，本 Story 专注反馈入口。
3. **全流程兼容 AI 清单**：feedback 输出或关联文档须含全流程兼容 AI 清单（PRD §5.12.1），须全部包含 8 项：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli。

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| check、version、upgrade 子命令 | Story 13.1、13.3 | 由 Story 13.1、13.3 分别负责；本 Story 仅实现 feedback |
| config 子命令 | Story 13.4 | 由 Story 13.4 负责；config get/set/list、--global、--json 已在 story-13-4-config 实现 |
| /bmad-help 提示、Post-init 引导模板（bmad-help、speckit.constitution） | Story 12.4 | 由 Story 12.4 负责；init.js 中 POST_INIT_GUIDE_MSG 由 12.4 实现；本 Story 在 12.4 引导之后追加 feedback 提示 |
| subagentSupport 为 none/limited 时的 init/check 提示 | Story 12.3 | maybePrintSubagentHint 由 Story 12.3 实现；与本 Story 的 feedback 提示并列输出，互不覆盖 |
| 问卷或反馈表单本身 | 无 | 本 Story 仅提供入口（URL 或文档链接），不实现问卷系统 |

## Acceptance Criteria

### AC-1: feedback 子命令

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 子命令已注册 | 用户执行 `bmad-speckit feedback` | 命令执行 | stdout 输出反馈入口（问卷 URL、表单链接或明确指引）；退出码 0 |
| 2 | 输出含全流程兼容 AI 清单 | 同上 | 同上 | 输出或内嵌「全流程兼容 AI」清单，包含 8 项：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli |
| 3 | 非 TTY 可运行 | 非 TTY 环境（CI、管道） | 执行 `bmad-speckit feedback` | 正常输出，不依赖 TTY；退出码 0 |

### AC-2: init 后 stdout 提示

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | init 成功完成 | 用户执行 `bmad-speckit init` 且流程无错误 | init 全部步骤执行完毕 | stdout 输出反馈入口提示（问卷 URL 或「运行 `bmad-speckit feedback` 获取反馈入口」）；与 Story 12.4 的 POST_INIT_GUIDE_MSG 区分 |
| 2 | 非交互模式 | 用户执行 `bmad-speckit init --ai cursor --yes` | init 全部步骤执行完毕 | stdout 同样输出 feedback 提示 |
| 3 | 非 TTY | 非 TTY 环境 init | init 成功完成 | 仍输出 feedback 提示（与 AC-1 #3 一致） |
| 4 | 提示位置 | init 流程 | 引导输出 | feedback 提示在 POST_INIT_GUIDE_MSG 之后、进程退出之前；init 失败时不输出 |

### AC-3: 全流程兼容 AI 清单内容

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | feedback 直接输出 | 执行 `bmad-speckit feedback` | 输出 | 明确列出 8 项：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli |
| 2 | 关联文档 | 反馈入口为文档链接 | 文档可访问 | 文档须含该 8 项清单；或 feedback 同时输出清单与 URL，二者至少满足其一 |

### AC-4: Success Metrics 对齐

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 用户满意度测量 | PRD §6 | init 完成后 | 输出反馈入口（`bmad-speckit feedback` 子命令或 stdout 中的问卷 URL）可用 |

## Tasks / Subtasks

- [ ] **Task 1**：实现 FeedbackCommand（AC: #1, #2 部分, #3）
  - [ ] 1.1 新增 `packages/bmad-speckit/src/commands/feedback.js`，实现 `feedbackCommand(cwd)` 或 `feedbackCommand()`；无 cwd 依赖时可不传 cwd
  - [ ] 1.2 实现输出：反馈入口 URL 或指引；输出或内嵌「全流程兼容 AI」清单（8 项：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli）
  - [ ] 1.3 在 `packages/bmad-speckit/bin/bmad-speckit.js` 注册 `feedback` 子命令，与 config、version 等并列；使用 `program.command('feedback').description(...).action(...)`

- [ ] **Task 2**：init 完成后 stdout 提示反馈入口（AC: #2, #4）
  - [ ] 2.1 在 InitCommand 成功完成流程末尾，在 POST_INIT_GUIDE_MSG 输出之后，追加 feedback 提示（问卷 URL 或「运行 `bmad-speckit feedback` 获取反馈入口」）；runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow 三个分支均须添加
  - [ ] 2.2 非 TTY 环境下仍输出该提示（与 AC-1 #3、AC-2 #3 一致）
  - [ ] 2.3 可从 feedback.js 导出 `getFeedbackHintText()` 供 init.js 复用，或内联简短文案；避免重复定义 8 项清单时使用共享常量

- [ ] **Task 3**：全流程兼容 AI 清单落地（AC: #3）
  - [ ] 3.1 在 feedback 输出中明确列出 8 项全流程兼容 AI：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli
  - [ ] 3.2 若反馈入口为文档链接，则文档须含该清单；或 feedback 直接输出清单与反馈 URL；两者至少满足其一

- [ ] **Task 4**：测试与验收
  - [ ] 4.1 单元/集成测试：`bmad-speckit feedback` 输出含反馈入口与 8 项清单；退出码 0
  - [ ] 4.2 端到端：`bmad-speckit init --ai cursor --yes` 后 stdout 包含 feedback 提示；非 TTY 下同样验证
  - [ ] 4.3 回归：确认 init、check、version、config、upgrade 不受影响；bin 中 feedback 注册正确

## Dev Notes

### 架构与依赖

- **FeedbackCommand**：ARCH §3.2 定义职责为「输出反馈入口；输出或关联文档须含全流程兼容 AI 清单（PRD §5.12.1）」。
- **依赖 E10.1**：init 核心流程须已实现；本 Story 仅在 init 完成末尾追加 stdout 提示，不改变 init 主流程逻辑。
- **CLI 入口**：与 check、version、config 子命令一致，在 `bin/bmad-speckit.js` 中通过 Commander 注册；config 使用 `program.command('config')` 配合子命令，feedback 为单命令无需子命令，参考 version、upgrade 的注册方式。

### 全流程兼容 AI 清单（PRD §5.12.1）

| AI ID        | 子代理支持 | 说明                         |
|-------------|------------|------------------------------|
| cursor-agent| 原生       | Cursor Task、MCP 子代理      |
| claude      | 原生       | Claude Code 原生子代理       |
| qwen        | 原生       | 通义灵码子代理               |
| auggie      | 原生       | .augment/agents/             |
| codebuddy   | 原生       | .codebuddy/agents/           |
| amp         | 原生       | Mini-Amp 子代理              |
| qodercli    | 原生       | 内置 + 自定义子代理          |
| kiro-cli    | 原生       | Plan Agent + 自定义         |

清单须在 feedback 输出或关联文档中出现，供用户知晓哪些 AI 支持 BMAD 全流程（party-mode、审计子任务等）。

### 反馈入口形式

- 首版可采用固定 URL（如项目 Issue 模板、Google Forms 等）或文档路径；具体 URL 可由配置或常量定义，便于维护时更新。
- stdout 提示文案须简短，与 Story 12.4 的 POST_INIT_GUIDE_MSG 区分：本 Story 专注反馈入口，12.4 专注下一步指引（/bmad-help、speckit.constitution）。

### init 流程集成位置

- **runWorktreeFlow**：L277-278 附近，maybePrintSubagentHint 之后、console.log(POST_INIT_GUIDE_MSG) 之后，追加 feedback 提示。
- **runNonInteractiveFlow**：L350-360 附近，同理在 POST_INIT_GUIDE_MSG 之后追加。
- **runInteractiveFlow**：需定位成功完成点，在 POST_INIT_GUIDE_MSG 之后追加。

### Previous Story 13.4 模式（config 子命令）

- **文件位置**：`packages/bmad-speckit/src/commands/config.js`，导出 `configGetCommand`、`configSetCommand`、`configListCommand`。
- **bin 注册**：`program.command('config')` 下挂 `.command('get <key>')`、`.command('set <key> <value>')`、`.command('list')`，各自 action 调用对应 Command。
- **feedback 简化**：feedback 无子命令，直接 `program.command('feedback').description('...').action(feedbackCommand)` 即可，与 version、upgrade 一致。
- **process.exit**：config 命令在完成时调用 `process.exit(0)` 或 `process.exit(1)`；feedback 成功时 `process.exit(0)`。

### 架构合规

- **Commander.js**：与 init、check、version、upgrade、config 共用同一 program 实例；不引入新依赖。
- **chalk**：若需彩色输出，复用 init/check 的 chalk；feedback 输出为纯文本亦可。
- **路径**：feedback 不读写文件，无 cwd 依赖时可不传；若未来从配置文件读取 feedback URL，则传入 cwd 与 ConfigManager 一致。

### 禁止词

文档与实现中禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### Project Structure Notes

```
packages/bmad-speckit/
├── bin/bmad-speckit.js          # 注册 feedback 子命令（与 version、upgrade 同级）
└── src/
    └── commands/
        └── feedback.js         # 新建；导出 feedbackCommand
```

### Testing Requirements

- **单元**：feedbackCommand 执行后 stdout 含反馈入口与 8 项 AI 清单；可 capture console.log 或 spawn 子进程断言。
- **集成**：`npx bmad-speckit feedback` 或 `node bin/bmad-speckit.js feedback` 退出码 0；输出可 grep 断言。
- **E2E**：init 成功后 stdout 含 feedback 提示；非 TTY 下执行 init 同样验证。

### References

- [PRD §5.5](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md#55-check-与-version-子命令)：feedback 子命令、init 后 stdout 提示
- [PRD §5.12.1](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md#5121-子代理支持与全流程兼容性)：全流程兼容 AI 清单（8 项）
- [PRD §6 Success Metrics](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md#6-success-metrics)：用户满意度、init 完成后输出反馈入口
- [PRD US-12](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md#us-12-反馈入口feedback)：验收标准
- [Epics 13.5](_bmad-output/planning-artifacts/dev/epics.md)：feedback 子命令、init 后 stdout 提示、全流程兼容 AI 清单
- [Story 13.4](_bmad-output/implementation-artifacts/epic-13-speckit-diagnostic-commands/story-13-4-config/13-4-config.md)：config 子命令模式、bin 注册方式
- [Story 12.4](_bmad-output/implementation-artifacts/epic-12-speckit-ai-skill-publish/story-12-4-post-init-guide/12-4-post-init-guide.md)：POST_INIT_GUIDE_MSG、非本 Story 范围边界

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
