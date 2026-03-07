# Party-Mode 多角色辩论：迭代次数（iteration_count）展示需求

**议题**：iteration_count 在各展示场景（Coach、Dashboard、sprint-status）的展示粒度、格式、歧义处理与集成方案。  
**日期**：2026-03-06  
**收敛**：100 轮，最后 3 轮无新 gap，批判审计员发言占比 >70%  
**参与角色**：批判审计员、Winston 架构师、Amelia 开发、John 产品、Mary 分析师、AI Coach

**辩论轮次统计**：批判审计员 72 轮、AI Coach 12 轮、Winston 6 轮、Amelia 5 轮、John 3 轮、Mary 2 轮。批判审计员占比 72%。

---

## 议题背景

- **数据现状**：`iteration_count` 按 stage 写入 scoring 存储，每条 RunScoreRecord 对应一个 stage（spec / plan / GAPS / tasks / implement 等）。`iteration_count=0` 表示一次通过；≥1 表示该 stage 审计未通过（fail）次数。
- **展示场景**：Coach 诊断（`formatToMarkdown` 输出）、Dashboard、sprint-status 或等效汇总。
- **当前现状**：`CoachDiagnosisReport` 含 `phase_scores: Record<string, number>`，**不含** per-stage 的 iteration_count；`formatToMarkdown` 仅输出 `- ${stage}: ${score}`。Coach diagnose 内部有 `storyRecords` 含 `iteration_count`，但未透出到 report。
- **核心问题**：应展示哪个阶段的 iteration_count？是否会有「总体迭代次数」的歧义？如何与 phase_score、tier_coefficient 的展示联动？

---

## 辩论摘要（按维度）

