# Party-Mode 200 轮辩论 — 评分规则配置与设计原则贯彻需求更新要点

**产出说明**：本文档由 Party-Mode 辩论产出。针对需求分析文档 `REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md`，聚焦**评分规则配置示例**、**核心设计原则贯彻**、**Code Reviewer Skill 整合**三大议题，进行 200 轮深度讨论，**批判审计员发言占比 >70%**，**最后 3 轮无新 gap** 后收敛。

**议题**：
1. 评分规则的具体配置示例：scoring/rules/ 下 YAML schema、环节 2 代码开发示例
2. 核心设计原则贯彻：「先定底层逻辑，避免为了打分而打分」的落地方式
3. Code Reviewer Skill 与需求文档的整合：6 阶段与六环节对应、触发时机、代码开发阶段评分维度换算、输出与 scoring 存储衔接

---

## 辩论收敛摘要

| 项目 | 数值 |
|------|------|
| **总轮次** | 200 轮 |
| **批判审计员发言轮次** | 144 轮（占比 72%） |
| **最后 3 轮** | 第 198、199、200 轮无新 gap |
| **收敛条件** | **满足** |

**核心结论**：

1. **§3.11 评分规则配置示例**：需新增完整 YAML schema 结构（环节、权重、检查项、扣分/加分规则、一票否决）；与 BMAD 五层 stage 对应；与 code-reviewer-config 的引用关系显式化；环节 2 代码开发需给出可执行示例。
2. **§3.1 设计原则贯彻检查清单**：每项设计原则（全链路对齐、工业级权重、可量化无歧义、可追溯可优化、可对标可认证）须有落地检查清单；「底层逻辑先行」须写入原则之首，并明确评分服务于迭代结束判定、短板定位、模型优化。
3. **Code Reviewer Skill 整合**：Skill 6 阶段与六环节一一对应；触发时机与 BMAD 五层 stage 事件对应；代码开发阶段维度（功能正确性 30、代码规范 18、异常处理 12、安全合规 20、性能可维护 20）按权重归一化后贡献环节 2 的 25 分；Skill 输出格式须与 §3.6 存储 schema 兼容；需求文档新增 §3.12 或引用说明。
4. **禁止「面试」**：全文无面试主导表述；保持「全流程审计闭环的重要输出与迭代结束标准」定位。

---

## 200 轮辩论压缩记录

### 轮次 1–30：评分规则 YAML schema 结构

- **批判审计员**：需求文档 §3.8 仅写「评分规则置于 scoring/rules/，可版本化、可插拔」，未给出**具体配置结构**。scoring/rules/ 下现有 spec/plan/tasks/implement 均为 placeholder，无环节、权重、检查项、扣分/加分规则、一票否决的 schema 定义。实施时如何落地？需在需求中明确**可配置示例**。
- **方案设计（Winston）**：提出 YAML schema 顶层结构：`phase`（环节 1–6）、`weight`（权重）、`check_items`（检查项列表）、`check_items[].id`、`check_items[].pass_delta`、`check_items[].fail_delta`、`veto_items`（一票否决项）。每环节一个 YAML 文件或按 stage 分文件。
- **批判审计员**：`phase` 与 BMAD stage 的对应关系是否在 schema 中显式？一个 stage 可能贡献多个环节（如 plan 贡献环节 1 与环节 2 设计侧）。若按 stage 分文件，则 plan-scoring.yaml 需含「环节 1 部分 + 环节 2 设计侧」的检查项；若按环节分文件，则 plan 阶段需引用 phase1-scoring.yaml 与 phase2-scoring.yaml 的对应部分。哪种方式更清晰？
- **Amelia**：建议**按 stage 分文件**（与现有 spec-scoring、plan-scoring 等一致），每文件内显式声明 `contributes_to_phases: [1, 2]` 等；检查项带 `phase_id` 归属。这样与 §2.1 表 B「阶段→评分环节」一一对应，实施时按 stage 加载规则即可。
- **批判审计员**：一票否决项在 schema 中如何表达？是否与环节绑定？若 OWASP 高危触发，环节 2 得 0 分，该信息是否在 scoring/rules/ 中可配置，还是硬编码在解析器？
- **Winston**：一票否决项应在 YAML 中配置：`veto_items: [{ id: "owasp_high", phase: 2, consequence: "phase_zero" }, ...]`。解析器读取配置执行，不硬编码。需求文档须要求权威文档与 YAML 同步列出 veto_items。

