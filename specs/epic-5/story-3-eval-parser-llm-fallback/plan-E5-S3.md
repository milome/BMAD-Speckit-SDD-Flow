# plan-E5-S3：eval-parser-llm-fallback 实现方案

**Epic**：E5 feature-eval-scoring-enhancement  
**Story ID**：5.3  
**输入**：`spec-E5-S3.md`、Story 5.3、`epics.md`、`TASKS_gaps功能补充实现.md` v2.1（GAP-B05）

---

## 1. 目标与约束

- 仅实现 B05（LLM 结构化提取 fallback），不扩展到 B06/B07/B08/B09。
- 严格 fallback 链：正则成功 → 不调用 LLM；正则失败 + 无 API key → 抛 ParseError；正则失败 + 有 API key → 调用 llmStructuredExtract。
- 使用 Node.js 内置 `fetch`，零新增依赖；兼容 OpenAI API 格式，支持自托管与第三方 API。
- 每个功能点均需有对应测试任务与验收命令，禁止「后续补充」。
- 必须包含完整的集成测试与端到端功能测试计划，验证四个解析器在生产代码关键路径（parseAuditReport → parsePrdReport/parseArchReport/parseStoryReport/parseGenericReport）中正确接入 LLM fallback。

---

## 2. 实施分期

### Phase 1：llm-fallback 核心实现

1. 新增 `scoring/parsers/llm-fallback.ts`：定义 `LlmExtractionResult`、`LLM_SYSTEM_PROMPT`、实现 `llmStructuredExtract`。
2. 读取环境变量：`SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`（默认 `https://api.openai.com/v1`）、`SCORING_LLM_MODEL`（默认 `gpt-4o-mini`）、`SCORING_LLM_TIMEOUT_MS`（默认 30000）。
3. 使用 `fetch` 发送 `/v1/chat/completions`，设置 `AbortSignal.timeout(SCORING_LLM_TIMEOUT_MS)`。
4. 对返回 JSON 做结构校验（grade、issues 格式），校验失败重试 1 次，两次均失败抛 ParseError。
5. API 超时或网络错误 → 抛 ParseError。

### Phase 2：四解析器接入 LLM fallback

1. 修改 `audit-arch.ts`、`audit-story.ts`：改为从 `audit-generic` 导入 `extractOverallGrade`，替代现有 inline 正则。
2. 修改 `audit-prd.ts`：在 `extractOverallGrade` 返回 null 时插入 LLM fallback 逻辑（检查 API key、调用 llmStructuredExtract、映射 grade 与 issues）。
3. 修改 `audit-arch.ts`、`audit-story.ts`：同上 fallback 逻辑。
4. 修改 `audit-generic.ts`：在 `extractOverallGrade` 返回 null 时插入 fallback，将 `stage` 传入 `llmStructuredExtract`。

### Phase 3：issues / veto_items 映射

1. 在 llm-fallback 或各 parser 中实现 issues → CheckItem 映射：从 `audit-item-mapping` 导入 `resolveItemId`，fallbackId 为 `llm_{stage}_issue_{idx}`（idx 1-based），severity 映射 -10/-5/-2。
2. veto_items → check_items 并入：`{ item_id, passed: false, score_delta: -10, note: 'veto' }`。

### Phase 4：测试与回归

1. 新增 `scoring/parsers/__tests__/llm-fallback.test.ts`：6 个用例（mock global.fetch），覆盖 AC-B05-1~6。
2. 在现有 `audit-prd.test.ts`、`audit-arch.test.ts`、`audit-story.test.ts`、`audit-generic.test.ts` 中补充集成场景：① 正则失败 + 有 key + LLM 成功；② 正则失败 + 无 key → 抛 ParseError。
3. 执行 `npm run test:scoring` 全量回归，验证 parseAuditReport 关键路径未被破坏。

---

## 3. 模块与文件改动设计

### 3.1 新增文件

| 文件 | 责任 | 对应需求 | 对应任务 |
| ------ | ------ | ---------- | ---------- |
| `scoring/parsers/llm-fallback.ts` | LLM 结构化提取、重试、校验 | B05 | T1.1-T1.4 |
| `scoring/parsers/__tests__/llm-fallback.test.ts` | B05 核心单测 6 用例 | AC-B05-1~6 | T4.1 |

### 3.2 修改文件

| 文件 | 变更 | 对应需求 | 对应任务 |
| ------ | ------ | ---------- | ---------- |
| `scoring/parsers/audit-prd.ts` | extractOverallGrade 返回 null 时 LLM fallback | B05 | T2.2 |
| `scoring/parsers/audit-arch.ts` | 改用 extractOverallGrade + LLM fallback | B05 | T2.1, T2.3 |
| `scoring/parsers/audit-story.ts` | 改用 extractOverallGrade + LLM fallback | B05 | T2.1, T2.4 |
| `scoring/parsers/audit-generic.ts` | extractOverallGrade 返回 null 时 LLM fallback | B05 | T2.5 |

---

## 4. 详细技术方案

