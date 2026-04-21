# Layer: Code Reviewer Lifecycle

代码审查生命周期管理。

## Purpose

该执行体不是单独业务流程，而是 Claude 侧所有关键 auditor 复用的统一生命周期模板来源，用于承接 Cursor 版 `bmad-code-reviewer-lifecycle` 的阶段定义、评分触发、报告路径约定与审计闭环语义。

## Required Inputs

- `stage`: 当前审计阶段
- `mode`: 当前审计模式
- `reportPath`: 审计报告路径
- `iterationCount`: 当前轮次
- `strictness`: 严格度模式

## Cursor Canonical Base

- 原始语义来源：
  - `.claude/skills/bmad-code-reviewer-lifecycle/SKILL.md`
  - `_bmad/_config/code-reviewer-config.yaml`
  - `_bmad/_config/stage-mapping.yaml`
  - `_bmad/_config/eval-lifecycle-report-paths.yaml`
- 基线语义：
  - lifecycle 管理的是各 stage 审计 → 解析 → scoring 写入闭环
  - 保留 mode、stage、reportPath、trigger、评分写入前置条件
  - 必须显式承接 `parseAndWriteScore` 的前置条件与报告路径约定

## Claude/OMC Runtime Adapter

### Primary Executor
- `bmad-code-reviewer-lifecycle`

### Fallback Strategy
1. 各 auditor 直接复用本生命周期模板
2. 无法统一时由主 Agent 按同一生命周期语义执行
3. 最终评分触发、auditIndex 更新与 post-audit automation 统一由 `runAuditorHost` / auditor host runner 承接；不再由各 auditor 分散手工触发

### Runtime Contracts
- 必读：`.claude/protocols/audit-result-schema.md`
- 必读：`.claude/state/bmad-progress.yaml`
- 显式引用：`code-reviewer-config.yaml`
- 显式引用：`stage-mapping.yaml`
- 显式引用：`eval-lifecycle-report-paths.yaml`
- 显式引用：`runAuditorHost`
- 返回必须包含：`execution_summary`、`artifacts`、`handoff`
- 必须明确 mode → auditor / stage → scoring / stage → reportPath / event → trigger 的映射关系

## Repo Add-ons

- 本仓 handoff / state 协议
- 本仓 scoring 写入方式
- 本仓执行可见性增强要求
- 本仓 strictness / convergence 表达要求

## Use Cases

- 实施后的代码审查
- PR 前的最终检查
- 代码质量门控

## Lifecycle

1. Pre-Audit
2. Audit Execution
3. Report Generation
4. Scoring Trigger
5. Iteration Tracking
6. Convergence Check

## Mode Mapping

| mode | 来源配置 | 用途 | prompt_template |
|---|---|---|---|
| `code` | `code-reviewer-config.yaml` | 代码审计 | `audit-prompts-code.md` |
| `prd` | `code-reviewer-config.yaml` | PRD 审计 | `audit-prompts-prd.md` |
| `arch` | `code-reviewer-config.yaml` | 架构审计 | `audit-prompts-arch.md` |
| `pr` | `code-reviewer-config.yaml` | PR 审计 | `audit-prompts-pr.md` |

## Stage Mapping

| stage | layer | scoring phases | report path source |
|---|---|---|---|
| `story` | layer_3 | `[1]` | `eval-lifecycle-report-paths.yaml` |
| `specify` | layer_4 | `[1]` | `eval-lifecycle-report-paths.yaml` |
| `plan` | layer_4 | `[1,2]` | `eval-lifecycle-report-paths.yaml` |
| `gaps` | layer_4 | `[1,2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `tasks` | layer_4 | `[2,3,4,5]` | `eval-lifecycle-report-paths.yaml` |
| `implement` | layer_4 | `[2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `post_impl` | layer_5 | `[2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `pr_review` | layer_5 | `[6]` | `eval-lifecycle-report-paths.yaml` |

## Trigger Mapping

| event | trigger | scope |
|---|---|---|
| `stage_audit_complete` | auto | 当前 stage 对应评分环节 |
| `story_status_change` | auto | 环节 1–6 |
| `mr_created` | auto | 环节 2–6 |
| `epic_pending_acceptance` | manual_or_auto | 环节 6 / Epic 综合 |
| `user_explicit_request` | manual | 全环节 |

## Unified Auditor Host Runner Preconditions

调用统一 auditor host runner 前，必须确认：

1. 报告包含可解析评分块
2. 若报告为逐条对照格式，则已追加可解析评分块
3. `reportPath` 已按约定路径或显式参数传入
4. `stage` / `triggerStage` / `artifactDocPath` / `iterationCount` 已准备完毕

## Execution Flow

1. Read `.claude/protocols/audit-result-schema.md`
2. Read `.claude/state/bmad-progress.yaml`
3. 读取 `code-reviewer-config.yaml`
4. 读取 `stage-mapping.yaml`
5. 读取 `eval-lifecycle-report-paths.yaml`
6. 根据 stage 解析 mode / scoring / reportPath / trigger
7. 读取实现产物并执行审查检查清单
8. 校验统一 auditor host runner 前置条件
9. 触发 `runAuditorHost`
10. 更新 reviewer 状态

## Output / Handoff

```yaml
execution_summary:
  status: passed|failed
  stage: review_passed
  mode: code|prd|arch|pr
artifacts:
  review: reviews/.../review.md
  reportPath: reports/.../audit.md
handoff:
  next_action: scoring_trigger|return_to_auditor
  next_agent: bmad-master|auditor-implement
  ready: true|false
```

## State Updates

```yaml
layer: review
stage: review_passed
review_round: number
review_verdict: pass | fail
artifacts:
  review: reviews/.../review.md
```

## Constraints

- **禁止自行 commit**
- 必须通过 implement 阶段审计（采用 Cursor Canonical Base / Claude/OMC Runtime Adapter / Repo Add-ons 三层结构）
