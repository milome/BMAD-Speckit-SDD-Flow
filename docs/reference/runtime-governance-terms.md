# Runtime Governance 已统一术语清单

> **Current path**: `resolveRuntimePolicy` 输出统一治理语义，`runAuditorHost` 消费其中的 post-audit 字段决定后置动作
> **Legacy path**: 把 `triggerStage` / `scoringEnabled` 直接理解成手工 `bmad-speckit score` 指令

适用文档：

- **实现与类型（`RuntimePolicy` 唯一金源）**：[scripts/runtime-governance.ts](../scripts/runtime-governance.ts)（文件顶部含本页互链与字段↔API 表）
- [SDD 架构设计总览与运行时治理设计](../design/SDD%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1%E6%80%BB%E8%A7%88%E4%B8%8E%E8%BF%90%E8%A1%8C%E6%97%B6%E6%B2%BB%E7%90%86%E8%AE%BE%E8%AE%A1.md)
- [Runtime Governance 实施方案](../plans/2026-03-19-runtime-governance-implementation-plan.md)
- [统一运行时规划 UNIFIED_RUNTIME](../plans/UNIFIED_RUNTIME_2026-03-19.md)（§SDD 标准 policy 全字段表）
- [配置文件参考](./configuration.md)
- [Speckit CLI 参考](./speckit-cli.md)

---

## 1. 正文概念 vs policy 字段

| 用途            | 统一写法               |
| --------------- | ---------------------- |
| 正文概念        | `mandatory gate`       |
| policy 字段     | `mandatoryGate`        |
| 正文概念        | `granularity-governed` |
| policy 字段     | `granularityGoverned`  |
| 正文概念 / 字段 | `triggerStage`         |
| 正文概念 / 字段 | `scoringEnabled`       |

规则：

- 叙述性文字、表格概念列、架构解释中，优先使用：
  - `mandatory gate`
  - `granularity-governed`
- 当明确指代 policy object 字段名时，使用：
  - `mandatoryGate`
  - `granularityGoverned`
  - `triggerStage`
  - `scoringEnabled`

---

## 2. 术语标准定义

### `mandatory gate`

固定强制门控阶段，不应仅因为审计粒度模式变化而被跳过。

### `mandatoryGate`

policy object 中用于表示“当前阶段是否属于固定强制门控”的字段。

### `granularity-governed`

受 `full / story / epic` 审计粒度模式控制的阶段。

### `granularityGoverned`

policy object 中用于表示“当前阶段是否受审计粒度控制”的字段。

### `triggerStage`

当前运行阶段在 scoring / 审计下游系统中使用的最终阶段标识。
其基础映射来自 `stage-mapping.yaml`，最终值由 Runtime Governance 结合 `flow`、`stage`、映射规则与兼容规则共同求值得出。

### `scoringEnabled`

当前阶段是否允许触发评分写入。
它不是单一配置项的直接结果，而是由 Runtime Governance 综合 `flow`、`stage`、`triggerStage`、trigger 规则和配置输入后输出的最终判定。
在当前路径中，它会先被 `runAuditorHost` 消费，再决定是否继续执行底层 scoring 写入。

### `generateDoc`

policy object 中布尔字段：当前阶段是否应生成文档产物（与 `bmad-story-config.yaml` 中该阶段的 `generate_doc` 一致）。
**Legacy 对齐**：`scripts/bmad-config.ts` 的 `shouldGenerateDoc(stage)`；未配置时默认 `true`。

### `convergence`

policy object 中承载**审计收敛契约**的字段（结构与 `AuditConvergenceConfig` 一致：`description`、`rounds`、`no_gap_required`、`critical_auditor_ratio`、`applicable_stages`）。
求值方式：先 `getStrictness(stage)` 得到 `strict` 或 `standard`，再取 `getAuditConvergence(strictness)`；数据源为合并后的 `bmad-story-config`（及未来文件覆盖）中的 `audit_convergence`。
项目级 `config/speckit.yaml` 的 `audit_convergence`（如 `standard`）与故事粒度配置共同影响最终合并结果时，以 **Runtime Governance 合并后的有效配置** 为准。

---

## 3. 相关配置文件的统一解释

| 配置文件                     | 统一角色                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `bmad-story-config.yaml`     | 提供 granularity-governed 阶段的基础审计/验证策略输入，以及 `generate_doc`、`audit_convergence` 等输入 |
| `stage-mapping.yaml`         | 提供 `triggerStage` 的基础映射输入                                                                     |
| `scoring-trigger-modes.yaml` | 提供 `scoringEnabled` 的 trigger 策略输入                                                              |

