# Spec E15-S1：Runtime Governance 完整实施

*Story 15.1 技术规格*  
*Epic 15 runtime-governance-and-i18n*

---

## 1. 概述

本 spec 将 Story 15.1 的实施范围固化为可执行技术规格，覆盖：

1. **Hooks 三层重构**：shared core（_bmad/runtime/hooks/）+ Claude/Cursor adapter，部署时含 shared helpers
2. **Registry 自动触发**：sprint-planning/sprint-status、create-epics-and-stories、create-story、dev-story/post-audit 完成后自动刷新对应 scope 的 context + registry
3. **Init 自动生成**：init 后自动生成最小 registry + project context
4. **三种 sourceMode 无手工补**：full_bmad、seeded_solutioning、standalone_story 入口均无需手工补 registry/context

**执行基线**：S1、S3 已 PASS；优先从 S2 起手。tasks 须反映 S2–S16 的依赖与批次。

**输入来源**：
- Story 15.1：`_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/15-1-runtime-governance-complete.md`
- 设计基线：`docs/plans/2026-03-22-runtime-governance-runtime-context-重构实施计划文档.md`、`2026-03-22-runtime-registry-context-auto-trigger-plan.md`、`2026-03-23-hooks-runtime-layer-refactor-plan.md`
- Sprint 拆分：`docs/plans/2026-03-23-story-2-1-sprint-breakdown.md`

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story | 完成 Runtime Governance 的 workflow 接入、registry 自动触发与 hooks 三层重构 | spec §1, §3 | ✅ |
| AC1 | sprint-planning / sprint-status 完成后自动刷新 project context + registry | spec §3.4.1 | ✅ |
| AC2 | create-epics-and-stories / create-story / dev-story / post-audit 完成后自动刷新对应 epic/story/run context | spec §3.4.2, §3.4.3 | ✅ |
| AC3 | init 后自动生成最小 registry + project context | spec §3.3 | ✅ |
| AC4 | full_bmad、seeded_solutioning、standalone_story 入口均无需手工补 registry/context | spec §3.5 | ✅ |
| AC5 | .claude/hooks/ 与 .cursor/hooks/ 部署时含 shared helpers，源来自 _bmad/runtime/hooks/ | spec §3.2 | ✅ |
| AC6 | 强制验收测试全部 PASS（37 个 acceptance tests） | spec §4 | ✅ |
| Tasks S2 | Hooks shared core（AC5 部分） | spec §3.2.1 | ✅ |
| Tasks S4–S5 | Hooks Claude/Cursor adapter | spec §3.2.2 | ✅ |
| Tasks S6–S7 | init 自动 registry、Hooks 部署规则 | spec §3.3, §3.2.3 | ✅ |
| Tasks S8–S11 | Phase C1–C4 sync | spec §3.4 | ✅ |
| Tasks S12–S14 | Auto full_bmad/seeded_solutioning/standalone_story | spec §3.5 | ✅ |
| Tasks S15–S16 | Hook 边界、文档责任矩阵 | spec §3.6, §3.7 | ✅ |
| Dev Notes 技术约束 | TDD、不改变治理内核、松耦合接入 | spec §5 | ✅ |

---

## 3. 功能规格

### 3.1 范围与边界

**范围内**：
- Hooks 三层结构（shared core + Claude/Cursor adapter + 部署规则）
- Registry/context 自动触发（sprint-status、create-epics-and-stories、create-story、dev-story、post-audit 入口）
- init 自动 bootstrap registry + project context
- 三种 sourceMode（full_bmad、seeded_solutioning、standalone_story）的自动触发
- Hook 边界（只消费不补状态）
- 文档责任矩阵更新

**边界外**：
- 不改变 `resolveRuntimePolicy` / `emit-runtime-policy` 的单一来源治理内核
- 不修改 _bmad upstream workflow 本体结构，仅在外围 entrypoint/wrapper 层补 ensure* 调用

### 3.2 Hooks 三层重构（AC5）

#### 3.2.1 S2：Hooks shared core

| 项 | 规格 |
|------|------|
| 产出路径 | `_bmad/runtime/hooks/runtime-policy-inject-core.js`、`run-emit-runtime-policy.js`、`should-skip-runtime-policy.js`、`build-runtime-error-message.js` |
| 职责 | root 解析、emit 调用、quiet-skip/fail-loud 分流、错误文本拼装；不输出宿主 envelope |
| 验收 | `runtime-hooks-shared-core.test.ts` PASS |

