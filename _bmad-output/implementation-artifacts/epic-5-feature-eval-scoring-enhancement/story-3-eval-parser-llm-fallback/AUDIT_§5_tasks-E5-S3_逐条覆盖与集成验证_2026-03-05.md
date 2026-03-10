# tasks-E5-S3 审计报告：逐条覆盖与集成/E2E 专项验证

**审计对象**：`specs/epic-5/story-3-eval-parser-llm-fallback/tasks-E5-S3.md`  
**原始需求**：spec-E5-S3.md、plan-E5-S3.md、IMPLEMENTATION_GAPS-E5-S3.md、Story 5.3（5-3-eval-parser-llm-fallback.md）  
**审计日期**：2026-03-05  
**审计角色**：code-reviewer（严格逐条验证）

---

## 1. spec-E5-S3.md 逐条覆盖验证

| spec 章节 | 内容要点 | 对应任务 | 验证结果 |
| --------- | -------- | -------- | -------- |
| §2.1 In Scope | 新增 llm-fallback 模块 | T1.1-T1.5 | ✅ T1 完整覆盖 |
| §2.1 | 严格 fallback 链 | T2.2-T2.5，T4.2 场景② | ✅ 已覆盖 |
| §2.1 | 四解析器接入、arch/story 统一 extractOverallGrade | T2.1-T2.5 | ✅ 已覆盖 |
| §2.1 | 环境变量 4 项 | T1.2 | ✅ 已覆盖 |
| §2.1 | 数据安全（system prompt 不含代码片段） | T1.1 | ✅ 已覆盖 |
| §3.1.1 | LlmExtractionResult、LLM_SYSTEM_PROMPT | T1.1 | ✅ 已覆盖 |
| §3.1.2 | llmStructuredExtract、fetch、AbortSignal | T1.2, T1.3 | ✅ 已覆盖 |
| §3.1.3 | 结构校验、重试 1 次、两次失败抛 ParseError | T1.3 | ✅ 已覆盖 |
| §3.1.4 | 超时、网络错误 → ParseError | T1.4 | ✅ 已覆盖 |
| §3.2.1~3.2.4 | 四解析器 fallback 接入逻辑 | T2.2-T2.5 | ✅ 已覆盖 |
| §3.2.5 | issues → CheckItem（resolveItemId、fallbackId、severity） | T3.1 | ✅ 已覆盖 |
| §3.2.5 | veto_items → check_items 并入 | T3.2 | ✅ 已覆盖 |
| §4 AC-B05-1~7 | 全部验收标准 | T4.1-T4.3，§1 映射表 | ✅ 已覆盖 |

**spec 覆盖结论**：spec-E5-S3.md 全部章节已覆盖。

---

## 2. plan-E5-S3.md 逐条覆盖验证

| plan 章节 | 内容要点 | 对应任务 | 验证结果 |
| --------- | -------- | -------- | -------- |
| §1 目标与约束 | 仅 B05、严格 fallback 链、零新增依赖 | T1-T4 | ✅ 已覆盖 |
| §1 | 集成测试与 E2E 计划、parseAuditReport 关键路径 | T4.2, T4.3 | ✅ 已覆盖 |
| §2 Phase 1 | llm-fallback 核心实现 | T1.1-T1.5 | ✅ 已覆盖 |
| §2 Phase 2 | 四解析器接入 | T2.1-T2.5 | ✅ 已覆盖 |
| §2 Phase 3 | issues/veto_items 映射 | T3.1-T3.2 | ✅ 已覆盖 |
| §2 Phase 4 | 测试与回归 | T4.1-T4.3, T5 | ✅ 已覆盖 |
| §3.1 新增文件 | llm-fallback.ts、llm-fallback.test.ts | T1, T4.1 | ✅ 已覆盖 |
| §3.2 修改文件 | audit-prd/arch/story/generic | T2.2-T2.5 | ✅ 已覆盖 |
| §4.1~4.3 | 调用链路、接入点、生产关键路径验证 | T2, T4.2, T4.3 | ✅ 已覆盖 |
| §5.1 单元测试 | llm-fallback 6 用例 | T4.1 | ✅ 已覆盖 |
| §5.2 集成测试 | 四 parser + parse-and-write | T4.2, T4.3 | ✅ 已覆盖 |
| §5.3 端到端回归 | npm run test:scoring | T5.7 | ✅ 已覆盖 |
| §7 准入标准 | 6 单测 + 四解析器集成 + parseAuditReport/parseAndWriteScore | T4, T5 | ✅ 已覆盖 |