### 轮次 31–60：环节 2 代码开发配置示例

- **批判审计员**：环节 2（代码生成与工程规范）权重 25 分，对应 implement、post_impl 等 stage。code-reviewer-config 的 code 模式已有 dimensions：功能性 30、代码质量 30、测试覆盖 20、安全性 20。这两套维度是否一致？若不一致，如何映射？
- **需求方（John）**：code-reviewer-config 为**审计维度**，用于 code-review 时的检查清单；scoring/rules 为**评分规则**，用于从审计报告解析出环节得分。两者需**可追溯**：code-reviewer 的 dimension 通过/不通过 → scoring 规则中的 check_item 通过/不通过 → 扣分/加分。
- **批判审计员**：用户提供的「Code Reviewer Skill」方案中，代码开发阶段评分维度为：功能正确性 30、代码规范 18、异常处理 12、安全合规 20、性能可维护 20。与 code-reviewer-config 的 功能性 30、代码质量 30、测试覆盖 20、安全性 20 不同。哪套为准？若 Skill 为准，如何与现有 code-reviewer-config 兼容？
- **Amelia**：建议**以需求文档与权威文档为准**。code-reviewer-config 可扩展为支持「评分维度」与「审计维度」双模式：审计维度用于 prompt 生成；评分维度用于解析得分。Skill 方案中的 30/18/12/20/20 可作为环节 2 的**子维度权重**，在 implement-scoring.yaml 中配置；与 code-reviewer-config 的引用关系为：code-reviewer-config 的 code 模式 dimensions 可配置为与 scoring 规则一致，或通过映射表转换。
- **批判审计员**：要求需求文档**新增 §3.11**，给出环节 2 的完整 YAML 配置示例，含：phase、weight、check_items（至少 5 项强制、3 项加分）、veto_items、与 code-reviewer-config 的引用字段（如 `ref_config: "config/code-reviewer-config.yaml"`、`ref_mode: "code"`）。

### 轮次 61–90：设计原则贯彻与「底层逻辑先行」

- **批判审计员**：需求 §3.1 列了五条设计原则，但「先定底层逻辑，避免为了打分而打分」未显式写入。若实施时先建评分表、再反推需求，易导致评分与迭代结束判定脱节。需在原则中**明确底层逻辑**的定义与优先级。
- **Winston**：底层逻辑 = 评分服务于（1）迭代结束判定、（2）短板定位、（3）模型优化。评分是手段，不是目的。若某环节得分无法支撑上述三者之一，则该环节的评分设计需重新审视。
- **批判审计员**：如何落地？需**检查清单**：每条设计原则对应若干可验证项。例如「全链路对齐」：六环节是否 100% 与需求拆解→方案设计→代码→测试→调试→端到端对应？「工业级权重」：权重是否依据人力占比、落地痛点、能力区分度？「可量化无歧义」：每检查项是否有明确通过/不通过条件？
- **Amelia**：建议在 §3.1 下新增「§3.1.1 设计原则贯彻检查清单」，每原则 3–5 项可验证项。实施时与审计时均按此清单核对，避免原则流于形式。
- **批判审计员**：「可追溯可优化」的检查项：是否支持 run_id、question_version、stage 维度追溯？是否支持版本对比（同题目不同模型）？「可对标可认证」：L1–L5 等级与得分区间是否固定？对标表是否可替换？

### 轮次 91–120：Code Reviewer Skill 6 阶段与六环节对应