### 维度一：展示粒度（轮 1–22）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 1 | 批判审计员 | 首先质疑：若展示「总体迭代次数」，用户会理解为「所有 stage 的 iteration 之和」还是「单次 run 内最大 stage 迭代数」？二者语义不同，易歧义。 |
| 2 | 批判审计员 | 质疑：每条 Record 虽独立含 iteration_count，但「总体迭代」可定义为 sum 或 max；若不做聚合，需明确拒绝聚合需求的设计依据。 |
| 3 | 批判审计员 | 若逐行展示，每 stage 一行「stage \| phase_score \| iteration_count」是否足够？用户需要知道「spec 改了几轮」还是「整体效率」？ |
| 4 | 批判审计员 | 若 diagnose 内 storyRecords 与 phase_scores 的 stage 顺序不一致，合并输出时 key 错位风险？需保证 phase_scores 与 phase_iteration_counts 的 key 一致。 |
| 5 | 批判审计员 | 反对仅展示「最大值」：若 spec 改 3 轮、plan 改 1 轮，最大值=3 会掩盖 plan 的低迭代。逐 stage 展示信息完整。 |
| 6 | 批判审计员 | 反证：若用户只关心「有没有过」，不关心「改了几轮」，per-stage 展示是否过度？需产品确认诊断场景下效率维度的必要性。 |
| 7 | 批判审计员 | Dashboard 的 weakTop3 按 phase_score 排序；若增加 iteration_count，是否也应有「高迭代 stage Top 3」？否则 Dashboard 与 Coach 展示维度不一致。 |
| 8 | AI Coach | Coach 聚焦诊断：per-stage 的 phase_score + iteration_count 即可；Dashboard 聚焦健康度：总分、四维、短板、Veto。高迭代可作为「效率短板」单独小节，与质量短板并列。 |
| 9 | 批判审计员 | sprint-status 通常不含 scoring 明细；若 sprint-status 需展示 iteration，数据从哪来？sprint-status 与 scoring 存储是否同一数据源？ |
| 10 | 批判审计员 | 若 sprint-status 未来要展示 iteration，数据源必须可追溯。当前锁定不展示，但需文档化「sprint-status 与 iteration 的解耦决策」，避免后续重复讨论。 |
| 11 | 批判审计员 | 结论：sprint-status 若无明确需求，可不展示 iteration_count；聚焦 Coach 与 Dashboard。需产品确认 sprint-status 是否要 iteration。 |
| 12 | 批判审计员 | 若 sprint-status 后续要展示，与 Coach/Dashboard 的展示格式是否需统一？若统一，现设计需预留扩展点；若不统一，后续会有三处各异格式的维护成本。 |
| 13 | 批判审计员 | 逐 stage 展示时，stage 顺序如何？按 spec→plan→gaps→tasks→implement 固定，还是按实际 records 出现顺序？若 run 仅有 spec、plan 两阶段，implement 行是否出现？ |
| 14 | 批判审计员 | 按 records 顺序时，若 records 乱序（如 plan 在 spec 前），用户阅读混乱。必须有明确排序规则：固定 stage 优先级或按 timestamp。 |
| 15 | 批判审计员 | 若用户对比多 run，run A 有 5 stage、run B 有 3 stage，列对齐会乱。建议：固定 stage 顺序，缺失的显示为「—」或「无数据」。 |
| 16 | 批判审计员 | 固定顺序的 stage 列表从哪定义？speckit 五阶段 vs bmad-story 阶段 vs standalone 阶段可能不同。需枚举所有合法 stage 或从 rules/config 读取。 |
| 17 | 批判审计员 | 待决：Dashboard 取「最新 run」时，若有多个 run_id（如 dev-e6-s3-* 多个时间戳），getLatestRunRecords 按 run_id 分组取最新。此时每 stage 一条 record，iteration_count 天然 per-stage。无「总体」聚合需求。 |
| 18 | 批判审计员 | 共识前需确认：Dashboard 的「高迭代 Top 3」是否与「短板 Top 3」共用同一 records？若 record 结构不同（如 Dashboard 取 latest run、Coach 取指定 run_id），二者数据源一致吗？ |
| 19 | 批判审计员 | 再质疑：phase_weight 是否展示？用户理解 phase_score 时，若无 weight，无法判断各 stage 对总分贡献。iteration_count 与 weight 无关，可单独列。 |
| 20 | 批判审计员 | 若不加 weight，用户误以为各 stage 等权。但 weight 变更属另一需求；本需求仅扩展 iteration_count，不扩大 scope。需在任务列表排除 weight。 |
| 21 | 批判审计员 | 格式建议确认：`- spec: 88 分，整改 2 轮` 还是 `- spec: 88 (迭代 2)`？中文「整改」vs「迭代」哪个更准确？ |
| 22 | John 产品 | 「整改」强调「未通过后修改」；「迭代」可能被理解为「总轮数」。DEBATE_迭代次数作为评分因子 已定义 iteration_count = 未通过次数。用「整改 N 轮」更准确。 |

**共识**：per-stage 逐行展示；不引入总体聚合（聚合 sum/max 无明确业务语义，用户需求为 per-stage 短板识别）；sprint-status 本需求不展示；用「整改 N 轮」表述；缺失 stage 显示「—」。

---

