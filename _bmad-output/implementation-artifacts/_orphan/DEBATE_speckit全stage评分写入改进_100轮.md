# DEBATE：speckit 全 stage 评分写入改进（100 轮）

**Facilitator**：Party-Mode 多角色辩论  
**议题**：规范 speckit 子任务审计报告落盘与 parse-and-write-score 调用；补齐 Story 9.3 speckit 评分（可选）  
**角色**：批判审计员（主发言人，>70%）、Winston（架构师）、Amelia（开发）、John（产品）  
**收敛条件**：单一方案共识 + 最后 3 轮无新 gap + 批判审计员终审陈述

---

## §1 议题与背景

### 1.1 议题一：规范 speckit 子任务

**现状**：speckit-workflow SKILL 已在 §1.2、§2.2、§3.2、§4.2、§5.2 各阶段定义「审计通过后评分写入触发」：报告落盘约定路径 + 调用 `npx ts-node scripts/parse-and-write-score.ts`。但**子 Agent 执行审计时的 prompt 中未必显式写明**：(1) 审计通过后须将报告保存至约定路径；(2) 主 Agent 或子 Agent 须调用 parse-and-write-score。导致模型可能忽略该步骤。

**目标**：在 speckit 各阶段（spec/plan/GAPS/tasks/implement）审计 prompt 或子任务编排中，**明确要求**审计通过后将报告保存至约定路径，并触发 parse-and-write-score（或由主 Agent 在收到通过结论后调用）。

### 1.2 议题二：补齐 Story 9.3 的 speckit 评分（可选）

**现状**：Story 9.3 已有 spec/plan/GAPS/tasks 文档（`specs/epic-9/story-3-epic-dashboard-aggregate/`），但**无** speckit 约定路径的审计报告：`AUDIT_spec-E9-S3.md`、`AUDIT_plan-E9-S3.md`、`AUDIT_GAPS-E9-S3.md`、`AUDIT_tasks-E9-S3.md`。implement 阶段存在 `AUDIT_Story_9-3_stage4*.md`（BMAD 命名），但 speckit §5.2 约定为 `AUDIT_implement-E9-S3.md`。仪表盘 Epic 聚合时，E9.S3 的 spec/plan/GAPS/tasks 阶段评分可能缺失。

**目标**：可选地从现有文档重新生成各 stage 审计报告，落盘至约定路径，再对每个 stage 补跑 parse-and-write-score。

### 1.3 约定路径（speckit-workflow）

| stage | 报告路径 |
|-------|----------|
| spec | `specs/epic-{epic}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md` |
| plan | `specs/epic-{epic}/story-{story}-{slug}/AUDIT_plan-E{epic}-S{story}.md` |
| GAPS | `specs/epic-{epic}/story-{story}-{slug}/AUDIT_GAPS-E{epic}-S{story}.md` |
| tasks | `specs/epic-{epic}/story-{story}-{slug}/AUDIT_tasks-E{epic}-S{story}.md` |
| implement | `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{epic}-{story}-*/AUDIT_implement-E{epic}-S{story}.md` 或 `AUDIT_Story_{epic}-{story}_stage4.md` |

---

## §2 辩论过程（100 轮摘要）

**说明**：每轮批判审计员首先发言；共 100 轮，其中 71+ 轮以批判审计员为主发言人。以下为代表性轮次摘要，收敛于最后 3 轮无新 gap。

### 轮次 1–15：议题一范围与可操作性

**[轮 1] 批判审计员**：议题一的关键问题是「prompt 中明确要求」的具体载体。audit-prompts.md 已有可解析块要求，但**未**写明「审计通过后请将报告保存至 `specs/epic-{epic}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md`」。若子 Agent 仅收到 audit-prompts 内容，可能不知道落盘路径。需在何处补充？  
**Winston**：应在 audit-prompts.md 各 § 末尾，或 bmad-story-assistant/speckit-workflow 调用子 Agent 时的 prompt 模板中，显式加入「审计通过后请将报告保存至 {path}」及「主 Agent 将据此调用 parse-and-write-score」。  
**批判审计员**：若两处都加，会重复；若仅一处，另一处调用的 Agent 可能看不到。需确定**单一权威来源**。

