# spec-E3-S2：eval-layer1-3-parser 技术规格

<!-- AUDIT: PASSED 2026-03-04 复审 -->

**Epic**：E3 feature-eval-lifecycle-skill  
**Story ID**：3.2  
**来源**：3-2-eval-layer1-3-parser.md、Architecture §2、§5、§6、§8、Story 3.1、Story 1.1、Story 3.3

---

## 1. 范围与目标

### 1.1 本 spec 覆盖

实现 Layer 1（prd、arch）、Layer 3（story）审计产出的同机解析，从 audit-prompts 对应报告与 Create Story 审计报告提取维度并映射到环节 1 检查项。解析产出符合 Story 1.1 存储 schema，供 Story 3.3 调用写入 scoring 存储。

### 1.2 功能边界

| 包含 | 不包含 |
|------|--------|
| Layer 1 prd 审计报告解析器 | 解析结果持久化写入（Story 3.3） |
| Layer 1 arch 审计报告解析器 | 全链路 Skill 编排与触发（Story 3.1） |
| Layer 3 story 审计报告解析器 | speckit-workflow、bmad-story-assistant 协同（Story 3.3） |
| 同机解析与输出结构（phase_score、check_items 等） | 一票否决、阶梯扣分（Story 4.1） |
| 报告路径约定落地（prd、arch、story 三类） | |
| 与 Story 3.3 的接口契约（解析入口） | |

---

## 2. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story §1 Scope 1.1 | Layer 1 prd/arch 报告解析，映射环节 1 | spec §3、§4 | ✅ |
| Story §1 Scope 1.1 | Layer 3 story 报告解析，映射环节 1 | spec §5 | ✅ |
| Story §1 Scope 1.1 | 同机解析、产出 Story 1.1 schema 结构 | spec §6 | ✅ |
| Story §1 Scope 1.1 | 解析器实现、路径约定落地 | spec §7 | ✅ |
| Story §2 AC-1 | prd/arch 报告 → 环节 1 评分结构、schema 兼容 | spec §3.1、§6 | ✅ |
| Story §2 AC-2 | story 报告 → 环节 1 评分结构 | spec §5.1、§6 | ✅ |
| Story §2 AC-3 | 路径约定文档化、与 3.1 一致 | spec §7 | ✅ |
| Story §2 AC-4 | 输出含 phase_score、phase_weight、check_items | spec §6 | ✅ |
| Story §3 PRD 追溯 | REQ-2.1~2.5 表 A/B 阶段与审计产出对应 | spec §3、§4、§5、§7 | ✅ |
| Story §3 PRD 追溯 | REQ-3.12 解析产出与 scoring schema 衔接 | spec §6 | ✅ |
| Story §3 PRD 追溯 | REQ-3.13 从 audit-prompts 对应报告提取 | spec §3、§4、§5 | ✅ |
| Story §3 PRD 追溯 | REQ-3.15、3.16、3.17 解析规则与输出格式 | spec §6、§8 | ✅ |
| Architecture §2.1 | 解析规则从 audit-prompts 对应报告提取 | spec §3、§4、§5 | ✅ |
| Architecture §5 | 审计产出→评分环节映射 | spec §3、§4、§5 | ✅ |
| Architecture §6 | Layer 1–3 同机解析、prd/arch/story 路径 | spec §3、§4、§5、§7 | ✅ |
| Architecture §8.1、§8.2 | run_id、stage、phase_score、check_items 结构 | spec §6 | ✅ |

---

## 3. Layer 1 prd 审计报告解析（T1）

### 3.1 输入格式与解析规则

