# Normalized Requirements Contract Package 设计

日期：2026-07-12

状态：已批准设计，等待实施计划

## 1. 背景与目标

当前 Requirements Contract 的方向是通过 MUST、Trace、Target、Task、RED、Oracle、Acceptance 和 Evidence 建立完整交付闭环。这个目标正确，但现有实现采用了大量按值复制：

- 同一 MUST 责任说明被写入多个 Target、Command、Task、Trace 和 View。
- 同一 Trace 关联被多个对象重复展开。
- `currentTargetMap` 同时承载现状、目标、差异、流程、路径、工件和治理信息。
- `implementationConfirmation` 从确认清单演变为大型重复数据仓库。
- 字段数量和文本重复被误当作防止模型编造的手段。

真实消费项目已经证明这种结构不可持续。一个包含 83 个 MUST、98 个 Trace、326 个 Atomic Task 和 63 个 Target Path 的需求契约，其确认块可以达到约 12.5 万行。膨胀主要来自多个对象之间的交叉复制，而不是 Source PRD 的业务内容本身。

更重要的是，重复文本不能证明：

- Requirement 引用真实存在。
- Target 是唯一且真实的 ownership。
- RED 在正确 baseline 上达到目标断言。
- Evidence 来自当前 commit 和当前 attempt。
- Oracle 能检测语义反转、顺序错误或副作用遗漏。
- Trace 不是 all-to-all 或模板化填充。

本设计将 Requirements Contract 重构为 Normalized Contract Package：

> Source PRD 中永久保留完整 Compact Trace Matrix 和冻结验收根清单；每个语义节点的详细正文只在 Canonical Requirement Record Bundle 中定义一次；所有生产消费者通过统一 Facade 读取；实际验收依赖独立运行证据和确定性门禁。

### 1.1 设计目标

1. 保持 Trace Matrix 完整、准确且可双向追溯。
2. 保持 Prompt Generation、RED、Audit 和 Acceptance Gate 的现有语义能力。
3. 消除 MUST、Trace、Target、Task 和 Evidence 之间的重复正文复制。
4. 将 `currentTargetMap` 拆为用户可理解的业务差异视图和实施影响视图。
5. 用 provenance、hash、receipt 和独立执行事实替代“重复字段防伪”。
6. 建立 V1/V2 兼容读取边界，防止结构整改导致功能回退。
7. 将序列化复杂度从交叉乘积降为 `O(nodes + edges)`。

### 1.2 非目标

本设计不做以下事情：

- 不删除或弱化 Trace Matrix。
- 不允许 Source PRD 脱离 Requirement Record Bundle 后完成完整验收。
- 不把运行 Evidence 提前伪装成需求确认阶段的事实。
- 不让 LLM Judge 获得独立 PASS 权限。
- 不要求立即重写已有历史 Source PRD。
- 不通过 YAML anchor 继续维持共享对象复制模型。
- 不以缩小文件为理由降低 Prompt、Audit、RED 或 Gate 覆盖。

### 1.3 核心原则

#### 语义只定义一次

Requirement、Scenario、Sequence Step、Target、Task、RED、Oracle、Acceptance 和 Evidence Requirement 各自拥有唯一 canonical node。其他工件只保存稳定引用和必要摘要。

#### Trace 边必须完整保留

去掉的是重复正文，不是追溯关系。`implementationConfirmation.traceMatrix.rows` 永久保存完整 Trace edge。

#### 模型输出默认不可信

模型可以提出 Candidate，但不能通过填满字段自动获得 authority。所有自动升级都需要可验证的 source、rule、repository、policy 或 user decision proof。

#### 运行事实与需求权威分离

Source PRD 冻结需求和验收承诺；Closeout Evidence 记录当前 candidate 的执行事实。运行证据不得反向污染需求权威。

#### 所有生产读取经过统一边界

Prompt Generator、Renderer、RED Generator、Auditor 和 Gate 不得直接读取具体 YAML 字段，必须调用 `RequirementsContractReadFacade`。

## 2. 总体架构

```text
Source PRD
  ├── Authorized Requirement Semantics
  ├── Compact Trace Matrix
  └── Frozen Artifact Hash Manifest
              │
              ▼
Canonical Requirement Record Bundle
  ├── Semantic IR
  ├── Trace Graph
  ├── Target Bindings
  ├── Oracle Registry
  ├── Acceptance Contracts
  ├── Evidence Requirements
  ├── Business Behavior Delta
  └── Implementation Impact Map
              │
              ▼
RequirementsContractReadFacade
  ├── V1 Legacy Adapter
  └── V2 Canonical Graph Adapter
              │
              ├── Confirmation Renderer
              ├── Prompt Generator
              ├── RED Generator
              ├── Evidence Planner
              ├── Post-implementation Auditor
              └── Deterministic Acceptance Gate
              │
              ▼
Current-attempt Closeout Evidence
```

完整验收单位是：

```text
Source PRD
+ hash-bound Requirement Record Bundle
+ current-attempt Closeout Evidence
```

