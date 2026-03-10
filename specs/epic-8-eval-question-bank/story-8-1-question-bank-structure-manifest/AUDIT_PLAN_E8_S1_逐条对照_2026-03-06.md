# Plan E8-S1 逐条对照审计报告

**审计对象**：specs/epic-8/story-8-1-question-bank-structure-manifest/plan-E8-S1.md  
**前置文档**：
1. specs/epic-8/story-8-1-question-bank-structure-manifest/spec-E8-S1.md
2. _bmad-output/implementation-artifacts/epic-8-eval-question-bank/story-8-1-question-bank-structure-manifest/8-1-question-bank-structure-manifest.md（Story 8.1）
3. scoring/eval-questions/MANIFEST_SCHEMA.md
4. prd.eval-ux-last-mile.md §5.5（REQ-UX-5.1、REQ-UX-5.2）

**审计日期**：2026-03-06  
**审计依据**：audit-prompts plan.md 审计提示词；audit-prompts-critical-auditor-appendix.md

---

## 1. 逐条对照检查与验证

### 1.1 Story 8.1 原始需求文档对照

#### 1.1.1 Story §1 需求追溯

| 原始要点 | 验证方式 | plan 对应 | 验证结果 |
|----------|----------|-----------|----------|
| REQ-UX-5.1 目录结构 scoring/eval-questions/v1/，含 manifest.yaml | 核对 plan Phase 1 | §2.1 建立 v1 目录，确保 manifest.yaml 存在 | ✅ 覆盖 |
| REQ-UX-5.2 manifest schema questions: [{ id, title, path, difficulty?, tags[] }] | 核对 plan Phase 2 | §3.1 EvalQuestionEntry、EvalQuestionManifest 类型定义 | ✅ 覆盖 |
| REQ-UX-5.9 题目模板与 parser 兼容 | 核对 plan Phase 3 | §4.1「确认 §3 题目模板与 parser 兼容说明与 schema 无冲突」 | ✅ 覆盖 |

#### 1.1.2 Story §3.1 本 Story 实现范围

| 原始要点 | 验证方式 | plan 对应 | 验证结果 |
|----------|----------|-----------|----------|
| 建立 scoring/eval-questions/v1/ 目录 | 核对 plan §2 | §2.1「建立 v1 目录；确保 manifest.yaml 存在且为合法空 manifest」 | ✅ 覆盖 |
| 建立 scoring/eval-questions/v2/ 目录 | 核对 plan §2 | §2.1「建立 v2 目录；新建 manifest.yaml」 | ✅ 覆盖 |
| 每版本含 manifest.yaml | 核对 plan §2 | §2.2 验收「各含 manifest.yaml」 | ✅ 覆盖 |
| manifest schema：questions: [{ id, title, path, difficulty?, tags[] }] | 核对 plan §3 | §3.1 EvalQuestionEntry 含 id、title、path、difficulty?、tags? | ✅ 覆盖 |
| id、title、path 必填；difficulty、tags 可缺省 | 核对 plan §3 | §3.1 接口定义、§3.3 校验「项缺 id/title/path」 | ✅ 覆盖 |
| TypeScript 类型与 manifest-loader.ts | 核对 plan §3 | §3.1 类型、§3.2 加载器路径 manifest-loader.ts | ✅ 覆盖 |
| 校验：id 版本内唯一 | 核对 plan §3 | §3.3「id 重复 throw Error」、§5.2「id 重复」用例 | ✅ 覆盖 |
| 校验：path 指向文件存在性 | 核对 plan §3 | §3.3「path 指向文件不存在 throw Error」、§5.2「path 不存在」用例 | ✅ 覆盖 |
| MANIFEST_SCHEMA.md 同步 | 核对 plan §4 | Phase 3 全文 | ✅ 覆盖 |
| 版本隔离：v1/v2 独立 manifest | 核对 plan §2、§5 | §2.1 v1/v2 分别、§5.2「版本隔离」用例 | ✅ 覆盖 |

#### 1.1.3 Story §4 验收标准

