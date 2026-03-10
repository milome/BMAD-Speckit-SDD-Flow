# Party-Mode：Context 工程与 AI 评测 100 轮产出

**议题**：分析 BMAD-Speckit-SDD-Flow 在 Context Engineering、子代理、提示词工程化、AI 模型评测四维度的功能、优劣与面试 QA。

**规则**：100 轮、批判审计员占比 >70%、最后 3 轮无新 gap 收敛。

---

## 第 1 轮

**批判性审计员**：先质疑「功能清单禁止遗漏」的可验证性。若我们仅凭探索结果列清单，如何保证不遗漏？需要定义「功能」的边界：是代码实现、文档约定，还是用户可感知能力？建议先明确四维度的功能定义标准，否则后续讨论易发散。

**Winston 架构师**：同意。Context Engineering 维度下，可把「功能」定义为：存在可执行路径（workflow/command/script）且产出可被消费的 artifact。例如 generate-project-context 有 workflow、command，产出 project-context.md，即算一项功能。

**Amelia 开发**：从实现视角，project-context 的 step-02 明确要求「KEEP CONTENT LEAN」，这是 token 优化的显式约束，可计入功能清单。

---

## 第 2 轮

**批判性审计员**：constitution.md 在探索中仅找到 `../workflows/constitution.md` 和 `../templates/memory/constitution.md` 的引用，未确认实际加载路径与调用链。若 constitution 从未被任何 workflow 或 agent 加载，则「存在 constitution」不等于「有功能」。需追溯 constitution 的消费方。

**Mary 分析师**：BMAD 的 constitution 通常作为「宪章/约定阶段」在 .speckit-state.yaml 的 current_phase 中出现，但具体加载逻辑需查 workflow 步骤。

**John 产品经理**：从产品视角，constitution 若未被使用，属于「配置存在但未接入」的 gap，应列入「做得不够好」。

---

## 第 3 轮

**批判性审计员**：.specify/memory 在项目中未找到。若这是设计上的「可选」能力，则功能清单应标注「未实现」而非遗漏。但若文档声称支持 memory 而实际无实现，则是虚假宣称。需核对 speckit-workflow 或 bmad 文档是否承诺过 .specify/memory。

**Winston 架构师**：_bmad 中有 _memory（如 tech-writer-sidecar、storyteller-sidecar），但这是 agent 级 sidecar，非 .specify 级。.specify 通常指 specs 目录下的规范，memory 可能指「规范记忆」或「会话记忆」，目前未见对应实现。

**Amelia 开发**：subprocess-optimization-patterns 有明确文档与 step-08b 验证，属于已实现且可追溯的功能。

---

## 第 4 轮

**批判性审计员**：上下文边界问题：project-context 的「边界」由谁定义？step-01-discover 仅查找 project-context.md 存在性，未定义「应包含哪些模块、排除哪些」。若不同项目规模差异大，同一模板可能导致 token 浪费或信息不足。是否有动态边界策略？

**Mary 分析师**：project-context-template.md 提供的是静态模板，A/P/C 菜单在 step-02 中由模型选择，可视为「人工参与的动态边界」，但非全自动。

**John 产品经理**：token 优化方面，除「lean」外未见显式 token 预算或截断策略，属改进空间。

---

## 第 5 轮

**批判性审计员**：子代理维度：mcp_task 的 generalPurpose/explore/shell 三种类型，与「主 Agent 不得直接修改生产代码」的约束如何协同？若 generalPurpose 内部仍可编辑代码，则「主 Agent 不编辑」只是流程约定，非技术隔离。需明确主 Agent 与子代理的能力边界。

**Winston 架构师**：规则层约定主 Agent 不编辑，实施通过 mcp_task 子代理。子代理在独立进程中运行，理论上可拥有完整编辑能力。边界是「流程约束」而非「权限隔离」。

**Amelia 开发**：code-reviewer 通过 Cursor Task 调度时，与 mcp_task 是不同调用路径。若 Cursor Task 不可用则回退 mcp_task generalPurpose，此时子代理既做实施又做审计，存在角色混合风险。

---

## 第 6 轮

**批判性审计员**：resume 机制依赖 mcp_task 的 resume 参数与 agent ID。若 MCP 服务不支持 resume 或 agent 超时后 ID 失效，则「从 progress 断点继续」无法执行。文档中的「try resume if agent ID exists」是否在代码或配置中有对应实现？还是仅 prompt 层约定？

**Mary 分析师**：bmad-standalone-tasks 的 prompt-templates 中有 resume 模板，但 MCP mcp_task 的 resume 行为由 MCP 服务实现，本项目可能无法控制。

**John 产品经理**：这是「接口依赖」类风险，面试时可作为「与外部系统集成时的边界」讨论点。

---

## 第 7 轮

**批判性审计员**：批判审计员占比 >70% 的规则，在 party-mode 中如何量化？若每轮只有一句「批判性审计员：无异议」，算不算满足？audit-prompts-critical-auditor-appendix 要求批判审计员段落「字数不少于报告其余部分」，即 ≥50%。100 轮中 71 轮需含批判审计员，且篇幅占主导，需可验证的度量方式。

**Winston 架构师**：规则中的「篇幅占主导」可理解为该角色单轮发言字数 > 其他角色之和，或至少与最长发言同量级。可设计简单脚本：解析每轮发言，统计各角色 token/字数，校验占比。

**Amelia 开发**：当前讨论若人工执行，依赖 Facilitator 自觉；若自动化，需结构化输出格式（如每轮 JSON 标注角色与字数）。

---

## 第 8 轮

**批判性审计员**：audit-prompts 的「整段复制禁止概括」约束，在实际执行中如何保证？若模型自行概括，parseAndWriteScore 会因缺少可解析块而失败，但此时用户可能不知道是「复制不完整」导致。是否有前置校验或后置兜底？

**Mary 分析师**：目前依赖 prompt 中的禁止词与格式要求，无独立校验脚本。parse-and-write 解析失败时会返回错误，用户需人工排查。

**John 产品经理**：可增加「审计报告格式预检」步骤，在调用 parseAndWriteScore 前检查是否含可解析块，缺失则提示「请补全可解析块」而非直接解析失败。

---

## 第 9 轮

**批判性审计员**：禁止词表在 bmad-bug-assistant 与 speckit-workflow 中不完全一致。bug 场景禁止「可选、可考虑、后续、待定、酌情、技术债…」，TASKS 禁止「可选、可考虑、后续、待定、酌情、技术债、先实现后续扩展」。若同一文档同时被两套规则审计，可能产生冲突。是否有统一禁止词表？

**Winston 架构师**：两处禁止词针对不同 artifact 类型（BUGFIX vs TASKS），可视为「分场景词表」。但若未来有交叉审计场景，需考虑合并与优先级。

**Amelia 开发**：loadForbiddenWords 在 coach 中有使用，用于诊断时的禁止词校验，与审计禁止词可能是不同用途。

---

## 第 10 轮

**批判性审计员**：scoring 的 parseAndWriteScore 支持 scenario=eval_question 与 real_dev。eval_question 时 question_version 必填，否则记 SCORE_WRITE_INPUT_INVALID。但 question_version 的格式、语义是否在文档中定义？v1、v2 等版本如何与题目内容对应？

**Mary 分析师**：eval-question-generate 支持 --version v1|v2，输出到 scoring/eval-questions/{version}/。question_version 写入 record 用于追溯题目版本，与生成时的 version 对应。

**John 产品经理**：若用户传入非 v1/v2 的版本号，是否有校验？需确认 parse-and-write 的 question_version 校验逻辑。

---

## 第 11 轮

**批判性审计员**：Coach 诊断的 weak_areas 与 weakness_clusters 来源不同：weak_areas 来自 phase_scores 低分阶段，weakness_clusters 来自 clusterWeaknesses 对 check_items 的聚类。若某阶段无 check_items，则不会进入 cluster，但可能进入 weak_areas。两者可能重叠或互补，文档是否说明使用场景？

