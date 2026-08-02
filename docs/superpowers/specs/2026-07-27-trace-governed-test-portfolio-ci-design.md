# Trace-Governed Test Portfolio and Fast CI Design

**Status:** Approved design; written-spec review pending
**Date:** 2026-07-27
**Scope:** Test Portfolio governance, physical test reduction, dynamic CI selection, parallel execution, and feature-closeout lifecycle
**Execution authority:** None; this document is not a Goal Execution Contract
**Predecessor:** `docs/superpowers/specs/2026-07-24-test-portfolio-audit-design.md`

## 1. Decision and Scope

本设计定义 Test Portfolio Audit 之后的产品目标态。Phase 1 Audit 负责发现、分类和生成证据；本设计负责把这些事实转化为受治理的测试组合、动态 CI 选择、物理删除流程和长期防膨胀机制。

最高目标不是把历史测试移出某个 CI Job，而是减少测试组合本身的规模和维护成本，同时保护六模型核心、RequirementRecord 权威链和最小产品生存边界。

### 1.1 Binding Product Decisions

以下决策已经确认：

- Runner 可执行测试总量硬预算为 `executableTestCount <= 480`。
- 永久核心测试硬预算为 `corePermanentCount <= 120`。
- PR CI 目标为 `P95 <= 10 minutes`。
- 重复、脆弱 fixture、自证、实现细节耦合和失效目标测试应物理删除，而不是永久转移到较慢 Profile。
- 少量仍有价值的边界测试可以保留为 `retained_on_demand`。
- 新增 Feature 或 Bug 测试必须在 Feature Closeout 时明确归宿，不使用固定天数过期。
- 动态选择采用 Trace-Governed Portfolio 和有界 fail-closed 扩展。
- 核心测试不得通过普通 Portfolio 精简流程删除。
- 非核心测试优先使用确定性快速路径；只有语义歧义候选才允许一次本地模型 Review。
- GitHub CI 不运行本地或远程模型，只消费受 Git 管理的 policy 和本地已生成的紧凑授权记录。
- 新 CI 采用 Direct Hard Cut，不保留生产 Shadow、双写、fallback 或第二套状态权威。

### 1.2 Goals

本设计必须实现：

- 为每个 Runner 可执行测试提供唯一、明确、可验证的生命周期状态。
- 让 changed paths、Trace、Capability、Package 和依赖图共同决定本轮 Test Selection。
- 让新增测试自动进入治理流程，而不是依赖逐文件手工配置。
- 让 Profile 名称和安全语义稳定受 Git 管理，同时动态生成 Catalog、Selection、Shard Plan 和 Job Matrix。
- 让 CI 在影响映射不完整时有界扩大，而不是静默漏测或回退执行全部历史测试。
- 让 Feature 关闭时同步收敛测试组合，防止每个功能永久增加一批测试。
- 让测试删除由确定性证据、必要时的一次本地 Review 和删除后验证共同授权。
- 让测试组合规模、核心规模和 PR 墙钟时间成为可执行门禁，而不是文档期望。

### 1.3 Non-Goals

本设计不负责：

- 修改六模型 Requirement Confirmation、Architecture Confirmation、Execution Closure 或 Delivery Confirmation 的状态权威。
- 用 Test Portfolio Review 替代产品交付 Judge、Audit 或 Reverse Audit。
- 在 GitHub Actions 中调用 LLM。
- 建立通用静态分析平台或通用 AI Review 平台。
- 保存完整模型对话、推理文本、测试源码副本或大型审计报告。
- 为每个测试维护一条长期手工配置记录。
- 通过跳过失败测试、降低 assertion、扩大 mock 或隐藏未知状态达到时间预算。
- 长期运行旧 CI 和新 CI 两条生产链路。

### 1.4 Relationship to Phase 1 Audit

`2026-07-24-test-portfolio-audit-design.md` 保持 `audit-only` 权威边界，不被本设计改写。它提供 Runner Discovery、route graph 和五维分类事实；本设计消费这些事实并增加生命周期状态、删除授权、Profile Selection、Sharding 和 CI Hard Cut。

Phase 1 的 candidate classification 不能直接删除测试。本设计定义的 Preflight、授权和 post-delete validation 完成后，候选才能转化为仓库修改。

### 1.5 Design Principles

