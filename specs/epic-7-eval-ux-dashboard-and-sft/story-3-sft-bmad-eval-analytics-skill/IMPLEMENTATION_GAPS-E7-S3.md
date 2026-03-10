# IMPLEMENTATION_GAPS-E7-S3：SFT 纳入 bmad-eval-analytics Skill 实现差距

**Epic**：E7 eval-ux-dashboard-and-sft  
**Story ID**：7.3  
**分析基准**：plan-E7-S3.md、spec-E7-S3.md、Story 7.3、skills/bmad-eval-analytics/SKILL.md 当前实现

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| REQ-UX-4.7 | GAP-E7-S3-1 | description 含 SFT 触发短语 | 未实现 | SKILL.md description 仅含 Coach，无 SFT |
| REQ-UX-4.7 | GAP-E7-S3-2 | When to use 含「提取微调数据集」「生成 SFT 训练数据」 | 未实现 | 仅 Coach 短语，无 SFT 短语 |
| REQ-UX-4.7 | GAP-E7-S3-3 | 执行指引含 SFT 分支（npx ts-node scripts/sft-extract.ts） | 未实现 | 仅 Coach 执行指引 |
| AC-1 | GAP-E7-S3-4 | 用户说 SFT 短语时执行脚本并输出摘要 | 未实现 | Skill 未声明 SFT 触发，Agent 无法识别 |

---

## 2. Gaps → 任务映射（按章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| REQ-UX-4.7, spec §3.2 | GAP-E7-S3-1, 2 | ✓ 有 | T1.1 |
| spec §3.3 | GAP-E7-S3-3 | ✓ 有 | T1.2 |
| AC | GAP-E7-S3-4 | ✓ 有 | T2 |

---

## 3. 四类汇总

| 类别 | Gap ID | 说明 | 对应任务 |
|------|--------|------|----------|
| Skill 文档扩展 | GAP-E7-S3-1～3 | description、When to use、执行指引 | T1 |
| 验收 | GAP-E7-S3-4 | 脚本可执行；Cursor 触发 | T2 |

---

## 4. 当前实现快照

| 模块 | 路径 | 状态 |
|------|------|------|
| Skill 文档 | skills/bmad-eval-analytics/SKILL.md | ✅ 存在；含 Coach 触发；**无** SFT 触发 |
| SFT 脚本 | scripts/sft-extract.ts | ✅ 存在（Story 7.2）；可执行 |
