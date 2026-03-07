# DEBATE：Implement 阶段可解析评分块四维度完整性

**议题**：如何让 implement 阶段审计报告在可解析评分块中同时包含四个维度（功能性、代码质量、测试覆盖、安全性），并使仪表盘不再显示「无数据」。

**日期**：2026-03-06  
**轮次**：100 轮  
**收敛条件**：最后 3 轮无新 gap  
**批判审计员发言占比**：>70%

---

## 议题背景

- Epic 9 仪表盘中 implement 阶段仅 E9.S2 有记录，且 `dimension_scores` 仅含「功能性」「安全性」两维，「代码质量」「测试覆盖」始终为「无数据」。
- `scoring/data/dev-e9-s2-implement-*.json` 中 `dimension_scores` 仅 2 项。
- 根因：audit-prompts.md §5 引用 §4.1 的可解析块（需求完整性、可测试性、一致性、可追溯性），但 implement 阶段使用 mode=code，解析器与仪表盘期望 功能性、代码质量、测试覆盖、安全性；维度不一致且 prompt 未强制输出 code 四维。
- 需确认：当前实现是否已确保所有 stage 自动写入评分，无需手工补数据。

---

## 轮次 1–20：根因与维度错配

**[轮 1] 批判审计员**：implement 阶段 dimension_scores 缺「代码质量」「测试覆盖」的根因是什么？parseDimensionScores 按 mode=code 从 code-reviewer-config 读取 功能性、代码质量、测试覆盖、安全性；若报告未输出这四行，解析器无法凭空补全。需追溯：是谁产出了 implement 审计报告？报告可解析块实际输出了什么？  
**Amelia 开发**：dev-e9-s2-implement 对应的审计报告若存在，可查其可解析块。parseDimensionScores 仅提取 `- 维度名: XX/100` 且 dimension 须在 config 的 weights 中；缺则跳过。  
**批判审计员**：结论：根因 = 报告未输出「代码质量」「测试覆盖」两行。需查 audit-prompts §5 是否明确要求输出 code 四维。

**[轮 2] 批判审计员**：audit-prompts §5 写「报告结尾必须包含 §4.1 规定的可解析评分块」。§4.1 定义的是 需求完整性、可测试性、一致性、可追溯性。implement 对应 stageToMode=code，code 模式 dimensions 是 功能性、代码质量、测试覆盖、安全性。两套维度不同，存在错配。  
**Winston 架构师**：确认。spec/plan/tasks 用 prd 维度，implement 用 code 维度。§5 引用 §4.1 是错误的；implement 应引用独立的「implement 可解析块」规范。  
**批判审计员**：GAP-1：§5 未定义 implement 专用可解析块；引用 §4.1 导致模型可能输出 prd 四维，解析器按 code 匹配则全部或部分失配，dimension_scores 不完整。

**[轮 3] 批判审计员**：若模型输出 需求完整性: 90/100，parseDimensionScores(mode=code) 会怎样？  
**Amelia 开发**：code 的 weights 无「需求完整性」；`weights.get(dimension)` 为 undefined，该行被跳过，不加入 results。  
**批判审计员**：即 dimension 名须与 code-reviewer-config modes.code.dimensions 的 name 完全一致。当前 §5 未明确这四个 name，模型可能自由发挥或沿用 §4.1，导致漏维。

**[轮 4] 批判审计员**：audit-prompts-code.md 存在吗？code-reviewer-config 引用 audit-prompts-code.md。  
**Amelia 开发**：检索结果：audit-prompts-code.md 不存在。code 模式可能回退到 audit-prompts §5 或其它逻辑。  
**批判审计员**：GAP-2：audit-prompts-code.md 缺失，code 模式 prompt 来源不明确；若用 §5，则继承 §4.1 维度错配问题。

**[轮 5] 批判审计员**：实现路径一「调整 prompt 要求输出四维」：应在哪处改？audit-prompts.md §5 还是新建 audit-prompts-code.md？  
**Winston 架构师**：优先在 audit-prompts.md 增加 §5.1「Implement 阶段可解析评分块（强制）」，明确四维：功能性、代码质量、测试覆盖、安全性；§5 正文改为引用 §5.1 而非 §4.1。这样 speckit-workflow 直接传 §5 时，模型能看到完整规范。  
**批判审计员**：若新建 audit-prompts-code.md，需确保 code-reviewer 在 code 模式下加载它；当前 config 引用但文件不存在，实施时要么创建该文件，要么改 §5。建议双管齐下：§5 增加 §5.1 + 可选创建 audit-prompts-code.md 引用 §5.1。

**[轮 6] 批判审计员**：实现路径二「修改 config 确保四维被要求」：code-reviewer-config 的 modes.code.dimensions 已有四维。config 不直接控制 prompt 文本；prompt 须显式写出「必须输出 - 功能性: XX/100」等。config 提供权重，parseDimensionScores 用于匹配；若报告没有对应行，config 无济于事。  
**John 产品经理**：结论：config 已正确，问题在 prompt 未强制输出四行。路径二单独不足以解决问题，须配合 prompt 修改。

