# Story 12.2: 引用完整性

Status: ready-for-dev

<!-- Note: 实施前可运行 validate-create-story 做质量校验 -->

## Story

**As a** 使用 bmad-speckit 初始化的开发者，  
**I want** 按所选 AI 的 configTemplate 将 commands、rules、config 同步到对应目标目录（禁止写死 .cursor/），且在 configTemplate 含 vscodeSettings 时写入 .vscode/settings.json，  
**so that** init 后所选 AI 能正确加载 commands/rules/config，check 可按 selectedAI 验证目标目录（含 opencode/bob/shai/codex 显式条目），worktree 共享模式下 --bmad-path 验证通过，实现引用完整性约束（§5.11）。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | §5.10 | 项目根目录结构：commands/rules/config 从 _bmad/cursor/ 按 configTemplate 映射到所选 AI 目标目录；按所选 AI 写入对应目录，禁止写死 .cursor/ |
| PRD | §5.11 | 引用完整性约束：commands、rules、config 引用链有效；验收：init 后 check 验证目标目录结构完整 |
| PRD | §5.5 | check 结构验证清单：按 selectedAI 验证目标目录；cursor-agent→.cursor/、claude→.claude/、opencode→.opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands 等 |
| PRD | §5.2 | --bmad-path 当 path 不存在或结构不符合 §5.5 验证清单时：退出码 4 |
| PRD | §5.3.1 | vscodeSettings：configTemplate 非必填字段，对应 .vscode/settings.json |
| ARCH | §3.2 | InitCommand：按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录；若 configTemplate 含 vscodeSettings，写入 .vscode/settings.json |
| ARCH | §3.3 | init 流程：按 configTemplate 同步 commands/rules/config；若 configTemplate 含 vscodeSettings，写入 .vscode/settings.json |
| Epics | 12.2 | 引用完整性：按 configTemplate 同步；vscodeSettings→.vscode/settings.json；check 按 selectedAI 验证（含 opencode/bob/shai/codex）；--bmad-path 验证 |

## 本 Story 范围

