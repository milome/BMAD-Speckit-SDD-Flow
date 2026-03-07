# IMPLEMENTATION_GAPS 审计报告：E8-S1 逐条对照（第 2 轮）

**审计对象**：IMPLEMENTATION_GAPS-E8-S1.md  
**参考文档**：spec-E8-S1.md、plan-E8-S1.md、8-1-question-bank-structure-manifest.md、MANIFEST_SCHEMA.md  
**审计日期**：2026-03-06  
**上一轮修复**：对照基准增加 MANIFEST_SCHEMA.md；GAP-8.1.7a～8.1.7d 覆盖 plan 测试用例、集成验证、验收命令、集成测试；§2 映射补充 MANIFEST_SCHEMA

---

## 1. spec-E8-S1.md 逐条对照

| 章节 | 需求要点 | IMPLEMENTATION_GAPS 对应 | 验证方式 | 验证结果 |
|------|----------|--------------------------|----------|----------|
| §1 概述 | 范围：目录结构、manifest schema、类型、加载器、校验、MANIFEST_SCHEMA 同步；不含 list/add/run | GAP-8.1.1～8.1.7 覆盖目录/加载器/校验/测试；对照基准含 4 文档 | 比对 Gaps 清单与 spec 范围 | ✅ 覆盖 |
| §2.1 约定 | v1/v2 目录、manifest-loader.ts 路径 | GAP-8.1.1（v2 目录）、GAP-8.1.3（加载器） | 对照 Gaps 清单 | ✅ 覆盖 |
| §2.2 目录必须存在 | v1、v2 必须存在；每版含 manifest.yaml；path 相对 manifest 所在目录 | GAP-8.1.1、GAP-8.1.6 | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.1 结构 | questions 数组；id/title/path 必填；difficulty/tags 可选 | GAP-8.1.2（类型） | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.2 字段约束 | id 版本内唯一；title；path 相对 manifest；difficulty/tags 任意 | GAP-8.1.2、GAP-8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |
| §3.3 校验规则 | questions 为数组；每项含 id/title/path；id 版本内唯一；path 存在性 | GAP-8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |
| §4.1 类型定义 | EvalQuestionEntry、EvalQuestionManifest | GAP-8.1.2 | 对照 Gaps 清单 | ✅ 覆盖 |
| §4.2 加载器 | loadManifest(versionDir) 解析、校验、抛错 | GAP-8.1.3 | 对照 Gaps 清单 | ✅ 覆盖 |
| §5 版本隔离 | v1/v2 独立 manifest；loadManifest(v1Dir)/loadManifest(v2Dir) 分别返回 | GAP-8.1.6、GAP-8.1.7、8.1.7a（版本隔离用例） | 对照 Gaps 清单 | ✅ 覆盖 |
| §6 MANIFEST_SCHEMA 同步 | 文档与实现一致；§3 题目模板与 parser 兼容与 schema 无冲突 | GAP-8.1.5；§2 映射含 MANIFEST_SCHEMA §1～§5 | 对照 Gaps 清单与 §2 映射 | ✅ 覆盖 |
| §7 测试要求 | Vitest；loadManifest 解析/校验失败/版本隔离；不修改 eval-question-flow.test.ts | GAP-8.1.7、8.1.7a～8.1.7d（含 7 类用例、集成验证、验收命令、集成测试）；8.1.7b 显式「不修改 eval-question-flow.test.ts」 | 对照 Gaps 清单 | ✅ 覆盖 |
| §8 需求映射 | spec ↔ 原始需求 | IMPLEMENTATION_GAPS §2 映射清单 spec-E8-S1 §2～§7 → GAP-8.1.1～8.1.7 | 比对映射完整性 | ✅ 映射存在 |

---

## 2. plan-E8-S1.md 逐条对照