**[轮 7] 批判审计员**：parseDimensionScores 是否应对缺失维度做 fallback（如补 0 或 phase_score）？  
**Amelia 开发**：当前实现无 fallback；报告有什么就解析什么。若补 0，可能扭曲真实得分；若用 phase_score 均分，语义不明。更稳妥的是从源头保证报告输出四维。  
**批判审计员**：不在解析器做 fallback，避免掩盖问题；修复 prompt 是正道。

**[轮 8] 批判审计员**：手工补数据问题。用户问「是否不再需要手工后续再为所有 stage 补数据」。  
**Winston 架构师**：若 prompt 修复后，新产生的 implement 审计报告将包含四维，parse-and-write-score 写入完整 dimension_scores，无需手工补。但**历史**已写入的记录（如 dev-e9-s2-implement）无法自动修复，除非重新跑审计并重写。  
**批判审计员**：任务列表需区分：(1) 修复 prompt/config，确保今后 implement 审计产出四维；(2) 历史记录是否补跑/补数据作为可选任务，由用户决策。

**[轮 9] 批判审计员**：所有 stage 的自动写入。spec/plan/GAPS/tasks 已按 speckit-workflow 各 §x.2 的「审计通过后评分写入触发」由主 Agent 调用 parse-and-write-score。implement 亦然。若主 Agent 在 implement 通过后正确调用，且 reportPath 存在，则不应漏写。漏维是报告内容问题，不是调用时机问题。  
**Amelia 开发**：对。当前流程已约定 implement 通过后主 Agent 调用；问题在报告可解析块不完整，导致写入的 dimension_scores 不完整。

**[轮 10] 批判审计员**：收敛方向 1：在 audit-prompts.md 新增 §5.1，定义 implement 专用可解析块，四维为 功能性、代码质量、测试覆盖、安全性；§5 正文将「§4.1」改为「§5.1（implement 阶段）」。这样 spec/plan/tasks 继续用 §4.1，implement 用 §5.1，维度一致。

**[轮 11] 批判审计员**：§5.1 应怎么写？需要与 §4.1 类似的完整结构：标题、维度列表、禁止用描述代替、反例。  
**Winston 架构师**：可仿照 §4.1，替换维度名即可。示例：
```markdown
### §5.1 Implement 阶段可解析评分块（强制）
implement 阶段审计报告必须在结尾包含以下可解析块，与 code-reviewer-config modes.code.dimensions 一致：
总体评级: [A|B|C|D]
维度评分:
- 功能性: XX/100
- 代码质量: XX/100
- 测试覆盖: XX/100
- 安全性: XX/100
```

**[轮 12] 批判审计员**：§5 正文中已写「四行 - 维度名: XX/100」，但未枚举具体维度名。模型可能输出任意维度。必须在 §5 或 §5.1 中**显式列出**四个维度名，禁止模糊。

**[轮 13] 批判审计员**：audit-prompts-code.md 是否必须创建？若 code-reviewer 通过 Cursor Task 调度且按 mode=code 加载 prompt，会从 config 的 prompt_template 解析。若 audit-prompts-code.md 不存在，根据 GAP-076 会回退到 speckit-workflow/references/。该目录无 audit-prompts-code.md，则可能找不到文件。为稳妥，建议创建 audit-prompts-code.md，内容引用或包含 §5 全文 + §5.1 可解析块，与 config 对齐。  
**Amelia 开发**：若 speckit-workflow 发起 implement 审计时，是直接复制 audit-prompts §5 到子任务 prompt，则不需要 audit-prompts-code.md；子任务收到的已是完整 §5。需要确认 speckit 的 implement 审计调用方式。  
**批判审计员**：两种路径：(1) 仅改 audit-prompts §5+§5.1，speckit 传 §5 即生效；(2) 同时建 audit-prompts-code.md 供 code-reviewer mode=code 使用。任务列表可列两项，实施时若 (1) 已覆盖 speckit 调用路径则 (2) 可降级为可选。

**[轮 14] 批判审计员**：维度名必须与 code-reviewer-config 完全一致。config 中为「功能性」「代码质量」「测试覆盖」「安全性」（无空格、无简写）。§5.1 须一字不差。

**[轮 15] 批判审计员**：反例与禁止词。§4.1 有反例（如「可解析评分块（总体评级 A，维度分 92–95）」）；§5.1 也需补充，禁止用描述代替、禁止 A-、C+、禁止区间概括。可简短引用「同 §4.1 禁止用描述代替结构化块」。

**[轮 16] 批判审计员**：仪表盘 getDimensionScores 的 fallbackDims 为 ['功能性','代码质量','测试覆盖','安全性']。当 records 的 dimension_scores 缺某维时，该维显示「无数据」。修复后，新记录的 dimension_scores 应含四维，不再「无数据」。无需改 compute.ts。

**[轮 17] 批判审计员**：parse-and-write 的 dimension-parser 与 stageToMode。stage=implement 已映射 mode=code，config 的 code dimensions 正确。修改点仅在 prompt，解析器与 config 无需改动。  
**Winston 架构师**：同意。

