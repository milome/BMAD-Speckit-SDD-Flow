# MA-GS 受控收尾最小修复方案

## 目标

用一条生产级闭合路径替换手工 artifact 拼装、重复语义审计和重复 TaskReport 投影，使 campaign evidence 经 `close-completed-campaign` 的一次确定性校验和已完成的 `JudgeReviewCampaign` 后，由 Main Agent 原样消费，并继续进入 acceptance/release gate。

优先级：功能完整和可验证 > 快速闭合 > 通用框架能力。

本计划已整合 [Judge Review 与 Closeout 校验审计链路](../../design/2026-08-08-judge-review-closeout-validation-chain.md) 的已确认决策；该 design 文档保留讨论来源，本计划是后续实现与验收的执行权威。

## 闭合边界

本计划只负责 goal 子合同 campaign 的受控闭合，以及 candidate TaskReport 到 Main Agent、delivery gate 和后续 acceptance/release audit 的 provenance 衔接。

CI catalog、test profile、shard plan、nightly/full regression 和 CI 健康状态不属于本次 closeout authority、前置条件或 `status=done` 判定；本计划只执行为本次 producer、auditor、TaskReport 和 downstream gates 明确需要的定向测试与证据。

## 核心决策

1. 新增唯一生产 `close-completed-campaign` producer；它不跑测试，只验证 immutable context/evidence，确定性生成 artifacts，并且仅在 producer 内调用一次既有 `audit-completed-campaign.js` 校验刚生成的 artifacts。
2. 成功路径只保留一份 campaign TaskReport candidate；Main Agent 完成 receipt/candidate ingest 校验并通过 gates 后原字节持久化，禁止二次投影。Candidate 的 `done` 仅表示 campaign 闭合，completion receipt 前不得输出 delivery `done`。
3. 旧 attempts 只读；新 attempt 在 sibling draft 完整校验后 create-once rename 发布。
4. Producer 发布 `GoalCampaignClosureReceipt` 后，`JudgeReviewCampaign` 是 Native Reviewer 与 `final_acceptance_judge` 的唯一调用 owner：它在一个 blind wave 中并行发起两次调用并消费两份 current receipts；上游只提供 Requirements Critical Auditor receipt，不提供 Reviewer/Final Judge receipt。两者只产生结构化 review/assessment lineage，不修改源码、TaskReport 或 delivery 状态，也不拥有 pass authority。
5. Clean 路径由 campaign merger 机械生成唯一 `FinalEffectivePass`；只有 remediation 实质改变 governed implementation/evidence bytes 时，才创建新的 closeout attempt/context/candidate/closure receipt，保留旧 attempt 只读，并在新 attempt 上只追加一次 current-byte Final Judge rejudge，不再次调用 Native Reviewer。新 receipt 通过 `priorAttemptHash`、`remediationReceiptHash` 和 current-byte hashes 连接旧 Reviewer receipt，不要求旧 Reviewer receipt 伪装绑定新 bytes。
6. Judge provider 采用 gateway-managed model policy：authority 绑定受控 provider/gateway、当前 request/evidence/attempt 和结构化 decision，不绑定具体模型名称；3010 gateway 可以动态切换或重试 Judge 模型。最小实现复用现有 `endpoint.routingOwnership=transport_adapter` 与 `endpoint.upstreamVersioning=gateway_managed` 标记，不新增通用 model policy schema。
7. Main Agent 只 ingest producer 和 JudgeReviewCampaign 已发布的 receipts，校验 hashes、candidate bytes 与 `FinalEffectivePass` binding；禁止第二次运行 `audit-completed-campaign.js`，也禁止再次调用 Reviewer 或 Final Judge。`FinalEffectivePass` 的唯一 writer 是 `requirements-contract-final-acceptance-effective-pass-gate.ts`，campaign merger 只提交其确定性输入。

## 生产修改面

新增：

- `_bmad/skills/goal-subcontract-execution-package-generator/scripts/close-completed-campaign.js`
- `_bmad/skills/goal-subcontract-execution-package-generator/schemas/campaign-closeout-context.schema.json`
- `_bmad/skills/goal-subcontract-execution-package-generator/schemas/goal-campaign-closure-receipt.schema.json`
- `packages/bmad-speckit/src/main-agent/source-authority/schemas/main-agent-goal-judge-stage-status-receipt.schema.json`

修改：

- `_bmad/skills/goal-subcontract-execution-package-generator/scripts/audit-completed-campaign.js`
- `_bmad/skills/goal-subcontract-execution-package-generator/SKILL.md`
- `_bmad/skills/goal-subcontract-execution-package-generator/schemas/campaign-task-report-binding.schema.json`
- `_bmad/skills/goal-subcontract-execution-package-generator/schemas/repair-final-validation-binding.schema.json`
- `_bmad/skills/requirements-contract-authoring/scripts/ingest-confirmation-event.js`
- `packages/bmad-speckit/src/main-agent/actions/native-goal-invoker.ts`
- `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-closeout-gate.ts`
- `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-governed-goal-integration.ts`
- `packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts`
- `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-parent-goal-blind-review.ts`
- `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign-input.ts`
- `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign-trace.ts`
- `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign.ts`
- `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-final-integration-lineage.ts`
- `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-final-acceptance-effective-pass-gate.ts`
- `packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-codex-cli-judge-adapter.ts`

`_bmad/shared/requirements-contract/requirements-contract-judge-provider-registry.json` 是生成产物，不允许手工修改。本计划消费执行开始时已冻结的 active provider/registry hash；切换全局 provider 或修改 `_bmad/_config/governance-remediation.yaml` 是独立配置操作，不属于 closeout 生产修改面。

