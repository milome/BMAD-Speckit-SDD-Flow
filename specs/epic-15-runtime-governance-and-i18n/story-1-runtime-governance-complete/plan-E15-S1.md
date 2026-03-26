# plan-E15-S1：Runtime Governance 完整实施 实现方案

**Epic**：E15 runtime-governance-and-i18n  
**Story ID**：15.1  
**输入**：spec-E15-S1.md、Story 15.1、docs/plans/2026-03-23-story-2-1-sprint-breakdown.md

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story | workflow 接入、registry 自动触发、hooks 三层重构 | Phase 1–6 | ✅ |
| AC1 | spec §3.4.1 | Phase 4 S8 | ✅ |
| AC2 | spec §3.4.2, §3.4.3 | Phase 4 S9–S11 | ✅ |
| AC3 | spec §3.3 | Phase 3 S6 | ✅ |
| AC4 | spec §3.5 | Phase 5 S12–S14 | ✅ |
| AC5 | spec §3.2 | Phase 1–2 S2, S4–S5, S7 | ✅ |
| AC6 | spec §4 | 全部 Phase 验收 | ✅ |
| spec §3.2 | Hooks 三层 | Phase 1–2 | ✅ |
| spec §3.4 | Phase C sync | Phase 4 | ✅ |
| spec §3.5 | 三种 sourceMode | Phase 5 | ✅ |
| spec §3.6, §3.7 | Hook 边界、文档 | Phase 6 | ✅ |
| Sprint 拆分依赖 | S2–S16 批次 | plan Phase 1–6 | ✅ |

---

## 2. 目标与约束

**目标**：完成 Runtime Governance 的 workflow 接入、registry 自动触发与 hooks 三层重构，用户无需手工补 registry/context。

**约束**：
- 不改变 `resolveRuntimePolicy` / `emit-runtime-policy` 治理内核
- 优先在 wrapper/entrypoint 层补 ensure* 调用
- TDD：每个子任务先写 failing test 再实现

**执行基线**：S1、S3 已 PASS，从 S2 起手。

---

## 3. 架构设计

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│  BMAD Workflow 入口（sprint-status、create-story、dev-story…）  │
│  → 调用 ensure* / detectRuntimeSourceMode                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  scripts/runtime-context-registry.ts、runtime-context.ts         │
│  → buildProjectRegistryFromSprintStatus、writeRuntimeContext   │
│  → ensureProjectRuntimeContext、ensureStoryRuntimeContext…       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  _bmad-output/runtime/registry.json、context/project|epic|story|run │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  scripts/emit-runtime-policy.ts → resolveRuntimePolicy            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  _bmad/runtime/hooks/ (shared) → _bmad/claude|cursor/hooks/      │
│  → .claude|.cursor/hooks/runtime-policy-inject.js                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Hooks 三层结构

| 层 | 路径 | 职责 |
|----|------|------|
| Shared | `_bmad/runtime/hooks/` | root 解析、emit 调用、quiet-skip/fail-loud、错误拼装 |
| Claude adapter | `_bmad/claude/hooks/` | stdin 读取、调 shared、输出 Claude envelope |
| Cursor adapter | `_bmad/cursor/hooks/` | stdin 读取、调 shared、输出 Cursor envelope |
| 部署 | `.claude/hooks/`、`.cursor/hooks/` | init 时从 _bmad 复制 shared + adapter |

---

## 4. 实施阶段

### Phase 1：Hooks shared core（S2）

**依赖**：S1 已 PASS。

| 任务 | 产出 | 验收 |
|------|------|------|
| 2.1 | `_bmad/runtime/hooks/runtime-policy-inject-core.js` | `runtime-hooks-shared-core.test.ts` |
| 2.2 | `run-emit-runtime-policy.js`、`should-skip-runtime-policy.js`、`build-runtime-error-message.js` | 同上 |

**实现要点**：
- shared core 返回统一结果结构 `{ status, mode, root, skip, errorText, policyJson }`
- 非 BMAD 上下文 quiet-skip 判断在 shared 层可复用
- 不输出宿主 envelope

### Phase 2：Hooks adapters（S4、S5）

**依赖**：S2。

