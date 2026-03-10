# TASKS：审计报告格式与评分 Pipeline 衔接改进

**产出日期**：2026-03-06  
**议题**：审计报告格式与评分 pipeline 衔接改进  
**Party-Mode**：100 轮多角色辩论，批判性审计员发言 >70%，收敛后产出

---

## Party-Mode 执行摘要

- **轮次**：100 轮
- **批判性审计员发言**：71 轮（>70%）
- **参与角色**：BMad Master、Winston 架构师、Amelia 开发、John 产品经理、Mary 分析师、批判性审计员、Quinn 测试、Paige 技术写作
- **收敛条件**：第 98–100 轮无新 gap；批判性审计员完成终审陈述（§6）
- **关键辩论点**：根因层级、方案 A/B/C/D 可行性、路径命名规范、历史报告迁移、维度分映射规则
- **共识结论**：采用方案 B（报告模板统一），辅以路径命名规范与 deferred gaps

---

## §1 背景与问题描述

### 1.1 背景

当前 speckit-workflow 的 tasks 审计支持两种报告风格：

1. **标准格式**：含 `总体评级: A/B/C/D` 与 `维度评分: 维度名: XX/100`，可被 `parseAndWriteScore` 解析并写入 scoring 存储，仪表盘正常显示评级。
2. **逐条对照格式**：表格 + ✅ 式逐条验证，结论为「完全覆盖、验证通过」，但**不含** `总体评级` 与 `维度名: XX/100`，导致 parseAndWriteScore 无法解析，仪表盘不显示评级。

### 1.2 现象

| 报告风格   | 示例路径                                                                 | 解析结果   | 仪表盘显示     |
|------------|---------------------------------------------------------------------------|------------|----------------|
| 标准格式   | `specs/epic-6-eval-ux-coach-and-query/story-3-scoring-query-layer/AUDIT_spec-E6-S3.md` | 成功解析   | 正常显示评级   |
| 逐条对照   | `specs/epic-8/story-8-1-question-bank-structure-manifest/AUDIT_TASKS_E8_S1_逐条对照_2026-03-06.md` | 解析失败   | 不显示评级     |

### 1.3 技术依据

- **extractOverallGrade**（`scoring/parsers/audit-generic.ts`）：正则 `/总体评级:\s*([ABCD])/`，无匹配则返回 `null`。
- **parseDimensionScores**（`scoring/parsers/dimension-parser.ts`）：正则 `维度名: XX/100`，无匹配则返回空数组。
- **parseGenericReport**：无 `总体评级` 时，若未配置 `SCORING_LLM_API_KEY`，抛出 `ParseError`。
- **仪表盘**（`docs/BMAD/仪表盘健康度说明与数据分析指南.md` §3.4）：`dimension_scores` 为空时显示「无数据」或 fallback 维度名。

---

## §2 根因分析

### 2.1 直接根因

1. **解析器强耦合单一格式**：`extractOverallGrade`、`parseDimensionScores` 仅识别「总体评级 + 维度评分」一种结构，未覆盖「逐条对照 + 结论」型报告。
2. **审计 prompt 未强制统一输出**：`audit-prompts`（含 critical-auditor-appendix）允许两种风格并存，未要求逐条对照报告追加 `总体评级` / `维度评分` 块。
3. **路径与命名不一致**：`config/eval-lifecycle-report-paths.yaml` 约定 tasks 报告为 `AUDIT_tasks-E{epic}-S{story}.md`，而逐条对照示例使用 `AUDIT_TASKS_E8_S1_逐条对照_*.md`，存在命名和路径偏差。

### 2.2 影响范围

| 影响项           | 说明                                                                 |
|------------------|----------------------------------------------------------------------|
| 解析失败         | 逐条对照报告在无 LLM 时直接抛错，阻断 scoring 写入                    |
| 仪表盘缺数       | 即便 LLM 补全 grade，dimension_scores 仍为空，四维雷达图无数据        |
| 全链路 Skill     | bmad-code-reviewer-lifecycle 等依赖 parseAndWriteScore 的流程受影响   |
| eval_question    | 题目为审计报告格式时，若使用逐条对照，同样无法解析                    |

