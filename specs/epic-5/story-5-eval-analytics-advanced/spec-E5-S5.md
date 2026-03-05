# Spec E5-S5：eval-analytics-advanced

*Story 5.5 技术规格*  
*Epic E5 feature-eval-scoring-enhancement*

---

## 1. 概述

本 spec 将 Story 5.5 的实现范围固化为可执行技术规格，覆盖 B07（SFT 微调数据集提取）、B08（Prompt 模板优化建议）、B09（规则自优化建议）。  
输入来源如下：

- `_bmad-output/implementation-artifacts/5-5-eval-analytics-advanced/5-5-eval-analytics-advanced.md`（Story 5.5）
- `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1（GAP-B07、GAP-B08、GAP-B09）
- `_bmad-output/planning-artifacts/dev/epics.md`（Story 5.5 与 AC）

---

## 2. 范围与边界

### 2.1 In Scope

| 需求要点 | 技术规格 |
| ---------- | ---------- |
| B07 SFT 数据集提取 | `sft-extractor.ts`：`extractSftDataset`、`gitDiffBetween`（抽象便于 mock）；phase_score≤60 记录；source_path 关联 BUGFIX §1+§4 作为 instruction；git diff 拆分 bad/good |
| B07 schema 扩展 | RunScoreRecord 新增 `source_path?`；ParseAndWriteScoreOptions 新增 `artifactDocPath?` |
| B08 Prompt 优化建议 | `prompt-optimizer.ts`：`generatePromptSuggestions(clusters, skillsDir)` → `PromptSuggestion[]`；匹配 skills/ 和 .cursor/rules/ 下 .md；keywords 交集≥2 则匹配；priority：frequency≥5→high，≥3→medium，其他→low |
| B09 规则自优化建议 | `rule-suggestion.ts`：`generateRuleSuggestions(clusters, records, rulesDir)` → `RuleSuggestion[]`；records 用于 evidence_total；失败率>50% 且 deduct<8→increase_deduct；失败率>80%→promote_to_veto；关键词不匹配→add_new_item；仅输出 YAML 建议，不修改规则文件 |

### 2.2 Out of Scope

- B06 能力短板聚类由 Story 5.4 负责；本 Story 读取 clusterWeaknesses 输出作为 B08/B09 输入
- 自动修改规则文件：B09 仅输出 `rule-upgrade-suggestions.yaml`，不直接应用

### 2.3 修改与新增文件一览

| 文件 | 变更 |
| ------ | ------ |
| `scoring/writer/types.ts` | RunScoreRecord 新增 `source_path?: string` |
| `scoring/schema/run-score-schema.json` | 新增 `source_path` 属性 |
| `scoring/orchestrator/parse-and-write.ts` | ParseAndWriteScoreOptions 新增 `artifactDocPath?`；写入 record 时附加 `source_path` |
| `scripts/parse-and-write-score.ts` | 新增 `--artifactDocPath` CLI 参数 |
| `scoring/analytics/sft-extractor.ts` | 新增 |
| `scoring/analytics/prompt-optimizer.ts` | 新增 |
| `scoring/analytics/rule-suggestion.ts` | 新增 |
| `scripts/analytics-sft-extract.ts` | 新增 |
| `scripts/analytics-prompt-optimize.ts` | 新增 |
| `scripts/analytics-rule-suggest.ts` | 新增 |
| 3 个测试文件 | 新增 |

---

## 3. 功能规格

### 3.1 B07 SFT 提取（sft-extractor.ts）

#### 3.1.1 数据结构

```ts
export interface SftEntry {
  instruction: string;   // BUGFIX §1+§4 拼接
  input: string;         // bad code（git diff 中 - 行）
  output: string;        // good code（git diff 中 + 行）
  source_run_id: string;
  base_commit_hash: string;
}
```

#### 3.1.2 gitDiffBetween

```ts
export function gitDiffBetween(hash1: string, hash2: string, cwd?: string): string;
```

- 抽象为独立函数便于测试 mock
- 使用 `getGitHeadHashFull` 或等效逻辑获取 40 位 hash 执行 diff
- 短 hash 需通过 `git rev-parse --verify <short-hash>` 验证唯一性后再 diff

#### 3.1.3 extractSftDataset

```ts
export async function extractSftDataset(
  dataPath?: string,
  outputPath?: string
): Promise<SftEntry[]>;
```

- 读取 scoring/data/*.json（及 scores.jsonl）中 `phase_score ≤ 60` 的记录
- 从 `source_path` 读取 BUGFIX 文档 §1（问题描述）+ §4（修复方案）作为 instruction；**提取规则**：使用正则 `/## §1[^\n]*\n([\s\S]*?)(?=## §|$)/` 与 `/## §4[^\n]*\n([\s\S]*?)(?=## §|$)/`（JS 中 `$` 表字符串末尾）匹配至下一个 `## §` 或文件末尾，取捕获组内容 trim 后用 `\n\n` 拼接；若无 §1 或 §4 则 instruction 为空字符串并跳过该记录
- 验证 `base_commit_hash` 短 hash 唯一性（`git rev-parse --verify`）
- 调用 `gitDiffBetween(base_commit_hash, 'HEAD')`；`-` 行→input，`+` 行→output
- 写入 JSONL；source_path 不存在或 git diff 失败时跳过该记录并 `console.warn`（不抛异常）

