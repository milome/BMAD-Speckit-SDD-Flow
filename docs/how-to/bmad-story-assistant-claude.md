# BMAD Story Assistant 使用说明

## 1. 入口定位（先看这一节）

**本文档介绍的是本仓 `Claude Code CLI / OMC` 适配版 `bmad-story-assistant`。**

也就是说，这里说明的是：

- `.claude/skills/bmad-story-assistant/SKILL.md`
- 与 `.claude/agents/bmad-master.md`、`.claude/agents/bmad-story-create.md`、`.claude/agents/bmad-story-audit.md` 等执行体协作的版本

它**不是** Cursor 运行时里的同名 skill 使用说明。虽然两者同名，且共享很多流程语义，但运行时入口、调用方式、状态接线和执行器映射并不完全相同。

### Claude 版与 Cursor 版的关系

可以这样区分：

- **Claude 版 `bmad-story-assistant`**：本仓当前正在使用和维护的适配版，负责把 Cursor 的流程语义映射到 Claude Code CLI / OMC 运行时
- **Cursor 版 `bmad-story-assistant`**：上游/同名参考 skill，仍然需要单独编写它自己的使用说明，不应与本文档混写

### 当前推荐入口

对于本仓的 Story 级 BMAD 工作流，**`bmad-story-assistant` 是推荐入口 skill**。

如果你的目标是：

- 新建一个 Story
- 审计一个 Story
- 继续一个中断的 Story 流程
- 让 Story 从文档阶段推进到实现与 Post Audit

那么应当优先从 `bmad-story-assistant` 的语义入口来理解和使用整个流程。

`bmad-master` 不是和它平级竞争的入口，而是它背后的**总控 / 路由 / 门控执行机制**。可以这样理解：

- **`bmad-story-assistant`**：用户视角的 Story 工作流入口
- **`bmad-master`**：运行时视角的状态机、门控器和路由器

所以，本文档不是在介绍一个普通辅助 skill，而是在介绍**本仓 Claude 版 Story 级 BMAD 工作流的主入口**。

---

## 2. 快速开始

### 最常见的使用目标

你通常会把 `bmad-story-assistant` 用在这几类场景：

1. 从 Epic 中启动一个新的 Story
2. 对已生成的 Story 继续后续阶段
3. 从中断点恢复已有 Story
4. 显式使用 `--continue` 让系统根据 handoff 自动续跑

### 推荐入口方式

最典型的使用方式是通过 Story 流程入口语义启动，然后由 `bmad-master` 接管状态与路由：

```text
@bmad-master 启动新 Story
Epic: E001
Story: S001
Slug: email-validator
需求：实现邮箱格式验证函数
```

继续已有 Story：

```text
@bmad-master 继续 E001-S001
```

显式启用自动续跑：

```text
@bmad-master 继续 E001-S001 --continue
```

如果你只记住一件事，请记住：

> **Story 流程应该以 `bmad-story-assistant` 作为概念入口来理解，以 `bmad-master` 作为实际总控来执行。**

---

## 3. 用户如何直接使用 `bmad-story-assistant`

这一节回答一个最实际的问题：

> 如果我是用户，而不是维护者，我该如何直接把 `bmad-story-assistant` 当入口来用？

### 3.1 在 Claude Code CLI 中的直接使用方式

在 Claude Code CLI 里，`bmad-story-assistant` 作为 skill 使用时，通常是通过 slash command / skill 入口触发。实际对话中，你可以直接表达 Story 级需求，由系统按 skill 语义接管；也可以明确提到你要使用 `bmad-story-assistant`。

典型表达方式如下。

#### 示例 1：启动一个新的 Story

```text
请使用 bmad-story-assistant 启动一个新的 Story。
Epic: E001
Story: S001
Slug: email-validator
需求：实现邮箱格式验证函数
```

#### 示例 2：继续已有 Story

```text
请使用 bmad-story-assistant 继续 E001-S001
```

#### 示例 3：继续并允许自动续跑

```text
请使用 bmad-story-assistant 继续 E001-S001 --continue
```

#### 示例 4：只执行 Story 审计

```text
请使用 bmad-story-assistant 审计 E001-S001 的 Story 文档
```

### 3.2 与 `@bmad-master` 的关系

你也会在实际仓库中看到很多示例直接写成：

```text
@bmad-master 启动新 Story
@bmad-master 继续 E001-S001
```