**Winston 架构师**：CoachDiagnosisReport 同时输出两者，eval-question-generate 会从两者生成题目。weak_areas 偏阶段级，clusters 偏问题模式级，可视为不同粒度。

**Amelia 开发**：cluster-weaknesses 依赖 check_items，若 record 无 check_items 则 cluster 为空。需确认哪些 stage 会写入 check_items。

---

## 第 12 轮

**批判性审计员**：仪表盘 computeHealthScore、getDimensionScores、getWeakTop3 等函数的输入是什么？若 scoring/data 下无数据或 run_id 不存在，是否优雅降级？dashboard-generate 的 CLI 行为需明确。

**Mary 分析师**：compute 层应接收 records 作为输入，由 loader 或调用方提供。无数据时可能返回空或默认值，需看实现。

**John 产品经理**：面试时可问「仪表盘在无数据时的 UX 设计」，考察边界处理。

---

## 第 13 轮

**批判性审计员**：applyTierAndVeto 在 parse-and-write 中的调用时机是「写入前」。veto 规则若判定某 record 不应写入，是否会静默丢弃？用户如何知晓被 veto 的记录？

**Winston 架构师**：veto 模块的接口需查看。若返回「应否决」则 writeScoreRecordSync 可能不调用，需确认是否有日志或返回值告知调用方。

**Amelia 开发**：Story 4.1 描述「在写入前应用 veto 与阶梯系数」，具体行为需看 veto 实现。

---

## 第 14 轮

**批判性审计员**：iterationReportPaths 用于解析失败轮报告并写入 iteration_records。若某轮报告路径无效或内容格式不符，是跳过该条还是整体失败？parseIterationReportToRecord 的异常处理需明确。

**Mary 分析师**：parse-and-write 中 iterationReportPaths 的遍历逻辑需查看，单条失败时是否 try-catch 并继续。

**John 产品经理**：这是鲁棒性问题，属「做得不够好」的候选。

---

## 第 15 轮

**批判性审计员**：STORY-A2-AUDIT 与 BUG-A4-IMPL 的「整段复制」要求，在 skill 文档中如何传递给子代理？若通过 mcp_task 的 prompt 参数传入，是否有长度限制？超长 prompt 可能导致截断。

**Winston 架构师**：MCP mcp_task 的 prompt 长度由 MCP 服务与模型 context 限制决定。整段复制可能使 prompt 很长，需权衡。

**Amelia 开发**：bmad-bug-assistant 规则要求「完整 prompt 模板整段复制」，若模板本身很长，确实存在 token 压力。

---

## 第 16 轮

**批判性审计员**：code-reviewer-config 的 modes（code/prd/arch/pr）与 audit-prompts 的 §1–§5 如何映射？§1–§5 对应 spec/plan/gaps/tasks/implement，code 模式对应 implement。prd/arch/pr 的 prompt 来源是否独立于 audit-prompts？

**Mary 分析师**：code-reviewer-config 通过 prompt 路径解析，可能引用 speckit-workflow/references/ 下的不同文件。需确认 modes 与 stage 的对应关系。

**John 产品经理**：若存在多套审计标准，需在文档中明确「何时用哪种 mode」。

---

## 第 17 轮

**批判性审计员**：sft-extract 的 extractBugfixSections 与 extractAuditReportSections 的 fallback 逻辑：当 extractBugfixSections 返回 null 时用 extractAuditReportSections。若两者都返回空，instruction.length<20 时跳过。跳过时是否有日志？用户如何知道哪些样本被跳过？

**Winston 架构师**：sft-extractor 的实现需查看日志输出。若无日志，属可改进点。

**Amelia 开发**：--threshold、--output 参数控制输出，但跳过逻辑的可见性需确认。

---

## 第 18 轮

**批判性审计员**：eval-question-generate 在 weak_areas 与 weakness_clusters 为空时 exit 0。但「空」可能是 run 不存在，也可能是 run 存在但无短板。两种情况的 exit code 是否应区分？用户脚本中若依赖 exit code 做分支，可能误判。

**Mary 分析师**：当前实现 exit 0 表示「正常完成但无题目生成」，exit 1 表示 run 不存在等错误。若「无短板」也 exit 0，则与「成功生成 0 题」无法区分。

**John 产品经理**：可增加 --strict 模式：无题目时 exit 1，便于 CI 判断「必须有题目」的场景。

---

## 第 19 轮

**批判性审计员**：config/scoring-trigger-modes.yaml 的 call_mapping 与 branch_id 配置，在 §5 审计中必须检查。若项目未配置 scoring-trigger-modes.yaml，审计是否会误报？该文件是否为可选？

**Winston 架构师**：scoring-trigger-modes 用于控制哪些 branch/stage 触发评分写入。若文件不存在，call_mapping 可能为空，branch_id 无法匹配，导致不写入。审计要求「必须检查」，则审计员需确认文件存在且配置正确。

**Amelia 开发**：若文件可选，审计逻辑需区分「未配置」与「配置错误」。

---

## 第 20 轮

**批判性审计员**：GAP-CONV-12 要求批判审计员段落字数占比 ≥50%。校验逻辑可内嵌主 Agent 或独立脚本。当前是否有现成脚本？若没有，该要求是否可执行？

**Mary 分析师**：附录提到「脚本示例：解析报告 markdown，定位段落，计算字数」。但未提供现成脚本路径，属文档级约定，实现可能缺失。

**John 产品经理**：可列入「做得不够好」：格式校验依赖人工或未实现的脚本。

---

## 第 21 轮

**批判性审计员**：subprocess-optimization-patterns 的 Pattern 4「并行执行」与 mcp_task 的并行调用关系？若主 Agent 同时发起多个 mcp_task，是否算 Pattern 4？文档中的「并行」指单次 grep 的多文件并行，还是多子代理并行？

**Winston 架构师**：subprocess-optimization 主要针对「主 Agent 内调用子进程」场景，如 grep、文件分析。mcp_task 是 MCP 协议层的子代理，可能在不同进程/机器。两者是不同层次的并行。

**Amelia 开发**：dispatching-parallel-agents skill 支持并行派发，与 mcp_task 可结合，但非 subprocess-optimization 文档直接覆盖。

---

## 第 22 轮

**批判性审计员**：project-context 的 A/P/C 菜单在 step-02 中，用户选 C（Continue）才保存。若用户误选 A（Abort）或 P（Pause），已生成内容是否丢弃？是否有确认机制？

**Mary 分析师**：workflow 步骤描述的是交互逻辑，具体实现依赖执行环境。若为 Cursor/Claude 交互，可能无持久化 Abort 状态。

**John 产品经理**：从 UX 角度，Abort 前应有确认，避免误操作丢失工作。

---

## 第 23 轮

**批判性审计员**：bmad-standalone-tasks 要求「批判审计员 >50%」和「3 rounds no-gap」，而 party-mode 要求「>70%」和「最后 3 轮无新 gap」。两处收敛条件不一致，是否刻意？standalone-tasks 的 3 轮与 party-mode 的 100 轮如何协调？

**Winston 架构师**：standalone-tasks 针对「实施后审计」场景，可能用 code-reviewer 做 3 轮审计。party-mode 是「决策/根因讨论」场景，100 轮为深度辩论。两者场景不同，收敛条件可不同。

**Amelia 开发**：但若 standalone-tasks 内部调用 party-mode，则需统一收敛定义，否则可能冲突。

---

## 第 24 轮

**批判性审计员**：parseAndWriteScore 的 stage 与 mode 映射：stageToMode 将 spec/plan/gaps/tasks 映射到文档类 mode，implement 映射到 code mode。若新增 stage（如 retro），是否需扩展 stageToMode？扩展点是否文档化？

**Mary 分析师**：parsers 中的 stageToMode 是硬编码映射，新增 stage 需改代码。属可扩展性 gap。

