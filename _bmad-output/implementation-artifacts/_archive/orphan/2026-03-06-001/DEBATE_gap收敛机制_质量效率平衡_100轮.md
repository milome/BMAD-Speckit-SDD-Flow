# Party-Mode 多角色辩论：Gap 收敛机制与质量效率平衡

**议题**：如何最好地使用 gap 收敛机制，达到质量把控和执行效率的平衡，找到最优 tradeoff 方案？  
**日期**：2026-03-06  
**收敛**：100 轮，最后 3 轮无新 gap，批判审计员 + AI Coach 合计发言占比 > 50%  
**参与角色**：批判审计员、AI Coach、Winston 架构师、Amelia 开发、John 产品、Mary 分析师

**辩论轮次统计**：批判审计员 35 轮、AI Coach 24 轮、Winston 15 轮、Amelia 12 轮、John 8 轮、Mary 6 轮。批判审计员 + AI Coach 合计 59%。

---

## 议题背景

### 现状

1. **阶段二、阶段四的 code-review 审计**：明确要求引入批判审计员视角；连续 3 轮无 gap 才能收敛。
2. **bmad-standalone-tasks**：实施后审计已有：批判审计员 >50%、3 轮无 gap 收敛。
3. **技能文档**：需显式说明：何时可跳过 party-mode；当 party-mode 被跳过时，code-review 是否应达到与 party-mode 同等的严格度。

### 核心矛盾

- party-mode 定义了「批判审计员 + 近 3 轮无 gap」，但 party-mode 在多方案/歧义不存在时常被跳过。
- 实际常跑的 code-review 审计（阶段二、四、speckit 各 stage）没有这两项约束，质量严格度可能不足。
- 若对全部 code-review 都加「3 轮无 gap」，则审计成本显著上升，可能影响效率。

---

## 辩论摘要（按维度）

