# Story 13.4: config 子命令

Status: ready-for-dev

<!-- 验证：运行 validate-create-story 进行质量检查后再执行 dev-story。 -->

## Story

**As a** 已 init 项目的用户，  
**I want** 通过 `bmad-speckit config` 子命令 get/set/list 配置项，支持项目级优先、`--global` 与 `--json` 输出，  
**so that** 可查看与修改 defaultAI、defaultScript、templateSource、networkTimeoutMs 等配置，且配置优先规则与 Story 10.4 一致。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | US-11 | config 子命令：get/set/list 配置项 |
| ARCH | §3.2 ConfigCommand | VersionCommand、UpgradeCommand、ConfigCommand、FeedbackCommand |
| Epics | 13.4 | config：get/set/list、项目级优先、--global、defaultAI/defaultScript/templateSource/networkTimeoutMs、--json 输出 |
| Story 10.4 | 非本 Story | ConfigManager 由 Story 10.4 实现；本 Story 实现 CLI 层并调用 ConfigManager |

## 本 Story 范围

- **config 子命令**：`config get <key>`、`config set <key> <value>`、`config list`，调用 Story 10.4 的 ConfigManager 实现读写。
- **作用域规则**：在已 init 目录内执行 set 时，默认写入项目级配置（`_bmad-output/config/bmad-speckit.json`）；未在已 init 目录内时，set 写入全局配置（`~/.bmad-speckit/config.json`）；`--global` 时 set 强制写入全局配置。
- **--global**：仅对 set 有效；get、list 始终按配置链合并（项目级优先于全局）。
- **--json**：get、list 支持 `--json` 输出，输出合法 JSON。
- **支持的 key**：defaultAI、defaultScript、templateSource、templateVersion、networkTimeoutMs（与 ConfigManager 及 Story 10.4 一致；templateVersion 由 init/upgrade 写入，本 Story 支持 get/set/list 供用户手动覆盖或查看）。

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| ConfigManager 模块（get/set/setAll/list、路径解析、优先级） | Story 10.4 | 由 Story 10.4 实现；本 Story 仅实现 config 子命令 CLI 层并调用 ConfigManager |
| check、version、upgrade、feedback | Story 13.1、13.3、13.5 | 由 Story 13.1、13.3、13.5 分别负责 |
| 退出码 2（--ai 无效）、3（网络/模板）、4（路径不可用）、5（离线 cache 缺失） | Story 13.2、11.2 | 本 Story 复用 Story 13.2 约定的退出码；config 子命令无上述场景时退出码 0/1 |

## Acceptance Criteria

### AC-1: config get \<key\>

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 读取单 key | 项目级或全局配置含 defaultAI | 执行 `config get defaultAI` | stdout 输出该 key 的值；退出码 0 |
| 2 | key 不存在 | 全局与项目级均无该 key | 执行 `config get unknownKey` | stderr 含「不存在」或等价；退出码 1 |
| 3 | networkTimeoutMs 默认 | 全局与项目级均无 networkTimeoutMs | 执行 `config get networkTimeoutMs` | stdout 输出 30000（ConfigManager 默认）；退出码 0 |
| 4 | --json 输出 | 项目级含 defaultAI | 执行 `config get defaultAI --json` | stdout 输出合法 JSON（如 `{"defaultAI":"cursor-agent"}` 或 `{"value":"cursor-agent"}`）；退出码 0 |

### AC-2: config set \<key\> \<value\>

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 已 init 目录默认项目级 | 当前目录为已 init 项目根（存在 `_bmad-output/config/bmad-speckit.json`） | 执行 `config set defaultAI cursor-agent` | 写入项目级 `bmad-speckit.json`；退出码 0 |
| 2 | 未 init 目录写全局 | 当前目录非已 init 项目根 | 执行 `config set defaultAI cursor-agent` | 写入全局 `~/.bmad-speckit/config.json`；退出码 0 |
| 3 | --global 强制全局 | 当前目录为已 init 项目根 | 执行 `config set defaultAI cursor-agent --global` | 写入全局配置，不写入项目级；退出码 0 |
| 4 | networkTimeoutMs 数值 | 任意 | 执行 `config set networkTimeoutMs 60000` | 写入数值 60000（非字符串）；退出码 0 |
| 5 | 合并已有配置 | 项目级 bmad-speckit.json 已含 selectedAI | 执行 `config set defaultAI bob` | 仅更新 defaultAI，保留 selectedAI；退出码 0 |

### AC-3: config list

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 合并视图 | 全局与项目级均含配置 | 执行 `config list` | stdout 输出合并后的键值对（项目级覆盖全局）；可读格式；退出码 0 |
| 2 | --json 输出 | 同上 | 执行 `config list --json` | stdout 输出合法 JSON 对象；退出码 0 |
| 3 | 仅全局 | 无项目级文件 | 执行 `config list` | 输出全局配置的键值对；退出码 0 |

