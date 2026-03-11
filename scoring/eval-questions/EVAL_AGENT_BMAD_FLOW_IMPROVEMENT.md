# 评测 Agent 作答改进：目标模型遵循 BMAD-speckit-SDD 全流程

## 问题

当前 `generateEvalAnswer` 使用 `SCORING_LLM_*` 配置的模型（如 GPT）作答，且 system prompt 仅包含「资深工程师 + 输出格式」。若希望**被评测的目标模型**（如 Kimi）遵循 BMAD-speckit-SDD 全流程作答并生成完整评分数据，需做以下改进。

---

## 改进方案概览

| 改进项 | 说明 |
|--------|------|
| 1. 目标模型分离 | 支持 `EVAL_TARGET_*` 配置，使作答的是 Kimi 而非 SCORING_LLM |
| 2. BMAD-speckit-SDD 全流程上下文注入 | 在 system prompt 中注入五层架构（Layer 1～5）全流程与约束 |
| 3. 批判审计员格式强化 | 明确 audit-prompts-critical-auditor-appendix 的必填结构与占比要求 |
| 4. 题目 framing | 在 user message 中明确「按 BMAD-speckit-SDD 全流程规范作答」 |

---

## 1. 目标模型分离

**目的**：作答的模型 = 被评测的模型（Kimi），而非编排/评分用的 SCORING_LLM。

**实现**：

- 新增环境变量（优先级高于 SCORING_LLM_*）：
  - `EVAL_TARGET_API_KEY`：目标模型 API Key（如 Kimi）
  - `EVAL_TARGET_BASE_URL`：目标模型 Base URL（如 `https://api.moonshot.cn/v1`）
  - `EVAL_TARGET_MODEL`：目标模型名（如 `moonshot-v1-8k`）
  - `EVAL_TARGET_TIMEOUT_MS`：超时（默认 120000）
- `generateEvalAnswer` 优先读取 `EVAL_TARGET_*`，未设置时回退到 `SCORING_LLM_*`。
- CLI 支持 `--target-model`、`--target-base-url` 等覆盖。

**使用示例**：

```bash
# 评测 Kimi
export EVAL_TARGET_API_KEY=sk-xxx
export EVAL_TARGET_BASE_URL=https://api.moonshot.cn/v1
export EVAL_TARGET_MODEL=moonshot-v1-8k
npx ts-node scripts/eval-questions-cli.ts run --id q005 --version v1
```

---

## 2. BMAD-speckit-SDD 全流程上下文注入（五层架构）

**目的**：让目标模型在作答时遵循 **BMAD-speckit-SDD 五层架构全流程**（参考 bmad-story-assistant SKILL.md 快速决策指引）的约束。

**实现**：扩展 `EVAL_AGENT_SYSTEM_PROMPT`，在现有「可解析块格式」之前增加五层架构概览与约束。

**建议注入内容**（精简版，控制 token 量）：

