# Spec E8-S1 审计报告

**审计对象**：specs/epic-8/story-8-1-question-bank-structure-manifest/spec-E8-S1.md  
**原始需求**：8-1-question-bank-structure-manifest.md、MANIFEST_SCHEMA.md、prd.eval-ux-last-mile.md §5.5  
**审计日期**：2026-03-06  
**审计员**：批判审计员（critical auditor）

---

## 1. 逐条对照审计

### 1.1 Story 8.1 §1 需求追溯

| 原始要点 | 验证方式 | spec 对应 | 结果 |
|----------|----------|-----------|------|
| REQ-UX-5.1 目录结构 scoring/eval-questions/v1/ | 核对 spec §2 | §2.1 表格、§2.2 | ✅ |
| REQ-UX-5.2 manifest schema | 核对 spec §3 | §3.1、§3.2 | ✅ |
| REQ-UX-5.9 题目模板与 parser 兼容说明 | 核对 spec §6、§7 映射 | §6 仅提「questions 结构、字段说明、示例」，**未明确 MANIFEST_SCHEMA §3 题目模板与 parser 兼容** | ⚠️ 遗漏 |

### 1.2 Story 8.1 §3.1 本 Story 实现范围

| 原始要点 | 验证方式 | spec 对应 | 结果 |
|----------|----------|-----------|------|
| 建立 v1、v2 目录 | 核对 spec §2 | §2.1、§2.2 | ✅ |
| 每版本含 manifest.yaml | 核对 spec §2.2 | §2.2 第二行 | ✅ |
| manifest schema：questions: [{ id, title, path, difficulty?, tags[] }] | 核对 spec §3 | §3.1、§3.2 | ✅ |
| id、title、path 必填；difficulty、tags 可缺省 | 核对 spec §3.2 | §3.2 表格 | ✅ |
| TypeScript 类型与 manifest-loader.ts | 核对 spec §4 | §4.1、§4.2 | ✅ |
| schema 校验逻辑：id 版本内唯一 | 核对 spec §3.3 | §3.3 第三行 | ✅ |
| schema 校验逻辑：path 指向文件存在性校验 | 核对 spec §3.3 | §3.3 第四行：**「path 存在性可配置为校验或仅警告」「可后续 Story 8.3 集成」** | ⚠️ **与 Story 不一致**：Story 明确要求「path 指向文件存在性校验」，spec 将其 defer 或设为可配置，边界未定义 |
| MANIFEST_SCHEMA.md 同步 | 核对 spec §6 | §6 | ✅ |
| 版本隔离：v1/v2 独立 manifest | 核对 spec §5 | §5 | ✅ |
| manifest-loader 按 version 参数加载 | 核对 spec §4.2 | §4.2 写 `loadManifest(versionDir: string)`，**参数为 versionDir 而非 version** | ⚠️ **术语歧义**：Story 说「按 version 参数」，spec 说 versionDir，未说明是否接受 "v1"/"v2" 字符串并解析为路径 |

### 1.3 Story 8.1 §4 验收标准

| 原始要点 | 验证方式 | spec 对应 | 结果 |
|----------|----------|-----------|------|
| AC-1 manifest schema 定义、TypeScript 类型与加载器可正确解析 | 核对 spec §3、§4 | §7 映射表 | ✅ |
| AC-2 版本隔离，v1 与 v2 题目清单独立 | 核对 spec §5 | §7 映射表 | ✅ |

### 1.4 Story 8.1 §5 Tasks

| 原始任务 | 验证方式 | spec 对应 | 结果 |
|----------|----------|-----------|------|
| T1 建立目录结构 | 核对 spec §2 | §2 | ✅ |
| T2 manifest schema 类型与加载器 | 核对 spec §3、§4 | §3、§4 | ✅ |
| T2.3 校验规则：questions 为数组；每项含 id、title、path；id 版本内唯一 | 核对 spec §3.3 | §3.3 | ✅ |
| T3 MANIFEST_SCHEMA.md 同步 | 核对 spec §6 | §6 | ✅ |
| T4 版本隔离与单元测试 | 核对 spec 全文 | **spec 无任何测试相关描述** | ❌ **遗漏** |

