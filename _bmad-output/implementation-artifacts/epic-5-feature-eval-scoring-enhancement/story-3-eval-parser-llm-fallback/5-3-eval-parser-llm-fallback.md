# Story 5.3：eval-parser-llm-fallback

Status: done

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.3  
**Slug**：eval-parser-llm-fallback  
**包含 GAP**：B05（LLM 结构化提取 fallback）  
**前置依赖**：Story 5.2（audit-generic.ts 中的 extractOverallGrade 已迁移）

<!-- Note: 可执行 validate-create-story 进行质量检查后再进入 dev-story。 -->

---

## 0. Party-Mode 决议摘要（架构/设计决策）

本 Story 涉及 LLM 调用方式、重试策略、数据安全策略等架构与设计决策。依据 `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1 的 GAP-B05 Party-Mode 深度讨论（批判审计员与多角色参与，收敛通过）及 create-story 强制 party-mode 约束，以下决策已确定并纳入本 Story 范围。

### 0.1 参与与收敛状态

- **决策来源**：TASKS_gaps 功能补充实现 v2.1 §GAP-B05（Party-Mode 深度讨论收敛）
- **适用场景**：Create Story 产出方案 + 设计决策，满足「生成最终方案和最终任务列表」的 100 轮最少轮次要求
- **收敛状态**：单一方案已确定，无未闭合 gap

### 0.2 关键分歧与闭合结论

| 决策点 | 结论 | 依据 |
|--------|------|------|
| LLM 调用方式 | 使用 Node.js 内置 `fetch` 发送 `/v1/chat/completions`；兼容 OpenAI API 格式，支持 `SCORING_LLM_BASE_URL` 自定义 | 零新增依赖，兼容自托管与第三方 API |
| 重试策略 | Schema 校验失败时重试 1 次，最多 2 次调用；两次均失败则抛 ParseError | 兼顾容错与可预测延迟（最坏约 60s） |
| 数据安全策略 | (1) 无 `SCORING_LLM_API_KEY` 时 LLM 层完全跳过；(2) system prompt 明确「仅返回 JSON 结构，不要包含或引用输入文本中的代码片段」；(3) 使用前须确认 LLM API 提供方数据处理协议 | 满足最小暴露与合规可控 |
| Fallback 链 | 正则成功 → 不调用 LLM；正则失败 + 无 API key → 抛 ParseError；正则失败 + 有 API key → 调用 llmStructuredExtract | 严格链式，无隐式回退 |
| 超时配置 | `SCORING_LLM_TIMEOUT_MS` 默认 30000ms | 可配置，单次调用超时即抛 ParseError |

### 0.3 数据安全警告（必读）

`llmStructuredExtract` 会将审计报告全文发送至外部 LLM API。审计报告可能包含项目内部代码片段、安全漏洞描述等敏感信息。

- 环境变量 `SCORING_LLM_API_KEY` 未配置时，LLM fallback 完全跳过，不发送任何数据
- system prompt 中包含指令：「仅返回 JSON 结构，不要包含或引用输入文本中的代码片段」
- 使用前应确认 LLM API 提供方的数据处理协议符合项目安全要求

---

## 1. Story

As a Scoring 系统的解析模块，  
I want 在正则解析失败时自动调用 LLM 做结构化提取，  
so that 非标格式的审计报告也能被正确解析。

---

## 2. Scope（范围）

### 2.1 本 Story 实现范围

1. **B05 LLM 结构化提取 fallback**
   - 新增 `scoring/parsers/llm-fallback.ts`：`llmStructuredExtract(reportContent, stage)`、`LLM_SYSTEM_PROMPT` 常量、`LlmExtractionResult` 接口
   - 严格 fallback 链：正则 → LLM → 抛异常
   - 环境变量：`SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`（默认 `https://api.openai.com/v1`）、`SCORING_LLM_MODEL`（默认 `gpt-4o-mini`）、`SCORING_LLM_TIMEOUT_MS`（默认 30000）
   - 在 `audit-prd.ts`、`audit-arch.ts`、`audit-story.ts`、`audit-generic.ts` 的等级提取返回 null 时插入 LLM fallback 逻辑
   - `audit-arch.ts`、`audit-story.ts` 改为从 `audit-generic.ts` 复用 `extractOverallGrade`，与 `audit-prd.ts` 一致，再在其返回 null 时接入 LLM fallback

### 2.2 不在本 Story 范围但属于本 Epic 的功能

