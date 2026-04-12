---
name: bmad-code-reviewer-lifecycle
description: |
  Claude Code CLI / OMC 版全链路 Code Reviewer Lifecycle Skill 适配入口。
  以 Cursor bmad-code-reviewer-lifecycle 为语义基线，编排 BMAD 工作流各 stage 的审计产出→解析→scoring 写入闭环。
  定义触发时机、stage 映射、报告路径约定；引用 auditor-* 执行体、audit-prompts、code-reviewer-config、scoring/rules。
  与 speckit-workflow、bmad-story-assistant 协同，stage 审计通过后调用解析并写入 scoring 存储。
when_to_use: |
  Use when: BMAD 工作流各 stage（prd/arch/story/specify/plan/gaps/tasks/implement/post_impl）审计通过后需触发评分解析与写入；
  或 speckit-workflow、bmad-story-assistant 的 stage 完成步骤需调用全链路「解析并写入」逻辑；
  或用户显式请求「全链路评分」时。
references:
  - auditor-spec: spec 阶段审计执行体；`.claude/agents/auditors/auditor-spec.md`
  - auditor-plan: plan 阶段审计执行体；`.claude/agents/auditors/auditor-plan.md`
  - auditor-tasks: tasks 阶段审计执行体；`.claude/agents/auditors/auditor-tasks.md`
  - auditor-implement: implement 阶段审计执行体；`.claude/agents/auditors/auditor-implement.md`
  - auditor-bugfix: bugfix 阶段审计执行体；`.claude/agents/auditors/auditor-bugfix.md`
  - auditor-document: document 阶段审计执行体；`.claude/agents/auditors/auditor-document.md`
  - audit-prompts: 各 stage 审计提示词；`.claude/skills/speckit-workflow/references/audit-prompts.md`
  - audit-prompts-prd: PRD 审计提示词；`.claude/skills/speckit-workflow/references/audit-prompts-prd.md`
  - audit-prompts-arch: 架构审计提示词；`.claude/skills/speckit-workflow/references/audit-prompts-arch.md`
  - audit-prompts-code: 代码审计提示词；`.claude/skills/speckit-workflow/references/audit-prompts-code.md`
  - audit-prompts-pr: PR 审计提示词；`.claude/skills/speckit-workflow/references/audit-prompts-pr.md`
  - code-reviewer-config: 多模式配置（prd/arch/code/pr）；`_bmad/_config/code-reviewer-config.yaml`
  - scoring/rules: 解析规则、item_id、veto_items；`scoring/rules/*.yaml`
  - runAuditorHost / 统一 auditor host runner：承接审计报告后的评分写入、auditIndex 更新与统一 post-audit automation
---
<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 术语收紧：本文件中“完成 / 通过 / 可进入下一阶段”一律指 `runAuditorHost` 返回 `closeout approved`。审计报告 `PASS` 仅表示可以进入 host close-out，单独的 `PASS` 不得视为完成、准入或放行。

# Claude Adapter: bmad-code-reviewer-lifecycle

## Purpose

本 skill 是 Cursor `bmad-code-reviewer-lifecycle` 在 Claude Code CLI / OMC 环境下的统一适配入口。

目标不是简单复制 Cursor skill，而是：

1. **继承 Cursor 已验证的全链路审计编排语义**（各 stage 审计触发 → 审计执行 → 报告生成 → 评分写入）
2. **在 Claude/OMC 运行时中将审计执行体映射到 `.claude/agents/auditor-*` 系列**
3. **接入仓库中已开发完成的评分写入、状态机、handoff 机制**
4. **确保在 Claude Code CLI 中能完整、连续、正确地执行各 stage 审计闭环与 scoring 写入**

---

## 核心验收标准

Claude 版 `bmad-code-reviewer-lifecycle` 必须满足：

- 能作为 Claude Code CLI 的**全链路审计编排入口**，统一管理各 stage 的审计→解析→评分写入闭环
- 各 stage 的审计执行器选择、fallback、评分写入均与 Cursor 已验证流程语义一致
- 完整接入本仓新增的：
  - 多 auditor agent（auditor-spec、auditor-plan、auditor-tasks、auditor-implement、auditor-bugfix、auditor-document）
