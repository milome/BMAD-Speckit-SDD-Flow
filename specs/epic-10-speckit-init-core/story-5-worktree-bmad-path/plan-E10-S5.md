# plan-E10-S5：--bmad-path worktree 共享实现方案

**Epic**：E10 speckit-init-core  
**Story ID**：10.5  
**输入**：spec-E10-S5.md、10-5-worktree-bmad-path.md

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story 陈述 | §1 概述 | Phase 1–6、§4 | ✅ |
| AC-1 init --bmad-path 不复制 _bmad | spec §3 AC-1 | Phase 1、2 | ✅ |
| AC-2 bmadPath 写入项目级配置 | spec §3 AC-2 | Phase 3 | ✅ |
| AC-3 check 验证 bmadPath | spec §3 AC-3 | Phase 4 | ✅ |
| AC-4 path 不存在或结构不符合时 init 退出码 4 | spec §3 AC-4 | Phase 1、5 | ✅ |
| 本 Story 范围 | spec §2.1 | Phase 1–6 | ✅ |
| 架构约束 InitCommand/CheckCommand/ConfigManager/结构验证/退出码 | spec §4 | Phase 1–6、§5 | ✅ |
| CLI 参数 --bmad-path | spec §5 | Phase 1 | ✅ |

---

## 2. 目标与约束

- **目标**：实现 init 的 `--bmad-path <path>` worktree 共享模式（不复制 _bmad，仅创建 _bmad-output，从 path 同步 commands/rules/skills）；将 bmadPath 写入项目级 bmad-speckit.json（经 ConfigManager）；实现或扩展 check 子命令在存在 bmadPath 时验证指向目录存在且结构符合清单；path 不存在或结构不符合时 init 退出码 4。
- **约束**：--bmad-path 须与 --ai、--yes 配合（或非 TTY 自动 --yes）；结构验证清单与 check 复用同一逻辑，参数为根路径；使用 exit-codes.js 的 TARGET_PATH_UNAVAILABLE（4）；不新增独立写 bmad-speckit.json 逻辑，统一经 ConfigManager。
- **必须包含**：集成测试与 E2E（init --bmad-path 不创建 _bmad、写入 bmadPath；path 不存在/结构不符合时退出码 4；check 在 bmadPath 存在时验证指向路径、通过/失败退出码；生产路径中 init 与 check 均调用结构验证与 ConfigManager）。

---

## 3. 实施分期

### Phase 1：结构验证共享与 init --bmad-path 解析与前置校验（AC-1、AC-4）

1. **结构验证共享**：新增 `src/utils/structure-validate.js`（或 `src/services/`），实现 `validateBmadStructure(rootPath)`：校验 rootPath 存在且为目录、可读；校验含 core/、cursor/、speckit/、skills/ 至少其二；若 cursor 存在则校验含 commands/、rules/；返回 `{ valid, missing }` 或等价；供 init 与 check 复用。
2. **bin/bmad-speckit.js**：init 命令增加 `.option('--bmad-path <path>', 'Shared _bmad path (worktree mode, no copy)')`。
3. **init.js**：解析 `options.bmadPath`（commander 通常将 --bmad-path 转为 options.bmadPath）。若存在则进入 worktree 分支：校验须与 --ai、--yes 配合（或 nonInteractive 已为 true）；否则报错「--bmad-path requires --ai and --yes for non-interactive use」并退出。
4. **init.js**：在创建 _bmad-output 或写入配置前，将 path 解析为绝对路径（path.resolve）；调用 validateBmadStructure(resolvedPath)；若路径不存在或 valid 为 false，输出明确错误（路径不存在或列出 missing），process.exit(exitCodes.TARGET_PATH_UNAVAILABLE)。
5. **验收**：init --bmad-path /nonexistent --ai cursor-agent --yes => 退出码 4；init --bmad-path <空目录> --ai cursor-agent --yes => 退出码 4 并列出缺失项；init --bmad-path <有效_bmad 根> --ai cursor-agent --yes => 通过校验进入 Phase 2。

### Phase 2：worktree 分支仅创建 _bmad-output 与 AI 同步（AC-1）

