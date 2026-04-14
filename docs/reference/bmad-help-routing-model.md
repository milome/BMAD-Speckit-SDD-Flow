# bmad-help 路由模型参考

> 日期：2026-04-11  
> 适用范围：`bmad-help` State-Aware Routing Phase 1  
> 角色：字段、状态、命名、输出合同的参考真相源
> **Current path**: `flow + sourceMode + derive contextMaturity + implementationReadinessStatus + recommendation`
> **Legacy path**: `sourceMode` 直出成熟度 / catalog-first 命令目录路由

---

## 1. 目的

本文件用于冻结 `bmad-help` 第一阶段的语义合同，重点解决四件事：

1. 把 `sourceMode` 和 `contextMaturity` 分层
2. 把 `implementationReadinessStatus` 定义成帮助层可解释、可验证的状态机
3. 把 `story`、`bugfix`、`standalone_tasks` 的外部实施前 gate 名称统一为 `implementation-readiness`
4. 把 `recommended / allowed but not recommended / blocked` 三类用户可见输出固定下来

本文件定义的是 **帮助层推荐语义**，不是新的 runtime kernel gate，也不是新的放行器。

---

## 2. 权威面与位置

第一阶段的规范位置固定如下：

| 主题                          | 权威位置                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement freeze            | [`../requirements/2026-04-11-bmad-help-state-aware-routing-phase1-requirement.md`](../requirements/2026-04-11-bmad-help-state-aware-routing-phase1-requirement.md) |
| XL execution plan             | [`../plans/2026-04-11-bmad-help-state-aware-routing-phase1-execution-plan.md`](../plans/2026-04-11-bmad-help-state-aware-routing-phase1-execution-plan.md)         |
| 实施边界与阶段拆解            | [`../plans/2026-04-11-bmad-help-phase1-context-maturity-implementation-plan.md`](../plans/2026-04-11-bmad-help-phase1-context-maturity-implementation-plan.md)     |
| 任务分解与进度                | [`../plans/TASKS_bmad_help_phase1_context_maturity.md`](../plans/TASKS_bmad_help_phase1_context_maturity.md)                                                       |
| 字段 / 状态 / 命名 / 输出合同 | **本文**                                                                                                                                                           |
| 配置入口层摘要                | [`./configuration.md`](./configuration.md)                                                                                                                         |

如果上述文档之间出现冲突，字段和状态的细节解释以本文为准；需求边界和禁止项以 requirement 为准；执行顺序和波次以 execution plan 为准。

---

## 3. 字段分层合同

| 层级                  | 字段 / 标签                                               | 角色                   | 权威来源                                     | 是否直接面向用户   |
| --------------------- | --------------------------------------------------------- | ---------------------- | -------------------------------------------- | ------------------ |
| runtime authoritative | `flow`                                                    | 工作类型维度           | runtime / helper state                       | 是                 |
| runtime authoritative | `sourceMode`                                              | 内部来源语义           | runtime context schema / registry            | 否，默认不首屏展示 |
| help-layer derived    | `contextMaturity`                                         | 用户可见成熟度维度     | 显式证据派生                                 | 是                 |
| help-layer derived    | `implementationReadinessStatus`                           | 实施型推荐的 gate 输入 | readiness / remediation / execution evidence | 是                 |
| user-visible output   | `recommended` / `allowed but not recommended` / `blocked` | 推荐标签               | routing result                               | 是                 |

固定边界：

1. `sourceMode` 不在第一阶段改义，也不写回为成熟度字段。
2. `contextMaturity` 是派生字段，不写回 canonical runtime context 真相源。
3. `implementationReadinessStatus` 是帮助层读取和解释治理证据后的结果，不替代底层 gate。

---

## 4. `contextMaturity` 字段合同

### 4.1 允许值

| 值             | 含义                                                 |
| -------------- | ---------------------------------------------------- |
| `minimal`      | 只有最小可讨论上下文，尚未形成可稳定复用的方案链     |
| `seeded`       | 已有部分方案与文档骨架，但执行合同未闭合             |
| `full`         | 文档链、治理链、runtime scope 与执行证据已基本成链   |
| `unclassified` | 关键证据不足，且在 1 到 2 个关键追问后仍无法可靠归类 |

### 4.2 派生依据

