# TASKS 审计报告：评测 Agent 改进（五层架构与目标模型分离）

**审计对象**：`_bmad-output/implementation-artifacts/_orphan/TASKS_评测Agent改进_五层架构与目标模型分离.md`  
**需求依据**：`scoring/eval-questions/EVAL_AGENT_BMAD_FLOW_IMPROVEMENT.md`  
**相关代码**：`scoring/eval-questions/agent-answer.ts`、`scripts/eval-questions-cli.ts`  
**审计日期**：2026-03-07  
**轮次**：第 1 轮

---

## 1. 需求覆盖分析

### 1.1 EVAL_AGENT_BMAD_FLOW_IMPROVEMENT.md P0/P1 改进项

| 改进项 | 优先级 | TASKS 覆盖 | 对应任务 |
|--------|--------|------------|----------|
| 目标模型分离（EVAL_TARGET_*） | P0 | ✅ 覆盖 | T1 |
| 五层架构全流程上下文注入（精简版） | P0 | ✅ 覆盖 | T2 |
| 批判审计员格式强化 | （合并至 P0） | ✅ 覆盖 | T2（含批判审计员结论格式与占比） |
| 题目 framing 强化 | P1 | ✅ 覆盖 | T3 |

### 1.2 改进文档验收标准 vs TASKS §4 验收标准

| 改进文档验收项 | TASKS §4 | 结论 |
|----------------|----------|------|
| 设置 EVAL_TARGET_* 后作答调用目标模型 API | ✅ 有 | 一致 |
| system prompt 含五层架构全流程概览与核心约束 | ✅ 有 | 一致 |
| 批判审计员结论含已检查维度、每维度结论、本轮结论及占比 | ✅ T2 含 | 一致 |
| user message 含「按 BMAD-speckit-SDD 五层架构全流程规范作答」 | ✅ 有 | 一致 |
| 目标模型作答后 parseAndWriteScore 可成功解析 | ✅ T5 端到端 | 一致 |

**需求覆盖结论**：P0、P1 改进项均被 TASKS 覆盖，无遗漏。

---

## 2. 任务可执行性分析

| 任务 | 描述明确 | 验收标准可量化 | 验收命令可执行 | 备注 |
|------|----------|----------------|----------------|------|
| T1 | ✅ | ✅ | ✅ | 单测路径 `scoring/eval-questions/__tests__/agent-answer.test.ts` 需新增，任务已说明 |
| T2 | ✅ | ⚠️ 人工检查 | ✅ | 「人工检查 agent-answer.ts」可执行，但不可自动化 |
| T3 | ✅ | ⚠️ 人工检查 | ✅ | 同上 |
| T4 | ✅ | ✅ | ⚠️ 见 GAP | §9 中 T4 验收命令 `--id q005` 在 manifest 中不存在 |
| T5 | ✅ | ✅ | ✅ | 需配置 API key，命令可执行 |

---

## 3. 与前置文档一致性

- **目标模型分离**：改进文档与 TASKS 均要求 EVAL_TARGET_* 优先、回退 SCORING_LLM_*，一致。
- **五层架构注入**：T2 引用「EVAL_AGENT_BMAD_FLOW_IMPROVEMENT.md §2 建议注入内容」，改进文档 §2 含完整五层架构与批判审计员格式，一致。
- **题目 framing**：T3 与改进文档 §4 的 user message 改进一致。
- **CLI 参数**：改进文档要求 `--target-model`、`--target-base-url` 等；T1 明确四参数，一致。

---

## 4. 边界与异常

| 场景 | TASKS 描述 | 结论 |
|------|------------|------|
| EVAL_TARGET_* 未设置 | 回退 SCORING_LLM_* | ✅ 明确 |
| 两者均未设置 | 错误信息「SCORING_LLM_API_KEY 或 EVAL_TARGET_API_KEY 未设置」 | ✅ T4 明确 |
| 目标模型 API 失败（如 401） | 错误信息含「目标模型」区分（可选） | ✅ T4 标注可选 |
| EVAL_TARGET_API_KEY 为判定键 | 讨论纪要第 38 轮约定 | ⚠️ T1 描述未显式写出 |
| CLI --target-* 覆盖 | 四参数均支持 | ✅ 明确 |
| --no-agent 模式 | 不受 EVAL_TARGET_* 影响 | ✅ 讨论纪要第 65–66 轮 |

