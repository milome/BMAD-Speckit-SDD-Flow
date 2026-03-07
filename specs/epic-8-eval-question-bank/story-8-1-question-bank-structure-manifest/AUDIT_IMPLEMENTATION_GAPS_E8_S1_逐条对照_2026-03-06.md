# IMPLEMENTATION_GAPS 审计报告：E8-S1 逐条对照

**审计对象**：IMPLEMENTATION_GAPS-E8-S1.md  
**参考文档**：spec-E8-S1.md、plan-E8-S1.md、8-1-question-bank-structure-manifest.md、MANIFEST_SCHEMA.md  
**审计日期**：2026-03-06

---

## 1. spec-E8-S1.md 逐条对照

| 章节 | 需求要点 | IMPLEMENTATION_GAPS 对应 | 验证方式 | 验证结果 |
|------|----------|--------------------------|----------|----------|
| §1 概述 | 范围：目录结构、manifest schema、类型、加载器、校验、MANIFEST_SCHEMA 同步；不含 list/add/run | GAP-8.1.1～8.1.7 覆盖目录/加载器/校验/测试 | 比对 Gaps 清单与 spec 范围 | ✅ 覆盖 |
| §2.1 约定 | v1/v2 目录、manifest-loader.ts 路径 | GAP-8.1.1（v2 目录）、GAP-8.1.3（加载器） | 对照 Gaps 清单 | ✅ 覆盖 |
| §2.2 目录必须存在 | v1、v2 必须存在；每版含 manifest.yaml；path 相对 manifest 所在目录 | GAP-8.1.1、GAP-8.1.6 | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.1 结构 | questions 数组；id/title/path 必填；difficulty/tags 可选 | GAP-8.1.2（类型） | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.2 字段约束 | id 版本内唯一；title；path 相对 manifest；difficulty/tags 任意 | GAP-8.1.2、GAP-8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.3 校验规则 | questions 为数组；每项含 id/title/path；id 版本内唯一；path 存在性 | GAP-8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |
| §4.1 类型定义 | EvalQuestionEntry、EvalQuestionManifest | GAP-8.1.2 | 对照 Gaps 清单 | ✅ 覆盖 |
| §4.2 加载器 | loadManifest(versionDir) 解析、校验、抛错 | GAP-8.1.3 | 对照 Gaps 清单 | ✅ 覆盖 |
| §5 版本隔离 | v1/v2 独立 manifest；loadManifest(v1Dir)/loadManifest(v2Dir) 分别返回 | GAP-8.1.6、GAP-8.1.7 | 对照 Gaps 清单 | ✅ 覆盖 |
| §6 MANIFEST_SCHEMA 同步 | 文档与实现一致；§3 题目模板与 parser 兼容与 schema 无冲突 | GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| §7 测试要求 | Vitest；loadManifest 解析/校验失败/版本隔离；不修改 eval-question-flow.test.ts | GAP-8.1.7 | 对照 Gaps 清单 | ✅ 覆盖 |
| §8 需求映射 | spec ↔ 原始需求 | IMPLEMENTATION_GAPS §2 映射清单 | 比对映射完整性 | ✅ 映射存在 |

---

## 2. plan-E8-S1.md 逐条对照

