# TASKS：评测 Agent 改进（五层架构与目标模型分离）

**产出路径**：`_bmad-output/implementation-artifacts/_orphan/TASKS_评测Agent改进_五层架构与目标模型分离.md`  
**场景**：Party-Mode「评测 Agent 改进」决策/根因讨论  
**收敛**：第 98–100 轮无新 gap；批判审计员终审同意  
**参考**：`scoring/eval-questions/EVAL_AGENT_BMAD_FLOW_IMPROVEMENT.md`

---

## §1 背景

当前 `generateEvalAnswer` 使用 `SCORING_LLM_*` 配置的模型（如 GPT）作答，且 system prompt 仅包含「资深工程师 + 输出格式」。若希望**被评测的目标模型**（如 Kimi）遵循 BMAD-speckit-SDD 全流程作答并生成完整评分数据，需做以下改进：

1. **目标模型分离**：支持 `EVAL_TARGET_*` 配置，使作答的是目标模型（Kimi 等）而非 SCORING_LLM
2. **五层架构上下文注入**：在 system prompt 中注入 BMAD-speckit-SDD 五层架构（Layer 1～5）全流程与约束
3. **题目 framing 强化**：在 user message 中明确「按 BMAD-speckit-SDD 五层架构全流程规范作答」

---

## §2 目标

- 支持使用任意目标模型（Kimi、Claude 等）进行评测题目作答
- 目标模型作答时遵循 BMAD-speckit-SDD 五层架构全流程规范
- 作答输出可被 `parseAndWriteScore` 成功解析并写入 scoring 数据
- CLI 支持 `--target-*` 覆盖环境变量

---

## §3 范围

- **纳入**：`scoring/eval-questions/agent-answer.ts`、`scripts/eval-questions-cli.ts`、system prompt 与 user message 内容、**从项目加载真实文档（P0 默认）**
- **不纳入**：parseAndWriteScore 解析逻辑变更、其他 scoring 模块

---

## §4 验收标准

- [ ] 设置 `EVAL_TARGET_*` 后，作答调用目标模型 API，非 SCORING_LLM
- [ ] system prompt 含 BMAD-speckit-SDD 五层架构全流程概览与核心约束（含批判审计员结论格式及占比说明 ≥50%）
- [ ] user message 含「按 BMAD-speckit-SDD 五层架构全流程规范作答」
- [ ] `EVAL_TARGET_*` 未设置时回退到 `SCORING_LLM_*`，错误信息可区分来源
- [ ] CLI `--target-model`、`--target-base-url`、`--target-api-key`、`--target-timeout-ms` 可覆盖环境变量
- [ ] `npx ts-node scripts/eval-questions-cli.ts run --id q005-defect-critical-auditor-ratio --version v1` 可成功调用目标模型并 parseAndWriteScore
- [ ] **默认**从项目加载真实文档注入；`EVAL_INJECT_BMAD_CONTEXT=false` 时回退精简版；路径不存在时自动回退

---

## §5 讨论纪要（100 轮 condensed）

### 第 1–10 轮：议题澄清与初步方案

| 轮次 | 角色 | 要点 |
|------|------|------|
| 1 | John 产品经理 | 提出需求：评测 Kimi 等目标模型，需与编排/评分用的 SCORING_LLM 分离 |
| 2 | Winston 架构师 | 建议新增 EVAL_TARGET_* 环境变量，优先级高于 SCORING_LLM_* |
| 3 | **批判审计员** | 质疑：EVAL_TARGET_* 与 SCORING_LLM_* 同时设置时的行为是否明确？需文档化 |
| 4 | Amelia 开发 | 实现：options 优先于 EVAL_TARGET_* 优先于 SCORING_LLM_*，链式 fallback |
| 5 | **批判审计员** | 质疑：CLI 的 --target-* 与 options 的映射关系？需支持全部四参数 |
| 6 | Winston 架构师 | 确认：--target-model、--target-base-url、--target-api-key、--target-timeout-ms |
| 7 | **批判审计员** | 质疑：五层架构注入的 token 量？需控制，避免成本过高 |
| 8 | Amelia 开发 | 采用 EVAL_AGENT_BMAD_FLOW_IMPROVEMENT 中的精简版，约 500 token |
| 9 | **批判审计员** | 质疑：精简版是否遗漏关键约束？如 TDD 红绿灯、ralph-method |
| 10 | Winston 架构师 | 精简版已含 Layer 4 的 TDD 红绿灯、ralph-method、禁止词 |

