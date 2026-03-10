# Story 7.1：仪表盘生成器

**Epic**：7 eval-ux-dashboard-and-sft  
**Story**：7.1  
**Slug**：dashboard-generator  
**来源**：epics.md §Epic 7、prd.eval-ux-last-mile.md §5.3（REQ-UX-3.1~3.7）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-3.1 | 仪表盘生成器：项目健康度总分（PHASE_WEIGHTS 与 record 内 phase_weight 计算加权平均） | 是 | AC-1 |
| REQ-UX-3.2 | 四维雷达图数据：从 dimension_scores 提取；无 dimension_scores 时显示「无数据」 | 是 | AC-1, AC-3 |
| REQ-UX-3.3 | 短板 Top 3：得分最低的 3 个阶段/Story | 是 | AC-1 |
| REQ-UX-3.4 | Veto 触发统计：从 check_items 中 passed=false 且 item_id 在 veto 配置内的计数 | 是 | AC-1 |
| REQ-UX-3.5 | 趋势：按 run_id 去重取最近 5 个 run；比较最近 vs 前一次（或最近 vs 最前）的加权总分，输出升/降/持平 | 是 | AC-1 |
| REQ-UX-3.6 | 无数据时：输出与 Coach 一致提示「暂无数据，请先完成至少一轮 Dev Story」，写入 _bmad-output/dashboard.md | 是 | AC-2 |
| REQ-UX-3.7 | Command `/bmad-dashboard`：运行即可看到仪表盘；输出到 _bmad-output/dashboard.md 且在对话中展示 | 是 | AC-4 |

---

## 2. User Story

**As a** 技术负责人（TechLead）  
**I want to** 运行 `/bmad-dashboard`  
**so that** 我能看到「项目 78 分，短板在测试覆盖」这类一句话结论

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **Command `/bmad-dashboard`**  
   - 无参数运行即可生成并展示仪表盘  
   - 输出到 `_bmad-output/dashboard.md` 且在对话中展示

2. **有数据时输出内容**  
   - 项目健康度总分：PHASE_WEIGHTS 加权（scoring/constants/weights.ts 定义 [0.2, 0.25, 0.25, 0.15, 0.1, 0.05]），结合 record 内 phase_weight 计算加权平均  
   - 四维雷达图：从 RunScoreRecord.dimension_scores 提取；无 dimension_scores 时该维度显示「无数据」  
   - 短板 Top 3：得分最低的 3 个阶段/Story  
   - Veto 触发统计：check_items 中 passed=false 且 item_id 在 veto 配置内的计数  
   - 趋势：按 run_id 去重取最近 5 个 run；比较最近 vs 前一次（或最近 vs 最前）的加权总分，输出升/降/持平

3. **无数据时输出**  
   - 输出「暂无数据，请先完成至少一轮 Dev Story」  
   - 写入 `_bmad-output/dashboard.md`

4. **数据源**  
   - 复用 scoring/query 层（queryLatest、loadAndDedupeRecords 等）与 scoring/coach 逻辑  
   - 仅考虑 scenario=real_dev（与 Coach 一致，排除 eval_question）

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| SFT 提取 Command（/bmad-sft-extract） | Story 7.2 | 归属 Epic 7 |
| SFT 纳入 bmad-eval-analytics Skill（自然语言触发 SFT 提取） | Story 7.3 | 归属 Epic 7 |
| Coach discovery 仅 real_dev（scenario 过滤） | Story 7.4 | 归属 Epic 7；若 discovery 需 scenario 过滤，本 Story 可复用扩展后的 discovery |
| 四维雷达图的图形渲染（SVG/Canvas 等） | 本 Story 不强制 | 本 Story 输出可被渲染的 Markdown 数据（维度名+分数）；图形化不在本 Story 范围，若需 SVG/Canvas 渲染由外部工具或独立 Story 实现 |
| 交互式仪表盘 / 前端 UI | 不在本 Story | 本 Story 产出 Markdown 文件 |

### 3.3 技术依赖与路径

| 依赖 | 路径/来源 | 说明 |
|------|-----------|------|
| 评分查询层 | scoring/query/ | queryLatest、loadAndDedupeRecords |
| 权重常量 | scoring/constants/weights.ts | PHASE_WEIGHTS [0.2, 0.25, 0.25, 0.15, 0.1, 0.05] |
| 记录类型 | scoring/writer/types.ts | RunScoreRecord（phase_score、phase_weight、check_items、dimension_scores） |
| Veto 配置 | scoring/rules/ 或 scoring/veto/ | 判断 item_id 是否在 veto 配置内 |
| 输出路径 | _bmad-output/dashboard.md | 固定路径 |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 有数据时输出仪表盘 | 存在 real_dev 评分记录 | 用户运行 `/bmad-dashboard` | 输出含项目健康度总分（PHASE_WEIGHTS 加权）、四维雷达图、短板 Top 3、Veto 触发统计、趋势（最近 5 run 升/降/持平） |
| AC-2 | 无数据时友好提示 | 无 real_dev 评分数据 | 用户运行 `/bmad-dashboard` | 输出「暂无数据，请先完成至少一轮 Dev Story」，写入 _bmad-output/dashboard.md |
| AC-3 | 无 dimension_scores 时维度显示 | 部分 record 无 dimension_scores | 仪表盘生成 | 该维度显示「无数据」 |
| AC-4 | 输出路径与展示 | — | 用户运行 `/bmad-dashboard` | 输出到 _bmad-output/dashboard.md 且在对话中展示 |

---

## 5. 禁止词表合规声明

本 Story 文档已避免使用禁止词表所列全部词汇（可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债）。所有范围界定均采用明确归属（由 Story X.Y 负责）。

---

## 6. 产出物清单

| 产出 | 路径 |
|------|------|
| Command 定义 | `commands/bmad-dashboard.md`（或等价 Cursor Command） |
| 仪表盘生成逻辑 | `scripts/` 或 `scoring/dashboard/` 下实现脚本/模块 |
| 输出文件 | `_bmad-output/dashboard.md` |
| 验收 | 运行 `/bmad-dashboard` 可生成含总分、四维、短板、Veto、趋势的 Markdown，或在无数据时输出提示；内容同时写入 _bmad-output/dashboard.md 且在对话中展示 |