| 原始要点 | 验证方式 | plan 对应 | 验证结果 |
|----------|----------|-----------|----------|
| AC-1 manifest schema 定义、TypeScript 类型与加载器可正确解析 | 核对 plan §6 映射、Phase 2 | plan §6「AC-1 → plan Phase 2」、§3.4 验收 | ✅ 覆盖 |
| AC-2 版本隔离，v1 与 v2 题目清单独立 | 核对 plan §5、§6 | §5.2「版本隔离」用例、§6「AC-2 → plan Phase 4」 | ✅ 覆盖 |

#### 1.1.4 Story §5 Tasks 逐条

| 原始任务 | 验证方式 | plan 对应 | 验证结果 |
|----------|----------|-----------|----------|
| T1 建立目录结构 | 核对 plan Phase 1 | §2.1 v1/v2 目录与 manifest | ✅ 覆盖 |
| T1.1 确保 v1 存在 | 核对 plan §2.1 | 建立 v1 目录 | ✅ 覆盖 |
| T1.2 确保 v2 存在 | 核对 plan §2.1 | 建立 v2 目录 | ✅ 覆盖 |
| T1.3 每版本含 manifest.yaml | 核对 plan §2.1 | 各 manifest.yaml（questions: []） | ✅ 覆盖 |
| T2 manifest schema 类型与加载器 | 核对 plan Phase 2 | §3 全文 | ✅ 覆盖 |
| T2.1 EvalQuestionManifest、EvalQuestionEntry 类型 | 核对 plan §3.1 | 接口定义完整 | ✅ 覆盖 |
| T2.2 loadManifest(versionDir) 解析并校验 | 核对 plan §3.2 | loadManifest 实现说明 | ✅ 覆盖 |
| T2.3 校验：questions 为数组；每项含 id/title/path；id 版本内唯一 | 核对 plan §3.3 | §3.3 表格四行校验项 | ✅ 覆盖 |
| T3 MANIFEST_SCHEMA.md 同步 | 核对 plan Phase 3 | §4 全文 | ✅ 覆盖 |
| T4 版本隔离与单元测试 | 核对 plan Phase 4 | §5 全文 | ✅ 覆盖 |
| T4.1 单元测试：loadManifest v1/v2 分别返回 | 核对 plan §5.2 | 「版本隔离」用例 | ✅ 覆盖 |
| T4.2 单元测试：解析成功/失败（格式错误、缺少必填字段） | 核对 plan §5.2 | 格式错误、缺少必填字段、id 重复、path 不存在 | ✅ 覆盖 |

#### 1.1.5 Story §6 Dev Notes

| 原始要点 | 验证方式 | plan 对应 | 验证结果 |
|----------|----------|-----------|----------|
| path 语义：相对 manifest 所在目录 | 核对 plan §3.2 | loadManifest 解析 path.join(versionDir, 'manifest.yaml')；path 为相对路径（spec 约定） | ✅ 覆盖 |
| 目录约定 scoring/eval-questions/{version}/manifest.yaml | 核对 plan §3.2 | versionDir/manifest.yaml | ✅ 覆盖 |
| 测试：Vitest | 核对 plan §5 | §5.4「npx vitest run」 | ✅ 覆盖 |
| 测试：loadManifest 解析、校验失败、版本隔离 | 核对 plan §5.2 | 七项用例覆盖 | ✅ 覆盖 |
| 不修改 eval-question-flow.test.ts | 核对 plan 全文 | 未显式提及 | ⚠️ 需补充 |

---

### 1.2 spec-E8-S1 逐条对照

