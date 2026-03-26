# IMPLEMENTATION_GAPS E15-S2

*基于 plan-E15-S2.md 与当前仓库现状的差距分析*

---

## 1. 差距清单

| GAP-ID | 描述 | 对应任务 | 状态 |
|--------|------|----------|------|
| GAP-E15-S2-001 | `scripts/i18n/resolve-for-session.ts` 未实现 | T1.1 | 已关闭 |
| GAP-E15-S2-002 | `runtime-policy-inject-core.js` 未接入会话语言与 `resolvedMode` 输出 | T1.2 | 待实现 |
| GAP-E15-S2-003 | `project.json` 未持久化 `languagePolicy.resolvedMode`（若尚无） | T1.3 | 待实现 |
| GAP-E15-S2-004 | `getI18nConfig` 可能缺字段 | T1.4 | 待核对 |
| GAP-E15-S2-005 | `_bmad/i18n/manifests/` 四 manifest 未齐 | T2.1–T2.4 | 待实现 |
| GAP-E15-S2-006 | `loadManifest` 未就绪 | T2.5 | 待实现 |
| GAP-E15-S2-007 | Scoring  parsers 英文路径未全覆盖 | T3.1–T3.7 | 待实现 |
| GAP-E15-S2-008 | auditor 与 manifest 未打通 | T4.1–T4.5 | 待实现 |
| GAP-E15-S2-009 | 12 skills 双语文件与加载 | T5.1–T5.16 | 待实现 |
| GAP-E15-S2-010 | i18n 专用测试与 acceptance | T6.1–T6.5 | 待实现 |

---

## 2. 关闭标准

每个 GAP 在对应任务完成且 `tasks-E15-S2.md` 勾选后标记为已关闭；全量 `npm test` 通过（或正式排除）。

---

<!-- AUDIT: PASSED by code-reviewer -->
