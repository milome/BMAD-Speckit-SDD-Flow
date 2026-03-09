# AUDIT_TASKS：BUGFIX_scoring-write-stability §4 第 7 轮审计报告

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 审计元信息

| 项目 | 值 |
|------|-----|
| 被审对象 | `_bmad-output/implementation-artifacts/_orphan/BUGFIX_scoring-write-stability.md` |
| 需求依据 | §1 问题描述、§2 根因分析、§4 修复方案、§5 验收标准、§8 双保险方案 |
| 本轮次 | 第 7 轮 |
| 审计范围 | §7（T1～T10）、§9（T11～T20）完整任务列表 |
| 审计标准 | 需求覆盖、任务可执行性、依赖与一致性、边界与遗漏、集成 |
| 上一轮 | round5、round6 均为「完全覆盖、验证通过」「本轮无新 gap」；连续 2/3 轮无 gap |

---

## 1. 需求覆盖审计

对照 §1、§2、§4、§5、§8，逐条核验 §7 与 §9 任务覆盖情况：

| 需求来源 | 需求要点 | 任务覆盖 | 结论 |
|----------|----------|----------|------|
| §1.1 | 阶段二无显式步骤 2.2，parse-and-write-score 易遗漏 | T1、T11、T12 | ✓ 完全覆盖 |
| §1.2 | implement 可解析块维度错误（tasks 四维 vs code 四维） | T2、T3、T4、T5 | ✓ 完全覆盖 |
| §1.3 | 阶段二缺少与阶段四对等的显式步骤 | T1 | ✓ 完全覆盖 |
| §4.1～§4.4 | 阶段二 2.2、阶段四 code 四维、appendix §7.1、WARN 告警 | T1～T4 | ✓ 完全覆盖 |
| §5 验收 1～5 | 全部 5 项验收 | T1～T5 及 E2E | ✓ 完全覆盖 |
| §8 双保险 | 子代理写（6 stage）+ 主 Agent check 准入 | T11～T20 | ✓ 完全覆盖 |
| MIN_STAGES 方案 A | MIN=2、文案、单测、文档 | T6～T10 | ✓ 完全覆盖 |

**需求覆盖结论**：§7（T1～T10）与 §9（T11～T20）完整覆盖 §1～§8 及 MIN_STAGES 方案。

---

## 2. 任务可执行性审计

### T1～T10 源码复核

| ID | 路径/行号 | 修改内容 | 验收 | 结论 |
|----|-----------|----------|------|------|
| T1 | skills/bmad-story-assistant/SKILL.md 存在 | 步骤 2.2 插入位置、CLI 完整 | grep 6 项 | ✓ |
| T2 | 同 T1 | 三处修改已明确 | grep 5 项 | ✓ |
| T3 | skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md 存在 | §7.1 全文已给出 | grep 6 项 | ✓ |
| T4 | scoring/orchestrator/parse-and-write.ts 第 142～150 行 | 在 dimensionScores 计算后、write 前插入 WARN | mock + stderr | ✓ |
| T5 | scripts/check-story-score-written.ts 存在（当前无 --stage） | 扩展 dimension_scores 校验 | 已知空 record | ✓ |
| T6 | compute.ts 第 168 行为 JSDoc 注释 | MIN=2、注释更新 | grep 得 2、单测 | ✓ |
| T7 | scripts/dashboard-generate.ts 第 30 行 INSUFFICIENT_RUN_MESSAGE | 替换为「至少 2 stage」 | grep | ✓ |
| T8 | compute.test.ts 第 224 行含 ">=3 stages" | 2-stage 用例、保留 3-stage | 单测 | ✓ |
| T9 | RUN_ID_CONVENTION.md 已有 §4.1、§4.2 | 在 §4.2 或适当地点增加 MIN_STAGES 说明 | grep | ✓ |
| T10 | TASKS_Epic级仪表盘聚合.md 第 104 行 US-1.2「≥3 stage」 | 改为 ≥2 stage | grep | ✓ |

### T11～T20 路径与模板复核