#### 3.2.2 S4–S5：Hooks Claude/Cursor adapter

| 项 | 规格 |
|------|------|
| Claude adapter | `_bmad/claude/hooks/runtime-policy-inject.js` 仅负责读 stdin、调 shared core、输出 Claude envelope |
| Cursor adapter | `_bmad/cursor/hooks/runtime-policy-inject.js` 仅负责读 stdin、调 shared core、输出 Cursor envelope |
| 验收 | `runtime-hooks-claude-adapter.test.ts`、`runtime-hooks-cursor-adapter.test.ts` PASS |

#### 3.2.3 S7：Hooks 部署规则

| 项 | 规格 |
|------|------|
| 部署源 | `.claude/hooks/` 与 `.cursor/hooks/` 的 shared helpers 来自 `_bmad/runtime/hooks/` |
| init 行为 | `scripts/init-to-root.js` 部署时含 shared helpers + adapter |
| 验收 | `runtime-hooks-deploy-layering.test.ts` PASS |

### 3.3 Init 自动生成 registry（AC3）

| 项 | 规格 |
|------|------|
| 修改路径 | `scripts/init-to-root.js` |
| 行为 | init 后 bootstrap 最小 registry（`_bmad-output/runtime/registry.json`）+ project context，`activeScope.scopeType = project` |
| 验收 | `runtime-init-auto-registry-bootstrap.test.ts` PASS |

### 3.4 Phase C Workflow 接入（AC1, AC2）

#### 3.4.1 S8：Phase C1 sprint sync（AC1）

| 项 | 规格 |
|------|------|
| 入口 | `_bmad/bmm/workflows/4-implementation/sprint-planning`、`sprint-status` |
| 行为 | 完成时调用 `ensureProjectRuntimeContext` 刷新 project context + registry |
| 验收 | `runtime-context-project-sync.test.ts` PASS |

#### 3.4.2 S9–S10：Phase C2–C3 create-epics/create-story sync（AC2）

| 项 | 规格 |
|------|------|
| create-epics-and-stories | 完成时刷新 epic contexts，registry 中 epicContexts 被填充 |
| create-story / story audit | 完成时刷新 story context |
| 验收 | `runtime-context-epic-sync.test.ts`、`runtime-context-story-sync.test.ts` PASS |

#### 3.4.3 S11：Phase C4 dev-story/post-audit sync（AC2）

| 项 | 规格 |
|------|------|
| dev-story | 启动时生成 run context（供 workflow 使用），`lifecycleStage = dev_story`，`workflowStage` 可跟随 speckit 子阶段；完成后持久化至 registry |
| post-audit | 启动时生成新 run context（供 workflow 使用），`lifecycleStage = post_audit`；完成后持久化至 registry |
| 验收 | `runtime-context-run-sync.test.ts` PASS |

### 3.5 三种 sourceMode 自动触发（AC4）

| 项 | 规格 |
|------|------|
| full_bmad | sprint-status、create-epics-and-stories、create-story、dev-story、post-audit 入口自动刷新，无需手工补 |
| seeded_solutioning | create-epics-and-stories、create-story 入口自动建 registry/context |
| standalone_story | create-story、dev-story 入口自动建 story/run context |
| 验收 | `runtime-context-full-bmad-auto-trigger.test.ts`、`runtime-context-seeded-solutioning-auto-trigger.test.ts`、`runtime-context-standalone-story-auto-trigger.test.ts` PASS |

### 3.6 S15：Hook 边界（不承担补状态）

| 项 | 规格 |
|------|------|
| 行为 | hook 只消费已有 context，不伪造业务 runtime state；非 BMAD 项目静默跳过 |
| 验收 | `runtime-policy-inject-auto-trigger-boundary.test.ts` PASS |

### 3.7 S16：文档责任矩阵

| 项 | 规格 |
|------|------|
| 文档 | 更新 `runtime-governance-implementation-analysis.md`、`docs/reference/`、`docs/how-to/` |
| 内容 | 责任矩阵、部署规则、自动触发入口链 |

---

## 4. 验收标准（AC6）

**强制验收**：以下 37 个 acceptance tests 全部 PASS：

