# 运行时治理实现解析

> 本文档解释 BMAD / Speckit Runtime Governance 在本仓库中的**真实接入方式**：
> - upstream workflow / skill / agent 到底改了什么、没改什么
> - runtime context registry / runtime context / emit / hook 的职责分工
> - `full_bmad`、`seeded_solutioning`、`standalone_story` 三种 `sourceMode` 的完整调用链
>
> 结论先行：**本轮实现不是通过大范围修改 `_bmad` upstream workflow 定义本体来完成接入，而是通过 skill/agent 约束 + runtime 脚本层 + hook 注入层 + init 部署层来完成松耦合接入。**

---

## 1. 总体结论

Runtime Governance 的接入分成两层：

1. **上游语义层（_bmad）**
   - 给 skill / agent 增加“执行前必须已有 hook 注入的 Runtime Governance JSON”的约束
   - 不允许执行体手写/臆造 policy
   - 这一层是**执行前提约束**，不是 runtime 数据写入实现

2. **外围实现层（scripts + hooks + init）**
   - 用 `runtime-context.ts` / `runtime-context-registry.ts` 构建统一运行时真相源
   - 用 `emit-runtime-policy.ts` 统一消费 registry + activeScope + scoped context
   - 用 `runtime-policy-inject.js` 把 policy 注入到实际执行上下文中
   - 用 `init-to-root.js` 部署 `.claude/.cursor` hook 文件与 runtime emit/writer

因此，当前实现的本质是：

> **在现有 BMAD workflow 外围加了 runtime context / registry 的标准入口与消费契约，而不是把所有 upstream workflow 文件重写成“内嵌 runtime 写入调用”的版本。**

---

## 2. upstream workflow / skill / agent：哪些改了，哪些没改

### 2.1 没看到大范围“显式 runtime 写入调用”的 upstream workflow 本体

本轮检索了 `_bmad/**/workflow.{md,yaml,yml}`，重点覆盖：

- `_bmad/bmm/workflows/4-implementation/create-story/**`
- `_bmad/bmm/workflows/4-implementation/dev-story/**`
- `_bmad/bmm/workflows/4-implementation/sprint-planning/**`
- `_bmad/bmm/workflows/4-implementation/sprint-status/**`
- `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/**`

以及关键词：

- `runtime-context`
- `runtime-context-registry`
- `write-runtime-context`
- `emit-runtime-policy`
- `registry.json`
- `activeScope`
- ~~`BMAD_RUNTIME_CONTEXT_FILE`~~（已废弃；context 仅通过 registry + activeScope 解析）

**结果：** 没有看到这些 workflow 文件中大范围内联的 runtime 写入调用。

也就是说，本轮不是通过下面这种方式完成接入的：

```yaml
# 假设性示例（当前实现不是这种主路径）
- name: after create story
  run: node scripts/write-runtime-context.js ...
- name: update registry
  run: node scripts/runtime-context-registry.js ...
```

### 2.2 upstream 中实际改到的是“运行时治理前置约束”

这类修改出现在 `_bmad` 的 skill / agent / layer prompt 中。

#### A. `_bmad/claude/skills/speckit-workflow/SKILL.md`
核心内容：

- 执行本 skill 任一阶段前，必须已有由 **hook + `emit-runtime-policy`** 注入的 Runtime Governance JSON
- 契约来源绑定到：
  - `scripts/emit-runtime-policy.ts`
  - `.claude|cursor/hooks/emit-runtime-policy-cli.js`
- 禁止手写与 `resolveRuntimePolicy` 不一致的 policy

这意味着：

> `speckit-workflow` skill 被 runtime governance 作为**外部前置条件**接住了。

#### B. `_bmad/cursor/skills/speckit-workflow/SKILL.md`
同样把 hook 注入的 runtime governance JSON 作为 skill 执行前提。

#### C. `_bmad/core/agents/bmad-master.md`
增加了约束：

- 在执行依赖 speckit/bmad runtime policy 的 stage workflow 前，session 中必须已经有 hook 注入的「本回合 Runtime Governance（JSON）」

#### D. `_bmad/claude/agents/layers/bmad-layer4-speckit-specify.md`
增加了硬约束：

- 进入该阶段前，必须已有 hook/emit 注入的 Runtime Governance JSON

### 2.3 结论

所以，**upstream 确实改了，但改的是 skill/agent 层的“前置契约”，不是 workflow 本体里的 runtime 写入逻辑。**

---

## 2.4 `bmad-help` 引导链与真实切入点调查结论

本节专门回答：**如果用户是从 `bmad-help` 开始走 BMAD 全流程，runtime registry/context 应该在哪些真实切入点自动触发。**

### A. `bmad-help` 的真实角色

路径：
- `_bmad/skills/bmad-help/workflow.md`

调查结论：

- `bmad-help` 的角色是 **路由顾问 / 推荐器**，不是业务状态写入器。
- 它会：
  - 读取 `_bmad/_config/bmad-help.csv`
  - 识别用户当前所处 module / phase
  - 基于 artifacts / 已完成 workflow 推荐下一步
- 它**不会**直接承担 runtime registry/context 写入责任。

因此：

> `bmad-help` 更适合作为 **sourceMode / 路线识别起点**，但不适合作为具体 runtime 写入执行点。

### B. `bmad-master` 的真实角色

路径：
- `_bmad/core/agents/bmad-master.md`

调查结论：

- `bmad-master` 是顶层 orchestrator / menu executor。
- 它会：
  - 显示 menu
  - 列 workflow / task
  - 触发 Party Mode 等上层动作
- 当前已增加 Runtime Governance 前置约束：
  - 在执行依赖 runtime policy 的 stage workflow 前，session 中必须已有 hook 注入的「本回合 Runtime Governance（JSON）」
- 但它目前**不是**显式 runtime registry/context writer。

因此：

> `bmad-master` 适合作为 **全局调度层约束点**，不是细粒度 runtime 写入点。

### C. `bmad-story-assistant` 的真实角色

路径：
- `_bmad/claude/skills/bmad-story-assistant/SKILL.md`

调查结论：

