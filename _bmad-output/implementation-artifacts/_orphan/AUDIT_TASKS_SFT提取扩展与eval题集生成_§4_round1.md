# TASKS 审计报告：SFT 提取扩展与 eval 题集生成（§4 round1）

**审计类型**：audit-prompts §4（tasks 阶段）  
**被审文档**：`TASKS_SFT提取扩展与eval题集生成.md`  
**场景**：standalone 任务列表，无 spec/plan/IMPLEMENTATION_GAPS 前置；审计依据为需求映射表 REQ-1～REQ-6、party-mode 收敛共识、GAP 闭合表、用户原始议题  
**审计日期**：2026-03-07

---

## 1. 逐项审计结果

### 1.1 需求覆盖（REQ-1～REQ-6）

| 需求 ID | 描述 | 对应任务 | 验收映射 | 结论 |
|---------|------|----------|----------|------|
| REQ-1 | implement 阶段 phase_score≤60 的记录可被 SFT 提取器使用 | T1, T2 | T1 修改 source_path 使 implement 低分 record 指向可解析文档；T2 扩展 SFT 提取器支持审计报告 | ✓ |
| REQ-2 | source_path 在 implement 阶段指向 SFT 可解析的文档（BUGFIX 或审计报告） | T1 | T1 验收 1、2、5、6 覆盖 source_path 写入逻辑 | ✓ |
| REQ-3 | 审计报告可作为 instruction 来源（批判审计员结论、GAP 列表、修改建议） | T2 | T2 验收 1、2、3 覆盖 extractAuditReportSections 与 sft-extractor 集成 | ✓ |
| REQ-4 | 从 weak_areas、weakness_clusters 自动生成 eval_question 题目 | T3 | T3 验收 1～6 覆盖生成逻辑、格式、list 验证、边界 | ✓ |
| REQ-5 | 旧 record 无 source_path 时 SFT 提取行为保持不变（向后兼容） | T2 | T2 验收 5 明确 incSkip「无 source_path」 | ✓ |
| REQ-6 | source_path 指向 BUGFIX 时沿用现有 §1+§4 解析逻辑 | T2 | T2 验收 4 明确 source_path 指向 BUGFIX 时行为与现有一致 | ✓ |

**结论**：需求映射表完整，每个需求均有对应任务及可追溯的验收标准。

---

### 1.2 验收可执行性

| 任务 | 验收项 | 可量化 | 可验证 | 验收命令 | 结论 |
|------|--------|--------|--------|----------|------|
| T1 | 单测 source_path=reportPath / artifactDocPath | ✓ | ✓ | `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts` | ✓ |
| T1 | Skill 文档更新 | ✓ | ✓ | grep 检查 speckit-workflow、bmad-bug-assistant 段落 | ✓ |
| T1 | CLI 验证 artifactDocPath=tasks → source_path=reportPath | ✓ | ✓ | 需替换占位路径后执行，验证 scoring/data 下 record | ✓ |
| T1 | CLI 验证 artifactDocPath=BUGFIX → source_path=BUGFIX | ✓ | ✓ | 同上 | ✓ |
| T2 | audit-report-parser 单测 | ✓ | ✓ | `npm run test:scoring -- scoring/analytics/__tests__/audit-report-parser.test.ts` | ✓ |
| T2 | sft-extractor 单测 | ✓ | ✓ | `npm run test:scoring -- scoring/analytics/__tests__/sft-extractor.test.ts` | ✓ |
| T2 | SFT 提取集成验证 | ✓ | ✓ | `npx ts-node scripts/sft-extract.ts --threshold 60`（依赖 T1 实施后数据） | ✓ |
| T3 | eval-question-generate 执行 | ✓ | ✓ | `npx ts-node scripts/eval-question-generate.ts --run-id <id> --version v1` | ✓ |
| T3 | list 验证 | ✓ | ✓ | `npx ts-node scripts/eval-questions-cli.ts list --version v1` | ✓ |
| T3 | 无短板数据、run 不存在 | ✓ | ✓ | 验收 5、6 明确输出与 exit 码 | ✓ |

**结论**：验收标准可量化、可验证；CLI 验证需实施时替换占位路径，符合预期。

---

### 1.3 集成/端到端验证

