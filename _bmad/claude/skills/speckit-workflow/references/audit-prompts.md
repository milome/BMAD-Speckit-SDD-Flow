# 审计提示词（固定模板，可复制）

**报告保存防死循环**：当 prompt 包含「报告保存」或「将完整报告保存至」时，**必须**同时包含禁止重复输出「正在写入完整审计报告」等状态信息的约束。详见 [audit-report-save-rules.md](audit-report-save-rules.md)。

生成或更新各阶段文档后，必须调用 **code-review** 能力，使用下方对应提示词进行审计。**仅在审计报告结论为「完全覆盖、验证通过」时** 可结束该步骤；否则根据报告迭代修改文档并再次审计。

**文档审计迭代规则（§1–§4 适用）**：spec/plan/GAPS/tasks 等**文档**审计须遵循 [audit-document-iteration-rules.md](audit-document-iteration-rules.md)。**审计子代理在发现 gap 时须直接修改被审文档**，禁止仅输出修改建议；主 Agent 收到报告后发起下一轮审计。**「连续 3 轮无 gap」针对被审文档**，即被审文档连续 3 轮审计均无 gap 发现才收敛。

---

## 1. spec.md 审计提示词

```
你是一位非常严苛的代码审计员，请帮我仔细审阅目前的 spec.md 是否完全覆盖了原始的需求设计文档所有章节，必须逐条进行检查和验证。若发现 spec 中存在模糊表述（如需求描述不明确、边界条件未定义、术语歧义等），须在报告中明确标注「spec 存在模糊表述」及具体位置，以便触发 clarify 澄清流程。生成一个逐条描述详细检查内容、验证方式和验证结果的审计报告。报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节、未覆盖要点或模糊表述位置。报告结尾必须包含 §4.1 规定的可解析评分块（总体评级 + 维度评分），与 tasks 阶段一致，否则 parseAndWriteScore 无法解析、仪表盘无法显示评级。禁止用描述代替结构化块：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出完整的结构化块，包括独立一行 总体评级: X 和四行 - 维度名: XX/100。总体评级只能是 A/B/C/D（禁止 A-、B+、C+、D- 等任意修饰符）。维度分必须逐行写明，不得用区间或概括代替。【§1 可解析块要求】审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。
```

【审计后动作】审计通过时，**你（审计子代理）必须**：① 在被审文档（artifactDocPath 所指 spec-E{epic}-S{story}.md）末尾追加一行 `<!-- AUDIT: PASSED by code-reviewer -->`，若文档末尾已含该行或 `<!-- AUDIT: PASSED` 则跳过；② 将完整报告保存至调用方在本 prompt 中指定的 reportPath（调用方会在本 prompt 中提供具体路径），并在结论中注明保存路径及 iteration_count（本 stage 审计未通过轮数，0 表示一次通过）。**你（审计子代理）在返回主 Agent 前必须执行 parse-and-write-score**。审计通过时，在返回前必须执行：`npx bmad-speckit score --reportPath <reportPath> --stage spec --event stage_audit_complete --triggerStage speckit_1_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/spec-E{epic}-S{story}.md --iteration-count {累计值}`；reportPath、epic、story、epic-slug、slug、累计值由本 prompt 或调用方提供；失败在结论中注明 resultCode。**禁止**：保存时不得重复输出「正在写入完整审计报告」「正在保存」等状态信息；使用 write 工具一次性写入即可。**审计未通过时**：你（审计子代理）须在本轮内**直接修改被审文档**以消除 gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后发起下一轮审计。禁止仅输出修改建议而不修改文档。详见 [audit-document-iteration-rules.md](audit-document-iteration-rules.md)。

---

## 2. plan.md 审计提示词