| ID | 路径/模板 | 修改内容 | 验收 | 结论 |
|----|-----------|----------|------|------|
| T11 | STORY-A2-AUDIT（第 555、559 行） | 【审计通过后必做】全文已给出 | grep 4 项 | ✓ |
| T12 | 阶段二「审计通过后评分写入触发」之后 | 步骤 2.3 流程完整 | grep 3 项 | ✓ |
| T13～T17 | audit-prompts §1～§5【审计后动作】已确认（第 17、27、37、81、116 行） | 改为子代理执行 + CLI 块 | grep stage/triggerStage | ✓ |
| T18 | STORY-A4-POSTAUDIT（第 1375 行） | 【审计通过后必做】全文已给出 | grep 4 项 | ✓ |
| T19 | scripts/check-story-score-written.ts | --stage story/implement 扩展 | 已知 record 验证 | ✓ |
| T20 | 步骤 4.3 | check --stage implement、DIMENSION_SCORES_MISSING 补跑 | grep 3 项 | ✓ |

**可执行性结论**：全部 20 项任务路径可定位、修改内容明确、验收可量化。parse-and-write-score.ts 已确认支持 --stage、--triggerStage、--event、--iteration-count、--artifactDocPath；config/scoring-trigger-modes.yaml call_mapping 与 T13～T17 triggerStage（speckit_1_2～speckit_5_2）一致。

---

## 3. 依赖与一致性审计

| 检查项 | 结果 |
|--------|------|
| T1 与 T11、T12 | §8 衔接已明确：主 Agent 先执行步骤 2.3 check，若 yes 则无需步骤 2.2；若 no 则补跑 |
| T5 与 T19、T20 | T5 扩展 dimension_scores 校验；T19 扩展 --stage；T20 引用 DIMENSION_SCORES_MISSING 补跑；无冲突 |
| T15 GAPS stage=plan | 与 config 及 speckit_3_2 一致；artifactDocPath IMPLEMENTATION_GAPS 已明确 |
| §7 三表与 §9 | T1～T10 沿用；T11～T20 新增；覆盖清单表完整 |
| 禁止词 | 全文无违规 |

**一致性结论**：依赖正确、与需求无矛盾。

---

## 4. 边界与遗漏审计

| 维度 | 检查结果 |
|------|----------|
| T6 行号 | compute.ts 第 168 行为 JSDoc 注释，第 169 行为常量；T6「第 168 行注释」正确 |
| 路径解析 | T1、T2、T3、T11～T18 已定义项目内优先或全局 fallback |
| T4、T5 验收 | mock 报告、已知空 record 产生方式已说明 |
| GAP-D1 | 已记录为 Deferred Gap |
| 阶段覆盖 | story/spec/plan/GAPS/tasks/implement 六阶段与 T11～T18、T12/T20 一一对应 |

**边界结论**：边界条件、异常路径均已定义。

---

## 5. 集成/端到端审计

| 检查项 | 结果 |
|--------|------|
| §5 验收 4、5 | E2E 回归方式已定义 |
| 步骤 4.3 闭环 | check → 补跑 → 再 check；T5 识别 dimension_scores 为空，闭环完整 |
| 双保险衔接 | 主保险（T11、T13～T18）与次保险（T12、T20）清晰 |
| 孤岛任务 | 无 |

**集成结论**：E2E 由 §5 定义，双保险闭环完整。

---

## 批判审计员结论

**已检查维度列表**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、任务描述歧义、禁止词、依赖错误、路径漂移、§7/§9 表一致性、可追溯性、可解析输出、CLI 完整性、§5 与 §7 验收项逐条对照、T6 行号与源码一致性、双保险衔接、阶段覆盖完整性、T13～T17 triggerStage 与 call_mapping 一致性、parse-and-write-score 参数支持、check-story-score-written 当前能力、RUN_ID_CONVENTION §4.2 存在性、TASKS_Epic级仪表盘聚合 US-1.2 当前表述、compute.test.ts 用例名称可定位性、audit-prompts §1～§5【审计后动作】可定位性、STORY-A2-AUDIT/STORY-A4-POSTAUDIT 模板可定位性、T4 插入点与 write 流程一致性、T9 与 RUN_ID_CONVENTION 现有结构兼容性、T19 扩展与 T12/T20 调用方式兼容性、T15 GAPS stage=plan 与 speckit 流程语义一致性、T17 triggerStage speckit_5_2 与 implement 审计对应关系、parseAndWriteScore 写入前 WARN 插入时机可操作性、双保险下 T1 步骤 2.2 与 T11 子代理写不发生双写的充分条件。

**每维度结论**：