### AC-4: 已 init 判定

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 已 init 判定 | 当前目录存在 `_bmad-output/config/bmad-speckit.json` | 执行 set 且未传 --global | 写入项目级 |
| 2 | 未 init 判定 | 当前目录不存在项目级 config | 执行 set | 写入全局 |

## Tasks / Subtasks

- [ ] **Task 1**：实现 config 子命令骨架与 bin 注册（AC-1～AC-4）
  - [ ] 1.1 新增 `packages/bmad-speckit/src/commands/config.js`，实现 `configCommand(cwd, options)`；解析子命令 get/set/list 及参数
  - [ ] 1.2 在 `bin/bmad-speckit.js` 注册 `config` 子命令，添加 `--global`、`--json` 选项；子命令结构：`config get <key>`、`config set <key> <value>`、`config list`
  - [ ] 1.3 require ConfigManager（`src/services/config-manager.js`），调用 get/set/list 实现读写

- [ ] **Task 2**：实现 get 与 scope 无关（AC-1）
  - [ ] 2.1 解析 `config get <key>`：调用 `ConfigManager.get(key, { cwd })`，按项目级优先返回
  - [ ] 2.2 key 不存在时 stderr 输出错误信息，退出码 1
  - [ ] 2.3 `--json` 时 stdout 输出合法 JSON（如 `{"key":"defaultAI","value":"cursor-agent"}` 或等价结构）

- [ ] **Task 3**：实现 set 与作用域规则（AC-2、AC-4）
  - [ ] 3.1 解析 `config set <key> <value>`；根据 cwd 是否存在项目级 config 判断是否已 init
  - [ ] 3.2 已 init 且无 --global：`ConfigManager.set(key, value, { scope: 'project', cwd })`
  - [ ] 3.3 未 init 或有 --global：`ConfigManager.set(key, value, { scope: 'global' })`（global 时 cwd 可空）
  - [ ] 3.4 networkTimeoutMs 的 value 解析为 Number；其余 key 保持字符串
  - [ ] 3.5 set 后 stdout 可输出确认或静默；退出码 0

- [ ] **Task 4**：实现 list（AC-3）
  - [ ] 4.1 调用 `ConfigManager.list({ cwd })`，输出合并后的键值对
  - [ ] 4.2 无 `--json` 时人类可读格式（如 `key: value` 每行或表格）
  - [ ] 4.3 `--json` 时 JSON.stringify 输出对象；退出码 0

- [ ] **Task 5**：测试与验收
  - [ ] 5.1 单元/集成测试：config get/set/list 在 mock 路径下覆盖项目级/全局/--global/--json；已 init 判定正确
  - [ ] 5.2 回归：确认 init、check、upgrade 不受影响；ConfigManager 调用正确

## Dev Notes

### 架构与依赖

- **ConfigManager**：Story 10.4 已实现 `get(key, { cwd })`、`set(key, value, { scope, cwd })`、`list({ cwd })`；路径为 `packages/bmad-speckit/src/services/config-manager.js`。
- **已 init 判定**：与 check、upgrade 一致，项目级 config 路径为 `_bmad-output/config/bmad-speckit.json`；`fs.existsSync(getProjectConfigPath(cwd))` 或 ConfigManager 提供的 `getProjectConfigPath` 可复用。
- **子命令结构**：使用 Commander 的 `.command('config')` 配合 `.command('get <key>')`、`.command('set <key> <value>')`、`.command('list')` 或单 command 解析 argv；参考 version、upgrade 的注册方式。

### 禁止词

文档与实现中禁止使用 bmad-story-assistant §禁止词表（Story 文档）中的任一词：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### Project Structure Notes

- **Config 命令**：`packages/bmad-speckit/src/commands/config.js`（新建）
- **bin 注册**：`packages/bmad-speckit/bin/bmad-speckit.js` 已预留 config 描述（L21），需添加 `.command('config')` 及子命令 action
- **ConfigManager**：`packages/bmad-speckit/src/services/config-manager.js`；提供 get、set、list、getProjectConfigPath

### References

- [Source: _bmad-output/planning-artifacts/dev/epics.md Epic 13、Story 13.4]
- [Source: _bmad-output/implementation-artifacts/epic-10-speckit-init-core/story-10-4-config-persistence/10-4-config-persistence.md ConfigManager、作用域规则]
- [Source: _bmad-output/implementation-artifacts/epic-13-speckit-diagnostic-commands/story-13-3-upgrade/13-3-upgrade.md config 子命令归属]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
