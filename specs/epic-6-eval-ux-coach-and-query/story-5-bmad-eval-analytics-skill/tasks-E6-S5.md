# Tasks: bmad-eval-analytics Skill (E6-S5)

**Input**：`spec-E6-S5.md`、`plan-E6-S5.md`、`IMPLEMENTATION_GAPS-E6-S5.md`  
**Scope**：Story 6.5 全部（新建 Skill 文档、触发短语配置、验收）  
**执行方式**：按 T1 → T2 顺序推进

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 6.5, GAPS | §3.1(1)-(4), GAP-E6-S5-1～4 | 新建 Skill、触发短语、复用 coach-diagnose |
| T2 | Story 6.5, GAPS | §4 AC-1～AC-3, GAP-E6-S5-5 | 验收命令、自然语言触发验证 |

---

## 2. Phase 1：Skill 文档与触发短语（T1）

**AC**：GAP-E6-S5-1～4；AC-1, AC-3  
**集成验证**：Skill 文档存在且内容符合 spec

- [x] **T1.1** 新建 `skills/bmad-eval-analytics/SKILL.md`（目录若不存在则创建）
- [x] **T1.2** 在 SKILL.md 中：`description` 说明本 Skill 用于自然语言触发 Coach 诊断；`when to use` 明确列出触发短语：「帮我看看短板」「最近一轮的 Coach 报告」「诊断一下」「看看评分短板」；指引：当用户说出上述短语时，Agent 应执行 `npx ts-node scripts/coach-diagnose.ts` 获取 Coach 诊断，与 /bmad-coach 共用该脚本，无重复实现 discovery 或 coach 逻辑
- [x] **T1.3** 确保 SKILL.md 无禁止词（可选、待后续、待定等）

---

## 3. Phase 2：验收（T2）

**AC**：GAP-E6-S5-5；AC-1, AC-2  
**集成验证**：验收命令可执行；自然语言触发由人工或 Cursor 验证

- [x] **T2.1** 执行验收命令 `npx ts-node scripts/coach-diagnose.ts`：有数据时输出 Markdown 诊断；无数据时输出「暂无评分数据，请先完成至少一轮 Dev Story」
- [x] **T2.2** 验收方式说明：在 Cursor 中加载本 Skill 后，说「帮我看看短板」或「最近一轮的 Coach 报告」，Agent 应执行 coach-diagnose 并展示诊断

---

## 4. 验收命令汇总

| 命令 | 覆盖 |
|------|------|
| `npx ts-node scripts/coach-diagnose.ts` | T2.1, AC-1, AC-2, AC-3 |
| 在 Cursor 中说「帮我看看短板」 | AC-1 |
| 在 Cursor 中说「最近一轮的 Coach 报告」 | AC-2 |

---

## 5. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §3.1(1) | GAP-E6-S5-1 | ✓ 有 | T1.1 |
| Story §3.1(2)-(4) | GAP-E6-S5-2～4 | ✓ 有 | T1.2, T1.3 |
| Story §4 AC-1 | GAP-E6-S5-5 | ✓ 有 | T2.1, T2.2 |
| Story §4 AC-2 | GAP-E6-S5-6 | — | coach-diagnose 已满足 |
| Story §4 AC-3 | GAP-E6-S5-7 | ✓ 有 | T1.2 |

---

## 6. 完成判定标准

- T1～T2 全部任务完成并勾选。
- AC-1～AC-3 均有可追溯任务与验收命令结果。
- Skill 文档无禁止词；验收命令可执行。