#### 3.1.4 异常处理

- source_path 指向的文件不存在 → 跳过 + warn
- base_commit_hash 不存在或无法验证 → 跳过 + warn
- git diff 失败 → 跳过 + warn

### 3.2 B08 Prompt 优化建议（prompt-optimizer.ts）

#### 3.2.1 数据结构

```ts
export interface PromptSuggestion {
  target_file: string;
  /** 建议修改的章节；当前实现默认为 "全文"（针对整个文件），可扩展为从文件结构推导 */
  section: string;
  suggestion: string;
  evidence: string;
  priority: 'high' | 'medium' | 'low';
}
```

#### 3.2.2 generatePromptSuggestions

```ts
export function generatePromptSuggestions(
  clusters: WeaknessCluster[],
  skillsDir?: string
): PromptSuggestion[];
```

- 遍历 `skills/` 和 `.cursor/rules/` 下所有 `.md` 文件
- 计算 `cluster.keywords` 与文件内容（忽略大小写）的交集
- 交集 ≥ 2 则判定匹配，列为 `target_file`；`section` 默认为 `"全文"`
- priority：frequency ≥ 5 → high；≥ 3 → medium；其他 → low
- 输出 `scoring/data/prompt-optimization-suggestions.md`

### 3.3 B09 规则自优化建议（rule-suggestion.ts）

#### 3.3.1 数据结构

```ts
export interface RuleSuggestion {
  item_id: string;
  current_deduct: number;
  suggested_deduct: number;
  action: 'increase_deduct' | 'promote_to_veto' | 'add_new_item';
  reason: string;
  evidence_count: number;
  evidence_total: number;
}
```

#### 3.3.2 generateRuleSuggestions

```ts
export function generateRuleSuggestions(
  clusters: WeaknessCluster[],
  records: RunScoreRecord[],
  rulesDir?: string
): RuleSuggestion[];
```

- `records`：用于统计每个 item_id 的 evidence_total（check_items 中出现次数，含 passed 与 failed）
- evidence_count = cluster.frequency（失败次数）；evidence_total = records 中该 item_id 在 check_items 中的总出现次数；失败率 = evidence_count / evidence_total；**evidence_total === 0 时跳过该 item**，避免 NaN
- 使用 js-yaml 解析 `rulesDir`（默认 `scoring/rules`）下 `*-scoring.yaml`
- 失败率 > 50% 且 deduct < 8 → `increase_deduct`（suggested_deduct = current + 2）
- 失败率 > 80% → `promote_to_veto`
- 关键词不匹配现有 item_id → `add_new_item`
- 输出 `scoring/data/rule-upgrade-suggestions.yaml`，不修改规则文件

