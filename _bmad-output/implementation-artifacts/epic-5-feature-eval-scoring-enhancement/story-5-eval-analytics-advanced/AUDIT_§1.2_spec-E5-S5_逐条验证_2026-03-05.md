# Spec E5-S5 审计报告：逐条对照原始需求验证

**审计对象**：`specs/epic-5/story-5-eval-analytics-advanced/spec-E5-S5.md`  
**原始需求文档**：
- `_bmad-output/implementation-artifacts/5-5-eval-analytics-advanced/5-5-eval-analytics-advanced.md`（Story 5.5）
- `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1（GAP-B07、GAP-B08、GAP-B09）

**审计日期**：2026-03-05  
**审计员**：code-reviewer（严苛模式）

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit |

---

## 1. Story 5.5 文档逐章节对照

| Story 5.5 章节 | 内容摘要 | spec 对应 | 验证结果 |
|----------------|----------|-----------|----------|
| §0 Party-Mode 决议 | SFT 格式、git diff 策略、source_path 命名、B08 priority、B08 匹配范围、B09 不修改规则 | §3.1, §3.2, §3.3 | ✅ 覆盖 |
| §1 Story | As a / I want / so that 用户故事 | §1 概述 | ✅ 覆盖 |
| §2.1 范围 | B07/B08/B09 三大块 | §2.1, §3 | ✅ 覆盖 |
| §2.2 不在范围 | B06 由 5.4 负责；不自动修改规则 | §2.2 | ✅ 覆盖 |
| §3 AC | AC-B07-1~4、AC-B07-schema、AC-B08-1~3、AC-B09-1~4 | §4 | ✅ 覆盖 |
| §4 Tasks 1-5 | schema、sft-extractor、prompt-optimizer、rule-suggestion、parse-and-write-score | §2.3, §3 | ✅ 覆盖 |
| §5 Dev Notes | 技术约束、架构合规、库要求、参考路径 | 部分隐含于 §3 | ⚠️ 未显式列出 Dev Notes（可接受，spec 偏功能规格） |
| §6 Previous Story | clusterWeaknesses、WeaknessCluster | §3.2, §3.3 引用 WeaknessCluster | ✅ 覆盖 |
| §7 Project Structure | 目录、CLI 命名 | §2.3 | ✅ 覆盖 |
| §8 References | TASKS_gaps、epics | §5 需求追溯 | ✅ 覆盖 |

---

## 2. TASKS_gaps GAP-B07 逐条验证

| TASKS_gaps 条目 | spec 对应 | 验证结果 |
|-----------------|-----------|----------|
| SftEntry：instruction、input、output、source_run_id、base_commit_hash | §3.1.1 | ✅ |
| gitDiffBetween(hash1, hash2, cwd?) 抽象便于 mock | §3.1.2 | ✅ |
| getGitHeadHashFull / 40 位 hash 执行 diff | §3.1.2 | ✅ |
| 短 hash 需 `git rev-parse --verify` 验证唯一性 | §3.1.2, §3.1.3 | ✅ |
| artifactDocPath 与 sourceHashFilePath 命名区分 | §3.4 | ✅ |
| extractSftDataset(dataPath?, outputPath?) | §3.1.3 | ✅ |
| 读取 phase_score≤60 记录（C/D 级） | §3.1.3 | ✅ |
| 数据源：scoring/data/*.json | §3.1.3 | ✅ |
| 数据源：scores.jsonl | §3.1.3「及 scores.jsonl」 | ✅（与 AUDIT_§5 建议一致，统一数据源） |
| 从 source_path 读取 BUGFIX §1+§4 作为 instruction | §3.1.3 | ✅ |
| git diff 中 `-` 行→input，`+` 行→output | §3.1.3 | ✅ |
| 异常：source_path 不存在、base_commit_hash 无法验证、git diff 失败 → 跳过 + warn | §3.1.4 | ✅ |
| 7 个测试用例 | §4 AC 映射 | ✅ |

**⚠️ spec 存在模糊表述**：
- **§3.1.3**：未定义 BUGFIX 文档 §1、§4 的**提取方式**（如：按 `## §1`、`## §4` 标题正则匹配，或按行号区间；多级标题变体是否支持）。原始需求也未明确，建议 clarify 补充解析算法（正则模式或解析规则）。