- 统一 auditor host runner（`runAuditorHost`）
  - handoff 协议
- 不得将 Cursor Canonical Base、Claude Runtime Adapter、Repo Add-ons 混写为来源不明的重写版 prompt

---

## Cursor Canonical Base

以下内容继承自 Cursor `bmad-code-reviewer-lifecycle`，属于业务语义基线，Claude 版不得擅自重写其意图：

### 引用关系（Architecture §2.2、§10.2）

| 引用组件 | 职责 | 引用方式（Claude 适配版） |
|----------|------|--------------------------|
| auditor-* | 执行各 stage 审计 | 主 Agent 通过 Agent tool（`subagent_type: general-purpose`）调度 `.claude/agents/auditors/auditor-*.md` |
| audit-prompts | 各 stage 审计提示词 | `.claude/skills/speckit-workflow/references/audit-prompts*.md` |
| code-reviewer-config | 多模式配置（prd/arch/code/pr） | 按 mode 读取 dimensions、pass_criteria |
| scoring/rules | 解析规则、item_id、veto_items | 用于解析审计产出并映射环节得分 |

### 引用路径

- **auditor 执行体**: `.claude/agents/auditors/auditor-spec.md`、`auditor-plan.md`、`auditor-gaps.md`、`auditor-tasks.md`、`auditor-implement.md`、`auditor-bugfix.md`、`auditor-document.md`
- **审计提示词**: `.claude/skills/speckit-workflow/references/audit-prompts.md`、`audit-prompts-prd.md`、`audit-prompts-arch.md`、`audit-prompts-code.md`、`audit-prompts-pr.md`
- **配置**: `_bmad/_config/code-reviewer-config.yaml`、`_bmad/_config/stage-mapping.yaml`、`_bmad/_config/eval-lifecycle-report-paths.yaml`
- **评分规则**: `scoring/rules/`（含 `default/`、`gaps-scoring.yaml`、`iteration-tier.yaml`）
- **自身路径**: `.claude/skills/bmad-code-reviewer-lifecycle/SKILL.md`

### Stage 映射与触发

详见 `_bmad/_config/stage-mapping.yaml`。各 stage 到 auditor 执行体的映射如下：

| stage | layer | auditor 执行体 | prompt_template |
|-------|-------|----------------|-----------------|
| `story` | layer_3 | 由 bmad-story-assistant 管理 | `audit-prompts.md` |
| `specify` | layer_4 | `auditor-spec` | `audit-prompts.md §1` |
| `plan` | layer_4 | `auditor-plan` | `audit-prompts.md §2` |
| `gaps` | layer_4 | `auditor-gaps` | `audit-prompts.md §3` |
| `tasks` | layer_4 | `auditor-tasks` | `audit-prompts.md §4` |
| `implement` | layer_4 | `auditor-implement` | `audit-prompts.md §5` |
| `post_impl` | layer_5 | `auditor-implement` | `audit-prompts.md §5` |
| `pr_review` | layer_5 | 主 Agent 或 OMC reviewer | `audit-prompts-pr.md` |
| `bugfix` | — | `auditor-bugfix` | `audit-prompts.md §5` |
| `document` | — | `auditor-document` | `audit-prompts.md §4 / TASKS-doc` |

### Stage Scoring Phases