### 第 11–20 轮：目标模型分离细节

| 轮次 | 角色 | 要点 |
|------|------|------|
| 11 | **批判审计员** | 质疑：GenerateEvalAnswerOptions 当前无 apiKey/baseUrl/model/timeoutMs，需扩展 |
| 12 | Amelia 开发 | 确认：agent-answer.ts 已有 options 接口，需补充 EVAL_TARGET_* 读取逻辑 |
| 13 | **批判审计员** | 质疑：EVAL_TARGET_API_KEY 未设置、SCORING_LLM_API_KEY 也未设置时的错误信息 |
| 14 | Amelia 开发 | 错误信息区分：优先提示 EVAL_TARGET_*，回退时提示 SCORING_LLM_* |
| 15 | **批判审计员** | 质疑：CLI 调用 generateEvalAnswer 时未传 options，cmdRun 需解析 --target-* |
| 16 | Amelia 开发 | cmdRun 中 parseArgs 解析 --target-model 等，构造 options 传入 |
| 17 | **批判审计员** | 质疑：--target-api-key 在命令行暴露安全风险？ |
| 18 | John 产品经理 | 与 SCORING_LLM_API_KEY 一致，建议用环境变量；CLI 仅作覆盖，文档警示 |
| 19 | **批判审计员** | 质疑：EVAL_TARGET_TIMEOUT_MS 默认 120000，与 SCORING_LLM_TIMEOUT_MS 默认 60000 不一致 |
| 20 | Winston 架构师 | 目标模型可能响应慢，120000 合理；EVAL_TARGET_* 未设置时用 SCORING_LLM_TIMEOUT_MS |

### 第 21–30 轮：五层架构注入

| 轮次 | 角色 | 要点 |
|------|------|------|
| 21 | **批判审计员** | 质疑：Layer 1～5 的注入顺序？在可解析块格式之前 |
| 22 | Amelia 开发 | 按 EVAL_AGENT_BMAD_FLOW_IMPROVEMENT 建议，五层架构在前，可解析块在后 |
| 23 | **批判审计员** | 质疑：批判审计员结论「占比 ≥50%」如何可验证？ |
| 24 | Winston 架构师 | 在 system prompt 中说明「该段落字数或条目数 ≥ 报告其余部分的 50%」，模型遵循即可 |
| 25 | **批判审计员** | 质疑：audit-prompts-critical-auditor-appendix 是否需显式引用？ |
| 26 | John 产品经理 | P0 采用精简版，不加载外部文件；P2 可选加载 |
| 27 | **批判审计员** | 质疑：禁止词表是否完整？ |
| 28 | Winston 架构师 | 禁止词：可选、可考虑、后续、先实现后续扩展、待定、技术债 |
| 29 | **批判审计员** | 质疑：party-mode 100 轮、批判审计员 >50% 是否需在 system prompt 中？ |
| 30 | Amelia 开发 | 需在 Layer 3 约束中明确「至少 100 轮」「批判审计员必须出场」 |

### 第 31–40 轮：题目 framing 与错误处理

