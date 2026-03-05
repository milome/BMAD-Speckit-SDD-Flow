# IMPLEMENTATION_GAPS-E5-S4：eval-analytics-clustering

**输入**：`spec-E5-S4.md`、`plan-E5-S4.md`、当前代码基线  
**分析范围**：仅 B06（能力短板聚类分析）  
**Party-Mode 决议**：Story 5.4 §0 与 TASKS_gaps §GAP-B06（两层分析、minFrequency=2、零 ML 依赖、停用词策略）

---

## 1. 当前实现快照

基于代码现状检查，存在以下事实：

- `scoring/analytics/` 目录不存在；`scoring/analytics/cluster-weaknesses.ts` 不存在。
- `scoring/analytics/__tests__/cluster-weaknesses.test.ts` 不存在。
- `scoring/coach/diagnose.ts` 已有 `buildWeakAreas(phaseScores)`，未调用 `clusterWeaknesses`，`report` 无 `weakness_clusters` 字段。
- `scoring/coach/types.ts` 的 `CoachDiagnosisReport` 仅含 `summary`、`phase_scores`、`weak_areas`、`recommendations`、`iteration_passed`，无 `weakness_clusters`。
- `scripts/analytics-cluster.ts` 不存在。
- `loadRunRecords`（coach/loader.ts）按 run_id 过滤；CLI 需加载 dataPath 下所有 records（*.json + scores.jsonl），与 coach 加载逻辑不同，需独立实现。

---

## 2. Gap 明细（需求逐条对照）

### 2.1 B06 cluster-weaknesses 核心

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S4-B06-1 | AC-B06-1~5（cluster-weaknesses 模块） | 无 cluster-weaknesses.ts | 新增 `scoring/analytics/cluster-weaknesses.ts`，实现 `WeaknessCluster` 接口、`clusterWeaknesses(records, minFrequency?)`，层 1 item_id 聚合、层 2 note 关键词提取、severity_distribution、affected_stages、cluster_id 生成、按 frequency 降序；零 ML 依赖（不引入 scikit-learn、ml-kmeans） | T1.1-T1.7 |
| GAP-E5-S4-B06-2 | AC-B06-1~5（单测） | 无 cluster-weaknesses 单测 | 新增 `scoring/analytics/__tests__/cluster-weaknesses.test.ts`，5 个用例 | T4.1 |

### 2.2 B06 coachDiagnose 集成

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S4-B06-3 | AC-B06-6（types） | CoachDiagnosisReport 无 weakness_clusters | 新增 `weakness_clusters?: WeaknessCluster[]` | T2.1 |
| GAP-E5-S4-B06-4 | AC-B06-6（diagnose） | diagnose 未调用 clusterWeaknesses | 在 buildWeakAreas 后调用 `clusterWeaknesses(records)` 填充 `report.weakness_clusters`；异常容错 | T2.2 |

### 2.3 B06 CLI

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S4-B06-5 | AC-B06-7 | 无 analytics-cluster.ts | 新增 `scripts/analytics-cluster.ts`：加载 dataPath 下 *.json 与 scores.jsonl（全量，不按 run_id 过滤），解析为 RunScoreRecord[]，调用 clusterWeaknesses，输出 JSON 到 stdout 或 --output 文件 | T3.1-T3.2 |

### 2.4 B06 集成与 E2E 测试

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S4-B06-6 | AC-B06-6，plan §5.2 | 无 coach diagnose 中 weakness_clusters 断言 | 在 diagnose.test.ts 或 coach-integration.test.ts 中补充 `report.weakness_clusters` 为 WeaknessCluster[] 的断言 | T4.2 |
| GAP-E5-S4-B06-7 | plan §5.3 | 无 CLI 验收 | CLI 可执行：`npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2` 输出合法 JSON | T4.3 |

---

## 3. 依赖关系与实施顺序

1. 先完成 Phase 1（cluster-weaknesses 核心 + 单测），再 Phase 2（coach 集成）、Phase 3（CLI）、Phase 4（集成/E2E）。
2. types.ts 须先新增 `weakness_clusters`（T2.1），再修改 diagnose.ts 调用 clusterWeaknesses（T2.2）。
3. CLI 加载逻辑独立于 `loadRunRecords`：需读取 dataPath 下所有 `*.json` 与 `scores.jsonl`，合并为 RunScoreRecord[]（不限 run_id）。

---

## 4. 风险与缓解

| 风险 | 触发条件 | 缓解动作 | 落位任务 |
| ------ | ---------- | ---------- | ---------- |
| clusterWeaknesses 异常影响 coach | 聚类逻辑抛错 | diagnose 中 try-catch，失败时 `weakness_clusters = []` 或保持 undefined | T2.2 |
| CLI 加载大文件内存压力 | dataPath 下 JSON 过多 | 当前数据量通常 < 100 文件，可接受；若有需要可后续流式处理 | T3.1 |
| note 格式多样性 | 非预期 note 格式 | 正则 `/[\s,，。；：!?、]+/` 为通用分词，空 note 返回 keywords: [] | T1 |

---

## 5. Gap 到任务映射总表

| Gap ID | Task IDs | 验收命令 |
| -------- | ---------- | ---------- |
| GAP-E5-S4-B06-1 | T1.1-T1.7 | `npm run test:scoring -- scoring/analytics/__tests__/cluster-weaknesses.test.ts` |
| GAP-E5-S4-B06-2 | T4.1 | 同上 |
| GAP-E5-S4-B06-3 | T2.1 | 随 T2.2 集成验证 |
| GAP-E5-S4-B06-4 | T2.2 | `npm run test:scoring -- scoring/coach/__tests__/diagnose.test.ts` |
| GAP-E5-S4-B06-5 | T3.1-T3.2 | `npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2` |
| GAP-E5-S4-B06-6 | T4.2 | 同上 + coach-integration.test.ts |
| GAP-E5-S4-B06-7 | T4.3 | CLI 验收命令 |

---

<!-- AUDIT: PASSED by code-reviewer -->