| 任务 | 单元测试 | 集成验证 | 生产路径调用 | 孤岛风险 |
|------|----------|----------|--------------|----------|
| T1 | parse-and-write 单测 | CLI 调用 parseAndWriteScore 写入 scoring/data | scripts/parse-and-write-score.ts → parseAndWriteScore | 无 |
| T2 | audit-report-parser、sft-extractor 单测 | sft-extract.ts 调用 extractSftDataset | scripts/sft-extract.ts → scoring/analytics/sft-extractor | 无 |
| T3 | 无单测（脚本入口） | eval-question-generate 产出 → list 消费 | scripts/eval-question-generate.ts、eval-questions-cli.ts | 无 |

**结论**：T1 有单测 + CLI 集成验证；T2 有单测 + sft-extract 集成验证；T3 有脚本执行 + list 端到端验证。无「仅有单元测试而无集成验证」的孤岛。

---

### 1.4 依赖与可并行性

| 任务 | 依赖 | 可并行 | T2 对 T1 的验收体现 |
|------|------|--------|---------------------|
| T1 | 无 | 与 T3 可并行 | — |
| T2 | T1 | 须在 T1 完成后 | T2 验收 3「source_path 指向审计报告 fixture」— 单测用 fixture 可独立；集成验证 sft-extract 依赖 T1 实施后 record.source_path 指向审计报告 |
| T3 | coach 现有输出 | 与 T1 可并行 | — |

**结论**：T1→T2 依赖清晰；T2 对 T1 的 source_path 逻辑依赖在集成验证中体现；T1 与 T3 可并行合理。

---

### 1.5 边界处理

| 场景 | 边界表覆盖 | 验收/描述覆盖 | 结论 |
|------|------------|---------------|------|
| implement artifactDocPath=BUGFIX | ✓ | T1 验收 2、6 | ✓ |
| implement artifactDocPath=tasks/spec/plan | ✓ | T1 验收 1、5 | ✓ |
| implement artifactDocPath 未传入 | ✓ | T1 描述、边界表 | ✓ |
| source_path 指向审计报告但无批判结论 | ✓ | T2 验收 6、边界表 | ✓ |
| source_path 指向 BUGFIX 含 §1+§4 | ✓ | T2 验收 4 | ✓ |
| eval_question 无短板数据 | ✓ | T3 验收 5 | ✓ |
| eval_question run 不存在 | ✓ | T3 验收 6 | ✓ |

**结论**：边界处理表覆盖 BUGFIX/tasks/未传入、无短板数据、run 不存在等关键场景。

---

### 1.6 禁止词检查

全文检索：无「可选」「可考虑」「后续」「待定」「酌情」「技术债」「先实现、后续扩展」等禁止词。GAP-17 已闭合。

---

### 1.7 向后兼容

- 旧 record 无 source_path：incSkip「无 source_path」，T2 验收 5 覆盖。
- source_path 指向 BUGFIX：extractBugfixSections 优先，T2 验收 4 覆盖。
- source_path 指向 spec/plan/tasks/GAPS：向后兼容说明已描述 T1 实施后此类 record 将指向 reportPath。

**结论**：向后兼容说明完整。

---

### 1.8 可追溯性

需求 ID → 任务 → 验收标准的映射清晰；GAP 闭合表与任务描述、验收标准一致。

---

## 2. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与需求映射矛盾、孤岛模块、伪实现/占位、行号/路径漂移、验收一致性。

**每维度结论**：

- **遗漏需求点**：需求映射表 REQ-1～REQ-6 均有对应任务。但 T1 描述要求更新「speckit-workflow、bmad-bug-assistant、bmad-story-assistant」三处 Skill 文档，验收标准 3 仅覆盖 speckit-workflow，验收标准 4 仅覆盖 bmad-bug-assistant。**bmad-story-assistant 的 implement 阶段 artifactDocPath 约定更新无显式验收标准**。产出路径含 `skills/bmad-story-assistant/SKILL.md`，描述明确要求更新，验收遗漏。party-mode GAP-14 仅针对 bmad-bug-assistant 闭合，bmad-story-assistant 的 implement 流程（嵌套 speckit 时）同样涉及 parseAndWriteScore 调用，应与 speckit-workflow、bmad-bug-assistant 保持 artifactDocPath 约定一致。无验收则实施时可能只更新 bmad-bug-assistant 而遗漏 bmad-story-assistant，导致嵌套流程的 source_path 写入不符合预期。**未通过**。