Source PRD 可以独立查看业务需求、完整 Compact Trace Matrix、验收清单和工件摘要，但没有绑定的 Requirement Record Bundle 和当前 attempt Evidence 时，不得声称完成了完整验收。

## 3. 权威边界与规范化数据模型

### 3.1 Source Authority

Source PRD 负责保存：

- 用户授权的业务需求。
- Source span 和稳定 Requirement ID。
- 用户 Decision Receipt 的引用。
- Requirement Semantic Freeze hash。
- 完整 Compact Trace Matrix。
- Canonical Bundle 的 artifact refs 和 hash。
- Confirmation-ready Gate 的冻结结果。

Source PRD 不负责保存：

- 重复的 MUST 全文副本。
- 每个 Target 下展开的全部 `perMustResponsibilities`。
- 每个 Command 下展开的全部 `perMustAssertions`。
- 实施后的命令运行正文。
- 当前 attempt 的实际 Evidence。
- Judge 的自由文本作为行为证据。

### 3.2 Canonical Requirement Record Bundle

建议的 Requirement Record 结构：

```text
_bmad-output/runtime/requirement-records/{requirementSetId}/
├── requirement-record.json
├── authoring/
│   ├── semantic-ir.json
│   ├── trace-graph.json
│   ├── target-bindings.json
│   ├── task-graph.json
│   ├── red-contracts.json
│   ├── oracle-registry.json
│   ├── acceptance-contracts.json
│   ├── evidence-requirements.json
│   ├── business-behavior-delta.json
│   └── implementation-impact-map.json
├── confirmation/
│   ├── confirmation-manifest.json
│   └── render-projection.json
└── evidence/
    └── attempts/
        └── {attemptId}/
```

每个 canonical node 具有：

```yaml
id: TARGET-ORDER-REPOSITORY
schemaVersion: target-binding/v2
semanticModelHash: sha256:...
authorityClass: repository_derived
proofRefs:
  - REPOPROOF-ORDER-OWNER-001
nodeHash: sha256:...
```

关系边单独定义，不复制节点正文：

```yaml
edge:
  edgeId: EDGE-TRACE-MSG-003-TARGET
  type: trace_targets
  fromRef: TRACE-MSG-003
  toRef: TARGET-ORDER-REPOSITORY
  proofRefs:
    - RESOLUTION-ORDER-TARGET-001
  edgeHash: sha256:...
```

### 3.3 Authority Model

允许进入冻结执行契约的 authority：

| Authority class | 证明来源 | 是否可冻结 |
|---|---|---|
| `source_extracted` | Source span/hash | 可以 |
| `rule_derived` | Allowlisted deterministic rule | 可以 |
| `repository_derived` | 唯一 ownership、symbol 或 call graph proof | 可以 |
| `policy_inherited` | 已批准策略及 applicability proof | 可以 |
| `user_decision` | Immutable Decision Receipt | 可以 |
| `model_hypothesis` | 仅模型判断 | 不可以 |
| `business_decision_required` | 需要用户业务选择 | 不可以 |

模型置信度只允许排序候选，不能授权语义。

### 3.4 Compact Trace Matrix

`implementationConfirmation` 永久保留完整 Compact Trace Matrix：

```yaml
implementationConfirmation:
  schemaVersion: implementation-confirmation/v2
  requirementSetId: REQ-ORDER-CANCEL-001
  semanticModelHash: sha256:...
  traceGraphHash: sha256:...
  acceptanceManifestHash: sha256:...

  artifactRefs:
    requirementRecord: _bmad-output/runtime/requirement-records/REQ-ORDER-CANCEL-001/requirement-record.json
    traceGraph: authoring/trace-graph.json
    targetBindings: authoring/target-bindings.json
    taskGraph: authoring/task-graph.json
    redContracts: authoring/red-contracts.json
    oracleRegistry: authoring/oracle-registry.json
    acceptanceContracts: authoring/acceptance-contracts.json
    evidenceRequirements: authoring/evidence-requirements.json

  traceMatrix:
    rowCount: 98
    rows:
      - traceId: TRACE-MSG-003
        requirementRef: MUST-FR-007
        scenarioRef: SCN-ORDER-CANCEL-001
        sequenceStepRef: MSG-003
        branchRefs: [BR-001, BR-002]
        targetRef: TARGET-ORDER-REPOSITORY
        taskRef: TASK-MSG-003
        redRef: RED-MSG-003
        oracleRef: ORC-MSG-003
        commandRef: CMD-ORDER-CANCEL
        acceptanceRef: ACC-MSG-003
        evidenceRequirementRef: EVDREQ-MSG-003
```

每行 Trace 必须能够解析到唯一 canonical node。详细正文只定义一次，但 Trace edge 不得省略。

### 3.5 Trace 完整性约束

每条关键 Trace Row 必须绑定：