**[轮 2] 批判审计员**：GAP：audit-prompts.md 被 code-reviewer 和 mcp_task generalPurpose 共用。code-reviewer 的 prompt 可能来自 Cursor Task 配置，而非直接读 audit-prompts。若在 audit-prompts 加落盘要求，code-reviewer 能收到吗？  
**Amelia**：需检查 `.cursor/agents/code-reviewer.md` 或 `.claude/agents/code-reviewer.md` 是否引用 audit-prompts；若引用，追加内容应会被加载。  
**批判审计员**：需验证。若未引用，则 audit-prompts 的追加可能无效。

**[轮 3–5] 批判审计员**：迭代：落盘路径应含 epic、story、slug 占位符。BMAD 流程时主 Agent 已知 epic/story；standalone 时可能无。需约定：BMAD 时路径由主 Agent 传入子 Agent；standalone 时用 `specs/{index}-{name}/AUDIT_spec.md` 等。  
**John**：Story 9.3 补齐场景是 BMAD，可先聚焦 BMAD 路径。  
**批判审计员**：同意，standalone 可 deferred。

**[轮 6–10] 批判审计员**：parse-and-write-score 调用方是谁？speckit-workflow §1.2 写「运行 parse-and-write-score」，未写明是主 Agent 还是子 Agent。若子 Agent 执行，需配置权限；若主 Agent，需从子 Agent 输出解析 reportPath。  
**Winston**：bmad-story-assistant 约定为主 Agent 在收到通过结论后调用，reportPath 从约定路径或子任务输出解析。子 Agent 负责落盘；主 Agent 负责调用。职责清晰。  
**批判审计员**：若子 Agent 未落盘，主 Agent 如何发现？需「子 Agent 输出中明确返回 reportPath」作为契约。

**[轮 11–15] 批判审计员**：收敛方向：在 audit-prompts.md 各 §（§1–§5）末尾追加「审计通过后请将报告保存至 {路径模板}，并在结论中注明 reportPath」；bmad-story-assistant / speckit-workflow 的 prompt 模板中，对子 Agent 明确写出「审计通过后必须将报告保存至上述路径」。双保险。  
**Amelia**：路径模板中的 epic/story 需由调用方注入。  
**批判审计员**：是，prompt 模板应为「请保存至 specs/epic-9/story-3-epic-dashboard-aggregate/AUDIT_spec-E9-S3.md」（当 epic=9, story=3 时），由主 Agent 在发起子任务时填充。

### 轮次 16–30：议题二可行性与边界

**[轮 16] 批判审计员**：议题二「从现有文档重新生成审计报告」有可操作性 gap。重新生成 = 重新执行 code-review 审计？还是基于已有报告重命名/复制？  
**Winston**：若 Story 9.3 从未对 spec/plan/GAPS/tasks 执行过 speckit 审计，则需**重新执行**审计；若 BMAD stage2 审计内容等同于 plan 审计，可考虑映射/复制。  
**批判审计员**：BMAD stage2 对应 plan，stage4 对应 implement。但 BMAD 报告命名是 `AUDIT_Story_9-3_stage2.md`，speckit 约定是 `AUDIT_plan-E9-S3.md`。两者格式、结论是否一致？若 stage2 报告已含可解析块，复制并重命名是否足够？

**[轮 17–20] 批判审计员**：需检查 stage2 报告是否按 audit-prompts §2 执行、是否含 plan 的逐条覆盖。若 stage2 是 bmad 的 plan 审计而非 speckit 的 plan 审计，prompt 可能不同。  
**Amelia**：查阅 bmad-story-assistant，stage2 审计依据是 story 文档与 plan，与 speckit §2 plan 审计有重叠但可能不完全相同。  
**批判审计员**：若不同，则「复制 stage2→AUDIT_plan-E9-S3」可能不符合 speckit 语义。最安全做法是对 spec/plan/GAPS/tasks 各执行一次**完整 speckit 审计**，产出新报告。

**[轮 21–25] 批判审计员**：成本：4 个 stage × 每 stage 可能多轮审计 = 较高成本。可选 = 用户决策。共识：议题二作为**可选任务**，在任务列表中单独列出，用户可选择执行或跳过。  
**John**：若用户关心仪表盘 Epic 聚合下 E9.S3 各 stage 评分完整性，可执行；否则可跳过。  
**批判审计员**：同意。

