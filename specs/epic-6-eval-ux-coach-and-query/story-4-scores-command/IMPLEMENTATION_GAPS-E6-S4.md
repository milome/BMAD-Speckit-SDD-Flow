# IMPLEMENTATION_GAPS-E6-S4：Scores Command 实现差距

**Epic**：E6 eval-ux-coach-and-query  
**Story ID**：6.4  
**分析基准**：plan-E6-S4.md、spec-E6-S4.md、Story 6.4、当前实现

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story §3.1(1) | GAP-E6-S4-1 | 新建 commands/bmad-scores.md；/bmad-scores 触发；无参、--epic N、--story X.Y | 未实现 | commands/bmad-scores.md 不存在 |
| Story §3.1(2) | GAP-E6-S4-2 | 全部摘要模式：queryLatest、表格、列、排序 | 未实现 | scripts/scores-summary.ts 不存在 |
| Story §3.1(3) | GAP-E6-S4-3 | Epic 汇总模式 --epic N | 未实现 | 无 scores 脚本 |
| Story §3.1(4) | GAP-E6-S4-4 | Story 明细模式 --story X.Y | 未实现 | 无 scores 脚本 |
| Story §3.1(5) | GAP-E6-S4-5 | 复用 queryByEpic、queryByStory、queryLatest | 未实现 | query 层已存在，scores 脚本未 import |
| Story §3.1(6) | GAP-E6-S4-6 | formatScoresToTable(records, mode)；无数据/无约定/无可筛选三类反馈 | 未实现 | 无 formatScoresToTable；无反馈逻辑 |
| Story §3.1(7) | GAP-E6-S4-7 | coach-diagnose 迁移：--epic/--story 改用 queryByEpic、queryByStory | 部分实现 | coach-diagnose 仍使用 filterByEpicStory |
| Story §4 AC-1 | GAP-E6-S4-8 | 全部摘要输出表格 | 未实现 | 依赖 GAP-1～6 |
| Story §4 AC-2 | GAP-E6-S4-9 | Epic 汇总输出 Epic N | 未实现 | 依赖 GAP-3 |
| Story §4 AC-3 | GAP-E6-S4-10 | Story 明细输出 Story X.Y | 未实现 | 依赖 GAP-4 |
| Story §4 AC-4 | GAP-E6-S4-11 | 无约定数据明确反馈 | 未实现 | 依赖 GAP-6 |
| Story §4 AC-5 | GAP-E6-S4-12 | 无数据「暂无评分数据...」 | 未实现 | 依赖 GAP-6 |
| Story §4 AC-6 | GAP-E6-S4-13 | coach 迁移后行为不变 | 未实现 | 依赖 GAP-7 |
| Story §7.3、spec §5、plan §6 | GAP-E6-S4-14 | 单元测试 formatScoresToTable；集成/E2E；coach 迁移回归 | 未实现 | 无 scores 相关单测；npm run test:scoring 未覆盖 scores |
| Story §5.4、plan Phase 3 | GAP-E6-S4-15 | 可选：.cursor/commands/bmad-scores.md 同步 | 未实现 | 若项目有 .cursor/commands 约定则需同步 |

---

## 2. Gaps → 任务映射（按章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §3.1(1) | GAP-E6-S4-1 | ✓ 有 | T1.1 |
| Story §3.1(2)-(5) | GAP-E6-S4-2～5 | ✓ 有 | T2.1, T2.2 |
| Story §3.1(6) | GAP-E6-S4-6 | ✓ 有 | T2.2, T2.3 |
| Story §3.1(7) | GAP-E6-S4-7 | ✓ 有 | T4.1, T4.2 |
| Story §4 | GAP-E6-S4-8～13 | ✓ 有 | T1～T5 |
| Story §7.3 | GAP-E6-S4-14 | ✓ 有 | T5.1, T5.2 |
| Story §5.4 | GAP-E6-S4-15 | ✓ 有 | T3.2 |

---

## 3. 四类汇总

| 类别 | Gap ID | 说明 | 对应任务 |
|------|--------|------|----------|
| Command/文档 | GAP-E6-S4-1 | bmad-scores.md | T1.1, T3 |
| 脚本/查询 | GAP-E6-S4-2～5 | scores-summary.ts、query 复用 | T1.2, T2.1 |
| 格式化/反馈 | GAP-E6-S4-6 | formatScoresToTable、无数据/无约定 | T2.2, T2.3 |
| 迁移 | GAP-E6-S4-7, 13 | coach-diagnose 改用 query | T4.1, T4.2 |
| 测试 | GAP-E6-S4-14 | 单测、集成、E2E、coach 回归 | T5.1, T5.2 |
| 同步 | GAP-E6-S4-15 | .cursor/commands 可选 | T3.2 |

---

## 4. 当前实现快照

| 模块 | 路径 | 状态 |
|------|------|------|
| Command | commands/bmad-scores.md | ❌ 不存在 |
| 脚本 | scripts/scores-summary.ts | ❌ 不存在 |
| 表格格式化 | formatScoresToTable | ❌ 不存在 |
| coach-diagnose | scripts/coach-diagnose.ts | 使用 filterByEpicStory，未迁移 |
| scoring/query | scoring/query/index.ts | ✅ 已实现；parseEpicStoryFromRecord 未从 index 导出 |