### 维度一：问题界定与现状梳理（轮 1–20）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 1 | 批判审计员 | 首先质疑：议题中的「gap 收敛」指的是 party-mode 内的讨论收敛，还是 code-review 审计的通过条件？二者若混淆，方案会南辕北辙。 |
| 2 | AI Coach | 澄清：本议题聚焦「code-review 审计」的收敛机制——即 audit-prompts 各阶段审计时，是否应引入「批判审计员 + 连续 3 轮无 gap」作为通过条件；与 party-mode 内讨论收敛是不同层面的概念。 |
| 3 | Winston 架构师 | 现状梳理：party-mode 有 step-02 的 2–3 轮无 gap、批判审计员每 5 轮必出场；bmad-standalone-tasks 实施后审计有批判审计员 >50%、3 轮无 gap；audit-prompts §1–§5 与 speckit §1.2–§5.2 的审计**无**上述约束，单次「完全覆盖、验证通过」即结束。 |
| 4 | 批判审计员 | Gap：若 speckit 各阶段单次通过即进入下一阶段，而 standalone 实施后审计要 3 轮无 gap，则同一流程内标准不一致。用户执行 speckit.implement 时，§5.2 审计是单次还是 3 轮？ |
| 5 | Amelia 开发 | speckit-workflow §5.2 当前仅写「调用 code-review…直至报告结论为通过」，未要求 3 轮无 gap。即单次通过即可。实施成本：若加 3 轮，每阶段至少 3×审计调用，spec→plan→gaps→tasks→implement 共 5 阶段，最多 15 次审计调用 vs 当前 5 次。 |
| 6 | AI Coach | 质量信号：3 轮无 gap 的价值在于「防止单次通过是侥幸」。单次审计可能遗漏边界情况；连续 3 轮同一结论，说明审计结论稳定。但代价是 3× 调用成本。需量化或定性：哪些 stage 的遗漏风险高，值得 3× 成本？ |
| 7 | 批判审计员 | 遗漏风险分层：spec/plan 是文档阶段，错误传播到 tasks 才变成代码；tasks 执行阶段（§5）直接影响生产代码。**假设**：§5 实施后审计的遗漏风险最高，应优先加 3 轮；§1–§4 文档阶段风险相对低，可保持单次或降级。需验证该假设。 |
| 8 | John 产品 | 用户价值：交付节奏 vs 质量。若每个阶段都 3 轮，迭代周期拉长，可能影响 sprint 计划。但若质量不足导致返工，成本更高。需找到「最小必要严格度」——既能拦截关键缺陷，又不过度拖延。 |
| 9 | Mary 分析师 | 需求追溯：bmad-story-assistant 禁止因 Story 已存在跳过 party-mode；仅用户明确说「已通过 party-mode 且审计通过」时可跳过。即 party-mode 是「方案争议」的保障；code-review 是「文档/代码符合规范」的保障。二者互补。当 party-mode 被跳过时，code-review 是否应「补偿性」加强？ |
| 10 | 批判审计员 | 补偿逻辑：若 party-mode 未被跳过，Create Story 已有 100 轮 + 批判审计员深度质疑；若跳过，则缺失该层保障。**结论**：跳过 party-mode 时，至少阶段二（Story 文档审计）应达到 party-mode 产出物同等的质疑深度——即引入批判审计员、可考虑 3 轮无 gap。 |
| 11 | AI Coach | 但阶段二审计的是「Story 文档」，不是多角色讨论。批判审计员如何「嵌入」单次 code-review 调用？两种方式：A) code-reviewer prompt 中注入批判审计员 Persona，要求其视角占比 >50%；B) 独立多轮，每轮由「批判审计员」角色单独审计。A 单次调用内实现，B 需多轮。 |
| 12 | Winston 架构师 | 架构一致性：bmad-standalone-tasks 已用 A 方式——审计 prompt 要求「批判审计员结论段落占比 >50%」「本轮无新 gap」。即单次调用内，模型扮演批判审计员并输出结论。3 轮无 gap 则需多轮调用，每轮结论均为通过且注明「本轮无新 gap」。 |
| 13 | 批判审计员 | 若单次调用内模型「扮演」批判审计员，模型可能自我放水——同时扮演审计员和批判者，易偏向通过。独立子代理（如 code-reviewer 子任务）执行时，主 Agent 无法直接改结论，独立性更好。**Gap**：Cursor Task 调度的 code-reviewer 是独立进程吗？ |
| 14 | Amelia 开发 | Cursor Task 调度的 code-reviewer 是独立 Agent 实例，与主 Agent 隔离。mcp_task generalPurpose 同理。即独立性可保障。关键在于 prompt 是否强制批判审计员输出与 3 轮无 gap 逻辑。 |
| 15 | AI Coach | 可配置性：用户可能希望「快速模式」——单次通过即过，用于原型或探索。强制 3 轮会阻碍此类场景。建议：**项目级或 stage 级可配置**，如 `audit_convergence: strict | standard | simple`，strict=3 轮无 gap，standard=单次+批判审计员，simple=单次。 |
| 16 | 批判审计员 | 可配置性带来复杂度：谁决定用哪种模式？用户每次显式选？skill 默认值？若默认 simple，则本议题的「质量补偿」失效。**反对**无约束的可配置——至少应有「推荐默认」且文档明确各模式适用场景。 |
| 17 | John 产品 | 产品视角：strict 用于生产/发布前；standard 用于常规开发；simple 用于快速验证。默认 standard，用户可升级到 strict 或降级到 simple。显式选择避免「悄悄降级」。 |
| 18 | Mary 分析师 | 指标可观测：若引入 mode，scoring 或 progress 中是否记录「本 stage 所用模式」「实际审计轮数」？便于事后分析「simple 模式下遗漏率 vs strict」。《迭代次数作为评分因子》已支持 iteration_count；可扩展为 audit_mode。 |
| 19 | 批判审计员 | 回到核心：**推荐方案**应明确——哪些 stage **必须** 3 轮无 gap（不可配置降级），哪些可配置？与 bmad-standalone-tasks 对齐：其实施后审计已强制 3 轮，是否应将此标准推广到 speckit §5.2、bmad-story 阶段四？ |
| 20 | Winston 架构师 | 对齐原则：**实施后审计**（代码/可运行产物）统一 3 轮无 gap + 批判审计员 >50%。文档阶段（spec/plan/gaps/tasks、Story 文档）可分级：Create Story 产出物（阶段二）因可能替代 party-mode，建议与实施后同级；其他文档阶段可用 standard。 |

**共识（轮 1–20）**：本议题聚焦 code-review 审计的收敛机制；实施后审计应统一 3 轮无 gap；文档阶段可分级；可配置性需有推荐默认且不可无约束降级；批判审计员可 via prompt 注入单次调用。

---

