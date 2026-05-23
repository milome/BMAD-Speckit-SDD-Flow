# Main Agent Six-Mental-Model Control Plane Completion

Date: 2026-05-24
Status: Draft
Source request: 将 Main Agent 六心智模型控制面补齐为可确认、可追踪、可验证的需求契约源文档。
Checkpoint: 2 - implementationConfirmation core fields and full applicability.* declarations
Checkpoint status: core confirmation block draft added; requirement ID rows pending Checkpoint 3

## 1. 结论

当前 Main Agent 已覆盖若干关键门禁，但还没有真正实现 6 个心智模型的统一编排状态机。当前实现更接近 `RequirementRecord + gate scripts + inspect projection + dashboard read model` 的组合，而不是由 `currentMentalModel` 驱动的主控控制面。

本需求目标是补齐一个真正的 Main Agent control plane：主 Agent 不再只从零散 gate、projection、score、dashboard 或 TaskReport 推导下一步，而是以 `RequirementRecord + currentMentalModel + sixModelVerdicts + controlled blocker intake` 作为唯一编排依据。

完成后，Main Agent inspect、dispatch、readiness、execution closure、audit review、delivery closeout 和 record close 都必须回到同一条受控状态链；Dashboard、score、TaskReport、stdout、HTTP 返回和页面渲染都只能作为 evidence 或 read model，不能成为控制流权威。

## 2. Checkpoint 1 Source Boundary

### 2.1 当前 checkpoint 目标

本 checkpoint 只负责把普通需求文档的头部、背景、范围、非目标和冻结决策整理为后续 `requirements-contract-authoring` 可继续扩展的源文档基础。

本 checkpoint 不生成 `implementationConfirmation`，不渲染确认 HTML，不请求用户确认，不进入 implementation readiness，也不声明需求已可实施。

### 2.2 本文档权威边界

本文档当前仍是需求源文档草稿。后续 checkpoint 会把需求语义逐步迁移到同一文件内的 `implementationConfirmation` 块中；在该块存在并通过确认前，本文档只能作为需求分析和契约化输入，不能作为已确认实施范围。

后续一旦引入 `implementationConfirmation`，需求语义权威必须以该块中的 `MUST-*`、`NEG-*`、`OUT-*`、`EVD-*`、`FAIL-*`、`EDGE-*`、`TRACE-*` 和 `CMD-*` ID 为准。正文、图、表和执行计划只能作为这些 ID 的解释视图，不得引入未编号的新范围。

### 2.3 业务范围

本需求的业务范围是 Main Agent 对消费用户暴露的主控行为：当用户通过 `$bmad-speckit`、`/bmad-speckit`、`bmad-speckit` 或等价宿主入口触发主控时，系统必须能基于受控 requirement record 和六心智模型状态给出下一步、阻断原因、恢复路径或完成状态。

业务范围内包括：

1. 用户可见 inspect 状态。
2. 当前 requirement 的下一步推荐。
3. 阻断、重跑、重新确认、审计、交付确认和完成态的可解释输出。
4. 防止 dashboard、score、TaskReport、stdout、HTTP 200、page render 或 mock-only 信号误导用户认为需求已完成。

### 2.4 治理范围

本需求的治理范围是 Main Agent 控制面内部的受控状态链、事件写入、blocker 归一化、reconfirmation router、模型 verdict、execution closure、audit review、delivery confirmation 和 record close。

治理范围内包括：

1. `currentMentalModel` 受控读写。
2. `mentalModelTransitions` 前后 hash 与 sourceRefs。
3. `sixModelVerdicts` 的计算与持久化。
4. `controlled-blocker-intake` 对 raw signals 的归一化。
5. `controlled-reconfirmation-router` 对 scope/hash/architecture/evidence drift 的回退路由。
6. architecture confirmation 通过 main-agent action switch 接入。
7. execution closure、audit review、delivery confirmation 的模型级 verdict。
8. Dashboard、score、SFT、report、summary、hook receipt 作为 read model 或 evidence 的边界。

### 2.5 非目标

本需求不做以下事项：

1. 不把 dashboard projection 改成控制源。
2. 不把 score green、stdout PASS、TaskReport done、HTTP 200、页面渲染、mock calls 或 fixture-only replay 当作完成证据。
3. 不允许绕过 controlled writer 直接修改 `currentMentalModel`。
4. 不允许子代理直接写顶层权威 blocker。
5. 不重写整个 scoring framework。
6. 不改变 delivery closeout gate 的最终判定地位。
7. 不引入新的需求确认侧车文件或独立权威 contract 文件。
8. 不在本 checkpoint 中生成、确认或 ingest `implementationConfirmation`。

### 2.6 冻结决策

以下决策在后续 checkpoint 中默认保持不变，除非用户明确发起 scope change：

1. `RequirementRecord` 是 Main Agent 控制面的唯一控制记录源。
2. `currentMentalModel` 是 Main Agent 判断当前阶段的受控字段。
3. 六个评估模型固定为 `requirement_confirmation`、`architecture_confirmation`、`implementation_readiness`、`execution_closure`、`audit_review`、`delivery_confirmation`。
4. `record_closed` 是终态，不是六个评估模型之一。
5. 只有当前模型 `status=pass` 才允许推进到下一个模型。
6. 任一模型发现 scope、source hash、implementation hash、architecture hash 或 evidence semantic drift，必须进入 `controlled-reconfirmation-router`。
7. 子代理、dashboard、score projection、TaskReport、stdout、HTTP 返回和页面渲染不能直接推进模型状态。
8. unknown failure 必须转为 `blocker_unknown` 并 fail closed。
9. closeout gate 仍是最终交付判定，execution closure 只提供 closeout 前的模型级汇总。
10. 后续 confirmation-ready 文档必须在同一源文档内扩展，不创建新的独立权威需求契约文件。

### 2.7 后续 checkpoint 入口

Checkpoint 2 已从本边界继续，新增 `implementationConfirmation` core fields 和完整 `applicability.*` 声明，且未重写本 checkpoint 的范围、非目标或冻结决策。

