# Story 6.4：Scores Command

**Epic**：6 eval-ux-coach-and-query  
**Story**：6.4  
**Slug**：scores-command  
**来源**：epics.md §Epic 6、prd.eval-ux-last-mile.md §5.2（REQ-UX-2.6）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-2.6 | Command `/bmad-scores`：全部摘要、`--epic 3` Epic 各 Story、`--story 3.3` Story 各阶段明细 | 是 | AC-1, AC-2, AC-3 |
| REQ-UX-2.2 | epic_id/story_id 解析规则；无约定时调用方得到明确反馈 | 是（通过 6.3 或 fallback） | AC-2, AC-3, AC-4 |
| REQ-UX-2.4 | Epic/Story 筛选范围仅针对 real_dev | 是 | scope 约束 |
| REQ-UX-2.3 | 同 run_id+stage 去重 | 是（通过 6.3 或 fallback） | AC-1, AC-2, AC-3 |

---

## 2. User Story

**As a** 技术负责人（TechLead）  
**I want to** 运行 `/bmad-scores` 或 `/bmad-scores --epic 3` 或 `/bmad-scores --story 3.3`  
**so that** 我能以表格格式查看全部或指定范围的评分汇总

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **`/bmad-scores` Command**  
   - 新建 `commands/bmad-scores.md` 作为 Command 文档
   - Cursor Command 入口，用户通过 `/bmad-scores` 触发
   - 支持无参数、`--epic N`、`--story X.Y` 三种调用模式

2. **全部摘要模式（无参数）**  
   - 输出表格格式的评分汇总
   - 表格列至少包含：run_id、stage、phase_score、phase_weight、timestamp、epic/story（若可解析）
   - 按 timestamp 或 run_id 分组展示
   - 数据源：`getScoringDataPath()` 下 `*.json`（仅评分 schema）与 `scores.jsonl`
   - 同 run_id+stage 仅展示 timestamp 最新一条

3. **Epic 汇总模式（`--epic N`）**  
   - 仅展示 Epic N 各 Story 的评分
   - 表格含：Story 维度（如 3.1、3.2、3.3）、stage、phase_score、phase_weight、timestamp
   - Epic/Story 筛选仅针对 `scenario !== 'eval_question'` 或未设 scenario 的记录

4. **Story 明细模式（`--story X.Y`）**  
   - 仅展示 Story X.Y 各阶段评分明细
   - 解析规则：epicId=X, storyId=Y
   - 表格含：stage、phase_score、phase_weight、check_items 摘要（有数据则展示）、timestamp

5. **查询层复用与 fallback**  
   - 若 Story 6.3（scoring/query/）已完成：复用 `queryByEpic`、`queryByStory`、`queryLatest` 获取评分记录
   - 若 Story 6.3 未完成：在 `scripts/scores-summary.ts`（或等价脚本）内实现最小 inline 查询逻辑：从 `getScoringDataPath()` 加载评分记录，按 `scoring/docs/RUN_ID_CONVENTION.md` 的 run_id 正则 `-e(\d+)-s(\d+)-` 或 `-e(\d+)-s(\d+)$` 及 source_path fallback 解析 epic_id/story_id，过滤出匹配记录；同 run_id+stage 取 timestamp 最新一条去重；scenario=eval_question 的记录在 Epic/Story 筛选时排除

6. **输出格式**  
   - 表格格式：Markdown 表格（`| col1 | col2 | ... |`）
   - 无数据时：输出「暂无评分数据，请先完成至少一轮 Dev Story」
   - 无约定数据（Epic/Story 筛选无可解析记录）：输出「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario | Story 6.3 | scoring/query/ 索引层；本 Story 在 6.3 未完成时使用最小 inline 查询逻辑 |
| 仪表盘（总分、四维、短板 Top 3、Veto、趋势） | Story 7.1 | `/bmad-dashboard` |
| bmad-eval-analytics Skill 自然语言触发 | Story 6.5 | 「帮我看看评分」等短语；本 Story 仅提供 Command 入口 |
| 组合 queryByFilters API | GAP-024 | 归属 GAP-024，待排期 |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 全部摘要 | 存在评分数据 | 用户运行 `/bmad-scores` | 输出表格格式的评分汇总 |
| AC-2 | Epic 汇总 | 存在 Epic 3 数据 | 用户运行 `/bmad-scores --epic 3` | 显示 Epic 3 各 Story 评分 |
| AC-3 | Story 明细 | 存在 Story 3.3 数据 | 用户运行 `/bmad-scores --story 3.3` | 显示 Story 3.3 各阶段评分明细 |
| AC-4 | 无约定数据 | 记录无 epic_id/story_id 可解析 | 用户运行 `--epic` 或 `--story` | 输出「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」 |
| AC-5 | 无数据 | scoring/data/ 为空或无评分记录 | 用户运行 `/bmad-scores` | 输出「暂无评分数据，请先完成至少一轮 Dev Story」 |

---

## 5. 实现约束与依赖

### 5.1 依赖 Story 6.3 的处理

- **Story 6.3 已完成**：直接 import `scoring/query/` 的 `queryByEpic`、`queryByStory`、`queryLatest`，将返回的 `RunScoreRecord[]` 格式化为 Markdown 表格
- **Story 6.3 未完成**：在 scores 脚本内实现 inline 逻辑：
  1. 调用 `getScoringDataPath()` 获取数据根
  2. 加载 `*.json`（排除非评分 schema）与 `scores.jsonl`
  3. 解析为 `RunScoreRecord[]`，同 run_id+stage 取 timestamp 最新去重
  4. 当 `--epic` 或 `--story` 时：按 run_id 正则与 source_path 解析过滤；过滤 `scenario=eval_question`
  5. 无 `--epic`、`--story` 时：取全部（或 `queryLatest` 等价，按 timestamp 排序取最新 N 条，默认 N=100）
  6. 6.3 完成后迁移到复用 query API，移除 inline 逻辑

