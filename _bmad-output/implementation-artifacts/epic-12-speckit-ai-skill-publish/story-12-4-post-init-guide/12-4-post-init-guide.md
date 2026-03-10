# Story 12.4: Post-init 引导

Status: ready-for-dev

<!-- Note: Run validate-create-story for quality check before dev-story. -->

## Story

**As a** 独立开发者，  
**I want to** 在 init 完成后看到 stdout 中的 /bmad-help 提示，且模板已包含 bmad-help、speckit.constitution 命令，  
**so that** 我能立即知道在 AI IDE 中运行 `/bmad-help` 或 `speckit.constitution` 获取下一步指引，快速上手 SDD 流程。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | §5.2 | Post-init 引导：init 完成后 stdout 输出 /bmad-help 提示 |
| PRD | §5.13 | Post-init 引导（必须实现）：stdout 提示、模板含 bmad-help、speckit.constitution |
| ARCH | §3.2 | init 流程状态机：Post-init 引导（stdout 输出 /bmad-help 提示） |
| ARCH | §5.13 | init 完成后 stdout 输出 /bmad-help 提示 |
| Epics | 12.4 | Post-init 引导：stdout 输出 /bmad-help 提示、模板含 bmad-help、speckit.constitution |

## 本 Story 范围

- **stdout 输出 /bmad-help 提示**：init 流程全部完成后，在 stdout 输出简短提示，建议用户在 AI IDE 中运行 `/bmad-help` 或等价命令获取下一步指引
- **模板含 bmad-help**：init 使用的模板（_bmad 或 GitHub Release 拉取的 tarball）须包含 `bmad-help` 命令文件，经 Story 12.2 同步后，用户可在所选 AI 目标目录（如 .cursor/commands/、.claude/commands/）中执行该命令
- **模板含 speckit.constitution**：init 使用的模板须包含 `speckit.constitution` 命令文件，经 Story 12.2 同步后，用户可在所选 AI 目标目录中执行该命令，用于 Spec-Driven Development 宪章阶段

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| init 主流程（Banner、AI 选择、模板拉取、骨架生成、git init） | Story 10.1 | 由 Story 10.1 负责；本 Story 在 init 完成后追加引导输出 |
| 按 configTemplate 同步 commands 到 AI 目标目录 | Story 12.2 | 由 Story 12.2 负责；本 Story 仅确保模板源含 bmad-help、speckit.constitution |
| Skill 发布到 AI 全局目录 | Story 12.3 | 由 Story 12.3 负责 |
| feedback 子命令与 stdout 反馈入口提示 | Story 13.5 | 由 Story 13.5 负责；本 Story 仅输出 /bmad-help 相关引导 |
| 模板拉取、cache、--offline | Story 11.1、11.2 | 由 Epic 11 负责；本 Story 依赖 E10.1 的 init 基座，模板来源由 E11 提供 |

## Acceptance Criteria

### AC-1: stdout 输出 /bmad-help 提示

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | init 成功完成 | 用户执行 `bmad-speckit init` 且流程无错误 | init 全部步骤执行完毕 | stdout 输出简短提示，建议在 AI IDE 中运行 `/bmad-help` 或等价命令获取下一步指引 |
| 2 | 非交互模式 | 用户执行 `bmad-speckit init --ai cursor --yes` | init 全部步骤执行完毕 | stdout 同样输出 /bmad-help 提示 |
| 3 | 提示位置 | init 流程 | 引导输出 | 引导输出在 init 成功完成之后、进程退出之前；不覆盖错误输出 |

### AC-2: 模板含 bmad-help 命令

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 模板源包含 bmad-help | init 使用的模板（_bmad 或 tarball） | 部署到项目 | 模板中 _bmad/cursor/commands/ 或等效路径存在 bmad-help 命令文件（如 bmad-help.md），供 Story 12.2 按 configTemplate 同步到所选 AI 目标目录 |
| 2 | --modules 场景 | 用户传 `--modules bmm,tea` | 选择性初始化 | 所选模块对应的模板部分若含 commands，须包含 bmad-help；若模板按模块拆分，bmm/tea 模块的 commands 须含 bmad-help 或由公共 commands 提供 |

### AC-3: 模板含 speckit.constitution 命令

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 模板源包含 speckit.constitution | init 使用的模板 | 部署到项目 | 模板中 _bmad/cursor/commands/ 或 speckit 等效路径存在 speckit.constitution 命令文件（如 speckit.constitution.md），供 Story 12.2 同步到所选 AI 目标目录 |
| 2 | speckit 流程入口 | 用户运行 speckit.constitution | 命令执行 | 命令可正常触发 Spec-Driven Development 宪章阶段，产出 constitution.md 或等效文档 |

### AC-4: 与 init 流程集成

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 执行顺序 | InitCommand 完成骨架生成、git init（若未 --no-git）、AI 配置同步（Story 12.2） | 全部成功 | 在进程退出前输出 Post-init 引导 |
| 2 | init 失败 | init 流程中任一步骤失败 | 错误处理 | 不输出 Post-init 引导；仅输出错误信息并退出 |

## Tasks / Subtasks

