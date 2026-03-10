# §4.2 tasks-E5-S5 审计报告：逐条验证与 spec/plan/GAPS 对齐

**审计日期**：2026-03-05  
**审计对象**：`specs/epic-5/story-5-eval-analytics-advanced/tasks-E5-S5.md`  
**参考文档**：spec-E5-S5.md、plan-E5-S5.md、IMPLEMENTATION_GAPS-E5-S5.md、Story 5.5  

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. spec → tasks 逐条对照

### 1.1 spec §2.1 In Scope

| spec 条目 | 要求 | tasks 对应 | 验证结果 |
|-----------|------|------------|----------|
| B07 SFT 数据集提取 | sft-extractor.ts：extractSftDataset、gitDiffBetween；phase_score≤60；source_path 关联 BUGFIX §1+§4；git diff 拆分 bad/good | T2.1–T2.4、T2.6 | ✅ 已覆盖 |
| B07 schema 扩展 | RunScoreRecord source_path；ParseAndWriteScoreOptions artifactDocPath | T1.1–T1.4 | ✅ 已覆盖 |
| B08 Prompt 优化建议 | prompt-optimizer.ts；generatePromptSuggestions(clusters, skillsDir)；skills/、.cursor/rules/；keywords≥2；priority 分级 | T3.1–T3.4 | ✅ 已覆盖 |
| B09 规则自优化建议 | rule-suggestion.ts；generateRuleSuggestions(clusters, records, rulesDir)；records 统计 evidence_total；仅输出 YAML | T4.1–T4.5 | ✅ 已覆盖 |

### 1.2 spec §3 功能规格逐条

| spec 章节 | 要求 | tasks 对应 | 验证方式 | 结果 |
|-----------|------|------------|----------|------|
| §3.1.1 SftEntry | instruction、input、output、source_run_id、base_commit_hash | T2.1 | 对照 T2.1 字段列表 | ✅ |
| §3.1.2 gitDiffBetween | hash1, hash2, cwd?；getGitHeadHashFull 40 位；短 hash rev-parse --verify | T2.2 | 对照 T2.2 描述 | ✅ |
| §3.1.3 extractSftDataset | *.json + scores.jsonl；phase_score≤60；§1+§4 正则；base_commit_hash 验证；-→input +→output | T2.3 | 对照 T2.3 | ✅ |
| §3.1.3 若无 §1/§4 | instruction 为空字符串并跳过该记录 | T2.3 | T2.3 写「按 spec §3.1.3」隐含 | ⚠️ 建议在 T2.3 显式补充「若无 §1 或 §4 则 instruction 为空并跳过」 |
| §3.1.4 异常处理 | source_path 不存在、base_commit_hash 无法验证、git diff 失败 → 跳过 + warn | T2.4 | 对照 T2.4 | ✅ |
| §3.2.1 PromptSuggestion | target_file、section、suggestion、evidence、priority | T3.1 | 对照 T3.1 | ✅ |
| §3.2.2 generatePromptSuggestions | skills/、.cursor/rules/；交集≥2；section=全文；priority 分级；输出 MD | T3.2 | 对照 T3.2 | ✅ |
| §3.3.1 RuleSuggestion | item_id、current_deduct、suggested_deduct、action、reason、evidence_count、evidence_total | T4.1 | 对照 T4.1 | ✅ |
| §3.3.2 generateRuleSuggestions | records 统计 evidence_total；evidence_total===0 跳过；increase_deduct、promote_to_veto、add_new_item | T4.2 | 对照 T4.2 | ✅ |
| §3.4 B07 schema | RunScoreRecord source_path；ParseAndWriteScoreOptions artifactDocPath；写入 record 时附加 | T1.1–T1.3 | 对照 T1 | ✅ |

### 1.3 spec §4 AC 映射

