# tasks-E4-S1 审计报告（audit-prompts.md §4）

**审计对象**：tasks-E4-S1.md 对 Story 4-1、spec-E4-S1.md、plan-E4-S1.md、IMPLEMENTATION_GAPS-E4-S1.md 的覆盖完整性  
**审计依据**：audit-prompts.md §4（tasks.md 审计提示词）  
**审计日期**：2026-03-04

---

## 一、逐条覆盖检查

### 1.1 对 Story 4-1 的覆盖

| Story 章节 | 覆盖任务 | 验证方式 | 结果 |
|------------|----------|----------|------|
| §1.1.1 一票否决项与环节映射 | T1.1–T1.3 | T1.1 isVetoTriggered、T1.2 buildVetoItemIds、T1.3 单元测试 | ✅ |
| §1.1.2 角色一票否决权 | T5.1–T5.2 | VETO_AND_ITERATION_RULES.md、清单验证 | ✅ |
| §1.1.3 Epic 8 项条件 | T4.1–T4.4 | EpicVetoInput、evaluateEpicVeto、8 项逻辑、单元测试 | ✅ |
| §1.1.4 多次迭代阶梯式扣分 | T2.1–T2.3 | getTierCoefficient、applyTierToPhaseScore、单元测试 | ✅ |
| §1.1.5 致命/严重问题差异化 | T2.1、T2.3 | severity_override 顺序、fatal≥3、serious≥2 | ✅ |
| §1.1.6 与评分核心的集成 | T3、T6 | applyTierAndVeto、模块导出、accept-e4-s1 | ✅ |
| §2 AC-1–AC-5 | 各 Phase AC 标注 | tasks 中逐 Phase 标注 AC | ✅ |
| §3 Tasks T1–T6 | T1–T6 及子任务 | 需求追溯表、Gaps 映射表 | ✅ |

### 1.2 对 spec-E4-S1.md 的覆盖

| spec 章节 | 覆盖任务 | 验证方式 | 结果 |
|-----------|----------|----------|------|
| §2.1 一票否决项与环节映射 | T1 | item_id 匹配、vetoItemIds 构建、isVetoTriggered | ✅ |
| §2.2 角色 veto | T5 | VETO_AND_ITERATION_RULES.md | ✅ |
| §2.3 Epic 8 项 | T4 | EpicVetoInput、evaluateEpicVeto、8 项判定 | ✅ |
| §2.4 阶梯系数与 severity_override | T2 | getTierCoefficient、applyTierToPhaseScore | ✅ |
| §2.5 与评分核心的集成 | T3、T6 | applyTierAndVeto、可调用入口 | ✅ |
| §3.1–§3.3 接口与依赖 | T1、T2、T4、T6 | 消费 Story 2.1、产出供 4.2 调用 | ✅ |
| §4 Tasks 映射 | T1–T6 与 spec §4 表一致 | 逐项对应 | ✅ |
| §6 验收标准映射 | 各 Phase AC | AC-1–AC-5 均已标注 | ✅ |

### 1.3 对 plan-E4-S1.md 的覆盖

| plan 章节 | 覆盖任务 | 验证方式 | 结果 |
|-----------|----------|----------|------|
| §2.1 实现路径、目录结构 | T6.1 | scoring/veto/、index.ts、veto.ts、tier.ts、epic-veto.ts、types.ts | ✅ |
| §3.1 核心 API 设计 | T1、T2、T3 | 签名与职责与 plan 表一致 | ✅ |
| §3.2 Epic 8 项 | T4 | evaluateEpicVeto、EpicVetoInput | ✅ |
| §4 数据结构 | T4.1、T3.1 | EpicStoryRecord、raw_phase_score 约定 | ✅ |
| §5.1 单元测试计划 | T1.3、T2.3、T4.4 | veto.test、tier.test、epic-veto.test | ✅ |
| §5.2 集成测试计划 | T6.3 | accept-e4-s1 调用 applyTierAndVeto、evaluateEpicVeto | ⚠️ 见专项审查 |
| §5.3 端到端验收 | T6.3 | scripts/accept-e4-s1.ts | ✅ |
| §6 文档产出 | T5.1、T6.2 | VETO_AND_ITERATION_RULES.md、CONTRACT/README | ✅ |

