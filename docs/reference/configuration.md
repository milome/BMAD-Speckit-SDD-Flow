# 配置文件参考

> `_bmad/_config/` 目录下所有配置文件的说明。

---

## 概述

BMAD-Speckit-SDD-Flow 的配置文件集中在 `_bmad/_config/` 目录下，控制审计行为、评分触发、Coach 诊断等功能。

---

## Runtime Governance 术语与字段说明

本项目正在从“分散配置解释”演进到“统一 Runtime Governance 治理控制平面”。

Runtime Governance 的职责，不是替代所有配置文件，而是把以下决策统一收敛为一个标准运行时结果：

- 当前属于哪个 `flow`
- 当前处于哪个 `stage`
- 当前阶段是否需要 `audit`
- 若不审计，采用何种 `validation`
- 当前阶段是否属于固定强制门控
- 当前阶段是否允许被审计粒度跳过
- 当前阶段是否触发 `scoring`
- 当前阶段使用哪个 `triggerStage`

### 核心术语

| 术语 | 含义 |
|------|------|
| Runtime Governance | 统一解释运行时策略的控制平面 |
| policy object | Runtime Governance 输出的标准策略对象 |
| legacy behavior | 当前由既有 helper / 配置 / 规则共同形成的默认行为 |
| shadow mode | 新治理层与 legacy 逻辑并行求值，但暂不替换权威结果 |
| parity | legacy 与 governance 输出的一致性验证 |
| granularity-governed | 受 `full / story / epic` 审计粒度控制的阶段 |
| mandatory gate | 固定强制门控阶段，不应被 granularity 跳过 |
| triggerStage | scoring 写入时使用的阶段映射标识 |
| compatibilitySource | 当前决策结果来自 legacy、governance 或 shadow compare |

### 推荐 policy object 字段

| 字段 | 含义 |
|------|------|
| `flow` | 当前流程类型，如 `story`、`bugfix`、`standalone_tasks` |
| `stage` | 当前阶段，如 `specify`、`plan`、`implement` |
| `auditRequired` | 是否要求进入完整审计 |
| `validationLevel` | 不进入完整审计时采用的验证等级，如 `basic`、`test_only` |
| `strictness` | 审计严格度，如 `standard`、`strict` |
| `generateDoc` | 当前阶段是否生成文档产物；对应 YAML `generate_doc` 与 `shouldGenerateDoc(stage)`，默认 true |
| `convergence` | 当前严格度下的收敛契约（`rounds`、`no_gap_required`、`critical_auditor_ratio`、`applicable_stages`）；对应 `getAuditConvergence(strictness)` |
| `mandatoryGate` | 当前阶段是否属于固定强制门控 |
| `granularityGoverned` | 当前阶段是否受审计粒度控制 |
| `skipAllowed` | 当前阶段是否允许被跳过 |
| `scoringEnabled` | 当前阶段是否允许触发评分写入 |
| `triggerStage` | 当前阶段对应的 scoring trigger 标识 |
| `compatibilitySource` | 当前策略结果来源 |
| `reason` | 当前判定的人类可解释原因 |

### 术语关系

| 问题 | 应看哪个字段 |
|------|--------------|
| 这个阶段是否必须审计？ | `auditRequired` |
| 这个阶段为什么没审计？ | `validationLevel` + `reason` |
| 这个阶段能否被 `story/epic` 跳过？ | `granularityGoverned` + `skipAllowed` |
| 这个阶段为什么不能跳过？ | `mandatoryGate` + `reason` |
| 这个阶段是否会写分？ | `scoringEnabled` |
| 写分时对应哪个阶段标识？ | `triggerStage` |
| 当前阶段是否应产出文档？ | `generateDoc` |
| 审计轮次/无 gap/批判审计员比例按哪套规则？ | `convergence` |
| 当前结果来自旧逻辑还是新治理层？ | `compatibilitySource` |

---

## 配置文件与 Runtime Governance 的关系

统一 Runtime Governance 并不取消现有配置文件，而是把它们从“分散解释源”收敛为“规则输入源”。

| 配置文件 | 主要作用 | 在 Runtime Governance 中的角色 |
|----------|----------|-------------------------------|
| `bmad-story-config.yaml` | 控制审计粒度与自动续跑 | 提供 granularity / validation / strictness 的基础输入 |
| `stage-mapping.yaml` | 阶段到内部标识的映射 | 提供 `triggerStage` 与阶段映射输入 |
| `scoring-trigger-modes.yaml` | 控制评分写入是否启用 | 提供 scoring trigger 策略输入 |
| `eval-lifecycle-report-paths.yaml` | 定义审计报告路径 | 为治理结果落地产物提供路径约定 |
| `audit-item-mapping.yaml` | 审计项到评分维度映射 | 为评分解析与诊断提供下游映射 |
| `code-reviewer-config.yaml` | 审计器行为参数 | 为部分审计阶段提供严格度与角色要求输入 |

换句话说，配置文件仍然存在，但未来应由统一治理层负责：

1. 收集输入
2. 合并规则
3. 解释优先级
4. 输出标准 policy object

