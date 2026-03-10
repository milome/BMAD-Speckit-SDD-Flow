# Story 10.4: 配置持久化

Status: ready-for-dev

## Story

**As a** 多项目用户，  
**I want to** 将默认 AI、默认脚本类型等配置持久化到全局与项目级文件，并保证项目级配置覆盖全局，  
**so that** init 与非交互流程可复用我的默认选择，且不同项目可拥有各自配置。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | US-8 | 配置持久化与复用：~/.bmad-speckit/config.json、defaultAI/defaultScript、项目级覆盖 |
| PRD | §5.9 | 全局 ~/.bmad-speckit/config.json（defaultAI、defaultScript、templateSource、networkTimeoutMs）；项目 _bmad-output/config/bmad-speckit.json（templateVersion、ai、script、initLog） |
| ARCH | §3.2 ConfigManager | 读写两路径；defaultAI、defaultScript、templateSource、networkTimeoutMs（默认 30000） |
| ARCH | §4.1 | 配置优先级：CLI > 环境变量 > 项目级 > 全局 > 内置默认 |
| Epics | 10.4 | 配置持久化：~/.bmad-speckit/config.json、_bmad-output/config/bmad-speckit.json、defaultAI/defaultScript、项目级覆盖 |

## 本 Story 范围

- **ConfigManager 模块**：提供统一读写接口，管理全局配置（`~/.bmad-speckit/config.json`）与项目级配置（`<cwd>/_bmad-output/config/bmad-speckit.json`）。
- **支持的 key**：`defaultAI`、`defaultScript`、`templateSource`、`networkTimeoutMs`（数值，默认 30000）；项目级还可含 `templateVersion`、`selectedAI`、`initLog` 等由 init 流程写入的字段。
- **优先级**：读取时项目级优先于全局（项目级存在且含该 key 时返回项目级值）；写入时由调用方指定目标（全局或项目级），Story 13.4 的 config 子命令负责「在已 init 目录内默认写项目级、否则全局、--global 强制全局」的决策。
- **init 集成**：init 流程（Story 10.1/10.2）在完成后通过 ConfigManager 写入项目级 `bmad-speckit.json`（如 selectedAI、templateVersion、initLog）；未传 --script 时由 Story 10.3 通过 ConfigManager 读取 defaultScript；未传 --ai 时由 Story 10.2 通过 ConfigManager 读取 defaultAI。

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 交互式 init、Banner、AI 选择、--force、--modules | Story 10.1 | 由 Story 10.1 负责 |
| 非交互式 init（--ai、--yes、TTY 检测） | Story 10.2 | 由 Story 10.2 负责；本 Story 提供 defaultAI 的读取接口供 10.2 使用 |
| 跨平台脚本生成（--script sh/ps、defaultScript 参与默认值） | Story 10.3 | 由 Story 10.3 负责；本 Story 提供 defaultScript 的读写供 10.3 读取默认值 |
| config 子命令（config get/set/list、--global、--json） | Story 13.4 | 由 Story 13.4 负责：CLI 层调用 ConfigManager 实现 get/set/list，并决定写入全局或项目级 |
| --bmad-path worktree 共享、bmadPath 写入项目配置 | Story 10.5 | 由 Story 10.5 负责；本 Story 仅提供 ConfigManager 的 set/get，不规定 bmadPath 的写入时机 |

## Acceptance Criteria

### AC-1: 全局与项目级路径与格式

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 全局路径 | 用户主目录可用 | ConfigManager 解析全局配置路径 | 为 `~/.bmad-speckit/config.json`（或 os.homedir() + path.join） |
| 2 | 项目级路径 | 当前工作目录为已 init 项目根 | ConfigManager 解析项目级配置路径 | 为 `<cwd>/_bmad-output/config/bmad-speckit.json` |
| 3 | 文件格式 | 读写配置 | 持久化与读取 | JSON 格式；写入时保持合法 JSON 且不破坏已有键值 |

### AC-2: get(key) 与优先级

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 仅全局有值 | 全局 config 含 defaultAI，项目级不存在或无该 key | get('defaultAI', { cwd }) | 返回全局 defaultAI |
| 2 | 项目级有值 | 项目级 bmad-speckit.json 含 defaultAI | get('defaultAI', { cwd }) | 返回项目级值（项目级优先） |
| 3 | 均无 | 全局与项目级均无该 key | get('defaultAI', { cwd }) | 返回 undefined 或约定默认（如 defaultScript 无则由 10.3 用平台默认） |
| 4 | 仅项目级存在 | 无全局文件，项目级有 defaultScript | get('defaultScript', { cwd }) | 返回项目级 defaultScript |

### AC-3: set(key, value) 与目标

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 写入全局 | 调用 set(key, value, { scope: 'global' }) | ConfigManager 执行 | 写入 ~/.bmad-speckit/config.json，必要时创建目录与文件 |
| 2 | 写入项目级 | 调用 set(key, value, { scope: 'project', cwd }) | ConfigManager 执行 | 写入 <cwd>/_bmad-output/config/bmad-speckit.json，必要时创建目录与文件 |
| 3 | 合并写入 | 目标文件已存在且含其他 key | set 单 key | 仅更新该 key，不删除其他 key |

### AC-4: list() 与合并视图

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 合并列表 | 全局与项目级均存在且含不同 key | list({ cwd }) | 返回合并后的键值对；同 key 时项目级值覆盖全局 |
| 2 | 仅全局 | 无项目级文件 | list({ cwd }) | 返回全局配置的键值对 |