这并不表示应该绕开 `bmad-story-assistant` 来理解流程，而是因为：

- `bmad-story-assistant` 提供的是**用户入口语义**
- `bmad-master` 提供的是**执行层总控语义**

换句话说：

- 从“怎么使用这个 Story 工作流”角度看，入口应理解为 `bmad-story-assistant`
- 从“最终由谁做状态路由和门控”角度看，执行核心是 `bmad-master`

### 3.3 `--continue` 的命令行示例

`--continue` 用于显式告诉运行时：

- 如果 handoff 已就绪
- 且 `next_action` 存在
- 且 `ready: true`

那么允许系统继续自动推进下一阶段。

命令示例：

```text
请使用 bmad-story-assistant 继续 E001-S001 --continue
```

或等价地：

```text
@bmad-master 继续 E001-S001 --continue
```

### 3.4 不带 `--continue` 时会发生什么

如果你这样输入：

```text
请使用 bmad-story-assistant 继续 E001-S001
```

而当前 handoff/state 中已经有：

- `next_action`
- `ready: true`

系统**默认不会隐式自动连跑**，而是：

- 读取当前 state
- 解析当前阶段
- 告诉你推荐的下一步
- 等待你确认，或者让你显式使用 `--continue`

这也是当前设计里最重要的保护之一。

### 3.5 适合用户直接说的话

如果你不想记住精确格式，也可以直接用自然语言说：

```text
请用 bmad-story-assistant 帮我从 E001-S001 继续，并在允许时自动推进到下一阶段。
```

```text
请用 bmad-story-assistant 新建一个 Story，Epic 是 E002，Story 是 S003。
```

```text
请用 bmad-story-assistant 只做 Story Audit，不进入开发阶段。
```

系统应当把这些表达映射回统一的 Story workflow 入口。

---

### 3.6 审计粒度配置的输入示例（`bmad-story-assistant` 与 `@bmad-master`）

除了 `--continue` 之外，用户还经常需要显式指定**审计粒度模式**。当前支持的模式为：

- `full`
- `story`
- `epic`

它们分别决定：

- 哪些阶段必须执行完整审计
- 哪些阶段只做验证
- 哪些阶段可以跳过 Story 级审计，改由 Epic 级审计接管

#### `full` 模式

适用场景：

- 希望每个阶段都严格审计
- 当前 Story 变更风险高
- 想最大化流程门控

**使用 `bmad-story-assistant` 的示例：**

```text
请使用 bmad-story-assistant 启动 E001-S001，并使用 --audit-granularity=full
```

```text
请使用 bmad-story-assistant 继续 E001-S001 --audit-granularity=full --continue
```

**使用 `@bmad-master` 的示例：**

```text
@bmad-master 启动新 Story
Epic: E001
Story: S001
Slug: email-validator
需求：实现邮箱格式验证函数
--audit-granularity=full
```

```text
@bmad-master 继续 E001-S001 --audit-granularity=full --continue
```

#### `story` 模式

适用场景：

- 希望保留 Story 创建与实施后审计
- 中间 specify/plan/gaps/tasks/implement 阶段只做验证
- 想减少中间阶段审计成本，但保留 Story 级闭环

**使用 `bmad-story-assistant` 的示例：**

```text
请使用 bmad-story-assistant 启动 E001-S001，并使用 --audit-granularity=story
```

```text
请使用 bmad-story-assistant 继续 E001-S001 --audit-granularity=story
```

**使用 `@bmad-master` 的示例：**

```text
@bmad-master 启动新 Story
Epic: E001
Story: S001
Slug: email-validator
需求：实现邮箱格式验证函数
--audit-granularity=story
```

```text
@bmad-master 继续 E001-S001 --audit-granularity=story
```

#### `epic` 模式

适用场景：

- 希望把主要审计压力集中到 Epic 级
- Story 中间阶段以文档生成/测试验证为主
- 适合大 Epic 下多个 Story 批量推进

**使用 `bmad-story-assistant` 的示例：**

```text
请使用 bmad-story-assistant 启动 E001-S001，并使用 --audit-granularity=epic
```

```text
请使用 bmad-story-assistant 继续 E001-S001 --audit-granularity=epic
```

**使用 `@bmad-master` 的示例：**

```text
@bmad-master 启动新 Story
Epic: E001
Story: S001
Slug: email-validator
需求：实现邮箱格式验证函数
--audit-granularity=epic
```