| 任务 | 产出 | 验收 |
|------|------|------|
| S4 | `_bmad/claude/hooks/runtime-policy-inject.js` 改为仅调 shared core | `runtime-hooks-claude-adapter.test.ts` |
| S5 | `_bmad/cursor/hooks/runtime-policy-inject.js` 改为仅调 shared core | `runtime-hooks-cursor-adapter.test.ts` |

### Phase 3：Init & Deploy（S6、S7）

**依赖**：S3 已 PASS（auto-trigger 契约）；S2。

| 任务 | 产出 | 验收 |
|------|------|------|
| S6 | `scripts/init-to-root.js` 在 bootstrap project context 后追加 registry bootstrap | `runtime-init-auto-registry-bootstrap.test.ts` |
| S7 | init 部署 shared helpers 到 `.claude/hooks/`、`.cursor/hooks/`，源为 `_bmad/runtime/hooks/` | `runtime-hooks-deploy-layering.test.ts` |

### Phase 4：Phase C Workflow 接入（S8–S11）

**依赖**：S3（ensure* 接口）；S8→S9→S10→S11 顺序。

| 任务 | 入口 | 行为 | 验收 |
|------|------|------|------|
| S8 | sprint-planning、sprint-status | 完成时调用 ensureProjectRuntimeContext | `runtime-context-project-sync.test.ts` |
| S9 | create-epics-and-stories | 完成时刷新 epic contexts | `runtime-context-epic-sync.test.ts` |
| S10 | create-story、story audit | 完成时刷新 story context | `runtime-context-story-sync.test.ts` |
| S11 | dev-story、post-audit | 启动时生成 run context；完成后持久化至 registry | `runtime-context-run-sync.test.ts` |

**接线策略**：在 workflow 入口/wrapper 层补 ensure* 调用；必要时改 `_bmad/bmm/workflows/` 下的 workflow 步骤，但不改 workflow 本体结构。

### Phase 5：三种 sourceMode 自动触发（S12–S14）

**依赖**：S3；S8、S9（S12 full_bmad）。

| 任务 | 模式 | 验收 |
|------|------|------|
| S12 | full_bmad 入口自动刷新 | `runtime-context-full-bmad-auto-trigger.test.ts` |
| S13 | seeded_solutioning 自动建 registry/context | `runtime-context-seeded-solutioning-auto-trigger.test.ts` |
| S14 | standalone_story 自动建 story/run context | `runtime-context-standalone-story-auto-trigger.test.ts` |

### Phase 6：边界与文档（S15、S16）

**依赖**：S7、S11；S12–S14。

| 任务 | 产出 | 验收 |
|------|------|------|
| S15 | Hook 边界：只消费已有 context，不伪造业务状态 | `runtime-policy-inject-auto-trigger-boundary.test.ts` |
| S16 | 更新 runtime-governance-implementation-analysis.md、docs/reference/、docs/how-to/ | 责任矩阵、部署规则、自动触发入口链 |

---

## 5. 集成测试与端到端功能测试计划（必须）

### 5.1 Hooks 集成

| 测试 | 覆盖 | 命令 | 预期 |
|------|------|------|------|
| runtime-hooks-shared-core | S2 | `npx vitest run tests/acceptance/runtime-hooks-shared-core.test.ts` | PASS |
| runtime-hooks-claude-adapter | S4 | `npx vitest run tests/acceptance/runtime-hooks-claude-adapter.test.ts` | PASS |
| runtime-hooks-cursor-adapter | S5 | `npx vitest run tests/acceptance/runtime-hooks-cursor-adapter.test.ts` | PASS |
| runtime-hooks-deploy-layering | S7 | `npx vitest run tests/acceptance/runtime-hooks-deploy-layering.test.ts` | init 后 .claude/.cursor/hooks 含 shared helpers |

### 5.2 Phase C 集成

| 测试 | 覆盖 | 预期 |
|------|------|------|
| runtime-context-project-sync | S8 | sprint-status 更新后 project context + registry 被刷新 |
| runtime-context-epic-sync | S9 | create-epics-and-stories 后 epic contexts 被填充 |
| runtime-context-story-sync | S10 | create-story 后 story context 被刷新 |
| runtime-context-run-sync | S11 | dev-story/post-audit 后 run context 被创建并持久化 |

### 5.3 三种 sourceMode 端到端