Checkpoint 3 必须继续填充 `must`、`notDone`、`mustNot` 和 `evidence` 数组。Checkpoint 3 不应渲染 HTML，不应设置 `status: user_confirmed`，也不应把空数组占位解释为可确认范围。

## 3. implementationConfirmation Core Draft

This checkpoint introduces only the confirmation block shell, identity, rendering placeholders, applicability declarations, and empty core arrays for later checkpoints. It deliberately does not define `MUST-*`, `NEG-*`, `OUT-*`, `EVD-*`, `FAIL-*`, `EDGE-*`, `TRACE-*`, or `CMD-*` rows yet.

```yaml
implementationConfirmation:
  contractSchemaVersion: 1
  status: draft
  recordId: REQ-MAIN-AGENT-SIX-MENTAL-MODEL-CONTROL-PLANE
  requirementSetId: REQ-MAIN-AGENT-SIX-MENTAL-MODEL-CONTROL-PLANE
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: bmad
  contractAuthoringRequired: true
  confirmationLanguage: null
  confirmationProfile: implementation_confirmation
  requiredViewPacks:
    - business_scope
    - governance_scope
    - failure_paths
    - traceability_matrix
    - artifact_automation
    - current_target_map
  optionalViewPacks:
    - architecture_confirmation
    - scoring_dashboard_sft
  confirmedAt: null
  confirmedBy: null
  sourceDocumentHash: null
  implementationConfirmationHash: null
  confirmationRender:
    htmlPath: null
    summaryPath: null
    reportPath: null
    htmlHash: null
    confirmationPhrase: null
  applicability:
    governanceEvents:
      applies: true
      reasonCode: mental_model_control_plane_adds_control_events_transitions_blocker_intake_and_reconfirmation_router
    runtimeRecovery:
      applies: true
      reasonCode: model_transitions_blocker_intake_rerun_reconfirmation_execution_closure_audit_review_and_closeout_recovery_are_in_scope
      requiresFunctionalResumeFailureCaseRegistry: true
      activeRequirementResolutionRequired: true
      retiredContextSurfaceForbidden: true
    scoringDashboardSft:
      applies: true
      reasonCode: audit_review_and_dashboard_six_model_projection_boundaries_must_remain_read_model_only
    currentTargetMap:
      applies: true
      reasonCode: current_gate_projection_dashboard_taskreport_driven_flow_must_migrate_to_requirement_record_current_mental_model_control_plane
    scriptsAndHooks:
      applies: true
      reasonCode: main_agent_orchestration_gates_ingest_scripts_dashboard_projection_and_hook_receipts_are_in_scope
  must: []
  notDone: []
  mustNot: []
  evidence: []
  openQuestions:
    - id: Q-001
      text: 用户尚未为本源文档选择确认页语言；渲染 confirmation HTML 前必须显式选择 zh-CN、en-US 或 bilingual。
      blocksImplementation: false
      requiredBefore: render_confirmation
  failurePaths: []
  edgeCases: []
  traceRows: []
  requirementBoundary:
    business:
      description: 待 Checkpoint 5 绑定业务范围 ID；当前业务范围见第 2.3 节。
      requirementIds: []
      viewRefs: []
      diagramRefs: []
    governance:
      description: 待 Checkpoint 5 绑定治理范围 ID；当前治理范围见第 2.4 节。
      requirementIds: []
      viewRefs: []
      diagramRefs: []
  sequenceViews: []
  flowViews: []
  edgeCaseViews: []
  boundaryViews: []
  artifactAutomationPlan: []
  requiredCommands: []
  suggestedCommands: []
  closeoutReadinessPreview:
    requiredCommands: []
    orphanPolicy: 待 Checkpoint 6 定义；read models and orphan artifacts must not drive control flow.
    currentAttemptPolicy: 待 Checkpoint 6 定义；delivery evidence must bind current attempt and current hashes.
  requiredContractChecks: []
  reconfirmationRequest: null
```

Checkpoint 3 must populate the empty `must`, `notDone`, `mustNot`, and `evidence` arrays. Until those arrays are populated, this source document is not confirmation-ready and must not be rendered as final scope confirmation.

## 4. 背景与当前遗漏

### 4.1 缺少 `currentMentalModel` 的真实读写闭环

README 和文档说主控要读取 `currentMentalModel`，但当前代码主要从 `record.status`、`architectureConfirmationState`、`gateChecks`、`rerunLoops`、`closeout`、`readinessBaselineMetadata` 推导 next action，没有稳定维护模型状态。

目标态要求：

1. `currentMentalModel` 是 Main Agent 选择下一步的首要受控字段。
2. `currentMentalModel` 只能由受控 writer 或 control-store event 更新。
3. 每次迁移都必须写入 `mentalModelTransitions`，并绑定前后 hash、reasonCode、sourceRefs、writer 与 timestamp。
4. 子模型、dashboard、score projection、TaskReport、stdout 不能直接推进 `currentMentalModel`。

### 4.2 缺少 6 模型级显式状态机

当前没有受控状态链：

```text
requirement_confirmation
-> architecture_confirmation
-> implementation_readiness
-> execution_closure
-> audit_review
-> delivery_confirmation
-> record_closed
```

各阶段靠独立 action 和 gate 拼接，容易出现某个 gate 已 pass，但模型状态没有迁移的不一致。

目标态要求：

1. 每个模型都必须有独立 verdict。
2. 只有当前模型 verdict 为 `pass` 时，才能推进到下一个模型。
3. 任何模型发现 blocker、stale、missing、ambiguous、drift 或未闭合 evidence，必须阻断下游推进。
4. `record_closed` 是终态，不属于 6 个评估模型，但必须由 6 模型链路和 delivery confirmation 共同导出。

### 4.3 缺少统一 `controlled-blocker-intake`

`TaskReport`、`SubagentEvidenceEnvelope.failureRecords`、inspect diagnostics、resolver projection、gate failures、drift results 中的 `blocker`、`stale`、`missing`、`ambiguous` 目前没有统一归一化并提升为 record 内权威 blocker。

目标态要求：

