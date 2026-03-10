# Spec E10-S3: 跨平台脚本生成

**Epic**: 10 - Speckit Init Core  
**Story**: 10.3 - 跨平台脚本生成  
**原始需求文档**: 10-3-cross-platform-script.md

---

## 1. 概述

本 spec 定义 `bmad-speckit init` 的跨平台脚本生成能力：通过 `--script sh` 或 `--script ps` 生成对应平台的包装脚本，保证路径、编码、换行符符合各平台惯例；Windows 上可直接用 PowerShell 调用，macOS/Linux 上可用 POSIX shell 调用，且脚本在各自环境下无乱码与换行问题。Windows 上未传 `--script` 时默认生成 PowerShell（`ps`）；默认值可被全局配置 `defaultScript` 覆盖（Story 10.4 负责持久化，本 Story 仅在 init 流程中调用「当前有效 defaultScript」参与默认值决策）。

---

## 2. 功能范围

### 2.1 本 Story 范围

| 功能点 | 描述 | 边界条件 |
|--------|------|----------|
| `--script sh` | 生成 POSIX shell 脚本 | Windows 上需用户自备 Git Bash 或 WSL 执行 |
| `--script ps` | 生成 PowerShell 脚本 | 目标 PowerShell 7+，5.1 降级支持 |
| 脚本路径 | 脚本内路径使用 Node.js `path` 模块生成 | 禁止硬编码 `/` 或 `\`；落盘路径固定为 `<项目根>/_bmad/scripts/bmad-speckit/`，文件名 `bmad-speckit.sh` 或 `bmad-speckit.ps1`（本 Story 不支持可配置目录） |
| 编码 | 生成脚本文件统一 UTF-8 | 输出到控制台时考虑 Windows 代码页（chcp 65001 或等价） |
| 换行符 | 当前版本仅按 OS | Windows 为 CRLF，非 Windows 为 LF；用户可配置换行符由后续 Story 负责，与 PRD §5.7、ARCH §5.3 当前实现范围一致 |
| Windows 默认 ps | 运行平台为 Windows 且未传 `--script` | 默认使用 `ps`；可被 ConfigManager 的 defaultScript 覆盖（10.4 提供） |

### 2.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 交互式 init、Banner、AI 选择器、--force、--modules | Story 10.1 | 由 Story 10.1 负责 |
| 非交互式 init（--ai、--yes、TTY 检测） | Story 10.2 | 由 Story 10.2 负责 |
| defaultScript 的持久化（写入 ~/.bmad-speckit/config.json、bmad-speckit.json）与项目级覆盖 | Story 10.4 | ConfigManager 读写 defaultScript；本 Story 仅读取「当前有效 defaultScript」用于未传 --script 时的默认值 |
| --bmad-path worktree 共享 | Story 10.5 | 由 Story 10.5 负责 |

---

## 3. 验收标准（AC）技术规格

### AC-1: --script sh 生成 POSIX 脚本

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 显式 sh | 用户传 `--script sh` | init 执行 | 生成 POSIX shell 脚本，路径使用 path 模块、编码 UTF-8、换行符按配置 |
| 非 Windows 默认 | 运行在 macOS 或 Linux 且未传 --script | init 执行 | 默认生成 sh 脚本（或按 defaultScript，若已由 10.4 提供） |

**实现要点**：
- 解析 `--script sh`，选定 script 类型为 `sh`
- 未传 --script 且非 Windows：默认 `sh`；若 ConfigManager 提供 defaultScript 则以其覆盖
- 调用 sh 模板或生成逻辑：脚本内路径用 path 处理，UTF-8 写入，换行符按配置

### AC-2: --script ps 生成 PowerShell 脚本

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 显式 ps | 用户传 `--script ps` | init 执行 | 生成 PowerShell 脚本，路径与编码换行符合 ARCH §5.2、§5.3 |
| Windows 默认 | 运行在 Windows 且未传 --script | init 执行 | 默认生成 ps 脚本（或按 defaultScript，若已由 10.4 提供） |

**实现要点**：
- 解析 `--script ps`，选定 script 类型为 `ps`
- 未传 --script 且 Windows：默认 `ps`；若 ConfigManager 提供 defaultScript 则以其覆盖
- 目标 PowerShell 7+，5.1 降级支持；生成 .ps1，路径、编码、换行符符合 ARCH

### AC-3: 路径、编码、换行符

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 路径 | 任意平台 | 生成脚本内容 | 脚本内路径通过 Node.js path 生成，无硬编码 `/` 或 `\` |
| 编码 | 生成脚本文件 | 写入磁盘 | 文件编码为 UTF-8 |
| 换行符 | 生成脚本文件 | 写入磁盘 | 当前版本仅按 OS（Windows CRLF，非 Windows LF）；用户可配置由后续 Story 负责 |
| Windows 控制台 | 在 Windows 上输出与脚本相关提示 | init 运行 | 考虑代码页（如 UTF-8），避免乱码 |

**实现要点**：
- 全程使用 `path.join`、`path.resolve` 等，禁止字符串拼接 `/` 或 `\`
- 写入文件时指定 encoding: 'utf8'；换行符当前版本仅按 OS（process.platform）决定，用户可配置由后续 Story 负责，写入时使用对应 EOL
- 若存在 encoding 相关模块（如 ARCH 提及），复用；否则在 packages/bmad-speckit 内实现最小可用的 UTF-8 + 换行符写入

### AC-4: defaultScript 参与默认值（与 Story 10.4 衔接）

| Scenario | Given | When | Then |
|----------|-------|------|------|
| 有 defaultScript | ConfigManager 已提供 defaultScript（Story 10.4 实现后） | 用户未传 --script | 使用 defaultScript 作为脚本类型 |
| 无 defaultScript | 无全局/项目 defaultScript | 用户未传 --script | Windows 用 ps，非 Windows 用 sh |

**实现要点**：
- 未传 --script 时：尝试 ConfigManager.get('defaultScript')；若为合法值（sh/ps）则采用；否则按平台：Windows → ps，非 Windows → sh
- Story 10.4 未完成时，ConfigManager 可能不存在或无 defaultScript，仅用平台默认

---

## 4. 架构约束与依赖

### 4.1 依赖 Story 10.1 / 10.2

- **InitCommand**：`packages/bmad-speckit/src/commands/init.js`，已实现 Banner、AI 选择、路径确认、模板拉取、执行；本 Story 在「执行」阶段（模板拉取与 AI 配置同步之后）增加脚本生成子步骤
- **path 模块**：Story 10.1/10.2 已在使用 path；脚本内容中的路径占位符或拼接须在生成时用 path 处理，保证跨平台
- **目录结构**：脚本落盘与 PRD §5.10、ARCH 一致，如 `_bmad/scripts/bmad-speckit/` 下生成对应 `.sh` 或 `.ps1` 文件；具体目录以现有 10.1 实现为准

### 4.2 ConfigManager（Story 10.4）

- defaultScript 的读取：通过 ConfigManager（Story 10.4）；若 10.4 未完成，则仅使用「Windows → ps、非 Windows → sh」的默认规则
- 本 Story 不实现 defaultScript 的写入或持久化

### 4.3 架构约束（PRD §5.7、ARCH §5.1–§5.3）

- **路径**：使用 Node.js `path` 模块，禁止硬编码 `/` 或 `\`
- **--script sh**：生成 POSIX；**--script ps**：生成 PowerShell 7+（5.1 降级支持）
- **编码与换行符**：统一 UTF-8；Windows 控制台考虑；生成文件按 OS 或用户配置 LF/CRLF

---

## 5. CLI 参数扩展

init 命令须新增以下选项（在 bin 与 init.js 中）：

| 选项 | 类型 | 描述 |
|------|------|------|
| `--script <sh|ps>` | string | 生成脚本类型：sh=POSIX shell，ps=PowerShell；合法值为 `sh`、`ps`，非法值报错并退出 |

**实现要点**：
- 解析 `--script`，合法值仅 `sh`、`ps`；其他值（如 `bash`、`pwsh`）报错并退出，退出码与现有错误码约定一致
- 未传时按 AC-2、AC-4 决定默认值（平台 + defaultScript）

---

## 6. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story 陈述 | 跨平台脚本生成，--script sh/ps，路径/编码/换行符，Windows 默认 ps | §1 概述、§2.1、§3 | ✅ |
| 需求追溯 PRD US-7 | 跨平台脚本生成：--script sh/ps、路径/编码/换行符 | §2.1、§3 AC-1～AC-4 | ✅ |
| 需求追溯 PRD §5.7 | 路径 path 模块；--script ps 生成 PowerShell、--script sh 生成 POSIX；编码 UTF-8；换行符按 OS 或用户配置 | §2.1、§3 AC-3、§4.3 | ✅ |
| 需求追溯 PRD §5.9 | defaultScript 全局配置 | §2.1、§3 AC-4、§4.2 | ✅ |
| 需求追溯 ARCH §5.1 | 路径：Node.js path 模块，禁止硬编码 | §2.1、§3 AC-3、§4.3 | ✅ |
| 需求追溯 ARCH §5.2 | --script sh 生成 POSIX；--script ps 生成 PowerShell 7+（5.1 降级） | §2.1、§3 AC-1、AC-2、§5 | ✅ |
| 需求追溯 ARCH §5.3 | 编码与换行符：统一 UTF-8；Windows 控制台考虑；生成文件按 OS 或用户配置 LF/CRLF | §2.1、§3 AC-3、§4.3 | ✅ |
| Epics 10.3 | 跨平台脚本生成：--script sh/ps、路径/编码/换行符、Windows 默认 ps | §2.1、§3、§4 | ✅ |
| 本 Story 范围 --script sh/ps | 生成对应平台脚本，路径/编码/换行符 | §3 AC-1、AC-2、§5 | ✅ |
| 本 Story 范围 路径/编码/换行符 | path 模块、UTF-8、LF/CRLF、Windows 控制台 | §3 AC-3 | ✅ |
| 本 Story 范围 Windows 默认 ps | 未传 --script 时 Windows 默认 ps；defaultScript 可覆盖 | §3 AC-2、AC-4、§4.2 | ✅ |
| 非本 Story 范围 | 10.1/10.2/10.4/10.5 职责 | §2.2 | ✅ |
| AC-1～AC-4 表 | 各 Scenario Given/When/Then | §3 对应 AC 节 | ✅ |
| Dev Notes 架构约束 | 依赖 10.1、path、ConfigManager、目录结构 | §4 | ✅ |

<!-- AUDIT: PASSED by code-reviewer --> 参见 AUDIT_spec-E10-S3.md
