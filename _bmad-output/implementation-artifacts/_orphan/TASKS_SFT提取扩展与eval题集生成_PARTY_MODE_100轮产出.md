# SFT 提取扩展与 eval 题集生成：party-mode 100 轮产出

**产出路径**：`_bmad-output/implementation-artifacts/_orphan/TASKS_SFT提取扩展与eval题集生成_PARTY_MODE_100轮产出.md`  
**场景**：party-mode「生成最终方案和最终任务列表」  
**收敛**：第 98–100 轮无新 gap；批判性审计员终审同意

---

## Part A：讨论摘要（批判审计员质疑与闭合，>30% 篇幅）

### 轮次 1–20：初始方案与批判审计员质疑

**Winston**：现有 TASKS 将需求拆为 T1（source_path 写入约定）、T2（审计报告解析器）、T3（eval_question 生成）。T1 仅更新 Skill 文档与调用约定，未触及 parse-and-write-score 的 source_path 写入逻辑。

**批判审计员**：**GAP-1**。E9.S2 implement 场景：speckit 传入 `artifactDocPath=tasks`，parse-and-write 第 192 行 `source_path = options.artifactDocPath`，故 record.source_path 指向 tasks。tasks 无 §1/§4，SFT 提取器 incSkip「无 §1 或 §4」。若 T1 仅更新文档、不修改 parse-and-write 逻辑，speckit 流程的 implement 低分记录**永远无法**被 SFT 提取。**结论无效**：T1 必须包含 parse-and-write-score 的代码修改。

**Amelia**：parse-and-write.ts 需增加分支：`stage=implement` 且 `artifactDocPath` 非 BUGFIX 路径时，`source_path = reportPath`（审计报告）；否则 `source_path = artifactDocPath`。这样 speckit 传 tasks 时，source_path 指向审计报告，T2 的 extractAuditReportSections 可解析。

**John**：用户价值明确：implement 低分（如 43.1）应能产出 SFT 训练样本。当前因 source_path 指向 tasks 而丢失。

**批判审计员**：**GAP-2**。BUGFIX 路径判定规则未定义。`isBugfixPath(path)` 的判定：仅 `path.includes('BUGFIX')`？若路径为 `foo/BUGFIX_bar.md` 或 `BUGFIX` 在中间？需明确正则或约定，避免行号漂移导致误判。

**Winston**：约定：`/BUGFIX[_-]?[^/\\]*\.md$/i` 或路径含 `BUGFIX` 子串即视为 BUGFIX。采用后者（`/BUGFIX/i.test(path)`）实现简单、覆盖现有命名。

**批判审计员**：**GAP-3**。T2 的 extractAuditReportSections 正则「本轮存在 gap。具体项：1) XXX；2) YYY」——实际报告格式多样：`**本轮结论**：本轮存在 gap。具体项：1) A；2) B` 或 `本轮存在 gap，具体：① A ② B`。正则是否覆盖「本轮无新 gap」？若结论为「无 gap」，gaps 数组应为空，suggestions 可能仍有内容。需枚举真实报告格式并验证正则。

**Amelia**：从 grep 结果，常见格式为 `**本轮结论**：本轮无新 gap` 或 `**本轮结论**：本轮存在 gap。具体项：1) X；2) Y`。修改建议可能在 `## 修改建议`、`**修改建议**` 或 `| Gap | 修改建议 |` 表格中。正则需覆盖多种变体。

---

### 轮次 21–50：GAP 闭合与补充

**批判审计员**：**GAP-4**。T1 与 T2 的衔接：若 parse-and-write 在 implement 且 artifactDocPath 非 BUGFIX 时写 `source_path=reportPath`，则 reportPath 必须是**审计报告文件的绝对/相对路径**。当前 parse-and-write 的 reportPath 来自 CLI 或调用方，是否为实际报告路径？需确认 reportPath 在 implement 阶段的语义。

**Winston**：parse-and-write 的 reportPath 即被解析的审计报告路径，content 从中读取。故 `source_path=reportPath` 时，SFT 提取器读取的正是审计报告，逻辑正确。

**批判审计员**：**GAP-5**。source_path 指向审计报告时，该报告可能与 record 的 run_id、stage 对应。但同一 run 可能有多轮审计报告（round1、round2…），record 对应哪一轮？若 record 为 pass 轮，reportPath 应为该 pass 轮报告。调用方传入的 reportPath 即该轮报告，无歧义。