### 1.4 对 IMPLEMENTATION_GAPS-E4-S1.md 的覆盖

| Gap ID | 覆盖任务 | 验证表行 | 结果 |
|--------|----------|----------|------|
| GAP-1.1 | T1.1 | veto.test.ts | ✅ |
| GAP-1.2 | T1.2 | veto.test.ts | ✅ |
| GAP-1.3 | T5.1 | 人工/清单 | ✅ |
| GAP-1.4 | T4 | epic-veto.test.ts | ✅ |
| GAP-1.5、GAP-1.6 | T2 | tier.test.ts | ✅ |
| GAP-1.7 | T3、T6.3 | accept-e4-s1 | ⚠️ 见专项审查 |
| GAP-T1–T6 | T1–T6 | 验收表头 | ✅ |

---

## 二、专项审查（audit-prompts §4 强制项）

### 2.1 每个功能模块/Phase 是否包含集成测试与端到端功能测试任务

| Phase | 单元测试任务 | 集成/端到端测试任务 | 是否符合「严禁仅有单元测试」 |
|-------|--------------|---------------------|------------------------------|
| Phase 1 (T1) | T1.3 veto.test.ts | 无显式任务；依赖 T6.3 间接覆盖 | ❌ Phase 1 无显式集成测试任务 |
| Phase 2 (T2) | T2.3 tier.test.ts | 无显式任务；依赖 T6.3 间接覆盖 | ❌ Phase 2 无显式集成测试任务 |
| Phase 3 (T3) | T3.1 单元测试、T3.2 schema 兼容 | 无显式任务；依赖 T6.3 间接覆盖 | ❌ Phase 3 无显式集成测试任务 |
| Phase 4 (T4) | T4.4 epic-veto.test.ts | 无显式任务；依赖 T6.3 间接覆盖 | ❌ Phase 4 无显式集成测试任务 |
| Phase 5 (T5) | 文档产出，无代码测试 | 人工/清单验证（可接受） | ✅ |
| Phase 6 (T6) | — | T6.3 accept-e4-s1 验收脚本 | ✅ |

**结论**：Phase 1–4 仅有单元测试，无显式集成测试任务。T6.3 的 accept-e4-s1 会调用 applyTierAndVeto（依赖 Phase 1–3）和 evaluateEpicVeto（依赖 Phase 4），可间接验证各模块的集成，但 audit-prompts §4 要求「每个功能模块/Phase 是否包含集成测试与端到端功能测试任务及用例」，严格解释下 Phase 1–4 未满足「包含」要求。建议在 tasks 中显式注明：Phase 1–4 的集成验证由 T6.3 的 accept-e4-s1 统一覆盖，或为 Phase 1–4 增设简短的集成测试任务。

---

### 2.2 验收标准是否包含「该模块在生产代码关键路径中被导入、实例化并调用」的集成验证

**T6.3 现行验收**：
> **生产代码关键路径验证**：在 parse-and-write 或 scoring orchestration 中导入并调用 applyTierAndVeto，**或**通过 accept-e4-s1 证明模块可被外部调用，且验收脚本作为本 Story 的集成验收路径。

**plan §5.2 要求**：
- applyTierAndVeto 被 parse-and-write 或 calculator 调用
- grep 验证 scoring/veto 被 scoring/orchestrator、**或** accept-e4-s1 验收脚本导入

**偏差分析**：
- plan §5.2 第一行要求 applyTierAndVeto 在「scoring/orchestrator 或 scoring/core 的评分流程中」被导入并调用，即与 parse-and-write/calculator 的集成。
- T6.3 用「或」允许仅通过 accept-e4-s1 证明可被外部调用，即可在不修改 parse-and-write 的前提下通过验收。
- 若仅完成 accept-e4-s1 而不在 parse-and-write 中集成，则 scoring/veto 模块虽可被脚本调用，但**从未在评分生产流程中被使用**，与 plan 的「applyTierAndVeto 被 parse-and-write 或 calculator 调用」存在差距。