```
tests/acceptance/runtime-context-registry-schema.test.ts
tests/acceptance/runtime-governance-lifecycle-workflow-stage.test.ts
tests/acceptance/runtime-context-source-mode.test.ts
tests/acceptance/runtime-context-registry-io.test.ts
tests/acceptance/runtime-context-paths.test.ts
tests/acceptance/runtime-context-active-scope.test.ts
tests/acceptance/runtime-context-project-sync.test.ts
tests/acceptance/runtime-context-epic-sync.test.ts
tests/acceptance/runtime-context-story-sync.test.ts
tests/acceptance/runtime-context-run-sync.test.ts
tests/acceptance/runtime-policy-registry-consumption.test.ts
tests/acceptance/runtime-policy-no-speckit-fallback.test.ts
tests/acceptance/runtime-policy-no-speckit-template-distribution.test.ts
tests/acceptance/runtime-policy-lifecycle-workflow-consumers.test.ts
tests/acceptance/runtime-context-full-bmad-mode.test.ts
tests/acceptance/runtime-context-seeded-solutioning-mode.test.ts
tests/acceptance/runtime-context-standalone-story-mode.test.ts
tests/acceptance/runtime-context-auto-trigger-contract.test.ts
tests/acceptance/runtime-init-auto-registry-bootstrap.test.ts
tests/acceptance/runtime-context-full-bmad-auto-trigger.test.ts
tests/acceptance/runtime-context-seeded-solutioning-auto-trigger.test.ts
tests/acceptance/runtime-context-standalone-story-auto-trigger.test.ts
tests/acceptance/runtime-policy-inject-auto-trigger-boundary.test.ts
tests/acceptance/runtime-hooks-layering-contract.test.ts
tests/acceptance/runtime-hooks-shared-core.test.ts
tests/acceptance/runtime-hooks-claude-adapter.test.ts
tests/acceptance/runtime-hooks-cursor-adapter.test.ts
tests/acceptance/runtime-hooks-deploy-layering.test.ts
tests/acceptance/runtime-context-full-chain-milestone.test.ts
tests/acceptance/runtime-language-english-chain-milestone.test.ts
tests/acceptance/runtime-policy-story-create-run-first-consumption.test.ts
tests/acceptance/runtime-policy-story-audit-run-first-consumption.test.ts
tests/acceptance/runtime-policy-workflow-stage-propagation.test.ts
tests/acceptance/runtime-policy-dev-story-plan-run-first-consumption.test.ts
tests/acceptance/runtime-policy-dev-story-tasks-run-first-consumption.test.ts
tests/acceptance/runtime-policy-post-audit-run-first-consumption.test.ts
```

---

## 5. 技术约束

| 约束 | 说明 |
|------|------|
| TDD | 每个子任务先写 failing test 再实现 |
| 治理内核不变 | `resolveRuntimePolicy` / `emit-runtime-policy` 继续单一来源 |
| 松耦合接入 | 优先在 wrapper/entrypoint 层补 ensure* 调用，避免大范围改写 workflow 本体 |

---

## 6. 涉及源文件（参考）

| 子域 | 路径 |
|------|------|
| Phase C | `_bmad/bmm/workflows/4-implementation/`、`_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/` |
| Auto-trigger | `scripts/init-to-root.js`、`scripts/runtime-context.ts`、`scripts/runtime-context-registry.ts` |
| Hooks | `_bmad/runtime/hooks/`、`_bmad/claude/hooks/`、`_bmad/cursor/hooks/`、`scripts/init-to-root.js`、`packages/bmad-speckit/src/services/sync-service.js` |

---

## 7. 参考文档

- [Story 15.1](../../_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-1-runtime-governance-complete/15-1-runtime-governance-complete.md)
- [Sprint 拆分](docs/plans/2026-03-23-story-2-1-sprint-breakdown.md)
- [Runtime Governance 实施计划](docs/plans/2026-03-22-runtime-governance-runtime-context-重构实施计划文档.md)
- [Auto Trigger 计划](docs/plans/2026-03-22-runtime-registry-context-auto-trigger-plan.md)
- [Hooks 重构计划](docs/plans/2026-03-23-hooks-runtime-layer-refactor-plan.md)
- [实现解析](docs/design/runtime-governance-implementation-analysis.md)

<!-- AUDIT: PASSED by code-reviewer -->