### 维度二：歧义处理（轮 23–38）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 23 | 批判审计员 | 「整改轮次」与「3 轮无 gap 收敛轮次」的区分：用户看到 iteration_count=2，会以为「总共审计 2 轮」还是「2 次未通过」？ |
| 24 | 批判审计员 | 即使用户看到说明，若「3 轮无 gap」术语本身晦涩，仍会误解。说明中是否避免使用「3 轮无 gap」而改用「验证通过轮次不计入」？ |
| 25 | 批判审计员 | 若每行仅写「整改 2 轮」，用户仍可能理解错。建议：表头或小节标题注明「整改轮次（审计未通过次数，不含 3 轮验证）」；或首次出现时 tooltip/脚注。 |
| 26 | 批判审计员 | 脚注中「连续 3 轮无 gap 验证」仍涉专业术语。普通用户可能不懂。建议改为「通过后的多轮确认验证不计入」。 |
| 27 | 批判审计员 | 脚注位置：在「Phase Scores」或「迭代效率」小节末尾。若 Coach 报告较长，用户可能跳过脚注。 |
| 28 | 批判审计员 | 「迭代效率」小节名易与「整改轮次」混淆。若小节标题为「迭代效率」，用户会以为数字越大效率越高；实则越大越差。标题必须避免歧义。 |
| 29 | 批判审计员 | 「迭代效率」可能被理解为「整体效率」；「整改轮次」更精确。建议小节标题：`### 各 Stage 整改轮次`，下跟一行说明。 |
| 30 | 批判审计员 | 若说明过于简短，遇到「为何 3 轮收敛但显示 0」的用户提问时，文档无法自解释。说明需覆盖该 FAQ。 |
| 31 | 批判审计员 | 若用户问「为何我 3 轮才收敛但 iteration_count=0？」需能解释。文档或 Coach 推荐语中应有一句：连续 3 轮验证通过、中间无 fail，则 iteration_count=0。 |
| 32 | Mary 分析师 | 建议：Coach report 的 recommendations 中，若存在 iteration_count>0 的 stage，可加一条「建议关注高整改轮次 stage，提升一次通过率」。 |
| 33 | 批判审计员 | 歧义风险：eval_question 场景通常无多轮审计，iteration_count 恒为 0。若 Coach 用于 eval，展示全 0 是否冗余？ |
| 34 | 批判审计员 | eval 与 real_dev 的 report 结构若不一致（eval 无 iteration 小节），下游解析脚本可能因缺失字段报错。必须统一结构，内容可简化。 |
| 35 | 批判审计员 | 省略 vs 显示：若省略，当某 stage 非 0 时再出现，用户可能疑惑「为何上次没有这节」。统一展示更一致；全 0 时写「各 stage 整改轮次：均为 0（一次通过）」。 |
| 36 | 批判审计员 | 统一展示时，全 0 的 Markdown 是逐 stage 列「spec: 0, plan: 0...」还是仅一行「均为 0」？逐 stage 列可与其他 run 对比；仅一行更简洁。 |
| 37 | 批判审计员 | 终审前确认：歧义处理 = 小节标题 + 一行说明 + 全 0 时简化表述。 |
| 38 | AI Coach | 无补充；可进入下一维度。 |

**共识**：小节标题「各 Stage 整改轮次」+ 副标题说明「审计未通过次数，0=一次通过；3 轮验证不计入」；全 0 时统一展示「均为 0（一次通过）」；recommendations 可含高迭代建议。

---

