# Spec E7-S1：仪表盘生成器（/bmad-dashboard）

*Story 7.1 技术规格*  
*Epic E7 eval-ux-dashboard-and-sft*

---

## 1. 概述

本 spec 将 Story 7.1 的实现范围固化为可执行技术规格，覆盖 `/bmad-dashboard` Command、仪表盘生成脚本、输出到 `_bmad-output/dashboard.md`，以及项目健康度总分、四维雷达图、短板 Top 3、Veto 触发统计、趋势的计算与展示。

**前置假设**：本 spec 假定 scoring/query/、scoring/veto/、scoring/constants/weights.ts 已交付。数据源仅考虑 scenario=real_dev（与 Coach 一致）。

**输入来源**：
- Story 7.1（7-1-dashboard-generator.md）
- prd.eval-ux-last-mile.md §5.3（REQ-UX-3.1～3.7）
- scoring/query/、scoring/veto/、scoring/writer/types.ts、scoring/constants/weights.ts

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| REQ-UX-3.1 | 项目健康度总分：PHASE_WEIGHTS 与 record 内 phase_weight 计算加权平均 | spec §3.2.1 | ✅ |
| REQ-UX-3.2 | 四维雷达图数据：从 dimension_scores 提取；无 dimension_scores 时显示「无数据」 | spec §3.2.2 | ✅ |
| REQ-UX-3.3 | 短板 Top 3：得分最低的 3 个阶段/Story | spec §3.2.3 | ✅ |
| REQ-UX-3.4 | Veto 触发统计：check_items 中 passed=false 且 item_id 在 veto 配置内的计数 | spec §3.2.4 | ✅ |
| REQ-UX-3.5 | 趋势：按 run_id 去重取最近 5 个 run；比较最近 vs 前一次（或最近 vs 最前）的加权总分，输出升/降/持平 | spec §3.2.5 | ✅ |
| REQ-UX-3.6 | 无数据时：输出「暂无数据，请先完成至少一轮 Dev Story」，写入 dashboard.md | spec §3.3 | ✅ |
| REQ-UX-3.7 | Command /bmad-dashboard：运行即可看到仪表盘；输出到 dashboard.md 且在对话中展示 | spec §3.1, §3.5 | ✅ |
| AC-1 | 有数据时输出仪表盘含总分、四维、短板 Top 3、Veto、趋势 | spec §3.2, §3.6 | ✅ |
| AC-2 | 无数据时友好提示 | spec §3.3 | ✅ |
| AC-3 | 无 dimension_scores 时维度显示「无数据」 | spec §3.2.2 | ✅ |
| AC-4 | 输出到 _bmad-output/dashboard.md 且在对话中展示 | spec §3.5 | ✅ |

---

## 3. 功能规格

### 3.1 Command 与入口

| 项目 | 规格 |
|------|------|
| Command 文档 | `commands/bmad-dashboard.md`，定义 `/bmad-dashboard` 触发 |
| 脚本入口 | `scripts/dashboard-generate.ts`（或 `scripts/dashboard-generate.ts`） |
| 参数 | 无参数运行即可生成并展示 |

### 3.2 有数据时仪表盘内容规格

**数据源**：`queryByScenario('real_dev', dataPath)` 或等价（`loadAndDedupeRecords` + 过滤 scenario !== 'eval_question'）。仅 real_dev 记录参与计算。

**基准 Run**：按 run_id 分组，每组取最大 timestamp 对应的记录集合；按组最大 timestamp 降序，取第一组为「最新 run」。仪表盘主内容基于最新 run 的 records 计算。

#### 3.2.1 项目健康度总分

- 输入：最新 run 的全部 stage 记录
- 公式：`weightedTotal = sum(phase_score * phase_weight) / sum(phase_weight)`，其中 phase_score、phase_weight 来自 RunScoreRecord
- 若 record 无 phase_weight 或为 0：使用 PHASE_WEIGHTS 中对应 stage 的权重（需建立 stage 到 phase 索引的映射）；无映射时该 record 不参与分子、分母
- 输出：四舍五入到整数，如「78 分」