```markdown
## BMAD-speckit-SDD 五层架构全流程约束（作答时必须遵循）

你正在执行 BMAD-speckit-SDD 全流程中的评测题目作答。作答时需严格遵循以下五层架构规范。

### Layer 1: 产品定义层
- Product Brief → 复杂度评估 → PRD → Architecture
- 涉及多方案或设计决策时须 party-mode 多角色辩论（批判审计员必须出场）
- 禁止词：可选、可考虑、后续、先实现后续扩展、待定、技术债

### Layer 2: Epic/Story 规划层
- create-epics-and-stories → Epic 列表、Story 列表、依赖图
- 无独立评分环节，产出为 Layer 3 输入

### Layer 3: Story 开发层
- Create Story → Party-Mode → Story 文档
- 涉及多方案或设计决策时须 party-mode 至少 100 轮
- 需求追溯：PRD→Story 可追溯

### Layer 4: 技术实现层（嵌套 speckit-workflow）
- 必须按顺序：specify → plan → GAPS → tasks → 执行（TDD 红绿灯）
- 每阶段须通过 code-review 审计才能进入下一阶段
- 需求映射：PRD→Story→spec→plan→tasks 可追溯
- **TDD 红绿灯**：红灯→绿灯→重构；**ralph-method**：prd/progress 与 US 顺序
- 严禁跳过阶段、伪实现、占位

### Layer 5: 收尾层
- 实施后审计 §5「完全覆盖、验证通过」
- 批量 Push + PR 自动生成 + 强制人工审核

### 批判审计员结论（强制必须）
段落标题 `## 批判审计员结论`，须包含：
- 已检查的维度列表
- 每维度结论（通过/未通过及说明）
- 本轮结论（「本轮无新 gap」或「本轮存在 gap」及具体项）
- 该段落字数或条目数 ≥ 报告其余部分的 50%
```

---

## 3. 批判审计员格式强化

在 system prompt 中引用 `audit-prompts-critical-auditor-appendix` 的必填结构，明确：

- 已检查维度列表
- 每维度结论
- 本轮 gap 结论
- 占比 ≥50%

（当前 agent-answer.ts 已有「强制必须」，可补充占比与结构说明。）

---

## 4. 题目 Framing

在 user message 中明确「按 BMAD-speckit-SDD 全流程作答」：

```typescript
// 当前
{ role: 'user', content: `请根据以下评测题目作答：\n\n${questionContent}` }

// 改进后
{ role: 'user', content: `请按 BMAD-speckit-SDD 五层架构全流程规范作答以下评测题目。作答时需遵循 Layer 1～5 的约束，并以审计报告格式输出（含可解析块）。\n\n---\n\n${questionContent}` }
```

---

## 5. 从项目加载真实文档（P0，默认模式）

**目的**：降低「全流程被错误裁剪」的风险，以项目内 skills 为单一来源，与真实 BMAD 流程保持一致。

**默认行为**：`EVAL_INJECT_BMAD_CONTEXT` 未设置或为 `true` 时，从项目加载真实文件并注入；`EVAL_INJECT_BMAD_CONTEXT=false` 时回退到精简版。

**加载路径**（相对于项目根）：

| 文件 | 用途 | 控制策略 |
|------|------|----------|
| `skills/bmad-story-assistant/SKILL.md` | 五层架构概览 | 提取「五层架构概览」段落（约 20 行） |
| `skills/speckit-workflow/SKILL.md` | TDD、ralph-method、15 条铁律 | 提取关键段落或前 N 行 |
| `skills/speckit-workflow/references/audit-prompts-critical-auditor-appendix.md` | 批判审计员格式 | 全文或必填结构段落 |
| `审计报告格式与解析约定.md` | 可解析块格式 | 提取 §3 可解析块部分 |

**回退**：当上述路径不存在（如独立评测环境、skills 未安装）时，自动回退到精简版（§2 建议注入内容），避免运行失败。

---

## 6. 实施优先级

| 优先级 | 改进项 | 工作量 | 收益 |
|--------|--------|--------|------|
| P0 | 目标模型分离（EVAL_TARGET_*） | 小 | 可评测任意模型（Kimi 等） |
| P0 | 从项目加载真实文档（默认） | 中 | 全流程不被裁剪，与 skills 同步 |
| P0 | 五层架构注入回退（精简版） | 小 | 路径不存在时可用 |
| P1 | 题目 framing 强化 | 小 | 明确「按 BMAD-speckit-SDD 五层架构全流程作答」 |

---

## 7. 验收标准

- [ ] 设置 `EVAL_TARGET_*` 后，作答调用目标模型 API，非 SCORING_LLM
- [ ] system prompt 含 BMAD-speckit-SDD 五层架构全流程概览与核心约束
- [ ] 批判审计员结论含「已检查维度、每维度结论、本轮结论」及占比说明
- [ ] user message 含「按 BMAD-speckit-SDD 五层架构全流程规范作答」
- [ ] 目标模型（如 Kimi）作答后，parseAndWriteScore 可成功解析并写入 scoring 数据
