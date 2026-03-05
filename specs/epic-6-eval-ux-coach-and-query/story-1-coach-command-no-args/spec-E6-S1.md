# Spec E6-S1：Coach Command 无参数运行

*Story 6.1 技术规格*  
*Epic E6 eval-ux-coach-and-query*

---

## 1. 概述

本 spec 将 Story 6.1 的实现范围固化为可执行技术规格，覆盖 `/bmad-coach` 无参数运行时的 discovery → coachDiagnose → Markdown 输出全流程。

**输入来源**：
- `_bmad-output/implementation-artifacts/epic-6-eval-ux-coach-and-query/story-6-1-coach-command-no-args/6-1-coach-command-no-args.md`
- `epics.md`、`prd.eval-ux-last-mile.md` §5.1
- `scoring/docs/RUN_ID_CONVENTION.md`

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story §1 需求追溯 REQ-UX-1.1 | 新建 `commands/bmad-coach.md`，`/bmad-coach` 触发 AI Coach 诊断 | spec §3.1 | ✅ |
| Story §1 REQ-UX-1.2 | 无需 run-id，扫描 getScoringDataPath() 下 .json 与 scores.jsonl；按 timestamp 取最新 N 条（默认 100）；超出时提示「仅展示最近 N 条」 | spec §3.2, §3.4 | ✅ |
| Story §1 REQ-UX-1.3 | 空目录返回「暂无评分数据，请先完成至少一轮 Dev Story」 | spec §3.3 | ✅ |
| Story §1 REQ-UX-1.4 | 首版以 getScoringDataPath() 为根；多 worktree 聚合不纳入 | spec §3.2 | ✅ |
| Story §3.1 | 新建 commands/bmad-coach.md | spec §3.1 | ✅ |
| Story §3.1 | 自动发现最新 run_id | spec §3.2 | ✅ |
| Story §3.1 | 空目录行为 | spec §3.3 | ✅ |
| Story §3.1 | 调用 coachDiagnose、formatToMarkdown | spec §3.4 | ✅ |
| Story §3.1 | 数据量限制与提示 | spec §3.4 | ✅ |
| Story §3.1 | 扩展 coach-diagnose.ts 支持无 --run-id | spec §3.2, §3.4 | ✅ |
| Story §4 AC-1 | 有数据时输出 phase_scores、weak_areas、recommendations | spec §3.4 | ✅ |
| Story §4 AC-2 | 空目录返回友好提示 | spec §3.3 | ✅ |
| Story §4 AC-3 | 超 N 条时仅取最新 N 并提示 | spec §3.4 | ✅ |
| Story §5 | 排除 sft-dataset.jsonl 等非评分 schema | spec §3.2 | ✅ |

---

## 3. 功能规格

### 3.1 Command 入口

| 需求要点 | 技术规格 |
|----------|----------|
| Command 文档 | 新建 `commands/bmad-coach.md` |
| 触发方式 | 用户运行 `/bmad-coach`（Cursor Command） |
| 调用流程 | 无参数时执行脚本或等价流程：discovery → coachDiagnose → Markdown 输出 |
| 输出格式 | 结构化 Markdown 诊断报告（phase_scores、weak_areas、recommendations）或空数据提示 |

### 3.2 Discovery 逻辑

| 需求要点 | 技术规格 |
|----------|----------|
| 数据根路径 | `getScoringDataPath()`（scoring/constants/path.ts） |
| 扫描范围 | `*.json`（仅评分 schema 文件）与 `scores.jsonl` |
| 排除规则 | 排除 `sft-dataset.jsonl`、非 RunScoreRecord schema 的 json |
| 评分 schema 判定 | 符合 `run-score-schema.json` 的 JSON：含 `run_id`、`scenario`、`stage`、`timestamp` 等 required 字段 |
| 排序 | 按 `timestamp` 降序（最新在前） |
| 限制 N | 默认 100 条；可通过 env `COACH_DISCOVERY_LIMIT` 或 CLI `--limit N` 配置 |
| 最新 run_id | 从按 timestamp 排序后的记录中，取第一条记录的 `run_id` 作为诊断目标（即最新记录所属 run_id） |

#### 3.2.1 discoverLatestRunId 接口（等效实现）

逻辑等效于：

```ts
/**
 * 扫描 dataPath 下 *.json 与 scores.jsonl，解析为 RunScoreRecord[]，
 * 按 timestamp 降序取前 limit 条，返回拥有最新 timestamp 的记录的 run_id。
 * @returns { runId: string; truncated: boolean } | null
 *   - runId: 用于 coachDiagnose 的 run_id
 *   - truncated: 当原始记录数 > limit 时为 true
 *   - null: 无任何可解析评分记录
 */
function discoverLatestRunId(dataPath: string, limit?: number): { runId: string; truncated: boolean } | null;
```

- `limit` 默认 100
- 空目录或无可解析记录 → 返回 `null`
- 记录数 > limit → 仅考虑最新 limit 条，`truncated: true`

### 3.3 空目录与无数据行为

| 需求要点 | 技术规格 |
|----------|----------|
| 触发条件 | discovery 返回 `null`（无评分记录） |
| 输出 | 结构化 Markdown，内容为：「暂无评分数据，请先完成至少一轮 Dev Story」 |
| 退出码 | 0（非错误，仅为提示） |

### 3.4 调用 coachDiagnose 与输出

| 需求要点 | 技术规格 |
|----------|----------|
| 入口 | `coachDiagnose(runId, { dataPath })`（scoring/coach/diagnose.ts） |
| 格式化 | `formatToMarkdown(result)`（scoring/coach） |
| 截断提示 | 当 `discoverLatestRunId` 返回 `truncated: true` 时，在 Markdown 报告前附加提示：「仅展示最近 N 条」 |
| 输出格式 | Markdown（默认）或 json（--format=json） |

### 3.5 脚本扩展（scripts/coach-diagnose.ts）

| 需求要点 | 技术规格 |
|----------|----------|
| 无 --run-id 行为 | 调用 discovery → 若 null 输出空数据提示 → 否则 coachDiagnose(latestRunId) → 输出 Markdown |
| 有 --run-id 行为 | 保持现有逻辑不变（直接 coachDiagnose） |
| 参数 | `--run-id`（可选）、`--format`（json|markdown，默认 markdown）、`--limit N`（可选） |
| 验收命令 | `npx ts-node scripts/coach-diagnose.ts`（无 --run-id）可执行且输出符合 AC |

### 3.6 修改文件一览

| 文件 | 变更 |
|------|------|
| `commands/bmad-coach.md` | 新建：Command 文档 |
| `scripts/coach-diagnose.ts` | 扩展：无 --run-id 时 discovery → coachDiagnose；空数据提示；截断提示 |

---

## 4. 数据源与 schema

- **评分 schema**：符合 `RunScoreRecord`（scoring/writer/types.ts）的 JSON
- **单文件**：`{run_id}.json`（单条或数组）
- **JSONL**：`scores.jsonl` 每行一条 JSON
- **排除**：`sft-dataset.jsonl` 及不符合 run-score-schema 的 json
- **依据**：`scoring/docs/RUN_ID_CONVENTION.md`、`scoring/schema/run-score-schema.json`

---

## 5. 验收标准映射

| AC | Scenario | spec 对应 |
|----|----------|-----------|
| AC-1 | 有数据时输出诊断 | §3.4 coachDiagnose + formatToMarkdown |
| AC-2 | 空目录时友好提示 | §3.3 空数据 Markdown |
| AC-3 | 数据量限制 | §3.2 limit、§3.4 truncated 提示 |

<!-- AUDIT: PASSED by code-reviewer -->