1. 子代理和脚本只能产生 candidate signal。
2. Main Agent 是唯一把 candidate signal 升级为 authoritative blocker 的入口。
3. provenance 缺失必须转为 `provenance_missing` blocker。
4. unknown failure 不能吞掉，必须映射为 `blocker_unknown` 并 fail closed。
5. blocker 只能通过修复后重新 intake 和 revalidation 标记为 `resolved` 或 `superseded`。

### 4.4 reconfirm 路由不完整

现在有 `confirm-scope`、architecture ingest、readiness audit，但没有统一机制表达：

```text
任何模型发现 scope/hash/architecture/evidence 语义变化
-> request_reconfirmation
-> route to requirement_confirmation or architecture_confirmation
-> block downstream until confirmed
```

目标态要求：

1. 任一模型都可请求重新确认。
2. 需求语义、source hash、implementation hash、architecture hash、evidence semantic drift 变化都必须进入 reconfirm router。
3. router 必须写入 blocking `reconfirmationRequests`。
4. router 必须把 `currentMentalModel` 切回 `requirement_confirmation` 或 `architecture_confirmation`。
5. 下游 readiness、execution、audit、delivery closeout 必须 fail closed。

### 4.5 Architecture Confirmation 没有完全接入 main-agent action switch

`ingest-architecture-confirmation.ts` 是独立受控脚本。主控能读 `architectureConfirmationState`，但架构确认写入不是 `main-agent-orchestration` 的统一动作。

目标态要求：

1. 在 `main-agent-orchestration` 中增加统一 action。
2. architecture confirmation 仍可由现有 skill-local 或脚本实现。
3. 所有写入必须通过主控 action 进入统一状态机和 record event 链。
4. `architecture_confirmation` 模型 verdict 必须消费该状态，而不是另行推断。

### 4.6 Audit Review 没有统一主控模型入口

controlled readiness audit 已有入口，但更广义的 RCA、score provenance、data production、eval/SFT、coach 输出仍偏分散脚本或 dashboard projection。主 Agent 缺少统一 `audit_review` model action 来判断审计复核是否闭合。

目标态要求：

1. 增加统一 `audit-review` action。
2. `audit_review` verdict 读取 readiness audit、RunScoreRecord、score provenance、RCA、data production、eval/SFT、coach 输出。
3. Dashboard projection 继续只读，不能影响控制流。
4. score green 不能替代 `audit_review` verdict。

### 4.7 Execution Closure 与 closeout 之间缺少模型级汇总

`dispatch-plan`、run-loop、`ingest-implementation-evidence` 能产生 packet 和 evidence，但没有明确的 `execution_closure` verdict 汇总 trace、command、artifact、subagent envelope、rerun 是否全部闭合。closeout gate 会最终检查，但 inspect 阶段缺少可读模型状态。

目标态要求：

1. 增加 `execution_closure` verdict。
2. verdict 汇总 packet、traceRows、commandRunRefs、artifactIndex、SubagentEvidenceEnvelope、rerun loops、current attempt。
3. inspect 必须提前显示 execution closure 是否闭合。
4. closeout gate 仍是最终交付判定，不被 execution closure 替代。

### 4.8 Dashboard 的 6 模型只是 read model

`packages/scoring/dashboard/six-model-projection.ts` 明确 `canAffectControlFlow: false`。它可以展示 6 模型，但不能成为主控决策源。因此 README 图中的 6 模型目前更接近目标态或展示态，不是完整控制态。

目标态要求：

1. Dashboard 继续展示 6 模型结果。
2. Dashboard 不写 `currentMentalModel`。
3. Dashboard 不写 gate decision。
4. Dashboard green 不推进 dispatch、readiness、closeout 或 record close。

## 5. 目标态主流程

### 5.1 inspect 主流程

```text
main-agent inspect
-> resolve active requirement
-> read RequirementRecord.currentMentalModel
-> run controlled-blocker-intake when pending or before transition
-> evaluate six model states
-> write controlled blocker / reconfirm / model-transition events
-> choose next action
```

### 5.2 标准推进链

```text
requirement_confirmation
-> architecture_confirmation
-> implementation_readiness
-> execution_closure
-> audit_review
-> delivery_confirmation
-> record_closed
```

### 5.3 异常闭环

```text
raw signal
-> controlled-blocker-intake
-> normalized blocker signal
-> authoritative record write
-> rerun / remediation / reconfirmation / audit / fail closed
-> inspect re-read RequirementRecord
```

### 5.4 主控权威顺序

Main Agent 选择下一步时，必须按以下顺序读取和判断：

1. active `RequirementRecord`
2. `currentMentalModel`
3. pending and unresolved authoritative blockers
4. `reconfirmationRequests`
5. current model verdict
6. six model verdict chain
7. gate decision and evidence state
8. packet/run/attempt state
9. read model projections for explanation only

任何低优先级 read model 与高优先级控制记录冲突时，必须以控制记录为准并产出 blocker 或 diagnostic。

## 6. 核心数据契约

### 6.1 `currentMentalModel`

新增或标准化字段：

```ts
type MentalModel =
  | 'requirement_confirmation'
  | 'architecture_confirmation'
  | 'implementation_readiness'
  | 'execution_closure'
  | 'audit_review'
  | 'delivery_confirmation'
  | 'record_closed';

type CurrentMentalModelState = {
  currentMentalModel: MentalModel;
  modelStatus: 'pending' | 'blocked' | 'pass' | 'skipped' | 'closed';
  reasonCode: string;
  sourceRefs: SourceRef[];
  updatedAt: string;
  updatedBy: string;
};
```

规则：

1. `record_closed` 只能从 `delivery_confirmation` 成功后进入。
2. `record_closed` 之后不能自动回退；如需变更，必须产生 reconfirm 或 reopen 类型的明确受控事件。
3. `currentMentalModel` 不能从 dashboard、score、stdout、HTTP 200 或 TaskReport done 直接推导。

### 6.2 `mentalModelTransitions`

每次模型迁移必须追加：