**[轮 26–30] 批判审计员**：implement 阶段：现有 `AUDIT_Story_9-3_stage4.md`。parse-and-write-score 的 --reportPath 可接受任意路径；call_mapping 中 implement_audit_pass 对应 stage=implement。若报告已含可解析块，用 stage4 报告路径调用 parse-and-write-score 即可，不强制重命名为 AUDIT_implement-E9-S3。  
**Winston**：路径约定主要用于「新产出一致性」；历史报告用 --reportPath 指定即可。  
**批判审计员**：任务列表中可写「可选：对 Story 9.3 的 stage4 报告补跑 parse-and-write-score（若尚未写入）」，不强制重命名。

### 轮次 31–50：prompt 修改点具体化

**[轮 31] 批判审计员**：回到议题一。audit-prompts.md 的 §1 提示词已很长，追加落盘要求可能超出 context。是否拆成「审计执行提示」+「审计后动作提示」两段？  
**Amelia**：可在 §1 末尾加一句：「审计通过时，请将完整报告保存至 specs/epic-{epic}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md，路径由调用方注入。」  
**批判审计员**：audit-prompts 是通用模板，{epic}、{story} 在注入时才有。故 audit-prompts 应写「请将报告保存至调用方提供的 reportPath，通常为 specs/epic-N/story-M-{slug}/AUDIT_spec-EN-SM.md」。

**[轮 32–35] 批判审计员**：GAP：audit-prompts 本身无「调用方」概念；它被主 Agent 复制到子 Agent prompt 时，主 Agent 才注入路径。故**修改点应在 bmad-story-assistant 与 speckit-workflow 中「发起审计子任务时的 prompt 模板」**，而非 audit-prompts 本体。audit-prompts 可加一句「审计通过时须将报告保存至调用方指定的路径」；具体路径由 prompt 模板注入。  
**Winston**：支持。audit-prompts 加通用一句；具体路径在各技能发起子任务时注入。  
**批判审计员**：需确认 speckit-workflow 是否有「发起审计子任务」的显式步骤，还是由 bmad-story-assistant 统一编排。若 speckit 作为 standalone 使用，可能不经过 bmad-story-assistant，此时 speckit-workflow 自身须有 prompt 模板。

**[轮 36–40] 批判审计员**：speckit-workflow §0 写「必须按 §0 约定调用 code-review 技能」，未给出 prompt 模板全文。实际调用由执行 Agent 完成。故**修改点**应为：(1) speckit-workflow 各 §x.2 的「审计通过后评分写入触发」段落中，增加「子 Agent prompt 必须包含：审计通过后请将报告保存至 {路径}」的明确要求；(2) 在 audit-prompts.md 或 speckit-workflow references 中增加「审计后动作」标准段落，供复制。  
**Amelia**：可新增 `audit-post-actions.md` 或在 audit-prompts 末增加 §6「审计后动作（强制）」，统一写明落盘 + parse-and-write-score 触发。  
**批判审计员**：避免新增文件，直接在 audit-prompts 各 § 末尾加 1–2 行更简单。

**[轮 41–45] 批判审计员**：实现细节：audit-prompts §1 末尾加「【审计后动作】审计通过时，请将完整报告保存至调用方在 prompt中指定的 reportPath（格式通常为 specs/epic-N/story-M-{slug}/AUDIT_spec-EN-SM.md），并明确在结论中注明保存路径，以便主 Agent 调用 parse-and-write-score。」  
**John**：可接受。§2–§5 同理，仅路径前缀不同（AUDIT_plan-、AUDIT_GAPS-、AUDIT_tasks-、implement 阶段在 _bmad-output）。  
**批判审计员**：implement 阶段路径在 _bmad-output，与 spec 目录不同，需单独说明。

**[轮 46–50] 批判审计员**：迭代：§5 的 implement 阶段，报告路径为 `_bmad-output/implementation-artifacts/epic-{epic}-*/story-{story}-*/AUDIT_implement-E{epic}-S{story}.md`。当前部分项目使用 `AUDIT_Story_{epic}-{story}_stage4.md`（BMAD 命名）。需约定：两者是否均接受？  
**Winston**：parse-and-write-score 的 --reportPath 可为任意路径；call_mapping 不依赖文件名。建议**新产出**统一为 AUDIT_implement-E{epic}-S{story}.md；历史报告可保持 stage4 命名，补跑时用现路径即可。  
**批判审计员**：共识：规范新产出用 AUDIT_implement-E{epic}-S{story}.md；历史兼容 stage4。