| 功能 | 归属 | 任务具体描述 |
|------|------|--------------|
| spec/plan/tasks 三阶段评分规则、四维加权 | **由 Story 5.2 负责**：已在 `audit-generic.ts` 中实现 `extractOverallGrade`、`parseGenericReport`，以及 spec/plan/tasks 的 YAML 规则与维度解析 |
| 能力短板聚类分析 | **由 Story 5.4 负责**：在 `scoring/analytics/cluster-weaknesses.ts` 实现 `clusterWeaknesses`，并集成至 `scoring/coach/diagnose.ts` 的 `weakness_clusters` 字段 |
| SFT 提取、Prompt 优化建议、规则自优化建议 | **由 Story 5.5 负责**：实现 `sft-extractor.ts`、`prompt-optimizer.ts`、`rule-suggestion.ts` 与对应 CLI 及测试 |
| 版本锁定、触发加载、Bugfix 回写、回退建议 | **由 Story 5.1 负责并已完成**：以 `source_hash`、trigger-loader、writeback、rollback 为基线能力 |

---

## 3. 需求追溯

| 来源需求 | 本 Story 覆盖点 | 对应 AC |
|----------|----------------|---------|
| `epics.md` Story 5.3（B05） | LLM 结构化提取 + 四解析器 fallback 接入 | AC-B05-1 ~ AC-B05-7 |
| `TASKS_gaps功能补充实现.md` GAP-B05 | LlmExtractionResult、llmStructuredExtract、LLM_SYSTEM_PROMPT、6 测试用例、数据安全警告 | AC-B05-1 ~ AC-B05-6 |
| `architecture.ai-code-eval-system.md` 解析层 | 解析器 fallback 链与外部 API 集成约束 | AC-B05-1、AC-B05-3、AC-B05-7 |

---

## 4. Acceptance Criteria（验收标准）

| AC ID | 验收标准 | 验证方式 |
|-------|----------|----------|
| AC-B05-1 | 审计报告正则解析成功时，执行解析流程不调用 LLM API | 单测：mock fetch 未被调用 |
| AC-B05-2 | 正则解析失败且 `SCORING_LLM_API_KEY` 已配置时，调用 `llmStructuredExtract` 返回 `{ grade, issues, veto_items }` 结构化结果；schema 校验失败时重试 1 次 | 单测：mock fetch 返回合法 JSON |
| AC-B05-3 | `SCORING_LLM_API_KEY` 未配置时，正则解析失败直接抛出原始 ParseError（与当前行为一致） | 单测：无 API key → 抛 ParseError |
| AC-B05-4 | LLM 首次返回非法 JSON、重试成功 → 返回重试结果 | 单测 |
| AC-B05-5 | LLM 两次均返回非法 JSON → 抛 ParseError | 单测 |
| AC-B05-6 | API 超时（mock fetch 延迟 > SCORING_LLM_TIMEOUT_MS）→ 抛 ParseError | 单测 |
| AC-B05-7 | 所有解析器（prd、arch、story、generic）在等级提取返回 null 时均接入 LLM fallback | 代码审查 + 单测覆盖各 parser |

---

## 5. Tasks / Subtasks

### Task 1：B05 llm-fallback 核心实现（AC: AC-B05-1 至 AC-B05-6）

- [ ] 1.1 新增 `scoring/parsers/llm-fallback.ts`：定义 `LlmExtractionResult` 接口（`grade`、`issues`、`veto_items`）；定义 `LLM_SYSTEM_PROMPT` 常量（含「仅返回 JSON 结构，不要包含或引用输入文本中的代码片段」）
- [ ] 1.2 实现 `llmStructuredExtract(reportContent: string, stage: string): Promise<LlmExtractionResult>`：使用 Node.js 内置 `fetch` 发送 `/v1/chat/completions`；设置 `AbortSignal.timeout(SCORING_LLM_TIMEOUT_MS)`；读取 `SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`、`SCORING_LLM_MODEL` 环境变量
- [ ] 1.3 对返回 JSON 做结构校验：grade 必须为 `'A'|'B'|'C'|'D'`；issues 为数组且每项 severity 必须为 `'高'|'中'|'低'`；校验失败重试 1 次（最多 2 次调用）
- [ ] 1.4 API 超时或网络错误 → 抛 ParseError
- [ ] 1.5 新增 `scoring/parsers/__tests__/llm-fallback.test.ts`：6 个测试用例（mock global.fetch）

### Task 2：B05 接入 audit-prd/arch/story/generic（AC: AC-B05-7）

