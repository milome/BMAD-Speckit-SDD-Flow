# Spec E5-S4：eval-analytics-clustering

*Story 5.4 技术规格*  
*Epic E5 feature-eval-scoring-enhancement*

---

## 1. 概述

本 spec 将 Story 5.4 的实现范围固化为可执行技术规格，仅覆盖 B06（能力短板聚类分析）。  
输入来源如下：

- `_bmad-output/planning-artifacts/dev/epics.md`（Story 5.4 与 AC）
- `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1（GAP-B06）
- `_bmad-output/implementation-artifacts/5-4-eval-analytics-clustering/5-4-eval-analytics-clustering.md`

---

## 2. 范围与边界

### 2.1 In Scope：B06（能力短板聚类分析）

| 需求要点 | 技术规格 |
| ---------- | ---------- |
| 新增 cluster-weaknesses 模块 | 新增 `scoring/analytics/cluster-weaknesses.ts`，导出 `clusterWeaknesses`、`WeaknessCluster` |
| 两层聚类分析 | 层 1：按 `item_id` 聚合 `passed=false` 的 check_items，统计频率；层 2：对 note 按 `/[\s,，。；：!?、]+/` 分词，过滤停用词，取 top-5 关键词 |
| minFrequency 默认值 | 默认 2；频率 < minFrequency 的 item_id 不纳入结果 |
| severity_distribution | 从 score_delta 反向映射：≤-10→'高'，-10<score_delta≤-5→'中'，>-5→'低' |
| coachDiagnose 集成 | `weak_areas` 保留（string[] 向后兼容）；新增 `report.weakness_clusters?: WeaknessCluster[]`，在 buildWeakAreas 后调用 clusterWeaknesses(records) 填充 |
| CLI 脚本 | `scripts/analytics-cluster.ts`：加载 dataPath 下 *.json 与 scores.jsonl，解析为 RunScoreRecord[]，调用 clusterWeaknesses，输出 JSON 到 stdout 或 `--output` 文件 |
| 零 ML 依赖 | 不引入 scikit-learn、ml-kmeans；使用原生 JS/TS 正则与数组操作 |
| 测试框架 | 单测使用 vitest（与 scoring 其他模块一致） |

### 2.2 Out of Scope

- SFT 提取、Prompt 优化建议、规则自优化建议（B07/B08/B09）由 Story 5.5 负责
- 本文档不包含生产代码提交与测试执行结果，仅定义实现规格

### 2.3 修改文件一览

| 文件 | 变更 |
| ------ | ------ |
| `scoring/coach/diagnose.ts` | 调用 clusterWeaknesses(records)，填充 report.weakness_clusters |
| `scoring/coach/types.ts` | CoachDiagnosisReport 新增 `weakness_clusters?: WeaknessCluster[]` |

---

## 3. 功能规格

### 3.1 cluster-weaknesses 核心接口

#### 3.1.1 数据结构

```ts
export interface WeaknessCluster {
  cluster_id: string;       // 生成规则：primary_item_ids 按字典序排序后以 '_' 拼接；单元素时即该 item_id
  primary_item_ids: string[];
  frequency: number;
  keywords: string[];
  severity_distribution: Record<string, number>;
  affected_stages: string[];
}
```

#### 3.1.2 主函数

```ts
export function clusterWeaknesses(
  records: RunScoreRecord[],
  minFrequency?: number
): WeaknessCluster[];
```

- `minFrequency` 默认 2
- 空 `records` → 返回空数组 `[]`
- 按 `frequency` 降序排列输出

#### 3.1.3 层 1：item_id 聚合

- 遍历 `records`，提取所有 `passed=false` 的 `check_items`
- 按 `item_id` 聚合，统计频率（出现次数）
- 频率 < `minFrequency` 的 item_id 不纳入结果

#### 3.1.4 层 2：关键词提取

- 对每个 cluster 关联的 note 文本，使用正则 `/[\s,，。；：!?、]+/` 分词
- 空 note 或 note 缺失 → `keywords: []`
- 过滤停用词：中文（的、了、是、在、与、和、等）；英文（the、a、an、is、are、and、or）
- 取 top-5 关键词：按词频降序；同频时按字典序取前 5

#### 3.1.5 severity_distribution

- `score_delta ≤ -10` → '高'
- `-10 < score_delta ≤ -5` → '中'
- `score_delta > -5` 或 `score_delta` 为 `undefined`/`null` → '低'
- `severity_distribution` 为 `Record<'高'|'中'|'低', number>`，统计各 severity 数量

#### 3.1.6 affected_stages

- 从每条 record 的 `stage` 字段聚合，去重后填入 `affected_stages`

### 3.2 coachDiagnose 集成

- 在 `diagnose.ts` 的 `coachDiagnose` 中，完成 `phaseScores` 计算、`buildWeakAreas` 调用后，传入 `records` 调用 `clusterWeaknesses(records)`
- 将结果写入 `report.weakness_clusters`
- `clusterWeaknesses` 失败不影响 scoring pipeline（分析模块独立；可 try-catch 或上层容错，本 spec 不强制实现方式，但必须保证 scoring pipeline 不被阻塞）

### 3.3 CLI 脚本

- `scripts/analytics-cluster.ts`：`--dataPath`（默认 `scoring/data`）、`--minFrequency`（默认 2）、`--output`（可选，指定时写入文件）
- 加载逻辑：① 读取 dataPath 下所有 `*.json`，解析为 RunScoreRecord[]；② 若存在 `scores.jsonl`，逐行解析追加
- 默认 `JSON.stringify` 输出到 stdout；`--output <path>` 时写入文件

---

## 4. 验收标准映射（AC）

| AC ID | 验收标准 | spec 对应章节 | 验证方式 |
| ------ | ---------- | --------------- | ---------- |
| AC-B06-1 | 多条 RunScoreRecord 中存在相同 item_id 的 check_items 失败时，`clusterWeaknesses(records, minFrequency=2)` 聚合为 WeaknessCluster，包含 keywords、severity_distribution、affected_stages | §3.1.2, §3.1.3 | 单测：cluster-weaknesses.test.ts 用例 1 |
| AC-B06-2 | severity 从 score_delta 反向映射：≤-10→'高'，-10<score_delta≤-5→'中'，score_delta>-5→'低' | §3.1.5 | 单测：cluster-weaknesses.test.ts 用例 5 |
| AC-B06-3 | 频率 < minFrequency 的 item_id 不纳入结果 | §3.1.3 | 单测：cluster-weaknesses.test.ts 用例 2 |
| AC-B06-4 | 空 records → 返回空数组 | §3.1.2 | 单测：cluster-weaknesses.test.ts 用例 3 |
| AC-B06-5 | 关键词从 note 中正确提取（正则分词 + 停用词过滤） | §3.1.4 | 单测：cluster-weaknesses.test.ts 用例 4 |
| AC-B06-6 | AI Coach coachDiagnose 调用时，weak_areas 保持 string[] 向后兼容；report.weakness_clusters 包含完整聚类结果 | §3.2 | 集成测试或 diagnose 单测 |
| AC-B06-7 | CLI scripts/analytics-cluster.ts 可执行：加载 dataPath 下 *.json 与 scores.jsonl，调用 clusterWeaknesses，输出 JSON 到 stdout 或 --output 文件 | §3.3 | 验收脚本 |

---

## 5. 需求追溯清单（来源 -> spec）

| 来源 | 来源条目 | spec 章节 | 覆盖状态 |
| ------ | ---------- | ----------- | ---------- |
| `epics.md` Story 5.4 | B06 能力短板聚类分析 | §2.1, §3, §4 | 已覆盖 |
| `TASKS_gaps功能补充实现.md` v2.1 | GAP-B06 方案（WeaknessCluster、clusterWeaknesses、两层分析、severity 映射、5 测试用例、CLI、Party-Mode 关键决策） | §3.1, §3.2, §3.3, §4 | 已覆盖 |
| Story 5.4 文档 | Party-Mode 决议（两层分析、minFrequency=2、零 ML 依赖、停用词列表） | §2.1, §3.1 | 已覆盖 |
| Story 5.4 文档 | Task 1~3 与 AC 列表 | §4, §5 | 已覆盖 |
| Story 5.4 文档 | 独立性：clusterWeaknesses 失败不影响 scoring pipeline | §3.2 | 已覆盖 |

---

<!-- AUDIT: PASSED by code-reviewer -->
