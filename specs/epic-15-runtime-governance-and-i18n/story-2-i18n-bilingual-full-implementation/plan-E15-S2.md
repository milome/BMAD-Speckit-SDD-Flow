# Plan E15-S2：i18n 双语全链路 — 实现方案

*对应 spec：`spec-E15-S2.md`*

---

## 1. 架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| Hook 扩展点 | `_bmad/runtime/hooks/runtime-policy-inject-core.js` | Story 15.1 已收敛 core；双 host 行为一致 |
| 调用 TS | `spawnSync` + `npx ts-node` 调用 `resolve-for-session.ts` | 与 `run-emit-runtime-policy.js` 子进程模式一致 |
| 审计块来源 | manifest 优先；否则 auditor-spec-block.zh/en | 计划 Phase 4 |
| T4.5 主路径 | 在 `tasks-E15-S2.md` 锁定单一路径 | 防止实现分叉 |

---

## 2. 依赖与顺序

执行顺序：Phase 1 → 2 → 3 → 4 → 5 → 6。  
依赖：T2→T1；T4→T2；T5→T1；T3 可与 T2 并行（见计划 §4）。

---

## 3. 模块与文件映射（摘要）

- `scripts/i18n/resolve-for-session.ts`（新建）、既有 `detect-language.ts`、`language-policy.ts`、`render-template.ts`
- `_bmad/runtime/hooks/runtime-policy-inject-core.js`（改）
- `_bmad-output/runtime/context/`（T1.3）
- `_bmad/i18n/manifests/*.yaml`（新建）
- `packages/scoring/parsers/*`、`dimension-parser.ts`、`_bmad/_config/code-reviewer-config.yaml`
- `_bmad/claude/agents/auditors/auditor-*.md`、T4.5 选定 workflow step 或 hook
- `scripts/init-to-root.js`、12 skills 目录（计划表）

---

## 4. 测试策略

- 单元：`tests/i18n/`、`packages/scoring/parsers/__tests__/`
- 集成：`npm run test:scoring`（Phase 3）
- 验收：`tests/acceptance/i18n-*.test.ts`；全量 `npm test`
- 回归：Story 15.1 列表 + `runtime-language-english-chain-milestone`（条件）

---

## 5. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Hook 破坏 15.1 回归 | 每批改后跑 Dev Notes 列表 |
| TS 子进程失败 | 与现有 `ts-node` 路径一致；单测 mock |
| 12 skills 体积大 | 按 Phase 5 表分批提交 |

---

<!-- AUDIT: PASSED by code-reviewer -->
