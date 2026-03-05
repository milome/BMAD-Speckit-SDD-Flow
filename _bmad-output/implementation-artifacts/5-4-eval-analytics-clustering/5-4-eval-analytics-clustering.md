# Story 5.4：eval-analytics-clustering

Status: ready-for-dev

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.4  
**Slug**：eval-analytics-clustering  
**包含 GAP**：B06（能力短板聚类分析）  
**前置依赖**：无（独立实现，B03 的 spec/plan/tasks 记录可扩大数据源）

<!-- Note: 可执行 validate-create-story 进行质量检查后再进入 dev-story。 -->

## Story

As a AI Coach 模块，  
I want 基于 check_items 失败模式的两层聚类分析（item_id 频率 + 关键词聚合），  
so that 能力短板识别从简单阈值判定升级为结构化聚类分析。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **B06 clusterWeaknesses**：
   - `scoring/analytics/cluster-weaknesses.ts`：`clusterWeaknesses(records, minFrequency?)` → `WeaknessCluster[]`
   - 层 1：按 `item_id` 聚合 `passed=false` 的 check_items，统计频率
   - 层 2：对 note 文本按空格/标点分词，过滤停用词（中英文），提取 top-5 关键词
   - `severity_distribution`：从 `score_delta` 反向映射（≤-10→'高'，-10~-5→'中'，>-5→'低'）
   - 按 frequency 降序排列输出
   - `coachDiagnose` 集成：`weak_areas` 保留；新增 `weakness_clusters` 字段

### 1.2 本 Story 不包含

| 功能 | 负责 Story | 说明 |
|------|-----------|------|
| SFT 提取、Prompt 优化、规则建议 | Story 5.5 | B07/B08/B09 依赖本 Story 的聚类结果 |

---

## 2. Acceptance Criteria（验收标准）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-B06-1 | 多条 RunScoreRecord 中存在相同 item_id 的 check_items 失败时，`clusterWeaknesses(records, minFrequency=2)` 聚合为 `WeaknessCluster`，包含 keywords、severity_distribution、affected_stages | 单测：cluster-weaknesses.test.ts 用例 1 |
| AC-B06-2 | severity 从 score_delta 反向映射：≤-10→'高'，-10<score_delta≤-5→'中'，score_delta>-5→'低' | 单测：cluster-weaknesses.test.ts 用例 5 |
| AC-B06-3 | 频率 < minFrequency 的 item_id 不纳入结果 | 单测：cluster-weaknesses.test.ts 用例 2 |
| AC-B06-4 | 空 records → 返回空数组 | 单测：cluster-weaknesses.test.ts 用例 3 |
| AC-B06-5 | 关键词从 note 中正确提取（正则分词 + 停用词过滤） | 单测：cluster-weaknesses.test.ts 用例 4 |
| AC-B06-6 | AI Coach `coachDiagnose` 调用时，`weak_areas` 保持 string[] 向后兼容；`report.weakness_clusters` 包含完整聚类结果 | 集成测试或 diagnose 单测 |
| AC-B06-7 | CLI `scripts/analytics-cluster.ts` 可执行：加载 dataPath 下 *.json 与 scores.jsonl，调用 clusterWeaknesses，输出 JSON 到 stdout 或 `--output` 文件 | 验收脚本 |

---

## 3. Tasks / Subtasks

### Task 1：B06 clusterWeaknesses 核心实现（AC: AC-B06-1 至 AC-B06-5）

- [ ] 1.1 新增 `scoring/analytics/cluster-weaknesses.ts`：定义 `WeaknessCluster` 接口（cluster_id、primary_item_ids、frequency、keywords、severity_distribution、affected_stages）
- [ ] 1.2 实现 `clusterWeaknesses(records: RunScoreRecord[], minFrequency?: number): WeaknessCluster[]`；minFrequency 默认 2
- [ ] 1.3 层 1：遍历 records，提取 passed=false 的 check_items，按 item_id 聚合频率
- [ ] 1.4 层 2：对每个 cluster 的 note 文本分词（正则 `/[\s,，。；：!?、]+/`），过滤中英文停用词，取 top-5 关键词
- [ ] 1.5 severity_distribution：score_delta≤-10→'高'，-10<score_delta≤-5→'中'，>-5→'低'
- [ ] 1.6 零外部 ML 依赖（不引入 scikit-learn、ml-kmeans）
- [ ] 1.7 新增 `scoring/analytics/__tests__/cluster-weaknesses.test.ts`：5 个测试用例

### Task 2：B06 集成到 coachDiagnose（AC: AC-B06-6）

- [ ] 2.1 修改 `scoring/coach/diagnose.ts` 的 `coachDiagnose`：在 `buildWeakAreas` 调用后，额外调用 `clusterWeaknesses(records)` 填充 `report.weakness_clusters`
- [ ] 2.2 修改 `scoring/coach/types.ts`：`CoachDiagnosisReport` 新增 `weakness_clusters?: WeaknessCluster[]` 字段（向后兼容）

### Task 3：B06 CLI（AC: AC-B06-7）

- [ ] 3.1 新增 `scripts/analytics-cluster.ts`：加载 dataPath 下所有 *.json 和 scores.jsonl，解析为 RunScoreRecord[]；调用 clusterWeaknesses(records, minFrequency)；默认 JSON.stringify 输出到 stdout；`--output <path>` 时写入文件
- [ ] 3.2 CLI 用法：`npx ts-node scripts/analytics-cluster.ts --dataPath scoring/data --minFrequency 2`

---

## 4. Dev Notes

### 4.1 技术约束

- **minFrequency**：默认 2，至少出现 2 次才纳入聚类
- **停用词**：中文（的、了、是、在、与、和、等）；英文（the、a、an、is、are、and、or）
- **独立性**：分析模块独立于评分流水线，失败不影响 scoring pipeline
- **向后兼容**：weak_areas 保留；weakness_clusters 为可选字段

### 4.2 实现参考

| 项目 | 路径 |
|------|------|
| 需求与实现方案 | `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1 §GAP-B06 |
| Epic/Story 定义 | `_bmad-output/planning-artifacts/dev/epics.md` §3 Story 5.4 |
| coachDiagnose | `scoring/coach/diagnose.ts` |
| CoachDiagnosisReport | `scoring/coach/types.ts` |

### 4.3 新增文件一览（3 个）

| 类型 | 路径 |
|------|------|
| 实现 | `scoring/analytics/cluster-weaknesses.ts` |
| 测试 | `scoring/analytics/__tests__/cluster-weaknesses.test.ts` |
| CLI | `scripts/analytics-cluster.ts` |

### 4.4 修改文件一览（2 个）

| 文件 | 变更 |
|------|------|
| `scoring/coach/diagnose.ts` | 调用 clusterWeaknesses，填充 weakness_clusters |
| `scoring/coach/types.ts` | CoachDiagnosisReport 新增 weakness_clusters |

### 4.5 测试用例总数

- B06：5 个（cluster-weaknesses.test.ts）

---

## 5. References

- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B06] clusterWeaknesses 实现方案（WeaknessCluster 接口、clusterWeaknesses 函数签名、severity 映射规则、5 个测试用例、CLI 脚本）
- [Source: _bmad-output/planning-artifacts/dev/epics.md#Story-5.4] Epic 5 Story 5.4 完整定义

---

## 6. Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