`contextMaturity` 必须来自显式证据组，而不能来自自由发挥的模型判断。第一阶段固定五组信号：

1. artifact 完整度
2. Four-Signal 完整度
3. execution specificity
4. governance health
5. runtime scope completeness

### 4.3 与 `sourceMode` 的边界

`sourceMode` 只负责提供内部来源候选，不直接等于最终成熟度。

| `sourceMode`         | 默认 `contextMaturity` 候选 | 校正规则                                                                   |
| -------------------- | --------------------------- | -------------------------------------------------------------------------- |
| `standalone_story`   | `minimal`                   | 只有当 artifact / governance / scope 证据明显增强时，才允许上调到 `seeded` |
| `seeded_solutioning` | `seeded`                    | 可因证据不足降到 `minimal`，也可因证据成链升到 `full`                      |
| `full_bmad`          | `full` 候选                 | 只要 readiness 失效、traceability 断裂或 scope 不稳，就必须保守降级        |

### 4.4 判定规则

1. 显式证据优先于主观感觉。
2. 证据冲突时，成熟度向下取保守值。
3. `sourceMode` 只能提供默认候选，不能越过证据直接把结果判成 `full`。
4. Provider / model 可以帮助总结证据，但不能成为 `contextMaturity` 的 authoritative 判定源。

---

## 5. `implementationReadinessStatus` 状态机

### 5.1 允许值

| 值                            | 语义                                                   | 是否允许把实施入口作为首推 |
| ----------------------------- | ------------------------------------------------------ | -------------------------- |
| `missing`                     | 缺少实施前 readiness 证据                              | 否                         |
| `blocked`                     | 证据存在，但被 blocker / 文档审计未通过 / 契约缺节阻断 | 否                         |
| `repair_in_progress`          | remediation 已启动，但 rerun gate 尚未闭环             | 否                         |
| `ready_clean`                 | readiness 干净通过，且未进入 remediation               | 是                         |
| `repair_closed`               | remediation 闭环，最终到达 `gate_passed`               | 是                         |
| `stale_after_semantic_change` | 曾经通过，但后续语义变更触发重新 readiness             | 否                         |

### 5.2 读取顺序

帮助层读取 `implementationReadinessStatus` 时，固定按以下顺序消费证据：

1. `runtime context / activeScope`：先确定当前 flow / scope / artifact hint，禁止跨 scope 猜测
2. `auditIndex` 中与当前 orphan artifact 对齐的 authoritative document-audit closeout
3. 最新 readiness report
4. 最新 remediation artifact
5. execution record / rerun gate 结果
6. deferred gaps tracking

### 5.3 冲突处理

当不同证据源冲突时，固定采用保守策略：

1. 成熟度向下取
2. 复杂度向上取
3. readiness 状态取更阻断的一侧

### 5.4 放行规则

只有以下两种状态允许把实施入口作为首推：

- `ready_clean`
- `repair_closed`

其它状态只能输出：

- `blocked`
- 或 `allowed but not recommended`

但不得输出成首推实施路径。

---

## 6. 统一 gate 命名规范

第一阶段的外部 gate 命名只允许使用：

- `implementation-readiness`

适用 `flow`：

- `story`
- `bugfix`
- `standalone_tasks`

明确禁止进入外部命名口径的名称：

- `bugfix-readiness`
- `tasks-readiness`
- `readiness-lite-gate`

允许保留但只能出现在解释文本中的说明语：

- `full readiness`
- `readiness delta`
- `readiness-lite`

这些说明语不能成为新的 gate id、不能成为新的 rerun gate 名称，也不能成为帮助层额外放行口径。

---

## 7. normalized readiness adapter 合同

### 7.1 目标

normalized adapter 只负责把不同 `flow` 的前置治理事实翻译成统一的用户可见语义。它 **不** 替换原有 gate，也 **不** 抹平原有文档审计前置。

### 7.2 `flow` 到前置事实的映射

| `flow`             | authoritative 前置事实                                               | 归一化后的外部说明         |
| ------------------ | -------------------------------------------------------------------- | -------------------------- |
| `story`            | readiness report / remediation / rerun gate 闭环                     | `implementation-readiness` |
| `bugfix`           | `auditor-bugfix` 通过 + bugfix readiness delta / remediation 闭环    | `implementation-readiness` |
| `standalone_tasks` | `auditor-tasks-doc` 通过 + readiness-lite / delta / remediation 闭环 | `implementation-readiness` |