**[轮 18] 批判审计员**：验收标准。如何验证修复有效？应对一份 implement 审计报告（或 mock）运行 parse-and-write-score，断言 dimension_scores 长度为 4 且四个 dimension 名正确。  
**Amelia 开发**：parse-and-write 的测试已有类似断言；可增加一 fixture 或集成测试，使用含四维可解析块的报告，验证写入的 dimension_scores 完整。

**[轮 19] 批判审计员**：历史数据补跑。若用户希望对 Epic 9 等已有 implement 记录重新获得四维数据，可 (1) 对原审计报告若仍存在且可改，手工补四维块后重跑 parse-and-write-score；(2) 重新执行 implement 审计，产出新报告再写入。任务列表将「历史 implement 记录补跑」列为可选，用户决策。

**[轮 20] 批判审计员**：小结。根因明确：§5 引用 §4.1，维度与 implement 的 code mode 不符；prompt 未强制输出 code 四维。实现路径：在 audit-prompts.md 新增 §5.1，定义 implement 可解析块四维；§5 引用 §5.1。可选：创建 audit-prompts-code.md。解析器与 config 保持不变。

---

## 轮次 21–50：实现细节与边界

**[轮 21] 批判审计员**：§5 正文中「四行 - 维度名: XX/100」是否足够？若改为「四行，依次为 - 功能性: XX/100、- 代码质量: XX/100、- 测试覆盖: XX/100、- 安全性: XX/100」则更明确。  
**Winston 架构师**：支持。显式枚举可减少模型歧义。

**[轮 22] 批判审计员**：权重是否需在 prompt 中写？解析器从 config 读权重，报告只需 维度名: 分数/100。不在 prompt 写权重，避免冗余。

**[轮 23] 批判审计员**：dimension-parser 的 DIMENSION_SCORE_PATTERN 支持「- 维度名: XX/100」和「维度名: XX/100」等变体。四个维度名必须精确匹配 config 的 name，包括中文全角冒号与半角。  
**Amelia 开发**：正则 `[：:]` 匹配全角与半角冒号；维度名 trim 后与 config 的 map key 匹配。确保 config 中为「功能性」等即可。

**[轮 24] 批判审计员**：若模型输出「代码质量: 85/100」和「代码 质量: 85/100」（有空格），后者可能不匹配。config 中为「代码质量」无空格。prompt 应明确「维度名须与 config/code-reviewer-config.yaml modes.code.dimensions 的 name 完全一致」，并列出四个 name。  
**Winston 架构师**：在 §5.1 中写清四维名称即可，模型通常不会自行加空格。

**[轮 25] 批判审计员**：批判审计员附录与 §5。audit-prompts-critical-auditor-appendix 要求报告含「批判审计员结论」段落。§5 已引用该附录。§5.1 仅定义可解析块，不影响批判审计员段落。两者可并存。

**[轮 26] 批判审计员**：bmad-story-assistant 阶段四实施后审计。该审计使用 audit-prompts §5 还是独立 prompt？若用 §5，则修复 §5.1 后，实施后审计产出的报告也会含四维。需确认 bmad-story-assistant 的 stage4 审计 prompt 来源。  
**Amelia 开发**：bmad-story-assistant 阶段四引用 audit-prompts §5；修复后 stage4 报告同样受益。

**[轮 27] 批判审计员**：standalone speckit（无 epic/story）的 implement 审计。若 run 时无 epic/story，parse-and-write-score 的 stage 仍为 implement，stageToMode 仍为 code，解析逻辑一致。§5.1 的修改对所有 implement 审计通用。

**[轮 28] 批判审计员**：文档同步。audit-prompts 修改后，是否需同步更新 docs/BMAD/审计报告格式与解析约定.md？  
**Winston 架构师**：若该文档有 implement 可解析块描述，应更新为与 §5.1 一致；否则可注明「implement 见 audit-prompts §5.1」。

**[轮 29] 批判审计员**：config/code-reviewer-config.yaml 与 .cursor/agents/code-reviewer-config.yaml。项目中有两份？  
**Amelia 开发**：存在 config/ 与 .cursor/agents/ 下的 code-reviewer-config；内容应一致或 .cursor 为 Cursor 专用。dimension-parser 默认读 config/code-reviewer-config.yaml。两处 dimensions 需保持一致。  
**批判审计员**：任务列表不强制改 config，仅改 prompt；config 已正确。

**[轮 30] 批判审计员**：迭代审计时的可解析块。若 implement 审计多轮（round1 fail, round2 pass），pass 的报告须含四维。fail 的报告若也含可解析块，可用于 iteration_records；但 Story 9.4 的 iterationReportPaths 解析失败轮时，dimension_scores 可选。为一致性，建议所有 implement 报告（含 fail 轮）均输出四维可解析块，便于解析。

**[轮 31] 批判审计员**：GAP-3：当前 §5 是否被 code-reviewer Cursor Task 使用？若 Cursor 通过 code-reviewer-config 的 prompt_template 加载 audit-prompts-code.md，而该文件不存在，则实际加载逻辑不明。任务列表中增加「验证：implement 审计实际使用的 prompt 包含 §5.1 可解析块要求」，确保修改落地。

