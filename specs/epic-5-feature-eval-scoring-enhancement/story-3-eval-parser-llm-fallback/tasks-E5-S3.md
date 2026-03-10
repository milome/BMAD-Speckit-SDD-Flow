# Tasks: eval-parser-llm-fallback (E5-S3)

**Input**：`spec-E5-S3.md`、`plan-E5-S3.md`、`IMPLEMENTATION_GAPS-E5-S3.md`  
**Scope**：仅 B05（LLM 结构化提取 fallback）  
**执行方式**：按 T1 → T2 → T3 → T4 → T5 顺序推进

---

## 1. 需求追溯与任务映射

| 任务组 | 来源需求 | AC | Gap |
| -------- | ---------- | ---- | ----- |
| T1 | B05 llm-fallback 核心 | AC-B05-1~6 | GAP-E5-S3-B05-1 |
| T2 | B05 四解析器接入 | AC-B05-7 | GAP-E5-S3-B05-3/4/5/6 |
| T3 | B05 issues / veto_items 映射 | AC-B05-7 | GAP-E5-S3-B05-7 |
| T4 | B05 测试与夹具 | AC-B05-1~7 | GAP-E5-S3-B05-2/8/9 |
| T5 | 验收命令执行 | 全部 AC | 全部 Gap |

---

## 2. Phase 1：llm-fallback 核心实现（T1）

**AC**：AC-B05-1、AC-B05-2、AC-B05-4、AC-B05-5、AC-B05-6

- [x] **T1.1** 新增 `scoring/parsers/llm-fallback.ts`：定义 `LlmExtractionResult` 接口（`grade`、`issues`、`veto_items`）；定义 `LLM_SYSTEM_PROMPT` 常量（含「仅返回 JSON 结构，不要包含或引用输入文本中的代码片段」）
- [x] **T1.2** 在 llm-fallback.ts 实现 `llmStructuredExtract(reportContent: string, stage: string): Promise<LlmExtractionResult>`：使用 Node.js 内置 `fetch` 发送 `/v1/chat/completions`；读取 `SCORING_LLM_API_KEY`、`SCORING_LLM_BASE_URL`（默认 `https://api.openai.com/v1`）、`SCORING_LLM_MODEL`（默认 `gpt-4o-mini`）、`SCORING_LLM_TIMEOUT_MS`（默认 30000）
- [x] **T1.3** 在 llmStructuredExtract 中设置 `AbortSignal.timeout(SCORING_LLM_TIMEOUT_MS)`；对返回 JSON 做结构校验（grade ∈ A/B/C/D，issues 每项 severity ∈ 高/中/低）；校验失败重试 1 次（最多 2 次调用）；两次均失败 → 抛 ParseError
- [x] **T1.4** API 超时或网络错误 → 抛 ParseError
- [x] **T1.5** 导出 `llmStructuredExtract`、`LlmExtractionResult`、`LLM_SYSTEM_PROMPT`，供 audit-prd/arch/story/generic 导入

---

## 3. Phase 2：四解析器接入 LLM fallback（T2）

**AC**：AC-B05-7

- [x] **T2.1** 修改 `scoring/parsers/audit-arch.ts`：删除 inline 正则，改为从 `audit-generic` 导入 `extractOverallGrade`；修改 `scoring/parsers/audit-story.ts`：同上
- [x] **T2.2** 修改 `scoring/parsers/audit-prd.ts` 的 `parsePrdReport`：`extractOverallGrade` 返回 null 时，检查 `process.env.SCORING_LLM_API_KEY`；存在则调用 `llmStructuredExtract(content, 'prd')`，将 grade 映射为 `GRADE_TO_SCORE`，issues 映射为 `CheckItem[]`（含 T3 映射逻辑）；不存在则抛原始 ParseError
- [x] **T2.3** 修改 `scoring/parsers/audit-arch.ts` 的 `parseArchReport`：`extractOverallGrade` 返回 null 时，与 T2.2 相同逻辑，调用 `llmStructuredExtract(content, 'arch')` 或抛 ParseError
- [x] **T2.4** 修改 `scoring/parsers/audit-story.ts` 的 `parseStoryReport`：`extractOverallGrade` 返回 null 时，与 T2.2 相同逻辑
- [x] **T2.5** 修改 `scoring/parsers/audit-generic.ts` 的 `parseGenericReport`：`extractOverallGrade` 返回 null 时，与 T2.2 相同逻辑，`stage` 作为 `llmStructuredExtract` 的第二参数传入