生成但不手工修改：`packages/bmad-speckit/dist/main-agent/**`（由 `build:main-agent-dist` 生成）以及 provider registry projection。生成后必须用 owner/source hashes 回读验证。

## Closeout Context

Context 由 Main Agent controlled dispatch 生成。Producer 只接受 `--context` 和 `--expected-context-hash`，禁止调用方再次覆盖独立字段。

必需绑定：

- package ID、manifest self-hash 和 manifest artifact hash。
- campaign activation hash 和 active pointer document-byte hash。
- repair attempt ID、repair authority receipt/artifact hash。
- ordered child closure set hash。
- final-validation command IDs、每条 command definition hash、ordered command set hash，以及 Main Agent dispatch receipt/artifact immutable path 和 document-byte hash。
- ordered final-validation evidence bindings、ordered collection evidence bindings，以及两个 evidence set hash；每个 binding 包含 immutable path、document-byte hash、command definition hash 和 schema version。
- validation HEAD、tree 和 `raw-tracked-v1` materialization hash。
- context self-hash：`sha256(stableJson(context excluding contextHash))`。CLI 的 expected hash 必须匹配该值；package paths 必须位于 selected package root，evidence/artifact paths 必须位于本 attempt immutable root，并拒绝 traversal、symlink escape 和 root mismatch。

`CloseoutContext/v1` 的 canonical nesting 固定如下；schema 可增加 `additionalProperties: false` 等机械约束，但不得重命名或移动这些字段：

```json
{
  "schemaVersion": "campaign-closeout-context/v1",
  "closeoutAttemptId": "...",
  "priorAttemptHash": null,
  "sourcePlanHash": "sha256:...",
  "package": {
    "root": "...",
    "packageId": "...",
    "manifestPath": "...",
    "manifestSelfHash": "sha256:...",
    "manifestArtifactHash": "sha256:..."
  },
  "compileReceipt": {
    "path": "...",
    "documentHash": "sha256:...",
    "commandId": "...",
    "packageId": "...",
    "manifestHash": "sha256:...",
    "validationHead": "...",
    "validationTree": "...",
    "attemptId": "..."
  },
  "campaign": {
    "activationHash": "sha256:...",
    "activePointerPath": "...",
    "activePointerDocumentHash": "sha256:..."
  },
  "repairAuthority": {
    "attemptId": "...",
    "receiptPath": "...",
    "receiptHash": "sha256:...",
    "artifactHash": "sha256:..."
  },
  "childClosures": [],
  "childClosureSetHash": "sha256:...",
  "finalValidationEvidence": [],
  "finalValidationEvidenceSetHash": "sha256:...",
  "collectionEvidence": [],
  "collectionVerificationSetHash": "sha256:...",
  "validationMaterialization": {
    "head": "...",
    "tree": "...",
    "algorithm": "raw-tracked-v1",
    "hash": "sha256:..."
  },
  "allowedWritePaths": [],
  "allowedWritePathSetHash": "sha256:...",
  "contextHash": "sha256:..."
}
```

Collection command IDs 和命令定义只从已验证 package manifest 读取。
Final-validation command definitions 只从已验证 repair authority/dispatch artifact 读取；producer 必须重算 command set hash。两个 evidence set hash 均为 manifest/dispatch 顺序下 bindings 的 `sha256(stableJson(...))`。

`raw-tracked-v1` 从 validation HEAD 的 stage-0 `git ls-files --stage -z` inventory 生成：按 UTF-8 repository-relative path 字节序排序，绑定 path、mode、type 和 raw worktree byte hash；symlink 绑定 link bytes，gitlink 绑定 commit，缺失文件、非 stage-0 entry 或 type mismatch 直接失败。Generated/ignored evidence 不进入该 inventory，必须作为独立 document-byte binding 进入 evidence set。

## Contract objects and writers

本计划不新增通用 closeout 状态机；以下是本 goal closeout 的最小对象、字段和唯一 writer：

| 对象 | 最小必需绑定 | 唯一 writer |
|---|---|---|
| `CloseoutContext/v1` | `closeoutAttemptId`、`packageId`、`packageManifestHash`、`compileReceiptPath`、`compileReceiptHash`、`campaignActivationHash`、`childClosureSetHash`、两个 evidence set hashes、`validationMaterializationHash`、`contextHash` | Main Agent controlled dispatch |
| `GoalCampaignClosureReceipt/v1` | context hash、compile receipt hash、child closure hash、campaign report path/hash、candidate path/hash、current attempt、`status=campaign_closed`、self hash | `close-completed-campaign` producer；该 receipt 同时是 closeout receipt，不再另造同义 receipt |
| `JudgeReviewCampaignInput/v2` | closure receipt hash、candidate bytes hash、current implementation/evidence hashes、actor classes、providerRef、`initialReviewAttemptKey` | JudgeReviewCampaign controller |
| `JudgeReviewCampaignAggregate/v2` | 两个 blind actor receipts、identical blind input hash、actor binding hash、finding IDs、invocation counts、remediation linkage | `requirements-contract-parent-goal-blind-review.ts` / campaign controller |
| `FinalAcceptanceEffectivePassReceipt/v1` | current final acceptance state hash、ledger head、required/observed closure counts、`effectivePass=true`、self hash；campaign aggregate/prior-attempt hashes 必须先闭合进 state/ledger | `requirements-contract-final-acceptance-effective-pass-gate.ts` |
| `JudgeStageStatusReceipt/v1` | `closeoutAttemptId`、phase=`judge`、`executionStatus`、`auditDecision`、providerRef、logicalAttemptOrdinal、maxAttempts、resumeFrom、sourceErrorCode、self hash | Main Agent orchestration |
| `TaskReport` | candidate original bytes and artifact hash; completion receipt only after `record_closed` | candidate: producer；final bytes: Main Agent orchestration |

