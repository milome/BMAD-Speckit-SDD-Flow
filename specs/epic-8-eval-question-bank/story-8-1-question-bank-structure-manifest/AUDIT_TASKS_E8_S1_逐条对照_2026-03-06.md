# Tasks E8-S1 逐条对照审计报告

**审计对象**：specs/epic-8/story-8-1-question-bank-structure-manifest/tasks-E8-S1.md  
**参考文档**：
1. spec-E8-S1.md
2. plan-E8-S1.md
3. IMPLEMENTATION_GAPS-E8-S1.md
4. _bmad-output/implementation-artifacts/epic-8-eval-question-bank/story-8-1-question-bank-structure-manifest/8-1-question-bank-structure-manifest.md

**审计日期**：2026-03-06  
**审计依据**：audit-prompts tasks.md 审计提示词；audit-prompts-critical-auditor-appendix.md

---

## 1. 逐条对照检查与验证

### 1.1 需求文档（8-1-question-bank-structure-manifest.md）覆盖验证

| 原始文档章节 | 原始要点 | 验证方式 | tasks 对应 | 验证结果 |
|-------------|----------|----------|------------|----------|
| §1 需求追溯 | REQ-UX-5.1 目录结构 v1/ | 核对 tasks §1 需求追溯表、T1 | T1 建立目录结构；§1 表 T1 → §5 T1 | ✅ 覆盖 |
| §1 | REQ-UX-5.2 manifest schema | 核对 T2、§1 表 | T2 manifest schema；§1 表 T2 → §5 T2 | ✅ 覆盖 |
| §3.1 目录结构 | 建立 v1、v2，每版本含 manifest.yaml | 核对 T1.1～T1.3 | T1.1 v1 存在；T1.2 v2 存在；T1.3 各含 manifest.yaml | ✅ 覆盖 |
| §3.1 manifest schema | questions: [{ id, title, path, difficulty?, tags[] }] | 核对 T2.1 | T2.1 EvalQuestionEntry、EvalQuestionManifest；id、title、path 必填；difficulty、tags 可缺省 | ✅ 覆盖 |
| §3.1 类型与加载器 | manifest-loader.ts；loadManifest | 核对 T2.2、§3 生产代码实现 | T2.2 loadManifest(versionDir)；manifest-loader.ts 路径、导出 | ✅ 覆盖 |
| §3.1 校验规则 | id 版本内唯一、path 存在性 | 核对 T2.3 | T2.3 id 在版本内唯一；path 指向文件存在 | ✅ 覆盖 |
| §3.1 MANIFEST_SCHEMA 同步 | 文档与实现一致 | 核对 T3 | T3.1、T3.2 比对并更新 | ✅ 覆盖 |
| §3.1 版本隔离 | v1/v2 独立 manifest | 核对 T1、T4 | T4.1 版本隔离用例；T4.3 真实 v1/v2 路径 | ✅ 覆盖 |
| §4 AC-1 | manifest schema 定义、TypeScript 类型与加载器 | 核对 T1、T2 验收 | T2 验收 loadManifest 返回；T2 验收含集成验证（T4.3） | ✅ 覆盖 |
| §4 AC-2 | 版本隔离，v1 与 v2 清单独立 | 核对 T4 验收 | T4.1 版本隔离；T4.3 真实 v1/v2 调用 | ✅ 覆盖 |
| §5 T1 | 建立目录结构 | 核对 T1 | T1.1～T1.3 | ✅ 覆盖 |
| §5 T2 | manifest schema 类型与加载器 | 核对 T2 | T2.1～T2.3 | ✅ 覆盖 |
| §5 T3 | MANIFEST_SCHEMA.md 同步 | 核对 T3 | T3.1、T3.2 | ✅ 覆盖 |
| §5 T4 | 版本隔离与单元测试 | 核对 T4 | T4.1 单元测试、T4.2 解析成功/失败、T4.3 集成测试 | ✅ 覆盖 |
| §6.3 测试标准 | Vitest；解析、校验失败、版本隔离；不修改 eval-question-flow.test.ts | 核对 T4 约束 | T4 测试文件 manifest-loader.test.ts；约束「不修改 eval-question-flow.test.ts」 | ✅ 覆盖 |

**验证说明**：Story §5 T4.2 仅写「格式错误、缺少必填字段」，tasks 已扩展为 plan §5.2 的 7 类用例（含 id 重复、path 不存在），符合 plan 与 IMPLEMENTATION_GAPS 的 GAP-8.1.7a 要求。

---