- **Minimum sufficient governance:** 只保留完成物理精简和安全选择所需的最小权威数据。
- **Deterministic before probabilistic:** 能由 Runner、Git、Trace 或依赖图证明的事实不得浪费模型调用。
- **Core protection, non-core speed:** 核心测试默认不可删除，非核心测试默认走最快安全路径。
- **Physical reduction over scheduling illusion:** Test Profile 不能替代测试删除和合并。
- **One source of task truth:** Test Catalog 和 Selection 只由共享生成链产生，Profile 不拥有第二套测试清单。
- **Bounded fail-closed behavior:** 不确定时只扩大到所属 Feature 或 Package；仍不明确时阻断并要求补 binding。
- **No convergence theater:** Test Portfolio 删除不使用多轮 Judge、连续 no-gap 或无限 remediation。
- **Reversible batches:** 每个删除批次必须可独立验证和回滚。

## 2. Authoritative Portfolio State Model

每个 Runner-Resolved Executable Test 必须且只能属于一个 lifecycle state。分类维度仍可保留多值事实，但生命周期状态必须互斥，避免一个测试同时被视为永久核心、工作集和删除候选。

```text
core_permanent
feature_working_set
retained_on_demand
deletion_candidate
```

### 2.1 `core_permanent`

`core_permanent` 只保护六模型核心和 Product Survival Perimeter：

- 六模型状态机转换和稳定聚合投影。
- RequirementRecord 权威读写、状态连续性和关闭约束。
- Judge、Audit、Reverse Audit 和 delivery continuation 的最小产品行为。
- CLI 启动和关键命令入口。
- 消费项目安装和发布物最小一致性。
- 持久化、安全、编码完整性的最小 E2E。

核心状态必须来自 Test Portfolio Policy 中的显式 Capability binding，不能由文件名、目录名、release workflow 后代关系或测试耗时猜测。

普通 Portfolio reducer 必须拒绝删除、降级或批量移动 `core_permanent`。需要调整核心集合时，必须使用独立的 Core Test Change 流程，并证明 replacement、核心预算和受保护能力守恒。

### 2.2 `feature_working_set`

Feature 或 Bug 开发期间新增、修改或直接受影响的测试进入 `feature_working_set`。该状态允许 PR 开发过程中持续变化，但不得成为永久状态。

Feature Closeout 前，每个工作集测试必须选择一个 disposition：

```text
promote_to_core
merge_to_contract_test
retain_on_demand
delete_after_closeout
```

Disposition 不是第五种 lifecycle state。执行 disposition 后，测试必须转入现有四态之一或被物理删除。

### 2.3 `retained_on_demand`

`retained_on_demand` 保存仍有价值但不应永久占用 PR 核心预算的测试，例如：

- 高成本兼容性边界。
- 特定 Package 或平台边界。
- 低频故障回归。
- 周期性深度验证。
- 无法低成本合并但仍有独立 oracle 的测试。

该状态不意味着永不运行。Dynamic Selection、`nightly-deep`、`release-verify` 或显式维护命令可以选择它。

### 2.4 `deletion_candidate`

`deletion_candidate` 表示已经进入删除评估，但尚未获得物理删除授权。候选状态本身不能静默跳过测试，也不能冒充测试已经删除。

候选只能产生三类结果：

- 确定性快速路径批准并删除。
- 一次本地模型 Review 批准并删除。
- 证据不足或风险过高，返回 `retained_on_demand`。

### 2.5 Hard Invariants

以下门禁始终成立：

```text
unclassifiedTestCount = 0
unresolvedImpactBindingCount = 0
unclosedFeatureWorkingTestCount = 0
corePermanentCount <= 120
runnerResolvedExecutableTestCount <= 480
```

`runnerResolvedExecutableTestCount` 统计所有 Runner 实际可执行测试，包括 `retained_on_demand` 和尚未删除的 `deletion_candidate`。不得通过从 PR Profile 移除测试来降低该计数。

### 2.6 State Transition Rules

```text
new_or_modified_test
→ feature_working_set

feature_working_set + promote_to_core
→ core_permanent

feature_working_set + retain_on_demand
→ retained_on_demand

feature_working_set + merge_to_contract_test
→ replacement state + originals become deletion_candidate

feature_working_set + delete_after_closeout
→ deletion_candidate

deletion_candidate + approved deletion + post-delete PASS
→ physically removed

deletion_candidate + uncertain or rejected
→ retained_on_demand
```