`FinalEffectivePass` 是 `FinalAcceptanceEffectivePassReceipt/v1` 的业务简称，禁止新增第二套 pass schema。Producer、campaign controller、effective-pass gate、delivery gate、confirmation ingest 和 completion writer 的输入/输出路径必须按上表固定；任何其他 writer 产生同名 artifact 直接失败。

`GoalCampaignClosureReceipt/v1` 固定为下列 payload；`receiptHash=sha256(stableJson(payload excluding receiptHash))`：

```json
{
  "schemaVersion": "goal-campaign-closure-receipt/v1",
  "closeoutAttemptId": "...",
  "priorAttemptHash": null,
  "contextHash": "sha256:...",
  "compileReceiptHash": "sha256:...",
  "childClosureSetHash": "sha256:...",
  "campaignReportPath": "campaign-report.json",
  "campaignReportHash": "sha256:...",
  "taskReportCandidatePath": "task-report-candidate.json",
  "taskReportArtifactHash": "sha256:...",
  "status": "campaign_closed",
  "receiptHash": "sha256:..."
}
```

`JudgeReviewCampaign` 删除现有 `modelDiversityReceiptHash` 的 authority 依赖，改用由 `{reviewerActorClass, finalJudgeActorClass, providerRef}` 生成的 `actorBindingHash`；`modelRef`、`modelFamily`、`modelRevisionHash` 仅可选诊断字段，缺失或变化不影响 PASS。Native Reviewer 仍必须是 `bounded_code_reviewer`，Final Judge 仍必须是 `final_acceptance_judge`，两者的 actor class 和 blind input 是独立性的可验证来源。

Remediation 的新 attempt 必须满足：`newAttempt.priorAttemptHash === oldAttempt.receiptHash`，`newAttempt.remediationReceiptHash` 绑定 finding closure，`newAttempt.candidateBytesHash` 与 `newAttempt.contextHash` 同步更新；旧 attempt、旧 candidate、旧 Reviewer receipt 永不覆盖。Clean path 只有一个 attempt；remediation path 的最终 completion receipt 只绑定最新 attempt，但保留完整 prior-attempt 链。

## JudgeReviewCampaign 与最终 delivery confirmation

JudgeReviewCampaign、Main Agent ingest 和用户确认是同一条 closeout 链上的三个不同责任点：

- Producer 发布 `GoalCampaignClosureReceipt`（即唯一 closeout receipt）、campaign report 和 TaskReport candidate 后，冻结 JudgeReviewCampaign scope，绑定 current implementation/evidence bytes、closure receipt 和 candidate bytes。
- JudgeReviewCampaign 在一个 blind wave 中并行调用 Native Bounded Code Reviewer 和 provider-backed `final_acceptance_judge`。Reviewer 不走 Judge provider registry；Final Judge 复用现有 prompt、schema、provider registry 和 lineage。
- Clean wave 只有在 Reviewer `terminalOutcome=clean` 且 Final Judge assessment `verdict=coverage_satisfied` 时，才向既有 `requirements-contract-final-acceptance-effective-pass-gate.ts` 提交确定性输入并生成 `FinalAcceptanceEffectivePassReceipt/v1`。Reviewer 和 Final Judge 都不直接写 pass、TaskReport、`record_closed` 或 delivery 状态。
- Findings 只进入一次 remediation batch。若 governed bytes 未变化，先返回 remediation-required，不调用新的语义模型；若 bytes 发生变化，创建新 closeout attempt/context/candidate/closure receipt，保留旧 Reviewer receipt 只读，由 remediation receipt 连接旧 finding 与新 bytes，再只追加一次 current-byte Final Judge rejudge，不再次调用 Reviewer。
- Main Agent 不发起新的语义审计，只校验 producer receipt hash、candidate bytes、JudgeReviewCampaign aggregate、prior-attempt/remediation linkage 与 `FinalAcceptanceEffectivePassReceipt/v1` binding，并消费当前 `main-agent:delivery-truth-gate` receipt。
- `main-agent-delivery-closeout-gate.ts` PASS 只生成 closeout report、acceptance request 和 `status=awaiting_user_acceptance`，不重复执行 nightly/full CI，也不直接产生 delivery `done`。
- 用户只提交确认意图，不直接拥有 delivery 状态写权限。持有当前 closeout lease 的 `main-agent-orchestration.ts` 调用 `ingest-confirmation-event.js`，在同一 attempt 下校验 source/implementation hash、confirmation page hash、delivery closeout report hash 和 awaiting-acceptance proof；accept 才写 `user_accepted_closeout`、`record_closed`，reject 只写 `user-confirmation decision=reject` 并保持 `blocked`，expired/stale 保持 awaiting-user-acceptance 并要求新 confirmation page，技术 ingest error 不改变 candidate 或状态。
- `record_closed` 之后 Main Agent orchestration 是唯一 TaskReport final-byte writer，读取 candidate 原始字节并以同一 `taskReportArtifactHash` 持久化，再写入闭合 context、campaign、JudgeReviewCampaign、`FinalAcceptanceEffectivePassReceipt/v1`、closeout 和 user-confirmation hashes 的 completion receipt。后续 acceptance/release audit 只沿这些 hashes 回读验证，是 done 后的 forensic/read-only 证据，不撤销 `done` 或阻塞本次 delivery。

### Gateway-managed model policy

