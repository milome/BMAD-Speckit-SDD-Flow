# plan-E7-S1：仪表盘生成器实现方案

**Epic**：E7 eval-ux-dashboard-and-sft  
**Story ID**：7.1  
**输入**：`spec-E7-S1.md`、Story 7.1、prd.eval-ux-last-mile.md §5.3、scoring/query/、scoring/veto/

---

## 1. 需求映射清单（plan.md ↔ 需求文档 + spec.md）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | 覆盖状态 |
|-------------|-------------|-------------|----------|
| REQ-UX-3.1 项目健康度总分 | spec §3.2.1 | Phase 2, §4.2 | ✅ |
| REQ-UX-3.2 四维雷达图 | spec §3.2.2 | Phase 2, §4.3 | ✅ |
| REQ-UX-3.3 短板 Top 3 | spec §3.2.3 | Phase 2, §4.4 | ✅ |
| REQ-UX-3.4 Veto 触发统计 | spec §3.2.4 | Phase 2, §4.5 | ✅ |
| REQ-UX-3.5 趋势 | spec §3.2.5 | Phase 2, §4.6 | ✅ |
| REQ-UX-3.6 无数据提示 | spec §3.3 | Phase 2, §4.7 | ✅ |
| REQ-UX-3.7 Command /bmad-dashboard | spec §3.1, §3.5 | Phase 1 | ✅ |
| AC-1～AC-4 | spec §3.6 | Phase 3, §5 | ✅ |

---

## 2. 目标与约束

- 新建 `/bmad-dashboard` Command 与 `scripts/dashboard-generate.ts` 脚本。
- 复用 scoring/query 的 queryByScenario、loadAndDedupeRecords；scoring/veto 的 buildVetoItemIds；scoring/constants/weights 的 PHASE_WEIGHTS。
- 实现仪表盘生成逻辑：总分、四维、短板 Top 3、Veto 统计、趋势；输出 Markdown 到 `_bmad-output/dashboard.md`。
- 数据源仅 scenario=real_dev。
- 禁止伪实现、占位；TDD 红绿灯模式。

---

## 3. 实施分期

### Phase 1：Command 文档与脚本骨架

1. 新建 `commands/bmad-dashboard.md`：定义 `/bmad-dashboard` 触发、无参数、验收命令。
2. 新建 `scripts/dashboard-generate.ts`：
   - 解析无参数；调用 getScoringDataPath()。
   - 调用 queryByScenario('real_dev', dataPath) 或 loadAndDedupeRecords + filter real_dev。
   - 空数据时输出「暂无数据，请先完成至少一轮 Dev Story」，写入 _bmad-output/dashboard.md，exit 0。

### Phase 2：仪表盘计算与输出

