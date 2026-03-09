# Story 10.3: 跨平台脚本生成

Status: ready-for-dev

## Story

**As a** DevOps 工程师，  
**I want to** 在 init 时通过 `--script sh` 或 `--script ps` 生成对应平台的包装脚本，并保证路径、编码、换行符符合各平台惯例，  
**so that** 在 Windows 上可直接用 PowerShell 调用，在 macOS/Linux 上可用 POSIX shell 调用，且脚本在各自环境下无乱码与换行问题。

## 需求追溯

| 来源 | 章节/ID | 映射内容 |
|------|---------|----------|
| PRD | US-7 | 跨平台脚本生成：--script sh/ps、路径/编码/换行符 |
| PRD | §5.7 | 路径用 path 模块；--script ps 生成 PowerShell、--script sh 生成 POSIX；编码 UTF-8；换行符按 OS 或用户配置（LF/CRLF） |
| PRD | §5.9 | defaultScript 全局配置（defaultAI、defaultScript、templateSource 等） |
| ARCH | §5.1 | 路径：Node.js path 模块，禁止硬编码 `/` 或 `\` |
| ARCH | §5.2 | --script sh 生成 POSIX；--script ps 生成 PowerShell 7+（5.1 降级支持） |
| ARCH | §5.3 | 编码与换行符：统一 UTF-8；Windows 控制台考虑；生成文件按 OS 或用户配置 LF/CRLF |
| Epics | 10.3 | 跨平台脚本生成：--script sh/ps、路径/编码/换行符、Windows 默认 ps |

## 本 Story 范围

- **`--script sh`**：生成 POSIX shell 脚本；Windows 上需用户自备 Git Bash 或 WSL 执行。
- **`--script ps`**：生成 PowerShell 脚本；目标 PowerShell 7+，5.1 降级支持。
- **脚本路径**：脚本内路径使用 Node.js `path` 模块生成，禁止硬编码 `/` 或 `\`；生成脚本的落盘路径固定为 `<项目根>/_bmad/scripts/bmad-speckit/`，文件名为 `bmad-speckit.sh` 或 `bmad-speckit.ps1`（本 Story 不支持可配置目录）。
- **编码**：生成脚本文件统一 UTF-8；输出到控制台时考虑 Windows 代码页（如 chcp 65001 或等价处理）。
- **换行符**：当前版本仅按 OS 决定（Windows 为 CRLF，非 Windows 为 LF）；用户可配置换行符由后续 Story 负责。与 PRD §5.7、ARCH §5.3 中「按 OS 或用户配置」的当前实现范围一致。
- **Windows 默认 ps**：当运行平台为 Windows 且用户未传 `--script` 时，默认使用 `ps`；默认值可被全局配置 `defaultScript` 覆盖（`defaultScript` 的读取与持久化由 Story 10.4 负责，本 Story 仅在 init 流程中调用「当前有效 defaultScript」参与默认值决策）。

## 非本 Story 范围（由其他 Story 负责）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 交互式 init、Banner、AI 选择器、--force、--modules | Story 10.1 | 由 Story 10.1 负责 |
| 非交互式 init（--ai、--yes、TTY 检测） | Story 10.2 | 由 Story 10.2 负责 |
| defaultScript 的持久化（写入 ~/.bmad-speckit/config.json、bmad-speckit.json）与项目级覆盖 | Story 10.4 | 由 Story 10.4 负责：ConfigManager 读写 defaultScript，init 时本 Story 仅读取「当前有效 defaultScript」用于未传 --script 时的默认值 |
| --bmad-path worktree 共享 | Story 10.5 | 由 Story 10.5 负责 |

## Acceptance Criteria

### AC-1: --script sh 生成 POSIX 脚本

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 显式 sh | 用户传 `--script sh` | init 执行 | 生成 POSIX shell 脚本，路径使用 path 模块、编码 UTF-8、换行符按配置 |
| 2 | 非 Windows 默认 | 运行在 macOS 或 Linux 且未传 --script | init 执行 | 默认生成 sh 脚本（或按 defaultScript，若已由 10.4 提供） |

### AC-2: --script ps 生成 PowerShell 脚本

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 显式 ps | 用户传 `--script ps` | init 执行 | 生成 PowerShell 脚本，路径与编码换行符合 ARCH §5.2、§5.3 |
| 2 | Windows 默认 | 运行在 Windows 且未传 --script | init 执行 | 默认生成 ps 脚本（或按 defaultScript，若已由 10.4 提供） |

### AC-3: 路径、编码、换行符

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 路径 | 任意平台 | 生成脚本内容 | 脚本内路径通过 Node.js path 生成，无硬编码 `/` 或 `\` |
| 2 | 编码 | 生成脚本文件 | 写入磁盘 | 文件编码为 UTF-8 |
| 3 | 换行符 | 生成脚本文件 | 写入磁盘 | 当前版本仅按 OS（Windows 为 CRLF，非 Windows 为 LF）；用户可配置换行符由后续 Story 负责 |
| 4 | Windows 控制台 | 在 Windows 上输出与脚本相关提示 | init 运行 | 考虑代码页（如 UTF-8），避免乱码 |

### AC-4: defaultScript 参与默认值（与 Story 10.4 衔接）

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| 1 | 有 defaultScript | ConfigManager 已提供 defaultScript（Story 10.4 实现后） | 用户未传 --script | 使用 defaultScript 作为脚本类型 |
| 2 | 无 defaultScript | 无全局/项目 defaultScript | 用户未传 --script | Windows 用 ps，非 Windows 用 sh |

## Tasks / Subtasks

- [ ] **T1**：--script 参数与默认值（AC: 1, 2, 4）
  - [ ] T1.1 在 InitCommand 中解析 `--script sh|ps`，合法值为 `sh`、`ps`，非法值报错并退出
  - [ ] T1.2 未传 --script 时：若平台为 Windows，默认 `ps`；否则默认 `sh`；若 ConfigManager 提供 defaultScript，则以其覆盖上述默认（Story 10.4 未完成时仅用平台默认）
  - [ ] T1.3 将最终选定的 script 类型传入脚本生成逻辑，供 T2/T3 使用

- [ ] **T2**：POSIX shell 脚本生成（AC: 1, 3）
  - [ ] T2.1 实现 sh 模板或生成逻辑：脚本内路径用 `path` 模块（或生成时传入已用 path 处理过的路径），编码 UTF-8，换行符按配置
  - [ ] T2.2 落盘路径与项目结构一致（如 `_bmad/scripts/bmad-speckit/` 或 PRD/ARCH 约定），文件名与扩展名符合 POSIX 惯例

- [ ] **T3**：PowerShell 脚本生成（AC: 2, 3）
  - [ ] T3.1 实现 ps 模板或生成逻辑：路径、编码、换行符符合 ARCH §5.2、§5.3；目标 PowerShell 7+，5.1 降级支持
  - [ ] T3.2 落盘路径与项目结构一致，扩展名 `.ps1`

- [ ] **T4**：编码与换行符工具（AC: 3）
  - [ ] T4.1 生成文件时统一 UTF-8 写入；换行符根据 OS 或用户配置（LF/CRLF）写入，与 PRD §5.7 一致
  - [ ] T4.2 若存在 ARCH 提到的 encoding 相关模块（如 `encoding.js`），复用；否则在本 Story 内实现生成时的编码与换行符处理，且不硬编码平台分隔符

- [ ] **T5**：集成与校验
  - [ ] T5.1 在 init 流程中在合适步骤调用脚本生成（在模板拉取与 AI 配置同步之后），传入目标目录、所选 script 类型、path 处理后的路径
  - [ ] T5.2 验收：`init --script sh` 与 `init --script ps` 各执行一次，检查生成脚本的编码、换行符、路径；在 Windows 上不传 --script 时默认生成 ps

## Dev Notes

### 架构约束

- 依赖 Story 10.1 的 InitCommand、目录结构、模板拉取与同步流程；脚本生成作为 init 的一个步骤，不改变 10.1 的总体流程顺序。
- 路径：全程使用 Node.js `path` 模块，禁止硬编码 `/` 或 `\`（PRD §5.7、ARCH §5.1）。
- defaultScript 的读取：通过 ConfigManager（Story 10.4）；若 10.4 未完成，则仅使用「Windows → ps、非 Windows → sh」的默认规则。

### 禁止词

文档与实现中禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### Previous Story Intelligence（Story 10.1、10.2）

- **InitCommand**：位于 `packages/bmad-speckit/src/commands/init.js`，已实现 Banner、AI 选择、路径确认、模板版本、执行。本 Story 在「执行」阶段增加脚本生成子步骤，并增加 `--script` 解析与默认值逻辑。
- **path 模块**：Story 10.1/10.2 已在使用 path；脚本内容中的路径占位符或拼接须在生成时用 path 处理，保证跨平台。
- **ConfigManager**：Story 10.4 实现 defaultScript 的读写；本 Story 在未传 --script 时调用 ConfigManager 的 defaultScript（若存在），否则用平台默认。

### Project Structure Notes

- 脚本落盘：与 PRD §5.10、ARCH 一致，如 `_bmad/scripts/bmad-speckit/` 下生成对应 `.sh` 或 `.ps1` 文件；具体目录以现有 10.1 实现为准。
- 若项目已有 `encoding.js` 或类似工具（ARCH §1 提及），优先复用；否则在 packages/bmad-speckit 内实现最小可用的 UTF-8 + 换行符写入逻辑。

### References

- [Source: _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md §5.7 跨平台]
- [Source: _bmad-output/planning-artifacts/dev/PRD_specify-cn-like-init-multi-ai-assistant.md §5.9 配置持久化、defaultScript]
- [Source: _bmad-output/planning-artifacts/dev/ARCH_specify-cn-like-init-multi-ai-assistant.md §5 跨平台与编码]
- [Source: _bmad-output/planning-artifacts/dev/epics.md Epic 10、Story 10.3]

## Dev Agent Record

### Agent Model Used

（实施时填写）

### Debug Log References

### Completion Notes List

### File List