- Judge authority 绑定受控 provider/gateway 和当前 request/evidence/attempt，不绑定具体模型名、model alias 或 model family。
- 3010 gateway 可以动态切换 Judge 模型，也可以在同一次调用中重试或选择备用模型；最终返回合法、完整、可绑定的结构化 decision 即视为有效完成。
- Codex JSONL 缺少 `model`、Claude/Codex 报告的模型名变化，或实际模型名与配置 alias 不一致，均不得单独阻断 PASS。可观测模型名只作非阻塞诊断信息。
- 不要求 per-request gateway routing receipt，不伪造 `decisionBearingModelEvidence=true`。执行契约以现有 `endpoint.routingOwnership=transport_adapter` 与 `endpoint.upstreamVersioning=gateway_managed` 的组合标记识别 gateway-managed provider，不新增 `modelIdentityPolicy`、`modelBindingRequired` 或其他通用模型身份 schema。
- Fail-closed 只约束是否获得与 current evidence/attempt 绑定的合法 Judge decision，不约束具体由哪个模型作出 decision。

| Provider/Judge 场景 | `JudgeStageStatusReceipt` 执行状态 | 审计决策 | 行为 |
|---|---|---|---|
| Provider 未配置 | `awaiting_provider_configuration` | `not_produced` | 暂停当前 Judge 阶段，不创建失败的 Judge attempt |
| Provider 返回 `401/403` | `provider_auth_required` | `not_produced` | 保留已有 receipts，等待凭证修复 |
| Provider 返回 `429/503` 或超时 | `provider_temporarily_unavailable` | `not_produced` | 按 provider registry 的 `requestPolicy.maximumAttempts` 计 logical attempt；gateway 内部 retry/fallback 不新增语义调用，耗尽后暂停 |
| 进程异常、空响应或 schema 无效 | `provider_execution_error` | `not_produced` | 不生成 `FinalEffectivePass` |
| Judge 有效返回 PASS | `completed` | `pass` | 允许 campaign merger 生成 Mechanical `FinalEffectivePass` |
| Judge 有效返回 FAIL | `completed` | `fail` | 进入 remediation，不进入 Main Agent closeout |

Provider 未配置、认证失败、暂时不可用或执行错误不是审计失败，也不得写成 `inconclusive/unknown` 的审计结论；这些结果写入 closeout 专用 `JudgeStageStatusReceipt/v1`，不改变通用 Judge invocation receipt 的成功 decision schema。Provider 恢复后由 Main Agent 以同一 `closeoutAttemptId` 手动 resume Judge 阶段：producer/closure/evidence hashes 未变化则复用，Judge stage receipt 以新的 logical attempt ordinal create-once 发布；若 governed bytes 变化，必须走新的 closeout attempt。

恢复入口固定为 Main Agent controlled dispatch 的 `resumeJudgeStage(closeoutAttemptId, expectedContextHash)`；它只能读取已有 producer/closure/evidence receipts、校验 context hash 后进入 Judge 阶段，不能重跑 producer 或选择新 evidence。`logicalAttemptOrdinal` 从现有 provider `requestPolicy.maximumAttempts` 读取，gateway 内部 retries/fallbacks 不产生新的 semantic receipt。

### FinalEffectivePass truth table

Final Judge assessment 的唯一归一化是：`coverage_satisfied -> clean/pass`，`findings_present -> findings/remediation`，`insufficient_evidence|blocked -> blocked`。Native Reviewer 使用现有 actor receipt 的 `terminalOutcome=clean|findings|blocked`。Campaign merger 必须按下表机械决定，不得自行解释：

组合匹配按以下优先级从上到下执行，确保 truth table 互斥：`not_produced` > `blocked` > `findings/remediation` > `clean/pass`。

| 路径 | Reviewer / remediation closure | Final Judge | 结果 |
|---|---|---|---|
| Initial clean | Reviewer=`clean` | `coverage_satisfied` | 调用 EffectivePass gate；成功后生成唯一 pass receipt |
| Initial findings | 任一 Reviewer=`findings` 或 Final Judge=`findings_present` | 任意非 blocked | 进入一次 remediation batch；不生成 pass |
| Initial blocked | Reviewer=`blocked` | 任意，或 Judge=`insufficient_evidence|blocked` | `blocked`；不生成 pass |
| Provider 未产生 decision | 任意 | `not_produced` | 写 JudgeStageStatusReceipt 并暂停；不是审计 FAIL |
| Remediated clean | finding closure 全部闭合，remediation receipt 绑定 old/new bytes | current Judge=`coverage_satisfied` | 调用 EffectivePass gate；pass receipt 绑定最新 attempt 和 prior-attempt chain |
| Remediated not clean | finding closure 不完整，或 current Judge 非 `coverage_satisfied` | `findings_present|insufficient_evidence|blocked` | `blocked`；不启动第二个 remediation batch，不重跑 Reviewer |

### 语义调用预算

| 路径 | 文档到 closeout 的语义调用 | Judge provider 调用 | Native Reviewer 调用 |
|---|---:|---:|---:|
| Clean | 3 | 2 | 1 |
| 一次 remediation | 4 | 3 | 1 |

Clean 路径包括上游已完成的 Requirements Critical Auditor，以及本次 JudgeReviewCampaign 在同一个 blind wave 中并行完成的 Native Bounded Code Reviewer 与 Initial Final Acceptance Judge。文档到 closeout 共 3 次语义调用，closeout 内为 2 次调用、1 个等待波次；一次 remediation 只追加 1 次 current-byte Final Judge rejudge。

## 唯一执行链