任何状态转换必须更新 Canonical Test Catalog 的生成输入或 tracked policy，不允许只改 human summary。

## 3. Tracked Policy and Authority Boundaries

仓库只维护一个小型、受 Git 管理的 Test Portfolio Policy。它保存稳定规则，不保存完整生成式测试清单。

Policy 至少包含：

- Profile 名称和不可降级安全语义。
- 显式 protected Capability bindings。
- 核心状态的适用规则和预算。
- Directory rules 和有限 exceptions。
- 批准的 deterministic deletion reason codes。
- Profile escalation rules。
- 紧凑 deletion authorization entries。

### 3.1 Classification Precedence

分类优先级必须确定：

```text
explicit field exception
→ most-specific directory rule
→ generic directory rule
→ unclassified
```

相同 specificity 的规则产生冲突时必须 fail closed。Exception 只能覆盖显式字段，其他字段继承规则结果。已经可以由 directory rule 完整分类的冗余 exception 必须被拒绝。

### 3.2 Generated Facts Are Not Authority Duplication

Runner Discovery、Test Catalog、Selection、Shard Plan 和 Run Manifest 是当前仓库事实的确定性生成物。它们不创建第二套 lifecycle policy，也不能反向覆盖 tracked policy。

Human summary、TUI 或 Markdown 报告只是投影，不能拥有状态转换或删除权威。

### 3.3 Scope Separation

Test Portfolio authority 只决定测试生命周期和 CI 选择，不决定 RequirementRecord、Goal Contract、Execution Closure 或产品交付完成状态。产品级 Judge/Audit 的权威不因本设计而改变。

## 4. Dynamic Selection and Minimal Generated Artifacts

### 4.1 End-to-End Data Flow

```text
Filesystem Candidate Set
            ↕ reconciliation
Runner-Resolved Executable Set
            ↓
Canonical Test Catalog
            ↓
Git Diff + Trace/Capability Bindings + Dependency Graph
            ↓
Bounded Test Selection
            ↓
Historical Duration Data
            ↓
Shard Plan / Job Matrix
            ↓
Single Run Manifest
```

所有 Profile 必须复用这条共享生成链。Profile 只能定义选择规则和安全边界，不能维护独立测试清单。

### 4.2 Dual-Source Discovery

Discovery 必须同时获取：

- Filesystem Candidate Set：按 runner conventions、受管目录和已知配置识别潜在测试文件。
- Runner-Resolved Executable Set：由 Vitest、Node test、package scripts 或其他 configured runner 实际解析出的可执行 identity。

对账规则：

```text
runner-only without catalog identity
→ block

candidate-only without explicit exclusion reason
→ block

unknown runner or package test script
→ block

unexplainedRunnerOnlyCount = 0
unexplainedCandidateOnlyCount = 0
```

不能把 filesystem glob 当成 Runner Discovery，也不能只信 runner 结果而忽略不可达的测试候选。

### 4.3 Canonical Test Identity

每个测试 identity 至少绑定：

- `runnerId`
- repository-relative test path
- runner-resolved executable identity
- Package ownership
- Capability 和 Trace refs
- lifecycle state
- fixture ownership refs
- known duration summary

Identity 必须由稳定规范化规则生成，不依赖文件枚举顺序、JSON 对象遍历顺序或平台路径分隔符。

### 4.4 Trace-Governed Impact Selection

Selection 输入包括：

- baseline-to-HEAD changed paths
- staged 和 unstaged paths，适用于本地维护命令
- changed test identities
- Trace 和 Capability bindings
- Package ownership
- dependency graph
- provider、consumer、adapter 和 integration edges
- tracked Profile escalation rules

选择顺序：

```text
all core_permanent
+ all added or modified tests
+ exact affected Trace/Capability tests
+ dependent consumer and integration tests
+ applicable retained_on_demand tests
```

对 Feature/Bug 开发，当前 `feature_working_set` 必须加入受影响集合。任何新增测试在进入 policy 前都不能因为缺少历史绑定而被忽略。

### 4.5 Bounded Fail-Closed Expansion

映射不完整时采用固定扩展层级：

```text
exact Trace/Capability boundary
→ owning Feature boundary
→ owning Package boundary
→ block and require binding repair
```

