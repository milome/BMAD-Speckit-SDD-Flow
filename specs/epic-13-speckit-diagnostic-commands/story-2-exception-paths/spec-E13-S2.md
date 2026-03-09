# Spec E13-S2: 异常路径（退出码 1/2/3/4、通用错误提示、网络超时可配置）

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.2 - 异常路径（exception-paths）  
**输入**: 13-2-exception-paths.md, PRD §5.2/§5.5, ARCH §3.4 退出码约定、§3.2 TemplateFetcher

---

## 1. 概述

本 spec 定义 Story 13.2（异常路径）的技术规格，覆盖：

- **退出码 1（通用/结构验证失败）**：未分类异常、配置解析失败、check 结构验证失败
- **退出码 2（--ai 无效）**：`--ai` 指定 name 不在内置或 registry；`--ai generic` 无 aiCommandsDir
- **退出码 3（网络/模板）**：网络超时、404、非 2xx、解压失败
- **退出码 4（路径不可用）**：目标路径已存在且非空、无写权限、`--bmad-path` 不存在或结构不符
- **通用错误提示格式**：stderr 输出、可识别的问题描述；退出码 2 时输出可用 AI 列表或 `check --list-ai` 提示
- **网络超时可配置**：networkTimeoutMs / SDD_NETWORK_TIMEOUT_MS，默认 30000ms；配置链与 Story 11.1、ARCH §4.1 一致

退出码 5（离线 cache 缺失）由 Story 11.2 负责，本 Story 仅确保 exit-codes.js 含 OFFLINE_CACHE_MISSING(5)。

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story AC-1 | 退出码 1：check 结构验证失败、未分类异常 | §3.1, §3.2 | ✅ |
| Story AC-2 | 退出码 2：--ai 无效；输出可用 AI 或 check --list-ai 提示 | §4.1, §4.2 | ✅ |
| Story AC-3 | 退出码 3：网络超时、404、解压失败；建议 --offline 或检查网络 | §5.1, §5.2 | ✅ |
| Story AC-4 | 退出码 4：--bmad-path 不存在/不符、目标已存在非空、无写权限 | §6.1, §6.2, §6.3 | ✅ |
| Story AC-5 | 通用错误提示：stderr、可识别描述 | §7 | ✅ |
| Story AC-6 | 网络超时可配置：配置链、默认 30000ms | §8 | ✅ |
| PRD §5.2 | 错误码 1–5、--ai 无效、网络超时、--bmad-path 退出码 4 | §3–§8 | ✅ |
| PRD §5.5 | check 结构验证失败退出码 1 | §3.1 | ✅ |
| ARCH §3.4 | constants/exit-codes.js | §2 | ✅ |
| ARCH §3.2 | TemplateFetcher networkTimeoutMs、SDD_NETWORK_TIMEOUT_MS | §8 | ✅ |
| 非本 Story | 退出码 5、config get/set/list、check 验证逻辑、--ai 解析 | §9 | ✅ |

---

## 3. 退出码 1（通用/结构验证失败）

### 3.1 check 结构验证失败（AC-1#1）

| 场景 | 条件 | 行为 |
|------|------|------|
| 结构不符合 | _bmad、_bmad-output 或 AI 目标目录不符合 §5.5 验证清单 | 退出码 1；stderr 输出明确错误信息，列出缺失项或不符合项 |
| 触发子命令 | check | 执行验证后按结果退出 |

### 3.2 未分类异常（AC-1#2）

| 场景 | 条件 | 行为 |
|------|------|------|
| 未预期异常 | init/check 等子命令发生未预期异常（如配置解析失败） | 退出码 1；stderr 输出可识别的错误描述 |
| 实现 | 异常被捕获时统一使用 exitCodes.GENERAL_ERROR(1) |

---

## 4. 退出码 2（--ai 无效）

### 4.1 场景定义（AC-2）

| 场景 | 条件 | 行为 |
|------|------|------|
| --ai 不在列表 | 用户传 `--ai <name>`，name 不在内置列表或 registry | 退出码 2；stderr 输出包含可用 AI 列表，或明确提示 `bmad-speckit check --list-ai` |
| --ai generic 无 aiCommandsDir | 用户传 `--ai generic`，未提供 `--ai-commands-dir` 且 registry 中无 aiCommandsDir | 退出码 2；同上输出要求 |

### 4.2 输出要求

- **必须**：输出可用 AI 列表，或明确提示用户运行 `bmad-speckit check --list-ai`
- **实现**：可调用 check --list-ai 逻辑或直接输出内置 + registry 合并列表

---

## 5. 退出码 3（网络/模板）

### 5.1 网络超时（AC-3#1）

| 场景 | 条件 | 行为 |
|------|------|------|
| 超时 | HTTP(S) 请求在 networkTimeoutMs 内未返回 | 退出码 3；stderr 输出含「网络超时」或等价表述；建议 `--offline` 或检查网络 |