- [ ] 2.1 修改 `scoring/parsers/audit-prd.ts` 的 `parsePrdReport`：`extractOverallGrade` 返回 null 时，检查 `process.env.SCORING_LLM_API_KEY`；存在则调用 `llmStructuredExtract(content, 'prd')`，将 grade 映射为 `GRADE_TO_SCORE`，issues 映射为 `CheckItem[]`；不存在则抛原始 ParseError
- [ ] 2.2 修改 `scoring/parsers/audit-arch.ts` 的 `parseArchReport`：改为使用 `extractOverallGrade`（从 `audit-generic` 导入）替代现有 inline 正则；返回 null 时，与 2.1 相同逻辑（调用 `llmStructuredExtract(content, 'arch')` 或抛 ParseError）
- [ ] 2.3 修改 `scoring/parsers/audit-story.ts` 的 `parseStoryReport`：改为使用 `extractOverallGrade`（从 `audit-generic` 导入）替代现有 inline 正则；返回 null 时，与 2.1 相同逻辑
- [ ] 2.4 修改 `scoring/parsers/audit-generic.ts` 的 `parseGenericReport`：`extractOverallGrade` 返回 null 时，与 2.1 相同逻辑，`stage` 作为 `llmStructuredExtract` 的第二个参数传入

---

## 6. Dev Notes

### 6.1 技术约束

- **Fallback 链**：正则成功 → 不调用 LLM；正则失败 + 无 API key → 抛 ParseError；正则失败 + 有 API key → 调用 llmStructuredExtract
- **数据安全**：审计报告全文会发送至外部 LLM API；system prompt 明确「仅返回 JSON 结构，不要包含或引用输入文本中的代码片段」
- **超时**：默认 30000ms，最多 2 次调用，最坏延迟约 60s
- **Mock**：单测使用 mock 的 global.fetch，不发送真实请求

### 6.2 架构遵从

- `extractOverallGrade` 为 `audit-generic.ts` 导出，prd/arch/story 均复用该函数以统一 fallback 接入点
- LLM fallback 逻辑在各 parser 中独立实现，共享 `llmStructuredExtract` 与 `LLM_SYSTEM_PROMPT`

### 6.3 Library / Framework 要求

- 使用 Node.js 内置 `fetch`，不引入第三方 HTTP 库
- 使用 `AbortSignal.timeout(SCORING_LLM_TIMEOUT_MS)` 控制超时
- 单测使用 vitest，mock `global.fetch`

### 6.4 新增文件一览（2 个）

| 类型 | 路径 |
|------|------|
| 实现 | `scoring/parsers/llm-fallback.ts` |
| 测试 | `scoring/parsers/__tests__/llm-fallback.test.ts` |

### 6.5 修改文件一览（4 个）

| 文件 | 变更 |
|------|------|
| `scoring/parsers/audit-prd.ts` | extractOverallGrade 返回 null 时 LLM fallback |
| `scoring/parsers/audit-arch.ts` | 改用 extractOverallGrade + extractOverallGrade 返回 null 时 LLM fallback |
| `scoring/parsers/audit-story.ts` | 改用 extractOverallGrade + extractOverallGrade 返回 null 时 LLM fallback |
| `scoring/parsers/audit-generic.ts` | extractOverallGrade 返回 null 时 LLM fallback |

### 6.6 测试用例总数

- B05：6 个（llm-fallback.test.ts）
- 各 parser 集成：需在现有 audit-prd/arch/story/generic 单测中补充「正则失败 + 有 API key + LLM 成功」与「正则失败 + 无 API key → 抛错」场景

---

## 7. Previous Story Intelligence（来自 Story 5.2）

- `audit-generic.ts` 已导出 `extractOverallGrade`、`extractCheckItems`，prd 已复用；arch、story 当前使用 inline 正则，本 Story 将其统一为 `extractOverallGrade`
- `parseGenericReport` 当前在 grade 为 null 时直接抛错，需改为先尝试 LLM fallback
- `GRADE_TO_SCORE` 与 `CheckItem` 映射逻辑在 prd/arch/story 中已存在，LLM 返回的 `issues` 需映射为 `CheckItem[]`（`item_id`、`passed`、`score_delta`、`note`）

---

## 8. References

- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B05] LLM 结构化提取实现方案（LlmExtractionResult、llmStructuredExtract 函数签名、LLM_SYSTEM_PROMPT、6 个测试用例、数据安全警告）
- [Source: _bmad-output/planning-artifacts/dev/epics.md#Story-5.3] Epic 5 Story 5.3 完整定义
- [Source: scoring/parsers/audit-generic.ts] extractOverallGrade、parseGenericReport 当前实现

---

## 9. Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
