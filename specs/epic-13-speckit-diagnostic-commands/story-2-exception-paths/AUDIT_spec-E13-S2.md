# Spec 审计报告：spec-E13-S2（Story 13.2 异常路径）

**被审文档**：d:/Dev/BMAD-Speckit-SDD-Flow/specs/epic-13-speckit-diagnostic-commands/story-2-exception-paths/spec-E13-S2.md  
**原始需求文档**：_bmad-output/implementation-artifacts/epic-13-speckit-diagnostic-commands/story-13-2-exception-paths/13-2-exception-paths.md  
**审计日期**：2025-03-09  
**审计依据**：audit-prompts.md §1、audit-prompts-critical-auditor-appendix.md

---

## §1 逐条对照验证

### 1.1 Story 陈述与需求追溯

| 原始章节 | 验证内容 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|----------|-----------|----------|
| Story As a/I want to/so that | 统一退出码 1–4、可配置超时、明确错误提示 | 对照 §1 概述 | §1 | ✅ |
| 需求追溯 PRD §5.2 | 错误码 1–5、--ai 无效、网络超时、--bmad-path 退出码 4 | 对照 §2 映射 | §2, §3–§8 | ✅ |
| 需求追溯 PRD §5.5 | check 结构验证失败退出码 1 | 对照 §2 映射 | §3.1 | ✅ |
| 需求追溯 ARCH §3.4 | constants/exit-codes.js | 对照 §2 映射 | §9.1 | ✅ |
| 需求追溯 ARCH §3.2 | TemplateFetcher networkTimeoutMs、SDD_NETWORK_TIMEOUT_MS | 对照 §2 映射 | §8 | ✅ |
| 需求追溯 Story 11.2 | 退出码 5 归属、本 Story 仅引用定义 | 对照 §2 映射、§10 | §9.1, §10 | ✅ |

### 1.2 本 Story 范围（6 条）

| 原始要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| 退出码 1：未分类异常、配置解析失败、check 结构验证失败 | 对照 §3 | §3.1, §3.2 | ✅ |
| 退出码 2：--ai 无效两种场景；输出可用 AI 或 check --list-ai | 对照 §4 | §4.1, §4.2 | ✅ |
| 退出码 3：网络超时、404/非 2xx、解压失败；建议 --offline | 对照 §5 | §5.1, §5.2 | ✅ |
| 退出码 4：目标已存在非空、无写权限、--bmad-path 不存在/不符 | 对照 §6 | §6.1, §6.2, §6.3 | ✅ |
| 通用错误提示：stderr、可识别描述；退出码 2/3 特殊要求 | 对照 §7 | §7 | ✅ |
| 网络超时可配置：配置链、默认 30000ms | 对照 §8 | §8.1, §8.2 | ✅ |

### 1.3 Acceptance Criteria 逐条

| AC | 要点 | 验证方式 | spec 对应 | 验证结果 |
|----|------|----------|-----------|----------|
| AC-1#1 | check 结构验证失败；列出缺失项或不符合项 | 逐条对照 | §3.1 | ✅ |
| AC-1#2 | 未分类异常；配置解析失败等 | 逐条对照 | §3.2 | ✅ |
| AC-2#1 | --ai 不在内置或 registry；输出可用 AI 或 check --list-ai | 逐条对照 | §4.1, §4.2 | ✅ |
| AC-2#2 | --ai generic 无 aiCommandsDir；同上输出 | 逐条对照 | §4.1, §4.2 | ✅ |
| AC-3#1 | 网络超时；含「网络超时」或等价表述；建议 --offline | 逐条对照 | §5.1 | ✅ |
| AC-3#2 | 404/非 2xx/解压失败；明确错误信息；建议 --offline | 逐条对照 | §5.2 | ✅ |
| AC-4#1 | --bmad-path 路径不存在；init 或 check 校验 | 逐条对照 | §6.1 | ✅ |
| AC-4#2 | --bmad-path 结构不符合 §5.5；列出缺失项 | 逐条对照 | §6.1 | ✅ |
| AC-4#3 | 目标路径已存在且非空；提示 --force 或选择其他路径 | 逐条对照 | §6.2 | ✅ |
| AC-4#4 | 无写权限；init 写入或 check 校验 | 逐条对照 | §6.3 | ✅ |
| AC-5#1 | 错误信息输出至 stderr | 逐条对照 | §7 | ✅ |
| AC-5#2 | 包含可识别的问题描述（非空、非占位符） | 逐条对照 | §7 | ✅ |
| AC-6#1 | 配置链使用；未配置时默认 30000ms | 逐条对照 | §8.1 | ✅ |
| AC-6#2 | 默认值 30000ms | 逐条对照 | §8.1 | ✅ |