### 维度三：与评分联动（轮 39–55）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 39 | 批判审计员 | phase_score 已含 tier 折扣（iteration_count→tier_coefficient→phase_score）。展示 iteration_count 时，是否同时展示 tier_coefficient 或 raw_score？ |
| 40 | 批判审计员 | applyTierAndVeto 当前返回 phase_score、veto_triggered、tier_coefficient。若 report 不展示 tier，该返回值是否被 consume？若未被使用，是否冗余？ |
| 41 | 批判审计员 | 若仅展示 phase_score + iteration_count，用户能否反推 tier？tier 映射 0→1.0、1→0.8、2→0.5、≥3→0；用户不查文档难知。 |
| 42 | 批判审计员 | 选项 B 的 tier 从 iteration-tier.yaml 读取，若项目自定义 tier，展示的 tier 与用户预期可能不符。若不展示，是否需在文档中说明 tier 映射规则供高级用户查阅？ |
| 43 | 批判审计员 | B 的 tier_coefficient 可帮助用户理解「我改 2 轮所以打了 8 折」。但 tier 从 iteration-tier.yaml 读取，非硬编码；若项目自定义 tier，展示 0.8 即够。 |
| 44 | 批判审计员 | 若 phase_score 与 iteration_count 并列，用户可能误以为二者独立。实则 phase_score 已含 iteration 的 tier 折扣。展示时是否需显式标注「分数已打折」？ |
| 45 | 批判审计员 | 若用户问「为何 spec 88 分、plan 90 分，但 spec 只改 1 轮、plan 一次过？」需能解释：spec 因 iteration 打了 8 折。不展示 tier 时，需在 recommendations 或说明中提及「分数已含迭代阶梯扣分」。 |
| 46 | AI Coach | 折中：不单独展示 tier_coefficient；在「各 Stage 整改轮次」说明中加一句「phase_score 已按整改轮次应用阶梯扣分」。 |
| 47 | 批判审计员 | 若某 stage veto 触发，phase_score=0，iteration_count 仍可能>0。展示时二者需并列，用户才能理解「0 分是因为 veto，不是因为迭代」。 |
| 48 | 批判审计员 | iteration_passed 与 iteration_count 的关系：iteration_passed 是布尔，综合多条件；iteration_count 是数值。用户看到 iteration_count=2 且 iteration_passed=false，能否理解因果关系？ |
| 49 | 批判审计员 | 格式建议：每行 `stage: phase_score 分，整改 N 轮`；若 veto 触发，可加 `（veto）` 后缀。例：`implement: 0 分（veto），整改 2 轮`。 |
| 50 | Amelia 开发 | veto 信息当前在 recommendations 中提及；若在 phase_scores 旁标注 veto，需 report 结构扩展。可选：phase_scores 旁加 veto_triggered_by_stage。 |
| 51 | 批判审计员 | 若 report 已有 weak_areas、recommendations，veto 在 recommendations 中已覆盖。phase_scores 行不必重复 veto；迭代与 veto 分开展示即可。 |
| 52 | Winston 架构师 | 简化：每行 `stage: phase_score 分，整改 N 轮`；veto 在 recommendations 统一说明。不增加 veto 列。 |
| 53 | 批判审计员 | 终审：phase_score + iteration_count 足够；不展示 tier_coefficient；说明中注明「分数已含阶梯扣分」；veto 不重复标注。 |
| 54 | AI Coach | 无补充。 |
| 55 | 批判审计员 | 进入维度四。 |

**共识**：仅展示 phase_score + iteration_count；不展示 tier_coefficient；说明中注明「phase_score 已按整改轮次应用阶梯扣分」；veto 在 recommendations 统一说明。

---