```ts
type MentalModelTransition = {
  transitionId: string;
  requirementSetId: string;
  previousModel: MentalModel;
  nextModel: MentalModel;
  previousStatus: string;
  nextStatus: string;
  reasonCode: string;
  sourceRefs: SourceRef[];
  recordHashBefore: string;
  recordHashAfter: string;
  writtenBy: string;
  writtenAt: string;
  controlledEventId: string;
};
```

规则：

1. `recordHashBefore` 和 `recordHashAfter` 必须存在。
2. transition event 与 record 写入必须原子一致。
3. transition 失败时不能只更新 `currentMentalModel`。
4. transition 的 `sourceRefs` 必须能追溯到 gate、evidence、confirmation、audit 或 blocker intake run。

### 6.3 `sixModelVerdicts`

每次 inspect 或 gate evaluation 应输出：

```ts
type SixModelVerdict = {
  model:
    | 'requirement_confirmation'
    | 'architecture_confirmation'
    | 'implementation_readiness'
    | 'execution_closure'
    | 'audit_review'
    | 'delivery_confirmation';
  status: 'not_started' | 'pending' | 'pass' | 'blocked' | 'stale' | 'skipped';
  blockingReasons: string[];
  sourceRefs: SourceRef[];
  nextRecommendedModel?: MentalModel;
  nextAction:
    | 'confirm_scope'
    | 'confirm_architecture'
    | 'run_readiness_gate'
    | 'dispatch_plan'
    | 'run_execution_closure'
    | 'run_audit_review'
    | 'run_delivery_closeout'
    | 'request_reconfirmation'
    | 'remediate'
    | 'manual_resolution_required'
    | 'none';
  evaluatedAt: string;
  evaluatedBy: string;
};
```

规则：

1. 当前模型 `status=pass` 是推进下一模型的必要条件。
2. 非当前模型可以预检，但不能越过当前模型推进。
3. `skipped` 只允许在明确范围不适用且有 sourceRefs 时出现。
4. `blocked` 或 `stale` 必须绑定 authoritative blocker 或 reconfirm request。

### 6.4 `pendingBlockerIntake`

新增或标准化：

```ts
type PendingBlockerIntake = {
  pending: boolean;
  reasonCode: string;
  rawSignalRefs: string[];
  requiredBefore:
    | 'inspect_decision'
    | 'model_transition'
    | 'dispatch'
    | 'readiness'
    | 'execution_closure'
    | 'audit_review'
    | 'delivery_closeout';
  enqueuedAt: string;
  enqueuedBy: string;
};
```

规则：

1. `pending=true` 时不能推进模型。
2. model transition 前必须检查 pending intake。
3. closeout 前必须运行 intake。
4. intake 失败或 unknown raw signal 必须 fail closed。

### 6.5 `blockerIntakeRuns`

每次归一化运行必须记录：

```ts
type BlockerIntakeRun = {
  intakeRunId: string;
  requirementSetId: string;
  rawSignalRefs: string[];
  normalizedSignalIds: string[];
  authoritativeWriteRefs: string[];
  dedupedSignalIds: string[];
  unresolvedSignalIds: string[];
  decision: 'pass' | 'blocked' | 'failed_closed';
  reasonCode: string;
  recordHashBefore: string;
  recordHashAfter: string;
  startedAt: string;
  completedAt: string;
  writtenBy: string;
};
```

规则：

1. 每个 raw signal 要么归一化，要么记录为 unknown blocker。
2. dedupe 不能删除未解决 blocker，只能标记为重复并指向 canonical blocker。
3. resolved 或 superseded 必须有新的验证 sourceRefs。

### 6.6 `reconfirmationRequests`

统一结构：

```ts
type ReconfirmationRequest = {
  requestId: string;
  requirementSetId: string;
  targetModel: 'requirement_confirmation' | 'architecture_confirmation';
  reasonCode:
    | 'source_hash_changed'
    | 'implementation_hash_changed'
    | 'architecture_hash_changed'
    | 'scope_semantic_drift'
    | 'evidence_semantic_drift'
    | 'architecture_decision_stale'
    | 'user_scope_change_required';
  blocking: true;
  sourceRefs: SourceRef[];
  affectedIds: string[];
  requestedAt: string;
  requestedBy: string;
  status: 'open' | 'confirmed' | 'superseded' | 'cancelled';
};
```

规则：

1. `blocking=true` 是默认且必须。
2. open reconfirmation request 阻断所有下游模型。
3. request 只能通过对应确认流程闭合。
4. request 不得由 dashboard、score 或 report 直接关闭。

## 7. controlled-blocker-intake 详细机制

### 7.1 三层模型

```text
Raw Signal
TaskReport / SubagentEvidenceEnvelope.failureRecords / inspect diagnostics / resolver projection / gate failure / drift result

-> NormalizedBlockerSignal
统一 reasonCode、severity、mentalModel、sourceRefs、affectedIds、dedupeKey、provenance

-> Authoritative Record Write
failureRecords / gateChecks / rerunLoops / artifactIndex / reconfirmationRequests / mentalModelTransitions / sixModelVerdicts
```

### 7.2 `NormalizedBlockerSignal`

建议结构：

```ts
type NormalizedBlockerSignal = {
  signalId: string;
  requirementId: string;
  mentalModel:
    | 'requirement_confirmation'
    | 'architecture_confirmation'
    | 'implementation_readiness'
    | 'execution_closure'
    | 'audit_review'
    | 'delivery_confirmation';
  category:
    | 'blocker'
    | 'missing_evidence'
    | 'stale_evidence'
    | 'ambiguous_evidence'
    | 'gate_failed'
    | 'scope_drift'
    | 'hash_drift'
    | 'provenance_missing'
    | 'resolver_ambiguous'
    | 'audit_failed'
    | 'closeout_blocked'
    | 'blocker_unknown';
  reasonCode: string;
  severity: 'info' | 'warning' | 'blocking' | 'fatal';
  blocking: boolean;
  affectedIds: string[];
  sourceRefs: SourceRef[];
  rawSignalRefs: string[];
  recommendedAction:
    | 'rerun'
    | 'remediate'
    | 'request_requirement_reconfirmation'
    | 'request_architecture_reconfirmation'
    | 'run_audit'
    | 'block_closeout'
    | 'manual_resolution_required';
  targetModel?: 'requirement_confirmation' | 'architecture_confirmation';
  dedupeKey: string;
  observedAt: string;
  observedBy: string;
  provenanceVerified: boolean;
};
```

