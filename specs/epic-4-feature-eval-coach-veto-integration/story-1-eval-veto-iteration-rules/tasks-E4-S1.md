# Tasks: eval-veto-iteration-rules (E4-S1)

**Input**: spec-E4-S1.md、plan-E4-S1.md、IMPLEMENTATION_GAPS-E4-S1.md  
**Prerequisites**: Story 2.1 已产出（loadPhaseScoringYaml、loadGapsScoringYaml、loadIterationTierYaml）

---

## 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1–T1.3 | Story 4-1 | §3 T1 | 环节级 veto 判定 |
| T2–T2.3 | Story 4-1 | §3 T2 | 阶梯系数计算 |
| T3–T3.2 | Story 4-1 | §3 T3 | applyTierAndVeto 编排 |
| T4–T4.4 | Story 4-1 | §3 T4 | Epic 8 项条件判定 |
| T5–T5.2 | Story 4-1 | §3 T5 | 角色 veto 规则文档化 |
| T6–T6.3 | Story 4-1 | §3 T6 | 可调用入口与模块导出 |

---

## Gaps → 任务映射

| 章节 | Gap ID | 对应任务 |
|------|--------|----------|
| §1.1 | GAP-1.1, GAP-1.2 | T1, T1.1–T1.3 |
| §1.1 | GAP-1.5, GAP-1.6 | T2, T2.1–T2.3 |
| §1.1 | GAP-1.7 | T3, T3.1–T3.2 |
| §1.1 | GAP-1.4 | T4, T4.1–T4.4 |
| §1.1 | GAP-1.3 | T5, T5.1–T5.2 |
| §1.1 | GAP-T6 | T6, T6.1–T6.3 |

---

## Phase 1：环节级 veto 判定（T1）

**AC**: #1

- [x] **T1.1** 实现 `isVetoTriggered(checkItems: CheckItem[], vetoItemIds: Set<string>): boolean`，检查 check_items 中是否存在 veto 类 item_id 且 passed=false。验收：单元测试输入含 veto_core_logic、veto_owasp_high 且 passed=false，返回 true。
- [x] **T1.2** 实现 `buildVetoItemIds(options?: { rulesDir? }): Set<string>`：从 loadPhaseScoringYaml(2/3/4)、loadGapsScoringYaml 的 veto_items 解析 ref，取 ref 目标 item_id 构建集合；支持环节 2/3/4、gaps。验收：返回集合含 veto_core_logic、veto_owasp_high、veto_cwe798、veto_compile、veto_core_unmapped、veto_gaps_conflict。
- [x] **T1.3** 单元测试：覆盖 veto_core_logic、veto_owasp_high、veto_cwe798、veto_core_unmapped、veto_gaps_conflict。验收命令：`npm test -- scoring/veto/__tests__/veto.test.ts`。

---

## Phase 2：阶梯系数计算（T2）

**AC**: #2

- [x] **T2.1** 实现 `getTierCoefficient(record: RunScoreRecord): number`：从 loadIterationTierYaml 读取 iteration_tier、severity_override；先应用 severity 规则（fatal≥3→0，serious≥2→降一档），再按 iteration_count 查 tier。验收：iteration_count 0/1/2/≥3 对应 1.0/0.8/0.5/0。
- [x] **T2.2** 实现 `applyTierToPhaseScore(rawScore: number, record: RunScoreRecord): number`：phase_score = rawScore × getTierCoefficient(record)。验收：单元测试。
- [x] **T2.3** 单元测试：iteration_count 0/1/2/≥3 对应 1.0/0.8/0.5/0；fatal≥3→0；serious≥2→降一档。验收命令：`npm test -- scoring/veto/__tests__/tier.test.ts`。

---

## Phase 3：环节级 veto 与阶梯应用编排（T3）

**AC**: #1, #2

- [x] **T3.1** 实现 `applyTierAndVeto(record: RunScoreRecord & { raw_phase_score?: number }): { phase_score, veto_triggered, tier_coefficient }`：先判定 veto（用 buildVetoItemIds + isVetoTriggered），若触发则 phase_score=0；否则应用阶梯系数。raw_phase_score 由调用方传入；若无则用 phase_score 作基数（文档化限制）。验收：单元测试 veto 触发→phase_score=0；未触发→phase_score=raw×tier。
- [x] **T3.2** 输出与 Story 1.1 的 phase_score、check_items 语义一致，可写入 RunScoreRecord。验收：类型与 schema 兼容。

---

## Phase 4：Epic 8 项条件判定（T4）

**AC**: #3, #4

