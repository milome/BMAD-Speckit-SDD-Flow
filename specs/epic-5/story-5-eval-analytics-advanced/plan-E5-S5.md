# plan-E5-S5：eval-analytics-advanced 实现方案

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.5  
**输入**：`spec-E5-S5.md`、Story 5.5、`epics.md`、`TASKS_gaps功能补充实现.md` v2.1（GAP-B07、B08、B09）

---

## 1. 目标与约束

- 实现 B07（SFT 提取）、B08（Prompt 优化建议）、B09（规则自优化建议），不扩展到其他 GAP。
- B07 依赖 schema 扩展（source_path、artifactDocPath）；B08/B09 依赖 Story 5.4 的 clusterWeaknesses 输出。
- 分析模块独立于评分流水线，失败不影响 scoring pipeline。
- **必须包含**完整的集成测试与端到端功能测试计划，验证各模块在生产代码关键路径（CLI scripts）中被导入、调用并正确输出。

---

## 2. 实施分期

### Phase 1：B07 前置 schema 与参数

1. 修改 `scoring/writer/types.ts`：`RunScoreRecord` 新增 `source_path?: string`，JSDoc 注明语义。
2. 修改 `scoring/schema/run-score-schema.json`：新增 `source_path` 属性。
3. 修改 `scoring/orchestrator/parse-and-write.ts`：`ParseAndWriteScoreOptions` 新增 `artifactDocPath?: string`；写入 record 时附加 `source_path: options.artifactDocPath`。
4. 修改 `scripts/parse-and-write-score.ts`：新增 `--artifactDocPath` CLI 参数。

### Phase 2：B07 SFT 提取核心

1. 新增 `scoring/analytics/sft-extractor.ts`：定义 `SftEntry` 接口、`gitDiffBetween`、`extractSftDataset`。
2. `gitDiffBetween(hash1, hash2, cwd?)`：抽象为独立函数，内部使用 `execSync` 调用 `git diff`；短 hash 需 `git rev-parse --verify` 验证唯一性；diff 使用 `getGitHeadHashFull`（40 位）获取 HEAD。
3. `extractSftDataset`：读取 dataPath 下 `*.json` 与 `scores.jsonl`；过滤 phase_score≤60；从 source_path 读取 BUGFIX，按 spec §3.1.3 正则提取 §1+§4；验证 base_commit_hash 后调用 gitDiffBetween；`-` 行→input，`+` 行→output；异常时跳过 + warn。
4. 新增 `scripts/analytics-sft-extract.ts` CLI：`--dataPath`、`--output`。

### Phase 3：B08 Prompt 优化建议

1. 新增 `scoring/analytics/prompt-optimizer.ts`：定义 `PromptSuggestion`，实现 `generatePromptSuggestions(clusters, skillsDir?)`。
2. 遍历 skillsDir（默认 `skills/`）和 `.cursor/rules/` 下 `.md` 文件；cluster.keywords 与文件内容交集≥2 则匹配；section 默认为 "全文"；priority 按 frequency 分级。
3. 输出 `scoring/data/prompt-optimization-suggestions.md`。
4. 新增 `scripts/analytics-prompt-optimize.ts` CLI：可先调用 cluster 或从文件加载 clusters，再调用 generatePromptSuggestions。

### Phase 4：B09 规则自优化建议

1. 新增 `scoring/analytics/rule-suggestion.ts`：定义 `RuleSuggestion`，实现 `generateRuleSuggestions(clusters, records, rulesDir?)`。
2. 用 js-yaml 解析 rulesDir 下 `*-scoring.yaml` 获取 item deduct；evidence_count=cluster.frequency，evidence_total 从 records 统计；evidence_total===0 跳过；失败率>50% 且 deduct<8→increase_deduct；>80%→promote_to_veto；关键词不匹配→add_new_item。
3. 输出 `scoring/data/rule-upgrade-suggestions.yaml`，不修改规则文件。
4. 新增 `scripts/analytics-rule-suggest.ts` CLI：加载 records（dataPath）、clusters（调用 cluster 或从文件），调用 generateRuleSuggestions(clusters, records, rulesDir)。

### Phase 5：测试与回归

1. 新增 `scoring/analytics/__tests__/sft-extractor.test.ts`：7 个用例（C/D 提取、A/B 过滤、§1/§4 解析、diff 拆分、JSONL、source_path 缺失、git 不可用）。
2. 新增 `scoring/analytics/__tests__/prompt-optimizer.test.ts`：4 个用例（high/low priority、空 cluster、Markdown 格式）。
3. 新增 `scoring/analytics/__tests__/rule-suggestion.test.ts`：4 个用例（increase_deduct、promote_to_veto、add_new_item、YAML 格式）。
4. 集成验证：三个 CLI 可执行且输出符合预期格式。
5. 执行 `npm run test:scoring` 全量回归。

---

## 3. 模块与文件改动设计

### 3.1 新增文件

| 文件 | 责任 | 对应需求 |
| ------ | ------ | ---------- |
| `scoring/analytics/sft-extractor.ts` | SftEntry、gitDiffBetween、extractSftDataset | B07 |
| `scoring/analytics/prompt-optimizer.ts` | PromptSuggestion、generatePromptSuggestions | B08 |
| `scoring/analytics/rule-suggestion.ts` | RuleSuggestion、generateRuleSuggestions | B09 |
| `scripts/analytics-sft-extract.ts` | B07 CLI | AC-B07-* |
| `scripts/analytics-prompt-optimize.ts` | B08 CLI | AC-B08-* |
| `scripts/analytics-rule-suggest.ts` | B09 CLI | AC-B09-* |
| `scoring/analytics/__tests__/sft-extractor.test.ts` | B07 单测 7 用例 | AC-B07-* |
| `scoring/analytics/__tests__/prompt-optimizer.test.ts` | B08 单测 4 用例 | AC-B08-* |
| `scoring/analytics/__tests__/rule-suggestion.test.ts` | B09 单测 4 用例 | AC-B09-* |