**[轮 32] 批判审计员**：speckit-workflow SKILL.md §5.2 中「审计通过后评分写入触发」的 prompt 模板。该模板是否显式包含「审计通过后请将报告保存至…」及可解析块要求？若模板引用 audit-prompts §5，则 §5 的修改会自动传递。需确认 workflow 的 prompt 组装方式。  
**Winston 架构师**：speckit-workflow 通常将 audit-prompts 对应章节作为 prompt 传入；§5 修改会传递。为保险，在 workflow 的 implement 审计描述中可加一句「须输出 §5.1 规定的可解析块」。

**[轮 33] 批判审计员**：测试策略。除集成测试外，是否需单元测试？dimension-parser 已有对 mode=code 的解析逻辑；可增加针对「含四维可解析块的 implement 报告」的 unit test，断言返回 4 个 DimensionScore 且 dimension 名为预期。  
**Amelia 开发**：parse-and-write 或 dimension-parser 的 __tests__ 中可加。任务列表列为验收项。

**[轮 34] 批判审计员**：回归风险。修改 §5 后，已有通过 implement 审计的流程会否受影响？仅是「增加要求」，不会放宽；若原报告已含四维，无影响；若原报告缺维，修改后模型会被要求补全。属正向修改，回归风险低。

**[轮 35] 批判审计员**：多语言与编码。可解析块使用中文维度名，与 config 一致。无需多语言支持。

**[轮 36] 批判审计员**：与 BUGFIX_可解析评分块禁止描述代替结构化块 的关系。该 BUGFIX 已禁止用描述代替结构化块。§5.1 的「禁止用描述代替」与之一致，可在 §5.1 中简短引用。

**[轮 37] 批判审计员**：收敛检查 1。当前共识：在 audit-prompts.md 新增 §5.1，定义 implement 四维可解析块；§5 引用 §5.1 替代 §4.1；可选创建 audit-prompts-code.md；验收包含单元/集成测试。是否还有遗漏？  
**Winston 架构师**：需在任务列表中明确「§5 正文中将「§4.1」改为「§5.1（implement 阶段）」时的精确替换范围」，避免误改 spec/plan/tasks 的引用。

**[轮 38] 批判审计员**：§5 原文为「报告结尾必须包含 §4.1 规定的可解析评分块」。若直接改为「§5.1」，则 implement 专用。但 §5 是 implement 的提示词，不会用于 spec/plan/tasks；故改为 §5.1 无误。spec/plan 的 §1–§4 各自引用 §4.1，不受影响。

**[轮 39] 批判审计员**：维度分与 checks 的映射。code-reviewer-config 的 dimensions 有 checks 数组（如「命名规范」「代码复杂度」）。这些是否需在 prompt 中体现？可解析块仅需 维度名: 分数/100；checks 供审计员评估时参考，不强制出现在可解析块。  
**John 产品经理**：对。可解析块是结果输出，checks 是过程指导。§5.1 只规定输出格式。

**[轮 40] 批判审计员**：reportPath 约定。implement 的 reportPath 可为 AUDIT_implement-E{epic}-S{story}.md 或 AUDIT_Story_{epic}-{story}_stage4.md。parse-and-write-score 接受任意路径，不依赖文件名。无需因 §5.1 修改 reportPath 约定。

**[轮 41] 批判审计员**：Dashboard 与 coach。修复后 dimension_scores 完整，dashboard 的 getDimensionScores、getEpicDimensionScores 会正确聚合，coach 诊断也会获得完整四维。无需改 dashboard 或 coach 逻辑。

**[轮 42] 批判审计员**：GAP-4：若某次 implement 审计的结论为「未通过」，报告是否仍须含可解析块？当前约定是「审计通过时」落盘并触发 parse-and-write-score。未通过时可能不落盘，或落盘但不触发写入。若未通过的报告也落盘（如 round1 fail），且后续补跑时读取，则未通过报告若有可解析块可被解析。为统一，建议所有 implement 审计报告（无论通过与否）均输出 §5.1 块，便于 future 复用。

**[轮 43] 批判审计员**：迭代计数与 dimension_scores。iteration_count 与 dimension_scores 独立；修复不改变 iteration_count 逻辑。  
**Amelia 开发**：确认。

**[轮 44] 批判审计员**：文档查找。docs/BMAD/审计报告格式与解析约定.md 中若提到 implement 或 code 模式维度，需与 §5.1 一致。任务列表增加「检查并更新审计报告格式文档中 implement 可解析块描述」。

**[轮 45] 批判审计员**：code-reviewer-config 的 prompt_template 路径。若创建 audit-prompts-code.md，应放在 config 同级或 SKILLS_ROOT/speckit-workflow/references/。按 GAP-076，(1) config 目录先；(2) 否则 references/。references 在 skills 下，可放 audit-prompts-code.md。  
**Winston 架构师**：创建 `skills/speckit-workflow/references/audit-prompts-code.md`，内容包含 §5 全文 + §5.1 块，或直接引用 audit-prompts.md §5。避免重复维护。

**[轮 46] 批判审计员**：若 audit-prompts-code.md 仅写「implement 审计请使用 audit-prompts.md §5，并确保可解析块符合 §5.1」，则 config 的 prompt_template 指向该文件时，code-reviewer 需能解析「使用 §5」的引用。若 code-reviewer 简单加载文件内容，可能不会自动展开 §5。更稳妥的是 audit-prompts-code.md 内嵌 §5 全文与 §5.1，避免跨文件引用导致的加载失败。  
**Amelia 开发**：采纳。audit-prompts-code.md 可复制 §5 全文并替换可解析块为 §5.1 内容，自包含。