---

## 配置文件清单

### code-reviewer-config.yaml

Code Reviewer 的多模式配置，定义审计时的行为参数。

| 字段 | 说明 |
|------|------|
| 审计模式 | prd / arch / code / pr |
| 严格度 | standard / strict |
| 批判审计员占比 | 各模式的最低发言占比要求 |

引用者：bmad-code-reviewer-lifecycle skill、code-reviewer agent。
IDE 副本：`.cursor/agents/code-reviewer-config.yaml`。

---

### governance-remediation.yaml

治理 remediation runner 的宿主与 provider 配置。

```yaml
version: 1
primaryHost: cursor
packetHosts:
  - cursor
  - claude
  - codex

provider:
  mode: openai-compatible
  id: openai-governance
  baseUrl: https://api.openai.com/v1
  model: gpt-5.4
  apiKeyEnv: OPENAI_API_KEY
  timeoutMs: 30000
```

这个文件同时控制两层：

- `primaryHost` / `packetHosts`：决定 remediation packet 面向哪个宿主
- `provider`：决定 governance hints 通过哪种模型协议获取

完整字段说明、OpenAI / Anthropic 双示例，见：

- [Governance Remediation Provider 配置参考](./governance-remediation-provider-config.md)

---

### bmad-story-config.yaml

Story 工作流配置，控制审计粒度和自动续跑行为。

```yaml
audit_granularity:
  mode: "full"           # full | story | epic

auto_continue:
  enabled: false
  require_ready_flag: true
  require_next_action: true
```

### 两类阶段的区别

`bmad-story-config.yaml` 主要控制的是 **granularity-governed** 阶段，也就是会随 `full / story / epic` 模式变化而改变审计或验证行为的阶段。

但在运行时治理中，还必须与 **mandatory gate** 区分：

| 类型 | 含义 | 是否受 `audit_granularity.mode` 控制 |
|------|------|--------------------------------------|
| granularity-governed | 受 `full / story / epic` 模式影响的阶段 | 是 |
| mandatory gate | 固定强制门控阶段，不应被 granularity 跳过 | 否 |

### granularity-governed 阶段（以 story flow 为例）

| 模式 | Story 创建 | 中间阶段 | 实施后 |
|------|-----------|---------|--------|
| full | 审计 | 全部审计 | 审计 |
| story | 审计 | 基础验证 | 审计 |
| epic | 不审计 | 不审计 | 不审计（Epic 级审计） |

这里的“中间阶段”通常指：

- `specify`
- `plan`
- `gaps`
- `tasks`
- `implement`

其中在 `story` 模式下通常表现为：

- `specify / plan / gaps / tasks` → `validationLevel=basic`
- `implement` → `validationLevel=test_only`
- `post_audit` → 仍保留完整审计

### mandatory gate 的参考理解

以下阶段不应仅因为 `audit_granularity.mode=story` 或 `epic` 而被跳过：

- bugfix 流程中的 `post_audit`
- standalone tasks 流程中的文档审计
- 其它被运行时治理显式标记为固定门控的阶段

也就是说，`bmad-story-config.yaml` 定义的是**基础审计粒度行为**，但最终是否允许跳过，仍应由 Runtime Governance 结合：

- 当前 `flow`
- 当前 `stage`
- 是否属于 `mandatoryGate`
- 是否属于 `granularityGoverned`

统一求值得出。

### 与 Runtime Governance 的关系

在统一治理层下，`bmad-story-config.yaml` 的角色是：

1. 提供 `audit_granularity.mode` 默认值
2. 提供 granularity-governed 阶段的基础验证/审计策略
3. 不单独决定 mandatory gate 是否生效
4. 不单独决定 scoring 是否触发

示例文件：`bmad-story-config.example.yaml`。

---

### scoring-trigger-modes.yaml

控制评分写入是否启用。

```yaml
scoring_write_control:
  enabled: true
```

### 在 Runtime Governance 中的作用

`scoring-trigger-modes.yaml` 不只是一个“开/关”配置，而是 Runtime Governance 在求值 `scoringEnabled` 时的重要输入之一。

它主要回答的问题是：

- 当前阶段是否允许触发评分写入
- 某类 event / stage 组合是否应该进入 scoring 流程
- 当 trigger 不成立时，应该 fail-loudly 还是静默跳过

### 与 `scoringEnabled` 求值的关系

统一治理层在判断 `scoringEnabled` 时，通常会综合以下输入：

1. 当前 `flow`
2. 当前 `stage`
3. 当前 `triggerStage`
4. 当前 event / trigger 映射
5. `scoring-trigger-modes.yaml` 中的启用策略
6. 是否属于明确禁止写分的场景

可以把它理解为：

| 输入 | 作用 |
|------|------|
| `flow` / `stage` | 判断当前处于哪个流程与阶段 |
| `triggerStage` | 判断应使用哪个 scoring 阶段标识 |
| `scoring-trigger-modes.yaml` | 判断当前 trigger 是否允许写分 |
| governance policy | 输出最终 `scoringEnabled=true/false` |

### 推荐理解