1. **init.js**：当 --bmad-path 有效且通过校验后，不调用 fetchTemplate + generateSkeleton（不拉取模板、不复制 _bmad）；仅创建 targetPath 下 _bmad-output 目录结构（含 config/）；AI 目标目录（如 .cursor/、.claude/）从 bmadPath 指向目录的 cursor/ 等同步（复制或链接依 PRD：从 path 的 cursor/、skills/ 等读取）。
2. **init-skeleton.js 或新逻辑**：提供 worktree 专用流程：创建 _bmad-output、config/；从 bmadPath 同步 commands、rules、skills 到项目内 AI 目录（如 .cursor/commands、.cursor/rules；.claude 等依 selectedAI）；不创建 _bmad。
3. **init.js**：worktree 分支仍写入 selectedAI、templateVersion、initLog 到 bmad-speckit.json（通过 writeSelectedAI 或等价），并在同流程写入 bmadPath（Phase 3）。
4. **验收**：init --bmad-path <有效路径> --ai cursor-agent --yes 后，项目内无 _bmad；存在 _bmad-output/config/；.cursor/ 等存在且内容来自 bmadPath 的 cursor/。

### Phase 3：bmadPath 写入项目配置（AC-2）

1. **init.js / init-skeleton.js**：在 worktree 分支成功创建 _bmad-output 后，将 bmadPath（已解析的绝对路径）通过 ConfigManager 写入项目级。即 configManager.set('bmadPath', resolvedPath, { scope: 'project', cwd: targetPath }) 或 setAll 合并 { bmadPath: resolvedPath } 与现有 selectedAI、templateVersion、initLog。
2. **写入时机**：与 writeSelectedAI 合并为一次 setAll，或先 writeSelectedAI 再 set('bmadPath', ...)，确保不覆盖已有键。
3. **验收**：init --bmad-path /abs/path/to/_bmad --ai cursor-agent --yes 完成后，_bmad-output/config/bmad-speckit.json 含 bmadPath 为规范绝对路径；selectedAI、templateVersion、initLog 仍在。

### Phase 4：check 在 bmadPath 存在时验证指向目录（AC-3）

1. **check 子命令**：若项目中尚无 check 实现，则新增 `src/commands/check.js` 并注册于 bin；若已有则扩展。check 读取项目级 bmad-speckit.json（ConfigManager.get 或直接读 _bmad-output/config/bmad-speckit.json）。
2. **分支逻辑**：若配置含 bmadPath，则跳过项目内 _bmad 存在性校验；验证 bmadPath 指向目录存在且可读；调用 validateBmadStructure(bmadPath)；不符合则输出错误、列出缺失项，process.exit(4)（或 1，与 PRD 约定一致；本 plan 采用 4 与 init 一致）。
3. **无 bmadPath**：若不含 bmadPath，则按现有或默认 check 逻辑验证项目内 _bmad（若存在）；本 Story 可只实现「有 bmadPath 时」分支，无 bmadPath 时退出码 0 或跳过结构校验。
4. **验收**：bmad-speckit.json 含 bmadPath 且路径有效、结构符合 => check 退出码 0；bmadPath 指向不存在 => check 退出码 4；结构不符合 => 退出码 4 并列出缺失项。

### Phase 5：退出码与错误信息（AC-4）

1. **init.js**：--bmad-path 校验失败（路径不存在、结构不符合、缺 --ai/--yes）时统一使用 exitCodes.TARGET_PATH_UNAVAILABLE（4）；错误信息明确包含「路径不存在」或「结构不符合」及缺失项。
2. **check.js**：bmadPath 验证失败时 process.exit(4)。
3. **验收**：stderr 输出可被脚本解析；退出码 4 与文档一致。

### Phase 6：集成与回归

1. **单元测试**：validateBmadStructure 在临时目录下覆盖「存在且符合」「缺少子目录」「路径不存在」；ConfigManager 写入 bmadPath 后读回；init --bmad-path 与 --ai、--yes 组合。
2. **集成**：init --bmad-path <有效> --ai cursor-agent --yes => 无 _bmad、有 _bmad-output、bmadPath 写入；随后 check => 退出码 0；修改 bmadPath 为不存在路径后 check => 退出码 4。
3. **生产路径**：grep 确认 init.js 在 worktree 分支调用 validateBmadStructure、ConfigManager.set/setAll；check 命令在 bin 注册且调用 structure-validate 与 ConfigManager。

---

## 4. 集成测试与端到端功能测试计划（必须）

### 4.1 init --bmad-path 与 check

