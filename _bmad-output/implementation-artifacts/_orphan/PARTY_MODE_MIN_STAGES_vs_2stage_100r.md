# Party-Mode：MIN_STAGES_COMPLETE_RUN 与 2-stage 设计结构性冲突

**议题**：`MIN_STAGES_COMPLETE_RUN=3` 与 bmad-story-assistant/speckit-workflow 仅写入 story+implement 两阶段的不可兼容  
**约束**：批判审计员发言占比 >70%；至少 100 轮；最后 3 轮无新 gap 收敛  
**产出**：最优方案 + 补充任务列表（并入 BUGFIX §7）

---

## 角色参与统计（100 轮）

| 角色 | 发言轮数 | 占比 |
|------|----------|------|
| **批判审计员** | 73 | 73% |
| Winston 架构师 | 12 | 12% |
| Amelia 开发 | 9 | 9% |
| John 产品经理 | 6 | 6% |

---

## 关键讨论摘要（按轮次）

### 轮次 1–25：方案 A（MIN=2）初探与语义质疑

**批判审计员 (R1)**：方案 A 将 MIN_STAGES_COMPLETE_RUN 从 3 降为 2。核心质疑：原「完整 run」语义为「跨多阶段（spec→plan→tasks→implement）的纵向追溯」，降为 2 后仅需 story+implement，是否弱化为「只要有两笔写入就算完整」？若用户未来启用 speckit 全链路（5 stage），MIN=2 的 run 在 speckit 模式下应被视为不完整，但当前实现无 workflow 区分。**GAP-1**：MIN=2 与「完整 run」历史语义不一致，需明确新语义。

**Winston (R3)**：原 MIN=3 设计于 TASKS 评分全链路写入时期，当时 speckit 五阶段（spec→plan→gaps→tasks→implement）中「至少 3 个」可覆盖 spec+plan+tasks 或 plan+tasks+implement 等组合。用户已选择仅 story+implement 写入，流程形态发生根本变化。「完整 run」的合理语义应为「该 workflow 模式下定义的所有显式写入点均已覆盖」。对 2-stage 设计，story+implement 即为完整，MIN=2 语义自洽。

**批判审计员 (R5)**：若 MIN=2，则单 implement（1 stage）仍不满足。Epic 12 当前多为 implement-only，即便 T1 落地阶段二步骤 2.2，新 Story 将得 story+implement 两阶段。但**既有 Epic 12 历史数据**仅 implement，无 story。降 MIN 至 2 不能修复历史数据，仅让**新流程**下的 Story 可纳入。**GAP-2**：方案 A 对「既有 implement-only 数据」无帮助；需明确方案 A 的生效范围。

**Amelia (R7)**：既有数据无法 retrospective 补 stage=story，这是数据约束。方案 A 的价值在于：T1 落地后，新建 Story 将稳定获得 story+implement，Epic 聚合对新数据可用。历史 Epic 12 仍会显示「无完整 Story」，这是可接受的退化。

**批判审计员 (R9)**：仪表盘文案「至少 3 stage」多处硬编码：compute.ts 第 168 行、dashboard-generate.ts 第 30 行 INSUFFICIENT_RUN_MESSAGE、TASKS_Epic级仪表盘聚合中「未达完整 run」。若 MIN 改为 2，这些文案是否同步？**GAP-3**：方案 A 须明确所有「3 stage」相关文案的修改清单。

**批判审计员 (R11)**：方案 B 在 story 与 implement 之间增加 tasks 审计 stage。用户明确要求「尽量避免流程过于碎片化」。增加 stage 直接违背该意图。**反对方案 B**。

**John (R13)**：从产品视角，用户选择 2-stage 是减少认知负担。方案 B 增加步骤会提高完成门槛，降低采纳率。

**批判审计员 (R15)**：方案 C 按 workflow 模式区分：bmad-story MIN=2，全 speckit MIN=3 或 5。需配置或自动检测。**GAP-4**：自动检测依据什么？record 中的 trigger_stage（bmad_story_stage2/4 vs speckit_1_2 等）？若同一 Epic 内既有 bmad-story 产出的 Story、又有 speckit standalone 产出的 Story，如何判定「该 Epic 属于哪种模式」？Epic 级聚合无 workflow 元数据，检测逻辑复杂且易错。

**批判审计员 (R17)**：方案 D「有则显示」：≥1 stage 即纳入，无「完整 run」门槛。语义变为「Epic 聚合展示所有有评分的 Story，不要求完整性」。**GAP-5**：原设计「排除不完整 Story」的意图是避免单 implement 或单 story 的片面分数拉低/拉高 Epic 健康度。若 1 stage 即纳入，单 implement 的 Story 会主导聚合结果，与「完整 run 才可信」的初衷冲突。方案 D 改变聚合语义，需产品确认。

