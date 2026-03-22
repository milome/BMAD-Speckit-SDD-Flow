# Spec E14-S1 — Runtime Governance 生产收敛：Story-Scoped 隔离、双宿主自动注入、RuntimePolicy 子结构化与统一语言治理

**Feature Branch**: `epic-14-runtimegovanceValidator-story-1-runtimegovanceValidator`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "continue spec/plan/gaps/tasks rebuild for epic 14 story 1"

## User Scenarios & Testing

### User Story 1 - 稳定 RuntimePolicy 控制面 (Priority: P1)

作为维护 Runtime Governance 的开发者，我需要先把 RuntimePolicy 从扁平对象提升为带 `identity / control / language` 子结构且保留顶层兼容镜像的正式控制面，这样后续 story-scoped 隔离、双语输出与双宿主接入才能在不打坏现有 acceptance suites 的前提下演进。

**Why this priority**: Story 文档明确要求 implement 第一批锁定 T12/T13；如果不先完成子结构和兼容镜像，后续所有治理、语言与宿主改动都会建立在不稳定基础上。

**Independent Test**: 仅实现本故事后，应能通过 RuntimePolicy 结构与镜像一致性相关验收，并保持现有 runtime governance / scoring chain / i18n 边界测试不退化。

**Acceptance Scenarios**:

1. **Given** 现有 RuntimePolicy 仍以顶层字段为主要接口，**When** 引入 `identity / control / language` 子结构，**Then** 新旧消费者都能读取一致的治理结果，且关键顶层字段继续可用。
2. **Given** story 流与 standalone_tasks 流分别触发 implement 相关治理，**When** 求值 RuntimePolicy，**Then** `triggerStage`、`scoringEnabled`、`mandatoryGate`、`granularityGoverned` 的结果与既有 acceptance tests 保持一致。
3. **Given** 语言渲染链消费治理结果，**When** 在 `zh`、`en`、`bilingual` 模式下切换，**Then** narrative 输出可切换，但 machine-readable control fields 保持 canonical English 且不被语言模式改写。

---

### User Story 2 - 建立 story-scoped runtime isolation (Priority: P2)

作为维护多 Story 并发执行链的开发者，我需要让 runtime context、policy 输入、emit 与 score/state 幂等协议感知 story identity / run identity，这样并发 story 运行时不会因为共享上下文而串扰。

**Why this priority**: Runtime Governance 生产收敛的核心目标之一是把 story 从产物单元升级为治理隔离单元；如果缺少这一层，双宿主和语言收口都无法稳定运行在并发场景中。

**Independent Test**: 单独实现本故事后，应能通过 runtime context schema、policy input identity、emit 并发上下文与 score/state 幂等顺序测试，并证明 shared context fallback 在并发模式下被禁止。

**Acceptance Scenarios**:

1. **Given** Story 运行时提供 storyId、storySlug、runId 与 contextScope，**When** 写入和读取 runtime context，**Then** schema 校验通过且旧格式文件仍保持可读。
2. **Given** 显式提供 story-scoped context file，**When** 执行 emit-runtime-policy，**Then** 只允许读取该上下文，不允许回退到共享根 context。
3. **Given** 同一 `(story, stage, triggerStage, runId)` 的 authoritative final pass 被重复提交，**When** score/state 写入逻辑运行，**Then** 不会产生重复 authoritative 记录，且状态推进保持单调前进。

---

### User Story 3 - 收敛双宿主自动注入与语言治理 (Priority: P3)

作为维护 Cursor / Claude 双宿主工作流的开发者，我需要把自动注入路径、Cursor native hooks.json、emit envelope、skills 薄化与统一语言治理收口到同一 Runtime Governance 核心，这样双宿主行为与 narrative 输出可以稳定一致且可审计。

**Why this priority**: 这是 Story 14.1 的正式收口目标，但依赖前两条主线先稳定控制面与隔离模型。

**Independent Test**: 单独实现本故事后，应能通过 dual-host parity、native hooks、语言边界、audit/scoring/trace narrative 相关回归，并证明 skills 不再承载第二控制面或第二语言判断面。

**Acceptance Scenarios**:

1. **Given** Cursor 宿主执行初始化与注入，**When** 生成并使用 `.cursor/hooks.json`，**Then** 宿主自动注入通过 native 路径完成，third-party hooks 仅作为 fallback。
2. **Given** 审计报告、评分解释、trace 与 SFT 需要输出 narrative，**When** Runtime Governance 提供语言策略，**Then** 所有人类可读输出按 `zh` / `en` 一致切换，机器字段与 parser anchors 不漂移。
3. **Given** skills 与 prompts 被执行，**When** 审查 governance 逻辑归属，**Then** 动态治理判断与语言决策只来自 Runtime Governance，skills 仅保留流程骨架与静态约束。