- **边界未定义**：边界处理表覆盖 BUGFIX/tasks/未传入、无短板数据、run 不存在等；instruction 不足阈值 20 字符已明确（GAP-8 闭合）；reportPath 在 implement 阶段语义为审计报告路径（GAP-4 闭合）；run 不存在时 exit 1（GAP-7 闭合）。**通过**。

- **验收不可执行**：T1/T2/T3 验收命令均可执行；`npm run test:scoring` 存在于 package.json；CLI 验证需替换占位路径，实施时可操作。T1 验收 5、6 的「验证 scoring/data 下对应 record」需通过 runId（含 timestamp）或按 epic/story/stage 查询定位，可执行。**通过**。

- **与需求映射矛盾**：需求映射与任务、验收一致；T2 依赖 T1 与需求 REQ-1（implement 低分可被 SFT 提取）的因果链一致；向后兼容说明与 REQ-5、REQ-6 无矛盾。**通过**。

- **孤岛模块**：audit-report-parser 被 sft-extractor 调用，sft-extractor 被 sft-extract.ts 调用；eval-question-generate 产出被 list 消费。T2 的 extractAuditReportSections 仅在 extractBugfixSections 返回 null 时调用，集成路径清晰。**通过**。

- **伪实现/占位**：任务描述为具体实现逻辑（parse-and-write 分支、extractAuditReportSections 解析格式、eval-question-generate 题目映射），无 TODO、占位表述。**通过**。

- **行号/路径漂移**：TASKS 引用 `scoring/orchestrator/parse-and-write.ts`、`scripts/parse-and-write-score.ts`、`scripts/sft-extract.ts`、`scripts/eval-questions-cli.ts` 等，项目内均存在；`scripts/eval-question-generate.ts` 为 T3 新建，合理。skills 路径为 `skills/...` 或等效路径，可接受。MANIFEST_SCHEMA §3.1 存在于 `scoring/eval-questions/MANIFEST_SCHEMA.md`。**通过**。

- **验收一致性**：T3 描述支持 `--input <coach-diagnose JSON 路径>` 与 `--run-id` 两种输入方式，但验收标准 1、5、6 仅覆盖 `--run-id` 路径。**`--input` 路径无验收标准**，实施时可能忽略该功能或验收不完整。若 `--input` 为设计的一部分（离线场景：先 coach-diagnose 输出 JSON，再 eval-question-generate 从文件读取），应有至少一条验收；若为可选扩展，应在描述或验收中明确「本 TASKS 不验收 --input」。**未通过**。

**补充对抗性核查**（audit-prompts-critical-auditor-appendix 维度延伸）：

- **T1 与 T2 验收衔接**：T2 集成验证「npx ts-node scripts/sft-extract.ts --threshold 60」依赖「存在 implement 低分且 source_path 指向审计报告的 record」。该 record 仅当 T1 实施后、speckit implement 流程按新逻辑写入时才会产生。若 T2 实施时尚未有此类真实数据，集成验证可能无法观察到「跳过原因不含无 §1 或 §4」的正面结果。T2 单测用 fixture 可独立验证，但集成验证的时机需在 T1 实施并产生至少一条符合条件 record 之后。文档已说明 T2 依赖 T1，可接受。

- **T3 manifest 追加与并发**：T3 描述「manifest.yaml 追加新条目」。若多进程或多次运行 eval-question-generate 同时写入同一 manifest，是否存在竞态？验收标准未覆盖。考虑到典型用法为单次运行，可视为实施阶段再评估，不阻断本轮。

- **extractAuditReportSections 正则覆盖**：T2 描述要求解析「本轮存在 gap，具体项：① A；② B」等变体。GAP-3 闭合称覆盖多种格式，但验收标准 2 仅列举「1) A；2) B」与「本轮无新 gap」两种。若实际报告使用「①」「②」等 Unicode 序号，正则是否覆盖？建议实施时用真实报告 fixture 验证，不阻断本轮。

- **eval-question-generate 与 coachDiagnose 接口**：T3 依赖「coach-diagnose 输出含 weak_areas、weakness_clusters（已实现）」。若 coachDiagnose 返回结构变更（如字段重命名），eval-question-generate 会静默失败。验收标准未要求对 coachDiagnose 输出结构的兼容性断言。可视为依赖已实现接口的合理假设，不阻断本轮。

