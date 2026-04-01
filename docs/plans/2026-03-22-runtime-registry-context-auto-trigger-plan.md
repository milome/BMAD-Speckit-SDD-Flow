# Runtime Registry Context Auto Trigger Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 `full_bmad`、`seeded_solutioning`、`standalone_story` 三种模式都由系统入口自动生成并刷新 runtime registry / scoped context，而不是依赖调用方或用户记住何时手工补上下文。

**Architecture:** 采用“入口责任下沉”方案：不改变 `resolveRuntimePolicy` / `emit-runtime-policy` 的严格消费语义，而是在真实入口（init、story lifecycle 入口、solutioning 入口、standalone story 入口、host hook adapter）前置加入 sourceMode 自动识别、context 自动写入、registry 自动刷新与 activeScope 自动切换。优先在 adapter/wrapper/entrypoint 层做接线，只有确实必要时才侵入 `_bmad` workflow 定义本体。

**Tech Stack:** TypeScript, Node.js, Vitest, BMAD `_bmad` workflows/skills/hooks, runtime context registry, JSON context files, Cursor/Claude hook adapters.

---

## 0. 设计原则

1. **消费链继续严格**：`emit-runtime-policy.ts` 继续保持 registry-first/context-first，缺上下文继续 fail loud。
2. **入口自动生成**：真正要改的是“入口负责自动写 registry/context”，而不是恢复 fallback。
3. **sourceMode 自动识别**：不能依赖调用方记得传 `sourceMode`，系统要根据上下文推导。
4. **activeScope 自动切换**：project → epic → story → run 的当前活跃范围由入口自己更新。
5. **最少侵入 upstream**：优先改 adapter / init / entrypoint wrapper / hook，必要时再改 `_bmad` workflow 本体。
6. **TDD**：所有入口自动化都必须先补失败测试再改实现。

---

## 1. 基于真实引导链的入口责任结论

在补完 `docs/design/runtime-governance-implementation-analysis.md` 的调查后，可以明确：

### 1.1 顶层引导层（只负责路线识别，不负责业务 runtime 状态写入）

#### `bmad-help`
- 路径：`_bmad/skills/bmad-help/workflow.md`
- 真实角色：读取 `_bmad/_config/bmad-help.csv`，检测 module / phase / artifacts，推荐下一步
- 结论：适合作为 **sourceMode / 路线识别起点**，不适合作为 registry/context writer

#### `bmad-master`
- 路径：`_bmad/core/agents/bmad-master.md`
- 真实角色：菜单调度、workflow 触发、全局协调；已带有 Runtime Governance 前置约束
- 结论：适合作为 **全局协调入口**，不适合作为细粒度 runtime state writer

### 1.2 Story 生命周期协调层

#### `bmad-story-assistant`
- 路径：`_bmad/claude/skills/bmad-story-assistant/SKILL.md`
- 真实角色：统一协调 Create Story → Story Audit → Dev Story → Post Audit
- 结论：适合作为 **story lifecycle 自动触发责任协调器**，但不一定自己直接写 context 文件

#### `speckit-workflow`
- 路径：`_bmad/claude/skills/speckit-workflow/SKILL.md`
- 真实角色：`bmad-story-assistant` 的技术实现层，负责 constitution → specify → plan → GAPS → tasks → implement
- 结论：适合作为 **dev_story 内部 workflowStage refresh** 层，不适合作为 top-level sourceMode bootstrap 起点

### 1.3 三种 sourceMode 的真实入口责任链

#### `full_bmad`
- project bootstrap: `sprint-planning` / `sprint-status`
- epic/story bootstrap: `create-epics-and-stories`
- story bootstrap: `create-story`
- run bootstrap: `dev-story`
- workflowStage refresh: `speckit-workflow`
- new post-audit run: `post-audit`

#### `seeded_solutioning`
- route detection: `bmad-help` / `bmad-master`
- first business bootstrap: `create-epics-and-stories`
- story bootstrap: `create-story`
- run bootstrap: `dev-story`
- workflowStage refresh: `speckit-workflow`
- new post-audit run: `post-audit`

#### `standalone_story`
- route detection: `bmad-help` / `bmad-master`
- first business bootstrap: `create-story`
- story lifecycle coordination: `bmad-story-assistant`
- run bootstrap: `dev-story`
- workflowStage refresh: `speckit-workflow`
- new post-audit run: `post-audit`