禁止以下回退：

- 无条件执行全部历史测试。
- 根据文件名模糊匹配关键性。
- 静默忽略未知影响。
- 用 release workflow 广义后代关系把所有测试标记为 critical。
- 让 contributor 使用标签降低安全 Profile。

如果共享 contract、schema、状态机或 compiler 变化具有高扩散影响，Selection 必须通过 policy 自动升级为 `pr-full`，而不是构造无界 fallback。

### 4.6 Minimal Generated Artifacts

每次运行只生成四类临时产物：

1. **Test Catalog**：Runner identities、state、binding 和确定性分类结果。
2. **Selection**：本轮选中测试、选择 reason codes、扩展层级和 Profile。
3. **Shard Plan**：根据历史时长和当前 Selection 生成的有界工作分片。
4. **Run Manifest**：汇总输入 hash、Catalog hash、Selection hash、Shard Plan hash、执行结果和门禁计数。

这些产物默认写入 generated artifact 目录，不进入 Git。CI 只上传必要的 Run Manifest 和失败诊断，不上传完整测试源码或完整对象图。

### 4.7 No Receipt Proliferation

本设计不为每一步生成独立 schema、hash、receipt 或 Markdown 报告。只有跨运行需要验证的事实进入 Run Manifest。

Deletion authorization 是例外，但仍保持紧凑：

```json
{
  "batchHash": "sha256:...",
  "reviewMode": "deterministic",
  "verdict": "approve_delete",
  "reviewProfileVersion": "v1",
  "evidenceHash": "sha256:..."
}
```

`reviewMode` 允许 `deterministic`、`local_model` 或显式人工升级。授权记录不保存完整模型回答。

### 4.8 Duration-Governed Sharding

Shard Plan 必须使用真实历史 JUnit 或 runner timing 数据，并对未知时长测试提供确定性估计。目标是最小化最长 Lane，而不是平均分配文件数。

新测试或缺少时长的测试不得被忽略。未知项使用保守权重并在本次运行后更新历史数据。

Shard 生成必须满足：

- 相同输入产生相同计划。
- 单个测试 identity 只属于一个 shard。
- 所有 selected identities 完整覆盖。
- 无 selected identity 进入 Profile 外 Job。
- shard 数量和单 Lane work-unit 上限受 policy 约束。

### 4.9 Generated Artifact Validation

最终 Join 前必须验证：

```text
catalogIdentityDuplicateCount = 0
selectionOmissionCount = 0
selectionDuplicateCount = 0
unresolvedImpactBindingCount = 0
unclassifiedTestCount = 0
shardCoverageMismatchCount = 0
```

任何生成物不一致都必须阻断测试完成状态；不能依赖后续 Job 恰好执行成功掩盖 Selection 错误。

## 5. CI Profiles and Parallel DAG

Profile 名称、触发条件和安全语义必须静态受 Git 管理。Catalog、Selection、Shard Plan 和 Job Matrix 必须在运行时确定性生成。

### 5.1 `pr-fast`

`pr-fast` 是普通 PR 的默认 Profile，执行：

- 全部 `core_permanent`。
- 当前变更影响的 `feature_working_set`。
- 受影响的 `retained_on_demand`。
- 所有新增或修改测试。
- 必要的 Product Survival E2E。

目标为 `PR CI P95 <= 10 minutes`，但不得通过隐藏未知 binding 或跳过新增测试达到该目标。

### 5.2 `pr-full`

`pr-full` 包含 `pr-fast`，并扩展到受影响 Feature 或 Package 的完整测试边界。

以下变更必须自动升级：

- shared contract 或 shared types
- JSON Schema 或持久化格式
- 六模型状态机和 RequirementRecord authority
- Canonical Semantic IR、Trace Graph 或 compiler
- 公共 runtime adapter 或消费安装入口
- Dynamic Selection 无法安全停留在 exact boundary

`pr-full` 不是执行全部历史测试的别名。它仍受 Test Portfolio 和 bounded expansion 约束，并通过增加 shard 并行度满足 PR 墙钟目标。

### 5.3 `nightly-deep`

`nightly-deep` 用于：

- `retained_on_demand`
- 跨 Package 兼容性
- flake observation
- 高成本平台和边界验证
- 周期性深度测试