| 章节 | 需求要点 | IMPLEMENTATION_GAPS 对应 | 验证方式 | 验证结果 |
|------|----------|--------------------------|----------|----------|
| Phase 1 §2.1 | 建立 v1（已存在）、v2 目录；manifest questions: [] | GAP-8.1.1 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 1 §2.2 | YAML 解析库选型 | 隐含于 GAP-8.1.3（加载器实现） | 比对 plan 与 Gaps | ✅ 合理 |
| Phase 1 §2.3 | v1/v2 存在；各含 manifest；可解析为 { questions: [] } | GAP-8.1.1、GAP-8.1.6、GAP-8.1.7a（空 manifest 用例） | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 2 §3.1 | EvalQuestionEntry、EvalQuestionManifest 类型定义 | GAP-8.1.2 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 2 §3.2 | loadManifest；path.join；校验；抛错 | GAP-8.1.3、GAP-8.1.4 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 2 §3.3 | 校验逻辑表（questions 非数组、缺字段、id 重复、path 不存在） | GAP-8.1.4；GAP-8.1.7a 含「格式错误、缺必填、id 重复、path 不存在」 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 2 §3.4 | 验收：loadManifest(v1) 返回；非法 manifest 抛错 | GAP-8.1.3、GAP-8.1.4、GAP-8.1.7a | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 3 §4.1 | 比对 MANIFEST_SCHEMA 与实现；§3 题目模板无冲突 | GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 3 §4.2 | 文档与实现一一对应 | GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 4 §5.1 | manifest-loader.test.ts 路径 | GAP-8.1.7；§3 实现快照列出 manifest-loader.test.ts | 对照 Gaps 清单 | ✅ 覆盖 |
| Phase 4 §5.2 | 7 类用例：空 manifest、版本隔离、解析成功、格式错误、缺少必填、id 重复、path 不存在 | **GAP-8.1.7a** 明确列出 7 类用例 | 逐条比对 plan §5.2 与 GAP-8.1.7a | ✅ 覆盖 |
| Phase 4 §5.3 | 集成验证；从生产模块 import；真实 v1/v2 或 fixtures；不修改 eval-question-flow | **GAP-8.1.7b** 明确列出：从生产模块 import、真实 v1/v2 或 fixtures、不修改 eval-question-flow.test.ts | 逐条比对 plan §5.3 与 GAP-8.1.7b | ✅ 覆盖 |
| Phase 4 §5.4 | npx vitest run scoring/eval-questions；npm test | **GAP-8.1.7c** 明确列出：npx vitest run scoring/eval-questions、npm test | 逐条比对 plan §5.4 与 GAP-8.1.7c | ✅ 覆盖 |
| §7.1 集成测试 | manifest-loader 可导入、真实路径调用；单元测试构成集成验证 | **GAP-8.1.7d** 明确列出：manifest-loader 可被导入、真实路径调用；由 manifest-loader.test.ts 实现 | 逐条比对 plan §7.1 与 GAP-8.1.7d | ✅ 覆盖 |
| §7.2 端到端 | 本 Story 无用户可见命令；由 Story 8.2 完成 | 非本 Story 实现范围 | 合理 | ✅ 无需 GAP |

---

## 3. 8-1-question-bank-structure-manifest.md 逐条对照

| 章节 | 需求要点 | IMPLEMENTATION_GAPS 对应 | 验证方式 | 验证结果 |
|------|----------|--------------------------|----------|----------|
| §1 需求追溯 | REQ-UX-5.1、5.2、5.9 覆盖 | §2 映射 spec §2～§7 全覆盖；spec 自身含需求映射 | 比对 | ✅ 覆盖 |
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
| §5 T4 | 版本隔离与单元测试 | GAP-8.1.7、8.1.7a～8.1.7d | 对照 Gaps 清单 | ✅ 覆盖 |
| §6.1 架构约束 | 数据隔离、目录约定、path 语义 | 隐含于 GAP-8.1.4、GAP-8.1.6 | 比对 | ✅ 覆盖 |
| §6.2 源树 | manifest-loader、MANIFEST_SCHEMA、版本目录 | GAP-8.1.1～8.1.7 | 对照 | ✅ 覆盖 |
| §6.3 测试标准 | Vitest；解析/校验失败/版本隔离；不修改 eval-question-flow | GAP-8.1.7、8.1.7a～8.1.7d；8.1.7b 显式不修改 | 对照 Gaps 清单 | ✅ 覆盖 |
| §6.4 结构 | eval-questions 与 query/coach 同级；兼容 parsers | 隐含于目录与 schema | 合理 | ✅ 覆盖 |
| §6.5 References | MANIFEST_SCHEMA、epics、prd、sample-eval-question-report | 非 GAP 范围 | 合理 | ✅ 无需 |
| §7 禁止词表 | 已避免禁止词 | 非 GAP 范围 | 合理 | ✅ 无需 |
| §8 Dev Agent Record | Agent 记录 | 非 GAP 范围 | 合理 | ✅ 无需 |