### 1.5 Story 8.1 §6 Dev Notes

| 原始要点 | 验证方式 | spec 对应 | 结果 |
|----------|----------|-----------|------|
| path 语义：相对 manifest 所在目录 | 核对 spec §2.2、§3 | §2.2 第三行、§3.1 path | ✅ |
| 目录约定：scoring/eval-questions/{version}/manifest.yaml | 核对 spec §2 | §2.1 表格 | ✅ |
| 测试标准：Vitest；loadManifest 正确解析、校验失败抛错、版本隔离 | 核对 spec 全文 | **无测试章节** | ❌ **遗漏** |
| 不修改 eval-question-flow.test.ts | 核对 spec | 未提及 | ⚠️ 可接受（非本 Story 核心） |
| 题目 .md 路径与 scoring/parsers 输入格式兼容 | 核对 spec §6 | §6 未明确「题目模板与 parser 兼容」 | ⚠️ 模糊 |

### 1.6 MANIFEST_SCHEMA.md

| 原始章节/要点 | 验证方式 | spec 对应 | 结果 |
|---------------|----------|-----------|------|
| §1 目录结构：v1、v2 含 manifest.yaml 与题目 .md | 核对 spec §2 | §2 | ✅ |
| §2.1 id：建议 q001 格式，用于 run --id q001 | 核对 spec §3 | spec 未说明 id 格式约定（q001 等） | ⚠️ **边界未定义** |
| §2.1 path：相对 manifest 所在目录；与 id 可不同名 | 核对 spec §3.2 | §3.2 path 说明未提「与 id 可不同名」 | ⚠️ 次要，可接受 |
| §2.2 示例 YAML | 核对 spec §6 | §6 要求「示例与 TypeScript 类型一致」 | ✅ |
| §3 题目文档模板（与 parser 兼容） | 核对 spec §6 | §6 仅提 questions 结构、字段、示例，**未提 §3 题目模板** | ⚠️ **遗漏** |
| §5 校验规则：path 指向的文件存在 | 核对 spec §3.3 | spec 将 path 存在性 defer 或可配置 | ⚠️ 与前文一致，但与 MANIFEST_SCHEMA §5 原文有差异 |

### 1.7 PRD §5.5 REQ-UX-5.1、REQ-UX-5.2

| 原始要点 | 验证方式 | spec 对应 | 结果 |
|----------|----------|-----------|------|
| REQ-UX-5.1 目录结构 scoring/eval-questions/v1/ | 核对 spec §2 | §2 | ✅ |
| REQ-UX-5.2 manifest schema | 核对 spec §3 | §3 | ✅ |

### 1.8 difficulty 取值边界

| 来源 | 表述 | spec 表述 | 结果 |
|------|------|-----------|------|
| MANIFEST_SCHEMA §2.1 | easy / medium / hard | spec §3.2「easy/medium/hard 等」 | ⚠️ **「等」字歧义**：是否允许多余枚举？边界未定义 |
| Story §3.1 | difficulty? 可缺省 | spec §3.2 可选 | ✅ |

### 1.9 空 manifest 行为

| 原始要点 | 验证方式 | spec 对应 | 结果 |
|----------|----------|-----------|------|
| Story T1.3：v1 可沿用空 questions: []，v2 新建空 manifest | 核对 spec | **spec 未定义空 manifest（questions: []）的合法性及 loadManifest 解析行为** | ⚠️ **边界未定义** |

---

## 2. spec 模糊表述汇总

以下为审计中识别的**模糊表述**，须触发 clarify 澄清流程：

| # | 位置 | 模糊表述 | 建议澄清 |
|---|------|----------|----------|
| 1 | spec §3.3 第四行 | 「path 存在性可配置为校验或仅警告」「可后续 Story 8.3 集成」 | 明确本 Story 是否实现 path 存在性校验；若 defer，在需求映射表中标注 |
| 2 | spec §3.2 difficulty | 「easy/medium/hard 等」 | 明确是否限定枚举，或允许任意字符串 |
| 3 | spec §4.2 | versionDir：绝对路径或相对项目根 | 明确 loadManifest 是否接受 "v1"/"v2" 版本名；与 Story「按 version 参数」的语义是否一致 |
| 4 | spec §6 | 仅提 questions 结构、字段、示例 | 明确 MANIFEST_SCHEMA §3 题目模板与 parser 兼容说明是否在本 Story 同步范围内 |
| 5 | 全文 | 空 manifest（questions: []） | 明确空 manifest 是否合法；loadManifest 对空数组的返回行为 |
| 6 | 全文 | id 格式（如 q001） | 明确是否有格式约定或仅为普通 string |

