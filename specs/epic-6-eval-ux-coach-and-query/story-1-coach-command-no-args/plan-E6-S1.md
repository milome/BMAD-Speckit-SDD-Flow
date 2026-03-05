# plan-E6-S1：Coach Command 无参数运行 实现方案

**Epic**：E6 eval-ux-coach-and-query  
**Story ID**：6.1  
**输入**：`spec-E6-S1.md`、Story 6.1、`epics.md`、`prd.eval-ux-last-mile.md` §5.1

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| Story §1 REQ-UX-1.1 | spec §3.1 | Phase 2, §3.1 | ✅ |
| Story §1 REQ-UX-1.2 | spec §3.2, §3.4 | Phase 1, §4.1 | ✅ |
| Story §1 REQ-UX-1.3 | spec §3.3 | Phase 1 | ✅ |
| Story §1 REQ-UX-1.4 | spec §3.2 | §4.1 数据根路径 | ✅ |
| Story §4 AC-1 | spec §3.4 | Phase 3 | ✅ |
| Story §4 AC-2 | spec §3.3 | Phase 1 | ✅ |
| Story §4 AC-3 | spec §3.4 | Phase 1, Phase 3 | ✅ |

---

## 2. 目标与约束

- 无 `--run-id` 时执行 discovery → 取最新 run_id → coachDiagnose → Markdown 输出。
- 空目录返回「暂无评分数据，请先完成至少一轮 Dev Story」。
- 数据量超 N（默认 100）时仅用最新 N 条，附加提示「仅展示最近 N 条」。
- 复用 `getScoringDataPath`、`coachDiagnose`、`loadRunRecords` 等既有能力。
- **必须包含**完整的集成测试与端到端功能测试计划，验证 discovery + coachDiagnose 在生产代码关键路径（scripts/coach-diagnose.ts）中正确调用并输出。

---

## 3. 实施分期

### Phase 1：Discovery 逻辑实现

1. 在 `scripts/coach-diagnose.ts` 内或新增 `scoring/coach/discovery.ts` 实现 `discoverLatestRunId(dataPath, limit?)`。
2. 扫描 `getScoringDataPath()` 下 `*.json`（排除非评分 schema）与 `scores.jsonl`。
3. 评分 schema 判定：解析 JSON 后含 `run_id`、`scenario`、`stage`、`timestamp` 等 required 字段；排除 `sft-dataset.jsonl`。
4. 解析所有记录，按 `timestamp` 降序排序，取前 `limit`（默认 100）条。
5. 返回 `{ runId: string; truncated: boolean } | null`；无记录时返回 `null`。
6. 支持 `COACH_DISCOVERY_LIMIT` 环境变量与 `--limit N` CLI 参数。

### Phase 2：Command 文档

1. 新建 `commands/bmad-coach.md`：触发条件、调用脚本/流程说明、输出格式说明。
2. 同步到 `.cursor/commands/`（若项目有该约定）。

### Phase 3：脚本扩展与集成

1. 扩展 `scripts/coach-diagnose.ts`：
   - 无 `--run-id` 时：调用 `discoverLatestRunId` → 若 null 输出空数据 Markdown 提示 → 否则 `coachDiagnose(latestRunId)` → 若 `truncated` 在报告前附加「仅展示最近 N 条」→ `formatToMarkdown` 输出。
   - 有 `--run-id` 时：保持现有逻辑。
2. 默认 `--format=markdown`（当前为 json，需改为 markdown 以满足 AC）。
3. 验收命令：`npx ts-node scripts/coach-diagnose.ts`（无 --run-id）可执行且输出符合 AC。

### Phase 4：测试与回归

1. 新增 discovery 单测：空目录、单文件、JSONL、多文件混合、超 N 截断、非评分 json 排除。
2. 端到端：`npx ts-node scripts/coach-diagnose.ts` 无参 → 有数据时输出 Markdown；无数据时输出友好提示；超 N 时附加截断提示。
3. 执行 `npm run test:scoring` 全量回归（若有 scoring 测试）。

---

## 4. 模块与文件改动设计

### 4.1 新增文件

