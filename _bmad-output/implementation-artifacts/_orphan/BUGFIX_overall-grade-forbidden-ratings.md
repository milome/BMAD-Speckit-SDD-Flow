# BUGFIX：总体评级禁止 A-/B+/C+ 等修饰符仍被输出

## §1 问题描述

### 1.1 现象

审计报告（spec/plan/gaps/tasks/implement 各阶段）的可解析评分块中，尽管多处约束「总体评级仅限 A/B/C/D，禁止 A-、C+ 等」，**code-reviewer 或 generalPurpose 子代理仍输出 `总体评级: B+`** 等非法格式。

**复现场景**：`AUDIT_Story_13-4_stage4.md` 第 172 行输出 `总体评级: B+`，维度为 功能性 95、代码质量 92、测试覆盖 93、安全性 90。用户查看报告时看到 B+，与规则冲突。

### 1.2 根因

1. **Prompt 约束不够醒目**：audit-prompts §1–§5、audit-prompts-critical-auditor-appendix §7 已含「禁止 A-、C+ 等」，但未在可解析块示例旁显式列出 **B+**，模型易将 B+ 视为合理输出。
2. **无解析层校验**：`extractOverallGrade` 使用 `([ABCD])` 只捕获首字母，`总体评级: B+` 会被解析为 `"B"` 并写入 scoring；解析器不拒绝、不告警，非法格式可静默通过。
3. **无输出前自检约束**：审计 prompt 中未要求子代理在输出可解析块前自检「总体评级是否为纯 A/B/C/D，无 +/−」。

### 1.3 预期行为

- 审计报告可解析块中，总体评级**必须**为 `A`、`B`、`C`、`D` 四者之一，**禁止** `A-`、`B+`、`C+`、`D-` 等任意修饰符。
- 解析层在检测到非法格式时输出 WARN，便于排查与 SFT 数据清洗。

---

## §2 根因分析

| 层级 | 现状 | 缺口 |
|------|------|------|
| audit-prompts §1–§5 | 正文含「禁止 A-、C+ 等」 | 反例表中未显式列 B+；未在可解析块示例旁重复约束 |
| audit-prompts-critical-auditor-appendix §7 | 含「不得使用 A-、C+ 等」 | 反例表缺 B+；未在逐条对照示例中强调 |
| bmad-story-assistant STORY-A2/STORY-A4 | 引用 appendix §7 | 若 appendix 未强化，子代理易沿用模糊约束 |
| scoring/parsers/audit-generic.ts extractOverallGrade | 正则 `([ABCD])` 捕获首字母 | 对 `B+` 返回 `B`，不拒绝、不告警 |
| parse-and-write.ts | 直接使用 extractOverallGrade 结果 | 无对原始 content 的非法格式检测 |

---

## §3 影响范围

- **用户体验**：用户查看审计报告时看到 B+，与「仅限 A/B/C/D」的约定矛盾，产生困惑。
- **SFT 数据质量**：若将含 B+ 的报告纳入 SFT 数据集，会污染模型对可解析块格式的学习。
- **追溯与诊断**：非法格式静默通过，难以发现 prompt 遵守率问题。

---

## §4 修复方案

### 4.1 audit-prompts：反例表显式增列 B+ 等，并在可解析块旁重复约束

**修改路径**：`{project-root}/skills/speckit-workflow/references/audit-prompts.md`

**修改位置与内容**：

1. **§4.1 反例（无效输出）**（约第 66–70 行）：在现有反例行 `总体评级: A-、C+` 之后，**新增一行**：
   ```markdown
   - `总体评级: B+`、`A-`、`D-` — 含修饰符，禁止；仅限纯 A/B/C/D
   ```

2. **§4.1 可解析块要求段落**（含「总体评级只能是 **A/B/C/D**」的段落）：在「不得使用 A-、C+ 等」**之后**追加：
   ```markdown
   **禁止使用 B+、A-、C+、D- 等任意 +/- 修饰符**；若结论介于两档之间（如 B 与 A 之间），择一输出 B 或 A，不得输出 B+。
   ```

3. **§5.1 反例**（implement 阶段，约第 111–114 行）：同 §4.1，在反例中增列 `总体评级: B+`，并在可解析块要求段落追加上述禁止修饰符句。

