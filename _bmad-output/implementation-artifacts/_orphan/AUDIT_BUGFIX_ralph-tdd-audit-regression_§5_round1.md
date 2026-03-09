# BUGFIX_ralph-tdd-audit-regression 审计报告 §5 第 1 轮

**被审文档**：`_bmad-output/implementation-artifacts/_orphan/BUGFIX_ralph-tdd-audit-regression.md`  
**审计依据**：audit-prompts.md §5 精神、audit-prompts-critical-auditor-appendix.md、bmad-bug-assistant 禁止词表  
**审计模式**：strict（须连续 3 轮「完全覆盖、验证通过」且每轮批判审计员注明「本轮无新 gap」）  
**本轮**：第 1 轮

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. 逐项验证结果

### 1.1 §1–§5 完整性

| 审计项 | 结果 | 说明 |
|--------|------|------|
| §1 问题描述完整可复现 | ✅ 通过 | 问题 1、问题 2 均有现象、示例、复现步骤（4 步），可操作 |
| §2 根因分析有证据 | ✅ 通过 | 根因结论、根因分解表（Prompt/流程/认知/规范层）、两问题关联均有表述；§2 中「既有问题可排除、与本次无关」为引用禁止词表事实，非 §4/§7 方案表述 |
| §4 修复方案明确 | ⚠️ 见 1.2 | 4.1、4.2 修复方案结构清晰，有不可删减段落与修改位置表；存在 1 处禁止词歧义 |
| §5 验收标准可执行可验证 | ✅ 通过 | AC1-1～AC1-6、AC2-1～AC2-4 均有 grep/查看/人工抽查等验收方式；5.3 综合验收有端到端验证要求 |

### 1.2 §4 禁止词检查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 可选、可考虑、后续、待定、酌情、视情况、后续迭代 | ⚠️ 待修正 | §4.1.4.3 修改位置表第 170 行「tddSteps 为**可选**字段」——禁止词表中「可选」意在模糊决策；此处为 schema 术语（optional field）。严格按字面，§4 中出现「可选」，建议改为「tddSteps 可为空或省略」以避免触发禁止词检查 |
| 既有问题可排除、与本次无关 | ✅ 通过 | 仅 §2 根因分析中引用（描述现状），§4/§7 未用于排除失败用例的表述 |

### 1.3 §4 与 §7 一致性

| 映射关系 | 结果 | 说明 |
|----------|------|------|
| 4.1.1 → T1、T3、T4 | ✅ 通过 | 阻塞约束段落完整映射 |
| 4.1.2 → T2 | ✅ 通过 | 自检段完整映射 |
| 4.1.3 → T5 | ✅ 通过 | TDD 顺序验证完整映射 |
| 4.1.4.1 → T4a | ✅ 通过 | prd schema 扩展一致 |
| 4.1.4.2 → T4b | ✅ 通过 | progress 模板预填一致 |
| 4.2.1 → T6 | ✅ 通过 | 回归强制规则一致 |
| 4.2.2 → T7 | ✅ 通过 | 强制步骤一致 |
| 4.2.3 → T8 | ✅ 通过 | 禁止词结论绑定一致 |
| 4.3 表 bmad-bug-assistant | ✅ 通过 | T6–T8 覆盖 Stage 4 审计 prompt/流程/结论，含 bmad-bug-assistant 共用模板场景 |

### 1.4 4.1.4 与 T4a、T4b 映射

| 子项 | 结果 | 说明 |
|------|------|------|
| 4.1.4.1 tddSteps schema | ✅ 通过 | JSON 示例、involvesProductionCode、phase 顺序明确；与 T4a 验收标准一致 |
| 4.1.4.2 progress 模板预填 | ✅ 通过 | 预填槽位格式、_pending_ 替换规则明确；与 T4b 验收标准一致 |
| 4.1.4.3 修改位置 | ⚠️ 见 1.5 | 路径存在可操作性 gap |

### 1.5 修改路径可操作性

| 任务 | 路径 | 结果 | 说明 |
|------|------|------|------|
| T4a | skills/ralph-method/SKILL.md | ⚠️ 未通过 | 本项目 skills/ 下**无 ralph-method 目录**（glob 仅找到 bmad-story-assistant、speckit-workflow 等 15 个 SKILL.md）。ralph-method 可能位于 ~/.cursor/skills/ 全局目录，项目内路径失效，实施时无法按「skills/ralph-method/SKILL.md」执行 |
| T4b | bmad-story-assistant / speckit-workflow | ⚠️ 待细化 | 未指定具体文件（SKILL.md 某节 或 references/task-execution-tdd.md）及行号；progress 生成逻辑的归属（谁从 prd/tasks 生成 progress）未明确，可操作性不足 |
| T5–T8 | _bmad 下 / code-reviewer 传入 prompt | ⚠️ 待细化 | 「Stage 4 审计模板」「Stage 4 审计 prompt」「Stage 4 审计流程文档」未给出 _bmad 或 skills 下的具体路径。bmad-bug-assistant 阶段四实施后审计模板在 skills/bmad-bug-assistant/SKILL.md，4.3 表已列出，但 T5–T8 未显式写 skills 路径 |