| 项 | 说明 |
|----|------|
| 报告来源 | PRD 审计报告，对应 audit-prompts-prd.md 结构 |
| 路径约定 | config/eval-lifecycle-report-paths.yaml 中 prd.report_path；具体路径由 code-reviewer-config 或 bmad 工作流产出，解析器从 config 读取约定；若 report_path 为占位，则实现时从 bmad 约定或 code-reviewer 输出目录读取 |
| 报告结构 | 总体评级 A/B/C/D；维度评分（需求完整性 40、可测试性 30、一致性 30）；问题清单 |
| 映射目标 | 环节 1（需求拆解与方案设计）；phase_score 由等级换算 |
| 等级→数值 | A=100、B=80、C=60、D=40（固定映射表，与 audit-prompts 输出一致） |
| check_items | 从问题清单或检查项提取 item_id、passed、score_delta、note |

### 3.2 提取逻辑

- 解析「总体评级」A/B/C/D → phase_score（A=100、B=80、C=60、D=40）；phase_score 为 0–100 原始分，phase_weight 从 config/stage-mapping.yaml 表 B 获取
- 解析「问题清单」→ 映射为 check_items（item_id、passed、score_delta、note）
- item_id 引用与 scoring/rules、code-reviewer-config 一致

### 3.3 产出结构

符合 §6 定义的 RunScore 或等效中间结构。

### 3.4 边界条件

- **报告文件不存在**：抛出明确错误（如 `ReportFileNotFoundError`）或返回错误结构，不得静默通过
- **报告格式异常**（无法解析为预期结构）：抛出解析错误，调用方可选择重试或记录为不通过

---

## 4. Layer 1 arch 审计报告解析（T2）

### 4.1 输入格式与解析规则

| 项 | 说明 |
|----|------|
| 报告来源 | Architecture 审计报告，对应 audit-prompts-arch.md 结构 |
| 路径约定 | config/eval-lifecycle-report-paths.yaml 中 arch.report_path；与 prd 类似，由 code-reviewer arch 模式产出；解析器从 config 读取 |
| 报告结构 | 总体评级 A/B/C/D；维度评分（技术可行性 30、扩展性 25、安全性 25、成本效益 20）；Tradeoff/ADR |
| 映射目标 | 环节 1 补充、环节 2 设计侧 |
| 等级→数值 | A=100、B=80、C=60、D=40（与 prd 一致） |
| check_items | 从维度与问题清单提取 item_id、passed、score_delta、note |

### 4.2 提取逻辑

- 解析「总体评级」A/B/C/D → phase_score（A=100、B=80、C=60、D=40）
- 解析「Tradeoff分析审计」→ 补充 check_items
- 与 prd 解析器共用输出 schema

### 4.3 边界条件

- 同 §3.4：报告不存在或格式异常时抛出错误，不得静默通过

---

## 5. Layer 3 story 审计报告解析（T3）

### 5.1 输入格式与路径约定

