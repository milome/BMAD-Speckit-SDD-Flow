# plan-E5-S3 审计报告：与 spec / Story 5.3 / GAP-B05 逐条覆盖验证

**审计日期**：2026-03-05  
**审计对象**：`specs/epic-5/story-3-eval-parser-llm-fallback/plan-E5-S3.md`  
**原始需求**：`spec-E5-S3.md`、Story 5.3、GAP-B05  

---

## 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 1. spec-E5-S3.md 章节逐条覆盖验证

### 1.1 §1 概述

| 需求要点 | 验证方式 | 验证结果 |
|----------|----------|----------|
| 仅覆盖 B05，不扩展到 B06/B07/B08/B09 | plan §1 目标与约束 | ✅ 通过：「仅实现 B05，不扩展到 B06/B07/B08/B09」 |
| 输入来源（epics.md、TASKS_gaps GAP-B05、Story 5.3） | plan 开头输入声明 | ✅ 通过：输入列明 spec、Story 5.3、epics.md、TASKS_gaps v2.1（GAP-B05） |

### 1.2 §2 范围与边界

| 需求要点 | spec 章节 | plan 对应 | 验证结果 |
|----------|-----------|-----------|----------|
| 新增 llm-fallback 模块 | §2.1 | Phase 1，§3.1 | ✅ 通过 |
| 严格 fallback 链 | §2.1 | §1、§4.2 | ✅ 通过 |
| 四解析器接入 LLM fallback | §2.1 | Phase 2，§4.2 | ✅ 通过 |
| arch/story 统一为 extractOverallGrade | §2.1 | Phase 2.1、2.3 | ✅ 通过 |
| 环境变量：SCORING_LLM_API_KEY、SCORING_LLM_BASE_URL、SCORING_LLM_MODEL、SCORING_LLM_TIMEOUT_MS | §2.1 | Phase 1、§4.1 | ⚠️ 部分覆盖：plan 仅明确 SCORING_LLM_API_KEY、SCORING_LLM_TIMEOUT_MS；**SCORING_LLM_BASE_URL、SCORING_LLM_MODEL 未在 plan 中列出** |
| 数据安全约束（无 key 跳过、system prompt 不含代码片段、确认 API 提供方协议） | §2.1 | §1 fallback 链 | ⚠️ 部分覆盖：plan 未以独立段落复述「system prompt 含仅返回 JSON 且不引用代码片段」「使用前应确认 API 提供方数据处理协议」；可经 spec 追溯，但 plan 自身未显式写出 |
| Out of Scope：B03/B11、B06–B09 | §2.2 | §1 | ✅ 通过 |

### 1.3 §3 功能规格

| 需求要点 | spec 章节 | plan 对应 | 验证结果 |
|----------|-----------|-----------|----------|
| LlmExtractionResult、LLM_SYSTEM_PROMPT | §3.1.1 | Phase 1，§3.1 | ✅ 通过 |
| llmStructuredExtract 签名与 fetch 调用 | §3.1.2 | §4.1，Phase 1 | ✅ 通过 |
| 结构校验与重试（grade、issues、最多 2 次） | §3.1.3 | Phase 1.3，§4.1 | ✅ 通过 |
| API 超时、网络错误 → ParseError | §3.1.4 | Phase 1.4，§4.1 | ✅ 通过 |
| audit-prd/arch/story/generic 四解析器 fallback 逻辑 | §3.2.1–3.2.4 | Phase 2，§4.2 | ✅ 通过 |
| issues → CheckItem 映射、resolveItemId、severity -10/-5/-2 | §3.2.5 | Phase 3 | ⚠️ 轻微遗漏：plan 提及 resolveItemId 与 severity，**未写明从 audit-item-mapping 导入**；spec 要求「从 audit-item-mapping 导入」 |
| veto_items → check_items 并入格式 | §3.2.5 | Phase 3.2 | ✅ 通过 |
| fallbackId 格式 llm_{stage}_issue_{idx}，idx 1-based | §3.2.5 | Phase 3.1 | ⚠️ 轻微遗漏：plan 未注明 idx 为 1-based |
| 数据安全（§3.3） | §3.3 | 无独立段落 | ⚠️ 部分覆盖：可经 §2.1 追溯 |

### 1.4 §4 验收标准映射

