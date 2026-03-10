# Spec E12-S4: Post-init 引导

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.4 - Post-init 引导  
**输入**: 12-4-post-init-guide.md, PRD §5.2/§5.13, ARCH §3.2/§5.13

---

## 1. 概述

本 spec 定义 Story 12.4（Post-init 引导）的技术规格，覆盖：

- **stdout 输出 /bmad-help 提示**：init 流程全部完成后，在 stdout 输出简短提示，建议用户在 AI IDE 中运行 `/bmad-help` 或 `speckit.constitution` 获取下一步指引；init 失败时不输出
- **模板含 bmad-help**：init 使用的模板（_bmad 或 GitHub Release tarball）须包含 bmad-help 命令文件，经 Story 12.2 同步后用户可在所选 AI 目标目录执行
- **模板含 speckit.constitution**：init 使用的模板须包含 speckit.constitution 命令文件，经 Story 12.2 同步后用户可在所选 AI 目标目录执行 Spec-Driven Development 宪章阶段

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| PRD §5.2 | Post-init 引导：stdout 输出 /bmad-help 提示 | §3.1 | ✅ |
| PRD §5.13 | Post-init 引导（必须实现）：stdout 提示、模板含 bmad-help、speckit.constitution | §3.1, §3.2, §3.3 | ✅ |
| ARCH §3.2 | init 流程状态机：Post-init 引导（stdout 输出 /bmad-help 提示） | §3.1 | ✅ |
| ARCH §5.13 | init 完成后 stdout 输出 /bmad-help 提示 | §3.1 | ✅ |
| Story AC-1.1 | init 成功完成时 stdout 输出简短提示 | §3.1 | ✅ |
| Story AC-1.2 | 非交互模式（--ai cursor --yes）同样输出 | §3.1 | ✅ |
| Story AC-1.3 | 引导输出在 init 成功之后、进程退出之前；不覆盖错误输出 | §3.1 | ✅ |
| Story AC-2.1 | 模板源包含 bmad-help；_bmad/cursor/commands/ 或等效路径存在 | §3.2 | ✅ |
| Story AC-2.2 | --modules 场景：所选模块 commands 须含 bmad-help 或由公共 commands 提供 | §3.2 | ✅ |
| Story AC-3.1 | 模板源包含 speckit.constitution；cursor/commands/ 或 speckit 等效路径存在 | §3.3 | ✅ |
| Story AC-3.2 | speckit.constitution 可正常触发 Spec-Driven Development 宪章阶段 | §3.3 | ✅ |
| Story AC-4.1 | 执行顺序：骨架、git init、AI 同步成功后输出 Post-init 引导 | §3.1 | ✅ |
| Story AC-4.2 | init 失败时不输出 Post-init 引导；仅输出错误并退出 | §3.1 | ✅ |
| Epics 12.4 | Post-init 引导：stdout 提示、模板含 bmad-help、speckit.constitution | §3.1, §3.2, §3.3 | ✅ |

---

## 3. 技术规格

### 3.1 Post-init 引导 stdout 输出（AC-1, AC-4）

| 项目 | 规格 |
|------|------|
| **触发时机** | 骨架生成、git init（若未 --no-git）、AI 配置同步（Story 12.2）、Skill 发布（Story 12.3）全部成功后；进程退出前 |
| **不触发条件** | init 流程中任一步骤失败；仅输出错误信息并退出，不输出 Post-init 引导 |
| **输出位置** | stdout（console.log 或等效）；不写入文件 |
| **引导文案** | 与 PRD §5.2、§5.13 一致，例如：「Init 完成。建议在 AI IDE 中运行 `/bmad-help` 获取下一步指引，或运行 `speckit.constitution` 开始 Spec-Driven Development。」；允许与 maybePrintSubagentHint 的 grey 风格一致，使用 chalk.gray |
| **输出顺序** | 在 maybePrintSubagentHint（若有）之后、最终成功消息之后；或与最终成功消息合并为一段引导 |