- 一个已授权 Requirement。
- 一个业务 Scenario 或 Sequence Step。
- 一个真实 Target Binding。
- 一个可执行 Task。
- 一个冻结 RED Contract。
- 一个独立 Oracle。
- 一个 Acceptance Contract。
- 一个 Evidence Requirement。

不适用字段必须显式声明 applicability，不能通过空值或省略规避。

禁止：

- 所有 Requirement 绑定所有 Target。
- 所有 Trace 绑定同一个共享 Acceptance。
- 多个 Trace 复制相同语义模板，仅替换 ID。
- 仅因为 ID 在 Mermaid 或文本中出现就判定覆盖。
- 用最终接口成功替代关键中间步骤的 Oracle。

### 3.6 Confirmation 与 Closeout 分离

Confirmation 证明：

- 需求已明确。
- Authority 合法。
- Trace 完整。
- Target、RED、Oracle 和 Acceptance 已定义。
- 用户需要决定的问题已关闭。

Closeout 证明：

- Candidate commit 已由受控执行器运行。
- 当前 attempt Evidence 满足冻结 Oracle。
- 没有 stale、replay、missing 或 unexpected behavior。

Closeout 生成独立记录：

```yaml
closeoutRecord:
  requirementSetId: REQ-ORDER-CANCEL-001
  sourcePrdHash: sha256:...
  semanticModelHash: sha256:...
  traceGraphHash: sha256:...
  candidateCommit: abc123
  attemptId: ATTEMPT-007
  evidenceBundleHash: sha256:...
  deterministicGateDecisionHash: sha256:...
```

实际 Evidence 不得回写为 Source PRD 的需求 authority。

## 4. 确认页双视图

现有 `currentTargetMap` 不再作为大型聚合容器。它拆分为：

```text
businessBehaviorDelta
implementationImpactMap
```

### 4.1 `businessBehaviorDelta`

该视图面向业务用户，按用户场景或业务流程组织，而不是按 MUST 列表组织。

```yaml
businessBehaviorDelta:
  schemaVersion: business-behavior-delta/v2
  scenarios:
    - scenarioRef: SCN-ORDER-CANCEL-001
      actorRef: ACTOR-CUSTOMER
      trigger: customer_requests_cancellation

      currentBehavior:
        state: proven
        summary: shipped 和 unshipped 订单均不可主动取消
        authorityClass: repository_derived
        proofRefs:
          - REPOPROOF-ORDER-CANCEL-001

      targetBehavior:
        summary: unshipped 订单允许取消，shipped 订单拒绝且无副作用
        authorityClass: source_extracted
        requirementRefs:
          - MUST-FR-007
          - NEG-002

      delta:
        type: behavior_change
        addedBehavior:
          - cancel_unshipped_order
        preservedBehavior:
          - reject_shipped_order
        forbiddenBehavior:
          - modify_shipped_order
          - publish_success_event_on_rejection

      userImpact:
        summary: 客户可在发货前取消订单

      unresolvedRefs: []
```

`currentBehavior` 只允许来自：

- Repository symbol、call graph 或 ownership proof。
- Detached baseline observation。
- 明确的 Source current-state section。
- 已批准的 Architecture Model。

`targetBehavior` 只允许来自：

- Requirement Semantic IR。
- User Decision Receipt。
- 已证明适用的 policy。

`delta` 必须由结构化 current/target 确定性计算。无法证明现状时必须显示：

```yaml
currentBehavior:
  state: unknown
  reasonCode: repository_observation_inconclusive
```

禁止让模型生成看似完整的现状长文。

### 4.2 `implementationImpactMap`

该视图面向实施模型和技术审计，展示真实 ownership、symbol/path、变化类型和证明状态。

```yaml
implementationImpactMap:
  schemaVersion: implementation-impact-map/v2
  impacts:
    - impactId: IMPACT-ORDER-SERVICE-001
      scenarioRefs:
        - SCN-ORDER-CANCEL-001
      sequenceStepRefs:
        - MSG-003
        - MSG-006

      owningComponentRef: COMPONENT-ORDER-SERVICE
      ownershipProofRef: REPOPROOF-ORDER-OWNER-001

      targets:
        - targetRef: TARGET-ORDER-SERVICE
          path: src/orders/order-service.ts
          symbolRef: OrderService.cancel
          changeType: modify_behavior
          proofState: repository_verified

      behaviorDeltaRefs:
        - SCN-ORDER-CANCEL-001

      traceRefs:
        - TRACE-MSG-003
        - TRACE-MSG-006
```

只允许展示：

- 真实 runtime component。
- 真实 source path 和 symbol。
- 真实 deployment node。
- 真实 external dependency。
- 明确的 change type。
- 可验证 ownership proof。

禁止展示：

- Source PRD 自身作为实施 Target。
- Evidence JSON 作为部署节点。
- Trace Matrix 作为业务组件。
- Renderer、Validator 或治理内部对象作为消费项目业务节点。
- 通用 `User/Agent/Record/Gate` 占位符。

### 4.3 确认页信息架构

消费项目确认页顺序：