| AC ID | spec 对应 | plan 对应 | 验证结果 |
|-------|-----------|-----------|----------|
| AC-B05-1~7 | §4 表格 | §5、§6 需求追溯表 | ✅ 通过：均有映射 |

### 1.5 §5 需求追溯清单、§6 与后续文档映射

| 需求要点 | 验证结果 |
|----------|----------|
| plan 基于 spec AC 细化 | ✅ 通过 |
| IMPLEMENTATION_GAPS、tasks 约定 | plan §7 要求 tasks-E5-S3.md 存在且任务具备路径与验收命令 | ❌ **未通过**：`tasks-E5-S3.md` **不存在** |

---

## 2. Story 5.3 逐条覆盖验证

| Story 章节 | 要点 | plan 对应 | 验证结果 |
|------------|------|-----------|----------|
| §0.1–0.2 Party-Mode 决议 | LLM 调用方式、重试策略、数据安全、Fallback 链、超时 | §1、§4.1、Phase 1 | ✅ 通过 |
| §0.3 数据安全警告 | 全文发送、无 key 跳过、system prompt 约束、确认 API 协议 | 无独立段落 | ⚠️ 部分覆盖 |
| §1 Story 目标 | 正则失败时 LLM 结构化提取 | §1 目标 | ✅ 通过 |
| §2.1 实现范围 | B05、四解析器、arch/story 统一 extractOverallGrade | Phase 1–3 | ✅ 通过 |
| §2.2 不在范围 | B03/B11、B06–B09 等 | §1 约束 | ✅ 通过 |
| §4 AC | AC-B05-1~7 | §5、§6 | ✅ 通过 |
| §5 Tasks | Task 1（1.1–1.5）、Task 2（2.1–2.4） | Phase 1–4 | ✅ 通过 |
| §6 Dev Notes | 技术约束、架构遵从、Library 要求 | §4 | ✅ 通过 |

---

## 3. GAP-B05 逐条覆盖验证

| GAP-B05 要点 | plan 对应 | 验证结果 |
|--------------|-----------|----------|
| 问题：非标格式无法解析 | §1 目标 | ✅ 通过 |
| Party-Mode 5 条决策 | §1、§4.1、Phase 1 | ✅ 通过 |
| 数据安全警告 | 无独立段落 | ⚠️ 部分覆盖 |
| 新增 llm-fallback.ts、修改 4 个 parser | Phase 1–2，§3 | ✅ 通过 |
| 6 个测试用例（mock fetch） | Phase 4，§5.1 | ✅ 通过 |

---

## 4. 集成测试与端到端测试专项审查

### 4.1 是否存在完整集成/端到端测试计划

| 检查项 | plan 内容 | 验证结果 |
|--------|-----------|----------|
| 是否有集成测试计划 | §5.2：四解析器各补充①正则失败+有 key+LLM 成功；②正则失败+无 key→ParseError | ✅ 有 |
| 是否有端到端测试计划 | §5.3：`npm run test:scoring` 全链路回归；§4.3 提及 parse-and-write-score.ts | ✅ 有 |
| 是否覆盖 parseAuditReport 关键路径 | §4.3 明确 parseAuditReport → parse*Report | ✅ 有 |
| 是否覆盖 parseAndWriteScore 编排层 | §4.3 提及 scripts/parse-and-write-score.ts | ⚠️ 仅提及，**未列出 parse-and-write.test.ts 或 e2e 中需补充的「无法正则+有 key+LLM」验收用例** |

### 4.2 是否仅依赖单元测试而缺集成/端到端

| 检查项 | 验证结果 |
|--------|----------|
| 是否仅依赖单测 | ❌ 否：plan 明确要求 §5.2 四解析器集成场景、§5.3 全链路回归 |
| 集成测试覆盖模块间协作 | ✅ 是：四 parser 各补充场景，涉及 extractOverallGrade → llmStructuredExtract 协作 |
| 是否通过 parseAuditReport 入口验证 | ⚠️ **未明确**：plan §5.2 要求在各 audit-*-test 中补充，但未要求「通过 parseAuditReport(options) 传入无法正则内容」以验证 stage 分发与 LLM fallback 的集成；最佳实践为至少 1 个用例经 parseAuditReport 验证 |

### 4.3 模块未被生产代码关键路径调用的风险

