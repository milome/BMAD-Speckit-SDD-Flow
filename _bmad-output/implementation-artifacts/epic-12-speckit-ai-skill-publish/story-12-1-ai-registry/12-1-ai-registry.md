# Story 12.1: AI Registry

Status: ready-for-dev

<!-- Note: Run validate-create-story for quality check before dev-story. -->

## Story

**As a** 使用 bmad-speckit 初始化的开发者，  
**I want** 通过全局与项目级 AI Registry 定义并扩展 AI 配置（含 19+ 内置 configTemplate、用户/项目 registry 覆盖），  
**so that** init 与 check 可按所选 AI 解析 configTemplate、验证目标目录、支持 generic 类型与自定义 AI，实现多 AI assistant 的配置抽象。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | §5.3 | Registry 文件：~/.bmad-speckit/ai-registry.json、项目级 _bmad-output/config/ai-registry.json；格式含 id、name、configTemplate、rulesPath、detectCommand、aiCommandsDir |
| PRD | §5.3.1 | configTemplate 结构：commandsDir、rulesDir、skillsDir、agentsDir/configDir、vscodeSettings；条件约束 |
| PRD | §5.9 | 配置路径：~/.bmad-speckit/ai-registry.json、_bmad-output/config/ai-registry.json |
| PRD | §5.12 | 19+ AI configTemplate 与 spec-kit AGENTS.md 对齐（opencode→.opencode/command、auggie→.augment/rules、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands） |
| PRD | §5.12.1 | configTemplate 含 subagentSupport；generic 须 --ai-commands-dir 或 registry 含 aiCommandsDir |
| ARCH | §3.2 | AIRegistry：加载内置 + 用户/项目 registry、解析 configTemplate |
| ARCH | §4.2 | configTemplate 结构、合并顺序：内置 → 用户 → 项目 |
| Epics | 12.1 | AI Registry：~/.bmad-speckit/ai-registry.json、项目级覆盖、19+ 内置 configTemplate、detectCommand、--ai generic 退出码 2 |

## 本 Story 范围

- **registry 存储与优先级**：`~/.bmad-speckit/ai-registry.json`（全局）、`<project>/_bmad-output/config/ai-registry.json`（项目级覆盖）；合并优先级：项目 > 全局 > 内置
- **19+ 内置 configTemplate**：与 spec-kit AGENTS.md 及 PRD §5.12 表对齐；opencode 用 `.opencode/command`（单数）、auggie 仅 `.augment/rules`、bob→`.bob/commands`、shai→`.shai/commands`、codex→`.codex/commands`
- **configTemplate §5.3.1 适用字段**：`commandsDir`、`rulesDir` 至少其一；`skillsDir` 若 AI 支持 skill 则必填；`agentsDir` 或 `configDir` 二选一；`vscodeSettings` 非必填
- **configTemplate §5.12.1 subagentSupport**：每 AI 含 `subagentSupport`：`native` | `mcp` | `limited` | `none`
- **detectCommand**：registry 条目可含 `detectCommand`，用于 check 检测是否已安装；可省略时 check 跳过该 AI 安装检测
- **aiCommandsDir（generic）**：`--ai generic` 时须 `--ai-commands-dir` 或 registry 含 `aiCommandsDir`，否则退出码 2
- **AIRegistry 模块**：加载内置 + 用户 + 项目 registry，合并后供 init 选择、check --list-ai 使用；校验 configTemplate 条件约束

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录 | Story 12.2 | 由 Story 12.2 负责；本 Story 仅提供 registry 与 configTemplate 数据源 |
| 若 configTemplate 含 vscodeSettings 写入 .vscode/settings.json | Story 12.2 | 由 Story 12.2 负责 |
| Skill 发布到 configTemplate.skillsDir | Story 12.3 | 由 Story 12.3 负责 |
| check 按 selectedAI 验证目标目录、输出子代理支持等级 | Story 13.1 | 由 Story 13.1 负责；本 Story 提供 registry 及 configTemplate 供 check 使用 |
| --ai 无效时输出可用 AI 列表或提示 run check --list-ai、退出码 2 | Story 13.1、10.1 | 由 Story 13.1/10.1 集成；本 Story 提供 getMergedRegistry() 供 check --list-ai 与 init --ai 校验调用 |

## Acceptance Criteria