### 7.3 `bugfix` / `standalone_tasks` 的状态归一化

对 `bugfix` 和 `standalone_tasks`，帮助层必须先看文档审计前置，再映射到统一的 `implementationReadinessStatus`：

| authoritative 事实                                                           | 归一化结果                    |
| ---------------------------------------------------------------------------- | ----------------------------- |
| 没有 BUGFIX / TASKS / BUGFIX 执行文档                                        | `missing`                     |
| 文档存在，但 `auditor-bugfix` / `auditor-tasks-doc` 未通过、尚未执行、结构化报告缺字段，或 `runAuditorHost` authoritative closeout 尚未完成 | `blocked`                     |
| 文档审计 authoritative closeout 已完成，但 readiness 证据缺失                                          | `missing`                     |
| remediation 已启动，execution record 仍在 `running` 或 `awaiting_rerun_gate` | `repair_in_progress`          |
| readiness 干净通过                                                           | `ready_clean`                 |
| remediation rerun 最终到达 `gate_passed`                                     | `repair_closed`               |
| 共享语义或关键契约变更使原通过结果失效                                       | `stale_after_semantic_change` |

### 7.4 不可绕过规则

1. `auditor-bugfix` 仍然是 BUGFIX 文档审计，不因外部统一命名而消失。
2. `auditor-tasks-doc` 仍然是 TASKS / BUGFIX 执行文档前置审计，不因外部统一命名而消失。
3. 帮助层只要看到这两类前置尚未通过，就不得把实现入口判成 `recommended`。
4. 对 orphan `bugfix` / `standalone_tasks`，只有当 `auditIndex` 条目与当前 artifact 对齐、`stage` 与 flow 一致、且 `closeoutApproved = true` 时，文档审计事实才算 authoritative。
5. prose-only PASS、仅存在结构化报告但未完成 host closeout、或 `stage=document` 这类旧口径，都不得被解释成 orphan implementation-ready。

---

## 8. 用户可见输出合同

`bmad-help` 的首屏输出必须先给状态，再给路径，不得退化回“命令清单优先”。

固定输出位：

1. 识别结果
   - `flow`
   - `contextMaturity`
   - `implementationReadinessStatus`
2. 推荐标签
   - `recommended`
   - `allowed but not recommended`
   - `blocked`
3. 推荐路径
4. 阻断说明 / 缺失证据

`sourceMode` 可以出现在详细解释里，但不是首屏主字段。

---

## 9. 判定顺序合同

`bmad-help` 的 state-aware routing 固定按以下顺序求值：

1. `flow`
2. `sourceMode`（内部来源语义）
3. `derive contextMaturity`
4. `follow-up`（最多 1 到 2 个关键问题）
5. `complexity`
6. `implementationReadinessStatus`
7. `recommendation`

禁止反向顺序：

1. 不得先给 implement / quick dev，再回头补 readiness 说明。
2. 不得先按命令目录决定路径，再事后“翻译”状态。
3. 不得在 `implementationReadinessStatus` 为阻断时，仍把实施入口包装成 `recommended`。

---

## 10. 旧路由与新路由的 precedence

`bmad-help` 第一阶段不是删除旧目录/phase/sequence 路由，而是给它们加上 state-aware precedence。

### 10.1 优先级规则

| 判定层                                 | 作用                                       | 优先级 |
| -------------------------------------- | ------------------------------------------ | ------ |
| `implementationReadinessStatus`        | 决定实施是否允许被首推                     | 最高   |
| `contextMaturity` + `complexity`       | 决定应走轻路径、补文档、还是升轨           | 高     |
| 旧 `phase` / `sequence` / catalog 路由 | 仅在上两层不阻断时，用于给出具体入口与命令 | 回退层 |

### 10.2 强制 precedence

1. 只要 `implementationReadinessStatus` 不是 `ready_clean` 或 `repair_closed`，实施入口不得是 `recommended`。
2. 只要 `standalone_tasks` 命中 `high` complexity，必须优先升轨而不是继续保留轻路径。
3. 只要 `contextMaturity = unclassified`，必须先走补证据 / 追问路径，而不是直接走 catalog-first implement path。