### 2.3 根因层级

```
表层：仪表盘不显示评级
  ↑
中层：parseAndWriteScore 解析失败或 dimension_scores 为空
  ↑
深层：解析器仅支持一种报告格式，审计 prompt 未统一输出结构
```

---

## §3 方案（含可选方案对比与选定方案）

### 3.1 可选方案

| 方案 | 描述 | 优点 | 缺点 | 可行性 |
|------|------|------|------|--------|
| **A. Parser 扩展** | 在 extractOverallGrade、parseDimensionScores 中增加对「完全覆盖、验证通过」及表格结构的识别，推断 grade 与维度分 | 零侵入审计流程；逐条对照报告无需改 | 推断逻辑脆弱；表格结构多变；易产生误解析 | 中 |
| **B. 报告模板统一** | 要求所有 tasks 审计报告（含逐条对照）在尾部追加固定块：`总体评级`、`维度评分` | 解析器不改；实现简单；可验证性强 | 审计 prompt 须强制；逐条对照 Agent 需输出双格式 | 高 |
| **C. 混合：可选追加块** | 解析器优先解析标准块；若无，再尝试从逐条对照结论推断；audit-prompts 建议（非强制）追加块 | 兼容两种风格；逐步迁移 | 仍依赖推断或追加；逻辑复杂度增加 | 中 |
| **D. LLM-only** | 无标准格式时完全依赖 SCORING_LLM_API_KEY；文档说明逐条对照需 LLM | 不改解析器 | 增加外部依赖；无 LLM 时完全不可用；成本高 | 低 |

### 3.2 选定方案：B（报告模板统一）+ 路径命名规范

**理由**（经 100 轮辩论收敛）：

1. **可验证性**：固定块格式与现有解析器完全兼容，无需推断逻辑，降低误解析风险。
2. **可维护性**：审计 prompt 明确要求输出块，审计员与 Agent 行为可预期。
3. **渐进迁移**：可先对 tasks 阶段强制，spec/plan 可后续统一。
4. **批判审计员终审**：有条件同意；需在任务列表中明确「路径命名规范」与「兼容旧报告」的处理策略（deferred gap 见 §6）。

### 3.3 方案细节

1. **audit-prompts**（含 tasks 相关附录）新增：无论采用标准格式或逐条对照格式，报告**必须**在结尾包含以下可解析块：

   ```markdown
   ## 可解析评分块（供 parseAndWriteScore）

   总体评级: [A|B|C|D]

   维度评分:
   - 需求完整性: XX/100
   - 可测试性: XX/100
   - 一致性: XX/100
   - 可追溯性: XX/100
   ```

2. **路径与命名**：`config/eval-lifecycle-report-paths.yaml` 已约定 `AUDIT_tasks-E{epic}-S{story}.md`；逐条对照报告应：
   - 主路径使用约定命名，或
   - 在约定路径产出，文件名不含「逐条对照」等后缀；若有历史命名，需在文档中说明兼容策略。

3. **解析器**：保持不变，继续依赖 `总体评级`、`维度评分` 正则。

---

## §4 任务列表

