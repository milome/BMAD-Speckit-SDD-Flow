# Tasks: eval-analytics-advanced (E5-S5)

**Input**：`spec-E5-S5.md`、`plan-E5-S5.md`、`IMPLEMENTATION_GAPS-E5-S5.md`  
**Scope**：B07（SFT 提取）、B08（Prompt 优化建议）、B09（规则自优化建议）  
**执行方式**：按 T1 → T2 → T3 → T4 → T5 顺序推进

---

## 1. 需求追溯与任务映射

| 任务组 | 来源需求 | AC | Gap |
| -------- | ---------- | ---- | ----- |
| T1 | B07 schema 与参数 | AC-B07-schema | GAP-E5-S5-B07-1~4 |
| T2 | B07 SFT 提取核心 | AC-B07-1~4 | GAP-E5-S5-B07-5~8 |
| T3 | B08 Prompt 优化建议 | AC-B08-1~3 | GAP-E5-S5-B08-1~3 |
| T4 | B09 规则自优化建议 | AC-B09-1~4 | GAP-E5-S5-B09-1~3 |
| T5 | 集成与回归测试 | plan §5 | GAP-E5-S5-INT-1, E2E-1, REG-1 |

---

## 2. Phase 1：B07 前置 schema 与参数（T1）

**AC**：AC-B07-schema  
**集成验证**：T5.1（parse-and-write 集成测试）

- [x] **T1.1** 修改 `scoring/writer/types.ts`：`RunScoreRecord` 新增 `source_path?: string`，JSDoc：触发本次评分的源文档路径（如 BUGFIX 文档）
- [x] **T1.2** 修改 `scoring/schema/run-score-schema.json`：properties 新增 `source_path` 属性
- [x] **T1.3** 修改 `scoring/orchestrator/parse-and-write.ts`：`ParseAndWriteScoreOptions` 新增 `artifactDocPath?: string`；写入 record 时附加 `source_path: options.artifactDocPath`
- [x] **T1.4** 修改 `scripts/parse-and-write-score.ts`：新增 `--artifactDocPath` CLI 参数，传入 parseAndWriteScore

---

## 3. Phase 2：B07 SFT 提取核心（T2）

**AC**：AC-B07-1、AC-B07-2、AC-B07-3、AC-B07-4  
**集成验证**：T5.2（CLI 验收）

- [x] **T2.1** 新增 `scoring/analytics/sft-extractor.ts`：定义 `SftEntry` 接口（instruction、input、output、source_run_id、base_commit_hash）
- [x] **T2.2** 实现 `gitDiffBetween(hash1, hash2, cwd?): string`；短 hash 需 `git rev-parse --verify` 验证唯一性；diff 使用 `getGitHeadHashFull` 获取 40 位 HEAD
- [x] **T2.3** 实现 `extractSftDataset(dataPath?, outputPath?): Promise<SftEntry[]>`：读取 dataPath 下 *.json 与 scores.jsonl；过滤 phase_score≤60；从 source_path 读取 BUGFIX 并按 spec §3.1.3 正则提取 §1+§4（若无 §1 或 §4 则 instruction 为空并跳过该记录）；验证 base_commit_hash 后调用 gitDiffBetween；`-` 行→input，`+` 行→output；写入 JSONL
- [x] **T2.4** 异常处理：source_path 不存在、base_commit_hash 无法验证、git diff 失败 → 跳过该记录 + console.warn
- [x] **T2.5** 新增 `scripts/analytics-sft-extract.ts`：`--dataPath`（默认 scoring/data）、`--output`（默认 scoring/data/sft-dataset.jsonl）
- [x] **T2.6** 新增 `scoring/analytics/__tests__/sft-extractor.test.ts`：7 个用例（C/D 提取、A/B 过滤、§1/§4 解析、diff 拆分、JSONL、source_path 缺失、git 不可用）

---

## 4. Phase 3：B08 Prompt 优化建议（T3）

**AC**：AC-B08-1、AC-B08-2、AC-B08-3  
**集成验证**：T5.2（CLI 验收）

- [x] **T3.1** 新增 `scoring/analytics/prompt-optimizer.ts`：定义 `PromptSuggestion` 接口（target_file、section、suggestion、evidence、priority）
- [x] **T3.2** 实现 `generatePromptSuggestions(clusters, skillsDir?): PromptSuggestion[]`；遍历 skills/ 和 .cursor/rules/ 下 .md；cluster.keywords 与文件内容交集≥2 则匹配；section 默认为 "全文"；priority：frequency≥5→high，≥3→medium，其他→low；输出 scoring/data/prompt-optimization-suggestions.md
- [x] **T3.3** 新增 `scripts/analytics-prompt-optimize.ts` CLI：加载 dataPath 下 records、调用 clusterWeaknesses 或从 cluster 输出文件加载 clusters、调用 generatePromptSuggestions、写入 MD
- [x] **T3.4** 新增 `scoring/analytics/__tests__/prompt-optimizer.test.ts`：4 个用例（high/low priority、空 cluster、Markdown 格式）

---

## 5. Phase 4：B09 规则自优化建议（T4）

