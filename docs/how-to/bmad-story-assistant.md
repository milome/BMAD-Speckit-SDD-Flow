# BMAD Story Assistant 使用说明

> 统一的 Story 级 BMAD 工作流入口，支持 Cursor 和 Claude Code 两个运行时。

---

## 1. 概述

`bmad-story-assistant` 是 Story 级 BMAD 工作流的统一编排入口，用于把一个 Story 从创建、审计、开发到实施后审计串成可恢复、可审计、可追踪的完整流程。

它的职责不是单纯调用某一个 agent，而是统一协调以下能力：

- Story 创建（Create Story）
- Story 审计（Story Audit）
- Layer 4 文档/实现阶段推进（specify → plan → gaps → tasks → implement）
- 实施后审计（Post Audit）
- handoff / state / score / commit gate 集成
- 失败回环与恢复续跑

**`bmad-story-assistant`** 是用户视角的 Story 工作流入口；**`bmad-master`** 是运行时视角的状态机、门控器和路由器。

> **Current path**：主 Agent 先读 `main-agent-orchestration inspect`，必要时才执行 `dispatch-plan`，子代理只执行 `bounded packet`，`runAuditorHost` 仅负责 post-audit close-out。
> **Legacy path**：把 `mainAgentNextAction / mainAgentReady`、手工 close-out 或后台 worker 当成 interactive 主控真相源。

---

## 2. 核心阶段总览

| 阶段                             | 说明                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------- |
| **Stage 1: Create Story**        | 从 Epic 生成 Story 文档，涉及多方案时进入 Party-Mode                              |
| **Stage 2: Story Audit**         | 验证 Story 文档的完整性和可执行性                                                 |
| **Stage 3: Dev Story / Layer 4** | specify → plan → gaps → tasks → implement（TDD 红绿灯）                           |
| **Stage 4: Post Audit**          | 强制门控，验证实现覆盖 tasks/spec/plan，并在通过后进入 `runAuditorHost` close-out |
| **Commit Gate**                  | 审计通过后进入 commit gate                                                        |

### 当前 accepted runtime path

1. 用户通过 `bmad-story-assistant` 或宿主等价入口发起 Story 流程
2. 主 Agent 先执行 `npm run main-agent-orchestration -- --cwd <project-root> --action inspect`
3. 若 surface 显示需要 materialize packet，再执行 `dispatch-plan`
4. 子代理只执行 `bounded packet`，返回 packet result，不决定下一条全局分支
5. 审计通过后由 `runAuditorHost` 做 post-audit close-out，随后主 Agent 回到 `inspect`

---

## 3. 平台差异

### Cursor 与 Claude Code 的共性

- Story 工作流阶段语义
- 审计粒度配置模型
- `_bmad/_config/bmad-story-config.yaml` 配置来源
- TDD 红绿灯、ralph-method 追踪
- reviewer contract / profile vocabulary / `runAuditorHost` post-audit closeout 收口

### 平台差异对照

| 特性              | Cursor                                         | Claude Code CLI                                |
| ----------------- | ---------------------------------------------- | ---------------------------------------------- |
| **Skill 入口**    | `.cursor/skills/bmad-story-assistant/SKILL.md` | `.claude/skills/bmad-story-assistant/SKILL.md` |
| **通用实现通道**  | `mcp_task -> generalPurpose`                   | `Agent -> general-purpose`                     |
| **reviewer 首选** | `Task tool -> code-reviewer`                   | `Agent -> code-reviewer`                       |
| **reviewer 回退** | `mcp_task -> generalPurpose`                   | `Agent -> general-purpose`                     |
| **规则加载**      | `.cursor/rules/` 自动加载                      | `.claude/` 目录                                |
| **Agent 定义**    | `.cursor/agents/`                              | `.claude/agents/`                              |
| **总控**          | 通过 Skill 入口触发                            | 通过 `@bmad-master` 或 Skill 入口触发          |

---

## 4. 使用方式

### 4.1 启动一个新的 Story

**Cursor**：

```text
请使用 bmad-story-assistant 启动一个新的 Story。
Epic: E001
Story: S001
Slug: email-validator
需求：实现邮箱格式验证函数
```

**Claude Code**：

```text
@bmad-master 启动新 Story
Epic: E001
Story: S001
Slug: email-validator
需求：实现邮箱格式验证函数
```

无论通过哪种入口触发，interactive 主链都必须先读取 `main-agent-orchestration inspect`。

### 4.2 继续已有 Story

```text
请使用 bmad-story-assistant 继续 E001-S001
```

或（Claude Code）：

```text
@bmad-master 继续 E001-S001
```