### 3.4 B07 schema 与参数

- `RunScoreRecord` 新增 `source_path?: string`（JSDoc：触发本次评分的源文档路径，如 BUGFIX 文档）
- `ParseAndWriteScoreOptions` 新增 `artifactDocPath?: string`
- 写入 record 时：`source_path: options.artifactDocPath`

---

## 4. 验收标准映射（AC）

| AC ID | 验收标准 | spec 对应章节 | 验证方式 |
| ------ | ---------- | --------------- | ---------- |
| AC-B07-1 | phase_score≤60 时从 source_path 关联 BUGFIX 文档提取 §1、§4 作为 instruction | §3.1.3 | 单测：sft-extractor.test.ts 用例 3 |
| AC-B07-2 | git diff 中 `-` 行→input，`+` 行→output | §3.1.2, §3.1.3 | 单测：sft-extractor.test.ts 用例 4 |
| AC-B07-3 | 输出 JSONL 正确；source_path 不存在或 git diff 失败时跳过 + warn | §3.1.4 | 单测：sft-extractor.test.ts 用例 5、6、7 |
| AC-B07-4 | A/B 级记录被过滤 | §3.1.3 | 单测：sft-extractor.test.ts 用例 2 |
| AC-B07-schema | RunScoreRecord 新增 source_path；parseAndWriteScore 支持 artifactDocPath | §3.4 | 单测或集成测试 |
| AC-B08-1 | clusters 匹配 skills/ 和 .cursor/rules/ 下 .md；keywords 交集≥2 | §3.2.2 | 单测：prompt-optimizer.test.ts 用例 1 |
| AC-B08-2 | priority：frequency≥5→high，≥3→medium，其他→low | §3.2.2 | 单测：prompt-optimizer.test.ts 用例 2、3 |
| AC-B08-3 | 空 cluster→空建议；输出 Markdown 格式正确 | §3.2.2 | 单测：prompt-optimizer.test.ts 用例 3、4 |
| AC-B09-1 | 失败率>50% 且 deduct<8 → increase_deduct | §3.3.2 | 单测：rule-suggestion.test.ts 用例 1 |
| AC-B09-2 | 失败率>80% → promote_to_veto | §3.3.2 | 单测：rule-suggestion.test.ts 用例 2 |
| AC-B09-3 | 关键词不匹配 → add_new_item；输出 YAML 正确 | §3.3.2 | 单测：rule-suggestion.test.ts 用例 3、4 |
| AC-B09-4 | 不直接修改规则文件 | §3.3.2 | 代码审查 |

---

## 5. 需求追溯清单（来源 -> spec）

| 来源 | 来源条目 | spec 章节 | 覆盖状态 |
| ------ | ---------- | ----------- | ---------- |
| Story 5.5 文档 | B07 SFT 提取、B08 Prompt 优化、B09 规则自优化 | §2.1, §3, §4 | 已覆盖 |
| TASKS_gaps v2.1 | GAP-B07（SftEntry、gitDiffBetween、extractSftDataset、artifactDocPath） | §3.1 | 已覆盖 |
| TASKS_gaps v2.1 | GAP-B08（PromptSuggestion、generatePromptSuggestions、keywords 交集≥2、priority 分级） | §3.2 | 已覆盖 |
| TASKS_gaps v2.1 | GAP-B09（RuleSuggestion、generateRuleSuggestions、仅输出 YAML） | §3.3 | 已覆盖 |
| Story 5.5 Party-Mode | SFT 格式、git diff 策略、B08 priority 分级、B09 不修改规则 | §3.1, §3.2, §3.3 | 已覆盖 |
| Story 5.5 前置依赖 | B06 聚类结果作为 B08/B09 输入 | §3.2, §3.3 | 已覆盖 |

---

<!-- AUDIT: PASSED by code-reviewer -->