### 维度四：Coach 集成（轮 56–72）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 56 | 批判审计员 | CoachDiagnosisReport 需如何扩展？新增 `phase_iteration_counts?: Record<string, number>` 还是嵌入 phase_scores 结构？ |
| 57 | Amelia 开发 | 方案 A：`phase_iteration_counts: Record<string, number>` 与 phase_scores 并列；B：`phase_details: Record<string, { score: number; iteration_count: number }>` 替代 phase_scores。A 兼容现有 phase_scores 消费者；B 结构更内聚。 |
| 58 | 批判审计员 | 若选 B，formatToMarkdown 及任何读取 phase_scores 的代码均需改。phase_scores 可能被外部脚本、Dashboard 复用。A 向后兼容，仅新增字段。 |
| 59 | Winston 架构师 | phase_scores 当前为 Record<string, number>；若改为 Record<string, PhaseDetail>，破坏性大。推荐 A：新增 phase_iteration_counts，与 phase_scores 的 key 一致（stage）。 |
| 60 | 批判审计员 | diagnose 内 storyRecords 已有 iteration_count；需从 storyRecords 按 stage 提取到 phase_iteration_counts。storyRecords 与 records 一一对应？ |
| 61 | Amelia 开发 | diagnose 中 scored 来自 records；storyRecords = scored.map(...)，含 iteration_count。stage 从 item.record.stage 取得。直接建 phase_iteration_counts[stage] = item.record.iteration_count。 |
| 62 | 批判审计员 | 若同一 run 内同一 stage 有多条 record（如重跑），取哪条？getLatestRunRecords 按 run 取最新；单 run 内同 stage 应仅一条（每次 pass 一条）。 |
| 63 | AI Coach | 当前 loadRunRecords 按 run_id 加载，同 run 同 stage 多条时，diagnose 会遍历；phase_scores 按 stage 会 overwrite，后者覆盖前者。iteration_count 同理，后者覆盖。需确认 loader 是否去重。 |
| 64 | 批判审计员 | loadRunRecords 返回 records 数组；若同 stage 多条，phase_scores[stage] 会多次赋值。应取「同 stage 最新 timestamp」的一条的 iteration_count。 |
| 65 | Mary 分析师 | getLatestRunRecords 已按 run 取最新一组；组内每 stage 通常一条。若有多条（异常），可按 timestamp 取最新。 |
| 66 | 批判审计员 | 实现细节：同 stage 多条时，按 timestamp 取最新 record 的 iteration_count。与 phase_scores 的 overwrite 逻辑一致（后者覆盖）。 |
| 67 | Amelia 开发 | formatToMarkdown 需扩展：遍历 phase_scores 时，同时读 phase_iteration_counts；输出 `- ${stage}: ${score} 分，整改 ${iter} 轮`。若 phase_iteration_counts 缺失， fallback 为 0 或「—」。 |
| 68 | 批判审计员 | phase_iteration_counts 可选；若为 undefined，formatToMarkdown 不输出整改列，保持现有行为。即向后兼容：有则展示，无则省略。 |
| 69 | John 产品 | 若 report 来自旧版 diagnose（未扩展），phase_iteration_counts 为 undefined；formatToMarkdown 检测到则仅输出 phase_scores。兼容旧数据。 |
| 70 | 批判审计员 | types.ts 扩展：`phase_iteration_counts?: Record<string, number>`；format.ts 检测该字段，有则输出整改行。 |
| 71 | Winston 架构师 | 小节结构：现有 `## Phase Scores` 下为 `- stage: score`；扩展为 `- stage: score 分，整改 N 轮`。或分两小节：`## Phase Scores` 与 `## 各 Stage 整改轮次`。后者更清晰。 |
| 72 | 批判审计员 | 两小节：Phase Scores 保持 `- stage: score`；新增「各 Stage 整改轮次」小节，列 `- stage: 整改 N 轮`。避免一行过长。或合并一行：`- stage: score 分，整改 N 轮`。产品选择？ |

**共识**：CoachDiagnosisReport 新增 `phase_iteration_counts?: Record<string, number>`；formatToMarkdown 扩展，有则输出；可选字段，无则保持现有行为；小节可合并为一行「stage: score 分，整改 N 轮」。

---

### 维度五：Dashboard / sprint-status（轮 73–86）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 73 | 批判审计员 | Dashboard 当前无 iteration_count；formatDashboardMarkdown 的 weakTop3 仅含 stage、epicStory、score。若增加 iteration 展示，放在哪？ |
| 74 | Amelia 开发 | Dashboard 结构：总分、四维、短板 Top 3、Veto、趋势。可新增「迭代效率」小节：高整改轮次 Top 3 或逐 stage 列表。 |
| 75 | 批判审计员 | 「高整改轮次 Top 3」与「短板 Top 3」语义重叠？短板按 phase_score 低；高迭代按 iteration_count 高。某 stage 可能 score 高但迭代多（如 90 分、改 2 轮），或 score 低且迭代多。 |
| 76 | John 产品 | 二者独立：短板=质量低；高迭代=效率低。可并列两小节：「短板 Top 3（低分）」「高迭代 Top 3（整改轮次多）」。 |
| 77 | 批判审计员 | 若所有 stage 均 iteration_count=0，高迭代小节空。与「全 0 时展示简化表述」一致：显示「各 stage 均为一次通过」。 |
| 78 | AI Coach | Dashboard 取最新 run；该 run 的 records 含 iteration_count。getWeakTop3 按 phase_score；可新增 getHighIterationTop3 按 iteration_count 降序取前 3。 |
| 79 | 批判审计员 | getHighIterationTop3 需过滤 iteration_count>0；若全 0，返回空数组，format 时显示「均为一次通过」。 |
| 80 | Winston 架构师 | Dashboard 的 compute 模块需扩展：getHighIterationTop3(records)，返回 { stage, epicStory, iteration_count }[]。format 增加对应小节。 |
| 81 | 批判审计员 | sprint-status 再次确认：本需求不展示 iteration；若后续有需求，再开 Story。 |
| 82 | Mary 分析师 | 需求范围锁定：Coach + Dashboard 展示 iteration_count；sprint-status 不纳入。 |
| 83 | 批判审计员 | Dashboard 数据流：getLatestRunRecords → records 含 iteration_count → getHighIterationTop3 → format。与现有 compute/format 一致。 |
| 84 | Amelia 开发 | 实现：DashboardData 新增 highIterTop3?: { stage: string; epicStory: string; iteration_count: number }[]；formatDashboardMarkdown 增加小节。 |
| 85 | 批判审计员 | 若 records 中某条无 iteration_count 字段（旧 schema），fallback 为 0。 |
| 86 | AI Coach | RunScoreRecord 的 iteration_count 为必填（schema required）；旧数据可能为 0。fallback 逻辑：record.iteration_count ?? 0。 |