---

## 3. 遗漏章节与未覆盖要点

| 类型 | 内容 |
|------|------|
| **遗漏章节** | Story §5 T4（版本隔离与单元测试）、Story §6.3（测试标准） |
| **未覆盖要点** | 1) 单元测试：loadManifest 加载 v1/v2 分别返回对应清单；2) manifest 解析成功/失败（格式错误、缺少必填字段）的断言；3) MANIFEST_SCHEMA §3 题目模板与 parser 兼容说明的同步范围 |

---

## 4. 批判审计员结论

**已检查维度**：遗漏需求点、边界未定义、验收不可执行、与前置文档矛盾、孤岛模块（不适用）、伪实现/占位（不适用）、TDD 未执行（不适用）、行号/路径漂移、验收一致性。

**每维度结论**：

- **遗漏需求点**：未通过。Story T4（版本隔离与单元测试）、Story §6.3（Vitest、loadManifest 正确解析/校验失败/版本隔离）未在 spec 中覆盖；MANIFEST_SCHEMA §3 题目模板与 parser 兼容说明的同步范围未明确。
- **边界未定义**：未通过。path 存在性校验（Story 要求 vs spec defer）、difficulty 取值（枚举 vs 任意）、空 manifest 行为、id 格式约定、versionDir 与 version 参数语义，均存在边界未定义。
- **验收不可执行**：通过。AC-1、AC-2 可执行；但 spec 缺少测试任务，实施时验收依据不完整。
- **与前置文档矛盾**：未通过。Story §3.1 明确「path 指向文件存在性校验」，spec §3.3 将其 defer 或可配置，存在矛盾。
- **孤岛模块**：不适用（本 Story 为 spec 阶段，无实现）。
- **伪实现/占位**：不适用。
- **TDD 未执行**：不适用（spec 阶段）。
- **行号/路径漂移**：通过。引用路径可解析，未发现漂移。
- **验收一致性**：部分通过。需求映射表覆盖 AC-1、AC-2，但遗漏 T4 对应的验收支撑。

**本轮结论**：本轮存在 gap。具体项：1) spec 未覆盖 Story T4 与 §6.3 的测试要求；2) spec 存在 6 处模糊表述（path 存在性、difficulty、versionDir、题目模板同步、空 manifest、id 格式）；3) spec §3.3 与 Story §3.1 关于 path 存在性校验存在矛盾。不计数，澄清并修复后重新发起审计。

---

## 5. 最终结论

**结论**：**未通过** — spec 未完全覆盖、验证未通过。

**未通过原因**：

1. **遗漏章节**：Story §5 T4（版本隔离与单元测试）、Story §6.3（测试标准）
2. **未覆盖要点**：单元测试任务、MANIFEST_SCHEMA §3 题目模板与 parser 兼容说明的同步范围
3. **模糊表述**（共 6 处）：
   - spec §3.3：path 存在性校验 vs Story 要求
   - spec §3.2：difficulty「等」的边界
   - spec §4.2：versionDir 与 version 参数语义
   - spec §6：题目模板与 parser 兼容同步范围
   - 全文：空 manifest 合法性及 loadManifest 行为
   - 全文：id 格式约定
4. **与前置文档矛盾**：path 存在性校验（Story 要求实现，spec  defer）

**建议**：触发 clarify 澄清上述模糊表述；补充测试任务（T4）及 MANIFEST_SCHEMA §3 同步范围；统一 path 存在性校验的归属（本 Story 或 Story 8.3），并更新需求映射表。完成后再发起审计。

---

*本审计报告符合 audit-prompts-critical-auditor-appendix.md 格式要求。*