1. 本次业务目标与范围。
2. 用户场景级当前行为。
3. 用户场景级目标行为。
4. 结构化 Behavior Delta。
5. Primary Business Sequence。
6. Failure/Compensation Sequence。
7. Implementation Impact Map。
8. Deployment Delta。
9. Compact Trace Coverage。
10. RED 与 Acceptance Plan。
11. Blocking/Unresolved。
12. 折叠的框架保障状态。

确认页默认展示：

```text
场景：客户取消未发货订单

当前：系统不支持主动取消
目标：未发货可取消，已发货拒绝
变化：新增取消能力，保留已发货保护
影响：OrderService.cancel、OrderRepository.updateStatus
证明：现状由仓库验证，目标由 MUST-FR-007 授权
```

Trace、Receipt、Oracle 和 Evidence Requirement 通过稳定 ID、状态和按需展开入口展示，不在首屏复制完整正文。

### 4.4 Projection 约束

Mermaid、HTML、Markdown 和 Prompt 都是 Canonical Graph 的派生投影，不得各自维护独立语义。

同一 Diagram ID 只能渲染一次。Requirement ID 不塞入业务箭头正文，而通过 Trace Matrix 或侧栏显示。

确认页必须清楚区分：

- `proven current`：现状有独立证明。
- `authorized target`：目标有合法 authority。
- `derived delta`：差异由 current/target 计算。
- `unresolved`：无法证明或需要用户决定。

硬门禁：

```yaml
syntheticCurrentBehaviorCount: 0
unauthorizedTargetBehaviorCount: 0
unprovenOwnershipCount: 0
currentTargetDeltaDriftCount: 0
businessViewGovernanceLeakCount: 0
implementationImpactWithoutTraceCount: 0
duplicateBusinessScenarioRenderCount: 0
```

### 4.5 对现有 `currentTargetMap` 的兼容

V1 Legacy Adapter 负责将历史 `currentTargetMap` 规范化为两个逻辑视图。它可以读取旧字段，但不得向新生产消费者暴露旧结构。

新文档不再生产：

- `currentTargetMap.process` 的治理聚合。
- `currentTargetMap.artifactPaths` 的重复展开。
- `currentTargetMap.canonicalArtifacts` 的业务视图混入。
- 多层 `perMustRows` 和 `perMustResponsibilities`。

兼容读取不代表继续生产旧结构。

## 5. Proof-Carrying 防伪与验收

重复写入 Requirement、Trace、Evidence、Acceptance 和 Target 不能阻止模型造假。防伪必须建立在可验证 proof 和独立运行事实上。

### 5.1 Candidate 与 Verified 分离

模型生成的任何对象初始状态都是：

```yaml
verificationState: candidate
```

只有通过确定性 Validator 或受控 Executor 后才能升级：

```yaml
verificationState: independently_verified
verificationReceiptRef: VERIFY-...
```

Receipt 不能自证。生成候选的模型不能同时作为最终 verification authority。

### 5.2 需求确认阶段

每条 Trace Edge 必须形成：

```text
Requirement source span/hash
→ Authorized Semantic Node
→ Scenario/Sequence Step
→ Compact Trace Row
→ Target ownership proof
→ Oracle specification
→ Acceptance Contract
→ Evidence Requirement
```

每个自动决议必须生成 Resolution Receipt：

```yaml
resolution:
  fieldRef: MUST-FR-007.targetBinding
  valueRef: TARGET-ORDER-SERVICE
  authorityClass: repository_derived
  premises:
    - artifact: src/orders/order-service.ts
      hash: sha256:...
    - artifact: docs/architecture.md
      sourceSpan:
        startLine: 42
        endLine: 48
      hash: sha256:...
  derivationRule: UNIQUE-BEHAVIOR-OWNER
  conflictingCandidates: []
  semanticModelHashBefore: sha256:...
  semanticModelHashAfter: sha256:...
  resolutionRunId: RES-...
  receiptHash: sha256:...
```

如果候选不能由 Source、Rule、Repository、Policy 或 User Decision 证明，必须保持 unresolved。

### 5.3 Qualified RED

正确顺序：

```text
Requirement Semantic Freeze
→ Sequence Semantic Freeze
→ Generate RED
→ Detached Baseline Run
→ Failure Attribution
→ Semantic Mutation Calibration
→ Freeze RED Hash
→ Implementation
```

RED 分类：

| 状态 | 含义 |
|---|---|
| `EXPECTED_RED` | Setup 成功，在目标 behavior assertion 处按预期失败 |
| `INVALID_RED` | 编译、fixture、环境或 setup 失败 |
| `ALREADY_GREEN` | 现有行为已满足，或测试没有命中目标 |
| `INCONCLUSIVE_RED` | 无法证明失败来自该 Requirement |

只有 `EXPECTED_RED` 可以授权正常 TDD 实施。

RED Receipt 必须绑定：