### 4.3 带自动续跑继续

```text
请使用 bmad-story-assistant 继续 E001-S001 --continue
```

`--continue` 在 runtime consumer 归一化后的 handoff 满足 `mainAgentNextAction + mainAgentReady=true` 时允许系统自动推进下一阶段。`next_action / ready` 仍可保留为阶段语义，但 interactive 模式是否继续只看主 Agent 字段。默认不启用自动续跑。

当前更准确的口径是：

- 若 repo-native `main-agent-orchestration` surface 可用，主 Agent **必须先读 surface**
- `mainAgentNextAction / mainAgentReady` 只作为 compatibility summary
- 仅当 surface 不可用时，才回退到 handoff 中的 `mainAgentNextAction / mainAgentReady`
- 子代理只消费 `bounded packet`，不得替主 Agent 选择下一条全局执行链

当前正式做法已经升级为先读取 repo-native orchestration surface：

```bash
npm run main-agent-orchestration -- --cwd <project-root> --action inspect
```

如需生成正式派发计划，则读取：

```bash
npm run main-agent-orchestration -- --cwd <project-root> --action dispatch-plan
```

`dispatch-plan` 不是每次都要跑；只有 `inspect` 明确要求 materialize packet 时才执行。

### 4.4 只执行 Story 审计

```text
请使用 bmad-story-assistant 审计 E001-S001 的 Story 文档
```

---

## 5. 审计粒度配置

### 支持的模式

| 模式    | Story 创建 | 中间阶段 | 实施后 | 适用场景                    |
| ------- | ---------- | -------- | ------ | --------------------------- |
| `full`  | 审计       | 全部审计 | 审计   | 高风险变更，最大化门控      |
| `story` | 审计       | 基础验证 | 审计   | 减少中间审计成本，保留闭环  |
| `epic`  | 不审计     | 不审计   | 不审计 | 大 Epic 下多 Story 批量推进 |

### 优先级

1. CLI 参数：`--audit-granularity=full`
2. 环境变量：`BMAD_AUDIT_GRANULARITY=story`
3. 项目配置：`_bmad/_config/bmad-story-config.yaml`
4. 默认值：`full`

### 使用示例

```text
请使用 bmad-story-assistant 启动 E001-S001 --audit-granularity=story
```

可与 `--continue` 组合：

```text
请使用 bmad-story-assistant 继续 E001-S001 --audit-granularity=story --continue
```

### 配置文件

`_bmad/_config/bmad-story-config.yaml`：

```yaml
audit_granularity:
  mode: 'full'

auto_continue:
  enabled: false
  require_ready_flag: true
  require_next_action: true
```

---

## 6. 关键文件

### 通用

