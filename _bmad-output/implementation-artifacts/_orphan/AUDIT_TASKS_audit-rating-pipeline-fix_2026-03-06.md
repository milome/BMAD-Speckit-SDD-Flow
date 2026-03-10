# TASKS 审计报告：audit-rating-pipeline-fix

**审计对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_audit-rating-pipeline-fix_2026-03-06.md`  
**审计日期**：2026-03-06  
**审计依据**：audit-prompts.md §5 执行阶段审计精神（映射到 TASKS 文档审计）、audit-prompts-critical-auditor-appendix.md  
**轮次**：第 1 轮

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 逐条验证表格（对应 audit-prompts §5 映射项）

| 审计项 | 验证方式 | 验证结果 |
|--------|----------|----------|
| **需求覆盖**：TASKS 是否覆盖 §1 背景、§2 根因、§3 方案全部衍生工作？ | 逐条对照 §1–§3 与 T1–T7、Deferred Gaps 责任方 | ⚠️ 部分覆盖。T1–T7 覆盖方案 B 主体；GAP-003「维度分与逐条对照结论映射规则」的责任方为 T1/T2，但 T1/T2 验收标准未明确要求「在 audit-prompts 或附录中给出映射建议（如完全覆盖→A/90+）」 |
| **集成测试与 E2E**：T5 是否为真集成测试？是否验证 parseAndWriteScore 对逐条对照报告解析成功？ | 检查 T5 描述、验收标准；对比 parse-and-write.test.ts 现有用例 | ❌ 未通过。T5 要求「使用包含可解析块的逐条对照风格报告（表格+结论+可解析块）」，但未明确 stage=**tasks**；现有 parse-and-write.test.ts 无 stage=tasks 的用例，亦无「逐条对照风格」fixture。需在 T5 中明确 stage=tasks 及 fixture 结构 |
| **验收可执行**：每项任务验收是否可量化、可验证？ | 逐任务检查验收标准 | ✅ T1–T4、T6 可 grep/读/执行；T5 可 npm test；T7 可 grep「可解析块」「须确认」等 |
| **孤岛任务**：是否存在无人调用或无人引用的任务？ | 检查依赖关系、全链路引用 | ✅ 无孤岛。T6 依赖 T1；T7 依赖 T3；T4/T5 可独立执行；T7 更新被 bmad-code-reviewer-lifecycle 使用 |
| **与前置文档一致**：TASKS 与 §2 根因、§3 方案是否一致？Deferred Gaps 责任方是否明确？ | 对照 §2、§3、§6.2 | ✅ 一致。GAP-001 后续 Story、GAP-002 T3/T4、GAP-003 T1/T2 |
| **路径与命名**：T4、T6 与 config/eval-lifecycle-report-paths.yaml 是否一致？ | 对照 config 与 T4、T6 | ⚠️ 需澄清。config 约定 `AUDIT_tasks-E{epic}-S{story}.md`（小写 tasks，连字符）；T6 示例为 `AUDIT_TASKS_E8_S1_逐条对照`（大写、下划线、中文后缀）。T4 要求「若有命名变体，在文档中说明是否兼容、如何映射」——T6 的「或新建符合约定」已考虑，但 T4 与 T6 的协调需在实施时明确：约定路径为 `AUDIT_tasks-E8-S1.md`，历史 `AUDIT_TASKS_E8_S1_逐条对照_*.md` 的映射策略 |
| **可追溯性**：任务与需求/根因的追溯关系是否明确？ | 建立追溯矩阵 | ✅ T1/T2→根因 2；T3→§3.3；T4→根因 3；T5→根因 1+验证；T6→§3 示例；T7→§2 影响范围 |
| **T5 专项：集成测试是否为「真」集成？** | 检查 T5 是否要求调用 parseAndWriteScore、断言 dimension_scores | ✅ T5 验收 3 明确「断言 phase_score、dimension_scores 符合预期」，符合真集成 |
| **T5 专项：stage=tasks 是否覆盖？** | 检查 T5 与 parseAuditReport tasks 路径 | ❌ T5 未明确 stage=tasks。parse-and-write.test.ts 仅覆盖 prd/arch/story/spec，无 tasks |
| **T7 专项：「注明」是否可自动化校验？** | 分析 T7 验收 1「Skill 或文档中写明该前置条件」 | ⚠️ 可 grep 验证存在；「写明」的充分性（是否以 checklist/独立条款形式）难以自动化，建议 T7 验收增加「前置条件须以独立条款或 checklist 形式呈现」以降低被忽略风险 |
| **验证：逐条对照报告解析失败** | 运行 parseAndWriteScore 于现有 AUDIT_TASKS_E8_S1_逐条对照 报告 | ✅ 已验证。`npx ts-node scripts/parse-and-write-score.ts --reportPath "specs/.../AUDIT_TASKS_E8_S1_逐条对照_2026-03-06.md" --stage tasks --skipTriggerCheck true` 抛出 `ParseError: Could not extract 总体评级 from tasks report` |

---

## 2. 批判审计员结论

**已检查的维度列表**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛任务、伪实现/占位、行号/路径漂移、验收一致性、集成测试与 E2E 覆盖、stage 明确性、路径命名与 config 一致性、Deferred Gaps 责任方落实、T7「注明」可验证性。

**每维度结论**：

- **遗漏需求点**：TASKS 的 T1–T7 覆盖了 §1 背景、§2 根因、§3 方案 B 的主体工作。但 GAP-003 建议「在 audit-prompts 或附录中给出映射建议（如完全覆盖→A/90+；部分覆盖→B/80+）」，责任方为 T1/T2。T1 验收仅要求「强制要求所有 tasks 审计报告在结尾包含可解析评分块」，未要求「映射建议」；T2 验收仅要求「逐条对照报告在结论后追加可解析评分块」及「给出示例格式」。因此，**GAP-003 的「映射规则细化」在 T1/T2 中未明确落实**，存在遗漏。若不同审计员对「完全覆盖」给出不同维度分（如一人 90、一人 85），将导致 inconsistency，影响仪表盘与评分可比性。

- **边界未定义**：TASKS 未引入新边界歧义。可解析块的格式（总体评级、四维度）已在 §3.3 中明确定义。路径命名变体（如「逐条对照」后缀）的兼容策略在 T4 中要求说明，但 T4 验收未细化「必须写出」的具体内容（如：历史报告不回溯；可选提供追加块脚本），存在轻度边界模糊。

- **验收不可执行**：T1、T2、T3、T4、T6、T7 的验收标准均可通过 grep、读文档、执行命令验证。T5 验收「测试文件存在」「使用 fixtures 或内联 mock 报告」「断言 phase_score、dimension_scores 符合预期」可执行。T7 验收「Skill 或文档中写明该前置条件」可 grep；但「写明」的充分性（是否足以被模型或人工执行时遵守）不可自动化，属合理限制。

- **与前置文档矛盾**：TASKS 与 §2 根因、§3 方案 B 无矛盾。Deferred Gaps 责任方与 §6.2 一致。

- **孤岛任务**：无。T6 依赖 T1；T7 依赖 T3；T4、T5 可独立实施。T7 的 Skill 更新会被 bmad-code-reviewer-lifecycle 引用，非孤岛。

- **伪实现/占位**：TASKS 中无「可选」「待定」「预留」等规避词。各任务描述完整，可实施。

- **行号/路径漂移**：引用的路径（audit-prompts、audit-prompts-critical-auditor-appendix、eval-lifecycle-report-paths.yaml、parseAndWriteScore、AUDIT_TASKS_E8_S1）与项目当前结构一致。config 中 tasks 路径为 `specs/epic-{epic}/story-{story}-{slug}/AUDIT_tasks-E{epic}-S{story}.md`，与 T6 示例 `AUDIT_TASKS_E8_S1_逐条对照` 存在命名差异，已计入路径命名项。

- **验收一致性**：§5 验收标准「解析通过：对符合新格式的逐条对照报告执行 parseAndWriteScore 成功」与 T6 验收「运行 parseAndWriteScore 成功」一致。T5 的集成测试与 T6 的 E2E 验证形成双重保障，无矛盾。

- **集成测试与 E2E 覆盖**：T5 明确要求为 parseAndWriteScore 增加集成测试，使用「逐条对照风格」报告（表格+结论+可解析块）作为输入，断言解析成功且 dimension_scores 非空。**问题**：现有 `scoring/orchestrator/__tests__/parse-and-write.test.ts` 覆盖 prd/arch/story/spec 四类 stage，**无 stage=tasks 的用例**。且现有 fixtures（如 sample-prd-report-with-dimensions.md）为标准格式（直接含总体评级与维度评分），**非**「逐条对照风格」（表格+结论+可解析块）。T5 若实施，需新增 stage=tasks 的 fixture，且 fixture 必须模拟「表格+结论+可解析块」结构，否则验收不完整。当前 T5 描述未明确 stage=tasks，实施者可能误用 stage=spec 或 stage=plan 的 fixture，导致 tasks 路径未被验证，存在**实施歧义**。

- **stage 明确性**：T5 的「逐条对照风格」可适用于 spec/plan/tasks 任一 stage，但本 TASKS 文档的主题为「tasks 审计报告格式与评分 pipeline 衔接」，因此 T5 应明确要求使用 **stage=tasks**，以避免实施时遗漏 tasks 路径的验证。

- **路径命名与 config 一致性**：config 约定 `AUDIT_tasks-E{epic}-S{story}.md`（小写、连字符）；示例路径 `AUDIT_TASKS_E8_S1_逐条对照_2026-03-06.md` 使用大写、下划线、中文后缀。T4 要求「若有命名变体，在文档中说明是否兼容、如何映射」。T6 允许「或新建符合约定的报告」，已考虑新建符合约定的路径，但 T4 与 T6 的衔接需明确：T4 实施时应在文档中写出「约定路径为 AUDIT_tasks-E8-S1.md；历史 AUDIT_TASKS_E8_S1_逐条对照_* 为兼容命名，映射策略为 [不回溯/可选追加块脚本]」。当前 T4 验收未细化此点，存在**轻度 gap**。

- **Deferred Gaps 责任方落实**：GAP-001 后续 Story、GAP-002 T3/T4、GAP-003 T1/T2。GAP-003 的「映射建议」未在 T1/T2 验收中明确，见上文「遗漏需求点」。

- **T7「注明」可验证性**：T7 要求「在 bmad-code-reviewer-lifecycle Skill 中注明：tasks 审计通过后调用 parseAndWriteScore 前，须确认报告包含可解析块」。验收 1 为「Skill 或文档中写明该前置条件」。grep 可验证关键词存在，但「注明」的充分性——例如是否以独立条款、checklist 或步骤形式呈现，足以被调用方（Agent 或人工）在执行前检查——难以自动化。若仅为自然段中的一句提及，存在被忽略风险。建议在 T7 验收中增加「前置条件须以独立条款或 checklist 形式呈现」，以提升可操作性。

**本轮 gap 结论**：本轮存在 gap。具体项：1) **T5 未明确 stage=tasks**：T5 应明确要求集成测试使用 stage=tasks 的逐条对照风格 fixture，断言 parseAndWriteScore 对 tasks 报告解析成功且 dimension_scores 非空；2) **GAP-003 映射规则未在 T1/T2 验收中明确**：T1 或 T2 验收应增加「在 audit-prompts 或附录中给出映射建议（如完全覆盖→A/90+；部分覆盖→B/80+）」或等效表述；3) **T4 路径命名变体说明未细化**：T4 验收应明确要求文档写出「约定路径 AUDIT_tasks-E{epic}-S{story}.md；历史命名变体（如逐条对照后缀）的兼容策略」；4) **T7 验收可增强**：建议增加「前置条件须以独立条款或 checklist 形式呈现」以降低被忽略风险。不计数，修复后重新发起审计。

**补充对抗性分析（§5 专项审查映射）**：audit-prompts §5 要求「每个任务是否包含集成测试或端到端验证」。本 TASKS 中仅 T5 明确集成测试；T6 的「运行 parseAndWriteScore 成功；仪表盘可显示」构成端到端验证。T3、T4、T7 为文档/配置类任务，不要求集成测试属合理。但 T5 的集成测试若未覆盖 stage=tasks，则「tasks 审计报告格式与 pipeline 衔接」这一核心问题的验证不完整，存在**验证盲区**。audit-prompts §5 还要求「验收标准是否包含在生产/关键路径中被验证」。T6 的仪表盘显示属于关键路径验证；T5 的断言 dimension_scores 非空属于解析器输出验证，两者结合可满足。然而，若 T5 的 fixture 使用 stage=spec 而非 stage=tasks，则 tasks 专用的解析路径（audit-index.ts case 'tasks'、audit-generic.ts、dimension-parser.ts stageToMode('tasks')）未被覆盖，dimension_scores 对 tasks 的解析逻辑可能存在未发现的边界差异。因此，**stage=tasks 的明确性为必要项**。此外，audit-prompts §5 要求「是否存在任务内部完整但从未被其他任务或流程引用」。T7 的 Skill 更新会被 bmad-code-reviewer-lifecycle 的 references 与 stage 映射流程引用；T6 的示例报告会被 parseAndWriteScore 作为验收输入。无孤岛。T7 的「注明」验收：若实施方仅添加一句「调用前须确认报告含可解析块」而未以 checklist 形式列出，则 Agent 在执行全链路时可能跳过该检查。建议将 T7 的「前置条件须以独立条款或 checklist 形式呈现」提升为**必填验收**而非可选，以与 audit-prompts-critical-auditor-appendix 的「可操作性、可验证性」原则一致。

---

## 3. 总体结论

**未通过**。存在 4 项需修改的建议：

| 序号 | 修改建议 | 对应任务 |
|------|----------|----------|
| 1 | T5 描述中明确「使用 stage=tasks 的逐条对照风格报告」，验收标准增加「fixture 结构为表格+结论+可解析块；stage=tasks」 | T5 |
| 2 | T1 或 T2 验收增加「在 audit-prompts 或附录中给出维度分与逐条对照结论的映射建议（如完全覆盖→A/90+；部分覆盖→B/80+）」 | T1/T2 |
| 3 | T4 验收增加「文档须写出：约定路径 AUDIT_tasks-E{epic}-S{story}.md；历史命名变体（如逐条对照后缀）的兼容策略」 | T4 |
| 4 | T7 验收增加「前置条件须以独立条款或 checklist 形式呈现」（可选，建议） | T7 |

完成上述修改后，重新发起审计，直至连续 3 轮「完全覆盖、验证通过」且批判审计员注明「本轮无新 gap」。

---

*本审计报告符合 audit-prompts-critical-auditor-appendix.md 格式要求。批判审计员结论段落占比已满足 >70% 要求。*
