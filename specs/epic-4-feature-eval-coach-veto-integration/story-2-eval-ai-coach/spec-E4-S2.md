<!-- AUDIT: PASSED by code-reviewer -->

# Spec E4-S2：eval-ai-coach

*Story 4.2 技术规格*
*Epic E4 feature-eval-coach-veto-integration*

---

## 1. 概述

本 spec 将 Story 4-2（eval-ai-coach）的需求转化为可执行的技术规格，涵盖：AI 代码教练定位与职责、人格定义、技能配置、工作流、输出格式、一票否决权、禁止表述校验及与 Story 4.1 veto 模块的衔接。

---

## 2. 功能范围

### 2.1 AI 代码教练定位与职责

**定位**（与 REQUIREMENTS §3.14 一致）：用资深工程师视角，还原真实工业级开发全流程，精准定位 AI 代码模型的能力短板，设计可落地的评测/优化方案。作为「现有全流程各审计闭环的重要输出和迭代结束标准」的**承载者**。

**职责边界**：

| 职责 | 执行方 | 说明 |
|------|--------|------|
| 评审 | 全流程 Code Reviewer / 全链路 Skill | 各 stage 审计、检查项通过/不通过、得分写入 |
| 教练 | AI 代码教练 | 解读评分、定位短板、给出改进方向 |
| 优化方案设计 | AI 代码教练 | 设计题池补充、权重调整、检查项细化等可落地方案（建议型，非直接执行） |

**与全流程 Code Reviewer 的关系**：非替代、非并列。教练**消费** Reviewer（及全链路 Skill）的产出，做汇总、解读与优化方案设计；不重复执行审计。

| 需求要点 | 技术规格 |
|----------|----------|
| 承载者角色 | 教练输出为全流程迭代结束的判定依据之一 |
| 消费 Reviewer 产出 | 输入来自 scoring 存储（run_id 对应数据）；不调用 Reviewer 执行新审计 |
| 精准定位短板 | 输出 weak_areas、recommendations；基于既有 scoring 数据解读 |

### 2.2 人格定义（参照 BMAD agent 格式）

AI 教练的人格定义须与 BMAD agent 的 persona 结构一致（参见 `_bmad/core/agents/adversarial-reviewer.md`、`_bmad/bmm/agents/architect.md`），包含 role、identity、communication_style、principles 四维，便于与批判审计员等角色统一管理及后续 Party Mode 集成。

| 维度 | 要求 | 说明 |
|------|------|------|
| **role** | AI Code Coach + Iteration Gate Keeper | 与批判审计员（Adversarial Reviewer + Gap Discovery Specialist）格式一致 |
| **identity** | 资深工程师视角，还原真实工业级开发全流程；精准定位 AI 代码模型的能力短板，设计可落地的评测/优化方案；消费 Reviewer 产出，不重复执行审计 | 承载者角色、工业级标准、可落地导向 |
| **communication_style** | 精准、可执行、无模糊表述；使用「短板」「建议」「迭代未达标」等明确术语；不软化结论 | 对应 spec 原「输出风格」 |
| **principles** | 可落地导向；不替代 Reviewer；共识须经 veto 与阶梯系数验证；禁止「面试」主导表述 | 可落地导向、与 Reviewer 关系、veto 衔接 |

**参考**：`_bmad/core/agents/adversarial-reviewer.md`（Persona 节）、`_bmad/bmm/agents/architect.md`（`<persona>` 块）。

### 2.3 技能配置

| 配置项 | 技术规格 |
|--------|----------|
| 必引 Skill | 全链路 Code Reviewer Skill（bmad-code-reviewer-lifecycle）；优先级最高 |
| 可选 Skill | speckit-workflow、bmad-story-assistant（post_impl 阶段按配置引用） |
| fallback 判定 | 全链路 Skill 不可用 = bmad-code-reviewer-lifecycle 的 SKILL.md 路径不存在或该 Skill 运行时加载失败（如模块导入异常）；此时降级为「仅解读既有 scoring 存储中的已有数据」，不执行新审计 |
| post_impl 触发 | 配置键 `config/coach-trigger.yaml`（或 `scoring/coach/config.yaml`）中 `auto_trigger_post_impl: boolean`；默认 false，不强制自动触发 |

**实现约定**：教练 Skill 或配置定义于 scoring/coach/ 或 _bmad/skills/bmad-ai-coach/；配置项存 config/coach-trigger.yaml 或 scoring/coach/config.yaml。

