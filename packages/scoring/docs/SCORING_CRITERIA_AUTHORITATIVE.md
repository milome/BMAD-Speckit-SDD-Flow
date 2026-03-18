# AI 代码评测体系 — 评分标准权威文档

**规则版本号**：1.0（与 scoring/rules 一致）  
**文档修订日期**：2026-03-04

---

## 1. BMAD 五层与阶段列表（表 A）

| BMAD Layer | 阶段（stage） | 说明 |
|------------|---------------|------|
| Layer 1 产品定义层 | prd, arch | Product Brief→复杂度评估→PRD→Architecture；code-review(prd/arch) |
| Layer 2 Epic/Story 规划层 | epics | create-epics-and-stories→Epic 列表、Story 列表、依赖图；无独立评分环节 |
| Layer 3 Story 开发层 | story | Create Story→Party-Mode→Story 文档；第一遍审计 |
| Layer 4 技术实现层 | specify, plan, gaps, tasks, implement | speckit 五阶段；code-review §1–§5 |
| Layer 5 收尾层 | post_impl, pr_review | 实施后审计 §5；PR 生成 + 强制人工审核 |

---

## 2. 阶段 → 评分环节映射（表 B）

| 阶段 | 对应评分环节 | 说明 |
|------|--------------|------|
| prd | 环节 1（需求拆解与方案设计） | PRD 审计通过且需求覆盖完整 |
| arch | 环节 1 补充、环节 2 设计侧 | Architecture 审计通过且架构/技术选型合理 |
| epics | 环节 1 输入依据（不单独计分） | Epic/Story 列表为需求拆解完整性检查输入 |
| story | 环节 1 补充 | Create Story 审计通过且 Story 文档满足 PRD/Arch/Epic 覆盖 |
| specify | 环节 1 | spec 审计通过且需求覆盖完整、边界与方案合理 |
| plan | 环节 1 补充、环节 2 设计侧 | plan 审计通过且架构/技术选型合理 |
| gaps | 环节 1 补充（前置）、环节 2–5 输入、环节 2/6 后置闭合度 | IMPLEMENTATION_GAPS 审计通过；gaps 前置完整性评审通过 |
| tasks | 环节 2–5 | 任务列表审计通过，任务执行与验收对应代码、测试、调试、集成 |
| implement | 环节 2–6 | 实现阶段审计通过、TDD 执行完成 |
| post_impl | 环节 2–6 | 实施后审计 §5 通过 |
| pr_review | 环节 6 补充 | 人工审核通过，可记录发布质量 |

**gaps 双轨评审**：gaps 前置完整性（规范全覆盖、gap 定义清晰性、风险预判）计入环节 1；后置闭合度在 implement、post_impl 阶段计入环节 2 的 30%、环节 6 的 50%。

---

## 3. 各阶段审计产出路径与解析规则

| 阶段 | 主要审计产出 | 对应的评分环节 | 可解析性 |
|------|--------------|----------------|----------|
| prd | PRD 审计报告、需求覆盖与完整性结论 | 环节 1 | 可解析，audit-prompts-prd.md 对应 |
| arch | Architecture 审计报告、架构/技术选型合理性结论 | 环节 1 补充、环节 2 设计侧 | 可解析，audit-prompts-arch.md 对应 |
| specify | spec 审计报告、需求覆盖与边界/方案合理性结论 | 环节 1 | 可解析 |
| plan | plan 审计报告 | 环节 1 补充、环节 2 设计侧 | 可解析 |
| gaps | IMPLEMENTATION_GAPS 审计报告、gaps 前置完整性评审报告 | 环节 1 补充、环节 2–5 输入依据 | 可解析 |
| tasks | tasks 审计报告、各任务验收表 | 环节 2–5 | 可解析 |
| implement | 执行 tasks 后审计报告（audit-prompts §5）、集成/端到端测试结果 | 环节 2–6 | 可解析 |
| post_impl | 实施后审计 §5 报告 | 环节 2–6 | 可解析 |

**Layer 1–3 同机解析**：各 Layer 审计产出支持同机解析并写入评分；解析规则来源于 audit-prompts、code-reviewer-config。

---

## 4. stage 字段完整枚举