- Requirement ID。
- Sequence Step ID。
- Semantic model hash。
- Sequence contract hash。
- Test source hash。
- Baseline commit。
- Baseline run ID。
- Setup completion。
- Target behavior invocation。
- Failed Oracle。
- Assertion site。
- Expected 和 observed value。

实施开始后修改冻结测试，原 RED Receipt 必须失效，并回到原 baseline 重新证明。

### 5.4 实施后 Evidence

实际 Evidence 不允许在确认阶段预填。实施完成后由 Controlled Executor 在 detached candidate snapshot 上产生：

```yaml
evidenceReceipt:
  evidenceRef: EVD-MSG-003
  evidenceRequirementRef: EVDREQ-MSG-003
  requirementSetId: REQ-ORDER-CANCEL-001
  candidateCommit: abc123
  attemptId: ATTEMPT-007
  semanticModelHash: sha256:...
  sequenceContractHash: sha256:...
  testSourceHash: sha256:...
  commandRunId: RUN-ORDER-CANCEL-007
  observedValue:
    orderState: cancelled
  oracleResult: pass
  artifactHashes:
    - sha256:...
  executorIdentity: controlled-evidence-executor/v1
  receiptHash: sha256:...
```

Evidence 可来自：

- Test assertions。
- Database state observation。
- API observation。
- Event capture。
- Contract adapter。
- Detached rerun。
- 必要的 tracing span。

不能只依赖日志字符串、模型总结或实施方自报状态。

### 5.5 证据新鲜度与防重放

每个 Evidence Receipt 必须绑定：

- 当前 Source PRD hash。
- 当前 Semantic model hash。
- 当前 Trace graph hash。
- 当前 candidate commit。
- 当前 attempt ID。
- 当前 test source hash。
- 当前 executor run ID。

以下情况必须 BLOCK：

- Evidence 属于旧 commit。
- Evidence 属于旧 attempt。
- 测试源已经改变。
- Trace Graph 已经改变。
- Artifact hash 不匹配。
- Evidence Requirement 与 observed evidence 不一致。
- 只存在 Evidence 文本，没有 executor receipt。

### 5.6 Semantic Mutation

对关键 Step 和 Branch 至少覆盖适用的：

- Actor 改变。
- 否定反转。
- Threshold off-by-one。
- Precondition 缺失。
- Postcondition 未发生。
- 重复 side effect。
- 错误对象被修改。
- 顺序反转。
- Transport 成功但业务结果错误。
- 失败路径产生成功事件。
- 补偿未执行或重复执行。

Oracle 无法检测关键 mutation 时，不得认定独立验收充分。

### 5.7 Judge 权限边界

LLM Judge 可以：

- 审查需求、Trace、测试、diff 和运行证据是否语义充分。
- 请求 allowlisted challenge tests。
- 识别测试与 Requirement 的语义偏差。

LLM Judge 不可以：

- 执行命令。
- 修改候选实现。
- 验证 cryptographic hash。
- 覆盖确定性 blocker。
- 把自己的文本当作行为证据。
- 独立授予最终 PASS。

Judge 不可用时：

```text
judge_provider_unavailable
→ 保留确定性证据
→ 禁止 fallback-to-pass
→ closeout BLOCKED/INCONCLUSIVE
```

### 5.8 防伪硬门禁

```yaml
modelSelfAttestedEvidenceCount: 0
unverifiedAuthorityPromotionCount: 0
traceWithoutProofCount: 0
targetWithoutOwnershipProofCount: 0
staleEvidenceCount: 0
crossAttemptEvidenceCount: 0
evidenceWithoutExecutorReceiptCount: 0
oracleWithoutMutationCalibrationCount: 0
allToAllTraceBindingCount: 0
semanticTemplateCloneCount: 0
```

## 6. 统一读取 Facade 与兼容策略

结构变化不应扩散到每个生产模块。所有读取统一经过：

```text
RequirementsContractReadFacade
```

### 6.1 Facade API

建议提供稳定的语义 API：

```ts
interface RequirementsContractReadFacade {
  getRequirement(requirementRef: string): RequirementNode;
  getTraceMatrix(): CompactTraceMatrix;
  getTrace(traceRef: string): TraceEdgeSet;
  getScenario(scenarioRef: string): ScenarioNode;
  getSequenceStep(stepRef: string): SequenceStepNode;
  getTargetBinding(traceRef: string): TargetBinding;
  getAuthorizedBehavior(traceRef: string): AuthorizedBehavior;
  getTask(traceRef: string): ImplementationTask;
  getRedContract(traceRef: string): RedContract;
  getOracle(traceRef: string): OracleContract;
  getAcceptanceContract(traceRef: string): AcceptanceContract;
  getEvidenceRequirement(traceRef: string): EvidenceRequirement;
  getBusinessBehaviorDelta(): BusinessBehaviorDelta;
  getImplementationImpact(): ImplementationImpactMap;
}
```

生产消费者只依赖该逻辑 API，不依赖 V1 或 V2 的物理字段布局。

### 6.2 Adapter

Facade 后端包含：