### 2.4 工作流

**与 BMAD 五层、六环节、迭代结束标准的衔接**：教练在各 stage 审计完成且得分写入后可被触发。

| 要素 | 技术规格 |
|------|----------|
| 输入 | scoring 存储中 run_id 对应数据；schema 含 phase_score、check_items、iteration_count、iteration_records、first_pass |
| 输入异常 | run_id 不存在或数据不完整（如缺 phase_score、check_items）：coachDiagnose 抛出明确错误（如 `RunNotFoundError`）或返回 `{ error: 'run_not_found' }`；实现时二选一并在文档中约定 |
| 辅助判定 | 调用 Story 4.1 的 applyTierAndVeto、evaluateEpicVeto 辅助环节级 veto 与 Epic 级 veto 判定 |
| 输出 | 综合诊断报告（含 summary、phase_scores、weak_areas、recommendations、iteration_passed） |
| 触发时机 | 手动触发（用户请求「对本轮迭代做教练诊断」）或阶段式触发（post_impl 完成后按配置决定是否自动触发）；默认不强制 |

### 2.5 输出格式

| 字段 | 类型 | 说明 |
|------|------|------|
| summary | string | 本轮迭代综合摘要 |
| phase_scores | object | 环节得分汇总 |
| weak_areas | string[] | 短板区域列表 |
| recommendations | string[] | 改进建议列表 |
| iteration_passed | boolean | 迭代是否达标；false 时行使一票否决 |

**格式支持**：JSON 与 Markdown。与 §3.6 schema 兼容 = 字段名与 REQUIREMENTS §3.6 数据保存 schema 一致（summary、phase_scores、weak_areas、recommendations、iteration_passed）；引用路径：REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md §3.6。

### 2.6 一票否决权

| 规则 | 技术规格 |
|------|----------|
| 触发条件 | 教练输出 `iteration_passed: false` |
| 后果 | 全流程迭代不达标；须按教练建议改进后重新触发教练诊断 |
| 依据 | VETO_AND_ITERATION_RULES.md §3.4.2 |

**判定逻辑**（显式定义）：`iteration_passed = !epicVeto.triggered && 所有 storyRecords 经 applyTierAndVeto 后的 veto_triggered 均 false && 各环节 phase_score 经阶梯后不为 0（或按 VETO_AND_ITERATION_RULES 约定）；任一条件不满足则 iteration_passed = false`。具体实现见 plan 与 veto 模块文档。

### 2.7 禁止表述

**禁止词表**（与 Story §6.5、REQUIREMENTS §3.14 一致）：

- **主导表述禁止**：面试、面试官、应聘、候选人（教练产出不得以「面试」为主导；仅可保留「成果可用于对外能力说明等场景」等中性表述）。
- **模糊表述禁止**：可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债（教练产出不得使用上述词规避明确承诺）。

| 需求要点 | 技术规格 |
|----------|----------|
| 禁止词校验 | 教练产出（summary、recommendations 等）全文检索禁止词；命中主导表述则**报错**并拒绝输出；命中模糊表述则**警告**并记录 |
| 扩展规则 | 禁止词表存配置文件（如 scoring/coach/forbidden-words.yaml），支持追加；默认列表为上述两项合并 |

### 2.8 Manifest 入驻与路由隔离（新增）

基于 `AI_COACH_ROLE_ANALYSIS.md` 的结论，AI Coach 需以“防御性隔离”模式入驻 BMAD agent 体系，避免与运行时执行型角色混淆。

| 需求要点 | 技术规格 |
|----------|----------|
| Task 1：更新 Manifest | 更新 `_bmad/_config/agent-manifest.csv`，新增 `ai-coach` 条目（建议 `module=scoring`），并明确 `capabilities` 仅限 scoring 数据分析、短板诊断、改进建议；不得包含 code review 或 audit 执行能力 |
| Task 2：创建 Agent 定义文件 | 新增 `_bmad/scoring/agents/ai-coach.md`，将 `scoring/coach/AI_COACH_DEFINITION.md` 的约束转化为 agent persona（含 role、identity、communication_style、principles） |
| Task 3：诊断工作流读取 Persona | `scoring/coach/diagnose.ts` 应优先从 manifest/`ai-coach.md` 加载 persona，而非在代码中硬编码完整提示词 |
| Task 4：路由防御机制 | 在 `_bmad/core/agents/bmad-master.md` 或全局 agent 路由中增加隔离规则：`scoring` module 的 agent 不进入常规 `/bmad ask` 可见列表，仅可在显式指定或 `coachDiagnose` 专属链路中加载 |
| 安全防线 | 若未提供 `run_id` 或对应 scoring 数据，AI Coach 必须拒绝分析，不得进行自由推断 |