### 1.2 spec-E8-S1.md 覆盖验证

| spec 章节 | 原始要点 | 验证方式 | tasks 对应 | 验证结果 |
|-----------|----------|----------|------------|----------|
| §2 目录结构 | v1、v2、manifest-loader.ts | 核对 T1、T2 | T1 建立 v1/v2；T2 manifest-loader.ts | ✅ 覆盖 |
| §3.1 结构 | questions: [{ id, title, path, difficulty?, tags[] }] | 核对 T2.1 | T2.1 类型定义 | ✅ 覆盖 |
| §3.2 字段约束 | id/title/path 必填；difficulty/tags 可选 | 核对 T2.1 | T2.1 必填、可缺省 | ✅ 覆盖 |
| §3.3 校验规则 | questions 数组；id 唯一；path 存在 | 核对 T2.3 | T2.3 四类校验 | ✅ 覆盖 |
| §4.1 类型 | EvalQuestionEntry、EvalQuestionManifest | 核对 T2.1 | T2.1 完整定义 | ✅ 覆盖 |
| §4.2 加载器 | loadManifest(versionDir) | 核对 T2.2 | T2.2 函数签名与行为 | ✅ 覆盖 |
| §5 版本隔离 | v1/v2 独立 manifest | 核对 T4.1、T4.3 | 版本隔离用例；集成测试真实 v1/v2 | ✅ 覆盖 |
| §6 MANIFEST_SCHEMA 同步 | 文档与实现一致；§3 题目模板与 schema 无冲突 | 核对 T3 | T3.2「§3 题目模板与 schema 无冲突」 | ✅ 覆盖 |
| §7 测试要求 | Vitest；解析、校验失败、版本隔离；不修改 eval-question-flow | 核对 T4 | T4 七类用例；约束不修改 e2e | ✅ 覆盖 |

---

### 1.3 plan-E8-S1.md 覆盖验证

| plan 章节 | 原始要点 | 验证方式 | tasks 对应 | 验证结果 |
|-----------|----------|----------|------------|----------|
| Phase 1 §2.1 | 建立 v1、v2；manifest.yaml questions: [] | 核对 T1 | T1.1～T1.3；T1.3 v2 新建空 manifest | ✅ 覆盖 |
| Phase 1 §2.3 验收 | v1、v2 存在；各含 manifest.yaml；可解析 { questions: [] } | 核对 T1 验收 | T1 验收完整对应 | ✅ 覆盖 |
| Phase 2 §3.1 | 类型定义 EvalQuestionEntry、EvalQuestionManifest | 核对 T2.1 | T2.1 接口定义 | ✅ 覆盖 |
| Phase 2 §3.2 | loadManifest；path.join；yaml 解析；校验 | 核对 T2.2、生产代码实现 | T2.2；js-yaml、fs.existsSync | ✅ 覆盖 |
| Phase 2 §3.3 | 校验：questions 非数组、缺 id/title/path、id 重复、path 不存在 | 核对 T2.3、T4.2 | T2.3；T4.2 格式错误、缺必填、id 重复、path 不存在 | ✅ 覆盖 |
| Phase 2 §3.4 验收 | loadManifest(v1) 返回；非法 manifest 抛错 | 核对 T2 验收 | T2 验收完整 | ✅ 覆盖 |
| Phase 3 §4.1 | 比对 MANIFEST_SCHEMA；更新；§3 题目模板与 schema 无冲突 | 核对 T3 | T3.1、T3.2 | ✅ 覆盖 |
| Phase 4 §5.1 | manifest-loader.test.ts 路径 | 核对 T4 测试文件 | T4 测试文件：scoring/eval-questions/__tests__/manifest-loader.test.ts | ✅ 覆盖 |
| Phase 4 §5.2 用例 | 空 manifest、版本隔离、解析成功、格式错误、缺必填、id 重复、path 不存在 | 核对 T4 用例 | T4 用例行：空 manifest、版本隔离、解析成功、格式错误、缺必填、id 重复、path 不存在、集成 | ✅ 覆盖 |
| Phase 4 §5.3 集成验证 | 从生产模块 import loadManifest；真实 v1/v2 或 fixtures；不修改 eval-question-flow | 核对 T4.3、约束 | T4.3「从 scoring/eval-questions/manifest-loader 导入 loadManifest，使用真实 v1/v2 路径」；约束不修改 eval-question-flow.test.ts | ✅ 覆盖 |
| Phase 4 §5.4 验收 | npx vitest run scoring/eval-questions；npm test | 核对 §6 验收命令 | §6 两条命令完整 | ✅ 覆盖 |
| §7.1 集成测试 | manifest-loader 可被正确导入并调用；真实路径 | 核对 T4.3、T2 验收、T4 验收 | T4.3 集成测试；T2 验收「由 T4.3 集成测试验证」；T4 验收「manifest-loader 在生产代码关键路径中的集成验证（T4.3）」 | ✅ 覆盖 |
| §7.2 端到端 | 本 Story 无用户可见命令；E2E 由 Story 8.2 完成 | 核对 tasks 范围 | tasks 未要求本 Story 实现 E2E，与 plan 一致 | ✅ 合理 |

