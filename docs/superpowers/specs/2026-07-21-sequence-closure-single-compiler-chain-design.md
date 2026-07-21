# Sequence Closure 单一编译链设计

## 目标

将 requirement-critical、外部可观察的业务交互编译为唯一、可执行、可验证、可审计的 Sequence Closure，并与现有四件套 Compiler 形成一条生产编译链：

```text
Confirmed Source PRD + Decision Receipts
→ Canonical Semantic IR
→ Sequence Closure Compile Stage
→ Active RequirementRecord Revision
→ Canonical Compiler Input
→ Four-Artifact Dispatch Compiler
→ Native Goal Execution
→ Observed Sequence
→ Execution Closure / Audit / Delivery
```

本设计直接 Hard Cut，不引入 runtime shadow、双写、双权威或旧链路 fallback。

## 语义边界

Sequence Contract 只纳入 requirement-critical 且外部可观察的交互。删除、跳过、逆序、重复、重定向或篡改该交互会导致需求不成立。

纳入范围包括：

- API 请求和响应。
- 领域 command、query 和业务决策。
- 跨组件、跨服务和外部系统调用。
- 持久化读写、事件发布和消费。
- 授权、安全、幂等、重试和补偿。
- 业务状态变化和用户可见结果。

普通 helper、局部变量、DTO 转换、内部循环、非行为日志和私有算法细节默认不进入 Sequence Contract。

## 单一编译链

### Sequence Closure Compile Stage

该阶段是 Production Semantic Pipeline 的内部阶段，不是新的用户命令或平级 Compiler。它从 Canonical Semantic IR 和已授权 interaction roots 产生：

- Canonical Sequence Contract。
- Diagram Applicability。
- Diagram Sets 与 Mermaid projections。
- Sequence Step Trace Matrix。
- critical Sequence path full-path joins。
- Implementation Task DAG。
- RED、Oracle 和 Observed Sequence Evidence Contract。
- 精确 invalidation index。
- validation receipts 与 artifact hashes。

所有产物必须绑定同一个 `sourceAuthorityHash`、`semanticModelHash` 和 `sequenceContractHash`。

### Four-Artifact Dispatch Compiler

现有四件套 Compiler 保持唯一执行包生成器：

- `model_packet.json`：机器可读执行权威。
- `human_prompt.txt`：Host-facing 投影。
- `goal_execution.md`：native `/goal` 入口投影。
- `audit_receipt.json`：生成器自审，不是交付证据。

四件套 Compiler 不得创建、补全或修改 Sequence 语义。它只能读取 active confirmed RequirementRecord 中冻结的 Sequence Closure。

## 权威模型

- Source PRD 是原始需求权威。
- Canonical Semantic IR 是规范语义权威。
- Sequence Contract 是业务参与者、步骤、分支、顺序、时序和状态变化的确定性投影。
- Trace、Diagram、Task DAG 和 Evidence Contract 不拥有需求语义权威。
- `model_packet.json` 是执行权威，但不得引入上游未授权语义。
- Mermaid、Human Prompt 和 Goal Document 仅拥有展示或入口职责。

## Canonical Compiler Input 扩展

`CanonicalPreCheckpointCompilerInput` 必须保留现有 requirement、boundary、command 和 target bindings，并增加强制 `sequenceExecution`：

```ts
interface SequenceExecutionProjection {
  sequenceContractRef: string;
  sequenceContractHash: string;
  scenarioRefs: string[];
  criticalStepRefs: string[];
  branchRefs: string[];
  stateTransitionRefs: string[];
  stepTraceRef: string;
  stepTraceHash: string;
  criticalPathRefs: string[];
  taskDagRef: string;
  taskDagHash: string;
  evidenceContractRef: string;
  evidenceContractHash: string;
}
```

该投影必须通过 shared `ContractExecutionManifest` builder 进入 `model_packet.json`，不得新增第二套 Execution Manifest。

## 生产接线

唯一生产入口是：

```text
main-agent-orchestration
→ runRequirementsContractProductionSemanticPipeline()
→ Sequence Closure Compile Stage
→ active RequirementRecord revision
```

Main Agent Orchestration 只能消费该入口返回的冻结产物。现有内联 Mermaid、`sequenceViews`、`traceRows` 和 `atomicImplementationTaskList` 独立拼装路径必须删除或降级为纯渲染器。