- `bmad-story-assistant` 是 Story 生命周期统一入口。
- 它定义并协调：
  1. Create Story
  2. Story Audit
  3. Dev Story / `STORY-A3-DEV`
  4. Post Audit / `STORY-A4-POSTAUDIT`
  5. 失败回环
- 它的运行时契约中已经声明：
  - 维护 handoff / progress / state
  - hooks 不得替代主状态机决策
- 它还明确：
  - Dev Story 实施阶段会进入 `speckit-workflow` 的技术实现层

因此：

> 对于 story 级自动化，`bmad-story-assistant` 是**最关键的 Story 生命周期切入点**。

### D. `speckit-workflow` 的真实角色

路径：
- `_bmad/claude/skills/speckit-workflow/SKILL.md`

调查结论：

- `speckit-workflow` 不是 BMAD 全流程的最顶层入口，
  而是 `bmad-story-assistant` 的**技术实现层嵌套流程**。
- 它负责：
  - constitution → specify → plan → GAPS → tasks → implement
- 它已经要求：
  - 每个阶段执行前必须已有 hook 注入的 Runtime Governance JSON

因此：

> `speckit-workflow` 是 **dev_story 内部 workflowStage 切换点**，适合自动刷新 run context / workflowStage，但不适合作为 top-level sourceMode bootstrap 起点。

### E. `create-epics-and-stories` 的真实角色

路径：
- `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.md`

调查结论：

- 它是 solutioning → implementation 之间的重要桥梁。
- 它要求：
  - 先有 PRD / Architecture
  - 再生成 epics/stories
- 这意味着它非常适合：
  - 作为 `seeded_solutioning` 的首个“自动 bootstrap project registry/context”的入口
  - 以及生成 epic/story scope 的切入点

因此：

> 若用户从已有分析/架构直接进入后链，`create-epics-and-stories` 是 `seeded_solutioning` 最合理的自动触发起点。

### F. `create-story` 的真实角色

路径：
- `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`

调查结论：

- `create-story` 已经具备 story identity、story output path、sprint status、epics/planning artifacts 等关键输入。
- 因此它是：
  - `full_bmad` 下 story scope 建立的自然切点
  - `seeded_solutioning` 下 story context 首次物化的切点
  - `standalone_story` 下最小 story scope bootstrap 的候选切点

因此：

> `create-story` 应承担 **story context 自动生成 + activeScope 切到 story** 的职责。

### G. `dev-story` 的真实角色

路径：
- `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`

调查结论：

- `dev-story` 明确拥有：
  - `story_file`
  - `implementation_artifacts`
  - `sprint_status`
  - `project_context`
- 这说明它是 run 级执行最直接的入口。
- 进入 `dev-story` 时，系统应：
  - 自动建立新的 run context
  - activeScope 切到 run
  - 在内部 `constitution/specify/plan/gaps/tasks/implement` 阶段切换时刷新 `workflowStage`

因此：

> `dev-story` 是 **run context 自动生成与 workflowStage 自动刷新的第一主入口**。

### H. `post-audit` 的真实切点

在 Story 链路中，post-audit 不应复用 dev-story 的 run identity，而应：

- 创建新的 post-audit run context
- activeScope 仍切到 run
- lifecycleStage = `post_audit`

### I. 最终切入点责任结论

把以上角色拼起来，当前最合理的自动触发责任链应是：

| 层级 | 组件 | 应承担职责 |
|---|---|---|
| 路线识别 | `bmad-help` / `bmad-master` | 识别路线与 `sourceMode`，但不直接写业务 runtime 状态 |
| solutioning 切入 | `create-epics-and-stories` | 对 `seeded_solutioning` 自动 bootstrap project registry/context |
| story 切入 | `create-story` / `bmad-story-assistant` | 自动生成 story context，切 `activeScope=story` |
| run 切入 | `dev-story` | 自动生成 run context，切 `activeScope=run` |
| dev_story 内部阶段 | `speckit-workflow` | 自动刷新 run context 的 `workflowStage` |
| 审计后阶段 | `post-audit` | 自动生成新的 post-audit run context |

### J. 对自动触发改造计划的直接影响

因此，`runtime-registry-context-auto-trigger-plan.md` 在补强时必须增加：

1. **Top-level route detection layer**
   - `bmad-help` / `bmad-master` 负责识别路线与 `sourceMode`
   - 但不直接承担 registry/context 业务写入

2. **Entry bootstrap layer**
   - `create-epics-and-stories`：`seeded_solutioning` bootstrap
   - `create-story`：story scope bootstrap
   - `dev-story`：run scope bootstrap
   - `post-audit`：new run bootstrap

3. **Internal stage refresh layer**
   - `speckit-workflow`：只负责 dev_story 内部 `workflowStage` 刷新

这意味着：

> 如果用户由 `bmad-help` 引导进入全流程，正确做法不是让用户手工知道什么时候补 context，而是由路线识别层先确定 `sourceMode`，再由各真实入口自动完成 project/story/run 级 runtime context registry 的生成与刷新。

---

## 3. 外围接入文件对照表

### 3.1 hooks 三层结构（当前已实现）

当前 runtime governance hooks 已从“单边 Claude 源 + Cursor 复用”演进为三层结构：

```text
_bmad/runtime/hooks/   ← shared canonical logic
_bmad/claude/hooks/    ← Claude adapter
_bmad/cursor/hooks/    ← Cursor adapter
```

#### shared canonical logic（已落地）
- `_bmad/runtime/hooks/runtime-policy-inject-core.js`
- `_bmad/runtime/hooks/run-emit-runtime-policy.js`
- `_bmad/runtime/hooks/should-skip-runtime-policy.js`
- `_bmad/runtime/hooks/build-runtime-error-message.js`

shared 层职责：
- 读取 stdin
- 判断 mode / host
- 推断 root
- 调 `emit-runtime-policy-cli`
- quiet skip / fail loud 分流
- 统一构造运行结果

shared 层**不直接承担**：
- Claude envelope 输出
- Cursor envelope 输出
- 业务 runtime state 伪造

#### Claude adapter（已落地）
- `_bmad/claude/hooks/runtime-policy-inject.js`