```text
V1 Legacy Adapter
V2 Canonical Graph Adapter
```

V1 Adapter：

- 读取历史 `implementationConfirmation`。
- 识别旧 `currentTargetMap`、`perMustRows` 和重复映射。
- 规范化为唯一 node 和 edge。
- 检测重复对象之间的冲突。
- 不向生产消费者返回旧字段。

V2 Adapter：

- 读取 Compact Trace Matrix。
- 校验 artifact refs 和 hash。
- 加载 Canonical Requirement Record Bundle。
- 解析唯一 node 和 edge。
- 在任何缺失或不一致时 fail closed。

### 6.3 禁止直接读取

以下模式禁止出现在生产代码：

```text
confirmation.currentTargetMap.perMustRows
confirmation.targetModificationPaths[*].perMustResponsibilities
confirmation.requiredCommands[*].perMustAssertions
confirmation.atomicImplementationTaskList.*
```

生产消费者不得：

- 自己解析 Markdown/YAML。
- 自己维护 required headings。
- 自己维护 ID regex。
- 自己拼接 Requirement Record 路径。
- 自己实现 V1/V2 fallback。
- 在解析失败后调用模型补齐缺失语义。

### 6.4 Prompt Generation

Prompt Generator 通过 Trace Ref 请求完整上下文：

```text
Compact Trace Row
→ Facade resolution
→ Requirement source span
→ Scenario/Sequence Step
→ Authorized behavior
→ Forbidden behavior
→ Target ownership
→ Task dependencies
→ RED/Oracle/Acceptance
→ Evidence Requirement
→ Prompt Packet
```

每个 Prompt Packet 必须绑定：

- Requirement Set ID。
- Source PRD hash。
- Semantic model hash。
- Trace graph hash。
- Trace ID。
- Target binding hash。
- RED contract hash。
- Oracle hash。
- Prompt packet hash。

引用无法解析时必须 BLOCK，禁止生成部分可信 Prompt。

### 6.5 Prompt 与 Acceptance 同源

Prompt Generator 和 Acceptance Gate 必须读取同一个 canonical Trace Graph：

```text
同一 Requirement
+ 同一 Sequence Step
+ 同一 Target
+ 同一 Oracle
+ 同一 Acceptance
```

这防止：

- Prompt 要求 A，Gate 检查 B。
- Task 修改组件 X，Evidence 却观察组件 Y。
- RED 验证最终状态，Acceptance 却只验证 HTTP 状态码。
- Trace 更新后 Prompt 或 Gate 仍使用旧缓存。

### 6.6 失败行为

Facade 对以下情况统一返回 BLOCK：

```text
Artifact 缺失
hash 不匹配
schema 不兼容
Trace 引用悬空
Target ownership 无证明
V1 重复字段互相冲突
Prompt 上下文无法完整解析
Evidence 不属于当前 attempt
```

结构化错误示例：

```yaml
status: blocked
reasonCode: trace_graph_hash_mismatch
affectedTraceRefs:
  - TRACE-MSG-003
allowedFallback: none
```

Facade 不返回“尽可能多”的部分对象，因为部分可信数据会诱导模型继续实施错误需求。

## 7. 零功能回退兼容策略

这里的兼容不是迁移业务文档或用户数据，而是建立统一读取边界。

### 7.1 阶段 0：冻结基线

选择真实 Golden Corpus，保存：

- Source PRD hash。
- MUST、Trace、Target、Task、Command 和 Acceptance 数量。
- Prompt Packet。
- Confirmation Render。
- Reverse Audit 结果。
- Acceptance Gate 决策。
- 正向、负向和阻断场景。

比较对象是规范化语义和 edge set，不是 YAML 文本。

### 7.2 阶段 1：Shadow Graph

现有链路保持不变，同时旁路生成 V2 Canonical Graph。

这一阶段：

- 旧消费者仍通过 V1 Adapter 获得逻辑数据。
- V2 工件不影响生产 Prompt 或 Gate。
- 自动比较 V1/V2 Trace edge、Target、Oracle 和 Acceptance。
- 发现不一致时记录 parity failure。

### 7.3 阶段 2：统一 Facade 覆盖

将所有生产消费者改为调用 Facade。Consumer Registry 必须登记：

```yaml
consumer:
  id: prompt-generator
  readFacadeRef: requirements-contract-read-facade/v2
  directFieldReadAllowed: false
  parityReceiptRef: PARITY-PROMPT-GENERATOR-001
```

这不是逐 Consumer 的业务切换。所有消费者使用同一个稳定 API，V1/V2 选择集中在 Facade backend。

### 7.4 阶段 3：Dual Adapter Parity

对同一文档分别运行：

```text
V1 Legacy Adapter
V2 Canonical Graph Adapter
```

比较：

```yaml
mustCoverageParity: 1
traceEdgeParity: 1
targetBindingParity: 1
acceptanceSemanticParity: 1
promptPacketSemanticParity: 1
gateDecisionParity: 1
```