### 7.3 Raw signal 来源

必须支持以下来源：

1. `TaskReport`
2. `SubagentEvidenceEnvelope.failureRecords`
3. inspect diagnostics
4. resolver projection
5. gate failures
6. drift results
7. audit/scoring failures
8. closeout blockers
9. command run failures
10. stale attempt or stale hash diagnostics
11. missing artifact diagnostics
12. ambiguous active requirement diagnostics

### 7.4 触发点

必须在以下位置触发或 enqueue blocker intake：

1. 子代理写 `TaskReport` 后 enqueue intake。
2. 子代理写 `SubagentEvidenceEnvelope.failureRecords` 后 enqueue intake。
3. inspect 产生 diagnostics 后立即 intake。
4. resolver 产生 ambiguity、index repair projection、fallback failure 后立即 intake。
5. gate 写入 failed、missing、stale、ambiguous 后 enqueue intake。
6. drift checker 发现 stale baseline、hash mismatch、semantic drift 后 enqueue intake。
7. `currentMentalModel` 迁移前必须 intake。
8. delivery closeout 前必须 intake。

建议新增显式 action：

```text
main-agent-orchestration --action controlled-blocker-intake
```

用于重放、修复和诊断。

### 7.5 归一化规则

1. 子代理只能产生 candidate signal，不能直接写顶层权威 blocker。
2. Main Agent 是唯一把 candidate signal 升级为 authoritative blocker 的入口。
3. provenance 缺失不能静默忽略，应归一化为 `provenance_missing`。
4. unknown failure 不能吞掉，应映射为 `blocker_unknown` 并 fail closed。
5. blocker 只能通过修复后重新 intake 和 revalidation 标记为 resolved 或 superseded。
6. dedupe 必须保留所有 rawSignalRefs。
7. normalized signal 必须绑定 `mentalModel`。
8. blocking signal 必须阻断 model transition。

## 8. main-agent-mental-model-gate

### 8.1 目标

新增 `main-agent-mental-model-gate`，统一计算 6 个模型状态：

1. `requirement_confirmation`
2. `architecture_confirmation`
3. `implementation_readiness`
4. `execution_closure`
5. `audit_review`
6. `delivery_confirmation`

每个模型输出：

1. `status`
2. `blockingReasons`
3. `sourceRefs`
4. `nextRecommendedModel`
5. `nextAction`

### 8.2 输入

gate 必须读取：

1. active requirement record
2. `currentMentalModel`
3. confirmation status and hashes
4. architecture confirmation state
5. gate checks
6. traceRows and commandRunRefs
7. artifactIndex
8. subagent evidence envelopes
9. rerun loops
10. failureRecords
11. reconfirmationRequests
12. readiness audit and score provenance
13. closeout state

### 8.3 输出

gate 必须输出：

1. `sixModelVerdicts`
2. current model verdict
3. next safe action
4. model transition candidate
5. blocker intake requirement, if any
6. reconfirmation request candidate, if any
7. user-visible inspect summary

### 8.4 推进规则

1. 只有当前模型 `status=pass` 才允许推进到下一个模型。
2. 有 blocking normalized signal 时，不能推进 `currentMentalModel`。
3. scope、hash、architecture、semantic drift 必须进入 reconfirm router。
4. missing、stale、ambiguous evidence 必须进入 rerun、remediation、reconfirmation 或 audit。
5. gate failed 不能 closeout。
6. Dashboard green、score green、TaskReport done、stdout PASS、HTTP 200、页面渲染、mock calls 都不能直接推进模型。
7. 所有推进、阻断、重跑、重新确认、审计、关闭都必须写入 controlled RequirementRecord store。

## 9. controlled-reconfirmation-router

### 9.1 触发条件

任一模型发现以下情况时，必须进入 reconfirm router：

1. source document hash changed
2. implementation confirmation hash changed
3. architecture confirmation hash changed
4. target paths hash changed
5. consumer impact scan hash changed
6. governance impact scan hash changed
7. scope semantic drift
8. evidence semantic drift
9. architecture decision stale
10. user requested scope change

### 9.2 路由规则

1. 需求文本、范围、验收、trace、evidence 语义变化，路由到 `requirement_confirmation`。
2. 架构目标路径、影响扫描、架构决策、架构 hash 变化，路由到 `architecture_confirmation`。
3. 两者同时变化时，先回到 `requirement_confirmation`，再进入 `architecture_confirmation`。
4. router 必须写入 `reconfirmationRequests`。
5. router 必须把 `currentMentalModel` 切回目标确认模型。
6. 下游模型必须 blocked，直到确认闭合。

### 9.3 禁止行为

1. 不允许靠 dashboard 或 score 自动关闭 reconfirmation。
2. 不允许只更新 hash 而不更新 confirmation history。
3. 不允许把 scope drift 当作普通 rerun。
4. 不允许在 open reconfirmation request 存在时 dispatch 或 closeout。

## 10. Architecture Confirmation 接入主控

### 10.1 新增 action

在 `main-agent-orchestration` 增加统一 action：

```text
architecture-confirmation-ingest
architecture-state-check
```

### 10.2 行为要求

1. 架构确认仍可由现有 `ingest-architecture-confirmation.ts` 执行底层受控写入。
2. Main Agent action switch 必须包装该能力，并把结果写回统一状态机。
3. `architecture_confirmation` verdict 必须读取主控 action 的结果。
4. state check 必须成为模型 gate 的输入。
5. 架构确认 stale、missing、hash mismatch 必须触发 reconfirm router 或 blocker intake。

### 10.3 验收要求

1. 通过 main-agent action ingest architecture confirmation 后，`architectureConfirmationState` 被受控更新。
2. `mentalModelTransitions` 记录从 `architecture_confirmation` 到 `implementation_readiness` 的迁移。
3. 直接运行底层脚本不能绕过主控状态检查。
4. stale architecture state 阻断 readiness、execution 和 closeout。