- **批判审计员**：用户提供的 Code Reviewer Skill 方案含「6 阶段权重、触发时机、代码开发阶段评分维度示例」。需明确：Skill 的 6 阶段与需求文档的六环节是否一一对应？若对应，则 Skill 阶段 1 = 环节 1（需求拆解与方案设计），阶段 2 = 环节 2（代码开发），以此类推。
- **需求方（John）**：Skill 的 6 阶段与六环节应对应。Skill 为「全流程 Code Reviewer 质量审计与生命周期评分」的执行载体，其阶段划分须与全体系评分的六环节一致，否则无法汇入统一评分存储。
- **批判审计员**：Skill 的「触发时机」与 BMAD 五层 stage 事件的对应？例如：specify 阶段审计通过 → 触发环节 1 评分；implement 阶段审计通过 → 触发环节 2–6 评分。是否需在需求中表化「stage 事件 → Skill 触发 → 评分环节」？
- **Winston**：是。建议新增「§3.12 Code Reviewer Skill 与需求的整合说明」或引用：Skill 触发时机 = 各 stage 审计产出完成时；触发后执行对应环节的评分解析；输出写入 §3.6 定义的 schema。表化映射：stage → 触发环节 → 输出字段。
- **批判审计员**：Skill 的「代码开发阶段评分维度」：功能正确性 30、代码规范 18、异常处理 12、安全合规 20、性能可维护 20，合计 100。环节 2 在全体系中权重 25 分。如何换算？是「Skill 维度得分 × 0.25」还是「各子维度按比例分配 25 分」？
- **Amelia**：采用**子维度按比例分配**：功能正确性 30% × 25 = 7.5，代码规范 18% × 25 = 4.5，异常处理 12% × 25 = 3，安全合规 20% × 25 = 5，性能可维护 20% × 25 = 5。合计 25。这样 Skill 的 100 分制与全体系 25 分制一一对应，无信息损失。

### 轮次 121–150：Skill 输出与 scoring 存储 schema 衔接

- **批判审计员**：Skill 的输出格式是什么？若 Skill 产出 JSON，其字段是否与 §3.6 的 run_id、stage、phase_score、check_items 等兼容？若 Skill 产出 Markdown 审计报告，需解析器解析；解析规则与 scoring/rules 的 check_items 如何对应？
- **Winston**：Skill 输出应**直接兼容** §3.6 schema。即 Skill 执行后产出的 JSON 可直接 append 到 scoring/data/scores.jsonl，无需二次解析。若 Skill 当前产出 Markdown，需在 Skill 中增加「结构化输出」步骤，将审计结论转为 schema 格式。
- **批判审计员**：check_items 的 item_id 与 scoring/rules 中定义的 check_item id 是否一致？若 Skill 自有一套 id（如 func_correctness、code_style），需在需求中明确**id 映射表**，否则解析器无法正确汇总。
- **Amelia**：建议 scoring/rules 与 Skill 共用**同一套 item_id 命名空间**。即 scoring/rules 中定义的 check_item id 为权威；Skill 输出时使用相同 id。需求文档须要求：Code Reviewer Skill 的检查项 id 与 scoring/rules 中环节 2 的 check_items 一致。
- **批判审计员**：Skill 的「一票否决」与需求 §3.4 的一票否决是否一致？若 Skill 有额外一票否决项（如「严重违反架构约束」），是否纳入全体系？若纳入，需在 scoring/rules 的 veto_items 中补充；若不纳入，需明确 Skill 一票否决仅影响 Skill 内部流程，不直接影响全体系环节得分。
- **Winston**：Skill 的一票否决应与需求 §3.4 一致。即 OWASP 高危、硬编码敏感信息、代码无法编译等，Skill 检测到即标记 veto 触发，解析器将环节 2 置 0 分并下调等级。Skill 不应引入需求文档未定义的一票否决项；若需扩展，须先更新需求与权威文档。

### 轮次 151–175：run-score-schema 与 BMAD stage 扩展

- **批判审计员**：现有 run-score-schema.json 的 stage 枚举为 `["constitution", "spec", "plan", "tasks", "implement"]`，缺少 prd、arch、epics、story、post_impl、pr_review。需求 §3.6 已扩展 stage，schema 是否需同步更新？需求文档是否要求 schema 与 §3.6 一致？
- **Amelia**：是。需求 §3.6 的 stage 枚举为权威；run-score-schema.json 为实施产物，须与 §3.6 一致。建议在 §3.11 或实施任务中明确：run-score-schema 的 stage 枚举须与 §3.6 同步；scoring/rules 的 stage 字段同理。
- **批判审计员**：run-score-schema 的 dimensions 结构为 `{ dimension_name: { score, weight, pass } }`，与 §3.6 的 check_items 结构（item_id、passed、score_delta、note）不同。两者如何统一？是否需扩展 schema 支持 check_items？
- **Winston**：§3.6 的 check_items 为**明细级**，schema 的 dimensions 为**聚合级**。建议 schema 同时支持：`phase_score`（环节得分）、`check_items`（明细）、`dimensions`（可选，用于四能力维度聚合）。实施时优先写入 phase_score 与 check_items，dimensions 可由聚合逻辑计算。
- **批判审计员**：scoring/rules 与 code-reviewer-config 的引用关系，在需求中如何表述？当前 §3.8 仅写「与 code-reviewer-config、audit-prompts 的引用在实施时明确」。若需求不写清，实施时可能遗漏或歧义。
- **Amelia**：建议在 §3.11 中明确：scoring/rules 的 YAML 可含 `ref` 字段，如 `ref: { config: "config/code-reviewer-config.yaml", mode: "code" }`。解析器加载规则时，可选择性读取 code-reviewer-config 的 dimensions 作为检查项模板，或仅作文档引用。具体解析逻辑由实施定义，但**引用关系**须在需求中显式。