### 1.6 两问题覆盖

| 问题 | §4 对应修复 | 结果 |
|------|-------------|------|
| 问题 1：TDD 脱节 | 4.1.1 实施 prompt、4.1.2 自检、4.1.3 Stage4 TDD 验证、4.1.4 schema/模板 | ✅ 完整覆盖 |
| 问题 2：回归责任逃逸 | 4.2.1 回归规则嵌入、4.2.2 强制步骤、4.2.3 禁止词绑定 | ✅ 完整覆盖 |

### 1.7 验收可执行性

| 验收 ID | 验收方式 | 结果 | 说明 |
|---------|----------|------|------|
| AC1-1 | grep -E "未完成步骤 1.–2 之前\|禁止所有任务完成后集中补写" skills/ | ⚠️ 模式笔误 | 「1.–2」中「.» 匹配任意字符，可能匹配「1-2」「1.2」等；4.1.1 正文为「1–2」（en-dash）。建议 AC1-1 写为「1.?2」或「1-2」以确保与正文一致 |
| AC1-2 | grep -E "\[TDD-RED\].*\[TDD-GREEN\]\|RED.*须在.*GREEN.*之前" | ✅ 可执行 | 模式明确 |
| AC1-3 | 查看 Stage 4 审计模板，含「事后补写」 | ✅ 可执行 | 需人工定位模板路径 |
| AC1-4 | 人工抽查 progress | ✅ 可执行 | |
| AC1-5 | 查看 ralph-method SKILL.md 或 prd.json | ⚠️ 路径依赖 | 若 skills/ralph-method 不存在，无法查看项目内文件 |
| AC1-6 | 新生成的 progress 含预填 TDD 槽位 | ✅ 可执行 | |
| T4a、T4b | 见 §7 验收列 | ✅ 可执行 | 生成产物可验证 |

### 1.8 与前置文档一致性

| 对照项 | 结果 | 说明 |
|--------|------|------|
| ralph-method | ✅ 通过 | prd/progress、US 顺序、tddSteps 与 ralph-method 约定一致 |
| speckit-workflow | ✅ 通过 | task-execution-tdd.md 有 WRITE test → RUN → ASSERT FAIL 顺序，与 §4.1.1 阻塞约束一致 |
| bmad-bug-assistant | ✅ 通过 | 禁止词表、正式排除规定、回归失败须修或记，与 §4.2 一致 |
| bmad-story-assistant | ✅ 通过 | §3.2 TDD 红绿灯、stage4 审计路径约定与 §4 一致 |

---

## 2. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、§4 与 §7 映射完整性、禁止词、4.1.4 设计可操作性、行号/路径漂移。

**每维度结论**：

- **遗漏需求点**：两问题（TDD 脱节、回归责任逃逸）在 §4 中均有对应修复；4.1.1–4.1.4、4.2.1–4.2.3 覆盖根因分解表各层。无遗漏。
- **边界未定义**：4.1.4 中 involvesProductionCode=true/false 的判定（「按 tasks 判断是否涉及生产代码」）未给出判定规则（如「tasks 中含验收命令且修改生产代码路径」）；4.2.2「实施前已存在」的用例集如何获取（基线快照、git 范围）未定义。存在边界未完全定义。
- **验收不可执行**：AC1-1 grep 模式「1.–2」与正文「1–2」可能有匹配歧义；AC1-5、T4a 依赖 skills/ralph-method 存在，项目内缺失时无法执行。部分验收存在前置条件未满足风险。
- **与前置文档矛盾**：§4 与 ralph-method、speckit-workflow、bmad-bug-assistant 技能约定无矛盾。
- **§4 与 §7 映射完整性**：4.1.1–4.2.3 均有对应任务；T4a、T4b 与 4.1.4.1、4.1.4.2 一致。完整。
- **禁止词**：§4.1.4.3「tddSteps 为可选字段」中含「可选」。禁止词表禁止「可选、可考虑」等模糊表述。虽为 schema 术语，严格按规则应修改，避免审计工具误判。
- **4.1.4 设计可操作性**：4.1.4.1 的 prd 生成逻辑「按 tasks 判断是否涉及生产代码」——谁执行判断、在何种时机、输出格式，已给出 JSON 示例，可操作。4.1.4.2 progress 预填——T4b 修改路径「bmad-story-assistant / speckit-workflow」未指定具体文件与段落，实施时需二次定位。
- **行号/路径漂移**：T4a 路径 skills/ralph-method/SKILL.md 在本项目中**不存在**；T5–T8 的「_bmad 下 Stage 4 审计步骤」未给出 _bmad 内具体子路径（_bmad 存在，但 Stage 4 审计主要由 skills 内 bmad-bug-assistant、bmad-story-assistant 传入 code-reviewer prompt 实现）。路径部分失效或不够具体。

