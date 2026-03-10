# Spec E8-S1 逐条对照审计报告

**审计对象**：specs/epic-8/story-8-1-question-bank-structure-manifest/spec-E8-S1.md  
**原始需求文档**：
1. d:/Dev/BMAD-Speckit-SDD-Flow/_bmad-output/implementation-artifacts/epic-8-eval-question-bank/story-8-1-question-bank-structure-manifest/8-1-question-bank-structure-manifest.md（Story 8.1）
2. scoring/eval-questions/MANIFEST_SCHEMA.md
3. prd.eval-ux-last-mile.md §5.5（REQ-UX-5.1、REQ-UX-5.2）

**审计日期**：2026-03-06  
**审计依据**：spec 已根据上一轮审计修正后的版本（path 存在性、difficulty、id、空 manifest、versionDir、§6 §3 同步、§7 测试要求）

---

## 1. 逐条对照检查与验证

### 1.1 Story 8.1 对照

#### 1.1.1 Story §1 需求追溯

| 原始要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| REQ-UX-5.1 目录结构 scoring/eval-questions/v1/，含题目 .md 与 manifest.yaml | 核对 spec §2.1 表格、§2.2 | §2.1 表第二行、§2.2 第一～二行 | ✅ 覆盖 |
| REQ-UX-5.2 manifest schema questions: [{ id, title, path, difficulty?, tags[] }] | 核对 spec §3.1、§3.2 | §3.1 YAML、§3.2 表格 | ✅ 覆盖 |
| REQ-UX-5.9 题目模板与 parser 兼容说明 | 核对 spec §6、§8 映射表 | §6 第三行明确「MANIFEST_SCHEMA.md §3 题目模板与 parser 兼容说明」；§8 映射 REQ-UX-5.9 | ✅ 覆盖 |

#### 1.1.2 Story §3.1 本 Story 实现范围

| 原始要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| 建立 scoring/eval-questions/v1/ 目录 | 核对 spec §2 | §2.1 表格、§2.2 | ✅ 覆盖 |
| 建立 scoring/eval-questions/v2/ 目录 | 核对 spec §2 | §2.1 表格、§2.2 | ✅ 覆盖 |
| 每版本含 manifest.yaml | 核对 spec §2.2 | §2.2 第二行 | ✅ 覆盖 |
| manifest schema：questions: [{ id, title, path, difficulty?, tags[] }] | 核对 spec §3 | §3.1、§3.2 | ✅ 覆盖 |
| id、title、path 必填；difficulty、tags 可缺省 | 核对 spec §3.2 表格 | §3.2 必填列、§3.1 YAML 可选标记 | ✅ 覆盖 |
| TypeScript 类型与 manifest-loader.ts | 核对 spec §4 | §4.1、§4.2；§2.1 表格 manifest-loader.ts | ✅ 覆盖 |
| schema 校验：id 版本内唯一 | 核对 spec §3.3 | §3.3 第三行「id 在版本内唯一（运行时校验）」 | ✅ 覆盖 |
| schema 校验：path 指向文件存在性 | 核对 spec §3.3 | §3.3 第四行「本 Story 实现运行时校验；path 必须指向…实际文件，否则 loadManifest 抛出明确错误」 | ✅ 覆盖（已修正） |
| MANIFEST_SCHEMA.md 同步 | 核对 spec §6 | §6 三行完整说明 | ✅ 覆盖 |
| 版本隔离：v1/v2 独立 manifest | 核对 spec §5 | §5 | ✅ 覆盖 |
| manifest-loader 按 version 参数加载 | 核对 spec §4.2 | §4.2「Story 8.2/8.3 的 --version v1 由调用方解析为 scoring/eval-questions/v1 后传入」 | ✅ 覆盖（已修正） |

#### 1.1.3 Story §4 验收标准

| 原始要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| AC-1 manifest schema 定义、TypeScript 类型与加载器可正确解析 | 核对 spec §8 映射、§3§4 | §8 AC-1 → spec §3、§4 | ✅ 覆盖 |
| AC-2 版本隔离，v1 与 v2 题目清单独立 | 核对 spec §5、§8 | §5、§8 AC-2 | ✅ 覆盖 |

#### 1.1.4 Story §5 Tasks

| 原始任务 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| T1 建立目录结构 | 核对 spec §2 | §2 | ✅ 覆盖 |
| T1.1～T1.3 v1/v2 存在、manifest.yaml | 核对 spec §2.2 | §2.2 | ✅ 覆盖 |
| T2 manifest schema 类型与加载器 | 核对 spec §3、§4 | §3、§4 | ✅ 覆盖 |
| T2.3 校验：questions 为数组；每项含 id、title、path；id 版本内唯一 | 核对 spec §3.3 | §3.3 前四行 | ✅ 覆盖 |
| T3 MANIFEST_SCHEMA.md 同步 | 核对 spec §6 | §6 | ✅ 覆盖 |
| T4 版本隔离与单元测试 | 核对 spec §7 | §7「版本隔离（加载 v1 与 v2 分别返回对应清单）」 | ✅ 覆盖（已修正） |