#### 3.2.2 四维雷达图数据

- 输入：最新 run 的 records 的 dimension_scores
- 合并逻辑：按 dimension 名聚合，取各 dimension 最新（或平均）的 score；若无 score 则展示「无数据」
- 输出格式：Markdown 列表或表格，如 `| 维度 | 分数 |`；无 dimension_scores 的维度显示「无数据」

#### 3.2.3 短板 Top 3

- 输入：最新 run 的 records
- 规则：按 phase_score 升序，取前 3 条；若不足 3 条则全部展示
- 展示：每条含 stage 与可选的 epic.story（由 parseEpicStoryFromRecord 解析）；格式如「E6.S4 spec: 65 分」或「spec: 65 分」

#### 3.2.4 Veto 触发统计

- 输入：最新 run 的 records 的 check_items；veto 配置来自 `buildVetoItemIds()`
- 规则：遍历所有 check_items，计数满足 `passed === false` 且 `item_id in vetoItemIds` 的项数
- 输出：如「Veto 触发：2 次」

#### 3.2.5 趋势

- 输入：按 run_id 去重，取最近 5 个 run（按每组最大 timestamp 降序）
- 每个 run 的加权总分：同 §3.2.1 公式
- 比较：最近 run 总分 vs 前一次 run 总分；若只有 1 个 run 则比较「最近 vs 最前」即持平
- 输出：升 / 降 / 持平

### 3.3 无数据时输出

- 条件：`queryByScenario('real_dev')` 返回空数组
- 输出文案：「暂无数据，请先完成至少一轮 Dev Story」
- 仍写入 `_bmad-output/dashboard.md`

### 3.4 输出路径与格式

| 项目 | 规格 |
|------|------|
| 输出路径 | `_bmad-output/dashboard.md`（相对于项目根） |
| 格式 | Markdown；含标题、总分、四维、短板 Top 3、Veto、趋势等章节 |
| 对话展示 | CLI 将生成的 Markdown 输出到 stdout，便于 Command 在对话中展示 |

### 3.5 产出物路径

| 产出 | 路径 |
|------|------|
| Command 文档 | `commands/bmad-dashboard.md` |
| 脚本 | `scripts/dashboard-generate.ts` |
| 仪表盘逻辑模块 | `scoring/dashboard/`（可选，或内嵌于脚本） |
| 输出文件 | `_bmad-output/dashboard.md` |

### 3.6 验收用例

| 场景 | 命令 | 预期 |
|------|------|------|
| 有数据 | `npx ts-node scripts/dashboard-generate.ts` | 输出含项目健康度总分、四维雷达图数据、短板 Top 3、Veto 触发统计、趋势的 Markdown；写入 _bmad-output/dashboard.md |
| 无数据 | 空目录或无 real_dev 时运行 | 输出「暂无数据，请先完成至少一轮 Dev Story」；仍写入 _bmad-output/dashboard.md |
| 无 dimension_scores | 部分 record 无 dimension_scores | 该维度显示「无数据」 |
| 输出路径 | 任意 | _bmad-output/dashboard.md 存在且内容与 stdout 一致 |

---

## 4. 非本 Story 范围

| 功能 | 负责 | 说明 |
|------|------|------|
| SFT 提取 Command | Story 7.2 | /bmad-sft-extract |
| bmad-eval-analytics Skill 纳入 SFT 提取 | Story 7.3 | 自然语言触发 |
| Coach discovery scenario 过滤 | Story 7.4 | 本 Story 复用 queryByScenario |
| 四维雷达图 SVG/Canvas 渲染 | 不在本 Story | 本 Story 输出可被渲染的 Markdown 数据 |
| 交互式仪表盘 / 前端 UI | 不在本 Story | 本 Story 产出 Markdown 文件 |

---

## 5. 测试要求

- **单元测试**：computeHealthScore、formatDashboardMarkdown 等核心函数；空 records、无 dimension_scores 边界
- **集成/端到端**：`npx ts-node scripts/dashboard-generate.ts` 在有数据/无数据时符合 AC；_bmad-output/dashboard.md 存在且内容正确