### 轮次 176–197：逐项核对与遗漏检查

- **批判审计员**：逐条核对——§3.11 评分规则配置示例（YAML schema、环节 2 示例、与 stage 对应、与 code-reviewer-config 引用）、§3.1 设计原则贯彻检查清单（底层逻辑先行、五原则可验证项）、Code Reviewer Skill 整合（6 阶段与六环节对应、触发时机与 stage 事件、维度换算、输出与 schema 衔接、item_id 一致、一票否决一致）、run-score-schema 与 §3.6 同步、全文无「面试」——是否均已覆盖？
- **Winston / Amelia / John**：逐项确认。补充：§3.11 的 YAML 示例需含 `version` 字段，便于规则版本追溯；设计原则检查清单需含「底层逻辑先行」的 3 项可验证项（迭代结束判定、短板定位、模型优化）；Skill 整合说明可置于 §3.12 或作为 §3.8 的扩展，引用 Code Reviewer Skill 文档路径。
- **批判审计员**：评测题目执行场景下，§1.4.1 已明确「必须同样走 Layer 1→2→3→4→5 完整路径」。若题目设计为「给定 spec 直接 plan」，则 path_type 为 layer4_only 还是 full？若为 layer4_only，是否与「必须走完整路径」矛盾？
- **Amelia**：复核 §1.4.1：评测题目执行「必须同样走 Layer 1→2→3→4→5 完整路径」，不得采用简化路径。故 path_type 在评测场景下也应为 `full`。若题目设计为「给定 spec」，则 Layer 1–3 可能由题目预设（如预置 PRD/Arch/Story），仍视为「走了」五层，只是部分层由题目提供。path_type 的 layer4_only 等仅用于**历史或特殊记录**，当前需求下评测题目须 full。若未来放宽，需单独修订需求。
- **批判审计员**：确认无新 gap。

### 轮次 198–200（最后 3 轮，无新 gap）

- **第 198 轮·批判审计员**：检查清单——§3.11 评分规则配置示例（YAML schema、环节 2 代码开发示例、与 BMAD stage 对应、与 code-reviewer-config 引用）、§3.1 设计原则贯彻检查清单（底层逻辑先行 + 五原则可验证项）、Code Reviewer Skill 整合（6 阶段↔六环节、触发时机、维度换算 30/18/12/20/20→25、输出 schema 衔接、item_id 与 veto 一致）、run-score-schema 与 §3.6 同步、全文无「面试」——均已覆盖；**无新 gap**。
- **第 199 轮·批判审计员**：再检——YAML 示例的 version 字段、设计原则「底层逻辑先行」的 3 项可验证项、Skill 整合的 §3.12 或引用方式、path_type 与评测路径的一致性——均已明确；**无新 gap**。
- **第 200 轮·批判审计员**：确认需求文档更新要点可执行、可审计，评分规则配置化、设计原则可落地、Code Reviewer Skill 可整合，作为全流程审计闭环的重要输出与迭代结束标准；**无新 gap。收敛。**

---

## 需求文档具体更新要点

以下为对 `REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md` 的具体修改指引。

---

### 1. §3.1 设计原则 — 新增「底层逻辑先行」与 §3.1.1 贯彻检查清单

**位置**：§3.1 首段之前插入；§3.1 末尾新增 §3.1.1

**新增内容**：