### 轮次 51–70：iteration-count 与失败处理

**[轮 51] 批判审计员**：parse-and-write-score 必须含 --iteration-count。子 Agent 执行多轮审计时，主 Agent 如何获知「本 stage fail 轮数」？  
**Amelia**：子 Agent 在通过结论中可注明「本 stage 审计共 N 轮，其中通过前 fail 了 M 轮」；或主 Agent 在发起下一轮前自行累计。  
**批判审计员**：若子 Agent 未注明，主 Agent 需自行累计。prompt 中应要求子 Agent 在通过时输出「iteration_count: M」。

**[轮 52–55] 批判审计员**：scoring_write_control.enabled 和 config 检查：若 enabled=false，是否跳过 parse-and-write-score？  
**Winston**：speckit-workflow §1.2 写「读 config/scoring-trigger-modes.yaml 的 scoring_write_control.enabled；若 enabled 则...」。即 enabled=false 时跳过调用。  
**批判审计员**：任务列表中不需改 config，仅需在 prompt/流程中体现「若 enabled 则调用」。

**[轮 56–60] 批判审计员**：失败 non_blocking：调用失败时记录 resultCode，不阻断流程。已写入 speckit-workflow。需确保子 Agent 或主 Agent 的「审计证据」中能记录 resultCode。  
**John**：主 Agent 在调用后捕获异常，将 resultCode 写入审计证据或 progress。  
**批判审计员**：可接受。

**[轮 61–65] 批判审计员**：eval_question 与 question_version：若 scenario=eval_question 且缺 question_version，不调用。子 Agent 通常不设 scenario，主 Agent 从 context 推断。此逻辑在主 Agent 侧，prompt 中可不展开。  
**Amelia**：同意。

**[轮 66–70] 批判审计员**：任务列表完整性检查：议题一需改动的文件——(1) audit-prompts.md 各 § 末尾；(2) speckit-workflow SKILL 各 §x.2「审计通过后评分写入触发」段落，补充「子任务 prompt 须包含落盘路径与 iteration_count 输出要求」；(3) bmad-story-assistant 中 speckit 嵌套调用的 prompt 模板。议题二为可选任务集合。  
**Winston**：bmad-story-assistant 已有「各 stage 审计通过后落盘与 parseAndWriteScore 约束」，可能已部分覆盖。需比对。  
**批判审计员**：比对后若已有，则任务为「强化」或「显式化」而非从零添加。

### 轮次 71–85：与现有约定的对齐

**[轮 71] 批判审计员**：查阅 bmad-story-assistant SKILL：已有「审计通过后请将报告保存至 `_bmad-output/.../AUDIT_Story_{epic}-{story}_stage2.md`」等。说明 bmad 的 stage2/4 有落盘要求。但 speckit 的 spec/plan/GAPS/tasks 是 bmad 嵌套触发的子流程，其审计可能由 speckit-workflow 或 bmad 编排。需厘清：spec 审计由谁发起？  
**Amelia**：bmad Dev Story 阶段会触发 speckit 全流程；spec 审计是 speckit §1.2，由执行 Dev Story 的 Agent 发起。  
**批判审计员**：故当 bmad 嵌套 speckit 时，发起 spec 审计的是「当前 Agent」，可能是主 Agent 或子 Agent。若为子 Agent，其 prompt 须来自 bmad-story-assistant 或 speckit-workflow 的约定。

**[轮 72–75] 批判审计员**：speckit-workflow §1.2 已写「将本阶段审计报告落盘至 specs/epic-{epic}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md」。这是技能文档中的要求，但执行 Agent 可能不按此执行。需在**可执行的 prompt** 中明确，即子 Agent 收到的 prompt 必须包含此句。  
**Winston**：任务应是：在 speckit-workflow 或 bmad-story-assistant 的「发起 code-review 审计」的 prompt 模板中，显式加入「审计通过后请将报告保存至 {具体路径}」。  
**批判审计员**：需定位该 prompt 模板的物理位置。