职责：
- 调 shared core
- 输出 Claude 路径需要的结果
- 自身不再承载全部共享逻辑

#### Cursor adapter（已落地）
- `_bmad/cursor/hooks/runtime-policy-inject.js`

职责：
- 调 shared core
- 输出 Cursor 路径需要的结果
- 自身不再承载全部共享逻辑

#### 部署副本
- `.claude/hooks/runtime-policy-inject.js`
- `.cursor/hooks/runtime-policy-inject.js`

这些仍然是部署副本，不是 canonical source。

### 3.2 部署规则（当前已实现）

`init-to-root.js` 当前的 hooks 部署规则已改为：

- `.claude/hooks/`
  - Claude adapter 来自 `_bmad/claude/hooks/`
  - shared helpers 由 shared/runtime 层提供给运行时目录
- `.cursor/hooks/`
  - 优先使用 `_bmad/cursor/hooks/` adapter
  - shared helpers 来自 `_bmad/runtime/hooks/`
  - adapter 缺失时才 fallback `_bmad/claude/hooks/`

这使得：
- Cursor 有自己的 canonical hook source
- Claude 有自己的 canonical hook source
- shared 层不再挂靠 Claude 目录

### 3.3 auto-trigger 与 hooks 的边界（当前已验证）

当前已明确的边界：

- auto-trigger project/story/run context：由 runtime helper / 真实业务入口负责
- hooks：只负责消费治理上下文或 quiet skip，不负责伪造业务 runtime state

相关验证：
- `runtime-policy-inject-auto-trigger-boundary.test.ts`
- `runtime-policy-inject.test.ts`
- `runtime-hooks-layering-contract.test.ts`
- `runtime-hooks-shared-core.test.ts`
- `runtime-hooks-claude-adapter.test.ts`
- `runtime-hooks-cursor-adapter.test.ts`
- `runtime-hooks-deploy-layering.test.ts`

## 4. runtime 真相源模型

下表列出当前真正承担 runtime 接入职责的路径：

| 路径 | 类型 | 职责 | 是否属于 upstream workflow 本体 |
|---|---|---|---|
| `scripts/runtime-context.ts` | 核心实现 | 定义/读写 scoped runtime context | 否 |
| `scripts/runtime-context-registry.ts` | 核心实现 | 定义/读写 registry、activeScope、scope 解析 | 否 |
| `scripts/emit-runtime-policy.ts` | 消费入口 | registry-first / context-first policy 消费 | 否 |
| `_bmad/runtime/hooks/runtime-policy-inject-core.js` | shared hooks core | stdin/root/emit/skip/error shared behavior | 否 |
| `_bmad/runtime/hooks/run-emit-runtime-policy.js` | shared helper | 统一 emit 调用 | 否 |
| `_bmad/runtime/hooks/should-skip-runtime-policy.js` | shared helper | 统一 quiet-skip 判定 | 否 |
| `_bmad/runtime/hooks/build-runtime-error-message.js` | shared helper | 统一错误文本构造 | 否 |
| `_bmad/claude/hooks/runtime-policy-inject.js` | Claude adapter | Claude 宿主 adapter | 否 |
| `_bmad/cursor/hooks/runtime-policy-inject.js` | Cursor adapter | Cursor 宿主 adapter | 否 |
| `_bmad/claude/hooks/emit-runtime-policy-cli.js` | hook CLI wrapper | 调 emit、查找 root/build 产物 | 否 |
| `_bmad/claude/hooks/runtime-policy-inject.js` | hook 注入入口 | 执行 emit 并把 policy JSON 注入上下文 | 否 |
| `.claude/hooks/runtime-policy-inject.js` | 部署副本 | Claude 本地 hook 部署版本 | 否 |
| `.cursor/hooks/runtime-policy-inject.js` | 部署副本 | Cursor 本地 hook 部署版本 | 否 |
| `scripts/init-to-root.js` | 部署/接线 | 把 hooks / emit / write-context 部署到宿主工程 | 否 |
| `docs/reference/runtime-context.md` | 契约文档 | 说明 runtime context 正式输入模型 | 否 |
| `docs/reference/cursor-runtime-governance-hooks.md` | 契约文档 | 说明 hook 注入与宿主挂载协议 | 否 |
| `docs/how-to/runtime-governance-auto-inject-cursor-claude.md` | how-to | 说明自动注入路径与上下文要求 | 否 |

---

## 4. runtime 真相源模型

### 4.1 registry

正式 registry 路径：

- `_bmad-output/runtime/registry.json`

由 `scripts/runtime-context-registry.ts` 负责维护。

结构核心字段：

- `projectRoot`
- `sources`
- `projectContextPath`
- `epicContexts`
- `storyContexts`
- `runContexts`
- `activeScope`

### 4.2 scoped context

正式 context 路径全部收敛到：

- project: `_bmad-output/runtime/context/project.json`
- epic: `_bmad-output/runtime/context/epics/{epicId}.json`
- story: `_bmad-output/runtime/context/stories/{epicId}/{storyId}.json`
- run: `_bmad-output/runtime/context/runs/{epicId}/{storyId}/{runId}.json`

### 4.3 activeScope

policy 消费不再猜测上下文，而是通过：

1. 读 `registry.json`
2. 看 `activeScope`
3. 定位实际 context 文件
4. 从 context 中拿 `flow/stage/templateId/identity`

### 4.4 no fallback 原则

当前已经落地：

- 不再 fallback `.bmad/runtime-context.json`
- `.speckit-state.yaml` 已完全移除，不再作为 runtime context
- 无上下文时 fail loud
- 非 BMAD 项目下 hook 注入层静默跳过，不制造噪声

---

### 4.5 已实现的 auto-trigger helper（当前状态）

当前已经落地的统一入口 helper：

- `detectRuntimeSourceMode(root, hints?)`
- `ensureProjectRuntimeContext(root, options?)`
- `ensureStoryRuntimeContext(root, options)`
- `ensureRunRuntimeContext(root, options)`

当前已验证行为：

- `ensureProjectRuntimeContext(...)`
  - 在 `full_bmad + sprint-status` 条件下自动写 project context + project registry
