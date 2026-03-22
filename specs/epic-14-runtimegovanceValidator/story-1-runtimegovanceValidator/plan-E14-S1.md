# Plan E14-S1 — Runtime Governance Story-Scoped Isolation and Dual-Host Production Consolidation

**Branch**: `epic-14-runtimegovanceValidator-story-1-runtimegovanceValidator` | **Date**: 2026-03-21 | **Spec**: `specs/epic-14-runtimegovanceValidator/story-1-runtimegovanceValidator/spec-E14-S1.md`
**Input**: Feature specification from `specs/epic-14-runtimegovanceValidator/story-1-runtimegovanceValidator/spec-E14-S1.md`

## Summary

本计划将 Story 14.1 的 runtime governance 收敛工作拆成六个**有序**实施批次：
1. RuntimePolicy 子结构与兼容镜像（T12/T13，首个代码实现批次）
2. story-scoped isolation / runtime context / 并发幂等（T1–T6）
3. dual-host 自动注入与 Cursor native hooks（T7–T10）
4. language policy 接入 Runtime Governance（T14）
5. audit / scoring / trace / SFT / render boundary 的 narrative 与输出边界收口（T15–T17）
6. skill lightening 与 CI closure（T18–T19）

说明：Story authority 中 T1–T19 是总体计划范围；本 speckit 实施链要求“首个代码实现批次”锁定 T12/T13，以先稳定控制面，再按上述顺序推进后续批次。

## Technical Context

**Language/Version**: TypeScript / Node.js（仓库现状）
**Primary Dependencies**: Node.js scripts、js-yaml、Vitest、BMAD/Speckit runtime governance modules、`packages/scoring/trigger`、`packages/runtime-emit`、Cursor / Claude host adapter contracts、`scripts/i18n/*` narrative rendering pipeline
**Storage**: YAML + JSON 配置文件、`_bmad-output` artifacts、文件系统 context/state
**Testing**: Vitest、BMAD acceptance、i18n tests、CLI smoke / scoring chain tests、dual-host parity / native hooks / mirror consistency regressions
**Target Platform**: Windows + Node.js monorepo，兼顾 Cursor / Claude 双宿主 hooks 场景
**Project Type**: Monorepo tooling / workflow runtime
**Performance Goals**: runtime governance 求值与 emit 维持当前 CLI / hooks 使用体验，无新增明显人工步骤；关键 acceptance / CI 门禁全部可稳定复跑
**Constraints**: 不得引入第二治理核心；不得破坏既有 acceptance suites；不得让 machine-readable keys、schema fields、anchors、trigger ids 漂移；不得把 skills 继续当作动态治理判断器；不得偏离 Story §11 的批次顺序
**Scale/Scope**: 覆盖 Story 14.1 T1–T19，其中首个代码实现批次锁定 T12/T13，后续批次按 Story 文档顺序推进

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- 项目级 constitution 文件 `.specify/memory/constitution.md` 缺失；以项目 `CLAUDE.md`、全局 coding/testing/security 规则、以及 Story 14.1 文档中的显式边界代替。
- 通过条件：
  - 不跳过 speckit 阶段与审计闭环。
  - implement 采用 TDD 红绿灯与 Ralph 追踪。
  - 不把动态治理判断或语言判断重新塞回 skills。
  - 优先复用既有 runtime-governance / i18n / scoring 基础，而不是另起一套新控制面。
  - 严格遵守 Story §11 的批次顺序，并把首个代码实现批次限制为 T12/T13 及其兼容稳定性证明。
  - machine-readable keys、schema fields、trigger ids、parser anchors 保持 canonical English，不因 narrative 语言治理而漂移。
- 当前设计满足上述条件，无需宪法例外。

## Project Structure

### Documentation (this feature)

```text
specs/epic-14-runtimegovanceValidator/story-1-runtimegovanceValidator/
├── spec-E14-S1.md
├── plan-E14-S1.md
├── IMPLEMENTATION_GAPS-E14-S1.md
├── tasks-E14-S1.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
scripts/
├── runtime-governance.ts
├── runtime-context.ts
├── write-runtime-context.js
├── emit-runtime-policy.ts
├── runtime-governance-registry.ts
├── runtime-governance-template-schema.ts
└── i18n/
    ├── language-policy.ts
    ├── render-template.ts
    └── ...

packages/
├── runtime-emit/
│   ├── package.json
│   ├── README.md
│   └── dist/
├── scoring/
│   └── trigger/
│       ├── trigger-loader.ts
│       └── __tests__/
└── bmad-speckit/

_bmad/_config/
├── stage-mapping.yaml
├── scoring-trigger-modes.yaml
├── runtime-mandatory-gates.yaml
├── runtime-granularity-stages.yaml
└── runtime-policy-templates.yaml

docs/reference/
├── runtime-governance-terms.md
├── runtime-context.md
├── runtime-context.schema.json
├── runtime-policy-emit-schema.md
└── runtime-policy-emit.schema.json

tests/
├── acceptance/
│   ├── runtime-governance-*.test.ts
│   ├── runtime-context-schema.test.ts
│   ├── runtime-policy-structure-mirror.test.ts
│   ├── runtime-governance-language-policy.test.ts
│   └── ...
└── i18n/
    ├── governance-boundary.test.ts
    ├── language-policy.test.ts
    └── ...
```