如果 V2 发现 V1 曾错误放行的缺陷，应记录为 `legacy_false_accept_detected`，不能为了表面 parity 弱化 V2。

### 7.5 阶段 4：停止生产旧重复结构

只有满足以下条件，新文档才停止生成旧结构：

```yaml
directConfirmationFieldReadCount: 0
unregisteredFacadeConsumerCount: 0
traceRowLossCount: 0
promptSemanticParityMismatchCount: 0
acceptanceGateWeakeningCount: 0
goldenCorpusRegressionCount: 0
installedSurfaceMismatchCount: 0
```

历史文档继续由 V1 Adapter 读取，不要求批量重写。

### 7.6 回退

回退只发生在 Facade backend：

```text
V2 Adapter operational failure
→ fail closed
→ 保留 failure receipt
→ 对已验证历史文档启用 V1 Adapter
```

不得：

- 重写已冻结 Source PRD。
- 静默切回旧语义。
- 对 V2 新文档启用 V1 猜测性 fallback。
- 将 V2 检出的 authority 问题按兼容问题放行。

### 7.7 兼容硬门禁

```yaml
directConfirmationFieldReadCount: 0
facadeBypassCount: 0
unregisteredFacadeConsumerCount: 0
v1V2TraceParityMismatchCount: 0
v1V2PromptSemanticMismatchCount: 0
v1V2GateDecisionMismatchCount: 0
partialResolutionFallbackCount: 0
```

## 8. 验证矩阵与完成门禁

本次整改以语义正确性和零功能回退为第一目标。文档缩小是规范化的结果，不是牺牲信息的理由。

### 8.1 Trace 完整性测试

必须验证：

- 每个适用 MUST 至少有一条有效 Trace。
- 每个关键 Sequence Step 有独立 Trace Row。
- 每条 Trace 引用唯一存在的 Requirement、Target、Task、RED、Oracle、Acceptance 和 Evidence Requirement。
- V1 Adapter 与 V2 Adapter 的 Trace edge set 一致。
- Compact Trace Matrix 与 Canonical Graph 双向投影一致。
- Trace Row 顺序变化不改变语义 hash。
- 删除任何 blocking edge 会触发 Gate。

### 8.2 Prompt 回归测试

对 Golden Corpus 同时运行：

```text
V1 Legacy Adapter → Prompt Packet A
V2 Graph Adapter  → Prompt Packet B
```

比较规范化语义：

- Authorized behavior。
- Forbidden behavior。
- Actor 和 trigger。
- Preconditions 和 postconditions。
- Target ownership。
- Sequence ordering。
- Task dependencies。
- RED 和 Oracle。
- Acceptance。
- Evidence Requirement。

格式可以不同，语义不得减少、交换或漂移。

### 8.3 Audit 与 Gate 回归

至少覆盖：

- 完整当前 attempt Evidence PASS。
- Trace 缺失 BLOCK。
- Target ownership 缺失 BLOCK。
- Artifact hash 被篡改 BLOCK。
- 旧 attempt Evidence 重放 BLOCK。
- 模型自报 Evidence BLOCK。
- Oracle 与 Requirement 不一致 BLOCK。
- V1/V2 Gate 决策不一致 BLOCK。
- Current behavior 无法证明时显示 unknown。
- Requirement Record Bundle 缺失时禁止完整验收。
- Judge provider 不可用时禁止 fallback-to-pass。

### 8.4 对抗性防伪测试

主动注入：

- 为所有 MUST 复制相同 Target。
- 为所有 Trace 复制同一个 Acceptance。
- Requirement 文本完整但引用不存在。
- 修改 Evidence 内容但保留旧 hash。
- 修改测试文件后复用旧 RED Receipt。
- 将旧 commit 运行结果绑定当前 attempt。
- 最终 API 成功但跳过关键中间状态。
- 反转业务分支。
- 打乱 Sequence 顺序。
- 失败路径发送成功事件。
- 重复执行 side effect。

所有场景必须被确定性 Gate 阻断。

### 8.5 确认页测试

确认页必须验证：

- 以 Scenario 为主轴，不以 MUST 列表为主轴。
- `businessBehaviorDelta` 只展示业务行为。
- `implementationImpactMap` 只展示真实实施影响。
- Current state 的每个 positive claim 有 proof。
- Target state 的每个 positive claim 有 authority。
- 无法证明时显示 unknown，不生成长文本。
- 消费项目不显示治理框架内部流程。
- 同一 Diagram ID 不重复渲染。
- Trace、Receipt 和 Evidence 默认折叠但可解析。

### 8.6 规模与性能

序列化复杂度必须是：

```text
O(nodes + edges)
```

禁止重新出现：

```text
O(MUST × Target × Task)
O(MUST × Trace × Command)
O(MUST × Acceptance × Evidence)
```

使用大型 Fixture 验证：