- `ensureStoryRuntimeContext(...)`
  - 在 `seeded_solutioning` / `standalone_story` 下自动写 story context，并切 `activeScope=story`
- `ensureRunRuntimeContext(...)`
  - 在 `standalone_story` 下自动写 run context 记录，并切 `activeScope=run`
- `init-to-root.js`
  - init 时自动写最小 project context + 最小 registry
- `runtime-policy-inject.js`
  - 非 BMAD 项目下静默跳过，不伪造业务 runtime state

这意味着当前系统已经从“只有消费链严格”前进到“部分入口自动触发已落地”，但仍未完成所有真实入口的 fully automatic 下沉。

### 4.6 当前自动化边界

当前自动化边界如下：

1. **已自动化**
   - init bootstrap project context + registry
   - helper 层 project/story/run 统一入口
   - hook 在非 BMAD 项目下 quiet skip

2. **部分自动化**
   - `full_bmad`：project bootstrap 已可通过 helper 驱动，真实 workflow 本体接线仍待补齐
   - `seeded_solutioning`：story bootstrap 已可通过 helper 驱动，真实入口链仍待补齐
   - `standalone_story`：story/run bootstrap 已可通过 helper 驱动，story lifecycle 真入口仍待补齐

3. **尚未 fully automatic**
   - 把 `sprint-planning` / `sprint-status` / `create-epics-and-stories` / `create-story` / `dev-story` / `post-audit` 的真实入口全部改造成自动触发点

---

## 5. 当前实际接入链路

### 5.1 运行时产物如何被构建

#### Project 级
来自：
- `sprint-status.yaml`

构建函数：
- `buildProjectRegistryFromSprintStatus(...)`
- `writeRuntimeContextFromSprintStatus(...)`

#### Epic 级
来自：
- `sprint-status.yaml` 中的 epic entries

构建函数：
- `buildEpicContextsFromSprintStatus(...)`

#### Story 级
来自：
- `sprint-status.yaml` 中的 story entries
- story artifact root
- specs root

构建函数：
- `buildStoryContextsFromSprintStatus(...)`

#### Run 级
来自：
- story lifecycle/run identity
- workflowStage / lifecycleStage

构建函数：
- `buildRunContext(...)`

### 5.2 policy 如何消费这些产物

消费入口：
- `scripts/emit-runtime-policy.ts`

消费顺序：

1. 先看 CLI 参数：`--flow --stage`
2. 再看 env：`BMAD_RUNTIME_FLOW / BMAD_RUNTIME_STAGE`
3. 若不足，则读 registry：
   - `readRuntimeContextRegistry(root)`
   - `resolveActiveScope(...)`
   - `resolveContextPathFromActiveScope(...)`
4. 读对应 context file：
   - `readRuntimeContext(root)`
5. 提取 identity：
   - `epicId`
   - `storyId`
   - `storySlug`
   - `runId`
   - `artifactRoot`
6. 调 `resolveRuntimePolicy(...)`
7. 输出稳定 JSON

### 5.3 policy 如何注入执行上下文

入口：
- `runtime-policy-inject.js`

步骤：
1. 读取 stdin hook payload
2. 推断 root
3. 调 `emit-runtime-policy-cli.js`
4. 若成功：输出 JSON block 到 `systemMessage` / `additionalContext`
5. 若失败：
   - BMAD 项目内 → fail loud
   - 非 BMAD 项目内（`--cursor-host` 且 root 下无 `_bmad`）→ quiet skip

---

## 6. 三种 `sourceMode` 的完整 Runtime Governance 调用链

下面按 `sourceMode` 逐条画出当前实现链路。

---

## 6.1 `full_bmad`

### 适用场景

完整 BMAD 项目主链：
- sprint planning / sprint status
- create epics and stories
- create story
- dev story
- post audit

### 输入事实源

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- epics / story artifacts / specs
- run identity（story_create / story_audit / dev_story / post_audit）

### 调用链

```text
BMAD workflow 产出事实
  ├─ sprint-status.yaml
  ├─ story artifacts
  ├─ specs
  └─ run identity
        ↓
[scripts/runtime-context-registry.ts]
  ├─ buildProjectRegistryFromSprintStatus()
  ├─ buildEpicContextsFromSprintStatus()
  ├─ buildStoryContextsFromSprintStatus()
  ├─ buildRunContext()
  └─ writeRuntimeContextRegistry()
        ↓
registry.json + activeScope + scoped context paths
        ↓
[scripts/runtime-context.ts]
  ├─ writeRuntimeContextFromSprintStatus()
  └─ writeRuntimeContext(...run/project/story payload...)
        ↓
_bmad-output/runtime/context/.../*.json
        ↓
[scripts/emit-runtime-policy.ts]
  ├─ readRuntimeContextRegistry()
  ├─ resolveActiveScope()
  ├─ resolveContextPathFromActiveScope()
  ├─ readRuntimeContext()
  └─ resolveRuntimePolicy()
        ↓
stable policy JSON
        ↓
[_bmad/.claude/.cursor hooks/runtime-policy-inject.js]
        ↓
systemMessage / additionalContext 注入执行体
```

### 生命周期阶段映射

- `story_create`
- `story_audit`
- `dev_story`
  - `constitution`
  - `specify`
  - `plan`
  - `gaps`
  - `tasks`
  - `implement`
- `post_audit`

### 当前实现特点

- 覆盖最完整
- run-first / registry-first 已有 fresh 证据
- 生命周期与 workflowStage 双层模型已经打通

---

### `full_bmad` 逐入口自动触发核对表