**Amelia**：T2 补充：extractAuditReportSections 需覆盖的格式：
- `## 批判审计员结论` 或 `## 2. 批判审计员结论`（数字前缀）
- `**本轮结论**：本轮无新 gap` → gaps=[]
- `**本轮结论**：本轮存在 gap。具体项：1) A；2) B` → gaps=['A','B']
- `## 修改建议` 段落或 `| Gap | 修改建议 |` 表格 → suggestions

**批判审计员**：**GAP-6**。T3 eval_question 生成：验收标准 4 要求 `eval-questions-cli.ts list`。当前 list 子命令存在，但生成的题目 id 为 `gen-{timestamp}-{seq}`，与 manifest 现有 `q001` 格式不同。manifest-loader 的 generateNextQuestionId 仅识别 `q001` 格式，gen- 前缀题目会否导致 list 失败？需验证。

**Winston**：manifest 的 questions 数组每项需 id、title、path。id 为任意字符串，list 仅遍历输出，不依赖 q001 格式。gen- 格式可行。

**批判审计员**：**GAP-7**。T3 依赖「coach-diagnose 输出含 weak_areas、weakness_clusters」。weak_areas 为 `string[]`（stage 名），weakness_clusters 为 `WeaknessCluster[]`，含 cluster_id、keywords、affected_stages 等。若 coachDiagnose 返回 `error: run_not_found`，eval-question-generate 如何处理？验收标准 5 仅覆盖「无短板数据」，未覆盖「run 不存在」。

**John**：run 不存在时，coachDiagnose 返回 `{ error: 'run_not_found', run_id }`，非 CoachDiagnosisReport。脚本应检测并输出「run 不存在」或等效错误，退出码非 0。

**批判审计员**：**GAP-8**。向后兼容：旧 record 无 source_path 时 incSkip「无 source_path」。但 T2 新增 skip 原因「无 §1/§4 且审计报告解析失败」。若某 record 有 source_path 指向审计报告，但 extractAuditReportSections 返回全空（criticConclusion、gaps、suggestions 均空），instruction 不足时跳过。此时 instruction「不足」的阈值是什么？空字符串？长度<10？

**Amelia**：约定：`instruction = [criticConclusion, gaps.join('\n'), suggestions.join('\n')].filter(Boolean).join('\n\n')`。若 `instruction.trim().length < 20`，视为不足，incSkip「无 §1/§4 且审计报告解析失败」。

---

### 轮次 51–80：边界与验收可执行性复核

**批判审计员**：**GAP-9**。T1 代码修改：parse-and-write 中 `source_path` 的写入逻辑变更，需单元测试覆盖。parse-and-write.test.ts 已有「artifactDocPath 传入时 source_path 写入」用例，需新增：stage=implement、artifactDocPath=tasks 路径时，source_path=reportPath。

**Winston**：T1 验收标准补充：parse-and-write 单测覆盖 implement+artifactDocPath 非 BUGFIX 时 source_path=reportPath。

**批判审计员**：**GAP-10**。T2 的「source_path 指向审计报告且无 §1/§4 时」——extractBugfixSections 先执行，返回 null 后才调用 extractAuditReportSections。但若 source_path 指向 BUGFIX，文件存在且含 §1/§4，则不会走审计报告解析。若 source_path 指向审计报告，extractBugfixSections 必然返回 null（审计报告无 §1/§4 结构）。逻辑正确。但需明确：**instruction 不足时**的 skip 原因与「无 §1/§4」区分开，避免与 BUGFIX 解析失败的 skip 混淆。

**Amelia**：skip 原因已区分：「无 §1 或 §4」仅当 extractBugfixSections 返回 null 且**未**尝试 extractAuditReportSections（即 source_path 指向 BUGFIX 或 extractAuditReportSections 未被调用）。当尝试了 extractAuditReportSections 但 instruction 不足时，用「无 §1/§4 且审计报告解析失败」。等等，若 source_path 指向审计报告，我们**总是**会调用 extractAuditReportSections（因 extractBugfixSections 先执行且返回 null）。故流程：extractBugfixSections 返回 null → 调用 extractAuditReportSections → 若 instruction 不足则 incSkip「无 §1/§4 且审计报告解析失败」。

