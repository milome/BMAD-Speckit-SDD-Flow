# IMPLEMENTATION_GAPS E13-S1: check 与 version 子命令

**Epic**: 13 - Speckit Diagnostic Commands  
**Story**: 13.1 - check 与 version 子命令  
**输入**: plan-E13-S1.md, spec-E13-S1.md, 当前实现

---

## 1. 概述

本文档对照 plan、spec 与当前 bmad-speckit 实现，逐章节列出实现差距（Gap），供 tasks 拆解与执行。

**当前实现范围**：
- `check.js`：存在；有 --list-ai、bmadPath 验证、selectedAI 部分目标验证、subagentSupport 输出；使用 exit 4（bmadPath 不可用）、1（结构/AI 目标失败）
- `version.js`：**不存在**
- `bin/bmad-speckit.js`：仅注册 init、check，**无 version 子命令**
- `structure-validate.js`：仅验证 _bmad 根，**无 _bmad-output/config/** 验证
- check：**无诊断报告**（aiToolsInstalled、cliVersion、templateVersion、envVars）
- check：**无 --json**、**无 --ignore-agent-tools**
- check --list-ai：**无 --json**
- validateSelectedAITargets：**缺 gemini、windsurf、kilocode、auggie、roo** 映射
- **无 detectCommand 检测**逻辑
- 无 selectedAI 时**未验证 .cursor 作为向后兼容默认**

---

## 2. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §4、AC3 | GAP-1.1 | VersionCommand：version 子命令 | 未实现 | 无 version.js，bin 未注册 |
| spec §4.1、AC3 | GAP-1.2 | version 输出 cliVersion、templateVersion、nodeVersion | 未实现 | 无 version 模块 |
| spec §4、AC3 | GAP-1.3 | version --json | 未实现 | 无 version 模块 |
| spec §3.1、AC1 | GAP-2.1 | check 诊断报告：aiToolsInstalled（detectCommand 检测） | 未实现 | check 无 detectCommand 遍历与 spawnSync |
| spec §3.1、AC1 | GAP-2.2 | check 诊断报告：cliVersion、templateVersion、envVars | 未实现 | check 仅输出 subagentSupport 与 "Check OK" |
| spec §3.1、AC1 | GAP-2.3 | check --json 结构化输出 | 未实现 | 无 --json 选项 |
| spec §3.2、AC7 | GAP-2.4 | check --ignore-agent-tools 跳过 AI 工具检测 | 未实现 | 无该选项 |
| spec §3.4、AC2 | GAP-2.5 | check --list-ai --json | 部分实现 | 有 --list-ai，无 --json |
| spec §3.5、AC8 | GAP-2.6 | subagentSupport 输出及 none/limited 提示 | 已实现 | 当前 check 已有 |
| spec §5.2、AC4/AC5 | GAP-3.1 | _bmad-output 存在且含 config/ | 未实现 | structure-validate 仅验 _bmad |
| spec §5.4、AC6 | GAP-3.2 | selectedAI 映射：gemini、windsurf、kilocode、auggie、roo | 部分实现 | validateSelectedAITargets 缺上述 5 项 |
| spec §5.3、AC6 | GAP-3.3 | 无 selectedAI 时验证 .cursor 作为向后兼容默认 | 未实现 | 当前有 selectedAI 才验证 |
| spec §5.1、AC4 | GAP-3.4 | 无 bmad-speckit.json 时跳过 AI 目标验证，仍验 _bmad/_bmad-output | 部分实现 | 逻辑需与 §5.1 对齐 |
| spec §6、AC9 | GAP-3.5 | 本 Story 仅退出码 0/1；bmadPath 不可用现用 exit 4 | 偏差 | 13.2 负责 exit 4，本 Story 可用 1 或保持 4 待 13.2 统一 |
| plan Phase 1 | GAP-1.x | VersionCommand 实现与 bin 注册 | 未实现 | 见 GAP-1.1–1.3 |
| plan Phase 2–3 | GAP-2.x | CheckCommand 诊断、--json、--ignore-agent-tools、--list-ai --json | 未实现/部分 | 见 GAP-2.1–2.5 |
| plan Phase 4–5 | GAP-3.x | 结构验证扩展、selectedAI 完整映射 | 未实现/部分 | 见 GAP-3.1–3.5 |

---

## 3. Gaps 分类汇总

| 类别 | Gap ID | 说明 |
|------|--------|------|
| **VersionCommand** | GAP-1.1, GAP-1.2, GAP-1.3 | 新建 version.js，bin 注册，--json |
| **CheckCommand 诊断** | GAP-2.1, GAP-2.2, GAP-2.3, GAP-2.4 | detectCommand、版本/env、--json、--ignore-agent-tools |
| **CheckCommand --list-ai** | GAP-2.5 | --list-ai 支持 --json |
| **结构验证** | GAP-3.1, GAP-3.3, GAP-3.4 | _bmad-output、无 selectedAI 时 .cursor、触发逻辑 |
| **selectedAI 映射** | GAP-3.2 | 补全 gemini、windsurf、kilocode、auggie、roo |
| **退出码** | GAP-3.5 | 与本 Story 范围 0/1 对齐（可选，13.2 统一） |

---

## 4. 与 plan 阶段对应

| plan Phase | 对应 Gap | 说明 |
|-------------|----------|------|
| Phase 1 | GAP-1.1–1.3 | VersionCommand |
| Phase 2 | GAP-2.1–2.4, GAP-2.6 | 诊断输出、--json、--ignore-agent-tools、subagentSupport（已有） |
| Phase 3 | GAP-2.5 | --list-ai --json |
| Phase 4 | GAP-3.1 | _bmad-output 验证 |
| Phase 5 | GAP-3.2, GAP-3.3, GAP-3.4 | selectedAI 完整映射、.cursor 默认、无 config 时逻辑 |

---

## 5. 实施顺序建议

1. Phase 1：新建 version.js，bin 注册
2. Phase 2：check 诊断输出（detectCommand、版本、env）、--json、--ignore-agent-tools
3. Phase 3：check --list-ai --json
4. Phase 4：structure-validate 扩展 _bmad-output；或 check 内联
5. Phase 5：validateSelectedAITargets 补全映射、无 selectedAI 时 .cursor 验证

<!-- AUDIT: PASSED by code-reviewer -->
