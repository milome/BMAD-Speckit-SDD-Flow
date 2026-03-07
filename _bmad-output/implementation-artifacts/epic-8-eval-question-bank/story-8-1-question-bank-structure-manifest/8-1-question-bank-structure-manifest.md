# Story 8.1：题库目录结构与 manifest

Status: done

**Epic**：8 eval-question-bank  
**Story**：8.1  
**Slug**：question-bank-structure-manifest  
**来源**：epics.md §Epic 8、prd.eval-ux-last-mile.md §5.5（REQ-UX-5.1、REQ-UX-5.2）

---

## 1. 需求追溯

| PRD 需求 ID | 需求描述 | 本 Story 覆盖 | 验收对应 |
|-------------|----------|---------------|----------|
| REQ-UX-5.1 | 目录结构 `scoring/eval-questions/v1/`，含题目 .md 与 manifest.yaml | 是 | AC-1, AC-2 |
| REQ-UX-5.2 | manifest.yaml schema：questions: [{ id, title, path, difficulty?, tags[] }] | 是 | AC-1 |
| REQ-UX-5.9 | 题目文档与 parser 输入格式兼容，定义题目模板 | 由 Story 8.2 负责 add 时生成模板；本 Story 产出 MANIFEST_SCHEMA.md 中题目模板与 parser 兼容说明 |

---

## 2. Story

**As a** 团队 Lead（TeamLead），  
**I want** 在 `scoring/eval-questions/` 下建立版本化目录（v1、v2）及 manifest.yaml  schema，  
**so that** 题目有统一的结构与清单定义，供 list/add/run 命令使用。

---

## 3. Scope

### 3.1 本 Story 实现范围

1. **目录结构**
   - 建立 `scoring/eval-questions/v1/` 目录
   - 建立 `scoring/eval-questions/v2/` 目录（用于版本隔离验证）
   - 每个版本目录内含 `manifest.yaml`

2. **manifest.yaml schema 定义与实现**
   - Schema 结构：`questions: [{ id, title, path, difficulty?, tags[] }]`
   - `id`、`title`、`path` 必填；`difficulty`、`tags` 可缺省
   - 产出 TypeScript 类型与加载器：`scoring/eval-questions/manifest-loader.ts`（或等效模块），供 Story 8.2、8.3 复用
   - 产出 schema 校验逻辑：id 版本内唯一、path 指向文件存在性校验

3. **MANIFEST_SCHEMA.md 同步**
   - 若现有 `scoring/eval-questions/MANIFEST_SCHEMA.md` 与 schema 不一致，则更新
   - 确保文档与实现 schema 一一对应

4. **版本隔离语义**
   - v1 与 v2 各含独立 manifest.yaml
   - 查询 v1 与 v2 的题目清单相互独立（由 manifest-loader 按 version 参数加载对应目录）

### 3.2 非本 Story 范围

| 功能 | 负责 Story | 说明 |
|------|------------|------|
| `/bmad-eval-questions list` 命令 | Story 8.2 | Command 实现、返回题目清单 |
| `/bmad-eval-questions add --title "xxx"` 命令 | Story 8.2 | 生成 q00X-{slug}.md 模板到当前版本目录 |
| `/bmad-eval-questions run --id q001 --version v1` 命令 | Story 8.3 | 加载题目→调用评审/Skill→写入时注入 scenario=eval_question、question_version |
| run_id 约定（eval-q001-v1-{timestamp}） | Story 8.3 | 写入评分时的 run_id 格式 |
| 题目 .md 模板生成逻辑 | Story 8.2 | add 命令生成模板；本 Story 仅定义 schema 与题目模板格式说明 |

---

## 4. 验收标准

| # | Scenario | Given | When | Then |
|---|----------|-------|------|------|
| AC-1 | manifest schema 定义 | — | manifest.yaml 存在 | 含 `questions: [{ id, title, path, difficulty?, tags[] }]`；有 TypeScript 类型定义与加载器可正确解析 |
| AC-2 | 版本隔离 | v1 与 v2 目录存在且各有 manifest.yaml | 调用 manifest-loader 分别加载 v1、v2 | v1 与 v2 的题目清单独立返回，互不混淆 |

---

## 5. Tasks / Subtasks