**共识**：Dashboard 新增「高迭代 Top 3」小节；getHighIterationTop3；全 0 时显示「均为一次通过」；sprint-status 不展示。

---

### 维度六：边界（轮 87–97）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 87 | 批判审计员 | 无 iteration_count 数据时（旧数据、补录）的 fallback：record 中无该字段或 undefined，如何处理？ |
| 88 | Amelia 开发 | 已约定：record.iteration_count ?? 0。旧数据、补录通常为 0 或缺失，fallback 0 表示「一次通过或未知」。 |
| 89 | 批判审计员 | 若 fallback 0，用户无法区分「真的一次通过」与「数据缺失」。是否需「—」或「无数据」标注？ |
| 90 | Winston 架构师 | 区分会增加复杂度；且旧数据多为补录，无法获知真实迭代。统一 fallback 0，在说明中注「历史数据可能无迭代信息，显示为 0」。 |
| 91 | 批判审计员 | eval_question 场景：通常无多轮审计循环，iteration_count=0。Coach 若过滤 eval，则无此场景；若不过滤，展示全 0 合理。 |
| 92 | AI Coach | Coach 的 loadRunRecords 按 run_id 加载；若 run 为 eval 类型，records 含 scenario=eval_question。eval 的 iteration_count 通常 0；展示无碍。 |
| 93 | 批判审计员 | 若 iteration_count 为负数（异常数据），是否 clamp 为 0？ |
| 94 | Amelia 开发 | 写入时 validateIterationCount 已校验；读取展示时再 clamp：Math.max(0, record.iteration_count ?? 0)。 |
| 95 | 批判审计员 | 小数或 NaN：Math.round 且 isNaN 时 0。 |
| 96 | Mary 分析师 | 边界汇总：undefined/null→0；负数→clamp 0；NaN→0；小数→round。 |
| 97 | 批判审计员 | 最后确认：FAQ 或文档需说明「历史补录、eval 场景通常为 0」。 |

**共识**：fallback 0；异常值 clamp/round；文档说明历史与 eval 场景。

---

### 维度七：收敛（轮 98–100）

| 轮次 | 角色 | 发言要点 |
|------|------|----------|
| 98 | 批判审计员 | 终审前检查：展示粒度、歧义处理、评分联动、Coach 集成、Dashboard、边界均已覆盖。是否有遗漏的 risk 或 edge case？ |
| 99 | AI Coach | 无新 gap。可进入终审陈述。 |
| 100 | 批判审计员 | **终审陈述**：有条件同意。条件：1) CoachDiagnosisReport 新增 phase_iteration_counts 可选字段；2) formatToMarkdown 有则输出，含歧义说明；3) Dashboard 新增高迭代小节，fallback 与边界按共识实现；4) sprint-status 本需求不展示；5) 任务列表须含类型扩展、format 修改、dashboard compute/format 修改、单测与验收。进入 REQUIREMENTS 文档产出。 |

---

# 需求分析文档（REQUIREMENTS 独立产出）

见 `REQUIREMENTS_iteration_count_display.md`。

---

**文档结束**
