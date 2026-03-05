# Story 6.2：Coach 按 Epic/Story 筛选

Status: ready-for-dev

**Epic**：6 eval-ux-coach-and-query  
**Story**：6.2  
**Slug**：coach-epic-story-filter  
**来源**：epics.md §Epic 6、prd.eval-ux-last-mile.md §5.1（REQ-UX-1.5、REQ-UX-1.6）、prd.eval-ux-last-mile.md §5.2（REQ-UX-2.2、REQ-UX-2.4）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-1.5 | CLI 参数 `--epic N`，仅诊断 Epic N 相关数据 | 是 | AC-1 |
| REQ-UX-1.6 | CLI 参数 `--story X.Y`，解析规则 `--story X.Y` → epicId=X, storyId=Y | 是 | AC-2 |
| REQ-UX-2.2 | epic_id/story_id 解析规则；无约定时调用方得到明确反馈 | 是 | AC-3 |
| REQ-UX-2.4 | Epic/Story 筛选范围仅针对 real_dev | 是 | scope 约束 |

---

## 2. User Story

**As a** 日常开发者  
**I want to** 运行 `/bmad-coach --epic 3` 或 `/bmad-coach --story 3.3`  
**so that** 我只看到指定 Epic/Story 的短板诊断，不被其他数据干扰

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **`/bmad-coach --epic N`**  
   - 仅诊断 Epic N 相关数据
   - 仅对符合 run_id 约定或含 metadata 的 record 生效

2. **`/bmad-coach --story X.Y`**  
   - 仅诊断 Story X.Y，解析规则：epicId=X, storyId=Y

3. **数据范围约束**  
   - 仅对符合 run_id 约定（见 `scoring/docs/RUN_ID_CONVENTION.md`）或含 metadata 的 record 生效
   - 无约定数据时，调用方得到明确反馈（如「无可筛选数据」或「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」）

4. **Epic/Story 筛选仅针对 scenario=real_dev**  
   - eval_question 数据不与 Epic/Story 筛选混用；记录含 `scenario` 字段时，Epic/Story 筛选仅作用于 `scenario !== 'eval_question'` 的记录

5. **依赖 Story 6.3 的处理**  
   - 若 Story 6.3（scoring/query/）已完成：复用 `queryByEpic`、`queryByStory` 进行筛选
   - 若 Story 6.3 未完成：本 Story 在 Command/脚本层实现最小筛选逻辑，即：在 `scripts/coach-diagnose.ts` 内或 `scoring/coach/` 中实现「按 run_id 正则与 source_path 解析过滤」的 inline 逻辑，供 `--epic`、`--story` 分支使用

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario | Story 6.3 | scoring/query/ 索引层；本 Story 在 6.3 未完成时使用最小 inline 筛选逻辑 |
| /bmad-scores 及表格格式汇总 | Story 6.4 | Scores Command |
| bmad-eval-analytics Skill 自然语言触发 | Story 6.5 | 「帮我看看短板」等短语触发 |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | Epic 筛选 | 存在符合 run_id 约定或含 metadata 的 Epic 3 记录 | 用户运行 `/bmad-coach --epic 3` | 仅诊断 Epic 3 相关数据 |
| AC-2 | Story 筛选 | 存在 Story 3.3 的记录（符合 run_id 约定或 metadata） | 用户运行 `/bmad-coach --story 3.3` | 仅诊断 Story 3.3（解析为 epicId=3, storyId=3） |
| AC-3 | 无约定数据 | 记录无 epic_id/story_id 可解析 | 用户运行 `--epic` 或 `--story` | 调用方得到明确反馈（无可筛选数据） |

---

## 5. 实现约束与依赖

### 5.1 现有能力（Story 6.1 产出）

- `scoring/coach/diagnose.ts`：`coachDiagnose(runId, options?)`、`formatToMarkdown`
- `scoring/coach/discovery.ts`：`discoverLatestRunId(dataPath, limit?)`
- `scripts/coach-diagnose.ts`：支持无 `--run-id` 时 discovery → coachDiagnose；支持 `--limit`、`--format`
- `commands/bmad-coach.md`：Command 文档，当前未含 `--epic`、`--story` 说明

### 5.2 实现路径

1. **扩展 `scripts/coach-diagnose.ts` 参数**  
   - 新增 `--epic N`、`--story X.Y` 解析
   - 当传入 `--epic` 或 `--story` 时：优先调用 `scoring/query/` 的 `queryByEpic`、`queryByStory`（若 Story 6.3 已实现）；否则执行最小 inline 筛选逻辑
   - 最小 inline 逻辑：加载 `getScoringDataPath()` 下评分记录，按 `scoring/docs/RUN_ID_CONVENTION.md` 的 run_id 正则 `-e(\d+)-s(\d+)-` 或 `-e(\d+)-s(\d+)$` 及 source_path 解析（`epic-{N}-*/story-{N}-*`、`story-{epic}-{story}-*`），过滤出匹配 epic/story 的 record；过滤 scenario=eval_question 的记录
   - 无匹配记录时输出「无可筛选数据」或「当前评分记录无可解析 Epic/Story，请确认 run_id 约定」