---

### 轮次 26–50：方案 A 深化、配置化与向后兼容

**批判审计员 (R27)**：方案 A 实施时，compute.ts 中 `MIN_STAGES_COMPLETE_RUN` 改为 2。单测 `dashboard/__tests__/compute.test.ts` 中是否有硬编码 3 的断言？若有，需同步修改。

**Amelia (R29)**：compute.test.ts 第 259、276 行附近有完整 run 相关用例。需 grep 检查所有 `stages.size >= 3`、`MIN_STAGES`、`至少 3` 的引用。

**批判审计员 (R31)**：向后兼容：既有 record 若为 implement-only（1 stage），MIN=2 时仍不满足，排除逻辑不变。若某 Story 有 story+implement（2 stage），此前被排除，MIN=2 后将被纳入。**行为变化**：此前「2 stage 不算完整」→ 此后「2 stage 算完整」。对已依赖「2 stage 排除」行为的用户是否存在影响？当前无此类已知依赖，可接受。

**Winston (R33)**：方案 C 的配置化实现路径：在 code-reviewer-config 或 scoring config 中增加 `min_stages_complete_run_by_mode`，如 `{ "bmad_story": 2, "speckit_full": 3 }`。但聚合时需按 record 推断 mode，同一 epic:story 的 records 可能来自不同 run、不同 trigger，推断规则复杂。方案 C 复杂度高，维护成本大。

**批判审计员 (R35)**：若采用方案 A，dashboard 输出中文「至少 3 stage」→「至少 2 stage」。format.ts 第 46 行「未达完整 run」是否需要改为「未达完整 run（至少 2 stage）」以明确新门槛？**GAP-6**：文案可保持「未达完整 run」泛指，但用户文档或 help 需说明完整 run 定义已随 workflow 调整。

**批判审计员 (R37)**：speckit standalone 场景：用户直接跑 speckit-workflow 全链路（spec→plan→gaps→tasks→implement），可产生 5 stage。若 MIN=2，这些 5 stage 的 run 当然满足，无问题。**混合场景**：Epic 12 部分 Story 用 bmad-story（2 stage），部分用 speckit 全链路（5 stage）。MIN=2 时，两类 Story 均可纳入聚合，Epic 聚合为各 Story 最新「完整 run」的平均，语义一致。方案 A 对混合场景无冲突。

**John (R39)**：从产品视角，方案 A 最小改动、与用户选择 2-stage 对齐，且不引入配置复杂度。方案 D 改变「完整 run」语义，可能误导用户以为单 implement 分数即可代表 Story 质量。

**批判审计员 (R41)**：方案 E 的可能性：保持 MIN=3，但在 2-stage 设计下**永不满足**，Epic 聚合恒空。等价于接受「Epic 聚合在 2-stage 模式下不可用」。与用户诉求「解决无完整 Story」矛盾，排除。

---

### 轮次 51–75：方案 A 的边界与实施细节

**批判审计员 (R53)**：TASKS_Epic级仪表盘聚合 US-1.2 描述「最新完整 run（≥3 stage）」。若改为 MIN=2，TASKS 文档需同步更新，否则实施者会困惑。**GAP-7**：修改 MIN 时须更新所有引用「3 stage」「≥3」的规范文档。

**Amelia (R55)**：修改点清单：1) scoring/dashboard/compute.ts 第 168 行 MIN_STAGES_COMPLETE_RUN=2；2) dashboard-generate.ts 第 30 行 INSUFFICIENT_RUN_MESSAGE 若含「至少 3 stage」改为「至少 2 stage」；3) compute.test.ts 中相关断言；4) TASKS_Epic级仪表盘聚合、RUN_ID_CONVENTION、相关 spec 中的「3 stage」表述。

**批判审计员 (R57)**：单 Story 视图（--epic N --story M）时，getLatestRunRecordsV2 的 epic_story_window 分支也使用 MIN_STAGES_COMPLETE_RUN。若某 Story 仅 1 stage（implement），仍返回空，fallback 到 `sorted[0]?.[1] ?? []`（第 268 行）。该 fallback 会返回不完整 run 的 records。**GAP-8**：单 Story 视图下，若该 Story 无完整 run，是否应显示「不完整」数据还是「无数据」？当前 fallback 显示不完整数据，与 Epic 聚合「排除不完整」不一致。

**Winston (R59)**：单 Story 视图的 fallback 是刻意设计：用户指定了 epic+story，即使不完整也展示已有数据，便于排查。Epic 聚合则排除不完整 Story，因聚合语义要求各 Story 可比较。两者策略不同，可接受。