---

## 4. MANIFEST_SCHEMA.md 逐条对照

| 章节 | 需求要点 | IMPLEMENTATION_GAPS 对应 | 验证方式 | 验证结果 |
|------|----------|--------------------------|----------|----------|
| §1 目录结构 | v1/v2；manifest.yaml；题目 id 版本内唯一 | GAP-8.1.1、GAP-8.1.4、GAP-8.1.6；§2 映射 MANIFEST_SCHEMA §1～§5 → GAP-8.1.5 | 对照 Gaps 清单与 §2 映射 | ✅ 覆盖 |
| §2 manifest schema | questions 结构；id/title/path 必填；difficulty/tags 可选 | GAP-8.1.2、GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| §2.1 字段说明 | 与 spec 一致 | GAP-8.1.5（文档同步） | 对照 Gaps 清单 | ✅ 覆盖 |
| §2.2 示例 | 示例格式 | GAP-8.1.5（文档同步） | 对照 Gaps 清单 | ✅ 覆盖 |
| §3 题目模板 | 最小模板；与 parser 兼容；占位符 | GAP-8.1.5（spec §6：§3 与 schema 无冲突）；§2 映射 MANIFEST_SCHEMA §1～§5 | 对照 Gaps 清单 | ✅ 覆盖 |
| §4 与 parser 衔接 | 加载、执行、解析写入、数据隔离 | 非 manifest-loader 直接范围；spec 明确本 Story 不包含 list/add/run | 合理 | ✅ 无需 GAP |
| §5 校验规则 | manifest 存在；questions 数组；每项含 id/title/path；path 存在；id 版本内唯一 | GAP-8.1.4、GAP-8.1.5；§2 映射 MANIFEST_SCHEMA §1～§5 → GAP-8.1.5 | 对照 Gaps 清单 | ✅ 覆盖 |
| §6 参考 | PRD、REQ-UX、fixtures | 非 GAP 范围；对照基准已含 MANIFEST_SCHEMA | 合理 | ✅ 无需 |

---

## 5. IMPLEMENTATION_GAPS 自身完整性检查

| 检查项 | 说明 | 验证方式 | 验证结果 |
|--------|------|----------|----------|
| 对照基准 | 头部写明「对照基准：spec-E8-S1.md、plan-E8-S1.md、8-1-question-bank-structure-manifest.md、MANIFEST_SCHEMA.md」 | 读取 IMPLEMENTATION_GAPS 第 6 行 | ✅ 已包含 MANIFEST_SCHEMA.md |
| GAP-8.1.7a | 7 类用例：空 manifest、版本隔离、解析成功、格式错误、缺必填、id 重复、path 不存在 | 比对 plan §5.2 与 IMPLEMENTATION_GAPS 第 21 行 | ✅ 已显式列出 |
| GAP-8.1.7b | 集成验证：从生产模块 import、真实 v1/v2 或 fixtures、不修改 eval-question-flow.test.ts | 比对 plan §5.3 与 IMPLEMENTATION_GAPS 第 22 行 | ✅ 已显式列出 |
| GAP-8.1.7c | 验收命令：npx vitest run scoring/eval-questions、npm test | 比对 plan §5.4 与 IMPLEMENTATION_GAPS 第 23 行 | ✅ 已显式列出 |
| GAP-8.1.7d | 集成测试：manifest-loader 可导入、真实路径调用 | 比对 plan §7.1 与 IMPLEMENTATION_GAPS 第 24 行 | ✅ 已显式列出 |
| §2 需求映射 | MANIFEST_SCHEMA §1～§5 映射至 GAP-8.1.5 | 比对 IMPLEMENTATION_GAPS §2 表格 | ✅ 已补充 |
| 当前实现快照 | §3 列出 v1/v2、manifest-loader、MANIFEST_SCHEMA、单元测试路径及状态 | 读取 §3 表格 | ✅ 完整 |