| AC ID | spec 对应 | tasks 覆盖 | 验证结果 |
|-------|-----------|------------|----------|
| AC-B07-1 | §3.1.3 | T2.3、T2.6 用例 3 | ✅ |
| AC-B07-2 | §3.1.2、§3.1.3 | T2.2、T2.3、T2.6 用例 4 | ✅ |
| AC-B07-3 | §3.1.4 | T2.4、T2.6 用例 5、6、7 | ✅ |
| AC-B07-4 | §3.1.3 | T2.6 用例 2 | ✅ |
| AC-B07-schema | §3.4 | T1、T5.1 | ✅ |
| AC-B08-1 | §3.2.2 | T3.1–T3.2、T3.4 用例 1 | ✅ |
| AC-B08-2 | §3.2.2 | T3.2、T3.4 用例 2、3 | ✅ |
| AC-B08-3 | §3.2.2 | T3.4 用例 3、4 | ✅ |
| AC-B09-1 | §3.3.2 | T4.2、T4.5 用例 1 | ✅ |
| AC-B09-2 | §3.3.2 | T4.2、T4.5 用例 2 | ✅ |
| AC-B09-3 | §3.3.2 | T4.2、T4.5 用例 3、4 | ✅ |
| AC-B09-4 | §3.3.2 | T4.3、代码审查 | ✅ |

---

## 2. plan → tasks 逐条对照

### 2.1 plan Phase 1–5

| plan Phase | 要求 | tasks 对应 | 验证结果 |
|------------|------|------------|----------|
| Phase 1 | types source_path；schema source_path；parse-and-write artifactDocPath；parse-and-write-score --artifactDocPath | T1.1–T1.4 | ✅ |
| Phase 2 | sft-extractor.ts；gitDiffBetween；extractSftDataset；analytics-sft-extract.ts | T2.1–T2.5 | ✅ |
| Phase 2 单测 | 7 用例（C/D、A/B、§1/§4、diff、JSONL、缺失、git 不可用） | T2.6 | ✅ |
| Phase 3 | prompt-optimizer.ts；generatePromptSuggestions；analytics-prompt-optimize.ts | T3.1–T3.3 | ✅ |
| Phase 3 单测 | 4 用例（high/low priority、空 cluster、Markdown） | T3.4 | ✅ |
| Phase 4 | rule-suggestion.ts；generateRuleSuggestions；analytics-rule-suggest.ts | T4.1–T4.4 | ✅ |
| Phase 4 单测 | 4 用例（increase_deduct、promote_to_veto、add_new_item、YAML） | T4.5 | ✅ |
| Phase 5 | parse-and-write 集成（artifactDocPath→source_path）；3 CLI 可执行；npm run test:scoring | T5.1–T5.3 | ✅ |

### 2.2 plan §4.3 生产代码关键路径

| 关键路径 | plan 要求 | tasks 对应 | 验证结果 |
|----------|-----------|------------|----------|
| SFT CLI | analytics-sft-extract → extractSftDataset | T2.5、T5.2 | ✅ |
| Prompt CLI | analytics-prompt-optimize → generatePromptSuggestions | T3.3、T5.2 | ✅ |
| Rule CLI | analytics-rule-suggest → generateRuleSuggestions | T4.4、T5.2 | ✅ |
| 集成验证 | ① 三个 CLI 可执行 ② 输出格式正确 ③ 异常不抛仅 warn | T5.2 | ✅ |

### 2.3 plan §7 执行准入标准

| 要求 | tasks 覆盖 | 验证结果 |
|------|------------|----------|
| 至少 15 个单测 | T2.6 共 7 + T3.4 共 4 + T4.5 共 4 = 15 | ✅ |
| 3 个 CLI 可执行验收 | T5.2 | ✅ |
| parseAndWriteScore artifactDocPath 集成验证 | T5.1 | ✅ |
| npm run test:scoring | T5.3 | ✅ |

---

## 3. IMPLEMENTATION_GAPS → tasks 逐条对照

### 3.1 GAP 映射表验证

