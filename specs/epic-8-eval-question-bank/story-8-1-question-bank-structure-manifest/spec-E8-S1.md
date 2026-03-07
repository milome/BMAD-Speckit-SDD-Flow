# Spec E8-S1：题库目录结构与 manifest

**Epic**：8 eval-question-bank  
**Story**：8.1 question-bank-structure-manifest  
**来源**：8-1-question-bank-structure-manifest.md、MANIFEST_SCHEMA.md、prd.eval-ux-last-mile.md §5.5、epics.md §Epic 8

---

## 1. 概述

本 spec 定义 scoring/eval-questions 的目录结构、manifest.yaml schema、TypeScript 类型与加载器，以及 v1/v2 版本隔离。为 Story 8.2（list/add 命令）和 Story 8.3（run 命令）提供 manifest 加载能力。

**范围**：仅包含目录结构、manifest schema、类型定义、加载器、校验逻辑与 MANIFEST_SCHEMA.md 同步；不包含 list/add/run 命令实现。

---

## 2. 目录结构

### 2.1 约定

| 路径 | 说明 |
|------|------|
| `scoring/eval-questions/v1/` | 版本 1 题目目录，内含 manifest.yaml 与题目 .md |
| `scoring/eval-questions/v2/` | 版本 2 题目目录，内含 manifest.yaml 与题目 .md |
| `scoring/eval-questions/manifest-loader.ts` | 加载并解析 manifest.yaml 的 TypeScript 模块 |

### 2.2 目录必须存在

- v1 与 v2 目录必须存在。
- 每个版本目录内含 `manifest.yaml`。
- path 语义：manifest 中 path 为相对 manifest 所在目录的文件路径。

---

## 3. manifest.yaml Schema

### 3.1 结构

```yaml
questions:
  - id: string           # 必填，版本内唯一
    title: string        # 必填
    path: string         # 必填，相对 manifest 所在目录
    difficulty?: string  # 可选，如 easy | medium | hard
    tags?: string[]      # 可选
```

### 3.2 字段约束

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✓ | 版本内唯一；建议 q001 格式，实现不强制 |
| title | string | ✓ | 人类可读标题 |
| path | string | ✓ | 相对 manifest 所在目录；与 id 可不同名 |
| difficulty | string | | 建议 easy/medium/hard，实现允许任意字符串 |
| tags | string[] | | 标签数组 |

### 3.3 校验规则

- questions 为数组；可为空数组 `[]`，loadManifest 返回 `{ questions: [] }`。
- 每项含 id、title、path。
- id 在版本内唯一（运行时校验）。
- path 指向文件存在性：本 Story 实现运行时校验；path 必须指向 manifest 所在目录下的实际文件，否则 loadManifest 抛出明确错误。

---

## 4. TypeScript 类型与加载器

### 4.1 类型定义

- `EvalQuestionEntry`：id、title、path 必填；difficulty、tags 可缺省。
- `EvalQuestionManifest`：`{ questions: EvalQuestionEntry[] }`。

### 4.2 加载器

- 函数：`loadManifest(versionDir: string): EvalQuestionManifest`。
- versionDir：版本目录路径（绝对或相对项目根），如 `scoring/eval-questions/v1`。Story 8.2/8.3 的 `--version v1` 由调用方解析为 `scoring/eval-questions/v1` 后传入。
- 从 `{versionDir}/manifest.yaml` 解析 YAML 并校验。
- 校验失败时抛出明确错误。

---

## 5. 版本隔离

- v1 与 v2 各含独立 manifest.yaml。
- `loadManifest(v1Dir)` 与 `loadManifest(v2Dir)` 分别返回对应目录的题目清单。
- 查询 v1 与 v2 的题目清单相互独立，互不混淆。

---

## 6. MANIFEST_SCHEMA.md 同步

- 若 `scoring/eval-questions/MANIFEST_SCHEMA.md` 与实现 schema 不一致，则更新。
- 确保 questions 结构、字段说明、示例与 TypeScript 类型一一对应。
- 确保 MANIFEST_SCHEMA.md §3 题目模板与 parser 兼容说明与 manifest questions schema 一致、不矛盾（本 Story 不新增 §3 内容，仅校验既有 §3 与 schema 无冲突；若存在冲突则修正）。

---

## 7. 测试要求

- 使用 Vitest。
- 单元测试覆盖：loadManifest 正确解析、校验失败抛错、版本隔离（加载 v1 与 v2 分别返回对应清单）。
- manifest 解析成功/失败（格式错误、缺少必填字段、path 不存在、id 重复）的断言。
- 不修改现有 `scoring/__tests__/e2e/eval-question-flow.test.ts`。

---

## 8. 需求映射清单（spec.md ↔ 原始需求文档）

| 原始文档章节 | 原始需求要点 | spec.md 对应位置 | 覆盖状态 |
|-------------|-------------|------------------|----------|
| Story §3.1 目录结构 | 建立 v1、v2 目录，每版本含 manifest.yaml | spec §2 | ✅ |
| Story §3.1 manifest schema | questions: [{ id, title, path, difficulty?, tags[] }] | spec §3 | ✅ |
| Story §3.1 类型与加载器 | TypeScript 类型、loadManifest、校验 | spec §4 | ✅ |
| Story §3.1 校验规则 | id 版本内唯一、path 存在性 | spec §3.3 | ✅ |
| Story §3.1 MANIFEST_SCHEMA 同步 | 文档与实现一致 | spec §6 | ✅ |
| Story §3.1 版本隔离 | v1 与 v2 独立 manifest | spec §5 | ✅ |
| Story §5 T4 | 版本隔离与单元测试 | spec §7 | ✅ |
| Story §6.3 | Vitest；loadManifest 解析、校验失败、版本隔离 | spec §7 | ✅ |
| REQ-UX-5.1 | 目录结构 scoring/eval-questions/v1/ | spec §2 | ✅ |
| REQ-UX-5.2 | manifest schema questions: [{ id, title, path, difficulty?, tags[] }] | spec §3 | ✅ |
| REQ-UX-5.9（部分） | MANIFEST_SCHEMA 题目模板与 parser 兼容说明 | spec §6 | ✅ |
| AC-1 | manifest schema 定义、TypeScript 类型与加载器 | spec §3、§4 | ✅ |
| AC-2 | 版本隔离，v1 与 v2 题目清单独立 | spec §5 | ✅ |

---

<!-- AUDIT: PASSED by code-reviewer -->
