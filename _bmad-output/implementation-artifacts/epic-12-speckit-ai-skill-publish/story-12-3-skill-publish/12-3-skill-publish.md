# Story 12.3: skill-publish

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

作为 Speckit 用户，
我需要在 init 时将 `_bmad/skills/` 按所选 AI 的 configTemplate.skillsDir 同步到对应全局目录，并支持 `--ai-skills`/`--no-ai-skills` 开关、在 initLog 中记录发布结果、当所选 AI 无子代理支持时在 init/check 输出明确提示，
以便 BMAD/Speckit 技能能在多 AI 助手（Cursor、Claude、Gemini 等）的全局 skills 目录中可用，且用户能识别无法运行全流程（party-mode、code-reviewer、mcp_task 等）的 AI 并提前知晓。

## 依赖

- **E12.2**：引用完整性（按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录；本 Story 依赖其已实现的 configTemplate 解析与 selectedAI 机制）
- **E10.1**：交互式 init 核心（Banner、AI 选择、路径确认、配置持久化；本 Story 依赖 init 主流程与 writeSelectedAI 等钩子）

## 验收标准

### AC-1：Skill 同步到 configTemplate.skillsDir

| ID | 场景 | 前提 | 动作 | 预期 |
|----|------|------|------|------|
| 1 | 有 skillsDir 的 AI | selectedAI 的 configTemplate 含 skillsDir（如 cursor-agent→`~/.cursor/skills`、claude→`~/.claude/skills`） | init 完成 | `_bmad/skills/`（或 bmadPath 的 skills）下全部子目录已同步到 configTemplate.skillsDir 所指全局目录 |
| 2 | worktree 共享 | init 时指定 `--bmad-path <path>` | init 完成 | skills 源从 bmadPath 指向目录的 `skills/` 子目录读取，同步到所选 AI 的 skillsDir |
| 3 | 目标目录不存在 | skillsDir 指向路径（如 `~/.cursor/skills`）不存在 | 同步执行 | 自动创建目标目录及必要父目录，完成同步 |

### AC-2：initLog 结构与 skillsPublished/skippedReasons

| ID | 场景 | 前提 | 动作 | 预期 |
|----|------|------|------|------|
| 1 | 成功发布 | AI 含 skillsDir，`--no-ai-skills` 未指定 | init 完成 | `_bmad-output/config/bmad-speckit.json` 的 `initLog.skillsPublished` 含已发布 skill 名称列表（如 `["speckit-workflow","bmad-bug-assistant",...]`） |
| 2 | AI 不支持 skill | configTemplate 无 skillsDir 或 skillsDir 为空 | init 完成 | `initLog.skippedReasons` 含对应条目，说明该 AI 不支持全局 skill；`skillsPublished` 为空数组或省略 |
| 3 | initLog 结构 | init 完成 | 读取 bmad-speckit.json | initLog 含 `timestamp`（ISO 8601）、`selectedAI`、`templateVersion`、`skillsPublished`；存在跳过时含 `skippedReasons` |

### AC-3：--ai-skills 与 --no-ai-skills

| ID | 场景 | 前提 | 动作 | 预期 |
|----|------|------|------|------|
| 1 | 默认执行 | init 未传 `--no-ai-skills` | init 完成 | 执行 skill 发布步骤，initLog 含 skillsPublished 或 skippedReasons |
| 2 | 显式启用 | init 传 `--ai-skills` | init 完成 | 执行 skill 发布步骤（与默认一致） |
| 3 | 显式跳过 | init 传 `--no-ai-skills` | init 完成 | 不执行 skill 发布，initLog 中 skillsPublished 为空数组或省略，skippedReasons 含「用户指定 --no-ai-skills 跳过」或等价描述 |

### AC-4：无子代理支持 AI 时的 init/check 提示

| ID | 场景 | 前提 | 动作 | 预期 |
|----|------|------|------|------|
| 1 | init 时所选 AI 无子代理 | selectedAI 的 configTemplate.subagentSupport 为 `none` 或 `limited` | init 完成 | stdout 输出提示：所选 AI 不支持或仅部分支持子代理，BMAD/Speckit 全流程（party-mode、code-reviewer、mcp_task 等）可能无法正常运行；建议使用支持子代理的 AI（如 cursor-agent、claude） |
| 2 | check 时所选 AI 无子代理 | 项目已 init，bmad-speckit.json 的 selectedAI 对应 configTemplate.subagentSupport 为 `none` 或 `limited` | 执行 `bmad-speckit check` | check 输出含子代理支持等级及上述提示 |

### AC-5：同步内容与 PRD §5.12 发布目标映射一致

| ID | 场景 | 前提 | 动作 | 预期 |
|----|------|------|------|------|
| 1 | 发布内容 | `_bmad/skills/` 含 speckit-workflow、bmad-bug-assistant 等子目录 | init 完成 | 全部子目录已同步到所选 AI 的 skillsDir，目录结构保持（如 `~/.cursor/skills/speckit-workflow/`、`~/.cursor/skills/bmad-bug-assistant/`） |
| 2 | 按 configTemplate | 不同 AI 的 skillsDir 不同（cursor→`~/.cursor/skills`、claude→`~/.claude/skills` 等） | init 选择不同 AI | 同步到对应 AI 的 configTemplate.skillsDir，禁止写死 `.cursor/skills` |

## Tasks / Subtasks

