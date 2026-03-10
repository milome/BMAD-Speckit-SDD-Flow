# Spec E4-S3：eval-scenario-bmad-integration

*Story 4.3 技术规格*
*Epic E4 feature-eval-coach-veto-integration*

---

## 1. 概述

本 spec 将 Story 4.3（eval-scenario-bmad-integration）的需求转化为可执行的技术规格，涵盖：场景区分（real_dev / eval_question）、Layer 1→5 完整路径约束、各阶段迭代结束标准、轻量化三原则、数据污染防护四条、与 BMAD 五层 workflows 的集成点。本 Story 产出以文档与校验为主，满足 Story 4.2 审计推迟闭环。

---

## 2. 功能范围

### 2.1 场景区分与路径约束（AC-1、AC-2）

**场景定义**（与 REQUIREMENTS §1.4、architecture §7.1/7.2 一致）：

| 场景 | 定义 | 触发条件 | writeMode | 校验规则 |
|------|------|----------|-----------|----------|
| **real_dev** | 自有真实需求开发；基于真实业务需求的全流程开发 | 各 stage 审计通过后自动解析既有审计报告写入 | 见 config/scoring-trigger-modes.yaml | scenario 必填；path_type 默认 full |
| **eval_question** | 评测题目执行；基于预设评测题（题池）执行，用于模型横向对比 | 每次题目执行产生独立 run_id | 同上 | scenario 必填；path_type 必为 full；**question_version 必填** |

**路径约束**（REQUIREMENTS §1.4.1）：

- real_dev 与 eval_question **均须走 BMAD Layer 1→2→3→4→5 完整路径**；不得采用简化路径（如仅 Layer 4、Layer 3+4）。
- path_type 记录 `full`，用于追溯与审计。
- eval_question 场景下 question_version 必填；未填则校验失败。

| 需求要点 | 技术规格 |
|----------|----------|
| scenario 校验 | scoring 写入前校验 scenario ∈ { real_dev, eval_question }；已有 schema 支持 |
| path_type 默认 | 写入时 path_type 默认 `full`；若入参未提供则自动补全 |
| question_version 必填 | scenario = eval_question 时，question_version 不得为空或未定义；校验失败时拒绝写入并抛出明确错误 |
| 可验证方式 | 单测或验收脚本：给定 scenario、question_version 组合，断言校验通过或失败符合预期 |

### 2.2 各阶段迭代结束标准（AC-3）

**落位**：scoring/docs/ITERATION_END_CRITERIA.md 或 config/ 等价文档；与 BMAD 五层各 stage 一一对应。

| 阶段 | 迭代结束标准 | 与 REQUIREMENTS §2.2 对照 |
|------|--------------|---------------------------|
| prd | PRD 审计「完全覆盖」且（若启用评分）环节 1 得分已写入 | §2.2 Layer 1 prd |
| arch | Architecture 审计「完全覆盖」且（若启用）环节 1 补充与环节 2 设计侧得分已更新 | §2.2 Layer 1 arch |
| epics | create-epics-and-stories 产出完成；无独立评分环节 | §2.2 Layer 2 |
| story | Create Story 审计「完全覆盖、验证通过」且（若启用）环节 1 补充得分已写入 | §2.2 Layer 3 |
| specify | spec 审计「完全覆盖、验证通过」且（若启用）环节 1 得分已写入 | §2.2 Layer 4 |
| plan | plan 审计「完全覆盖、验证通过」且（若启用）环节 1 补充与环节 2 设计侧得分已更新 | §2.2 Layer 4 |
| gaps | gaps 前置完整性评审通过；IMPLEMENTATION_GAPS 审计「完全覆盖、验证通过」；与 tasks 衔接已确认；且（若启用）环节 1 补充得分已写入 | §2.2 Layer 4 |
| tasks | tasks 审计「完全覆盖、验证通过」且各任务验收表已按实际执行填写 | §2.2 Layer 4 |
| implement | 执行 tasks 后审计（audit-prompts §5）「完全覆盖、验证通过」且环节 2–6 得分已录入 | §2.2 Layer 4 |
| post_impl | 实施后审计 §5「完全覆盖、验证通过」且环节 2–6 得分已录入、综合分与等级已计算并写入 | §2.2 Layer 5 |
| pr_review | 强制人工审核通过；可记录（不强制写入） | §2.2 Layer 5 |