**John 产品经理**：可考虑配置化 stage→mode 映射，便于扩展。

---

## 第 25 轮

**批判性审计员**：source_hash、base_commit_hash、content_hash 在 parse-and-write 中的用途是版本追溯。若 skipAutoHash 为 true（测试用），则这些字段可能为空。生产调用时是否应禁止 skipAutoHash？是否有校验？

**Winston 架构师**：skipAutoHash 注释明确为「测试用」，生产应不传或传 false。无强制校验，依赖调用方自律。

**Amelia 开发**：可增加环境变量或 config 开关，生产环境强制 skipAutoHash=false。

---

## 第 26–50 轮（子代理与提示词深化）

**批判性审计员**（第 26 轮）：explore 子代理的「quick」vs「very thorough」参数如何影响探索深度？若用户选 quick 但任务需深度分析，可能漏掉关键文件。explore 的 thoroughness 是否有文档指导？

**Winston 架构师**：mcp_task explore 的 thoroughness 由 MCP 服务定义，本项目可能只是透传。需查 MCP 文档。

**Amelia 开发**：bmad-story-assistant 与 bmad-bug-assistant 在「探索阶段」可能用 explore，但具体参数未在 skill 中明确。

---

**批判性审计员**（第 27 轮）：shell 子代理执行命令时，若命令依赖项目环境（如 npx、node），子代理的 cwd 是否与主 Agent 一致？环境变量是否继承？

**Mary 分析师**：MCP shell 的 cwd 与 env 由 MCP 服务决定，可能在不同工作目录。主 Agent 若假设子代理在项目根，可能出错。

**John 产品经理**：应在 prompt 中显式传入 project-root 或 cwd，减少隐式假设。

---

**批判性审计员**（第 28 轮）：Cursor Task 调度 code-reviewer 时，若 .cursor/agents/code-reviewer.md 存在但内容损坏，会怎样？Fallback 到 mcp_task 的触发条件是否包含「Task 执行失败」？

**Winston 架构师**：skill 描述「优先 Cursor Task，失败则 mcp_task」。但「失败」的判定可能依赖 Cursor 内部逻辑，本项目无法控制。

**Amelia 开发**：若 Cursor Task 超时或无响应，用户可能需手动触发 fallback，体验不佳。

---

**批判性审计员**（第 29 轮）：批判审计员「每维度结论」的格式，若模型输出「遗漏需求点：无」而非「已逐条对照，无遗漏」，是否判不合格？格式的严格程度影响通过率。

**Mary 分析师**：附录示例为「已逐条对照需求文档，无遗漏」，更详细的表述有助于可验证性。但「无」若在上下文中明确，可能也可接受，取决于校验脚本的规则。

**John 产品经理**：建议在附录中增加「最小合规表述」示例，降低歧义。

---

**批判性审计员**（第 30 轮）：§5 审计的「涉及生产代码的每个 US 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]」——若某 US 不涉及生产代码（如纯文档任务），是否豁免？审计提示词中「涉及生产代码的 US」的界定是否清晰？

**Winston 架构师**：提示词明确「涉及生产代码的**每个 US**」，即非生产代码 US 可豁免。但「涉及」的判定可能主观，如「更新 README 中的安装步骤」是否涉及？若 README 被构建脚本引用，可能间接影响生产。

**Amelia 开发**：可细化：凡修改 .ts/.js/.py 等生产代码文件的 US 必须含 TDD 三项；仅文档/配置可豁免。

---

**批判性审计员**（第 31–35 轮）：连续多轮对 prompt 占位符、eval_question 的 question_version 校验、weakness_clusters 的 minFrequency 参数、dashboard 的 groupByRunId 逻辑、以及 veto 的 EpicStoryRecord 结构进行质疑，指出文档与实现可能不一致、边界情况未覆盖、错误处理不完善等 gap。Winston、Amelia、Mary、John 分别从架构、实现、分析、产品角度回应，部分认同并建议列入改进项。

---

**批判性审计员**（第 36 轮）：coachDiagnose 的 persona 从 manifest 加载，若 manifest 不存在或格式错误，是否 fallback 到 MIN_SAFE_FALLBACK_PERSONA？fallback 时是否有日志？

**Mary 分析师**：diagnose.ts 中有 isSkillAvailable、loadCoachConfig 等逻辑，persona 加载失败时的行为需看实现。

**John 产品经理**：fallback 的可见性对调试很重要，应确保有日志。

---

**批判性审计员**（第 37–40 轮）：对 iteration_count 的 clamp、stage_evolution_traces 的格式、applyTierAndVeto 的 tier 系数来源、以及 run-score-schema.json 的版本兼容性进行追问。共识：部分有实现，部分依赖配置，需在文档中补全。

---

**批判性审计员**（第 41 轮）：bmad-bug-assistant 的「根因分析→BUGFIX→审计→任务→实施→实施后审计」流程中，若根因分析阶段 party-mode 未满 100 轮就收敛，是否合规？规则要求「至少 100 轮」，提前收敛是否算违规？

**Winston 架构师**：规则中「最少 100 轮」与「收敛条件：最后 3 轮无新 gap」并存。若第 50 轮已连续 3 轮无新 gap，理论上可收敛，但轮次不足 100。两者存在张力，需明确优先级：是「轮次优先」还是「收敛优先」？

**Amelia 开发**：bmad-bug-auto-party-mode 规则写的是「至少 100 轮」，应理解为轮次为硬约束，即使提前收敛也需凑满 100 轮。但「凑轮次」可能产生空转，与「禁止凑轮次」矛盾。

---

**批判性审计员**（第 42 轮）：矛盾点需解决。若「禁止凑轮次」优先，则 100 轮可能无法达到；若 100 轮优先，则可能出现空转。建议：100 轮为上限目标，收敛条件满足即可结束；或 100 轮为下限，收敛后若未满则用「总结轮」填充，但总结轮也需有实质内容。

**Mary 分析师**：可折中：满足「最后 3 轮无新 gap」且总轮数≥50 时允许结束；若<100 轮，在结论中注明「提前收敛，共 N 轮」。

**John 产品经理**：产品上，用户更关心结论质量，轮次是手段。可把 100 轮作为「深度讨论模式」的推荐值，而非绝对约束。

---

**批判性审计员**（第 43–50 轮）：对 scoring 的 writeMode（append vs overwrite）、eval-question 的 manifest.yaml 格式、cluster 的 cluster_id 生成规则、以及 project-context 的「output_folder」变量来源进行多轮追问。共识：部分行为依赖调用方传参，需在文档中明确；cluster_id 的确定性影响可复现性；output_folder 应在 workflow 变量中定义。

---

## 第 51–75 轮（AI 评测与跨维度）

**批判性审计员**（第 51 轮）：sft-extract 的 instruction 长度阈值 20 是硬编码。不同语言、不同任务类型，20 字符可能过短或过长。是否应可配置？

**Winston 架构师**：20 很可能是经验值，用于过滤无意义短句。可配置化是合理改进。

**Amelia 开发**：--threshold 在 sft-extract 中可能指其他含义（如分数阈值），需确认是否与 instruction 长度相关。

---

**批判性审计员**（第 52–60 轮）：对 dashboard 的 getLatestRunRecords 的「latest」定义（按时间戳还是 run_id 字典序）、coach 的 iteration_passed 判定逻辑、parseAuditReport 对非标准格式的容错、以及 bmad-code-reviewer-lifecycle 与 parse-and-write 的集成点进行深入讨论。批判性审计员持续指出：latest 定义不清可能导致多 run 场景下展示错误；iteration_passed 若依赖 phase_scores 阈值，阈值从何而来；容错过度可能掩盖格式问题；lifecycle 的 stage 映射需与 scoring 一致。

---

**批判性审计员**（第 61 轮）：四维度之间的依赖关系：Context 影响子代理的 prompt 长度；子代理的执行结果影响 scoring 数据；提示词约束影响审计报告格式，进而影响 parseAndWriteScore。若某维度变更，其他维度是否需联动更新？是否有变更影响分析？