| 编号 | 描述 | 验收标准 | 依赖 |
|------|------|----------|------|
| **T1** | 更新 audit-prompts tasks 相关章节，强制要求所有 tasks 审计报告在结尾包含「可解析评分块」（总体评级 + 维度评分）；并给出维度分与逐条对照结论的映射建议（如完全覆盖→A/90+；部分覆盖→B/80+） | 1) audit-prompts §4 或 tasks 附录中明确写出该要求；2) 引用本 TASKS 文档或 scoring 解析约定；3) 含维度分与逐条对照结论映射建议 | — |
| **T2** | 更新 audit-prompts-critical-auditor-appendix（若存在）或等效「逐条对照」指南，要求逐条对照报告在结论后追加可解析评分块，并给出维度分映射建议 | 1) 文档中写明「逐条对照格式报告须在 §5 结论后追加可解析评分块」；2) 给出示例格式；3) 含维度分与逐条对照结论的映射建议（完全覆盖→A/90+；部分覆盖→B/80+） | T1 |
| **T3** | 在 docs/BMAD 或 scoring 文档中新增「审计报告格式与解析约定」，说明标准格式与逐条对照格式均须包含可解析块 | 1) 文档存在且可被 bmad 流程引用；2) 含 extractOverallGrade、parseDimensionScores 的输入要求说明 | — |
| **T4** | 校验 config/eval-lifecycle-report-paths.yaml 中 speckit_report_paths.tasks 与现有产出路径一致性，必要时补充说明或调整 | 1) 配置与文档一致；2) 明确写出：约定路径为 AUDIT_tasks-E{epic}-S{story}.md；3) 若有历史命名变体（如「逐条对照」后缀），在文档中说明兼容策略（是否兼容、如何映射到约定路径或 parseAndWriteScore 的 --reportPath） | — |
| **T5** | 为 parseAndWriteScore 或 orchestrator 增加集成测试：使用 stage=tasks 的、包含可解析块的「逐条对照风格」报告作为输入（fixture 结构为：表格 + 结论 + 可解析块），断言解析成功且 dimension_scores 非空 | 1) 测试文件存在；2) fixture 使用 stage=tasks，结构为表格+结论+可解析块；3) 断言 phase_score、dimension_scores 符合预期 | — |
| **T6** | 更新 Story 8.1 的 AUDIT_TASKS_E8_S1_逐条对照 报告（或新建符合约定的报告），在结论后追加可解析评分块，作为向后兼容示例 | 1) 报告包含总体评级、维度评分块；2) 运行 parseAndWriteScore 成功；3) 仪表盘可显示 | T1 |
| **T7** | 在 bmad-code-reviewer-lifecycle Skill（或等效全链路文档）中注明：tasks 审计通过后调用 parseAndWriteScore 前，须确认报告包含可解析块 | 1) Skill 或文档中以独立条款或 checklist 形式写明该前置条件；2) 可选：增加运行时校验（报告不含块时 warning 或 skip） | T3 |

---

## §5 验收标准

1. **格式统一**：所有 tasks 审计报告（不论标准或逐条对照）均包含「可解析评分块」。
2. **解析通过**：对符合新格式的逐条对照报告执行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <path> --stage tasks` 成功，无 ParseError。
3. **仪表盘显示**：解析后的 record 写入 scoring 存储，仪表盘四维雷达图有数据（非「无数据」）。
4. **文档闭环**：audit-prompts、scoring 文档、全链路 Skill 均更新并一致。

---

## §6 批判审计员终审与 Deferred Gaps

### 6.1 终审陈述

**Status**：有条件同意（conditional）

**条件**：任务列表中的 T4（路径命名规范）、T6（向后兼容示例）须在首轮实施中完成，以验证方案在真实产物上的可操作性。

### 6.2 Deferred Gaps

| ID | 描述 | 影响 | 建议 | 责任方 |
|----|------|------|------|--------|
| **GAP-001** | spec/plan 阶段是否同样强制可解析块？当前方案仅明确 tasks | 若 spec/plan 也产出逐条对照，会重现同样问题 | 在 T1/T3 完成后，评估 spec/plan 审计报告格式，必要时扩展强制范围 | 后续 Story |
| **GAP-002** | 历史逐条对照报告（已产出但未含块）的迁移策略未定义 | 旧报告无法解析，历史 run 数据缺失 | 文档中说明：仅新产出须含块；历史报告不回溯；可选提供「追加块」脚本辅助人工修补 | T3/T4 |
| **GAP-003** | 维度分与逐条对照结论的映射规则未细化（如「完全覆盖」→ 各维度多少分？） | 不同审计员可能给出不一致的维度分 | 已纳入 T1/T2 验收：在 audit-prompts 或附录中给出映射建议（完全覆盖→A/90+；部分覆盖→B/80+） | T1/T2 ✓ |

### 6.3 终审结论

方案可行，建议进入实施。上述 Deferred Gaps 记录在案，可在后续迭代中按优先级解决。

---

*本 TASKS 文档由 BMAD Party-Mode 100 轮辩论产出，遵循 party-mode workflow 与 step-02-discussion-orchestration 收敛规则。*