`main_agent_compile`、`req_trace_direct` 和 standalone `/goal` adoption 必须绑定同一个 confirmed RequirementRecord，读取同一个 active Sequence Closure，并调用同一个四件套 Compiler。

## 执行与回流

Native Goal 按 `model_packet.json` 中的 Sequence Task DAG 执行。TaskReport 和 Implementation Evidence 必须引用 Scenario、Step、Branch、Task、Oracle 和 Evidence Contract。

Main Agent ingest 后生成 Observed Sequence Receipt，并验证：

- missing、unexpected、duplicate 和 reordered Steps。
- wrong participant、target、branch 或 state transition。
- temporal、side-effect、idempotency、retry 和 compensation 违反。
- Evidence 是否来自允许的测试、API、数据库、事件或 tracing observation。
- Sequence Contract、Task DAG 和当前 attempt hash 是否一致。

Observed Sequence 未通过时，不得进入 Execution Closure PASS。

## Audit 与六模型衔接

Judge Audit Unit Projector 必须消费 Sequence Contract、Step Trace、critical path joins、Task DAG、Observed Sequence refs、proof 和 applicability。

Audit Triad 与 Reverse Audit 不重新推导 Sequence；它们只审查冻结合同、当前 attempt evidence 和结构化 findings。有效 Critical finding 必须阻断 Audit Review 和 Delivery Confirmation。

## Fail-Closed 规则

以下任一情况必须阻断确认、dispatch 或 closure：

- requirement-critical Step 缺少 Requirement、Participant、Target、Trace、Task、RED、Oracle、Command 或 Evidence binding。
- interaction field unresolved，或需要虚构 Participant、Message、Branch 或 state transition。
- Sequence Contract hash 与任一派生产物不一致。
- Diagram Set 缺少 blocking child coverage。
- full-path join 缺失、额外、重排、悬空或 edge-type 不兼容。
- Task DAG 有环、未知依赖或未覆盖 critical Step。
- 四件套 Compiler 无法读取 active Sequence Closure。
- Observed Sequence 缺失、失配、过期、跨 attempt 或仅由日志和实现声明证明。

Unresolved interaction 必须返回 Resolver / Grill / Decision Receipt，不允许 renderer fallback。

## Hash 链

```text
sourceAuthorityHash
→ semanticModelHash
→ sequenceContractHash
→ sequenceClosureBundleHash
→ implementationConfirmationHash
→ contractExecutionManifestHash
→ modelPacketHash
→ taskReportHash
→ observedSequenceReceiptHash
→ auditDecisionHash
```

任一 hash mismatch 必须 fail closed。

## 验证策略

实现采用 TDD，但不建立第二套生产系统。最低验证矩阵包括：

- Canonical IR 到 Sequence Contract 的 deterministic golden cases。
- requirement-critical Step 准入与非关键内部调用排除。
- Participants、Branches、ordering、temporal、state transition 和 ownership partitions。
- Diagram Set 分解、blocking child coverage 和 Mermaid hash parity。
- Step Trace、critical path joins 和 Compact Trace parity。
- Task DAG dependency、cycle 和 unknown dependency rejection。
- 三个入口的 active RequirementRecord 与 Sequence Closure parity。
- 四件套中 `sequenceExecution` 的完整性和 projection-only 约束。
- Observed Sequence 的缺失、逆序、重复、错误分支、补偿和跨 attempt mutation。
- Execution Closure、Judge、Audit Triad、Reverse Audit 和 Delivery Confirmation 阻断。

## 非目标

- 不实现通用加权 requirement graph critical path。
- 不保留旧 Sequence 生成路径。
- 不创建新的用户可见 Compiler 命令。
- 不让 Mermaid 或四件套 Compiler 成为需求语义来源。
- 不将普通内部调用扩张为业务时序。

## 完成标准

- Production Semantic Pipeline 原子发布完整 Sequence Closure。
- Main Agent 不再独立拼装 Sequence、Diagram、Trace 或 Task DAG。
- 四件套 Compiler 从 active confirmed RequirementRecord 读取并绑定 Sequence Closure。
- 三个入口复用同一 Sequence Contract 和四件套 Compiler。
- Native Goal 回流产生当前 attempt 的 Observed Sequence Receipt。
- Execution Closure、Audit 和 Delivery 对 Sequence 失配全部 fail closed。
- 生产环境不存在 shadow、双写、旧 fallback 或第二执行权威。