### 10.3 何时允许旧路由接管

只有在以下条件同时满足时，旧目录/phase/sequence 路由才可作为首个具体入口生成器：

1. `flow` 已明确
2. `contextMaturity` 已不是 `unclassified`
3. `complexity` 已明确
4. `implementationReadinessStatus` 不阻断

此时旧路由的职责是：

- 给出命令入口
- 给出 phase/sequence 上的当前位置
- 给出与当前推荐路径一致的具体执行面

它不能推翻 state-aware recommendation。

---

## 11. `contextMaturity` 证据表

第一阶段把五组信号转成显式证据表，用于 `derive contextMaturity`。

### 11.1 证据组

| 证据组                     | 关注点                                             | 典型证据                                                       |
| -------------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| artifact 完整度            | 是否已有当前 `flow` 所需关键文档                   | PRD / Architecture / Story / TASKS / BUGFIX / readiness report |
| Four-Signal 完整度         | 是否已有 Journey / Smoke / Evidence / Traceability | 报告、日志、链接、验收链                                       |
| execution specificity      | 是否已具体到可执行 slice                           | owner、命令、任务分解、closure 预期                            |
| governance health          | readiness / remediation / rerun 是否健康           | blocker 数、remediation 状态、execution record                 |
| runtime scope completeness | 当前 scope 是否稳定可解析                          | project/story/run、activeScope、artifact path                  |

### 11.2 最小判定规则

| `contextMaturity` | 最低满足条件                                                   |
| ----------------- | -------------------------------------------------------------- |
| `minimal`         | 只有最小 artifact，Four-Signal / governance / scope 明显不完整 |
| `seeded`          | 至少 2 组证据有稳定支撑，但 execution contract 未闭合          |
| `full`            | 五组证据大体成链，且 governance health 不阻断                  |
| `unclassified`    | 证据冲突或缺失，且追问预算已耗尽                               |

### 11.3 保守降级规则

命中以下任一项时，不得维持 `full`：

1. readiness 缺失或阻断
2. traceability 断裂
3. activeScope 不稳
4. 当前文档与实际任务边界不一致
5. 关键 artifact 只“提及”但无可验证路径

---

## 12. 复杂度合同

复杂度是推荐层强修正项，不是可忽略的说明字段。

### 12.1 五因子

| 因子     | low                  | medium         | high                                          |
| -------- | -------------------- | -------------- | --------------------------------------------- |
| 影响面   | 单模块局部           | 2 到 3 模块    | 主链 / 多系统                                 |
| 共享契约 | 不改 shared contract | 局部接口变化   | shared API / schema / permission / data model |
| 验证成本 | 定向验证即可         | 需要 smoke     | 需要复杂 E2E / 迁移 / 发布链                  |
| 不确定性 | 输入充分             | 有少量假设     | 存在关键 silent assumption                    |
| 回退难度 | 易回滚               | 局部回滚有成本 | blast radius 高 / 恢复困难                    |

### 12.2 评分与分级

| 总分   | 等级     |
| ------ | -------- |
| `0-3`  | `low`    |
| `4-6`  | `medium` |
| `7-10` | `high`   |

### 12.3 强制升级规则

命中以下任一项时，复杂度至少上调到 `medium`，部分直接视为 `high`：

1. shared contract / shared types / schema 变更
2. permission boundary 变更
3. completion semantics 变更
4. dependency semantics 变更
5. fixture / environment assumptions 变化
6. CI / root config / install / infra 改动
7. 数据迁移或持久化语义变化

### 12.4 对路径的约束

1. `standalone_tasks + high complexity` 必须升轨，不得继续伪装为轻路径。
2. `bugfix + high complexity` 可以继续保留 `bugfix` 流，但必须强调 re-readiness / delta-readiness。
3. `story + high complexity` 不改变 flow，但必须强化 readiness 与验证门槛。

---

## 13. 追问预算规则

追问只服务于补足关键证据，不服务于无边界探索。

### 13.1 预算

- 最多追问 `1` 到 `2` 个关键问题
- 超出预算后，若仍缺关键证据，直接进入 `unclassified`

### 13.2 允许追问的主题