**本轮 gap 结论**：**本轮存在 gap**。具体项：

1. **GAP-PATH-T4A**：T4a 修改路径 skills/ralph-method/SKILL.md 在本项目中不存在；须在 §4.3 或 §7 中注明 ralph-method 的可能位置（如 ~/.cursor/skills/ralph-method/ 或项目内克隆路径），或标注「若项目内无 ralph-method，须先引入或使用全局 skill 路径」。
2. **GAP-PROHIBITED-OPTIONAL**：§4.1.4.3「tddSteps 为可选字段」含禁止词「可选」；建议改为「tddSteps 可为空或省略；无 tddSteps 时按原逻辑执行」。
3. **GAP-PATH-T4B**：T4b 修改路径「bmad-story-assistant / speckit-workflow」未指定具体文件（如 skills/bmad-story-assistant/SKILL.md 第 X 节、skills/speckit-workflow/references/task-execution-tdd.md）；须在 §7 或 4.3 表中补充具体路径或段落锚点。
4. **GAP-PATH-T5T8**：T5–T8 的「Stage 4 审计模板/prompt/流程/结论判定」须明确对应 skills/bmad-bug-assistant/SKILL.md 的阶段四实施后审计模板（及 bmad-story-assistant 的 stage4 段落，若 Story 审计共用），便于实施时精确定位。
5. **GAP-AC1-1-PATTERN**：AC1-1 的 grep 模式「1.–2」建议改为「1-2」或「1–2」以与 4.1.1 正文一致，避免正则歧义。

---

## 3. 修改建议

| 优先级 | Gap ID | 修改内容 |
|--------|--------|----------|
| P0 | GAP-PROHIBITED-OPTIONAL | §4.1.4.3 表中将「tddSteps 为可选字段」改为「tddSteps 可为空或省略；无 tddSteps 时按原逻辑执行」 |
| P0 | GAP-PATH-T4A | §4.3 表及 T4a 增加路径说明：若项目内无 skills/ralph-method，注明使用 ~/.cursor/skills/ralph-method/SKILL.md 或等价路径 |
| P1 | GAP-PATH-T4B | T4b 及 4.3 表补充：skills/bmad-story-assistant/SKILL.md（prd/progress 生成相关段）、skills/speckit-workflow/SKILL.md 或 references/task-execution-tdd.md |
| P1 | GAP-PATH-T5T8 | T5–T8 修改路径补充：skills/bmad-bug-assistant/SKILL.md 阶段四实施后审计模板（BUG-A4-POSTAUDIT）、及 bmad-story-assistant stage4 审计段落（若共用） |
| P2 | GAP-AC1-1-PATTERN | AC1-1 验收方式将 grep 模式改为「1-2」或「1–2」，与 4.1.1 正文一致 |

---

## 4. 结论

**未通过**。存在 5 项 gap。审计子代理已按 audit-document-iteration-rules 在**本轮内直接修改 BUGFIX 文档**以消除 gap，修改项如下：

| 修改项 | 修改内容 |
|--------|----------|
| GAP-PROHIBITED-OPTIONAL | §4.1.4.3 表中「tddSteps 为可选字段」→「tddSteps 可为空或省略」 |
| GAP-PATH-T4A | §4.3 表、T4a 路径补充「（若项目内无则用 ~/.cursor/skills/ralph-method/SKILL.md）」 |
| GAP-PATH-T4B | 4.1.4.3 表、4.3 表、T4b 路径细化为 skills/bmad-story-assistant/SKILL.md、speckit-workflow 具体路径 |
| GAP-PATH-T5T8 | 4.3 表、T5 路径细化为 skills/bmad-bug-assistant、bmad-story-assistant 的 stage4 段落 |
| GAP-AC1-1-PATTERN | AC1-1 grep 模式「1.–2」→「1[-–]2」以同时匹配 hyphen 与 en-dash |

**建议**：主 Agent 收到本报告后发起第 2 轮审计，验证修改后的 BUGFIX 文档。严格模式要求连续 3 轮无 gap 后收敛。

**iteration_count**：1（本轮未通过；已直接修改文档）

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: C

维度评分:
- 功能性: 78/100
- 代码质量: 75/100
- 测试覆盖: 80/100
- 安全性: 85/100