### 3.2 修改文件

| 文件 | 变更 | 对应需求 |
| ------ | ------ | ---------- |
| `scoring/writer/types.ts` | source_path 新增 | AC-B07-schema |
| `scoring/schema/run-score-schema.json` | source_path 属性 | AC-B07-schema |
| `scoring/orchestrator/parse-and-write.ts` | artifactDocPath、source_path 写入 | AC-B07-schema |
| `scripts/parse-and-write-score.ts` | --artifactDocPath | AC-B07-schema |

---

## 4. 详细技术方案

### 4.1 B07 数据加载与 BUGFIX 解析

- 数据源：dataPath 下 `*.json` 与 `scores.jsonl`，合并为 RunScoreRecord[]（与 Story 5.4 analytics-cluster 加载逻辑一致）。
- BUGFIX §1/§4 正则：`/## §1[^\n]*\n([\s\S]*?)(?=## §|$)/`、`/## §4[^\n]*\n([\s\S]*?)(?=## §|$)/`，取捕获组 trim 后用 `\n\n` 拼接。

### 4.2 B08/B09 与 cluster 的集成

- B08 CLI：加载 dataPath 下 records → 调用 `clusterWeaknesses(records)` 或从 cluster 输出文件加载 → 调用 `generatePromptSuggestions(clusters, skillsDir)` → 写入 MD。
- B09 CLI：加载 dataPath 下 records → 同上获取 clusters → 调用 `generateRuleSuggestions(clusters, records, rulesDir)` → 写入 YAML。

### 4.3 生产代码关键路径验证

- **SFT CLI**：`scripts/analytics-sft-extract.ts` 加载数据 → 调用 `extractSftDataset` → 写入 JSONL。
- **Prompt CLI**：`scripts/analytics-prompt-optimize.ts` 加载 clusters → 调用 `generatePromptSuggestions` → 写入 MD。
- **Rule CLI**：`scripts/analytics-rule-suggest.ts` 加载 records + clusters → 调用 `generateRuleSuggestions` → 写入 YAML。
- 集成测试须验证：① 三个 CLI 可执行；② 输出文件格式正确；③ 异常场景（空数据、缺失文件）不抛异常，仅 warn。

---

## 5. 测试计划（单元 + 集成 + 端到端）

### 5.1 单元测试

| 测试文件 | 覆盖点 | 命令 |
| ---------- | -------- | ------ |
| `sft-extractor.test.ts` | 7 用例：C/D 提取、A/B 过滤、§1/§4、diff、JSONL、缺失、git 不可用 | `npm run test:scoring -- sft-extractor.test.ts` |
| `prompt-optimizer.test.ts` | 4 用例：high/low priority、空 cluster、Markdown | `npm run test:scoring -- prompt-optimizer.test.ts` |
| `rule-suggestion.test.ts` | 4 用例：increase_deduct、promote_to_veto、add_new_item、YAML | `npm run test:scoring -- rule-suggestion.test.ts` |

### 5.2 集成测试

| 测试文件 | 覆盖点 | 命令 |
| ---------- | -------- | ------ |
| `scoring/orchestrator/__tests__/parse-and-write.test.ts` | 传入 `artifactDocPath` 时，written record 包含 `source_path` | `npm run test:scoring -- parse-and-write.test.ts` |

### 5.3 端到端 / CLI 验收

| 场景 | 验证目标 | 命令 |
| ------ | ---------- | ------ |
| SFT CLI 可执行 | 加载 scoring/data、输出 sft-dataset.jsonl | `npx ts-node scripts/analytics-sft-extract.ts --dataPath scoring/data --output scoring/data/sft-dataset.jsonl` |
| Prompt CLI 可执行 | 加载 clusters、输出 prompt-optimization-suggestions.md | `npx ts-node scripts/analytics-prompt-optimize.ts --dataPath scoring/data` |
| Rule CLI 可执行 | 加载 records+clusters、输出 rule-upgrade-suggestions.yaml | `npx ts-node scripts/analytics-rule-suggest.ts --dataPath scoring/data` |
| scoring 全链路回归 | 新增模块不破坏既有流程 | `npm run test:scoring` |

---

## 6. 需求追溯与任务映射（plan ↔ spec ↔ tasks）

| 需求 ID / AC | spec 章节 | plan 章节 | 任务段落 |
| -------------- | ----------- | ----------- | ---------- |
| AC-B07-schema | spec §3.4 | Phase 1 | T1 |
| AC-B07-1~4 | spec §3.1 | Phase 2 | T2 |
| AC-B08-1~3 | spec §3.2 | Phase 3 | T3 |
| AC-B09-1~4 | spec §3.3 | Phase 4 | T4 |
| 单测与 CLI 验收 | spec §4 | Phase 5 | T5 |

---

## 7. 执行准入标准

- 生成 `tasks-E5-S5.md` 后，所有任务须具备明确文件路径与验收命令。
- 至少完成 15 个单测 + 3 个 CLI 可执行验收 + parseAndWriteScore artifactDocPath 集成验证。
- 通过 `npm run test:scoring` 后方可进入 Story 5.5 实施收尾。

---

<!-- AUDIT: PASSED by code-reviewer -->