**[轮 47] 批判审计员**：维护负担。若 audit-prompts-code.md 复制 §5 全文，未来 §5 其它部分更新时需同步。可选方案：audit-prompts-code.md 仅含 implement 专用部分，开头写「本文件为 audit-prompts.md §5 的 implement 专用变体，可解析块见下文 §5.1」。这样 §5 主体变更时，若不影响 implement 专用部分，code 文件可少改。  
**Winston 架构师**：折中：audit-prompts-code.md 包含完整 implement 审计提示词（即 §5 等效内容），其中可解析块部分明确写四维。与 audit-prompts §5 保持语义一致，允许文字有少量差异便于自包含。

**[轮 48] 批判审计员**：任务优先级。T1：修改 audit-prompts §5+§5.1（核心）；T2：验证 implement 审计 prompt 包含 §5.1；T3：创建 audit-prompts-code.md（可选，若 code-reviewer 独立调用）；T4：单元/集成测试；T5：更新文档；T6：历史补跑（可选，用户决策）。  
**John 产品经理**：同意。

**[轮 49] 批判审计员**：验收标准 AC-1：使用修改后 prompt 对一 implement 场景执行审计（或使用 mock 报告），运行 parse-and-write-score，断言 dimension_scores 长度为 4 且四维名称正确。AC-2：dashboard 对含完整 dimension_scores 的 implement 记录，四维均非「无数据」。AC-3：audit-prompts §5.1 存在且与 code-reviewer-config modes.code.dimensions 维度名一致。

**[轮 50] 批判审计员**：手工补数据闭环。用户问「当前实现是否已确保不需手工补数据」。结论：**当前未确保**。修复后，**新** implement 审计将自动产出四维，无需手工补；**历史**记录需单独决策是否补跑。在任务列表的「交付说明」中写清此点。

---

## 轮次 51–80：任务细化与收敛

**[轮 51] 批判审计员**：T1 的精确修改点。audit-prompts.md 第 80–89 行为 §5。需在第 80 行前插入 §5.1，并将第 86 行附近「§4.1」改为「§5.1」。  
**Amelia 开发**：具体行号以实际文件为准；任务描述写「在 §5 标题后、可解析块引用前，插入 §5.1 小节；将 §5 正文中对 §4.1 的引用改为 §5.1」。

**[轮 52] 批判审计员**：§5.1 的完整模板。需包含：标题、说明（implement 与 code mode 一致）、四维枚举、禁止用描述、总体评级 A/B/C/D、反例（可选，引用 §4.1）。  
**Winston 架构师**：模板见轮 11，补充禁止条款即可。

**[轮 53] 批判审计员**：映射建议表。§4.1 有「逐条对照结论→建议评级→建议各维度分」表。§5.1 是否需类似表？implement 审计的结论通常为通过/未通过，可简化。可加简短映射：完全覆盖→A/90+；部分问题→B/80+；需修改→C/70+；不通过→D/60及以下。与 §4.1 一致。

**[轮 54] 批判审计员**：speckit-workflow SKILL.md 的 implement 审计描述。当前写「审计通过后请将报告保存至…」；是否需加「且报告须含 §5.1 规定的可解析块（功能性、代码质量、测试覆盖、安全性四维）」？  
**Amelia 开发**：若 prompt 已含 §5 全文，§5 内已有 §5.1 引用，则 workflow 无需重复。为双保险可加一句，不增加理解负担。  
**批判审计员**：任务列表 T2 为「验证 implement 审计 prompt 包含 §5.1 要求」；若验证时发现 workflow 的 prompt 组装未包含 §5 全文，则需修正 workflow。T2 覆盖此点。

**[轮 55] 批判审计员**：bmad-story-assistant 阶段四。其实施后审计用 audit-prompts §5。修改 §5 后，bmad-story-assistant 技能中若硬编码了 §5 的拷贝，需同步更新；若通过引用 skills/speckit-workflow/references/audit-prompts 加载，则自动生效。  
**Winston 架构师**：bmad-story-assistant 通常引用 audit-prompts，不硬编码；修改会传递。任务 T2 验证时包含 stage4 路径即可。

**[轮 56] 批判审计员**：code-reviewer 的 mode 传入。当 Cursor Task 调度 code-reviewer 做 implement 审计时，是否传入 mode=code？若传入，code-reviewer 从 config 读 prompt_template=audit-prompts-code.md。若该文件不存在，行为未定义。创建 audit-prompts-code.md 可消除此不确定性。故 T3「创建 audit-prompts-code.md」建议设为**推荐**而非可选。  
**John 产品经理**：采纳。T3 从可选改为推荐，实施者应完成，除非验证确认 code 模式从不被使用。