| 章节 | 需求要点 | IMPLEMENTATION_GAPS 对应 | 验证方式 | 验证结果 |
|------|----------|--------------------------|----------|----------|
| Phase 1 §2.1 | 建立 v1（已存在）、v2 目录；manifest questions: [] | GAP-8.1.1 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 1 §2.2 | YAML 解析库选型 | 未显式列出 | 比对 plan 与 Gaps | ⚠️ 隐含于 GAP-8.1.3（加载器实现） |
| Phase 1 §2.3 | v1/v2 存在；各含 manifest；可解析为 { questions: [] } | GAP-8.1.1、GAP-8.1.6 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 2 §3.1 | EvalQuestionEntry、EvalQuestionManifest 类型定义 | GAP-8.1.2 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 2 §3.2 | loadManifest；path.join；校验；抛错 | GAP-8.1.3、GAP-8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 2 §3.3 | 校验逻辑表（questions 非数组、缺字段、id 重复、path 不存在） | GAP-8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 2 §3.4 | 验收：loadManifest(v1) 返回；非法 manifest 抛错 | GAP-8.1.3、GAP-8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 3 §4.1 | 比对 MANIFEST_SCHEMA 与实现；§3 题目模板无冲突 | GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 3 §4.2 | 文档与实现一一对应 | GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 4 §5.1 | manifest-loader.test.ts 路径 | GAP-8.1.7 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 4 §5.2 | 用例：空 manifest、版本隔离、解析成功、格式错误、缺少必填、id 重复、path 不存在 | GAP-8.1.7 | 对照 Gaps 清单 | ⚠️ GAP-8.1.7 仅列「loadManifest 解析、校验、版本隔离」，未细分 plan 的 7 个具体用例 |
| Phase 4 §5.3 | 集成验证、真实 v1/v2/fixtures、不修改 eval-question-flow | GAP-8.1.7 | 对照 Gaps 清单 | ⚠️ 未显式列出「集成验证」「使用真实 v1/v2 或 fixtures」 |
| Phase 4 §5.4 | npx vitest run scoring/eval-questions、npm test | 未列出 | 比对 plan 与 Gaps | ⚠️ 未显式列入 Gaps |
| §7.1 集成测试 | manifest-loader 可导入、真实路径调用 | 未列入 Gaps | 比对 plan §7 与 Gaps | ⚠️ 未覆盖 plan §7.1 |
| §7.2 端到端 | 本 Story 无用户可见命令；由 Story 8.2 完成 | 非本 Story 实现范围 | 合理 | ✅ 无需 GAP |

---

## 3. 8-1-question-bank-structure-manifest.md 逐条对照

| 章节 | 需求要点 | IMPLEMENTATION_GAPS 对应 | 验证方式 | 验证结果 |
|------|----------|--------------------------|----------|----------|
| §1 需求追溯 | REQ-UX-5.1、5.2、5.9 覆盖 | IMPLEMENTATION_GAPS §2 映射清单 | 比对 | ✅ 映射清单含 spec §2～§7 全覆盖 |
| §2 Story | As a TeamLead；建立版本化目录与 manifest | GAP-8.1.1～8.1.6 | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.1 目录结构 | v1/v2；各含 manifest.yaml | GAP-8.1.1、GAP-8.1.6 | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.1 manifest schema | questions: [id, title, path, difficulty?, tags[]]；类型与加载器；校验 | GAP-8.1.2～8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.1 MANIFEST_SCHEMA 同步 | 与 schema 不一致则更新 | GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.1 版本隔离 | v1/v2 独立 manifest | GAP-8.1.6 | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.2 非本 Story | list/add/run 归属 8.2/8.3 | IMPLEMENTATION_GAPS 未含，符合范围 | 合理 | ✅ 无需 GAP |
| §4 AC-1 | manifest schema 含类型与加载器 | GAP-8.1.2、GAP-8.1.3 | 对照 Gaps 清单 | ✅ 覆盖 |
| §4 AC-2 | 版本隔离 | GAP-8.1.6、GAP-8.1.7 | 对照 Gaps 清单 | ✅ 覆盖 |
| §5 T1 | 建立目录结构 | GAP-8.1.1 | 对照 Gaps 清单 | ✅ 覆盖 |
| §5 T2 | 类型与加载器；loadManifest；校验 | GAP-8.1.2、GAP-8.1.3、GAP-8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |
| §5 T3 | MANIFEST_SCHEMA 同步 | GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| §5 T4 | 版本隔离与单元测试 | GAP-8.1.7 | 对照 Gaps 清单 | ✅ 覆盖 |
| §6.1 架构约束 | 数据隔离、目录约定、path 语义 | 隐含于 GAP-8.1.4、GAP-8.1.6 | 比对 | ✅ 覆盖 |
| §6.2 源树 | manifest-loader、MANIFEST_SCHEMA、版本目录 | GAP-8.1.1～8.1.7 | 对照 | ✅ 覆盖 |
| §6.3 测试标准 | Vitest；解析/校验失败/版本隔离；不修改 eval-question-flow | GAP-8.1.7 | 对照 Gaps 清单 | ✅ 覆盖 |
| §6.4 结构 | eval-questions 与 query/coach 同级；兼容 parsers | 隐含于目录与 schema | 合理 | ✅ 覆盖 |
| §6.5 References | MANIFEST_SCHEMA、epics、prd、sample-eval-question-report | 非 GAP 范围 | 合理 | ✅ 无需 |