## 11. Execution Closure 模型

### 11.1 目标

新增 `execution_closure` verdict，使 inspect 在 closeout gate 之前就能读到执行闭合状态。

### 11.2 输入

`execution_closure` 必须汇总：

1. dispatch packet
2. traceRows
3. commandRunRefs
4. artifactIndex
5. SubagentEvidenceEnvelope
6. TaskReport
7. rerun loops
8. current attempt
9. failureRecords
10. pending blocker intake

### 11.3 判定

`execution_closure.status=pass` 需要满足：

1. 所有必需 trace row 均有当前 attempt evidence。
2. 所有 required command 均有 current pass evidence。
3. 所有 required artifacts 均存在、hash 当前、归属当前 attempt。
4. subagent envelope 无 unresolved failure。
5. rerun loops closed。
6. blocker intake 没有 unresolved blocking signal。
7. 没有 open reconfirmation request。

### 11.4 禁止行为

1. TaskReport done 不能直接让 execution closure pass。
2. command exit code 0 不能单独作为 evidence。
3. artifact exists 不能单独作为 closure proof。
4. previous attempt evidence 不能用于 current attempt closure。

## 12. Audit Review 模型

### 12.1 目标

新增 `audit_review` action 和 verdict，把 readiness audit、RunScoreRecord、score provenance、RCA、data production、eval/SFT、coach 输出纳入统一审计复核。

### 12.2 输入

`audit_review` 必须读取：

1. readiness audit report
2. RunScoreRecord
3. score provenance
4. RCA output
5. data production records
6. eval/SFT reports
7. coach output
8. quality gate output
9. current requirement record hashes
10. current attempt evidence

### 12.3 判定

`audit_review.status=pass` 需要满足：

1. 所有审计输入 hash 当前。
2. score provenance 完整。
3. read models 没有 reverse-drive control flow。
4. RCA 中没有 unresolved high severity issue。
5. eval/SFT 输出若存在，必须标明 read model 或 evidence 角色。
6. audit finding 与 blocker intake 同步。

### 12.4 禁止行为

1. Dashboard green 不能替代 audit review。
2. score green 不能替代 audit review。
3. report says pass 不能直接 closeout。
4. coach 输出只能作为 evidence/read model，不能写 control decision。

## 13. Delivery Confirmation 模型

### 13.1 目标

`delivery_confirmation` 是 record close 前最后一个模型，负责确认 delivery truth、closeout gate、current attempt、blocker intake 与审计结果一致。

### 13.2 输入

1. delivery closeout gate result
2. delivery truth gate result
3. execution closure verdict
4. audit review verdict
5. current attempt evidence
6. failureRecords
7. rerunLoops
8. reconfirmationRequests
9. requirement closures
10. record hash and source hash

### 13.3 判定

`delivery_confirmation.status=pass` 需要满足：

1. closeout gate pass。
2. delivery truth gate pass。
3. execution closure pass。
4. audit review pass。
5. no open blocking failureRecords。
6. no open rerun loops。
7. no open reconfirmationRequests。
8. evidence belongs to current attempt。

### 13.4 终态迁移

`delivery_confirmation.status=pass` 后，Main Agent 可迁移：

```text
delivery_confirmation -> record_closed
```

迁移必须写入：

1. `currentMentalModel=record_closed`
2. final `mentalModelTransitions`
3. terminal requirement closure
4. final closeout summary
5. final record hash

## 14. 主控 action 清单

### 14.1 必须新增或标准化的 actions

```text
inspect
controlled-blocker-intake
main-agent-mental-model-gate
controlled-reconfirmation-router
architecture-confirmation-ingest
architecture-state-check
implementation-readiness-gate
dispatch-plan
execution-closure
audit-review
delivery-confirmation
record-close
```

### 14.2 action 职责

| Action | 职责 | 是否可写控制记录 |
|---|---|---|
| `inspect` | 解析 active requirement、读当前模型、输出下一步 | 仅可触发受控 intake 或 transition |
| `controlled-blocker-intake` | raw signal 归一化并写 authoritative blocker | 是 |
| `main-agent-mental-model-gate` | 计算 sixModelVerdicts 和 nextAction | 可写 verdict，不直接 closeout |
| `controlled-reconfirmation-router` | 写 reconfirmation request 并切回确认模型 | 是 |
| `architecture-confirmation-ingest` | 受控记录架构确认 | 是 |
| `architecture-state-check` | 检测架构状态 stale/mismatch | 是 |
| `implementation-readiness-gate` | 实施准备门禁 | 是 |
| `dispatch-plan` | 生成 bounded packet | 可写 packet/evidence，不可 closeout |
| `execution-closure` | 汇总执行闭合 verdict | 是 |
| `audit-review` | 汇总审计复核 verdict | 是 |
| `delivery-confirmation` | 交付确认 verdict | 是 |
| `record-close` | 关闭 record | 是 |

## 15. 用户可见 inspect 输出

inspect 输出必须包含：

1. active requirement id
2. currentMentalModel
3. current model status
4. six model summary
5. blocking category
6. authoritative source checked
7. pending blocker intake status
8. open reconfirmation requests
9. next safe action
10. forbidden shortcuts

建议状态码：

```text
ready_for_requirement_confirmation
ready_for_architecture_confirmation
ready_for_implementation_readiness
ready_for_dispatch
ready_for_execution_closure
ready_for_audit_review
ready_for_delivery_confirmation
completed_record_closed
blocked_pending_blocker_intake
blocked_open_reconfirmation_request
blocked_current_model_failed
blocked_stale_architecture_confirmation
blocked_missing_execution_evidence
blocked_audit_review_failed
blocked_delivery_confirmation_failed
manual_resolution_required
```

## 16. 非目标

本需求不做以下事项：