**Structure Decision**: 继续沿用 monorepo 现有 `scripts/ + packages/ + docs/ + tests/ + _bmad/_config/` 结构。治理核心收敛在 `scripts/runtime-governance.ts`，宿主 emit 在 `scripts/emit-runtime-policy.ts` 与 `packages/runtime-emit/`，评分判定入口在 `packages/scoring/trigger/trigger-loader.ts`，语言渲染保持在 `scripts/i18n/`。

## Phase 0: Research

### Research Decisions

1. **Decision**: 以 Story 14.1 文档与 `2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md` 为 speckit 重建的唯一权威。
   - **Rationale**: 当前旧 spec/plan/tasks 已漂移到 fresh regression harness，不能再作为 Story 14.1 的技术基线。
   - **Alternatives considered**: 继续沿用旧文档；已排除，因为与 Story 14.1 主线不一致。

2. **Decision**: implement 第一批仅覆盖 T12/T13。
   - **Rationale**: Story 文档明确锁定首批为 RuntimePolicy 子结构与兼容镜像，防止文档/语言/宿主工作先于控制面稳定落地。
   - **Alternatives considered**: 并行推进语言与 dual-host；已排除，因为会建立在不稳定 policy 结构之上。

3. **Decision**: Constitution Check 使用项目规则与 Story 文档约束替代 `.specify/memory/constitution.md`。
   - **Rationale**: 仓库不存在该文件，但流程仍需继续；项目 CLAUDE 与 Story 文档已给出足够强的约束。
   - **Alternatives considered**: 暂停等待 constitution 文件；已排除，因为当前任务目标是重建并继续该 Story 的 speckit 链。

## Phase 1: Design & Contracts

### Data Model

#### RuntimePolicy
- 顶层字段：`flow`、`stage`、`triggerStage`、`scoringEnabled`、`mandatoryGate`、`granularityGoverned`、`skipAllowed`、`compatibilitySource`、`reason`
- 子结构：
  - `identity`: story / run / artifact 身份字段
  - `control`: audit / validation / convergence / trigger / scoring 控制字段
  - `language`: narrative mode、artifact language、preserve English machine surfaces
- 迁移原则：保留顶层兼容镜像；新代码优先读子结构；旧代码暂时兼容顶层读取

#### RuntimeContext
- 关键字段：`version`、`flow`、`stage`、`updatedAt`、`epicId`、`storyId`、`storySlug`、`runId`、`artifactRoot`、`contextScope`
- 关键约束：project-scoped 与 story-scoped 模式区分；并发模式禁止 fallback 到共享根 context

#### HostAdapterContract
- 宿主：Cursor / Claude
- 责任：inject / transport / envelope / config protocol
- 禁止：第二控制面；第二语言判断面

### Contracts

本 Story 以 CLI / hook / policy object 合同为主，不新增外部 HTTP API。

- `RuntimePolicy` 输出合同：`docs/reference/runtime-policy-emit.schema.json`
- `RuntimeContext` 文件合同：`docs/reference/runtime-context.schema.json`
- Cursor native hooks envelope：通过 `runtime-policy-inject` 与相关 schema / docs 约束
- scoring trigger resolution contract：`packages/scoring/trigger/trigger-loader.ts` + acceptance tests

### Quickstart / Verification Plan

1. 先通过 mirror / policy / scoring chain / governance boundary 相关现有测试，建立基线。
2. 落地 RuntimePolicy 子结构与兼容镜像。
3. 增加 mirror consistency tests，确保新旧读取面一致。
4. 再推进 runtime context / emit / idempotency / dual-host / language policy / skill lightening。
5. 最终执行 Story 文档 §12 的总闸门命令。

## Re-check Constitution Check

- 设计未引入第二控制面。
- 设计未绕过审计闭环。
- 设计把 implement 第一批约束为 RuntimePolicy 子结构与兼容镜像。
- 设计保持 machine-readable English surfaces 不变。

结论：Phase 1 后仍满足项目规则与 Story 14.1 的等价 constitution 约束。

## Generated Artifacts

本计划阶段输出/约定：
- `spec-E14-S1.md`
- `plan-E14-S1.md`
- `IMPLEMENTATION_GAPS-E14-S1.md`（由下一阶段生成）
- `tasks-E14-S1.md`（由下一阶段生成）
- `checklists/requirements.md`

<!-- AUDIT: PENDING REBUILD -->
