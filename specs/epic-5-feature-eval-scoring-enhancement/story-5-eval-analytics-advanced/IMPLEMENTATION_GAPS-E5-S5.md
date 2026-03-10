# IMPLEMENTATION_GAPS-E5-S5：eval-analytics-advanced

**输入**：`spec-E5-S5.md`、`plan-E5-S5.md`、当前代码基线  
**分析范围**：B07（SFT 提取）、B08（Prompt 优化建议）、B09（规则自优化建议）  
**Party-Mode 决议**：Story 5.5 §0、TASKS_gaps §GAP-B07/B08/B09（SFT 格式、git diff 策略、B08 priority、B09 仅输出 YAML）

---

## 1. 当前实现快照

基于代码现状检查，存在以下事实：

- `scoring/writer/types.ts`：`RunScoreRecord` 无 `source_path` 字段。
- `scoring/schema/run-score-schema.json`：无 `source_path` 属性。
- `scoring/orchestrator/parse-and-write.ts`：`ParseAndWriteScoreOptions` 无 `artifactDocPath`；recordToWrite 无 `source_path`。
- `scripts/parse-and-write-score.ts`：无 `--artifactDocPath` 参数。
- `scoring/analytics/sft-extractor.ts` 不存在。
- `scoring/analytics/prompt-optimizer.ts` 不存在。
- `scoring/analytics/rule-suggestion.ts` 不存在。
- `scripts/analytics-sft-extract.ts`、`scripts/analytics-prompt-optimize.ts`、`scripts/analytics-rule-suggest.ts` 不存在。
- `scoring/analytics/__tests__/sft-extractor.test.ts`、`prompt-optimizer.test.ts`、`rule-suggestion.test.ts` 不存在。
- `scoring/analytics/cluster-weaknesses.ts` 已存在（Story 5.4）；`WeaknessCluster` 接口可用。
- `scoring/utils/hash.ts` 已有 `getGitHeadHashFull`，可供 sft-extractor 使用。

---

## 2. Gap 明细（需求逐条对照）

### 2.1 B07 schema 与参数（AC-B07-schema）

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S5-B07-1 | AC-B07-schema（types） | RunScoreRecord 无 source_path | 新增 `source_path?: string`，JSDoc 注明 | T1.1 |
| GAP-E5-S5-B07-2 | AC-B07-schema（schema） | run-score-schema.json 无 source_path | properties 新增 `source_path` | T1.2 |
| GAP-E5-S5-B07-3 | AC-B07-schema（parse-and-write） | 无 artifactDocPath、source_path 写入 | ParseAndWriteScoreOptions 新增 `artifactDocPath?`；recordToWrite 附加 `source_path: options.artifactDocPath` | T1.3 |
| GAP-E5-S5-B07-4 | AC-B07-schema（CLI） | parse-and-write-score 无 --artifactDocPath | 新增 `--artifactDocPath` 参数并传入 parseAndWriteScore | T1.4 |

### 2.2 B07 SFT 提取核心

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S5-B07-5 | AC-B07-1~4（sft-extractor） | 无 sft-extractor.ts | 新增 `scoring/analytics/sft-extractor.ts`：SftEntry、gitDiffBetween、extractSftDataset；数据源 *.json + scores.jsonl；phase_score≤60 过滤；BUGFIX §1+§4 正则提取；gitDiffBetween 拆分 bad/good | T2.1-T2.4 |
| GAP-E5-S5-B07-6 | AC-B07-3（异常处理） | - | source_path 不存在、base_commit_hash 无法验证、git diff 失败 → 跳过 + console.warn | T2.4 |
| GAP-E5-S5-B07-7 | AC-B07-*（CLI） | 无 analytics-sft-extract.ts | 新增 `scripts/analytics-sft-extract.ts`：--dataPath、--output | T2.5 |
| GAP-E5-S5-B07-8 | AC-B07-1~4（单测） | 无 sft-extractor 单测 | 新增 `scoring/analytics/__tests__/sft-extractor.test.ts`，7 个用例 | T2.6 |