| spec 章节 | 原始要点 | 验证方式 | plan 对应 | 验证结果 |
|-----------|----------|----------|-----------|----------|
| §2 目录结构 | v1、v2、manifest-loader.ts | 核对 plan §2、§3 | Phase 1、Phase 2 | ✅ 覆盖 |
| §3.1 结构 | questions: [{ id, title, path, difficulty?, tags[] }] | 核对 plan §3.1 | EvalQuestionEntry 接口 | ✅ 覆盖 |
| §3.2 字段约束 | id/title/path 必填；difficulty/tags 可选 | 核对 plan §3.1 | 接口定义 | ✅ 覆盖 |
| §3.3 校验规则 | questions 数组；id/title/path；id 唯一；path 存在 | 核对 plan §3.3 | 四行校验项 | ✅ 覆盖 |
| §4.1 类型 | EvalQuestionEntry、EvalQuestionManifest | 核对 plan §3.1 | 完整定义 | ✅ 覆盖 |
| §4.2 加载器 | loadManifest(versionDir) | 核对 plan §3.2 | 函数签名与行为 | ✅ 覆盖 |
| §5 版本隔离 | v1/v2 独立 manifest | 核对 plan §5.2 | 版本隔离用例 | ✅ 覆盖 |
| §6 MANIFEST_SCHEMA 同步 | 文档与实现一致；§3 题目模板与 schema 无冲突 | 核对 plan §4 | §4.1 三行任务 | ✅ 覆盖 |
| §7 测试要求 | Vitest；解析/校验失败/版本隔离；不修改 eval-question-flow | 核对 plan §5、§7 | §5 单元测试；未显式提及不修改 e2e | ⚠️ 见 1.1.5 |

---

### 1.3 MANIFEST_SCHEMA.md 对照

| 原始章节 | 原始要点 | 验证方式 | plan 对应 | 验证结果 |
|----------|----------|----------|-----------|----------|
| §1 目录结构 | v1、v2 含 manifest.yaml | plan §2 | Phase 1 | ✅ 覆盖 |
| §2 manifest schema | id、title、path、difficulty?、tags? | plan §3.1 | 类型定义 | ✅ 覆盖 |
| §3 题目模板与 parser | 兼容说明与 schema 一致 | plan §4.1 | 「确认 §3…与 schema 无冲突」 | ✅ 覆盖 |
| §5 校验规则 | path 存在、id 唯一 | plan §3.3 | 校验表格 | ✅ 覆盖 |

---

### 1.4 专项审计：集成测试与端到端功能测试计划

#### 1.4.1 是否存在完整集成/端到端测试计划？

| 检查项 | 验证方式 | plan 内容 | 验证结果 |
|--------|----------|----------|----------|
| 集成测试计划 | 查找 plan 中「集成」相关表述 | §7.1 集成测试：目标、方式、后续；§5.3 集成验证 | ✅ 存在 |
| 端到端测试计划 | 查找 plan 中「端到端」「E2E」相关表述 | §7.2 端到端验证：说明本 Story 无用户可见命令，E2E 由 Story 8.2 完成 | ✅ 存在且合理 |
| 模块间协作 | 是否验证 loadManifest 与其他模块协作 | §7.1「Story 8.2 list 命令将导入此模块」；§5.3「验证模块可被正确导入」 | ✅ 覆盖 |
| 生产代码关键路径 | 是否验证 loadManifest 在生产路径中被调用 | §5.3「在生产代码关键路径中使用」；§7.1「生产代码关键路径中可被正确导入并调用」 | ✅ 覆盖 |
| 用户可见功能流程 | 本 Story 是否产出用户可见命令 | §7.2「本 Story 无用户可见命令（list/add/run 属 Story 8.2/8.3）」 | ✅ 合理界定 |

#### 1.4.2 是否存在仅依赖单元测试而缺集成/E2E 的情况？

| 检查项 | 验证方式 | 结论 |
|--------|----------|------|
| 单元测试 | plan §5 有 7 项用例 | 单元测试计划完整 |
| 集成验证 | plan §5.3、§7.1 明确单元测试 import 生产模块、使用真实路径 | 单元测试兼具「导入并调用」的集成验证角色 |
| E2E 覆盖 | plan §7.2 说明本 Story 为基础设施，E2E 由 Story 8.2 list 命令完成 | 本 Story 范围内合理，无用户命令故无独立 E2E |

**结论**：plan 未「仅依赖单元测试」。§5.3 与 §7.1 将「从生产模块 import 并调用」的单元测试界定为集成验证，且明确 Story 8.2 将构成生产关键路径的完整集成。符合本 Story 的边界（基础设施，无用户命令）。