| 项 | 说明 |
|----|------|
| 报告路径 | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md` |
| 文件名格式 | `AUDIT_Story_{epic}-{story}.md`，示例 `AUDIT_Story_3-1.md` |
| 对应 | config/eval-lifecycle-report-paths.yaml、Story 3.1 约定 |
| 报告结构 | Create Story 审计报告，含维度评分、检查项通过/不通过 |
| 映射目标 | 环节 1 补充 |

### 5.2 提取逻辑

- 解析 Create Story 审计报告（第一遍审计结论）
- **格式判定**：若 Create Story 审计报告结构包含「总体评级 A/B/C/D」及「维度/检查项清单」，则复用 prd/arch 的等级→phase_score 与 checklist→check_items 映射逻辑；否则按 Create Story 实际输出格式单独实现解析
- 提取可评分维度，映射到环节 1 检查项

### 5.3 边界条件

- 同 §3.4：报告不存在或格式异常时抛出错误，不得静默通过

---

## 6. 解析输出结构与 schema 兼容（T4、AC-4）

### 6.1 必含字段（Story 1.1、Architecture §8.1、§8.2）

| 字段 | 类型 | 说明 |
|------|------|------|
| run_id | string | 单次运行唯一标识 |
| scenario | enum | `real_dev` \| `eval_question` |
| stage | string | prd \| arch \| story |
| phase_score | number | 该阶段对应环节得分（0–100 原始分） |
| phase_weight | number | 环节权重，0–1，从 config/stage-mapping.yaml 表 B 获取 |
| check_items | array | 见 §6.2 |
| timestamp | string | ISO 8601 |
| iteration_count | number | 0 = first pass；Layer 1–3 首轮审计无迭代时固定为 0 |
| iteration_records | array | IterationRecord 数组；首轮审计无迭代时为空数组 []；子结构：timestamp、result（pass\|fail）、severity（fatal\|serious\|normal\|minor）、note（可选），与 run-score-schema.json definitions 一致 |
| first_pass | boolean | true = 100% tier coefficient；首轮审计为 true |

**可选字段**（解析器可省略或填默认值，满足 run-score-schema 即可）：
| 字段 | 类型 | 说明 |
|------|------|------|
| path_type | string | 可选；两场景均为 full，可省略或填 "full" |
| model_version | string | 可选；解析器不负责填充时可省略 |
| question_version | string | 可选；scenario=eval_question 时由调用方或 3.3 填充 |

### 6.2 check_items 结构（Architecture §8.2）

| 字段 | 类型 | 说明 |
|------|------|------|
| item_id | string | 与 scoring/rules、code-reviewer-config 引用一致 |
| passed | boolean | 检查项通过/不通过 |
| score_delta | number | 扣分或加分 |
| note | string | 可选说明 |

### 6.3 与 Story 1.2 写入接口兼容

- 产出可直接传入 Story 1.2 写入接口，无需二次转换
- 满足 scoring/schema/run-score-schema.json 约束

---

## 7. 报告路径约定文档化（T4.2、AC-3）

### 7.1 支持的报告路径列表

| 类型 | 路径或约定 | 来源 |
|------|------------|------|
| prd | config/eval-lifecycle-report-paths.yaml 中 prd.report_path；具体路径由 code-reviewer prd 模式或 bmad 工作流约定，实现时从 config 读取；若 config 仅含占位，则从 bmad 约定或 code-reviewer 输出目录读取 | Story 3.1、config |
| arch | 同上，arch.report_path | Story 3.1、config |
| story | `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}/AUDIT_Story_{epic}-{story}.md`（具体路径，config 已约定） | Story 3.1、config |

### 7.2 实现方式

- 代码中常量表或从 config/eval-lifecycle-report-paths.yaml 读取
- 与 Story 3.1、config/stage-mapping.yaml 一致

---

## 8. 与 Story 3.3 的接口契约（T5）

### 8.1 解析入口

- **输入**：报告路径、run_id、scenario、stage
- **输出**：符合 §6 的评分记录或中间结构
- **形式**：函数或脚本，可被 3.3 调用

### 8.2 输出使用

- 输出可直接供 Story 1.2 写入接口使用，无需二次转换

---

## 9. 技术栈与目录

| 项 | 说明 |
|----|------|
| 技术栈 | TypeScript/Node 或 Python，与项目 scripts 一致 |
| 解析器位置 | scoring/ 或 scripts/ |
| 配置读取 | config/stage-mapping.yaml、config/eval-lifecycle-report-paths.yaml |
| 测试 | 单元测试：prd、arch、story 三类样本；验收脚本验证路径与解析输出 |

---

## 10. 验收标准追溯

| AC | spec 对应 | 验证方式 |
|----|-----------|----------|
| AC-1 | §3、§4、§6 | 单元测试：注入样本 prd/arch 报告，断言输出 schema 兼容 |
| AC-2 | §5、§6 | 单元测试或验收脚本：给定 story 报告路径，校验解析结果 |
| AC-3 | §7 | 文档或常量表；测试覆盖约定路径 |
| AC-4 | §6 | Schema 校验或类型断言 |
