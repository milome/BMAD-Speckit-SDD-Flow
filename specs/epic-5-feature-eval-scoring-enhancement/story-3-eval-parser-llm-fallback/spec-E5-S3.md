# Spec E5-S3：eval-parser-llm-fallback

*Story 5.3 技术规格*  
*Epic E5 feature-eval-scoring-enhancement*

---

## 1. 概述

本 spec 将 Story 5.3 的实现范围固化为可执行技术规格，仅覆盖 B05（LLM 结构化提取 fallback）。  
输入来源如下：

- `_bmad-output/planning-artifacts/dev/epics.md`（Story 5.3 与 AC）
- `_bmad-output/patent/TASKS_gaps功能补充实现.md` v2.1（GAP-B05）
- `_bmad-output/implementation-artifacts/5-3-eval-parser-llm-fallback/5-3-eval-parser-llm-fallback.md`

---

## 2. 范围与边界

### 2.1 In Scope：B05（LLM 结构化提取 fallback）

| 需求要点 | 技术规格 |
| ---------- | ---------- |
| 新增 llm-fallback 模块 | 新增 `scoring/parsers/llm-fallback.ts`，导出 `llmStructuredExtract`、`LlmExtractionResult`、`LLM_SYSTEM_PROMPT` |
| 严格 fallback 链 | 正则成功 → 不调用 LLM；正则失败 + 无 API key → 抛 ParseError；正则失败 + 有 API key → 调用 llmStructuredExtract |
| 四解析器接入 LLM fallback | `audit-prd.ts`、`audit-arch.ts`、`audit-story.ts`、`audit-generic.ts` 在 `extractOverallGrade` 返回 null 时接入 fallback |
| arch/story 统一为 extractOverallGrade | `audit-arch.ts`、`audit-story.ts` 改为从 `audit-generic` 导入 `extractOverallGrade`，替代现有 inline 正则 |
| 环境变量配置 | `SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`（默认 `https://api.openai.com/v1`）、`SCORING_LLM_MODEL`（默认 `gpt-4o-mini`）、`SCORING_LLM_TIMEOUT_MS`（默认 30000） |
| 数据安全约束 | 无 API key 时 LLM 层完全跳过；system prompt 含「仅返回 JSON 结构，不要包含或引用输入文本中的代码片段」；使用前应确认 LLM API 提供方数据处理协议符合项目安全要求 |

### 2.2 Out of Scope

- B03、B11（三阶段评分、四维加权）由 Story 5.2 负责，已实现
- B06/B07/B08/B09 分析与优化能力由 Story 5.4/5.5 负责
- 本文档不包含生产代码提交与测试执行结果，仅定义实现规格

---

## 3. 功能规格

### 3.1 llm-fallback 核心接口

#### 3.1.1 数据结构

```ts
export interface LlmExtractionResult {
  grade: 'A' | 'B' | 'C' | 'D';
  issues: Array<{ severity: '高' | '中' | '低'; description: string }>;
  veto_items: string[];
}

export const LLM_SYSTEM_PROMPT: string;
```

`LLM_SYSTEM_PROMPT` 必须包含：「仅返回 JSON 结构，不要包含或引用输入文本中的代码片段」。

#### 3.1.2 主函数

```ts
export async function llmStructuredExtract(
  reportContent: string,
  stage: string
): Promise<LlmExtractionResult>;
```

- 使用 Node.js 内置 `fetch` 发送 `/v1/chat/completions` 请求
- 读取 `SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`、`SCORING_LLM_MODEL`、`SCORING_LLM_TIMEOUT_MS`
- 设置 `AbortSignal.timeout(SCORING_LLM_TIMEOUT_MS)`
- 兼容 OpenAI API 格式，支持 `SCORING_LLM_BASE_URL` 自定义

#### 3.1.3 结构校验与重试

- grade 必须为 `'A'|'B'|'C'|'D'`
- issues 为数组，每项 severity 必须为 `'高'|'中'|'低'`
- 校验失败重试 1 次（最多 2 次调用）
- 两次均失败 → 抛 ParseError

#### 3.1.4 异常处理

- API 超时 → 抛 ParseError
- 网络错误 → 抛 ParseError

### 3.2 四解析器接入逻辑

#### 3.2.1 audit-prd.ts

- `extractOverallGrade`（从 `audit-generic` 导入）返回 null 时：
  - 若 `process.env.SCORING_LLM_API_KEY` 存在 → 调用 `llmStructuredExtract(content, 'prd')`，将 grade 映射为 `GRADE_TO_SCORE`，issues 映射为 `CheckItem[]`
  - 若不存在 → 抛原始 ParseError