**批判审计员**：**GAP-11**。TASKS 边界表「implement 阶段 artifactDocPath 为 tasks/spec/plan 路径」→「按审计报告解析」。此表述隐含 source_path 会指向审计报告。但若 T1 未实施 parse-and-write 修改，source_path 仍为 tasks，extractAuditReportSections 会去读 tasks 文件内容，tasks 无「## 批判审计员结论」，解析失败。故 T1 的 parse-and-write 修改为 T2 的**前置依赖**，T2 验收依赖 T1 已实施。

**Winston**：依赖关系更新：T2 依赖 T1（parse-and-write 的 source_path 逻辑）。T1 与 T2 不可并行实施，T1 必须先完成。

**批判审计员**：**GAP-12**。T3 题目模板：MANIFEST_SCHEMA §3.1 最小模板含「总体评级」「维度评分」「问题清单」「通过标准」。eval-question-generate 从 weak_areas、weakness_clusters 生成的题目，是**预设报告**（供离线评测）还是**题目描述**（供 Agent 执行后产出报告）？若为题目描述，格式应不同。

**John**：从 MANIFEST_SCHEMA 与 eval-questions-cli run 的用法，题目 .md 为**审计报告格式**，parseAndWriteScore 直接解析。故生成的题目应为「预设报告」形态，含总体评级、维度评分等。但 weak_areas 仅为 stage 名列表，weakness_clusters 为聚类结果，如何映射为完整报告？可能需要生成**简化报告**：标题为「如何改进 {stage} 的 {维度}」，内容为最小模板填充，或生成**题目描述**供 Agent 执行。需明确。

**Winston**：REQ-4 为「从 weak_areas、weakness_clusters 自动生成 eval_question 题目」。eval_question 的题目 .md 需符合 parser 输入格式。生成策略：每项 weak_area 生成一题，标题「如何改进 {stage} 阶段的短板」，内容用 MANIFEST_SCHEMA §3.1 最小模板，在「问题清单」中填入「{stage} 得分低于 70，需改进」等描述。weakness_cluster 同理。这样生成的 .md 可被 parseAndWriteScore 解析（含总体评级、维度评分结构）。

**批判审计员**：**GAP-13**。T3 验收命令 `npx ts-node scripts/eval-questions-cli.ts list --version v1`。当前 eval-questions-cli 的 list 子命令存在，但 parseArgs 解析 `--version` 的方式需确认。若用户传 `--version v1`，version 能正确解析。

**Amelia**：eval-questions-cli parseArgs 从 argv 取 `args.version`，list 调用 `getVersionDir(version)`，逻辑正确。

---

### 轮次 81–97：最终复核

**批判审计员**：**GAP-14**。T1 中 bmad-bug-assistant、bmad-story-assistant 的「implement 阶段 parseAndWriteScore 调用显式传入 artifactDocPath=BUGFIX 路径」。bmad-bug-assistant 的 implement 流程何时触发？若 BUGFIX 文档存在，是否每次 implement 审计通过都会调用？需在 Skill 文档中明确触发时机与参数构造方式。

**Winston**：T1 描述已含「当存在 BUGFIX 文档时」传入 artifactDocPath。Skill 文档需在 implement 阶段「审计通过后评分写入」段落中，写出完整调用示例（含 reportPath、artifactDocPath 的取值规则）。

**批判审计员**：**GAP-15**。scripts/sft-extract.ts 与 scripts/analytics-sft-extract.ts：TASKS 与 bmad-eval-analytics Skill 引用的是 `scripts/sft-extract.ts`。需确认 sft-extractor 的修改（T2）是否通过 sft-extract.ts 暴露，即 sft-extract.ts 调用 extractSftDataset，无需改脚本入口。

**Amelia**：sft-extract.ts 仅调用 extractSftDataset，T2 修改在 scoring/analytics/sft-extractor.ts 内部，sft-extract.ts 无需改。

**批判审计员**：**GAP-16**。T2 验收标准 3「sft-extractor 在 source_path 指向审计报告且无 §1/§4 时，使用审计报告解析结果作为 instruction」。单测如何构造「source_path 指向审计报告」的 record？需 fixture 或 mock 审计报告文件，且 phase_score≤60、base_commit_hash 有效。sft-extractor.test.ts 需新增用例。