只允许追问会显著影响以下判定的问题：

1. `flow`
2. `contextMaturity`
3. `complexity`
4. `implementationReadinessStatus`

### 13.3 禁止追问的主题

1. 纯好奇型补充
2. 对当前推荐无影响的背景故事
3. 可以从现有文档 / runtime state 直接读取的信息

---

## 14. Provider sidecar 边界

Provider / model 只允许作为 `optional sidecar`，不能成为 authoritative state source。

### 14.1 允许的用途

1. 解释当前推荐为何出现
2. 帮助生成候选追问
3. 汇总冲突证据
4. 帮助把复杂状态翻译成人类更好理解的说明

### 14.2 禁止的用途

1. 判定 `contextMaturity`
2. 判定 `complexity`
3. 判定 `implementationReadinessStatus`
4. 覆盖 gate pass/fail
5. 推翻 repository fact / governance fact

### 14.3 结论

Provider sidecar 可以改善解释质量，但不能改变推荐结果。

---

## 15. 推荐输出结构

`bmad-help` 对用户的首屏输出固定为：

1. 识别结果
   - `flow`
   - `contextMaturity`
   - `complexity`
   - `implementationReadinessStatus`
2. 推荐路径
3. 阻断说明
4. 备选路径

推荐标签只允许：

- `recommended`
- `allowed but not recommended`
- `blocked`

不得用“命令清单大全”替代以上结构。

---

## 16. Worked Examples

### 16.1 Story / minimal / blocked

**识别结果**

- `flow = story`
- `contextMaturity = minimal`
- `complexity = medium`
- `implementationReadinessStatus = missing`

**推荐路径**

- `recommended`: 先补齐 Story / Tasks / readiness 所需合同
- `blocked`: 直接 `Dev Story`

**为什么**

- 当前只有最小输入，执行合同未闭合
- readiness 证据缺失，不能直接进入实施

### 16.2 Bugfix / seeded / blocked

**识别结果**

- `flow = bugfix`
- `contextMaturity = seeded`
- `complexity = medium`
- `implementationReadinessStatus = blocked`

**推荐路径**

- `recommended`: 先完成 BUGFIX 文档审计，再进入 delta-readiness
- `blocked`: 直接修复实现

**为什么**

- 虽然已有部分方案骨架，但 `auditor-bugfix` 尚未通过
- 统一对外仍显示 `implementation-readiness`，但 BUGFIX 文档前置不消失

### 16.3 Standalone Tasks / full / high / blocked

**识别结果**

- `flow = standalone_tasks`
- `contextMaturity = full`
- `complexity = high`
- `implementationReadinessStatus = ready_clean`

**推荐路径**

- `recommended`: 升轨到 `story` 路径或更完整的执行面
- `allowed but not recommended`: 保留 standalone 文档作为参考
- `blocked`: 把 standalone 继续当作轻路径首推

**为什么**

- readiness 已不阻断，但 complexity 为 `high`
- `standalone_tasks` 在高复杂度下必须升轨，不能继续伪装成 quick path

### 16.4 Story / full / ready_clean

**识别结果**

- `flow = story`
- `contextMaturity = full`
- `complexity = low`
- `implementationReadinessStatus = ready_clean`

**推荐路径**

- `recommended`: 按当前 phase / sequence 进入 `Dev Story`
- `allowed but not recommended`: 重新从目录型帮助手动选命令

**为什么**

- 关键工件、治理链与 runtime scope 已成链
- readiness 已通过，此时旧 phase / sequence 路由可以作为具体入口生成器

---

## 17. README 入口语义

README 只需要告诉用户：

1. `/bmad-help` 不是纯命令目录
2. 它会先识别状态，再给路径
3. 它会把路径标记为 `recommended / allowed but not recommended / blocked`

README 不重复维护字段细节，字段细节仍以本文为准。

---

## 18. 第一阶段非目标

以下内容不在本文定义范围内：

1. 把 `contextMaturity` 写回 runtime context schema
2. 在 runtime kernel 中合并成单一 gate 实现
3. 修改 rerun / packet / execution record 状态机本体
4. 提前为 Provider sidecar 打开 authoritative 判定权

本文只冻结帮助层推荐合同，为后续 Wave 2 到 Wave 4 提供不漂移的语义基座。