---

### 1.4 IMPLEMENTATION_GAPS-E8-S1.md 覆盖验证

| Gap ID | GAP 要点 | 验证方式 | tasks 对应 | 验证结果 |
|--------|----------|----------|------------|----------|
| GAP-8.1.1 | v2 目录及 manifest.yaml | 核对 T1、§4 验收表 | T1.2、T1.3；§4 GAP-8.1.1 → T1 | ✅ 覆盖 |
| GAP-8.1.2 | EvalQuestionEntry、EvalQuestionManifest 类型 | 核对 T2.1、§4 | T2.1；§4 GAP-8.1.2 → T2 | ✅ 覆盖 |
| GAP-8.1.3 | loadManifest(versionDir) | 核对 T2.2、§4 | T2.2；§4 GAP-8.1.3 集成测试要求「调用 loadManifest 返回正确」 | ✅ 覆盖 |
| GAP-8.1.4 | 校验：id 唯一、path 存在 | 核对 T2.3、T4.2、§4 | T2.3；T4.2 非法输入抛错；§4 GAP-8.1.4 | ✅ 覆盖 |
| GAP-8.1.5 | MANIFEST_SCHEMA.md 同步 | 核对 T3、§4 | T3；§4 GAP-8.1.5 → T3 | ✅ 覆盖 |
| GAP-8.1.6 | v2、loadManifest；版本隔离 | 核对 T1、T2、T4、§4 | T4.1 版本隔离；§4 GAP-8.1.6 | ✅ 覆盖 |
| GAP-8.1.7 | 单元测试：manifest-loader.test.ts | 核对 T4、§4 | T4.1、T4.2、T4.3；§4 GAP-8.1.7～8.1.7d | ✅ 覆盖 |
| GAP-8.1.7a | 7 类用例：空 manifest、版本隔离、解析成功、格式错误、缺必填、id 重复、path 不存在 | 核对 T4 用例、§4 | T4 用例行完整；§4 GAP-8.1.7～8.1.7d 行「单元+集成：从生产模块 import loadManifest，使用真实 v1/v2 路径调用」 | ✅ 覆盖 |
| GAP-8.1.7b | 从生产模块 import、真实 v1/v2 或 fixtures；不修改 eval-question-flow.test.ts | 核对 T4.3、约束 | T4.3 明确「从 scoring/eval-questions/manifest-loader 导入」；约束不修改 eval-question-flow.test.ts | ✅ 覆盖 |
| GAP-8.1.7c | npx vitest run scoring/eval-questions、npm test | 核对 §6 | §6 验收命令完整 | ✅ 覆盖 |
| GAP-8.1.7d | manifest-loader 可被导入、真实路径调用 | 核对 T4.3、§4 | T4.3「使用真实 v1/v2 路径调用，验证返回正确；确保 manifest-loader 可在生产代码关键路径中被导入、实例化并调用」；§4 GAP-8.1.7 行补充「集成测试要求」 | ✅ 覆盖 |

**§4 GAP-8.1.7 行补充验证**：tasks §4 表格 GAP-8.1.7～8.1.7d 行「集成测试要求」列已写明：「单元+集成：从生产模块 import loadManifest，使用真实 v1/v2 路径调用；npx vitest run scoring/eval-questions」。与上一轮审计要求的 §4 GAP-8.1.7 行补充集成测试要求一致。✅

---

## 2. 专项审查

### 2.1 集成测试与端到端功能测试

| 审查项 | 要求 | 验证方式 | tasks 对应 | 验证结果 |
|--------|------|----------|------------|----------|
| (1) 每个功能模块/Phase 是否包含集成测试与端到端测试 | 严禁仅有单元测试 | 逐 Phase 核对 | Phase 1（目录）：无生产代码模块，仅目录与 manifest，由 T4.3 的 loadManifest 真实路径调用间接验证；Phase 2（manifest-loader）：T4.3 集成测试明确「从生产模块 import loadManifest，使用真实 v1/v2 路径调用」；Phase 3（文档）：文档比对，无代码模块；Phase 4：T4.3 集成测试 | ✅ 通过 |
| 端到端测试 | plan §7.2 明确本 Story 无用户可见命令，E2E 由 Story 8.2 完成 | 核对 plan 与 tasks | tasks 未要求本 Story 实现 E2E；plan §7.2 已说明 | ✅ 合理 |