1. 当前 repair authority/dispatch receipt 必须唯一指定 `packageId`、package manifest path/hash、compile receipt immutable path/hash、validation HEAD/tree 和 attempt ID；Main Agent 只消费该唯一选择，不在多个 package 间自行裁量。Compile receipt 必须绑定同一 package/manifest/HEAD/attempt，任一不一致在 context freeze 前返回 `campaign_closeout_compile_binding_mismatch`。
2. Main Agent 只收集已完成的 child closure receipts，以及本合同当前已有的 final-validation/collection evidence bindings。Closeout 不执行 compile、final validation、15 条 collection commands、nightly 或 full CI；缺失或 stale evidence 返回上游，只刷新受影响证据后再开始新的 closeout attempt。
3. Main Agent 冻结 `CloseoutContext/v1`；context 必须包含 compile receipt binding、当前 dirty-worktree `raw-tracked-v1` materialization hash、允许修改路径集合和 source plan hash。同一 context 不允许重新选择 package/evidence；worktree 无需干净，但实现不得覆盖允许路径外的既有修改。
4. `close-completed-campaign` producer 验证全部 bindings，在 sibling draft 目录生成 `campaign-report.json`、`task-report-candidate.json` 和 `goal-campaign-closure-receipt.json`，并且仅在 producer 内调用一次既有 `audit-completed-campaign.js` 做发布前确定性校验。全部通过后 create-once rename 发布 attempt；`GoalCampaignClosureReceipt` 即唯一 closeout receipt，目标已存在返回 `campaign_closeout_target_exists`。
5. 冻结 `JudgeReviewCampaignInput/v2`，绑定 closure receipt、current implementation/evidence bytes 和 candidate bytes；JudgeReviewCampaign 作为唯一 owner，在同一个 blind wave 中并行运行 Native Reviewer 与 Initial Final Judge。
6. Campaign merger 按 FinalEffectivePass truth table 合并 receipts。Clean 结果调用 existing EffectivePass gate；provider 未就绪写 stage status receipt 并暂停；findings 进入一次 remediation batch。
7. Remediation 改变 bytes 时创建新的 `closeoutAttemptId` 并从步骤 1 重新冻结 current compile/evidence/context、重新运行 producer deterministic reclosure；新 attempt 通过 prior-attempt/remediation hashes 复用旧 Reviewer finding lineage，只运行一次 current-byte Final Judge rejudge。
8. Main Agent 单次 ingest producer 与 JudgeReviewCampaign outputs，只校验 receipt hashes、candidate schema/原始字节 hash、prior-attempt chain 和 `FinalAcceptanceEffectivePassReceipt/v1` binding；不重跑 `audit-completed-campaign.js`，不再次调用 Reviewer 或 Final Judge。
9. Main Agent 运行 `main-agent-delivery-closeout-gate.ts`；该 gate 消费当前 `main-agent:delivery-truth-gate` receipt，并校验 context、campaign report、TaskReport artifact、JudgeReviewCampaign aggregate、EffectivePass receipt 和 gate artifact hashes。PASS 后只发布 `awaiting_user_acceptance` 与确认页。
10. 用户提交 accept/reject intent；Main Agent current lease 下的 controlled ingest 执行前述互斥状态转换，任何非 accept 结果都不得写 `record_closed` 或改变 candidate bytes。
11. Main Agent 验证 `record_closed`、user acceptance receipt 及其 hashes 与最新 closeout attempt 一致，再原字节持久化 TaskReport，并生成 `status=done` completion receipt；否则只输出 `blocked`，candidate 留作 forensic evidence。
12. 后续 acceptance/release audit 只消费 completion receipt 的 hashes并回读原始 artifacts；provenance drift 写 forensic finding，不改变已经闭合的 delivery 状态，也不进入同步交付关键路径。

### T09 legacy evidence materialization

本小节只适用于当前既有 `MA-GS-T09` campaign 的一次性闭合，不新增通用 evidence framework、schema 或自动命令调度器。Main Agent controlled dispatch 必须在步骤 3 的 context freeze 前完成以下处理：

- 按 `.artifacts/ma-gs-v4-execution-campaign/package-0bf02cce/package-manifest.json` 的 `collectionVerificationCommands` 原始顺序，将既有 T08×4、T07×2 和 T09 aggregate/carry-forward receipts 投影为 15 个 immutable `collectionEvidence` bindings。固定来源是 `.artifacts/ma-gs-isolated-generated-surface-parity-receipt.json` 及 T08 carry-forward receipt、`.artifacts/ma-gs-t07-validation-receipt.json` 及其 command receipts、T09 aggregate attempt chain，以及 current T09-05/T09-08/cleanup receipts；failed aggregate 只提供 mapping provenance，不能替代其引用的 PASS receipts。每个 binding 必须绑定 command ID、manifest command-definition hash、evidence immutable path/document-byte hash、source attempt/head 和 PASS/carry-forward provenance；旧 `campaign-artifacts.json` 中空的 `collectionVerificationResults` 不得直接视为已满足。
- 当前 campaign 只允许 controlled dispatch 选择 `.artifacts/ma-gs-v4-execution-campaign/compile-receipt-0bf02cce.json` 及 manifest hash `sha256:575376b65fdfdeaae0973a8c8e20af9b0e1e668a34711a2d8e17acb744d1a30c`；选择 `.artifacts/ma-gs-v4-execution-campaign/package-eb81de6b` 或 manifest hash `sha256:50092f9ee3e699dfbf01594cb4d8f41a6bba5b7ef1e173ab125421bd0a6a0169` 必须返回 `campaign_closeout_compile_binding_mismatch`。
- closeout 实现完成后，在 repair dispatch 选择的 controlled validation materialization 中只刷新一次 `CMD-MA-GS-T09-05`，将新 receipt 绑定最终 implementation/package/runtime bytes；producer 不执行该命令。
- `CMD-MA-GS-T09-08` 仅当 Source Plan hash、partition manifest document hash 或 active pointer document-byte hash 任一变化时刷新；三者均未变化时复用当前 `0e5e654e` canonical receipt 及其 6 个 child release receipt hashes。
- `CMD-MA-GS-T09-09` 只读复用既有 cleanup receipt，禁止再次删除 worktree、junction 或其他路径。
- 其余 command bindings 由 changed-path impact、command-definition hash 和 source materialization binding 机械判定 freshness，只刷新实际 stale 项。缺失、歧义、跨 materialization 或无法证明 carry-forward 的 binding 返回 `campaign_closeout_evidence_mismatch`；不得由 closeout 自动退化为重跑全部 15 条命令。
- Materializer 只写入新 closeout attempt 的 context/evidence bindings，不修改既有 T07/T08/T09 receipts、旧 aggregate attempts 或旧 `campaign-artifacts.json`。

