# Layer: Standalone Tasks

执行独立的 TASKS 文档，不经过完整的 specify/plan 流程。

## Purpose

该执行体负责在用户直接提供 TASKS 文档时，以 standalone 模式执行任务，但仍保留与 `bmad-story-assistant` 同等级的前置审计、TDD、实施审计与 Master 门控要求。

**关键门控要求：**
- `auditor-tasks-doc` 的语义固定为 **TASKS/BUGFIX 文档前置审计**
- `auditor-tasks-doc` 通过前不得进入任何实施执行
- `auditor-tasks-doc` 通过后、真正进入实施前，仍必须通过统一 `implementation-readiness` Implementation Entry Gate；若结果为 `block` 或 `reroute`，不得继续实施
- 实施后审计通过前不得进入提交阶段

## Required Inputs

- `tasksPath`: 被执行 TASKS 文档路径
- `projectRoot`: 项目根目录
- `reportPath`: 前置审计 / 实施审计报告路径（如适用）
- `iterationCount`: 当前轮次（如适用）
- `strictness`: 严格度模式（如适用）

## Cursor Canonical Base

- 原始语义来源：
  - `.claude/skills/bmad-standalone-tasks/SKILL.md`
  - `.claude/skills/bmad-standalone-tasks/references/prompt-templates.md`
- 基线语义：
  - 用户直接提供 TASKS / BUGFIX 文档
  - 不经过完整五层架构文档产出流程
  - 先进行 TASKS 文档审计，再进入实施
  - 实施过程必须遵循 TDD 红绿灯
  - 每批任务完成后进行实施审计
  - 架构必须忠实于 TASKS / BUGFIX 文档，禁止伪实现、占位、TODO 式实现
- 若执行前存在多个实现路线、拆分方案、trade-off 或未决点，必须先进入 `party-mode`，多角色辩论至少 100 轮；所有 rounds / `designated_challenger_id` / challenger ratio / session-meta-snapshot-evidence / recovery / exit gate 语义都以 `{project-root}/_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md` 为准

## Claude/OMC Runtime Adapter

### Primary Executor
- `bmad-standalone-tasks`

### Fallback Strategy
1. 先由 `auditor-tasks-doc` 完成前置文档审计
2. 实施阶段可回退到通用执行体或主 Agent 直接执行
3. 批次实施审计回退到 `auditor-implement` 或主 Agent
4. 最终提交统一由 `bmad-master` 门控

### Runtime Contracts
- 必读：`.claude/protocols/audit-result-schema.md`
- 必读：`.claude/state/bmad-progress.yaml`
- 前置门控：`auditor-tasks-doc` PASS 后才允许执行
- 前置门控未执行、未通过或结论不明时，一律视为实施前阻断
- 批次门控：每批任务完成后调用实现审计
- 提交门控：仅允许向 `bmad-master` 返回 `commit_request`，禁止自行 commit
- 返回必须包含：`execution_summary`、`artifacts`、`handoff`、`next_action`、`ready`
- 实施过程必须维护 standalone 模式下的 prd/progress 产物

## Repo Add-ons

- handoff / state 协议
- `runAuditorHost`（auditor 执行后的唯一标准自动化入口）
- 本仓禁止词与模糊表述约束
- 本仓执行可见性增强要求
- standalone 模式下的 prd / progress / TDD 证据要求

## Stage 调用前 CLI 输出要求

- 执行体名称
- 输入参数
- 提示词结构摘要
- 预期产物
- 当前批次任务范围
- 审计 / 实施 / Master gate 闭环摘要

## Use Cases

- 已有 TASKS 文档需要执行
- 小功能实现无需完整 spec
- 技术债务清理任务

## Prerequisites

- 有效的 tasks.md 或 TASKS/BUGFIX 文档
- `.claude/state/bmad-progress.yaml`
- `.claude/protocols/audit-result-schema.md`
- 若存在需求依据文档，应可被主 Agent 解析并传入

## Main Agent Responsibilities

- 解析文档路径与未完成任务清单
- 在进入实施前调用 `auditor-tasks-doc`
- 在 `auditor-tasks-doc` PASS 后，必须由 invoking host/runner 调用 `runAuditorHost`
- 发起实施子代理并传入完整任务上下文
- 收集批次结果并发起 `auditor-implement`
- 在每轮 `auditor-implement` PASS 后，必须由 invoking host/runner 调用 `runAuditorHost`
- 仅通过 `bmad-master` 进入 commit gate
- 主 Agent 不得直接编辑生产代码或测试代码

## Execution Flow

1. Read tasks / BUGFIX 文档
2. 解析未完成任务与需求依据
3. 调用 `auditor-tasks-doc` 审计 TASKS 文档
4. `auditor-tasks-doc` PASS 后，由 invoking host/runner 调用 `runAuditorHost`
5. 执行统一 `implementation-readiness` gate 断言；仅 `decision=pass` 可继续，`reroute` 必须升轨
6. PASS 后按批次执行任务（含 TDD）
7. 每批完成后调用 `auditor-implement`
8. 每轮 `auditor-implement` PASS 后，由 invoking host/runner 调用 `runAuditorHost`
9. 汇总结果并通过 `bmad-master` 进入提交门控

## Implementation Prompt Requirements

- 主 Agent 调用实施子代理时，必须完整复制 Cursor 侧对应正文模板，不得摘要化
- 不得只传文件路径让子代理自行推断规则
- 必须显式传入：
  - 文档路径
  - 未完成任务清单
  - TDD 约束
  - prd / progress 维护要求
  - 审计与提交门控要求

## Output / Handoff

```yaml
execution_summary:
  status: passed|failed
  stage: standalone_tasks
  batch: current_batch
artifacts:
  tasks: tasks/.../tasks.md
  prd: prd.{stem}.json
  progress: progress.{stem}.txt
handoff:
  next_action: implement_next_batch|post_batch_audit|commit_gate|revise_tasks_doc
  next_agent: bmad-standalone-tasks|auditor-implement|bmad-master|auditor-tasks-doc
  ready: true|false
```

## State Updates

```yaml
layer: standalone
stage: tasks_passed
artifacts:
  tasks: tasks/.../tasks.md
  prd: prd.{stem}.json
  progress: progress.{stem}.txt
```

## Constraints

- **禁止自行 commit**
- 必须通过 tasks 阶段审计（采用 Cursor Canonical Base / Claude/OMC Runtime Adapter / Repo Add-ons 三层结构）
- 必须遵循 TDD 红绿灯
- 必须保留批次实施审计
- 必须经过 Master 门控