**[轮 57] 批判审计员**：T3 创建后，config 的 prompt_template 指向 audit-prompts-code.md，路径解析按 GAP-076。config 在 config/ 或 .cursor/agents/，prompt_template 相对 config 目录则 config/code-reviewer-config.yaml 旁应有 audit-prompts-code.md，或回退到 references/。references 在 skills 下，路径可能为 skills/speckit-workflow/references/audit-prompts-code.md。需确认 Cursor 的 code-reviewer 如何解析路径。  
**Amelia 开发**：GAP-076 写「(1) 相对于 config 文件所在目录；(2) 若不存在则 SKILLS_ROOT/speckit-workflow/references/」。config 在 config/ 时，config/audit-prompts-code.md 可放项目内；或放在 references 供 skills 加载。项目内 config/ 旁通常不放 prompt 文件，放 references 更合理。创建 skills/speckit-workflow/references/audit-prompts-code.md。  
**批判审计员**：若 skills 为全局 ~/.cursor/skills，则 SKILLS_ROOT 可能指向该处；项目内 skills/ 是否被识别取决于 Cursor 配置。任务描述写「在 speckit-workflow references 目录创建 audit-prompts-code.md」，与 audit-prompts.md 同目录。

**[轮 58] 批判审计员**：dimension-parser 的 stageToMode 中 implement 已映射 code。无需改。parseAndWriteScore 调用 parseDimensionScores(content, stageToMode(stage))，stage=implement 时 mode=code，正确。  
**Winston 架构师**：确认。

**[轮 59] 批判审计员**：run_score schema 的 dimension_scores 结构。当前已有 dimension、weight、score。解析器输出与 schema 一致。无需改 schema。  
**Amelia 开发**：确认。

**[轮 60] 批判审计员**：T4 测试。dimension-parser 或 parse-and-write 的测试中，新增用例：content 含「- 功能性: 85/100\n- 代码质量: 78/100\n- 测试覆盖: 82/100\n- 安全性: 90/100」，stage=implement，断言 dimension_scores 为 4 项且 dimension 名正确。  
**Amelia 开发**：parse-and-write 的 __tests__ 中可能有类似用例；需添加或增强。任务 T4 明确验收：单测或集成测断言 dimension_scores 四维完整。

**[轮 61] 批判审计员**：T5 文档更新。检查 docs/BMAD/审计报告格式与解析约定.md、仪表盘健康度说明等，若提及 implement 可解析块，更新为与 §5.1 一致。若无提及，可加一节「Implement 阶段可解析块见 audit-prompts §5.1」。  
**John 产品经理**：同意。

**[轮 62] 批判审计员**：T6 历史补跑。可选任务，描述为「若需对既有 implement 记录补全四维，可 (1) 对仍有报告文件的重新运行 parse-and-write-score（若报告可手工补四维块）；(2) 重新执行 implement 审计产出新报告后写入。由用户决策执行范围。」  
**Winston 架构师**：采纳。

**[轮 63] 批判审计员**：任务列表的禁止词。不得使用「可选」「可考虑」「后续」等；T6 的「可选」指用户决策是否执行，非任务描述模糊。T1–T5 为必做，T6 为可选的独立任务。

**[轮 64] 批判审计员**：依赖关系。T1 为 T2、T3、T4 的前置；T2 验证 T1 落地；T3 依赖 T1 的 §5.1 内容；T4 依赖 T1；T5 依赖 T1。T6 无依赖。顺序：T1 → T2、T3、T4、T5 可并行；T6 最后。

**[轮 65] 批判审计员**：验收门禁。所有任务完成后，运行一次完整 implement 审计流程（可用现有 Story 或 mock），从审计到 parse-and-write-score 到 dashboard，确认四维非「无数据」。作为端到端验收。  
**Amelia 开发**：可作为 T4 的集成部分或单独 T7。  
**批判审计员**：并入 T4 的验收标准，不单独建 T7。

**[轮 66] 批判审计员**：回滚方案。若修改后发现问题，回滚 audit-prompts 的 §5.1 及 §5 引用即可；audit-prompts-code.md 可删。config 未改，无回滚负担。  
**Winston 架构师**：同意。

**[轮 67] 批判审计员**：国际化。当前无需求，可忽略。  
**John 产品经理**：确认。

**[轮 68] 批判审计员**：安全与权限。修改仅涉及文档与配置，无安全影响。  
**Amelia 开发**：确认。

**[轮 69] 批判审计员**：性能。无性能敏感改动。  
**批判审计员**：确认。

**[轮 70] 批判审计员**：与 Epic 9 的关联。本议题为解决 Epic 9 仪表盘 implement 四维「无数据」而提出；修复后 Epic 9 的**新** implement 审计将受益。既有 E9.S2 记录需 T6 补跑（若用户选择）。

**[轮 71] 批判审计员**：speckit-workflow 的引用路径。audit-prompts 在 skills/speckit-workflow/references/audit-prompts.md。若项目内也有副本（如 docs/ 下），需确认修改哪个。主副本应为 skills 下的，项目内可能为子模块或拷贝。  
**Winston 架构师**：按 workspace path，skills 可能在 d:\Dev\BMAD-Speckit-SDD-Flow\skills\。修改 d:\Dev\BMAD-Speckit-SDD-Flow\skills\speckit-workflow\references\audit-prompts.md。  
**批判审计员**：任务 T1 路径明确为 `skills/speckit-workflow/references/audit-prompts.md`。