### 标准失败合同

| 条件 | 标准 issue code | 状态/退出 | Artifact 行为 |
|---|---|---|---|
| Context self-hash、expected hash 或 compile/package binding 不一致 | `campaign_closeout_context_mismatch` / `campaign_closeout_compile_binding_mismatch` | producer exit 1，`blocked` | 不发布 attempt；保留 sibling draft 供 forensic |
| Traversal、symlink escape、root mismatch | `campaign_closeout_path_escape` | producer exit 1，`blocked` | 不发布 attempt；不得读取 root 外正文 |
| Evidence/command/materialization hash 不一致 | `campaign_closeout_evidence_mismatch` | producer exit 1，`blocked` | 不发布 attempt |
| 发布目标已存在 | `campaign_closeout_target_exists` | producer exit 1，`blocked` | 不覆盖、不删除既有 attempt |
| Producer 内部 deterministic audit 失败 | `campaign_closeout_audit_failed` | producer exit 1，`blocked` | 不发布 attempt；保留 audit receipt/log |
| Provider 未配置/认证失败/暂时不可用/执行错误 | 对应 `JudgeStageStatusReceipt.executionStatus` | Main Agent 返回 resumable paused，不产生审计 decision | 保留 producer 和已完成 Judge receipts，不写 EffectivePass |
| Judge 有效 findings/blocked | `judge_review_campaign_findings` / `judge_review_campaign_blocked` | remediation-required 或 `blocked` | 不写 EffectivePass |
| Main Agent ingest provenance 不一致 | `main_agent_goal_task_report_provenance_mismatch` | `blocked` | candidate 只读保留，不写 final TaskReport |
| Confirmation reject/stale/error | `closeout_user_rejected` / `closeout_confirmation_stale` / `closeout_confirmation_ingest_failed` | blocked 或 awaiting-user-acceptance | 不写 `record_closed`，不改 candidate |

## Campaign TaskReport

在现有 campaign TaskReport 字段基础上新增：

- `closeoutAttemptId`
- `compileReceiptHash`
- `closeoutContextHash`
- `finalValidationEvidenceSetHash`
- `collectionVerificationSetHash`
- `validationMaterializationHash`
- `priorAttemptHash`（仅 remediation attempt；clean 为 `null`）

JudgeReviewCampaign aggregate、Reviewer/Final Judge lineage、remediation closure 和 `FinalAcceptanceEffectivePassReceipt/v1` hashes 不回写 candidate；它们只进入 delivery gate receipts、user-confirmation evidence 和最终 completion receipt，避免 campaign 评估 candidate 后形成自引用 hash。

Main Agent 必须验证：

- package manifest、campaign report、repair authority、closure set 和 final-validation hashes 与 compiler/aggregate audit 一致。
- `packageId`、compile receipt path/hash、manifest/HEAD/tree/attempt bindings 与 CloseoutContext 一致；Main Agent 不重新选择 package。
- collection/final-validation evidence set hashes 按 manifest/dispatch 顺序重算一致，materialization hash 与 context 一致。
- Producer closeout receipt、`GoalCampaignClosureReceipt` 和 campaign report hashes 一致；Main Agent 不重新执行 producer validator。
- Initial path 的两个 actor receipts 必须绑定同一 current blind input；remediated path 的旧 Reviewer receipt 只绑定 prior attempt，新 remediation receipt 必须桥接 old/new bytes，current Final Judge receipt 必须绑定最新 candidate/context。
- JudgeReviewCampaign aggregate、current Reviewer/Final Judge receipts、remediation linkage、`FinalAcceptanceEffectivePassReceipt/v1` 的 role、authority、candidate/context/current-byte bindings 和 hashes 一致；只有 truth table 允许时，Final Judge assessment verdict 才能为 `coverage_satisfied`。
- candidate 原始字节 SHA256 等于 handoff 的 `taskReportArtifactHash`，持久化 receipt 保持同一 hash。
- closeout acceptance request、`record_closed` user-confirmation receipt 和 acceptance/release receipts 与本次 context、campaign report、JudgeReviewCampaign、`FinalEffectivePass` 和 TaskReport artifact 完全一致。

任一 provenance/binding 不一致返回 `main_agent_goal_task_report_provenance_mismatch`，状态必须为 `blocked`。Provider 未配置或不可用使用 `JudgeStageStatusReceipt/v1` 的 execution status，审计决策保持 `not_produced`，不得误报为 provenance mismatch 或审计 FAIL。

### Schema 兼容策略

