# TASKS：SFT 提取扩展与 eval 题集生成

**产出路径**：`_bmad-output/implementation-artifacts/_orphan/TASKS_SFT提取扩展与eval题集生成.md`  
**场景**：party-mode「生成最终方案和最终任务列表」  
**收敛**：第 98–100 轮无新 gap；批判性审计员终审同意  
**合并说明**：本文档为 `TASKS_SFT提取扩展与eval题集生成.md` 与 `TASKS_SFT提取扩展与eval题集生成_PARTY_MODE_100轮产出.md` 的合并权威版本，以需求映射、任务列表、GAP 闭合、验收命令、边界处理为单一来源。

---

## 1. 需求映射表

| 需求 ID | 描述 | 对应任务 |
|---------|------|----------|
| REQ-1 | implement 阶段 phase_score≤60 的记录可被 SFT 提取器使用 | T1, T2 |
| REQ-2 | source_path 在 implement 阶段指向 SFT 可解析的文档（BUGFIX 或审计报告） | T1 |
| REQ-3 | 审计报告可作为 instruction 来源（批判审计员结论、GAP 列表、修改建议） | T2 |
| REQ-4 | 从 weak_areas、weakness_clusters 自动生成 eval_question 题目 | T3 |
| REQ-5 | 旧 record 无 source_path 时 SFT 提取行为保持不变（向后兼容） | T2 |
| REQ-6 | source_path 指向 BUGFIX 时沿用现有 §1+§4 解析逻辑 | T2 |

---

## 2. 任务列表

### T1：implement 阶段 source_path 写入逻辑与调用方约定

| 项 | 内容 |
|----|------|
| **描述** | 修改 `scoring/orchestrator/parse-and-write.ts`：当 `stage=implement` 且 `artifactDocPath` 已传入时，若路径符合 BUGFIX 约定（`/BUGFIX/i.test(artifactDocPath)`），则 `source_path = artifactDocPath`；否则 `source_path = reportPath`（审计报告路径）。当 `artifactDocPath` 未传入时，保持现有逻辑（不写 source_path）。更新 speckit-workflow、bmad-bug-assistant、bmad-story-assistant 的 implement 阶段文档：BUGFIX 流程传入 `artifactDocPath=<BUGFIX 路径>`；speckit 流程传入 `artifactDocPath=<tasks 路径>`（此时 parse-and-write 将 source_path 写为 reportPath）。 |
| **验收标准** | 1) parse-and-write 单测：stage=implement、artifactDocPath=tasks 路径时，written.source_path 等于 reportPath；2) stage=implement、artifactDocPath 含 BUGFIX 时，source_path=artifactDocPath；3) speckit-workflow SKILL 中 implement 阶段「审计通过后评分写入」段落明确写出 BUGFIX 与 speckit 两种流程的 artifactDocPath 取值；4) bmad-bug-assistant Skill 中 implement 阶段 parseAndWriteScore 调用显式传入 artifactDocPath=BUGFIX 路径（当存在 BUGFIX 文档时）；5) bmad-story-assistant Skill 中 implement 阶段（或嵌套 speckit 流程）parseAndWriteScore 调用约定与 artifactDocPath 取值与 speckit-workflow 一致；6) 运行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <审计报告> --stage implement --epic 9 --story 2 --artifactDocPath <tasks路径>` 时，record.source_path 为 reportPath；7) 运行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <审计报告> --stage implement --epic 9 --story 2 --artifactDocPath _bmad-output/implementation-artifacts/_orphan/BUGFIX_xxx.md --iteration-count 0` 时，record.source_path 为 BUGFIX 路径。 |
| **依赖** | 无 |
| **产出路径** | `scoring/orchestrator/parse-and-write.ts`、`scoring/orchestrator/__tests__/parse-and-write.test.ts`、`skills/speckit-workflow/SKILL.md`、`skills/bmad-bug-assistant/SKILL.md`、`skills/bmad-story-assistant/SKILL.md`（或等效路径） |

---

### T2：审计报告解析器与 SFT 提取器扩展

