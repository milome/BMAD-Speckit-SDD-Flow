# Story 4.3：eval-scenario-bmad-integration

Status: ready-for-dev

**Epic**：E4 feature-eval-coach-veto-integration  
**Story ID**：4.3  
**Slug**：eval-scenario-bmad-integration

<!-- Note: 可执行 validate-create-story 进行质量检查后再进入 dev-story。 -->

## Story

As a 评测运营与模型研发团队，  
I want 实现场景区分（real_dev/eval_question）、两种场景均走 Layer 1→5 完整路径、各阶段迭代结束标准、轻量化三原则（同机执行、按配置启用、最小侵入）、数据污染防护及与 BMAD 五层 workflows 的集成点，  
so that Story 4.2 审计推迟闭环得以满足，评测题目与自有开发在路径与防护上一致，且 BMAD 全流程可被评分体系正确衔接。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **场景区分（real_dev / eval_question）**
   - 归属：本 Story 负责场景定义与路径约束的文档化与校验逻辑
   - 两种场景定义：自有真实需求开发（real_dev）、评测题目执行（eval_question）；与 REQUIREMENTS §1.4、architecture §7.1/7.2 一致
   - scenario 字段在 scoring 存储中已由 Story 1.1、3.3 支持；本 Story 明确各场景下的触发条件、writeMode 与校验规则

2. **两种场景均走 Layer 1→5 完整路径**
   - 归属：本 Story 负责路径约束的文档化与可验证性
   - 约束：real_dev 与 eval_question 均须走 BMAD Layer 1→2→3→4→5 完整路径；不得采用简化路径（如仅 Layer 4、Layer 3+4）；REQUIREMENTS §1.4.1
   - 可验证方式：path_type 或等价字段记录 full；eval_question 场景下 question_version 必填

3. **各阶段迭代结束标准**
   - 归属：本 Story 负责将 REQUIREMENTS §2.2 与 architecture 表 A/B 中的迭代结束标准文档化并落位到 scoring 或项目 checklist
   - 标准：每阶段「审计完全覆盖」且（若启用评分）该阶段对应环节得分已写入 scoring 存储；与 Story 4.2 教练的 iteration_passed 判定衔接
   - 落位：scoring/docs/ 或 config/ 下的 ITERATION_END_CRITERIA.md 或等价文档；与 BMAD 五层各 stage 一一对应

4. **轻量化三原则（同机执行、按配置启用、最小侵入）**
   - 归属：本 Story 负责三原则的文档化与实现校验
   - **同机执行**：评分写入与各阶段审计同机执行；审计通过即从既有审计报告与验收表解析并写入；无额外人工填写、无新增必填表单
   - **按配置启用**：全体系评分可按项目或按运行配置关闭；未启用时，各阶段迭代结束标准与现有 BMAD+Speckit 完全一致，无任何新增步骤；配置落位：config/scoring-trigger-modes.yaml 或等效
   - **最小侵入**：不修改现有审计闭环的输入输出格式；仅增加「解析既有产出并写入评分存储」的配置化后置步骤；现有 progress、artifacts、_bmad-output 结构保持不变

5. **数据污染防护（§3.7 四条）**
   - 归属：本 Story 负责四条防护的操作要点与触发条件文档化并落位
   - **题目来源与时间隔离**：评测题基于自有业务需求或历史项目原创设计，不采用公开题库；操作要点文档化
   - **定期迭代题池**：按周期（如 1–2 个月）更新题池，淘汰旧题；触发条件与周期在 checklist 或 scoring 文档中定义
   - **混淆变量校验**：对题目做逻辑等价改写（变量名、表述替换）；若受测模型在改写题上通过率下降 >20%，触发人工复核；基准与阈值由实施时在 scoring/ 或项目 checklist 定义
   - **私有闭卷与评测接口分离**：完整题库不对外公开，仅开放评测接口或脱敏样本；操作要点文档化
   - 落位：scoring/docs/DATA_POLLUTION_PREVENTION.md 或项目 checklist；对应 architecture §7.4