| Gap ID | GAPS 目标状态 | tasks 对应 | 验证 |
|--------|---------------|------------|------|
| GAP-E5-S5-B07-1 | RunScoreRecord source_path | T1.1 | ✅ |
| GAP-E5-S5-B07-2 | schema source_path | T1.2 | ✅ |
| GAP-E5-S5-B07-3 | parse-and-write artifactDocPath、source_path 写入 | T1.3 | ✅ |
| GAP-E5-S5-B07-4 | parse-and-write-score --artifactDocPath | T1.4 | ✅ |
| GAP-E5-S5-B07-5 | sft-extractor.ts 完整实现 | T2.1–T2.4 | ✅ |
| GAP-E5-S5-B07-6 | 异常处理 skip + warn | T2.4 | ✅ |
| GAP-E5-S5-B07-7 | analytics-sft-extract.ts | T2.5 | ✅ |
| GAP-E5-S5-B07-8 | sft-extractor 单测 7 用例 | T2.6 | ✅ |
| GAP-E5-S5-B08-1 | prompt-optimizer.ts 完整实现 | T3.1–T3.2 | ✅ |
| GAP-E5-S5-B08-2 | analytics-prompt-optimize.ts | T3.3 | ✅ |
| GAP-E5-S5-B08-3 | prompt-optimizer 单测 4 用例 | T3.4 | ✅ |
| GAP-E5-S5-B09-1 | rule-suggestion.ts 完整实现 | T4.1–T4.3 | ✅ |
| GAP-E5-S5-B09-2 | analytics-rule-suggest.ts | T4.4 | ✅ |
| GAP-E5-S5-B09-3 | rule-suggestion 单测 4 用例 | T4.5 | ✅ |
| GAP-E5-S5-INT-1 | parse-and-write 集成 artifactDocPath | T5.1 | ✅ |
| GAP-E5-S5-E2E-1 | 3 CLI 可执行且输出正确 | T5.2 | ✅ |
| GAP-E5-S5-REG-1 | npm run test:scoring | T5.3 | ✅ |

**结论**：所有 17 个 Gap 均有明确 task 对应。

---

## 4. 专项审计

### 4.1 集成测试与端到端测试（严禁仅单元测试）

| Phase | 单元测试 | 集成测试 | 端到端 | 验证结果 |
|-------|----------|----------|--------|----------|
| Phase 1 (T1) | 无单独单测 | T5.1：parse-and-write 传入 artifactDocPath 时 record 含 source_path | 通过 parse-and-write 集成测间接覆盖 | ✅ 有集成 |
| Phase 2 (T2) | T2.6 共 7 用例 | 无独立集成测 | T5.2 SFT CLI 验收 | ✅ 有单测+E2E |
| Phase 3 (T3) | T3.4 共 4 用例 | 无独立集成测 | T5.2 Prompt CLI 验收 | ✅ 有单测+E2E |
| Phase 4 (T4) | T4.5 共 4 用例 | 无独立集成测 | T5.2 Rule CLI 验收 | ✅ 有单测+E2E |
| Phase 5 (T5) | - | T5.1 | T5.2、T5.3 | ✅ |

**评估**：  
- Phase 1 由 T5.1 提供**集成测试**（parse-and-write 与 schema 联动）。  
- Phase 2–4 均有单元测试，且由 T5.2 **CLI 验收**覆盖「CLI 导入并调用模块→输出文件」的端到端路径，满足「严禁仅有单元测试」要求。  
- **建议**：若需更明确，可在 tasks 中写明「T5.2 视为 B07/B08/B09 的端到端功能测试」，或在未来补充自动化 CLI 测试（vitest 调用 CLI 并校验输出）。

### 4.2 验收标准是否包含「生产代码关键路径导入、实例化、调用」集成验证

| Phase | 验收标准 | 关键路径验证 | 验证结果 |
|-------|----------|--------------|----------|
| T1 | AC-B07-schema；集成验证：T5.1 | parse-and-write 被 parse-and-write-score 调用；T5.1 验证 artifactDocPath→source_path | ✅ |
| T2 | AC-B07-1~4；集成验证：T5.2 | analytics-sft-extract 导入 extractSftDataset；T5.2 运行 CLI 验证 | ✅ |
| T3 | AC-B08-1~3；集成验证：T5.2 | analytics-prompt-optimize 导入 generatePromptSuggestions；T5.2 运行 CLI | ✅ |
| T4 | AC-B09-1~4；集成验证：T5.2 | analytics-rule-suggest 导入 generateRuleSuggestions；T5.2 运行 CLI | ✅ |
| T5 | plan §5 | T5.1 集成、T5.2 CLI、T5.3 回归 | ✅ |