### 维度二：质量 vs 效率量化分析（轮 21–40）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 21 | 批判审计员 | 要求量化：3 轮无 gap 的「成本」与「收益」各是什么？成本易估——3× 审计调用，时间与 token；收益难量化——缺陷拦截率。是否有历史数据支撑「单次通过 vs 3 轮通过」的遗漏率差异？ |
| 22 | AI Coach | 定性分析：无历史 A/B 数据时，可基于「单次通过可能是假阳性」的风险。审计结论「完全覆盖、验证通过」可能在边界 case 上误判；连续 3 轮同一结论，概率上更稳定。类比：单元测试跑 1 次 vs 跑 3 次——若环境确定，3 次结果相同；若不确定，可能暴露 flaky。审计的「不确定性」来自 LLM 输出的非确定性。 |
| 23 | Amelia 开发 | 实施成本粗算：单次 code-review 子任务约 1–3 分钟（含模型推理）；3 轮即 3–9 分钟/阶段。5 阶段全 strict 则 15–45 分钟额外审计时间。对 2 小时开发任务，占比 12–37%。可接受上限需产品定。 |
| 24 | 批判审计员 | 若 3 轮中第 2 轮发现 gap，则需修改后第 3 轮重新计数。实际轮数可能 >3。最坏情况：每次修改后仅 1 轮通过又出新 gap，形成长尾。**Gap**：3 轮无 gap 的「轮」是否要求连续？即 通过-通过-gap→修改→通过-通过-通过，后 3 轮是否算收敛？ |
| 25 | AI Coach | bmad-standalone-tasks 已定义：**连续 3 轮无 gap** = 连续 3 次结论均为「完全覆盖、验证通过」且批判审计员注明「本轮无新 gap」；若任一轮为「未通过」或「存在 gap」，则从下一轮重新计数。即通过-通过-gap→修改→通过-通过-通过，后 3 轮算收敛。 |
| 26 | Winston 架构师 | 流程设计：审计循环中，主 Agent 维护 `consecutive_pass_count`；收到 pass 且批判审计员无新 gap 则 +1，否则置 0；达到 3 即收敛。与 iteration_count（fail 次数）独立——iteration_count 统计 fail，consecutive_pass_count 统计连续 pass。 |
| 27 | 批判审计员 | 双重计数：实施后审计同时有 iteration_count（影响 tier 系数）和 consecutive_pass_count（收敛条件）。二者不冲突。写入 scoring 时 iteration_count 为 fail 次数；convergence 不写入，仅流程内部控制。 |
| 28 | John 产品 | 用户心智：若告知用户「本阶段需 3 轮审计验证」，用户可能觉得繁琐。若告知「质量门控，确保无遗漏」，则更容易接受。文档表述影响采纳率。 |
| 29 | Mary 分析师 | 需求追溯：Epic/Story 的 AC 是否在审计中被逐条验证？若单次审计仅做形式检查，3 轮也不会加深；若审计 prompt 已要求逐项验证，3 轮可降低「某次漏查」的概率。关键在 prompt 质量，非仅轮数。 |
| 30 | 批判审计员 | 3 轮的价值在于**多角度覆盖**：同一 prompt 多次运行，因 non-determinism 可能触发不同推理路径，有机会发现首次遗漏的点。非形式重复，而是「同一标准、多次独立判断」的集成。 |
| 31 | AI Coach | 与集成测试类比：跑 3 遍同样的用例，若环境确定则结果相同；若 LLM 输出有波动，3 遍可能暴露不一致。建议：3 轮中若有任一轮结论不同（如第 2 轮突然发现 gap），说明首次通过可能不稳，需修改；连续 3 轮一致，才可信。 |
| 32 | Amelia 开发 | 开发体验：若每阶段 3 轮，开发者等待时间明显。可优化——第 1 轮通过后，后台异步发起第 2、3 轮，并行？不可：第 2、3 轮审计的是同一产物，若第 1 轮通过后产物被修改，则第 2 轮应审计新产物。串行必要。 |
| 33 | 批判审计员 | 优化方向：**提前筛选**——只有「高风险」stage 才 3 轮；低风险单次。风险分级：§5 实施后 = 高；§4 tasks = 中（任务清单错误会导致错误实施）；§2 plan = 中；§1 spec、§3 gaps = 相对低。可仅 §4、§5 要求 3 轮。 |
| 34 | Winston 架构师 | 分级与 bmad-story 阶段对应：阶段二（Story 文档）= Create Story 产出物，若跳过 party-mode 则需补偿，建议 strict；阶段四（实施后）= 代码，必须 strict。speckit：§4、§5 可 strict；§1–§3 可 standard。 |
| 35 | AI Coach | 汇总分级建议：**必须 strict（3 轮无 gap + 批判审计员 >50%）**：实施后审计（bmad-story 阶段四、speckit §5.2、bmad-standalone-tasks Step 2）；Story 文档审计当跳过 party-mode 时（阶段二）。**可用 standard（单次 + 批判审计员）**：§1–§3、§4（tasks 若 <10 可 standard）。**simple 可配置**：用户显式选择快速模式。 |
| 36 | 批判审计员 | 质疑 standard 的「单次 + 批判审计员」：若仅单次，批判审计员视角注入能弥补「无 3 轮」的稳定性吗？批判审计员提升的是「单次深度」，3 轮提升的是「结论稳定性」。二者不同维度。standard 是折中，非等效。 |
| 37 | John 产品 | 折中可接受：strict 用于关键路径；standard 用于非关键。若所有 stage 都 strict，成本过高；若都 simple，质量无保障。分级是合理 tradeoff。 |
| 38 | Mary 分析师 | 追溯矩阵：stage → 严格度 → 触发条件。建议写入 skill 的决策表，便于 Agent 和用户查询。 |
| 39 | 批判审计员 | party-mode 跳过时的补偿：若用户明确说「已通过 party-mode 且审计通过」，阶段二可降级吗？ |
| 40 | AI Coach | 不可降级。即使用户跳过 Create Story（因已 party-mode），阶段二审计的仍是 Story 文档。若 party-mode 产出物已足够严格，阶段二审计是**验证**而非补偿。此时 standard（单次 + 批判审计员）可接受，因 party-mode 已提供深度。但若**完全跳过** Create Story（无 party-mode），阶段二必须 strict，补偿缺失的深度。 |

**共识（轮 21–40）**：3 轮提升结论稳定性，成本约 3×/阶段；分级策略：实施后 strict、Story 文档（跳过 party-mode 时）strict、其他 stage standard；party-mode 已执行时阶段二可 standard。