| stage 值 | 说明 |
|----------|------|
| prd | Layer 1 产品定义 |
| arch | Layer 1 架构设计 |
| epics | Layer 2 Epic/Story 规划 |
| story | Layer 3 Story 开发 |
| specify | Layer 4 speckit 规格化 |
| plan | Layer 4 speckit 规划 |
| gaps | Layer 4 speckit 差距分析 |
| tasks | Layer 4 speckit 任务分解 |
| implement | Layer 4 speckit 实现 |
| post_impl | Layer 5 实施后审计 |
| pr_review | Layer 5 PR 审核 |

---

## 5. 六环节权重及依据说明

| 环节 | 权重 | 说明 | 工业依据 |
|------|------|------|----------|
| 环节 1：需求拆解与方案设计 | 20 分 | 需求覆盖、边界条件、技术选型 | 人力投入占比、能力区分度 |
| 环节 2：代码生成与工程规范 | 25 分 | 功能正确性、代码规范、异常处理、安全、可维护性 | 企业落地痛点、工程卡点 |
| 环节 3：测试用例与质量保障 | 25 分 | 测试覆盖、用例质量、回归、边界、性能测试 | 质量闭环、人力占比 |
| 环节 4：调试与 bug 修复 | 15 分 | 修复正确性、无回归、修复效率、文档 | 调试占比 |
| 环节 5：跨模块/存量项目集成 | 10 分 | 集成完整性、兼容性 | 落地难点 |
| 环节 6：端到端全流程交付 | 5 分 | 交付验收、全流程闭环 | 结果锚定 |

**依据**：真实开发人力占比（需求/设计/测试/调试占 70%+，代码约 30%）；企业落地痛点（规范、测试、安全为卡点）；能力区分度（需求拆解与全流程质量闭环区分度高）。具体权重在 scoring/rules 中可配置。

---

## 6. 各环节检查项清单（与 audit-prompts、code-reviewer 对应）

每环节至少 5 项强制、3 项加分；每项含 ID、名称、判定标准、扣分/加分规则，与 audit-prompts、code-reviewer-config 的 item_id 对应。

### 环节 1（需求拆解与方案设计）

| item_id | 名称 | 类型 | 判定标准 | 扣分/加分 | 对应 audit-prompts |
|---------|------|------|----------|-----------|---------------------|
| spec_coverage | 需求覆盖完整度 | 强制 | 核心业务需求无遗漏 | 每遗漏 1 项扣 3 分 | audit-prompts-prd.md |
| boundary_annotation | 边界条件与异常标注 | 强制 | 明确标注边界与异常 | 每遗漏 1 类扣 2 分 | audit-prompts-prd.md |
| module_granularity | 模块拆分颗粒度 | 强制 | 符合单一职责 | 每处不合理扣 2 分 | audit-prompts-arch.md |
| tech_selection | 技术选型与业务匹配 | 强制 | 选型匹配业务 | 不匹配扣 5 分 | audit-prompts-arch.md |
| testability | 可测试性与验收标准 | 强制 | 需求可拆为可验证验收项 | 缺失扣 4 分 | audit-prompts-prd.md |
| risk_anticipation | 技术风险预判 | 加分 | 有预判且给出方案 | 加 5 分 | audit-prompts-arch.md |
| arch_extensibility | 架构可扩展 | 加分 | 符合最佳实践 | 加 5 分 | audit-prompts-arch.md |
| stack_alignment | 选型与团队栈一致 | 加分 | 一致 | 加 3 分 | audit-prompts-arch.md |

### 环节 2（代码开发与工程规范）

| item_id | 名称 | 类型 | 判定标准 | 扣分 | 对应 code-reviewer-config |
|---------|------|------|----------|------|---------------------------|
| func_correct | 功能正确性 | 强制 | 核心逻辑无错误 | 每错误扣 10 分 | functional_correctness |
| code_standards | 代码规范符合度 | 强制 | 命名、类型注解、注释 | 每违规扣 2 分 | naming_conventions |
| exception_handling | 异常处理完整性 | 强制 | 核心异常处理完整 | 每遗漏扣 4 分 | exception_handling |
| security | 安全合规性 | 加分 | OWASP、无硬编码凭证 | 低危扣 10 分 | owasp_top10 |
| perf_maintain | 性能与可维护性 | 加分 | 复杂度、可维护性 | 合理加 10 分 | complexity_maintainability |