| 入口 | 入口文件 | 现有输入事实 | 当前 helper/消费能力 | workflow 本体是否已显式自动写入 runtime registry/context | 结论 |
|---|---|---|---|---|---|
| `bmad-help` | `_bmad/skills/bmad-help/workflow.md` | module / phase / artifact 检测 | 无直接 writer，仅负责推荐下一步 | 否 | **路线识别起点**，不应直接写业务 runtime 状态 |
| `bmad-master` | `_bmad/core/agents/bmad-master.md` | menu / workflow orchestration / governance 前置约束 | 有治理前置约束，但无 writer | 否 | **全局协调入口**，不应承担细粒度 context 写入 |
| `sprint-planning` | `_bmad/bmm/workflows/4-implementation/sprint-planning/workflow.yaml` | `implementation_artifacts`、`planning_artifacts`、`status_file`、`epics_location` | `buildProjectRegistryFromSprintStatus()`、`writeRuntimeContextFromSprintStatus()` 可消费其输出 | 未见显式调用 | **应成为 project bootstrap 的第一真实入口** |
| `sprint-status` | `_bmad/bmm/workflows/4-implementation/sprint-status/workflow.yaml` | `sprint_status_file` | 同上，可驱动 project registry/context refresh | 未见显式调用 | **应成为 project refresh 入口** |
| `create-epics-and-stories` | `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.md` | PRD / Architecture / branch-scoped planning outputs | 可作为 epic/story scope 构建起点 | 未见显式调用 | **应成为 full_bmad 中 epic/story bootstrap 入口** |
| `create-story` | `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` | `sprint_status`、`epics_file`、`story output path`、planning artifacts | story context helper 已具备 | 未见显式调用 | **应承担 story context 物化 + activeScope=story** |
| `bmad-story-assistant` | `_bmad/claude/skills/bmad-story-assistant/SKILL.md` | Story 生命周期阶段定义、handoff/state 约束 | 适合承接 story lifecycle routing | 不是 workflow 本体 | **story 生命周期总协调器，应驱动 create-story/dev-story/post-audit 的自动触发责任** |
| `dev-story` | `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml` | `story_file`、`implementation_artifacts`、`sprint_status`、`project_context` | `buildRunContext()` + run-first consumption 已成熟 | 未见显式调用 | **应承担 run context 创建 + activeScope=run** |
| `speckit-workflow` | `_bmad/claude/skills/speckit-workflow/SKILL.md` | dev_story 内部 constitution/specify/plan/gaps/tasks/implement 语义 | workflowStage 刷新链已可消费 | 不是 workflow 本体 | **只应负责 dev_story 内部 workflowStage refresh** |
| `post-audit` | 由 story lifecycle 后续审计阶段承接 | post-audit run identity | run-first consumption 已成熟 | 未见 workflow 本体显式调用 | **应创建新的 post-audit run context，不能复用 dev-story run** |

### `full_bmad` 逐入口详细流程解释

#### 1. `bmad-help` → `bmad-master`

- `bmad-help` 负责识别当前模块、phase、已完成 artifacts，并推荐下一步。
- `bmad-master` 负责菜单式调度和 workflow 触发，并且已经要求执行前上下文中必须存在 hook 注入的 Runtime Governance JSON。
- 这两个入口都属于 **路线识别/全局协调层**。

当前结论：

- 它们应该决定“当前正在走 `full_bmad` 主链”，
- 但**不应**直接承担 registry/context 业务写入。

#### 2. `sprint-planning` / `sprint-status`

从 `workflow.yaml` 可见：
- `sprint-planning` 已显式掌握：
  - `implementation_artifacts`
  - `planning_artifacts`
  - `status_file = {implementation_artifacts}/sprint-status.yaml`
- `sprint-status` 已显式掌握：
  - `sprint_status_file = {implementation_artifacts}/sprint-status.yaml`

这说明：

- `full_bmad` 的 project 级 runtime 真相源天然应由 `sprint-status.yaml` 驱动。
- 当前 helper 已具备：
  - `buildProjectRegistryFromSprintStatus()`
  - `writeRuntimeContextFromSprintStatus()`
- 但 workflow 本体还未显式调用它们。

所以这里的明确结论是：

> `sprint-planning` / `sprint-status` 是 `full_bmad` 下 project registry/context 自动触发的第一真实入口，但当前更像“helper 已就位、入口接线责任已明确，workflow 本体显式自动调用仍待补齐”。

#### 3. `create-epics-and-stories`

这个入口位于 solutioning → implementation 之间，负责把 PRD/Architecture 转为 epics/stories。

对 `full_bmad` 而言，它是：
- 从 planning artifacts 进入 implementation artifacts 的桥梁
- 最自然的 epic/story scope 首次生成点

当前 helper 能力：
- `buildEpicContextsFromSprintStatus()`
- `buildStoryContextsFromSprintStatus()`

所以这里的明确结论是：

> `create-epics-and-stories` 是 `full_bmad` 中 epic/story context 自动化的最佳入口，但当前尚未在 workflow 本体里看到显式 runtime 写入调用。

#### 4. `create-story`

`create-story/workflow.yaml` 已显式持有：
- `sprint_status`
- `epics_file`
- `planning_artifacts`
- `implementation_artifacts`
- `default_output_file`

这意味着它天然拥有：
- story identity
- story output path
- 当前 sprint/project 事实源

所以这里的明确结论是：

> 在 `full_bmad` 下，`create-story` 应承担 story context 首次物化和 `activeScope=story` 的切换责任；当前这一责任从设计上已经非常明确，但 workflow 本体显式接线仍待补齐。

#### 5. `bmad-story-assistant`

`bmad-story-assistant` 已经定义了 Story 生命周期：
- Create Story
- Story Audit
- Dev Story
- Post Audit

因此它是最合理的 story lifecycle 责任协调器：
- 它不一定直接写 context 文件
- 但它应该确保在 create-story / dev-story / post-audit 切换时，自动触发对应的 runtime writer

明确结论：

> `bmad-story-assistant` 是 `full_bmad` story 级自动触发责任的最佳协调层。

#### 6. `dev-story`

`dev-story/workflow.yaml` 已显式掌握：
- `story_file`
- `implementation_artifacts`
- `sprint_status`
- `project_context`

这说明：
- 进入 dev-story 时，story identity 和执行上下文已经齐备
- 它是 run 级 context 的天然生成点
- 也是 `activeScope=run` 的天然切换点

同时 `speckit-workflow` 作为其技术实现层，最适合承接：
- constitution/specify/plan/gaps/tasks/implement 的 `workflowStage` 刷新

所以明确结论是：