1. **scoring/dashboard/** 模块（或内嵌脚本）：
   - `getLatestRunRecords(records: RunScoreRecord[]): RunScoreRecord[]`：按 run_id 分组，取 timestamp 最大组。
   - `getRecentRuns(records: RunScoreRecord[], n: number): RunScoreRecord[][]`：按 run_id 分组，取最近 n 个 run 的 record 数组。
2. **computeHealthScore(records)**：`sum(phase_score * phase_weight) / sum(phase_weight)`；round 到整数。
3. **getDimensionScores(records)**：合并 dimension_scores；无则「无数据」。
4. **getWeakTop3(records)**：按 phase_score 升序取前 3；含 stage、epic.story。
5. **countVetoTriggers(records, vetoIds)**：遍历 check_items，计数 passed=false 且 item_id in vetoIds。
6. **getTrend(runGroups)**：最近 5 run 的加权总分；比较最近 vs 前一次 → 升/降/持平。
7. **formatDashboardMarkdown(data)**：将上述数据格式化为 Markdown。
8. 有数据时：计算 → 格式化 → 写入 _bmad-output/dashboard.md → console.log(stdout)。

### Phase 3：验收与测试

1. 验收命令：`npx ts-node scripts/dashboard-generate.ts`。
2. 若存在 `.cursor/commands/`，同步 `bmad-dashboard.md`。
3. 单元测试：computeHealthScore、getDimensionScores、getWeakTop3、countVetoTriggers、getTrend、formatDashboardMarkdown。
4. 集成：有数据/无数据时运行脚本，验证 _bmad-output/dashboard.md 与 stdout。

---

## 4. 模块与文件改动设计

### 4.1 新增文件

| 文件 | 责任 | 对应需求 |
|------|------|----------|
| `commands/bmad-dashboard.md` | /bmad-dashboard 触发、验收 | spec §3.1 |
| `scripts/dashboard-generate.ts` | CLI 入口、调用 dashboard 模块 | spec §3.5 |
| `scoring/dashboard/index.ts` | 导出 computeHealthScore、formatDashboardMarkdown 等 | spec §3.2 |
| `scoring/dashboard/compute.ts` | 总分、四维、短板、Veto、趋势计算 | spec §3.2.1～3.2.5 |
| `scoring/dashboard/format.ts` | Markdown 格式化 | spec §3.2 |
| `_bmad-output/dashboard.md` | 输出产物（由脚本生成） | spec §3.5 |

### 4.2 依赖关系

| 依赖 | 路径 |
|------|------|
| 查询层 | scoring/query（queryByScenario 或 loadAndDedupeRecords） |
| Veto | scoring/veto（buildVetoItemIds） |
| 权重 | scoring/constants/weights（PHASE_WEIGHTS） |
| 类型 | scoring/writer/types（RunScoreRecord、CheckItem、DimensionScore） |
| 解析 | scoring/query（parseEpicStoryFromRecord） |

### 4.3 数据路径

- 复用 getScoringDataPath()；输出路径 `_bmad-output/dashboard.md` 相对于 process.cwd()。

---

## 5. 详细技术方案

### 5.1 基准 Run 与最近 5 Run 获取

```ts
function groupByRunId(records: RunScoreRecord[]): Map<string, RunScoreRecord[]> {
  const byRun = new Map<string, RunScoreRecord[]>();
  for (const r of records) {
    const arr = byRun.get(r.run_id) ?? [];
    arr.push(r);
    byRun.set(r.run_id, arr);
  }
  return byRun;
}

function getLatestRunRecords(records: RunScoreRecord[]): RunScoreRecord[] {
  const groups = groupByRunId(records);
  const sorted = [...groups.entries()].sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((x) => new Date(x.timestamp).getTime()));
    const maxB = Math.max(...b.map((x) => new Date(x.timestamp).getTime()));
    return maxB - maxA;
  });
  return sorted[0]?.[1] ?? [];
}
```

### 5.2 项目健康度总分公式

- `total = sum(r.phase_score * r.phase_weight) / sum(r.phase_weight)`，其中 phase_weight > 0
- 若某 record 的 phase_weight 为 0 或缺失：可使用 PHASE_WEIGHTS 按 stage 索引；或跳过该 record

### 5.3 四维雷达图

- 遍历 records 的 dimension_scores；按 dimension 名合并（取平均或最新）
- 缺失维度显示「无数据」

### 5.4 短板 Top 3

- 按 phase_score 升序排序，取前 3
- 展示格式：`{stage}` 或 `E{epic}.S{story} {stage}: {score} 分`

### 5.5 Veto 触发统计

- `vetoIds = buildVetoItemIds()`
- `count = 0`；遍历 records 的 check_items，若 `!c.passed && vetoIds.has(c.item_id)` 则 count++

### 5.6 趋势

- 取最近 5 个 run 的 record 数组
- 每 run 计算 weightedTotal
- 比较 run[0] vs run[1]：若 run[0] > run[1] → 升；run[0] < run[1] → 降；else 持平
- 若只有 1 个 run → 持平

### 5.7 验收命令

| 场景 | 命令 | 预期 |
|------|------|------|
| 有数据 | `npx ts-node scripts/dashboard-generate.ts` | Markdown 含总分、四维、短板、Veto、趋势；_bmad-output/dashboard.md 存在 |
| 无数据 | 空目录运行 | 「暂无数据...」；dashboard.md 仍写入 |
| 无 dimension_scores | fixture 无 dimension_scores | 该维度「无数据」 |

---

## 6. 执行准入标准

- 生成 tasks-E7-S1.md 后，所有任务须具备明确文件路径与验收命令。
- 单元测试通过：dashboard 计算与格式化相关测试。
- 集成验证：`npx ts-node scripts/dashboard-generate.ts` 可执行；_bmad-output/dashboard.md 产出正确。
- TDD 红绿灯：每任务须记录 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]。
