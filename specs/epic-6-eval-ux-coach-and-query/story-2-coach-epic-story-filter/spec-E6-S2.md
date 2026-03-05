# Spec E6-S2：Coach 按 Epic/Story 筛选

*Story 6.2 技术规格*  
*Epic E6 eval-ux-coach-and-query*

---

## 1. 概述

本 spec 将 Story 6.2 的实现范围固化为可执行技术规格，覆盖 `/bmad-coach --epic N` 与 `/bmad-coach --story X.Y` 的 Epic/Story 筛选诊断流程。

**输入来源**：
- `_bmad-output/implementation-artifacts/epic-6-eval-ux-coach-and-query/story-6-2-coach-epic-story-filter/6-2-coach-epic-story-filter.md`
- `prd.eval-ux-last-mile.md` §5.1（REQ-UX-1.5、REQ-UX-1.6）、§5.2（REQ-UX-2.2、REQ-UX-2.4）
- `scoring/docs/RUN_ID_CONVENTION.md`
- `story-6-1-coach-command-no-args`（discovery、coachDiagnose、coach-diagnose.ts）

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story §1 REQ-UX-1.5 | CLI 参数 `--epic N`，仅诊断 Epic N 相关数据 | spec §3.2, §3.4, §3.5 | ✅ |
| Story §1 REQ-UX-1.6 | CLI 参数 `--story X.Y`，解析规则 epicId=X, storyId=Y | spec §3.2, §3.4, §3.5 | ✅ |
| Story §1 REQ-UX-2.2 | epic_id/story_id 解析规则；无约定时明确反馈 | spec §3.3, §3.6 | ✅ |
| Story §1 REQ-UX-2.4 | Epic/Story 筛选仅针对 real_dev（scenario !== eval_question） | spec §3.4 | ✅ |
| Story §3.1 | `--epic N` 仅诊断 Epic N 相关数据 | spec §3.2, §3.4 | ✅ |
| Story §3.1 | `--story X.Y` 解析为 epicId=X, storyId=Y | spec §3.4, §3.5 | ✅ |
| Story §3.2 | 数据范围：run_id 约定或 metadata；无约定时明确反馈 | spec §3.3, §3.6 | ✅ |
| Story §3.2 | scenario=eval_question 不参与 Epic/Story 筛选 | spec §3.4 | ✅ |
| Story §3.2 | Story 6.3 未完成时使用最小 inline 筛选（run_id 正则、source_path fallback） | spec §3.3, §3.5 | ✅ |
| Story §4 AC-1 | Epic 筛选：`--epic 3` → 仅诊断 Epic 3 相关数据 | spec §3.5, §3.8 | ✅ |
| Story §4 AC-2 | Story 筛选：`--story 3.3` → 仅诊断 Story 3.3 | spec §3.5, §3.8 | ✅ |
| Story §4 AC-3 | 无约定数据时调用方得到明确反馈 | spec §3.6, §3.8 | ✅ |
| Story §5.1 | 复用 coachDiagnose、discoverLatestRunId；扩展 options 或封装 | spec §3.5 | ✅ |
| Story §5.2 | 扩展 coach-diagnose.ts 参数；Command 文档更新 | spec §3.2, §3.7 | ✅ |
| Story §5.3 | run_id 正则、source_path fallback、scenario 过滤 | spec §3.3, §3.4 | ✅ |
| Story §7.3 | 单元测试：run_id 解析、source_path fallback、scenario 过滤 | spec §5 | ✅ |

---

## 3. 功能规格

### 3.1 功能目标

| 需求要点 | 技术规格 |
|----------|----------|
| 入口 | `scripts/coach-diagnose.ts` 扩展 `--epic N`、`--story X.Y` 参数 |
| 数据源 | `getScoringDataPath()` 下 `*.json` 与 `scores.jsonl` |
| 筛选策略 | Story 6.3 未实现 → 使用最小 inline 筛选（run_id 正则 + source_path fallback） |
| 输出 | 与现有 coachDiagnose 一致的 Markdown/JSON；无匹配时明确反馈 |

### 3.2 参数解析

