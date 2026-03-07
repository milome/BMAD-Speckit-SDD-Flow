# Tasks E8-S1：题库目录结构与 manifest

**Epic**：8 eval-question-bank  
**Story**：8.1 question-bank-structure-manifest  
**前置**：spec-E8-S1.md、plan-E8-S1.md、IMPLEMENTATION_GAPS-E8-S1.md 已通过审计

---

## 1. 本批任务 ↔ 需求追溯

| 任务 ID | 需求文档 | 章节 | 需求要点 |
|---------|----------|------|----------|
| T1 | 8-1-question-bank-structure-manifest | §5 T1 | 建立目录结构 |
| T2 | 8-1-question-bank-structure-manifest | §5 T2 | manifest schema 类型与加载器 |
| T3 | 8-1-question-bank-structure-manifest | §5 T3 | MANIFEST_SCHEMA.md 同步 |
| T4 | 8-1-question-bank-structure-manifest | §5 T4 | 版本隔离与单元测试 |

---

## 2. Gaps → 任务映射（按需求文档章节）

**核对规则**：IMPLEMENTATION_GAPS-E8-S1.md 中出现的每一条 Gap 必须在本任务表中出现并对应到具体任务；不得遗漏。

| 章节 | Gap ID | 本任务表行 | 对应任务 |
|------|--------|------------|----------|
| Story §3.1 | GAP-8.1.1 | ✓ 有 | T1 |
| Story §3.1 | GAP-8.1.2、8.1.3、8.1.4 | ✓ 有 | T2 |
| Story §3.1 | GAP-8.1.5、8.1.6 | ✓ 有 | T3、T2 |
| Story §5、plan §5、§7 | GAP-8.1.7、8.1.7a～8.1.7d | ✓ 有 | T4 |

---

## 3. 任务明细

### T1 建立目录结构（AC: #1, #2）

- [x] **T1.1** 确保 `scoring/eval-questions/v1/` 存在
- [x] **T1.2** 确保 `scoring/eval-questions/v2/` 存在
- [x] **T1.3** 每个版本目录内含 `manifest.yaml`（v1 沿用现有空 `questions: []`，v2 新建空 manifest）

**验收**：v1、v2 目录存在；各含 manifest.yaml；可解析为 `{ questions: [] }`。

---

### T2 manifest schema 类型与加载器（AC: #1）

- [x] **T2.1** 定义 `EvalQuestionManifest`、`EvalQuestionEntry` TypeScript 类型（id、title、path 必填；difficulty、tags 可缺省）
- [x] **T2.2** 实现 `loadManifest(versionDir: string): EvalQuestionManifest`，从 manifest.yaml 解析并校验
- [x] **T2.3** 校验规则：questions 为数组；每项含 id、title、path；id 在版本内唯一；path 指向文件存在

**生产代码实现**：
- 文件：`scoring/eval-questions/manifest-loader.ts`
- 导出：`loadManifest`、`EvalQuestionEntry`、`EvalQuestionManifest`
- 使用 `js-yaml` 解析；`fs.existsSync` 校验 path

**验收**：`loadManifest(scoring/eval-questions/v1)` 返回 `{ questions: [] }`；非法 manifest 或 path 不存在时抛错。验收须包含：manifest-loader 可在生产代码关键路径中被导入、实例化并调用（由 T4.3 集成测试验证）。

---

### T3 MANIFEST_SCHEMA.md 同步（AC: #1）

- [x] **T3.1** 比对 `scoring/eval-questions/MANIFEST_SCHEMA.md` 与实现 schema
- [x] **T3.2** 若不一致则更新文档，确保 questions 结构、字段说明、示例与 TypeScript 类型一致

**验收**：文档与实现一一对应；§3 题目模板与 schema 无冲突。

---

### T4 版本隔离与单元测试（AC: #2）

- [x] **T4.1** 单元测试：loadManifest 加载 v1 与 v2 分别返回对应目录的清单
- [x] **T4.2** 单元测试：manifest 解析成功/失败（格式错误、缺少必填字段、id 重复、path 不存在）的断言
- [x] **T4.3** 集成测试：从 `scoring/eval-questions/manifest-loader` 导入 `loadManifest`，使用真实 v1/v2 路径调用，验证返回正确；确保 manifest-loader 可在生产代码关键路径中被导入、实例化并调用

**测试文件**：`scoring/eval-questions/__tests__/manifest-loader.test.ts`

**用例**：空 manifest、版本隔离、解析成功、格式错误、缺必填、id 重复、path 不存在、集成（from 生产模块 import、真实路径调用）

**约束**：不修改 `scoring/__tests__/e2e/eval-question-flow.test.ts`

**验收**：`npx vitest run scoring/eval-questions` 全部通过；`npm test` 通过；验收须包含 manifest-loader 在生产代码关键路径中的集成验证（T4.3）。

---

## 4. 按 Gap 逐条验收表

| Gap ID | 对应任务 | 生产代码实现要点 | 集成测试要求 | 执行情况 | 验证通过 |
|--------|----------|------------------|--------------|----------|----------|
| GAP-8.1.1 | T1 | v2 目录、manifest.yaml | 目录存在、可解析 | [x] 通过 | [x] |
| GAP-8.1.2 | T2 | manifest-loader.ts 类型定义 | 类型可 import | [x] 通过 | [x] |
| GAP-8.1.3 | T2 | loadManifest 函数 | 调用 loadManifest 返回正确 | [x] 通过 | [x] |
| GAP-8.1.4 | T2 | 校验逻辑 | 非法输入抛错 | [x] 通过 | [x] |
| GAP-8.1.5 | T3 | MANIFEST_SCHEMA.md 更新 | 文档比对 | [x] 通过 | [x] |
| GAP-8.1.6 | T1、T2 | v2、loadManifest | 版本隔离用例 | [x] 通过 | [x] |
| GAP-8.1.7～8.1.7d | T4 | manifest-loader.test.ts | 单元+集成：从生产模块 import loadManifest，使用真实 v1/v2 路径调用；npx vitest run scoring/eval-questions | [x] 通过 | [x] |

---

## 5. Agent 执行规则

**禁止事项**：
1. ❌ 禁止在任务描述中添加「注: 将在后续迭代...」
2. ❌ 禁止标记任务完成但功能未实际调用
3. ❌ 禁止仅初始化对象而不在关键路径中使用
4. ❌ 禁止用「预留」「占位」等词规避实现

**必须事项**：
1. ✅ 集成任务必须修改生产代码路径
2. ✅ 必须运行验证命令确认功能启用
3. ✅ 遇到无法完成的情况，应报告阻塞而非自行延迟
4. ✅ 功能/数据路径相关任务实施前必须先检索并阅读需求文档相关章节
5. ✅ TDD 红绿灯：红灯→绿灯→重构；每涉及生产代码的 US 须有 [TDD-RED]、[TDD-GREEN]、[TDD-REFACTOR] 记录

---

## 6. 验收命令

```bash
npm test
# 或
npx vitest run scoring/eval-questions
```

---

<!-- AUDIT: PASSED by code-reviewer -->