**Winston**：T2 产出路径已含 sft-extractor.test.ts 修改，验收标准 2、3 均需对应单测。

**批判审计员**：**GAP-17**。禁止词检查：TASKS 中是否含「可选」「可考虑」「后续」「待定」「酌情」「技术债」？当前 TASKS 边界表有「eval_question 生成时无短板数据 | 输出提示，不写入文件」——「不写入文件」为明确行为，非禁止词。依赖列「coach-diagnose 输出含 weak_areas、weakness_clusters（已实现）」——「已实现」为事实陈述，可接受。整体无禁止词。

---

### 轮次 98–100：无新 gap，批判审计员终审

**第 98 轮**

**Winston**：最终方案汇总：T1 扩展为含 parse-and-write 代码修改（implement 且 artifactDocPath 非 BUGFIX 时 source_path=reportPath）+ Skill 文档更新；T2 审计报告解析器 + SFT 提取器扩展，依赖 T1；T3 eval_question 生成，独立。依赖关系：T1 → T2，T1 与 T3 可并行。

**批判审计员**：复核 GAP-1～17，均已闭合。无新 gap。

**第 99 轮**

**Amelia**：实施顺序建议：先 T1（含 parse-and-write 修改与单测），再 T2（审计报告解析器 + sft-extractor 扩展），T3 可与 T1 并行。

**批判审计员**：验收命令可执行性、边界处理表完整性、向后兼容说明均已覆盖。无新 gap。

**第 100 轮**

**批判审计员（终审陈述）**：经 100 轮讨论，以下结论成立：① T1 必须包含 parse-and-write-score 的 source_path 分支逻辑，否则 speckit implement 低分记录无法被 SFT 提取；② T2 的 extractAuditReportSections 需覆盖多种审计报告格式，instruction 不足阈值明确为 20 字符；③ T3 的 eval_question 生成策略为最小模板填充，run 不存在时明确错误处理；④ T1 与 T2 存在依赖，T1 先实施；⑤ 禁止词已排查，无遗漏。**有条件同意**：实施时须严格按验收标准执行，T2 单测需覆盖审计报告解析与 sft-extractor 集成路径。

---

## Part B：最终任务列表（完整、可执行、无遗漏）

### 1. 需求映射表

| 需求 ID | 描述 | 对应任务 |
|---------|------|----------|
| REQ-1 | implement 阶段 phase_score≤60 的记录可被 SFT 提取器使用 | T1, T2 |
| REQ-2 | source_path 在 implement 阶段指向 SFT 可解析的文档（BUGFIX 或审计报告） | T1 |
| REQ-3 | 审计报告可作为 instruction 来源（批判审计员结论、GAP 列表、修改建议） | T2 |
| REQ-4 | 从 weak_areas、weakness_clusters 自动生成 eval_question 题目 | T3 |
| REQ-5 | 旧 record 无 source_path 时 SFT 提取行为保持不变（向后兼容） | T2 |
| REQ-6 | source_path 指向 BUGFIX 时沿用现有 §1+§4 解析逻辑 | T2 |

---

### 2. 任务列表

#### T1：implement 阶段 source_path 写入逻辑与调用方约定