**实现位置**：`packages/bmad-speckit/src/commands/init.js` 或 `packages/bmad-speckit/src/services/post-init-guide.js`（可内联于 init.js）

**调用点**：
- runWorktreeFlow 成功完成点
- runNonInteractiveFlow 成功完成点
- runInteractiveFlow 成功完成点

**当前实现**：init.js 已有 `console.log(chalk.gray('Run /bmad-help in your AI IDE for next steps.'));`，需扩展为含 speckit.constitution 的完整文案。

### 3.2 模板含 bmad-help 命令（AC-2）

| 项目 | 规格 |
|------|------|
| **源路径** | 模板（_bmad 或 tarball）中 `cursor/commands/bmad-help.md` 或 `cursor/commands/bmad-help`（无扩展名）；等效路径如 `_bmad/cursor/commands/bmad-help.md`、`_bmad/core/commands/bmad-help.md`（与原始 Dev Notes 一致） |
| **同步** | Story 12.2 SyncService 将 cursor/commands/ 复制到 configTemplate.commandsDir；本 Story 不实现同步，仅确保模板源含该文件 |
| **--modules 场景** | 若模板按模块拆分，bmad-help 须在公共 commands 或所选模块的 commands 中可用；若模板为单体，--modules 仅过滤子目录，commands 仍完整部署 |
| **模板来源** | 若由本项目 _bmad 提供，确保 `_bmad/cursor/commands/bmad-help.md` 存在；若由外部 GitHub Release 提供，在模板规范文档中明确要求包含 bmad-help |

**验证方式**：init 后目标项目中 `{configTemplate.commandsDir}`（如 .cursor/commands/）存在 bmad-help 命令文件。

### 3.3 模板含 speckit.constitution 命令（AC-3）

| 项目 | 规格 |
|------|------|
| **源路径** | 模板中 `cursor/commands/speckit.constitution.md` 或 `speckit/commands/speckit.constitution.md`；等效路径 |
| **同步** | Story 12.2 将 cursor/commands/ 或 speckit 等效路径内容复制到 configTemplate.commandsDir；本 Story 确保模板源含该文件 |
| **功能** | 命令可正常触发 Spec-Driven Development 宪章阶段，产出 constitution.md 或等效文档 |
| **模板来源** | 若由本项目 _bmad 提供，确保该命令文件存在；若由外部提供，在模板规范中明确要求 |

**验证方式**：init 后目标项目中 commands 目录存在 speckit.constitution 命令文件；Story 12.2 同步逻辑正确部署到所选 AI 目标目录。

---

## 4. InitCommand 集成

### 4.1 Post-init 引导调用逻辑

| 流程 | 成功完成点 | 引导调用 |
|------|-----------|----------|
| runWorktreeFlow | createWorktreeSkeleton → SyncService → SkillPublisher → writeSelectedAI → runGitInit 全部完成后 | 输出引导（替换或扩展现有 grey 消息） |
| runNonInteractiveFlow | 同上（worktree 或 fetchTemplate 路径） | 输出引导 |
| runInteractiveFlow | generateSkeleton → SyncService → SkillPublisher → writeSelectedAI → generateScript → runGitInit 全部完成后 | 输出引导 |

**约束**：引导仅在 try 块正常完成时执行；catch 块中不执行引导。

---

## 5. 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| init 主流程、Banner、AI 选择、模板拉取、骨架生成、git init | Story 10.1 | 本 Story 在 init 完成后追加引导输出 |
| 按 configTemplate 同步 commands 到 AI 目标目录 | Story 12.2 | 本 Story 仅确保模板源含 bmad-help、speckit.constitution |
| Skill 发布到 AI 全局目录 | Story 12.3 | — |
| feedback 子命令与 stdout 反馈入口提示 | Story 13.5 | 本 Story 仅输出 /bmad-help 相关引导 |
| 模板拉取、cache、--offline | Story 11.1、11.2 | Epic 11 负责 |

---

## 6. 跨平台与实现约束

- **输出**：使用 console.log；不写入文件
- **依赖**：chalk、path、fs（模板校验时）
- **禁止词**：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债