---

## 4. Phase 3：issues / veto_items 映射（T3）

**AC**：AC-B05-7

- [x] **T3.1** 在各 parser 或 llm-fallback 中实现 issues → CheckItem 映射：从 `audit-item-mapping` 导入 `resolveItemId`，fallbackId 为 `llm_{stage}_issue_{idx}`（idx 1-based），severity 映射：高 → -10，中 → -5，低 → -2
- [x] **T3.2** 实现 veto_items → check_items 并入：`{ item_id, passed: false, score_delta: -10, note: 'veto' }`，与现有 veto 模块 check_items 语义一致

---

## 5. Phase 4：测试与夹具（T4）

**AC**：覆盖 AC-B05-1~7

- [x] **T4.1** 新增 `scoring/parsers/__tests__/llm-fallback.test.ts`，实现 6 个用例（mock global.fetch）：① 正则成功 → fetch 未被调用；② 正则失败 + 有 key + LLM 返回合法 JSON → 正确映射；③ 首次非法 JSON + 重试成功 → 返回重试结果；④ 两次均失败 → 抛 ParseError；⑤ 无 API key → 抛 ParseError；⑥ API 超时 → 抛 ParseError
- [x] **T4.2** 在现有 `audit-prd.test.ts`、`audit-arch.test.ts`、`audit-story.test.ts`、`audit-generic.test.ts` 中补充集成场景：① 正则失败 + 有 key + LLM 成功 → 返回 RunScoreRecord；② 正则失败 + 无 key → 抛 ParseError
- [x] **T4.3** 在 `scoring/orchestrator/__tests__/parse-and-write.test.ts` 或等效测试中补充：经 `parseAuditReport`/`parseAndWriteScore` 传入无法正则解析的报告内容，有 key 时 LLM fallback 生效并写入有效 RunScoreRecord；无 key 时抛 ParseError

---

## 6. Phase 5：验收命令执行（T5）

- [x] **T5.1** 执行：`npm run test:scoring -- scoring/parsers/__tests__/llm-fallback.test.ts`
- [x] **T5.2** 执行：`npm run test:scoring -- scoring/parsers/__tests__/audit-prd.test.ts`
- [x] **T5.3** 执行：`npm run test:scoring -- scoring/parsers/__tests__/audit-arch.test.ts`
- [x] **T5.4** 执行：`npm run test:scoring -- scoring/parsers/__tests__/audit-story.test.ts`
- [x] **T5.5** 执行：`npm run test:scoring -- scoring/parsers/__tests__/audit-generic.test.ts`
- [x] **T5.6** 执行：`npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts`
- [x] **T5.7** 执行：`npm run test:scoring`

---

## 7. Gaps → 任务映射（按需求文档章节）

| Gap ID | 本任务表行 | 对应任务 |
| -------- | ---------- | ---------- |
| GAP-E5-S3-B05-1 | ✓ 有 | T1.1-T1.5 |
| GAP-E5-S3-B05-2 | ✓ 有 | T4.1 |
| GAP-E5-S3-B05-3 | ✓ 有 | T2.2 |
| GAP-E5-S3-B05-4 | ✓ 有 | T2.1, T2.3 |
| GAP-E5-S3-B05-5 | ✓ 有 | T2.1, T2.4 |
| GAP-E5-S3-B05-6 | ✓ 有 | T2.5 |
| GAP-E5-S3-B05-7 | ✓ 有 | T3.1-T3.2 |
| GAP-E5-S3-B05-8 | ✓ 有 | T4.2 |
| GAP-E5-S3-B05-9 | ✓ 有 | T4.3 |

---

## 8. 完成判定标准

- T1~T5 全部任务完成并勾选。
- AC-B05-1~7 均有可追溯任务与测试结果。
- 不新增「可选/后续/待定/酌情」等模糊描述。
- 每个模块的验收须包含该模块在生产代码关键路径（parseAuditReport → parse*Report）中被导入并调用的集成验证。

<!-- AUDIT: PASSED by code-reviewer -->