**plan 覆盖结论**：plan-E5-S3.md 全部章节已覆盖。

---

## 3. IMPLEMENTATION_GAPS-E5-S3.md 逐条覆盖验证

| Gap ID | 目标状态 | 对应任务 | 验证结果 |
| ------ | -------- | -------- | -------- |
| GAP-E5-S3-B05-1 | llm-fallback.ts、LlmExtractionResult、llmStructuredExtract | T1.1-T1.5 | ✅ 已覆盖 |
| GAP-E5-S3-B05-2 | llm-fallback 单测 6 用例 | T4.1 | ✅ 已覆盖 |
| GAP-E5-S3-B05-3 | audit-prd LLM fallback | T2.2 | ✅ 已覆盖 |
| GAP-E5-S3-B05-4 | audit-arch extractOverallGrade + fallback | T2.1, T2.3 | ✅ 已覆盖 |
| GAP-E5-S3-B05-5 | audit-story extractOverallGrade + fallback | T2.1, T2.4 | ✅ 已覆盖 |
| GAP-E5-S3-B05-6 | audit-generic LLM fallback | T2.5 | ✅ 已覆盖 |
| GAP-E5-S3-B05-7 | issues/veto_items 映射 | T3.1-T3.2 | ✅ 已覆盖 |
| GAP-E5-S3-B05-8 | 四解析器 LLM fallback 集成场景 | T4.2 | ✅ 已覆盖 |
| GAP-E5-S3-B05-9 | parseAuditReport/parseAndWriteScore 层验收 | T4.3 | ✅ 已覆盖 |

**Gaps 覆盖结论**：IMPLEMENTATION_GAPS-E5-S3 全部 9 个 Gap 均已映射到任务。

---

## 4. Story 5.3 逐条覆盖验证

| Story 章节 | 内容要点 | 对应任务 | 验证结果 |
| ---------- | -------- | -------- | -------- |
| §2.1 范围 | llm-fallback.ts、fallback 链、环境变量、四解析器 | T1, T2 | ✅ 已覆盖 |
| §2.1 | arch/story 复用 extractOverallGrade | T2.1 | ✅ 已覆盖 |
| §4 AC-B05-1~7 | 全部 AC | T4, §1 映射表 | ✅ 已覆盖 |
| §5 Task 1 | llm-fallback 核心 + 6 测试用例 | T1, T4.1 | ✅ 已覆盖 |
| §5 Task 2 | 四解析器接入 | T2.2-T2.5 | ✅ 已覆盖 |
| §6.6 | 各 parser 补充「正则失败+有 key+LLM 成功」「正则失败+无 key→抛错」 | T4.2 | ✅ 已覆盖 |
| §0 Party-Mode | fetch、重试、数据安全、超时 | T1 | ✅ 已覆盖 |

**Story 覆盖结论**：Story 5.3 全部相关章节已覆盖。spec §3.2.5 的 issues/veto_items 映射细节由 T3 覆盖，Story 5.3 Task 2 仅概括为「issues 映射为 CheckItem[]」，细节在 spec/Gaps 中，符合分工。

---

## 5. 专项审查（1）：集成测试与 E2E 覆盖

| Phase | 单元测试 | 集成测试 | E2E/关键路径 | 验证结果 |
| ----- | -------- | -------- | ------------ | -------- |
| Phase 1（llm-fallback） | T4.1 llm-fallback.test.ts 6 用例 | 通过 T4.2 四 parser 调用 llmStructuredExtract 间接覆盖 | T4.3 parseAndWriteScore 层 | ✅ 不仅有单元测试 |
| Phase 2（四解析器接入） | — | T4.2 四 parser 集成场景 | T4.3 | ✅ 已覆盖 |
| Phase 3（映射） | — | T4.2「正则失败+有 key+LLM 成功」会验证映射 | T4.3 | ✅ 已覆盖 |
| Phase 4 | T4.1 | T4.2, T4.3 | T5.6, T5.7 | ✅ 完整 |

**专项审查（1）结论**：每个 Phase 均包含集成测试或 E2E 覆盖，**非仅有单元测试**，满足要求。

---

## 6. 专项审查（2）：生产代码关键路径集成验证

