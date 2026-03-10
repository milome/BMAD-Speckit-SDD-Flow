# TASKS_lint_mandatory 审计报告（第 5 轮）

**被审对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_lint_mandatory.md`  
**需求依据**：`ANALYSIS_LINT_UNIVERSAL_ADAPTATION.md`、`skills/speckit-workflow/references/lint-requirement-matrix.md`  
**项目根**：`d:/Dev/BMAD-Speckit-SDD-Flow`  
**审计日期**：2026-03-11

---

## 1. 逐维度审计结论

### 1.1 需求覆盖

| 检查项 | 结论 |
|--------|------|
| 「语言无关」 | ✅ 覆盖。T0–T12 均引用 lint-requirement-matrix，无写死 `npm run lint`。 |
| 「未配置即不通过」 | ✅ 覆盖。§2、T1–T12 均明确「若项目使用主流语言但未配置 Lint 须作为 gap/未通过项」。 |
| 「按技术栈执行」 | ✅ 覆盖。各任务均要求见 lint-requirement-matrix，按语言→工具→命令执行。 |
| T0–T12 与 ANALYSIS 4.2 对应 | ✅ 一致。T0 创建 matrix；T1–T12 与 ANALYSIS 表一一对应。 |
| 主流语言范围 | ✅ 与 lint-requirement-matrix 一致（16+ 语言，含 Terraform/YAML/Dockerfile）。 |

### 1.2 任务可执行性

| 任务 | 路径 | 修改内容 | 验收标准 | 结论 |
|------|------|----------|----------|------|
| T0 | lint-requirement-matrix.md | 创建文件、16+ 语言、通用表述 | 文件存在、grep 可验 | ✅ |
| T1 | tasks-acceptance-templates §5 | 替换 lint 条目、同步修正「验证通过」 | grep、按技术栈、验证通过含 lint | ✅ |
| T2 | audit-prompts §5 | 新增/更新 (9) lint 检查 | grep | ✅ |
| T3 | critical-auditor-appendix | 替换/新增 lint 维度行 | grep | ✅ |
| T4 | speckit-workflow SKILL | 7.1 替换为通用表述 | grep | ✅（修正后）|
| T5 | ralph-method SKILL | Verification Commands + acceptanceCriteria | grep、prd 含 lint | ✅ |
| T6 | audit-prompts §4 | 替换 (4) 为按技术栈 | grep | ✅ |
| T7 | bmad-bug-assistant 两文件 | 替换 lint 项 | grep | ✅ |
| T8 | bmad-story-assistant | 3.1 lint 审计维度 | grep | ✅ |
| T9 | bmad-standalone-tasks 两文件 | 第 7 项替换 | grep | ✅ |
| T10 | speckit.implement 两处 | Step 9 替换 | grep 两文件 | ✅ |
| T11 | audit-prompt-tasks-doc | 第 6 项替换 | grep | ✅ |
| T12 | tasks-acceptance-templates §6 | 替换 lint、同步修正「验证通过」 | grep、验证通过含 lint | ✅ |

### 1.3 依赖与一致性

- **T0 前置**：✅ T1–T12 均引用 lint-requirement-matrix，隐含 T0 先完成。
- **引用路径**：✅ lint-requirement-matrix 路径正确（skills/speckit-workflow/references/）。
- **§1、§2、§4 与任务**：✅ 约束与验收汇总与 T0–T12 一致。
- **T1/T12 验证通过一致性**：✅ 均要求「验证通过」行以 lint 为必要条件，且表述一致。

### 1.4 边界与遗漏

- **skill/文件覆盖**：✅ ANALYSIS 4.2 表所列 skill 均在 T1–T12 中；speckit.implement 两处路径均存在。
- **主流语言**：✅ 与 lint-requirement-matrix 一致；T0 验收为「至少 16 种」。
- **未配置判定**：✅ §2 明确依据项目特征文件 + lint-requirement-matrix；ANALYSIS §5 审计检测逻辑已说明。

### 1.5 集成/端到端

- **T1–T12 覆盖**：✅ 覆盖 spec/plan/tasks/prd 生成、实施后审计、commands、TASKS 文档审计等全部目标。
- **孤岛任务**：✅ 无。所有任务均指向具体文件与可验证产出。

### 1.6 lint 验收通用化

- **npm run lint 消除**：✅ 全部改为「按技术栈 + lint-requirement-matrix」。
- **未配置即不通过**：✅ 各任务与 §2 均明确。

---

## 2. 轮内修正记录

本轮审计发现以下 gap，**已直接修改** TASKS_lint_mandatory.md 以消除：

1. **T5「若项目有 lint 脚本」歧义**：原表述「后追加 ` && npm run lint`（若项目有 lint 脚本）」中，括号内容可被解读为 lint 对 JS/TS 为可选，与 ANALYSIS「未配置即不通过」矛盾。已修正为：「后追加 ` && npm run lint`；JS/TS 项目须配置 lint 脚本，未配置则审计不通过」，消除歧义并强化强制配置要求。

---

## 3. 批判审计员结论

（本段字数与条目数不少于报告其余部分的 70%）

### 3.1 已检查维度列表

| 序号 | 维度 | 说明 |
|------|------|------|
| 1 | 需求完整性 | 对照 ANALYSIS 逐条检查「语言无关」「未配置即不通过」「按技术栈执行」及 T0–T12 与 ANALYSIS 4.2 对应关系 |
| 2 | 任务可执行性 | 每任务修改路径、具体修改内容、验收标准是否清晰、可量化、可验证 |
| 3 | 依赖与一致性 | T0 前置、引用路径正确、§1/§2/§4 与任务一致、T1/T12 验证通过一致性 |
| 4 | 边界与遗漏 | skill/文件覆盖、主流语言范围、未配置判定方式、ANALYSIS §5 审计检测逻辑 |
| 5 | 集成/端到端 | T1–T12 覆盖全部目标、无孤岛任务 |
| 6 | lint 验收通用化 | 全部从 npm run lint 改为按技术栈 + lint-requirement-matrix；未配置即不通过明确 |
| 7 | 与「未配置即不通过」一致性 | 各任务表述中是否存在将 lint 设为可选的歧义（如「若有」「若存在」等） |
| 8 | T5 ralph-method 特殊路径 | 用户目录 vs 项目内 fallback、rg 命令覆盖范围 |
| 9 | T1/T12 验证通过逻辑 | 两任务对 tasks-acceptance-templates 第 5、6 节「验证通过」修改须一致 |
| 10 | 路径可移植性 | T0 绝对路径、T5 多路径约定 |

### 3.2 每维度批判审计结论

**维度 1（需求完整性）**  
- 批判：ANALYSIS 明确「未配置即不通过」与「按技术栈执行」；若 TASKS 任一处残留「若项目存在」「若有」等条件式表述，将削弱强制约束。  
- 结论：已逐条对照。T5 原「（若项目有 lint 脚本）」构成歧义，已修正。修正后需求覆盖完整。

**维度 2（任务可执行性）**  
- 批判：T5 路径含「{用户 home}」「若项目内存在…须同步修改」，实施者需枚举两种情形；T9「第 88–120 行附近」行号可漂移；T10 两处 commands 路径需同步修改。  
- 结论：T5 路径约定已明确两种情形；T9「附近」允许漂移；T10 两路径均已列出。可执行性满足。

**维度 3（依赖与一致性）**  
- 批判：T1 与 T12 同改 tasks-acceptance-templates，「验证通过」修改若不一致会导致文档内逻辑矛盾。  
- 结论：T1、T12 均要求「验证通过」以「生产代码实现」「集成测试」及「lint」为必要条件，且替换文本一致。§4 已纳入 T1/T12 一致性检查。

**维度 4（边界与遗漏）**  
- 批判：ANALYSIS §5 审计检测逻辑（识别语言→检查配置→执行→判定）是否在 TASKS 中有体现；lint-requirement-matrix 含 Terraform/YAML/Dockerfile，是否与「主流语言」范围一致。  
- 结论：§2「未配置」判定引用 ANALYSIS §5；T0 验收为「至少 16 种」，matrix 现有 21 种，满足。无遗漏。

**维度 5（集成/端到端）**  
- 批判：T7、T9 均涉及两文件，若仅改一处会导致不一致。  
- 结论：TASKS 已明确「两文件均须」「两处 commands 均须」。无孤岛任务。

**维度 6（lint 验收通用化）**  
- 批判：若任一处仍写「npm run lint」或「若项目存在 lint」等，则未彻底通用化。  
- 结论：T1–T12 均改为「按技术栈」「见 lint-requirement-matrix」「未配置即不通过」。T5 修正后无歧义。

**维度 7（与「未配置即不通过」一致性）**  
- 批判：T5 原「（若项目有 lint 脚本）」可被解读为：仅在项目已有 lint 时追加命令；对无 lint 的 JS/TS 项目不强制添加，与「未配置即不通过」矛盾。  
- 结论：**gap 已发现并修正**。修正为「JS/TS 项目须配置 lint 脚本，未配置则审计不通过」，与 ANALYSIS 一致。

**维度 8（T5 ralph-method 特殊路径）**  
- 批判：ralph-method 在用户目录，rg 命令不覆盖；项目内无 ralph-method 时如何验证？  
- 结论：TASKS 已说明「若项目内存在 skills/ralph-method/ 或 node_modules/ralph-method/ 等本地拷贝，须同步修改」。rg 针对项目内 paths，符合预期。

**维度 9（T1/T12 验证通过逻辑）**  
- 批判：第 5 节与第 6 节若「验证通过」定义不同，同一文档内逻辑矛盾。  
- 结论：T1、T12 均要求「仅当…及「lint」均满足…方可在「验证通过」列勾选」。双向引用已写入验收标准与 §4。

**维度 10（路径可移植性）**  
- 批判：T0 使用绝对路径 d:/Dev/...，移植至其他项目需替换。  
- 结论：文档头部已给项目根，实施时以项目根替换即可。符合常规用法。

### 3.3 对抗视角补充核查

- **T0–T12 与 ANALYSIS 4.2 一一对应**：已核对，无遗漏任务。  
- **audit-prompts §4 与 §5 同文件**：T2 改 §5、T6 改 §4，不同段落，无冲突。  
- **critical-auditor-appendix 表格**：T3 要求替换「lint 未通过」行为「lint 未通过或未配置」，与 ANALYSIS 3.3 一致。  
- **禁止词**：各任务均含「禁止以『与本次任务不相关』豁免」，与 §2 一致。  
- **多语言项目**：lint-requirement-matrix 支持多语言；项目使用多种主流语言时，每种均需配置，TASKS 未显式写，但「按技术栈」「见 matrix」已覆盖。

### 3.4 本轮结论

- **已检查维度**：10 项（需求完整性、可执行性、一致性、边界遗漏、集成端到端、lint 通用化、未配置一致性、T5 路径、T1/T12 一致性、路径可移植性）。  
- **每维度结论**：维度 7 曾存在 gap（T5「若项目有 lint 脚本」歧义），已轮内修正；其余维度通过。  
- **本轮存在 gap**：是。T5 表述与「未配置即不通过」存在歧义，已直接修改 TASKS 消除。  
- **修正后剩余 gap**：无。  
- **收敛判定**：**本轮存在 gap，不计数**。（发现 gap 即不计数，即使已轮内修正。）

---

## 4. 总结

- **结论**：修正后 **完全覆盖、验证通过**。  
- **依据**：需求覆盖完整，任务可执行、可验证，T5 歧义已消除，T1/T12 一致性明确，无遗漏与矛盾。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 93/100
- 可追溯性: 95/100