**[轮 76–80] 批判审计员**：GAP：code-reviewer 可能是 Cursor Task，其 prompt 在 .cursor/commands 或 agents 中。若使用 mcp_task generalPurpose，prompt 由主 Agent 动态组织。主 Agent 组织 prompt 时，应包含「审计通过后请将报告保存至 X」；该要求可从 speckit-workflow 或 bmad-story-assistant 的文档中复制。故**任务**为：确保两技能的文档中该段落足够显式、可复制，且注明「此段必须包含在发给子 Agent 的 prompt 中」。  
**John**：可接受。

**[轮 81–85] 批判审计员**：任务粒度细化。T1：audit-prompts §1–§5 各末尾加「【审计后动作】审计通过时，请将完整报告保存至调用方指定的 reportPath（调用方会在本 prompt 中提供），并在结论中注明保存路径及 iteration_count（本 stage 审计未通过轮数，0 表示一次通过），以便主 Agent 调用 parse-and-write-score。」  
**Amelia**：§5 implement 的 reportPath 可能在 _bmad-output，需在 §5 单独注明。  
**批判审计员**：§5 加「reportPath 通常为 _bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md 或 AUDIT_Story_{epic}-{story}_stage4.md」。

### 轮次 86–98：最后 gap 收敛

**[轮 86] 批判审计员**：检查是否有遗漏：standalone speckit 流程，无 bmad 时，谁负责注入 reportPath？  
**Winston**：standalone 时，执行 speckit 的 Agent 即主 Agent，可自行在 prompt 中写入路径。若通过 Cursor Task 调用 code-reviewer，Task 的 prompt 需支持参数注入。  
**批判审计员**：deferred：standalone 参数注入机制可后续增强，本任务集聚焦 BMAD 嵌套流程。

**[轮 87–90] 批判审计员**：Story 9.3 补齐的可选任务：T2a 对 spec 执行 speckit §1 审计，产出 AUDIT_spec-E9-S3.md；T2b 对 plan 执行 §2 审计，产出 AUDIT_plan-E9-S3.md；T2c 对 GAPS 执行 §3 审计，产出 AUDIT_GAPS-E9-S3.md；T2d 对 tasks 执行 §4 审计，产出 AUDIT_tasks-E9-S3.md；T2e 对 stage4 报告补跑 parse-and-write-score（若尚未写入）。每步通过后调用 parse-and-write-score。  
**John**：T2a–T2d 是重新审计，成本高；若用户仅想补齐评分，可只做 T2e（利用现有 stage4 报告）。  
**批判审计员**：T2 可拆为 T2-optional-full（T2a–T2e 全做）与 T2-optional-implement-only（仅 T2e）。用户可选。

**[轮 91–94] 批判审计员**：无新 gap。重申共识：议题一通过 prompt/文档强化落盘与 parse-and-write-score 触发；议题二为可选补齐任务。

**[轮 95–97] 批判审计员**：最后 3 轮确认：轮 95、96、97 无人提出新 gap。满足收敛条件 (2)。

**[轮 98–100] 批判审计员终审陈述**：

**轮 98**：本人作为批判审计员做终审陈述。**同意**本辩论形成的方案，条件如下：  
(1) 议题一任务必须包含 audit-prompts 与 speckit-workflow/bmad-story-assistant 的 prompt 模板强化，确保落盘路径与 iteration_count 在可执行 prompt 中显式出现；  
(2) 议题二为可选，且建议拆为 full 与 implement-only 两种粒度供用户选择；  
(3) **Deferred gaps**：standalone speckit 的 reportPath 参数注入机制、AUDIT_implement 与 AUDIT_Story_stage4 双命名兼容性的长期统一，可后续迭代。

**轮 99**：Winston、Amelia、John 简短附议，无补充。

**轮 100**：Facilitator 宣布辩论收敛，产出最终任务列表。

---

## §3 共识方案（§2 辩论收敛结论）

### 3.1 议题一：规范 speckit 子任务

1. **audit-prompts.md**：在 §1、§2、§3、§4、§5 各节末尾追加「【审计后动作】」段落，要求审计通过时将报告保存至调用方指定的 reportPath，并在结论中注明保存路径及 iteration_count，以便主 Agent 调用 parse-and-write-score。§5 单独注明 implement 阶段路径在 _bmad-output。

2. **speckit-workflow**：在各 §x.2「审计通过后评分写入触发」段落中，补充明确要求：发起审计子任务时，**发给子 Agent 的 prompt 必须包含**「审计通过后请将报告保存至 {约定路径}」，路径由主 Agent 根据 epic/story/slug 填充。