#### 1.1.5 Story §6 Dev Notes

| 原始要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|-----------|----------|
| path 语义：相对 manifest 所在目录 | 核对 spec §2.2、§3 | §2.2 第三行、§3.1 path、§3.2 path | ✅ 覆盖 |
| 目录约定 scoring/eval-questions/{version}/manifest.yaml | 核对 spec §2、§4.2 | §2.1、§4.2 {versionDir}/manifest.yaml | ✅ 覆盖 |
| 测试：Vitest；loadManifest 解析、校验失败、版本隔离 | 核对 spec §7 | §7 三行明确 | ✅ 覆盖（已修正） |
| 不修改 eval-question-flow.test.ts | 核对 spec §7 | §7 最后一行 | ✅ 覆盖 |
| 题目 .md 与 parsers 输入格式兼容 | 核对 spec §6 | §6 第三行「§3 题目模板与 parser 兼容说明」 | ✅ 覆盖 |

---

### 1.2 MANIFEST_SCHEMA.md 对照

| 原始章节 | 原始要点 | 验证方式 | spec 对应 | 验证结果 |
|----------|----------|----------|-----------|----------|
| §1 目录结构 | v1、v2 含 manifest.yaml 与题目 .md | 核对 spec §2 | §2.1 表格 | ✅ 覆盖 |
| §2.1 id | 建议 q001 格式；版本内唯一 | 核对 spec §3.2 | §3.2「建议 q001 格式，实现不强制」 | ✅ 覆盖 |
| §2.1 path | 相对 manifest 所在目录；与 id 可不同名 | 核对 spec §3.2 | §3.2 path「与 id 可不同名」 | ✅ 覆盖 |
| §2.1 difficulty | easy / medium / hard 等 | 核对 spec §3.2 | §3.2「建议 easy/medium/hard，实现允许任意字符串」 | ✅ 覆盖 |
| §2.2 示例 | 示例与类型一致 | 核对 spec §6 | §6「示例与 TypeScript 类型一一对应」 | ✅ 覆盖 |
| §3 题目文档模板与 parser 兼容 | 题目 .md 与 parsers 输入一致 | 核对 spec §6 | §6「确保 MANIFEST_SCHEMA.md §3 题目模板与 parser 兼容说明…一致、不矛盾」 | ✅ 覆盖 |
| §5 校验规则 | path 指向的文件存在 | 核对 spec §3.3 | §3.3 path 存在性运行时校验 | ✅ 覆盖 |
| §5 校验规则 | id 在版本内唯一 | 核对 spec §3.3 | §3.3 | ✅ 覆盖 |

---

### 1.3 PRD §5.5 对照

| 原始需求 ID | 原始描述 | 验证方式 | spec 对应 | 验证结果 |
|-------------|----------|----------|-----------|----------|
| REQ-UX-5.1 | 目录结构 scoring/eval-questions/v1/，含题目 .md 与 manifest.yaml | 核对 spec §2 | §2.1、§2.2 | ✅ 覆盖 |
| REQ-UX-5.2 | manifest.yaml schema questions: [{ id, title, path, difficulty?, tags[] }] | 核对 spec §3 | §3.1、§3.2 | ✅ 覆盖 |

---

### 1.4 上一轮审计修正项验证

| 修正项 | 修正要求 | spec 当前表述 | 验证结果 |
|--------|----------|---------------|----------|
| §3.3 path 存在性 | 本 Story 实现运行时校验，path 必须指向实际文件 | §3.3 第四行「本 Story 实现运行时校验；path 必须指向 manifest 所在目录下的实际文件，否则 loadManifest 抛出明确错误」 | ✅ 已落实 |
| §3.2 difficulty | 建议 easy/medium/hard，实现允许任意字符串 | §3.2「建议 easy/medium/hard，实现允许任意字符串」 | ✅ 已落实 |
| §3.2 id | 建议 q001 格式，实现不强制；path 与 id 可不同名 | §3.2 id「建议 q001 格式，实现不强制」；path「与 id 可不同名」 | ✅ 已落实 |
| §3.3 空 manifest | questions: [] 合法，loadManifest 返回 { questions: [] } | §3.3 第一行「可为空数组 []，loadManifest 返回 { questions: [] }」 | ✅ 已落实 |
| §4.2 versionDir | Story 8.2/8.3 --version 由调用方解析为路径后传入 | §4.2「Story 8.2/8.3 的 --version v1 由调用方解析为 scoring/eval-questions/v1 后传入」 | ✅ 已落实 |
| §6 MANIFEST_SCHEMA §3 | 题目模板与 parser 兼容说明的同步范围 | §6 第三行完整说明 | ✅ 已落实 |
| 新增 §7 测试要求 | Vitest、解析/校验失败/版本隔离、不修改 eval-question-flow | §7 四行完整 | ✅ 已落实 |

---

### 1.5 边界条件与异常路径