- `scoring-trigger-modes.yaml` 提供的是 **trigger 策略输入**
- Runtime Governance 输出的是 **最终 scoring 判定结果**
- 因此它不应单独决定“是否写分”，而应作为统一求值的一部分

### 结果语义

| 情况 | 典型结果 |
|------|----------|
| trigger 成立且 scoring 启用 | `scoringEnabled=true` |
| trigger 不成立 | `scoringEnabled=false` 或 fail-loudly |
| 配置禁用 scoring | `scoringEnabled=false` |
| trigger 映射缺失 | 应输出明确 reason，而非静默通过 |

当 `enabled: false` 时，审计通过后不触发 `bmad-speckit score`。

---

### coach-trigger.yaml

AI Coach 诊断的触发配置。

| 字段 | 说明 |
|------|------|
| `required_skill_path` | 指向全局 `bmad-code-reviewer-lifecycle/SKILL.md` |
| 触发条件 | 评分写入完成后自动触发 |

---

### stage-mapping.yaml

Speckit 阶段名称到内部标识的映射。

| 阶段 | 内部标识 |
|------|----------|
| specify | speckit_1_2 |
| plan | speckit_2_2 |
| gaps | speckit_3_2 |
| tasks | speckit_4_2 |
| implement | speckit_5_2 |

### 在 Runtime Governance 中的作用

`stage-mapping.yaml` 的核心作用，不只是“把阶段名称换个名字”，而是为 Runtime Governance 提供 `triggerStage` 求值依据。

Runtime Governance 在统一输出 policy object 时，通常不会只保留原始阶段名（如 `specify`、`plan`），还需要得到一个下游 scoring / 审计系统可消费的阶段标识，这就是 `triggerStage`。

### 与 `triggerStage` 求值的关系

统一治理层在求值 `triggerStage` 时，通常会综合：

1. 当前 `flow`
2. 当前 `stage`
3. `stage-mapping.yaml` 中的基础映射
4. 某些 flow 的特殊阶段别名或兼容规则
5. scoring 或审计侧要求的最终阶段标识

可以把它理解为：

| 输入 | 作用 |
|------|------|
| 原始 `stage` | 当前运行阶段，如 `specify`、`plan` |
| `stage-mapping.yaml` | 提供基础映射关系 |
| flow-specific 规则 | 对特殊流程阶段做覆盖或补充 |
| governance policy | 输出最终 `triggerStage` |

### 推荐理解

- `stage-mapping.yaml` 提供的是 **阶段到内部标识的基础映射**
- Runtime Governance 输出的是 **当前场景下最终可用的 `triggerStage`**
- 因此它不应被简单理解为静态表，而应被理解为统一求值的一部分

### 结果语义

| 情况 | 典型结果 |
|------|----------|
| 标准 speckit 阶段 | 使用映射表中的阶段标识 |
| flow 有特殊别名 | 使用治理层修正后的 `triggerStage` |
| 映射缺失 | 应输出明确 reason 或 fail-loudly |

这意味着：

- `stage-mapping.yaml` 决定了“基础映射是什么”
- Runtime Governance 决定了“当前运行时最终采用哪个 `triggerStage`”

---

### eval-lifecycle-report-paths.yaml

各阶段审计报告的路径约定。定义 `AUDIT_{stage}-E{epic}-S{story}.md` 的存放位置规则。

---

### audit-item-mapping.yaml

审计报告中各检查项到评分维度的映射关系。

---

### speckit.yaml

Speckit 模块的基础配置（原 `.speckit/config.yaml`）。

---

## _bmad/_config/ 目录

BMAD 核心配置（清单文件）：

| 文件 | 说明 |
|------|------|
| `agent-manifest.csv` | Agent 定义清单（displayName、icon、职责） |
| `task-manifest.csv` | Task 定义清单 |
| `workflow-manifest.csv` | Workflow 定义清单 |
| `files-manifest.csv` | 文件清单 |
| `tool-manifest.csv` | 工具清单 |
| `manifest.yaml` | 全局 manifest 配置 |
| `bmad-help.csv` | Help 命令数据源 |

---

## 相关文档

- [Runtime Governance 已统一术语清单](./runtime-governance-terms.md) — 术语定义、字段写法与审文档检查表
- [Speckit CLI 参考](./speckit-cli.md) — `bmad-speckit score`、`--triggerStage` 与评分触发示例
- [架构概述](../explanation/architecture.md) — 配置文件在架构中的位置
- [评分系统](../explanation/scoring-system.md) — scoring/coach 配置详解
- [入门教程](../tutorials/getting-started.md) — 安装与初始配置
- [Runtime Governance 实施方案](../plans/2026-03-19-runtime-governance-implementation-plan.md) — 统一治理层的实施路径
- [SDD 架构设计总览与运行时治理设计](../design/SDD%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1%E6%80%BB%E8%A7%88%E4%B8%8E%E8%BF%90%E8%A1%8C%E6%97%B6%E6%B2%BB%E7%90%86%E8%AE%BE%E8%AE%A1.md) — 总体架构与迁移路线图
