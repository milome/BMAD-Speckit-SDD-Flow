# Story 13.1: check 与 version 子命令

Status: ready-for-dev

<!-- 验证：运行 validate-create-story 进行质量检查后再执行 dev-story。 -->

## Story

作为开发者，
我希望运行 `check` 和 `version` 诊断当前环境，
以便确认 AI 工具、CLI 版本、模板版本是否安装正确且结构完整。

## Acceptance Criteria

1. **AC1** `check` 子命令输出诊断报告，包含：已安装的 AI 工具（通过 detectCommand 检测）、CLI 版本、模板版本、关键环境变量；支持 `--json` 结构化输出。
2. **AC2** `check --list-ai` 输出可用 AI 列表（内置 19+ + 用户/项目 registry 合并结果），供 `--ai` 无效时提示用户参考；支持 `--json`。
3. **AC3** `version` 子命令输出 CLI 版本、模板版本、Node 版本；支持 `--json`。
4. **AC4** `check` 执行结构验证：读取 `_bmad-output/config/bmad-speckit.json`，按 §5.5 验证清单逐项校验；验证失败时列出缺失项并退出码 1，全部通过时退出码 0；便于 CI 脚本通过 `$?` 或 `exitCode` 判断。
5. **AC5** 结构验证清单：`_bmad` 存在且含 `core/`、`cursor/`、`speckit/`、`skills/` 至少其二；当存在 `bmadPath` 时改为验证 `bmadPath` 指向目录（worktree 共享模式），不要求项目内存在 `_bmad`；`_bmad/cursor/` 存在时含 `commands/`、`rules/`；`_bmad-output` 存在且含 `config/`。
6. **AC6** 按 `selectedAI` 验证所选 AI 目标目录（映射表见 Dev Notes）；若项目未 init（无 `bmad-speckit.json`）：跳过 AI 目标目录验证；若 `bmad-speckit.json` 存在但无 `selectedAI`：验证 `.cursor` 作为向后兼容默认。
7. **AC7** `check --ignore-agent-tools` 时跳过 AI 工具（detectCommand）检测。
8. **AC8** `check` 输出所选 AI 的子代理支持等级（`subagentSupport`：`native`|`mcp`|`limited`|`none`）；若为 `none` 或 `limited`，提示「全流程（party-mode、审计子任务等）可能不可用」。
9. **AC9** 退出码约定：成功 0，结构验证失败 1；与 PRD §5.2、架构 exit-codes 一致。退出码 2（--ai 无效）、3（网络/模板）、4（路径不可用）由 Story 13.2 负责；退出码 5（离线 cache 缺失）由 Story 11.2 负责，本 Story 仅实现 0/1。

## Tasks / Subtasks

- [ ] **Task 1**：实现 VersionCommand（AC: #3）
  - [ ] 1.1 新增 `src/commands/version.js`，注册 `version` 子命令
  - [ ] 1.2 读取 CLI 版本（package.json）、模板版本（bmad-speckit.json 或 bmadPath 指向目录）、Node 版本
  - [ ] 1.3 支持 `--json` 输出
- [ ] **Task 2**：实现 CheckCommand 基础与诊断输出（AC: #1, #2, #7, #8）
  - [ ] 2.1 新增 `src/commands/check.js`，注册 `check` 子命令
  - [ ] 2.2 实现诊断输出：已安装 AI 工具（detectCommand 检测，`--ignore-agent-tools` 时跳过）、CLI 版本、模板版本、环境变量；支持 `--json`
  - [ ] 2.3 实现 `check --list-ai`：加载 AIRegistry（内置 + 用户/项目），输出合并列表；支持 `--json`
  - [ ] 2.4 输出所选 AI 的 subagentSupport 等级；为 `none`/`limited` 时输出提示