### 环节 3（测试保障）、环节 4（Bug 修复）、环节 5、6

与 scoring/rules/default/test-scoring.yaml、bugfix-scoring.yaml 中 items 一致；每项 ref 指向 code-reviewer-config#item_id。

---

## 7. 一票否决项及触发条件、后果

| 一票否决项 | 所属环节 | 后果 |
|------------|----------|------|
| OWASP Top 10 高危 | 环节 2 | 环节 0 分，综合等级下调一级（L1 不再下调） |
| 硬编码敏感信息（CWE-798） | 环节 2 | 同上 |
| 核心业务需求完全遗漏、功能不符预期 | 环节 1 | 同上 |
| 代码无法编译/运行、致命语法错误 | 环节 2 | 同上 |
| 修复引入次生高危 bug | 环节 4 | 同上 |

**OWASP Top 10 判定标准与权威文档**：https://owasp.org/Top10/ ； https://owasp.org/Top10/2025/

**CWE-798 硬编码凭证判定标准**：https://cwe.mitre.org/data/definitions/798.html

**角色一票否决权**：
- **批判审计员**：对审计闭环收敛的一票否决；审计结论为「本轮存在 gap」或「未通过」时，本轮不收敛。
- **AI 代码教练**：对全流程迭代达标的一票否决；输出 `iteration_passed: false` 时，本轮迭代不达标。

---

## 8. 四能力维度聚合公式

| 维度 | 来源环节 | 聚合方式 |
|------|----------|----------|
| 需求与设计能力 | 环节 1 | 环节 1 得分 |
| 代码与工程能力 | 环节 2、5 | 环节 2 与环节 5 加权 |
| 质量与闭环能力 | 环节 3、4 | 环节 3 与环节 4 加权 |
| 端到端交付能力 | 环节 6 | 环节 6 得分 |

综合得分 = Σ(环节得分 × 对应权重)，0–100 分。

---

## 9. L1–L5 等级定义与得分区间

| 等级 | 得分区间 | 说明 |
|------|----------|------|
| L5 专家级 | 90–100 | 工业级交付能力 |
| L4 资深级 | 80–89 | 较强综合能力 |
| L3 进阶级 | 60–79 | 基础达标 |
| L2 入门级 | 40–59 | 有明显短板 |
| L1 玩具级 | 0–39 | 未达工业级标准 |

---

## 10. 数据保存 schema 及字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| run_id | string | 单次运行唯一标识 |
| scenario | enum | real_dev \| eval_question |
| stage | string | prd \| arch \| epics \| story \| specify \| plan \| gaps \| tasks \| implement \| post_impl \| pr_review |
| path_type | string | 记录路径类型，如 full |
| phase_score | int | 该阶段对应的评分环节（1–6）得分 |
| phase_weight | float | 该环节权重 |
| check_items | array | 各检查项通过/不通过、扣分/加分明细 |
| timestamp | string | ISO 8601 |
| model_version | string | 受测模型版本 |
| question_version | string | 评测题目版本 |
| iteration_count | int | 该 stage 整改迭代次数（0 表示一次通过） |
| iteration_records | array | 每次整改记录：{timestamp, result, severity, note} |
| first_pass | bool | 是否一次通过（true=阶梯系数 100%） |

**check_items 明细**：item_id、passed、score_delta、note。

---

## 11. 评分规则配置示例及 YAML schema 说明

与 scoring/rules 一致。环节 2 示例（implement-scoring.yaml）：

```yaml
version: "1.0"
stage: implement
link_stage: [tasks, post_impl]
link_环节: 2
weights:
  base:
    functional_correctness: 30
    code_standards: 18
    exception_handling: 12
  bonus:
    security_compliance: 20
    performance_maintainability: 20
items:
  - id: func_correct
    ref: code-reviewer-config#functional_correctness
    deduct: 10
veto_items:
  - id: veto_hardcoded_secret
    ref: code-reviewer-config#veto_cwe798
    consequence: stage_0_level_down
```

**gaps-scoring.yaml**：前置 spec_coverage 40%；后置 implement/post_impl 权重。**iteration-tier.yaml**：1→1.0、2→0.8、3→0.5、4→0；severity_override fatal:3、serious:2。