- [x] **T4.1** 定义 EpicVetoInput、EpicStoryRecord 接口：storyRecords、epicStoryCount、passedStoryCount?、testStats?。验收：types.ts 导出。
- [x] **T4.2** 实现 `evaluateEpicVeto(input: EpicVetoInput): { triggered: boolean, triggeredConditions: string[] }`。验收：单元测试。
- [x] **T4.3** 逐项实现 8 项判定逻辑；第 2、4 项若 passedStoryCount/testStats 未传入则跳过或使用近似（如 passedStoryCount=通过的 Story 数），并文档化。验收：至少第 1、3、5、6、7、8 项有断言。
- [x] **T4.4** 单元测试：覆盖第 1、3、5、6、7、8 项。验收命令：`npm test -- scoring/veto/__tests__/epic-veto.test.ts`。

---

## Phase 5：角色 veto 规则文档化（T5）

**AC**: #3

- [x] **T5.1** 在 scoring/docs/VETO_AND_ITERATION_RULES.md 编写：批判审计员、AI 教练的 veto 触发条件与后果；与 REQUIREMENTS §3.4.1、§3.4.2 一致。验收：文档存在且含指定要点。
- [x] **T5.2** 验收：人工或脚本清单验证文档内容完整。

---

## Phase 6：可调用入口与模块导出（T6）

**AC**: #5

- [x] **T6.1** 在 scoring/veto/ 下实现 veto-and-tier 模块，导出 applyTierAndVeto、evaluateEpicVeto、getTierCoefficient、isVetoTriggered、buildVetoItemIds。验收：`import { applyTierAndVeto } from '../scoring/veto'` 可成功。
- [x] **T6.2** 编写 CONTRACT 或 scoring/veto/README.md：入参、出参、与 Story 3.2、4.2 的衔接。验收：文档存在。
- [x] **T6.3** 集成测试与生产路径验证（两项均须满足）：(1) scripts/accept-e4-s1.ts，给定样本记录，调用 applyTierAndVeto、evaluateEpicVeto 并校验输出；验收命令 `npx ts-node scripts/accept-e4-s1.ts` 或 `npm run accept:e4-s1` 通过。(2) **强制**：在 scoring/orchestrator/parse-and-write.ts 或 scoring 评分主流程中导入并调用 applyTierAndVeto，使环节分在写入前应用 veto 与阶梯；grep 验证 scoring/veto 被生产路径导入。验收：两者均通过，禁止仅以 accept-e4-s1 替代生产路径集成。

---

## 验收表头（按 GAP 逐条验证）

| Gap ID | 对应任务 | 生产代码实现要点 | 集成测试要求 | 执行情况 | 验证通过 |
|--------|----------|------------------|--------------|----------|----------|
| GAP-1.1 | T1.1 | scoring/veto/veto.ts isVetoTriggered | veto.test.ts | [x] 通过 | [x] |
| GAP-1.2 | T1.2 | scoring/veto/veto.ts buildVetoItemIds | veto.test.ts | [x] 通过 | [x] |
| GAP-1.3 | T5.1 | scoring/docs/VETO_AND_ITERATION_RULES.md | 人工/清单 | [x] 通过 | [x] |
| GAP-1.4 | T4 | scoring/veto/epic-veto.ts evaluateEpicVeto | epic-veto.test.ts | [x] 通过 | [x] |
| GAP-1.5, 1.6 | T2 | scoring/veto/tier.ts getTierCoefficient | tier.test.ts | [x] 通过 | [x] |
| GAP-1.7 | T3, T6.3 | scoring/veto 导出 applyTierAndVeto；parse-and-write 集成调用 | accept-e4-s1 通过；parse-and-write 导入 | [x] 通过 | [x] |
| GAP-T6 | T6 | scoring/veto 导出；accept-e4-s1 | 脚本可调用 | [x] 通过 | [x] |

---

## 执行顺序

1. T1.1 → T1.2 → T1.3
2. T2.1 → T2.2 → T2.3
3. T3.1 → T3.2
4. T4.1 → T4.2 → T4.3 → T4.4
5. T5.1 → T5.2
6. T6.1 → T6.2 → T6.3

**检查点**：Phase 1–3 完成后，applyTierAndVeto 可单独验收；Phase 4 完成后，evaluateEpicVeto 可单独验收；Phase 6 完成后，全流程验收。

**集成验证说明**：Phase 1–4 的集成验证由 T6.3 覆盖——accept-e4-s1 调用 applyTierAndVeto、evaluateEpicVeto；parse-and-write 集成调用 applyTierAndVeto，确保 scoring/veto 在生产代码关键路径中被导入并调用，无孤岛模块。
