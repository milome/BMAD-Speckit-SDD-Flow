# Story 5.5：eval-analytics-advanced

Status: ready-for-dev

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.5  
**Slug**：eval-analytics-advanced  
**包含 GAP**：B07（SFT 提取）、B08（Prompt 优化建议）、B09（规则自优化建议）  
**前置依赖**：Story 5.4（B06 聚类结果作为 B08/B09 输入）

<!-- Note: 可执行 validate-create-story 进行质量检查后再进入 dev-story。 -->

## Story

As a 模型优化反馈闭环系统，  
I want 从 C/D 级审计记录中提取 SFT 数据集、生成 Prompt 优化建议、生成规则升级建议，  
so that 审计数据能反向驱动模型能力和管控规则的持续优化。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **B07 SFT 微调数据集提取**：
   - `sft-extractor.ts`：`extractSftDataset`、`gitDiffBetween`（抽象便于 mock）
   - 从 phase_score≤60 的记录提取；source_path 关联 BUGFIX 文档 §1/§4 作为 instruction；git diff 拆分 bad/good 代码对
   - RunScoreRecord 新增 `source_path`；ParseAndWriteScoreOptions 新增 `artifactDocPath`

2. **B08 Prompt 模板优化建议**：
   - `prompt-optimizer.ts`：`generatePromptSuggestions(clusters, skillsDir)` → `PromptSuggestion[]`
   - 匹配 skills/ 和 .cursor/rules/ 下 .md 文件（cluster.keywords 与文件内容交集≥2）；priority 按 frequency 分级（≥5→high，≥3→medium，其他→low）
   - 输出 `scoring/data/prompt-optimization-suggestions.md`

3. **B09 规则自优化建议**：
   - `rule-suggestion.ts`：`generateRuleSuggestions(clusters, rulesDir)` → `RuleSuggestion[]`
   - 失败率>50% 且 deduct<8→increase_deduct；失败率>80%→promote_to_veto；关键词不匹配现有 item_id→add_new_item
   - 输出 `scoring/data/rule-upgrade-suggestions.yaml`，不直接修改规则文件

### 1.2 本 Story 不包含

| 功能 | 负责 Story | 说明 |
|------|-----------|------|
| 能力短板聚类 | Story 5.4 | B06 为本 Story 前置 |
| 自动修改规则文件 | 无 | B09 仅输出建议 YAML，不自动应用 |

---

## 2. Acceptance Criteria（验收标准）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-B07-1 | scores.jsonl 中存在 phase_score≤60 的 C/D 级记录时，`extractSftDataset` 从 source_path 关联 BUGFIX 文档提取 §1、§4 作为 instruction | 单测：sft-extractor.test.ts 用例 3 |
| AC-B07-2 | 通过 git diff 提取 bad/good 代码对（`-` 行→input，`+` 行→output） | 单测：sft-extractor.test.ts 用例 4 |
| AC-B07-3 | 输出 JSONL 格式正确；source_path 不存在或 git diff 失败时跳过该记录并 warn（不抛异常） | 单测：sft-extractor.test.ts 用例 5、6、7 |
| AC-B07-4 | A/B 级记录被过滤 | 单测：sft-extractor.test.ts 用例 2 |
| AC-B08-1 | WeaknessCluster 聚类结果调用 `generatePromptSuggestions(clusters)`；匹配 skills/ 和 .cursor/rules/ 下 .md 文件（keywords 交集≥2） | 单测：prompt-optimizer.test.ts 用例 1 |
| AC-B08-2 | priority 按 frequency 分级：≥5→high，≥3→medium，其他→low | 单测：prompt-optimizer.test.ts 用例 2、3 |
| AC-B08-3 | 空 cluster → 空建议列表；输出 Markdown 格式正确 | 单测：prompt-optimizer.test.ts 用例 3、4 |
| AC-B09-1 | 失败率>50% 且 deduct<8 → 建议 `increase_deduct`（suggested_deduct = current + 2） | 单测：rule-suggestion.test.ts 用例 1 |
| AC-B09-2 | 失败率>80% → 建议 `promote_to_veto` | 单测：rule-suggestion.test.ts 用例 2 |
| AC-B09-3 | 关键词不匹配现有 item_id → 建议 `add_new_item`；输出 YAML 格式正确 | 单测：rule-suggestion.test.ts 用例 3、4 |
| AC-B09-4 | 不直接修改规则文件 | 代码审查 |
| AC-B07-schema | RunScoreRecord 新增 `source_path`；parseAndWriteScore 支持 `artifactDocPath` 参数 | 单测或集成测试 |

