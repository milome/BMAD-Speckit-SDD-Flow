# Story 6.1：Coach Command 无参数运行

**Epic**：6 eval-ux-coach-and-query  
**Story**：6.1  
**Slug**：coach-command-no-args  
**来源**：epics.md §Epic 6、prd.eval-ux-last-mile.md §5.1

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-1.1 | 新建 Command `commands/bmad-coach.md`，用户运行 `/bmad-coach` 即可触发 AI Coach 诊断 | 是 | AC-1 |
| REQ-UX-1.2 | 无需 run-id，自动扫描 `scoring/data/`（或 getScoringDataPath()）下 `.json`（排除非评分 schema）和 `scores.jsonl`；按 timestamp 排序取最新 N 条（默认 N=100，可配置）；超出时提示「仅展示最近 N 条」 | 是 | AC-1, AC-3 |
| REQ-UX-1.3 | 空目录行为：返回结构化 Markdown 提示「暂无评分数据，请先完成至少一轮 Dev Story」 | 是 | AC-2 |
| REQ-UX-1.4 | 多 worktree：首版以 process.cwd() 或 getScoringDataPath() 为根；多 worktree 聚合扫描由 Deferred Gaps 负责 | 是 | scope 约束 |
| REQ-UX-1.5 | 参数 `/bmad-coach --epic 3` 仅诊断 Epic 3 相关数据 | 否 | 由 Story 6.2 负责 |
| REQ-UX-1.6 | 参数 `/bmad-coach --story 3.3`，解析规则 `--story X.Y` → epicId=X, storyId=Y | 否 | 由 Story 6.2 负责 |
| REQ-UX-1.7 | 新建或扩展 Skill `bmad-eval-analytics` 支持自然语言触发 | 否 | 由 Story 6.5 负责 |

---

## 2. User Story

**As a** 日常开发者（Dev）  
**I want to** 运行 `/bmad-coach` 而不提供任何参数  
**so that** 我能立刻看到最近一轮的 Coach 诊断报告

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **新建 `commands/bmad-coach.md`**  
   - Cursor Command 入口，用户通过 `/bmad-coach` 触发
   - 无参数时执行「自动扫描 scoring/data/ 最新数据 → 调用 coachDiagnose → 输出 Markdown 诊断报告」

2. **自动发现最新 run_id**  
   - 实现 discoverLatestRunIds 或等效逻辑，扫描 `getScoringDataPath()` 下 `.json`（仅评分 schema 文件）与 `scores.jsonl`
   - 按 `timestamp` 排序，取最新 N 条（默认 N=100，可通过 env 或 CLI 配置）
   - 从最新记录中确定用于诊断的 run_id（以 timestamp 最近为准）
   - 数据根路径：首版以 `getScoringDataPath()` 为根；多 worktree 聚合扫描不纳入本 Story（见 GAP-025）

3. **空目录与无数据行为**  
   - 当 scoring/data/ 为空或无可解析评分记录时，返回结构化 Markdown 提示：「暂无评分数据，请先完成至少一轮 Dev Story」

4. **调用现有 coachDiagnose**  
   - 复用 `scoring/coach/diagnose.ts` 的 `coachDiagnose(runId, options?)` 与 `formatToMarkdown`
   - 输出包含 phase_scores、weak_areas、recommendations 的 Markdown 报告

5. **数据量限制与提示**  
   - 当用于发现「最新 run」的记录超过 N 时，按 timestamp 仅考虑最新 N 条
   - 若诊断报告基于截断后的数据，在输出前附加提示「仅展示最近 N 条」

6. **CLI/脚本层**  
   - 扩展 `scripts/coach-diagnose.ts` 或新增 `scripts/bmad-coach.ts`，支持无 `--run-id` 调用
   - 无 run-id 时：执行 discovery → 若为空则输出空数据提示 → 否则调用 coachDiagnose(latestRunId) → 输出 Markdown
   - Command `bmad-coach.md` 通过指令调用上述脚本或等价流程