1. **遗漏需求点**：§7 T1～T10 覆盖 §1～§5 及 MIN_STAGES 方案；§9 T11～T20 覆盖 §8 双保险六阶段。无遗漏。

2. **边界未定义**：路径解析、iteration_count、T4 mock、T5 空 record、GAP-D1、T6 修改对象均已定义。无未定义边界。

3. **验收不可执行**：T1～T3、T6～T7、T9～T10、T11～T12、T18、T20 为 grep 或结构化验证；T4、T5、T8、T19 为 mock/预置数据 + 执行验证。全部可执行、可量化。

4. **与前置文档矛盾**：§7 与 §4、§5 一致；round4～round6 已修正 T1 验收与 T6 行号。无矛盾。

5. **孤岛模块**：无。全部任务服务于根因修复或双保险方案。

6. **任务描述歧义**：修改内容、插入位置、CLI 参数、验收标准均已明确；T2 speckit-workflow 联动、T15 GAPS stage=plan 已澄清。

7. **禁止词**：全文扫描 §4、§6、§7、§8、§9 及补充说明，无违规。

8. **依赖错误**：T1～T3 可并行；T2 与 T3 联动；T11 与 T1、T12 衔接已在 §8 明确；无循环依赖。

9. **路径漂移**：skills/bmad-story-assistant、skills/speckit-workflow、scripts/parse-and-write-score.ts、scripts/check-story-score-written.ts、scoring/orchestrator/parse-and-write.ts、scoring/dashboard/compute.ts、scoring/docs/RUN_ID_CONVENTION.md、TASKS_Epic级仪表盘聚合.md 均已确认存在；skills 路径为项目内或全局 fallback。

10. **§7/§9 表一致性**：第一份 §7 表为简化版，Party-Mode 为权威版；§9 沿用 T1～T10，新增 T11～T20，覆盖清单表完整。

11. **可追溯性**：每任务 ID 与 §4 子节、§5 验收项、§8 层级可一一对应。

12. **可解析输出**：T5 输出须可解析以支持步骤 4.3；DIMENSION_SCORES_MISSING:yes 或等效已明确；T20 引用 DIMENSION_SCORES_MISSING 补跑。

13. **CLI 完整性**：T1、T11、T12、T13～T18 的 parse-and-write-score、check-story-score-written 完整 CLI 均已给出；parse-and-write-score.ts 源码已确认支持 reportPath、stage、epic、story、event、triggerStage、artifactDocPath、iteration-count。

14. **§5 与 §7 验收项**：第一份表 T1 验收已含 parse-and-write-score，与 §5 验收 1 一致。

15. **T6 行号与源码一致性**：compute.ts 第 168 行为 JSDoc 注释，第 169 行为常量定义。T6「同步更新第 168 行注释」正确。**源码复核通过**。

16. **双保险衔接**：§8 已明确主 Agent 应先执行步骤 2.3 check，若 yes 则无需步骤 2.2；若 no 则补跑。T11 子代理写在审计通过时于返回前执行；主 Agent check 作为次保险。不发生双写。

17. **阶段覆盖完整性**：阶段覆盖清单表 story/spec/plan/GAPS/tasks/implement 六阶段与 T11～T18、T12/T20 一一对应。主保险覆盖 6 阶段，次保险覆盖 story、implement。

18. **T13～T17 triggerStage 与 call_mapping 一致性**：config/scoring-trigger-modes.yaml 定义 speckit_1_2～speckit_5_2；T13～T17 分别使用 speckit_1_2、speckit_2_2、speckit_3_2、speckit_4_2、speckit_5_2。**完全一致**。

19. **parse-and-write-score 参数支持**：源码已确认支持 reportPath、stage、epic、story、artifactDocPath、event、triggerStage、iteration-count。T1、T11～T18 所用参数均受支持。

20. **check-story-score-written 当前能力**：当前仅支持 --epic、--story、--dataPath；T19 要求新增 --stage。任务描述已明确扩展逻辑，实施时可执行。

21. **RUN_ID_CONVENTION §4.2 存在性**：当前文档有 §4.1、§4.2、§4.3 等；T9 要求「在 §4.2 或适当地点增加」MIN_STAGES 说明。可并入 §4.2 或新增小节。可执行。

22. **TASKS_Epic级仪表盘聚合 US-1.2 当前表述**：第 104 行含「最新完整 run」（≥3 stage）。T10 要求改为「≥2 stage，2-stage 设计下 story+implement」。可定位、可修改。