- [x] **T1** 建立目录结构（AC: #1, #2）
  - [x] T1.1 确保 `scoring/eval-questions/v1/` 存在
  - [x] T1.2 确保 `scoring/eval-questions/v2/` 存在
  - [x] T1.3 每个版本目录内含 `manifest.yaml`（v1 可沿用现有空 `questions: []`，v2 新建空 manifest）

- [x] **T2** manifest schema 类型与加载器（AC: #1）
  - [x] T2.1 定义 `EvalQuestionManifest`、`EvalQuestionEntry` TypeScript 类型（id、title、path 必填；difficulty、tags 可缺省）
  - [x] T2.2 实现 `loadManifest(versionDir: string): EvalQuestionManifest`，从 manifest.yaml 解析并校验
  - [x] T2.3 校验规则：questions 为数组；每项含 id、title、path；id 在版本内唯一（运行时校验）

- [x] **T3** MANIFEST_SCHEMA.md 同步（AC: #1）
  - [x] T3.1 比对 `scoring/eval-questions/MANIFEST_SCHEMA.md` 与实现 schema
  - [x] T3.2 若不一致则更新文档，确保 questions 结构、字段说明、示例与 TypeScript 类型一致

- [x] **T4** 版本隔离与单元测试（AC: #2）
  - [x] T4.1 单元测试：loadManifest 加载 v1 与 v2 分别返回对应目录的清单
  - [x] T4.2 单元测试：manifest 解析成功/失败（格式错误、缺少必填字段）的断言

---

## 6. Dev Notes

### 6.1 相关架构与约束

- **数据隔离**：eval_question 与 real_dev 评分数据严格分离（Story 8.3 实现写入时 scenario=eval_question、question_version）
- **目录约定**：`scoring/eval-questions/{version}/manifest.yaml`，version 为 v1、v2 等
- **path 语义**：manifest 中 path 为相对 manifest 所在目录的文件路径，如 `q001-refactor-scoring.md`

### 6.2 源树与模块

| 组件 | 路径 | 说明 |
|------|------|------|
|  manifest-loader | scoring/eval-questions/manifest-loader.ts（或 manifest/index.ts） | 加载并解析 manifest.yaml |
|  schema 文档 | scoring/eval-questions/MANIFEST_SCHEMA.md | 已存在；本 Story 确保与实现一致 |
|  版本目录 | scoring/eval-questions/v1/、v2/ | 各含 manifest.yaml 与题目 .md |

### 6.3 测试标准

- 使用 Vitest
- 单元测试覆盖：loadManifest 正确解析、校验失败抛错、版本隔离
- 不修改现有 `scoring/__tests__/e2e/eval-question-flow.test.ts`；该文件验证 parse→write→coach 链，与 manifest 加载无直接依赖

### 6.4 Project Structure Notes

- 与 `scoring/query/`、`scoring/coach/` 同级，eval-questions 为 scoring 下独立子模块
- 题目 .md 路径与 `scoring/parsers` 输入格式兼容（见 MANIFEST_SCHEMA.md §3）

### 6.5 References

- [Source: scoring/eval-questions/MANIFEST_SCHEMA.md]
- [Source: _bmad-output/planning-artifacts/dev/epics.md §Epic 8]
- [Source: prd.eval-ux-last-mile.md §5.5]
- [Source: scoring/parsers/__tests__/fixtures/sample-eval-question-report.md]（题目与 parser 兼容示例）

---

## 7. 禁止词表合规声明

本 Story 文档已避免使用禁止词表所列全部词汇（可选、可考虑、后续、先实现、后续扩展、待定、酌情、视情况、技术债）。所有范围界定均采用明确归属（由 Story 8.2、8.3 负责）。

---

## 8. Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- spec/plan/GAPS/tasks 已生成并通过 code-review 审计
- prd.8-1-question-bank-structure-manifest.json、progress.8-1-question-bank-structure-manifest.txt 已创建并更新
- scoring/eval-questions/v2/、manifest-loader.ts、__tests__/manifest-loader.test.ts 已实现
- npm test 325 passed（含 11 个 manifest-loader 用例）

### File List

- scoring/eval-questions/v2/manifest.yaml
- scoring/eval-questions/manifest-loader.ts
- scoring/eval-questions/__tests__/manifest-loader.test.ts
- scoring/eval-questions/MANIFEST_SCHEMA.md（§6 补充实现引用）