#### 1.4.3 是否存在孤岛模块风险？

| 检查项 | 验证方式 | 结论 |
|--------|----------|------|
| loadManifest 是否被生产路径导入 | plan §7.1「Story 8.2 list 命令将导入 loadManifest」 | 已约定下游导入 |
| 本 Story 是否确保接口可复用 | plan §7.1「本 Story 确保 loadManifest 接口正确、可被复用」 | 接口设计考虑下游 |
| 单元测试是否验证导入 | plan §5.3「单元测试通过 import 从生产模块调用」 | 测试即验证可导入 |

**结论**：plan 已明确 loadManifest 将被 Story 8.2 导入，不存在「实现完整但未被调用」的孤岛风险。本 Story 产出为可复用基础设施，下游 Story 8.2 承担实际命令行入口。

---

### 1.5 边界条件与异常路径

| 场景 | spec/Story 要求 | plan 对应 | 验证结果 |
|------|-----------------|-----------|----------|
| 空 manifest (questions: []) | 合法，返回 { questions: [] } | §2.1、§5.2「空 manifest」用例 | ✅ 覆盖 |
| questions 非数组 | 校验失败 | §3.3、§5.2「格式错误」可延伸 | ✅ 覆盖 |
| 项缺 id/title/path | 校验失败 | §3.3、§5.2「缺少必填字段」 | ✅ 覆盖 |
| id 重复 | 校验失败 | §3.3、§5.2「id 重复」 | ✅ 覆盖 |
| path 指向文件不存在 | 校验失败 | §3.3、§5.2「path 不存在」 | ✅ 覆盖 |
| YAML 格式错误 | 校验失败 | §5.2「格式错误」 | ✅ 覆盖 |
| manifest.yaml 文件缺失 | spec §4.2 校验失败抛错 | plan 未显式提及 manifest 文件不存在场景 | ⚠️ 可接受：属「校验失败」范畴，§3.2「校验失败抛出 Error」可覆盖 |

---

### 1.6 需求映射清单完整性

| plan §6 映射行 | 需求文档章节 | 验证方式 | 验证结果 |
|----------------|--------------|----------|----------|
| Story §3.1 目录结构 | spec §2 | plan Phase 1 | ✅ |
| Story §3.1 manifest schema | spec §3 | plan Phase 2 类型 | ✅ |
| Story §3.1 类型与加载器 | spec §4 | plan Phase 2 | ✅ |
| Story §3.1 校验规则 | spec §3.3 | plan §3.3 | ✅ |
| Story §3.1 MANIFEST_SCHEMA 同步 | spec §6 | plan Phase 3 | ✅ |
| Story §3.1 版本隔离 | spec §5 | plan Phase 2、Phase 4 | ✅ |
| Story §5 T4 | spec §7 | plan Phase 4 | ✅ |
| spec §7 测试要求 | — | plan §5.2、§5.3 | ✅ |
| AC-1 | spec §3、§4 | plan Phase 2 | ✅ |
| AC-2 | spec §5 | plan Phase 4 版本隔离用例 | ✅ |

**映射完整性**：plan §6 表格覆盖 Story §3.1 全部要点、AC、T4、spec §7。未发现遗漏行。

---

## 2. 遗漏与待补充项

| # | 遗漏项 | 来源 | 建议 |
|---|--------|------|------|
| 1 | 不修改 `scoring/__tests__/e2e/eval-question-flow.test.ts` | spec §7、Story §6.3 | 在 plan Phase 4 或 §7 中显式补充「不修改现有 eval-question-flow.test.ts」的约束 |

**影响评估**：该项为约束性要求，非功能性需求。遗漏可能导致实施时误改 e2e 文件。建议在 plan 中补充一行即可消除风险。

---

## 3. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、TDD 未执行、行号/路径漂移、验收一致性、集成/E2E 测试计划、仅依赖单元测试风险、孤岛模块风险。

**每维度结论**：