| 文件 | 责任 | 对应需求 | 对应任务 |
|------|------|----------|----------|
| `commands/bmad-coach.md` | Command 文档 | REQ-UX-1.1 | T2 |
| `scoring/coach/discovery.ts` | discoverLatestRunId | REQ-UX-1.2, spec §3.2 | T1 |

### 4.2 修改文件

| 文件 | 变更 | 对应需求 | 对应任务 |
|------|------|----------|----------|
| `scripts/coach-diagnose.ts` | 无 --run-id 分支、空数据提示、截断提示 | AC-1, AC-2, AC-3 | T3 |

### 4.3 数据路径

- 根路径：`getScoringDataPath()`（`scoring/constants/path.ts`）
- 多 worktree 聚合不纳入本 Story。

---

## 5. 详细技术方案

### 5.1 Discovery 实现细节

1. **读取 *.json**：遍历 dataPath 下 `*.json`；排除 `sft-dataset.json`（若存在）；解析为 RunScoreRecord | RunScoreRecord[]；单对象取 run_id、timestamp；数组则逐条解析。
2. **读取 scores.jsonl**：逐行 `JSON.parse`，过滤非法行；每行解析为 RunScoreRecord。
3. **合并去重**：合并所有记录，按 `timestamp` 降序排序。
4. **截断**：取前 `limit` 条；若原始总数 > limit，`truncated = true`。
5. **提取 run_id**：取排序后第一条记录的 `run_id`。
6. **schema 校验**：记录需含 `run_id`、`timestamp`；缺失则跳过该条。

### 5.2 coach-diagnose.ts 扩展流程

```text
parseArgs → 检查 runId
  ├─ 有 runId → 现有逻辑（coachDiagnose(runId) → format 输出）
  └─ 无 runId → discoverLatestRunId(dataPath, limit)
       ├─ null → 输出「暂无评分数据，请先完成至少一轮 Dev Story」→ exit 0
       └─ { runId, truncated }
            ├─ truncated → 在报告前附加「仅展示最近 N 条」
            └─ coachDiagnose(runId) → formatToMarkdown → 输出
```

### 5.3 生产代码关键路径验证

- **scripts/coach-diagnose.ts**：main() 无 --run-id 时调用 discoverLatestRunId → coachDiagnose → formatToMarkdown。
- **commands/bmad-coach.md**：文档说明调用上述脚本或等价流程。
- 集成验收：`npx ts-node scripts/coach-diagnose.ts` 无参可执行，输出符合 AC-1/AC-2/AC-3。

---

## 6. 测试计划（单元 + 集成 + 端到端）

### 6.1 单元测试

| 测试文件 | 覆盖点 | 命令 |
|----------|--------|------|
| `scoring/coach/__tests__/discovery.test.ts` | 空目录、单 json、scores.jsonl、多文件、超 N 截断、非评分排除 | `npm run test:scoring -- scoring/coach/__tests__/discovery.test.ts` |

### 6.2 集成测试

| 测试文件 | 覆盖点 | 命令 |
|----------|--------|------|
| `scripts/__tests__/coach-diagnose.e2e.test.ts` 或手动验收 | 无参有数据、无参空数据、无参超 N | `npx ts-node scripts/coach-diagnose.ts` |

### 6.3 端到端 / CLI 验收

| 场景 | 验证目标 | 命令 |
|------|----------|------|
| AC-1 有数据 | 输出 phase_scores、weak_areas、recommendations | `npx ts-node scripts/coach-diagnose.ts`（scoring/data 有数据） |
| AC-2 空目录 | 输出「暂无评分数据，请先完成至少一轮 Dev Story」 | `SCORING_DATA_PATH=/tmp/empty npx ts-node scripts/coach-diagnose.ts` |
| AC-3 超 N | 附加「仅展示最近 N 条」 | `npx ts-node scripts/coach-diagnose.ts --limit 5`（数据 > 5 时） |

---

## 7. 执行准入标准

- 生成 `tasks-E6-S1.md` 后，所有任务须具备明确文件路径与验收命令。
- discovery 单测 + 端到端 CLI 验收通过。
- 通过 `npm run test:scoring` 后方可进入 Story 6.1 实施收尾。

---

<!-- AUDIT: PASSED by code-reviewer -->