4. **§1、§2、§3 主提示词**：在各自「总体评级只能是 A/B/C/D（禁止 A-、C+ 等）」句中，将「禁止 A-、C+ 等」**替换为**「禁止 A-、B+、C+、D- 等任意修饰符」。

### 4.2 audit-prompts-critical-auditor-appendix：反例表与示例旁强化

**修改路径**：`{project-root}/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`

**修改位置与内容**：

1. **§7 反例表**（约第 116–121 行）：在 `总体评级: A-、C+` 行**扩展**为：
   ```markdown
   | `总体评级: A-`、`B+`、`C+`、`D-` | 含修饰符，禁止；仅限纯 A/B/C/D |
   ```

2. **§7 可解析块要求段落**（「总体评级只能是 **A/B/C/D**」）：在「不得使用 A-、C+ 等」**之后**追加：
   ```markdown
   **禁止 B+、A-、C+、D- 等任意 +/- 修饰符**；介于两档时择一输出，不得输出 B+ 等。
   ```

3. **§7.1**（若存在 implement 专用块）：同上述方式增列反例与禁止修饰符句。

### 4.3 parse-and-write：检测非法总体评级格式并输出 WARN

**修改路径**：`{project-root}/scoring/orchestrator/parse-and-write.ts`

**修改逻辑**：在调用 `extractOverallGrade(content)` **之后**、使用 `overallGrade` 写入 **之前**，新增检测逻辑：

- 若 content 中存在匹配 `总体评级:\s*[ABCD][+-]` 的行（即 A/B/C/D 后紧跟 + 或 -），则向 stderr 输出：
  ```
  WARN: audit report contains forbidden overall_grade modifier (e.g. B+ or A-). Expected: A, B, C, or D only. Content snippet: <匹配到的整行，截断至 80 字符>
  ```
- 不阻断解析与写入；`extractOverallGrade` 仍按现有逻辑返回首字母（如 B+→B），仅增加可观测性。

**实现要点**：使用正则 `/总体评级:\s*([ABCD][+-])/m` 检测；若 match 非 null，输出 WARN。

### 4.4 bmad-story-assistant：阶段二、四可解析块要求中显式禁止 B+

**修改路径**：`{project-root}/skills/bmad-story-assistant/SKILL.md`

**修改位置与内容**：

1. **【§Story 可解析块要求】**（阶段二 STORY-A2-AUDIT 模板内）：在「总体评级仅限 A/B/C/D」**之后**追加：
   ```markdown
   禁止 B+、A-、C+、D- 等任意修饰符；介于两档时择一输出纯字母。
   ```

2. **阶段四综合审计**（报告可解析块须符合 §5.1 的段落）：在【§5 可解析块要求（implement 专用）】或等效描述中，若已有「禁止 tasks 四维」，则**在同一段内**追加：
   ```markdown
   总体评级禁止 B+、A-、C+、D- 等修饰符，仅限纯 A/B/C/D。
   ```

---

## §5 验收标准