- **commands/rules/config 同步**：从 `_bmad`（或 worktree 共享模式下 `bmadPath` 指向目录）的 `cursor/` 子目录，按所选 AI 的 configTemplate 映射到目标目录；源路径由 E10.5 的 bmadPath 或默认 _bmad 决定
- **禁止写死 .cursor/**：目标目录完全由 configTemplate.commandsDir、rulesDir、agentsDir/configDir 决定；cursor-agent→.cursor/、claude→.claude/、opencode→.opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands 等
- **vscodeSettings**：若 configTemplate 含 vscodeSettings 字段，将配置内容合并写入 `.vscode/settings.json`（项目根）；可与多 AI 共用
- **check 验证**：按 selectedAI 验证对应目标目录存在且含关键子目录；opencode/bob/shai/codex 为显式条目，按 PRD §5.5 验证清单逐项校验
- **--bmad-path 验证**：check 在 bmad-speckit.json 含 bmadPath 时，验证 bmadPath 指向目录存在且结构符合 §5.5 验证清单；不满足时退出码 4

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| AI Registry、configTemplate 数据源 | Story 12.1 | 本 Story 消费 AIRegistry 的 configTemplate，不负责 registry 定义 |
| Skill 发布到 configTemplate.skillsDir | Story 12.3 | 由 Story 12.3 负责 |
| check 的 AI 工具检测、--list-ai、子代理等级输出 | Story 13.1 | 由 Story 13.1 负责；本 Story 仅负责 check 的结构验证逻辑（按 selectedAI 验证目标目录、bmadPath 验证） |

## Acceptance Criteria

### AC-1: 按 configTemplate 同步 commands/rules/config（禁止写死 .cursor/）

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | cursor-agent 同步 | selectedAI 为 cursor-agent，configTemplate 含 commandsDir=.cursor/commands、rulesDir=.cursor/rules | init 完成 | 项目根下 `.cursor/commands`、`.cursor/rules` 存在，内容从 `_bmad/cursor/` 对应子目录同步 |
| 2 | claude 同步 | selectedAI 为 claude，configTemplate 含 commandsDir=.claude/commands | init 完成 | 项目根下 `.claude/commands` 存在，非 .cursor/ |
| 3 | opencode 同步 | selectedAI 为 opencode，configTemplate 含 commandsDir=.opencode/command（单数） | init 完成 | 项目根下 `.opencode/command/` 存在 |
| 4 | bob 同步 | selectedAI 为 bob，configTemplate 含 commandsDir=.bob/commands | init 完成 | 项目根下 `.bob/commands` 存在 |
| 5 | shai 同步 | selectedAI 为 shai，configTemplate 含 commandsDir=.shai/commands | init 完成 | 项目根下 `.shai/commands` 存在 |
| 6 | codex 同步 | selectedAI 为 codex，configTemplate 含 commandsDir=.codex/commands | init 完成 | 项目根下 `.codex/commands` 存在 |
| 7 | agentsDir 同步 | configTemplate 含 agentsDir（如 .cursor/agents） | init 完成 | `_bmad/cursor/config/` 内容同步到 configTemplate.agentsDir |
| 8 | configDir 同步 | configTemplate 含 configDir（如 .codex/config.toml）且无 agentsDir | init 完成 | config 内容写入 configDir 指定路径 |

### AC-2: vscodeSettings 写入 .vscode/settings.json

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | configTemplate 含 vscodeSettings | configTemplate.vscodeSettings 为 `.vscode/settings.json`，且含配置片段 | init 完成 | 项目根下 `.vscode/settings.json` 存在，配置与 configTemplate 定义一致；与现有文件合并（非覆盖） |
| 2 | configTemplate 无 vscodeSettings | configTemplate 不含 vscodeSettings 字段 | init 完成 | 不创建或修改 .vscode/settings.json |
| 3 | .vscode 已存在 | 项目根已有 .vscode/settings.json | init 完成 | 合并 configTemplate 的 vscodeSettings 内容，保留原有键值；冲突时以 configTemplate 为准或按合并策略 |

### AC-3: check 按 selectedAI 验证目标目录（含 opencode/bob/shai/codex 显式条目）

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | cursor-agent 验证 | selectedAI 为 cursor-agent，.cursor 存在且含 commands/、rules/ 或 agents/ 至少其一 | check 执行 | 退出码 0，无结构缺失项 |
| 2 | claude 验证 | selectedAI 为 claude，.claude 存在且含 commands/ 或 rules/ 至少其一 | check 执行 | 退出码 0 |
| 3 | opencode 验证 | selectedAI 为 opencode，.opencode 存在且含 command/（单数） | check 执行 | 退出码 0；目录缺失或结构不符时退出码 1，列出缺失项 |
| 4 | bob 验证 | selectedAI 为 bob，.bob 存在且含 commands/ | check 执行 | 退出码 0 |
| 5 | shai 验证 | selectedAI 为 shai，.shai 存在且含 commands/ | check 执行 | 退出码 0 |
| 6 | codex 验证 | selectedAI 为 codex，.codex 存在且含 commands/ | check 执行 | 退出码 0 |
| 7 | 无 selectedAI | bmad-speckit.json 无 selectedAI 或项目未 init | check 执行 | 跳过 AI 目标目录验证，或验证 .cursor 作为向后兼容默认（与 Story 13.1 对齐） |

### AC-4: --bmad-path 验证

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | bmadPath 有效 | bmad-speckit.json 含 bmadPath，指向目录存在且含 core/、cursor/、speckit/、skills/ 等符合 §5.5 清单 | check 执行 | 退出码 0，验证 bmadPath 结构通过 |
| 2 | bmadPath 路径不存在 | bmadPath 指向的路径不存在 | check 执行 | 退出码 4（目标路径不可用），输出明确错误信息 |
| 3 | bmadPath 结构不符合 | bmadPath 指向目录存在但缺 core/ 或 cursor/ 等关键子目录 | check 执行 | 退出码 4，列出缺失项 |
| 4 | init --bmad-path | 用户执行 init --bmad-path /path/to/_bmad --ai cursor --yes | init 完成 | 不复制 _bmad，仅创建 _bmad-output 与 AI 配置；bmad-speckit.json 含 bmadPath；commands/rules 从 bmadPath 指向目录同步 |

### AC-5: worktree 共享模式下的同步源

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | --bmad-path 同步源 | init 使用 --bmad-path /path/to/shared/_bmad | 同步 commands/rules/config | 从 bmadPath 指向目录的 cursor/ 子目录读取，非项目内 _bmad |
| 2 | 默认模式同步源 | init 未使用 --bmad-path | 同步 | 从项目根 _bmad/cursor/ 读取 |

## Tasks / Subtasks

- [ ] **T1**：实现同步模块 SyncService（AC: 1, 2, 5）
  - [ ] T1.1 新建 `src/services/sync-service.js`（或扩展现有 init 逻辑），实现 syncCommandsRulesConfig(projectRoot, selectedAI, bmadPath?)
  - [ ] T1.2 从 AIRegistry.getById(selectedAI) 获取 configTemplate；若 bmadPath 存在则从 bmadPath/cursor/ 读取源，否则从 projectRoot/_bmad/cursor/ 读取
  - [ ] T1.3 按 configTemplate.commandsDir、rulesDir、agentsDir/configDir 映射：cursor/commands → commandsDir、cursor/rules → rulesDir、cursor/config → agentsDir 或 configDir；目标路径在项目根下解析，禁止硬编码 .cursor/
  - [ ] T1.4 若 configTemplate 含 vscodeSettings，读取 vscodeSettings 配置内容，合并写入 projectRoot/.vscode/settings.json；.vscode 不存在时创建；合并策略：深度合并，configTemplate 优先

- [ ] **T2**：集成 InitCommand 同步步骤（AC: 1, 2, 4, 5）
  - [ ] T2.1 在 InitCommand 流程中，生成 _bmad、_bmad-output 后，调用 SyncService.syncCommandsRulesConfig()
  - [ ] T2.2 --bmad-path 时：不部署 _bmad，在 bmad-speckit.json 写入 bmadPath；SyncService 使用 bmadPath 作为源
  - [ ] T2.3 写入 selectedAI 到 bmad-speckit.json，供 check 使用

- [ ] **T3**：实现 CheckCommand 结构验证（AC: 3, 4）
  - [ ] T3.1 读取 _bmad-output/config/bmad-speckit.json 的 selectedAI、bmadPath
  - [ ] T3.2 若 bmadPath 存在：验证 bmadPath 指向目录存在；验证该目录含 core/、cursor/、speckit/、skills/ 等 §5.5 清单项；不满足时退出码 4
  - [ ] T3.3 若 selectedAI 存在：从 AIRegistry 获取 configTemplate，按 §5.5 验证清单验证对应目标目录；opencode→.opencode/command、bob→.bob/commands、shai→.shai/commands、codex→.codex/commands 显式校验
  - [ ] T3.4 结构验证失败时退出码 1，列出缺失项；成功时退出码 0
  - [ ] T3.5 无 selectedAI 时：跳过 AI 目标目录验证或验证 .cursor 向后兼容（与 Story 13.1 约定一致）

- [ ] **T4**：单元测试与集成测试（AC: 1-5）
  - [ ] T4.1 单元测试：SyncService 对 cursor-agent、claude、opencode、bob、shai、codex 的映射正确性
  - [ ] T4.2 单元测试：vscodeSettings 合并逻辑（新建、合并、无 vscodeSettings 时跳过）
  - [ ] T4.3 集成测试：init --ai cursor-agent --yes 后 check 通过；init --ai opencode --yes 后 .opencode/command 存在且 check 通过
  - [ ] T4.4 集成测试：init --bmad-path /tmp/shared/_bmad --ai cursor --yes 后 bmadPath 正确记录，check 验证 bmadPath 通过；bmadPath 指向无效路径时 check 退出码 4

## Dev Notes

- **与 Story 12.1 衔接**：AIRegistry.getById(selectedAI) 返回的 configTemplate 已含 commandsDir、rulesDir、agentsDir/configDir、vscodeSettings；本 Story 仅消费，不修改 registry
- **与 Story 10.5 衔接**：--bmad-path 由 E10.5 实现参数解析与 bmadPath 持久化；本 Story 负责 init 时使用 bmadPath 作为同步源、check 时验证 bmadPath
- **与 Story 13.1 衔接**：check 的 AI 工具检测、--list-ai、子代理等级由 Story 13.1 实现；本 Story 仅实现 check 的结构验证（_bmad/bmadPath、_bmad-output、AI 目标目录）
- **vscodeSettings 合并策略**：JSON 深度合并；若 .vscode/settings.json 已存在，保留未在 configTemplate 中定义的键；同键时以 configTemplate 为准
- **跨平台路径**：使用 path.join、path.resolve，禁止硬编码 `/` 或 `\`

### Project Structure Notes

- `packages/bmad-speckit/src/services/sync-service.js`：SyncService 同步逻辑（新建或扩展现有 init 内联逻辑）
- `packages/bmad-speckit/src/commands/init.js`：调用 SyncService，传入 bmadPath
- `packages/bmad-speckit/src/commands/check.js`：结构验证逻辑，读取 bmad-speckit.json、调用 AIRegistry
- 目标目录均在项目根下：`.cursor/`、`.claude/`、`.opencode/command/`、`.bob/commands/`、`.shai/commands/`、`.codex/commands/` 等

### References

- [PRD §5.5、§5.10、§5.11、§5.3.1] _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md
- [ARCH §3.2、§3.3、§4.2] _bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md
- [Epics 12.2] _bmad-output/planning-artifacts/dev/epics.md
- [Story 12.1] _bmad-output/implementation-artifacts/epic-12-speckit-ai-skill-publish/story-12-1-ai-registry/12-1-ai-registry.md
- [Story 10.5] _bmad-output/implementation-artifacts/epic-10-speckit-init-core/story-10-5-bmad-path-worktree/（若存在）

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