| 测试 | 覆盖 | 预期 |
|------|------|------|
| runtime-context-full-bmad-auto-trigger | S12 | full_bmad 主链无需手工补 registry/context |
| runtime-context-seeded-solutioning-auto-trigger | S13 | seeded_solutioning 入口自动建 registry/context |
| runtime-context-standalone-story-auto-trigger | S14 | standalone_story 入口自动建 story/run context |

### 5.4 生产代码关键路径验证

- **ensure* 调用链**：sprint-status、create-epics-and-stories、create-story、dev-story、post-audit 入口须在生产流程中被实际调用；验证方式：执行对应 workflow 步骤，确认 registry/context 被写入
- **Hooks 部署链**：`npx bmad-speckit init .` 后，`.claude/hooks/` 与 `.cursor/hooks/` 须含 shared helpers 且来自 `_bmad/runtime/hooks/`
- **37 个 acceptance tests**：全部 PASS 作为最终验收门禁

---

## 6. 验收策略

**批次验收**：每 Phase 完成后运行该 Phase 对应的 acceptance tests。

**最终验收**：

```bash
npx vitest run tests/acceptance/runtime-context-registry-schema.test.ts \
  tests/acceptance/runtime-governance-lifecycle-workflow-stage.test.ts \
  tests/acceptance/runtime-context-source-mode.test.ts \
  tests/acceptance/runtime-context-registry-io.test.ts \
  tests/acceptance/runtime-context-paths.test.ts \
  tests/acceptance/runtime-context-active-scope.test.ts \
  tests/acceptance/runtime-context-project-sync.test.ts \
  tests/acceptance/runtime-context-epic-sync.test.ts \
  tests/acceptance/runtime-context-story-sync.test.ts \
  tests/acceptance/runtime-context-run-sync.test.ts \
  tests/acceptance/runtime-policy-registry-consumption.test.ts \
  tests/acceptance/runtime-policy-no-speckit-fallback.test.ts \
  tests/acceptance/runtime-policy-no-speckit-template-distribution.test.ts \
  tests/acceptance/runtime-policy-lifecycle-workflow-consumers.test.ts \
  tests/acceptance/runtime-context-full-bmad-mode.test.ts \
  tests/acceptance/runtime-context-seeded-solutioning-mode.test.ts \
  tests/acceptance/runtime-context-standalone-story-mode.test.ts \
  tests/acceptance/runtime-context-auto-trigger-contract.test.ts \
  tests/acceptance/runtime-init-auto-registry-bootstrap.test.ts \
  tests/acceptance/runtime-context-full-bmad-auto-trigger.test.ts \
  tests/acceptance/runtime-context-seeded-solutioning-auto-trigger.test.ts \
  tests/acceptance/runtime-context-standalone-story-auto-trigger.test.ts \
  tests/acceptance/runtime-policy-inject-auto-trigger-boundary.test.ts \
  tests/acceptance/runtime-hooks-layering-contract.test.ts \
  tests/acceptance/runtime-hooks-shared-core.test.ts \
  tests/acceptance/runtime-hooks-claude-adapter.test.ts \
  tests/acceptance/runtime-hooks-cursor-adapter.test.ts \
  tests/acceptance/runtime-hooks-deploy-layering.test.ts \
  tests/acceptance/runtime-context-full-chain-milestone.test.ts \
  tests/acceptance/runtime-language-english-chain-milestone.test.ts \
  tests/acceptance/runtime-policy-story-create-run-first-consumption.test.ts \
  tests/acceptance/runtime-policy-story-audit-run-first-consumption.test.ts \
  tests/acceptance/runtime-policy-workflow-stage-propagation.test.ts \
  tests/acceptance/runtime-policy-dev-story-plan-run-first-consumption.test.ts \
  tests/acceptance/runtime-policy-dev-story-tasks-run-first-consumption.test.ts \
  tests/acceptance/runtime-policy-post-audit-run-first-consumption.test.ts
```

预期：全部 PASS。

---

## 7. 参考文档

- [spec-E15-S1](spec-E15-S1.md)
- [Story 15.1](../../_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/15-1-runtime-governance-complete.md)
- [Sprint 拆分](../../../docs/plans/2026-03-23-story-2-1-sprint-breakdown.md)

<!-- AUDIT: PASSED by code-reviewer -->
