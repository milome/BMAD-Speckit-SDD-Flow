# Story 5.3：eval-parser-llm-fallback

Status: ready-for-dev

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.3  
**Slug**：eval-parser-llm-fallback  
**包含 GAP**：B05（LLM 结构化提取 fallback）  
**前置依赖**：Story 5.2（audit-generic.ts 中的 extractOverallGrade 已迁移）

<!-- Note: 可执行 validate-create-story 进行质量检查后再进入 dev-story。 -->

## Story

As a Scoring 系统的解析模块，  
I want 在正则解析失败时自动调用 LLM 做结构化提取，  
so that 非标格式的审计报告也能被正确解析。

---

## 1. Scope（范围）

### 1.1 本 Story 包含

1. **B05 LLM 结构化提取 fallback**：
   - `llm-fallback.ts`：`llmStructuredExtract(reportContent, stage)`、`LLM_SYSTEM_PROMPT` 常量
   - 严格 fallback 链：正则 → LLM → 抛异常
   - 环境变量：`SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`（默认 `https://api.openai.com/v1`）、`SCORING_LLM_MODEL`（默认 `gpt-4o-mini`）、`SCORING_LLM_TIMEOUT_MS`（默认 30000）
   - 在 `audit-prd.ts`、`audit-arch.ts`、`audit-story.ts`、`audit-generic.ts` 的 `extractOverallGrade` 返回 null 时插入 LLM fallback 逻辑

### 1.2 本 Story 不包含

| 功能 | 负责 Story | 说明 |
|------|-----------|------|
| spec/plan/tasks 评分规则 | Story 5.2 | B03 audit-generic.ts 基础 |
| 能力短板聚类、SFT、Prompt/规则建议 | Story 5.4、5.5 | B06/B07/B08/B09 |

---

## 2. Acceptance Criteria（验收标准）

| AC | 验收标准 | 验证方式 |
|----|----------|----------|
| AC-B05-1 | 审计报告正则解析成功时，执行解析流程不调用 LLM API | 单测：mock fetch 未被调用 |
| AC-B05-2 | 正则解析失败且 `SCORING_LLM_API_KEY` 已配置时，调用 `llmStructuredExtract` 返回 `{ grade, issues, veto_items }` 结构化结果；schema 校验失败时重试 1 次 | 单测：mock fetch 返回合法 JSON |
| AC-B05-3 | `SCORING_LLM_API_KEY` 未配置时，正则解析失败直接抛出原始 ParseError（与当前行为一致） | 单测：无 API key → 抛 ParseError |
| AC-B05-4 | LLM 首次返回非法 JSON、重试成功 → 返回重试结果 | 单测 |
| AC-B05-5 | LLM 两次均返回非法 JSON → 抛 ParseError | 单测 |
| AC-B05-6 | API 超时（mock fetch 延迟 > SCORING_LLM_TIMEOUT_MS）→ 抛 ParseError | 单测 |
| AC-B05-7 | 所有解析器（prd、arch、story、generic）在 extractOverallGrade 返回 null 时均接入 LLM fallback | 代码审查 + 单测覆盖各 parser |

---

## 3. Tasks / Subtasks

### Task 1：B05 llm-fallback 核心实现（AC: AC-B05-1 至 AC-B05-6）

- [ ] 1.1 新增 `scoring/parsers/llm-fallback.ts`：定义 `LlmExtractionResult` 接口（grade、issues、veto_items）；定义 `LLM_SYSTEM_PROMPT` 常量（含「仅返回 JSON 结构，不要包含或引用输入文本中的代码片段」）
- [ ] 1.2 实现 `llmStructuredExtract(reportContent: string, stage: string): Promise<LlmExtractionResult>`：使用 Node.js 内置 `fetch` 发送 `/v1/chat/completions`；设置 `AbortSignal.timeout(SCORING_LLM_TIMEOUT_MS)`；读取 `SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`、`SCORING_LLM_MODEL` 环境变量
- [ ] 1.3 对返回 JSON 做结构校验：grade 必须为 `'A'|'B'|'C'|'D'`；issues 为数组且每项 severity 必须为 `'高'|'中'|'低'`；校验失败重试 1 次（最多 2 次调用）
- [ ] 1.4 API 超时或网络错误 → 抛 ParseError
- [ ] 1.5 新增 `scoring/parsers/__tests__/llm-fallback.test.ts`：6 个测试用例（mock global.fetch）

### Task 2：B05 接入 audit-prd/arch/story/generic（AC: AC-B05-7）

- [ ] 2.1 修改 `scoring/parsers/audit-prd.ts` 的 `parsePrdReport`：`extractOverallGrade`（从 audit-generic  import）返回 null 时，检查 `process.env.SCORING_LLM_API_KEY`；存在则调用 `llmStructuredExtract(content, 'prd')`，将 grade 映射为 GRADE_TO_SCORE，issues 映射为 CheckItem[]；不存在则抛原始 ParseError
- [ ] 2.2 修改 `scoring/parsers/audit-arch.ts` 的 `parseArchReport`：同 2.1 逻辑
- [ ] 2.3 修改 `scoring/parsers/audit-story.ts` 的 `parseStoryReport`：同 2.1 逻辑
- [ ] 2.4 修改 `scoring/parsers/audit-generic.ts` 的 `parseGenericReport`：`extractOverallGrade` 返回 null 时，同 2.1 逻辑（stage 作为第二个参数传入）

---

## 4. Dev Notes

### 4.1 技术约束

- **Fallback 链**：正则成功 → 不调用 LLM；正则失败 + 无 API key → 抛 ParseError；正则失败 + 有 API key → 调用 llmStructuredExtract
- **数据安全**：审计报告全文会发送至外部 LLM API；system prompt 明确「仅返回 JSON 结构，不要包含或引用输入文本中的代码片段」
- **超时**：默认 30000ms，最多 2 次调用，最坏延迟约 60s
- **Mock**：单测使用 mock 的 global.fetch，不发送真实请求

### 4.2 实现参考

| 项目 | 路径 |
|------|------|
| 需求与实现方案 | `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1 §GAP-B05 |
| Epic/Story 定义 | `_bmad-output/planning-artifacts/dev/epics.md` §3 Story 5.3 |
| extractOverallGrade 接入点 | `scoring/parsers/audit-generic.ts`（Story 5.2 产出） |
| 现有解析器 | `scoring/parsers/audit-prd.ts`、`audit-arch.ts`、`audit-story.ts` |

### 4.3 新增文件一览（2 个）

| 类型 | 路径 |
|------|------|
| 实现 | `scoring/parsers/llm-fallback.ts` |
| 测试 | `scoring/parsers/__tests__/llm-fallback.test.ts` |

### 4.4 修改文件一览（4 个）

| 文件 | 变更 |
|------|------|
| `scoring/parsers/audit-prd.ts` | extractOverallGrade 返回 null 时 LLM fallback |
| `scoring/parsers/audit-arch.ts` | 同上 |
| `scoring/parsers/audit-story.ts` | 同上 |
| `scoring/parsers/audit-generic.ts` | 同上 |

### 4.5 测试用例总数

- B05：6 个（llm-fallback.test.ts）

---

## 5. References

- [Source: _bmad-output/patent/TASKS_gaps功能补充实现.md#GAP-B05] LLM 结构化提取实现方案（LlmExtractionResult、llmStructuredExtract 函数签名、LLM_SYSTEM_PROMPT、6 个测试用例、数据安全警告）
- [Source: _bmad-output/planning-artifacts/dev/epics.md#Story-5.3] Epic 5 Story 5.3 完整定义

---

## 6. Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