6. **与 BMAD 五层 workflows 集成点**
   - 归属：本 Story 负责集成点的文档化与可调用性验证
   - 集成点：speckit-workflow、bmad-story-assistant、全链路 Skill；与 architecture §7.3 一致
   - 行为：各 stage 审计通过后触发「解析并写入」；触发模式表（config/scoring-trigger-modes.yaml）已由 Story 3.3 实现；本 Story 明确各 BMAD workflow 的触发时机与调用方式，产出 INTEGRATION_POINTS.md 或等效

### 1.2 本 Story 不包含

- 一票否决项与环节映射、Epic 级 veto、多次迭代阶梯式扣分：由 Story 4.1 实现；本 Story 消费 4.1 产出
- AI 代码教练定位、职责、工作流、一票否决权：由 Story 4.2 实现；本 Story 与 4.2 衔接
- 全链路 Skill 定义、Layer 1–3 解析、scoring 写入逻辑：由 Story 3.1、3.2、3.3 实现
- 权威文档 SCORING_CRITERIA_AUTHORITATIVE.md 产出：由 Story 2.2 实现

---

## 2. Acceptance Criteria（验收标准）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-1 | 场景区分（real_dev/eval_question）定义明确，与 REQUIREMENTS §1.4 一致；scenario 校验逻辑可验证 | 文档存在；单测或验收脚本：给定 scenario，断言 path_type、question_version（eval_question 时）符合约束 |
| AC-2 | 两种场景均走 Layer 1→5 完整路径的约束文档化；path_type 记录 full；eval_question 时 question_version 必填 | 文档存在；schema 或校验逻辑覆盖 |
| AC-3 | 各阶段迭代结束标准文档化，与 BMAD 五层各 stage 一一对应；落位 scoring/docs 或 config | 文档存在；与 REQUIREMENTS §2.2、architecture 表 A/B 对照 |
| AC-4 | 轻量化三原则文档化；同机执行、按配置启用、最小侵入均可验证 | 文档存在；config 或代码证明评分可按配置关闭、无新增必填表单 |
| AC-5 | 数据污染防护四条的操作要点与触发条件落位 scoring/docs 或项目 checklist；与 §3.7 一致 | 文档存在；每条有明确操作要点或触发阈值 |
| AC-6 | 与 BMAD 五层 workflows 的集成点文档化；speckit-workflow、bmad-story-assistant、全链路 Skill 触发时机与调用方式明确 | 文档存在；至少一个集成点可由脚本或工作流调用并验证 |

---

## 3. Tasks / Subtasks

- [ ] **T1** 场景区分与路径约束（AC: #1, #2）
  - [ ] T1.1 产出 scoring/docs/SCENARIO_AND_PATH_RULES.md：real_dev 与 eval_question 定义、Layer 1→5 完整路径约束、path_type、question_version 要求
  - [ ] T1.2 实现或扩展现有校验：eval_question 时 question_version 必填；path_type 默认 full
  - [ ] T1.3 单测或验收脚本：给定 scenario、question_version，断言校验通过或失败符合预期

- [ ] **T2** 各阶段迭代结束标准文档化（AC: #3）
  - [ ] T2.1 产出 scoring/docs/ITERATION_END_CRITERIA.md 或 config/ 等价文档：Layer 1–5 各 stage 的迭代结束标准，与 REQUIREMENTS §2.2 逐项对照
  - [ ] T2.2 与 Story 4.2 教练的 iteration_passed 判定衔接说明写入文档

- [ ] **T3** 轻量化三原则文档化与校验（AC: #4）
  - [ ] T3.1 产出 scoring/docs/LIGHTWEIGHT_PRINCIPLES.md：同机执行、按配置启用、最小侵入的释义与可验证检查项
  - [ ] T3.2 验证 config/scoring-trigger-modes.yaml 支持按配置关闭评分的逻辑或文档说明

- [ ] **T4** 数据污染防护落位（AC: #5）
  - [ ] T4.1 产出 scoring/docs/DATA_POLLUTION_PREVENTION.md 或项目 checklist：四条防护的操作要点、触发条件、建议阈值
  - [ ] T4.2 与 architecture §7.4、REQUIREMENTS §3.7 逐项对照