- `campaign-task-report-binding` 升为 `v3`，只由新 producer 写入；`v3` 要求本节新增字段。
- `JudgeReviewCampaignInput`、blind aggregate、campaign controller 和 trace 升为 `v2`，以 `actorBindingHash` 替代 `modelDiversityReceiptHash`；旧 `v1` campaign receipts 只读，不与 current `v2` receipts 混合。
- 旧 `requirements-contract-model-diversity-receipt/v1` 仅作为历史 forensic receipt；新 gateway-managed campaign 不生成、不消费它的模型名/模型族 diversity authority。
- 旧 attempts 保持原始 `v2` bytes，只读 auditor 按 artifact 自带 `schemaVersion` 选择 frozen `v2` 或 current `v3` validator；禁止把旧 artifact 就地升级为 `v3`。
- Main Agent closeout 只接受 current attempt 的 `v3` candidate；历史 `v2` 只能作为 prior-attempt/forensic evidence，不得成为新 completion receipt 的 final TaskReport。
- `GoalCampaignClosureReceipt/v1` 和 `JudgeStageStatusReceipt/v1` 是新增且互不替代的 schema；前者证明 producer closure，后者只证明 Judge 阶段执行/暂停状态。
- 现有 `FinalAcceptanceEffectivePassReceipt/v1` schema 保持原样；新增 campaign/prior-attempt binding 通过 final acceptance state/ledger 的 `authorityStateHash` 与 `ledgerHeadHash` 间接闭合，不给既有 `v1` 偷增字段。

## 删除的复杂度

- 不建设通用状态机、stale-lock recovery 或自动 resume；Provider pause 只使用本计划定义的 `JudgeStageStatusReceipt/v1` 和 Main Agent 显式 resume action。
- 不新增独立 `closeoutProof` schema；最终交付绑定写入既有 Main Agent completion receipt。
- 不新增 gateway routing receipt，不强制具体模型名、model alias 或 model-family diversity，不让缺失 Codex model event 阻断有效 Judge decision。
- 不让 Main Agent 重跑 `audit-completed-campaign.js` 或重复调用 Reviewer/Final Judge。
- 不在 closeout 内机械重跑 compile、final validation、15 条 collection commands、nightly 或 full regression。
- 不做全仓 EOL/hash migration；validation 使用 raw materialization hash，active pointer 明确使用 document bytes。
- 不修改、升级或复用 attempt-01/02/03。

## 测试与验证矩阵

- 新增 `tests/acceptance/goal-subcontract-execution-package-generator-closeout.test.ts`：覆盖 context schema/self-hash、compile/package binding、path escape、symlink/gitlink/type drift、producer 单次 audit、target-exists atomic publish 和 `GoalCampaignClosureReceipt/v1`。
- 扩展 `tests/acceptance/goal-subcontract-execution-package-generator-campaign-audit.test.ts`、`tests/acceptance/main-agent-goal-subcontract-controlled-integration-red.test.ts`：覆盖 v2/v3 schema dispatch、Main Agent receipt ingest、prior-attempt chain、gate 顺序、原字节持久化和 blocked failures。
- 扩展 `tests/acceptance/main-agent-native-goal-invoker.test.ts`、`tests/acceptance/main-agent-goal-subcontract-controlled-integration-red.test.ts`、`tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts`、`tests/acceptance/main-agent-native-goal-closeout-gate.test.ts` 和 `tests/acceptance/requirements-confirmation-ingest.test.ts`：覆盖唯一 writer、JudgeStageStatus pause/resume、confirmation accept/reject/stale/error、`record_closed` 和 completion receipt 绑定。
- 扩展 `tests/acceptance/requirements-contract-parent-goal-blind-review.test.ts`、`tests/acceptance/requirements-contract-judge-review-campaign.test.ts`、`tests/acceptance/requirements-contract-judge-review-campaign-integration.test.ts` 和 `tests/acceptance/requirements-contract-judge-final-integration-lineage.test.ts`：覆盖 actorBindingHash、无 model diversity authority、blind wave、truth table、clean 不 rejudge、remediation 只 rejudge Final Judge，以及 Main Agent 不重复语义调用。
- 扩展 `tests/acceptance/requirements-contract-final-acceptance-effective-pass-gate.test.ts`：覆盖唯一 `FinalAcceptanceEffectivePassReceipt/v1` writer、clean/pass 和 findings/blocked 拒绝。
- 扩展 `tests/acceptance/requirements-contract-codex-cli-judge-adapter.test.ts`：使用真实 Codex JSONL fixture 覆盖缺失/变化 model event 不阻塞；扩展 Main Agent closeout tests 覆盖 Provider 未配置、401/403、429/503、超时、无效响应的 `JudgeStageStatusReceipt/v1` 和显式 resume。回归 `requirements-contract-judge-invocation-receipt.test.ts`、`requirements-contract-judge-state-machine.test.ts` 和 `requirements-contract-judge-provider-registry.test.ts`，证明通用 Judge schema/state machine 未被扩展或绕过。
- 扩展 `tests/acceptance/goal-subcontract-execution-package-generator-installed-surface.test.ts`：将 `close-completed-campaign.js`、`campaign-closeout-context.schema.json`、`goal-campaign-closure-receipt.schema.json` 和 `main-agent-goal-judge-stage-status-receipt.schema.json` 纳入 consumer surface 白名单与最小 `--help`/schema 检查。
- 新增 `tests/acceptance/goal-subcontract-execution-package-generator-packaged-consumer.test.ts`：只对当前 worktree bytes 执行无 scripts 的临时 `npm pack`/install，确认 closeout producer/context/closure schema 进入 tarball 且安装后的 producer `--help` 可运行；不得复用 detached `HEAD` canonical tarball，不得扩展为通用 consumer install 矩阵。
- 扩展 Main Agent closeout/campaign audit tests：覆盖当前 T09 的 15 条 manifest-order evidence materialization、`package-0bf02cce` 唯一选择、空 `collectionVerificationResults` 不可直接通过、`CMD-MA-GS-T09-05` 单次刷新、`CMD-MA-GS-T09-08` hash-conditional reuse、`CMD-MA-GS-T09-09` no-run reuse，以及任一 unresolved/stale binding fail-closed；测试不得执行真实 15 条命令。
- 回归 `packages/bmad-speckit/tests/goal-contract-campaign-audit-child.test.js`、`tests/acceptance/main-agent-delivery-truth-gate.test.ts` 和 `tests/acceptance/accept-pack-bmad-speckit.test.ts`。`.specify` mirror automation 不属于本次 `_bmad` closeout surface，不纳入本轮门禁。

