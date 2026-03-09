# Story 13.5: feedback 子命令

Status: ready-for-dev

<!-- 验证：运行 validate-create-story 进行质量检查后再执行 dev-story。 -->

## Story

**作为** 项目维护者，  
**我期望** init 完成后能通过 stdout 提示和 `feedback` 子命令获取反馈入口，  
**以便** 收集用户满意度与改进建议，并让用户了解全流程兼容的 AI 清单。

## 本 Story 范围

1. **feedback 子命令**：新增 `bmad-speckit feedback`，输出用户反馈入口（问卷 URL 或反馈指引）。
2. **init 后 stdout 提示**：init 成功完成后，在 stdout 输出反馈入口提示（问卷 URL 或「运行 `bmad-speckit feedback` 获取反馈入口」说明）。
3. **全流程兼容 AI 清单**：feedback 输出或关联文档须含全流程兼容 AI 清单（PRD §5.12.1），建议优先：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli。

## 非本 Story 范围

- check、version、upgrade、config 子命令：由 Story 13.1、13.3、13.4 负责。
- /bmad-help、Post-init 引导模板内容：由 Story 12.4 负责。
- 问卷或反馈表单本身：本 Story 仅提供入口（URL 或文档链接），不实现问卷系统。

## Acceptance Criteria

1. **AC1** `bmad-speckit feedback` 子命令已注册，执行时输出反馈入口（问卷 URL、表单链接或明确指引）。
2. **AC2** init 成功完成后，stdout 输出反馈入口提示；提示内容可为问卷 URL 或「运行 `bmad-speckit feedback` 获取反馈入口」。
3. **AC3** feedback 输出（或 feedback 关联文档，如 README 中 feedback 章节）须含「全流程兼容 AI」清单；清单须包含 PRD §5.12.1 建议的 8 项：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli。
4. **AC4** 满足 §6 Success Metrics 中用户满意度测量方式：init 完成后输出反馈入口（`bmad-speckit feedback` 子命令或 stdout 中的问卷 URL）。
5. **AC5** feedback 子命令与 init 的 stdout 提示行为在非 TTY 环境下可正常运行（非交互场景下不依赖 TTY）。

## Tasks / Subtasks

- [ ] **Task 1**：实现 FeedbackCommand（AC: #1, #3, #5）
  - [ ] 1.1 新增 `src/commands/feedback.js`，注册 `feedback` 子命令
  - [ ] 1.2 实现输出：反馈入口 URL 或指引；输出或内嵌「全流程兼容 AI」清单（cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli）
  - [ ] 1.3 在 `bin/bmad-speckit.js` 中挂载 feedback 子命令
- [ ] **Task 2**：init 完成后 stdout 提示反馈入口（AC: #2, #4）
  - [ ] 2.1 在 InitCommand 成功完成流程末尾，输出反馈入口提示（问卷 URL 或「运行 `bmad-speckit feedback` 获取反馈入口」）
  - [ ] 2.2 非 TTY 环境下仍输出该提示（与 AC5 一致）
- [ ] **Task 3**：全流程兼容 AI 清单落地（AC: #3）
  - [ ] 3.1 在 feedback 输出中明确列出 8 项全流程兼容 AI：cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli
  - [ ] 3.2 若反馈入口为文档链接，则文档须含该清单；或 feedback 直接输出清单与反馈 URL，两者择一或同时满足

## Dev Notes

### 架构与依赖

- **FeedbackCommand**：ARCH §3.2 定义职责为「输出反馈入口；输出或关联文档须含全流程兼容 AI 清单（PRD §5.12.1）」。
- **依赖 E10.1**：init 核心流程须已实现；本 Story 仅在 init 完成末尾追加 stdout 提示，不改变 init 主流程逻辑。
- **CLI 入口**：与 check、version 等子命令一致，在 `bin/bmad-speckit.js` 中通过 Commander 注册。

### 全流程兼容 AI 清单（PRD §5.12.1）

| AI ID        | 子代理支持 | 说明                         |
|-------------|------------|------------------------------|
| cursor-agent| 原生       | Cursor Task、MCP 子代理      |
| claude      | 原生       | Claude Code 原生子代理       |
| qwen       | 原生       | 通义灵码子代理               |
| auggie     | 原生       | .augment/agents/             |
| codebuddy  | 原生       | .codebuddy/agents/           |
| amp        | 原生       | Mini-Amp 子代理              |
| qodercli   | 原生       | 内置 + 自定义子代理          |
| kiro-cli   | 原生       | Plan Agent + 自定义         |

清单须在 feedback 输出或关联文档中出现，供用户知晓哪些 AI 支持 BMAD 全流程（party-mode、审计子任务等）。

### 反馈入口形式

- 首版可采用固定 URL（如项目 Issue 模板、Google Forms 等）或文档路径；具体 URL 可由配置或常量定义，便于维护时更新。
- stdout 提示文案须简短，与 Story 12.4 的 /bmad-help 提示区分：本 Story 专注反馈入口，12.4 专注下一步指引。

### 禁止写死与约束

- 禁止使用禁止词：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。
- 全流程兼容 AI 清单的 8 项为 PRD §5.12.1 明确要求，须全部包含。

### Project Structure Notes

- 对齐 `bmad-speckit` 包结构：`src/commands/feedback.js`
- 与 Story 13.1、13.3、13.4 的子命令注册方式一致

### References

- [PRD §5.5](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md#55-check-与-version-子命令)：feedback 子命令、init 后 stdout 提示
- [PRD §5.12.1](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md#5121-子代理支持与全流程兼容性)：全流程兼容 AI 清单（cursor-agent、claude、qwen、auggie、codebuddy、amp、qodercli、kiro-cli）
- [PRD §6](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md#6-success-metrics)：用户满意度、init 完成后输出反馈入口
- [PRD US-12](_bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md#us-12-反馈入口feedback)：验收标准
- [Epics 13.5](_bmad-output/planning-artifacts/dev/epics.md)：feedback 子命令、init 后 stdout 提示、全流程兼容 AI 清单
- [ARCH §3.2 FeedbackCommand](_bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md)：模块职责

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
