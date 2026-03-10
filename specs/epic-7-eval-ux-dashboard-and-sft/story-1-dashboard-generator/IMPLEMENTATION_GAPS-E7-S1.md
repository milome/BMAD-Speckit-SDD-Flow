# IMPLEMENTATION_GAPS-E7-S1：仪表盘生成器实现差距

**Epic**：E7 eval-ux-dashboard-and-sft  
**Story ID**：7.1  
**分析基准**：plan-E7-S1.md、spec-E7-S1.md、Story 7.1、当前实现

---

## 1. Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story §3.1(1), REQ-UX-3.7 | GAP-E7-S1-1 | 新建 commands/bmad-dashboard.md；/bmad-dashboard 触发；无参运行 | 未实现 | commands/bmad-dashboard.md 不存在 |
| Story §3.1(2), REQ-UX-3.1 | GAP-E7-S1-2 | 项目健康度总分：PHASE_WEIGHTS 与 phase_weight 加权平均 | 未实现 | 无 dashboard 计算模块 |
| Story §3.1(2), REQ-UX-3.2 | GAP-E7-S1-3 | 四维雷达图数据：dimension_scores；无则「无数据」 | 未实现 | 无 dimension 聚合逻辑 |
| Story §3.1(2), REQ-UX-3.3 | GAP-E7-S1-4 | 短板 Top 3：得分最低的 3 个阶段/Story | 未实现 | 无短板计算逻辑 |
| Story §3.1(2), REQ-UX-3.4 | GAP-E7-S1-5 | Veto 触发统计：check_items passed=false 且 item_id 在 veto 配置 | 未实现 | 无 veto 计数逻辑 |
| Story §3.1(2), REQ-UX-3.5 | GAP-E7-S1-6 | 趋势：最近 5 run，最近 vs 前一次，升/降/持平 | 未实现 | 无趋势计算逻辑 |
| Story §3.3, REQ-UX-3.6 | GAP-E7-S1-7 | 无数据时「暂无数据...」写入 dashboard.md | 未实现 | 无脚本与输出逻辑 |
| Story §3.5 | GAP-E7-S1-8 | 输出到 _bmad-output/dashboard.md 且 stdout 展示 | 未实现 | 无输出路径实现 |
| AC-1～AC-4 | GAP-E7-S1-9 | 验收：有数据/无数据/无 dimension_scores/输出路径 | 未实现 | 依赖 GAP-1～8 |
| spec §5, plan §6 | GAP-E7-S1-10 | 单元测试、集成/E2E | 未实现 | 无 dashboard 相关测试 |

---

## 2. Gaps → 任务映射（按章节）

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §3.1 | GAP-E7-S1-1 | ✓ 有 | T1.1 |
| Story §3.2.1～3.2.5 | GAP-E7-S1-2～6 | ✓ 有 | T2.1～T2.6 |
| Story §3.3, §3.5 | GAP-E7-S1-7, 8 | ✓ 有 | T1.2, T2.7 |
| AC | GAP-E7-S1-9 | ✓ 有 | T3 |
| spec §5 | GAP-E7-S1-10 | ✓ 有 | T4 |

---

## 3. 四类汇总

| 类别 | Gap ID | 说明 | 对应任务 |
|------|--------|------|----------|
| Command/文档 | GAP-E7-S1-1 | bmad-dashboard.md | T1.1 |
| 脚本/数据 | GAP-E7-S1-7, 8 | dashboard-generate.ts、输出路径 | T1.2, T2.7 |
| 计算逻辑 | GAP-E7-S1-2～6 | 总分、四维、短板、Veto、趋势 | T2.1～T2.6 |
| 测试 | GAP-E7-S1-10 | 单测、集成、E2E | T4 |

---

## 4. 当前实现快照

| 模块 | 路径 | 状态 |
|------|------|------|
| Command | commands/bmad-dashboard.md | ❌ 不存在 |
| 脚本 | scripts/dashboard-generate.ts | ❌ 不存在 |
| 仪表盘模块 | scoring/dashboard/ | ❌ 不存在 |
| 输出 | _bmad-output/dashboard.md | ❌ 由脚本生成 |
| scoring/query | queryByScenario、loadAndDedupeRecords | ✅ 已实现 |
| scoring/veto | buildVetoItemIds | ✅ 已实现 |
| scoring/constants/weights | PHASE_WEIGHTS | ✅ 已实现 |