### Edge Cases

- 并发 Story 模式下缺失显式 story-scoped context file 时，系统必须 fail loud，不能悄悄回退到共享根 context。
- RuntimePolicy 子结构与顶层兼容镜像发生字段不一致时，系统必须被 mirror tests 识别为失败。
- `call_mapping` 中某个 `triggerStage` 未注册时，`scoringEnabled` 必须为 false 且 reason 可观察。
- 语言模式切换不得改变 `triggerStage`、`scoringEnabled`、`mandatoryGate`、`granularityGoverned` 等治理字段语义。
- Cursor native hooks 自动注入不可用时，只允许退回 documented fallback，不允许生成第二治理核心。

## Requirements

### Functional Requirements

- **FR-001**: System MUST将 Story 14.1 的正式范围绑定到 Runtime Governance T1–T19 主线，并将 implement 第一批锁定在 T12/T13（RuntimePolicy 子结构与兼容镜像）。
- **FR-002**: System MUST在 RuntimePolicy 中引入 `identity`、`control`、`language` 子结构，并保持关键顶层字段作为兼容镜像，直到主要消费者完成迁移。
- **FR-003**: System MUST确保 `resolveRuntimePolicy()` 成为动态治理与语言决策的单一聚合源，并使 `reason` 对 mandatory 命中、trigger 映射、scoring 判定与 identity 信息可观察。
- **FR-004**: System MUST扩展 runtime context schema 与读写器，使其支持 epicId、storyId、storySlug、runId、artifactRoot、contextScope 等 story-scoped identity 字段，同时保持旧格式兼容可读。
- **FR-005**: System MUST在显式 context 或并发 story 模式下禁止 emit fallback 到共享根 `.bmad/runtime-context.json`，并在缺失必要 context 时显式失败。
- **FR-006**: System MUST为 score/state 写入定义正式唯一键、顺序保护与幂等协议，避免同一 story/stage/runId authoritative final pass 被重复写入。
- **FR-007**: System MUST把 Cursor / Claude 统一描述为同一 Runtime Governance 核心的双宿主适配层，其中 Cursor 主路径为 `.cursor/hooks.json`，third-party hooks 仅为 fallback。
- **FR-008**: System MUST让 `runtime-policy-inject` 在 Cursor 宿主输出 Cursor-native JSON envelope，而不是复用 Claude 专属 envelope 伪兼容。
- **FR-009**: System MUST把 `RuntimePolicy.languagePolicy` 设为审计报告、评分解释、trace、handoff、SFT 与 skills 的唯一语言决策来源。
- **FR-010**: System MUST保证所有 machine-readable keys、schema fields、triggerStage、parser anchors、dataset keys 保持 canonical English，不因 narrative 语言切换而漂移。
- **FR-011**: System MUST将 skills、layer prompts 与 audit prompts 收缩为薄编排层，不再承载第二控制面或第二语言判断面。
- **FR-012**: System MUST将 mirror tests、language policy tests、dual-host parity tests、native hooks tests、concurrency tests 与 governance regression 纳入正式验收与 CI 门禁。

### Key Entities

- **RuntimePolicy**: Runtime Governance 的统一策略对象，包含 flow、stage、triggerStage、scoringEnabled、mandatoryGate、granularityGoverned、compatibilitySource、reason，以及 `identity / control / language` 子结构和对应兼容镜像。
- **Runtime Context File**: Runtime Governance 的上下文载体，描述当前 flow、stage、story identity、run identity、artifactRoot 与 contextScope，并作为 emit / hooks 的权威输入之一。
- **Story Instance**: 并发治理的隔离单元，由 epic/story identity 与 runId 共同标识，用于隔离 policy 求值、emit、score/state 与 artifact routing。
- **Language Policy**: Runtime Governance 提供的语言子策略，控制 narrative 输出语言与 preserve English control surfaces 的边界。
- **Host Adapter**: Cursor / Claude 注入层，负责 transport / inject / envelope / config protocol，不拥有第二治理核心。

## Success Criteria

### Measurable Outcomes