它不能重新执行已经批准物理删除的测试，也不能成为长期保留无效测试的垃圾场。

### 5.4 `release-verify`

`release-verify` 聚焦发布和消费边界：

- CLI startup
- package packing and install
- consumer runtime
- publish artifact consistency
- persistence and migration
- security and credential boundaries
- encoding integrity
- Judge/Audit/Reverse Audit 和 delivery continuation 的最小产品闭环

Release workflow membership 必须独立表达为 `releaseGateMembership`，不能自动把所有后代测试提升为 `core_permanent` 或 critical。

### 5.5 Parallel Execution DAG

```text
Catalog / Binding / Budget Gate
              ↓
Deterministic Profile Selection
              ↓
┌─────────────┬────────────────┬─────────────────┬──────────────────┐
│ Six-Model   │ Impacted       │ Product         │ Consumer /       │
│ Core Shards │ Feature Tests  │ Survival E2E    │ Install Gates    │
└─────────────┴────────────────┴─────────────────┴──────────────────┘
              ↓
Evidence Join
              ↓
Required CI Result
```

只有 Catalog、Selection 和 Profile Gate 是全局前置。测试 Lane 之间默认并行，只有真实依赖通过 DAG edge 表达。

### 5.6 Wall-Clock Budget

```text
Catalog + Selection       P95 <= 1 minute
Longest parallel lane     P95 <= 8 minutes
Evidence Join             P95 <= 1 minute
PR total wall clock       P95 <= 10 minutes
```

墙钟预算不能用所有 Job duration 求和。Sharding 优化目标是控制最长 Lane，并限制 setup、install 和重复 build 开销。

### 5.7 Evidence Join

Evidence Join 必须证明：

- 所有计划 Lane 都已完成。
- 每个 selected identity 恰好执行一次。
- 每个 required core identity 已执行。
- Job Matrix 与 Shard Plan hash 一致。
- 测试失败、Job 缺失、artifact 缺失或 Selection 漂移均可见。
- Profile escalation 没有被 contributor 降级。

任意 Lane 被取消、跳过或未产生有效结果时，最终 Required CI Result 必须失败。

### 5.8 GitHub CI Model Independence

GitHub Actions 不运行本地模型或远程 Judge。模型只允许在 push 前的本地 Portfolio Maintenance 中处理少数有歧义的非核心删除候选。

GitHub CI 对测试删除只验证：

- Git diff 中的 deleted test identities。
- 删除集合与 tracked authorization `batchHash` 一致。
- authorization 的 evidence hash 和 review mode 合法。
- post-delete Catalog、binding、core 和 affected-test gates 通过。

缺少授权时返回明确 issue code，例如 `TEST_DELETION_REVIEW_MISSING`，不得尝试在 CI 中补跑模型。

### 5.9 Profile Escalation Safety

Contributor 不能通过 PR label、环境变量或修改生成物降低 Profile。只有受审 tracked policy 可以改变升级规则。

Profile selector 遇到未知值、冲突规则或未识别 runner 时必须 fail closed。Renderer、summary 或 TUI 变化不能改变 Profile 结果。

### 5.10 Direct Hard Cut

新链路在离线兼容门禁通过后直接成为唯一生产 CI 链路。禁止：

- 长期 Shadow 生产 Job。
- 新旧 Selection 双写。
- 失败后 fallback 到旧全量串行流程。
- 两套 Test Catalog 或 lifecycle authority。

历史 CI 可以保留在 Git 历史中作为回滚参考，但不得继续参与生产决策。

## 6. Feature Closeout and Deletion Governance

### 6.1 Closeout Is the Lifecycle Boundary

测试生命周期不使用固定天数过期。Feature 或 Bug 关闭时必须处理其全部 `feature_working_set`，防止测试组合随功能数量单向增长。

Closeout disposition：

```text
promote_to_core
merge_to_contract_test
retain_on_demand
delete_after_closeout
```

`unclosedFeatureWorkingTestCount > 0` 时，Feature Closeout 必须失败。开发中的普通 PR 可以继续携带工作集状态，但最终 promotion 不能留下未决测试。

### 6.2 Core Promotion

只有显式受保护 Capability 才能使用 `promote_to_core`。Promotion 必须同时满足：