#### 3.2.2 audit-arch.ts

- 改为使用 `extractOverallGrade`（从 `audit-generic` 导入）替代现有 inline 正则
- `extractOverallGrade` 返回 null 时：与 3.2.1 相同逻辑，调用 `llmStructuredExtract(content, 'arch')` 或抛 ParseError

#### 3.2.3 audit-story.ts

- 改为使用 `extractOverallGrade`（从 `audit-generic` 导入）替代现有 inline 正则
- `extractOverallGrade` 返回 null 时：与 3.2.1 相同逻辑

#### 3.2.4 audit-generic.ts

- `extractOverallGrade` 返回 null 时：与 3.2.1 相同逻辑，`stage` 作为 `llmStructuredExtract` 的第二参数传入

#### 3.2.5 issues 与 CheckItem 映射

- LLM 返回的 `issues[]` 须映射为 `CheckItem[]`：`item_id`、`passed`、`score_delta`、`note`
- `item_id` 生成规则：优先使用 `resolveItemId(stage, description, fallbackId)`（从 `audit-item-mapping` 导入）；fallbackId 格式为 `llm_{stage}_issue_{idx}`（idx 为 issues 数组下标 1-based）
- severity 映射：高 → -10，中 → -5，低 → -2
- `veto_items` 映射：LLM 返回的 `veto_items` 字符串数组（item_id）须并入 `check_items`，每项格式为 `{ item_id, passed: false, score_delta: -10, note: 'veto' }`，与现有 veto 模块的 check_items 语义一致

### 3.3 数据安全

- 使用前应确认 LLM API 提供方的数据处理协议符合项目安全要求；本 spec 假定调用方已履行此确认。

---

## 4. 验收标准映射（AC）

| AC ID | 验收标准 | spec 对应章节 | 验证方式 |
| ------ | ---------- | --------------- | ---------- |
| AC-B05-1 | 正则解析成功时不调用 LLM API | §3.1.2, §2.1 fallback 链 | 单测：mock fetch 未被调用 |
| AC-B05-2 | 正则失败 + 有 API key 时调用 llmStructuredExtract 返回结构化结果；schema 校验失败重试 1 次 | §3.1.2, §3.1.3 | 单测：mock fetch 返回合法 JSON |
| AC-B05-3 | 无 API key 时正则失败直接抛 ParseError | §3.2.1 | 单测：无 API key → 抛 ParseError |
| AC-B05-4 | LLM 首次返回非法 JSON、重试成功 → 返回重试结果 | §3.1.3 | 单测 |
| AC-B05-5 | LLM 两次均返回非法 JSON → 抛 ParseError | §3.1.3 | 单测 |
| AC-B05-6 | API 超时 → 抛 ParseError | §3.1.4 | 单测：mock fetch 延迟 > SCORING_LLM_TIMEOUT_MS |
| AC-B05-7 | 所有解析器（prd、arch、story、generic）在等级提取返回 null 时均接入 LLM fallback | §3.2 | 代码审查 + 各 parser 单测 + 集成场景：① 正则失败 + 有 key + LLM 成功 → 返回结构化结果；② 正则失败 + 无 key → 抛 ParseError |

---

## 5. 需求追溯清单（来源 -> spec）

| 来源 | 来源条目 | spec 章节 | 覆盖状态 |
| ------ | ---------- | ----------- | ---------- |
| `epics.md` Story 5.3 | B05 LLM 结构化提取 fallback | §2.1, §3, §4 | 已覆盖 |
| `TASKS_gaps功能补充实现.md` v2.1 | GAP-B05 方案（LlmExtractionResult、llmStructuredExtract、6 测试用例、数据安全警告） | §3.1, §3.2, §4 | 已覆盖 |
| Story 5.3 文档 | Party-Mode 决议（fetch、重试、数据安全、fallback 链、超时） | §2.1, §3.1 | 已覆盖 |
| Story 5.3 文档 | Task 1~2 与 AC 列表 | §4, §5 | 已覆盖 |
| `architecture.ai-code-eval-system.md` | 解析层 fallback 链与外部 API 集成约束 | §2.1, §3.1 | 已覆盖 |

---

## 6. 与后续文档的映射约定

- `plan-E5-S3.md` 必须基于本 spec 的 AC 与接口继续细化为模块级实施步骤。
- `IMPLEMENTATION_GAPS-E5-S3.md` 必须逐条对照 §3 与 §4，给出现状差距与任务映射。
- `tasks-E5-S3.md` 必须按 AC-B05-1~7 提供可执行任务与测试命令。

<!-- AUDIT: PASSED by code-reviewer -->