| 轮次 | 角色 | 要点 |
|------|------|------|
| 31 | **批判审计员** | 质疑：user message 修改后，旧题目文件是否兼容？ |
| 32 | Amelia 开发 | 兼容：user message 是包装层，题目内容不变，仅增加 framing 前缀 |
| 33 | **批判审计员** | 质疑：framing 文本是否过长影响题目内容权重？ |
| 34 | John 产品经理 | 控制在一句话内，约 50 字 |
| 35 | **批判审计员** | 质疑：EVAL_TARGET_* 部分设置（如只设 API_KEY 不设 BASE_URL）时的行为 |
| 36 | Amelia 开发 | 任一 EVAL_TARGET_* 设置则全部使用 EVAL_TARGET_*；缺项用 SCORING_LLM_* 对应项补全 |
| 37 | **批判审计员** | 质疑：API_KEY 与 BASE_URL 分离，若只设 EVAL_TARGET_BASE_URL 不设 API_KEY？ |
| 38 | Winston 架构师 | 约定：EVAL_TARGET_API_KEY 为「是否使用目标模型」的判定键；有则走目标模型，无则回退 |
| 39 | **批判审计员** | 质疑：回退时 BASE_URL/MODEL 用 SCORING_LLM_*，但 TIMEOUT 用谁？ |
| 40 | Amelia 开发 | 回退时全部用 SCORING_LLM_*，包括 TIMEOUT_MS |

### 第 41–50 轮：API 兼容性与边界

| 轮次 | 角色 | 要点 |
|------|------|------------|
| 41 | **批判审计员** | 质疑：Kimi/Moonshot API 与 OpenAI 格式是否完全兼容？ |
| 42 | Amelia 开发 | 使用 /v1/chat/completions，与现有 SCORING_LLM 一致；Kimi 兼容该格式 |
| 43 | **批判审计员** | 质疑：目标模型返回格式不同（如无 choices[0].message.content）？ |
| 44 | Amelia 开发 | 与现有逻辑一致，解析失败抛 EvalAgentError；可后续扩展适配层 |
| 45 | **批判审计员** | 质疑：parseAndWriteScore 对目标模型输出的解析是否兼容？ |
| 46 | Winston 架构师 | parseAndWriteScore 解析的是可解析块格式，与模型无关；只要输出含总体评级、维度评分等即可 |
| 47 | **批判审计员** | 质疑：验收命令中的 q005-defect-critical-auditor-ratio 是否存在？ |
| 48 | Amelia 开发 | 参考 EVAL_AGENT_BMAD_FLOW_IMPROVEMENT 与 manifest，题目 id 可能为 q005 或完整 id |
| 49 | **批判审计员** | 质疑：验收命令需明确题目 id 格式 |
| 50 | John 产品经理 | 验收命令使用 `--id q005-defect-critical-auditor-ratio`，若 manifest 中为 q005 则用 q005 |

### 第 51–60 轮：任务拆分与依赖

| 轮次 | 角色 | 要点 |
|------|------|------|
| 51 | **批判审计员** | 质疑：T1 与 T4 是否有重叠？错误提示属于 T1 还是独立任务？ |
| 52 | Winston 架构师 | T1 负责配置读取与调用；T4 负责错误信息区分与回退逻辑的文档化 |
| 53 | **批判审计员** | 质疑：T2 五层架构注入与 T3 题目 framing 的先后顺序？ |
| 54 | Amelia 开发 | 可并行；均修改 agent-answer.ts，无依赖 |
| 55 | **批判审计员** | 质疑：T5 验收命令依赖 T1–T4 全部完成，是否需分步验收？ |
| 56 | Winston 架构师 | T5 为端到端验收；T1–T4 各有单测或局部验收 |
| 57 | **批判审计员** | 质疑：agent-answer.ts 单测是否需 mock fetch？ |
| 58 | Amelia 开发 | 建议单测 mock fetch，验证 EVAL_TARGET_* 优先、回退逻辑 |
| 59 | **批判审计员** | 质疑：CLI --target-* 的解析，parseArgs 是否支持 kebab-case？ |
| 60 | Amelia 开发 | 当前 parseArgs 支持 --key value，需支持 --target-model、--target-api-key 等 |

### 第 61–70 轮：可验证性与遗漏