| 检查项 | 验证方式 | 验证结果 |
|--------|----------|----------|
| llm-fallback 是否被生产路径使用 | parseAuditReport → parse*Report → extractOverallGrade 返回 null 时 → llmStructuredExtract | ✅ 无风险：plan 在四 parser 中接入，四 parser 由 parseAuditReport 调度 |
| parseAuditReport 调度链 | audit-index.ts switch(stage) → parsePrdReport/parseArchReport/parseStoryReport/parseGenericReport | ✅ 已覆盖 |
| parseAndWriteScore 调用链 | parse-and-write.ts → parseAuditReport | ✅ plan §4.3 已提及，调用链贯通 |

### 4.4 端到端测试具体化程度

| 检查项 | plan 内容 | 验证结果 |
|--------|----------|----------|
| E2E 验收命令 | `npm run test:scoring` | ⚠️ **未具体化**：未明确是否需在 `scoring/orchestrator/__tests__/parse-and-write.test.ts` 或 e2e 中增加「报告无法正则+有 key+LLM 成功→写入有效记录」的用例；若 test:scoring 不含此类场景，则 E2E 计划不够可执行 |

---

## 5. 验证命令执行（辅助核查）

已执行以下验证：

| 验证项 | 命令/操作 | 结果 |
|--------|-----------|------|
| tasks-E5-S3.md 是否存在 | Glob `**/tasks*E5*S3*` | ❌ 文件不存在 |
| SCORING_LLM_BASE_URL/MODEL 是否在 plan 中 | Grep plan-E5-S3.md | ❌ 未提及 |
| parseAuditReport 调度链 | Read audit-index.ts | ✅ switch(stage) → parsePrdReport/parseArchReport/parseStoryReport/parseGenericReport |
| parseAndWriteScore 调用 parseAuditReport | Read parse-and-write.ts | ✅ L59 parseAuditReport({ content, stage, runId, scenario }) |

---

## 6. 遗漏与未覆盖要点汇总

| 序号 | 遗漏/未覆盖要点 | 严重程度 | 修改建议 |
|------|----------------|----------|----------|
| 1 | **tasks-E5-S3.md 不存在**，plan §7 要求其存在且任务具备路径与验收命令 | 高 | 生成 tasks-E5-S3.md，或调整 plan §7 准入标准 |
| 2 | **环境变量 SCORING_LLM_BASE_URL、SCORING_LLM_MODEL 未在 plan 中列出** | 中 | 在 plan §4.1 或 Phase 1 中补充，与 spec §2.1 一致 |
| 3 | **数据安全**：plan 未以独立段落复述「system prompt 含仅返回 JSON 且不引用代码片段」「使用前应确认 API 提供方数据处理协议」 | 低 | 在 plan §1 或新增 §1.1 数据安全约束中补充 |
| 4 | **resolveItemId 导入来源**：plan Phase 3 未写明「从 audit-item-mapping 导入」 | 低 | 在 Phase 3 或 §4.2 中补充 |
| 5 | **fallbackId idx 1-based**：plan 未注明 | 低 | 在 Phase 3.1 中补充「idx 为 1-based」 |
| 6 | **集成测试入口**：未明确要求通过 parseAuditReport 入口验证 stage 分发与 LLM fallback | 中 | 在 §5.2 中补充：至少 1 个用例经 parseAuditReport 传入无法正则内容，验证有 key 时走 LLM |
| 7 | **E2E 验收具体化**：未明确 parseAndWriteScore/parse-and-write 层需补充的「无法正则+LLM」用例 | 中 | 在 §5.3 中补充：parse-and-write.test.ts 或 e2e 中增加验收场景与命令 |

---

## 7. 结论

**结论：未完全覆盖、验证未通过。**

**未通过项**：
1. tasks-E5-S3.md 不存在，与 plan §7 执行准入标准冲突  
2. 环境变量 SCORING_LLM_BASE_URL、SCORING_LLM_MODEL 未在 plan 中明确  
3. 集成测试未明确要求通过 parseAuditReport 入口验证  
4. 端到端测试未具体化 parseAndWriteScore 层「无法正则+LLM」验收用例  

**轻微遗漏（可实施时从 spec 补全）**：
- 数据安全约束独立复述  
- resolveItemId 从 audit-item-mapping 导入  
- fallbackId idx 1-based  

**建议**：在生成 tasks-E5-S3.md、补充上述 plan 内容后，重新执行本审计。全部满足后方可判定「完全覆盖、验证通过」。