| 项 | 内容 |
|----|------|
| **描述** | 新增 `scoring/analytics/audit-report-parser.ts`，导出 `extractAuditReportSections(content: string)`，解析：1) `## 批判审计员结论` 或 `## N. 批判审计员结论` 段落全文；2) `**本轮结论**` 后的 GAP 项（正则匹配「本轮存在 gap。具体项：1) XXX；2) YYY」或「本轮存在 gap，具体项：① A；② B」等变体，解析出 gaps 数组；「本轮无新 gap」时 gaps=[]）；3) 修改建议（`## 修改建议`、`**修改建议**` 段落或 `| Gap | 修改建议 |` 表格行）。输出 `{ criticConclusion: string; gaps: string[]; suggestions: string[] }`。扩展 `extractSftDataset`：当 `extractBugfixSections` 返回 null 时，调用 `extractAuditReportSections`；instruction = [criticConclusion, gaps.join('\n'), suggestions.join('\n')].filter(Boolean).join('\n\n')；若 instruction.trim().length < 20，incSkip「无 §1/§4 且审计报告解析失败」并跳过；否则使用该 instruction。source_path 指向 BUGFIX 时优先 extractBugfixSections，逻辑不变。 |
| **验收标准** | 1) `scoring/analytics/audit-report-parser.ts` 存在，导出 `extractAuditReportSections`；2) 单元测试覆盖：含 `## 批判审计员结论` 的报告解析出 criticConclusion；含 `**本轮结论**：本轮存在 gap。具体项：1) A；2) B` 的解析出 gaps=['A','B']；含 `**本轮结论**：本轮无新 gap` 的 gaps=[]；3) sft-extractor 单测：source_path 指向审计报告 fixture、无 §1/§4 时，使用 extractAuditReportSections 结果作为 instruction 并产出 entry；4) source_path 指向 BUGFIX 时行为与现有一致；5) 旧 record 无 source_path 时仍 incSkip「无 source_path」，行为不变；6) instruction 不足（<20 字符）时 incSkip「无 §1/§4 且审计报告解析失败」。 |
| **依赖** | T1（parse-and-write 的 source_path 逻辑需先实施，否则 speckit implement 的 record.source_path 仍指向 tasks） |
| **产出路径** | `scoring/analytics/audit-report-parser.ts`、`scoring/analytics/__tests__/audit-report-parser.test.ts`、`scoring/analytics/sft-extractor.ts`（修改）、`scoring/analytics/__tests__/sft-extractor.test.ts`（修改） |

---

### T3：eval_question 自动生成脚本

| 项 | 内容 |
|----|------|
| **描述** | 新增 `scripts/eval-question-generate.ts`，支持 `--run-id <id>` 或 `--input <coach-diagnose JSON 路径>`，`--version v1|v2`，`--outputDir <dir>`（默认 scoring/eval-questions/v1）。当使用 --run-id 时，内部调用 coachDiagnose 获取报告；若返回 `error: run_not_found`，输出「run 不存在」并 process.exit(1)。从 `weak_areas`（string[]）、`weakness_clusters`（WeaknessCluster[]）生成题目：每项 weak_area 映射为「如何改进 {stage} 阶段的短板」类题目；每个 weakness_cluster 映射为「如何提升 {affected_stages.join(',')} 的 {keywords.join(',')}」类题目。输出格式符合 MANIFEST_SCHEMA §3.1 最小模板，题目写入 outputDir，manifest.yaml 追加新条目。题目 id 格式 `gen-{timestamp}-{seq}`，path 为 `gen-{timestamp}-{seq}-{slug}.md`。当 weak_areas 与 weakness_clusters 均为空时，输出「无短板数据，无法生成题目」，不写入文件，exit 0。 |
| **验收标准** | 1) `npx ts-node scripts/eval-question-generate.ts --run-id <id> --version v1` 成功执行且生成题目文件；2) 使用 `--input <coach-diagnose JSON 路径>` 指定 coach-diagnose 输出文件时，可成功生成题目文件；3) 生成的题目 .md 符合 MANIFEST_SCHEMA §3.1 最小模板格式（含总体评级、维度评分、问题清单、通过标准）；4) manifest.yaml 含新题目条目（id、title、path）；5) `npx ts-node scripts/eval-questions-cli.ts list --version v1` 可列出新题目；6) weak_areas 与 weakness_clusters 均为空时，输出「无短板数据，无法生成题目」，不写入文件；7) --run-id 对应 run 不存在时，输出「run 不存在」并 exit 1。 |
| **依赖** | coach-diagnose 输出含 weak_areas、weakness_clusters（已实现） |
| **产出路径** | `scripts/eval-question-generate.ts`、`scoring/eval-questions/v1/`（或 --outputDir 指定） |

