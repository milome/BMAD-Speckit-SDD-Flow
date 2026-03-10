# Spec E5-S3 审计报告 §1.2：需求覆盖与模糊表述检查

**审计日期**：2026-03-05  
**审计对象**：`specs/epic-5/story-3-eval-parser-llm-fallback/spec-E5-S3.md`  
**原始需求文档**：
1. `_bmad-output/implementation-artifacts/5-3-eval-parser-llm-fallback/5-3-eval-parser-llm-fallback.md`（Story 5.3）
2. `_bmad-output/patent/TASKS_gaps功能补充实现.md`（GAP-B05 章节）

**审计类型**：逐条需求覆盖验证 + 模糊表述标注

---

## 1. 模型选择信息

| 项目 | 值 |
|------|-----|
| 配置来源 | .claude/agents/code-reviewer.md |
| 指定模型 | inherit（来自 frontmatter，继承主 Agent 模型） |
| 选择依据 | 子代理 YAML 中 model: inherit；可改为 fast 以节省审计成本（若环境支持） |

---

## 2. 逐条验证结果

### 2.1 Story 5.3 文档覆盖

| 来源章节 | 需求要点 | spec 对应 | 验证方式 | 结果 |
|----------|----------|-----------|----------|------|
| §0 Party-Mode 决议 | LLM 调用：Node.js fetch、/v1/chat/completions、OpenAI API 格式 | §3.1.2 | 文本对照 | ✅ 通过 |
| §0 | SCORING_LLM_BASE_URL 自定义 | §2.1, §3.1.2 | 文本对照 | ✅ 通过 |
| §0 | 重试策略：校验失败重试 1 次，最多 2 次，两次均失败抛 ParseError | §3.1.3 | 文本对照 | ✅ 通过 |
| §0 | 数据安全：无 key 时跳过；system prompt 不含代码片段 | §2.1, §3.1.1 | 文本对照 | ✅ 通过 |
| §0 | Fallback 链：正则成功→不调用；正则失败+无 key→抛错；正则失败+有 key→调用 | §2.1 | 文本对照 | ✅ 通过 |
| §0 | 超时 SCORING_LLM_TIMEOUT_MS 默认 30000 | §2.1, §3.1.2 | 文本对照 | ✅ 通过 |
| §0.3 | 数据安全警告：全文发送、未配置 key 跳过、system prompt 指令 | §2.1, §3.1.1 | 文本对照 | ✅ 通过 |
| §0.3 | **使用前应确认 LLM API 提供方的数据处理协议** | 无 | 全文检索 | ⚠️ 未覆盖 |
| §1 Story | 正则失败时 LLM 结构化提取，非标格式可解析 | §2.1, §3 | 语义对照 | ✅ 通过 |
| §2.1 | 新增 llm-fallback.ts：llmStructuredExtract、LlmExtractionResult、LLM_SYSTEM_PROMPT | §2.1, §3.1 | 文本对照 | ✅ 通过 |
| §2.1 | 四解析器在 extractOverallGrade 返回 null 时接入 | §3.2 | 文本对照 | ✅ 通过 |
| §2.1 | arch/story 改为从 audit-generic 复用 extractOverallGrade | §2.1, §3.2.2, §3.2.3 | 文本对照 | ✅ 通过 |
| §2.2 | Out of scope（B03/B11/B06 等） | §2.2 | 文本对照 | ✅ 通过 |
| §4 AC-B05-1~7 | 全部 7 条验收标准 | §4 映射表 | 逐条对照 | ✅ 通过 |
| §5 Task 1.1~1.5 | llm-fallback 核心实现子任务 | §3.1 | 文本对照 | ✅ 通过 |
| §5 Task 2.1~2.4 | 四解析器接入子任务 | §3.2 | 文本对照 | ✅ 通过 |
| §6.6 | 各 parser 集成测试：需补充「正则失败+有 key+LLM 成功」与「正则失败+无 key→抛错」 | §4 AC-B05-7 | 文本对照 | ⚠️ 模糊表述 |

---

### 2.2 GAP-B05 章节覆盖

| 来源条目 | 需求要点 | spec 对应 | 验证方式 | 结果 |
|----------|----------|-----------|----------|------|
| Party-Mode 决策 1~5 | 准确名称、fallback 链、无 key 跳过、重试、超时 | §2.1, §3.1 | 文本对照 | ✅ 通过 |
| 数据安全警告 | 三项措施 | §2.1, §3.1.1 | 文本对照 | ✅ 通过 |
| LlmExtractionResult | grade、issues、veto_items | §3.1.1 | 文本对照 | ✅ 通过 |
| LLM_SYSTEM_PROMPT | 完整 prompt 文本（含 JSON 格式说明） | §3.1.1 仅要求「必须包含」子句 | 文本对照 | ✅ 通过（实现级细节） |
| llmStructuredExtract 签名 | (reportContent, stage) | §3.1.2 | 文本对照 | ✅ 通过 |
| 环境变量 | API_KEY、BASE_URL、MODEL、TIMEOUT_MS | §2.1, §3.1.2 | 文本对照 | ✅ 通过 |
| fetch + AbortSignal.timeout | Node.js 内置 fetch | §3.1.2 | 文本对照 | ✅ 通过 |
| 结构校验 | grade A|B|C|D；issues severity 高|中|低 | §3.1.3 | 文本对照 | ✅ 通过 |
| 校验失败重试 1 次 | 最多 2 次调用 | §3.1.3 | 文本对照 | ✅ 通过 |
| 超时/网络错误 → ParseError | §3.1.4 | 文本对照 | ✅ 通过 |
| 修改 audit-prd/arch/story/generic | 四解析器接入逻辑 | §3.2 | 文本对照 | ✅ 通过 |
| 6 个测试用例 | 1~6 对应 AC | §4 | 逐条映射 | ✅ 通过 |
| 失败影响 | LLM 不可用退回、超时最多 60s | §2.1 隐含、§3.1.4 | 语义对照 | ✅ 通过 |

