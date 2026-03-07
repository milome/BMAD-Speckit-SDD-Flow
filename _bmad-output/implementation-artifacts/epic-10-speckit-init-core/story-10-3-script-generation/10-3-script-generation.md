# Story 10.3: 跨平台脚本生成

Status: ready-for-dev

## Story

**As a** Windows 用户，  
**I want to** 使用 `--script ps` 生成 PowerShell 脚本，  
**so that** 我能在原生 PowerShell 中运行 SDD 工作流，无需 Git Bash 或 WSL。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | US-7 | 跨平台脚本生成 |
| PRD | §5.2 | --script sh \| ps |
| PRD | §5.7 | 跨平台、路径/编码/换行符、Windows 默认 ps |
| ARCH | §5.2 | 脚本生成、--script sh/ps |
| Epics | 10.3 | 跨平台脚本生成完整描述与验收要点 |

## 本 Story 范围

- `--script sh`：生成 POSIX shell 脚本（Windows 需 Git Bash/WSL）
- `--script ps`：生成 PowerShell 脚本（推荐 PowerShell 7+，5.1 降级支持）
- 路径处理：使用 Node.js path 模块，禁止硬编码 `/` 或 `\`
- 编码：统一 UTF-8
- 换行符：按 OS 或用户配置（LF/CRLF）
- Windows 默认：未指定时，Windows 上默认或智能选择 `ps`

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 交互式/非交互式 init 核心流程 | Story 10.1、10.2 | 由 Story 10.1、10.2 负责 |
| 配置持久化（defaultScript） | Story 10.4 | 由 Story 10.4 负责 |

## Acceptance Criteria

### AC-1: --script sh

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 生成 POSIX | 用户传 `--script sh` | init 完成 | 生成 POSIX shell 脚本，可在 Git Bash/WSL 执行 |
| 2 | 路径格式 | 脚本内路径 | 生成 | 使用 POSIX 风格（/），或 path 模块输出 |
| 3 | 换行符 | 生成脚本文件 | 写入 | LF（或按配置） |

### AC-2: --script ps

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 生成 PowerShell | 用户传 `--script ps` | init 完成 | 生成 PowerShell 脚本，可在 Windows PowerShell 执行 |
| 2 | 路径格式 | 脚本内路径 | 生成 | 使用 Windows 风格或 path 模块 |
| 3 | 换行符 | 生成脚本文件 | 写入 | CRLF（Windows）或按配置 |
| 4 | 编码 | 生成脚本 | 写入 | UTF-8（含 BOM 若需 PowerShell 5.1 兼容） |

### AC-3: Windows 默认

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 未指定 script | Windows 环境、用户未传 --script | init 执行 | 默认使用 ps 或智能选择 ps |
| 2 | 非 Windows | macOS/Linux、用户未传 --script | init 执行 | 默认使用 sh |

### AC-4: 脚本内容

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 可执行 | 生成的脚本 | 用户执行 | 能正确调用 bmad-speckit 或等价命令 |
| 2 | 路径正确 | 项目路径含空格或非 ASCII | 脚本生成 | 路径正确转义/引用 |

## Tasks / Subtasks

- [ ] **T1**：--script 参数解析（AC: 1, 2, 3）
  - [ ] T1.1 Commander.js 解析 --script sh|ps
  - [ ] T1.2 实现默认逻辑：process.platform === 'win32' 时默认 ps，否则默认 sh
  - [ ] T1.3 支持 defaultScript 配置（Story 10.4 提供 ConfigManager 后读取）

- [ ] **T2**：POSIX 脚本生成（AC: 1）
  - [ ] T2.1 定义 sh 脚本模板，含 shebang、路径占位符
  - [ ] T2.2 使用 path.posix 或等效处理路径
  - [ ] T2.3 写入时使用 LF

- [ ] **T3**：PowerShell 脚本生成（AC: 2）
  - [ ] T3.1 定义 ps1 脚本模板
  - [ ] T3.2 路径处理适配 Windows
  - [ ] T3.3 写入时使用 CRLF，UTF-8 编码（考虑 BOM 以兼容 PowerShell 5.1）

- [ ] **T4**：脚本输出位置与集成（AC: 4）
  - [ ] T4.1 确定脚本输出路径（如 _bmad/scripts/ 或项目根）
  - [ ] T4.2 脚本内容可正确调用 bmad-speckit init/check 等
  - [ ] T4.3 路径含空格时正确引用

## Dev Notes

### 架构约束

- 依赖 Story 10.1 的 init 流程；脚本生成在 init 完成后或作为 init 的一部分
- 使用 Node.js path 模块，禁止硬编码路径分隔符
- PRD §5.7：编码 UTF-8，换行符按 OS 或配置

### 禁止词

文档与实现中禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### References

- [PRD §5.2] --script sh|ps
- [PRD §5.7] 跨平台、编码、换行符
- [Epics] Epic 10 Story 10.3

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