---

## 3. 依赖关系与可并行性

| 任务 | 依赖 | 可并行 |
|------|------|--------|
| T1 | 无 | 与 T3 可并行 |
| T2 | T1 | 须在 T1 完成后实施 |
| T3 | 无（依赖 coach 现有输出） | 与 T1 可并行 |

T1 与 T2 配合：T1 修改 parse-and-write，使 speckit implement 时 source_path 指向 reportPath（审计报告）；T2 确保 source_path 指向审计报告时 SFT 可提取 instruction。

---

## 4. 验收命令汇总

```bash
# T1：parse-and-write source_path 逻辑（单测）
npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts
# 验证：新增用例 implement+artifactDocPath=tasks 时 source_path=reportPath；implement+artifactDocPath=BUGFIX 时 source_path=artifactDocPath

# T1：CLI 手动验证（artifactDocPath=tasks）
npx ts-node scripts/parse-and-write-score.ts --reportPath <审计报告路径> --stage implement --epic 9 --story 2 --artifactDocPath specs/epic-9/.../tasks-E9-S2.md
# 验证：scoring/data 下对应 record 的 source_path 为 reportPath（审计报告路径）

# T1：CLI 手动验证（artifactDocPath=BUGFIX）
npx ts-node scripts/parse-and-write-score.ts --reportPath <审计报告路径> --stage implement --epic 9 --story 2 --artifactDocPath _bmad-output/implementation-artifacts/_orphan/BUGFIX_xxx.md --iteration-count 0
# 验证：scoring/data 下对应 record 的 source_path 为 BUGFIX 路径

# T2：审计报告解析
npm run test:scoring -- scoring/analytics/__tests__/audit-report-parser.test.ts
npm run test:scoring -- scoring/analytics/__tests__/sft-extractor.test.ts

# T2：SFT 提取（source_path 指向审计报告）
npx ts-node scripts/sft-extract.ts --threshold 60
# 验证：当有 implement 低分且 source_path 指向审计报告时，能提取到 instruction；跳过原因不含「无 §1 或 §4」（当有符合条件的审计报告 record 时）

# T3：eval_question 生成
npx ts-node scripts/eval-question-generate.ts --run-id dev-e9-s2-xxx --version v1
npx ts-node scripts/eval-questions-cli.ts list --version v1
# 验证：新题目出现在 list 输出中
```

---

## 5. 向后兼容说明

- 旧 record 无 source_path：SFT 提取器 incSkip「无 source_path」，行为不变。
- source_path 指向 BUGFIX：优先 `extractBugfixSections`，逻辑不变。
- source_path 指向审计报告：新增 `extractAuditReportSections` fallback，仅当 extractBugfixSections 返回 null 时使用。
- source_path 指向 spec/plan/tasks/GAPS（非 BUGFIX、非审计报告）：extractBugfixSections 返回 null，extractAuditReportSections 解析此类文档通常失败（无批判审计员结论），instruction 不足时 incSkip「无 §1/§4 且审计报告解析失败」。T1 实施后，implement 阶段 artifactDocPath=tasks 时 source_path=reportPath，故此类 record 的 source_path 将指向审计报告，不再指向 tasks。
- RunScoreRecord、run-score-schema.json 无变更；source_path 为既有可选字段。

---

## 6. 边界处理表