| 文件                                                              | 说明                                                                                                                                                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_bmad/_config/bmad-story-config.yaml`                            | 审计粒度、auto-continue 配置                                                                                                                                                       |
| `_bmad/skills/bmad-party-mode/workflow.md`                        | Party-Mode canonical skill 工作流（旧规则兼容路径：`_bmad/core/workflows/party-mode/workflow.md`）                                                                                 |
| `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` | Create Story 工作流                                                                                                                                                                |
| `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`    | Dev Story 工作流                                                                                                                                                                   |
| `_bmad/_config/agent-manifest.csv`                                | Agent 清单                                                                                                                                                                         |
| `runAuditorHost` / `scripts/run-auditor-host.ts`                  | 审计通过后的统一 host-runner 能力；由 invoking host/runner 承接评分写入、auditIndex 更新与 post-audit automation。脚本路径主要用于仓库内实现与调试说明，不是面向最终使用者的主入口 |
| `scripts/bmad-config.ts`                                          | 配置加载                                                                                                                                                                           |

### Cursor 专属

| 文件                                           | 说明                     |
| ---------------------------------------------- | ------------------------ |
| `.cursor/skills/bmad-story-assistant/SKILL.md` | Skill 入口               |
| `.cursor/agents/code-reviewer.md`              | runtime reviewer carrier |
| `.cursor/agents/code-reviewer-config.yaml`     | Code Reviewer 配置       |
| `.cursor/rules/bmad-story-assistant.mdc`       | 自检规则                 |

### Claude Code 专属

| 文件                                           | 说明                                     |
| ---------------------------------------------- | ---------------------------------------- |
| `.claude/skills/bmad-story-assistant/SKILL.md` | Claude Code skill 入口（当前仓库已提供） |
| `.claude/agents/code-reviewer.md`              | runtime reviewer carrier                 |
| `.claude/agents/bmad-master.md`                | 总控 Agent                               |
| `.claude/agents/bmad-story-create.md`          | Story Create Agent                       |
| `.claude/agents/bmad-story-audit.md`           | Story Audit Agent                        |
| `.claude/state/stories/*-progress.yaml`        | Story 状态                               |

---

## 7. handoff / state 协作

### handoff 关键字段

- `layer`、`stage`：当前位置
- `artifacts`：产出文件列表
- `next_action`、`ready`：子阶段推荐结果，可保留为 legacy 阶段语义
- `mainAgentNextAction`、`mainAgentReady`：主 Agent 的 compatibility summary；若 repo-native orchestration surface 不可用，才回退读取这组字段
- `iteration_count`：审计迭代计数

### 基本原则

- 未通过审计 = 阶段未完成
- 通过审计后才允许推进 state
- `next_action` 只是阶段推荐；若 repo-native orchestration surface 不可用，是否自动继续才回退取决于 `mainAgentNextAction` / `mainAgentReady`
- 默认不隐式连跑
- interactive 模式下的下一步执行始终由 **主 Agent** 决定；hook / queue / worker 只能提供 gate 与 state，不得直接替主 Agent 推进阶段
- `auto_continue.require_next_action` / `require_ready_flag` 仍保留 legacy 配置名，但应绑定到归一化后的主 Agent handoff 字段
- 若 `main-agent-orchestration` surface 可用，主 Agent 必须优先消费该 surface；`handoff` 只能作为兼容兜底，不是主控真相源

---

## 8. 常用恢复方式

| 操作             | 命令                                                                              |
| ---------------- | --------------------------------------------------------------------------------- |
| 查看主控 surface | `npm run main-agent-orchestration -- --cwd <project-root> --action inspect`       |
| 生成派发计划     | `npm run main-agent-orchestration -- --cwd <project-root> --action dispatch-plan` |
| 手动继续         | `请使用 bmad-story-assistant 继续 E001-S001`                                      |
| 自动续跑         | `... 继续 E001-S001 --continue`                                                   |
| 查看 Story 列表  | `@bmad-master list stories`（Claude Code）                                        |
| 切换 Story       | `@bmad-master 切换到 E001-S002`（Claude Code）                                    |

---

## 9. 使用建议

1. 把 `bmad-story-assistant` 当作统一入口，不要手动跳过 stage
2. 默认不要打开 auto-continue，除非明确想让流程根据主 Agent surface 串跑
3. 每次中断恢复时优先看 state 和 handoff，不要靠记忆判断当前阶段
4. 把审计看成门控，不是可选装饰
5. 如果命中 implementation-entry / readiness blocker，应由主 Agent 读取 orchestration state 与 packet，再决定派哪个子代理继续，而不是依赖后台自动推进
6. 当主 Agent 需要 claim / dispatch / complete / invalidate 时，优先使用 `npm run main-agent-orchestration -- --action <...>`；`runAuditorHost` 只用于 post-audit close-out

---

## 10. 相关测试

```bash
npx vitest run tests/acceptance/bmad-config.test.ts
npx vitest run tests/acceptance/accept-bmad-master.test.ts
npx vitest run tests/acceptance/accept-bmad-master-auto-continue.test.ts
npx vitest run tests/acceptance/accept-layer4.test.ts
```

---

## 11. 相关文档

- [架构概述](../explanation/architecture.md) — 五层架构与 Speckit 工作流
- [Party-Mode](../explanation/party-mode.md) — 多角色辩论机制
- [Agent 参考](../reference/agents.md) — Agent 定义
- [配置参考](../reference/configuration.md) — bmad-story-config.yaml 详解
- [Speckit Governance](../reference/speckit-governance.md) — risk tier、owner、exception 与默认 gate
- [Speckit Done Standards](../reference/speckit-done-standards.md) — Layer 4 各阶段退出标准
- [Speckit Exception Log Template](../reference/speckit-exception-log-template.md) — 需要跳过 gate 或延期证明时的记录模板
- [Speckit Rollout Playbook](./speckit-rollout-playbook.md) — 如何把 journey-first 治理作为团队默认做法推广
- [Good PRD Contract Example](../examples/speckit-contracts/good-prd-contract.md) — 什么样的 PRD contract 能真正驱动后续阶段
- [Good Architecture Contract Example](../examples/speckit-contracts/good-architecture-contract.md) — 什么样的 architecture contract 能承接 P0 journey
- [Good Smoke E2E Example](../examples/speckit-contracts/good-smoke-e2e.md) — smoke proof 应该证明什么、如何定义边界
- [入门教程](../tutorials/getting-started.md) — 安装与第一次使用