**[轮 72] 批判审计员**：critic 审计员与 party-mode 收敛。本 DEBATE 的收敛条件为最后 3 轮无新 gap。当前轮次 72，需再 28 轮达 100，且最后 3 轮（98、99、100）无新 gap。继续进行。

**[轮 73] 批判审计员**：GAP-5：若 model 在 §5.1 明确要求下仍漏维（如只输出 3 维），parseDimensionScores 会返回 3 项，dimension_scores 不完整。是否在解析后做校验？  
**Amelia 开发**：可在 parse-and-write 中，当 stage=implement 且 dimension_scores 数量<4 时，记录警告或 resultCode（如 DIMENSION_SCORES_INCOMPLETE），但不阻断写入。这样可观测问题，不丢失已有数据。  
**批判审计员**：可选增强。任务列表不强制，可列在「后续改进」；当前以 prompt 修复为主。

**[轮 74] 批判审计员**：权重之和。code 模式四维权重 30+30+20+20=100。parseDimensionScores 用 config 权重，无需在可解析块写权重。  
**Winston 架构师**：确认。

**[轮 75] 批判审计员**：phase_score 与 dimension_scores 的关系。当 dimension_scores 非空时，phase_score 可由加权计算覆盖。现有逻辑已处理。修复不改 phase_score 计算。  
**Amelia 开发**：确认。

**[轮 76] 批判审计员**：eval_question 场景。scenario=eval_question 时，implement 审计是否存在？通常 eval 为批量评测，stage 可能不同。若存在 implement 的 eval，§5.1 同样适用。  
**John 产品经理**：eval 场景的 implement 若用同一 prompt，修改通用生效。

**[轮 77] 批判审计员**：多 Story 并行审计。多个 Story 同时执行 implement 审计时，各自产报告、各自 parse-and-write-score，无交互。修改无影响。  
**Winston 架构师**：确认。

**[轮 78] 批判审计员**：agent-manifest 与 party-mode。本 DEBATE 为 party-mode 产出，不涉及 agent-manifest 修改。  
**批判审计员**：确认。

**[轮 79] 批判审计员**：最终任务列表结构。采用 TASKS 文档标准格式：任务 ID、描述、验收标准、依赖。禁止词检查通过。  
**Amelia 开发**：按 TASKS_*.md 模板生成。

**[轮 80] 批判审计员**：收敛检查 2。任务列表已细化完成。进入最后 20 轮，聚焦查漏与终审。

---

## 轮次 81–97：查漏与终审

**[轮 81–90] 批判审计员**（连续）：逐项核查：T1 修改范围无遗漏；T2 验证路径覆盖 speckit 与 bmad-story-assistant；T3 创建文件路径正确；T4 测试覆盖单测与集成；T5 文档清单完整；T6 可选描述清晰。未发现新 gap。  
**Winston 架构师**：同意。  
**Amelia 开发**：同意。  
**John 产品经理**：同意。

**[轮 91] 批判审计员**：config 的 code mode dimensions 的 name 与 §5.1 的字符串完全一致。再次核对：功能性、代码质量、测试覆盖、安全性。无简繁体混用，无额外空格。  
**Amelia 开发**：config 中已确认，一致。  
**批判审计员**：无新 gap。

**[轮 92] 批判审计员**：audit-prompts 的 §4.1 是否被 §1–§4 引用？若是，改为 §5.1 会破坏 spec/plan/tasks。确认：§5 改为引用 §5.1，§1–§4 继续引用 §4.1。§4.1 与 §5.1 并存，互不替换。  
**Winston 架构师**：确认。修改仅限 §5 段落内，§4.1 不动。  
**批判审计员**：无新 gap。

**[轮 93] 批判审计员**：audit-prompts-code.md 与 audit-prompts §5 的关系。若 code 文件为 §5 的 implement 专用变体，需在文件头注释说明，避免未来维护者困惑。  
**Amelia 开发**：在 audit-prompts-code.md 开头加注释：「本文件为 implement 阶段（执行 tasks 后）审计提示词，对应 audit-prompts.md §5；可解析块见 §5.1，四维与 code-reviewer-config modes.code 一致。」  
**批判审计员**：采纳，无新 gap。

**[轮 94] 批判审计员**：实施后审计（stage4）与 speckit implement 审计（stage5）的关系。bmad-story-assistant 阶段四对应「实施后审计」，通常用 audit-prompts §5；speckit §5.2 的 implement 审计也用 §5。两者为同一 prompt 来源。修改 §5 后两者均受益。  
**John 产品经理**：确认。  
**批判审计员**：无新 gap。

**[轮 95] 批判审计员**：仪表盘「无数据」的判定逻辑。getDimensionScores 当某维无 score 时返回「无数据」。修复后新记录的 dimension_scores 含四维，有 score，则不再「无数据」。逻辑正确，无需改 compute。  
**批判审计员**：无新 gap。

**[轮 96] 批判审计员**：DEBATE 产出物。本 DEBATE 产出：(1) 本文档；(2) TASKS_implement四维度可解析块.md。审计子任务将对 TASKS 进行 §5 审计。  
**Winston 架构师**：同意。  
**批判审计员**：无新 gap。