- [ ] **T1**：实现 SkillPublisher 模块（AC: 1, 5）
  - [ ] T1.1 定义 SkillPublisher.publish({ sourceDir, targetDir, selectedAI, configTemplate }) 或等价接口
  - [ ] T1.2 从 `_bmad/skills/` 或 bmadPath 的 `skills/` 读取源，按 configTemplate.skillsDir 解析目标路径（支持 `~` 展开）
  - [ ] T1.3 递归复制/同步全部子目录到目标目录，保持目录结构
  - [ ] T1.4 目标目录不存在时创建；写入前校验 configTemplate 含 skillsDir

- [ ] **T2**：init 流程集成 skill 发布（AC: 1, 2, 3）
  - [ ] T2.1 在 init 主流程（init-skeleton 或 init.js）中，commands/rules/config 同步完成后、写入 initLog 前，按 `--ai-skills`/`--no-ai-skills` 决定是否调用 SkillPublisher
  - [ ] T2.2 默认（未传 `--no-ai-skills`）执行 skill 发布；`--no-ai-skills` 时跳过并记录 skippedReasons
  - [ ] T2.3 发布成功后收集已发布 skill 名称列表，写入 initLog.skillsPublished
  - [ ] T2.4 AI 无 skillsDir 时写入 initLog.skippedReasons，不抛出错误

- [ ] **T3**：initLog 扩展（AC: 2）
  - [ ] T3.1 在 writeSelectedAI 或 ConfigManager.setAll 调用中，扩展 initLog 结构：timestamp、selectedAI、templateVersion、skillsPublished、skippedReasons（可选）
  - [ ] T3.2 与 Story 10.4 的 initLog 写入逻辑一致，本 Story 扩展 skillsPublished 与 skippedReasons 字段

- [ ] **T4**：无子代理支持时的 init/check 提示（AC: 4）
  - [ ] T4.1 在 init 完成、输出 post-init 引导前，若 configTemplate.subagentSupport 为 `none` 或 `limited`，stdout 输出提示文本（含子代理支持等级及全流程兼容性说明）
  - [ ] T4.2 在 check 子命令输出中，增加「子代理支持等级」段；当 selectedAI 对应 subagentSupport 为 `none` 或 `limited` 时，输出与 init 一致的提示

- [ ] **T5**：E2E 与集成测试（AC: 全部）
  - [ ] T5.1 E2E：init --ai cursor-agent --yes 后，`~/.cursor/skills/`（或项目内等价路径）含 speckit-workflow、bmad-bug-assistant 等子目录
  - [ ] T5.2 E2E：init --ai cursor-agent --yes --no-ai-skills 后，skills 未同步，initLog.skippedReasons 含对应说明
  - [ ] T5.3 E2E：init --ai <无子代理支持的AI> 后，stdout 含子代理提示
  - [ ] T5.4 单元测试：SkillPublisher.publish 空目录、单目录、多级目录、目标不存在、configTemplate 无 skillsDir 等场景

## Dev Notes

### 架构约束

- **SkillPublisher**：按 PRD §5.12、ARCH 组件映射，本 Story 实现 SkillPublisher 模块；与 init-skeleton、ConfigManager 集成
- **configTemplate 来源**：由 Story 12.1 的 AIRegistry 提供；configTemplate 含 skillsDir、subagentSupport；本 Story 仅消费，不修改 registry
- **按所选 AI 写入**：禁止写死 `.cursor/` 或单一 AI 目录；目标路径由 configTemplate.skillsDir 决定

### 源文件与目录

- **技能源**：`_bmad/skills/` 或 `bmadPath/skills/`（worktree 共享时）
- **目标**：configTemplate.skillsDir，如 `~/.cursor/skills`、`~/.claude/skills`（需展开 `~` 为实际用户目录）
- **配置**：`_bmad-output/config/bmad-speckit.json` 的 initLog

### 与 Story 12.1、12.2 的边界

| 功能 | 归属 | 说明 |
|------|------|------|
| configTemplate 含 skillsDir、subagentSupport | Story 12.1 | Story 12.1 已实现 |
| commands/rules/config 同步到 AI 目标目录 | Story 12.2 | Story 12.2 负责 |
| skills 按 configTemplate.skillsDir 同步 | 本 Story | 本 Story 实现 |
| initLog 扩展 skillsPublished、skippedReasons | 本 Story | 与 Story 10.4 的 initLog 基础结构兼容 |
| check 按 selectedAI 验证目标目录 | Story 12.2、13.1 | 本 Story 仅增加子代理支持提示输出 |

### PRD/ARCH 追溯

| 来源 | 章节 | 内容 |
|------|------|------|
| PRD | §5.12 | 全局 Skill 发布、initLog 结构、skillsPublished、skippedReasons |
| PRD | §5.12.1 | 子代理支持、无子代理时 init/check 提示 |
| PRD | §5.10 | _bmad/skills/ 结构、同步步骤 |
| PRD | 表 --ai-skills | 默认执行，--no-ai-skills 跳过 |
| ARCH | SkillPublisher | 按 configTemplate.skillsDir 同步、initLog |
| Epics | 12.3 | Skill 发布、initLog、--ai-skills/--no-ai-skills、无子代理提示 |

### 测试标准

- 使用项目现有 E2E 框架（如 `packages/bmad-speckit/tests/e2e/`）
- 验收命令：init 后检查 `~/.cursor/skills/`（或对应 AI 的 skillsDir）存在且含预期子目录；读取 bmad-speckit.json 验证 initLog 结构
- 禁止伪实现：必须实际执行文件复制/同步，不得仅写占位或 mock

### 禁止词自检

本 Story 文档不含：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