3. **bmad-story-assistant**：在 speckit 嵌套流程中，发起 spec/plan/GAPS/tasks 审计时，prompt 模板须包含落盘路径与 iteration_count 输出要求；与 speckit-workflow 约定一致。

4. **implement 报告命名**：新产出建议统一为 `AUDIT_implement-E{epic}-S{story}.md`；历史 `AUDIT_Story_{epic}-{story}_stage4.md` 保持兼容，补跑时可直接用现路径。

### 3.2 议题二：补齐 Story 9.3 评分（可选）

- **可选任务 T2-optional-full**：对 Story 9.3 的 spec/plan/GAPS/tasks 各执行一次 speckit 审计，产出 AUDIT_spec-E9-S3.md、AUDIT_plan-E9-S3.md、AUDIT_GAPS-E9-S3.md、AUDIT_tasks-E9-S3.md，并对各 stage 及 implement 调用 parse-and-write-score。  
- **可选任务 T2-optional-implement-only**：仅对现有 `AUDIT_Story_9-3_stage4.md`（或最后通过的 round 报告）补跑 parse-and-write-score，若尚未写入。  

用户可根据仪表盘需求选择执行或跳过。

---

## §4 最终任务列表（T1–T6）

| ID | 描述 | 验收标准 | 责任人建议 |
|----|------|----------|------------|
| **T1** | 在 audit-prompts.md §1、§2、§3、§4 各节末尾追加【审计后动作】段落 | 每节末尾含「审计通过时，请将完整报告保存至调用方指定的 reportPath…并在结论中注明保存路径及 iteration_count」；复制后可直接粘贴到子 Agent prompt | 主 Agent / 文档维护 |
| **T2** | 在 audit-prompts.md §5 末尾追加【审计后动作】段落（含 implement 路径说明） | §5 注明 implement 的 reportPath 通常为 `_bmad-output/.../AUDIT_implement-E{epic}-S{story}.md` 或 `AUDIT_Story_{epic}-{story}_stage4.md` | 主 Agent / 文档维护 |
| **T3** | 在 speckit-workflow SKILL §1.2、§2.2、§3.2、§4.2、§5.2 各「审计通过后评分写入触发」段落中，补充「prompt 须包含落盘路径」的明确要求 | 每段含「发起审计子任务时，发给子 Agent 的 prompt 必须包含：审计通过后请将报告保存至 {路径}，路径由主 Agent 根据 epic/story/slug 填充」 | 主 Agent / 技能维护 |
| **T4** | 在 bmad-story-assistant SKILL 中，强化 speckit 嵌套流程的审计 prompt 模板 | 发起 spec/plan/GAPS/tasks 审计时，prompt 模板显式包含落盘路径与 iteration_count 输出要求；与 speckit-workflow 约定一致 | 主 Agent / 技能维护 |
| **T5** | （可选）Story 9.3 全 stage 补齐：对 spec/plan/GAPS/tasks 各执行 speckit 审计，产出约定路径报告并调用 parse-and-write-score | 产出 AUDIT_spec-E9-S3.md、AUDIT_plan-E9-S3.md、AUDIT_GAPS-E9-S3.md、AUDIT_tasks-E9-S3.md；每 stage 通过后运行 parse-and-write-score；仪表盘可查 E9.S3 各 stage 评分 | 用户选择后执行 |
| **T6** | （可选）Story 9.3 implement-only 补齐：对现有 stage4 报告补跑 parse-and-write-score | 以 `AUDIT_Story_9-3_stage4.md` 或最后通过的 round 报告为 --reportPath，执行 parse-and-write-score；若已写入则跳过；scoring 存储中 E9.S3 implement 有记录 | 用户选择后执行 |

### 任务依赖与顺序

- T1、T2 可并行；T3、T4 依赖 T1/T2 的段落文案，可复用其表述。  
- T5、T6 为可选，无前置依赖。  
- 建议顺序：T1 → T2 → T3 → T4；T5/T6 按需。

### Deferred Gaps（后续迭代）

- standalone speckit 的 reportPath 参数注入机制（Cursor Task 或等价方式的参数化支持）；  
- AUDIT_implement 与 AUDIT_Story_stage4 的长期命名统一策略。