23. **compute.test.ts 用例名称可定位性**：第 224 行含 `it('strategy epic_story_window returns complete run with >=3 stages'`。T8 要求改为「>=2 stages」并用 2 条 record 验证。可定位、可修改。

24. **audit-prompts §1～§5【审计后动作】可定位性**：第 17、27、37、81、116 行各有【审计后动作】段落，当前为「以便主 Agent 调用 parse-and-write-score」。T13～T17 要求改为子代理执行并新增 CLI。可定位、可修改。

25. **STORY-A2-AUDIT/STORY-A4-POSTAUDIT 模板可定位性**：bmad-story-assistant SKILL.md 第 555、559 行含 STORY-A2-AUDIT，第 1375 行含 STORY-A4-POSTAUDIT。T11、T18 修改位置均已明确。

26. **T4 插入点与 write 流程一致性**：parse-and-write.ts 第 142 行计算 dimensionScores，第 143～150 行构建 baseRecord，后续 applyTierAndVeto、writer 写入。T4 要求在 stage===implement 且 dimensionScores.length===0 时、在 write 前输出 WARN。插入点可明确为第 142 行后、第 143 行前（或 baseRecord 构建后、传入 writer 前）。可操作。

27. **T9 与 RUN_ID_CONVENTION 现有结构兼容性**：§4.2 讨论 run_id 共享；MIN_STAGES 说明可新增于 §4 或作为 §4.6 等。不破坏现有结构。

28. **T19 扩展与 T12/T20 调用方式兼容性**：T12、T20 将使用 `--stage story`、`--stage implement`。T19 扩展后支持该参数；未指定时保持现有逻辑。兼容。

29. **T15 GAPS stage=plan 与 speckit 流程语义一致性**：GAPS 审计为 speckit 阶段 3.2，对应 triggerStage speckit_3_2；stage=plan 与 spec/plan 同为「规划类」stage，与 config 及 scoring 数据模型一致。

30. **T17 triggerStage speckit_5_2 与 implement 审计对应关系**：audit-prompts §5 为 implement 审计；speckit 阶段 5.2 对应 implement。call_mapping 中 speckit_5_2_audit_pass 存在。一致。

31. **parseAndWriteScore 写入前 WARN 插入时机可操作性**：在 dimensionScores 计算后、baseRecord 构建完成后，可增加 `if (stage === 'implement' && dimensionScores.length === 0) { console.error('WARN: ...'); }`。不阻断流程。可操作。

32. **双保险下 T1 步骤 2.2 与 T11 子代理写不发生双写的充分条件**：§8 已规定主 Agent 先执行步骤 2.3 check；若 T11 子代理已执行 parse-and-write-score，check 输出 yes，主 Agent 无需再执行步骤 2.2。若子代理未执行（超时/异常），check 输出 no，主 Agent 补跑步骤 2.2。时序清晰，不双写。

**被模型忽略风险**：实施者须阅读 §7 Party-Mode 版及 §9 完整列表，不可仅依赖第一份简化表。文档已通过「补充说明」「覆盖清单表」强化可发现性。风险可控。

**假 100 轮/凑轮次风险**：本审计为单轮独立验证，每维度有明确检查项与结论，无空转。

**可操作性深度质疑**：T13～T17 将 audit-prompts 的「以便主 Agent 调用」改为「子代理在返回前必须执行」。质疑：子代理是否有权限执行 `npx ts-node scripts/...`？若子代理为 Cursor Task 调度的 code-reviewer，其可执行 shell 命令；若为 mcp_task generalPurpose，同样可执行。任务描述已明确「在返回主 Agent 前必须执行」，实施时在传入子代理的 prompt 中整段包含该指令即可。可操作。

**T4 mock 报告可构造性**：验收要求使用「故意不含 code 四维的 implement 报告（如仅含 tasks 四维的 mock）」执行 parse-and-write-score。构造方式：新建一 .md 文件，内含 `- 需求完整性: 80/100` 等 tasks 四维，无功能性、代码质量等；传入 --stage implement。parseDimensionScores(mode=code) 将因维度不匹配返回 []，触发 T4 新增的 WARN 分支。可构造、可验证。