### 5.2 模板拉取失败（AC-3#2）

| 场景 | 条件 | 行为 |
|------|------|------|
| 404 / 非 2xx | 拉取返回 404 或非 2xx | 退出码 3；stderr 输出明确错误信息；建议 `--offline` 或检查网络 |
| 解压失败 | 解压步骤失败 | 退出码 3；同上 |

---

## 6. 退出码 4（路径不可用）

### 6.1 --bmad-path 验证（AC-4#1, #2）

| 场景 | 条件 | 行为 |
|------|------|------|
| 路径不存在 | 用户传 `--bmad-path <path>`，path 不存在 | 退出码 4；stderr 明确说明路径不存在或不可用 |
| 结构不符合 | path 存在但目录结构不符合 §5.5 验证清单 | 退出码 4；stderr 明确说明结构不符合，列出缺失项 |
| check 验证 bmadPath | check 在 worktree 共享模式下读取 bmad-speckit.json 的 bmadPath 并验证该路径时，若路径不存在或结构不符合 §5.5 | 退出码 4；stderr 明确说明路径不存在或结构不符合 |

### 6.2 目标路径已存在且非空（AC-4#3）

| 场景 | 条件 | 行为 |
|------|------|------|
| 非空且无 --force | 目标路径存在且含文件/子目录，用户未传 `--force` | 退出码 4；stderr 提示使用 `--force` 或选择其他路径 |

### 6.3 无写权限（AC-4#4）

| 场景 | 条件 | 行为 |
|------|------|------|
| 无写权限 | 目标路径无写权限 | 退出码 4；stderr 明确说明无写权限 |

---

## 7. 通用错误提示格式（AC-5）

| 要求 | 说明 |
|------|------|
| 输出通道 | 错误信息输出至 stderr（与项目现有约定一致） |
| 内容可识别 | 每条错误信息包含可识别的问题描述（非空、非占位符） |
| 退出码 2 | 须输出可用 AI 列表或提示 `check --list-ai` |
| 退出码 3 | 须建议 `--offline` 或检查网络 |

---

## 8. 网络超时可配置（AC-6）

### 8.1 配置链

优先级（高→低）：
1. 环境变量 `SDD_NETWORK_TIMEOUT_MS`
2. 项目级 `networkTimeoutMs`（如 bmad-speckit.json 或项目配置）
3. 全局 `networkTimeoutMs`
4. **默认 30000ms**

与 Story 11.1、ARCH §4.1 一致。

### 8.2 使用位置

- **TemplateFetcher**：所有 HTTP(S) 请求使用配置链得到的超时值
- **init**：涉及网络请求的子流程使用同一配置链
- **upgrade**：等涉及网络请求的子命令通过 TemplateFetcher 或同一配置链读取超时值
- **config get/set/list**：由 Story 13.4 负责；本 Story 确保 TemplateFetcher 与 init 能读取配置链

---

## 9. 退出码常量与实现约束

### 9.1 exit-codes.js

`packages/bmad-speckit/src/constants/exit-codes.js` 须含：

| 常量 | 值 | 含义 |
|------|-----|------|
| SUCCESS | 0 | 成功 |
| GENERAL_ERROR | 1 | 通用/结构验证失败 |
| AI_INVALID | 2 | --ai 无效 |
| NETWORK_TEMPLATE_FAILED | 3 | 网络/模板 |
| TARGET_PATH_UNAVAILABLE | 4 | 路径不可用 |
| OFFLINE_CACHE_MISSING | 5 | 离线 cache 缺失（Story 11.2 实现） |

### 9.2 实现约束

- **init.js**：已使用 exitCodes；需校验所有异常路径退出码与本文档一致
- **check.js**：结构验证失败 exit 1；bmadPath 验证失败 exit 4
- **TemplateFetcher**：超时、404、解压失败统一 exit 3
- **梳理**：init、check、upgrade 等子命令中所有 `process.exit` 调用须与退出码约定一致

---

## 10. 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| 退出码 5、--offline 与 cache 缺失报错 | Story 11.2 | 本 Story 仅引用 5 定义 |
| 模板拉取实现、cache、--template | Story 11.1 | 本 Story 约定网络超时与退出码 3 |
| config get/set/list networkTimeoutMs | Story 13.4 | 本 Story 确保能读取配置链 |
| check 结构验证具体逻辑 | Story 13.1 | 本 Story 约定失败时退出码 1 |
| --ai 解析、AIRegistry 实现 | Story 12.1 | 本 Story 约定 --ai 无效时退出码 2 |

---

## 11. 术语

| 术语 | 定义 |
|------|------|
| networkTimeoutMs | HTTP(S) 请求超时阈值，单位 ms |
| SDD_NETWORK_TIMEOUT_MS | 环境变量，覆盖配置文件的 networkTimeoutMs |
| 配置链 | 环境变量 > 项目级 > 全局 > 默认 30000 |

<!-- AUDIT: PASSED by code-reviewer -->