```text
@bmad-master 继续 E001-S001 --audit-granularity=epic
```

### 3.7 审计粒度的优先级

审计粒度配置的优先级如下：

1. CLI 参数：`--audit-granularity=...`
2. 环境变量：`BMAD_AUDIT_GRANULARITY=...`
3. 项目配置：`config/bmad-story-config.yaml`
4. 默认值：`full`

这意味着：

- 如果配置文件里写的是 `story`
- 但你在命令里显式写了 `--audit-granularity=epic`

那么本次运行以 `epic` 为准。

### 3.8 配置文件示例

如果你希望项目默认采用某个粒度模式，可以在：

- `config/bmad-story-config.yaml`

中设置，例如：

```yaml
audit_granularity:
  mode: "story"
```

如果需要临时覆盖它，就在命令里显式加：

```text
请使用 bmad-story-assistant 继续 E001-S001 --audit-granularity=full
```

或：

```text
@bmad-master 继续 E001-S001 --audit-granularity=full
```

### 3.9 与 `--continue` 组合使用

审计粒度与 `--continue` 可以组合使用：

```text
请使用 bmad-story-assistant 继续 E001-S001 --audit-granularity=story --continue
```

```text
@bmad-master 继续 E001-S001 --audit-granularity=story --continue
```

这表示：

- 本次运行采用 `story` 审计粒度
- 如果 handoff 已满足 `next_action + ready=true`
- 且 auto-continue 已被本次命令显式启用
- 则允许继续自动推进下一阶段

---

## 4. 简介

`bmad-story-assistant` 是本仓在 Claude Code CLI / OMC 环境中的统一 Story 编排入口，用于把一个 Story 从创建、审计、开发到实施后审计串成可恢复、可审计、可追踪的完整流程。

它的职责不是单纯调用某一个 agent，而是统一协调以下能力：

- Story 创建（Create Story）
- Story 审计（Story Audit）
- Layer 4 文档/实现阶段推进
- 实施后审计（Post Audit）
- handoff / state / score / commit gate 集成
- 失败回环与恢复续跑

如果你把它理解成“Story 工作流总入口”，这个理解是对的。

---

## 2. 它解决什么问题

在没有统一入口时，Story 流程容易出现这些问题：

- Stage 之间切换靠人工记忆，容易跳步骤
- 审计通过与否没有统一 gate
- Story 文档、实现代码、审计报告之间不可追溯
- 中断后不知道该从哪一阶段恢复
- `next_action`、`ready`、handoff、state 文件没有被一致使用

`bmad-story-assistant` 的目标，就是把这些“靠人脑记”的流程规则固化为一致的运行约束。

---

## 3. 核心阶段总览

标准 Story 流程如下：

1. **Stage 1: Create Story**
2. **Stage 2: Story Audit**
3. **Stage 3: Dev Story / Layer 4 执行**
4. **Stage 4: Post Audit**
5. **Commit Gate / 后续收尾**

简化理解：

- 先产出 Story 文档
- 再审 Story 文档
- 再进入实现或文档型执行
- 完成后必须做 Post Audit
- 审计通过后才能进入 commit gate

---

## 4. 相关核心文件

### Skill 与总控

- Skill 入口：`.claude/skills/bmad-story-assistant/SKILL.md`
- 总控 Agent：`.claude/agents/bmad-master.md`

### Story 阶段执行体

- Story Create：`.claude/agents/bmad-story-create.md`
- Story Audit：`.claude/agents/bmad-story-audit.md`

### Layer 4 / 实施相关执行体

- Dev Story：`.claude/agents/speckit-implement.md`
- Layer 4 implement：`.claude/agents/layers/bmad-layer4-speckit-implement.md`

### 审计相关执行体

- implement 审计：`.claude/agents/auditors/auditor-implement.md`
- document 审计：`.claude/agents/auditors/auditor-document.md`

### 配置与状态

- 配置文件：`config/bmad-story-config.yaml`
- 示例配置：`config/bmad-story-config.example.yaml`
- 全局状态：`.claude/state/bmad-progress.yaml`
- Story 状态：`.claude/state/stories/*-progress.yaml`

### 评分与检查脚本

- 评分写入：`scripts/parse-and-write-score.ts`
- score 检查：`scripts/check-story-score-written.ts`
- 配置加载：`scripts/bmad-config.ts`

---

## 5. 最常见使用方式

