# Tasks: eval-analytics-clustering (E5-S4)

**Input**：`spec-E5-S4.md`、`plan-E5-S4.md`、`IMPLEMENTATION_GAPS-E5-S4.md`  
**Scope**：仅 B06（能力短板聚类分析）  
**执行方式**：按 T1 → T2 → T3 → T4 顺序推进

---

## 1. 需求追溯与任务映射

| 任务组 | 来源需求 | AC | Gap |
| -------- | ---------- | ---- | ----- |
| T1 | B06 cluster-weaknesses 核心 | AC-B06-1~5 | GAP-E5-S4-B06-1 |
| T2 | B06 coachDiagnose 集成 | AC-B06-6 | GAP-E5-S4-B06-3, GAP-E5-S4-B06-4 |
| T3 | B06 CLI | AC-B06-7 | GAP-E5-S4-B06-5 |
| T4 | B06 测试与验收 | AC-B06-1~7 | GAP-E5-S4-B06-2, GAP-E5-S4-B06-6, GAP-E5-S4-B06-7 |

---

## 2. Phase 1：cluster-weaknesses 核心实现（T1）

**AC**：AC-B06-1、AC-B06-2、AC-B06-3、AC-B06-4、AC-B06-5  
**集成验证**：本 Phase 模块的集成验证见 T4.2（coachDiagnose）、T4.3（CLI）

- [x] **T1.1** 新增 `scoring/analytics/cluster-weaknesses.ts`：定义 `WeaknessCluster` 接口（cluster_id、primary_item_ids、frequency、keywords、severity_distribution、affected_stages）
- [x] **T1.2** 实现 `clusterWeaknesses(records: RunScoreRecord[], minFrequency?: number): WeaknessCluster[]`；minFrequency 默认 2；空 records 返回 `[]`
- [x] **T1.3** 层 1：遍历 records，提取 passed=false 的 check_items，按 item_id 聚合频率；频率 < minFrequency 过滤
- [x] **T1.4** 层 2：对每个 cluster 的 note 按 `/[\s,，。；：!?、]+/` 分词；空 note 或 note 缺失 → keywords: []；过滤中英文停用词（的、了、是、在、与、和、等；the、a、an、is、are、and、or），取 top-5 关键词（同频按字典序）
- [x] **T1.5** severity_distribution：score_delta≤-10→'高'，-10<score_delta≤-5→'中'，>-5 或 null/undefined→'低'
- [x] **T1.6** cluster_id 生成：primary_item_ids 按字典序排序后以 '_' 拼接；单元素时即该 item_id；affected_stages 从 records 的 stage 聚合去重
- [x] **T1.7** 按 frequency 降序排列输出；零 ML 依赖（不引入 scikit-learn、ml-kmeans）

---

## 3. Phase 2：coachDiagnose 集成（T2）

**AC**：AC-B06-6

- [x] **T2.1** 修改 `scoring/coach/types.ts`：`CoachDiagnosisReport` 新增 `weakness_clusters?: WeaknessCluster[]`
- [x] **T2.2** 修改 `scoring/coach/diagnose.ts` 的 `coachDiagnose`：在 `buildWeakAreas` 调用后，调用 `clusterWeaknesses(records)` 填充 `report.weakness_clusters`；异常时 try-catch 并置 `weakness_clusters = []` 或保持 undefined，不阻断 scoring pipeline

---

## 4. Phase 3：CLI（T3）

**AC**：AC-B06-7

- [x] **T3.1** 新增 `scripts/analytics-cluster.ts`：解析 `--dataPath`（默认 scoring/data）、`--minFrequency`（默认 2）、`--output`（可选）
- [x] **T3.2** 加载逻辑（独立于 loadRunRecords，不按 run_id 过滤）：① 读取 dataPath 下所有 `*.json`，解析为 RunScoreRecord[]；② 若存在 scores.jsonl，逐行解析追加；③ 调用 `clusterWeaknesses(records, minFrequency)`；④ 默认 JSON.stringify 输出到 stdout，`--output <path>` 时写入文件

---

## 5. Phase 4：测试与验收（T4）

**AC**：覆盖 AC-B06-1~7

- [x] **T4.1** 新增 `scoring/analytics/__tests__/cluster-weaknesses.test.ts`，实现 5 个用例：① 多条记录相同 item_id 失败 → 聚合为 cluster；② 频率 < minFrequency → 不纳入；③ 空 records → 返回 []；④ 关键词从 note 正确提取；⑤ severity_distribution 统计正确
- [x] **T4.2** 在 `scoring/coach/__tests__/diagnose.test.ts` 或 `coach-integration.test.ts` 中补充：`report.weakness_clusters` 存在且为 WeaknessCluster[] 形态；`weak_areas` 保持 string[] 向后兼容
- [x] **T4.3** CLI 验收：`npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2` 可执行且输出合法 JSON；`--output <path>` 时可写入文件
- [x] **T4.4** 执行 `npm run test:scoring` 全量回归

---

## 6. 验收命令汇总

| 命令 | 覆盖 |
| ------ | ------ |
| `npm run test:scoring -- scoring/analytics/__tests__/cluster-weaknesses.test.ts` | T1, T4.1 |
| `npm run test:scoring -- scoring/coach/__tests__/diagnose.test.ts` | T2, T4.2 |
| `npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2` | T3, T4.3 |
| `npm run test:scoring` | T4.4, 全量回归 |

---

## 7. Gaps → 任务映射（按需求文档章节）

| Gap ID | 本任务表行 | 对应任务 |
| -------- | ---------- | ---------- |
| GAP-E5-S4-B06-1 | ✓ 有 | T1.1-T1.7 |
| GAP-E5-S4-B06-2 | ✓ 有 | T4.1 |
| GAP-E5-S4-B06-3 | ✓ 有 | T2.1 |
| GAP-E5-S4-B06-4 | ✓ 有 | T2.2 |
| GAP-E5-S4-B06-5 | ✓ 有 | T3.1-T3.2 |
| GAP-E5-S4-B06-6 | ✓ 有 | T4.2 |
| GAP-E5-S4-B06-7 | ✓ 有 | T4.3 |

---

## 8. 完成判定标准

- T1~T4 全部任务完成并勾选。
- AC-B06-1~7 均有可追溯任务与测试结果。
- 不新增「可选/后续/待定/酌情」等模糊描述。
- 每个模块的验收须包含该模块在生产代码关键路径（coachDiagnose、CLI analytics-cluster）中被导入并调用的集成验证。

---

<!-- AUDIT: PASSED by code-reviewer -->