### 4.1 llm-fallback 调用链路

1. `llmStructuredExtract(reportContent, stage)` 读取 `SCORING_LLM_API_KEY`；无 key 则不执行（调用方在 parser 层判断）。
2. 构建 `/v1/chat/completions` 请求体：`model`、`messages`（system + user）、`temperature: 0`。
3. `fetch(url, { signal: AbortSignal.timeout(timeoutMs), ... })` 发送请求。
4. 解析响应 JSON，校验 grade ∈ {A,B,C,D}、issues 每项 severity ∈ {高,中,低}。
5. 校验失败且未达重试上限 → 再次调用；已达上限 → 抛 ParseError。

### 4.2 四解析器 fallback 接入点

1. 各 parser 在调用 `extractOverallGrade(content)` 后，若返回 null：
   - 检查 `process.env.SCORING_LLM_API_KEY`
   - 有 key → `llmStructuredExtract(content, stage)`，将结果映射为 `RunScoreRecord`（phase_score、check_items）
   - 无 key → 抛 `new ParseError('Could not extract 总体评级 from ... report')`（与当前行为一致）

### 4.3 生产代码关键路径验证

- `parseAuditReport`（audit-index.ts）→ `parsePrdReport`、`parseArchReport`、`parseStoryReport`、`parseGenericReport`
- 集成测试须验证：当传入内容无法被正则解析时，有 key 则走 LLM 路径并返回有效记录；无 key 则抛错。
- 端到端：`scripts/parse-and-write-score.ts` 接收报告路径，经 `parseAuditReport` 调度，确保 LLM fallback 在真实调用链中生效。

---

## 5. 测试计划（单元 + 集成 + 端到端）

### 5.1 单元测试

| 测试文件 | 覆盖点 | 命令 |
| ---------- | -------- | ------ |
| `scoring/parsers/__tests__/llm-fallback.test.ts` | 正则成功不调用 fetch、有 key+合法 JSON、重试成功、重试失败抛错、无 key 抛错、超时抛错 | `npm run test:scoring -- scoring/parsers/__tests__/llm-fallback.test.ts` |

### 5.2 集成测试

| 测试文件 | 覆盖点 | 命令 |
| ---------- | -------- | ------ |
| `audit-prd.test.ts` | 正则失败 + 有 key + LLM 成功 → 返回 RunScoreRecord | `npm run test:scoring -- scoring/parsers/__tests__/audit-prd.test.ts` |
| `audit-arch.test.ts` | 同上 | `npm run test:scoring -- scoring/parsers/__tests__/audit-arch.test.ts` |
| `audit-story.test.ts` | 同上 | `npm run test:scoring -- scoring/parsers/__tests__/audit-story.test.ts` |
| `audit-generic.test.ts` | 同上（spec/plan/tasks stage） | `npm run test:scoring -- scoring/parsers/__tests__/audit-generic.test.ts` |
| `parse-and-write.test.ts` 或 audit-index 相关测试 | 经 `parseAuditReport` 入口传入无法正则解析内容，有 key 时 LLM fallback 生效 | `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts` |

### 5.3 端到端回归

| 场景 | 验证目标 | 命令 |
| ------ | ---------- | ------ |
| scoring 全链路回归 | 新增 LLM fallback 不破坏既有 parseAuditReport 流程 | `npm run test:scoring` |
| parse-and-write 层验收 | 传入无法正则解析的报告内容，有 key 时经 parseAndWriteScore 写入有效 RunScoreRecord；无 key 时抛 ParseError | `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts`（或等价 e2e 命令） |

---

## 6. 需求追溯与任务映射（plan ↔ spec ↔ tasks）

| 需求 ID / AC | spec 章节 | plan 章节 | 任务段落 |
| -------------- | ----------- | ----------- | ---------- |
| AC-B05-1 | spec §3.1.2, §2.1 | Phase 1, §4.1 | T1, T4.1 |
| AC-B05-2 | spec §3.1.2, §3.1.3 | Phase 1, §4.1 | T1, T4.1 |
| AC-B05-3 | spec §3.2.1 | Phase 2, §4.2 | T2, T4.2 |
| AC-B05-4 | spec §3.1.3 | Phase 1 | T1.3, T4.1 |
| AC-B05-5 | spec §3.1.3 | Phase 1 | T1.3, T4.1 |
| AC-B05-6 | spec §3.1.4 | Phase 1 | T1.4, T4.1 |
| AC-B05-7 | spec §3.2 | Phase 2, §5.2 | T2, T4.2 |

---

## 7. 执行准入标准

- 生成 `tasks-E5-S3.md` 后，其中所有任务必须具备明确文件路径与验收命令。
- 至少完成 6 个 llm-fallback 单测 + 四解析器集成场景补充 + 经 parseAuditReport/parseAndWriteScore 的集成或 E2E 验收。
- 通过 `npm run test:scoring` 后方可进入 Story 5.3 实施收尾。

<!-- AUDIT: PASSED by code-reviewer -->