所有 `_bmad` 脚本和 schema 通过现有 pack/mirror 流程进入 consumer surface；禁止手工复制到 `packages/bmad-speckit/_bmad`。

验证只运行上述直接受影响的定向 suites、consumer install/mirror sync 和编码门禁；不把 nightly/full CI 或完整 15 条 collection commands 纳入本次 closeout 验收。

### Exact commands

1. `npx vitest run tests/acceptance/goal-subcontract-execution-package-generator-closeout.test.ts tests/acceptance/goal-subcontract-execution-package-generator-campaign-audit.test.ts tests/acceptance/main-agent-goal-subcontract-controlled-integration-red.test.ts tests/acceptance/main-agent-native-goal-invoker.test.ts tests/acceptance/main-agent-delivery-closeout-gate-record.test.ts tests/acceptance/main-agent-native-goal-closeout-gate.test.ts tests/acceptance/requirements-confirmation-ingest.test.ts tests/acceptance/requirements-contract-parent-goal-blind-review.test.ts tests/acceptance/requirements-contract-judge-review-campaign.test.ts tests/acceptance/requirements-contract-judge-review-campaign-integration.test.ts tests/acceptance/requirements-contract-judge-final-integration-lineage.test.ts tests/acceptance/requirements-contract-final-acceptance-effective-pass-gate.test.ts tests/acceptance/requirements-contract-codex-cli-judge-adapter.test.ts tests/acceptance/requirements-contract-judge-invocation-receipt.test.ts tests/acceptance/requirements-contract-judge-state-machine.test.ts tests/acceptance/requirements-contract-judge-provider-registry.test.ts tests/acceptance/goal-subcontract-execution-package-generator-installed-surface.test.ts tests/acceptance/main-agent-delivery-truth-gate.test.ts tests/acceptance/main-agent-closeout-e2e.test.ts tests/acceptance/main-agent-closeout-source-authority.test.ts` -> exit 0; all listed tests PASS.
2. `node --test packages/bmad-speckit/tests/goal-contract-campaign-audit-child.test.js` -> exit 0.
3. `npm run build:main-agent-dist --prefix packages/bmad-speckit` -> exit 0; generated surface hashes match the build receipt.
4. `npx vitest run tests/acceptance/goal-subcontract-execution-package-generator-packaged-consumer.test.ts` -> exit 0; current worktree tarball contains the producer and schemas, and installed producer `--help` remains runnable.
5. `npm run test:speckit-mirror-sync` -> exit 0; no manual `_bmad` copy is introduced.
6. `node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js` -> `findings=0`.

The closeout test suite must also assert the negative matrix: producer never calls a second audit; Main Agent never invokes Reviewer/Final Judge; missing Provider yields `not_produced`; model identity absence/change is non-blocking; old attempts are not overwritten; only the latest accepted attempt can create `done`.

## 完成标准

- 一个 producer、一个由 repair authority/compile receipt 唯一指定的 package，以及与每个 closeout attempt materialization 绑定的完整有序 final-validation/collection evidence sets；closeout 本身不重新执行这些 commands。
- Clean path 只有一个 attempt；remediation path 每次 governed-byte 变化创建一个新 attempt，旧 attempt immutable，最终 completion receipt 绑定 latest attempt 和完整 prior-attempt chain。
- 每个 attempt 只有一个 campaign TaskReport candidate；一次 JudgeReviewCampaign 按 truth table 调用 existing EffectivePass gate，Main Agent 单次 ingest、delivery closeout gate 和用户确认后只持久化 latest candidate 相同字节。
- 当前 T09 的 15 个 collection bindings 已按 manifest 顺序 materialize；只刷新最终 bytes 影响的 commands，`CMD-MA-GS-T09-05` 恰好一次、`CMD-MA-GS-T09-08` 仅在 authority hashes 变化时、`CMD-MA-GS-T09-09` 永不重跑，且不存在 unresolved/stale binding。
- Gateway 可以自由切换 Judge 模型；具体模型名缺失或变化不阻塞。Provider 未就绪时保持 `not_produced` 并暂停当前 Judge 阶段，只有有效 Judge FAIL 才进入 remediation。
- confirmation accept 只有在 Main Agent current lease 下才能写 `record_closed`；reject/stale/error 均不得写 final TaskReport。
- completion receipt 闭合 compile receipt、context、GoalCampaignClosureReceipt、campaign report、JudgeReviewCampaign、`FinalAcceptanceEffectivePassReceipt/v1`、`record_closed` user-confirmation 和 TaskReport hashes 后，外部状态才为 `done`；done 后 audit 只读且不撤销 delivery。
- 旧 attempts 不修改；聚焦测试、consumer install/mirror sync 和编码门禁全部通过。