---

## 6. 路径与引用一致性校验

| 引用 | IMPLEMENTATION_GAPS 表述 | 参考文档表述 | 验证结果 |
|------|--------------------------|--------------|----------|
| v1 目录 | scoring/eval-questions/v1/ | spec §2.1、plan Phase 1、Story §3.1、MANIFEST_SCHEMA §1 | ✅ 一致 |
| v2 目录 | scoring/eval-questions/v2/ | spec §2.1、plan Phase 1、Story §3.1、MANIFEST_SCHEMA §1 | ✅ 一致 |
| manifest-loader | scoring/eval-questions/manifest-loader.ts | spec §2.1、plan Phase 2 §3.2、Story §6.2 | ✅ 一致 |
| manifest-loader.test.ts | scoring/eval-questions/__tests__/manifest-loader.test.ts | plan Phase 4 §5.1 | ✅ 一致 |
| eval-question-flow.test.ts | scoring/__tests__/e2e/eval-question-flow.test.ts | spec §7、plan §5.3、Story §6.3 | ✅ 一致 |
| MANIFEST_SCHEMA | scoring/eval-questions/MANIFEST_SCHEMA.md | spec §6、Story §6.2、MANIFEST_SCHEMA 自身 | ✅ 一致 |

---

## 7. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、TDD 未执行、行号/路径漂移、验收一致性。

**每维度结论**：

- **遗漏需求点**：逐条对照 spec、plan、8-1-question-bank-structure-manifest、MANIFEST_SCHEMA 四份文档共 70+ 条款，IMPLEMENTATION_GAPS 已覆盖全部实现相关要点。上一轮遗漏的 5 项均已修复：① GAP-8.1.7a 细分 7 类用例（空 manifest、版本隔离、解析成功、格式错误、缺必填、id 重复、path 不存在），与 plan §5.2 表逐一比对确认；② GAP-8.1.7b 显式列出集成验证（从生产模块 import、真实 v1/v2 或 fixtures、不修改 eval-question-flow.test.ts），与 plan §5.3 三句完整对应；③ GAP-8.1.7c 显式列出验收命令（npx vitest run scoring/eval-questions、npm test），与 plan §5.4 一致；④ GAP-8.1.7d 显式覆盖 plan §7.1（manifest-loader 可被导入、真实路径调用、由 manifest-loader.test.ts 实现）；⑤ 对照基准第 6 行已含 MANIFEST_SCHEMA.md；§2 映射表格已含 MANIFEST_SCHEMA §1～§5 → GAP-8.1.5。额外检查：Story §6.4、§6.5、§7、§8 为非实现范围，IMPLEMENTATION_GAPS 正确不覆盖；MANIFEST_SCHEMA §4（与 parser 衔接）、§6（参考）非 manifest-loader 直接范围，合理排除。**通过**。

- **边界未定义**：IMPLEMENTATION_GAPS 为 gap 清单型文档，不负责定义边界；边界由 spec/plan 定义。spec §3.3 已明确：questions 为数组、可为空；每项含 id/title/path；id 版本内唯一；path 存在性。plan §3.3 已明确四类校验失败行为（questions 非数组、缺字段、id 重复、path 不存在）。GAP-8.1.4 引用「id 版本内唯一、path 存在性」，GAP-8.1.7a 引用「格式错误、缺必填、id 重复、path 不存在」，与 spec/plan 一一对应。**通过**。

- **验收不可执行**：GAP-8.1.7c 已列出 `npx vitest run scoring/eval-questions`、`npm test` 两条可执行命令；实施者在 manifest-loader 及测试就绪后可直接运行，无歧义。Gaps 文档本身为待实现清单，验收命令已可追溯；GAP-8.1.7c 标注「待测试就绪后执行」表明执行时机，逻辑合理。**通过**。

- **与前置文档矛盾**：逐一比对 IMPLEMENTATION_GAPS 与四份参考文档，未发现表述冲突。需求映射 §2 中 spec §2～§7、plan Phase 1～4 及 §5/§7、Story §3.1 及 §5/§6.3、MANIFEST_SCHEMA §1～§5 的映射关系与各文档章节标题、编号一致。GAP 描述（如「v2 目录不存在」「无 manifest-loader.ts」）与 §3 实现快照一致。**通过**。

