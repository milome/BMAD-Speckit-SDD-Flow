# Plan E13-S2: 异常路径实现方案

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.2 - 异常路径（exception-paths）  
**输入**: spec-E13-S2.md, 13-2-exception-paths.md, PRD §5.2/§5.5, ARCH §3.4/§3.2

---

## 1. 概述

本 plan 定义 Story 13.2 的实现方案：确保退出码 1～4 与通用错误提示格式在 init、check、upgrade、TemplateFetcher 中统一；梳理并修正所有 process.exit 调用；确保网络超时由 networkTimeoutMs/SDD_NETWORK_TIMEOUT_MS 配置链控制，默认 30000ms。退出码 5 由 Story 11.2 负责，本 Story 仅确保常量存在。

---

## 2. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story AC-1 | spec §3.1, §3.2 | Phase 2、Phase 3、集成测试 | ✅ |
| Story AC-2 | spec §4.1, §4.2 | Phase 4、集成测试 | ✅ |
| Story AC-3 | spec §5.1, §5.2 | Phase 5、集成测试 | ✅ |
| Story AC-4 | spec §6.1–§6.3 | Phase 6、Phase 2、集成测试 | ✅ |
| Story AC-5 | spec §7 | 全 Phase、Phase 7 | ✅ |
| Story AC-6 | spec §8 | Phase 8、集成测试 | ✅ |
| PRD §5.2 | spec §3–§8 | 全 Phase | ✅ |
| ARCH §3.4 | spec §9.1 | Phase 1 | ✅ |
| ARCH §3.2 | spec §8 | Phase 8 | ✅ |

---

## 3. 技术架构

### 3.1 现有实现分析

| 模块 | 路径 | 当前状态 |
|------|------|----------|
| exit-codes.js | `src/constants/exit-codes.js` | 已含 SUCCESS/GENERAL_ERROR/AI_INVALID/NETWORK_TEMPLATE_FAILED/TARGET_PATH_UNAVAILABLE/OFFLINE_CACHE_MISSING |
| init.js | `src/commands/init.js` | 已使用 exitCodes；已有 resolveNetworkTimeoutMs；--ai 无效已输出 check --list-ai 提示 |
| check.js | `src/commands/check.js` | 结构验证失败 exit 1；bmadPath 失败 exit 4 |
| TemplateFetcher | `src/services/template-fetcher.js` | 使用 opts.networkTimeoutMs、SDD_NETWORK_TIMEOUT_MS；需补项目/全局配置链 |

### 3.2 配置链优先级（spec §8.1）

1. 环境变量 `SDD_NETWORK_TIMEOUT_MS`
2. 项目级 networkTimeoutMs（bmad-speckit.json 或 ConfigManager）
3. 全局 networkTimeoutMs
4. 默认 30000ms

init.js 已有 resolveNetworkTimeoutMs 实现；TemplateFetcher 需接入该逻辑或等价实现。

### 3.3 集成测试与端到端测试计划（必须）

| 测试类型 | 覆盖内容 | 验收方式 |
|---------|---------|---------|
| **退出码 1** | check 结构验证失败；init 未预期异常（如配置解析失败） | 临时目录 fixture，断言 exitCode 1，stderr 含可识别描述 |
| **退出码 2** | --ai 无效（name 不在列表）；--ai generic 无 aiCommandsDir | 断言 exitCode 2，stderr 含可用 AI 列表或 check --list-ai 提示 |
| **退出码 3** | 网络超时（mock）；404/解压失败 | mock HTTP，断言 exitCode 3，stderr 含「网络超时」或等价表述及 --offline 建议 |
| **退出码 4** | --bmad-path 不存在/不符；目标已存在非空无 --force；无写权限 | 临时目录 fixture，断言 exitCode 4，stderr 明确说明 |
| **网络超时配置** | SDD_NETWORK_TIMEOUT_MS、项目配置、默认 30000 | 断言 TemplateFetcher/init 使用正确超时值 |
| **端到端** | init 各异常路径 → 脚本可据 $? 判断 | 覆盖代表性场景 |

---

## 4. 实现阶段（Phases）

### Phase 1: 退出码常量校验（spec §9.1）

**目标**：确认 exit-codes.js 含全部常量，与 ARCH §3.4 一致。

**实现要点**：
1. 读取 `packages/bmad-speckit/src/constants/exit-codes.js`
2. 确认 SUCCESS(0)、GENERAL_ERROR(1)、AI_INVALID(2)、NETWORK_TEMPLATE_FAILED(3)、TARGET_PATH_UNAVAILABLE(4)、OFFLINE_CACHE_MISSING(5)
3. 若缺失则补充

**产出**：exit-codes.js 完整

### Phase 2: 梳理 process.exit 调用（spec §9.2）

**目标**：init、check、upgrade 等子命令中所有 process.exit 与退出码约定一致。