**结论**：每个 Phase 的「集成验证」均指向 T5.1 或 T5.2，且 T5.2 明确要求三个 analytics CLI 可执行并输出正确，满足「该模块在生产代码关键路径中被导入、实例化并调用」的验收要求。

### 4.3 孤岛模块排查

| 模块 | 生产代码调用链 | 验证方式 | 结论 |
|------|----------------|----------|------|
| sft-extractor.ts | scripts/analytics-sft-extract.ts → extractSftDataset | T5.2 CLI 验收 | ✅ 非孤岛 |
| prompt-optimizer.ts | scripts/analytics-prompt-optimize.ts → generatePromptSuggestions | T5.2 CLI 验收 | ✅ 非孤岛 |
| rule-suggestion.ts | scripts/analytics-rule-suggest.ts → generateRuleSuggestions | T5.2 CLI 验收 | ✅ 非孤岛 |
| parse-and-write（artifactDocPath） | scripts/parse-and-write-score.ts → parseAndWriteScore | T5.1 集成测 | ✅ 非孤岛 |

**结论**：无孤岛模块。各模块均有对应 CLI 或脚本作为生产入口，且由 T5.1/T5.2 覆盖。

---

## 5. speckit-workflow §4.2 跨 artifact 一致性分析

### 5.1 spec ↔ plan ↔ tasks 对齐矩阵

| 需求维度 | spec | plan | tasks | 一致性 |
|----------|------|------|-------|--------|
| B07 SftEntry 字段 | §3.1.1 五字段 | Phase 2 SftEntry | T2.1 五字段 | ✅ |
| B07 数据源 | §3.1.3 *.json + scores.jsonl | Phase 2 同 | T2.3 同 | ✅ |
| B07 §1/§4 正则 | §3.1.3 详细正则 | §4.1 引用 spec | T2.3 引用 spec §3.1.3 | ✅ |
| B08 generatePromptSuggestions | (clusters, skillsDir?) | (clusters, skillsDir?) | T3.2 同 | ✅ |
| B09 generateRuleSuggestions | (clusters, records, rulesDir?) | (clusters, records, rulesDir?) | T4.2 同 | ✅ |
| B09 records 用途 | evidence_total 从 records 统计 | 同 | T4.2 同 | ✅ |
| 单测数量 | 7+4+4=15 | plan §5.1 同 | T2.6+T3.4+T4.5 | ✅ |
| 集成测试 | spec §4 单测或集成 | plan §5.2 parse-and-write | T5.1 | ✅ |
| CLI 验收 | - | plan §5.3 三个 CLI | T5.2 | ✅ |

### 5.2 发现的细微差异（非阻塞）

| 位置 | 差异 | 影响 | 建议 |
|------|------|------|------|
| spec §3.1.3 | 若无 §1 或 §4 则 instruction 为空并跳过 | T2.3 未显式写出 | 低 | 在 T2.3 补充一句 |
| T3.2 | 「输出 scoring/data/prompt-optimization-suggestions.md」 | 函数返回数组，由 CLI 写文件 | 无 | 可保持现状，由 T3.3 承接写文件 |
| Story 5.5 Task 4.2 | generateRuleSuggestions(clusters, rulesDir?) 缺 records | spec/plan/tasks 均为 (clusters, records, rulesDir?) | 无 | Story 文档可后续修正，以 spec 为准 |

### 5.3 验收命令与覆盖

| 验收命令 | 覆盖任务 | 验证 |
|----------|----------|------|
| npm run test:scoring -- parse-and-write.test.ts | T1、T5.1 | ✅ |
| npm run test:scoring -- sft-extractor.test.ts | T2、T2.6 | ✅ |
| npm run test:scoring -- prompt-optimizer.test.ts | T3、T3.4 | ✅ |
| npm run test:scoring -- rule-suggestion.test.ts | T4、T4.5 | ✅ |
| npx ts-node scripts/analytics-sft-extract.ts ... | T2.5 | ✅ |
| npx ts-node scripts/analytics-prompt-optimize.ts ... | T3.3 | ✅ |
| npx ts-node scripts/analytics-rule-suggest.ts ... | T4.4 | ✅ |
| npm run test:scoring | T5.3 | ✅ |