### 1.4 对本计划的约束

基于以上调查，本计划必须遵守：

1. **不要让 `bmad-help` / `bmad-master` 直接写业务 runtime state**
2. **必须把自动触发责任下沉到真实业务入口**：
   - `sprint-planning` / `sprint-status`
   - `create-epics-and-stories`
   - `create-story`
   - `dev-story`
   - `post-audit`
3. **`speckit-workflow` 只负责 dev_story 内部 workflowStage 刷新，不负责 top-level bootstrap**
4. **任何 sourceMode 都不允许依赖用户记住何时手工补 registry/context**

---

## 2. 需要自动触发的入口责任矩阵

| 入口 | sourceMode | 自动写 project context | 自动写 registry | 自动写 story/run context | 自动切 activeScope |
|---|---|---:|---:|---:|---:|
| init-to-root | full_bmad | 是 | 是（默认空/最小） | 否 | project |
| sprint-planning / sprint-status | full_bmad | 是 | 是 | 否 | project |
| create-epics-and-stories | full_bmad / seeded_solutioning | 是 | 是 | epic/story | epic/story |
| create-story | full_bmad / seeded_solutioning / standalone_story | 继承/最小 | 是 | story | story |
| dev-story start | 全部 | 继承 | 是 | run | run |
| post-audit start | 全部 | 继承 | 是 | run | run |
| standalone story entry | standalone_story | 最小 project | 是 | story/run | story/run |
| hook adapter（仅消费前） | 全部 | 否（不负责生成业务状态） | 仅在可安全推导时补最小上下文 | 否/最小 | 只读，不乱改 |

---

## 2. sourceMode 自动识别规则（目标态）

### Rule A: full_bmad
满足以下大多数条件时自动识别为 `full_bmad`：
- 存在 `_bmad-output/implementation-artifacts/sprint-status.yaml`
- 存在标准 BMAD 目录结构
- 存在 story/epic 状态链条

### Rule B: seeded_solutioning
满足以下条件时识别为 `seeded_solutioning`：
- 没有完整 sprint 主链或其不作为主要事实源
- 但存在 solutioning/architecture 输入，且入口直接从 epics/story 后链进入
- create-epics-and-stories / create-story / dev-story 后链可启动

### Rule C: standalone_story
满足以下条件时识别为 `standalone_story`：
- 没有完整 sprint / epics 主链
- 只有 story 级别文件 / specs / story artifacts / story identity
- 用户或入口直接围绕单 story 执行

### Rule D: 显式优先
如果入口明确传入 `sourceMode`，则优先采用显式值；自动识别只作为默认推导。

---

## 3. 需要改动的文件分层

### 3.1 核心 runtime 层
- Modify: `scripts/runtime-context.ts`
- Modify: `scripts/runtime-context-registry.ts`
- Modify: `scripts/emit-runtime-policy.ts`（仅在必要时补入口兼容辅助，不改 strict 消费原则）

### 3.2 入口/部署/接线层
- Modify: `scripts/init-to-root.js`
- Modify: `_bmad/claude/hooks/runtime-policy-inject.js`
- Modify: `.claude/hooks/runtime-policy-inject.js`
- Modify: `.cursor/hooks/runtime-policy-inject.js`
- Investigate/Modify if needed:
  - `_bmad/bmm/workflows/4-implementation/sprint-planning/**`
  - `_bmad/bmm/workflows/4-implementation/sprint-status/**`
  - `_bmad/bmm/workflows/4-implementation/create-story/**`
  - `_bmad/bmm/workflows/4-implementation/dev-story/**`
  - `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/**`

### 3.3 文档/契约层
- Modify: `docs/design/runtime-governance-implementation-analysis.md`
- Modify: `docs/reference/runtime-context.md`
- Modify: `docs/reference/cursor-runtime-governance-hooks.md`
- Modify: `docs/how-to/runtime-governance-auto-inject-cursor-claude.md`

### 3.4 测试层
- Create/Modify targeted acceptance tests under `tests/acceptance/`

---

## 4. Task A — 提炼入口自动触发接口