2. **coachDiagnose 扩展**  
   - 若 `coachDiagnose` 当前仅支持 `runId`，需扩展 `options` 以支持 `{ epicId?, storyId?, records?: RunScoreRecord[] }`；或在本 Story 内实现「先筛选 records → 再调用 coachDiagnose 等价逻辑」的封装函数，避免破坏 diagnose.ts 的现有接口

3. **Command 文档更新**  
   - `commands/bmad-coach.md` 增加 `--epic N`、`--story X.Y` 说明与调用逻辑
   - 同步到 `.cursor/commands/bmad-coach.md`（若项目有该约定）

### 5.3 解析规则（RUN_ID_CONVENTION.md）

- **run_id**：`-e(\d+)-s(\d+)-` 或 `-e(\d+)-s(\d+)$` → epicId、storyId
- **source_path fallback**：`epic-{N}-*/story-{N}-*` → (epic, story)；`story-{epic}-{story}-*` → (epic, story)
- **scenario 过滤**：Epic/Story 筛选仅针对 `scenario !== 'eval_question'` 或未设 scenario 的记录

---

## 6. Tasks / Subtasks

- [ ] Task 1：扩展 scripts/coach-diagnose.ts 支持 --epic、--story（AC: #1, #2, #3）
  - [ ] Subtask 1.1：解析 `--epic N`、`--story X.Y`，校验参数格式
  - [ ] Subtask 1.2：实现最小 inline 筛选逻辑（run_id 正则 + source_path fallback），或复用 queryByEpic/queryByStory
  - [ ] Subtask 1.3：无匹配时输出明确反馈
- [ ] Task 2：扩展 coachDiagnose 或封装「按 records 诊断」逻辑（AC: #1, #2）
  - [ ] Subtask 2.1：确定接口扩展或封装路径（options.epicId/storyId 或传入预筛选 records）
  - [ ] Subtask 2.2：实现筛选后调用 coachDiagnose 的调用链
- [ ] Task 3：更新 commands/bmad-coach.md（AC: #1, #2, #3）
  - [ ] Subtask 3.1：新增 --epic、--story 参数说明
  - [ ] Subtask 3.2：补充验收命令 `npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3`

---

## 7. Dev Notes

### 7.1 架构约束

- 不修改 `RunScoreRecord` schema；epic_id/story_id 由解析得出，不写入 record
- 遵循 `scoring/docs/RUN_ID_CONVENTION.md` 的解析规则与 fallback 顺序
- 若 Story 6.3 已实现，优先复用 `scoring/query/`；否则使用最小 inline 实现，便于 6.3 完成后迁移

### 7.2 源代码涉及

| 模块 | 路径 | 变更说明 |
|------|------|----------|
| 脚本 | `scripts/coach-diagnose.ts` | 新增 --epic、--story 分支；调用筛选逻辑 |
| Coach | `scoring/coach/diagnose.ts` 或 新封装 | 扩展 options 或封装按 records 诊断 |
| 查询层 | `scoring/query/` | Story 6.3 已实现时复用 queryByEpic、queryByStory；否则本 Story 使用最小 inline 筛选逻辑 |
| Command | `commands/bmad-coach.md`、`.cursor/commands/bmad-coach.md` | 参数说明与调用逻辑 |

### 7.3 测试要求

- 单元测试：筛选逻辑（run_id 解析、source_path fallback、scenario 过滤）
- 集成/端到端：`npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` 在有数据/无数据/无约定数据时输出符合 AC

---

## 8. 禁止词表合规声明

本 Story 文档已避免使用本 skill § 禁止词表所列全部词汇。所有范围界定均采用明确归属（由 Story X.Y 负责）。

---

## 9. 产出物清单

| 产出 | 路径 |
|------|------|
| Command 扩展 | `commands/bmad-coach.md`（新增 --epic、--story 参数说明与调用逻辑） |
| 脚本扩展 | `scripts/coach-diagnose.ts` 支持 --epic、--story |
| Coach 扩展或封装 | `scoring/coach/` 内筛选或 options 扩展 |
| 验收命令 | `npx ts-node scripts/coach-diagnose.ts --epic 3`、`--story 3.3` 可执行且输出符合 AC |

---

## 10. References

- [Source: scoring/docs/RUN_ID_CONVENTION.md]：run_id 约定、解析规则、source_path fallback
- [Source: prd.eval-ux-last-mile.md §5.1]：REQ-UX-1.5、REQ-UX-1.6
- [Source: prd.eval-ux-last-mile.md §5.2]：REQ-UX-2.2、REQ-UX-2.4
- [Source: story-6-1-coach-command-no-args/6-1-coach-command-no-args.md]：discovery、coachDiagnose、coach-diagnose.ts 扩展模式