| # | 验收项 | 验收方式 |
|---|--------|----------|
| 1 | audit-prompts 反例含 B+，可解析块旁有禁止修饰符句 | grep `B+`、`禁止.*修饰符`、`仅限纯 A/B/C/D` skills/speckit-workflow/references/audit-prompts.md |
| 2 | audit-prompts-critical-auditor-appendix 反例含 B+ | grep `B+` skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md |
| 3 | parse-and-write 对 B+ 等输出 WARN | 构造含 `总体评级: B+` 的 mock 报告，执行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <mock> --stage implement --skipTriggerCheck true --dataPath <tmp>`，stderr（2>&1）含 WARN 及 B+ 或 forbidden 或 modifier |
| 4 | bmad-story-assistant 可解析块要求含禁止 B+ 等 | grep `B+`、`禁止.*修饰符` 或等价表述 skills/bmad-story-assistant/SKILL.md |

---

## §6 流程建议

1. **审计 prompt 传参**：主 Agent 将可解析块要求（含禁止 B+ 等）整段复制进审计 prompt，不依赖子代理自行推断。
2. **SFT 数据清洗**：对既有 SFT 数据集做 grep，剔除含 `总体评级: [ABCD][+-]` 的样本。

---

## §7 最终任务列表

| ID | 修改路径 | 修改内容 | 验收标准 |
|----|----------|----------|----------|
| **T1** | `{project-root}/skills/speckit-workflow/references/audit-prompts.md` | ① §4.1 反例段落：在「总体评级: A-、C+」行后新增一行「`总体评级: B+`、`A-`、`D-` — 含修饰符，禁止；仅限纯 A/B/C/D」。② §4.1 可解析块要求段落：在「不得使用 A-、C+ 等」之后追加「**禁止使用 B+、A-、C+、D- 等任意 +/- 修饰符**；若结论介于两档之间（如 B 与 A 之间），择一输出 B 或 A，不得输出 B+。」③ §5.1 反例与可解析块要求：同①、② 方式增列 B+ 及禁止修饰符句。④ §1、§2、§3 主提示词中「禁止 A-、C+ 等」替换为「禁止 A-、B+、C+、D- 等任意修饰符」 | grep `B+`、`禁止.*修饰符`、`仅限纯 A/B/C/D` 在 audit-prompts.md 有匹配；§4.1、§5.1、§1–§3 均有对应修改 |
| **T2** | `{project-root}/skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md` | ① §7 反例表：将「总体评级: A-、C+」行扩展为「`总体评级: A-`、`B+`、`C+`、`D-` — 含修饰符，禁止；仅限纯 A/B/C/D」。② §7 可解析块要求段落：在「不得使用 A-、C+ 等」之后追加「**禁止 B+、A-、C+、D- 等任意 +/- 修饰符**；介于两档时择一输出，不得输出 B+ 等。」③ 若存在 §7.1 implement 专用块：同①、② 方式增列 | grep `B+`、`禁止.*修饰符` 在 audit-prompts-critical-auditor-appendix.md 有匹配 |
| **T3** | `{project-root}/scoring/orchestrator/parse-and-write.ts` | 在 `extractOverallGrade(content)` 调用之后、写入 record 之前，新增：使用正则 `/总体评级:\s*[ABCD][+-]/m` 检测 content；若 match 非 null，向 stderr 输出 `WARN: audit report contains forbidden overall_grade modifier (e.g. B+ or A-). Expected: A, B, C, or D only. Content snippet: <匹配到的整行，截断至 80 字符>`。不阻断解析与写入 | 使用含 `总体评级: B+` 的 mock 报告执行 `npx ts-node scripts/parse-and-write-score.ts --reportPath <mock> --stage implement --skipTriggerCheck true --dataPath <tmp>`（2>&1 捕获 stderr），stderr 含 WARN 及 B+ 或 forbidden 或 modifier |
| **T4** | `{project-root}/skills/bmad-story-assistant/SKILL.md` | ① 【§Story 可解析块要求】段（阶段二 STORY-A2-AUDIT 模板内）：在「总体评级仅限 A/B/C/D」之后追加「禁止 B+、A-、C+、D- 等任意修饰符；介于两档时择一输出纯字母。」② 阶段四综合审计段落（【§5 可解析块要求（implement 专用）】或等效）：在同一段内追加「总体评级禁止 B+、A-、C+、D- 等修饰符，仅限纯 A/B/C/D。」 | grep `B+`、`禁止.*修饰符` 或 `仅限纯 A/B/C/D` 在 bmad-story-assistant SKILL.md 有匹配；阶段二、四可解析块相关段落均有修改 |
| **T5** | `{project-root}/scoring/orchestrator/__tests__/parse-and-write.test.ts` | 新增用例：传入 content 含 `总体评级: B+` 的 implement 报告，调用 parseAndWriteScore，断言 stderr（或 console.error mock）包含 WARN 及 "B+" 或 "forbidden" 或 "modifier" | `npm run test:scoring` 通过；新用例存在且断言满足 |

---

**产出路径**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_overall-grade-forbidden-ratings.md`

**修订记录**：
- v1.0（2026-03-09）：初版，针对 B+ 等禁止修饰符仍被输出的根因与修复方案
- v1.1（2026-03-09）：§7 第 2 轮审计：T3、§5 验收标准补充 `--skipTriggerCheck true`、`--dataPath <tmp>`，确保 trigger 检查不阻断验收
