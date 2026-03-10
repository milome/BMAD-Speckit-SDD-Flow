# Plan E12-S4: Post-init 引导实现方案

**Epic**: 12 - Speckit AI Skill Publish  
**Story**: 12.4 - Post-init 引导  
**输入**: spec-E12-S4.md, 12-4-post-init-guide.md, PRD, ARCH

---

## 1. 概述

本 plan 定义 Story 12.4（Post-init 引导）的实现方案：扩展现有 init 成功消息为完整 Post-init 引导文案（含 /bmad-help、speckit.constitution）；确保模板源（_bmad 或 GitHub tarball）含 bmad-help、speckit.constitution 命令文件；init 失败时不输出引导。

---

## 2. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| PRD §5.2 | spec §3.1 | Phase 1 | ✅ |
| PRD §5.13 | spec §3.1–3.3 | Phase 1、Phase 2、Phase 3 | ✅ |
| ARCH §3.2 | spec §3.1 | Phase 1 | ✅ |
| Story AC-1 | spec §3.1 | Phase 1、集成测试 | ✅ |
| Story AC-2 | spec §3.2 | Phase 2、验收测试 | ✅ |
| Story AC-3 | spec §3.3 | Phase 3、验收测试 | ✅ |
| Story AC-4 | spec §3.1 | Phase 1、集成测试 | ✅ |

---

## 3. 技术架构

### 3.1 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| InitCommand | `src/commands/init.js` | 在三个流程（runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow）成功完成点，替换或扩展现有 grey 消息为完整 Post-init 引导文案 |
| 模板源 | `_bmad/cursor/commands/` 或 GitHub tarball | 须含 bmad-help.md、speckit.constitution.md（本 Story 负责补齐或文档约束） |

### 3.2 数据流

```
init 流程成功完成:
  generateSkeleton / createWorktreeSkeleton
       ↓
  SyncService.syncCommandsRulesConfig
       ↓
  SkillPublisher.publish (Story 12.3)
       ↓
  writeSelectedAI
       ↓
  generateScript
       ↓
  runGitInit (若未 --no-git)
       ↓
  maybePrintSubagentHint (若有)
       ↓
  输出 Post-init 引导（chalk.gray，含 /bmad-help、speckit.constitution）
       ↓
  进程正常退出

init 流程失败:
  catch 块 → 输出错误 → process.exit → 不输出 Post-init 引导
```

### 3.3 集成测试与端到端测试计划（必须）

| 测试类型 | 覆盖内容 | 验收方式 |
|---------|---------|---------|
| **集成测试** | `bmad-speckit init --ai cursor --yes` 成功完成后 stdout 含 /bmad-help、speckit.constitution 提示 | 执行 init，断言 stdout 含预期文案 |
| **集成测试** | 非交互模式（--ai cursor --yes）同样输出 | 同上 |
| **集成测试** | init 失败（如网络错误、路径不可写）时 stdout 不含 Post-init 引导 | 模拟失败场景，断言无引导输出 |
| **端到端** | init 后目标项目 .cursor/commands/（或所选 AI 对应目录）存在 bmad-help、speckit.constitution | 执行 init，检查目标 commands 目录 |
| **集成/E2E** | `init --modules bmm,tea --ai cursor --yes` 后 commands 仍含 bmad-help、speckit.constitution（公共 commands 或所选模块 commands） | 执行 init --modules，验证目标 commands 目录 |
| **单元/集成** | Post-init 引导文案与 PRD 一致 | 断言文案含 `/bmad-help`、`speckit.constitution` |

---

## 4. 实现阶段（Phases）

### Phase 1: Post-init 引导 stdout 输出（AC-1, AC-4）

**目标**：在 InitCommand 三个流程成功完成点，输出完整 Post-init 引导文案。

**实现要点**：
1. 定义引导文案常量或内联：与 PRD §5.2、§5.13 一致，例如「Init 完成。建议在 AI IDE 中运行 `/bmad-help` 获取下一步指引，或运行 `speckit.constitution` 开始 Spec-Driven Development。」
2. 在 runWorktreeFlow、runNonInteractiveFlow、runInteractiveFlow 中，将现有 `console.log(chalk.gray('Run /bmad-help in your AI IDE for next steps.'));` 替换为上述完整文案
3. 确保引导仅在 try 块正常完成时执行；catch 块不输出引导

**产出**：修改 `packages/bmad-speckit/src/commands/init.js`

### Phase 2: 模板含 bmad-help 命令（AC-2）

**目标**：确保 init 使用的模板含 bmad-help 命令文件。

**实现要点**：
1. 若模板由本项目 _bmad 提供：检查 `_bmad/cursor/commands/` 是否存在；若无则创建 `_bmad/cursor/commands/bmad-help.md`，内容引用 `_bmad/core/tasks/help.md` 或 bmad-help 流程
2. 等效路径：`_bmad/core/commands/bmad-help.md`（若 SyncService 支持多源或模板规范约定）
3. Story 12.2 SyncService 仅复制 `cursor/commands/`；确保该目录存在且含 bmad-help.md
4. 若模板由外部 GitHub Release 提供：在模板规范文档（如 bmad-method 仓库 README 或 TEMPLATE_SPEC）中明确要求包含 bmad-help
5. **--modules 场景**（AC-2.2, T2.3）：若模板按模块拆分，bmad-help 须在公共 commands 或所选模块的 commands 中可用；与 Story 12.2 SyncService 的 --modules 逻辑对齐，确保 bmm/tea 等模块的 commands 含 bmad-help 或由公共 commands 提供

**产出**：`_bmad/cursor/commands/bmad-help.md`（若本项目提供）；或文档补充

### Phase 3: 模板含 speckit.constitution 命令（AC-3）

**目标**：确保 init 使用的模板含 speckit.constitution 命令文件。

**实现要点**：
1. 若模板由本项目 _bmad 提供：在 `_bmad/cursor/commands/speckit.constitution.md` 创建命令文件，内容触发 Spec-Driven Development 宪章阶段（可引用 speckit-workflow skill 或 constitution 流程）
2. 等效路径：`_bmad/speckit/commands/speckit.constitution.md`；若 SyncService 支持多源则配置；否则确保 cursor/commands 含该文件
3. 若模板由外部提供：在模板规范中明确要求包含 speckit.constitution
4. **--modules 场景**：若模板按模块拆分，speckit.constitution 须在公共 commands 或所选模块的 commands 中可用；与 Phase 2 对齐

**产出**：`_bmad/cursor/commands/speckit.constitution.md`（若本项目提供）；或文档补充

### Phase 4: 验收与文档（AC-1–4）

**目标**：E2E 验收、模板验收、更新文档。

**实现要点**：
1. 编写 E2E 验收：`bmad-speckit init --ai cursor --yes` 后 stdout 包含 /bmad-help、speckit.constitution 提示
2. 验收模板：init 后目标项目 .cursor/commands/ 存在 bmad-help、speckit.constitution
3. 更新 InitCommand 相关注释，说明 Post-init 引导的触发时机与输出内容

---

## 5. 依赖与边界

- **依赖**：Story 12.2 SyncService（commands 同步）、Story 12.3 SkillPublisher
- **模板来源**：Story 11.1 TemplateFetcher；bmad-method 仓库或本地 _bmad
- **不修改**：SyncService、SkillPublisher、TemplateFetcher 核心逻辑
