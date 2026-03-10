# Story 10.5: --bmad-path worktree 共享

Status: ready-for-dev

## Story

**As a** 多 worktree 用户，  
**I want to** 使用 `--bmad-path /path/to/shared/_bmad` 不复制 _bmad 而仅创建 _bmad-output 与 AI 配置，  
**so that** 多个 worktree 可共享同一 _bmad 源码，避免重复占用磁盘。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | US-9 | worktree 共享 _bmad（--bmad-path） |
| PRD | §5.2 | --bmad-path、须与 --ai、--yes 配合非交互使用 |
| PRD | §5.5 | check 验证 bmadPath、path 不存在或结构不符合时退出码 4 |
| PRD | §5.10 | worktree 共享模式 |
| ARCH | §3.2 | init 流程、--bmad-path |
| Epics | 10.5 | --bmad-path worktree 共享完整描述与验收要点 |

## 本 Story 范围

- `--bmad-path <path>`：指定已有 _bmad 路径，不复制 _bmad，仅创建 _bmad-output 与 AI 配置
- 须与 `--ai`、`--yes` 配合非交互使用；未配合时报错或自动 --yes（若非 TTY）
- bmadPath 写入 `_bmad-output/config/bmad-speckit.json`
- 路径校验：path 不存在或结构不符合 §5.5 验证清单时，报错退出，退出码 4
- commands、rules、skills 同步从 bmadPath 指向目录读取
- check 子命令验证 bmadPath 指向目录存在且结构符合（本 Story 可定义校验逻辑，check 命令由 Epic 13 实现）

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 交互式 init、非交互式 --ai/--yes | Story 10.1、10.2 | 由 Story 10.1、10.2 负责 |
| 按 configTemplate 同步到 AI 目标目录 | Story 12.2 | 由 Story 12.2 负责 |
| check 子命令完整实现 | Epic 13（Story 13.1） | 由 Epic 13 负责 |

## Acceptance Criteria

### AC-1: --bmad-path 基本行为

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 有效路径 | --bmad-path /path/to/_bmad 且路径存在、结构符合 | init --ai cursor-agent --yes | 不复制 _bmad，仅创建 _bmad-output、AI 配置 |
| 2 | bmadPath 写入 | init 完成 | 写入 bmad-speckit.json | 含 bmadPath 字段，值为指定路径（绝对路径） |
| 3 | 同步来源 | bmadPath 指向目录含 _bmad 结构 | 同步 commands/rules | 从 bmadPath 读取，不从项目内 _bmad 读取 |

### AC-2: 非交互约束

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 须配合 --ai --yes | 用户传 --bmad-path 但未传 --ai、--yes | init 执行 | 报错提示须配合 --ai、--yes；或非 TTY 时自动 --yes |
| 2 | 配合成功 | 用户传 --bmad-path /p/_bmad --ai cursor-agent --yes | init 执行 | 正常执行，无交互 |

### AC-3: 路径校验

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 路径不存在 | --bmad-path /nonexistent | init 执行 | 报错退出，退出码 4，提示路径不存在 |
| 2 | 结构不符合 | --bmad-path 指向目录缺 core/ 或 cursor/ 等 | init 执行 | 报错退出，退出码 4，列出缺失项 |
| 3 | 结构符合 | --bmad-path 指向目录含 core/、cursor/、speckit/ 等 | init 执行 | 通过校验，继续执行 |

### AC-4: check 验证（本 Story 提供校验逻辑）

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | bmadPath 有效 | bmad-speckit.json 含 bmadPath，路径存在且结构符合 | check 验证 | 通过 |
| 2 | bmadPath 无效 | bmadPath 指向路径不存在 | check 验证 | 失败，退出码 1 或 4，列出问题 |

## Tasks / Subtasks

- [ ] **T1**：--bmad-path 参数解析（AC: 1, 2）
  - [ ] T1.1 Commander.js 解析 --bmad-path <path>
  - [ ] T1.2 校验须与 --ai、--yes 配合；未配合时报错或（非 TTY 时）自动 --yes
  - [ ] T1.3 解析为绝对路径后写入 bmad-speckit.json

- [ ] **T2**：路径校验逻辑（AC: 3）
  - [ ] T2.1 实现 validateBmadPath(path)：检查路径存在
  - [ ] T2.2 实现结构校验：core/、cursor/、speckit/ 等子目录存在（按 PRD §5.5 清单）
  - [ ] T2.3 校验失败时退出码 4，输出明确错误信息

- [ ] **T3**：init 流程分支（AC: 1, 2）
  - [ ] T3.1 --bmad-path 时跳过 _bmad 复制，仅创建 _bmad-output
  - [ ] T3.2 同步 commands/rules 时从 bmadPath 读取
  - [ ] T3.3 写入 bmad-speckit.json 的 bmadPath 字段

- [ ] **T4**：校验逻辑导出（AC: 4）
  - [ ] T4.1 将 validateBmadPath 导出为可复用函数，供 check 子命令调用
  - [ ] T4.2 定义校验清单常量（与 PRD §5.5 一致）

## Dev Notes

### 架构约束

- 依赖 Story 10.1 的 init 流程、Story 10.2 的非交互支持
- bmadPath 须为绝对路径，避免 worktree 切换后相对路径失效
- PRD §5.5 验证清单：_bmad 含 core/、cursor/、speckit/、skills/ 等；worktree 共享模式下验证 bmadPath 指向目录

### 禁止词

文档与实现中禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### References

- [PRD §5.2] --bmad-path
- [PRD §5.5] check 结构验证清单
- [PRD §5.10] worktree 共享模式
- [Epics] Epic 10 Story 10.5

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