### 3.2 非本 Story 范围（归属明确）

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| `/bmad-coach --epic N` | Story 6.2 | 按 Epic 筛选 Coach 诊断 |
| `/bmad-coach --story X.Y` | Story 6.2 | 按 Story 筛选，解析 epicId=X, storyId=Y |
| queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario | Story 6.3 | scoring/query/ 索引层；Story 6.1 的 discovery 为最小实现，6.3 提供完整 query API 后 6.2/6.4/6.5 复用 |
| Skill bmad-eval-analytics 自然语言触发 | Story 6.5 | 「帮我看看短板」等短语触发；复用 Command 的 discovery 与 coachDiagnose 调用 |
| 多 worktree 聚合扫描 | Deferred（GAP-025） | 首版单 worktree；多 worktree 需显式 dataPath |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | 有数据时输出诊断 | scoring/data/ 下有至少一条评分记录 | 用户运行 `/bmad-coach` | 输出包含 phase_scores、weak_areas、recommendations 的 Markdown 诊断报告 |
| AC-2 | 空目录时友好提示 | scoring/data/ 为空或无评分数据 | 用户运行 `/bmad-coach` | 返回结构化 Markdown 提示「暂无评分数据，请先完成至少一轮 Dev Story」 |
| AC-3 | 数据量限制 | scoring/data/ 中记录超过 N（默认 100） | 用户运行 `/bmad-coach` | 仅取最新 N 条，必要时在报告中附加提示「仅展示最近 N 条」 |

---

## 5. 实现约束与依赖

### 5.1 现有能力

- `scoring/coach/diagnose.ts`：`coachDiagnose(runId, options?)`、`formatToMarkdown`
- `scoring/constants/path.ts`：`getScoringDataPath()`
- `scoring/coach/loader.ts`：`loadRunRecords(runId, dataPath?)`（按 runId 加载）
- `scripts/coach-diagnose.ts`：当前需 `--run-id`，输出 json/markdown

### 5.2 实现路径

1. **Discovery 逻辑**  
   - 扫描 `getScoringDataPath()` 下 `*.json`（排除非评分 schema）与 `scores.jsonl`
   - 解析记录，按 `timestamp` 降序排序，取前 N 条；从这些记录中提取 run_id 集合，以「拥有最新 timestamp 的记录」所属 run_id 作为诊断目标

2. **脚本扩展**  
   - 扩展 `scripts/coach-diagnose.ts` 支持省略 `--run-id`：当未传入 `--run-id` 时执行 discovery → 取最新 run_id → 调用 coachDiagnose。理由：现有脚本已含 coachDiagnose 调用与输出格式，仅需增加无参分支，侵入最小、复用充分。

3. **Command 文档**  
   - `commands/bmad-coach.md` 包含：触发条件、调用脚本/流程说明、输出格式说明；同步到 `.cursor/commands/`（若项目有该约定）

### 5.3 数据源与 schema

- 评分 schema：符合 `RunScoreRecord` 的 `.json` 单文件或 `scores.jsonl` 每行
- 排除：`sft-dataset.jsonl` 等非评分输出文件
- 依据：`scoring/docs/RUN_ID_CONVENTION.md`、现有 writer/schema 约定

---

## 6. 禁止词表合规声明

本 Story 文档已避免使用本 skill § 禁止词表所列全部词汇。所有范围界定均采用明确归属（由 Story X.Y 负责或 Deferred Gaps）。

---

## 7. 产出物清单

| 产出 | 路径 |
|------|------|
| Command 文档 | `commands/bmad-coach.md` |
| 脚本（扩展） | `scripts/coach-diagnose.ts` |
| discovery 逻辑 | 在 `scripts/coach-diagnose.ts` 内实现（无 --run-id 时执行 discovery） |
| 验收命令 | `npx ts-node scripts/coach-diagnose.ts`（无 --run-id）或 `npm run coach:diagnose`（无参）可执行且输出符合 AC |
