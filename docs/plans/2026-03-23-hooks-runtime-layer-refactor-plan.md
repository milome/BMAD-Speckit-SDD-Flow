# Hooks Runtime Layer Refactor Implementation Plan

> **Current path**: `runAuditorHost`
> **Legacy path**: `bmad-speckit score` / `parse-and-write-score`

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前分散在 `_bmad/claude/hooks/` 的共享运行时治理 hook 逻辑重构为清晰的三层结构：`_bmad/runtime/hooks/` 作为 shared canonical logic，`_bmad/claude/hooks/` 与 `_bmad/cursor/hooks/` 作为宿主 adapter，从而让治理逻辑归属、部署规则和宿主差异都清晰可维护。

**Architecture:** 采用“shared core + host adapter + runtime deployment”三层分离模型。Shared 层只负责宿主无关的 emit 调用、root 解析、quiet-skip/fail-loud 分流与错误格式化，不直接输出 Claude/Cursor envelope；Claude/Cursor adapter 只负责读取 stdin 和输出各自宿主 envelope。`init-to-root.js` 改为同时部署 shared hooks 与 host adapter，确保 `.claude/hooks/` 与 `.cursor/hooks/` 都来自明确的 canonical source。

**Tech Stack:** Node.js, CommonJS hook scripts, init-to-root deploy logic, Cursor/Claude hooks, Vitest acceptance tests.

---

## 0. 设计原则

1. **共享逻辑独立归属**：宿主无关逻辑必须放 `_bmad/runtime/hooks/`。
2. **宿主 adapter 薄层化**：`_bmad/claude/hooks/` / `_bmad/cursor/hooks/` 只做 envelope 和宿主特有分流。
3. **不改变治理内核**：`resolveRuntimePolicy` / `emit-runtime-policy` 继续单一来源。
4. **部署规则显式化**：init 必须同时部署 shared hooks 与 adapter。
5. **渐进迁移**：先抽 shared，再让两个 adapter 使用 shared，最后收口旧路径。
6. **TDD**：每个阶段先补 failing test 再实现。

---

## 1. 目标目录结构

```text
_bmad/
├── runtime/
│   └── hooks/
│       ├── runtime-policy-inject-core.js
│       ├── run-emit-runtime-policy.js
│       ├── should-skip-runtime-policy.js
│       ├── build-runtime-error-message.js
│       └── emit-runtime-policy-cli.js   # 若决定也抽 shared
│
├── claude/
│   └── hooks/
│       ├── runtime-policy-inject.js     # Claude adapter
│       └── emit-runtime-policy-cli.js   # Claude wrapper / shared wrapper
│
└── cursor/
    └── hooks/
        ├── runtime-policy-inject.js     # Cursor adapter
        └── emit-runtime-policy-cli.js   # Cursor wrapper / shared wrapper
```

运行时部署目标：

```text
.claude/hooks/
  runtime-policy-inject.js
  emit-runtime-policy-cli.js
  emit-runtime-policy.cjs
  write-runtime-context.js
  [shared helper files...]

.cursor/hooks/
  runtime-policy-inject.js
  emit-runtime-policy-cli.js
  emit-runtime-policy.cjs
  write-runtime-context.js
  [shared helper files...]
```

---

## 2. 迁移边界

### Shared 层必须承担
- root 解析（project root / `_bmad` 检测）
- emit 调用
- quiet-skip / fail-loud 判断
- 错误文本拼装
- 宿主无关的执行结果结构

### Claude adapter 必须承担
- Claude stdin 读取约束
- Agent / SubagentStart 等事件门控
- `systemMessage` / `hookSpecificOutput.additionalContext` 输出

### Cursor adapter 必须承担
- Cursor host stdin / `--cursor-host` 语义
- Cursor envelope 输出
- 非 BMAD 上下文静默处理（可复用 shared 判断）

### Shared 层禁止承担
- 直接输出 Claude/Cursor JSON envelope
- 直接假定 tool_name / event name 语义
- 直接修改业务 runtime state

