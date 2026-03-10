# Tasks: SFT 纳入 bmad-eval-analytics Skill (E7-S3)

**Input**：`spec-E7-S3.md`、`plan-E7-S3.md`、`IMPLEMENTATION_GAPS-E7-S3.md`  
**Scope**：Story 7.3 全部（扩展 Skill 文档、验收）  
**执行方式**：按 T1 → T2 顺序推进

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | Story 7.3, GAPS | REQ-UX-4.7, GAP-E7-S3-1～3 | 扩展 SKILL.md：description、When to use、执行指引增加 SFT 触发 |
| T2 | Story 7.3, GAPS | AC-1, GAP-E7-S3-4 | 验收：脚本可执行；Cursor 说「提取微调数据集」触发 |

---

## 2. Phase 1：Skill 文档扩展（T1）

**AC**：GAP-E7-S3-1, 2, 3；REQ-UX-4.7  
**集成验证**：SKILL.md 含 SFT 触发短语及执行指引；Coach 内容保留

- [x] **T1.1** 扩展 `skills/bmad-eval-analytics/SKILL.md` 的 `description`（YAML frontmatter）与 `When to use`：
  - 在 description 中增加 SFT 触发描述（「提取微调数据集」「生成 SFT 训练数据」→ 执行 `npx ts-node scripts/sft-extract.ts`）
  - 在 When to use 中增加 SFT 短语列表：「提取微调数据集」「生成 SFT 训练数据」「生成 SFT 数据」（等价表述）
  - 与现有 Coach 内容并列，不删除
- [x] **T1.2** 扩展 `skills/bmad-eval-analytics/SKILL.md` 的「执行指引」：
  - 增加 SFT 分支：用户消息匹配 SFT 短语时 → 执行 `npx ts-node scripts/sft-extract.ts` → 展示脚本输出（摘要）
  - 与 Coach 分支并列，不删除原有 Coach 指引

---

## 3. Phase 2：验收（T2）

**AC**：GAP-E7-S3-4；AC-1  
**集成验证**：脚本可执行；Cursor 中「提取微调数据集」触发 Agent 执行并展示摘要

- [x] **T2.1** 验收命令：`npx ts-node scripts/sft-extract.ts` 可执行；输出含摘要（如「共提取 N 条，覆盖 M 个 Story；跳过 K 条...」或等价）
- [x] **T2.2** Cursor 验收：在 Cursor 中说「提取微调数据集」，Agent 应识别 bmad-eval-analytics Skill 的 SFT 触发，执行 `npx ts-node scripts/sft-extract.ts` 并展示摘要
- [x] **T2.3** 回归：说「帮我看看短板」时仍触发 Coach 脚本（coach-diagnose.ts），未被覆盖

---

## 4. 验收命令汇总

| 命令/操作 | 覆盖 |
|----------|------|
| `npx ts-node scripts/sft-extract.ts` | T2.1, AC-1 |
| Cursor 说「提取微调数据集」 | T2.2, AC-1 |
| Cursor 说「帮我看看短板」 | T2.3 回归 |

---

## 5. Gaps → 任务映射（按需求文档章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| REQ-UX-4.7, spec §3.2～3.3 | GAP-E7-S3-1～3 | ✓ 有 | T1 |
| AC | GAP-E7-S3-4 | ✓ 有 | T2 |

---

## 6. 完成判定标准

- T1～T2 全部任务完成并勾选
- AC-1 可追溯至 T2.1、T2.2
- Skill 文档扩展完成，Coach 内容保留
- ralph-method：prd 与 progress 在 story-7-3-sft-bmad-eval-analytics-skill 目录