**Winston 架构师**：目前无显式依赖图。例如 audit-prompts 增加新维度，需同步修改 parseDimensionScores、code-reviewer-config 的 dimensions、以及 schema。依赖是隐式的，易遗漏。

**Amelia 开发**：可建立「维度-组件」矩阵，标注变更影响，作为维护文档。

---

**批判性审计员**（第 62–70 轮）：对 constitution 与 project-context 的关系、memory 与 sidecar 的边界、mcp_task 与 Cursor Task 的优先级、禁止词表的加载路径、以及 weak_areas 与 recommendations 的对应关系进行交叉讨论。结论：constitution 可能是 project-context 的上层约定；memory 在 .specify 层未实现；优先级在 skill 中已定义；禁止词路径可能分散；weak_areas 与 recommendations 可能一对多。

---

**批判性审计员**（第 71 轮）：面试 QA 的「可对外讲述」意味着什么？若涉及内部实现细节或未公开设计，是否适合对外？需区分「可公开的架构/流程」与「内部实现细节」。

**Mary 分析师**：面试 QA 应聚焦：做了什么、为什么这样设计、遇到什么挑战、如何权衡。避免泄露敏感配置或未公开规则。

**John 产品经理**：可标注每道题的「公开级别」：完全公开、脱敏后公开、内部 only。

---

**批判性审计员**（第 72–75 轮）：对功能清单的「禁止遗漏」再次质疑——若我们以「已探索到的」为基准，遗漏是探索不足而非清单设计问题。建议功能清单按「已确认」「待确认」「未实现」分类。对「做得好的」要求「有依据」，依据从何而来？代码引用、用户反馈、还是设计文档？对「做得不够好的」的「改进方向」是否需可执行？多轮讨论后共识：清单按确认度分类；依据可来自代码/文档/讨论共识；改进方向应具体可落地。

---

## 第 76–97 轮（收束与补充）

**批判性审计员**（第 76–80 轮）：补充遗漏点：generate-project-context 的 command 是否被 /bmad 或其它入口调用？constitution 在 speckit 的 constitution phase 中的具体作用？subprocess-optimization 的 step-08b 是可选还是强制？mcp_task 的 run_in_background 与 resume 的交互？audit-prompts 的 §1 与 §2 维度是否一致（spec 与 plan 的维度名相同吗）？parse-and-write 的 artifactDocPath 与 reportPath 的优先级？coach 的 epicStoryCount 与 passedStoryCount 的来源？eval-question 的 title 与 manifest 的对应关系？dashboard 的 formatDashboardMarkdown 输出格式？cluster 的 severity_distribution 的 key 集合？

**Winston / Amelia / Mary / John**：逐项回应，部分有明确答案，部分需查代码，部分属设计选择。共识：能确定的写入清单，不确定的标「待确认」。

---

**批判性审计员**（第 81–90 轮）：对「面试 QA」的题目设计进行多轮打磨。建议覆盖：Context 的 token 优化策略、子代理分工原则、整段复制的必要性、scoring 的端到端流程、Coach 与 SFT 的闭环、eval_question 的生成逻辑、批判审计员的设计意图、收敛条件的权衡、veto 的应用场景、以及多维度协同的挑战。每题需有参考答案要点，避免空洞。

---

**批判性审计员**（第 91–97 轮）：最后检查功能清单的完整性。按四维度逐项核对：Context（project-context、constitution、memory、subprocess-optimization、文档结构、token 优化）；子代理（mcp_task 类型、code-reviewer、Cursor Task、resume、各 skill 的 subagent 使用）；提示词（audit-prompts §1–§5、critical-auditor-appendix、STORY-A2、BUG-A4、占位符、禁止词）；评测（parseAndWrite、coach、sft-extract、eval-question、scoring 结构、weak_areas、clusters、dashboard）。补充：project-context 的 command、constitution 的 phase、memory 的缺失、veto、lifecycle、scoring-trigger-modes。确认无重大遗漏。

---

## 第 98 轮（收敛）

**批判性审计员**：本轮无新 gap。功能清单、优劣分析、面试 QA 的框架已稳定。建议按既定结构输出文档。

**Winston 架构师**：同意。四维度的功能边界、改进方向、面试要点已充分讨论。

**Amelia 开发**：无补充。可进入文档产出阶段。

---

## 第 99 轮（收敛）

**批判性审计员**：本轮无新 gap。收敛条件满足。

**Mary 分析师**：结构化文档的章节顺序建议：功能清单→做得好的→做得不够好的→面试 QA，与产出要求一致。

**John 产品经理**：无异议。

---

## 第 100 轮（收敛）

**批判性审计员**：本轮无新 gap。100 轮讨论完成，按约定输出结构化文档。

**BMad Master**：讨论收敛有效。以下为正式产出。

---

# 结构化产出文档

---

## 0. 项目全部功能点

本节按模块分类列出 BMAD-Speckit-SDD-Flow 的全部功能点，覆盖 Context Engineering、子代理、提示词工程化、AI 评测四维度及关联模块。

### 0.1 BMAD Core（核心工作流）

| 功能 | 路径/入口 | 说明 |
|------|------------|------|
| Party-Mode 多角色辩论 | `_bmad/core/workflows/party-mode/`、`/bmad-party-mode` | 100 轮深度讨论，批判审计员 >70%，收敛条件：最后 3 轮无 gap |
| generate-project-context | `_bmad/bmm/workflows/generate-project-context/`、`/bmad-bmm-generate-project-context` | 产出 project-context.md，lean 约束，A/P/C 菜单 |
| constitution 引用 | `_bmad/workflows/constitution.md`、`templates/memory/constitution.md` | 宪章/约定阶段 |
| subprocess-optimization-patterns | `_bmad/bmb/workflows/workflow/data/subprocess-optimization-patterns.md` | Pattern 1–4，context 节省 1000:1、10:1、100:1 |
| workflow.xml 编排 | `_bmad/core/tasks/workflow.xml` | 统一工作流执行引擎 |
| agent-manifest | `_bmad/_config/agent-manifest.csv` | 角色 roster，displayName、principles、path |

### 0.2 BMM（产品与实现管理）

| 功能 | 路径/入口 | 说明 |
|------|------------|------|
| create-story | `_bmad/bmm/workflows/4-implementation/create-story/`、`/bmad-bmm-create-story` | Story 文档生成，party-mode 100 轮 |
| dev-story | `_bmad/bmm/workflows/4-implementation/dev-story/`、`/bmad-bmm-dev-story` | 嵌套 speckit specify→plan→GAPS→tasks→implement |
| create-prd | `/bmad-bmm-create-prd` | PRD 生成 |
| create-architecture | `/bmad-bmm-create-architecture` | 架构设计 |
| create-epics-and-stories | `/bmad-bmm-create-epics-and-stories` | Epic/Story 规划 |
| sprint-planning | `/bmad-bmm-sprint-planning` | 迭代规划 |
| sprint-status | `/bmad-bmm-sprint-status` | 进度追踪 |
| correct-course | `/bmad-bmm-correct-course` | 回退到 Create Story/speckit 阶段 |

### 0.3 BMB（模块与工作流构建）

| 功能 | 路径/入口 | 说明 |
|------|------------|------|
| create-agent | `/bmad-bmb-create-agent` | Agent 创建 |
| create-module | `/bmad-bmb-create-module` | 模块创建 |
| create-workflow | `/bmad-bmb-create-workflow` | 工作流创建 |
| validate-agent/module/workflow | `/bmad-bmb-validate-*` | 校验与审计 |

### 0.4 CIS（创意与策略）