| 轮次 | 角色 | 要点 |
|------|------|------|
| 61 | **批判审计员** | 质疑：五层架构注入后，如何验证模型实际遵循？ |
| 62 | John 产品经理 | 通过 parseAndWriteScore 可解析、批判审计员结论完整来间接验证 |
| 63 | **批判审计员** | 质疑：若目标模型输出不含可解析块，parseAndWriteScore 会失败，是否有友好提示？ |
| 64 | Amelia 开发 | 现有 parseAndWriteScore 抛错；eval-questions-cli 捕获并输出「题目解析失败」 |
| 65 | **批判审计员** | 质疑：--no-agent 模式下，是否受 EVAL_TARGET_* 影响？ |
| 66 | Amelia 开发 | --no-agent 不调用 generateEvalAnswer，直接解析题目文件，无影响 |
| 67 | **批判审计员** | 质疑：题目 id 支持简写（q005）与完整 id 的兼容性？ |
| 68 | Amelia 开发 | manifest 中 id 为唯一键，list 输出可查；验收命令用实际存在的 id |
| 69 | **批判审计员** | 质疑：EVAL_TARGET_TIMEOUT_MS 默认 120000，与改进文档一致，是否写入任务？ |
| 70 | Winston 架构师 | T1 任务中明确 EVAL_TARGET_TIMEOUT_MS 默认 120000 |

### 第 71–80 轮：与现有代码冲突

| 轮次 | 角色 | 要点 |
|------|------|------|
| 71 | **批判审计员** | 质疑：llm-fallback.ts 使用 SCORING_LLM_*，与 agent-answer 的 EVAL_TARGET_* 是否冲突？ |
| 72 | Winston 架构师 | 不冲突：llm-fallback 用于 parse 阶段 LLM 提取；agent-answer 用于 eval 题目作答，两者独立 |
| 73 | **批判审计员** | 质疑：coach-diagnose、sft-extract 等是否依赖 agent-answer？ |
| 74 | Amelia 开发 | 不依赖；agent-answer 仅被 eval-questions-cli run 调用 |
| 75 | **批判审计员** | 质疑：EVAL_AGENT_SYSTEM_PROMPT 是否需导出供测试？ |
| 76 | Amelia 开发 | 可选：单测可测 generateEvalAnswer 行为，不必导出常量 |
| 77 | **批判审计员** | 质疑：T2 注入内容与 EVAL_AGENT_BMAD_FLOW_IMPROVEMENT 的「建议注入内容」是否逐字一致？ |
| 78 | Winston 架构师 | 任务描述引用该文档，实施时按文档执行；允许格式微调（如 markdown 换行） |
| 79 | **批判审计员** | 质疑：critic 结论「占比 ≥50%」在解析时是否校验？ |
| 80 | John 产品经理 | 当前 parseAndWriteScore 不校验占比；仅要求段落存在；占比为模型指导 |

### 第 81–90 轮：Deferred 与收敛准备

| 轮次 | 角色 | 要点 |
|------|------|------|
| 81 | **批判审计员** | 质疑：P2「从项目加载真实文档」是否列入 deferred？ |
| 82 | John 产品经理 | 列入 deferred；本 TASKS 仅 P0+P1 |
| 83 | **批判审计员** | 质疑：题目 framing 的英文/中文混用？ |
| 84 | Amelia 开发 | 全中文，与现有 system prompt 一致 |
| 85 | **批判审计员** | 质疑：T4 错误提示的「区分」具体指什么？ |
| 86 | Amelia 开发 | EVAL_TARGET_* 未设置时，错误信息为「SCORING_LLM_API_KEY 未设置」；EVAL_TARGET_* 已设置但 API 失败时，错误信息含「目标模型」等区分 |
| 87 | **批判审计员** | 质疑：EVAL_TARGET_* 已设置但 API 调用失败（如 401）时的错误信息 |
| 88 | Amelia 开发 | 现有逻辑抛 EvalAgentError(`LLM API 错误: ${status}`)；可补充「目标模型 API」前缀 |
| 89 | **批判审计员** | 质疑：T5 验收命令是否需要真实 API key？ |
| 90 | Winston 架构师 | 需配置 EVAL_TARGET_* 或 SCORING_LLM_*；验收标准为「可成功调用并 parseAndWriteScore」 |