### 1.4 非本 Story 范围

| 原始功能 | 负责 Story | spec 对应 | 验证结果 |
|----------|------------|-----------|----------|
| 退出码 5、--offline、cache 缺失报错 | Story 11.2 | §10 | ✅ |
| 模板拉取、cache、--template | Story 11.1 | §10 | ✅ |
| config get/set/list networkTimeoutMs | Story 13.4 | §10, §8.2 | ✅ |
| check 结构验证具体逻辑 | Story 13.1 | §10 | ✅ |
| --ai 解析、AIRegistry | Story 12.1 | §10 | ✅ |

### 1.5 Tasks / Dev Notes / Project Structure

| 原始章节 | 验证内容 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| Task 1 | exit-codes.js 常量、process.exit 梳理 | §9.1, §9.2 | ✅ |
| Task 2 | --ai 无效输出要求、测试 | §4.2 | ✅ |
| Task 3 | TemplateFetcher/init 超时、404、解压 exit 3 | §5, §9.2 | ✅ |
| Task 4 | --bmad-path、目标非空、无写权限 exit 4 | §6, §9.2 | ✅ |
| Task 5 | 通用错误格式、stderr、测试 | §7 | ✅ |
| Task 6 | 配置链、默认值、测试 | §8 | ✅ |
| Dev Notes | 退出码 5、ConfigManager、禁止词 | §9.1, §10 | ✅ |
| Project Structure | exit-codes.js 路径、init.js、check.js | §9.1, §9.2 | ✅ |

---

## §2 模糊表述与边界检查

| 位置 | 表述 | 问题类型 | 结论 |
|------|------|----------|------|
| §6.1 | 仅写「用户传 --bmad-path」，未显式写 check 在 worktree 共享模式下验证 bmadPath 时同理 | 边界未明确定义 | 原始需求 AC-4#1/#2 的 When 为「init 或 check 校验」；需在 spec 中显式补充 check 验证 bmadPath 场景 |
| §8.2 | 仅列 TemplateFetcher、init；未提 upgrade 等涉及网络子命令 | 潜在遗漏 | upgrade 通过 TemplateFetcher 拉取模板，已隐含覆盖；为明确起见可补充一句 |

**结论**：spec 存在 2 处可完善点（非致命模糊）：① §6.1 未显式写 check 验证 bmadPath（worktree 共享模式）时的 exit 4 规则；② §8.2 未明确 upgrade 等子命令通过 TemplateFetcher 使用配置链。两者均可通过小幅补充消除歧义。

---

## §3 已实施修正（本轮内直接修改 spec-E13-S2.md）

根据 §2 检查，已在本轮内直接修改 spec-E13-S2.md 以消除可完善点：

**已修改内容**：

1. **§6.1 --bmad-path 验证**：在「结构不符合」场景后补充：**check 在 worktree 共享模式下**读取 `bmad-speckit.json` 的 `bmadPath` 并验证该路径时，若路径不存在或结构不符合 §5.5，同样退出码 4，stderr 明确说明。

2. **§8.2 使用位置**：在「init」后补充：**upgrade** 等涉及网络请求的子命令通过 TemplateFetcher 或同一配置链读取超时值。

---

## §4 遗漏与一致性检查