1. 不把 dashboard projection 改成控制源。
2. 不允许 score green、stdout PASS、TaskReport done、HTTP 200 或页面渲染直接关闭需求。
3. 不绕过 controlled writer 直接修改 `currentMentalModel`。
4. 不让子代理直接写顶层权威 blocker。
5. 不把 architecture confirmation 继续保留为主控不可见的孤立流程。
6. 不重写整个 scoring framework。
7. 不改变 delivery closeout gate 的最终判定地位。
8. 不用 mock-only、fixture-only 或 smoke-only 结果作为验收证据。

## 17. 最优实施顺序

1. 定义 record 契约字段：`currentMentalModel`、`mentalModelTransitions`、`sixModelVerdicts`、`pendingBlockerIntake`、`blockerIntakeRuns`、`reconfirmationRequests`。
2. 实现 `controlled-blocker-intake` normalizer，覆盖 TaskReport、Envelope、inspect、resolver、gate、drift、audit、closeout。
3. 在 Main Agent inspect/action wrapper 中加入 `maybeRunControlledBlockerIntake()`。
4. 实现 `main-agent-mental-model-gate`，统一计算 6 模型状态和 next action。
5. 实现 `controlled-reconfirmation-router`，支持任一模型请求需求或架构重新确认。
6. 将 architecture confirmation ingest/state check 接入 `main-agent-orchestration`。
7. 增加 `execution_closure` verdict。
8. 增加 `audit_review` verdict。
9. 增加 `delivery_confirmation` verdict 和 `record_closed` 终态迁移。
10. 保持 dashboard 只读，用它展示控制面结果，而不是参与控制流。
11. 更新 README、reference docs、dashboard docs，使图示表达实际控制态，而不是仅展示目标态。

## 18. 功能需求

### FR-001 `currentMentalModel` 受控维护

系统必须在 `RequirementRecord` 中维护 `currentMentalModel`，并只允许受控 writer 或 control-store event 更新。

每次迁移必须记录：

1. `previousModel`
2. `nextModel`
3. `reasonCode`
4. `sourceRefs`
5. `recordHashBefore`
6. `recordHashAfter`
7. `writtenBy`
8. `writtenAt`

### FR-002 6 模型状态机可计算

系统必须提供 `main-agent-mental-model-gate`，能够对 6 个模型输出 verdict，并给出 next action。

只有当前模型 `status=pass` 时，才允许推荐推进到下一个模型。

### FR-003 blocker intake 统一归一化

系统必须提供 `controlled-blocker-intake`，统一接收并归一化以下 raw signals：

1. `TaskReport`
2. `SubagentEvidenceEnvelope.failureRecords`
3. inspect diagnostics
4. resolver projection
5. gate failures
6. drift results
7. audit/scoring failures
8. closeout blockers

归一化后必须写入受控 record 字段：

1. `failureRecords`
2. `rerunLoops`
3. `gateChecks`
4. `artifactIndex`
5. `reconfirmationRequests`
6. `mentalModelTransitions`
7. `sixModelVerdicts`

### FR-004 子代理不能直接推进主控状态

子代理返回 `TaskReport done` 或 evidence envelope 后，只能作为 candidate evidence input。Main Agent 必须重新读取 record，运行 blocker intake 和 mental model gate 后，才能决定是否推进。

### FR-005 reconfirm router 覆盖所有模型

任一模型发现 source hash、implementation hash、architecture hash、scope 或 evidence semantic drift 时，必须写入 blocking `reconfirmationRequests`，并将 `currentMentalModel` 切回 `requirement_confirmation` 或 `architecture_confirmation`。

### FR-006 Architecture Confirmation 通过主控 action 接入

架构确认 ingest 和 state check 必须通过 `main-agent-orchestration` action 暴露，并进入统一 record event 链。

### FR-007 Audit Review 产生模型 verdict

系统必须新增 `audit-review` action，读取 readiness audit、RunScoreRecord、RCA、data production、eval/SFT、coach 输出，并生成 `audit_review` verdict。

Dashboard 或 score green 不能直接替代该 verdict。

### FR-008 Execution Closure 可被 inspect 提前读取

系统必须新增 `execution_closure` verdict。inspect 必须显示 packet、traceRows、commandRunRefs、artifactIndex、subagent envelope、rerun loops 和 current attempt 的闭合状态。

### FR-009 Dashboard 仍为只读投影

Dashboard six-model projection 可以展示模型状态，但不得影响 control flow。控制权威仍为 requirement record。

### FR-010 Delivery Confirmation 与 record close

系统必须新增 `delivery_confirmation` verdict。只有 delivery confirmation pass 后，Main Agent 才能迁移到 `record_closed`。

### FR-011 stale/missing/ambiguous 统一 fail closed

任何 stale hash、missing evidence、ambiguous evidence、resolver ambiguity、unknown failure 或 provenance missing 都必须进入 blocker intake，并在未解决前阻断模型推进。

### FR-012 read model 不能反向驱动控制流

score、dashboard、SFT、report、summary、hook receipt、stdout、HTTP 200、page render 都不能直接写 `currentMentalModel`、`sixModelVerdicts`、`closeout`、`requirementClosures` 或 terminal decision。

## 19. 验收标准

### AC-001 `currentMentalModel` 受控维护

GIVEN Main Agent 完成任一模型迁移  
WHEN requirement record 被更新  
THEN `currentMentalModel` 和 `mentalModelTransitions` 必须同时更新  
AND transition 必须包含 before/after hash、reasonCode 和 sourceRefs。

### AC-002 6 模型状态机可计算

GIVEN 一个受控 requirement record  
WHEN 运行 main-agent mental model gate  
THEN 输出 6 个模型的 verdict  
AND 只有当前模型 pass 时才推荐推进到下一个模型。

### AC-003 blocker intake 统一归一化

GIVEN TaskReport、SubagentEvidenceEnvelope、inspect diagnostics、resolver projection、gate failure 或 drift result 产生 failure signal  
WHEN controlled-blocker-intake 运行  
THEN 生成 NormalizedBlockerSignal  
AND 写入受控 failureRecords、rerunLoops、gateChecks、artifactIndex 或 reconfirmationRequests。

### AC-004 子代理不能直接推进主控状态