**与 Story 4.2 教练的 iteration_passed 判定衔接**：教练判定依赖各阶段迭代结束标准；ITERATION_END_CRITERIA 文档须说明教练的 iteration_passed 如何基于上述标准判定。

### 2.3 轻量化三原则（AC-4）

**三原则释义与可验证检查项**：

| 原则 | 释义 | 可验证检查项 |
|------|------|--------------|
| **同机执行** | 评分写入与各阶段审计同机执行；审计通过即从既有审计报告与验收表解析并写入；无额外人工填写、无新增必填表单 | 无新增必填表单；解析逻辑从既有 audit 报告路径读取 |
| **按配置启用** | 全体系评分可按项目或按运行配置关闭；未启用时，各阶段迭代结束标准与现有 BMAD+Speckit 完全一致，无任何新增步骤 | config/scoring-trigger-modes.yaml 或等效支持「关闭评分」逻辑或文档说明；未启用时无解析/写入步骤 |
| **最小侵入** | 不修改现有审计闭环的输入输出格式；仅增加「解析既有产出并写入评分存储」的配置化后置步骤；现有 progress、artifacts、_bmad-output 结构保持不变 | 无修改 audit-prompts 输出格式；parseAndWriteScore 为后置步骤；progress/artifacts 结构不变 |

**按配置启用落位**：config/scoring-trigger-modes.yaml 已由 Story 3.3 实现；若当前 YAML 无显式「关闭」键，则须在文档中说明：通过不调用 parseAndWriteScore、或通过环境变量/项目配置跳过评分写入，即可实现「按配置关闭」。

### 2.4 数据污染防护四条（AC-5）

**落位**：scoring/docs/DATA_POLLUTION_PREVENTION.md 或项目 checklist；与 REQUIREMENTS §3.7、architecture §7.4 一致。

| 措施 | 操作要点 | 触发条件/建议阈值 |
|------|----------|-------------------|
| 题目来源与时间隔离 | 评测题基于自有业务需求或历史项目原创设计；不采用公开题库 | 题目入库前须标注来源；公开题库题目不得纳入题池 |
| 定期迭代题池 | 按周期更新题池，淘汰旧题 | 周期建议 1–2 个月；触发条件：达到周期即执行题池轮换 checklist |
| 混淆变量校验 | 对题目做逻辑等价改写（变量名、表述替换）；通过率下降超过阈值时触发人工复核 | 阈值：受测模型在改写题上通过率下降 >20%；不自动淘汰题目，需人工复核 |
| 私有闭卷与评测接口分离 | 完整题库不对外公开；仅开放评测接口或脱敏样本 | 操作要点：题库存储于私有仓库；对外仅提供评测 API 或脱敏示例 |

### 2.5 与 BMAD 五层 workflows 集成点（AC-6）

**落位**：scoring/docs/BMAD_INTEGRATION_POINTS.md 或 INTEGRATION.md 扩展；与 architecture §7.3 一致。

| 集成点 | 触发时机 | 调用方式 |
|--------|----------|----------|
| speckit-workflow | clarify/checklist/analyze 嵌入各审计闭环；stage 完成 → 调用全链路 Skill 的「解析并写入」逻辑 | 各 speckit 阶段（specify/plan/gaps/tasks）审计通过后，按 config/scoring-trigger-modes.yaml 决定是否触发 parseAndWriteScore |
| bmad-story-assistant | 审计步骤调度 code-reviewer；各 stage 审计通过后触发评分解析与写入 | Create Story、Dev Story 等流程中，审计通过后按配置触发；与 speckit 类似 |
| 全链路 Skill | 在上述流程的各 stage 审计通过后触发评分解析与写入 | bmad-code-reviewer-lifecycle（或等效）编排 parseAndWriteScore；与 config/scoring-trigger-modes.yaml、config/stage-mapping.yaml 衔接 |

**可验证性**：至少一个集成点可由脚本或 Cursor Task 调用并验证（例如执行 accept-e3-s3 或等效验收脚本，确认 parseAndWriteScore 可被触发）。

### 2.6 禁止词表校验（T6）