规则：

- `bmad-story-config.yaml` 不单独决定 `mandatory gate`
- `stage-mapping.yaml` 不单独决定最终 `triggerStage`
- `scoring-trigger-modes.yaml` 不单独决定最终 `scoringEnabled`

它们都是 **Runtime Governance 的输入源**，不是最终权威结论。

---

## 4. 文档写作约定

### 应该这样写

- “该阶段属于 `mandatory gate`”
- “该阶段属于 `granularity-governed`”
- “policy object 中的 `mandatoryGate` 字段”
- “最终 `triggerStage` 由 Runtime Governance 求值”
- “是否写分由 `scoringEnabled` 决定”

### 不建议这样写

- 把 `mandatory gate` 和 `mandatoryGate` 混成同一种正文概念
- 把 `granularity-governed` 和 `granularityGoverned` 混成同一种正文概念
- 把 `triggerStage` 写成“静态固定值”而不说明其运行时求值属性
- 把 `scoringEnabled` 写成仅由单个 YAML 开关直接决定

---

## 5. 审文档时的快速检查表

以后审相关文档时，可以直接对照这 6 条：

- [ ] 正文概念是否统一写为 `mandatory gate` / `granularity-governed`
- [ ] 字段名是否统一写为 `mandatoryGate` / `granularityGoverned`
- [ ] `triggerStage` 是否被描述为“最终阶段标识”而不是纯静态值
- [ ] `scoringEnabled` 是否被描述为“统一治理输出”而不是单配置直出
- [ ] `stage-mapping.yaml` 是否被描述为 `triggerStage` 输入源
- [ ] `scoring-trigger-modes.yaml` 是否被描述为 `scoringEnabled` 输入源
- [ ] `generateDoc` 是否与 `shouldGenerateDoc` / `generate_doc` 对齐描述
- [ ] `convergence` 是否与 `getAuditConvergence` / `audit_convergence` 对齐描述

---

## 6. 标准 policy 字段与 UNIFIED / TypeScript 闭包（逐字段，U-1.3d）

下表与 `docs/plans/UNIFIED_RUNTIME_2026-03-19.md` §「标准 policy object 全字段」**同名同义**；实现以 `RuntimePolicy`（[`runtime-governance.ts`](../scripts/runtime-governance.ts)）为准。