> `dev-story` 应负责 run context 的创建；`speckit-workflow` 只负责 dev_story 内部 workflowStage 的刷新。

#### 7. `post-audit`

`post-audit` 不应沿用 dev-story 的 runId，因为它是新的 lifecycle 阶段。

因此在 `full_bmad` 下：
- `post-audit` 应新建 run context
- `activeScope` 仍切到 run
- `lifecycleStage = post_audit`

明确结论：

> `post-audit` 是 `full_bmad` 下第二个 run 级自动触发点，负责新的 post-audit run identity，而不是复用开发态 run。

### `full_bmad` 当前最准确的状态判断

#### 已明确成立的部分

1. **治理消费链成立**
   - registry-first
   - run-first
   - lifecycle + workflowStage 双层模型
   - hook 注入 / emit / policy 消费链

2. **逐入口责任链已明确**
   - project 级：`sprint-planning` / `sprint-status`
   - epic/story 级：`create-epics-and-stories` / `create-story`
   - run 级：`dev-story` / `post-audit`
   - workflowStage 级：`speckit-workflow`

#### 尚未 100% 明确完成的部分

- upstream workflow 本体内，是否已经逐入口显式调用 runtime writer / registry updater
- 目前搜索证据显示：**责任已清晰，但显式自动接线仍更像“外围 helper + adapter + tests 已成熟，workflow 本体内联接线仍待补齐”。**

因此，对 `full_bmad` 的最准确结论是：

> `full_bmad` 的 runtime 治理消费链已经完整成立，且逐入口自动触发责任已经可以清晰定位；但“这些责任是否已经在所有 upstream workflow 本体中显式自动写入落地”仍需继续做入口级改造，而不是再做概念性解释。

---

## 6.2 `seeded_solutioning`

### 适用场景

用户已有：
- 需求分析
- 架构设计
- 或已知技术方案

不一定从完整 sprint planning 开始，但仍希望进入 BMAD 后链。

### 输入事实源

- 显式 runtime context file（`sourceMode=seeded_solutioning`）
- registry
- activeScope
- story identity / epic identity（由运行时提供）

### 调用链

```text
外部已知 solutioning 输入
  ├─ requirement/architecture 已确定
  └─ runtime context file(sourceMode=seeded_solutioning)
        ↓
[scripts/runtime-context.ts]
  ├─ defaultRuntimeContextFile({ sourceMode: 'seeded_solutioning' })
  └─ writeRuntimeContext()
        ↓
project/story/run scoped context
        ↓
[scripts/runtime-context-registry.ts]
  ├─ defaultRuntimeContextRegistry()
  ├─ writeRuntimeContextRegistry()
  └─ activeScope -> project/story/run
        ↓
[scripts/emit-runtime-policy.ts]
  ├─ load registry
  ├─ resolve activeScope
  ├─ read scoped context
  └─ resolveRuntimePolicy()
        ↓
policy JSON
        ↓
[runtime-policy-inject.js]
        ↓
注入执行体
```

### 当前实现特点

- schema 与 IO 已支持
- registry consumption 测试已验证可工作
- 当前 coverage 更偏“运行时与 policy 消费可跑通”，而不是单独定义一套 upstream workflow 本体

---

### `seeded_solutioning` 逐入口自动触发核对表

| 入口 | 入口文件 | 现有输入事实 | 当前 helper/消费能力 | workflow 本体是否已显式自动写入 runtime registry/context | 结论 |
|---|---|---|---|---|---|
| `bmad-help` | `_bmad/skills/bmad-help/workflow.md` | 模块/phase/artifact 检测 | 无直接 writer，仅做推荐 | 否 | **路线识别起点**，应负责判定这是 solutioning 后链，不应直接写业务状态 |
| `bmad-master` | `_bmad/core/agents/bmad-master.md` | 菜单调度、workflow 入口协调 | 有治理前置约束，无 writer | 否 | **全局协调层**，适合承接 route detection 但不承担 context 写入 |
| `create-epics-and-stories` | `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.md` | PRD / Architecture / branch-scoped outputs | 可作为 seeded_solutioning 的 project+epic/story bootstrap 起点 | 未见显式调用 | **seeded_solutioning 第一真实入口，应自动 bootstrap project registry/context + epic/story scope** |
| `create-story` | `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` | sprint status / epics / planning artifacts / story output path | story context helper 已具备 | 未见显式调用 | **应承担 story context 首次物化 + activeScope=story** |
| `bmad-story-assistant` | `_bmad/claude/skills/bmad-story-assistant/SKILL.md` | Story 生命周期阶段定义 | 可协调 create-story/dev-story/post-audit | 不是 workflow 本体 | **story 生命周期协调器，应确保 seeded_solutioning 后链入口自动建 story/run scope** |
| `dev-story` | `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml` | story_file / sprint_status / implementation_artifacts / project_context | `buildRunContext()` + run-first consumption 已成熟 | 未见显式调用 | **应创建 run context + activeScope=run** |
| `speckit-workflow` | `_bmad/claude/skills/speckit-workflow/SKILL.md` | dev_story 内部阶段语义 | workflowStage 刷新链已可消费 | 不是 workflow 本体 | **只负责 dev_story 内部 workflowStage refresh** |
| `post-audit` | Story lifecycle 后继阶段 | post-audit run identity | run-first consumption 已成熟 | 未见显式调用 | **应创建新的 post-audit run context** |

### `seeded_solutioning` 逐入口详细流程解释

#### 1. `bmad-help` → `bmad-master`

在 `seeded_solutioning` 中，用户通常不是从完整 BMAD planning 主链进入，而是已经拥有：
- 需求分析
- 架构设计
- 或足够的 solutioning 输入

因此：
- `bmad-help` 应先识别“当前不是 `full_bmad` 主链，而是已具备 solutioning 基础的后链模式”
- `bmad-master` 应把这条路线交给 solutioning/implementation 入口，而不是要求用户自己补 runtime 状态

结论：

> 在 `seeded_solutioning` 中，`bmad-help` / `bmad-master` 的职责是**识别并路由**，不是写 registry/context。

#### 2. `create-epics-and-stories`