---

## 4. MANIFEST_SCHEMA.md 逐条对照

| 章节 | 需求要点 | IMPLEMENTATION_GAPS 对应 | 验证方式 | 验证结果 |
|------|----------|--------------------------|----------|----------|
| §1 目录结构 | v1/v2；manifest.yaml；题目 id 版本内唯一 | GAP-8.1.1、GAP-8.1.4、GAP-8.1.6 | 对照 Gaps 清单 | ✅ 覆盖 |
| §2 manifest schema | questions 结构；id/title/path 必填；difficulty/tags 可选 | GAP-8.1.2、GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| §2.1 字段说明 | 与 spec 一致 | GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| §2.2 示例 | 示例格式 | GAP-8.1.5（文档同步） | 对照 Gaps 清单 | ✅ 覆盖 |
| §3 题目模板 | 最小模板；与 parser 兼容；占位符 | GAP-8.1.5（spec §6：§3 与 schema 无冲突） | 对照 Gaps 清单 | ✅ 覆盖 |
| §4 与 parser 衔接 | 加载、执行、解析写入、数据隔离 | 非 manifest-loader 直接范围 | 合理 | ✅ 无需 GAP |
| §5 校验规则 | manifest 存在；questions 数组；每项含 id/title/path；path 存在；id 版本内唯一 | GAP-8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |

---

## 5. IMPLEMENTATION_GAPS 对照基准声明检查

| 检查项 | 说明 | 验证结果 |
|--------|------|----------|
| 对照基准 | IMPLEMENTATION_GAPS 头部写明「对照基准：spec-E8-S1.md、plan-E8-S1.md、8-1-question-bank-structure-manifest.md」 | ⚠️ 未包含 MANIFEST_SCHEMA.md；用户明确指定 MANIFEST_SCHEMA 为参考文档 |
| 当前实现快照 | §3 列出 v1/v2、manifest-loader、MANIFEST_SCHEMA、单元测试路径及状态 | ✅ 完整 |
| 需求映射清单 | §2 映射 Gaps ↔ 需求文档章节 | ⚠️ 未显式映射 MANIFEST_SCHEMA.md 各节 |

---

## 6. 遗漏与偏差汇总

| 序号 | 遗漏/偏差 | 严重程度 | 说明 |
|------|-----------|----------|------|
| 1 | plan Phase 4 §5.2 七类用例 | 低 | GAP-8.1.7 仅概括「解析、校验、版本隔离」，未列出 plan 的 7 个具体用例（空 manifest、版本隔离、解析成功、格式错误、缺少必填、id 重复、path 不存在） |
| 2 | plan Phase 4 §5.3 集成验证与 fixtures | 中 | 未显式列入：loadManifest 从生产模块导入、使用真实 v1/v2 或 fixtures、与生产目录结构一致 |
| 3 | plan Phase 4 §5.4 验收命令 | 低 | 未列出 `npx vitest run scoring/eval-questions`、`npm test` 通过作为验收 |
| 4 | plan §7.1 集成测试计划 | 中 | manifest-loader 在生产代码关键路径可导入并调用的集成验证，未列入 Gaps |
| 5 | 对照基准缺少 MANIFEST_SCHEMA | 低 | 头部「对照基准」未包含用户指定的 MANIFEST_SCHEMA.md |

