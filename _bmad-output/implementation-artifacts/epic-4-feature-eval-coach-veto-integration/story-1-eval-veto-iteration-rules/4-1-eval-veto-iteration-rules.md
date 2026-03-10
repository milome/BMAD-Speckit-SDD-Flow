# Story 4.1：eval-veto-iteration-rules

Status: ready-for-dev

**Epic**：E4 feature-eval-coach-veto-integration  
**Story ID**：4.1  
**Slug**：eval-veto-iteration-rules

<!-- Note: 可执行 validate-create-story 进行质量检查后再进入 dev-story。 -->

## Story

As a 评测规则编排者，  
I want 一票否决项与环节映射、角色一票否决权、Epic 级一票否决 8 项条件、多次迭代阶梯式扣分及致命/严重问题差异化在规则与计算逻辑中实现，  
so that 审计与评分闭环可正确判定环节级/Epic 级 veto、阶梯系数，并为 AI 教练（Story 4.2）提供可调用的判定能力。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **一票否决项与环节映射**
   - OWASP Top 10 高危、CWE-798 硬编码敏感信息、核心逻辑错误、编译失败、核心需求>20%未映射、gaps 与规范冲突等与评分环节的对应关系
   - 消费 Story 2.1 的 veto_items 配置（scoring/rules/default/*.yaml、gaps-scoring.yaml）及 code-reviewer-config.yaml 的 veto_* 定义
   - 给定审计解析结果（check_items 含 item_id、passed）中的否决项标识，可判定是否触发一票否决及对应环节；veto 判定输入来自 Story 3.2 解析器产出的 RunScoreRecord.check_items，不直接读 YAML

2. **角色一票否决权**
   - **批判审计员**：阶段级；审计结论为「存在 gap」或「未通过」时，该 stage 迭代不收敛；触发条件与后果在规则或流程文档中明确定义
   - **AI 代码教练**：全流程级；教练输出 iteration_passed: false 时全流程迭代不达标；触发条件由本 Story 规则定义，执行由 Story 4.2 实现

3. **Epic 级一票否决 8 项条件**
   - ① 单阶段 veto 次数 ≥3（全流程环节级 veto 累计）
   - ② 需求交付率 < 80%（已通过验收 Story 数 / Epic 总 Story 数）
   - ③ 高危漏洞 ≥ 2（OWASP Top 10 高危或 CWE-798，check_items 中 veto 类且 passed=false 累计）
   - ④ 测试通过率 < 80%（通过验收测试用例数 / 总测试用例数）
   - ⑤ 整改≥4 次未通过 Story 数 ≥1
   - ⑥ 一次通过率 < 50%（first_pass=true 的 Story 数 / Epic 总 Story 数）
   - ⑦ 整改≥3 次 Story 数 ≥2
   - ⑧ 致命问题整改≥3 次 Story 数 ≥1
   - 其一定义与判定逻辑实现为可调用函数；聚合输入为 Epic 下各 Story 的 scoring 记录及 epicStoryCount（由调用方传入）

4. **多次迭代阶梯式扣分**
   - 阶梯系数：1 次 100%、2 次 80%、3 次 50%、≥4 次 0%；与 Story 2.1 的 iteration-tier.yaml 一致
   - 应用点：环节分；公式为 phase_score = raw_phase_score × tier_coefficient
   - iteration_count 来源：RunScoreRecord.iteration_count（与 iteration_records 语义一致）；tier 1=iteration_count 0，tier 2=1，tier 3=2，tier 4=iteration_count≥3
   - 与 Story 1.1 的 iteration_count、iteration_records、first_pass schema 对齐

5. **致命/严重问题差异化**
   - severity_override（fatal:3、serious:2）应用顺序：先检查 iteration_records 中 severity=fatal 且整改次数≥3 → 阶梯系数强制 0；再检查 severity=serious 且整改次数≥2 → 系数降一档（如 tier 2→tier 3，0.8→0.5）；否则按 iteration_count 查 iteration_tier

6. **与评分核心的集成**
   - 环节级 veto 与阶梯系数在单 stage 评分计算中应用；Epic 8 项在 Epic 聚合时判定
   - 产出可被 Story 4.2 教练调用的判定 API 或模块；输出与 Story 1.2 写入 schema（phase_score、check_items、first_pass 等）兼容

### 1.2 本 Story 不包含

- 评分规则 YAML 的 schema 与解析器：由 Story 2.1 实现；本 Story 消费 2.1 的 loadPhaseScoringYaml、loadIterationTierYaml 等产出
- 全链路 Skill、审计报告解析、scoring 写入：由 Story 3.1、3.2、3.3 实现
- 审计报告中 veto 类 item_id 的映射与解析扩展：由 Story 3.2 负责；Story 3.2 scope 含「check_items 支持 veto 类 item_id 产出」；本 Story 定义消费契约（见 §6.4）
- AI 代码教练的定位、人格、工作流与输出格式：由 Story 4.2 实现
- 场景区分、迭代结束标准、BMAD 五层集成：由 Story 4.3 实现；epics.md 已规划 4.3（待 Create Story 后）
- 需求交付率、测试通过率的来源 schema 扩展：若当前 schema 不足以计算第 2、4 项，本 Story 定义接口契约（epicStoryCount、testStats 等由调用方传入），或实现基于既有字段的近似规则并文档化其限制

---

## 2. Acceptance Criteria（验收标准）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 一票否决项与环节映射可配置或可查；给定 check_items 中含 veto 类 item_id 且 passed=false，可判定环节级 veto 触发及对应环节 | 单元测试：准备含 veto_core_logic、veto_owasp_high、veto_cwe798 等 item_id 的 check_items，断言 veto 判定正确；覆盖 OWASP、CWE-798、核心需求遗漏与环节映射 |
| AC-2 | 多次迭代阶梯式扣分：给定 iteration_count（0/1/2/≥3），环节分按 100%/80%/50%/0% 系数正确应用；severity_override 顺序正确（fatal≥3→0，serious≥2→降一档） | 单元测试：输入 raw_phase_score、iteration_count、iteration_records（含 severity），断言 phase_score 与 tier_coefficient 符合规则 |
| AC-3 | Epic 级一票否决 8 项条件文档化且可判定；角色一票否决权（批判审计员、AI 代码教练）在规则或流程文档中明确 | 文档存在且含 8 项条件、阈值、角色 veto 触发条件与后果；至少第 1、3、5、6、7、8 项可实现自动化验证 |
| AC-4 | Epic 8 项聚合函数：输入 storyRecords[]、epicStoryCount，输出 epicVetoTriggered 及触发的条件项；需求交付率、测试通过率由调用方传入或文档化近似规则与限制 | 单元测试或集成测试：给定多 Story 记录，断言 8 项判定结果正确 |
| AC-5 | 可调用入口：applyTierAndVeto(record)、evaluateEpicVeto(storyRecords, epicStoryCount, options?) 可供 Story 4.2、4.3 或 bmad-story-assistant 调用 | 导出函数或模块；验收脚本或集成测试证明可调用 |

---

## 3. Tasks / Subtasks

- [ ] **T1** 环节级 veto 判定（AC: #1）
  - [ ] T1.1 实现 `isVetoTriggered(checkItems, vetoItemIds): boolean`：检查 check_items 中是否存在 veto 类 item_id 且 passed=false
  - [ ] T1.2 从 Story 2.1 的 loadPhaseScoringYaml、gaps-scoring 获取 veto_items 列表，构建 vetoItemIds 集合；支持环节 2/3/4、gaps
  - [ ] T1.3 单元测试：覆盖 veto_core_logic、veto_owasp_high、veto_cwe798、veto_core_unmapped、veto_gaps_conflict 等

- [ ] **T2** 阶梯系数计算（AC: #2）
  - [ ] T2.1 实现 `getTierCoefficient(record): number`：从 loadIterationTierYaml 读取 iteration_tier、severity_override；先应用 severity 规则，再按 iteration_count 查 tier
  - [ ] T2.2 实现 `applyTierToPhaseScore(rawScore, record): number`：phase_score = rawScore × getTierCoefficient(record)
  - [ ] T2.3 单元测试：iteration_count 0/1/2/≥3 对应 1.0/0.8/0.5/0；fatal≥3→0；serious≥2→降一档

- [ ] **T3** 环节级 veto 与阶梯应用编排（AC: #1, #2）
  - [ ] T3.1 实现 `applyTierAndVeto(record): { phase_score, veto_triggered, tier_coefficient }`：先判定 veto，若触发则 phase_score=0；否则应用阶梯系数
  - [ ] T3.2 与 Story 1.1 的 phase_score、check_items 语义一致；输出可写入 RunScoreRecord

- [ ] **T4** Epic 8 项条件判定（AC: #3, #4）
  - [ ] T4.1 定义 EpicVetoInput 接口：storyRecords、epicStoryCount、需求交付率分子分母（或 passedStoryCount）、测试通过率（或 testStats）
  - [ ] T4.2 实现 `evaluateEpicVeto(input): { triggered: boolean, triggeredConditions: string[] }`
  - [ ] T4.3 逐项实现 8 项判定逻辑；第 2、4 项：若调用方未传入则跳过或使用近似（如 passedStoryCount=有 post_impl 通过的 Story 数），并文档化
  - [ ] T4.4 单元测试：至少覆盖第 1、3、5、6、7、8 项

- [ ] **T5** 角色 veto 规则文档化（AC: #3）
  - [ ] T5.1 在 scoring/docs 或本 Story 产出目录编写 VETO_AND_ITERATION_RULES.md：批判审计员、AI 教练的 veto 触发条件与后果；与 REQUIREMENTS §3.4.1、§3.4.2 一致
  - [ ] T5.2 验收：文档存在且含指定要点；可被脚本或人工清单验证

- [ ] **T6** 可调用入口与模块导出（AC: #5）
  - [ ] T6.1 在 scoring/veto/ 或 scoring/rules/ 下实现 veto-and-tier 模块，导出 applyTierAndVeto、evaluateEpicVeto、getTierCoefficient、isVetoTriggered
  - [ ] T6.2 编写 CONTRACT 或接口文档：入参、出参、与 Story 3.2、4.2 的衔接
  - [ ] T6.3 集成测试或验收脚本：给定样本记录，调用入口并校验输出

---

## 4. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-3.4 | 一票否决项与环节映射；OWASP、CWE-798、核心遗漏、编译失败等 |
| REQ-3.4.1 | OWASP Top 10、CWE-798 判定标准（消费权威文档与 code-reviewer-config） |
| REQ-3.4.2 | 角色一票否决权（批判审计员阶段级、AI 教练全流程级） |
| REQ-3.4.3 | Epic 级一票否决 8 项条件、默认阈值 |
| REQ-3.4.4 | gaps 一票否决项计入环节级 veto |
| REQ-3.4.5 | 多次迭代阶梯式扣分、问题严重等级差异化 |
| REQ-3.6 | Epic 级一票否决实现 |
| REQ-3.10 | 与 schema（iteration_count、iteration_records、first_pass）的衔接 |

---

## 5. Architecture 约束

| 组件 | 约束 |
|------|------|
| 数据输入 | 消费 Story 3.2 的 RunScoreRecord（check_items、iteration_count、iteration_records、first_pass）；不直接读 YAML |
| 规则配置 | 消费 Story 2.1 的 loadPhaseScoringYaml、loadIterationTierYaml；veto_items 来自 scoring/rules/default/*.yaml、gaps-scoring.yaml |
| 阶梯应用 | 环节分；公式 phase_score = raw_phase_score × tier_coefficient |
| Epic 聚合 | 输入 storyRecords[]、epicStoryCount；epicStoryCount 由调用方传入 |
| 输出 | 与 Story 1.1 schema、Story 1.2 写入接口兼容 |

---

## 6. Dev Notes

### 6.1 技术栈与源树组件

- **语言**：TypeScript/Node，与 scoring 模块一致
- **规则加载**：scoring/parsers/rules.ts 的 loadPhaseScoringYaml、loadIterationTierYaml
- **Schema**：scoring/writer/types.ts 的 RunScoreRecord、CheckItem、IterationRecord
- **Veto 定义**：config/code-reviewer-config.yaml 的 veto_items；scoring/rules/default/implement-scoring.yaml、test-scoring.yaml、bugfix-scoring.yaml、gaps-scoring.yaml

### 6.2 建议实现位置

- **veto 与阶梯模块**：scoring/veto/ 或 scoring/rules/veto-and-tier.ts
- **Epic 聚合**：同模块内 evaluateEpicVeto 函数

### 6.3 测试标准

- 单元测试覆盖：veto 判定、tier 系数、severity_override 顺序、Epic 8 项至少 6 项
- 与 scoring/parsers、scoring/writer 无循环依赖

### 6.4 与 Story 3.2 的消费契约

本 Story 假定 check_items 中可含 veto 类 item_id（如 veto_core_logic、veto_owasp_high、veto_cwe798 等）且 passed 字段可区分。若 Story 3.2 当前未产出，实施时需与 3.2 对齐：扩展 audit-item-mapping 或解析规则以产出 veto_*，或由本 Epic 前置任务补充。

### 6.5 禁止词表合规

本 Story 文档及产出物禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### 6.6 Dev Agent Record 填写时机

`Agent Model Used` 占位在 Dev Story 实施阶段由子代理填写实际模型版本。

---

## 7. 与 Story 2.1、3.2、4.2 的接口约定

### 7.1 本 Story 从 2.1 接收

- loadPhaseScoringYaml(环节, options)、loadIterationTierYaml(options)
- 产出：PhaseScoringYaml（含 veto_items）、IterationTierYaml（iteration_tier、severity_override）
- gaps-scoring 的 veto_items 通过等效加载获取

### 7.2 本 Story 从 3.2 接收

- RunScoreRecord：check_items（item_id、passed、score_delta、note）、iteration_count、iteration_records、first_pass
- 消费契约：check_items 中可含 veto 类 item_id；若不存在则由 3.2 或前置任务扩展

### 7.3 本 Story 向 4.2 提供

- applyTierAndVeto(record)、evaluateEpicVeto(input)
- 教练可调用上述函数，结合 scoring 存储数据决定 iteration_passed

---

## 8. 依赖

- **前置 Story**：Story 2.1（eval-rules-yaml-config）。依赖 2.1 的 veto_items、iteration-tier 配置及 loadPhaseScoringYaml、loadIterationTierYaml 解析结果。
- 依赖 Story 1.1 的存储 schema 与四层架构；依赖 Story 3.2 的 RunScoreRecord 结构（check_items、iteration_count、iteration_records、first_pass）。

---

## Dev Agent Record

### Agent Model Used

待实施后填写（Dev Story 执行时由子代理填写实际模型版本）

### Debug Log References

### Completion Notes List

### File List

---

*本 Story 实现一票否决项与环节映射、角色一票否决权、Epic 级一票否决 8 项条件、多次迭代阶梯式扣分及致命/严重问题差异化，与 Story 2.1 规则配置及 1.1 评分核心衔接，为 Story 4.2 AI 教练提供判定能力。*