| 参数 | 格式 | 解析结果 | 校验 |
|------|------|----------|------|
| `--epic N` | N 为正整数 | `epicId=N, storyId=undefined` | N 必须为 `\d+`，否则报错并 exit 1 |
| `--story X.Y` | X.Y 为 epic.story 格式 | `epicId=X, storyId=Y` | X、Y 必须为正整数，否则报错并 exit 1 |
| 互斥 | `--epic` 与 `--story` 不得同时传入 | 同时传入时报错并 exit 1 |
| 与 run-id | `--epic`/`--story` 优先于 discovery；可单独使用 | 有 `--epic` 或 `--story` 时不走 discoverLatestRunId |

### 3.3 最小 Inline 筛选逻辑（Story 6.3 未实现时）

**前置条件**：`scoring/query/` 下无 `queryByEpic`、`queryByStory` 实现。

**metadata 说明**：原始 Story 所称「含 metadata」在本 spec 中统一为 run_id 与 source_path 的解析；RunScoreRecord 不新增 epic_id/story_id 字段，由解析得出，不处理其他 metadata 字段。

**实现路径**：在 `scoring/coach/` 或 `scripts/coach-diagnose.ts` 内实现 inline 筛选，加载 `getScoringDataPath()` 下所有评分记录，按下述规则过滤：

#### 3.3.1 run_id 解析

| 正则 | 提取 | 示例 |
|------|------|------|
| `-e(\d+)-s(\d+)-` | epicId, storyId | `dev-e4-s2-story-1730812345` → (4, 2) |
| `-e(\d+)-s(\d+)$` | epicId, storyId | `dev-e5-s5-1730812345` → (5, 5) |

记录无上述匹配时进入 source_path fallback。

#### 3.3.2 source_path fallback

| 模式 | 示例 path | (epic, story) |
|------|-----------|----------------|
| `epic-{epic}-*/story-{story}-*` | `epic-5-*/story-5-eval-analytics-advanced` | (5, 5) |
| `story-{epic}-{story}-*` | `story-4-2-eval-ai-coach` | (4, 2) |

#### 3.3.3 scenario 过滤

- Epic/Story 筛选**仅针对** `scenario !== 'eval_question'` 或未设 `scenario` 的记录（即 real_dev 语义）。
- 过滤掉 `scenario === 'eval_question'` 的记录，不参与 Epic/Story 匹配。

### 3.4 筛选流程

1. **加载**：调用与 `discovery.ts` 同等逻辑加载 dataPath 下所有 `RunScoreRecord`（或复用 `loadAllRecords` 等价实现）。
2. **scenario 过滤**：排除 `scenario === 'eval_question'` 的记录。
3. **解析**：对每条记录按 run_id 正则 → source_path fallback 顺序解析 `(epicId, storyId)`。
4. **匹配**：
   - `--epic N`：只保留 `parsedEpicId === N` 的记录；
   - `--story X.Y`：只保留 `parsedEpicId === X && parsedStoryId === Y` 的记录。
5. **按 run_id 聚合**：将匹配记录按 `run_id` 分组；取每个 run_id 的最新 timestamp 记录（或全量）作为诊断输入。
6. **无匹配**：若无可解析或无匹配记录，输出「无可筛选数据」或「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」并 exit 0（非错误，友好提示）。

### 3.5 coachDiagnose 扩展或封装

| 方案 | 说明 |
|------|------|
| **A：扩展 options** | `CoachDiagnoseOptions` 新增 `epicId?: number`、`storyId?: number`、`records?: RunScoreRecord[]`；若 `records` 非空则跳过 `loadRunRecords`，直接使用 `records`。 |
| **B：封装函数** | 新增 `coachDiagnoseFromRecords(records: RunScoreRecord[], options?)` 或等价封装，内部复用 diagnose 核心逻辑；脚本层先筛选 records 再调用。 |

**选择**：优先 B（封装），避免修改现有 `coachDiagnose(runId)` 签名；若 coach 内部已支持 `records` 注入则选用 A。实现时需确保筛选后 records 对应同一 run_id 或按 run_id 聚合后逐 run 诊断（按 Story 语义，Epic/Story 筛选后可能跨多个 run_id，需明确：本 Story 取**匹配记录的 run_id 集合中最新的一个**作为诊断目标，或聚合所有匹配 run 的诊断结果——Story 文档倾向于「仅诊断 Epic N / Story X.Y 相关数据」，即对匹配的 records 做诊断，可能跨 run。澄清：取匹配 records 的 run_id 去重后，选最新 timestamp 的 run_id 作为诊断目标，与无参 discovery 行为一致，仅缩小了 record 来源范围。）