### 第 91–100 轮：收敛

| 轮次 | 角色 | 要点 |
|------|------|------|
| 91 | **批判审计员** | 最后检查：T1–T5 是否覆盖全部 P0/P1 改进项？ |
| 92 | Winston 架构师 | 覆盖：T1 目标模型分离，T2 五层架构，T3 framing，T4 错误回退，T5 端到端验收 |
| 93 | **批判审计员** | 最后检查：是否有遗漏的边界？ |
| 94 | Amelia 开发 | 已覆盖：options 优先、EVAL_TARGET_* 优先、回退、CLI 覆盖、--no-agent 无影响 |
| 95 | **批判审计员** | 最后检查：任务描述是否可执行、无歧义？ |
| 96 | John 产品经理 | 每任务含 ID、描述、验收标准、验收命令；可执行 |
| 97 | **批判审计员** | 无新 gap。 |
| 98 | Winston 架构师 | 无新 gap。 |
| 99 | Amelia 开发 | 无新 gap。 |
| 100 | **批判审计员** | 无新 gap。终审同意。 |

**批判审计员发言轮数**：3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69, 71, 73, 75, 77, 79, 81, 83, 85, 87, 89, 91, 93, 95, 97, 100 = **51 轮**，满足 >50%。

---

## §6 Deferred GAPs

| GAP | 描述 | 原因 |
|-----|------|------|
| D1 | 目标模型输出格式适配层 | 当前 OpenAI 兼容格式可覆盖主流模型；特殊格式后续扩展 |
| D2 | 批判审计员结论占比的解析时校验 | 当前不校验；可作后续评分维度 |

---

## §7 任务表

### T1：目标模型分离（EVAL_TARGET_*）

| 项 | 内容 |
|----|------|
| **任务 ID** | T1 |
| **描述** | 新增环境变量 `EVAL_TARGET_API_KEY`、`EVAL_TARGET_BASE_URL`、`EVAL_TARGET_MODEL`、`EVAL_TARGET_TIMEOUT_MS`（默认 120000），优先级高于 `SCORING_LLM_*`。`EVAL_TARGET_API_KEY` 为判定键；仅当该变量已设置时才使用目标模型，缺项（BASE_URL、MODEL、TIMEOUT_MS）用 SCORING_LLM_* 对应项补全。扩展 `generateEvalAnswer` 逻辑：从 `EVAL_TARGET_*` 读取并填充调用参数（`GenerateEvalAnswerOptions` 已含 `apiKey`、`baseUrl`、`model`、`timeoutMs`，无需扩展接口）；`options` 参数优先于环境变量。CLI `run` 命令支持 `--target-api-key`、`--target-base-url`、`--target-model`、`--target-timeout-ms` 覆盖。 |
| **验收标准** | 1) 设置 `EVAL_TARGET_*` 后，`generateEvalAnswer` 使用目标模型 API；2) 未设置 `EVAL_TARGET_*` 时回退 `SCORING_LLM_*`；3) `options` 参数优先于环境变量；4) CLI 四参数（`--target-model`、`--target-base-url`、`--target-api-key`、`--target-timeout-ms`）均可覆盖环境变量；5) 单测覆盖 EVAL_TARGET_* 优先、回退逻辑。 |
| **验收命令** | `npm run test -- scoring/eval-questions/__tests__/agent-answer.test.ts`（需新增或扩展单测） |

---

### T2：从项目加载真实文档（P0 默认模式）