- binding 明确指向六模型核心或 Product Survival Perimeter。
- 测试拥有独立行为 oracle。
- 没有更小的现有核心测试提供等价保护。
- Promotion 后 `corePermanentCount <= 120`。

超过预算时必须合并、替换或移除重复核心测试，不能直接增加预算。

### 6.3 Contract-Test Consolidation

`merge_to_contract_test` 用于把多个实现细节测试、重复 fixture 变体或同一行为的碎片断言合并为较稳定的行为合同测试。

合并必须证明：

- replacement 绑定相同或更高层级 Capability。
- replacement oracle 不从被测实现复制 expected value。
- 原测试删除后没有独立 failure mode 丢失。
- 原测试进入一个可回滚删除批次。

### 6.4 Core Tests Are Outside Normal Reduction

普通 Portfolio Maintenance 不得删除、降级或批量重分类 `core_permanent`。任何命中核心集合的候选必须从普通批次中剔除。

如果确实需要改变核心测试，必须使用单独的 Core Test Change 流程，并获得显式用户确认和完整核心回归证据。本设计不把核心修改混入大规模精简批次。

### 6.5 Deterministic Non-Core Fast Path

非核心候选满足以下条件时不调用模型：

- 不属于 `core_permanent`。
- 不绑定 protected Capability。
- reason code 属于 tracked policy 批准的确定性集合。
- replacement、失效 target 或重复关系可以机器证明。
- 不存在 shared fixture ownership 争议。
- 删除后可运行 affected tests、Catalog 和 binding 验证。

流程：

```text
Deterministic Preflight
→ atomic deletion
→ post-delete validation
→ PASS keeps deletion
→ FAIL rolls back exact batch
```

适用候选包括已证明重复、已被稳定合同测试替代、目标已删除或不可达、自证 oracle、无独立产品行为的实现细节测试和失效 fixture 组合。

### 6.6 Ambiguous Local Model Review

只有以下歧义才允许调用本地模型：

- 语义相似但无法确定完全重复。
- replacement 覆盖关系不明确。
- shared fixture 可能存在间接消费者。
- target 通过动态注册或 generated binding 引用。
- 删除影响跨越 Feature 或 Package。

本地 Review 必须在 push 和 GitHub CI 之前运行，使用全新独立上下文，只读取紧凑 candidate manifest。

每批建议 `20–30` 个同质候选，并遵守：

```text
maximumLocalModelCallsPerBatch = 1
automaticRetryCount = 0
convergenceRoundCount = 0
remoteJudgeCallCount = 0
```

允许 verdict：

```text
approve_delete
retain_on_demand
manual_review
```

禁止返回 `REMEDIATE` 或要求扩大合同范围。超时、非法输出、证据不足或不确定时，默认转入 `retained_on_demand`，继续处理后续批次。

### 6.7 Review Is Not Part of GitHub CI

本地维护链：

```text
candidate generation
→ optional local model review
→ local deletion
→ local affected validation
→ compact authorization
→ commit / push
```

GitHub CI 只验证结果，不执行 Review：

```text
recompute deleted identity set
→ verify authorization batchHash
→ verify Catalog and binding
→ run core and affected tests
→ accept or reject deletion change
```

### 6.8 Compact Authorization

确定性快速路径使用 `reviewMode: deterministic`。本地模型路径使用 `reviewMode: local_model`。

授权只保存：

- candidate set hash
- evidence hash
- review mode
- verdict
- review profile version

不保存模型思维链、完整 prompt、完整 test source 或通用 Judge receipt。

### 6.9 No Persistent Remediation Loop

Test Portfolio 精简必须是有界维护任务：

- Preflight 失败的候选不进入 Review。
- 本地 Review 不确定时直接保留为 on-demand。
- 删除后验证失败时回滚该批次。
- 一个失败批次不能阻断其他独立批次。
- 不要求连续三轮 no-gap。
- 不复用 Requirements Contract Critical Auditor 的大型通用 schema。

### 6.10 Rollback and Regression Handling

每个删除批次必须是原子、可追踪且可独立恢复的仓库变更。发现回归时只恢复关联批次，并更新 reason code、binding 或 replacement 规则。

恢复测试不是失败掩盖机制。恢复后必须重新分类其 lifecycle state，并防止同一不安全候选被重复提出。

## 7. Failure Handling and Operational Behavior

### 7.1 Unknown Discovery or Binding