- **孤岛模块**：plan §7.1 要求 manifest-loader 可被正确导入并调用，避免「实现完成但从未被生产代码引用」的孤岛。GAP-8.1.7b 要求单元测试从生产模块 import loadManifest；GAP-8.1.7d 要求 manifest-loader 可被导入、真实路径调用；二者共同构成「模块可被导入并在关键路径使用」的验证。plan §7.2 明确本 Story 无用户可见命令，端到端由 Story 8.2 完成，与 Gaps 范围一致。**通过**。

- **伪实现/占位**：Gaps 为待实现清单，全部 GAP 标注「未实现」或「待验证」；§3 实现快照中 v2、manifest-loader、manifest-loader.test.ts 均为「不存在」。无 TODO、占位、假完成等伪实现迹象。**通过**。

- **TDD 未执行**：本 Story 不强制 TDD 红绿灯标记；plan Phase 4 已定义 7 类测试用例，GAP-8.1.7a 已完整覆盖。实施时可按「先写 manifest-loader.test.ts 红灯用例、再实现 loadManifest 绿灯、再重构」执行，Gaps 不阻碍 TDD 流程。**通过**。

- **行号/路径漂移**：所有引用路径与参考文档及当前代码布局一致。具体校验：v1 → `scoring/eval-questions/v1/`（spec §2.1、plan Phase 1、Story §3.1、MANIFEST_SCHEMA §1）；v2 → `scoring/eval-questions/v2/`；manifest-loader → `scoring/eval-questions/manifest-loader.ts`（spec §2.1、plan §3.2、Story §6.2）；manifest-loader.test.ts → `scoring/eval-questions/__tests__/manifest-loader.test.ts`（plan §5.1）；eval-question-flow.test.ts → `scoring/__tests__/e2e/eval-question-flow.test.ts`（spec §7、plan §5.3、Story §6.3）；MANIFEST_SCHEMA → `scoring/eval-questions/MANIFEST_SCHEMA.md`（spec §6、Story §6.2）。无漂移。**通过**。

- **验收一致性**：Gaps 文档末尾标注「AUDIT: PENDING - 待 code-review 审计」，未宣称实现完成或验收通过；与当前实现快照（v2 不存在、manifest-loader 不存在等）一致。GAP-8.1.7c 标注「待测试就绪后执行」，表明验收命令的执行依赖前置实现，逻辑闭环。**通过**。

**本轮结论**：本轮无新 gap。第 2 轮；上一轮 5 项遗漏均已修复并逐条验证通过。

---

## 8. 审计结论

**结论**：**完全覆盖、验证通过**。

**验证摘要**：

| 参考文档 | 章节数 | 覆盖状态 | 遗漏项 |
|----------|--------|----------|--------|
| spec-E8-S1.md | §1～§8（12 条） | ✅ 全覆盖 | 无 |
| plan-E8-S1.md | Phase 1～4、§5、§7（16 条） | ✅ 全覆盖 | 无 |
| 8-1-question-bank-structure-manifest.md | §1～§8（20 条） | ✅ 全覆盖 | 无 |
| MANIFEST_SCHEMA.md | §1～§6（8 条） | ✅ 全覆盖 | 无 |

**上一轮修复项验证**：

1. ✅ 对照基准增加 MANIFEST_SCHEMA.md — 已落实
2. ✅ GAP-8.1.7a 覆盖 plan §5.2 七类测试用例 — 已落实
3. ✅ GAP-8.1.7b 覆盖 plan §5.3 集成验证 — 已落实
4. ✅ GAP-8.1.7c 覆盖 plan §5.4 验收命令 — 已落实
5. ✅ GAP-8.1.7d 覆盖 plan §7.1 集成测试 — 已落实
6. ✅ §2 映射补充 MANIFEST_SCHEMA §1～§5 — 已落实

**遗漏章节或未覆盖要点**：无。

---

*本审计报告符合 audit-prompts-critical-auditor-appendix.md 格式要求。*