---

## 7. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、TDD 未执行、行号/路径漂移、验收一致性。

**每维度结论**：

- **遗漏需求点**：逐条对照 spec、plan、8-1、MANIFEST_SCHEMA 四份文档，发现 5 处遗漏或未显式覆盖：① plan Phase 4 §5.2 七类用例未细分；② plan Phase 4 §5.3 集成验证与 fixtures 未列入；③ plan Phase 4 §5.4 验收命令未列入；④ plan §7.1 集成测试计划未列入；⑤ 对照基准未包含 MANIFEST_SCHEMA.md。

- **边界未定义**：IMPLEMENTATION_GAPS 为 gap 清单型文档，不定义边界；边界由 spec/plan 定义，已覆盖。

- **验收不可执行**：GAP-8.1.7 提及单元测试，但未写入具体验收命令（`npx vitest run scoring/eval-questions`）；实现后验收可执行，Gaps 文档本身未强制要求写出验收命令，属可接受遗漏。

- **与前置文档矛盾**：无矛盾；需求映射与 Gaps 清单与 spec/plan 一致。

- **孤岛模块**：本 Story 产出 manifest-loader，Gaps 未要求「生产代码关键路径导入」的显式验证；plan §7.1 有集成验证计划，Gaps 未覆盖，存在「Gaps 与 plan 不一致」的轻微偏差。

- **伪实现/占位**：Gaps 为待实现清单，无伪实现问题。

- **TDD 未执行**：本 Story 不强制 TDD 标记；plan Phase 4 已定义测试用例，Gaps 覆盖测试需求。

- **行号/路径漂移**：所有引用路径（scoring/eval-questions/v1、v2、manifest-loader.ts 等）与当前实现快照一致，无漂移。

- **验收一致性**：Gaps 文档标注「AUDIT: PENDING - 待 code-review 审计」，未宣称通过；验收状态正确。

**本轮结论**：本轮存在 gap。具体项：1) plan Phase 4 §5.3 集成验证与 fixtures 未列入 Gaps；2) plan §7.1 集成测试计划未列入 Gaps；3) 对照基准未包含 MANIFEST_SCHEMA.md；4) GAP-8.1.7 未细分 plan 的 7 类测试用例；5) plan Phase 4 §5.4 验收命令未列入。不计数，修复后重新发起审计。

---

## 8. 审计结论

**结论**：**未完全覆盖、验证未通过**。

**遗漏章节或未覆盖要点**：

1. **plan-E8-S1.md Phase 4 §5.2**：7 类测试用例（空 manifest、版本隔离、解析成功、格式错误、缺少必填、id 重复、path 不存在）未在 GAP-8.1.7 中细分列出。
2. **plan-E8-S1.md Phase 4 §5.3**：集成验证（loadManifest 从生产模块导入、使用真实 v1/v2 或 fixtures）、不修改 eval-question-flow.test.ts，未显式列入 Gaps。
3. **plan-E8-S1.md Phase 4 §5.4**：验收命令（`npx vitest run scoring/eval-questions`、`npm test`）未列入 Gaps。
4. **plan-E8-S1.md §7.1**：集成测试计划（manifest-loader 可被导入、真实路径调用、模块在生产代码关键路径）未列入 Gaps。
5. **对照基准**：IMPLEMENTATION_GAPS 头部「对照基准」未包含用户指定的 MANIFEST_SCHEMA.md；需求映射清单 §2 未显式映射 MANIFEST_SCHEMA.md 各节。

**建议修复**：在 IMPLEMENTATION_GAPS 中补充上述 5 项；将 MANIFEST_SCHEMA.md 加入对照基准；扩展 GAP-8.1.7 或新增 GAP 覆盖 plan §5.3、§5.4、§7.1；更新 §2 需求映射清单以包含 MANIFEST_SCHEMA.md。

---

*本审计报告符合 audit-prompts-critical-auditor-appendix.md 格式要求。*