### AC-1: registry 文件路径与优先级

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 全局 registry 存在 | `~/.bmad-speckit/ai-registry.json` 存在且 JSON 有效 | AIRegistry.load() | 加载用户自定义 AI 列表，与内置合并 |
| 2 | 项目级 registry 存在 | 当前目录下 `_bmad-output/config/ai-registry.json` 存在且 JSON 有效 | AIRegistry.load({ cwd }) | 项目级条目覆盖同 id 的全局/内置条目 |
| 3 | 优先级 | 同一 id 在内置、全局、项目级均存在 | 合并 | 项目级 > 全局 > 内置 |
| 4 | 文件缺失 | 全局或项目级 registry 文件不存在 | load | 不报错，对应来源为空数组；内置始终加载 |
| 5 | 文件无效 | registry 文件存在但 JSON 解析失败 | load | 抛出明确错误（含文件路径），便于用户修复 |

### AC-2: 19+ 内置 configTemplate 与 spec-kit 对齐

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | opencode | 内置 opencode 条目 | 读取 configTemplate | commandsDir 为 `.opencode/command`（单数） |
| 2 | auggie | 内置 auggie 条目 | 读取 configTemplate | 仅有 rulesDir 为 `.augment/rules`，无 commandsDir |
| 3 | bob | 内置 bob 条目 | 读取 configTemplate | commandsDir 为 `.bob/commands` |
| 4 | shai | 内置 shai 条目 | 读取 configTemplate | commandsDir 为 `.shai/commands` |
| 5 | codex | 内置 codex 条目 | 读取 configTemplate | commandsDir 为 `.codex/commands` |
| 6 | 全量覆盖 | PRD §5.12 发布目标映射表 | 内置 configTemplate | cursor-agent、claude、gemini、copilot、qwen、opencode、codex、windsurf、kilocode、auggie、roo、codebuddy、amp、shai、q、agy、bob、qodercli、cody、tabnine、kiro-cli、generic 共 22 项均含完整 configTemplate |
| 7 | 条件约束 | 每 AI 的 configTemplate | 校验 | commandsDir 与 rulesDir 至少其一；skillsDir 若 AI 支持 skill 则必填；agentsDir 与 configDir 二选一（同一 AI 仅填其一） |
| 8 | subagentSupport | 每 AI 的 configTemplate | 读取 | 含 subagentSupport：`native` | `mcp` | `limited` | `none`，与 PRD §5.12.1 表一致 |

### AC-3: registry 条目格式与扩展字段

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 基本字段 | registry 条目 | 解析 | 含 id、name；可含 description、configTemplate、rulesPath、detectCommand、aiCommandsDir |
| 2 | configTemplate | 用户/项目 registry 自定义 AI | 解析 | configTemplate 须满足 §5.3.1 条件约束；缺失时合并失败并报错 |
| 3 | detectCommand | registry 条目含 detectCommand | check 检测 | check 子命令使用该命令检测是否已安装；省略时 check 跳过该 AI 安装检测 |
| 4 | rulesPath | registry 条目含 rulesPath | 使用 | 指向规则文件路径；registry 中可省略，省略时使用内置默认 |

### AC-4: generic 类型与 --ai-commands-dir

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | generic 无 aiCommandsDir | 用户执行 `init --ai generic --yes` 且 registry 中 generic 无 aiCommandsDir、未传 --ai-commands-dir | init 校验 | 退出码 2，输出提示：须提供 --ai-commands-dir 或 registry 含 aiCommandsDir |
| 2 | generic 有 --ai-commands-dir | 用户执行 `init --ai generic --yes --ai-commands-dir ./my-commands` | init 校验 | 通过，使用该目录作为 commands 来源 |
| 3 | generic 有 registry aiCommandsDir | registry 中 generic 含 aiCommandsDir | init --ai generic --yes | 使用 registry 的 aiCommandsDir，无需 --ai-commands-dir |
| 4 | 退出码约定 | --ai generic 且无 aiCommandsDir 来源 | 任一子命令（init/check） | 退出码 2，与 PRD §5.2、ARCH §3.4 一致 |

### AC-5: AIRegistry 模块接口

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | load | 调用方传入 cwd（未传入时以 process.cwd() 为默认） | load({ cwd }) | 返回合并后的 AI 列表，每项含 id、name、configTemplate、subagentSupport 等完整字段 |
| 2 | getById | 传入 id | getById(id, { cwd }) | 返回该 id 的完整条目，不存在返回 null |
| 3 | listIds | — | listIds({ cwd }) | 返回所有可用 AI 的 id 数组，供 check --list-ai、--ai 无效时提示使用 |
| 4 | 合并逻辑 | 内置 + 用户 + 项目 | 合并 | 按 id 去重，项目覆盖全局覆盖内置；configTemplate 深度合并（项目级字段覆盖同名字段） |

## Tasks / Subtasks