**实现要点**：
1. grep 全仓库 `process.exit` 与 `exitCodes.`
2. 逐项对照 spec §3–§6：结构验证失败→1；--ai 无效→2；网络/模板→3；路径不可用→4
3. 修正不一致调用（若有）
4. upgrade 若存在，纳入梳理

**产出**：退出码映射表（文档或注释）、代码修正

### Phase 3: 退出码 1 与通用错误格式（spec §3、§7）

**目标**：check 结构验证失败、未分类异常统一 exit 1，stderr 输出可识别描述。

**实现要点**：
1. check.js：结构验证失败已 exit 1，确保 stderr 列出缺失项
2. init.js：catch 块中未分类异常 exit 1，确保 err.message 或等价可识别描述输出至 stderr
3. 禁止空消息或占位符

**产出**：修改 check.js、init.js（若需）

### Phase 4: 退出码 2（--ai 无效）输出（spec §4）

**目标**：--ai 无效时输出可用 AI 列表或明确提示 `bmad-speckit check --list-ai`。

**实现要点**：
1. init.js 已有 `Run "bmad-speckit check --list-ai" for full list.` 及 `Available: ${list}`
2. 验证 list 来源为 AIRegistry.listIds 或等效；若无则调用 check --list-ai 逻辑
3. --ai generic 无 aiCommandsDir 时同样输出可用 AI 或 check --list-ai 提示
4. 补充或调整单元/集成测试

**产出**：修改 init.js（若需）、测试用例

### Phase 5: 退出码 3（网络/模板）（spec §5）

**目标**：TemplateFetcher 与 init 在超时、404、解压失败时统一 exit 3，错误信息含「网络超时」或等价表述，建议 --offline 或检查网络。

**实现要点**：
1. TemplateFetcher fetchFromGitHub：超时错误 throw 时 message 含「网络超时」或等价表述
2. 404、非 2xx、解压失败：throw message 明确，init catch 时 exit 3
3. init catch 块：err.code === 'NETWORK_TEMPLATE' 或 message 含网络/模板相关词时 exit 3，stderr 建议 --offline 或检查网络
4. 补充单元/集成测试（mock HTTP 超时、404）

**产出**：修改 template-fetcher.js、init.js、测试

### Phase 6: 退出码 4（路径不可用）（spec §6）

**目标**：--bmad-path 验证、目标已存在非空、无写权限统一 exit 4。

**实现要点**：
1. init.js：--bmad-path 路径不存在/结构不符、目标已存在非空无 --force、无写权限已用 exit 4
2. check.js：bmadPath 验证失败已 exit 4；worktree 共享模式验证 bmadPath 时同样 exit 4
3. 确保 stderr 明确说明路径不可用原因
4. 补充或调整测试

**产出**：修改 init.js、check.js（若需）、测试

### Phase 7: 通用错误提示格式（spec §7）

**目标**：所有异常路径错误输出至 stderr，每条含可识别问题描述。

**实现要点**：
1. 审查 init、check、TemplateFetcher 调用方 catch 块：是否统一 stderr
2. 禁止空串、占位符（如 "Error:" 无后续）
3. 为各退出码场景补充测试，验证错误信息格式

**产出**：代码审查结论、测试

### Phase 8: 网络超时可配置（spec §8）

**目标**：TemplateFetcher 与 init 从配置链读取 networkTimeoutMs，默认 30000ms。

**实现要点**：
1. init.js 已有 resolveNetworkTimeoutMs；init 调用 TemplateFetcher 时传入 networkTimeoutMs: resolveNetworkTimeoutMs(options)
2. TemplateFetcher fetchFromGitHub：opts.networkTimeoutMs 优先；若无则读取 SDD_NETWORK_TIMEOUT_MS；再读项目/全局 ConfigManager.networkTimeoutMs；默认 30000
3. 抽离 shared util（如 `resolveNetworkTimeoutMs`）或在 TemplateFetcher 内实现等价逻辑，与 init 一致
4. upgrade 等涉及网络的子命令同样传入 networkTimeoutMs
5. 单元/集成测试：断言 SDD_NETWORK_TIMEOUT_MS、项目配置、默认值生效

**产出**：修改 template-fetcher.js、init.js（若需）、测试

---

## 5. 测试策略

| 层级 | 覆盖 |
|------|------|
| 单元 | 各退出码分支；networkTimeoutMs 配置链；错误信息格式 |
| 集成 | init/check 各异常路径 CLI 执行；TemplateFetcher 超时/404 |
| 端到端 | 脚本通过 $? 区分失败类型；代表性场景 |

---

## 6. 依赖与约束

- **依赖**：Story 11.1（TemplateFetcher 基础）、Story 12.1（AIRegistry）、Story 13.1（check 结构验证）、ConfigManager
- **约束**：禁止伪实现；所有 process.exit 须与 spec 一致；错误信息禁止空或占位符
- **非本 Story**：退出码 5 实现（Story 11.2）；config get/set/list networkTimeoutMs（Story 13.4）

<!-- AUDIT: PASSED by code-reviewer -->