**结论**：manifest-loader 模块有 T4.3 集成测试，满足「严禁仅有单元测试」；本 Story 为基础设施，端到端由 Story 8.2 list 命令完成，与 plan 一致。

---

### 2.2 验收标准是否包含「生产代码关键路径集成验证」

| 模块/Phase | 验收标准要求 | 验证方式 | tasks 对应 | 验证结果 |
|------------|---------------|----------|------------|----------|
| manifest-loader（T2、T4） | 该模块可在生产代码关键路径中被导入、实例化并调用 | 核对 T2、T4 验收 | T2 验收：「验收须包含：manifest-loader 可在生产代码关键路径中被导入、实例化并调用（由 T4.3 集成测试验证）」；T4 验收：「验收须包含 manifest-loader 在生产代码关键路径中的集成验证（T4.3）」 | ✅ 已包含 |
| Phase 1（目录） | 无代码模块，仅目录存在 | — | T1 验收为目录与 manifest 可解析 | ✅ 不适用 |
| Phase 3（文档） | 文档与实现一致 | — | T3 验收 | ✅ 不适用 |

**结论**：T2、T4 验收均已明确包含「manifest-loader 可在生产代码关键路径中被导入、实例化并调用」的集成验证，由 T4.3 执行。✅

---

### 2.3 孤岛模块检查

| 审查项 | 风险描述 | 验证方式 | 验证结果 |
|--------|----------|----------|----------|
| manifest-loader | 模块内部完整且可通过单元测试，但从未在生产代码关键路径中被导入或调用 | 核对 tasks 是否要求验证「被导入并调用」 | T4.3 明确从生产模块 import loadManifest，使用真实 v1/v2 路径调用；T2、T4 验收均要求集成验证；§5 Agent 规则「禁止仅初始化对象而不在关键路径中使用」「集成任务必须修改生产代码路径」 | ✅ 无孤岛风险；tasks 已覆盖集成验证 |
| 后续调用方 | Story 8.2 list 命令、Story 8.3 run 命令将导入 loadManifest | plan §7.1 说明 | 本 Story 产出为可复用基础设施；T4.3 验证接口可被正确导入并调用，为 Story 8.2 集成做准备 | ✅ 合理 |

**结论**：tasks 已通过 T4.3 集成测试及 T2、T4 验收要求，防止 manifest-loader 成为孤岛模块。✅

---

## 3. 上一轮审计补充项逐条验证

| 补充项 | 要求 | 验证方式 | 验证结果 |
|--------|------|----------|----------|
| (1) T4.3 集成测试 | 从生产模块 import loadManifest、真实 v1/v2 路径调用 | 核对 T4.3 描述 | T4.3：「集成测试：从 `scoring/eval-questions/manifest-loader` 导入 `loadManifest`，使用真实 v1/v2 路径调用，验证返回正确；确保 manifest-loader 可在生产代码关键路径中被导入、实例化并调用」 | ✅ 已补充 |
| (2) T2、T4 验收增加集成验证 | manifest-loader 可在生产代码关键路径中被导入、实例化并调用 | 核对 T2、T4 验收 | T2 验收含「由 T4.3 集成测试验证」；T4 验收含「manifest-loader 在生产代码关键路径中的集成验证（T4.3）」 | ✅ 已补充 |
| (3) §4 GAP-8.1.7 行补充集成测试要求 | GAP-8.1.7 对应行须体现集成测试 | 核对 §4 表格 | §4 GAP-8.1.7～8.1.7d 行「集成测试要求」列：「单元+集成：从生产模块 import loadManifest，使用真实 v1/v2 路径调用；npx vitest run scoring/eval-questions」 | ✅ 已补充 |

---

## 4. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、TDD 未执行、行号/路径漂移、验收一致性。

**每维度结论**：

- **遗漏需求点**：逐条对照 8-1-question-bank-structure-manifest、spec-E8-S1、plan-E8-S1、IMPLEMENTATION_GAPS-E8-S1 四份文档共 50+ 条款，tasks 的 §1 需求追溯表、§2 Gaps 映射表、§3 任务明细、§4 按 Gap 逐条验收表均完整覆盖。Story §5 T4.2 原始仅写「格式错误、缺少必填字段」，tasks 已扩展为 plan 的 7 类用例（含 id 重复、path 不存在），无遗漏。

