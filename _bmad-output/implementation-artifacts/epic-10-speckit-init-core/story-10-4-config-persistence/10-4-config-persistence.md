# Story 10.4: 配置持久化

Status: ready-for-dev

## Story

**As a** 多项目用户，  
**I want to** 在全局配置中设置默认 AI 与 defaultScript，  
**so that** 每次 init 不必重复选择，且项目级配置可覆盖全局。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | US-8 | 配置持久化与复用 |
| PRD | §5.9 | ~/.bmad-speckit/config.json、_bmad-output/config/bmad-speckit.json |
| PRD | §5.2 | --yes 时 defaultAI 来源 |
| ARCH | §3.2 | ConfigManager、配置优先级 |
| Epics | 10.4 | 配置持久化完整描述与验收要点 |

## 本 Story 范围

- 全局配置：`~/.bmad-speckit/config.json`，支持 `defaultAI`、`defaultScript`、`templateSource`、`networkTimeoutMs`（默认 30000）
- 项目级配置：`<project>/_bmad-output/config/bmad-speckit.json`，支持 `templateVersion`、`selectedAI`、`script` 类型、`initLog`
- 优先级：项目级 > 全局
- init 时读取并应用；交互式选择可覆盖默认值
- ConfigManager 服务：统一读写接口

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| config 子命令（get/set/list） | Epic 13（Story 13.4） | 由 Epic 13 负责 |
| init 流程、AI 选择 | Story 10.1、10.2 | 由 Story 10.1、10.2 负责 |
| templateVersion 持久化（写入 bmad-speckit.json） | Story 11.2 | 由 Story 11.2 负责 |

## Acceptance Criteria

### AC-1: 全局配置

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 创建目录 | ~/.bmad-speckit 不存在 | 首次写入配置 | 创建目录并写入 config.json |
| 2 | defaultAI | 写入 defaultAI: "claude" | init --yes | 使用 claude 作为默认 AI |
| 3 | defaultScript | 写入 defaultScript: "ps" | init 未传 --script | 使用 ps 作为默认脚本类型 |
| 4 | networkTimeoutMs | 写入 networkTimeoutMs: 60000 | 模板拉取 | 使用 60000ms 超时 |

### AC-2: 项目级配置

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 覆盖全局 | 全局 defaultAI=claude，项目 selectedAI=cursor-agent | init 读取配置 | 使用 cursor-agent（项目级优先） |
| 2 | init 写入 | init 完成 | 写入 bmad-speckit.json | 含 selectedAI、templateVersion（若已拉取）、initLog 等 |
| 3 | 路径 | 项目已 init | 配置文件路径 | _bmad-output/config/bmad-speckit.json |

### AC-3: 优先级

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 项目优先 | 全局与项目均存在 defaultAI/selectedAI | ConfigManager.get | 返回项目级值 |
| 2 | 仅全局 | 项目未 init 或无可覆盖项 | ConfigManager.get | 返回全局值 |
| 3 | 无配置 | 全局与项目均无某 key | ConfigManager.get | 返回内置默认（如 networkTimeoutMs: 30000） |

### AC-4: ConfigManager 接口

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | get | key 存在 | ConfigManager.get('defaultAI') | 返回对应值，遵循优先级 |
| 2 | set | 在项目目录内 | ConfigManager.set('defaultAI','claude') | 写入项目级 bmad-speckit.json |
| 3 | set 全局 | 不在项目目录或显式 --global | ConfigManager.set(..., { global: true }) | 写入 ~/.bmad-speckit/config.json |

## Tasks / Subtasks

- [ ] **T1**：ConfigManager 服务（AC: 4）
  - [ ] T1.1 创建 src/services/config-manager.js
  - [ ] T1.2 实现 get(key)、set(key, value, options)、list()
  - [ ] T1.3 实现优先级逻辑：CLI 参数 > 项目级 > 全局 > 内置默认
  - [ ] T1.4 实现路径解析：项目级路径为 cwd/_bmad-output/config/bmad-speckit.json

- [ ] **T2**：全局配置读写（AC: 1）
  - [ ] T2.1 实现 ~/.bmad-speckit 目录创建
  - [ ] T2.2 实现 config.json 读写，支持 defaultAI、defaultScript、templateSource、networkTimeoutMs
  - [ ] T2.3 首次写入时创建目录

- [ ] **T3**：项目级配置读写（AC: 2）
  - [ ] T3.1 实现 _bmad-output/config/bmad-speckit.json 读写
  - [ ] T3.2 init 完成后写入 selectedAI、initLog 等
  - [ ] T3.3 合并写入，不覆盖用户已有字段（若需）

- [ ] **T4**：与 init 集成（AC: 1, 2, 3）
  - [ ] T4.1 InitCommand 在 --yes 时通过 ConfigManager 读取 defaultAI
  - [ ] T4.2 InitCommand 在未传 --script 时通过 ConfigManager 读取 defaultScript
  - [ ] T4.3 交互式选择结果写入项目级配置

## Dev Notes

### 架构约束

- ConfigManager 为独立服务，可被 init、config 子命令、Story 10.2 等复用
- config 子命令（get/set/list）由 Epic 13 Story 13.4 实现，本 Story 仅实现 ConfigManager 与 init 集成
- 路径使用 path.join、path.resolve，禁止硬编码

### 禁止词

文档与实现中禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### References

- [PRD §5.9] 配置持久化
- [ARCH §3.2] ConfigManager
- [Epics] Epic 10 Story 10.4

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