**Files:**
- Modify: `scripts/runtime-context.ts`
- Modify: `scripts/runtime-context-registry.ts`
- Test: `tests/acceptance/runtime-context-auto-trigger-contract.test.ts`

**Step 1: Write the failing test**

测试要求：
- 存在统一入口 helper，例如：
  - `ensureProjectRuntimeContext(...)`
  - `ensureStoryRuntimeContext(...)`
  - `ensureRunRuntimeContext(...)`
  - `detectRuntimeSourceMode(...)`
- 自动触发 helper 不要求调用方手工拼 registry 结构

**Step 2: Run test to verify it fails**

Run:
```bash
./node_modules/.bin/vitest --config ./vitest.config.ts run tests/acceptance/runtime-context-auto-trigger-contract.test.ts
```

Expected:
- FAIL，提示 helper/contract 缺失

**Step 3: Write minimal implementation**

在 runtime helper 层新增统一入口：
- `detectRuntimeSourceMode(root, hints?)`
- `ensureProjectRuntimeContext(root, options?)`
- `ensureStoryRuntimeContext(root, options)`
- `ensureRunRuntimeContext(root, options)`

这些 helper 负责：
- 选择 `sourceMode`
- 构建默认 registry/context
- 更新 `activeScope`

**Step 4: Run test to verify it passes**

Run the same test.
Expected: PASS

---

## 5. Task B — 让 init 自动生成最小 registry + project context

**Files:**
- Modify: `scripts/init-to-root.js`
- Test: `tests/acceptance/runtime-init-auto-registry-bootstrap.test.ts`

**Step 1: Write the failing test**

测试要求：
- init 后除了默认 project context，还必须有 `_bmad-output/runtime/registry.json`
- `activeScope.scopeType = project`
- 不要求用户后续手工补 registry

**Step 2: Run test to verify it fails**

Run targeted vitest.
Expected: FAIL

**Step 3: Write minimal implementation**

在 `init-to-root.js` 中：
- bootstrap 默认 project context 后
- 继续 bootstrap 一个最小 registry
- 把 `activeScope` 设为 project

**Step 4: Run test to verify it passes**

Expected: PASS

---

## 6. Task C — 让 full_bmad 入口自动刷新 project/epic/story context

**Files:**
- Modify: `scripts/runtime-context-registry.ts`
- Modify if needed: `_bmad/bmm/workflows/4-implementation/sprint-planning/**`
- Modify if needed: `_bmad/bmm/workflows/4-implementation/sprint-status/**`
- Modify if needed: `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/**`
- Test: `tests/acceptance/runtime-context-full-bmad-auto-trigger.test.ts`

**Step 1: Write the failing test**

测试要求：
- 当 sprint-status 更新后，无需手工补 registry/context
- 自动刷新 project registry/context
- create-epics-and-stories 后自动刷新 epic/story contexts

**Step 2: Run test to verify it fails**

Expected: FAIL

**Step 3: Write minimal implementation**

优先在 wrapper/entrypoint 层补：
- sprint-status 结束时调用 `ensureProjectRuntimeContext(...)`
- create-epics-and-stories 结束时调用 `ensureStoryRuntimeContext(...)` / epic refresh

只有 wrapper 层做不到时，再改 workflow 定义本体。

**Step 4: Run test to verify it passes**

Expected: PASS

---

## 7. Task D — 让 seeded_solutioning 入口自动建 registry/context

**Files:**
- Modify: `scripts/runtime-context.ts`
- Modify: `scripts/runtime-context-registry.ts`
- Modify if needed: `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/**`
- Modify if needed: `_bmad/bmm/workflows/4-implementation/create-story/**`
- Test: `tests/acceptance/runtime-context-seeded-solutioning-auto-trigger.test.ts`

**Step 1: Write the failing test**

测试要求：
- 当入口直接从 solutioning 后链进入时
- 无需人工先写 runtime registry/context
- 系统可自动识别 `seeded_solutioning`
- 可自动生成 project/story/run 级最小治理上下文

**Step 2: Run test to verify it fails**

Expected: FAIL

**Step 3: Write minimal implementation**

增加：
- `detectRuntimeSourceMode(...)` 对 seeded_solutioning 的规则
- create-epics-and-stories/create-story 入口上的自动触发
- 自动写最小 registry + activeScope