---

## 3. TASKS_gaps GAP-B08 逐条验证

| TASKS_gaps 条目 | spec 对应 | 验证结果 |
|-----------------|-----------|----------|
| PromptSuggestion：target_file、section、suggestion、evidence、priority | §3.2.1 | ✅ |
| generatePromptSuggestions(clusters, skillsDir?) | §3.2.2 | ✅ |
| 遍历 skills/ 和 .cursor/rules/ 下 .md | §3.2.2 | ✅ |
| cluster.keywords 与文件内容交集（忽略大小写）≥2 则匹配 | §3.2.2 | ✅ |
| priority：frequency≥5→high，≥3→medium，其他→low | §3.2.2 | ✅ |
| 输出 scoring/data/prompt-optimization-suggestions.md | §3.2.2 | ✅ |
| 4 个测试用例 | §4 AC 映射 | ✅ |

**⚠️ spec 存在模糊表述**：
- **§3.2.1 / §3.2.2**：`PromptSuggestion.section` 字段（「建议修改的章节」）**如何填充**未定义。匹配算法仅得到 target_file，未指定 section 的取值规则（如：固定为 "全文"、从文件结构推导、或占位空字符串）。建议 clarify 补充。

---

## 4. TASKS_gaps GAP-B09 逐条验证

| TASKS_gaps 条目 | spec 对应 | 验证结果 |
|-----------------|-----------|----------|
| RuleSuggestion：item_id、current_deduct、suggested_deduct、action、reason、evidence_count、evidence_total | §3.3.1 | ✅ |
| generateRuleSuggestions(clusters, rulesDir?) | §3.3.2 | ✅ |
| 使用 js-yaml 解析 rulesDir 下 *-scoring.yaml | §3.3.2 | ✅ |
| 失败率>50% 且 deduct<8 → increase_deduct（suggested_deduct = current+2） | §3.3.2 | ✅ |
| 失败率>80% → promote_to_veto | §3.3.2 | ✅ |
| 关键词不匹配现有 item_id → add_new_item | §3.3.2 | ✅ |
| 仅输出 rule-upgrade-suggestions.yaml，不修改规则文件 | §3.3.2 | ✅ |
| 4 个测试用例 | §4 AC 映射 | ✅ |

**⚠️ spec 存在模糊表述**：
- **§3.3.2**：**失败率**的计算方式与数据来源未定义。
  - `RuleSuggestion` 含 `evidence_count`、`evidence_total`，但 `WeaknessCluster` 仅有 `frequency`（失败次数），无 `evidence_total`（总审计次数）。
  - 失败率 = evidence_count / evidence_total，而 `generateRuleSuggestions(clusters, rulesDir)` 仅接收 clusters 与 rulesDir，无法从 clusters 推导 evidence_total。
  - 需 clarify：失败率是否需额外传入 `RunScoreRecord[]` 或等价数据？或 cluster 结构需扩展？或 evidence_total 从 rules/scoring 元数据推算？

---

## 5. 验收标准（AC）映射完整性