**AC**：AC-B09-1、AC-B09-2、AC-B09-3、AC-B09-4  
**集成验证**：T5.2（CLI 验收）

- [x] **T4.1** 新增 `scoring/analytics/rule-suggestion.ts`：定义 `RuleSuggestion` 接口（item_id、current_deduct、suggested_deduct、action、reason、evidence_count、evidence_total）
- [x] **T4.2** 实现 `generateRuleSuggestions(clusters, records, rulesDir?): RuleSuggestion[]`；用 js-yaml 解析 rulesDir 下 *-scoring.yaml；evidence_count=cluster.frequency，evidence_total 从 records 统计；evidence_total===0 跳过；失败率>50% 且 deduct<8→increase_deduct；>80%→promote_to_veto；关键词不匹配→add_new_item；输出 scoring/data/rule-upgrade-suggestions.yaml
- [x] **T4.3** 不直接修改规则文件（仅输出 YAML 建议）
- [x] **T4.4** 新增 `scripts/analytics-rule-suggest.ts` CLI：加载 records、clusters，调用 generateRuleSuggestions
- [x] **T4.5** 新增 `scoring/analytics/__tests__/rule-suggestion.test.ts`：4 个用例（increase_deduct、promote_to_veto、add_new_item、YAML 格式）

---

## 6. Phase 5：测试与回归（T5）

**AC**：覆盖 plan §5 全部测试计划

- [x] **T5.1** 在 `scoring/orchestrator/__tests__/parse-and-write.test.ts` 中补充：传入 artifactDocPath 时 written record 包含 source_path
- [x] **T5.2** CLI 验收：`npx ts-node scripts/analytics-sft-extract.ts --dataPath scoring/data --output scoring/data/sft-dataset.jsonl`、`npx ts-node scripts/analytics-prompt-optimize.ts --dataPath scoring/data`、`npx ts-node scripts/analytics-rule-suggest.ts --dataPath scoring/data` 可执行且输出格式正确
- [x] **T5.3** 执行 `npm run test:scoring` 全量回归

---

## 7. 验收命令汇总

| 命令 | 覆盖 |
| ------ | ------ |
| `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts` | T1, T5.1 |
| `npm run test:scoring -- scoring/analytics/__tests__/sft-extractor.test.ts` | T2, T2.6 |
| `npm run test:scoring -- scoring/analytics/__tests__/prompt-optimizer.test.ts` | T3, T3.4 |
| `npm run test:scoring -- scoring/analytics/__tests__/rule-suggestion.test.ts` | T4, T4.5 |
| `npx ts-node scripts/analytics-sft-extract.ts --dataPath scoring/data --output scoring/data/sft-dataset.jsonl` | T2.5 |
| `npx ts-node scripts/analytics-prompt-optimize.ts --dataPath scoring/data` | T3.3 |
| `npx ts-node scripts/analytics-rule-suggest.ts --dataPath scoring/data` | T4.4 |
| `npm run test:scoring` | T5.3, 全量回归 |

---

## 8. Gaps → 任务映射（按 IMPLEMENTATION_GAPS）

| Gap ID | 本任务表行 | 对应任务 |
| -------- | ---------- | ---------- |
| GAP-E5-S5-B07-1 | ✓ 有 | T1.1 |
| GAP-E5-S5-B07-2 | ✓ 有 | T1.2 |
| GAP-E5-S5-B07-3 | ✓ 有 | T1.3 |
| GAP-E5-S5-B07-4 | ✓ 有 | T1.4 |
| GAP-E5-S5-B07-5 | ✓ 有 | T2.1-T2.3 |
| GAP-E5-S5-B07-6 | ✓ 有 | T2.4 |
| GAP-E5-S5-B07-7 | ✓ 有 | T2.5 |
| GAP-E5-S5-B07-8 | ✓ 有 | T2.6 |
| GAP-E5-S5-B08-1 | ✓ 有 | T3.1-T3.2 |
| GAP-E5-S5-B08-2 | ✓ 有 | T3.3 |
| GAP-E5-S5-B08-3 | ✓ 有 | T3.4 |
| GAP-E5-S5-B09-1 | ✓ 有 | T4.1-T4.3 |
| GAP-E5-S5-B09-2 | ✓ 有 | T4.4 |
| GAP-E5-S5-B09-3 | ✓ 有 | T4.5 |
| GAP-E5-S5-INT-1 | ✓ 有 | T5.1 |
| GAP-E5-S5-E2E-1 | ✓ 有 | T5.2 |
| GAP-E5-S5-REG-1 | ✓ 有 | T5.3 |

---

## 9. 完成判定标准

- T1~T5 全部任务完成并勾选。
- AC-B07-1~4、AC-B07-schema、AC-B08-1~3、AC-B09-1~4 均有可追溯任务与测试结果。
- 不新增「可选/后续/待定/酌情」等模糊描述。
- 每个模块的验收须包含该模块在生产代码关键路径（三个 analytics CLI）中被导入并调用的集成验证。

---

<!-- AUDIT: PASSED by code-reviewer -->