- **SC-001**: Story 14.1 的 speckit 文档链能够完整映射 T1–T19，且 implement 第一批明确只包含 RuntimePolicy 子结构、兼容镜像、mirror tests 与相关兼容稳定性工作。
- **SC-002**: Runtime Governance 关键验收命令全部通过，包括 lint、runtime acceptance、runtime governance matrix/policy/scoring chain、i18n、BMAD、scoring 与审计 parser 回归。
- **SC-003**: 在 `zh`、`en`、`bilingual` 三种语言模式下，治理字段快照保持一致，narrative 输出可切换而 machine-readable surfaces 不发生漂移。
- **SC-004**: 在并发 story 场景中，显式 story-scoped context 能稳定驱动 emit 与 score/state，且 shared fallback 被拒绝时有清晰错误信号。
- **SC-005**: Cursor / Claude 双宿主注入路径完成统一收口后，至少一条 native hooks 路径与一条 fallback 路径被测试覆盖，并且都不会引入第二治理控制面。

## T1–T19 Traceability Matrix

| Task | Topic | Landing in Spec |
|---|---|---|
| T1 | story-scoped runtime isolation model | User Story 2；FR-004/005/006；SC-004 |
| T2 | runtime context schema 与读写器扩展 | User Story 2；FR-004；Edge Cases 1 |
| T3 | ResolveRuntimePolicyInput 与 identity 可观察性 | User Story 2；FR-003/004；User Story 2 Scenario 1 |
| T4 | emit 上下文解析顺序收紧 | User Story 2；FR-005；User Story 2 Scenario 2 |
| T5 | score/state 幂等键与冲突裁决 | User Story 2；FR-006；User Story 2 Scenario 3 |
| T6 | 并发 acceptance tests | User Story 2；FR-012；SC-004 |
| T7 | Cursor 宿主结论收敛 | User Story 3；FR-007；SC-005 |
| T8 | Cursor native hooks.json 自动化 | User Story 3；FR-007；User Story 3 Scenario 1 |
| T9 | Cursor-native output envelope | User Story 3；FR-008；User Story 3 Scenario 1 |
| T10 | 双宿主文档口径统一 | User Story 3；FR-007；FR-012 |
| T11 | 设计总览中的隔离与粒度模型 | User Story 2；FR-003/004/012 |
| T12 | RuntimePolicy 子结构 | User Story 1；FR-001/002/003；User Story 1 Scenario 1 |
| T13 | 顶层兼容镜像与消费者迁移 | User Story 1；FR-001/002；User Story 1 Scenario 1/2 |
| T14 | languagePolicy 接入 RuntimePolicy | User Story 3；FR-009；User Story 3 Scenario 2 |
| T15 | i18n render boundary closure | User Story 3；FR-009；FR-010；Edge Cases 4 |
| T16 | 审计报告双语 | User Story 3；FR-009；User Story 3 Scenario 2 |
| T17 | 评分/trace/SFT 双语 | User Story 3；FR-009/010；User Story 3 Scenario 2 |
| T18 | skills 薄化与边界防回退 | User Story 3；FR-011；User Story 3 Scenario 3 |
| T19 | CI / regression / closure gates | User Story 3；FR-012；SC-002/005 |

## Assumptions

- 当前仓库已有 Stage 2 Story Audit 通过的 Story 文档，可作为 speckit 文档链重建的上游 authority。
- 现有 acceptance / i18n 测试中已有一部分 Story 14.1 所需能力基础，重建文档链时应尽量复用这些既有实现证据，而不是重新定义目标。
- `.specify/memory/constitution.md` 缺失，因此本次 plan 阶段的 Constitution Check 只能基于项目现有 CLAUDE 约束与 Story 文档明确约束进行等价检查。

## Reference Documents

The following design documents were referenced during specification creation:

- [Story 14.1 Runtime Governance Validator](../../../_bmad-output/implementation-artifacts/epic-14-runtimegovanceValidator/story-14-1-runtimegovanceValidator/14-1-runtimegovanceValidator.md) - 当前 Story 的上游权威定义，明确 T1–T19、批次顺序、双宿主边界与语言治理目标
- [Runtime Governance Story-Scoped Isolation and Dual-Host Integration Implementation Plan](../../../docs/plans/2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md) - 主权威实施计划，定义 T1–T19 详细任务与执行顺序
- [PRODUCTION INTEGRATION SDDA T1–T10](../../../docs/plans/PRODUCTION_INTEGRATION_SDDA_T1_T10_2026-03-20.md) - 生产整合权威，定义 runtime governance / bilingual runtime 的正式落地门槛
- [Runtime Governance Terms](../../../docs/reference/runtime-governance-terms.md) - 当前术语与字段语义基线
- [Runtime Context Reference](../../../docs/reference/runtime-context.md) - 当前 runtime context 行为与限制说明