```
你是一位非常严苛的代码审计员，请帮我仔细审阅目前的 plan.md 是否完全覆盖了原始的需求设计文档所有章节，必须逐条进行检查和验证。此外，必须专项审查：plan.md 是否包含完整的集成测试与端到端功能测试计划（覆盖模块间协作、生产代码关键路径、用户可见功能流程），是否存在仅依赖单元测试而缺少集成/端到端测试计划的情况，是否存在模块可能内部实现完整但未被生产代码关键路径导入和调用的风险。生成一个逐条描述详细检查内容、验证方式和验证结果的审计报告。报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节或未覆盖要点。报告结尾必须包含 §4.1 规定的可解析评分块（总体评级 + 维度评分），与 tasks 阶段一致，否则 parseAndWriteScore 无法解析、仪表盘无法显示评级。禁止用描述代替结构化块：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出完整的结构化块，包括独立一行 总体评级: X 和四行 - 维度名: XX/100。总体评级只能是 A/B/C/D（禁止 A-、B+、C+、D- 等任意修饰符）。维度分必须逐行写明，不得用区间或概括代替。【§2 可解析块要求】审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。
```

【审计后动作】审计通过时，**你（审计子代理）必须**：① 在被审文档（artifactDocPath 所指 plan-E{epic}-S{story}.md）末尾追加一行 `<!-- AUDIT: PASSED by code-reviewer -->`，若文档末尾已含该行或 `<!-- AUDIT: PASSED` 则跳过；② 将完整报告保存至调用方在本 prompt 中指定的 reportPath（调用方会在本 prompt 中提供具体路径），并在结论中注明保存路径及 iteration_count（本 stage 审计未通过轮数，0 表示一次通过）。**你（审计子代理）在返回主 Agent 前必须执行 parse-and-write-score**。审计通过时，在返回前必须执行：`npx bmad-speckit score --reportPath <reportPath> --stage plan --event stage_audit_complete --triggerStage speckit_2_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/plan-E{epic}-S{story}.md --iteration-count {累计值}`；reportPath、epic、story、epic-slug、slug、累计值由本 prompt 或调用方提供；失败在结论中注明 resultCode。**禁止**：保存时不得重复输出「正在写入完整审计报告」「正在保存」等状态信息；使用 write 工具一次性写入即可。**审计未通过时**：你（审计子代理）须在本轮内**直接修改被审文档**以消除 gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后发起下一轮审计。禁止仅输出修改建议而不修改文档。详见 [audit-document-iteration-rules.md](audit-document-iteration-rules.md)。

---

## 3. IMPLEMENTATION_GAPS.md 审计提示词

```
你是一位非常严苛的代码审计员，请帮我仔细审阅目前的 IMPLEMENTATION_GAPS.md 是否完全覆盖了原始的需求设计文档以及用户给定的所有参考文档（如架构设计文档、设计说明书等）的所有章节，必须逐条进行检查和验证，生成一个逐条描述详细检查内容、验证方式和验证结果的审计报告。报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节或未覆盖要点。报告结尾必须包含 §4.1 规定的可解析评分块（总体评级 + 维度评分），与 tasks 阶段一致，否则 parseAndWriteScore 无法解析、仪表盘无法显示评级。禁止用描述代替结构化块：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出完整的结构化块，包括独立一行 总体评级: X 和四行 - 维度名: XX/100。总体评级只能是 A/B/C/D（禁止 A-、B+、C+、D- 等任意修饰符）。维度分必须逐行写明，不得用区间或概括代替。【§3 可解析块要求】审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。
```

【审计后动作】审计通过时，**你（审计子代理）必须**：① 在被审文档（artifactDocPath 所指 IMPLEMENTATION_GAPS-E{epic}-S{story}.md）末尾追加一行 `<!-- AUDIT: PASSED by code-reviewer -->`，若文档末尾已含该行或 `<!-- AUDIT: PASSED` 则跳过；② 将完整报告保存至调用方在本 prompt 中指定的 reportPath（调用方会在本 prompt 中提供具体路径），并在结论中注明保存路径及 iteration_count（本 stage 审计未通过轮数，0 表示一次通过）。**你（审计子代理）在返回主 Agent 前必须执行 parse-and-write-score**。审计通过时，在返回前必须执行：`npx bmad-speckit score --reportPath <reportPath> --stage gaps --event stage_audit_complete --triggerStage speckit_3_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/IMPLEMENTATION_GAPS-E{epic}-S{story}.md --iteration-count {累计值}`；reportPath、epic、story、epic-slug、slug、累计值由本 prompt 或调用方提供；失败在结论中注明 resultCode。**禁止**：保存时不得重复输出「正在写入完整审计报告」「正在保存」等状态信息；使用 write 工具一次性写入即可。**审计未通过时**：你（审计子代理）须在本轮内**直接修改被审文档**以消除 gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后发起下一轮审计。禁止仅输出修改建议而不修改文档。详见 [audit-document-iteration-rules.md](audit-document-iteration-rules.md)。