**本轮结论**：**本轮存在 gap**。具体项：1) T1 的 bmad-story-assistant 文档更新无显式验收标准，与描述、产出路径不一致；2) T3 的 `--input` 路径无验收标准，描述支持但验收未覆盖。

**修改建议**：1) 在 T1 验收标准中补充「bmad-story-assistant Skill 中 implement 阶段（或嵌套 speckit 流程）parseAndWriteScore 调用时 artifactDocPath 取值规则与 speckit-workflow、bmad-bug-assistant 一致，且文档中有明确示例或段落」；2) 在 T3 验收标准中补充「使用 `--input <coach-diagnose JSON 路径>` 可成功生成题目，且输出与 `--run-id` 等价」或明确 `--input` 为可选扩展、本 TASKS 不验收。

**对抗性复验（若实施时出错会怎样）**：① T1 若只更新 bmad-bug-assistant 而遗漏 bmad-story-assistant，则 bmad-story-assistant 触发的 Dev Story 实施后审计流程中，parseAndWriteScore 可能未传入 artifactDocPath，导致 implement 阶段 source_path 不写或写错，SFT 提取器无法从审计报告获取 instruction。② T3 若 --input 未实现或实现有 bug，用户从 coach-diagnose 输出 JSON 离线生成题目时无法工作，但验收不会发现。③ T2 集成验证 `sft-extract.ts --threshold 60` 依赖「存在 implement 低分且 source_path 指向审计报告的 record」，若 T1 实施后无此类数据，验收时需人工构造或等待真实 run，验收时机可能滞后；但单测用 fixture 可独立验证，不阻断。

**GAP 闭合表交叉验证**：GAP-1～17 均已闭合。GAP-14 闭合结论为「Skill 文档明确调用示例与 artifactDocPath 取值规则」，但仅明确 bmad-bug-assistant，bmad-story-assistant 未在 GAP 表中单独列出，属隐含遗漏。GAP-16 闭合结论为「sft-extractor.test.ts 新增用例」，与 T2 验收 3 一致。GAP-17 禁止词检查通过。

**潜在遗漏场景**：① source_path 指向的审计报告文件不存在（如路径错误、文件被删）：extractAuditReportSections 读取时可能抛错，T2 描述未明确 fs 异常处理；边界表仅覆盖「报告无批判审计员结论」，未覆盖「文件不存在」。可接受为实施时按常规 Node 异常处理。② T3 的 --outputDir 默认值 `scoring/eval-questions/v1` 与 --version v1 的目录关系：若 version 为 v2，outputDir 是否自动切换？描述说「默认 scoring/eval-questions/v1」，未明确 version 与 outputDir 的联动，可能为设计选择，非本轮阻断 gap。

**验收命令可执行性深度检查**：T1 CLI 验证使用 `--epic 9 --story 2`，会生成 `runId=dev-e9-s2-implement-{timestamp}`，scoring/data 下写入的 JSON 文件需按 runId 或时间戳排序取最新；parse-and-write-score 的 writeMode 默认 single_file 时写入 `scoring/data/{runId}.json`，故验证时可直接读取该文件检查 source_path 字段。T2 的 sft-extract 调用 extractSftDataset，内部会遍历 scoring/data 下 record，phase_score≤60 且 source_path 存在时尝试解析；验证「跳过原因不含无 §1 或 §4」需有至少一条符合条件的 record，否则无法区分「无数据」与「解析成功」。T3 的 list 命令依赖 manifest-loader 遍历 manifest.yaml，gen- 前缀题目 id 与 q001 格式不同，GAP-6 已确认 manifest 的 id 为任意字符串，list 仅遍历，无兼容性问题。

---

## 3. 结论

**未通过**。存在 2 项 gap，需补充验收标准后重新审计。

| Gap | 修改建议 |
|-----|----------|
| T1 bmad-story-assistant 无验收 | 补充 T1 验收标准，覆盖 bmad-story-assistant 的 artifactDocPath 约定 |
| T3 --input 无验收 | 补充 T3 验收标准覆盖 --input 路径，或明确不验收 |

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: B

维度评分:
- 需求完整性: 85/100
- 可测试性: 90/100
- 一致性: 82/100
- 可追溯性: 88/100