- [ ] **T5** BMAD 五层 workflows 集成点文档化（AC: #6）
  - [ ] T5.1 产出 scoring/docs/BMAD_INTEGRATION_POINTS.md 或 INTEGRATION.md 扩展：speckit-workflow、bmad-story-assistant、全链路 Skill 各 stage 的触发时机与调用方式
  - [ ] T5.2 与 config/scoring-trigger-modes.yaml、architecture §7.3 衔接；至少一个集成点可由脚本或 Cursor Task 调用并验证

- [ ] **T6** 禁止词表校验（AC: 隐含）
  - [ ] T6.1 本 Story 产出文档全文检索禁止词；若有则修正

---

## 4. PRD 追溯

| PRD 需求 ID | 本 Story 覆盖内容 |
|-------------|-------------------|
| REQ-1.1~1.6 | 场景区分、Layer 1→5 完整路径、轻量化三原则 |
| REQ-2.1~2.5 | 表 A/B 落位、各阶段迭代结束标准、BMAD 五层集成 |
| REQ-3.11 | 数据污染防护四条 |
| REQ-4.1, REQ-5.1, REQ-5.2, REQ-6.1, REQ-6.2 | 与主流评测体系关系、实施步骤、风险假设 |

---

## 5. Architecture 约束

| 组件 | 约束 |
|------|------|
| 场景字段 | scenario 已在 schema 中支持；本 Story 明确校验与文档 |
| 触发模式表 | 消费 config/scoring-trigger-modes.yaml（Story 3.3 产出）；扩展或文档化按配置启用逻辑 |
| 数据流 | 与 architecture §7.1、§7.2 一致；eval_question 走完整路径 |
| 数据污染防护 | 与 architecture §7.4、REQUIREMENTS §3.7 一致 |
| BMAD 集成点 | 与 architecture §7.3 一致；speckit-workflow、bmad-story-assistant、全链路 Skill |

---

## 6. Dev Notes

### 6.1 技术栈与源树组件

- **语言**：TypeScript/Node，与 scoring 模块一致
- **配置**：config/scoring-trigger-modes.yaml、config/stage-mapping.yaml
- **文档落位**：scoring/docs/（SCENARIO_AND_PATH_RULES.md、ITERATION_END_CRITERIA.md、LIGHTWEIGHT_PRINCIPLES.md、DATA_POLLUTION_PREVENTION.md、BMAD_INTEGRATION_POINTS.md）
- **权威文档**：scoring/docs/SCORING_CRITERIA_AUTHORITATIVE.md；REQUIREMENTS §1.4、§1.5、§2.2、§3.7；architecture §7

### 6.2 与 Story 4.2 的衔接

- Story 4.2 将「场景区分、BMAD 五层集成、数据污染防护」推迟给本 Story；本 Story 产出后，4.2 审计闭环满足
- 教练的 iteration_passed 判定依赖各阶段迭代结束标准；本 Story 文档与 4.2 衔接

### 6.3 与 Story 3.3 的衔接

- config/scoring-trigger-modes.yaml 已覆盖 real_dev、eval_question；本 Story 在文档层面明确两场景的差异与约束，不重复实现写入逻辑

### 6.4 禁止词表合规

本 Story 文档及产出物禁止使用：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

### 6.5 Dev Agent Record 填写时机

`Agent Model Used` 占位在 Dev Story 实施阶段由子代理填写实际模型版本。

---

## 7. References

- [Source: docs/BMAD/REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md#§1.4, §1.5, §2.2, §3.7]
- [Source: _bmad-output/planning-artifacts/dev/architecture.ai-code-eval-system.md#§7]
- [Source: _bmad-output/implementation-artifacts/4-2-eval-ai-coach/4-2-eval-ai-coach.md#§1.2 推迟闭环]
- [Source: config/scoring-trigger-modes.yaml]

---

## Dev Agent Record

### Agent Model Used

待实施后填写（Dev Story 执行时由子代理填写实际模型版本）

### Debug Log References

### Completion Notes List

### File List

---

*本 Story 实现场景区分、BMAD 五层集成、数据污染防护，满足 Story 4.2 审计推迟闭环要求，与 epics.md §49 scope 一致。*