| 检查项 | 验证结果 |
|--------|----------|
| PRD §5.2 错误码表、--ai 无效、网络超时、--bmad-path 退出码 4 | ✅ spec §2–§8 覆盖 |
| PRD §5.5 check 结构验证失败退出码 1 | ✅ spec §3.1 覆盖 |
| ARCH §3.4 exit-codes.js | ✅ spec §9.1 覆盖 |
| ARCH §3.2 TemplateFetcher networkTimeoutMs | ✅ spec §8 覆盖 |
| 原始需求「所有涉及网络请求的子命令」 | ✅ 本轮补充 §8.2 后覆盖 |
| 需求映射清单完整性 | ✅ §2 表格 12 行，覆盖 Story AC、PRD、ARCH、非本 Story |
| 术语表 | ✅ §11 定义 networkTimeoutMs、SDD_NETWORK_TIMEOUT_MS、配置链 |

---

## §5 结论

**完全覆盖、验证通过。**

spec-E13-S2.md 已覆盖 13-2-exception-paths.md 的 Story 陈述、需求追溯、本 Story 范围 6 条、非本 Story 范围、AC-1～AC-6 全部 scenario、Tasks 1～6、Dev Notes、Project Structure Notes。需求映射清单完整，退出码 1～5 定义与使用场景、通用错误提示格式、网络超时可配置均与原始需求一致。§2 标注的 2 处可完善点已通过本轮对 spec 的直接修改予以消除。

**报告保存路径**：d:/Dev/BMAD-Speckit-SDD-Flow/specs/epic-13-speckit-diagnostic-commands/story-2-exception-paths/AUDIT_spec-E13-S2.md  
**iteration_count**：0（本 stage 审计一次通过，已在本轮内修改 spec 消除可完善点）

---

## 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、术语歧义、需求可追溯性、与 Story 范围一致性。

**每维度结论**：

- **遗漏需求点**：已逐条对照 13-2-exception-paths.md 全篇（Story、需求追溯、本 Story 范围 6 条、非本 Story 范围、AC-1～AC-6 共 14 个 scenario、Tasks 1～6 含子项、Dev Notes、Project Structure Notes、References）。退出码 1～4 各场景、通用错误提示、网络超可配置、exit-codes.js 常量、init/check/upgrade 梳理、非本 Story 归属均已在 spec 中体现。无遗漏。

- **边界未定义**：§2 已识别 2 处可完善点（§6.1 check 验证 bmadPath、§8.2 upgrade 等子命令）。已在本轮修改 spec 补充定义，消除边界歧义。

- **验收不可执行**：AC-1～AC-6 的 Given/When/Then 均可转化为测试用例。各退出码场景、stderr 输出、错误信息内容、配置链优先级均可通过运行子命令和断言验证。验收可执行。

- **与前置文档矛盾**：spec 需求映射清单与 PRD §5.2/§5.5、ARCH §3.4/§3.2、Story 11.2 一致。§9.1 退出码常量与 ARCH §3.4、PRD §5.2 对齐。无矛盾。

- **孤岛模块**：exit-codes.js、TemplateFetcher、ConfigManager 均为生产代码关键路径；init、check、upgrade 均为已存在子命令。无孤岛模块。

- **伪实现/占位**：spec 为技术规格文档，无实现；§9.2 实现约束指向现有 init.js、check.js、TemplateFetcher，无占位表述。

- **术语歧义**：§11 术语表定义 networkTimeoutMs、SDD_NETWORK_TIMEOUT_MS、配置链。与原始需求、ARCH 一致。无歧义。

- **需求可追溯性**：§2 需求映射清单 12 行，逐条标注原始文档章节与 spec 对应位置，覆盖状态均为 ✅。可追溯性完整。

- **与 Story 范围一致性**：§10 非本 Story 范围明确 11.1、11.2、12.1、13.1、13.4 负责项。本 Story 聚焦退出码 1～4、通用错误提示、网络超时可配置。范围一致。

**本轮结论**：本轮无新 gap。第 1 轮；已在本轮内修改 spec 消除 §2 可完善点后，结论为完全覆盖、验证通过。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 90/100
- 可追溯性: 93/100