---

### 维度三：批判审计员引入方式（轮 41–60）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 41 | 批判审计员 | 如何将批判审计员「嵌入」code-review？选项：A) audit-prompts 扩展，每段增加「从批判审计员视角检查…」；B) 独立批判审计员 prompt 段落，要求输出「## 批判审计员结论」且占比 >50%；C) 独立 Agent 轮次，先常规审计再批判审计员审计。 |
| 42 | AI Coach | bmad-standalone-tasks 已用 B：审计 prompt 要求「报告须包含独立段落『## 批判审计员结论』，且该段落字数或条目数不少于报告其余部分」。即单次调用内，模型输出两部分——常规审计 + 批判审计员结论。可复用。 |
| 43 | Winston 架构师 | 与 code-reviewer-config.yaml 关系：当前 config 有 modes（code/prd/arch/pr），各模式有 dimensions。批判审计员是**跨模式**的增强，可在每个 mode 的 prompt 中注入。或新建 `audit-prompts-critical.md` 作为公共片段，被各 § 引用。 |
| 44 | Amelia 开发 | 实现成本：若每阶段审计 prompt 都加批判审计员段落，prompt 长度增加。需平衡。可提取为固定模板，append 到现有 audit-prompts 各 §。 |
| 45 | 批判审计员 | 批判审计员段落的**可验证性**：如何确保模型真的从对抗视角思考？若模型敷衍写「无 gap」，无法区分真无 gap 与敷衍。**缓解**：要求列出「已检查的质疑点」——如「已从遗漏任务、行号漂移、验收一致性、误伤漏网等角度检查，结论为…」。有结构可审计。 |
| 46 | AI Coach | 操作定义：批判审计员段落必须包含 1) 已检查的维度列表；2) 每维度结论；3) 「本轮无新 gap」或「本轮存在 gap」及具体项。缺任一项则判「审计报告格式不合格」，需重新生成。 |
| 47 | Mary 分析师 | 与 party-mode 批判审计员的一致性：party-mode 中批判审计员有 5W2H、红队思维等技巧；code-review 中是否要同等深度？code-review 的审计对象是文档/代码，非多方案讨论，质疑重点不同——偏「遗漏、矛盾、不可验证」，非「需求来源、ROI」。 |
| 48 | Winston 架构师 | code-review 批判审计员检查清单（精简）：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现、TDD 未执行。与 critical-auditor-guide 的 9.2、9.3、9.4 对齐，但聚焦文档/代码审计场景。 |
| 49 | 批判审计员 | 占比 >50% 的合理性：若报告共 1000 字，批判审计员段落需 ≥500 字。是否过重？bmad-standalone-tasks 的「不少于报告其余部分」即 ≥50%。目的：强制模型分配足够 token 给对抗视角，避免一笔带过。 |
| 50 | John 产品 | 用户阅读体验：审计报告变长，用户是否愿意读？若批判审计员段落有价值（真正发现遗漏），用户会认可。若敷衍，则流于形式。关键在于 prompt 质量与模型能力。 |
| 51 | AI Coach | 与 code-review 技能的衔接：speckit-workflow §0 要求显式调用 code-review 技能。若 audit-prompts 已含批判审计员要求，code-review 技能执行时自然带上。无需改 code-review 技能本身，改 audit-prompts 即可。 |
| 52 | 批判审计员 | audit-prompts 当前 §1–§5 为独立段落，无批判审计员。需在每个 § 末尾增加「批判审计员」要求，还是新建统一附录？统一附录更好——避免 5 处重复，修改一处即可。 |
| 53 | Amelia 开发 | 实现：audit-prompts.md 末尾加「## 批判审计员（所有阶段通用）」，内容为批判审计员段落要求与格式；§1–§5 的 prompt 模板注明「审计时须同时执行批判审计员检查，输出格式见附录」。 |
| 54 | Winston 架构师 | 与 audit-prompts-prd.md、audit-prompts-arch.md 等的关系：若项目有独立 prd/arch 审计文件，也需注入批判审计员。可建 `_bmad/references/audit-critical-auditor-appendix.md`，被所有 audit-prompts* 引用。 |
| 55 | 批判审计员 | 项目级覆盖：若项目希望「无批判审计员」的简化审计，如何 opt-out？通过 audit_convergence: simple 可同时表示「单次通过」+「无强制批判审计员段落」。但 standard 和 strict 必须含批判审计员。 |
| 56 | AI Coach | 汇总：批判审计员通过 prompt 注入实现；新建公共 appendix；§1–§5 及 prd/arch 审计均引用；simple 模式可省略；standard/strict 必须含。 |
| 57 | Mary 分析师 | 需求追溯：改进方案文档须明确「批判审计员段落」的必填结构，便于后续校验脚本检查报告格式。 |
| 58 | 批判审计员 | 校验脚本：若主 Agent 收到审计报告，可解析是否有「## 批判审计员结论」且字数占比。自动校验可防止模型省略。建议：审计通过的条件之一为「报告格式符合约定」。 |
| 59 | John 产品 | 自动化：若格式不合，主 Agent 应自动重试（要求子代理重新生成符合格式的报告），而非人工介入。流程自愈。 |
| 60 | AI Coach | 与 3 轮无 gap 的配合：strict 模式下，每轮报告均需含批判审计员段落且注明「本轮无新 gap」；连续 3 轮如此才收敛。格式与内容双重约束。 |