### 5.1 启动一个新的 Story

最典型的入口是通过 `bmad-master` 启动：

```text
@bmad-master 启动新 Story
Epic: E001
Story: S001
Slug: email-validator
需求：实现邮箱格式验证函数
```

或在继续已有上下文时：

```text
@bmad-master 继续 E001-S001
```

如果当前 state / handoff 已经存在，`bmad-master` 会决定是：

- 进入 Create Story
- 进入 Story Audit
- 继续 Layer 4
- 进入 Post Audit
- 进入 commit gate

---

## 6. Stage 1：Create Story

### 用途

Create Story 阶段负责生成标准 Story 文档，并把流程推进到 Story Audit。

### 输入

通常需要：

- `epic_num`
- `story_num`
- `epic_slug`
- `story_slug`
- `project_root`

### 关键规则

- 先检查 `sprint-status.yaml`（如适用）
- 必须使用完整 `STORY-A1-CREATE` 模板
- 禁止模糊措辞和 Story 禁止词
- 遇到多方案 / trade-off / 歧义时，必须进入 party-mode

### 产物

典型输出路径：

```text
_bmad-output/implementation-artifacts/epic-{epic_num}-{epic_slug}/story-{epic_num}-{story_num}-{story_slug}/{epic_num}-{story_num}-{story_slug}.md
```

### 完成后状态

- state 更新为 `story_created`
- handoff 到 `bmad-story-audit`

---

## 7. Stage 2：Story Audit

### 用途

Story Audit 负责验证 Story 文档是否足够完整、明确、可追溯，并决定是否允许进入 Dev Story。

### 关键检查项

至少包括：

1. Story 是否覆盖原始需求
2. 是否存在禁止词
3. 多方案问题是否已经收敛
4. 是否存在技术债/占位表述
5. `由 Story X.Y 负责` 是否真实存在且 scope 匹配

### 严格度

- `standard`：一般场景
- `strict`：缺少 party-mode 产物或用户明确要求时

### 通过后

- 触发 `parse-and-write-score.ts`
- state 更新为 `story_audit_passed`
- handoff 到 Layer 4 / Dev Story

### 失败后

- state 更新为 `story_audit_failed`
- 要求修 Story 文档并重新审计

---

## 8. Stage 3：Dev Story / Layer 4

### 用途

该阶段负责把 Story 进一步推进到可执行的实现流程，包含：

- specify
- plan
- gaps
- tasks
- implement

### 核心要求

- 必须遵守 TDD（RED → GREEN → REFACTOR）
- 必须维护 `prd.json` 和 `progress.txt`（ralph-method 产物）
- 不允许在未通过前置门控时直接实现

### Story 类型分支

在 `tasks_passed` 之后，`bmad-master` 会根据任务内容决定：

- **代码型 Story** → route 到 `implement`
- **文档型 Story** → route 到 `document_audit`

这一步是 Story 类型检测的重要路由点。

---

## 9. Stage 4：Post Audit

### 用途

Post Audit 是强制门控，不管是代码型 Story 还是文档型 Story，都必须经过这一层。

### 两种模式

#### Code 模式

适用于代码实现型 Story：

- 检查实现是否覆盖 tasks / spec / plan
- 检查 TDD 证据
- 检查 ralph-method 追踪文件
- 检查质量、安全性、测试覆盖

#### Document 模式

适用于文档验证型 Story：

- 检查 Story 文档结构
- 检查 tasks 是否全部完成
- 检查一致性与可追溯性
- 审计子代理可以直接修改文档

### 通过后

- 执行 `parse-and-write-score.ts`
- 更新最终审计状态
- handoff 到 commit gate

### 失败后

- 回到修复阶段继续迭代
- 不允许进入 commit gate

---

## 10. handoff / state 是怎么协作的

### handoff 的关键字段

最常见字段包括：

- `layer`
- `stage`
- `artifacts`
- `reportPath`
- `iteration_count`
- `next_action`
- `ready`

### state 的关键文件

- 全局：`.claude/state/bmad-progress.yaml`
- Story：`.claude/state/stories/{epic}-{story}-progress.yaml`

### 基本原则

- **未通过审计 = 阶段未完成**
- **通过审计后才允许推进 state**
- `next_action` 只是“推荐下一步”
- 是否自动继续，还要看 `auto_continue` 配置

---

## 11. `--continue` / auto-continue 机制

这是最近新增的重要能力。