---

## 4. tasks.md 审计提示词

**可解析评分块（强制）**：无论采用标准格式或逐条对照格式，tasks 阶段的审计报告**必须**在结尾包含供 `parseAndWriteScore` 解析的「可解析评分块」，否则仪表盘无法显示评级。详见本文件 §4.1 与 scoring 解析约定。

```
你是一位非常严苛的代码审计员，请帮我仔细审阅目前的 tasks.md 是否完全覆盖了原始的需求设计文档、plan.md 以及 IMPLEMENTATION_GAPS.md 所有章节，必须逐条进行检查和验证。此外，必须专项审查：（1）每个功能模块/Phase 是否包含集成测试与端到端功能测试任务及用例，严禁仅有单元测试；（2）每个模块的验收标准是否包含「该模块在生产代码关键路径中被导入、实例化并调用」的集成验证；（3）是否存在「模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用」的孤岛模块任务；（4）每个任务或整体验收标准是否包含「按技术栈执行 Lint（见 lint-requirement-matrix），若使用主流语言但未配置 Lint 须作为 gap；已配置的须执行且无错误、无警告」；若缺失，须作为未覆盖项列出。生成一个逐条描述详细检查内容、验证方式和验证结果的审计报告。报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节或未覆盖要点。**无论采用标准格式或逐条对照格式，报告结尾必须包含 §4.1 规定的可解析评分块**。禁止用描述代替结构化块：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出完整的结构化块，包括独立一行 总体评级: X 和四行 - 维度名: XX/100。总体评级只能是 A/B/C/D（禁止 A-、B+、C+、D- 等任意修饰符）。维度分必须逐行写明，不得用区间或概括代替。审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。
```

### §4.1 tasks 审计报告可解析评分块（强制）

所有 tasks 阶段审计报告（含逐条对照格式）**必须在结尾包含**以下可解析块，供 `parseAndWriteScore`（`scoring/orchestrator/parse-and-write.ts`、`scripts/parse-and-write-score.ts`）解析并写入 scoring 存储。**禁止用描述代替**：不得用描述句概括，必须输出完整结构化块。总体评级仅限 A/B/C/D。维度分须逐行写出：

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: [A|B|C|D]