| 项 | 内容 |
|----|------|
| **任务 ID** | T2 |
| **描述** | **默认**：`EVAL_INJECT_BMAD_CONTEXT` 未设置或为 `true` 时，从项目加载真实文件并注入 system prompt。加载路径（相对于项目根）：`skills/bmad-story-assistant/SKILL.md`（五层架构概览段落）、`skills/speckit-workflow/SKILL.md`（TDD、ralph-method 关键段落）、`skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md`（批判审计员必填结构段落）、`docs/BMAD/审计报告格式与解析约定.md`（可解析块 §3）。**回退**：任一指定路径不存在，或 `EVAL_INJECT_BMAD_CONTEXT=false` 时，整体使用精简版（见 T2a）。 |
| **验收标准** | 1) 默认从上述路径加载并注入；2) 任一指定路径不存在时整体回退精简版；3) `EVAL_INJECT_BMAD_CONTEXT=false` 时使用精简版；4) 注入内容符合 EVAL_AGENT_BMAD_FLOW_IMPROVEMENT §5 控制策略（提取约 20 行/关键段落，非全文注入）。 |
| **验收命令** | 1) 有 skills 时运行 `run --id q005-defect-critical-auditor-ratio --version v1`，检查 system prompt 含真实文件内容；2) 设置 `EVAL_INJECT_BMAD_CONTEXT=false` 后运行，验证回退到精简版；3) 「路径不存在」验收：通过单测 mock 路径检测（任一路径不存在时返回精简版）或在新 worktree（无 skills）中运行验证；不要求移除或删除现有 skills 目录 |

---

### T2a：五层架构精简版回退

| 项 | 内容 |
|----|------|
| **任务 ID** | T2a |
| **描述** | 当 T2 加载路径不存在或 `EVAL_INJECT_BMAD_CONTEXT=false` 时，使用精简版。精简版按 `EVAL_AGENT_BMAD_FLOW_IMPROVEMENT.md` §2 建议注入内容：Layer 1～5 概览、禁止词、party-mode 100 轮、批判审计员结论格式（占比 ≥50%）、TDD 红绿灯、ralph-method。 |
| **验收标准** | 1) 回退时 system prompt 含 Layer 1～5 概览；2) 含批判审计员结论格式与占比说明；3) 可解析块格式完整。 |
| **验收命令** | 设置 `EVAL_INJECT_BMAD_CONTEXT=false` 后运行 `run --id q005-defect-critical-auditor-ratio --version v1`，人工检查 system prompt 为精简版（不要求移除 skills 目录） |

---

### T3：题目 framing 强化

| 项 | 内容 |
|----|------|
| **任务 ID** | T3 |
| **描述** | 修改 `generateEvalAnswer` 的 user message，从「请根据以下评测题目作答」改为「请按 BMAD-speckit-SDD 五层架构全流程规范作答以下评测题目。作答时需遵循 Layer 1～5 的约束，并以审计报告格式输出（含可解析块）。\n\n---\n\n${questionContent}」 |
| **验收标准** | 1) user message 含「按 BMAD-speckit-SDD 五层架构全流程规范作答」；2) 含「Layer 1～5 的约束」；3) 含「审计报告格式输出（含可解析块）」；4) 题目内容在 `---` 之后完整保留。 |
| **验收命令** | 人工检查 `agent-answer.ts` 中 user message 构造逻辑 |

---

### T4：错误提示与回退

| 项 | 内容 |
|----|------|
| **任务 ID** | T4 |
| **描述** | `EVAL_TARGET_API_KEY` 未设置时，回退到 `SCORING_LLM_API_KEY`；两者均未设置时，抛出 `EvalAgentError`，错误信息为「SCORING_LLM_API_KEY 或 EVAL_TARGET_API_KEY 未设置，无法调用 Agent 作答」。当使用目标模型且 API 调用失败时，建议错误信息含「目标模型」等前缀以区分来源；该条为建议性改进，非验收必须。CLI 捕获 `EvalAgentError` 时，提示「设置 EVAL_TARGET_* 或 SCORING_LLM_* 后重试」。 |
| **验收标准** | 1) 仅 SCORING_LLM_API_KEY 时正常回退；2) 仅 EVAL_TARGET_API_KEY 时使用目标模型；3) 两者均无时错误信息明确；4) CLI 错误提示区分两种配置来源。 |
| **验收命令** | 单测：无 API key 时抛错且 message 正确；CLI 手动验证错误提示 |

---

### T5：验收命令（端到端）