---

## 3. 需要改动的文件

### 3.1 新增 shared 层
- Create: `_bmad/runtime/hooks/runtime-policy-inject-core.js`
- Create: `_bmad/runtime/hooks/run-emit-runtime-policy.js`
- Create: `_bmad/runtime/hooks/should-skip-runtime-policy.js`
- Create: `_bmad/runtime/hooks/build-runtime-error-message.js`
- Create or Move: `_bmad/runtime/hooks/emit-runtime-policy-cli.js`（视实现策略而定）

### 3.2 修改 host adapter
- Modify: `_bmad/claude/hooks/runtime-policy-inject.js`
- Modify: `_bmad/cursor/hooks/runtime-policy-inject.js`
- Modify if needed: `_bmad/claude/hooks/emit-runtime-policy-cli.js`
- Modify if needed: `_bmad/cursor/hooks/emit-runtime-policy-cli.js`

### 3.3 修改部署层
- Modify: `scripts/init-to-root.js`
- Modify if needed: `packages/bmad-speckit/src/services/sync-service.js`

### 3.4 文档层
- Modify: `docs/design/runtime-governance-implementation-analysis.md`
- Modify: `docs/reference/cursor-runtime-governance-hooks.md`
- Modify: `docs/how-to/runtime-governance-auto-inject-cursor-claude.md`

### 3.5 测试层
- Create/Modify tests under `tests/acceptance/`

---

## 4. Task A — 冻结三层结构契约

**Files:**
- Create: `tests/acceptance/runtime-hooks-layering-contract.test.ts`
- Read/Modify: `_bmad/claude/hooks/runtime-policy-inject.js`
- Read/Modify: `_bmad/cursor/hooks/runtime-policy-inject.js`

**Step 1: Write the failing test**

测试要求：
- `_bmad/runtime/hooks/` 目录存在 shared 层文件
- `_bmad/claude/hooks/` 和 `_bmad/cursor/hooks/` 中的 inject 文件都不再承载全部共享逻辑
- adapter 文件中必须能看到对 shared core 的调用/require

**Step 2: Run test to verify it fails**