- [ ] **T1**：实现 AIRegistry 模块（AC: 1, 5）
  - [ ] T1.1 新建 `src/services/ai-registry.js`，实现 load()、getById()、listIds()
  - [ ] T1.2 load() 读取 `~/.bmad-speckit/ai-registry.json`、`<cwd>/_bmad-output/config/ai-registry.json`（cwd 传入时），与内置列表合并；优先级：项目 > 全局 > 内置
  - [ ] T1.3 文件不存在时返回空数组，不抛错；JSON 解析失败时抛出含路径的错误
  - [ ] T1.4 合并时按 id 去重，同 id 时项目覆盖全局覆盖内置；configTemplate 深度合并

- [ ] **T2**：扩展 ai-builtin 为完整 configTemplate（AC: 2）
  - [ ] T2.1 在 `src/constants/ai-builtin.js` 或新建 `src/constants/ai-registry-builtin.js` 中定义 19+ AI 的完整 configTemplate
  - [ ] T2.2 按 PRD §5.12 表填充 commandsDir、rulesDir、skillsDir、agentsDir/configDir、vscodeSettings；满足 §5.3.1 条件约束
  - [ ] T2.3 按 PRD §5.12.1 表填充 subagentSupport：native|mcp|limited|none
  - [ ] T2.4 确保 opencode→.opencode/command、auggie→.augment/rules、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands 与 spec-kit 对齐

- [ ] **T3**：registry 文件格式与校验（AC: 3）
  - [ ] T3.1 定义 registry 文件格式：`{ "ais": [ { "id", "name", "configTemplate?", "rulesPath?", "detectCommand?", "aiCommandsDir?" } ] }` 或顶层数组
  - [ ] T3.2 用户/项目 registry 条目含 configTemplate 时，校验 commandsDir/rulesDir 至少其一、agentsDir/configDir 二选一、skillsDir 若支持则必填
  - [ ] T3.3 detectCommand 字段支持，供 Story 13.1 的 check 使用

- [ ] **T4**：generic 类型校验与退出码 2（AC: 4）
  - [ ] T4.1 在 init 与 check 的 --ai 校验逻辑中，当 --ai generic 时检查：--ai-commands-dir 已传 或 registry 中 generic 含 aiCommandsDir
  - [ ] T4.2 均不满足时，退出码 2，输出提示：须提供 --ai-commands-dir 或 registry 含 aiCommandsDir；可提示运行 `check --list-ai` 查看可用 AI

- [ ] **T5**：集成与测试（AC: 1-5）
  - [ ] T5.1 将 AIRegistry 接入 init.js 的 AI 选择逻辑，替代或扩展当前 aiBuiltin 引用
  - [ ] T5.2 单元测试：load 空文件、全局覆盖、项目覆盖、合并顺序、configTemplate 校验、generic 校验
  - [ ] T5.3 跨平台路径：使用 path.join、os.homedir() 解析 ~/.bmad-speckit

## Dev Notes

- **架构模式**：AIRegistry 为无状态服务，load() 每次调用时重新读取文件；init/check 在入口处调用 load({ cwd }) 获取合并结果
- **与 Story 10.1 的 ai-builtin**：Story 10.1 已实现 ai-builtin 仅含 id、name、description；本 Story 扩展为完整 configTemplate，并可在下列二者中择一：保留 ai-builtin 为简化列表、或新建 ai-registry-builtin 存完整 configTemplate，由 AIRegistry 统一暴露
- **configTemplate 校验时机**：内置数据在代码中保证正确；用户/项目 registry 在 load 时校验，失败则抛错并含文件路径
- **spec-kit 对齐**：PRD §5.12 表与 spec-kit AGENTS.md 一致；项目内无 AGENTS.md 文件，以 PRD/ARCH 为准

### Project Structure Notes

- `packages/bmad-speckit/src/services/ai-registry.js`：AIRegistry 模块
- `packages/bmad-speckit/src/constants/ai-builtin.js`：扩展或新建 ai-registry-builtin.js 存 19+ configTemplate
- `~/.bmad-speckit/ai-registry.json`：用户全局 registry（运行时解析）
- `_bmad-output/config/ai-registry.json`：项目级 registry（运行时解析）

### References

- [PRD §5.3、§5.3.1、§5.9、§5.12、§5.12.1] _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md
- [ARCH §3.2、§4.2、§3.4] _bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md
- [Epics 12.1] _bmad-output/planning-artifacts/dev/epics.md
- [Story 10.1 设计] _bmad-output/implementation-artifacts/epic-10-speckit-init-core/story-10-1-interactive-init/10-1-interactive-init.md

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