这是 `seeded_solutioning` 最关键的第一入口。

因为它已经持有：
- PRD
- Architecture
- branch-scoped planning outputs

而 `seeded_solutioning` 的核心特征就是：
- 没有完整 `full_bmad` 主链输入
- 但已有足够的 solutioning 文档可直接进入 epic/story 生成

因此这里最合理的自动化动作是：
- 自动识别 `sourceMode = seeded_solutioning`
- 自动写最小 project context
- 自动写最小 registry
- 自动预建 epic/story scope
- `activeScope` 至少切到 project，必要时切到 epic/story

明确结论：

> `create-epics-and-stories` 是 `seeded_solutioning` 自动触发的第一真实业务入口。

#### 3. `create-story`

当 solutioning 已经产出 epics/stories 后，进入 `create-story` 时，story identity 和 story output path 已经可用。

因此这里应自动：
- 物化 story context
- 设置 `activeScope=story`
- 将 solutioning 输入转为可消费的 story-scoped runtime truth

明确结论：

> `create-story` 是 `seeded_solutioning` 下 story scope 从“规划信息”变成“运行时真相源”的关键入口。

#### 4. `bmad-story-assistant`

由于 `seeded_solutioning` 本质上仍会进入 Story 生命周期，`bmad-story-assistant` 依然是最适合协调：
- create-story
- dev-story
- post-audit

这些 story lifecycle 入口自动触发责任的协调层。

结论：

> `bmad-story-assistant` 在 `seeded_solutioning` 下不负责自己写 context 文件，但应成为“确保 Story 生命周期入口自动触发 runtime writer”的总协调层。

#### 5. `dev-story`

一旦 seeded_solutioning 进入真实开发，`dev-story` 的职责与 `full_bmad` 一样明确：
- 创建 run context
- 切 `activeScope=run`
- 将 story 执行态正式化

同时 `speckit-workflow` 负责内部：
- constitution/specify/plan/gaps/tasks/implement 的 `workflowStage` 刷新

结论：

> `dev-story` 在 `seeded_solutioning` 中是 run 级自动化的主入口；`speckit-workflow` 仍只负责内部 workflowStage refresh。

#### 6. `post-audit`

与 `full_bmad` 一样：
- 不应复用 dev-story run
- 应新建 post-audit run context
- activeScope 继续切到 run

#### 7. `seeded_solutioning` 当前最准确的状态判断

##### 已明确成立的部分

1. `sourceMode = seeded_solutioning` 已存在于 schema / IO / registry-backed consumption 中
2. 非 `full_bmad` 的 policy consumption 已有 fresh 测试证据
3. Story/run 级治理消费链可工作

##### 尚未 100% 明确完成的部分

- `create-epics-and-stories` / `create-story` / `dev-story` 是否已经逐入口显式自动写入 runtime registry/context
- 当前更像是：helper/consumer 已成熟，但 seeded_solutioning 的入口自动化责任还未 fully 下沉到真实入口实现

因此，对 `seeded_solutioning` 的最准确结论是：

> `seeded_solutioning` 的治理消费链已具备可运行基础，但真正的自动触发责任仍需在 `create-epics-and-stories` → `create-story` → `dev-story` 这条真实入口链上继续落地。

---

## 6.3 `standalone_story`

### 适用场景

没有完整 sprint / epics 主链，只围绕单个 story 工作。

### 输入事实源

- 最小 story identity
- 显式 runtime context file（`sourceMode=standalone_story`）
- scoped context
- registry activeScope

### 调用链

```text
单 Story 工作输入
  ├─ storyId / epicId / runId
  └─ runtime context file(sourceMode=standalone_story)
        ↓
[scripts/runtime-context.ts]
  ├─ defaultRuntimeContextFile({ sourceMode: 'standalone_story' })
  └─ writeRuntimeContext()
        ↓
story/run scoped context
        ↓
[scripts/runtime-context-registry.ts]
  ├─ defaultRuntimeContextRegistry()
  ├─ registry.activeScope = project/story/run
  └─ writeRuntimeContextRegistry()
        ↓
[scripts/emit-runtime-policy.ts]
  ├─ registry-first resolve
  ├─ scoped context read
  └─ resolveRuntimePolicy()
        ↓
policy JSON
        ↓
[runtime-policy-inject.js]
        ↓
执行前注入
```

### `standalone_story` 逐入口自动触发核对表

| 入口 | 入口文件 | 现有输入事实 | 当前 helper/消费能力 | workflow 本体是否已显式自动写入 runtime registry/context | 结论 |
|---|---|---|---|---|---|
| `bmad-help` | `_bmad/skills/bmad-help/workflow.md` | module / phase / artifact 推荐 | 无直接 writer | 否 | **standalone_story 路线识别起点** |
| `bmad-master` | `_bmad/core/agents/bmad-master.md` | 顶层调度与治理前置约束 | 无直接 writer | 否 | **全局协调层** |
| `create-story` | `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml` | story identity / story output / planning fallback inputs | story context helper 已具备 | 未见显式调用 | **最适合承担 standalone_story 的最小 story bootstrap** |
| `bmad-story-assistant` | `_bmad/claude/skills/bmad-story-assistant/SKILL.md` | Story 生命周期协调 | 可承接后续 story lifecycle | 不是 workflow 本体 | **协调 standalone_story 的后续阶段自动化** |
| `dev-story` | `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml` | story_file / implementation_artifacts / sprint_status / project_context | `buildRunContext()` 已成熟 | 未见显式调用 | **应承担 standalone_story 的 run bootstrap** |
| `speckit-workflow` | `_bmad/claude/skills/speckit-workflow/SKILL.md` | dev_story 内部技术实现层 | workflowStage refresh 已具备 | 不是 workflow 本体 | **只负责内部 workflowStage** |
| `post-audit` | Story lifecycle 后继阶段 | post-audit run identity | run-first consumption 已成熟 | 未见显式调用 | **应新建 post-audit run context** |

### `standalone_story` 逐入口详细流程解释

#### 1. `bmad-help` → `bmad-master`