---

### 2.3 模糊表述与遗漏详细标注

#### 2.3.1 **spec 存在模糊表述**

| 位置 | 问题描述 | 触发 clarify 的建议 |
|------|----------|---------------------|
| **§3.2.5 issues 与 CheckItem 映射** | LLM 返回的 `issues[]` 仅有 `{ severity, description }`，无 `item_id`。spec 要求映射为 `CheckItem[]` 含 `item_id`、`passed`、`score_delta`、`note`，但 **未定义 `item_id` 如何生成**（例如：是否使用 `resolveItemId`、`llm_${stage}_issue_${idx}` 或其它规则）。 | 补充：`item_id` 的生成规则（如基于 description 的 resolveItemId、或顺序 id `llm_{stage}_issue_{idx}`） |
| **§3.2.5 veto_items 映射** | `LlmExtractionResult` 含 `veto_items: string[]`，但 spec §3.2.5 仅描述 **issues → CheckItem** 的映射，**未定义 veto_items 如何并入 check_items**。现有 veto 模块依赖 `check_items` 中的 veto 类 item_id 判定；若 LLM 返回 veto_items，需明确：是否将 veto_items 转为 `CheckItem[]`（passed=false, score_delta=-10）、是否与 issues 合并、veto_items 的 item_id 是否需与 rules YAML 中的 veto 定义一致。 | 补充：veto_items 的映射规则与与 check_items 的合并策略 |
| **§4 AC-B05-7 验证方式** | 描述为「代码审查 + 各 parser 单测覆盖」，Story 5.3 §6.6 明确要求补充两种场景：①「正则失败 + 有 API key + LLM 成功」②「正则失败 + 无 API key → 抛错」。spec 未显式列出这两种场景，**验证范围不够明确**。 | 在 §4 AC-B05-7 中明确：各 parser 单测须覆盖上述两种集成场景 |

#### 2.3.2 **需求未覆盖**

| 来源 | 未覆盖内容 | 建议 |
|------|------------|------|
| Story 5.3 §0.3、GAP-B05 数据安全 | 「使用前应确认 LLM API 提供方的数据处理协议符合项目安全要求」 | 可在 spec §2.1 数据安全约束或 §6 与后续文档映射约定中补充为「实现或部署时须在文档/README 中提示用户确认 API 提供方数据处理协议」 |

---

## 3. 验证方式与执行记录

### 3.1 执行的验证操作

| 操作 | 命令/方法 | 结果 |
|------|-----------|------|
| spec 全文读取 | Read spec-E5-S3.md | 已执行 |
| Story 5.3 全文读取 | Read 5-3-eval-parser-llm-fallback.md | 已执行 |
| GAP-B05 章节读取 | Read TASKS_gaps功能补充实现.md L323-397 | 已执行 |
| CheckItem 结构确认 | Read scoring/writer/types.ts | CheckItem 含 item_id、passed、score_delta、note |
| veto 判定逻辑确认 | Grep veto_items、isVetoTriggered | veto 依赖 check_items 中 item_id 匹配 vetoIds |
| extractCheckItems item_id 规则 | Read audit-generic.ts | 使用 resolveItemId(stage, description, fallbackId) |

### 3.2 未执行的验证（不适用）

- 代码运行/单元测试：本审计聚焦 spec 与需求文档的文本覆盖，不涉及实现验证
- plan/tasks 文档对照：审计范围限定为 spec，后续 plan/tasks 审计单独进行

---

## 4. 结论

### 4.1 覆盖状态汇总

| 维度 | 结果 |
|------|------|
| Story 5.3 核心需求 | 基本覆盖（除「使用前确认 API 协议」1 条未覆盖） |
| GAP-B05 实现方案 | 完全覆盖 |
| AC 映射 | 7 条 AC 全部有 spec 对应 |
| 需求追溯清单 | 与 §5 一致，来源可追溯 |

### 4.2 是否「完全覆盖、验证通过」

**否。**

### 4.3 未通过项清单

1. **spec 存在模糊表述**（须触发 clarify 澄清流程）：
   - **§3.2.5**：`item_id` 从 LLM issues 的生成规则未定义
   - **§3.2.5**：`veto_items` 的映射与并入 `check_items` 的策略未定义
   - **§4 AC-B05-7**：各 parser 集成测试的具体场景未明确列出

2. **需求遗漏**：
   - 数据安全「使用前应确认 LLM API 提供方的数据处理协议」未在 spec 中体现

### 4.4 建议后续动作

1. 执行 **clarify** 流程，针对上述模糊表述补充：
   - issues → CheckItem 的 `item_id` 生成规则
   - `veto_items` 的映射与合并规则
   - AC-B05-7 的 parser 集成测试场景清单
2. 在 spec §2.1 或 §6 中补充数据安全提示条款（或注明由 plan/README 负责）
3. clarify 完成后，更新本审计报告的结论与追溯清单
