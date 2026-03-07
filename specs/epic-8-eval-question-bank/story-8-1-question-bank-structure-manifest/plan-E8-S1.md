# Plan E8-S1：题库目录结构与 manifest 实现方案

**Epic**：8 eval-question-bank  
**Story**：8.1 question-bank-structure-manifest  
**前置**：spec-E8-S1.md 已通过审计

---

## 1. 实现概述

按 spec-E8-S1 建立 scoring/eval-questions 目录结构、manifest schema、TypeScript 类型与加载器，实现 v1/v2 版本隔离，并同步 MANIFEST_SCHEMA.md。

---

## 2. Phase 1：目录与 manifest 骨架

### 2.1 任务

| 任务 | 说明 |
|------|------|
| 建立 v1 目录 | 已存在；确保 manifest.yaml 存在且为合法空 manifest（questions: []） |
| 建立 v2 目录 | 新建 scoring/eval-questions/v2/ 及 manifest.yaml（questions: []） |

### 2.2 技术选型

- YAML 解析：使用项目既有 `yaml` 或 `js-yaml`（检查 package.json）。
- 目录创建：Node fs/path API 或确保目录存在的脚本。

### 2.3 验收

- v1、v2 目录存在；各含 manifest.yaml；可解析为 `{ questions: [] }`。

---

## 3. Phase 2：类型定义与 manifest-loader

### 3.1 类型定义

路径：`scoring/eval-questions/types.ts` 或内联于 `manifest-loader.ts`。

```ts
export interface EvalQuestionEntry {
  id: string;
  title: string;
  path: string;
  difficulty?: string;
  tags?: string[];
}

export interface EvalQuestionManifest {
  questions: EvalQuestionEntry[];
}
```

### 3.2 加载器实现

路径：`scoring/eval-questions/manifest-loader.ts`。

- `loadManifest(versionDir: string): EvalQuestionManifest`
  - 解析 `path.join(versionDir, 'manifest.yaml')`
  - 使用 yaml 库解析
  - 校验：questions 为数组；每项含 id、title、path；id 版本内唯一；path 指向文件存在
  - 校验失败抛出 `Error`（含明确消息）

### 3.3 校验逻辑

| 校验项 | 行为 |
|--------|------|
| questions 非数组 | throw Error |
| 项缺少 id/title/path | throw Error |
| id 重复 | throw Error |
| path 指向文件不存在 | throw Error |

### 3.4 验收

- `loadManifest(scoring/eval-questions/v1)` 返回 `{ questions: [] }`（或现有题目）。
- 非法 manifest 或缺失 path 时抛出明确错误。

---

## 4. Phase 3：MANIFEST_SCHEMA.md 同步

### 4.1 任务

- 比对 `scoring/eval-questions/MANIFEST_SCHEMA.md` 与实现 schema。
- 若 questions 结构、字段说明、示例与 TypeScript 类型不一致，则更新文档。
- 确认 §3 题目模板与 parser 兼容说明与 schema 无冲突。

### 4.2 验收

- 文档与实现一一对应；无矛盾。

---

## 5. Phase 4：单元测试

### 5.1 测试文件

路径：`scoring/eval-questions/__tests__/manifest-loader.test.ts`。

### 5.2 用例

| 用例 | 描述 |
|------|------|
| 空 manifest | loadManifest(v1Dir) 返回 { questions: [] } |
| 版本隔离 | loadManifest(v1Dir) 与 loadManifest(v2Dir) 分别返回对应清单 |
| 解析成功 | 合法 manifest 含题目时正确解析 |
| 格式错误 | YAML 格式错误时抛错 |
| 缺少必填字段 | 项缺 id/title/path 时抛错 |
| id 重复 | 版本内 id 重复时抛错 |
| path 不存在 | path 指向文件不存在时抛错 |

### 5.3 集成验证

- 单元测试通过 import `loadManifest` 从生产模块调用，验证模块可被正确导入并在生产代码关键路径中使用（Story 8.2 list 命令将导入此模块）。
- 测试使用真实 v1、v2 目录下的 manifest.yaml（或 fixtures），确保与生产目录结构一致。
- 不修改现有 `scoring/__tests__/e2e/eval-question-flow.test.ts`。

### 5.4 验收

- `npx vitest run scoring/eval-questions` 全部通过。
- `npm test` 通过。

---

## 6. 需求映射清单（plan ↔ 需求文档 + spec）

| 需求文档章节 | spec 对应 | plan 对应 | 覆盖状态 |
|-------------|-----------|----------|----------|
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

---

## 7. 集成测试与端到端测试计划

### 7.1 集成测试

- **目标**：验证 manifest-loader 在生产代码关键路径中可被正确导入并调用。
- **方式**：单元测试文件 `manifest-loader.test.ts` 从 `scoring/eval-questions/manifest-loader` 导入 `loadManifest`，使用真实路径调用，验证返回结果。该测试即构成「模块被导入并调用」的集成验证。
- **后续**：Story 8.2 实现 list 命令时将导入 `loadManifest`，构成生产代码关键路径的完整集成；本 Story 确保 loadManifest 接口正确、可被复用。

### 7.2 端到端验证

- 本 Story 无用户可见命令（list/add/run 属 Story 8.2/8.3）。
- 端到端验证由 Story 8.2 的 list 命令执行时完成；本 Story 产出为可复用基础设施。

---

<!-- AUDIT: PASSED by code-reviewer -->