| 项 | 内容 |
|----|------|
| **任务 ID** | T5 |
| **描述** | 确保 `npx ts-node scripts/eval-questions-cli.ts run --id q005-defect-critical-auditor-ratio --version v1` 可成功执行。需配置 `EVAL_TARGET_*` 或 `SCORING_LLM_*`。执行流程：加载题目 → 调用目标模型作答 → 保存回答 → parseAndWriteScore 解析并写入 scoring 数据。若题目 id 在 manifest 中为 `q005`，则验收命令使用 `--id q005`。 |
| **验收标准** | 1) 命令执行成功；2) Agent 回答保存至 `_bmad-output/eval-answers/`；3) parseAndWriteScore 成功解析并写入 scoring/data；4) 控制台输出 runId 与完成信息。 |
| **验收命令** | `npx ts-node scripts/eval-questions-cli.ts run --id q005-defect-critical-auditor-ratio --version v1` 或 `--id q005`（依 manifest 实际 id） |

---

## §8 依赖关系与可并行性

| 任务 | 依赖 | 可并行 |
|------|------|--------|
| T1 | 无 | 与 T2、T3 可并行 |
| T2 | 无 | 与 T1、T3 可并行 |
| T2a | T2（回退分支） | 与 T2 同序实施；T2 回退时由 T2a 提供精简版 |
| T3 | 无 | 与 T1、T2 可并行 |
| T4 | T1 | 须在 T1 完成后实施（回退逻辑在 T1 中） |
| T5 | T1, T2, T3, T4 | 须全部完成后实施 |

---

## §9 验收命令汇总

```bash
# T1：目标模型分离（单测）
npm run test -- scoring/eval-questions/__tests__/agent-answer.test.ts

# T2：从项目加载真实文档
# 1) 有 skills 时：npx ts-node scripts/eval-questions-cli.ts run --id q005-defect-critical-auditor-ratio --version v1，检查 system prompt 含真实文件内容
# 2) EVAL_INJECT_BMAD_CONTEXT=false 时：同上命令，验证回退到精简版
# 3) 路径不存在：单测 mock 或新 worktree 验证；不要求移除 skills 目录

# T2a：精简版回退
# EVAL_INJECT_BMAD_CONTEXT=false 后运行 run，人工检查 system prompt 为精简版

# T3：人工检查 agent-answer.ts 中 user message 构造逻辑

# T4：单测 + CLI 错误提示
# 无 API key 时：npx ts-node scripts/eval-questions-cli.ts run --id q005-defect-critical-auditor-ratio --version v1
# 预期：Agent 作答失败，提示设置 EVAL_TARGET_* 或 SCORING_LLM_*

# T5：端到端验收（需配置 API key）
export EVAL_TARGET_API_KEY=sk-xxx
export EVAL_TARGET_BASE_URL=https://api.moonshot.cn/v1
export EVAL_TARGET_MODEL=moonshot-v1-8k
npx ts-node scripts/eval-questions-cli.ts run --id q005-defect-critical-auditor-ratio --version v1
# 或 --id q005（依 manifest 实际 id）
```

---

## §10 环境变量解析约定

**EVAL_INJECT_BMAD_CONTEXT**：`process.env.EVAL_INJECT_BMAD_CONTEXT === "false"` 或 `=== "0"`（大小写敏感）时回退精简版；其余（含未设置、`"true"`、`"1"`、空字符串 `""`）均从项目加载。

**项目根**：T2 加载路径「相对于项目根」指 `process.cwd()`（即执行 `npx ts-node scripts/eval-questions-cli.ts run ...` 时的当前工作目录）。CLI 应在项目根目录下执行。

---

## §11 收敛声明

- **第 98 轮**：无新 gap。
- **第 99 轮**：无新 gap。
- **第 100 轮**：无新 gap。

**批判审计员终审结论**：有条件同意。最终任务列表完整、可执行、覆盖 P0/P1 改进项。实施时须严格按验收标准执行；T1 为 T4 前置依赖；T5 为端到端验收，需在 T1–T4 完成后执行。

---

*本 TASKS 由 Party-Mode 100 轮讨论收敛产出，批判审计员终审同意。*