**实现约定**：筛选后若存在多个 run_id，取「拥有最新 timestamp 的 record 的 run_id」作为诊断目标；调用 `coachDiagnose(runId)` 时，loader 会按 runId 加载，可能包含非 Epic/Story 的记录——需扩展 loader 或 coachDiagnose 支持「仅对指定 records 诊断」。因此采用 **B：封装** 或 **A：options.records**，使诊断基于预筛选的 records，而非 runId 二次加载。

**最终规格**：扩展 `CoachDiagnoseOptions` 支持 `records?: RunScoreRecord[]`；若 `records` 非空则 `coachDiagnose` 跳过 `loadRunRecords`，直接使用 `records` 进行诊断。否则保持 `loadRunRecords(runId)` 行为。筛选逻辑在脚本层或 coach 层实现，将筛选后的 records 传入 `coachDiagnose(runId, { records: filteredRecords })`。runId 仍必填（用于 report summary 等），可取筛选后第一个 record 的 run_id 或最新 timestamp 的 run_id。

### 3.6 无约定数据反馈

| 场景 | 输出 | 退出码 |
|------|------|--------|
| 无任何评分记录 | 「暂无评分数据，请先完成至少一轮 Dev Story」 | 0 |
| 有记录但无可解析 epic/story（run_id 与 source_path 均不匹配） | 「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」 | 0 |
| 有可解析记录但筛选后无匹配 | 「无可筛选数据」或等价明确提示 | 0 |

### 3.7 Command 文档更新

| 文件 | 变更 |
|------|------|
| `commands/bmad-coach.md` | 新增 `--epic N`、`--story X.Y` 参数说明与调用逻辑 |
| `.cursor/commands/bmad-coach.md` | 同步上述内容（若存在） |

### 3.8 验收命令

| 命令 | 预期 |
|------|------|
| `npx ts-node scripts/coach-diagnose.ts --epic 3` | 有 Epic 3 数据时仅诊断 Epic 3 相关数据；无匹配时输出明确反馈 |
| `npx ts-node scripts/coach-diagnose.ts --story 3.3` | 有 Story 3.3 数据时仅诊断 Story 3.3（epicId=3, storyId=3）；无匹配时输出明确反馈 |
| `npx ts-node scripts/coach-diagnose.ts --epic 3 --story 3.3` | 报错：参数互斥 |
| `npx ts-node scripts/coach-diagnose.ts --epic abc` | 报错：参数格式无效 |

### 3.9 修改文件一览

| 文件 | 变更 |
|------|------|
| `scripts/coach-diagnose.ts` | 新增 --epic、--story 解析；调用筛选逻辑；扩展分支 |
| `scoring/coach/diagnose.ts` 或 types | 扩展 CoachDiagnoseOptions 支持 `records?: RunScoreRecord[]`；loader 短路逻辑 |
| `scoring/coach/` | 新增 inline 筛选函数（或 filterByEpicStory）供脚本调用；或复用 discovery 的 loadAllRecords |
| `commands/bmad-coach.md` | 新增 --epic、--story 说明与验收命令 |

---

## 4. 数据源与 schema

- **RunScoreRecord**：`scoring/writer/types.ts`；含 `run_id`、`scenario`、`source_path`、`timestamp` 等。
- **RUN_ID_CONVENTION**：`scoring/docs/RUN_ID_CONVENTION.md` §2、§3。
- **不修改**：RunScoreRecord schema 不新增必填字段；epic_id/story_id 由解析得出，不写入 record。

---

## 5. 测试要求

| 类型 | 覆盖范围 | spec 对应 |
|------|----------|-----------|
| 单元测试 | run_id 解析（`-e(\d+)-s(\d+)-`、`-e(\d+)-s(\d+)$`）、source_path fallback（`epic-{epic}-*/story-{story}-*`、`story-{epic}-{story}-*`）、scenario 过滤（排除 eval_question） | §3.3, §3.4 |
| 集成/端到端 | `npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` 在有数据/无数据/无约定数据时输出符合 AC | §3.8 |

---

## 6. 依赖与约束

- **Story 6.1**：复用 `discoverLatestRunId`、`coachDiagnose`、`formatToMarkdown`。
- **Story 6.3**：未实现时使用最小 inline 筛选；实现后可迁移至 `queryByEpic`、`queryByStory`。
- **禁止**：修改 RunScoreRecord schema；将 epic_id/story_id 写入 record。
