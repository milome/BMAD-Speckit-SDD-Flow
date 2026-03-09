# run_id 约定（eval-ux-last-mile 实施前提）

**版本**：1.0  
**状态**：已定稿  
**生效**：E6 Story 6.3、6.4（REQ-UX-2）实施前  
**对齐**：scoring/orchestrator、scoring/writer、scripts/parse-and-write-score.ts、bmad-code-reviewer-lifecycle

---

## 1. 概述

`run_id` 由**调用方**传入 `parseAndWriteScore`，orchestrator 与 writer 不做生成或改写，仅透传写入 `RunScoreRecord.run_id`。  
本约定约束**所有传入 parseAndWriteScore 的 runId**，以支持 scoring/query 的 `queryByEpic`、`queryByStory` 及 Coach 的 `--epic`/`--story` 筛选。

---

## 2. 场景与格式

### 2.1 real_dev（真实开发）

| 格式 | 说明 | 示例 |
|------|------|------|
| **推荐** | `{prefix}-e{epic}-s{story}-{stage}-{ts}` | `dev-e4-s2-story-1730812345` |
| **简化** | `{prefix}-e{epic}-s{story}-{ts}` | `dev-e5-s5-1730812345` |
| **兼容** | 任意字符串；无 epic/story 时 Epic/Story 筛选不可用 | `cli-1730812345` |

**字段**：

- `prefix`：可选，建议 `dev`、`real`、`cli` 等，用于区分来源。
- `epic`：数字，Epic 编号。
- `story`：数字，Story 编号。
- `stage`：可选，如 prd、arch、story、spec、plan、tasks、implement、post_impl。
- `ts`：时间戳（毫秒），保证唯一性。

**解析规则**（query 层实现）：

- 正则：`-e(\d+)-s(\d+)-` 或 `-e(\d+)-s(\d+)$` → `epicId`、`storyId`。
- 无匹配时，尝试从 `source_path` 提取（见 §3）。

### 2.2 eval_question（评测题目）

| 格式 | 说明 | 示例 |
|------|------|------|
| **必须** | `eval-q{id}-{version}-{ts}` | `eval-q001-v1-1730812345` |

**字段**：

- `id`：题目 id（如 q001、q002）。
- `version`：题目版本（v1、v2），用于 v1/v2 评分隔离。
- `ts`：时间戳。

**校验**：`scenario=eval_question` 时 `question_version` 必填（`writer/validate.ts` 已实现）。

---

## 3. source_path 提取规则（fallback）

当 `run_id` 不符合 `-e{epic}-s{story}-` 约定时，query 层可从 `source_path` 提取 `epic_id`、`story_id`：

| 模式 | 说明 | 示例 path → (epic, story) |
|------|------|---------------------------|
| `story-{epic}-{story}` | 路径中含 story-N-M | `story-5-eval-analytics-advanced` → (5, ?) |
| `epic-{N}-*/story-{N}-*` | implementation-artifacts 路径 | `epic-5-feature-eval-scoring-enhancement/story-5-eval-analytics-advanced` → (5, 5) |
| `story-{epic}-{story}-*` | 含 story 编号的目录名 | `story-4-2-eval-ai-coach` → (4, 2) |

**实现建议**（scoring/query 层）：

1. 优先从 run_id 正则解析。
2. 若无结果且 `source_path` 存在，按上表顺序尝试路径解析。
3. 仍无法解析时，返回「无可筛选数据」或空集，并给出明确反馈。

---

## 4. 调用方职责

### 4.1 scripts/parse-and-write-score.ts

- 当前：`runId = args.runId ?? \`cli-${Date.now()}\``。
- **建议**：支持 `--epic`、`--story` 时生成约定格式，如 `dev-e{epic}-s{story}-{stage}-${Date.now()}`。
- 传入 `artifactDocPath` 时，写入 `source_path`，供 query 层 fallback 解析。

### 4.2 完整 run 门槛与 2-stage 设计

当前完整 run 门槛为 `MIN_STAGES_COMPLETE_RUN`（见 scoring/dashboard/compute.ts）；2-stage 设计（story+implement）下为 2，即至少 2 个 stage 视为完整 run，可纳入 Epic 聚合。

### 4.3 同一 Story 多 stage 共享 run_id（Story 9.1 T11）

当同一 Story 的 spec、plan、gaps、tasks、implement 等多阶段需聚合为一次「完整 run」时，可共享 run_id：

- **方式一**：传入 `--runGroupId dev-e{epic}-s{story}-{ts}`，与 `--runId` 等效；调用方保证同一 run 的各 stage 使用相同 runGroupId。
- **方式二**：约定格式 `dev-e{epic}-s{story}-{ts}`，ts 取自首次写入；后续 stage 调用时传入 `--runId <首次的run_id>` 或 `--runGroupId <首次的run_id>`。
- **单文件模式**：同 run_id 多次写入为覆盖语义，最终仅保留最后一条；若需保留多 stage，应使用 jsonl 或 both 模式，或为每 stage 使用不同 run_id 后缀（如 `dev-e9-s1-1730-spec`、`dev-e9-s1-1730-plan`）并依靠 run_id 正则 `dev-e{N}-s{N}-` 聚合。

### 4.4 bmad-code-reviewer-lifecycle / speckit-workflow

- 调用 parseAndWriteScore 时，若可从报告路径或 artifactDocPath 推断 epic/story，应传入符合 §2.1 的 runId。
- 若无推断能力，可继续使用 `cli-${Date.now()}`；Epic/Story 筛选对该类记录不可用。

### 4.5 triggerStage 与 stage 一致时可省略（Story 9.2 Task 6.2）

当 `--triggerStage` 与 `--stage` 一致时，可省略 `--triggerStage`；CLI 默认 `triggerStage = stage`。  
例如：`--stage implement` 且未传 `--triggerStage` 时，`triggerStage` 默认为 `implement`，由 `config/scoring-trigger-modes.yaml` 的 `implement_audit_pass` 条目匹配通过校验。

### 4.6 /bmad-eval-questions run（E8）

- 必须使用 `eval-q{id}-{version}-{timestamp}` 格式。
- 传入 `question_version`，与 run_id 中 version 一致。

---

## 5. 向后兼容

- **已有数据**：历史 `cli-*`、`test-*`、`accept-*` 等 run_id 保持不变；query 层对无约定格式的记录，Epic/Story 筛选返回空或明确提示。
- **不修改**：RunScoreRecord schema 不新增必填字段；epic_id/story_id 由 query 层解析得出，不写入 record。

---

## 6. 参考

- PRD：`prd.eval-ux-last-mile.md` §7 实施前提条件
- REQ-UX-2.2：epic_id/story_id 解析规则
- REQ-UX-5.7：eval_question run_id 含 version
- `scoring/orchestrator/parse-and-write.ts`：runId 透传
- `scoring/writer/types.ts`：RunScoreRecord.run_id, source_path