| AC ID | Story 5.5 定义 | spec 映射 | 验证方式 | 验证结果 |
|-------|----------------|-----------|----------|----------|
| AC-B07-1 | phase_score≤60 时从 source_path 关联 BUGFIX §1、§4 作为 instruction | §3.1.3 | sft-extractor.test.ts 用例 3 | ✅ |
| AC-B07-2 | git diff `-` 行→input，`+` 行→output | §3.1.2, §3.1.3 | 用例 4 | ✅ |
| AC-B07-3 | JSONL 正确；source_path 不存在或 git diff 失败时跳过 + warn | §3.1.4 | 用例 5、6、7 | ✅ |
| AC-B07-4 | A/B 级记录被过滤 | §3.1.3 | 用例 2 | ✅ |
| AC-B07-schema | RunScoreRecord 新增 source_path；parseAndWriteScore 支持 artifactDocPath | §3.4 | 单测/集成测试 | ✅ |
| AC-B08-1 | clusters 匹配 skills/ 和 .cursor/rules/；keywords 交集≥2 | §3.2.2 | prompt-optimizer.test.ts 用例 1 | ✅ |
| AC-B08-2 | priority：frequency≥5→high，≥3→medium，其他→low | §3.2.2 | 用例 2、3 | ✅ |
| AC-B08-3 | 空 cluster→空建议；Markdown 格式正确 | §3.2.2 | 用例 3、4 | ✅ |
| AC-B09-1 | 失败率>50% 且 deduct<8 → increase_deduct | §3.3.2 | rule-suggestion.test.ts 用例 1 | ✅ |
| AC-B09-2 | 失败率>80% → promote_to_veto | §3.3.2 | 用例 2 | ✅ |
| AC-B09-3 | 关键词不匹配 → add_new_item；YAML 正确 | §3.3.2 | 用例 3、4 | ✅ |
| AC-B09-4 | 不直接修改规则文件 | §3.3.2 | 代码审查 | ✅ |

**结论**：12 项 AC 均在 spec 中有明确映射与验证方式。

---

## 6. 文件与 CLI 完整性

| 类型 | Story 5.5 / TASKS 要求 | spec §2.3 | 验证结果 |
|------|------------------------|-----------|----------|
| 修改 | types.ts、run-score-schema.json、parse-and-write.ts、parse-and-write-score.ts | ✓ | ✅ |
| 新增实现 | sft-extractor.ts、prompt-optimizer.ts、rule-suggestion.ts | ✓ | ✅ |
| 新增 CLI | analytics-sft-extract.ts、analytics-prompt-optimize.ts、analytics-rule-suggest.ts | ✓ | ✅ |
| 新增测试 | sft-extractor.test.ts、prompt-optimizer.test.ts、rule-suggestion.test.ts | ✓ | ✅ |

**说明**：spec 未枚举各 CLI 的 `--dataPath`、`--output` 等参数，Story 5.5 Task 2.5 有 `--dataPath scoring/data --output scoring/data/sft-dataset.jsonl` 示例。实施时可参考 Story/TASKS，非阻塞。

---

## 7. 模糊表述汇总（触发 clarify 流程）

| 序号 | 位置 | 问题描述 | 建议 clarify 内容 |
|------|------|----------|-------------------|
| 1 | §3.1.3 | BUGFIX §1、§4 提取方式未定义 | 补充解析规则：按 `## §1`、`## §4` 标题正则匹配，或指定 Markdown 解析库与章节选取逻辑 |
| 2 | §3.2.1 / §3.2.2 | `PromptSuggestion.section` 如何填充未定义 | 明确 section 取值规则：固定值、从文件结构推导、或占位规则 |
| 3 | §3.3.2 | 失败率计算公式与 evidence_total 数据来源未定义 | 明确：失败率 = ? / ?；evidence_total 来自 RunScoreRecord 汇总、cluster 扩展、或其它；若需额外入参，需更新函数签名 |

---

## 8. 结论

**是否完全覆盖、验证通过**：**否**

**原因**：spec 在功能范围与 AC 映射上已覆盖 Story 5.5 与 TASKS_gaps GAP-B07/B08/B09 的主要条目，但存在 **3 处需 clarify 的模糊表述**（见 §7）。

**建议流程**：
1. 按 §7 对 3 处模糊表述执行 **clarify 澄清流程**，补充解析规则、section 填充规则、失败率计算与数据来源。
2. clarify 完成后更新 spec，并复核本审计报告中对应项。
3. 全部 clarify 通过后，可判定为「完全覆盖、验证通过」。

---

*审计完成。*