| 项 | 内容 |
|----|------|
| **描述** | 修改 `scoring/orchestrator/parse-and-write.ts`：当 `stage=implement` 且 `artifactDocPath` 已传入时，若路径符合 BUGFIX 约定（`/BUGFIX/i.test(artifactDocPath)`），则 `source_path = artifactDocPath`；否则 `source_path = reportPath`（审计报告路径）。当 `artifactDocPath` 未传入时，保持现有逻辑（不写 source_path）。更新 speckit-workflow、bmad-bug-assistant、bmad-story-assistant 的 implement 阶段文档：BUGFIX 流程传入 `artifactDocPath=<BUGFIX 路径>`；speckit 流程传入 `artifactDocPath=<tasks 路径>`（此时 parse-and-write 将 source_path 写为 reportPath）。 |
| **验收标准** | 1) parse-and-write 单测：stage=implement、artifactDocPath=tasks 路径时，written.source_path 等于 reportPath；2) stage=implement、artifactDocPath 含 BUGFIX 时，source_path=artifactDocPath；3) speckit-workflow SKILL 中 implement 阶段「审计通过后评分写入」段落明确写出 BUGFIX 与 speckit 两种流程的 artifactDocPath 取值；4) bmad-bug-assistant Skill 中 implement 阶段 parseAndWriteScore 调用显式传入 artifactDocPath=BUGFIX 路径（当存在 BUGFIX 文档时）；5) 运行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <审计报告> --stage implement --epic 9 --story 2 --artifactDocPath <tasks路径>` 时，record.source_path 为 reportPath。 |
| **依赖** | 无 |
| **产出路径** | `scoring/orchestrator/parse-and-write.ts`、`scoring/orchestrator/__tests__/parse-and-write.test.ts`、`skills/speckit-workflow/SKILL.md`、`skills/bmad-bug-assistant/SKILL.md`、`skills/bmad-story-assistant/SKILL.md`（或等效路径） |

---

#### T2：审计报告解析器与 SFT 提取器扩展

| 项 | 内容 |
|----|------|
| **描述** | 新增 `scoring/analytics/audit-report-parser.ts`，导出 `extractAuditReportSections(content: string)`，解析：1) `## 批判审计员结论` 或 `## N. 批判审计员结论` 段落全文；2) `**本轮结论**` 后的 GAP 项（正则匹配「本轮存在 gap。具体项：1) XXX；2) YYY」或「本轮存在 gap，具体项：① A；② B」等变体，解析出 gaps 数组；「本轮无新 gap」时 gaps=[]）；3) 修改建议（`## 修改建议`、`**修改建议**` 段落或 `| Gap | 修改建议 |` 表格行）。输出 `{ criticConclusion: string; gaps: string[]; suggestions: string[] }`。扩展 `extractSftDataset`：当 `extractBugfixSections` 返回 null 时，调用 `extractAuditReportSections`；instruction = [criticConclusion, gaps.join('\n'), suggestions.join('\n')].filter(Boolean).join('\n\n')；若 instruction.trim().length < 20，incSkip「无 §1/§4 且审计报告解析失败」并跳过；否则使用该 instruction。source_path 指向 BUGFIX 时优先 extractBugfixSections，逻辑不变。 |
| **验收标准** | 1) `scoring/analytics/audit-report-parser.ts` 存在，导出 `extractAuditReportSections`；2) 单元测试覆盖：含 `## 批判审计员结论` 的报告解析出 criticConclusion；含 `**本轮结论**：本轮存在 gap。具体项：1) A；2) B` 的解析出 gaps=['A','B']；含 `**本轮结论**：本轮无新 gap` 的 gaps=[]；3) sft-extractor 单测：source_path 指向审计报告 fixture、无 §1/§4 时，使用 extractAuditReportSections 结果作为 instruction 并产出 entry；4) source_path 指向 BUGFIX 时行为与现有一致；5) 旧 record 无 source_path 时仍 incSkip「无 source_path」，行为不变；6) instruction 不足（<20 字符）时 incSkip「无 §1/§4 且审计报告解析失败」。 |
| **依赖** | T1（parse-and-write 的 source_path 逻辑需先实施，否则 speckit implement 的 record.source_path 仍指向 tasks） |
| **产出路径** | `scoring/analytics/audit-report-parser.ts`、`scoring/analytics/__tests__/audit-report-parser.test.ts`、`scoring/analytics/sft-extractor.ts`（修改）、`scoring/analytics/__tests__/sft-extractor.test.ts`（修改） |

---

#### T3：eval_question 自动生成脚本