GIVEN 子代理返回 TaskReport done 或 envelope  
WHEN Main Agent inspect 重新读取 record  
THEN TaskReport done 只能作为 evidence input  
AND 不能直接推进 `currentMentalModel` 或 closeout。

### AC-005 reconfirm router 覆盖所有模型

GIVEN 任一模型发现 source hash、implementation hash、architecture hash、scope 或 evidence semantic drift  
WHEN reconfirm router 运行  
THEN 写入 blocking `reconfirmationRequests`  
AND 将 `currentMentalModel` 切回 `requirement_confirmation` 或 `architecture_confirmation`  
AND 阻断下游模型推进。

### AC-006 Architecture Confirmation 通过主控 action 接入

GIVEN 用户或系统需要 ingest architecture confirmation  
WHEN 通过 main-agent orchestration action 执行  
THEN 受控写入 `architectureConfirmationState`  
AND mental model gate 能读取该状态并推进或阻断。

### AC-007 Audit Review 产生模型 verdict

GIVEN readiness audit、RunScoreRecord、RCA、data production、eval/SFT 或 coach 输出存在  
WHEN audit-review action 运行  
THEN 生成 `audit_review` verdict  
AND dashboard 或 score green 不能直接替代该 verdict。

### AC-008 Execution Closure 可被 inspect 提前读取

GIVEN packet、traceRows、commandRunRefs、artifactIndex、subagent envelope、rerun loops 已产生  
WHEN inspect 运行  
THEN 输出 `execution_closure` verdict  
AND closeout gate 继续作为最终交付判定。

### AC-009 Dashboard 仍为只读投影

GIVEN dashboard six-model projection 显示 green 或 pass  
WHEN Main Agent 判断下一步  
THEN dashboard projection 不得影响 control flow  
AND 控制权威仍为 requirement record。

### AC-010 Delivery Confirmation 后才能 record close

GIVEN execution closure 与 audit review 均 pass  
WHEN delivery closeout gate 与 delivery truth gate pass  
THEN delivery confirmation verdict 为 pass  
AND Main Agent 可写入 `currentMentalModel=record_closed`。

### AC-011 stale evidence 阻断推进

GIVEN evidence 属于旧 attempt 或旧 hash  
WHEN mental model gate 评估当前模型  
THEN verdict 必须为 blocked 或 stale  
AND 不能推进到下一个模型。

### AC-012 unknown failure fail closed

GIVEN blocker intake 遇到无法识别的 failure signal  
WHEN 归一化运行完成  
THEN 必须写入 `blocker_unknown`  
AND 阻断模型推进直到人工或修复流程解决。

## 20. 测试要求

必须新增或更新测试覆盖：

1. `currentMentalModel` transition 写入 before/after hash。
2. mental model gate 输出 6 个 verdict。
3. 当前模型未 pass 时不推荐推进。
4. TaskReport done 不能直接推进状态。
5. SubagentEvidenceEnvelope failureRecords 进入 blocker intake。
6. inspect diagnostics 进入 blocker intake。
7. resolver ambiguity 进入 blocker intake。
8. gate failure 进入 blocker intake。
9. drift stale/hash mismatch 进入 reconfirm router。
10. reconfirm router 切回 requirement confirmation。
11. reconfirm router 切回 architecture confirmation。
12. architecture confirmation ingest 通过 main-agent action 接入。
13. architecture state check stale 阻断 readiness。
14. execution closure 汇总 traceRows、commandRunRefs、artifactIndex、envelope、rerun loops。
15. audit review 汇总 readiness audit、RunScoreRecord、RCA、eval/SFT、coach 输出。
16. dashboard six-model projection 仍为 read model。
17. score green 不能直接 closeout。
18. delivery confirmation pass 后才能 record close。
19. unknown failure 映射为 `blocker_unknown`。
20. stale attempt evidence 不能作为 current evidence。
21. encoding integrity scan pass。

## 21. Rollout Gate

没有以下 evidence，不得宣称本需求完成：

1. Unit tests for `currentMentalModel` transitions。
2. Unit tests for `main-agent-mental-model-gate`。
3. Acceptance tests for `controlled-blocker-intake` covering TaskReport、Envelope、inspect、resolver、gate、drift。
4. Acceptance tests for reconfirm router across requirement and architecture confirmation。
5. Acceptance tests for architecture confirmation main-agent action switch。
6. Acceptance tests for execution closure verdict。
7. Acceptance tests for audit review verdict。
8. Acceptance tests proving dashboard/score/read model cannot affect control flow。
9. Acceptance tests for delivery confirmation and record close。
10. Encoding integrity scan pass。
11. No unrelated source changes in implementation path。

## 22. Must Not Count As Completion

以下信号不得作为完成证据：

1. Dashboard green。
2. Score green。
3. TaskReport done。
4. stdout PASS。
5. command exit code 0 without semantic assertions。
6. HTTP 200。
7. 页面渲染成功。
8. mock calls。
9. fixture-only replay。
10. artifact exists but hash/attempt/provenance missing。
11. closeout report exists but requirement record 未写 terminal control state。

## 23. 预期最终用户体验

完成后，用户运行 `$bmad-speckit` 或等价主控入口时，输出应类似：

```text
Active requirement: REQ-...
Current mental model: execution_closure
Current model status: blocked
Blocking reason: stale_evidence
Authoritative source: requirement-record.json / blockerIntakeRuns / traceRows
Next safe action: rerun implementation evidence for current attempt
Forbidden shortcuts: dashboard green, score green, TaskReport done
```

若全部闭合，输出应类似：

```text
Active requirement: REQ-...
Current mental model: record_closed
Six model chain: pass
Delivery confirmation: pass
Next safe action: none
Status: completed_record_closed
```

## 24. 最终效果

完成后，README 图、6 心智模型、16 子系统、RequirementRecord、closeout gate、audit/scoring、reconfirmation、inspect 行为会统一到同一个 Main Agent 控制面。

所有模型都可以发现问题，但只有 Main Agent 可以把问题权威化、路由化、闭合化。Dashboard、score、TaskReport、stdout、HTTP 返回和页面渲染都只能作为 evidence 或 read model，不能成为控制流权威。