**T5 已知空 record 获得方式**：对仅含 tasks 四维的 implement 报告执行一次 parse-and-write-score，写入的 record 将无 dimension_scores（或为空数组）；用该 epic/story 执行 check，即可验证 T5 输出是否含 DIMENSION_SCORES_MISSING。可复现。

**T8 与 T6 执行顺序**：T6 修改 MIN_STAGES_COMPLETE_RUN 为 2；T8 修改单测期待。若先执行 T8 再 T6，单测可能因 MIN 仍为 3 而失败；应先执行 T6 再 T8，或同时执行。任务列表未强制顺序，但逻辑上 T6 优先。不构成 gap，实施者按依赖顺序执行即可。

**T2 与 T3 实施顺序**：T3 新增 appendix §7.1；T2 要求阶段四 prompt 含【§5 可解析块要求（implement 专用）】。两任务可并行；T2 不依赖 T3 文件结构，T3 为引用源。可并行。

**T11、T18 与 T1、T12、T20 的流程关系**：T11 令子代理在阶段二审计通过时执行 parse-and-write；T12 令主 Agent 在阶段二完成后执行 check，若 no 则补跑（即步骤 2.2）。T1 的步骤 2.2 与 T12 补跑为同一 CLI。流程为：子代理通过→子代理执行 parse-and-write（T11）→返回主 Agent→主 Agent 执行 check（T12）→若 yes 则跳过步骤 2.2，若 no 则执行步骤 2.2。无冗余执行。

**INSUFFICIENT_RUN_MESSAGE 与 T7**：当前 scripts/dashboard-generate.ts 第 30 行为 `'数据不足，暂无完整 run（至少 3 stage）'`。T7 要求改为「至少 2 stage」。grep 可唯一定位。可执行。

**T10 US-1.2 修改范围**：第 104 行描述为「最新完整 run」（≥3 stage」。T10 要求改为「≥2 stage，2-stage 设计下 story+implement」。修改范围仅限该描述，不改变函数签名或验收逻辑。可执行。

**GAP-D1 与 T2、T3 的边界**：GAP-D1 记录 stage=story 报告若使用 tasks 四维而 stageToMode('story') 返回 code 时的维度不匹配问题。本 BUGFIX 聚焦 implement 与阶段二步骤 2.2；GAP-D1 建议作为独立 BUGFIX。T2、T3 不触及 story 阶段维度，边界清晰。

**T19 --stage 与现有 record 筛选逻辑**：当前 check 用 parseEpicStoryFromRecord 筛 epic/story 匹配的 records；T19 增加 --stage 后，需额外过滤 stage 或 trigger_stage。当 --stage story 时，仅保留 stage===story 或 trigger_stage===bmad_story_stage2；当 --stage implement 时，仅保留 stage===implement 或 trigger_stage===bmad_story_stage4。任务描述已明确。可实施。

**双保险方案下 spec/plan/GAPS/tasks 无次保险的合理性**：§8 阶段覆盖清单表明 spec、plan、GAPS、tasks 仅有主保险（子代理写），无主 Agent check。原因：这些 stage 在 Dev Story 内部由 speckit-workflow 驱动，主 Agent 不入场；主 Agent 仅在 Create Story 阶段二、Dev Story 阶段四完成后执行 check。设计合理。

**本轮结论**：**本轮无新 gap**。上述 32 维度及 10 项深度质疑均通过，无遗漏、无矛盾、无可执行性缺陷、无实施阻塞。

---

## 6. 审计结论

**完全覆盖、验证通过**。

§7（T1～T10）与 §9（T11～T20）完整覆盖 §1～§8 及 MIN_STAGES 方案；全部 20 项任务描述清晰、验收可量化、路径可定位；依赖正确、边界已定义、双保险闭环完整。本轮无新 gap。

**收敛状态**：本轮无新 gap，第 7 轮；**连续 3 轮无 gap，收敛达成**。

---

## 7. 可解析评分块（强制）

```markdown
## 审计结果可解析块

| 维度 | 结论 |
|------|------|
| 需求覆盖 | 完全覆盖 |
| 任务可执行性 | 全部通过 |
| 依赖与一致性 | 正确 |
| 边界与遗漏 | 已定义 |
| 集成 | 闭环完整 |

- 需求完整性: 100/100
- 可测试性: 100/100
- 一致性: 100/100
- 可追溯性: 100/100

总体评级: A
```