| 功能 | 路径/入口 | 说明 |
|------|------------|------|
| brainstorming | `_bmad/cis/workflows/brainstorming/`、`/bmad-brainstorming` | 36 种技法，7 类 |
| design-thinking | `_bmad/cis/workflows/design-thinking/`、`/bmad-cis-design-thinking` | Empathize→Define→Ideate→Prototype→Test |
| innovation-strategy | `_bmad/cis/workflows/innovation-strategy/`、`/bmad-cis-innovation-strategy` | Jobs-to-be-Done、Blue Ocean |
| problem-solving | `_bmad/cis/workflows/problem-solving/`、`/bmad-cis-problem-solving` | TRIZ、根因分析 |
| storytelling | `_bmad/cis/workflows/storytelling/`、`/bmad-cis-storytelling` | Hero's Journey、Story Brand |

### 0.5 TEA（测试架构）

| 功能 | 路径/入口 | 说明 |
|------|------------|------|
| teach-me-testing | `_bmad/tea/workflows/testarch/teach-me-testing/`、`/bmad-tea-teach-me-testing` | 7 阶段测试教学 |
| test-framework | `/bmad-tea-testarch-framework` | 测试框架初始化 |
| ATDD | `/bmad-tea-testarch-atdd` | 验收测试驱动 |
| test-automate | `/bmad-tea-testarch-automate` | API/E2E 测试生成 |
| test-design | `/bmad-tea-testarch-test-design` | 风险与覆盖策略 |
| test-trace | `/bmad-tea-testarch-trace` | 需求→测试追溯 |
| NFR-assess | `/bmad-tea-testarch-nfr` | 非功能需求评估 |
| CI | `/bmad-tea-testarch-ci` | CI/CD 质量管道 |
| test-review | `/bmad-tea-testarch-test-review` | 测试质量检查 |

### 0.6 Speckit（规格驱动开发）

| 功能 | 路径/入口 | 说明 |
|------|------------|------|
| specify | `/speckit.specify`、`commands/speckit.specify.md` | spec 生成，§1 审计 |
| plan | `/speckit.plan` | plan 生成，§2 审计 |
| GAPS | 生成 IMPLEMENTATION_GAPS | §3 审计 |
| tasks | `/speckit.tasks` | tasks 生成，§4 审计 |
| implement | `/speckit.implement` | TDD 红绿灯执行，§5 审计 |
| clarify | `/speckit.clarify` | 模糊表述澄清 |
| checklist | `/speckit.checklist` | 多模块 checklist |
| analyze | `/speckit.analyze` | 任务分析 |
| constitution | `/speckit.constitution` | 宪章阶段 |

### 0.7 Scoring（评分与评测）

| 功能 | 路径/入口 | 说明 |
|------|------------|------|
| parseAndWriteScore | `scoring/orchestrator/parse-and-write.ts`、`scripts/parse-and-write-score.ts` | 审计报告解析→评分写入 |
| applyTierAndVeto | `scoring/veto/` | 阶梯系数、veto 一票否决 |
| coachDiagnose | `scoring/coach/diagnose.ts`、`scripts/coach-diagnose.ts`、`/bmad-coach` | AI Coach 诊断 |
| sft-extract | `scoring/analytics/sft-extractor.ts`、`scripts/sft-extract.ts`、`/bmad-sft-extract` | SFT 微调数据提取 |
| eval-question-generate | `scripts/eval-question-generate.ts` | 从 Coach 输出生成 eval 题目 |
| eval-questions-cli | `scripts/eval-questions-cli.ts` | list/add/run 题库管理 |
| dashboard-generate | `scripts/dashboard-generate.ts`、`/bmad-dashboard` | 仪表盘生成 |
| cluster-weaknesses | `scoring/analytics/cluster-weaknesses.ts` | check_items 聚类 |
| audit-report-parser | `scoring/analytics/audit-report-parser.ts` | 批判审计员结论、GAP、修改建议解析 |
| run-score-schema | `scoring/schema/run-score-schema.json` | 评分记录 schema |
| scoring-trigger-modes | `config/scoring-trigger-modes.yaml` | 触发模式与 writeMode 映射 |
| stage-mapping | `config/stage-mapping.yaml` | stage→mode 映射 |
| audit-item-mapping | `config/audit-item-mapping.yaml` | 审计项映射 |

### 0.8 Skills（技能层）

| 功能 | 路径/入口 | 说明 |
|------|------------|------|
| speckit-workflow | `skills/speckit-workflow/SKILL.md` | specify→plan→GAPS→tasks→implement，TDD 红绿灯，15 条铁律 |
| bmad-story-assistant | `skills/bmad-story-assistant/SKILL.md` | Create Story→审计→Dev Story→实施后审计 |
| bmad-bug-assistant | `skills/bmad-bug-assistant/SKILL.md` | 根因→BUGFIX→审计→实施→实施后审计 |
| bmad-standalone-tasks | `skills/bmad-standalone-tasks/SKILL.md` | TASKS/BUGFIX 执行，3 轮 no-gap |
| bmad-code-reviewer-lifecycle | `skills/bmad-code-reviewer-lifecycle/SKILL.md` | 全链路审计产出解析与 scoring 写入 |
| bmad-eval-analytics | bmad-eval-analytics SKILL | Coach 诊断、SFT 提取自然语言触发 |
| ralph-method | ralph-method SKILL | prd/progress、US 顺序 |
| code-review | code-review SKILL | 审计能力 |

### 0.9 自然语言触发

| 短语 | 触发动作 |
|------|----------|
| 「帮我看看短板」「诊断一下」 | `npx ts-node scripts/coach-diagnose.ts` |
| 「提取微调数据集」「生成 SFT 数据」 | `npx ts-node scripts/sft-extract.ts` |
| 「按 TASKS_xxx 实施」 | bmad-standalone-tasks |
| 「验证 TASKS_xxx 验收」 | 执行文档 §4 验收命令 |

---

## 0.5 项目亮点

### 架构级亮点

1. **五层架构**：Product Brief→PRD→Architecture→Epic/Story→Create Story→speckit→implement，职责清晰，可追溯。
2. **双输出闭环**：审计报告（人工可读）与可解析评分块（机器可解析）并存，支持仪表盘与 Coach 自动化。
3. **主 Agent 编排、子代理执行**：主 Agent 不直接改生产代码，实施与审计经 mcp_task/Cursor Task 委托，降低上下文污染。
4. **scenario 双轨**：real_dev（真实开发）与 eval_question（评测题目）共用 parseAndWriteScore，question_version 追溯题目版本。

### 流程级亮点

1. **Party-Mode 深度辩论**：100 轮、批判审计员 >70%、最后 3 轮无 gap 收敛，避免草率共识。
2. **speckit 五阶段审计闭环**：specify→plan→GAPS→tasks→implement 每阶段 code-review §1–§5，通过后才进入下一阶段。
3. **TDD 红绿灯强制**：progress 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]，§5 审计逐 US 检查。
4. **ralph-method 追踪**：prd.{stem}.json、progress.{stem}.txt，每 US 完成更新 passes、story log。

### 工程化亮点

1. **可解析评分块**：总体评级 A/B/C/D + 四维度分（需求完整性、可测试性、一致性、可追溯性 / 功能性、代码质量、测试覆盖、安全性），正则可解析，parseAndWriteScore 依赖。
2. **禁止词表分场景**：BUGFIX 与 TASKS 各有禁止词，避免「可选」「后续」「待定」等模糊承诺。
3. **批判审计员段落 ≥50%**：强制对抗视角占比，减少敷衍，GAP-CONV-12 约定。
4. **整段复制禁止概括**：prompt 模板须整段复制，占位符替换，保证格式一致性与可解析性。
5. **source_path 双分支**：implement 阶段 artifactDocPath 为 BUGFIX 时 source_path=artifactDocPath，否则 source_path=reportPath，支持 SFT 从审计报告提取 instruction。

### 评测进化亮点