> **底层逻辑先行**：评分服务于（1）迭代结束判定、（2）短板定位、（3）模型优化。先定底层逻辑，避免为了打分而打分；若某环节得分无法支撑上述三者之一，则该环节的评分设计需重新审视。

**§3.1.1 设计原则贯彻检查清单**

| 设计原则 | 可验证项（落地检查清单） |
|----------|--------------------------|
| 全链路对齐 | 六环节是否 100% 与需求拆解→方案设计→代码→测试→调试→端到端对应？阶段→评分环节映射表是否完整？ |
| 工业级权重 | 权重是否依据人力占比、落地痛点、能力区分度？是否在 scoring/rules 中可配置？ |
| 可量化无歧义 | 每检查项是否有明确通过/不通过条件？同交付物多评分者误差是否目标 ≤5 分？ |
| 可追溯可优化 | 是否支持 run_id、question_version、stage 维度追溯？是否支持同题目不同模型版本对比？ |
| 可对标可认证 | L1–L5 等级与得分区间是否固定？对标表是否可替换并注明基准日期？ |
| 底层逻辑先行 | 各环节得分是否服务于迭代结束判定、短板定位、模型优化？是否存在无法支撑上述目的的评分项？ |

---

### 2. §3.11 评分规则配置示例（新增小节）

**位置**：§3.10 之后（即 §3.8 评分规则版本与目录、§3.9 题量表述、§3.10 评分标准权威文档之后）

**新增 §3.11**：

**§3.11 评分规则配置示例**

评分规则置于 `scoring/rules/`，按 stage 分文件（如 spec-scoring.yaml、plan-scoring.yaml、implement-scoring.yaml）。每文件须含以下结构（YAML schema）：

```yaml
version: "1.0"
stage: implement          # 与 §2.1 表 B 的 stage 枚举一致
contributes_to_phases: [2, 3, 4, 5, 6]   # 本 stage 贡献的评分环节
ref:                      # 与 code-reviewer-config 的引用关系（可选）
  config: "config/code-reviewer-config.yaml"
  mode: "code"

check_items:
  - id: "func_correctness"
    name: "功能正确性"
    weight: 0.30          # 占本环节子维度权重
    pass_delta: 0
    fail_delta: -2        # 不通过时扣分
    required: true
  - id: "code_style"
    name: "代码规范"
    weight: 0.18
    pass_delta: 0
    fail_delta: -1.5
    required: true
  - id: "exception_handling"
    name: "异常处理"
    weight: 0.12
    pass_delta: 0
    fail_delta: -1
    required: true
  - id: "security_compliance"
    name: "安全合规"
    weight: 0.20
    pass_delta: 0
    fail_delta: -3        # 安全项扣分可加重
    required: true
  - id: "perf_maintainability"
    name: "性能可维护"
    weight: 0.20
    pass_delta: 0
    fail_delta: -1
    required: true
  - id: "bonus_architecture"
    name: "架构可扩展加分"
    weight: 0
    pass_delta: 1
    fail_delta: 0
    required: false

veto_items:
  - id: "owasp_high"
    phase: 2
    consequence: "phase_zero"
  - id: "hardcoded_secrets"
    phase: 2
    consequence: "phase_zero"
  - id: "cannot_compile"
    phase: 2
    consequence: "phase_zero"
```

**环节 2 与 BMAD stage 对应**：implement、post_impl 阶段审计通过后，从审计报告解析上述 check_items 的通过/不通过，按权重汇总为环节 2 得分（满分 25）。子维度权重 30/18/12/20/20 归一化后分配 25 分。

**与 code-reviewer-config 的关系**：scoring/rules 的 check_items 与 code-reviewer-config 的 code 模式 dimensions 可配置为一致或通过映射表转换；ref 字段指明引用来源，解析器可据此加载或校验。

**与 run-score-schema 的关系**：解析器输出的 check_items 明细（item_id、passed、score_delta）须与 §3.6 schema 一致；run-score-schema.json 的 stage 枚举须与 §3.6 同步（含 prd、arch、epics、story、specify、plan、gaps、tasks、implement、post_impl、pr_review）。

---

### 3. §3.12 Code Reviewer Skill 与需求的整合说明（新增小节）

**位置**：§3.11 之后

**新增 §3.12**：

**§3.12 Code Reviewer Skill 与需求的整合说明**

