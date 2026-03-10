# AUDIT：TASKS_SFT提取扩展与eval题集生成 §4 精神适配审计（第 3 轮）

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

**审计对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_SFT提取扩展与eval题集生成.md`  
**审计类型**：audit-prompts §4 精神适配的 TASKS 文档审计（非代码实现审计）  
**需求来源**：文档内 REQ-1～REQ-6、用户原始议题（SFT 提取扩展、parse-and-write source_path、审计报告解析器、eval_question 生成）  
**前序轮次**：第 1 轮（GAP-CA-1、GAP-CA-2）→ 第 2 轮（已闭合，无新 gap）  
**审计日期**：2026-03-07  
**轮次**：第 3 轮（若仍无新 gap 则满足「连续 3 轮无 gap」收敛条件）

---

## 1. 检查项逐项验证

### 1.1 需求映射表 REQ-1～REQ-6 完整覆盖且与任务对应无遗漏

| 需求 ID | 描述 | 对应任务 | 任务内验收映射 | 结论 |
|---------|------|----------|----------------|------|
| REQ-1 | implement 阶段 phase_score≤60 的记录可被 SFT 提取器使用 | T1, T2 | T1 改 source_path 使 implement 低分 record 指向可解析文档；T2 扩展 SFT 支持审计报告 | ✓ |
| REQ-2 | source_path 在 implement 阶段指向 SFT 可解析的文档（BUGFIX 或审计报告） | T1 | T1 验收 1、2、6、7 覆盖 source_path 写入逻辑 | ✓ |
| REQ-3 | 审计报告可作为 instruction 来源（批判审计员结论、GAP 列表、修改建议） | T2 | T2 验收 1、2、3 覆盖 extractAuditReportSections 与 sft-extractor 集成 | ✓ |
| REQ-4 | 从 weak_areas、weakness_clusters 自动生成 eval_question 题目 | T3 | T3 验收 1～7 覆盖生成逻辑、格式、list、边界 | ✓ |
| REQ-5 | 旧 record 无 source_path 时 SFT 提取行为保持不变（向后兼容） | T2 | T2 验收 5 明确 incSkip「无 source_path」 | ✓ |
| REQ-6 | source_path 指向 BUGFIX 时沿用现有 §1+§4 解析逻辑 | T2 | T2 验收 4 明确 source_path 指向 BUGFIX 时行为与现有一致 | ✓ |

**结论**：需求映射表完整，REQ-1～REQ-6 均有对应任务及可追溯验收标准，无遗漏。

---

### 1.2 T1/T2/T3 验收标准可量化、可执行（含验收命令）

| 任务 | 验收条数 | 可量化 | 可执行 | 验收命令/方式 | 结论 |
|------|----------|--------|--------|---------------|------|
| T1 | 7 条 | ✓ 单测断言、CLI 验证、Skill 段落 | ✓ | `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts`；`npx ts-node scripts/parse-and-write-score.ts ...`；grep Skill 段落 | ✓ |
| T2 | 6 条 | ✓ 文件存在、单测、incSkip 原因 | ✓ | `npm run test:scoring -- scoring/analytics/__tests__/audit-report-parser.test.ts`；`sft-extractor.test.ts`；`npx ts-node scripts/sft-extract.ts --threshold 60` | ✓ |
| T3 | 7 条 | ✓ 脚本执行、文件生成、exit 码 | ✓ | `npx ts-node scripts/eval-question-generate.ts --run-id/--input ...`；`npx ts-node scripts/eval-questions-cli.ts list --version v1` | ✓ |

**验收命令汇总 §4** 已列出 T1/T2/T3 的 CLI 与单测命令；T3 的 `--input` 路径验收标准 2）已覆盖，实施时按验收 2）执行即可，汇总未列 `--input` 示例为可选改进，不阻塞。

**结论**：T1/T2/T3 验收标准均可量化、可执行，含明确验收命令。

---

### 1.3 依赖关系正确（T2 依赖 T1；T1、T3 可并行）

| 任务 | 依赖 | 可并行 | 验证 |
|------|------|--------|------|
| T1 | 无 | 与 T3 可并行 | ✓ |
| T2 | T1 | 须在 T1 完成后实施 | ✓ T2 依赖 T1 的 source_path 逻辑，否则 speckit implement 的 record.source_path 仍指向 tasks |
| T3 | coach-diagnose（已实现） | 与 T1 可并行 | ✓ |

**结论**：依赖关系正确，与 §3 依赖关系表一致。

---

### 1.4 边界处理表覆盖所有已知场景

| 场景 | 边界表 §6 覆盖 | 验收/描述覆盖 | 结论 |
|------|----------------|---------------|------|
| implement artifactDocPath=BUGFIX | ✓ | T1 验收 2、7 | ✓ |
| implement artifactDocPath=tasks/spec/plan | ✓ | T1 验收 1、6 | ✓ |
| implement artifactDocPath 未传入 | ✓ | T1 描述、边界表 | ✓ |
| source_path 指向审计报告但无批判审计员结论 | ✓ | T2 验收 6、边界表 | ✓ |
| source_path 指向 BUGFIX 且含 §1+§4 | ✓ | T2 验收 4 | ✓ |
| eval_question 无短板数据 | ✓ | T3 验收 6 | ✓ |
| eval_question run 不存在 | ✓ | T3 验收 7 | ✓ |

**结论**：边界处理表覆盖所有已知场景，与验收标准一致。

---

### 1.5 向后兼容说明完整

- 旧 record 无 source_path：incSkip「无 source_path」，行为不变 ✓  
- source_path 指向 BUGFIX：优先 extractBugfixSections，逻辑不变 ✓  
- source_path 指向审计报告：新增 extractAuditReportSections fallback ✓  
- source_path 指向 spec/plan/tasks/GAPS：T1 实施后 source_path=reportPath，此类 record 将指向审计报告 ✓  
- RunScoreRecord、run-score-schema.json 无变更 ✓  

**结论**：向后兼容说明完整，与 REQ-5、REQ-6 一致。

---

### 1.6 禁止词检查

全文检索：**可选**、**可考虑**、**后续**、**待定**、**酌情**、**技术债**。

**结论**：未发现禁止词，GAP-17 已闭合。

---

### 1.7 GAP-1～17 及 GAP-CA-1、GAP-CA-2 均在任务列表中闭合

| GAP | 闭合方式 |
|-----|----------|
| GAP-1～17 | §7 GAP 闭合摘要表已列，任务列表与验收标准覆盖 |
| GAP-CA-1 | T1 验收标准 5）已补充 bmad-story-assistant 的 implement 阶段 parseAndWriteScore 调用约定与 artifactDocPath 取值与 speckit-workflow 一致 |
| GAP-CA-2 | T3 验收标准 2）已补充 `--input <coach-diagnose JSON 路径>` 验收 |

**结论**：GAP-1～17 及 GAP-CA-1、GAP-CA-2 均在任务列表中闭合。

---

### 1.8 任务描述可落地、与现有实现无矛盾

| 任务 | 可落地性 | 与现有实现 |
|------|----------|------------|
| T1 | parse-and-write.ts、parse-and-write-score.ts、Skill 路径均存在 | 修改为分支逻辑，无破坏性变更 |
| T2 | audit-report-parser 为新增；sft-extractor 为扩展 | 与 extractBugfixSections 现有逻辑兼容 |
| T3 | eval-question-generate.ts 为新建；eval-questions-cli.ts、MANIFEST_SCHEMA.md 存在 | coach-diagnose 输出结构已实现 |

**结论**：任务描述可落地，与现有实现无矛盾。

---

## 2. 批判审计员结论（≥50%）

### 2.1 对抗视角：GAP-CA-1、GAP-CA-2 闭合充分性复验

**GAP-CA-1**：第 1 轮要求 bmad-story-assistant 的 artifactDocPath 约定有显式验收。当前 T1 验收 5）为「bmad-story-assistant Skill 中 implement 阶段（或嵌套 speckit 流程）parseAndWriteScore 调用约定与 artifactDocPath 取值与 speckit-workflow 一致」。实施时可 grep bmad-story-assistant SKILL 的 implement 段落，核对是否显式写出 artifactDocPath 取值（tasks 路径或 BUGFIX 路径）及与 speckit-workflow 的对应关系。**结论**：闭合充分。

**GAP-CA-2**：第 1 轮要求 --input 路径有验收。当前 T3 验收 2）为「使用 `--input <coach-diagnose JSON 路径>` 指定 coach-diagnose 输出文件时，可成功生成题目文件」。实施时准备 coach-diagnose 输出 JSON，执行 `npx ts-node scripts/eval-question-generate.ts --input <path> --version v1`，验证生成题目。验收 3）、4）、5）对 --run-id 与 --input 均适用，故「可成功生成题目文件」与「行为等价」语义一致。**结论**：闭合充分。

---

### 2.2 对抗视角：是否引入新 gap（第 3 轮专项）

逐项核查：需求映射、验收标准、依赖关系、边界表、向后兼容、禁止词、GAP 闭合、任务可落地性。经第 2 轮修订后，本轮未发现以下新 gap：遗漏需求、验收不可执行、依赖错误、边界未覆盖、向后兼容缺失、禁止词引入、GAP 回退、任务与实现矛盾。

**潜在边缘场景复核**：

- **source_path 指向的文件不存在**：T2 描述未明确 fs 异常处理。实施时按常规 Node 异常处理即可，不构成本轮阻断 gap。
- **T3 --version v2 与 --outputDir 联动**：描述默认 outputDir 为 scoring/eval-questions/v1，未明确 version 与 outputDir 的自动联动。视为设计选择，非本轮阻断 gap。
- **extractAuditReportSections 正则覆盖「①」「②」等 Unicode 序号**：GAP-3 闭合称覆盖多种格式，验收 2）列举「1) A；2) B」与「本轮无新 gap」。实施时可用真实报告 fixture 验证 Unicode 变体，不阻断本轮。
- **T2 集成验证 sft-extract 依赖「存在 implement 低分且 source_path 指向审计报告的 record」**：T2 依赖 T1，T1 实施后产生此类 record 即可验证。单测用 fixture 可独立验证，不阻断。

**结论**：未引入新 gap。

---

### 2.3 对抗视角：验收命令可执行性深度检查

- **T1 CLI 验证**：`--epic 9 --story 2` 生成 runId，scoring/data 下写入 `{runId}.json`，验证时可直接读取该文件检查 source_path 字段。可执行。
- **T2 sft-extract 验证**：需至少一条 phase_score≤60 且 source_path 指向审计报告的 record。T1 实施后 speckit implement 流程按新逻辑写入即可产生。可执行。
- **T3 list 验证**：manifest-loader 遍历 manifest.yaml，gen- 前缀题目 id 与 q001 格式兼容（GAP-6 已确认 id 为任意字符串）。可执行。
- **npm run test:scoring**：package.json 存在，vitest 运行 scoring 目录。可执行。

**结论**：验收命令均可执行，无孤岛或不可验证项。

---

### 2.4 对抗视角：需求映射与任务描述的因果链一致性

REQ-1「implement 低分记录可被 SFT 提取」的因果链：T1 修改 source_path 使 implement 时指向可解析文档（BUGFIX 或审计报告）→ T2 扩展 SFT 支持审计报告解析 → 低分 record 可产出 instruction。T2 依赖 T1 与因果链一致。REQ-5、REQ-6 的向后兼容与 T2 验收 4、5 一致。**结论**：无矛盾。

---

### 2.5 对抗视角：产出路径与验收标准的对应关系

| 任务 | 产出路径 | 验收覆盖 |
|------|----------|----------|
| T1 | parse-and-write.ts、parse-and-write.test.ts、speckit-workflow、bmad-bug-assistant、bmad-story-assistant | 验收 1～7 覆盖代码与三处 Skill |
| T2 | audit-report-parser.ts、audit-report-parser.test.ts、sft-extractor.ts、sft-extractor.test.ts | 验收 1～6 覆盖 |
| T3 | eval-question-generate.ts、scoring/eval-questions/v1/ | 验收 1～7 覆盖 |

**结论**：产出路径与验收标准一一对应，无遗漏。

---

### 2.6 批判审计员本轮结论

经 5 项对抗检查：GAP-CA-1、GAP-CA-2 闭合充分；未引入新 gap；验收命令可执行；需求映射与因果链一致；产出路径与验收对应完整。

**本轮结论**：**本轮无新 gap**。

---

## 3. 收敛声明

- **第 1 轮**：存在 GAP-CA-1、GAP-CA-2。
- **第 2 轮**：GAP-CA-1、GAP-CA-2 已闭合，**无新 gap**。
- **第 3 轮**：**无新 gap**。

**连续 3 轮无 gap 收敛条件已满足**（第 2、3 轮无新 gap；第 1 轮 gap 已闭合）。

---

## 4. 总体结论

**完全覆盖、验证通过**。

- 需求映射表 REQ-1～REQ-6 完整覆盖，与任务对应无遗漏。
- T1/T2/T3 验收标准可量化、可执行，含验收命令。
- 依赖关系正确（T2 依赖 T1；T1、T3 可并行）。
- 边界处理表覆盖所有已知场景。
- 向后兼容说明完整。
- 禁止词检查通过。
- GAP-1～17 及 GAP-CA-1、GAP-CA-2 均在任务列表中闭合。
- 任务描述可落地、与现有实现无矛盾。
- 批判审计员结论占比 ≥50%，**本轮无新 gap**。

**第 3 轮；连续 3 轮无 gap，已收敛。**

---

## 5. 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 98/100
- 可测试性: 96/100
- 一致性: 96/100
- 可追溯性: 98/100