| 场景 | 处理 |
|------|------|
| implement 阶段 artifactDocPath 为 BUGFIX 路径 | source_path=artifactDocPath；SFT 按 BUGFIX 解析 §1+§4 |
| implement 阶段 artifactDocPath 为 tasks/spec/plan 路径 | source_path=reportPath（审计报告）；SFT 按审计报告解析 |
| implement 阶段 artifactDocPath 未传入 | 不写 source_path；旧 record 行为保持 |
| source_path 指向审计报告但报告无批判审计员结论 | extractAuditReportSections 返回空/部分空；instruction 不足（<20 字符）时 incSkip「无 §1/§4 且审计报告解析失败」 |
| source_path 指向 BUGFIX 且含 §1+§4 | 优先 extractBugfixSections，行为与现有一致 |
| eval_question 生成时无短板数据 | 输出「无短板数据，无法生成题目」，不写入文件，exit 0 |
| eval_question 生成时 run 不存在 | 输出「run 不存在」，exit 1 |

---

## 7. § 讨论纪要（GAP 闭合摘要）

以下为 party-mode 100 轮讨论中批判审计员主要质疑与闭合过程，便于审计追溯。

| GAP | 质疑要点 | 闭合结论 |
|-----|----------|----------|
| GAP-1 | T1 仅更新文档、不修改 parse-and-write 逻辑，speckit implement 低分记录永远无法被 SFT 提取 | T1 必须包含 parse-and-write 的 source_path 分支逻辑 |
| GAP-2 | BUGFIX 路径判定规则未定义 | 约定 `/BUGFIX/i.test(path)` |
| GAP-3 | extractAuditReportSections 正则是否覆盖多种报告格式 | 覆盖「本轮无新 gap」、多种 GAP 列表格式、修改建议表格 |
| GAP-4 | reportPath 在 implement 阶段的语义 | reportPath 即被解析的审计报告路径，逻辑正确 |
| GAP-5 | 同一 run 多轮审计报告对应关系 | 调用方传入的 reportPath 即该轮报告，无歧义 |
| GAP-6 | gen- 前缀题目与 manifest q001 格式兼容性 | id 为任意字符串，list 仅遍历，gen- 格式可行 |
| GAP-7 | run 不存在时 eval-question-generate 处理 | 输出「run 不存在」，exit 1 |
| GAP-8 | instruction 不足的阈值 | instruction.trim().length < 20 视为不足 |
| GAP-9 | T1 需单元测试覆盖 | 新增 implement+artifactDocPath 非 BUGFIX 时 source_path=reportPath 用例 |
| GAP-10 | instruction 不足 skip 原因与「无 §1/§4」区分 | 用「无 §1/§4 且审计报告解析失败」区分 |
| GAP-11 | T1 与 T2 依赖关系 | T2 依赖 T1，T1 须先实施 |
| GAP-12 | T3 题目为预设报告还是题目描述 | 生成最小模板填充的预设报告形态 |
| GAP-13 | eval-questions-cli list --version 解析 | parseArgs 正确，逻辑成立 |
| GAP-14 | bmad-bug-assistant 触发时机与参数构造 | Skill 文档明确调用示例与 artifactDocPath 取值规则 |
| GAP-15 | sft-extract.ts 是否需改 | 仅 sft-extractor.ts 内部修改，sft-extract.ts 无需改 |
| GAP-16 | T2 单测如何构造 source_path 指向审计报告的 record | 需 fixture 或 mock，sft-extractor.test.ts 新增用例 |
| GAP-17 | 禁止词检查 | 已排查，无「可选」「可考虑」「后续」「待定」「酌情」「技术债」 |

---

## 8. 收敛声明

- **第 98 轮**：无新 gap。
- **第 99 轮**：无新 gap。
- **第 100 轮**：无新 gap。

**批判审计员终审结论**：有条件同意。最终任务列表完整、可执行、无遗漏。实施时须严格按验收标准执行，T2 单测需覆盖审计报告解析与 sft-extractor 集成路径；T1 的 parse-and-write 修改为 T2 的前置依赖，须先完成。T1 验收须同时通过 artifactDocPath=tasks 与 artifactDocPath=BUGFIX 两种 CLI 验证。

---

*本 TASKS 由 party-mode 100 轮讨论收敛产出，批判性审计员终审同意。*