| stage | scoring phases | report path source |
|-------|---------------|-------------------|
| `story` | `[1]` | `eval-lifecycle-report-paths.yaml` |
| `specify` | `[1]` | `eval-lifecycle-report-paths.yaml` |
| `plan` | `[1,2]` | `eval-lifecycle-report-paths.yaml` |
| `gaps` | `[1,2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `tasks` | `[2,3,4,5]` | `eval-lifecycle-report-paths.yaml` |
| `implement` | `[2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `post_impl` | `[2,3,4,5,6]` | `eval-lifecycle-report-paths.yaml` |
| `pr_review` | `[6]` | `eval-lifecycle-report-paths.yaml` |

### 报告路径约定

详见 `_bmad/_config/eval-lifecycle-report-paths.yaml`。

### Mode Mapping

| mode | 来源配置 | 用途 | prompt_template |
|------|---------|------|-----------------|
| `code` | `code-reviewer-config.yaml` | 代码审计 | `audit-prompts-code.md` |
| `prd` | `code-reviewer-config.yaml` | PRD 审计 | `audit-prompts-prd.md` |
| `arch` | `code-reviewer-config.yaml` | 架构审计 | `audit-prompts-arch.md` |
| `pr` | `code-reviewer-config.yaml` | PR 审计 | `audit-prompts-pr.md` |

### Trigger Mapping

| event | trigger | scope |
|-------|---------|-------|
| `stage_audit_complete` | auto | 当前 stage 对应评分环节 |
| `story_status_change` | auto | 环节 1–6 |
| `mr_created` | auto | 环节 2–6 |
| `epic_pending_acceptance` | manual_or_auto | 环节 6 / Epic 综合 |
| `user_explicit_request` | manual | 全环节 |

---

## Claude/OMC Runtime Adapter

### Primary Executor

各 stage 审计通过 **Agent tool**（`subagent_type: general-purpose`）调度对应的 `.claude/agents/auditors/auditor-*.md` 执行体。主 Agent 将 auditor agent 的完整 markdown 内容整段传入作为 prompt。

### Fallback Strategy

4 层 Fallback 链（按优先级降序）：

1. **`.claude/agents/auditors/auditor-*`**：对应 stage 的专用审计执行体（Primary）
2. **OMC reviewer**（`oh-my-claudecode` code-reviewer subagent_type）
3. **code-review skill**（通用 code-review 技能，按 audit-prompts 对应章节执行）
4. **主 Agent 直接执行**：主 Agent 读取 audit-prompts 对应章节，按审计清单逐项检查并输出审计报告

**Fallback 降级通知（FR26）**：当 Fallback 触发时，须向用户显示当前使用的执行体层级。格式：

```
⚠️ Fallback 降级通知：当前审计使用执行体层级 {N}（{执行体名称}），原因：{层级 N-1 不可用原因}
```

示例：
- `⚠️ Fallback 降级通知：当前审计使用执行体层级 2（OMC reviewer），原因：auditor-spec 不存在或不可用`
- `⚠️ Fallback 降级通知：当前审计使用执行体层级 4（主 Agent 直接执行），原因：前三层执行体均不可用`

### Runtime Contracts

- 必读：`.claude/protocols/audit-result-schema.md`
- 必读：`.claude/state/bmad-progress.yaml`
- 显式引用：`code-reviewer-config.yaml`
- 显式引用：`stage-mapping.yaml`
- 显式引用：`eval-lifecycle-report-paths.yaml`
- 显式引用：`runAuditorHost`
- 返回必须包含：`execution_summary`、`artifacts`、`handoff`
- 必须明确 mode → auditor / stage → scoring / stage → reportPath / event → trigger 的映射关系

### CLI Calling Summary（Architecture Pattern 2）

每次调用审计子代理前，主 Agent **必须**输出如下结构化摘要：

```yaml
# CLI Calling Summary
Input: {stage}={当前阶段}, mode={审计模式}, reportPath={报告路径}
Template: {使用的 auditor agent 文件路径}
Output: {预期产出——审计报告路径}
Fallback: {当前使用的执行体层级及降级方案}
Acceptance: {验收标准——报告结论为"完全覆盖、验证通过"}
```

### YAML Handoff（Architecture Pattern 4）

每个 stage 审计结束后，主 Agent **必须**输出如下 handoff 结构：

```yaml
execution_summary:
  status: passed|failed
  stage: {当前 stage}
  mode: {审计模式}
  iteration_count: {累计轮次}
artifacts:
  reportPath: {审计报告路径}
  artifactDocPath: {被审文档路径}
next_steps:
  - {下一步操作描述}
handoff:
  next_action: scoring_trigger|iterate_audit|proceed_to_next_stage
  next_agent: bmad-master|auditor-{stage}|runAuditorHost
  ready: true|false
```

---

## Repo Add-ons

### Lifecycle Phases

完整审计生命周期包含以下 6 个阶段，每个 stage 审计均须依次经历：

1. **Pre-Audit**：读取配置（`code-reviewer-config.yaml`、`stage-mapping.yaml`、`eval-lifecycle-report-paths.yaml`），确定 mode、auditor 执行体、报告路径、scoring phases
2. **Audit Execution**：通过 Primary Executor（或 Fallback）调度 auditor 执行体，传入对应 stage 的 audit-prompts 章节作为审计标准
3. **Report Generation**：审计执行体产出审计报告并保存至约定路径；报告须含可解析评分块（「总体评级: [A|B|C|D]」与「维度评分: 维度名: XX/100」）
4. **Host Trigger**：审计通过后，统一调用 `runAuditorHost` 承接评分写入、auditIndex 更新与 post-audit automation
5. **Iteration Tracking**：追踪审计轮次（iteration_count），fail 轮须保存报告并记录 iterationReportPaths
6. **Convergence Check**：按 strictness 检查收敛条件——standard 为单次通过；strict 为连续 3 轮无 gap + 批判审计员 >50%

### 统一 auditor host runner 前置条件（Checklist）

各 stage 审计通过后、调用统一 auditor host runner 前，**必须**确认：

1. **报告包含可解析块**：报告结尾须含「总体评级: [A|B|C|D]」与「维度评分: 维度名: XX/100」块，否则解析失败、仪表盘不显示评级
2. **逐条对照格式**：若报告为逐条对照格式（表格+结论），须在结论后追加上述可解析块
3. **路径**：可使用 `--reportPath` 指定任意报告路径；约定路径为 `AUDIT_{stage}-E{epic}-S{story}.md`
4. **参数完备**：`stage` / `triggerStage` / `artifactDocPath` / `iterationCount` 已准备完毕

### 统一 auditor host runner 调用约束

统一 auditor host runner（`runAuditorHost`）负责承接：
- 评分写入（原 `bmad-speckit score`）
- auditIndex 更新
- 统一 post-audit automation

**iteration_count 传递（强制）**：执行审计循环的 Agent 在 pass 时传入当前累计值（本 stage 审计未通过/fail 的轮数）；一次通过传 0；连续 3 轮无 gap 的验证轮不计入 iteration_count。

### Execution Flow

1. Read `.claude/protocols/audit-result-schema.md`
2. Read `.claude/state/bmad-progress.yaml`
3. 读取 `code-reviewer-config.yaml`
4. 读取 `stage-mapping.yaml`
5. 读取 `eval-lifecycle-report-paths.yaml`
6. 根据 stage 解析 mode / scoring / reportPath / trigger
7. 输出 **CLI Calling Summary**
8. 调度 auditor 执行体（Primary → Fallback）
9. 审计执行体读取实现产物并执行审查检查清单
10. 审计执行体产出报告
11. 校验统一 auditor host runner 前置条件
12. 触发统一 auditor host runner
13. 输出 **YAML Handoff**
14. 更新审计状态

### Output / Handoff

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

### State Updates

```yaml
layer: review
stage: review_passed
review_round: number
review_verdict: pass | fail
artifacts:
  review: reviews/.../review.md
```

### Constraints

- **禁止自行 commit**
- 必须通过 implement 阶段审计（采用 Cursor Canonical Base / Claude/OMC Runtime Adapter / Repo Add-ons 三层结构）

---

## 与其他 Skill 的协同

### speckit-workflow 协同

`speckit-workflow` 各阶段（§1.2 spec、§2.2 plan、§3.2 gaps、§4.2 tasks、§5.2 implement）审计闭环中：
1. 调用本 skill 确定当前 stage 的 auditor 执行体和 mode
2. 本 skill 通过 Primary Executor / Fallback 链调度审计
3. 审计通过后，本 skill 统一触发 `runAuditorHost`
4. 输出 YAML Handoff 供 speckit-workflow 决定下一步操作

### bmad-story-assistant 协同

`bmad-story-assistant` 在 Dev Story 阶段触发 speckit-workflow，间接通过本 skill 完成审计编排。

---

## Use Cases

- speckit 各阶段审计闭环的统一审计编排与评分写入
- 实施后的代码审查（post_impl）
- PR 前的最终检查（pr_review）
- 代码质量门控
- BUGFIX 文档审计（bugfix）
- TASKS 文档审计（document）

<!-- ADAPTATION_COMPLETE: 2026-03-15 -->