本 Story 产出文档全文检索禁止词；若有则修正。

**禁止词表**：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债。

---

## 3. 接口与依赖

### 3.1 消费 Story 3.3 产出

- config/scoring-trigger-modes.yaml：触发模式表，覆盖 real_dev、eval_question
- parseAndWriteScore：解析并写入逻辑；本 Story 不修改，仅在文档层明确约束

### 3.2 消费 scoring 既有组件

- scoring/schema/run-score-schema.json：scenario、path_type、question_version 已支持
- scoring/writer/validate.ts：可扩展校验逻辑，增加 eval_question 时 question_version 必填校验

### 3.3 文档落位

| 文档 | 路径 | 职责 |
|------|------|------|
| SCENARIO_AND_PATH_RULES | scoring/docs/SCENARIO_AND_PATH_RULES.md | 场景定义、路径约束、path_type、question_version |
| ITERATION_END_CRITERIA | scoring/docs/ITERATION_END_CRITERIA.md | 各 stage 迭代结束标准，与 Story 4.2 衔接 |
| LIGHTWEIGHT_PRINCIPLES | scoring/docs/LIGHTWEIGHT_PRINCIPLES.md | 轻量化三原则释义与可验证检查项 |
| DATA_POLLUTION_PREVENTION | scoring/docs/DATA_POLLUTION_PREVENTION.md | 四条防护操作要点与触发条件 |
| BMAD_INTEGRATION_POINTS | scoring/docs/BMAD_INTEGRATION_POINTS.md | speckit-workflow、bmad-story-assistant、全链路 Skill 触发时机与调用方式 |

---

## 4. 非功能需求

### 4.1 本 Story 不包含

- 一票否决项与环节映射、Epic 级 veto、多次迭代阶梯式扣分：Story 4.1 实现
- AI 代码教练定位、职责、工作流、一票否决权：Story 4.2 实现
- 全链路 Skill 定义、Layer 1–3 解析、scoring 写入逻辑：Story 3.1、3.2、3.3 实现
- 权威文档 SCORING_CRITERIA_AUTHORITATIVE.md 产出：Story 2.2 实现

### 4.2 测试与验收约束

- 单元测试或验收脚本：给定 scenario、question_version 组合，断言校验通过或失败符合预期
- 文档存在性：各产出文档存在且与 REQUIREMENTS、architecture 逐项对照
- 禁止词校验：产出文档全文检索禁止词，无命中

### 4.3 与 Story 4.2 的衔接

- Story 4.2 将「场景区分、BMAD 五层集成、数据污染防护」推迟给本 Story
- 本 Story 产出后，4.2 审计闭环满足
- 教练的 iteration_passed 判定依赖 ITERATION_END_CRITERIA 文档中的标准

---

## 5. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story 4.3 §1.1(1) | 场景区分 real_dev/eval_question | spec §2.1 | ✅ |
| Story 4.3 §1.1(2) | 两种场景均走 Layer 1→5 完整路径 | spec §2.1 | ✅ |
| Story 4.3 §1.1(3) | 各阶段迭代结束标准 | spec §2.2 | ✅ |
| Story 4.3 §1.1(4) | 轻量化三原则 | spec §2.3 | ✅ |
| Story 4.3 §1.1(5) | 数据污染防护四条 | spec §2.4 | ✅ |
| Story 4.3 §1.1(6) | 与 BMAD 五层 workflows 集成点 | spec §2.5 | ✅ |
| REQUIREMENTS §1.4 | 场景区分、§1.4.1 路径 | spec §2.1 | ✅ |
| REQUIREMENTS §2.2 | 各阶段迭代结束标准 | spec §2.2 | ✅ |
| REQUIREMENTS §3.7 | 数据污染防护四条 | spec §2.4 | ✅ |
| architecture §7.1、§7.2 | 主流程、评测题目执行流程 | spec §2.1 | ✅ |
| architecture §7.3 | BMAD 集成点 | spec §2.5 | ✅ |
| architecture §7.4 | 数据污染防护 | spec §2.4 | ✅ |

---

*本 spec 实现场景区分、BMAD 五层集成、数据污染防护的文档化与校验，满足 Story 4.2 审计推迟闭环。*