- [ ] **Task 3**：实现 CheckCommand 结构验证（AC: #4, #5, #6, #9）
  - [ ] 3.1 实现 §5.5 验证清单：`_bmad`/`bmadPath`、`_bmad-output`、`_bmad/cursor` 子目录
  - [ ] 3.2 实现按 selectedAI 验证目标目录：根据 configTemplate 映射表逐项校验（cursor-agent→.cursor/、claude→.claude/、gemini→.gemini/、windsurf→.windsurf/workflows、kilocode→.kilocode/rules、auggie→.augment/rules、roo→.roo/rules、opencode→.opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands 等）
  - [ ] 3.3 无 selectedAI 时：项目未 init 则跳过 AI 目标目录验证；有 bmad-speckit.json 但无 selectedAI 时验证 `.cursor` 作为向后兼容默认
  - [ ] 3.4 worktree 共享模式：当 bmad-speckit.json 含 `bmadPath` 时，验证 `bmadPath` 指向目录存在且结构符合清单
  - [ ] 3.5 验证失败时列出缺失项，退出码 1；成功退出码 0

## Dev Notes

### selectedAI → 目标目录映射表（PRD §5.5、§5.12）

| selectedAI | 根目录 | 必须含子目录 |
|------------|--------|--------------|
| cursor-agent | `.cursor/` | `commands/`、`rules/` 或 `agents/` 至少其一 |
| claude | `.claude/` | `commands/` 或 `rules/` 至少其一 |
| gemini | `.gemini/` | `commands/` |
| windsurf | `.windsurf/` | `workflows/` |
| kilocode | `.kilocode/` | `rules/` |
| auggie | `.augment/` | `rules/` |
| roo | `.roo/` | `rules/` |
| opencode | `.opencode/` | `command/`（单数，spec-kit 约定） |
| bob | `.bob/` | `commands/` |
| shai | `.shai/` | `commands/` |
| codex | `.codex/` | `commands/` |
| 其他 AI | 按 configTemplate.commandsDir / rulesDir 解析 | 根目录存在 |

### 架构与依赖

- **CheckCommand**、**VersionCommand**：架构 §3.2 明确职责；与 InitCommand、AIRegistry、ConfigManager 协同。
- **依赖 E10.1**：init 核心（bmad-speckit.json、selectedAI、bmadPath、configTemplate）须已实现；CheckCommand 读取项目级配置与 AIRegistry。
- **constants/exit-codes.js**：退出码 0、1 与 PRD §5.2 一致。退出码 2（--ai 无效）、3（网络/模板）、4（路径不可用）由 Story 13.2（异常路径）负责，路径 `_bmad-output/implementation-artifacts/epic-13-speckit-diagnostic-commands/story-13-2-exception-paths/`，scope 含网络超时、模板失败、--bmad-path 路径不可用及对应退出码 2/3/4；退出码 5（--offline cache 缺失）由 Story 11.2 负责。

### 禁止写死目录

- 禁止写死 `.cursor/`；所有目标目录由 configTemplate 或上表映射决定。
- 与 E12 引用完整性、spec-kit AGENTS.md 对齐。

### 文件路径约定

- 项目级配置：`<project>/_bmad-output/config/bmad-speckit.json`
- worktree 共享：该文件含 `bmadPath` 时，验证 `bmadPath` 指向的 `_bmad` 根目录。

### Project Structure Notes

- 对齐 `bmad-speckit` 包结构：`src/commands/check.js`、`src/commands/version.js`
- 复用 `AIRegistry`、`ConfigManager`、`constants/exit-codes.js`、`constants/ai-builtin.js`

### References

- [Source: PRD_specify-cn-like-init-multi-ai-assistant.md §5.5 check 与 version]
- [Source: PRD §5.5 check 结构验证清单]
- [Source: PRD §5.12.1 子代理支持]
- [Source: ARCH_specify-cn-like-init-multi-ai-assistant.md §3.2 CheckCommand、VersionCommand]
- [Source: epics.md Epic 13 Story 13.1]
- [Source: PRD US-5 check 与 version 子命令]
- [Source: epics.md Story 13.2 异常路径、退出码 2/3/4/5]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