| 场景 | 原始需求或 MANIFEST_SCHEMA | spec 表述 | 验证结果 |
|------|---------------------------|-----------|----------|
| 空 manifest (questions: []) | Story T1.3 v1 可沿用空 questions: [] | §3.3 明确合法且 loadManifest 返回 { questions: [] } | ✅ 已定义 |
| path 不存在 | Story §3.1 path 存在性校验 | §3.3 loadManifest 抛出明确错误 | ✅ 已定义 |
| id 重复 | 运行时校验 | §3.3「id 在版本内唯一（运行时校验）」；§7「id 重复」断言 | ✅ 已定义 |
| 格式错误 | T4.2 格式错误断言 | §7「格式错误、缺少必填字段、path 不存在、id 重复」 | ✅ 已定义 |
| manifest.yaml 不存在 | — | spec 未显式提及 loadManifest 在 manifest 文件缺失时的行为 | ⚠️ 可接受：属「校验失败」范畴，§4.2「校验失败时抛出明确错误」可覆盖 |

---

### 1.6 术语与一致性检查

| 术语/概念 | Story | MANIFEST_SCHEMA | spec | 一致性 |
|-----------|-------|-----------------|------|--------|
| path 语义 | 相对 manifest 所在目录 | 相对 manifest 所在目录 | 相对 manifest 所在目录 | ✅ |
| version 参数 | 按 version 参数加载 | — | 调用方解析 --version 为路径后传入 versionDir | ✅ 已澄清 |
| id 格式 | — | 建议 q001 | 建议 q001，实现不强制 | ✅ |
| difficulty 取值 | 可缺省 | easy/medium/hard 等 | 建议 easy/medium/hard，实现允许任意 | ✅ |

---

## 2. 模糊表述检查

对 spec 全文进行模糊表述扫描：

| 检查项 | 位置 | 结论 |
|--------|------|------|
| 需求描述是否明确 | §1～§8 | 各节表述清晰，范围、约束、行为均有定义 |
| 边界条件是否定义 | §3.3、§7 | 空 manifest、path 不存在、id 重复、格式错误均已覆盖 |
| 术语歧义 | §3.2、§4.2 | difficulty、id、versionDir 已按上轮修正澄清 |
| 可操作性 | §2～§7 | 每节均有可执行或可验证的约束 |

**结论**：经逐段检查，**未发现需触发 clarify 的模糊表述**。上一轮识别的 6 处模糊已全部在修正中澄清。

---

## 3. 需求映射清单完整性

| 原始文档 | 应覆盖章节/要点 | spec §8 映射 | 是否完整 |
|----------|-----------------|--------------|----------|
| Story 8.1 | §3.1 全部、§4 AC、§5 T、§6.3 | 均已映射至 spec §2～§7 | ✅ |
| MANIFEST_SCHEMA | §1～§3、§5 | §6 覆盖 §3；§3.3 覆盖 §5 | ✅ |
| PRD §5.5 | REQ-UX-5.1、REQ-UX-5.2 | §8 映射表 | ✅ |

---

## 4. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块、伪实现/占位、TDD 未执行、行号/路径漂移、验收一致性。

**每维度结论**：

- **遗漏需求点**：通过。Story §3.1 全部要点、T1～T4、§6.3 测试标准、MANIFEST_SCHEMA §1～§3 与 §5、PRD REQ-UX-5.1/5.2 均已覆盖。
- **边界未定义**：通过。空 manifest、path 不存在、id 重复、格式错误、difficulty 取值、id 格式、versionDir 语义均已明确定义。
- **验收不可执行**：通过。AC-1、AC-2 有明确验收方式；§7 测试要求列出具体断言场景，可执行。
- **与前置文档矛盾**：通过。path 存在性校验已统一为「本 Story 实现运行时校验」，与 Story §3.1 一致。
- **孤岛模块**：不适用（spec 阶段无实现）。
- **伪实现/占位**：不适用。
- **TDD 未执行**：不适用（spec 阶段；§7 已明确单元测试要求）。
- **行号/路径漂移**：通过。引用路径（scoring/eval-questions/、manifest-loader.ts、eval-question-flow.test.ts）均为有效约定。
- **验收一致性**：通过。§8 映射表覆盖 Story AC、Tasks、REQ-UX，与 §2～§7 一一对应。

**本轮结论**：本轮无新 gap。

---

## 5. 最终结论

**结论**：**完全覆盖、验证通过**。

**验证摘要**：
- Story 8.1 全部 §3.1 实现范围、§4 验收标准、§5 Tasks、§6 Dev Notes 已逐条覆盖。
- MANIFEST_SCHEMA.md §1～§3、§5 校验规则已覆盖；§6 明确 MANIFEST_SCHEMA §3 题目模板与 parser 兼容的同步范围。
- PRD §5.5 REQ-UX-5.1、REQ-UX-5.2 已覆盖。
- 上一轮审计 6 处模糊表述均已澄清并落实于 spec。
- 无遗漏章节、无未覆盖要点、无待澄清模糊表述。

**建议**：可进入 plan / tasks 阶段；实施时按 §7 测试要求编写 Vitest 单元测试，按 §8 映射表逐项验收。

---

*本审计报告符合 audit-prompts-critical-auditor-appendix.md 格式要求。*