**结论**：❌ 验收标准中的「或」削弱了「生产代码关键路径集成」的强制要求，存在仅凭验收脚本通过而模块仍为孤岛的风险。

---

### 2.3 是否存在孤岛模块风险

**孤岛定义**：模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用。

**风险分析**：
- 若实施时仅完成 T6.3 的 accept-e4-s1，而不在 parse-and-write 或 scoring orchestration 中导入并调用 applyTierAndVeto，则 scoring/veto 将成为孤岛：
  - 单元测试（veto.test、tier.test、epic-veto.test）可通过
  - accept-e4-s1 可证明模块可被脚本调用
  - 但评分主流程（parseAndWriteScore → writeScoreRecordSync）不应用 veto 与阶梯系数

**Story 4-1 与 plan 的预期**：
- Story §1.1.6：「环节级 veto 与阶梯系数在单 stage 评分计算中应用」
- plan §4.2：「若 RunScoreRecord 仅有 phase_score，则需在 parse-and-write 或 calculator 层拆分」
- IMPLEMENTATION_GAPS 可复用项：「parse-and-write.ts：评分写入流程（可扩展为调用 applyTierAndVeto）」

**结论**：❌ **存在孤岛模块风险**。T6.3 的「或」允许验收时不强制完成 parse-and-write 集成，需将「在 parse-and-write 或 scoring orchestration 中导入并调用 applyTierAndVeto」明确为**必须项**，不能仅用 accept-e4-s1 替代。

---

## 三、其他检查项

| 检查项 | 结果 |
|--------|------|
| buildVetoItemIds 是否在任务与导出中 | ✅ T1.2、T6.1 均包含 |
| GAP-T5 的 CONTRACT 要求 | ✅ T6.2 覆盖 |
| EpicVetoInput 与 Story/spec 一致 | ✅ passedStoryCount?、testStats? |
| spec §2.3 第⑤项「未通过」判定（veto_triggered / phase_score=0） | ✅ T4.3「逐项实现 8 项」应覆盖 |
| 需求追溯表、Gaps 映射表完整性 | ✅ 表结构完整 |
| 执行顺序与检查点 | ✅ 合理 |

---

## 四、结论与待修复项

### 4.1 审计结论

**是否「完全覆盖、验证通过」**：❌ **否**

### 4.2 待修复/补充项

1. **T6.3 生产代码关键路径验证（必须修复）**
   - **现状**：用「或」允许仅通过 accept-e4-s1 验收。
   - **建议**：将「在 parse-and-write 或 scoring orchestration 中导入并调用 applyTierAndVeto」设为**必须满足**；accept-e4-s1 作为**补充**端到端验收，不可替代生产集成。
   - **建议修改**：删除或收紧「或通过 accept-e4-s1 证明模块可被外部调用」的替代路径表述，明确要求「parse-and-write 或 scoring/core 的评分流程中必须导入并调用 applyTierAndVeto」。

2. **Phase 1–4 集成测试任务（建议补充）**
   - **现状**：Phase 1–4 仅有单元测试，无显式集成测试任务。
   - **建议**：在 tasks 中增加说明，或在 T6.3 中显式写出：accept-e4-s1 覆盖 Phase 1–4 的集成验证；或为 Phase 3、Phase 4 增设「集成测试：在 accept-e4-s1 或 parse-and-write 流程中调用并断言」类任务。

3. **验收表头 GAP-1.7 行**
   - 建议在「集成测试要求」或「生产代码实现要点」中明确：parse-and-write 或 scoring orchestration 须导入 applyTierAndVeto。

---

*本报告依据 audit-prompts.md §4 生成，需在 tasks 迭代后重新审计直至结论为「完全覆盖、验证通过」。*
