# plan-E5-S4：eval-analytics-clustering 实现方案

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.4  
**输入**：`spec-E5-S4.md`、Story 5.4、`epics.md`、`TASKS_gaps功能补充实现.md` v2.1（GAP-B06）

---

## 1. 目标与约束

- 仅实现 B06（能力短板聚类分析），不扩展到 B07/B08/B09。
- 两层分析：层 1 item_id 频率统计，层 2 note 关键词提取聚合；零 ML 依赖（不引入 scikit-learn、ml-kmeans）。
- `clusterWeaknesses` 由 `coachDiagnose` 在 buildWeakAreas 后调用；分析模块独立，失败不影响 scoring pipeline。
- 每个功能点均需有对应测试任务与验收命令，禁止「后续补充」。
- **必须包含**完整的集成测试与端到端功能测试计划，验证 clusterWeaknesses 在生产代码关键路径（coachDiagnose、CLI analytics-cluster）中被导入、调用并正确输出。

---

## 2. 实施分期

### Phase 1：cluster-weaknesses 核心实现

1. 新增 `scoring/analytics/cluster-weaknesses.ts`：定义 `WeaknessCluster` 接口，实现 `clusterWeaknesses(records, minFrequency?)`。
2. 层 1：遍历 records，提取 `passed=false` 的 check_items，按 `item_id` 聚合频率；频率 < minFrequency 过滤。
3. 层 2：对每个 cluster 的 note 按 `/[\s,，。；：!?、]+/` 分词；空 note 或 note 缺失 → keywords: []；过滤中英文停用词，取 top-5 关键词（同频按字典序）。
4. `severity_distribution`：score_delta ≤ -10 → '高'，-10 < score_delta ≤ -5 → '中'，>-5 或 null/undefined → '低'。
5. `cluster_id` 生成：primary_item_ids 按字典序排序后以 `'_'` 拼接；单元素时即该 item_id。
6. `affected_stages`：从 records 的 stage 聚合去重。
7. 按 frequency 降序输出。

### Phase 2：coachDiagnose 集成

1. 修改 `scoring/coach/types.ts`：`CoachDiagnosisReport` 新增 `weakness_clusters?: WeaknessCluster[]`。
2. 修改 `scoring/coach/diagnose.ts` 的 `coachDiagnose`：在 `buildWeakAreas` 后调用 `clusterWeaknesses(records)`，填充 `report.weakness_clusters`；`clusterWeaknesses` 异常时容错（不阻断流程，可 `try-catch` 并置空或忽略）。

### Phase 3：CLI 脚本

1. 新增 `scripts/analytics-cluster.ts`：`--dataPath`、`--minFrequency`、`--output`。
2. 加载：dataPath 下 `*.json` 解析为 RunScoreRecord[]；若存在 `scores.jsonl` 逐行解析追加。
3. 调用 `clusterWeaknesses(records, minFrequency)`，默认 stdout 输出 JSON；`--output` 时写入文件。

### Phase 4：测试与回归

1. 新增 `scoring/analytics/__tests__/cluster-weaknesses.test.ts`：5 个用例（聚合、minFrequency 过滤、空 records、关键词提取、severity_distribution）。
2. 在 `scoring/coach/__tests__/diagnose.test.ts` 或 `coach-integration.test.ts` 中补充：`report.weakness_clusters` 存在且为 WeaknessCluster[] 形态的断言。
3. CLI 验收：`npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2` 可执行且输出合法 JSON。
4. 执行 `npm run test:scoring` 全量回归。

---

## 3. 模块与文件改动设计

### 3.1 新增文件

| 文件 | 责任 | 对应需求 | 对应任务 |
| ------ | ------ | ---------- | ---------- |
| `scoring/analytics/cluster-weaknesses.ts` | clusterWeaknesses、WeaknessCluster | B06 | T1 |
| `scoring/analytics/__tests__/cluster-weaknesses.test.ts` | B06 核心单测 5 用例 | AC-B06-1~5 | T4.1 |
| `scripts/analytics-cluster.ts` | CLI 加载、调用、输出 | AC-B06-7 | T3 |

### 3.2 修改文件

| 文件 | 变更 | 对应需求 | 对应任务 |
| ------ | ------ | ---------- | ---------- |
| `scoring/coach/diagnose.ts` | 调用 clusterWeaknesses，填充 report.weakness_clusters | AC-B06-6 | T2.2 |
| `scoring/coach/types.ts` | CoachDiagnosisReport 新增 weakness_clusters? | AC-B06-6 | T2.1 |