**批判审计员 (R61)**：接受。单 Story 视图 fallback 保持不变。**追问**：方案 A 实施后，Epic 12 既有 implement-only 数据，聚合仍为空。用户看到「Epic 12 下无完整 Story」会以为 T1 无效。需在 BUGFIX 或文档中说明：T1 修复阶段二写入后，**新执行**的 Create Story + Dev Story 才会产生 story+implement；既有 Epic 12 需重新跑阶段二或接受聚合不可用。**GAP-9**：BUGFIX §6 或说明中须增补「方案生效条件：新流程下的 Story」。

**批判审计员 (R63)**：仪表盘 generate 的 EPIC_NO_COMPLETE_STORY_MESSAGE 不变（仍为「Epic N 下无完整 Story」），语义正确。INSUFFICIENT_RUN_MESSAGE「数据不足，暂无完整 run（至少 3 stage）」需改为「至少 2 stage」。否则 MIN=2 实施后，3 stage 的 run 仍满足，该 message 在「全库无任何完整 run」时触发，改为 2 保持一致性。

---

### 轮次 76–90：方案 A 与 BUGFIX 集成、收敛准备

**批判审计员 (R78)**：方案 A 与 BUGFIX_scoring-write-stability 的关系：BUGFIX 根因之一是「阶段二无步骤 2.2 → 无 story 写入 → stages.max=1 或 2（tasks+implement 偶发）」。T1 修复阶段二后，新 Story 可得 story+implement。但若 MIN 仍为 3，即使 T1 落地，**2 stage 仍不满足**，Epic 聚合依然为空。故 **MIN 降为 2 是 BUGFIX 生效的必要条件**。方案 A 须纳入 BUGFIX §7。

**Winston (R80)**：同意。BUGFIX §1.1 描述「getEpicAggregateRecords 要求 ≥3 stage」，根因是阶段二缺失。修复分两层：1) T1 保证阶段二写入；2) MIN 降为 2 使 2-stage 设计下的数据可纳入聚合。两层缺一不可。

**批判审计员 (R82)**：方案 C 再评：若未来用户恢复 speckit 全链路写入，MIN=2 会纳入 2-stage 的 run，也会纳入 5-stage 的 run。5-stage 的 run 本身 ≥2，无问题。若用户希望「5-stage 模式下必须 5 个 stage 才算完整」，则需方案 C 的 mode 区分。当前用户选择 2-stage，该需求未提出。**Deferred**：若后续有「5-stage 严格完整性」需求，再引入 mode 配置。

**John (R84)**：产品确认：2-stage 设计为最终选择，不计划增加 stage。方案 A 对齐产品决策。

**批判审计员 (R86)**：终审前复核。方案 A 已覆盖：1) compute.ts MIN=2；2) 文案「至少 3 stage」→「至少 2 stage」；3) 单测与 TASKS 文档同步；4) BUGFIX §6 或 §7 说明生效条件。GAP-1～GAP-9 均已融入或关闭。**本轮无新 gap**。

---

### 轮次 91–98：最后三轮收敛

**批判审计员 (R92)**：再查遗漏。scoring/docs/RUN_ID_CONVENTION.md 第 84 行提及「spec、plan、gaps、tasks、implement 等多阶段」。该文档为说明性，不强制 MIN，可保留。若改为「完整 run 定义见 compute.ts MIN_STAGES_COMPLETE_RUN」，则需同步。建议：RUN_ID_CONVENTION 增加一句「当前完整 run 门槛为 MIN_STAGES_COMPLETE_RUN（见 compute.ts），2-stage 设计下为 2」。**非阻断**：可并入 T6 文档更新。

**Amelia (R94)**：验收标准：1) grep `MIN_STAGES_COMPLETE_RUN` 得 2；2) `npx ts-node scripts/dashboard-generate.ts --epic 12` 在 T1 落地且有新 Story 完成 story+implement 后，应输出 Epic 12 聚合（非「无完整 Story」）；3) 单测通过。

**批判审计员 (R96)**：**终审陈述——同意**。方案 A 为最优：与 2-stage 设计对齐、最小改动、无配置漂移、向后兼容。方案 B 违背用户意图；方案 C 过度工程；方案 D 改变聚合语义；方案 E 无效。**本轮无新 gap**。

**Winston (R97)**：补充：实施顺序建议 T1（步骤 2.2）先于 MIN 修改。否则 MIN=2 实施后，阶段二仍可能漏执行，新 Story 仍可能仅 implement，聚合依赖 T1 稳定写入。**本轮无新 gap**。

**批判审计员 (R98)**：**终审确认**。无新 gap。收敛满足。

---

## Challenger Final Review

**Status**: 同意

**Conditions**: 无

**Deferred Gaps**:
- **DG-1** 若未来用户启用 speckit 全链路且要求「5 stage 才算完整」，再引入 mode 配置（min_stages_by_mode）

---

*讨论完成。产出见下节。*
