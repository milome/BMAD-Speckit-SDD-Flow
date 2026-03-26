# Spec E15-S2：i18n 双语全链路完整实施

*Story 15.2 技术规格*  
*Epic 15 runtime-governance-and-i18n*

---

## 1. 概述

本 spec 将 Story 15.2 固化为可执行技术规格，覆盖：

1. **i18n 入口**：`resolveLanguagePolicyForSession`（`scripts/i18n/resolve-for-session.ts`）；在 **`runtime-policy-inject-core.js`** 中接入并输出 `resolvedMode`。
2. **Runtime context**：`languagePolicy.resolvedMode` 写入 `_bmad-output/runtime/context/project.json`（或计划等效路径）。
3. **Manifests**：`_bmad/i18n/manifests/` 下四个 `speckit.audit.*.yaml`，zh/en 完整；`loadManifest` + `renderTemplate`。
4. **审计报告**：auditor 可解析块由 manifest 或双文件 block 驱动（T4.1–T4.5）。
5. **Scoring**：`packages/scoring/parsers` 双语正则；`code-reviewer-config.yaml` 补 `name_en`；`dimension-parser` 匹配英文维度名。
6. **Skills**：计划 Phase 5 表所列 12 个 skill 的 `SKILL.zh.md` / `SKILL.en.md`；init 部署与按 `resolvedMode` 加载。
7. **测试**：`tests/i18n/`、`packages/scoring/parsers/__tests__/`、`tests/acceptance/i18n-*.test.ts`；`npm test` 全绿或正式排除。

**输入来源**：

- Story：`_bmad-output/implementation-artifacts/epic-15-runtime-governance-and-i18n/story-2-i18n-bilingual-full-implementation/15-2-i18n-bilingual-full-implementation.md`
- 计划：`docs/plans/2026-03-23-i18n-bilingual-full-implementation-plan.md`
- 设计：`docs/design/i18n-bilingual-implementation-design.md`

---

## 2. 需求追溯

| 来源 | 要点 | spec 章节 | 覆盖 |
|------|------|-------------|------|
| epics.md Story 15.2 | Then/And 全条 | §3 | ✅ |
| 计划 §1 表 | 9 行覆盖范围 | §3 | ✅ |
| 计划 §5 | T1–T6 完成定义 | §4 | ✅ |
| Story AC-A1–AC-C | 14+1 条 | §3–§4 | ✅ |

（PRD 级 REQ-ID 未单独编号时，以 epics + 计划为权威追溯。）

---

## 3. 功能规格

### 3.1 Phase 1：入口与 context（T1.1–T1.4）

| ID | 行为规格 | 验收信号 |
|----|-----------|----------|
| T1.1 | 导出 `resolveLanguagePolicyForSession`，组合 `getI18nConfig` + `resolveLanguagePolicy` | 单元测试：英/中指令 → `resolvedMode` |
| T1.2 | core 内读 userMessage，调用 T1.1，JSON 含 `resolvedMode` | stdin「请用英文」→ `en` |
| T1.3 | context 文件含 `languagePolicy.resolvedMode` | 文件存在且字段存在 |
| T1.4 | `getI18nConfig` 字段完整 | 配置项齐全 |

### 3.2 Phase 2：Manifests（T2.1–T2.6）

四个 YAML manifest；`loadManifest`；init 后可读。

### 3.3 Phase 3：Scoring（T3.1–T3.7）

`extractOverallGrade` 多语；`extractCheckItems*` 双语段界与 Severity；`name_en` 与 dimension-parser。

### 3.4 Phase 4：审计打通（T4.1–T4.5）

auditor 文档与 manifest/block 一致；**T4.5** 在 `tasks-E15-S2.md` 写死一条端到端主路径。

### 3.5 Phase 5：Skills（T5.1–T5.16）

按计划 §3 Phase 5 表路径；`.cursor/skills` / `.claude/skills` 双语部署；加载逻辑按 `resolvedMode`。

### 3.6 Phase 6：测试（T6.1–T6.5）

见 Story Tasks；`npm test` 门禁。

---

## 4. 验收与 Phase 完成（对齐计划 §5）

与 `docs/plans/2026-03-23-i18n-bilingual-full-implementation-plan.md` **§5** 六段逐条一致；全量以 `npm test` 与 Story 回归列表为准。

---

## 5. 非功能约束

- 禁止词：计划 **§2**。
- 回归：Story Dev Notes「Story 15.1 回归门禁」+ 条件 `runtime-language-english-chain-milestone`。
- TDD：先测后实现；禁止伪实现。

---

<!-- AUDIT: PASSED by code-reviewer -->