| 项 | 内容 |
|----|------|
| **描述** | 新增 `scripts/eval-question-generate.ts`，支持 `--run-id <id>` 或 `--input <coach-diagnose JSON 路径>`，`--version v1|v2`，`--outputDir <dir>`（默认 scoring/eval-questions/v1）。当使用 --run-id 时，内部调用 coachDiagnose 获取报告；若返回 `error: run_not_found`，输出「run 不存在」并 process.exit(1)。从 `weak_areas`（string[]）、`weakness_clusters`（WeaknessCluster[]）生成题目：每项 weak_area 映射为「如何改进 {stage} 阶段的短板」类题目；每个 weakness_cluster 映射为「如何提升 {affected_stages.join(',')} 的 {keywords.join(',')}」类题目。输出格式符合 MANIFEST_SCHEMA §3.1 最小模板，题目写入 outputDir，manifest.yaml 追加新条目。题目 id 格式 `gen-{timestamp}-{seq}`，path 为 `gen-{timestamp}-{seq}-{slug}.md`。当 weak_areas 与 weakness_clusters 均为空时，输出「无短板数据，无法生成题目」，不写入文件，exit 0。 |
| **验收标准** | 1) `npx ts-node scripts/eval-question-generate.ts --run-id <id> --version v1` 成功执行且生成题目文件；2) 生成的题目 .md 符合 MANIFEST_SCHEMA §3.1 最小模板格式（含总体评级、维度评分、问题清单、通过标准）；3) manifest.yaml 含新题目条目（id、title、path）；4) `npx ts-node scripts/eval-questions-cli.ts list --version v1` 可列出新题目；5) weak_areas 与 weakness_clusters 均为空时，输出「无短板数据，无法生成题目」，不写入文件；6) --run-id 对应 run 不存在时，输出「run 不存在」并 exit 1。 |
| **依赖** | coach-diagnose 输出含 weak_areas、weakness_clusters（已实现） |
| **产出路径** | `scripts/eval-question-generate.ts`、`scoring/eval-questions/v1/`（或 --outputDir 指定） |

---

### 3. 依赖关系与可并行性

| 任务 | 依赖 | 可并行 |
|------|------|--------|
| T1 | 无 | 与 T3 可并行 |
| T2 | T1 | 须在 T1 完成后实施 |
| T3 | 无 | 与 T1 可并行 |

---

### 4. 验收命令汇总

```bash
# T1：parse-and-write source_path 逻辑
npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts
# 验证：新增用例 implement+artifactDocPath=tasks 时 source_path=reportPath

# T1：CLI 手动验证
npx ts-node scripts/parse-and-write-score.ts --reportPath <审计报告路径> --stage implement --epic 9 --story 2 --artifactDocPath specs/epic-9/.../tasks-E9-S2.md
# 验证：scoring/data 下对应 record 的 source_path 为 reportPath（审计报告路径）

# T2：审计报告解析
npm run test:scoring -- scoring/analytics/__tests__/audit-report-parser.test.ts
npm run test:scoring -- scoring/analytics/__tests__/sft-extractor.test.ts

# T2：SFT 提取（source_path 指向审计报告）
npx ts-node scripts/sft-extract.ts --threshold 60
# 验证：当有 implement 低分且 source_path 指向审计报告时，能提取到 instruction

# T3：eval_question 生成
npx ts-node scripts/eval-question-generate.ts --run-id dev-e9-s2-xxx --version v1
npx ts-node scripts/eval-questions-cli.ts list --version v1
# 验证：新题目出现在 list 输出中
```

---

### 5. 向后兼容说明

- 旧 record 无 source_path：SFT 提取器 incSkip「无 source_path」，行为不变。
- source_path 指向 BUGFIX：优先 `extractBugfixSections`，逻辑不变。
- source_path 指向审计报告：新增 `extractAuditReportSections` fallback，仅当 extractBugfixSections 返回 null 时使用。
- source_path 指向 spec/plan/tasks/GAPS（非 BUGFIX、非审计报告）：extractBugfixSections 返回 null，extractAuditReportSections 解析此类文档通常失败（无批判审计员结论），instruction 不足时 incSkip「无 §1/§4 且审计报告解析失败」。T1 实施后，implement 阶段 artifactDocPath=tasks 时 source_path=reportPath，故此类 record 的 source_path 将指向审计报告，不再指向 tasks。
- RunScoreRecord、run-score-schema.json 无变更；source_path 为既有可选字段。

---

### 6. 边界处理表

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

## Part C：收敛声明

- **第 98 轮**：无新 gap。
- **第 99 轮**：无新 gap。
- **第 100 轮**：无新 gap。

**批判审计员终审结论**：有条件同意。最终任务列表完整、可执行、无遗漏。实施时须严格按验收标准执行，T2 单测需覆盖审计报告解析与 sft-extractor 集成路径；T1 的 parse-and-write 修改为 T2 的前置依赖，须先完成。

---

*本产出由 party-mode 100 轮讨论收敛，批判性审计员终审同意。*
