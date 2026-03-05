# IMPLEMENTATION_GAPS-E5-S3：eval-parser-llm-fallback

**输入**：`spec-E5-S3.md`、`plan-E5-S3.md`、当前代码基线  
**分析范围**：仅 B05（LLM 结构化提取 fallback）

---

## 1. 当前实现快照

基于代码现状检查，存在以下事实：

- `scoring/parsers/llm-fallback.ts` 不存在。
- `scoring/parsers/__tests__/llm-fallback.test.ts` 不存在。
- `audit-prd.ts` 已从 `audit-generic` 导入 `extractOverallGrade`，但 `extractOverallGrade` 返回 null 时直接抛 `ParseError`，无 LLM fallback。
- `audit-arch.ts` 使用 inline 正则 `content.match(/总体评级:\s*([ABCD])/)?.[1]`，未使用 `extractOverallGrade`，无 LLM fallback。
- `audit-story.ts` 使用 inline 正则，未使用 `extractOverallGrade`，无 LLM fallback。
- `audit-generic.ts` 的 `parseGenericReport` 在 `extractOverallGrade` 返回 null 时直接抛 `ParseError`，无 LLM fallback。
- 四解析器均无「正则失败 + 有 API key + LLM 成功」或「正则失败 + 无 API key → 抛错」的集成测试覆盖。
- 无经 `parseAuditReport` 或 `parseAndWriteScore` 的 LLM fallback 集成/E2E 验收。

---

## 2. Gap 明细（需求逐条对照）

### 2.1 B05 llm-fallback 核心

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S3-B05-1 | AC-B05-1~6（llm-fallback 模块） | 无 llm-fallback.ts | 新增 `scoring/parsers/llm-fallback.ts`，实现 `LlmExtractionResult`、`LLM_SYSTEM_PROMPT`、`llmStructuredExtract`，支持 fetch、校验、重试、超时 | T1.1-T1.5 |
| GAP-E5-S3-B05-2 | AC-B05-1~6（单测） | 无 llm-fallback 单测 | 新增 `scoring/parsers/__tests__/llm-fallback.test.ts`，6 个用例（mock fetch） | T4.1 |

### 2.2 B05 四解析器接入

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S3-B05-3 | AC-B05-7（audit-prd） | extractOverallGrade 返回 null 时直接抛错 | 检查 `SCORING_LLM_API_KEY`，有则调用 `llmStructuredExtract` 并映射，无则抛错 | T2.2 |
| GAP-E5-S3-B05-4 | AC-B05-7（audit-arch） | 使用 inline 正则，无 fallback | 改用 `extractOverallGrade`（从 audit-generic 导入），返回 null 时 LLM fallback 或抛错 | T2.1, T2.3 |
| GAP-E5-S3-B05-5 | AC-B05-7（audit-story） | 使用 inline 正则，无 fallback | 改用 `extractOverallGrade`，返回 null 时 LLM fallback 或抛错 | T2.1, T2.4 |
| GAP-E5-S3-B05-6 | AC-B05-7（audit-generic） | grade 为 null 时直接抛错 | 插入 LLM fallback，stage 传入 `llmStructuredExtract` | T2.5 |

### 2.3 B05 issues / veto_items 映射

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S3-B05-7 | spec §3.2.5 | 无 | 实现 issues → CheckItem（`resolveItemId`、fallbackId `llm_{stage}_issue_{idx}`）、veto_items 并入 check_items | T3.1-T3.2 |

### 2.4 B05 集成与 E2E 测试

| Gap ID | 来源需求 | 当前状态 | 目标状态 | 对应任务 |
| -------- | ---------- | ---------- | ---------- | ---------- |
| GAP-E5-S3-B05-8 | AC-B05-7，plan §5.2 | 无四解析器 LLM fallback 集成场景 | 在 audit-prd/arch/story/generic 单测中补充：① 正则失败+有 key+LLM 成功；② 正则失败+无 key→抛错 | T4.2 |
| GAP-E5-S3-B05-9 | plan §5.2, §5.3 | 无 parseAuditReport / parseAndWriteScore 层验收 | 补充经 `parseAuditReport` 或 `parse-and-write.test.ts` 的集成/E2E 用例 | T4.3 |

---

## 3. 依赖关系与实施顺序

1. 先完成 Phase 1（llm-fallback 核心 + 单测），再 Phase 2（四解析器接入）、Phase 3（映射）、Phase 4（集成/E2E）。
2. audit-arch、audit-story 须先改为使用 `extractOverallGrade`（T2.1），再插入 fallback（T2.3、T2.4），以保证统一接入点。
3. audit-generic 的 `parseGenericReport` 在 grade 为 null 时插入 fallback，与 prd/arch/story 逻辑一致。

---

## 4. 风险与缓解

| 风险 | 触发条件 | 缓解动作 | 落位任务 |
| ------ | ---------- | ---------- | ---------- |
| LLM API 不可用或超时 | 网络或 API 故障 | 重试 1 次后抛 ParseError，调用方预期最坏延迟约 60s | T1.4, T1.5 |
| 无 API key 时误调用 LLM | 逻辑错误 | 各 parser 在调用 `llmStructuredExtract` 前显式检查 `process.env.SCORING_LLM_API_KEY` | T2.2-T2.5 |
| issues/veto_items 映射与 veto 模块不兼容 | item_id 格式错误 | 使用 `resolveItemId` 与现有 audit-item-mapping 规则，veto_items 格式与 veto 模块约定一致 | T3.1-T3.2 |

---

## 5. Gap 到任务映射总表

| Gap ID | Task IDs | 验收命令 |
| -------- | ---------- | ---------- |
| GAP-E5-S3-B05-1 | T1.1-T1.5 | `npm run test:scoring -- scoring/parsers/__tests__/llm-fallback.test.ts` |
| GAP-E5-S3-B05-2 | T4.1 | 同上 |
| GAP-E5-S3-B05-3 | T2.2 | `npm run test:scoring -- scoring/parsers/__tests__/audit-prd.test.ts` |
| GAP-E5-S3-B05-4 | T2.1, T2.3 | `npm run test:scoring -- scoring/parsers/__tests__/audit-arch.test.ts` |
| GAP-E5-S3-B05-5 | T2.1, T2.4 | `npm run test:scoring -- scoring/parsers/__tests__/audit-story.test.ts` |
| GAP-E5-S3-B05-6 | T2.5 | `npm run test:scoring -- scoring/parsers/__tests__/audit-generic.test.ts` |
| GAP-E5-S3-B05-7 | T3.1-T3.2 | 随 T2 各 parser 单测验证 |
| GAP-E5-S3-B05-8 | T4.2 | 同上 + 各 parser 单测 |
| GAP-E5-S3-B05-9 | T4.3 | `npm run test:scoring -- scoring/orchestrator/__tests__/parse-and-write.test.ts` 或等价 |

<!-- AUDIT: PASSED by code-reviewer -->