**Step 4: Run test to verify it passes**

Expected: PASS

---

## 8. Task E — 让 standalone_story 入口自动建 story/run 治理链

**Files:**
- Modify: `scripts/runtime-context.ts`
- Modify: `scripts/runtime-context-registry.ts`
- Modify if needed: `_bmad/bmm/workflows/4-implementation/create-story/**`
- Modify if needed: `_bmad/bmm/workflows/4-implementation/dev-story/**`
- Test: `tests/acceptance/runtime-context-standalone-story-auto-trigger.test.ts`

**Step 1: Write the failing test**

测试要求：
- 仅有 story 文件 / specs / story identity 时
- 无需人工补 registry/context
- 能自动识别 `standalone_story`
- story / run 上下文自动生成
- activeScope 自动切到 story / run

**Step 2: Run test to verify it fails**

Expected: FAIL

**Step 3: Write minimal implementation**

增加：
- standalone_story 自动识别规则
- story/create-story/dev-story/post-audit 入口上的最小自动触发
- `ensureStoryRuntimeContext(...)` / `ensureRunRuntimeContext(...)`

**Step 4: Run test to verify it passes**

Expected: PASS

---

## 9. Task F — 让 hook 只消费，不承担补业务状态责任

**Files:**
- Modify: `_bmad/claude/hooks/runtime-policy-inject.js`
- Modify: `.claude/hooks/runtime-policy-inject.js`
- Modify: `.cursor/hooks/runtime-policy-inject.js`
- Test: `tests/acceptance/runtime-policy-inject-auto-trigger-boundary.test.ts`

**Step 1: Write the failing test**

测试要求：
- hook 可在非 BMAD 项目中静默跳过
- hook 不负责伪造 business runtime state
- hook 只消费已存在/可安全补的最小上下文，不替代入口自动化

**Step 2: Run test to verify it fails**

Expected: FAIL（如果当前边界未冻结）

**Step 3: Write minimal implementation**

只补边界保护，不把 hook 改成隐式业务状态写入器。

**Step 4: Run test to verify it passes**

Expected: PASS

---

## 10. Task G — 文档化“自动触发责任矩阵”

**Files:**
- Modify: `docs/design/runtime-governance-implementation-analysis.md`
- Modify: `docs/reference/runtime-context.md`
- Modify: `docs/reference/cursor-runtime-governance-hooks.md`
- Modify: `docs/how-to/runtime-governance-auto-inject-cursor-claude.md`

**Step 1: Add responsibility matrix**

文档中明确：
- full_bmad 谁触发
- seeded_solutioning 谁触发
- standalone_story 谁触发
- 哪些入口自动切 activeScope
- 哪些组件只能消费，不能负责补业务状态

**Step 2: Add sequence diagrams**

至少补：
- full_bmad 主链时序图
- seeded_solutioning 自动触发图
- standalone_story 自动触发图

**Step 3: Verify docs**

Run relevant docs contract tests.
Expected: PASS

---

## 11. Task H — 最终验证清单

**Step 1: Run targeted new tests**

Run all新增 auto-trigger tests.
Expected: PASS

**Step 2: Re-run core runtime batches**

至少重跑：
- runtime-policy-inject.test.ts
- runtime-policy-registry-consumption.test.ts
- runtime-context-full-chain-milestone.test.ts
- runtime-language-english-chain-milestone.test.ts
- runtime-context-io.test.ts
- runtime-context-project-sync.test.ts

Expected: PASS

**Step 3: Re-run runtime broad suite**

Run the full runtime acceptance batches in 2 groups as already proven workable in this repo.
Expected: PASS

---

## 12. 完成标准

只有同时满足以下条件，才算“自动触发改造”完成：

1. 用户在 `full_bmad` 下不需要手工补 registry/context
2. 用户在 `seeded_solutioning` 下不需要手工补 registry/context
3. 用户在 `standalone_story` 下不需要手工补 registry/context
4. `sourceMode` 可自动推导（显式值仍优先）
5. `activeScope` 由入口自动切换
6. hook 继续只消费，不承担业务状态伪造责任
7. 现有 runtime 主链测试不回退
8. 新增 auto-trigger 测试通过

---

Plan complete and saved to `docs/plans/2026-03-22-runtime-registry-context-auto-trigger-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