---

## 4. 详细技术方案

### 4.1 clusterWeaknesses 调用链路

1. 输入 `records` 来自 `loadRunRecords` 或 CLI 加载的 RunScoreRecord[]。
2. 遍历 records → 每个 record.check_items 中 passed=false 的项 → 按 item_id 聚合频率。
3. 过滤 frequency < minFrequency。
4. 对每个 cluster：收集 note 文本 → 正则分词 → 停用词过滤 → 词频统计 → top-5（同频字典序）。
5. 对每个 check_item 的 score_delta 映射 severity，汇总 severity_distribution。
6. 收集 stage 去重 → affected_stages。
7. 按 frequency 降序排序返回。

### 4.2 coachDiagnose 集成点

- 在 `const weakAreas = buildWeakAreas(phaseScores);` 之后、构建 `report` 之前插入 `clusterWeaknesses` 调用。
- `records` 已在 coachDiagnose 中通过 `loadRunRecords` 获得；传入 `clusterWeaknesses(records)`。
- 异常容错：`try { report.weakness_clusters = clusterWeaknesses(records); } catch { report.weakness_clusters = []; }` 或等效。

### 4.3 生产代码关键路径验证

- **coachDiagnose**：`scoring/coach/diagnose.ts` → `coachDiagnose` 调用 `clusterWeaknesses` → `report.weakness_clusters` 被填充。
- **CLI**：`scripts/analytics-cluster.ts` 加载数据 → 调用 `clusterWeaknesses` → 输出 JSON。
- 集成测试须验证：① coachDiagnose 返回的 report 含 weakness_clusters；② CLI 可执行且输出合法 JSON。

---

## 5. 测试计划（单元 + 集成 + 端到端）

### 5.1 单元测试

| 测试文件 | 覆盖点 | 命令 |
| ---------- | -------- | ------ |
| `scoring/analytics/__tests__/cluster-weaknesses.test.ts` | 5 用例：聚合、minFrequency、空 records、关键词提取、severity_distribution | `npm run test:scoring -- scoring/analytics/__tests__/cluster-weaknesses.test.ts` |

### 5.2 集成测试

| 测试文件 | 覆盖点 | 命令 |
| ---------- | -------- | ------ |
| `scoring/coach/__tests__/diagnose.test.ts` 或 `coach-integration.test.ts` | report.weakness_clusters 存在且为 WeaknessCluster[]；weak_areas 保持向后兼容 | `npm run test:scoring -- scoring/coach/__tests__/diagnose.test.ts` |

### 5.3 端到端 / CLI 验收

| 场景 | 验证目标 | 命令 |
| ------ | ---------- | ------ |
| CLI 可执行 | analytics-cluster.ts 加载 scoring/data、输出合法 JSON | `npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2` |
| scoring 全链路回归 | 新增 clusterWeaknesses 不破坏既有 coachDiagnose 流程 | `npm run test:scoring` |

---

## 6. 需求追溯与任务映射（plan ↔ spec ↔ tasks）

| 需求 ID / AC | spec 章节 | plan 章节 | 任务段落 |
| -------------- | ----------- | ----------- | ---------- |
| AC-B06-1 | spec §3.1.2, §3.1.3 | Phase 1, §4.1 | T1, T4.1 |
| AC-B06-2 | spec §3.1.5 | Phase 1 | T1, T4.1 |
| AC-B06-3 | spec §3.1.3 | Phase 1 | T1, T4.1 |
| AC-B06-4 | spec §3.1.2 | Phase 1 | T1, T4.1 |
| AC-B06-5 | spec §3.1.4 | Phase 1 | T1, T4.1 |
| AC-B06-6 | spec §3.2 | Phase 2, §5.2 | T2, T4.2 |
| AC-B06-7 | spec §3.3 | Phase 3, §5.3 | T3, T4.3 |

---

## 7. 执行准入标准

- 生成 `tasks-E5-S4.md` 后，所有任务须具备明确文件路径与验收命令。
- 至少完成 5 个 cluster-weaknesses 单测 + coach diagnose 集成断言 + CLI 可执行验收。
- 通过 `npm run test:scoring` 后方可进入 Story 5.4 实施收尾。

---

<!-- AUDIT: PASSED by code-reviewer -->