---

## 3. Tasks / Subtasks

### Task 1：B07 前置 schema 与参数（AC: AC-B07-schema）

- [ ] 1.1 修改 `scoring/writer/types.ts`：`RunScoreRecord` 新增 `source_path?: string`，JSDoc：触发本次评分的源文档路径（如 BUGFIX 文档）
- [ ] 1.2 修改 `scoring/schema/run-score-schema.json`：新增 `source_path` 属性
- [ ] 1.3 修改 `scoring/orchestrator/parse-and-write.ts`：`ParseAndWriteScoreOptions` 新增 `artifactDocPath?: string`；写入 record 时附加 `source_path: options.artifactDocPath`

### Task 2：B07 SFT 提取核心（AC: AC-B07-1 至 AC-B07-4）

- [ ] 2.1 新增 `scoring/analytics/sft-extractor.ts`：定义 `SftEntry` 接口（instruction、input、output、source_run_id、base_commit_hash）
- [ ] 2.2 实现 `gitDiffBetween(hash1, hash2, cwd?): string`（抽象便于 mock）
- [ ] 2.3 实现 `extractSftDataset(dataPath?, outputPath?): Promise<SftEntry[]>`：读取 scoring/data/*.json 中 phase_score≤60 记录；验证 base_commit_hash 短 hash 唯一性（`git rev-parse --verify`）；从 source_path 读取 BUGFIX §1+§4 作为 instruction；gitDiffBetween 拆分 bad/good；写入 JSONL
- [ ] 2.4 异常处理：source_path 不存在、base_commit_hash 不存在、git diff 失败 → 跳过 + console.warn
- [ ] 2.5 新增 `scripts/analytics-sft-extract.ts`：`npx ts-node scripts/analytics-sft-extract.ts --dataPath scoring/data --output scoring/data/sft-dataset.jsonl`
- [ ] 2.6 新增 `scoring/analytics/__tests__/sft-extractor.test.ts`：7 个测试用例

### Task 3：B08 Prompt 优化建议（AC: AC-B08-1 至 AC-B08-3）

- [ ] 3.1 新增 `scoring/analytics/prompt-optimizer.ts`：定义 `PromptSuggestion` 接口（target_file、section、suggestion、evidence、priority）
- [ ] 3.2 实现 `generatePromptSuggestions(clusters, skillsDir?): PromptSuggestion[]`；遍历 skills/ 和 .cursor/rules/ 下 .md 文件；cluster.keywords 与文件内容交集≥2 则匹配；priority：frequency≥5→high，≥3→medium，其他→low
- [ ] 3.3 输出 `scoring/data/prompt-optimization-suggestions.md`
- [ ] 3.4 新增 `scripts/analytics-prompt-optimize.ts` CLI
- [ ] 3.5 新增 `scoring/analytics/__tests__/prompt-optimizer.test.ts`：4 个测试用例

### Task 4：B09 规则自优化建议（AC: AC-B09-1 至 AC-B09-4）

- [ ] 4.1 新增 `scoring/analytics/rule-suggestion.ts`：定义 `RuleSuggestion` 接口（item_id、current_deduct、suggested_deduct、action、reason、evidence_count、evidence_total）
- [ ] 4.2 实现 `generateRuleSuggestions(clusters, rulesDir?): RuleSuggestion[]`；用 js-yaml 解析 rulesDir 下 *-scoring.yaml 获取 deduct；失败率>50% 且 deduct<8→increase_deduct；失败率>80%→promote_to_veto；关键词不匹配→add_new_item
- [ ] 4.3 输出 `scoring/data/rule-upgrade-suggestions.yaml`，不修改规则文件
- [ ] 4.4 新增 `scripts/analytics-rule-suggest.ts` CLI
- [ ] 4.5 新增 `scoring/analytics/__tests__/rule-suggestion.test.ts`：4 个测试用例

### Task 5：scripts/parse-and-write-score 支持 artifactDocPath

- [ ] 5.1 修改 `scripts/parse-and-write-score.ts`：新增 `--artifactDocPath` CLI 参数，传入 parseAndWriteScore

---

## 4. Dev Notes

### 4.1 技术约束

- **B07**：`artifactDocPath` 与 B02 的 `sourceHashFilePath` 语义不同；base_commit_hash 保持短 hash；SFT 提取时用 `getGitHeadHashFull` 执行 git diff；短 hash 需通过 `git rev-parse --verify` 验证唯一性
- **B08/B09**：均依赖 Story 5.4 的 clusterWeaknesses 输出；B08 面向 Skill 开发者，B09 面向 scoring 管理员
- **独立性**：分析模块独立于评分流水线，失败不影响 scoring pipeline

### 4.2 实现参考

| 项目 | 路径 |
|------|------|
| 需求与实现方案 | `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1 §GAP-B07、§GAP-B08、§GAP-B09 |
| Epic/Story 定义 | `_bmad-output/planning-artifacts/dev/epics.md` §3 Story 5.5 |
| B06 聚类结果 | `scoring/analytics/cluster-weaknesses.ts`（Story 5.4 产出） |
| getGitHeadHashFull | `scoring/utils/hash.ts` |

### 4.3 新增文件一览（9 个）

| 类型 | 路径 |
|------|------|
| 实现 | `scoring/analytics/sft-extractor.ts` |
| 实现 | `scoring/analytics/prompt-optimizer.ts` |
| 实现 | `scoring/analytics/rule-suggestion.ts` |
| 测试 | `scoring/analytics/__tests__/sft-extractor.test.ts` |
| 测试 | `scoring/analytics/__tests__/prompt-optimizer.test.ts` |
| 测试 | `scoring/analytics/__tests__/rule-suggestion.test.ts` |
| CLI | `scripts/analytics-sft-extract.ts` |
| CLI | `scripts/analytics-prompt-optimize.ts` |
| CLI | `scripts/analytics-rule-suggest.ts` |

### 4.4 修改文件一览（4 个）

| 文件 | 变更 |
|------|------|
| `scoring/writer/types.ts` | source_path 新增 |
| `scoring/schema/run-score-schema.json` | source_path 属性 |
| `scoring/orchestrator/parse-and-write.ts` | artifactDocPath 参数、source_path 写入 |
| `scripts/parse-and-write-score.ts` | --artifactDocPath 参数 |

### 4.5 测试用例总数

- B07：7 个
- B08：4 个
- B09：4 个  
**合计**：15 个

---

## 5. References

- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B07] SFT 提取实现方案（SftEntry、gitDiffBetween、extractSftDataset 函数签名、7 个测试用例、artifactDocPath 与 sourceHashFilePath 命名区分）
- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B08] Prompt 优化实现方案（PromptSuggestion、generatePromptSuggestions、4 个测试用例）
- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B09] 规则自优化实现方案（RuleSuggestion、generateRuleSuggestions、js-yaml 解析、4 个测试用例）
- [Source: _bmad-output/planning-artifacts/dev/epics.md#Story-5.5] Epic 5 Story 5.5 完整定义

---

## 6. Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