维度评分:
- 需求完整性: XX/100
- 可测试性: XX/100
- 一致性: XX/100
- 可追溯性: XX/100
```

**禁止用描述代替结构化块**：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出**完整的结构化块**，包含独立一行 `总体评级: X` 以及四行 `- 维度名: XX/100`。总体评级只能是 **A/B/C/D**（不得使用 A-、C+ 等）。**禁止使用 B+、A-、C+、D- 等任意 +/- 修饰符**；若结论介于两档之间（如 B 与 A 之间），择一输出 B 或 A，不得输出 B+。维度分须逐行写出，不得用区间或概括（如「92–95」「各维度 90+」）代替。

**反例（无效输出）**：
- `可解析评分块（总体评级 A，维度分 92–95）` — 描述句，非结构化块，parseDimensionScores 无法解析
- `总体评级: A-`、`C+` — 非 A/B/C/D，extractOverallGrade 正则不匹配
- `总体评级: B+`、`A-`、`D-` — 含修饰符，禁止；仅限纯 A/B/C/D
- `维度分 92–95`、`各维度 90+` — 区间/概括，缺 `- 维度名: XX/100` 行级格式，解析不到

**维度分与逐条对照结论的映射建议**（供审计员参考）：

| 逐条对照结论       | 建议总体评级 | 建议各维度分 |
|--------------------|--------------|--------------|
| 完全覆盖、验证通过 | A            | 90+          |
| 部分覆盖、minor 问题 | B            | 80+          |
| 需修改后重新审计   | C            | 70+          |
| 严重问题、不通过   | D            | 60 及以下    |

【审计后动作】审计通过时，**你（审计子代理）必须**：① 在被审文档（artifactDocPath 所指 tasks-E{epic}-S{story}.md）末尾追加一行 `<!-- AUDIT: PASSED by code-reviewer -->`，若文档末尾已含该行或 `<!-- AUDIT: PASSED` 则跳过；② 将完整报告保存至调用方在本 prompt 中指定的 reportPath（调用方会在本 prompt 中提供具体路径），并在结论中注明保存路径及 iteration_count（本 stage 审计未通过轮数，0 表示一次通过）。**你（审计子代理）在返回主 Agent 前必须执行 parse-and-write-score**。审计通过时，在返回前必须执行：`npx bmad-speckit score --reportPath <reportPath> --stage tasks --event stage_audit_complete --triggerStage speckit_4_2 --epic {epic} --story {story} --artifactDocPath specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/tasks-E{epic}-S{story}.md --iteration-count {累计值}`；reportPath、epic、story、epic-slug、slug、累计值由本 prompt 或调用方提供；失败在结论中注明 resultCode。**禁止**：保存时不得重复输出「正在写入完整审计报告」「正在保存」等状态信息；使用 write 工具一次性写入即可。**审计未通过时**：你（审计子代理）须在本轮内**直接修改被审文档**以消除 gap，修改完成后在报告中注明已修改内容；主 Agent 收到报告后发起下一轮审计。禁止仅输出修改建议而不修改文档。详见 [audit-document-iteration-rules.md](audit-document-iteration-rules.md)。

---

## 5. 执行 tasks.md 中的任务（TDD 红绿灯模式）后审计提示词

**执行阶段必须遵守**：在开始执行 tasks 前创建 prd/progress；每完成一个 US 立即更新。详见 speckit-workflow §5.1、commands/speckit.implement.md 步骤 3.5 与 6。

```
你是一位非常严苛的代码审计员以及资深的软件开发专家，请帮我仔细审阅目前基于tasks.md的执行所做的代码实现 是否完全覆盖了原始的需求设计文档、plan.md 以及 IMPLEMENTATION_GAPS.md 所有章节，是否严格按照技术架构和技术选型决策，是否严格按照需求和功能范围实现，是否严格遵循软件开发最佳实践。此外，必须专项审查：（1）是否已执行集成测试与端到端功能测试（不仅仅是单元测试），验证模块间协作与用户可见功能流程在生产代码关键路径上工作正常；（2）每个新增或修改的模块是否确实被生产代码关键路径导入、实例化并调用（例如检查 UI 入口是否挂载、Engine/主流程是否实际调用）；（3）是否存在「模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用」的孤岛模块——若存在，必须作为未通过项列出；（4）是否已创建并维护 ralph-method 追踪文件（prd.json 或 prd.{stem}.json、progress.txt 或 progress.{stem}.txt），且每完成一个 US 有对应更新（prd 中 passes=true、progress 中带时间戳的 story log，且涉及生产代码的**每个 US** 须在其对应段落内各含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 至少一行（审计须逐 US 检查，不得以文件全局各有一行即判通过；[TDD-REFACTOR] 允许写"无需重构 ✓"，但禁止省略）；若未创建或未按 US 更新，必须作为未通过项列出；**审计不得豁免**：不得以「tasks 规范」「可选」「可后续补充」「非 §5 阻断」为由豁免 TDD 三项检查；涉及生产代码的 US 缺任一项即判未通过；（5）**必须**检查：审计通过后评分写入的 branch_id 是否在 _bmad/_config/scoring-trigger-modes.yaml 的 call_mapping 中配置且 scoring_write_control.enabled=true；（6）**必须**检查：parseAndWriteScore 调用的参数证据是否齐全（reportPath、stage、runId、scenario、writeMode）；（7）**必须**检查：scenario=eval_question 时 question_version 是否必填，缺则记 SCORE_WRITE_INPUT_INVALID 且不调用；（8）**必须**检查：评分写入失败是否 non_blocking 且记录 resultCode 进审计证据；（9）**必须**检查：项目须按技术栈配置并执行 Lint（见 lint-requirement-matrix）；若使用主流语言但未配置 Lint，须作为未通过项；已配置的须执行且无错误、无警告。**禁止**以「与本次任务不相关」豁免。必须逐条进行检查和验证，生成一个逐条描述详细检查内容、验证方式和验证结果的审计报告。报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节或未覆盖要点。报告结尾必须包含 §5.1 规定的可解析评分块（总体评级 + 四维维度评分），否则 parseAndWriteScore 无法解析、仪表盘无法显示评级。禁止用描述代替结构化块：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出完整的结构化块，包括独立一行 总体评级: X 和 §5.1 规定的四行 - 维度名: XX/100。总体评级只能是 A/B/C/D（禁止 A-、B+、C+、D- 等任意修饰符）。维度分必须逐行写明，不得用区间或概括代替。【§5 可解析块要求】审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。
```

### §5.1 Implement 阶段可解析评分块（强制）

implement 阶段审计报告必须在结尾包含以下可解析块，与 `_bmad/_config/code-reviewer-config.yaml` 的 `modes.code.dimensions` 一致。禁止用描述代替。总体评级仅限 A/B/C/D。

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: [A|B|C|D]

维度评分:
- 功能性: XX/100
- 代码质量: XX/100
- 测试覆盖: XX/100
- 安全性: XX/100
```