在 `standalone_story` 场景下，用户通常不是走完整 project/epic 主链，而是“我只想直接做这一个 story”。

因此：
- `bmad-help` 应识别出“当前是单 story 独立工作模式”
- `bmad-master` 应将后续路由到 story lifecycle，而不是要求用户自己知道要先准备 runtime registry/context

结论：

> `standalone_story` 下，顶层入口仍只负责路线识别与调度，不负责写业务 runtime 状态。

#### 2. `create-story`

因为 standalone_story 缺少完整 sprint / epics 主链，`create-story` 就变成最适合的第一个业务写入点。

在这个入口上，系统最应该自动完成：
- 自动识别 `sourceMode = standalone_story`
- 建最小 project registry/context
- 建 story context
- 切 `activeScope=story`

结论：

> `create-story` 是 `standalone_story` 自动触发的第一关键入口。

#### 3. `bmad-story-assistant`

一旦 story scope 建立，`bmad-story-assistant` 仍负责 story 生命周期协同：
- story audit
- dev story
- post audit

因此它在 standalone_story 下的角色仍然是：
- 协调器
- 而不是低层 writer

#### 4. `dev-story`

与其他模式一样，一旦进入真实开发：
- 应自动创建 run context
- 切 `activeScope=run`
- `speckit-workflow` 只负责内部 workflowStage 刷新

#### 5. `post-audit`

应新建 post-audit run，不能复用 dev-story run。

#### 6. `standalone_story` 当前最准确的状态判断

##### 已明确成立的部分

1. schema / IO / registry-backed consumption 已支持 `standalone_story`
2. 非 `full_bmad` 的 runtime policy 消费已经有 fresh 证据
3. story/run 主链可被 scoped context + registry 消费

##### 尚未 100% 明确完成的部分

- `create-story` / `dev-story` / `post-audit` 是否已经逐入口自动写入 standalone_story 所需的 registry/context
- 当前更像是：standalone_story 的运行时接口已成熟，但入口自动化责任尚未 fully 落地

因此，对 `standalone_story` 的最准确结论是：

> `standalone_story` 已具备完整治理消费能力，但其自动触发仍需明确下沉到 story lifecycle 的真实入口，而不能继续依赖外层调用方记得先补 registry/context。

---

## 7. “怎么触发 registry/context 的生成与更新” 的精确答案

### 7.1 当前不是“workflow.yaml 里直接调用脚本”

本轮搜索没有看到 upstream workflow 本体里大范围出现如下调用：

- `write-runtime-context`
- `runtime-context-registry`
- `emit-runtime-policy`
- ~~`BMAD_RUNTIME_CONTEXT_FILE`~~（已废弃）

### 7.2 当前是“由外围实现承接 workflow 事实源”

当前生成/更新是通过以下函数承接：

- `buildProjectRegistryFromSprintStatus()`
- `buildEpicContextsFromSprintStatus()`
- `buildStoryContextsFromSprintStatus()`
- `buildRunContext()`
- `writeRuntimeContextRegistry()`
- `writeRuntimeContext()`
- `writeRuntimeContextFromSprintStatus()`

### 7.3 部署时的初始触发

`init-to-root.js` 在部署后还会调用：

- `writeDefaultRuntimeContext(...)`

它会写入默认 project context：

- `_bmad-output/runtime/context/project.json`

因此，运行时治理不是“等 workflow 自己写一切”，而是：

> **init 先铺 runtime 基础设施，运行期再由 registry/context helper 承接 workflow 事实源。**

---

## 8. 为什么这种方式成立

### 优点

1. **不强侵入 upstream workflow 本体**
2. **更容易继续同步 upstream**
3. **治理内核单一**：`resolveRuntimePolicy` / `emit-runtime-policy` 不分叉
4. **宿主适配可替换**：Claude / Cursor hook 只改 envelope，不改治理内核
5. **测试可冻结链路语义**：用 acceptance tests 固定“哪个入口该联动什么”

### 代价

1. workflow 本体里看不到显式 runtime 调用，阅读者会误以为“没有接”
2. 需要通过 tests + docs + hooks + scripts 组合起来理解接入
3. 如果追求“所有阶段都在 workflow 定义内显式写入 registry/context”，还需要进一步做更侵入式接线

---

## 9. 文件级别对照：是否属于“真正 workflow 本体接入”

| 文件 | 是否属于 upstream workflow 本体 | 本轮是否承担 runtime 接入核心职责 |
|---|---:|---:|
| `_bmad/bmm/workflows/**/workflow.yaml` | 是 | 否（未见大范围显式 runtime 写入） |
| `_bmad/claude/skills/speckit-workflow/SKILL.md` | 否（skill 约束） | 是（执行前提约束） |
| `_bmad/cursor/skills/speckit-workflow/SKILL.md` | 否（skill 约束） | 是 |
| `_bmad/core/agents/bmad-master.md` | 否（agent 约束） | 是 |
| `scripts/runtime-context.ts` | 否 | 是 |
| `scripts/runtime-context-registry.ts` | 否 | 是 |
| `scripts/emit-runtime-policy.ts` | 否 | 是 |
| `_bmad/claude/hooks/runtime-policy-inject.js` | 否 | 是 |
| `.claude/.cursor/hooks/runtime-policy-inject.js` | 否 | 是 |
| `scripts/init-to-root.js` | 否 | 是 |

---

## 10. 当前最准确的一句话总结

> **本轮 Runtime Governance 的接入，不是“把 BMAD upstream workflow 定义全部改成内嵌 runtime 写入调用”，而是“让 `_bmad` skill/agent 明确依赖 hook 注入的 governance JSON，再由外围 runtime-context / registry / emit / hook / init 体系承接 workflow 事实源并完成 policy 消费”。**

---

## 11. 如需继续追踪的方向

如果后续你要把“接入”进一步升级成**workflow 定义内显式写 registry/context**，那么下一步应重点检查并改造：

- `_bmad/bmm/workflows/4-implementation/sprint-planning/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/sprint-status/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.md`

目标是让这些 workflow 步骤在完成关键状态写入后，显式调用 runtime writer/registry updater，而不是仅由外围 helper + tests 约束其行为。