未知 runner、不可解释 candidate-only、runner-only identity 或 impact binding 必须产生明确 issue code，并在选择阶段阻断。不得进入测试执行后才暴露 Catalog 不完整。

### 7.2 Test Failure

测试失败只影响绑定的 current run 和相关 Lane。修复后必须重新执行受影响 shard，旧结果不能冒充当前 PASS。

### 7.3 Flake and Quarantine

Flake finding 不能自动删除测试。确认有独立价值的 flake 测试进入受管 quarantine 或 `retained_on_demand`，并保留可见 failure history。

Quarantine 不能绕过 protected Capability。核心测试发生 flake 时必须修复或提供等价 replacement，不能通过移动 Profile 解除 Required CI 保护。

### 7.4 Missing Local Model

本地模型不可用不阻塞日常 CI，也不阻塞普通产品开发。歧义候选转入 `retained_on_demand`；确定性候选仍可按快速路径处理。

### 7.5 Authorization Drift

删除集合、evidence、policy 或 review profile 变化时，已有 authorization 自动失效。CI 必须比较当前 deleted identity set hash，不接受历史批次授权覆盖新删除。

## 8. Migration and Final Acceptance

迁移采用有界批次压实和最终 Direct Hard Cut。旧 CI 在迁移分支完成前仍是生产链路；新链验证完成后一次性替换，不能长期并存。

### 8.1 M1 Fresh Baseline

旧 Test Portfolio 报告及历史约 `985` 个测试只能作为背景，不是当前执行权威。迁移首先重新生成：

- Runner-Resolved executable count
- explicit critical bindings
- Capability、Trace、Package 和 fixture ownership
- duplicate、obsolete、ineffective 和 unresolved classifications
- current duration observations

M1 只建立事实，不删除测试。

### 8.2 M2 Core Freeze

根据显式 protected Capability 建立 `core_permanent`，并验证：

```text
corePermanentCount <= 120
protectedCapabilityWithoutCoreTestCount = 0
```

如果候选核心超过预算，先合并重复保护或选择更小的行为 E2E，不得扩大预算。

### 8.3 M3 Deterministic Bulk Reduction

对非核心高置信候选按同质批次处理，每批最多约 `50` 个。推荐顺序：

1. 明确重复执行和完全重复 oracle。
2. 已证明删除或不可达的 target。
3. 自证 expected value 和无独立行为 oracle。
4. 已有稳定合同 replacement 的实现细节测试。
5. 失效、重复或高维护成本 fixture 组合。

每批必须完成 Preflight、物理删除、affected validation、Catalog reconciliation 和原子边界检查。失败只回滚当前批次。

### 8.4 M4 Ambiguous Local Review

M3 后剩余的语义歧义候选按 `20–30` 个同质批次执行一次本地 Review。Review 不能启动循环。

如果执行总量仍超过 `480`，优先：

- 合并同一 Capability 的碎片测试。
- 用稳定合同测试替代 fixture matrix。
- 将高价值低频边界归入 on-demand。
- 重新检查错误 core promotion。

不得通过把测试简单移出 PR Profile 冒充物理达标。

### 8.5 M5 Profile and Shard Hard Cut

物理组合达标后，离线验证四个 Profile、Selection、Shard Plan 和 Evidence Join。通过后直接替换旧全量串行 CI。

Hard Cut 后：

- `pr-fast` 成为普通 PR required result。
- 自动升级产生 `pr-full` required result。
- release surface 变化附加 `release-verify`。
- `nightly-deep` 独立运行，不阻塞普通 PR。
- 生产面不存在旧 Selection fallback。

### 8.6 Count and Integrity Gates

最终必须满足：

```text
runnerResolvedExecutableTestCount <= 480
corePermanentCount <= 120
unclassifiedTestCount = 0
unresolvedImpactBindingCount = 0
unclosedFeatureWorkingTestCount = 0
protectedCapabilityWithoutCoreTestCount = 0
unauthorizedDeletedTestCount = 0
selectionOmissionCount = 0
selectionDuplicateCount = 0
shardCoverageMismatchCount = 0
```

### 8.7 Time Acceptance

时间验收分为 Hard Cut 前临时证据和 Hard Cut 后正式 SLO：