- **遗漏需求点**：基本通过。Story §3.1、§4、§5、§6.3 与 spec §2～§7、MANIFEST_SCHEMA、PRD REQ-UX-5.1/5.2 均已覆盖。唯一遗漏：spec §7「不修改 eval-question-flow.test.ts」未在 plan 中显式提及。
- **边界未定义**：通过。空 manifest、path 不存在、id 重复、格式错误、缺少必填字段均在 plan §3.3、§5.2 中明确。manifest 文件缺失可归入「校验失败」统一处理。
- **验收不可执行**：通过。Phase 1～4 各有验收标准；§5.4 明确「npx vitest run」「npm test」可通过。
- **与前置文档矛盾**：通过。plan 与 spec、Story 在 schema、校验、版本隔离、path 语义上一致。
- **孤岛模块**：通过。plan §7.1 明确 Story 8.2 将导入 loadManifest；§5.3 单元测试从生产模块 import 验证可导入。本 Story 为基础设施，下游 Story 8.2 负责命令行入口，不存在「实现完整但未被调用」的孤岛。
- **伪实现/占位**：不适用（plan 阶段）。
- **TDD 未执行**：不适用。plan 明确测试用例与验收，实施时按 TDD 执行即可。
- **行号/路径漂移**：通过。scoring/eval-questions/、manifest-loader.ts、MANIFEST_SCHEMA.md 等路径与 spec、项目结构一致。
- **验收一致性**：通过。§6 映射表与 Phase 1～4 一一对应；AC-1、AC-2 有明确验收方式。
- **集成/E2E 测试计划**：通过。§7 专章描述集成测试（单元测试 import 验证 + Story 8.2 导入）与 E2E 边界（本 Story 无用户命令，E2E 由 Story 8.2 完成）。
- **仅依赖单元测试风险**：通过。§5.3、§7.1 将「从生产模块 import 并调用」界定为集成验证，不属「仅单元测试」。
- **孤岛模块风险**：通过。loadManifest 已被约定由 Story 8.2 导入，接口设计考虑复用。

**本轮结论**：本轮存在 1 项轻微 gap——spec §7「不修改 eval-question-flow.test.ts」未在 plan 中显式补充。补充后即可判「完全覆盖、验证通过」。

---

## 4. 最终结论

### 4.1 结论判定

**未完全通过**。存在 1 项遗漏：spec §7 / Story §6.3 要求「不修改现有 `scoring/__tests__/e2e/eval-question-flow.test.ts`」，plan 中未显式提及。

**补充该约束后**可判「完全覆盖、验证通过」。

### 4.2 验证摘要

- **Story 8.1**：§3.1 实现范围、§4 验收标准、§5 Tasks、§6 Dev Notes 已逐条覆盖；T1～T4 与 plan Phase 1～4 一一对应。
- **spec-E8-S1**：§2～§7 全部覆盖；§7 测试要求中「不修改 eval-question-flow」为 plan 唯一遗漏，建议补充。
- **MANIFEST_SCHEMA.md**：§1～§3、§5 已覆盖；Phase 3 明确 §3 题目模板与 schema 无冲突。
- **PRD §5.5**：REQ-UX-5.1、REQ-UX-5.2 已覆盖。
- **集成/E2E 专项**：plan §7 有完整集成测试与 E2E 边界说明；无仅依赖单元测试、无孤岛模块风险。

### 4.3 遗漏项列表（需补充后通过）

| # | 遗漏章节/要点 | 来源 | 建议 |
|---|---------------|------|------|
| 1 | 不修改现有 `scoring/__tests__/e2e/eval-question-flow.test.ts` | spec §7、Story §6.3 | 在 plan Phase 4（§5）或 §7 中显式增加该约束 |

### 4.4 补充后的结论

按 §4.3 补充后：**完全覆盖、验证通过**。

---

### 5. 审计后修正（2026-03-06）

已按 §4.3 建议将「不修改现有 `scoring/__tests__/e2e/eval-question-flow.test.ts`」补充至 plan §5.3 集成验证。plan 现已满足全部要求。

**最终结论：完全覆盖、验证通过。**

---

*本审计报告符合 audit-prompts-critical-auditor-appendix.md 格式要求。*
