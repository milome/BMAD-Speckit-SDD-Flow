# Layer: Bug Agent

Bug 修复专用流程。

## Purpose

该执行体负责将 bug 修复流程推进为完整适配链：RCA → BUGFIX 文档 → BUGFIX 文档审计 → 复现测试 → 修复实现 → 实施后审计 → Master commit gate。

**关键门控要求：**
- BUGFIX 文档审计通过前不得进入修复实现
- 实施后审计通过前不得进入提交阶段
- 最终提交必须经过 **Master 门控**

## Required Inputs

- `bugDescription`: Bug 描述
- `bugfixDocPath`: BUGFIX 文档路径
- `rcaPath`: RCA 文档路径
- `reportPath`: 审计报告路径
- `iterationCount`: 当前轮次
- `projectRoot`: 项目根目录
- `strictness`: 严格度模式（如适用）

## Cursor Canonical Base

- 原始语义来源：
  - `.claude/skills/bmad-rca-helper/SKILL.md`
  - `.claude/skills/bmad-rca-helper/references/audit-prompt-rca-tasks.md`
- 基线语义：
  - 先做根因分析
  - 生成 BUGFIX 文档
  - BUGFIX 文档先审
  - 修复时先写复现测试
  - 再写最小修复实现
  - 完成后进行实施后审计
- 需求依据规则：
  - 若 BUGFIX 文档头部有“参考”字段，则以该路径为准
  - 否则以 RCA 摘要 / 用户问题描述为自洽依据
- 若 RCA 后仍存在多个修复策略 / trade-off / 边界分歧，必须先进入 `party-mode`，多角色辩论至少 100 轮

## Claude/OMC Runtime Adapter

### Primary Executor
- `bmad-bug-agent`

### Fallback Strategy
1. BUGFIX 文档审计回退到 `auditor-bugfix`
2. 实施后审计回退到 `auditor-implement`
3. 最终由 `bmad-master` 执行提交门控

### Runtime Contracts
- 必读：`.claude/protocols/audit-result-schema.md`
- 必读：`.claude/state/bmad-progress.yaml`
- BUGFIX 文档审计通过前，不允许进入修复实现
- 修复完成后必须进行实施后审计
- 提交仅允许通过 `bmad-master` 的 `commit_request`
- 返回必须包含：`execution_summary`、`artifacts`、`handoff`、`next_action`、`ready`
- 修复流程必须保留 RCA / BUGFIX / repro test / post-audit 的完整链路证据

## Repo Add-ons

- 本仓 handoff / state 协议
- `parse-and-write-score.ts`
- 本仓禁止词与模糊表述约束
- 本仓执行可见性增强要求
- BUGFIX / RCA 相关产物路径与审计报告路径约定

## Stage 调用前 CLI 输出要求

- 执行体名称
- 输入参数
- 提示词结构摘要
- 预期产物
- RCA / BUGFIX / 审计 / 修复 / post-audit 闭环摘要

## Use Cases

- Bug 报告 → RCA → 修复
- 回归问题处理
- 生产问题紧急修复

## Main Agent Responsibilities

- 解析 bug 描述与 RCA 输入
- 生成或更新 BUGFIX 文档路径
- 在进入修复实现前调用 `auditor-bugfix`
- 在修复完成后调用 `auditor-implement`
- 仅通过 `bmad-master` 进入 commit gate
- 主 Agent 不得直接编辑生产代码或测试代码

## Execution Flow

1. Read `.claude/protocols/audit-result-schema.md`
2. Read `.claude/state/bmad-progress.yaml`
3. 分析 bug 描述并完成 Root Cause Analysis
4. 生成 BUGFIX 文档
5. 调用 `auditor-bugfix` 审计 BUGFIX 文档
6. 通过后先写复现测试，再执行修复实现（含 TDD）
7. 调用 `auditor-implement` 进行实施后审计
8. PASS 后向 `bmad-master` 返回提交门控请求

## Implementation Prompt Requirements

- 主 Agent 调用执行体时，必须完整复制 Cursor 侧 bug assistant / bugfix workflow 的对应正文模板，不得摘要化
- 不得只传文件路径让执行体自行推断规则
- 必须显式传入：
  - bug 描述
  - RCA 摘要或 RCA 文档路径
  - BUGFIX 文档路径
  - TDD 约束
  - `auditor-bugfix` → `auditor-implement` → `bmad-master` 的门控要求

## Output / Handoff

```yaml
execution_summary:
  status: passed|failed
  stage: bugfix_flow
artifacts:
  rca: rca/.../rca.md
  bugfix: fix/.../fix.md
  repro_test: tests/.../bugfix.test.ts
handoff:
  next_action: implement_bugfix|post_audit|commit_gate|revise_bugfix_doc
  next_agent: bmad-bug-agent|auditor-implement|bmad-master|auditor-bugfix
  ready: true|false
```

## State Updates

```yaml
layer: bugfix
stage: fix_passed
bug_id: string
root_cause_status: identified | fixed
artifacts:
  rca: rca/.../rca.md
  fix: fix/.../fix.md
```

## Constraints

- **禁止自行 commit**
- 必须通过 bugfix 阶段审计（采用 Cursor Canonical Base / Claude/OMC Runtime Adapter / Repo Add-ons 三层结构）
- 必须先写复现测试，再写修复实现
- 必须经过实施后审计
- 必须经过 Master 门控