| 测试类型 | 测试内容 | 命令/入口 | 预期 |
|----------|----------|-----------|------|
| 单元 | validateBmadStructure 路径不存在 | 传入不存在的路径 | valid: false 或等价，missing 或错误 |
| 单元 | validateBmadStructure 结构不符合 | 传入空目录或缺 core/cursor/speckit/skills | valid: false，列出缺失 |
| 单元 | validateBmadStructure 符合 | 传入含 core、cursor 的目录 | valid: true |
| 集成 | init --bmad-path 不存在 | init --bmad-path /nonexistent --ai cursor-agent --yes | 退出码 4，stderr 含路径不存在或结构不符合 |
| 集成 | init --bmad-path 结构不符合 | init --bmad-path <空目录> --ai cursor-agent --yes | 退出码 4，列出缺失项 |
| 集成 | init --bmad-path 有效 | init --bmad-path <有效_bmad 根> --ai cursor-agent --yes | 退出码 0，无 _bmad，有 _bmad-output，bmad-speckit.json 含 bmadPath |
| 集成 | 缺 --ai 或 --yes 报错 | init --bmad-path <path>（TTY，无 --ai --yes） | 报错须与 --ai、--yes 配合 |
| 集成 | check bmadPath 有效 | 已 init --bmad-path 的项目，运行 check | 退出码 0 |
| 集成 | check bmadPath 不存在 | bmad-speckit.json 中 bmadPath 改为不存在路径，运行 check | 退出码 4 |
| E2E | 完整 worktree 流程 | 在临时目录 init --bmad-path <共享_bmad> --ai cursor-agent --yes，再 check | 无 _bmad，有 bmadPath，check 通过 |

### 4.2 生产代码关键路径验证

- **init.js**：worktree 分支中调用 validateBmadStructure、ConfigManager.set/setAll(bmadPath)；验收：grep 确认 --bmad-path 解析、校验、worktree 分支不调用 generateSkeleton 的 _bmad 复制。
- **check.js**：读取 bmad-speckit.json、若 bmadPath 存在则调用 validateBmadStructure(bmadPath)；验收：grep 确认 check 命令注册、config-manager 或 bmad-speckit.json 被读取、structure-validate 被调用。
- **structure-validate.js**：被 init 与 check 引用；验收：grep 确认两处 require/import。

---

## 5. 模块与文件改动设计

### 5.1 新增文件

| 文件 | 说明 |
|------|------|
| packages/bmad-speckit/src/utils/structure-validate.js | validateBmadStructure(rootPath)：存在性、可读性、core/cursor/speckit/skills 至少其二、cursor 含 commands/rules；返回 { valid, missing } |
| packages/bmad-speckit/src/commands/check.js | check 子命令：读项目级配置，若 bmadPath 存在则验证指向目录，否则可跳过或验证项目内 _bmad；退出码 0/4 |

### 5.2 修改文件

| 文件 | 变更 | 说明 |
|------|------|------|
| packages/bmad-speckit/bin/bmad-speckit.js | 增加 --bmad-path；注册 check 子命令并 action(checkCommand) | CLI 入口 |
| packages/bmad-speckit/src/commands/init.js | 解析 --bmad-path；校验 --ai/--yes；调用 validateBmadStructure；worktree 分支不 fetchTemplate/generateSkeleton，仅创建 _bmad-output 与从 bmadPath 同步 AI 目录；写入 bmadPath 经 ConfigManager | 核心 init 逻辑 |
| packages/bmad-speckit/src/commands/init-skeleton.js | 可选：新增 worktreeSkeleton(targetPath, bmadPath, selectedAI) 或等价，只创建 _bmad-output、config/，从 bmadPath 同步 cursor/ 等到 .cursor/ 等 | 与 init.js worktree 分支配合 |
| packages/bmad-speckit/tests/ | 新增或扩展：structure-validate 单元测试；init --bmad-path 集成/E2E；check bmadPath 集成/E2E | 覆盖 §4.1、§4.2 |

### 5.3 依赖关系

- Phase 1 先行（结构验证 + init 解析与校验）。
- Phase 2 依赖 Phase 1 的校验通过；Phase 3 与 Phase 2 同流程内完成（写入 bmadPath）。
- Phase 4 依赖 Phase 1 的 validateBmadStructure；check 命令可在 Phase 1 后实现，与 init 并行或紧随。
- Phase 5 贯穿 Phase 1、4；Phase 6 依赖 Phase 1–5。

<!-- AUDIT: PASSED by code-reviewer -->