- **边界未定义**：校验规则（questions 非数组、缺必填、id 重复、path 不存在）已在 T2.3、T4.2 中明确；空 manifest、版本隔离等边界在 T4 用例中覆盖。tasks 未引入新边界歧义。

- **验收不可执行**：T1 验收「v1、v2 目录存在；各含 manifest.yaml；可解析为 { questions: [] }」可执行；T2 验收「loadManifest 返回；非法 manifest 抛错；集成验证由 T4.3」可执行；T3 验收「文档与实现一一对应」可执行；T4 验收「npx vitest run scoring/eval-questions 全部通过；npm test 通过；T4.3 集成验证」可执行。§6 验收命令已列出。

- **与前置文档矛盾**：tasks 与 spec、plan、IMPLEMENTATION_GAPS 逐条比对无矛盾。T2.3 补充 path 存在性校验来源于 spec §3.3、plan §3.3，非 Story §5 直接写出，但 spec/plan 为 tasks 的权威参考，一致。类型可内联于 manifest-loader.ts，与 plan §3.1「types.ts 或内联于 manifest-loader.ts」一致。

- **孤岛模块**：manifest-loader 为本 Story 唯一生产代码模块。T4.3 要求从生产模块 import loadManifest 并使用真实 v1/v2 路径调用；T2、T4 验收均要求「manifest-loader 可在生产代码关键路径中被导入、实例化并调用」。plan §7.2 明确本 Story 无用户可见命令，E2E 由 Story 8.2 完成；本 Story 的集成验证通过 T4.3 实现，满足「严禁仅有单元测试」且防止孤岛。无孤岛风险。

- **伪实现/占位**：tasks 未使用「可选」「待定」「预留」「占位」等规避词。§5 Agent 规则明确禁止占位。T1～T4 子任务均可直接实施，无假完成表述。

- **TDD 未执行**：tasks §5 Agent 规则第 5 条要求「TDD 红绿灯：红灯→绿灯→重构；每涉及生产代码的 US 须有 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录」。tasks 未在任务描述中显式标注 [TDD-RED] 等标记位，但实施规则已要求；实施时由 Agent 按 TDD 流程执行。本项为实施阶段执行约束，非 tasks 文档结构遗漏。**通过**。

- **行号/路径漂移**：所有引用路径与参考文档一致：scoring/eval-questions/v1、v2、manifest-loader.ts、manifest-loader.test.ts、eval-question-flow.test.ts、MANIFEST_SCHEMA.md。无漂移。

- **验收一致性**：§6 验收命令「npx vitest run scoring/eval-questions」「npm test」与 plan §5.4、IMPLEMENTATION_GAPS GAP-8.1.7c 一致。T4 验收要求「npx vitest run scoring/eval-questions 全部通过；npm test 通过」，与验收命令可对应。无矛盾。

**本轮结论**：本轮无新 gap。tasks-E8-S1.md 已完全覆盖需求文档、spec、plan、IMPLEMENTATION_GAPS 所有相关章节；T4.3 集成测试、T2/T4 验收的集成验证、§4 GAP-8.1.7 行的集成测试要求均已按上一轮审计补充；专项审查三项（集成测试、验收含关键路径集成验证、孤岛模块）均通过。

---

## 5. 结论

**完全覆盖、验证通过。**

tasks-E8-S1.md 已完全覆盖原始需求设计文档（8-1-question-bank-structure-manifest）、spec-E8-S1.md、plan-E8-S1.md、IMPLEMENTATION_GAPS-E8-S1.md 的所有相关章节。专项审查三项均满足：（1）manifest-loader 模块包含 T4.3 集成测试，非仅有单元测试；（2）T2、T4 验收均包含「manifest-loader 可在生产代码关键路径中被导入、实例化并调用」的集成验证；（3）无孤岛模块风险。上一轮审计的三项补充（T4.3 集成测试、T2/T4 验收增加集成验证、§4 GAP-8.1.7 行补充集成测试要求）已逐条落实并验证通过。

---

## 可解析评分块（供 parseAndWriteScore）

总体评级: A

维度评分:
- 需求完整性: 95/100
- 可测试性: 92/100
- 一致性: 90/100
- 可追溯性: 88/100

---

*本审计报告符合 audit-prompts-critical-auditor-appendix.md 格式要求。*