### 2.3 B08 Prompt 优化建议

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S5-B08-1 | AC-B08-1~3（prompt-optimizer） | 无 prompt-optimizer.ts | 新增 `scoring/analytics/prompt-optimizer.ts`：PromptSuggestion、generatePromptSuggestions(clusters, skillsDir?)；遍历 skills/ 和 .cursor/rules/ 下 .md；keywords 交集≥2 匹配；section="全文"；priority 分级 | T3.1-T3.2 |
| GAP-E5-S5-B08-2 | AC-B08-*（CLI） | 无 analytics-prompt-optimize.ts | 新增 `scripts/analytics-prompt-optimize.ts` | T3.3 |
| GAP-E5-S5-B08-3 | AC-B08-*（单测） | 无 prompt-optimizer 单测 | 新增 `scoring/analytics/__tests__/prompt-optimizer.test.ts`，4 个用例 | T3.4 |

### 2.4 B09 规则自优化建议

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S5-B09-1 | AC-B09-1~4（rule-suggestion） | 无 rule-suggestion.ts | 新增 `scoring/analytics/rule-suggestion.ts`：RuleSuggestion、generateRuleSuggestions(clusters, records, rulesDir?)；js-yaml 解析 *-scoring.yaml；evidence_total 从 records 统计；evidence_total===0 跳过；失败率>50% 且 deduct<8→increase_deduct；>80%→promote_to_veto；关键词不匹配→add_new_item；仅输出 YAML | T4.1-T4.3 |
| GAP-E5-S5-B09-2 | AC-B09-*（CLI） | 无 analytics-rule-suggest.ts | 新增 `scripts/analytics-rule-suggest.ts`：加载 records + clusters，调用 generateRuleSuggestions | T4.4 |
| GAP-E5-S5-B09-3 | AC-B09-*（单测） | 无 rule-suggestion 单测 | 新增 `scoring/analytics/__tests__/rule-suggestion.test.ts`，4 个用例 | T4.5 |

### 2.5 集成与 E2E 测试

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S5-INT-1 | plan §5.2 | 无 artifactDocPath 集成断言 | 在 `scoring/orchestrator/__tests__/parse-and-write.test.ts` 中补充：传入 artifactDocPath 时 written record 含 source_path | T5.1 |
| GAP-E5-S5-E2E-1 | plan §5.3 | 无 analytics CLI 验收 | 三个 CLI 可执行且输出格式正确 | T5.2 |
| GAP-E5-S5-REG-1 | plan §5 | 全量回归 | `npm run test:scoring` 通过 | T5.3 |

---

## 3. 依赖关系与实施顺序

1. Phase 1（schema）→ Phase 2（B07）→ Phase 3（B08）→ Phase 4（B09）→ Phase 5（测试）。
2. B07 依赖 Phase 1 的 source_path 写入；B08/B09 依赖 clusterWeaknesses（Story 5.4 已实现）。
3. 集成测试 T5.1 依赖 T1.3 完成；CLI 验收 T5.2 依赖 T2.5、T3.3、T4.4 完成。

---

## 4. 风险与缓解

| 风险 | 触发条件 | 缓解动作 | 落位任务 |
| ------ | ---------- | ---------- | ---------- |
| BUGFIX 文档格式多样 | §1/§4 标题变体 | 正则按 spec §3.1.3 实现；缺 §1/§4 时跳过 | T2.3 |
| 非 git 环境 | 无 .git 或 git 不可用 | gitDiffBetween 失败时跳过 + warn | T2.4 |
| evidence_total 为 0 | item_id 在 records 中未出现 | 按 spec 跳过该 item | T4.2 |

---

## 5. Gap 到任务映射总表

| Gap ID | Task IDs | 验收命令 |
| -------- | ---------- | ---------- |
| GAP-E5-S5-B07-1~4 | T1.1-T1.4 | parse-and-write 集成测试 + schema 校验 |
| GAP-E5-S5-B07-5~8 | T2.1-T2.6 | `npm run test:scoring -- sft-extractor.test.ts`；`npx ts-node scripts/analytics-sft-extract.ts ...` |
| GAP-E5-S5-B08-1~3 | T3.1-T3.4 | `npm run test:scoring -- prompt-optimizer.test.ts`；analytics-prompt-optimize CLI |
| GAP-E5-S5-B09-1~3 | T4.1-T4.5 | `npm run test:scoring -- rule-suggestion.test.ts`；analytics-rule-suggest CLI |
| GAP-E5-S5-INT-1 | T5.1 | `npm run test:scoring -- parse-and-write.test.ts` |
| GAP-E5-S5-E2E-1 | T5.2 | 三个 CLI 手动/自动化验收 |
| GAP-E5-S5-REG-1 | T5.3 | `npm run test:scoring` |

---

<!-- AUDIT: PASSED by code-reviewer -->

