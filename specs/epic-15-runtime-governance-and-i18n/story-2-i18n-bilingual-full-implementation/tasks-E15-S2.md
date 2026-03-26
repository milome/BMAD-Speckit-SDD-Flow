# tasks-E15-S2

*与 `docs/plans/2026-03-23-i18n-bilingual-full-implementation-plan.md` §3 双源对齐*  
*多 Phase 一次性排期（批次 / 并行 / 回归）：见同目录 `PHASE_SCHEDULE_E15-S2.md`*

---

## T4.5 主路径锁定（避免分叉）

**唯一 PR 主路径**：在 `_bmad/claude/hooks/pre-agent-summary.js`（若仓库中该文件承担或可被扩展为「auditor 调用前」上下文注入）中实现：读取 runtime context 的 `languagePolicy` → `loadManifest` + `renderTemplate` → 将可解析块注入后续 prompt。  
**若**该 hook 不存在或不承担此职责：改为在 `_bmad/core/workflows/party-mode/steps/step-02-discussion-orchestration.md` 同逻辑注入。**禁止**同时在两处各写一套无统一定义的解析规则；第二路径仅在前一路径经代码审查确认不可用时启用，并须在 PR 描述中说明。

---

## Architecture约束

| 组件 | 约束 | 对应任务 |
|------|------|----------|
| runtime-policy-inject-core | 语言解析与 resolvedMode 输出 | T1.2 |
| emit / write-runtime-context | context 含 languagePolicy | T1.3 |
| packages/scoring | 双语解析与 name_en | T3.x |

---

## Phase 1

- [x] **T1.1** `scripts/i18n/resolve-for-session.ts` — `resolveLanguagePolicyForSession`；单测英/中 → `resolvedMode`
- [x] **T1.2** `_bmad/runtime/hooks/runtime-policy-inject-core.js` — 接入 T1.1，JSON 含 `resolvedMode`
- [x] **T1.3** context 写入 `languagePolicy.resolvedMode`
- [x] **T1.4** `scripts/bmad-config.ts` — `getI18nConfig` 完整

## Phase 2

- [x] **T2.1** `speckit.audit.spec.yaml`
- [x] **T2.2** `speckit.audit.plan.yaml`
- [x] **T2.3** `speckit.audit.tasks.yaml`
- [x] **T2.4** `speckit.audit.implement.yaml`
- [x] **T2.5** `loadManifest` + 校验
- [x] **T2.6** init 验证 manifests 可读

## Phase 3

- [x] **T3.1–T3.2** `audit-generic.ts`
- [x] **T3.3** `audit-prd.ts`
- [x] **T3.4** `audit-arch.ts`
- [x] **T3.5** `audit-story.ts`
- [x] **T3.6** `code-reviewer-config.yaml` — `name_en`
- [x] **T3.7** `dimension-parser.ts`

## Phase 4

- [x] **T4.1** `auditor-spec.md`
- [x] **T4.2** `auditor-plan.md`
- [x] **T4.3** `auditor-tasks.md`
- [x] **T4.4** `auditor-implement.md`
- [x] **T4.5** 按上文「T4.5 主路径锁定」实现端到端 en 可解析块

## Phase 5

- [x] **T5.1** bmad-bug-assistant（实际目录）SKILL.zh/en
- [x] **T5.2** （同上若与 T5.1 同目录则合并提交）
- [x] **T5.3** bmad-story-assistant
- [x] **T5.4** bmad-eval-analytics
- [x] **T5.5** speckit-workflow
- [x] **T5.6** using-git-worktrees
- [x] **T5.7** bmad-standalone-tasks
- [x] **T5.8** bmad-standalone-tasks-doc-review
- [x] **T5.9** bmad-rca-helper
- [x] **T5.10** bmad-code-reviewer-lifecycle
- [x] **T5.11** bmad-party-mode
- [x] **T5.12** bmad-customization-backup
- [x] **T5.13** git-push-monitor
- [x] **T5.14** `.cursor/skills` 部署双语
- [x] **T5.15** `.claude/skills` 部署双语
- [x] **T5.16** init/加载按 `resolvedMode`

## Phase 6

- [x] **T6.1** `tests/i18n/resolve-for-session.test.ts`
- [x] **T6.2** `tests/i18n/manifests-render.test.ts`
- [x] **T6.3** `packages/scoring/parsers/__tests__/` 英文 fixture
- [x] **T6.4** `tests/acceptance/i18n-*.test.ts`
- [x] **T6.5** `npm test` 全绿或正式排除

---

<!-- AUDIT: PASSED by code-reviewer -->