---

## 5. 依赖关系

| 任务 | 依赖 | 可并行 | 结论 |
|------|------|--------|------|
| T1 | 无 | 与 T2、T3 | ✅ 正确 |
| T2 | 无 | 与 T1、T3 | ✅ 正确 |
| T3 | 无 | 与 T1、T2 | ✅ 正确 |
| T4 | T1 | 须 T1 完成后 | ✅ 正确（回退逻辑在 T1 中实现） |
| T5 | T1–T4 | 须全部完成后 | ✅ 正确（端到端验收） |

---

## 6. 遗漏需求点核查

经逐项对照改进文档与 TASKS：

- 改进文档 §3「批判审计员格式强化」：要求引用 audit-prompts-critical-auditor-appendix 的必填结构。T2 将批判审计员格式合并到五层架构注入中，讨论纪要第 25–26 轮明确 P0 采用精简版、不加载外部文件。T2 验收标准含「批判审计员结论格式与占比说明」，已覆盖。
- P2「从项目加载真实文档」：已列入 §6 Deferred GAPs，正确排除。
- 改进文档验收标准「parseAndWriteScore 可成功解析」：T5 端到端验收已覆盖。

**结论**：无 P0/P1 遗漏。

---

## 批判审计员结论

**说明**：本段落为批判审计员独立结论，按 audit-prompts §4 要求，字数与条目数不少于报告其余部分的 60%。

### 已检查维度

1. **遗漏需求点**
2. **边界未定义**
3. **验收不可执行**
4. **与前置文档矛盾**
5. **依赖关系错误**
6. **任务描述歧义**

### 每维度结论

#### 1. 遗漏需求点

- **检查**：逐项对照 EVAL_AGENT_BMAD_FLOW_IMPROVEMENT.md 改进方案概览、实施优先级、验收标准与 TASKS §7 任务表。
- **结论**：**通过**。P0 目标模型分离、P0 五层架构注入、P1 题目 framing 均有对应任务（T1、T2、T3）。批判审计员格式强化已合并至 T2。P2 已列入 Deferred。改进文档验收标准五项均被 TASKS §4 或 T5 覆盖。

#### 2. 边界未定义

- **检查**：EVAL_TARGET_* 与 SCORING_LLM_* 回退逻辑、CLI 参数、错误提示、部分设置（如仅设 API_KEY 不设 BASE_URL）时的行为。
- **结论**：**未通过**。讨论纪要第 36–38 轮约定「EVAL_TARGET_API_KEY 为是否使用目标模型的判定键；有则走目标模型，无则回退」。T1 任务描述仅写「优先读取 EVAL_TARGET_*，未设置时回退」，未明确「EVAL_TARGET_API_KEY 为判定键」。若实施者按「任一 EVAL_TARGET_* 设置则用目标模型」理解，则仅设 EVAL_TARGET_BASE_URL 不设 API_KEY 时行为会产生歧义（第 36 轮说缺项用 SCORING_LLM_* 补全，第 38 轮说 API_KEY 为判定键，两者需统一）。**GAP**：T1 描述应补充「EVAL_TARGET_API_KEY 为判定键；仅当 EVAL_TARGET_API_KEY 已设置时才使用目标模型，缺项用 SCORING_LLM_* 对应项补全」。

#### 3. 验收不可执行

