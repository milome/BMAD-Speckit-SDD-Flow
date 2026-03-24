# spec-E2-S1：Runtime Governance Phase C – BMAD Workflow 节点接入 context/registry 同步

**Epic**：E2 runtime-governance-complete  
**Story ID**：2.1  
**来源**：`docs/plans/2026-03-22-runtime-governance-runtime-context-重构实施计划文档.md` Phase C 全部任务（Task C1–C4）

---

## 1. 范围与目标

### 1.1 本 spec 覆盖

将 BMAD workflow 节点（sprint-planning、sprint-status、create-epics-and-stories、create-story、story audit、dev-story、post-audit）接入显式 context/registry 同步，使各入口在完成时自动调用 `buildProjectRegistryFromSprintStatus`、`writeRuntimeContextFromSprintStatus`、`ensureProjectRuntimeContext`、`ensureStoryRuntimeContext`、`ensureRunRuntimeContext` 等函数，或执行 `scripts/sync-runtime-context-from-sprint.ts`。**当前状态：Phase C 全部未完成，`_bmad/bmm` 下无任何对 sync/ensure 函数的调用。**

### 1.2 功能边界

| 包含 | 不包含 |
|------|--------|
| sprint-planning / sprint-status 完成后刷新 project context + registry | emit 消费逻辑修改（Phase D） |
| create-epics-and-stories 完成后刷新 epic/story contexts | sourceMode 回归（Phase E） |
| create-story / story audit 完成后刷新 story context | 自动触发入口责任（Story 2.2） |
| dev-story / post-audit 入口调用 run context 创建与 activeScope 切换 | hook 部署（Story 2.3） |

---

## 2. 需求映射与未完成任务

| 计划文档 Task | 入口 | 必须调用的函数/脚本 | 目标产物 | 当前状态 |
|---------------|------|---------------------|----------|----------|
| C1 | sprint-planning / sprint-status | `ensureProjectRuntimeContext` 或 `scripts/sync-runtime-context-from-sprint.ts` | `_bmad-output/runtime/registry.json`、`_bmad-output/runtime/context/project.json` 刷新 | **未完成** |
| C2 | create-epics-and-stories | `ensureStoryRuntimeContext`、epic refresh | `_bmad-output/runtime/context/epics/{epicId}.json`、registry.epicContexts 填充 | **未完成** |
| C3 | create-story / story audit | story context 刷新、registry 更新 | `_bmad-output/runtime/context/stories/{epicId}/{storyId}.json` | **未完成** |
| C4 | dev-story / post-audit | `ensureRunRuntimeContext`、activeScope 切换 | `_bmad-output/runtime/context/runs/{epicId}/{storyId}/{runId}.json`、lifecycleStage/workflowStage | **未完成** |

---

## 3. 必须修改的具体路径

| 修改类型 | 具体路径 | 修改内容 |
|----------|----------|----------|
| Modify | `_bmad/bmm/workflows/4-implementation/sprint-planning/` | workflow 完成步骤后追加调用 sync；或在 instructions/step 末尾触发 `sync-runtime-context-from-sprint.ts` |
| Modify | `_bmad/bmm/workflows/4-implementation/sprint-status/`（若存在） | 同上 |
| Modify | `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/` | 完成 step 后调用 `ensureStoryRuntimeContext` 或 epic context 刷新 |
| Modify | `_bmad/bmm/workflows/4-implementation/create-story/` | create-story instructions 完成步后调用 story context 刷新 |
| Modify | `_bmad/bmm/workflows/4-implementation/bmad-create-story/` | 同上（若为不同入口） |
| Modify | story audit 入口 | 审计完成步后刷新 story context |
| Modify | `_bmad/bmm/workflows/4-implementation/dev-story/` 或 `bmad-dev-story` | 入口调用 `ensureRunRuntimeContext`，设 lifecycleStage=dev_story |
| Modify | post-audit 入口 | 入口调用 run context 创建，lifecycleStage=post_audit |
| Modify | `scripts/runtime-context.ts` | 确认 `writeRuntimeContextFromSprintStatus`、`buildProjectRegistryFromSprintStatus` 已实现 |
| Modify | `scripts/runtime-context-registry.ts` | 确认 `ensureProjectRuntimeContext`、`ensureStoryRuntimeContext`、`ensureRunRuntimeContext` 已实现 |
| Modify | `scripts/sync-runtime-context-from-sprint.ts` | 确认脚本可被 workflow 调用 |

---

## 4.  mandatory 验收测试（完整列表，禁止遗漏）

以下测试在完成本 Story 后必须全部 PASS：

```
tests/acceptance/runtime-context-project-sync.test.ts
tests/acceptance/runtime-context-epic-sync.test.ts
tests/acceptance/runtime-context-story-sync.test.ts
tests/acceptance/runtime-context-run-sync.test.ts
```

---

## 5. 设计基线

- `docs/plans/2026-03-21-runtime-governance-去鸡肋化分析与-bmad-原生上下文同步重构建议.md`
- `docs/plans/2026-03-22-runtime-governance-正式架构设计文档-bmad原生上下文同步版.md`
- `docs/plans/2026-03-22-runtime-context-registry-详细设计文档.md`
- `docs/plans/2026-03-22-bmad-工作流全流程分析文档.md`

---

## 6. 禁止词表

禁止使用：可选、后续、待定、酌情、视情况、先实现、或后续扩展。