### AC-5: 支持的 key 与类型

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | defaultAI | 字符串 | get/set | 读写为字符串（AI id） |
| 2 | defaultScript | 字符串 | get/set | 读写为字符串（如 "sh"、"ps"） |
| 3 | templateSource | 字符串 | get/set | 读写为字符串 |
| 4 | networkTimeoutMs | 数值 | get/set | 读写为数字；未设置时 get 可返回 30000 作为默认 |

### AC-6: init 流程写入项目级

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | init 写入 | init 完成（Story 10.1/10.2） | 调用 ConfigManager 写入项目级 | selectedAI、templateVersion、initLog 等可写入 _bmad-output/config/bmad-speckit.json；ConfigManager 提供 set 或多键合并写入能力，供 init 调用 |

## Tasks / Subtasks

- [ ] **T1**：ConfigManager 模块与路径解析（AC: 1）
  - [ ] T1.1 新增 config-manager.js（或等价路径），实现全局路径与项目级路径解析（os.homedir、path.join；项目级为 cwd + _bmad-output/config/bmad-speckit.json）
  - [ ] T1.2 确保目录不存在时创建（如 mkdirp 或 fs.mkdirSync recursive）；读写使用 UTF-8

- [ ] **T2**：get(key, options) 与优先级（AC: 2, 5）
  - [ ] T2.1 实现 get(key, { cwd })：若 cwd 下存在项目级文件且含 key，返回项目级值；否则读全局文件返回全局值；均无则返回 undefined
  - [ ] T2.2 networkTimeoutMs 在全局与项目级均无时返回 30000
  - [ ] T2.3 导出 getDefaultAI、getDefaultScript 等便捷方法（或统一 get，由 10.2/10.3 传 key 调用）

- [ ] **T3**：set(key, value, options) 与 scope（AC: 3, 5）
  - [ ] T3.1 实现 set(key, value, { scope: 'global' | 'project', cwd })：按 scope 写入对应文件；若文件已存在则读入、合并该 key、写回
  - [ ] T3.2 支持一次写入多键（如 setAll(record, options)）供 init 写入 selectedAI、templateVersion、initLog

- [ ] **T4**：list(options) 合并视图（AC: 4）
  - [ ] T4.1 实现 list({ cwd })：合并全局与项目级（项目级 key 覆盖全局），返回单一对象

- [ ] **T5**：与 init 集成点
  - [ ] T5.1 init 流程在「选择 AI、模板拉取、同步完成」后调用 ConfigManager 写入项目级 bmad-speckit.json（selectedAI、templateVersion、initLog 等）；本 Story 确保 ConfigManager 可被 init 命令 require 并调用
  - [ ] T5.2 Story 10.2 的 getDefaultAI：在未传 --ai 时调用 ConfigManager.get('defaultAI', { cwd })；无值时回退内置第一项（已在 10.2 约定）
  - [ ] T5.3 Story 10.3 的 defaultScript：在未传 --script 时调用 ConfigManager.get('defaultScript', { cwd })；无值时用平台默认（Windows→ps，非 Windows→sh）

- [ ] **T6**：验收与回归
  - [ ] T6.1 单元测试：get/set/list 在 mock 路径下覆盖「仅全局」「仅项目级」「两者都有」「项目级覆盖」；set 不破坏其他 key
  - [ ] T6.2 集成：在已 init 项目根运行一次 init 后，检查 _bmad-output/config/bmad-speckit.json 含 selectedAI、templateVersion、initLog；修改全局 defaultAI 后再次 init 另一目录，验证默认 AI 来自全局；在项目级 bmad-speckit.json 设置 defaultScript 后，init 未传 --script 时使用项目级 defaultScript

## Dev Notes

### 架构约束

- ConfigManager 为无 UI 的纯读写模块，不解析 CLI 参数；config 子命令的 get/set/list 与 --global 逻辑由 Story 13.4 实现并调用 ConfigManager。
- 配置优先级与 PRD §5.9、ARCH §4.1 一致：CLI > 环境变量 > 项目级 > 全局 > 内置；ConfigManager 仅负责「项目级 > 全局」的读取合并与按 scope 写入。
- 路径使用 Node.js path 模块与 os.homedir()，禁止硬编码 `/` 或 `\`。

### 禁止词

文档与实现中禁止使用 bmad-story-assistant §禁止词表（Story 文档）中的任一词，见该技能禁止词表。

### Previous Story Intelligence（Story 10.1、10.2、10.3）

- **InitCommand**：位于 packages/bmad-speckit/src/commands/init.js；init 完成后需将 selectedAI、templateVersion、initLog 写入项目级配置，本 Story 提供 ConfigManager 供其调用。
- **Story 10.2**：getDefaultAI 已约定「ConfigManager 有 defaultAI 则用，否则内置第一项」；本 Story 实现 ConfigManager.get('defaultAI', { cwd }) 后，10.2 可条件 require config-manager 并调用。
- **Story 10.3**：defaultScript 读取由本 Story 提供；10.3 在未传 --script 时调用 ConfigManager.get('defaultScript', { cwd })，无值时用平台默认。

### Project Structure Notes

- 建议路径：packages/bmad-speckit/src/config-manager.js（或 src/config/config-manager.js），与 commands/ 平级；若已有 config 相关目录则放入其中。
- 全局目录 ~/.bmad-speckit 若不存在须自动创建；项目级 _bmad-output/config 同理。

### References

- [Source: _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md §5.9 配置持久化]
- [Source: _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md US-8 配置持久化与复用]
- [Source: _bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md §3.2 ConfigManager、§4.1 配置优先级]
- [Source: _bmad-output/planning-artifacts/dev/epics.md Epic 10、Story 10.4]

## Dev Agent Record

### Agent Model Used

（实施时填写）

### Debug Log References

### Completion Notes List

### File List