```bash
./node_modules/.bin/vitest --config ./vitest.config.ts run tests/acceptance/runtime-hooks-layering-contract.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

创建 shared hooks 目录与最小 core/wrapper 文件。

**Step 4: Run test to verify it passes**

Expected: PASS

---

## 5. Task B — 抽取 shared core：emit 调用与错误分流

**Files:**
- Create: `_bmad/runtime/hooks/runtime-policy-inject-core.js`
- Create: `_bmad/runtime/hooks/run-emit-runtime-policy.js`
- Create: `_bmad/runtime/hooks/should-skip-runtime-policy.js`
- Create: `_bmad/runtime/hooks/build-runtime-error-message.js`
- Test: `tests/acceptance/runtime-hooks-shared-core.test.ts`

**Step 1: Write the failing test**

测试要求：
- shared core 可返回统一结果结构，例如：
  - `{ status, mode, root, skip, errorText, policyJson }`
- 非 BMAD 上下文 quiet-skip 判断在 shared 层可复用
- shared 层不输出宿主 envelope

**Step 2: Run test to verify it fails**

Expected: FAIL

**Step 3: Write minimal implementation**

实现：
- `runEmit(root)`
- `shouldSkipRuntimePolicy(...)`
- `buildRuntimeErrorMessage(...)`
- `runtimePolicyInjectCore(...)`

**Step 4: Run test to verify it passes**

Expected: PASS

---

## 6. Task C — 改造 Claude adapter

**Files:**
- Modify: `_bmad/claude/hooks/runtime-policy-inject.js`
- Test: `tests/acceptance/runtime-hooks-claude-adapter.test.ts`

**Step 1: Write the failing test**

测试要求：
- Claude adapter 只负责：
  - 读 stdin
  - 调 shared core
  - 输出 Claude envelope
- 共享错误分流逻辑不再在 adapter 中重复实现

**Step 2: Run test to verify it fails**

Expected: FAIL

**Step 3: Write minimal implementation**

把共享逻辑替换为 shared core 调用。

**Step 4: Run test to verify it passes**

Expected: PASS

---

## 7. Task D — 改造 Cursor adapter

**Files:**
- Modify: `_bmad/cursor/hooks/runtime-policy-inject.js`
- Test: `tests/acceptance/runtime-hooks-cursor-adapter.test.ts`

**Step 1: Write the failing test**

测试要求：
- Cursor adapter 只负责：
  - 读 stdin
  - 调 shared core
  - 输出 Cursor/host 约定 envelope
- 非 BMAD quiet-skip 由 shared core 提供判定

**Step 2: Run test to verify it fails**

Expected: FAIL

**Step 3: Write minimal implementation**

让 `_bmad/cursor/hooks/runtime-policy-inject.js` 变成真正的 Cursor adapter。

**Step 4: Run test to verify it passes**

Expected: PASS

---

## 8. Task E — 统一部署规则

**Files:**
- Modify: `scripts/init-to-root.js`
- Modify if needed: `packages/bmad-speckit/src/services/sync-service.js`
- Test: `tests/acceptance/runtime-hooks-deploy-layering.test.ts`

**Step 1: Write the failing test**

测试要求：
- init 部署时：
  - `.claude/hooks/` 拿到 Claude adapter + shared helpers
  - `.cursor/hooks/` 拿到 Cursor adapter + shared helpers
- Cursor 不再通过“优先复制 Claude 源 hook”隐式复用
- 源与目标关系清晰可断言

**Step 2: Run test to verify it fails**

Expected: FAIL

**Step 3: Write minimal implementation**

部署策略改成：
- shared helpers 从 `_bmad/runtime/hooks/` 部署
- Claude adapter 从 `_bmad/claude/hooks/` 部署
- Cursor adapter 从 `_bmad/cursor/hooks/` 部署

**Step 4: Run test to verify it passes**

Expected: PASS

---

## 9. Task F — 回写文档与目录语义

**Files:**
- Modify: `docs/design/runtime-governance-implementation-analysis.md`
- Modify: `docs/reference/cursor-runtime-governance-hooks.md`
- Modify: `docs/how-to/runtime-governance-auto-inject-cursor-claude.md`

**Step 1: Update docs**

需要明确：
- shared canonical logic 位于 `_bmad/runtime/hooks/`
- Claude/ Cursor adapter 位于各自目录
- 部署规则和旧结构差异

**Step 2: Verify docs tests**

Run relevant docs tests.
Expected: PASS

---

## 10. Task G — 最终验证

**Step 1: Run new hook-layering tests**

Run all新增 tests.
Expected: PASS

**Step 2: Re-run hook-related acceptance tests**

至少重跑：
- `runtime-policy-inject.test.ts`
- `runtime-policy-emit-stable.test.ts`
- `runtime-policy-inject-auto-trigger-boundary.test.ts`
- `cursor-hooks-primary-path.test.ts`
- `runtime-language-english-hook-surface.test.ts`
- `runtime-language-english-missing-stage-surface.test.ts`

**Step 3: Re-run runtime broad suite if hook changes are substantial**

Expected: PASS

---

## 11. 完成标准

只有同时满足以下条件，才算 hooks 三层结构重构完成：

1. `_bmad/runtime/hooks/` 成为 shared canonical logic
2. `_bmad/claude/hooks/` 成为 Claude adapter 层
3. `_bmad/cursor/hooks/` 成为 Cursor adapter 层
4. shared 层不直接输出宿主 envelope
5. init 部署规则明确区分 shared + adapter
6. hook 相关 acceptance tests 全部通过
7. 现有 runtime 行为不回退

---

Plan complete and saved to `docs/plans/2026-03-23-hooks-runtime-layer-refactor-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