| 字段                  | TypeScript                | 语义 / 缺失策略                                                                                                                                                                                                                                |
| --------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flow`                | `RuntimeFlowId`           | 调用方传入；`unknown` 时 mandatory/trigger 按映射缺省（`unmapped_*`）                                                                                                                                                                          |
| `stage`               | `StageName`               | 调用方传入                                                                                                                                                                                                                                     |
| `auditRequired`       | `boolean`                 | 阶段表 `audit`，缺省 `true`                                                                                                                                                                                                                    |
| `validationLevel`     | `ValidationLevel \| null` | 阶段表 `validation`，缺省 `null`                                                                                                                                                                                                               |
| `strictness`          | `StrictnessLevel`         | 阶段表 `strictness`，缺省 `standard`                                                                                                                                                                                                           |
| `generateDoc`         | `boolean`                 | 阶段表 `generate_doc`，缺省 `true`                                                                                                                                                                                                             |
| `convergence`         | `AuditConvergenceConfig`  | `getAuditConvergence(strictness)`（与 `bmad-story-config` 合并结果一致）                                                                                                                                                                       |
| `mandatoryGate`       | `boolean`                 | `_bmad/_config/runtime-mandatory-gates.yaml` + `resolveRuntimePolicy`                                                                                                                                                                          |
| `granularityGoverned` | `boolean`                 | `_bmad/_config/runtime-granularity-stages.yaml` + `resolveRuntimePolicy`                                                                                                                                                                       |
| `skipAllowed`         | `boolean`                 | 阶段表 `optional === true`                                                                                                                                                                                                                     |
| `scoringEnabled`      | `boolean`                 | `scoringEnabledForTriggerStage`（`packages/scoring/trigger/trigger-loader.ts`）+ `scoring-trigger-modes.yaml`                                                                                                                                  |
| `triggerStage`        | `string`                  | `_bmad/_config/stage-mapping.yaml` 段 `runtime_flow_stage_to_trigger_stage`                                                                                                                                                                    |
| `compatibilitySource` | `CompatibilitySource`     | 生产路径固定 `governance`；测试路径通过 `setRuntimePolicyShadowModeForTests(true)` 产出 `shadow`（对照用，**非**环境变量）                                                                                                                     |
| `reason`              | `string`                  | 人类可读说明（含 legacy / mandatory / trigger / scoring 摘要）                                                                                                                                                                                 |
| `identity`            | `RuntimePolicyIdentity`   | 子结构：当前最小实现包含 `flow`、`stage`；后续 Story 批次扩展 story/run/artifact identity 时以此为正式承载面，同时保持顶层兼容读取                                                                                                             |
| `control`             | `RuntimePolicyControl`    | 子结构：承载 `auditRequired`、`validationLevel`、`strictness`、`generateDoc`、`convergence`、`mandatoryGate`、`granularityGoverned`、`skipAllowed`、`scoringEnabled`、`triggerStage`、`reason`；顶层同名字段当前作为 compatibility mirror 保留 |
| `language`            | `RuntimePolicyLanguage`   | 子结构：当前最小实现固定声明 `preserveMachineKeys`、`preserveParserAnchors`、`preserveTriggerStage` 为 `true`，作为 narrative 语言切换不改写 machine-readable surfaces 的契约起点                                                              |

**与 legacy 表对齐的字段**：`auditRequired`、`validationLevel`、`strictness`、`generateDoc`、`convergence`、`skipAllowed` — 与 `tests/acceptance/bmad-config.test.ts` U-1.1 及 `resolveRuntimePolicy` 对齐。

---

## 7. 生产求值来源（字段 → 配置 / 代码 → 测试）

| 字段                  | YAML + 函数                                                                                                             | 测试证据                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `mandatoryGate`       | `runtime-mandatory-gates.yaml`，`resolveRuntimePolicy`（顶层兼容镜像；子结构镜像位于 `control.mandatoryGate`）          | `tests/acceptance/runtime-governance-mandatory-granularity.test.ts`                                                      |
| `granularityGoverned` | `runtime-granularity-stages.yaml`，`resolveRuntimePolicy`（顶层兼容镜像；子结构镜像位于 `control.granularityGoverned`） | 同上                                                                                                                     |
| `triggerStage`        | `stage-mapping.yaml` → `runtime_flow_stage_to_trigger_stage`（顶层兼容镜像；子结构镜像位于 `control.triggerStage`）     | `tests/acceptance/runtime-stage-mapping-yaml.test.ts`、`runtime-governance-scoring-chain.test.ts`                        |
| `scoringEnabled`      | `scoring-trigger-modes.yaml`，`scoringEnabledForTriggerStage`（顶层兼容镜像；子结构镜像位于 `control.scoringEnabled`）  | `tests/acceptance/runtime-governance-scoring-chain.test.ts`、`packages/scoring/trigger/__tests__/trigger-loader.test.ts` |
| `identity`            | `resolveRuntimePolicy`（子结构）                                                                                        | `tests/acceptance/runtime-policy-structure-mirror.test.ts`                                                               |
| `control`             | `resolveRuntimePolicy`（子结构）                                                                                        | `tests/acceptance/runtime-policy-structure-mirror.test.ts`、`tests/acceptance/runtime-governance-scoring-chain.test.ts`  |
| `language`            | `resolveRuntimePolicy`（子结构）                                                                                        | `tests/acceptance/runtime-policy-structure-mirror.test.ts`、`tests/i18n/governance-boundary.test.ts`                     |
| 模板覆盖（T9）        | `runtime-policy-templates.yaml`                                                                                         | `tests/acceptance/runtime-governance-templates.test.ts`                                                                  |
| 插件 augmenter（T10） | `runtime-governance-registry.ts`                                                                                        | `tests/acceptance/runtime-governance-registry.test.ts`                                                                   |

---

## 8. 当前统一状态

以下文档与实现一并维护：

- [SDD 架构设计总览与运行时治理设计](../design/SDD%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1%E6%80%BB%E8%A7%88%E4%B8%8E%E8%BF%90%E8%A1%8C%E6%97%B6%E6%B2%BB%E7%90%86%E8%AE%BE%E8%AE%A1.md)
- [Runtime Governance 实施方案](../plans/2026-03-19-runtime-governance-implementation-plan.md)
- [配置文件参考](./configuration.md)
- [Speckit CLI 参考](./speckit-cli.md)
- 生产关单验收：[`docs/plans/PRODUCTION_INTEGRATION_SDDA_T1_T10_2026-03-20.md`](../plans/PRODUCTION_INTEGRATION_SDDA_T1_T10_2026-03-20.md) §0
