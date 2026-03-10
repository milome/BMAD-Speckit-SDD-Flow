# IMPLEMENTATION_GAPS-E6-S5：bmad-eval-analytics Skill 实现差距

**Epic**：E6 eval-ux-coach-and-query  
**Story ID**：6.5  
**分析基准**：plan-E6-S5.md、spec-E6-S5.md、Story 6.5、当前实现

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story §3.1(1) | GAP-E6-S5-1 | 新建 skills/bmad-eval-analytics/SKILL.md | 未实现 | skills/bmad-eval-analytics/ 目录不存在 |
| Story §3.1(2) | GAP-E6-S5-2 | 支持自然语言触发短语 | 未实现 | Skill 文档未创建 |
| Story §3.1(3) | GAP-E6-S5-3 | 复用 discoverLatestRunId 与 coachDiagnose | 部分满足 | coach-diagnose.ts 已存在并复用，Skill 需指引执行该脚本 |
| Story §3.1(4) | GAP-E6-S5-4 | 触发短语映射 | 未实现 | 无 Skill 配置 |
| Story §4 AC-1 | GAP-E6-S5-5 | 自然语言触发 → 输出诊断 | 未实现 | 依赖 GAP-1, 2 |
| Story §4 AC-2 | GAP-E6-S5-6 | 最近一轮以 timestamp 为准 | 已满足 | coach-diagnose 无参时内部 discovery 已实现 |
| Story §4 AC-3 | GAP-E6-S5-7 | 共用逻辑，无重复实现 | 待实现 | Skill 须指引执行 coach-diagnose，不得新建独立 discovery/coach |

---

## 2. Gaps → 任务映射（按章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §3.1(1) | GAP-E6-S5-1 | ✓ 有 | T1.1 |
| Story §3.1(2),(4) | GAP-E6-S5-2, 4 | ✓ 有 | T1.2, T1.3 |
| Story §3.1(3) | GAP-E6-S5-3 | ✓ 有 | T1.2（指引执行 coach-diagnose） |
| Story §4 AC-1 | GAP-E6-S5-5 | ✓ 有 | T2.1 |
| Story §4 AC-2 | GAP-E6-S5-6 | — | coach-diagnose 已满足 |
| Story §4 AC-3 | GAP-E6-S5-7 | ✓ 有 | T1.2 |

---

## 3. 四类汇总

| 类别 | Gap ID | 说明 | 对应任务 |
|------|--------|------|----------|
| Skill 文档 | GAP-E6-S5-1 | skills/bmad-eval-analytics/SKILL.md | T1.1 |
| 触发短语 | GAP-E6-S5-2, 4 | description / when to use 定义短语 | T1.2, T1.3 |
| 复用指引 | GAP-E6-S5-3, 7 | 指引执行 coach-diagnose，无独立实现 | T1.2 |
| 验收 | GAP-E6-S5-5 | 验收命令与自然语言触发验证 | T2.1 |

---

## 4. 当前实现快照

| 模块 | 路径 | 状态 |
|------|------|------|
| bmad-eval-analytics Skill | skills/bmad-eval-analytics/SKILL.md | ❌ 不存在 |
| coach-diagnose | scripts/coach-diagnose.ts | ✅ 已实现；无参时 discovery + coachDiagnose |
| discovery | scoring/coach/discovery.ts | ✅ 已实现 discoverLatestRunId |