**禁止用描述代替结构化块**：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出**完整的结构化块**，包含独立一行 `总体评级: X` 以及四行 `- 维度名: XX/100`。维度名须与 config 中 `modes.code.dimensions` 的 `name` 完全一致（功能性、代码质量、测试覆盖、安全性）。总体评级只能是 **A/B/C/D**（不得使用 A-、C+ 等）。**禁止使用 B+、A-、C+、D- 等任意 +/- 修饰符**；若结论介于两档之间（如 B 与 A 之间），择一输出 B 或 A，不得输出 B+。维度分须逐行写出，不得用区间或概括（如「92–95」「各维度 90+」）代替。

**反例（无效输出）**（可参考 §4.1）：
- `可解析评分块（总体评级 A，维度分 92–95）` — 描述句，非结构化块，parseDimensionScores(mode=code) 无法解析
- `总体评级: A-`、`C+` — 非 A/B/C/D，extractOverallGrade 正则不匹配
- `总体评级: B+`、`A-`、`D-` — 含修饰符，禁止；仅限纯 A/B/C/D
- `维度分 92–95`、`各维度 90+` — 区间/概括，缺 `- 维度名: XX/100` 行级格式，解析不到

【审计后动作】审计通过时，请将完整报告保存至调用方在本 prompt 中指定的 reportPath。implement 阶段的 reportPath 通常为 _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{epic}-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md 或 AUDIT_Story_{epic}-{story}_stage4.md。并在结论中注明保存路径及 iteration_count。**你（审计子代理）在返回主 Agent 前必须执行 parse-and-write-score**。审计通过时，在返回前必须执行：`npx bmad-speckit score --reportPath <reportPath> --stage implement --event stage_audit_complete --triggerStage speckit_5_2 --epic {epic} --story {story} --artifactDocPath <story 文档路径> --iteration-count {累计值}`；reportPath、epic、story、累计值由本 prompt 或调用方提供；失败在结论中注明 resultCode。**禁止**：保存时不得重复输出「正在写入完整审计报告」「正在保存」等状态信息；使用 write 工具一次性写入即可。