**共识（轮 41–60）**：批判审计员通过 prompt 注入；新建公共 appendix；simple 可省略；standard/strict 必须含；报告格式可自动校验；与 3 轮无 gap 配合。

---

### 维度四：与 bmad-standalone-tasks 对齐（轮 61–75）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 61 | 批判审计员 | bmad-standalone-tasks 实施后审计已强制 3 轮无 gap + 批判审计员 >50%。本方案是否将同一标准推广到 speckit §5.2、bmad-story 阶段四？若推广，三处逻辑一致，减少用户心智负担。 |
| 62 | Winston 架构师 | 对齐原则：**所有「实施后审计」**统一标准。实施后 = 代码/可运行产物已完成的审计。bmad-standalone-tasks、bmad-story 阶段四、speckit §5.2 均为实施后。三处 skill 均引用同一套规则。 |
| 63 | Amelia 开发 | 实现：可建 `_bmad/references/audit-post-impl-rules.md` 或整合进 speckit-workflow references，定义「实施后审计必须：3 轮无 gap、批判审计员 >50%、格式要求」。bmad-standalone-tasks、bmad-story、speckit 均引用该规则。 |
| 64 | AI Coach | 避免三处各自实现导致 drift。Single source of truth。 |
| 65 | 批判审计员 | bmad-story-assistant 的阶段四与 bmad-standalone-tasks 的 Step 2 是否同一逻辑？bmad-story 的 Dev Story 实施后，由阶段四审计；standalone 按 TASKS/BUGFIX 实施后，由 Step 2 审计。审计对象不同（Story 产出 vs BUGFIX 产出），但**审计标准**应一致。 |
| 66 | Mary 分析师 | 审计标准 = audit-prompts §5 + 批判审计员 + 3 轮无 gap。对象不同只影响具体检查项（如 BUGFIX 侧重 §4 修复方案、§7 任务覆盖），框架相同。 |
| 67 | John 产品 | 用户视角：无论走 bmad-story 还是 standalone-tasks，实施后审计体验一致——都是「3 轮验证通过才继续」。降低认知负担。 |
| 68 | 批判审计员 | skill 修改范围：bmad-standalone-tasks 已符合，无需大改；bmad-story-assistant 阶段四需加 3 轮无 gap 逻辑；speckit-workflow §5.2 需加。两处需改，一处已对齐。 |
| 69 | Winston 架构师 | bmad-story 阶段四的审计 prompt 是否已用 audit-prompts §5？若是，仅需在「审计闭环」描述中加「连续 3 轮无 gap 收敛」，并传入 3 轮逻辑的 prompt 给子代理。 |
| 70 | Amelia 开发 | prompt 模板：与 bmad-standalone-tasks Step 2 的审计 prompt 结构一致，仅 DOC_PATH、被审对象不同。可提取公共模板 `references/audit-post-impl-template.md`。 |
| 71 | AI Coach | 汇总：实施后审计统一规则；三处引用同一规则源；bmad-story、speckit 需补充 3 轮逻辑；standalone 已具备。 |
| 72 | 批判审计员 | 文档阶段（§1–§4）是否与 standalone 有对应？standalone 无 spec/plan/gaps/tasks 阶段，仅实施后。speckit 有 5 阶段。对齐仅针对「实施后」；文档阶段按前述分级。 |
| 73 | Mary 分析师 | 追溯完整：stage 类型 → 规则来源 → 严格度。实施后 → audit-post-impl-rules → strict；Story 文档（跳过 party-mode）→ 同上或专用 → strict；其他文档 → standard。 |
| 74 | John 产品 | 交付物：改进方案文档须含「与 bmad-standalone-tasks 对齐说明」，避免后续维护者不知三处关系。 |
| 75 | 批判审计员 | 无新 gap。本维度共识充分。 |

**共识（轮 61–75）**：实施后审计统一规则，三处引用同一源；bmad-story、speckit 需补充；standalone 已具备；文档阶段分级。

---

