<!--
audit-prompts-code.md
对应关系：
- 本文件等效于 audit-prompts.md §5（执行 tasks.md 后 implement 阶段审计提示词）
- 与 _bmad/_config/code-reviewer-config.yaml modes.code 对应：code-reviewer 在 code 模式下使用本文件作为 prompt_template
- 可解析块部分明确为 §5.1 四维格式，与 modes.code.dimensions 一致（功能性、代码质量、测试覆盖、安全性）
-->

<!-- CLOSEOUT-APPROVED-CANONICAL -->
> Closeout 术语收紧：本文件中“完成 / 通过 / 可进入下一阶段”一律指 `runAuditorHost` 返回 `closeout approved`。审计报告 `PASS` 仅表示可以进入 host close-out，单独的 `PASS` 不得视为完成、准入或放行。
# Implement 阶段代码审计提示词（code 模式）

本文件为 `_bmad/_config/code-reviewer-config.yaml` 中 modes.code 的 prompt_template，等效于 `audit-prompts.md` §5。用于 speckit-workflow §5.2 执行阶段审计及 bmad-story-assistant 阶段四实施后审计。

---

## 审计提示词正文

**执行阶段必须遵守**：在开始执行 tasks 前创建 prd/progress；每完成一个 US 立即更新。详见 speckit-workflow §5.1、commands/speckit.implement.md 步骤 3.5 与 6。

```
你是一位非常严苛的代码审计员以及资深的软件开发专家，请帮我仔细审阅目前基于tasks.md的执行所做的代码实现 是否完全覆盖了原始的需求设计文档、plan.md 以及 IMPLEMENTATION_GAPS.md 所有章节，是否严格按照技术架构和技术选型决策，是否严格按照需求和功能范围实现，是否严格遵循软件开发最佳实践。此外，必须专项审查：（1）是否已执行集成测试与端到端功能测试（不仅仅是单元测试），验证模块间协作与用户可见功能流程在生产代码关键路径上工作正常；（2）每个新增或修改的模块是否确实被生产代码关键路径导入、实例化并调用（例如检查 UI 入口是否挂载、Engine/主流程是否实际调用）；（3）是否存在「模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用」的孤岛模块——若存在，必须作为未通过项列出；（4）是否已创建并维护 ralph-method 追踪文件（prd.json 或 prd.{stem}.json、progress.txt 或 progress.{stem}.txt），且每完成一个 US 有对应更新（prd 中 passes=true、progress 中带时间戳的 story log，且涉及生产代码的**每个 US** 须在其对应段落内各含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 至少一行（审计须逐 US 检查，不得以文件全局各有一行即判通过；[TDD-REFACTOR] 允许写"无需重构 ✓"，但禁止省略）；若未创建或未按 US 更新，必须作为未通过项列出；**审计不得豁免**：不得以「tasks 规范」「可选」「可后续补充」「非 §5 阻断」为由豁免 TDD 三项检查；涉及生产代码的 US 缺任一项即判未通过；（5）**必须**检查：审计通过后评分写入的 branch_id 是否在 _bmad/_config/scoring-trigger-modes.yaml 的 call_mapping 中配置且 scoring_write_control.enabled=true；（6）**必须**检查：parseAndWriteScore 调用的参数证据是否齐全（reportPath、stage、runId、scenario、writeMode）；（7）**必须**检查：scenario=eval_question 时 question_version 是否必填，缺则记 SCORE_WRITE_INPUT_INVALID 且不调用；（8）**必须**检查：评分写入失败是否 non_blocking 且记录 resultCode 进审计证据。必须逐条进行检查和验证，生成一个逐条描述详细检查内容、验证方式和验证结果的审计报告。报告结尾必须明确给出结论：是否「完全覆盖、验证通过」；若未通过，请列出遗漏章节或未覆盖要点。报告结尾必须包含以下可解析评分块（四维：功能性、代码质量、测试覆盖、安全性），否则 parseAndWriteScore(mode=code) 无法解析、仪表盘四维显示「无数据」。禁止用描述代替结构化块：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出完整的结构化块，包括独立一行 总体评级: X 和四行 - 维度名: XX/100。维度名须与 _bmad/_config/code-reviewer-config.yaml modes.code.dimensions 完全一致。总体评级只能是 A/B/C/D（禁止 A-、C+ 等）。维度分必须逐行写明，不得用区间或概括代替。【§5 可解析块要求】审计时须同时执行批判审计员检查，输出格式见 [audit-prompts-critical-auditor-appendix.md](audit-prompts-critical-auditor-appendix.md)。
```

---

## 可解析评分块（强制，等效 audit-prompts §5.1）

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

## Structured Drift Signal Block（强制）

implement / post_audit 阶段审计报告还必须包含以下结构化 block。缺少该 block 不得视为“无 drift”。

```markdown
## Structured Drift Signal Block

| signal | status | evidence |
| --- | --- | --- |
| smoke_task_chain | pass/fail | 简要证据 |
| closure_task_id | pass/fail | 简要证据 |
| journey_unlock | pass/fail | 简要证据 |
| gap_split_contract | pass/fail | 简要证据 |
| shared_path_reference | pass/fail | 简要证据 |
```

**禁止用描述代替结构化块**：不得在总结或正文中用「可解析评分块（总体评级 X，维度分 Y–Z）」等文字概括；必须在报告中输出**完整的结构化块**，包含独立一行 `总体评级: X` 以及四行 `- 维度名: XX/100`。维度名须与 config 中 `modes.code.dimensions` 的 `name` 完全一致（功能性、代码质量、测试覆盖、安全性）。总体评级只能是 **A/B/C/D**（不得使用 A-、C+ 等）。维度分须逐行写出，不得用区间或概括（如「92–95」「各维度 90+」）代替。

**反例（无效输出）**：
- `可解析评分块（总体评级 A，维度分 92–95）` — 描述句，非结构化块，parseDimensionScores(mode=code) 无法解析
- `总体评级: A-`、`C+` — 非 A/B/C/D，extractOverallGrade 正则不匹配
- `维度分 92–95`、`各维度 90+` — 区间/概括，缺 `- 维度名: XX/100` 行级格式，解析不到

---

## 审计后动作

审计通过时，请将完整报告保存至调用方在本 prompt 中指定的 reportPath。implement 阶段的 reportPath 通常为 `_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md` 或 `AUDIT_Story_{epic}-{story}_stage4.md`。并在结论中注明保存路径及 iteration_count，以便主 Agent / 宿主调用 runAuditorHost。