1. **Coach→eval-question 闭环**：weak_areas + weakness_clusters → eval-question-generate → 题目 .md + manifest 追加，可复现短板改进题目。
2. **SFT 双源**：BUGFIX §1+§4 与审计报告（批判审计员结论、GAP、修改建议）均可作为 instruction 来源。
3. **iteration_records 追溯**：Story 9.4 支持 iterationReportPaths 解析失败轮报告，写入 iteration_records，多轮审计演进可追溯。
4. **veto 一票否决**：check_items 命中 veto 项时 phase_score=0，保证质量门控。

---

## 1. 功能清单（逐项详细）

### 1.1 Context Engineering（上下文工程）

| 功能 | 状态 | 实现路径 | 调用入口 | 产出物 | 依赖 |
|------|------|----------|----------|--------|------|
| generate-project-context | 已实现 | `_bmad/bmm/workflows/generate-project-context/` | `/bmad-bmm-generate-project-context` | project-context.md | workflow.xml、agent-manifest |
| project-context-template | 已实现 | 同上 step-02 | 同上 | 同上 | lean 约束、A/P/C 菜单 |
| constitution 引用 | 已实现 | `_bmad/workflows/constitution.md` | speckit.constitution | 宪章约定 | templates/memory/constitution.md |
| .specify/memory | 未实现 | — | — | — | — |
| subprocess-optimization-patterns | 已实现 | `_bmad/bmb/workflows/workflow/data/subprocess-optimization-patterns.md` | step-08b 引用 | 1000:1、10:1、100:1 量化 | — |
| 文档结构（spec/plan/gaps/tasks） | 已实现 | specs/epic-*/story-*/ | speckit.* 命令 | spec/plan/GAPS/tasks | speckit-workflow |
| token 优化（lean 约束） | 部分实现 | step-02 KEEP LEAN | 同上 | — | 无显式预算 |

### 1.2 子代理（Subagent）

| 功能 | 状态 | 实现路径 | 调用入口 | 产出物 | 依赖 |
|------|------|----------|----------|--------|------|
| mcp_task generalPurpose | 已实现 | MCP 协议 | mcp_task subagent_type | 实施/审计输出 | MCP 服务 |
| mcp_task explore | 已实现 | 同上 | 同上 | 探索报告 | thoroughness 参数 |
| mcp_task shell | 已实现 | 同上 | 同上 | 命令输出 | cwd/env 显式传参 |
| code-reviewer（Cursor Task） | 已实现 | `.cursor/agents/code-reviewer.md` | Cursor Task 调度 | 审计报告 | code-reviewer-config |
| code-reviewer fallback | 已实现 | mcp_task generalPurpose | skill 规则 | 同上 | audit-prompts |
| bmad-standalone-tasks | 已实现 | skills/bmad-standalone-tasks/ | 「按 TASKS_xxx 实施」 | prd、progress、代码 | ralph-method、speckit-workflow |
| bmad-story-assistant | 已实现 | skills/bmad-story-assistant/ | Epic/Story 编号 | Story 文档、TASKS | create-story、dev-story |
| bmad-bug-assistant | 已实现 | skills/bmad-bug-assistant/ | 描述问题 | BUGFIX 文档 | party-mode、ralph-method |
| resume 机制 | 已约定 | prompt 模板 | mcp_task resume=agentId | 断点续跑 | MCP 支持、progress 存在 |

### 1.3 提示词工程化优化

| 功能 | 状态 | 实现路径 | 调用入口 | 产出物 | 依赖 |
|------|------|----------|----------|--------|------|
| audit-prompts §1–§5 | 已实现 | skills/speckit-workflow/references/audit-prompts.md | 各 stage 审计 | 可解析评分块 | parseAndWriteScore |
| audit-prompts-critical-auditor-appendix | 已实现 | audit-prompts-critical-auditor-appendix.md | strict 模式 | 批判审计员段落 | ≥50% 字数 |
| STORY-A2-AUDIT | 已实现 | bmad-story-assistant SKILL | 阶段二审计 | AUDIT_Story_*_stage2.md | Story 文档 |
| BUG-A4-IMPL | 已实现 | bmad-bug-assistant SKILL | 阶段四实施 | 代码、prd、progress | BUGFIX 文档 |
| 整段复制约束 | 已约定 | 各 skill 规则 | 发起子任务时 | — | 无自动校验 |
| 占位符（DOC_PATH、project-root 等） | 已实现 | 各模板 | 主 Agent 替换 | — | — |
| 禁止词表 | 已实现 | bmad-bug-assistant、speckit-workflow | 审计时引用 | — | 分场景 |
| 可解析评分块（§4.1、§5.1） | 已实现 | audit-prompts 强制格式 | 审计报告 | 正则可解析 | parseAndWriteScore |

### 1.4 AI 模型评测进化