### 维度五：party-mode 跳过时的补偿与可配置性（轮 76–90）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 76 | 批判审计员 | party-mode 跳过判定：用户说「已通过 party-mode 且审计通过」时可跳过 Create Story。但 Agent 如何验证「已通过」？用户可能误说。是否有 audit trail（如 DEBATE_xxx.md、收敛纪要）可供审计员核查？ |
| 77 | AI Coach | 当前约定：用户**明确**说明时信任用户。若无 DEBATE 文档，审计员在阶段二仍可按 strict 执行，不因用户说跳过就降级。更保守的做法：仅当 story 目录下存在 `DEBATE_共识_*` 或 `party-mode 收敛纪要` 且内容与当前 Story 一致时，才允许阶段二降级到 standard。 |
| 78 | Winston 架构师 | 技术实现：阶段二审计前，主 Agent 检查 story 目录是否有 party-mode 产出物；若有且用户未强制 strict，则用 standard；若无或用户要求 strict，则用 strict。 |
| 79 | Amelia 开发 | 实现成本：检查文件存在即可，低成本。 |
| 80 | John 产品 | 用户体验：若每次都要用户说「已 party-mode」才降级，可能繁琐。若自动检测产出物，用户无感，更好。 |
| 81 | 批判审计员 | simple 模式适用：快速原型、探索性开发、非生产代码。谁可选 simple？用户显式传参（如 `--audit-mode simple`）或项目 config（如 `.speckit/config.yaml` 中 `audit_convergence: simple`）。 |
| 82 | AI Coach | 默认值：无配置时默认 standard。strict 用于高风险或用户要求。simple 仅用户显式选择。 |
| 83 | Mary 分析师 | 配置优先级：CLI 参数 > 项目 config > skill 默认。 |
| 84 | Winston 架构师 | 配置位置：`speckit-workflow` 或项目根 `.speckit/config.yaml`。若 BMAD 流程，可在 `_bmad-output` 或 epic 目录下 per-epic 覆盖。 |
| 85 | 批判审计员 | 可配置性滥用：若项目全局设 simple，则质量门控形同虚设。建议：simple 仅允许**单次任务/单次命令**覆盖，不鼓励项目级默认 simple。即项目 config 不允许 `audit_convergence: simple`，仅 CLI `--audit-mode simple` 可启用。 |
| 86 | AI Coach | 严格项目的保障：重要项目应显式设 `audit_convergence: strict`，避免误用 simple。 |
| 87 | John 产品 | 文档化：skill 中明确「simple 模式仅用于快速验证，不保证质量；生产发布前须 strict」。 |
| 88 | Mary 分析师 | 指标：若使用 simple，scoring 或 metadata 中记录 `audit_mode: simple`，便于事后筛选「哪些 run 用了低严格度」。 |
| 89 | Amelia 开发 | 实现：parseAndWriteScore 或 progress 中可加 `audit_convergence` 字段；CLI 传 `--audit-mode` 时写入。 |
| 90 | 批判审计员 | 汇总：party-mode 跳过时以产出物存在为依据降级；simple 仅 CLI 可选；项目 config 不建议 simple；记录 audit_mode 便于追溯。 |

**共识（轮 76–90）**：party-mode 跳过以产出物检测为依据；simple 仅 CLI；不鼓励项目级 simple；记录 audit_mode。

---

### 维度六：收敛与终审（轮 91–100）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 91 | 批判审计员 | 终审前检查：问题界定、质量 vs 效率、适用范围、批判审计员引入、与 standalone 对齐、party-mode 补偿、可配置性均已覆盖。是否有遗漏的 edge case？ |
| 92 | AI Coach | 补充：batch 执行（tasks 分批时）每批审计是否也需 3 轮？speckit-workflow 有「每批最多 20 任务，批间审计」。若实施后审计 strict 指「整个 implement 完成后的总审计」，则 batch 间审计可用 standard；仅最后总审计 strict。 |
| 93 | Winston 架构师 | 同意：batch 间审计是中间检查点，非最终交付门控。最终 §5.2 审计才需 strict。 |
| 94 | Amelia 开发 | 与 ralph-method 的 progress 更新：3 轮收敛过程中，每轮审计报告是否都写入 progress？建议仅收敛后的最终报告路径写入；中间轮次可留临时路径或仅在内存。 |
| 95 | Mary 分析师 | 审计证据：收敛后应保留 3 轮报告供追溯，还是仅保留最终轮？保留最终轮即可；若需复盘，可要求子代理在收敛时输出「3 轮结论一致」的摘要。 |
| 96 | John 产品 | 用户沟通：当进入 3 轮审计时，是否需提示用户「正在进行质量验证，需 3 轮通过」？避免用户忙于他事时误以为卡住。 |
| 97 | AI Coach | 实施建议：主 Agent 在发起第 2、3 轮前可输出「第 N 轮审计通过，继续验证…」。 |
| 98 | 批判审计员 | **本轮无新 gap**。所有维度已充分讨论，共识明确。可进入改进方案文档产出。 |
| 99 | AI Coach | **本轮无新 gap**。无补充。 |
| 100 | 批判审计员 | **终审陈述**：有条件同意当前共识方案。条件：改进方案文档须含 §1–§5，且 §5 任务列表可实施化；须明确 strict/standard/simple 的定义与适用 stage；须与 bmad-standalone-tasks 对齐说明。进入文档产出。 |

---

# 改进方案文档

## §1 问题与背景

### 1.1 问题描述

Gap 收敛机制（批判审计员 + 连续 3 轮无 gap）在 party-mode 和 bmad-standalone-tasks 实施后审计中已有定义，但与 speckit-workflow、bmad-story-assistant 的常规 code-review 审计**不同步**，导致：

