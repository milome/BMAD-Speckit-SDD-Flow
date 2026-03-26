# IMPLEMENTATION_GAPS-E15-S1：Runtime Governance 完整实施

**Epic**：E15 runtime-governance-and-i18n  
**Story ID**：15.1  
**输入**：spec-E15-S1.md、plan-E15-S1.md、Story 15.1、当前实现

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| spec §3.2.1 S2 | GAP-1 | Hooks shared core：runtime-policy-inject-core.js、run-emit、should-skip、build-error-message | 已实现 | _bmad/runtime/hooks/ 下 4 个文件已存在；须通过 runtime-hooks-shared-core.test.ts 验证 |
| spec §3.2.2 S4–S5 | GAP-2 | Claude/Cursor adapter 仅调 shared core | 已实现 | _bmad/claude/hooks、_bmad/cursor/hooks 的 runtime-policy-inject.js 已改为调 shared；须通过 adapter 测试验证 |
| spec §3.3 S6 | GAP-3 | init 后自动生成最小 registry + project context | 已实现 | init-to-root.js 已调用 writeDefaultRuntimeRegistry、writeDefaultRuntimeContext；须通过 runtime-init-auto-registry-bootstrap.test.ts 验证 |
| spec §3.2.3 S7 | GAP-4 | init 部署 shared helpers 到 .claude/.cursor/hooks，源为 _bmad/runtime/hooks/ | 已实现 | init/sync 将 `_bmad/runtime/hooks/*.js` 部署到 `.claude/hooks/`、`.cursor/hooks/`；`runtime-hooks-deploy-layering.test.ts` 验证 |
| spec §3.4.1 S8 | GAP-5 | sprint-planning/sprint-status 完成时 sync registry/context | 已实现 | `sprint-planning`、`sprint-status` instructions 含 `bmad-speckit sync-runtime-context-from-sprint`；`runtime-context-project-sync`、`runtime-upstream-s8-sync-wiring` 验证 |
| spec §3.4.2 S9–S10 | GAP-6 | create-epics、create-story/story audit 完成时刷新 epic/story context | 已实现 | step-04、create-story、bmad-story-audit、Cursor `bmad-story-assistant` 含 sync；`runtime-context-epic-sync`、`runtime-context-story-sync`、upstream s9/s10 wiring 验证 |
| spec §3.4.3 S11 | GAP-7 | dev-story/post-audit 生成 run context；持久化 | 已实现 | `dev-story`、双端 skill 含 `ensure-run-runtime-context`；`runtime-context-run-sync`、`runtime-upstream-s11-sync-wiring` 验证 |
| spec §3.5 S12–S14 | GAP-8 | 三种 sourceMode 入口自动触发 | 已实现 | auto-trigger 与 mode 用例覆盖；见 `runtime-context-*-auto-trigger`、`runtime-context-*-mode` |
| spec §3.6 S15 | GAP-9 | Hook 边界：只消费不补状态 | 已实现 | runtime-policy-inject-auto-trigger-boundary.test.ts 验证 |
| spec §3.7 S16 | GAP-10 | 文档责任矩阵更新 | 已实现 | design/reference/how-to 与责任矩阵已对齐本 Story 接线 |

---

## 2. 风险与依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
| workflow 入口分散 | S8–S11 需改多个 workflow 步骤，可能漏接 | 按 sprint-breakdown 顺序 S8→S9→S10→S11 逐项接线，每步跑对应 acceptance test |
| init-to-root 改动集中 | S6、S7 若需同文件修改易冲突 | S6 已实现；S7 部署 shared 与现有 hooks 部署逻辑合并时注意顺序 |
| 依赖 S3 auto-trigger 契约 | S8–S14 依赖 ensure*、detectRuntimeSourceMode | S3 已 PASS，helper 层就绪 |

---

## 3. 实现差距分析

### 3.1 已实现部分

- **ensure* helper**：scripts/runtime-context.ts 中 ensureProjectRuntimeContext、ensureStoryRuntimeContext、ensureRunRuntimeContext 已实现
- **detectRuntimeSourceMode**：已实现
- **Hooks shared core**：_bmad/runtime/hooks/ 下 4 个文件已存在
- **init registry bootstrap**：init-to-root.js 已调用 writeDefaultRuntimeRegistry、writeDefaultRuntimeContext
- **emit 消费链**：registry-first、run-first 已落地

### 3.2 未实现 / 待验证部分

- **（已关闭）S8–S11 workflow 接线**：已在对应 `_bmad` instructions、Agent、Skill 中插入 sync / ensure-run；以 `runtime-upstream-s8`～`s11-sync-wiring` 与集成用例为验收依据。
- **（已关闭）S7 部署 shared**：`runtime-hooks-deploy-layering.test.ts` 验证 init/sync 部署路径。
- **（已关闭）S12–S14**：auto-trigger 与 `runtime-context-*-mode` 用例覆盖入口子串与契约。

### 3.3 验收测试与 Gap 映射

| 验收测试 | 覆盖 Gap | 预期 |
|----------|----------|------|
| runtime-hooks-shared-core.test.ts | GAP-1 | PASS |
| runtime-hooks-claude-adapter.test.ts | GAP-2 | PASS |
| runtime-hooks-cursor-adapter.test.ts | GAP-2 | PASS |
| runtime-init-auto-registry-bootstrap.test.ts | GAP-3 | PASS |
| runtime-hooks-deploy-layering.test.ts | GAP-4 | PASS |
| runtime-context-project-sync.test.ts | GAP-5 | PASS |
| runtime-context-epic-sync.test.ts | GAP-6 | PASS |
| runtime-context-story-sync.test.ts | GAP-6 | PASS |
| runtime-context-run-sync.test.ts | GAP-7 | PASS |
| runtime-context-full-bmad-auto-trigger.test.ts | GAP-8 | PASS |
| runtime-context-seeded-solutioning-auto-trigger.test.ts | GAP-8 | PASS |
| runtime-context-standalone-story-auto-trigger.test.ts | GAP-8 | PASS |
| runtime-policy-inject-auto-trigger-boundary.test.ts | GAP-9 | PASS |

---

## 4. 需求映射清单（GAPS ↔ spec + plan）

| spec 章节 | plan 对应 | Gaps 覆盖 | 覆盖状态 |
|-----------|----------|----------|----------|
| §3.2 Hooks | Phase 1–2 | GAP-1, GAP-2, GAP-4 | ✅ |
| §3.3 Init | Phase 3 | GAP-3 | ✅ |
| §3.4 Phase C | Phase 4 | GAP-5, GAP-6, GAP-7 | ✅ |
| §3.5 sourceMode | Phase 5 | GAP-8 | ✅ |
| §3.6–§3.7 边界与文档 | Phase 6 | GAP-9, GAP-10 | ✅ |

<!-- AUDIT: PASSED by code-reviewer -->