**注意**：parse-and-write.test.ts 当前（审计时）尚**无** artifactDocPath/source_path 相关用例，T5.1 要求「补充」该用例，实施时需新增。

---

## 6. 逐项验证执行记录

### 6.1 文件存在性验证（实施前基线）

| 路径 | 预期状态 | 当前状态 |
|------|----------|----------|
| scoring/writer/types.ts | 待修改 | 存在，无 source_path |
| scoring/schema/run-score-schema.json | 待修改 | 存在 |
| scoring/orchestrator/parse-and-write.ts | 待修改 | 存在 |
| scripts/parse-and-write-score.ts | 待修改 | 存在 |
| scoring/analytics/sft-extractor.ts | 待新增 | 不存在 |
| scoring/analytics/prompt-optimizer.ts | 待新增 | 不存在 |
| scoring/analytics/rule-suggestion.ts | 待新增 | 不存在 |
| scripts/analytics-sft-extract.ts | 待新增 | 不存在 |
| scripts/analytics-prompt-optimize.ts | 待新增 | 不存在 |
| scripts/analytics-rule-suggest.ts | 待新增 | 不存在 |
| scoring/analytics/__tests__/sft-extractor.test.ts | 待新增 | 不存在 |
| scoring/analytics/__tests__/prompt-optimizer.test.ts | 待新增 | 不存在 |
| scoring/analytics/__tests__/rule-suggestion.test.ts | 待新增 | 不存在 |

（与 IMPLEMENTATION_GAPS §1 快照一致）

### 6.2 依赖与接口验证

| 依赖 | 来源 | 用途 |
|------|------|------|
| WeaknessCluster | scoring/analytics/cluster-weaknesses.ts | B08、B09 输入 |
| getGitHeadHashFull | scoring/utils/hash.ts | B07 gitDiffBetween |
| RunScoreRecord | scoring/writer/types.ts | B07、B09 |
| js-yaml | 已安装 | B09 解析 *-scoring.yaml |

均已在 plan/tasks 中隐含或显式引用。

---

## 7. 结论

### 7.1 覆盖情况

| 维度 | 结果 |
|------|------|
| spec 全部章节 | ✅ 已覆盖 |
| plan 全部 Phase 与测试计划 | ✅ 已覆盖 |
| IMPLEMENTATION_GAPS 全部 17 个 Gap | ✅ 已覆盖 |
| 集成测试与 E2E 任务 | ✅ 满足（T5.1 集成、T5.2 CLI） |
| 关键路径集成验证 | ✅ 满足（§9 与各 Phase 集成验证） |
| 孤岛模块 | ✅ 无 |

### 7.2 建议补充（非必须）

1. **T2.3**：显式补充「若无 §1 或 §4 则 instruction 为空字符串并跳过该记录」，与 spec §3.1.3 完全对齐。  
2. **T5.2**：若需更强可重复性，可增加自动化 CLI 测试（vitest 调用 CLI 并断言输出文件存在与格式）。当前为手动验收，可接受。  
3. **Story 5.5 Task 4.2**：将 `generateRuleSuggestions(clusters, rulesDir?)` 修正为 `generateRuleSuggestions(clusters, records, rulesDir?)`，与 spec/plan 一致。

### 7.3 最终结论

**完全覆盖、验证通过**

tasks-E5-S5.md 已完整覆盖 spec-E5-S5.md、plan-E5-S5.md、IMPLEMENTATION_GAPS-E5-S5.md 的全部需求与 Gap；每个 Phase 均包含单元测试与集成/端到端验证，且各模块在生产关键路径中的集成验证已在 T5.1、T5.2 中明确；未发现孤岛模块。建议补充项为可选优化，不阻碍通过审计。