1. **质量不均**：party-mode 常被跳过（多方案/歧义不存在时），实际常跑的 code-review（阶段二、四、speckit 各 stage）无批判审计员与 3 轮无 gap 约束，严格度可能不足。
2. **标准不一**：bmad-standalone-tasks 实施后审计已强制 3 轮 + 批判审计员 >50%；speckit §5.2、bmad-story 阶段四无此要求。
3. **效率担忧**：若全部 stage 都加 3 轮无 gap，审计成本约 3×，可能影响交付节奏。

### 1.2 背景

- **party-mode**：定义「批判审计员 + 近 2–3 轮无 gap」为收敛条件；涉及方案选择/设计决策时 100 轮。
- **bmad-standalone-tasks**：实施后审计强制批判审计员 >50%、连续 3 轮无 gap。
- **audit-prompts §1–§5**：各阶段审计 prompt 未含批判审计员要求；单次「完全覆盖、验证通过」即结束。
- **bmad-story-assistant**：禁止因 Story 已存在跳过 party-mode；仅用户明确说「已通过 party-mode 且审计通过」时可跳过。未规定 party-mode 跳过时 code-review 的补偿强度。

---

## §2 共识与争议

### 2.1 共识

1. **实施后审计统一 strict**：所有「实施后审计」（bmad-story 阶段四、speckit §5.2、bmad-standalone-tasks Step 2）必须 3 轮无 gap + 批判审计员 >50%。
2. **Story 文档审计分级**：当 party-mode 被跳过时，阶段二（Story 文档审计）须 strict 补偿；当 party-mode 已执行且产出物存在时，阶段二可用 standard。
3. **文档阶段分级**：§1 spec、§2 plan、§3 gaps 可用 standard（单次 + 批判审计员）；§4 tasks 建议 standard，可配置 strict。
4. **批判审计员 via prompt 注入**：新建公共 appendix，audit-prompts 各 § 引用；单次调用内输出「## 批判审计员结论」且占比 >50%。
5. **可配置性**：strict / standard / simple 三档；default standard；simple 仅 CLI 可选，不鼓励项目级 default simple。
6. **与 bmad-standalone-tasks 对齐**：实施后审计规则 Single source of truth；bmad-story、speckit 引用同一规则。

### 2.2 争议点（已收敛）

| 争议 | 结论 |
|------|------|
| 全 stage 是否都 3 轮 | 否；仅实施后 + Story 文档（跳过 party-mode 时）必须 strict |
| 批判审计员独立 Agent vs prompt 注入 | prompt 注入，与 bmad-standalone-tasks 一致 |
| simple 是否允许项目级 | 否；仅 CLI 单次可选 |
| party-mode 跳过如何判定 | 以产出物（DEBATE_共识_* 等）存在为依据，可降级阶段二到 standard |

---

## §3 推荐方案（tradeoff 理由）

### 3.1 分级策略

| 审计类型 | 严格度 | 批判审计员 | 收敛条件 | 理由 |
|----------|--------|------------|----------|------|
| 实施后审计 | strict | 必须，>50% | 3 轮无 gap | 代码/可运行产物，遗漏风险最高；统一与 bmad-standalone-tasks |
| Story 文档（跳过 party-mode） | strict | 必须，>50% | 3 轮无 gap | 补偿缺失的 party-mode 深度 |
| Story 文档（已 party-mode） | standard | 必须，>50% | 单次通过 | 已有深度，验证即可 |
| spec / plan / gaps | standard | 必须，>50% | 单次通过 | 文档阶段，成本敏感 |
| tasks | standard | 必须，>50% | 单次通过 | 可配置 strict；default standard |
| 快速验证 | simple | 可省略 | 单次通过 | 仅 CLI 可选，不保证质量 |

### 3.2 Tradeoff 理由

- **质量**：实施后与 Story（跳过 party-mode）strict，拦截最高风险场景。
- **效率**：文档阶段 standard，单次 + 批判审计员，平衡深度与成本。
- **一致性**：与 bmad-standalone-tasks 对齐，减少用户心智负担。
- **灵活性**：simple 满足快速验证；strict 满足发布前门控。

---

## §4 分阶段实施建议

### Phase 1：规则与 prompt 统一（P0）

1. 新建 `audit-prompts-critical-auditor-appendix.md`（或 `_bmad/references/` 下），定义批判审计员段落格式与必填结构。
2. 更新 `audit-prompts.md` §1–§5，各段末尾引用该 appendix。
3. 新建 `audit-post-impl-rules.md`，定义实施后审计的 strict 规则（3 轮无 gap、批判审计员 >50%）；bmad-standalone-tasks、bmad-story、speckit 均引用。

### Phase 2：skill 修改（P0）

4. **bmad-story-assistant**：阶段四审计闭环改为 strict（3 轮无 gap）；阶段二根据 party-mode 产出物存在与否选择 strict/standard。
5. **speckit-workflow**：§5.2 执行阶段审计改为 strict；§1.2–§4.2 改为 standard（单次 + 批判审计员）。
6. **bmad-standalone-tasks**：已符合，补充与 audit-post-impl-rules 的引用说明。

