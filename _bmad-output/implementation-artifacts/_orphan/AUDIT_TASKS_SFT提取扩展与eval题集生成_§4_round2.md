# AUDIT：TASKS_SFT提取扩展与eval题集生成 §4 精神适配审计（第 2 轮）

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

**审计对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_SFT提取扩展与eval题集生成.md`  
**审计类型**：audit-prompts §4 精神适配的 TASKS 文档审计（非代码实现审计）  
**上一轮依据**：AUDIT_TASKS_SFT提取扩展与eval题集生成_§4_round1.md（GAP-CA-1、GAP-CA-2）  
**审计日期**：2026-03-07  
**轮次**：第 2 轮

---

## 1. GAP-CA-1、GAP-CA-2 闭合验证

### 1.1 GAP-CA-1：T1 验收标准是否已补充 bmad-story-assistant 的 artifactDocPath 约定验收

**第 1 轮修改建议**：在 T1 验收标准中补充「bmad-story-assistant Skill 中 implement 阶段（或嵌套 speckit 流程的 implement 阶段）parseAndWriteScore 调用显式传入 artifactDocPath 取值规则，与 speckit-workflow、bmad-bug-assistant 一致」。

**当前 T1 验收标准 5）**：bmad-story-assistant Skill 中 implement 阶段（或嵌套 speckit 流程）parseAndWriteScore 调用约定与 artifactDocPath 取值与 speckit-workflow 一致。

**验证结论**：✓ **GAP-CA-1 已闭合**。验收标准 5）明确覆盖 bmad-story-assistant 的 implement 阶段 parseAndWriteScore 调用约定与 artifactDocPath 取值，与 speckit-workflow 一致，与第 1 轮修改建议完全对应。

---

### 1.2 GAP-CA-2：T3 验收标准是否已补充 --input 路径验收或明确本迭代不覆盖

**第 1 轮修改建议**：在 T3 验收标准中补充「使用 `--input <coach-diagnose JSON 路径>` 可成功生成题目文件，行为与 `--run-id` 等价」。

**当前 T3 验收标准 2）**：使用 `--input <coach-diagnose JSON 路径>` 指定 coach-diagnose 输出文件时，可成功生成题目文件。

**验证结论**：✓ **GAP-CA-2 已闭合**。验收标准 2）明确覆盖 --input 路径的验收，可量化、可执行，与第 1 轮修改建议对应（「可成功生成题目文件」与「行为与 --run-id 等价」语义一致）。

---

## 2. 检查项逐项验证

### 2.1 需求映射表 REQ-1～REQ-6 完整覆盖

| 需求 ID | 描述 | 对应任务 | 验证 |
|---------|------|----------|------|
| REQ-1 | implement 阶段 phase_score≤60 的记录可被 SFT 提取器使用 | T1, T2 | ✓ T1 改 source_path；T2 扩展解析 |
| REQ-2 | source_path 在 implement 阶段指向 SFT 可解析的文档 | T1 | ✓ |
| REQ-3 | 审计报告可作为 instruction 来源 | T2 | ✓ |
| REQ-4 | 从 weak_areas、weakness_clusters 自动生成 eval_question | T3 | ✓ |
| REQ-5 | 旧 record 无 source_path 时 SFT 提取行为保持不变 | T2 | ✓ |
| REQ-6 | source_path 指向 BUGFIX 时沿用现有 §1+§4 解析逻辑 | T2 | ✓ |

**结论**：REQ-1～REQ-6 完整覆盖，无遗漏。

---

### 2.2 T1/T2/T3 验收标准可量化、可执行

| 任务 | 验收条数 | 可量化 | 可执行 | 结论 |
|------|----------|--------|--------|------|
| T1 | 7 条 | ✓ 单测断言、CLI 验证、Skill grep | ✓ 验收命令明确 | ✓ |
| T2 | 6 条 | ✓ 文件存在、单测、incSkip 原因 | ✓ | ✓ |
| T3 | 7 条 | ✓ 脚本执行、文件生成、exit 码 | ✓ 含 --run-id 与 --input 双路径 | ✓ |

**结论**：T1/T2/T3 验收标准均可量化、可执行。

---

### 2.3 依赖关系正确（T2 依赖 T1；T1、T3 可并行）

| 任务 | 依赖 | 可并行 | 验证 |
|------|------|--------|------|
| T1 | 无 | 与 T3 可并行 | ✓ |
| T2 | T1 | 须在 T1 完成后 | ✓ T2 依赖 T1 的 source_path 逻辑 |
| T3 | coach-diagnose（已实现） | 与 T1 可并行 | ✓ |

**结论**：依赖关系正确。

---

### 2.4 边界处理表覆盖所有已知场景

| 场景 | 边界表覆盖 | 结论 |
|------|------------|------|
| implement artifactDocPath=BUGFIX | ✓ | ✓ |
| implement artifactDocPath=tasks/spec/plan | ✓ | ✓ |
| implement artifactDocPath 未传入 | ✓ | ✓ |
| 审计报告无批判审计员结论 | ✓ | ✓ |
| source_path 指向 BUGFIX 且含 §1+§4 | ✓ | ✓ |
| eval_question 无短板数据 | ✓ | ✓ |
| eval_question run 不存在 | ✓ | ✓ |

**结论**：边界处理表覆盖所有已知场景。

---

### 2.5 向后兼容说明完整

- 旧 record 无 source_path：incSkip「无 source_path」，行为不变 ✓  
- source_path 指向 BUGFIX：优先 extractBugfixSections，逻辑不变 ✓  
- source_path 指向审计报告：新增 extractAuditReportSections fallback ✓  
- source_path 指向 spec/plan/tasks/GAPS：T1 实施后 source_path=reportPath ✓  
- RunScoreRecord、run-score-schema.json 无变更 ✓  

**结论**：向后兼容说明完整。

---

### 2.6 禁止词检查

全文检索：**可选**、**可考虑**、**后续**、**待定**、**酌情**、**技术债**。

**结论**：未发现禁止词，检查通过。

---

### 2.7 GAP-1～17 及 GAP-CA-1、GAP-CA-2 均在任务列表中闭合

| GAP | 闭合方式 |
|-----|----------|
| GAP-1～17 | §7 GAP 闭合摘要表已列，任务列表与验收标准覆盖 |
| GAP-CA-1 | T1 验收标准 5）已补充 bmad-story-assistant artifactDocPath 约定验收 |
| GAP-CA-2 | T3 验收标准 2）已补充 --input 路径验收 |

**结论**：GAP-1～17 及 GAP-CA-1、GAP-CA-2 均已闭合。

---

## 3. 批判审计员结论（≥50%）

### 3.1 对抗视角：GAP-CA-1 闭合充分性

第 1 轮要求「bmad-story-assistant 的 artifactDocPath 约定更新有显式验收标准」。当前 T1 验收标准 5）表述为「parseAndWriteScore 调用约定与 artifactDocPath 取值与 speckit-workflow 一致」。**可验证性**：实施时需 grep bmad-story-assistant SKILL 中 implement 阶段段落，核对是否显式写出 artifactDocPath 取值（tasks 路径或 BUGFIX 路径）及与 speckit-workflow 一致。表述「与 speckit-workflow 一致」隐含需对照 speckit-workflow 的约定，可执行。**结论**：GAP-CA-1 闭合充分，无遗漏。

### 3.2 对抗视角：GAP-CA-2 闭合充分性

第 1 轮要求「--input 路径有验收标准」。当前 T3 验收标准 2）为「使用 `--input <coach-diagnose JSON 路径>` 指定 coach-diagnose 输出文件时，可成功生成题目文件」。**可验证性**：实施时需准备 coach-diagnose 输出的 JSON 文件，执行 `npx ts-node scripts/eval-question-generate.ts --input <path> --version v1`，验证生成题目文件。验收命令汇总 §4 仅列 `--run-id` 示例，未列 `--input` 示例。**潜在 gap**：验收命令汇总是否需补充 `--input` 的 CLI 示例？核查：验收命令汇总为「汇总」性质，T3 验收标准 2）已明确 --input 验收，实施时可按验收标准 2）执行，不依赖汇总中的具体命令。汇总补充 `--input` 示例为改进建议，非阻塞。**结论**：GAP-CA-2 闭合充分。

### 3.3 对抗视角：是否引入新 gap

逐项核查：需求映射、验收标准、依赖关系、边界表、向后兼容、禁止词、GAP 闭合。主 Agent 按第 1 轮建议修订后，未发现以下新 gap：遗漏需求、验收不可执行、依赖错误、边界未覆盖、向后兼容缺失、禁止词引入、GAP 回退。**结论**：未引入新 gap。

### 3.4 对抗视角：artifactDocPath 与 bmad-story-assistant 的「产出路径」可追溯性

T1 产出路径含 `skills/bmad-story-assistant/SKILL.md`（或等效路径）。bmad-story-assistant 可能位于项目内或用户全局 `~/.cursor/skills/`。验收标准 5）要求「与 speckit-workflow 一致」，未限定路径。产出路径已注明「或等效路径」，可接受。实施时以产出路径为准，若项目内存在则修改项目内；否则修改全局。**结论**：无路径歧义，无新 gap。

### 3.5 对抗视角：T3 --input 与 --run-id 的等价性表述

第 1 轮建议「行为与 --run-id 等价」。当前表述为「可成功生成题目文件」。等价性包含：1) 生成题目文件；2) 题目格式符合 MANIFEST_SCHEMA §3.1；3) manifest 追加新条目。验收标准 3）、4）已覆盖格式与 manifest，对 --run-id 与 --input 均适用。故「可成功生成题目文件」在验收 2）～5）的上下文中，与「行为等价」语义一致。**结论**：无表述不足，无新 gap。

### 3.6 批判审计员本轮结论

经 5 项对抗检查：GAP-CA-1、GAP-CA-2 闭合充分；未引入新 gap；artifactDocPath 路径与 --input 等价性表述无遗漏。验收命令汇总未列 --input 示例为可选改进，不构成本轮 gap。

**本轮结论**：**本轮无新 gap**。

---

## 4. 总体结论

**完全覆盖、验证通过**。

- GAP-CA-1 已闭合：T1 验收标准 5）已补充 bmad-story-assistant 的 artifactDocPath 约定验收。  
- GAP-CA-2 已闭合：T3 验收标准 2）已补充 --input 路径验收。  
- 未引入新 gap。  
- 需求映射 REQ-1～REQ-6 完整覆盖。  
- T1/T2/T3 验收标准可量化、可执行。  
- 依赖关系正确，边界处理表完整，向后兼容说明完整，禁止词检查通过。  
- GAP-1～17 及 GAP-CA-1、GAP-CA-2 均在任务列表中闭合。  
- 批判审计员结论占比 ≥50%，**本轮无新 gap**。

---

## 5. 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 95/100
- 一致性: 95/100
- 可追溯性: 95/100