---

## 12. Code Reviewer Skill 与需求的整合说明

- **6 阶段↔六环节**：需求拆解(1)、代码开发(2)、测试保障(3)、Bug 修复(4)、跨模块集成(5)、Story 交付验收(6)。
- **触发时机**：stage 审计产出完成、Story 状态变更、MR 创建、Epic 待验收、用户显式请求。
- **维度换算**：环节得分 = (分项得分之和 / 100) × 环节权重。
- **输出与 scoring 存储衔接**：item_id、veto 与 scoring/rules 配置一致，写入 §10 schema。

---

## 13. 全链路 Skill 独立与引用关系

| 引用组件 | 职责 | 引用方式 |
|----------|------|----------|
| code-reviewer | 执行各 stage 审计 | Cursor Task 调度 |
| audit-prompts | 各 stage 审计提示词 | audit-prompts-prd.md、audit-prompts-arch.md 等 |
| code-reviewer-config | 多模式配置 | _bmad/_config/code-reviewer-config.yaml |
| scoring/rules | 解析规则、item_id、veto_items | scoring/rules/*.yaml |

与 speckit-workflow、bmad-story-assistant 协同：clarify/checklist/analyze 嵌入审计闭环；stage 完成→解析并写入 scoring 存储。

---

## 14. AI 代码教练的定位、职责、人格、技能配置、工作流、输出格式

- **定位**：用资深工程师视角，精准定位能力短板，设计可落地的评测/优化方案；承载全流程审计闭环的重要输出与迭代结束标准。
- **职责**：解读评分、定位短板、优化方案设计；消费全链路 Skill 产出，不重复执行审计。
- **人格**：资深工程师视角、工业级标准、可落地导向；输出精准、可执行。
- **技能配置**：引用全链路 Code Reviewer Skill；fallback 为仅解读既有 scoring 存储。
- **工作流**：各 stage 审计完成且得分写入后可被触发；输入为 run_id 对应数据；输出含 summary、phase_scores、weak_areas、recommendations、iteration_passed。
- **禁止表述**：产出不得以「面试」为主导；仅可保留「成果可用于对外能力说明等场景」等中性表述。

---

## 15. Epic 综合评分

- **单 Story 综合分**：综合得分 = Σ(环节得分 × 环节权重)，0–100 分。
- **Epic 综合分**：Epic 综合分 = Σ(Story 综合分 × Story 权重)，Story 权重可配置（默认均等）。
- **L1–L5 映射**：Epic 综合分采用与单次运行相同的得分区间。

---

## 16. Epic 级一票否决

以下任一条件触发时，Epic 综合等级直接降为 L1 或标记「不达标」：

| 条件 | 默认阈值 |
|------|----------|
| 单阶段 veto 次数 ≥3 | 3 次 |
| 需求交付率 < 阈值 | 80% |
| 高危漏洞 ≥ 阈值 | 2 个 |
| 测试通过率 < 阈值 | 80% |
| 整改≥4 次未通过 Story 数 ≥1 | 1 个 |
| 一次通过率<50% | 50% |
| 整改≥3 次 Story 数 ≥2 | 2 个 |
| 致命问题整改≥3 次 Story 数 ≥1 | 1 个 |

---

## 17. 环节 1 完整评分维度表

| 维度 | 权重 | 类型 | 扣分/加分规则 |
|------|------|------|---------------|
| 需求覆盖完整度 | 15 | 强制 | 每遗漏 1 项核心需求扣 3 分 |
| 边界条件与异常标注 | 12 | 强制 | 每遗漏 1 类扣 2 分 |
| 模块拆分颗粒度 | 10 | 强制 | 每处不合理扣 2 分 |
| 技术选型与业务匹配 | 12 | 强制 | 不匹配扣 5 分 |
| 可测试性与验收标准 | 11 | 强制 | 缺失扣 4 分 |
| 技术风险预判 | 15 | 加分 | 有预判且给出方案加 5 分 |
| 架构可扩展 | 15 | 加分 | 符合最佳实践加 5 分 |
| 选型与团队栈一致 | 10 | 加分 | 一致加 3 分 |

---

## 18. 环节 3、4、5、6 的 YAML schema 示意

环节 3、4 与环节 2 同级结构：version、stage、link_stage、link_环节、weights、items、veto_items。环节 5、6 可类比扩展。详见 scoring/rules/default/test-scoring.yaml、bugfix-scoring.yaml。

---

## 19. Epic 综合报告六部分结构

1. 摘要：Epic 综合分、L1–L5 等级、是否达标、Epic 级 veto 检查结果。
2. 各 Story 得分明细：Story ID、综合分、环节得分、权重。
3. 环节短板：环节 1–6 最低分项及改进建议。
4. 一票否决检查结果：环节级 veto 触发记录、Epic 级 8 项条件检查。
5. L1–L5 等级与得分区间说明。
6. 改进建议：基于短板与 veto 的优化方向。

---

## 20. _bmad-output/config code-reviewer-score 与 scoring/rules 的关系

- **scoring/rules/*.yaml**：权威规则定义（完整 check_items、veto_items、权重）。
- **_bmad-output/config 的 code-reviewer-score**：项目级覆盖，可配置 weight、block_rules、code_style 等。
- **加载优先级**：优先加载 scoring/rules；若 _bmad-output/config 存在 code-reviewer-score，则覆盖对应字段；未配置字段使用 scoring/rules 默认。
- **约束**：_bmad-output/config 不得替代 scoring/rules 的完整定义。

---

## 21. Implementation Gaps 评审规则

**双轨评审**：
- **前置完整性评审**（gaps 阶段）：规范全覆盖、gap 定义清晰性、风险预判。得分计入环节 1 补充，占 gaps 阶段总分 40%。
- **后置闭合度评审**（implement、post_impl 阶段）：gaps 闭合率、无新增偏离。implement 占环节 2 的 30%；post_impl 占环节 6 的 50%。

**原子化检查项**：规范全覆盖、gap 定义清晰性、风险预判、gaps 闭合率、无新增偏离。

**gaps 一票否决项**：核心需求>20%未映射、gaps 与规范冲突、闭合率<80%、未定义 gap≥3。

---

## 22. 多次迭代阶梯式扣分规则

| 整改迭代次数 | 阶梯系数 |
|--------------|----------|
| 1 次通过 | 100% |
| 2 次通过 | 80% |
| 3 次通过 | 50% |
| ≥4 次 | 0% |

**问题严重等级差异化**：致命问题整改≥3 次→系数 0；严重问题整改≥2 次→降一档。**Story/Epic 累计**：单 Story 各阶段整改次数分别计入各阶段阶梯扣分。

---

## 23. schema 扩展字段说明

| 字段 | 说明 |
|------|------|
| iteration_count | 该 stage 整改迭代次数；0 表示一次通过 |
| iteration_records | 每次整改记录数组：{timestamp, result, severity, note} |
| first_pass | 是否一次通过；true 表示阶梯系数 100% |

iteration_count=0 对应 first_pass=true、阶梯系数 100%；iteration_count=n 对应 n 次整改后通过，阶梯系数由 iteration_tier[n+1] 决定。

---

## 24. Epic 级一票否决扩展条件（第 5–8 项）

| 条件 | 定义 | 默认阈值 |
|------|------|----------|
| 整改≥4 次未通过 | 任一 Story 某阶段整改迭代≥4 次仍未通过 | 1 个 |
| 一次通过率<50% | 一次通过即达标的 Story 数 / Epic 总 Story 数 | 50% |
| 整改≥3 次 Story≥2 | 整改迭代≥3 次才通过的 Story 数 | 2 个 |
| 致命问题整改≥3 次 | 含致命问题且整改≥3 次才通过的 Story 数 | 1 个 |

---

## 25. 题量表述

| 指标 | 数值 | 说明 |
|------|------|------|
| 当前已实现并验证题数 | 按项目实际 | 与 scoring 存储、评测运行记录一致 |
| 各环节目标题量 | 每环节 10+ | 需求拆解目标 |
| 全流程目标题池规模 | 50+ | 全流程题池目标 |
| 更新日期 | 2026-03-04 | 本文档修订日期 |

---

## 26. 版本与维护

- 权威文档随 scoring/rules 变更而更新。
- 每次规则版本发布须同步修订权威文档并注明修订日期。
- 当前规则版本号与 scoring/rules/*.yaml 中 version 字段一致：1.0。