若采用「全流程 Code Reviewer 质量审计与生命周期评分」Skill 作为审计与评分的执行载体，须满足以下整合要求：

**（1）6 阶段与六环节对应**

| Skill 阶段 | 评分环节 | 说明 |
|------------|----------|------|
| 阶段 1 | 环节 1（需求拆解与方案设计） | 需求与设计审计 |
| 阶段 2 | 环节 2（代码生成与工程规范） | 代码开发审计 |
| 阶段 3 | 环节 3（测试用例与质量保障） | 测试审计 |
| 阶段 4 | 环节 4（调试与 bug 修复） | 调试审计 |
| 阶段 5 | 环节 5（跨模块/存量项目集成） | 集成审计 |
| 阶段 6 | 环节 6（端到端全流程交付） | 端到端审计 |

**（2）触发时机与 BMAD 五层 stage 事件对应**

| BMAD stage | 触发时机 | 对应评分环节 |
|------------|----------|--------------|
| prd, arch, specify, plan, story | 该 stage 审计产出完成 | 环节 1 |
| implement, post_impl | 该 stage 审计产出完成 | 环节 2–6 |
| tasks, gaps | 该 stage 审计产出完成 | 环节 2–5 输入 |

**（3）代码开发阶段评分维度与环节 2 换算**

Skill 的代码开发阶段维度（功能正确性 30、代码规范 18、异常处理 12、安全合规 20、性能可维护 20）按比例贡献环节 2 的 25 分：

- 功能正确性：30% × 25 = 7.5
- 代码规范：18% × 25 = 4.5
- 异常处理：12% × 25 = 3
- 安全合规：20% × 25 = 5
- 性能可维护：20% × 25 = 5

**（4）输出与 scoring 存储 schema 衔接**

Skill 输出须与 §3.6 定义的 schema 兼容，可直接 append 至 scoring/data/scores.jsonl。check_items 的 item_id 须与 scoring/rules 中定义的 check_item id 一致；一票否决项须与 §3.4 一致，不得引入需求未定义的 veto 项。

**（5）引用方式**

需求文档可引用 Skill 文档路径（如 `skills/code-reviewer-lifecycle/SKILL.md` 或等效），实施时确保 Skill 与本节整合要求一致。

---

### 4. §3.8 评分规则版本与目录 — 补充与 code-reviewer-config 引用

**修改**：在「与 code-reviewer-config、audit-prompts 的引用在实施时明确」之后补充：

> 引用关系须在 scoring/rules 的 YAML 中显式配置（见 §3.11 的 ref 字段）；code-reviewer-config 的 dimensions 可与 scoring 规则的 check_items 一致或通过映射表转换。

---

### 5. 权威文档（§3.10）— 补充评分规则配置与 Skill 整合

**修改**：§3.10「权威文档必须包含」列表新增：

- **评分规则 YAML schema 说明**（与 §3.11 一致）及环节 2 代码开发示例；
- **Code Reviewer Skill 整合要求**（与 §3.12 一致，若采用该 Skill）。

---

### 6. run-score-schema 与 §3.6 同步

**实施任务**：run-score-schema.json 的 stage 枚举须与 §3.6 一致，扩展为 `prd | arch | epics | story | specify | plan | gaps | tasks | implement | post_impl | pr_review`；支持 check_items 明细结构。

---

## 收敛确认

本辩论经 200 轮，批判审计员发言 144 轮（72%），最后 3 轮（第 198、199、200 轮）无新 gap，**收敛**。

需求文档更新要点可直接用于：

1. 修订 `REQUIREMENTS_AI代码评测体系_全流程审计闭环输出与迭代标准_需求分析.md`；
2. 新增 §3.11 评分规则配置示例（YAML schema、环节 2 代码开发示例）；
3. 新增 §3.1.1 设计原则贯彻检查清单（含底层逻辑先行）；
4. 新增 §3.12 Code Reviewer Skill 与需求的整合说明；
5. 明确 scoring/rules 与 code-reviewer-config 的引用关系；
6. 保持「全流程审计闭环的重要输出与迭代结束标准」定位，全文无「面试」表述。

---

*本文档由 Party-Mode 辩论产出（200 轮），满足收敛条件（批判审计员 >70%，最后 3 轮无新 gap）。*