- [ ] **T1**：在 InitCommand 中实现 Post-init 引导 stdout 输出（AC: 1, 4）
  - [ ] T1.1 在 init 流程成功完成点（骨架生成、git init、AI 同步完成后）调用 PostInitGuide 输出函数
  - [ ] T1.2 实现输出内容：简短提示，建议在 AI IDE 中运行 `/bmad-help` 或等价命令获取下一步指引；文案与 PRD §5.2、§5.13 一致
  - [ ] T1.3 确保引导输出在 init 成功时执行，init 失败（退出码非 0）时不执行

- [ ] **T2**：确保模板包含 bmad-help 命令（AC: 2）
  - [ ] T2.1 校验 init 使用的模板（_bmad 或 GitHub Release tarball）中 _bmad/cursor/commands/ 或等效路径存在 bmad-help.md（或 bmad-help 命令文件）
  - [ ] T2.2 若模板由外部提供（GitHub Release），在模板仓库或 bmad-speckit 的模板规范文档中明确要求包含 bmad-help；若模板由本项目 _bmad 提供，确保 _bmad/cursor/commands/bmad-help.md 存在
  - [ ] T2.3 --modules 场景：若模板按模块拆分，确保 bmad-help 在公共 commands 或所选模块的 commands 中可用

- [ ] **T3**：确保模板包含 speckit.constitution 命令（AC: 3）
  - [ ] T3.1 校验模板中 _bmad/cursor/commands/ 或 _bmad/speckit/ 等效路径存在 speckit.constitution.md（或 speckit.constitution 命令文件）
  - [ ] T3.2 若模板由外部提供，在模板规范中明确要求包含 speckit.constitution；若由本项目 _bmad 提供，确保该命令文件存在
  - [ ] T3.3 验证 speckit.constitution 命令可被 Story 12.2 的同步逻辑正确部署到所选 AI 目标目录

- [ ] **T4**：验收与文档（AC: 1–4）
  - [ ] T4.1 编写 E2E 验收：`bmad-speckit init --ai cursor --yes` 后 stdout 包含 /bmad-help 提示
  - [ ] T4.2 验收模板：init 后目标项目中 .cursor/commands/（或所选 AI 对应目录）存在 bmad-help、speckit.constitution 命令文件
  - [ ] T4.3 更新 InitCommand 相关文档或注释，说明 Post-init 引导的触发时机与输出内容

## Dev Notes

### 架构约束

- **InitCommand**：Post-init 引导在 init 流程最后一步执行；须在骨架生成、git init、AI 配置同步（Story 12.2）全部成功后调用（PRD §5.2、§5.13，ARCH §3.2）
- **模板来源**：模板由 Story 11.1 的 TemplateFetcher 拉取；本 Story 负责确保模板内容包含 bmad-help、speckit.constitution，或在本项目 _bmad 中补齐
- **输出位置**：stdout，使用 console.log 或等效；不写入文件；init 失败时不输出

### 技术要点

- **引导文案**：与 PRD §5.2、§5.13 一致，例如：「Init 完成。建议在 AI IDE 中运行 `/bmad-help` 获取下一步指引，或运行 `speckit.constitution` 开始 Spec-Driven Development。」
- **命令文件路径**：bmad-help 通常位于 _bmad/cursor/commands/bmad-help.md 或 _bmad/core/commands/；speckit.constitution 位于 _bmad/cursor/commands/speckit.constitution.md 或 _bmad/speckit/commands/；以实际模板结构为准
- **--modules**：若 `--modules bmm,tea` 仅部署部分模块，须确保 bmad-help、speckit.constitution 在公共 commands 或所选模块的 commands 中；若模板为单体，则 --modules 仅过滤子目录，commands 仍完整部署

### 与 E10、E11、E12 的集成边界

- **E10.1**：本 Story 依赖 Story 10.1 的 init 基座；在 InitCommand 成功完成点插入 PostInitGuide 调用
- **E11.1**：模板由 TemplateFetcher 拉取；本 Story 校验或补齐模板中的 bmad-help、speckit.constitution
- **E12.2**：Story 12.2 负责按 configTemplate 同步 commands 到 AI 目标目录；本 Story 确保模板源含所需命令，不实现同步逻辑
- **E12.3**：Story 12.3 负责 Skill 发布；本 Story 不涉及 skills 目录

### 禁止词

文档与实现中禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### Project Structure Notes

```
bmad-speckit/
├── src/
│   ├── commands/init.js           # InitCommand，在成功完成点调用 PostInitGuide
│   └── services/
│       └── post-init-guide.js    # PostInitGuide 输出函数（或内联于 init.js）
_bmad/                             # 模板源（若由本项目提供）
├── cursor/commands/
│   ├── bmad-help.md               # 须存在
│   └── speckit.constitution.md   # 须存在
```

### References

- [PRD §5.2] Post-init 引导：stdout 输出 /bmad-help 提示
- [PRD §5.13] Post-init 引导（必须实现）：stdout 提示、模板含 bmad-help、speckit.constitution
- [ARCH §3.2] init 流程状态机、Post-init 引导
- [Epics] Epic 12 Story 12.4 完整描述
- [Story 10.1] 非本 Story 范围表：Post-init 引导推迟至 Story 12.4

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