### 背景

以前只要 handoff 中存在：

- `next_action`
- `ready: true`

`bmad-master` 就可能直接自动续跑。

现在改成：

> 只有显式启用 auto-continue，才允许自动推进。

### 支持的开启方式

#### CLI 参数

```text
@bmad-master 继续 E001-S001 --continue
```

#### 环境变量

```bash
BMAD_AUTO_CONTINUE=true
```

#### 配置文件

`config/bmad-story-config.yaml`

```yaml
auto_continue:
  enabled: true
  require_ready_flag: true
  require_next_action: true
```

### 当前默认值

默认是：

```yaml
auto_continue:
  enabled: false
```

也就是说，即使 handoff 已经准备好了，系统默认也不会隐式连跑。

### 自动推进的条件

必须同时满足：

1. `auto_continue.enabled === true`
2. `story_state.next_action` 存在
3. `story_state.ready === true`

否则只会输出：

- 建议下一步
- `follow_up`
- 手动继续命令提示

---

## 12. 配置文件怎么用

配置文件路径：

- `config/bmad-story-config.yaml`

它控制的重点包括：

### 12.1 审计粒度模式

- `full`
- `story`
- `epic`

#### full

所有阶段都审计。

#### story

- Story create / story audit / post audit 审计
- 中间阶段只做基础验证或 test-only 验证

#### epic

- Story 级阶段大多跳过审计
- 重点在 Epic 级创建 / 完成审计

### 12.2 auto_continue

用于控制是否允许根据 handoff 自动续跑。

---

## 13. 常用恢复方式

### 手动继续某个 Story

```text
@bmad-master 继续 E001-S001
```

### 显式允许自动续跑

```text
@bmad-master 继续 E001-S001 --continue
```

### 查看当前 Story 列表

```text
@bmad-master list stories
```

### 切换上下文

```text
@bmad-master 切换到 E001-S002
```

---

## 14. 什么时候会被拒绝继续

`bmad-master` 会在以下情况拒绝推进：

- 当前阶段审计未通过
- 缺少必要产物
- commit request 未经过审计
- Story 被其他 session 锁定
- strict convergence 尚未满足
- handoff 虽然 ready，但没有启用 auto-continue

这类拒绝是设计使然，不是异常。

---

## 15. 典型命令与建议

### 新建并推进 Story

```text
@bmad-master 启动新 Story
Epic: E001
Story: S001
Slug: string-validator
需求：实现字符串校验模块
```

### 手动恢复

```text
@bmad-master 继续 E001-S001
```

### 带自动续跑恢复

```text
@bmad-master 继续 E001-S001 --continue
```

### 查看状态

```text
@bmad-master list stories
```

---

## 16. 相关测试

如果你修改了 `bmad-story-assistant`、`bmad-master` 或配置逻辑，建议至少运行：

```bash
./node_modules/.bin/vitest.cmd run scripts/bmad-config.test.ts
./node_modules/.bin/vitest.cmd run scripts/accept-bmad-master.test.ts scripts/accept-bmad-master-auto-continue.test.ts
./node_modules/.bin/vitest.cmd run scripts/accept-bmad-*.test.ts
./node_modules/.bin/vitest.cmd run scripts/accept-layer4.test.ts
```

如果只验证 auto-continue 相关逻辑，至少运行：

```bash
./node_modules/.bin/vitest.cmd run scripts/bmad-config.test.ts
./node_modules/.bin/vitest.cmd run scripts/accept-bmad-master-auto-continue.test.ts
```

---

## 17. 使用建议

1. **把 `bmad-master` 当作统一入口**，不要手动跳过 stage。
2. **默认不要打开 auto-continue**，除非你明确想让流程根据 handoff 自动串跑。
3. **每次中断恢复时优先看 state 和 handoff**，不要靠记忆判断现在在哪一阶段。
4. **修改阶段协议时同步更新测试**，尤其是：
   - `scripts/bmad-config.test.ts`
   - `scripts/accept-bmad-master-auto-continue.test.ts`
   - `scripts/accept-bmad-*.test.ts`
5. **把审计看成门控，不是可选装饰**。

---

## 18. 一句话总结

`bmad-story-assistant` 是 Story 级 BMAD 工作流的统一编排入口；`bmad-master` 负责状态、门控和恢复，handoff 提供下一步建议，而是否自动续跑由 `auto_continue` 明确控制。