- Hard Cut 前至少执行三次 fresh、代表性 `pr-fast`，每次墙钟时间不超过 10 分钟。
- 三次运行必须包含至少一次 shared-core impact 和一次普通 Feature impact。
- 运行必须使用真实 Runner、真实 Selection 和真实 Job setup，不能用 empty timer、mock journey 或缓存结果代替。
- 累积至少 20 次有效 PR 运行后计算正式 `P95 <= 10 minutes`。
- 20 次样本前只能声明 `provisional_slo_pass`。

### 8.8 Coverage Conservation

物理删除不能只依赖全绿结果。必须验证：

- 所有 protected Capability 仍有至少一个独立核心测试。
- replacement tests 绑定原测试覆盖的适用行为。
- 删除后受影响 mutation、negative path 或 error path 仍可被至少一个测试识别。
- shared fixture 删除没有产生不可达或隐形 runner identity。
- consumer install、CLI、persistence、安全和编码最小 E2E 保持可执行。

### 8.9 Determinism

相同 repository state、policy、runner configuration 和 duration snapshot 必须产生完全相同的 Catalog、Selection、Shard Plan 和 Run Manifest canonical bytes。

Duration snapshot 变化可以改变 shard packing，但不能改变 selected identity set。Renderer-only 变化不能改变任何语义 hash。

## 9. Verification Strategy

实现必须覆盖以下验证层：

- Discovery reconciliation fixtures：candidate-only、runner-only、unknown runner。
- Classification precedence fixtures：exception、specific rule、generic rule 和同级冲突。
- State transition tests：四态和全部 Closeout disposition。
- Selection tests：exact、Feature expansion、Package expansion 和 unresolved block。
- Profile escalation tests：shared contract、schema、compiler、release surface。
- Sharding tests：完整覆盖、无重复、稳定 bytes 和未知时长。
- Deletion authorization tests：deterministic、local model、hash drift 和 missing authorization。
- Core protection tests：普通 reducer 无法删除或降级核心测试。
- Post-delete rollback tests：affected validation 失败只恢复当前批次。
- GitHub model independence tests：workflow 不包含模型 provider、credential 或 Judge invocation。
- Hard Cut tests：生产 registry 中只有一条 Catalog、Selection 和 CI authority。

## 10. Risks and Mitigations

### 10.1 Incorrect Core Set

风险：核心定义过宽导致无法达到 `120`，或过窄导致关键能力无保护。

缓解：只允许显式 Capability binding；release membership 与 criticality 分离；核心预算失败时要求合并或 replacement。

### 10.2 Dynamic Selection Misses Cross-Cutting Impact

风险：changed-file 映射漏掉 shared contract 或间接 consumer。

缓解：Trace、Capability、Package 和 dependency edges 联合选择；高扩散路径自动升级；未知边界 fail closed。

### 10.3 Exceptions Become Per-Test Configuration

风险：exceptions 逐渐退化为大型逐文件清单。

缓解：冗余 exception 硬失败；重复 override 模式产生 directory-rule promotion candidate；exception 增长可见。

### 10.4 Local Review Becomes a New Persistent Process

风险：本地模型重复调用、扩展范围或要求多轮收敛。

缓解：每批最多一次调用；无自动重试；只有三个 verdict；不确定直接 on-demand；GitHub CI 完全无模型依赖。

### 10.5 On-Demand Becomes a Dumping Ground

风险：不愿删除的测试全部转入 on-demand，物理总量仍膨胀。

缓解：`retained_on_demand` 仍计入 `executableTestCount <= 480`；Feature Closeout 和 Portfolio budget 持续约束总量。

### 10.6 Runtime Target Achieved by Hiding Tests

风险：PR 变快但测试只是移动到无人运行的 Profile。

缓解：物理总量预算、Selection completeness、nightly/release applicability 和 protected Capability gates 同时生效。

## 11. Approval Record

本设计在 2026-07-27 的设计会话中逐节确认：

- Test Portfolio 四态模型和硬门禁：批准。
- Dynamic Selection 和最小生成物：批准。
- CI Profiles 和并行 DAG：批准。
- Feature Closeout 和轻量删除审查：批准。
- 一次性迁移和最终验收：批准。

Written spec 在进入 implementation planning 前仍需用户回读。本文档保持独立，不修改现有 CI Optimization Goal Execution Contract，也不赋予任何实现完成状态。