### 5.2 表格输出格式约定

- 全部摘要表头示例：`| run_id | epic | story | stage | phase_score | phase_weight | timestamp |`
- Epic 汇总表头示例：`| story | stage | phase_score | phase_weight | timestamp |`
- Story 明细表头示例：`| stage | phase_score | phase_weight | check_items_summary | timestamp |`
- 具体列可根据 RunScoreRecord schema 微调，须保证阶段、分数、权重、时间可读

### 5.3 数据源与 schema

- 与 Story 6.1、6.3 一致：`getScoringDataPath()` 下 `*.json`（仅评分 schema）、`scores.jsonl`
- 排除：`sft-dataset.jsonl` 等非评分输出
- 依据：`scoring/docs/RUN_ID_CONVENTION.md`、`RunScoreRecord` 类型

### 5.4 脚本与 Command 路径

- 脚本：`scripts/scores-summary.ts` 或 `scripts/bmad-scores.ts`
- Command 文档：`commands/bmad-scores.md`（若项目有 `commands/bmad-coach.md`  convention，则 scores 单独建 `bmad-scores.md`）
- 同步：`.cursor/commands/bmad-scores.md`（若项目有该约定）

---

## 6. Tasks / Subtasks

- [ ] Task 1：新建 Command 文档与脚本入口（AC: #1, #5）
  - [ ] Subtask 1.1：创建 `commands/bmad-scores.md`，定义 `/bmad-scores` 触发与参数说明
  - [ ] Subtask 1.2：创建 `scripts/scores-summary.ts`（或等价），解析 `--epic`、`--story` 或无参
  - [ ] Subtask 1.3：无数据时输出「暂无评分数据，请先完成至少一轮 Dev Story」
- [ ] Task 2：实现查询与表格格式化（AC: #1, #2, #3, #4）
  - [ ] Subtask 2.1：若 6.3 已实现，复用 queryByEpic、queryByStory、queryLatest；否则实现最小 inline 加载、解析、去重、筛选
  - [ ] Subtask 2.2：实现 `formatScoresToTable(records, mode)`：全部/Epic/Story 三种输出格式
  - [ ] Subtask 2.3：Epic/Story 筛选无约定数据时输出明确反馈
- [ ] Task 3：验收与 Command 文档完善
  - [ ] Subtask 3.1：补充验收命令 `npx ts-node scripts/scores-summary.ts`、`--epic 3`、`--story 3.3`
  - [ ] Subtask 3.2：同步到 `.cursor/commands/`（若存在）

---

## 7. Dev Notes

### 7.1 架构约束

- 不修改 `RunScoreRecord` schema；epic_id/story_id 由解析得出
- 遵循 `scoring/docs/RUN_ID_CONVENTION.md` 的解析规则与 fallback 顺序
- 若 Story 6.3 已实现，优先复用 `scoring/query/`；否则使用最小 inline 实现，便于 6.3 完成后迁移

### 7.2 源代码涉及

| 模块 | 路径 | 变更说明 |
|------|------|----------|
| Command | `commands/bmad-scores.md`、`.cursor/commands/bmad-scores.md` | 新建，参数说明与调用逻辑 |
| 脚本 | `scripts/scores-summary.ts` 或 `scripts/bmad-scores.ts` | 新建，加载数据、筛选、表格格式化 |
| 条件引用 | `scoring/query/` | Story 6.3 已实现时复用 queryByEpic、queryByStory、queryLatest |

### 7.3 测试要求

- 单元测试：表格格式化逻辑；inline 筛选逻辑（run_id 解析、source_path fallback、scenario 过滤）
- 集成/端到端：`npx ts-node scripts/scores-summary.ts`、`--epic 3`、`--story 3.3` 在有数据/无数据/无约定数据时输出符合 AC

---

## 8. 禁止词表合规声明

本 Story 文档已避免使用本 skill § 禁止词表所列全部词汇。所有范围界定均采用明确归属（由 Story X.Y 负责或 GAP 编号）。

---

## 9. 产出物清单

| 产出 | 路径 |
|------|------|
| Command 文档 | `commands/bmad-scores.md`（含 `/bmad-scores`、`--epic N`、`--story X.Y` 参数说明与调用逻辑） |
| 脚本 | `scripts/scores-summary.ts` 或 `scripts/bmad-scores.ts` |
| 表格格式化 | `formatScoresToTable(records, mode)` 或等价函数 |
| 验收命令 | `npx ts-node scripts/scores-summary.ts`、`--epic 3`、`--story 3.3` 可执行且输出符合 AC |

---

## 10. References

- [Source: scoring/docs/RUN_ID_CONVENTION.md]：run_id 约定、解析规则、source_path fallback
- [Source: prd.eval-ux-last-mile.md §5.2]：REQ-UX-2.6
- [Source: story-6-3-scoring-query-layer/6-3-scoring-query-layer.md]：queryByEpic、queryByStory、queryLatest API 约定
- [Source: story-6-2-coach-epic-story-filter/6-2-coach-epic-story-filter.md]：Epic/Story 筛选 fallback 模式参考
