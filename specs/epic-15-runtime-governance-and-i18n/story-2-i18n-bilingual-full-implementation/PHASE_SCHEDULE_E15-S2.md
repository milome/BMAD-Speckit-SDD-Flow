# Story 15.2 多 Phase 一次性排期（E15-S2）

**目的**：在不大改计划 §3/§4 的前提下，把剩余工作压成 **可并行轨道 + 串行批次**，便于子代理或多人按批认领。  
**双源**：`docs/plans/2026-03-23-i18n-bilingual-full-implementation-plan.md` §3 与 `tasks-E15-S2.md` 勾选为准。  
**当前进度**：T1.1 已完成；其余未勾选。

---

## 并行度总览

| 轨道 | Phase | 依赖 | 可与谁并行 |
|------|------|------|------------|
| **A** | Phase 1 收尾（T1.2–T1.4） | T1.1 ✅ | 无（门禁链起点） |
| **B** | Phase 2 全 | T1 完成（至少 T1.2+T1.3 提供 context 语义时更稳；最低 T1.2 有 `resolvedMode` 输出） | 与 T1.4 文档/配置并行 |
| **C** | Phase 3 | 无 T1 硬依赖（parser 与 hooks 解耦） | **与 Phase 2 并行**（计划 §4：T3 可与 T2 并行） |
| **D** | Phase 4 | **T2**（manifest + load） | 与 Phase 3 尾部并行（T4 前段改 auditor 文案可与 T3.x 并行，T4.5 需 T2.5） |
| **E** | Phase 5 | **T1**（加载路由） | T5.1–T5.13 文本与 T3 可部分并行；**T5.14–T5.16 依赖 init 逻辑，宜在 T5.1–T5.13 之后** |
| **F** | Phase 6 | 全链路基线 | 最后收口；T6.1 与 T1.1 已部分重叠，以**扩展用例**而非重复文件为主 |

---

## 批次排期（建议执行顺序）

### 批次 1 — Phase 1 闭环（T1.2 → T1.3 → T1.4）

| 顺序 | 任务 | 交付要点 | 回归 |
|------|------|----------|------|
| 1 | **T1.2** | `runtime-policy-inject-core.js` 调 `resolveLanguagePolicyForSession`；JSON 含 `resolvedMode` | Story 15.1 hooks 列表 + `runtime-language-english-chain-milestone` |
| 2 | **T1.3** | `project.json`（或等效）持久化 `languagePolicy.resolvedMode` | 同上 + 若动 emit 链再跑相关 acceptance |
| 3 | **T1.4** | `getI18nConfig` 字段完整 | `npm run test:bmad` 或定向单测 |

**批次 1 完成定义**：计划 §5「T1 完成」。

---

### 批次 2 — Phase 2（T2.1–T2.6）可与批次 3 并行启动

| 顺序 | 任务 | 说明 |
|------|------|------|
| 1 | T2.1–T2.4 | 四个 manifest YAML |
| 2 | T2.5 | `loadManifest` + 校验 |
| 3 | T2.6 | init 后可读 manifest |

**并行**：批次 2 与 **批次 3** 同时开工（不同目录，冲突少）。

**批次 2 完成定义**：计划 §5「T2 完成」。

---

### 批次 3 — Phase 3（T3.1–T3.7）与批次 2 并行

| 顺序 | 任务 | 说明 |
|------|------|------|
| 1 | T3.1–T3.2 | `audit-generic` 双语 |
| 2 | T3.3–T3.5 | prd/arch/story parsers |
| 3 | T3.6 + T3.7 | `name_en` + `dimension-parser` |

**中间门禁**：每批 `npm run test:scoring`（计划与 Story 已约定）。

**批次 3 完成定义**：计划 §5「T3 完成」。

---

### 批次 4 — Phase 4（T4.1–T4.5）

**依赖**：T2.5 可用；**T4.5** 严格按 `tasks-E15-S2.md` 顶部「T4.5 主路径锁定」单一路径。

**批次 4 完成定义**：计划 §5「T4 完成」。

---

### 批次 5 — Phase 5（建议再拆 5a / 5b）

| 子批 | 任务 | 说明 |
|------|------|------|
| **5a** | T5.1–T5.13 | 12 个 skill 的 SKILL.zh/en（可按 skill 分子 PR） |
| **5b** | T5.14–T5.16 | 部署到 `.cursor/skills` / `.claude/skills` + init 加载；依赖 5a 与 T1 |

**批次 5 完成定义**：计划 §5「T5 完成」。

---

### 批次 6 — Phase 6（T6.1–T6.5）收口

| 任务 | 说明 |
|------|------|
| T6.1 | 在已有 `resolve-for-session` 测试上**扩展边界**（勿重复造） |
| T6.2–T6.4 | manifest 渲染、scoring 英文 fixture、acceptance `i18n-*.test.ts` |
| T6.5 | 全量 `npm test`；正式排除须走流程与 `EXCLUDED_TESTS_15-2.md` |

**批次 6 完成定义**：计划 §5「T6 完成」+ Story AC-B5。

---

## 推荐时间线（逻辑顺序，非日历）

```
批次1 ─[T1 完成]──┬──► 批次4（需 T2）
                  │
批次2 ─[T2 完成]──┘
批次3 ──────────────── 并行批次2 ──► 批次4
批次5a ──────────────── 可与批次3/4 部分重叠（仅文档）
批次5b ──────────────── 在 T1 + 5a 后
批次6 ───────────────── 最后（全链）
```

---

## 子代理 / Dev Story 拆分建议

- **子任务 A**：批次 1（仅 hooks + context + config）  
- **子任务 B**：批次 2 + 3（并行）  
- **子任务 C**：批次 4  
- **子任务 D**：批次 5a → 5b  
- **子任务 E**：批次 6  

每子任务结束：更新 `progress.e15-s2.txt`、勾选 `tasks-E15-S2.md`、必要时跑阶段四增量审计。

---

## 参考命令速查

```bash
npm run test:scoring
npx vitest run tests/i18n/resolve-for-session.test.ts
npx vitest run tests/acceptance/runtime-hooks-shared-core.test.ts tests/acceptance/runtime-hooks-claude-adapter.test.ts tests/acceptance/runtime-hooks-cursor-adapter.test.ts tests/acceptance/runtime-hooks-deploy-layering.test.ts tests/acceptance/runtime-upstream-s8-sync-wiring.test.ts tests/acceptance/runtime-upstream-s9-sync-wiring.test.ts tests/acceptance/runtime-upstream-s10-sync-wiring.test.ts tests/acceptance/runtime-upstream-s11-sync-wiring.test.ts
npx vitest run tests/acceptance/runtime-language-english-chain-milestone.test.ts
npm test
```