**[轮 97] 批判审计员**：终审前最后检查。任务列表是否含「禁止词」？检查：无「可选」用于必做任务、无「后续」、无「待定」。T6 标注为「用户决策的可选任务」符合规范。  
**Amelia 开发**：将按要求生成任务列表时避免禁止词。  
**批判审计员**：无新 gap。

---

## 轮次 98–100：收敛（最后 3 轮无新 gap）

**[轮 98] 批判审计员**：本轮无新 gap。共识已稳固：§5.1 新增、§5 引用、可选/推荐 audit-prompts-code.md、验收与文档更新、历史补跑可选。任务列表结构明确。  
**Winston 架构师**：同意，无补充。  
**Amelia 开发**：同意，无补充。  
**John 产品经理**：同意，无补充。

**[轮 99] 批判审计员**：本轮无新 gap。所有议题已覆盖，任务列表可直接进入实施。  
**Winston 架构师**：同意。  
**Amelia 开发**：同意。  
**John 产品经理**：同意。

**[轮 100] 批判审计员**：本轮无新 gap。收敛条件满足：最后 3 轮（98、99、100）均无新 gap。DEBATE 结束，产出最终任务列表。  
**Winston 架构师**：终审同意。  
**Amelia 开发**：终审同意。  
**John 产品经理**：终审同意。  
**BMad Master**：讨论收敛，生成 TASKS_implement四维度可解析块.md，并进入审计子任务流程。

---

## §5 最终任务列表

| ID | 描述 | 验收标准 | 依赖 |
|----|------|----------|------|
| T1 | 在 `skills/speckit-workflow/references/audit-prompts.md` 中新增 §5.1「Implement 阶段可解析评分块（强制）」，定义四维：功能性、代码质量、测试覆盖、安全性；将 §5 正文中对「§4.1」的引用改为「§5.1」；§5.1 须包含：总体评级 A/B/C/D、四行 `- 维度名: XX/100`（维度名与 code-reviewer-config modes.code.dimensions 完全一致）、禁止用描述代替、反例（可引用 §4.1） | ① §5.1 存在且四维名为 功能性、代码质量、测试覆盖、安全性；② §5 引用 §5.1；③ §4.1 未被误改 | - |
| T2 | 验证 implement 审计实际使用的 prompt 包含 §5.1 可解析块要求；覆盖 speckit-workflow §5.2 的 implement 审计与 bmad-story-assistant 阶段四实施后审计两条路径；若 prompt 组装未包含 §5 全文或 §5.1，修正对应 workflow 描述或 prompt 模板 | ① 两条路径的 prompt 均可追溯到 §5.1 要求；② 必要时已修正 workflow | T1 |
| T3 | 在 `skills/speckit-workflow/references/` 创建 `audit-prompts-code.md`，内容为 implement 阶段审计提示词（等效 audit-prompts §5），可解析块部分明确为 §5.1 四维格式；文件头注释说明与 audit-prompts §5 及 code-reviewer-config 的对应关系 | ① 文件存在；② 可解析块含四维；③ 与 config modes.code 一致 | T1 |
| T4 | 新增或增强 dimension-parser / parse-and-write 的单元或集成测试：对含「- 功能性: XX/100、- 代码质量: XX/100、- 测试覆盖: XX/100、- 安全性: XX/100」的 implement 报告内容运行解析，断言 dimension_scores 长度为 4 且四维名称正确；可选：端到端运行一次 implement 审计→parse-and-write-score→dashboard，验证四维非「无数据」 | ① 单测或集成测通过；② 断言 dimension_scores 四维完整 | T1 |
| T5 | 检查并更新 `docs/BMAD/审计报告格式与解析约定.md`（及仪表盘健康度说明等）中若有 implement 可解析块描述，使其与 §5.1 一致；若无则增加「Implement 阶段可解析块见 audit-prompts §5.1」的引用 | ① 文档与 §5.1 一致或已引用 | T1 |
| T6 | （可选，用户决策）若需对既有 implement 记录补全四维，可 (1) 对仍有报告文件的记录，在报告末手工补四维可解析块后重新运行 parse-and-write-score；或 (2) 重新执行 implement 审计产出新报告后写入。由用户指定补跑范围 | 用户明确指定时执行；否则跳过 | - |

**交付说明**：  
- 修复后，**新**产生的 implement 审计报告将自动包含四维可解析块，parse-and-write-score 写入完整 dimension_scores，仪表盘四维不再显示「无数据」，**无需手工补数据**。  
- **历史**已写入的记录（如 dev-e9-s2-implement）需通过 T6 补跑（若用户选择）才能获得四维数据。  
- 当前实现**未**确保不需手工补数据；本修复确保**今后**不需要。

---

## 批判审计员终审

**已检查维度**：根因明确、维度错配、prompt 修改点、config 一致性、解析器行为、fallback 必要性、历史补跑、文档同步、测试策略、验收标准、依赖关系、回滚方案。

**每维度结论**：均已覆盖，无遗漏。

**本轮结论**：本轮无新 gap。DEBATE 收敛，任务列表可交付实施与审计。