- 大型确认块写入不使用函数参数展开。
- Facade 查询随 node/edge 数量近似线性增长。
- Confirmation Render 不加载实际 Evidence 正文。
- 单 Trace 查询不反序列化全部历史 attempts。
- 多次 render 不产生重复 canonical node。
- 生成器不会因 `noRefs: true` 再次复制共享语义正文。

性能指标：

```yaml
duplicatedSemanticBodyCount: 0
crossProductProjectionCount: 0
traceRowLossCount: 0
promptSemanticRegressionCount: 0
gateDecisionWeakeningCount: 0
```

### 8.7 编码与大文件安全

所有 Markdown、YAML 和 JSON 生成必须：

- 使用显式 UTF-8。
- 使用 safe writer 或 atomic rename。
- 在替换现有大文件前创建并验证 backup。
- 在 promotion 前校验 required headings、ID、byte length 和 SHA256。
- 在 promotion 后回读并重新校验。
- 不使用 `splice(...largeArray)`、shell 重定向或 PowerShell `Out-File` 写大型正文。

### 8.8 用户体验完成标准

用户必须能够快速回答：

1. 当前业务行为是什么，证明状态如何？
2. 目标业务行为是什么？
3. 本次真正改变了什么？
4. 哪些真实 component、path 和 symbol 会受影响？
5. 哪些业务决策仍 unresolved？
6. Trace、RED 和 Acceptance 是否完整？

用户不应被迫阅读：

- 重复 MUST 责任说明。
- 重复 Trace 映射。
- 治理框架内部实现。
- 伪部署节点。
- 无 proof 的 current/target 长文。
- 预填的虚假 Evidence。

### 8.9 总体硬门禁

正确性：

```yaml
traceSemanticParity: 1
promptSemanticParity: 1
acceptanceGateParity: 1
criticalMustCoverage: 1
criticalSequenceStepCoverage: 1
criticalBranchTestCoverage: 1
```

结构：

```yaml
directConfirmationFieldReadCount: 0
facadeBypassCount: 0
unregisteredFacadeConsumerCount: 0
duplicatedSemanticBodyCount: 0
crossProductProjectionCount: 0
traceProjectionDriftCount: 0
```

Authority：

```yaml
syntheticCurrentBehaviorCount: 0
unauthorizedTargetBehaviorCount: 0
unverifiedAuthorityPromotionCount: 0
targetWithoutOwnershipProofCount: 0
```

Evidence：

```yaml
staleEvidenceFalseAcceptCount: 0
crossAttemptEvidenceFalseAcceptCount: 0
modelSelfAttestedEvidenceFalseAcceptCount: 0
evidenceWithoutExecutorReceiptCount: 0
```

兼容：

```yaml
v1V2TraceParityMismatchCount: 0
v1V2PromptSemanticMismatchCount: 0
acceptanceGateWeakeningCount: 0
goldenCorpusRegressionCount: 0
installedSurfaceMismatchCount: 0
```

效率指标只能在硬门禁通过后报告：

- Serialized confirmation bytes。
- 自动决议覆盖率和准确率。
- Prompt packet 生成时间。
- Facade 单 Trace 查询时间。
- 首次验收通过率。
- 决策后返工率。
- Token 和计算成本。

效率指标不得覆盖正确性 blocker。

## 9. 实施边界与建议顺序

后续实施计划应按以下依赖顺序拆分：

1. 定义 Canonical node、edge 和 Compact Trace Matrix schema。
2. 建立 Artifact Manifest 和 hash binding。
3. 实现 `RequirementsContractReadFacade` 接口。
4. 实现 V1 Legacy Adapter 并冻结现有语义。
5. 实现 V2 Canonical Graph Adapter。
6. 建立 Shadow Graph 和 V1/V2 parity harness。
7. 将生产读取点统一路由到 Facade。
8. 生成 `businessBehaviorDelta` 和 `implementationImpactMap`。
9. 从 Canonical Graph 生成 Compact `implementationConfirmation`。
10. 接入 Qualified RED、Controlled Evidence 和 Closeout Record。
11. 运行 Golden Corpus、adversarial 和规模测试。
12. 满足 hard-cut 门禁后停止生产旧重复结构。

共享 Schema、Validation Facade、Consumer Registry 和 Requirement Record 路径属于串行修改面，实施时不得由多个并行任务同时编辑。

## 10. 最终定义

最终交付不是一个更短的 YAML 模板，也不是删除 Trace 信息，而是：

> 以完整 Compact Trace Matrix 为 Source PRD 中的永久追溯清单，以 Canonical Requirement Record Bundle 为唯一语义正文，以 `RequirementsContractReadFacade` 为统一读取边界，以 Proof-Carrying Receipt、Qualified RED、独立运行 Evidence 和确定性 Gate 证明交付结果的 Normalized Requirements Contract Package。

它必须同时做到：

- Trace 完整。
- Prompt 不回退。
- Audit 不回退。
- Gate 不弱化。
- Current/Target 对用户有意义。
- 模型不能通过重复填充伪造可信度。
- 文档规模随 node 和 edge 线性增长。