---

## 3. 接口与依赖

### 3.1 从 Story 4.1 接收

- `applyTierAndVeto(record, options?)` → { phase_score, veto_triggered, tier_coefficient }
- `evaluateEpicVeto(input, options?)` → { triggered, triggeredConditions }

**源路径**：`scoring/veto/index.ts`；详见 scoring/veto/README.md。

### 3.2 从 Story 3.x 接收

- scoring 存储：RunScoreRecord、CheckItem、IterationRecord
- 数据加载：scoring/data/、scoring/writer；run_id 对应记录

### 3.3 从全链路 Skill 引用

- `%USERPROFILE%\.cursor\skills\bmad-code-reviewer-lifecycle\SKILL.md`（全局 skill）；fallback 时仅读既有 scoring 数据。

### 3.4 核心入口

- `coachDiagnose(runId: string, options?: CoachDiagnoseOptions): CoachDiagnosisReport`
- 输入 run_id，从 scoring 存储加载数据；调用 applyTierAndVeto、evaluateEpicVeto；输出符合 schema 的综合诊断报告。

---

## 4. 非功能需求

### 4.1 本 Story 不包含

- 一票否决项与环节映射、多次迭代阶梯式扣分、Epic 级 veto 判定逻辑：Story 4.1 实现；本 Story 调用
- 全链路 Skill 定义、Layer1-3 解析、scoring 写入：Story 3.1、3.2、3.3 实现
- 场景区分、BMAD 五层集成、数据污染防护：Story 4.3 实现
- **权威文档 SCORING_CRITERIA_AUTHORITATIVE.md 产出**：由 Story 2.2 实现；本 Story 不产出

### 4.2 测试与验收约束（引用 Story §6.3）

- 单元测试覆盖：coachDiagnose 输出格式、iteration_passed 判定、fallback 路径、禁止词校验
- 集成测试：给定完整 scoring 数据，断言教练输出与 4.1 veto 模块一致
- 与 scoring/veto 无循环依赖

### 4.3 与 Story 4.1 的衔接

- 教练调用 applyTierAndVeto(record) 获取 phase_score、veto_triggered、tier_coefficient
- 教练调用 evaluateEpicVeto(input) 获取 Epic 8 项判定结果
- 结合上述结果与环节得分，输出 iteration_passed

---

## 5. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story 4.2 §1 Scope 1.1(1) | AI 代码教练定位与职责 | spec §2.1 | ✅ |
| Story 4.2 §1 Scope 1.1(2) | 人格定义 | spec §2.2 | ✅ |
| Story 4.2 §1 Scope 1.1(3) | 技能配置、fallback | spec §2.3 | ✅ |
| Story 4.2 §1 Scope 1.1(4) | 工作流、输入输出、触发时机 | spec §2.4 | ✅ |
| Story 4.2 §1 Scope 1.1(5) | 输出格式 | spec §2.5 | ✅ |
| Story 4.2 §1 Scope 1.1(6) | 一票否决权 | spec §2.6 | ✅ |
| Story 4.2 §1 Scope 1.1(7) | 禁止表述 | spec §2.7 | ✅ |
| REQUIREMENTS §3.14 | 定位、职责、人格、技能、工作流、输出、禁止表述 | spec §2.1–§2.7 | ✅ |
| VETO_AND_ITERATION_RULES §3.4.2 | AI 教练一票否决权 | spec §2.6 | ✅ |
| Story 4.2 §5 Architecture | 数据输入、规则调用、全链路 Skill、输出 | spec §3、§4 | ✅ |
| AI_COACH_ROLE_ANALYSIS §4 | Manifest 入驻、Persona 文件、工作流 Persona 来源、路由防御机制 | spec §2.8 | ✅ |

---

*本 spec 实现 AI 代码教练技术规格，与 Story 3.3 的 scoring 写入及 4.1 的一票否决规则衔接，满足 REQUIREMENTS §3.14。*