### Phase 3：可配置与追溯（P1）

7. 支持 `audit_convergence: strict | standard | simple` 配置；default standard；simple 仅 CLI。
8. scoring/progress 中可记录 `audit_mode` 便于追溯。
9. 文档化：何时可跳过 party-mode、party-mode 跳过时 code-review 的补偿规则。

### Phase 4：校验与体验（P2）

10. 审计报告格式校验：自动检查「## 批判审计员结论」存在且占比合格。
11. 3 轮进行中用户提示：主 Agent 在发起第 2、3 轮审计前输出「第 N 轮审计通过，继续验证…」

---

## §5 最终任务列表（可实施化）

| ID | 任务 | 验收 |
|----|------|------|
| GAP-CONV-01 | 新建 `skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`，定义批判审计员段落格式、必填结构（已检查维度、每维度结论、「本轮无新 gap/存在 gap」）；供 audit-prompts 各 § 用相对路径 `[批判审计员格式](audit-prompts-critical-auditor-appendix.md)` 引用 | 文件存在；内容符合约定；引用路径可解析 |
| GAP-CONV-02 | 更新 `audit-prompts.md` §1–§5 及 `audit-prompts-code/prd/arch/pr.md`（若存在），各段末尾增加「审计时须同时执行批判审计员检查，输出格式见 appendix」；appendix 为同目录 `audit-prompts-critical-auditor-appendix.md` | `rg -e 批判审计员 -e critical-auditor skills/speckit-workflow/references/audit-prompts*.md` 有匹配 |
| GAP-CONV-03 | 新建 `skills/speckit-workflow/references/audit-post-impl-rules.md`，定义实施后审计：3 轮无 gap、批判审计员 >50%、连续 3 轮定义、与 iteration_count 区分；含「与 audit-prompts §5 的引用关系」章节；被 bmad-standalone-tasks、bmad-story、speckit 引用 | 文件存在；含引用关系说明；三处 skill 引用该路径 |
| GAP-CONV-04 | bmad-story-assistant SKILL.md：阶段四审计闭环改为 strict（引用 audit-post-impl-rules，3 轮无 gap 逻辑） | 阶段四描述含「连续 3 轮无 gap」「批判审计员 >50%」 |
| GAP-CONV-05 | bmad-story-assistant SKILL.md：阶段二审计根据 party-mode 产出物存在选择 strict/standard；若无产出物或用户要求 strict，则 strict | 阶段二描述含「party-mode 产出物」「strict/standard」逻辑 |
| GAP-CONV-06 | speckit-workflow SKILL.md：§5.2 执行阶段审计改为 strict；明确 batch 间审计（每批完成后）= standard，仅全部 tasks 执行完毕后的**最终 §5.2 审计**= strict；引用 audit-post-impl-rules | §5.2 含 batch 间=standard、仅最终=strict；含 3 轮无 gap、批判审计员 |
| GAP-CONV-07 | speckit-workflow SKILL.md：§1.2–§4.2 改为 standard（单次 + 批判审计员），引用 appendix | 各段含批判审计员要求 |
| GAP-CONV-08 | bmad-standalone-tasks SKILL.md：补充「与 audit-post-impl-rules 对齐」说明 | 文档含对齐说明 |
| GAP-CONV-09 | 文档化「何时可跳过 party-mode」「party-mode 跳过时 code-review 补偿规则」至 bmad-story-assistant SKILL.md（新增或扩展相关章节） | bmad-story-assistant SKILL.md 可检索到明确说明 |
| GAP-CONV-10 | （P1）支持 audit_convergence 配置：项目 config、CLI；default standard；simple 仅 CLI 可选；项目 config 若含 `audit_convergence: simple` 则 skill 解析时拒绝或校验脚本报错 | 配置生效；项目级 simple 被拒绝可验证（验收示例：在 .speckit/config.yaml 写入 `audit_convergence: simple`，执行技能入口或校验脚本，预期报错且 exit code ≠ 0；或 grep 对应报错信息有匹配） |
| GAP-CONV-11 | （P1，**Deferred**）parseAndWriteScore 或 progress 可记录 audit_mode；若不实施则标注 Deferred，不阻断收敛 | **Deferred**：本文档标注；若实施：parseAndWriteScore 增加 audit_mode 写入 record |
| GAP-CONV-12 | （P2）审计报告格式校验：检查「## 批判审计员结论」存在且占比 ≥50%；主 Agent 或在子代理 prompt 中要求 | 校验逻辑存在 |
| GAP-CONV-13 | （P2）3 轮进行中用户提示：bmad-story、speckit、bmad-standalone-tasks 的审计流程描述中，主 Agent 在发起第 2、3 轮前输出「第 N 轮审计通过，继续验证…」 | 三处 skill 审计流程含该提示要求 |

**优先级**：GAP-CONV-01～09 为 P0；10～11 为 P1；12～13 为 P2。

---

*本辩论与改进方案由 party-mode 100 轮多角色辩论产出，满足收敛条件（共识 + 最后 3 轮无新 gap）。*