| 模块 | 关键路径 | 任务中的集成验证 | 验证结果 |
| ---- | -------- | ---------------- | -------- |
| llm-fallback.ts | parseAuditReport → parse*Report → llmStructuredExtract | T4.2 四 parser 集成、T4.3 parseAndWriteScore | ✅ 已覆盖 |
| audit-prd/arch/story/generic | parseAuditReport 调度 | T4.2、T4.3、T5.2-T5.6 | ✅ 已覆盖 |
| issues/veto 映射 | 在 parser 内被 llmStructuredExtract 结果使用 | T4.2「正则失败+有 key+LLM 成功→返回 RunScoreRecord」 | ✅ 已覆盖 |

§8 完成判定标准明确要求：「每个模块的验收须包含该模块在生产代码关键路径（parseAuditReport → parse*Report）中被导入并调用的集成验证。」  
**专项审查（2）结论**：已满足，T4.2、T4.3 与 §8 一致。

---

## 7. 专项审查（3）：孤岛模块检查

| 模块 | 是否在生产关键路径被导入/调用 | 验证任务 | 验证结果 |
| ---- | ----------------------------- | -------- | -------- |
| llm-fallback.ts | T2.2-T2.5 要求四 parser 导入并调用 llmStructuredExtract | T4.2, T4.3 | ✅ 无孤岛 |
| T3 映射逻辑 | 在 T2 各 parser 的 fallback 分支中使用 | T4.2 | ✅ 无孤岛 |

**专项审查（3）结论**：**不存在**「模块内部实现完整且可通过单元测试，但从未在生产代码关键路径中被导入、实例化或调用」的孤岛模块任务。

---

## 8. 逐条验证方式与结果汇总

| 验证项 | 验证方式 | 验证结果 |
| ------ | -------- | -------- |
| spec §2.1~§4 | 逐章对照 tasks 任务与映射表 | ✅ 通过 |
| plan §1~§7 | 逐章对照 tasks 任务与 T4/T5 | ✅ 通过 |
| IMPLEMENTATION_GAPS 9 项 | 对照 tasks §7 Gaps 映射表 | ✅ 通过 |
| Story 5.3 §0~§6 | 对照 tasks 与 AC 映射 | ✅ 通过 |
| 集成/E2E 非仅有单测 | 检查 T4.2、T4.3 与 plan §5.2、§5.3 | ✅ 通过 |
| 关键路径集成验证 | 检查 T4.2、T4.3 与 §8 | ✅ 通过 |
| 孤岛模块 | 检查 llm-fallback、T3 映射是否被调用 | ✅ 无孤岛 |

---

## 9. 轻微改进建议（非阻断）

| 建议项 | 描述 | 优先级 |
| ------ | ---- | ------ |
| T4.2 补充 AC-B05-1 显式场景 | AC-B05-1「正则成功时不调用 LLM API」的验证方式为「单测：mock fetch 未被调用」。该断言需在 **parser 集成测试** 中完成（传入正则可解析内容，mock fetch，断言未被调用）。T4.2 当前仅列「① 正则失败+有 key+LLM 成功」「② 正则失败+无 key→抛错」，未显式列「③ 正则成功→fetch 未被调用」。建议在 T4.2 中补充该集成场景，以完整覆盖 AC-B05-1 的验证。 | 低 |
| T4.1 用例① 归属 | T4.1 将「① 正则成功 → fetch 未被调用」列为 llm-fallback.test.ts 的 6 用例之首。llm-fallback.test.ts 测试的是 `llmStructuredExtract` 本身；「正则成功」由 parser 层控制，该用例的验证更合理归属 T4.2 的 parser 集成测试。实施时可酌情将①移至 T4.2，或在 T4.2 中补充等价场景。 | 低 |

上述建议为优化项。从逻辑上，正则成功时 parser 不调用 `llmStructuredExtract`，`fetch` 自然不会被调用；若现有 parser 测试已覆盖正则成功路径且未破坏，行为上满足 AC-B05-1，但**显式断言** fetch 未被调用可提升可验证性。当前 tasks 未强制要求此断言，不构成阻断性遗漏。

---

## 10. 结论

**审计结论**：**完全覆盖、验证通过**。

tasks-E5-S3.md 已完整覆盖 spec-E5-S3.md、plan-E5-S3.md、IMPLEMENTATION_GAPS-E5-S3.md、Story 5.3 的全部相关章节；每个 Phase 均包含集成测试或 E2E 覆盖，非仅有单元测试；每个模块的验收均包含在生产代码关键路径（parseAuditReport → parse*Report）中被导入并调用的集成验证；不存在孤岛模块任务。

建议在实施 T4.2 时，补充「正则成功 + 断言 fetch 未被调用」的集成场景，以更明确地满足 AC-B05-1 的验证方式。