- **检查**：T1–T5 验收命令是否可实际执行、是否存在无效 id、单测路径是否存在。
- **结论**：**未通过**。§9 验收命令汇总中 T4 部分写「无 API key 时：`npx ts-node scripts/eval-questions-cli.ts run --id q005 --version v1`」。经查 `scoring/eval-questions/v1/manifest.yaml`，题目 id 为 `q001`、`q002`、`q003`、`q004`、`gen-*`、`q005-defect-critical-auditor-ratio`，**无 `q005`**。使用 `--id q005` 会触发「题目 q005 在版本 v1 中不存在」并 exit 1，无法验证「Agent 作答失败时的错误提示」场景（因在加载题目前不会调用 generateEvalAnswer）。**GAP**：§9 T4 验收命令应将 `--id q005` 改为 `--id q005-defect-critical-auditor-ratio` 或 `--id q001` 等 manifest 中存在的 id，以便命令能执行到 Agent 调用阶段并触发 EvalAgentError。

#### 4. 与前置文档矛盾

- **检查**：TASKS 与 EVAL_AGENT_BMAD_FLOW_IMPROVEMENT.md 的表述、优先级、验收标准是否一致。
- **结论**：**通过**。目标模型分离、五层架构、题目 framing、CLI 参数、EVAL_TARGET_TIMEOUT_MS 默认 120000 等均一致。改进文档 §3 批判审计员格式与 T2 合并处理，无矛盾。

#### 5. 依赖关系错误

- **检查**：T4 依赖 T1、T5 依赖 T1–T4 是否合理；T1–T3 可并行是否成立。
- **结论**：**通过**。T4 错误提示与回退逻辑依赖 T1 实现的 EVAL_TARGET_* 读取与回退链，依赖正确。T5 端到端验收依赖全部前置任务，正确。T1、T2、T3 分别修改 agent-answer.ts 的不同部分（配置读取、system prompt、user message），无交叉依赖，可并行成立。

#### 6. 任务描述歧义

- **检查**：T1–T5 描述是否存在歧义、多义或不可操作表述。
- **结论**：**通过**。各任务描述具体，可操作。T2「按 EVAL_AGENT_BMAD_FLOW_IMPROVEMENT.md §2 建议注入内容实施」有明确引用。T4「错误信息含『目标模型』等区分（可选）」的「可选」表述清晰。唯一歧义为 T1 判定键（见维度 2），已记为 gap。

### 本轮结论

**本轮存在 gap，不计数。**

**GAP 列表**：

1. **T1 判定键未显式化**：T1 任务描述未明确「EVAL_TARGET_API_KEY 为是否使用目标模型的判定键」。建议在 T1 描述中补充该约定，避免实施时与讨论纪要第 36 轮「任一 EVAL_TARGET_* 设置」产生歧义。
2. **§9 T4 验收命令 id 无效**：§9 中 T4 验收命令使用 `--id q005`，manifest 中无此 id。建议改为 `--id q005-defect-critical-auditor-ratio` 或 `--id q001`，确保命令能执行到 Agent 调用阶段。

**修改建议**：

- 在 T1 描述中增加一句：「EVAL_TARGET_API_KEY 为判定键；仅当该变量已设置时才使用目标模型，缺项（BASE_URL、MODEL、TIMEOUT_MS）用 SCORING_LLM_* 对应项补全。」
- 在 §9 T4 验收命令中，将 `--id q005` 改为 `--id q005-defect-critical-auditor-ratio`。

---

## 可解析评分块（供 parseAndWriteScore）

```markdown
## 可解析评分块（供 parseAndWriteScore）

总体评级: B

维度评分:
- 需求完整性: 95/100
- 可测试性: 75/100
- 一致性: 95/100
- 可追溯性: 90/100
```

---

## 结论

**总体结论**：**未通过**。

**理由**：批判审计员检查发现 2 项 gap：（1）T1 未明确 EVAL_TARGET_API_KEY 为判定键；（2）§9 T4 验收命令使用不存在的题目 id `q005`。两项均影响可执行性与边界清晰度。

**本轮结论**：本轮存在 gap，不计数。建议按修改建议修订 TASKS 后进入第 2 轮审计。