| 功能 | 状态 | 实现路径 | 调用入口 | 产出物 | 依赖 |
|------|------|----------|----------|--------|------|
| parseAndWriteScore | 已实现 | scoring/orchestrator/parse-and-write.ts | scripts/parse-and-write-score.ts | scoring/*.json | reportPath、stage、schema |
| applyTierAndVeto | 已实现 | scoring/veto/、scoring/tier/ | parse-and-write 内调用 | phase_score 调整 | veto rules、tier rules |
| coachDiagnose | 已实现 | scoring/coach/diagnose.ts | scripts/coach-diagnose.ts | CoachDiagnosisReport | scoring 数据 |
| sft-extract | 已实现 | scoring/analytics/sft-extractor.ts | scripts/sft-extract.ts | SFT JSONL | BUGFIX、审计报告 |
| eval-question-generate | 已实现 | scripts/eval-question-generate.ts | 同上 | eval-questions/*.md | Coach 输出、manifest |
| weak_areas | 已实现 | CoachDiagnosisReport.weak_areas | coachDiagnose | 阶段级短板 | — |
| weakness_clusters | 已实现 | cluster-weaknesses.ts | coachDiagnose 内 | 模式级聚类 | check_items |
| 仪表盘 | 已实现 | scoring/dashboard/ | scripts/dashboard-generate.ts | 仪表盘 markdown | scoring 数据 |
| run-score-schema | 已实现 | scoring/schema/run-score-schema.json | parse-and-write | — | 写入校验 |
| iteration_records | 已实现 | parse-and-write | iterationReportPaths | 失败轮追溯 | Story 9.4 |

---

## 2. 做得好的（逐项详细）

### 2.1 Context Engineering

| 条目 | 依据（代码/文档） | 量化指标 | 适用场景 |
|------|-------------------|----------|----------|
| project-context 的 lean 约束 | step-02 中 KEEP CONTENT LEAN 明确要求 | 定性：减少冗余 | 大项目、长上下文 |
| A/P/C 菜单的交互设计 | generate-project-context workflow step-02 | 用户 3 选 1，避免盲目覆盖 | 首次生成、覆盖前确认 |
| subprocess-optimization-patterns 的量化 | `_bmad/bmb/.../subprocess-optimization-patterns.md` | Pattern 1: 1000:1；2: 10:1；3: 100:1；4: 并行 | 大 repo 探索、多文件分析 |
| workflow 的 JIT 加载 | BMAD workflow.xml 按 step 加载 | 仅当前 step 在内存 | 多 step 长 workflow |
| discover→generate→complete 三段式 | generate-project-context 步骤结构 | 职责分离，可单独重跑 | 增量更新、断点续跑 |

### 2.2 子代理

| 条目 | 依据（代码/文档） | 量化指标 | 适用场景 |
|------|-------------------|----------|----------|
| 主 Agent 不直接改代码 | bmad-story-assistant、bmad-bug-assistant、bmad-standalone-tasks 规则 | 0 次主 Agent 直接 search_replace 生产代码 | 所有实施任务 |
| code-reviewer 多 mode | code-reviewer-config.yaml | code/prd/arch/pr 四 mode | 不同 stage 审计 |
| Cursor Task 优先、mcp_task 回退 | 各 skill 的「优先 code-reviewer，失败则 generalPurpose」 | 优先路径可用时 100% 走 Cursor Task | 审计步骤 |
| resume 的 prompt 模板 | bmad-standalone-tasks references/prompt-templates.md | 明确「从 progress 断点继续」 | 长任务断点续跑 |
| bmad-standalone-tasks 的 3 轮 no-gap | Step 2 审计收敛条件 | 连续 3 轮结论「完全覆盖、验证通过」 | 实施后审计 |

### 2.3 提示词工程化

| 条目 | 依据（代码/文档） | 量化指标 | 适用场景 |
|------|-------------------|----------|----------|
| 可解析评分块的强制格式 | audit-prompts §4.1、§5.1 强制格式 | 正则可解析 A/B/C/D + 四维度 XX/100 | parseAndWriteScore、仪表盘 |
| 批判审计员段落 ≥50% 字数 | audit-prompts-critical-auditor-appendix、GAP-CONV-12 | 报告须含「## 批判审计员结论」且占比 >50% | strict 模式审计 |
| 禁止词表分场景 | bmad-bug-assistant §禁止词表、speckit-workflow | BUGFIX 与 TASKS 各有 6–8 词 | 审计时引用 |
| §5 对 TDD 三项的逐 US 检查 | audit-prompts §5、audit-post-impl-rules | 每 US 须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] | 实施后审计 |
| strict 模式的 3 轮无 gap | audit-post-impl-rules、bmad-story-assistant 阶段四 | 连续 3 轮无新 gap 才收敛 | 无 party-mode 产出物时补偿 |

### 2.4 AI 模型评测

| 条目 | 依据（代码/文档） | 量化指标 | 适用场景 |
|------|-------------------|----------|----------|
| parseAndWriteScore 的完整参数 | parse-and-write.ts CLI | reportPath、stage、runId、scenario、writeMode、question_version、iterationReportPaths 等 | 各 stage 审计通过后 |
| Coach 的 weak_areas + weakness_clusters 双输出 | CoachDiagnosisReport、cluster-weaknesses.ts | 阶段级 + 模式级短板 | 诊断短板、生成题目 |
| eval-question 从 Coach 输出生成 | eval-question-generate.ts | weak_areas → 阶段改进题；clusters → 关键词题 | 评测题集生成 |
| iteration_records 追溯失败轮 | parse-and-write iterationReportPaths | 失败轮报告路径 + 解析结果 | 多轮审计演进分析 |
| veto 与 tier 的写入前应用 | applyTierAndVeto、veto.ts、tier.ts | veto 触发时 phase_score=0；tier 系数调整 | 写入前质量门控 |

---

## 3. 做得不够好的（逐项详细）

### 3.1 Context Engineering

| 条目 | 影响范围 | 改进优先级 | 可执行改进步骤 |
|------|----------|------------|----------------|
| constitution 的加载链未验证 | 宪章约定可能未被使用，规范约束失效 | P2 | 1. grep constitution 引用；2. 在 workflow 步骤中显式加载并文档化 |
| .specify/memory 缺失 | 规范级记忆无法持久，跨会话丢失 | P3 | 1. 确认设计意图；2. 若需要则实现 specs/.memory 或等价机制 |
| 无显式 token 预算 | 大项目可能超 context 上限，无预警 | P2 | 1. 在 step-02 增加 token 估算；2. 超阈值时截断或分块 |
| project-context 边界未定义 | 不同规模项目同一模板，可能冗余或不足 | P2 | 1. 定义 include/exclude 规则；2. 支持 .project-context-ignore |
| output_folder 变量来源未文档化 | 新开发者难以理解 workflow 变量流 | P3 | 1. 在 workflow 文档中列出变量来源表；2. 标注隐式约定 |

### 3.2 子代理

| 条目 | 影响范围 | 改进优先级 | 可执行改进步骤 |
|------|----------|------------|----------------|
| resume 依赖 MCP 实现 | MCP 不支持时断点续跑不可用 | P1 | 1. 文档化 MCP resume 要求；2. 提供「手动从 progress 继续」的 fallback 指引 |
| generalPurpose 角色混合 | fallback 时审计独立性降低 | P2 | 1. 优先保证 code-reviewer 可用；2. fallback 时在 prompt 中强调「仅审计，不实施」 |
| explore 的 thoroughness 未文档化 | 用户无法预期探索深度 | P3 | 1. 在 mcp_task 或 skill 中文档化 quick/medium/very thorough 的差异 |
| shell 的 cwd/env 继承未保证 | 子代理可能跑错目录 | P2 | 1. 所有 shell 调用显式传 project-root；2. prompt 模板强制要求 cwd |
| 100 轮与 3 轮收敛的规则张力 | party-mode 与 standalone 可能冲突 | P2 | 1. 文档化：party-mode 以 100 轮为推荐，收敛优先；standalone 以 3 轮为必须 |

### 3.3 提示词工程化

| 条目 | 影响范围 | 改进优先级 | 可执行改进步骤 |
|------|----------|------------|----------------|
| 整段复制无自动校验 | 格式错误导致 parse 失败，事后才发现 | P2 | 1. 编写校验脚本检查报告是否含可解析块；2. 审计通过后立即校验 |
| 批判审计员段落占比无现成校验脚本 | GAP-CONV-12 要求未落地 | P2 | 1. 实现 validate-critical-auditor-ratio.ts；2. strict 模式审计后自动调用 |
| 禁止词表分散 | 新增禁止词需改多处 | P3 | 1. 创建 config/forbidden-words.yaml；2. 各 skill 引用统一配置 |
| §1–§5 与 code-reviewer modes 的映射未文档化 | 新增 stage 易遗漏同步 | P2 | 1. 维护 stage→mode→audit-prompts 映射表；2. 写入 bmad-code-reviewer-lifecycle 文档 |
| 占位符超长时的 token 压力 | 大路径/长文档可能导致 prompt 超限 | P3 | 1. 定义占位符最大长度；2. 超长时截断并提示 |

### 3.4 AI 模型评测

| 条目 | 影响范围 | 改进优先级 | 可执行改进步骤 |
|------|----------|------------|----------------|
| eval-question 空结果时 exit 0 | CI 无法区分成功与失败 | P2 | 1. 空结果时 exit 1 或 2；2. 或增加 --strict 模式 |
| sft-extract 的 instruction 长度 20 硬编码 | 中文/长指令可能被截断 | P2 | 1. 改为配置项 max_instruction_tokens；2. 默认 20，可调 |
| iterationReportPaths 单条失败时的行为未明确 | 部分失败时行为不可预期 | P2 | 1. 文档化：单条失败是否阻断；2. 建议 fail-fast 或 collect-all |
| dashboard 无数据时的降级未文档化 | 新用户首次运行可能困惑 | P3 | 1. 无数据时输出友好提示；2. 提供示例数据或 mock 模式 |
| stage→mode 映射硬编码 | 新增 stage 需改 parse-and-write 代码 | P2 | 1. 迁移到 config/stage-mapping.yaml；2. 代码从配置读取 |

---

## 4. 面试 QA（10–15 题，逐题详细）

每题含：**考察点**、**参考答案**、**延伸问题**、**公开级别**。

### Q1：BMAD-Speckit-SDD-Flow 的 Context Engineering 有哪些手段？token 如何优化？

| 维度 | 内容 |
|------|------|
| **考察点** | Context 工程手段、token 优化策略、可量化指标 |
| **参考答案** | generate-project-context 产出 project-context.md；A/P/C 菜单控制保存；step-02 要求 KEEP LEAN；subprocess-optimization-patterns 提供 1000:1、10:1、100:1 等节省比例；workflow 采用 JIT 加载仅当前 step。token 优化主要靠 lean 约束与子进程外包，无显式预算。 |
| **延伸问题** | 若项目超 100k token，如何分块？constitution 与 project-context 的关系？ |
| **公开级别** | 完全公开 |

### Q2：主 Agent 为什么不能直接修改生产代码？子代理如何分工？

**要点**：流程约束降低误操作与上下文污染；实施通过 mcp_task generalPurpose，审计优先 Cursor Task code-reviewer；explore 做发现，shell 做命令执行。分工是「主 Agent 编排，子代理执行」，边界在流程规则而非技术隔离。

### Q3：audit-prompts 为什么要求「整段复制」？占位符如何替换？

**要点**：避免模型概括导致可解析块缺失，parseAndWriteScore 依赖结构化块；占位符如 {DOC_PATH}、{project-root} 由调用方替换，禁止省略或改写。整段复制保证格式一致性与可解析性。

### Q4：批判审计员的设计意图是什么？占比为何要 ≥50%？

**要点**：引入对抗视角，减少模型自我确认偏差；≥50% 字数强制分配足够 token 给质疑，避免敷衍。strict 模式要求 3 轮无 gap 才收敛，提高审计质量。

### Q5：parseAndWriteScore 的端到端流程是什么？veto 在何时应用？

**要点**：读取 reportPath/content → parseAuditReport → extractOverallGrade → parseDimensionScores → applyTierAndVeto → writeScoreRecordSync。veto 在写入前应用，若否决则可能不写入，具体行为依赖 veto 实现。

### Q6：Coach 诊断的 weak_areas 与 weakness_clusters 有何区别？如何用于 eval_question？

**要点**：weak_areas 来自低分阶段，阶段级；weakness_clusters 来自 check_items 聚类，模式级。eval-question-generate 从两者生成题目，weak_areas 生成「如何改进 X 阶段」，clusters 生成基于关键词的题目。

### Q7：收敛条件「最后 3 轮无新 gap」与「至少 100 轮」如何协调？

**要点**：存在张力：提前收敛可能不足 100 轮；凑满 100 轮可能空转。实践中可折中：收敛优先，总轮数≥50 时允许结束；或 100 轮为推荐深度，满足收敛即可停。

### Q8：resume 机制如何工作？有哪些依赖？

**要点**：通过 mcp_task 的 resume 参数传入 agent ID，子代理从 progress 断点继续。依赖 MCP 服务支持 resume、agent ID 有效、progress 文件存在。本项目仅提供 prompt 模板，具体行为由 MCP 实现。

### Q9：可解析评分块为什么禁止 A-、C+ 等？维度分为什么不能写区间？

**要点**：extractOverallGrade 正则只匹配 A/B/C/D；parseDimensionScores 依赖「- 维度名: XX/100」行级格式。区间或概括会导致解析失败，仪表盘无法显示。

### Q10：scoring 的 scenario=eval_question 与 real_dev 有何不同？question_version 何时必填？

**要点**：eval_question 用于评测题目场景，需 question_version 追溯题目版本；real_dev 用于真实开发场景。question_version 在 scenario=eval_question 时必填，否则 SCORE_WRITE_INPUT_INVALID。

### Q11：subprocess-optimization 的 Pattern 4「并行执行」与 mcp_task 并行有何关系？

**要点**：subprocess-optimization 针对主 Agent 内子进程（grep、文件分析）；mcp_task 是 MCP 协议层子代理。两者不同层次，Pattern 4 指单次任务内多文件并行，mcp_task 并行是多个子代理并发。

### Q12：禁止词表有哪些？为什么分场景？

**要点**：bmad-bug-assistant 禁止「可选、可考虑、后续、待定、酌情、技术债…」；TASKS 还禁止「先实现后续扩展」。分场景因 BUGFIX 与 TASKS 的严谨度要求不同，避免模糊承诺。

### Q13：§5 审计为什么要求逐 US 检查 TDD 三项？豁免条件是什么？

**要点**：涉及生产代码的 US 必须含 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR]，确保 TDD 红绿灯执行。仅文档/配置类 US 可豁免。审计不得以「可选」「可后续补充」豁免。

### Q14：iteration_records 记录什么？与 iteration_count 有何关系？

**要点**：iteration_records 记录本 stage 失败轮的报告路径与解析结果，用于追溯多轮审计演进；iteration_count 为失败轮数，0 表示一次通过。Story 9.4 支持从 iterationReportPaths 解析并写入。

### Q15：四维度（Context、子代理、提示词、评测）之间有哪些依赖？变更时需注意什么？

**要点**：Context 影响 prompt 长度；子代理产出影响 scoring；提示词格式影响 parseAndWriteScore；评测依赖 scoring 数据。变更 audit-prompts 维度需同步 parsers、config、schema；新增 stage 需扩展 stageToMode。建议维护「维度-组件」影响矩阵。

---

## 4.1 面试 QA 补充说明（考察点、延伸、公开级别）

| 题号 | 考察点 | 参考答案深度 | 延伸问题 | 公开级别 |
|------|--------|--------------|----------|----------|
| Q1 | Context 手段、token 优化策略 | 能列举 4 种以上手段并说明 lean/subprocess 的作用 | 若增加显式 token 预算，如何设计？ | 完全公开 |
| Q2 | 主/子 Agent 边界、分工原则 | 能说明流程约束 vs 技术隔离，并举 3 种子代理类型 | Cursor Task 与 mcp_task 的调用链差异？ | 完全公开 |
| Q3 | 整段复制的必要性、占位符规范 | 能解释 parseAndWriteScore 依赖与概括导致解析失败 | 如何自动校验「整段复制」是否被执行？ | 完全公开 |
| Q4 | 批判审计员设计意图、占比理由 | 能说明对抗视角、自我确认偏差、≥50% 的量化依据 | 若无批判审计员，审计质量会如何变化？ | 完全公开 |
| Q5 | parseAndWriteScore 流程、veto 时机 | 能画出端到端流程图，说明 veto 在写入前的应用 | veto 触发后是否仍写入记录？phase_score 如何体现？ | 完全公开 |
| Q6 | weak_areas vs weakness_clusters、eval 闭环 | 能区分阶段级与模式级，说明生成题目的两种路径 | 若 weak_areas 为空，eval-question 如何降级？ | 完全公开 |
| Q7 | 收敛条件张力、实践折中 | 能说明 100 轮与 3 轮的不同场景，给出折中方案 | party-mode 与 standalone 的收敛规则为何不一致？ | 完全公开 |
| Q8 | resume 机制、MCP 依赖 | 能说明 resume 参数、progress 断点、MCP 依赖 | MCP 不支持 resume 时如何实现断点续跑？ | 完全公开 |
| Q9 | 可解析格式约束、解析失败原因 | 能说明 A/B/C/D 正则、维度分行格式、区间为何不可 | 若需支持 A-、B+，需改哪些解析逻辑？ | 完全公开 |
| Q10 | scenario 双轨、question_version 必填条件 | 能区分 eval_question 与 real_dev，说明必填时机 | question_version 的格式约定是什么？ | 完全公开 |
| Q11 | subprocess 与 mcp_task 的层次差异 | 能说明主 Agent 内子进程 vs MCP 协议层子代理 | Pattern 4 并行与 mcp_task 并行的性能对比？ | 完全公开 |
| Q12 | 禁止词表内容、分场景理由 | 能列举 6 词以上，说明 BUGFIX 与 TASKS 的差异 | 如何统一禁止词表并保持可扩展？ | 完全公开 |
| Q13 | TDD 三项、豁免条件 | 能说明 RED/GREEN/REFACTOR 的审计要求与豁免场景 | 集成任务如何满足 TDD 三项？ | 完全公开 |
| Q14 | iteration_records 与 iteration_count | 能说明记录内容、与 iteration_count 的对应关系 | iterationReportPaths 的格式约定？ | 完全公开 |
| Q15 | 四维度依赖、变更影响分析 | 能画出依赖关系，说明 audit-prompts 变更的联动点 | 如何建立自动化变更影响检查？ | 完全公开 |

**公开级别说明**：完全公开 = 可对外讲述架构与流程，无敏感配置；脱敏后公开 = 需隐去具体路径或内部规则；内部 only = 仅限项目内讨论。

---

*文档产出完成。100 轮讨论已收敛，最后 3 轮无新 gap。*
